import { z } from 'zod';

// One place for every contract: tool inputs/outputs, DB rows and API bodies all parse through these.

export const RISK_LEVELS = ['normal', 'watch', 'high', 'urgent'] as const;
export const RiskLevel = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevel>;

/** Symptoms the ASHA can report. Danger-sign handling lives in lib/rules/anc.v1.ts. */
export const SYMPTOMS = [
  'bleeding',
  'convulsions',
  'severe_headache',
  'blurred_vision',
  'reduced_fetal_movement',
  'swelling_face_hands',
  'swelling_feet',
  'fever',
  'leaking_fluid',
  'severe_vomiting',
  'breathlessness',
] as const;
export const Symptom = z.enum(SYMPTOMS);
export type Symptom = z.infer<typeof Symptom>;

const visitShape = {
  gestationWeeks: z.number().int().min(4).max(42).optional().describe('Weeks of pregnancy. 7 months is about 28 weeks.'),
  bpSys: z.number().int().min(60).max(260).optional().describe('Upper (systolic) blood pressure, e.g. 150'),
  bpDia: z.number().int().min(30).max(160).optional().describe('Lower (diastolic) blood pressure, e.g. 100'),
  hb: z.number().min(2).max(20).optional().describe('Haemoglobin in g/dL, e.g. 7.5'),
  symptoms: z.array(Symptom).max(12).default([]).describe('Only symptoms the ASHA actually reported'),
  notes: z.string().max(500).optional(),
};
const bpBothOrNeither = (v: { bpSys?: number; bpDia?: number }) => (v.bpSys === undefined) === (v.bpDia === undefined);
const bpOrdered = (v: { bpSys?: number; bpDia?: number }) => v.bpSys === undefined || v.bpDia === undefined || v.bpSys > v.bpDia;

export const VisitFacts = z
  .object(visitShape)
  .refine(bpBothOrNeither, { message: 'Give both bpSys and bpDia, or neither' })
  .refine(bpOrdered, { message: 'bpSys must be higher than bpDia' });
export type VisitFacts = z.infer<typeof VisitFacts>;

export const RecordVisitInput = z
  .object({ beneficiaryId: z.string().uuid().describe('The id returned by findBeneficiary'), ...visitShape })
  .refine(bpBothOrNeither, { message: 'Give both bpSys and bpDia, or neither' })
  .refine(bpOrdered, { message: 'bpSys must be higher than bpDia' });
export type RecordVisitInput = z.infer<typeof RecordVisitInput>;

export const BeneficiaryProfile = z.object({
  age: z.number().int().min(10).max(60).nullable().optional(),
  parity: z.number().int().min(0).max(20).nullable().optional(),
});
export type BeneficiaryProfile = z.infer<typeof BeneficiaryProfile>;

export const EvidenceStatus = z.enum(['cited', 'pending']);
export const RiskReason = z.object({
  code: z.string(),
  level: RiskLevel,
  text: z.string(),
  evidence: z.object({
    sourceId: z.string(),
    label: z.string(),
    page: z.string().optional(),
    /** 'cited' = quote and page verified in knowledge/RULES_EVIDENCE.md. 'pending' = not yet verified, UI must not show a citation. */
    status: EvidenceStatus,
  }),
});
export type RiskReason = z.infer<typeof RiskReason>;

export const Risk = z.object({
  level: RiskLevel,
  reasons: z.array(RiskReason),
  rulesVersion: z.string(),
});
export type Risk = z.infer<typeof Risk>;

/** Every tool answers with this, never throws, so the voice agent can always say something sensible. */
export type ToolResult<T> = { ok: true; data: T } | { ok: false; code: string; messageHi: string; hint?: string };

export const Uuid = z.string().uuid();
