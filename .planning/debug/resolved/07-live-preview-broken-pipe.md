---
status: resolved
trigger: '`<HumynLivePreviewView>` Surface published by plan 07-07''s Option-B two-Surface CaptureSession never renders camera frames on Pixel 10a. Operator-confirmed on Pixel 10a 5C161JEA304304 / Android 16 / apkRolloutDebug, 2026-05-25 (07-HUMAN-UAT.md G-11 + G-12). Three linked symptoms: (1) live ultrawide preview Surface remains black/blank throughout the 15-s initial window AND the 10-s tap-reveal — chrome renders (timer state machine fires the "Live preview" label visible at 15s → hides → reappears at 10s on tap; useLivePreviewStateMachine intact), but the actual ultrawide camera Surface never paints frames. (2) Logcat shows ZERO `HumynLivePreview` / `LivePreviewSurfaceRegistry` / `CaptureSession` activity (zero on the OLD codebase BEFORE the Phase 7 plan 07-10 instrumentation; plan 07-10 Task 1 adds the trail). (3) Camera HAL emits `Camera3-PreviewFrameSpacer queueBufferToClientLocked: Failed to queue buffer to client: Broken pipe(-32)` at the time of the recording start, strongly suggesting the consumer side of a preview Surface either closed immediately OR was never attached as a CaptureRequest target. Downstream consequence: G-12 (fade-to-dim brightness transition not observable) is gated on G-11 closure — dimming a black Surface is visually indistinguishable from 100% brightness. §9 A/B drift smoke walk (REC-LIVE-05 / D-04 — BLOCKING) is also gated: under the "Option-B never engaged" root cause, both `preview ON` treatment and `preview OFF` baseline would be drift-equivalent → delta ≈ 0 by construction, which proves NOTHING about Option-B drift safety.'
resolution: 'JS-side keep-mounted fix landed in commit 82d2ff7. Root cause was SurfaceTexture re-creation on every dim/reveal cycle (the JSX previously gated `<HumynLivePreviewView>` mount on brightness substate, causing unmount/remount thrash; the new SurfaceTexture''s BufferQueue producer wasn''t fully attached when Camera2 tried to swap it via updateOutputConfiguration → IllegalArgumentException "Surface was abandoned"). Fix: mount the view ONCE for the lifetime of the ''active'' substate and toggle visibility via `opacity: 0 | 1`. Operator §9 A/B walk on Pixel 10a 5C161JEA304304 (14 segments × ~10 min) confirms drift Δp99 of +0.107 ms / +3.8% between preview-ON (6 segs, avg 2.958 ms) and preview-OFF (8 segs, avg 2.851 ms) — well within the D-04 50% gate AND within the segment-to-segment noise floor (Walk 1''s p99 ranged 0.635–5.422 ms, an 8.5× variation). Plan-07-07''s Option-B two-Surface CaptureSession is ratified by hardware. No Option-A contingent revert required.'
created: 2026-05-25T20:30:00Z
updated: 2026-05-26T15:30:00Z
resolved: 2026-05-26T15:30:00Z
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

**Root cause: SurfaceTexture re-creation on every fade-to-dim / tap-reveal cycle,
not race-on-config (H1) and not lifetime mismatch (H3) as originally hypothesised.**

The instrumented logcat showed H1 evidence (the live preview SurfaceTexture
arrives ~109 ms AFTER `CaptureSession.openCaptureSession` returns), but H1 alone
was unfixable structurally — every Task-2 native-side attempt to handle late-
arriving Surfaces via `updateOutputConfiguration` failed with
`IllegalArgumentException: Surface was abandoned`. The four native-side attempts
(commits `34597a2`, `cdcada9`, `eb70d33` — always-two-Surface CaptureSession

- deferred OutputConfiguration + `onAddTarget`/`onRemoveTarget` deferred to
  `sessionHandler` + 200 ms `postDelayed` before re-attach) all hit the same
  exception. The post-delays (0 ms / 4 ms / 200 ms) hit the same exception
  regardless of duration — proving the bug is structural (SurfaceTexture's fresh
  BufferQueue producer isn't fully attached before Camera2 tries to swap it),
  not timing.

**The actual root-cause:** `HumynLivePreviewView` was being **unmounted on every
fade-to-dim and remounted on every tap-reveal** by the RecordingScreen JSX
tree. Each remount produced a fresh `SurfaceTexture` (and therefore a fresh
`Surface`); the new SurfaceTexture's BufferQueue producer hadn't yet connected
when Camera2's `CaptureSession.updateOutputConfiguration(...)` ran against the
new Surface, and Camera2 immediately reports "abandoned".

**Surgical fix shipped (commit `82d2ff7`, `fix(07-10): keep <HumynLivePreviewView>
mounted across all 'active' substates`):** JS-side keep-mounted refactor in
`RecordingScreen.tsx`. The `<HumynLivePreviewView>` is mounted ONCE at entry to
the `'active'` substate and remains mounted through `'initial-preview'`,
`'dimmed'`, AND `'tap-revealed'`. Visibility is toggled via `opacity: 0 | 1`
instead of conditional JSX (mount/unmount). The SurfaceTexture is created once
per recording; `finalizeOutputConfigurations` attaches it once at session open
and no subsequent `updateOutputConfiguration` swap is needed on the common path
(the H1-fix native scaffolding from commits `34597a2`..`eb70d33` stays as
defence-in-depth for any future event that does trigger a mid-recording
remount).

This makes the §9 A/B comparison strictly-more-conservative than the original
plan-07-07 Option-B intermittent-target design (the preview Surface is now an
always-active CaptureSession target throughout `'active'`, not just visible
windows), which is exactly what the operator-walked §9 below confirms is drift-
safe in product use.

**File:line of the fix:** `apps/mobile/src/screens/recording/RecordingScreen.tsx`
— the JSX block that mounts `<HumynLivePreviewView>` now lives at the always-on
level of the `'active'` substate tree with `style={{ opacity: state === 'dimmed' ? 0 : 1 }}`,
NOT inside a `{state === 'initial-preview' || state === 'tap-revealed' && ...}`
conditional. See commit `82d2ff7` for the exact diff.

## Fix applied

**Closed:** SurfaceTexture re-creation on JS-side mount/unmount cycles
(reframing of H3 — the consumer was tearing down, but driven by intentional JS
churn during the dim/reveal animation rather than by an external lifecycle
event).

### Approach — JS-side keep-mounted; visibility via opacity, not conditional render

The native-side attempts in commits `34597a2` / `cdcada9` / `eb70d33` are
retained on the branch as defence-in-depth (always-two-Surface session via
`createCaptureSessionByOutputConfigurations` + `OutputConfiguration` with
`enableSurfaceSharing()` + `onAddTarget`/`onRemoveTarget` deferred to
`sessionHandler` + 200 ms `postDelayed` before `updateOutputConfiguration`).
None of those eliminated `Surface was abandoned` on their own — the structural
fix had to live in JS.

The shipped fix (commit `82d2ff7`):

- `RecordingScreen.tsx` mounts `<HumynLivePreviewView style={[StyleSheet.absoluteFill, { opacity: dim ? 0 : 1 }]} />`
  unconditionally for the duration of the `'active'` substate (i.e. wrapping
  all three brightness sub-states `'initial-preview'` / `'dimmed'` /
  `'tap-revealed'`). Previously the JSX gated the mount on `state !== 'dimmed'`,
  which caused the unmount/remount thrash.
- The `useLivePreviewStateMachine` hook is unchanged — it still drives
  brightness (`set(-1)` / `set(0.05)`) and the dimmed-state Pressable overlay
  in/out as before.
- The full-surface Pressable for tap-to-reveal continues to render only in the
  `'dimmed'` substate (D-27 / D-28 contract preserved).
- Subsequent polish commits (`c35ac8f` → `b041d51`) refined the visible
  indicator chrome (brand-orange "Tap screen to preview" copy + bottom-center
  anchor + 5 px nudge) but did not touch the Surface lifecycle.

### Files changed (live-preview Surface lifecycle, root-cause closure)

| Commit    | File                                                                                                                                                                                               | Role                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `79bf7c7` | `apps/mobile/android/.../livepreview/{LivePreviewSurfaceRegistry,HumynLivePreviewView,HumynLivePreviewViewManager,HumynLivePreviewModule}.kt`, `apps/mobile/android/.../capture/CaptureSession.kt` | Instrumentation (`Log.i` tags) for root-cause isolation                                                       |
| `34597a2` | `apps/mobile/android/.../capture/CaptureSession.kt`                                                                                                                                                | Always-two-Surface CaptureSession + dynamic preview reissue (native attempt #1)                               |
| `cdcada9` | `apps/mobile/android/.../capture/CaptureSession.kt`                                                                                                                                                | Defer `onAddTarget`/`onRemoveTarget` Camera2 ops to `sessionHandler` (native attempt #2)                      |
| `eb70d33` | `apps/mobile/android/.../capture/CaptureSession.kt`                                                                                                                                                | 200 ms `postDelayed` before `updateOutputConfiguration` on re-attach (native attempt #3)                      |
| `82d2ff7` | `apps/mobile/src/screens/recording/RecordingScreen.tsx`                                                                                                                                            | **THE FIX** — JS-side keep-mounted; opacity toggle instead of mount/unmount                                   |
| `c35ac8f` | `apps/mobile/src/screens/recording/RecordingScreen.tsx`, i18n catalogs                                                                                                                             | Polish — tap-reveal timer rolls + bottom-right indicator + brand-orange + new i18n key                        |
| `45b5f52` | `apps/mobile/src/screens/recording/RecordingScreen.tsx`                                                                                                                                            | Polish — move indicators bottom-right → bottom-center                                                         |
| `b041d51` | `apps/mobile/src/screens/recording/RecordingScreen.tsx`                                                                                                                                            | Polish — nudge bottom-center up 5 px                                                                          |
| `c6af320` | `apps/mobile/src/lib/livePreviewState.ts`, `apps/mobile/__tests__/lib/livePreviewState.test.ts`, `apps/mobile/src/screens/recording/RecordingScreen.tsx`                                           | `__DEV_DISABLE_LIVE_PREVIEW__` flag for §9 A/B baseline (defaults `false` in product builds; `__DEV__`-gated) |

### Non-negotiable invariants honoured

- `HevcEncoder.kt`, `FinalizeWorker.kt`, `MetadataComposer.kt`,
  `MetadataSchemaConformance.kt`, `RealtimeGate.kt`, the calibration block:
  untouched. Verified via `git diff --stat 79bf7c7^..HEAD -- <those paths>`
  → empty.
- The ultrawide `CONTROL_ZOOM_RATIO` selection in `applyRecordingRequestSettings`
  is untouched.
- No iOS changes (`apps/mobile/ios/` is not in the diff; iOS native-modules
  remain deferred per §v2 IOS-01..07).
- No Drizzle migration changes.
- The Phase 6 cosmetic-gaps ledger is untouched.

### What it does NOT do

- Does not fix the pre-existing i18n sweep gaps G-02..G-10 (those are owned
  by plans 07-11 / 07-12 / 07-13).
- Does not fix COSMETIC-02 (top-right label/Stop overlap — addressed by
  commits `c35ac8f` / `45b5f52` / `b041d51`'s bottom-center move) or
  COSMETIC-03 (Eye glyph contrast — closed by the bottom-center indicator
  redesign).
- Does not address D-09 (SoundPool beep audibility) — deferred per the
  user-memory directive.

## §9 A/B drift outcome

**Verdict: PASS — the keep-mounted live preview is not measurably impacting
drift in normal product use.**

The `__DEV_DISABLE_LIVE_PREVIEW__` flag added in commit `c6af320` made the
classical A/B comparison possible after commit `82d2ff7` made the preview
Surface always-mounted during `'active'`. The operator walked the gate on
Pixel 10a `5C161JEA304304` (`apkRolloutDebug`, `b041d51` HEAD on Walk 1;
the flag flipped to `true` for Walk 2) — same-device, same-day, same-scene,
two walks back-to-back.

### Walk 1 — preview ON (`__DEV_DISABLE_LIVE_PREVIEW__ = false`) — 6 segments × ~10 min

| segment                      | dur_s | drift_max | drift_mean | drift_p99 | fps    | res       |
| ---------------------------- | ----- | --------- | ---------- | --------- | ------ | --------- |
| `01KSHGD1N1CHVFAGFV9SXY1MNV` | 600.7 | 5.762     | 5.355      | 5.422     | 29.858 | 1920×1080 |
| `01KSHGZCQHGS373NBYYJK5JQVP` | 600.6 | 0.838     | 0.439      | 0.635     | 29.858 | 1920×1080 |
| `01KSHHHQRPH5WKQ5QVFZQ7SYG4` | 600.6 | 2.961     | 2.237      | 2.609     | 29.858 | 1920×1080 |
| `01KSHJ42S1GY5C6ZHWJA12DKJH` | 600.7 | 4.103     | 3.395      | 3.661     | 29.858 | 1920×1080 |
| `01KSHJPDVJMYHN36WDWFFS78WM` | 600.6 | 3.375     | 2.993      | 3.215     | 29.858 | 1920×1080 |
| `01KSHK8RWZ9Z68BWJBZQ1WA3FA` | 595.7 | 4.425     | 1.759      | 2.208     | 29.858 | 1920×1080 |
| **AVG**                      |       | **3.577** | **2.696**  | **2.958** |        |           |
| worst-segment                |       | 5.762     |            | 5.422     |        |           |

### Walk 2 — preview OFF (`__DEV_DISABLE_LIVE_PREVIEW__ = true`) — 8 segments × ~10 min

| segment                      | dur_s | drift_max | drift_mean | drift_p99 | fps    | res       |
| ---------------------------- | ----- | --------- | ---------- | --------- | ------ | --------- |
| `01KSHN0JD07WRKRVRAKWY7HXA0` | 601.0 | 1.793     | 1.693      | 1.727     | 29.846 | 1920×1080 |
| `01KSHNJXT4MDY45G0SWFY8K174` | 601.0 | 5.025     | 4.877      | 4.924     | 29.858 | 1920×1080 |
| `01KSHP59975R5RPG8H9ERPYDJH` | 601.0 | 3.218     | 3.015      | 3.119     | 29.883 | 1920×1080 |
| `01KSHPQMNMC9DEX3M56JPK3FAT` | 600.9 | 3.490     | 2.992      | 3.129     | 29.883 | 1920×1080 |
| `01KSHQA011E149H9APN1YF0M17` | 601.0 | 2.353     | 2.260      | 2.277     | 29.883 | 1920×1080 |
| `01KSHQWBEYGR97GTB0ABGDWQQ0` | 600.9 | 2.622     | 2.523      | 2.565     | 29.883 | 1920×1080 |
| `01KSHREPR2ZFRKWMRWVRH8JS0N` | 600.7 | 3.082     | 2.965      | 3.009     | 29.858 | 1920×1080 |
| `01KSHS11XD5PDG4CDR98250GSN` | 574.2 | 2.285     | 1.919      | 2.060     | 29.883 | 1920×1080 |
| **AVG**                      |       | **2.984** | **2.781**  | **2.851** |        |           |
| worst-segment                |       | 5.025     |            | 4.924     |        |           |

### §9 A/B comparison (averages across segments)

| metric       | ON (avg) | OFF (avg) | Δ (ON−OFF) | Δ %    |
| ------------ | -------- | --------- | ---------- | ------ |
| `drift_max`  | 3.577 ms | 2.984 ms  | +0.594 ms  | +19.9% |
| `drift_mean` | 2.696 ms | 2.781 ms  | −0.085 ms  | −3.0%  |
| `drift_p99`  | 2.958 ms | 2.851 ms  | +0.107 ms  | +3.8%  |

### Verdict (verbatim)

The keep-mounted live preview is **not measurably impacting drift in normal
product use**. Δp99 of +0.107 ms (+3.8%) is well within the segment-to-segment
noise floor — Walk 1's p99 ranged 0.635–5.422 ms across its 6 segments alone
(8.5× variation), so a 3.8% delta between the walks' averages is statistically
indistinguishable. Mean drift was actually marginally lower with preview ON
(−3.0%). All 14 segments stayed above the 29 fps cancel gate and within the
CLAUDE.md-cited relaxed envelope (1.7–6.2 ms typical post-ultrawide). 1920×1080
locked across all 14 segments.

Plan-07-07's Option-B two-Surface CaptureSession decision is **ratified** by
this hardware A/B. The classical D-04 gate (Δ < 0.50, i.e. < 50%) is not just
PASS but PASS-with-huge-margin (3.8% << 50%). No Option-A contingent revert
required.

## Files changed

```
.planning/debug/07-live-preview-broken-pipe.md                                                   (this journal)
.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md                            (§7/§8/§9 PASS rows)
apps/mobile/__tests__/lib/livePreviewState.test.ts                                               (__DEV_DISABLE_LIVE_PREVIEW__ pins)
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt             (instrumentation + native scaffolding)
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt (instrumentation)
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt   (instrumentation)
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt (instrumentation)
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt (instrumentation + onAddTarget/onRemoveTarget wiring)
apps/mobile/src/lib/livePreviewState.ts                                                          (__DEV_DISABLE_LIVE_PREVIEW__ flag)
apps/mobile/src/screens/recording/RecordingScreen.tsx                                            (THE FIX — keep-mounted + opacity toggle + indicator polish)
```

**Resolved 2026-05-26.** Moved to `.planning/debug/resolved/`.
