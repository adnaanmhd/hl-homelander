package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-15.
 *
 * Tests `HashStreamer` (SHA-256 of MP4 + CSV at finalize, stamped into
 * metadata JSON as `file_sha256` / `imu_sha256`; verifies known hex
 * digest for the existing `hevc-fixtures/i-only.h265` and a synthetic
 * IMU CSV). Implementation lands in plan 03-05.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class HashStreamerTest {
    @Test
    fun `CAP-15 stub fails until HashStreamer ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-05.")
    }
}
