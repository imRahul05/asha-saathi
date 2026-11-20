import { neon } from '@neondatabase/serverless';

/** The only thing the repository needs from a database. Neon in production, embedded Postgres in tests. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

let cached: Db | null = null;

/** Production database: Neon over HTTP (works in serverless functions, no connection pool to manage). */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Attach a Neon database (see README) and add it to .env.local and Vercel.');
  }
  const sql = neon(url);
  cached = {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
  };
  return cached;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
