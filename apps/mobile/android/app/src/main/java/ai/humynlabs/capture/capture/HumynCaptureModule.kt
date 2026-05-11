package ai.humynlabs.capture.capture

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import ai.humynlabs.capture.fgs.HumynForegroundService
import java.util.concurrent.Executors

/**
 * Phase 3 — TurboModule entry point for `NativeModules.HumynCapture`.
 *
 * **Bridge-first orchestrator pattern.** Plan 03-09 shipped the bridge
 * surface + opts validation + SegmentDurationConfig read with `start()`
 * rejecting a "not-yet-implemented" placeholder code. Plan 03-10 (THIS
 * PLAN) replaces the `start()` / `stop()` bodies with real
 * `CaptureSession` allocation + foreground-service lifecycle. The
 * acceptance grep gate forbids the stale stub code string from this file.
 *
 * `start(opts, promise)` sequence:
 *   1. Validate opts (CaptureSessionOptsBridge.fromBridge — defense in
 *      depth at the Kotlin end).
 *   2. Load segment duration from Firebase Remote Config
 *      (`SegmentDurationConfig.load()` — minutes; converted to ms).
 *   3. Allocate CaptureSession via CaptureSession.start(). The constructor
 *      runs the full pre-flight (ThermalGate → BackUltrawidePicker →
 *      RealtimeGate → Camera2 open → encoders → muxer → IMU → first
 *      segment emit). Throws on pre-flight failure; this method's
 *      `errorCodeFor` maps the exception type to a stable bridge code.
 *   4. Start the foreground service AFTER Camera2 open succeeds. A
 *      pre-flight failure between steps 1 and 3 never leaks an
 *      "always-on" foreground notification (T-3.10-04 mitigation).
 *   5. promise.resolve(sessionInst.toStartResponse()).
 *
 * `stop(promise)` sequence:
 *   1. session?.stop() — cancels SegmentTimer, closes segment N,
 *      synchronously awaits FinalizeWorker N (30 s budget), emits
 *      onSessionStop.
 *   2. stopService(HumynForegroundService).
 *   3. promise.resolve(null).
 *   4. If session==null, rejects `no_active_session`.
 *
 * Single-thread `captureExecutor`: serialises start/stop and never runs
 * heavy work on the main thread. `finalizeExecutor`: dedicated executor
 * for the concurrent finalize on each segment cut (Pattern 2 — finalize
 * runs in parallel with the next segment's encoder).
 *
 * Error code contract (D-API-01; expanded for Plan 03-10):
 *   - `consent_invalid` — opts.contributor.consent !== true.
 *   - `invalid_opts` — any other CaptureSessionOpts validation failure.
 *   - `thermal_throttling` — ThermalRefuseException at pre-flight.
 *   - `realtime_clock_unavailable` — RealtimeClockUnavailableException
 *     at pre-flight (device doesn't advertise SENSOR_INFO_TIMESTAMP_SOURCE
 *     = REALTIME).
 *   - `permission_revoked` — SecurityException (Camera or RECORD_AUDIO
 *     revoked mid-record).
 *   - `storage_full` — IOException at finalize-time writeAtomic.
 *   - `session_already_active` — start() called while a session is
 *     active. The user must stop() first.
 *   - `no_active_session` — stop() called with nothing running.
 *   - `internal_error` — any non-mapped Throwable.
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
     * CaptureSession spawns its own HandlerThreads for the recording-side
     * work (camera + encoder pump + IMU + segment timer + session); this
     * executor is solely for the bridge call lifecycle.
     */
    private val captureExecutor = Executors.newSingleThreadExecutor()

    /**
     * Dedicated finalize executor — Pattern 2 (concurrent finalize).
     * Hands off to a separate thread at each segment rotate + at stop()
     * so SHA streaming + metadata-JSON write does not block the next
     * segment's encoder pump.
     */
    private val finalizeExecutor = Executors.newSingleThreadExecutor()

    /**
     * Active session. `@Volatile` because the bridge `start()` /
     * `stop()` calls all enter on `captureExecutor` (which serialises
     * writes), but the FGS lifecycle decision in `start()` reads the
     * field after CaptureSession.start returns from a different
     * HandlerThread's view of memory.
     */
    @Volatile
    private var session: CaptureSession? = null

    override fun getName(): String = NAME

    @ReactMethod
    fun start(optsMap: ReadableMap, promise: Promise) {
        captureExecutor.execute {
            try {
                // T-3.10-04 mitigation — double-start serialised through
                // captureExecutor + explicit guard. Throw the typed
                // SessionAlreadyActiveException so errorCodeFor maps it to
                // "session_already_active" via type dispatch (CR-07 fix —
                // the previous direct `promise.reject("session_already_active",
                // ...)` worked but left errorCodeFor's `t.message ==
                // "session_already_active"` branch as dead code).
                if (session != null) {
                    throw SessionAlreadyActiveException()
                }
                // Step 1: opts validation (defense-in-depth at the Kotlin bridge end).
                val opts = CaptureSessionOptsBridge.fromBridge(optsMap)
                // Step 2: segment duration from Firebase Remote Config.
                val durationMs = SegmentDurationConfig.load() * 60_000L
                // Step 3: allocate the session. CaptureSession.start runs
                // the full pre-flight synchronously on this thread; throws
                // on ThermalRefuseException / RealtimeClockUnavailableException /
                // Camera2 open failure / IOException. cleanupAfterPreFlightFailure
                // tears down anything that got allocated before re-throwing.
                val sessionInst = CaptureSession.start(
                    ctx = reactApplicationContext,
                    opts = opts,
                    segmentDurationMs = durationMs,
                    finalizeExecutor = finalizeExecutor,
                    emit = ::emitEvent,
                )
                session = sessionInst
                // Step 4: start FGS AFTER successful pre-flight + Camera2 open.
                // A pre-flight failure between steps 1 and 3 NEVER leaks an
                // always-on foreground notification.
                ContextCompat.startForegroundService(
                    reactApplicationContext,
                    Intent(reactApplicationContext, HumynForegroundService::class.java),
                )
                // Step 5: resolve with the D-API-01 start response shape.
                promise.resolve(sessionInst.toStartResponse())
            } catch (t: Throwable) {
                promise.reject(errorCodeFor(t), t.message ?: "capture_start_failed", t)
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        captureExecutor.execute {
            try {
                // CR-07 fix — typed NoActiveSessionException keeps errorCodeFor's
                // dispatch refactor-safe. A future contributor renaming the
                // literal "no_active_session" string would no longer silently
                // demote the public bridge contract to "internal_error".
                val s = session ?: throw NoActiveSessionException()
                s.stop()
                session = null
                // Stop FGS AFTER session.stop returns so the OS doesn't kill the
                // process while finalize is still writing metadata.
                reactApplicationContext.stopService(
                    Intent(reactApplicationContext, HumynForegroundService::class.java),
                )
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject(errorCodeFor(t), t.message ?: "capture_stop_failed", t)
            }
        }
    }

    /**
     * Map a thrown exception type to its stable bridge error code.
     * Visible-for-tests indirectly — every catch site in start() / stop()
     * funnels through here so the contract is single-source.
     *
     * **CR-07 fix.** The previous implementation pattern-matched on
     * `t.message == "no_active_session"` etc. Two problems:
     *   (1) The `t.message == "session_already_active"` branch was dead
     *       code — that exception was never thrown (the double-start guard
     *       called `promise.reject` directly).
     *   (2) String-equality message matching is fragile: a future
     *       contributor renaming the literal in `IllegalStateException(...)`
     *       silently demotes the public bridge contract to `internal_error`
     *       with no compile-time signal.
     * Switched to typed exception dispatch — the throw site and the catch
     * site share a single class, so renames cannot drift apart.
     */
    private fun errorCodeFor(t: Throwable): String = when (t) {
        is ThermalRefuseException -> "thermal_throttling"
        is RealtimeClockUnavailableException -> "realtime_clock_unavailable"
        is NoActiveSessionException -> "no_active_session"
        is SessionAlreadyActiveException -> "session_already_active"
        is ConsentInvalidException -> "consent_invalid"
        is InvalidOptsException -> "invalid_opts"
        is SecurityException -> "permission_revoked"
        is java.io.IOException -> "storage_full"
        // Defense-in-depth: legacy throw sites that still raise raw
        // IllegalStateException / IllegalArgumentException (e.g.
        // CaptureSessionOptsBridge's `require(...)` calls before the typed-
        // exception migration is complete) still get sensible bridge codes.
        // The typed branches above take precedence; these tail branches
        // catch the un-migrated cases. Once every throw site uses the
        // typed exceptions, these tail branches become dead and can be
        // removed.
        is IllegalStateException -> "internal_error"
        is IllegalArgumentException -> if (t.message == "consent_invalid") {
            "consent_invalid"
        } else {
            "invalid_opts"
        }
        else -> "internal_error"
    }

    /**
     * Plan 03-10 emit hook — called from CaptureSession + FinalizeWorker on
     * segment lifecycle events to push a payload into the JS
     * NativeEventEmitter. Internal (package-private) so only same-package
     * callers (CaptureSession, FinalizeWorker) emit; outside callers go
     * through the JS bridge.
     */
    internal fun emitEvent(name: String, payload: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, payload)
    }
}

// CR-07 fix — typed exceptions for the bridge error contract. Each class
// extends an IllegalStateException / IllegalArgumentException with the
// canonical message string so legacy callers reading `.message` keep
// working, AND errorCodeFor's `when` dispatches by type so the contract
// is refactor-safe (renames cannot silently demote a code to internal_error).

/** Thrown by `stop()` when no CaptureSession is active. */
class NoActiveSessionException : IllegalStateException("no_active_session")

/** Thrown by `start()` when a CaptureSession is already running. */
class SessionAlreadyActiveException : IllegalStateException("session_already_active")

/** Thrown by opts validation when `contributor.consent !== true`. */
class ConsentInvalidException : IllegalArgumentException("consent_invalid")

/** Thrown by opts validation for any other CaptureSessionOpts shape failure. */
class InvalidOptsException(field: String) : IllegalArgumentException("invalid_opts: $field")
