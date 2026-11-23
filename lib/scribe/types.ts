import { z } from 'zod';
import { SYMPTOMS } from '@/lib/schemas';

// Visit Scribe: the ASHA records a real home visit, the audio becomes text, and a language model fills in the visit record.
// Every step passes plain data through the types below, so the speech vendor and the model can each be swapped on their own.

/** One stretch of speech. `speaker` is optional because the speech vendor may not say who spoke (Murf does not). */
export const TranscriptSegment = z.object({
  speaker: z.enum(['asha', 'mother', 'other']).optional(),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().nonnegative().optional(),
  text: z.string(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

/** What a speech vendor returns for one recording. `warnings` are non-fatal problems, such as audio the vendor could not read. */
export type Transcript = {
  language: string | null;
  segments: TranscriptSegment[];
  durationSec: number | null;
  warnings: string[];
};

export const Polarity = z.enum(['present', 'absent', 'historical']);
export type Polarity = z.infer<typeof Polarity>;
export const Speaker = z.enum(['asha', 'mother', 'other', 'unsure']);
export type Speaker = z.infer<typeof Speaker>;

const evidence = {
  /** Words copied exactly from the transcript. The server checks they are really there. */
  quote: z.string(),
  /** present: true for this visit. absent: denied ("no bleeding"). historical: an earlier time ("had fever last time"). */
  polarity: Polarity,
  speaker: Speaker.nullish(),
};

/** What the language model returns. Nothing in it is trusted until lib/scribe/verify.ts has checked it. */
export const Extraction = z.object({
  mother: z.object({ name: z.string().nullish(), village: z.string().nullish() }).nullish(),
  gestationWeeks: z.object({ value: z.number(), ...evidence, conversion: z.string().nullish() }).nullish(),
  bp: z.object({ sys: z.number().nullish(), dia: z.number().nullish(), ...evidence }).nullish(),
  hb: z.object({ value: z.number(), ...evidence }).nullish(),
  symptoms: z.array(z.object({ value: z.enum(SYMPTOMS), ...evidence })).default([]),
  notes: z.string().nullish(),
});
export type Extraction = z.infer<typeof Extraction>;

export type FieldKey = 'gestationWeeks' | 'bp' | 'hb' | `symptom:${string}`;

/** One row on the check screen. `ok` means the quote is in the transcript. `check` means the ASHA must look at it closely. */
export type CheckedField = {
  key: FieldKey;
  value: string;
  quote: string;
  status: 'ok' | 'check';
  note?: string;
};

export type DroppedField = { key: FieldKey; value: string; reason: string };

export type CheckedFacts = {
  gestationWeeks?: number;
  bpSys?: number;
  bpDia?: number;
  hb?: number;
  symptoms: Array<(typeof SYMPTOMS)[number]>;
};

export type CheckedVisit = {
  mother: { name: string | null; village: string | null };
  fields: CheckedField[];
  /** Values that passed every check. These are what the ASHA confirms and what the rules engine would see. */
  facts: CheckedFacts;
  /** Values that were removed before the ASHA saw them, with the reason, kept so a support person can see what happened. */
  dropped: DroppedField[];
  /** Things the ASHA should know about the whole recording, such as audio the speech service could not read. */
  warnings: string[];
};

export type AudioInput = { bytes: Uint8Array; mime: string };

/** Any speech-to-text vendor. */
export interface SpeechToText {
  readonly name: string;
  transcribe(audio: AudioInput, opts: { language?: string }): Promise<Transcript>;
}

/** Any language model that reads a transcript and returns an Extraction. */
export interface Extractor {
  readonly name: string;
  extract(transcript: TranscriptSegment[], opts: { language?: string }): Promise<Extraction>;
}

/** An expected failure with a stable code, so a route can answer clearly and a client can decide whether to retry. */
export class ScribeError extends Error {
  constructor(
    public code:
      | 'UNSUPPORTED_AUDIO'
      | 'NO_SPEECH'
      | 'STT_UNAVAILABLE'
      | 'STT_FAILED'
      | 'LLM_UNAVAILABLE'
      | 'LLM_FAILED'
      | 'MISSING_CHUNKS'
      | 'NOT_FOUND'
      | 'BAD_STATE',
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
