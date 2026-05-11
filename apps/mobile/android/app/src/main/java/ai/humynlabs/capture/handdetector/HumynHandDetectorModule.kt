package ai.humynlabs.capture.handdetector

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
// HandLandmarkerOptions is a nested class of HandLandmarker in tasks-vision 0.10.21
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker.HandLandmarkerOptions
import java.util.concurrent.Executors

/**
 * HAND-01 — MediaPipe HandLandmarker (`RunningMode.IMAGE`, `numHands=2`, all
 * confidences `0.5f`/configurable, CPU delegate) over the bundled
 * `android/app/src/main/assets/hand_landmarker.task` (~7.8 MB float16 model
 * bundle; Gradle dep `com.google.mediapipe:tasks-vision:0.10.21`, pinned for
 * iOS-pod parity per CLAUDE.md — do NOT bump to 0.10.33+).
 *
 * HAND-13 — `BitmapFactory.decodeFile` at `RGB_565` (half the memory of
 * ARGB_8888) → `createScaledBitmap(_, 320, 240, _)` → detect → explicit
 * `bitmap.recycle()` in a `finally`, so the native bitmap heap is reclaimed
 * before the JS GC runs under the sustained gate-poll cadence (Pitfall 10).
 *
 * Mirrors `figure-app-hands.md` — the reverse-engineered Figure "Minutes"
 * pattern: a one-shot still-image check exposed as a single `@ReactMethod`,
 * `RunningMode.IMAGE` (not LIVE_STREAM), CPU delegate (the builder default —
 * the GPU-delegate setter is deliberately never called; selecting it would
 * regress thermals and skin-tone robustness; the acceptance gate greps this
 * file for that setter symbol), returns the hand COUNT only
 * (`result.landmarks().size` — 0 / 1 / 2), the
 * `HandLandmarker` constructed lazily once and reused, `cleanup()` closes it,
 * all work on an `Executors.newSingleThreadExecutor()`.
 *
 * `minConfidence` comes from Firebase Remote Config
 * `gate.min_hand_detection_confidence` (HAND-11), read JS-side and passed per
 * call. The planner-simplified contract: the JS side reads it once at
 * RecordingScreen mount and passes the same value to every `detectHands` call,
 * ignoring mid-session RC changes. Because the lazily-constructed
 * `HandLandmarker` caches `minConfidence` from whatever value was first passed,
 * a session that genuinely needs a different confidence must call `cleanup()`
 * first (recordings rarely change RC mid-session).
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). Two `@ReactMethod`s:
 *
 *   1. [detectHands] — single-frame MediaPipe HandLandmarker detection on a
 *      JPEG/PNG at an app-internal cacheDir path; resolves with the hand
 *      COUNT only (0 / 1 / 2 — `numHands=2`). A missing/corrupt file
 *      (`decodeFile` returns null) rejects gracefully with
 *      `HAND_DETECT_FAILED` — never crashes the bridge.
 *   2. [cleanup] — closes the cached `HandLandmarker` and frees its native
 *      memory; called on RecordingScreen unmount.
 *
 * Both methods dispatch to a single-thread background executor (never block
 * the JS thread — BitmapFactory.decodeFile + MediaPipe inference on JS would
 * freeze the gate UI).
 *
 * WR-03 — `cleanup()` runs `landmarker.close()` on `bgExecutor`, not on the
 * bridge thread, so the close is serialised behind any in-flight `detect()` on
 * the same single-thread executor (the `synchronized` in [getOrCreate] guards
 * construction only). If an `override fun invalidate()` is ever added that
 * closes the landmarker, it MUST wrap the `close()` in `bgExecutor.execute { }`
 * for the same reason — closing the native MediaPipe handle out from under an
 * active detection is undefined behaviour / a native crash, and RecordingScreen
 * calls `cleanup()` on every unmount while the gate poll fires every ~400 ms.
 */
@ReactModule(name = HumynHandDetectorModule.NAME)
class HumynHandDetectorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynHandDetector"

        /**
         * Clamp the JS-supplied confidence (which crosses the bridge as a
         * `Double`) into the `[0f, 1f]` range MediaPipe expects (T-4.4-03
         * input validation). Extracted so it is unit-testable without the
         * native MediaPipe lib.
         */
        @JvmStatic
        fun clampConfidence(value: Double): Float = value.toFloat().coerceIn(0f, 1f)
    }

    /**
     * Single-thread executor — serialises gate-poll detections and never runs
     * Bitmap decode / MediaPipe inference on the JS or main thread.
     */
    private val bgExecutor = Executors.newSingleThreadExecutor()

    /**
     * Lazily-constructed, reused `HandLandmarker`. `@Volatile` because the
     * double-checked `getOrCreate` reads it outside the `synchronized` block
     * on the executor thread; `cleanup` nulls it from the JS thread.
     */
    @Volatile
    private var landmarker: HandLandmarker? = null

    override fun getName(): String = NAME

    /**
     * Lazily construct the `HandLandmarker` once (double-checked locking) and
     * reuse it (Pitfall 3 — model-load latency: the 7.8 MB bundle loads on the
     * first call, then every subsequent `detect()` is cheap). CPU delegate is
     * the builder default — the GPU-delegate setter is intentionally not used.
     */
    private fun getOrCreate(minConf: Float): HandLandmarker =
        landmarker ?: synchronized(this) {
            landmarker ?: HandLandmarker.createFromOptions(
                reactApplicationContext,
                HandLandmarkerOptions.builder()
                    .setBaseOptions(
                        BaseOptions.builder()
                            .setModelAssetPath("hand_landmarker.task")
                            .build(),
                    )
                    .setRunningMode(RunningMode.IMAGE)
                    .setNumHands(2)
                    .setMinHandDetectionConfidence(minConf)
                    .setMinHandPresenceConfidence(0.5f)
                    .setMinTrackingConfidence(0.5f)
                    .build(),
            ).also { landmarker = it }
        }

    @ReactMethod
    fun detectHands(path: String, minConfidence: Double, promise: Promise) {
        bgExecutor.execute {
            // WR-03 — this runs on the single-thread `bgExecutor`, the same
            // executor `cleanup()` now closes the landmarker on, so the
            // `getOrCreate(mc).detect(...)` pair below can never race a
            // concurrent `cleanup()`: a `cleanup()` enqueued before this task
            // closes first, one enqueued after re-creates the landmarker via
            // `getOrCreate`. Any native exception from a half-torn-down state is
            // already caught and converted to a graceful `HAND_DETECT_FAILED`.
            var decoded: Bitmap? = null
            var scaled: Bitmap? = null
            try {
                // HAND-13 / Pitfall 10 — RGB_565 is half the memory of the
                // default ARGB_8888; binary hand-count detection is unaffected.
                val opts = BitmapFactory.Options().apply {
                    inPreferredConfig = Bitmap.Config.RGB_565
                }
                // T-4.4-02 — a missing/corrupt JPEG path → decodeFile returns
                // null → IllegalArgumentException → caught below → reject.
                // Never crashes the bridge thread (work runs on bgExecutor).
                decoded = BitmapFactory.decodeFile(path, opts)
                    ?: throw IllegalArgumentException("decodeFile returned null for $path")
                // HAND-13 / Pitfall 10 — 320×240 is plenty for MediaPipe's
                // binary hand-count detection.
                scaled = Bitmap.createScaledBitmap(decoded, 320, 240, true)
                // T-4.4-03 — clamp the JS-supplied confidence into [0f, 1f].
                val mc = clampConfidence(minConfidence)
                val result = getOrCreate(mc).detect(BitmapImageBuilder(scaled).build())
                // Hand COUNT only (0 / 1 / 2). The 21-point landmarks, world
                // coords and handedness MediaPipe computes are discarded — the
                // gate is "are N hands present?", not a tracker.
                promise.resolve(result.landmarks().size)
            } catch (e: Exception) {
                // JS treats a reject as a "no hands detected this poll".
                promise.reject("HAND_DETECT_FAILED", e)
            } finally {
                // HAND-13 / Pitfall 10 — explicit recycle so the native heap
                // is reclaimed before the JS GC runs (`createScaledBitmap` may
                // return the input bitmap if it's already 320×240, so guard
                // the `!==` to avoid double-recycle).
                scaled?.takeIf { it !== decoded }?.recycle()
                decoded?.recycle()
            }
        }
    }

    @ReactMethod
    fun cleanup(promise: Promise) {
        // WR-03 — close() must run on `bgExecutor` so it can never race an
        // in-flight `detect()` on the same single-thread executor (the
        // `synchronized` in `getOrCreate` guards construction only).
        // RecordingScreen calls `cleanup()` on every unmount (X button,
        // post-stop nav, …) and the gate poll fires every ~400 ms during
        // `gate.waiting`, so an unmount-during-poll is routine. The
        // `synchronized(this)` block stays so it pairs with `getOrCreate`'s
        // construction lock — a `detectHands` enqueued after this `cleanup`
        // re-creates the landmarker cleanly.
        bgExecutor.execute {
            synchronized(this) {
                landmarker?.close()
                landmarker = null
            }
            promise.resolve(null)
        }
    }
}
