import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

let pool: Pool | undefined;
export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || '';
    const useSSL =
      url.includes('rds.amazonaws.com') || url.includes('sslmode=') || url.includes('ssl=');
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      // Bug 10 (2026-06-04) — fail fast instead of hanging past the client's 30s
      // transport abort when the pool is exhausted or a query runs away. A
      // connection that can't be acquired in 5s rejects (→ 5xx → the client
      // shows an error + Retry rather than an infinite spinner); any single
      // statement is capped at 15s server-side (generous — the new
      // recordings_user_qa_idx makes the /contributions scans fast).
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
      ssl: useSSL ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export const db = drizzle(getPool(), { schema });
export { schema };
