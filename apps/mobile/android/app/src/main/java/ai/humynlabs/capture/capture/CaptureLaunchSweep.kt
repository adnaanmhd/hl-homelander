package ai.humynlabs.capture.capture

import android.util.Log
import java.io.File
import java.io.RandomAccessFile
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/**
 * Phase 3 D-FS-04 — app-launch orphan sweep over `filesDir/recordings/`
 * and `filesDir/practice/` (Plan 03-09 Task 2; D-LIFE-04 re-finalize
 * landed in plan 04-10's wiring; the **actual** re-finalize / discard of
 * orphan-with-sidecar segments landed in the 2026-05-12 Phase-4 smoke
 * fix round — bugs 3(b)/3(c) below).
 *
 * Sweeps:
 *   1. `recordings/[base].mp4` without matching `.json`:
 *      - if a `.session.json` sidecar exists AND is parseable, attempt a
 *        **re-finalize off the sidecar** ([tryReFinalize]):
 *          • MP4 has a usable box structure (`ftyp` + `moov` + ≥1 `moof`
 *            fragment) → SHA the mp4/csv, compose `video_metadata.json`
 *            from the sidecar (drift/IMU-floor degenerate — the per-frame
 *            timestamps were in-memory-only and lost with the crash;
 *            CLAUDE.md's drift gate is telemetry-only anyway), write it
 *            atomically, delete the sidecar → the segment becomes a
 *            complete `{base}.{mp4,csv,json}` triple Phase 5's upload path
 *            picks up. The base is reported as "recovered".
 *          • MP4 is a stub / incomplete (no `moov`, or no fragment, or
 *            unreadable) → it is unrecoverable as playable video; discard
 *            the triple (mp4 + csv + sidecar). NOT reported as recovered.
 *      - if no sidecar OR `SidecarManager.read` throws `sidecar_corrupt`,
 *        delete the triple (mp4 + csv + corrupt sidecar). T-3.4-01.
 *   2. `recordings/[base].json` (non-sidecar) without matching `.mp4`:
 *      delete (orphan JSON — metadata wrote but the muxer crashed before a
 *      frame landed; nothing to upload).
 *   3. Bug-3(c) — `recordings/[base].session.json` orphan with NO matching
 *      `.mp4`: delete. Previously no pass enumerated lone sidecars (Pass 1
 *      only iterates `.mp4`s, Pass 2 only non-sidecar `.json`s), so a
 *      `.session.json` left after a crash that never produced an mp4 would
 *      accumulate forever AND inflate `recovered` count expectations.
 *   4. `recordings/` `.partial` residue from atomic writes — delete (WR-13).
 *   5. `practice/[any]` files older than 24 h — delete (ONB-08 crash residue).
 *
 * Phase 5 owns delete-on-verified for already-uploaded triples; Phase 3
 * explicitly does NOT touch verified-but-undeleted files.
 *
 * Idempotent: missing `recordings/` or `practice/` directories are skipped
 * silently. Safe to call from `MainApplication.onCreate` on every cold launch.
 *
 * Phase 4 D-LIFE-04 — `run()` RETURNS the list of orphan bases that were
 * actually re-finalized into a usable triple (the "recovered" set).
 * `MainApplication.onCreate` stashes that list in [pendingRecovery];
 * `HumynCaptureModule` drains it on first onHostResume and emits the
 * one-shot `onCrashRecovery` event so the JS boot listener can fire the
 * Home "Recording recovered after force-quit — uploading." toast (REC-12).
 */
class CaptureLaunchSweep(private val filesDir: File) {
    /**
     * Run the sweep. Returns the orphan `filenameBase`s that were
     * successfully re-finalized into a usable `{base}.{mp4,csv,json}` triple
     * — empty when nothing recoverable was found (a stub-mp4 orphan is
     * discarded, not "recovered"). Existing callers that ignore the return
     * value are unaffected.
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
            val csv = File(recordingsDir, "$base.csv")
            val sidecarFile = File(recordingsDir, "$base.session.json")
            if (sidecarFile.exists()) {
                val sidecar = try {
                    SidecarManager.read(sidecarFile)
                } catch (_: IllegalArgumentException) {
                    Log.w(TAG, "corrupt_sidecar=$base — discarding triple")
                    mp4.delete(); csv.delete(); sidecarFile.delete()
                    null
                }
                if (sidecar != null) {
                    if (tryReFinalize(base, mp4, csv, json, sidecarFile, sidecar)) {
                        Log.i(TAG, "orphan_with_sidecar=$base — re-finalized into triple")
                        recovered.add(base)
                    } else {
                        Log.w(TAG, "orphan_with_sidecar=$base — mp4 unrecoverable, discarding triple")
                        mp4.delete(); csv.delete(); sidecarFile.delete()
                    }
                }
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

    /**
     * Bug-3(b) — attempt to re-finalize a crashed orphan segment off its
     * `.session.json` sidecar. Returns `true` iff a complete, usable
     * `{base}.{mp4,csv,json}` triple now exists (the sidecar has been
     * deleted); `false` if the MP4 is unrecoverable (caller discards the
     * triple) or the metadata write failed (caller discards — a half-written
     * `.partial` is cleaned by Pass 4 next launch).
     *
     * "Usable" = the MP4 has at least `ftyp` + `moov` + one `moof` fragment
     * box at the top level ([mp4LooksPlayable]). A 778-byte force-quit stub
     * (no `moov`, no fragments) fails this — it cannot be muxed into a
     * playable file, so it is discarded rather than shipped as junk.
     *
     * Drift / IMU-floor are written degenerate (`null`): the per-frame video
     * timestamps were in-memory only (`Segment.videoFrameTimestamps`) and
     * lost with the crash, so an accurate drift figure is unavailable. Per
     * CLAUDE.md the drift metrics are fleet telemetry only, not a gate — a
     * recovered crashed segment carrying null drift is acceptable.
     */
    private fun tryReFinalize(
        base: String,
        mp4: File,
        csv: File,
        json: File,
        sidecarFile: File,
        sidecar: SidecarPayload,
    ): Boolean {
        if (!mp4LooksPlayable(mp4)) return false
        return try {
            val mp4Sha = HashStreamer.sha256(mp4)
            val csvSha = if (csv.exists()) HashStreamer.sha256(csv) else ""
            val endIso = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            val mcSidecar = adaptSidecar(sidecar)
            val metrics = MetadataComposer.FinalizeMetrics(
                mp4Sha = mp4Sha,
                csvSha = csvSha,
                mp4SizeBytes = mp4.length(),
                csvSizeBytes = if (csv.exists()) csv.length() else 0L,
                drift = null,
                imuFloorHz = null,
                gyroRateHz = 416,
                accelRateHz = 416,
                mp4Filename = "$base.mp4",
                csvFilename = "$base.csv",
                // No reliable end clock for a crashed segment — leave duration
                // unknown (0); server-side QA derives the real duration from
                // the MP4 moov. Start ISO comes from the sidecar.
                durationSeconds = 0.0,
                startTimestampIso = sidecar.wallclockStartIso,
                endTimestampIso = endIso,
                imuStartTimestampIso = sidecar.wallclockStartIso,
                imuEndTimestampIso = endIso,
                environment = "residential",
                timeOfDay = if (java.time.LocalTime.now().hour in 6..18) "day" else "night",
            )
            val composed = MetadataComposer.compose(mcSidecar, metrics)
            MetadataComposer.writeAtomic(json, composed)
            SidecarManager.delete(sidecarFile)
            true
        } catch (t: Throwable) {
            Log.w(TAG, "re_finalize_failed=$base — ${t.message}")
            // Best-effort cleanup of any half-written metadata.
            try { File(json.parentFile, "${json.name}.partial").delete() } catch (_: Throwable) {}
            try { if (json.exists()) json.delete() } catch (_: Throwable) {}
            false
        }
    }

    /**
     * Minimal top-level MP4 box scan: returns `true` iff the file contains an
     * `ftyp` box, a `moov` box, AND at least one `moof` fragment box at the
     * root level. Bounds-tolerant — any malformed length / truncation / IO
     * error returns `false` (treat as unrecoverable). Reads only box headers
     * (`size:uint32` + `type:4cc`), seeking past each box body, so it is O(box
     * count), not O(file size).
     */
    private fun mp4LooksPlayable(mp4: File): Boolean {
        if (!mp4.exists() || mp4.length() < 16L) return false
        return try {
            RandomAccessFile(mp4, "r").use { raf ->
                val len = raf.length()
                var offset = 0L
                var sawFtyp = false
                var sawMoov = false
                var sawMoof = false
                while (offset + 8 <= len) {
                    raf.seek(offset)
                    val size32 = raf.readInt().toLong() and 0xFFFFFFFFL
                    val typeBytes = ByteArray(4)
                    raf.readFully(typeBytes)
                    val type = String(typeBytes, Charsets.US_ASCII)
                    val boxSize: Long = when (size32) {
                        0L -> len - offset // box extends to EOF
                        1L -> {
                            // 64-bit largesize follows the type field.
                            if (offset + 16 > len) return@use false
                            raf.readLong()
                        }
                        else -> size32
                    }
                    if (boxSize < 8L || offset + boxSize > len) {
                        // Truncated / malformed final box — that's the crash
                        // point. If we've already seen ftyp+moov+moof the file
                        // is still usable (fragmented mp4 is robust to a
                        // truncated trailing fragment); otherwise it isn't.
                        break
                    }
                    when (type) {
                        "ftyp" -> sawFtyp = true
                        "moov" -> sawMoov = true
                        "moof" -> sawMoof = true
                    }
                    if (sawFtyp && sawMoov && sawMoof) return@use true
                    offset += boxSize
                }
                sawFtyp && sawMoov && sawMoof
            }
        } catch (_: Throwable) {
            false
        }
    }

    /** Field-for-field adapter — see [FinalizeWorker.adaptSidecar] (same mapping). */
    private fun adaptSidecar(s: SidecarPayload): MetadataComposer.SidecarPayload =
        MetadataComposer.SidecarPayload(
            schemaVersion = s.schemaVersion,
            sessionId = s.sessionId,
            segmentId = s.segmentId,
            recordingId = s.recordingId,
            filenameBase = s.filenameBase,
            startedAtNs = s.startedAtNs,
            wallclockStartIso = s.wallclockStartIso,
            isPractice = s.isPractice,
            taskInfoPartial = MetadataComposer.TaskInfoPartial(
                taskId = s.taskInfoPartial.taskId,
                taskName = s.taskInfoPartial.taskName,
                taskCategory = s.taskInfoPartial.taskCategory,
                taskSetting = s.taskInfoPartial.taskSetting,
            ),
            contributorInfo = MetadataComposer.ContributorInfo(
                name = s.contributorInfo.name,
                email = s.contributorInfo.email,
                age = s.contributorInfo.age,
                gender = s.contributorInfo.gender,
                consent = s.contributorInfo.consent,
            ),
            startGate = MetadataComposer.StartGate(
                type = s.startGate.type,
                passed = s.startGate.passed,
                skipped = s.startGate.skipped,
                bypassed = s.startGate.bypassed,
                durationMs = s.startGate.durationMs,
                consecutiveHitsRequired = s.startGate.consecutiveHitsRequired,
                platformCadenceMs = s.startGate.platformCadenceMs,
            ),
            captureDeviceInfoPartial = MetadataComposer.CaptureDeviceInfoPartial(
                type = s.captureDeviceInfoPartial.type,
                model = s.captureDeviceInfoPartial.model,
                os = s.captureDeviceInfoPartial.os,
                osVersion = s.captureDeviceInfoPartial.osVersion,
                appVersion = s.captureDeviceInfoPartial.appVersion,
                dfovDegrees = s.captureDeviceInfoPartial.dfovDegrees,
                ipAddress = s.captureDeviceInfoPartial.ipAddress,
                location = s.captureDeviceInfoPartial.location,
            ),
        )

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
