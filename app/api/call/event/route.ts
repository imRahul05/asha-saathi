import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, hasDatabase } from '@/lib/db/client';
import { getVisit, logEvent } from '@/lib/db/repo';
import { verifyCallLink } from '@/lib/call/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ t: z.string().min(10).max(2000), type: z.enum(['joined', 'left']) });
const DEDUPE_SECONDS = 10;

// The call page reports "joined" / "left" so the visit's timeline shows that a doctor call happened.
// The signed link is the only credential. Same role+event for the same visit inside 10 seconds is ignored (retries, double beacons).
export async function POST(request: NextRequest) {
  // sendBeacon posts text/plain, so parse the raw text rather than relying on the content type.
  const raw = await request.text().catch(() => '');
  let json: unknown = null;
  try { json = JSON.parse(raw); } catch { /* invalid */ }
  const parsed = Body.safeParse(json);
  const link = parsed.success ? verifyCallLink(parsed.data.t) : null;
  if (!parsed.success || !link) return NextResponse.json({ error: 'LINK_INVALID' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });

  try {
    const db = getDb();
    const visit = await getVisit(db, link.ashaId, link.visitId);
    if (!visit) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const dup = await db.query(
      `select 1 from events
       where asha_id = $1 and name = 'doctorCall' and input->>'visitId' = $2 and input->>'role' = $3 and input->>'event' = $4
         and created_at > now() - ($5 || ' seconds')::interval limit 1`,
      [link.ashaId, link.visitId, link.role, parsed.data.type, String(DEDUPE_SECONDS)],
    );
    if (dup.length) return NextResponse.json({ ok: true, duplicate: true }, { headers: { 'Cache-Control': 'no-store' } });
    await logEvent(db, {
      sessionId: visit.sessionId, ashaId: link.ashaId, type: 'call', name: 'doctorCall',
      input: { role: link.role, event: parsed.data.type, visitId: link.visitId }, ok: true,
    });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[call/event]', e);
    return NextResponse.json({ error: 'CALL_UNAVAILABLE' }, { status: 500 });
  }
}
