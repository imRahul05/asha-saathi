import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { insertBeneficiary, insertVisit, listEvents } from '@/lib/db/repo';
import { NextRequest } from 'next/server';
import { signCallLink } from '@/lib/call/link';

process.env.SESSION_SECRET = 'test-session-secret-0123456789';
let db: Db & { close: () => Promise<void> };
vi.mock('@/lib/db/client', () => ({ getDb: () => db, hasDatabase: () => true }));

let POST: (req: NextRequest) => Promise<Response>;
let ashaId = '';
let visitId = '';
const exp = () => Math.floor(Date.now() / 1000) + 3600;
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/call/event', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const callEvents = async () => (await listEvents(db, { ashaId, sessionId: 'call-ev-1' })).filter((e) => e.name === 'doctorCall');

beforeAll(async () => {
  db = await createTestDb();
  ashaId = (await db.query<{ id: string }>(`insert into ashas (name, phc_name, doctor_name, doctor_phone) values ('Meena Kumari','Kolar PHC','Dr Rao','+919999900001') returning id`))[0].id;
  const b = await insertBeneficiary(db, { ashaId, name: 'Sunita Devi', village: 'Narsapura' });
  visitId = (await insertVisit(db, { ashaId, beneficiaryId: b.id, sessionId: 'call-ev-1', symptoms: [], risk: { level: 'normal', reasons: [], rulesVersion: 'anc.v1' } as never })).id;
  ({ POST } = await import('./route'));
});
afterAll(async () => db.close());

describe('POST /api/call/event', () => {
  it('logs a valid link into the visit timeline', async () => {
    const t = signCallLink({ visitId, ashaId, role: 'doctor', exp: exp() });
    const res = await post({ t, type: 'joined' });
    expect(res.status).toBe(200);
    const ev = await callEvents();
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'call', ok: true, ashaId, sessionId: 'call-ev-1' });
    expect(ev[0].input).toMatchObject({ role: 'doctor', event: 'joined' });
  });

  it('rejects an invalid or expired link with 401', async () => {
    expect((await post({ t: 'garbage.link.value', type: 'joined' })).status).toBe(401);
    expect((await post('not json')).status).toBe(401);
    const old = signCallLink({ visitId, ashaId, role: 'doctor', exp: Math.floor(Date.now() / 1000) - 10 });
    expect((await post({ t: old, type: 'joined' })).status).toBe(401);
    expect(await callEvents()).toHaveLength(1);
  });

  it('ignores the same role+event for the same visit within 10 seconds', async () => {
    const t = signCallLink({ visitId, ashaId, role: 'doctor', exp: exp() });
    const res = await post({ t, type: 'joined' });
    expect(((await res.json()) as { duplicate?: boolean }).duplicate).toBe(true);
    expect(await callEvents()).toHaveLength(1);
    // a different event or role is still recorded
    expect((await post({ t, type: 'left' })).status).toBe(200);
    const asha = signCallLink({ visitId, ashaId, role: 'asha', exp: exp() });
    expect((await post({ t: asha, type: 'joined' })).status).toBe(200);
    expect(await callEvents()).toHaveLength(3);
  });
});
