import { z } from 'zod';
import { LISTING_STATUSES } from '../enums';
import { paginationQuerySchema } from './common';

export const adminListingsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LISTING_STATUSES).optional(),
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
});
export type AdminListingsQuery = z.infer<typeof adminListingsQuerySchema>;

export const adminUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const auditQuerySchema = paginationQuerySchema.extend({ entityId: z.string().max(64).optional() });
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const moderationReasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type ModerationReason = z.infer<typeof moderationReasonSchema>;

export const userStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().max(500).optional(),
});
export type UserStatusInput = z.infer<typeof userStatusSchema>;
