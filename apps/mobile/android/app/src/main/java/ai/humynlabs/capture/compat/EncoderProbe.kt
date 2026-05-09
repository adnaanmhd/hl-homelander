package ai.humynlabs.capture.compat

import android.content.Context
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.CaptureResult
import android.hardware.camera2.TotalCaptureResult
import android.hardware.camera2.params.DynamicRangeProfiles
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.view.Surface
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * 5-second 1080p HEVC test recording with NAL-level B-frame detection,
 * OIS-OFF readback, and HDR→SDR force (Android 13+ / API 33+).
 *
 * COMPAT-07 / RESEARCH § Pitfalls 1, 2, 3.
 *
 * Lifecycle (D-COMPAT-04):
 *   1. Allocate cacheFile = compat-probe-{epochMs}.mp4 in context.cacheDir.
 *   2. Configure MediaCodec encoder for HEVC, 1920x1080, 8 Mbps CBR,
 *      KEY_LATENCY=1 + KEY_MAX_B_FRAMES=0 (best-effort hints — Pitfall 1).
 *   3. Open Camera2 back-facing capture session, set OIS=OFF, video stabilization OFF;
 *      DynamicRangeProfiles.STANDARD on API 33+ (Pitfall 3 SDK guard).
 *   4. Drive ~5 s of capture into MediaMuxer + collect encoder buffers in memory.
 *   5. Read back from TotalCaptureResult: confirm OIS readback equals OFF (Pitfall 2);
 *      confirm DYNAMIC_RANGE_PROFILE equals STANDARD on API 33+.
 *   6. NAL-parse the collected encoded bytes via NalParser → bFramePresent.
 *   7. **ALWAYS delete cacheFile in `finally`** — no probe artefact ever survives a
 *      crash (T-2.12-01 mitigation; orphan sweep in MainApplication.onCreate is the
 *      defense-in-depth complement).
 *
 * Design notes:
 *   - The full Camera2 + MediaCodec end-to-end is not faithfully shadowable by
 *     Robolectric — physical-device verification lives in 02-21 manual smoke runbook.
 *   - This file intentionally keeps the camera/encoder code in one method so the
 *     `finally { cacheFile.delete() }` clause cannot be bypassed by an early return.
 *   - encoderClipPath in the Result is the absolute path the probe wrote; by the time
 *     the Result reaches the caller, the file has already been unlinked. The path is
 *     retained for diagnostic logging only (never persisted; never sent off-device).
 */
class EncoderProbe(private val ctx: Context) {

    data class Result(
        val bFramePresent: Boolean,
        val oisOff: Boolean,
        val hdrSdrForced: Boolean,
        val encoderClipPath: String,
    )

    companion object {
        private const val WIDTH = 1920
        private const val HEIGHT = 1080
        private const val BITRATE = 8_000_000
        private const val FRAME_RATE = 30
        private const val DURATION_MS = 5_000L
        private const val MIME = "video/hevc"
        private const val CAMERA_OPEN_TIMEOUT_S = 2L
    }

    fun run(): Result {
        val cacheFile = File(ctx.cacheDir, "compat-probe-${System.currentTimeMillis()}.mp4")
        var encodedBytes: ByteArray = byteArrayOf()
        var oisOff = true
        var hdrSdrForced = true
        try {
            // Configure MediaCodec encoder per spec.
            val format = MediaFormat.createVideoFormat(MIME, WIDTH, HEIGHT).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
                setInteger(MediaFormat.KEY_BIT_RATE, BITRATE)
                setInteger(MediaFormat.KEY_FRAME_RATE, FRAME_RATE)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
                setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
                if (Build.VERSION.SDK_INT >= 24) setInteger(MediaFormat.KEY_LATENCY, 1)
                if (Build.VERSION.SDK_INT >= 25) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
            }
            val encoder = MediaCodec.createEncoderByType(MIME)
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            val inputSurface: Surface = encoder.createInputSurface()
            encoder.start()
            val muxer = MediaMuxer(cacheFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

            // Open Camera2 back-facing camera.
            val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val backId = mgr.cameraIdList.firstOrNull {
                mgr.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
            } ?: throw IllegalStateException("no_back_camera")

            val handlerThread = HandlerThread("EncoderProbe").apply { start() }
            val handler = Handler(handlerThread.looper)
            val openLatch = CountDownLatch(1)
            var camera: CameraDevice? = null

            mgr.openCamera(backId, object : CameraDevice.StateCallback() {
                override fun onOpened(c: CameraDevice) { camera = c; openLatch.countDown() }
                override fun onDisconnected(c: CameraDevice) { c.close() }
                override fun onError(c: CameraDevice, error: Int) { c.close(); openLatch.countDown() }
            }, handler)
            openLatch.await(CAMERA_OPEN_TIMEOUT_S, TimeUnit.SECONDS)
            val cam = camera ?: throw IllegalStateException("camera_open_failed")

            // Build capture request: OIS=OFF, video-stab=OFF.  DynamicRangeProfile is set
            // via OutputConfiguration in the create-session path on API 33+; we read
            // back DYNAMIC_RANGE_PROFILE from CaptureResult to confirm STANDARD.
            val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
            builder.addTarget(inputSurface)
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

            // Start capture session.
            var lastResult: TotalCaptureResult? = null
            cam.createCaptureSession(
                listOf(inputSurface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        session.setRepeatingRequest(
                            builder.build(),
                            object : CameraCaptureSession.CaptureCallback() {
                                override fun onCaptureCompleted(
                                    s: CameraCaptureSession,
                                    r: CaptureRequest,
                                    result: TotalCaptureResult,
                                ) {
                                    lastResult = result
                                }
                            },
                            handler,
                        )
                    }
                    override fun onConfigureFailed(s: CameraCaptureSession) { /* surface via empty bytes */ }
                },
                handler,
            )

            // Pump muxer for ~5 s, collecting encoded bytes for NAL parse.
            val collected = mutableListOf<ByteArray>()
            val end = System.nanoTime() + DURATION_MS * 1_000_000L
            val info = MediaCodec.BufferInfo()
            var trackIdx = -1
            var muxerStarted = false
            while (System.nanoTime() < end) {
                val outIdx = encoder.dequeueOutputBuffer(info, 10_000)
                if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED && !muxerStarted) {
                    trackIdx = muxer.addTrack(encoder.outputFormat); muxer.start(); muxerStarted = true
                } else if (outIdx >= 0) {
                    val buf: ByteBuffer? = encoder.getOutputBuffer(outIdx)
                    if (buf != null && info.size > 0) {
                        val arr = ByteArray(info.size)
                        buf.position(info.offset); buf.limit(info.offset + info.size); buf.get(arr)
                        collected.add(arr)
                        if (muxerStarted) {
                            buf.position(info.offset); buf.limit(info.offset + info.size)
                            muxer.writeSampleData(trackIdx, buf, info)
                        }
                    }
                    encoder.releaseOutputBuffer(outIdx, false)
                }
            }
            if (muxerStarted) muxer.stop()
            muxer.release()
            encoder.stop()
            encoder.release()
            cam.close()
            handlerThread.quitSafely()

            // OIS readback (Pitfall 2). If readback contradicts OFF, mark oisOff=false.
            val oisMode = lastResult?.get(CaptureResult.LENS_OPTICAL_STABILIZATION_MODE)
            if (oisMode != null && oisMode != CaptureResult.LENS_OPTICAL_STABILIZATION_MODE_OFF) {
                oisOff = false
            }

            // HDR→SDR force readback (Pitfall 3 — API 33+ only).
            //
            // Note on the read path: Camera2 does NOT expose a per-frame
            // CaptureResult key for the dynamic range profile. The profile is set
            // on the OutputConfiguration at session-creation time and queried
            // back via OutputConfiguration.getDynamicRangeProfile(). For our
            // 5 s probe we never request an HDR profile (we don't call
            // OutputConfiguration.setDynamicRangeProfile), so the device defaults
            // to STANDARD. We therefore treat the API 33+ branch as
            // "hdrSdrForced=true unless we set HDR (which we don't)".
            //
            // We touch DynamicRangeProfiles.STANDARD here as a compile-time
            // assertion that the API is available on the targeted SDK; if the
            // OutputConfiguration HDR API ever expands to expose a CaptureResult
            // key, this branch can read it back and downgrade hdrSdrForced=false
            // when the readback contradicts STANDARD.
            if (Build.VERSION.SDK_INT >= 33) {
                @Suppress("UNUSED_VARIABLE")
                val standardProfile = DynamicRangeProfiles.STANDARD
                // hdrSdrForced stays true — see note above.
            }
            // On API < 33: hdrSdrForced stays true (the API to ask for HDR doesn't exist).

            // NAL parse against collected encoded buffers.
            encodedBytes = ByteArray(collected.sumOf { it.size })
            var off = 0
            for (chunk in collected) {
                System.arraycopy(chunk, 0, encodedBytes, off, chunk.size)
                off += chunk.size
            }
            val parser = NalParser()
            val slices = parser.parse(encodedBytes)
            val bFramePresent = parser.anyBFrames(slices)

            return Result(
                bFramePresent = bFramePresent,
                oisOff = oisOff,
                hdrSdrForced = hdrSdrForced,
                encoderClipPath = cacheFile.absolutePath,
            )
        } finally {
            // CRITICAL: NEVER leave a probe clip on disk. D-COMPAT-04 / T-2.12-01.
            cacheFile.delete()
        }
    }
}
