package ai.humynlabs.capture.capture

/**
 * Phase 3 — drift `{max, mean, p99}` between video frame timestamps and
 * IMU sample timestamps (CAP-08; idea-brief.md §6.5; Plan 03-05 Task 1).
 *
 * Methodology — least-squares residual subtraction per `idea-brief.md §6.5`
 * (canonical):
 *
 *   0. **Trim warm-up window** — drop the first [DEFAULT_WARMUP_FRAMES_SKIP]
 *      video frames + the IMU samples preceding the new first video frame
 *      (see "Why the warm-up trim" below). Production callers use the
 *      default; tests use `skipFirstVideoFrames = 0` to exercise the pure
 *      methodology.
 *   1. Fit a least-squares line through the video timestamps `(i, v[i])`,
 *      subtract the fit from each timestamp → residuals `r_v[i]`.
 *   2. Same for IMU timestamps → residuals `r_s[i]`.
 *   3. For each video frame timestamp `v[i]`, linearly interpolate
 *      `r_s` at `v[i]` to get `r_s_at_v[i]`.
 *   4. drift[i] = |r_v[i] - r_s_at_v[i]| (in ms).
 *   5. Report {max, mean, p99}.
 *
 * Residual subtraction is robust against:
 *   - Constant clock offsets (folded into the intercept).
 *   - Small linear clock drift (folded into the slope).
 *
 * It is NOT robust against (and correctly surfaces):
 *   - Non-linear / accelerating clock drift.
 *   - Per-frame jitter.
 *   - A monotonically growing offset that doesn't fit a single line.
 *
 * **Why the warm-up trim (Step 0):** the ultrawide-recording HAL has two
 * settling phases at segment start — sub-second CONTROL_ZOOM_RATIO + AF
 * pin settling, then 3-5 s of auto-exposure / image-stabilization / fusion
 * pipeline convergence. During convergence the encoder stamps `bufferInfo
 * .presentationTimeUs` with non-affine values that the least-squares fit
 * cannot model, so they smear residuals across the whole segment and
 * dominate `max` (occasionally `p99` on short segments). On the 2026-05-23
 * cold-start walk, dropping the first 150 frames (5 s @ 30 fps) cut
 * Pixel 8a seg-1 max from 37.36 → 7.06 ms (81% reduction) and Pixel 10a
 * seg-1 max from 10.40 → 5.86 ms (44%) — both into the relaxed-banner
 * profile (max ~6.16 / mean ~5.58 / p99 ~5.63 ms). Clean steady-state
 * segments showed no regression (Pixel 10a seg-3 max 2.33 → 2.33 ms with
 * vs without trim). Full trail: `.planning/debug/resolved/early-session-imu-video-drift.md`
 * + `ULTRAWIDE-DRIFT-FINDINGS.md` §3 (cold-start curve).
 *
 * Memory: at 30 FPS × 10 min = 18 000 video frames; per-frame drift array
 * = 18 000 × 8 bytes (double) = ~144 KB. Sort for max/mean/p99 is trivial.
 * No streaming required (CONTEXT.md `<specifics>` "Drift computation
 * memory bound").
 */
/**
 * Drift figures `{max, mean, p99}` in milliseconds, plus the actual
 * `warmupFramesSkipped` Step 0 applied. The skip count is surfaced so
 * downstream consumers (training pipeline, anyone recomputing drift from
 * the raw `video.mp4` + `imu.csv`) can reproduce the metric exactly —
 * it's the offset between "drop the first N video frames + matching IMU
 * samples" and "use all timestamps verbatim". Equals the requested
 * `skipFirstVideoFrames` for normal-length segments; falls back to 0 on
 * crash-truncated segments shorter than the skip count.
 */
data class Drift(
    val maxMs: Double,
    val meanMs: Double,
    val p99Ms: Double,
    val warmupFramesSkipped: Int,
)

object DriftCalculator {
    /**
     * Default warm-up frames trimmed before the least-squares fit. 5 s @
     * 30 FPS — empirically covers both observed Pixel ultrawide HAL
     * settling phases (CONTROL_ZOOM_RATIO + AE/AWB/IS). See class kdoc.
     */
    const val DEFAULT_WARMUP_FRAMES_SKIP: Int = 150

    /**
     * Computes drift between two timestamp series in nanoseconds.
     *
     * @param videoFrameTimestampsNs MUST be ascending; size ≥ 2.
     * @param imuTimestampsNs MUST be ascending; size ≥ 2.
     * @param skipFirstVideoFrames warm-up window to drop before the fit.
     *   Defaults to [DEFAULT_WARMUP_FRAMES_SKIP]; tests pass 0 to exercise
     *   the pure methodology. If trimming would leave < 2 video frames OR
     *   < 2 IMU samples post-trim, the call silently falls back to no
     *   trim — the segment is too short to benefit from the warm-up
     *   distinction.
     * @return drift triple in milliseconds.
     * @throws IllegalArgumentException ("insufficient_samples_for_drift")
     *   if either input has < 2 samples.
     */
    fun compute(
        videoFrameTimestampsNs: LongArray,
        imuTimestampsNs: LongArray,
        skipFirstVideoFrames: Int = DEFAULT_WARMUP_FRAMES_SKIP,
    ): Drift {
        require(videoFrameTimestampsNs.size >= 2) { "insufficient_samples_for_drift" }
        require(imuTimestampsNs.size >= 2) { "insufficient_samples_for_drift" }

        // Step 0 — warm-up trim. Fall back to no trim if it would leave
        // either stream with < 2 samples; track the actual count applied
        // so the result carries it for downstream reproducibility.
        var v = videoFrameTimestampsNs
        var s = imuTimestampsNs
        var actualSkip = 0
        if (skipFirstVideoFrames > 0 && videoFrameTimestampsNs.size - skipFirstVideoFrames >= 2) {
            val trimmedV = videoFrameTimestampsNs.copyOfRange(
                skipFirstVideoFrames,
                videoFrameTimestampsNs.size,
            )
            val floor = trimmedV.first()
            val firstImuKept = imuTimestampsNs.indexOfFirst { it >= floor }
            if (firstImuKept >= 0 && imuTimestampsNs.size - firstImuKept >= 2) {
                v = trimmedV
                s = imuTimestampsNs.copyOfRange(firstImuKept, imuTimestampsNs.size)
                actualSkip = skipFirstVideoFrames
            }
        }

        val rv = residualsFromLeastSquaresFit(v)
        val rs = residualsFromLeastSquaresFit(s)
        val rsAtV = DoubleArray(rv.size) { i ->
            interpolate(s, rs, v[i])
        }
        val absD = DoubleArray(rv.size) { i ->
            kotlin.math.abs(rv[i] - rsAtV[i]) / 1_000_000.0  // ns → ms
        }
        absD.sort()
        return Drift(
            maxMs = absD.last(),
            meanMs = absD.sum() / absD.size,
            p99Ms = absD[(absD.size * 99 / 100).coerceAtMost(absD.size - 1)],
            warmupFramesSkipped = actualSkip,
        )
    }

    /**
     * Computes per-sample residuals after subtracting the least-squares fit
     * `y = a*i + b` (with index `i` as the independent variable).
     *
     *   a = (n·Σ(i·y) − Σi·Σy) / (n·Σ(i²) − (Σi)²)
     *   b = (Σy − a·Σi) / n
     *
     * Uses index-based regression (not timestamp-based) because the
     * dependent series is monotonically uniform in index by construction
     * (we want the residual *off the trend line*, not off some timestamp
     * regression).
     */
    private fun residualsFromLeastSquaresFit(values: LongArray): DoubleArray {
        val n = values.size
        require(n >= 2) { "insufficient_samples_for_drift" }
        var sumI = 0.0
        var sumY = 0.0
        var sumIY = 0.0
        var sumII = 0.0
        for (idx in 0 until n) {
            val i = idx.toDouble()
            val y = values[idx].toDouble()
            sumI += i
            sumY += y
            sumIY += i * y
            sumII += i * i
        }
        val denom = n * sumII - sumI * sumI
        // denom == 0 only when all i are identical, which can't happen for n >= 2.
        val a = (n * sumIY - sumI * sumY) / denom
        val b = (sumY - a * sumI) / n
        return DoubleArray(n) { i -> values[i].toDouble() - (a * i + b) }
    }

    /**
     * Linearly interpolates `ys` at the position where `xs` equals `x`.
     * Out-of-range `x` is clamped to the endpoints (last-residual / first-
     * residual respectively) — same semantics the canonical idea-brief.md
     * §6.5 algorithm assumes for video frames at or beyond the IMU coverage
     * window.
     *
     * **WR-06 caveat — drift is conservatively under-reported at segment edges.**
     * The endpoint clamp means video frames whose timestamps fall outside
     * the IMU coverage window get a residual close to 0 instead of the true
     * extrapolated drift. In practice IMU registration takes ~tens of ms
     * at segment start, and closeSegmentResources stops the IMU writer
     * AFTER the muxer in step 7 — so up to ~6 frames at each edge of a
     * 10-min segment (12 frames out of 18 000 = 0.067%) compute drift
     * against a clamped value rather than a true residual. p99 is
     * unaffected (well below the 1% threshold). max may under-report when
     * the worst real drift happens to occur in the underrun window. The
     * Phase 5 server-side QA pipeline should treat drift figures < 0.5 ms
     * as "could be true zero, could be edge-clamp under-report" rather
     * than as a hard guarantee. A future v2 change can drop edge frames
     * outside the IMU coverage window from the drift array; doing so now
     * would shrink the per-segment drift sample count and require Phase 5
     * to relax its statistical floor.
     */
    private fun interpolate(xs: LongArray, ys: DoubleArray, x: Long): Double {
        require(xs.size == ys.size && xs.size >= 2) { "interpolate_size_mismatch" }
        if (x <= xs.first()) return ys.first()
        if (x >= xs.last()) return ys.last()
        var lo = 0
        var hi = xs.size - 1
        while (hi - lo > 1) {
            val mid = (lo + hi) ushr 1
            if (xs[mid] <= x) lo = mid else hi = mid
        }
        val span = (xs[hi] - xs[lo]).toDouble()
        if (span == 0.0) return ys[lo]  // degenerate; identical timestamps
        val t = (x - xs[lo]).toDouble() / span
        return ys[lo] + t * (ys[hi] - ys[lo])
    }
}
