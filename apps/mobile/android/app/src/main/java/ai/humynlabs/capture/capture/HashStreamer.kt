package ai.humynlabs.capture.capture

import java.io.File
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.security.MessageDigest

/**
 * Phase 3 — streaming SHA-256 over a finalized MP4 / CSV via FileChannel
 * (Plan 03-05 Task 3; CAP-15, CAP-18).
 *
 * **CAP-15:** SHA-256 of MP4 + CSV at finalize, stamped into metadata
 * JSON as `file_sha256` / `imu_sha256` (Phase 1 backend wire shape).
 *
 * **CAP-18 hard rule:** files NEVER decoded / re-encoded / transcoded /
 * stripped. Read path is `FileChannel.open(file.toPath())` →
 * `ch.read(buf)` (standard pread; not mmap-write). The buffer is the
 * sole digest target; the file's bytes on disk are not touched.
 *
 * **Output shape:** lowercase-hex (64 chars) matching the wire shape
 * the Phase-1 backend already accepts (`recording.fileSha256`). Same
 * format as the Updater module's APK-fingerprint hash
 * (`HumynUpdaterModule.kt:73–98` uses
 * `joinToString("") { "%02x".format(it) }`). Phase 5 will reuse this
 * same lowercase-hex shape when sending the multipart-init request.
 *
 * **Throughput:** ~1.5 sec/GB on Snapdragon 7+ per `idea-brief.md §6.7`.
 * For a 600 MB segment, ~0.9 s — fits well within the 10-min interval
 * before the next segment fires (Pattern 2: concurrent finalize on a
 * worker thread). 64 KiB buffer is a sweet spot for FileChannel-driven
 * digestion (kernel page cache + JIT-friendly inner loop).
 */
object HashStreamer {
    private const val BUFFER_BYTES = 64 * 1024

    /**
     * Computes the SHA-256 of `file` in lowercase hex.
     *
     * @throws java.nio.file.NoSuchFileException if the file does not exist.
     * @throws java.io.IOException on read failures.
     */
    fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteBuffer.allocate(BUFFER_BYTES)
        FileChannel.open(file.toPath()).use { ch ->
            while (true) {
                buf.clear()
                if (ch.read(buf) < 0) break
                buf.flip()
                md.update(buf)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
