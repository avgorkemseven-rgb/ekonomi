import 'server-only';
import { createApiClient, type ApiClient } from '@kleps/api-client';
import type { AuthResponse } from '@kleps/shared';
import { cookies } from 'next/headers';
import { connection, type NextResponse } from 'next/server';
import { API_INTERNAL_URL, IS_PRODUCTION } from './env';

export const ACCESS_COOKIE = 'kleps_at';
export const REFRESH_COOKIE = 'kleps_rt';

const base = { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax' as const, path: '/' };

/** Stores tokens in httpOnly cookies; browser JavaScript never sees them (ADR-004). */
export function setSessionCookies(res: NextResponse, auth: AuthResponse): void {
  res.cookies.set(ACCESS_COOKIE, auth.accessToken, { ...base, expires: new Date(auth.accessTokenExpiresAt) });
  res.cookies.set(REFRESH_COOKIE, auth.refreshToken, { ...base, expires: new Date(auth.refreshTokenExpiresAt) });
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, '', { ...base, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...base, maxAge: 0 });
}

export function apiFor(accessToken?: string | null): ApiClient {
  return createApiClient({
    baseUrl: API_INTERNAL_URL,
    getAccessToken: () => accessToken ?? null,
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  });
}

/** API client for server components: uses the access token cookie when present (read-only; cannot refresh). */
export async function serverApi(): Promise<ApiClient> {
  await connection();
  const jar = await cookies();
  return apiFor(jar.get(ACCESS_COOKIE)?.value);
}

/** Anonymous API client for public server-rendered data. */
export async function publicApi(): Promise<ApiClient> {
  await connection();
  return apiFor(null);
}
