package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-17.
 *
 * Tests `FilenameGenerator` (`YYYYMMDD_HHMMSS_NNN.<ext>` per
 * `idea-brief.md §8.1`; per-day NNN counter persists across restarts;
 * recovery via `ls recordings/`). Implementation lands in plan 03-05.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class FilenameGeneratorTest {
    @Test
    fun `CAP-17 stub fails until FilenameGenerator ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-05.")
    }
}
