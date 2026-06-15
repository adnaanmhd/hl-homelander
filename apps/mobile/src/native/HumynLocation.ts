import { NativeModules } from 'react-native';
import type { Location } from '@humyn/shared-types';

/**
 * Bug 3 / D3 (2026-06-04) — JS contract for `NativeModules.HumynLocation`.
 *
 * The Kotlin module
 * (apps/mobile/android/app/src/main/java/ai/humynlabs/capture/HumynLocationModule.kt)
 * resolves ONE precise GPS fix via FusedLocationProviderClient
 * .getCurrentLocation(PRIORITY_HIGH_ACCURACY) and reverse-geocodes a "City,
 * Country" label. The fix is embedded into `CaptureSessionOpts.location` →
 * metadata.json `capture_device_info.location` (schema 1.5.0).
 *
 * **Overrides the formerly-LOCKED "no precise GPS leaves the device" constraint**
 * (owner sign-off D3; consent-text + DPIA is a SHIP gate). The native side never
 * rejects — an unavailable fix resolves `null` (a valid outcome the metadata
 * records as `location: null`). iOS analogue deferred with the other iOS native
 * modules — `resolveLocationFix` returns null when the module is unregistered.
 */
interface HumynLocationNativeModule {
  /** Resolve a single fix (or null) within `timeoutMs`. Never rejects. */
  getCurrentFix(timeoutMs: number): Promise<Location | null>;
}

const native = NativeModules.HumynLocation as HumynLocationNativeModule | undefined;

/** Default acquisition budget — matches the native DEFAULT_TIMEOUT_MS. */
export const DEFAULT_LOCATION_TIMEOUT_MS = 10_000;

/**
 * Resolve the precise GPS fix for the current capture session, or `null` when
 * unavailable (no fix in time, permission edge, or — on iOS / in unit tests —
 * the native module is unregistered). Best-effort: NEVER throws, so a missing
 * fix can never block a recording. The caller embeds the result verbatim into
 * `buildCaptureOpts({ location })`.
 */
export async function resolveLocationFix(
  timeoutMs: number = DEFAULT_LOCATION_TIMEOUT_MS,
): Promise<Location | null> {
  if (!native) return null;
  try {
    return await native.getCurrentFix(timeoutMs);
  } catch {
    // Native side is contracted not to reject, but stay defensive — an
    // unexpected bridge error must degrade to "no fix", not crash capture.
    return null;
  }
}
