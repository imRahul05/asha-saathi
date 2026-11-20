import { cookies } from 'next/headers';
import { getDb, hasDatabase } from '@/lib/db/client';
import { SESSION_COOKIE, verifySession, type Session } from './session';

/**
 * Does the ASHA behind a (validly signed) session still exist? A signed cookie outlives its account when the demo data is
 * cleaned up, and such a cookie must not count as "signed in". If the database cannot be reached we say yes, so a hiccup never logs anyone out.
 */
export async function ashaExists(ashaId: string): Promise<boolean> {
  if (!hasDatabase()) return true;
  try {
    const rows = await getDb().query<{ ok: number }>('select 1 as ok from ashas where id = $1', [ashaId]);
    return rows.length > 0;
  } catch {
    return true;
  }
}

/** For server components and pages: the signed-in session, or null. */
export async function getServerSession(): Promise<Session | null> {
  try {
    return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}
