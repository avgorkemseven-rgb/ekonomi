import { hasRole, loginSchema } from '@kleps/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, forbidden, isSameOrigin, readLimitedJson } from '@/lib/bff';
import { apiFor, setSessionCookies } from '@/lib/session';

/** Admin login: only MODERATOR+ accounts receive a session. The API enforces roles on every call regardless. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbidden();
  const read = await readLimitedJson(req);
  if ('error' in read) return read.error;
  const parsed = loginSchema.safeParse(read.json);
  if (!parsed.success) {
    return NextResponse.json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Invalid input' }, { status: 400 });
  }
  try {
    const api = apiFor(null);
    const auth = await api.auth.login(parsed.data);
    if (!hasRole(auth.user.role, 'MODERATOR')) {
      await api.auth.logout(auth.refreshToken).catch(() => undefined);
      return NextResponse.json({ statusCode: 403, error: 'FORBIDDEN', message: 'Not an administrator' }, { status: 403 });
    }
    const res = NextResponse.json({ user: auth.user });
    setSessionCookies(res, auth);
    return res;
  } catch (err) {
    return apiErrorResponse(err);
  }
}
