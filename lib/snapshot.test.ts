import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import type { Db } from '@/lib/db/client';
import { insertBeneficiary, logEvent } from '@/lib/db/repo';
import { consoleNotifier } from '@/lib/notify';
import { executeTool, type ToolContext } from '@/lib/tools';
import { draftAlert, recordVisit, scheduleFollowUp, sendAlert } from '@/lib/tools/tools';
import { getSnapshot } from './snapshot';

let db: Db & { close: () => Promise<void> };
let ashaId = '';
let ctx: ToolContext;
let sunita = '';

beforeAll(async () => {
  db = await createTestDb();
  ashaId = (await db.query<{ id: string }>(`insert into ashas (name, phc_name, doctor_name, doctor_phone) values ('Meena Kumari','Kolar PHC','Dr Rao','+919999900001') returning id`))[0].id;
  sunita = (await insertBeneficiary(db, { ashaId, name: 'Sunita Devi', village: 'Narsapura', age: 24, parity: 0 })).id;
  await insertBeneficiary(db, { ashaId, name: 'Pooja K', village: 'Malur' });
  ctx = { db, ashaId, sessionId: 'call-snap-1', turnId: 't', notifier: { ...consoleNotifier, send: async () => ({ providerId: 'x' }) }, now: () => new Date() };
});
afterAll(async () => db.close());

describe('getSnapshot', () => {
  it('is empty and calm before any visit', async () => {
    const s = await getSnapshot(db, { sessionId: 'call-snap-1' });
    expect(s.asha?.name).toBe('Meena Kumari');
    expect(s.visit).toBeNull();
    expect(s.counts).toEqual({ visits: 0, highRisk: 0, alertsSent: 0, followUps: 0 });
    expect(s.remaining.map((r) => r.name).sort()).toEqual(['Pooja K', 'Sunita Devi']);
  });

  it('reflects a full visit: risk, citation, alert, follow-up, timeline, counts', async () => {
    const rec = await executeTool(recordVisit, { beneficiaryId: sunita, gestationWeeks: 28, bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] }, ctx);
    const visitId = rec.ok ? rec.data.visitId : '';
    const draft = await executeTool(draftAlert, { visitId }, ctx);
    const token = draft.ok && !draft.data.alreadySent ? draft.data.token : '';
    await executeTool(sendAlert, { token }, ctx);
    await executeTool(scheduleFollowUp, { beneficiaryId: sunita, inDays: 3, reason: 'recheck BP', visitId }, ctx);

    const s = await getSnapshot(db, { sessionId: 'call-snap-1' });
    expect(s.visit?.beneficiary).toMatchObject({ name: 'Sunita Devi', village: 'Narsapura', weeks: 28, firstPregnancy: true });
    expect(s.visit?.vitals).toMatchObject({ bpSys: 150, bpDia: 100 });
    expect(s.visit?.risk.level).toBe('high');
    expect(s.visit?.risk.reasons[0]).toMatchObject({ code: 'BP_HIGH', citation: { label: 'ICMR STW · Antenatal management', page: '1' } });
    expect(s.visit?.alert).toMatchObject({ status: 'sent', doctor: 'Dr Rao', phc: 'Kolar PHC' });
    expect(s.visit?.followUp?.reason).toBe('recheck BP');
    expect(s.events.map((e) => e.name)).toEqual(['recordVisit', 'draftAlert', 'sendAlert', 'scheduleFollowUp']);
    expect(s.events[0].note).toBe('risk: high');
    expect(s.counts).toEqual({ visits: 1, highRisk: 1, alertsSent: 1, followUps: 1 });
    expect(s.remaining.map((r) => r.name)).toEqual(['Pooja K']); // Sunita was visited today
  });

  it('shows a doctor call on the visit and in the timeline', async () => {
    expect((await getSnapshot(db, { sessionId: 'call-snap-1' })).visit?.call).toEqual({ doctorJoinedAt: null, lastEventAt: null });
    await logEvent(db, { sessionId: 'call-snap-1', ashaId, type: 'call', name: 'doctorCall', input: { role: 'asha', event: 'joined' }, ok: true });
    expect((await getSnapshot(db, { sessionId: 'call-snap-1' })).visit?.call.doctorJoinedAt).toBeNull();
    await logEvent(db, { sessionId: 'call-snap-1', ashaId, type: 'call', name: 'doctorCall', input: { role: 'doctor', event: 'joined' }, ok: true });
    const s = await getSnapshot(db, { sessionId: 'call-snap-1' });
    expect(s.visit?.call.doctorJoinedAt).toEqual(expect.any(String));
    expect(s.visit?.call.lastEventAt).toEqual(expect.any(String));
    expect(s.events.slice(-2).map((e) => e.note)).toEqual(['ASHA joined', 'doctor joined']);
  });

  it('a different call does not see this call\'s visit, but the dashboard (no session) does', async () => {
    expect((await getSnapshot(db, { sessionId: 'someone-elses-call' })).visit).toBeNull();
    expect((await getSnapshot(db, {})).visit?.beneficiary.name).toBe('Sunita Devi');
  });

  it('never exposes a citation for evidence that is still pending', async () => {
    const m = await insertBeneficiary(db, { ashaId, name: 'Sev Case', village: 'X' });
    await executeTool(recordVisit, { beneficiaryId: m.id, bpSys: 170, bpDia: 100, symptoms: [] }, { ...ctx, sessionId: 'call-snap-2' });
    const s = await getSnapshot(db, { sessionId: 'call-snap-2' });
    expect(s.visit?.risk.level).toBe('urgent');
    expect(s.visit?.risk.reasons[0].citation).toBeNull();
  });
});
