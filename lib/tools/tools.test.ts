import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import type { Db } from '@/lib/db/client';
import { insertBeneficiary, listEvents } from '@/lib/db/repo';
import type { Notifier } from '@/lib/notify';
import { executeTool, TOOLS, TOOL_NAMES, type ToolContext } from '@/lib/tools';
import { draftAlert, findBeneficiary, getBeneficiaryHistory, recordVisit, scheduleFollowUp, sendAlert, todaySummary, weeksFromLmp } from './tools';

let db: Db & { close: () => Promise<void> };
let ashaId: string;
let otherAshaId: string;
let sunitaId: string;
let sent: Array<{ to: unknown; message: string }>;
let failNext = false;

const notifier: Notifier = {
  name: 'test',
  async send(to, message) {
    if (failNext) {
      failNext = false;
      throw new Error('provider down');
    }
    sent.push({ to, message });
    return { providerId: `t-${sent.length}` };
  },
};
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  db, ashaId, sessionId: 'call-1', turnId: 't1', notifier, now: () => new Date(), ...over,
});

beforeAll(async () => {
  db = await createTestDb();
  const a = await db.query<{ id: string }>(`insert into ashas (name, phc_name, doctor_name, doctor_phone) values ('Meena Kumari','Kolar PHC','Dr Rao','+919999900001') returning id`);
  const o = await db.query<{ id: string }>(`insert into ashas (name, phc_name) values ('Other Asha','Elsewhere PHC') returning id`);
  ashaId = a[0].id;
  otherAshaId = o[0].id;
  const sunita = await insertBeneficiary(db, { ashaId, name: 'Sunita Devi', aliases: ['सुनीता'], village: 'Narsapura', age: 24, parity: 1, lmp: new Date(Date.now() - 28 * 7 * 86_400_000).toISOString().slice(0, 10) });
  sunitaId = sunita.id;
  await insertBeneficiary(db, { ashaId, name: 'Sunita Kumari', village: 'Malur', age: 30, parity: 2 });
  await insertBeneficiary(db, { ashaId, name: 'Lakshmi B', village: 'Hosahalli', age: 17, parity: 0 });
  await insertBeneficiary(db, { ashaId: otherAshaId, name: 'Secret Person', village: 'Elsewhere' });
});
afterAll(async () => db.close());

describe('tool registry', () => {
  it('has unique, camelCase names that match what the agent will be told', () => {
    expect(new Set(TOOL_NAMES).size).toBe(TOOLS.length);
    expect(TOOL_NAMES).toEqual(['findBeneficiary', 'getBeneficiaryHistory', 'recordVisit', 'scheduleFollowUp', 'todaySummary', 'draftAlert', 'sendAlert']);
  });
});

describe('findBeneficiary', () => {
  it('asks which one when two mothers share a first name', async () => {
    const r = await executeTool(findBeneficiary, { name: 'Sunita' }, ctx());
    expect(r.ok && r.data.suggestion).toBe('ask_which');
    expect(r.ok && r.data.count).toBe(2);
  });
  it('narrows by village', async () => {
    const r = await executeTool(findBeneficiary, { name: 'Sunita', village: 'Narsapura' }, ctx());
    expect(r.ok && r.data.suggestion).toBe('unique');
    expect(r.ok && r.data.matches[0].weeks).toBe(28);
  });
  it('matches a Devanagari alias', async () => {
    const r = await executeTool(findBeneficiary, { name: 'सुनीता' }, ctx());
    expect(r.ok && r.data.matches.map((m) => m.name)).toContain('Sunita Devi');
  });
  it('tolerates a spelling slip', async () => {
    const r = await executeTool(findBeneficiary, { name: 'Sunitha Devi' }, ctx());
    expect(r.ok && r.data.matches[0]?.name).toBe('Sunita Devi');
  });
  it('says not_found instead of failing', async () => {
    const r = await executeTool(findBeneficiary, { name: 'Zzyzx' }, ctx());
    expect(r.ok && r.data.suggestion).toBe('not_found');
  });
  it('never shows another ASHA\'s mothers', async () => {
    const r = await executeTool(findBeneficiary, { name: 'Secret' }, ctx());
    expect(r.ok && r.data.count).toBe(0);
  });
});

describe('recordVisit + rules', () => {
  it('saves the demo visit as HIGH with a cited BP reason', async () => {
    const r = await executeTool(recordVisit, { beneficiaryId: sunitaId, bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] }, ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.risk.level).toBe('high');
    expect(r.data.weeks).toBe(28); // from LMP, the ASHA did not say it
    expect(r.data.risk.reasons[0]).toMatchObject({ code: 'BP_HIGH', source: { page: '1' } });
    expect(r.data.nextStep).toMatch(/draftAlert/);
  });

  it('does not create a second visit for the same report in the same call', async () => {
    const a = await executeTool(recordVisit, { beneficiaryId: sunitaId, bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] }, ctx());
    expect(a.ok && a.data.duplicate).toBe(true);
    const rows = await db.query<{ n: string }>('select count(*) as n from visits where beneficiary_id = $1', [sunitaId]);
    expect(Number(rows[0].n)).toBe(1);
  });

  it('uses the mother\'s age: a 17-year-old with normal vitals is "watch"', async () => {
    const lakshmi = await executeTool(findBeneficiary, { name: 'Lakshmi' }, ctx());
    const id = lakshmi.ok ? lakshmi.data.matches[0].id : '';
    const r = await executeTool(recordVisit, { beneficiaryId: id, bpSys: 112, bpDia: 72, gestationWeeks: 20, symptoms: [] }, ctx());
    expect(r.ok && r.data.risk.level).toBe('watch');
  });

  it('rejects a speech-recognition slip (BP 999) without writing anything', async () => {
    const before = await db.query<{ n: string }>('select count(*) as n from visits');
    const r = await executeTool(recordVisit, { beneficiaryId: sunitaId, bpSys: 999, bpDia: 100, symptoms: [] }, ctx());
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe('BAD_INPUT');
    const after = await db.query<{ n: string }>('select count(*) as n from visits');
    expect(after[0].n).toBe(before[0].n);
  });

  it('asks for data when nothing was measured', async () => {
    const r = await executeTool(recordVisit, { beneficiaryId: sunitaId, symptoms: [] }, ctx());
    expect(!r.ok && r.code).toBe('NOTHING_TO_RECORD');
  });

  it('refuses another ASHA\'s beneficiary', async () => {
    const r = await executeTool(recordVisit, { beneficiaryId: sunitaId, bpSys: 120, bpDia: 80, symptoms: [] }, ctx({ ashaId: otherAshaId }));
    expect(!r.ok && r.code).toBe('NOT_FOUND');
  });
});

describe('alerts: draft, confirm, send once', () => {
  let visitId = '';
  let token = '';

  it('draft sends nothing and shows a preview', async () => {
    const v = await db.query<{ id: string }>('select id from visits where beneficiary_id = $1 order by visited_at desc limit 1', [sunitaId]);
    visitId = v[0].id;
    const r = await executeTool(draftAlert, { visitId }, ctx());
    expect(r.ok).toBe(true);
    if (!r.ok || r.data.alreadySent) return;
    token = r.data.token;
    expect(sent).toHaveLength(0);
    expect(r.data.preview).toContain('HIGH RISK: ANC visit');
    expect(r.data.preview).toContain('BP 150/100');
    expect(r.data.to.phone).toMatch(/0001$/);
    expect(r.data.to.phone).not.toContain('+9199999');
  });

  it('drafting again returns the same open draft', async () => {
    const r = await executeTool(draftAlert, { visitId }, ctx());
    expect(r.ok && !r.data.alreadySent && r.data.token).toBe(token);
  });

  it('a failed send keeps the draft and can be retried', async () => {
    failNext = true;
    const r = await executeTool(sendAlert, { token }, ctx());
    expect(!r.ok && r.code).toBe('SEND_FAILED');
    const row = await db.query<{ status: string; error: string }>('select status, error from alerts where confirm_token = $1', [token]);
    expect(row[0].status).toBe('failed');
    expect(row[0].error).toContain('provider down');
  });

  it('sends exactly once, even if "haan" is said twice or two calls race', async () => {
    const [a, b, c] = await Promise.all([
      executeTool(sendAlert, { token }, ctx()),
      executeTool(sendAlert, { token }, ctx()),
      executeTool(sendAlert, { token }, ctx()),
    ]);
    expect([a, b, c].every((r) => r.ok)).toBe(true);
    expect(sent).toHaveLength(1);
    const flags = [a, b, c].map((r) => r.ok && r.data.alreadySent);
    expect(flags.filter((f) => f === false)).toHaveLength(1);
    const again = await executeTool(sendAlert, { token }, ctx());
    expect(again.ok && again.data.alreadySent).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('after sending, a new draft for the same visit says it was already sent', async () => {
    const r = await executeTool(draftAlert, { visitId }, ctx());
    expect(r.ok && r.data.alreadySent).toBe(true);
  });

  it('rejects an unknown token and an expired draft', async () => {
    const unknown = await executeTool(sendAlert, { token: 'nope1234' }, ctx());
    expect(!unknown.ok && unknown.code).toBe('NO_DRAFT');

    const v2 = await executeTool(recordVisit, { beneficiaryId: sunitaId, bpSys: 154, bpDia: 102, symptoms: [] }, ctx({ sessionId: 'call-2' }));
    const id2 = v2.ok ? v2.data.visitId : '';
    const d = await executeTool(draftAlert, { visitId: id2 }, ctx());
    const t2 = d.ok && !d.data.alreadySent ? d.data.token : '';
    await db.query(`update alerts set expires_at = now() - interval '1 minute' where confirm_token = $1`, [t2]);
    const late = await executeTool(sendAlert, { token: t2 }, ctx());
    expect(!late.ok && late.code).toBe('EXPIRED');
    expect(sent).toHaveLength(1);
  });

  it('cannot draft for a doctor that has no phone', async () => {
    const mom = await insertBeneficiary(db, { ashaId: otherAshaId, name: 'Test Mom' });
    const v = await executeTool(recordVisit, { beneficiaryId: mom.id, bpSys: 150, bpDia: 100, symptoms: [] }, ctx({ ashaId: otherAshaId }));
    const r = await executeTool(draftAlert, { visitId: v.ok ? v.data.visitId : '' }, ctx({ ashaId: otherAshaId }));
    expect(!r.ok && r.code).toBe('NO_DOCTOR');
  });
});

describe('follow-ups, history, summary, events', () => {
  it('books a follow-up and shows it in today\'s summary', async () => {
    const f = await executeTool(scheduleFollowUp, { beneficiaryId: sunitaId, inDays: 3, reason: 'recheck BP' }, ctx());
    expect(f.ok && f.data.reason).toBe('recheck BP');
    const s = await executeTool(todaySummary, {}, ctx());
    expect(s.ok && s.data.followUps).toBe(1);
    expect(s.ok && s.data.highRisk).toBeGreaterThanOrEqual(1);
    expect(s.ok && s.data.alertsSent).toBe(1);
    expect(s.ok && s.data.due[0].name).toBe('Sunita Devi');
  });

  it('rejects a follow-up beyond 30 days', async () => {
    const r = await executeTool(scheduleFollowUp, { beneficiaryId: sunitaId, inDays: 90 }, ctx());
    expect(!r.ok && r.code).toBe('BAD_INPUT');
  });

  it('returns recent history', async () => {
    const r = await executeTool(getBeneficiaryHistory, { beneficiaryId: sunitaId }, ctx());
    expect(r.ok && r.data.visits.length).toBeGreaterThanOrEqual(1);
    expect(r.ok && r.data.visits[0].bp).toMatch(/^1\d\d\/\d+$/);
  });

  it('logs every call, including failures, tied to the call (session)', async () => {
    const events = await listEvents(db, { sessionId: 'call-1' });
    const names = events.map((e) => e.name);
    expect(names).toContain('findBeneficiary');
    expect(names).toContain('recordVisit');
    expect(events.some((e) => !e.ok)).toBe(true);
    expect(events.every((e) => typeof e.ms === 'number')).toBe(true);
  });
});

describe('weeksFromLmp', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  it('computes whole weeks', () => expect(weeksFromLmp('2026-05-08', now)).toBe(28));
  it('returns null for implausible values', () => {
    expect(weeksFromLmp('2026-11-15', now)).toBeNull();
    expect(weeksFromLmp('2025-01-01', now)).toBeNull();
    expect(weeksFromLmp(null, now)).toBeNull();
  });
});

sent = [];
