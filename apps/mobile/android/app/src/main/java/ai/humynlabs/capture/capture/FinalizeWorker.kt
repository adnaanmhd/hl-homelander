package ai.humynlabs.capture.capture

import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
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
            // ------------------------------------------------------------
            // Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-02 — capture-
            // quality gate, run BEFORE the SHA-256 streaming so a low-fps /
            // low-res segment short-circuits early (no point hashing a
            // segment that's about to be deleted).
            //
            // Gate ordering — deterministic per scope spec:
            //   Step 1.5: videoFrameTimestamps.size < 2 → InsufficientFrames
            //   Step 1.6: meanFps < 29.0                → FpsDropped
            //   Step 1.7: width < 1920 OR height < 1080 → ResolutionDropped
            //
            // FPS check runs BEFORE resolution check so simultaneous fps+res
            // failure consistently reports "fps_dropped" (the upstream root
            // cause on an OEM-throttled / thermally-degraded path).
            // ------------------------------------------------------------
            val videoTimestampsForGate = seg.videoFrameTimestamps.toLongArray()

            // Insufficient-frames check needs the timestamps; resolution
            // check needs the muxed MP4 read. Read both up-front, then
            // delegate to the pure [decideCancelReason] (which encodes the
            // gate-ordering rule: fps wins on simultaneous failure).
            val (videoWidth, videoHeight) = if (videoTimestampsForGate.size < 2) {
                // Skip the MediaExtractor read entirely when we already
                // know we're cancelling — saves wasted work + keeps the
                // FinalizeWorkerGatesTest "no MediaExtractor call on N<2"
                // expectation tight.
                0 to 0
            } else {
                readMuxedResolution(seg.mp4File)
            }

            val cancelReason = decideCancelReason(videoTimestampsForGate, videoWidth, videoHeight)
            if (cancelReason != null) {
                emitCanceled(seg, cancelReason, emit)
                return
            }

            // Gate passed. measuredMeanFps is the same arithmetic
            // [decideCancelReason] used (extracted to a pure helper so
            // the test fixture can assert numeric agreement).
            val measuredMeanFps = computeMeanFps(videoTimestampsForGate)

            // Gate passed — proceed with the normal finalize sequence.

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
            val videoTimestamps = videoTimestampsForGate

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

            // 5.5 Quick task 260517-p5g CAPTURE-QA-03 — build the truth-source
            // VideoReport from the encoder's OUTPUT_FORMAT snapshot + the muxed
            // track header (already partially read for the resolution gate above).
            val videoReport = MetadataComposer.buildVideoReport(seg.hevc, seg.mp4File)

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
                // Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-03 — measured
                // values replacing the previous hardcoded spec literals in
                // MetadataComposer.compose().
                measuredMeanFps = measuredMeanFps,
                videoReport = videoReport,
                recordedRotation = seg.sidecar.recordedRotation,
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
     * Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-02 — pure gate
     * decision: given a video-frame-timestamps snapshot + a muxed-
     * resolution reading, return the [CancelReason] to emit, or `null`
     * when the segment passes both gates. Extracted as a pure function so
     * FinalizeWorkerGatesTest can exercise the gating logic without
     * constructing a full [Segment] (which requires Camera2 / MediaCodec /
     * MediaMuxer instances Robolectric can't shadow).
     *
     * Gate ordering — fps wins on simultaneous fps+resolution failure
     * (scope spec: the upstream root cause on an OEM-throttled / thermally-
     * degraded path is fps, so report that first).
     *
     * @return [CancelReason] when the segment must be canceled; `null`
     *   when both gates pass.
     */
    internal fun decideCancelReason(
        videoTimestampsNs: LongArray,
        muxedWidth: Int,
        muxedHeight: Int,
    ): CancelReason? {
        // Step 1.5: insufficient frames.
        if (videoTimestampsNs.size < 2) return CancelReason.InsufficientFrames
        // Step 1.6: mean fps < 29.0 (fps wins over resolution). Threshold
        // tightened from 28.0 → 29.0 on 2026-05-17 after the Pixel-10a +
        // Pixel-8a cancel-walk; healthy recordings on those devices
        // stamped ~30 fps clean, so 29.0 catches genuine drops without
        // flagging measurement noise around the LOCKED 30 fps target.
        val spanSeconds = (videoTimestampsNs.last() - videoTimestampsNs.first()).toDouble() / 1_000_000_000.0
        val meanFps = if (spanSeconds > 0.0) {
            (videoTimestampsNs.size - 1).toDouble() / spanSeconds
        } else 0.0
        if (meanFps < 29.0) return CancelReason.FpsDropped(meanFps)
        // Step 1.7: muxed resolution.
        if (muxedWidth < 1920 || muxedHeight < 1080) {
            return CancelReason.ResolutionDropped(muxedWidth, muxedHeight)
        }
        return null
    }

    /**
     * Pure computation of mean FPS over a video-frame-timestamps array.
     * Returns `0.0` on the degenerate `size < 2` case (the caller's
     * insufficient-frames gate fires first; this fallback keeps the
     * function total). Used by FinalizeWorkerGatesTest to assert the
     * `meanFps` numeric stamped into the cancel payload.
     */
    internal fun computeMeanFps(videoTimestampsNs: LongArray): Double {
        if (videoTimestampsNs.size < 2) return 0.0
        val span = (videoTimestampsNs.last() - videoTimestampsNs.first()).toDouble() / 1_000_000_000.0
        return if (span > 0.0) (videoTimestampsNs.size - 1).toDouble() / span else 0.0
    }

    /**
     * Quick task 260517-p5g CAPTURE-QA-02 — minimal MediaExtractor surface
     * the cancel-gate logic uses. Extracted as an interface so tests can
     * inject a fake without spinning up Robolectric's incomplete
     * MediaExtractor shadow. Production calls [defaultMediaExtractorFactory]
     * which constructs a real [MediaExtractor].
     */
    internal interface MediaExtractorLike {
        fun getTrackCount(): Int
        fun getTrackFormat(index: Int): MediaFormat
        fun release()
    }

    /** Production factory — wraps the real [MediaExtractor]. */
    private val defaultMediaExtractorFactory: (File) -> MediaExtractorLike = { mp4 ->
        val real = MediaExtractor()
        real.setDataSource(mp4.absolutePath)
        object : MediaExtractorLike {
            override fun getTrackCount(): Int = real.trackCount
            override fun getTrackFormat(index: Int): MediaFormat = real.getTrackFormat(index)
            override fun release() = real.release()
        }
    }

    /**
     * Test seam — `FinalizeWorkerGatesTest` swaps this with a fake factory
     * so it can drive the resolution gate without a real MP4. Production
     * code never touches it; the default is [defaultMediaExtractorFactory].
     */
    @JvmField
    internal var mediaExtractorFactory: (File) -> MediaExtractorLike = defaultMediaExtractorFactory

    /**
     * Read the first video track's width / height from the muxed MP4 via
     * [MediaExtractor] (Quick task 260517-p5g CAPTURE-QA-02). Returns
     * `(0, 0)` on any failure — the caller's resolution gate then cancels
     * with `resolution_dropped` (fail-closed; never up-stamps an
     * un-readable segment with a passing 1920×1080).
     */
    internal fun readMuxedResolution(mp4: File): Pair<Int, Int> {
        var w = 0
        var h = 0
        val ex: MediaExtractorLike = try {
            mediaExtractorFactory(mp4)
        } catch (t: Throwable) {
            Log.w("FinalizeWorker", "readMuxedResolution: MediaExtractor open failed", t)
            return 0 to 0
        }
        try {
            for (i in 0 until ex.getTrackCount()) {
                val fmt = ex.getTrackFormat(i)
                val mime = if (fmt.containsKey(MediaFormat.KEY_MIME)) fmt.getString(MediaFormat.KEY_MIME) else null
                if (mime != null && mime.startsWith("video/")) {
                    if (fmt.containsKey(MediaFormat.KEY_WIDTH)) w = fmt.getInteger(MediaFormat.KEY_WIDTH)
                    if (fmt.containsKey(MediaFormat.KEY_HEIGHT)) h = fmt.getInteger(MediaFormat.KEY_HEIGHT)
                    break
                }
            }
        } catch (t: Throwable) {
            Log.w("FinalizeWorker", "readMuxedResolution: track scan failed", t)
        } finally {
            try { ex.release() } catch (_: Throwable) {}
        }
        return w to h
    }

    /**
     * Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-04 — emit
     * `onSegmentCanceled` with the documented payload and tear down the
     * sidecar (so the app-launch sweep doesn't treat the canceled segment
     * as a re-finalize candidate). The MP4 / CSV / metadata-JSON cleanup
     * is owned by the JS side (`RecordingScreen.tsx` handler) per the
     * "write-then-delete" rule — the History ledger entry is persisted
     * before the bundle files are deleted.
     */
    internal fun emitCanceled(
        seg: Segment,
        reason: CancelReason,
        emit: (String, WritableMap) -> Unit,
    ) {
        try {
            // Delete the sidecar — orphan-sidecar contract: presence means
            // "finalize incomplete"; absence means "finalize complete (in
            // some form — uploaded or canceled)". The MP4 / CSV / JSON
            // bundle is NOT deleted here — the JS-side handler deletes it
            // AFTER the History ledger entry is persisted (write-then-delete).
            SidecarManager.delete(seg.sidecarFile)
        } catch (_: Throwable) { /* best-effort */ }

        val durationMs = (seg.endedAtNs - seg.startedAtNs).toDouble() / 1_000_000.0
        val payload = Arguments.createMap().apply {
            putString("segmentId", seg.segmentId)
            putString("recordingId", seg.recordingId)
            putString("taskId", seg.sidecar.taskInfoPartial.taskId)
            putString("filenameBase", seg.filenameBase)
            putString("mp4Path", seg.mp4File.absolutePath)
            putString("csvPath", seg.csvFile.absolutePath)
            putString("jsonPath", seg.jsonFile.absolutePath)
            putString("recordedAt", seg.sidecar.wallclockStartIso)
            putDouble("durationMs", durationMs)
            putString("reason", reason.code)
            when (reason) {
                is CancelReason.FpsDropped -> {
                    putDouble("meanFps", reason.meanFps)
                    putNull("width")
                    putNull("height")
                }
                is CancelReason.ResolutionDropped -> {
                    putNull("meanFps")
                    putInt("width", reason.width)
                    putInt("height", reason.height)
                }
                CancelReason.InsufficientFrames -> {
                    putNull("meanFps")
                    putNull("width")
                    putNull("height")
                }
            }
        }
        emit("onSegmentCanceled", payload)
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
            // Quick task 260517-p5g CAPTURE-QA-03 — propagate the recorded rotation
            // captured at session start. MetadataComposer.compose reads this to
            // stamp metadata.orientation truthfully.
            recordedRotation = s.recordedRotation,
            // Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — propagate
            // the live-Camera2 calibration captured at segment open.
            // MetadataComposer.compose emits it as the top-level `calibration`
            // block (or the uncalibrated fallback when null). CameraCalibration
            // is shared between the SidecarManager + MetadataComposer payloads,
            // so this is a direct pass-through (no per-field bridge).
            calibration = s.calibration,
        )
}

// ============================================================
// Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-02 — cancel-reason
// taxonomy. Discriminated union of the three terminal cancel codes the
// FinalizeWorker can emit via `onSegmentCanceled`.
// ============================================================

/** Cancel reason for `FinalizeWorker.finalize` → `onSegmentCanceled`. */
sealed class CancelReason {
    /** Stable bridge code stamped onto the WritableMap payload. */
    abstract val code: String

    /**
     * Mean FPS over the segment's frame timestamps fell below 29.0.
     * `meanFps` is the measured value used to make the gating decision.
     */
    data class FpsDropped(val meanFps: Double) : CancelReason() {
        override val code: String = "fps_dropped"
    }

    /**
     * MediaExtractor track-header read of the muxed MP4 reported a
     * resolution below 1920×1080 (the LOCKED capture spec). `width` /
     * `height` are the muxed-track values.
     */
    data class ResolutionDropped(val width: Int, val height: Int) : CancelReason() {
        override val code: String = "resolution_dropped"
    }

    /**
     * The segment's `videoFrameTimestamps` array carried fewer than 2
     * entries — degenerate; mean FPS is undefined. Emitted as the first
     * gate (before fps / resolution) so a 0-frame segment never proceeds
     * to MediaExtractor.
     */
    object InsufficientFrames : CancelReason() {
        override val code: String = "insufficient_frames"
    }
}
