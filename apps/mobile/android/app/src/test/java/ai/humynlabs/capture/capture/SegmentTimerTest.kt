package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.atomic.AtomicInteger

/**
 * Plan 03-08 Task 2 — CAP-09 SegmentTimer.
 *
 * Locks the 10-min auto-segment timer's contract per D-SEG-01:
 *   - scheduleNext(durationMs, onCut) posts onCut via Handler.postDelayed
 *     on a dedicated HandlerThread.
 *   - cancel() removes the pending callback.
 *   - scheduleNext() replaces an in-flight pending callback.
 *
 * SegmentTimer uses a real `HandlerThread`; Robolectric's main looper
 * shadows do NOT advance the dedicated HandlerThread's looper. We
 * therefore exercise the timer with short real-time durations (50–
 * 300 ms) under a polling-with-timeout pattern, which matches the
 * pattern Plan 03-08 PLAN.md's `<action>` 2D recommends and what the
 * worktree's CI already supports (the same-shape pattern is used in
 * Phase 2 EncoderProbeTest's HandlerThread-driven integration).
 *
 * The 10-min production duration is exercised by Plan 03-10 +
 * Phase 4's manual smoke (real-device + real-time). The unit tests
 * here pin the contract surface the orchestrator binds to.
 *
 * `application = Application::class` matches Plan 03-04's pattern.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class SegmentTimerTest {

    @Test
    fun `scheduleNext fires onCut exactly once after durationMs`() {
        val timer = SegmentTimer()
        try {
            val fires = AtomicInteger(0)
            timer.scheduleNext(50L) { fires.incrementAndGet() }
            // Wait up to 1 s for the dedicated HandlerThread to
            // dispatch — generous headroom on a CI runner.
            val t0 = System.currentTimeMillis()
            while (System.currentTimeMillis() - t0 < 1_000 && fires.get() == 0) {
                Thread.sleep(10)
            }
            assertEquals(1, fires.get())
            // Wait an extra 100 ms to confirm the timer fires exactly once.
            Thread.sleep(100)
            assertEquals(1, fires.get())
        } finally {
            timer.release()
        }
    }

    @Test
    fun `cancel before fire prevents onCut`() {
        val timer = SegmentTimer()
        try {
            val fires = AtomicInteger(0)
            timer.scheduleNext(300L) { fires.incrementAndGet() }
            assertTrue("scheduleNext should mark a pending callback", timer.isPending())
            timer.cancel()
            assertFalse("cancel should clear the pending callback", timer.isPending())
            // Sleep past the original deadline; nothing should fire.
            Thread.sleep(400)
            assertEquals(0, fires.get())
        } finally {
            timer.release()
        }
    }

    @Test
    fun `scheduleNext replaces previous pending callback`() {
        val timer = SegmentTimer()
        try {
            val firesA = AtomicInteger(0)
            val firesB = AtomicInteger(0)
            // Schedule A with a long delay.
            timer.scheduleNext(500L) { firesA.incrementAndGet() }
            assertTrue(timer.isPending())
            // Reschedule B with a short delay — should replace A,
            // not fire alongside it.
            timer.scheduleNext(50L) { firesB.incrementAndGet() }
            // Wait long enough for B to fire and past A's would-have-
            // been-fired deadline.
            val t0 = System.currentTimeMillis()
            while (System.currentTimeMillis() - t0 < 1_000 && firesB.get() == 0) {
                Thread.sleep(10)
            }
            // Sleep past A's original deadline.
            Thread.sleep(600)
            assertEquals("A should not fire — replaced by B", 0, firesA.get())
            assertEquals("B should fire exactly once", 1, firesB.get())
        } finally {
            timer.release()
        }
    }

    @Test
    fun `release after fire is idempotent`() {
        val timer = SegmentTimer()
        val fires = AtomicInteger(0)
        timer.scheduleNext(50L) { fires.incrementAndGet() }
        val t0 = System.currentTimeMillis()
        while (System.currentTimeMillis() - t0 < 1_000 && fires.get() == 0) {
            Thread.sleep(10)
        }
        timer.release()
        // Calling release a second time must not throw.
        timer.release()
        assertFalse(timer.isPending())
    }

    @Test
    fun `isPending is false initially`() {
        val timer = SegmentTimer()
        try {
            assertFalse(timer.isPending())
        } finally {
            timer.release()
        }
    }
}
