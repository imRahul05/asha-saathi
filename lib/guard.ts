import { createHash } from 'node:crypto';
import type { Db } from '@/lib/db/client';

// Usage guard. The free Agora allowance is 300 agent-minutes, so starts are limited per visitor, per IP and per day.
// Limits are env-tunable; the defaults suit a hackathon demo.
export type Limits = { perAshaHour: number; perIpHour: number; globalDay: number; demoPerIpHour: number };

export function limitsFromEnv(env: NodeJS.ProcessEnv = process.env): Limits {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    perAshaHour: n(env.AGENT_STARTS_PER_ASHA_HOUR, 6),
    perIpHour: n(env.AGENT_STARTS_PER_IP_HOUR, 12),
    globalDay: n(env.AGENT_STARTS_PER_DAY, 80),
    demoPerIpHour: n(env.DEMO_SIGNINS_PER_IP_HOUR, 15),
  };
}

export function hashIp(ip: string, salt: string = process.env.SESSION_SECRET ?? process.env.MCP_SHARED_SECRET ?? 'asha'): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 16);
}

export function clientIp(headers: Headers): string {
  return (headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';
}

export type GuardResult = { ok: true } | { ok: false; message: string; retryAfterSeconds: number };

async function count(db: Db, sql: string, params: unknown[]): Promise<number> {
  const rows = await db.query<{ n: string | number }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

/** Checks the limits and, if allowed, records this start. One round trip per check; races can overshoot by a call or two, which is fine here. */
export async function guardAgentStart(db: Db, who: { ashaId: string; ipHash: string }, limits: Limits = limitsFromEnv()): Promise<GuardResult> {
  const [perAsha, perIp, today] = await Promise.all([
    count(db, `select count(*) n from agent_starts where kind='agent' and asha_id=$1 and created_at > now() - interval '1 hour'`, [who.ashaId]),
    count(db, `select count(*) n from agent_starts where kind='agent' and ip_hash=$1 and created_at > now() - interval '1 hour'`, [who.ipHash]),
    count(db, `select count(*) n from agent_starts where kind='agent' and created_at > now() - interval '1 day'`, []),
  ]);
  if (today >= limits.globalDay) return { ok: false, message: 'The demo has reached its daily limit. Please try again tomorrow.', retryAfterSeconds: 3600 };
  if (perAsha >= limits.perAshaHour || perIp >= limits.perIpHour) return { ok: false, message: 'You have started a lot of calls. Please wait a little and try again.', retryAfterSeconds: 600 };
  await db.query(`insert into agent_starts (kind, asha_id, ip_hash) values ('agent', $1, $2)`, [who.ashaId, who.ipHash]);
  return { ok: true };
}

export async function guardDemoSignIn(db: Db, ipHash: string, limits: Limits = limitsFromEnv()): Promise<GuardResult> {
  const n = await count(db, `select count(*) n from agent_starts where kind='demo' and ip_hash=$1 and created_at > now() - interval '1 hour'`, [ipHash]);
  if (n >= limits.demoPerIpHour) return { ok: false, message: 'Too many demo sign-ins from this network. Please try again later.', retryAfterSeconds: 900 };
  await db.query(`insert into agent_starts (kind, asha_id, ip_hash) values ('demo', null, $1)`, [ipHash]);
  return { ok: true };
}
