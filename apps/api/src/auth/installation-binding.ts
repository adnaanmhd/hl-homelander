import { eq } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';
import { db, schema } from '../db/index.js';

/**
 * Bug 4 / D2 (2026-06-04) — single-device newest-login-wins binding.
 *
 * Short-TTL in-process cache of `sub → current_installation_id` so the
 * per-request newest-wins check in `requireAuth` costs a DB read only on a
 * cache miss (or after a sign-in invalidates the entry). This is the mitigation
 * that keeps stateful auth (overriding LOCKED D-AUTH-03) cheap — see the D2 risk
 * register row in `IMPLEMENTATION-PLAN-260604.md`.
 *
 * A missing / deleted user row, or a row with no binding yet (pre-Bug-4 NULL),
 * caches the [EVICTED_SENTINEL] (`''`) — which can never equal a real
 * (non-empty) installationId — so a legacy / unbound session always 401s.
 */
const EVICTED_SENTINEL = '';

// ⚠ SINGLE-INSTANCE INVARIANT (D2): this cache is in-process and
// `invalidateInstallation` busts only the LOCAL process. At MVP the API runs as a
// single ECS task (`desired_count = 1`), so a sign-in's invalidation is globally
// authoritative and eviction is immediate (0 s). If the API is EVER scaled to >1
// instance, a device evicted on instance A can stay authorized on instance B for
// up to the TTL below. Before scaling out, switch to read-through (drop the cache
// — the lookup is one indexed PK read) or a shared invalidation channel. Do NOT
// raise the task count without addressing this (Redis was removed Enh 3 / D1, so
// there is no shared cache to invalidate across instances today).
const installationCache = new LRUCache<string, string>({
  max: 50_000,
  ttl: 60_000, // 60s — bounds the worst-case multi-instance eviction lag (see above).
});

/**
 * Resolve the account's currently-bound installationId (cached). Returns `''`
 * when the user row is missing/deleted or has no binding yet — that sentinel
 * never matches a real installationId, so the caller 401s.
 */
export async function getCurrentInstallationId(sub: string): Promise<string> {
  const cached = installationCache.get(sub);
  if (cached !== undefined) return cached;
  const rows = await db
    .select({ cur: schema.users.currentInstallationId })
    .from(schema.users)
    .where(eq(schema.users.id, sub))
    .limit(1);
  const value = rows[0]?.cur ?? EVICTED_SENTINEL;
  installationCache.set(sub, value);
  return value;
}

/**
 * Drop the cached binding for a sub. Call AFTER a sign-in rebinds the row so the
 * new device's installationId is authoritative on its very next request (and
 * the prior device is evicted without waiting out the TTL).
 */
export function invalidateInstallation(sub: string): void {
  installationCache.delete(sub);
}

/** Test-only — clear the whole cache between tests (no cross-test bleed). */
export function _clearInstallationCache(): void {
  installationCache.clear();
}
