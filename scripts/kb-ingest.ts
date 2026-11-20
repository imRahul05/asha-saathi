// Loads knowledge/*.md into the kb_chunks table. Safe to run any number of times: the second run reports 0 changed.
//   pnpm kb:ingest        (needs DATABASE_URL; run pnpm db:migrate once first)
// Run `pnpm kb:verify` first when a knowledge file has changed: it proves every quote is on its official PDF page.
import { makeDb } from '../lib/db/client';
import { ingestKnowledge } from '../lib/rag/ingest';

(async () => {
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set (see README).');
    process.exit(1);
  }
  const r = await ingestKnowledge(makeDb(url));
  console.log(`kb_chunks: ${r.total} chunks. added ${r.added}, updated ${r.updated}, removed ${r.removed}, unchanged ${r.unchanged}.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
