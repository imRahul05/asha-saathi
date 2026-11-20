import { NextResponse } from 'next/server';
import { getDb, hasDatabase } from '@/lib/db/client';
import { createDemoAsha, NoTemplateError } from '@/lib/auth/demo';
import { newSession, sessionCookieHeader, signSession } from '@/lib/auth/session';
import { clientIp, guardDemoSignIn, hashIp } from '@/lib/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One click: creates a private demo ASHA (a copy of the template with her six mothers) and signs this browser in as her.
export async function POST(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  try {
    const db = getDb();
    const allowed = await guardDemoSignIn(db, hashIp(clientIp(request.headers)));
    if (!allowed.ok) {
      return NextResponse.json({ error: 'RATE_LIMITED', message: allowed.message }, { status: 429, headers: { 'Retry-After': String(allowed.retryAfterSeconds) } });
    }
    const asha = await createDemoAsha(db);
    const res = NextResponse.json({ ok: true, asha: { name: asha.name } });
    res.headers.append('Set-Cookie', sessionCookieHeader(signSession(newSession(asha.id, 'demo'))));
    return res;
  } catch (e) {
    if (e instanceof NoTemplateError) return NextResponse.json({ error: 'NOT_SEEDED', message: e.message }, { status: 503 });
    console.error('[auth/demo]', e);
    return NextResponse.json({ error: 'SIGN_IN_FAILED' }, { status: 500 });
  }
}
