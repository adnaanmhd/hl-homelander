package ai.humynlabs.capture.capture

/**
 * Phase 3 D-IMU-01/02 — sliding-window-1s p1 sample rate (Hz) for the
 * `imu_min_rate_hz_observed_p1` metadata field (Plan 03-05 Task 1).
 *
 * `imu_min_rate_hz_observed_p1` = 1st percentile of per-window sample
 * rates over a 1 s sliding window. Server-side QA (Phase 5) consumes this
 * figure for the CAP-19 client-side 80 Hz floor reject (CAP-19's "rejects
 * segments client-side" wording is honored by client-side measurement +
 * server-side filtering per CONTEXT.md D-IMU-01).
 *
 * **Pitfall 3 invariant (RESEARCH.md):** the input array MUST be the
 * physical `SensorEvent.timestamp` (ns) values, NOT the
 * `onSensorChanged` callback dispatch time. With 200 ms `maxReportLatency`
 * batching, callback intervals look like 200 ms but the underlying
 * physical samples are still arriving at ~2.4 ms intervals (at 416 Hz).
 * Drift methodology is correct only when we measure the physical
 * timestamps. Caller MUST pass `event.timestamp` values.
 *
 * **Why 1 s windows** (Assumption A5): catch transient drops without
 * triggering on single freak samples. A 100 ms slide gives up to 10×
 * window overlap, so a brief sub-1-s drop still produces multiple
 * windows that capture the drop.
 *
 * **Whole-segment fallback:** if the input span is shorter than 1 s
 * (test fixtures, smoke runs), the function returns the whole-array
 * average rate. This keeps short-input behavior deterministic without a
 * special-case throw.
 */
object ImuRateObserver {
    private const val SLIDING_WINDOW_NS: Long = 1_000_000_000L  // 1 s
    private const val SLIDE_STEP_NS: Long = 100_000_000L  // 100 ms → 10× overlap

    /**
     * Computes the 1st percentile of per-window observed sample rates (Hz).
     *
     * @param timestampsNs physical event.timestamp values in ns. MUST be
     *   sorted ascending or sortable. Size ≥ 2.
     * @return p1 of windowed sample rates in Hz, OR (for spans shorter
     *   than the sliding window) the whole-segment average rate.
     * @throws IllegalArgumentException ("insufficient_samples_for_rate_observation")
     *   if size < 2.
     */
    fun compute(timestampsNs: LongArray): Double {
        require(timestampsNs.size >= 2) { "insufficient_samples_for_rate_observation" }
        val sorted = timestampsNs.copyOf().also { it.sort() }
        val firstNs = sorted.first()
        val lastNs = sorted.last()
        val totalNs = lastNs - firstNs

        if (totalNs < SLIDING_WINDOW_NS) {
            // Whole-segment fallback; not enough span for sliding windows.
            // Defensive 1 ns floor on totalNs to avoid divide-by-zero on a
            // degenerate input (all timestamps identical).
            val totalSec = totalNs.coerceAtLeast(1L).toDouble() / 1_000_000_000.0
            return sorted.size.toDouble() / totalSec
        }

        // Sliding-window scan: each window is exactly 1 s long. Count the
        // samples in [winStart, winStart + 1s); since the window IS 1 s,
        // count == Hz directly. Slide by 100 ms → up to 10× overlap.
        //
        // WR-05 fix — two-pointer sliding window. The previous
        // `countInRange` linear scan from index 0 on every window admitted
        // pathological O(W × N) work where W = (lastNs - firstNs) / SLIDE_STEP
        // ≈ 6000 windows for a 10-min segment and N ≈ 250K samples at
        // 416 Hz. The two-pointer form is O(N + W): each pointer advances
        // at most N times across the full scan, so total work is bounded
        // by the sample count, not their product. Drift between windows
        // is small (the slide step is 10× smaller than the window) so the
        // amortized advance per window is ~10% of the window's sample count.
        val windowsHz = mutableListOf<Double>()
        var leftIdx = 0
        var rightIdx = 0
        var winStart = firstNs
        while (winStart + SLIDING_WINDOW_NS <= lastNs) {
            val winEnd = winStart + SLIDING_WINDOW_NS
            // Advance leftIdx past samples below the current window start.
            while (leftIdx < sorted.size && sorted[leftIdx] < winStart) leftIdx++
            // Advance rightIdx past samples below the current window end
            // (rightIdx ends pointing AT the first sample >= winEnd).
            while (rightIdx < sorted.size && sorted[rightIdx] < winEnd) rightIdx++
            windowsHz.add((rightIdx - leftIdx).toDouble())
            winStart += SLIDE_STEP_NS
        }
        if (windowsHz.isEmpty()) return 0.0
        val sortedHz = windowsHz.sorted()
        val p1Idx = (sortedHz.size * 1 / 100).coerceAtMost(sortedHz.size - 1)
        return sortedHz[p1Idx]
    }
}
