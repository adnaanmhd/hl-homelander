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

{operator pastes the contents of `/tmp/07-10-logcat.txt` here}

## Conclusion

{filled in by Task 2 once the operator's logcat capture is in hand. The
expected shape: name H1 / H2 / H3 (or a refinement) AND file:line of the
surgical fix.}

## Fix applied

{Task 2 documents the surgical fix here — diff summary + the rebuild
verification + the 6-visual-check re-walk outcome.}

## §9 A/B drift outcome

{Task 3 fills this in — `p99_OFF`, `p99_ON`, `delta`, PASS/MARGINAL/FAIL
verdict. If FAIL → Option-A revert outcome + the second-pass §9 verdict.}

## Files changed

{Task 2 / Task 3 fill this in at resolution time.}
