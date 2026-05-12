package ai.humynlabs.capture.fgs

import android.app.Application
import android.app.Notification
import android.app.NotificationManager
import android.content.pm.ServiceInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Plan 03-07 — flips the Plan 03-04 Wave 0 stub for CAP-14 + D-FGS-01 to GREEN.
 *
 * **Pitfall 6 strict-mode invariant.** Android 14 (API 34) introduced FGS
 * strict-mode: the OS rejects service starts whose foreground type bitmask
 * doesn't match the manifest declaration exactly with
 * `MissingForegroundServiceTypeException`. The first test below pins the
 * runtime constant `FGS_TYPE_RECORDING` to the OR of the same three
 * `ServiceInfo.FOREGROUND_SERVICE_TYPE_*` constants the manifest declares
 * (`camera|microphone|dataSync`). The static `manifests.test.ts` gate
 * asserts the manifest string; together they form a two-sided lock —
 * neither side can drift without the other test failing.
 *
 * **`@Config(sdk = [34], application = Application::class)`:**
 *   - `sdk = 34` pins Android 14 strict-mode as the test baseline.
 *   - `application = Application::class` (stock framework Application)
 *     bypasses `MainApplication.onCreate`'s `SoLoader.init` NPE under
 *     Robolectric — same pattern Plan 03-04's `FragmentedMuxerWrapperTest`
 *     established for every Phase 3 capture/ + fgs/ test.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class HumynForegroundServiceTest {

    @Test
    fun `FGS_TYPE_RECORDING bitmask equals camera or microphone or dataSync (Pitfall 6)`() {
        val expected =
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        assertEquals(
            "Runtime FGS_TYPE_RECORDING bitmask MUST equal the manifest " +
                "foregroundServiceType=\"camera|microphone|dataSync\" — Pitfall 6.",
            expected,
            HumynForegroundService.FGS_TYPE_RECORDING,
        )
    }

    @Test
    fun `FGS_TYPE_UPLOADING is dataSync-only`() {
        // Plan 05-07 — the type-downgrade target. DATA_SYNC-only; the second
        // startForeground with this narrower mask drops the camera/mic indicators.
        assertEquals(
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            HumynForegroundService.FGS_TYPE_UPLOADING,
        )
    }

    @Test
    fun `FGS_TYPE_UPLOADING is a strict subset of FGS_TYPE_RECORDING (manifest superset unchanged)`() {
        // The upload bitmask must be entirely contained in the recording superset
        // (= the manifest "camera|microphone|dataSync" string) — Plan 05-07 adds
        // the downgrade WITHOUT changing the manifest type.
        assertEquals(
            "FGS_TYPE_UPLOADING must be ⊆ FGS_TYPE_RECORDING — the manifest " +
                "foregroundServiceType string stays \"camera|microphone|dataSync\".",
            HumynForegroundService.FGS_TYPE_UPLOADING,
            HumynForegroundService.FGS_TYPE_RECORDING and HumynForegroundService.FGS_TYPE_UPLOADING,
        )
        // ... and the recording superset is STILL the camera|microphone|dataSync OR.
        assertEquals(
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            HumynForegroundService.FGS_TYPE_RECORDING,
        )
    }

    @Test
    fun `onTimeout(int, int) is overridden (Android 15 dataSync 6h cap handoff)`() {
        // The API-35 onTimeout(startId, fgsType) override must exist — it's the
        // hand-off to the UIDT UploadJobService when the 6 h dataSync cap fires.
        val m = HumynForegroundService::class.java.getDeclaredMethod(
            "onTimeout", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType,
        )
        assertNotNull("HumynForegroundService must override onTimeout(int, int).", m)
    }

    @Test
    fun `notification channel is created with IMPORTANCE_LOW`() {
        val ctx = RuntimeEnvironment.getApplication()
        HumynForegroundNotification.ensureChannel(ctx)
        val mgr = ctx.getSystemService(NotificationManager::class.java)
        val channel = mgr.getNotificationChannel(HumynForegroundNotification.CHANNEL_ID)
        assertNotNull("Channel must be registered after ensureChannel()", channel)
        assertEquals(NotificationManager.IMPORTANCE_LOW, channel.importance)
    }

    @Test
    fun `notification build returns ongoing low-priority notification`() {
        val ctx = RuntimeEnvironment.getApplication()
        HumynForegroundNotification.ensureChannel(ctx)
        val notif = HumynForegroundNotification.build(ctx, "Recording in progress")
        // FLAG_ONGOING_EVENT must be set so the user can't swipe-dismiss the
        // notification while the service is running (system policy).
        assertEquals(
            Notification.FLAG_ONGOING_EVENT,
            notif.flags and Notification.FLAG_ONGOING_EVENT,
        )
    }

    @Test
    fun `setUploadActive toggles flag without throwing (D-FGS-02 seam)`() {
        // Plan 05-07 wires this — setUploadActive(true) when recording is not
        // active does the dataSync type-downgrade + kicks the drain;
        // setUploadActive(false) starts the 5-min idle countdown. The seam must
        // accept both without throwing (built via the Robolectric controller so
        // the Service has a base context — applicationContext is non-null).
        val controller = org.robolectric.Robolectric.buildService(HumynForegroundService::class.java)
        val svc = controller.create().get()
        svc.setUploadActive(true)
        svc.setUploadActive(false)
        svc.onRecordingFinalized()
        // Reaching here without exception is the assertion.
        controller.destroy()
    }
}
