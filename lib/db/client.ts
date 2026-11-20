import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';

/** The only thing the repository needs from a database. Neon in production, plain Postgres locally, embedded Postgres in tests. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

/** Builds a Db for a connection string. Local URLs use a normal Postgres connection; everything else uses Neon over HTTP. */
export function makeDb(url: string): Db {
  if (isLocal(url)) {
    const pool = new Pool({ connectionString: url, max: 4 });
    return {
      async query<T>(text: string, params: unknown[] = []) {
        const res = await pool.query(text, params as never[]);
        return res.rows as T[];
      },
    };
  }
  // Neon over HTTP: works in serverless functions with no connection pool to manage.
  const sql = neon(url);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
  };
}

let cached: Db | null = null;

export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Attach a Neon database (see README) and add it to .env.local and Vercel.');
  }
  cached = makeDb(url);
  return cached;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
