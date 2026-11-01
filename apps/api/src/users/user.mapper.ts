import type { User } from '@kleps/db';
import type { MeDto, PublicUserDto } from '@kleps/shared';
import type { AppConfig } from '../config/config';

export function effectiveListingLimit(
  user: Pick<User, 'activeListingLimit' | 'sellerType'>,
  config: Pick<AppConfig, 'LISTING_ACTIVE_LIMIT_INDIVIDUAL' | 'LISTING_ACTIVE_LIMIT_BUSINESS'>,
): number {
  if (user.activeListingLimit != null) return user.activeListingLimit;
  return user.sellerType === 'BUSINESS' ? config.LISTING_ACTIVE_LIMIT_BUSINESS : config.LISTING_ACTIVE_LIMIT_INDIVIDUAL;
}

export function toMeDto(user: User, config: AppConfig): MeDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    sellerType: user.sellerType,
    verificationStatus: user.verificationStatus,
    status: user.status,
    city: user.city,
    bio: user.bio,
    emailVerified: user.emailVerifiedAt != null,
    phoneVerified: user.phoneVerifiedAt != null,
    activeListingLimit: effectiveListingLimit(user, config),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toPublicUserDto(user: User, activeListingCount: number): PublicUserDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    sellerType: user.sellerType,
    verificationStatus: user.verificationStatus,
    city: user.city,
    bio: user.bio,
    memberSince: user.createdAt.toISOString(),
    activeListingCount,
  };
}
