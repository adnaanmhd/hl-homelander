package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-18.
 *
 * Tests files-never-re-encoded contract: SHA-256 invariance through
 * finalize → app-restart → re-finalize. The metadata-JSON re-finalize
 * path (D-FS-04 app-launch sweep) MUST NOT touch the MP4 / CSV bytes.
 * Implementation lands in plan 03-10.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class FileFidelityTest {
    @Test
    fun `CAP-18 stub fails until file-fidelity invariant ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-10.")
    }
}
