// Shapes the UI reads from /api/session/state and /api/dashboard. Pure types: safe to import in client components.
export type RiskLevel = 'normal' | 'watch' | 'high' | 'urgent';

export type SnapshotVisit = {
  id: string;
  visitedAt: string;
  beneficiary: { name: string; village: string | null; weeks: number | null; age: number | null; firstPregnancy: boolean | null };
  vitals: { bpSys: number | null; bpDia: number | null; hb: number | null; symptoms: string[] };
  risk: {
    level: RiskLevel;
    rulesVersion: string;
    /** citation is set only when the rule's evidence is verified ('cited'); otherwise null and the UI must not show a source. */
    reasons: { code: string; text: string; level: RiskLevel; citation: { label: string; page?: string } | null }[];
  };
  alert: null | { status: 'draft' | 'sent' | 'failed'; doctor: string | null; phc: string | null; message: string; sentAt: string | null; error: string | null };
  followUp: null | { dueDate: string; reason: string | null };
};

export type SnapshotEvent = { id: number; name: string; ok: boolean; ms: number | null; note: string; at: string };

export type SnapshotRemaining = { name: string; village: string | null; status: 'High' | 'Watch' | 'Normal' | 'Pending' };

export type Snapshot = {
  asha: { name: string; phcName: string; language: 'hi' | 'kn' | 'en' } | null;
  counts: { visits: number; highRisk: number; alertsSent: number; followUps: number };
  visit: SnapshotVisit | null;
  events: SnapshotEvent[];
  remaining: SnapshotRemaining[];
  serverTime: string;
};
