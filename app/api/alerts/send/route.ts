import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { getVisit } from '@/lib/db/repo';
import { getNotifier } from '@/lib/notify';
import { executeTool, type ToolContext } from '@/lib/tools';
import { draftAlert, sendAlert } from '@/lib/tools/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ visitId: z.string().uuid() });

// The ASHA taps "Send now" (or "Try again") on the screen. Her tap is the confirmation, so this drafts the alert if needed and sends it.
// It goes through the same tools as the voice agent, so the rules stay identical: sent at most once, logged as events, only her own visits.
export async function POST(request: NextRequest) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });

  const db = getDb();
  const visit = await getVisit(db, auth.session.ashaId, parsed.data.visitId);
  if (!visit) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const ctx: ToolContext = { db, ashaId: auth.session.ashaId, sessionId: visit.sessionId, turnId: randomUUID(), notifier: getNotifier(), now: () => new Date() };

  const drafted = await executeTool(draftAlert, { visitId: visit.id }, ctx);
  if (!drafted.ok) return NextResponse.json({ ok: false, error: drafted.code, message: drafted.hint ?? drafted.code }, { status: 200 });
  if (drafted.data.alreadySent) return NextResponse.json({ ok: true, status: 'sent', alreadySent: true });

  const sent = await executeTool(sendAlert, { token: drafted.data.token }, ctx);
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.code, message: sent.hint ?? sent.code }, { status: 200 });
  return NextResponse.json({ ok: true, status: 'sent', provider: sent.data.provider ?? null });
}
