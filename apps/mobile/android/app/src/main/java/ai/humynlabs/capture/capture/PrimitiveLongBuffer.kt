package ai.humynlabs.capture.capture

import java.util.concurrent.atomic.AtomicInteger

/**
 * Phase 3 / debug session `humyncapture-imu-oom-rollover` — primitive-
 * backed, allocation-free, single-writer / single-reader-snapshot timestamp
 * buffer. Replaces `MutableList<Long>` (`ImuWriter.timestampList`) and
 * `CopyOnWriteArrayList<Long>` (`Segment.videoFrameTimestamps`) on the
 * recording hot path.
 *
 * **Why this exists.** Both call sites added a primitive `long` value to a
 * boxed `Long` collection — `MutableList<Long>` boxes on every `add`,
 * `CopyOnWriteArrayList<Long>` boxes on every `add` AND copies the entire
 * backing `Object[]` on every `add` (O(n²) write cost + O(n²) garbage
 * generation for n adds). At sustained ~800–934 Hz combined IMU + 30 fps
 * video × 10-min segments × 7 segments of continuous capture, the cumulative
 * autoboxing and COW array-copy churn saturated the 256 MB Dalvik growth
 * limit and the process force-closed at the framework's next
 * `Integer.valueOf` allocation inside
 * `SystemSensorManager$SensorEventQueue.dispatchSensorEvent`. The framework
 * allocation site was just the next thing to ask for memory — the actual
 * pressure source was our boxed collections. Repro on Pixel 10a / Android 16
 * crashed in the 7th 10-min segment (≈60 min cumulative); Pixel 8a survived
 * the same walk by luck.
 *
 * **Contract.**
 *   - Single writer (the sensor `HandlerThread` for IMU; the encoder pump
 *     `HandlerThread` for video frame timestamps).
 *   - Many readers via [toLongArray] which takes a memory-model-correct
 *     snapshot of every sample written so far.
 *   - Pre-allocated `LongArray` capacity covers a full segment + headroom.
 *     `IMU_CAPACITY` = 600 s × 1100 Hz with safety margin; `VIDEO_CAPACITY` =
 *     30 fps × 720 s safety margin. If a segment ever overruns capacity
 *     (segment duration override pushed past safety margin), [add] drops the
 *     extra sample rather than re-allocating — the drift methodology
 *     tolerates a few dropped samples (max/mean/p99 over thousands), and an
 *     over-capacity segment is itself a misconfiguration the operator should
 *     see in the next manual smoke.
 *
 * **Memory profile.**
 *   - `IMU_CAPACITY = 660_000` longs × 8 bytes = 5.28 MB allocated once at
 *     segment start, never grows, released when the segment is GC'd.
 *   - `VIDEO_CAPACITY = 21_600` longs × 8 bytes = 173 KB ditto.
 *   - Total per active segment: ~5.5 MB vs. the previous ~80 MB of boxed
 *     `Long` heap residency + multi-GB of allocate-then-collect COW garbage.
 *
 * **Memory-model correctness.** The write index ([writeIndex]) is an
 * `AtomicInteger`, and the `LongArray` slot is written BEFORE the index is
 * incremented. Readers in [toLongArray] read the index first (acquire
 * semantics via `AtomicInteger.get()`), then read slots `[0, size)`. The
 * happens-before relationship the JMM provides for `AtomicInteger` ensures a
 * reader that observes `writeIndex.get() == n` observes all slot writes from
 * indices `0..n-1`. Single-writer guarantees no torn writes.
 *
 * **Why not `LongAdder` / streaming counter?** Both call sites need the
 * actual timestamp values at finalize, not just a count. A primitive
 * `LongArray` keeps the values without boxing.
 */
internal class PrimitiveLongBuffer(capacity: Int) {

    companion object {
        /**
         * IMU buffer capacity — sized for a 10-min segment at ≥1000 Hz
         * combined gyro+accel rate with ~10% safety margin.
         * idea-brief.md §2.1 specifies ≥100 Hz floor; the Pixel 10a /
         * Pixel 8a manual-smoke walks observed ~800–934 Hz combined.
         * 1100 Hz × 600 s = 660 000 samples.
         */
        const val IMU_CAPACITY: Int = 660_000

        /**
         * Video frame timestamp capacity — sized for a 10-min segment at
         * 30 fps with 20% safety margin (covers a brief segment duration
         * override or a Remote Config bump up to 12 min). 30 × 720 = 21 600.
         */
        const val VIDEO_CAPACITY: Int = 21_600
    }

    private val buf: LongArray = LongArray(capacity)
    private val writeIndex: AtomicInteger = AtomicInteger(0)

    /**
     * Append one timestamp. Single-writer; never reallocates. Drops the
     * sample (returns false) if the buffer is at capacity — see the class
     * doc's "If a segment ever overruns capacity" note.
     */
    fun add(value: Long): Boolean {
        val idx = writeIndex.get()
        if (idx >= buf.size) return false
        // Write the slot BEFORE publishing the new index. The reader's
        // `writeIndex.get()` happens-before serves as the memory barrier
        // that makes the slot write visible.
        buf[idx] = value
        writeIndex.set(idx + 1)
        return true
    }

    /**
     * Current observed size. Safe to call from any thread; reads
     * [writeIndex] with acquire semantics.
     */
    val size: Int get() = writeIndex.get()

    /**
     * Snapshot copy of the buffer's used prefix. Allocates a fresh
     * `LongArray` of length [size]. Safe to call from any thread.
     */
    fun toLongArray(): LongArray {
        val n = writeIndex.get()
        // arraycopy on a single-writer source after an AtomicInteger.get()
        // is JMM-safe — the get() established a happens-before edge with
        // every prior slot write.
        val out = LongArray(n)
        System.arraycopy(buf, 0, out, 0, n)
        return out
    }
}
