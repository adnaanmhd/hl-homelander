package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 03-05 Task 3 — `HashStreamer.sha256(file)` (CAP-15, CAP-18).
 *
 * Streaming SHA-256 over MP4/CSV via FileChannel (read-only). CAP-18:
 * files are NEVER decoded / re-encoded / transcoded / stripped.
 * Output: lowercase-hex matching the wire shape of `recording.fileSha256`
 * (Phase 1 backend wire shape; Phase 5 mediates the upload).
 *
 * Behavior contract (PLAN.md `<behavior>`):
 *  - SHA-256 of empty file = canonical zero-length digest.
 *  - SHA-256 of "abc" = canonical reference digest.
 *  - Same file hashed twice returns identical hex (idempotent).
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class HashStreamerTest {
    private val ctx = RuntimeEnvironment.getApplication()

    @Test
    fun `empty file SHA-256 matches canonical zero-length digest`() {
        val empty = File(ctx.cacheDir, "empty.bin").apply { writeBytes(byteArrayOf()) }
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            HashStreamer.sha256(empty),
        )
    }

    @Test
    fun `abc SHA-256 matches canonical digest`() {
        val abc = File(ctx.cacheDir, "abc.bin").apply { writeBytes("abc".toByteArray()) }
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            HashStreamer.sha256(abc),
        )
    }

    @Test
    fun `same file hashed twice returns same hex`() {
        val f = File(ctx.cacheDir, "1m.bin")
        val rng = ByteArray(1024 * 1024)
        java.util.Random(42).nextBytes(rng)
        f.writeBytes(rng)
        val h1 = HashStreamer.sha256(f)
        val h2 = HashStreamer.sha256(f)
        assertEquals(h1, h2)
        // 256 bits = 64 hex chars.
        assertEquals(64, h1.length)
    }
}
