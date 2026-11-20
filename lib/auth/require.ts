import { NextResponse } from 'next/server';
import { sessionFromRequest, type Session } from './session';

/** Use at the top of an API route: `const auth = requireSession(req); if (!auth.ok) return auth.response;` */
export function requireSession(req: Request): { ok: true; session: Session } | { ok: false; response: NextResponse } {
  let session: Session | null = null;
  try {
    session = sessionFromRequest(req);
  } catch (e) {
    console.error('[auth]', e);
    return { ok: false, response: NextResponse.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 500 }) };
  }
  if (!session) return { ok: false, response: NextResponse.json({ error: 'SIGN_IN_REQUIRED' }, { status: 401 }) };
  return { ok: true, session };
}
