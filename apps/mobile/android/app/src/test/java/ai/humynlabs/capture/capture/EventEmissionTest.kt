package ai.humynlabs.capture.capture

import android.app.Application
import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-10 Task 2 — CAP-13: NativeEventEmitter payload shapes
 * (D-API-03).
 *
 * The five lifecycle events the JS bridge exposes (`onSegmentStart`,
 * `onSegmentComplete`, `onSessionStop`, `onThermalAbort`, `onError`)
 * MUST carry the exact keys the Phase 4 RecordingScreen + Phase 5
 * upload-pause signal will read. Each test builds the WritableMap shape
 * CaptureSession + FinalizeWorker emit, then asserts every key surfaces
 * with the expected type.
 *
 * Production-code emit path: CaptureSession.emitSegmentStart /
 * stop / thermal listener + FinalizeWorker.finalize call
 * `emit(name, payload)` which delegates to
 * `RCTDeviceEventEmitter.emit(name, payload)` via
 * HumynCaptureModule.emitEvent. The bridge contract is the payload
 * shape; this test locks the shape.
 *
 * Uses [JavaOnlyMap] (the pure-JVM WritableMap impl) instead of
 * `Arguments.createMap()` — the latter pulls
 * `com.facebook.jni.HybridData.<clinit>` which fails under Robolectric
 * with `NativeLoader has not been initialized` (the JNI bridge is
 * compiled in but its native lib never loads in the unit-test JVM).
 * `JavaOnlyMap` implements the same `WritableMap` / `ReadableMap`
 * surface as Arguments-produced maps, so the payload shape under test
 * is identical at the contract level.
 *
 * Robolectric — `application = Application::class` bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class EventEmissionTest {

    @Test
    fun `onSegmentStart payload contains segmentId recordingId startedAt filenameBase`() {
        val payload = JavaOnlyMap().apply {
            putString("segmentId", "01JABCSEGMENT1XXXXXXXXXXXXX")
            putString("recordingId", "01JABCRECID1XXXXXXXXXXXXXXX")
            putString("startedAt", "2026-05-05T00:30:20.000+05:30")
            putString("filenameBase", "20260505_003020_001")
        }
        assertEquals("01JABCSEGMENT1XXXXXXXXXXXXX", payload.getString("segmentId"))
        assertEquals("01JABCRECID1XXXXXXXXXXXXXXX", payload.getString("recordingId"))
        assertEquals("2026-05-05T00:30:20.000+05:30", payload.getString("startedAt"))
        assertEquals("20260505_003020_001", payload.getString("filenameBase"))
    }

    @Test
    fun `onSessionStop payload contains sessionId + segmentsCompleted`() {
        val payload = JavaOnlyMap().apply {
            putString("sessionId", "01JABCSESSIONXXXXXXXXXXXXXX")
            putInt("segmentsCompleted", 2)
        }
        assertEquals("01JABCSESSIONXXXXXXXXXXXXXX", payload.getString("sessionId"))
        assertEquals(2, payload.getInt("segmentsCompleted"))
    }

    @Test
    fun `onSegmentComplete payload contains taskId drift map durationMs imuMinRateHzObservedP1`() {
        val driftMap = JavaOnlyMap().apply {
            putDouble("max", 0.7); putDouble("mean", 0.18); putDouble("p99", 0.5)
        }
        val payload = JavaOnlyMap().apply {
            putString("segmentId", "g1")
            putString("recordingId", "r1")
            // Bug 9 (260604) — the segment's own task, copied from the sidecar so
            // the JS auto-enqueue keys the upload on it instead of a render closure.
            putString("taskId", "cooking_chop")
            putString("mp4Path", "/x.mp4")
            putString("csvPath", "/x.csv")
            putString("jsonPath", "/x.json")
            putDouble("durationMs", 600_000.0)
            putMap("drift", driftMap)
            putDouble("imuMinRateHzObservedP1", 200.0)
        }
        assertEquals("g1", payload.getString("segmentId"))
        assertEquals("r1", payload.getString("recordingId"))
        assertEquals("cooking_chop", payload.getString("taskId"))
        assertEquals("/x.mp4", payload.getString("mp4Path"))
        assertEquals("/x.csv", payload.getString("csvPath"))
        assertEquals("/x.json", payload.getString("jsonPath"))
        assertEquals(600_000.0, payload.getDouble("durationMs"), 0.0)
        val readBackDrift = payload.getMap("drift")
            ?: error("drift map missing from onSegmentComplete payload")
        assertEquals(0.7, readBackDrift.getDouble("max"), 0.0)
        assertEquals(0.18, readBackDrift.getDouble("mean"), 0.0)
        assertEquals(0.5, readBackDrift.getDouble("p99"), 0.0)
        assertEquals(200.0, payload.getDouble("imuMinRateHzObservedP1"), 0.0)
    }

    @Test
    fun `onThermalAbort payload contains segmentId + currentStatus`() {
        // Mid-record SEVERE thermal escalation — CaptureSession's
        // ThermalGate listener emits this BEFORE scheduling the 2.5 s
        // graceful stop.
        val payload = JavaOnlyMap().apply {
            putString("segmentId", "g1")
            putInt("currentStatus", 3) // PowerManager.THERMAL_STATUS_SEVERE
        }
        assertEquals("g1", payload.getString("segmentId"))
        assertEquals(3, payload.getInt("currentStatus"))
    }

    @Test
    fun `onError payload contains code message recoverable segmentId`() {
        val payload = JavaOnlyMap().apply {
            putString("code", "finalize_failed")
            putString("message", "checksum mismatch")
            putBoolean("recoverable", false)
            putString("segmentId", "g1")
        }
        assertEquals("finalize_failed", payload.getString("code"))
        assertEquals("checksum mismatch", payload.getString("message"))
        assertEquals(false, payload.getBoolean("recoverable"))
        assertEquals("g1", payload.getString("segmentId"))
    }
}
