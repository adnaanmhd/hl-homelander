package ai.humynlabs.capture.fgs

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ServiceCompat
import ai.humynlabs.capture.upload.UploadCoordinator
import ai.humynlabs.capture.upload.UploadJobService
import java.util.concurrent.atomic.AtomicBoolean

/**
 * `camera|microphone|dataSync` foreground service.
 *
 * **Phase 3 — recording state.** Every Phase 3 capture component (Camera2
 * encoder, IMU SensorManager) runs INSIDE this service so the OS keeps the
 * process alive and prioritized while the user is recording. The recording-state
 * `startForeground` uses [FGS_TYPE_RECORDING] = `CAMERA | MICROPHONE | DATA_SYNC`,
 * which MUST match the manifest `android:foregroundServiceType="camera|microphone|dataSync"`
 * exactly (Pitfall 6 / Android-14 FGS strict mode — see the two-sided lock below).
 *
 * **Phase 5 — the upload type-downgrade lifecycle (UP-06 / UP-07 / UP-10).**
 * Once `HumynCapture.stop()` returns (the app is in the foreground), the upload
 * pipeline (`HumynUploadModule.enqueue()`) dispatches
 * `ACTION_SET_UPLOAD_ACTIVE(true)`. If recording is no longer active, the service
 * issues a SECOND `startForeground` with the NARROWER [FGS_TYPE_UPLOADING] =
 * `DATA_SYNC`-only (the documented type-downgrade — the camera/mic privacy
 * indicators disappear; this is NOT an in-place bit-clear — Pitfall 4) and an
 * "Uploading recordings…" notification, and runs `UploadCoordinator.drainNow()`
 * on its own [uploadThread]. When the queue empties (or `ACTION_SET_UPLOAD_ACTIVE(false)`
 * arrives) the service schedules a 5-minute idle stop ([idleStopRunnable] →
 * `stopForeground` + `stopSelf()`). On Android 15 the `dataSync` FGS has a 6-hour
 * cap → [onTimeout] hands off to the UIDT `UploadJobService` (allowed from the
 * background) and stops the FGS.
 *
 * **Pitfall 4 — start the upload FGS while foreground, never from the background.**
 * The `dataSync` `startForeground` only ever happens right after a recording
 * ends (the app is foreground). A TRUE-background resume (Doze wake, BOOT, the
 * `onTimeout` handoff) uses `UploadJobService` (a UIDT JobScheduler job),
 * never an FGS — Android 14+ rejects a background `startForeground`.
 *
 * **Two-sided lock (Pitfall 6).** `manifests.test.ts` asserts the manifest
 * `foregroundServiceType` string is exactly `"camera|microphone|dataSync"` AND
 * the `UploadJobService` `<service>` + `RUN_USER_INITIATED_JOBS` perm are
 * declared; `HumynForegroundServiceTest` asserts [FGS_TYPE_RECORDING] equals the
 * OR of the three constants, that [FGS_TYPE_UPLOADING] is a SUBSET of it, and
 * that [onTimeout] is overridden. Touching either side without the other fails a
 * test.
 *
 * **D-FGS-02 — `setUploadActive(boolean)` / `ACTION_SET_UPLOAD_ACTIVE`.** The
 * Phase-3 seam, now wired by Phase 5. The instance method stays for same-package
 * tests; the production path is the intent dispatch from `HumynUploadModule`.
 */
class HumynForegroundService : Service() {

    /** `true` while uploads are considered active (the dataSync state, or a queued recording). */
    private val uploadActive = AtomicBoolean(false)

    /** `true` while the recording-state `startForeground` is in effect (capture in progress). */
    private val recordingActive = AtomicBoolean(false)

    /** Background thread the upload drain runs on (created on first dataSync transition). */
    private var uploadThread: HandlerThread? = null
    private var uploadHandler: Handler? = null

    /** Main-looper handler the 5-min idle-stop runnable is posted on. */
    private val mainHandler = Handler(Looper.getMainLooper())

    /** Posted (5 min delayed) when the queue goes empty; cancelled if upload-active-true arrives first. */
    private val idleStopRunnable = Runnable {
        Log.i(TAG, "upload queue idle 5 min — stopping FGS")
        runCatching { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE) }
        stopSelf()
    }

    override fun onCreate() {
        super.onCreate()
        HumynForegroundNotification.ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // CR-02 — null intent = OS re-delivery after a process kill. The
        // CaptureSession / Camera2 pipeline / JS bridge are all dead; stop
        // ourselves so the FGS state matches reality (a stale "Recording in
        // progress" notification with the camera/mic indicator is a privacy
        // hazard).
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (intent.action == ACTION_SET_UPLOAD_ACTIVE) {
            val active = intent.getBooleanExtra(EXTRA_UPLOAD_ACTIVE, false)
            uploadActive.set(active)
            if (active && !recordingActive.get()) {
                // Recording has stopped (or never started) and uploads are now
                // active → do the documented type-downgrade: a SECOND
                // startForeground with the narrower DATA_SYNC-only bitmask + the
                // "Uploading recordings…" notification, and kick the drain on
                // the FGS thread. (Pitfall 4: this only happens while the app is
                // foreground — right after HumynCapture.stop(); a background
                // resume uses UploadJobService, not this.)
                startUploadingForeground()
                startUploadDrain()
                cancelIdleStop()
            } else if (active) {
                // config-only intent while recording is active — the
                // recording-state startForeground (camera|microphone|dataSync)
                // stays; the dataSync downgrade only happens once recording has
                // stopped (Pitfall 4).
            } else {
                // upload-active false — if there's no outstanding work, start
                // the 5-min idle countdown; otherwise leave the FGS up.
                maybeScheduleIdleStop()
            }
            return START_NOT_STICKY
        }

        // Default — recording state.
        recordingActive.set(true)
        cancelIdleStop()
        val notif = HumynForegroundNotification.build(this, "Recording in progress")
        ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
        // START_NOT_STICKY — the JS bridge owns the recording lifecycle; never
        // auto-restart on our own after a low-memory kill.
        return START_NOT_STICKY
    }

    /**
     * Phase 5 seam — the recording path calls this when capture finalizes (the
     * recording-state `startForeground` is no longer in effect). If the upload
     * queue still has work, immediately transition to the `dataSync` upload
     * state (re-`startForeground` with [FGS_TYPE_UPLOADING] — do NOT `stopSelf`
     * between recording and uploading, or the brief gap risks an OS kill).
     */
    fun onRecordingFinalized() {
        recordingActive.set(false)
        val hasWork = runCatching {
            UploadCoordinator.getShared(applicationContext).queueHasWork()
        }.getOrDefault(false)
        if (hasWork) {
            uploadActive.set(true)
            startUploadingForeground()
            startUploadDrain()
            cancelIdleStop()
        } else {
            maybeScheduleIdleStop()
        }
    }

    /**
     * Phase 5 seam (still reachable via [ACTION_SET_UPLOAD_ACTIVE] intent
     * dispatch — the production path). Kept for same-package tests.
     */
    fun setUploadActive(active: Boolean) {
        uploadActive.set(active)
        if (active && !recordingActive.get()) {
            startUploadingForeground()
            startUploadDrain()
            cancelIdleStop()
        } else if (!active) {
            maybeScheduleIdleStop()
        }
    }

    /**
     * Android 15 `dataSync` 6-hour cap. Within a few seconds we MUST stop the
     * FGS; if the queue still has work we hand off to the UIDT `UploadJobService`
     * (a JobScheduler user-initiated data-transfer job — allowed to run from the
     * background, unlike a `dataSync` FGS).
     */
    override fun onTimeout(startId: Int, fgsType: Int) {
        Log.w(TAG, "FGS onTimeout (Android 15 dataSync 6 h cap, type=$fgsType) — handing off to UIDT JobService")
        if (runCatching { UploadCoordinator.getShared(applicationContext).queueHasWork() }.getOrDefault(false)) {
            runCatching { UploadJobService.scheduleUidt(applicationContext) }
        }
        runCatching { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE) }
        stopSelf()
    }

    /** Older 1-arg overload (pre-API-35 builds may dispatch this). Delegate to the 2-arg form. */
    override fun onTimeout(startId: Int) {
        onTimeout(startId, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    }

    override fun onDestroy() {
        cancelIdleStop()
        runCatching { uploadThread?.quitSafely() }
        uploadThread = null
        uploadHandler = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private fun startUploadingForeground() {
        runCatching {
            val notif = HumynForegroundNotification.buildUploading(this)
            ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_UPLOADING)
        }
    }

    private fun startUploadDrain() {
        if (uploadThread == null) {
            uploadThread = HandlerThread("humyn-upload-fgs").apply { start() }
            uploadHandler = Handler(uploadThread!!.looper)
        }
        uploadHandler?.post {
            runCatching { UploadCoordinator.getShared(applicationContext).drainNow() }
            // After a drain, if the queue's empty, start the 5-min idle countdown
            // (the drain is synchronous, so by here it's done).
            mainHandler.post { maybeScheduleIdleStop() }
        }
    }

    private fun maybeScheduleIdleStop() {
        val hasWork = runCatching {
            UploadCoordinator.getShared(applicationContext).queueHasWork()
        }.getOrDefault(false)
        if (!hasWork) {
            cancelIdleStop()
            mainHandler.postDelayed(idleStopRunnable, IDLE_STOP_MS)
        }
    }

    private fun cancelIdleStop() {
        mainHandler.removeCallbacks(idleStopRunnable)
    }

    companion object {
        private const val TAG = "HumynFgs"
        const val NOTIF_ID = 9001

        /** Queue-empty grace before the upload FGS stops itself (UP-06: "stops after 5 min idle"). */
        const val IDLE_STOP_MS = 5L * 60 * 1000

        /**
         * Recording-state bitmask — MUST equal `AndroidManifest.xml`'s
         * `android:foregroundServiceType="camera|microphone|dataSync"`. Touching
         * either side without the other → Android 14 `MissingForegroundServiceTypeException`.
         * UNCHANGED by Phase 5 — the manifest superset stays the same.
         */
        const val FGS_TYPE_RECORDING =
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC

        /**
         * Upload-state bitmask — `DATA_SYNC`-only, the documented type-downgrade
         * target (a STRICT SUBSET of [FGS_TYPE_RECORDING] / the manifest superset
         * — no manifest change needed). The second `startForeground` with this
         * narrower mask drops the camera/mic privacy indicators.
         */
        const val FGS_TYPE_UPLOADING = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC

        /**
         * Phase 5 dispatches this action via
         * `startService(Intent(ctx, HumynForegroundService::class.java)
         *     .setAction(ACTION_SET_UPLOAD_ACTIVE)
         *     .putExtra(EXTRA_UPLOAD_ACTIVE, true|false))`. With `true` AND
         * recording not active → the `dataSync` type-downgrade + the drain.
         */
        const val ACTION_SET_UPLOAD_ACTIVE = "ai.humynlabs.capture.fgs.SET_UPLOAD_ACTIVE"
        const val EXTRA_UPLOAD_ACTIVE = "uploadActive"
    }
}
