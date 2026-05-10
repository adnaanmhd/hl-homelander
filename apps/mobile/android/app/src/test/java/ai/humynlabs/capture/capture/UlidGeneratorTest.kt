package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for ULID generator (internal
 * primitive; no specific CAP).
 *
 * Tests `UlidGenerator` (Crockford-base32 26-char ULID format +
 * monotonic ordering within the same millisecond — required by
 * D-API-02 per-segment `recordingId` and CAP-13 `sessionId`).
 * Implementation lands in plan 03-05.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class UlidGeneratorTest {
    @Test
    fun `ULID stub fails until UlidGenerator ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-05.")
    }
}
