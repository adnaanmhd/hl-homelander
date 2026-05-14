package ai.humynlabs.capture.capture

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/**
 * Phase 3 — concurrent finalize per Pattern 2 + checker issue #10 fix.
 *
 * Runs on `finalizeExecutor` (separate thread from `captureExecutor`).
 * Sequence:
 *   1. SHA-256 the MP4 + CSV via HashStreamer (FileChannel.read; never
 *      writes — CAP-18 file-fidelity invariant).
 *   2. DriftCalculator.compute against the video + IMU timestamps (CAP-08).
 *      Skipped (drift=null) when either array has < 2 samples.
 *   3. ImuRateObserver.compute against the IMU timestamps (D-IMU-02 →
 *      `imu_min_rate_hz_observed_p1`). Skipped when < 2 samples.
 *   4. MetadataComposer.compose(adapted-sidecar, metrics) → JSONObject.
 *   5. MetadataComposer.writeAtomic — `{file}.partial` → renameTo.
 *   6. SidecarManager.delete(seg.sidecarFile) — orphan-sidecar = "finalize
 *      never completed"; deleting it signals completion to the app-launch
 *      sweep (Plan 03-09).
 *   7. emit("onSegmentComplete", payload) — D-API-03 shape.
 *
 * On any throwable mid-sequence, emits `onError` with code
 * `finalize_failed` (recoverable=false) instead of `onSegmentComplete`.
 *
 * Clock invariant (Pattern 1 + checker issue #10):
 *   durationMs is computed as (seg.endedAtNs - seg.startedAtNs) / 1_000_000.
 *   Both stamps come from SystemClock.elapsedRealtimeNanos() — set in
 *   CaptureSession.openSegment / closeSegmentResources respectively.
 *   The JDK monotonic clock (System dot nanoTime) is BANNED here — the
 *   two clocks live in different monotonic domains and would corrupt
 *   durationMs silently. The acceptance grep gate forbids any
 *   `System.nano` literal in this file.
 *
 * Pump invariant (CAP-08 + checker issue #2):
 *   Consumes seg.videoFrameTimestamps populated by CaptureSession.runPumpLoop.
 *   DriftCalculator.compute is no-op-skipped when the array has < 2
 *   timestamps (degenerate case — should not happen in healthy E2E).
 *
 * Sidecar → MetadataComposer.SidecarPayload adaptation:
 *   The package-level `SidecarPayload` (the type SidecarManager writes)
 *   and `MetadataComposer.SidecarPayload` (the nested type
 *   MetadataComposer.compose consumes) are structurally identical but
 *   live at different fully-qualified names — Plan 03-06 deliberately
 *   nested its own copies so the metadata schema test could ship in
 *   isolation from Plan 03-05's sidecar work. FinalizeWorker performs
 *   the one-to-one field-mapping at the boundary.
 */
object FinalizeWorker {

    /**
     * Finalize one segment. Visibility is `internal` because [Segment] is
     * `internal` — keeping the worker package-private avoids exposing
     * the segment data class as part of any public Kotlin API surface.
     */
    internal fun finalize(seg: Segment, emit: (String, WritableMap) -> Unit) {
        try {
            // 1. SHA-256 the bytes (CAP-15 + CAP-18). HashStreamer opens the
            //    file via FileChannel.read — never writes. The training pipeline
            //    expects byte-for-byte preserved encoder output.
            val mp4Sha = HashStreamer.sha256(seg.mp4File)
            val csvSha = HashStreamer.sha256(seg.csvFile)

            // 2. IMU timestamps snapshot. ImuWriter exposes `timestamps()` —
            //    a live snapshot of the physical event.timestamp values
            //    (Pitfall 3: NOT onSensorChanged dispatch time). The writer
            //    has already been stopped by CaptureSession.closeSegmentResources.
            val imuTimestamps = seg.imuWriter.timestamps()
            val videoTimestamps = seg.videoFrameTimestamps.toLongArray()

            // 3. Drift {max, mean, p99} (CAP-08). Null when degenerate.
            val drift: MetadataComposer.Drift? =
                if (videoTimestamps.size >= 2 && imuTimestamps.size >= 2) {
                    val d = DriftCalculator.compute(videoTimestamps, imuTimestamps)
                    MetadataComposer.Drift(maxMs = d.maxMs, meanMs = d.meanMs, p99Ms = d.p99Ms)
                } else {
                    null
                }

            // 4. IMU p1 sample rate floor (D-IMU-02). Null when degenerate.
            val imuFloorHz: Double? =
                if (imuTimestamps.size >= 2) ImuRateObserver.compute(imuTimestamps) else null

            // 5. Issue #10 fix — durationMs from end - start, both
            //    elapsedRealtimeNanos. No clock re-read; no System.nano literal.
            val durationSeconds = (seg.endedAtNs - seg.startedAtNs).toDouble() / 1_000_000_000.0

            // 6. Adapt SidecarManager.SidecarPayload → MetadataComposer.SidecarPayload.
            //    The two types are structurally identical; the nested
            //    MetadataComposer types were deliberately introduced in
            //    Plan 03-06 to ship the schema fixture in isolation from
            //    Plan 03-05's sidecar work.
            val mcSidecar = adaptSidecar(seg.sidecar)

            val endIso = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            val metrics = MetadataComposer.FinalizeMetrics(
                mp4Sha = mp4Sha,
                csvSha = csvSha,
                mp4SizeBytes = seg.mp4File.length(),
                csvSizeBytes = seg.csvFile.length(),
                drift = drift,
                imuFloorHz = imuFloorHz,
                gyroRateHz = 416,
                accelRateHz = 416,
                mp4Filename = "${seg.filenameBase}.mp4",
                csvFilename = "${seg.filenameBase}.csv",
                durationSeconds = durationSeconds,
                startTimestampIso = seg.sidecar.wallclockStartIso,
                endTimestampIso = endIso,
                imuStartTimestampIso = seg.sidecar.wallclockStartIso,
                imuEndTimestampIso = endIso,
                // Environment + timeOfDay are not yet collected on-device (Phase 4
                // RecordingScreen will gather these from the task picker + clock).
                // Use safe defaults for now — the schema field is required but the
                // value is not load-bearing for the training pipeline at MVP.
                environment = "residential",
                timeOfDay = if (java.time.LocalTime.now().hour in 6..18) "day" else "night",
            )

            // 7. Atomic write — `{file}.partial` → renameTo (T-3.5-02 mitigation).
            val json = MetadataComposer.compose(mcSidecar, metrics)
            MetadataComposer.writeAtomic(seg.jsonFile, json)

            // 8. Orphan-sidecar contract: deleting the sidecar signals
            //    "finalize complete" to the next app-launch sweep.
            SidecarManager.delete(seg.sidecarFile)

            // 8.5 — Phase 6 D-05 (Plan 06-04): best-effort first-frame thumbnail extraction.
            //       Skipped for practice segments (those never reach History/upload
            //       per ONB-04 — practice is gated upstream by `seg.sidecar.isPractice`).
            //       Crash-recovered fragments are discarded by Phase 5 D-03 BEFORE
            //       they reach finalize, so they never hit this code path (D-05b).
            //       On any throwable inside the helper, log + continue — the thumbnail
            //       is best-effort (D-04 fallback: the History row renders a token-
            //       color gradient + first-letter task-name overlay).
            //       Note the runtime number is 8.5 (post-sidecar-delete, pre-emit)
            //       even though the design doc calls it "step 7.5" — the existing
            //       FinalizeWorker renumbers the canonical sequence by inserting
            //       writeAtomic between compose and SidecarManager.delete, so the
            //       sidecar-delete is step 8 in the on-disk implementation. The
            //       contract is identical: the extractor runs AFTER the orphan-
            //       sidecar "finalize complete" signal and BEFORE onSegmentComplete.
            //
            //       Path: filesDir/thumbs/<base>.thumb.jpg — a SIBLING of
            //       filesDir/recordings/<base>.mp4 (parentFile.parentFile is filesDir)
            //       so the JPEG survives the post-`verified` MP4 delete (D-04).
            val thumbsDir = File(seg.mp4File.parentFile?.parentFile, "thumbs")
            val thumbnailFile: File? = if (!seg.sidecar.isPractice) {
                ThumbnailExtractor.extractFirstFrame(seg.mp4File, thumbsDir)
            } else null

            // 9. Emit onSegmentComplete (D-API-03). The `thumbnailPath` key is
            //    Phase 6 (Plan 06-04) — nullable: null for practice segments,
            //    null on extractor failure, the JPEG's absolute path otherwise.
            //    The JS-side `RecordingScreen` segment-complete handler reads
            //    this and writes the per-recording entry in `thumbnailLedger`.
            val payload = Arguments.createMap().apply {
                putString("segmentId", seg.segmentId)
                putString("recordingId", seg.recordingId)
                putString("mp4Path", seg.mp4File.absolutePath)
                putString("csvPath", seg.csvFile.absolutePath)
                putString("jsonPath", seg.jsonFile.absolutePath)
                putDouble("durationMs", durationSeconds * 1000.0)
                putMap(
                    "drift",
                    Arguments.createMap().apply {
                        putDouble("max", drift?.maxMs ?: 0.0)
                        putDouble("mean", drift?.meanMs ?: 0.0)
                        putDouble("p99", drift?.p99Ms ?: 0.0)
                    },
                )
                putDouble("imuMinRateHzObservedP1", imuFloorHz ?: 0.0)
                putString("thumbnailPath", thumbnailFile?.absolutePath)
            }
            emit("onSegmentComplete", payload)
        } catch (t: Throwable) {
            val errPayload = Arguments.createMap().apply {
                putString("code", "finalize_failed")
                putString("message", t.message ?: "")
                putBoolean("recoverable", false)
                putString("segmentId", seg.segmentId)
            }
            emit("onError", errPayload)
        }
    }

    /**
     * Adapt the package-level [SidecarPayload] (SidecarManager's type) into
     * the nested [MetadataComposer.SidecarPayload] (the composer's type).
     * Field-for-field identical; the adapter exists because Plan 03-06
     * deliberately nested its own copies so the metadata schema fixture
     * could ship in isolation from Plan 03-05's sidecar work. Future
     * refactor opportunity (post-MVP): unify on a single shared payload
     * type and delete this adapter.
     */
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
}
