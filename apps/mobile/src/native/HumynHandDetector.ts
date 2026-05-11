/**
 * HAND-01 / HAND-08 — typed JS bridge for the HumynHandDetector native module.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/
 * HumynHandDetectorModule.kt. Shape parity with the Phase-2 HumynCompat.ts /
 * Phase-3 HumynCapture.ts pattern — same `ensure()` guard, same canonical
 * "not registered" error string. The pre-record hand gate (RecordingScreen,
 * plan 04-04/04-05) calls `detectHands(path)` once per poll-loop tick on a
 * VisionCamera `takePhoto()` capture (HAND-13 memory hygiene lives in the
 * Kotlin body), and `cleanup()` on unmount to free the HandLandmarker.
 *
 * **HAND-08 silent-bypass discriminant.** `isHandDetectorAvailable()` is the
 * single source of truth for "is the native hand-gate wired" — if it returns
 * `false` (the module didn't register, e.g. on a build that excluded MediaPipe,
 * or in a JSDOM unit test that didn't mock `NativeModules`), RecordingScreen
 * silently bypasses the gate (`startGate.bypassed = true`) rather than blocking
 * the user on a dead poll loop. Mirrors Figure's "Minutes" app pattern.
 *
 * Until plan 04-04 (`HumynHandDetectorModule.kt` body) lands, the native side
 * rejects with `NOT_IMPLEMENTED`; the JS bridge surface (the canonical error,
 * the `0.5` default, the HAND-08 discriminant) is contractually final from
 * this plan onward.
 */
import { NativeModules } from 'react-native';

interface HumynHandDetectorNativeModule {
  /**
   * Detect hands in the JPEG/PNG at `path` (an app-internal cacheDir path).
   * Resolves with the hand COUNT only (0 / 1 / 2 — `numHands=2` in the
   * Kotlin HandLandmarkerOptions); never returns landmark coordinates.
   * `minConfidence` is `minHandDetectionConfidence` (HAND-11 Remote Config key).
   */
  detectHands(path: string, minConfidence: number): Promise<number>;
  /** Close the cached HandLandmarker and free its native memory. */
  cleanup(): Promise<void>;
}

function ensure(): HumynHandDetectorNativeModule {
  const native = NativeModules.HumynHandDetector as HumynHandDetectorNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynHandDetector native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * HAND-08 silent-bypass discriminant — `true` iff the native module is
 * registered. RecordingScreen reads this once at mount; if `false` the
 * pre-record hand gate is bypassed (no dead poll loop).
 */
export const isHandDetectorAvailable = (): boolean => NativeModules.HumynHandDetector != null;

/**
 * Run a single-frame hand detection on the image at `path`. Resolves with
 * the hand count (0 / 1 / 2). Rejects with `HAND_DETECT_FAILED` (plan 04-04
 * body) if `decodeFile` returns null or MediaPipe throws — RecordingScreen's
 * poll loop treats a rejection as a miss (count 0). Throws synchronously with
 * the canonical "not registered" error if the native module is absent.
 *
 * Implementation: plan 04-04.
 */
export async function detectHands(path: string, minConfidence = 0.5): Promise<number> {
  return ensure().detectHands(path, minConfidence);
}

/**
 * Close the cached HandLandmarker and free its native memory. No-op (resolves)
 * if the native module isn't registered — callers (RecordingScreen unmount)
 * shouldn't have to guard the bypass case.
 */
export async function cleanup(): Promise<void> {
  const native = NativeModules.HumynHandDetector as HumynHandDetectorNativeModule | undefined;
  if (native) {
    await native.cleanup();
  }
}
