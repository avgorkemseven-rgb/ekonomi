import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

async function photo(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 30, g: 35, b: 41 } } })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Milestone 1: a user creates a real listing (with photo) on the web; another, anonymous user finds it via
 * search, views its detail and the seller profile. The same record is then fetched from the shared API
 * exactly as the mobile app does.
 */
test('seller lists an item with a photo; another visitor finds and views it', async ({ browser }, testInfo) => {
  const run = `${testInfo.project.name === 'mobile-chromium' ? 'm' : 'd'}${Date.now().toString(36)}`;
  const username = `e2e${run}`.slice(0, 30);
  const title = `Predator REVO istaka ${run}`;

  // ── Seller: register
  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await seller.goto('/kayit');
  await seller.getByLabel('Ad soyad / Mağaza adı').fill('E2E Satıcı');
  await seller.getByLabel('Kullanıcı adı').fill(username);
  await seller.getByLabel('E-posta').fill(`${username}@e2e.kleps.local`);
  await seller.getByLabel('Şifre').fill('E2eSifre123');
  await seller.getByRole('button', { name: 'Kayıt ol' }).click();
  await expect(seller).toHaveURL(/\/$/);

  // ── Seller: create listing (category → details)
  await seller.goto('/ilan-ver');
  await seller.getByRole('button', { name: /Bilardo/ }).click();
  await seller.getByRole('button', { name: /Istakalar/ }).click();
  await seller.getByLabel('İlan başlığı').fill(title);
  await seller.getByLabel(/^Marka/).selectOption({ label: 'Predator' });
  await seller.getByLabel(/^Model/).selectOption({ label: 'REVO 12.4' });
  await seller.getByLabel('Durum').selectOption({ label: 'Sıfır ayarında' });
  await seller.getByLabel('Fiyat (TL)').fill('42.500');
  await seller.getByLabel('Şehir').selectOption('İstanbul');
  await seller.getByLabel('Istaka tipi').selectOption('Oyun istakası');
  await seller.getByLabel(/^Uç çapı/).fill('12,4');
  await seller.getByLabel('Açıklama').fill('E2E testi: az kullanılmış, düz ve çiziksiz karbon şaftlı istaka. Kutusu mevcut.');
  await seller.getByRole('button', { name: 'Fotoğraflara geç' }).click();
  await expect(seller).toHaveURL(/\/ilan-duzenle\//);
  await expect(seller.getByTestId('listing-status')).toHaveText('Taslak');

  // ── Seller: upload a photo and publish
  await seller.getByTestId('photo-input').setInputFiles({ name: 'istaka.jpg', mimeType: 'image/jpeg', buffer: await photo() });
  await expect(seller.getByTestId('photo-list').locator('li')).toHaveCount(1);
  await seller.getByTestId('publish-button').click();
  await expect(seller.getByTestId('listing-status')).toHaveText('Yayında');
  const listingId = seller.url().split('/ilan-duzenle/')[1]!;
  await sellerCtx.close();

  // ── Buyer (separate, anonymous browser context): search → detail → seller profile
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await buyer.goto(`/ara?q=${encodeURIComponent(`ıstaka ${run}`)}`);
  const card = buyer.getByTestId('listing-card').filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(buyer).toHaveURL(new RegExp(`/ilan/${listingId}$`));
  const detail = buyer.getByTestId('listing-detail');
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(buyer.getByTestId('listing-price')).toContainText('42.500');
  await expect(detail.getByRole('img', { name: new RegExp(title) })).toBeVisible();
  await expect(detail.getByText('12.4 mm')).toBeVisible();
  await buyer.getByTestId('seller-link').click();
  await expect(buyer.getByTestId('seller-name')).toHaveText('E2E Satıcı');
  await expect(buyer.getByTestId('listing-card').filter({ hasText: title })).toHaveCount(1);
  await buyerCtx.close();

  // ── Mobile path: the Expo app reads the same public endpoint without a session.
  const res = await fetch(`${API}/v1/listings/${listingId}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { title: string; status: string; images: { url: string }[]; seller: { username: string } };
  expect(body).toMatchObject({ title, status: 'ACTIVE', seller: { username } });
  expect(body.images).toHaveLength(1);
  const img = await fetch(body.images[0]!.url);
  expect(img.headers.get('content-type')).toContain('image/webp');
});

test('protected pages redirect anonymous users to login', async ({ page }) => {
  await page.goto('/hesabim/ilanlar');
  await expect(page).toHaveURL(/\/giris\?next=%2Fhesabim%2Filanlar/);
});

test('login shows a localized error for wrong credentials', async ({ page }) => {
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill('nobody@e2e.kleps.local');
  await page.getByLabel('Şifre').fill('WrongPass123');
  await page.getByRole('button', { name: 'Giriş yap' }).last().click();
  await expect(page.getByText('E-posta veya şifre hatalı.')).toBeVisible();
});

test('category page applies dynamic attribute filters', async ({ page }) => {
  await page.goto('/kategori/dart-oklari');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dart Okları');
  await expect(page.getByLabel('Uç tipi')).toBeVisible();
  await page.getByLabel('Ağırlık en az').fill('100');
  await page.getByRole('button', { name: 'Filtrele' }).click();
  await expect(page).toHaveURL(/attr_weight_min=100/);
  await expect(page.getByText('Aramanızla eşleşen ilan bulunamadı.')).toBeVisible();
});
