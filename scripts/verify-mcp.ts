// Contract check for a running /api/mcp endpoint.
//   pnpm verify:mcp <base-url> <secret>            read-only: auth, tool list, name lookup
//   pnpm verify:mcp <base-url> <secret> --write    also runs a real visit: record, draft alert, send twice (creates data!)
// Example: pnpm verify:mcp https://asha-saathi-mocha.vercel.app $MCP_SHARED_SECRET
const [base, secret] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const write = process.argv.includes('--write');
if (!base || !secret) {
  console.error('Usage: pnpm verify:mcp <base-url> <secret> [--write]');
  process.exit(2);
}
const url = `${base.replace(/\/$/, '')}/api/mcp`;
const session = `verify-mcp-${Date.now()}`;
let failures = 0;
let id = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

async function rpc(method: string, params?: unknown, auth = true) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(auth ? { authorization: `Bearer ${secret}` } : {}),
      'x-session': session,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  const text = await res.text();
  const line = text.split('\n').find((l) => l.startsWith('data:'));
  let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { json = JSON.parse(line ? line.slice(5) : text); } catch { /* not json */ }
  return { status: res.status, json };
}
async function tool(name: string, args: unknown) {
  const r = await rpc('tools/call', { name, arguments: args });
  const t = r.json?.result?.content?.[0]?.text;
  return { r, out: t ? JSON.parse(t) : null };
}

async function main() {
  console.log(`Checking ${url}\n`);
  check('rejects a call with no secret', (await rpc('tools/list', {}, false)).status === 401);

  const list = await rpc('tools/list', {});
  const names: string[] = (list.json?.result?.tools ?? []).map((t: { name: string }) => t.name);
  const expected = ['findBeneficiary', 'getBeneficiaryHistory', 'recordVisit', 'scheduleFollowUp', 'todaySummary', 'draftAlert', 'sendAlert'];
  check('lists all 7 tools', expected.every((n) => names.includes(n)), names.join(', '));

  const found = await tool('findBeneficiary', { name: 'Sunita', village: 'Narsapura' });
  check('findBeneficiary answers', found.out?.ok === true, found.out?.ok ? `${found.out.data.count} match(es)` : JSON.stringify(found.out ?? found.r.json));
  const mother = found.out?.data?.matches?.[0];

  const bad = await rpc('tools/call', { name: 'recordVisit', arguments: { beneficiaryId: mother?.id ?? '00000000-0000-4000-8000-000000000000', bpSys: 999, bpDia: 100 } });
  check('rejects an impossible BP (999)', /validation|invalid|too big|BAD_INPUT/i.test(JSON.stringify(bad.json)));

  if (write) {
    if (!mother) { check('a seeded mother exists for --write', false, 'run pnpm db:seed'); return; }
    const rec = await tool('recordVisit', { beneficiaryId: mother.id, gestationWeeks: 28, bpSys: 150, bpDia: 100, symptoms: ['swelling_feet'] });
    check('recordVisit returns HIGH for 150/100', rec.out?.data?.risk?.level === 'high', rec.out?.data?.risk?.level);
    const draft = await tool('draftAlert', { visitId: rec.out?.data?.visitId });
    check('draftAlert returns a preview and sends nothing', draft.out?.ok === true && !!draft.out.data.token && !draft.out.data.alreadySent, draft.out?.data?.hint ?? draft.out?.hint);
    const token = draft.out?.data?.token;
    const a = await tool('sendAlert', { token });
    const b = await tool('sendAlert', { token });
    check('first sendAlert sends', a.out?.ok === true && a.out.data.alreadySent === false, a.out?.data?.provider ?? a.out?.code);
    check('second sendAlert is a no-op', b.out?.ok === true && b.out.data.alreadySent === true);
  } else {
    console.log('\n(skipped the write flow; add --write to record a visit and send an alert)');
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
