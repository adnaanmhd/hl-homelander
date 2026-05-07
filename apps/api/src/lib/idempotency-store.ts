import { createHash } from 'node:crypto';
import { eq, and, lt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

// UUIDv4 regex — wire contract. Plans 05-08 reject any non-UUIDv4 Idempotency-Key.
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const TTL_HOURS = 24;

export function isValidIdempotencyKey(key: string): boolean {
  return UUID_V4_REGEX.test(key);
}

export function hashRequest(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(method)
    .update('\n')
    .update(path)
    .update('\n')
    .update(typeof body === 'string' ? body : JSON.stringify(body ?? null))
    .digest('hex');
}

export interface IdempotencyHit {
  statusCode: number;
  responseBody: unknown;
  requestHash: string;
}

export async function lookup(userId: string, key: string): Promise<IdempotencyHit | null> {
  const rows = await db
    .select()
    .from(schema.idempotencyKeys)
    .where(and(eq(schema.idempotencyKeys.userId, userId), eq(schema.idempotencyKeys.key, key)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0]!;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return {
    statusCode: row.statusCode,
    responseBody: row.responseBody,
    requestHash: row.requestHash,
  };
}

export async function persist(opts: {
  userId: string;
  key: string;
  method: string;
  path: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
  await db
    .insert(schema.idempotencyKeys)
    .values({
      userId: opts.userId,
      key: opts.key,
      method: opts.method,
      path: opts.path,
      requestHash: opts.requestHash,
      statusCode: opts.statusCode,
      responseBody: opts.responseBody as never,
      expiresAt,
    })
    .onConflictDoNothing();
}

export async function gcExpired(): Promise<number> {
  const result = await db
    .delete(schema.idempotencyKeys)
    .where(lt(schema.idempotencyKeys.expiresAt, new Date()));
  // Drizzle returns affected rowCount inconsistently across drivers; assume 0 if undef.
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
