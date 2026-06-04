/**
 * `NativeModules.HumynLivePreview` + the `<HumynLivePreviewView>` native
 * component — the live ultrawide preview during recording (Phase 7 plan
 * 07-07; D-25). Unlike `<HumynGateCameraView>` (which opens its own Camera2
 * session for the pre-record hand gate), this view does NOT open a camera
 * client of its own — it just publishes a `Surface` to a native singleton
 * (`LivePreviewSurfaceRegistry`) that the existing `HumynCapture` Camera2
 * session uses as a SECOND output target during the 15-s initial-preview
 * + rolling 10-s tap-revealed windows. One back-camera client at a time
 * (the gate camera fully closes before HumynCapture.start) — REC-LIVE
 * shares the recording session's Camera2 device.
 *
 * Lifecycle (RecordingScreen — the brightness state machine in
 * `apps/mobile/src/lib/livePreviewState.ts`):
 *   - mount `<HumynLivePreviewView style={StyleSheet.absoluteFill}>` during
 *     the 'initial-preview' (15 s) and 'tap-revealed' (rolling 10 s)
 *     states of the 'active' substate;
 *   - unmount during 'dimmed' (the 5% brightness window per D-28). When the
 *     view unmounts, the TextureView's `onSurfaceTextureDestroyed`
 *     callback clears the registry slot, and CaptureSession's
 *     `onRemoveTarget` rebuilds its `setRepeatingRequest` without the
 *     preview target.
 *
 * Shape parity with `HumynGateCamera.ts`: `isLivePreviewAvailable()` is the
 * cheap synchronous discriminant — `true` iff the native module is
 * registered. The full `isLivePreviewSurfacePublished()` async check
 * additionally verifies a Surface is currently published (the view is
 * mounted AND its SurfaceTexture has fired its `available` callback).
 * RecordingScreen uses the sync discriminant in JSX to gate the mount.
 */
import { NativeModules, requireNativeComponent, type ViewStyle } from 'react-native';

interface HumynLivePreviewNativeModule {
  /** Resolves `true` iff the registry slot currently holds a Surface. Best-effort. */
  isAvailable(): Promise<boolean>;
}

function ensure(): HumynLivePreviewNativeModule {
  const native = NativeModules.HumynLivePreview as HumynLivePreviewNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynLivePreview native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * `true` iff the native module is registered in the build. RecordingScreen
 * uses this as the JSX-time gate: when `false` (module not registered — e.g.
 * a future iOS build that hasn't shipped the iOS analogue per the deferred
 * §v2 iOS scope), the recording proceeds dimmed-only with no crash.
 */
export const isLivePreviewAvailable = (): boolean => NativeModules.HumynLivePreview != null;

/**
 * Async query — resolves `true` iff the view is currently mounted AND its
 * SurfaceTexture has published a Surface to `LivePreviewSurfaceRegistry`.
 * Useful for diagnostics / future telemetry; not the JSX-time mount gate
 * (that's the sync `isLivePreviewAvailable()` above).
 */
export async function isLivePreviewSurfacePublished(): Promise<boolean> {
  try {
    return await ensure().isAvailable();
  } catch {
    return false;
  }
}

/**
 * The live ultrawide preview (Camera2-fed TextureView). Mount full-screen
 * during the 'initial-preview' and 'tap-revealed' brightness substates of
 * the active recording state.
 */
export const HumynLivePreviewView = requireNativeComponent<{
  style?: ViewStyle;
  /** Standard RN view prop — forwarded to the native TextureView for a11y +
   *  testability (RecordingScreen tags it "recording-live-preview"). */
  accessibilityLabel?: string;
}>('HumynLivePreviewView');
