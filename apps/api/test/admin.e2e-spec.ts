import type { AuthResponse } from '@kleps/shared';
import { CategoriesService } from '../src/categories/categories.service';
import { auth, createTestApp, makeJpeg, makeRole, registerUser, resetDb, seedCatalog, type Catalog, type TestContext } from './helpers';

describe('Admin & moderation (integration)', () => {
  let ctx: TestContext;
  let cat: Catalog;
  let user: AuthResponse;
  let moderator: AuthResponse;
  let admin: AuthResponse;

  async function pendingListing(): Promise<string> {
    const draft = await ctx.http()
      .post('/v1/listings')
      .set(auth(user.accessToken))
      .send({
        categoryId: cat.dartsId,
        title: 'Replika dart seti satılık',
        description: 'Orijinal değildir, replika ürün. Temiz kullanılmış set.',
        priceAmount: 150_000,
        condition: 'GOOD',
        city: 'Ankara',
      })
      .expect(201);
    await ctx.http().post(`/v1/listings/${draft.body.id}/images`).set(auth(user.accessToken)).attach('file', await makeJpeg(), 'p.jpg').expect(201);
    const pub = await ctx.http().post(`/v1/listings/${draft.body.id}/publish`).set(auth(user.accessToken)).expect(200);
    expect(pub.body.status).toBe('PENDING_REVIEW');
    return draft.body.id as string;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cat = await seedCatalog(ctx.prisma);
    ctx.app.get(CategoriesService).invalidate();
    user = await registerUser(ctx);
    moderator = await registerUser(ctx);
    admin = await registerUser(ctx);
    await makeRole(ctx, moderator.user.id, 'MODERATOR');
    await makeRole(ctx, admin.user.id, 'ADMIN');
    await ctx.prisma.user.updateMany({ data: { createdAt: new Date(Date.now() - 7 * 86_400_000) } });
  });
  afterAll(async () => ctx.app.close());

  it('denies regular users and anonymous access', async () => {
    await ctx.http().get('/v1/admin/stats').expect(401);
    const res = await ctx.http().get('/v1/admin/stats').set(auth(user.accessToken));
    expect(res.status).toBe(403);
    await ctx.http().get('/v1/admin/stats').set(auth(moderator.accessToken)).expect(200);
  });

  it('role changes apply immediately (role is read from DB, not trusted from the token)', async () => {
    const temp = await registerUser(ctx);
    await makeRole(ctx, temp.user.id, 'MODERATOR');
    await ctx.http().get('/v1/admin/stats').set(auth(temp.accessToken)).expect(200);
    await ctx.prisma.user.update({ where: { id: temp.user.id }, data: { role: 'USER' } });
    await ctx.http().get('/v1/admin/stats').set(auth(temp.accessToken)).expect(403);
  });

  it('moderator approves a pending listing, with audit trail', async () => {
    const id = await pendingListing();
    const queue = await ctx.http().get('/v1/admin/listings?status=PENDING_REVIEW').set(auth(moderator.accessToken)).expect(200);
    const item = queue.body.items.find((i: { id: string }) => i.id === id);
    expect(item.riskReasons).toContain('counterfeit_terms');
    // Moderators (and owners) can view non-public listings.
    await ctx.http().get(`/v1/listings/${id}`).set(auth(moderator.accessToken)).expect(200);
    await ctx.http().post(`/v1/admin/listings/${id}/approve`).set(auth(moderator.accessToken)).expect(200);
    const pub = await ctx.http().get(`/v1/listings/${id}`).expect(200);
    expect(pub.body.status).toBe('ACTIVE');
    expect(pub.body.expiresAt).toBeTruthy();
    const logs = await ctx.http().get(`/v1/admin/audit-logs?entityId=${id}`).set(auth(moderator.accessToken)).expect(200);
    expect(logs.body.items[0]).toMatchObject({ action: 'listing.approve', actorId: moderator.user.id });
    await ctx.http().post(`/v1/admin/listings/${id}/approve`).set(auth(moderator.accessToken)).expect(409);
  });

  it('moderator rejects with a reason visible to the owner only; owner can fix and resubmit', async () => {
    const id = await pendingListing();
    await ctx.http().post(`/v1/admin/listings/${id}/reject`).set(auth(moderator.accessToken)).send({ reason: '' }).expect(400);
    await ctx.http().post(`/v1/admin/listings/${id}/reject`).set(auth(moderator.accessToken)).send({ reason: 'Replika ürün satışı yasaktır.' }).expect(200);
    const owner = await ctx.http().get(`/v1/listings/${id}`).set(auth(user.accessToken)).expect(200);
    expect(owner.body.status).toBe('REJECTED');
    expect(owner.body.moderationNote).toBe('Replika ürün satışı yasaktır.');
    await ctx.http().patch(`/v1/listings/${id}`).set(auth(user.accessToken)).send({ title: 'Target dart seti satılık', description: 'Orijinal Target dart seti, temiz kullanılmış ve bakımlı.' }).expect(200);
    const again = await ctx.http().post(`/v1/listings/${id}/publish`).set(auth(user.accessToken)).expect(200);
    expect(again.body.status).toBe('ACTIVE');
  });

  it('moderator removes an active listing', async () => {
    const active = await ctx.prisma.listing.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    await ctx.http().post(`/v1/admin/listings/${active.id}/remove`).set(auth(moderator.accessToken)).send({ reason: 'Kural ihlali' }).expect(200);
    await ctx.http().get(`/v1/listings/${active.id}`).expect(404);
  });

  it('only admins manage categories and attributes; changes appear in the public tree', async () => {
    const body = { name: 'Bowling', icon: 'bowling' };
    await ctx.http().post('/v1/admin/categories').set(auth(moderator.accessToken)).send(body).expect(403);
    const created = await ctx.http().post('/v1/admin/categories').set(auth(admin.accessToken)).send(body).expect(201);
    expect(created.body.slug).toBe('bowling');
    const child = await ctx.http().post('/v1/admin/categories').set(auth(admin.accessToken)).send({ name: 'Bowling Topları', parentId: created.body.id }).expect(201);
    const attr = await ctx.http()
      .post(`/v1/admin/categories/${child.body.id}/attributes`)
      .set(auth(admin.accessToken))
      .send({ key: 'weightLbs', label: 'Ağırlık', type: 'NUMBER', unit: 'lb', filterable: true })
      .expect(201);
    await ctx.http().post(`/v1/admin/categories/${child.body.id}/attributes`).set(auth(admin.accessToken)).send({ key: 'core', label: 'Çekirdek', type: 'SELECT', options: [] }).expect(400);
    const tree = await ctx.http().get('/v1/categories').expect(200);
    expect(tree.body.map((c: { slug: string }) => c.slug)).toContain('bowling');
    const detail = await ctx.http().get('/v1/categories/bowling-toplari').expect(200);
    expect(detail.body.attributes[0].key).toBe('weightLbs');
    // Cycle prevention.
    await ctx.http().patch(`/v1/admin/categories/${created.body.id}`).set(auth(admin.accessToken)).send({ parentId: child.body.id }).expect(400);
    // Deactivate hides it.
    await ctx.http().patch(`/v1/admin/categories/${created.body.id}`).set(auth(admin.accessToken)).send({ isActive: false }).expect(200);
    const tree2 = await ctx.http().get('/v1/categories').expect(200);
    expect(tree2.body.map((c: { slug: string }) => c.slug)).not.toContain('bowling');
    await ctx.http().delete(`/v1/admin/attributes/${attr.body.id}`).set(auth(admin.accessToken)).expect(204);
    const logs = await ctx.http().get('/v1/admin/audit-logs').set(auth(admin.accessToken)).expect(200);
    expect(logs.body.items.map((l: { action: string }) => l.action)).toEqual(expect.arrayContaining(['category.create', 'attribute.create', 'attribute.delete']));
  });

  it('admin suspends a user: sessions revoked and listings hidden', async () => {
    const victim = await registerUser(ctx);
    await ctx.prisma.user.update({ where: { id: victim.user.id }, data: { createdAt: new Date(Date.now() - 7 * 86_400_000) } });
    const draft = await ctx.http()
      .post('/v1/listings')
      .set(auth(victim.accessToken))
      .send({ categoryId: cat.dartsId, title: 'Dart seti temiz', description: 'Temiz kullanılmış dart seti, yedek parçalarıyla.', priceAmount: 100_000, condition: 'GOOD', city: 'Bursa' })
      .expect(201);
    await ctx.http().post(`/v1/listings/${draft.body.id}/images`).set(auth(victim.accessToken)).attach('file', await makeJpeg(), 'p.jpg').expect(201);
    await ctx.http().post(`/v1/listings/${draft.body.id}/publish`).set(auth(victim.accessToken)).expect(200);
    await ctx.http().get(`/v1/listings/${draft.body.id}`).expect(200);

    await ctx.http().post(`/v1/admin/users/${victim.user.id}/status`).set(auth(moderator.accessToken)).send({ status: 'SUSPENDED' }).expect(403);
    await ctx.http().post(`/v1/admin/users/${victim.user.id}/status`).set(auth(admin.accessToken)).send({ status: 'SUSPENDED', reason: 'dolandırıcılık şüphesi' }).expect(200);
    await ctx.http().post('/v1/auth/refresh').send({ refreshToken: victim.refreshToken }).expect(401);
    await ctx.http().get(`/v1/listings/${draft.body.id}`).expect(404);
    const search = await ctx.http().get('/v1/listings').query({ q: 'dart seti temiz' }).expect(200);
    expect(search.body.items.map((i: { id: string }) => i.id)).not.toContain(draft.body.id);
    await ctx.http().post(`/v1/admin/users/${admin.user.id}/status`).set(auth(admin.accessToken)).send({ status: 'SUSPENDED' }).expect(403);
  });

  it('reports stats', async () => {
    const res = await ctx.http().get('/v1/admin/stats').set(auth(moderator.accessToken)).expect(200);
    expect(res.body.users).toBeGreaterThanOrEqual(4);
    expect(res.body.listingsByStatus).toHaveProperty('ACTIVE');
  });
});
