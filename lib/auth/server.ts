import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession, type Session } from './session';

/** For server components and pages: the signed-in session, or null. */
export async function getServerSession(): Promise<Session | null> {
  try {
    return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}
