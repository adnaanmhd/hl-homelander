package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-04 + CAP-05.
 *
 * Tests `ImuWriter` CSV column format (`timestamp_ns,sensor_type,x,y,z`)
 * + sensor interleave by timestamp; native sensor units (rad/s gyro,
 * m/s² accel); no inline header units per `idea-brief.md §6.4 / §8.2`.
 * Implementation lands in plan 03-08.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ImuWriterCsvFormatTest {
    @Test
    fun `CAP-04 + CAP-05 stub fails until ImuWriter ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-08.")
    }
}
