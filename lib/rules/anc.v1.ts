import type { BeneficiaryProfile, Risk, RiskLevel, RiskReason, VisitFacts } from '@/lib/schemas';

// Deterministic antenatal risk rules. A pure function: same input, same output. The LLM never changes it.
//
// Evidence: see knowledge/RULES_EVIDENCE.md. Criteria below marked CITED are quoted verbatim there (ICMR STW, page 1).
// Rules marked PENDING come from general clinical practice, are NOT in the three official documents we hold,
// and are therefore never shown with a citation. Replace them or add the page once a source is found.
//
// PRODUCT DECISIONS (not stated by the sources; recorded so a clinician can review them):
//  - The ICMR criterion is "BP > 140/90 on 2 occasions 6 hours apart". We flag a SINGLE reading of 140/90 or more as high,
//    so that a high reading is never ignored, and the reason text tells the ASHA to repeat it after 6 hours.
//    We use ">=" (not ">") and "either number" (not both), the safer side.
//  - The level given to a danger sign (urgent vs high) is ours. The source only says danger signals go to a higher centre.
export const RULES_VERSION = 'anc.v1';

const RANK: Record<RiskLevel, number> = { normal: 0, watch: 1, high: 2, urgent: 3 };

const ICMR = { sourceId: 'icmr-anc-stw', label: 'ICMR STW · Antenatal management' };
const PRACTICE = { sourceId: 'clinical-practice', label: 'General clinical practice' };

/** Codes whose criterion is quoted verbatim in knowledge/RULES_EVIDENCE.md, with the page it is quoted from. */
export const CITED_PAGES: Record<string, string> = {
  BP_HIGH: '1',
  HB_SEVERE: '1',
  AGE_RISK: '1',
  PARITY_RISK: '1',
  BLEEDING: '1',
  CONVULSIONS: '1',
  SEVERE_HEADACHE: '1',
  BLURRED_VISION: '1',
  REDUCED_FETAL_MOVEMENT: '1',
  FEVER: '1',
  SEVERE_VOMITING: '1',
  BREATHLESSNESS: '1',
  LEAKING_FLUID: '1',
};

type Hit = RiskReason;

function hit(code: string, level: RiskLevel, text: string): Hit {
  const page = CITED_PAGES[code];
  return page
    ? { code, level, text, evidence: { ...ICMR, page, status: 'cited' } }
    : { code, level, text, evidence: { ...PRACTICE, status: 'pending' } };
}

const DANGER_SIGNS: Array<[string, string]> = [
  ['severe_headache', 'Severe headache is a danger sign in pregnancy'],
  ['blurred_vision', 'Blurred vision is a danger sign in pregnancy'],
  ['reduced_fetal_movement', 'Reduced baby movement is a danger sign'],
  ['fever', 'Fever is a danger sign in pregnancy'],
  ['severe_vomiting', 'Persistent vomiting is a danger sign in pregnancy'],
  ['breathlessness', 'Breathlessness or palpitations are a danger sign in pregnancy'],
  ['leaking_fluid', 'Leaking watery fluid is a danger sign in pregnancy'],
];

export function assessAnc(v: VisitFacts, b: BeneficiaryProfile = {}): Risk {
  const hits: Hit[] = [];

  // --- Emergency danger signs ---
  if (v.symptoms.includes('bleeding')) hits.push(hit('BLEEDING', 'urgent', 'Vaginal bleeding in pregnancy needs urgent referral to a CHC or higher centre'));
  if (v.symptoms.includes('convulsions')) hits.push(hit('CONVULSIONS', 'urgent', 'Convulsions (fits) in pregnancy need urgent referral'));

  // --- Blood pressure ---
  if (v.bpSys !== undefined && v.bpDia !== undefined) {
    if (v.bpSys >= 160 || v.bpDia >= 110) {
      hits.push(hit('BP_SEVERE', 'urgent', `BP ${v.bpSys}/${v.bpDia} is in the severe range (160/110 or more)`)); // PENDING evidence
    } else if (v.bpSys >= 140 || v.bpDia >= 90) {
      hits.push(hit('BP_HIGH', 'high', `BP ${v.bpSys}/${v.bpDia} is 140/90 or higher. Repeat after 6 hours to confirm`));
    }
  }

  // --- Anaemia ---
  if (v.hb !== undefined) {
    if (v.hb < 7) hits.push(hit('HB_SEVERE', 'high', `Hb ${v.hb} g/dL is below 7. Refer to a higher centre`));
    else if (v.hb < 11) hits.push(hit('HB_LOW', 'watch', `Hb ${v.hb} g/dL is below 11: anaemia`)); // PENDING evidence
  }

  // --- Other danger signs: refer ---
  for (const [sym, text] of DANGER_SIGNS) {
    if (v.symptoms.includes(sym as never)) hits.push(hit(sym.toUpperCase(), 'high', text));
  }
  if (v.symptoms.includes('swelling_face_hands')) {
    hits.push(hit('SWELLING_FACE_HANDS', 'watch', 'Swelling of face or hands can be a sign of high blood pressure')); // PENDING evidence
  }

  // --- Background risk factors (ICMR: age > 35 or < 19, parity > 4) ---
  if (b.age != null && (b.age < 19 || b.age > 35)) hits.push(hit('AGE_RISK', 'watch', `Age ${b.age} is a high-risk age (under 19 or over 35)`));
  if (b.parity != null && b.parity > 4) hits.push(hit('PARITY_RISK', 'watch', `${b.parity} earlier births (more than 4) is a risk factor`));

  const level = hits.reduce<RiskLevel>((top, h) => (RANK[h.level] > RANK[top] ? h.level : top), 'normal');
  // Most serious first, so the agent reads the biggest reason first.
  const reasons = [...hits].sort((a, c) => RANK[c.level] - RANK[a.level]);
  return { level, reasons, rulesVersion: RULES_VERSION };
}
