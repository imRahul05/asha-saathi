import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { assessAnc } from '@/lib/rules/anc.v1';
import { RecordVisitInput, Uuid, type Risk } from '@/lib/schemas';
import { composeAlertMessage } from '@/lib/alerts/message';
import {
  alertsForVisit, claimAlertForSending, findBeneficiaries, findRecentDuplicateVisit, getAlertByToken, getAsha, getBeneficiary,
  getVisit, insertAlertDraft, insertFollowUp, insertVisit, markAlertFailed, markAlertSent, pendingFollowUps, recentVisits, todayCounts,
  type Beneficiary,
} from '@/lib/db/repo';
import { defineTool, ToolError, type ToolContext } from './define';

const ALERT_TTL_MINUTES = 10;

/** Weeks of pregnancy from the last menstrual period, or null if unknown / implausible. */
export function weeksFromLmp(lmp: string | null, now: Date): number | null {
  if (!lmp) return null;
  const days = Math.floor((now.getTime() - new Date(`${lmp}T00:00:00Z`).getTime()) / 86_400_000);
  const weeks = Math.floor(days / 7);
  return weeks >= 4 && weeks <= 42 ? weeks : null;
}

/** What the model may say about the risk. Citations only for evidence that is verified ('cited'). */
function riskForModel(risk: Risk) {
  return {
    level: risk.level,
    rulesVersion: risk.rulesVersion,
    reasons: risk.reasons.map((r) => ({
      code: r.code,
      level: r.level,
      text: r.text,
      source: r.evidence.status === 'cited' ? { label: r.evidence.label, page: r.evidence.page } : null,
    })),
  };
}

const maskPhone = (p: string | null) => (p && p.length > 4 ? `${'•'.repeat(p.length - 4)}${p.slice(-4)}` : p);
const newToken = () => Array.from({ length: 8 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[randomInt(0, 31)]).join('');
const mustBeneficiary = async (ctx: ToolContext, id: string): Promise<Beneficiary> => {
  const b = await getBeneficiary(ctx.db, ctx.ashaId, id);
  if (!b) throw new ToolError('NOT_FOUND', 'यह नाम मेरी सूची में नहीं मिला।', 'No such beneficiary for this ASHA. Use findBeneficiary first.');
  return b;
};

// ---------------------------------------------------------------------------------------------------------------

export const findBeneficiary = defineTool({
  name: 'findBeneficiary',
  description:
    'Find a registered mother by name. Call this first whenever the ASHA names someone. Pass the FULL name exactly as she said it, including the surname or "devi"/"kumari" if given (e.g. "Sunita Devi"), and the village if she mentioned it, in English letters even if it was spoken in Hindi or Kannada. Never shorten a full name to the first name. If several match, ask the ASHA which one (use village).',
  input: z.object({ name: z.string().min(1).max(80), village: z.string().max(80).optional() }),
  async run({ name, village }, ctx) {
    const found = await findBeneficiaries(ctx.db, ctx.ashaId, name.trim(), village?.trim());
    const matches = found.map((b) => ({
      id: b.id, name: b.name, village: b.village, age: b.age, weeks: weeksFromLmp(b.lmp, ctx.now()), score: Math.round(b.score * 100) / 100,
    }));
    // "Sunita Devi" must not trigger "which Sunita?" just because "Sunita Kumari" also looks similar:
    // when the best match is clearly ahead of the runner-up, treat it as the one.
    const clearWinner = matches.length > 1 && matches[0].score - matches[1].score >= 0.2;
    const suggestion = matches.length === 0 ? 'not_found' : matches.length === 1 || clearWinner ? 'unique' : 'ask_which';
    return {
      count: matches.length,
      matches,
      suggestion,
      hint:
        suggestion === 'not_found' ? 'No match. Ask the ASHA to repeat the name or say the village.'
        : suggestion === 'ask_which' ? 'Several mothers match. Ask which one, naming the villages.'
        : 'The first match is the mother. Continue with its id without asking again.',
    };
  },
});

export const getBeneficiaryHistory = defineTool({
  name: 'getBeneficiaryHistory',
  description: 'Get a mother\'s profile and her last 3 recorded visits. Use it when the ASHA asks about earlier visits.',
  input: z.object({ beneficiaryId: Uuid }),
  async run({ beneficiaryId }, ctx) {
    const b = await mustBeneficiary(ctx, beneficiaryId);
    const visits = await recentVisits(ctx.db, b.id, 3);
    return {
      beneficiary: { id: b.id, name: b.name, village: b.village, age: b.age, parity: b.parity, weeks: weeksFromLmp(b.lmp, ctx.now()) },
      visits: visits.map((v) => ({
        date: v.visitedAt.slice(0, 10), weeks: v.gestationWeeks, bp: v.bpSys != null ? `${v.bpSys}/${v.bpDia}` : null, hb: v.hb,
        symptoms: v.symptoms, riskLevel: v.riskLevel,
      })),
    };
  },
});

export const recordVisit = defineTool({
  name: 'recordVisit',
  description:
    'Save a home visit and get the risk level. Call it as soon as you have the mother (from findBeneficiary) and at least one measurement or symptom. Never invent numbers: pass only what the ASHA said. The risk level comes from fixed clinical rules; report it exactly as returned.',
  input: RecordVisitInput,
  async run(input, ctx) {
    const b = await mustBeneficiary(ctx, input.beneficiaryId);
    if (input.bpSys === undefined && input.hb === undefined && input.symptoms.length === 0) {
      throw new ToolError('NOTHING_TO_RECORD', 'कोई जाँच या लक्षण नहीं बताया गया।', 'Ask for BP, haemoglobin or symptoms before saving.');
    }
    const weeks = input.gestationWeeks ?? weeksFromLmp(b.lmp, ctx.now()) ?? undefined;
    const facts = { ...input, gestationWeeks: weeks };
    const duplicate = await findRecentDuplicateVisit(ctx.db, {
      sessionId: ctx.sessionId, beneficiaryId: b.id, bpSys: input.bpSys, bpDia: input.bpDia, hb: input.hb, symptoms: input.symptoms,
    });
    const visit = duplicate ?? (await insertVisit(ctx.db, {
      ashaId: ctx.ashaId, beneficiaryId: b.id, sessionId: ctx.sessionId, gestationWeeks: weeks, bpSys: input.bpSys, bpDia: input.bpDia,
      hb: input.hb, symptoms: input.symptoms, notes: input.notes, risk: assessAnc(facts, { age: b.age, parity: b.parity }),
    }));
    const risk: Risk = { level: visit.riskLevel, reasons: visit.riskReasons, rulesVersion: visit.rulesVersion };
    const serious = risk.level === 'high' || risk.level === 'urgent';
    return {
      visitId: visit.id,
      duplicate: Boolean(duplicate),
      beneficiary: { id: b.id, name: b.name, village: b.village },
      weeks: visit.gestationWeeks,
      vitals: { bp: visit.bpSys != null ? `${visit.bpSys}/${visit.bpDia}` : null, hb: visit.hb, symptoms: visit.symptoms },
      risk: riskForModel(risk),
      nextStep: serious
        ? 'Tell the ASHA the risk level and the main reason in one or two sentences, then ask if she wants the doctor alerted (draftAlert). Also offer a follow-up (scheduleFollowUp).'
        : risk.level === 'watch'
          ? 'Tell the ASHA it needs watching and suggest a follow-up visit (scheduleFollowUp).'
          : 'Tell the ASHA the visit is saved and all looks normal.',
    };
  },
});

export const scheduleFollowUp = defineTool({
  name: 'scheduleFollowUp',
  description: 'Book the next visit for a mother, a number of days from today (1 to 30).',
  input: z.object({
    beneficiaryId: Uuid,
    inDays: z.number().int().min(1).max(30),
    reason: z.string().max(120).optional().describe('Short reason, e.g. "recheck BP"'),
    visitId: Uuid.optional(),
  }),
  async run({ beneficiaryId, inDays, reason, visitId }, ctx) {
    const b = await mustBeneficiary(ctx, beneficiaryId);
    const f = await insertFollowUp(ctx.db, { ashaId: ctx.ashaId, beneficiaryId: b.id, visitId, inDays, reason });
    return { followUpId: f.id, beneficiary: b.name, dueDate: f.dueDate, inDays, reason: f.reason };
  },
});

export const todaySummary = defineTool({
  name: 'todaySummary',
  description: 'The ASHA\'s day so far: visits done, high-risk count, alerts sent, and follow-ups due this week. Use for "aaj ka kaam".',
  input: z.object({}),
  async run(_i, ctx) {
    const [counts, due] = await Promise.all([todayCounts(ctx.db, ctx.ashaId), pendingFollowUps(ctx.db, ctx.ashaId, 7)]);
    return { ...counts, due: due.map((d) => ({ name: d.beneficiaryName, village: d.village, dueDate: d.dueDate, reason: d.reason })) };
  },
});

export const draftAlert = defineTool({
  name: 'draftAlert',
  description:
    'Prepare the WhatsApp alert for the doctor about a recorded visit. This does NOT send anything. Read the preview summary to the ASHA, ask for her confirmation, and only after she says yes call sendAlert with the token.',
  input: z.object({ visitId: Uuid }),
  async run({ visitId }, ctx) {
    const visit = await getVisit(ctx.db, ctx.ashaId, visitId);
    if (!visit) throw new ToolError('NOT_FOUND', 'यह visit नहीं मिली।', 'Unknown visitId. Use the id returned by recordVisit.');
    const existing = await alertsForVisit(ctx.db, visit.id);
    const sent = existing.find((a) => a.status === 'sent');
    if (sent) return { alreadySent: true as const, status: 'sent' as const, sentAt: sent.sentAt, hint: 'An alert for this visit was already sent. Do not send another.' };
    const open = existing.find((a) => a.status === 'draft' && new Date(a.expiresAt) > ctx.now());
    const [asha, b] = await Promise.all([getAsha(ctx.db, ctx.ashaId), getBeneficiary(ctx.db, ctx.ashaId, visit.beneficiaryId)]);
    if (!asha || !b) throw new ToolError('NOT_FOUND', 'जानकारी नहीं मिली।');
    if (!asha.doctorPhone) {
      throw new ToolError('NO_DOCTOR', 'डॉक्टर का नंबर सेव नहीं है।', 'This ASHA has no doctor phone saved. Tell her an admin must add it.');
    }
    const draft = open ?? (await insertAlertDraft(ctx.db, {
      visitId: visit.id, toName: asha.doctorName, toPhone: asha.doctorPhone, message: composeAlertMessage(visit, b, asha, ctx.now()),
      token: newToken(), ttlMinutes: ALERT_TTL_MINUTES,
    }));
    return {
      alreadySent: false as const,
      token: draft.confirmToken,
      to: { name: draft.toName, phone: maskPhone(draft.toPhone) },
      preview: draft.message,
      expiresInMinutes: ALERT_TTL_MINUTES,
      hint: 'Not sent yet. Ask the ASHA to confirm, then call sendAlert with this token.',
    };
  },
});

export const sendAlert = defineTool({
  name: 'sendAlert',
  description: 'Send a drafted alert to the doctor. Only call this after the ASHA has clearly said yes (haan / sari / yes). Sends at most once per draft.',
  input: z.object({ token: z.string().min(4).max(40) }),
  sideEffect: true,
  timeoutMs: 12000,
  async run({ token }, ctx) {
    const existing = await getAlertByToken(ctx.db, token.trim().toLowerCase());
    if (!existing) throw new ToolError('NO_DRAFT', 'पहले alert तैयार करना होगा।', 'Unknown token. Call draftAlert first.');
    if (existing.status === 'sent') {
      return { status: 'sent' as const, alreadySent: true, provider: existing.provider, sentAt: existing.sentAt, hint: 'Already sent earlier. Do not send again; just confirm it.' };
    }
    const claimed = await claimAlertForSending(ctx.db, existing.confirmToken);
    if (!claimed) {
      const now = await getAlertByToken(ctx.db, existing.confirmToken);
      if (now?.status === 'sent') return { status: 'sent' as const, alreadySent: true, provider: now.provider, sentAt: now.sentAt, hint: 'Already sent. Do not send again.' };
      throw new ToolError('EXPIRED', 'यह alert पुराना हो गया है, दोबारा तैयार करना होगा।', 'The draft expired (10 minutes). Call draftAlert again.');
    }
    try {
      const res = await ctx.notifier.send({ name: claimed.toName, phone: claimed.toPhone }, claimed.message);
      await markAlertSent(ctx.db, claimed.id, ctx.notifier.name, res.providerId);
      return { status: 'sent' as const, alreadySent: false, provider: ctx.notifier.name, sentAt: claimed.sentAt };
    } catch (e) {
      await markAlertFailed(ctx.db, claimed.id, e instanceof Error ? e.message : String(e));
      throw new ToolError('SEND_FAILED', 'Alert भेजा नहीं जा सका, दोबारा कोशिश करेंगे।', 'The message could not be delivered. The draft is kept: you can call sendAlert again with the same token.');
    }
  },
});
