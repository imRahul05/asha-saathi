// DEV ONLY. Used by the design preview at /preview (disabled in production). Never imported by real screens.
import type { Snapshot } from '@/lib/snapshot-types';

export const DEV_SNAPSHOT: Snapshot = {
  asha: { name: 'Meena Kumari', phcName: 'Kolar PHC', language: 'hi' },
  counts: { visits: 1, highRisk: 1, alertsSent: 1, followUps: 1 },
  visit: {
    id: 'dev',
    visitedAt: new Date().toISOString(),
    beneficiary: { name: 'Sunita Devi', village: 'Narsapura', weeks: 28, age: 24, firstPregnancy: false },
    vitals: { bpSys: 150, bpDia: 100, hb: null, symptoms: ['swelling_feet'] },
    risk: {
      level: 'high',
      rulesVersion: 'anc.v1',
      reasons: [{ code: 'BP_HIGH', level: 'high', text: 'BP 150/100 is 140/90 or higher. Repeat after 6 hours to confirm', citation: { label: 'ICMR STW · Antenatal management', page: '1' } }],
    },
    alert: { status: 'sent', doctor: 'Dr. Rao', phc: 'Kolar PHC', message: 'High risk ANC visit\nSunita Devi, Narsapura · 28 weeks\nBP 150/100, swelling in feet\nASHA: Meena Kumari · 11:42\nPlease review soon.', sentAt: new Date().toISOString(), error: null },
    followUp: { dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), reason: 'recheck BP' },
  },
  events: [
    { id: 1, name: 'findBeneficiary', ok: true, ms: 180, note: '“Sunita” → 1 match', at: new Date().toISOString() },
    { id: 2, name: 'recordVisit', ok: true, ms: 240, note: 'risk: high', at: new Date().toISOString() },
    { id: 3, name: 'draftAlert', ok: true, ms: 95, note: 'draft ready, waiting for “haan”', at: new Date().toISOString() },
    { id: 4, name: 'sendAlert', ok: true, ms: 620, note: 'sent via twilio', at: new Date().toISOString() },
  ],
  remaining: [
    { name: 'Lakshmi B', village: 'Hosahalli', status: 'Watch' },
    { name: 'Asha Rani', village: 'Narsapura', status: 'Normal' },
    { name: 'Pooja K', village: 'Malur', status: 'Pending' },
  ],
  serverTime: new Date().toISOString(),
};
