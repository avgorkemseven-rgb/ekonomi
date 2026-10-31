import { expect, test } from '@playwright/test';

/**
 * Renders the Expo app's screens through react-native-web (`pnpm --filter @kleps/mobile export:web` served on
 * E2E_MOBILE_WEB_URL) and checks it shows real API data. This verifies the mobile JS/UI code paths against the
 * shared backend; it is NOT a native iOS/Android build.
 */
const MOBILE_WEB = process.env.E2E_MOBILE_WEB_URL;
const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

test.skip(!MOBILE_WEB, 'set E2E_MOBILE_WEB_URL to run the mobile (react-native-web) checks');
test.skip(({ isMobile }) => !isMobile, 'runs in the mobile viewport project');

test('mobile app shows the latest listing and its detail from the shared API', async ({ page }) => {
  const latest = (await (await fetch(`${API}/v1/listings?pageSize=1`)).json()) as { items: { id: string; title: string }[] };
  const listing = latest.items[0];
  test.skip(!listing, 'no active listings to display');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(MOBILE_WEB!);
  await expect(page.getByText('Son eklenen ilanlar')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(listing!.title).first()).toBeVisible();

  await page.goto(`${MOBILE_WEB}/listing/${listing!.id}`);
  await expect(page.getByText(listing!.title).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Açıklama')).toBeVisible();
  expect(errors).toEqual([]);
});
