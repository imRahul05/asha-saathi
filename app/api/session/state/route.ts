import { NextRequest, NextResponse } from 'next/server';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getSnapshot } from '@/lib/snapshot';
import { eventsCursor } from '@/lib/db/repo';
import { requireSession } from '@/lib/auth/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Live state of ONE call: its latest visit, risk, alert, follow-up and tool timeline.
// Requires sign-in, and only returns data belonging to the signed-in ASHA.
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const channel = request.nextUrl.searchParams.get('channel') ?? '';
  if (!/^[\w.-]{6,120}$/.test(channel)) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  }
  try {
    // Cheap path: if the browser already has everything up to `since`, answer with a tiny "unchanged" instead of rebuilding the snapshot.
    const since = Number(request.nextUrl.searchParams.get('since') ?? NaN);
    if (Number.isFinite(since) && since >= 0) {
      const cursor = await eventsCursor(getDb(), { sessionId: channel, ashaId: auth.session.ashaId });
      if (cursor === since) return NextResponse.json({ unchanged: true, cursor }, { headers: { 'Cache-Control': 'no-store' } });
    }
    // Scoped to the signed-in ASHA: a call's data is never readable by another account.
    const snapshot = await getSnapshot(getDb(), { sessionId: channel, ashaId: auth.session.ashaId });
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[session/state]', e);
    return NextResponse.json({ error: 'STATE_UNAVAILABLE' }, { status: 500 });
  }
}
