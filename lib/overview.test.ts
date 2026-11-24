import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import type { Db } from '@/lib/db/client';
import {
  claimAlertForSending,
  insertAlertDraft,
  insertBeneficiary,
  insertFollowUp,
  insertVisit,
  logEvent,
  markAlertSent,
} from '@/lib/db/repo';
import { getAshaOverview, getDoctorOverview } from '@/lib/overview';
import type { Risk } from '@/lib/schemas';

const highRisk: Risk = {
  level: 'high',
  rulesVersion: 'anc.v1',
  reasons: [
    {
      code: 'bp_high',
      level: 'high',
      text: 'Blood pressure is 150/96 mmHg',
      evidence: { sourceId: 'nhm', label: 'NHM ANC Guidelines', page: '14', status: 'cited' },
    },
  ],
};

const normalRisk: Risk = {
  level: 'normal',
  rulesVersion: 'anc.v1',
  reasons: [],
};

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe('overview builders', () => {
  let db: Db & { close: () => Promise<void> };
  let ashaId = '';
  let sunitaId = '';
  let kavitaId = '';
  let anitaId = '';
  let poojaId = '';

  beforeAll(async () => {
    db = await createTestDb();
    ashaId = (
      await db.query<{ id: string }>(
        `insert into ashas (name, phc_name, doctor_name, doctor_phone, language)
         values ('Meena Kumari', 'Kolar PHC', 'Dr. Ananya Rao', '+919999900001', 'hi')
         returning id`,
      )
    )[0].id;

    // 1. Sunita: high-risk visit today, sent alert, follow-up, doctor call & alert hold
    const sunita = await insertBeneficiary(db, {
      ashaId,
      name: 'Sunita Devi',
      village: 'Narsapura',
      age: 24,
      parity: 0,
      lmp: isoDateDaysAgo(210),
    });
    sunitaId = sunita.id;

    const sunitaVisit = await insertVisit(db, {
      ashaId,
      beneficiaryId: sunitaId,
      sessionId: 'sess-sunita',
      gestationWeeks: 32,
      bpSys: 150,
      bpDia: 96,
      hb: 9.2,
      symptoms: ['severe_headache'],
      risk: highRisk,
    });

    const draft = await insertAlertDraft(db, {
      visitId: sunitaVisit.id,
      toName: 'Dr. Ananya Rao',
      toPhone: '+919999900001',
      message: 'High BP alert for Sunita Devi',
      token: 'tok-sunita-1',
      ttlMinutes: 15,
    });
    await claimAlertForSending(db, draft.confirmToken);
    await markAlertSent(db, draft.id, 'twilio', 'msg-123');
    await insertFollowUp(db, {
      ashaId,
      beneficiaryId: sunitaId,
      visitId: sunitaVisit.id,
      inDays: 2,
      reason: 'Recheck BP',
    });
    await logEvent(db, {
      ashaId,
      sessionId: 'sess-sunita',
      type: 'tool',
      name: 'doctorCall',
      input: { role: 'doctor', event: 'joined' },
      ok: true,
    });
    await logEvent(db, {
      ashaId,
      sessionId: 'sess-sunita',
      type: 'tool',
      name: 'holdAlert',
      output: { held: true },
      ok: true,
    });

    // 2. Kavita: no visit yet, has LMP (should estimate gestationWeeks) and overdue follow-up
    const kavita = await insertBeneficiary(db, {
      ashaId,
      name: 'Kavita Bai',
      village: 'Malur',
      age: 27,
      parity: 1,
      lmp: isoDateDaysAgo(140), // ~20 weeks
    });
    kavitaId = kavita.id;
    await insertFollowUp(db, {
      ashaId,
      beneficiaryId: kavitaId,
      inDays: -3,
      reason: 'Missed ANC checkup',
    });

    // 3. Anita: pending today (no visits, no follow-up), alphabetically before Pooja
    const anita = await insertBeneficiary(db, {
      ashaId,
      name: 'Anita Devi',
      village: 'Vemgal',
      age: 22,
      parity: 0,
    });
    anitaId = anita.id;

    // 4. Pooja: visited today with normal risk
    const pooja = await insertBeneficiary(db, {
      ashaId,
      name: 'Pooja K',
      village: 'Kolar',
      age: 29,
      parity: 2,
    });
    poojaId = pooja.id;
    await insertVisit(db, {
      ashaId,
      beneficiaryId: poojaId,
      gestationWeeks: 24,
      bpSys: 118,
      bpDia: 76,
      hb: 11.4,
      symptoms: [],
      risk: normalRisk,
    });
  });

  afterAll(async () => db.close());

  it('handles an empty database gracefully', async () => {
    const empty = await createTestDb();
    try {
      expect(await getAshaOverview(empty, '00000000-0000-4000-8000-000000000000')).toBeNull();
      const doc = await getDoctorOverview(empty);
      expect(doc.asha).toBeNull();
      expect(doc.cases).toEqual([]);
      expect(doc.patients).toEqual([]);
      expect(doc.counts).toEqual({
        visits: 0,
        highRisk: 0,
        alertsSent: 0,
        followUps: 0,
        overdueFollowUps: 0,
        totalPatients: 0,
      });
    } finally {
      await empty.close();
    }
  });

  it('builds ASHA overview with priority-sorted patients, LMP gestation estimate, and schedule', async () => {
    const overview = await getAshaOverview(db, ashaId);
    expect(overview).not.toBeNull();
    if (!overview) return;

    expect(overview.asha).toEqual({
      name: 'Meena Kumari',
      phcName: 'Kolar PHC',
      doctorName: 'Dr. Ananya Rao',
      language: 'hi',
    });
    expect(overview.counts).toEqual({
      visits: 2,
      highRisk: 1,
      alertsSent: 1,
      followUps: 2,
    });

    // Priority: Sunita (high risk) -> Kavita (overdue follow-up) -> Anita (pending today) -> Pooja (visited today, normal)
    expect(overview.patients.map((p) => p.id)).toEqual([sunitaId, kavitaId, anitaId, poojaId]);

    const sunita = overview.patients[0];
    expect(sunita.gestationWeeks).toBe(32);
    expect(sunita.visitedToday).toBe(true);
    expect(sunita.latestVisit?.riskLevel).toBe('high');
    expect(sunita.latestVisit?.riskReasons[0].citation).toEqual({ label: 'NHM ANC Guidelines', page: '14' });
    expect(sunita.nextFollowUp?.status).toBe('upcoming');

    const kavita = overview.patients[1];
    expect(kavita.gestationWeeks).toBeGreaterThanOrEqual(19);
    expect(kavita.gestationWeeks).toBeLessThanOrEqual(21);
    expect(kavita.visitedToday).toBe(false);
    expect(kavita.nextFollowUp?.status).toBe('overdue');

    const anita = overview.patients[2];
    expect(anita.gestationWeeks).toBeNull();
    expect(anita.visitedToday).toBe(false);

    expect(overview.schedule.map((s) => s.status)).toEqual(['overdue', 'upcoming']);
  });

  it('builds doctor overview with cases, alerts, call activity, alertHeld, and recent visits', async () => {
    const overview = await getDoctorOverview(db, ashaId);
    expect(overview.doctor).toEqual({ name: 'Dr. Ananya Rao', phcName: 'Kolar PHC' });
    expect(overview.asha).toEqual({ id: ashaId, name: 'Meena Kumari', phcName: 'Kolar PHC' });
    expect(overview.counts).toEqual({
      visits: 2,
      highRisk: 1,
      alertsSent: 1,
      followUps: 2,
      overdueFollowUps: 1,
      totalPatients: 4,
    });
    expect(overview.cases).toHaveLength(2);
    expect(overview.cursor).toBeGreaterThan(0);
    expect(overview.events.length).toBeGreaterThan(0);

    const sunitaCase = overview.cases.find((c) => c.beneficiary.id === sunitaId);
    expect(sunitaCase).toBeDefined();
    if (!sunitaCase) return;

    expect(sunitaCase.beneficiary.firstPregnancy).toBe(true);
    expect(sunitaCase.ashaName).toBe('Meena Kumari');
    expect(sunitaCase.alert?.status).toBe('sent');
    expect(sunitaCase.alert?.channel).toBe('twilio');
    expect(sunitaCase.followUp?.reason).toBe('Recheck BP');
    expect(sunitaCase.call.doctorJoinedAt).not.toBeNull();
    expect(sunitaCase.alertHeld).toBe(true);
    expect(sunitaCase.recentVisits).toHaveLength(1);

    // Fallback when no ashaId is passed resolves to mostRecentlyActiveAshaId / firstAsha
    const fallback = await getDoctorOverview(db);
    expect(fallback.asha?.id).toBe(ashaId);
  });
});
