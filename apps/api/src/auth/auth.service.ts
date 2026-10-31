import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { User } from '@kleps/db';
import { ERROR_CODES, type AuthResponse, type LoginInput, type RegisterInput } from '@kleps/shared';
import { AppError } from '../common/errors';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { toMeDto } from '../users/user.mapper';
import { TokenService } from './token.service';

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

// argon2id parameters (OWASP recommended minimums: m=19 MiB, t=2, p=1).
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class AuthService {
  private dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    // Used to equalize timing when the email does not exist.
    this.dummyHash = hash('kleps-timing-equalizer', ARGON_OPTS);
  }

  async register(input: RegisterInput, meta: ClientMeta): Promise<AuthResponse> {
    const [emailOwner, usernameOwner] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { username: input.username }, select: { id: true } }),
    ]);
    if (emailOwner) throw new AppError(HttpStatus.CONFLICT, ERROR_CODES.EMAIL_TAKEN, 'Email already registered');
    if (usernameOwner) throw new AppError(HttpStatus.CONFLICT, ERROR_CODES.USERNAME_TAKEN, 'Username taken');

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash: await hash(input.password, ARGON_OPTS),
        lastLoginAt: new Date(),
      },
    });
    return this.issue(user, randomUUID(), meta);
  }

  async login(input: LoginInput, meta: ClientMeta): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = user?.passwordHash
      ? await verify(user.passwordHash, input.password)
      : (await verify(await this.dummyHash, input.password), false);
    if (!user || !valid) {
      throw new AppError(HttpStatus.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
    }
    if (user.status === 'SUSPENDED') {
      throw new AppError(HttpStatus.FORBIDDEN, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended');
    }
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issue(updated, randomUUID(), meta);
  }

  /**
   * Rotates a refresh token. A token can be used exactly once; presenting an already-rotated or revoked
   * token is treated as theft and revokes the entire session family.
   */
  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthResponse> {
    const invalid = () =>
      new AppError(HttpStatus.UNAUTHORIZED, ERROR_CODES.INVALID_REFRESH_TOKEN, 'Invalid refresh token');
    const tokenHash = this.tokens.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session) throw invalid();

    if (session.revokedAt || session.rotatedAt) {
      await this.revokeFamily(session.familyId);
      throw invalid();
    }
    if (session.expiresAt <= new Date()) throw invalid();
    if (session.user.status === 'SUSPENDED') {
      throw new AppError(HttpStatus.FORBIDDEN, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended');
    }

    // Conditional update guarantees single use even under concurrent refreshes.
    const claimed = await this.prisma.session.updateMany({
      where: { id: session.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.revokeFamily(session.familyId);
      throw invalid();
    }
    return this.issue(session.user, session.familyId, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokens.hashToken(refreshToken) } });
    if (session) await this.revokeFamily(session.familyId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issue(user: User, familyId: string, meta: ClientMeta): Promise<AuthResponse> {
    const access = this.tokens.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = this.tokens.generateRefreshToken();
    const refreshTokenExpiresAt = this.tokens.refreshExpiry();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: this.tokens.hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 256),
      },
    });
    return {
      user: toMeDto(user, this.config),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }
}
