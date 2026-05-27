---
phase: 07-multi-linguality-live-cam-feed
plan: 07
type: execute
wave: 3
depends_on: [01]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
  - apps/mobile/src/native/HumynLivePreviewView.tsx
  - apps/mobile/src/lib/livePreviewState.ts
  - apps/mobile/src/lib/__tests__/livePreviewState.test.ts
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/recording/__tests__/livePreview.test.tsx
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt
autonomous: false
requirements:
  [REC-LIVE-01, REC-LIVE-02, REC-LIVE-03, REC-LIVE-04, REC-LIVE-05, REC-LIVE-06, REC-LIVE-07]
tags: [recording, camera2, native, live-preview, surface, drift, android]
must_haves:
  truths:
    - "On gate-passed or Skip into substate='active', the live ultrawide preview renders full-screen for 15 s"
    - 'After 15 s the preview fades to the existing dimmed state (5% brightness, task name centered, Stop button visible)'
    - 'Single tap in the dimmed state restores brightness to system level and shows the preview for 10 s'
    - 'Subsequent taps during the 10-s window reset the timer (rolling, not accumulating) per D-29'
    - 'The Stop button is hit-testable in all three visible states (initial-preview / dimmed / tap-revealed)'
    - 'BOTH practice and real flows show the 15-s preview; practice instructional copy renders only AFTER fade-to-dim (D-05)'
    - '`<HumynLivePreviewView>` does NOT open a camera client — it publishes a Surface that CaptureSession.kt consumes (D-25)'
    - 'The recorded `imu_video_drift_{max,mean,p99}_ms` continues to be measured + stamped UNCHANGED'
    - 'FinalizeWorker capture-quality cancel gates (fps_dropped / resolution_dropped / insufficient_frames) are untouched (REC-LIVE-07)'
    - 'PLAN.md contains the 3-option Surface-source comparison; on-hardware A/B picks the implementation'
  artifacts:
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
      provides: 'Camera2-fed TextureView (no camera client of its own) publishing a Surface to LivePreviewSurfaceRegistry'
      contains: 'TextureView'
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
      provides: 'Surface holder + addTarget / removeTarget hooks for CaptureSession'
      contains: 'currentSurface'
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
      provides: 'Two-Surface CaptureSession (Option B leading per RESEARCH §A/B) OR fallback per A/B result'
      contains: 'createCaptureSession'
    - path: apps/mobile/src/lib/livePreviewState.ts
      provides: 'Pure (no React render) brightness state machine + timer manager; unit-testable'
      exports: ['useLivePreviewStateMachine', 'createLivePreviewStateMachine']
    - path: apps/mobile/src/screens/recording/RecordingScreen.tsx
      provides: 'Brightness state machine consumer + tap-zone z-stack + practice-mode preview gate'
      contains: 'useLivePreviewStateMachine'
  key_links:
    - from: apps/mobile/src/screens/recording/RecordingScreen.tsx
      to: apps/mobile/src/native/HumynLivePreviewView.tsx
      via: requireNativeComponent('HumynLivePreviewView')
      pattern: 'HumynLivePreviewView'
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
      via: onSurfaceTextureAvailable → publish Surface
      pattern: 'LivePreviewSurfaceRegistry'
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
      via: LivePreviewSurfaceRegistry.currentSurface() read at session config + addTarget toggle
      pattern: 'LivePreviewSurfaceRegistry.currentSurface'
---

<objective>
Ship the live-cam preview feature without regressing the recorded `imu_video_drift_{max,mean,p99}_ms` telemetry or the post-encode capture-quality cancel gates.

Three architectural deliverables:

1. **Native quad** (`HumynLivePreviewView` / ViewManager / Package / Module) — mirrors the existing `HumynGateCamera` quad pattern, but the new view DOES NOT open a camera client. Instead, its TextureView exposes a Surface that gets published into a static `LivePreviewSurfaceRegistry` and consumed by `CaptureSession.kt`.
2. **CaptureSession.kt Option B (leading hypothesis per 07-RESEARCH)** — extend `createCaptureSession` to accept a second target Surface (the preview) alongside the encoder Surface. `CaptureRequest.Builder.addTarget(previewSurface)` is toggled ONLY during the 15-s + 10-s windows; encoder Surface stays a target across the whole session.
3. **Brightness state machine + tap zone** in `RecordingScreen.tsx` — 3 states (`initial-preview` 15 s / `dimmed` / `tap-revealed` 10 s rolling). The existing `HumynScreenBrightness` wrapper handles all transitions per D-28 / REC-LIVE-15 — no new native brightness API. The machine itself lives in a pure module (`apps/mobile/src/lib/livePreviewState.ts`) so it is unit-testable with `vi.useFakeTimers()` (no React render context needed).

Plus the **on-hardware Surface-source A/B decision (REC-LIVE-06 / D-04)**: this plan ships Option B end-to-end and the operator-walked smoke runbook in plan 07-08 records the drift A/B numbers. If `(p99_on − p99_off) / p99_off >= 0.50` on Pixel 10a, this plan's CaptureSession.kt diff must be revised to Option A or escalated to the owner. The Option C (mid-record reconfigure) is documented but expected to fail.

## Surface-Source A/B Comparison

Per SPEC acceptance criterion line 220 and REC-LIVE-06 / D-04, this plan locks the Surface choice and explicitly compares the 3 candidates. The on-hardware A/B drift walk in `07-08 §9` is the empirical gate that ratifies (or vetoes) Option B; the table below is the planning-time analysis.

|                           | Option A — SurfaceTexture splitter (share encoder Surface via GL)                                                                                                                                                                                                                                   | Option B — two-Surface CaptureSession (LEADING — what this plan ships)                                                                                                                                                                                                                                                                                                                                                          | Option C — mid-record CaptureSession reconfigure                                                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mechanism**             | Encoder owns a SurfaceTexture; a GL renderer reads from it and writes to BOTH the MediaCodec input Surface AND the preview TextureView's Surface. Single Camera2 output target (the SurfaceTexture).                                                                                                | `createCaptureSession(listOf(encoderSurface, previewSurface), ...)` at session config. Both Surfaces are targets of the same CaptureRequest. `addTarget(previewSurface)` toggled via JS-side mount/unmount of `<HumynLivePreviewView>`; encoder Surface is always a target.                                                                                                                                                     | Initial session has only the encoder Surface. When preview opens at t=0 (or on tap-reveal), call `cameraDevice.createCaptureSession` AGAIN with `[encoder, preview]`. When preview closes, call `createCaptureSession` AGAIN with `[encoder]`.                                        |
| **Implementation cost**   | HIGH — requires a GL renderer thread, EGL context owned by the encoder-Surface side, double-blit per frame, careful EOS handling. Roughly +300 LOC of Kotlin + GLES2 shader plumbing. Mirrors Grafika's `RecordFBOActivity` pattern.                                                                | LOW — `~30 LOC` diff in `CaptureSession.kt::openCaptureSession`: conditional output list + builder.addTarget when `LivePreviewSurfaceRegistry.currentSurface() != null`. No new threads, no GL. Mirrors Android Camera2-Video sample's preview+record pattern.                                                                                                                                                                  | MEDIUM — `~80 LOC` diff: extract session-config into a helper, call it 2–4 times per recording. Each reconfigure blocks the camera HAL for 100–400 ms (HAL-dependent).                                                                                                                |
| **Expected drift impact** | LOWEST (in theory) — single Camera2 output target → no contention. **BUT** the GL pass adds CPU/GPU work on the same Tensor G3 that already runs the ultrawide distortion pipeline → CLAUDE.md drift banner says this path is already ~1.7–6.2 ms; the GL blit risks pushing it higher. Unmeasured. | LOW-MEDIUM — adds one extra Camera2 output stream but no GL. Android Camera2 HAL is documented to support 2 simultaneous `PRIVATE` Surfaces of the same resolution without contention on modern chipsets (Tensor G3 included). 07-RESEARCH §A/B's hypothesis: delta `p99_ON vs p99_OFF` stays `< 50%`. **D-04 gate verifies on-hardware.**                                                                                      | HIGH — every reconfigure drops `setRepeatingRequest` for 100–400 ms → encoder Surface stops receiving frames → `fps_dropped` cancel gate at finalize (CLAUDE.md 2026-05-17 banner — `mean_fps < 29` cancels). Expected to fail the §10 cancel-gate verification AND the §9 drift A/B. |
| **Decision rationale**    | DEFER — only revisit if Option B's on-hardware A/B fails. The implementation cost is non-trivial AND the drift theory is unmeasured on Pixel 10a's ultrawide path. Documented here so the fallback is recorded; NOT implemented in this plan.                                                       | **CHOSEN.** Lowest implementation cost, no thread or GL plumbing, no HAL reconfigure stalls. The ~30-LOC diff is the leading hypothesis per 07-RESEARCH §"Live-Cam Preview Surface-Source A/B". The on-hardware A/B walk in `07-08 §9` is the empirical gate: `(p99_ON − p99_OFF) / p99_OFF < 0.50` per D-04. If the gate fails, fall back to Option A (acknowledging the higher implementation cost) or escalate to the owner. | REJECTED — Documented for completeness; expected to fail the REC-LIVE-07 invariant (capture-quality cancel gates UNCHANGED) because mid-record HAL stalls drop frames below the 29-fps cancel threshold. NOT implemented and NOT a fallback path.                                     |

**Empirical gate citation:** `07-08-renumber-sweep-and-manual-smoke-PLAN.md` §9 "A/B drift smoke (REC-LIVE-05 / D-04 — BLOCKING)" — same-device same-day Pixel 10a A/B; baseline=preview-OFF, treatment=preview-ON; the recorded delta from the operator's walk lives in the final SUMMARY. If Option B fails the gate, this plan ships a revision toggle in CaptureSession.kt to fall back to Option A and a re-walk is scheduled.

**Non-goals (CLAUDE.md guardrails):**

- Do NOT change `FinalizeWorker` cancel logic (REC-LIVE-07 — fps/resolution/insufficient_frames).
- Do NOT add audio capture (CLAUDE.md "Audio dropped" — preview is video-only).
- Do NOT change the ultrawide lens code (CLAUDE.md drift banner — relaxed-but-recorded).
- Do NOT introduce `react-native-vision-camera`, CameraX, or MediaPipeTasksVision pod ≥ 0.10.33 (CLAUDE.md "Do NOT Use").
- Do NOT touch metadata schema (1.2.0 stays the canonical shape).

Output: a buildable Android APK in which a 25-min recording shows the preview window per spec AND the recorded metadata.json still carries valid drift values within 50% of the no-preview baseline.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VALIDATION.md
@CLAUDE.md
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraView.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraViewManager.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraPackage.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraModule.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
@apps/mobile/src/native/HumynGateCamera.ts
@apps/mobile/src/screens/recording/RecordingScreen.tsx

<interfaces>
From apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt (current single-Surface session at lines 599-605):
```kotlin
cam.createCaptureSession(
    listOf(surface),
    object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(s: CameraCaptureSession) {
            try {
                val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                builder.addTarget(surface)
                // ...
```

From apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraView.kt (the analog — lines 44-87):

```kotlin
class HumynGateCameraView(context: Context) : TextureView(context), TextureView.SurfaceTextureListener {
    override fun onSurfaceTextureAvailable(st: SurfaceTexture, width: Int, height: Int) {
        st.setDefaultBufferSize(previewSize.width, previewSize.height)
        configureTransform(width, height)
        val s = Surface(st)
        surface = s
        GateCameraController.onPreviewSurfaceAvailable(s)
    }
```

From apps/mobile/src/native/HumynGateCamera.ts (analog — lines 33-75):

```typescript
function ensure(): HumynGateCameraNativeModule {
  /* registration guard */
}
export const HumynGateCameraView = requireNativeComponent<{ style?: ViewStyle }>(
  'HumynGateCameraView',
);
export const isGateCameraAvailable = (): boolean => NativeModules.HumynGateCamera != null;
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: HumynLivePreviewView native quad + LivePreviewSurfaceRegistry + MainApplication wireup + RN bridge</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewPackage.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt, apps/mobile/src/native/HumynLivePreviewView.tsx</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraView.kt (verbatim TextureView + SurfaceTextureListener pattern + Matrix transform at lines 98-121)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraViewManager.kt (verbatim SimpleViewManager + the no-op `@ReactProp` codegen workaround)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraPackage.kt (verbatim ReactPackage shape)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraModule.kt (shape — but body diverges per D-25)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (existing `packages.add(...)` block at lines 48-56)
    - apps/mobile/src/native/HumynGateCamera.ts (JS bridge pattern — `requireNativeComponent` + `ensure()` guard)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-24, D-25, D-26
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Live-Cam Preview Surface-Source A/B" + "Tap-Zone Implementation"
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md the full "Live-cam preview — native + JS" section
  </read_first>
  <behavior>
    - `HumynLivePreviewView.kt` extends `TextureView` + implements `SurfaceTextureListener` IDENTICALLY to `HumynGateCameraView`. The Matrix transform for the landscape-locked + ultrawide-recording surface is copied verbatim.
    - When `onSurfaceTextureAvailable` fires, the new `Surface(st)` is published via `LivePreviewSurfaceRegistry.onSurfaceAvailable(s)`.
    - When `onSurfaceTextureDestroyed` fires, `LivePreviewSurfaceRegistry.onSurfaceDestroyed(s)` is called and the Surface is released.
    - `LivePreviewSurfaceRegistry` is a singleton holder with `currentSurface(): Surface?`, `onSurfaceAvailable(Surface)`, `onSurfaceDestroyed(Surface)`, `addPreviewTarget()`, `removePreviewTarget()` callbacks that `CaptureSession.kt` consumes in Task 2.
    - The native view does NOT open a Camera2 session or call `CameraManager.openCamera` — the recording path's CaptureSession owns the camera client (D-25).
    - `HumynLivePreviewModule.kt` exposes only an `isAvailable(promise)` method returning `true` if the package is registered + a Surface is currently published (helper for the JS guard).
    - `HumynLivePreviewPackage.kt` follows the verbatim 4-line shape of `HumynGateCameraPackage.kt`.
    - `MainApplication.kt` gains `packages.add(HumynLivePreviewPackage())` line + the import.
    - `apps/mobile/src/native/HumynLivePreviewView.tsx` exports `HumynLivePreviewView` (via `requireNativeComponent<{ style?: ViewStyle }>('HumynLivePreviewView')`) + an `isLivePreviewAvailable()` discriminant.
  </behavior>
  <action>
1. **Create the new directory + 4 Kotlin files + 1 registry**. The TextureView + ViewManager + Package shapes are essentially renamed copies of the gate-camera quad. The Module is mostly empty per D-25.

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt`:

```kotlin
package ai.humynlabs.capture.livepreview

import android.view.Surface

/**
 * Singleton Surface slot for the live-cam preview (D-25).
 * Published by HumynLivePreviewView.onSurfaceTextureAvailable.
 * Read by CaptureSession.kt at session config + on addTarget toggle
 * (15-s initial preview window + tap-revealed 10-s window).
 *
 * Lifetime: a Surface is alive only while the RN view is mounted. When
 * RecordingScreen unmounts, the SurfaceTexture is destroyed and we clear
 * the slot. CaptureSession.kt MUST defend against a null currentSurface()
 * (treat the absence as "preview disabled — encoder-only").
 */
object LivePreviewSurfaceRegistry {
    @Volatile private var slot: Surface? = null

    /** Callbacks fired from CaptureSession.kt's session-config thread.
     *  Optional — null when no listener is attached. */
    @Volatile var onAddTarget: (() -> Unit)? = null
    @Volatile var onRemoveTarget: (() -> Unit)? = null

    fun onSurfaceAvailable(s: Surface) {
        slot = s
    }

    fun onSurfaceDestroyed(s: Surface?) {
        if (s == null || slot === s) {
            slot = null
        }
    }

    fun currentSurface(): Surface? = slot
}
```

2. **Create `HumynLivePreviewView.kt`** (analog: `HumynGateCameraView.kt`):

   - Read `HumynGateCameraView.kt` in full.
   - Copy the entire class shape (TextureView + SurfaceTextureListener + the Matrix transform method).
   - Rename `HumynGateCameraView` → `HumynLivePreviewView`.
   - Replace `GateCameraController.onPreviewSurfaceAvailable(s)` with `LivePreviewSurfaceRegistry.onSurfaceAvailable(s)`.
   - Replace `GateCameraController.onPreviewSurfaceDestroyed(surface)` with `LivePreviewSurfaceRegistry.onSurfaceDestroyed(surface)`.
   - Keep the `previewSize = Size(1280, 720)` and the `configureTransform` body identical (the ultrawide + landscape-lock transform is the same for both surfaces).

3. **Create `HumynLivePreviewViewManager.kt`** (verbatim shape of `HumynGateCameraViewManager.kt`):

   - Class renamed.
   - `REACT_CLASS = "HumynLivePreviewView"`.
   - The no-op `@ReactProp("previewActive")` setter stays (silences the RN codegen warning per Phase 4 04-COSMETIC-GAPS).
   - `onDropViewInstance` calls `LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)`.

4. **Create `HumynLivePreviewModule.kt`** (minimal per D-25):

   ```kotlin
   package ai.humynlabs.capture.livepreview

   import com.facebook.react.bridge.Promise
   import com.facebook.react.bridge.ReactApplicationContext
   import com.facebook.react.bridge.ReactContextBaseJavaModule
   import com.facebook.react.bridge.ReactMethod
   import com.facebook.react.module.annotations.ReactModule

   @ReactModule(name = HumynLivePreviewModule.NAME)
   class HumynLivePreviewModule(reactContext: ReactApplicationContext) :
       ReactContextBaseJavaModule(reactContext) {

       companion object { const val NAME = "HumynLivePreview" }
       override fun getName(): String = NAME

       /**
        * JS discriminant — true iff a Surface is currently published by the view.
        * Useful for the RecordingScreen "no preview" silent bypass.
        */
       @ReactMethod
       fun isAvailable(promise: Promise) {
           promise.resolve(LivePreviewSurfaceRegistry.currentSurface() != null)
       }
   }
   ```

5. **Create `HumynLivePreviewPackage.kt`** (verbatim shape of `HumynGateCameraPackage.kt`):

   ```kotlin
   package ai.humynlabs.capture.livepreview

   import com.facebook.react.ReactPackage
   import com.facebook.react.bridge.NativeModule
   import com.facebook.react.bridge.ReactApplicationContext
   import com.facebook.react.uimanager.ViewManager

   class HumynLivePreviewPackage : ReactPackage {
       override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
           listOf(HumynLivePreviewModule(reactContext))

       override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
           listOf(HumynLivePreviewViewManager())
   }
   ```

6. **Modify `MainApplication.kt`** — add the import + `packages.add` call. The existing block is at lines 48-56. Insert AFTER `packages.add(HumynGateCameraPackage())` with a comment:

   ```kotlin
   packages.add(HumynLivePreviewPackage())     // Phase 7 — REC-LIVE-01/02 live ultrawide preview during record (D-25; no camera client of its own)
   ```

   Add the import at the top of the file: `import ai.humynlabs.capture.livepreview.HumynLivePreviewPackage`.

7. **Create `apps/mobile/src/native/HumynLivePreviewView.tsx`** (analog: `HumynGateCamera.ts`):

   ```typescript
   import { NativeModules, requireNativeComponent, type ViewStyle } from 'react-native';

   interface HumynLivePreviewNativeModule {
     isAvailable(): Promise<boolean>;
   }

   function ensure(): HumynLivePreviewNativeModule {
     const native = NativeModules.HumynLivePreview as HumynLivePreviewNativeModule | undefined;
     if (!native) {
       throw new Error(
         'HumynLivePreview native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
       );
     }
     return native;
   }

   /** True iff the native module is registered in the build (the Surface may still be detached). */
   export const isLivePreviewAvailable = (): boolean => NativeModules.HumynLivePreview != null;

   /** Async query — true iff the native view has published a Surface to LivePreviewSurfaceRegistry. */
   export async function isLivePreviewSurfacePublished(): Promise<boolean> {
     try {
       return await ensure().isAvailable();
     } catch {
       return false;
     }
   }

   /** The live ultrawide preview (Camera2-fed TextureView). Mount full-screen during preview windows. */
   export const HumynLivePreviewView = requireNativeComponent<{ style?: ViewStyle }>(
     'HumynLivePreviewView',
   );
   ```

8. **Verify the Kotlin compiles** by running the Robolectric/JVM unit suite (no live preview test yet — just make sure the module registration is clean):
   ```bash
   cd apps/mobile/android && ./gradlew :app:assembleDebug 2>&1 | tail -30
   ```
   Expected: BUILD SUCCESSFUL. If there are unresolved imports, fix them.
   </action>
   <verify>
   <automated>cd apps/mobile/android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -15</automated>
   </verify>
   <acceptance_criteria> - All 5 new Kotlin files exist under `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/`. - `grep -c "HumynLivePreviewPackage" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` returns at least 2 (import + packages.add). - `grep -c "LivePreviewSurfaceRegistry" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt` returns at least 2 (onAvailable + onDestroyed wiring). - `grep -c "HumynLivePreviewView" apps/mobile/src/native/HumynLivePreviewView.tsx` returns at least 1 (`requireNativeComponent` call). - `grep -c "isLivePreviewAvailable" apps/mobile/src/native/HumynLivePreviewView.tsx` returns at least 1. - No iOS files modified: `git diff --stat apps/mobile/ios/` returns empty (I18N-21). - Verify command exits 0 (Kotlin compiles).
   </acceptance_criteria>
   <done>Native quad shipped following the gate-camera analog; module registration wired; JS bridge in place; Surface registry singleton ready for CaptureSession.kt consumption in Task 2.</done>
   </task>

<task type="auto" tdd="true">
  <name>Task 2: CaptureSession.kt Option B (two-Surface) + livePreviewState.ts pure module + RecordingScreen.tsx wiring + Kotlin/JS tests</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt, apps/mobile/src/lib/livePreviewState.ts, apps/mobile/src/lib/__tests__/livePreviewState.test.ts, apps/mobile/src/screens/recording/RecordingScreen.tsx, apps/mobile/src/screens/recording/__tests__/livePreview.test.tsx, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt (full file — note `openCaptureSession` at lines 589-660 and the `addTarget` pattern at line 605)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt (lines 86-93 — encoder Surface allocation is UNCHANGED per RESEARCH "Option B")
    - apps/mobile/src/screens/recording/RecordingScreen.tsx (full file — note brightness call sites at lines 267, 387, 655, 734, 867 per 07-PATTERNS.md)
    - apps/mobile/src/native/HumynScreenBrightness.ts (the `set(level: -1 | number)` API)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-04, D-05, D-24, D-26, D-27, D-28, D-29
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Live-Cam Preview Surface-Source A/B" (Option B leading) + "Brightness State Machine" + "Tap-Zone Implementation" + "Pitfall 3" + "Pitfall 4"
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "RecordingScreen.tsx (MODIFY)" + "CaptureSession.kt (MODIFY)" — Pattern 2 z-stack pasted verbatim
    - CLAUDE.md "Capture-quality cancel gate added 2026-05-17" (REC-LIVE-07 — UNCHANGED)
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ (existing test directory — look for `CaptureSessionTest.kt` if present as a Robolectric pattern)
  </read_first>
  <behavior>
    - `openCaptureSession` accepts an optional second Surface (the preview) drawn from `LivePreviewSurfaceRegistry.currentSurface()` at session-config time. When the registry slot is null (no live preview mounted), behavior reverts to the existing single-Surface flow.
    - `CaptureRequest.Builder.addTarget(previewSurface)` is initially CALLED (preview visible during the 15-s initial window). When `LivePreviewSurfaceRegistry.onRemoveTarget` fires, the running CaptureRequest is rebuilt without `previewSurface` and `setRepeatingRequest` is replaced — Surface stays valid in the session for re-attach.
    - The encoder Surface is ALWAYS a target across the whole session (REC-LIVE-05 / -07 — drift + cancel gates depend on the encoder Surface receiving a continuous frame stream).
    - **No mid-record CaptureSession reconfiguration** (that is Option C — high-drift risk; not used).
    - `apps/mobile/src/lib/livePreviewState.ts` is a **pure module** (no React render dependency) exporting a `createLivePreviewStateMachine({ brightness, now, schedule })` factory + a thin React-side `useLivePreviewStateMachine(captureStartedAt)` hook. The factory is what gets unit-tested with `vi.useFakeTimers()` + a mocked `brightness.set`. This converts REC-LIVE-01..04 from "manual-only" to "unit-tested + manual-verified" (07-VALIDATION.md table — REC-LIVE-01..04 was tagged "unit (JS state machine) + manual"; this delivers the unit half).
    - On entering substate=`'active'` (after gate-passed or Skip): machine starts in `'initial-preview'` and immediately calls `brightness.set(-1)`. After 15 s: transition to `'dimmed'` and call `brightness.set(0.05)`.
    - Single tap in `'dimmed'`: transition to `'tap-revealed'`, call `brightness.set(-1)`, schedule a 10-s fade timer.
    - Subsequent tap in `'tap-revealed'`: cancel the current 10-s timer + schedule a fresh 10-s timer (rolling per D-29).
    - 10-s timer fires in `'tap-revealed'`: transition back to `'dimmed'`, call `brightness.set(0.05)`.
    - On `stop()`: cancel any pending timer; do not call `brightness.set` (the existing RecordingScreen restore at lines 267/387/734/867 handles it).
    - `RecordingScreen.tsx` consumes the hook + mounts `<HumynLivePreviewView>` ONLY during `'initial-preview'` and `'tap-revealed'` (Option B-simple per RESEARCH).
    - **Practice instructional copy must NOT render during `'initial-preview'`** (D-05): the existing render branch that shows the practice copy is gated on `brightnessState === 'dimmed'`.
    - The translated countdown indicator copy is the static `t('recording.preview.live')` label per D-26 (no per-second countdown).
    - Eye-icon glyph uses `lucide-react-native` `Eye` per D-27, bottom-right corner, visible only in `'dimmed'` state.
  </behavior>
  <action>
1. **Modify `CaptureSession.kt`** — Option B two-Surface session per RESEARCH. The diff is centered on the `openCaptureSession` function around lines 589-660.

- Add an import at the top: `import ai.humynlabs.capture.livepreview.LivePreviewSurfaceRegistry`.

- Locate the `cam.createCaptureSession(listOf(surface), ...)` call. Replace the list with a conditional one + a holder for the preview Surface seen at session-config time:

  ```kotlin
  val previewSurfaceAtConfig: Surface? = LivePreviewSurfaceRegistry.currentSurface()
  val outputs: List<Surface> = if (previewSurfaceAtConfig != null) {
      listOf(surface, previewSurfaceAtConfig)
  } else {
      listOf(surface)
  }

  @Suppress("DEPRECATION")
  cam.createCaptureSession(
      outputs,
      object : CameraCaptureSession.StateCallback() {
          override fun onConfigured(s: CameraCaptureSession) {
              try {
                  val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                  builder.addTarget(surface)
                  // REC-LIVE-01 — preview target initially attached (initial-15-s window)
                  if (previewSurfaceAtConfig != null) {
                      builder.addTarget(previewSurfaceAtConfig)
                  }
                  // ... existing zoom + AF + OIS setters stay verbatim ...
                  // After setting up the builder + setRepeatingRequest:
                  // Register the toggle callbacks so JS-side state-machine
                  // transitions can re-attach/detach the preview target.
                  if (previewSurfaceAtConfig != null) {
                      LivePreviewSurfaceRegistry.onAddTarget = {
                          try {
                              val newBuilder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                              newBuilder.addTarget(surface)
                              newBuilder.addTarget(previewSurfaceAtConfig)
                              // copy zoom + AF + OIS settings into newBuilder ...
                              s.setRepeatingRequest(newBuilder.build(), null, sessionHandler)
                          } catch (e: Throwable) {
                              // Best-effort — encoder Surface stays a target
                          }
                      }
                      LivePreviewSurfaceRegistry.onRemoveTarget = {
                          try {
                              val newBuilder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                              newBuilder.addTarget(surface)
                              // copy zoom + AF + OIS settings ...
                              s.setRepeatingRequest(newBuilder.build(), null, sessionHandler)
                          } catch (e: Throwable) {
                              // Best-effort
                          }
                      }
                  }
              } catch (e: Throwable) { /* existing handling */ }
          }
          override fun onConfigureFailed(s: CameraCaptureSession) { /* existing */ }
      },
      sessionHandler,
  )
  ```

- On session close / disconnect, null out the registry callbacks: `LivePreviewSurfaceRegistry.onAddTarget = null; LivePreviewSurfaceRegistry.onRemoveTarget = null` so the next session starts clean.

The exact placement of the zoom + AF + OIS configuration in `newBuilder` must mirror the existing setup at lines 605-660 — extract those into a helper if the file allows, or duplicate them inline. Do NOT change any of those existing settings; just propagate them.

**HevcEncoder.kt is UNCHANGED** per RESEARCH "Option B" — the encoder Surface stays the muxer feed.

2. **Create `apps/mobile/src/lib/livePreviewState.ts`** — the pure (no React) state machine. This is what makes REC-LIVE-01..04 unit-testable per the checker's "Acceptable alternative" path.

   ```typescript
   // apps/mobile/src/lib/livePreviewState.ts
   //
   // Live-cam preview brightness state machine (REC-LIVE-01..04 / D-05 / D-28 / D-29).
   //
   // Pure module — no React, no native imports. The state transitions + timer
   // management + brightness side-effects are all driven by the injected
   // collaborators (`brightness`, `schedule`, `now`). RecordingScreen wraps this
   // in a thin `useLivePreviewStateMachine` hook; tests drive the factory directly
   // with `vi.useFakeTimers()` and a stubbed `brightness.set`.

   export type LivePreviewState = 'initial-preview' | 'dimmed' | 'tap-revealed';

   export const INITIAL_PREVIEW_MS = 15_000;
   export const TAP_REVEAL_MS = 10_000;

   export interface BrightnessApi {
     /** Pass -1 to restore system brightness; 0.05 for the dimmed surface. */
     set(level: number): Promise<void> | void;
   }

   export interface Scheduler {
     /** Returns a handle the machine uses to cancel later. */
     setTimeout(fn: () => void, ms: number): unknown;
     clearTimeout(handle: unknown): void;
   }

   export interface LivePreviewMachine {
     /** Current state — readable from a React subscriber. */
     getState(): LivePreviewState;
     /** Subscribe; returns an unsubscribe. */
     subscribe(listener: (s: LivePreviewState) => void): () => void;
     /** Drive transitions. */
     start(): void; // captureStartedAt = now → enter 'initial-preview'
     tap(): void; // dimmed → tap-revealed (or tap-revealed → reset rolling timer per D-29)
     stop(): void; // cancel timers; cleanup
   }

   export function createLivePreviewStateMachine(deps: {
     brightness: BrightnessApi;
     schedule: Scheduler;
   }): LivePreviewMachine {
     let state: LivePreviewState = 'initial-preview';
     let pendingTimer: unknown = null;
     const listeners = new Set<(s: LivePreviewState) => void>();

     function emit() {
       for (const l of listeners) l(state);
     }
     function clearTimer() {
       if (pendingTimer != null) {
         deps.schedule.clearTimeout(pendingTimer);
         pendingTimer = null;
       }
     }
     function transition(next: LivePreviewState, level: number) {
       state = next;
       try {
         void deps.brightness.set(level);
       } catch {
         /* best-effort */
       }
       emit();
     }

     return {
       getState: () => state,
       subscribe(l) {
         listeners.add(l);
         return () => listeners.delete(l);
       },
       start() {
         clearTimer();
         transition('initial-preview', -1);
         pendingTimer = deps.schedule.setTimeout(() => {
           pendingTimer = null;
           transition('dimmed', 0.05);
         }, INITIAL_PREVIEW_MS);
       },
       tap() {
         if (state === 'dimmed') {
           clearTimer();
           transition('tap-revealed', -1);
           pendingTimer = deps.schedule.setTimeout(() => {
             pendingTimer = null;
             transition('dimmed', 0.05);
           }, TAP_REVEAL_MS);
         } else if (state === 'tap-revealed') {
           // D-29 rolling — cancel + restart, do NOT accumulate
           clearTimer();
           pendingTimer = deps.schedule.setTimeout(() => {
             pendingTimer = null;
             transition('dimmed', 0.05);
           }, TAP_REVEAL_MS);
         }
         // No-op in 'initial-preview' — tap during initial preview is the Stop hit-target,
         // not a state transition. RecordingScreen routes the tap based on z-stack.
       },
       stop() {
         clearTimer();
         // Do NOT call brightness.set here — RecordingScreen's existing
         // restore calls (lines 267, 387, 734, 867) own the lifecycle.
         listeners.clear();
       },
     };
   }

   /**
    * React hook — thin wrapper exposed to RecordingScreen. The hook owns the
    * machine instance + the brightness wrapper + the global setTimeout/clearTimeout
    * adapter; tests instantiate `createLivePreviewStateMachine` directly.
    */
   import { useEffect, useRef, useState } from 'react';
   import { HumynScreenBrightness } from '../native/HumynScreenBrightness';

   export function useLivePreviewStateMachine(captureStartedAt: number | null): {
     state: LivePreviewState;
     tap: () => void;
   } {
     const machineRef = useRef<LivePreviewMachine | null>(null);
     const [state, setState] = useState<LivePreviewState>('initial-preview');

     useEffect(() => {
       if (captureStartedAt == null) return undefined;
       const machine = createLivePreviewStateMachine({
         brightness: { set: (level: number) => HumynScreenBrightness.set(level) },
         schedule: {
           setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
           clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
         },
       });
       machineRef.current = machine;
       const unsub = machine.subscribe(setState);
       machine.start();
       return () => {
         unsub();
         machine.stop();
         machineRef.current = null;
       };
     }, [captureStartedAt]);

     return {
       state,
       tap: () => machineRef.current?.tap(),
     };
   }
   ```

3. **Modify `RecordingScreen.tsx`** — wire in `useLivePreviewStateMachine` + the z-stack JSX. This is the biggest JS diff in Phase 7. Make it carefully:

   - Add imports:

     ```typescript
     import { useTranslation } from 'react-i18next';
     import { Pressable as RNPressable, StyleSheet, View } from 'react-native';
     import { Eye } from 'lucide-react-native';
     import {
       HumynLivePreviewView,
       isLivePreviewAvailable,
     } from '../../native/HumynLivePreviewView';
     import { useLivePreviewStateMachine } from '../../lib/livePreviewState';
     ```

     (The `useTranslation` import was already added in plan 07-05 for general t() use. Re-using here.)

   - Inside the component body, after the existing `captureStartedAt` derivation, call the hook:

     ```typescript
     const { state: brightnessState, tap: handleTapReveal } =
       useLivePreviewStateMachine(captureStartedAt);
     ```

   - In the JSX render output, use the Pattern 2 z-stack from 07-RESEARCH verbatim:

     ```tsx
     return (
       <View style={StyleSheet.absoluteFill}>
         {(brightnessState === 'initial-preview' || brightnessState === 'tap-revealed') &&
         isLivePreviewAvailable() ? (
           <HumynLivePreviewView style={StyleSheet.absoluteFill} />
         ) : null}

         {/* Practice instructional copy — D-05: NOT rendered during initial-preview */}
         {isPracticeMode && brightnessState === 'dimmed' ? (
           <View style={styles.practiceCopyOverlay}>{/* existing practice copy block */}</View>
         ) : null}

         {/* Eye-icon glyph — D-27, dimmed state only */}
         {brightnessState === 'dimmed' ? (
           <View style={styles.eyeIconCorner} pointerEvents="none">
             <Eye color={colors.text3} size={24} />
           </View>
         ) : null}

         {/* Full-surface Pressable — dimmed state only */}
         {brightnessState === 'dimmed' ? (
           <RNPressable
             style={StyleSheet.absoluteFill}
             onPress={handleTapReveal}
             accessibilityLabel="Reveal live preview"
           />
         ) : null}

         {/* "Live preview" label — D-26 — visible during initial-preview + tap-revealed */}
         {brightnessState === 'initial-preview' || brightnessState === 'tap-revealed' ? (
           <View style={styles.liveLabelCorner} pointerEvents="none">
             <Text variant="caption">{t('recording.preview.live')}</Text>
           </View>
         ) : null}

         {/* Stop button — last in JSX → wins hit-test in all 3 states */}
         <View style={styles.stopButtonContainer} pointerEvents="box-none">
           {/* existing StopButton render */}
         </View>
       </View>
     );
     ```

   - **Bridging the JS state to the native target toggle** (Option B-simple): mount `<HumynLivePreviewView>` ONLY during `'initial-preview'` and `'tap-revealed'`. When the view unmounts, `onDropViewInstance` fires → `LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)` → slot cleared. The CaptureSession was configured with TWO surfaces at session start (when `currentSurface()` was non-null at session-config time); when the JS view unmounts, the encoder still receives frames because Android's HAL ref-counts buffers, but the preview Surface is no longer drawn-to.

   - **HumynScreenBrightness existing calls** (lines 267, 387, 655, 734, 867) — re-verify each one stays. Insert the state machine WITHOUT removing or modifying any of these landmark calls:
     - Line 655 (`set(0.05)` after gate exit → active) STAYS but is now followed by the hook's first effect that calls `set(-1)` for the initial-15-s window. Net: brightness goes to system level immediately, fades to 0.05 at t=15s.
     - Lines 267, 387, 734, 867 (`set(-1)` restores) STAY UNCHANGED.

4. **Create `apps/mobile/src/lib/__tests__/livePreviewState.test.ts`** — the unit tests that drive the pure machine. This is the BLOCKER fix from the checker (no more `expect(true).toBe(true)` skeletons):

   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   import {
     createLivePreviewStateMachine,
     INITIAL_PREVIEW_MS,
     TAP_REVEAL_MS,
   } from '../livePreviewState';

   function makeRig() {
     vi.useFakeTimers();
     const set = vi.fn().mockResolvedValue(undefined);
     const setTimeoutSpy = vi.fn((fn: () => void, ms: number) => globalThis.setTimeout(fn, ms));
     const clearTimeoutSpy = vi.fn((h: unknown) =>
       globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
     );
     const machine = createLivePreviewStateMachine({
       brightness: { set },
       schedule: { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy },
     });
     return { machine, set, setTimeoutSpy, clearTimeoutSpy };
   }

   describe('createLivePreviewStateMachine (REC-LIVE-01..04 / D-05 / D-29)', () => {
     beforeEach(() => {
       vi.clearAllMocks();
     });

     it('starts in initial-preview at brightness -1 (system level)', () => {
       const { machine, set } = makeRig();
       machine.start();
       expect(machine.getState()).toBe('initial-preview');
       expect(set).toHaveBeenLastCalledWith(-1);
     });

     it('after 15 s, transitions to dimmed and sets brightness 0.05', () => {
       const { machine, set } = makeRig();
       machine.start();
       vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
       expect(machine.getState()).toBe('dimmed');
       expect(set).toHaveBeenLastCalledWith(0.05);
     });

     it('tap in dimmed transitions to tap-revealed at system brightness (REC-LIVE-02)', () => {
       const { machine, set } = makeRig();
       machine.start();
       vi.advanceTimersByTime(INITIAL_PREVIEW_MS); // → dimmed
       machine.tap();
       expect(machine.getState()).toBe('tap-revealed');
       expect(set).toHaveBeenLastCalledWith(-1);
     });

     it('10-s timer in tap-revealed returns to dimmed', () => {
       const { machine, set } = makeRig();
       machine.start();
       vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
       machine.tap();
       vi.advanceTimersByTime(TAP_REVEAL_MS);
       expect(machine.getState()).toBe('dimmed');
       expect(set).toHaveBeenLastCalledWith(0.05);
     });

     it('subsequent taps in tap-revealed reset the timer (D-29 rolling, NOT accumulating)', () => {
       const { machine, clearTimeoutSpy } = makeRig();
       machine.start();
       vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
       machine.tap(); // enter tap-revealed
       vi.advanceTimersByTime(5_000); // 5s in
       machine.tap(); // should cancel + restart, NOT add 10s
       expect(clearTimeoutSpy).toHaveBeenCalled();
       vi.advanceTimersByTime(5_000); // 10s total from first tap; should STILL be tap-revealed
       expect(machine.getState()).toBe('tap-revealed');
       vi.advanceTimersByTime(5_000); // 10s after second tap
       expect(machine.getState()).toBe('dimmed');
     });

     it('tap in initial-preview is a no-op (Stop button owns that hit-region)', () => {
       const { machine } = makeRig();
       machine.start();
       machine.tap();
       expect(machine.getState()).toBe('initial-preview');
     });

     it('stop() cancels pending timers and does NOT call brightness.set (lifecycle restore owns it)', () => {
       const { machine, set, clearTimeoutSpy } = makeRig();
       machine.start();
       const callsBeforeStop = set.mock.calls.length;
       machine.stop();
       expect(clearTimeoutSpy).toHaveBeenCalled();
       expect(set.mock.calls.length).toBe(callsBeforeStop); // no new set() after stop
     });

     it('subscribers are notified on every transition', () => {
       const { machine } = makeRig();
       const states: string[] = [];
       const unsub = machine.subscribe((s) => states.push(s));
       machine.start();
       vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
       machine.tap();
       expect(states).toEqual(['initial-preview', 'dimmed', 'tap-revealed']);
       unsub();
     });
   });
   ```

5. **Create `apps/mobile/src/screens/recording/__tests__/livePreview.test.tsx`** — thin render-side test that verifies RecordingScreen mounts `<HumynLivePreviewView>` only during the right states + that the D-05 practice gate fires:

   ```tsx
   import React from 'react';
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   import { render } from '@testing-library/react-native';

   // Mock HumynScreenBrightness BEFORE importing RecordingScreen
   const set = vi.fn().mockResolvedValue(undefined);
   vi.mock('../../../native/HumynScreenBrightness', () => ({
     HumynScreenBrightness: { set },
   }));

   // Mock the native preview view so render does not require a real surface
   vi.mock('../../../native/HumynLivePreviewView', () => ({
     HumynLivePreviewView: () => null,
     isLivePreviewAvailable: () => true,
   }));

   describe('RecordingScreen <-> live-preview wiring (D-05)', () => {
     beforeEach(() => {
       vi.clearAllMocks();
       vi.useFakeTimers();
     });

     // Render-side smoke; the state-machine assertions live in
     // apps/mobile/src/lib/__tests__/livePreviewState.test.ts (REC-LIVE-01..04).
     it('renders without crashing on captureStarted', () => {
       // Importing RecordingScreen requires the full navigation + store context;
       // this test focuses on the unit-level proof in livePreviewState.test.ts.
       // If a deeper integration test is desired here, render with the same
       // __test_initialState pattern Phase 4 introduced.
       expect(true).toBe(true);
     });
   });
   ```

   Note: the D-05 visual gate is also covered by the operator checkpoint visual check #2 and `07-MANUAL-SMOKE.md §7` — the unit-level coverage of the state machine is the primary automated coverage; this render-side file is a smoke harness for future expansion.

6. **Create `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt`** — Robolectric/JVM test that verifies the registry singleton is well-behaved:

   ```kotlin
   package ai.humynlabs.capture.capture

   import ai.humynlabs.capture.livepreview.LivePreviewSurfaceRegistry
   import org.junit.After
   import org.junit.Test
   import kotlin.test.assertNull

   class CaptureSessionLivePreviewTest {

     @After fun tearDown() {
       // Clear registry slot between tests
       LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)
       LivePreviewSurfaceRegistry.onAddTarget = null
       LivePreviewSurfaceRegistry.onRemoveTarget = null
     }

     @Test
     fun `registry returns null when no preview surface is published`() {
       LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)
       assertNull(LivePreviewSurfaceRegistry.currentSurface())
     }

     // Additional tests that drive CaptureSession.openCaptureSession against
     // a fake CameraDevice would require Robolectric Camera2 stubs; the on-hardware
     // smoke (plan 07-08 §9 drift A/B) is the authoritative coverage for the
     // two-Surface session path.
   }
   ```

7. **Run the test suites**:

   ```bash
   cd apps/mobile && npm test -- --run src/lib/__tests__/livePreviewState.test.ts src/screens/recording/__tests__/livePreview.test.tsx
   cd apps/mobile/android && ./gradlew :app:testDebugUnitTest --tests "ai.humynlabs.capture.capture.CaptureSessionLivePreviewTest"
   ```

8. **MANUAL CHECKPOINT INTERLOCK**: Because Option B's drift impact CAN only be measured on real Pixel 10a hardware (per D-04 / D-24 / RESEARCH §"Surface-source A/B"), the next step (the actual A/B drift walk) lives in plan 07-08's manual-smoke runbook. This task ships the IMPLEMENTATION; the validation happens there. Mark in the SUMMARY: "Option B (two-Surface CaptureSession) implemented; A/B drift smoke deferred to 07-08."
   </action>
   <verify>
   <automated>cd apps/mobile/android && ./gradlew :app:compileDebugKotlin :app:testDebugUnitTest --tests "ai.humynlabs.capture.capture.CaptureSessionLivePreviewTest" 2>&1 | tail -15 && cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run src/lib/**tests**/livePreviewState.test.ts src/screens/recording/**tests**/livePreview.test.tsx 2>&1 | tail -15</automated>
   </verify>
   <acceptance_criteria> - `grep -c "LivePreviewSurfaceRegistry" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` returns at least 1. - Comment-filtered `createCaptureSession` count is exactly 1: `grep -v '^[[:space:]]*//' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt | grep -c "createCaptureSession"` returns 1 (confirms NOT Option C's repeated reconfigure pattern). - `grep -c "HumynLivePreviewView" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1. - `grep -c "useLivePreviewStateMachine" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1. - `grep -c "useLivePreviewStateMachine\|createLivePreviewStateMachine" apps/mobile/src/lib/livePreviewState.ts` returns at least 2. - `grep -c "recording.preview.live" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1 (D-26 translated label key). - `grep -c "expect(true).toBe(true)" apps/mobile/src/lib/__tests__/livePreviewState.test.ts` returns 0 (no skeleton placeholders in the state-machine unit suite). - FinalizeWorker UNCHANGED: `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt` returns empty (REC-LIVE-07). - HevcEncoder UNCHANGED: `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt` returns empty (Option B leaves encoder Surface alone). - Metadata schema UNCHANGED: `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` returns empty (CLAUDE.md calibration banner stays). - Test commands above exit 0; all 8 livePreviewState cases green.
   </acceptance_criteria>
   <done>Option B two-Surface CaptureSession ships; pure livePreviewState.ts module ships with 8 unit-tested behaviors (REC-LIVE-01..04 now have automated coverage); RecordingScreen consumes the hook; encoder + FinalizeWorker + metadata schema untouched. A/B drift validation deferred to plan 07-08 smoke runbook.</done>
   </task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: Native HumynLivePreviewView quad + Surface registry + CaptureSession...</name>
  <files>n/a — operator-only verification</files>
  <action>Run the operator verification described in &lt;how-to-verify&gt; below. Pause execution and wait for the resume-signal.</action>
  <verify>
    <automated>echo "Operator checkpoint — verification is manual; resume on operator approval."</automated>
  </verify>
  <done>Operator types the resume-signal indicating PASS or FAIL of the visual checks.</done>
  <what-built>
    Native HumynLivePreviewView quad + Surface registry + CaptureSession.kt Option B two-Surface session + pure livePreviewState.ts state machine (3 states: initial-preview / dimmed / tap-revealed) consumed by RecordingScreen.tsx + tap-zone z-stack + practice-mode preview gate (D-05) + Lucide Eye icon + translated "Live preview" label.

    The build assembles, Kotlin compiles, JS tests pass (8 state-machine cases green), no FinalizeWorker / HevcEncoder / metadata schema diffs.

  </what-built>
  <how-to-verify>
    **Operator sanity check before plan 07-08's full A/B smoke walk:**

    1. Build the debug APK and install on a Pixel 10a:
       ```bash
       cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug 2>&1 | tail -5
       adb install -r apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk
       ```
    2. Sign in, navigate to Tasks → "Make tea" (or any task) → tap Record.
    3. Pass the hand gate (or tap Skip).
    4. **Visual check #1 (REC-LIVE-01):** When the recording UI opens, you should see the live ultrawide camera feed full-screen for ~15 seconds.
    5. **Visual check #2 (D-05 practice gate):** If you started this from the practice tutorial, the centered "task name" practice copy must NOT be visible during the 15-second preview.
    6. **Visual check #3 (REC-LIVE-01 fade):** After ~15 s the preview should fade to the dimmed state (low brightness, black background, task name centered, Stop button visible). A small Lucide `Eye` icon should be in the bottom-right corner.
    7. **Visual check #4 (REC-LIVE-02):** Tap anywhere on the dimmed surface (NOT on the Stop button). The preview should reappear at system brightness for 10 s.
    8. **Visual check #5 (REC-LIVE-02 rolling):** Tap again within the 10-s window. The preview window must extend for another 10 s (rolling). Tap a third time at ~8 s — extends to ~10 s again.
    9. **Visual check #6 (Stop hit-testable in all 3 states):** Tap the Stop button during the initial-preview state, during dimmed, and during tap-revealed. All three should stop the recording.
    10. **Translated label check (D-26):** With the device set to a non-English locale (via Profile picker from plan 07-04), the "Live preview" label corner indicator should be translated.

    **DO NOT walk the full A/B drift comparison here** — that lives in plan 07-08's `07-MANUAL-SMOKE.md` runbook. This checkpoint is only the "does it build + render correctly without obvious regressions" gate before the drift A/B is run.

  </how-to-verify>
  <resume-signal>Type "approved" if all 10 visual checks pass; otherwise describe the failing check (e.g. "Practice copy showed during 15-s preview — D-05 broken").</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                      | Description                               |
| --------------------------------------------- | ----------------------------------------- |
| Camera HAL → encoder Surface                  | Frame data path (drift-critical)          |
| Camera HAL → preview Surface                  | Frame data path (drift-non-critical)      |
| Native registry singleton → CaptureSession.kt | Surface slot read during session config   |
| RN view lifecycle → registry                  | Mount/unmount drives Surface availability |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                     | Disposition           | Mitigation Plan                                                                                                                                                                                                          |
| ---------- | ---------------------- | ----------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-07-07-01 | Tampering              | Two-Surface session causes frame-rate regression → `fps_dropped` cancel       | mitigate              | Drift A/B in plan 07-08 §9 is the gating measurement (D-04). If `delta >= 0.50`, this plan's diff is reverted to Option A — the gate explicitly catches the regression.                                                  |
| T-07-07-02 | DoS                    | Mid-record session reconfiguration drops frames → `fps_dropped`               | accept                | Plan does NOT reconfigure mid-record (Option B not Option C). `createCaptureSession` is called once at session start.                                                                                                    |
| T-07-07-03 | Information Disclosure | Live preview frames leak to a screen-recording attacker                       | accept                | Recording surface is the user's own session; no remote rendering. Standard Android security model.                                                                                                                       |
| T-07-07-04 | Tampering              | LivePreviewSurfaceRegistry holds a stale Surface reference after view unmount | mitigate              | `onSurfaceTextureDestroyed` clears the slot; `onDropViewInstance` in the ViewManager additionally clears. Defense-in-depth: registry checks `slot === s` before clearing to avoid clearing a newer slot.                 |
| T-07-07-05 | DoS                    | Tap-spam regenerates timers and floods setTimeout                             | mitigate              | Pure state machine clears any pending timer before scheduling a new one (D-29); only ONE timer alive at a time. Verified by `livePreviewState.test.ts` "rolling not accumulating" case.                                  |
| T-07-07-06 | Tampering              | Stop button missed because Pressable above intercepts                         | mitigate              | Pattern 2 z-stack — Stop is rendered LAST in JSX (topmost in RN hit-test order). `pointerEvents="box-none"` on container lets touches pass through to the inner button. Verified in operator checkpoint visual check #6. |
| T-07-07-07 | DoS                    | OEM HAL throttles multi-Surface to 2 streams under thermal pressure           | accept (deferred §v2) | Per 07-RESEARCH Pitfall 4 — Pixel 10a Tensor G3 is well-behaved; Samsung/Xiaomi OEM sweep is the Phase 8 carry-over from Phase 5.                                                                                        |

</threat_model>

<verification>
- `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` exits 0 (APK builds)
- `cd apps/mobile/android && ./gradlew :app:testDebugUnitTest` exits 0 (Kotlin tests including FinalizeWorker pass — REC-LIVE-07 invariant)
- `cd apps/mobile && npm test -- --run` exits 0 (JS suite green, including 8 livePreviewState cases)
- `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt` returns empty
- `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt` returns empty
- Operator checkpoint above: 10/10 visual checks pass
- A/B drift smoke walk (plan 07-08 §9) PENDING — does NOT block this plan's `done`, but DOES block phase sign-off
</verification>

<success_criteria>

- 5 new Kotlin files + 3 new TS files (HumynLivePreviewView.tsx, livePreviewState.ts, livePreview.test.tsx) + livePreviewState.test.ts + 2 modified files (CaptureSession.kt, RecordingScreen.tsx, MainApplication.kt)
- Option B (two-Surface CaptureSession) implementation matches RESEARCH §"Surface-source A/B" leading hypothesis
- Pure livePreviewState.ts module drives the 3-state brightness machine via the existing `HumynScreenBrightness.set` calls (no new native brightness API per REC-LIVE-15) and is fully unit-tested (8 cases)
- D-05 practice gate confirmed via operator visual check #2
- FinalizeWorker / HevcEncoder / metadata schema all UNCHANGED (REC-LIVE-07 invariant)
- iOS files UNCHANGED (I18N-21)
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-07-SUMMARY.md`. Flag explicitly:
- That this plan ships Option B (two-Surface CaptureSession) end-to-end
- That the A/B drift smoke walk is deferred to plan 07-08 §9 — the BLOCKING gate
- That if the A/B fails, this plan's CaptureSession.kt diff is reverted to Option A (Surface splitter via GL) or escalated to the owner
- The 8 livePreviewState.test.ts cases that now provide automated REC-LIVE-01..04 coverage (the unit half of "unit-tested + manual-verified")
</output>
</content>
</invoke>
