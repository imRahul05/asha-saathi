import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { insertBeneficiary } from '@/lib/db/repo';

let db: Db & { close: () => Promise<void> };
vi.mock('@/lib/db/client', () => ({ getDb: () => db, hasDatabase: () => true }));

const SECRET = 'test-secret-0123456789';
let POST: (req: Request) => Promise<Response>;
let ashaId = '';
let sunitaId = '';
let rpcId = 0;

async function rpc(method: string, params?: unknown, opts: { auth?: boolean; session?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-asha-id': ashaId, 'x-session': opts.session ?? 'call-x' };
  if (opts.auth !== false) headers.authorization = `Bearer ${SECRET}`;
  const res = await POST(new Request('http://localhost/api/mcp', { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }) }));
  const text = await res.text();
  const data = text.split('\n').find((l) => l.startsWith('data:'));
  return { status: res.status, json: data ? JSON.parse(data.slice(5)) : text ? safe(text) : null };
}
const safe = (t: string) => { try { return JSON.parse(t); } catch { return t; } };
const call = async (name: string, args: unknown) => {
  const r = await rpc('tools/call', { name, arguments: args });
  const text = r.json?.result?.content?.[0]?.text;
  return { raw: r, result: text ? JSON.parse(text) : null };
};

beforeAll(async () => {
  process.env.MCP_SHARED_SECRET = SECRET;
  process.env.NOTIFIER = 'console';
  db = await createTestDb();
  const a = await db.query<{ id: string }>(`insert into ashas (name, phc_name, doctor_name, doctor_phone) values ('Meena Kumari','Kolar PHC','Dr Rao','+919999900001') returning id`);
  ashaId = a[0].id;
  sunitaId = (await insertBeneficiary(db, { ashaId, name: 'Sunita Devi', village: 'Narsapura', age: 24, parity: 1 })).id;
  ({ POST } = await import('./route'));
});
afterAll(async () => db.close());

describe('/api/mcp', () => {
  it('rejects calls without the secret', async () => {
    const r = await rpc('tools/list', {}, { auth: false });
    expect(r.status).toBe(401);
  });

  it('rejects a wrong secret', async () => {
    const res = await POST(new Request('http://localhost/api/mcp', { method: 'POST', headers: { authorization: 'Bearer nope', 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('lists every tool with a JSON schema Agora can read', async () => {
    const r = await rpc('tools/list', {});
    const tools = r.json.result.tools as Array<{ name: string; inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] } }>;
    expect(tools.map((t) => t.name).sort()).toEqual(['draftAlert', 'findBeneficiary', 'getBeneficiaryHistory', 'recordVisit', 'scheduleFollowUp', 'sendAlert', 'todaySummary']);
    const rv = tools.find((t) => t.name === 'recordVisit')!;
    expect(rv.inputSchema.type).toBe('object');
    expect(Object.keys(rv.inputSchema.properties ?? {})).toEqual(expect.arrayContaining(['beneficiaryId', 'bpSys', 'bpDia', 'hb', 'symptoms']));
    expect(rv.inputSchema.required).toEqual(['beneficiaryId']);
  });

  it('runs the whole visit flow over MCP: find, record, draft, send once', async () => {
    const found = await call('findBeneficiary', { name: 'Sunita' });
    expect(found.result.ok).toBe(true);
    expect(found.result.data.matches[0].id).toBe(sunitaId);

    const rec = await call('recordVisit', { beneficiaryId: sunitaId, gestationWeeks: 28, bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] });
    expect(rec.result.data.risk.level).toBe('high');

    const draft = await call('draftAlert', { visitId: rec.result.data.visitId });
    expect(draft.result.data.preview).toContain('BP 150/100');
    const token = draft.result.data.token;

    const first = await call('sendAlert', { token });
    const second = await call('sendAlert', { token });
    expect(first.result.data.alreadySent).toBe(false);
    expect(second.result.data.alreadySent).toBe(true);
  });

  it('reports every call under the call\'s session for the dashboard', async () => {
    const rows = await db.query<{ name: string }>(`select name from events where session_id = 'call-x' order by id`);
    expect(rows.map((r) => r.name)).toEqual(['findBeneficiary', 'recordVisit', 'draftAlert', 'sendAlert', 'sendAlert']);
  });

  it('out-of-range input is rejected by the MCP schema, nothing is saved', async () => {
    const before = await db.query<{ n: string }>('select count(*) as n from visits');
    const r = await rpc('tools/call', { name: 'recordVisit', arguments: { beneficiaryId: sunitaId, bpSys: 999, bpDia: 100 } });
    expect(JSON.stringify(r.json)).toMatch(/validation|invalid|too big/i);
    const after = await db.query<{ n: string }>('select count(*) as n from visits');
    expect(after[0].n).toBe(before[0].n);
  });
});
