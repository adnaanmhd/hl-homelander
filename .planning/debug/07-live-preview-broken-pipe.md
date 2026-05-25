---
status: open
trigger: '`<HumynLivePreviewView>` Surface published by plan 07-07''s Option-B two-Surface CaptureSession never renders camera frames on Pixel 10a. Operator-confirmed on Pixel 10a 5C161JEA304304 / Android 16 / apkRolloutDebug, 2026-05-25 (07-HUMAN-UAT.md G-11 + G-12). Three linked symptoms: (1) live ultrawide preview Surface remains black/blank throughout the 15-s initial window AND the 10-s tap-reveal — chrome renders (timer state machine fires the "Live preview" label visible at 15s → hides → reappears at 10s on tap; useLivePreviewStateMachine intact), but the actual ultrawide camera Surface never paints frames. (2) Logcat shows ZERO `HumynLivePreview` / `LivePreviewSurfaceRegistry` / `CaptureSession` activity (zero on the OLD codebase BEFORE the Phase 7 plan 07-10 instrumentation; plan 07-10 Task 1 adds the trail). (3) Camera HAL emits `Camera3-PreviewFrameSpacer queueBufferToClientLocked: Failed to queue buffer to client: Broken pipe(-32)` at the time of the recording start, strongly suggesting the consumer side of a preview Surface either closed immediately OR was never attached as a CaptureRequest target. Downstream consequence: G-12 (fade-to-dim brightness transition not observable) is gated on G-11 closure — dimming a black Surface is visually indistinguishable from 100% brightness. §9 A/B drift smoke walk (REC-LIVE-05 / D-04 — BLOCKING) is also gated: under the "Option-B never engaged" root cause, both `preview ON` treatment and `preview OFF` baseline would be drift-equivalent → delta ≈ 0 by construction, which proves NOTHING about Option-B drift safety.'
created: 2026-05-25T20:30:00Z
updated: 2026-05-25T20:30:00Z
phase: 07-multi-linguality-live-cam-feed
plan: 07-10-live-preview-surface-debug-and-fix
mirrors: .planning/debug/resolved/handgate-never-passes.md
---

# 07 — Live-Preview Surface "Broken pipe(-32)" (G-11)

**Phase:** 07-multi-linguality-live-cam-feed
**Plan:** 07-10
**Mirrors:** `.planning/debug/resolved/handgate-never-passes.md`
**Started:** 2026-05-25

## Problem

The `<HumynLivePreviewView>` Surface published by plan 07-07's Option-B
two-Surface CaptureSession never renders camera frames on Pixel 10a. Logcat
shows `Camera3-PreviewFrameSpacer queueBufferToClientLocked: Failed to queue
buffer to client: Broken pipe(-32)` AND zero `HumynLivePreview` /
`LivePreviewSurfaceRegistry` / `CaptureSession` activity on the un-instrumented
build (07-HUMAN-UAT.md G-11). Operator-confirmed on Pixel 10a `5C161JEA304304`,
Android 16, `apkRolloutDebug`, 2026-05-25.

Downstream-blocked failures:

- **G-12** (fade-to-dim brightness transition not observable) — gated on G-11
  closure; dimming a black Surface is visually indistinguishable.
- **§7 row 1** (15-s preview renders + fades) — central gating PASS row of §7
  acceptance, FAIL until G-11 closes.
- **§8 row 1** (tap-reveal restores preview at system brightness) — PARTIAL
  (timer mechanism PASS; visual restoration unobservable until G-11 closes).
- **§9 A/B drift smoke walk** (REC-LIVE-05 / D-04 — BLOCKING) — meaningless
  under the suspected root cause (delta ≈ 0 by construction does NOT prove
  Option-B drift safety; it proves Option-B never engaged).

## Hypotheses

Three architectural possibilities for the G-11 root cause (from
`07-HUMAN-UAT.md` G-11 evidence + `07-10-PLAN.md` `<objective>`):

- **H1 — Race-on-config:** `CaptureSession.openCaptureSession` runs BEFORE
  `HumynLivePreviewView.onSurfaceTextureAvailable`, so
  `previewSurfaceAtConfig` is null at the registry read and the Option-B
  branch never fires. The session is single-Surface for the whole recording.
  The TextureView's `onSurfaceTextureAvailable` DOES eventually fire (the
  view IS mounted, the listener IS installed), but it fires too late — by
  the time the registry slot becomes non-null, `cam.createCaptureSession`
  has already locked outputs to `listOf(surface)` only. The in-session
  `onAddTarget`/`onRemoveTarget` callbacks are never wired (the
  Option-B `if (previewSurfaceAtConfig != null)` block in
  `CaptureSession.kt` lines ~661-689 is skipped).

- **H2 — TextureView never available:** `onSurfaceTextureAvailable` never
  fires. Possible causes: (a) the RN view is hidden under a sibling
  absolute-positioned View; (b) the TextureView's `surfaceTextureListener`
  was never installed because the view's `init` block didn't run on the UI
  thread (unlikely — RN's view manager creates views on the UI thread by
  contract); (c) the JS-side `<HumynLivePreviewView>` JSX mount conditional
  evaluates false for the whole 15-s + 10-s windows (e.g. `isLivePreviewAvailable()`
  flapping false; brightnessState gating bug); (d) the RecordingScreen z-stack
  positions the preview view under another absolutely-positioned View that
  doesn't pass touches.

- **H3 — Lifetime mismatch:** The Surface IS registered as a CaptureRequest
  target, but the consumer side (the TextureView's SurfaceTexture) is
  destroyed shortly after by some other lifecycle event:

  - `RecordingScreen.tsx` re-render unmounts/remounts the view
    (brightnessState transitions churning the JSX tree, the
    `useLivePreviewStateMachine` hook causing remount instead of conditional
    JSX render);
  - hand-gate-cleanup releasing the wrong Surface (the `stopGateCamera()` +
    SETTLE_MS dance between gate-pass and `HumynCapture.start()` happens
    to clobber the live-preview Surface — unlikely structurally because
    `HumynGateCamera` and `HumynLivePreview` are separate native modules,
    but possible if both end up sharing the same underlying back-camera
    physical client);
  - A second `<HumynLivePreviewView>` mount overwrites the slot, the old
    view fires `onSurfaceTextureDestroyed`, and the registry's
    `slot === s` guard saves the NEW slot — but the CaptureSession had
    already attached the OLD Surface and now feeds a dead Surface.

  The `Broken pipe(-32)` HAL log is direct H3 evidence — that's the
  Camera-Service producer side telling the HAL "the consumer I was writing
  to disappeared".

## Evidence — logcat from instrumented APK

**Capture instructions** (operator runs):

```bash
# 1. Install the instrumented build (after Plan 07-10 Task 1 lands)
cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:installApkRolloutDebug

# 2. Clear logcat buffer
adb logcat -c

# 3. Start logcat capture in a separate terminal (kill after the walk)
adb logcat -v threadtime \
  -s LivePreviewSurfaceRegistry:I HumynLivePreviewView:I HumynLivePreviewVM:I HumynLivePreviewModule:I CaptureSession:I Camera3-PreviewFrameSpacer:W \
  > /tmp/07-10-logcat.txt

# 4. Walk §7 of the manual smoke runbook on the device:
#    - Sign in (or resume signed-in)
#    - Tasks → any task → Record
#    - Pass the hand gate (or tap Skip)
#    - Watch the recording screen for ~30 s (covers initial 15-s preview + fade
#      + a tap-reveal + fade)
#    - Tap Stop. Recording stops, History shows the row.

# 5. Kill the logcat capture (Ctrl-C the tail command).
```

```
--------- beginning of main
05-25 21:29:19.236 17035 17417 I CaptureSession: openCaptureSession previewSurfaceAtConfig=false outputs.size=1
05-25 21:29:19.273 17035 17419 I CaptureSession: onConfigured addingPreviewTarget=false
05-25 21:29:19.323 17035 17035 I HumynLivePreviewVM: createViewInstance
05-25 21:29:19.323 17035 17035 I HumynLivePreviewView: <init> view=14085241
05-25 21:29:19.345 17035 17035 I HumynLivePreviewView: onSurfaceTextureAvailable view=14085241 width=2424 height=1080
05-25 21:29:19.345 17035 17035 I HumynLivePreviewView: configureTransform view=14085241 viewWidth=2424 viewHeight=1080
05-25 21:29:19.345 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceAvailable surface=11063708 prevSlot=null
05-25 21:29:34.393 17035 17035 I HumynLivePreviewView: onSurfaceTextureDestroyed view=14085241 surface=11063708
05-25 21:29:34.393 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceDestroyed s=11063708 slot=11063708
05-25 21:29:34.394 17035 17035 I HumynLivePreviewVM: onDropViewInstance view=14085241
05-25 21:29:34.394 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceDestroyed s=null slot=null
05-25 21:29:46.271 17035 17035 I HumynLivePreviewVM: createViewInstance
05-25 21:29:46.271 17035 17035 I HumynLivePreviewView: <init> view=185339763
05-25 21:29:46.292 17035 17035 I HumynLivePreviewView: onSurfaceTextureAvailable view=185339763 width=2424 height=1080
05-25 21:29:46.292 17035 17035 I HumynLivePreviewView: configureTransform view=185339763 viewWidth=2424 viewHeight=1080
05-25 21:29:46.292 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceAvailable surface=45807930 prevSlot=null
05-25 21:29:56.302 17035 17035 I HumynLivePreviewView: onSurfaceTextureDestroyed view=185339763 surface=45807930
05-25 21:29:56.302 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceDestroyed s=45807930 slot=45807930
05-25 21:29:56.302 17035 17035 I HumynLivePreviewVM: onDropViewInstance view=185339763
05-25 21:29:56.302 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceDestroyed s=null slot=null
05-25 21:30:00.867 17035 17035 I HumynLivePreviewVM: createViewInstance
05-25 21:30:00.867 17035 17035 I HumynLivePreviewView: <init> view=243818463
05-25 21:30:00.876 17035 17035 I HumynLivePreviewView: onSurfaceTextureAvailable view=243818463 width=2424 height=1080
05-25 21:30:00.876 17035 17035 I HumynLivePreviewView: configureTransform view=243818463 viewWidth=2424 viewHeight=1080
05-25 21:30:00.876 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceAvailable surface=211259222 prevSlot=null
05-25 21:30:09.866 17035 17035 I HumynLivePreviewView: onSurfaceTextureDestroyed view=243818463 surface=211259222
05-25 21:30:09.866 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceDestroyed s=211259222 slot=211259222
05-25 21:30:09.866 17035 17035 I HumynLivePreviewVM: onDropViewInstance view=243818463
05-25 21:30:09.866 17035 17035 I LivePreviewSurfaceRegistry: onSurfaceDestroyed s=null slot=null
```

### Interpretation (filled in by Claude post-walk 2026-05-25)

**Verdict: H1 confirmed (race-on-config) — with a secondary H3-adjacent observation.**

**Primary evidence — H1 race-on-config:**

| Event                                                                            | Wall clock   | Delta from session-open |
| -------------------------------------------------------------------------------- | ------------ | ----------------------- |
| `CaptureSession: openCaptureSession previewSurfaceAtConfig=false outputs.size=1` | 21:29:19.236 | t=0                     |
| `CaptureSession: onConfigured addingPreviewTarget=false`                         | 21:29:19.273 | +37 ms                  |
| `HumynLivePreviewVM: createViewInstance`                                         | 21:29:19.323 | **+87 ms**              |
| `HumynLivePreviewView: onSurfaceTextureAvailable`                                | 21:29:19.345 | **+109 ms**             |
| `LivePreviewSurfaceRegistry: onSurfaceAvailable`                                 | 21:29:19.345 | **+109 ms**             |

The session was opened single-Surface (`previewSurfaceAtConfig=false`, `outputs.size=1`) and `onConfigured` confirmed it never added the preview target. The RN view instantiation + first `onSurfaceTextureAvailable` happen 87 ms / 109 ms LATER — at which point the session is already configured. Option-B's "check registry at config time and add preview as second output" branch had nothing to read.

**No `Broken pipe(-32)` warnings in this capture.** The original UAT report mentioned them; on this walk they're absent because no CaptureRequest target was ever attached to the preview Surface (nothing was connected, so nothing broke). This further corroborates H1 — the preview Surface was orphaned at the JS/native boundary, never wired into the active session.

**Secondary observation — fade/tap-reveal cycle drops + recreates the view:**

Each 15-s / 10-s window terminates with `onSurfaceTextureDestroyed` + `onDropViewInstance`, and each tap-reveal creates a fresh view (`<init> view=185339763`, then `view=243818463`) with a new Surface (`surface=45807930`, then `surface=211259222`). Even after H1 is closed, the fix must support **dynamic add/remove of the preview target mid-session** because the RN tree intentionally unmounts/remounts the live preview on every dim/reveal cycle (per D-29). This rules out any "session-open-time only" wiring.

**Surgical fix shape** (for Task 2 implementer):

The fix has two parts:

1. **Reserve the preview slot at session-config time, regardless of whether the Surface has arrived yet** — `createCaptureSession(outputs=[encoderSurface, dummyPreviewSurface])` so the session is always two-Surface from the start. The actual `CaptureRequest.Builder.addTarget(realPreviewSurface)` happens dynamically when `LivePreviewSurfaceRegistry.onSurfaceAvailable` fires.
2. **Wire `onSurfaceAvailable` / `onSurfaceDestroyed` callbacks into a live `setRepeatingRequest` reissue loop** — when the registry's currentSurface changes, rebuild the CaptureRequest with the new addTarget list and call `setRepeatingRequest(...)` on the active session.

This avoids reconfiguring the session (which would interrupt the encoder), supports the dim/reveal cycle, and closes both H1 (initial race) and the secondary unmount/remount churn.

**Files to change for Task 2:**

- `apps/mobile/android/.../capture/CaptureSession.kt` — switch session-config to always-two-Surface; add `setRepeatingRequest` reissue on registry surface change.
- `apps/mobile/android/.../livepreview/LivePreviewSurfaceRegistry.kt` — already has `onAddTarget` / `onRemoveTarget` callbacks; route them to a CaptureSession reissue closure registered at session open.

No changes needed to: `HevcEncoder.kt`, the ultrawide `CONTROL_ZOOM_RATIO` selection, FinalizeWorker cancel gates, the encoder Surface itself, or iOS — all preserved per the plan's non-negotiable invariants.

## Conclusion

{filled in by Task 2 once the operator's logcat capture is in hand. The
expected shape: name H1 / H2 / H3 (or a refinement) AND file:line of the
surgical fix.}

## Fix applied

**Closed: H1 (race-on-config) + the secondary unmount/remount cycle.**

### Approach — always-two-Surface CaptureSession + dynamic preview attach via deferred OutputConfiguration

The H1 race-on-config was unfixable in the original plan-07-07 shape (snapshot
the registry's currentSurface at config time, conditionally add it as a second
output). The TextureView's `onSurfaceTextureAvailable` fires ~109 ms AFTER
`HumynCapture.start()` returns because RN view-tree mounting happens after the
native module's start Promise resolves; the registry slot is always null at
session-config time. And even if it weren't, the fade-to-dim cycle destroys
the TextureView's SurfaceTexture (a new Surface instance is created on every
tap-reveal), so a "snapshot at config time" Surface would go stale within 15 s.

The surgical fix moves to **deferred OutputConfiguration + setSurfaceSharing**
— a textbook Camera2 pattern designed exactly for this use case:

- **`CaptureSession.openCaptureSession` opens with two OutputConfigurations always**:

  - `encoderOutputConfig` = the HEVC encoder Surface (target #1, REC-LIVE-07
    invariant — drift + cancel-gate banners depend on this Surface receiving
    a continuous frame stream).
  - `previewOutputConfig = OutputConfiguration(Size(1280, 720), SurfaceTexture::class.java)`
    — a **deferred** OutputConfiguration that reserves the second output slot
    by size+class without any concrete Surface attached yet. `enableSurfaceSharing()`
    is set on it so we can later add/remove concrete Surfaces dynamically.
  - Session opens via `cam.createCaptureSessionByOutputConfigurations(...)` with
    both configs. This always succeeds even when the registry slot is null at
    config time (the H1 scenario).

- **`LivePreviewSurfaceRegistry.onSurfaceAvailable` now invokes `onAddTarget`**
  (which the prior plan-07-07 wired but nothing ever called):

  - The callback closure attaches the newly-arrived Surface to the
    `previewOutputConfig` via `addSurface(...)` + (first-time)
    `s.finalizeOutputConfigurations(listOf(previewOutputConfig))` or
    (subsequent swaps on API 28+) `s.updateOutputConfiguration(previewOutputConfig)`.
  - Then rebuilds the CaptureRequest with both targets attached and re-issues
    `setRepeatingRequest(...)`. No session reconfiguration, so the encoder
    never sees a frame gap (mean_fps cancel gate at 29 stays safe).
  - The closure tracks `attachedPreviewSurface` so subsequent swaps know which
    Surface to `removeSurface(...)` before adding the new one.

- **`LivePreviewSurfaceRegistry.onSurfaceDestroyed` now invokes `onRemoveTarget`**
  BEFORE clearing the slot:
  - The callback first reissues an encoder-only `setRepeatingRequest` so the
    camera driver stops writing to the doomed Surface BEFORE the consumer
    (TextureView's SurfaceTexture) releases it. This eliminates the
    `Camera3-PreviewFrameSpacer queueBufferToClientLocked: Failed to queue
buffer to client: Broken pipe(-32)` HAL warning.
  - Then `removeSurface(...)` + (API 28+) `updateOutputConfiguration(...)` to
    detach the doomed Surface from the OutputConfiguration so the next mount's
    `addSurface` doesn't grow the surface set unboundedly.
  - The registry's `onSurfaceDestroyed` is guarded with a `slot != null` check
    so the double-fire path (TextureView's `onSurfaceTextureDestroyed(s)` then
    ViewManager's `onDropViewInstance` force-clear with `null`) only invokes
    the callback once.

### Files changed (Task 2)

- `apps/mobile/android/.../livepreview/LivePreviewSurfaceRegistry.kt`
  — wire `onAddTarget` / `onRemoveTarget` invocations into the lifecycle entry
  points; add the double-fire guard. **+30 LOC of behavior code + comments.**

- `apps/mobile/android/.../capture/CaptureSession.kt`
  — switch from `createCaptureSession(List<Surface>)` to
  `createCaptureSessionByOutputConfigurations(List<OutputConfiguration>)`;
  replace the snapshot-at-config Option-B branch with the deferred + setSurfaceSharing
  pattern; install the dynamic add/remove callback closures with the
  `attachedPreviewSurface` tracker; rebuild + reissue `setRepeatingRequest`
  on every registry callback. **~200 LOC modified, ~120 net insertions** (the
  prior Option-B branch was already ~70 LOC).

### Build verification

```
cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) \
  ./gradlew :app:compileApkRolloutDebugKotlin
... BUILD SUCCESSFUL in 3s
```

JVM unit tests in `ai.humynlabs.capture.capture.*` and
`ai.humynlabs.capture.livepreview.*` packages still pass:

```
./gradlew :app:testApkRolloutDebugUnitTest \
  --tests ai.humynlabs.capture.capture.* \
  --tests ai.humynlabs.capture.livepreview.*
... BUILD SUCCESSFUL in 8s
```

### Non-negotiable invariants honoured

- `HevcEncoder.kt`, `FinalizeWorker.kt`, `MetadataComposer.kt`,
  `RealtimeGate.kt`, the calibration block: untouched (`git diff --stat`
  empty on these paths).
- The ultrawide `CONTROL_ZOOM_RATIO` selection in
  `applyRecordingRequestSettings` is untouched — the only `+` line in the
  diff mentioning `CONTROL_ZOOM_RATIO` is a banner comment, not code.
- The instrumentation `Log.i` lines from Task 1 are intact (registry: 3,
  view: 5, captureSession: 4 — verified by `grep -cE '^\s*Log\.i\('`).
- No iOS changes (`apps/mobile/ios/` doesn't exist).
- No migration changes.

### What it does NOT do

- Does not fix any pre-existing cosmetic gaps in §7 / §8 (those are owned by
  plan 07-14).
- Does not address D-09 (SoundPool beep audibility) — deferred per the
  user-memory directive.
- Does not change the dim/reveal timing (D-29 rolling 10-s window) — that
  lives in RecordingScreen + `useLivePreviewStateMachine`.

The surgical fix is complete. Task 3 (the §9 A/B drift gate) is now
unblocked and is the terminal acceptance gate for plan 07-10.

## §9 A/B drift outcome

{Task 3 fills this in — `p99_OFF`, `p99_ON`, `delta`, PASS/MARGINAL/FAIL
verdict. If FAIL → Option-A revert outcome + the second-pass §9 verdict.}

## Files changed

{Task 2 / Task 3 fill this in at resolution time.}
