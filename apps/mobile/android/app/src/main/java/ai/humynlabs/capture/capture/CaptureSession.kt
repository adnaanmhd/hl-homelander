package ai.humynlabs.capture.capture

import android.content.Context
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaCodec
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.view.Surface
import androidx.annotation.VisibleForTesting
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import ai.humynlabs.capture.capture.common.BackUltrawidePicker
import ai.humynlabs.capture.capture.common.UltrawidePick
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
    private val thermalGate = ThermalGate(ctx)
    private var thermalSubscription: AutoCloseable? = null
    private val segmentTimer = SegmentTimer()

    /** The pump-loop HandlerThread lifecycle is per-segment (see openSegment / closeSegmentResources). */
    private val pumpThreads = mutableListOf<HandlerThread>()

    companion object {
        /** Camera2 open timeout — matches EncoderProbe convention. */
        private const val CAMERA_OPEN_TIMEOUT_S = 2L

        /** Graceful-stop budget after a mid-record SEVERE thermal escalation. */
        private const val THERMAL_GRACEFUL_STOP_MS = 2_500L

        /** Silent gap between segments at auto-cut (D-SEG-03). */
        private const val SEGMENT_ROTATE_GAP_MS = 500L

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
        //    we emit the JS event immediately and post the graceful stop
        //    to the session's HandlerThread. By this point currentSegment
        //    is guaranteed non-null so the emitted segmentId is correlable.
        thermalSubscription = thermalGate.subscribeMidRecord { status ->
            val payload = Arguments.createMap().apply {
                putString("segmentId", currentSegment?.segmentId ?: "")
                putInt("currentStatus", status)
            }
            emit("onThermalAbort", payload)
            sessionHandler.postDelayed({ if (!stopping) stop() }, THERMAL_GRACEFUL_STOP_MS)
        }

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
        val base = FilenameGenerator.nextBase(now, listOf(recordingsDir, practiceDir))

        val mp4 = File(outDir, "$base.mp4")
        val csv = File(outDir, "$base.csv")
        val json = File(outDir, "$base.json")
        val sidecarFile = File(outDir, "$base.session.json")

        // 2. Per-segment clock stamp (Pattern 1 invariant — elapsedRealtimeNanos).
        val startNs = SystemClock.elapsedRealtimeNanos()
        val wallclockStartIso = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

        // 3. Sidecar payload — captures the JS-supplied opts + segment timing
        //    so the app-launch sweep (Plan 03-09) can re-finalize if the
        //    process crashes between segment-stop and metadata write.
        val sidecar = SidecarPayload(
            schemaVersion = SidecarManager.CURRENT_SCHEMA_VERSION,
            sessionId = sessionId,
            segmentId = UlidGenerator.next(),
            recordingId = recordingId,
            filenameBase = base,
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
        )
        SidecarManager.write(sidecarFile, sidecar)

        // 4. Allocate primitives in the order Phase 2 EncoderProbe verified.
        //    Camera2 OPEN -> HEVC encoder + Surface -> AAC encoder + AudioRecord ->
        //    muxer -> IMU writer + start. Each step is wrapped so partial
        //    allocation tears down cleanly on failure.
        var camDevice: CameraDevice? = null
        var hevc: MediaCodec? = null
        var inputSurface: Surface? = null
        var aac: MediaCodec? = null
        var audioRecord: AudioRecord? = null
        var muxer: FragmentedMuxerWrapper? = null
        var imuWriter: ImuWriter? = null
        var captureSession: CameraCaptureSession? = null
        val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            camDevice = openCameraSync(pick.openableId, mgr)
            val (codec, surf) = HevcEncoder.configure()
            hevc = codec
            inputSurface = surf
            aac = AacEncoder.configure()
            val audioMgr = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            audioRecord = audioMgr?.let { AacEncoder.makeAudioRecord(it) }
            muxer = FragmentedMuxerWrapper.create(mp4)
            imuWriter = ImuWriter(ctx, csv).also { it.start() }
            captureSession = openCaptureSession(camDevice, inputSurface)
        } catch (t: Throwable) {
            // Tear down whatever we managed to allocate before propagating.
            try { captureSession?.close() } catch (_: Throwable) {}
            try { imuWriter?.close() } catch (_: Throwable) {}
            try { muxer?.close() } catch (_: Throwable) {}
            try { audioRecord?.release() } catch (_: Throwable) {}
            try { aac?.stop(); aac?.release() } catch (_: Throwable) {}
            try { inputSurface?.release() } catch (_: Throwable) {}
            try { hevc?.stop(); hevc?.release() } catch (_: Throwable) {}
            try { camDevice?.close() } catch (_: Throwable) {}
            // Surface the open failure to JS — Phase 4's RecordingScreen
            // catches this on the start() Promise reject path.
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
            filenameBase = base,
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
            aac = aac!!,
            audioRecord = audioRecord,
            muxer = muxer!!,
            imuWriter = imuWriter!!,
            videoFrameTimestamps = java.util.concurrent.CopyOnWriteArrayList(),
            pumpThread = pumpThread,
            pumpExitLatch = CountDownLatch(1),
        )

        // 6. Kick off the pump. The Runnable owns the dequeue → write loop;
        //    breaks when the encoder emits END_OF_STREAM or the segment is
        //    swapped out by rotateSegment.
        Handler(pumpThread.looper).post { runPumpLoop(seg) }

        return seg
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
        }, sessionHandler)
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
     */
    private fun openCaptureSession(cam: CameraDevice, surface: Surface): CameraCaptureSession {
        val latch = CountDownLatch(1)
        var session: CameraCaptureSession? = null
        var sessionError: Throwable? = null

        @Suppress("DEPRECATION")
        cam.createCaptureSession(
            listOf(surface),
            object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(s: CameraCaptureSession) {
                    try {
                        val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                        builder.addTarget(surface)
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
                        s.setRepeatingRequest(builder.build(), null, sessionHandler)
                        session = s
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
            sessionHandler,
        )
        if (!latch.await(CAMERA_OPEN_TIMEOUT_S, TimeUnit.SECONDS)) {
            throw IllegalStateException("capture_session_configure_timeout")
        }
        sessionError?.let { throw it }
        return session ?: throw IllegalStateException("capture_session_configure_failed")
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
        try { seg.audioRecord?.stop() } catch (_: Throwable) {}
        try { seg.audioRecord?.release() } catch (_: Throwable) {}
        try { seg.aac.stop() } catch (_: Throwable) {}
        try { seg.aac.release() } catch (_: Throwable) {}
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
    val aac: MediaCodec,
    val audioRecord: AudioRecord?,
    val muxer: FragmentedMuxerWrapper,
    val imuWriter: ImuWriter,
    /**
     * CR-01 fix — `CopyOnWriteArrayList` so the encoder pump thread (writer)
     * and the finalize executor (reader, via `toLongArray()`) see a
     * memory-model-correct view. The previous `mutableListOf<Long>()`
     * (an unsynchronized `ArrayList`) admitted ConcurrentModificationException
     * during finalize's snapshot AND silently truncated arrays on partial
     * visibility — both of which corrupt the CAP-08 drift methodology.
     *
     * Per-frame allocation cost on COW: each `add` copies the underlying
     * array. At 30 fps × 600 s = 18 000 frames per segment, that is
     * O(n²) writes — acceptable here because the writes are tiny longs
     * and the total work is well under a second on a Pixel-class device.
     * If profiling on a real device shows hot-path pressure, swap to a
     * pre-allocated `LongArray` + `AtomicInteger` write index (sized for
     * `max_frames_per_segment` = 21 600 with safety margin); both are
     * memory-model-correct.
     */
    val videoFrameTimestamps: java.util.concurrent.CopyOnWriteArrayList<Long>,
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
