package ai.humynlabs.capture.upload

import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import ai.humynlabs.capture.fgs.HumynForegroundService
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Phase 5 / Plan 05-04 — the `HumynUpload` RN bridge.
 *
 * The native side of the background upload pipeline's control surface:
 *  - [enqueue] — `HumynCapture`'s finalize path (wired in Plan 05-08) calls this
 *    to add a freshly-finalized recording's bundle (MP4 + IMU CSV + metadata
 *    JSON) to the durable queue. Practice recordings are refused by
 *    [UploadQueueStore.enqueue] itself (D-08).
 *  - [pause] / [resume] — `HumynCapture.start()` calls [pause] (uploads pause
 *    during a recording, UP-10); `HumynCapture.stop()` calls [resume]. The
 *    paused flag is checked by `UploadCoordinator` (Plan 05-06).
 *  - [getQueue] — the JS Pending-Uploads UI reads the queue rows (the JS side
 *    filters to own-rows). Read-only — UP-11: there is intentionally no
 *    user-driven abort affordance on the bridge at all.
 *  - [clearUploaded] — the reconcile backstop (`uploadReconcile.ts`) calls this
 *    with the recordingIds the server reports terminal-success (`uploaded`); the
 *    local mp4/csv/json are unlinked and the rows dropped. (Enh 3 / D1: the
 *    coordinator already does this inline at `/finalize` 200 — this is the
 *    catch-up sweep for stale local rows.)
 *  - [retryNeedsAttention] — debug session
 *    `.planning/debug/upload-queue-hol-finalizing.md` (Fix C item 4) — the
 *    History UI's per-row Retry affordance for `NEEDS_ATTENTION` rows.
 *    Resets the row's `attemptCount` / failure markers and transitions back
 *    into the automatic drain path.
 *
 * Emits `onUploadQueueChanged(<WritableArray of rows>)` on every queue mutation
 * and `onUploadProgress({recordingId, bytesUploaded, bytesTotal})` from the
 * coordinator (Plan 05-06; debounced to ≤ once/5s there).
 *
 * Mirrors the canonical native-module triad (see `battery.HumynBatteryModule`)
 * + the background-executor pattern (see `updater.HumynUpdaterModule`): every
 * `@ReactMethod` body runs on a single-thread background executor (the queue
 * store does file I/O — never on the JS thread), wrapped in try/catch →
 * `promise.reject(CODE, msg, t)` on failure. [invalidate] stops the executor.
 */
@ReactModule(name = HumynUploadModule.NAME)
class HumynUploadModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynUpload"
        private const val TAG = "HumynUpload"
    }

    /** Single-thread executor — file I/O off the JS thread, one op at a time. */
    private val bgExecutor = Executors.newSingleThreadExecutor()

    /**
     * The process-wide shared transfer engine (Plan 05-06 + 05-07): drains the
     * queue, runs the multipart flow with bounded concurrency, persists per-part
     * state, dead-letters cleanly. The SAME instance the FGS
     * (`HumynForegroundService`) and the UIDT `UploadJobService` call. The auth
     * context (API base URL + bearer JWT + signed-in sub) is pushed in via
     * [setUploadContext] (the JWT lives in encrypted MMKV — the bridge injects
     * it rather than reaching MMKV from Kotlin).
     */
    private val coordinator = UploadCoordinator.getShared(reactContext.applicationContext)

    /** The native-owned durable queue (JSON-on-disk under filesDir/upload-queue) — shared with the coordinator. */
    private val queueStore = coordinator.queueStore

    /**
     * The paused flag. Mirrors [UploadControlState] (the process-lived
     * @Volatile flag from Plan 05-04 that survives a catalyst reload) — the
     * coordinator reads `UploadControlState::isPaused`; this AtomicBoolean is
     * the bridge-instance handle the plan calls for. Both are kept in sync.
     */
    private val paused = AtomicBoolean(UploadControlState.isPaused())

    /**
     * Plan 06-12 follow-on (Finding 6) — captured-by-reference listener kept
     * as a property so we can [removeConnectivityListener] on
     * [invalidate]. A lambda literal would create a new object each
     * subscribe call, breaking removal symmetry.
     */
    private val connectivityListener: (Boolean) -> Unit = { online ->
        emitConnectivityChanged(online)
    }

    init {
        // Install the real RCTDeviceEventEmitter-backed emitters on the shared
        // coordinator (it starts with no-op emitters for the FGS / JobService
        // threads that have no JS bridge).
        runCatching { coordinator.setEmitters(::emitProgress, ::emitQueueChanged, ::emitAuthFailure) }
        // Plan 06-12 follow-on (Finding 6) — bridge connectivity changes to
        // JS so the OfflineBanner on Home / History flips on airplane-mode
        // toggle. The listener fires once immediately with the current state
        // (see NetworkMonitor.addConnectivityListener).
        runCatching { coordinator.addConnectivityListener(connectivityListener) }
    }

    override fun getName(): String = NAME

    /**
     * Push the auth context the coordinator needs for `/recordings/init`,
     * `/finalize`: the API base URL (`react-native-config`
     * `API_BASE_URL`), the current bearer JWT (from encrypted MMKV on the JS
     * side), and the signed-in user's `sub`. The JS side calls this on launch,
     * after sign-in, and on resume (to refresh a rotated token). Presigned S3
     * PUTs never carry the bearer (they're presigned).
     */
    @ReactMethod
    fun setUploadContext(apiBaseUrl: String?, bearerToken: String?, sub: String?, promise: Promise) {
        bgExecutor.execute {
            try {
                UploadAuthContext.set(apiBaseUrl, bearerToken, sub)
                // Review fix (2026-06-10) — a token push is the auth-pause's
                // clear condition: the coordinator parked the queue because the
                // bearer was dead; JS pushing a (possibly fresh) one re-arms the
                // drain. A still-dead token costs one 401 round that re-parks +
                // re-fires onUploadAuthFailure (single-flight silent re-auth on
                // the JS side). Does NOT touch the JS-lifecycle pause — a
                // recording in progress keeps uploads parked (UP-10).
                if (bearerToken != null) UploadControlState.setAuthPaused(false)
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_SET_CONTEXT_FAILED", t.message ?: "setUploadContext failed", t)
            }
        }
    }

    /**
     * Add a recording's bundle to the upload queue. Practice recordings are
     * silently refused inside [UploadQueueStore.enqueue] (D-08). After a
     * successful enqueue, signal the FGS that uploads are active so it can
     * (re)start in the `dataSync` state — the actual startForeground-with-
     * dataSync transition lives in `HumynForegroundService` (Plan 05-07);
     * here we just send the seam intent.
     */
    @ReactMethod
    fun enqueue(
        recordingId: String,
        mp4Path: String,
        csvPath: String,
        jsonPath: String,
        taskId: String,
        isPractice: Boolean,
        ownerUserId: String,
        promise: Promise,
    ) {
        bgExecutor.execute {
            try {
                // BUG-4 (2026-06-09) — pin the recording duration on the row so an
                // in-flight (server-unknown) row shows its real length in History /
                // Pending-Uploads instead of "0s". Best-effort: a metadata read
                // failure yields null and never blocks the enqueue.
                val durationSeconds =
                    runCatching { readDurationSecondsFromMetadataJson(File(jsonPath).readText()) }
                        .getOrNull()
                val row = UploadRow(
                    recordingId = recordingId,
                    ownerUserId = ownerUserId,
                    mp4Path = mp4Path,
                    csvPath = csvPath,
                    jsonPath = jsonPath,
                    taskId = taskId,
                    isPractice = isPractice,
                    durationSeconds = durationSeconds,
                )
                queueStore.enqueue(row)
                emitQueueChanged()
                signalUploadActiveBestEffort()
                // Plan 05-06: kick the drainer (no-op if paused / no signed-in
                // user / no network — the coordinator re-checks).
                runCatching { coordinator.drain() }
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_ENQUEUE_FAILED", t.message ?: "enqueue failed", t)
            }
        }
    }

    /**
     * Pause in-flight uploads (UP-10 — uploads pause during a recording).
     * `UploadCoordinator` (Plan 05-06) owns the paused flag + the actual
     * transfer suspension; this is the bridge entry HumynCapture.start() calls.
     */
    @ReactMethod
    fun pause(promise: Promise) {
        bgExecutor.execute {
            try {
                UploadControlState.setPaused(true)
                paused.set(true)
                // Cancel in-flight HTTP calls — parts/queue rows are NOT discarded; they resume.
                runCatching { coordinator.cancelInflight() }
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_PAUSE_FAILED", t.message ?: "pause failed", t)
            }
        }
    }

    /**
     * Resume uploads (UP-10 — HumynCapture.stop() calls this). Clears ONLY the
     * JS-lifecycle pause; an auth park (dead token) survives a recording stop
     * (review fix 2026-06-10 — see [UploadControlState]).
     */
    @ReactMethod
    fun resume(promise: Promise) {
        bgExecutor.execute {
            try {
                UploadControlState.setPaused(false)
                paused.set(false)
                // Plan 05-06: kick the drainer back into action.
                runCatching { coordinator.drain() }
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_RESUME_FAILED", t.message ?: "resume failed", t)
            }
        }
    }

    /**
     * Review fix (2026-06-10) — clear the AUTH pause (the coordinator's 401
     * park) + kick the drainer, WITHOUT touching the JS-lifecycle pause: a
     * recording in progress keeps uploads parked (UP-10) even when a silent
     * re-auth lands mid-capture. Called by the JS auth-recovery paths
     * (`uploadReconcile.pushUploadContext` after a token rotation, and the
     * foreground reconcile's auth-parked-row recovery).
     */
    @ReactMethod
    fun resumeAuth(promise: Promise) {
        bgExecutor.execute {
            try {
                UploadControlState.setAuthPaused(false)
                runCatching { coordinator.drain() }
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_RESUME_AUTH_FAILED", t.message ?: "resumeAuth failed", t)
            }
        }
    }

    /**
     * Wave-1.5 Item 8 — cold-start drain kick. Used by `installUploadReconcile()`
     * on boot: if `getQueueSafe()` returns a row in {PENDING, UPLOADING}, JS
     * calls `drainNow()` to wake the drainer. Distinct from [resume]: does NOT
     * flip `UploadControlState.setPaused(false)` — a pause is sticky (an
     * in-progress recording, an explicit user-driven pause path) and a
     * boot-time drain MUST NOT silently unpause uploads. If the coordinator is
     * paused, the drain is a no-op (UploadCoordinator.kt:186 re-checks
     * `isPaused()`); otherwise it iterates the queue exactly like an
     * `enqueue()` kick would.
     *
     * Closes T-5-14-04 — without this kick, a process-kill mid-upload + reboot
     * leaves a row in {pending, uploading} on disk and nothing else fires
     * (`enqueue`, `resume`, RecordingScreen.resume, the Retry button — all
     * user-driven). The user can't make progress without manually bouncing a
     * screen. The reconcile sweep IS the on-boot trigger; drainNow is its
     * bridge surface.
     */
    @ReactMethod
    fun drainNow(promise: Promise) {
        bgExecutor.execute {
            try {
                runCatching { coordinator.drain() }
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_DRAIN_NOW_FAILED", t.message ?: "drainNow failed", t)
            }
        }
    }

    /**
     * Return all queue rows as a `WritableArray`. Read-only — the JS side
     * filters to the signed-in user's own rows. (UP-11: no user-driven abort.)
     */
    @ReactMethod
    fun getQueue(promise: Promise) {
        bgExecutor.execute {
            try {
                promise.resolve(rowsToWritableArray(queueStore.read()))
            } catch (t: Throwable) {
                promise.reject("UPLOAD_GET_QUEUE_FAILED", t.message ?: "getQueue failed", t)
            }
        }
    }

    /**
     * Enh 3 / D1 (2026-06-04) — reconcile backstop. For each recordingId the
     * server reports terminal-success (`uploaded`), unlink its local
     * mp4/csv/json and drop the row. The coordinator already does this inline
     * the instant `/finalize` returns 200; this catch-up sweep
     * (`uploadReconcile.ts`) only fires for ids whose local row somehow
     * outlived its upload (a process kill between finalize 200 and the inline
     * cleanup, a row finalized on another device, etc). The THUMBNAIL is
     * preserved (see [UploadQueueStore.deleteLocalAndRemove]).
     */
    @ReactMethod
    fun clearUploaded(recordingIds: ReadableArray, promise: Promise) {
        bgExecutor.execute {
            try {
                for (i in 0 until recordingIds.size()) {
                    val id = recordingIds.getString(i) ?: continue
                    queueStore.deleteLocalAndRemove(id)
                }
                emitQueueChanged()
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_CLEAR_UPLOADED_FAILED", t.message ?: "clearUploaded failed", t)
            }
        }
    }

    /**
     * SAFE dead-letter revival primitive — the dead-letter recovery path for
     * the cold-start auto-revive sweep (`uploadReconcile.ts`) + the Home
     * pending-uploads tile tap. See debug session
     * `.planning/debug/resolved/uploads-stuck-multi-segment.md`.
     *
     * Operates ONLY on `DEAD_LETTER` rows. It performs a LOCAL reset
     * UNCONDITIONALLY: state -> UPLOADING, deadLetterReason cleared. `uploadId` /
     * `imuUploadId` / `videoParts` / `imuParts` / `metadataPut` are KEPT
     * UNCHANGED so the drainer's `when` (UploadCoordinator.kt) takes either:
     *   - `/parts` re-presign (when uploadId is set — preserves DONE part ETags,
     *     UP-04), OR
     *   - the idempotent `/init` self-heal (when uploadId is null — re-mints
     *     against the row's existing s3UploadId via the SELECT-first guard).
     *
     * No-op (resolves null) if the row doesn't exist OR is NOT in DEAD_LETTER
     * state (so a sweep over a mixed queue never silently mutates an UPLOADING
     * row mid-transfer).
     */
    @ReactMethod
    fun reviveDeadLetter(recordingId: String, promise: Promise) {
        bgExecutor.execute {
            try {
                // Phase 1 items 3 + 5 (2026-06-10) — the revive logic moved into
                // UploadCoordinator.reviveDeadLetter so it ALSO resets the
                // attemptCount/lastFailure* markers (a revived row used to keep
                // its old backoff and could sit frozen for up to 1 h) and rotates
                // the per-route Idempotency-Keys. Resolves `true` on an actual
                // revive; `null` on a no-op (missing / non-DEAD_LETTER row) so the
                // JS caller can toast "nothing to retry" instead of staying silent.
                val ok = coordinator.reviveDeadLetter(recordingId)
                if (ok) signalUploadActiveBestEffort()
                promise.resolve(if (ok) true else null)
            } catch (t: Throwable) {
                promise.reject(
                    "UPLOAD_REVIVE_DEAD_LETTER_FAILED",
                    t.message ?: "reviveDeadLetter failed",
                    t,
                )
            }
        }
    }

    /**
     * Debug session `.planning/debug/upload-queue-hol-finalizing.md` (Fix C
     * item 4) — user-driven retry of a `NEEDS_ATTENTION` row. The History UI's
     * per-row "Retry" affordance on the chip-failed visual fires this. Resets
     * `attemptCount` / `lastFailureAt` / `lastFailureState` /
     * `lastFailureReason`, transitions back to UPLOADING (if uploadId is set —
     * the worker takes the /parts re-presign branch) or PENDING (the worker
     * takes the /init self-heal branch), and re-kicks the drainer.
     *
     * No-op (resolves null) if the row doesn't exist OR is NOT in
     * NEEDS_ATTENTION state. Distinct from [reviveDeadLetter] (DEAD_LETTER
     * rows): NEEDS_ATTENTION is the "automatic retry budget exhausted, ask
     * the user" terminal-but-recoverable state.
     */
    @ReactMethod
    fun retryNeedsAttention(recordingId: String, promise: Promise) {
        bgExecutor.execute {
            try {
                val ok = runCatching { coordinator.retryNeedsAttention(recordingId) }.getOrDefault(false)
                if (ok) {
                    signalUploadActiveBestEffort()
                }
                promise.resolve(ok)
            } catch (t: Throwable) {
                promise.reject(
                    "UPLOAD_RETRY_NEEDS_ATTENTION_FAILED",
                    t.message ?: "retryNeedsAttention failed",
                    t,
                )
            }
        }
    }

    // -------------------------------------------------------------------------
    // Battery-optimization exemption + OEM autostart (UP-09) — drives the
    // BatteryOptimizationScreen first-upload walkthrough.
    // -------------------------------------------------------------------------

    /** `true` iff the app is already whitelisted from battery optimizations. */
    @ReactMethod
    fun isBatteryOptimizationExempt(promise: Promise) {
        bgExecutor.execute {
            try {
                promise.resolve(BatteryOptimizationHelper.isExempt(reactApplicationContext))
            } catch (t: Throwable) {
                promise.reject("BATT_OPT_CHECK_FAILED", t.message ?: "isBatteryOptimizationExempt failed", t)
            }
        }
    }

    /** Open the AOSP "allow unrestricted" prompt (falls back to the settings list). */
    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        // Phase 5 (2026-06-10, Bug 5) — capture the host Activity at call time:
        // launching from it (no NEW_TASK) keeps the system dialog in the app's
        // task so dismissal returns to the app, not the launcher. Null (app
        // backgrounded / teardown) falls back to appContext+NEW_TASK inside
        // the helper. (RN 0.83: the getter lives on ReactContext, not on
        // ReactContextBaseJavaModule.)
        val activity = reactApplicationContext.currentActivity
        bgExecutor.execute {
            try {
                BatteryOptimizationHelper.requestExempt(reactApplicationContext, activity)
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("BATT_OPT_REQUEST_FAILED", t.message ?: "requestBatteryOptimizationExemption failed", t)
            }
        }
    }

    /** `true` if a known OEM "autostart" activity resolves on this device. */
    @ReactMethod
    fun oemAutostartAvailable(promise: Promise) {
        bgExecutor.execute {
            try {
                promise.resolve(BatteryOptimizationHelper.oemAutostartAvailable(reactApplicationContext))
            } catch (t: Throwable) {
                promise.reject("OEM_AUTOSTART_CHECK_FAILED", t.message ?: "oemAutostartAvailable failed", t)
            }
        }
    }

    /** Launch the OEM autostart screen if one resolves; resolves `true`/`false` (never crashes). */
    @ReactMethod
    fun openOemAutostart(promise: Promise) {
        bgExecutor.execute {
            try {
                promise.resolve(BatteryOptimizationHelper.openOemAutostartIfAvailable(reactApplicationContext))
            } catch (t: Throwable) {
                promise.reject("OEM_AUTOSTART_OPEN_FAILED", t.message ?: "openOemAutostart failed", t)
            }
        }
    }

    /**
     * Explicitly signal the FGS whether uploads are active (Plan 05-08 / the
     * walkthrough may want to toggle this directly — `enqueue()` already sends
     * the seam intent on a fresh enqueue). `true` while recording is NOT active
     * → the FGS does the `dataSync` type-downgrade + starts the drain.
     */
    @ReactMethod
    fun setUploadActive(active: Boolean, promise: Promise) {
        bgExecutor.execute {
            try {
                val ctx = reactApplicationContext.applicationContext
                val intent = Intent(ctx, HumynForegroundService::class.java)
                    .setAction(HumynForegroundService.ACTION_SET_UPLOAD_ACTIVE)
                    .putExtra(HumynForegroundService.EXTRA_UPLOAD_ACTIVE, active)
                ctx.startService(intent)
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_SET_ACTIVE_FAILED", t.message ?: "setUploadActive failed", t)
            }
        }
    }

    // -------------------------------------------------------------------------
    // Event emission
    // -------------------------------------------------------------------------

    /**
     * Plan 06-12 follow-on (Finding 6) — emit `onConnectivityChanged({ online })`
     * so the OfflineBanner on Home / History can reflect the live state of the
     * default network. Hooked into NetworkMonitor via [connectivityListener].
     */
    private fun emitConnectivityChanged(online: Boolean) {
        runCatching {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(
                    "onConnectivityChanged",
                    Arguments.createMap().apply { putBoolean("online", online) },
                )
        }
    }

    /**
     * Plan 06-12 follow-on (Finding 6) — synchronous read of the current
     * connectivity state. The JS bridge calls this once on mount so the
     * OfflineBanner picks the right initial value, then subscribes to the
     * change stream above.
     */
    @ReactMethod
    fun getConnectivity(promise: Promise) {
        try {
            promise.resolve(
                Arguments.createMap().apply { putBoolean("online", coordinator.hasNetwork()) },
            )
        } catch (t: Throwable) {
            promise.reject("UPLOAD_GET_CONNECTIVITY_FAILED", t.message ?: "getConnectivity failed", t)
        }
    }

    /**
     * Phase 1 (2026-06-10) — emit `onUploadAuthFailure({ slug })` when the
     * coordinator classifies a 401 (queue paused, row parked). The JS listener
     * (`uploadQueueStore.ts` installer) runs the eviction UX for
     * `device-evicted` / `reauth-required`, or a silent re-auth + context
     * re-push + `resume()` for plain expiry.
     */
    private fun emitAuthFailure(slug: String) {
        runCatching {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(
                    "onUploadAuthFailure",
                    Arguments.createMap().apply { putString("slug", slug) },
                )
        }
    }

    /** Emit `onUploadQueueChanged` with the current queue snapshot. */
    private fun emitQueueChanged() {
        runCatching {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onUploadQueueChanged", rowsToWritableArray(queueStore.read()))
        }
    }

    /**
     * Emit `onUploadProgress` for one in-flight recording. Called by
     * `UploadCoordinator` (Plan 05-06) — debounce there to ≤ once/5s.
     */
    fun emitProgress(recordingId: String, bytesUploaded: Long, bytesTotal: Long) {
        runCatching {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(
                    "onUploadProgress",
                    Arguments.createMap().apply {
                        putString("recordingId", recordingId)
                        putDouble("bytesUploaded", bytesUploaded.toDouble())
                        putDouble("bytesTotal", bytesTotal.toDouble())
                    },
                )
        }
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private fun signalUploadActiveBestEffort() {
        runCatching {
            val ctx = reactApplicationContext.applicationContext
            val intent = Intent(ctx, HumynForegroundService::class.java)
                .setAction(HumynForegroundService.ACTION_SET_UPLOAD_ACTIVE)
                .putExtra(HumynForegroundService.EXTRA_UPLOAD_ACTIVE, true)
            ctx.startService(intent)
        }
    }

    private fun partStateToMap(p: PartState): WritableMap = Arguments.createMap().apply {
        putInt("n", p.n)
        putString("status", p.status.name.lowercase())
        if (p.etag != null) putString("etag", p.etag)
        putInt("retryCount", p.retryCount)
    }

    private fun rowToMap(r: UploadRow): WritableMap = Arguments.createMap().apply {
        putString("recordingId", r.recordingId)
        putString("ownerUserId", r.ownerUserId)
        putString("mp4Path", r.mp4Path)
        putString("csvPath", r.csvPath)
        putString("jsonPath", r.jsonPath)
        putString("taskId", r.taskId)
        putBoolean("isPractice", r.isPractice)
        // NEEDS_ATTENTION serialises to "needs-attention" (lowercase + underscore→hyphen).
        // The JS-side UploadQueueRow type carries it explicitly.
        putString("state", r.state.name.lowercase().replace('_', '-'))
        if (r.uploadId != null) putString("uploadId", r.uploadId)
        if (r.imuUploadId != null) putString("imuUploadId", r.imuUploadId)
        if (r.partsCount != null) putInt("partsCount", r.partsCount!!)
        if (r.chunkBytes != null) putDouble("chunkBytes", r.chunkBytes!!.toDouble())
        putArray(
            "videoParts",
            Arguments.createArray().apply { r.videoParts.forEach { pushMap(partStateToMap(it)) } },
        )
        putArray(
            "imuParts",
            Arguments.createArray().apply { r.imuParts.forEach { pushMap(partStateToMap(it)) } },
        )
        putString("metadataPut", r.metadataPut.name.lowercase())
        putDouble("enqueuedAt", r.enqueuedAt.toDouble())
        putDouble("lastProgressAt", r.lastProgressAt.toDouble())
        if (r.deadLetterReason != null) putString("deadLetterReason", r.deadLetterReason)
        // BUG-4 (2026-06-09) — surface the recording duration so the History /
        // Pending-Uploads rows render the real length on an in-flight row
        // (UploadQueueRow.durationSeconds → `(durationSeconds ?? 0)` no longer 0s).
        if (r.durationSeconds != null) putDouble("durationSeconds", r.durationSeconds!!)
        // Debug session `upload-queue-hol-finalizing` Fix C item 4 — surface
        // the failure markers to JS so the History UI's NEEDS_ATTENTION Retry
        // copy can render a reason-specific label.
        if (r.attemptCount > 0) putInt("attemptCount", r.attemptCount)
        if (r.lastFailureAt > 0L) putDouble("lastFailureAt", r.lastFailureAt.toDouble())
        if (r.lastFailureState != null) putString("lastFailureState", r.lastFailureState)
        if (r.lastFailureReason != null) putString("lastFailureReason", r.lastFailureReason)
    }

    private fun rowsToWritableArray(rows: List<UploadRow>): WritableArray =
        Arguments.createArray().apply { rows.forEach { pushMap(rowToMap(it)) } }

    override fun invalidate() {
        runCatching { bgExecutor.shutdownNow() }
        // The coordinator is the process-wide shared instance (also used by the
        // FGS / the UIDT JobService) — do NOT shut it down on a catalyst reload;
        // just detach the JS-bridge emitters so a torn-down ReactContext isn't
        // touched. A fresh module instance reinstalls them in its init.
        runCatching { coordinator.setEmitters({ _, _, _ -> }, { }, { }) }
        // Plan 06-12 follow-on (Finding 6) — unregister our connectivity
        // listener so a stale ReactContext doesn't keep receiving callbacks.
        runCatching { coordinator.removeConnectivityListener(connectivityListener) }
        super.invalidate()
    }
}

/**
 * Process-lived paused flags for the upload pipeline. Lives at module scope
 * (not in the bridge instance) so it survives a catalyst reload.
 *
 * Review fix (2026-06-10) — split into TWO ORed reasons. With the single
 * shared flag, the two pause owners punched through each other:
 *  - a recording stop's `resume()` cleared the coordinator's 401 park and
 *    re-drained every row against a known-dead token (one doomed 401 burst +
 *    a full silent-re-auth handshake per recording stop);
 *  - a successful silent re-auth's `resume()` could unpause uploads while a
 *    recording was in progress (UP-10 violation — the CPU/network-contention
 *    class that historically regressed `imu_video_drift`).
 *
 * `jsPaused`: the JS-lifecycle pause (recording in progress / logged out).
 * Bridge `pause()`/`resume()` flip it — nothing else.
 * `authPaused`: the coordinator parked the queue on a 401 (Phase 1, Bug 1).
 * Cleared ONLY by a fresh-token `setUploadContext(bearer != null)` or
 * `resumeAuth()` — never by the JS-lifecycle `resume()`.
 */
internal object UploadControlState {
    @Volatile
    private var jsPaused: Boolean = false

    @Volatile
    private var authPaused: Boolean = false

    fun setPaused(value: Boolean) { jsPaused = value }
    fun setAuthPaused(value: Boolean) { authPaused = value }
    fun isPaused(): Boolean = jsPaused || authPaused
    fun isAuthPaused(): Boolean = authPaused
}
