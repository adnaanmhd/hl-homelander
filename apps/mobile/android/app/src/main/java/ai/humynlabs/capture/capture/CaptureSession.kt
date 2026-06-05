package ai.humynlabs.capture.capture

import android.content.Context
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.params.OutputConfiguration
import android.media.MediaCodec
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import android.util.Size
import android.view.Surface
import androidx.annotation.VisibleForTesting
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import ai.humynlabs.capture.capture.common.BackUltrawidePicker
import ai.humynlabs.capture.capture.common.UltrawidePick
import ai.humynlabs.capture.livepreview.LivePreviewSurfaceRegistry
import java.io.File
import java.nio.ByteBuffer
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

/**
 * Phase 3 — CaptureSession orchestrator (Plan 03-10).
 *
 * File role:
 *   - Owns: sessionId, current Segment, sessionThread/Handler, ThermalGate listener
 *   - Composes: Plans 03-04..08 wrappers (HevcEncoder, AacEncoder, ImuWriter,
 *     FragmentedMuxerWrapper, SegmentTimer, ThermalGate)
 *   - Calls: SidecarManager.write/delete, FilenameGenerator.nextBase,
 *     UlidGenerator.next, BackUltrawidePicker.pick, RealtimeGate.verify,
 *     MetadataComposer.compose (via FinalizeWorker)
 *
 * Clock invariant (Pattern 1 + checker issue #10):
 *   ALL timestamps use SystemClock.elapsedRealtimeNanos().
 *   The JDK monotonic clock (System dot nanoTime) is BANNED here and in
 *   FinalizeWorker — different monotonic clock domains; subtracting one
 *   from the other corrupts durationMs silently. The acceptance grep
 *   gate forbids any `System.nano` literal in this file.
 *
 * Pump-loop invariant (CAP-08 + checker issue #2):
 *   The encoder→muxer pump loop MUST append (bufferInfo.presentationTimeUs * 1_000L)
 *   to seg.videoFrameTimestamps BEFORE calling muxer.writeSampleData(...).
 *   Without this, FinalizeWorker.finalize calls DriftCalculator.compute
 *   on an empty list and CAP-08 silently degrades.
 *
 * Each segment gets its own recordingId (CAP-09 — no parent_recording_id linkage).
 *
 * Module-ready (CONTEXT.md D-WAVE-01): the full Camera2 / MediaCodec /
 * AudioRecord wiring is exercised by Phase 2's EncoderProbe + ImuProbe
 * (which Phase 2 manual-smoke already signed off) and by Phase 4's
 * RecordingScreen + on-device smoke walk. The Phase 3 contract this
 * file satisfies is: orchestrate the already-tested primitives in the
 * right order, with the right clock domain, and with the right CAP-08
 * timestamp collection in the encoder→muxer pump loop. Real-device
 * verification (10-min E2E HEVC walk, thermal cut-out timing, 25-min
 * battery soak) is Phase 4's plan-phase.
 */
class CaptureSession private constructor(
    private val ctx: Context,
    private val opts: CaptureSessionOpts,
    private val segmentDurationMs: Long,
    private val finalizeExecutor: ExecutorService,
    private val emit: (String, WritableMap) -> Unit,
) {
    val sessionId: String = UlidGenerator.next()
    private var segmentsCompleted: Int = 0

    @Volatile private var currentSegment: Segment? = null
    @Volatile private var stopping: Boolean = false

    private val sessionThread = HandlerThread("HumynCapture-Session").apply { start() }
    private val sessionHandler = Handler(sessionThread.looper)
    /**
     * Dedicated thread for Camera2 framework callbacks (`CameraDevice.StateCallback`,
     * `CameraCaptureSession.StateCallback`). MUST be distinct from [sessionHandler]:
     * `openCameraSync` / `openCaptureSession` block on a `CountDownLatch` that the
     * callback counts down — and `rotateSegment()` (the auto-segment cut) calls
     * those from the [sessionHandler] thread itself. If the callbacks dispatched
     * onto [sessionHandler], that thread would be blocked in `latch.await()` while
     * the camera framework's `onOpened`/`onConfigured` post sat behind it on the
     * same looper → 2 s `camera_open_timeout` on every auto-cut (Phase-4 on-hardware
     * smoke — the auto-segment rotate never completed). First-segment open didn't
     * hit this because `start()` runs on the capture executor, not [sessionHandler].
     */
    private val cameraCbThread = HandlerThread("HumynCapture-CameraCb").apply { start() }
    private val cameraCbHandler = Handler(cameraCbThread.looper)
    private val thermalGate = ThermalGate(ctx)
    private var thermalSubscription: AutoCloseable? = null
    /**
     * Bug-4 fix (Phase-4 on-hardware smoke) — `cmd thermalservice
     * override-status N` reliably moves `PowerManager.getCurrentThermalStatus()`
     * (so the pre-flight refuse works) but on this Android-16 build does NOT
     * deliver `OnThermalStatusChangedListener` callbacks for the override, so
     * the mid-record graceful-stop never fired. Belt-and-suspenders: a 5 s
     * synchronous poll of the thermal status on the session HandlerThread, in
     * addition to the listener. `thermalAbortFired` de-duplicates so the
     * listener and the poll can't both kick off the graceful stop. Mirrors the
     * JS-side periodic storage/battery guard in `useRecordingLifecycle`.
     */
    @Volatile private var thermalAbortFired: Boolean = false
    private var thermalPollRunnable: Runnable? = null
    private val segmentTimer = SegmentTimer()

    /** The pump-loop HandlerThread lifecycle is per-segment (see openSegment / closeSegmentResources). */
    private val pumpThreads = mutableListOf<HandlerThread>()

    companion object {
        // Phase 7 plan 07-10 — Option-B Surface lifecycle instrumentation
        // (G-11 debug). Filter on this in `adb logcat -s CaptureSession:I`
        // to trace the registry-read at config + the in-session
        // setRepeatingRequest rebuild callbacks. New tag (no prior collisions:
        // verified by `grep -rE 'Log\\.[idew]\\("CaptureSession"'` returning
        // empty on the existing tree). Removed in a follow-on
        // `DEBUG_REVERT_BEFORE_COMMIT`-style sweep iff the operator's logcat
        // confirms G-11 closure on Option B and we no longer need the
        // surface-lifecycle trail in production.
        private const val TAG = "CaptureSession"

        /** Camera2 open timeout — matches EncoderProbe convention. */
        private const val CAMERA_OPEN_TIMEOUT_S = 2L

        /** Graceful-stop budget after a mid-record SEVERE thermal escalation. */
        private const val THERMAL_GRACEFUL_STOP_MS = 2_500L

        /** Silent gap between segments at auto-cut (D-SEG-03). */
        private const val SEGMENT_ROTATE_GAP_MS = 500L

        /**
         * REC-07 — recordings shorter than 60 s are discarded (not uploaded,
         * not in History, not counted). HumynCapture owns the on-disk deletion
         * at finalize: when stop() closes the SOLE segment of a session and its
         * wall-clock duration is below this floor, [discardSegmentArtifacts]
         * deletes the segment's mp4 / csv / json / .session.json instead of
         * running FinalizeWorker. A session that already auto-segmented at least
         * once is by definition ≥10 min, so a trailing short segment there is
         * still real captured data and is kept (segments are independent
         * upload units — CAP-09).
         */
        private const val MIN_KEPT_DURATION_MS = 60_000L

        /**
         * Bug D6-1 (2026-06-05) — pure predicate: does a discarded sole segment
         * need a `too_short` [CancelReason] emitted (→ a non-retryable "Canceled
         * — recording too short" History row) before its artifacts are deleted?
         *
         * `true` only for a NON-practice segment that is being discarded as the
         * sole segment of a session under [MIN_KEPT_DURATION_MS]. Practice
         * segments are EXEMPT — they never produce History rows / never upload
         * (ONB-04). This reconciles the two duration floors so a sub-60s
         * recording behaves like the [60s, 180s) band (which FinalizeWorker's
         * [CancelReason.TooShort] gate already turns into a History row),
         * honouring the documented D6 contract.
         *
         * Extracted as a pure function (mirroring
         * [FinalizeWorker.decideCancelReason]) so it can be unit-tested without
         * constructing a full [Segment] (Camera2 / MediaCodec / muxer — not
         * Robolectric-shadowable). [stop] is the sole caller.
         *
         * @param segmentsCompleted how many segments already finalized this
         *   session — the discard only applies to the SOLE segment (== 0); a
         *   session that auto-segmented at least once is ≥10 min of real data.
         * @param durationMs the segment's wall-clock length (elapsedRealtimeNanos
         *   delta, ms).
         */
        @VisibleForTesting
        internal fun shouldEmitTooShortOnDiscard(
            segmentsCompleted: Int,
            durationMs: Long,
            isPractice: Boolean,
        ): Boolean =
            segmentsCompleted == 0 && durationMs < MIN_KEPT_DURATION_MS && !isPractice

        /** Mid-record thermal poll cadence — see [thermalPollRunnable]. */
        private const val THERMAL_POLL_INTERVAL_MS = 5_000L

        /**
         * Start a new CaptureSession. Runs the full pre-flight + first-segment
         * open synchronously on the caller's thread (typically the
         * HumynCaptureModule.captureExecutor single-thread). Throws on
         * pre-flight failure — the caller's catch maps the throwable to a
         * Promise reject via HumynCaptureModule.errorCodeFor.
         */
        fun start(
            ctx: Context,
            opts: CaptureSessionOpts,
            segmentDurationMs: Long,
            finalizeExecutor: ExecutorService,
            emit: (String, WritableMap) -> Unit,
        ): CaptureSession {
            val s = CaptureSession(ctx, opts, segmentDurationMs, finalizeExecutor, emit)
            try {
                s.preFlightAndStartFirstSegment()
            } catch (t: Throwable) {
                // Pre-flight failed mid-allocation; tear down everything we
                // brought up so the caller's reject path doesn't leak threads.
                s.cleanupAfterPreFlightFailure(t)
                throw t
            }
            return s
        }
    }

    // === Pre-flight + first segment ===

    private fun preFlightAndStartFirstSegment() {
        // 1. Thermal gate pre-flight (CAP-11) — throws ThermalRefuseException
        //    when status >= MODERATE.
        thermalGate.preFlight().getOrThrow()

        // 2. Locate the back ultrawide. Throws if none — Phase 2's compat probe
        //    already verifies presence at install time; this is runtime
        //    defense-in-depth.
        val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val pick = BackUltrawidePicker.pick(mgr)
            ?: throw IllegalStateException("no_back_ultrawide")

        // 3. RealtimeGate (CAP-07) — verify SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME
        //    on the OPENABLE (logical) camera's characteristics. Phase 2's compat
        //    probe gates installable devices on this; this catches the
        //    pathological case where the gate's runtime check disagrees with the
        //    install-time check (driver update mid-session, etc.).
        RealtimeGate.verify(pick.openableChars)

        // WR-02 fix — defer thermal subscription until AFTER the first
        // segment is open. The previous step ordering (subscribe → open
        // segment) admitted a race where SEVERE thermal escalation during
        // openSegment would fire the callback while currentSegment was
        // still null: the emitted onThermalAbort payload had segmentId=""
        // (uncorrelable on the JS side) AND the 2.5s graceful-stop was
        // posted to sessionHandler while preFlightAndStartFirstSegment was
        // still allocating, so stop() ran concurrent with the in-flight
        // openSegment, leaving Camera2 / encoders / muxer in undefined state.

        // 4. First segment — segment 1 owns a fresh recordingId (CAP-09).
        currentSegment = openSegment(recordingId = UlidGenerator.next(), pick = pick)

        // 5. NOW it is safe to subscribe to mid-record thermal escalation
        //    (CAP-12). The listener fires on the system binder dispatch
        //    thread when status >= SEVERE; we DO NOT block in the callback —
        //    we hand off to onThermalEscalation which emits the JS event and
        //    posts the graceful stop to the session's HandlerThread. By this
        //    point currentSegment is guaranteed non-null so the emitted
        //    segmentId is correlable.
        thermalSubscription = thermalGate.subscribeMidRecord { status -> onThermalEscalation(status) }
        // Bug-4 fix — also poll the thermal status synchronously every 5 s,
        // because `cmd thermalservice override-status N` does not deliver
        // listener callbacks on this Android-16 build (the pre-flight refuse
        // path that reads getCurrentThermalStatus() directly does work). The
        // poll runs on the session HandlerThread (its looper is alive for the
        // whole session); de-duplicated against the listener via thermalAbortFired.
        startThermalPoll()

        // 6. Schedule the next auto-cut. The cut callback runs on
        //    SegmentTimer's HandlerThread; we post the rotateSegment work
        //    onto the session's HandlerThread so it doesn't run concurrent
        //    with the encoder pump's HandlerThread (which lives until
        //    closeSegmentResources).
        segmentTimer.scheduleNext(segmentDurationMs) {
            sessionHandler.post { rotateSegment() }
        }

        // 7. Emit onSegmentStart for segment 1.
        emitSegmentStart(currentSegment!!)
    }

    /**
     * Tears down anything the pre-flight path might have allocated before
     * propagating the original exception. Idempotent — safe to call when
     * nothing got allocated yet (the early-thermal-gate fail path).
     */
    private fun cleanupAfterPreFlightFailure(@Suppress("UNUSED_PARAMETER") cause: Throwable) {
        try {
            thermalSubscription?.close()
        } catch (_: Throwable) { /* best-effort */ }
        thermalSubscription = null
        stopThermalPoll()
        // CR-05 fix — null `currentSegment` BEFORE invoking closeSegmentResources.
        // The previous ordering left currentSegment set during close; the pump's
        // `currentSegment === seg` defense-in-depth check would stay true while
        // the encoder/muxer/Surface were being released. closeSegmentResources
        // (post CR-04 fix) now sets pumpShouldStop and awaits the pumpExitLatch,
        // then `quitSafely`s the pump thread — so each segment's pump is fully
        // joined before its encoder/muxer/Surface get released.
        val partial = currentSegment
        currentSegment = null
        try {
            partial?.let { closeSegmentResources(it) }
        } catch (_: Throwable) { /* best-effort */ }
        try { segmentTimer.release() } catch (_: Throwable) { /* best-effort */ }
        // CR-05 fix — the loop below is defensive cleanup for the narrow
        // window where openSegment threw AFTER `pumpThreads.add(pumpThread)`
        // but BEFORE the pump Runnable was posted (so the thread exists but
        // never ran a pump body). closeSegmentResources's quitSafely covers
        // every segment that was actually constructed; this loop catches the
        // partially-allocated case. Best-effort by definition.
        for (t in pumpThreads) try { t.quitSafely() } catch (_: Throwable) { /* best-effort */ }
        pumpThreads.clear()
        try { cameraCbThread.quitSafely() } catch (_: Throwable) { /* best-effort */ }
        try { sessionThread.quitSafely() } catch (_: Throwable) { /* best-effort */ }
    }

    // === Open / pump / close per segment ===

    /**
     * Bring up one segment's resources: filenames, sidecar, Camera2, encoders,
     * muxer, IMU writer, capture session, pump-loop HandlerThread.
     *
     * Caller invariant: `currentSegment` is null OR refers to a closed
     * segment (closeSegmentResources has been called). Concurrency: this
     * runs on the session HandlerThread (pre-flight: directly on caller's
     * thread via preFlightAndStartFirstSegment; rotate: on
     * sessionHandler.post). Never on the encoder pump thread.
     */
    private fun openSegment(recordingId: String, pick: UltrawidePick): Segment {
        // 1. Filenames + paths (CAP-17).
        val baseDir = ctx.filesDir
        val recordingsDir = File(baseDir, "recordings").apply { mkdirs() }
        val practiceDir = File(baseDir, "practice").apply { mkdirs() }
        val outDir = if (opts.isPractice) practiceDir else recordingsDir
        val now = LocalDateTime.now()
        // FilenameGenerator.nextBase still returns the un-prefixed date base
        // `YYYYMMDD_HHMMSS_NNN` (its ls-scan strips a leading 26-char ULID
        // prefix before the NNN parse — CAPTURE-QA-07).
        val base = FilenameGenerator.nextBase(now, listOf(recordingsDir, practiceDir))

        // Quick task 260522-elm CAPTURE-QA-07 — prefix the on-disk filename
        // with the segment's 26-char ULID recordingId so every artifact is
        // self-identifying: `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`.
        // metadata.filename / imu_filename flow this prefixed base through
        // FinalizeWorker's `"${seg.filenameBase}.mp4"` / `.csv` stamping. The
        // S3 object keys are UNCHANGED — the upload path PUTs to the fixed
        // recordingKeys() (video.mp4 / imu.csv / metadata.json under
        // recordings/{userId}/{recordingId}/); the local filename never
        // derives the S3 object key (T-elm-03; verified against
        // apps/api/src/lib/s3-client.ts recordingKeys()).
        val filenameBase = "${recordingId}_$base"

        val mp4 = File(outDir, "$filenameBase.mp4")
        val csv = File(outDir, "$filenameBase.csv")
        val json = File(outDir, "$filenameBase.json")
        val sidecarFile = File(outDir, "$filenameBase.session.json")

        // 2. Per-segment clock stamp (Pattern 1 invariant — elapsedRealtimeNanos).
        val startNs = SystemClock.elapsedRealtimeNanos()
        val wallclockStartIso = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

        // Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — capture
        // live-Camera2 intrinsics (from the ultrawide physical sub-camera, the
        // lens HumynCapture records on) + cam-IMU extrinsics at segment open.
        // The reader is null-safe and NEVER throws (T-elm-01); most Pixels
        // report UNCALIBRATED so the null-fallback block is the typical output.
        // Stashed on the sidecar → threaded to MetadataComposer.compose's
        // top-level `calibration` block. Does NOT block or fail capture.
        val calibration = CameraCalibrationReader.read(pick.ultrawideChars, pick.openableChars)

        // 3. Sidecar payload — captures the JS-supplied opts + segment timing
        //    so the app-launch sweep (Plan 03-09) can re-finalize if the
        //    process crashes between segment-stop and metadata write.
        val sidecar = SidecarPayload(
            schemaVersion = SidecarManager.CURRENT_SCHEMA_VERSION,
            sessionId = sessionId,
            segmentId = UlidGenerator.next(),
            recordingId = recordingId,
            filenameBase = filenameBase,
            startedAtNs = startNs,
            wallclockStartIso = wallclockStartIso,
            isPractice = opts.isPractice,
            taskInfoPartial = TaskInfoPartial(
                taskId = opts.taskId,
                taskName = opts.taskName,
                taskCategory = opts.taskCategory,
                taskSetting = opts.taskSetting,
            ),
            contributorInfo = ContributorInfo(
                name = opts.contributor.name,
                email = opts.contributor.email,
                age = opts.contributor.age,
                gender = opts.contributor.gender,
                consent = opts.contributor.consent,
            ),
            startGate = StartGate(
                type = opts.startGate.type,
                passed = opts.startGate.passed,
                skipped = opts.startGate.skipped,
                bypassed = opts.startGate.bypassed,
                durationMs = opts.startGate.durationMs,
                consecutiveHitsRequired = opts.startGate.consecutiveHitsRequired,
                platformCadenceMs = opts.startGate.platformCadenceMs,
            ),
            captureDeviceInfoPartial = CaptureDeviceInfoPartial(
                type = "phone",
                model = Build.MODEL ?: "unknown",
                os = "android",
                osVersion = Build.VERSION.RELEASE ?: "unknown",
                appVersion = opts.appVersion,
                dfovDegrees = opts.dfovDegrees,
                ipAddress = null,
                location = opts.location,
            ),
            // Quick task 260517-p5g CAPTURE-QA-03 — capture the surface rotation
            // at session start so MetadataComposer can stamp metadata.orientation
            // truthfully (replaces the previous "landscape" literal). The
            // RecordingScreen locks landscape; the user's physical orientation
            // selects ROTATION_90 ("landscape_left") or ROTATION_270
            // ("landscape_right"). ROTATION_0 / ROTATION_180 fall through to
            // "landscape_left" (defensive — should never happen post-lock) with
            // a log warning so the safe default stays non-null.
            recordedRotation = readRecordedRotation(),
            // Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — calibration
            // captured above from the ultrawide physical sub-camera.
            calibration = calibration,
        )
        SidecarManager.write(sidecarFile, sidecar)

        // 4. Allocate primitives in the order Phase 2 EncoderProbe verified.
        //    Camera2 OPEN -> HEVC encoder + Surface -> muxer -> IMU writer
        //    + start. Each step is wrapped so partial allocation tears
        //    down cleanly on failure.
        //
        //    Audio is intentionally NOT allocated here. Pre-2026-05-11 the
        //    capture spec included a 48 kHz mono AAC-LC 128 kbps audio
        //    track; smoke walks on Pixel 10a (sessionId 01KRAJ7YP3...)
        //    showed audio-pump CPU contention with the video pump pushed
        //    imu_video_drift_{mean,p99}_ms from 1.78/2.07 ms (audio off)
        //    to 4.29/4.58 ms (audio on, bytes-consumed PTS) — beyond the
        //    locked ±1 ms alignment spec. Project owner decision: drop
        //    audio entirely to preserve the drift invariant. Training
        //    pipeline (VLA/VLN/robotics) consumes egocentric video + IMU.
        //    To re-introduce audio: restore `aac = AacEncoder.configure()`
        //    + `audioRecord = ...` allocations, the audioPumpThread, the
        //    MuxerStartGate, and `runAudioPumpLoop` from git history (see
        //    commit a99cdfb for the full audio path) — and prove drift
        //    stays inside ±1 ms before merging. See HUMAN-UAT GAP-3.
        var camDevice: CameraDevice? = null
        var hevc: MediaCodec? = null
        var inputSurface: Surface? = null
        var muxer: FragmentedMuxerWrapper? = null
        var imuWriter: ImuWriter? = null
        var captureSession: CameraCaptureSession? = null
        val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            camDevice = openCameraSync(pick.openableId, mgr)
            val (codec, surf) = HevcEncoder.configure()
            hevc = codec
            inputSurface = surf
            muxer = FragmentedMuxerWrapper.create(mp4)
            imuWriter = ImuWriter(ctx, csv).also { it.start() }
            captureSession = openCaptureSession(camDevice, inputSurface, mgr)
        } catch (t: Throwable) {
            // Tear down whatever we managed to allocate before propagating.
            try { captureSession?.close() } catch (_: Throwable) {}
            try { imuWriter?.close() } catch (_: Throwable) {}
            try { muxer?.close() } catch (_: Throwable) {}
            try { inputSurface?.release() } catch (_: Throwable) {}
            try { hevc?.stop(); hevc?.release() } catch (_: Throwable) {}
            try { camDevice?.close() } catch (_: Throwable) {}
            // Surface the open failure to JS — Phase 4's RecordingScreen
            // catches this on the start() Promise reject path.
            Log.e("HumynCapture", "openSegment failed → onError code=segment_open_failed", t)
            val payload = Arguments.createMap().apply {
                putString("code", "segment_open_failed")
                putString("message", t.message ?: "")
                putBoolean("recoverable", false)
                putString("segmentId", sidecar.segmentId)
            }
            emit("onError", payload)
            throw t
        }

        // 5. Spawn the encoder→muxer pump on its own HandlerThread so the
        //    session HandlerThread stays responsive for rotateSegment /
        //    thermal-stop posts.
        val pumpThread = HandlerThread("HumynCapture-Pump-${sidecar.segmentId}").apply { start() }
        pumpThreads.add(pumpThread)

        val seg = Segment(
            segmentId = sidecar.segmentId,
            recordingId = recordingId,
            filenameBase = filenameBase,
            mp4File = mp4,
            csvFile = csv,
            jsonFile = json,
            sidecarFile = sidecarFile,
            startedAtNs = startNs,
            endedAtNs = 0L,
            sidecar = sidecar,
            cam = camDevice!!,
            captureSession = captureSession!!,
            inputSurface = inputSurface!!,
            hevc = hevc!!,
            muxer = muxer!!,
            imuWriter = imuWriter!!,
            videoFrameTimestamps = PrimitiveLongBuffer(PrimitiveLongBuffer.VIDEO_CAPACITY),
            pumpThread = pumpThread,
            pumpExitLatch = CountDownLatch(1),
        )

        // 6. Publish `currentSegment` BEFORE posting the pump runnable.
        //    The pump's while-condition checks `currentSegment === seg` as
        //    defense-in-depth (CR-04 ordering contract — the field is the
        //    single source of truth for "is this segment still the active
        //    one"). If the assignment happens AFTER Handler.post, the
        //    looper can dispatch the runnable before currentSegment is
        //    set; the first while-condition evaluation then sees
        //    currentSegment == null and the loop exits immediately —
        //    the pump never calls muxer.addTrack/start, and the MP4
        //    stays empty (0 bytes). Publishing before the post closes
        //    that window. The caller (preFlightAndStartFirstSegment /
        //    rotateSegment) re-assigns the same reference on the return
        //    path — harmless tautology.
        currentSegment = seg

        // 7. Kick off the pump. Video pump owns dequeue from seg.hevc,
        //    calls muxer.addTrack + muxer.start on INFO_OUTPUT_FORMAT_CHANGED,
        //    then writes encoded HEVC samples to the muxer's video track.
        Handler(pumpThread.looper).post { runPumpLoop(seg) }

        return seg
    }

    /**
     * Quick task 260517-p5g CAPTURE-QA-03 — read the display surface
     * rotation at session start and translate it to the canonical token
     * stamped into the metadata JSON.
     *
     * Mapping (per `Surface.ROTATION_*`):
     *   `ROTATION_90`  → `"landscape_left"`
     *   `ROTATION_270` → `"landscape_right"`
     *   `ROTATION_0` / `ROTATION_180` → `"landscape_left"` (safe default;
     *      should never happen post-RecordingScreen's landscape lock, but
     *      keeps the metadata field non-null on every code path).
     *
     * API 30+ uses `Context.display`; older API levels fall back to the
     * `WindowManager` accessor (deprecated on R+ but still works).
     */
    private fun readRecordedRotation(): String {
        val rotation: Int = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                ctx.display?.rotation ?: Surface.ROTATION_90
            } else {
                @Suppress("DEPRECATION")
                val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? android.view.WindowManager
                @Suppress("DEPRECATION")
                wm?.defaultDisplay?.rotation ?: Surface.ROTATION_90
            }
        } catch (_: Throwable) {
            Surface.ROTATION_90
        }
        return when (rotation) {
            Surface.ROTATION_90 -> "landscape_left"
            Surface.ROTATION_270 -> "landscape_right"
            else -> {
                Log.w(
                    "HumynCapture",
                    "readRecordedRotation: unexpected display rotation=$rotation (expected ROTATION_90/270 post landscape-lock); defaulting to landscape_left",
                )
                "landscape_left"
            }
        }
    }

    /**
     * Open a Camera2 device synchronously. Mirrors EncoderProbe.kt's
     * openCamera latch pattern but uses the session's own HandlerThread
     * for the StateCallback dispatch.
     */
    private fun openCameraSync(cameraId: String, mgr: CameraManager): CameraDevice {
        val latch = CountDownLatch(1)
        var device: CameraDevice? = null
        var openError: Throwable? = null
        mgr.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(c: CameraDevice) {
                device = c
                latch.countDown()
            }

            override fun onDisconnected(c: CameraDevice) {
                c.close()
                openError = IllegalStateException("camera_disconnected")
                latch.countDown()
            }

            override fun onError(c: CameraDevice, error: Int) {
                c.close()
                openError = IllegalStateException("camera_open_failed:$error")
                latch.countDown()
            }
        }, cameraCbHandler)
        if (!latch.await(CAMERA_OPEN_TIMEOUT_S, TimeUnit.SECONDS)) {
            throw IllegalStateException("camera_open_timeout")
        }
        openError?.let { throw it }
        return device ?: throw IllegalStateException("camera_open_failed")
    }

    /**
     * Build the CameraCaptureSession with the encoder Surface as the only
     * output target. OIS + video stabilization OFF; HDR is implicit STANDARD
     * because we never request an HDR profile (Pitfall 3 + 4).
     *
     * The recording streams the back ULTRAWIDE: on a logical multi-camera the
     * default physical is the main wide, so the TEMPLATE_RECORD request drives
     * CONTROL_ZOOM_RATIO to the lower bound of CONTROL_ZOOM_RATIO_RANGE (< 1.0
     * → switches the active physical to the ultrawide; harmless no-op when the
     * device has no sub-1.0 zoom). Mirrors the native gate camera; required to
     * meet the LOCKED ≥110° dFOV spec (debug session handgate-never-passes — Stage 2).
     *
     * Focus is LOCKED for the whole take (debug session handgate-never-passes,
     * 2026-05-11): `CONTROL_AF_MODE_OFF` + a fixed `LENS_FOCUS_DISTANCE` so a
     * head-mounted egocentric rig never refocuses mid-segment (the Pixel 10a
     * smoke walk showed the wide lens hunting focus continuously — `GAF` /
     * `cam2_actuator` ABORTED spam ~30/s — which blurs frames and is wrong for
     * this capture profile; it also perturbs the §5b ±1 ms drift measurement
     * since AF state changes ripple through the capture-request cadence). We
     * focus at the lens hyperfocal-ish "far" setting (`LENS_FOCUS_DISTANCE`
     * is in diopters = 1/metres; `0.0f` = infinity), which keeps everything
     * from ~arm's length to infinity acceptably sharp on the ultrawide — the
     * relevant range for egocentric capture of everyday tasks. If the device
     * reports `LENS_INFO_MINIMUM_FOCUS_DISTANCE == 0` it's a fixed-focus lens
     * and the setter is a harmless no-op. This is purely additive hardening on
     * top of the existing OIS/EIS-off request — the Camera2+MediaCodec pipeline
     * itself is unchanged (LOCKED per CLAUDE.md).
     */
    private fun openCaptureSession(
        cam: CameraDevice,
        surface: Surface,
        mgr: CameraManager,
    ): CameraCaptureSession {
        val latch = CountDownLatch(1)
        var session: CameraCaptureSession? = null
        var sessionError: Throwable? = null

        // === Phase 7 plan 07-10 — Always-two-Surface CaptureSession (H1 close) ===
        //
        // The original plan 07-07 read `LivePreviewSurfaceRegistry.currentSurface()`
        // AT session-config time and conditionally added it as a second output.
        // The Pixel-10a §7 walk (2026-05-25, debug journal
        // .planning/debug/07-live-preview-broken-pipe.md) showed the registry
        // slot was always null at session-config time (`previewSurfaceAtConfig=false
        // outputs.size=1`) — `HumynLivePreviewView.onSurfaceTextureAvailable`
        // fires ~109 ms AFTER `openCaptureSession` because the RN view tree
        // mounts after `HumynCapture.start()` returns. So Option-B's "second
        // surface if available" branch never engaged. (H1: race-on-config.)
        //
        // The fix: ALWAYS open the session with TWO output slots — the encoder
        // Surface (always target #1, REC-LIVE-07 invariant) AND a deferred
        // OutputConfiguration for the preview. The deferred config uses
        // `enableSurfaceSharing()` so we can dynamically add/remove the real
        // preview Surface via `finalizeOutputConfigurations` (first attach) and
        // `updateOutputConfiguration` (subsequent swap, API 28+) WITHOUT
        // reconfiguring the entire session — which would drop frames during the
        // 100-400 ms HAL stall and trip FinalizeWorker's `mean_fps < 29` cancel
        // gate (CLAUDE.md "Capture-quality cancel gate added 2026-05-17"
        // banner).
        //
        // The `LivePreviewSurfaceRegistry.onAddTarget` / `onRemoveTarget` slots
        // are wired UNCONDITIONALLY in onConfigured. Plan 07-10 to the registry
        // makes `onSurfaceAvailable` / `onSurfaceDestroyed` invoke these
        // callbacks directly, so the lifecycle becomes:
        //   1. CaptureSession opens with [encoder, deferredPreview]. No preview
        //      Surface attached yet.
        //   2. JS-side `<HumynLivePreviewView>` mounts (~109 ms later).
        //   3. TextureView's `onSurfaceTextureAvailable` calls
        //      `LivePreviewSurfaceRegistry.onSurfaceAvailable(realPreview)`.
        //   4. Registry stores the Surface AND invokes `onAddTarget`.
        //   5. `onAddTarget` attaches realPreview to deferredPreview's
        //      OutputConfiguration via `addSurface` + `finalizeOutputConfigurations`
        //      (first time) or `updateOutputConfiguration` (subsequent swap),
        //      then rebuilds the CaptureRequest with realPreview as target #2,
        //      and re-issues `setRepeatingRequest`.
        //   6. JS-side view unmounts (fade-to-dim, 15s later). TextureView's
        //      `onSurfaceTextureDestroyed` calls `onSurfaceDestroyed(realPreview)`.
        //   7. Registry invokes `onRemoveTarget` BEFORE clearing the slot —
        //      `onRemoveTarget` rebuilds the CaptureRequest WITHOUT the preview
        //      target and re-issues `setRepeatingRequest`. (This eliminates the
        //      `Camera3-PreviewFrameSpacer ... Broken pipe(-32)` HAL warning by
        //      stopping camera writes BEFORE the consumer-side Surface goes
        //      away.) Then registry removes realPreview from deferredPreview's
        //      OutputConfiguration via `removeSurface` + `updateOutputConfiguration`.
        //   8. JS-side view re-mounts (tap-reveal). Steps 3-5 repeat with a
        //      NEW Surface from a brand-new TextureView. The session never
        //      reconfigures — only the deferred OutputConfiguration's surface
        //      set changes via `updateOutputConfiguration`.
        //
        // API requirements:
        //   - `OutputConfiguration(Size, Class<SurfaceTexture>)` deferred ctor: API 26+ (minSdk = 26, OK).
        //   - `enableSurfaceSharing()`: API 26+.
        //   - `addSurface` / `removeSurface`: API 26+ / API 26+.
        //   - `finalizeOutputConfigurations`: API 26+.
        //   - `createCaptureSessionByOutputConfigurations`: API 26+ (deprecated
        //     in API 30+ in favor of `SessionConfiguration`).
        //   - `updateOutputConfiguration`: API 28+. On API 26-27, the first
        //     mount attaches via `finalizeOutputConfigurations` and subsequent
        //     remounts are no-ops (first preview wins, silent degradation).
        //     Pixel 10a smoke target is API 36 — dynamic path always exercised.
        //
        // The encoder Surface (target #1) and ultrawide CONTROL_ZOOM_RATIO
        // routing (in applyRecordingRequestSettings) are UNCHANGED — drift
        // banner + cancel-gate banner invariants preserved (REC-LIVE-07).
        val previewSize = Size(1280, 720)
        val previewOutputConfig = OutputConfiguration(previewSize, SurfaceTexture::class.java).apply {
            // enableSurfaceSharing() is a no-arg setter that flips a flag. It
            // MUST be called BEFORE the OutputConfiguration is registered with
            // a CaptureSession (i.e. before createCaptureSessionByOutputConfigurations);
            // calling it after throws IllegalStateException per the docs.
            enableSurfaceSharing()
        }
        val encoderOutputConfig = OutputConfiguration(surface)

        // If the registry already has a Surface available at session-config
        // time (rare on Android — the RN view hierarchy mounts after the
        // native-module `start` Promise resolves — but possible on a hot
        // re-record where the previous view didn't fully unmount), attach it
        // pre-creation. Otherwise the session opens with the deferred slot
        // empty and `onAddTarget` attaches it when the surface arrives.
        val initialPreviewSurface: Surface? = LivePreviewSurfaceRegistry.currentSurface()
        var previewAttached: Boolean = false
        if (initialPreviewSurface != null) {
            previewOutputConfig.addSurface(initialPreviewSurface)
            previewAttached = true
        }
        Log.i(
            TAG,
            "openCaptureSession previewSurfaceAtConfig=${initialPreviewSurface != null} outputs.size=2",
        )

        // `createCaptureSessionByOutputConfigurations` is deprecated in API 30+
        // in favor of `createCaptureSession(SessionConfiguration)`. The new API
        // requires an Executor instead of a Handler and has the same semantics
        // for deferred surface output configs. We keep the deprecated path to
        // mirror the existing `createCaptureSession(List<Surface>, ...)` shape
        // (consistent with the pre-fix code path) and to avoid pulling an
        // Executor adapter just for this one call. `@Suppress("DEPRECATION")`
        // is the same workaround the file uses for the legacy
        // `createCaptureSession(List<Surface>)` overload in BackUltrawidePicker.
        @Suppress("DEPRECATION")
        cam.createCaptureSessionByOutputConfigurations(
            listOf(encoderOutputConfig, previewOutputConfig),
            object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(s: CameraCaptureSession) {
                    try {
                        Log.i(
                            TAG,
                            "onConfigured addingPreviewTarget=$previewAttached",
                        )

                        // If the deferred OutputConfiguration already has the
                        // initial Surface attached, finalize it now so the
                        // session "claims" the deferred slot. This is a one-shot
                        // — subsequent swaps go through `updateOutputConfiguration`.
                        if (previewAttached) {
                            try {
                                s.finalizeOutputConfigurations(listOf(previewOutputConfig))
                            } catch (t: Throwable) {
                                Log.w(TAG, "finalizeOutputConfigurations at config-time threw — treating as deferred", t)
                                previewAttached = false
                            }
                        }

                        // Build the initial CaptureRequest. Encoder is always
                        // a target. The preview is added only if we attached
                        // a Surface at config-time AND finalize succeeded.
                        val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                        builder.addTarget(surface)
                        if (previewAttached && initialPreviewSurface != null) {
                            builder.addTarget(initialPreviewSurface)
                        }
                        applyRecordingRequestSettings(builder, cam, mgr)
                        s.setRepeatingRequest(builder.build(), null, sessionHandler)
                        session = s

                        // Wire the in-session re-attach / detach callbacks
                        // (Option B, fixed). These run from the registry's
                        // `onSurfaceAvailable` / `onSurfaceDestroyed` paths —
                        // i.e. on the RN UI thread, which is the same thread
                        // the TextureView lifecycle fires on. The CaptureSession
                        // operations (addSurface / removeSurface /
                        // updateOutputConfiguration / setRepeatingRequest) are
                        // thread-safe at the Camera2 API level; the callbacks
                        // dispatched by setRepeatingRequest still come back on
                        // `cameraCbHandler`. Best-effort try/catch each step so
                        // a transient driver error never propagates to the JS
                        // bridge and the encoder Surface keeps streaming
                        // (REC-LIVE-07 invariant: encoder never starves).
                        //
                        // `attachedPreviewSurface` tracks the currently-attached
                        // preview Surface — needed because `removeSurface`
                        // requires the SAME reference that was passed to
                        // `addSurface` (Camera2 uses identity comparison).
                        var attachedPreviewSurface: Surface? =
                            if (previewAttached) initialPreviewSurface else null

                        LivePreviewSurfaceRegistry.onAddTarget = {
                            Log.i(TAG, "onAddTarget fired")
                            // Defer + delay the Camera2 ops on sessionHandler.
                            // Two-part rationale:
                            //
                            // (a) The registry callback fires from
                            // HumynLivePreviewView.onSurfaceTextureAvailable
                            // which on a tap-revealed remount runs SYNCHRONOUSLY
                            // inside `TextureView.draw() -> getTextureLayer()`.
                            // Posting to sessionHandler defers the attach to
                            // after the current draw pass so we're not in
                            // the middle of layer creation when Camera2 ops run.
                            //
                            // (b) On second-and-later attaches the code path
                            // is `previewOutputConfig.removeSurface(old) ->
                            // addSurface(new) -> s.updateOutputConfiguration`.
                            // `updateOutputConfiguration`'s IPC path calls
                            // `writeToParcel -> updateCachedSurfaceSize ->
                            // SurfaceUtils.getSurfaceSize(newSurface)` BEFORE
                            // any frames have been produced into the new
                            // SurfaceTexture's BufferQueue, so the producer's
                            // size query returns "abandoned". The first attach
                            // does NOT hit this because it calls
                            // `finalizeOutputConfigurations`, which doesn't
                            // introspect size. A 200ms delay before the
                            // sessionHandler post lets the SurfaceTexture's
                            // BufferQueue producer settle (the TextureView's
                            // hardware layer attaches in the very next draw
                            // frame, ~16ms; 200ms is generous safety margin
                            // for slower devices). Observed operator log on
                            // commit cdcada9 with 0ms post-delay (Pixel 10a
                            // 2026-05-25 22:13:53.295):
                            //   onAddTarget attach/reissue threw —
                            //   IllegalArgumentException: Surface was abandoned
                            //   at SurfaceUtils.getSurfaceSize(:134)
                            //   at OutputConfiguration.updateCachedSurfaceSize
                            //   at OutputConfiguration.getConfiguredSize
                            //   at OutputConfiguration.writeToParcel
                            //   at CameraDeviceImpl.updateOutputConfiguration
                            //   at CaptureSession$openCaptureSession$1.onConfigured$lambda$1$lambda$0(:826)
                            //
                            // FIFO ordering on sessionHandler also serialises
                            // attach/detach pairs (every onRemoveTarget post
                            // runs before any subsequent onAddTarget post).
                            sessionHandler.postDelayed({
                                val newPreview = LivePreviewSurfaceRegistry.currentSurface()
                                if (newPreview != null && newPreview !== attachedPreviewSurface) {
                                    try {
                                        // Detach the previously-attached Surface
                                        // (if any). Required before adding the new
                                        // one — an OutputConfiguration's surface
                                        // set is finite (per
                                        // getMaxSharedSurfaceCount) and we want
                                        // exactly the current Surface attached, no
                                        // stale ones.
                                        val prev = attachedPreviewSurface
                                        if (prev != null) {
                                            try {
                                                previewOutputConfig.removeSurface(prev)
                                            } catch (_: Throwable) { /* best-effort */ }
                                        }
                                        previewOutputConfig.addSurface(newPreview)

                                        // First-time attach uses finalize; subsequent
                                        // swaps use update (API 28+). On API 26-27
                                        // a subsequent swap is a no-op (first preview
                                        // wins; acceptable silent degradation since
                                        // Pixel 10a smoke target is API 36).
                                        if (!previewAttached) {
                                            s.finalizeOutputConfigurations(listOf(previewOutputConfig))
                                            previewAttached = true
                                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                            s.updateOutputConfiguration(previewOutputConfig)
                                        }
                                        attachedPreviewSurface = newPreview

                                        // Rebuild + reissue the repeating request
                                        // with the new preview as target #2.
                                        val nb = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                                        nb.addTarget(surface)
                                        nb.addTarget(newPreview)
                                        applyRecordingRequestSettings(nb, cam, mgr)
                                        s.setRepeatingRequest(nb.build(), null, sessionHandler)
                                    } catch (t: Throwable) {
                                        Log.w(TAG, "onAddTarget attach/reissue threw — preview skipped", t)
                                    }
                                }
                            }, 200L)
                        }
                        LivePreviewSurfaceRegistry.onRemoveTarget = {
                            Log.i(TAG, "onRemoveTarget fired")
                            // Same deferral as onAddTarget above — both
                            // callbacks run on the UI thread from the
                            // TextureView's SurfaceTextureListener; posting
                            // to sessionHandler keeps Camera2 ops off the UI
                            // thread AND preserves FIFO ordering with the
                            // matching onAddTarget post when a brightness
                            // state transition fires destroy-then-available
                            // in quick succession (fade-to-dim followed by
                            // an immediate tap-reveal). onRemoveTarget runs
                            // immediately (no 200ms delay) — detaching a
                            // doomed Surface should be prompt, and there's
                            // no equivalent "Surface not ready yet" race on
                            // the remove path.
                            sessionHandler.post {
                                try {
                                    // Step 1 — reissue the repeating request WITHOUT
                                    // the preview target so the camera driver stops
                                    // writing to the doomed Surface. Do this BEFORE
                                    // detaching the Surface from the OutputConfiguration
                                    // so there's no window where the request still
                                    // addresses a Surface that's no longer in the
                                    // configured output set (would throw IAE).
                                    val nb = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                                    nb.addTarget(surface)
                                    applyRecordingRequestSettings(nb, cam, mgr)
                                    s.setRepeatingRequest(nb.build(), null, sessionHandler)

                                    // Step 2 — detach the Surface from the
                                    // OutputConfiguration so a subsequent
                                    // `onAddTarget` for a fresh Surface can attach
                                    // without OutputConfiguration's surface set
                                    // growing unboundedly.
                                    val prev = attachedPreviewSurface
                                    if (prev != null) {
                                        try {
                                            previewOutputConfig.removeSurface(prev)
                                        } catch (_: Throwable) { /* best-effort */ }
                                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                            try {
                                                s.updateOutputConfiguration(previewOutputConfig)
                                            } catch (_: Throwable) { /* best-effort */ }
                                        }
                                        attachedPreviewSurface = null
                                    }
                                } catch (t: Throwable) {
                                    Log.w(TAG, "onRemoveTarget reissue/detach threw — encoder unaffected", t)
                                }
                            }
                        }
                    } catch (t: Throwable) {
                        sessionError = t
                    } finally {
                        latch.countDown()
                    }
                }

                override fun onConfigureFailed(s: CameraCaptureSession) {
                    sessionError = IllegalStateException("capture_session_configure_failed")
                    latch.countDown()
                }
            },
            cameraCbHandler,
        )
        if (!latch.await(CAMERA_OPEN_TIMEOUT_S, TimeUnit.SECONDS)) {
            throw IllegalStateException("capture_session_configure_timeout")
        }
        sessionError?.let { throw it }
        return session ?: throw IllegalStateException("capture_session_configure_failed")
    }

    /**
     * Apply OIS-off / video-stab-off / ultrawide zoom-route / AF-off + fixed
     * focus to a [CaptureRequest.Builder]. Extracted from `openCaptureSession`
     * for Phase 7 plan 07-07 (Option B) so the in-session
     * `setRepeatingRequest` rebuild path can construct a request with the
     * SAME zoom + AF + OIS settings — these settings are LOCKED per the
     * Phase 4 debug session handgate-never-passes and CLAUDE.md ultrawide
     * banner; the rebuilds MUST NOT drift from the original setup or the
     * recorded stream would briefly hunt focus / lose ultrawide routing.
     *
     * Verbatim semantics preserved (see the prior inline block comments):
     *  - LENS_OPTICAL_STABILIZATION_MODE_OFF
     *  - CONTROL_VIDEO_STABILIZATION_MODE_OFF (API 33+)
     *  - CONTROL_ZOOM_RATIO = lower bound when < 1.0 (ultrawide route, API 30+)
     *  - CONTROL_AF_MODE_OFF
     *  - LENS_FOCUS_DISTANCE = 0.0f when LENS_INFO_MINIMUM_FOCUS_DISTANCE > 0
     *
     * Every setter is wrapped best-effort — never block the session on a
     * single setter throwing (Pixel-firmware quirks during HAL transitions).
     */
    private fun applyRecordingRequestSettings(
        builder: CaptureRequest.Builder,
        cam: CameraDevice,
        mgr: CameraManager,
    ) {
        builder.set(
            CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
            CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF,
        )
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                builder.set(
                    CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
                    CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF,
                )
            } catch (_: Throwable) { /* best-effort */ }
        }
        // Route the logical back camera through its ULTRAWIDE physical
        // sub-camera by driving the zoom ratio to the lower bound of
        // CONTROL_ZOOM_RATIO_RANGE (debug session handgate-never-passes —
        // Stage 2). On a logical multi-camera whose default physical is the
        // main wide (~83° dFOV), a plain createCaptureSession streams that
        // main wide — violating the LOCKED ≥110° dFOV spec (idea-brief.md
        // §2.1) even though the compat probe and the sidecar's dfovDegrees
        // read the ultrawide's intrinsics. A sub-1.0 zoom ratio switches
        // the active physical to the ultrawide (Pixel 10a logical-back
        // range lower bound = 0.556 = the ultrawide), the same approach
        // the native gate camera proved on-device. API 30+ only
        // (CONTROL_ZOOM_RATIO_RANGE). When the device has no sub-1.0 zoom
        // (range lower ≥ 1.0, or the openable IS the ultrawide), this is
        // a harmless no-op. Additive hardening — the encoder/muxer/IMU
        // core is untouched (LOCKED per CLAUDE.md), but re-verify the
        // §5b drift afterward since the capture-request shape changed.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val zoomLower = mgr.getCameraCharacteristics(cam.id)
                    .get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
                    ?.lower
                if (zoomLower != null && zoomLower < 1.0f) {
                    builder.set(CaptureRequest.CONTROL_ZOOM_RATIO, zoomLower)
                }
            } catch (_: Throwable) { /* best-effort — never block the session on zoom */ }
        }
        // Lock focus for the whole take — no AF hunting on a head-mounted
        // rig (debug session handgate-never-passes).
        try {
            builder.set(
                CaptureRequest.CONTROL_AF_MODE,
                CaptureRequest.CONTROL_AF_MODE_OFF,
            )
            val characteristics = mgr.getCameraCharacteristics(cam.id)
            val minFocusDistance = characteristics.get(
                CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE,
            )
            // LENS_FOCUS_DISTANCE is in diopters (1/metres); 0.0f = focus
            // at infinity (hyperfocal "far"), which keeps arm's-length-to-
            // infinity acceptably sharp on the ultrawide. Only meaningful
            // on a lens that actually supports manual focus (minFocus > 0);
            // a fixed-focus lens reports 0 and ignores it.
            if (minFocusDistance != null && minFocusDistance > 0f) {
                builder.set(CaptureRequest.LENS_FOCUS_DISTANCE, 0.0f)
            }
        } catch (_: Throwable) { /* best-effort — never block the session on focus-lock */ }
    }

    /**
     * Encoder→muxer pump loop body. Per checker issue #2: every non-flag
     * dequeued buffer's presentationTimeUs is appended to
     * seg.videoFrameTimestamps BEFORE muxer.writeSampleData. Without this,
     * FinalizeWorker.finalize calls DriftCalculator on an empty list and
     * CAP-08 silently degrades.
     *
     * Visible-for-tests so a future Plan 04-* test can drive a synthetic
     * MediaCodec at the wrapper boundary without spinning up Camera2.
     */
    @VisibleForTesting
    internal fun runPumpLoop(seg: Segment) {
        try {
            val info = MediaCodec.BufferInfo()
            var videoTrackId = -1
            var muxerStarted = false
            // CR-04 fix — `pumpShouldStop` is the explicit, ordering-stable
            // exit signal that closeSegmentResources sets BEFORE tearing
            // down resources and BEFORE awaiting `pumpExitLatch`. The
            // `currentSegment === seg` check is retained as defense-in-depth
            // (eg. if a future code path swaps segments without going
            // through closeSegmentResources).
            while (!Thread.interrupted() && !seg.pumpShouldStop && currentSegment === seg) {
                val outIdx = try {
                    seg.hevc.dequeueOutputBuffer(info, 10_000L)
                } catch (_: IllegalStateException) {
                    // Encoder has been stopped/released by closeSegmentResources.
                    break
                }
                when {
                    outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        if (!muxerStarted) {
                            videoTrackId = seg.muxer.addTrack(seg.hevc.outputFormat)
                            seg.muxer.start()
                            muxerStarted = true
                        }
                    }
                    outIdx == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                        // No buffer this tick; keep polling.
                    }
                    outIdx >= 0 -> {
                        val buf: ByteBuffer? = try {
                            seg.hevc.getOutputBuffer(outIdx)
                        } catch (_: IllegalStateException) {
                            null
                        }
                        if (buf == null) {
                            try { seg.hevc.releaseOutputBuffer(outIdx, false) } catch (_: Throwable) {}
                        } else if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                            // Codec config buffer — no presentation timestamp;
                            // muxer consumes csd from the output format change.
                            try { seg.hevc.releaseOutputBuffer(outIdx, false) } catch (_: Throwable) {}
                        } else {
                            if (info.size > 0 && muxerStarted) {
                                // === CAP-08 timestamp collection (checker issue #2) ===
                                // Append physical presentation time in ns BEFORE writing
                                // the buffer. bufferInfo.presentationTimeUs is on the
                                // same elapsedRealtimeNanos domain as Camera2
                                // SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME (verified by
                                // RealtimeGate at session start; Pattern 1 invariant).
                                seg.videoFrameTimestamps.add(info.presentationTimeUs * 1_000L)
                                buf.position(info.offset)
                                buf.limit(info.offset + info.size)
                                try {
                                    seg.muxer.writeSampleData(videoTrackId, buf, info)
                                } catch (_: Throwable) { /* muxer closed mid-write */ }
                            }
                            try { seg.hevc.releaseOutputBuffer(outIdx, false) } catch (_: Throwable) {}
                        }
                        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break
                    }
                    else -> { /* other negative codes — ignore */ }
                }
            }
        } finally {
            // CR-04 fix — count down unconditionally so closeSegmentResources's
            // `pumpExitLatch.await(...)` returns even if the pump throws or
            // is interrupted. Without this, closeSegmentResources would block
            // for the full timeout on any pump exception path.
            seg.pumpExitLatch.countDown()
        }
    }


    // === Rotate ===

    /**
     * Auto-cut: close segment N, sleep 0.5 s gap, open segment N+1 with a
     * fresh recordingId (CAP-09), schedule the next cut, hand N to finalize.
     */
    private fun rotateSegment() {
        if (stopping) return
        val segN = currentSegment ?: return
        // CR-04 fix — null `currentSegment` BEFORE calling
        // closeSegmentResources, matching `stop()`'s ordering. The pump
        // loop's `currentSegment === seg` defense-in-depth check then
        // returns false immediately, even before pumpShouldStop is set
        // inside closeSegmentResources. With the previous ordering
        // (close first, null second), the pump kept dequeue/writeSampleData
        // running for the entire close duration.
        currentSegment = null
        try {
            closeSegmentResources(segN)

            try { Thread.sleep(SEGMENT_ROTATE_GAP_MS) } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                return
            }

            // Hand N off to finalize on the separate executor (Pattern 2 —
            // concurrent finalize). We do this BEFORE allocating N+1 so the
            // FinalizeWorker thread overlaps with N+1's pre-flight & open;
            // SHA streaming will run concurrent with N+1's encoder.
            finalizeExecutor.execute { FinalizeWorker.finalize(segN, emit) }
            segmentsCompleted++

            val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val pick = BackUltrawidePicker.pick(mgr)
                ?: throw IllegalStateException("no_back_ultrawide")
            // CAP-09: each segment owns its OWN recording_id; no parent linkage.
            val newRecordingId = UlidGenerator.next()
            val segNPlus1 = openSegment(newRecordingId, pick)
            currentSegment = segNPlus1
            emitSegmentStart(segNPlus1)
            segmentTimer.scheduleNext(segmentDurationMs) {
                sessionHandler.post { rotateSegment() }
            }
        } catch (t: Throwable) {
            // CR-03 fix — without this catch, any throw inside rotateSegment
            // (BackUltrawidePicker.pick, openSegment, segmentTimer.scheduleNext,
            // Camera2 hot-disconnect, MediaCodec init failure, etc.) propagates
            // up through the Runnable to Handler.dispatchMessage and is
            // logged-and-swallowed. The session would be silently dead:
            // currentSegment = null, no scheduled timer, no onError event,
            // and stop() later has nothing to close. Surface the error to
            // JS so RecordingScreen can show a recoverable error and
            // ensure stop() can still run cleanly.
            Log.e("HumynCapture", "rotateSegment failed → onError code=rotate_failed", t)
            val payload = Arguments.createMap().apply {
                putString("code", "rotate_failed")
                putString("message", t.message ?: "")
                putBoolean("recoverable", false)
                putString("segmentId", segN.segmentId)
            }
            emit("onError", payload)
            // Mark stopping so subsequent timer callbacks short-circuit; cancel
            // the timer so a stale scheduled cut doesn't fire post-error.
            stopping = true
            try { segmentTimer.cancel() } catch (_: Throwable) {}
        }
    }

    // === Stop ===

    /**
     * Stop the session: cancel the timer, close segment N, await finalize
     * (so the FGS doesn't shut down before metadata writes), emit
     * onSessionStop, release the thermal subscription, release HandlerThreads.
     *
     * Idempotent: a second call after stopping=true is a no-op.
     */
    fun stop() {
        if (stopping) return
        stopping = true
        try { segmentTimer.cancel() } catch (_: Throwable) {}
        val segN = currentSegment
        currentSegment = null
        if (segN != null) {
            closeSegmentResources(segN)
            val durationMs = (segN.endedAtNs - segN.startedAtNs) / 1_000_000L
            if (segmentsCompleted == 0 && durationMs < MIN_KEPT_DURATION_MS) {
                // REC-07 — the whole recording is the sole segment AND under
                // 60 s: discard it on disk (HumynCapture owns the deletion at
                // finalize). RecordingScreen has already shown the "Recording
                // too short — discarded." toast off its own durationMs; the
                // files must not survive into Phase 5's upload queue.
                //
                // Bug D6-1 (2026-06-05) — emit `onSegmentCanceled(too_short)`
                // FIRST so a NON-practice sub-60s sole segment produces the same
                // non-retryable "Canceled — recording too short" History row that
                // FinalizeWorker's [CancelReason.TooShort] path produces for the
                // [60s, 180s) band. Before this, sub-60s discarded silently
                // (toast only, no History row) while [60s, 180s) got a History
                // row — inconsistent, and contradicting the documented D6
                // contract ("sub-3-min segments render as non-retryable History
                // rows"). We reuse FinalizeWorker.emitCanceled (single source of
                // truth for the payload — width/height/meanFps emitted null for
                // TooShort) so the bridge shape can never drift from the
                // FinalizeWorker path. Practice segments stay EXEMPT (they never
                // produce History rows / never upload — ONB-04). emitCanceled
                // deletes the orphan-sidecar; we then keep the existing on-disk
                // bundle deletion below (the JS onSegmentCanceled handler's own
                // file unlink becomes a harmless no-op on already-deleted files).
                // Neither band uploads — discardSegmentArtifacts guarantees the
                // files never reach the upload queue.
                if (shouldEmitTooShortOnDiscard(segmentsCompleted, durationMs, segN.sidecar.isPractice)) {
                    FinalizeWorker.emitCanceled(segN, CancelReason.TooShort, emit)
                }
                discardSegmentArtifacts(segN)
            } else {
                // Synchronously await finalize so the FGS doesn't shut down before
                // metadata writes. 30 s budget is well above the ~0.9 s SHA streaming
                // for a 600 MB segment (idea-brief.md §6.7).
                val latch = CountDownLatch(1)
                finalizeExecutor.execute {
                    try { FinalizeWorker.finalize(segN, emit) } finally { latch.countDown() }
                }
                try { latch.await(30, TimeUnit.SECONDS) } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                }
                segmentsCompleted++
            }
        }
        stopThermalPoll()
        try { thermalSubscription?.close() } catch (_: Throwable) {}
        thermalSubscription = null

        val payload = Arguments.createMap().apply {
            putString("sessionId", sessionId)
            putInt("segmentsCompleted", segmentsCompleted)
        }
        emit("onSessionStop", payload)

        try { segmentTimer.release() } catch (_: Throwable) {}
        for (t in pumpThreads) try { t.quitSafely() } catch (_: Throwable) {}
        pumpThreads.clear()
        try { cameraCbThread.quitSafely() } catch (_: Throwable) {}
        try { sessionThread.quitSafely() } catch (_: Throwable) {}
    }

    // === Helpers ===

    /**
     * Close segment resources in the order Phase 2 EncoderProbe verified.
     * Each step in its own try so a failure in stage N still attempts
     * stages N+1..end. Stamps seg.endedAtNs (Pattern 1 invariant) so
     * FinalizeWorker can compute durationMs as
     * (endedAtNs - startedAtNs) / 1_000_000 without re-reading the clock.
     */
    private fun closeSegmentResources(seg: Segment) {
        // CR-04 fix — drain the encoder pipeline AND wait for the pump to
        // exit BEFORE tearing down the encoder / muxer / Surface. The
        // previous code called `Thread.sleep(50)` and relied on the pump's
        // `currentSegment !== seg` check, which:
        //   1. did not actually exit the pump in the rotateSegment path
        //      (currentSegment was nulled AFTER closeSegmentResources, so
        //      `currentSegment === seg` stayed true while close was running);
        //   2. assumed the pump would drain in 50 ms — not a contract Android
        //      guarantees;
        //   3. left getOutputBuffer / writeSampleData / Surface mid-call when
        //      the muxer / hevc.release / inputSurface.release ran, which on
        //      some Pixel firmware crashes the encoder native layer (SIGSEGV)
        //      rather than throwing IllegalStateException.
        //
        // New order:
        //   1. stop the capture session (no new frames to encoder).
        //   2. signalEndOfInputStream (encoder will emit EOS, pump will see
        //      BUFFER_FLAG_END_OF_STREAM and return).
        //   3. set pumpShouldStop = true and await pumpExitLatch — pump is
        //      provably out of all dequeue/getOutputBuffer/writeSampleData
        //      calls when the latch fires.
        //   4. quit the pump HandlerThread so it doesn't leak.
        //   5. NOW it's safe to release the encoder / surface / muxer.
        // Phase 7 plan 07-07 — clear the live-preview re-attach callbacks
        // BEFORE stopping the capture session. The callbacks closed over the
        // session reference; once `captureSession.close()` runs, any in-
        // flight `setRepeatingRequest` from a racy JS-driven add/remove
        // would throw IllegalStateException. Nulling them first eliminates
        // the race entirely. Idempotent — nulling already-null fields is a
        // no-op.
        LivePreviewSurfaceRegistry.onAddTarget = null
        LivePreviewSurfaceRegistry.onRemoveTarget = null
        try { seg.captureSession.stopRepeating() } catch (_: Throwable) {}
        try { seg.captureSession.close() } catch (_: Throwable) {}
        try { seg.hevc.signalEndOfInputStream() } catch (_: Throwable) {}
        seg.pumpShouldStop = true
        try {
            // 2 s budget: well above the encoder's typical drain time
            // (~tens of ms on Pixel-class). If the pump fails to exit in
            // this window, we proceed with teardown anyway — the catch
            // blocks below absorb whatever exception the racing pump
            // surfaces — but we've at least eliminated the common case.
            seg.pumpExitLatch.await(2L, TimeUnit.SECONDS)
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
        }
        try { seg.pumpThread.quitSafely() } catch (_: Throwable) {}
        try { seg.hevc.stop() } catch (_: Throwable) {}
        try { seg.hevc.release() } catch (_: Throwable) {}
        try { seg.inputSurface.release() } catch (_: Throwable) {}
        try { seg.muxer.close() } catch (_: Throwable) {}
        try { seg.cam.close() } catch (_: Throwable) {}
        try {
            seg.imuWriter.stop()
            seg.imuWriter.close()
        } catch (_: Throwable) {}
        // Stamp the segment's end time BEFORE handing to FinalizeWorker so the
        // finalize path computes durationMs without re-reading the clock
        // (issue #10 mandate: SystemClock.elapsedRealtimeNanos exclusively).
        seg.endedAtNs = SystemClock.elapsedRealtimeNanos()
    }

    /**
     * Bug-4 fix — single chokepoint for a mid-record thermal escalation
     * (`status ≥ SEVERE`), invoked by BOTH the OS `OnThermalStatusChangedListener`
     * AND the 5 s polling fallback. Idempotent via [thermalAbortFired] — the
     * first caller emits `onThermalAbort` (so JS can fire the voice cue / pill /
     * tone / haptic per D-THERM-01) and posts the 2.5 s graceful self-stop;
     * subsequent callers are no-ops. Never blocks (the listener fires on the OS
     * binder thread; the poll on the session HandlerThread).
     */
    private fun onThermalEscalation(status: Int) {
        Log.w("HumynCapture", "onThermalEscalation(status=$status) thermalAbortFired=$thermalAbortFired stopping=$stopping")
        if (thermalAbortFired || stopping) return
        thermalAbortFired = true
        val payload = Arguments.createMap().apply {
            putString("segmentId", currentSegment?.segmentId ?: "")
            putInt("currentStatus", status)
        }
        emit("onThermalAbort", payload)
        sessionHandler.postDelayed({ if (!stopping) stop() }, THERMAL_GRACEFUL_STOP_MS)
    }

    /** Bug-4 fix — start the 5 s thermal-status poll on the session HandlerThread. */
    private fun startThermalPoll() {
        val r = object : Runnable {
            override fun run() {
                if (stopping || thermalAbortFired) return
                val status = thermalGate.currentStatus()
                if (status >= android.os.PowerManager.THERMAL_STATUS_SEVERE) {
                    onThermalEscalation(status)
                    return
                }
                sessionHandler.postDelayed(this, THERMAL_POLL_INTERVAL_MS)
            }
        }
        thermalPollRunnable = r
        sessionHandler.postDelayed(r, THERMAL_POLL_INTERVAL_MS)
    }

    /** Bug-4 fix — cancel the thermal poll (idempotent). */
    private fun stopThermalPoll() {
        thermalPollRunnable?.let { sessionHandler.removeCallbacks(it) }
        thermalPollRunnable = null
    }

    /**
     * REC-07 — delete every artifact of a discarded (<60 s sole) segment:
     * the MP4, the IMU CSV, any metadata JSON that somehow already exists,
     * and the `.session.json` sidecar (so the app-launch sweep doesn't later
     * treat the leftover sidecar as a re-finalize candidate). Best-effort —
     * a missing file is a no-op; we never throw out of stop()'s teardown.
     */
    private fun discardSegmentArtifacts(seg: Segment) {
        for (f in listOf(seg.mp4File, seg.csvFile, seg.jsonFile, seg.sidecarFile)) {
            try { if (f.exists()) f.delete() } catch (_: Throwable) { /* best-effort */ }
        }
    }

    private fun emitSegmentStart(seg: Segment) {
        val payload = Arguments.createMap().apply {
            putString("segmentId", seg.segmentId)
            putString("recordingId", seg.recordingId)
            putString("startedAt", seg.sidecar.wallclockStartIso)
            putString("filenameBase", seg.filenameBase)
        }
        emit("onSegmentStart", payload)
    }

    /**
     * Snapshot of the current segment for the JS bridge's start() Promise
     * resolve payload. Throws if no segment is active (called outside the
     * valid post-start() window — surfaces as `internal_error` via
     * `errorCodeFor`).
     */
    fun toStartResponse(): WritableMap {
        val seg = currentSegment ?: throw IllegalStateException("no_active_session")
        return Arguments.createMap().apply {
            putString("sessionId", sessionId)
            putString("segmentId", seg.segmentId)
            putString("recordingId", seg.recordingId)
            putString("filenameBase", seg.filenameBase)
        }
    }
}

/**
 * Container for one segment's lifecycle state.
 *
 * `endedAtNs` is set in CaptureSession.closeSegmentResources to
 * SystemClock.elapsedRealtimeNanos(); FinalizeWorker computes
 * durationMs as (endedAtNs - startedAtNs) / 1_000_000 — both clocks
 * are elapsedRealtimeNanos (issue #10).
 */
internal data class Segment(
    val segmentId: String,
    val recordingId: String,
    val filenameBase: String,
    val mp4File: File,
    val csvFile: File,
    val jsonFile: File,
    val sidecarFile: File,
    val startedAtNs: Long,
    var endedAtNs: Long,
    val sidecar: SidecarPayload,
    val cam: CameraDevice,
    val captureSession: CameraCaptureSession,
    val inputSurface: Surface,
    val hevc: MediaCodec,
    val muxer: FragmentedMuxerWrapper,
    val imuWriter: ImuWriter,
    /**
     * CR-01 fix — memory-model-correct shared collection between the encoder
     * pump thread (writer) and the finalize executor (reader, via
     * `toLongArray()`). The previous `mutableListOf<Long>()` (an
     * unsynchronized `ArrayList`) admitted ConcurrentModificationException
     * during finalize's snapshot AND silently truncated arrays on partial
     * visibility — both of which corrupt the CAP-08 drift methodology.
     *
     * **Debug session `humyncapture-imu-oom-rollover` (2026-05-18).** Was
     * `CopyOnWriteArrayList<Long>`, which boxed every `add(Long)` AND copied
     * the entire backing `Object[]` on every `add` (O(n²) garbage generation
     * for n adds). At 30 fps × 600 s = 18 000 adds per segment, that's
     * ~162 M intermediate `Object[]` allocations per segment, all young-gen
     * but a constant GC firehose. Across 7 continuous 10-min segments on the
     * Pixel 10a manual-smoke walk the cumulative pressure (alongside the
     * `ImuWriter.timestampList` boxing) saturated the 256 MB growth limit
     * and the process OOMed. Now a primitive [PrimitiveLongBuffer] —
     * pre-allocated `LongArray` of [PrimitiveLongBuffer.VIDEO_CAPACITY]
     * longs (~173 KB), never grows, no boxing, memory-model-correct via the
     * `AtomicInteger` write-index. Single-writer (encoder pump);
     * single-reader-snapshot (finalize).
     */
    val videoFrameTimestamps: PrimitiveLongBuffer,
    val pumpThread: HandlerThread,
    /**
     * CR-04 fix — pump-loop exit signal. The pump runnable (runPumpLoop)
     * counts this down in a `finally` block when it returns; closeSegmentResources
     * awaits it BEFORE tearing down the encoder / muxer / Surface so the pump
     * is provably out of the dequeue/getOutputBuffer/writeSampleData calls
     * at teardown time. This eliminates the race where Surface.release() or
     * muxer.close() ran concurrent with the pump's getOutputBuffer/writeSampleData,
     * which on some Pixel firmware crashes the encoder native layer (SIGSEGV)
     * rather than throwing IllegalStateException.
     */
    val pumpExitLatch: java.util.concurrent.CountDownLatch,
    /**
     * CR-04 fix — explicit pump-stop signal. Set to true by closeSegmentResources
     * BEFORE awaiting the pump-exit latch. The pump observes this on every
     * loop iteration (via the @Volatile load) and returns promptly without
     * waiting for `currentSegment !== seg` (which is set later in the
     * close path and was previously the sole exit signal — ordering
     * inconsistent between rotate and stop paths).
     */
    @Volatile var pumpShouldStop: Boolean = false,
)

/**
 * CAP-07 — REALTIME-source pre-flight gate.
 *
 * `verify(chars)` reads `SENSOR_INFO_TIMESTAMP_SOURCE` and throws
 * [RealtimeClockUnavailableException] when the device does NOT advertise
 * `REALTIME`. The exception's message is the bridge code string
 * (`"realtime_clock_unavailable"`) — part of the public Promise-reject
 * contract; HumynCaptureModule.errorCodeFor maps directly off the type.
 */
object RealtimeGate {
    fun verify(chars: CameraCharacteristics) {
        val src = chars.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE)
        if (src != CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME) {
            throw RealtimeClockUnavailableException()
        }
    }
}

class RealtimeClockUnavailableException : RuntimeException("realtime_clock_unavailable")
