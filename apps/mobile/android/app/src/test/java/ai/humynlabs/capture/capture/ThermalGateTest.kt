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
 * **Coverage:**
 *   - `preFlight()` (CAP-11) — succeeds while status is below `THROTTLING`
 *     (NONE / LIGHT / MODERATE), fails with `ThermalRefuseException` at
 *     `THROTTLING` and above (SEVERE / CRITICAL / EMERGENCY / SHUTDOWN).
 *   - `subscribeMidRecord(onSevere)` (CAP-12) — fires the callback only
 *     when the OS-driven status reaches `SEVERE` or above; ignored on
 *     LIGHT / MODERATE / THROTTLING.
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
@Config(sdk = [33], application = Application::class)
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

    /** Drain main looper + give the gate's single-thread executor a moment to dispatch. */
    private fun drain() {
        shadowOf(Looper.getMainLooper()).idle()
        Thread.sleep(150)
    }

    // ── preFlight() — CAP-11 ───────────────────────────────────────────────

    @Test
    fun `preFlight succeeds when thermal status NONE`() {
        setStatus(PowerManager.THERMAL_STATUS_NONE)
        assertTrue(gate.preFlight().isSuccess)
    }

    @Test
    fun `preFlight succeeds when thermal status MODERATE`() {
        setStatus(PowerManager.THERMAL_STATUS_MODERATE)
        assertTrue(gate.preFlight().isSuccess)
    }

    @Test
    fun `preFlight fails with ThermalRefuseException at THROTTLING (CAP-11)`() {
        setStatus(PowerManager.THERMAL_STATUS_SEVERE)
        // ShadowPowerManager doesn't expose THERMAL_STATUS_THROTTLING as a separate
        // constant in API 33 — it routes status callbacks via the same int. The
        // contract is "≥ THROTTLING" (which the AOSP source defines as the same
        // value that fires throttling callbacks). Using SEVERE here exercises the
        // ≥ THROTTLING branch and SEVERE is also documented to refuse pre-flight.
        val r = gate.preFlight()
        assertTrue("preFlight must fail at SEVERE (≥ THROTTLING)", r.isFailure)
        val e = r.exceptionOrNull()
        assertTrue("expected ThermalRefuseException", e is ThermalRefuseException)
        assertEquals(PowerManager.THERMAL_STATUS_SEVERE, (e as ThermalRefuseException).currentStatus)
        assertEquals("thermal_throttling", e.message)
    }

    @Test
    fun `preFlight fails when status is CRITICAL`() {
        setStatus(PowerManager.THERMAL_STATUS_CRITICAL)
        assertTrue(gate.preFlight().isFailure)
    }

    // ── subscribeMidRecord() — CAP-12 ──────────────────────────────────────

    @Test
    fun `subscribeMidRecord fires onSevere when status reaches SEVERE`() {
        @Volatile var fired: Int? = null
        val sub = gate.subscribeMidRecord { status -> fired = status }
        setStatus(PowerManager.THERMAL_STATUS_SEVERE)
        drain()
        assertNotNull("onSevere should have fired", fired)
        assertEquals(PowerManager.THERMAL_STATUS_SEVERE, fired)
        sub.close()
    }

    @Test
    fun `subscribeMidRecord does NOT fire on MODERATE`() {
        @Volatile var fired: Int? = null
        val sub = gate.subscribeMidRecord { status -> fired = status }
        setStatus(PowerManager.THERMAL_STATUS_MODERATE)
        drain()
        assertNull("onSevere must NOT fire below SEVERE", fired)
        sub.close()
    }

    @Test
    fun `close unregisters the listener (no leak)`() {
        @Volatile var fired: Int? = null
        val sub = gate.subscribeMidRecord { status -> fired = status }
        sub.close()
        // After close, even a SEVERE event must NOT fire the callback.
        setStatus(PowerManager.THERMAL_STATUS_SEVERE)
        drain()
        assertNull("listener removed before SEVERE; callback must not fire", fired)
    }
}
