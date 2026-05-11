package ai.humynlabs.capture.fgs

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.ServiceCompat
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Phase 3 D-FGS-01 — `camera|microphone|dataSync` foreground service.
 *
 * Every Phase 3 capture component (Camera2 encoder, AudioRecord, IMU
 * SensorManager) runs INSIDE this service so that the OS keeps the process
 * alive and prioritized while the user is recording. Plan 03-09's
 * `HumynCaptureModule.start()` binds and starts this service; `stop()`
 * unbinds and stops it.
 *
 * **Pitfall 6 strict-mode invariant.** Android 14 (API 34) introduced FGS
 * strict-mode: `MissingForegroundServiceTypeException` is thrown by
 * `ServiceCompat.startForeground` when the runtime bitmask doesn't match
 * `android:foregroundServiceType` on the manifest `<service>` element
 * exactly. `FGS_TYPE_RECORDING` and the manifest `"camera|microphone|dataSync"`
 * string MUST stay in lock-step.
 *
 * Two-sided lock that catches drift on every PR:
 *   - `manifests.test.ts` (Phase 2 Pattern 53) asserts the manifest string.
 *   - `HumynForegroundServiceTest` asserts the runtime bitmask equals the
 *     OR of the same three `ServiceInfo.FOREGROUND_SERVICE_TYPE_*` constants.
 * If either side changes without the other, one of the tests fails.
 *
 * **D-FGS-02 — `setUploadActive(boolean)`.** Phase 5 seam. Phase 3 itself
 * never calls `setUploadActive`. When Phase 5 ships its background-upload
 * pipeline, it will toggle this flag; the service can then downgrade
 * (post-recording) from `camera|microphone|dataSync` → `dataSync`-only
 * while uploads finish. The boolean is `AtomicBoolean` for safe cross-thread
 * read/write.
 */
class HumynForegroundService : Service() {

    private val uploadActive = AtomicBoolean(false)

    override fun onCreate() {
        super.onCreate()
        HumynForegroundNotification.ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // CR-02 fix — when intent is null, the OS is re-delivering after a
        // process kill (the historical cost of START_STICKY). The
        // CaptureSession / Camera2 pipeline / JS bridge are all dead at this
        // point; restarting the FGS would show a "Recording in progress"
        // notification with the camera|microphone FGS-type indicator while
        // nothing is actually being captured (a privacy hazard given the
        // bitmask). Stop ourselves so the FGS state matches reality.
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        // WR-01 fix — Phase 5 will dispatch a "set upload active" intent
        // via startService(Intent(...).setAction(ACTION_SET_UPLOAD_ACTIVE).
        // putExtra(EXTRA_UPLOAD_ACTIVE, true|false)). The previous
        // setUploadActive(boolean) instance method was unreachable from
        // outside the service (onBind returns null, no Intent dispatch);
        // routing through the intent surface keeps the existing
        // start-foreground path untouched while exposing a real seam.
        if (intent.action == ACTION_SET_UPLOAD_ACTIVE) {
            uploadActive.set(intent.getBooleanExtra(EXTRA_UPLOAD_ACTIVE, false))
            // Do NOT call startForeground here; this is a config-only
            // intent for an already-running service.
            return START_NOT_STICKY
        }
        val notif = HumynForegroundNotification.build(this, "Recording in progress")
        ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
        // START_NOT_STICKY: the JS bridge owns the lifecycle. After a
        // low-memory kill, the user re-launches the app and explicitly
        // start()s a new session — at which point HumynCaptureModule.start
        // re-creates the FGS. Never auto-restart on our own.
        return START_NOT_STICKY
    }

    /**
     * Phase 5 seam (WR-01 fix — now reachable via [ACTION_SET_UPLOAD_ACTIVE]
     * intent dispatch). Phase 3 never calls this directly; Plan 03-09's
     * `HumynCaptureModule` only manages the recording lifecycle. Kept
     * `internal`-friendly so a same-package test can still flip the flag
     * without round-tripping through the intent surface.
     */
    fun setUploadActive(active: Boolean) {
        uploadActive.set(active)
        // Phase 5 will downgrade to FOREGROUND_SERVICE_TYPE_DATA_SYNC here when the
        // recording session ends but uploads are still in flight. Phase 3 ships
        // the seam only — no behavior consequence.
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val NOTIF_ID = 9001

        /**
         * Strict bitmask matching `AndroidManifest.xml`'s
         * `android:foregroundServiceType="camera|microphone|dataSync"`.
         * Touching either side without the other → Android 14
         * `MissingForegroundServiceTypeException` at startForeground time.
         */
        const val FGS_TYPE_RECORDING =
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC

        /**
         * WR-01 fix — Phase 5 dispatches this intent action via
         * `startService(Intent(ctx, HumynForegroundService::class.java)
         *     .setAction(ACTION_SET_UPLOAD_ACTIVE)
         *     .putExtra(EXTRA_UPLOAD_ACTIVE, true|false))` to toggle the
         * upload-active flag without unbinding/re-binding the service.
         * The intent does NOT trigger a `startForeground` call — the
         * service is already in the foreground when this intent arrives.
         */
        const val ACTION_SET_UPLOAD_ACTIVE = "ai.humynlabs.capture.fgs.SET_UPLOAD_ACTIVE"
        const val EXTRA_UPLOAD_ACTIVE = "uploadActive"
    }
}
