import { z } from 'zod';
import type { SellerType, UserRole, UserStatus, VerificationStatus } from '../enums';
import { PROVINCES } from '../utils/provinces';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: 'validation.email' }));

export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordMin')
  .max(128, 'validation.passwordMax')
  .refine((v) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v) && /\d/.test(v), 'validation.passwordWeak');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'validation.usernameMin')
  .max(30, 'validation.usernameMax')
  .regex(/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/, 'validation.usernameFormat');

export const displayNameSchema = z.string().trim().min(2, 'validation.displayNameMin').max(60);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export type RefreshInput = z.infer<typeof refreshSchema>;

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema,
    bio: z.string().trim().max(500).nullable(),
    city: z.enum(PROVINCES).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'validation.empty');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** The authenticated user's own account view. */
export interface MeDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  sellerType: SellerType;
  verificationStatus: VerificationStatus;
  status: UserStatus;
  city: string | null;
  bio: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  activeListingLimit: number;
  createdAt: string;
}

export interface AuthResponse {
  user: MeDto;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** Public seller profile — never contains email or phone. */
export interface PublicUserDto {
  id: string;
  username: string;
  displayName: string;
  sellerType: SellerType;
  verificationStatus: VerificationStatus;
  city: string | null;
  bio: string | null;
  memberSince: string;
  activeListingCount: number;
}
