package ai.humynlabs.capture.capture

import java.security.SecureRandom
import java.util.concurrent.atomic.AtomicLong

/**
 * Phase 3 — Crockford base32 ULID minter (Plan 03-05 Task 2).
 *
 * 26-char output: 48-bit ms-time prefix (10 chars Crockford base32) +
 * 80-bit randomness (16 chars Crockford base32). ULID spec § canonical
 * form. Cross-validates against the backend's npm `ulid` package by
 * construction (both libraries follow the same spec).
 *
 * Hand-rolled instead of pulling `io.azam.ulidj` because:
 *   - Single-class, ~80-line implementation; no surface to monitor for
 *     supply-chain drift.
 *   - SecureRandom is the JDK randomness source either way.
 *   - Avoids adding a third-party Maven dep for one minter.
 *
 * **Monotonicity within a ms** (ULID spec §4): when two `next()` calls
 * fall in the same millisecond, the random component of the second call
 * is the random component of the first plus 1. This ensures lexicographic
 * sort matches insertion order inside a ms.
 *
 * Thread-safety: `AtomicLong` for the last-time bucket + `synchronized`
 * for the random-state read-modify-write keeps the monotonicity invariant
 * intact under contention. Phase 3's only caller is the segment-rotate
 * handler on `captureExecutor` (single-thread), so contention is
 * structurally impossible — the synchronization is defense-in-depth.
 */
object UlidGenerator {
    /** Crockford base32 alphabet, RFC 4648 §6 with the canonical ULID
     *  modifications (excludes I, L, O, U to avoid confusion with 1/0/V). */
    private const val CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

    private val rng = SecureRandom()
    private val lastTime = AtomicLong(-1L)
    private val lastRandom = ByteArray(10)
    private val lock = Any()

    /**
     * Returns a new 26-char Crockford-base32 ULID. Monotonic within a
     * single millisecond.
     */
    fun next(): String {
        val now = System.currentTimeMillis()
        val randomBytes = ByteArray(10)
        synchronized(lock) {
            val prev = lastTime.get()
            if (now == prev) {
                // Same-ms call: increment last random by 1 (ULID spec §4).
                System.arraycopy(lastRandom, 0, randomBytes, 0, 10)
                incrementRandom(randomBytes)
            } else {
                rng.nextBytes(randomBytes)
                lastTime.set(now)
            }
            System.arraycopy(randomBytes, 0, lastRandom, 0, 10)
        }
        return encodeTime(now) + encodeRandom(randomBytes)
    }

    /** Encodes the 48-bit ms-time into 10 Crockford base32 chars. */
    private fun encodeTime(timeMs: Long): String {
        val sb = CharArray(10)
        var t = timeMs
        for (i in 9 downTo 0) {
            sb[i] = CROCKFORD_BASE32[(t and 0x1F).toInt()]
            t = t ushr 5
        }
        return String(sb)
    }

    /** Encodes the 80-bit random component into 16 Crockford base32 chars. */
    private fun encodeRandom(bytes: ByteArray): String {
        // 80 bits = 16 base32 chars; pack 5 bits at a time MSB-first.
        require(bytes.size == 10) { "random component must be 10 bytes" }
        val out = CharArray(16)
        // Treat the 10 bytes as a big-endian 80-bit number; carve into
        // 16 × 5-bit groups starting from the high end.
        var bitBuf = 0L
        var bitsInBuf = 0
        var byteIdx = 0
        for (i in 0 until 16) {
            // Refill bit buffer to ≥ 5 bits.
            while (bitsInBuf < 5 && byteIdx < bytes.size) {
                bitBuf = (bitBuf shl 8) or (bytes[byteIdx].toLong() and 0xFF)
                bitsInBuf += 8
                byteIdx++
            }
            val shift = bitsInBuf - 5
            val idx = ((bitBuf ushr shift) and 0x1F).toInt()
            out[i] = CROCKFORD_BASE32[idx]
            bitsInBuf -= 5
            // Mask off the consumed top bits so they don't leak into the
            // next iteration's shift.
            bitBuf = bitBuf and ((1L shl bitsInBuf) - 1)
        }
        return String(out)
    }

    /**
     * Increments a 10-byte big-endian counter in place (ULID spec §4
     * monotonicity within a ms). On overflow (vanishingly unlikely with
     * 80 bits), regenerates fresh randomness.
     */
    private fun incrementRandom(bytes: ByteArray) {
        for (i in bytes.size - 1 downTo 0) {
            val v = (bytes[i].toInt() and 0xFF) + 1
            bytes[i] = (v and 0xFF).toByte()
            if (v <= 0xFF) return  // no carry; done
        }
        // Full overflow: spec allows new random + same ms. Vanishingly
        // unlikely (would need 2⁸⁰ ULIDs in a single ms).
        rng.nextBytes(bytes)
    }
}
