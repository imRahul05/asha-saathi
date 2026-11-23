import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { findBeneficiaries } from '@/lib/db/repo';
import {
  attachVisit, chunkIndexes, claimForProcessing, claimForSaving, deleteChunks, getScribe, markFailed, markReady, readChunks, releaseSaving,
  type Candidate, type Scribe,
} from '@/lib/db/scribe-repo';
import { RecordVisitInput, Symptom } from '@/lib/schemas';
import { executeTool, type ToolContext } from '@/lib/tools';
import { recordVisit } from '@/lib/tools/tools';
import { checkExtraction } from './verify';
import { ScribeError, type Extractor, type SpeechToText } from './types';

// The steps after the audio has arrived: speech to text, then the language model, then the checks. Everything outside this file
// (the speech vendor, the model, the database) is passed in, so the whole pipeline runs in tests with no network.

export type PipelineDeps = { db: Db; stt: SpeechToText; extractor: Extractor };

export function missingChunks(have: number[], count: number): number[] {
  const set = new Set(have);
  return Array.from({ length: count }, (_, i) => i).filter((i) => !set.has(i));
}

function joinChunks(parts: string[]): Uint8Array {
  const buffers = parts.map((b64) => Buffer.from(b64, 'base64'));
  return new Uint8Array(Buffer.concat(buffers));
}

/**
 * Turns an uploaded recording into a transcript and a checked visit record. Safe to call again: a recording that is already
 * ready is returned as it is, one that is being processed is left alone, and a failed one is tried again.
 */
export async function processScribe(deps: PipelineDeps, ashaId: string, id: string, chunkCount: number): Promise<Scribe> {
  const { db } = deps;
  const scribe = await getScribe(db, ashaId, id);
  if (!scribe) throw new ScribeError('NOT_FOUND', 'No such recording');
  if (scribe.status === 'ready' || scribe.status === 'processing') return scribe;
  if (scribe.status === 'saved' || scribe.status === 'discarded') throw new ScribeError('BAD_STATE', `This recording is already ${scribe.status}`);

  const missing = missingChunks(await chunkIndexes(db, id), chunkCount);
  if (chunkCount < 1 || missing.length) {
    throw new ScribeError('MISSING_CHUNKS', chunkCount < 1 ? 'No audio was uploaded' : `Pieces still missing: ${missing.slice(0, 20).join(', ')}`);
  }

  const claimed = await claimForProcessing(db, ashaId, id, chunkCount);
  if (!claimed) return (await getScribe(db, ashaId, id)) ?? scribe; // someone else took it

  try {
    const audio = { bytes: joinChunks(await readChunks(db, id)), mime: claimed.mime };
    const transcript = await deps.stt.transcribe(audio, { language: claimed.language === 'auto' ? undefined : claimed.language });
    if (!transcript.segments.some((s) => s.text.trim())) throw new ScribeError('NO_SPEECH', 'No speech was found in the recording');

    const extraction = await deps.extractor.extract(transcript.segments, { language: claimed.language });
    const checked = checkExtraction(extraction, transcript.segments, transcript.warnings);

    let candidates: Candidate[] = [];
    if (checked.mother.name) {
      const found = await findBeneficiaries(db, ashaId, checked.mother.name, checked.mother.village ?? undefined);
      candidates = found.slice(0, 5).map((b) => ({ id: b.id, name: b.name, village: b.village }));
    }

    const ready = await markReady(db, id, { transcript, extraction, checked, candidates, durationSec: transcript.durationSec });
    await deleteChunks(db, id); // the audio is not kept once it has been turned into text
    return ready;
  } catch (e) {
    await markFailed(db, id, e instanceof ScribeError ? e.code : 'INTERNAL').catch(() => undefined);
    throw e;
  }
}

/** What the ASHA confirmed on the check screen. She can edit any value, and she must pick the mother. */
export const ConfirmInput = z.object({
  beneficiaryId: z.string().uuid(),
  gestationWeeks: z.number().int().optional(),
  bpSys: z.number().int().optional(),
  bpDia: z.number().int().optional(),
  hb: z.number().optional(),
  symptoms: z.array(Symptom).default([]),
  notes: z.string().max(500).optional(),
});
export type ConfirmInput = z.infer<typeof ConfirmInput>;

export type ConfirmResult =
  | { ok: true; scribe: Scribe; visit: unknown }
  | { ok: false; code: string; hint?: string };

/**
 * Saves the visit through the same tool the voice call uses, so the risk is decided by the same rules, the duplicate protection is the same,
 * and the event log shows it. Saves once: a second tap, or a retry after a dropped connection, finds it already saved.
 */
export async function confirmScribe(
  deps: { db: Db; notifier: ToolContext['notifier']; now?: () => Date },
  ashaId: string,
  id: string,
  raw: unknown,
): Promise<ConfirmResult> {
  const { db } = deps;
  const scribe = await getScribe(db, ashaId, id);
  if (!scribe) throw new ScribeError('NOT_FOUND', 'No such recording');
  const parsed = ConfirmInput.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'BAD_INPUT', hint: parsed.error.issues[0]?.message };
  if (scribe.status === 'saved' && scribe.visitId) return { ok: true, scribe, visit: { visitId: scribe.visitId, alreadySaved: true } };
  if (scribe.status !== 'ready') throw new ScribeError('BAD_STATE', `This recording is ${scribe.status}, not ready to save`);

  const claimed = await claimForSaving(db, ashaId, id);
  if (!claimed) throw new ScribeError('BAD_STATE', 'This recording was just saved or changed');

  const input = RecordVisitInput.safeParse(parsed.data);
  const ctx: ToolContext = { db, ashaId, sessionId: null, turnId: randomUUID(), notifier: deps.notifier, now: deps.now ?? (() => new Date()) };
  const res = input.success ? await executeTool(recordVisit, input.data, ctx) : null;
  if (!res || !res.ok) {
    await releaseSaving(db, id);
    return { ok: false, code: res ? res.code : 'BAD_INPUT', hint: res ? res.hint : input.error?.issues[0]?.message };
  }
  const visitId = (res.data as { visitId: string }).visitId;
  await attachVisit(db, id, visitId);
  return { ok: true, scribe: (await getScribe(db, ashaId, id)) ?? claimed, visit: res.data };
}
