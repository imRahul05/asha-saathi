import { createHmac, timingSafeEqual } from 'node:crypto';

// A signed session cookie: base64url(payload).HMAC. No session table, nothing to look up on every request.
// The payload only says WHICH ASHA this browser acts as; the server decides what that ASHA may touch.
export const SESSION_COOKIE = 'asha_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type Session = { ashaId: string; mode: 'demo' | 'user'; exp: number };

let warnedDevSecret = false;
function secret(): string {
  const k = process.env.SESSION_SECRET || process.env.MCP_SHARED_SECRET; // empty strings count as unset
  if (k) return k;
  // Local development only: never fall back to a known secret in production.
  if (process.env.NODE_ENV !== 'production') {
    if (!warnedDevSecret) {
      warnedDevSecret = true;
      console.warn('[auth] SESSION_SECRET is not set: using an insecure development secret. Run `pnpm setup:local` to generate real ones.');
    }
    return 'dev-only-insecure-session-secret';
  }
  throw new Error('SESSION_SECRET (or MCP_SHARED_SECRET) must be set to sign sessions');
}

const mac = (body: string) => createHmac('sha256', secret()).update(`session.${body}`).digest('base64url');

/** HMAC for other signed values (call links). `scope` keeps a signature for one purpose from being valid for another. */
export function hmacScoped(scope: string, body: string): string {
  return createHmac('sha256', secret()).update(`${scope}.${body}`).digest('base64url');
}

export function signSession(s: Session): string {
  const body = Buffer.from(JSON.stringify(s)).toString('base64url');
  return `${body}.${mac(body)}`;
}

export function verifySession(value: string | undefined | null, nowMs: number = Date.now()): Session | null {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<Session>;
    if (typeof s.ashaId !== 'string' || (s.mode !== 'demo' && s.mode !== 'user') || typeof s.exp !== 'number') return null;
    if (s.exp * 1000 < nowMs) return null;
    return { ashaId: s.ashaId, mode: s.mode, exp: s.exp };
  } catch {
    return null;
  }
}

export function newSession(ashaId: string, mode: Session['mode'], nowMs: number = Date.now()): Session {
  return { ashaId, mode, exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS };
}

export function cookieFromHeader(header: string | null | undefined, name: string = SESSION_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function sessionFromRequest(req: Request): Session | null {
  return verifySession(cookieFromHeader(req.headers.get('cookie')));
}

/** Set-Cookie header value. Secure on https (production), plain on local http. */
export function sessionCookieHeader(value: string, opts: { clear?: boolean } = {}): string {
  const parts = [`${SESSION_COOKIE}=${opts.clear ? '' : encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${opts.clear ? 0 : SESSION_TTL_SECONDS}`];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}
