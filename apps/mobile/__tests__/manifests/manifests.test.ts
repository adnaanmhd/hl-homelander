// manifests — Phase 2 plan 02-20 source-manifest invariants (D-UPG-03 +
// PERM-04 / PERM-03). The CI gate at apps/mobile/scripts/verify-merged-
// manifests.sh asserts the same invariants on the MERGED output (after
// Gradle's manifest merger has run for both flavors). This test runs at
// vitest time without Gradle: it greps the source manifests directly so
// the contract holds even when Gradle isn't available (CI lanes that just
// run `npm run test`, dev-machine pre-push hooks, etc.).
//
// Coverage:
//   1. apkRollout/AndroidManifest.xml DECLARES REQUEST_INSTALL_PACKAGES.
//   2. main/AndroidManifest.xml does NOT declare REQUEST_INSTALL_PACKAGES
//      (Phase 1 D-FLAV-01 + Phase 2 D-UPG-03 — playStore APK structurally
//      cannot use it).
//   3. (Conditional) playStore/AndroidManifest.xml does NOT declare
//      REQUEST_INSTALL_PACKAGES — Play Store auto-rejects APKs that do.
//      The overlay is permitted to be absent (= no playStore-specific
//      adds), in which case the assertion is a no-op.
//   4. main manifest declares CAMERA + RECORD_AUDIO + ACCESS_COARSE_LOCATION
//      (PERM-04 from plan 02-10 + PERM-03 from plan 02-14). PROJECT.md
//      hard rule: coarse only — never declare ACCESS_FINE_LOCATION.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

/** Strip XML comments before grep so commentary about a permission doesn't false-trigger. */
function strip(file: string): string {
  return readFileSync(file, 'utf-8').replace(/<!--[\s\S]*?-->/g, '');
}

const apkRolloutPath = resolve(ROOT, 'android/app/src/apkRollout/AndroidManifest.xml');
const basePath = resolve(ROOT, 'android/app/src/main/AndroidManifest.xml');
const playStorePath = resolve(ROOT, 'android/app/src/playStore/AndroidManifest.xml');

describe('Phase 2 source-manifest invariants (D-UPG-03 / PERM-04 / PERM-03)', () => {
  it('apkRollout/AndroidManifest.xml declares REQUEST_INSTALL_PACKAGES', () => {
    expect(existsSync(apkRolloutPath)).toBe(true);
    expect(strip(apkRolloutPath)).toMatch(/REQUEST_INSTALL_PACKAGES/);
  });

  it('main/AndroidManifest.xml does NOT declare REQUEST_INSTALL_PACKAGES (T-2.20-03)', () => {
    expect(strip(basePath)).not.toMatch(/REQUEST_INSTALL_PACKAGES/);
  });

  it('playStore/AndroidManifest.xml does NOT declare REQUEST_INSTALL_PACKAGES (Play policy)', () => {
    if (!existsSync(playStorePath)) {
      // Permitted: no playStore overlay = no permission diff. The merged
      // manifest is just the base + apkRollout-overlay-NOT-applied path.
      return;
    }
    expect(strip(playStorePath)).not.toMatch(/REQUEST_INSTALL_PACKAGES/);
  });

  it('main manifest declares CAMERA + RECORD_AUDIO + ACCESS_COARSE_LOCATION (PERM-04 / PERM-03)', () => {
    const base = strip(basePath);
    expect(base).toMatch(/android\.permission\.CAMERA/);
    expect(base).toMatch(/android\.permission\.RECORD_AUDIO/);
    expect(base).toMatch(/android\.permission\.ACCESS_COARSE_LOCATION/);
  });

  it('main manifest does NOT declare ACCESS_FINE_LOCATION (PROJECT.md coarse-only hard rule)', () => {
    expect(strip(basePath)).not.toMatch(/android\.permission\.ACCESS_FINE_LOCATION/);
  });

  it('main manifest does NOT declare POST_NOTIFICATIONS (PROJECT.md no-notifications hard rule)', () => {
    expect(strip(basePath)).not.toMatch(/android\.permission\.POST_NOTIFICATIONS/);
  });

  // Plan 03-07 — Phase 3 D-FGS-01.
  // Two-sided lock for Pitfall 6 (manifest bitmask drift): the runtime
  // bitmask `HumynForegroundService.FGS_TYPE_RECORDING` is asserted in
  // `HumynForegroundServiceTest.kt` (Robolectric); this static gate asserts
  // the manifest string. The two MUST stay in lock-step or Android 14 strict
  // mode throws `MissingForegroundServiceTypeException` at startForeground.
  it('declares HumynForegroundService with foregroundServiceType="camera|microphone|dataSync" (Pitfall 6)', () => {
    const main = strip(basePath);
    expect(main).toMatch(/<service[\s\S]*?android:name="\.fgs\.HumynForegroundService"/);
    expect(main).toMatch(/android:foregroundServiceType="camera\|microphone\|dataSync"/);
    expect(main).toMatch(/<service[\s\S]*?android:exported="false"/);
  });
});
