import { NextResponse } from 'next/server';
import { getDb, hasDatabase } from '@/lib/db/client';
import { firstAsha, getAsha, mostRecentlyActiveAshaId } from '@/lib/db/repo';
import { createDemoAsha, NoTemplateError } from '@/lib/auth/demo';
import { newSession, sessionCookieHeader, signSession, type UserRole } from '@/lib/auth/session';
import { clientIp, guardDemoSignIn, hashIp } from '@/lib/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DemoSignInBody {
  role?: string;
}

async function parseRequestedRole(request: Request): Promise<UserRole> {
  try {
    const text = await request.text();
    if (!text.trim()) return 'asha';
    const parsed = JSON.parse(text) as DemoSignInBody | null;
    return parsed?.role === 'doctor' ? 'doctor' : 'asha';
  } catch {
    return 'asha';
  }
}

// One click: creates a private demo ASHA (a copy of the template with her six mothers) and signs this browser in as her,
// or signs in as the PHC doctor viewing the most recently active (or template) ASHA.
export async function POST(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  try {
    const db = getDb();
    const allowed = await guardDemoSignIn(db, hashIp(clientIp(request.headers)));
    if (!allowed.ok) {
      return NextResponse.json({ error: 'RATE_LIMITED', message: allowed.message }, { status: 429, headers: { 'Retry-After': String(allowed.retryAfterSeconds) } });
    }
    const role = await parseRequestedRole(request);
    if (role === 'doctor') {
      const activeId = await mostRecentlyActiveAshaId(db);
      const target = (activeId ? await getAsha(db, activeId) : null) ?? (await firstAsha(db));
      if (!target) throw new NoTemplateError();
      const res = NextResponse.json({
        ok: true,
        role: 'doctor',
        doctor: { name: target.doctorName ?? 'Dr. Rao', phcName: target.phcName },
      });
      res.headers.append('Set-Cookie', sessionCookieHeader(signSession(newSession(target.id, 'demo', Date.now(), 'doctor'))));
      return res;
    }
    const asha = await createDemoAsha(db);
    const res = NextResponse.json({ ok: true, role: 'asha', asha: { name: asha.name } });
    res.headers.append('Set-Cookie', sessionCookieHeader(signSession(newSession(asha.id, 'demo', Date.now(), 'asha'))));
    return res;
  } catch (e) {
    if (e instanceof NoTemplateError) return NextResponse.json({ error: 'NOT_SEEDED', message: e.message }, { status: 503 });
    console.error('[auth/demo]', e);
    const message = e instanceof Error ? e.message : 'unknown error';
    // Configuration problems are safe to show (they name a variable, never a value) and save a trip to the server log.
    const config = /must be set|DATABASE_URL|relation .* does not exist|column .* does not exist/i.test(message);
    return NextResponse.json({ error: config ? 'SETUP_PROBLEM' : 'SIGN_IN_FAILED', message: config ? message : undefined }, { status: 500 });
  }
}
