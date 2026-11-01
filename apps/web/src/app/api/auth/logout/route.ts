import { type NextRequest, NextResponse } from 'next/server';
import { forbidden, isSameOrigin } from '@/lib/bff';
import { REFRESH_COOKIE, apiFor, clearSessionCookies } from '@/lib/session';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbidden();
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) await apiFor(null).auth.logout(refreshToken).catch(() => undefined);
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookies(res);
  return res;
}
