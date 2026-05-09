package ai.humynlabs.capture.compat

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for [NalParser]. Robolectric is used so the test runs on the host JVM
 * but inherits the same Android resources / assets pipeline that ships the binary
 * `.h265` fixtures from `src/test/resources/hevc-fixtures/`. The parser itself does
 * not depend on the Android framework — Robolectric is here for the resource loader
 * + `includeAndroidResources = true` wiring (plan 02-02).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class NalParserTest {

    private fun loadFixture(name: String): ByteArray {
        val stream = javaClass.classLoader!!.getResourceAsStream("hevc-fixtures/$name")
            ?: throw IllegalStateException("missing fixture hevc-fixtures/$name")
        return stream.use { it.readBytes() }
    }

    @Test
    fun `i-only fixture has no B-slices`() {
        val parser = NalParser()
        val slices = parser.parse(loadFixture("i-only.h265"))
        assertFalse("i-only fixture must not contain B-slices", parser.anyBFrames(slices))
    }

    @Test
    fun `ibp fixture contains a B-slice`() {
        val parser = NalParser()
        val slices = parser.parse(loadFixture("ibp.h265"))
        assertTrue("ibp fixture should contain at least one B-slice", parser.anyBFrames(slices))
    }

    @Test
    fun `empty bitstream returns no slices`() {
        val parser = NalParser()
        val slices = parser.parse(byteArrayOf())
        assertFalse(parser.anyBFrames(slices))
    }

    @Test
    fun `bitstream with no start codes returns no slices`() {
        val parser = NalParser()
        val slices = parser.parse(byteArrayOf(0xAA.toByte(), 0xBB.toByte(), 0xCC.toByte()))
        assertFalse(parser.anyBFrames(slices))
    }
}
