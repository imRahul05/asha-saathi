// Cleans demo data before or after a demo. Dry-run by default.
//   pnpm demo:reset                 prints what would be deleted
//   pnpm demo:reset --yes           deletes demo ASHAs older than 2 h, events older than 2 h, agent_starts older than 1 day
//   pnpm demo:reset --yes --force   same, even if an agent started in the last 5 minutes (someone may be mid-call)
// Never deletes the non-demo ASHA or her mothers, and never touches kb_chunks.
import { makeDb } from '../lib/db/client';
import { limitsFromEnv } from '../lib/guard';
import { hasRecentStart, overview, planDemoReset, runDemoReset, type Counts } from '../lib/demo-reset';

function printCounts(label: string, c: Counts) {
  console.log(`${label}
  demo ASHAs (older than 2 h)  ${c.demoAshasToDelete}
    their mothers              ${c.beneficiaries}
    their visits               ${c.visits}
    their alerts               ${c.alerts}
    their follow-ups           ${c.followups}
  events (older than 2 h, or from those ASHAs)  ${c.events}
  agent_starts (older than 1 day)               ${c.agentStarts}`);
}

async function main() {
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL_DIRECT or DATABASE_URL in .env.local.');
    process.exit(1);
  }
  const yes = process.argv.includes('--yes');
  const force = process.argv.includes('--force');
  const db = makeDb(url);

  const before = await overview(db);
  const limits = limitsFromEnv();
  console.log(yes ? 'LIVE RUN' : 'Dry run (nothing will be deleted)');
  console.log(`ASHAs: ${before.ashasTotal} (${before.ashasDemo} demo, ${before.ashasNonDemo} non-demo kept) | non-demo mothers kept: ${before.beneficiariesNonDemo} | kb_chunks untouched: ${before.kbChunks}`);
  console.log(`Agent starts: ${before.startsLastHour} in the last hour (limits per ASHA ${limits.perAshaHour}/h, per IP ${limits.perIpHour}/h); ${before.startsLastDay} of ${limits.globalDay} today, ${Math.max(0, limits.globalDay - before.startsLastDay)} left`);
  const plan = await planDemoReset(db);
  printCounts(yes ? 'Deleting:' : 'Would delete:', plan);

  if (!yes) {
    console.log('\nDry run only. Re-run with --yes to delete.');
    return;
  }
  if (!force && (await hasRecentStart(db))) {
    console.error('\nRefusing: an agent was started in the last 5 minutes, so someone may be mid-call. Wait, or pass --force.');
    process.exit(2);
  }
  await runDemoReset(db);
  const after = await overview(db);
  const left = await planDemoReset(db);
  console.log(`\nDone. ASHAs ${before.ashasTotal} -> ${after.ashasTotal} (non-demo ${before.ashasNonDemo} -> ${after.ashasNonDemo}); non-demo mothers ${before.beneficiariesNonDemo} -> ${after.beneficiariesNonDemo}; kb_chunks ${before.kbChunks} -> ${after.kbChunks}`);
  printCounts('Still matching the delete rules (should be zero):', left);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
