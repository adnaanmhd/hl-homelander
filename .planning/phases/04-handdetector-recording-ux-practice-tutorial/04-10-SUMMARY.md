---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 10
subsystem: capture
tags:
  [
    react-native,
    react-native-firebase,
    kotlin,
    react-native-event-emitter,
    crash-recovery,
    toast,
    vitest,
    robolectric,
    smoke-runbook,
  ]

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module
    provides: CaptureLaunchSweep app-launch orphan sweep (D-FS-04 — re-finalize-candidate logging off the .session.json sidecars); HumynCaptureModule emitEvent() RCTDeviceEventEmitter idiom; the 5 existing on*(listener): EmitterSubscription helpers in HumynCapture.ts
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-09)
    provides: RecordingScreen.tsx live surface with the SETTLE_MS=80 camera-handoff tunable (the knob the [BLOCKING] §5b drift re-measurement targets); the local recording-surface toast (unchanged)
  - phase: 02 (plan 02-20)
    provides: SoftUpgradeBanner.tsx — the closest transient-notification surface (Toast is a sibling pattern)
provides:
  - "HumynCapture.ts — 6th event helper onCrashRecovery(listener: (e: { recovered: string[] }) => void): EmitterSubscription (mirrors the 5 existing helpers; caller MUST .remove()); CrashRecoveryEvent type added to HumynCapture.types.ts + re-exported"
  - "src/components/Toast.tsx (NET-NEW — the first transient-toast primitive) — module-level showToast(text, durationMs?=2000) / hideToast() + a <ToastHost /> pill (colors.toastBg, white-ish text, useSyncExternalStore subscriber list, auto-fade keyed on a monotonic seq so a rapid second toast cancels the prior fade); DEFAULT_TOAST_MS exported; accessibilityLabel='toast'; mounted in App.tsx as a NavigationContainer sibling"
  - "src/boot/bootRecoveryListener.ts (NET-NEW) — installBootRecoveryListener(): () => void — one-shot at app boot: subscribes to HumynCapture.onCrashRecovery, validates recovered is string[] (Array.isArray + length>0 + every typeof === 'string'), showToast('Recording recovered after force-quit — uploading.'), then sub.remove() (one-shot per launch); wrapped in try/catch (swallows when the native module isn't registered — JSDOM / a build without it); CRASH_RECOVERY_TOAST exported; mounted in App.tsx after hydrate()"
  - "CaptureLaunchSweep.kt — run() now RETURNS List<String> of the orphan-with-valid-sidecar bases (re-finalize candidates); existing sweep semantics unchanged; companion `@Volatile @JvmStatic var pendingRecovery: List<String>?` process-singleton holder"
  - "MainApplication.kt — onCreate stashes CaptureLaunchSweep.pendingRecovery = CaptureLaunchSweep(filesDir).run()"
  - "HumynCaptureModule.kt — now implements LifecycleEventListener (registered in init {}); onHostResume drains CaptureLaunchSweep.pendingRecovery once (crashRecoveryEmitted guard) and emits onCrashRecovery({recovered}) via emitEvent — `// Phase 4 D-LIFE-04` annotated"
  - ".planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md (NET-NEW) — the on-hardware Phase-4 acceptance runbook (D-WAVE-04): §1 pre-flight, §2 practice E2E, §3 non-practice via the __DEV__ affordance (silent 10-min auto-segment cut + spec-compliance + IMU ≥100Hz + FGS type/KEEP_SCREEN_ON + on-disk SHA + session events — Phase-3 UAT #1/#2/#5/#6/#7 retire), §4 idea-brief §10 lifecycle edges (incl. force-quit → recover-toast + sidecar re-finalize), §5 thermal injection (UAT #4 retires), §5b [BLOCKING] ±1ms drift re-measurement on the gate→record handoff (UAT #3 retires; remedy = bump SETTLE_MS / escalate a Phase-3 camera-availability-poll change; audio stays out), §6 sign-off + re-walked-on, §7 D-WAVE-09 amendments protocol"
  - "tests: __tests__/components/Toast.test.tsx (6 — render/showToast/auto-hide/custom-duration/supersede/hideToast), __tests__/screens/recording/crashRecoveryToast.test.tsx (6 — subscribe→toast+remove one-shot / second-fire-no-toast / non-array-rejected / empty-list-no-toast-but-removes / non-string-in-list rejected / swallows-throw-when-unregistered), + 4 new CaptureLaunchSweepTest.kt cases (run()-return contract for valid-sidecar / corrupt-or-no-sidecar / multiple orphans / pendingRecovery holder round-trip)"
affects:
  [
    Phase 5 (HumynUpload — the recovered orphan triples land in files/recordings/ via the sidecar and Phase 5's upload path picks them up; bootRecoveryListener is only the user-facing toast; new screens can now showToast(...)),
    Phase 6 (the recovered recording arrives in History — the user sees it there),
    "Phase 4 verify (the on-hardware smoke walk — 04-MANUAL-SMOKE.md — is the D-WAVE-04 acceptance gate; the [BLOCKING] §5b drift re-measurement must pass before Phase 4 closes; Phase 3's 7 hardware-UAT items retire here)",
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "src/components/Toast.tsx — the canonical app-wide transient-toast primitive: a module-level imperative API (showToast/hideToast) + a useSyncExternalStore-backed <ToastHost /> pill mounted at the navigation root; auto-fade keyed on a monotonic `seq` so a rapid second showToast cancels the prior fade-out (no premature clear). Any non-recording surface that needs a transient toast routes through showToast (the RecordingScreen's own dark-surface toast, plan 04-09, stays local)."
    - "Deferred native→JS event emission for a boot-time one-shot — a sweep that runs in MainApplication.onCreate (before the catalyst instance attaches) stashes its result in a `@Volatile @JvmStatic` companion holder; the TurboModule (a LifecycleEventListener) drains the holder on first onHostResume (by then the JS bundle is up + the listener has subscribed) and emits the event. Mirrors how RN's own linking / push-notification modules replay a pending event. The on-device emit path (Arguments.createMap / RCTDeviceEventEmitter) can't be exercised under Robolectric (JNI HybridData clinit fails) — covered by 04-MANUAL-SMOKE.md §4(e)."
    - "bootRecoveryListener — the one-shot-at-boot pattern: subscribe once in App.tsx after hydrate(), .remove() the subscription after the first fire, wrap the whole subscribe in try/catch so a missing native module never crashes boot. Validate the cross-boundary payload shape (Array.isArray + every typeof) before acting on it — don't trust the payload blindly even across an app-internal boundary (Security)."
    - "04-MANUAL-SMOKE.md structure mirrors 03-MANUAL-SMOKE.md / 02-21 — numbered checkbox sections with per-step Inputs/Assertions + adb commands inline + a Pre-flight + Sign-off bookend + per-section Acceptance criteria + the D-WAVE-09 amendments protocol pointing new cosmetic gaps at the phase's own 04-COSMETIC-GAPS.md (never the frozen earlier files). The [BLOCKING] §5b drift gate carries an explicit remedy ladder (bump SETTLE_MS → escalate a Phase-3 camera-availability-poll change → never re-introduce audio)."

key-files:
  created:
    - apps/mobile/src/components/Toast.tsx
    - apps/mobile/src/boot/bootRecoveryListener.ts
    - apps/mobile/__tests__/components/Toast.test.tsx
    - apps/mobile/__tests__/screens/recording/crashRecoveryToast.test.tsx
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md
  modified:
    - apps/mobile/src/native/HumynCapture.ts
    - apps/mobile/src/native/HumynCapture.types.ts
    - apps/mobile/src/ui/tokens.ts
    - apps/mobile/App.tsx
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Kotlin emit-site approach: the sweep runs in MainApplication.onCreate (before the catalyst instance attaches), so it can't emit directly. Chose the minimal-additive approach (b' from the plan's options): CaptureLaunchSweep.run() returns the recovered list → MainApplication stashes it in a `@Volatile @JvmStatic` companion holder → HumynCaptureModule (now a LifecycleEventListener, registered in init {}) drains the holder on first onHostResume and emits onCrashRecovery. onHostResume is chosen over initialize()/onCatalystInstanceCreated because by then the JS bundle has loaded and installBootRecoveryListener() (called at App.tsx module-eval) has subscribed — so the emit reaches the listener. crashRecoveryEmitted is a per-process guard; the JS listener also .remove()s itself after the first fire. The existing CaptureLaunchSweep semantics (re-finalize orphans via the sidecar, clean practice >24h, sweep .partial residue) are UNCHANGED — only the recovered-list capture + the deferred emit are added (T-4.10-03 — minimal additive edit; the manifests invariant test is untouched; no new permissions)."
  - "Toast = a module-level subscriber list (useSyncExternalStore), NOT an appStore slice. appStore carries no toast field and the toast is purely presentational / never persisted — a Zustand slice would be heavier than a 40-line module. The RecordingScreen's own local `toast` state (plan 04-09, a dark-surface REC-namespace toast) is left untouched; the new Toast host is the global surface for non-recording screens (its first consumer is bootRecoveryListener). `colors.toastBg` was added to tokens.ts as a generic alias of the existing `recToastBg` value so non-rec surfaces don't reach into the rec* namespace."
  - "bootRecoveryListener validates `recovered` is string[] (Array.isArray + length>0 + every typeof === 'string') before showing the toast (Security — T-4.10-02 / Pattern 6 'crash-recovery payload trusted blindly'). It is one-shot regardless of payload validity — a second emit shouldn't re-toast — so sub.remove() runs after the first fire even when the payload was a no-op. The whole subscribe is wrapped in try/catch: real RN's NativeEventEmitter constructor throws on a null native module, and a JSDOM / no-module build must never crash boot on the recovery wiring."
  - "No analytics event for the recovery toast — `logEvent` requires the name to be in the EVENT_NAMES allowlist; adding a new name is extra surface with no requirement behind it. The toast itself is the user-visible signal; the native side logs `onCrashRecovery emitted — recovered=N` for operator verification (04-MANUAL-SMOKE.md §4(e))."
  - "The Kotlin/Robolectric tests + the on-device smoke walk run on a working Android toolchain — the Gradle build is broken in the current dev env (pre-existing react-native-reanimated RN-0.83 patch incompat, carried forward from plans 04-04/04-05/04-08/04-09). The 4 new CaptureLaunchSweepTest.kt cases are correct by inspection (they follow the existing test's exact patterns) and cover the run()-return contract + the pendingRecovery holder round-trip; the on-device emit path is covered by 04-MANUAL-SMOKE.md §4(e)."

patterns-established:
  - "Toast.tsx — the app-wide transient-toast primitive (showToast / hideToast / <ToastHost />). Future toasts on non-recording surfaces route through showToast(text, durationMs?)."
  - "Deferred boot-time native→JS event — companion holder + LifecycleEventListener.onHostResume drain-and-emit (the pattern for any one-shot event whose producer runs before the catalyst instance attaches)."
  - "bootRecoveryListener.ts — the one-shot-at-boot listener shape (subscribe in App.tsx after hydrate, .remove() after the first fire, try/catch the subscribe, validate the cross-boundary payload before acting)."
  - "04-MANUAL-SMOKE.md — the Phase-4 on-hardware acceptance runbook with the [BLOCKING] §5b drift gate + the remedy ladder; the verifier accepts 'module-ready + practice E2E + lifecycle edges manually verified + §5b within ±1 ms' per D-WAVE-04, and Phase 3's 7 hardware-UAT items retire here."

requirements-completed: [REC-12, ONB-04]

# Metrics
duration: ~22min
completed: 2026-05-11
---

# Phase 4 Plan 10: Crash-recovery UX (onCrashRecovery + Toast host + bootRecoveryListener) + 04-MANUAL-SMOKE.md acceptance runbook Summary

**Crash recovery now surfaces to the user: `CaptureLaunchSweep.run()` returns the orphan-with-valid-sidecar bases (existing sweep semantics unchanged), `MainApplication.onCreate` stashes them in a `@Volatile @JvmStatic` companion holder, `HumynCaptureModule` (now a `LifecycleEventListener`) drains the holder on first `onHostResume` and emits the one-shot `onCrashRecovery({recovered: string[]})` event via `RCTDeviceEventEmitter`, `HumynCapture.ts` exposes the 6th `onCrashRecovery(listener): EmitterSubscription` helper (+ the `CrashRecoveryEvent` type), the new `src/components/Toast.tsx` is the first transient-toast primitive (module-level `showToast`/`hideToast` + a `<ToastHost />` pill on `colors.toastBg`, `useSyncExternalStore`-backed, auto-fade keyed on a monotonic `seq`; mounted in `App.tsx` as a `NavigationContainer` sibling), and the new `src/boot/bootRecoveryListener.ts` (mounted in `App.tsx` after `hydrate()`) subscribes once, validates `recovered` is `string[]` before acting (Security — don't trust the payload blindly), shows the Home toast "Recording recovered after force-quit — uploading.", and `.remove()`s the subscription (one-shot per launch; wrapped in try/catch so a missing native module never crashes boot). And `04-MANUAL-SMOKE.md` — the Phase-4 on-hardware acceptance runbook (D-WAVE-04) — is authored: practice E2E + non-practice via the `__DEV__` dev affordance (incl. the silent 10-min auto-segment cut with preserved `start_gate` + spec-compliance + IMU ≥100 Hz + FGS type/KEEP_SCREEN_ON + on-disk SHA + session events) + all `idea-brief.md §10` lifecycle edges (incl. force-quit → recover-toast + sidecar re-finalize) + thermal injection (`adb shell cmd thermalservice override-status 4`) + the `[BLOCKING]` §5b ±1 ms video↔IMU drift re-measurement on the gate→record camera handoff (must not regress past Phase 3 smoke 7 mean 0.594 / p99 0.728 ms; remedy ladder = bump `SETTLE_MS` → escalate a Phase-3 camera-availability-poll change → never re-introduce audio) + sign-off/re-walked-on + the D-WAVE-09 amendments protocol. Phase 3's seven pending hardware-UAT items retire during this walk. 12 new JS test cases + 4 new Kotlin test cases; mobile suite 85 files / 572 tests green; `tsc --noEmit` clean.**

## Performance

- **Duration:** ~22 min (2 task commits)
- **Completed:** 2026-05-11
- **Tasks:** 2
- **Files modified:** 15 (5 created, 10 modified)

## Accomplishments

- **Kotlin emit path (D-LIFE-04)** — `CaptureLaunchSweep.run()` now returns `List<String>` of the orphan-with-valid-sidecar bases it logged as re-finalize candidates (the existing per-MP4 / per-JSON / `.partial` sweep loops and the practice >24h cleanup are byte-for-byte unchanged — only `sweepRecordings()` accumulates a `recovered` list and `run()` returns it). A `@Volatile @JvmStatic var pendingRecovery: List<String>?` companion holder is the process-singleton handoff. `MainApplication.onCreate` does `CaptureLaunchSweep.pendingRecovery = CaptureLaunchSweep(filesDir).run()`. `HumynCaptureModule` now implements `LifecycleEventListener` (registered via `reactContext.addLifecycleEventListener(this)` in `init {}`); `onHostResume()` — guarded by a `crashRecoveryEmitted` per-process flag — drains `pendingRecovery` (sets it back to `null`) and, if non-empty, builds `Arguments.createMap().apply { putArray("recovered", Arguments.fromList(recovered)) }` and calls `emitEvent("onCrashRecovery", payload)`, wrapped in a `try/catch` (a missing JS module / racing teardown must never crash the capture module — the recovered triples still go through Phase 5's path; only the toast is skipped). Annotated `// Phase 4 D-LIFE-04`. `onHostPause`/`onHostDestroy` are no-ops.
- **JS binding** — `HumynCapture.ts` gains `onCrashRecovery(listener: (e: { recovered: string[] }) => void): EmitterSubscription { return emitter().addListener('onCrashRecovery', listener); }` with the "caller MUST `.remove()`" docstring, mirroring the 5 existing helpers (the lazy `NativeEventEmitter` pattern is reused — no new method on the native-module interface, since this is an event channel). `HumynCapture.types.ts` gains `CrashRecoveryEvent { recovered: string[] }` with a docstring noting the recovered segments go through the normal upload path (Phase 5). `CrashRecoveryEvent` is re-exported from `HumynCapture.ts`.
- **`src/components/Toast.tsx`** (NET-NEW — the first transient-toast primitive) — module-level `showToast(text, durationMs = DEFAULT_TOAST_MS=2000)` / `hideToast()` + a `<ToastHost />` component. State is a `{ text: string | null; seq: number }` held in a module-level variable + a `Set<() => void>` subscriber list; `<ToastHost />` subscribes via `React.useSyncExternalStore` and renders a bottom-anchored pill (`backgroundColor: colors.toastBg`, white-ish `colors.recTextSecondary` text, `radii.pill`, `pointerEvents="none"`, `accessibilityLabel="toast"`). The auto-fade is a single `setTimeout` keyed on a monotonically-increasing `seq` — a rapid second `showToast` bumps `seq`, clears the prior timer, and the prior timer's callback no-ops because `current.seq !== seq` (no premature clear). `colors.toastBg` (`'rgba(26,26,26,0.94)'` — a generic alias of the existing `recToastBg` value) was added to `tokens.ts` so non-rec surfaces don't reach into the `rec*` namespace. No hex literals (the `src/components/` no-hex gate scans this file). Mounted in `App.tsx` as a sibling of `<NavigationContainer>` so it floats over every screen.
- **`src/boot/bootRecoveryListener.ts`** (NET-NEW) — `installBootRecoveryListener(): () => void`: `const sub = HumynCapture.onCrashRecovery(({ recovered }) => { if (Array.isArray(recovered) && recovered.length > 0 && recovered.every(x => typeof x === 'string')) showToast(CRASH_RECOVERY_TOAST); sub?.remove(); sub = null; })` — wrapped in `try/catch` (real RN's `NativeEventEmitter` constructor throws on a null native module; a JSDOM / no-module build must never crash boot). `CRASH_RECOVERY_TOAST = 'Recording recovered after force-quit — uploading.'` exported. Returns a teardown (rarely needed — the listener self-removes). Top docstring covers D-LIFE-04 semantics + the Security validation + "RecordingScreen is NOT shown during recovery; the user sees it in History (Phase 6)". Mounted in `App.tsx` immediately after `hydrate()`.
- **Tests** — `__tests__/components/Toast.test.tsx` (6 — renders nothing when empty; `showToast('hello world')` renders the text under `aria-label="toast"`; auto-hides after `DEFAULT_TOAST_MS`; respects a custom `durationMs`; a rapid second `showToast` supersedes the first with no premature clear; `hideToast()` dismisses immediately — `vi.useFakeTimers()` + `act()`). `__tests__/screens/recording/crashRecoveryToast.test.tsx` (6 — per-test `vi.doMock('react-native', …)` injecting `NativeModules` + a stub `NativeEventEmitter` constructor that throws on a null arg and whose `addListener` captures the listener + returns `{ remove: removeSpy }`, plus the minimal RN host-shim Toast.tsx/Text need: `installBootRecoveryListener()` subscribes to `onCrashRecovery` → firing with `{ recovered: ['…'] }` shows the toast text AND calls `.remove()` once (one-shot); a second fire after the one-shot shows no new toast; a non-array `recovered` shows no toast (the `Array.isArray` guard) but still `.remove()`s; an empty `recovered:[]` shows no toast but still `.remove()`s; a `recovered` array with a non-string element is rejected; the `not-registered` case has `installBootRecoveryListener()` swallow the throw — no captured listener, teardown is a safe no-op). 4 new `CaptureLaunchSweepTest.kt` cases (`run()` returns `[base]` for an orphan with a valid sidecar; returns `[]` for corrupt-sidecar / no-sidecar / complete-triple cases; returns all bases when several valid orphans exist; `pendingRecovery` holder round-trips a recovered list and is `null` after drain). Mobile suite **85 files / 572 tests, 0 failed** (was 83/559 — +2 files, +13 tests); `tsc --noEmit` clean across mobile + api + shared/types.
- **`04-MANUAL-SMOKE.md`** (NET-NEW — pattern-matched against `03-MANUAL-SMOKE.md`) — the Phase-4 on-hardware acceptance runbook (D-WAVE-04): **§1 Pre-flight** (Pixel 10a; the `apkRollout` debug build; DND off; plugged in; backend reachable; `__DEV__` true; signed-in account; `ffprobe`/`python` available); **§2 Practice E2E** (fresh install → Splash → Sign-up → Permissions → Compat → RigTutorial → Next → PracticeIntro → "Start practice" → RecordingScreen: landscape lock → record button → gate substate (130×130 ring + prompt + Skip from t=0) → bring 2 hands → ring fills over ~5×400ms → gate-pass: 80ms vibrate → TTS "Recording started" + VoiceCue pill → brightness drop ~5% → active substate (32px mono timer + minute-bar + 64×64 Stop) → auto-stop at exactly 60s → "Recording stopped" → PracticeComplete (confetti + [40,80,40]ms) → Continue → Home; assertions: in `files/practice/`, `is_practice:true`, not-in-History/contribution, tutorial-doesn't-re-run (ONB-08), `cache/hand-gate/` clean); **§3 Non-practice via the `__DEV__` affordance** (long-press the Tasks "coming in Phase 6" heading → RecordingScreen `{taskId:'cooking_chop_vegetables', isPractice:false}` → gate-pass → run ~10+ min → observe the SILENT 10-min auto-segment cut (no gate re-run, no voice cue — CAP-10) → two consecutive triples ~0.5s apart → `start_gate` block identical across segments → Stop button stops directly; X button shows the "Stop recording?" modal ("Recordings under 1 minute are discarded." + Keep/Stop); sub-60s → "Recording too short — discarded." + no triple persisted + re-press starts fresh; spec-compliance: `ffprobe` 1920×1080/30/HEVC-Main/8Mbps-CBR/GOP-30/no-B-NAL; IMU ≥100Hz; FGS type `camera|microphone|dataSync` + KEEP*SCREEN_ON; on-disk SHA ↔ `file_sha256`/`imu_sha256`; `onSessionStart`/`onSessionStop` events — **Phase-3 UAT #1/#2/#5/#6/#7 retire here**); **§4 Lifecycle edges** ((a) call-answered → stop, (b) call-declined → continue, (c) alarm → stop, (d) rotate-out-of-landscape → stop + toast, (e) force-quit/OS-evict → relaunch → one-shot "Recording recovered after force-quit — uploading." toast + `CaptureLaunchSweep` `orphan_with_sidecar=` log + `onCrashRecovery emitted — recovered=N` log + the orphan triple in `files/recordings/` + the toast fires once-per-launch, (f) battery ≤15% → "Battery 15%" pill + 520Hz beep + [100,50,100]ms haptic + voice "Battery low…" + continue, (g) battery ≤5% → end immediately, (h) storage <5GB → refuse-to-start + toast, (i) battery <5% → refuse-to-start + toast; DND untouched — REC-09..16 / D-LIFE-04); **§5 Thermal injection** (`adb shell cmd thermalservice override-status 4` mid-record → "Phone too hot" pill + descending 440→560→680Hz tones + 800ms vibrate + voice "Phone too hot, stopping recording" → graceful self-stop within ~2.5s → "Recording stopped — phone needs to cool." toast; pre-record `override-status 3` → `start()` rejects `thermal_throttling` + voice "Phone too warm" + back to Ready — **UAT #4 retires here**); **§5b `[BLOCKING]` ±1 ms video↔IMU drift re-measurement on the gate→record handoff** (record a non-practice recording started THROUGH the hand-gate, read `imu_video_drift*{max,mean,p99}\_ms`from the first 2–3 segments' metadata JSON, fill in the drift table; pass = every figure within ±1 ms AND no regression past Phase 3 smoke 7 mean 0.594 / p99 0.728 ms; if it fails: a Phase-4 BLOCKER — first bump`SETTLE_MS`in`RecordingScreen.tsx` and re-walk, then escalate a "`HumynCapture.start()`polls for camera availability before opening Camera2" change to Phase 3, never re-introduce audio — **UAT #3 retires here, the recorded figures are the canonical Phase-4 drift evidence**); **§6 Sign-off** (per-section checklists + the recorded §5b figures + operator signature + smoke-walked-on + re-walked-on + the "Phase-3 UAT #1–#7 retired" attestation); **§7 Amendments protocol** (new cosmetic gaps → a NEW`04-COSMETIC-GAPS.md`, never the frozen `02-COSMETIC-GAPS.md`/`03-W1-AMENDMENTS.md`; functional regressions block sign-off and get a `/gsd-debug` session).
- **ROADMAP.md** — marked the 04-09 + 04-10 checkboxes complete (04-09 landed per its SUMMARY; 04-10 with this plan); flipped the `## Progress` table Phase 4 row from `8/10` → `10/10` (status stays "In progress" until the orchestrator's verify step sets "Complete" + the date).
- **STATE.md** — Current Position → "all 10 plans landed, awaiting verify; the on-hardware acceptance gate is `04-MANUAL-SMOKE.md` incl. the [BLOCKING] §5b drift gate"; the "Phase 3 hardware UAT pending" note now maps each of the 7 items to its `04-MANUAL-SMOKE.md` section; the Progress line → "Phase 4 — 10/10 plans complete"; a new "Phase 4 executed" Roadmap-Evolution entry recording the D-LIFE-04 wiring (the companion-holder + `LifecycleEventListener.onHostResume` drain-and-emit), the `Toast.tsx` primitive, the runbook, and the [BLOCKING] §5b drift gate + remedy ladder; counters bumped (the orchestrator's `state` handlers reconcile).

## Task Commits

- **Task 1: onCrashRecovery event (Kotlin sweep emit + JS binding) + Toast host + bootRecoveryListener + tests** — `1002a45` (feat) — `CaptureLaunchSweep.run()` returns the recovered bases + `pendingRecovery` holder; `MainApplication.onCreate` stash; `HumynCaptureModule` LifecycleEventListener + `onHostResume` emit; `HumynCapture.ts`/`.types.ts` `onCrashRecovery`/`CrashRecoveryEvent`; `Toast.tsx` + `colors.toastBg`; `bootRecoveryListener.ts`; `App.tsx` wiring; `Toast.test.tsx` (6) + `crashRecoveryToast.test.tsx` (6) + 4 new `CaptureLaunchSweepTest.kt` cases. Mobile suite 85/572 green; tsc clean.
- **Task 2: 04-MANUAL-SMOKE.md on-hardware acceptance runbook (incl. the [BLOCKING] ±1ms drift gate) + ROADMAP/STATE refresh** — `c0dff29` (docs) — `04-MANUAL-SMOKE.md` (§1–§7 incl. §5b [BLOCKING]); ROADMAP 04-09/04-10 checkboxes + Progress `10/10`; STATE Current Position + the 7-item UAT-retirement mapping + the "Phase 4 executed" Roadmap-Evolution entry.

**Plan metadata:** _(this commit)_ `docs(04-10): complete plan`

## Files Created/Modified

See `key-files` in the frontmatter. Highlights:

- `apps/mobile/src/components/Toast.tsx` — NEW. The first transient-toast primitive (`showToast`/`hideToast`/`<ToastHost />`).
- `apps/mobile/src/boot/bootRecoveryListener.ts` — NEW. The one-shot crash-recovery boot listener (`installBootRecoveryListener`).
- `apps/mobile/src/native/HumynCapture.ts` / `.types.ts` — added the 6th `onCrashRecovery` helper + the `CrashRecoveryEvent` type, re-exported.
- `apps/mobile/src/ui/tokens.ts` — added `colors.toastBg` (generic alias of `recToastBg`).
- `apps/mobile/App.tsx` — `installBootRecoveryListener()` after `hydrate()`; `<ToastHost />` as a `NavigationContainer` sibling.
- `apps/mobile/android/.../CaptureLaunchSweep.kt` — `run()` returns the recovered bases; `pendingRecovery` companion holder; existing sweep semantics unchanged.
- `apps/mobile/android/.../MainApplication.kt` — `onCreate` stashes `CaptureLaunchSweep.pendingRecovery`.
- `apps/mobile/android/.../HumynCaptureModule.kt` — `LifecycleEventListener`; `onHostResume` drains the holder + emits `onCrashRecovery` (`// Phase 4 D-LIFE-04`).
- `apps/mobile/android/.../CaptureLaunchSweepTest.kt` — +4 cases (run()-return contract + holder round-trip).
- `apps/mobile/__tests__/components/Toast.test.tsx` — NEW (6 cases).
- `apps/mobile/__tests__/screens/recording/crashRecoveryToast.test.tsx` — NEW (6 cases).
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md` — NEW (the D-WAVE-04 acceptance runbook).
- `.planning/ROADMAP.md` / `.planning/STATE.md` — the in-plan refresh (the phase-level "complete" mark + STATE advance to phase 5 is the orchestrator's verify+complete steps).

## Decisions Made

See `key-decisions` in the frontmatter — the substantive calls: (1) the Kotlin emit-site = companion-holder + `LifecycleEventListener.onHostResume` drain-and-emit (the sweep runs before the catalyst instance attaches; `onHostResume` is the first hook where JS has loaded + subscribed; the existing sweep semantics are untouched — minimal additive edit per T-4.10-03); (2) Toast = a module-level `useSyncExternalStore` subscriber list, not an appStore slice (lighter; the RecordingScreen's own dark-surface toast stays local; `colors.toastBg` aliased so non-rec surfaces don't reach into `rec*`); (3) `bootRecoveryListener` validates `recovered` is `string[]` before acting (Security — don't trust the payload blindly) and is one-shot regardless of payload validity; the subscribe is `try/catch`-wrapped so a missing native module never crashes boot; (4) no analytics event for the recovery toast (the EVENT_NAMES allowlist; the native-side log line + the toast itself are the signals); (5) the Kotlin/Robolectric tests + the on-device walk run on a working Android toolchain (the Gradle build is broken in the current dev env — carried-forward `react-native-reanimated` RN-0.83 incompat).

## Deviations from Plan

### Adaptations (within plan scope)

**1. [Plan adaptation] ROADMAP.md was already at `**Plans:** 10 plans` + had the plan list — only the checkboxes + the Progress count needed updating**

- **Found during:** Task 2.
- **Issue:** The plan's Task-2 step 2 says to change `**Plans**: TBD` → `**Plans:** 10 plans` and add the plan list (mirroring Phase 2). But the Phase 4 ROADMAP entry was already created with `**Plans:** 10 plans` + the full Wave-1..6 plan list (from the 04-04 re-research, commit `6192e93`), and the Progress table already showed `8/10` (not `0/TBD`).
- **Fix:** Marked the `04-09` + `04-10` checkboxes complete (04-09 landed per its SUMMARY); flipped the Progress table Phase 4 row `8/10` → `10/10`. Left the status "In progress" + the completion date blank — the phase-level "Complete" mark + the date are the orchestrator's verify+complete steps (per the plan-execution `<note>`).
- **Files modified:** `.planning/ROADMAP.md`
- **Committed in:** `c0dff29` (Task 2 commit)

**2. [Plan adaptation] STATE.md `stopped_at`/`resume_file` set to reflect "Phase 4 execution done, awaiting verify" — not the planner-era "Phase 4 planned, resume at 04-01" text**

- **Found during:** Task 2.
- **Issue:** The plan's Task-2 step 3 (written from the planner's perspective) says to set `stopped_at` → `Phase 4 planned (10 plans, 6 waves)` and `resume_file` → `04-01-PLAN.md`. But this is plan 10 executing — that planner-era text is stale; STATE already had a "Phase 4 planned" Roadmap-Evolution entry (commit `f79f859`) and `total_plans: 56`.
- **Fix:** Set `stopped_at` → `Completed 04-10-PLAN.md — Phase 4 execution done; awaiting verify`; updated the Current Position status + the "Phase 3 hardware UAT pending" note (now maps each of the 7 items to its `04-MANUAL-SMOKE.md` section, since the file now exists); added a "Phase 4 executed" Roadmap-Evolution entry; bumped the YAML counters (`completed_plans` 54→56, `percent`→100 — the orchestrator's `state advance-plan` / `update-progress` reconcile from disk). Did NOT touch `completed_phases` (3) — Phase 4 isn't verified yet; the orchestrator's verify step bumps it.
- **Files modified:** `.planning/STATE.md`
- **Committed in:** `c0dff29` (Task 2 commit)

### Auto-fixed Issues

**3. [Rule 3 - Blocking] `crashRecoveryToast.test.tsx` needed a minimal RN host-shim in its per-test `vi.doMock('react-native', …)`**

- **Found during:** Task 1 (running the new test).
- **Issue:** `vi.doMock('react-native', …)` fully replaces the module, so `StyleSheet` / `View` / `Text` (used by `Toast.tsx` + the `Text` primitive that the rendered `<ToastHost />` pulls in) were `undefined` → `No "StyleSheet" export is defined on the "react-native" mock`. (And: `react-native`'s real `NativeEventEmitter` constructor throws on a null native module — needed to be simulated so the `not-registered` test's `try/catch` branch is exercised.)
- **Fix:** Added a `makeComponent`-style host-shim (`View`/`Text` → pass-through `<div>` with `aria-label` forwarding, mirroring `vitest.setup.ts`) + a `StyleSheet` stub (`create`/`flatten` identity + `absoluteFillObject: {}`) to the per-test mock; made the stub `NativeEventEmitter` constructor throw when given a null arg (mirroring real RN). (Then esbuild flagged the `<T extends …>` generic arrow as a JSX ambiguity in a `.tsx` file — switched the `StyleSheet.create` stub signature to non-generic `(s: unknown) => s`.)
- **Files modified:** `apps/mobile/__tests__/screens/recording/crashRecoveryToast.test.tsx`
- **Committed in:** `1002a45` (Task 1 commit)

---

**Total deviations:** 2 plan-adaptations (ROADMAP/STATE already partly done; planner-era STATE text adjusted to the execution reality) + 1 auto-fixed blocking issue (the test's RN host-shim). No scope creep — the Kotlin emit-site approach was an explicit planner-offered option ("pick whichever requires the smallest, most-additive diff"), the chosen `LifecycleEventListener.onHostResume` drain-and-emit is the minimal correct one.
**Impact on plan:** All 13 plan-listed `files_modified` were created/modified. The plan's `<interfaces>` Kotlin sketch suggested emitting "AT THE END" of the sweep loop or via `HumynCapturePackage.createNativeModules` — neither works (the sweep runs in `MainApplication.onCreate` before the catalyst instance attaches, and the package's `createNativeModules` runs at module-init which is still before JS subscribes); the companion-holder + first-`onHostResume` approach is the minimal one that actually reaches the JS listener — documented in `key-decisions` per the plan's "document the chosen approach in the SUMMARY" instruction.

## TDD Gate Compliance

Both tasks are `type="auto"` (not `tdd="true"`); config has `tdd_mode: false` and `MVP_MODE`/`TDD_MODE` were not passed by the orchestrator, so the per-task RED/GREEN commit-gate does not apply. Task 1 (`1002a45`) is a single `feat` commit (impl + tests together); Task 2 (`c0dff29`) is a `docs` commit (the runbook + ROADMAP/STATE refresh — no source).

## Issues Encountered

- **`vi.doMock('react-native', …)` fully replaces the module** — re-mocking `react-native` to inject `NativeModules` + a stub `NativeEventEmitter` constructor loses `StyleSheet`/`View`/`Text` unless they're re-supplied. Resolved by adding a minimal host-shim to the per-test mock (Deviation 3); same `react-native`-can't-be-partially-re-mocked-with-`importOriginal` constraint plans 04-06/04-07/04-09 hit (the real `index.js` is Flow → Rollup parse failure).
- **Gradle/Android build still not runnable in this dev env** (carried forward from plans 04-04/04-05/04-08/04-09) — `react-native-reanimated`'s RN-0.83 reactNativeVersionPatch Java files don't compile against this RN minor (`LengthPercentage.resolve` arity mismatch). The Kotlin/Robolectric tests (`./gradlew testApkRolloutDebugUnitTest`) can't run here as a result; the 4 new `CaptureLaunchSweepTest.kt` cases are correct by inspection (they follow the existing test's exact Robolectric fixture pattern), and the on-device emit path + the whole §1–§5b walk are exercised by `04-MANUAL-SMOKE.md` on a working Android toolchain. A future plan that touches the Android build should pin/patch `react-native-reanimated`.

## Known Stubs

None. `Toast.tsx` is a complete primitive (`showToast`/`hideToast`/`<ToastHost />` — the auto-fade, the supersede-on-rapid-second-toast, the `useSyncExternalStore` subscription are all wired); `bootRecoveryListener.ts` is the full one-shot listener (subscribe + validate + toast + self-remove + the `try/catch` guard); the Kotlin path is complete (`run()` returns the recovered bases → `pendingRecovery` holder → `onHostResume` drain-and-emit). The `04-MANUAL-SMOKE.md` checkboxes are intentionally blank — that's the operator runbook to be filled in during the on-hardware walk (the §5b drift table is the canonical Phase-4 drift evidence the operator records). The `SETTLE_MS = 80` constant in `RecordingScreen.tsx` (plan 04-09) is the deliberate [TUNABLE] knob the [BLOCKING] §5b smoke gate tunes — not a stub.

## Threat Flags

| Flag     | File | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_ | —    | No new network endpoints / auth paths / schema changes at trust boundaries beyond the plan's `<threat_model>`. T-4.10-01 (capture-quality invariant on the VC→HumynCapture handoff) → `04-MANUAL-SMOKE.md` §5b [BLOCKING] re-measurement + the remedy ladder. T-4.10-02 (`onCrashRecovery({recovered})` payload) → `bootRecoveryListener` validates `recovered` is `string[]` (`Array.isArray` + `length>0` + `every typeof === 'string'`) before the toast; one-shot per launch. T-4.10-03 (the Phase-3-owned file surgical edit) → minimal additive (companion holder + deferred emit); existing sweep semantics unchanged; no new permissions; the manifests invariant test is untouched. T-4.10-04 (the recovery toast / runbook) → the toast carries a fixed string (no filenames, no PII); the runbook's `adb` commands read app-internal files for operator verification, not exfiltration. |

## User Setup Required

None — no external service configuration required. (The `04-MANUAL-SMOKE.md` walk needs a Pixel-class device, a working Android toolchain, `ffprobe`, and `python` — listed in §1 Pre-flight — but no new accounts/keys/services.)

## Next Phase Readiness

- **Phase 4 verify** — the on-hardware smoke walk (`04-MANUAL-SMOKE.md`) is the D-WAVE-04 acceptance gate. The verifier accepts "module-ready (vitest 85/572 green) + practice E2E passes + lifecycle edges manually verified + the §5b drift figures within ±1 ms (and no regression past Phase 3 smoke 7 mean 0.594 / p99 0.728 ms)"; Phase 3's seven pending hardware-UAT items retire during this walk and should not be separately re-blocked on. If §5b fails on hardware: a Phase-4 BLOCKER — bump `SETTLE_MS` in `RecordingScreen.tsx` and re-walk; if that's not enough, escalate a "`HumynCapture.start()` polls for camera availability before opening Camera2" change to Phase 3 (surgical-stage protocol); audio stays out (`CLAUDE.md` banner). The phase-level checkbox + the STATE advance to Phase 5 are the orchestrator's verify+complete steps.
- **Phase 5 (HumynUpload)** — the recovered orphan triples (re-finalized off the `.session.json` sidecar by `HumynCapture.start()` when it next runs, or picked up directly) land in `files/recordings/` and go through Phase 5's upload path; `bootRecoveryListener` is only the user-facing toast (it does NOT trigger the re-finalize or the upload). Any new Phase-5/6 screen that needs a transient toast routes through `showToast(...)` from `src/components/Toast.tsx`.
- **Phase 6** — the recovered recording arrives in History (Phase 6 surface); the user sees it there (RecordingScreen is never re-shown during recovery).
- **Mobile suite: 85 files / 572 tests, 0 failed; `tsc --noEmit` clean** across mobile + api + shared/types. The Gradle/`react-native-reanimated` RN-0.83 compile break still blocks Android Gradle tasks in this dev env (carried forward).

## Self-Check: PASSED

All claimed files exist on disk:

- created: `apps/mobile/src/components/Toast.tsx`, `apps/mobile/src/boot/bootRecoveryListener.ts`, `apps/mobile/__tests__/components/Toast.test.tsx`, `apps/mobile/__tests__/screens/recording/crashRecoveryToast.test.tsx`, `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md`
- modified: `apps/mobile/src/native/HumynCapture.ts`, `apps/mobile/src/native/HumynCapture.types.ts`, `apps/mobile/src/ui/tokens.ts`, `apps/mobile/App.tsx`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt`, `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt`, `.planning/ROADMAP.md`, `.planning/STATE.md`
- this SUMMARY: `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-10-SUMMARY.md`

Task commits present in `git log`: `1002a45` (feat — Task 1: onCrashRecovery + Toast + bootRecoveryListener + tests), `c0dff29` (docs — Task 2: 04-MANUAL-SMOKE.md + ROADMAP/STATE refresh).

Verification: `npx vitest run` (apps/mobile) → **85 files / 572 tests, 0 failed**; `npx tsc --noEmit` (apps/mobile) → exit 0; the plan's bash verify (`test -f .planning/.../04-MANUAL-SMOKE.md && grep -q imu_video_drift … && grep -q BLOCKING … && grep -q "10 plans" .planning/ROADMAP.md && echo ok`) → `ok`; grep-checks: `HumynCapture.ts` contains + exports `onCrashRecovery`; `HumynCapture.types.ts` contains `CrashRecoveryEvent`; `Toast.tsx` exports `showToast` + `ToastHost`; `bootRecoveryListener.ts` exports `installBootRecoveryListener` + contains `Recording recovered after force-quit — uploading.` + `Array.isArray(recovered)`; `App.tsx` contains `installBootRecoveryListener` + `<ToastHost />`; `CaptureLaunchSweep.kt`/`MainApplication.kt`/`HumynCaptureModule.kt` contain `onCrashRecovery` / `pendingRecovery`; `04-MANUAL-SMOKE.md` contains `imu_video_drift`, `BLOCKING`, `cmd thermalservice override-status 4`, `Recording recovered after force-quit`, `re-walked-on:`. The Kotlin/Robolectric tests can't run in this dev env (pre-existing `react-native-reanimated` RN-0.83 Gradle compile break) — the 4 new `CaptureLaunchSweepTest.kt` cases are correct by inspection; the on-device emit path is covered by `04-MANUAL-SMOKE.md` §4(e).
