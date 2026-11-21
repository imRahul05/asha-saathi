import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { getVisit } from '@/lib/db/repo';
import { getNotifier } from '@/lib/notify';
import { executeTool, type ToolContext } from '@/lib/tools';
import { holdAlert } from '@/lib/tools/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ visitId: z.string().uuid() });

// The ASHA taps Cancel during the countdown. Same tool as the voice "stop", so both are logged the same way and the screen reads one flag.
export async function POST(request: NextRequest) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  const db = getDb();
  const visit = await getVisit(db, auth.session.ashaId, parsed.data.visitId);
  if (!visit) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const ctx: ToolContext = { db, ashaId: auth.session.ashaId, sessionId: visit.sessionId, turnId: randomUUID(), notifier: getNotifier(), now: () => new Date() };
  const res = await executeTool(holdAlert, {}, ctx);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.code }, { status: 200 });
  return NextResponse.json({ ok: true, held: res.data.held, alert: res.data.alert });
}
