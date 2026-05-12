package ai.humynlabs.capture.capture

import android.util.Log
import java.io.File

/**
 * Phase 3 D-FS-04 — app-launch orphan sweep over `filesDir/recordings/`
 * and `filesDir/practice/` (Plan 03-09 Task 2; D-LIFE-04 wiring landed in
 * plan 04-10).
 *
 * As of Phase-5 D-03, CaptureLaunchSweep never re-finalizes a crash orphan —
 * all crash-truncated fragments are discarded so no degenerate metadata bundle
 * (duration_seconds:0 / null drift) reaches the upload queue. `run()`
 * consequently always returns an empty list; the D-07 crash-recovery toast is
 * kept wired only as a safety net for some future recovery path.
 *
 * Sweeps:
 *   1. `recordings/[base].mp4` without matching `.json`:
 *      - if a `.session.json` sidecar exists (parseable or not), delete the
 *        triple (mp4 + csv + sidecar). Phase-5 D-03: a crash-truncated
 *        fragment — even a playable post-30s one — is junk-with-degenerate-
 *        metadata, so it is discarded, never re-finalized into an upload-able
 *        triple. (Pre-D-03 this branch attempted a re-finalize off the
 *        sidecar; that path is deleted.)
 *      - if no sidecar, delete the triple (mp4 + csv). T-3.4-01.
 *   2. `recordings/[base].json` (non-sidecar) without matching `.mp4`:
 *      delete (orphan JSON — metadata wrote but the muxer crashed before a
 *      frame landed; nothing to upload).
 *   3. Bug-3(c) — `recordings/[base].session.json` orphan with NO matching
 *      `.mp4`: delete. Previously no pass enumerated lone sidecars (Pass 1
 *      only iterates `.mp4`s, Pass 2 only non-sidecar `.json`s), so a
 *      `.session.json` left after a crash that never produced an mp4 would
 *      accumulate forever.
 *   4. `recordings/` `.partial` residue from atomic writes — delete (WR-13).
 *   5. `practice/[any]` files older than 24 h — delete (ONB-08 crash residue).
 *
 * Phase 5 owns delete-on-verified for already-uploaded triples; Phase 3
 * explicitly does NOT touch verified-but-undeleted files.
 *
 * Idempotent: missing `recordings/` or `practice/` directories are skipped
 * silently. Safe to call from `MainApplication.onCreate` on every cold launch.
 *
 * Phase 4 D-LIFE-04 — `run()` is still typed `List<String>` (the orphan bases
 * re-finalized into a usable triple). Post-D-03 it always returns `emptyList()`.
 * `MainApplication.onCreate` stashes that list in [pendingRecovery];
 * `HumynCaptureModule` drains it on first onHostResume and emits the
 * one-shot `onCrashRecovery` event so the JS boot listener can fire the
 * Home "Recording recovered after force-quit — uploading." toast (REC-12) —
 * effectively dead code now, kept as a safety net.
 */
class CaptureLaunchSweep(private val filesDir: File) {
    /**
     * Run the sweep. Returns the orphan `filenameBase`s that were
     * successfully re-finalized into a usable `{base}.{mp4,csv,json}` triple.
     * As of Phase-5 D-03 nothing is ever re-finalized — this always returns an
     * empty list. Existing callers that ignore the return value are unaffected.
     */
    fun run(): List<String> {
        val recovered = sweepRecordings()
        sweepPractice()
        return recovered
    }

    private fun sweepRecordings(): List<String> {
        val recordingsDir = File(filesDir, "recordings")
        if (!recordingsDir.exists()) return emptyList()
        // Phase-5 D-03: nothing is ever re-finalized any more — kept the
        // mutableListOf<String>()/return-type shape so `run(): List<String>`
        // and its callers compile unchanged; it just always returns empty now.
        val recovered = mutableListOf<String>()

        // Pass 1: orphan .mp4 (no matching .json) — always discarded (D-03).
        val mp4s = recordingsDir.listFiles { f -> f.name.endsWith(".mp4") } ?: emptyArray()
        for (mp4 in mp4s) {
            val base = mp4.nameWithoutExtension
            val json = File(recordingsDir, "$base.json")
            if (json.exists()) continue
            val csv = File(recordingsDir, "$base.csv")
            val sidecarFile = File(recordingsDir, "$base.session.json")
            if (sidecarFile.exists()) {
                Log.w(TAG, "orphan_with_sidecar=$base — D-03: crash-truncated fragment discarded (no degenerate bundle reaches upload)")
                mp4.delete(); csv.delete(); sidecarFile.delete()
            } else {
                Log.w(TAG, "orphan_no_sidecar=$base — discarding triple")
                mp4.delete(); csv.delete()
            }
        }

        // Pass 2: orphan .json (no matching .mp4). Must skip .session.json
        // sidecars (those are paired with their .mp4 already, or handled below).
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

        // Pass 3 (Bug-3(c)) — orphan .session.json with NO matching .mp4.
        // A `.session.json` is `{base}.session.json`, so `nameWithoutExtension`
        // is `{base}.session` — strip the trailing `.session` to get `{base}`.
        val orphanSidecars = recordingsDir.listFiles { f -> f.name.endsWith(".session.json") }
            ?: emptyArray()
        for (sc in orphanSidecars) {
            val base = sc.name.removeSuffix(".session.json")
            if (!File(recordingsDir, "$base.mp4").exists()) {
                Log.w(TAG, "orphan_sidecar_no_mp4=$base — deleting")
                sc.delete()
                // Also clean a lone CSV if it somehow survived without the mp4.
                File(recordingsDir, "$base.csv").let { if (it.exists()) it.delete() }
            }
        }

        // Pass 4 (WR-13) — orphan .partial residue from MetadataComposer.writeAtomic
        // / SidecarManager.write (a `{file}.partial` left on disk when the process
        // is killed between the partial write and the atomic move). Without this
        // sweep, `.partial` cruft accumulates indefinitely AND pollutes
        // FilenameGenerator's per-day NNN scan.
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
         * Phase 4 D-LIFE-04 — process-singleton holder for the orphan bases
         * the boot sweep actually re-finalized into usable triples.
         * `MainApplication.onCreate` sets this from `CaptureLaunchSweep(...).run()`;
         * `HumynCaptureModule` drains it (sets it back to `null`) on first
         * onHostResume and emits the one-shot `onCrashRecovery` event.
         */
        @Volatile
        @JvmStatic
        var pendingRecovery: List<String>? = null
    }
}
