package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-01.
 *
 * Tests HEVC encoder config audit: `MediaFormat` keys produce zero-B-frame
 * Annex B (`KEY_LATENCY=1` + `KEY_MAX_B_FRAMES=0`, GOP 30, HEVC Main /
 * 8 Mbps CBR / 1080p 30 FPS per `idea-brief.md §2.1`). Reuses the
 * existing `apps/mobile/android/app/src/test/resources/hevc-fixtures/`
 * directory (`ibp.h265`, `i-only.h265`) introduced by Phase 2 plan 02-12
 * NalParser test work. Implementation lands in plan 03-08.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class HevcEncoderConfigTest {
    @Test
    fun `CAP-01 stub fails until HevcEncoderConfig ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-08.")
    }
}
