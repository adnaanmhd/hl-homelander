---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 06
id: 02-06-humyn-compat-kotlin-shells
name: HumynCompat Kotlin module shell + JS bridge + package registration
type: execute
wave: 1
depends_on: [02-02-test-scaffolding-and-deps]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/src/native/HumynCompat.ts
  - apps/mobile/__tests__/native/HumynCompat.test.ts
autonomous: true
requirements: [COMPAT-01, COMPAT-02, COMPAT-07]
must_haves:
  truths:
    - 'HumynCompatModule.kt declares three @ReactMethod functions matching D-COMPAT-02 surface'
    - "HumynCompatPackage is registered in MainApplication.kt's getPackages()"
    - 'MainApplication.onCreate sweeps orphan compat-probe-*.mp4 files in cacheDir (D-COMPAT-04)'
    - 'EncoderProbe.kt, ImuProbe.kt, DeviceCaps.kt, NalParser.kt scaffolds exist with TODOs marking the per-probe implementation work for 02-12/02-13/02-14'
    - 'JS-side HumynCompat.ts surfaces the typed contract; missing-module error matches PlayIntegrity pattern'
  artifacts:
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt'
      provides: 'Three-method TurboModule surface for compat probes'
      contains: '@ReactMethod'
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt'
      provides: 'HEVC Annex B start-code walker + slice_type extractor scaffold'
      contains: 'anyBFrames'
    - path: 'apps/mobile/src/native/HumynCompat.ts'
      provides: 'Typed JS bridge'
      contains: 'runEncoderProbe'
  key_links:
    - from: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt'
      to: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt'
      via: 'packages.add(HumynCompatPackage())'
      pattern: "HumynCompatPackage\\(\\)"
---

<objective>
Author the Kotlin native-module shell for behavioral compat probing per D-COMPAT-01..02. The full implementation of NAL parsing / IMU sustained-rate probing / device-cap enumeration lands in plans 02-12/02-13/02-14; this plan ships:
- the three-method ReactModule surface,
- the four helper-class skeletons (NalParser, EncoderProbe, ImuProbe, DeviceCaps) with method signatures + TODOs,
- the package registration in MainApplication,
- the cacheDir orphan-sweep,
- the typed JS bridge.

Purpose: separates the boilerplate (module wiring) from the per-probe logic so 02-12/13/14 each focus on one probe without re-deriving the module shape.
Output: `./gradlew assembleApkRolloutDebug` succeeds; `NativeModules.HumynCompat` is visible from JS at runtime; calling any of the three methods rejects with `NOT_IMPLEMENTED` until subsequent plans flesh the bodies out.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorPackage.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
@apps/mobile/src/native/PlayIntegrity.ts

<interfaces>
<!-- D-COMPAT-02 — three-method native module surface -->
runEncoderProbe(): Promise<{
  bFramePresent: boolean;
  oisOff: boolean;
  hdrSdrForced: boolean;
  encoderClipPath: string;
}>;
runImuProbe(durationMs: number, withPreview: boolean): Promise<{
  sustainedHz: number;
  p99IntervalMs: number;
  samplesCollected: number;
}>;
readDeviceCaps(): Promise<{
  resolutionMax: { w: number; h: number };
  fpsMax: number;
  ultrawideDfovDeg: number;
  micSampleRateMax: number;
  realtimeTimestampSource: boolean;
  rooted: boolean;
  freeStorageGB: number;
}>;

<!-- Phase 1 PlayIntegrityModule.kt skeleton (analog from 02-PATTERNS.md lines 407-432) -->

@ReactModule(name = PlayIntegrityModule.NAME)
class PlayIntegrityModule(reactContext: ReactApplicationContext) :
ReactContextBaseJavaModule(reactContext) {
companion object { const val NAME = "PlayIntegrity" }
override fun getName() = NAME
@ReactMethod
fun requestIntegrityToken(nonce: String, promise: Promise) {
try { ... } catch (e: Exception) { promise.reject("CODE", "${e::class.simpleName}: ${e.message}", e) }
}
}
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                                     | Description                                    |
| ------------------------------------------------------------ | ---------------------------------------------- |
| Camera2/SensorManager/MediaCodec native APIs → cacheDir clip | filesystem write; must be deleted in finally   |
| JS → Kotlin Promise reject                                   | error wrapping must NOT leak sensitive strings |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                | Disposition | Mitigation Plan                                                                                                                                          |
| --------- | ---------------------- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.6-01  | Information Disclosure | encoderClipPath leaks the absolute filesystem path to JS | accept      | path is a transient cacheDir entry deleted in finally; not persisted; not used outside the probe scope. JS does not log it.                              |
| T-2.6-02  | Tampering              | encoded probe clip retained on crash                     | mitigate    | MainApplication.onCreate sweeps `compat-probe-*.mp4` (D-COMPAT-04). Plan-checker enforces the sweep in this plan; 02-12 verifies finally-block deletion. |
| T-2.6-03  | Denial of Service      | probe runs on main thread, blocks UI                     | mitigate    | All three methods dispatch to a `Executors.newSingleThreadExecutor()` background worker. RESEARCH § Anti-Patterns is explicit on this.                   |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author Kotlin module shell + 4 helper skeletons + Package registration</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt (NEW), HumynCompatPackage.kt (NEW), NalParser.kt (NEW), EncoderProbe.kt (NEW), ImuProbe.kt (NEW), DeviceCaps.kt (NEW), apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt (full file — analog Kotlin module pattern)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorPackage.kt (full file — Package pattern; copy structure)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (current onCreate + getPackages — confirm where to inject HumynCompatPackage and the cacheDir sweep)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "HumynCompatModule.kt" lines 401-441 + "MainApplication.kt" lines 493-521
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Code Examples" — NAL parser (lines 712-762), dFOV (lines 766-786), IMU probe (lines 793-824)
  </read_first>
  <action>
    1. Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt`:
       ```kotlin
       package ai.humynlabs.capture.compat

       import com.facebook.react.bridge.Arguments
       import com.facebook.react.bridge.Promise
       import com.facebook.react.bridge.ReactApplicationContext
       import com.facebook.react.bridge.ReactContextBaseJavaModule
       import com.facebook.react.bridge.ReactMethod
       import com.facebook.react.module.annotations.ReactModule
       import java.util.concurrent.Executors

       @ReactModule(name = HumynCompatModule.NAME)
       class HumynCompatModule(reactContext: ReactApplicationContext) :
           ReactContextBaseJavaModule(reactContext) {

           companion object {
               const val NAME = "HumynCompat"
           }

           private val bgExecutor = Executors.newSingleThreadExecutor()

           override fun getName() = NAME

           @ReactMethod
           fun runEncoderProbe(promise: Promise) {
               bgExecutor.execute {
                   try {
                       val result = EncoderProbe(reactApplicationContext).run()
                       promise.resolve(Arguments.makeNativeMap(mapOf(
                           "bFramePresent" to result.bFramePresent,
                           "oisOff" to result.oisOff,
                           "hdrSdrForced" to result.hdrSdrForced,
                           "encoderClipPath" to result.encoderClipPath,
                       )))
                   } catch (t: Throwable) {
                       promise.reject("ENCODER_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)
                   }
               }
           }

           @ReactMethod
           fun runImuProbe(durationMs: Double, withPreview: Boolean, promise: Promise) {
               bgExecutor.execute {
                   try {
                       val result = ImuProbe(reactApplicationContext).run(durationMs.toLong(), withPreview)
                       promise.resolve(Arguments.makeNativeMap(mapOf(
                           "sustainedHz" to result.sustainedHz,
                           "p99IntervalMs" to result.p99IntervalMs,
                           "samplesCollected" to result.samplesCollected,
                       )))
                   } catch (t: Throwable) {
                       promise.reject("IMU_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)
                   }
               }
           }

           @ReactMethod
           fun readDeviceCaps(promise: Promise) {
               bgExecutor.execute {
                   try {
                       val result = DeviceCaps(reactApplicationContext).read()
                       val resMap = Arguments.makeNativeMap(mapOf("w" to result.resolutionMax.first, "h" to result.resolutionMax.second))
                       promise.resolve(Arguments.makeNativeMap(mapOf(
                           "resolutionMax" to resMap,
                           "fpsMax" to result.fpsMax,
                           "ultrawideDfovDeg" to result.ultrawideDfovDeg,
                           "micSampleRateMax" to result.micSampleRateMax,
                           "realtimeTimestampSource" to result.realtimeTimestampSource,
                           "rooted" to result.rooted,
                           "freeStorageGB" to result.freeStorageGB,
                       )))
                   } catch (t: Throwable) {
                       promise.reject("DEVICE_CAPS_ERROR", "${t::class.simpleName}: ${t.message}", t)
                   }
               }
           }
       }
       ```

    2. Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt`:
       ```kotlin
       package ai.humynlabs.capture.compat

       import com.facebook.react.ReactPackage
       import com.facebook.react.bridge.NativeModule
       import com.facebook.react.bridge.ReactApplicationContext
       import com.facebook.react.uimanager.ViewManager

       class HumynCompatPackage : ReactPackage {
           override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
               listOf(HumynCompatModule(reactContext))

           override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
               emptyList()
       }
       ```

    3. Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt` — scaffold:
       ```kotlin
       package ai.humynlabs.capture.compat

       /**
        * HEVC Annex B NAL unit walker. Used by EncoderProbe to detect B-frames.
        * Phase 2 plan 02-12 fills in the slice_segment_header parsing.
        *
        * References (RESEARCH § Code Examples lines 712-762):
        *   - chemag/h265nal (C++ reference)
        *   - figgis/fd509a02d4b1aa89f6ef (HEVC parser gist)
        *   - Eyevinn/mp4ff/hevc (Go ParseSliceHeader)
        */
       class NalParser {
           data class SliceInfo(val nalUnitType: Int, val sliceType: Int)

           fun parse(bytes: ByteArray): List<SliceInfo> {
               // TODO(02-12): walk Annex B start codes, extract nal_unit_type from header byte 1,
               // parse slice_type via Exp-Golomb decode of slice_segment_header.
               // For shell: return empty list so anyBFrames returns false.
               return emptyList()
           }

           /** Detect B-frame: HEVC slice_type == 1 indicates a B-slice. */
           fun anyBFrames(slices: List<SliceInfo>): Boolean = slices.any { it.sliceType == 1 }

           /** TODO(02-12): private fun matchStartCode + readSliceType (~80 LOC) */
       }
       ```

    4. Create `EncoderProbe.kt` — scaffold:
       ```kotlin
       package ai.humynlabs.capture.compat

       import android.content.Context

       /**
        * Behavioral encoder probe (COMPAT-07): writes a 5-second 1080p HEVC clip to
        * cacheDir, parses NAL units to detect B-frames, reads back OIS + HDR-SDR
        * force. Plan 02-12 fills in the Camera2 + MediaCodec wiring.
        *
        * Reference: RESEARCH § Pitfalls 1, 2, 3.
        */
       class EncoderProbe(private val ctx: Context) {
           data class Result(
               val bFramePresent: Boolean,
               val oisOff: Boolean,
               val hdrSdrForced: Boolean,
               val encoderClipPath: String,
           )

           fun run(): Result {
               // TODO(02-12): real implementation.
               throw NotImplementedError("EncoderProbe.run — implemented in plan 02-12")
           }
       }
       ```

    5. Create `ImuProbe.kt` — scaffold:
       ```kotlin
       package ai.humynlabs.capture.compat

       import android.content.Context

       /**
        * IMU sustained-rate probe (COMPAT-02). 30 s window with 1080p preview running.
        * Plan 02-13 fills in the SensorManager + Camera2 preview wiring.
        *
        * Reference: RESEARCH § Code Examples lines 793-824 + § Pitfall 4.
        */
       class ImuProbe(private val ctx: Context) {
           data class Result(
               val sustainedHz: Float,
               val p99IntervalMs: Float,
               val samplesCollected: Int,
           )

           fun run(durationMs: Long, withPreview: Boolean): Result {
               // TODO(02-13): SensorManager.SENSOR_DELAY_FASTEST + maxReportLatency=0,
               // 5 s warm-up skip, dummy SurfaceTexture preview if withPreview, return computed Hz + p99.
               throw NotImplementedError("ImuProbe.run — implemented in plan 02-13")
           }
       }
       ```

    6. Create `DeviceCaps.kt` — scaffold:
       ```kotlin
       package ai.humynlabs.capture.compat

       import android.content.Context

       /**
        * Device-capability enumeration for COMPAT-01/03/07. Plan 02-14 fills in:
        *   - resolutionMax / fpsMax via CamcorderProfile + Camera2 stream config
        *   - ultrawideDfovDeg via shortest-focal-length back camera (RESEARCH § Pitfall 5)
        *   - micSampleRateMax via AudioRecord.getMinBufferSize probe at 48 kHz
        *   - realtimeTimestampSource via SENSOR_INFO_TIMESTAMP_SOURCE
        *   - rooted via RootBeer-equivalent heuristic (RESEARCH § Pitfall 6)
        *   - freeStorageGB via StatFs on Environment.getDataDirectory()
        */
       class DeviceCaps(private val ctx: Context) {
           data class Result(
               val resolutionMax: Pair<Int, Int>,
               val fpsMax: Int,
               val ultrawideDfovDeg: Float,
               val micSampleRateMax: Int,
               val realtimeTimestampSource: Boolean,
               val rooted: Boolean,
               val freeStorageGB: Float,
           )

           fun read(): Result {
               // TODO(02-14): real implementation.
               throw NotImplementedError("DeviceCaps.read — implemented in plan 02-14")
           }
       }
       ```

    7. Edit `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`:
       - Add `import ai.humynlabs.capture.compat.HumynCompatPackage`.
       - In `getPackages()`, after `packages.add(PlayIntegrityPackage())`, add `packages.add(HumynCompatPackage())`.
       - In `onCreate()` (after `SoLoader.init` + `load()`), add the cacheDir sweep:
         ```kotlin
         cacheDir.listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
             ?.forEach { it.delete() }
         ```

    8. Run `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` — should compile clean (helpers throw NotImplementedError but the module + package compile fine).

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt` succeeds.
    - `grep -c "@ReactMethod" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt` returns 3.
    - `grep -q "Executors.newSingleThreadExecutor" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt` succeeds (background worker).
    - `grep -q "HumynCompatPackage" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` succeeds.
    - `grep -q "compat-probe-" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` succeeds (orphan sweep).
    - `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug -q && grep -c "@ReactMethod" app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt | awk '$1 == 3 { exit 0 } { exit 1 }'</automated>
  </verify>
  <done>HumynCompat Kotlin shell + 4 helpers + Package registration + cacheDir sweep all compile; subsequent plans (02-12, 02-13, 02-14) fill in helper bodies.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: HumynCompat.ts JS bridge + unit test</name>
  <files>apps/mobile/src/native/HumynCompat.ts (NEW), apps/mobile/__tests__/native/HumynCompat.test.ts (NEW)</files>
  <read_first>
    - apps/mobile/src/native/PlayIntegrity.ts (full file — analog pattern lines 357-373)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "HumynCompat.ts" lines 349-389
  </read_first>
  <behavior>
    Test 1: When NativeModules.HumynCompat is undefined → calling any of the 3 functions rejects with an error containing "HumynCompat native module not registered".
    Test 2: When NativeModules.HumynCompat is mocked with a spy → `runImuProbe(30000, true)` calls native.runImuProbe(30000, true) once, awaits its promise, returns the resolved value verbatim.
    Test 3: When native.runEncoderProbe rejects → JS function rejects with the same error.
  </behavior>
  <action>
    1. Create `apps/mobile/src/native/HumynCompat.ts`:
       ```ts
       import { NativeModules } from 'react-native';

       export interface EncoderProbeResult {
         bFramePresent: boolean;
         oisOff: boolean;
         hdrSdrForced: boolean;
         encoderClipPath: string;
       }
       export interface ImuProbeResult {
         sustainedHz: number;
         p99IntervalMs: number;
         samplesCollected: number;
       }
       export interface DeviceCapsResult {
         resolutionMax: { w: number; h: number };
         fpsMax: number;
         ultrawideDfovDeg: number;
         micSampleRateMax: number;
         realtimeTimestampSource: boolean;
         rooted: boolean;
         freeStorageGB: number;
       }

       interface HumynCompatNativeModule {
         runEncoderProbe(): Promise<EncoderProbeResult>;
         runImuProbe(durationMs: number, withPreview: boolean): Promise<ImuProbeResult>;
         readDeviceCaps(): Promise<DeviceCapsResult>;
       }

       const native = NativeModules.HumynCompat as HumynCompatNativeModule | undefined;

       function ensure(): HumynCompatNativeModule {
         if (!native) {
           throw new Error(
             'HumynCompat native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
           );
         }
         return native;
       }

       export async function runEncoderProbe(): Promise<EncoderProbeResult> {
         return ensure().runEncoderProbe();
       }
       export async function runImuProbe(durationMs: number, withPreview: boolean): Promise<ImuProbeResult> {
         return ensure().runImuProbe(durationMs, withPreview);
       }
       export async function readDeviceCaps(): Promise<DeviceCapsResult> {
         return ensure().readDeviceCaps();
       }
       ```

    2. Create `apps/mobile/__tests__/native/HumynCompat.test.ts` implementing the three behavior tests above. Use `vi.mock('react-native', ...)` to override `NativeModules.HumynCompat` per test.

  </action>
  <acceptance_criteria>
    - `grep -q "HumynCompat native module not registered" apps/mobile/src/native/HumynCompat.ts` succeeds.
    - `grep -q "runEncoderProbe" apps/mobile/src/native/HumynCompat.ts && grep -q "runImuProbe" apps/mobile/src/native/HumynCompat.ts && grep -q "readDeviceCaps" apps/mobile/src/native/HumynCompat.ts` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/native/HumynCompat.test.ts` passes (3 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/native/HumynCompat.test.ts</automated>
  </verify>
  <done>HumynCompat.ts bridge exists with typed contract; 3 unit tests pass.</done>
</task>

</tasks>

<verification>
- Kotlin module compiles (Gradle assembleApkRolloutDebug).
- Three @ReactMethod functions on background executor.
- HumynCompatPackage registered in MainApplication.
- cacheDir orphan sweep added to MainApplication.onCreate.
- JS bridge unit test green.
</verification>

<success_criteria>

- D-COMPAT-01..04 module shell complete.
- Plans 02-12, 02-13, 02-14 can each focus on one probe's body without re-deriving module wiring.
- COMPAT-01/02/07 prerequisite Kotlin scaffolding in place.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-06-SUMMARY.md` listing the package path layout, the cacheDir sweep behavior, and the per-method error codes (`ENCODER_PROBE_ERROR`, `IMU_PROBE_ERROR`, `DEVICE_CAPS_ERROR`).
</output>
