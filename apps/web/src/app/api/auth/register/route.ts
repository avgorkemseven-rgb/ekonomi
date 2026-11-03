import { registerSchema } from '@kleps/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, forbidden, isSameOrigin, readLimitedJson } from '@/lib/bff';
import { apiFor, setSessionCookies } from '@/lib/session';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbidden();
  const read = await readLimitedJson(req);
  if ('error' in read) return read.error;
  const parsed = registerSchema.safeParse(read.json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.map(String), message: i.message }));
    return NextResponse.json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Invalid input', issues }, { status: 400 });
  }
  try {
    const auth = await apiFor(null).auth.register(parsed.data);
    const res = NextResponse.json({ user: auth.user }, { status: 201 });
    setSessionCookies(res, auth);
    return res;
  } catch (err) {
    return apiErrorResponse(err);
  }
}
