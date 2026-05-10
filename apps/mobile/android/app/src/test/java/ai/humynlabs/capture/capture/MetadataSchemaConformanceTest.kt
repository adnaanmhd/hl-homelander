package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-16.
 *
 * Tests `MetadataWriter` output conforms to the canonical
 * `video_metadata.json` schema bumped to `1.1.0`
 * (adds `imu_min_rate_hz_observed_p1` per D-IMU-02). Validates a
 * synthesized metadata JSON against the schema. Implementation lands
 * in plan 03-06.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class MetadataSchemaConformanceTest {
    @Test
    fun `CAP-16 stub fails until MetadataWriter + schema 1_1_0 ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-06.")
    }
}
