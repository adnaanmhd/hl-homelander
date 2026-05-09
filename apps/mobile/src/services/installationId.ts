// Mint-or-read the per-install UUID. Authoritative store is Kotlin
// SharedPreferences (`humyn_install` / `installation_id`) so a JS-side MMKV
// wipe doesn't lose the canonical identifier. We mirror the value into MMKV
// at `installation_id.v1` for sync access from the compat-signature builder
// (D-COMPAT-03) and from any other call site that doesn't want to await.
//
// Phase 2 D-COMPAT-03; Open Question 3 resolution (avoid adding a JS UUID
// library — Kotlin's java.util.UUID.randomUUID() is the only producer).

import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { getOrMintInstallationId as nativeMintOrFetch } from '../native/AppFlavor';

/**
 * Returns the per-install UUID, minting it via Kotlin
 * SharedPreferences on first call and caching the value into MMKV
 * (`installation_id.v1`) for sync reads. Subsequent calls short-circuit
 * on the MMKV cache without touching the bridge.
 *
 * Always call this once at app boot (from hydrate / compatService init)
 * so the sync companion `getInstallationIdSync()` is safe to use elsewhere.
 */
export async function getInstallationId(): Promise<string> {
  const cached = secureMmkv.getString(KEYS.INSTALLATION_ID);
  if (cached) return cached;
  const minted = await nativeMintOrFetch();
  secureMmkv.set(KEYS.INSTALLATION_ID, minted);
  return minted;
}

/**
 * Sync read; returns null if the JS-side cache hasn't been hydrated yet.
 * Use only AFTER `getInstallationId()` has been awaited at least once
 * during this app session.
 */
export function getInstallationIdSync(): string | null {
  return secureMmkv.getString(KEYS.INSTALLATION_ID) ?? null;
}
