import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../db/index.js';

const TTL_MS = 5 * 60 * 1000; // 5 minutes per RESEARCH §2.6

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export interface MintedNonce {
  nonceId: string; // ULID
  nonce: string; // base64url(32 random bytes) — the value the client sends to Play Integrity
}

export async function mintNonce(): Promise<MintedNonce> {
  const nonceId = ulid();
  const nonce = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(schema.authNonces).values({
    id: nonceId,
    nonceSha256: sha256Hex(nonce),
    expiresAt,
  });
  return { nonceId, nonce };
}

// Look up + delete in one transaction. Single-use semantics: the row is always
// deleted on lookup so it cannot be reused. Returns ok=true only if the row
// existed, was not expired, and the candidate hash matched the stored one.
export async function consumeNonce(opts: {
  nonceId: string;
  candidateNonce: string;
}): Promise<{ ok: true } | { ok: false; reason: 'absent' | 'expired' | 'mismatch' }> {
  const candHash = sha256Hex(opts.candidateNonce);
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.authNonces)
      .where(eq(schema.authNonces.id, opts.nonceId))
      .limit(1);
    if (rows.length === 0) return { ok: false as const, reason: 'absent' as const };
    const row = rows[0]!;
    // Always delete — single-use semantics
    await tx.delete(schema.authNonces).where(eq(schema.authNonces.id, opts.nonceId));
    if (row.expiresAt.getTime() < Date.now())
      return { ok: false as const, reason: 'expired' as const };
    if (row.nonceSha256 !== candHash) return { ok: false as const, reason: 'mismatch' as const };
    return { ok: true as const };
  });
  return result;
}

// GC — runs every 60s in process. Idempotent.
export async function gcExpiredNonces(): Promise<number> {
  const result = await db
    .delete(schema.authNonces)
    .where(lt(schema.authNonces.expiresAt, new Date()));
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

let gcTimer: NodeJS.Timeout | undefined;
export function startNonceGc(): void {
  if (gcTimer) return;
  gcTimer = setInterval(() => {
    gcExpiredNonces().catch(() => {
      /* logged at handler scope */
    });
  }, 60_000);
  // Don't keep the event loop alive on its own
  gcTimer.unref?.();
}
export function stopNonceGc(): void {
  if (gcTimer) {
    clearInterval(gcTimer);
    gcTimer = undefined;
  }
}
