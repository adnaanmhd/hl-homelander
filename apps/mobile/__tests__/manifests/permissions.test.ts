// PERM-04 / PERM-03 / PERM-01 / PERM-02 — static source-manifest grep gate.
//
// This is the fast-path companion to apps/mobile/scripts/verify-merged-manifests.sh:
//   - The shell script asserts the same invariants on the MERGED manifest after
//     Gradle's manifest merger has run for both flavors. That gate runs in CI
//     under the android-build job (~minutes; needs JDK + Gradle wrapper).
//   - This vitest gate runs against the UN-MERGED source manifests in <5 s on
//     every PR via the lint-typecheck-test job. No Gradle dependency.
//
// Together they form defense-in-depth: this file fails fast if anyone deletes
// a Phase 2 permission line; the merged-manifest script catches anything that
// only the manifest merger could synthesize / overlay (e.g. apkRollout-only
// REQUEST_INSTALL_PACKAGES landing in playStore by mistake).
//
// PERM-04 closure (plan 02-22 wave 5).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

/** Strip XML comments before grep so commentary about a permission can't
 *  false-trigger an assertion (the base manifest has long doc-comments at the
 *  top mentioning every PROJECT.md hard rule). */
function strip(file: string): string {
  return readFileSync(file, 'utf-8').replace(/<!--[\s\S]*?-->/g, '');
}

/** PERM-04 codifies manifest-only declarations for foreground service, wake
 *  lock, and network state. PERM-01 + PERM-02 add CAMERA + RECORD_AUDIO. Bug 3 /
 *  D3 + D4 (2026-06-04) adds ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION —
 *  precise GPS overrides the formerly-LOCKED coarse-only rule (sign-off D3); the
 *  runtime prompts are gated in PermissionsScreen (D4 — block-until-granted). */
const REQUIRED_BASE_PERMISSIONS = [
  'android.permission.CAMERA', // PERM-01 (runtime prompt + manifest)
  'android.permission.RECORD_AUDIO', // PERM-02
  'android.permission.ACCESS_FINE_LOCATION', // Bug 3 / D3 (precise GPS; gated in onboarding)
  'android.permission.ACCESS_COARSE_LOCATION', // BUG-1: declared so the OS will grant FINE (Android 12+ needs both); a coarse-only grant is NOT accepted in app logic

  'android.permission.FOREGROUND_SERVICE', // PERM-04
  'android.permission.FOREGROUND_SERVICE_CAMERA', // PERM-04 (Phase 3 capture FGS)
  'android.permission.FOREGROUND_SERVICE_MICROPHONE', // PERM-04
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC', // PERM-04 (Phase 5 upload FGS)
  'android.permission.WAKE_LOCK', // PERM-04
  'android.permission.ACCESS_NETWORK_STATE', // PERM-04
  'android.permission.HIGH_SAMPLING_RATE_SENSORS', // COMPAT-02 (Phase 2) — IMU probe needs >200 Hz sampling on Android 12+ (API 31+)
];

describe('PERM-04 — main AndroidManifest.xml declarations', () => {
  const main = strip(resolve(ROOT, 'android/app/src/main/AndroidManifest.xml'));
  for (const perm of REQUIRED_BASE_PERMISSIONS) {
    it(`declares ${perm}`, () => {
      // Match android:name="android.permission.X" — escape dots so the regex
      // doesn't match unrelated 'permission_CAMERA_etc' identifiers.
      expect(main).toMatch(new RegExp(`android:name="${perm.replace(/\./g, '\\.')}"`));
    });
  }
});

describe('apkRollout-only flavor manifest', () => {
  const apkRollout = strip(resolve(ROOT, 'android/app/src/apkRollout/AndroidManifest.xml'));
  const main = strip(resolve(ROOT, 'android/app/src/main/AndroidManifest.xml'));

  it('apkRollout declares REQUEST_INSTALL_PACKAGES (UPG-03 / D-APK-02)', () => {
    expect(apkRollout).toMatch(/REQUEST_INSTALL_PACKAGES/);
  });

  it('main does NOT declare REQUEST_INSTALL_PACKAGES (Play policy — T-2.20-03)', () => {
    expect(main).not.toMatch(/REQUEST_INSTALL_PACKAGES/);
  });
});
