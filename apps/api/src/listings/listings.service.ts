import { HttpStatus, Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Listing, Prisma } from '@kleps/db';
import {
  ERROR_CODES,
  buildListingSearchText,
  hasRole,
  searchTokens,
  slugify,
  validateAttributes,
  type AttributeValues,
  type ListingCardDto,
  type ListingCloseInput,
  type ListingCreateInput,
  type ListingDetailDto,
  type ListingSearchQuery,
  type ListingUpdateInput,
  type MyListingsQuery,
  type Paginated,
} from '@kleps/shared';
import type { AuthUser } from '../auth/auth.types';
import { AppError, Errors } from '../common/errors';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { effectiveListingLimit } from '../users/user.mapper';
import { canRenew, cardInclude, detailInclude, effectiveStatus, toCardDto, toDetailDto } from './listing.mapper';
import { assessListingRisk } from './risk';

const EDITABLE: Listing['status'][] = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED'];
const PUBLISHABLE: Listing['status'][] = ['DRAFT', 'REJECTED'];
const CLOSABLE: Listing['status'][] = ['ACTIVE', 'PENDING_REVIEW', 'EXPIRED'];
const MIN_DESCRIPTION = 20;

function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

@Injectable()
export class ListingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListingsService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ───────────────────────────── lifecycle: expiry sweep ─────────────────────────────

  onModuleInit(): void {
    if (this.config.EXPIRY_SWEEP_ENABLED && this.config.NODE_ENV !== 'test') {
      this.sweepTimer = setInterval(() => void this.expireDue().catch((e) => this.logger.error(e)), 10 * 60_000);
      this.sweepTimer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  /** Idempotent: marks ACTIVE listings past expiry as EXPIRED. Reads already treat them as expired. */
  async expireDue(now = new Date()): Promise<number> {
    const res = await this.prisma.listing.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    if (res.count) this.logger.log(`Expired ${res.count} listings`);
    return res.count;
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private expiryFrom(now: Date): Date {
    return new Date(now.getTime() + this.config.LISTING_EXPIRY_DAYS * 86_400_000);
  }

  async getOwned(id: string, user: AuthUser): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw Errors.notFound('Listing');
    if (listing.sellerId !== user.id) throw Errors.forbidden('Not the owner of this listing');
    return listing;
  }

  /** Validates category/brand/model/attributes and derives slug + search text. */
  private async prepareContent(
    merged: {
      categoryId: string;
      title: string;
      description: string;
      brandId: string | null;
      modelId: string | null;
      attributes: AttributeValues;
    },
    requireAllAttributes: boolean,
  ) {
    const category = await this.categories.getVisibleById(merged.categoryId);
    if (!category) throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Unknown category', [{ path: ['categoryId'], message: 'validation.invalid' }]);
    if (!(await this.categories.isLeaf(category.id))) {
      throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Choose a sub-category', [{ path: ['categoryId'], message: 'validation.leafCategory' }]);
    }

    let brandName: string | null = null;
    let modelName: string | null = null;
    if (merged.brandId) {
      const ids = await this.categories.pathOf(category.id);
      const brand = await this.prisma.brand.findFirst({
        where: { id: merged.brandId, isActive: true, categories: { some: { id: { in: ids.map((c) => c.id) } } } },
      });
      if (!brand) throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Brand not available in category', [{ path: ['brandId'], message: 'validation.invalid' }]);
      brandName = brand.name;
    }
    if (merged.modelId) {
      const model = merged.brandId
        ? await this.prisma.productModel.findFirst({ where: { id: merged.modelId, brandId: merged.brandId, isActive: true } })
        : null;
      if (!model) throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Model does not belong to brand', [{ path: ['modelId'], message: 'validation.invalid' }]);
      modelName = model.name;
    }

    const defs = await this.categories.effectiveAttributes(category.id);
    const { values, issues } = validateAttributes(defs, merged.attributes, requireAllAttributes);
    if (issues.length) {
      throw Errors.badRequest(
        ERROR_CODES.INVALID_ATTRIBUTES,
        'Invalid attributes',
        issues.map((i) => ({ path: ['attributes', i.key], message: `attribute.${i.code}` })),
      );
    }
    const path = await this.categories.pathOf(category.id);
    return {
      attributes: values,
      slug: slugify(merged.title) || 'ilan',
      searchText: buildListingSearchText({
        title: merged.title,
        description: merged.description,
        brandName,
        modelName,
        categoryNames: path.map((p) => p.name),
        attributeValues: Object.values(values),
      }),
    };
  }

  private async withDetail(id: string, viewer: AuthUser | undefined): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id }, include: detailInclude });
    return toDetailDto(listing, {
      isOwner: viewer?.id === listing.sellerId,
      isModerator: viewer ? hasRole(viewer.role, 'MODERATOR') : false,
      attributeDefinitions: await this.categories.effectiveAttributes(listing.categoryId),
      categoryPath: await this.categories.pathOf(listing.categoryId),
    });
  }

  // ───────────────────────────── commands ─────────────────────────────

  async create(user: AuthUser, input: ListingCreateInput): Promise<ListingDetailDto> {
    const content = await this.prepareContent(
      {
        categoryId: input.categoryId,
        title: input.title,
        description: input.description ?? '',
        brandId: input.brandId ?? null,
        modelId: input.modelId ?? null,
        attributes: input.attributes ?? {},
      },
      false,
    );
    const listing = await this.prisma.listing.create({
      data: {
        sellerId: user.id,
        categoryId: input.categoryId,
        brandId: input.brandId ?? null,
        modelId: input.modelId ?? null,
        title: input.title,
        description: input.description ?? '',
        priceAmount: input.priceAmount ?? null,
        condition: input.condition ?? null,
        city: input.city ?? null,
        district: input.district ?? null,
        allowsShipping: input.allowsShipping ?? false,
        allowsInPerson: input.allowsInPerson ?? true,
        status: 'DRAFT',
        ...content,
      },
    });
    return this.withDetail(listing.id, user);
  }

  async update(user: AuthUser, id: string, input: ListingUpdateInput): Promise<ListingDetailDto> {
    const listing = await this.getOwned(id, user);
    if (!EDITABLE.includes(listing.status)) throw Errors.invalidState(`Cannot edit a ${listing.status} listing`);

    const categoryChanged = input.categoryId !== undefined && input.categoryId !== listing.categoryId;
    const brandChanged = input.brandId !== undefined && input.brandId !== listing.brandId;
    const merged = {
      categoryId: input.categoryId ?? listing.categoryId,
      title: input.title ?? listing.title,
      description: input.description ?? listing.description,
      brandId: input.brandId !== undefined ? input.brandId : listing.brandId,
      // Changing brand/category without a new model clears an incompatible model.
      modelId: input.modelId !== undefined ? input.modelId : brandChanged || categoryChanged ? null : listing.modelId,
      attributes: input.attributes ?? (categoryChanged ? {} : (listing.attributes as AttributeValues)),
    };
    const isLive = listing.status === 'ACTIVE' || listing.status === 'PENDING_REVIEW';
    const content = await this.prepareContent(merged, isLive);

    const data: Prisma.ListingUncheckedUpdateInput = {
      ...merged,
      ...content,
      ...(input.priceAmount !== undefined && { priceAmount: input.priceAmount }),
      ...(input.condition !== undefined && { condition: input.condition }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.district !== undefined && { district: input.district }),
      ...(input.allowsShipping !== undefined && { allowsShipping: input.allowsShipping }),
      ...(input.allowsInPerson !== undefined && { allowsInPerson: input.allowsInPerson }),
    };

    if (isLive) {
      // Live listings must stay complete, and edited content is re-assessed.
      this.assertPublishable({ ...listing, ...merged, ...(data as Partial<Listing>) } as Listing, Infinity);
      if (listing.status === 'ACTIVE' && (input.title !== undefined || input.description !== undefined || input.priceAmount !== undefined)) {
        const risk = await this.assess(user, { ...listing, ...merged, priceAmount: (data.priceAmount as number | null | undefined) ?? listing.priceAmount });
        if (risk.requiresReview) {
          Object.assign(data, { status: 'PENDING_REVIEW', riskScore: risk.score, riskReasons: risk.reasons });
        }
      }
    }
    await this.prisma.listing.update({ where: { id }, data });
    return this.withDetail(id, user);
  }

  async remove(user: AuthUser, id: string): Promise<{ id: string; imageKeys: string[] }> {
    const listing = await this.getOwned(id, user);
    if (listing.status !== 'DRAFT') throw Errors.invalidState('Only drafts can be deleted; close the listing instead');
    const images = await this.prisma.listingImage.findMany({ where: { listingId: id } });
    await this.prisma.listing.delete({ where: { id } });
    return { id, imageKeys: images.flatMap((i) => [i.storageKey, i.thumbStorageKey]) };
  }

  private assertPublishable(listing: Listing, imageCount: number): void {
    const issues: { path: string[]; message: string }[] = [];
    if (listing.description.trim().length < MIN_DESCRIPTION) issues.push({ path: ['description'], message: 'validation.descriptionMin' });
    if (!listing.priceAmount || listing.priceAmount < 100) issues.push({ path: ['priceAmount'], message: 'validation.required' });
    if (!listing.condition) issues.push({ path: ['condition'], message: 'validation.required' });
    if (!listing.city) issues.push({ path: ['city'], message: 'validation.required' });
    if (!listing.allowsInPerson && !listing.allowsShipping) issues.push({ path: ['allowsInPerson'], message: 'validation.deliveryRequired' });
    if (imageCount < 1) issues.push({ path: ['images'], message: 'validation.photoRequired' });
    if (issues.length) throw Errors.badRequest(ERROR_CODES.LISTING_NOT_PUBLISHABLE, 'Listing is incomplete', issues);
  }

  private async assess(user: AuthUser, listing: Pick<Listing, 'title' | 'description' | 'priceAmount'>) {
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true } });
    const recent = await this.prisma.listing.count({
      where: { sellerId: user.id, publishedAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    const risk = assessListingRisk({
      title: listing.title,
      description: listing.description,
      priceAmount: listing.priceAmount,
      accountAgeHours: (Date.now() - account.createdAt.getTime()) / 3_600_000,
      recentPublishCount24h: recent,
    });
    if (this.config.MODERATION_MODE === 'all') return { ...risk, requiresReview: true };
    if (this.config.MODERATION_MODE === 'none') return { ...risk, requiresReview: false };
    return risk;
  }

  /** Runs `fn` while holding a per-seller lock so concurrent publishes cannot exceed the listing limit. */
  private async withSellerLimit<T>(
    sellerId: string,
    excludeListingId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${sellerId}))) AS l`;
      const seller = await tx.user.findUniqueOrThrow({ where: { id: sellerId } });
      if (seller.status !== 'ACTIVE') throw new AppError(HttpStatus.FORBIDDEN, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended');
      const limit = effectiveListingLimit(seller, this.config);
      const now = new Date();
      const active = await tx.listing.count({
        where: {
          sellerId,
          id: { not: excludeListingId },
          OR: [{ status: 'PENDING_REVIEW' }, { status: 'ACTIVE', expiresAt: { gt: now } }],
        },
      });
      if (active >= limit) {
        throw new AppError(HttpStatus.CONFLICT, ERROR_CODES.LISTING_LIMIT_REACHED, `Active listing limit (${limit}) reached`);
      }
      return fn(tx);
    });
  }

  async publish(user: AuthUser, id: string): Promise<ListingDetailDto> {
    const listing = await this.getOwned(id, user);
    if (!PUBLISHABLE.includes(listing.status)) throw Errors.invalidState(`Cannot publish a ${listing.status} listing`);
    const imageCount = await this.prisma.listingImage.count({ where: { listingId: id } });
    this.assertPublishable(listing, imageCount);
    // Required attributes are enforced at publish time.
    await this.prepareContent(
      { ...listing, attributes: listing.attributes as AttributeValues },
      true,
    );
    const risk = await this.assess(user, listing);
    await this.withSellerLimit(user.id, id, async (tx) => {
      const now = new Date();
      await tx.listing.update({
        where: { id },
        data: risk.requiresReview
          ? { status: 'PENDING_REVIEW', riskScore: risk.score, riskReasons: risk.reasons, moderationNote: null }
          : {
              status: 'ACTIVE',
              riskScore: risk.score,
              riskReasons: risk.reasons,
              publishedAt: now,
              expiresAt: this.expiryFrom(now),
              moderationNote: null,
            },
      });
    });
    return this.withDetail(id, user);
  }

  async renew(user: AuthUser, id: string): Promise<ListingDetailDto> {
    const listing = await this.getOwned(id, user);
    if (!canRenew(listing)) throw Errors.invalidState('Listing is not eligible for renewal yet');
    const wasExpired = effectiveStatus(listing) === 'EXPIRED';
    const apply = async (tx: Prisma.TransactionClient) => {
      const now = new Date();
      await tx.listing.update({
        where: { id },
        data: { status: 'ACTIVE', expiresAt: this.expiryFrom(now), renewCount: { increment: 1 }, ...(wasExpired && { publishedAt: now }) },
      });
    };
    if (wasExpired) await this.withSellerLimit(user.id, id, apply);
    else await apply(this.prisma);
    return this.withDetail(id, user);
  }

  async close(user: AuthUser, id: string, input: ListingCloseInput): Promise<ListingDetailDto> {
    const listing = await this.getOwned(id, user);
    if (!CLOSABLE.includes(listing.status)) throw Errors.invalidState(`Cannot close a ${listing.status} listing`);
    await this.prisma.listing.update({ where: { id }, data: { status: input.reason, closedAt: new Date() } });
    return this.withDetail(id, user);
  }

  // ───────────────────────────── queries ─────────────────────────────

  async getById(id: string, viewer: AuthUser | undefined): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, expiresAt: true, seller: { select: { status: true } } },
    });
    if (!listing) throw Errors.notFound('Listing');
    const isOwner = viewer?.id === listing.sellerId;
    const isModerator = viewer ? hasRole(viewer.role, 'MODERATOR') : false;
    const publiclyVisible = effectiveStatus(listing) === 'ACTIVE' && listing.seller.status === 'ACTIVE';
    if (!publiclyVisible && !isOwner && !isModerator) throw Errors.notFound('Listing');
    if (!isOwner && publiclyVisible) {
      // Best-effort counter; not worth failing the read for.
      void this.prisma.listing.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
    }
    return this.withDetail(id, viewer);
  }

  async myListings(user: AuthUser, query: MyListingsQuery): Promise<Paginated<ListingCardDto>> {
    const now = new Date();
    let where: Prisma.ListingWhereInput = { sellerId: user.id };
    if (query.status === 'ACTIVE') where = { ...where, status: 'ACTIVE', expiresAt: { gt: now } };
    else if (query.status === 'EXPIRED') where = { ...where, OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', expiresAt: { lte: now } }] };
    else if (query.status) where = { ...where, status: query.status };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: cardInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(rows.map(toCardDto), total, query.page, query.pageSize);
  }

  async search(query: ListingSearchQuery): Promise<Paginated<ListingCardDto>> {
    const now = new Date();
    const and: Prisma.ListingWhereInput[] = [
      { status: 'ACTIVE', expiresAt: { gt: now }, seller: { status: 'ACTIVE' } },
    ];

    if (query.q) {
      for (const token of searchTokens(query.q)) and.push({ searchText: { contains: token } });
    }

    let categoryId: string | null = null;
    if (query.category) {
      const category = await this.categories.getVisibleById(query.category).then(
        (c) => c ?? this.categories.getVisibleBySlug(query.category!).catch(() => null),
      );
      if (!category) return paginate([], 0, query.page, query.pageSize);
      categoryId = category.id;
      and.push({ categoryId: { in: await this.categories.descendantIds(category.id) } });
    }
    if (query.brand) and.push({ brand: { OR: [{ slug: query.brand }, { id: query.brand }] } });
    if (query.model) and.push({ model: { OR: [{ slug: query.model }, { id: query.model }] } });
    if (query.city) and.push({ city: query.city });
    if (query.condition) and.push({ condition: query.condition });
    if (query.minPrice !== undefined) and.push({ priceAmount: { gte: query.minPrice * 100 } });
    if (query.maxPrice !== undefined) and.push({ priceAmount: { lte: query.maxPrice * 100 } });
    if (query.seller) and.push({ seller: { username: query.seller.toLowerCase() } });

    if (categoryId && Object.keys(query.attrs).length) {
      const defs = new Map((await this.categories.effectiveAttributes(categoryId)).map((d) => [d.key, d]));
      for (const [rawKey, value] of Object.entries(query.attrs)) {
        const range = rawKey.match(/^(.*)_(min|max)$/);
        const key = range ? range[1]! : rawKey;
        const def = defs.get(key);
        if (!def || !def.filterable) continue;
        if (def.type === 'NUMBER') {
          const n = Number(value.replace(',', '.'));
          if (!Number.isFinite(n)) continue;
          if (!range) and.push({ attributes: { path: [key], equals: n } });
          else if (range[2] === 'min') and.push({ attributes: { path: [key], gte: n } });
          else and.push({ attributes: { path: [key], lte: n } });
        } else if (def.type === 'BOOLEAN') {
          if (value === 'true' || value === 'false') and.push({ attributes: { path: [key], equals: value === 'true' } });
        } else if (!range) {
          and.push({ attributes: { path: [key], equals: value } });
        }
      }
    }

    const orderBy: Prisma.ListingOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ priceAmount: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]
        : query.sort === 'price_desc'
          ? [{ priceAmount: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }]
          : [{ publishedAt: 'desc' }, { id: 'desc' }];

    const where: Prisma.ListingWhereInput = { AND: and };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: cardInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(rows.map(toCardDto), total, query.page, query.pageSize);
  }
}
