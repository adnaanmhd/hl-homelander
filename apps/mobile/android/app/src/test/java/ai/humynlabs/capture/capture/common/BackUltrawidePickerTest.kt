package ai.humynlabs.capture.capture.common

import android.app.Application
import android.content.Context
import android.hardware.camera2.CameraManager
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Plan 03-08 Task 3 — verifies the extracted shared util.
 *
 * Robolectric's headless ShadowCameraManager reports `cameraIdList`
 * = empty (no camera HAL). The picker MUST return `null` cleanly
 * — same null-safety behavior the original
 * `DeviceCaps.pickBackUltrawide` exercised before the extract.
 *
 * The original `DeviceCapsTest` covered this path via
 * `caps.readAll()` checking that `resolutionMax.{w,h}` and
 * `ultrawideDfovDeg` collapse to 0 when no camera is found.
 * After the extract, the same null path runs through
 * `BackUltrawidePicker.pick(mgr)`; this test pins it directly.
 *
 * `application = Application::class` matches the Phase 3 stub
 * pattern — bypasses MainApplication.onCreate's SoLoader.init NPE
 * under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class BackUltrawidePickerTest {

    @Test
    fun `pick returns null when no cameras present`() {
        val ctx = RuntimeEnvironment.getApplication()
        val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val pick = BackUltrawidePicker.pick(mgr)
        assertNull(
            "Robolectric reports cameraIdList = empty; picker must return null",
            pick,
        )
    }
}
