import { hasRole, type MeDto } from "@kleps/shared";
import { type NextRequest, NextResponse } from 'next/server';
import { tryRefresh } from '@/lib/bff';
import { ACCESS_COOKIE, apiFor, clearSessionCookies, setSessionCookies } from '@/lib/session';

/** Returns the current user (refreshing the session if needed) or `{ user: null }`. */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  let user: MeDto | null = null;
  if (token) user = await apiFor(token).auth.me().catch(() => null);
  if (user && hasRole(user.role, "MODERATOR")) return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });

  const refreshed = await tryRefresh(req);
  const refreshedUser = refreshed && hasRole(refreshed.user.role, "MODERATOR") ? refreshed.user : null;
  const res = NextResponse.json({ user: refreshedUser }, { headers: { 'Cache-Control': 'no-store' } });
  if (refreshed && refreshedUser) setSessionCookies(res, refreshed);
  else if (token) clearSessionCookies(res);
  return res;
}
