package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-03.
 *
 * Tests AAC-LC encoder `MediaFormat` config audit: 48 kHz mono 128 kbps
 * AAC-LC per `idea-brief.md §2.1` / §6.3. Implementation lands in plan
 * 03-08.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class AacEncoderConfigTest {
    @Test
    fun `CAP-03 stub fails until AacEncoderConfig ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-08.")
    }
}
