package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import java.security.MessageDigest

/**
 * Plan 03-10 Task 2 — CAP-18: files NEVER re-encoded / re-decoded /
 * transcoded / stripped contract.
 *
 * The training pipeline expects the encoder's exact bytes (timestamps,
 * tags, every metadata box) to arrive at S3 byte-for-byte unchanged.
 * Finalize is allowed to:
 *   - Read the file (FileChannel.read; no writes to MP4/CSV).
 *   - Compute SHA-256 (digest does not modify the source).
 * Finalize is NOT allowed to:
 *   - Open the file `rw` / mmap-write.
 *   - Re-encode / re-mux / strip metadata boxes.
 *   - Touch the file mtime / atime.
 *
 * What this test mechanically verifies:
 *   1. HashStreamer.sha256 produces identical digests on repeated calls
 *      (read-only contract).
 *   2. The on-disk bytes are unchanged after a SHA pass — readBytes()
 *      returns the original buffer byte-for-byte.
 *   3. The digest length is the canonical lowercase-hex SHA-256
 *      shape (64 chars).
 *
 * What this test CANNOT cover (deferred to Phase 4 manual smoke):
 *   - Real Camera2 + MediaCodec → muxer → finalize round-trip; verified
 *     by 60-min smoke walk + mp4parser inspection on a Pixel 10a.
 *
 * Robolectric — `application = Application::class` bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class FileFidelityTest {

    private val ctx = RuntimeEnvironment.getApplication()

    @Test
    fun `SHA-256 invariant across two reads`() {
        val f = File(ctx.cacheDir, "fidelity-${System.currentTimeMillis()}.bin")
        val rng = ByteArray(1024 * 1024)
        java.util.Random(42).nextBytes(rng)
        f.writeBytes(rng)
        try {
            val h1 = HashStreamer.sha256(f)
            val h2 = HashStreamer.sha256(f)
            assertEquals("two SHA passes must return identical digests", h1, h2)
            assertEquals("SHA-256 lowercase-hex is 64 chars", 64, h1.length)
            assertTrue(
                "digest must be lowercase hex",
                h1.all { c -> c.isDigit() || c in 'a'..'f' },
            )
        } finally {
            f.delete()
        }
    }

    @Test
    fun `file bytes are unchanged after a SHA-256 pass`() {
        val f = File(ctx.cacheDir, "fidelity-bytes-${System.currentTimeMillis()}.bin")
        val original = ByteArray(4096)
        java.util.Random(99).nextBytes(original)
        f.writeBytes(original)
        try {
            HashStreamer.sha256(f)
            val readBack = f.readBytes()
            assertArrayEquals(
                "SHA-256 path must NOT modify the source bytes (CAP-18)",
                original,
                readBack,
            )
        } finally {
            f.delete()
        }
    }

    @Test
    fun `HashStreamer matches MessageDigest reference for a known fixture`() {
        // Sanity check that the streaming digest equals the all-at-once
        // digest for a synthetic fixture. Catches a future refactor
        // that mis-positions the ByteBuffer between reads.
        val f = File(ctx.cacheDir, "fidelity-ref-${System.currentTimeMillis()}.bin")
        val bytes = "humynlabs-capture-CAP-18-fixture".toByteArray(Charsets.UTF_8)
        f.writeBytes(bytes)
        try {
            val expected = MessageDigest
                .getInstance("SHA-256")
                .digest(bytes)
                .joinToString("") { "%02x".format(it) }
            assertEquals(expected, HashStreamer.sha256(f))
        } finally {
            f.delete()
        }
    }
}
