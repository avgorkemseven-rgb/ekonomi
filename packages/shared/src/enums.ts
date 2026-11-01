// Domain enums shared by API, clients and DB. Values must match the Prisma enums (checked by an API test).
export const USER_ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SELLER_TYPES = ['INDIVIDUAL', 'BUSINESS'] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

export const VERIFICATION_STATUSES = ['NONE', 'PENDING', 'VERIFIED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
  'SOLD',
  'ARCHIVED',
  'REMOVED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const ATTRIBUTE_TYPES = ['TEXT', 'NUMBER', 'SELECT', 'BOOLEAN'] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const LISTING_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

/** Role hierarchy used for authorization checks. */
export const ROLE_RANK: Record<UserRole, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };
export function hasRole(role: UserRole, required: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
