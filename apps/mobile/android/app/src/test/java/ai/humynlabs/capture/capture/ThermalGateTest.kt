package ai.humynlabs.capture.capture

import android.app.Application
import android.content.Context
import android.os.Looper
import android.os.PowerManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Plan 03-07 — flips the Plan 03-04 Wave 0 stub for CAP-11 + CAP-12 to GREEN.
 *
 * **Threshold mapping** (see `ThermalGate.kt` KDoc — Plan 03-07 Rule 1 deviation):
 * AOSP has no `THERMAL_STATUS_THROTTLING` constant; the plan's project
 * semantics map to:
 *   - `THROTTLING` (pre-flight refuse) → `THERMAL_STATUS_MODERATE`
 *   - `THROTTLING_SEVERE` (mid-record graceful stop) → `THERMAL_STATUS_SEVERE`
 *
 * **Coverage:**
 *   - `preFlight()` (CAP-11) — succeeds at NONE / LIGHT, fails with
 *     `ThermalRefuseException` at MODERATE and above.
 *   - `subscribeMidRecord(onSevere)` (CAP-12) — fires the callback only
 *     when the OS-driven status reaches `SEVERE` or above; ignored on
 *     LIGHT / MODERATE.
 *   - `AutoCloseable` — `close()` unregisters the listener so subsequent
 *     status changes don't fire the callback.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 *
 * `sdk = 33`: `PowerManager.OnThermalStatusChangedListener` and
 * `getCurrentThermalStatus()` ship from API 29. SDK 33 keeps the test on
 * the same baseline as the rest of the Phase 3 capture/ stubs.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class ThermalGateTest {

    private val ctx get() = RuntimeEnvironment.getApplication()
    private lateinit var gate: ThermalGate

    @Before
    fun setup() {
        gate = ThermalGate(ctx)
    }

    /** Drive the shadow PowerManager's thermal-status state. */
    private fun setStatus(status: Int) {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        shadowOf(pm).setCurrentThermalStatus(status)
    }

    /**
     * Drain main looper. The gate uses the single-arg
     * `addThermalStatusListener(listener)` overload — `ShadowPowerManager`
     * synchronously invokes registered listeners from `setCurrentThermalStatus`
     * (verified by disassembling shadows-framework-4.16.1.jar), so no executor
     * settle-time is needed.
     */
    private fun drain() {
        shadowOf(Looper.getMainLooper()).idle()
    }

    // ── preFlight() — CAP-11 ───────────────────────────────────────────────

    @Test
    fun `preFlight succeeds when thermal status NONE`() {
        setStatus(PowerManager.THERMAL_STATUS_NONE)
        assertTrue(gate.preFlight().isSuccess)
    }

    @Test
    fun `preFlight succeeds when thermal status LIGHT`() {
        setStatus(PowerManager.THERMAL_STATUS_LIGHT)
        assertTrue(gate.preFlight().isSuccess)
    }

    @Test
    fun `preFlight fails with ThermalRefuseException at MODERATE (CAP-11)`() {
        setStatus(PowerManager.THERMAL_STATUS_MODERATE)
        val r = gate.preFlight()
        assertTrue("preFlight must fail at MODERATE (≥ project-semantic THROTTLING)", r.isFailure)
        val e = r.exceptionOrNull()
        assertTrue("expected ThermalRefuseException", e is ThermalRefuseException)
        assertEquals(PowerManager.THERMAL_STATUS_MODERATE, (e as ThermalRefuseException).currentStatus)
        assertEquals("thermal_throttling", e.message)
    }

    @Test
    fun `preFlight fails when status is SEVERE`() {
        setStatus(PowerManager.THERMAL_STATUS_SEVERE)
        assertTrue(gate.preFlight().isFailure)
    }

    @Test
    fun `preFlight fails when status is CRITICAL`() {
        setStatus(PowerManager.THERMAL_STATUS_CRITICAL)
        assertTrue(gate.preFlight().isFailure)
    }

    // ── subscribeMidRecord() — CAP-12 ──────────────────────────────────────

    @Test
    fun `subscribeMidRecord fires onSevere when status reaches SEVERE`() {
        val fired = java.util.concurrent.atomic.AtomicReference<Int?>(null)
        val sub = gate.subscribeMidRecord { status -> fired.set(status) }
        setStatus(PowerManager.THERMAL_STATUS_SEVERE)
        drain()
        assertNotNull("onSevere should have fired", fired.get())
        assertEquals(PowerManager.THERMAL_STATUS_SEVERE, fired.get())
        sub.close()
    }

    @Test
    fun `subscribeMidRecord does NOT fire on MODERATE`() {
        val fired = java.util.concurrent.atomic.AtomicReference<Int?>(null)
        val sub = gate.subscribeMidRecord { status -> fired.set(status) }
        setStatus(PowerManager.THERMAL_STATUS_MODERATE)
        drain()
        assertNull("onSevere must NOT fire below SEVERE", fired.get())
        sub.close()
    }

    @Test
    fun `close unregisters the listener (no leak)`() {
        val fired = java.util.concurrent.atomic.AtomicReference<Int?>(null)
        val sub = gate.subscribeMidRecord { status -> fired.set(status) }
        sub.close()
        // After close, even a SEVERE event must NOT fire the callback.
        setStatus(PowerManager.THERMAL_STATUS_SEVERE)
        drain()
        assertNull("listener removed before SEVERE; callback must not fire", fired.get())
    }
}
