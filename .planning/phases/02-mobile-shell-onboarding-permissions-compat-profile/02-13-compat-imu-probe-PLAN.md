---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 13
id: 02-13-compat-imu-probe
name: HumynCompat ImuProbe — sustained 100 Hz over 30 s with 1080p preview, p99 inter-sample interval
type: execute
wave: 3
depends_on: [02-06-humyn-compat-kotlin-shells, 02-02-test-scaffolding-and-deps]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt
autonomous: true
requirements: [COMPAT-02, COMPAT-07]
must_haves:
  truths:
    - 'ImuProbe registers a SensorManager listener on the gyroscope at SENSOR_DELAY_FASTEST with maxReportLatency=0 (no batching)'
    - 'Probe runs for the requested durationMs with a 5 s warm-up skip (RESEARCH § Code Examples)'
    - 'When withPreview=true, a dummy 1080p Camera2 preview runs concurrently to load the SoC (Pitfall 4: throttled SoC under camera-preview load drops sustained rate)'
    - 'Returned sustainedHz = (samples_after_warmup) / (durationSec_after_warmup); p99IntervalMs = inter-sample p99'
    - 'Reference clock is SystemClock.elapsedRealtimeNanos for compat with Phase 3 capture pipeline'
    - 'Robolectric tests inject a fake timestamp generator and validate the sustainedHz + p99 math'
  artifacts:
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt'
      provides: '30 s IMU sustained probe + p99 interval'
      contains: 'SENSOR_DELAY_FASTEST'
  key_links:
    - from: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt'
      to: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt'
      via: 'ImuProbe(reactApplicationContext).run(durationMs, withPreview)'
      pattern: 'ImuProbe'
---

<objective>
Implement the IMU sustained-rate probe for COMPAT-02/07: 30-second sampling with `maxReportLatency=0` while a 1080p Camera2 preview runs concurrently, returning `{sustainedHz, p99IntervalMs, samplesCollected}` after a 5-second warm-up skip.

Purpose: Pitfall 4 — devices that pass an instantaneous IMU probe drop sustained rate under camera-preview load. The 30 s window catches them.
Output: Kotlin ImuProbe + Robolectric tests on the math (sustainedHz + p99) using a fake timestamp generator. Real-device validation in 02-21 manual smoke.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt

<interfaces>
<!-- RESEARCH § Code Examples — IMU sustained-rate probe (Kotlin) lines 793-824 -->
class ImuProbe(private val ctx: Context) {
    data class Result(val sustainedHz: Float, val p99IntervalMs: Float, val samplesCollected: Int)
    fun run(durationMs: Long, withPreview: Boolean): Result {
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val gyro = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) ?: throw IllegalStateException("no_gyro")
        val timestamps = mutableListOf<Long>()
        ...
        sm.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_FASTEST, 0)
        ...
        val warmupNs = 5_000_000_000L
        ...
    }
}
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                               | Description                                |
| -------------------------------------- | ------------------------------------------ |
| SensorManager → in-process listener    | trusted; OS-mediated                       |
| Camera2 preview → dummy SurfaceTexture | preview frames discarded; no encode/upload |

## STRIDE Threat Register

| Threat ID | Category               | Component                                    | Disposition | Mitigation Plan                                                                                                             |
| --------- | ---------------------- | -------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| T-2.13-01 | Denial of Service      | Probe runs on main thread, blocks UI for 30s | mitigate    | HumynCompatModule.runImuProbe dispatches on bgExecutor (plan 02-06).                                                        |
| T-2.13-02 | Information Disclosure | Camera preview frames captured into memory   | accept      | Frames are dropped to a SurfaceTexture that we never read (no `onFrameAvailable` consumer). 30 s of unread frames are GC'd. |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Full ImuProbe implementation + Robolectric math test</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt (NEW)</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt (current scaffold from 02-06)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "IMU sustained-rate probe (Kotlin)" lines 793-824 (reference impl)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Pitfall 4" lines 639-644 (sustained probe rationale)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-COMPAT-02 (probe contract)
  </read_first>
  <action>
    Replace `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt`:
    ```kotlin
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
    import android.hardware.camera2.CaptureRequest
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
    ```

    Author `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt`:
    ```kotlin
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
            // 10 Hz uniform with one 100ms gap should bump p99 above the median.
            val ts = mutableListOf<Long>()
            val period = 100_000_000L // 100 ms (10 Hz)
            for (i in 0 until 350) ts.add(i.toLong() * period) // >5s warm-up + samples
            // Inject a 200 ms gap at sample 200
            for (i in 200 until ts.size) ts[i] = ts[i] + 100_000_000L
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
    ```

    Run `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*ImuProbeTest*"` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "SENSOR_DELAY_FASTEST" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` succeeds.
    - `grep -q "WARMUP_NS" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` succeeds.
    - `grep -q "withPreview" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` succeeds.
    - `grep -q "TYPE_GYROSCOPE" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` succeeds.
    - `grep -q "internal fun computeResult" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` succeeds (testable surface).
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*ImuProbeTest*"` exits 0.
    - `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug -q && ./gradlew :app:testApkRolloutDebugUnitTest --tests "*ImuProbeTest*" -q</automated>
  </verify>
  <done>ImuProbe full impl with 5 s warm-up + optional 1080p preview load; 4 Robolectric tests on the math; build green.</done>
</task>

</tasks>

<verification>
- ImuProbe walks SensorManager events at SENSOR_DELAY_FASTEST + maxReportLatency=0.
- 5 s warm-up skip honored.
- withPreview=true opens a 1080p Camera2 preview to load the SoC.
- p99IntervalMs computed from inter-sample gaps.
- 4 Robolectric tests cover 200 Hz baseline, gap injection, empty stream, warmup-only.
</verification>

<success_criteria>

- COMPAT-02 + COMPAT-07 IMU portion implemented.
- Plan 02-16 wires this into compatService and gates pass on `sustainedHz >= 100 && p99IntervalMs <= 12`.
- Real-device behavior validated in 02-21 manual smoke.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-13-SUMMARY.md` documenting the warmup skip, the elapsedRealtimeNanos clock domain (Phase 3 alignment), and the testability split (computeResult as an internal pure function for Robolectric).
</output>
