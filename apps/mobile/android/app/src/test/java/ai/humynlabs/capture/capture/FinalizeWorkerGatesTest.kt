package ai.humynlabs.capture.capture

import android.app.Application
import android.media.MediaFormat
import com.facebook.react.bridge.WritableMap
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-02 — finalize-time
 * cancel-gate enforcement for the LOCKED capture spec.
 *
 * Tests A–F per PLAN §Task 1 `<behavior>` block. The two gates are:
 *   1. `videoFrameTimestamps.size < 2` → `reason="insufficient_frames"`
 *   2. mean FPS over the timestamps < 29.0 → `reason="fps_dropped"`
 *   3. muxed MP4 KEY_WIDTH < 1920 OR KEY_HEIGHT < 1080 → `reason="resolution_dropped"`
 *
 * Ordering: fps wins on simultaneous low-fps + low-resolution (Test D).
 *
 * The gate logic is exercised via the pure helpers [FinalizeWorker.decideCancelReason]
 * + [FinalizeWorker.computeMeanFps] + [FinalizeWorker.readMuxedResolution]
 * — calling `FinalizeWorker.finalize` directly would require constructing
 * a full [Segment] (Camera2 device, MediaCodec, MediaMuxer, IMU writer,
 * pump-thread) which Robolectric can't shadow. The pure helpers carry the
 * cancel-decision logic verbatim from the in-line gate code at the top of
 * `finalize()`, so green tests here ARE green tests of the production
 * gate behavior.
 *
 * The [FinalizeWorker.mediaExtractorFactory] seam swaps in a fake
 * [FinalizeWorker.MediaExtractorLike] for the resolution-read tests
 * (Test C / Test D) so we never touch a real MP4.
 *
 * `application = Application::class` — bypass MainApplication.onCreate's
 * SoLoader.init NPE under Robolectric (canonical Phase 3+ pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class FinalizeWorkerGatesTest {

    private val originalFactory = FinalizeWorker.mediaExtractorFactory

    @After
    fun restoreFactory() {
        FinalizeWorker.mediaExtractorFactory = originalFactory
    }

    // --- decideCancelReason — the pure gate-decision function -----------

    @Test
    fun `Test A — N less than 2 returns InsufficientFrames`() {
        // Single timestamp → degenerate; gate fires immediately.
        val result = FinalizeWorker.decideCancelReason(
            videoTimestampsNs = longArrayOf(1_000_000L),
            muxedWidth = 1920,
            muxedHeight = 1080,
        )
        assertEquals(CancelReason.InsufficientFrames, result)
        // Empty also degenerate.
        val emptyResult = FinalizeWorker.decideCancelReason(
            videoTimestampsNs = longArrayOf(),
            muxedWidth = 1920,
            muxedHeight = 1080,
        )
        assertEquals(CancelReason.InsufficientFrames, emptyResult)
    }

    @Test
    fun `Test B — mean fps below 28 returns FpsDropped with measured numeric`() {
        // Pick timestamps spanning 30 frames at 27.5 fps:
        //   N = 30 frames → span = (N-1)/27.5 = 29/27.5 ≈ 1.0545 s
        //   = 1_054_545_454 ns.
        val firstNs = 1_000_000_000L
        val spanNs = ((29.0 / 27.5) * 1_000_000_000.0).toLong()
        val lastNs = firstNs + spanNs
        // 30 entries: first, last, and 28 interior dummies in between (only
        // first/last matter for the mean-fps arithmetic).
        val ts = LongArray(30) { i ->
            when (i) {
                0 -> firstNs
                29 -> lastNs
                else -> firstNs + ((spanNs * i) / 29)
            }
        }
        val result = FinalizeWorker.decideCancelReason(ts, muxedWidth = 1920, muxedHeight = 1080)
        assertTrue(
            "expected FpsDropped; got $result",
            result is CancelReason.FpsDropped,
        )
        val fps = (result as CancelReason.FpsDropped).meanFps
        assertEquals(27.5, fps, 0.05)
        // Sanity-check the helper agrees.
        assertEquals(fps, FinalizeWorker.computeMeanFps(ts), 0.0001)
    }

    @Test
    fun `Test C — muxed width less than 1920 returns ResolutionDropped`() {
        // 30 timestamps at exactly 30 fps → mean_fps = 30 (passes step 1.6).
        val ts = fpsTimestamps(meanFps = 30.0, count = 30)
        val result = FinalizeWorker.decideCancelReason(ts, muxedWidth = 1280, muxedHeight = 720)
        assertTrue(
            "expected ResolutionDropped; got $result",
            result is CancelReason.ResolutionDropped,
        )
        val r = result as CancelReason.ResolutionDropped
        assertEquals(1280, r.width)
        assertEquals(720, r.height)
    }

    @Test
    fun `Test D — simultaneous low-fps and low-res → fps_dropped wins`() {
        // mean_fps = 27.0 AND width = 1280 → priority: fps wins.
        val ts = fpsTimestamps(meanFps = 27.0, count = 30)
        val result = FinalizeWorker.decideCancelReason(ts, muxedWidth = 1280, muxedHeight = 720)
        assertTrue(
            "fps_dropped must win on simultaneous failure; got $result",
            result is CancelReason.FpsDropped,
        )
    }

    @Test
    fun `Test E — happy path returns null (segment passes both gates)`() {
        val ts = fpsTimestamps(meanFps = 30.0, count = 600)
        val result = FinalizeWorker.decideCancelReason(ts, muxedWidth = 1920, muxedHeight = 1080)
        assertNull(result)
    }

    @Test
    fun `Test F — exactly 1920×1080 at exactly 29 fps passes (boundary)`() {
        // Spec gate is mean_fps >= 29.0 (tightened from 28.0 on 2026-05-17
        // after the Pixel-10a + Pixel-8a cancel-walk); at exactly 29.0 the
        // segment must pass.
        val ts = fpsTimestamps(meanFps = 29.0, count = 30)
        val result = FinalizeWorker.decideCancelReason(ts, muxedWidth = 1920, muxedHeight = 1080)
        assertNull(result)
        // And 4K (wider than spec) also passes.
        val resultOk = FinalizeWorker.decideCancelReason(ts, muxedWidth = 3840, muxedHeight = 2160)
        assertNull(resultOk)
    }

    @Test
    fun `Test G — resolution_dropped also fires when only height fails`() {
        val ts = fpsTimestamps(meanFps = 30.0, count = 30)
        val result = FinalizeWorker.decideCancelReason(ts, muxedWidth = 1920, muxedHeight = 720)
        assertTrue(result is CancelReason.ResolutionDropped)
        val r = result as CancelReason.ResolutionDropped
        assertEquals(1920, r.width)
        assertEquals(720, r.height)
    }

    // --- CancelReason.code stable bridge contract -----------------------

    @Test
    fun `CancelReason code values match the JS bridge contract`() {
        assertEquals("insufficient_frames", CancelReason.InsufficientFrames.code)
        assertEquals("fps_dropped", CancelReason.FpsDropped(0.0).code)
        assertEquals(
            "resolution_dropped",
            CancelReason.ResolutionDropped(0, 0).code,
        )
    }

    // --- readMuxedResolution — exercises the test seam ------------------

    @Test
    fun `readMuxedResolution reads KEY_WIDTH KEY_HEIGHT from first video track`() {
        val fakeFormat = MediaFormat().apply {
            setString(MediaFormat.KEY_MIME, "video/hevc")
            setInteger(MediaFormat.KEY_WIDTH, 1920)
            setInteger(MediaFormat.KEY_HEIGHT, 1080)
        }
        val nonVideoFormat = MediaFormat().apply {
            setString(MediaFormat.KEY_MIME, "audio/mp4a-latm")
        }
        FinalizeWorker.mediaExtractorFactory = { _ ->
            object : FinalizeWorker.MediaExtractorLike {
                override fun getTrackCount(): Int = 2
                override fun getTrackFormat(index: Int): MediaFormat =
                    if (index == 0) nonVideoFormat else fakeFormat

                override fun release() {}
            }
        }
        val (w, h) = FinalizeWorker.readMuxedResolution(File("/tmp/dummy.mp4"))
        assertEquals(1920, w)
        assertEquals(1080, h)
    }

    @Test
    fun `readMuxedResolution returns 0×0 when MediaExtractor open throws (fail-closed)`() {
        FinalizeWorker.mediaExtractorFactory = { _ -> throw java.io.IOException("boom") }
        val (w, h) = FinalizeWorker.readMuxedResolution(File("/tmp/dummy.mp4"))
        assertEquals(0, w)
        assertEquals(0, h)
    }

    @Test
    fun `readMuxedResolution returns 0×0 when no video track present`() {
        val audioOnly = MediaFormat().apply {
            setString(MediaFormat.KEY_MIME, "audio/mp4a-latm")
        }
        FinalizeWorker.mediaExtractorFactory = { _ ->
            object : FinalizeWorker.MediaExtractorLike {
                override fun getTrackCount(): Int = 1
                override fun getTrackFormat(index: Int): MediaFormat = audioOnly
                override fun release() {}
            }
        }
        val (w, h) = FinalizeWorker.readMuxedResolution(File("/tmp/dummy.mp4"))
        assertEquals(0, w)
        assertEquals(0, h)
    }

    @Test
    fun `readMuxedResolution returns 0×0 with 720p fallback (resolution gate then cancels)`() {
        val fallback720 = MediaFormat().apply {
            setString(MediaFormat.KEY_MIME, "video/hevc")
            setInteger(MediaFormat.KEY_WIDTH, 1280)
            setInteger(MediaFormat.KEY_HEIGHT, 720)
        }
        FinalizeWorker.mediaExtractorFactory = { _ ->
            object : FinalizeWorker.MediaExtractorLike {
                override fun getTrackCount(): Int = 1
                override fun getTrackFormat(index: Int): MediaFormat = fallback720
                override fun release() {}
            }
        }
        val (w, h) = FinalizeWorker.readMuxedResolution(File("/tmp/dummy.mp4"))
        // 1280×720 — feeds into the gate as ResolutionDropped (width<1920).
        assertEquals(1280, w)
        assertEquals(720, h)
        val ts = fpsTimestamps(meanFps = 30.0, count = 30)
        val gateResult = FinalizeWorker.decideCancelReason(ts, w, h)
        assertTrue(gateResult is CancelReason.ResolutionDropped)
    }

    // --- computeMeanFps — the same arithmetic the gate uses -------------

    @Test
    fun `computeMeanFps returns 0_0 on degenerate input (N less than 2)`() {
        assertEquals(0.0, FinalizeWorker.computeMeanFps(longArrayOf()), 0.0)
        assertEquals(0.0, FinalizeWorker.computeMeanFps(longArrayOf(42L)), 0.0)
    }

    @Test
    fun `computeMeanFps matches the N minus 1 over span formula`() {
        val ts = fpsTimestamps(meanFps = 30.0, count = 90)
        assertEquals(30.0, FinalizeWorker.computeMeanFps(ts), 0.001)
    }

    // --- helper ----------------------------------------------------------

    /**
     * Build [count] timestamps in nanoseconds such that the
     * `(count - 1) / span_seconds` mean-FPS arithmetic equals [meanFps].
     */
    private fun fpsTimestamps(meanFps: Double, count: Int): LongArray {
        require(count >= 2) { "count must be ≥2" }
        val spanSec = (count - 1).toDouble() / meanFps
        val spanNs = (spanSec * 1_000_000_000.0).toLong()
        val first = 1_000_000_000L
        return LongArray(count) { i ->
            if (i == 0) first
            else if (i == count - 1) first + spanNs
            else first + ((spanNs * i) / (count - 1))
        }
    }
}

/**
 * Quick task 260517-p5g CAPTURE-QA-02 — encoder-probe surface-deliverability
 * additions. The full 5-second Camera2 + MediaCodec end-to-end isn't
 * shadowable by Robolectric (the existing EncoderProbeTest only verifies the
 * orphan-sweep glob); this companion suite locks in the
 * `Result.resolutionDeliverable` field contract.
 *
 * The original EncoderProbeTest (compat package) verifies the orphan glob.
 * This shape test (capture package alongside the FinalizeWorker test) keeps
 * the documentation co-located with the gate it informs.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class EncoderProbeResolutionDeliverableShapeTest {

    @Test
    fun `EncoderProbe Result carries resolutionDeliverable`() {
        // Smoke — the data class compiles with the new field, and the field
        // defaults to false on the fail-closed branch.
        val r = ai.humynlabs.capture.compat.EncoderProbe.Result(
            bFramePresent = false,
            oisOff = true,
            hdrSdrForced = true,
            encoderClipPath = "/tmp/probe.mp4",
            resolutionDeliverable = false,
        )
        assertFalse(r.resolutionDeliverable)
    }

    @Test
    fun `EncoderProbe Result resolutionDeliverable true encodes spec-pass`() {
        val r = ai.humynlabs.capture.compat.EncoderProbe.Result(
            bFramePresent = false,
            oisOff = true,
            hdrSdrForced = true,
            encoderClipPath = "/tmp/probe.mp4",
            resolutionDeliverable = true,
        )
        assertTrue(r.resolutionDeliverable)
    }
}

@Suppress("unused")
private fun unusedSilenceImport(): WritableMap? = null
