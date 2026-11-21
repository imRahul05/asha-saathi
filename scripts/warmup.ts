// Wakes the deployment (cold start, DNS, TLS) before a demo with three light GET requests.
//   pnpm demo:warmup [BASE_URL]     default: BASE_URL, PUBLIC_BASE_URL, or the production URL
// Never signs in and never starts an agent, so it costs no Agora minutes.
export {};
const base = (process.argv[2] || process.env.BASE_URL || process.env.PUBLIC_BASE_URL || 'https://asha-saathi-mocha.vercel.app').replace(/\/+$/, '');
const SLOW_MS = 3000;
const checks: Array<{ path: string; expect: number }> = [
  { path: '/', expect: 200 },
  { path: '/login', expect: 200 },
  { path: '/api/session/state', expect: 401 },
];

async function main() {
  console.log(`Warming ${base}`);
  let bad = 0;
  for (const c of checks) {
    const t = Date.now();
    let status: number | string;
    try {
      const res = await fetch(base + c.path, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      status = res.status;
      await res.arrayBuffer();
    } catch (e) {
      status = e instanceof Error ? e.message : 'error';
    }
    const ms = Date.now() - t;
    const flags = [status !== c.expect ? `expected ${c.expect}` : '', ms > SLOW_MS ? `slow (>${SLOW_MS} ms)` : ''].filter(Boolean);
    if (flags.length) bad++;
    console.log(`${flags.length ? 'WARN' : 'ok  '} GET ${c.path.padEnd(20)} ${String(status).padEnd(5)} ${ms} ms${flags.length ? '  <- ' + flags.join(', ') : ''}`);
  }
  console.log(bad ? `\n${bad} check(s) need attention.` : '\nAll good.');
  if (bad) process.exit(1);
}
main();
