package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — JVM/CI coverage for
 * [CameraCalibrationReader].
 *
 * **On-hardware verification gap.** CameraCharacteristics cannot be
 * constructed on the JVM (no live Camera2 framework objects under
 * Robolectric), so genuine non-null intrinsics/extrinsics VALUES are a
 * MANUAL on-device smoke item. These tests verify:
 *   - the null-fallback contract (the path CI + most Pixels actually hit),
 *   - the pure math helpers (quaternion → rotation matrix, rigid inverse,
 *     intrinsic-array → params) on hand-supplied values,
 *   - the [CalibrationJson] round-trip + always-present fallback shape.
 *
 * `application = Application::class` — canonical Robolectric bypass for
 * `MainApplication.onCreate`'s SoLoader.init NPE (Phase 3+ pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class CameraCalibrationReaderTest {

    // ----------------------------------------------------------------
    // Null-fallback contract (T-elm-01) — never throws, full key set.
    // ----------------------------------------------------------------

    @Test
    fun `read(null, null) returns the uncalibrated fallback and never throws`() {
        val cal = CameraCalibrationReader.read(null, null)
        // Intrinsics — null params, uncalibrated source.
        assertEquals("pinhole", cal.camera.model)
        assertNull(cal.camera.fx)
        assertNull(cal.camera.fy)
        assertNull(cal.camera.cx)
        assertNull(cal.camera.cy)
        assertNull(cal.camera.skew)
        assertNull(cal.camera.distortionCoeffs)
        assertNull(cal.camera.resolutionWidth)
        assertNull(cal.camera.resolutionHeight)
        assertEquals("camera2_uncalibrated", cal.camera.intrinsicsSource)
        // Extrinsics — null matrices, no-imu-reference source, default timeshift.
        assertNull(cal.camImuExtrinsics.tCamImu)
        assertNull(cal.camImuExtrinsics.tImuCam)
        assertNull(cal.camImuExtrinsics.tCamImuTranslationMm)
        assertEquals(0.0, cal.camImuExtrinsics.timeshiftCamImuSec, 0.0)
        assertEquals("t_imu = t_cam + timeshift", cal.camImuExtrinsics.timeshiftMeaning)
        assertEquals("camera2_no_imu_reference", cal.camImuExtrinsics.extrinsicsSource)
    }

    // ----------------------------------------------------------------
    // Pure math — intrinsic array → params.
    // ----------------------------------------------------------------

    @Test
    fun `intrinsicArrayToParams maps fx fy cx cy skew`() {
        val p = CameraCalibrationReader.intrinsicArrayToParams(
            listOf(725.58, 725.26, 1006.06, 506.90, 0.0),
        )
        assertEquals(725.58, p.fx!!, 0.0001)
        assertEquals(725.26, p.fy!!, 0.0001)
        assertEquals(1006.06, p.cx!!, 0.0001)
        assertEquals(506.90, p.cy!!, 0.0001)
        assertEquals(0.0, p.skew!!, 0.0001)
    }

    @Test
    fun `intrinsicArrayToParams tolerates a 4-element array (no skew)`() {
        val p = CameraCalibrationReader.intrinsicArrayToParams(
            listOf(725.58, 725.26, 1006.06, 506.90),
        )
        assertEquals(725.58, p.fx!!, 0.0001)
        assertNull(p.skew)
    }

    @Test
    fun `intrinsicArrayToParams returns all-null for a too-short array`() {
        val p = CameraCalibrationReader.intrinsicArrayToParams(listOf(1.0, 2.0))
        assertNull(p.fx)
        assertNull(p.fy)
        assertNull(p.cx)
        assertNull(p.cy)
        assertNull(p.skew)
    }

    // ----------------------------------------------------------------
    // Pure math — quaternion → rotation matrix.
    // ----------------------------------------------------------------

    @Test
    fun `identity quaternion yields the identity rotation matrix`() {
        val r = CameraCalibrationReader.quaternionToRotationMatrix(0.0, 0.0, 0.0, 1.0)
        assertEquals(1.0, r[0][0], 1e-9)
        assertEquals(0.0, r[0][1], 1e-9)
        assertEquals(0.0, r[0][2], 1e-9)
        assertEquals(0.0, r[1][0], 1e-9)
        assertEquals(1.0, r[1][1], 1e-9)
        assertEquals(0.0, r[1][2], 1e-9)
        assertEquals(0.0, r[2][0], 1e-9)
        assertEquals(0.0, r[2][1], 1e-9)
        assertEquals(1.0, r[2][2], 1e-9)
    }

    @Test
    fun `90deg about z maps x-axis to y-axis`() {
        // q = (0,0,sin45,cos45) → rotate +90° about Z. A point on +X maps to +Y.
        val s = Math.sqrt(0.5)
        val r = CameraCalibrationReader.quaternionToRotationMatrix(0.0, 0.0, s, s)
        // R * [1,0,0]ᵀ = first column = [0, 1, 0].
        assertEquals(0.0, r[0][0], 1e-9)
        assertEquals(1.0, r[1][0], 1e-9)
        assertEquals(0.0, r[2][0], 1e-9)
    }

    @Test
    fun `zero-norm quaternion degrades to identity`() {
        val r = CameraCalibrationReader.quaternionToRotationMatrix(0.0, 0.0, 0.0, 0.0)
        assertEquals(1.0, r[0][0], 1e-9)
        assertEquals(1.0, r[1][1], 1e-9)
        assertEquals(1.0, r[2][2], 1e-9)
    }

    @Test
    fun `non-unit quaternion is normalized before matrix build`() {
        // (0,0,1,1) un-normalized — should normalize to the 90°-about-z result.
        val r = CameraCalibrationReader.quaternionToRotationMatrix(0.0, 0.0, 1.0, 1.0)
        assertEquals(0.0, r[0][0], 1e-9)
        assertEquals(1.0, r[1][0], 1e-9)
    }

    // ----------------------------------------------------------------
    // Pure math — homogeneous assembly + rigid inverse.
    // ----------------------------------------------------------------

    @Test
    fun `homogeneous packs rotation and translation into a 4x4`() {
        val rot = listOf(
            listOf(1.0, 0.0, 0.0),
            listOf(0.0, 1.0, 0.0),
            listOf(0.0, 0.0, 1.0),
        )
        val m = CameraCalibrationReader.homogeneous(rot, listOf(2.0, 3.0, 4.0))
        assertEquals(2.0, m[0][3], 1e-9)
        assertEquals(3.0, m[1][3], 1e-9)
        assertEquals(4.0, m[2][3], 1e-9)
        assertEquals(1.0, m[3][3], 1e-9)
        assertEquals(0.0, m[3][0], 1e-9)
    }

    @Test
    fun `invertRigid produces the correct inverse translation for identity rotation`() {
        val rot = listOf(
            listOf(1.0, 0.0, 0.0),
            listOf(0.0, 1.0, 0.0),
            listOf(0.0, 0.0, 1.0),
        )
        // Inverse of [I | t] is [I | -t].
        val inv = CameraCalibrationReader.invertRigid(rot, listOf(2.0, 3.0, 4.0))
        assertEquals(-2.0, inv[0][3], 1e-9)
        assertEquals(-3.0, inv[1][3], 1e-9)
        assertEquals(-4.0, inv[2][3], 1e-9)
        assertEquals(1.0, inv[0][0], 1e-9)
        assertEquals(1.0, inv[3][3], 1e-9)
    }

    // ----------------------------------------------------------------
    // CalibrationJson — always-present fallback + round-trip.
    // ----------------------------------------------------------------

    @Test
    fun `uncalibratedFallback emits the full key structure with null params`() {
        val json = CalibrationJson.uncalibratedFallback()
        val cam = json.getJSONObject("camera")
        assertEquals("camera2_uncalibrated", cam.getString("intrinsics_source"))
        assertEquals("pinhole", cam.getString("model"))
        org.junit.Assert.assertTrue(cam.isNull("resolution"))
        org.junit.Assert.assertTrue(cam.isNull("distortion_coeffs"))
        org.junit.Assert.assertTrue(cam.getJSONObject("params").isNull("fx"))
        val ext = json.getJSONObject("cam_imu_extrinsics")
        assertEquals("camera2_no_imu_reference", ext.getString("extrinsics_source"))
        org.junit.Assert.assertTrue(ext.isNull("T_cam_imu"))
        assertEquals(0.0, ext.getDouble("timeshift_cam_imu_sec"), 0.0)
    }

    @Test
    fun `CalibrationJson round-trips a calibrated value`() {
        val original = CameraCalibration(
            camera = CameraIntrinsics(
                model = "pinhole",
                resolutionWidth = 1920,
                resolutionHeight = 1080,
                fx = 725.58,
                fy = 725.26,
                cx = 1006.06,
                cy = 506.90,
                skew = 0.0,
                distortionCoeffs = listOf(0.027, 0.017, -0.011, 0.002),
                intrinsicsSource = "camera2",
            ),
            camImuExtrinsics = CamImuExtrinsics(
                tCamImu = listOf(
                    listOf(1.0, 0.0, 0.0, 0.01),
                    listOf(0.0, 1.0, 0.0, -0.08),
                    listOf(0.0, 0.0, 1.0, -0.05),
                    listOf(0.0, 0.0, 0.0, 1.0),
                ),
                tImuCam = null,
                tCamImuTranslationMm = listOf(10.0, -80.0, -50.0),
                timeshiftCamImuSec = 0.0,
                timeshiftMeaning = "t_imu = t_cam + timeshift",
                clockSyncNote = "camera + imu share the boottime (elapsedRealtimeNanos) clock",
                extrinsicsSource = "camera2",
            ),
        )
        val round = CalibrationJson.fromJson(CalibrationJson.toJson(original))!!
        assertEquals(725.58, round.camera.fx!!, 0.0001)
        assertEquals(1920, round.camera.resolutionWidth)
        assertEquals("camera2", round.camera.intrinsicsSource)
        assertEquals(4, round.camera.distortionCoeffs!!.size)
        assertEquals(0.01, round.camImuExtrinsics.tCamImu!![0][3], 0.0001)
        assertNull(round.camImuExtrinsics.tImuCam)
        assertEquals("camera2", round.camImuExtrinsics.extrinsicsSource)
    }

    @Test
    fun `CalibrationJson fromJson(null) returns null`() {
        assertNull(CalibrationJson.fromJson(null))
    }
}
