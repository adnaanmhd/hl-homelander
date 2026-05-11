package ai.humynlabs.capture.gatecamera

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * `NativeModules.HumynGateCamera` — the JS bridge to [GateCameraController], the
 * native Camera2 pre-record-gate camera (debug session handgate-never-passes,
 * 2026-05-11; replaces the VisionCamera `<Camera>` gate). RecordingScreen:
 *
 *   - on entering the `gate` substate, mounts `<HumynGateCameraView>` and calls
 *     [startGate] → resolves once the Camera2 device + session are up on the
 *     ultrawide with AF off (this is the CAMERA_READY signal);
 *   - per gate-poll tick, calls [captureFrame] with a cacheDir path → a JPEG is
 *     written there → JS hands it to `HumynHandDetector.detectHands` → unlinks it;
 *   - on the gate→record handoff (and on unmount), calls [stopGate] → closes the
 *     session + camera so `HumynCapture.start()` can open Camera2 for the HEVC
 *     recording (one back-camera client at a time).
 *
 * Shape parity with the Phase-2/3/4 native-module triad (HumynCompat /
 * HumynCapture / HumynHandDetector): registered unconditionally in
 * `MainApplication.getPackages()`; JS guards `NativeModules.HumynGateCamera ==
 * null` and falls back to the HAND-08 silent-bypass if it's somehow absent.
 */
@ReactModule(name = HumynGateCameraModule.NAME)
class HumynGateCameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynGateCamera"
    }

    override fun getName(): String = NAME

    /** Open the back ultrawide with AF off + fixed focus; resolve when the preview/grab session is live. */
    @ReactMethod
    fun startGate(promise: Promise) {
        GateCameraController.start(reactApplicationContext) { result ->
            result.fold(
                onSuccess = { promise.resolve(null) },
                onFailure = { promise.reject("GATE_CAMERA_START_FAILED", it.message, it) },
            )
        }
    }

    /** Grab one JPEG to `outPath` (an app-internal cacheDir path); resolve when written. */
    @ReactMethod
    fun captureFrame(outPath: String, promise: Promise) {
        GateCameraController.captureFrame(outPath) { result ->
            result.fold(
                onSuccess = { promise.resolve(null) },
                onFailure = { promise.reject("GATE_CAMERA_CAPTURE_FAILED", it.message, it) },
            )
        }
    }

    /** Close the Camera2 session + device. Idempotent — safe to call when nothing is running. */
    @ReactMethod
    fun stopGate(promise: Promise) {
        GateCameraController.stop { result ->
            result.fold(
                onSuccess = { promise.resolve(null) },
                onFailure = { promise.reject("GATE_CAMERA_STOP_FAILED", it.message, it) },
            )
        }
    }
}
