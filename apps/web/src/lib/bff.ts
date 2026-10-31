import 'server-only';
import { ApiError } from '@kleps/api-client';
import type { AuthResponse } from '@kleps/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { API_INTERNAL_URL } from './env';
import { ACCESS_COOKIE, REFRESH_COOKIE, apiFor, clearSessionCookies, setSessionCookies } from './session';

/** CSRF defence for cookie-authenticated mutations: the request must come from our own origin. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = req.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}

export function forbidden(): NextResponse {
  return NextResponse.json({ statusCode: 403, error: 'FORBIDDEN', message: 'Cross-site request blocked' }, { status: 403 });
}

export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const status = err.status || 502;
    return NextResponse.json({ statusCode: status, error: err.code, message: err.message, issues: err.issues }, { status });
  }
  return NextResponse.json({ statusCode: 502, error: 'INTERNAL_ERROR', message: 'Upstream error' }, { status: 502 });
}

/** Tries to rotate the refresh token. Returns new tokens or null. */
export async function tryRefresh(req: NextRequest): Promise<AuthResponse | null> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  try {
    return await apiFor(null).auth.refresh(refreshToken);
  } catch {
    return null;
  }
}

/** Forwards a request to the API with the session's bearer token; refreshes once on 401. */
export async function forward(req: NextRequest, path: string): Promise<NextResponse> {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !isSameOrigin(req)) return forbidden();
  if (!/^v1\/[A-Za-z0-9/_.-]+$/.test(path) || path.includes('..')) {
    return NextResponse.json({ statusCode: 404, error: 'NOT_FOUND', message: 'Not found' }, { status: 404 });
  }
  // Buffer the body so the request can be replayed after a token refresh (photos are ≤ 15 MB).
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  const contentType = req.headers.get('content-type');
  const url = `${API_INTERNAL_URL}/${path}${req.nextUrl.search}`;

  const send = (token: string | undefined) =>
    fetch(url, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        ...(contentType && { 'Content-Type': contentType }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body,
      cache: 'no-store',
    });

  let refreshed: AuthResponse | null = null;
  let upstream = await send(req.cookies.get(ACCESS_COOKIE)?.value);
  if (upstream.status === 401) {
    refreshed = await tryRefresh(req);
    if (refreshed) upstream = await send(refreshed.accessToken);
  }

  const res = new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
  });
  if (refreshed) setSessionCookies(res, refreshed);
  else if (upstream.status === 401 && req.cookies.get(REFRESH_COOKIE)) clearSessionCookies(res);
  return res;
}
