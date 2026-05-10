package ai.humynlabs.capture.fgs

import android.app.Application
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-04 Task 2b — Wave 0 stub for CAP-14 + D-FGS-01.
 *
 * Tests `HumynForegroundService` lifecycle:
 *  - service starts with foreground type `camera|microphone|dataSync`
 *    when `start()` fires
 *  - notification channel + notification rendered (low-priority,
 *    non-dismissible while service is running — Android system policy)
 *  - on `stop()`: if `setUploadActive(true)` has been called by Phase 5,
 *    downgrades to `dataSync`-only; otherwise the service stops.
 *
 * Implementation lands in plan 03-07. Plan 03-09 (HumynCaptureModule)
 * wires the start/stop calls; Plan 03-07 ships the service class
 * itself + the manifest `<service>` declaration.
 *
 * **`@Config(sdk = [34], application = Application::class)`:** Android 14
 * (API 34) introduced FGS strict-mode — the OS rejects service starts
 * whose foreground type bitmask doesn't match the manifest declaration
 * exactly. This stub pins SDK 34 (NOT 33 like the capture/ stubs)
 * because the strict-bitmask invariant is the test path Plan 03-07 will
 * exercise. `application = Application::class` mirrors Plan 03-04
 * Task 1's `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class HumynForegroundServiceTest {
    @Test
    fun `CAP-14 stub fails until HumynForegroundService ships`() {
        fail("MISSING — Wave 0 stub. Implementation lands in plan 03-07.")
    }
}
