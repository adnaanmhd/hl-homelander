package ai.humynlabs.capture.capture

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Regression tests for [PrimitiveLongBuffer] — the allocation-free
 * timestamp buffer introduced by debug session
 * `humyncapture-imu-oom-rollover` (2026-05-18) to replace the boxed
 * `MutableList<Long>` and `CopyOnWriteArrayList<Long>` on the recording
 * hot path.
 */
class PrimitiveLongBufferTest {
    @Test
    fun `empty buffer reports size 0 and empty array`() {
        val b = PrimitiveLongBuffer(16)
        assertEquals(0, b.size)
        assertArrayEquals(LongArray(0), b.toLongArray())
    }

    @Test
    fun `add returns true and snapshot reflects all writes in order`() {
        val b = PrimitiveLongBuffer(8)
        assertTrue(b.add(10L))
        assertTrue(b.add(20L))
        assertTrue(b.add(30L))
        assertEquals(3, b.size)
        assertArrayEquals(longArrayOf(10L, 20L, 30L), b.toLongArray())
    }

    @Test
    fun `add at capacity returns false and does not overrun`() {
        val b = PrimitiveLongBuffer(2)
        assertTrue(b.add(1L))
        assertTrue(b.add(2L))
        // Buffer is full; third add must drop the sample.
        assertFalse(b.add(3L))
        assertEquals(2, b.size)
        assertArrayEquals(longArrayOf(1L, 2L), b.toLongArray())
    }

    @Test
    fun `snapshot is a copy not a view`() {
        val b = PrimitiveLongBuffer(8)
        b.add(100L)
        b.add(200L)
        val snap = b.toLongArray()
        // Mutate the snapshot.
        snap[0] = -999L
        // The buffer's own contents are unaffected.
        assertArrayEquals(longArrayOf(100L, 200L), b.toLongArray())
    }

    /**
     * Memory-model regression: a single writer and a reader running on
     * separate threads must agree on a consistent prefix snapshot. The
     * `AtomicInteger.get()` happens-before edge guarantees every reader
     * that observes `size == n` observes the slot values for indices
     * `0..n-1`. This test runs the writer hot for a while and snapshots
     * mid-stream from another thread; the snapshot must equal `[0..n-1]`
     * for the observed `n` (no torn writes, no out-of-order slot reads).
     */
    @Test
    fun `concurrent reader sees consistent prefix snapshot`() {
        val N = 50_000
        val b = PrimitiveLongBuffer(N)
        val exec = Executors.newFixedThreadPool(2)
        val ready = CountDownLatch(1)
        val writerDone = CountDownLatch(1)
        var readerFailed: Throwable? = null

        exec.submit {
            ready.countDown()
            try {
                for (i in 0 until N) {
                    b.add(i.toLong())
                }
            } finally {
                writerDone.countDown()
            }
        }

        exec.submit {
            ready.await()
            try {
                // Take ~200 snapshots while writer is in flight; each one
                // must be a consistent prefix of [0..n-1] for whatever n
                // the snapshot reports.
                for (round in 0 until 200) {
                    val snap = b.toLongArray()
                    for (i in snap.indices) {
                        check(snap[i] == i.toLong()) {
                            "torn snapshot at round=$round idx=$i value=${snap[i]} (expected $i)"
                        }
                    }
                }
            } catch (t: Throwable) {
                readerFailed = t
            }
        }

        assertTrue(writerDone.await(10, TimeUnit.SECONDS))
        exec.shutdown()
        assertTrue(exec.awaitTermination(5, TimeUnit.SECONDS))

        readerFailed?.let { throw AssertionError("reader saw torn snapshot", it) }

        // Final snapshot is the full [0..N-1] sequence.
        val finalSnap = b.toLongArray()
        assertEquals(N, finalSnap.size)
        assertEquals(0L, finalSnap.first())
        assertEquals((N - 1).toLong(), finalSnap.last())
    }
}
