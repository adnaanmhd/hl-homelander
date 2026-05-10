package ai.humynlabs.capture.capture

import android.app.Application
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-08 Task 1 — CAP-01 HEVC encoder MediaFormat audit.
 *
 * Locks every key in the encoder config against `idea-brief.md §2.1` /
 * §6.2: HEVC Main / 1920×1080 / 30 FPS / 8 Mbps CBR / GOP=1.0 s
 * (KEY_I_FRAME_INTERVAL=1) / no B-frames (KEY_LATENCY=1 +
 * KEY_MAX_B_FRAMES=0) / BT.709 limited-range SDR / surface input.
 *
 * Pure-fn `buildMediaFormat()` is the testable seam — we don't
 * instantiate a real MediaCodec because Robolectric can't shadow the
 * encoder pipeline. Real encoder behavior is verified at compat time
 * (Phase 2 EncoderProbe) and again on real devices in Phase 4 smoke.
 *
 * `application = Application::class` matches Plan 03-04's pattern —
 * bypasses MainApplication.onCreate's SoLoader.init NPE under
 * Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class HevcEncoderConfigTest {

    @Test
    fun `format declares HEVC Main 1920x1080 30fps 8Mbps CBR GOP30 no B-frames`() {
        val f = HevcEncoder.buildMediaFormat()
        assertEquals(MediaFormat.MIMETYPE_VIDEO_HEVC, f.getString(MediaFormat.KEY_MIME))
        assertEquals(1920, f.getInteger(MediaFormat.KEY_WIDTH))
        assertEquals(1080, f.getInteger(MediaFormat.KEY_HEIGHT))
        assertEquals(30, f.getInteger(MediaFormat.KEY_FRAME_RATE))
        assertEquals(8_000_000, f.getInteger(MediaFormat.KEY_BIT_RATE))
        assertEquals(
            MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR,
            f.getInteger(MediaFormat.KEY_BITRATE_MODE),
        )
        assertEquals(1, f.getInteger(MediaFormat.KEY_I_FRAME_INTERVAL))
        assertEquals(
            MediaCodecInfo.CodecProfileLevel.HEVCProfileMain,
            f.getInteger(MediaFormat.KEY_PROFILE),
        )
        assertEquals(
            MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface,
            f.getInteger(MediaFormat.KEY_COLOR_FORMAT),
        )
        if (Build.VERSION.SDK_INT >= 24) {
            assertEquals(1, f.getInteger(MediaFormat.KEY_LATENCY))
        }
        if (Build.VERSION.SDK_INT >= 25) {
            assertEquals(0, f.getInteger(MediaFormat.KEY_MAX_B_FRAMES))
        }
        assertEquals(0, f.getInteger(MediaFormat.KEY_PRIORITY))
        assertEquals(30, f.getInteger(MediaFormat.KEY_OPERATING_RATE))
        assertEquals(
            MediaFormat.COLOR_RANGE_LIMITED,
            f.getInteger(MediaFormat.KEY_COLOR_RANGE),
        )
        assertEquals(
            MediaFormat.COLOR_STANDARD_BT709,
            f.getInteger(MediaFormat.KEY_COLOR_STANDARD),
        )
        assertEquals(
            MediaFormat.COLOR_TRANSFER_SDR_VIDEO,
            f.getInteger(MediaFormat.KEY_COLOR_TRANSFER),
        )
    }

    @Test
    fun `companion constants match locked spec values`() {
        assertEquals(MediaFormat.MIMETYPE_VIDEO_HEVC, HevcEncoder.MIME)
        assertEquals(1920, HevcEncoder.WIDTH)
        assertEquals(1080, HevcEncoder.HEIGHT)
        assertEquals(30, HevcEncoder.FRAME_RATE)
        assertEquals(8_000_000, HevcEncoder.BIT_RATE)
        assertEquals(1, HevcEncoder.GOP_INTERVAL_SEC)
    }
}
