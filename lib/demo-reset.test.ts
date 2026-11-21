import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import type { Db } from '@/lib/db/client';
import { hasRecentStart, overview, planDemoReset, runDemoReset } from './demo-reset';

let db: Db & { close: () => Promise<void> };
const count = async (t: string) => Number((await db.query<{ n: string }>(`select count(*) n from ${t}`))[0].n);

async function mkAsha(isDemo: boolean, age: string) {
  return (await db.query<{ id: string }>(
    `insert into ashas (name, phc_name, is_demo, created_at) values ('A','P',$1, now() - $2::interval) returning id`, [isDemo, age]))[0].id;
}
async function fill(ashaId: string) {
  const b = (await db.query<{ id: string }>(`insert into beneficiaries (asha_id, name) values ($1,'M') returning id`, [ashaId]))[0].id;
  const v = (await db.query<{ id: string }>(
    `insert into visits (asha_id, beneficiary_id, risk_level, rules_version) values ($1,$2,'normal','v') returning id`, [ashaId, b]))[0].id;
  await db.query(`insert into alerts (visit_id, message, status, confirm_token, expires_at) values ($1,'m','draft',$2, now()+interval '1 hour')`, [v, 'tok' + v]);
  await db.query(`insert into followups (asha_id, beneficiary_id, visit_id, due_date) values ($1,$2,$3, current_date)`, [ashaId, b, v]);
}

beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => db.close());

describe('demo reset', () => {
  it('deletes only old demo data and leaves the seed ASHA, new demo ASHAs and kb_chunks alone', async () => {
    const seed = await mkAsha(false, '30 days');
    const oldDemo = await mkAsha(true, '3 hours');
    const newDemo = await mkAsha(true, '10 minutes');
    for (const id of [seed, oldDemo, newDemo]) await fill(id);
    await db.query(`insert into kb_chunks (id, doc_id, label, title, heading, page, url, content, hash) values ('k','d','l','t','h','1','u','c','x')`);
    await db.query(
      `insert into events (asha_id, type, name, ok, created_at) values
        ($1,'tool','old',true, now() - interval '3 hours'), ($1,'tool','new-seed',true, now()),
        ($2,'tool','new-olddemo',true, now()), ($3,'tool','new-newdemo',true, now())`,
      [seed, oldDemo, newDemo],
    );
    await db.query(`insert into agent_starts (kind, asha_id, created_at) values ('agent',$1, now() - interval '2 days'), ('agent',$1, now() - interval '1 hour')`, [seed]);

    expect(await planDemoReset(db)).toEqual({ demoAshasToDelete: 1, beneficiaries: 1, visits: 1, alerts: 1, followups: 1, events: 2, agentStarts: 1 });
    expect(await count('ashas')).toBe(3); // planning changes nothing

    await runDemoReset(db);

    const ids = (await db.query<{ id: string }>('select id from ashas')).map((r) => r.id).sort();
    expect(ids).toEqual([seed, newDemo].sort());
    expect(await count('beneficiaries')).toBe(2);
    expect(await count('visits')).toBe(2);
    expect(await count('alerts')).toBe(2);
    expect(await count('followups')).toBe(2);
    expect(await count('kb_chunks')).toBe(1);
    expect((await db.query<{ name: string }>('select name from events order by name')).map((r) => r.name)).toEqual(['new-newdemo', 'new-seed']);
    expect(await count('agent_starts')).toBe(1);
    expect(await count('events where asha_id is not null and asha_id not in (select id from ashas)')).toBe(0);
    expect(await planDemoReset(db)).toEqual({ demoAshasToDelete: 0, beneficiaries: 0, visits: 0, alerts: 0, followups: 0, events: 0, agentStarts: 0 });
  });

  it('reports headroom and detects a start in the last 5 minutes', async () => {
    await db.query('delete from agent_starts');
    expect(await hasRecentStart(db)).toBe(false);
    await db.query(`insert into agent_starts (kind) values ('agent')`);
    expect(await hasRecentStart(db)).toBe(true);
    const o = await overview(db);
    expect(o.startsLastHour).toBe(1);
    expect(o.ashasNonDemo).toBe(1);
    expect(o.kbChunks).toBe(1);
  });
});
