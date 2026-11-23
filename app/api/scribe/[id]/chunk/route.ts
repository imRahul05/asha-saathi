import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { chunkBytes, getScribe, putChunk } from '@/lib/db/scribe-repo';
import { MAX_PIECE_BYTES, MAX_PIECES, MAX_STORED_BYTES, scribeErrorResponse } from '@/lib/scribe/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const Index = z.coerce.number().int().min(0).max(MAX_PIECES - 1);

// One piece of the recording, as raw bytes in the request body. Sending the same index again replaces it, so retries are safe.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await params).id);
  const rawIndex = request.nextUrl.searchParams.get('index');
  const index = rawIndex === null || rawIndex.trim() === '' ? { success: false as const } : Index.safeParse(rawIndex); // a missing number must not count as piece 0
  if (!id.success) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (!index.success) return NextResponse.json({ error: 'BAD_REQUEST', message: `index must be 0 to ${MAX_PIECES - 1}` }, { status: 400 });
  try {
    const db = getDb();
    const scribe = await getScribe(db, auth.session.ashaId, id.data);
    if (!scribe) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (scribe.status !== 'recording' && scribe.status !== 'failed') {
      return NextResponse.json({ error: 'BAD_STATE', message: `This recording is ${scribe.status}` }, { status: 409 });
    }
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_PIECE_BYTES) return NextResponse.json({ error: 'TOO_LARGE', message: 'Send smaller pieces' }, { status: 413 });
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length === 0) return NextResponse.json({ error: 'BAD_REQUEST', message: 'The piece is empty' }, { status: 400 });
    if (bytes.length > MAX_PIECE_BYTES) return NextResponse.json({ error: 'TOO_LARGE', message: 'Send smaller pieces' }, { status: 413 });
    if ((await chunkBytes(db, id.data)) + bytes.length * (4 / 3) > MAX_STORED_BYTES) {
      return NextResponse.json({ error: 'TOO_LARGE', message: 'This recording is too long' }, { status: 413 });
    }
    await putChunk(db, id.data, index.data, bytes.toString('base64'));
    return NextResponse.json({ ok: true, index: index.data, bytes: bytes.length });
  } catch (e) {
    return scribeErrorResponse(e);
  }
}
