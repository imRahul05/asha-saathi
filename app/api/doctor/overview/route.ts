import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sessionFromRequest, sessionRole, type Session } from '@/lib/auth/session';
import { getDb, hasDatabase } from '@/lib/db/client';
import { eventsCursor, globalEventsCursor } from '@/lib/db/repo';
import { getDoctorOverview } from '@/lib/overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function matchesDashboardKey(provided: string, required: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(required);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  let session: Session | null = null;
  try {
    session = sessionFromRequest(request);
  } catch (e) {
    console.error('[doctor/overview]', e);
    return NextResponse.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 500 });
  }

  const requiredKey = process.env.DASHBOARD_KEY;
  const providedKey = request.nextUrl.searchParams.get('key') ?? request.headers.get('x-dashboard-key') ?? '';
  const hasValidKey = Boolean(requiredKey && matchesDashboardKey(providedKey, requiredKey));

  let scopedAshaId: string | null = null;
  if (session && sessionRole(session) === 'doctor') {
    scopedAshaId = session.ashaId;
  } else if (hasValidKey) {
    scopedAshaId = null;
  } else if (!requiredKey && (!session || sessionRole(session) !== 'asha')) {
    scopedAshaId = null;
  } else if (session && sessionRole(session) === 'asha') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  } else {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });

  try {
    const db = getDb();
    const cursor = scopedAshaId ? await eventsCursor(db, { ashaId: scopedAshaId }) : await globalEventsCursor(db);
    const since = Number(request.nextUrl.searchParams.get('since') ?? NaN);
    if (Number.isFinite(since) && since === cursor) {
      return NextResponse.json({ unchanged: true, cursor }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const overview = await getDoctorOverview(db, scopedAshaId);
    return NextResponse.json({ ...overview, cursor }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[doctor/overview]', e);
    return NextResponse.json({ error: 'STATE_UNAVAILABLE' }, { status: 500 });
  }
}
