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

/** Max times one rotated token may be re-presented inside the grace window before it is treated as replay. */
export const GRACE_REPLAY_LIMIT = 5;

type RefreshOutcome =
  | { kind: 'grant'; user: User; refreshToken: string; refreshTokenExpiresAt: Date }
  | { kind: 'replay'; familyId: string }
  | { kind: 'suspended' }
  | { kind: 'invalid' };

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
   * Rotates a refresh token (ADR-014).
   *
   * - The session row is locked (`SELECT … FOR UPDATE`), so concurrent refreshes of one token are serialized.
   * - The first request rotates it and creates exactly one successor whose token is derived deterministically
   *   from the presented token (see TokenService.deriveSuccessorToken).
   * - A rotated token presented again within REFRESH_REUSE_GRACE_SECONDS (max 60 s) and at most
   *   GRACE_REPLAY_LIMIT times receives the *same* successor plus a fresh access token — no new session is created,
   *   so the successor stays single-use and later double use is still detected.
   * - Any other reuse of a rotated or revoked token (outside the window, over the cap, or after the successor
   *   was itself used/revoked) is replay: the family is revoked, except the ambiguous in-window case where the
   *   successor was already used, which is rejected without revocation.
   */
  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthResponse> {
    const tokenHash = this.tokens.hashToken(refreshToken);
    const outcome = await this.prisma.$transaction(async (tx): Promise<RefreshOutcome> => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Session" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      if (!locked[0]) return { kind: 'invalid' };
      const session = await tx.session.findUniqueOrThrow({ where: { id: locked[0].id }, include: { user: true } });
      const now = new Date();

      if (session.revokedAt) return { kind: 'replay', familyId: session.familyId };

      if (session.rotatedAt) {
        const inWindow = now.getTime() - session.rotatedAt.getTime() < this.config.REFRESH_REUSE_GRACE_SECONDS * 1000;
        if (!inWindow || session.graceReplayCount >= GRACE_REPLAY_LIMIT) return { kind: 'replay', familyId: session.familyId };
        const successor = session.replacedById ? await tx.session.findUnique({ where: { id: session.replacedById } }) : null;
        const successorToken = this.tokens.deriveSuccessorToken(refreshToken);
        if (
          !successor ||
          successor.revokedAt ||
          successor.rotatedAt ||
          successor.expiresAt <= now ||
          successor.tokenHash !== this.tokens.hashToken(successorToken)
        ) {
          return { kind: 'invalid' };
        }
        if (session.user.status === 'SUSPENDED') return { kind: 'suspended' };
        await tx.session.update({ where: { id: session.id }, data: { graceReplayCount: { increment: 1 } } });
        return { kind: 'grant', user: session.user, refreshToken: successorToken, refreshTokenExpiresAt: successor.expiresAt };
      }

      if (session.expiresAt <= now) return { kind: 'invalid' };
      if (session.user.status === 'SUSPENDED') return { kind: 'suspended' };

      const successorToken = this.tokens.deriveSuccessorToken(refreshToken);
      const successor = await tx.session.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: this.tokens.hashToken(successorToken),
          expiresAt: this.tokens.refreshExpiry(),
          ip: meta.ip?.slice(0, 64),
          userAgent: meta.userAgent?.slice(0, 256),
        },
      });
      await tx.session.update({ where: { id: session.id }, data: { rotatedAt: now, replacedById: successor.id } });
      return { kind: 'grant', user: session.user, refreshToken: successorToken, refreshTokenExpiresAt: successor.expiresAt };
    });

    switch (outcome.kind) {
      case 'grant':
        return this.respond(outcome.user, outcome.refreshToken, outcome.refreshTokenExpiresAt);
      case 'suspended':
        throw new AppError(HttpStatus.FORBIDDEN, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended');
      case 'replay':
        // Revocation is committed separately so it persists even though the request fails.
        await this.revokeFamily(outcome.familyId);
        throw new AppError(HttpStatus.UNAUTHORIZED, ERROR_CODES.INVALID_REFRESH_TOKEN, 'Invalid refresh token');
      case 'invalid':
        throw new AppError(HttpStatus.UNAUTHORIZED, ERROR_CODES.INVALID_REFRESH_TOKEN, 'Invalid refresh token');
    }
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

  /** Starts a new session family (login / registration) with a random refresh token. */
  private async issue(user: User, familyId: string, meta: ClientMeta): Promise<AuthResponse> {
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
    return this.respond(user, refreshToken, refreshTokenExpiresAt);
  }

  private respond(user: User, refreshToken: string, refreshTokenExpiresAt: Date): AuthResponse {
    const access = this.tokens.signAccessToken({ sub: user.id, role: user.role });
    return {
      user: toMeDto(user, this.config),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }
}
