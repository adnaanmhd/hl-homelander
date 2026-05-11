package ai.humynlabs.capture.capture

import android.util.Log
import java.io.File

/**
 * Phase 3 D-FS-04 — app-launch orphan sweep over `filesDir/recordings/`
 * and `filesDir/practice/` (Plan 03-09 Task 2).
 *
 * Sweeps:
 *   1. recordings/[base].mp4 without matching .json:
 *      - if .session.json sidecar exists AND parseable, log + leave the
 *        triple (Phase 4's RecordingScreen will call HumynCapture.start()
 *        which triggers a re-finalize attempt off the sidecar);
 *      - if no sidecar OR SidecarManager.read throws sidecar_corrupt,
 *        delete the triple (mp4 + csv + corrupt sidecar). T-3.4-01
 *        mitigation.
 *   2. recordings/[base].json (non-sidecar) without matching .mp4:
 *      delete (orphan JSON — metadata wrote successfully but the muxer
 *      crashed before a frame landed; nothing to upload).
 *   3. practice/[any] files older than 24 h: delete (defensive — ONB-08
 *      says practice runs once per install per Google account; old
 *      practice files are crash residue).
 *
 * Phase 5 owns delete-on-verified for already-uploaded triples; Phase 3
 * explicitly does NOT touch verified-but-undeleted files.
 *
 * Idempotent: missing recordings/ or practice/ directories are skipped
 * silently. Safe to call from MainApplication.onCreate on every cold
 * launch.
 *
 * Phase 4 D-LIFE-04 (plan 04-10) — `run()` now RETURNS the list of
 * orphan-with-valid-sidecar `filenameBase`s it found (the "re-finalize
 * candidate" log entries). MainApplication.onCreate stashes that list in
 * [pendingRecovery]; HumynCaptureModule drains it on first onHostResume
 * (after the JS bundle is up + `installBootRecoveryListener` has
 * subscribed) and emits the one-shot `onCrashRecovery` event so the JS
 * boot listener can fire the Home "Recording recovered after force-quit
 * — uploading." toast (REC-12). The actual re-finalize off the sidecar
 * still happens later (Phase 5's upload path picks the triple up). The
 * existing sweep semantics are UNCHANGED — this only ADDS the
 * recovered-list capture.
 */
class CaptureLaunchSweep(private val filesDir: File) {
    /**
     * Run the sweep. Returns the orphan-with-valid-sidecar `filenameBase`s
     * (the re-finalize candidates) so the caller can surface a recovery
     * toast — empty when nothing recoverable was found. Existing callers
     * that ignore the return value are unaffected.
     */
    fun run(): List<String> {
        val recovered = sweepRecordings()
        sweepPractice()
        return recovered
    }

    private fun sweepRecordings(): List<String> {
        val recordingsDir = File(filesDir, "recordings")
        if (!recordingsDir.exists()) return emptyList()
        val recovered = mutableListOf<String>()

        // Pass 1: orphan .mp4 (no matching .json).
        val mp4s = recordingsDir.listFiles { f -> f.name.endsWith(".mp4") } ?: emptyArray()
        for (mp4 in mp4s) {
            val base = mp4.nameWithoutExtension
            val json = File(recordingsDir, "$base.json")
            if (json.exists()) continue
            val sidecar = File(recordingsDir, "$base.session.json")
            if (sidecar.exists()) {
                try {
                    SidecarManager.read(sidecar)
                    Log.i(TAG, "orphan_with_sidecar=$base — Phase 4 re-finalize candidate")
                    // D-LIFE-04 — a recoverable orphan: record its base so
                    // MainApplication can surface the crash-recovery toast.
                    recovered.add(base)
                } catch (_: IllegalArgumentException) {
                    Log.w(TAG, "corrupt_sidecar=$base — discarding triple")
                    mp4.delete()
                    File(recordingsDir, "$base.csv").delete()
                    sidecar.delete()
                }
            } else {
                Log.w(TAG, "orphan_no_sidecar=$base — discarding triple")
                mp4.delete()
                File(recordingsDir, "$base.csv").delete()
            }
        }

        // Pass 2: orphan .json (no matching .mp4). Must skip .session.json
        // sidecars (those are paired with their .mp4 already, or already
        // deleted in pass 1).
        val jsons = recordingsDir.listFiles { f ->
            f.name.endsWith(".json") && !f.name.endsWith(".session.json")
        } ?: emptyArray()
        for (j in jsons) {
            val base = j.nameWithoutExtension
            if (!File(recordingsDir, "$base.mp4").exists()) {
                Log.w(TAG, "orphan_json=$base — deleting")
                j.delete()
            }
        }

        // WR-13 fix — Pass 3: orphan .partial residue from
        // MetadataComposer.writeAtomic / SidecarManager.write
        // (`{file}.partial` left on disk when the process is killed
        // between the partial write and the atomic move). Without this
        // sweep, `.partial` cruft accumulates indefinitely AND pollutes
        // FilenameGenerator's per-day NNN scan: a file like
        // `20260510_001234_005.json.partial` has nameWithoutExtension =
        // `20260510_001234_005.json` which still starts with today's
        // date and would be counted in the per-day NNN allocation,
        // incrementing the next NNN by 1 (sequence pollution). Sweeping
        // them at boot keeps the recordings/ directory clean.
        val partials = recordingsDir.listFiles { f -> f.name.endsWith(".partial") } ?: emptyArray()
        for (p in partials) {
            Log.w(TAG, "orphan_partial=${p.name} — deleting")
            p.delete()
        }
        return recovered
    }

    private fun sweepPractice() {
        val practiceDir = File(filesDir, "practice")
        if (!practiceDir.exists()) return
        val cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L
        practiceDir.listFiles()?.forEach { f ->
            if (f.lastModified() < cutoff) {
                Log.i(TAG, "practice_expired=${f.name} — deleting")
                f.delete()
            }
        }
    }

    companion object {
        private const val TAG = "CaptureLaunchSweep"

        /**
         * Phase 4 D-LIFE-04 — process-singleton holder for the
         * orphan-with-valid-sidecar bases the boot sweep found.
         * MainApplication.onCreate sets this from `CaptureLaunchSweep(...).run()`;
         * HumynCaptureModule drains it (sets it back to `null`) on first
         * onHostResume and emits the one-shot `onCrashRecovery` event.
         * `@Volatile` because it's written on the main thread in onCreate
         * and read on the main thread in onHostResume — defensive against
         * any future cross-thread access.
         */
        @Volatile
        @JvmStatic
        var pendingRecovery: List<String>? = null
    }
}
