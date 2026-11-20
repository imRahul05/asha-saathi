import type { Asha, Beneficiary, Visit } from '@/lib/db/repo';

const SYMPTOM_LABEL: Record<string, string> = {
  bleeding: 'bleeding', convulsions: 'convulsions', severe_headache: 'severe headache', blurred_vision: 'blurred vision',
  reduced_fetal_movement: 'reduced baby movement', swelling_face_hands: 'swelling of face/hands', swelling_feet: 'swelling in feet',
  fever: 'fever', abdominal_pain: 'abdominal pain', leaking_fluid: 'leaking fluid', severe_vomiting: 'severe vomiting', breathlessness: 'breathlessness',
};

const HEADLINE: Record<string, string> = {
  urgent: 'URGENT: ANC danger sign',
  high: 'High risk ANC visit',
  watch: 'ANC visit: needs a recheck',
  normal: 'ANC visit: normal',
};

/** The WhatsApp text for the doctor. Built from recorded facts by a template, never written by the AI. */
export function composeAlertMessage(visit: Visit, b: Beneficiary, asha: Asha, now: Date = new Date()): string {
  const lines: string[] = [HEADLINE[visit.riskLevel] ?? 'ANC visit'];
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
