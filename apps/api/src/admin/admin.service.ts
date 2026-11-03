import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@kleps/db';
import {
  ERROR_CODES,
  slugify,
  type AdminListingsQuery,
  type AdminUsersQuery,
  type AttributeCreateInput,
  type AttributeUpdateInput,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from '@kleps/shared';
import type { AuthUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { CategoriesService } from '../categories/categories.service';
import { Errors } from '../common/errors';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { cardInclude, toCardDto } from '../listings/listing.mapper';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly categories: CategoriesService,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async stats() {
    const [byStatus, users, categories, last24h] = await Promise.all([
      this.prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count(),
      this.prisma.category.count(),
      this.prisma.listing.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return {
      listingsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      users,
      categories,
      listingsCreatedLast24h: last24h,
    };
  }

  // ───────────── listings / moderation ─────────────

  async listings(query: AdminListingsQuery) {
    const where: Prisma.ListingWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { id: query.q }, { seller: { username: query.q.toLowerCase() } }],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: { ...cardInclude, seller: { select: { id: true, username: true, displayName: true, createdAt: true, status: true } } },
        orderBy: query.status === 'PENDING_REVIEW' ? [{ updatedAt: 'asc' }] : [{ updatedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((l) => ({
        ...toCardDto(l),
        seller: l.seller,
        riskScore: l.riskScore,
        riskReasons: l.riskReasons,
        moderationNote: l.moderationNote,
        updatedAt: l.updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async approve(actor: AuthUser, id: string, ip?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw Errors.notFound('Listing');
    if (listing.status !== 'PENDING_REVIEW') throw Errors.invalidState('Only listings pending review can be approved');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          publishedAt: listing.publishedAt ?? now,
          expiresAt: new Date(now.getTime() + this.config.LISTING_EXPIRY_DAYS * 86_400_000),
          moderatedAt: now,
          moderatedById: actor.id,
          moderationNote: null,
          // The moderator has now seen the current text and photos: this is the new review baseline (ADR-015).
          contentReviewedAt: now,
        },
      });
      await this.audit.record({ actorId: actor.id, action: 'listing.approve', entityType: 'Listing', entityId: id, ip }, tx);
    });
    return { id, status: 'ACTIVE' };
  }

  async reject(actor: AuthUser, id: string, reason: string, ip?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw Errors.notFound('Listing');
    if (!['PENDING_REVIEW', 'ACTIVE'].includes(listing.status)) throw Errors.invalidState('Listing cannot be rejected in its current state');
    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id },
        data: { status: 'REJECTED', moderationNote: reason, moderatedAt: new Date(), moderatedById: actor.id },
      });
      await this.audit.record(
        { actorId: actor.id, action: 'listing.reject', entityType: 'Listing', entityId: id, metadata: { reason, from: listing.status }, ip },
        tx,
      );
    });
    return { id, status: 'REJECTED' };
  }

  async removeListing(actor: AuthUser, id: string, reason: string, ip?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw Errors.notFound('Listing');
    if (listing.status === 'REMOVED') throw Errors.invalidState('Listing already removed');
    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id },
        data: { status: 'REMOVED', moderationNote: reason, moderatedAt: new Date(), moderatedById: actor.id },
      });
      await this.audit.record(
        { actorId: actor.id, action: 'listing.remove', entityType: 'Listing', entityId: id, metadata: { reason, from: listing.status }, ip },
        tx,
      );
    });
    return { id, status: 'REMOVED' };
  }

  // ───────────── categories ─────────────

  async allCategories() {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
        include: { attributes: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.listing.groupBy({ by: ['categoryId'], _count: { _all: true } }),
    ]);
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return categories.map((c) => ({ ...c, listingCount: countMap.get(c.id) ?? 0 }));
  }

  private async assertValidParent(categoryId: string | null, parentId: string | null | undefined) {
    if (!parentId) return;
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Parent category not found');
    if (!categoryId) return;
    // Prevent cycles: the new parent must not be the category itself or one of its descendants.
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === categoryId) throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Category cannot be moved under itself');
      const node: { parentId: string | null } | null = await this.prisma.category.findUnique({ where: { id: cursor }, select: { parentId: true } });
      cursor = node?.parentId ?? null;
    }
  }

  async createCategory(actor: AuthUser, input: CategoryCreateInput, ip?: string) {
    await this.assertValidParent(null, input.parentId);
    const slug = input.slug ?? slugify(input.name);
    if (await this.prisma.category.findUnique({ where: { slug } })) throw Errors.conflict(ERROR_CODES.CONFLICT, 'Slug already in use');
    const category = await this.prisma.category.create({
      data: {
        name: input.name,
        slug,
        parentId: input.parentId ?? null,
        icon: input.icon ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    await this.audit.record({ actorId: actor.id, action: 'category.create', entityType: 'Category', entityId: category.id, metadata: { ...input }, ip });
    this.categories.invalidate();
    return category;
  }

  async updateCategory(actor: AuthUser, id: string, input: CategoryUpdateInput, ip?: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Category');
    if (input.parentId !== undefined) await this.assertValidParent(id, input.parentId);
    if (input.slug && input.slug !== existing.slug && (await this.prisma.category.findUnique({ where: { slug: input.slug } }))) {
      throw Errors.conflict(ERROR_CODES.CONFLICT, 'Slug already in use');
    }
    const category = await this.prisma.category.update({ where: { id }, data: input });
    await this.audit.record({ actorId: actor.id, action: 'category.update', entityType: 'Category', entityId: id, metadata: { ...input }, ip });
    this.categories.invalidate();
    return category;
  }

  async createAttribute(actor: AuthUser, categoryId: string, input: AttributeCreateInput, ip?: string) {
    if (!(await this.prisma.category.findUnique({ where: { id: categoryId } }))) throw Errors.notFound('Category');
    if (await this.prisma.categoryAttribute.findUnique({ where: { categoryId_key: { categoryId, key: input.key } } })) {
      throw Errors.conflict(ERROR_CODES.CONFLICT, 'Attribute key already exists in this category');
    }
    const attribute = await this.prisma.categoryAttribute.create({ data: { ...input, unit: input.unit ?? null, categoryId } });
    await this.audit.record({ actorId: actor.id, action: 'attribute.create', entityType: 'CategoryAttribute', entityId: attribute.id, metadata: { categoryId, ...input }, ip });
    this.categories.invalidate();
    return attribute;
  }

  async updateAttribute(actor: AuthUser, id: string, input: AttributeUpdateInput, ip?: string) {
    const existing = await this.prisma.categoryAttribute.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Attribute');
    const options = input.options ?? existing.options;
    if (existing.type === 'SELECT' && options.length === 0) {
      throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'SELECT attributes need options');
    }
    const attribute = await this.prisma.categoryAttribute.update({ where: { id }, data: input });
    await this.audit.record({ actorId: actor.id, action: 'attribute.update', entityType: 'CategoryAttribute', entityId: id, metadata: { ...input }, ip });
    this.categories.invalidate();
    return attribute;
  }

  async deleteAttribute(actor: AuthUser, id: string, ip?: string) {
    const existing = await this.prisma.categoryAttribute.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Attribute');
    await this.prisma.categoryAttribute.delete({ where: { id } });
    await this.audit.record({ actorId: actor.id, action: 'attribute.delete', entityType: 'CategoryAttribute', entityId: id, metadata: { key: existing.key, categoryId: existing.categoryId }, ip });
    this.categories.invalidate();
  }

  // ───────────── users ─────────────

  async users(query: AdminUsersQuery) {
    const where: Prisma.UserWhereInput = query.q
      ? { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { username: { contains: query.q.toLowerCase() } }, { displayName: { contains: query.q, mode: 'insensitive' } }] }
      : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { id: true, email: true, username: true, displayName: true, role: true, status: true, sellerType: true, verificationStatus: true, createdAt: true, _count: { select: { listings: true } } },
      }),
    ]);
    return { items: rows, total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
  }

  async setUserStatus(actor: AuthUser, id: string, status: 'ACTIVE' | 'SUSPENDED', reason: string | undefined, ip?: string) {
    if (id === actor.id) throw Errors.forbidden('You cannot change your own status');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw Errors.notFound('User');
    if (user.role === 'ADMIN') throw Errors.forbidden('Administrators cannot be suspended here');
    await this.prisma.user.update({ where: { id }, data: { status } });
    if (status === 'SUSPENDED') await this.auth.revokeAllForUser(id);
    await this.audit.record({ actorId: actor.id, action: status === 'SUSPENDED' ? 'user.suspend' : 'user.unsuspend', entityType: 'User', entityId: id, metadata: { reason: reason ?? null }, ip });
    return { id, status };
  }

  // ───────────── audit ─────────────

  async auditLogs(page: number, pageSize: number, entityId?: string) {
    const where: Prisma.AuditLogWhereInput = entityId ? { entityId } : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, username: true, displayName: true } } },
      }),
    ]);
    return { items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}
