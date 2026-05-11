---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 09
subsystem: capture
tags:
  [
    react-native,
    react-native-vision-camera,
    mediapipe,
    react-native-firebase,
    react-native-orientation-locker,
    react-native-fs,
    recording,
    vitest,
  ]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-04)
    provides: HumynHandDetector.detectHands(path, minConf) real MediaPipe body + isHandDetectorAvailable() HAND-08 discriminant
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-05)
    provides: HumynScreenBrightness.set(value) per-window brightness override
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-06)
    provides: PracticeIntro navigates to 'Recording' with { taskId:'__practice__', isPractice:true }; PracticeComplete OnboardingStack route; the recording_gate_* / recording_* analytics event names
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-07)
    provides: recState.ts state machine + reducer; RecordingScreen chrome-only shell + the 5 recording UI components + Recording route + the REQUIRED_PHASE_4_ROUTES block + the __test_initialState escape hatch
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-08)
    provides: useRecordingLifecycle({ substate, isPractice, durationMs, callbacks }) → { checkStartGuards }; ttsVoice.pickAndSetEnInVoice() + speakCue(text); durationFormat.formatContributionDuration(ms)
  - phase: 03-humyn-capture-native-module
    provides: HumynCapture.start(opts) → {sessionId, segmentId, recordingId, filenameBase} / rejects Error(code); CaptureSessionOptsSchema (D-API-02); the onSegment*/onSessionStop/onThermalAbort/onError emitters
  - phase: 02 (plan 02-06 / 02-15)
    provides: compat.lastResult.v1 MMKV blob (checks.ultrawideDfov.measuredDeg, D-COMPAT-05)
provides:
  - 'src/lib/remoteConfigGate.ts — readGateConfig(): Promise<{ targetHits, cadenceMs, minHandDetectionConfidence }> from Firebase Remote Config (gate.consecutive_hits_required / gate.cadence_ms / gate.min_hand_detection_confidence), clamped to sane ranges, with the hard-coded Android defaults (5/400/0.5) as the unconditional fallback on fetch failure (HAND-11 / Security V14); GATE_DEFAULTS exported'
  - 'src/lib/buildCaptureOpts.ts — buildCaptureOpts(args): CaptureSessionOpts — the full D-API-02 shape (taskId/taskName/taskCategory/taskSetting/contributor/isPractice/startGate/location:null/appVersion/dfovDegrees); contributor.consent is sourced from the verified /me consent state (consentPresent) — THROWS if absent, never defaulted (V11); coerceGender() narrows to the schema enum'
  - 'src/screens/recording/useHandGate.ts — useHandGate({ active, cadenceMs, minConfidence, camRef, dispatch }) — the HAND-03/04/13 photo-to-disk poll loop (takePhoto → RNFS.mkdir+moveFile cacheDir/hand-gate/{uuid}.jpg → HumynHandDetector.detectHands(dest, minConf) → GATE_HIT (count===2) / GATE_MISS (else) → RNFS.unlink(dest) in finally); recursive setTimeout + cancelled-ref teardown; HAND_GATE_DIR exported'
  - "src/screens/recording/RecordingScreen.tsx — the fully-wired recording surface: VisionCamera <Camera> (preview + takePhoto only) on the back ultrawide lens (physicalDevices filter), isActive only during the gate substate, photoQualityBalance='speed', onInitialized → CAMERA_READY + the HAND-12 throwaway pre-warm; the useHandGate poll loop; HAND-08 silent bypass (only on gate.phase==='loading') / HAND-07 Skip; the HAND-09 TTS-masked gate-pass→active transition (Vibration.vibrate(80) → speakCue('Recording started') → VoiceCue pill 1.8s → HumynScreenBrightness.set(0.05) → setCameraActive(false) → SETTLE_MS=80 → HumynCapture.start(buildCaptureOpts(...)) → CAPTURE_STARTED, or reject → set(-1) + CAPTURE_START_FAILED + toast); HAND-11 readGateConfig at mount; HAND-14 analytics (recording_gate_started/passed/skipped/bypassed — locale only, no image data); REC-01 Orientation.lockToLandscape on mount / unlockAllOrientations + set(-1) on unmount; REC-08 brightness restore on stop+unmount; the §7h post-stop routing (practice → PracticeComplete via parent navigator; real ≥60s → toast '{Hh Mm} added to your contribution.' + Home; real <60s → toast 'Recording too short — discarded.' + RESET_FOR_FRESH); REC-05 re-press starts fresh; REC-16 start guards (checkStartGuards in the pre-flight effect); useRecordingLifecycle mount; the cacheDir/hand-gate mount sweep; active-duration TICK interval; the silent onSegmentStart/onSegmentComplete telemetry subscriptions (D-SEG-01)"
  - "route-registry.test.ts — REQUIRED_PHASE_4_ROUTES = ['Recording', 'PracticeIntro', 'PracticeComplete'] (the practice routes moved here from REQUIRED_PHASE_2_ROUTES so the Pattern-54 Phase-4 invariant covers all three Phase-4 routes in one block)"
  - 'vitest.setup.ts — NativeEventEmitter no-op stub in the react-native host shim + a @react-native-firebase/remote-config global mock (RecordingScreen transitively needs both)'
  - 'tests: __tests__/lib/buildCaptureOpts.test.ts (12), __tests__/screens/recording/handGate.test.tsx (9), __tests__/screens/recording/RecordingScreen.test.tsx (17, rewritten from the 04-07 shell test)'
  - 'D4-01 CLOSED — the Phase-3 __DEV__-gated smoke seam removed from HomeSkeletonScreen.tsx; RootNativeStack.test.tsx setPermsGranted-rejection fixed; full mobile suite 0 failed / 0 errors'
affects:
  [
    04-10 (the Wave-6 on-hardware smoke runbook — re-measures imu_video_drift on this new VC→HumynCapture camera handoff under the SETTLE_MS budget; that's the [BLOCKING] gate),
    Phase 5 (HumynUpload — recState.gate becomes metadata.start_gate; the segMetaRef recordingId/filenameBase telemetry plumbing),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useHandGate — a recursive-setTimeout poll loop (NOT setInterval — one tick finishes before the next is scheduled) keyed on [active, cadenceMs, camRef]; a `cancelled` ref + the setTimeout handle cleared in the cleanup; the per-tick photo→move→detectHands→dispatch→unlink-in-finally sequence (04-RESEARCH Pattern 1); mirrors CompatRunningScreen's imuTickRef/cancelled discipline"
    - "RecordingScreen gate-pass→active transition — a useEffect keyed on [state.substate, state.gate.phase] with a transitionStartedRef one-shot guard; the verbatim Pattern-2 sequence (vibrate→TTS→set(0.05)→setCameraActive(false)→await SETTLE_MS→HumynCapture.start(buildCaptureOpts)→CAPTURE_STARTED, or catch→speakCue+set(-1)+toast+CAPTURE_START_FAILED); SETTLE_MS is a tunable constant with a drift-re-measurement comment for plan 04-10"
    - "HAND-08 silent bypass gated on gate.phase==='loading' — the natural entry phase (pre-flight → PRE_FLIGHT_OK → gate.loading); a screen rendered directly into a later phase (the __test_initialState escape hatch / hot-reload) is past this gate, so the loading-state chrome + the waiting-phase Skip link aren't clobbered"
    - "VC device selection by the physicalDevices filter (not a stored cameraId) — CompatResult.checks.ultrawideDfov only persists measuredDeg (D-COMPAT-05), so RecordingScreen picks the back device whose physicalDevices includes 'ultra-wide-angle-camera' (useCameraDevices().find(...) ?? useCameraDevice('back', { physicalDevices }) fallback); dfovDegrees comes from MMKV's measuredDeg with a 110° spec-floor fallback if absent"
    - "§7h cross-stack post-stop nav — PracticeComplete lives in OnboardingStack (D-NAV-04) while Recording is a RootNativeStack sibling, so the practice exit hops via navigation.getParent()?.reset({ routes:[{ name:'OnboardingStack', state:{ routes:[{ name:'PracticeComplete' }] } }] }) (with navigate/replace fallbacks); the real-recording exit lands on the Home tab via getParent()?.navigate('MainTabs')"
    - "react-native mock can't be partially re-mocked with importOriginal (the real index.js is Flow → Rollup parse failure) — to override one export (Vibration), spy on the global mock's object (vi.spyOn(Vibration, 'vibrate')) instead"

key-files:
  created:
    - apps/mobile/src/lib/remoteConfigGate.ts
    - apps/mobile/src/lib/buildCaptureOpts.ts
    - apps/mobile/src/screens/recording/useHandGate.ts
    - apps/mobile/__tests__/lib/buildCaptureOpts.test.ts
    - apps/mobile/__tests__/screens/recording/handGate.test.tsx
  modified:
    - apps/mobile/src/screens/recording/RecordingScreen.tsx
    - apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx
    - apps/mobile/__tests__/navigation/route-registry.test.ts
    - apps/mobile/vitest.setup.ts
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
    - apps/mobile/__tests__/navigation/RootNativeStack.test.tsx
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md

key-decisions:
  - "buildCaptureOpts sources contributor.name/email from appStore.user (UserDisplay) and consentPresent from appStore.consent != null; age/gender are passed null (the in-memory UserDisplay slice doesn't carry them — the verified /me PATCH-able fields aren't mirrored into the store). The metadata JSON tolerates age/gender:null; consent is NEVER defaulted (throws if appStore.consent is absent — V11)."
  - "dfovDegrees: read from compat.lastResult.v1.checks.ultrawideDfov.measuredDeg in MMKV; if absent/non-positive (corrupted store, a build that skipped compat) fall back to 110° (idea-brief §2.1 spec floor) — dfovDegrees must be > 0 to pass CaptureSessionOptsSchema (a Rule-2 defensive fallback)."
  - "VC camera lens: there is no stored cameraId (CompatResult only persists measuredDeg per D-COMPAT-05), so RecordingScreen uses the VC physicalDevices filter ('ultra-wide-angle-camera') as the lens selector — useCameraDevices().find(back && includes ultrawide) ?? useCameraDevice('back', { physicalDevices }) fallback. The plan's <interfaces> referenced a `cameraId` field that doesn't exist on the schema; the physicalDevices filter is the documented Open-Q-1 fallback."
  - "appVersion: read from getFlavorContext().versionName (AppFlavor native module) — the plan's <interfaces> referenced getConstants().BuildConfig.VERSION_NAME, but the actual AppFlavor binding exposes versionName directly; same value (the Phase-1 versioning script's BuildConfig.VERSION_NAME)."
  - "HAND-08 bypass gated on gate.phase==='loading': dispatching GATE_BYPASS unconditionally on gate-substate entry would clobber a __test_initialState-rendered waiting/confirmed phase (and the visual baselines depend on the waiting-phase Skip link being present). Gating on the natural entry phase fixes the visual-test regression without changing real-flow behavior."
  - "Tasks 2 and 3 both modify RecordingScreen.tsx heavily and interlock (the gate poll loop, the gate-pass transition, useRecordingLifecycle, the §7h routing all reference the same state); the screen wiring + handGate.test + the rewritten RecordingScreen.test landed in the Task-2 commit (8f56a3a) and the Task-3 commit (b79e7d3) carries only the route-registry.test.ts change. The plan's task split is artificial for a single-file integration; the deliverables are all present."
  - "Two new vitest.setup.ts shims (Rule 3 — blocking): a NativeEventEmitter no-op class (RecordingScreen mounts useRecordingLifecycle whose HumynPhoneState/HumynBattery bindings construct one on first subscribe) + a @react-native-firebase/remote-config global mock (readGateConfig calls it; the package's lib/index.js is native-codegen and can't be transformed under jsdom). Same precedent as plan 04-06's Vibration shim / plan 04-07's ActivityIndicator shim."

patterns-established:
  - "remoteConfigGate.ts — the canonical Firebase Remote Config read with hard-coded defaults; any RemoteConfig key consumed at MVP follows the 'setDefaults → fetchAndActivate (best-effort, swallowed) → getValue().asNumber() || default → clamp, with a try/catch → defaults' shape (Security V14)"
  - "buildCaptureOpts.ts — the CaptureSessionOpts builder; never default contributor.consent; the Kotlin side re-validates with the same Zod shape (T-3.3-01)"
  - "useHandGate poll loop — the gate frame source pattern; cacheDir-only frame storage, unlink-in-finally + a mount-time sweep + the app-launch sweep (Security V8/V12)"
  - "the SETTLE_MS tunable + drift-re-measurement comment — the camera-handoff knob plan 04-10's [BLOCKING] smoke gate tunes"

requirements-completed:
  [
    HAND-01,
    HAND-03,
    HAND-04,
    HAND-06,
    HAND-07,
    HAND-08,
    HAND-09,
    HAND-11,
    HAND-12,
    HAND-14,
    REC-01,
    REC-04,
    REC-05,
    REC-07,
    REC-08,
    REC-16,
    ONB-03,
    ONB-04,
    ONB-05,
  ]

# Metrics
duration: ~13min
completed: 2026-05-11
---

# Phase 4 Plan 09: Live recording surface — VC `<Camera>` + hand gate + gate-pass transition + §7h routing Summary

**The recording surface now actually records: `remoteConfigGate.readGateConfig()` (HAND-11 — Firebase Remote Config gate cadence/target/confidence with the hard-coded Android `5/400/0.5` fallback), `buildCaptureOpts()` (the full D-API-02 `CaptureSessionOpts` shape with `contributor.consent` sourced honestly — throws if consent is absent, V11), `useHandGate()` (the HAND-03/04/13 `takePhoto → cacheDir/hand-gate/{uuid}.jpg → HumynHandDetector.detectHands → GATE_HIT/MISS → unlink-in-finally` poll loop), and the fully-wired `RecordingScreen.tsx` — the VisionCamera `<Camera>` (preview + `takePhoto()` only) on the back ultrawide lens, the HAND-12 throwaway pre-warm, the HAND-08 silent bypass / HAND-07 Skip, the HAND-09 TTS-masked gate-pass→active transition (`Vibration.vibrate(80) → speakCue('Recording started') → HumynScreenBrightness.set(0.05) → setCameraActive(false) → SETTLE_MS=80 → HumynCapture.start(buildCaptureOpts(...)) → CAPTURE_STARTED`, or reject → `set(-1)` + `CAPTURE_START_FAILED` + toast), HAND-14 analytics (locale only, no image data), REC-01 `Orientation.lockToLandscape()` on mount / unlock + `set(-1)` on unmount, REC-08 brightness restore on stop+unmount, the §7h post-stop routing (practice → PracticeComplete; real ≥60s → toast `{Hh Mm} added to your contribution.` + Home; real <60s → toast `Recording too short — discarded.` + `RESET_FOR_FRESH`), REC-05 re-press-starts-fresh, REC-16 start guards, the `useRecordingLifecycle` mount, and the cacheDir/hand-gate mount sweep — plus the `route-registry.test.ts` `REQUIRED_PHASE_4_ROUTES` now covering all three Phase-4 routes. As an authorized D4-01 deviation: the Phase-3 `__DEV__` smoke seam was removed from `HomeSkeletonScreen.tsx` and the `RootNativeStack.test.tsx` `setPermsGranted` rejection fixed — the full mobile suite is now 0 failed / 0 errors. 38 new/rewritten test cases.**

## Performance

- **Duration:** ~13 min (4 task/cleanup commits)
- **Completed:** 2026-05-11
- **Tasks:** 3 (Task 2 + Task 3's screen wiring folded into one commit; Task 3's test-only deliverable a second; + the authorized D4-01 cleanup)
- **Files modified:** 12 (5 created, 7 modified)

## Accomplishments

- **`src/lib/remoteConfigGate.ts`** (`feat` `447dc19`) — `readGateConfig()`: `remoteConfig().setDefaults({ 'gate.consecutive_hits_required':5, 'gate.cadence_ms':400, 'gate.min_hand_detection_confidence':0.5 })` → `await fetchAndActivate()` (best-effort, swallowed) → `targetHits = Math.max(1, Math.round(getValue('gate.consecutive_hits_required').asNumber() || 5))` / `cadenceMs = Math.max(100, Math.round(... || 400))` / `minHandDetectionConfidence = Math.min(1, Math.max(0, ... || 0.5))`; the whole thing in a `try/catch` returning `GATE_DEFAULTS` (`{5,400,0.5}`) on any failure (Security V14 — a RemoteConfig outage never blocks the gate). The keys are cross-platform-aware (iOS `3/600/0.5`) per SC#1 even though iOS is descoped.
- **`src/lib/buildCaptureOpts.ts`** (`feat` `447dc19`) — `buildCaptureOpts(args)`: `if (!args.user.consentPresent) throw new Error('Cannot start a capture session without recorded consent')` FIRST (V11 — `consent: true` is never emitted without the verified `/me` consent state being present), then assembles the verbatim D-API-02 shape — `contributor: { name, email, age, gender: coerceGender(g), consent: true }`, `startGate: { type:'hand_detection', passed, skipped, bypassed, durationMs: Math.max(0, Math.round(...)), consecutiveHitsRequired: targetHits, platformCadenceMs: cadenceMs }`, `location: null`, `appVersion`, `dfovDegrees`. `coerceGender(g)` → `g` if it's one of `'male'|'female'|'non-binary'|'prefer-not-to-say'`, else `null`. The Kotlin side re-validates with the same `CaptureSessionOptsSchema` (T-3.3-01).
- **`src/screens/recording/useHandGate.ts`** (`feat` `8f56a3a`) — `useHandGate({ active, cadenceMs, minConfidence, camRef, dispatch })`: a `useEffect` keyed on `[active, cadenceMs, camRef]` that, when `active`, runs a recursive `setTimeout(tick, cadenceMs)` where `tick` does `camRef.current.takePhoto({ flash:'off', enableShutterSound:false })` → `RNFS.mkdir(HAND_GATE_DIR).catch(()=>{})` → `RNFS.moveFile(photo.path, ${HAND_GATE_DIR}/${uuid.v4()}.jpg)` → `const count = await detectHands(dest, minConf).catch(() => 0)` → `dispatch(count===2 ? { type:'GATE_HIT', now } : { type:'GATE_MISS' })` → `RNFS.unlink(dest).catch(()=>{})` in a `finally` (+ the next `setTimeout`); a `cancelled` ref + the `setTimeout` handle cleared in the cleanup. `HAND_GATE_DIR = ${RNFS.CachesDirectoryPath}/hand-gate` exported.
- **`src/screens/recording/RecordingScreen.tsx`** (`feat` `8f56a3a` — replaced the 04-07 chrome-only shell) — the live surface:
  - **camera mount** — `useCameraDevice('back', { physicalDevices:['ultra-wide-angle-camera'] })` (the hook, called unconditionally) + `useCameraDevices()`, `ultrawide = devices.find(back && includes 'ultra-wide-angle-camera') ?? fallbackDevice`; `<Camera ref={camRef} device={ultrawide} isActive={cameraActive} photo photoQualityBalance="speed" onInitialized={onCameraInitialized} style={StyleSheet.absoluteFill} />` rendered ONLY when `state.substate==='gate' && cameraActive` (so Camera2 is released before HumynCapture opens it — T-4.9-06). `onCameraInitialized` → `dispatch({ type:'CAMERA_READY' })` then a single throwaway `takePhoto().then(p => RNFS.unlink(p.path))` (HAND-12 pre-warm, Pitfall 9).
  - **gate enter** — a useEffect keyed on `state.substate`: `logEvent('recording_gate_started', { locale })`; if `state.gate.phase==='loading' && !isHandDetectorAvailable()` → `logEvent('recording_gate_bypassed', { locale })` + `dispatch({ type:'GATE_BYPASS', now })` (HAND-08 silent bypass, same UX as Skip; gated on `'loading'` so the `__test_initialState` escape hatch doesn't clobber a waiting/confirmed render). `useHandGate({ active: substate==='gate' && gate.phase==='waiting', cadenceMs: gate.cadenceMs, minConfidence: gateCfg.minHandDetectionConfidence, camRef, dispatch })`. The Skip link's `onPress` → `logEvent('recording_gate_skipped', { locale })` (locale only — NO image data, T-4.9-03) + `dispatch({ type:'GATE_SKIP', now })`.
  - **gate-pass → active** (HAND-09 Pattern 2) — a useEffect keyed on `[state.substate, state.gate.phase]` with a `transitionStartedRef` one-shot guard: `const passed = !state.gate.skipped && !state.gate.bypassed`; `if (passed) { Vibration.vibrate(80); showVoiceCue('Recording started') /* VoiceCue pill 1.8s — REC-15 */; logEvent('recording_gate_passed', { locale }); logEvent('recording_started'); }` → `await HumynScreenBrightness.set(0.05).catch(()=>{})` (REC-08, even on skip/bypass) → `setCameraActive(false)` → `await new Promise(r => setTimeout(r, SETTLE_MS))` (`SETTLE_MS = 80` — the [TUNABLE] camera-handoff delay with the drift-re-measurement comment for plan 04-10) → `try { const r = await HumynCapture.start(buildCaptureOpts({ taskId, taskName, taskCategory, taskSetting, isPractice, gate:{ passed, skipped, bypassed, durationMs: confirmedAt-startedAt }, gateConfig:{ targetHits, cadenceMs }, compat:{ ultrawideDfovMeasuredDeg: dfovMeasuredDeg ?? 110 }, user:{ name, email, age:null, gender:null, consentPresent: appStore.consent != null }, appVersion })); dispatch({ type:'CAPTURE_STARTED', now }); } catch (e) { speakCue(code==='thermal_throttling'?'Phone too warm':code==='permission_revoked'?'Camera permission needed':'Could not start recording'); await HumynScreenBrightness.set(-1).catch(()=>{}); showToast(code==='storage_full'?'Not enough storage to record.':code==='thermal_throttling'?'Phone too warm — let it cool and try again.':'Could not start recording.'); dispatch({ type:'CAPTURE_START_FAILED' }); }`.
  - **active TICK** — a `setInterval(~250ms)` while `substate==='active'` dispatching `{ type:'TICK', durationMs: now - startedAt }` (timer + minute-bar update); cleared on leaving `active`.
  - **§7h post-stop routing** — `handleStop(reason)` (the stop button + the StopConfirm modal's onStop + `useRecordingLifecycle`'s `onStop` all funnel through it): a `handlingStopRef` double-stop guard; `dispatch({ type:'STOP' })` → `await HumynCapture.stop().catch(()=>{})` → `await HumynScreenBrightness.set(-1).catch(()=>{})` → `Orientation.unlockAllOrientations()` → if `isPractice` → `logEvent('recording_stopped')` + `speakCue('Recording stopped')` + `navigateToPracticeComplete(navigation)` (sub-60s practice STILL routes to PracticeComplete — no minimum; via `navigation.getParent()?.reset({ routes:[{ name:'OnboardingStack', state:{ routes:[{ name:'PracticeComplete' }] } }] })` with navigate/replace fallbacks); else if `durationMs >= 60_000` → `logEvent('recording_stopped')` + `speakCue('Recording stopped')` + `showToast(\`${formatContributionDuration(durationMs)} added to your contribution.\`)`+`navigateToHome(navigation)` (`getParent()?.navigate('MainTabs')`); else → `logEvent('recording_too_short')`+`showToast('Recording too short — discarded.')`+`dispatch({ type:'RESET_FOR_FRESH' })`(REC-05; the file deletion is HumynCapture's at finalize per REC-07 / 03-CONTEXT D-FS-*).`onSegmentStart`/`onSegmentComplete`are SILENT (CAP-10 / D-SEG-01 — no gate re-run, no voice cue), subscribed only to keep`segMetaRef.{recordingId,filenameBase}` current for telemetry.
  - **X button** — `if (substate==='active') dispatch({ type:'X_PRESSED' })` (→ stop-confirm modal, REC-06); else `HumynScreenBrightness.set(-1).catch(()=>{})` + `Orientation.unlockAllOrientations()` + `navigation.goBack()` (HAND-10 silent dismiss). The StopConfirmModal's `onStop` → `handleStop('manual')`; `onKeepRecording` → `dispatch({ type:'STOP_CONFIRM_CANCEL' })`.
  - **pre-flight → gate** — a useEffect keyed on `state.substate`: `const g = await checkStartGuards(); if (g.blocked) { showToast(g.toast); dispatch({ type:'PRE_FLIGHT_FAILED' }); } else dispatch({ type:'PRE_FLIGHT_OK', now })` (REC-16 storage <5GB / battery <5% — refuse, return to ready).
  - **mount/unmount** — on mount: read `compat.lastResult.v1`'s `ultrawideDfov.measuredDeg` from MMKV (110° spec-floor fallback if absent), read `getFlavorContext().versionName`, `pickAndSetEnInVoice().catch(()=>{})`, `Orientation.lockToLandscape()` (REC-01), the `RNFS.readDir(HAND_GATE_DIR).then(fs => fs.forEach(f => RNFS.unlink(f.path)))` sweep (Security V8/V12). On unmount: `Orientation.unlockAllOrientations()` + `HumynScreenBrightness.set(-1).catch(()=>{})` (REC-08) + `cleanupHandDetector().catch(()=>{})`. `useRecordingLifecycle({ substate, isPractice, durationMs, callbacks:{ onStop: handleStop, showToast, voiceCue: showVoiceCue (speakCue + the VoiceCue pill 1.8s), setAlert: (which, on) => on && dispatch(which==='battery'?{type:'BATTERY_ALERT'}:{type:'THERMAL_ALERT'}) } })`. A transient `recording-toast` view; the VoiceCuePill is now driven from `showVoiceCue`.
- **`__tests__/navigation/route-registry.test.ts`** (`test` `b79e7d3`) — `REQUIRED_PHASE_4_ROUTES = ['Recording', 'PracticeIntro', 'PracticeComplete']`; the practice routes moved here from `REQUIRED_PHASE_2_ROUTES` (where plan 04-06 had put them) so the Pattern-54 Phase-4 invariant covers all three Phase-4 routes in one block. `'Recording'` untouched (plan 04-07 owns it); the `phase6Plus` early-warning block untouched.
- **`vitest.setup.ts`** (`feat` `8f56a3a`) — added `NativeEventEmitter` (a no-op class — `addListener` returns `{ remove }`, the T-3.3-04 contract) to the react-native host shim, and a `@react-native-firebase/remote-config` global mock (`remoteConfig().{setDefaults,fetchAndActivate,getValue(...).asNumber()=0}`). RecordingScreen transitively needs both (the lifecycle hook's HumynPhoneState/HumynBattery construct a NativeEventEmitter on first subscribe; `readGateConfig` calls remote-config whose native-codegen `lib/index.js` can't be transformed under jsdom).
- **Tests** — `buildCaptureOpts.test.ts` (12 — `CaptureSessionOptsSchema.parse` accepts the built opts both practice + non-practice, throws on `consentPresent:false`, gender coercion + pass-through, duration rounding, `-apk` semver, dfov/startGate/location threading; `readGateConfig` returns the activated values clamped / clamps out-of-range / returns the defaults when RemoteConfig throws / still works when `fetchAndActivate` rejects); `handGate.test.tsx` (9 — `useHandGate` in isolation with fake timers: one tick = takePhoto → moveFile to `cacheDir/hand-gate/*.jpg` → detectHands(dest, minConf) → unlink(dest), `detectHands→2`=GATE_HIT, `→1`=GATE_MISS, reject=GATE_MISS, no-tick-when-inactive; RecordingScreen gate substate: `isHandDetectorAvailable()===false`→GATE_BYPASS+`recording_gate_bypassed`, the mount-time `cacheDir/hand-gate` sweep, Skip tap→GATE_SKIP+`recording_gate_skipped` with NO image/frame/bitmap prop, lock-landscape-on-mount + set(-1)-on-unmount); `RecordingScreen.test.tsx` (17, rewritten — chrome per substate incl. the LOCKED stop-modal copy, `gate.loading` "Preparing camera…" only when detector available, `gate.loading`+unavailable→bypassed event, REC-01/REC-08 orientation+brightness lifecycle, close pre-record→goBack / close active→stop-confirm, the gate-pass transition passed: vibrate(80)+speakCue+set(0.05)+`HumynCapture.start(<opts that CaptureSessionOptsSchema.parse accepts>)`→active, `start` reject `thermal_throttling`→set(-1)+toast+ready, Skip: NO vibrate(80) NO 'Recording started' cue BUT set(0.05) STILL + start STILL, practice stop→`HumynCapture.stop()`+nav toward PracticeComplete, real ≥60s stop→toast `…added to your contribution.`+nav toward MainTabs, real <60s stop→toast `Recording too short — discarded.`+RESET_FOR_FRESH, `checkStartGuards` blocked→toast+ready, OK→gate).

## Task Commits

- **Task 1: remoteConfigGate.ts (HAND-11) + buildCaptureOpts.ts (D-API-02 shape) + test** — `447dc19` (feat) — TDD task; test + impl in one `feat` commit (config `tdd_mode: false`, MVP_MODE/TDD_MODE not passed → the strict per-task RED/GREEN gate is not enforced).
- **Task 2 (+ Task 3's screen wiring): live recording surface — VC `<Camera>` + useHandGate + gate-pass transition + §7h routing + handGate.test + rewritten RecordingScreen.test + vitest.setup shims** — `8f56a3a` (feat) — TDD task; single `feat` commit. Tasks 2 and 3 both edit RecordingScreen.tsx heavily and interlock; the screen wiring + handGate.test + the rewritten RecordingScreen.test landed here, the route-registry edit in the next commit.
- **Task 3 (test-only deliverable): route-registry — REQUIRED_PHASE_4_ROUTES covers Recording + PracticeIntro + PracticeComplete** — `b79e7d3` (test).
- **D4-01 cleanup (authorized deviation): remove the Phase-3 `__DEV__` smoke seam + fix RootNativeStack.test setPermsGranted** — `c354d69` (fix).

**Plan metadata:** _(this commit)_ `docs(04-09): complete plan`

## Files Created/Modified

See `key-files` in the frontmatter. Highlights:

- `apps/mobile/src/lib/remoteConfigGate.ts` — NEW. `readGateConfig()` (HAND-11 RemoteConfig reads + the hard-coded Android-default fallback) + `GATE_DEFAULTS`.
- `apps/mobile/src/lib/buildCaptureOpts.ts` — NEW. `buildCaptureOpts()` (the D-API-02 `CaptureSessionOpts` assembly; consent never defaulted — throws if absent) + `coerceGender()`.
- `apps/mobile/src/screens/recording/useHandGate.ts` — NEW. The HAND-03/04/13 photo-to-disk poll loop + `HAND_GATE_DIR`.
- `apps/mobile/src/screens/recording/RecordingScreen.tsx` — replaced the 04-07 chrome-only shell with the live surface (camera mount, gate poll loop, gate-pass transition, HumynCapture.start, brightness/orientation, HAND-14 analytics, §7h routing, useRecordingLifecycle mount, start guards, cacheDir sweep).
- `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx` — rewritten (17 cases — from the 04-07 chrome-only shell test to the live-surface test).
- `apps/mobile/__tests__/screens/recording/handGate.test.tsx` — NEW (9 cases).
- `apps/mobile/__tests__/lib/buildCaptureOpts.test.ts` — NEW (12 cases).
- `apps/mobile/__tests__/navigation/route-registry.test.ts` — `REQUIRED_PHASE_4_ROUTES` now lists all three Phase-4 routes.
- `apps/mobile/vitest.setup.ts` — `NativeEventEmitter` shim + `@react-native-firebase/remote-config` global mock.
- `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` — D4-01: the `__DEV__` smoke seam removed.
- `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx` — D4-01: `NOOP_ACTIONS` added to `freshState()` so eagerly-rendered screens' store-action selectors don't return `undefined`.
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md` — D4-01 marked RESOLVED.

## Decisions Made

See `key-decisions` in the frontmatter — the substantive calls: (1) `buildCaptureOpts` sources `name`/`email` from `appStore.user`, `consentPresent` from `appStore.consent != null`, `age`/`gender` as `null` (the in-memory `UserDisplay` slice doesn't carry them); (2) `dfovDegrees` from MMKV's `measuredDeg` with a 110° spec-floor fallback (must be `> 0` for the schema); (3) VC lens by the `physicalDevices` filter (no stored `cameraId`; the plan's `<interfaces>` cameraId field doesn't exist on `CompatResult`); (4) `appVersion` from `getFlavorContext().versionName` (not `getConstants().BuildConfig.VERSION_NAME` — the binding exposes `versionName` directly); (5) HAND-08 bypass gated on `gate.phase==='loading'` (so the `__test_initialState` escape hatch / hot-reload doesn't clobber a waiting/confirmed render — fixes a visual-test regression); (6) Tasks 2+3's screen wiring folded into one commit (single-file integration); (7) two `vitest.setup.ts` shims (Rule 3 — `NativeEventEmitter` + the firebase remote-config mock).

## Deviations from Plan

### Authorized deviation — D4-01 cleanup

**1. [Rule 2 - Authorized] Removed the Phase-3 `__DEV__` smoke seam from `HomeSkeletonScreen.tsx` + fixed the `RootNativeStack.test.tsx` `setPermsGranted` rejection (D4-01)**

- **Found during:** plan handoff — the prompt explicitly designates this plan the D4-01 owner (commit `15d8a16`'s own message says the seam is "removed in Phase 4 when the real RecordingScreen wires up the start path", which is this plan).
- **Issue:** `HomeSkeletonScreen.tsx` carried a `__DEV__`-gated "▶ Smoke Capture (30s)" debug seam (direct `HumynCapture.start/stop` invoke) with 5 hardcoded hex literals (D-UI-01 gate failure) and, since plan 04-01's `__DEV__` shim, a rendering `__DEV__` block that drifted the `home-skeleton-screen` visual baseline; the eager-render of `PermissionsScreen` in `RootNativeStack.test.tsx` then hit `setPermsGranted is not a function` (the test's `freshState()` lacked the store actions) — 3 unhandled rejections. (Tracked as D4-01 since plan 04-01.)
- **Fix:** Deleted the entire `__DEV__` seam from `HomeSkeletonScreen.tsx` (the screen now imports only `View, ScrollView` from react-native; no `HumynCapture` import). The `home-skeleton-screen` visual baseline now passes cleanly (it never reflected the seam — the block crashed pre-04-01's shim, so the committed PNG is the no-seam render). Added a `NOOP_ACTIONS` block to `RootNativeStack.test.tsx`'s `freshState()` so eagerly-rendered screens' store-action selectors resolve to no-ops. The `no-hex-literals` test, the `HomeSkeletonScreen.visual` test, and `RootNativeStack.test.tsx` are all green; **full mobile suite: 0 failed / 0 errors**.
- **Files modified:** `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx`, `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx`, `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md`
- **Committed in:** `c354d69` (`fix(04-09): remove Phase-3 __DEV__ smoke seam per 15d8a16 + D4-01`)

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Added `NativeEventEmitter` + a `@react-native-firebase/remote-config` mock to `vitest.setup.ts`**

- **Found during:** Task 2 (rendering `RecordingScreen` under jsdom)
- **Issue:** `RecordingScreen` mounts `useRecordingLifecycle` (plan 04-08), whose `HumynPhoneState`/`HumynBattery` bindings construct a `NativeEventEmitter` on first subscribe — the canonical react-native shim didn't expose it (`No "NativeEventEmitter" export is defined`). And `readGateConfig` imports `@react-native-firebase/remote-config`, whose native-codegen `lib/index.js` is `Unexpected token 'typeof'` under Rollup/jsdom.
- **Fix:** Added a `NativeEventEmitter` no-op class to the react-native host shim (`addListener` returns `{ remove }` — the T-3.3-04 contract) and a `@react-native-firebase/remote-config` global mock (`remoteConfig().{setDefaults,fetchAndActivate,getValue(...).asNumber()=0}` so `readGateConfig` falls back to the hard-coded defaults). Same pattern/precedent as plan 04-06's `Vibration` shim, plan 04-07's `ActivityIndicator` shim.
- **Files modified:** `apps/mobile/vitest.setup.ts`
- **Committed in:** `8f56a3a` (Task 2 commit)

**3. [Rule 2 - Missing critical] `dfovDegrees` 110° spec-floor fallback in `RecordingScreen`**

- **Found during:** Task 2 (the RecordingScreen test asserting `CaptureSessionOptsSchema.parse(opts)`)
- **Issue:** the screen reads `dfovDegrees` from `compat.lastResult.v1.checks.ultrawideDfov.measuredDeg` in MMKV; if that's absent (corrupted store, a build that skipped compat) it would pass `0`, which fails the schema's `dfovDegrees > 0` — making `HumynCapture.start` reject with a Zod error.
- **Fix:** fall back to `110` (the `idea-brief §2.1` spec floor) when `measuredDeg` is absent/non-positive — the metadata stays parseable. Documented inline.
- **Files modified:** `apps/mobile/src/screens/recording/RecordingScreen.tsx`
- **Committed in:** `8f56a3a` (Task 2 commit)

**4. [Rule 1 - Bug] HAND-08 bypass gated on `gate.phase==='loading'`**

- **Found during:** Task 2 (the `recording-gate-ring-0`/`-50` visual baselines went red — 0.77% diff in the top region)
- **Issue:** dispatching `GATE_BYPASS` unconditionally on gate-substate entry (because jsdom's `NativeModules` is empty → `isHandDetectorAvailable()===false`) clobbered a `__test_initialState`-rendered `waiting`/`confirmed` phase → the reducer moved to `confirmed` → the waiting-phase Skip link disappeared → the visual baselines drifted.
- **Fix:** gate the bypass dispatch on `state.gate.phase === 'loading'` (the natural entry phase: `pre-flight → PRE_FLIGHT_OK → gate.loading`). A screen rendered directly into a later phase is past this gate; real-flow behavior is unchanged. The original `recording-gate-ring-*` baselines pass unchanged.
- **Files modified:** `apps/mobile/src/screens/recording/RecordingScreen.tsx`
- **Committed in:** `8f56a3a` (Task 2 commit)

**5. [Rule 1 - Adaptation] `RecordingScreen.test.tsx` rewritten (the 04-07 shell test broke)**

- **Found during:** Task 2 (the screen now imports `useRecordingLifecycle` / `@react-native-firebase/remote-config` / a dozen natives; the 04-07 chrome-only shell test mocked only `@react-navigation/native` + `analytics` → import failure / a `gate.loading` assertion failed because the bypass now changes the state)
- **Issue:** the plan's Task 3 step 7 says "extend the plan-04-07 render test"; in practice the screen changed enough that the test had to be rewritten (mock all the natives + libs + the lifecycle hook + a per-route-param `_routeParams`). The `gate.loading` "Preparing camera…" assertion now requires `isHandDetectorAvailable()===true` to be mocked (else the bypass fires and the loading spinner is replaced by the ring-100 chrome).
- **Fix:** rewrote `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx` as the live-surface test (17 cases — the plan's Task-3-step-7 assertion set + chrome-per-substate). Mocks all the natives/libs; `vi.spyOn(Vibration, 'vibrate')` on the global mock object (can't `importOriginal` react-native — the real `index.js` is Flow).
- **Files modified:** `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx`
- **Committed in:** `8f56a3a` (Task 2 commit)

---

**Total deviations:** 1 authorized (D4-01) + 4 auto-fixed (1 blocking shim, 1 missing-critical fallback, 1 visual-regression fix, 1 test rewrite).
**Impact on plan:** No scope creep beyond the explicitly-authorized D4-01 cleanup. All 8 plan-listed `files_modified` were created/modified (note: the plan's `__tests__/screens/RecordingScreen.test.tsx` path is actually `__tests__/screens/recording/RecordingScreen.test.tsx` — the existing 04-07 file). The plan's `<interfaces>` referenced two fields that don't exist (`CompatResult.checks.ultrawideDfov.cameraId`, `AppFlavor.getConstants().BuildConfig.VERSION_NAME`) — adapted to the real schema (`measuredDeg` + the physicalDevices filter; `getFlavorContext().versionName`). Tasks 2+3's screen wiring landed in one commit (single-file integration); Task 3's test-only deliverable a second.

## TDD Gate Compliance

Tasks 1 and 2 carry `tdd="true"`; config has `tdd_mode: false` (and `MVP_MODE`/`TDD_MODE` were not passed by the orchestrator), so the per-task RED/GREEN/REFACTOR commit-gate is not enforced. Task 1 (`447dc19`) + Task 2 (`8f56a3a`) each landed as a single `feat` commit (impl + test together). Task 3 is `type="auto"` — its test-only deliverable is a `test` commit (`b79e7d3`).

## Issues Encountered

- **`@react-native-firebase/remote-config` ESM transform failure under jsdom** — the package's `lib/index.js` is a native-codegen module (`Unexpected token 'typeof'` under Rollup). Mocked globally in `vitest.setup.ts` (the surface `readGateConfig` touches). Resolved before the Task-2 commit.
- **`vi.mock('react-native', importOriginal)` parse failure** — re-mocking `react-native` with `importOriginal()` pulls in the real `index.js` (Flow syntax) → Rollup parse failure. To override one export (`Vibration`) the test spies on the global mock's object (`vi.spyOn(Vibration, 'vibrate')`) instead. Resolved in the rewritten RecordingScreen test.
- **The `recording-gate-ring-0`/`-50` visual baselines went red** — the unconditional HAND-08 bypass clobbered the `__test_initialState`-rendered waiting phase (see Deviation 4). Fixed by gating the bypass on `gate.phase==='loading'`; the original baselines pass unchanged (no baseline regeneration needed).
- **Gradle/Android build still not runnable in this dev environment** (carried forward from plans 04-04/04-05/04-08) — `react-native-reanimated`'s RN-0.83 patch files don't compile + `google-services.json` absent. The plan's verification is the vitest suite (green); the on-hardware Wave-6 smoke (`04-MANUAL-SMOKE.md`, plan 04-10) is the [BLOCKING] gate that exercises the real camera handoff + the ±1 ms drift re-measurement.

## Known Stubs

None new. `remoteConfigGate.ts` / `buildCaptureOpts.ts` / `useHandGate.ts` are complete; `RecordingScreen.tsx` is the full live surface — the VC camera mount, the gate poll loop, the gate-pass→active TTS-masked transition, `HumynCapture.start(buildCaptureOpts(...))`, the §7h routing, `useRecordingLifecycle`, brightness/orientation, the HAND-14 analytics are all wired. The `SETTLE_MS = 80` camera-handoff delay is a deliberate [TUNABLE] constant with a drift-re-measurement comment for plan 04-10's [BLOCKING] smoke gate — not a stub. The `segMetaRef.{recordingId,filenameBase}` is wired-but-not-yet-consumed telemetry plumbing (Phase 5's upload pipeline consumes it). The `__DEV__` "Pretend I rotated →" pill in `RotatePrompt` (04-07) is unchanged — a deliberate dev-only entry, dead-code-eliminated in release.

## Threat Flags

| Flag     | File | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_ | —    | No new network endpoints / auth paths / schema changes at trust boundaries beyond the plan's `<threat_model>`. The camera-frame JPEGs are cacheDir-only + unlinked-in-finally + swept on mount (T-4.9-02, mitigated as planned); the HAND-14 telemetry carries `locale` only — the tests assert no `image`/`frame`/`bitmap` prop (T-4.9-03); `buildCaptureOpts` throws if consent is absent (T-4.9-04); the VC→HumynCapture handoff is strictly sequential (`isActive=false` → `SETTLE_MS` → `HumynCapture.start`) — T-4.9-01/T-4.9-06, the drift re-measurement is plan 04-10's [BLOCKING] gate. |

## User Setup Required

None — no external service configuration required. (Firebase Remote Config: when Firebase is wired in production, the `gate.consecutive_hits_required` / `gate.cadence_ms` / `gate.min_hand_detection_confidence` keys can be set in the console to retune the gate without an app release; until then `readGateConfig` returns the hard-coded Android defaults `5/400/0.5`.)

## Next Phase Readiness

- **Plan 04-10** (the Wave-6 on-hardware smoke runbook) — the [BLOCKING] gate is the ±1 ms `imu_video_drift_{max,mean,p99}` re-measurement on the new VC→HumynCapture camera handoff (must not regress Phase 3 smoke 7's mean 0.594 / p99 0.728 ms). The `SETTLE_MS = 80` constant in `RecordingScreen.tsx` is the tuning knob (bump it if `HumynCapture.start()` stalls because VC hasn't fully released Camera2; escalate a "HC.start() polls for camera availability" change to Phase 3 if 80 ms isn't enough). The smoke also exercises: the MediaPipe `HandLandmarker.detect()` first-call warm-up latency + peak-bitmap memory (plan 04-04 carry-forward), the gate `takePhoto()` cadence on low-RAM hardware, the TTS-masked transition timing, the brightness drop to 5%, the §7h routing on real navigation.
- **Phase 5 (HumynUpload)** — `recState.gate` (the `start_gate` block) survives onto `metadata.start_gate`; `buildCaptureOpts`'s `startGate` shape is the on-disk contract. The `segMetaRef.{recordingId,filenameBase}` plumbing is the per-segment telemetry the upload pipeline consumes.
- **Full mobile suite: 0 failed / 0 errors** — D4-01 closed; `tsc --noEmit` clean across mobile + api + shared/types. The Gradle/`react-native-reanimated` RN-0.83 compile break still blocks all Android Gradle tasks in this dev environment (carried forward — a future plan that touches the Android build should pin/patch `react-native-reanimated`).

## Self-Check: PASSED

All claimed files exist on disk:

- created: `apps/mobile/src/lib/remoteConfigGate.ts`, `apps/mobile/src/lib/buildCaptureOpts.ts`, `apps/mobile/src/screens/recording/useHandGate.ts`, `apps/mobile/__tests__/lib/buildCaptureOpts.test.ts`, `apps/mobile/__tests__/screens/recording/handGate.test.tsx`
- modified: `apps/mobile/src/screens/recording/RecordingScreen.tsx`, `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx`, `apps/mobile/__tests__/navigation/route-registry.test.ts`, `apps/mobile/vitest.setup.ts`, `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx`, `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx`, `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md`
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-09-SUMMARY.md`

Task commits present in `git log`: `447dc19` (feat — Task 1), `8f56a3a` (feat — Task 2 + Task 3 screen wiring), `b79e7d3` (test — Task 3 route-registry), `c354d69` (fix — D4-01 cleanup).

Verification: `npx vitest run` (apps/mobile) → **83 files / 559 tests, 0 failed, 0 errors** (D4-01 closed); `tsc --noEmit` clean across mobile + api + shared/types. Grep-checks on `RecordingScreen.tsx`: contains `HumynCapture.start(`, `buildCaptureOpts`, `HumynScreenBrightness.set(0.05)`, `HumynScreenBrightness.set(-1)`, `Vibration.vibrate(80)` (gated behind `passed`), `speakCue`, `useRecordingLifecycle`, `formatContributionDuration`, `pickAndSetEnInVoice`, `RESET_FOR_FRESH`, `SETTLE_MS` (with the drift-re-measurement comment), `lockToLandscape`, `recording_gate_skipped`, `recording_gate_started`, `added to your contribution.`, `Recording too short — discarded.`; `route-registry.test.ts` `REQUIRED_PHASE_4_ROUTES` lists `'Recording'`, `'PracticeIntro'`, `'PracticeComplete'`.
