package ai.humynlabs.capture.upload

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.util.Log

/**
 * Phase 5 / Plan 05-07 — the user-initiated data-transfer (UIDT) `JobService`
 * for TRUE-background uploads.
 *
 * The `dataSync` foreground service ([ai.humynlabs.capture.fgs.HumynForegroundService])
 * can only run while the app started it in the foreground, and on Android 15 it
 * has a hard 6-hour cap (`onTimeout`). For uploads that need to continue past
 * that — or that need to resume from a true-background state (Doze wake, etc.) —
 * Android's UIDT JobScheduler job is the sanctioned path: `setUserInitiated(true)`
 * tells the OS this is a user-visible data transfer, so it's scheduled
 * aggressively and exempt from the usual background-job throttling, and it CAN
 * be scheduled from the background (unlike a `dataSync` `startForeground`).
 *
 * [scheduleUidt] is called by `HumynForegroundService.onTimeout(...)` (the
 * 6-hour-cap handoff) when the queue still has work. [onStartJob] runs
 * `UploadCoordinator.drainNow()` on a background thread, then `jobFinished` with
 * `wantsReschedule = queueHasWork()` so the OS re-runs the job until the queue
 * is drained.
 *
 * Declared in the manifest (Plan 05-04) as
 * `<service android:name=".upload.UploadJobService" android:permission="android.permission.BIND_JOB_SERVICE" android:exported="false"/>`
 * — only `JobScheduler` can bind it (T-5-07-02). Needs the
 * `RUN_USER_INITIATED_JOBS` permission (declared in the manifest in Plan 05-04).
 */
class UploadJobService : JobService() {

    override fun onStartJob(params: JobParameters): Boolean {
        Thread({
            try {
                val coord = UploadCoordinator.getShared(applicationContext)
                coord.drainNow()
                jobFinished(params, /* wantsReschedule = */ coord.queueHasWork())
            } catch (t: Throwable) {
                Log.w(TAG, "UIDT drain failed", t)
                // Reschedule — a transient failure (network blip, expired
                // presign) should be retried; a permanently-bad row dead-letters
                // inside the coordinator so it won't spin forever.
                jobFinished(params, true)
            }
        }, "humyn-upload-uidt").start()
        // true — work continues on the background thread; we'll call jobFinished.
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        // true — reschedule when the OS revokes the job (constraints changed,
        // etc.); the coordinator's per-part {etag,status} persistence means a
        // re-run resumes, not restarts.
        return true
    }

    companion object {
        private const val TAG = "HumynUploadJob"

        /** Stable job id for the upload UIDT job. */
        const val UPLOAD_JOB_ID = 0x48494F4A // "HIOJ"

        /**
         * Schedule (or re-schedule) the upload UIDT job. Called from
         * `HumynForegroundService.onTimeout(...)` when the 6-hour `dataSync` cap
         * is hit and the queue still has work. `setRequiredNetworkType(NETWORK_TYPE_ANY)`
         * — cellular uploads always proceed (UP-17: no Wi-Fi-only gate).
         */
        @JvmStatic
        fun scheduleUidt(ctx: Context) {
            val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return
            val job = JobInfo.Builder(UPLOAD_JOB_ID, ComponentName(ctx, UploadJobService::class.java))
                .setUserInitiated(true)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .build()
            runCatching { js.schedule(job) }
                .onFailure { Log.w(TAG, "scheduleUidt failed", it) }
        }
    }
}
