// SAMPLE DATA ONLY. Replaced by /api/events and the database in the tools phase.
export const SAMPLE_ASHA = {
  name: 'Meena Kumari',
  initials: 'मी',
  role: 'ASHA',
  phc: 'Kolar PHC',
};

export const SAMPLE_STATS = { visitsToday: 4, highRisk: 1 };

// ---- Visit result shapes. These mirror what recordVisit / draftAlert / sendAlert will return (zod schemas later). ----
export type RiskLevel = 'normal' | 'watch' | 'high' | 'urgent';

export type VisitResult = {
  beneficiary: { name: string; village: string; weeks: number; firstPregnancy?: boolean };
  vitals: { bpSys: number; bpDia: number; hb: number | null; symptoms: string[] };
  risk: {
    level: RiskLevel;
    reasons: { text: string; citation?: { label: string; page?: string } }[];
    rulesVersion: string;
  };
  /** Only ever filled from searchGuidelines results; null until the ASHA asks. Never invented. */
  advice: string | null;
  tools: { name: string; state: 'done' | 'waiting'; note?: string; ms?: number }[];
  alert: { status: 'draft' | 'sent' | 'failed'; doctor: string; phc: string; message: string; sentAt?: string };
  followUp: { note: string; month: string; day: string };
  remaining: { name: string; village: string; status: 'Watch' | 'Normal' | 'Pending' }[];
};

export const SAMPLE_VISIT: VisitResult = {
  beneficiary: { name: 'Sunita Devi', village: 'Narsapura', weeks: 28, firstPregnancy: false },
  vitals: { bpSys: 150, bpDia: 100, hb: null, symptoms: ['Swelling in feet'] },
  risk: {
    level: 'high',
    reasons: [{ text: 'BP is 140/90 or higher', citation: { label: 'ICMR STW · Antenatal' } }],
    rulesVersion: 'anc.v1',
  },
  advice: null,
  tools: [
    { name: 'findBeneficiary', state: 'done', ms: 180 },
    { name: 'recordVisit', state: 'done', ms: 240 },
    { name: 'searchGuidelines', state: 'done', ms: 410 },
    { name: 'draftAlert', state: 'waiting', note: 'waiting for “haan”' },
  ],
  alert: {
    status: 'sent',
    doctor: 'Dr. [name]',
    phc: 'Kolar PHC',
    message:
      'High risk ANC visit\nSunita Devi, Narsapura · 28 weeks\nBP 150/100, swelling in feet\nASHA: Meena Kumari · 11:42\nPlease review soon.',
    sentAt: '11:42',
  },
  followUp: { note: '3 days from now · recheck BP', month: 'NOV', day: '23' },
  remaining: [
    { name: 'Lakshmi B', village: 'Hosahalli', status: 'Watch' },
    { name: 'Asha Rani', village: 'Narsapura', status: 'Normal' },
    { name: 'Pooja K', village: 'Malur', status: 'Pending' },
  ],
};
