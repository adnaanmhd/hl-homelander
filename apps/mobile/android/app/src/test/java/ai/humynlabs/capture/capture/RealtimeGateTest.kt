package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2a — Wave 0 stub for CAP-07.
 *
 * Tests `RealtimeGate` — `start()` reads
 * `CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE` and refuses
 * non-`REALTIME` devices (idea-brief.md §2.1; `±1 ms` cross-stream
 * alignment is impossible without REALTIME). Phase 2's compat probe
 * already enforces this at install time; this is the runtime
 * defense-in-depth. Implementation lands in plan 03-10.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class RealtimeGateTest {
    @Test
    fun `CAP-07 stub fails until RealtimeGate ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-10.")
    }
}
