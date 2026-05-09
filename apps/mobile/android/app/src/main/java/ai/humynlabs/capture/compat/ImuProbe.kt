package ai.humynlabs.capture.compat

import android.content.Context
import android.graphics.SurfaceTexture
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.HandlerThread
import android.view.Surface
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * IMU sustained-rate probe (COMPAT-02 / Pitfall 4).
 *
 * Registers a gyro listener at SENSOR_DELAY_FASTEST with maxReportLatency=0
 * (no batching) for the requested duration. When withPreview=true, also runs a
 * 1080p Camera2 preview concurrently — emulates the load Phase 3 capture imposes.
 * Skips the first 5 s of samples (warm-up) to reflect steady-state delivery.
 *
 * Returned sustainedHz = samples_after_warmup / (last_ts - first_ts) in seconds.
 * Returned p99IntervalMs = 99th percentile of inter-sample gaps in ms.
 *
 * Reference clock is SensorEvent.timestamp (SystemClock.elapsedRealtimeNanos
 * domain on Android), keeping the probe in the same time base as the Phase 3
 * capture pipeline (Camera2 + MediaCodec timestamps also live in
 * elapsedRealtimeNanos when SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME).
 */
class ImuProbe(private val ctx: Context) {
    data class Result(val sustainedHz: Float, val p99IntervalMs: Float, val samplesCollected: Int)

    companion object {
        private const val WARMUP_NS: Long = 5_000_000_000L
    }

    fun run(durationMs: Long, withPreview: Boolean): Result {
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val gyro = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) ?: throw IllegalStateException("no_gyro")

        val timestamps = mutableListOf<Long>()
        val listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                timestamps.add(e.timestamp)
            }
            override fun onAccuracyChanged(s: Sensor, a: Int) { /* unused */ }
        }

        val handlerThread = HandlerThread("ImuProbe").apply { start() }
        val handler = Handler(handlerThread.looper)
        sm.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_FASTEST, 0, handler)

        // Optional 1080p preview to load the SoC (Pitfall 4)
        var camera: CameraDevice? = null
        var session: CameraCaptureSession? = null
        var surface: Surface? = null
        var surfaceTexture: SurfaceTexture? = null
        if (withPreview) {
            try {
                val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val backId = mgr.cameraIdList.firstOrNull {
                    mgr.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
                }
                if (backId != null) {
                    surfaceTexture = SurfaceTexture(0).apply { setDefaultBufferSize(1920, 1080) }
                    surface = Surface(surfaceTexture)
                    val openLatch = CountDownLatch(1)
                    mgr.openCamera(backId, object : CameraDevice.StateCallback() {
                        override fun onOpened(c: CameraDevice) { camera = c; openLatch.countDown() }
                        override fun onDisconnected(c: CameraDevice) { c.close() }
                        override fun onError(c: CameraDevice, error: Int) { c.close(); openLatch.countDown() }
                    }, handler)
                    openLatch.await(2, TimeUnit.SECONDS)
                    camera?.let { cam ->
                        val sessionLatch = CountDownLatch(1)
                        cam.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
                            override fun onConfigured(s: CameraCaptureSession) {
                                session = s
                                val req = cam.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply { addTarget(surface!!) }.build()
                                s.setRepeatingRequest(req, null, handler)
                                sessionLatch.countDown()
                            }
                            override fun onConfigureFailed(s: CameraCaptureSession) { sessionLatch.countDown() }
                        }, handler)
                        sessionLatch.await(2, TimeUnit.SECONDS)
                    }
                }
            } catch (_: Throwable) { /* preview is best-effort */ }
        }

        // Run for durationMs
        Thread.sleep(durationMs)

        // Cleanup
        sm.unregisterListener(listener)
        try { session?.close() } catch (_: Throwable) {}
        try { camera?.close() } catch (_: Throwable) {}
        try { surface?.release() } catch (_: Throwable) {}
        try { surfaceTexture?.release() } catch (_: Throwable) {}
        handlerThread.quitSafely()

        return computeResult(timestamps)
    }

    /** Pure function: easy to Robolectric-test with synthetic timestamps. */
    internal fun computeResult(timestamps: List<Long>): Result {
        if (timestamps.isEmpty()) return Result(0f, 0f, 0)
        val first = timestamps[0]
        val sustained = timestamps.filter { it - first > WARMUP_NS }
        if (sustained.size < 2) return Result(0f, 0f, timestamps.size)
        val durSec = (sustained.last() - sustained.first()) / 1_000_000_000.0
        val sustainedHz = if (durSec > 0) (sustained.size / durSec).toFloat() else 0f
        val intervalsMs = sustained.zipWithNext { a, b -> (b - a) / 1_000_000.0 }
        val p99Ms = intervalsMs.sorted()[min(intervalsMs.size * 99 / 100, intervalsMs.size - 1)].toFloat()
        return Result(sustainedHz = sustainedHz, p99IntervalMs = p99Ms, samplesCollected = timestamps.size)
    }
}
