// versionService — splash-time bootstrap for D-UPG-04..07 + UPG-01/02/05.
//
// Wraps `GET /app/version?flavor={flavor}` with:
//   - 6 h MMKV cache (UPG-05)
//   - 5 s AbortController timeout (T-2.8-03 mitigation; never blocks splash > 2.4 s)
//   - schema validation against AppVersionResponseSchema (T-2.8-02 first layer
//     of defense; HumynUpdater hashes the APK as the second layer)
//   - graceful network-failure semantics: returns stale cache if any, else
//     null; the caller (SplashScreen) skips the gate when null and trusts
//     next-foreground to re-check (UPG-04 "don't punish offline users")
//
// `computeUpgradeAction()` is a pure function over (installedVersion, response)
// that the SplashScreen consumes to decide between force-upgrade,
// soft-banner, and "all good". Phase 2 plan 02-20 fills the
// ForceUpgradeScreen body; this file only flips the gate flags.

import { AppVersionResponseSchema, type AppVersionResponse } from '@humyn/shared-types';
import { apiClient } from './api';
import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { useAppStore } from '../state/appStore';
import { getFlavorContext } from '../native/AppFlavor';
import { compareSemver } from '../util/semver';
import { logEvent } from '../util/analytics';

/** 6 hours per UPG-05. Re-check forced after this many ms since the last fetch. */
export const MAX_CACHE_AGE_MS = 6 * 60 * 60 * 1000;
/** 5 s timeout per T-2.8-03 — splash never blocks longer than this on network. */
export const FETCH_TIMEOUT_MS = 5000;

interface CacheEntry {
  response: AppVersionResponse;
  fetchedAt: number;
}

export type UpgradeAction =
  | { action: 'none' }
  | { action: 'soft-banner'; latest: string }
  | { action: 'force-upgrade'; reason: 'below-min-supported' | 'flag-set' };

/**
 * Read MMKV `appVersion.cache.v1`. Returns null on miss or corrupt blob;
 * never throws (a tampered cache is a soft failure — the live fetch is the
 * authoritative source for force-upgrade decisions, T-2.8-01 disposition).
 */
function readCache(): CacheEntry | null {
  const raw = secureMmkv.getString(KEYS.APP_VERSION_CACHE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CacheEntry> | null;
    if (
      parsed &&
      typeof parsed.fetchedAt === 'number' &&
      parsed.response &&
      typeof parsed.response === 'object'
    ) {
      return parsed as CacheEntry;
    }
  } catch {
    // corrupt cache — fall through to null
  }
  return null;
}

/**
 * Fetch + cache the per-flavor `/app/version` response. Cache hit when
 * `now - fetchedAt < 6h` (UPG-05). On schema mismatch or network failure,
 * returns the stale cache when present, else null. Pass `force=true` to
 * skip the cache (e.g. on next-foreground re-check).
 *
 * Side-effect: on success, writes the entry to MMKV AND mirrors it into
 * the Zustand store so `useAppStore.getState().appVersionCache` is the
 * single in-memory source of truth.
 */
export async function fetchAppVersion(force = false): Promise<AppVersionResponse | null> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < MAX_CACHE_AGE_MS) {
    useAppStore.getState().setAppVersionCache(cached);
    return cached.response;
  }
  const { flavor } = getFlavorContext();
  logEvent('upg_check_started', { flavor });
  try {
    const raw = await apiClient.getJson<unknown>('/app/version', {
      query: { flavor },
      timeoutMs: FETCH_TIMEOUT_MS,
    });
    const parsed = AppVersionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      // T-2.8-02 first layer of defense: invalid wire shape → prefer the
      // last-known-good cache over a tampered live response.
      return cached?.response ?? null;
    }
    const entry: CacheEntry = { response: parsed.data, fetchedAt: Date.now() };
    secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify(entry));
    useAppStore.getState().setAppVersionCache(entry);
    return parsed.data;
  } catch {
    // Network failure — UPG-04 "don't punish offline users". Hand back the
    // last-known-good if we have one; null otherwise (caller skips gate).
    return cached?.response ?? null;
  }
}

/**
 * Decide the upgrade gate from an installed version + a wire response.
 * Pure function — no MMKV reads, no side-effects. Decision order:
 *   1. installed < minSupported  → force-upgrade (below-min-supported)
 *   2. forceUpgrade flag set     → force-upgrade (flag-set, ops escape hatch)
 *   3. installed < latest        → soft-banner with latest
 *   4. otherwise                 → none
 */
export function computeUpgradeAction(
  installedVersion: string,
  response: AppVersionResponse,
): UpgradeAction {
  if (compareSemver(installedVersion, response.minSupported) < 0) {
    return { action: 'force-upgrade', reason: 'below-min-supported' };
  }
  if (response.forceUpgrade) {
    return { action: 'force-upgrade', reason: 'flag-set' };
  }
  if (compareSemver(installedVersion, response.latest) < 0) {
    return { action: 'soft-banner', latest: response.latest };
  }
  return { action: 'none' };
}
