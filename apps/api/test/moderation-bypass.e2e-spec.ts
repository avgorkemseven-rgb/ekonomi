import type { AuthResponse, ListingDetailDto } from '@kleps/shared';
import { CategoriesService } from '../src/categories/categories.service';
import { auth, createTestApp, makeJpeg, makeRole, registerUser, resetDb, seedCatalog, type Catalog, type TestContext } from './helpers';

/**
 * Regression tests: a seller must not be able to get harmless content approved and then swap in content that
 * would have been held for review — via text fields, category, price, photos, or the expired → edit → renew path.
 * Harmless edits must not trigger moderation.
 */
describe('Moderation of changes to published listings (integration)', () => {
  let ctx: TestContext;
  let cat: Catalog;
  let seller: AuthResponse;
  let moderator: AuthResponse;

  const base = () => ({
    categoryId: cat.dartsId,
    brandId: cat.targetId,
    title: 'Target dart seti 23 gram',
    description: 'Temiz kullanılmış set, yedek uçları ve kutusu ile birlikte.',
    priceAmount: 250_000,
    condition: 'GOOD',
    city: 'İzmir',
  });

  async function published(photos = 1): Promise<ListingDetailDto> {
    const draft = await ctx.http().post('/v1/listings').set(auth(seller.accessToken)).send(base()).expect(201);
    for (let i = 0; i < photos; i++) {
      await ctx.http().post(`/v1/listings/${draft.body.id}/images`).set(auth(seller.accessToken)).attach('file', await makeJpeg(), `${i}.jpg`).expect(201);
    }
    const pub = await ctx.http().post(`/v1/listings/${draft.body.id}/publish`).set(auth(seller.accessToken)).expect(200);
    expect(pub.body.status).toBe('ACTIVE');
    return pub.body as ListingDetailDto;
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    ctx.http().patch(`/v1/listings/${id}`).set(auth(seller.accessToken)).send(body).expect(200);
  const upload = async (id: string, expected = 201) =>
    ctx.http().post(`/v1/listings/${id}/images`).set(auth(seller.accessToken)).attach('file', await makeJpeg(), 'n.jpg').expect(expected);
  const status = async (id: string) => (await ctx.prisma.listing.findUniqueOrThrow({ where: { id } })).status;
  const reasons = async (id: string) => (await ctx.prisma.listing.findUniqueOrThrow({ where: { id } })).riskReasons;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cat = await seedCatalog(ctx.prisma);
    ctx.app.get(CategoriesService).invalidate();
    seller = await registerUser(ctx);
    moderator = await registerUser(ctx);
    await makeRole(ctx, moderator.user.id, 'MODERATOR');
    await ctx.prisma.user.updateMany({ data: { createdAt: new Date(Date.now() - 30 * 86_400_000), activeListingLimit: 100 } });
  });
  afterAll(async () => ctx.app.close());

  describe('text and catalog changes', () => {
    it('re-assesses risky title/description edits', async () => {
      const l = await published();
      const res = await patch(l.id, { description: 'Kapora ile ayırırım, WhatsApp 0532 123 45 67 numarasından yazın.' });
      expect(res.body.status).toBe('PENDING_REVIEW');
      await ctx.http().get(`/v1/listings/${l.id}`).expect(404);
    });

    it('re-assesses the free-text district field', async () => {
      const l = await published();
      const res = await patch(l.id, { district: 'WhatsApp 0532 123 45 67' });
      expect(res.body.status).toBe('PENDING_REVIEW');
      expect(await reasons(l.id)).toContain('contact_info');
    });

    it('re-assesses free-text attribute values', async () => {
      const l = await published();
      const res = await patch(l.id, { attributes: { barrelModel: 'IBAN TR12 0006 1005 1978 6457 8413 26' } });
      expect(res.body.status).toBe('PENDING_REVIEW');
      expect(await reasons(l.id)).toContain('payment_info');
    });

    it('re-assesses price changes with the same threshold as publishing', async () => {
      const l = await published();
      // A suspicious price alone (score 30) is below the review threshold at publish time too, so it is recorded
      // for moderators but does not hide the listing; combined with another signal it does.
      await patch(l.id, { priceAmount: 500 });
      expect(await reasons(l.id)).toContain('suspicious_price');
      expect(await status(l.id)).toBe('ACTIVE');
      const res = await patch(l.id, { priceAmount: 400, title: 'Replika dart seti ucuz' });
      expect(res.body.status).toBe('PENDING_REVIEW');
    });

    it('sends a category change on a live listing to review', async () => {
      const l = await published();
      const res = await patch(l.id, {
        categoryId: cat.cuesId,
        brandId: cat.predatorId,
        attributes: { cueType: 'Oyun istakası' },
      });
      expect(res.body.status).toBe('PENDING_REVIEW');
      expect(await reasons(l.id)).toContain('category_changed');
    });

    it('does not moderate harmless edits', async () => {
      const l = await published();
      await patch(l.id, { condition: 'FAIR', allowsShipping: true, city: 'Ankara' });
      await patch(l.id, { priceAmount: 230_000 });
      await patch(l.id, { title: 'Target dart seti 23 gram, az kullanılmış' });
      await patch(l.id, { attributes: { barrelModel: 'Power 9Five Gen 7' } });
      expect(await status(l.id)).toBe('ACTIVE');
    });
  });

  describe('photo changes', () => {
    it('allows adding a minority of extra photos', async () => {
      const l = await published(2);
      await upload(l.id);
      expect(await status(l.id)).toBe('ACTIVE');
    });

    it('replacing the approved photos sends the listing to review', async () => {
      const l = await published(1);
      await upload(l.id);
      await ctx.http().delete(`/v1/listings/${l.id}/images/${l.images[0]!.id}`).set(auth(seller.accessToken)).expect(204);
      expect(await status(l.id)).toBe('PENDING_REVIEW');
      expect(await reasons(l.id)).toContain('media_changed');
      await ctx.http().get(`/v1/listings/${l.id}`).expect(404);
    });

    it('uploading mostly new photos sends the listing to review', async () => {
      const l = await published(1);
      await upload(l.id); // 1 of 2 new → still fine
      expect(await status(l.id)).toBe('ACTIVE');
      await upload(l.id); // 2 of 3 new → majority unreviewed
      expect(await status(l.id)).toBe('PENDING_REVIEW');
    });

    it('making an unreviewed photo the cover sends the listing to review', async () => {
      const l = await published(2);
      const added = await upload(l.id);
      expect(await status(l.id)).toBe('ACTIVE');
      await ctx.http()
        .put(`/v1/listings/${l.id}/images/order`)
        .set(auth(seller.accessToken))
        .send({ imageIds: [added.body.id, l.images[0]!.id, l.images[1]!.id] })
        .expect(200);
      expect(await status(l.id)).toBe('PENDING_REVIEW');
    });

    it('reordering approved photos is harmless', async () => {
      const l = await published(2);
      await ctx.http()
        .put(`/v1/listings/${l.id}/images/order`)
        .set(auth(seller.accessToken))
        .send({ imageIds: [l.images[1]!.id, l.images[0]!.id] })
        .expect(200);
      expect(await status(l.id)).toBe('ACTIVE');
    });

    it('moderator approval makes the new photos the reviewed baseline', async () => {
      const l = await published(1);
      await upload(l.id);
      await ctx.http().delete(`/v1/listings/${l.id}/images/${l.images[0]!.id}`).set(auth(seller.accessToken)).expect(204);
      expect(await status(l.id)).toBe('PENDING_REVIEW');
      await ctx.http().post(`/v1/admin/listings/${l.id}/approve`).set(auth(moderator.accessToken)).expect(200);
      await ctx.http().put(`/v1/listings/${l.id}/images/order`).set(auth(seller.accessToken)).send({
        imageIds: (await ctx.prisma.listingImage.findMany({ where: { listingId: l.id } })).map((i) => i.id),
      }).expect(200);
      expect(await status(l.id)).toBe('ACTIVE');
    });
  });

  describe('expired listings', () => {
    it('renewing after a risky edit goes to review instead of straight back online', async () => {
      const l = await published();
      await ctx.prisma.listing.update({ where: { id: l.id }, data: { expiresAt: new Date(Date.now() - 1000), status: 'EXPIRED' } });
      await patch(l.id, { description: 'Kapora gönderin, WhatsApp üzerinden 0532 123 45 67 ile iletişime geçin.' });
      const renewed = await ctx.http().post(`/v1/listings/${l.id}/renew`).set(auth(seller.accessToken)).expect(200);
      expect(renewed.body.status).toBe('PENDING_REVIEW');
    });

    it('renewing an unchanged expired listing reactivates it', async () => {
      const l = await published();
      await ctx.prisma.listing.update({ where: { id: l.id }, data: { expiresAt: new Date(Date.now() - 1000), status: 'EXPIRED' } });
      const renewed = await ctx.http().post(`/v1/listings/${l.id}/renew`).set(auth(seller.accessToken)).expect(200);
      expect(renewed.body.status).toBe('ACTIVE');
    });
  });
});
