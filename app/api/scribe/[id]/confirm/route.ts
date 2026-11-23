import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { getNotifier } from '@/lib/notify';
import { publicScribe, scribeErrorResponse } from '@/lib/scribe/http';
import { confirmScribe } from '@/lib/scribe/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();

// The ASHA checked the screen and confirms. The body holds the values she confirmed (she may have edited them) and the mother she picked.
// The visit is saved through the same rules as the voice call. Nothing is alerted here: the screen starts the usual countdown from the result.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const res = await confirmScribe({ db: getDb(), notifier: getNotifier() }, auth.session.ashaId, id.data, await request.json().catch(() => null));
    if (!res.ok) return NextResponse.json({ error: res.code, message: res.hint }, { status: 422 });
    return NextResponse.json({ scribe: publicScribe(res.scribe), visit: res.visit });
  } catch (e) {
    return scribeErrorResponse(e);
  }
}
