/**
 * D-UPG-01..03 — typed JS bridge for the HumynUpdater native module.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/
 * HumynUpdaterModule.kt. Two methods:
 *
 *   - downloadAndVerifyApk(url, expectedSha256) → Promise<{path, sha256}>
 *     streams to cacheDir while computing SHA-256, deletes-and-fails on
 *     mismatch (T-2.7-01). HASH_MISMATCH and DOWNLOAD_FAILED error codes.
 *
 *   - launchInstaller(apkPath) → Promise<boolean>
 *     opens a PackageInstaller.Session; deep-links to the per-app
 *     "Install unknown apps" settings if not granted (RESEARCH § Pitfall 8).
 *     INSTALL_NOT_ALLOWED and INSTALL_FAILED error codes.
 *
 * **Defensive flavor guard** — RESEARCH § Pattern 3 mandates that this bridge
 * MUST refuse the call before touching NativeModules when the running flavor
 * is anything other than 'apkRollout'. The native module is registered
 * unconditionally in MainApplication.getPackages(), but the playStore APK's
 * AndroidManifest does NOT declare REQUEST_INSTALL_PACKAGES, so a runtime
 * call would fail anyway — this guard fails earlier with a descriptive error.
 *
 * If the native module is not registered (e.g. running in a JSDOM unit test
 * that didn't mock NativeModules), each function rejects with an error
 * containing "HumynUpdater native module not registered" so the caller can
 * disambiguate "missing wiring" from "flavor scope" from "install failed".
 *
 * Plan 02-20 wires this into ForceUpgradeScreen for the apkRollout track.
 */
import { NativeModules } from 'react-native';
import { getFlavorContext } from './AppFlavor';

export interface DownloadResult {
  /** Absolute path to the verified APK file inside cacheDir. */
  path: string;
  /** Lowercase hex SHA-256 of the downloaded bytes (matches the expected hash). */
  sha256: string;
}

interface HumynUpdaterNativeModule {
  downloadAndVerifyApk(url: string, expectedSha256: string): Promise<DownloadResult>;
  launchInstaller(apkPath: string): Promise<boolean>;
}

function ensureApkRolloutFlavor(): void {
  const ctx = getFlavorContext();
  if (ctx.flavor !== 'apkRollout') {
    throw new Error(
      `HumynUpdater is only valid on the apkRollout flavor; current flavor=${ctx.flavor}. Use the market:// fallback for playStore.`,
    );
  }
}

function ensure(): HumynUpdaterNativeModule {
  ensureApkRolloutFlavor();
  const native = NativeModules.HumynUpdater as HumynUpdaterNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynUpdater native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * Download `url` to cacheDir while streaming SHA-256, verify against
 * `expectedSha256`. On mismatch the native side deletes the partial file
 * before rejecting (T-2.7-01 mitigation). Rejects on HASH_MISMATCH or
 * DOWNLOAD_FAILED.
 */
export async function downloadAndVerifyApk(
  url: string,
  expectedSha256: string,
): Promise<DownloadResult> {
  return ensure().downloadAndVerifyApk(url, expectedSha256);
}

/**
 * Hand off the verified APK at `apkPath` to PackageInstaller.Session. If the
 * user has not granted "Install unknown apps" for THIS app, deep-links to
 * the per-app Settings screen and rejects with INSTALL_NOT_ALLOWED — caller
 * (ForceUpgradeScreen) is expected to surface a "tap Allow then return"
 * affordance and re-attempt. Rejects on INSTALL_NOT_ALLOWED or INSTALL_FAILED.
 */
export async function launchInstaller(apkPath: string): Promise<boolean> {
  return ensure().launchInstaller(apkPath);
}
