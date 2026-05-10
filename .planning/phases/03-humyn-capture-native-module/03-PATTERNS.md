# Phase 3: HumynCapture Native Module - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** ~38 (Wave 2 native + JS bridge + Wave 1 cosmetic touch surfaces)
**Analogs found:** 33 / 38 (5 net-new — no codebase analog exists for `Service`, `WritableByteChannel` adapter, drift math, ULID minter, sliding-window rate observer)

> **How the planner uses this file:** every Wave 2 plan's `read_first` list copies a row's "Closest Analog" path; every Wave 1 plan's `read_first` list copies the relevant Wave 1 surface. Excerpts below are the load-bearing snippets — do NOT re-discover the patterns in plan-write time.

---

## File Classification

### Wave 1 — Phase 2 Cosmetic Fix-up (RN/TS frontend, navigation-touching)

| New / Modified File                                                                                                          | Role                                                   | Data Flow                              | Closest Analog                                                                                             | Match Quality |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------- |
| `apps/mobile/src/assets/logos/orange_logo@1x.png` (+@2x, @3x)                                                                | asset (NEW)                                            | static-bundle                          | `apps/mobile/assets/fonts/RethinkSans-*.ttf` (density-bucketed asset shipped through `react-native-asset`) | role-match    |
| `apps/mobile/src/screens/splash/SplashScreen.tsx`                                                                            | screen (MODIFY)                                        | request-response (animation lifecycle) | `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` (logo asset consumer)                                | exact         |
| `apps/mobile/src/screens/signup/SignupScreen.tsx`                                                                            | screen (MODIFY — protected file)                       | request-response (auth + form)         | `apps/mobile/src/screens/permissions/PermissionsScreen.tsx` (CTA-position + width sibling)                 | exact         |
| `apps/mobile/src/screens/permissions/PermissionsScreen.tsx`                                                                  | screen (MODIFY)                                        | request-response                       | `apps/mobile/src/screens/signup/SignupScreen.tsx` (sibling CTA pattern)                                    | exact         |
| `apps/mobile/src/screens/compat/CompatFailScreen.tsx`                                                                        | screen (MODIFY — merge)                                | request-response                       | `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` (body to merge IN)                               | exact         |
| `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx`                                                                    | screen (DELETE)                                        | —                                      | own file (body inlined into CompatFail)                                                                    | exact         |
| `apps/mobile/src/screens/compat/CompatPassScreen.tsx`                                                                        | screen (MODIFY — auto-advance)                         | request-response                       | `apps/mobile/src/screens/splash/SplashScreen.tsx` (timer-based auto-route)                                 | role-match    |
| `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`                                                                     | screen (MODIFY — illustration + email)                 | request-response                       | `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` (asset consumer)                                     | role-match    |
| `apps/mobile/src/components/BottomNav.tsx`                                                                                   | component (MODIFY — already wired; verify icon sizing) | view                                   | own file (already correct shape — gap is on-device perception)                                             | exact         |
| `apps/mobile/src/components/TopBar.tsx`                                                                                      | component (no change expected)                         | view                                   | own file                                                                                                   | exact         |
| `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx`                                                                   | screen (MODIFY — wire avatar)                          | request-response                       | `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` lines 31–45                                          | exact         |
| `apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx`                                                               | screen (MODIFY — wire avatar)                          | request-response                       | `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` lines 31–45                                          | exact         |
| `apps/mobile/src/hooks/useTabTopBarProps.ts` (NEW)                                                                           | hook                                                   | request-response (selector)            | `HomeSkeletonScreen.tsx` lines 33–37 (extracted as a hook)                                                 | exact         |
| `apps/mobile/src/navigation/RootNativeStack.tsx` OR `MainTabs.tsx` (MODIFY — foreground rehydrate hook)                      | navigation glue                                        | event-driven (AppState)                | `apps/mobile/src/screens/profile/ProfileScreen.tsx` (consumer of `profileService.fetchMe`)                 | role-match    |
| `apps/mobile/src/screens/help/HelpCenterScreen.tsx` + `apps/mobile/src/screens/help/content.json` + `help-center-content.md` | content swap                                           | static-text                            | own files (5x `[EMAIL_ADDRESS]` substitution)                                                              | exact         |
| `apps/mobile/__tests__/visual/*.test.tsx` (NEW — 10 surfaces)                                                                | test                                                   | image-snapshot                         | `apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx` (Vitest + jsdom test pattern)                  | role-match    |
| `apps/mobile/__tests__/visual/__image_snapshots__/` (NEW — PNG baselines)                                                    | test fixture                                           | static-bundle                          | none (jest-image-snapshot is a NEW dep)                                                                    | none          |
| `apps/mobile/package.json` (MODIFY — add `jest-image-snapshot`)                                                              | config                                                 | —                                      | own file                                                                                                   | exact         |
| `apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx` (DELETE)                                                       | test                                                   | —                                      | own file                                                                                                   | exact         |
| `apps/mobile/src/navigation/MainTabs.tsx` (MODIFY — drop CompatRecovery from route registry; auto-advance route change)      | navigation                                             | request-response                       | own file                                                                                                   | exact         |

### Wave 2 — HumynCapture Kotlin native module + JS bridge

| New / Modified File                                                                                           | Role                               | Data Flow                                                      | Closest Analog                                                                                                                                       | Match Quality                                               |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/mobile/android/app/build.gradle` (MODIFY)                                                               | build config                       | —                                                              | own file (existing dependency block)                                                                                                                 | exact                                                       |
| `apps/mobile/android/app/src/main/AndroidManifest.xml` (MODIFY — `<service>` declaration)                     | manifest                           | —                                                              | own file (existing `<application>` block)                                                                                                            | exact                                                       |
| `.../ai/humynlabs/capture/MainApplication.kt` (MODIFY — register HumynCapturePackage + extend onCreate sweep) | RN host                            | event-driven (app boot)                                        | own file lines 28–58                                                                                                                                 | exact                                                       |
| `.../capture/HumynCaptureModule.kt` (NEW)                                                                     | TurboModule entry point            | request-response (Promise) + event-driven (NativeEventEmitter) | `compat/HumynCompatModule.kt`                                                                                                                        | exact                                                       |
| `.../capture/HumynCapturePackage.kt` (NEW)                                                                    | ReactPackage                       | —                                                              | `compat/HumynCompatPackage.kt`                                                                                                                       | exact                                                       |
| `.../capture/CaptureSession.kt` (NEW)                                                                         | orchestrator                       | streaming (Camera2 → encoder → muxer → file)                   | `compat/EncoderProbe.kt` (5 s analog of the same pipeline)                                                                                           | exact                                                       |
| `.../capture/HevcEncoder.kt` (NEW)                                                                            | encoder                            | streaming                                                      | `compat/EncoderProbe.kt` lines 79–92 (MediaFormat config)                                                                                            | exact                                                       |
| `.../capture/AacEncoder.kt` (NEW)                                                                             | encoder                            | streaming                                                      | `compat/EncoderProbe.kt` lines 79–92 (MediaFormat pattern; AAC is structurally identical to HEVC)                                                    | role-match                                                  |
| `.../capture/ImuWriter.kt` (NEW)                                                                              | sensor sampler                     | streaming (event → CSV row)                                    | `compat/ImuProbe.kt` lines 44–106                                                                                                                    | exact                                                       |
| `.../capture/FragmentedMuxerWrapper.kt` (NEW)                                                                 | muxer adapter                      | streaming                                                      | `compat/EncoderProbe.kt` lines 162–182 (MediaCodec → muxer pump loop)                                                                                | role-match (different muxer API; SAME I/O pattern)          |
| `.../capture/DriftCalculator.kt` (NEW)                                                                        | pure math                          | batch transform                                                | none (new domain — but `compat/ImuProbe.kt::computeResult` shows the pure-fn-test seam)                                                              | role-match (test seam only)                                 |
| `.../capture/ImuRateObserver.kt` (NEW)                                                                        | pure math                          | batch transform                                                | `compat/ImuProbe.kt::computeResult` lines 112–122 (sliding-window p99 over inter-sample intervals)                                                   | exact (math pattern)                                        |
| `.../capture/HashStreamer.kt` (NEW)                                                                           | streaming hash                     | file-I/O                                                       | `updater/HumynUpdaterModule.kt::downloadAndVerifyApk` lines 75–98 (streaming MessageDigest over HTTP body — same Streamer pattern, different source) | role-match                                                  |
| `.../capture/MetadataComposer.kt` (NEW)                                                                       | JSON writer                        | file-I/O                                                       | none directly; closest is the bridge-map composition in `compat/HumynCompatModule.kt` lines 53–58 + `compat/DeviceCaps.kt::readAll`                  | role-match                                                  |
| `.../capture/SidecarManager.kt` (NEW)                                                                         | JSON sidecar                       | file-I/O                                                       | none (new primitive — sidecar pattern is Phase-3-introduced)                                                                                         | none                                                        |
| `.../capture/FilenameGenerator.kt` (NEW)                                                                      | pure-fn                            | batch                                                          | none (new domain — but the pure-fn-test seam in `compat/ImuProbe.kt::computeResult` is the testability template)                                     | role-match (test seam only)                                 |
| `.../capture/UlidGenerator.kt` (NEW)                                                                          | pure-fn or thin lib wrapper        | batch                                                          | none (new dep `io.azam.ulidj:ulidj` OR hand-roll)                                                                                                    | none                                                        |
| `.../capture/SegmentTimer.kt` (NEW)                                                                           | timer                              | event-driven (Handler.postDelayed)                             | `compat/EncoderProbe.kt` lines 101–110 (HandlerThread + Handler.post pattern)                                                                        | role-match                                                  |
| `.../capture/ThermalGate.kt` (NEW)                                                                            | OS listener                        | event-driven                                                   | `compat/EncoderProbe.kt` lines 132–155 (callback-via-Handler pattern)                                                                                | role-match                                                  |
| `.../capture/FinalizeWorker.kt` (NEW)                                                                         | concurrent worker                  | batch                                                          | `compat/HumynCompatModule.kt::bgExecutor` lines 44 (`Executors.newSingleThreadExecutor`)                                                             | exact (executor pattern)                                    |
| `.../capture/common/BackUltrawidePicker.kt` (NEW — extract per planner's Discretion)                          | shared util                        | batch                                                          | `compat/DeviceCaps.kt::pickBackUltrawide` lines 140–214                                                                                              | exact (verbatim extract)                                    |
| `.../capture/fgs/HumynForegroundService.kt` (NEW)                                                             | Android Service                    | event-driven (Service lifecycle)                               | NONE in codebase — first `android.app.Service` subclass in the project                                                                               | none (RESEARCH § Code Example 7 is the canonical reference) |
| `.../capture/fgs/HumynForegroundNotification.kt` (NEW)                                                        | NotificationChannel + Notification | view                                                           | NONE in codebase — Phase 2 has no notifications                                                                                                      | none (RESEARCH § Code Example 7 is the reference)           |
| `apps/mobile/src/native/HumynCapture.ts` (NEW)                                                                | JS bridge                          | request-response + event subscription                          | `apps/mobile/src/native/HumynCompat.ts`                                                                                                              | exact                                                       |
| `apps/mobile/src/native/HumynCapture.types.ts` (NEW)                                                          | typedef                            | —                                                              | `apps/mobile/src/native/HumynCompat.ts` lines 25–69 (Result interfaces)                                                                              | exact                                                       |
| `shared/types/src/CaptureSessionOpts.ts` (NEW)                                                                | Zod schema                         | —                                                              | `shared/types/src/CompatResult.ts` (Phase 2 Zod pattern) — _verify path before plan-cut_                                                             | exact                                                       |
| **Tests (Kotlin Robolectric — Wave 0 gaps from RESEARCH lines 1153–1167):**                                   |                                    |                                                                |                                                                                                                                                      |                                                             |
| `.../capture/DriftCalculatorTest.kt` (NEW)                                                                    | unit test                          | batch                                                          | `compat/ImuProbeTest.kt` (pure-fn over synthetic timestamps)                                                                                         | exact                                                       |
| `.../capture/ImuRateObserverTest.kt` (NEW)                                                                    | unit test                          | batch                                                          | `compat/ImuProbeTest.kt` lines 14–42                                                                                                                 | exact                                                       |
| `.../capture/FilenameGeneratorTest.kt` (NEW)                                                                  | unit test                          | batch                                                          | `compat/EncoderProbeTest.kt` (Robolectric + temp-file fixture pattern)                                                                               | role-match                                                  |
| `.../capture/MetadataSchemaConformanceTest.kt` (NEW)                                                          | unit test                          | batch                                                          | `compat/EncoderProbeTest.kt` (file-fixture pattern) + cross-validation against `video_metadata.json` template                                        | role-match                                                  |
| `.../capture/HashStreamerTest.kt` (NEW)                                                                       | unit test                          | file-I/O                                                       | `compat/EncoderProbeTest.kt` lines 24–37 (Robolectric file fixture)                                                                                  | exact                                                       |
| `.../capture/SidecarManagerTest.kt` (NEW)                                                                     | unit test                          | file-I/O                                                       | `compat/EncoderProbeTest.kt` (round-trip + corrupt-detection)                                                                                        | role-match                                                  |
| `.../capture/UlidGeneratorTest.kt` (NEW)                                                                      | unit test                          | batch                                                          | `compat/ImuProbeTest.kt` (pure-fn over synthetic input)                                                                                              | role-match                                                  |
| `.../capture/SegmentTimerTest.kt` (NEW)                                                                       | unit test                          | event-driven                                                   | `compat/ImuProbeTest.kt` (Robolectric scheduler)                                                                                                     | role-match                                                  |
| `.../capture/ThermalGateTest.kt` (NEW)                                                                        | unit test                          | event-driven                                                   | `compat/ImuProbeTest.kt` (Robolectric system-service mock)                                                                                           | role-match                                                  |
| `.../capture/HevcEncoderConfigTest.kt` (NEW)                                                                  | unit test                          | batch                                                          | `compat/NalParserTest.kt` (config-audit pattern; reuse `hevc-fixtures/`)                                                                             | exact                                                       |
| `.../capture/AacEncoderConfigTest.kt` (NEW)                                                                   | unit test                          | batch                                                          | (same as above)                                                                                                                                      | exact                                                       |
| `.../capture/ImuWriterCsvFormatTest.kt` (NEW)                                                                 | unit test                          | file-I/O                                                       | `compat/EncoderProbeTest.kt`                                                                                                                         | role-match                                                  |
| `.../fgs/HumynForegroundServiceTest.kt` (NEW)                                                                 | unit test                          | event-driven                                                   | `compat/EncoderProbeTest.kt` (Robolectric `@Config(sdk=[33])` pattern)                                                                               | role-match                                                  |
| `apps/mobile/__tests__/native/HumynCapture.test.ts` (NEW)                                                     | unit test                          | request-response                                               | `apps/mobile/__tests__/native/HumynCompat.test.ts`                                                                                                   | exact                                                       |

---

## Pattern Assignments

### `HumynCaptureModule.kt` (TurboModule entry point, request-response + event-driven)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt` (Wave 2 plan 1 must read this file in full before writing the new module).

**Rationale:** This file IS the canonical Phase-2 TurboModule shell. Phase 3 reproduces the exact `@ReactModule(name=...)` + `ReactContextBaseJavaModule` skeleton + single-thread `Executors.newSingleThreadExecutor()` background dispatch + per-method error-code translation. The only structural addition for Phase 3 is the second executor for concurrent finalize and the `DeviceEventManagerModule.RCTDeviceEventEmitter` event-emit channel (RESEARCH Pattern 3 lines 444–479).

**Imports pattern** (from `compat/HumynCompatModule.kt` lines 1–10):

```kotlin
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.Executors
```

Phase 3 additionally imports `com.facebook.react.bridge.ReadableMap` (for `start(opts)`) and `com.facebook.react.modules.core.DeviceEventManagerModule` (for `NativeEventEmitter`).

**Class header + companion + executor pattern** (lines 31–45):

```kotlin
@ReactModule(name = HumynCompatModule.NAME)
class HumynCompatModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynCompat"
    }

    private val bgExecutor = Executors.newSingleThreadExecutor()

    override fun getName(): String = NAME
```

Phase 3 swaps `NAME = "HumynCapture"`, adds `private val finalizeExecutor = Executors.newSingleThreadExecutor()` for the 0.5 s gap mechanic (RESEARCH Pattern 2 lines 401–434).

**Method body — Promise + bgExecutor + per-method error code** (lines 48–64):

```kotlin
@ReactMethod
fun runEncoderProbe(promise: Promise) {
    bgExecutor.execute {
        try {
            val result = EncoderProbe(reactApplicationContext).run()
            val map: WritableMap = Arguments.createMap().apply {
                putBoolean("bFramePresent", result.bFramePresent)
                // ...
            }
            promise.resolve(map)
        } catch (t: Throwable) {
            promise.reject("ENCODER_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)
        }
    }
}
```

Phase 3 mirrors verbatim for `start(optsMap: ReadableMap, promise: Promise)` and `stop(promise: Promise)`. Error codes per CONTEXT.md `<decisions>` "Claude's Discretion" (planner picks taxonomy — see RESEARCH Pattern 3 lines 462–464 for the recommended `errorCodeFor(t)` helper).

**Event-emit pattern** (NEW for Phase 3 — from RESEARCH Pattern 3 lines 471–476):

```kotlin
private fun emitEvent(name: String, payload: WritableMap) {
    reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, payload)
}
```

---

### `HumynCapturePackage.kt` (ReactPackage)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt` (entire file — 22 lines).

**Rationale:** Verbatim copy with two name swaps (`HumynCompatModule` → `HumynCaptureModule`, `HumynCompatPackage` → `HumynCapturePackage`). The `createNativeModules` returns a single-module list; `createViewManagers` returns empty.

**Full pattern** (entire file is the analog — copy verbatim with rename):

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

---

### `MainApplication.kt` MODIFY (register HumynCapturePackage + extend orphan sweep)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` (own file — Phase 2 already established the shape; Phase 3 extends it).

**Rationale:** D-FS-04 says HumynCapture's app-launch sweep runs in `MainApplication.onCreate`; Phase 2 already wired the `compat-probe-*.mp4` cacheDir sweep right there. Phase 3 adds a sibling `recordings/` + `practice/` sweep and registers the new package.

**Package registration pattern** (lines 28–35):

```kotlin
override fun getPackages(): List<ReactPackage> {
    val packages = PackageList(this).packages.toMutableList()
    packages.add(AppFlavorPackage())
    packages.add(PlayIntegrityPackage())
    packages.add(HumynCompatPackage())
    packages.add(HumynUpdaterPackage())
    return packages
}
```

Phase 3 adds one more line: `packages.add(HumynCapturePackage())  // Plan 03-W2-XX — Phase 3 capture pipeline`.

**onCreate sweep pattern to extend** (lines 49–59):

```kotlin
override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    load()
    // D-COMPAT-04 / T-2.6-02: sweep orphan compat-probe-*.mp4 files left in
    // cacheDir if a previous EncoderProbe (plan 02-12) crashed before its
    // finally-block deletion ran. Best-effort — listFiles can return null.
    cacheDir.listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
        ?.forEach { it.delete() }
}
```

Phase 3 extends inline with two further sweeps (D-FS-04):

1. `filesDir/recordings/`: for each `*.mp4` without matching `.json`, attempt re-finalize via `.session.json` sidecar; discard if MP4 corrupt or sidecar missing. Delete `*.json` orphans.
2. `filesDir/practice/`: delete files older than 24 h.

The exact sweep code lives in a new `CaptureLaunchSweep.kt` helper (planner picks placement — `capture/` or `capture/common/`). MainApplication just calls `CaptureLaunchSweep(filesDir).run()` to keep the lifecycle hook short.

---

### `CaptureSession.kt` (orchestrator — Camera2 + HEVC + AAC + IMU + muxer for ONE segment)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt` (entire 239 lines — the 5 s analog of exactly the pipeline Phase 3 runs continuously).

**Rationale:** EncoderProbe runs the same Camera2 + MediaCodec(HEVC) + Muxer end-to-end for 5 seconds. Phase 3 strips the cleanup `finally`, replaces stock `MediaMuxer` with `FragmentedMp4Muxer` (RESEARCH Pitfall 1), adds AAC encoder + AudioRecord + ImuWriter alongside, and runs continuously for `capture.segment_minutes` minutes per segment.

**MediaCodec HEVC encoder config — copy lines 79–92 verbatim** (RESEARCH Code Example 1 confirms this is the exact spec config):

```kotlin
val format = MediaFormat.createVideoFormat(MIME, WIDTH, HEIGHT).apply {
    setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
    setInteger(MediaFormat.KEY_BIT_RATE, BITRATE)
    setInteger(MediaFormat.KEY_FRAME_RATE, FRAME_RATE)
    setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
    if (Build.VERSION.SDK_INT >= 24) setInteger(MediaFormat.KEY_LATENCY, 1)
    if (Build.VERSION.SDK_INT >= 25) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
}
val encoder = MediaCodec.createEncoderByType(MIME)
encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
val inputSurface: Surface = encoder.createInputSurface()
encoder.start()
```

Phase 3 additionally sets `KEY_PROFILE = HEVCProfileMain`, `KEY_PRIORITY = 0`, `KEY_OPERATING_RATE = 30`, `KEY_COLOR_RANGE = COLOR_RANGE_LIMITED`, `KEY_COLOR_STANDARD = COLOR_STANDARD_BT709`, `KEY_COLOR_TRANSFER = COLOR_TRANSFER_SDR_VIDEO` per RESEARCH Code Example 1 lines 689–696 — these are absent from EncoderProbe because the 5 s probe doesn't need them.

**Camera2 open + capture-request pattern — copy lines 95–155** (sub-sections):

Camera open with HandlerThread + StateCallback + CountDownLatch (lines 96–113):

```kotlin
val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
val backId = mgr.cameraIdList.firstOrNull {
    mgr.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
} ?: throw IllegalStateException("no_back_camera")

val handlerThread = HandlerThread("EncoderProbe").apply { start() }
val handler = Handler(handlerThread.looper)
val openLatch = CountDownLatch(1)
var camera: CameraDevice? = null

mgr.openCamera(backId, object : CameraDevice.StateCallback() {
    override fun onOpened(c: CameraDevice) { camera = c; openLatch.countDown() }
    override fun onDisconnected(c: CameraDevice) { c.close() }
    override fun onError(c: CameraDevice, error: Int) { c.close(); openLatch.countDown() }
}, handler)
openLatch.await(CAMERA_OPEN_TIMEOUT_S, TimeUnit.SECONDS)
```

Phase 3 swaps `cameraIdList.firstOrNull{LENS_FACING_BACK}` with `BackUltrawidePicker.pick(mgr).openableId` (the Phase 2 ultrawide picker — extracted to `capture/common/` per Claude's Discretion in CONTEXT.md). The HandlerThread is renamed `"HumynCapture-Camera"`.

CaptureRequest builder with OIS-OFF + video-stab-OFF (lines 117–130):

```kotlin
val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
builder.addTarget(inputSurface)
builder.set(
    CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
    CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF,
)
if (Build.VERSION.SDK_INT >= 33) {
    try {
        builder.set(
            CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
            CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF,
        )
    } catch (_: Throwable) { /* best-effort */ }
}
```

Phase 3 reproduces verbatim. `OutputConfiguration.setDynamicRangeProfile(STANDARD)` is the missing piece for Pitfall 4 — see RESEARCH Code Example 5 lines 838–843 for the OutputConfiguration shape EncoderProbe never used (because the 5 s probe doesn't trigger HDR auto, but a 10-min recording does).

**MediaCodec output-pump loop — copy lines 162–179** (this is the encoder→muxer pump):

```kotlin
val info = MediaCodec.BufferInfo()
var trackIdx = -1
var muxerStarted = false
while (System.nanoTime() < end) {
    val outIdx = encoder.dequeueOutputBuffer(info, 10_000)
    if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED && !muxerStarted) {
        trackIdx = muxer.addTrack(encoder.outputFormat); muxer.start(); muxerStarted = true
    } else if (outIdx >= 0) {
        val buf: ByteBuffer? = encoder.getOutputBuffer(outIdx)
        if (buf != null && info.size > 0) {
            // [...] write to muxer
            muxer.writeSampleData(trackIdx, buf, info)
        }
        encoder.releaseOutputBuffer(outIdx, false)
    }
}
```

Phase 3 swaps the loop termination from `System.nanoTime() < end` (5 s wall-clock) to `!segmentTimer.fired && !stopRequested && !thermalAbort` and replaces `muxer.writeSampleData(trackIdx, buf, info)` with the new `FragmentedMuxerWrapper.writeSampleData(...)` adapter (translates `MediaCodec.BufferInfo` → `androidx.media3.muxer.BufferInfo` per RESEARCH § State of the Art line 1033).

**Cleanup pattern** (lines 181–186):

```kotlin
if (muxerStarted) muxer.stop()
muxer.release()
encoder.stop()
encoder.release()
cam.close()
handlerThread.quitSafely()
```

Phase 3 reproduces this in the segment-rotation handler (RESEARCH Pattern 2 lines 411–414: `closeSegmentResources(segmentN)`).

---

### `HevcEncoder.kt` (encoder MediaFormat config wrapper)

**Analog:** `compat/EncoderProbe.kt` lines 79–92 (extract into a single `configure()` method).

**Rationale:** Phase 3 needs the encoder config in two places — main capture path AND `HevcEncoderConfigTest.kt`. Extract verbatim. Tests pass a `MediaFormat` object and audit keys.

(See "MediaCodec HEVC encoder config" excerpt above.)

---

### `AacEncoder.kt` (audio encoder + AudioRecord wrapper)

**Analog:** RESEARCH Code Example 2 lines 706–739 + `compat/EncoderProbe.kt` MediaFormat-config pattern lines 79–88.

**Rationale:** No analog in the codebase yet (Phase 2 had no audio path). RESEARCH § Code Examples 2 has the full snippet ready to copy. Audio source mode is `UNPROCESSED → VOICE_RECOGNITION` fallback per RESEARCH Standard Stack lines 207–212.

**Full pattern from RESEARCH Code Example 2** (planner copies into the new file with imports):

```kotlin
private fun configureAacEncoder(): MediaCodec {
    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 48_000, 1).apply {
        setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
        setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
    }
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()
    return codec
}

private fun makeAudioRecord(am: AudioManager): AudioRecord {
    val source = if (am.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true") {
        MediaRecorder.AudioSource.UNPROCESSED
    } else {
        MediaRecorder.AudioSource.VOICE_RECOGNITION
    }
    // [...] AudioRecord.Builder
}
```

---

### `ImuWriter.kt` (SensorEventListener + interleaved CSV writer on dedicated HandlerThread)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` lines 44–106 (full listener-pattern lifecycle).

**Rationale:** ImuProbe IS the SensorManager listener pattern; Phase 3 ImuWriter swaps the in-memory `mutableListOf<Long>()` collector for a `BufferedWriter(FileWriter(csvFile), 8192)` and adds the second sensor (ImuProbe collected gyro only). Both sensors register with the same listener instance on the same HandlerThread, so no thread-safety overhead is needed (RESEARCH Code Example 3 line 768 calls this out).

**Listener registration pattern** (lines 44–57):

```kotlin
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
```

Phase 3 changes:

1. Adds `val accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: error("no_accel")` and a second `registerListener(listener, accel, ...)` call.
2. Swaps `maxReportLatency = 0` for `200_000` (200 ms — planner's call per Claude's Discretion; RESEARCH Code Example 3 line 757 recommends).
3. Listener body swaps `timestamps.add(e.timestamp)` for the CSV write per RESEARCH Code Example 3 lines 769–772:
   ```kotlin
   val type = if (e.sensor.type == Sensor.TYPE_GYROSCOPE) "gyro" else "accel"
   csv.write("${e.timestamp},$type,${e.values[0]},${e.values[1]},${e.values[2]}\n")
   timestamps.add(e.timestamp)  // for finalize-time drift + p1 calc
   ```
4. Renames thread to `"HumynCapture-Imu"`.

**Cleanup pattern** (lines 100–107):

```kotlin
sm.unregisterListener(listener)
// [...] camera/preview cleanup if applicable
handlerThread.quitSafely()
```

Phase 3 ImuWriter `stop()` method:

```kotlin
sm.unregisterListener(listener)
csv.close()
handlerThread.quitSafely()
return timestamps.toList()  // hand to FinalizeWorker
```

---

### `FragmentedMuxerWrapper.kt` (NEW — wraps `androidx.media3.muxer.FragmentedMp4Muxer`)

**Analog:** `compat/EncoderProbe.kt` lines 162–182 for the encoder→muxer pump pattern. NO codebase analog for the muxer itself — `FragmentedMp4Muxer` is a Phase-3-introduced dependency (`androidx.media3:media3-muxer:1.10.0`).

**Rationale:** Phase 3 needs `setFragmentDurationMs(30_000)` (RESEARCH Pitfall 1 lines 542–561). Stock `MediaMuxer` cannot do fragmented MP4. The wrapper is thin: takes a `WritableByteChannel` (from `FileOutputStream(file).channel`), exposes `addTrack(MediaFormat) → trackId`, `writeSampleData(trackId, ByteBuffer, MediaCodec.BufferInfo)`, `start()`, `stop()`, `release()`. Internal: translates `MediaCodec.BufferInfo` → `androidx.media3.muxer.BufferInfo` (RESEARCH § State of the Art line 1033 — Media3 1.6.0+ has its own muxer-specific BufferInfo class).

**Pattern source — RESEARCH Pitfall 1 prevention block:**

```kotlin
// Construct via:
//   val ch = FileOutputStream(mp4File).channel
//   val muxer = FragmentedMp4Muxer.Builder(ch).setFragmentDurationMs(30_000L).build()
// Then mirror the EncoderProbe pump loop, but call muxer.writeSampleData(...) on
// our wrapper instead of the stock MediaMuxer.
```

Reference verification: GitHub `androidx/media` `FragmentedMp4Muxer.java` source for `setFragmentDurationMs(long)` setter. _Planner verifies the latest Media3 release version with `curl -s "https://maven.google.com/androidx/media3/media3-muxer/maven-metadata.xml" | grep -E "<latest>|<release>"` per RESEARCH line 200._

---

### `DriftCalculator.kt` (pure-fn — `{max, mean, p99}` via least-squares residual subtraction)

**Analog:** RESEARCH Code Example 4 lines 793–817 (algorithm) + `compat/ImuProbe.kt::computeResult` lines 112–122 (testability seam — pure-fn over synthetic input arrays).

**Rationale:** No prior codebase analog for the math. Pattern source = `idea-brief.md §6.5` (verbatim). Testability seam from ImuProbe's `internal fun computeResult(timestamps: List<Long>): Result` — internal visibility + pure inputs/outputs lets `DriftCalculatorTest.kt` exercise the math against synthetic timestamp arrays without spinning up the camera/sensor stack.

**Algorithm pattern from RESEARCH Code Example 4:**

```kotlin
data class Drift(val maxMs: Double, val meanMs: Double, val p99Ms: Double)

object DriftCalculator {
    fun compute(videoFrameTimestampsNs: LongArray, imuTimestampsNs: LongArray): Drift {
        val rv = residualsFromLeastSquaresFit(videoFrameTimestampsNs)
        val rs = residualsFromLeastSquaresFit(imuTimestampsNs)
        val rsAtV = DoubleArray(rv.size) { i ->
            interpolate(imuTimestampsNs, rs, videoFrameTimestampsNs[i])
        }
        val absD = DoubleArray(rv.size) { i -> kotlin.math.abs(rv[i] - rsAtV[i]) / 1_000_000.0 }
        absD.sort()
        val max = absD.last()
        val mean = absD.sum() / absD.size
        val p99 = absD[(absD.size * 99 / 100).coerceAtMost(absD.size - 1)]
        return Drift(maxMs = max, meanMs = mean, p99Ms = p99)
    }
    private fun residualsFromLeastSquaresFit(values: LongArray): DoubleArray { /* ... */ }
    private fun interpolate(xs: LongArray, ys: DoubleArray, x: Long): Double { /* binary search + lerp */ }
}
```

**Test pattern from `compat/ImuProbe.kt::computeResult` style (`compat/ImuProbeTest.kt` lines 14–24):**

```kotlin
@Test
fun `200 Hz uniform stream after 5s warm-up reports ~200 Hz sustained`() {
    val ts = mutableListOf<Long>()
    val period = 5_000_000L
    for (i in 0 until 6000) ts.add(i.toLong() * period)
    val r = probe.computeResult(ts)
    assertTrue("sustainedHz should be ~200 Hz", r.sustainedHz in 195f..205f)
}
```

DriftCalculatorTest mirrors this shape with synthetic `LongArray`s for video + IMU timestamps and asserts known `{max, mean, p99}` values.

---

### `ImuRateObserver.kt` (sliding-window p1 over inter-sample intervals)

**Analog:** `compat/ImuProbe.kt::computeResult` lines 118–122 (inter-sample interval + p99 calculation — mirror image of what we want, p1 instead of p99).

**Rationale:** ImuProbe already does inter-sample interval analysis (lines 119: `val intervalsMs = sustained.zipWithNext { a, b -> (b - a) / 1_000_000.0 }`). ImuRateObserver inverts this — looks at SAMPLE rate (1 / interval × 1000), not interval ms; takes the **first** percentile (1%) instead of the 99th, over **sliding 1 s windows** (RESEARCH Pitfall 3 lines 581–593 + Assumption A5).

**Pattern from `compat/ImuProbe.kt` lines 118–122:**

```kotlin
val intervalsMs = sustained.zipWithNext { a, b -> (b - a) / 1_000_000.0 }
val p99Ms = intervalsMs.sorted()[min(intervalsMs.size * 99 / 100, intervalsMs.size - 1)].toFloat()
```

ImuRateObserver swaps:

- `intervalsMs` → `windowsHz` (each window = 1 s of samples; rate = `samples_in_window / 1.0`)
- `p99Ms` → `p1Hz = sortedHz[ceil(size * 0.01)]`

CRITICAL per RESEARCH Pitfall 3: "uses inter-sample intervals from `event.timestamp` (which is the physical sample time, NOT the time of `onSensorChanged`)." The 200 ms `maxReportLatency` causes burst delivery; physical sample timestamps stay correct. Phase 2 ImuProbe runs `maxReportLatency=0` so it didn't have this constraint — Phase 3 must.

---

### `HashStreamer.kt` (streaming SHA-256 over FileChannel)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt::downloadAndVerifyApk` lines 75–98 (streaming MessageDigest over an InputStream — same Streamer-during-write pattern).

**Rationale:** HumynUpdater streams through `MessageDigest.update(buf, 0, n)` while writing to a FileOutputStream. Phase 3's HashStreamer is the inverse — read-only over a file (CAP-18 hard rule: never re-encode), streaming through MessageDigest. Same primitive, different I/O direction.

**Streaming-hash pattern from `updater/HumynUpdaterModule.kt` lines 73–98:**

```kotlin
val md = MessageDigest.getInstance("SHA-256")
val conn = (URL(url).openConnection() as HttpURLConnection).apply { /* ... */ }
conn.inputStream.use { input ->
    FileOutputStream(cacheFile).use { out ->
        val buf = ByteArray(64 * 1024)
        var n = input.read(buf)
        while (n != -1) {
            md.update(buf, 0, n)
            out.write(buf, 0, n)
            n = input.read(buf)
        }
    }
}
val actualHex = md.digest().joinToString("") { "%02x".format(it) }
```

**Phase 3 pattern from RESEARCH Code Example 8** (read-only file via FileChannel):

```kotlin
object HashStreamer {
    fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteBuffer.allocate(64 * 1024)
        FileChannel.open(file.toPath()).use { ch ->
            while (true) {
                buf.clear()
                if (ch.read(buf) < 0) break
                buf.flip()
                md.update(buf)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
```

(`updater/HumynUpdaterModule.kt`'s `joinToString("") { "%02x".format(it) }` lowercase-hex pattern is the format we want — matches the wire-shape `recording.fileSha256` field.)

---

### `BackUltrawidePicker.kt` (NEW shared util — extracted from compat/DeviceCaps.kt per Claude's Discretion)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt::pickBackUltrawide` lines 140–214 (full method + `UltrawidePick` data class lines 67–71).

**Rationale:** CONTEXT.md Claude's Discretion lists three options for sharing the lens-id selection logic between Phase 2's compat probe and Phase 3's capture path: (a) extract a shared util in `ai.humynlabs.capture.common`, (b) duplicate with a comment, (c) read `compat.lastResult.v1` from MMKV. The user signalled (a) is preferred ("HumynCapture should reuse the same enumeration logic" — CONTEXT.md `<decisions>` Claude's Discretion). Planner verifies; if (c) is picked instead, this file does not exist.

**Code to extract verbatim** — `compat/DeviceCaps.kt` lines 140–214:

```kotlin
internal fun pickBackUltrawide(mgr: CameraManager): UltrawidePick? {
    // [...full body, including LOGICAL_MULTI_CAMERA flattening per Pitfall 5...]
}
```

The `UltrawidePick` data class (lines 67–71) moves to `capture/common/BackUltrawidePicker.kt`. `compat/DeviceCaps.kt` keeps `pickBackUltrawide` as a thin delegate `pickBackUltrawide(mgr) = BackUltrawidePicker.pick(mgr)` to preserve the existing test (`compat/DeviceCapsTest.kt`).

---

### `SegmentTimer.kt` (Handler.postDelayed scheduling for 10-min auto-cut)

**Analog:** `compat/EncoderProbe.kt` lines 101–110 (HandlerThread + Handler pattern — though EncoderProbe uses busy-wait `while (System.nanoTime() < end)`, not `postDelayed`).

**Rationale:** No exact analog. Closest is the HandlerThread setup pattern. The actual `Handler.postDelayed(runnable, segmentMinutes * 60_000L)` API is JDK-standard. RESEARCH Pattern 2 lines 411–422 has the full segment-rotation handler pseudocode.

**HandlerThread skeleton from `compat/EncoderProbe.kt` lines 101–103:**

```kotlin
val handlerThread = HandlerThread("EncoderProbe").apply { start() }
val handler = Handler(handlerThread.looper)
```

Phase 3 uses `HandlerThread("HumynCapture-Segment")` and posts the rotation callback via `handler.postDelayed({ rotateSegment() }, segmentMinutes * 60_000L)`. Cancel via `handler.removeCallbacks(...)` on `stop()`.

**Robolectric test pattern from `compat/ImuProbeTest.kt` style:** Robolectric provides `ShadowLooper` which lets the test fast-forward time (`shadowOf(handler.looper).idleFor(Duration.ofMinutes(10))`) without a wall-clock wait.

---

### `ThermalGate.kt` (PowerManager pre-flight + OnThermalStatusChangedListener)

**Analog:** `compat/EncoderProbe.kt` lines 132–155 (callback-via-Handler pattern — different OS API but identical async-callback+single-thread shape) + RESEARCH Code Example 6 lines 866–900.

**Rationale:** No PowerManager use in Phase 2. Closest analog is EncoderProbe's `CameraCaptureSession.StateCallback` registered via Handler — same single-thread-callback pattern. Pre-flight is synchronous (`getCurrentThermalStatus()` returns an int). Mid-record is async via `addThermalStatusListener(executor, listener)`.

**Pre-flight + listener pattern from RESEARCH Code Example 6:**

```kotlin
class ThermalGate(ctx: Context) {
    private val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager

    fun preFlight(): Result<Unit> {
        val status = pm.currentThermalStatus
        return if (status >= PowerManager.THERMAL_STATUS_THROTTLING) {
            Result.failure(ThermalRefuseException(status))
        } else Result.success(Unit)
    }

    fun subscribeMidRecord(onSevere: () -> Unit): AutoCloseable {
        val listener = PowerManager.OnThermalStatusChangedListener { status ->
            if (status >= PowerManager.THERMAL_STATUS_SEVERE) onSevere()
        }
        pm.addThermalStatusListener(Executors.newSingleThreadExecutor(), listener)
        return AutoCloseable { pm.removeThermalStatusListener(listener) }
    }
}
```

Robolectric `ShadowPowerManager.setCurrentThermalStatus(int)` drives the unit test (`ThermalGateTest.kt`).

---

### `HumynForegroundService.kt` (Android Service — first in the project)

**Analog:** NONE in codebase. RESEARCH Code Example 7 lines 902–943 is the canonical reference.

**Rationale:** Phase 2 has zero `android.app.Service` subclasses. The pattern lands fresh from the AOSP foreground-service docs + RESEARCH Code Example 7. The Pitfall-6 strict-bitmask matching (lines 625–635) is the critical correctness invariant: manifest `android:foregroundServiceType="camera|microphone|dataSync"` MUST exactly equal the runtime `FGS_TYPE_RECORDING` bitmask.

**Full pattern from RESEARCH Code Example 7:**

```kotlin
package ai.humynlabs.capture.fgs

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.ServiceCompat

class HumynForegroundService : Service() {
    private var uploadActive = false  // Phase 5 toggles via setUploadActive()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notif = HumynForegroundNotification.build(this, "Recording in progress")
        ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
        return START_STICKY
    }

    fun setUploadActive(active: Boolean) {
        uploadActive = active
        // Phase 5 wires the dataSync downgrade here.
    }

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

**Manifest entry that MUST go into `apps/mobile/android/app/src/main/AndroidManifest.xml`** inside `<application>` (NEW — current manifest has no `<service>` declaration; existing manifest `<application>` block lines 54–73 of the analog manifest is the insertion site):

```xml
<service android:name=".fgs.HumynForegroundService"
         android:foregroundServiceType="camera|microphone|dataSync"
         android:exported="false" />
```

The four `FOREGROUND_SERVICE_*` permissions are already declared (manifest lines 32–35 — confirmed). No permission changes needed.

---

### `HumynForegroundNotification.kt` (NotificationChannel + ongoing notification)

**Analog:** NONE in codebase (Phase 2 had no notifications — PROJECT.md "no notifications channel at MVP" applies to user-facing notifications; the FGS notification is OS-required system chrome, not opt-in).

**Rationale:** Pure standard Android pattern. Channel created in `MainApplication.onCreate` (low-priority, no sound, ongoing flag). NOTIF_ID and channel-id are constants. No analog to copy from; the file is small (~30 LOC).

**Skeleton — derived from CONTEXT.md `<specifics>` block "HumynForegroundService notification UX":**

```kotlin
package ai.humynlabs.capture.fgs

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat

object HumynForegroundNotification {
    const val CHANNEL_ID = "humyn_capture_fgs"

    fun ensureChannel(ctx: Context) {
        val mgr = ctx.getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Recording",
            NotificationManager.IMPORTANCE_LOW,
        ).apply { setShowBadge(false); enableVibration(false) }
        mgr?.createNotificationChannel(channel)
    }

    fun build(ctx: Context, text: String): Notification =
        NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)  // planner picks brand-icon resource
            .setContentTitle("Humyn Labs Capture")
            .setContentText(text)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
}
```

Channel is created in `MainApplication.onCreate` after the orphan sweep — same hook, one new line: `HumynForegroundNotification.ensureChannel(this)`.

---

### `apps/mobile/src/native/HumynCapture.ts` (typed JS bridge)

**Analog:** `apps/mobile/src/native/HumynCompat.ts` (entire 116 lines).

**Rationale:** This file IS the canonical Phase-2 JS-side native-module binding pattern. Phase 3 reproduces the exact `NativeModules.HumynXxx` resolver + `ensure()` helper + per-method async function shape. The new wrinkle is `NativeEventEmitter` subscription helpers (Phase 2 had no events).

**`ensure()` + interface pattern** (lines 71–85):

```typescript
interface HumynCompatNativeModule {
  runEncoderProbe(): Promise<EncoderProbeResult>;
  runImuProbe(durationMs: number, withPreview: boolean): Promise<ImuProbeResult>;
  readDeviceCaps(): Promise<DeviceCapsResult>;
}

function ensure(): HumynCompatNativeModule {
  const native = NativeModules.HumynCompat as HumynCompatNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynCompat native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}
```

Phase 3 swaps `HumynCompat` → `HumynCapture` and adds:

```typescript
interface HumynCaptureNativeModule {
  start(
    opts: CaptureSessionOpts,
  ): Promise<{ sessionId: string; segmentId: string; recordingId: string; filenameBase: string }>;
  stop(): Promise<void>;
}

// NativeEventEmitter helpers — NEW for Phase 3 (D-API-01)
import { NativeEventEmitter } from 'react-native';
const emitter = new NativeEventEmitter(NativeModules.HumynCapture);
export function onSegmentStart(listener: (e: SegmentStartEvent) => void) {
  return emitter.addListener('onSegmentStart', listener);
}
// etc. for onSegmentComplete, onSessionStop, onThermalAbort, onError
```

Event payload contracts come from CONTEXT.md D-API-03 (verbatim).

---

### `apps/mobile/__tests__/native/HumynCapture.test.ts` (JS bridge contract test)

**Analog:** `apps/mobile/__tests__/native/HumynCompat.test.ts` (entire 79 lines).

**Rationale:** Phase 2 already proved the Vitest + `vi.doMock('react-native', ...)` + `vi.resetModules()` pattern for testing native-module bridges without a real device. Phase 3 reproduces the three test cases (rejects-when-missing, forwards-args, propagates-rejection) for `start` + `stop` and adds NativeEventEmitter mocking via `vi.doMock`.

**Three-test pattern from `__tests__/native/HumynCompat.test.ts` lines 19–78:**

```typescript
describe('HumynCompat (native module not registered)', () => {
  beforeEach(() => { vi.resetModules(); });
  it('runEncoderProbe rejects when native module missing', async () => {
    const { runEncoderProbe } = await import('../../src/native/HumynCompat');
    await expect(runEncoderProbe()).rejects.toThrow(/HumynCompat native module not registered/);
  });
  // ...
});

describe('HumynCompat (native module registered)', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.doUnmock('react-native'); });
  it('runImuProbe forwards args and returns resolved value verbatim', async () => {
    const native = { runImuProbe: vi.fn().mockResolvedValue({...}) };
    vi.doMock('react-native', () => ({ NativeModules: { HumynCompat: native } }));
    const { runImuProbe } = await import('../../src/native/HumynCompat');
    const result = await runImuProbe(30000, true);
    expect(native.runImuProbe).toHaveBeenCalledWith(30000, true);
  });
});
```

Phase 3 swaps `HumynCompat` → `HumynCapture`; method names `runEncoderProbe` / `runImuProbe` → `start` / `stop`; adds a fourth describe block for NativeEventEmitter event-subscription contract.

---

### Kotlin Robolectric tests (12 NEW test files in `.../capture/` and `.../fgs/`)

**Analog:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/{ImuProbeTest.kt,EncoderProbeTest.kt,NalParserTest.kt,DeviceCapsTest.kt}` — Phase 2's already-shipping unit-test layout.

**Rationale:** Robolectric infra is wired (`apps/mobile/android/app/src/test/resources/robolectric.properties` confirmed present). Test fixtures already exist (`apps/mobile/android/app/src/test/resources/hevc-fixtures/{ibp.h265,i-only.h265}` — reusable for `HevcEncoderConfigTest.kt`). No framework install needed.

**Pure-fn test pattern from `compat/ImuProbeTest.kt` lines 10–49 (testing `internal fun computeResult(...)`):**

```kotlin
@RunWith(RobolectricTestRunner::class)
class ImuProbeTest {
    private val probe = ImuProbe(RuntimeEnvironment.getApplication())

    @Test
    fun `200 Hz uniform stream after 5s warm-up reports ~200 Hz sustained`() {
        val ts = mutableListOf<Long>()
        val period = 5_000_000L
        for (i in 0 until 6000) ts.add(i.toLong() * period)
        val r = probe.computeResult(ts)
        assertTrue("sustainedHz should be ~200 Hz", r.sustainedHz in 195f..205f)
        assertEquals(6000, r.samplesCollected)
    }
}
```

Phase 3 mirrors for `DriftCalculatorTest`, `ImuRateObserverTest`, `FilenameGeneratorTest`, `UlidGeneratorTest`.

**File-fixture test pattern from `compat/EncoderProbeTest.kt` lines 19–37:**

```kotlin
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class EncoderProbeTest {
    @Test
    fun `orphan compat-probe clips match the MainApplication sweep glob`() {
        val ctx = RuntimeEnvironment.getApplication()
        val orphan = File(ctx.cacheDir, "compat-probe-12345.mp4")
        orphan.writeBytes(byteArrayOf(0))
        // [...sweep + assertion...]
    }
}
```

Phase 3 mirrors for `HashStreamerTest`, `SidecarManagerTest`, `MetadataSchemaConformanceTest`, `ImuWriterCsvFormatTest`, `HumynForegroundServiceTest`.

**Robolectric `@Config(sdk = [33])` pin:** Phase 2 uses SDK 33 for camera tests (HDR-on-API-33 branches). Phase 3 reuses the same pin for FGS-Service tests (Android 14 = API 34 strict-mode for FGS; SDK 33 is the legal minimum for the new behavior; planner verifies whether to bump tests to `@Config(sdk = [34])` for FGS strict-mode).

---

## Wave 1 — Cosmetic-fixup pattern assignments

### Tasks/History TopBar avatar wiring (D-WAVE-03)

**Analog:** `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` lines 31–45 (full TopBar prop wiring + appStore.user selector + avatarInitial derivation + spread for avatarUrl).

**Pattern to mirror in Tasks + History:**

```tsx
const user = useAppStore((s) => s.user);
const avatarInitial = (
  (user?.name ?? user?.email ?? 'U').trim().slice(0, 1) || 'U'
).toUpperCase();

return (
  <ScreenContainer accessibilityLabel="..." padding={0}>
    <TopBar
      onAvatarPress={() => navigation.navigate('Profile')}
      avatarInitial={avatarInitial}
      {...(user?.avatarUrl ? { avatarUrl: user.avatarUrl } : {})}
    />
    {/* ... */}
```

Currently `TasksPlaceholderScreen.tsx` line 18 + `HistoryPlaceholderScreen.tsx` line 18 render `<TopBar onAvatarPress={() => navigation.navigate('Profile')} />` with NO avatar props (regressing to the 'U' fallback). The fix is exactly the four lines above plus the import.

### `useTabTopBarProps()` hook extract (D-WAVE-03)

**Source code to extract:** `HomeSkeletonScreen.tsx` lines 32–37 + line 41–45 spread shape →

```tsx
// apps/mobile/src/hooks/useTabTopBarProps.ts (NEW)
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../state/appStore';

export function useTabTopBarProps() {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  const user = useAppStore((s) => s.user);
  const avatarInitial = (
    (user?.name ?? user?.email ?? 'U').trim().slice(0, 1) || 'U'
  ).toUpperCase();
  return {
    avatarInitial,
    avatarUrl: user?.avatarUrl,
    onAvatarPress: () => navigation.navigate('Profile'),
  };
}
```

All three tab bodies (Home + Tasks + History) consume identically: `const topBarProps = useTabTopBarProps(); return (<><TopBar {...topBarProps} /></>);`.

### Foreground rehydrate hook (`appStore.user == null && jwt != null` → `/me`)

**Analog placement:** `apps/mobile/src/navigation/RootNativeStack.tsx` (top-level mount point — the hook fires on AppState change) OR `MainTabs.tsx` (closer to the avatar surface). User-preferred per CONTEXT.md D-WAVE-05 = `RootNativeStack`/`MainTabs` foreground hook firing `/me` when `appStore.user == null && jwt != null`.

**Pattern source:** `apps/mobile/src/services/profileService.ts::fetchMe` (line 70 — `apiClient.get<MeResponse>('/me')`). Hook calls this on `AppState` change to `'active'` AND mount.

**Skeleton:**

```tsx
// In RootNativeStack.tsx or MainTabs.tsx
import { AppState } from 'react-native';
import { useAppStore } from '../state/appStore';
import { fetchMe } from '../services/profileService';

useEffect(() => {
  const rehydrate = async () => {
    const { user, jwt } = useAppStore.getState();
    if (user == null && jwt != null) {
      try {
        useAppStore.getState().setUser(await fetchMe());
      } catch (_) {
        /* swallow */
      }
    }
  };
  rehydrate();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') rehydrate();
  });
  return () => sub.remove();
}, []);
```

### Compat-fail + Recovery merge (D-WAVE-05 plan 2)

**Analog (sources to merge):** `apps/mobile/src/screens/compat/CompatFailScreen.tsx` (parent — keep) + `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` (child — body inlined into parent, file deleted).

**Required actions (per CONTEXT.md D-WAVE-05 + 02-COSMETIC-GAPS.md "Compat-fail screen" section):**

1. Inline `CompatRecoveryScreen.tsx`'s render body into `CompatFailScreen.tsx` after the failure-list block.
2. Delete `CompatRecoveryScreen.tsx` + `__tests__/screens/CompatRecoveryScreen.test.tsx`.
3. Update Pattern 54 route-registry invariant test to remove the `CompatRecovery` entry from the locked-routes list.
4. Replace email substitution in the merged screen (1 of 5 `[EMAIL_ADDRESS]` occurrences → `support@humynlabs.ai`).

### Visual snapshot tests (D-WAVE-06)

**Analog:** `apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx` (Vitest + jsdom + React Testing Library — Phase 2 already-shipped pattern).

**Rationale:** D-WAVE-06 picks `jest-image-snapshot` driven through Vitest with PNG baselines under `apps/mobile/__tests__/visual/__image_snapshots__/`. The HOC for image diffing isn't already in the repo; planner adds the dev dep and an `expect.extend` adapter to `vitest.setup.ts`.

**Test-file shape (NEW pattern — derived from D-WAVE-06):**

```tsx
// apps/mobile/__tests__/visual/HomeSkeletonScreen.visual.test.tsx
import { render } from '@testing-library/react-native';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
expect.extend({ toMatchImageSnapshot });
test('Home skeleton matches baseline', async () => {
  const { container } = render(<HomeSkeletonScreen />);
  const png = await renderToImage(container); // helper TBD per planner
  expect(png).toMatchImageSnapshot();
});
```

Baselines committed to repo (NOT gitignored — D-WAVE-06 explicit).

---

## Shared Patterns (cross-cutting)

### Pattern A: Native-module skeleton (TurboModule + ReactPackage + JS bridge + Vitest test)

**Source files:**

- Kotlin module: `compat/HumynCompatModule.kt` (87 LOC)
- Kotlin package: `compat/HumynCompatPackage.kt` (22 LOC)
- JS bridge: `apps/mobile/src/native/HumynCompat.ts` (116 LOC)
- JS bridge test: `apps/mobile/__tests__/native/HumynCompat.test.ts` (79 LOC)
- Application registration: `MainApplication.kt` line 32

**Apply to:** `HumynCaptureModule.kt`, `HumynCapturePackage.kt`, `HumynCapture.ts`, `HumynCapture.test.ts`, `MainApplication.kt` extension.

**Critical contract:** the JS bridge file's `ensure()` error message MUST point to `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` so a missing-registration failure is debuggable. Phase 2's `HumynCompat.ts` line 81–82 sets the precedent.

### Pattern B: Single-thread bgExecutor for OS-level work

**Source:** `compat/HumynCompatModule.kt` line 44 + `updater/HumynUpdaterModule.kt` line 65:

```kotlin
private val bgExecutor = Executors.newSingleThreadExecutor()
```

**Apply to:** ALL Phase 3 native methods that touch Camera2 / MediaCodec / SensorManager / FileChannel / FGS lifecycle. Promise method bodies dispatch to `bgExecutor.execute { try { ... } catch (t: Throwable) { promise.reject(...) } }`. Two executors in `HumynCaptureModule` per RESEARCH Pattern 3 line 452–453: `captureExecutor` (start/stop serialization) + `finalizeExecutor` (concurrent finalize).

### Pattern C: Per-method error code on Promise.reject

**Source:** `compat/HumynCompatModule.kt` line 61: `promise.reject("ENCODER_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)` — and the same shape in `HumynUpdater` (`HASH_MISMATCH`, `INSTALL_NOT_ALLOWED`, `INSTALL_FAILED`, `DOWNLOAD_FAILED`).

**Apply to:** Phase 3 error codes per CONTEXT.md `<decisions>` Claude's Discretion + RESEARCH Pattern 3 line 462. Recommended starter taxonomy (planner ratifies):

- `thermal_throttling` (pre-flight refuse)
- `realtime_clock_unavailable` (defense-in-depth post-compat)
- `camera_open_failed` / `encoder_config_failed` / `audio_config_failed`
- `storage_full` / `permission_revoked` (mid-record IOException)
- `internal_error` (catch-all)

The `recoverable: boolean` field per CONTEXT.md D-API-01 lives in the error message JSON, not in `promise.reject`'s third arg. Bridge marshalling: `promise.reject(code, JSONObject().put("message", msg).put("recoverable", recoverable).toString())` is one option; planner picks.

### Pattern D: Robolectric + pure-fn test seam

**Source:** `compat/ImuProbe.kt::computeResult` (internal pure fn) + `compat/ImuProbeTest.kt` (synthetic input arrays).

**Apply to:** `DriftCalculator`, `ImuRateObserver`, `FilenameGenerator`, `UlidGenerator`, `MetadataComposer`, `HashStreamer`, `SidecarManager`, `SegmentTimer`, `ThermalGate`. Every Phase 3 file with non-trivial logic exposes an `internal` pure fn (or a static `object`) with `LongArray` / `List<Long>` / `String` / `JSONObject` parameters that the test exercises without spinning up the camera/sensor stack. Camera/MediaCodec/AudioRecord paths are NOT unit-tested (Robolectric can't shadow them faithfully — `compat/EncoderProbeTest.kt` line 18 calls this out explicitly: "Camera2 + MediaCodec are not faithfully shadowable by Robolectric").

### Pattern E: HandlerThread + Handler for OS callback dispatch

**Source:** `compat/EncoderProbe.kt` lines 101–103 + `compat/ImuProbe.kt` lines 55–57:

```kotlin
val handlerThread = HandlerThread("Probe").apply { start() }
val handler = Handler(handlerThread.looper)
sm.registerListener(listener, sensor, SENSOR_DELAY_FASTEST, batchUs, handler)
// or: mgr.openCamera(id, callback, handler)
// or: handler.postDelayed({ ... }, delayMs)
```

**Apply to:** Camera2 lifecycle (capture handler), IMU listener (one HandlerThread, both sensors register against it — RESEARCH Code Example 3 line 768 single-thread invariant), audio recording, segment timer, thermal listener (note: `addThermalStatusListener(executor, listener)` takes Executor not Handler — use `Executors.newSingleThreadExecutor()`).

Cleanup: `handlerThread.quitSafely()` on stop. CRITICAL: use `quitSafely()` not `quit()` so pending posts drain.

### Pattern F: Streaming Hash via MessageDigest

**Source:** `updater/HumynUpdaterModule.kt::downloadAndVerifyApk` lines 73–98.

**Apply to:** `HashStreamer.sha256(File)` for `.mp4` and `.csv` files at finalize. Hex-format with `"%02x".format(byte)` to match `recording.fileSha256` wire shape. Always lowercase. Read-only via `FileChannel.open(file.toPath()).use { ch -> ... }` per RESEARCH Code Example 8 (CAP-18 hard rule — never re-encode, never mmap-write).

### Pattern G: Orphan-sweep glob in `MainApplication.onCreate`

**Source:** `MainApplication.kt` lines 56–58:

```kotlin
cacheDir.listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
    ?.forEach { it.delete() }
```

**Apply to:** Phase 3's three new sweeps under `filesDir/`:

1. `recordings/*.mp4` without matching `.json` → re-finalize via sidecar OR delete triple
2. `recordings/*.json` orphans (no matching `.mp4`) → delete
3. `practice/*` files older than 24 h → delete

Encapsulate in `CaptureLaunchSweep.kt` (planner picks placement). MainApplication just calls it once.

### Pattern H: MMKV `.v1` key versioning

**Source:** Phase 2 keys `auth.jwt.v1`, `compat.lastResult.v1`, `installation_id.v1` (from `apps/mobile/src/state/keys.ts` + CONTEXT.md "Established Patterns").

**Apply to:** Any Phase 3 MMKV reads/writes. Planner's discretion on whether to use MMKV-backed counter for filename `_NNN` (RESEARCH Open Question 2 recommends `ls`-derived as authoritative; MMKV optional cache). If used: key would be `capture.day_seq.v1` keyed by `YYYYMMDD`.

### Pattern I: Zod schema in `shared/types/src/`

**Source:** `shared/types/src/CompatResult.ts` (Phase 2 — not read this round; planner re-verifies path exists, expected from CONTEXT.md "Reusable Assets").

**Apply to:** `shared/types/src/CaptureSessionOpts.ts` (Phase 3 NEW). Mirrors the `start(opts)` shape from CONTEXT.md D-API-02. Cross-validates against the Kotlin `CaptureSessionOpts.fromBridge(ReadableMap)` parser via a Vitest test that asserts both schemas reject the same invalid inputs.

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md Code Examples + cited external sources instead):

| File                             | Role                | Data Flow    | Reason                                                                                        | RESEARCH Reference                                              |
| -------------------------------- | ------------------- | ------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `HumynForegroundService.kt`      | Android Service     | event-driven | First `android.app.Service` subclass in the project                                           | RESEARCH Code Example 7 lines 902–943                           |
| `HumynForegroundNotification.kt` | NotificationChannel | view         | First notification in the project (PROJECT.md "no notifications" applies to user-facing only) | CONTEXT.md `<specifics>` block                                  |
| `FragmentedMuxerWrapper.kt`      | muxer adapter       | streaming    | New library `androidx.media3:media3-muxer:1.10.0` (Phase 2 used stock `MediaMuxer`)           | RESEARCH Pitfall 1 lines 542–561 + Standard Stack lines 184–201 |
| `SidecarManager.kt`              | JSON sidecar        | file-I/O     | Sidecar pattern is Phase-3-introduced (D-FS-05)                                               | CONTEXT.md `<specifics>` block + D-FS-05                        |
| `UlidGenerator.kt`               | ULID minter         | batch        | New primitive — either add `io.azam.ulidj:ulidj:2.0.0` dep or hand-roll 50 LOC                | RESEARCH Don't Hand-Roll table lines 515 + Assumption A6        |

---

## Metadata

**Analog search scope:**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/` (all subdirectories: `compat/`, `updater/`, root)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/`
- `apps/mobile/android/app/src/test/resources/`
- `apps/mobile/src/native/`
- `apps/mobile/src/screens/{home,tasks,history,profile,signup,permissions,compat,splash,tutorial,help}/`
- `apps/mobile/src/components/{TopBar,BottomNav}.tsx`
- `apps/mobile/src/state/appStore.ts`
- `apps/mobile/src/services/{profileService,api}.ts`
- `apps/mobile/src/navigation/`
- `apps/mobile/__tests__/{native,screens}/`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `shared/types/src/`

**Files scanned (concrete reads in this pass):**

1. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt` (87 LOC)
2. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt` (22 LOC)
3. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt` (239 LOC)
4. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` (123 LOC)
5. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` (304 LOC)
6. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt` (148 LOC)
7. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` (60 LOC)
8. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt` (162 LOC)
9. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterPackage.kt` (26 LOC)
10. `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt` (57 LOC)
11. `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/EncoderProbeTest.kt` (38 LOC)
12. `apps/mobile/src/native/HumynCompat.ts` (116 LOC)
13. `apps/mobile/__tests__/native/HumynCompat.test.ts` (79 LOC)
14. `apps/mobile/android/app/src/main/AndroidManifest.xml` (75 LOC)
15. `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` (60 LOC sampled)
16. `apps/mobile/src/components/BottomNav.tsx` (88 LOC)
17. `apps/mobile/src/components/TopBar.tsx` (60 LOC sampled)

Plus targeted greps on `TasksPlaceholderScreen.tsx`, `HistoryPlaceholderScreen.tsx`, `appStore.ts`, `profileService.ts`, `MainTabs.tsx`, `RootNativeStack.tsx`.

**Pattern extraction date:** 2026-05-10
