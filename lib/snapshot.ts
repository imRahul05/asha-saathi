import type { Db } from '@/lib/db/client';
import { alertsForVisit, eventsCursor, firstAsha, getAsha, latestVisit, listEvents, mostRecentlyActiveAshaId, todayCounts, type EventRow, type Visit } from '@/lib/db/repo';
import type { Snapshot, SnapshotEvent, SnapshotRemaining, SnapshotVisit } from '@/lib/snapshot-types';

type Row = Record<string, unknown>;

/** One-line, human description of what a tool call did, for the timeline. Derived from recorded input/output. */
export function describeEvent(e: Pick<EventRow, 'name' | 'ok' | 'input' | 'output'>): string {
  const out = (e.output ?? {}) as Record<string, unknown>;
  const inp = (e.input ?? {}) as Record<string, unknown>;
  if (!e.ok) return String(out.code ?? 'failed');
  switch (e.name) {
    case 'findBeneficiary': return `“${String(inp.name ?? '')}” → ${Number(out.count ?? 0)} match${out.count === 1 ? '' : 'es'}`;
    case 'recordVisit': return `risk: ${String((out.risk as { level?: string } | undefined)?.level ?? '')}${out.duplicate ? ' (already saved)' : ''}`;
    case 'amendLastVisit': {
      const alert = out.alert === 'already_sent' ? ', alert already sent with old values' : out.alert === 'draft_cancelled' ? ', old draft cancelled' : '';
      return `corrected, risk: ${String((out.risk as { level?: string } | undefined)?.level ?? '')}${alert}`;
    }
    case 'draftAlert': return out.alreadySent ? 'already sent' : 'draft ready, waiting for “haan”';
    case 'sendAlert': return out.alreadySent ? 'already sent' : `sent via ${String(out.provider ?? '')}`;
    case 'scheduleFollowUp': return `+${String(inp.inDays ?? '')} days`;
    case 'todaySummary': return `${Number(out.visits ?? 0)} visits today`;
    case 'searchGuidelines': {
      const ps = Array.isArray(out.passages) ? (out.passages as Array<{ source?: string; page?: string }>) : [];
      return ps.length ? `source: ${ps[0].source ?? ''}, p.${ps[0].page ?? ''}` : 'no guideline found, referred to MO';
    }
    case 'getBeneficiaryHistory': return `${Array.isArray(out.visits) ? out.visits.length : 0} earlier visits`;
    default: return '';
  }
}

async function toSnapshotVisit(db: Db, v: Visit, ashaName: { doctor: string | null; phc: string | null } | null): Promise<SnapshotVisit> {
  const rows = await db.query<Row>('select * from beneficiaries where id = $1', [v.beneficiaryId]);
  const b = rows[0];
  const alerts = await alertsForVisit(db, v.id);
  // Prefer a sent alert, then the newest draft/failed one.
  const alert = alerts.find((a) => a.status === 'sent') ?? alerts[0] ?? null;
  const fu = await db.query<Row>('select due_date, reason from followups where visit_id = $1 order by created_at desc limit 1', [v.id]);
  const parity = b?.parity == null ? null : Number(b.parity);
  return {
    id: v.id,
    visitedAt: v.visitedAt,
    beneficiary: {
      name: String(b?.name ?? ''), village: (b?.village as string) ?? null, weeks: v.gestationWeeks,
      age: b?.age == null ? null : Number(b.age), firstPregnancy: parity == null ? null : parity === 0,
    },
    vitals: { bpSys: v.bpSys, bpDia: v.bpDia, hb: v.hb, symptoms: v.symptoms },
    risk: {
      level: v.riskLevel,
      rulesVersion: v.rulesVersion,
      reasons: v.riskReasons.map((r) => ({
        code: r.code, text: r.text, level: r.level,
        citation: r.evidence.status === 'cited' ? { label: r.evidence.label, page: r.evidence.page } : null,
      })),
    },
    alert: alert
      ? { status: alert.status, channel: alert.provider, doctor: alert.toName ?? ashaName?.doctor ?? null, phc: ashaName?.phc ?? null, message: alert.message, sentAt: alert.sentAt, error: alert.error }
      : null,
    followUp: fu[0]
      ? { dueDate: fu[0].due_date instanceof Date ? fu[0].due_date.toISOString().slice(0, 10) : String(fu[0].due_date).slice(0, 10), reason: (fu[0].reason as string) ?? null }
      : null,
  };
}

/** Mothers not yet visited today, with the level from their latest visit. Highest risk first. */
async function remainingToday(db: Db, ashaId: string): Promise<SnapshotRemaining[]> {
  const rows = await db.query<Row>(
    `select b.name, b.village, lv.risk_level, lv.visited_at
     from beneficiaries b
     left join lateral (select risk_level, visited_at from visits where beneficiary_id = b.id order by visited_at desc limit 1) lv on true
     where b.asha_id = $1 and (lv.visited_at is null or lv.visited_at < date_trunc('day', now()))
     order by case lv.risk_level when 'urgent' then 0 when 'high' then 1 when 'watch' then 2 when 'normal' then 3 else 4 end, b.name
     limit 6`,
    [ashaId],
  );
  return rows.map((r) => ({
    name: String(r.name),
    village: (r.village as string) ?? null,
    status: r.risk_level === 'urgent' || r.risk_level === 'high' ? 'High' : r.risk_level === 'watch' ? 'Watch' : r.risk_level === 'normal' ? 'Normal' : 'Pending',
  }));
}

/**
 * Everything a screen needs in one read. With a sessionId it follows that call; without one it shows
 * the ASHA's most recent activity (the projector dashboard).
 */
export async function getSnapshot(db: Db, opts: { sessionId?: string | null; ashaId?: string | null }): Promise<Snapshot> {
  // A signed-in call names its ASHA. The dashboard (no ASHA, no call) follows whoever used the app most recently.
  const targetId = opts.ashaId ?? (opts.sessionId ? null : await mostRecentlyActiveAshaId(db));
  const asha = (targetId ? await getAsha(db, targetId) : null) ?? (opts.ashaId ? null : await firstAsha(db));
  if (!asha) {
    return { asha: null, counts: { visits: 0, highRisk: 0, alertsSent: 0, followUps: 0 }, visit: null, events: [], remaining: [], serverTime: new Date().toISOString(), cursor: 0 };
  }
  const visit = await latestVisit(db, { sessionId: opts.sessionId ?? null, ashaId: asha.id });
  let events = await listEvents(db, { sessionId: opts.sessionId ?? null, ashaId: asha.id, limit: 200 });
  events = events.slice(-12);
  const [cursor, counts, remaining, snapVisit] = await Promise.all([
    eventsCursor(db, { sessionId: opts.sessionId ?? null, ashaId: asha.id }),
    todayCounts(db, asha.id),
    remainingToday(db, asha.id),
    visit ? toSnapshotVisit(db, visit, { doctor: asha.doctorName, phc: asha.phcName }) : Promise.resolve(null),
  ]);
  const toEvent = (e: EventRow): SnapshotEvent => ({ id: e.id, name: e.name, ok: e.ok, ms: e.ms, note: describeEvent(e), at: e.createdAt });
  return {
    asha: { name: asha.name, phcName: asha.phcName, language: asha.language },
    counts,
    visit: snapVisit,
    events: events.map(toEvent),
    remaining,
    serverTime: new Date().toISOString(),
    cursor,
  };
}
