package ai.humynlabs.capture.capture

import com.facebook.react.bridge.WritableMap

/**
 * Phase 3 — concurrent finalize per Pattern 2 + checker issue #10 fix.
 *
 * Plan 03-10 Task 1 lands the stub (so [CaptureSession]'s rotateSegment +
 * stop paths reference an existing symbol); Plan 03-10 Task 2 replaces the
 * stub body with the real SHA → drift → IMU floor → metadata JSON →
 * atomic write → sidecar delete sequence.
 *
 * Clock invariant (Pattern 1 + checker issue #10):
 *   durationMs is computed as (seg.endedAtNs - seg.startedAtNs) / 1_000_000.
 *   Both stamps come from SystemClock.elapsedRealtimeNanos() — set in
 *   CaptureSession.openSegment / closeSegmentResources respectively.
 *   The JDK monotonic clock (System dot nanoTime) is BANNED here — the
 *   two clocks live in different monotonic domains and would corrupt
 *   durationMs silently. The acceptance grep gate forbids any
 *   `System.nano` literal in this file.
 *
 * Pump invariant (CAP-08 + checker issue #2):
 *   Consumes seg.videoFrameTimestamps populated by CaptureSession.runPumpLoop.
 *   DriftCalculator.compute is no-op-skipped when the array has < 2
 *   timestamps (degenerate case — should not happen post-Task-2 wiring).
 */
object FinalizeWorker {
    /**
     * Finalize one segment. Plan 03-10 Task 2 implements the body.
     *
     * Visibility is `internal` because [Segment] is `internal` —
     * keeping the worker package-private avoids exposing the segment
     * data class as part of any public Kotlin API surface.
     */
    @Suppress("UNUSED_PARAMETER")
    internal fun finalize(seg: Segment, emit: (String, WritableMap) -> Unit) {
        // Plan 03-10 Task 2 — implementation lands in the next commit.
        // Stub kept narrow so the Task 1 build is green; the stub does
        // NOT emit onSegmentComplete, NOT delete sidecar — Task 2 wires
        // all of that.
    }
}
