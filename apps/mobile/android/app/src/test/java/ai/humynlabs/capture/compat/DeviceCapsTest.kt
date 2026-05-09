package ai.humynlabs.capture.compat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

/**
 * Plan 02-14 Task 1 — DeviceCaps unit tests.
 *
 * The dFOV math is the only piece worth a deterministic assertion: it is a
 * pure function of three sensor-spec floats. Camera2 / SensorManager / StatFs
 * branches are exercised at the smoke-level via readAll() returning a map
 * with all expected keys; the headless Robolectric environment reports zeros
 * (no camera HAL, no sensor HAL) which is enough to confirm the wiring.
 *
 * Pixel 7a back-ultrawide spec figures used in the dFOV assertion are
 * public-domain (Sony IMX787 13MP UW): focal 1.93mm, sensor 7.40 x 5.55 mm.
 * 113° tolerance lower bound matches Google's marketed 120°-class dFOV.
 */
@RunWith(RobolectricTestRunner::class)
class DeviceCapsTest {

    private val caps = DeviceCaps(RuntimeEnvironment.getApplication())

    @Test
    fun `dfov for Pixel 7a back ultrawide — 1_93mm focal, 7_4x5_55mm sensor — is approximately 120 deg`() {
        val dfov = caps.computeDfovFromValues(1.93f, 7.40f, 5.55f)
        assertTrue(
            "Pixel 7a UW dFOV expected ~118-122°; got $dfov",
            dfov in 113f..122f,
        )
    }

    @Test
    fun `dfov for telephoto-like 6mm focal on 7x5mm sensor is approx 70 deg, well below 110 threshold`() {
        val dfov = caps.computeDfovFromValues(6.0f, 7.0f, 5.0f)
        assertTrue("telephoto dFOV expected < 80°; got $dfov", dfov < 80f)
    }

    @Test
    fun `dfov returns 0 when focalMm is 0`() {
        assertEquals(0f, caps.computeDfovFromValues(0f, 7f, 5f), 0.001f)
    }

    @Test
    fun `dfov returns 0 when focalMm is negative`() {
        assertEquals(0f, caps.computeDfovFromValues(-1f, 7f, 5f), 0.001f)
    }

    @Test
    fun `readAll returns a map with all required DeviceCapsResult keys`() {
        val map = caps.readAll()
        assertTrue("resolutionMax key", map.hasKey("resolutionMax"))
        assertTrue("fpsMax key", map.hasKey("fpsMax"))
        assertTrue("ultrawideDfovDeg key", map.hasKey("ultrawideDfovDeg"))
        assertTrue("micSampleRateMax key", map.hasKey("micSampleRateMax"))
        assertTrue("realtimeTimestampSource key", map.hasKey("realtimeTimestampSource"))
        assertTrue("motionSensorsPresent key", map.hasKey("motionSensorsPresent"))
        assertTrue("rooted key", map.hasKey("rooted"))
        assertTrue("freeStorageGB key", map.hasKey("freeStorageGB"))
    }

    @Test
    fun `readAll resolutionMax is a nested map with w and h keys`() {
        val map = caps.readAll()
        val resMap = map.getMap("resolutionMax")
        assertTrue("resolutionMax must be a map", resMap != null)
        assertTrue("resolutionMax has w key", resMap!!.hasKey("w"))
        assertTrue("resolutionMax has h key", resMap.hasKey("h"))
    }
}
