import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Db } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { guardScribe } from '@/lib/guard';
import { newSession, sessionCookieHeader, signSession } from '@/lib/auth/session';

let db: Db & { close: () => Promise<void> };
vi.mock('@/lib/db/client', () => ({ getDb: () => db, hasDatabase: () => true }));

process.env.SESSION_SECRET = 'test-secret-0123456789';

let ashaId = '';
let cookie = '';
const SECOND_PIECE = Buffer.from('second piece of audio');

const req = (path: string, init: { method?: string; body?: BodyInit | null; json?: unknown; signedIn?: boolean; headers?: Record<string, string> } = {}) => {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.signedIn !== false) headers.cookie = cookie;
  if (init.json !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`http://localhost${path}`, { method: init.method ?? 'POST', headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
};
const params = (id: string) => ({ params: Promise.resolve({ id }) });

let start: typeof import('./route').POST;
let one: typeof import('./[id]/route');
let chunk: typeof import('./[id]/chunk/route').PUT;
let proc: typeof import('./[id]/process/route').POST;
let confirm: typeof import('./[id]/confirm/route').POST;

beforeAll(async () => {
  db = await createTestDb();
  ashaId = (await db.query<{ id: string }>(`insert into ashas (name, phc_name) values ('Meena','Kolar PHC') returning id`))[0].id;
  cookie = `${sessionCookieHeader(signSession(newSession(ashaId, 'demo'))).split(';')[0]}`;
  start = (await import('./route')).POST;
  one = await import('./[id]/route');
  chunk = (await import('./[id]/chunk/route')).PUT;
  proc = (await import('./[id]/process/route')).POST;
  confirm = (await import('./[id]/confirm/route')).POST;
});
afterAll(() => db.close());

async function begin(clientId = `client-${Math.random().toString(36).slice(2, 12)}`) {
  const r = await start(req('/api/scribe', { json: { clientId, language: 'hi', mime: 'audio/ogg' } }));
  return { res: r, body: await r.json(), clientId };
}

describe('scribe routes', () => {
  it('need a signed-in ASHA', async () => {
    expect((await start(req('/api/scribe', { json: {}, signedIn: false }))).status).toBe(401);
    const { body } = await begin();
    expect((await one.GET(req(`/api/scribe/${body.id}`, { method: 'GET', signedIn: false }), params(body.id))).status).toBe(401);
    expect((await chunk(req(`/api/scribe/${body.id}/chunk?index=0`, { method: 'PUT', body: SECOND_PIECE, signedIn: false }), params(body.id))).status).toBe(401);
    expect((await proc(req(`/api/scribe/${body.id}/process`, { json: { chunkCount: 1 }, signedIn: false }), params(body.id))).status).toBe(401);
    expect((await confirm(req(`/api/scribe/${body.id}/confirm`, { json: {}, signedIn: false }), params(body.id))).status).toBe(401);
  });

  it('start validates the body and is idempotent', async () => {
    expect((await start(req('/api/scribe', { json: { clientId: 'short', mime: 'audio/ogg' } }))).status).toBe(400);
    expect((await start(req('/api/scribe', { json: { clientId: 'long-enough-id', mime: 'text/plain' } }))).status).toBe(400);
    const a = await begin('same-client-1');
    const b = await begin('same-client-1');
    expect(a.res.status).toBe(201);
    expect(b.body.id).toBe(a.body.id);
    expect(a.body).not.toHaveProperty('extraction');
  });

  it('accepts pieces, replaces a repeated piece, and rejects empty, oversized and badly numbered ones', async () => {
    const { body } = await begin();
    const put = (qs: string, data: Buffer) => chunk(req(`/api/scribe/${body.id}/chunk${qs}`, { method: 'PUT', body: new Uint8Array(data) }), params(body.id));
    expect((await put('?index=0', SECOND_PIECE)).status).toBe(200);
    expect((await put('?index=0', SECOND_PIECE)).status).toBe(200);
    expect((await db.query<{ n: number }>('select count(*)::int n from scribe_chunks where scribe_id = $1', [body.id]))[0].n).toBe(1);
    expect((await put('?index=0', Buffer.alloc(0))).status).toBe(400);
    expect((await put('?index=-1', SECOND_PIECE)).status).toBe(400);
    expect((await put('', SECOND_PIECE)).status).toBe(400);
    expect((await put('?index=1', Buffer.alloc(4_000_001, 1))).status).toBe(413);
  });

  it('process asks for missing pieces with a clear code', async () => {
    const { body } = await begin();
    const r = await proc(req(`/api/scribe/${body.id}/process`, { json: { chunkCount: 2 } }), params(body.id));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: 'MISSING_CHUNKS' });
    // a request that never reached the speech service must not use up the allowance
    expect((await db.query<{ n: number }>("select count(*)::int n from agent_starts where kind = 'scribe'"))[0].n).toBe(0);
    expect((await proc(req(`/api/scribe/${body.id}/process`, { json: { chunkCount: 0 } }), params(body.id))).status).toBe(400);
  });

  it('answers 404 for an unknown recording and for one that is not a valid id', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await one.GET(req(`/api/scribe/${missing}`, { method: 'GET' }), params(missing))).status).toBe(404);
    expect((await one.GET(req('/api/scribe/nope', { method: 'GET' }), params('nope'))).status).toBe(404);
    expect((await confirm(req(`/api/scribe/${missing}/confirm`, { json: {} }), params(missing))).status).toBe(404);
  });

  it('confirm refuses a recording that is not ready, and discard removes it', async () => {
    const { body } = await begin();
    const c = await confirm(req(`/api/scribe/${body.id}/confirm`, { json: { beneficiaryId: missingUuid() } }), params(body.id));
    expect(c.status).toBe(409);
    const d = await one.DELETE(req(`/api/scribe/${body.id}`, { method: 'DELETE' }), params(body.id));
    expect(d.status).toBe(200);
    expect((await (await one.GET(req(`/api/scribe/${body.id}`, { method: 'GET' }), params(body.id))).json()).status).toBe('discarded');
  });
});

const missingUuid = () => '11111111-1111-4111-8111-111111111111';

describe('usage guard for recordings', () => {
  it('stops one ASHA, one network and the whole day at their limits, and counts only what it allows', async () => {
    await db.query('delete from agent_starts'); // earlier tests in this file counted too
    const limits = { perAshaHour: 2, perIpHour: 3, globalDay: 5 };
    const a = '22222222-2222-4222-8222-222222222222';
    const ok = async (asha: string, ip: string) => (await guardScribe(db, { ashaId: asha, ipHash: ip }, limits)).ok;
    expect(await ok(a, 'ip-a')).toBe(true);
    expect(await ok(a, 'ip-a')).toBe(true);
    expect(await ok(a, 'ip-a')).toBe(false); // this ASHA is at 2 an hour
    const b = '33333333-3333-4333-8333-333333333333';
    expect(await ok(b, 'ip-a')).toBe(true); // a third from the same network
    expect(await ok('44444444-4444-4444-8444-444444444444', 'ip-a')).toBe(false); // that network is at 3 an hour
    expect(await ok('44444444-4444-4444-8444-444444444444', 'ip-b')).toBe(true);
    expect(await ok('55555555-5555-4555-8555-555555555555', 'ip-c')).toBe(true); // 5th of the day
    const day = await guardScribe(db, { ashaId: '66666666-6666-4666-8666-666666666666', ipHash: 'ip-d' }, limits);
    expect(day).toMatchObject({ ok: false, retryAfterSeconds: 3600 });
  });
});
