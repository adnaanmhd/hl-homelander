package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper
import java.time.Duration
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
 * SegmentTimer uses a real `HandlerThread`. Robolectric runs all
 * loopers in PAUSED mode by default (the post-4.0 idiomatic mode);
 * runnables only execute when the test explicitly idles the looper.
 * We use `Shadows.shadowOf(timer.threadLooperForTest()).idleFor(...)`
 * to advance the timer thread's scheduled callbacks deterministically.
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
            timer.scheduleNext(60_000L) { fires.incrementAndGet() }
            // Advance the timer's dedicated HandlerThread looper by
            // exactly 60 s. Robolectric's PAUSED looper mode runs
            // delayed Runnables synchronously when the looper is
            // idled past their post time.
            Shadows.shadowOf(timer.threadLooperForTest())
                .idleFor(Duration.ofMillis(60_000L))
            ShadowLooper.idleMainLooper()
            assertEquals(1, fires.get())
            // Advance an extra minute — onCut MUST NOT fire again.
            Shadows.shadowOf(timer.threadLooperForTest())
                .idleFor(Duration.ofMillis(60_000L))
            assertEquals(1, fires.get())
        } finally {
            timer.release()
        }
    }

    @Test
    fun `scheduleNext does not fire before durationMs`() {
        val timer = SegmentTimer()
        try {
            val fires = AtomicInteger(0)
            timer.scheduleNext(60_000L) { fires.incrementAndGet() }
            // Advance only 30 s — short of the 60 s deadline.
            Shadows.shadowOf(timer.threadLooperForTest())
                .idleFor(Duration.ofMillis(30_000L))
            assertEquals(0, fires.get())
            assertTrue(timer.isPending())
        } finally {
            timer.release()
        }
    }

    @Test
    fun `cancel before fire prevents onCut`() {
        val timer = SegmentTimer()
        try {
            val fires = AtomicInteger(0)
            timer.scheduleNext(60_000L) { fires.incrementAndGet() }
            assertTrue("scheduleNext should mark a pending callback", timer.isPending())
            timer.cancel()
            assertFalse("cancel should clear the pending callback", timer.isPending())
            // Advance well past the original deadline; nothing fires.
            Shadows.shadowOf(timer.threadLooperForTest())
                .idleFor(Duration.ofMillis(120_000L))
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
            timer.scheduleNext(120_000L) { firesA.incrementAndGet() }
            assertTrue(timer.isPending())
            // Reschedule B with a short delay — replaces A.
            timer.scheduleNext(10_000L) { firesB.incrementAndGet() }
            // Advance past B's deadline but not A's original deadline.
            Shadows.shadowOf(timer.threadLooperForTest())
                .idleFor(Duration.ofMillis(20_000L))
            assertEquals("B should fire exactly once", 1, firesB.get())
            // Advance past A's original deadline.
            Shadows.shadowOf(timer.threadLooperForTest())
                .idleFor(Duration.ofMillis(120_000L))
            assertEquals("A should not fire — replaced by B", 0, firesA.get())
            assertEquals("B should still fire only once", 1, firesB.get())
        } finally {
            timer.release()
        }
    }

    @Test
    fun `release is idempotent after fire`() {
        val timer = SegmentTimer()
        val fires = AtomicInteger(0)
        timer.scheduleNext(10_000L) { fires.incrementAndGet() }
        Shadows.shadowOf(timer.threadLooperForTest())
            .idleFor(Duration.ofMillis(10_000L))
        assertEquals(1, fires.get())
        timer.release()
        // Calling release a second time must not throw.
        timer.release()
        assertFalse(timer.isPending())
    }

    @Test
    fun `release before fire cancels pending`() {
        val timer = SegmentTimer()
        val fires = AtomicInteger(0)
        timer.scheduleNext(60_000L) { fires.incrementAndGet() }
        assertTrue(timer.isPending())
        timer.release()
        assertFalse(timer.isPending())
        // Looper is dead — verify no fire even if we try to advance
        // a fresh timer that re-uses some shared state. (Defensive
        // assertion — there is no shared state, but the contract is
        // explicit about release semantics.)
        assertEquals(0, fires.get())
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
