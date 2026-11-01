import { createTestApp, resetDb, seedCatalog, type Catalog, type TestContext } from './helpers';
import { CategoriesService } from '../src/categories/categories.service';

describe('Categories & catalog (integration)', () => {
  let ctx: TestContext;
  let cat: Catalog;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cat = await seedCatalog(ctx.prisma);
    ctx.app.get(CategoriesService).invalidate();
  });
  afterAll(async () => ctx.app.close());

  it('returns the category tree', async () => {
    const res = await ctx.http().get('/v1/categories').expect(200);
    expect(res.body.map((c: { slug: string }) => c.slug)).toEqual(['bilardo', 'dart']);
    expect(res.body[0].children[0].slug).toBe('bilardo-istakalari');
  });

  it('returns category detail with inherited attributes and brands', async () => {
    const res = await ctx.http().get('/v1/categories/bilardo-istakalari').expect(200);
    expect(res.body.attributes.map((a: { key: string }) => a.key)).toEqual(['gameType', 'cueType', 'tipSize']);
    expect(res.body.path.map((p: { slug: string }) => p.slug)).toEqual(['bilardo', 'bilardo-istakalari']);
    expect(res.body.brands.map((b: { name: string }) => b.name)).toEqual(['Predator']);
    expect(res.body.isLeaf).toBe(true);
    const root = await ctx.http().get('/v1/categories/bilardo').expect(200);
    expect(root.body.isLeaf).toBe(false);
    expect(root.body.brands.map((b: { name: string }) => b.name)).toEqual(['Predator']);
  });

  it('lists brands per category and models per brand', async () => {
    const brands = await ctx.http().get('/v1/brands?category=dart').expect(200);
    expect(brands.body.map((b: { slug: string }) => b.slug)).toEqual(['target']);
    const models = await ctx.http().get(`/v1/brands/${cat.predatorId}/models`).expect(200);
    expect(models.body[0].name).toBe('REVO 12.4');
    await ctx.http().get('/v1/brands/doesnotexist/models').expect(404);
  });

  it('hides inactive categories and their subtree', async () => {
    await ctx.prisma.category.update({ where: { id: cat.bilardoId }, data: { isActive: false } });
    ctx.app.get(CategoriesService).invalidate();
    const tree = await ctx.http().get('/v1/categories').expect(200);
    expect(tree.body.map((c: { slug: string }) => c.slug)).toEqual(['dart']);
    await ctx.http().get('/v1/categories/bilardo-istakalari').expect(404);
    await ctx.prisma.category.update({ where: { id: cat.bilardoId }, data: { isActive: true } });
    ctx.app.get(CategoriesService).invalidate();
  });
});
