import { visitShape } from '@/lib/schemas';
import type { CheckedFacts, CheckedField, CheckedVisit, DroppedField, Extraction, TranscriptSegment } from './types';

// The language model is the part most likely to say something confident and wrong. Before the ASHA sees anything,
// this module checks what it returned against the transcript, using plain code and no model:
//   1. every value needs a quote that really appears in the transcript, word for word
//   2. a number in the quote must be the number in the value (or the value must be flagged as converted or spelled out)
//   3. only things true for this visit are kept: denied ("no bleeding") and past ("had fever last time") are removed
//   4. values said by someone other than the mother or the ASHA, or by an unknown speaker, are flagged for her to look at
//   5. blood pressure needs both numbers, in the right order; half a reading is shown as incomplete, never guessed
//   6. values outside what is possible are removed
// The result is a list of rows for the check screen plus the clean facts. The ASHA still confirms everything.

const DIGIT_ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66]; // Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam

/** Writes Indian-script digits as 0-9, so "१५०" and "150" compare equal. */
export function mapDigits(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFKC')) {
    const cp = ch.codePointAt(0) ?? 0;
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    out += zero === undefined ? ch : String(cp - zero);
  }
  return out;
}

/** Lower case, digits as 0-9, punctuation and extra spaces removed. Letters and the marks that belong to Indian scripts stay. */
export function normalizeText(s: string): string {
  return mapDigits(s).toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** True when the quote is in the transcript word for word, bounded by spaces so "150" does not match inside "1500". */
export function quoteInTranscript(transcriptNorm: string, quote: string): boolean {
  const q = normalizeText(quote);
  if (q.length < 3) return false;
  let from = 0;
  for (;;) {
    const at = transcriptNorm.indexOf(q, from);
    if (at === -1) return false;
    const end = at + q.length;
    const startOk = at === 0 || transcriptNorm[at - 1] === ' ';
    const endOk = end === transcriptNorm.length || transcriptNorm[end] === ' ';
    if (startOk && endOk) return true;
    from = at + 1;
  }
}

function numbersIn(quote: string): number[] {
  return (mapDigits(quote).match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));
}

type Evidence = { quote: string; polarity: 'present' | 'absent' | 'historical'; speaker?: 'asha' | 'mother' | 'other' | 'unsure' | null };

/** The checks every value shares. Returns why it must be dropped, or the flags to show. */
function baseCheck(e: Evidence, transcriptNorm: string): { drop: string } | { notes: string[] } {
  if (e.polarity === 'absent') return { drop: 'it was said that this was not the case' };
  if (e.polarity === 'historical') return { drop: 'it was about an earlier time, not this visit' };
  if (!quoteInTranscript(transcriptNorm, e.quote)) return { drop: 'the quoted words are not in the transcript' };
  const notes: string[] = [];
  if (e.speaker === 'other') notes.push('said by someone other than the mother or the ASHA');
  if (e.speaker === 'unsure') notes.push('not sure who said this');
  return { notes };
}

/** A number in the quote must be the value. A quote with no digits (the number was spoken in words) cannot be checked by code. */
function numberCheck(value: number, quote: string): { drop: string } | { note?: string } {
  const nums = numbersIn(quote);
  if (nums.length === 0) return { note: 'the number was spoken in words, so please check it' };
  if (!nums.includes(value)) return { drop: `the quote says ${nums.join(', ')}, not ${value}` };
  return {};
}

export function checkExtraction(extraction: Extraction, segments: TranscriptSegment[], warnings: string[] = []): CheckedVisit {
  const transcriptNorm = normalizeText(segments.map((s) => s.text).join(' '));
  const fields: CheckedField[] = [];
  const dropped: DroppedField[] = [];
  const facts: CheckedFacts = { symptoms: [] };
  const drop = (key: CheckedField['key'], value: string, reason: string) => dropped.push({ key, value, reason });
  const push = (key: CheckedField['key'], value: string, quote: string, notes: string[]) =>
    fields.push({ key, value, quote, status: notes.length ? 'check' : 'ok', ...(notes.length ? { note: notes.join('. ') } : {}) });

  // Weeks pregnant
  const w = extraction.gestationWeeks;
  if (w) {
    const key = 'gestationWeeks';
    const shown = `${w.value} weeks`;
    const base = baseCheck(w, transcriptNorm);
    if ('drop' in base) drop(key, shown, base.drop);
    else {
      const notes = [...base.notes];
      let reason: string | null = null;
      if (w.conversion) notes.push(`converted: ${w.conversion}`);
      else {
        const n = numberCheck(w.value, w.quote);
        if ('drop' in n) reason = n.drop;
        else if (n.note) notes.push(n.note);
      }
      if (!reason && !visitShape.gestationWeeks.safeParse(w.value).success) reason = 'that is not a possible number of weeks';
      if (reason) drop(key, shown, reason);
      else {
        facts.gestationWeeks = w.value;
        push(key, shown, w.quote, notes);
      }
    }
  }

  // Blood pressure: both numbers, top higher than bottom
  const bp = extraction.bp;
  if (bp && (bp.sys != null || bp.dia != null)) {
    const shown = `${bp.sys ?? '?'}/${bp.dia ?? '?'}`;
    const base = baseCheck(bp, transcriptNorm);
    if ('drop' in base) drop('bp', shown, base.drop);
    else {
      const notes = [...base.notes];
      let sys = bp.sys ?? undefined;
      let dia = bp.dia ?? undefined;
      const wrong: string[] = [];
      for (const [name, v] of [['top', sys], ['bottom', dia]] as const) {
        if (v === undefined) continue;
        const n = numberCheck(v, bp.quote);
        if ('drop' in n) wrong.push(`${name} number: ${n.drop}`);
        else if (n.note && !notes.includes(n.note)) notes.push(n.note);
      }
      if (wrong.length) drop('bp', shown, wrong.join('; '));
      else {
        if (sys !== undefined && !visitShape.bpSys.safeParse(sys).success) sys = undefined;
        if (dia !== undefined && !visitShape.bpDia.safeParse(dia).success) dia = undefined;
        if (sys === undefined || dia === undefined) {
          // Half a reading. Shown so the ASHA can ask for the other number; it never reaches the rules engine.
          push('bp', shown, bp.quote, [...notes, 'only one usable number was heard, so no blood pressure is saved. Ask for both']);
        } else if (sys <= dia) {
          drop('bp', shown, 'the top number must be higher than the bottom number');
        } else {
          facts.bpSys = sys;
          facts.bpDia = dia;
          push('bp', `${sys}/${dia}`, bp.quote, notes);
        }
      }
    }
  }

  // Haemoglobin
  const hb = extraction.hb;
  if (hb) {
    const shown = `${hb.value} g/dL`;
    const base = baseCheck(hb, transcriptNorm);
    if ('drop' in base) drop('hb', shown, base.drop);
    else {
      const n = numberCheck(hb.value, hb.quote);
      if ('drop' in n) drop('hb', shown, n.drop);
      else if (!visitShape.hb.safeParse(hb.value).success) drop('hb', shown, 'that is not a possible haemoglobin value');
      else {
        facts.hb = hb.value;
        push('hb', shown, hb.quote, [...base.notes, ...(n.note ? [n.note] : [])]);
      }
    }
  }

  // Symptoms
  const seen = new Set<string>();
  for (const s of extraction.symptoms) {
    const key = `symptom:${s.value}` as const;
    const base = baseCheck(s, transcriptNorm);
    if ('drop' in base) {
      drop(key, s.value, base.drop);
      continue;
    }
    if (seen.has(s.value)) continue;
    seen.add(s.value);
    facts.symptoms.push(s.value);
    push(key, s.value, s.quote, base.notes);
  }

  return {
    mother: { name: extraction.mother?.name?.trim() || null, village: extraction.mother?.village?.trim() || null },
    fields,
    facts,
    dropped,
    warnings,
  };
}
