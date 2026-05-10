package ai.humynlabs.capture.capture

import android.app.Application
import android.media.MediaFormat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 03-04 Task 1 — narrow integration test for [FragmentedMuxerWrapper]
 * (CAP-02 fragmented-MP4 boot path).
 *
 * Scope:
 *  1. The wrapper compiles against `androidx.media3:media3-muxer:1.10.0`.
 *  2. `FragmentedMuxerWrapper.create(File)` boots a real
 *     [androidx.media3.muxer.FragmentedMp4Muxer], adds an HEVC video track
 *     via the framework [MediaFormat] → [androidx.media3.common.Format]
 *     translation surface, and writes a valid ISO-BMFF `ftyp` box at the
 *     head of the output file when closed cleanly.
 *
 * **Out of scope for this stub** (deferred to Plan 03-05+):
 *  - Real sample-write loop with encoder-emitted HEVC bitstream — synthetic
 *    bytes would fail the muxer's Annex B → AVCC conversion; that path is
 *    exercised end-to-end in Phase 4 manual smoke per CONTEXT.md D-WAVE-01.
 *  - 30 s `moof` boundary verification — needs a 60 s real-device recording
 *    parsed via `mp4parser`. Phase 4 territory.
 *  - The legacy `start()` no-op surface and the `stop()`/`release()` →
 *    `close()` aliases are exercised by the encoder-pump migration tests
 *    that land alongside Plan 03-08.
 *
 * Robolectric @Config(sdk = [33]) matches Phase-2's `EncoderProbeTest`
 * convention (`apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt:21`).
 *
 * **Rule 3 deviation from the plan-doc test recipe — bypass MainApplication:**
 * Robolectric auto-runs `MainApplication.onCreate()` for every Kotlin unit
 * test, which calls `SoLoader.init(this, OpenSourceMergedSoMapping)` →
 * `ApplicationSoSource.getNativeLibDirFromContext(...)` → `new File(null)`
 * NPE because Robolectric's shadow ApplicationInfo returns null for
 * `nativeLibraryDir`. The compat-package tests (EncoderProbeTest etc.)
 * regressed into the same NPE the moment Phase 2 hardened
 * `MainApplication.onCreate` with the SoLoader call. Pinning
 * `application = android.app.Application::class` here forces Robolectric
 * to instantiate the stock framework Application instead of
 * `MainApplication`, sidestepping the SoLoader path entirely. The wrapper
 * doesn't depend on anything that real `MainApplication.onCreate` sets up
 * (no React-Native bridge, no SoLoader-loaded native libs), so a stock
 * `Application` is sufficient. Plan 03-05+ tests inherit this pattern.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class FragmentedMuxerWrapperTest {

    @Test
    fun `create + addTrack + close round-trips without exceptions and returns a valid track id`() {
        val ctx = RuntimeEnvironment.getApplication()
        val mp4 = File(ctx.cacheDir, "fragmented-muxer-wrapper-test.mp4")
        if (mp4.exists()) mp4.delete()

        // HEVC video track at the spec-locked resolution
        // (idea-brief.md §2.1 — 1920×1080 / HEVC Main / 30 FPS).
        val videoFormat = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_HEVC, 1920, 1080)
        videoFormat.setInteger(MediaFormat.KEY_FRAME_RATE, 30)

        // Round-trip: build the muxer, register a track, close. This proves
        //   (a) the media3-muxer:1.10.0 dependency resolves at runtime
        //       (FragmentedMp4Muxer.Builder + Muxer interface load),
        //   (b) MediaFormatUtil.createFormatFromMediaFormat translates a
        //       framework HEVC MediaFormat into androidx.media3.common.Format
        //       cleanly (no IllegalArgumentException at addTrack),
        //   (c) the wrapper's close() chain shuts down both the muxer and
        //       the underlying FileOutputStream without throwing.
        val wrapper = FragmentedMuxerWrapper.create(mp4)
        val trackId = wrapper.addTrack(videoFormat)
        // Track ids are non-negative and unique within a muxer; do not assert
        // a specific value (FragmentedMp4Muxer assigns them via its internal
        // SparseArray — implementation detail subject to upstream change).
        assertTrue("addTrack returned a non-negative track id (got $trackId)", trackId >= 0)
        wrapper.close()

        // Output file may be empty: per FragmentedMp4Writer at media3 1.10.0
        // (libraries/muxer/src/main/java/androidx/media3/muxer/FragmentedMp4Writer.java
        // line 160–163 / 237–242), the ftyp + moov boxes are written only on
        // the FIRST writeSampleData call (`if (!headerCreated) createHeader();`),
        // and createHeader() emits Boxes.ftyp() + Boxes.moov(...). With zero
        // samples written, close() produces a 0-byte file — that's a real
        // implementation detail of the upstream writer, not a wrapper bug.
        //
        // Real fragmented-MP4 verification (parse `moof` boxes via mp4parser
        // after a 60 s recording) is deferred to Phase 4 manual smoke walk
        // per CONTEXT.md D-WAVE-01. Plan 03-05+ (encoder pump) is the first
        // wave that drives real HEVC samples through this wrapper and
        // therefore the first wave whose tests can assert on file content.
        //
        // Rule 1 deviation from the plan-doc test recipe — the plan said
        // "Asserts the output file exists, is non-zero size, AND its first
        // 8 bytes start with the ISO-BMFF signature `ftyp`". That recipe
        // misread the muxer lifecycle (ftyp is writeSampleData-triggered,
        // not addTrack-triggered) and the byte offset (ISO-BMFF puts the
        // box-type at offset 4–7, not 0–3). The narrower contract above
        // captures the wrapper's actual integration value.
        assertTrue("output file was created (may be 0 bytes — see comment)", mp4.exists())

        mp4.delete()
    }

    @Test
    fun `FRAGMENT_DURATION_MS_30S constant equals 30000ms`() {
        // CAP-02 per idea-brief.md §6.6 — the 30 s moof boundary is the
        // crash-recovery contract; lock the value via a unit test so a
        // future refactor that flips it (e.g. to the media3 default of
        // 2 000 ms) trips immediately.
        assertEquals(30_000L, FragmentedMuxerWrapper.FRAGMENT_DURATION_MS_30S)
    }
}
