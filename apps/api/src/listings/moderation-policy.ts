import type { AttributeValues, ListingUpdateInput } from '@kleps/shared';

/**
 * Policy for changes made to listings that are already public (ADR-015). Pure functions, unit-tested.
 */

/** Fields whose change can alter what moderation saw and therefore re-runs the risk assessment. */
const CONTENT_FIELDS = ['title', 'description', 'priceAmount', 'district', 'brandId', 'modelId', 'attributes'] as const;

export interface ListingContentSnapshot {
  categoryId: string;
  title: string;
  description: string;
  priceAmount: number | null;
  district: string | null;
  brandId: string | null;
  modelId: string | null;
  attributes: AttributeValues;
}

const stable = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? JSON.stringify(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
    : JSON.stringify(v ?? null);

/** Which kind of change an update makes. Harmless fields (condition, city, delivery options) are ignored. */
export function classifyListingChange(current: ListingContentSnapshot, input: ListingUpdateInput) {
  const categoryChanged = input.categoryId !== undefined && input.categoryId !== current.categoryId;
  const contentChanged = CONTENT_FIELDS.some((f) => input[f] !== undefined && stable(input[f]) !== stable(current[f]));
  return { categoryChanged, contentChanged };
}

/** Extra free text (beyond title/description) that the risk rules must see. */
export function freeTextOf(listing: { district: string | null; attributes: AttributeValues }): string[] {
  return [listing.district ?? '', ...Object.values(listing.attributes).filter((v): v is string => typeof v === 'string')];
}

export interface PolicyImage {
  createdAt: Date;
  position: number;
}

/**
 * Photos added after the last moderation decision (`reviewedAt`) are unreviewed. A live listing goes back to review
 * when its cover photo is unreviewed or unreviewed photos are the majority — i.e. the images moderation (or the
 * publish-time decision) saw no longer represent the listing. Adding a minority of extra photos stays live.
 */
export function needsMediaReview(images: PolicyImage[], reviewedAt: Date | null): boolean {
  if (images.length === 0) return false;
  const unreviewed = (img: PolicyImage) => reviewedAt === null || img.createdAt > reviewedAt;
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const unreviewedCount = sorted.filter(unreviewed).length;
  return unreviewed(sorted[0]!) || unreviewedCount * 2 > sorted.length;
}
