package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-13.
 *
 * Tests `HumynCaptureModule` event emission: `onSessionStart` /
 * `onSessionStop` (D-API-03 + the upload-pause signal Phase 5 will
 * consume per D-UPL-01); also covers `onSegmentStart` /
 * `onSegmentComplete` per D-API-03. Implementation lands in plan 03-10.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class EventEmissionTest {
    @Test
    fun `CAP-13 stub fails until event emission ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-10.")
    }
}
