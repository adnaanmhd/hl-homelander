package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for D-FS-05.
 *
 * Tests `SidecarManager` (per-segment `.session.json` round-trip:
 * write at segment-start, parse at finalize, parse at app-launch sweep
 * to re-finalize crashed segments; corrupt-JSON detection routes to
 * discard). Implementation lands in plan 03-05.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class SidecarManagerTest {
    @Test
    fun `D-FS-05 stub fails until SidecarManager ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-05.")
    }
}
