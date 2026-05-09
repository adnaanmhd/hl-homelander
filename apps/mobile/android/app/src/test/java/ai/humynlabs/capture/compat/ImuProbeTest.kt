package ai.humynlabs.capture.compat

import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class ImuProbeTest {
    private val probe = ImuProbe(RuntimeEnvironment.getApplication())

    @Test
    fun `200 Hz uniform stream after 5s warm-up reports ~200 Hz sustained`() {
        // 5s warm-up at 200 Hz = 1000 samples; 25s sustained at 200 Hz = 5000 samples.
        // Total 30s, 6000 samples.
        val ts = mutableListOf<Long>()
        val period = 5_000_000L // 5 ms in ns
        for (i in 0 until 6000) ts.add(i.toLong() * period)
        val r = probe.computeResult(ts)
        assertTrue("sustainedHz should be ~200 Hz", r.sustainedHz in 195f..205f)
        assertEquals(6000, r.samplesCollected)
    }

    @Test
    fun `dropped samples produce p99 spike`() {
        // 10 Hz uniform with several injected gaps in the top 1% of intervals
        // should bump p99 above the 100 ms median. With ~298 sustained intervals,
        // p99 lands at sorted-index 295, so we need at least 3 spikes to land in
        // that tail. We inject 5 widely-spaced 200 ms gaps to keep the test robust.
        val ts = mutableListOf<Long>()
        val period = 100_000_000L // 100 ms (10 Hz)
        for (i in 0 until 350) ts.add(i.toLong() * period) // >5s warm-up + samples
        // Inject 5 200 ms gaps at samples 100, 150, 200, 250, 300 by shifting
        // every sample at and after each injection point by +100 ms cumulatively.
        for (injectAt in listOf(100, 150, 200, 250, 300)) {
            for (i in injectAt until ts.size) ts[i] = ts[i] + 100_000_000L
        }
        val r = probe.computeResult(ts)
        assertTrue("p99 should exceed 110 ms after gap injection", r.p99IntervalMs > 110f)
    }

    @Test
    fun `empty stream returns zero`() {
        val r = probe.computeResult(emptyList())
        assertEquals(0f, r.sustainedHz, 0.001f)
        assertEquals(0, r.samplesCollected)
    }

    @Test
    fun `samples within warmup window only return zero sustainedHz`() {
        val ts = listOf(0L, 1_000_000_000L, 2_000_000_000L, 3_000_000_000L) // all <5s
        val r = probe.computeResult(ts)
        assertEquals(0f, r.sustainedHz, 0.001f)
    }
}
