package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-19.
 *
 * Tests `ImuRateObserver` (sliding-window-1s p1 over inter-sample
 * intervals → `imu_min_rate_hz_observed_p1` for the metadata JSON
 * schema 1.1.0 bump). Implementation lands in plan 03-05.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ImuRateObserverTest {
    @Test
    fun `CAP-19 stub fails until ImuRateObserver ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-05.")
    }
}
