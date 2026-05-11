package ai.humynlabs.capture.capture

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter

/**
 * Phase 3 CAP-04 + CAP-05 + CAP-06 — IMU sample collector + interleaved
 * CSV writer.
 *
 * Pitfall 3: input timestamps are physical `event.timestamp` values
 * (ns, in `SystemClock.elapsedRealtimeNanos` domain when the device
 * advertises `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`), NOT
 * `onSensorChanged` dispatch time. The 200 ms `maxReportLatencyUs`
 * causes burst delivery; physical timestamps stay correct so drift
 * methodology against the camera frame timestamps remains valid.
 *
 * Both sensors register on the SAME HandlerThread → SAME listener
 * instance → no thread-safety overhead inside `onSensorChanged`. The
 * thread-confined `BufferedWriter` flushes only on close (kernel page-
 * cache holds the in-flight bytes; OS write-back keeps disk current).
 *
 * CSV row format (idea-brief.md §8.2):
 *   `${timestamp_ns},${type},${x},${y},${z}\n`
 * where `type` is "gyro" or "accel"; values are native sensor units
 * (rad/s for gyro, m/s² for accel); both sensors interleaved by
 * timestamp in one file.
 *
 * Construction tolerates a missing gyro/accelerometer (Robolectric
 * default + headless test runners). `start()` is a no-op if either
 * sensor is missing — the production code path NEVER runs without
 * sensors because Phase 2's compat probe (DeviceCaps.motionSensorsPresent)
 * gates the user out before we ever construct an ImuWriter.
 *
 * Lifecycle:
 *   - construct: open BufferedWriter, start HandlerThread.
 *   - start():   register gyro + accel listeners.
 *   - stop():    unregister listeners; return collected timestamps.
 *   - close():   flush + close writer; quitSafely the HandlerThread.
 *                Idempotent. stop() does NOT close — the caller may
 *                call timestamps() between stop() and close() to
 *                inspect the final array.
 */
class ImuWriter(
    private val ctx: Context,
    csvFile: File,
    private val maxReportLatencyUs: Int = DEFAULT_MAX_REPORT_LATENCY_US,
) {
    companion object {
        /**
         * 200 ms — Claude's Discretion call per CONTEXT.md
         * `<decisions>` "IMU sensor batching maxReportLatency value".
         * Industry-standard tradeoff: longer batch → better battery,
         * samples arrive in bursts; shorter batch → more wakeups.
         * Drift methodology against physical timestamps is correct
         * either way (Pitfall 3 invariant).
         */
        const val DEFAULT_MAX_REPORT_LATENCY_US = 200_000
    }

    private val csv: BufferedWriter = BufferedWriter(FileWriter(csvFile), 8192)
    private val sm: SensorManager? =
        ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val gyro: Sensor? = sm?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    private val accel: Sensor? = sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val timestampList = mutableListOf<Long>()
    private val handlerThread = HandlerThread("HumynCapture-Imu").apply { start() }
    private val handler = Handler(handlerThread.looper)
    private val listener = object : SensorEventListener {
        override fun onSensorChanged(e: SensorEvent) {
            val type = if (e.sensor.type == Sensor.TYPE_GYROSCOPE) "gyro" else "accel"
            writeRow(e.timestamp, type, e.values[0], e.values[1], e.values[2])
        }
        override fun onAccuracyChanged(s: Sensor, a: Int) { /* unused */ }
    }
    @Volatile private var closed = false
    /**
     * WR-08 fix — guards every csv access (writeRow / stop / close) so the
     * sensor HandlerThread cannot race the session HandlerThread that
     * called `stop()` / `close()`. SensorManager.unregisterListener is
     * asynchronous on some Android versions and pending events may already
     * be dispatched on the sensor HandlerThread; the lock ensures
     * writeRow's `closed` check and the subsequent `csv.write` are
     * atomic relative to close()'s `closed = true` + `csv.close()`.
     */
    private val csvLock = Any()

    /**
     * Register both gyro and accelerometer listeners. No-op if sensors
     * are missing (test environment) — production gate at
     * `DeviceCaps.motionSensorsPresent` ensures gyro+accel exist.
     */
    fun start() {
        val mgr = sm ?: return
        val g = gyro ?: return
        val a = accel ?: return
        mgr.registerListener(listener, g, SensorManager.SENSOR_DELAY_FASTEST, maxReportLatencyUs, handler)
        mgr.registerListener(listener, a, SensorManager.SENSOR_DELAY_FASTEST, maxReportLatencyUs, handler)
    }

    /**
     * Unregister listeners. Returns the LongArray of physical
     * timestamps observed so far — caller uses for finalize-time drift
     * + p1 calc. Does NOT close the BufferedWriter (caller may inspect
     * timestamps() before close()).
     *
     * **WR-07 fix.** Flush the BufferedWriter explicitly. Without this,
     * up to 8 KiB of IMU rows (~256 rows / ~0.6 s of IMU at 416 Hz) sit
     * in the BufferedWriter's in-memory buffer between stop() and
     * close(), and a SIGKILL in that window loses them — the CSV file
     * is then short relative to the in-memory timestampList (which the
     * caller has already snapshotted), and the CSV SHA mismatches the
     * implied row count. Phase 5 server QA may flag this as an
     * integrity error. The flush is best-effort under csvLock so it
     * doesn't race writeRow on the sensor thread.
     */
    fun stop(): LongArray {
        sm?.unregisterListener(listener)
        synchronized(csvLock) {
            try { csv.flush() } catch (_: Throwable) { /* best-effort */ }
        }
        return timestampList.toLongArray()
    }

    /**
     * Final flush + writer close + thread shutdown. Idempotent — safe
     * to call multiple times.
     *
     * **WR-08 fix.** csvLock-guarded so a sensor HandlerThread writeRow
     * call cannot race the close() flush+close. Without the lock, a
     * sensor event squeezing through between writeRow's volatile-read
     * of `closed=false` and its subsequent `csv.write(...)` would hit
     * a closed BufferedWriter → IOException; SensorManager
     * infrastructure logs-and-swallows the throw on some Android
     * versions, masking the data loss.
     */
    fun close() {
        synchronized(csvLock) {
            if (closed) return
            closed = true
            try {
                csv.flush()
                csv.close()
            } catch (_: Throwable) { /* best-effort */ }
        }
        handlerThread.quitSafely()
    }

    /** All physical timestamps observed (live snapshot). */
    fun timestamps(): LongArray = timestampList.toLongArray()

    /**
     * Visible-for-tests pure-fn formatting. The exact byte sequence
     * each `onSensorChanged` produces.
     */
    fun formatRow(timestampNs: Long, type: String, x: Float, y: Float, z: Float): String =
        "$timestampNs,$type,$x,$y,$z\n"

    /**
     * Visible-for-tests synchronous write seam. Skips listener +
     * HandlerThread to make disk-round-trip assertions deterministic
     * in unit tests.
     */
    fun writeRowForTest(timestampNs: Long, type: String, x: Float, y: Float, z: Float) {
        writeRow(timestampNs, type, x, y, z)
    }

    /**
     * Internal write path — used by both the listener and the
     * test-visible writeRowForTest seam.
     *
     * **WR-08 fix.** csvLock-guarded so concurrent close() cannot drop
     * the BufferedWriter out from under us between the `closed` check
     * and the `csv.write(...)` call. The lock is held only across the
     * BufferedWriter call itself; sensor-thread throughput is unaffected
     * in the steady-state common case where close() is not racing.
     */
    private fun writeRow(timestampNs: Long, type: String, x: Float, y: Float, z: Float) {
        synchronized(csvLock) {
            if (closed) return
            csv.write(formatRow(timestampNs, type, x, y, z))
            timestampList.add(timestampNs)
        }
    }
}
