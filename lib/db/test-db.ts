import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Db } from './client';

/** Embedded Postgres with the real schema, for tests. No network, no Neon needed. */
export async function createTestDb(): Promise<Db & { close: () => Promise<void> }> {
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(readFileSync(path.join(process.cwd(), 'db/schema.sql'), 'utf8'));
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query(text, params);
      return res.rows as T[];
    },
    close: () => pg.close(),
  };
}
