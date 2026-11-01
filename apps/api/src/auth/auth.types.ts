import type { SellerType, UserRole, UserStatus } from '@kleps/shared';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  sellerType: SellerType;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}
