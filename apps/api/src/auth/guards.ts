import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasRole, type UserRole } from '@kleps/shared';
import { ERROR_CODES } from '@kleps/shared';
import { HttpStatus } from '@nestjs/common';
import { AppError, Errors } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest, AuthUser } from './auth.types';
import { ROLES_KEY } from './decorators';
import { TokenService } from './token.service';

function bearer(req: AuthenticatedRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Resolves the user from the access token. The user row is re-read so suspensions/role changes apply immediately. */
@Injectable()
export class AuthResolver {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async resolve(req: AuthenticatedRequest): Promise<AuthUser | null | 'invalid'> {
    const token = bearer(req);
    if (!token) return null;
    const payload = this.tokens.verifyAccessToken(token);
    if (!payload) return 'invalid';
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true, sellerType: true },
    });
    return user ?? 'invalid';
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly resolver: AuthResolver) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.resolver.resolve(req);
    if (!user || user === 'invalid') throw Errors.unauthorized();
    if (user.status === 'SUSPENDED') {
      throw new AppError(HttpStatus.FORBIDDEN, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended');
    }
    req.user = user;
    return true;
  }
}

/** Attaches the user when a valid token is present; never rejects (invalid tokens are treated as anonymous). */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly resolver: AuthResolver) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.resolver.resolve(req);
    if (user && user !== 'invalid' && user.status === 'ACTIVE') req.user = user;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return true;
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw Errors.unauthorized();
    if (!hasRole(user.role, required)) throw Errors.forbidden('Insufficient role');
    return true;
  }
}
