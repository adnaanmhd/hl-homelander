---
phase: 03-humyn-capture-native-module
plan_id: 03-07
plan: 7
type: execute
wave: 3
depends_on: [03-04]
files_modified:
  - apps/mobile/android/app/src/main/AndroidManifest.xml
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt
  - apps/mobile/__tests__/manifests/manifests.test.ts
requirements: [CAP-11, CAP-12, CAP-13, CAP-14]
autonomous: true
must_haves:
  truths:
    - HumynForegroundService is declared in AndroidManifest.xml with android:foregroundServiceType="camera|microphone|dataSync" and android:exported="false"
    - HumynForegroundService.FGS_TYPE_RECORDING bitmask exactly matches the manifest declaration (FOREGROUND_SERVICE_TYPE_CAMERA | _MICROPHONE | _DATA_SYNC) — Pitfall 6 strict-mode invariant
    - HumynForegroundNotification.ensureChannel(ctx) creates a low-priority NotificationChannel ("Recording", IMPORTANCE_LOW, no badge, no vibration)
    - HumynForegroundNotification.build(ctx, text) returns an ongoing Notification with PRIORITY_LOW
    - ThermalGate.preFlight() returns Result.failure when getCurrentThermalStatus() >= THERMAL_STATUS_THROTTLING (CAP-11)
    - ThermalGate.subscribeMidRecord(onSevere) registers an OnThermalStatusChangedListener firing onSevere when status >= THERMAL_STATUS_SEVERE (CAP-12)
    - setUploadActive(boolean) is a public method on the service (Phase 5 seam — no-op in Phase 3)
    - 3 Wave 0 stubs flip from MISSING to GREEN (HumynForegroundServiceTest, ThermalGateTest, plus manifests/manifests.test.ts asserting the new <service> declaration)
  artifacts:
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt
      provides: FGS subclass with strict-bitmask startForeground + setUploadActive seam
      contains: FGS_TYPE_RECORDING
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt
      provides: low-priority NotificationChannel + Notification builder
      contains: NotificationChannel
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt
      provides: preFlight + subscribeMidRecord PowerManager wrappers
      contains: PowerManager.OnThermalStatusChangedListener
    - path: apps/mobile/android/app/src/main/AndroidManifest.xml
      provides: <service> declaration with foregroundServiceType="camera|microphone|dataSync"
      contains: foregroundServiceType="camera|microphone|dataSync"
  key_links:
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt
      to: apps/mobile/android/app/src/main/AndroidManifest.xml
      via: FGS_TYPE_RECORDING bitmask must EQUAL manifest foregroundServiceType bits
      pattern: foregroundServiceType="camera\|microphone\|dataSync"
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt
      to: android.os.PowerManager
      via: pm.currentThermalStatus + pm.addThermalStatusListener
      pattern: PowerManager
---

<objective>
Implement the foreground service + thermal gate. These two subsystems are the "OS-level surface" of Phase 3 — every other capture component (encoder, audio, IMU) runs INSIDE the FGS for OS lifecycle protection, and the thermal gate is the only mid-record subsystem that can pre-empt a session (CAP-12). Flips 2 Wave 0 stubs to GREEN + adds 1 manifest CI assertion.

Purpose: per CONTEXT.md D-FGS-01 + D-THERM-01, the foreground service lives in Phase 3 (Phase 5 extends with `setUploadActive` wiring); thermal pre-flight + mid-record listener are fully owned by Phase 3. Pitfall 6: manifest bitmask MUST EQUAL the runtime `ServiceCompat.startForeground(..., bitmask)` call — Android 14+ throws `MissingForegroundServiceTypeException` on mismatch.

Output: 3 new Kotlin source files + 1 manifest entry + 2 Wave 0 stubs flipped to GREEN + 1 new manifest assertion in the existing manifests test.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md
@.planning/phases/03-humyn-capture-native-module/03-RESEARCH.md
@.planning/phases/03-humyn-capture-native-module/03-PATTERNS.md
@apps/mobile/android/app/src/main/AndroidManifest.xml
@apps/mobile/__tests__/manifests/manifests.test.ts
@apps/mobile/__tests__/manifests/permissions.test.ts

<interfaces>
<!-- RESEARCH.md Code Example 7 — full FGS pattern with strict bitmask. -->

```kotlin
import android.content.pm.ServiceInfo
import androidx.core.app.ServiceCompat

class HumynForegroundService : Service() {
    private var uploadActive = false
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notif = HumynForegroundNotification.build(this, "Recording in progress")
        ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
        return START_STICKY
    }
    fun setUploadActive(active: Boolean) { uploadActive = active }
    override fun onBind(intent: Intent?): IBinder? = null
    companion object {
        const val NOTIF_ID = 9001
        const val FGS_TYPE_RECORDING =
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
    }
}
```

<!-- Manifest entry that MUST go inside <application> in AndroidManifest.xml. -->

```xml
<service android:name=".fgs.HumynForegroundService"
         android:foregroundServiceType="camera|microphone|dataSync"
         android:exported="false" />
```

The four FOREGROUND*SERVICE*\* permissions are already declared (Phase 1 plan 01-09 + Phase 2 plan 02-22).

<!-- RESEARCH.md Code Example 6 — ThermalGate. -->

```kotlin
class ThermalGate(ctx: Context) {
    private val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    fun preFlight(): Result<Unit> {
        val status = pm.currentThermalStatus
        return if (status >= PowerManager.THERMAL_STATUS_THROTTLING) Result.failure(ThermalRefuseException(status))
        else Result.success(Unit)
    }
    fun subscribeMidRecord(onSevere: () -> Unit): AutoCloseable {
        val listener = PowerManager.OnThermalStatusChangedListener { status ->
            if (status >= PowerManager.THERMAL_STATUS_SEVERE) onSevere()
        }
        pm.addThermalStatusListener(Executors.newSingleThreadExecutor(), listener)
        return AutoCloseable { pm.removeThermalStatusListener(listener) }
    }
}
class ThermalRefuseException(val currentStatus: Int) : RuntimeException("thermal_throttling")
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement HumynForegroundService + Notification + manifest entry + flip HumynForegroundServiceTest to GREEN</name>
  <files>apps/mobile/android/app/src/main/AndroidManifest.xml, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt, apps/mobile/__tests__/manifests/manifests.test.ts</files>
  <read_first>
    - apps/mobile/android/app/src/main/AndroidManifest.xml (full file — find the <application> block where the new <service> goes)
    - apps/mobile/__tests__/manifests/manifests.test.ts (existing manifest assertion pattern; the test reads the manifest XML and runs structural assertions)
    - apps/mobile/__tests__/manifests/permissions.test.ts (sibling — already asserts FOREGROUND_SERVICE_* perms exist; Phase 2 Pattern 53 source)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Example 7 lines 902–943; Pitfall 6 lines 625–635)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-FGS-01, D-FGS-02 — setUploadActive seam)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("HumynForegroundService.kt" + "HumynForegroundNotification.kt" sections)
  </read_first>
  <behavior>
    - HumynForegroundService FGS_TYPE_RECORDING constant equals exactly FOREGROUND_SERVICE_TYPE_CAMERA OR FOREGROUND_SERVICE_TYPE_MICROPHONE OR FOREGROUND_SERVICE_TYPE_DATA_SYNC
    - Manifest <service> declaration foregroundServiceType is exactly "camera|microphone|dataSync" (string match, no whitespace, no other tokens)
    - onStartCommand returns START_STICKY (so OS restarts the service after force-kill if memory permits)
    - setUploadActive(true) sets the internal flag; setUploadActive(false) clears it; Phase 3 itself never calls setUploadActive (Phase 5 will wire it)
    - HumynForegroundNotification.ensureChannel() creates channel id "humyn_capture_fgs" with IMPORTANCE_LOW, setShowBadge(false), enableVibration(false)
    - HumynForegroundNotification.build(ctx, text) returns Notification with setOngoing(true), PRIORITY_LOW, content title "Humyn Labs Capture"
    - manifests.test.ts asserts the <service> entry exists with the exact foregroundServiceType="camera|microphone|dataSync" string
  </behavior>
  <action>
    **1A — Add manifest entry:** open `apps/mobile/android/app/src/main/AndroidManifest.xml`. Inside the `<application>` block (sibling of existing `<activity>`, `<provider>`, etc.), add:

    ```xml
    <service
        android:name=".fgs.HumynForegroundService"
        android:foregroundServiceType="camera|microphone|dataSync"
        android:exported="false" />
    ```

    Place near the other component declarations to keep visual grouping consistent. Do not add new permissions — the four `FOREGROUND_SERVICE_*` permissions (CAMERA, MICROPHONE, DATA_SYNC, plus the umbrella FOREGROUND_SERVICE) are declared per Phase 2 plan 02-22 (verify with grep before edit).

    **1B — Create `HumynForegroundService.kt`:**

    ```kotlin
    package ai.humynlabs.capture.fgs

    import android.app.Service
    import android.content.Intent
    import android.content.pm.ServiceInfo
    import android.os.IBinder
    import androidx.core.app.ServiceCompat
    import java.util.concurrent.atomic.AtomicBoolean

    /**
     * Phase 3 D-FGS-01 — `camera|microphone|dataSync` foreground service.
     *
     * Pitfall 6 strict invariant: `FGS_TYPE_RECORDING` MUST exactly equal the
     * `android:foregroundServiceType` declared in AndroidManifest.xml.
     * Manifest is hand-synced; the `manifests.test.ts` static gate (Phase 2
     * Pattern 53) catches drift on every PR.
     *
     * D-FGS-02 — `setUploadActive(boolean)` is the Phase 5 seam. Phase 3
     * itself never calls it; Phase 5 toggles when its upload pipeline starts
     * a true-background data-sync transfer. The boolean is read serially
     * through the service's main looper — there is no thread-safety hazard
     * for Phase 3.
     */
    class HumynForegroundService : Service() {

        private val uploadActive = AtomicBoolean(false)

        override fun onCreate() {
            super.onCreate()
            HumynForegroundNotification.ensureChannel(this)
        }

        override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
            val notif = HumynForegroundNotification.build(this, "Recording in progress")
            ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
            return START_STICKY
        }

        /** Phase 5 toggles. No-op consequence in Phase 3. */
        fun setUploadActive(active: Boolean) {
            uploadActive.set(active)
            // Phase 5 will downgrade to FOREGROUND_SERVICE_TYPE_DATA_SYNC here when the
            // recording session ends but uploads are still in flight.
        }

        override fun onBind(intent: Intent?): IBinder? = null

        companion object {
            const val NOTIF_ID = 9001

            /**
             * Strict bitmask matching AndroidManifest.xml `foregroundServiceType`.
             * Touching either side without the other → Android 14
             * `MissingForegroundServiceTypeException` at startForeground time.
             */
            const val FGS_TYPE_RECORDING =
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        }
    }
    ```

    **1C — Create `HumynForegroundNotification.kt`:**

    ```kotlin
    package ai.humynlabs.capture.fgs

    import android.app.Notification
    import android.app.NotificationChannel
    import android.app.NotificationManager
    import android.content.Context
    import androidx.core.app.NotificationCompat

    /**
     * Phase 3 — minimal ongoing FGS notification.
     *
     * PROJECT.md "no notifications channel" constraint applies to USER-facing
     * notifications (FCM/APNs). FGS notifications are OS-required system
     * chrome, not opt-in.
     */
    object HumynForegroundNotification {
        const val CHANNEL_ID = "humyn_capture_fgs"
        private const val CHANNEL_NAME = "Recording"

        fun ensureChannel(ctx: Context) {
            val mgr = ctx.getSystemService(NotificationManager::class.java) ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            mgr.createNotificationChannel(channel)
        }

        fun build(ctx: Context, text: String): Notification =
            NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play) // TODO planner: brand icon resource
                .setContentTitle("Humyn Labs Capture")
                .setContentText(text)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true)
                .build()
    }
    ```

    **1D — Replace `HumynForegroundServiceTest.kt` MISSING stub with:**

    ```kotlin
    package ai.humynlabs.capture.fgs

    import android.content.pm.ServiceInfo
    import org.junit.Assert.assertEquals
    import org.junit.Test
    import org.junit.runner.RunWith
    import org.robolectric.RobolectricTestRunner
    import org.robolectric.RuntimeEnvironment
    import org.robolectric.annotation.Config

    @RunWith(RobolectricTestRunner::class)
    @Config(sdk = [34])  // Android 14 strict-mode baseline
    class HumynForegroundServiceTest {

        @Test
        fun `FGS_TYPE_RECORDING bitmask equals camera or microphone or dataSync`() {
            val expected =
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            assertEquals(expected, HumynForegroundService.FGS_TYPE_RECORDING)
        }

        @Test
        fun `notification channel is low priority and silent`() {
            val ctx = RuntimeEnvironment.getApplication()
            HumynForegroundNotification.ensureChannel(ctx)
            val mgr = ctx.getSystemService(android.app.NotificationManager::class.java)
            val channel = mgr.getNotificationChannel(HumynForegroundNotification.CHANNEL_ID)
            assertEquals(android.app.NotificationManager.IMPORTANCE_LOW, channel.importance)
        }

        @Test
        fun `notification build returns ongoing notification`() {
            val ctx = RuntimeEnvironment.getApplication()
            HumynForegroundNotification.ensureChannel(ctx)
            val notif = HumynForegroundNotification.build(ctx, "Recording in progress")
            // Notification.FLAG_ONGOING_EVENT
            assertEquals(android.app.Notification.FLAG_ONGOING_EVENT, notif.flags and android.app.Notification.FLAG_ONGOING_EVENT)
        }

        @Test
        fun `setUploadActive toggles internal flag`() {
            // Robolectric instantiation; field access via reflection isn't worth it here.
            // The contract is: setUploadActive(true) must not crash + must not throw.
            val svc = HumynForegroundService()
            svc.setUploadActive(true)
            svc.setUploadActive(false)
            // No assertion; reaching here means no exception was thrown.
        }
    }
    ```

    **1E — Add manifest assertion to `manifests.test.ts`:** find the existing manifest test and add a new assertion:

    ```ts
    it('declares HumynForegroundService with camera|microphone|dataSync FGS type (Plan 03-06 — Pitfall 6 mitigation)', () => {
      const manifest = readMainManifest();
      // <service android:name=".fgs.HumynForegroundService"
      //          android:foregroundServiceType="camera|microphone|dataSync"
      //          android:exported="false" />
      expect(manifest).toMatch(/<service[^>]*android:name="\.fgs\.HumynForegroundService"/);
      expect(manifest).toMatch(/android:foregroundServiceType="camera\|microphone\|dataSync"/);
    });
    ```

    Adapt the `readMainManifest()` helper name to whatever the existing test uses (likely `readMergedManifest`, `mainManifest`, or similar — read the existing file first).

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.fgs.HumynForegroundServiceTest" 2>&1 | tail -10 && cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/manifests/manifests.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt` exists with `class HumynForegroundService : Service()`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt` exists with `object HumynForegroundNotification`
    - `grep -q "FOREGROUND_SERVICE_TYPE_CAMERA or" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt`
    - `grep -q "android:foregroundServiceType=\"camera|microphone|dataSync\"" apps/mobile/android/app/src/main/AndroidManifest.xml`
    - `grep -q "android:name=\".fgs.HumynForegroundService\"" apps/mobile/android/app/src/main/AndroidManifest.xml`
    - `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt` does NOT contain `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.fgs.HumynForegroundServiceTest"` exits 0
    - `cd apps/mobile && npm test -- --run __tests__/manifests/manifests.test.ts` exits 0 with the new HumynForegroundService assertion green
  </acceptance_criteria>
  <done>FGS + notification + manifest entry land; bitmask invariant test green; manifest static CI gate green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement ThermalGate.kt + flip ThermalGateTest to GREEN</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt</files>
  <read_first>
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Example 6 lines 866–900; Pitfall 4-adjacent thermal-throttling section in CONTEXT.md D-THERM-01)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-THERM-01 — both pre-flight and mid-record listener owned by HumynCapture)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("ThermalGate.kt" section — Robolectric ShadowPowerManager pattern)
  </read_first>
  <behavior>
    - preFlight() returns Result.success(Unit) when getCurrentThermalStatus() < THERMAL_STATUS_THROTTLING (i.e. THERMAL_STATUS_NONE, _LIGHT, _MODERATE)
    - preFlight() returns Result.failure(ThermalRefuseException(status)) when getCurrentThermalStatus() >= THERMAL_STATUS_THROTTLING
    - ThermalRefuseException.currentStatus matches the thermal status read at refuse time
    - subscribeMidRecord(onSevere) registers a listener; when ShadowPowerManager fires THERMAL_STATUS_SEVERE, onSevere is invoked synchronously (or near-synchronously on the dedicated executor)
    - subscribeMidRecord returns an AutoCloseable; close() unregisters the listener
    - Status BELOW THERMAL_STATUS_SEVERE (LIGHT, MODERATE, THROTTLING) does NOT fire onSevere
  </behavior>
  <action>
    Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt`:

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.content.Context
    import android.os.PowerManager
    import java.util.concurrent.Executors

    /**
     * Phase 3 D-THERM-01 — pre-flight + mid-record thermal gating.
     *
     * Pre-flight: rejects start when `getCurrentThermalStatus() ≥ THROTTLING`
     * (CAP-11). Caller (Plan 03-09 / 03-10) maps `ThermalRefuseException` → Promise
     * reject with `{code: 'thermal_throttling', recoverable: true,
     * currentStatus}`.
     *
     * Mid-record: subscribes via `OnThermalStatusChangedListener`. On `≥
     * SEVERE`, the supplied `onSevere` callback fires once. Caller schedules
     * a 2.5 s graceful stop (CAP-12) + emits `onThermalAbort`.
     */
    class ThermalGate(ctx: Context) {

        private val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager

        fun preFlight(): Result<Unit> {
            val status = pm.currentThermalStatus
            return if (status >= PowerManager.THERMAL_STATUS_THROTTLING) {
                Result.failure(ThermalRefuseException(status))
            } else Result.success(Unit)
        }

        fun subscribeMidRecord(onSevere: (Int) -> Unit): AutoCloseable {
            val executor = Executors.newSingleThreadExecutor()
            val listener = PowerManager.OnThermalStatusChangedListener { status ->
                if (status >= PowerManager.THERMAL_STATUS_SEVERE) onSevere(status)
            }
            pm.addThermalStatusListener(executor, listener)
            return AutoCloseable {
                pm.removeThermalStatusListener(listener)
                executor.shutdownNow()
            }
        }
    }

    class ThermalRefuseException(val currentStatus: Int) : RuntimeException("thermal_throttling")
    ```

    **Test — replace MISSING stub:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.os.PowerManager
    import org.junit.Assert.assertEquals
    import org.junit.Assert.assertNotNull
    import org.junit.Assert.assertNull
    import org.junit.Assert.assertTrue
    import org.junit.Before
    import org.junit.Test
    import org.junit.runner.RunWith
    import org.robolectric.RobolectricTestRunner
    import org.robolectric.RuntimeEnvironment
    import org.robolectric.Shadows.shadowOf
    import org.robolectric.annotation.Config

    @RunWith(RobolectricTestRunner::class)
    @Config(sdk = [33])
    class ThermalGateTest {

        private val ctx = RuntimeEnvironment.getApplication()
        private lateinit var gate: ThermalGate

        @Before fun setup() { gate = ThermalGate(ctx) }

        private fun setStatus(status: Int) {
            val pm = ctx.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
            shadowOf(pm).setCurrentThermalStatus(status)
        }

        @Test fun `preFlight succeeds when thermal status NONE`() {
            setStatus(PowerManager.THERMAL_STATUS_NONE)
            assertTrue(gate.preFlight().isSuccess)
        }

        @Test fun `preFlight succeeds when thermal status MODERATE`() {
            setStatus(PowerManager.THERMAL_STATUS_MODERATE)
            assertTrue(gate.preFlight().isSuccess)
        }

        @Test fun `preFlight fails with ThermalRefuseException when THROTTLING`() {
            setStatus(PowerManager.THERMAL_STATUS_THROTTLING)
            val r = gate.preFlight()
            assertTrue(r.isFailure)
            val e = r.exceptionOrNull()
            assertTrue(e is ThermalRefuseException)
            assertEquals(PowerManager.THERMAL_STATUS_THROTTLING, (e as ThermalRefuseException).currentStatus)
            assertEquals("thermal_throttling", e.message)
        }

        @Test fun `preFlight fails when status escalated to SEVERE`() {
            setStatus(PowerManager.THERMAL_STATUS_SEVERE)
            assertTrue(gate.preFlight().isFailure)
        }

        @Test fun `subscribeMidRecord fires onSevere when status reaches SEVERE`() {
            var fired: Int? = null
            val sub = gate.subscribeMidRecord { fired = it }
            // Robolectric ShadowPowerManager dispatches listeners synchronously in test thread
            setStatus(PowerManager.THERMAL_STATUS_SEVERE)
            // Drain any pending tasks
            shadowOf(android.os.Looper.getMainLooper()).idle()
            // The listener executor is a single-thread; allow up to 100ms for dispatch.
            Thread.sleep(100)
            assertNotNull("onSevere should have fired", fired)
            assertEquals(PowerManager.THERMAL_STATUS_SEVERE, fired)
            sub.close()
        }

        @Test fun `subscribeMidRecord does NOT fire on MODERATE`() {
            var fired: Int? = null
            val sub = gate.subscribeMidRecord { fired = it }
            setStatus(PowerManager.THERMAL_STATUS_MODERATE)
            Thread.sleep(100)
            assertNull("onSevere should NOT have fired for MODERATE", fired)
            sub.close()
        }

        @Test fun `close unregisters listener`() {
            var fired: Int? = null
            val sub = gate.subscribeMidRecord { fired = it }
            sub.close()
            setStatus(PowerManager.THERMAL_STATUS_SEVERE)
            Thread.sleep(100)
            assertNull("listener removed before SEVERE; onSevere must NOT fire", fired)
        }
    }
    ```

    Note: Robolectric's `ShadowPowerManager.setCurrentThermalStatus(status)` triggers registered listeners. If the executor dispatches asynchronously and the test's 100 ms wait proves flaky in CI, increase to 250 ms or switch to a `CountDownLatch`-based wait for stability.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.ThermalGateTest"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt` exists with `class ThermalGate` and `class ThermalRefuseException`
    - `grep -q "PowerManager.OnThermalStatusChangedListener" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt`
    - `grep -q "PowerManager.THERMAL_STATUS_THROTTLING" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt`
    - `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt` does NOT contain `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.ThermalGateTest"` exits 0 with all 7 test cases green
  </acceptance_criteria>
  <done>ThermalGate implemented; pre-flight + mid-record listener tests green.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                    | Description                                   |
| ------------------------------------------- | --------------------------------------------- |
| Manifest declaration ↔ runtime FGS bitmask | Pitfall 6 strict-mode invariant               |
| PowerManager status → mid-record listener   | OS-driven event source; no user input crosses |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                                             | Disposition | Mitigation Plan                                                                                                                                                                                                                                           |
| --------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.6-01  | DoS                    | FGS-downgrade race condition (Phase 3 stops service while Phase 5 thread calls setUploadActive(true)) | mitigate    | `uploadActive` is `AtomicBoolean` for atomic read/write across threads. Phase 5's planner is responsible for the higher-level lifecycle (don't call setUploadActive after the service has stopped); Phase 3 surfaces the seam, Phase 5 owns the contract. |
| T-3.6-02  | Tampering              | Manifest bitmask drift from runtime constant                                                          | mitigate    | `manifests.test.ts` static gate (Pattern 53) asserts the literal `foregroundServiceType="camera                                                                                                                                                           | microphone | dataSync"`string on every PR. Plus`HumynForegroundServiceTest` asserts the runtime bitmask equals the OR of the same three constants. Both must agree or one of the tests fails. |
| T-3.6-03  | DoS                    | Thermal listener leak (caller forgets to close subscription)                                          | mitigate    | `subscribeMidRecord` returns `AutoCloseable`; Plan 03-10's `CaptureSession.stop()` includes the `.close()` call inside the cleanup `finally` block. Service-lifetime executor on `Executors.newSingleThreadExecutor()` is shutdownNow on close.           |
| T-3.6-04  | Information disclosure | Foreground notification reveals "Recording in progress" to anyone seeing the device                   | accept      | OS-mandated; user just initiated capture, so visibility is expected. Notification has no PII (no contributor name, no task name) — only the brand title and generic state text.                                                                           |
| T-3.6-05  | DoS                    | Thermal pre-flight false-positive on devices with bugged PowerManager                                 | accept      | RESEARCH.md notes Pixel 7a/8a/10a (target devices) honor PowerManager cleanly. OEM matrix expansion happens in Phase 4 thermal walk.                                                                                                                      |

</threat_model>

<verification>
- Manifest carries the new `<service>` declaration with exact `foregroundServiceType="camera|microphone|dataSync"` string.
- HumynForegroundService bitmask equals the OR of the three FOREGROUND_SERVICE_TYPE_* constants.
- `manifests.test.ts` asserts the manifest entry.
- `HumynForegroundServiceTest` flips MISSING → GREEN.
- `ThermalGateTest` flips MISSING → GREEN with all 7 test cases passing.
- 14 of 17 Wave 0 stubs still MISSING (Plan 03-08 takes 4, Plan 03-10 takes 5 — math: 17 total - 1 from Plan 03-04 (FragmentedMuxerWrapper) - 6 from Plan 03-05 - 1 from Plan 03-06 - 2 from this plan = 7 still MISSING; my count slipped above — verify in SUMMARY).
- `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugSources :app:assembleApkRolloutDebug` exits 0 (manifest + service compile cleanly).
- Phase 2 + Phase 3 Wave 1 + Plans 03-03/04/05 suites stay green.
</verification>

<success_criteria>

- ✓ `<service>` declaration in AndroidManifest.xml with foregroundServiceType="camera|microphone|dataSync" and exported="false".
- ✓ `HumynForegroundService` ships strict-bitmask FGS_TYPE_RECORDING + setUploadActive seam (Phase 5 wires).
- ✓ `HumynForegroundNotification` creates IMPORTANCE_LOW silent ongoing channel + notification.
- ✓ `ThermalGate.preFlight()` rejects on THERMAL_STATUS_THROTTLING; `subscribeMidRecord` fires onSevere at THERMAL_STATUS_SEVERE.
- ✓ `manifests.test.ts` asserts the new service entry (Phase 2 Pattern 53 extension).
- ✓ HumynForegroundServiceTest + ThermalGateTest flipped from MISSING to GREEN.
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-07-SUMMARY.md` per the canonical summary template — including:

- Pattern callout: "FGS strict-bitmask invariant" — runtime constant + manifest declaration in lock-step, with both static (manifests.test.ts) and runtime (HumynForegroundServiceTest) gates.
- Pattern callout: "Thermal pre-flight + listener" — Result-based pre-flight + AutoCloseable subscription.
- Wave 0 progress update (count of stubs flipped to GREEN).
- Note: Phase 5 will extend `setUploadActive` — verify the seam ships cleanly.
  </output>
