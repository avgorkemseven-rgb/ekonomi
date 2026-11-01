import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@kleps.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-admin-password';

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'admin panel is covered on desktop');

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.body && !(init.body instanceof FormData) && { 'Content-Type': 'application/json' }), ...(init.token && { Authorization: `Bearer ${init.token}` }) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

test('non-moderators cannot sign in to the admin panel', async ({ page }) => {
  const run = Date.now().toString(36);
  await api('/v1/auth/register', { method: 'POST', body: JSON.stringify({ email: `u${run}@e2e.kleps.local`, username: `u${run}`, password: 'Sifre12345', displayName: 'Normal Kullanıcı' }) });
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel('E-posta').fill(`u${run}@e2e.kleps.local`);
  await page.getByLabel('Şifre').fill('Sifre12345');
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByText('Bu panel yalnızca yetkili kullanıcılar içindir.')).toBeVisible();
  await page.goto(`${ADMIN_URL}/moderasyon`);
  await expect(page).toHaveURL(/\/login$/);
});

test('moderator approves a listing held for review; it becomes public', async ({ page }) => {
  // A seller publishes a listing that the risk rules hold for review (contact info in description).
  const run = Date.now().toString(36);
  const auth = await api<{ accessToken: string }>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `s${run}@e2e.kleps.local`, username: `s${run}`, password: 'Sifre12345', displayName: 'Riskli Satıcı' }),
  });
  const categories = await api<{ slug: string; children: { id: string; slug: string }[] }[]>('/v1/categories');
  const darts = categories.find((c) => c.slug === 'dart')!.children.find((c) => c.slug === 'dart-oklari')!;
  const title = `Dart seti inceleme ${run}`;
  const listing = await api<{ id: string }>('/v1/listings', {
    method: 'POST',
    token: auth.accessToken,
    body: JSON.stringify({
      categoryId: darts.id,
      title,
      description: 'Temiz set. Detaylar için 0532 111 22 33 numarasından WhatsApp ile yazın.',
      priceAmount: 250_000,
      condition: 'GOOD',
      city: 'Ankara',
      attributes: { tipType: 'Çelik uç (steel)', weight: 22 },
    }),
  });
  const form = new FormData();
  const jpeg = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#2563EB' } }).jpeg().toBuffer();
  form.append('file', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'p.jpg');
  await api(`/v1/listings/${listing.id}/images`, { method: 'POST', token: auth.accessToken, body: form });
  const published = await api<{ status: string }>(`/v1/listings/${listing.id}/publish`, { method: 'POST', token: auth.accessToken });
  expect(published.status).toBe('PENDING_REVIEW');
  expect((await fetch(`${API}/v1/listings/${listing.id}`)).status).toBe(404);

  // Moderator reviews it in the admin panel.
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel('E-posta').fill(ADMIN_EMAIL);
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible();
  await page.getByRole('link', { name: 'Moderasyon' }).click();
  const item = page.locator('li').filter({ hasText: title });
  await expect(item.getByText('İletişim bilgisi')).toBeVisible();
  await item.getByRole('button', { name: 'Onayla' }).click();
  await expect(page.locator('li').filter({ hasText: title })).toHaveCount(0);

  const res = await fetch(`${API}/v1/listings/${listing.id}`);
  expect(res.status).toBe(200);
  expect(((await res.json()) as { status: string }).status).toBe('ACTIVE');

  await page.getByRole('link', { name: 'İşlem kayıtları' }).click();
  await expect(page.getByText(`Listing:${listing.id}`).first()).toBeVisible();
});
