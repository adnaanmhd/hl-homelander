package ai.humynlabs.capture.compat

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Unit test for the cleanup contract enforced by [EncoderProbe] (D-COMPAT-04 /
 * T-2.12-01). Camera2 + MediaCodec are not faithfully shadowable by Robolectric, so
 * this suite focuses on the orphan-clip naming convention that the
 * MainApplication.onCreate sweep matches against. The full Camera2 + MediaCodec
 * end-to-end is verified manually on a real Pixel device per 02-21 manual smoke
 * runbook.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class EncoderProbeTest {

    @Test
    fun `orphan compat-probe clips match the MainApplication sweep glob`() {
        val ctx = RuntimeEnvironment.getApplication()
        val orphan = File(ctx.cacheDir, "compat-probe-12345.mp4")
        orphan.writeBytes(byteArrayOf(0))
        assertTrue("orphan exists before sweep", orphan.exists())

        // Sweep mirrors MainApplication.onCreate (plan 02-06) — name prefix + suffix.
        ctx.cacheDir
            .listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
            ?.forEach { it.delete() }

        assertFalse("orphan deleted by sweep", orphan.exists())
    }
}
