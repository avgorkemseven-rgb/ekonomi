import { loginSchema } from '@kleps/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, forbidden, isSameOrigin } from '@/lib/bff';
import { apiFor, setSessionCookies } from '@/lib/session';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbidden();
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Invalid input' }, { status: 400 });
  }
  try {
    const auth = await apiFor(null).auth.login(parsed.data);
    const res = NextResponse.json({ user: auth.user });
    setSessionCookies(res, auth);
    return res;
  } catch (err) {
    return apiErrorResponse(err);
  }
}
