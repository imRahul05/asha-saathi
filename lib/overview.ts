import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import {
  eventsCursor,
  firstAsha,
  getAsha,
  listBeneficiaries,
  listEvents,
  mostRecentlyActiveAshaId,
  todayCounts,
  upcomingFollowUps,
  type Asha,
  type Beneficiary,
  type EventRow,
} from '@/lib/db/repo';
import { dateColumnToIso, daysBetween, todayInIndia } from '@/lib/dates';
import { RiskReason, type RiskLevel } from '@/lib/schemas';
import { describeEvent } from '@/lib/snapshot';
import type { SnapshotEvent, SnapshotScheduleItem, SnapshotVisit } from '@/lib/snapshot-types';
import type {
  AshaOverview,
  DoctorOverview,
  DoctorVisitCase,
  PatientNextFollowUp,
  PatientSummary,
  PatientVisitSummary,
} from '@/lib/overview-types';

interface VisitDbRow {
  id: string;
  asha_id: string;
  beneficiary_id: string;
  session_id: string | null;
  visited_at: Date | string;
  gestation_weeks: number | string | null;
  bp_sys: number | string | null;
  bp_dia: number | string | null;
  hb: number | string | null;
  symptoms: string[] | null;
  risk_level: RiskLevel;
  risk_reasons: string | RiskReason[];
  rules_version: string;
}

interface ParsedVisit {
  id: string;
  ashaId: string;
  beneficiaryId: string;
  sessionId: string | null;
  visitedAt: string;
  gestationWeeks: number | null;
  bpSys: number | null;
  bpDia: number | null;
  hb: number | null;
  symptoms: string[];
  riskLevel: RiskLevel;
  riskReasons: SnapshotVisit['risk']['reasons'];
  rulesVersion: string;
}

interface AlertDbRow {
  visit_id: string;
  status: 'draft' | 'sent' | 'failed';
  provider: string | null;
  to_name: string | null;
  message: string;
  sent_at: Date | string | null;
  error: string | null;
}

interface VisitFollowUpDbRow {
  visit_id: string;
  due_date: Date | string;
  reason: string | null;
}

interface PendingFollowUpDbRow {
  id: string;
  beneficiary_id: string;
  due_date: Date | string;
  reason: string | null;
}

interface DoctorCallInput {
  role?: string;
  event?: string;
}

interface SessionEventDbRow {
  session_id: string | null;
  name: string;
  input: DoctorCallInput | null;
  created_at: Date | string;
}

const riskReasonListSchema = z.array(RiskReason).catch([]);

function toIsoString(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function toNullableIso(v: Date | string | null): string | null {
  return v === null ? null : toIsoString(v);
}

function toNullableNumber(v: number | string | null): number | null {
  return v === null ? null : Number(v);
}

function parseVisitRow(r: VisitDbRow): ParsedVisit {
  const rawReasons = typeof r.risk_reasons === 'string' ? (JSON.parse(r.risk_reasons) as RiskReason[]) : r.risk_reasons;
  const parsedReasons = riskReasonListSchema.parse(rawReasons);
  return {
    id: String(r.id),
    ashaId: String(r.asha_id),
    beneficiaryId: String(r.beneficiary_id),
    sessionId: r.session_id,
    visitedAt: toIsoString(r.visited_at),
    gestationWeeks: toNullableNumber(r.gestation_weeks),
    bpSys: toNullableNumber(r.bp_sys),
    bpDia: toNullableNumber(r.bp_dia),
    hb: toNullableNumber(r.hb),
    symptoms: r.symptoms ?? [],
    riskLevel: r.risk_level,
    riskReasons: parsedReasons.map((reason) => ({
      code: reason.code,
      text: reason.text,
      level: reason.level,
      citation: reason.evidence.status === 'cited' ? { label: reason.evidence.label, page: reason.evidence.page } : null,
    })),
    rulesVersion: String(r.rules_version),
  };
}

function toVisitSummary(v: ParsedVisit): PatientVisitSummary {
  return {
    id: v.id,
    visitedAt: v.visitedAt,
    gestationWeeks: v.gestationWeeks,
    bpSys: v.bpSys,
    bpDia: v.bpDia,
    hb: v.hb,
    symptoms: v.symptoms,
    riskLevel: v.riskLevel,
    riskReasons: v.riskReasons,
  };
}

function estimateGestationWeeks(latestVisitWeeks: number | null, lmp: string | null, today: string): number | null {
  if (latestVisitWeeks !== null) return latestVisitWeeks;
  if (!lmp) return null;
  const days = daysBetween(lmp, today);
  if (!Number.isFinite(days)) return null;
  const weeks = Math.floor(days / 7);
  return Math.max(1, Math.min(44, weeks));
}

function followUpStatus(today: string, dueDate: string): 'overdue' | 'today' | 'upcoming' {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}

function riskPriority(level: RiskLevel | undefined): number {
  if (level === 'urgent') return 0;
  if (level === 'high') return 1;
  return 2;
}

function followUpPriority(status: 'overdue' | 'today' | 'upcoming' | undefined): number {
  if (status === 'overdue') return 0;
  if (status === 'today') return 1;
  return 2;
}

function comparePatients(a: PatientSummary, b: PatientSummary): number {
  const riskDiff = riskPriority(a.latestVisit?.riskLevel) - riskPriority(b.latestVisit?.riskLevel);
  if (riskDiff !== 0) return riskDiff;

  const fuDiff = followUpPriority(a.nextFollowUp?.status) - followUpPriority(b.nextFollowUp?.status);
  if (fuDiff !== 0) return fuDiff;

  const pendingDiff = (a.visitedToday ? 1 : 0) - (b.visitedToday ? 1 : 0);
  if (pendingDiff !== 0) return pendingDiff;

  return a.name.localeCompare(b.name);
}

interface AshaBaseData {
  beneficiaries: Beneficiary[];
  visits: ParsedVisit[];
  patients: PatientSummary[];
  schedule: SnapshotScheduleItem[];
  counts: { visits: number; highRisk: number; alertsSent: number; followUps: number };
  today: string;
}

async function loadAshaBaseData(db: Db, ashaId: string): Promise<AshaBaseData> {
  const today = todayInIndia();
  const [beneficiaries, visitRows, pendingFollowUpRows, due, counts] = await Promise.all([
    listBeneficiaries(db, ashaId),
    db.query<VisitDbRow>(
      `select id, asha_id, beneficiary_id, session_id, visited_at, gestation_weeks, bp_sys, bp_dia, hb, symptoms, risk_level, risk_reasons, rules_version
       from visits
       where asha_id = $1
       order by visited_at desc`,
      [ashaId],
    ),
    db.query<PendingFollowUpDbRow>(
      `select id, beneficiary_id, due_date, reason
       from followups
       where asha_id = $1 and status = 'pending'
       order by due_date asc, created_at asc`,
      [ashaId],
    ),
    upcomingFollowUps(db, ashaId, { today, days: 60 }),
    todayCounts(db, ashaId),
  ]);

  const visits = visitRows.map(parseVisitRow);

  const visitsByBeneficiary = new Map<string, ParsedVisit[]>();
  for (const v of visits) {
    const list = visitsByBeneficiary.get(v.beneficiaryId);
    if (list) list.push(v);
    else visitsByBeneficiary.set(v.beneficiaryId, [v]);
  }

  const nextFollowUpByBeneficiary = new Map<string, PatientNextFollowUp>();
  for (const row of pendingFollowUpRows) {
    if (nextFollowUpByBeneficiary.has(row.beneficiary_id)) continue;
    const dueDate = dateColumnToIso(row.due_date);
    if (!dueDate) continue;
    nextFollowUpByBeneficiary.set(row.beneficiary_id, {
      id: String(row.id),
      dueDate,
      reason: row.reason,
      status: followUpStatus(today, dueDate),
    });
  }

  const patients: PatientSummary[] = beneficiaries
    .map((b) => {
      const motherVisits = visitsByBeneficiary.get(b.id) ?? [];
      const latest = motherVisits[0] ?? null;
      const visitedToday = latest !== null && todayInIndia(new Date(latest.visitedAt)) === today;
      return {
        id: b.id,
        name: b.name,
        village: b.village,
        age: b.age,
        parity: b.parity,
        gestationWeeks: estimateGestationWeeks(latest?.gestationWeeks ?? null, b.lmp, today),
        visitedToday,
        latestVisit: latest ? toVisitSummary(latest) : null,
        recentVisits: motherVisits.slice(0, 5).map(toVisitSummary),
        nextFollowUp: nextFollowUpByBeneficiary.get(b.id) ?? null,
      };
    })
    .sort(comparePatients);

  const schedule: SnapshotScheduleItem[] = due.map((f) => ({
    id: f.id,
    dueDate: f.dueDate,
    beneficiary: { name: f.beneficiaryName, village: f.village },
    reason: f.reason,
    status: followUpStatus(today, f.dueDate),
  }));

  return { beneficiaries, visits, patients, schedule, counts, today };
}

export async function getAshaOverview(db: Db, ashaId: string): Promise<AshaOverview | null> {
  const asha = await getAsha(db, ashaId);
  if (!asha) return null;
  const base = await loadAshaBaseData(db, asha.id);
  return {
    asha: {
      name: asha.name,
      phcName: asha.phcName,
      doctorName: asha.doctorName,
      language: asha.language,
    },
    counts: base.counts,
    schedule: base.schedule,
    patients: base.patients,
    serverTime: new Date().toISOString(),
  };
}

async function resolveDoctorTargetAsha(db: Db, ashaId?: string | null): Promise<Asha | null> {
  if (ashaId) {
    const direct = await getAsha(db, ashaId);
    if (direct) return direct;
  }
  const activeId = await mostRecentlyActiveAshaId(db);
  if (activeId) {
    const active = await getAsha(db, activeId);
    if (active) return active;
  }
  return firstAsha(db);
}

export async function getDoctorOverview(db: Db, ashaId?: string | null): Promise<DoctorOverview> {
  const asha = await resolveDoctorTargetAsha(db, ashaId);
  if (!asha) {
    return {
      doctor: { name: 'Dr. Rao', phcName: 'PHC' },
      asha: null,
      counts: {
        visits: 0,
        highRisk: 0,
        alertsSent: 0,
        followUps: 0,
        overdueFollowUps: 0,
        totalPatients: 0,
      },
      cases: [],
      schedule: [],
      patients: [],
      events: [],
      serverTime: new Date().toISOString(),
      cursor: 0,
    };
  }

  const [base, cursor, rawEvents] = await Promise.all([
    loadAshaBaseData(db, asha.id),
    eventsCursor(db, { ashaId: asha.id }),
    listEvents(db, { ashaId: asha.id, limit: 200 }),
  ]);

  const caseVisits = base.visits.slice(0, 30);
  const visitIds = caseVisits.map((v) => v.id);
  const sessionIds = Array.from(new Set(caseVisits.map((v) => v.sessionId).filter((s): s is string => s !== null)));

  const [alertRows, visitFollowUpRows, sessionEventRows] = await Promise.all([
    visitIds.length > 0
      ? db.query<AlertDbRow>(
          `select visit_id, status, provider, to_name, message, sent_at, error
           from alerts
           where visit_id = any($1::uuid[])
           order by created_at desc`,
          [visitIds],
        )
      : Promise.resolve<AlertDbRow[]>([]),
    visitIds.length > 0
      ? db.query<VisitFollowUpDbRow>(
          `select visit_id, due_date, reason
           from followups
           where visit_id = any($1::uuid[])
           order by created_at desc`,
          [visitIds],
        )
      : Promise.resolve<VisitFollowUpDbRow[]>([]),
    sessionIds.length > 0
      ? db.query<SessionEventDbRow>(
          `select session_id, name, input, created_at
           from events
           where asha_id = $1 and session_id = any($2::text[]) and name in ('doctorCall', 'holdAlert') and ok
           order by id asc`,
          [asha.id, sessionIds],
        )
      : Promise.resolve<SessionEventDbRow[]>([]),
  ]);

  const alertsByVisit = new Map<string, AlertDbRow[]>();
  for (const row of alertRows) {
    const list = alertsByVisit.get(row.visit_id);
    if (list) list.push(row);
    else alertsByVisit.set(row.visit_id, [row]);
  }

  const followUpByVisit = new Map<string, { dueDate: string; reason: string | null }>();
  for (const row of visitFollowUpRows) {
    if (followUpByVisit.has(row.visit_id)) continue;
    const dueDate = dateColumnToIso(row.due_date);
    if (!dueDate) continue;
    followUpByVisit.set(row.visit_id, { dueDate, reason: row.reason });
  }

  const doctorCallsBySession = new Map<string, SessionEventDbRow[]>();
  const holdAlertTimesBySession = new Map<string, number[]>();
  for (const ev of sessionEventRows) {
    if (!ev.session_id) continue;
    if (ev.name === 'doctorCall') {
      const list = doctorCallsBySession.get(ev.session_id);
      if (list) list.push(ev);
      else doctorCallsBySession.set(ev.session_id, [ev]);
    } else if (ev.name === 'holdAlert') {
      const ts = Date.parse(toIsoString(ev.created_at));
      const list = holdAlertTimesBySession.get(ev.session_id);
      if (list) list.push(ts);
      else holdAlertTimesBySession.set(ev.session_id, [ts]);
    }
  }

  const beneficiaryById = new Map<string, Beneficiary>();
  for (const b of base.beneficiaries) {
    beneficiaryById.set(b.id, b);
  }

  const recentVisitsByBeneficiary = new Map<string, PatientVisitSummary[]>();
  for (const p of base.patients) {
    recentVisitsByBeneficiary.set(p.id, p.recentVisits);
  }

  const cases: DoctorVisitCase[] = caseVisits.map((v) => {
    const b = beneficiaryById.get(v.beneficiaryId);
    const visitAlerts = alertsByVisit.get(v.id) ?? [];
    const chosenAlert = visitAlerts.find((a) => a.status === 'sent') ?? visitAlerts[0] ?? null;

    const calls = v.sessionId ? (doctorCallsBySession.get(v.sessionId) ?? []) : [];
    const doctorJoin = calls.find((c) => c.input?.role === 'doctor' && c.input?.event === 'joined');
    const call: SnapshotVisit['call'] = {
      doctorJoinedAt: doctorJoin ? toIsoString(doctorJoin.created_at) : null,
      lastEventAt: calls.length > 0 ? toIsoString(calls[calls.length - 1].created_at) : null,
    };

    const visitTs = Date.parse(v.visitedAt);
    const holdTimes = v.sessionId ? (holdAlertTimesBySession.get(v.sessionId) ?? []) : [];
    const alertHeld = holdTimes.some((ts) => ts >= visitTs);

    const parity = b?.parity ?? null;
    return {
      id: v.id,
      visitedAt: v.visitedAt,
      beneficiary: {
        id: v.beneficiaryId,
        name: b?.name ?? '',
        village: b?.village ?? null,
        weeks: estimateGestationWeeks(v.gestationWeeks, b?.lmp ?? null, base.today),
        age: b?.age ?? null,
        firstPregnancy: parity === null ? null : parity === 0,
      },
      ashaName: asha.name,
      vitals: {
        bpSys: v.bpSys,
        bpDia: v.bpDia,
        hb: v.hb,
        symptoms: v.symptoms,
      },
      risk: {
        level: v.riskLevel,
        rulesVersion: v.rulesVersion,
        reasons: v.riskReasons,
      },
      alert: chosenAlert
        ? {
            status: chosenAlert.status,
            channel: chosenAlert.provider,
            doctor: chosenAlert.to_name ?? asha.doctorName ?? null,
            phc: asha.phcName,
            message: chosenAlert.message,
            sentAt: toNullableIso(chosenAlert.sent_at),
            error: chosenAlert.error,
          }
        : null,
      call,
      alertHeld,
      doctor: asha.doctorName ?? null,
      followUp: followUpByVisit.get(v.id) ?? null,
      recentVisits: recentVisitsByBeneficiary.get(v.beneficiaryId) ?? [],
    };
  });

  const overdueFollowUps = base.schedule.filter((item) => item.status === 'overdue').length;
  const toEvent = (e: EventRow): SnapshotEvent => ({
    id: e.id,
    name: e.name,
    ok: e.ok,
    ms: e.ms,
    note: describeEvent(e),
    at: e.createdAt,
  });

  return {
    doctor: {
      name: asha.doctorName ?? 'Dr. Rao',
      phcName: asha.phcName,
    },
    asha: {
      id: asha.id,
      name: asha.name,
      phcName: asha.phcName,
    },
    counts: {
      ...base.counts,
      overdueFollowUps,
      totalPatients: base.patients.length,
    },
    cases,
    schedule: base.schedule,
    patients: base.patients,
    events: rawEvents.slice(-12).map(toEvent),
    serverTime: new Date().toISOString(),
    cursor,
  };
}
