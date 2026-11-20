import type { Asha, Beneficiary, Visit } from '@/lib/db/repo';

const SYMPTOM_LABEL: Record<string, string> = {
  bleeding: 'bleeding', convulsions: 'convulsions', severe_headache: 'severe headache', blurred_vision: 'blurred vision',
  reduced_fetal_movement: 'reduced baby movement', swelling_face_hands: 'swelling of face/hands', swelling_feet: 'swelling in feet',
  fever: 'fever', abdominal_pain: 'abdominal pain', leaking_fluid: 'leaking fluid', severe_vomiting: 'severe vomiting', breathlessness: 'breathlessness',
};

const HEADLINE: Record<string, string> = {
  urgent: 'URGENT: ANC danger sign',
  high: 'HIGH RISK: ANC visit',
  watch: 'WATCH: ANC visit, recheck needed',
  normal: 'NORMAL: ANC visit',
};

// Chat apps do not allow coloured text, so severity is shown as a coloured emoji bar above the headline:
// the more serious, the longer and redder the bar. Red = urgent/high, orange = watch, green = normal.
const BANNER: Record<string, string> = {
  urgent: '\u{1F6A8}\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F6A8}',
  high: '\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F7E5}',
  watch: '\u{1F7E7}\u{1F7E7}\u{1F7E7}',
  normal: '\u{1F7E9}\u{1F7E9}\u{1F7E9}',
};

/** The WhatsApp text for the doctor. Built from recorded facts by a template, never written by the AI. */
export function composeAlertMessage(visit: Visit, b: Beneficiary, asha: Asha, now: Date = new Date()): string {
  const lines: string[] = [BANNER[visit.riskLevel] ?? '', HEADLINE[visit.riskLevel] ?? 'ANC visit'].filter(Boolean);
  lines.push(`${b.name}${b.village ? `, ${b.village}` : ''}${visit.gestationWeeks ? ` · ${visit.gestationWeeks} weeks` : ''}`);
  const facts: string[] = [];
  if (visit.bpSys != null && visit.bpDia != null) facts.push(`BP ${visit.bpSys}/${visit.bpDia}`);
  if (visit.hb != null) facts.push(`Hb ${visit.hb}`);
  for (const s of visit.symptoms) facts.push(SYMPTOM_LABEL[s] ?? s);
  if (facts.length) lines.push(facts.join(', '));
  if (visit.riskReasons.length) lines.push(`Why: ${visit.riskReasons.map((r) => r.text).join('; ')}`);
  const time = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now);
  lines.push(`ASHA: ${asha.name} · ${time}`);
  lines.push('Please review soon.');
  return lines.join('\n');
}

const LEVEL_SHORT: Record<string, string> = { urgent: 'URGENT', high: 'HIGH RISK', watch: 'WATCH', normal: 'NORMAL' };

/**
 * Compact SMS text: ASCII only (non-GSM characters make segments hold 70 characters instead of 160) and short, because
 * trial Twilio accounts reject multi-segment SMS (error 30044) and add their own prefix. Built from recorded facts.
 */
export function composeSmsText(visit: Visit, b: Beneficiary, asha: Asha, now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now);
  const parts: string[] = [`${LEVEL_SHORT[visit.riskLevel] ?? 'ANC'}: ${b.name}${b.village ? `, ${b.village}` : ''}${visit.gestationWeeks ? `, ${visit.gestationWeeks}wk` : ''}.`];
  if (visit.bpSys != null && visit.bpDia != null) parts.push(`BP ${visit.bpSys}/${visit.bpDia}.`);
  if (visit.hb != null) parts.push(`Hb ${visit.hb}.`);
  const sym = visit.symptoms.map((x) => (SYMPTOM_LABEL[x] ?? x)).slice(0, 2).join(', ');
  if (sym) parts.push(`${sym}.`);
  parts.push(`ASHA ${asha.name.split(' ')[0]} ${time}. Please review.`);
  const ascii = parts.join(' ').replace(/[^\x20-\x7E]/g, '');
  return ascii.length <= 110 ? ascii : `${ascii.slice(0, 107)}...`;
}
