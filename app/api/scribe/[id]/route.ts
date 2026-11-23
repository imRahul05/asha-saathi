import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { discardScribe, getScribe } from '@/lib/db/scribe-repo';
import { publicScribe, scribeErrorResponse } from '@/lib/scribe/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

// Where a recording is now: the status, and once it is ready the transcript, the checked visit details and the mothers it may be.
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const scribe = await getScribe(getDb(), auth.session.ashaId, id.data);
    return scribe ? NextResponse.json(publicScribe(scribe)) : NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  } catch (e) {
    return scribeErrorResponse(e);
  }
}

// The ASHA throws the recording away. The audio and the transcript are deleted. A visit that was already saved stays.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const done = await discardScribe(getDb(), auth.session.ashaId, id.data);
    return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  } catch (e) {
    return scribeErrorResponse(e);
  }
}
