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
        val notif = HumynForegroundNotification.build(this, "Recording in progress")
        ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
        return START_STICKY
    }

    /**
     * Phase 5 seam. Phase 3 never calls this; Plan 03-09's
     * `HumynCaptureModule` only manages the recording lifecycle.
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
    }
}
