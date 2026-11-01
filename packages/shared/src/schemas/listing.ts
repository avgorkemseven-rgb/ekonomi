import { z } from 'zod';
import { MAX_PRICE_KURUS } from '../constants';
import {
  LISTING_CONDITIONS,
  LISTING_SORTS,
  LISTING_STATUSES,
  type ListingCondition,
  type ListingStatus,
  type SellerType,
  type VerificationStatus,
} from '../enums';
import { PROVINCES } from '../utils/provinces';
import { paginationQuerySchema } from './common';

export const attributeValueSchema = z.union([z.string().trim().max(200), z.number().finite(), z.boolean()]);
export const attributeValuesSchema = z.record(z.string().max(40), attributeValueSchema).refine(
  (v) => Object.keys(v).length <= 40,
  'validation.tooManyAttributes',
);
export type AttributeValues = z.infer<typeof attributeValuesSchema>;

const titleSchema = z.string().trim().min(5, 'validation.titleMin').max(100, 'validation.titleMax');
const descriptionSchema = z.string().trim().max(5000, 'validation.descriptionMax');
const priceSchema = z.number().int().min(0).max(MAX_PRICE_KURUS);
const districtSchema = z.string().trim().max(60);

/** Draft creation: only category + title are mandatory; publish-time checks enforce completeness. */
export const listingCreateSchema = z.object({
  categoryId: z.string().min(1),
  title: titleSchema,
  description: descriptionSchema.optional(),
  brandId: z.string().min(1).nullable().optional(),
  modelId: z.string().min(1).nullable().optional(),
  priceAmount: priceSchema.nullable().optional(),
  condition: z.enum(LISTING_CONDITIONS).nullable().optional(),
  city: z.enum(PROVINCES).nullable().optional(),
  district: districtSchema.nullable().optional(),
  attributes: attributeValuesSchema.optional(),
  allowsShipping: z.boolean().optional(),
  allowsInPerson: z.boolean().optional(),
});
export type ListingCreateInput = z.infer<typeof listingCreateSchema>;

export const listingUpdateSchema = listingCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'validation.empty');
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;

export const listingCloseSchema = z.object({ reason: z.enum(['SOLD', 'ARCHIVED']) });
export type ListingCloseInput = z.infer<typeof listingCloseSchema>;

export const imageOrderSchema = z.object({ imageIds: z.array(z.string().min(1)).min(1).max(15) });
export type ImageOrderInput = z.infer<typeof imageOrderSchema>;

export const myListingsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LISTING_STATUSES).optional(),
});
export type MyListingsQuery = z.infer<typeof myListingsQuerySchema>;

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Public search. Prices in the query string are whole TL; attribute filters use `attr_<key>` / `attr_<key>_min|_max`. */
export const listingSearchSchema = paginationQuerySchema.extend({
  q: optionalString(100),
  category: optionalString(80),
  brand: optionalString(80),
  model: optionalString(80),
  city: z.enum(PROVINCES).optional(),
  condition: z.enum(LISTING_CONDITIONS).optional(),
  minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  seller: optionalString(30),
  sort: z.enum(LISTING_SORTS).default('newest'),
  attrs: z.record(z.string(), z.string().max(100)).default({}),
});
export type ListingSearchQuery = z.infer<typeof listingSearchSchema>;

/** Moves `attr_*` keys of a raw query object into `attrs` before validation. */
export function parseListingSearchQuery(raw: Record<string, unknown>) {
  const attrs: Record<string, string> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (key.startsWith('attr_')) {
      const attrKey = key.slice(5);
      if (/^[a-zA-Z][a-zA-Z0-9]*(_min|_max)?$/.test(attrKey) && typeof v === 'string' && v !== '') {
        attrs[attrKey] = v;
      }
    } else if (v !== '' && v !== undefined) {
      rest[key] = v;
    }
  }
  return listingSearchSchema.safeParse({ ...rest, attrs });
}

export interface ListingImageDto {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  position: number;
}

export interface ListingSellerDto {
  id: string;
  username: string;
  displayName: string;
  sellerType: SellerType;
  verificationStatus: VerificationStatus;
  city: string | null;
  memberSince: string;
}

export interface ListingCardDto {
  id: string;
  slug: string;
  title: string;
  priceAmount: number | null;
  currency: string;
  condition: ListingCondition | null;
  city: string | null;
  district: string | null;
  status: ListingStatus;
  coverImage: ListingImageDto | null;
  category: { id: string; slug: string; name: string };
  brand: { id: string; name: string } | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ListingDetailDto extends ListingCardDto {
  description: string;
  model: { id: string; name: string } | null;
  attributes: AttributeValues;
  /** Attribute definitions (with labels/units) for rendering `attributes`. */
  attributeDefinitions: { key: string; label: string; type: string; unit: string | null }[];
  categoryPath: { id: string; slug: string; name: string }[];
  images: ListingImageDto[];
  allowsShipping: boolean;
  allowsInPerson: boolean;
  seller: ListingSellerDto;
  viewCount: number;
  /** Present only for the owner/moderators. */
  moderationNote?: string | null;
  isOwner: boolean;
  canRenew: boolean;
}
