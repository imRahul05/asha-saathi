import type { Db } from '@/lib/db/client';

// Demo-day cleanup. Only ever removes demo ASHAs (is_demo) older than 2 hours (their mothers, visits, alerts and
// follow-ups go with them through ON DELETE CASCADE), events older than 2 hours (and any events left by a deleted
// demo ASHA, since events has no foreign key), and agent_starts older than 1 day. Never touches non-demo ASHAs or kb_chunks.
export const DEMO_ASHA_MAX_AGE = '2 hours';
export const EVENTS_MAX_AGE = '2 hours';
export const AGENT_STARTS_MAX_AGE = '1 day';
export const RECENT_START_WINDOW = '5 minutes';

export type Counts = {
  demoAshasToDelete: number;
  beneficiaries: number;
  visits: number;
  alerts: number;
  followups: number;
  events: number;
  agentStarts: number;
};

export type Overview = {
  ashasTotal: number;
  ashasDemo: number;
  ashasNonDemo: number;
  beneficiariesNonDemo: number;
  startsLastHour: number;
  startsLastDay: number;
  startsLast5Min: number;
  kbChunks: number;
};

const demoOld = `select id from ashas where is_demo and created_at < now() - interval '${DEMO_ASHA_MAX_AGE}'`;

async function n(db: Db, sql: string): Promise<number> {
  const rows = await db.query<{ n: string | number }>(sql);
  return Number(rows[0]?.n ?? 0);
}

/** What a reset would delete right now. Read-only. */
export async function planDemoReset(db: Db): Promise<Counts> {
  const [demoAshasToDelete, beneficiaries, visits, alerts, followups, events, agentStarts] = await Promise.all([
    n(db, `select count(*) n from (${demoOld}) d`),
    n(db, `select count(*) n from beneficiaries where asha_id in (${demoOld})`),
    n(db, `select count(*) n from visits where asha_id in (${demoOld})`),
    n(db, `select count(*) n from alerts where visit_id in (select id from visits where asha_id in (${demoOld}))`),
    n(db, `select count(*) n from followups where asha_id in (${demoOld})`),
    n(db, `select count(*) n from events where created_at < now() - interval '${EVENTS_MAX_AGE}' or asha_id in (${demoOld})`),
    n(db, `select count(*) n from agent_starts where created_at < now() - interval '${AGENT_STARTS_MAX_AGE}'`),
  ]);
  return { demoAshasToDelete, beneficiaries, visits, alerts, followups, events, agentStarts };
}

/** Table totals and agent-start headroom, for the operator. Read-only. */
export async function overview(db: Db): Promise<Overview> {
  const [ashasTotal, ashasDemo, beneficiariesNonDemo, startsLastHour, startsLastDay, startsLast5Min, kbChunks] = await Promise.all([
    n(db, `select count(*) n from ashas`),
    n(db, `select count(*) n from ashas where is_demo`),
    n(db, `select count(*) n from beneficiaries where asha_id in (select id from ashas where not is_demo)`),
    n(db, `select count(*) n from agent_starts where kind='agent' and created_at > now() - interval '1 hour'`),
    n(db, `select count(*) n from agent_starts where kind='agent' and created_at > now() - interval '1 day'`),
    n(db, `select count(*) n from agent_starts where created_at > now() - interval '${RECENT_START_WINDOW}'`),
    n(db, `select count(*) n from kb_chunks`),
  ]);
  return { ashasTotal, ashasDemo, ashasNonDemo: ashasTotal - ashasDemo, beneficiariesNonDemo, startsLastHour, startsLastDay, startsLast5Min, kbChunks };
}

/** True when an agent start happened in the last 5 minutes: someone may be mid-call. */
export async function hasRecentStart(db: Db): Promise<boolean> {
  return (await n(db, `select count(*) n from agent_starts where created_at > now() - interval '${RECENT_START_WINDOW}'`)) > 0;
}

/** Performs the deletion. Events go first so the demo ASHA ids can still be resolved; the cascade removes the rest. */
export async function runDemoReset(db: Db): Promise<void> {
  await db.query(`delete from events where created_at < now() - interval '${EVENTS_MAX_AGE}' or asha_id in (${demoOld})`);
  await db.query(`delete from agent_starts where created_at < now() - interval '${AGENT_STARTS_MAX_AGE}'`);
  await db.query(`delete from ashas where is_demo and created_at < now() - interval '${DEMO_ASHA_MAX_AGE}'`);
}
