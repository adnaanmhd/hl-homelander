import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

let pool: Pool | undefined;
export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || '';
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl:
        url.includes('sslmode=') || url.includes('ssl=')
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }
  return pool;
}

export const db = drizzle(getPool(), { schema });
export { schema };
