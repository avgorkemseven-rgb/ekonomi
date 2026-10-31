import { Injectable } from '@nestjs/common';
import type { Category, CategoryAttribute } from '@kleps/db';
import type { CategoryAttributeDto, CategoryDetailDto, CategoryNodeDto } from '@kleps/shared';
import { Errors } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

interface Snapshot {
  loadedAt: number;
  byId: Map<string, Category>;
  bySlug: Map<string, Category>;
  children: Map<string | null, Category[]>;
  attributes: Map<string, CategoryAttribute[]>;
}

const TTL_MS = 60_000;

/**
 * Categories are small and read constantly, so the whole tree is cached in memory and
 * invalidated on admin writes (and every 60 s to pick up changes from other instances).
 */
@Injectable()
export class CategoriesService {
  private snapshot: Snapshot | null = null;
  private loading: Promise<Snapshot> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void {
    this.snapshot = null;
  }

  private async load(): Promise<Snapshot> {
    if (this.snapshot && Date.now() - this.snapshot.loadedAt < TTL_MS) return this.snapshot;
    if (!this.loading) {
      this.loading = (async () => {
        const [categories, attributes] = await Promise.all([
          this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
          this.prisma.categoryAttribute.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
        ]);
        const snap: Snapshot = {
          loadedAt: Date.now(),
          byId: new Map(categories.map((c) => [c.id, c])),
          bySlug: new Map(categories.map((c) => [c.slug, c])),
          children: new Map(),
          attributes: new Map(),
        };
        for (const c of categories) {
          const list = snap.children.get(c.parentId) ?? [];
          list.push(c);
          snap.children.set(c.parentId, list);
        }
        for (const a of attributes) {
          const list = snap.attributes.get(a.categoryId) ?? [];
          list.push(a);
          snap.attributes.set(a.categoryId, list);
        }
        this.snapshot = snap;
        return snap;
      })().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  /** A category is visible only if it and all its ancestors are active. */
  private isVisible(snap: Snapshot, category: Category): boolean {
    let current: Category | undefined = category;
    while (current) {
      if (!current.isActive) return false;
      current = current.parentId ? snap.byId.get(current.parentId) : undefined;
    }
    return true;
  }

  private ancestors(snap: Snapshot, category: Category): Category[] {
    const path: Category[] = [];
    let current: Category | undefined = category;
    while (current) {
      path.unshift(current);
      current = current.parentId ? snap.byId.get(current.parentId) : undefined;
    }
    return path;
  }

  async tree(): Promise<CategoryNodeDto[]> {
    const snap = await this.load();
    const build = (parentId: string | null): CategoryNodeDto[] =>
      (snap.children.get(parentId) ?? [])
        .filter((c) => c.isActive)
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          icon: c.icon,
          parentId: c.parentId,
          sortOrder: c.sortOrder,
          children: build(c.id),
        }));
    return build(null);
  }

  /** Effective attribute definitions: ancestors first, then own; a descendant redefining a key wins. */
  async effectiveAttributes(categoryId: string): Promise<CategoryAttributeDto[]> {
    const snap = await this.load();
    const category = snap.byId.get(categoryId);
    if (!category) return [];
    const byKey = new Map<string, CategoryAttributeDto>();
    for (const node of this.ancestors(snap, category)) {
      for (const a of snap.attributes.get(node.id) ?? []) {
        byKey.set(a.key, {
          id: a.id,
          key: a.key,
          label: a.label,
          type: a.type,
          options: a.options,
          unit: a.unit,
          required: a.required,
          filterable: a.filterable,
          sortOrder: a.sortOrder,
        });
      }
    }
    return [...byKey.values()];
  }

  async getVisibleBySlug(slug: string): Promise<Category> {
    const snap = await this.load();
    const category = snap.bySlug.get(slug);
    if (!category || !this.isVisible(snap, category)) throw Errors.notFound('Category');
    return category;
  }

  async getVisibleById(id: string): Promise<Category | null> {
    const snap = await this.load();
    const category = snap.byId.get(id);
    return category && this.isVisible(snap, category) ? category : null;
  }

  async isLeaf(id: string): Promise<boolean> {
    const snap = await this.load();
    return !(snap.children.get(id) ?? []).some((c) => c.isActive);
  }

  /** IDs of the category and all visible descendants (for search filters). */
  async descendantIds(id: string): Promise<string[]> {
    const snap = await this.load();
    const out: string[] = [];
    const walk = (cid: string) => {
      out.push(cid);
      for (const child of snap.children.get(cid) ?? []) if (child.isActive) walk(child.id);
    };
    walk(id);
    return out;
  }

  async pathOf(id: string): Promise<{ id: string; slug: string; name: string }[]> {
    const snap = await this.load();
    const category = snap.byId.get(id);
    if (!category) return [];
    return this.ancestors(snap, category).map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
  }

  async detail(slug: string): Promise<CategoryDetailDto> {
    const category = await this.getVisibleBySlug(slug);
    const snap = await this.load();
    const children = (snap.children.get(category.id) ?? []).filter((c) => c.isActive);
    const ids = await this.descendantIds(category.id);
    const brands = await this.prisma.brand.findMany({
      where: { isActive: true, categories: { some: { id: { in: ids } } } },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true },
    });
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      icon: category.icon,
      parentId: category.parentId,
      path: await this.pathOf(category.id),
      children: children.map((c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon })),
      attributes: await this.effectiveAttributes(category.id),
      brands,
      isLeaf: children.length === 0,
    };
  }
}
