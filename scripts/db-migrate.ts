// Applies db/schema.sql to the database in DATABASE_URL. Safe to run any number of times.
//   pnpm db:migrate
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeDb } from '../lib/db/client';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Add your Neon connection string to .env.local (see README), then run: pnpm db:migrate');
    process.exit(1);
  }

  const sql = makeDb(url);
  const text = readFileSync(path.join(process.cwd(), 'db/schema.sql'), 'utf8');
  // Neon's HTTP driver runs one statement per call. The schema has no semicolons inside strings, so splitting is safe.
  const statements = text
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);

  let ok = 0;
  for (const stmt of statements) {
    try {
      await sql.query(stmt);
      ok++;
    } catch (e) {
      // pg_trgm may be unavailable on some hosts: the app falls back to ILIKE matching.
      if (/pg_trgm|gin_trgm_ops/i.test(stmt)) {
        console.warn(`warning: skipped (${(e as Error).message.split('\n')[0]}):\n  ${stmt.split('\n')[0]}`);
        continue;
      }
      console.error(`FAILED:\n${stmt}\n`, e);
      process.exit(1);
    }
  }
  const tables = await sql.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public' order by 1`);
  console.log(`Applied ${ok}/${statements.length} statements. Tables: ${tables.map((t) => t.table_name).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
