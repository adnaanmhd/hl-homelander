# Phase 4: HandDetector, Recording UX & Practice Tutorial - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 4-HandDetector, Recording UX & Practice Tutorial
**Areas discussed:** Camera handoff (gate ↔ active), RecordingScreen route placement, Lifecycle-edge handler strategy, Phase 4 wave structure

---

## Camera handoff (gate ↔ active recording)

### Q1: How should the gate camera and active-recording camera coexist on Android?

| Option                                                | Description                                                                                                                                                                                                                                                                            | Selected |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| VisionCamera for gate, then HC takeover               | Gate uses `react-native-vision-camera@4.7.3` + `takePhoto()` every ~400 ms. On gate-pass: VC unmounts → `HumynCapture.start(opts)`. The 80 ms vibrate + TTS + brightness drop visually masks the ~200-500 ms gap. Cleanest split. Adds VC + worklets-core + Skia + reanimated to deps. | ✓        |
| Extend HumynCapture to expose preview                 | Add a preview surface API to HumynCapture. Gate uses HC throughout. Avoids VC + transitive deps. But re-opens Phase 3 design; preview ↔ record state inside HC.                                                                                                                       |          |
| Two parallel Camera2 sessions (gate uses raw Camera2) | Phase 4 ships its own thin Kotlin Camera2 wrapper for the gate. No VisionCamera dep. But 2 hand-rolled camera sessions to maintain.                                                                                                                                                    |          |

**User's choice:** VisionCamera for gate, then HC takeover (Recommended)
**Notes:** None — straight pick of the locked-stack option.

### Q2: How should the gate-pass → active-recording transition be sequenced and timed?

| Option                                      | Description                                                                                                                                                                                                                                                                         | Selected |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Sequential, masked by TTS                   | Order: ring fills → 80 ms vibrate → TTS "Recording started" enqueues (en-IN female; ~600 ms speaking time) → brightness drop → unmount VC + `HumynCapture.start(opts)` → await Promise → cross-fade preview to active. ~600 ms TTS line covers ~300-500 ms VC tear-down + HC start. | ✓        |
| Parallel — fire HC.start() during ring fill | Speculative pre-warm: when `consecutiveHits >= targetHits-1`, kick `start()` in parallel. Saves ~300 ms but false-positive paths add cancel/discard complexity.                                                                                                                     |          |
| Pre-mounted preview surface, switch source  | Mount one SurfaceView; swap underlying camera owner from VC to HC without unmounting. Requires deep VC + HC plumbing; high risk.                                                                                                                                                    |          |

**User's choice:** Sequential, masked by TTS (Recommended)
**Notes:** None.

### Q3: Which back-camera lens should VisionCamera open for the gate?

| Option                                        | Description                                                                                                                                                                                               | Selected |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Same ultrawide lens HC uses                   | Read `compat.lastResult.v1.checks.ultrawideDfov.cameraId` and pass that exact `cameraId` to VC's `useCameraDevice()` filter so the gate sees what HC will record. JS reads MMKV at RecordingScreen mount. | ✓        |
| Default back camera, accept framing skew      | `useCameraDevice('back')`. Likely the main lens, not ultrawide — different FOV → user's hands framed differently in gate vs recording. Could leak skin-tone-bias asymmetry into HAND-14 telemetry.        |          |
| VC's `physicalDevices: ['ultra-wide-camera']` | VC 4.x's `physicalDevices` filter. Less coupling to compat. But VC's heuristic might pick a different lens on OEM-quirked devices.                                                                        |          |

**User's choice:** Same ultrawide lens HC uses (Recommended)
**Notes:** None.

### Q4: How should HandDetector be invoked?

| Option                               | Description                                                                                                                                                                                                                                                                                                                                          | Selected |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Photo-to-disk → path → native bitmap | Per design-spec §7c verbatim: VC `Camera.takePhoto()` → file path → `HandDetector.detectHands(path: String) → Int`. Kotlin loads `BitmapFactory.decodeFile(path)` at 320×240 RGB_565 (HAND-13), runs `HandLandmarker.detect(MPImage)`, returns `result.landmarks().size`, recycles. Files at `cacheDir/hand-gate/{ulid}.jpg`. ~80-150 ms wall clock. | ✓        |
| Frame processor (in-memory bitmap)   | Skip disk round-trip via VC frame processor. Faster (~30-60 ms) but requires worklets-core + Reanimated worklet plumbing and diverges from the design-spec/figure pattern.                                                                                                                                                                           |          |
| Photo-to-disk with pre-warm queue    | Same as recommended, plus HAND-12 pre-warm explicit.                                                                                                                                                                                                                                                                                                 |          |

**User's choice:** Photo-to-disk → path → native bitmap (Recommended)
**Notes:** HAND-12 pre-warm folded into D-CAM-04 explicitly even though the user picked option 1 — the recommended option is enriched in CONTEXT to include the pre-warm at RecordingScreen mount.

---

## RecordingScreen route placement

### Q1: Where should RecordingScreen live in the navigator?

| Option                                     | Description                                                                                                                                                                                                                                                                                                                                                                                      | Selected |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| RootNativeStack sibling of MainTabs        | Sibling of MainTabs / Profile / HelpCenter / ForceUpgrade in `RootNativeStack.tsx`. Tab bar suppressed structurally (HOME-08). Single route handles isPractice=true (from PracticeIntro via `navigation.replace`) and isPractice=false (Phase 6 will push from Task details). `gestureEnabled: false`, `headerShown: false`, `fade` animation. `routeRegistry` invariant test gains `Recording`. | ✓        |
| Modal-presentation sibling                 | Same parent but `presentation: 'fullScreenModal'`. Adds slide-up vibe; Stop confirmation modal then becomes modal-on-modal.                                                                                                                                                                                                                                                                      |          |
| Two routes — separate Practice + Recording | `PracticeRecording` (in OnboardingStack) and `Recording` (in RootNativeStack). Cleaner mental model but duplicated route + verifier.                                                                                                                                                                                                                                                             |          |

**User's choice:** RootNativeStack sibling of MainTabs (Recommended)
**Notes:** None.

### Q2: How do we make non-practice testable in Phase 4?

| Option                                                              | Description                                                                                                                                                                                                                                     | Selected |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Practice-only end-to-end + dev-only debug entry                     | Practice flow as the only PRODUCTION entry. For non-practice verification on smoke, add a `__DEV__`-gated debug affordance on TasksPlaceholder that pushes `Recording` with a hardcoded test task. Production builds strip via `__DEV__` guard. | ✓        |
| Wire a real `Start Recording` button on TasksPlaceholderScreen      | Real button visible in production. Cost: temporary UI a user might see if Phase 6 slips.                                                                                                                                                        |          |
| Practice-only — defer non-practice verification entirely to Phase 6 | Saves dev affordance work. But pushes a LOT of risk into Phase 6.                                                                                                                                                                               |          |

**User's choice:** Practice-only end-to-end + dev-only debug entry (Recommended)
**Notes:** None.

### Q3: Practice intro screen placement + recording kickoff?

| Option                                                                         | Description                                                                                                                                                                                               | Selected |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Add `PracticeIntro` to OnboardingStack between RigTutorial and RecordingScreen | RigTutorial's `Next` CTA navigates to `PracticeIntro`. `Start practice` does `navigation.replace('Recording', { taskId: '__practice__', ..., isPractice: true })`. ONB-08 gated via MMKV per-account key. | ✓        |
| RigTutorial directly launches recording                                        | Skip the separate intro screen. Loses design-spec-locked "One quick try / 60 seconds" framing. Designs are LOCKED — would be a deviation.                                                                 |          |
| Practice intro lives at RootNativeStack level                                  | Re-entrant from anywhere. But ONB-08 says no re-entry path.                                                                                                                                               |          |

**User's choice:** Add `PracticeIntro` to OnboardingStack between RigTutorial and RecordingScreen (Recommended)
**Notes:** None.

### Q4: Practice-complete + ONB-08 once-per-account gate persistence?

| Option                                  | Description                                                                                                                                                                                                                                                                         | Selected |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| MMKV key + Home navigation              | `tutorial.practice_done.{googleAccountId}.v1` (keyed by JWT `sub`). On `computeInitialRoute` boot check: missing flag → OnboardingStack initial route remains RigTutorial. New Google account on same install → different `sub` → tutorial re-runs. Reinstall wipes MMKV → re-runs. | ✓        |
| Server-side flag on `/me`               | Backend stores `tutorial_completed_at`. Survives reinstall + MMKV wipe. But requires backend extension; offline-first new-install can't read; backend round-trip before showing tutorial.                                                                                           |          |
| MMKV flag, but global (not per-account) | Single `tutorial.practice_done.v1` key. Simpler. But violates ONB-08 verbatim.                                                                                                                                                                                                      |          |

**User's choice:** MMKV key + Home navigation (Recommended)
**Notes:** None.

---

## Lifecycle-edge handler strategy

### Q1: Where should the JS-side lifecycle controller live?

| Option                                                         | Description                                                                                                                                                                                                                           | Selected |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Single hook `useRecordingLifecycle` mounted in RecordingScreen | One JS hook subscribed to AppState, Linking, Battery, Orientation, PhoneState, AudioFocus, StatFs. Owns the §10 policy table. Calls `HumynCapture.stop()` via the D-SEG-02 veto window when policy says stop. Single source of truth. | ✓        |
| Dedicated `RecordingLifecycleService` (singleton class)        | Long-lived JS singleton, not React-bound. Wires subscriptions at app start. Useful if multiple screens need lifecycle awareness (they don't).                                                                                         |          |
| Per-edge hooks (`useBatteryAlerts`, `usePhoneCall`, etc.)      | Compose 6-8 small hooks. More files; clearer SRP. But the §10 policy is correlated — fragmenting scatters logic.                                                                                                                      |          |

**User's choice:** Single hook `useRecordingLifecycle` mounted in RecordingScreen (Recommended)
**Notes:** None.

### Q2: Phone-call detection strategy on Android?

| Option                                                  | Description                                                                                                                                                                                                                                                                              | Selected |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Custom Kotlin native module + AudioFocusChange fallback | `HumynPhoneState` Kotlin module. `TelephonyManager.registerTelephonyCallback()` (API 31+) with `PhoneStateListener` fallback for 26-30. DOES NOT request `READ_PHONE_STATE` runtime perm. ALSO subscribes to `AudioManager.OnAudioFocusChangeListener` for alarm/notification detection. | ✓        |
| Use `react-native-call-detection` library               | Off-the-shelf community lib. Adds maintained dep + transitive surface. Past versions have leaked listeners.                                                                                                                                                                              |          |
| AudioFocusChange only (skip TelephonyManager)           | Only `OnAudioFocusChangeListener`. Simpler — one subscription. But can't differentiate "call answered" from "declined-but-ringtone-loss" — wrongly stops on decline. Rejected.                                                                                                           |          |

**User's choice:** Custom Kotlin native module + AudioFocusChange fallback (Recommended)
**Notes:** None.

### Q3: Build vs library decisions for the JS-bound dependencies — minimum-surface bundle?

| Option                                                                 | Description                                                                                                                                                                                                                                                                                                            | Selected |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Minimal libs: tts + brightness + reanimated stack                      | Add: `react-native-tts@4.1.1`, vision-camera + worklets-core + reanimated + skia, `react-native-fs@2.20.0`, `react-native-orientation-locker@1.7.x`. Build IN-HOUSE: `HumynPhoneState`, brightness control (~10-30 LOC Kotlin), `HumynBattery` (~50 LOC Kotlin). Total: 7 new RN deps + 4 new in-house Kotlin modules. | ✓        |
| Heavier libs: react-native-device-info + community libs for everything | `react-native-device-info` for battery + storage; `react-native-call-detection` for phone state; `react-native-screen-brightness` for brightness. Reduces in-house Kotlin to just HandDetector. But: each lib drags transitive surface, version-compat headaches.                                                      |          |
| Maximum in-house: skip vision-camera, build everything                 | Hand-roll Camera2 wrapper for the gate. Counter-recommended given vision-camera is STACK-locked.                                                                                                                                                                                                                       |          |

**User's choice:** Minimal libs: tts + brightness + reanimated stack (Recommended)
**Notes:** None.

### Q4: Force-quit + OS-evict recovery UX?

| Option                           | Description                                                                                                                                                                                                                                                   | Selected |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Detect on-launch — toast + Home  | Phase 4 extends HumynCapture's package init to emit `onCrashRecovery` when sweep finalizes orphan segments. Listener at app boot fires Home toast "Recording recovered after force-quit — uploading." Recovered segment goes through normal upload (Phase 5). | ✓        |
| Recovery banner on Home (sticky) | Same, but persistent banner until upload completes. Risk of duplication with Phase 5's Pending Uploads tile.                                                                                                                                                  |          |
| No UX — silent recovery          | Sweep happens silently; user discovers in History later. Misses an honest "we caught your data" trust moment.                                                                                                                                                 |          |

**User's choice:** Detect on-launch — toast + Home (Recommended)
**Notes:** None.

---

## Phase 4 wave structure

### Q1: How should Phase 4 break into waves?

| Option                                                                                      | Description                                                                                                                                                                                                                                                                                                            | Selected |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 5 waves: foundation → native modules → screens scaffold → state machine + lifecycle → smoke | Wave 1: RN deps + native module shells + MMKV key. Wave 2: full native impls (HandDetector + PhoneState + Battery + ScreenBrightness). Wave 3: screens scaffold + visual baselines. Wave 4: state machine + lifecycle hook + dev affordance. Wave 5: crash-recovery listener + 04-MANUAL-SMOKE.md + Pixel 10a re-walk. | ✓        |
| 3 waves: native + RN (parallel) → integration → smoke                                       | Wider waves, fewer atomic commits. Faster but harder to review and verify atomically.                                                                                                                                                                                                                                  |          |
| Vertical slice: practice flow first, then non-practice + lifecycle                          | Earliest demoable slice. But native module reuse across waves means duplication risk.                                                                                                                                                                                                                                  |          |

**User's choice:** 5 waves: foundation → native modules → screens scaffold → state machine + lifecycle → smoke (Recommended)
**Notes:** None.

### Q2: Wave 0 cosmetic fix-up?

| Option                                                    | Description                                                                                                                                                                                                                                              | Selected |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Skip — no Wave 0                                          | Phase 3 was native-module-only; no new visual surfaces. `02-COSMETIC-GAPS.md` and `03-W1-AMENDMENTS.md` both addressed and frozen. Phase 4 cosmetic gaps logged in `04-COSMETIC-GAPS.md`; Phase 5 picks up OR a Wave 5 fix-up before Phase 5 plan-phase. | ✓        |
| Wave 0 = clear Phase 3 hardware UAT first                 | Block Phase 4 plan-phase until 7 pending hardware UAT items cleared. But Phase 4 IS the integration that exercises the capture pipeline on hardware — circular dependency.                                                                               |          |
| Wave 0 = Phase 2/3 amendments only if STATE.md flags them | Conditional check. Today: STATE.md flags none → collapses to "skip".                                                                                                                                                                                     |          |

**User's choice:** Skip — no Wave 0 (Recommended)
**Notes:** None.

### Q3: Phase 4 acceptance gate?

| Option                                                                   | Description                                                                                                                                                                                                                                                                                                                                                                        | Selected |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Practice E2E + non-practice via dev affordance + smoke walk on Pixel 10a | Practice flow E2E + non-practice 10-min recording via dev affordance + lifecycle edges (call answered/declined, rotation, force-quit recovery) + thermal injection (`adb shell cmd thermalservice override-status 4`). Verifier accepts "module-ready + practice E2E passes + lifecycle edges manually verified" — Phase 3's 7 pending hardware UAT items effectively retire here. | ✓        |
| Practice flow only (defer non-practice to Phase 6)                       | Acceptance = practice flow + lifecycle edges in practice mode. Smaller scope; defers risk.                                                                                                                                                                                                                                                                                         |          |
| Full real-mode coverage including 25-min sustained capture               | Most comprehensive; longest smoke walk; risk of hardware variance derailing the gate.                                                                                                                                                                                                                                                                                              |          |

**User's choice:** Practice E2E + non-practice via dev affordance + smoke walk on Pixel 10a (Recommended)
**Notes:** None.

### Q4: Visual snapshot baselines for Phase 4 surfaces?

| Option                                                                                | Description                                                                                                                                                                                                                                              | Selected |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Baseline static surfaces; skip recording substates                                    | ~9 baselines: PracticeIntro (1), PracticeComplete pre-confetti (1), Recording rotate-prompt (1), ready (1), gate ring at 0/50/100 % (3), active at t=10 s + t=05:32 (2), Stop confirm modal (1). Skip live-camera, brightness-5%, confetti, alert pills. | ✓        |
| Baseline only static surfaces (PracticeIntro + PracticeComplete + Stop confirm modal) | Just 3 baselines. Skips RecordingScreen visual lock — risk of regressions slipping through.                                                                                                                                                              |          |
| Skip baselines entirely for Phase 4                                                   | All Phase 4 surfaces are camera-dependent or animation-dependent; rely on operator smoke walk only. Loses CSS regression catch on static screens.                                                                                                        |          |

**User's choice:** Baseline static surfaces; skip recording substates (Recommended)
**Notes:** None.

---

## Final gate

**Q:** All four areas covered. Anything still unclear?

| Option                  | Selected |
| ----------------------- | -------- |
| I'm ready for context   | ✓        |
| Explore more gray areas |          |

**User's choice:** I'm ready for context.

---

## Claude's Discretion

Per CONTEXT.md `<decisions>` Claude's Discretion section:

- `RecState` shape implementation (Zustand slice vs `useReducer` vs XState)
- Hand-gate cache file lifecycle policy (delete on resolve vs delete on next-tick vs accumulate-and-sweep)
- HAND-12 pre-warm exact timing (RecordingScreen mount vs ready-substate enter vs gate-substate enter)
- Battery polling cadence (listener-only vs periodic cross-check)
- Storage check cadence (REC-16) — start-time only vs periodic during recording
- `useRecordingLifecycle` exact subscription shape — one big hook with internal sub-hooks vs flat top-level
- `__DEV__` debug affordance UI — long-press on TasksPlaceholder text vs hidden corner tap vs visible button
- Hardcoded test task choice for the dev affordance
- `computeInitialRoute` extension exact signature
- `onCrashRecovery` event payload shape
- Brightness restore ordering — on stop vs on screen unmount vs both
- Stop confirmation modal title text (design-spec recommends "Stop recording?")
- VoiceCue overlay duration + dismissal animation
- Post-stop toast routing exact navigation API (`replace` vs `goBack` + programmatic state reset)

## Deferred Ideas

Per CONTEXT.md `<deferred>` section:

- Tasks list / Task details / `Start Recording` CTA — Phase 6
- Upload pipeline (UP-01..19) — Phase 5
- Hash-verify worker + IMU-liveness backend check — Phase 5
- iOS analogues — Phase 8
- Continuous on-device hands-in-frame enforcement — out of MVP
- Per-locale `recording_gate_skipped` rate dashboard cohort — Phase 8 (OBS-03)
- Bystander-consent in-app secondary-subject screen — out of scope at MVP
- Mobile dark mode for non-recording surfaces — out of scope at MVP
- PROJECT.md / REQUIREMENTS.md / ROADMAP.md / `idea-brief.md` §3.1 stale clan-chief / KGeN narrative cleanup — needs `/gsd:cleanup` pass
- Phase 3 hardware UAT items #1-#7 effectively retire during Phase 4 Wave 5 smoke walk
- `04-COSMETIC-GAPS.md` — created during Wave 5 smoke if needed (D-WAVE-09 amendment-protocol pattern from Phase 3)
