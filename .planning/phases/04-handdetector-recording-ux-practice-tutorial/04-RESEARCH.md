# Phase 4: HandDetector, Recording UX & Practice Tutorial — Research

**Researched:** 2026-05-11
**Domain:** React Native recording surface — MediaPipe hand-gate (Kotlin native), VisionCamera↔HumynCapture camera handoff, landscape state machine, lifecycle-edge handlers, battery/thermal monitors, TTS voice fallback, practice-flow plumbing, first-time-tutorial gate.
**Confidence:** MEDIUM (partial — stream idle timeout; written from CONTEXT.md + CLAUDE.md pins + training knowledge of the named libraries. Several version/API claims tagged `[ASSUMED]` and flagged for planner verification.)

> ⚠️ **This RESEARCH.md was written under a forced stop (stream idle timeout).** Sections built from the locked decisions in `04-CONTEXT.md` and `CLAUDE.md` are HIGH confidence. Sections relying on un-re-verified library API details are tagged `[ASSUMED]` with `> TODO: planner should verify X` notes. The planner should treat `[ASSUMED]` claims as needing a quick Context7 / official-docs check before locking task actions.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 04-CONTEXT.md `<decisions>`)

**Camera handoff (gate ↔ active recording)**

- **D-CAM-01:** Gate uses `react-native-vision-camera@4.7.3` (preview + `takePhoto()` only — the locked CLAUDE.md / STACK pin). Active recording hands off to HumynCapture (Camera2, Phase 3). On gate-pass: VC unmounts → awaits camera close → `HumynCapture.start(opts)` → first frame. Phase 3's HumynCapture is NOT extended to expose preview; module stays single-responsibility.
- **D-CAM-02:** Gate-pass → active transition is **sequential, masked by TTS**. Order: ring fills → 80 ms vibrate → TTS "Recording started" enqueues (en-IN female; ~600 ms speaking time) → brightness drop to 5% → unmount VC + `HumynCapture.start(opts)` → await Promise → cross-fade preview to active substate. ~600 ms TTS line covers ~300–500 ms VC tear-down + HC start. If `start()` rejects mid-transition (`thermal_throttling` / `permission_revoked` / `storage_full`), abort: voice cue "Phone too warm" or analogous + return to ready substate.
- **D-CAM-03:** Gate camera lens read from `compat.lastResult.v1.checks.ultrawideDfov.cameraId`, passed explicitly to VC's `useCameraDevice()` filter so the gate sees what HC will record. JS reads the MMKV key once at RecordingScreen mount; same lens id flows into `start(opts).startGate` for traceability.
- **D-CAM-04:** HandDetector invocation is **photo-to-disk → path → native bitmap** per design-spec §7c verbatim: VC `Camera.takePhoto()` → `cacheDir/hand-gate/{ulid}.jpg` → `HandDetector.detectHands(path)` → Kotlin `BitmapFactory.decodeFile(path)` at 320×240 RGB_565 → MediaPipe `HandLandmarker.detect(MPImage)` → `result.landmarks().size` → return Int. Cache JPEGs cleaned up after each check (delete on resolve; app-launch sweep deletes stragglers). HAND-12 pre-warm: at RecordingScreen mount, run a single throwaway `takePhoto()` to warm CameraDevice + JPEG encoder.

**RecordingScreen route placement**

- **D-NAV-01:** `RecordingScreen` lives at **RootNativeStack level as sibling of MainTabs / Profile / HelpCenter / ForceUpgrade**. Tab bar suppressed structurally (HOME-08 already enforced). Single route handles isPractice=true AND isPractice=false. Screen options: `gestureEnabled: false`, `headerShown: false`, animation `fade`. `routeRegistry` invariant test (Pattern 54) gains `Recording`.
- **D-NAV-02:** **Practice-only PRODUCTION entry + `__DEV__`-gated debug affordance on TasksPlaceholderScreen** for non-practice. Production builds (apkRollout / playStore) strip the affordance via `__DEV__` guard. Debug affordance pushes `Recording` with hardcoded test task `{ taskId: 'cooking_chop_vegetables', taskName: 'Practice — Chop vegetables', isPractice: false }`.
- **D-NAV-03:** **`PracticeIntroScreen` added to OnboardingStack between RigTutorial and the Recording route.** RigTutorial's existing `Next` CTA navigates to `PracticeIntro` (target moves from MainTabs). PracticeIntro's `Start practice` CTA: `navigation.replace('Recording', { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true })` — jumping out of OnboardingStack into RootNativeStack route.
- **D-NAV-04:** **`PracticeCompleteScreen` added to OnboardingStack after isPractice=true Recording exit.** ONB-08 once-per-install-per-Google-account gate persisted as MMKV key `tutorial.practice_done.{googleAccountId}.v1` (keyed by Google account `sub` from JWT, versioned `.v1`). `computeInitialRoute` extension checks the per-account flag at boot; missing flag → OnboardingStack initial route remains RigTutorial. Continue CTA: writes the flag → `navigation.reset({routes: [{name: 'MainTabs'}]})` → Home first-time hero. Reinstall wipes MMKV → tutorial re-runs.

**Lifecycle-edge handler strategy**

- **D-LIFE-01:** **Single hook `useRecordingLifecycle` mounted in RecordingScreen.** Owns the `idea-brief.md §10` policy table — each event maps to one of: `stop()` (upload if ≥60 s, discard otherwise) | `continue()` | `alert+continue()` | `alert+refuse-new()`. Calls `HumynCapture.stop()` via D-SEG-02 veto window when policy says stop. Mounted in `useEffect`, torn down on unmount.
- **D-LIFE-02:** **Phone-call detection via in-house Kotlin module `HumynPhoneState` + AudioFocusChange fallback.** `TelephonyManager.registerTelephonyCallback()` (API 31+; minSdk 26 — fall back to deprecated `PhoneStateListener` for 26–30). DO NOT request `READ_PHONE_STATE` runtime perm. Subscribe ALSO to `AudioManager.OnAudioFocusChangeListener` for alarm/notification detection. Policy: phone OFFHOOK = stop+upload; phone IDLE after OFFHOOK = continue stopped; AudioFocus transient_loss with phone IDLE = alarm → stop+upload. Module sits in `ai.humynlabs.capture.phonestate`.
- **D-LIFE-03:** **Dependency strategy = minimal libs + in-house natives.** New RN deps (locked stack): `react-native-tts@4.1.1`, `react-native-vision-camera@4.7.3`, `react-native-worklets-core@1.6.3`, `react-native-reanimated@3.16.x`, `@shopify/react-native-skia@1.x` (≥1.2.1), `react-native-fs@2.20.0`, plus `react-native-orientation-locker@1.7.x` (the only non-CLAUDE-pinned addition; thin, well-maintained). New in-house Kotlin modules: `HumynHandDetector`, `HumynPhoneState`, `HumynBattery` (`Intent.ACTION_BATTERY_CHANGED` listener, ~50 LOC), `HumynScreenBrightness` (`WindowManager.LayoutParams.screenBrightness`, ~10–30 LOC). Battery-storage check uses `react-native-fs.getFSInfo()`.
- **D-LIFE-04:** **Crash-recovery UX = on-launch toast.** Phase 4 adds small extension to HumynCapture's package init to emit a one-shot `onCrashRecovery` event when Phase 3's app-launch sweep re-finalizes any orphan segments (sweep already exists per Phase 3 D-FS-04). Listener at app boot fires Home toast "Recording recovered after force-quit — uploading." Phase 5 picks up the segment via normal upload path. RecordingScreen NOT visible during recovery.

**Phase 4 wave structure**

- **D-WAVE-01:** Phase 4 = 5 waves (foundation/deps+shells → native impls → screens scaffold → state machine+lifecycle → smoke+recovery+Phase-3-UAT-retirement). See `<decisions>` in CONTEXT.md for the full per-wave breakdown.
- **D-WAVE-02:** No Wave 0 cosmetic fix-up. `02-COSMETIC-GAPS.md` and `03-W1-AMENDMENTS.md` both addressed/frozen. New gaps → `04-COSMETIC-GAPS.md`.
- **D-WAVE-03:** Visual snapshots = baseline static surfaces; skip live-camera substates. ~9–10 new baselines (see Specifics list in CONTEXT.md). Lives in `apps/mobile/__tests__/visual/`.
- **D-WAVE-04:** Phase 4 acceptance gate — on Pixel 10a: (1) practice flow E2E; (2) non-practice 10-min recording via dev affordance with gate-pass + 80 ms vibrate + TTS + brightness drop + active substate + 10-min auto-segment cut without gate re-run + Stop + "{Hh Mm} added" toast; (3) lifecycle edges (call-answered=stop, call-declined=continue, rotation=stop, force-quit=recover-on-launch-with-toast); (4) thermal injection (`adb shell cmd thermalservice override-status 4`) shows alert pill + 2.5-s graceful stop. Verifier accepts "module-ready + practice E2E passes + lifecycle edges manually verified" — Phase 3's seven pending hardware UAT items effectively retire here.

**Locked from upstream (carried forward):** Capture spec LOCKED (`idea-brief.md §2.1`); HumynCapture JS bridge LOCKED (Phase 3 D-API-01..03); practice files segregated by directory (D-FS-02); 10-min auto-segment owned by HumynCapture (D-SEG-01, no gate re-run at cuts per CAP-10); pre/mid-record thermal owned by HumynCapture (D-THERM-01); pause uploads on record start (CAP-13, Phase 5 wires it); designs LOCKED; TTS pinned `react-native-tts@4.1.1` with en-IN female → en-IN neutral → en-US female → first en-\* fallback chain; MediaPipe pinned `0.10.21`; VisionCamera pinned `4.7.3` + worklets-core 1.6.3 + reanimated 3.16.x + Skia ≥1.2.1; English only; no notifications channel / no `READ_PHONE_STATE` runtime perm; no `ACCESS_NOTIFICATION_POLICY` / no programmatic DND; no Sentry/Datadog; MMKV `.v1` versioning; native-module shape pattern; wave anti-patterns from Phase 2 `.continue-here.md`; no clan-chief constructs.

### Claude's Discretion (verbatim from 04-CONTEXT.md)

- `RecState` shape implementation — Zustand slice vs `useReducer` vs XState. Phase 2 used Zustand for global appStore; Phase 4 may use a `recordingStore` slice OR keep recState inside RecordingScreen via `useReducer`. Recommend `useReducer` unless other surfaces need to observe recording state (they don't — screen-local).
- Hand-gate cache file lifecycle — delete on resolve vs delete on next-tick vs accumulate-and-sweep at app-launch. Recommend delete-on-resolve + app-launch sweep belt-and-suspenders.
- HAND-12 pre-warm exact timing — at RecordingScreen mount vs ready-substate enter vs gate-substate enter. Recommend at mount (earliest, most slack).
- Battery polling cadence — `BatteryManager` listener fires on changes; confirm whether it delivers granular enough updates around 15%/5% thresholds, else periodic cross-check.
- Storage check cadence (REC-16) — only at `start()` time, or also every N minutes during active recording. Recommend at `start()` + a periodic guard (storage_full mid-record is handled by HC `onError` anyway).
- `useRecordingLifecycle` exact subscription shape — one big hook with sub-hooks vs flat top-level subscriptions.
- `__DEV__` debug affordance UI — long-press on TasksPlaceholder text vs hidden corner tap vs visible button. CONTEXT Specifics recommend long-press (>800 ms) on the heading.
- Hardcoded test task choice — recommended `cooking_chop_vegetables`; any 65-task entry from `task-taxonomy.md` that produces a clean smoke walk.
- `computeInitialRoute` extension exact signature.
- `onCrashRecovery` event payload shape — sketched as `{recovered: [filenameBase, ...]}`; finalize; listener is one-shot per app launch.
- Brightness restore ordering — on stop vs on screen unmount vs both. Spec says "restored on stop or exit" so both paths must restore.
- Stop confirmation modal title text — design-spec recommends `"Stop recording?"`. Body locked: `"Recordings under 1 minute are discarded."`
- VoiceCue overlay duration — design-spec §7d says 1.8 s for "Recording started" pill; pick dismissal animation.
- Post-stop toast routing — design-spec §7h: practice → Practice-done screen; real ≥60 s → toast + Home; real <60 s → toast + Ready substate. Pick exact navigation API (`replace` vs `goBack` + state reset).

### Deferred Ideas (OUT OF SCOPE for Phase 4)

- Tasks list / Task details / `Start Recording` CTA — Phase 6.
- Upload pipeline (UP-01..19) — Phase 5.
- Hash-verify worker + IMU-liveness backend check — Phase 5.
- iOS analogues (`HumynHandDetector` Swift via MediaPipeTasksVision pod 0.10.21, `HumynPhoneState` via CXCallObserver, AVSpeechSynthesizer TTS, `UIScreen.main.brightness`, CoreMotion orientation) — Phase 7.
- Continuous on-device hands-in-frame enforcement during recording (cue loop / auto-stop on absence) — out of MVP; only the one-shot pre-record gate.
- Per-locale `recording_gate_skipped` rate telemetry dashboard cohort (HAND-14) — Phase 4 wires the Firebase Analytics event; the dashboard cohort is Phase 7 (OBS-03).
- Hand-gate target hits / cadence / confidence tuning via Remote Config (HAND-11) — Phase 4 wires the reads; ongoing tuning is operational.
- Bystander-consent in-app secondary-subject screen — out of scope at MVP.
- Mobile dark mode for non-recording surfaces — out of scope; only the recording surface is dark.
- Stale clan-chief / KGeN narrative cleanup — deferred; needs `/gsd:cleanup` pass.
- Phase 3 hardware UAT items #1–#7 — effectively retire during Phase 4 Wave 5 smoke; verifier should not separately re-block.
- `04-COSMETIC-GAPS.md` — created during Wave 5 smoke if needed.
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

> Requirement text below is paraphrased from `.planning/REQUIREMENTS.md` line references in CONTEXT.md (HAND-01..14 lines 110–125; REC-01..16 lines 127–144; ONB-03..08 lines 55–60). **Planner must read REQUIREMENTS.md directly to confirm exact wording — this table is a structural guide, not a substitute.**

| ID bucket   | Coverage area                                                                                                                                                                                                                                                                            | Research support                                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ONB-03..08  | Tutorial practice flow: practice-intro screen, 60-s practice recording, practice-complete screen, ONB-08 once-per-install-per-Google-account gate                                                                                                                                        | D-NAV-03/04, MMKV `tutorial.practice_done.{sub}.v1` key, `computeInitialRoute` extension. See "Practice flow & first-time-tutorial enforcement" below.                                                                             |
| HAND-01..14 | Hand-gate: MediaPipe HandLandmarker IMAGE mode, 0.10.21 pin, `numHands=2`, CPU delegate, 320×240 RGB_565 decode (HAND-13), pre-warm (HAND-12), Remote Config tuning (HAND-11), `recording_gate_skipped` telemetry (HAND-14), skin-tone-bias mitigation via ultrawide-POV lens (D-CAM-03) | D-CAM-01..04, `HumynHandDetector` module. See "MediaPipe HandLandmarker" + "VisionCamera↔HumynCapture handoff" below.                                                                                                             |
| REC-01..16  | Recording surface: §7 multi-state machine, rotate-prompt, ready, gate (loading/waiting/confirmed), active, stop-confirm modal, post-stop toasts, 10-min auto-segment (HC-owned), battery monitor (REC ~ 15%/5%), thermal listener, storage guard (REC-16), no programmatic DND (REC-09)  | `recState` machine (eng-handoff §4.3), `useRecordingLifecycle` hook, `HumynBattery`/`HumynScreenBrightness`, lifecycle policy table. See "Landscape state machine" + "Lifecycle-edge handlers" + "Battery/thermal monitors" below. |

> TODO: planner should map each individual REQ-ID to a specific task + verification step. This research could not enumerate REQUIREMENTS.md line-by-line before the timeout.
> </phase_requirements>

---

## Summary

Phase 4 assembles the recording surface end-to-end on top of Phase 3's `HumynCapture` Camera2+MediaCodec module. The novel technical pieces are: (1) a small Kotlin native module `HumynHandDetector` wrapping MediaPipe `HandLandmarker` in IMAGE mode (single-frame, hand-count only) — a near-verbatim port of Figure's reverse-engineered pattern in `figure-app-hands.md`; (2) a `react-native-vision-camera@4.7.3` preview-and-`takePhoto()` gate substate that hands the camera off to HumynCapture on gate-pass, with the handoff latency masked by a TTS "Recording started" line; (3) a `recState` state machine (shape locked in `engineering-handoff.md §4.3`) covering rotate-prompt → ready → gate(loading/waiting/confirmed) → active → stop-confirm → post-stop toasts; (4) a `useRecordingLifecycle` hook implementing the `idea-brief.md §10` policy table over AppState / Linking / phone-state / audio-focus / orientation / battery / storage; (5) three more tiny in-house Kotlin modules (`HumynPhoneState`, `HumynBattery`, `HumynScreenBrightness`); and (6) the practice-tutorial flow with a once-per-install-per-Google-account MMKV gate.

The dominant risk is **the ±1 ms video↔IMU drift invariant** (the project's non-negotiable, the reason audio was dropped — see CLAUDE.md banner). Phase 4 does not change HumynCapture's encoder, but it introduces a NEW moment where camera ownership transfers (VC → HC) under a time budget masked by TTS; drift must be re-measured at the gate→record handoff and on every lifecycle-edge recovery path that calls `HumynCapture.start()` again. The second-largest risk is **OEM phone-state quirks** (Xiaomi MIUI, Oppo ColorOS) where `TelephonyCallback` / `PhoneStateListener` and `AudioFocusChangeListener` behave inconsistently — `.planning/research/PITFALLS.md` is the canonical catalog.

**Primary recommendation:** Treat the gate→record handoff (D-CAM-02 ordering) and the lifecycle-edge recovery paths as the two highest-risk surfaces. Re-measure drift on hardware (Pixel 10a / 7a-class) for both. Port `HumynHandDetector` verbatim from `figure-app-hands.md` — do not improvise on MediaPipe config. Keep `recState` screen-local (`useReducer`) unless a concrete cross-surface reader emerges. Wire all four new Kotlin modules off the Phase 3 `HumynCompatModule.kt` / `HumynCaptureModule.kt` ergonomic templates.

---

## Architectural Responsibility Map

| Capability                                  | Primary Tier                                                               | Secondary Tier                                                                         | Rationale                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-count detection on a single frame      | Native Android (Kotlin `HumynHandDetector` + MediaPipe)                    | —                                                                                      | MediaPipe Tasks Vision is a native lib; image decode at 320×240 RGB_565 must happen in Kotlin. JS only orchestrates poll cadence.      |
| Gate camera preview + `takePhoto()`         | RN/JS (VisionCamera 4.7.3)                                                 | Native (VC's own Kotlin)                                                               | VC is the locked, supported surface for preview; HumynCapture intentionally does NOT expose preview (single-responsibility, D-CAM-01). |
| Active HEVC video + IMU capture             | Native Android (`HumynCapture`, Phase 3)                                   | —                                                                                      | Phase 3 owns the locked capture spec; Phase 4 only calls `start()`/`stop()` and reads events.                                          |
| `recState` state machine                    | RN/JS (RecordingScreen, `useReducer`)                                      | —                                                                                      | Screen-local UI state; no other surface needs to observe it.                                                                           |
| Lifecycle-edge policy (§10 table)           | RN/JS (`useRecordingLifecycle` hook)                                       | Native (event sources: `HumynPhoneState`, `HumynBattery`, AppState, orientation, RNFS) | Policy is pure JS; the event sources that feed it are native (call state, battery, audio focus) or RN built-ins (AppState, Linking).   |
| Phone-call / audio-focus detection          | Native Android (`HumynPhoneState`)                                         | —                                                                                      | `TelephonyManager.registerTelephonyCallback()` / `PhoneStateListener` / `AudioManager.OnAudioFocusChangeListener` are platform APIs.   |
| Battery level transitions (15% / 5%)        | Native Android (`HumynBattery` over `ACTION_BATTERY_CHANGED`)              | RN/JS (threshold logic)                                                                | `ACTION_BATTERY_CHANGED` is a sticky broadcast; Kotlin emits level/scale; JS computes the threshold transitions.                       |
| Screen brightness drop/restore at gate exit | Native Android (`HumynScreenBrightness` over `WindowManager.LayoutParams`) | RN/JS (call sites)                                                                     | Brightness write must be on the activity's UI thread; not exposable purely from JS.                                                    |
| Thermal monitoring                          | Native Android (`HumynCapture`, Phase 3 D-THERM-01)                        | RN/JS (listens to `onThermalAbort`)                                                    | Owned by Phase 3; Phase 4 only listens and fires the voice cue + toast.                                                                |
| Orientation / rotation lock                 | RN/JS (`react-native-orientation-locker@1.7.x`)                            | Native (its own Kotlin)                                                                | Thin, well-maintained lib; the only non-CLAUDE-pinned addition (D-LIFE-03).                                                            |
| TTS voice cues                              | RN/JS (`react-native-tts@4.1.1`)                                           | Native (Android `TextToSpeech` engine)                                                 | Locked pin; voice-fallback chain implemented in JS over the lib's voice-enumeration API.                                               |
| Practice-flow navigation                    | RN/JS (React Navigation: OnboardingStack + RootNativeStack)                | —                                                                                      | Pure navigation graph extension.                                                                                                       |
| Once-per-install-per-account tutorial gate  | RN/JS (MMKV `tutorial.practice_done.{sub}.v1` + `computeInitialRoute`)     | —                                                                                      | MMKV already wired (Phase 2); JWT `sub` derives the key.                                                                               |
| Crash-recovery toast                        | RN/JS (boot listener)                                                      | Native (`HumynCapture` package init emits `onCrashRecovery`)                           | Phase 3's app-launch sweep already re-finalizes orphans; Phase 4 adds one event + a Home toast.                                        |

---

## Standard Stack

### Core (all LOCKED in CLAUDE.md — versions carried, not re-chosen)

| Library                        | Version        | Purpose                                                                                                                                        | Why Standard                                                                     |
| ------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `react-native-vision-camera`   | `4.7.3`        | Gate substate preview + `Camera.takePhoto()` polling. NOT used for HEVC video.                                                                 | Locked pin. V4-Skia frame-processor minimum stack. V5 (Nitro rewrite) deferred.  |
| `react-native-worklets-core`   | `1.6.3`        | VisionCamera V4 worklets dependency (V4 pairs with this, NOT `react-native-worklets`).                                                         | Locked pin; V4 hard dependency.                                                  |
| `react-native-reanimated`      | `3.16.x`       | Gate-ring fill animation, transition cross-fades. 4.x too new for RN 0.83 ecosystem.                                                           | Locked pin.                                                                      |
| `@shopify/react-native-skia`   | `1.x` (≥1.2.1) | Gate ring rendering / any custom canvas in recording chrome. V4 Skia frame-processor minimum.                                                  | Locked pin.                                                                      |
| `react-native-tts`             | `4.1.1`        | Voice cues ("Recording started", thermal/battery alerts).                                                                                      | Locked pin; correct tool (NOT `react-native-track-player`/`react-native-sound`). |
| `react-native-fs`              | `2.20.0`       | `getFSInfo()` for REC-16 storage guard; `cacheDir/hand-gate/` JPEG writes & sweep.                                                             | Locked pin.                                                                      |
| `react-native-mmkv`            | `4.3.1`        | `tutorial.practice_done.{sub}.v1` key; reads `compat.lastResult.v1` (lens id) + `auth.jwt.v1`.                                                 | Locked pin; already wired Phase 2.                                               |
| `react-native-haptic-feedback` | `2.3.3`        | 80 ms gate-pass vibrate; `[40,80,40]` practice-done; `[100,50,100]` battery-alert; 800 ms thermal-alert.                                       | Already in deps (CONTEXT code-context note).                                     |
| `lucide-react-native`          | `1.14.0`       | Recording chrome icons (32-px circular X close, etc.).                                                                                         | Locked pin.                                                                      |
| `react-native-config`          | `1.6.1`        | Flavor/env reads (apkRollout vs playStore for the `__DEV__` affordance strip — note `__DEV__` is the build-type guard; flavor reads via this). | Locked pin.                                                                      |

### Supporting (Phase 4 additions)

| Library                           | Version | Purpose                                                                                                                     | When to Use                                                                                                                                                                                          |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-orientation-locker` | `1.7.x` | Lock recording surface to landscape; observe orientation transitions for the §10 "NOT in landscape mid-record → stop" edge. | **The only non-CLAUDE-pinned new dep.** D-LIFE-03 calls it thin & well-maintained. `> TODO: planner should verify 1.7.x is current & RN-0.83/new-arch compatible — confirm via npm + GitHub issues.` |

### In-house Kotlin native modules (Phase 4 ships four)

| Module                  | Approx LOC           | Wraps                                                                                                                                                                           | Package                                 |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `HumynHandDetector`     | ~95 (mirrors Figure) | MediaPipe `HandLandmarker` IMAGE mode, `numHands=2`, all confidences 0.5, CPU delegate; `BitmapFactory.decodeFile` at 320×240 RGB_565; returns `result.landmarks().size` as Int | `ai.humynlabs.capture.handdetector`     |
| `HumynPhoneState`       | ~60–90               | `TelephonyManager.registerTelephonyCallback()` (API 31+) / `PhoneStateListener` (API 26–30) + `AudioManager.OnAudioFocusChangeListener`                                         | `ai.humynlabs.capture.phonestate`       |
| `HumynBattery`          | ~50                  | `Intent.ACTION_BATTERY_CHANGED` sticky broadcast receiver; emits level/scale (and optionally `BatteryManager.BATTERY_PROPERTY_CAPACITY`)                                        | `ai.humynlabs.capture.battery`          |
| `HumynScreenBrightness` | ~10–30               | `WindowManager.LayoutParams.screenBrightness` write/restore on the current activity's UI thread                                                                                 | `ai.humynlabs.capture.screenbrightness` |

### MediaPipe dependency declaration (LOCKED pin)

| Dependency                          | Version   | Notes                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `com.google.mediapipe:tasks-vision` | `0.10.21` | Android Gradle dep. **Pin reason: iOS pod `MediaPipeTasksVision` 0.10.33+ has XCFramework linking issues (mediapipe #6258).** Lock Android + iOS at 0.10.21 together (iOS is Phase 7).                                                                                                                                                                     |
| `hand_landmarker.task` asset        | ~7.8 MB   | Bundled in the APK assets (or `android/app/src/main/assets/`); loaded via the MediaPipe task options `setModelAssetPath(...)` or an `BaseOptions.builder().setModelAssetPath("hand_landmarker.task")`. `> TODO: planner should verify the exact 0.10.21 BaseOptions/HandLandmarkerOptions builder API — see "Code Examples" §HandDetector for the sketch.` |

### Alternatives Considered (all rejected upstream — do not revisit)

| Instead of                                                   | Could Use                                        | Why Rejected                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VisionCamera for the gate                                    | VisionCamera V5 (Nitro)                          | Deferred; 4.7.3 is the locked, ecosystem-stable pin.                                                                                                                                                                                         |
| VisionCamera `takePhoto()` polling                           | VisionCamera frame processor + Skia (continuous) | CONTEXT D-CAM-04 mandates photo-to-disk → path → native bitmap (design-spec §7c verbatim, mirrors Figure). Frame-processor path not chosen — keeps JPEG-on-disk artifact for traceability and matches the reverse-engineered Figure pattern. |
| In-house `HumynHandDetector`                                 | Third-party RN MediaPipe wrapper                 | CLAUDE.md: unmaintained; in-house module is ~95 LOC.                                                                                                                                                                                         |
| MediaPipe `tasks-vision` 0.10.33+                            | Latest                                           | iOS pod XCFramework linking bug; locked at 0.10.21.                                                                                                                                                                                          |
| `react-native-orientation` (old) / `expo-screen-orientation` | —                                                | Old/archived or Expo-coupled; `orientation-locker` is the maintained choice.                                                                                                                                                                 |

**Installation:** (locked deps already present or in CLAUDE.md table; the genuinely new line is:)

```bash
npm install react-native-orientation-locker@^1.7.0
# (vision-camera/worklets-core/reanimated/skia/tts/fs may already be in package.json
#  from earlier-phase scaffolding — planner confirms against apps/mobile/package.json)
```

Add to `android/app/build.gradle` dependencies:

```gradle
implementation "com.google.mediapipe:tasks-vision:0.10.21"
```

**Version verification:** `> TODO: planner should run `npm view react-native-orientation-locker version`and`npm view react-native-vision-camera@4.7.3 version`(confirm 4.7.3 still on registry) before locking. Also confirm`com.google.mediapipe:tasks-vision:0.10.21` is on Maven Central. Training-data versions are stale; CLAUDE.md pins are authoritative but the planner should still sanity-check availability.`

---

## Architecture Patterns

### System Architecture Diagram (data flow)

```
                          RigTutorialScreen (Phase 2, retargeted)
                                   │  Next CTA →
                                   ▼
                          PracticeIntroScreen  (NEW, OnboardingStack)
                                   │  Start practice → navigation.replace('Recording',
                                   │                    {taskId:'__practice__', isPractice:true})
                                   ▼
        ┌──────────────────────── RecordingScreen (NEW, RootNativeStack sibling of MainTabs) ───────────────────────┐
        │                                                                                                          │
        │   useReducer(recState)  ◄────────── useRecordingLifecycle hook (§10 policy table) ◄── AppState            │
        │        │                                                          │  ▲              ◄── Linking          │
        │        │ substate transitions                                     │  │              ◄── Orientation      │
        │        ▼                                                          │  │                  (orientation-   │
        │   rotate-prompt ─(landscape)→ ready ─(tap record)→ gate ─(N hits)→ active ─(Stop)→ stop-confirm-modal     │
        │                                  │                  │   ▲          │     ▲             │                │
        │                                  │ HAND-12 pre-warm  │   │ poll     │     │ events      │ confirm        │
        │                                  ▼                   │   │ 400ms    │     │             ▼                │
        │                          VC takePhoto() ── JPEG ──► cacheDir/hand-gate/{ulid}.jpg                        │
        │                                  │                   │                    │                             │
        │                                  │   path ──────────►│                    │                             │
        │                                  ▼                   ▼                    │             post-stop:      │
        │                          HumynHandDetector.detectHands(path) ─► Int        │             practice→Practice│
        │                          (Kotlin: BitmapFactory.decodeFile @320×240        │             Complete;       │
        │                           RGB_565 → MediaPipe HandLandmarker.detect)        │             real≥60s→toast  │
        │                                                                            │             +Home;          │
        │   gate.confirmed transition (D-CAM-02, TTS-masked):                         │             real<60s→toast  │
        │     vibrate(80) → Tts.speak('Recording started') → HumynScreenBrightness.set(0.05)                        │
        │       → VC.unmount() → await close → HumynCapture.start(opts{isPractice, startGate})  ───────┐            │
        │                                                                                              │            │
        └──────────────────────────────────────────────────────────────────────────────────────────────│────────────┘
                                                                                                       ▼
                                                                          HumynCapture (Phase 3, Camera2+MediaCodec)
                                                                          owns: HEVC video, IMU @100Hz, ±1ms drift,
                                                                          10-min auto-segment, thermal, FGS, app-launch sweep
                                                                                  │ events
                                                                                  ▼
                                          onSegmentStart / onSegmentComplete / onSessionStop / onThermalAbort / onError
                                                                                  │
                                                                                  ▼
                          (Phase 5: upload pipeline picks up recordings/ & practice/ — OUT of Phase 4 scope)

  At app boot:  HumynCapture package init → app-launch sweep re-finalizes orphans → emit onCrashRecovery {recovered:[...]}
                       → JS boot listener → Home toast "Recording recovered after force-quit — uploading."

  Practice complete:  PracticeCompleteScreen.Continue → mmkv.set('tutorial.practice_done.{jwt.sub}.v1', true)
                       → navigation.reset({routes:[{name:'MainTabs'}]}) → Home first-time hero
  At boot:  computeInitialRoute → if !mmkv.getBoolean('tutorial.practice_done.{sub}.v1') → OnboardingStack@RigTutorial
                                                                                       else → MainTabs
```

### Component Responsibilities (file → implementation)

| File (planned path)                                                       | Responsibility                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------ | ---------------- | ------------------------------------------------- |
| `apps/mobile/src/native/HumynHandDetector.ts`                             | Typed JS binding: `detectHands(path: string): Promise<number>`; thin wrapper over `NativeModules.HumynHandDetector`.                                                                                                                                                                                             |
| `apps/mobile/android/.../handdetector/HumynHandDetectorModule.kt`         | `ReactContextBaseJavaModule`; `@ReactMethod detectHands(path, promise)`; lazily constructs `HandLandmarker`; `BitmapFactory.decodeFile` @ 320×240 RGB_565; `landmarker.detect(BitmapImageBuilder(bitmap).build())`; `promise.resolve(result.landmarks().size)`; `bitmap.recycle()` in `finally`.                 |
| `apps/mobile/android/.../handdetector/HumynHandDetectorPackage.kt`        | `ReactPackage` registration.                                                                                                                                                                                                                                                                                     |
| `apps/mobile/src/native/HumynPhoneState.ts`                               | Typed binding: events `onCallStateChanged({state:'OFFHOOK'                                                                                                                                                                                                                                                       | 'IDLE' | 'RINGING'})`, `onAudioFocusChanged({focus:'loss' | 'transient_loss' | 'gain'})`; `start()`/`stop()` listener lifecycle. |
| `apps/mobile/android/.../phonestate/HumynPhoneStateModule.kt`             | `TelephonyManager.registerTelephonyCallback(executor, callback)` (API 31+) / `listen(PhoneStateListener, LISTEN_CALL_STATE)` (26–30); `AudioManager.requestAudioFocus`-adjacent `OnAudioFocusChangeListener` (or just register a listener via `AudioFocusRequest` if needed); emits via `RCTDeviceEventEmitter`. |
| `apps/mobile/src/native/HumynBattery.ts`                                  | Typed binding: event `onBatteryChanged({level:number /*0..1*/, isCharging:boolean})`.                                                                                                                                                                                                                            |
| `apps/mobile/android/.../battery/HumynBatteryModule.kt`                   | Registers a `BroadcastReceiver` for `Intent.ACTION_BATTERY_CHANGED`; computes `level/scale`; emits on change.                                                                                                                                                                                                    |
| `apps/mobile/src/native/HumynScreenBrightness.ts`                         | Typed binding: `set(value: number /*0..1, or -1 to restore system default*/): Promise<void>`.                                                                                                                                                                                                                    |
| `apps/mobile/android/.../screenbrightness/HumynScreenBrightnessModule.kt` | On UI thread: `currentActivity.window.attributes = attrs.also { it.screenBrightness = value }`; keep a saved prior value (or use `LayoutParams.BRIGHTNESS_OVERRIDE_NONE` to restore).                                                                                                                            |
| `apps/mobile/src/screens/recording/RecordingScreen.tsx`                   | Owns `recState` (`useReducer`), substate chrome, VC mount in gate substate, gate-pass transition, mounts `useRecordingLifecycle`.                                                                                                                                                                                |
| `apps/mobile/src/screens/recording/useRecordingLifecycle.ts`              | Subscribes to all event sources; applies §10 policy table; calls `HumynCapture.stop()` via D-SEG-02 veto window; fires TTS alert lines.                                                                                                                                                                          |
| `apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx`                | design-spec §6 verbatim; `Start practice` → `navigation.replace('Recording', {…isPractice:true})`.                                                                                                                                                                                                               |
| `apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx`             | design-spec §8 verbatim; confetti + 96×96 badge + scale-pop 500 ms + vibrate `[40,80,40]`; `Continue` → MMKV write + `navigation.reset`.                                                                                                                                                                         |
| `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` (edit)           | Change `Next` CTA target → `PracticeIntro`.                                                                                                                                                                                                                                                                      |
| `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` (edit)         | Add `__DEV__`-guarded long-press (>800 ms) on heading → push `Recording` with hardcoded test task `isPractice:false`.                                                                                                                                                                                            |
| `apps/mobile/src/navigation/RootNativeStack.tsx` (edit)                   | Add `Recording` route (`gestureEnabled:false`, `headerShown:false`, animation `fade`).                                                                                                                                                                                                                           |
| `apps/mobile/src/navigation/OnboardingStack.tsx` (edit)                   | Add `PracticeIntro` + `PracticeComplete` routes.                                                                                                                                                                                                                                                                 |
| `apps/mobile/src/state/initialRoute.ts` (edit)                            | Extend `computeInitialRoute` with per-account tutorial flag check (decode JWT `sub`, read MMKV).                                                                                                                                                                                                                 |
| `apps/mobile/android/.../MainApplication.kt` (edit)                       | Register the four new `ReactPackage`s; wire the `onCrashRecovery` boot listener relay.                                                                                                                                                                                                                           |
| `apps/mobile/src/.../bootRecoveryListener.ts` (new)                       | One-shot subscription to `HumynCapture.onCrashRecovery` → Home toast.                                                                                                                                                                                                                                            |
| `apps/mobile/__tests__/visual/__image_snapshots__/`                       | ~9–10 new baselines (see CONTEXT Specifics list).                                                                                                                                                                                                                                                                |

### Recommended Project Structure (Phase 4 deltas only)

```
apps/mobile/
├── src/
│   ├── native/
│   │   ├── HumynHandDetector.ts          # NEW
│   │   ├── HumynPhoneState.ts            # NEW
│   │   ├── HumynBattery.ts               # NEW
│   │   └── HumynScreenBrightness.ts      # NEW
│   ├── screens/
│   │   ├── recording/
│   │   │   ├── RecordingScreen.tsx       # NEW
│   │   │   ├── recState.ts               # NEW (reducer + types; shape from eng-handoff §4.3)
│   │   │   ├── useRecordingLifecycle.ts  # NEW
│   │   │   └── components/                # gate ring, voice-cue pill, stop modal, alert pill
│   │   └── tutorial/
│   │       ├── PracticeIntroScreen.tsx   # NEW
│   │       └── PracticeCompleteScreen.tsx# NEW
│   ├── navigation/                       # EDIT RootNativeStack, OnboardingStack
│   └── state/initialRoute.ts             # EDIT
└── android/app/src/main/
    ├── assets/hand_landmarker.task       # NEW (~7.8 MB) — confirm placement vs Gradle asset dir
    └── java/ai/humynlabs/capture/
        ├── handdetector/                 # NEW module + package
        ├── phonestate/                   # NEW
        ├── battery/                       # NEW
        └── screenbrightness/             # NEW
```

### Pattern 1: Photo-to-disk hand-gate poll loop (D-CAM-04)

**What:** In the gate substate, every ~400 ms (Remote Config `gate.cadence_ms`), call VC `Camera.takePhoto()` → write `cacheDir/hand-gate/{ulid}.jpg` → `HumynHandDetector.detectHands(path)` → if return ≥1 (or whatever HAND spec demands — likely ≥1 hand is enough; design uses "hand-count only"), increment `consecutiveHits`; reset to 0 on a miss; on `consecutiveHits >= gate.consecutive_hits_required` (default 5 Android), transition to `gate.confirmed`. Delete the JPEG on every resolve (pass/fail/skip).

**When to use:** The gate substate only. Stop the loop on transition out (confirmed / skipped / screen unmount).

**Example:** see "Code Examples" below.

### Pattern 2: TTS-masked camera handoff (D-CAM-02 / CONTEXT Specifics ordering)

**What:** The gate→active transition reassigns camera ownership from VC to HumynCapture. VC tear-down + HC `start()` is ~300–500 ms — long enough to look like a stall. Front-load an 80 ms haptic, enqueue a ~600 ms TTS "Recording started" line, drop brightness to 5%, THEN unmount VC, await close (~50 ms), call `HumynCapture.start(opts)`, await the Promise, cross-fade to active. The TTS line covers the gap; the user perceives a continuous "started" moment. If `start()` rejects, abort to `ready` with the matching toast/voice cue.

**Critical:** This is the moment to re-measure ±1 ms drift. `HumynCapture` owns drift, but the camera-was-just-released-by-another-process condition is new in Phase 4. **Re-measure on hardware.** If `start()` ever needs a settle delay before the camera is reliably free, that's a tuning knob the planner exposes.

### Pattern 3: `recState` reducer (shape from `engineering-handoff.md §4.3`)

**What:** A discriminated-union substate enum plus a `gate` sub-object: `gate.phase` (`loading`|`waiting`|`confirmed`), `gate.consecutiveHits`, `gate.targetHits`, `gate.cadenceMs`, `gate.skipped`, `gate.bypassed`. Implement as a `useReducer` inside `RecordingScreen` (Claude's discretion — recommend `useReducer` over Zustand/XState since it's screen-local). `> TODO: planner should read engineering-handoff.md §4.3 and reproduce the RecState shape verbatim — this research did not have the file's exact field list in hand at timeout.`

### Pattern 4: §10 lifecycle policy table → hook (D-LIFE-01)

**What:** `useRecordingLifecycle` subscribes to every event source, maps each event to one of `{stop, continue, alert+continue, alert+refuse-new}` per the table reproduced in CONTEXT Specifics. `stop()` = `HumynCapture.stop()` via the D-SEG-02 veto window, then route by duration (≥60 s upload / <60 s discard — HC's directory routing handles practice). Reproduced table (from CONTEXT Specifics, mirrors `idea-brief.md §10`):

```
AppState 'background' (mid-record)        → stop()  // upload if ≥60s, discard else
AppState 'inactive' → 'background' chain  → stop()
Linking 'force-quit'                      → no JS hook; HumynCapture FGS handles; recovery on launch (D-LIFE-04)
PhoneState OFFHOOK                        → stop()
PhoneState IDLE after OFFHOOK             → no-op (already stopped)
AudioFocusChange transient_loss + IDLE    → stop()  // alarm
Orientation NOT landscape (mid-record)    → stop()  + toast "keep the phone in landscape"
Battery ≤15% (transition)                 → alert+continue() // toast + 520Hz beep + [100,50,100] haptic + voice
Battery ≤5% (transition, mid-record)      → stop()
Battery <5% (start guard)                 → refuse-new() until ≥15%
Storage <5GB (start guard, REC-16)        → refuse-new() with toast
Storage write failure mid-record          → HC emits onError({code:'storage_full'}); JS → stop()
Logout                                    → stop(); preserve queue (Phase 5 owns queue)
Permission revoked (Camera/Mic) mid-record→ HC emits onError({code:'permission_revoked'}); JS → stop()
Thermal ≥THROTTLING (start guard)         → HC start() rejects with thermal_throttling; toast
Thermal ≥THROTTLING_SEVERE (mid-record)   → HC emits onThermalAbort; JS fires voice cue + toast
```

> Note: "Audio/Mic" references in §10 are about the permission, not audio capture — audio capture was dropped 2026-05-11; the FGS type list and permission set still include `microphone` per Phase 3 D-FGS-01, but no audio stream is written.

### Anti-Patterns to Avoid

- **Driving the gate from a VC frame processor instead of `takePhoto()`-to-disk** — CONTEXT D-CAM-04 mandates the photo-to-disk path (design-spec §7c verbatim, mirrors Figure). A frame-processor + Skia path would be a re-design and is out of scope.
- **Extending HumynCapture to expose a preview surface** — D-CAM-01: HumynCapture stays single-responsibility. VC owns preview.
- **Concurrent camera access** — VC and HumynCapture must never hold the camera at the same time. The handoff is strictly sequential: VC unmount → await close → HC `start()`.
- **Requesting `READ_PHONE_STATE` runtime permission** — D-LIFE-02: not needed for OFFHOOK/IDLE detection; CLAUDE.md forbids it. Don't add it to any manifest.
- **Re-running the hand-gate at 10-min auto-segment cuts** — CAP-10 / Phase 3 D-SEG-01: the `start_gate` block is preserved across all segments in the session. The gate runs once per session.
- **Sharing `recState` globally via Zustand "just in case"** — keep it screen-local unless a concrete cross-surface reader exists.
- **Skipping drift re-measurement on the new handoff** — the ±1 ms invariant is the project's non-negotiable. Any path that calls `HumynCapture.start()` after another process held the camera must be drift-checked on hardware.
- **Lowering the gate target hits / confidence to "make it pass"** — Phase-2 wave anti-pattern: never lower capture-spec or gate thresholds; tune via Remote Config (HAND-11) post-launch, not in code.

---

## Don't Hand-Roll

| Problem                                   | Don't Build                                           | Use Instead                                                                                                                            | Why                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand detection                            | Custom skin-tone heuristic / OpenCV pipeline          | MediaPipe `HandLandmarker` (`tasks-vision@0.10.21`)                                                                                    | Robust across skin tones & lighting; Figure uses it; ~95 LOC wrapper.                                                                                    |
| RN MediaPipe bridge                       | Adopt an off-the-shelf RN MediaPipe community wrapper | In-house `HumynHandDetector` Kotlin module                                                                                             | CLAUDE.md: community wrappers unmaintained; the in-house module is tiny and exactly what we need.                                                        |
| Camera preview                            | Hand-roll a Camera2 preview SurfaceView in RN         | `react-native-vision-camera@4.7.3`                                                                                                     | Locked, supported, handles new-arch interop. HumynCapture deliberately doesn't do preview.                                                               |
| HEVC video + IMU + drift                  | Anything                                              | `HumynCapture` (Phase 3)                                                                                                               | Phase 3 owns the locked spec & the ±1 ms drift. Phase 4 only calls `start()`/`stop()`.                                                                   |
| Orientation lock & observation            | Manual `Dimensions`-listener orientation inference    | `react-native-orientation-locker@1.7.x`                                                                                                | Thin, reliable; D-LIFE-03 explicitly approves it.                                                                                                        |
| TTS engine + voice selection              | Direct `android.speech.tts.TextToSpeech` bridge       | `react-native-tts@4.1.1`                                                                                                               | Locked; correct tool; exposes voice enumeration for the fallback chain.                                                                                  |
| Battery level events                      | Polling `BatteryManager` on a JS timer                | `HumynBattery` over `ACTION_BATTERY_CHANGED` (event-driven)                                                                            | Sticky broadcast pushes changes; no polling. (Add a periodic cross-check only if the listener proves coarse near 15%/5% — Claude's discretion.)          |
| Filesystem free-space check               | Native StatFs bridge                                  | `react-native-fs.getFSInfo()`                                                                                                          | Already a locked dep; no extra Kotlin.                                                                                                                   |
| Per-account install gate                  | Server round-trip                                     | MMKV `tutorial.practice_done.{sub}.v1`                                                                                                 | Already wired (Phase 2 `.v1` convention); reinstall-wipes-MMKV gives the exact ONB-08 semantics for free.                                                |
| Confetti / scale-pop on practice-complete | Custom particle engine                                | Whatever the design-system / existing animation utils provide (likely Reanimated + a confetti component already chosen for the design) | `> TODO: planner should check design-system/ + engineering-handoff.md for the chosen confetti component; don't introduce a new lib if one is specified.` |

**Key insight:** Phase 4 is overwhelmingly _integration_, not invention. Every hard problem (capture, drift, segmentation, hand detection algorithm, camera preview) is owned by a locked component (Phase 3 / MediaPipe / VisionCamera). The Phase-4 code is glue: a state machine, a policy table, four ~tiny Kotlin shims, two screens, and navigation wiring.

---

## Runtime State Inventory

> Phase 4 is _mostly_ greenfield (new screens/modules), but it introduces new persisted state and touches navigation-init state. Recorded here.

| Category                | Items Found                                                                                                                                                                                                                                                                                                                                                                                     | Action Required                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data (persisted) | **MMKV key `tutorial.practice_done.{googleAccountSub}.v1`** — boolean, written by PracticeCompleteScreen, read by `computeInitialRoute` at boot. Keyed per Google account `sub`.                                                                                                                                                                                                                | New key; code-write only. No migration (key didn't exist before). Reinstall wipes MMKV → tutorial re-runs (intended ONB-08 semantics).                                                                         |
| Stored data (transient) | `cacheDir/hand-gate/{ulid}.jpg` JPEG frames                                                                                                                                                                                                                                                                                                                                                     | Code-write; deleted on each gate-check resolve + app-launch sweep removes stragglers. Not user data; not backed up.                                                                                            |
| Live service config     | None — no external service config touched.                                                                                                                                                                                                                                                                                                                                                      | None.                                                                                                                                                                                                          |
| OS-registered state     | **Four new `ReactPackage`s registered in `MainApplication.kt`**; new `BroadcastReceiver` (`ACTION_BATTERY_CHANGED`) registered/unregistered by `HumynBattery` at module lifecycle; new `TelephonyCallback`/`PhoneStateListener` + `AudioFocusChangeListener` registered/unregistered by `HumynPhoneState`. No long-lived OS registrations (all tied to module lifecycle, torn down on unmount). | Register packages in `MainApplication.kt`. Ensure receivers/callbacks are unregistered on `onCatalystInstanceDestroy` / module invalidate to avoid leaks.                                                      |
| Secrets/env vars        | None new. Reads existing `auth.jwt.v1` (to derive `sub`), `compat.lastResult.v1` (lens id).                                                                                                                                                                                                                                                                                                     | None.                                                                                                                                                                                                          |
| Build artifacts         | `hand_landmarker.task` (~7.8 MB) added to APK assets — increases APK size; bundled, not downloaded. New Kotlin sources compile into the same APK. `react-native-orientation-locker` autolinked.                                                                                                                                                                                                 | Confirm asset placement (`android/app/src/main/assets/` vs a Gradle `assets.srcDirs` entry). Run `pod install` is N/A (Android-only this phase). Confirm autolinking picks up orientation-locker for new arch. |

**Nothing found in "Live service config":** Verified — Phase 4 calls only the local `HumynCapture` bridge and reads local MMKV; no Firebase config _writes_ (only Remote Config _reads_ for HAND-11 knobs, which is read-only). Backend (Fastify/Postgres/S3) is untouched until Phase 5.

---

## Common Pitfalls

### Pitfall 1: Drift regression on the camera handoff

**What goes wrong:** After VC releases the camera, `HumynCapture.start()` opens it again; if Camera2 isn't fully released yet, `start()` may stall, retry internally, or initialize with a different timestamp-base alignment — pushing `imu_video_drift_{mean,p99}_ms` outside ±1 ms (the exact failure mode that killed audio).
**Why it happens:** Camera2 `close()` is async; "VC unmounted" ≠ "camera HAL released". The CONTEXT ordering inserts a 50 ms settle delay — that number is a guess.
**How to avoid:** On Pixel 10a / 7a-class hardware, run the gate→record path repeatedly and read the `onSegmentComplete` drift figures `{max, mean, p99}`. If any segment exceeds ±1 ms, increase the settle delay or have `HumynCapture.start()` poll for camera availability before it begins. Make the settle delay a tunable.
**Warning signs:** `start()` Promise resolves slowly (>800 ms); first-segment drift figures noticeably worse than steady-state segments.

### Pitfall 2: OEM phone-state / audio-focus quirks (Xiaomi MIUI, Oppo ColorOS, etc.)

**What goes wrong:** `TelephonyCallback`/`PhoneStateListener` may not fire OFFHOOK/IDLE reliably without `READ_PHONE_STATE` on some OEMs; `AudioFocusChangeListener` may not deliver `AUDIOFOCUS_LOSS_TRANSIENT` for alarms on aggressive battery-saver ROMs; some ROMs kill the FGS or the listeners on screen-off.
**Why it happens:** OEM customizations of the telephony/audio stack and aggressive process management.
**How to avoid:** Read `.planning/research/PITFALLS.md` (the canonical catalog — CONTEXT references it explicitly). Subscribe to BOTH telephony state AND audio focus (D-LIFE-02 already does this — they're complementary). Test on a non-Pixel device if one is available; at minimum document the known-quirky ROMs.
**Warning signs:** Call-answered doesn't stop the recording on a Xiaomi/Oppo test device; alarm doesn't stop the recording.

### Pitfall 3: MediaPipe `HandLandmarker` task-load latency / asset-path errors

**What goes wrong:** First `detect()` is slow (model load); wrong `setModelAssetPath` (must be the assets-relative path, not an absolute file path, when bundled in assets); `RunningMode` mismatch (IMAGE vs LIVE_STREAM) throws.
**Why it happens:** MediaPipe Tasks API is finicky about asset paths and running modes; cold-load of a 7.8 MB model is non-trivial.
**How to avoid:** Construct the `HandLandmarker` once (lazily, on first `detectHands` call or at module init) and reuse it. HAND-12 pre-warm (a throwaway `takePhoto()` at screen mount) plus optionally a throwaway `detect()` on a 1×1 bitmap warms the model. Use `BaseOptions.builder().setModelAssetPath("hand_landmarker.task")` with the asset bundled under `android/app/src/main/assets/`. Set `RunningMode.IMAGE`, `numHands=2`, all min-confidences `0.5f`, CPU delegate — verbatim from `figure-app-hands.md`.
**Warning signs:** First gate detection takes >1 s; `IllegalStateException`/`MediaPipeException` on `detect()`; `landmarks()` always empty.

> TODO: planner should verify the exact 0.10.21 builder API (class names: `HandLandmarker`, `HandLandmarkerOptions`, `BaseOptions`, `BitmapImageBuilder` / `MPImage`) against `figure-app-hands.md` and the MediaPipe 0.10.21 javadoc — the names below in Code Examples are from training memory and may be slightly off.

### Pitfall 4: VisionCamera 4.7.3 ↔ new-architecture / worklets interactions

**What goes wrong:** VC 4.x on RN 0.83 new-arch can hit autolinking/codegen issues; the V4 worklets dep is `react-native-worklets-core@1.6.3` (NOT `react-native-worklets`) — mixing them breaks the build; `qualityPrioritization: 'speed'` + `enableShutterSound: false` may behave differently per OEM.
**Why it happens:** VC 4.x predates some new-arch stabilization; the worklets package split is a known footgun.
**How to avoid:** Use exactly the locked stack (`vision-camera@4.7.3` + `worklets-core@1.6.3` + `reanimated@3.16.x` + `skia@≥1.2.1`). Read `.planning/research/STACK.md` for the config recipe and `PITFALLS.md` for the new-arch interactions. Don't pull in `react-native-worklets`.
**Warning signs:** Codegen errors on build; `Worklets` undefined at runtime; preview black on some devices.

### Pitfall 5: `EmitterSubscription` leaks on RecordingScreen unmount

**What goes wrong:** RecordingScreen subscribes to `HumynCapture` events (5 of them) + `HumynPhoneState` + `HumynBattery` + AppState + orientation + Linking. If any aren't `.remove()`d on unmount, you get duplicate handlers / memory leaks (Phase 3 JSDoc T-3.3-04 warns about this).
**How to avoid:** Every subscription created in a `useEffect` returns a cleanup that `.remove()`s it. The `useRecordingLifecycle` hook owns this discipline for the lifecycle sources; RecordingScreen owns it for the HumynCapture/VC sources.
**Warning signs:** Stop fires twice; battery alert fires after leaving the screen; growing listener count in dev warnings.

### Pitfall 6: Brightness restore missed on an abnormal exit

**What goes wrong:** Brightness drops to 5% at gate exit; if the screen unmounts via a path that doesn't run `stop()` (crash, force-navigation, error), brightness stays at 5%.
**How to avoid:** Restore brightness in BOTH the `stop()` handler AND the RecordingScreen unmount cleanup (Claude's discretion says "both paths must restore"). Use `screenBrightness = BRIGHTNESS_OVERRIDE_NONE` (i.e. `-1f` / use system default) to restore rather than caching a value.
**Warning signs:** Screen stays dim after leaving the recording surface.

### Pitfall 7: `__DEV__` affordance leaking into production

**What goes wrong:** The non-practice debug push on TasksPlaceholder ships in the apkRollout/playStore build.
**How to avoid:** Wrap the _entire_ press handler (not just the navigation call) in `if (__DEV__) { … }`. Add a quick test asserting the affordance is absent when `__DEV__` is false (or that the long-press handler is undefined). Production builds set `__DEV__` false → dead-code-eliminated.
**Warning signs:** A reviewer finds a long-press shortcut in a release build.

### Pitfall 8: `computeInitialRoute` composition order

**What goes wrong:** The new per-account tutorial flag check is composed incorrectly with the existing compat-signature gate — e.g. tutorial-done users get sent through compat again, or compat-failed users get the tutorial.
**How to avoid:** Order the checks: (1) no user/JWT → onboarding/splash; (2) compat not passed → onboarding/compat; (3) tutorial not done for this `sub` → onboarding/RigTutorial; (4) else → MainTabs. Pin this with the existing `initialRoute` test pattern (add cases for the new branch). See CONTEXT Specifics pseudo-code.
**Warning signs:** Existing `computeInitialRoute` tests go red; a returning user lands on RigTutorial.

---

## Code Examples

> ⚠️ The Kotlin/JS snippets below are **sketches from training knowledge**, not verified against the pinned versions. Treat them as shape guidance; the planner should cross-check API names against `figure-app-hands.md`, the MediaPipe 0.10.21 javadoc, the VC 4.7.3 docs, and `react-native-tts@4.1.1` docs before locking task actions. `> TODO: planner should verify each snippet.`

### HandDetector — Kotlin module (sketch, mirrors `figure-app-hands.md`)

```kotlin
// HumynHandDetectorModule.kt — ai.humynlabs.capture.handdetector
// [ASSUMED] API names — verify against MediaPipe tasks-vision 0.10.21 + figure-app-hands.md
class HumynHandDetectorModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName() = "HumynHandDetector"

  private val landmarker: HandLandmarker by lazy {
    val base = BaseOptions.builder().setModelAssetPath("hand_landmarker.task").build()
    val opts = HandLandmarkerOptions.builder()
      .setBaseOptions(base)
      .setRunningMode(RunningMode.IMAGE)
      .setNumHands(2)
      .setMinHandDetectionConfidence(0.5f)
      .setMinHandPresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()
    HandLandmarker.createFromOptions(reactApplicationContext, opts)
  }

  @ReactMethod
  fun detectHands(path: String, promise: Promise) {
    var bmp: Bitmap? = null
    try {
      val o = BitmapFactory.Options().apply {
        inPreferredConfig = Bitmap.Config.RGB_565
        // (decode then scale to 320x240 — or inSampleSize — per HAND-13)
      }
      bmp = BitmapFactory.decodeFile(path, o)
      val scaled = Bitmap.createScaledBitmap(bmp!!, 320, 240, true)
      val mpImage = BitmapImageBuilder(scaled).build()
      val result = landmarker.detect(mpImage)
      promise.resolve(result.landmarks().size)   // hand-count only
      if (scaled != bmp) scaled.recycle()
    } catch (e: Exception) {
      promise.reject("HAND_DETECT_FAILED", e)
    } finally {
      bmp?.recycle()
    }
  }
}
```

### Gate poll loop — JS (sketch)

```ts
// inside RecordingScreen, gate substate
// [ASSUMED] VC 4.7.3 takePhoto API shape — verify
async function runGateCheck(camera: Camera, dispatch: Dispatch<RecAction>, cfg: GateCfg) {
  const photo = await camera.takePhoto({
    flash: 'off',
    enableShutterSound: false,
    qualityPrioritization: 'speed',
  });
  const dest = `${RNFS.CachesDirectoryPath}/hand-gate/${ulid()}.jpg`;
  await RNFS.moveFile(photo.path, dest); // VC writes to a temp path; move into our dir
  try {
    const hands = await HumynHandDetector.detectHands(dest);
    dispatch({ type: hands >= 1 ? 'GATE_HIT' : 'GATE_MISS', target: cfg.consecutiveHitsRequired });
  } finally {
    RNFS.unlink(dest).catch(() => {}); // delete on resolve, swallow errors
  }
}
// scheduled every cfg.cadenceMs while substate === 'gate' && gate.phase === 'waiting'
```

### Gate-pass → active transition — JS (CONTEXT Specifics ordering, sketch)

```ts
// recState 'gate.confirmed' → 'active'
await Promise.resolve(); // tick
HapticFeedback.trigger('impactMedium'); // ~80ms-equiv vibrate (or Vibration.vibrate(80))
Tts.speak('Recording started.', { rate: 1.0, pitch: 0.95, volume: 0.85 }); // en-IN female (after voice setup)
await HumynScreenBrightness.set(0.05);
await new Promise((r) => setTimeout(r, 100)); // let TTS engine spin up
await visionCameraRef.current?.unmount?.(); // or unmount via state -> remount=false
await new Promise((r) => setTimeout(r, 50)); // let Camera2 close complete  [TUNABLE]
try {
  const startResult = await HumynCapture.start({
    isPractice,
    startGate: { ...gateResult, cameraId },
  });
  dispatch({ type: 'CAPTURE_STARTED', startResult });
} catch (e) {
  // thermal_throttling / permission_revoked / storage_full
  Tts.speak(e.code === 'thermal_throttling' ? 'Phone too warm.' : 'Could not start recording.');
  await HumynScreenBrightness.set(-1); // restore
  dispatch({ type: 'CAPTURE_START_FAILED', error: e }); // → ready substate
}
```

### TTS voice-fallback chain — JS (sketch; spec from `engineering-handoff.md §6.3` + `idea-brief.md §13`)

```ts
// [ASSUMED] react-native-tts@4.1.1 voices() shape — verify
async function pickVoice(): Promise<string | undefined> {
  const voices = await Tts.voices(); // [{ id, language, name, networkConnectionRequired, notInstalled }]
  const usable = voices.filter((v) => !v.notInstalled);
  const isFemale = (v: any) => /female|woman|en-IN-Standard-A|.../i.test(v.name); // heuristic — refine
  return (
    usable.find((v) => v.language === 'en-IN' && isFemale(v)) ?? // 1. en-IN female
    usable.find((v) => v.language === 'en-IN') ?? // 2. en-IN any
    usable.find((v) => v.language === 'en-US' && isFemale(v)) ?? // 3. en-US female
    usable.find((v) => v.language?.startsWith('en'))
  )?.id; // 4. first en-*
}
// at app/recording-screen init: const id = await pickVoice(); if (id) await Tts.setDefaultVoice(id);
// also: Tts.setDefaultRate(1.0); Tts.setDefaultPitch(0.95);  (volume via speak opts)
```

> Note: `idea-brief.md §13` gives rate 1.0 / pitch 0.95 / volume 0.85. Female-voice detection is heuristic — `react-native-tts` doesn't expose a gender field, so the chain matches on name/known-voice-id substrings. `> TODO: planner should pin down which en-IN voice ids ship on the target ₹30K Android devices (Pixel 10a will differ from a Xiaomi/Realme); document the fallback ladder behavior on each.`

### Per-account tutorial gate + computeInitialRoute (sketch, CONTEXT Specifics)

```ts
// PracticeCompleteScreen Continue:
const sub = decodeJwt(appStore.getState().jwt!).sub;
mmkv.set(`tutorial.practice_done.${sub}.v1`, true);
navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });

// computeInitialRoute extension:
if (!state.user || !state.jwt) return { stack: 'OnboardingStack', initial: 'Splash' };
if (!state.compatPassed) return { stack: 'OnboardingStack', initial: 'Splash' /* compat */ };
const sub = decodeJwt(state.jwt).sub;
const done = mmkv.getBoolean(`tutorial.practice_done.${sub}.v1`) ?? false;
if (!done) return { stack: 'OnboardingStack', initial: 'RigTutorial' };
return { stack: 'MainTabs' };
```

> TODO: planner should read `apps/mobile/src/state/initialRoute.ts` for the actual signature & compose accordingly; pseudo-code above may not match the existing shape.

### onCrashRecovery boot listener (sketch)

```ts
// app boot, once:
const sub = HumynCapture.onCrashRecovery?.(({ recovered }: { recovered: string[] }) => {
  if (recovered?.length) showHomeToast('Recording recovered after force-quit — uploading.');
  sub?.remove(); // one-shot
});
```

> TODO: planner should confirm the `onCrashRecovery` event name & payload with the Phase 3 HumynCapture extension (this is NEW wiring Phase 4 adds to HumynCapture's package init per D-LIFE-04).

---

## State of the Art

| Old approach                                       | Current approach                                       | When changed | Impact                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-camera` (archived)                   | `react-native-vision-camera` 4.x                       | years ago    | Use VC 4.7.3 (locked); never `react-native-camera` / `expo-camera`.                                                                                                                |
| `react-native-worklets`                            | `react-native-worklets-core@1.6.3` for VC V4           | VC V4 era    | Mixing the two breaks the build; use `worklets-core` only.                                                                                                                         |
| MediaPipe `tasks-vision` latest                    | Pinned `0.10.21`                                       | —            | iOS pod 0.10.33+ XCFramework linking bug (mediapipe #6258); lock Android+iOS at 0.10.21.                                                                                           |
| Audio capture (48 kHz mono AAC-LC) in HumynCapture | **No audio**                                           | 2026-05-11   | Audio-pump CPU contention pushed drift outside ±1 ms. Phase 4 must NOT re-introduce audio. FGS still declares `microphone` type (Phase 3 D-FGS-01) but no audio stream is written. |
| `react-native-background-fetch` for uploads        | FGS `dataSync` (Android) / URLSession background (iOS) | —            | Not Phase 4's concern (Phase 5), but relevant: don't add background-fetch.                                                                                                         |

**Deprecated/outdated (do not use in Phase 4):** `react-native-camera`, `expo-camera`, CameraX (any version, for any purpose — spec-rejected), `react-native-worklets` (the non-core one), `MediaPipeTasksVision` iOS pod 0.10.33+, third-party RN MediaPipe wrappers, `react-native-track-player`/`react-native-sound` for TTS, AsyncStorage for any state, Hermes JSC/legacy engine, `@react-native-firebase/*` v22 or older, Sentry/Datadog/Bugsnag.

---

## Project Constraints (from CLAUDE.md)

Actionable directives extracted from `CLAUDE.md` that constrain Phase 4 planning:

- **Capture quality non-negotiable** — 1080p/30fps/≥110° dFOV/IMU ≥100Hz/±1ms drift. Phase 4 must re-verify drift on the new handoff and not regress it.
- **Audio is dropped** — do not re-introduce audio capture; re-introducing requires on-hardware proof drift stays inside ±1 ms.
- **Designs are the source of truth** — `prototype.html`, `design-spec.md`, `engineering-handoff.md`. No new design work. Every screen/state/copy/animation/token verbatim. Task icons from `design-system/task-icons/`.
- **Capture pipeline = Camera2 + MediaCodec** (HumynCapture, Phase 3). CameraX rejected. VisionCamera = preview + `takePhoto()` ONLY (no HEVC video pipeline).
- **Hand gate = MediaPipe HandLandmarker** (`hand_landmarker.task` ~7.8 MB) in a custom Kotlin module. IMAGE mode, single-frame, hand-count only. Mirrors Figure's pattern.
- **App framework = React Native (Hermes new-arch)** + native modules. New-arch only; no JSC.
- **No notifications** — no `POST_NOTIFICATIONS`, no FCM/APNs. **No `READ_PHONE_STATE` runtime permission. No `ACCESS_NOTIFICATION_POLICY` / programmatic DND** (REC-09).
- **No success metrics / no quant gates** — ship-by-vibe at MVP.
- **Files never re-encoded** — MP4/IMU CSV/metadata JSON byte-for-byte. Phase 4 doesn't touch files in transit.
- **Privacy** — coarse location only; no precise GPS leaves device; server logs consent timestamp+version (Phase 5 territory).
- **No Sentry/Datadog/Bugsnag** — Crashlytics + Firebase Analytics only.
- **Version pins** — all the locked versions in the CLAUDE.md "Tech Stack — Pins" + "Do NOT Use" + "Version Compatibility Pinpoints" tables apply unconditionally.
- **GSD workflow** — all repo edits go through a GSD command (this is a process constraint, not a code one).
- **English only at MVP** — TTS speaks en-IN female; no localization.
- **MMKV for non-secret state, Keychain for secrets** — never AsyncStorage. Phase 4's tutorial flag goes in MMKV.

---

## Assumptions Log

| #   | Claim                                                                                                                                                                                        | Section                         | Risk if Wrong                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `react-native-orientation-locker@1.7.x` is current & RN-0.83/new-arch compatible                                                                                                             | Standard Stack                  | Wrong version → autolink/build failure; would need a different orientation lib (D-LIFE-03 said "thin, well-maintained" — but didn't verify version). LOW risk; easy to check.                   |
| A2  | MediaPipe 0.10.21 builder API: `HandLandmarker.createFromOptions`, `HandLandmarkerOptions.builder()`, `BaseOptions.builder().setModelAssetPath(...)`, `BitmapImageBuilder`                   | Code Examples §HandDetector     | API names slightly off → compile errors; the Figure pattern (`figure-app-hands.md`) is the ground truth — planner must read it. MEDIUM risk.                                                    |
| A3  | `hand_landmarker.task` belongs in `android/app/src/main/assets/` and is referenced by `setModelAssetPath("hand_landmarker.task")`                                                            | Pitfall 3 / Code Examples       | Wrong path → `detect()` throws at runtime. MEDIUM risk; verify against Figure.                                                                                                                  |
| A4  | VC 4.7.3 `takePhoto()` returns `{ path }` and accepts `{ flash, enableShutterSound, qualityPrioritization }`                                                                                 | Code Examples §gate loop        | API drift across VC 4.x minors → runtime error. LOW-MEDIUM; verify VC 4.7.3 docs.                                                                                                               |
| A5  | `react-native-tts@4.1.1` exposes `voices()`, `setDefaultVoice()`, `setDefaultRate()`, `setDefaultPitch()`, `speak(text, opts)` and no gender field on voices                                 | Code Examples §TTS              | If `voices()` shape differs, the fallback-chain heuristic needs rework. LOW-MEDIUM; verify lib docs.                                                                                            |
| A6  | `TelephonyManager.registerTelephonyCallback()` works without `READ_PHONE_STATE` for OFFHOOK/IDLE on stock Android (D-LIFE-02 asserts this)                                                   | Architecture / Pitfall 2        | If it requires the permission on some API levels/OEMs, phone-call detection silently fails there → recordings keep running through calls. MEDIUM risk on OEM ROMs — `PITFALLS.md` should cover. |
| A7  | `engineering-handoff.md §4.3` `RecState` shape matches the field list named in CONTEXT (`gate.phase`, `consecutiveHits`, `targetHits`, `cadenceMs`, `skipped`, `bypassed`)                   | Pattern 3                       | If the real shape differs, the reducer is wrong. LOW risk (CONTEXT quoted it) but planner must read the file verbatim.                                                                          |
| A8  | `react-native-haptic-feedback@2.3.3` can produce the 80 ms / `[40,80,40]` / `[100,50,100]` / 800 ms patterns the design wants (it may only do named haptic types, not arbitrary ms patterns) | Don't-Hand-Roll / Code Examples | If it can't do arbitrary patterns, fall back to RN's `Vibration.vibrate(pattern)` for the array patterns. LOW risk; verify lib capabilities.                                                    |
| A9  | `appStore.user` exposes the Google account `sub` (CONTEXT calls the field name TBD)                                                                                                          | Per-account gate                | If `sub` isn't stored, derive it by decoding `auth.jwt.v1` directly. LOW risk; handled either way.                                                                                              |
| A10 | Confetti on PracticeCompleteScreen uses an existing/designated component, not a new lib                                                                                                      | Don't-Hand-Roll                 | If no component is designated, planner picks one — minor scope addition. LOW risk.                                                                                                              |
| A11 | The "skip" / "bypass" gate paths (`gate.skipped`, `gate.bypassed`) and HAND-14 `recording_gate_skipped` telemetry have a defined trigger (e.g., gate timeout, or APK-flavor bypass)          | Pattern 1 / Phase Requirements  | If the skip/bypass conditions aren't where I think, the state machine is incomplete. MEDIUM risk — planner must read `engineering-handoff.md §4.3` + REQUIREMENTS HAND-11/14.                   |

**Note:** This Assumptions Log is non-empty BECAUSE the research was cut short by a timeout. A full research pass would have verified A2–A5, A8 against Context7/official docs and A6/A7/A11 against the named project files. The planner should resolve these before locking task actions.

---

## Open Questions

1. **Exact `RecState` shape from `engineering-handoff.md §4.3`** — What we know: substate enum + `gate.{phase,consecutiveHits,targetHits,cadenceMs,skipped,bypassed}`. What's unclear: the full enum members (does it include `stopping`, `error`, `transitioning`?), the post-stop substate names. Recommendation: planner reads §4.3 verbatim and reproduces it; this research could not.
2. **When does the gate "skip" / "bypass"?** — `gate.skipped` and `gate.bypassed` are distinct fields and HAND-14 emits `recording_gate_skipped`. Likely: `bypassed` = APK-flavor / Remote-Config bypass (parallels the install-source-check bypass); `skipped` = a timeout / max-attempts fallback so a user with detection trouble isn't stuck. Recommendation: confirm against REQUIREMENTS HAND-11..14 + `engineering-handoff.md §4.3` + `idea-brief.md §4`.
3. **`HumynCapture` veto window (D-SEG-02) — how does JS call `stop()` through it?** — What we know: Phase 3 D-SEG-02 defines a veto window so `stop()` doesn't cut mid-frame. What's unclear: the exact JS-side contract (does `stop()` already encapsulate the veto, or does JS need to wait for a "safe to stop" signal?). Recommendation: read Phase 3 `03-CONTEXT.md` D-SEG-02 + `HumynCapture.types.ts`.
4. **`onCrashRecovery` — is the Phase 3 app-launch sweep already emitting an event, or is Phase 4 adding the emit?** — CONTEXT D-LIFE-04 says Phase 4 "adds a small extension to HumynCapture's package init to emit" it. So Phase 4 touches HumynCapture (a Phase-3-owned module) — surgical-stage protocol applies. Recommendation: scope this as a minimal, well-tested edit to HumynCapture's package init; coordinate with whoever owns that file.
5. **Does VC 4.7.3 support an explicit `unmount()` / camera-release call, or is it controlled purely by conditionally rendering `<Camera>`?** — Affects the handoff ordering. Recommendation: verify VC 4.7.3 API; if no explicit unmount, set a `cameraActive=false` state, `await` the next frame, then call HC `start()` — and budget extra settle time.
6. **Battery `ACTION_BATTERY_CHANGED` granularity near 15%/5%** — Claude's discretion item. Recommendation: on Pixel 10a, log every battery-changed event during a long recording; if it doesn't deliver an event at exactly the 15%/5% crossing, add a 60 s periodic cross-check.

---

## Environment Availability

| Dependency                                                                | Required by                                                                                       | Available                     | Version       | Fallback                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| Pixel 10a (or 7a-class) physical device                                   | Wave 5 smoke walk; drift re-measurement on the handoff; OEM phone-state checks; thermal injection | ✓ (used in Phase 3 smoke)     | —             | None — on-hardware verification is the Phase 4 acceptance gate (D-WAVE-04).                            |
| `adb`                                                                     | Thermal injection (`adb shell cmd thermalservice override-status 4`), install debug build, logcat | ✓ (assumed — Phase 3 used it) | —             | None.                                                                                                  |
| `com.google.mediapipe:tasks-vision:0.10.21` on Maven Central              | `HumynHandDetector` build                                                                         | `> TODO: verify`              | 0.10.21       | None — it's the locked pin; if unavailable, escalate.                                                  |
| `react-native-orientation-locker@1.7.x` on npm                            | orientation lock/observe                                                                          | `> TODO: verify`              | ~1.7.x        | Manual `Dimensions` orientation inference (worse; D-LIFE-03 explicitly chose the lib to avoid this).   |
| Node 22 / npm                                                             | mobile build (existing)                                                                           | ✓                             | —             | —                                                                                                      |
| Android SDK 35 / AGP 8.7+ / Gradle 8.11+ / Kotlin 2.0.21+ / JDK 17 (Zulu) | Kotlin module compile                                                                             | ✓ (existing toolchain)        | per CLAUDE.md | —                                                                                                      |
| A non-Pixel OEM device (Xiaomi/Oppo/Realme)                               | Pitfall 2 verification (phone-state quirks)                                                       | `✗ (unknown)`                 | —             | Document known-quirky ROM behavior from `PITFALLS.md`; flag for post-launch QA if no device available. |

**Missing dependencies with no fallback:** None confirmed missing; the two `> TODO: verify` items (mediapipe Maven artifact, orientation-locker npm) are almost certainly available — planner should confirm in Wave 1.

**Missing dependencies with fallback:** A non-Pixel OEM test device (fallback: rely on `PITFALLS.md` + post-launch QA).

---

## Validation Architecture

> `workflow.nyquist_validation` config value not read before timeout — assume enabled (key absent ⇒ enabled). `> TODO: planner should confirm against .planning/config.json.`

### Test Framework

| Property                 | Value                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JS/RN unit + integration | **Vitest** (`apps/mobile/vitest.config.ts` + `vitest.setup.ts` already wired, Phase 2/3) — jsdom env, native-module mocks, fake timers.                      |
| Visual regression        | `jest-image-snapshot` under `apps/mobile/__tests__/visual/__image_snapshots__/` (Phase 3 D-WAVE-06).                                                         |
| Kotlin unit              | `> TODO: planner — confirm whether Phase 3 set up JUnit/Robolectric for the Kotlin modules; if not, native modules are verified by instrumented smoke only.` |
| Native instrumented      | Pixel 10a smoke walk per `04-MANUAL-SMOKE.md` (Wave 5) — pattern-matches `03-MANUAL-SMOKE.md` / `03-WAVE1-SMOKE.md`.                                         |
| Quick run command        | `> TODO: confirm — likely `npm test -w apps/mobile`or`vitest run`in`apps/mobile/`.`                                                                          |
| Full suite command       | `> TODO: confirm — CI "Mobile build" job (unit + visual snapshots).`                                                                                         |

### Phase Requirements → Test Map

**ONB-03..08 — practice flow + once-per-install-per-account tutorial gate**

- **What to test:** RigTutorial `Next` now targets `PracticeIntro`; PracticeIntro `Start practice` → `navigation.replace('Recording', {isPractice:true})`; PracticeComplete `Continue` writes `tutorial.practice_done.{sub}.v1` and `navigation.reset` to MainTabs; `computeInitialRoute` returns RigTutorial when the flag is missing, MainTabs when set; reinstall (MMKV cleared) re-runs the tutorial; flag is per-account (`sub` A ≠ `sub` B → A's flag doesn't satisfy B).
- **Where:** Vitest (navigation mocks + MMKV mock + JWT decode); visual snapshots for `practice-intro.png`, `practice-complete-static.png`. Native instrumented: full fresh-install practice E2E on Pixel 10a (D-WAVE-04 #1).
- **Observable evidence:** `computeInitialRoute` unit tests pass for all four branches; the MMKV mock shows the keyed write; on hardware, a fresh install lands on RigTutorial and a second app launch (post-practice) lands on Home with the first-time hero.
- **Reuses from Phase 3 / earlier:** `routeRegistry` invariant test pattern (Pattern 54 — extended with `Recording`); the `computeInitialRoute` test pattern from Phase 2; the visual-snapshot infra (Phase 3 D-WAVE-06); `RigTutorialScreen.tsx` / `TasksPlaceholderScreen.tsx` (Phase 2).

**HAND-01..14 — MediaPipe hand-gate**

- **What to test:** `HumynHandDetector.detectHands(path)` returns an Int hand-count (0/1/2) for fixture JPEGs (instrumented — needs the real MediaPipe lib + a real bitmap; in jsdom it's mocked); the gate poll loop increments `consecutiveHits` on a hit and resets on a miss; `gate.confirmed` fires at `consecutive_hits_required` (default 5); Remote Config reads override `cadence_ms` / `consecutive_hits_required` / `min_hand_detection_confidence` (HAND-11); HAND-12 pre-warm fires a throwaway `takePhoto()` at screen mount; HAND-13 decode is 320×240 RGB_565; HAND-14 emits the `recording_gate_skipped` Firebase Analytics event when the gate is skipped; D-CAM-03 — the lens id passed to VC matches `compat.lastResult.v1.checks.ultrawideDfov.cameraId` and flows into `start(opts).startGate`.
- **Where:** Vitest with `HumynHandDetector` mocked (poll-loop logic, hit/miss counting, Remote-Config-override behavior, pre-warm call, analytics-event emission, lens-id wiring) + fake timers. Visual snapshots: `recording-gate-ring-0/50/100.png` (mocked HandDetector return values). Native instrumented: on Pixel 10a, hands-in-frame passes the gate within a few seconds; the gate uses the ultrawide lens (visually confirm POV); model load doesn't stall the first detection.
- **Observable evidence:** Vitest assertions on `dispatch` calls and the Remote Config reads; on hardware, the gate ring fills and the transition fires with hands visible, doesn't fire with hands hidden; logcat shows the ultrawide cameraId; the analytics event appears in DebugView when the gate is skipped/bypassed.
- **Reuses from Phase 3 / earlier:** native-module-mock + fake-timer test pattern (Phase 3 state-machine tests); `shared/types/CompatResult.ts` (`ultrawideDfov.cameraId`) from Phase 2; visual-snapshot infra; `figure-app-hands.md` as the implementation spec.

**REC-01..16 — recording surface state machine, monitors, guards**

- **What to test:**
  - **State machine (`recState`):** every transition — rotate-prompt→ready (on landscape), ready→gate (on tap record), gate(loading→waiting→confirmed), confirmed→active (the D-CAM-02 ordered handoff), active→stop-confirm-modal (on Stop tap), stop-confirm→stop (on confirm) / →active (on cancel), post-stop routing (practice→PracticeComplete; real ≥60 s→toast+Home; real <60 s→toast+ready). 10-min auto-segment is HC-owned — assert the JS side does NOT re-run the gate at a segment cut (the `start_gate` block persists).
  - **`useRecordingLifecycle` (§10 table):** for each row, fire the mocked event and assert the policy outcome — AppState background→`HumynCapture.stop()`; PhoneState OFFHOOK→`stop()`; PhoneState IDLE-after-OFFHOOK→no-op; AudioFocus transient-loss+IDLE→`stop()`; orientation-not-landscape→`stop()`+toast; battery ≤15% transition→toast+520Hz beep+`[100,50,100]` haptic+voice (no stop); battery ≤5% transition→`stop()`; battery <5% start guard→refuse-new until ≥15%; storage <5GB start guard (REC-16)→refuse-new+toast; HC `onError({code:'storage_full'})`→`stop()`; HC `onError({code:'permission_revoked'})`→`stop()`; logout→`stop()`; HC `onThermalAbort`→voice cue+toast; HC `start()` rejects with `thermal_throttling`→toast+ready.
  - **`HumynScreenBrightness`:** `set(0.05)` at gate exit; restore (`set(-1)`) on both `stop()` and screen unmount (REC — "restored on stop or exit").
  - **No programmatic DND (REC-09):** assert no `ACCESS_NOTIFICATION_POLICY` permission and no DND-toggle call exists.
  - **`__DEV__` affordance:** present when `__DEV__`, absent in production builds; pushes `Recording` with the hardcoded `isPractice:false` task.
  - **Crash recovery (D-LIFE-04):** boot listener on `onCrashRecovery({recovered:[...]})` fires the Home toast exactly once.
- **Where:** Vitest with HumynCapture + HumynPhoneState + HumynBattery + HumynScreenBrightness + AppState + orientation-locker + RNFS all mocked, fake timers (the bulk of REC validation). Visual snapshots: `recording-rotate-prompt.png`, `recording-ready.png`, `recording-active-t10s.png`, `recording-active-t05m32s.png`, `recording-stop-confirm-modal.png`. Native instrumented (Pixel 10a, D-WAVE-04): the 10-min non-practice recording with observed auto-segment cut + Stop + `"{Hh Mm} added"` toast; lifecycle edges live — call-answered (stop), call-declined (continue), rotation (stop), force-quit (recover-on-launch toast); thermal injection (`adb shell cmd thermalservice override-status 4`) shows the alert pill + ~2.5 s graceful stop; battery 15%/5% behavior if reproducible; storage-refuse if reproducible.
- **Observable evidence:** Vitest assertions on `HumynCapture.stop()` call counts/timing, toast invocations, haptic/TTS calls, brightness `set` calls (0.05 then -1), navigation calls; on hardware — the operator runbook checkboxes in `04-MANUAL-SMOKE.md` all pass; logcat shows the FGS staying alive and the thermal abort path; `onSegmentComplete` payloads show drift figures within ±1 ms.
- **Reuses from Phase 3 / earlier:** the Phase 3 state-machine test pattern (native-module-mock + fake timers); `HumynCapture.ts` + `HumynCapture.types.ts` (the bridge — Phase 4 only consumes); `03-MANUAL-SMOKE.md` / `03-WAVE1-SMOKE.md` as the runbook template for `04-MANUAL-SMOKE.md`; the D-SEG-02 veto window from Phase 3; visual-snapshot infra; Phase 3's app-launch sweep (D-FS-04) which `onCrashRecovery` hooks into.

### ±1 ms drift invariant — explicit re-measurement requirement

The drift invariant (the project's non-negotiable; the reason audio was dropped — CLAUDE.md banner) must be **re-measured on hardware** for the two Phase-4-introduced conditions where `HumynCapture.start()` runs after another process held the camera:

1. **The gate→record handoff (D-CAM-02):** after VC unmounts the camera and HC re-opens it. Read `onSegmentComplete.drift.{max,mean,p99}` for the first few segments of a recording started via the gate. Any segment > ±1 ms → tune the settle delay (or have `start()` poll for camera availability) until clean.
2. **Lifecycle-edge recovery paths:** any path that stops then re-starts a recording (none in the §10 table directly re-start — stop is terminal — but the crash-recovery path re-finalizes orphan segments on launch; verify those orphan segments' drift figures are still within ±1 ms, i.e. the crash didn't corrupt alignment).

Acceptance: Wave 5 smoke records the drift figures for gate-started recordings; Phase 3's seven pending hardware UAT items (which include the drift figures, 10-min HEVC capture, 25-min auto-segment integrity, thermal handling, FGS type, SHA round-trip, onSessionStart/Stop seam) retire here — but ONLY if the drift figures stay inside ±1 ms on the gate-started path. If they don't, that's a Phase 4 blocker, not a Phase 5 deferral.

### Wave 0 Gaps

- No cosmetic Wave 0 (D-WAVE-02 — Phase 3 introduced no new visual surfaces; `02-COSMETIC-GAPS.md` / `03-W1-AMENDMENTS.md` frozen).
- Test-infra gaps to confirm in Wave 1: `> TODO: planner — does Vitest setup already mock `NativeModules` generically, or does each new module (`HumynHandDetector`/`HumynPhoneState`/`HumynBattery`/`HumynScreenBrightness`) need a mock added to `vitest.setup.ts`? Likely needs the four new mocks.` `> TODO: confirm whether `react-native-vision-camera`/`react-native-tts`/`react-native-orientation-locker` need Vitest mocks.` `> TODO: confirm whether Phase 3 set up any Kotlin-side unit testing; if not, native modules are verified by smoke only — acceptable per D-WAVE-04 ("module-ready + practice E2E passes + lifecycle edges manually verified").`
- New visual baselines to capture in Wave 3: the ~9–10 listed in CONTEXT Specifics.

---

## Security Domain

> `security_enforcement` config value not read before timeout — assume enabled. `> TODO: planner should confirm against .planning/config.json.`

### Applicable ASVS categories

| ASVS category               | Applies          | Standard control in Phase 4                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication           | no (not changed) | Phase 4 only _reads_ `auth.jwt.v1` to derive the `sub` claim for the per-account key. JWT issuance/verification is Phase 1/2. Decode-without-verify is acceptable _only_ for deriving a local cache key (the JWT was already verified at sign-in); do NOT trust the decoded `sub` for any authorization decision.                                                |
| V3 Session management       | no               | —                                                                                                                                                                                                                                                                                                                                                                |
| V4 Access control           | minimal          | The `__DEV__`-gated debug affordance must be dead-code-eliminated in production builds (Pitfall 7). Test it's absent in apkRollout/playStore.                                                                                                                                                                                                                    |
| V5 Input validation         | yes              | `HumynHandDetector.detectHands(path)` takes a file path from JS — the Kotlin side should treat it as untrusted-ish (it's app-internal cacheDir, but still: handle decode failures gracefully, don't crash on a missing/corrupt file). `onCrashRecovery({recovered:[...]})` payload — validate it's an array of strings before using.                             |
| V6 Cryptography             | no               | No new crypto. (JWT decode uses an existing util — don't hand-roll base64url decode; use the existing one.)                                                                                                                                                                                                                                                      |
| V7 Error handling & logging | yes              | Don't log the JWT or the `sub` claim to Crashlytics/Analytics. Don't log file paths that might leak user-identifying info. Crashlytics + Firebase Analytics only (no Sentry/Datadog).                                                                                                                                                                            |
| V8 Data protection          | yes              | The `hand-gate/{ulid}.jpg` frames contain camera imagery — keep them in `cacheDir` (not external storage), delete promptly (on each resolve + app-launch sweep), and ensure they're not included in any backup/share. Coarse location only (CLAUDE.md) — Phase 4 doesn't touch location.                                                                         |
| V9 Communications           | no               | Phase 4 makes no network calls (Phase 5 owns upload).                                                                                                                                                                                                                                                                                                            |
| V10 Malicious code          | n/a              | —                                                                                                                                                                                                                                                                                                                                                                |
| V11 Business logic          | yes              | The ONB-08 gate (once per install per account) is a business rule — reinstall legitimately re-runs it; that's intended, not a bypass. The hand-gate bypass (`gate.bypassed`, APK flavor) is an intended business rule, not a security hole — but it must be flavor-scoped (playStore builds cannot opt into the bypass, per the install-source-check precedent). |
| V12 Files & resources       | yes              | `cacheDir/hand-gate/` JPEGs — internal storage, prompt cleanup. `hand_landmarker.task` is a bundled read-only asset. No file uploads/downloads in Phase 4.                                                                                                                                                                                                       |
| V13 API & web service       | no               | No new API surface.                                                                                                                                                                                                                                                                                                                                              |
| V14 Configuration           | yes              | Remote Config reads (HAND-11 knobs) must have sane defaults (5 hits / 400 ms / 0.5 confidence on Android) so a Remote Config fetch failure degrades gracefully. The `__DEV__` guard + flavor scoping for the debug affordance and the gate bypass are configuration concerns.                                                                                    |

### Known threat patterns for this stack

| Pattern                                                   | STRIDE                                   | Standard mitigation                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Debug affordance shipped to production                    | Elevation of privilege / Info disclosure | `if (__DEV__)` wrapping the entire handler; test absence in release builds (Pitfall 7).                             |
| Camera frames left in cache                               | Information disclosure                   | `cacheDir` only; delete on each gate-check resolve; app-launch sweep; exclude from backup.                          |
| Logging the JWT / `sub`                                   | Information disclosure                   | Never log auth material; Crashlytics breadcrumbs scrubbed.                                                          |
| Gate bypass available on the wrong build flavor           | Tampering / spec evasion                 | Flavor-scope the bypass (playStore cannot opt in), mirroring the install-source-check bypass precedent.             |
| Crash-recovery payload trusted blindly                    | Tampering (low — it's app-internal)      | Validate `recovered` is `string[]`; the recovered segments still go through the normal (Phase 5) verification path. |
| Listener/receiver leaks → battery drain / duplicate stops | DoS (self-inflicted)                     | Unregister every receiver/callback/subscription on module invalidate & screen unmount (Pitfall 5).                  |

> Note: Phase 4's attack surface is small — no network, no new auth, no new persisted secrets. The main "security-ish" concerns are (a) not leaking the debug affordance, (b) not leaving camera frames around, (c) not logging auth material, (d) flavor-scoping the gate bypass.

---

## Sources

### Primary (HIGH confidence)

- `/Users/adnaan/Documents/hl-homelander/.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-CONTEXT.md` — the locked decisions, scope boundary, code context, specifics, deferred ideas (read in full).
- `/Users/adnaan/Documents/hl-homelander/CLAUDE.md` — project constraints, version pins, Do-NOT-Use list, audio-drop banner, version-compatibility pinpoints.
- User auto-memory (`MEMORY.md`) — no clan-chief constructs; distribution = APK→Play→iOS; drift metrics `{max,mean,p99}`; Figure's "Minutes" app is the reverse-engineering reference; Phase 3 Wave 1 was cosmetic; functionality-first during smoke.

### Secondary (MEDIUM confidence — referenced in CONTEXT, NOT read before timeout)

- `idea-brief.md` §2.1 (capture spec), §4 (recording workflow + hand-gate), §5 (user journey), §10 (lifecycle policy table — canonical for `useRecordingLifecycle`), §13 (UI/brand — TTS rate 1.0 / pitch 0.95 / volume 0.85).
- `design-spec.md` §6 (Tutorial Practice intro), §7 (Recording surface 7a–7h), §8 (Practice complete), §18.2 (Stop-recording confirm modal), §19.1–19.3 (Toasts / VoiceCue overlay / Alert pill), §20 (cross-screen behaviour).
- `engineering-handoff.md` §3 (navigation graph), §4.3 (`recState` machine — canonical shape), §5 (native APIs table), §6.1–6.3 (audio & haptics spec, voice fallback chain).
- `figure-app-hands.md` — reverse-engineered MediaPipe HandLandmarker integration pattern (the `detectHands(path)` signature, IMAGE mode, `numHands=2`, CPU delegate, 320×240 RGB_565 decode all flow from this).
- `.planning/research/STACK.md` — version pins + OEM sharp edges + config recipes (vision-camera stack, MediaPipe dep declaration, TTS recipe, phone-state pitfalls).
- `.planning/research/PITFALLS.md` — pitfall catalog (vision-camera + new-arch, MediaPipe task-loading, phone-state OEM quirks Xiaomi MIUI / Oppo ColorOS).
- `.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md` — Phase 3 decisions (D-API-01..03 bridge contract, D-FS-01..05 storage layout, D-SEG-01..03 segmentation + veto, D-FGS-01..02, D-THERM-01).
- `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md` — Phase 2 decisions (D-COMPAT-05 `CompatResult` schema with `cameraId`, D-NAV-_ navigation invariants / Pattern 54 routeRegistry, D-STATE-_ Zustand patterns).
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md` — phase scope, the 36 v1 requirements (HAND-01..14 / REC-01..16 / ONB-03..08), locked constraints, current position.
- `task-taxonomy.md` — 65-task catalog (dev-affordance test task source).

### Tertiary (LOW confidence — training knowledge, NOT verified this session)

- MediaPipe `tasks-vision` 0.10.21 builder API (`HandLandmarker`, `HandLandmarkerOptions`, `BaseOptions`, `BitmapImageBuilder`, `RunningMode.IMAGE`) — sketch from training memory; verify against `figure-app-hands.md` + javadoc.
- `react-native-vision-camera@4.7.3` `takePhoto()` API shape — training memory.
- `react-native-tts@4.1.1` `voices()` / `setDefaultVoice()` API — training memory.
- `react-native-orientation-locker@1.7.x` currency & new-arch compat — training memory.
- `react-native-haptic-feedback@2.3.3` arbitrary-ms-pattern support — training memory (may need RN `Vibration.vibrate(pattern)` fallback).
- `TelephonyManager.registerTelephonyCallback()` permission requirements per API level/OEM — training memory; `PITFALLS.md` should be authoritative.

---

## Metadata

**Confidence breakdown:**

- User constraints / scope / locked decisions: HIGH — copied verbatim from `04-CONTEXT.md` (read in full).
- Architecture / responsibility map / component layout: HIGH — derived directly from the locked decisions.
- Standard stack (versions): HIGH for the CLAUDE.md-pinned libs; MEDIUM for `react-native-orientation-locker@1.7.x` (un-re-verified) — flagged.
- Code examples (Kotlin/JS sketches): LOW — training-knowledge sketches; flagged with `> TODO: verify` throughout; the planner MUST cross-check against `figure-app-hands.md` and the pinned-version docs.
- Pitfalls: MEDIUM — drift-on-handoff and OEM-phone-state pitfalls are well-grounded (CLAUDE.md banner + CONTEXT references to `PITFALLS.md`); the rest are standard RN/MediaPipe/VC failure modes.
- Validation Architecture: MEDIUM — structurally complete and mapped to the requirement buckets; specific test commands and the Kotlin-test-infra question flagged as `> TODO`.
- Security Domain: MEDIUM — Phase 4's attack surface is small; the ASVS mapping is conservative.

**Research date:** 2026-05-11
**Valid until:** ~2026-06-10 for the locked stack (CLAUDE.md pins are stable); ~2026-05-18 for the `[ASSUMED]` library-API claims (should be verified before/during Wave 1).
**Status:** PARTIAL — written under a stream-idle-timeout forced stop. The Assumptions Log (A1–A11) and Open Questions (1–6) enumerate everything a full pass would have verified. The planner should resolve those before locking task actions, primarily by reading `figure-app-hands.md`, `engineering-handoff.md §4.3`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, Phase 3 `03-CONTEXT.md` (D-SEG-02 veto window, D-FS-04 sweep), and `.planning/REQUIREMENTS.md` (HAND-11/14 + REC-\* exact wording).
