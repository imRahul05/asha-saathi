import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getAshaOverview } from '@/lib/overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = requireRole(request, 'asha');
  if (!auth.ok) return auth.response;
  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  try {
    const overview = await getAshaOverview(getDb(), auth.session.ashaId);
    if (!overview) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
    return NextResponse.json(overview, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[asha/overview]', e);
    return NextResponse.json({ error: 'STATE_UNAVAILABLE' }, { status: 500 });
  }
}
