import { NextResponse } from 'next/server';
import type { Scribe } from '@/lib/db/scribe-repo';
import { ScribeError } from './types';

/** Limits that keep one recording from growing without bound. */
export const MAX_PIECE_BYTES = 4_000_000; // below the 4.5 MB request limit on the host
export const MAX_PIECES = 600; // a 30 minute visit in 5 second pieces
export const MAX_STORED_BYTES = 80_000_000; // all pieces of one recording, as stored text

const STATUS: Record<ScribeError['code'], number> = {
  NOT_FOUND: 404,
  BAD_STATE: 409,
  MISSING_CHUNKS: 409, // the app sends the missing pieces again, then asks again
  UNSUPPORTED_AUDIO: 415,
  NO_SPEECH: 422,
  STT_UNAVAILABLE: 503,
  LLM_UNAVAILABLE: 503,
  STT_FAILED: 502,
  LLM_FAILED: 502,
};

/** Answers a thrown error. A ScribeError becomes a clear code the app can act on, and `retryable` says whether trying again can help. */
export function scribeErrorResponse(e: unknown): NextResponse {
  if (e instanceof ScribeError) {
    return NextResponse.json({ error: e.code, message: e.message, retryable: e.retryable }, { status: STATUS[e.code] ?? 500 });
  }
  console.error('[scribe]', e);
  return NextResponse.json({ error: 'INTERNAL', message: 'Something went wrong', retryable: true }, { status: 500 });
}

/** What the app may see. The raw model answer and the audio stay on the server. */
export function publicScribe(s: Scribe) {
  return {
    id: s.id,
    status: s.status,
    language: s.language,
    durationSec: s.durationSec,
    transcript: s.transcript ? { language: s.transcript.language, segments: s.transcript.segments, warnings: s.transcript.warnings } : null,
    checked: s.checked,
    candidates: s.candidates,
    errorCode: s.errorCode,
    visitId: s.visitId,
  };
}
