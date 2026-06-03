---
phase: 07-multi-linguality-live-cam-feed
plan: 10
type: execute
wave: 1
depends_on: [07]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
  - apps/mobile/src/native/HumynLivePreviewView.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - .planning/debug/07-live-preview-broken-pipe.md
  - .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
autonomous: false
gap_closure: true
requirements:
  [REC-LIVE-01, REC-LIVE-02, REC-LIVE-03, REC-LIVE-04, REC-LIVE-05, REC-LIVE-06, REC-LIVE-07]
tags:
  [recording, camera2, native, live-preview, surface, drift, android, gap-closure, blocking, debug]
must_haves:
  truths:
    - 'On gate-passed or Skip into active substate, the live ultrawide preview Surface actually renders camera frames (G-11 closed)'
    - 'Logcat during the 15-s preview window contains explicit `HumynLivePreview` / `LivePreviewSurfaceRegistry` / `CaptureSession` lifecycle log lines proving the second Surface was registered with the CaptureRequest and remained alive (no `Broken pipe(-32)` from `Camera3-PreviewFrameSpacer`)'
    - 'Fade-to-dim brightness transition is visually observable after the 15-s window (G-12 closed; downstream of G-11)'
    - 'Tap-reveal in the dimmed state visibly restores frame rendering at system brightness (was PARTIAL in §8 row 1 due to G-11; now full PASS)'
    - 'The §9 A/B drift smoke walk runs cleanly: `p99_OFF` baseline ≈ Pixel-10a historical baseline (~3.5–6.0 ms); `p99_ON` measured with the preview ACTUALLY engaged; computed `delta = (p99_ON − p99_OFF) / p99_OFF < 0.50` per D-04'
    - 'FinalizeWorker capture-quality cancel gates (fps_dropped / resolution_dropped / insufficient_frames) remain untouched (REC-LIVE-07 — CLAUDE.md 2026-05-17 banner)'
    - 'Encoder Surface and HevcEncoder.kt UNCHANGED — drift-impacting code stays the same'
    - 'Ultrawide lens code (`CONTROL_ZOOM_RATIO` ultrawide selection) UNCHANGED — drift relaxation banner intact'
    - "Conditional contingent revert is documented: if §9 produces `delta >= 0.50`, this plan's last task flips CaptureSession.kt back to Option A (Surface splitter via GL) and re-walks §9; the revert is part of the same gap-closure plan"
  artifacts:
    - path: .planning/debug/07-live-preview-broken-pipe.md
      provides: 'Debug-session journal documenting root cause + logcat evidence + the surgical fix applied (Pattern: handgate-never-passes)'
      contains: 'root cause'
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
      provides: 'TextureView with INSTRUMENTED Surface lifecycle logs (Log.i tags `HumynLivePreviewView` covering onSurfaceTextureAvailable / onSurfaceTextureDestroyed / onSurfaceTextureSizeChanged) AND the surgical fix that closes G-11'
      contains: 'Log.i'
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
      provides: 'Surface holder with INSTRUMENTED Log.i tags `LivePreviewSurfaceRegistry` on onSurfaceAvailable / onSurfaceDestroyed / onAddTarget / onRemoveTarget'
      contains: 'Log.i'
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
      provides: 'Surgical fix to Option-B two-Surface path that closes G-11 OR (conditional) Option-A Surface splitter via GL if §9 A/B fails delta gate'
      contains: 'LivePreviewSurfaceRegistry'
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
      provides: 'Re-walked §7 + §8 + §9 sections with PASS evidence after closure (operator updates the runbook in the terminal acceptance step)'
      contains: 'Re-walked 2026'
  key_links:
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
      via: 'onSurfaceTextureAvailable -> LivePreviewSurfaceRegistry.onSurfaceAvailable(Surface)'
      pattern: 'LivePreviewSurfaceRegistry.onSurfaceAvailable'
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
      via: 'LivePreviewSurfaceRegistry.currentSurface() read at session config + onAddTarget/onRemoveTarget callback wiring'
      pattern: 'LivePreviewSurfaceRegistry.currentSurface'
    - from: apps/mobile/src/screens/recording/RecordingScreen.tsx
      to: apps/mobile/src/native/HumynLivePreviewView.tsx
      via: '<HumynLivePreviewView style={StyleSheet.absoluteFill} /> mount lifecycle'
      pattern: 'HumynLivePreviewView'
---

<objective>
Close the BLOCKING §7 + §9 failures from `07-HUMAN-UAT.md`: G-11 (`<HumynLivePreviewView>` Surface never renders camera frames; logcat shows `Camera3-PreviewFrameSpacer queueBufferToClientLocked: Failed to queue buffer to client: Broken pipe(-32)` and zero `HumynLivePreview` / `LivePreviewSurfaceRegistry` / `CaptureSession` activity) and G-12 (fade-to-dim transition not observable — downstream of G-11).

This is a **debug-then-fix** plan, modelled on the `.planning/debug/handgate-never-passes.md` session that closed an analogous Camera2 lifecycle bug in Phase 4. The first task is instrumentation + root-cause isolation; the second task is the surgical fix; the third task is the operator-walked §9 A/B drift gate that ratifies (or vetoes) Plan 07-07's Option-B CaptureSession.kt diff per D-04.

**Three architectural possibilities for the G-11 root cause** (from `07-HUMAN-UAT.md` G-11 evidence):

1. The native `HumynLivePreviewView` TextureView IS mounted, IS firing `onSurfaceTextureAvailable`, and IS calling `LivePreviewSurfaceRegistry.onSurfaceAvailable(s)` — but `CaptureSession.openCaptureSession` happened BEFORE the Surface arrived, so `previewSurfaceAtConfig` was null and the Option-B branch never fired. The session is single-Surface for the whole recording. (Race condition on mount order.)
2. The TextureView mounts but `onSurfaceTextureAvailable` never fires because the RN view is hidden under a sibling absolute-positioned View, or the TextureView's `surfaceTextureListener` was never installed. (JS-side z-stack / mount problem.)
3. The Surface IS registered as a CaptureRequest target, but the consumer side (the TextureView's SurfaceTexture) is destroyed shortly after by some other lifecycle event (e.g. `RecordingScreen.tsx` unmount/remount, brightness state machine re-rendering the JSX tree, hand-gate-cleanup releasing the wrong Surface). The `Broken pipe(-32)` HAL log confirms a consumer disappeared. (Lifetime mismatch.)

Task 1 instruments all three pathways with `Log.i` tags. Task 2 reads the operator's logcat capture from a Pixel-10a test run, identifies which of (1) / (2) / (3) is in play, and applies the surgical fix. Task 3 is the operator-walked §9 A/B drift gate. **Owner directive (UAT G-11 note): treat this like `handgate-never-passes` — investigate with logcat instrumentation FIRST, then surgical fix; do NOT pre-emptively revert to Option A unless §9 produces `delta >= 0.50` evidence.**

**Non-negotiable invariants (from `<planning_rules>` + CLAUDE.md banners):**

- `git diff --stat apps/mobile/ios/` MUST remain empty (I18N-21).
- `git diff --stat apps/api/drizzle/migrations/` MUST remain empty (D-16).
- `06-COSMETIC-GAPS.md` MUST remain untouched (I18N-11).
- `HevcEncoder.kt` MUST remain untouched (REC-LIVE-07 — drift banner protection).
- `FinalizeWorker.kt`, `MetadataComposer.kt`, `MetadataSchemaConformance.kt`, `MetadataLiterals*`, `RealtimeGate.kt`, and the ultrawide `CONTROL_ZOOM_RATIO` selection MUST remain untouched (CLAUDE.md 2026-05-17 cancel-gate banner + drift banner + 2026-05-22 calibration banner).
- The ONLY files in `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/` this plan modifies are: the 4 files in the `livepreview/` directory + `capture/CaptureSession.kt`. A `git diff --stat` invariant check is enforced after each task.
- Audio stays dropped (CLAUDE.md 2026-05-11 banner) — no `AudioManager` / no AAC / no `audio_*` keys touched.

Output: a Pixel-10a `apkRolloutDebug` build that delivers a visually verifiable live ultrawide preview during the 15-s initial window AND the 10-s rolling tap-reveal, with `imu_video_drift_p99_ms` measured ON the preview-engaged treatment producing `delta < 0.50` against the preview-OFF baseline (D-04 / REC-LIVE-05).
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-07-live-preview-native-and-recording-screen-PLAN.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-07-SUMMARY.md
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraView.kt
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/GateCameraController.kt
@apps/mobile/src/native/HumynLivePreviewView.tsx
@apps/mobile/src/screens/recording/RecordingScreen.tsx
@CLAUDE.md
ULTRAWIDE-DRIFT-FINDINGS.md
@.planning/debug/handgate-never-passes.md

<interfaces>
<!-- These are the existing public surfaces this plan modifies. The executor MUST NOT broaden them. -->

From apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt (existing — from plan 07-07):

```kotlin
object LivePreviewSurfaceRegistry {
    @Volatile private var slot: Surface? = null
    @Volatile var onAddTarget: (() -> Unit)? = null
    @Volatile var onRemoveTarget: (() -> Unit)? = null

    fun onSurfaceAvailable(s: Surface)
    fun onSurfaceDestroyed(s: Surface?)
    fun currentSurface(): Surface?
}
```

From apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt (existing — from plan 07-07, lines 620-689):

```kotlin
val previewSurfaceAtConfig: Surface? = LivePreviewSurfaceRegistry.currentSurface()
val outputs: List<Surface> = if (previewSurfaceAtConfig != null) {
    listOf(surface, previewSurfaceAtConfig)
} else {
    listOf(surface)
}

cam.createCaptureSession(outputs, object : CameraCaptureSession.StateCallback() {
    override fun onConfigured(s: CameraCaptureSession) {
        val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
        builder.addTarget(surface)
        if (previewSurfaceAtConfig != null) {
            builder.addTarget(previewSurfaceAtConfig)
        }
        // ... existing zoom + AF + OIS setup ...
        if (previewSurfaceAtConfig != null) {
            LivePreviewSurfaceRegistry.onAddTarget = { /* rebuild + setRepeatingRequest */ }
            LivePreviewSurfaceRegistry.onRemoveTarget = { /* rebuild + setRepeatingRequest */ }
        }
    }
}, sessionHandler)
```

From apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/GateCameraController.kt (analogous WORKING pattern — the gate camera RENDERS frames; whatever differs in HumynLivePreviewView is the bug):

```kotlin
fun onPreviewSurfaceAvailable(s: Surface)
fun onPreviewSurfaceDestroyed(s: Surface?)
```

(Diff this controller against the live-preview registry — the working pattern likely OPENS / RECREATES the capture session when the Surface arrives, whereas the live-preview registry just stores the slot.)

From apps/mobile/src/native/HumynLivePreviewView.tsx (existing — from plan 07-07):

```typescript
export const HumynLivePreviewView = requireNativeComponent<{ style?: ViewStyle }>(
  'HumynLivePreviewView',
);
export const isLivePreviewAvailable = (): boolean => NativeModules.HumynLivePreview != null;
export async function isLivePreviewSurfacePublished(): Promise<boolean>;
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Instrument the live-preview Surface lifecycle + capture-session attach + isolate G-11 root cause from operator logcat</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt, apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt, .planning/debug/07-live-preview-broken-pipe.md</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md (G-11 + G-12 evidence + the logcat fragment `Camera3-PreviewFrameSpacer: queueBufferToClientLocked: Failed to queue buffer to client: Broken pipe(-32)`; the operator note "do NOT pre-emptively revert to Option A")
    - .planning/debug/handgate-never-passes.md (canonical Camera2-lifecycle debug-session template; mirror the journal shape)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt (lines 60-100 — the TextureView listener)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt (full file)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt (full file — especially onDropViewInstance which clears the slot)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt lines 615-700 + 1040-1050 (the Option-B path + the session-close callback-nulling block)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/GateCameraController.kt + apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraView.kt (the analogous WORKING Camera2-preview pattern — diff against the registry pattern to identify the structural difference that makes the gate-camera preview render but the live-preview not)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx — search for `HumynLivePreviewView` mount site + verify it mounts BEFORE `HumynCapture.start()` (line 655 area, after the gate exit) rather than AFTER
  </read_first>
  <behavior>
    - `LivePreviewSurfaceRegistry.kt` gains `Log.i("LivePreviewSurfaceRegistry", "onSurfaceAvailable surface=$s slot=$slot")` on each entry to `onSurfaceAvailable`, `onSurfaceDestroyed`, and `currentSurface()` (the third logs only when the slot is non-null, to avoid spam — gated with `if (slot != null) Log.i(...)`).
    - `HumynLivePreviewView.kt` gains `Log.i("HumynLivePreviewView", "...")` lines on the following lifecycle events: ctor (`<init>` block), `onSurfaceTextureAvailable(width=$w height=$h)`, `onSurfaceTextureSizeChanged(w=$w h=$h)`, `onSurfaceTextureDestroyed surface=$surface`, and inside `configureTransform` (one-shot). Each tag includes the System.identityHashCode of the TextureView so two simultaneous mounts can be distinguished.
    - `HumynLivePreviewViewManager.kt` gains `Log.i("HumynLivePreviewVM", "createViewInstance / onDropViewInstance")` on the two managed events.
    - `CaptureSession.kt` Option-B branch gains `Log.i("CaptureSession", "openCaptureSession previewSurfaceAtConfig=${previewSurfaceAtConfig != null} outputs.size=${outputs.size}")` before the `cam.createCaptureSession` call, and `Log.i("CaptureSession", "onConfigured addingPreviewTarget=${previewSurfaceAtConfig != null}")` inside the StateCallback. The `onAddTarget` / `onRemoveTarget` callbacks each gain `Log.i("CaptureSession", "onAddTarget fired / onRemoveTarget fired")`.
    - A new debug journal `.planning/debug/07-live-preview-broken-pipe.md` is created mirroring the `handgate-never-passes.md` shape: a Problem section + a Hypotheses section listing the three pathways from `<objective>` + an Evidence section that the operator fills in after running the instrumented APK on Pixel 10a, and a Conclusion section that names the root cause.
    - **The instrumented APK MUST build cleanly** (`./gradlew :app:assembleApkRolloutDebug` succeeds) — instrumentation is read-only, not behavior-modifying.
    - **NO behavior changes in this task**. The `Log.i` calls are diagnostic-only. The actual surgical fix lives in Task 2 once the operator's logcat capture is in hand.
  </behavior>
  <action>
1. **Read the four anchors** (the operator UAT G-11 evidence, the `handgate-never-passes.md` template, the existing live-preview Kotlin files, and the working `GateCameraController` analog). Diff the working gate-camera controller against the registry pattern — the gate-camera RENDERS its preview today, so whatever structural difference makes the live-preview registry-pattern miss is the bug.

2. **Add `Log.i` instrumentation** to four files. Each Log line uses a short hardcoded tag (no string interpolation in the tag itself per Android logging best practice). Example for `LivePreviewSurfaceRegistry.kt`:

   ```kotlin
   import android.util.Log

   object LivePreviewSurfaceRegistry {
       private const val TAG = "LivePreviewSurfaceRegistry"
       // ... existing fields ...

       fun onSurfaceAvailable(s: Surface) {
           Log.i(TAG, "onSurfaceAvailable surface=${System.identityHashCode(s)} prevSlot=${slot?.let { System.identityHashCode(it) }}")
           slot = s
       }

       fun onSurfaceDestroyed(s: Surface?) {
           Log.i(TAG, "onSurfaceDestroyed s=${s?.let { System.identityHashCode(it) }} slot=${slot?.let { System.identityHashCode(it) }}")
           if (s == null || slot === s) {
               slot = null
           }
       }

       fun currentSurface(): Surface? {
           val cur = slot
           if (cur != null) {
               Log.i(TAG, "currentSurface (returning non-null) surface=${System.identityHashCode(cur)}")
           }
           return cur
       }
   }
   ```

   Apply the same instrumentation shape to `HumynLivePreviewView.kt` (lifecycle methods), `HumynLivePreviewViewManager.kt` (createViewInstance + onDropViewInstance), and `CaptureSession.kt` (the Option-B branch — `openCaptureSession`, `onConfigured`, `onAddTarget`, `onRemoveTarget`). Use the tag `"CaptureSession"` for the CaptureSession lines (the existing class already logs under a `Capture` family of tags; pick a tag that does not collide with any existing one — verify with `grep -rE 'Log\\.[idew]\\("CaptureSession"' apps/mobile/android/app/src/main/java/`).

3. **Create the debug journal** at `.planning/debug/07-live-preview-broken-pipe.md`:

   ```markdown
   # 07 — Live-Preview Surface "Broken pipe(-32)" (G-11)

   **Phase:** 07-multi-linguality-live-cam-feed
   **Started:** {today}
   **Mirrors:** .planning/debug/handgate-never-passes.md

   ## Problem

   The `<HumynLivePreviewView>` Surface published by plan 07-07's Option-B two-Surface CaptureSession never renders camera frames on Pixel 10a. Logcat shows `Camera3-PreviewFrameSpacer: queueBufferToClientLocked: Failed to queue buffer to client: Broken pipe(-32)` and zero `HumynLivePreview` / `LivePreviewSurfaceRegistry` / `CaptureSession` activity (07-HUMAN-UAT.md G-11). Operator-confirmed on Pixel 10a `5C161JEA304304`, Android 16, `apkRolloutDebug`, 2026-05-25.

   ## Hypotheses

   - **H1 — Race-on-config:** `CaptureSession.openCaptureSession` runs before `HumynLivePreviewView.onSurfaceTextureAvailable`, so `previewSurfaceAtConfig` is null and Option-B never engages.
   - **H2 — TextureView never available:** `onSurfaceTextureAvailable` never fires (the view is hidden, the listener wasn't installed, or the JS mount happens too late).
   - **H3 — Lifetime mismatch:** The Surface is published + registered as a CaptureRequest target, but the SurfaceTexture is destroyed shortly after (RecordingScreen re-render unmounts/remounts the view, brightness state machine churns the tree, or some other consumer closes the Surface — yields the `Broken pipe(-32)` HAL log).

   ## Evidence — logcat from instrumented APK

   {operator pastes the `adb logcat` capture filtered with `-s LivePreviewSurfaceRegistry HumynLivePreviewView HumynLivePreviewVM CaptureSession` here}

   ## Conclusion

   {filled in by Task 2 after evidence is captured}

   ## Fix applied

   {Task 2 documents the surgical fix here}
   ```

4. **Build the instrumented APK** to verify the diagnostic additions compile cleanly:

   ```bash
   cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:compileApkRolloutDebugKotlin 2>&1 | tail -20
   ```

   (`apkRolloutDebug` is the user's debug build per CLAUDE.md and 07-MANUAL-SMOKE.md tunnels block; pin JDK 17 per memory `feedback_android_build_needs_jdk17.md`. The command exits 0 on success.)

5. **Invariant check** — confirm only the live-preview directory + CaptureSession.kt were modified in `apps/mobile/android/`:

   ```bash
   git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/ \
     | grep -vE 'livepreview/|capture/CaptureSession\.kt' \
     | grep -E '\.kt'
   ```

   Expected: empty output. If any line is returned, REVERT it immediately — only the 4 live-preview files + CaptureSession.kt are in scope per `<planning_rules>` rule 5.

6. **Verify ultrawide lens code unchanged + HevcEncoder unchanged + FinalizeWorker family unchanged:**

   ```bash
   git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt \
                   apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt \
                   apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt \
                   apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataSchemaConformance.kt \
                   apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/RealtimeGate.kt \
                   apps/mobile/android/app/src/main/java/ai/humynlabs/capture/calibration/
   ```

   Expected: empty output.
   </action>
   <verify>
   <automated>cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:compileApkRolloutDebugKotlin 2>&1 | tail -5</automated>
   </verify>
   <acceptance_criteria> - `grep -c 'Log.i("LivePreviewSurfaceRegistry"' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt` returns at least 3 (onSurfaceAvailable + onSurfaceDestroyed + currentSurface). - `grep -c 'Log.i("HumynLivePreviewView"' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt` returns at least 3 (onSurfaceTextureAvailable + onSurfaceTextureSizeChanged + onSurfaceTextureDestroyed). - `grep -c 'Log.i("CaptureSession"' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` returns at least 4 (openCaptureSession + onConfigured + onAddTarget + onRemoveTarget). - `test -f .planning/debug/07-live-preview-broken-pipe.md && grep -c 'Hypotheses\|H1\|H2\|H3' .planning/debug/07-live-preview-broken-pipe.md` returns at least 4. - The build verify command exits 0 (instrumented APK compiles). - `git diff --stat apps/mobile/ios/` returns empty (I18N-21 invariant). - `git diff --stat apps/api/drizzle/migrations/` returns empty (D-16 invariant). - `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` returns empty (I18N-11 invariant). - `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` returns empty (CLAUDE.md drift + cancel banners). - No `Log.d` / `Log.v` / `println` left in the modified files: `grep -rE 'Log\\.[dv]\\("LivePreview|println\\("' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/` returns empty (only `Log.i` is in scope for shippable instrumentation).
   </acceptance_criteria>
   <done>Diagnostic logging in place across the Surface lifecycle and the CaptureSession Option-B branch; build is green on `apkRolloutDebug`; the debug journal exists with the H1/H2/H3 hypotheses ready for the operator's logcat fill-in. No behavior changes shipped in this task — surgical fix follows in Task 2 after the operator hands back the logcat.</done>
   </task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Operator captures instrumented logcat + Claude applies surgical fix per identified root cause + re-verifies §7 + §8 rendering</name>
  <what-built>
    Task 1 shipped an instrumented `apkRolloutDebug` APK. This task pauses for the operator to (a) install the build on Pixel 10a, (b) walk §7 of the manual smoke runbook (real-flow recording: Tasks → any task → Record → pass gate → wait for the 15-s preview window), (c) capture `adb logcat -s LivePreviewSurfaceRegistry:I HumynLivePreviewView:I HumynLivePreviewVM:I CaptureSession:I` and paste it into `.planning/debug/07-live-preview-broken-pipe.md` §Evidence, and (d) tell Claude which of H1 / H2 / H3 the evidence shows.

    Claude then applies the surgical fix:
    - **If H1 (race-on-config)** — modify `CaptureSession.openCaptureSession` so the second target Surface is added LATE (after the StateCallback's `onConfigured` fires) via `cameraDevice.createCaptureSessionWithOutputConfigurations` OR queue the session-open until `LivePreviewSurfaceRegistry.onSurfaceAvailable` has fired (poll-with-timeout pattern). Pin the JS-side `<HumynLivePreviewView>` mount to happen BEFORE `HumynCapture.start()` rather than after.
    - **If H2 (TextureView never available)** — modify `HumynLivePreviewView.kt` to check `isAvailable` in `<init>` and synthesize the SurfaceTexture from `surfaceTexture` when the listener wasn't fired (mirror the gate-camera pattern: see `HumynGateCameraView.kt:60-70`). Verify the RecordingScreen JSX renders the view at `StyleSheet.absoluteFill` with no `display: none` ancestor.
    - **If H3 (lifetime mismatch)** — modify `RecordingScreen.tsx` to keep the `<HumynLivePreviewView>` mounted through both `'initial-preview'` AND `'dimmed'` substates (display:none on dimmed instead of unmount) so the Surface never destroys mid-recording; OR modify `LivePreviewSurfaceRegistry.onSurfaceDestroyed` to call `onRemoveTarget?.()` first so the CaptureRequest stops feeding the dead Surface BEFORE the consumer closes (eliminate the `Broken pipe(-32)`).

    After the fix lands, Claude rebuilds the APK and asks the operator to RE-WALK the §7 visual checks. The operator confirms:

    1. Live ultrawide preview renders full-screen at system brightness for 15 s (G-11 closed).
    2. Screen fades to the dimmed state with the `Eye` glyph visible bottom-right (G-12 closed — the brightness transition is observable because the surface NOW shows frames before dimming).
    3. Tap in the dimmed state visibly restores frame rendering at system brightness for 10 s (§8 row 1 PASS, not PARTIAL).
    4. Subsequent tap at ~5 s rolls the timer to ~10 s (§8 row 2 PASS — was already PASS on mechanism, this re-confirms with visible frames).
    5. Stop button hit-testable across all 3 substates (§8 rows 3 + 4 PASS — already passed before fix; re-confirm not regressed).
    6. The conclusion section of `.planning/debug/07-live-preview-broken-pipe.md` names the identified root cause + the surgical fix applied.

  </what-built>
  <how-to-verify>
    **Pre-walk:**
    1. `JAVA_HOME=$(/usr/libexec/java_home -v 17) cd apps/mobile/android && ./gradlew :app:installApkRolloutDebug` (installs the instrumented build per memory `feedback_android_build_needs_jdk17.md`).
    2. `adb logcat -c` to clear the buffer.
    3. Start logcat capture in a second terminal: `adb logcat -s LivePreviewSurfaceRegistry:I HumynLivePreviewView:I HumynLivePreviewVM:I CaptureSession:I > /tmp/07-10-logcat.txt &`.

    **Walk:**
    4. Open the APK. Sign in (or already-signed-in resume). Navigate Tasks → tap any task → Record.
    5. On the recording screen, after the hand gate (pass or Skip), the live ultrawide preview SHOULD render full-screen for 15 s.
    6. Watch the preview surface for 15 s. After ~15 s the screen fades to dim (5% brightness, `Eye` glyph bottom-right).
    7. Tap anywhere (not Stop). The preview should re-appear visibly at system brightness for 10 s.
    8. Tap again at ~5 s. The 10-s window should restart (rolling per D-29).
    9. Tap Stop. Recording stops, History shows the row.
    10. Kill the logcat capture (`fg` then Ctrl-C, or `kill %1`).

    **Report back to Claude:**
    11. Paste the entire `/tmp/07-10-logcat.txt` into `.planning/debug/07-live-preview-broken-pipe.md` §Evidence and say one of: "H1 confirmed" / "H2 confirmed" / "H3 confirmed" / "evidence inconclusive — paste shows {summary}". Claude applies the surgical fix accordingly.

    **Re-walk after fix:**
    12. Claude rebuilds + re-installs the APK and asks you to re-walk steps 4-9 above. Each of the 6 checks in `<what-built>` PASS / FAIL.

  </how-to-verify>
  <acceptance_criteria>
    - `.planning/debug/07-live-preview-broken-pipe.md` §Evidence contains a non-empty logcat capture from the operator's Pixel-10a run.
    - `.planning/debug/07-live-preview-broken-pipe.md` §Conclusion names the identified root cause (H1, H2, or H3 or a refinement) AND the file:line of the surgical fix.
    - `grep -E 'apkRolloutDebug|Pixel 10a|2026' .planning/debug/07-live-preview-broken-pipe.md` returns at least 1 line (proves operator ran the build).
    - The 6 visual checks in `<what-built>` all PASS (operator says "approved").
    - `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/` shows changes ONLY under `livepreview/` + `capture/CaptureSession.kt`.
    - `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` returns empty.
    - `git diff --stat apps/mobile/ios/ apps/api/drizzle/migrations/ .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` returns empty.
    - The fix is surgical — diff size depends on the identified root cause (POST-CHECKER-REV WARNING #6, tiered cap):
      - **H1 (Surface never registered) or H2 (registered then closed)**: `git diff --shortstat <livepreview/ CaptureSession.kt RecordingScreen.tsx HumynLivePreviewView.tsx>` reports **< 200 insertions** across all files combined. Native-side targeted fix; minimal RN churn.
      - **H3 (lifetime mismatch — JSX restructure to keep `<HumynLivePreviewView>` mounted across `initial-preview` + `dimmed` substates via `display: none`)**: same `git diff --shortstat` reports **< 350 insertions** combined (raised from 200 because H3 legitimately requires a brightness-state-machine refactor in `RecordingScreen.tsx`).
      If the H3 cap is hit, the executor must document the structural refactor scope in `.planning/debug/07-live-preview-broken-pipe.md` §Conclusion; if either cap is exceeded, the executor over-reached — revert the over-reach.
  </acceptance_criteria>
  <resume-signal>Type "approved" once all 6 visual checks PASS AND the debug journal Conclusion section is filled in. If the surgical fix did not close G-11, type "G-11 still open — try {H2|H3|other}" and Claude iterates.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: §9 A/B drift smoke walk (REC-LIVE-05 / D-04) — terminal acceptance gate; conditional contingent revert to Option A on `delta >= 0.50`</name>
  <what-built>
    With G-11 closed and the live preview now visibly engaged on hardware, the §9 A/B drift gate can finally be evaluated meaningfully. This task is the operator-walked § 9 from `07-MANUAL-SMOKE.md`: same-device, same-day, same-scene Pixel 10a recordings — one with preview OFF (baseline) and one with preview ON (treatment) — extract `imu_video_drift_p99_ms` from each `metadata.json`, compute `delta = (p99_ON − p99_OFF) / p99_OFF`, and gate on D-04: `delta < 0.50`.

    **Three outcomes:**

    - **PASS (delta < 0.50)** — Plan 07-07's Option-B two-Surface CaptureSession diff is ratified; G-11 closure is permanent; no contingent revert. Operator updates `07-MANUAL-SMOKE.md` §9 with the measured numbers and the PASS verdict.

    - **MARGINAL (0.50 <= delta < 0.75)** — owner-judgement call. Capture the numbers, surface to owner, await decision before reverting. Most likely outcome: accept-as-is given the relaxed-but-recorded drift gate (CLAUDE.md 2026-05-12 banner). Document the decision in the §Conclusion of `.planning/debug/07-live-preview-broken-pipe.md`.

    - **FAIL (delta >= 0.50)** — execute the **contingent revert**: flip `CaptureSession.kt`'s Option-B branch to Option A (Surface splitter via GL — the analog from 07-07-PLAN.md "3-Option A/B Comparison" table). Re-walk §9. If Option A's delta also fails, escalate to owner with both A and B numbers in the journal.

    The terminal artifact is `07-MANUAL-SMOKE.md` §9 updated in place with the measured baseline / treatment / delta values + a verdict line. The §VERIFICATION refresh runs in plan 07-15.

  </what-built>
  <how-to-verify>
    **Setup (mandatory):**
    - Pixel 10a `5C161JEA304304`, room temperature, NOT thermally stressed (give it 15 minutes off if you just finished Task 2's walks).
    - Tunnels: `adb reverse tcp:8080 tcp:8080 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4566 tcp:4566` (memory `feedback_dev_tunnels_include_localstack_4566.md`).
    - Dev API + worker running: `cd apps/api && pnpm dev` (memory `feedback_dev_api_runs_hash_verify_worker.md`). Re-seed if you ran `pnpm --filter @humyn/api test` since the last seed (memory `feedback_api_tests_wipe_dev_db.md`).

    **Baseline (preview OFF) — 10-minute recording:**
    1. Toggle the live-preview path OFF. The simplest deterministic toggle: in `apps/mobile/src/screens/recording/RecordingScreen.tsx`, temporarily replace the `<HumynLivePreviewView>` mount line with `null` (one-line edit), rebuild with `JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:installApkRolloutDebug`, and run the recording. Document the disabled-line commit hash in the journal so it can be reverted cleanly.
    2. Tasks → "Cooking a meal" (or any task with a clear scene). Record for exactly 10 minutes (use a stopwatch). Hold the rig steady; same scene + same lighting as the treatment run.
    3. Stop. Wait for upload + `qa_status=verified`.
    4. Extract `imu_video_drift_p99_ms`:
       ```bash
       psql humyn_dev -c "SELECT id, metadata->>'imu_video_drift_p99_ms' AS p99 FROM recordings ORDER BY created_at DESC LIMIT 1;"
       ```
    5. **Record:** `p99_OFF = ____ ms` in `07-MANUAL-SMOKE.md` §9 + the debug journal.

    **Treatment (preview ON) — 10-minute recording:**
    6. Revert the one-line edit from step 1 (restore the `<HumynLivePreviewView>` mount). Rebuild + re-install.
    7. Same task, same scene, same camera placement. Record for 10 minutes.
    8. **Engage the live-preview path naturally:** let the 15-s initial preview run; tap to reveal at ~5 min; let it fade; tap again at ~7 min. (This exercises both the always-on initial window AND the rolling tap-reveal path so the Option-B preview Surface is an actual CaptureRequest target throughout the recording.)
    9. Stop. Wait for upload + `qa_status=verified`.
    10. Extract `imu_video_drift_p99_ms` the same way.
    11. **Record:** `p99_ON = ____ ms`.

    **Compute and gate:**
    12. `delta = (p99_ON − p99_OFF) / p99_OFF`. (E.g. baseline 4.0 ms, treatment 5.5 ms → delta = 0.375 → PASS.)
    13. **Verdict per D-04:** PASS if `delta < 0.50`; MARGINAL if `0.50 <= delta < 0.75`; FAIL if `delta >= 0.50` (the gate's binary cutoff, with the marginal band as an owner-decision zone Claude documents but does not auto-resolve).

    **Update `07-MANUAL-SMOKE.md` §9 in place** with the measured values + verdict + the commit hash of the `apkRolloutDebug` build used.

    **If FAIL → execute contingent revert:**
    14. Modify `CaptureSession.kt` to use Option A (Surface splitter via GL). The Option A code template is in `07-07-live-preview-native-and-recording-screen-PLAN.md` §"Surface-Source A/B Comparison" + `07-RESEARCH.md` §"Live-Cam Preview Surface-Source A/B". Implement the GL renderer thread that reads the encoder Surface's SurfaceTexture and blits to both the MediaCodec input Surface AND the preview TextureView Surface.
    15. Re-walk steps 6-13 with Option A. Update §9 with the Option-A delta. If Option A ALSO fails, escalate to owner — do NOT silently ship a Phase 7 that ships a §9-failing CaptureSession.

  </how-to-verify>
  <acceptance_criteria>
    - `07-MANUAL-SMOKE.md` §9 contains non-empty `p99_OFF`, `p99_ON`, and `delta` values (operator-filled).
    - §9 verdict line states either "PASS (delta < 0.50)" with the measured delta OR "FAIL → reverted to Option A; new delta = {value}; verdict {PASS|FAIL}".
    - `.planning/debug/07-live-preview-broken-pipe.md` §Conclusion is updated with the §9 verdict + (if MARGINAL or FAIL) the owner-decision capture.
    - If §9 PASSED on Option B: `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` shows the Task-2 surgical fix only (no Option-A revert).
    - If §9 FAILED on Option B: `grep -E 'Option A|SurfaceTexture splitter|GL renderer' apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` returns at least 1 line (Option-A code present); §9 re-walk verdict is documented; HevcEncoder.kt STILL unchanged.
    - `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` returns empty across both PASS and FAIL paths.
    - `git diff --stat apps/mobile/ios/ apps/api/drizzle/migrations/` returns empty.
    - The ultrawide lens code (search `CONTROL_ZOOM_RATIO` + `LENS_FACING_BACK` selection) is UNCHANGED: `git diff apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt | grep -E '^[+-].*CONTROL_ZOOM_RATIO|ZOOM_RATIO_RANGE'` returns empty.
  </acceptance_criteria>
  <resume-signal>Type "approved — §9 PASS" once the delta values are recorded and the gate passed. Type "§9 FAIL — execute revert" to trigger the contingent Option-A flip; Claude then re-walks. Type "§9 MARGINAL — accept" or "§9 MARGINAL — escalate" to capture the owner's marginal-band call.</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                 | Description                                                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera HAL → MediaCodec encoder          | The encoder Surface MUST receive a continuous frame stream; Option B's second target Surface MUST NOT starve the encoder.                            |
| Native view → JS bridge                  | The `LivePreviewSurfaceRegistry` singleton is a global mutable slot; concurrent writes from view-lifecycle + session-config threads risk torn reads. |
| Operator-supplied logcat → debug journal | Operator pastes raw logcat into a checked-in markdown file; logcat MAY contain PII (account IDs, session tokens, file paths).                        |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                    | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                                |
| ---------- | ---------------------- | ---------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-10-01 | Tampering              | `CaptureSession.kt` Option-B branch                                          | mitigate    | Encoder Surface remains in the outputs list unconditionally; preview Surface is conditionally added when `LivePreviewSurfaceRegistry.currentSurface() != null`. Drift A/B (Task 3) is the empirical gate — no code path can land Option-B without the operator-walked § 9 verdict.                                                             |
| T-07-10-02 | Denial-of-Service      | Encoder Surface starvation                                                   | mitigate    | Builder-rebuild paths in onAddTarget/onRemoveTarget always call `builder.addTarget(surface)` (the encoder Surface) BEFORE conditionally adding the preview Surface. FinalizeWorker `fps_dropped` cancel gate is the second line of defense (REC-LIVE-07 — UNCHANGED).                                                                          |
| T-07-10-03 | Race-condition         | `LivePreviewSurfaceRegistry` @Volatile slot                                  | accept      | The @Volatile slot is sufficient for single-writer (TextureView lifecycle on UI thread) + single-reader (CaptureSession config thread) — no torn read possible for a reference type. The onAddTarget/onRemoveTarget callbacks are best-effort try/catch; if a race occurs, the encoder Surface remains a valid target and recording continues. |
| T-07-10-04 | Information Disclosure | Operator-supplied logcat in `.planning/debug/07-live-preview-broken-pipe.md` | mitigate    | Operator instructed to redact account-ID / token / personal-path lines before paste. Logcat captured via the `-s` flag filters to only the 4 LivePreview tags + CaptureSession tag, dramatically reducing PII surface.                                                                                                                         |
| T-07-10-05 | Spoofing               | `LivePreviewSurfaceRegistry` singleton — process-global mutable state        | accept      | Singleton in-process; no IPC; no untrusted writer. The view's lifecycle is the only legitimate writer. Risk is bounded by the single-process Android app.                                                                                                                                                                                      |

</threat_model>

<verification>
After Task 3 signs PASS:

1. `cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:compileApkRolloutDebugKotlin` exits 0.
2. `cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:testApkRolloutDebugUnitTest --tests ai.humynlabs.capture.capture.* --tests ai.humynlabs.capture.livepreview.*` exits 0 (all existing JVM tests still pass; instrumentation must not break them).
3. `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test` exits 0 per memory `feedback_post_merge_test_env.md` (JS unit tests including `apps/mobile/src/lib/__tests__/livePreviewState.test.ts` still pass).
4. `07-MANUAL-SMOKE.md` §9 PASS row is checked.
5. `.planning/debug/07-live-preview-broken-pipe.md` is committed alongside the surgical fix.
6. All four invariant gates green: `git diff --stat apps/mobile/ios/ apps/api/drizzle/migrations/ .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt` all empty.
   </verification>

<success_criteria>

- G-11 (Surface never renders camera frames) is closed: instrumented logcat + operator-confirmed visual rendering of the ultrawide preview in §7 and §8 walks.
- G-12 (fade-to-dim not observable) is closed automatically as a consequence of G-11 (the dim transition is now observable because the surface shows frames before the dim).
- §7 row 1 (15-s preview renders + fades): re-walk PASS.
- §7 row 2 (Practice D-05 copy not during preview): re-walk PASS — was UNVERIFIED before, now testable.
- §7 row 5 (Eye glyph in dimmed state): re-walk PASS — was PARTIAL on visibility (G-12 + COSMETIC-03); COSMETIC-03 stays open and is closed by plan 07-14.
- §8 row 1 (Tap-reveal restores preview at system brightness): PARTIAL → PASS.
- §8 row 5 (Brightness restore on Stop/unmount): PRESUMED-PASS → PASS (now observable).
- §9 A/B drift smoke (REC-LIVE-05 / D-04 — BLOCKING): produces measured `delta < 0.50` OR documented Option-A revert with measured `delta < 0.50`.
- All Phase 7 capture-spec invariants intact: `HevcEncoder.kt` / `FinalizeWorker.kt` / `MetadataComposer.kt` / `MetadataSchemaConformance.kt` / `RealtimeGate.kt` / calibration block UNCHANGED; ultrawide lens code UNCHANGED.
- iOS untouched (I18N-21); no DB migration (D-16); Phase-6 cosmetics ledger untouched (I18N-11).
- Plan 07-07's `requirements:` (REC-LIVE-01..07) are re-affirmed at runtime (not just code-verified).
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-10-SUMMARY.md` documenting:
- The identified G-11 root cause (H1 / H2 / H3 / refinement)
- The surgical fix (file:line + diff stat)
- The §9 A/B drift measured baseline + treatment + delta + verdict
- The contingent-revert outcome (Option B retained vs Option A landed)
- The downstream gaps now unblocked (§4 TTS re-walk in 07-15, §10 cancel-gate cancel-with-preview-ON walk in 07-15)
</output>
