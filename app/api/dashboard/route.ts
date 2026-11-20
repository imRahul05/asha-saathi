import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getSnapshot } from '@/lib/snapshot';
import { globalEventsCursor } from '@/lib/db/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function keyOk(provided: string): boolean {
  const required = process.env.DASHBOARD_KEY;
  if (!required) return true; // no key configured: open (fine for local use, set DASHBOARD_KEY in production)
  const a = Buffer.from(provided);
  const b = Buffer.from(required);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The projector view: the ASHA's latest activity across calls. It shows real mothers' data,
// so set DASHBOARD_KEY in production and open /dashboard?key=<value>.
export async function GET(request: NextRequest) {
  if (!keyOk(request.nextUrl.searchParams.get('key') ?? request.headers.get('x-dashboard-key') ?? '')) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  try {
    const db = getDb();
    const cursor = await globalEventsCursor(db);
    const since = Number(request.nextUrl.searchParams.get('since') ?? NaN);
    if (Number.isFinite(since) && since === cursor) return NextResponse.json({ unchanged: true, cursor }, { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ ...(await getSnapshot(db, {})), cursor }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[dashboard]', e);
    return NextResponse.json({ error: 'STATE_UNAVAILABLE' }, { status: 500 });
  }
}
