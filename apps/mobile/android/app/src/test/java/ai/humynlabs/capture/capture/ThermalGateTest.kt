package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-11 + CAP-12.
 *
 * Tests `ThermalGate` (pre-record `start()` refuses with
 * `thermal_throttling` when `≥ THROTTLING`; mid-record listener
 * subscribes via `PowerManager.OnThermalStatusChangedListener` and
 * fires a 2.5 s graceful stop on `≥ THROTTLING_SEVERE` per D-THERM-01).
 * Implementation lands in plan 03-07.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ThermalGateTest {
    @Test
    fun `CAP-11 + CAP-12 stub fails until ThermalGate ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-07.")
    }
}
