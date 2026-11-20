import { NextRequest, NextResponse } from 'next/server';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getSnapshot } from '@/lib/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Live state of ONE call: its latest visit, risk, alert, follow-up and tool timeline.
// The channel name is random per call, so it acts as the key to that call's data.
export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get('channel') ?? '';
  const asha = request.nextUrl.searchParams.get('asha');
  if (!/^[\w.-]{6,120}$/.test(channel)) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  }
  try {
    const snapshot = await getSnapshot(getDb(), { sessionId: channel, ashaId: asha && /^[0-9a-f-]{36}$/i.test(asha) ? asha : null });
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[session/state]', e);
    return NextResponse.json({ error: 'STATE_UNAVAILABLE' }, { status: 500 });
  }
}
