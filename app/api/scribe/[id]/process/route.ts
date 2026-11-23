import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { chunkIndexes, getScribe } from '@/lib/db/scribe-repo';
import { clientIp, guardScribe, hashIp } from '@/lib/guard';
import { createExtractor } from '@/lib/scribe/extract';
import { publicScribe, scribeErrorResponse, MAX_PIECES } from '@/lib/scribe/http';
import { missingChunks, processScribe } from '@/lib/scribe/pipeline';
import { ScribeError } from '@/lib/scribe/types';
import { createMurfStt } from '@/lib/scribe/stt-murf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // transcription of a long visit can take a few minutes

const Id = z.string().uuid();
const Body = z.object({ chunkCount: z.number().int().min(1).max(MAX_PIECES) });

// All pieces are uploaded: turn the recording into text and checked visit details. Safe to call again. A ready recording is returned
// as it is, one that is still processing is left alone, and a failed one is tried again.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await params).id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!id.success) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (!body.success) return NextResponse.json({ error: 'BAD_REQUEST', message: 'chunkCount is required' }, { status: 400 });
  try {
    const db = getDb();
    const existing = await getScribe(db, auth.session.ashaId, id.data);
    if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    // Only a run that will really call the speech service and the model counts against the limits.
    if (existing.status === 'recording' || existing.status === 'failed') {
      const missing = missingChunks(await chunkIndexes(db, id.data), body.data.chunkCount);
      if (missing.length) throw new ScribeError('MISSING_CHUNKS', `Pieces still missing: ${missing.slice(0, 20).join(', ')}`);
      const allowed = await guardScribe(db, { ashaId: auth.session.ashaId, ipHash: hashIp(clientIp(request.headers)) });
      if (!allowed.ok) {
        return NextResponse.json({ error: 'RATE_LIMITED', message: allowed.message, retryable: true }, { status: 429, headers: { 'retry-after': String(allowed.retryAfterSeconds) } });
      }
    }
    const scribe = await processScribe({ db, stt: createMurfStt(), extractor: createExtractor() }, auth.session.ashaId, id.data, body.data.chunkCount);
    return NextResponse.json(publicScribe(scribe));
  } catch (e) {
    return scribeErrorResponse(e);
  }
}
