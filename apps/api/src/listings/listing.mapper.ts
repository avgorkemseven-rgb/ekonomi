import type { Brand, Category, Listing, ListingImage, ProductModel, User } from '@kleps/db';
import {
  RENEWAL_WINDOW_DAYS,
  type AttributeValues,
  type CategoryAttributeDto,
  type ListingCardDto,
  type ListingDetailDto,
  type ListingImageDto,
  type ListingStatus,
} from '@kleps/shared';

export const cardInclude = {
  category: { select: { id: true, slug: true, name: true } },
  brand: { select: { id: true, name: true } },
  images: { orderBy: { position: 'asc' as const }, take: 1 },
};

export const detailInclude = {
  category: { select: { id: true, slug: true, name: true } },
  brand: { select: { id: true, name: true } },
  model: { select: { id: true, name: true } },
  images: { orderBy: { position: 'asc' as const } },
  seller: true,
};

type CardListing = Listing & {
  category: Pick<Category, 'id' | 'slug' | 'name'>;
  brand: Pick<Brand, 'id' | 'name'> | null;
  images: ListingImage[];
};

type DetailListing = CardListing & { model: Pick<ProductModel, 'id' | 'name'> | null; seller: User };

/** ACTIVE listings past their expiry are reported as EXPIRED even before the sweep job updates them. */
export function effectiveStatus(listing: Pick<Listing, 'status' | 'expiresAt'>, now = new Date()): ListingStatus {
  if (listing.status === 'ACTIVE' && listing.expiresAt && listing.expiresAt <= now) return 'EXPIRED';
  return listing.status;
}

export function canRenew(listing: Pick<Listing, 'status' | 'expiresAt'>, now = new Date()): boolean {
  const status = effectiveStatus(listing, now);
  if (status === 'EXPIRED') return true;
  if (status !== 'ACTIVE' || !listing.expiresAt) return false;
  return listing.expiresAt.getTime() - now.getTime() <= RENEWAL_WINDOW_DAYS * 86_400_000;
}

export function toImageDto(image: ListingImage): ListingImageDto {
  return {
    id: image.id,
    url: image.url,
    thumbUrl: image.thumbUrl,
    width: image.width,
    height: image.height,
    position: image.position,
  };
}

export function toCardDto(listing: CardListing): ListingCardDto {
  const cover = listing.images[0];
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    priceAmount: listing.priceAmount,
    currency: listing.currency,
    condition: listing.condition,
    city: listing.city,
    district: listing.district,
    status: effectiveStatus(listing),
    coverImage: cover ? toImageDto(cover) : null,
    category: listing.category,
    brand: listing.brand,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    expiresAt: listing.expiresAt?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
  };
}

export function toDetailDto(
  listing: DetailListing,
  opts: {
    isOwner: boolean;
    isModerator: boolean;
    attributeDefinitions: CategoryAttributeDto[];
    categoryPath: { id: string; slug: string; name: string }[];
  },
): ListingDetailDto {
  const dto: ListingDetailDto = {
    ...toCardDto({ ...listing, images: listing.images.slice(0, 1) }),
    description: listing.description,
    model: listing.model,
    attributes: (listing.attributes ?? {}) as AttributeValues,
    attributeDefinitions: opts.attributeDefinitions.map((d) => ({ key: d.key, label: d.label, type: d.type, unit: d.unit })),
    categoryPath: opts.categoryPath,
    images: listing.images.map(toImageDto),
    allowsShipping: listing.allowsShipping,
    allowsInPerson: listing.allowsInPerson,
    seller: {
      id: listing.seller.id,
      username: listing.seller.username,
      displayName: listing.seller.displayName,
      sellerType: listing.seller.sellerType,
      verificationStatus: listing.seller.verificationStatus,
      city: listing.seller.city,
      memberSince: listing.seller.createdAt.toISOString(),
    },
    viewCount: listing.viewCount,
    isOwner: opts.isOwner,
    canRenew: opts.isOwner && canRenew(listing),
  };
  if (opts.isOwner || opts.isModerator) dto.moderationNote = listing.moderationNote;
  return dto;
}
