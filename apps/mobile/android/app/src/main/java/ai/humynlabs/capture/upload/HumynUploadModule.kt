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
 *  - [clearVerified] — the app-launch reconciliation sweep (Plan 05-08;
 *    UP-15 / VERIFY-06) calls this with the recordingIds the server reported
 *    `verified`; the local mp4/csv/json are unlinked and the rows dropped.
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

    /** The native-owned durable queue (JSON-on-disk under filesDir/upload-queue). */
    private val queueStore = UploadQueueStore(reactContext.applicationContext)

    /**
     * The paused flag. Mirrors [UploadControlState] (the process-lived
     * @Volatile flag from Plan 05-04 that survives a catalyst reload) — the
     * coordinator reads `UploadControlState::isPaused`; this AtomicBoolean is
     * the bridge-instance handle the plan calls for. Both are kept in sync.
     */
    private val paused = AtomicBoolean(UploadControlState.isPaused())

    /** Event-driven network monitor — wakes the coordinator when connectivity returns. */
    private val networkMonitor by lazy {
        NetworkMonitor(reactContext.applicationContext, ::onConnectivityRegained)
    }

    /**
     * The transfer engine (Plan 05-06): drains the queue, runs the multipart
     * flow with bounded concurrency, persists per-part state, dead-letters
     * cleanly. The auth context (API base URL + bearer JWT + signed-in sub) is
     * pushed in via [setUploadContext] (the JWT lives in encrypted MMKV — the
     * bridge injects it rather than reaching MMKV from Kotlin).
     */
    private val coordinator by lazy {
        UploadCoordinator(
            queueStore = queueStore,
            networkMonitor = networkMonitor,
            emitProgress = ::emitProgress,
            emitQueueChanged = ::emitQueueChanged,
            getApiBaseUrl = UploadAuthContext::apiBaseUrl,
            getBearerToken = UploadAuthContext::bearerToken,
            getCurrentSub = UploadAuthContext::sub,
            isPaused = UploadControlState::isPaused,
        )
    }

    init {
        runCatching { networkMonitor.register() }
    }

    override fun getName(): String = NAME

    /**
     * Push the auth context the coordinator needs for `/recordings/init`,
     * `/finalize`, `/reupload`: the API base URL (`react-native-config`
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
                val row = UploadRow(
                    recordingId = recordingId,
                    ownerUserId = ownerUserId,
                    mp4Path = mp4Path,
                    csvPath = csvPath,
                    jsonPath = jsonPath,
                    taskId = taskId,
                    isPractice = isPractice,
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

    /** Resume uploads (UP-10 — HumynCapture.stop() calls this). */
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
     * On the app-launch reconciliation sweep (Plan 05-08; UP-15 / VERIFY-06):
     * mark each recordingId VERIFIED, unlink its local mp4/csv/json, drop the
     * row. Local files are NEVER deleted before this point.
     */
    @ReactMethod
    fun clearVerified(recordingIds: ReadableArray, promise: Promise) {
        bgExecutor.execute {
            try {
                for (i in 0 until recordingIds.size()) {
                    val id = recordingIds.getString(i) ?: continue
                    queueStore.markVerifiedAndDeleteLocal(id)
                }
                emitQueueChanged()
                promise.resolve(null)
            } catch (t: Throwable) {
                promise.reject("UPLOAD_CLEAR_VERIFIED_FAILED", t.message ?: "clearVerified failed", t)
            }
        }
    }

    // -------------------------------------------------------------------------
    // Event emission
    // -------------------------------------------------------------------------

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

    /** Connectivity regained → wake the coordinator (unless paused). */
    private fun onConnectivityRegained() {
        if (!UploadControlState.isPaused()) runCatching { coordinator.drain() }
    }

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
        putBoolean("reupload", r.reupload)
    }

    private fun rowsToWritableArray(rows: List<UploadRow>): WritableArray =
        Arguments.createArray().apply { rows.forEach { pushMap(rowToMap(it)) } }

    override fun invalidate() {
        runCatching { bgExecutor.shutdownNow() }
        runCatching { coordinator.shutdown() }
        runCatching { networkMonitor.unregister() }
        super.invalidate()
    }
}

/**
 * Process-lived paused flag for the upload pipeline. `HumynUploadModule.pause()`
 * / `resume()` flip it; `UploadCoordinator` (Plan 05-06) reads it. Lives at
 * module scope (not in the bridge instance) so it survives a catalyst reload.
 */
internal object UploadControlState {
    @Volatile
    private var paused: Boolean = false

    fun setPaused(value: Boolean) { paused = value }
    fun isPaused(): Boolean = paused
}
