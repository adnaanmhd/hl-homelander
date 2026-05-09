// upgradeFlow — D-UPG-01..02 per-flavor upgrade orchestration (plan 02-20).
//
// Two flavors, two install paths:
//   - apkRollout → HumynUpdater.downloadAndVerifyApk(url, expectedSha256)
//                  followed by HumynUpdater.launchInstaller(path).
//                  The Kotlin side (plan 02-07) deletes the partial download
//                  on SHA-256 mismatch and rejects with HASH_MISMATCH; we
//                  detect that error code, emit a distinct catastrophic
//                  Analytics event (defense-in-depth atop the Kotlin gate),
//                  and surface a typed error so the screen can render the
//                  integrity-check copy from D-UPG-02.
//   - playStore  → Linking.openURL('market://details?id=<applicationId>'),
//                  with the https://play.google.com/... URL as a fallback
//                  for AOSP / non-Play devices that don't have the Play
//                  Store handler registered.
//
// iosAppStore is Phase 7 territory; the function throws a typed
// `upgrade_flavor_not_supported_phase2` error so a misconfigured iOS build
// landing here surfaces a clear diagnostic instead of silently succeeding.
//
// Security note (T-2.20-01): the upgradeFlow MUST NEVER hand a hash-mismatched
// APK to launchInstaller. The Kotlin-side gate is authoritative; this file's
// job is simply to translate the rejection into a JS error + Analytics event
// and refuse to call launchInstaller(). The shape of the gate — try/catch
// around downloadAndVerifyApk + ONLY call launchInstaller inside the success
// branch — is the structural mitigation.

import { Linking } from 'react-native';
import { downloadAndVerifyApk, launchInstaller } from '../native/HumynUpdater';
import { getFlavorContext } from '../native/AppFlavor';
import { logEvent, type EventName } from '../util/analytics';
import type { AppVersionResponse } from '@humyn/shared-types';

/**
 * Catastrophic event names. The hash-mismatch event MUST always be logged
 * (D-UPG-02) — it's the single ground-truth signal that the in-app upgrade
 * channel encountered a tampered APK.
 */
export const ANALYTICS_EVENTS = {
  forceUpgradeApkHashMismatch: 'upg_force_upgrade_apk_hash_mismatch',
  forceUpgradeApkDownloadFailed: 'upg_force_upgrade_apk_download_failed',
} as const satisfies Record<string, EventName>;

export interface UpgradeFlowDeps {
  /**
   * Override the Analytics emitter — defaults to the canonical
   * `logEvent(name, props)` from util/analytics. The override is tested
   * directly in upgradeFlow.test.ts; production callers leave it undefined.
   */
  logEvent?: (name: EventName, props: Record<string, string | number | boolean>) => void;
}

/**
 * Detect whether the rejected error message indicates a SHA-256 mismatch.
 * The Kotlin module rejects with `HASH_MISMATCH` (NativeModuleException
 * code) but the React Native bridge surfaces the message string — match
 * loosely so we catch any of: "HASH_MISMATCH", "apk_sha256_mismatch",
 * "hash mismatch", "integrity check failed", etc.
 */
function isHashMismatchError(message: string): boolean {
  return /hash[_\s-]?mismatch|sha256[_\s-]?mismatch|integrity/i.test(message);
}

/**
 * Per-flavor upgrade orchestration. Throws on every error path so callers
 * can surface a single in-screen Alert; specific failure modes are
 * disambiguated by `error.message`:
 *   - `apk_hash_mismatch`         — Kotlin-side SHA-256 verification failed.
 *                                   The screen MUST show the integrity-check
 *                                   copy and offer Retry.
 *   - `apk_download_failed`       — generic download failure (network, disk).
 *   - `playstore_open_failed`     — both market:// and https fallback failed.
 *   - `upgrade_flavor_not_supported_phase2:<flavor>` — iosAppStore in
 *                                   Phase 2 (Phase 7 lands the iOS path).
 */
export async function startUpgrade(
  payload: AppVersionResponse,
  deps: UpgradeFlowDeps = {},
): Promise<void> {
  const emit = deps.logEvent ?? logEvent;

  if (payload.flavor === 'apkRollout') {
    let path: string;
    try {
      const result = await downloadAndVerifyApk(payload.apkUrl, payload.apkSha256);
      path = result.path;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (isHashMismatchError(msg)) {
        // T-2.20-01 catastrophic event — fires whenever a tampered or
        // corrupted APK reached the device. Operator playbook: investigate
        // CDN egress + signing pipeline immediately.
        emit(ANALYTICS_EVENTS.forceUpgradeApkHashMismatch, {
          apkUrl: payload.apkUrl,
          expectedSha256: payload.apkSha256,
          errorMessage: msg,
        });
        throw new Error('apk_hash_mismatch');
      }
      emit(ANALYTICS_EVENTS.forceUpgradeApkDownloadFailed, {
        apkUrl: payload.apkUrl,
        errorMessage: msg,
      });
      throw new Error('apk_download_failed');
    }
    // Reached only on success — guarantees we never hand a mismatched APK
    // to PackageInstaller (defense-in-depth above the Kotlin gate).
    await launchInstaller(path);
    return;
  }

  if (payload.flavor === 'playStore') {
    // Resolve applicationId via AppFlavor native module so the URL matches
    // the running APK's identity (apkRollout = ai.humynlabs.capture.apk;
    // playStore = ai.humynlabs.capture). For the playStore branch we only
    // ever expect the latter, but reading from AppFlavor avoids a
    // hard-coded constant drifting from D-FLAV-01.
    let applicationId = 'ai.humynlabs.capture';
    try {
      applicationId = getFlavorContext().applicationId;
    } catch {
      // AppFlavor native module not registered — fall back to the canonical
      // playStore applicationId. Tests that run without the native module
      // still hit the deterministic URL.
    }
    const marketUrl = `market://details?id=${applicationId}`;
    const fallbackUrl = `https://play.google.com/store/apps/details?id=${applicationId}`;
    try {
      await Linking.openURL(marketUrl);
      return;
    } catch {
      try {
        await Linking.openURL(fallbackUrl);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        throw new Error(`playstore_open_failed:${msg}`);
      }
    }
  }

  // iosAppStore — Phase 7 surface. Surface a clear typed error so a
  // misconfigured iOS build (which shouldn't reach Phase 2 anyway) doesn't
  // silently no-op.
  throw new Error(`upgrade_flavor_not_supported_phase2:${payload.flavor}`);
}

/** apkRollout flavor guard — for screens that need to short-circuit before calling startUpgrade. */
export function isApkRolloutPayload(
  p: AppVersionResponse,
): p is Extract<AppVersionResponse, { flavor: 'apkRollout' }> {
  return p.flavor === 'apkRollout';
}
