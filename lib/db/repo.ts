import type { Db } from './client';
import { RiskReason, type RiskLevel, type Risk } from '@/lib/schemas';
import { z } from 'zod';

// All SQL lives here. Every function takes a Db, so production uses Neon and tests use embedded Postgres.

// ---------- types ----------
export type Asha = { id: string; name: string; phcName: string; doctorName: string | null; doctorPhone: string | null; language: 'hi' | 'kn' | 'en' };
export type Beneficiary = {
  id: string; ashaId: string; name: string; aliases: string[]; village: string | null;
  phone: string | null; age: number | null; parity: number | null; lmp: string | null;
};
export type Visit = {
  id: string; ashaId: string; beneficiaryId: string; sessionId: string | null; visitedAt: string;
  gestationWeeks: number | null; bpSys: number | null; bpDia: number | null; hb: number | null;
  symptoms: string[]; notes: string | null; riskLevel: RiskLevel; riskReasons: z.infer<typeof RiskReason>[]; rulesVersion: string;
};
export type Alert = {
  id: string; visitId: string; toName: string | null; toPhone: string | null; message: string;
  status: 'draft' | 'sent' | 'failed'; confirmToken: string; provider: string | null; providerId: string | null;
  error: string | null; createdAt: string; expiresAt: string; sentAt: string | null; smsText: string | null;
};
export type FollowUp = { id: string; ashaId: string; beneficiaryId: string; visitId: string | null; dueDate: string; reason: string | null; status: string };
export type EventRow = {
  id: number; sessionId: string | null; ashaId: string | null; turnId: string | null; type: string; name: string;
  input: unknown; output: unknown; ok: boolean; ms: number | null; createdAt: string;
};

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const dateOnly = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
const num = (v: unknown) => (v == null ? null : Number(v));

// ---------- row mappers ----------
const toAsha = (r: Row): Asha => ({
  id: String(r.id), name: String(r.name), phcName: String(r.phc_name),
  doctorName: (r.doctor_name as string) ?? null, doctorPhone: (r.doctor_phone as string) ?? null,
  language: r.language as Asha['language'],
});
const toBeneficiary = (r: Row): Beneficiary => ({
  id: String(r.id), ashaId: String(r.asha_id), name: String(r.name), aliases: (r.aliases as string[]) ?? [],
  village: (r.village as string) ?? null, phone: (r.phone as string) ?? null, age: num(r.age), parity: num(r.parity), lmp: dateOnly(r.lmp),
});
const toVisit = (r: Row): Visit => ({
  id: String(r.id), ashaId: String(r.asha_id), beneficiaryId: String(r.beneficiary_id), sessionId: (r.session_id as string) ?? null,
  visitedAt: iso(r.visited_at)!, gestationWeeks: num(r.gestation_weeks), bpSys: num(r.bp_sys), bpDia: num(r.bp_dia), hb: num(r.hb),
  symptoms: (r.symptoms as string[]) ?? [], notes: (r.notes as string) ?? null, riskLevel: r.risk_level as RiskLevel,
  riskReasons: z.array(RiskReason).catch([]).parse(typeof r.risk_reasons === 'string' ? JSON.parse(r.risk_reasons) : r.risk_reasons),
  rulesVersion: String(r.rules_version),
});
const toAlert = (r: Row): Alert => ({
  id: String(r.id), visitId: String(r.visit_id), toName: (r.to_name as string) ?? null, toPhone: (r.to_phone as string) ?? null,
  message: String(r.message), status: r.status as Alert['status'], confirmToken: String(r.confirm_token),
  provider: (r.provider as string) ?? null, providerId: (r.provider_id as string) ?? null, error: (r.error as string) ?? null,
  createdAt: iso(r.created_at)!, expiresAt: iso(r.expires_at)!, sentAt: iso(r.sent_at), smsText: (r.sms_text as string) ?? null,
});
const toFollowUp = (r: Row): FollowUp => ({
  id: String(r.id), ashaId: String(r.asha_id), beneficiaryId: String(r.beneficiary_id), visitId: (r.visit_id as string) ?? null,
  dueDate: dateOnly(r.due_date)!, reason: (r.reason as string) ?? null, status: String(r.status),
});
const toEvent = (r: Row): EventRow => ({
  id: Number(r.id), sessionId: (r.session_id as string) ?? null, ashaId: (r.asha_id as string) ?? null, turnId: (r.turn_id as string) ?? null,
  type: String(r.type), name: String(r.name), input: r.input ?? null, output: r.output ?? null, ok: Boolean(r.ok), ms: num(r.ms), createdAt: iso(r.created_at)!,
});

// ---------- ASHA ----------
export async function getAsha(db: Db, id: string): Promise<Asha | null> {
  const rows = await db.query<Row>('select * from ashas where id = $1', [id]);
  return rows[0] ? toAsha(rows[0]) : null;
}
export async function firstAsha(db: Db): Promise<Asha | null> {
  const rows = await db.query<Row>('select * from ashas where not is_demo order by created_at asc limit 1');
  return rows[0] ? toAsha(rows[0]) : null;
}

/** The ASHA behind the most recent tool call. The projector dashboard follows whoever is currently using the app. */
export async function mostRecentlyActiveAshaId(db: Db): Promise<string | null> {
  const rows = await db.query<{ asha_id: string | null }>('select asha_id from events where asha_id is not null order by id desc limit 1');
  return rows[0]?.asha_id ?? null;
}

// ---------- beneficiaries ----------
export async function getBeneficiary(db: Db, ashaId: string, id: string): Promise<Beneficiary | null> {
  const rows = await db.query<Row>('select * from beneficiaries where id = $1 and asha_id = $2', [id, ashaId]);
  return rows[0] ? toBeneficiary(rows[0]) : null;
}

export async function listBeneficiaries(db: Db, ashaId: string): Promise<Beneficiary[]> {
  const rows = await db.query<Row>('select * from beneficiaries where asha_id = $1 order by name asc', [ashaId]);
  return rows.map(toBeneficiary);
}

export async function insertBeneficiary(
  db: Db,
  b: { ashaId: string; name: string; aliases?: string[]; village?: string | null; phone?: string | null; age?: number | null; parity?: number | null; lmp?: string | null },
): Promise<Beneficiary> {
  const rows = await db.query<Row>(
    `insert into beneficiaries (asha_id, name, aliases, village, phone, age, parity, lmp)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [b.ashaId, b.name, b.aliases ?? [], b.village ?? null, b.phone ?? null, b.age ?? null, b.parity ?? null, b.lmp ?? null],
  );
  return toBeneficiary(rows[0]);
}

/** Fuzzy name match scoped to one ASHA. Uses pg_trgm; falls back to ILIKE if the extension is missing. */
export async function findBeneficiaries(db: Db, ashaId: string, name: string, village?: string): Promise<Array<Beneficiary & { score: number }>> {
  const villageClause = village ? 'and village ilike $3' : '';
  const params: unknown[] = village ? [ashaId, name, `%${village}%`] : [ashaId, name];
  const fuzzy = `
    select *, greatest(similarity(name, $2), coalesce((select max(similarity(a, $2)) from unnest(aliases) a), 0)) as score
    from beneficiaries
    where asha_id = $1 ${villageClause}
      and (name % $2 or name ilike '%' || $2 || '%'
           or exists (select 1 from unnest(aliases) a where a % $2 or a ilike '%' || $2 || '%'))
    order by score desc, name asc limit 5`;
  const plain = `
    select *, 0.5 as score from beneficiaries
    where asha_id = $1 ${villageClause}
      and (name ilike '%' || $2 || '%' or exists (select 1 from unnest(aliases) a where a ilike '%' || $2 || '%'))
    order by name asc limit 5`;
  let rows: Row[];
  try {
    rows = await db.query<Row>(fuzzy, params);
  } catch {
    rows = await db.query<Row>(plain, params);
  }
  return rows.map((r) => ({ ...toBeneficiary(r), score: Number(r.score) }));
}

// ---------- visits ----------
export async function insertVisit(
  db: Db,
  v: {
    ashaId: string; beneficiaryId: string; sessionId?: string | null; gestationWeeks?: number | null; bpSys?: number | null; bpDia?: number | null;
    hb?: number | null; symptoms: string[]; notes?: string | null; risk: Risk;
  },
): Promise<Visit> {
  const rows = await db.query<Row>(
    `insert into visits (asha_id, beneficiary_id, session_id, gestation_weeks, bp_sys, bp_dia, hb, symptoms, notes, risk_level, risk_reasons, rules_version)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) returning *`,
    [v.ashaId, v.beneficiaryId, v.sessionId ?? null, v.gestationWeeks ?? null, v.bpSys ?? null, v.bpDia ?? null, v.hb ?? null,
     [...v.symptoms].sort(), v.notes ?? null, v.risk.level, JSON.stringify(v.risk.reasons), v.risk.rulesVersion],
  );
  return toVisit(rows[0]);
}

/** The same report repeated within 2 minutes in the same call (Agora retry, or the model calling twice) returns the first visit. */
export async function findRecentDuplicateVisit(
  db: Db,
  v: { sessionId?: string | null; beneficiaryId: string; bpSys?: number | null; bpDia?: number | null; hb?: number | null; symptoms: string[] },
): Promise<Visit | null> {
  if (!v.sessionId) return null;
  const rows = await db.query<Row>(
    `select * from visits
     where session_id = $1 and beneficiary_id = $2
       and bp_sys is not distinct from $3 and bp_dia is not distinct from $4 and hb is not distinct from $5
       and symptoms = $6 and visited_at > now() - interval '2 minutes'
     order by visited_at desc limit 1`,
    [v.sessionId, v.beneficiaryId, v.bpSys ?? null, v.bpDia ?? null, v.hb ?? null, [...v.symptoms].sort()],
  );
  return rows[0] ? toVisit(rows[0]) : null;
}

export async function getVisit(db: Db, ashaId: string, id: string): Promise<Visit | null> {
  const rows = await db.query<Row>('select * from visits where id = $1 and asha_id = $2', [id, ashaId]);
  return rows[0] ? toVisit(rows[0]) : null;
}

/** Rewrite the measured facts and the rules result of one visit. rules_version comes from the fresh assessment; visited_at and session stay. */
export async function updateVisitFacts(
  db: Db,
  ashaId: string,
  id: string,
  v: { gestationWeeks: number | null; bpSys: number | null; bpDia: number | null; hb: number | null; symptoms: string[]; notes: string | null; risk: Risk },
): Promise<Visit | null> {
  const rows = await db.query<Row>(
    `update visits set gestation_weeks = $3, bp_sys = $4, bp_dia = $5, hb = $6, symptoms = $7, notes = $8,
       risk_level = $9, risk_reasons = $10::jsonb, rules_version = $11
     where id = $1 and asha_id = $2 returning *`,
    [id, ashaId, v.gestationWeeks, v.bpSys, v.bpDia, v.hb, [...v.symptoms].sort(), v.notes, v.risk.level, JSON.stringify(v.risk.reasons), v.risk.rulesVersion],
  );
  return rows[0] ? toVisit(rows[0]) : null;
}

/** Make every unsent alert (draft or failed) of a visit unsendable, so a stale message cannot go out after a correction. Returns how many. */
export async function expireUnsentAlertsForVisit(db: Db, visitId: string): Promise<number> {
  const rows = await db.query<Row>(
    `update alerts set expires_at = now() - interval '1 second' where visit_id = $1 and status in ('draft', 'failed') and expires_at > now() returning id`,
    [visitId],
  );
  return rows.length;
}

export async function recentVisits(db: Db, beneficiaryId: string, limit = 3): Promise<Visit[]> {
  const rows = await db.query<Row>('select * from visits where beneficiary_id = $1 order by visited_at desc limit $2', [beneficiaryId, limit]);
  return rows.map(toVisit);
}

// ---------- alerts (two-phase, idempotent) ----------
export async function insertAlertDraft(
  db: Db,
  a: { visitId: string; toName: string | null; toPhone: string | null; message: string; smsText?: string; token: string; ttlMinutes: number },
): Promise<Alert> {
  const rows = await db.query<Row>(
    `insert into alerts (visit_id, to_name, to_phone, message, sms_text, status, confirm_token, expires_at)
     values ($1,$2,$3,$4,$7,'draft',$5, now() + ($6 || ' minutes')::interval) returning *`,
    [a.visitId, a.toName, a.toPhone, a.message, a.token, String(a.ttlMinutes), a.smsText ?? null],
  );
  return toAlert(rows[0]);
}

export async function getAlertByToken(db: Db, token: string): Promise<Alert | null> {
  const rows = await db.query<Row>('select * from alerts where confirm_token = $1', [token]);
  return rows[0] ? toAlert(rows[0]) : null;
}

/**
 * Atomically claim a draft (or a previously failed alert) for sending. Only one caller can win:
 * a second "haan" finds the row already 'sent' and gets null back.
 */
export async function claimAlertForSending(db: Db, token: string): Promise<Alert | null> {
  const rows = await db.query<Row>(
    `update alerts set status = 'sent', sent_at = now(), error = null
     where confirm_token = $1 and status in ('draft', 'failed') and expires_at > now() returning *`,
    [token],
  );
  return rows[0] ? toAlert(rows[0]) : null;
}

export async function markAlertSent(db: Db, id: string, provider: string, providerId: string | null): Promise<Alert> {
  const rows = await db.query<Row>('update alerts set provider = $2, provider_id = $3 where id = $1 returning *', [id, provider, providerId]);
  return toAlert(rows[0]);
}

export async function markAlertFailed(db: Db, id: string, error: string): Promise<Alert> {
  const rows = await db.query<Row>(`update alerts set status = 'failed', sent_at = null, error = $2 where id = $1 returning *`, [id, error.slice(0, 500)]);
  return toAlert(rows[0]);
}

/** The newest alert of this ASHA that is still waiting to be sent (or failed and can be retried), within its time limit. */
export async function latestOpenAlertForAsha(db: Db, ashaId: string): Promise<Alert | null> {
  const rows = await db.query<Row>(
    `select a.* from alerts a join visits v on v.id = a.visit_id
      where v.asha_id = $1 and a.status in ('draft', 'failed') and a.expires_at > now()
      order by a.created_at desc limit 1`,
    [ashaId],
  );
  return rows[0] ? toAlert(rows[0]) : null;
}

export async function alertsForVisit(db: Db, visitId: string): Promise<Alert[]> {
  const rows = await db.query<Row>('select * from alerts where visit_id = $1 order by created_at desc', [visitId]);
  return rows.map(toAlert);
}

// ---------- follow-ups ----------
export async function insertFollowUp(
  db: Db,
  f: { ashaId: string; beneficiaryId: string; visitId?: string | null; inDays: number; reason?: string | null },
): Promise<FollowUp> {
  const rows = await db.query<Row>(
    `insert into followups (asha_id, beneficiary_id, visit_id, due_date, reason)
     values ($1,$2,$3, ((now() at time zone 'Asia/Kolkata')::date + $4::int), $5) returning *`,
    [f.ashaId, f.beneficiaryId, f.visitId ?? null, f.inDays, f.reason ?? null],
  );
  return toFollowUp(rows[0]);
}

export async function pendingFollowUps(db: Db, ashaId: string, withinDays = 7): Promise<Array<FollowUp & { beneficiaryName: string; village: string | null }>> {
  const rows = await db.query<Row>(
    `select f.*, b.name as beneficiary_name, b.village from followups f
     join beneficiaries b on b.id = f.beneficiary_id
     where f.asha_id = $1 and f.status = 'pending' and f.due_date <= (now() at time zone 'Asia/Kolkata')::date + $2::int
     order by f.due_date asc`,
    [ashaId, withinDays],
  );
  return rows.map((r) => ({ ...toFollowUp(r), beneficiaryName: String(r.beneficiary_name), village: (r.village as string) ?? null }));
}

/**
 * Pending follow-ups of this ASHA that are overdue (before `today`) or due within `days` days, earliest first.
 * `today` is YYYY-MM-DD in Asia/Kolkata. Scoped to the ASHA through both the follow-up and the mother.
 */
export async function upcomingFollowUps(
  db: Db,
  ashaId: string,
  opts: { today: string; days: number },
): Promise<Array<FollowUp & { beneficiaryName: string; village: string | null }>> {
  const rows = await db.query<Row>(
    `select f.*, b.name as beneficiary_name, b.village from followups f
     join beneficiaries b on b.id = f.beneficiary_id and b.asha_id = $1
     where f.asha_id = $1 and f.status = 'pending' and f.due_date <= $2::date + $3::int
     order by f.due_date asc, b.name asc
     limit 50`,
    [ashaId, opts.today, opts.days],
  );
  return rows.map((r) => ({ ...toFollowUp(r), beneficiaryName: String(r.beneficiary_name), village: (r.village as string) ?? null }));
}

export async function todayCounts(db: Db, ashaId: string): Promise<{ visits: number; highRisk: number; alertsSent: number; followUps: number }> {
  const rows = await db.query<Row>(
    `select
       (select count(*) from visits where asha_id = $1 and visited_at >= date_trunc('day', now())) as visits,
       (select count(*) from visits where asha_id = $1 and visited_at >= date_trunc('day', now()) and risk_level in ('high','urgent')) as high_risk,
       (select count(*) from alerts a join visits v on v.id = a.visit_id where v.asha_id = $1 and a.status = 'sent' and a.sent_at >= date_trunc('day', now())) as alerts_sent,
       (select count(*) from followups where asha_id = $1 and status = 'pending') as follow_ups`,
    [ashaId],
  );
  const r = rows[0];
  return { visits: Number(r.visits), highRisk: Number(r.high_risk), alertsSent: Number(r.alerts_sent), followUps: Number(r.follow_ups) };
}

// ---------- events ----------
export async function logEvent(
  db: Db,
  e: { sessionId?: string | null; ashaId?: string | null; turnId?: string | null; type: string; name: string; input?: unknown; output?: unknown; ok: boolean; ms?: number },
): Promise<void> {
  await db.query(
    `insert into events (session_id, asha_id, turn_id, type, name, input, output, ok, ms)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
    [e.sessionId ?? null, e.ashaId ?? null, e.turnId ?? null, e.type, e.name,
     e.input === undefined ? null : JSON.stringify(e.input), e.output === undefined ? null : JSON.stringify(e.output), e.ok, e.ms ?? null],
  );
}

export async function listEvents(db: Db, opts: { sessionId?: string | null; ashaId?: string | null; afterId?: number; limit?: number }): Promise<EventRow[]> {
  const where: string[] = ['id > $1'];
  const params: unknown[] = [opts.afterId ?? 0];
  if (opts.sessionId) { params.push(opts.sessionId); where.push(`session_id = $${params.length}`); }
  if (opts.ashaId) { params.push(opts.ashaId); where.push(`asha_id = $${params.length}`); }
  params.push(Math.min(opts.limit ?? 50, 200));
  const rows = await db.query<Row>(`select * from events where ${where.join(' and ')} order by id asc limit $${params.length}`, params);
  return rows.map(toEvent);
}

/** Highest event id for a call (or ASHA). Every state change goes through a tool call that logs an event, so this is a cheap "has anything changed?" check. */
export async function eventsCursor(db: Db, opts: { sessionId?: string | null; ashaId: string }): Promise<number> {
  const rows = await db.query<{ c: string | number }>(
    'select coalesce(max(id), 0) as c from events where asha_id = $1 and ($2::text is null or session_id = $2)',
    [opts.ashaId, opts.sessionId ?? null],
  );
  return Number(rows[0]?.c ?? 0);
}

/** Highest event id across everything: the projector dashboard's "has anything happened anywhere?" check. */
export async function globalEventsCursor(db: Db): Promise<number> {
  const rows = await db.query<{ c: string | number }>('select coalesce(max(id), 0) as c from events');
  return Number(rows[0]?.c ?? 0);
}

/** The visit most recently recorded in a call (or, with no session, the ASHA's most recent visit). */
export async function latestVisit(db: Db, opts: { sessionId?: string | null; ashaId?: string | null }): Promise<Visit | null> {
  const rows = opts.sessionId
    ? opts.ashaId
      ? await db.query<Row>('select * from visits where session_id = $1 and asha_id = $2 order by visited_at desc limit 1', [opts.sessionId, opts.ashaId])
      : await db.query<Row>('select * from visits where session_id = $1 order by visited_at desc limit 1', [opts.sessionId])
    : opts.ashaId
      ? await db.query<Row>('select * from visits where asha_id = $1 order by visited_at desc limit 1', [opts.ashaId])
      : await db.query<Row>('select * from visits order by visited_at desc limit 1');
  return rows[0] ? toVisit(rows[0]) : null;
}
