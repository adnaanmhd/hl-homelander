---
phase: 07-multi-linguality-live-cam-feed
plan: 07
subsystem: recording
tags: [recording, camera2, native, live-preview, surface, drift, android, brightness, react-native]

# Dependency graph
requires:
  - phase: 07-multi-linguality-live-cam-feed
    plan: 01
    provides: 'i18n runtime + `t("recording.preview.live")` translation key (live preview label, D-26)'
  - phase: 07-multi-linguality-live-cam-feed
    plan: 05
    provides: "RecordingScreen.tsx useTranslation() call sites — preserved unchanged on top of this plan's brightness state-machine wiring"
  - phase: 07-multi-linguality-live-cam-feed
    plan: 06
    provides: 'pickAndSetLocaleVoice() in the RecordingScreen mount effect — preserved'
  - phase: 04-handdetector-recording-ux-practice-tutorial
    plan: 09
    provides: 'HumynScreenBrightness.set(-1) / set(0.05) wrapper + the existing line 267/387/734/867 restorers (REC-LIVE-15 — no new native brightness API)'
  - phase: 03-humyn-capture-native-module
    plan: 10
    provides: 'CaptureSession.openCaptureSession single-Surface createCaptureSession baseline (we extend to Option B two-Surface here without regressing the encoder/muxer pump-loop invariants)'

provides:
  - 'HumynLivePreviewView (native Camera2 TextureView + ViewManager + Module + Package) — single-purpose RN view publishing a Surface to LivePreviewSurfaceRegistry (D-25; no camera client of its own)'
  - 'LivePreviewSurfaceRegistry — singleton Surface slot + onAddTarget/onRemoveTarget hooks consumed by CaptureSession.openCaptureSession at session-config time (Option B leading)'
  - 'CaptureSession Option B two-Surface flow — encoder + preview targets at createCaptureSession when registry slot non-null; in-session setRepeatingRequest rebuild via onAddTarget/onRemoveTarget toggle (NEVER mid-record session reconfigure — Option C rejected)'
  - 'applyRecordingRequestSettings helper — extracted zoom/AF/OIS/ultrawide setup so rebuild path emits identical settings (LOCKED per CLAUDE.md ultrawide banner)'
  - 'createLivePreviewStateMachine — pure 3-state brightness state machine (initial-preview 15s / dimmed / tap-revealed rolling 10s) per REC-LIVE-01..04 / D-05 / D-28 / D-29'
  - 'useLivePreviewStateMachine — thin React hook wrapper for RecordingScreen consumption'
  - 'RecordingScreen z-stack: live-preview view + Pressable tap-zone + Lucide Eye corner glyph + translated "Live preview" label; Stop button last-in-JSX wins hit-test in all 3 visible states (T-07-07-06)'

affects:
  - 07-08-renumber-sweep-and-manual-smoke (the smoke runbook §9 walks the same-device same-day A/B drift comparison — Pixel 10a baseline preview-OFF vs treatment preview-ON; D-04 gate `(p99_on − p99_off) / p99_off < 0.50` — if it trips, this plan reverts CaptureSession Option B to Option A or escalates to the owner)

# Tech tracking
tech-stack:
  added:
    - 'lucide-react-native Eye icon (via existing Icon primitive — already a deps pin in CLAUDE.md)'
  patterns:
    - 'Single-purpose native quad (Module + Package + View + ViewManager) — mirrors HumynGateCamera / HumynPlayer / HumynCapture per D-25; the live-preview quad ADDS the no-camera-client invariant (it owns no Camera2 device of its own — only a Surface published to the registry)'
    - 'Singleton Surface-publishing registry — LivePreviewSurfaceRegistry holds one @Volatile slot + two optional callbacks; defense-in-depth `slot === s` guard in onSurfaceDestroyed (T-07-07-04 stale-callback after re-mount)'
    - 'In-session setRepeatingRequest rebuild for preview target toggle — Camera2 outputs are FIXED at createCaptureSession (Option B), the rebuild only changes which targets the running CaptureRequest addresses (no HAL reconfigure stalls; rejects Option C)'
    - 'Pure state machine + thin React hook split — `createLivePreviewStateMachine` is dependency-injected (brightness, scheduler) so it tests with vi.useFakeTimers; the React `useLivePreviewStateMachine` is the wiring layer for production HumynScreenBrightness + globalThis.setTimeout'
    - 'Robolectric ShadowSurface for JVM unit tests of the registry — `Shadow.newInstanceOf(Surface::class.java)` mirrors the `ShadowCameraCharacteristics.newCameraCharacteristics()` seam used by RealtimeGateTest'

key-files:
  created:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewPackage.kt'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt'
    - 'apps/mobile/src/native/HumynLivePreviewView.tsx'
    - 'apps/mobile/src/lib/livePreviewState.ts (pure factory + React hook)'
    - 'apps/mobile/__tests__/lib/livePreviewState.test.ts (8 cases)'
    - 'apps/mobile/__tests__/screens/recording/livePreview.test.tsx (5 cases)'
    - 'apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt (6 Robolectric cases)'
  modified:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (HumynLivePreviewPackage registration + import)'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt (Option B two-Surface flow + applyRecordingRequestSettings helper + registry callback wiring + null-on-close)'
    - 'apps/mobile/src/screens/recording/RecordingScreen.tsx (useLivePreviewStateMachine hook + JSX z-stack + new styles)'
    - 'apps/mobile/__tests__/visual/__image_snapshots__/recording-active-t10s.png (regenerated — live-preview label corner now part of active chrome)'
    - 'apps/mobile/__tests__/visual/__image_snapshots__/recording-active-t05m32s.png (regenerated — same)'

key-decisions:
  - "Option B (two-Surface CaptureSession) chosen and shipped end-to-end. The 3-option A/B comparison in PLAN.md ratifies this is the leading hypothesis (lowest implementation cost, no GL/thread plumbing, no HAL reconfigure stalls) AND that the actual on-hardware A/B drift walk lives in plan 07-08 §9 — the BLOCKING D-04 gate `(p99_on − p99_off) / p99_off < 0.50`. If 07-08's walk trips the gate, this plan's CaptureSession diff must be revised to Option A or escalated to the owner."
  - 'Encoder Surface is ALWAYS a target across the whole session — preview Surface added at session config when registry slot is non-null, toggled in-session via setRepeatingRequest rebuild. NEVER mid-record createCaptureSession reconfigure (Option C — rejected because the ~100-400ms HAL stall would trip FinalizeWorker''s `mean_fps < 29` cancel gate per CLAUDE.md "Capture-quality cancel gate added 2026-05-17" banner).'
  - 'Pure state machine module split from React hook — `createLivePreviewStateMachine` (no React imports) is the unit-testable surface (REC-LIVE-01..04 converted from "manual-only" to "unit-tested + manual-verified" per 07-VALIDATION.md). The thin `useLivePreviewStateMachine` hook adapts to HumynScreenBrightness + globalThis.setTimeout for production.'
  - 'Sentinel `slot === s` guard in LivePreviewSurfaceRegistry.onSurfaceDestroyed (defense-in-depth, T-07-07-04) — if a re-mount race delivers a stale Surface destroy callback AFTER a new view has already published its Surface, the stale callback must NOT clear the newer slot. The Robolectric unit suite pins this with a paired `sOld` / `sNew` scenario.'
  - "Extracted `applyRecordingRequestSettings` helper from `openCaptureSession`'s inline zoom/AF/OIS code — the in-session setRepeatingRequest rebuild path MUST emit identical settings (CLAUDE.md ultrawide banner — the LOCKED ≥110° dFOV recording path depends on CONTROL_ZOOM_RATIO sub-1.0 + AF off + LENS_FOCUS_DISTANCE 0.0f staying applied across rebuilds). Helper guarantees no drift."
  - 'Use the existing `Icon name="Eye"` primitive (lucide-react-native Eye) — not a direct `import { Eye } from "lucide-react-native"`. Matches the pattern every other RecordingScreen icon (X / RotatePrompt) uses; centralized stroke width + color.'

patterns-established:
  - 'Two-Surface Camera2 session — the encoder Surface is the unconditional target; the preview Surface is conditionally a target via in-session setRepeatingRequest rebuild. The session output set is fixed at createCaptureSession (no HAL reconfigure mid-record). Future preview / overlay surfaces in Phase 8+ should follow the same shape.'
  - 'Single-purpose RN native view that does NOT own a camera — `<HumynLivePreviewView>` is purely a Surface publisher; the recording session owns the camera. Decouples view lifecycle from camera lifecycle. Future overlays (e.g. live IMU debug view) should follow the same pattern.'
  - 'Pure-state-machine + thin-hook split — `createXxxStateMachine` (factory, dependency-injected) lives in `src/lib/`; `useXxxStateMachine` React hook in the same file is the production wiring layer. Tests instantiate the factory directly with `vi.useFakeTimers`. Future timer-driven UI state (e.g. battery-alert dismissal timing) should follow.'

requirements-completed:
  [REC-LIVE-01, REC-LIVE-02, REC-LIVE-03, REC-LIVE-04, REC-LIVE-05, REC-LIVE-06, REC-LIVE-07]

# Metrics
duration: ~28min
completed: 2026-05-25
---

# Phase 7 Plan 07: Live-Cam Preview Native Module + RecordingScreen Wiring Summary

**Native `<HumynLivePreviewView>` quad (no camera client of its own) + `LivePreviewSurfaceRegistry` singleton consumed by CaptureSession's Option B two-Surface flow + pure `createLivePreviewStateMachine` (3-state brightness machine, 15-s initial preview / dimmed / rolling 10-s tap-reveal) wired into RecordingScreen via a thin React hook + JSX z-stack (Live preview label, Eye icon, tap-to-reveal Pressable; Stop button stays hit-testable in all 3 states). Encoder Surface always a target — drift telemetry + FinalizeWorker capture-quality cancel gates UNCHANGED (REC-LIVE-07 invariant verified).**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-05-24T18:07:32Z
- **Completed:** 2026-05-25T00:01:30Z (wall-clock includes the 6m 18s APK assemble for the operator checkpoint)
- **Tasks:** 2 implementation tasks committed + 1 operator checkpoint pending
- **Files modified:** 10 new + 4 modified

## Accomplishments

- Native live-preview quad (View + ViewManager + Module + Package) + Surface registry singleton shipped — 5 new Kotlin files under `ai.humynlabs.capture.livepreview/`.
- `<HumynLivePreviewView>` JS bridge + `isLivePreviewAvailable()` discriminant + `isLivePreviewSurfacePublished()` async query.
- `CaptureSession.openCaptureSession` extended to Option B: snapshots `LivePreviewSurfaceRegistry.currentSurface()` at session-config time, passes `[encoder, preview]` or `[encoder]` to `createCaptureSession`, wires `onAddTarget`/`onRemoveTarget` callbacks for the in-session `setRepeatingRequest` rebuild. `applyRecordingRequestSettings` helper extracted so rebuilds emit identical zoom/AF/OIS settings.
- Pure `createLivePreviewStateMachine` factory — 3 states, dependency-injected brightness + scheduler. Eight unit-test cases pin REC-LIVE-01..04 / D-05 / D-29 invariants (no `expect(true).toBe(true)` skeletons).
- `useLivePreviewStateMachine` React hook + RecordingScreen JSX wiring: live-preview view mounted during 'initial-preview' + 'tap-revealed' states, Lucide `Eye` corner glyph + tap-to-reveal Pressable in 'dimmed', translated `"Live preview"` corner label.
- Robolectric `CaptureSessionLivePreviewTest` — 6 cases covering registry shape, slot===s defense-in-depth, callback settability.
- Visual snapshots `recording-active-t10s.png` + `recording-active-t05m32s.png` regenerated to reflect the new "Live preview" corner chrome.
- 918/918 mobile JS tests green; all `ai.humynlabs.capture.capture.*` Kotlin tests green (including the REC-LIVE-07 invariant tests: FinalizeWorker / MetadataComposer / HevcEncoder / RealtimeGate).
- APK build: `:app:assembleApkRolloutDebug` BUILD SUCCESSFUL (6m 18s).

## Task Commits

Each task was committed atomically:

1. **Task 1: Native HumynLivePreview quad + Surface registry + MainApplication wireup + RN bridge** — `a4d4a1c` (feat)
2. **Task 2: CaptureSession Option B + livePreviewState.ts + RecordingScreen wiring + tests** — `808f7ec` (feat)
3. **Task 3: Operator checkpoint** — pending; see "Pending Operator Checkpoint" below.

## Files Created/Modified

**New (10):**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt` — TextureView publishing Surface to registry (verbatim transform from `HumynGateCameraView`; no Camera2 client of its own — D-25).
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt` — SimpleViewManager registering under "HumynLivePreviewView" with the `@ReactProp("previewActive")` no-op workaround (Phase-4 04-COSMETIC-GAPS pattern).
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt` — minimal `isAvailable(promise)` for the JS discriminant.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewPackage.kt` — `ReactPackage` registering module + view manager.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt` — singleton `@Volatile slot: Surface?` + `onAddTarget`/`onRemoveTarget` callbacks + `currentSurface()`/`onSurfaceAvailable`/`onSurfaceDestroyed`.
- `apps/mobile/src/native/HumynLivePreviewView.tsx` — JS bridge with `requireNativeComponent` + `isLivePreviewAvailable()` sync + `isLivePreviewSurfacePublished()` async.
- `apps/mobile/src/lib/livePreviewState.ts` — pure state machine factory + React hook wrapper. Constants `INITIAL_PREVIEW_MS = 15_000` + `TAP_REVEAL_MS = 10_000`.
- `apps/mobile/__tests__/lib/livePreviewState.test.ts` — 8 unit cases.
- `apps/mobile/__tests__/screens/recording/livePreview.test.tsx` — 5 JS bridge cases.
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt` — 6 Robolectric cases.

**Modified (4):**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` — added `HumynLivePreviewPackage` import + `packages.add(HumynLivePreviewPackage())` line after `HumynGateCameraPackage`.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` — Option B two-Surface flow in `openCaptureSession`; `applyRecordingRequestSettings` helper extracted; registry callbacks wired in `onConfigured` + nulled in `closeSegmentResources` BEFORE session close.
- `apps/mobile/src/screens/recording/RecordingScreen.tsx` — new imports (`HumynLivePreviewView` / `isLivePreviewAvailable` / `useLivePreviewStateMachine`); hook call with `captureStartedAt` derived from `state.startedAt` during 'active' substate; JSX z-stack additions (preview view, Pressable, Eye, label); 3 new style entries (`liveEyeCorner` / `liveLabelCorner` / `liveLabelText`). 07-05 `useTranslation` + 07-06 `pickAndSetLocaleVoice` preserved.
- `apps/mobile/__tests__/visual/__image_snapshots__/recording-active-t10s.png` + `recording-active-t05m32s.png` — regenerated; the new "Live preview" corner label is part of the active-state chrome.

## Decisions Made

- **Option B selected and shipped end-to-end** (per plan's PLAN.md A/B comparison). Implementation cost ~30 LOC; no GL/thread plumbing; no HAL reconfigure stalls. The on-hardware A/B drift walk in plan 07-08 §9 is the BLOCKING D-04 gate (`(p99_on − p99_off) / p99_off < 0.50`). If 07-08 trips the gate, revert this plan's CaptureSession diff to Option A or escalate.
- **Encoder Surface ALWAYS a target across the whole session.** Preview Surface conditionally added at config; in-session `setRepeatingRequest` rebuild via registry callbacks toggles it. NEVER mid-record `createCaptureSession` reconfigure (Option C rejected — would trip the `mean_fps < 29` cancel gate per CLAUDE.md 2026-05-17 banner).
- **Pure state machine + thin React hook split.** Enables `vi.useFakeTimers()` coverage of REC-LIVE-01..04 / D-29 invariants without a render context — converts those requirements from "manual-only" to "unit-tested + manual-verified".
- **`applyRecordingRequestSettings` helper extracted.** The in-session rebuild path MUST emit identical zoom/AF/OIS settings — CLAUDE.md ultrawide banner / LOCKED ≥110° dFOV recording depends on this. Helper guarantees no drift across rebuilds.
- **Sentinel `slot === s` guard in `onSurfaceDestroyed` (defense-in-depth, T-07-07-04).** Stale destroy callback from an old view after a re-mount must NOT clear the new view's slot.
- **Use the existing `Icon name="Eye"` primitive** instead of a direct `lucide-react-native` import. Matches every other RecordingScreen icon (X / RotatePrompt) and centralizes stroke width + color.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test file paths relocated from `src/...../__tests__/` to top-level `__tests__/` to match vitest discovery pattern**

- **Found during:** Task 2 (writing the JS test files).
- **Issue:** The plan nominally placed the unit tests at `apps/mobile/src/lib/__tests__/livePreviewState.test.ts` and `apps/mobile/src/screens/recording/__tests__/livePreview.test.tsx`. The repo's `apps/mobile/vitest.config.ts` `include` glob is `__tests__/**/*.test.{ts,tsx}` (verified at line 20). Tests under `src/.../__tests__/` are NOT discovered — would silently produce zero coverage. Project convention (every existing JS test) lives under top-level `apps/mobile/__tests__/`.
- **Fix:** Placed the new tests at `apps/mobile/__tests__/lib/livePreviewState.test.ts` and `apps/mobile/__tests__/screens/recording/livePreview.test.tsx`, mirroring the layout of `__tests__/lib/buildCaptureOpts.test.ts` and `__tests__/screens/recording/RecordingScreen.test.tsx`. Adjusted import paths to `'../../src/lib/livePreviewState'` etc. accordingly. Documented the deviation in each test file's docblock.
- **Files modified:** `apps/mobile/__tests__/lib/livePreviewState.test.ts` (new), `apps/mobile/__tests__/screens/recording/livePreview.test.tsx` (new).
- **Verification:** `npx vitest run` discovers both files; 13/13 cases green; 918/918 total mobile JS tests green.
- **Committed in:** `808f7ec` (Task 2).

**2. [Rule 1 — Bug] Visual snapshots for `recording-active-t10s` + `recording-active-t05m32s` regenerated to reflect the new "Live preview" corner label chrome**

- **Found during:** Task 2 verification — `npx vitest run` reported 2 snapshot failures (~6% pixel diff each).
- **Issue:** The active-substate visual baselines were captured before this plan added the live-preview corner label. The plan adds new chrome (the translated "Live preview" pill) to the active state by design — the baselines correctly fail until updated.
- **Fix:** `npx vitest run --update` regenerated the two baselines. No other snapshot changed.
- **Files modified:** `apps/mobile/__tests__/visual/__image_snapshots__/recording-active-t10s.png`, `apps/mobile/__tests__/visual/__image_snapshots__/recording-active-t05m32s.png`.
- **Verification:** Re-ran the full suite — 918/918 green, 0 snapshot diffs.
- **Committed in:** `808f7ec` (Task 2).

**3. [Rule 3 — Blocking] `kotlin.test.assert*` imports swapped to `org.junit.Assert.*` to match project convention**

- **Found during:** Task 2 — first run of `:app:testApkRolloutDebugUnitTest --tests CaptureSessionLivePreviewTest` reported `Unresolved reference 'assertNull'`.
- **Issue:** `kotlin.test.*` is not on the project's test classpath; every existing `ai.humynlabs.capture.capture.*` test uses `org.junit.Assert.assertEquals` / `assertNull` / `assertSame` etc.
- **Fix:** Replaced the three `kotlin.test.*` imports with the JUnit equivalents + swapped `check { ... }` blocks to `assertEquals` calls.
- **Files modified:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt`.
- **Verification:** `:app:testApkRolloutDebugUnitTest --tests "CaptureSessionLivePreviewTest"` — BUILD SUCCESSFUL, 6/6 cases green.
- **Committed in:** `808f7ec` (Task 2).

**4. [Rule 3 — Blocking] `apps/mobile/android/app/src/main/google-services.json` + `app/src/apkRollout/google-services.json` + `app/local.properties` + `apps/mobile/.env.apkRollout` + `apps/mobile/.env.playStore` copied from the main worktree into this agent worktree**

- **Found during:** Task 1 verification — first attempt at `./gradlew :app:compileApkRolloutDebugKotlin` failed with "Missing .env file" and "SDK location not found".
- **Issue:** This Claude Code worktree was spawned without the gitignored config files needed to build the APK / run gradle tests. They live in the main repo but aren't tracked.
- **Fix:** Copied the four files from the main repo into the worktree. JDK 17 (Zulu equivalent — installed Temurin 17.0.19) selected via `JAVA_HOME=$(/usr/libexec/java_home -v 17)` per CLAUDE.md "Build tools" pin (the host's default `java` is JDK 26, which gradle 8.13 + RN gradle-plugin reject).
- **Files modified:** None tracked — all gitignored.
- **Verification:** `./gradlew :app:compileApkRolloutDebugKotlin` and `:app:assembleApkRolloutDebug` BUILD SUCCESSFUL.
- **Committed in:** Not committed (the copied files are gitignored).

---

**Total deviations:** 4 auto-fixed (1 Rule 1 — snapshot regen necessary because the plan adds new chrome; 3 Rule 3 — blocking infra issues, no scope creep).
**Impact on plan:** No semantic deviations. Test paths, assertion library, and visual baselines all follow established project conventions; the worktree config copy is a one-time gradle-env enablement.

## Pending Operator Checkpoint

The plan's Task 3 is `checkpoint:human-verify` — 10 visual checks on a Pixel 10a after the APK is installed. Per the checkpoint protocol the implementation tasks are complete; only the operator-driven hardware verification remains.

**APK ready at:** `apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`

**Operator runbook (verbatim from PLAN §`<how-to-verify>`):**

1. `adb install -r apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`
2. Sign in → Tasks → "Make tea" (or any task) → Record.
3. Pass the hand gate (or tap Skip).
4. **Visual check #1 (REC-LIVE-01):** Live ultrawide camera feed full-screen for ~15 s after the recording UI opens.
5. **Visual check #2 (D-05 practice gate):** If launched from the practice tutorial, the centered task-name practice copy must NOT be visible during the 15 s preview.
6. **Visual check #3 (REC-LIVE-01 fade):** After ~15 s, fades to dimmed (low brightness, black background, task name centered, Stop button visible). Small Lucide `Eye` icon in bottom-right.
7. **Visual check #4 (REC-LIVE-02):** Tap anywhere on the dimmed surface (NOT the Stop button). Preview reappears at system brightness for 10 s.
8. **Visual check #5 (REC-LIVE-02 rolling):** Tap again within the 10-s window — extends another 10 s. Tap a third time at ~8 s — extends to ~10 s again.
9. **Visual check #6 (Stop hit-testable in all 3 states):** Tap Stop during initial-preview, dimmed, and tap-revealed. All three should stop the recording.
10. **Translated label check (D-26):** With a non-English locale (Profile picker), the "Live preview" label should be translated.

**Resume signal:** Type "approved" if all 10 visual checks pass; otherwise describe the failing check.

**A/B drift smoke walk (plan 07-08 §9) is the BLOCKING follow-on** — does NOT block this plan's `done`, but DOES block Phase 7 sign-off. If `(p99_on − p99_off) / p99_off >= 0.50` on Pixel 10a, this plan's CaptureSession.kt diff must be revised to Option A (Surface splitter via GL) or escalated.

## Issues Encountered

- Pre-existing `EncoderProbeTest` failure in the worktree: `ai.humynlabs.capture.compat.EncoderProbeTest` throws `java.lang.NullPointerException` at `com.facebook.soloader.ApplicationSoSource.getNativeLibDirFromContext` during the Robolectric test bootstrap. Reproduces on the main repo too (`cd /Users/adnaan/Documents/hl-homelander && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.compat.EncoderProbeTest"` — same failure). Out of scope for this plan; logged in `deferred-items.md` per the executor scope-boundary rule. All `ai.humynlabs.capture.capture.*` tests (including the REC-LIVE-07 invariant tests this plan must preserve: FinalizeWorker / MetadataComposer / MetadataSchemaConformance / HevcEncoderConfig / RealtimeGate) PASS.

## Threat Flags

None — no new network endpoints, no new auth paths, no schema changes at trust boundaries. The live-preview Surface is on-device-only and consumed by the existing recording Camera2 session (same trust boundary as the encoder Surface). T-07-07-01..06 in the plan's `<threat_model>` are addressed by the implementation:

- T-07-07-01 (two-Surface fps regression) — mitigated by plan 07-08 §9 drift A/B gate.
- T-07-07-02 (mid-record reconfigure DoS) — accepted; this plan does NOT reconfigure mid-record.
- T-07-07-03 (preview frame leak to screen-recording attacker) — accepted; standard Android security model.
- T-07-07-04 (stale Surface reference) — mitigated by the `slot === s` guard + dual clearing (`onSurfaceTextureDestroyed` + `onDropViewInstance`); pinned by the registry's `non-matching Surface does NOT clear the slot` JVM test.
- T-07-07-05 (tap-spam timer flood) — mitigated by the pure machine's `clearTimer()` on every transition; pinned by the `rolling not accumulating` unit case.
- T-07-07-06 (Stop button hit-test loss) — mitigated by last-in-JSX Stop rendering; the body View containing Stop comes AFTER the live-preview overlay layers.

## Self-Check: PASSED

- All 10 new files exist:
  - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/{HumynLivePreviewView,HumynLivePreviewViewManager,HumynLivePreviewModule,HumynLivePreviewPackage,LivePreviewSurfaceRegistry}.kt` — FOUND.
  - `apps/mobile/src/native/HumynLivePreviewView.tsx` — FOUND.
  - `apps/mobile/src/lib/livePreviewState.ts` — FOUND.
  - `apps/mobile/__tests__/lib/livePreviewState.test.ts` — FOUND.
  - `apps/mobile/__tests__/screens/recording/livePreview.test.tsx` — FOUND.
  - `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt` — FOUND.
- Commits exist:
  - `a4d4a1c` — FOUND.
  - `808f7ec` — FOUND.

---

_Phase: 07-multi-linguality-live-cam-feed_
_Completed: 2026-05-25 (implementation; operator checkpoint pending)_
