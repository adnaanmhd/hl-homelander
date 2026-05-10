package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-05 Task 1 — drift `{max, mean, p99}` from synthetic timestamp arrays
 * per `idea-brief.md §6.5` (least-squares residual subtraction).
 *
 * Behavior contract (from PLAN.md `<behavior>`):
 *  - Uniform-cadence zero-offset → drift ~ 0 (max/mean/p99 all < 0.01 ms).
 *  - Constant +5 ms video offset → drift max < 1 ms (residual subtraction
 *    absorbs constant offsets; this is correct per idea-brief.md §6.5,
 *    which is *why* the methodology works).
 *  - Monotonically growing video offset (0 → 5 ms over 30 frames) → drift
 *    max ≥ 2.5 ms (residual subtraction does NOT absorb a growing offset).
 *  - Empty input → throws IllegalArgumentException("insufficient_samples_for_drift").
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class DriftCalculatorTest {
    @Test
    fun `uniform-cadence zero-offset returns near-zero drift`() {
        val period = 33_333_333L  // 30 FPS in ns
        val v = LongArray(30) { i -> i * period }
        val s = LongArray(180) { i -> i * (period / 6) }  // 6× rate (~180 Hz)
        val d = DriftCalculator.compute(v, s)
        assertTrue("max < 0.01 ms; was ${d.maxMs}", d.maxMs < 0.01)
        assertTrue("mean < 0.01 ms; was ${d.meanMs}", d.meanMs < 0.01)
        assertTrue("p99 < 0.01 ms; was ${d.p99Ms}", d.p99Ms < 0.01)
    }

    @Test
    fun `constant 5ms video offset is absorbed by residual subtraction (drift remains near zero)`() {
        val period = 33_333_333L
        val offsetNs = 5_000_000L
        val v = LongArray(30) { i -> i * period + offsetNs }
        val s = LongArray(180) { i -> i * (period / 6) }
        val d = DriftCalculator.compute(v, s)
        // Residual subtraction folds the constant offset into the
        // least-squares baseline (intercept absorbs it). Drift remains
        // small — this is the methodology working as specified.
        assertTrue("max < 1ms (offset is absorbed by least-squares); was ${d.maxMs}", d.maxMs < 1.0)
    }

    @Test
    fun `non-linear (quadratic) drift surfaces nonzero drift max`() {
        // Rule 1 deviation from the plan-doc test recipe — the recipe used
        // a *linear* growing offset (`i * 172_413 ns`), but a linear ramp
        // is itself a slope change and the least-squares fit absorbs it
        // exactly (slope+intercept fit has 2 free parameters that absorb
        // any linear `a + b·i` distortion). The methodology working as
        // designed makes that test artifact spuriously zero.
        //
        // The real invariant the plan wants to prove: residual subtraction
        // does NOT absorb non-affine misalignment. Use a quadratic offset
        // (`i² · 20_000 ns`) — over 30 frames, this grows to (29² × 20 µs)
        // ≈ 16.82 ms cumulatively, with maximum residual after slope+
        // intercept subtraction ≈ a few ms. The test's drift max bound is
        // set accordingly (>= 2.5 ms is a clean separator from the affine-
        // absorption cases above where drift stays < 1 ms).
        val period = 33_333_333L
        val nFrames = 30
        // Video frames carry a quadratic-in-i offset relative to IMU.
        val v = LongArray(nFrames) { i -> i * period + (i.toLong() * i.toLong() * 20_000L) }
        val s = LongArray(nFrames * 6) { i -> i * (period / 6) }
        val d = DriftCalculator.compute(v, s)
        assertTrue("max should report nonzero drift (>= 2.5 ms); was ${d.maxMs}", d.maxMs >= 2.5)
    }

    @Test
    fun `empty video array throws`() {
        try {
            DriftCalculator.compute(LongArray(0), LongArray(10) { it.toLong() })
            fail("should have thrown")
        } catch (e: IllegalArgumentException) {
            assertTrue(
                "message should contain insufficient_samples; was ${e.message}",
                e.message?.contains("insufficient_samples") == true
            )
        }
    }

    @Test
    fun `empty imu array throws`() {
        try {
            DriftCalculator.compute(LongArray(10) { it.toLong() }, LongArray(0))
            fail("should have thrown")
        } catch (e: IllegalArgumentException) {
            assertTrue(
                "message should contain insufficient_samples; was ${e.message}",
                e.message?.contains("insufficient_samples") == true
            )
        }
    }
}
