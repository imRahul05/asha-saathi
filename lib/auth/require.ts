import { NextResponse } from 'next/server';
import { getDb, hasDatabase } from '@/lib/db/client';
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

/**
 * Like requireSession, and also checks that the account still exists. Use it where a call starts: a deleted or expired demo account
 * then gets a clear SESSION_EXPIRED answer straight away, not a failure further into the call.
 */
export async function requireLiveSession(req: Request): Promise<{ ok: true; session: Session } | { ok: false; response: NextResponse }> {
  const auth = requireSession(req);
  if (!auth.ok) return auth;
  if (!hasDatabase()) return auth;
  try {
    const rows = await getDb().query<{ ok: number }>('select 1 as ok from ashas where id = $1', [auth.session.ashaId]);
    if (rows.length === 0) return { ok: false, response: NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 }) };
  } catch (e) {
    console.error('[auth] could not check the account', e); // a database hiccup must not look like a sign-out
  }
  return auth;
}
