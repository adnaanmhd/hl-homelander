package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-05 Task 1 — sliding-window-1s p1 over physical event.timestamp →
 * `imu_min_rate_hz_observed_p1` for the metadata JSON schema 1.1.0 bump
 * (CAP-19; D-IMU-01/02).
 *
 * Behavior contract (from PLAN.md `<behavior>`):
 *  - 6000 samples uniformly at 5 ms (200 Hz) over 30 s → p1Hz ~200.
 *  - Physical 200 Hz with batched delivery → p1Hz still ~200 (Pitfall 3
 *    invariant — input array IS event.timestamp; callback batching is
 *    irrelevant by construction).
 *  - 5 s window with samples dropping from 200 Hz → 50 Hz at t=2 s →
 *    p1Hz reports the 50 Hz floor.
 *  - <2 samples → throws IllegalArgumentException("insufficient_samples_for_rate_observation").
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ImuRateObserverTest {
    @Test
    fun `200 Hz uniform stream over 30s reports ~200 Hz p1`() {
        val period = 5_000_000L  // 5 ms in ns
        val ts = LongArray(6000) { i -> i.toLong() * period }
        val p1 = ImuRateObserver.compute(ts)
        assertTrue("p1Hz in 195..205; was $p1", p1 in 195.0..205.0)
    }

    @Test
    fun `physical 200Hz with batched delivery reports 200Hz`() {
        // The test array IS event.timestamp values (uniform 5 ms apart),
        // so batched callback delivery is irrelevant by construction.
        // This documents the Pitfall 3 invariant: we measure the physical
        // event.timestamp, not the callback dispatch time.
        val period = 5_000_000L
        val ts = LongArray(6000) { i -> i.toLong() * period }
        val p1 = ImuRateObserver.compute(ts)
        assertTrue("p1Hz in 195..205; was $p1", p1 in 195.0..205.0)
    }

    @Test
    fun `mid-stream drop from 200Hz to 50Hz reports ~50Hz floor`() {
        val ts = mutableListOf<Long>()
        // first 2 s @ 200 Hz (5 ms period) → 400 samples
        for (i in 0 until 400) ts.add(i.toLong() * 5_000_000L)
        // next 28 s @ 50 Hz (20 ms period), starting at t=2 s → 1400 samples
        val start = 2_000_000_000L
        for (i in 0 until 1400) ts.add(start + i.toLong() * 20_000_000L)
        val p1 = ImuRateObserver.compute(ts.toLongArray())
        assertTrue("p1Hz ~50; was $p1", p1 in 45.0..55.0)
    }

    @Test
    fun `single-sample input throws`() {
        try {
            ImuRateObserver.compute(LongArray(1) { 0L })
            fail("should have thrown")
        } catch (e: IllegalArgumentException) {
            assertTrue(
                "message should contain insufficient_samples; was ${e.message}",
                e.message?.contains("insufficient_samples") == true
            )
        }
    }

    @Test
    fun `empty input throws`() {
        try {
            ImuRateObserver.compute(LongArray(0))
            fail("should have thrown")
        } catch (e: IllegalArgumentException) {
            assertTrue(
                "message should contain insufficient_samples; was ${e.message}",
                e.message?.contains("insufficient_samples") == true
            )
        }
    }
}
