import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireLiveSession } from '@/lib/auth/require';
import { getDb } from '@/lib/db/client';
import { startScribe } from '@/lib/db/scribe-repo';
import { publicScribe, scribeErrorResponse } from '@/lib/scribe/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  /** Made by the phone for each recording. Sending it again (a retry after a dropped connection) returns the same recording. */
  clientId: z.string().min(8).max(80),
  language: z.enum(['hi', 'en', 'kn', 'ta', 'te', 'gu', 'bn', 'mr', 'ml', 'auto']).default('hi'),
  /** The audio format the phone records, for example audio/ogg. */
  mime: z.string().regex(/^audio\/[\w.+-]+(;.*)?$/).max(80),
});

// Starts a recording. The audio pieces then go to /api/scribe/<id>/chunk and /api/scribe/<id>/process finishes it.
export async function POST(request: NextRequest) {
  const auth = await requireLiveSession(request);
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'BAD_REQUEST', message: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    const scribe = await startScribe(getDb(), { ashaId: auth.session.ashaId, ...parsed.data });
    return NextResponse.json(publicScribe(scribe), { status: 201 });
  } catch (e) {
    return scribeErrorResponse(e);
  }
}
