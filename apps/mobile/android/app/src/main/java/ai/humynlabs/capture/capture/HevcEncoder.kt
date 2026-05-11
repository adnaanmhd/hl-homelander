package ai.humynlabs.capture.capture

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Build
import android.view.Surface

/**
 * Phase 3 CAP-01 — HEVC encoder configuration wrapper.
 *
 * MediaFormat key set is locked per `idea-brief.md §6.2`:
 *   - HEVC Main / 1920×1080 / 30 FPS / 8 Mbps CBR / GOP=30 (1.0 s)
 *   - no B-frames (KEY_LATENCY=1 + KEY_MAX_B_FRAMES=0)
 *   - 8-bit YUV 4:2:0 / no HDR / no OIS (HDR-OFF lives on the
 *     OutputConfiguration, NOT the MediaFormat — Pitfall 4 mitigation
 *     in Plan 03-10 CaptureSession Camera2 setup; KEY_COLOR_TRANSFER
 *     is set to SDR_VIDEO here only as a "this is an SDR clip" hint
 *     for muxer + downstream decoders).
 *   - BT.709 limited-range, surface-input color format.
 *
 * Phase 2's `EncoderProbe.kt` lines 79–92 is the source pattern; this
 * Phase-3 config adds the seven keys EncoderProbe omits because the
 * 5 s probe doesn't need them: PROFILE, PRIORITY, OPERATING_RATE,
 * COLOR_RANGE, COLOR_STANDARD, COLOR_TRANSFER, KEY_BITRATE_MODE was
 * already in the probe.
 *
 * `buildMediaFormat()` is the pure-fn seam — config-audit tests can
 * inspect every key without instantiating a real MediaCodec (Robolectric
 * cannot shadow the encoder pipeline). `configure()` is the integrated
 * builder used at runtime by `CaptureSession.kt` (Plan 03-10).
 */
object HevcEncoder {
    const val MIME = MediaFormat.MIMETYPE_VIDEO_HEVC
    const val WIDTH = 1920
    const val HEIGHT = 1080
    const val FRAME_RATE = 30
    const val BIT_RATE = 8_000_000
    /** KEY_I_FRAME_INTERVAL: seconds between I-frames; 1 second @ 30 FPS = GOP 30. */
    const val GOP_INTERVAL_SEC = 1

    /**
     * Build the locked-spec MediaFormat. Pure function — no MediaCodec
     * allocation, no Surface, no side effects. Safe to call from tests.
     */
    fun buildMediaFormat(): MediaFormat = MediaFormat.createVideoFormat(MIME, WIDTH, HEIGHT).apply {
        setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
        setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
        setInteger(MediaFormat.KEY_FRAME_RATE, FRAME_RATE)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, GOP_INTERVAL_SEC)
        setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain)
        // WR-04 fix — pin KEY_LEVEL = Main Tier Level 4. Without an
        // explicit level, the encoder may select Main@L3 (max 1280×720,
        // 6 Mbps) on some OEM codecs (Samsung Exynos, MediaTek Helio),
        // failing to honor the 1080p / 8 Mbps requirement. The HEVC spec
        // requires Main@L4 for 1080p30 / 8 Mbps. CAP-01 demands a
        // deterministic encoder configuration across the OEM matrix; a
        // missing level lock invites silent regressions on devices we
        // haven't tested.
        setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.HEVCMainTierLevel4)
        // KEY_LATENCY=1 is the canonical "no B-frames" hint (API 24+).
        if (Build.VERSION.SDK_INT >= 24) setInteger(MediaFormat.KEY_LATENCY, 1)
        // KEY_MAX_B_FRAMES=0 is the explicit lock (API 25+ — older
        // encoders honor KEY_LATENCY alone).
        if (Build.VERSION.SDK_INT >= 25) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
        // Realtime priority — encoder runs on the recording-thread and
        // must not block on background dispatch.
        setInteger(MediaFormat.KEY_PRIORITY, 0)
        setInteger(MediaFormat.KEY_OPERATING_RATE, FRAME_RATE)
        setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
        setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT709)
        setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_SDR_VIDEO)
    }

    /**
     * Allocate + configure a real MediaCodec encoder and its input
     * Surface. Call from `CaptureSession.start()` on the recording
     * HandlerThread. Caller owns lifecycle: stop / release / close
     * the Surface in a `try/finally` block.
     *
     * @return (encoder, inputSurface). Camera2 binds a CaptureRequest
     *   target to the inputSurface; encoder pulls frames as they're
     *   submitted by the camera HAL.
     */
    fun configure(): Pair<MediaCodec, Surface> {
        val format = buildMediaFormat()
        val codec = MediaCodec.createEncoderByType(MIME)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val inputSurface = codec.createInputSurface()
        codec.start()
        return codec to inputSurface
    }
}
