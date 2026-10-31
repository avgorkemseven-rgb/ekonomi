import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@kleps/shared';
import type { AuthUser, AuthenticatedRequest } from './auth.types';

export const ROLES_KEY = 'kleps:roles';
/** Minimum role required (hierarchical: ADMIN ⊃ MODERATOR ⊃ USER). Use together with JwtAuthGuard + RolesGuard. */
export const Roles = (role: UserRole) => SetMetadata(ROLES_KEY, role);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
