---
phase: 03-humyn-capture-native-module
plan_id: 03-09
plan: 9
type: execute
wave: 5
depends_on: [03-04, 03-05, 03-06, 03-07, 03-08]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridgeTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt
  - apps/mobile/__tests__/native/HumynCapture.test.ts
  - .planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md
requirements: [CAP-09, CAP-13, CAP-14]
autonomous: true
must_haves:
  truths:
    - HumynCaptureModule registered in MainApplication.getPackages() so JS NativeModules.HumynCapture resolves
    - HumynCaptureModule exposes start(opts: ReadableMap, promise: Promise) and stop(promise: Promise) bound to captureExecutor
    - SegmentDurationConfig.load() reads Firebase Remote Config "capture.segment_minutes" with 10L default fallback
    - CaptureSessionOptsBridge.fromBridge(ReadableMap) parses the JS bridge map into the Kotlin CaptureSessionOpts shape with defense-in-depth consent !== true rejection (mirrors the Plan 03-04 Zod schema)
    - CaptureLaunchSweep runs in MainApplication.onCreate after the existing compat-probe sweep — for each recordings/*.mp4 without .json, attempt re-finalize via .session.json sidecar; delete orphan .json + practice/* > 24 h
    - Firebase Remote Config defaults set in MainApplication.onCreate (capture.segment_minutes → 10L)
    - HumynForegroundNotification channel created in MainApplication.onCreate
    - HumynCapture.test.ts gains a 5th describe block "registered with native side wired" asserting start/stop/event helpers exist and have callable shapes
    - 03-MANUAL-SMOKE.md authored covering apkRollout module-load + JS bridge contract + Phase 4 deferral note
    - CaptureSession + FinalizeWorker + the 5 remaining Wave 0 stubs are explicitly DEFERRED to Plan 03-10 (issue #9 split)
  artifacts:
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
      provides: TurboModule entry point with start/stop Promise + NativeEventEmitter; delegates segment lifecycle to Plan 03-10's CaptureSession
      exports: ["HumynCaptureModule"]
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt
      provides: ReactPackage registration (mirrors HumynCompatPackage)
      exports: ["HumynCapturePackage"]
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt
      provides: ReadableMap → CaptureSessionOpts parser with consent + dfovDegrees + taskSetting validation; testable in isolation
      exports: ["CaptureSessionOptsBridge"]
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt
      provides: Firebase Remote Config read for capture.segment_minutes with default 10L fallback
      contains: capture.segment_minutes
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
      provides: app-launch orphan sweep over recordings/ + practice/
      contains: '*.session.json'
    - path: .planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md
      provides: phase-end smoke runbook (apkRollout module-load + JS bridge contract; Phase 4 deferral)
      contains: deferred-to-phase-4
  key_links:
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt
      via: packages.add(HumynCapturePackage())
      pattern: HumynCapturePackage\(\)
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt
      via: CaptureSessionOptsBridge.fromBridge(optsMap)
      pattern: CaptureSessionOptsBridge\.fromBridge
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
      via: CaptureLaunchSweep(filesDir).run() in onCreate
      pattern: CaptureLaunchSweep
---

<objective>
Wave 5 — orchestrator part 1 (the JS-callable surface). Wires HumynCaptureModule + Package + SegmentDurationConfig + CaptureSessionOptsBridge into MainApplication so JS `NativeModules.HumynCapture` resolves at runtime; ships CaptureLaunchSweep alongside the existing Phase 2 compat-probe sweep; extends the JS bridge integration test; authors `03-MANUAL-SMOKE.md` for the apkRollout module-load smoke.

Per checker issue #9 split: this plan does NOT ship the segment lifecycle. CaptureSession.kt + FinalizeWorker.kt + the 5 remaining Wave 0 stub flips (StartGateCarryoverTest, EventEmissionTest, ClockAlignmentTest, RealtimeGateTest, FileFidelityTest) live in Plan 03-10. The HumynCaptureModule shipped in this plan delegates `start()` / `stop()` to a `CaptureSession` reference that Plan 03-10 fills in — until 03-10 lands, calling `start()` from JS rejects with `not_implemented_in_03_09` so the smoke test surface is operational.

Per CONTEXT.md D-WAVE-01: "Phase 3 acceptance is module-ready + Kotlin pure-fn unit tests + JS bridge contract." This plan ships the bridge contract; Plan 03-10 ships the orchestrator under it.

Output: 4 new Kotlin source files (HumynCaptureModule, HumynCapturePackage, CaptureSessionOptsBridge, SegmentDurationConfig) + 1 new Kotlin source (CaptureLaunchSweep) + MainApplication.kt extension + 1 Kotlin Robolectric test (CaptureLaunchSweepTest) + 1 Kotlin Robolectric test (CaptureSessionOptsBridgeTest) + JS bridge test extension + 03-MANUAL-SMOKE.md runbook.
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
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt
@apps/mobile/__tests__/native/HumynCapture.test.ts
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-MANUAL-SMOKE.md

<interfaces>
<!-- HumynCompatModule is the canonical TurboModule pattern Phase 3 mirrors structurally. -->

```kotlin
@ReactModule(name = HumynCompatModule.NAME)
class HumynCompatModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object { const val NAME = "HumynCompat" }
    private val bgExecutor = Executors.newSingleThreadExecutor()
    override fun getName(): String = NAME
    @ReactMethod fun runEncoderProbe(promise: Promise) {
        bgExecutor.execute {
            try {
                val result = EncoderProbe(reactApplicationContext).run()
                promise.resolve(...)
            } catch (t: Throwable) { promise.reject("ENCODER_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t) }
        }
    }
}
```

<!-- D-API-02 contract (verbatim from CONTEXT.md). CaptureSessionOptsBridge.fromBridge must accept this shape. -->

```ts
type CaptureSessionOpts = {
  taskId: string;
  taskName: string;
  taskCategory: string;
  taskSetting: 'indoor' | 'outdoor';
  contributor: {
    name: string;
    email: string;
    age: number | null;
    gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
    consent: true;
  };
  isPractice: boolean;
  startGate: {
    type: 'hand_detection';
    passed: boolean;
    skipped: boolean;
    bypassed: boolean;
    durationMs: number;
    consecutiveHitsRequired: number;
    platformCadenceMs: number;
  };
  location: string | null;
  appVersion: string;
  dfovDegrees: number;
};
```

<!-- MainApplication.kt onCreate sweep pattern (lines 49–59). -->

```kotlin
override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    load()
    cacheDir.listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
        ?.forEach { it.delete() }
}
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement HumynCaptureModule + Package + SegmentDurationConfig + CaptureSessionOptsBridge + register in MainApplication</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridgeTest.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt (canonical TurboModule pattern — full file)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt (verbatim ReactPackage pattern)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (full file — find getPackages() lines 28–35 + onCreate lines 49–59)
    - apps/mobile/src/native/HumynCapture.ts (the typed JS bridge from Plan 03-04 — confirms the contract Kotlin must satisfy)
    - shared/types/src/CaptureSessionOpts.ts (the Zod schema; CaptureSessionOptsBridge mirrors its parse + reject behavior)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-API-01 + D-API-02 + D-API-03 + D-SEG-01 — segment timer ownership; D-FGS-01 — service start)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Pattern 3 lines 444–479 + Code Example 10 lines 1004–1027 — Remote Config read)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("HumynCaptureModule.kt" + "HumynCapturePackage.kt" + "MainApplication.kt MODIFY" sections)
  </read_first>
  <behavior>
    - HumynCaptureModule.NAME == "HumynCapture"
    - start(optsMap, promise) parses CaptureSessionOpts via CaptureSessionOptsBridge.fromBridge; on consent != true rejects with code "consent_invalid"; on any field validation failure rejects with code "invalid_opts" + the failed field name
    - start() loads SegmentDurationConfig (Remote Config "capture.segment_minutes"; default 10L)
    - In Plan 03-09 (this plan), start() rejects with code "not_implemented_in_03_09" if invoked AFTER opts validation passes — Plan 03-10 replaces this stub with the real CaptureSession allocation. The Promise.reject path is intentional: it makes the JS bridge integration test exercise the validation surface without requiring the full encoder pipeline.
    - stop() rejects with "no_active_session" (no session can be started in 03-09 standalone)
    - HumynCapturePackage.createNativeModules returns listOf(HumynCaptureModule(reactContext)); createViewManagers returns emptyList()
    - MainApplication.getPackages() now registers HumynCapturePackage() alongside the existing four
    - SegmentDurationConfig.load() returns Long minutes — Firebase Remote Config reads "capture.segment_minutes"; on any error returns default 10L
    - CaptureSessionOptsBridge.fromBridge(ReadableMap) extracts every D-API-02 field; validates non-empty strings, taskSetting ∈ {"indoor","outdoor"}, contributor.consent === true, dfovDegrees > 0, semver-shaped appVersion, gender ∈ {nullable enum}; throws IllegalArgumentException("invalid_opts: $field") on any miss
    - CaptureSessionOptsBridgeTest covers: valid map → returns CaptureSessionOpts; consent=false → throws with "consent_invalid"; missing taskId → throws with "invalid_opts: taskId"; dfovDegrees=0 → throws with "invalid_opts: dfovDegrees"
  </behavior>
  <action>
    **1A — Create `HumynCapturePackage.kt`** (verbatim of HumynCompatPackage.kt with two name swaps):

    ```kotlin
    package ai.humynlabs.capture.capture

    import com.facebook.react.ReactPackage
    import com.facebook.react.bridge.NativeModule
    import com.facebook.react.bridge.ReactApplicationContext
    import com.facebook.react.uimanager.ViewManager

    class HumynCapturePackage : ReactPackage {
        override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
            listOf(HumynCaptureModule(reactContext))
        override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
            emptyList()
    }
    ```

    **1B — Create `SegmentDurationConfig.kt`** (RESEARCH.md Code Example 10 with safe fallback):

    ```kotlin
    package ai.humynlabs.capture.capture

    import com.google.firebase.remoteconfig.FirebaseRemoteConfig

    /**
     * Phase 3 D-SEG-01 — read `capture.segment_minutes` from Firebase Remote Config.
     *
     * Default 10L (idea-brief.md §6: 10-min auto-segment). On any error
     * (no Firebase init, no network, fetch timeout) returns the default.
     *
     * Phase 2 already wired @react-native-firebase/remote-config 24.0.0 in
     * apps/mobile/package.json; the Kotlin SDK reads from the same instance.
     */
    object SegmentDurationConfig {
        const val KEY = "capture.segment_minutes"
        const val DEFAULT_MINUTES = 10L

        fun load(): Long = try {
            val rc = FirebaseRemoteConfig.getInstance()
            // Defaults are set in MainApplication.onCreate via setDefaultsAsync(mapOf(KEY to DEFAULT_MINUTES))
            rc.getLong(KEY).takeIf { it > 0 } ?: DEFAULT_MINUTES
        } catch (_: Throwable) {
            DEFAULT_MINUTES
        }
    }
    ```

    **1C — Create `CaptureSessionOptsBridge.kt`** (per checker issue #14 — dedicated file for testability):

    ```kotlin
    package ai.humynlabs.capture.capture

    import com.facebook.react.bridge.ReadableMap

    /**
     * Phase 3 — ReadableMap → Kotlin CaptureSessionOpts parser.
     *
     * Mirrors the JS-side Zod schema (shared/types/src/CaptureSessionOpts.ts;
     * shipped in Plan 03-04). Defense-in-depth at the Kotlin bridge: the JS
     * Zod schema rejects malformed input first, but a malicious / buggy JS
     * caller could bypass that and call NativeModules.HumynCapture.start
     * directly with any ReadableMap. This parser refuses anything that
     * doesn't match D-API-02 verbatim.
     *
     * Lives in its own file (not nested inside CaptureSession.kt) so a
     * Robolectric test can exercise the validation surface in isolation
     * without bringing up Camera2 + MediaCodec.
     */
    data class CaptureSessionOpts(
        val taskId: String,
        val taskName: String,
        val taskCategory: String,
        val taskSetting: String, // "indoor" | "outdoor"
        val contributor: Contributor,
        val isPractice: Boolean,
        val startGate: StartGateOpts,
        val location: String?,
        val appVersion: String,
        val dfovDegrees: Double,
    )

    data class Contributor(
        val name: String,
        val email: String,
        val age: Int?,
        val gender: String?, // nullable enum
        val consent: Boolean,
    )

    data class StartGateOpts(
        val type: String, // literal "hand_detection"
        val passed: Boolean,
        val skipped: Boolean,
        val bypassed: Boolean,
        val durationMs: Int,
        val consecutiveHitsRequired: Int,
        val platformCadenceMs: Int,
    )

    object CaptureSessionOptsBridge {
        private val SEMVER = Regex("^\\d+\\.\\d+\\.\\d+(?:[+-].+)?$")
        private val ALLOWED_TASK_SETTINGS = setOf("indoor", "outdoor")
        private val ALLOWED_GENDERS = setOf("male", "female", "non-binary", "prefer-not-to-say")

        fun fromBridge(map: ReadableMap): CaptureSessionOpts {
            val taskId = requireNonEmpty(map, "taskId")
            val taskName = requireNonEmpty(map, "taskName")
            val taskCategory = requireNonEmpty(map, "taskCategory")
            val taskSetting = requireString(map, "taskSetting").also {
                require(it in ALLOWED_TASK_SETTINGS) { "invalid_opts: taskSetting" }
            }
            val contributorMap = map.getMap("contributor")
                ?: throw IllegalArgumentException("invalid_opts: contributor")
            val contributor = Contributor(
                name = requireNonEmpty(contributorMap, "name"),
                email = requireNonEmpty(contributorMap, "email"),
                age = if (contributorMap.isNull("age")) null else contributorMap.getInt("age"),
                gender = if (contributorMap.isNull("gender")) null else {
                    val g = contributorMap.getString("gender") ?: throw IllegalArgumentException("invalid_opts: gender")
                    require(g in ALLOWED_GENDERS) { "invalid_opts: gender" }
                    g
                },
                consent = contributorMap.getBoolean("consent"),
            )
            require(contributor.consent) { "consent_invalid" }
            val isPractice = map.getBoolean("isPractice")
            val sgMap = map.getMap("startGate") ?: throw IllegalArgumentException("invalid_opts: startGate")
            val startGate = StartGateOpts(
                type = sgMap.getString("type")?.takeIf { it == "hand_detection" } ?: throw IllegalArgumentException("invalid_opts: startGate.type"),
                passed = sgMap.getBoolean("passed"),
                skipped = sgMap.getBoolean("skipped"),
                bypassed = sgMap.getBoolean("bypassed"),
                durationMs = sgMap.getInt("durationMs").also { require(it >= 0) { "invalid_opts: startGate.durationMs" } },
                consecutiveHitsRequired = sgMap.getInt("consecutiveHitsRequired").also { require(it > 0) { "invalid_opts: startGate.consecutiveHitsRequired" } },
                platformCadenceMs = sgMap.getInt("platformCadenceMs").also { require(it > 0) { "invalid_opts: startGate.platformCadenceMs" } },
            )
            val location = if (map.isNull("location")) null else map.getString("location")
            val appVersion = requireString(map, "appVersion").also {
                require(SEMVER.matches(it)) { "invalid_opts: appVersion" }
            }
            val dfovDegrees = map.getDouble("dfovDegrees").also {
                require(it > 0) { "invalid_opts: dfovDegrees" }
            }
            return CaptureSessionOpts(
                taskId, taskName, taskCategory, taskSetting,
                contributor, isPractice, startGate, location, appVersion, dfovDegrees,
            )
        }

        private fun requireString(map: ReadableMap, key: String): String =
            map.getString(key) ?: throw IllegalArgumentException("invalid_opts: $key")

        private fun requireNonEmpty(map: ReadableMap, key: String): String =
            requireString(map, key).also { require(it.isNotEmpty()) { "invalid_opts: $key" } }
    }
    ```

    **1D — Create `HumynCaptureModule.kt`** (Plan 03-09 stub: validates opts, then rejects `not_implemented_in_03_09`. Plan 03-10 replaces the body):

    ```kotlin
    package ai.humynlabs.capture.capture

    import com.facebook.react.bridge.Promise
    import com.facebook.react.bridge.ReactApplicationContext
    import com.facebook.react.bridge.ReactContextBaseJavaModule
    import com.facebook.react.bridge.ReactMethod
    import com.facebook.react.bridge.ReadableMap
    import com.facebook.react.module.annotations.ReactModule
    import com.facebook.react.modules.core.DeviceEventManagerModule
    import com.facebook.react.bridge.WritableMap
    import java.util.concurrent.Executors

    @ReactModule(name = HumynCaptureModule.NAME)
    class HumynCaptureModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

        companion object { const val NAME = "HumynCapture" }

        // Plan 03-10 fills in the real session lifecycle.
        // Plan 03-09 ships the entry point + opts validation only.
        private val captureExecutor = Executors.newSingleThreadExecutor()
        @Volatile private var sessionActive: Boolean = false

        override fun getName(): String = NAME

        @ReactMethod
        fun start(optsMap: ReadableMap, promise: Promise) {
            captureExecutor.execute {
                try {
                    val opts = CaptureSessionOptsBridge.fromBridge(optsMap)
                    val durationMs = SegmentDurationConfig.load() * 60_000L
                    // Plan 03-10 entry point. Until 03-10 lands the orchestrator,
                    // surface a clear error so the JS bridge integration test
                    // exercises this validation surface without spinning up Camera2.
                    promise.reject(
                        "not_implemented_in_03_09",
                        "HumynCapture validation surface is wired in Plan 03-09; the encoder + IMU + muxer + thermal lifecycle ships in Plan 03-10. Opts parsed OK; durationMs=$durationMs. Active session: $sessionActive.",
                    )
                } catch (e: IllegalArgumentException) {
                    val code = if (e.message == "consent_invalid") "consent_invalid" else "invalid_opts"
                    promise.reject(code, e.message ?: "capture_start_failed", e)
                } catch (t: Throwable) {
                    promise.reject("internal_error", t.message ?: "capture_start_failed", t)
                }
            }
        }

        @ReactMethod
        fun stop(promise: Promise) {
            captureExecutor.execute {
                if (!sessionActive) {
                    promise.reject("no_active_session", "no session was started; Plan 03-09 cannot start sessions (see Plan 03-10)", null)
                    return@execute
                }
                // Plan 03-10 fills in the real stop logic.
                promise.reject("not_implemented_in_03_09", "Stop logic ships in Plan 03-10", null)
            }
        }

        internal fun emitEvent(name: String, payload: WritableMap) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(name, payload)
        }
    }
    ```

    **1E — Modify `MainApplication.kt`:** add ONE line to `getPackages()`:

    ```kotlin
    packages.add(HumynCapturePackage())  // Plan 03-09 — Phase 3 capture pipeline entry
    ```

    Place after `HumynUpdaterPackage()`. Also add the import: `import ai.humynlabs.capture.capture.HumynCapturePackage`.

    Add Firebase Remote Config defaults in `onCreate()`:

    ```kotlin
    // Phase 3 — set capture.segment_minutes default (read by SegmentDurationConfig.load())
    try {
        com.google.firebase.remoteconfig.FirebaseRemoteConfig.getInstance().setDefaultsAsync(
            mapOf(SegmentDurationConfig.KEY to SegmentDurationConfig.DEFAULT_MINUTES)
        )
    } catch (_: Throwable) { /* Phase 2 already wired the SDK; default suffices on failure */ }

    // Phase 3 — ensure FGS notification channel exists for the next start() (Plan 03-07 ships the helper)
    HumynForegroundNotification.ensureChannel(this)
    ```

    Both blocks go inside the existing `onCreate()` after the compat-probe sweep, before any UI bootstrap. Add the imports.

    **1F — `CaptureSessionOptsBridgeTest.kt`** (Robolectric Robust ReadableMap fixture):

    ```kotlin
    package ai.humynlabs.capture.capture

    import com.facebook.react.bridge.JavaOnlyMap
    import org.junit.Assert.*
    import org.junit.Test
    import org.junit.runner.RunWith
    import org.robolectric.RobolectricTestRunner

    @RunWith(RobolectricTestRunner::class)
    class CaptureSessionOptsBridgeTest {
        private fun validMap(): JavaOnlyMap = JavaOnlyMap().apply {
            putString("taskId", "cooking.chopping")
            putString("taskName", "Chopping vegetables")
            putString("taskCategory", "cooking")
            putString("taskSetting", "indoor")
            putMap("contributor", JavaOnlyMap().apply {
                putString("name", "Alice")
                putString("email", "alice@example.com")
                putInt("age", 28)
                putString("gender", "female")
                putBoolean("consent", true)
            })
            putBoolean("isPractice", false)
            putMap("startGate", JavaOnlyMap().apply {
                putString("type", "hand_detection")
                putBoolean("passed", true)
                putBoolean("skipped", false)
                putBoolean("bypassed", false)
                putInt("durationMs", 3420)
                putInt("consecutiveHitsRequired", 5)
                putInt("platformCadenceMs", 400)
            })
            putString("location", "Bangalore, India")
            putString("appVersion", "1.0.0")
            putDouble("dfovDegrees", 115.0)
        }

        @Test fun `valid map parses to CaptureSessionOpts`() {
            val opts = CaptureSessionOptsBridge.fromBridge(validMap())
            assertEquals("cooking.chopping", opts.taskId)
            assertEquals("indoor", opts.taskSetting)
            assertEquals(true, opts.contributor.consent)
            assertEquals(115.0, opts.dfovDegrees, 0.0)
        }

        @Test fun `consent false throws consent_invalid`() {
            val m = validMap()
            m.getMap("contributor")!!.let { (it as JavaOnlyMap).putBoolean("consent", false) }
            try { CaptureSessionOptsBridge.fromBridge(m); fail("should throw") }
            catch (e: IllegalArgumentException) { assertEquals("consent_invalid", e.message) }
        }

        @Test fun `taskSetting outside enum throws`() {
            val m = validMap().apply { putString("taskSetting", "garage") }
            try { CaptureSessionOptsBridge.fromBridge(m); fail("should throw") }
            catch (e: IllegalArgumentException) {
                assertTrue(e.message!!.contains("taskSetting"))
            }
        }

        @Test fun `dfovDegrees zero throws`() {
            val m = validMap().apply { putDouble("dfovDegrees", 0.0) }
            try { CaptureSessionOptsBridge.fromBridge(m); fail("should throw") }
            catch (e: IllegalArgumentException) {
                assertTrue(e.message!!.contains("dfovDegrees"))
            }
        }

        @Test fun `invalid appVersion throws`() {
            val m = validMap().apply { putString("appVersion", "not-a-version") }
            try { CaptureSessionOptsBridge.fromBridge(m); fail("should throw") }
            catch (e: IllegalArgumentException) {
                assertTrue(e.message!!.contains("appVersion"))
            }
        }
    }
    ```

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:compileApkRolloutDebugSources :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.CaptureSessionOptsBridgeTest" 2>&1 | tail -20 && grep -q "HumynCapturePackage()" /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt` exists with `class HumynCaptureModule` extending `ReactContextBaseJavaModule`
    - `grep -q 'const val NAME = "HumynCapture"' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt`
    - `grep -q "captureExecutor" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt`
    - `grep -q "not_implemented_in_03_09" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt` exists with `class HumynCapturePackage : ReactPackage`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt` exists with `KEY = "capture.segment_minutes"` and `DEFAULT_MINUTES = 10L`
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt` exists with `object CaptureSessionOptsBridge { fun fromBridge(...) }` (per issue #14 — dedicated file, not inline)
    - `grep -q "HumynCapturePackage()" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`
    - `grep -q "HumynForegroundNotification.ensureChannel" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`
    - `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugSources` exits 0 (full compile clean)
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.CaptureSessionOptsBridgeTest"` exits 0 (5 test cases all green)
  </acceptance_criteria>
  <done>HumynCaptureModule + Package + SegmentDurationConfig + CaptureSessionOptsBridge land. JS NativeModules.HumynCapture resolves. Plan 03-10 will replace the start()/stop() stubs with the real CaptureSession lifecycle.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: CaptureLaunchSweep + extend MainApplication.onCreate sweep + JS bridge integration test</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt, apps/mobile/__tests__/native/HumynCapture.test.ts</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (lines 49–59 — existing onCreate sweep)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt (orphan-sweep test pattern)
    - apps/mobile/__tests__/native/HumynCapture.test.ts (existing tests from Plan 03-04)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-FS-04 — sweep responsibilities)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt (Plan 03-05 — sidecar parser used by sweep)
  </read_first>
  <behavior>
    - CaptureLaunchSweep(filesDir).run() does three sweeps:
      1. recordings/*.mp4 without matching .json → if .session.json sidecar exists AND parseable, leave for Phase 4 re-finalize (log + preserve); if sidecar corrupt or missing, delete the triple
      2. recordings/*.json without matching .mp4 → delete (orphan JSON)
      3. practice/* files older than 24 h → delete
    - MainApplication.onCreate calls CaptureLaunchSweep(filesDir).run() AFTER the existing compat-probe-*.mp4 cacheDir sweep
    - HumynCapture.test.ts gains a 5th describe block "registered with native side wired" asserting start/stop/event helpers exist + are tree-shake-resistant
  </behavior>
  <action>
    **2A — `CaptureLaunchSweep.kt`:**

    ```kotlin
    package ai.humynlabs.capture.capture

    import android.util.Log
    import java.io.File

    /**
     * Phase 3 D-FS-04 — app-launch orphan sweep over filesDir/recordings/ + filesDir/practice/.
     *
     * Sweeps:
     *   1. recordings/*.mp4 without matching .json: if .session.json sidecar
     *      exists AND parseable → log + leave (Phase 4's RecordingScreen
     *      will call HumynCapture.start() which triggers a re-finalize
     *      attempt). If no sidecar OR parse fails → delete the triple.
     *   2. recordings/*.json without matching .mp4 → delete (orphan JSON).
     *   3. practice/* files older than 24 h → delete (defensive — ONB-08
     *      says practice runs once per install per Google account; old
     *      practice files are crash residue).
     *
     * Phase 5 owns delete-on-`verified` for already-uploaded triples;
     * Phase 3 explicitly does NOT touch verified-but-undeleted files.
     */
    class CaptureLaunchSweep(private val filesDir: File) {
        fun run() {
            sweepRecordings()
            sweepPractice()
        }

        private fun sweepRecordings() {
            val recordingsDir = File(filesDir, "recordings")
            if (!recordingsDir.exists()) return

            val mp4s = recordingsDir.listFiles { f -> f.name.endsWith(".mp4") } ?: emptyArray()
            for (mp4 in mp4s) {
                val base = mp4.nameWithoutExtension
                val json = File(recordingsDir, "$base.json")
                val sidecar = File(recordingsDir, "$base.session.json")
                if (!json.exists()) {
                    if (sidecar.exists()) {
                        try {
                            SidecarManager.read(sidecar)
                            Log.i(TAG, "orphan_with_sidecar=$base — Phase 4 re-finalize candidate")
                        } catch (_: IllegalArgumentException) {
                            Log.w(TAG, "corrupt_sidecar=$base — discarding triple")
                            mp4.delete(); File(recordingsDir, "$base.csv").delete(); sidecar.delete()
                        }
                    } else {
                        Log.w(TAG, "orphan_no_sidecar=$base — discarding triple")
                        mp4.delete(); File(recordingsDir, "$base.csv").delete()
                    }
                }
            }

            val jsons = recordingsDir.listFiles { f -> f.name.endsWith(".json") && !f.name.endsWith(".session.json") } ?: emptyArray()
            for (j in jsons) {
                val base = j.nameWithoutExtension
                if (!File(recordingsDir, "$base.mp4").exists()) {
                    Log.w(TAG, "orphan_json=$base — deleting")
                    j.delete()
                }
            }
        }

        private fun sweepPractice() {
            val practiceDir = File(filesDir, "practice")
            if (!practiceDir.exists()) return
            val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
            practiceDir.listFiles()?.forEach { f ->
                if (f.lastModified() < cutoff) {
                    Log.i(TAG, "practice_expired=${f.name} — deleting")
                    f.delete()
                }
            }
        }

        companion object { private const val TAG = "CaptureLaunchSweep" }
    }
    ```

    **2B — Modify `MainApplication.kt` onCreate:** add ONE line after the existing compat-probe sweep:

    ```kotlin
    CaptureLaunchSweep(filesDir).run()  // Plan 03-09 D-FS-04 — orphan recordings + practice cleanup
    ```

    Add the import.

    **2C — `CaptureLaunchSweepTest.kt`:** mirror EncoderProbeTest's temp-dir Robolectric pattern. Five tests:

      1. `orphan mp4 without sidecar deletes triple` — write .mp4 + .csv, no .json, no .session.json → run sweep → both deleted.
      2. `orphan mp4 with valid sidecar leaves triple intact` — write .mp4 + .csv + valid .session.json (use SidecarManager.write fixture) → run sweep → all three still exist.
      3. `orphan json without mp4 deletes` — write .json only → run sweep → deleted.
      4. `practice file older than 24h deletes` — write practice/old.mp4 with `setLastModified(now - 25h)` and practice/fresh.mp4 → run sweep → old deleted, fresh kept.
      5. `complete triple is untouched` — write .mp4 + .csv + .json → run sweep → all three still exist.

    **2D — Extend `apps/mobile/__tests__/native/HumynCapture.test.ts`** with a 5th describe block:

    ```ts
    describe('HumynCapture (full module wired)', () => {
      beforeEach(() => { vi.resetModules(); });
      afterEach(() => { vi.doUnmock('react-native'); });

      it('exposes start, stop, and 5 event helpers', async () => {
        vi.doMock('react-native', () => ({
          NativeModules: { HumynCapture: { start: vi.fn().mockRejectedValue(new Error('not_implemented_in_03_09')), stop: vi.fn().mockRejectedValue(new Error('no_active_session')) } },
          NativeEventEmitter: vi.fn().mockImplementation(() => ({ addListener: vi.fn().mockReturnValue({ remove: vi.fn() }) })),
        }));
        const mod = await import('../../src/native/HumynCapture');
        expect(typeof mod.start).toBe('function');
        expect(typeof mod.stop).toBe('function');
        expect(typeof mod.onSegmentStart).toBe('function');
        expect(typeof mod.onSegmentComplete).toBe('function');
        expect(typeof mod.onSessionStop).toBe('function');
        expect(typeof mod.onThermalAbort).toBe('function');
        expect(typeof mod.onError).toBe('function');
      });

      it('start surfaces the not_implemented_in_03_09 stub from Plan 03-09 (Plan 03-10 replaces)', async () => {
        const startMock = vi.fn().mockRejectedValue(new Error('not_implemented_in_03_09'));
        vi.doMock('react-native', () => ({
          NativeModules: { HumynCapture: { start: startMock } },
          NativeEventEmitter: vi.fn().mockImplementation(() => ({ addListener: vi.fn() })),
        }));
        const { start } = await import('../../src/native/HumynCapture');
        const opts = { /* fixture matching CaptureSessionOptsSchema */ } as any;
        await expect(start(opts)).rejects.toThrow(/not_implemented_in_03_09/);
        expect(startMock).toHaveBeenCalledWith(opts);
      });
    });
    ```

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.CaptureLaunchSweepTest" 2>&1 | tail -10 && cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt` exists with `class CaptureLaunchSweep { fun run() }`
    - `grep -q "CaptureLaunchSweep(filesDir).run()" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`
    - `grep -q "session.json" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt`
    - `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt` exists with 5+ `@Test` blocks
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.CaptureLaunchSweepTest"` exits 0 (5 sweep cases all green)
    - `cd apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts` exits 0 (5 describe blocks all green)
  </acceptance_criteria>
  <done>CaptureLaunchSweep wired to MainApplication; orphan/practice cleanup tested; JS bridge integration test green.</done>
</task>

<task type="auto">
  <name>Task 3: Author 03-MANUAL-SMOKE.md (apkRollout module-load + JS bridge contract; Phase 4 deferral table)</name>
  <files>.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md</files>
  <read_first>
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-MANUAL-SMOKE.md (Phase 2 runbook shape — Pattern 56)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-01 — Phase 4 deferral; D-WAVE-08 — Wave 1 acceptance gate)
    - .planning/phases/03-humyn-capture-native-module/03-VALIDATION.md (Manual-Only Verifications section — items deferred to Phase 4)
  </read_first>
  <action>
    Author `.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md` mirroring Phase 2's `02-MANUAL-SMOKE.md` shape (Pattern 56). Required sections:

      ```markdown
      # Phase 3 Manual Smoke — apkRollout module-load + JS bridge contract

      > Per CONTEXT.md D-WAVE-01: Phase 3 acceptance is module-ready + Kotlin pure-fn unit tests + JS bridge contract.
      > **Full 10-min E2E HEVC capture verification, drift methodology validation under live IMU, thermal cut-out timing, and 25-min battery soak are deferred to Phase 4 smoke walks.**

      ## Pre-flight
      - Pixel 10a (5C161JEA304304) connected via adb.
      - apkRollout debug build installed: `cd apps/mobile/android && ./gradlew installApkRolloutDebug`.
      - Backend reachable (Phase 1 dev API).

      ## §1 Module-load smoke
      - [ ] Cold-launch app; observe no crash on splash.
      - [ ] Confirm `MainApplication.onCreate` log line `CaptureLaunchSweep` fired (`adb logcat -t 100 | grep CaptureLaunchSweep`).
      - [ ] Confirm Firebase Remote Config defaults set: `adb logcat | grep "capture.segment_minutes"`.
      - [ ] `adb logcat | grep -i HumynCapture` confirms `HumynCaptureModule` registered alongside HumynCompat / HumynUpdater / AppFlavor / PlayIntegrity.

      ## §2 JS bridge contract smoke (Plan 03-10 lights up the full path)
      - [ ] From a dev menu OR via a temporary debug screen invoking `import { start } from 'src/native/HumynCapture'`:
          - Call `start(validOpts)` after Plan 03-10 lands → observe Promise resolves with `{sessionId, segmentId, recordingId, filenameBase}` OR rejects with `thermal_throttling` / `realtime_clock_unavailable`.
          - Until 03-10 lands, observe Promise rejects with `not_implemented_in_03_09` (validates the bridge surface is wired).
      - [ ] Confirm `onSegmentStart` event fires after `start()` resolves; payload contains `segmentId`, `recordingId`, `startedAt`, `filenameBase`.
      - [ ] Confirm `onSessionStop` event fires after `stop()` resolves; payload contains `sessionId`, `segmentsCompleted: 1`.

      ## §3 FGS sanity smoke (after Plan 03-10 lands)
      - [ ] Watch the foreground notification appear in the system tray during `start()`; title "Humyn Labs Capture", text "Recording in progress", priority LOW (no sound).
      - [ ] Confirm notification disappears after `stop()`.
      - [ ] Confirm no `MissingForegroundServiceTypeException` in logcat (Pitfall 6 mitigation verification).

      ## §4 Storage smoke (after Plan 03-10 lands)
      - [ ] After `start()` then immediate `stop()`, `adb shell run-as ai.humynlabs.capture.apk ls files/recordings` shows one triple `{base}.mp4`, `{base}.csv`, `{base}.json` AND no `{base}.session.json`.
      - [ ] Hash-verify: `adb shell run-as ai.humynlabs.capture.apk cat files/recordings/{base}.mp4 | sha256sum` matches the `file_sha256` field in `{base}.json`.

      ## Items deferred to Phase 4 (NOT in scope for Phase 3 sign-off)

      | Behavior | Why Phase 4 | Ref |
      |----------|-------------|-----|
      | 10-min E2E HEVC capture | Requires real RecordingScreen integration | D-WAVE-01 |
      | Drift validation under live IMU | Requires real-device IMU stream | 03-VALIDATION.md Manual-Only |
      | Thermal cut-out timing (~2.5 s) | Requires `cmd thermalservice override-status` on rooted dev device | 03-VALIDATION.md |
      | 25-min battery / thermal soak | Long-running real-hardware test | 03-VALIDATION.md |
      | Pixel 8a / 7a / non-Pixel OEM matrix | Phase 4 broader fleet | feedback_functionality_first_during_smoke.md |
      | Auto-segment 10-min cuts (real timing) | Requires real-device 10-min run | D-WAVE-01 |

      ## Sign-off
      - [ ] All §1-§4 boxes ticked.
      - [ ] Operator: ___________________
      - [ ] Smoke-walked-on: 2026-MM-DD on Pixel 10a (5C161JEA304304).

      Phase 3 module is ready for Phase 4 plan-phase entry.
      ```

    The doc is operator-driven; this task does NOT execute the runbook (operator runs after Plan 03-10 lands).

  </action>
  <verify>
    <automated>test -f /Users/adnaan/Documents/hl-homelander/.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md && grep -q "Smoke-walked-on:" /Users/adnaan/Documents/hl-homelander/.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md && grep -iq "deferred" /Users/adnaan/Documents/hl-homelander/.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md` exists with §1-§4 checkbox sections + deferred-to-Phase-4 table
    - `grep -q "Smoke-walked-on:" .planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md`
    - `grep -iq "deferred" .planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md`
    - `grep -q "not_implemented_in_03_09" .planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md` (the §2 bullet that documents the Plan 03-10 hand-off)
  </acceptance_criteria>
  <done>03-MANUAL-SMOKE.md authored; runbook ready for operator on Pixel 10a after Plan 03-10 ships the orchestrator.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                                    | Description                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| JS start(opts) → CaptureSessionOpts (untrusted ReadableMap) | Bridge map fields untrusted from Kotlin's perspective; CaptureSessionOptsBridge.fromBridge is the validation surface |
| Crash mid-segment → app-launch sweep                        | .session.json sidecar is the recovery primitive (Plan 03-05 SidecarManager + this plan's CaptureLaunchSweep)         |
| Module entry point → JS event dispatcher                    | DeviceEventManagerModule.RCTDeviceEventEmitter is the only path; Plan 03-10 fills the actual emit calls              |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                           | Disposition                       | Mitigation Plan                                                                                                                                                                                                                                        |
| --------- | ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-3.9-01  | Tampering              | start(opts) bridge map could carry consent: false to bypass server-side liability   | mitigate                          | `CaptureSessionOptsBridge.fromBridge` rejects `consent !== true` with `consent_invalid`. Plus the JS-side Zod schema (Plan 03-04) rejects on `z.literal(true)`. Defense-in-depth at both bridge ends; tested directly in CaptureSessionOptsBridgeTest. |
| T-3.9-02  | Spoofing               | Path traversal via filenameBase injection from JS                                   | mitigate                          | JS NEVER provides filename. Plan 03-05's `FilenameGenerator.nextBase()` is the sole filename source — server-side (Kotlin) and uses date-pattern + ls-derived NNN. CaptureSessionOptsBridge has no `filename` field.                                   |
| T-3.9-03  | DoS                    | start() called twice without intervening stop() leaks the prior session             | mitigate (deferred to Plan 03-10) | Plan 03-09 ships the entry point with `sessionActive` flag; Plan 03-10 enforces the double-start rejection inside the real CaptureSession allocation path. The captureExecutor single-thread serializes start/stop in this plan already.               |
| T-3.9-04  | Information disclosure | .session.json sidecar contains contributor email + name; left on disk after a crash | mitigate                          | App-launch sweep (this plan) deletes corrupt sidecars; valid sidecars stay until Phase 4 re-finalize completes. App-private filesDir is Linux UID-scoped. PII exposure window equals "from crash to next cold launch" — bounded.                       |
| T-3.9-05  | Tampering              | Gradle dep substitution attack (typosquat firebase remote-config)                   | accept                            | `apps/mobile/android/app/build.gradle` uses `mavenCentral()` + `google()` repositories only (Phase 1 baseline). Same trust model as the rest of Phase 2/3.                                                                                             |

</threat_model>

<verification>
- HumynCaptureModule + Package + SegmentDurationConfig + CaptureSessionOptsBridge land + compile.
- MainApplication.kt registers HumynCapturePackage AND wires CaptureLaunchSweep AND ensures FGS notification channel (Plan 03-07 ships HumynForegroundNotification.ensureChannel).
- CaptureSessionOptsBridgeTest covers 5 cases (valid → parses; consent=false → throws consent_invalid; taskSetting outside enum → throws; dfovDegrees=0 → throws; appVersion not semver → throws).
- CaptureLaunchSweepTest covers 5 cases (orphan-without-sidecar deletes; orphan-with-valid-sidecar preserves; orphan-json deletes; old practice deletes; complete triple untouched).
- HumynCapture.test.ts gains a 5th describe block; full Vitest suite green.
- 03-MANUAL-SMOKE.md ships with §1-§4 + deferred-to-Phase-4 table.
- Phase 2 + Phase 3 Wave 1 + Plans 03-04..08 suites stay green (no regressions).

Operator-driven follow-up (D-WAVE-01 deferral — NOT in this plan's executable scope):

- Plan 03-10 ships CaptureSession + FinalizeWorker + the 5 remaining stubs.
- Operator runs `03-MANUAL-SMOKE.md` on Pixel 10a; signs off with `Smoke-walked-on:` stamp AFTER Plan 03-10 lands.
  </verification>

<success_criteria>

- ✓ HumynCaptureModule + Package registered in MainApplication.getPackages().
- ✓ Firebase Remote Config defaults set in MainApplication.onCreate (`capture.segment_minutes` → 10L default).
- ✓ FGS notification channel created at app boot (`HumynForegroundNotification.ensureChannel`).
- ✓ CaptureSessionOptsBridge in its own file (per checker issue #14) with comprehensive validation + 5-case Robolectric test.
- ✓ CaptureLaunchSweep extends MainApplication.onCreate orphan handling.
- ✓ HumynCaptureModule.start() in this plan rejects with `not_implemented_in_03_09` after opts validation passes — Plan 03-10 replaces the body.
- ✓ JS bridge integration test (HumynCapture.test.ts) covers 5 describe blocks; all green.
- ✓ 03-MANUAL-SMOKE.md authored with §1-§4 checkboxes + Phase 4 deferral table.
- ✓ Full APK build (`./gradlew assembleApkRolloutDebug`) exits 0.
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-09-SUMMARY.md` per the canonical summary template — including:

- Pattern callout: "Bridge-first orchestrator" — entry-point module ships before the lifecycle, so JS bridge integration test exercises validation surface without spinning up Camera2.
- Pattern callout: "Dedicated CaptureSessionOptsBridge" (per checker issue #14) — Robolectric-testable in isolation; mirrors the JS Zod schema.
- Pattern callout: "Sidecar-driven re-finalize" — `.session.json` orphan as recovery signal; CaptureLaunchSweep distinguishes corrupt-vs-recoverable.
- Wave 0 progress at Plan 03-09 commit: 12 of 17 stubs GREEN (1 from Plan 03-04 + 6 from Plan 03-05 + 1 from Plan 03-06 + 2 from Plan 03-07 + 4 from Plan 03-08; FragmentedMuxerWrapperTest counts as 1).
  Wait — recount: Plan 03-04 ships FragmentedMuxerWrapperTest GREEN; Plan 03-05 ships 6 GREEN; Plan 03-06 ships 1 (MetadataSchemaConformance); Plan 03-07 ships 2 (HumynForegroundService + ThermalGate); Plan 03-08 ships 4 (HevcEncoder + AacEncoder + ImuWriter + SegmentTimer). That's 1 + 6 + 1 + 2 + 4 = 14 of (17 capture/ + 1 fgs/) = 14 of 18. Remaining 4: StartGateCarryover + EventEmission + ClockAlignment + RealtimeGate + FileFidelity = 5. Wait — that's 5 remaining. Total = 14 + 5 = 19 ≠ 18. Recount: the plan-target table in 03-04 lists 18 stubs (17 capture/ + 1 fgs/ = HumynForegroundService). Plan 03-05 = 6, Plan 03-06 = 1, Plan 03-07 = 2 (HumynForegroundServiceTest + ThermalGateTest), Plan 03-08 = 4, Plan 03-10 = 5. 6 + 1 + 2 + 4 + 5 = 18. Plus FragmentedMuxerWrapperTest from Plan 03-04 = 19. The 19th is FragmentedMuxerWrapperTest not in the 18-stub plan-target list because Plan 03-04 ships it GREEN (Task 1) not as a Wave 0 MISSING stub. Total Wave 0 stubs targeting MISSING-to-GREEN flips = 18; total tests in capture/+fgs/ when all plans land = 19 (18 stub-flipped + 1 always-GREEN). Plan 03-09 ships 0 stub flips; Plan 03-10 ships 5 (StartGate + EventEmission + ClockAlignment + RealtimeGate + FileFidelity).
- Phase 3 acceptance state at Plan 03-09 commit: bridge surface ready; awaiting Plan 03-10 for the orchestrator + operator on-device smoke walk per `03-MANUAL-SMOKE.md`.
  </output>
