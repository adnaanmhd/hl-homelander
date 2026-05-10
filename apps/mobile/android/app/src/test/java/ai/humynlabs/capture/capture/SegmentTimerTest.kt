package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-09.
 *
 * Tests `SegmentTimer` (`Handler.postDelayed` scheduling for the 10-min
 * auto-cut; Remote Config knob `capture.segment_minutes` default `10L`
 * per D-SEG-01). Implementation lands in plan 03-08.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class SegmentTimerTest {
    @Test
    fun `CAP-09 stub fails until SegmentTimer ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-08.")
    }
}
