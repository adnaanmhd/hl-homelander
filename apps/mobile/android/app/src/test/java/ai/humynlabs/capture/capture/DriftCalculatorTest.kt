package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-08.
 *
 * Tests `DriftCalculator` (drift `{max, mean, p99}` from synthetic
 * timestamp arrays per `idea-brief.md §6.5` least-squares
 * residual-subtraction). Implementation lands in plan 03-05; this stub
 * exists so the executor of plan 03-05 can flip MISSING → GREEN in a
 * single-task commit and the per-task feedback latency stays under the
 * Nyquist threshold.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class DriftCalculatorTest {
    @Test
    fun `CAP-08 stub fails until DriftCalculator ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-05.")
    }
}
