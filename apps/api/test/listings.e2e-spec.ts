import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { AuthResponse, ListingDetailDto } from '@kleps/shared';
import { CategoriesService } from '../src/categories/categories.service';
import { auth, createTestApp, makeJpeg, registerUser, resetDb, seedCatalog, type Catalog, type TestContext } from './helpers';

describe('Listings, media and search (integration)', () => {
  let ctx: TestContext;
  let cat: Catalog;
  let seller: AuthResponse;
  let buyer: AuthResponse;

  const draftBody = () => ({
    categoryId: cat.cuesId,
    brandId: cat.predatorId,
    modelId: cat.revoId,
    title: 'Predator REVO 12.4 Istaka',
    description: 'Az kullanılmış karbon şaftlı istaka, kutusu ve faturası mevcut.',
    priceAmount: 4_250_000,
    condition: 'LIKE_NEW',
    city: 'İstanbul',
    district: 'Kadıköy',
    attributes: { gameType: 'Amerikan (Pool)', cueType: 'Oyun istakası', tipSize: '12,4' },
    allowsShipping: true,
  });

  async function createPublished(token: string, overrides: Record<string, unknown> = {}): Promise<ListingDetailDto> {
    const draft = await ctx.http().post('/v1/listings').set(auth(token)).send({ ...draftBody(), ...overrides }).expect(201);
    await ctx.http().post(`/v1/listings/${draft.body.id}/images`).set(auth(token)).attach('file', await makeJpeg(), 'p.jpg').expect(201);
    const pub = await ctx.http().post(`/v1/listings/${draft.body.id}/publish`).set(auth(token)).expect(200);
    return pub.body as ListingDetailDto;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cat = await seedCatalog(ctx.prisma);
    ctx.app.get(CategoriesService).invalidate();
    seller = await registerUser(ctx, { username: 'satici' });
    buyer = await registerUser(ctx, { username: 'alici' });
    // Accounts older than 24h, so the new-account velocity rule does not interfere.
    await ctx.prisma.user.updateMany({ data: { createdAt: new Date(Date.now() - 7 * 86_400_000) } });
  });
  afterAll(async () => ctx.app.close());

  describe('vertical slice: draft → photo → publish → public view → search', () => {
    let listingId: string;

    it('creates a draft (auth required, validated)', async () => {
      await ctx.http().post('/v1/listings').send(draftBody()).expect(401);
      const bad = await ctx.http().post('/v1/listings').set(auth(seller.accessToken)).send({ ...draftBody(), title: 'abc', priceAmount: -5 });
      expect(bad.status).toBe(400);
      const badAttr = await ctx.http().post('/v1/listings').set(auth(seller.accessToken)).send({ ...draftBody(), attributes: { cueType: 'Uçan istaka' } });
      expect(badAttr.body.error).toBe('INVALID_ATTRIBUTES');
      const nonLeaf = await ctx.http().post('/v1/listings').set(auth(seller.accessToken)).send({ ...draftBody(), categoryId: cat.bilardoId });
      expect(nonLeaf.status).toBe(400);
      const wrongBrand = await ctx.http().post('/v1/listings').set(auth(seller.accessToken)).send({ ...draftBody(), brandId: cat.targetId, modelId: null });
      expect(wrongBrand.status).toBe(400);

      const res = await ctx.http().post('/v1/listings').set(auth(seller.accessToken)).send(draftBody()).expect(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.attributes).toEqual({ gameType: 'Amerikan (Pool)', cueType: 'Oyun istakası', tipSize: 12.4 });
      expect(res.body.isOwner).toBe(true);
      listingId = res.body.id;
      const row = await ctx.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
      expect(row.searchText).toContain('predator revo 12.4 istaka');
    });

    it('keeps drafts private', async () => {
      await ctx.http().get(`/v1/listings/${listingId}`).expect(404);
      await ctx.http().get(`/v1/listings/${listingId}`).set(auth(buyer.accessToken)).expect(404);
      await ctx.http().get(`/v1/listings/${listingId}`).set(auth(seller.accessToken)).expect(200);
    });

    it('refuses to publish without a photo', async () => {
      const res = await ctx.http().post(`/v1/listings/${listingId}/publish`).set(auth(seller.accessToken));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('LISTING_NOT_PUBLISHABLE');
      expect(res.body.issues.map((i: { path: string[] }) => i.path[0])).toContain('images');
    });

    it('validates uploads by content, not by name or declared type', async () => {
      const spoof = await ctx.http()
        .post(`/v1/listings/${listingId}/images`)
        .set(auth(seller.accessToken))
        .attach('file', Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(200, ' ')), { filename: 'evil.jpg', contentType: 'image/jpeg' });
      expect(spoof.status).toBe(415);
      expect(spoof.body.error).toBe('UNSUPPORTED_MEDIA_TYPE');
      const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 1)]);
      const bad = await ctx.http().post(`/v1/listings/${listingId}/images`).set(auth(seller.accessToken)).attach('file', corrupt, 'c.jpg');
      expect(bad.status).toBe(415);
      const other = await ctx.http().post(`/v1/listings/${listingId}/images`).set(auth(buyer.accessToken)).attach('file', await makeJpeg(), 'x.jpg');
      expect(other.status).toBe(403);
    });

    it('uploads a photo: re-encoded to WebP, resized, metadata stripped', async () => {
      const res = await ctx.http()
        .post(`/v1/listings/${listingId}/images`)
        .set(auth(seller.accessToken))
        .attach('file', await makeJpeg(2400, 1800), 'photo.jpg')
        .expect(201);
      expect(res.body.url).toMatch(/^http:\/\/localhost:4000\/media\/listings\/.+\.webp$/);
      expect(res.body.width).toBe(1600);
      expect(res.body.height).toBe(1200);
      const image = await ctx.prisma.listingImage.findUniqueOrThrow({ where: { id: res.body.id } });
      const stored = await readFile(join(process.env.LOCAL_STORAGE_DIR!, image.storageKey));
      const meta = await sharp(stored).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      // Served by the dev media route.
      const served = await ctx.http().get(`/media/${image.storageKey}`).expect(200);
      expect(served.headers['x-content-type-options']).toBe('nosniff');
    });

    it('publishes → ACTIVE with 60-day expiry', async () => {
      const res = await ctx.http().post(`/v1/listings/${listingId}/publish`).set(auth(seller.accessToken)).expect(200);
      expect(res.body.status).toBe('ACTIVE');
      const days = (new Date(res.body.expiresAt).getTime() - new Date(res.body.publishedAt).getTime()) / 86_400_000;
      expect(Math.round(days)).toBe(60);
      await ctx.http().post(`/v1/listings/${listingId}/publish`).set(auth(seller.accessToken)).expect(409);
    });

    it('is visible to anonymous users (web and mobile clients share this endpoint)', async () => {
      const res = await ctx.http().get(`/v1/listings/${listingId}`).expect(200);
      const body = res.body as ListingDetailDto;
      expect(body.title).toBe('Predator REVO 12.4 Istaka');
      expect(body.images).toHaveLength(1);
      expect(body.seller.username).toBe('satici');
      expect(body.seller).not.toHaveProperty('email');
      expect(body.isOwner).toBe(false);
      expect(body).not.toHaveProperty('moderationNote');
      expect(body.categoryPath.map((c) => c.slug)).toEqual(['bilardo', 'bilardo-istakalari']);
      expect(body.attributeDefinitions.find((d) => d.key === 'tipSize')?.unit).toBe('mm');
    });

    it('prevents other users from modifying it', async () => {
      await ctx.http().patch(`/v1/listings/${listingId}`).set(auth(buyer.accessToken)).send({ title: 'Hacked title!!' }).expect(403);
      await ctx.http().post(`/v1/listings/${listingId}/close`).set(auth(buyer.accessToken)).send({ reason: 'SOLD' }).expect(403);
      await ctx.http().delete(`/v1/listings/${listingId}`).set(auth(buyer.accessToken)).expect(403);
    });

    it('is found by Turkish-insensitive keyword search', async () => {
      for (const q of ['ıstaka', 'ISTAKA', 'İstaka predator', 'revo 12.4']) {
        const res = await ctx.http().get('/v1/listings').query({ q }).expect(200);
        expect(res.body.items.map((i: { id: string }) => i.id)).toContain(listingId);
      }
      // LIKE wildcards are matched literally.
      expect((await ctx.http().get('/v1/listings').query({ q: '%%' }).expect(200)).body.total).toBe(0);
      const none = await ctx.http().get('/v1/listings').query({ q: 'dart tahtası' }).expect(200);
      expect(none.body.total).toBe(0);
    });

    it('supports category (incl. descendants), brand, price, city, condition and attribute filters', async () => {
      const q = (params: Record<string, string | number>) => ctx.http().get('/v1/listings').query(params).expect(200);
      expect((await q({ category: 'bilardo' })).body.total).toBe(1);
      expect((await q({ category: 'dart' })).body.total).toBe(0);
      expect((await q({ brand: 'predator' })).body.total).toBe(1);
      expect((await q({ minPrice: 40000, maxPrice: 45000 })).body.total).toBe(1);
      expect((await q({ maxPrice: 1000 })).body.total).toBe(0);
      expect((await q({ city: 'İstanbul', condition: 'LIKE_NEW' })).body.total).toBe(1);
      expect((await q({ city: 'Ankara' })).body.total).toBe(0);
      expect((await q({ category: 'bilardo-istakalari', attr_tipSize_min: 12, attr_tipSize_max: 13 })).body.total).toBe(1);
      expect((await q({ category: 'bilardo-istakalari', attr_tipSize_min: 13 })).body.total).toBe(0);
      expect((await q({ category: 'bilardo-istakalari', attr_cueType: 'Kırma istakası' })).body.total).toBe(0);
      expect((await q({ seller: 'satici' })).body.total).toBe(1);
      const page = await q({ page: 1, pageSize: 1 });
      expect(page.body).toMatchObject({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
      await ctx.http().get('/v1/listings').query({ pageSize: 500 }).expect(400);
      await ctx.http().get('/v1/listings').query({ city: 'Narnia' }).expect(400);
    });

    it('serves the seller profile and their listings', async () => {
      const profile = await ctx.http().get('/v1/users/satici').expect(200);
      expect(profile.body.activeListingCount).toBe(1);
      const listings = await ctx.http().get('/v1/users/satici/listings').expect(200);
      expect(listings.body.items[0].id).toBe(listingId);
      expect(listings.body.items[0].coverImage.thumbUrl).toMatch(/_thumb\.webp$/);
      await ctx.http().get('/v1/users/nobody-here').expect(404);
    });

    it('lists my listings with status filter', async () => {
      const res = await ctx.http().get('/v1/me/listings?status=ACTIVE').set(auth(seller.accessToken)).expect(200);
      expect(res.body.total).toBe(1);
      const buyerList = await ctx.http().get('/v1/me/listings').set(auth(buyer.accessToken)).expect(200);
      expect(buyerList.body.total).toBe(0);
    });

    it('keeps a live listing complete when editing', async () => {
      await ctx.http().patch(`/v1/listings/${listingId}`).set(auth(seller.accessToken)).send({ description: 'kısa' }).expect(400);
      const ok = await ctx.http().patch(`/v1/listings/${listingId}`).set(auth(seller.accessToken)).send({ priceAmount: 4_000_000 }).expect(200);
      expect(ok.body.status).toBe('ACTIVE');
      const img = await ctx.prisma.listingImage.findFirstOrThrow({ where: { listingId } });
      await ctx.http().delete(`/v1/listings/${listingId}/images/${img.id}`).set(auth(seller.accessToken)).expect(409);
    });

    it('renews only when expired or close to expiry, then closes as sold', async () => {
      await ctx.http().post(`/v1/listings/${listingId}/renew`).set(auth(seller.accessToken)).expect(409);
      await ctx.prisma.listing.update({ where: { id: listingId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      // Expired listings disappear from public views immediately.
      await ctx.http().get(`/v1/listings/${listingId}`).expect(404);
      const mine = await ctx.http().get(`/v1/listings/${listingId}`).set(auth(seller.accessToken)).expect(200);
      expect(mine.body.status).toBe('EXPIRED');
      expect(mine.body.canRenew).toBe(true);
      const renewed = await ctx.http().post(`/v1/listings/${listingId}/renew`).set(auth(seller.accessToken)).expect(200);
      expect(renewed.body.status).toBe('ACTIVE');
      await ctx.http().get(`/v1/listings/${listingId}`).expect(200);
      const sold = await ctx.http().post(`/v1/listings/${listingId}/close`).set(auth(seller.accessToken)).send({ reason: 'SOLD' }).expect(200);
      expect(sold.body.status).toBe('SOLD');
      await ctx.http().get(`/v1/listings/${listingId}`).expect(404);
      await ctx.http().patch(`/v1/listings/${listingId}`).set(auth(seller.accessToken)).send({ title: 'Yeni başlık burada' }).expect(409);
    });
  });

  it('enforces the photo limit and supports reordering/deleting', async () => {
    const draft = await ctx.http().post('/v1/listings').set(auth(seller.accessToken)).send(draftBody()).expect(201);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await ctx.http().post(`/v1/listings/${draft.body.id}/images`).set(auth(seller.accessToken)).attach('file', await makeJpeg(), `${i}.jpg`).expect(201);
      ids.push(r.body.id);
    }
    const over = await ctx.http().post(`/v1/listings/${draft.body.id}/images`).set(auth(seller.accessToken)).attach('file', await makeJpeg(), 'x.jpg');
    expect(over.status).toBe(409);
    expect(over.body.error).toBe('PHOTO_LIMIT_REACHED');
    const reordered = await ctx.http()
      .put(`/v1/listings/${draft.body.id}/images/order`)
      .set(auth(seller.accessToken))
      .send({ imageIds: [ids[2], ids[0], ids[1]] })
      .expect(200);
    expect(reordered.body.map((i: { id: string }) => i.id)).toEqual([ids[2], ids[0], ids[1]]);
    await ctx.http().put(`/v1/listings/${draft.body.id}/images/order`).set(auth(seller.accessToken)).send({ imageIds: [ids[0]] }).expect(400);
    await ctx.http().delete(`/v1/listings/${draft.body.id}/images/${ids[2]}`).set(auth(seller.accessToken)).expect(204);
    const detail = await ctx.http().get(`/v1/listings/${draft.body.id}`).set(auth(seller.accessToken)).expect(200);
    expect(detail.body.images.map((i: { id: string; position: number }) => [i.id, i.position])).toEqual([
      [ids[0], 0],
      [ids[1], 1],
    ]);
    // Only drafts can be deleted, and images go with them.
    await ctx.http().delete(`/v1/listings/${draft.body.id}`).set(auth(seller.accessToken)).expect(204);
    expect(await ctx.prisma.listingImage.count({ where: { listingId: draft.body.id } })).toBe(0);
  });

  it('enforces the active listing limit', async () => {
    const limited = await registerUser(ctx);
    await ctx.prisma.user.update({ where: { id: limited.user.id }, data: { activeListingLimit: 1, createdAt: new Date(Date.now() - 7 * 86_400_000) } });
    await createPublished(limited.accessToken);
    const draft = await ctx.http().post('/v1/listings').set(auth(limited.accessToken)).send(draftBody()).expect(201);
    await ctx.http().post(`/v1/listings/${draft.body.id}/images`).set(auth(limited.accessToken)).attach('file', await makeJpeg(), 'p.jpg').expect(201);
    const res = await ctx.http().post(`/v1/listings/${draft.body.id}/publish`).set(auth(limited.accessToken));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('LISTING_LIMIT_REACHED');
  });

  it('routes risky listings to moderation instead of publishing', async () => {
    const risky = await createPublished(seller.accessToken, {
      description: 'Kapora gönderirseniz ayırırım, WhatsApp: 0532 123 45 67 numarasından yazın.',
    });
    expect(risky.status).toBe('PENDING_REVIEW');
    await ctx.http().get(`/v1/listings/${risky.id}`).expect(404);
    const row = await ctx.prisma.listing.findUniqueOrThrow({ where: { id: risky.id } });
    expect(row.riskReasons).toEqual(expect.arrayContaining(['contact_info', 'off_platform_payment']));
  });

  it('expiry sweep marks overdue listings as EXPIRED', async () => {
    const l = await createPublished(seller.accessToken);
    await ctx.prisma.listing.update({ where: { id: l.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const { ListingsService } = await import('../src/listings/listings.service');
    const count = await ctx.app.get(ListingsService).expireDue();
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await ctx.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('EXPIRED');
  });

  it('returns 404 for unknown listings and uniform error bodies', async () => {
    const res = await ctx.http().get('/v1/listings/doesnotexist').expect(404);
    expect(res.body).toEqual({ statusCode: 404, error: 'NOT_FOUND', message: 'Listing not found' });
    const malformed = await ctx.http().post('/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(malformed.status).toBe(400);
  });
});
