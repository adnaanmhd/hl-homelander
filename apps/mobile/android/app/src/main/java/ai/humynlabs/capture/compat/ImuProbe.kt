package ai.humynlabs.capture.compat

import android.content.Context

/**
 * IMU sustained-rate probe (COMPAT-02 / Pitfall 4). Registers a SensorManager
 * gyro listener at SENSOR_DELAY_FASTEST with maxReportLatency=0 (no batching),
 * runs for the requested duration with a 5-second warm-up skip, and — when
 * withPreview=true — opens a concurrent 1080p Camera2 preview to load the SoC
 * (Pitfall 4: throttled SoC under camera-preview load drops sustained rate).
 *
 * Returns sustainedHz (samples_after_warmup / duration_seconds_after_warmup),
 * p99IntervalMs (99th-percentile inter-sample gap, ms), and samplesCollected.
 *
 * SHELL ONLY — plan 02-06. Plan 02-13 fills in:
 *   - SensorManager.registerListener(... SENSOR_DELAY_FASTEST, 0, handler)
 *   - 5-second warm-up skip; reference clock = SystemClock.elapsedRealtimeNanos
 *   - Optional concurrent 1080p Camera2 preview on a dummy SurfaceTexture
 *   - Inter-sample p99 computation (sorted intervals, index = n*99/100)
 *   - Pure-function `internal fun computeResult(timestamps)` for Robolectric
 *
 * Reference: RESEARCH § Code Examples lines 793-824 + § Pitfall 4.
 */
class ImuProbe(private val ctx: Context) {

    data class Result(
        val sustainedHz: Float,
        val p99IntervalMs: Float,
        val samplesCollected: Int,
    )

    /**
     * Run the IMU sustained-rate probe.
     *
     * @param durationMs total sampling window in milliseconds (e.g. 30_000).
     * @param withPreview if true, open a concurrent 1080p Camera2 preview to
     *                    emulate Phase 3 capture-time SoC load.
     *
     * SHELL ONLY: throws NotImplementedError until 02-13 lands.
     */
    fun run(durationMs: Long, withPreview: Boolean): Result {
        // TODO(02-13): real implementation. SensorManager + optional Camera2
        // preview, 5 s warm-up skip, return computed Hz + p99 interval.
        throw NotImplementedError(
            "ImuProbe.run(durationMs=$durationMs, withPreview=$withPreview) — implemented in plan 02-13",
        )
    }
}
