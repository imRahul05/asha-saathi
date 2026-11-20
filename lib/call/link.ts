import { timingSafeEqual } from 'node:crypto';
import { hmacScoped } from '@/lib/auth/session';

// A call link is a signed, expiring value that says: this person may join the call about THIS visit, as THIS role.
// No account, no table. The page that opens it asks the server for an RTC token, so the link itself is never an Agora token.
export type CallRole = 'doctor' | 'asha';
export type CallLink = { visitId: string; ashaId: string; role: CallRole; exp: number };

export const CALL_LINK_TTL_SECONDS = 6 * 60 * 60;
const SCOPE = 'call-link';

export function signCallLink(l: CallLink): string {
  const body = Buffer.from(JSON.stringify(l)).toString('base64url');
  return `${body}.${hmacScoped(SCOPE, body)}`;
}

export function verifyCallLink(value: string | null | undefined, nowMs: number = Date.now()): CallLink | null {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(hmacScoped(SCOPE, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const l = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<CallLink>;
    if (typeof l.visitId !== 'string' || typeof l.ashaId !== 'string' || typeof l.exp !== 'number') return null;
    if (l.role !== 'doctor' && l.role !== 'asha') return null;
    if (l.exp * 1000 < nowMs) return null;
    return { visitId: l.visitId, ashaId: l.ashaId, role: l.role, exp: l.exp };
  } catch {
    return null;
  }
}

export function callUrl(baseUrl: string, visit: { id: string; ashaId: string }, role: CallRole, nowMs: number = Date.now()): string {
  const t = signCallLink({ visitId: visit.id, ashaId: visit.ashaId, role, exp: Math.floor(nowMs / 1000) + CALL_LINK_TTL_SECONDS });
  return `${baseUrl.replace(/\/$/, '')}/call/${t}`;
}

/** One channel per visit, and fixed UIDs per role, so the two sides never collide and a re-join replaces the old connection. */
export const callChannel = (visitId: string) => `call-${visitId}`;
export const CALL_UID: Record<CallRole, number> = { doctor: 7001, asha: 7002 };
