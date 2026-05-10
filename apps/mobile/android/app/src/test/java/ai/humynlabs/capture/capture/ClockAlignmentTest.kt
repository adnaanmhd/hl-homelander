package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-06.
 *
 * Tests single-clock domain across video / audio / IMU
 * (`SystemClock.elapsedRealtimeNanos` everywhere; ±1 ms drift target
 * per `idea-brief.md §2.1` / §6.5). Verifies the synthesized timestamp
 * arrays produced by the writers all use the same monotonic source.
 * Implementation lands in plan 03-10.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ClockAlignmentTest {
    @Test
    fun `CAP-06 stub fails until clock alignment ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-10.")
    }
}
