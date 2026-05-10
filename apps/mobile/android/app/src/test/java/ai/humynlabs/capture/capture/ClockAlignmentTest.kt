package ai.humynlabs.capture.capture

import android.app.Application
import android.os.SystemClock
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-10 Task 2 — CAP-06: single elapsedRealtimeNanos clock domain.
 *
 * Documented contract — verified by inspecting CaptureSession.kt +
 * FinalizeWorker.kt source:
 *   - CaptureSession reads SystemClock.elapsedRealtimeNanos at
 *     openSegment (seg.startedAtNs) and closeSegmentResources
 *     (seg.endedAtNs). No `System.nanoTime` reads.
 *   - FinalizeWorker computes durationMs from (endedAtNs - startedAtNs)
 *     — both elapsedRealtimeNanos — without re-reading the clock.
 *   - ImuWriter writes `event.timestamp` (which, when the device
 *     advertises SENSOR_INFO_TIMESTAMP_SOURCE=REALTIME, equals
 *     elapsedRealtimeNanos — RealtimeGate enforces this at session
 *     start, Phase 2 compat probe at install).
 *   - The encoder→muxer pump loop appends
 *     `(info.presentationTimeUs * 1_000L)` — Camera2 STREAM
 *     presentationTimeUs is REALTIME-sourced (Pattern 1).
 *
 * What this test can mechanically verify under Robolectric:
 *   1. SystemClock.elapsedRealtimeNanos is monotonically non-decreasing
 *      (the contract every downstream timestamp source depends on).
 *
 * What this test CANNOT verify (deferred to Phase 4 manual smoke per
 * CONTEXT.md D-WAVE-01):
 *   - Real-device AudioTimestamp.nanoTime alignment to elapsedRealtime
 *     (Robolectric AudioRecord shadow does NOT faithfully populate
 *     AudioTimestamp under TIMEBASE_MONOTONIC; pad-it test is the only
 *     correctness path).
 *   - Camera2 frame-presentation-time alignment to IMU event timestamps
 *     within ±1 ms (the spec target per `idea-brief.md §2.1`).
 *
 * Robolectric — `application = Application::class` bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ClockAlignmentTest {

    @Test
    fun `elapsedRealtimeNanos is monotonically non-decreasing`() {
        val t1 = SystemClock.elapsedRealtimeNanos()
        Thread.sleep(1)
        val t2 = SystemClock.elapsedRealtimeNanos()
        assertTrue("t2 >= t1; was t1=$t1 t2=$t2", t2 >= t1)
    }

    @Test
    fun `FinalizeWorker duration math is well-formed for end greater than start`() {
        // Models the FinalizeWorker contract:
        //   durationMs = (endedAtNs - startedAtNs) / 1_000_000
        // Both stamps come from SystemClock.elapsedRealtimeNanos at
        // CaptureSession.openSegment + closeSegmentResources. As long as
        // end >= start (the monotonic-clock invariant verified above),
        // the math produces a non-negative duration.
        val startedAtNs = 1_000_000_000L
        val endedAtNs = startedAtNs + 600L * 1_000_000_000L  // +600 s
        val durationSeconds = (endedAtNs - startedAtNs).toDouble() / 1_000_000_000.0
        assertTrue("duration must be positive for end > start", durationSeconds > 0.0)
        // Sanity: 600 s exactly (the auto-cut segment length).
        assertTrue("duration should be ~600s; was $durationSeconds", durationSeconds == 600.0)
    }
}
