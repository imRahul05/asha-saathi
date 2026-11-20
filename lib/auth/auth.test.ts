import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import type { Db } from '@/lib/db/client';
import { insertBeneficiary, getBeneficiary, firstAsha, mostRecentlyActiveAshaId, logEvent } from '@/lib/db/repo';
import { cookieFromHeader, newSession, sessionCookieHeader, signSession, verifySession } from './session';
import { createDemoAsha, NoTemplateError } from './demo';
import { guardAgentStart, guardDemoSignIn, hashIp, limitsFromEnv, type Limits } from '@/lib/guard';

process.env.SESSION_SECRET = 'test-session-secret-0123456789';

describe('signed session cookie', () => {
  it('round-trips', () => {
    const s = newSession('11111111-1111-4111-8111-111111111111', 'demo');
    expect(verifySession(signSession(s))).toEqual(s);
  });
  it('rejects a tampered payload', () => {
    const [body, sig] = signSession(newSession('a', 'demo')).split('.');
    const forged = Buffer.from(JSON.stringify({ ashaId: 'someone-else', mode: 'user', exp: 9999999999 })).toString('base64url');
    expect(verifySession(`${forged}.${sig}`)).toBeNull();
    expect(verifySession(`${body}.AAAA`)).toBeNull();
  });
  it('rejects a cookie signed with another secret', () => {
    const value = signSession(newSession('a', 'demo'));
    process.env.SESSION_SECRET = 'a-different-secret';
    expect(verifySession(value)).toBeNull();
    process.env.SESSION_SECRET = 'test-session-secret-0123456789';
  });
  it('expires', () => {
    const s = newSession('a', 'demo', Date.now() - 9 * 3600_000);
    expect(verifySession(signSession(s))).toBeNull();
  });
  it('ignores garbage and missing values', () => {
    for (const v of [undefined, null, '', 'abc', 'a.b.c', '.']) expect(verifySession(v as never)).toBeNull();
  });
  it('reads the cookie from a header and sets safe flags', () => {
    const value = signSession(newSession('a', 'demo'));
    expect(cookieFromHeader(`x=1; asha_session=${encodeURIComponent(value)}; y=2`)).toBe(value);
    const header = sessionCookieHeader(value);
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Lax/);
    expect(sessionCookieHeader('', { clear: true })).toMatch(/Max-Age=0/);
  });
});

describe('demo accounts and usage guard', () => {
  let db: Db & { close: () => Promise<void> };
  let templateId = '';
  beforeAll(async () => {
    db = await createTestDb();
    templateId = (await db.query<{ id: string }>(`insert into ashas (name, phc_name, doctor_name, doctor_phone) values ('Meena Kumari','Kolar PHC','Dr Rao','+919999900001') returning id`))[0].id;
    await insertBeneficiary(db, { ashaId: templateId, name: 'Sunita Devi', aliases: ['सुनीता'], village: 'Narsapura', age: 24, parity: 1, lmp: '2026-05-01' });
    await insertBeneficiary(db, { ashaId: templateId, name: 'Pooja K', village: 'Malur' });
  });
  afterAll(async () => db.close());

  it('refuses to create a demo account if nothing has been seeded', async () => {
    const empty = await createTestDb();
    await expect(createDemoAsha(empty)).rejects.toBeInstanceOf(NoTemplateError);
    await empty.close();
  });

  it('gives each visitor a private copy of the ASHA and her mothers', async () => {
    const a = await createDemoAsha(db);
    const b = await createDemoAsha(db);
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(templateId);
    const mothersA = await db.query<{ id: string; asha_id: string; aliases: string[] }>('select id, asha_id, aliases from beneficiaries where asha_id = $1', [a.id]);
    expect(mothersA).toHaveLength(2);
    expect(mothersA[0].aliases.length + mothersA[1].aliases.length).toBe(1); // aliases copied
    // visitor A cannot read visitor B's mother (isolation at the repository level)
    const motherB = (await db.query<{ id: string }>('select id from beneficiaries where asha_id = $1 limit 1', [b.id]))[0];
    expect(await getBeneficiary(db, a.id, motherB.id)).toBeNull();
    // the template stays the "first ASHA", demo copies never become it
    expect((await firstAsha(db))?.id).toBe(templateId);
  });

  it('deletes demo accounts older than 24 hours, with their data', async () => {
    const old = await createDemoAsha(db);
    await db.query(`update ashas set created_at = now() - interval '25 hours' where id = $1`, [old.id]);
    await createDemoAsha(db); // triggers cleanup
    expect(await db.query('select 1 from ashas where id = $1', [old.id])).toHaveLength(0);
    expect(await db.query('select 1 from beneficiaries where asha_id = $1', [old.id])).toHaveLength(0);
    expect(await db.query('select 1 from ashas where id = $1', [templateId])).toHaveLength(1); // template untouched
  });

  it('the dashboard follows whoever used the app last', async () => {
    const d = await createDemoAsha(db);
    await logEvent(db, { ashaId: d.id, sessionId: 's', type: 'tool', name: 'findBeneficiary', ok: true });
    expect(await mostRecentlyActiveAshaId(db)).toBe(d.id);
  });

  describe('guard', () => {
    const limits: Limits = { perAshaHour: 2, perIpHour: 3, globalDay: 5, demoPerIpHour: 2 };
    it('allows up to the per-visitor limit, then says wait', async () => {
      const who = { ashaId: (await createDemoAsha(db)).id, ipHash: 'ip-a' };
      expect((await guardAgentStart(db, who, limits)).ok).toBe(true);
      expect((await guardAgentStart(db, who, limits)).ok).toBe(true);
      const third = await guardAgentStart(db, who, limits);
      expect(third.ok).toBe(false);
      expect(!third.ok && third.message).toMatch(/wait/i);
    });
    it('limits one IP across several visitors', async () => {
      const ip = 'ip-b';
      const results = [];
      for (let i = 0; i < 4; i++) results.push((await guardAgentStart(db, { ashaId: (await createDemoAsha(db)).id, ipHash: ip }, { ...limits, perIpHour: 3, globalDay: 99 })).ok);
      expect(results).toEqual([true, true, true, false]);
    });
    it('stops everyone at the daily cap', async () => {
      await db.query(`delete from agent_starts`);
      const r = [];
      for (let i = 0; i < 6; i++) r.push((await guardAgentStart(db, { ashaId: (await createDemoAsha(db)).id, ipHash: `ip-${i}` }, limits)).ok);
      expect(r).toEqual([true, true, true, true, true, false]);
    });
    it('limits demo sign-ins per IP', async () => {
      expect((await guardDemoSignIn(db, 'ip-c', limits)).ok).toBe(true);
      expect((await guardDemoSignIn(db, 'ip-c', limits)).ok).toBe(true);
      expect((await guardDemoSignIn(db, 'ip-c', limits)).ok).toBe(false);
      expect((await guardDemoSignIn(db, 'ip-d', limits)).ok).toBe(true);
    });
  });

  it('reads limits from env with safe defaults and hashes IPs', () => {
    expect(limitsFromEnv({} as never)).toEqual({ perAshaHour: 6, perIpHour: 12, globalDay: 80, demoPerIpHour: 15 });
    expect(limitsFromEnv({ AGENT_STARTS_PER_DAY: '10', AGENT_STARTS_PER_ASHA_HOUR: 'nope' } as never)).toMatchObject({ globalDay: 10, perAshaHour: 6 });
    expect(hashIp('1.2.3.4')).toHaveLength(16);
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4');
  });
});
