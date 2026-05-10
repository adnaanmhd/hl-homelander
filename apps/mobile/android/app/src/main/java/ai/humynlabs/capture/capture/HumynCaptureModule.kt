package ai.humynlabs.capture.capture

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.Executors

/**
 * Phase 3 Plan 03-09 — TurboModule entry point for `NativeModules.HumynCapture`.
 *
 * **Bridge-first orchestrator pattern.** This module ships in Plan 03-09
 * and exposes `start(opts)` / `stop()` Promise surface PLUS the
 * NativeEventEmitter helper hook (`emitEvent`) for Plan 03-10's segment
 * lifecycle. Per checker issue #9 split:
 *
 *   - Plan 03-09 (THIS PLAN): bridge surface + opts validation +
 *     SegmentDurationConfig read. After validation passes, `start()`
 *     rejects with `not_implemented_in_03_09` so the JS bridge
 *     integration test exercises the surface without spinning up
 *     Camera2 + MediaCodec.
 *   - Plan 03-10: replaces the `start()` body with the real
 *     CaptureSession allocation (encoder + IMU + muxer + thermal
 *     lifecycle); enables `stop()`.
 *
 * Single-thread `captureExecutor`: serialises start/stop and ensures
 * we never run heavy work on the main thread (T-3.6-01 / T-3.9-03
 * mitigation; same pattern as `HumynCompatModule.bgExecutor`).
 *
 * Error code contract (D-API-01):
 *   - `consent_invalid` — opts.contributor.consent !== true.
 *   - `invalid_opts` — any other CaptureSessionOpts validation failure;
 *      message carries the failing field name (e.g. `"invalid_opts: dfovDegrees"`).
 *   - `not_implemented_in_03_09` — the temporary stub Plan 03-10 replaces.
 *   - `no_active_session` — stop() called with nothing running. Plan 03-09
 *      cannot start a session at all, so this fires unconditionally on stop.
 *   - `internal_error` — any non-IllegalArgumentException Throwable.
 */
@ReactModule(name = HumynCaptureModule.NAME)
class HumynCaptureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynCapture"
    }

    /**
     * Single-thread executor — serialises start/stop and never runs
     * heavy work on the main thread (mirrors HumynCompatModule.bgExecutor).
     * Plan 03-10's CaptureSession runs its encoder threads off this
     * executor's calls but does its own thread management.
     */
    private val captureExecutor = Executors.newSingleThreadExecutor()

    /**
     * T-3.9-03 mitigation seam — Plan 03-10 flips this to true on a
     * successful CaptureSession start, false on stop. Plan 03-09
     * never sets this (it cannot start a session) so `stop()` always
     * rejects with `no_active_session`. Volatile because Plan 03-10's
     * thermal-abort and segment-rotate paths read this from the
     * captureExecutor's worker thread.
     */
    @Volatile
    private var sessionActive: Boolean = false

    override fun getName(): String = NAME

    @ReactMethod
    fun start(optsMap: ReadableMap, promise: Promise) {
        captureExecutor.execute {
            try {
                // Step 1: opts validation (defense-in-depth at the Kotlin bridge end).
                val opts = CaptureSessionOptsBridge.fromBridge(optsMap)
                // Step 2: read segment duration from Firebase Remote Config.
                val durationMs = SegmentDurationConfig.load() * 60_000L
                // Step 3: Plan 03-10 entry point. Until 03-10 lands the
                // orchestrator, surface a clear error so the JS bridge
                // integration test exercises this validation surface
                // without spinning up Camera2.
                promise.reject(
                    "not_implemented_in_03_09",
                    "HumynCapture validation surface is wired in Plan 03-09; " +
                        "the encoder + IMU + muxer + thermal lifecycle ships in Plan 03-10. " +
                        "Opts parsed OK; durationMs=$durationMs; sessionActive=$sessionActive; " +
                        "taskId=${opts.taskId}; isPractice=${opts.isPractice}.",
                )
            } catch (e: IllegalArgumentException) {
                val code = if (e.message == "consent_invalid") "consent_invalid" else "invalid_opts"
                promise.reject(code, e.message ?: "capture_start_failed", e)
            } catch (t: Throwable) {
                promise.reject("internal_error", t.message ?: "capture_start_failed", t)
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        captureExecutor.execute {
            if (!sessionActive) {
                promise.reject(
                    "no_active_session",
                    "no session was started; Plan 03-09 cannot start sessions (see Plan 03-10)",
                    null as Throwable?,
                )
                return@execute
            }
            // Plan 03-10 fills in the real stop logic.
            promise.reject(
                "not_implemented_in_03_09",
                "Stop logic ships in Plan 03-10",
                null as Throwable?,
            )
        }
    }

    /**
     * Plan 03-10 hook — called from CaptureSession on segment lifecycle
     * events to push a payload into the JS NativeEventEmitter. Internal
     * (package-private) so only same-package callers (CaptureSession)
     * can emit; outside callers go through the JS bridge.
     */
    internal fun emitEvent(name: String, payload: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, payload)
    }
}
