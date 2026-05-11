package ai.humynlabs.capture.handdetector

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.Executors

/**
 * HAND-01 / HAND-08 — TurboModule entry point for `NativeModules.HumynHandDetector`.
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). Two `@ReactMethod`s:
 *
 *   1. [detectHands] — single-frame MediaPipe HandLandmarker detection on a
 *      JPEG/PNG at an app-internal cacheDir path; resolves with the hand
 *      COUNT only (0 / 1 / 2 — `numHands=2`). `minConfidence` is
 *      `minHandDetectionConfidence` (HAND-11 Remote Config key).
 *   2. [cleanup] — closes the cached `HandLandmarker` and frees its native
 *      memory; called on RecordingScreen unmount.
 *
 * Both methods dispatch to a single-thread background executor (never block
 * the JS thread — BitmapFactory.decodeFile + MediaPipe inference on JS would
 * freeze the gate UI).
 *
 * **SHELL.** This plan (04-02) ships the contract surface only. The real
 * MediaPipe body — `HandLandmarker.createFromOptions(...)` with
 * `setModelAssetPath("hand_landmarker.task")`, `RunningMode.IMAGE`,
 * `setNumHands(2)`, plus HAND-13 memory hygiene (RGB_565 decode, 320×240
 * downscale, explicit `bitmap.recycle()`) — lands in plan 04-04. The shell's
 * `detectHands` rejects `NOT_IMPLEMENTED`; `cleanup` resolves trivially.
 *
 * Bundled asset: `android/app/src/main/assets/hand_landmarker.task` (~7.8 MB,
 * the public MediaPipe HandLandmarker float16 model bundle); the Gradle dep is
 * `com.google.mediapipe:tasks-vision:0.10.21` (pinned for iOS-pod parity per
 * CLAUDE.md — do NOT bump to 0.10.33+).
 */
@ReactModule(name = HumynHandDetectorModule.NAME)
class HumynHandDetectorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynHandDetector"
    }

    /**
     * Single-thread executor — serialises gate-poll detections and never runs
     * Bitmap decode / MediaPipe inference on the JS or main thread.
     */
    private val bgExecutor = Executors.newSingleThreadExecutor()

    override fun getName(): String = NAME

    @ReactMethod
    fun detectHands(path: String, minConfidence: Double, promise: Promise) {
        bgExecutor.execute {
            promise.reject(
                "NOT_IMPLEMENTED",
                "HumynHandDetector.detectHands not implemented until plan 04-04",
            )
        }
    }

    @ReactMethod
    fun cleanup(promise: Promise) {
        promise.resolve(null)
    }
}
