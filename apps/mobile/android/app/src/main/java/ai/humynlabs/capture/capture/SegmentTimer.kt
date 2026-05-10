package ai.humynlabs.capture.capture

import android.os.Handler
import android.os.HandlerThread

/**
 * Phase 3 CAP-09 — 10-min auto-segment timer.
 *
 * D-SEG-01: the Kotlin module owns the segment timer (NOT JS). Posts
 * the cut callback on a dedicated HandlerThread so the encoder /
 * IMU pipeline never blocks on the timer post.
 *
 * Duration is read by Plan 03-09 from Firebase Remote Config
 * `capture.segment_minutes` (default 10L). SegmentTimer accepts a
 * pre-computed durationMs to keep its contract narrow — no Remote
 * Config reads inside this class; CaptureSession does the lookup
 * once at session start and re-passes for each rotation.
 *
 * Lifecycle:
 *   - construct: start the HandlerThread.
 *   - scheduleNext(durationMs, onCut): cancel any pending callback,
 *     post onCut after durationMs.
 *   - cancel(): remove the pending callback (idempotent).
 *   - release(): cancel + quitSafely the HandlerThread (idempotent).
 */
class SegmentTimer {
    private val thread = HandlerThread("HumynCapture-Segment").apply { start() }
    private val handler = Handler(thread.looper)
    private var pending: Runnable? = null

    /**
     * Schedule the next auto-cut. Cancels any in-flight pending
     * callback. The supplied [onCut] runs on the timer's
     * HandlerThread; CaptureSession posts onto its own recording-
     * thread Handler if it needs to act on the recording-thread.
     */
    fun scheduleNext(durationMs: Long, onCut: () -> Unit) {
        cancel()
        val r = Runnable {
            // Clear `pending` BEFORE invoking onCut so a re-schedule
            // inside the callback doesn't get clobbered by this
            // Runnable's own completion path.
            pending = null
            onCut()
        }
        pending = r
        handler.postDelayed(r, durationMs)
    }

    /** Remove the pending callback; idempotent. */
    fun cancel() {
        pending?.let { handler.removeCallbacks(it) }
        pending = null
    }

    /**
     * Cancel the pending callback and tear down the HandlerThread.
     * Idempotent. After release(), scheduleNext() is undefined
     * behavior (the looper is dead) — callers should construct a
     * new SegmentTimer if they need another segment cycle.
     */
    fun release() {
        cancel()
        thread.quitSafely()
    }

    /** Visible for tests — true while a Runnable is queued. */
    fun isPending(): Boolean = pending != null

    /**
     * Visible-for-tests accessor for the underlying HandlerThread's
     * Looper. Robolectric runs loopers in PAUSED mode by default —
     * tests use this Looper handle with `Shadows.shadowOf(looper)
     * .idleFor(Duration)` to advance scheduled callbacks
     * deterministically. Production callers MUST NOT use this seam
     * for behavior — the timer's HandlerThread is an implementation
     * detail.
     */
    fun threadLooperForTest(): android.os.Looper = thread.looper
}
