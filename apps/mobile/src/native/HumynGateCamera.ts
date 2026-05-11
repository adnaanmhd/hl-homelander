/**
 * `NativeModules.HumynGateCamera` + the `<HumynGateCameraView>` native component
 * — the native Camera2 pre-record-gate camera (debug session
 * handgate-never-passes, 2026-05-11). Replaces the VisionCamera `<Camera>` that
 * drove the gate: VisionCamera 4.7.3 can't disable autofocus (so the wide lens
 * AF-hunts → blurry gate frames → the 5-consecutive-2-hand streak never
 * completes) and can't reach the back ultrawide on a logical-multi-camera device
 * (Pixel 10a). The native module opens the back logical camera with
 * `CONTROL_AF_MODE_OFF` + a fixed focus distance and drives `CONTROL_ZOOM_RATIO`
 * down to the ultrawide — the same lens/FOV the HumynCapture HEVC recording
 * captures.
 *
 * Lifecycle (RecordingScreen — the `ready` | `pre-flight` | `gate` substates):
 *   1. mount `<HumynGateCameraView style={StyleSheet.absoluteFill}>` (the live
 *      preview) across all three substates — the operator (or a helper) checks
 *      the head-rig placement / hands-in-frame / scene before pressing Start,
 *   2. `await startGate()` on entering `ready` → resolves once the Camera2
 *      device + session are live on the ultrawide; when `gate` (phase `loading`)
 *      is later reached the screen re-emits CAMERA_READY → gate.loading → waiting,
 *   3. per `gate`-waiting poll tick: `await captureFrame(cacheDir/hand-gate/{uuid}.jpg)`
 *      → hand the path to `HumynHandDetector.detectHands` → `RNFS.unlink` it,
 *   4. on the gate→record handoff / leaving the pre-record flow / unmount:
 *      `await stopGate()` → closes the Camera2 session + device so
 *      `HumynCapture.start()` can open Camera2 for the HEVC pipeline (one
 *      back-camera client at a time — the SETTLE_MS dance). The recording
 *      surface itself (`active`) shows NO preview — it dims to ~5% (design-spec §7).
 *
 * Shape parity with HumynHandDetector.ts / HumynCapture.ts: `isGateCameraAvailable()`
 * is the discriminant — if `false` (module didn't register / JSDOM unit test),
 * RecordingScreen falls back to the HAND-08 silent bypass rather than stalling
 * the gate on a dead camera.
 */
import { NativeModules, requireNativeComponent, type ViewStyle } from 'react-native';

interface HumynGateCameraNativeModule {
  /** Open the back ultrawide (AF off, fixed focus); resolves when the preview/grab session is live. */
  startGate(): Promise<void>;
  /** Grab one JPEG to `outPath` (an app-internal cacheDir path); resolves when written. */
  captureFrame(outPath: string): Promise<void>;
  /** Close the Camera2 session + device. Idempotent — safe when nothing is running. */
  stopGate(): Promise<void>;
}

function ensure(): HumynGateCameraNativeModule {
  const native = NativeModules.HumynGateCamera as HumynGateCameraNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynGateCamera native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/** `true` iff the native module is registered. RecordingScreen → HAND-08 bypass when `false`. */
export const isGateCameraAvailable = (): boolean => NativeModules.HumynGateCamera != null;

export async function startGate(): Promise<void> {
  return ensure().startGate();
}

export async function captureFrame(outPath: string): Promise<void> {
  return ensure().captureFrame(outPath);
}

/** Close the gate Camera2 session. No-op (resolves) if the module isn't registered. */
export async function stopGate(): Promise<void> {
  const native = NativeModules.HumynGateCamera as HumynGateCameraNativeModule | undefined;
  if (native) await native.stopGate();
}

/** The live gate-camera preview (native TextureView). Mount full-screen behind the gate ring. */
export const HumynGateCameraView = requireNativeComponent<{ style?: ViewStyle }>(
  'HumynGateCameraView',
);
