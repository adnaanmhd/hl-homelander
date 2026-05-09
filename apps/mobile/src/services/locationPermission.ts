/**
 * PERM-03 — coarse Location permission helper.
 *
 * NOT prompted in Phase 2 onboarding. Phase 4 (first-recording flow) will call
 * `requestCoarseLocation()` immediately before kicking off the first capture.
 *
 * The manifest declaration ships in this same plan (02-14) — see
 * apps/mobile/android/app/src/main/AndroidManifest.xml. This helper exists so
 * Phase 4 lands without re-discovering the API surface or the per-permission
 * status mapping.
 *
 * PROJECT.md hard rule: coarse only — no precise GPS leaves the device.
 *
 * Status mapping mirrors the Camera + Mic helpers (02-10) — `granted` /
 * `denied` / `blocked` / `limited` / `unavailable`. Unknown statuses fall
 * through to `unavailable` so callers always receive a typed value.
 */
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';

export type CoarseLocationStatus = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'limited';

const PERM: Permission = PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION;

/**
 * Read-only status check. Does NOT prompt the system dialog. Use this to
 * decide whether to surface a "Why we need this" rationale before calling
 * `requestCoarseLocation()`.
 */
export async function checkCoarseLocation(): Promise<CoarseLocationStatus> {
  const status = await check(PERM);
  return mapStatus(status);
}

/**
 * Triggers the OS permission prompt the first time it is called for this
 * permission on this install. Subsequent calls resolve immediately to the
 * persisted status. If the user has previously selected "Don't ask again"
 * (Android) the call resolves to `blocked` without showing a dialog —
 * callers should send the user to Settings via `Linking.openSettings()` in
 * that branch.
 */
export async function requestCoarseLocation(): Promise<CoarseLocationStatus> {
  const status = await request(PERM);
  return mapStatus(status);
}

function mapStatus(status: PermissionStatus): CoarseLocationStatus {
  switch (status) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.LIMITED:
      return 'limited';
    case RESULTS.UNAVAILABLE:
      return 'unavailable';
    default:
      return 'unavailable';
  }
}
