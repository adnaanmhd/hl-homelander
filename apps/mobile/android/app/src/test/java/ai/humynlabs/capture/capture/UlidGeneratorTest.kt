package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-05 Task 2 — `UlidGenerator.next()` minter (Crockford-base32 26-char
 * ULID; D-API-02 per-segment recordingId / segmentId / sessionId).
 *
 * 48-bit ms time prefix (10 chars Crockford base32) + 80-bit randomness
 * (16 chars Crockford base32). Cross-validates against the backend's
 * npm `ulid` package by construction (both follow ULID spec §4).
 *
 * Behavior contract (PLAN.md `<behavior>`):
 *  - next() returns exactly 26-char string.
 *  - 100 sequential calls produce unique strings (uniqueness; monotonicity
 *    inside a ms is library-guaranteed).
 *  - All chars lie in Crockford base32 alphabet (0-9, A-H, J-K, M-N, P-T, V-Z).
 *  - Time prefix decodes to wallclock-ms within ~5 ms.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class UlidGeneratorTest {

    private val crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

    @Test
    fun `next returns 26 char string`() {
        assertEquals(26, UlidGenerator.next().length)
    }

    @Test
    fun `100 sequential calls are unique`() {
        val ids = (0 until 100).map { UlidGenerator.next() }
        assertEquals(100, ids.toSet().size)
    }

    @Test
    fun `all chars in Crockford base32 alphabet`() {
        val alphabet = crockfordAlphabet.toSet()
        for (i in 0 until 100) {
            val id = UlidGenerator.next()
            for (c in id) {
                assertTrue("char '$c' in '$id' not in Crockford alphabet", c in alphabet)
            }
        }
    }

    @Test
    fun `time prefix matches wallclock within reasonable bound`() {
        val before = System.currentTimeMillis()
        val id = UlidGenerator.next()
        val after = System.currentTimeMillis()
        val timeChars = id.substring(0, 10)
        var v = 0L
        for (c in timeChars) {
            val idx = crockfordAlphabet.indexOf(c)
            assertTrue("time-prefix char '$c' not in Crockford alphabet", idx >= 0)
            v = (v shl 5) or idx.toLong()
        }
        // 50 ms window — generous to absorb scheduler jitter on CI.
        assertTrue(
            "ULID time prefix $v outside [${before - 50}, ${after + 50}]",
            v in (before - 50)..(after + 50)
        )
    }
}
