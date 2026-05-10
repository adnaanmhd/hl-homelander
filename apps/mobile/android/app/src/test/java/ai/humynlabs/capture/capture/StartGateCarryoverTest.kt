package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-10.
 *
 * Tests `start_gate` block from `start(opts)` carries forward across
 * auto-segment cuts via the `.session.json` sidecar (D-FS-05) — the
 * hand-gate does NOT re-run at auto-segment cuts. Implementation lands
 * in plan 03-10.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class StartGateCarryoverTest {
    @Test
    fun `CAP-10 stub fails until start_gate carryover ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-10.")
    }
}
