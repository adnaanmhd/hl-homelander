package ai.humynlabs.capture.capture

import android.app.Application
import android.hardware.camera2.CameraCharacteristics
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowCameraCharacteristics

/**
 * Plan 03-10 Task 1 — CAP-07: REALTIME-source pre-flight gate.
 *
 * `RealtimeGate.verify(chars)` reads
 * `CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE`. When the device
 * advertises `REALTIME` (the only source that aligns with
 * `SystemClock.elapsedRealtimeNanos`), the gate passes (no-throw). Any
 * other value (`UNKNOWN`) throws `RealtimeClockUnavailableException` —
 * `HumynCaptureModule.start()` maps this to the Promise reject
 * `{code: 'realtime_clock_unavailable'}` so the JS layer surfaces a
 * "device unsupported" toast and bails the user out of the recording
 * screen. Phase 2's compat probe already gates installable devices on
 * REALTIME; this is the runtime defense-in-depth.
 *
 * Uses Robolectric's `ShadowCameraCharacteristics.newCameraCharacteristics()`
 * + `set()` seam to populate `SENSOR_INFO_TIMESTAMP_SOURCE` without
 * pulling Mockito onto the test classpath (the project does not depend
 * on mockito-core or mockito-kotlin — verified against
 * `apps/mobile/android/app/build.gradle`).
 *
 * `application = Application::class` bypasses `MainApplication.onCreate`'s
 * SoLoader.init NPE — same pattern Plan 03-04 / 03-05 / etc. inherit.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class RealtimeGateTest {

    private fun charsWithTimestampSource(source: Int): CameraCharacteristics {
        val chars = ShadowCameraCharacteristics.newCameraCharacteristics()
        val shadow = Shadow.extract<ShadowCameraCharacteristics>(chars)
        shadow.set(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE, source)
        return chars
    }

    @Test
    fun `REALTIME source passes`() {
        val chars = charsWithTimestampSource(
            CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME,
        )
        // No-throw on REALTIME source.
        RealtimeGate.verify(chars)
    }

    @Test
    fun `UNKNOWN source throws RealtimeClockUnavailableException`() {
        val chars = charsWithTimestampSource(
            CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN,
        )
        assertThrows(RealtimeClockUnavailableException::class.java) {
            RealtimeGate.verify(chars)
        }
    }
}
