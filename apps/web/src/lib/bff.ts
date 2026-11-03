import 'server-only';
import { ApiError, checkDeclaredLength, readBodyWithLimit } from '@kleps/api-client';
import type { AuthResponse } from '@kleps/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { API_INTERNAL_URL } from './env';
import { ACCESS_COOKIE, REFRESH_COOKIE, apiFor, clearSessionCookies, setSessionCookies } from './session';

/** Largest body the proxy will buffer (15 MB photo limit + multipart overhead). */
export const MAX_PROXY_BODY_BYTES = 16 * 1024 * 1024;
/** Largest JSON body accepted by the auth route handlers (login/register payloads are tiny). */
export const MAX_AUTH_BODY_BYTES = 16 * 1024;

const tooLarge = () =>
  NextResponse.json({ statusCode: 413, error: 'FILE_TOO_LARGE', message: 'Request too large' }, { status: 413 });
const badLength = () =>
  NextResponse.json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Invalid Content-Length' }, { status: 400 });

/**
 * Reads the request body with a hard byte limit (rejects early on a too-large Content-Length, and stops reading
 * mid-stream when the actual bytes exceed the limit, so chunked or mislabelled bodies are bounded too).
 */
export async function readLimitedBody(req: NextRequest, limit: number): Promise<{ body: Uint8Array } | { error: NextResponse }> {
  const declared = checkDeclaredLength(req.headers.get('content-length'), limit);
  if (declared === 'invalid') return { error: badLength() };
  if (declared === 'too_large') return { error: tooLarge() };
  const result = await readBodyWithLimit(req.body, limit);
  return result.ok ? { body: result.body } : { error: tooLarge() };
}

/** Parses a small JSON body with the auth limit; returns null for malformed JSON. */
export async function readLimitedJson(req: NextRequest): Promise<{ json: unknown } | { error: NextResponse }> {
  const read = await readLimitedBody(req, MAX_AUTH_BODY_BYTES);
  if ('error' in read) return read;
  try {
    return { json: JSON.parse(new TextDecoder().decode(read.body)) };
  } catch {
    return { json: null };
  }
}

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
  // Buffer the body (bounded) so the request can be replayed after a token refresh.
  let body: Uint8Array | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const read = await readLimitedBody(req, MAX_PROXY_BODY_BYTES);
    if ('error' in read) return read.error;
    body = read.body;
  }
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
      body: body as BodyInit | undefined,
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
