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
 */
class CaptureLaunchSweep(private val filesDir: File) {
    fun run() {
        sweepRecordings()
        sweepPractice()
    }

    private fun sweepRecordings() {
        val recordingsDir = File(filesDir, "recordings")
        if (!recordingsDir.exists()) return

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
    }
}
