# Phase 4: HandDetector, Recording UX & Practice Tutorial - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 puts the recording surface together end-to-end on top of Phase 3's
HumynCapture native module. Concretely:

- **`HumynHandDetector` (new Kotlin native module)** wrapping MediaPipe
  `HandLandmarker` (`hand_landmarker.task` ~7.8 MB, `RunningMode.IMAGE`,
  `numHands=2`, all confidences 0.5, CPU delegate). Surface:
  `HandDetector.detectHands(path: String) → Int`. Loads JPEG via
  `BitmapFactory.decodeFile(path)` at 320×240 RGB_565 (HAND-13), runs
  `HandLandmarker.detect(MPImage)`, returns `result.landmarks().size`,
  recycles the bitmap. Mirrors `figure-app-hands.md` reverse-engineered
  pattern verbatim.
- **`react-native-vision-camera@4.7.3` integration** for the gate substate:
  preview + `Camera.takePhoto()` polled every ~400 ms. Opens the SAME
  ultrawide lens HumynCapture will record from (cameraId read from
  `compat.lastResult.v1.checks.ultrawideDfov.cameraId`). Frames written to
  `cacheDir/hand-gate/{ulid}.jpg`, fed to `HandDetector.detectHands(path)`,
  cleaned up after each check. Pre-warmed at RecordingScreen mount via a
  single throwaway `takePhoto()` (HAND-12).
- **`PracticeIntroScreen`** added to OnboardingStack right after RigTutorial
  (matches design-spec §6 verbatim — heading "One quick try", body "60
  seconds, just to get the feel", `Start practice` CTA does
  `navigation.replace('Recording', { taskId: '__practice__', taskName:
'Practice — 60 sec', isPractice: true })`).
- **`RecordingScreen`** added to RootNativeStack as a sibling of MainTabs /
  Profile / HelpCenter / ForceUpgrade (HOME-08 tab-bar suppression already
  enforced structurally). Owns the entire §7 multi-state surface — rotate
  prompt → ready → gate (loading / waiting / confirmed) → active → stop
  confirmation modal → post-stop toasts. Substate enum + state-machine
  shape matches `engineering-handoff.md §4.3` `RecState` verbatim. Single
  route handles both isPractice=true (entered from PracticeIntro) and
  isPractice=false (Phase 6 will push from Task details; Phase 4 wires a
  `__DEV__`-gated debug affordance on TasksPlaceholder for smoke-walk
  verification).
- **`PracticeCompleteScreen`** added to OnboardingStack (after the
  isPractice=true Recording exit). Confetti + 96×96 success badge +
  scale-pop 500 ms + vibrate `[40, 80, 40]` ms. `Continue` CTA writes
  `tutorial.practice_done.{googleAccountId}.v1 = true` to MMKV (keyed by
  the Google account `sub` from the JWT) then `navigation.reset({routes:
[{name: 'MainTabs'}]})` → Home renders the first-time hero variant.
  `computeInitialRoute` extension checks the per-account flag at boot:
  missing flag → OnboardingStack initial route remains RigTutorial; flag
  set → MainTabs. Reinstall wipes MMKV → tutorial re-runs (matches ONB-08
  verbatim).
- **`useRecordingLifecycle` hook** mounted in RecordingScreen. Single JS
  policy table from `idea-brief.md §10` mapping each event to one of:
  `stop()` (upload if ≥60 s, discard if not) | `continue()` |
  `alert+continue()` | `alert+refuse-new()`. Subscriptions: AppState,
  Linking, BatteryManager (via in-house `HumynBattery` Kotlin module
  wrapping `Intent.ACTION_BATTERY_CHANGED`), OrientationListener (via
  `react-native-orientation-locker@1.7.x`), `HumynPhoneState` (in-house
  Kotlin: `TelephonyManager.registerTelephonyCallback()` API 31+ with
  `PhoneStateListener` fallback for API 26–30 + `AudioManager.OnAudioFocusChangeListener`),
  `react-native-fs` `getFSInfo()` for storage. Calls
  `HumynCapture.stop()` via the D-SEG-02 veto window when the policy says
  stop. Fires TTS via `react-native-tts@4.1.1` for the alert lines per
  `engineering-handoff.md §6.3` voice-fallback chain.
- **`HumynScreenBrightness` (new tiny Kotlin module, ~10–30 LOC)** for the
  brightness 5 % drop at gate exit and restore on stop/exit, via
  `WindowManager.LayoutParams.screenBrightness` write/restore on the
  current activity's UI thread.
- **Crash-recovery UX:** Phase 4 extends HumynCapture's package init to
  emit a one-shot `onCrashRecovery` event when Phase 3's app-launch sweep
  finalizes any orphan segments. Listener at app boot fires a Home toast
  "Recording recovered after force-quit — uploading." The recovered
  segment goes through the normal upload path (Phase 5).

**Explicitly OUT of Phase 4 scope:**

- **Tasks list / Task details / `Start Recording` CTA** — Phase 6. In
  Phase 4 the only PRODUCTION entry to RecordingScreen is the practice
  flow (RigTutorial → PracticeIntro → Recording). Non-practice path is
  exercised in Phase 4 only via a `__DEV__`-gated debug affordance on
  TasksPlaceholderScreen that pushes `Recording` with a hardcoded test
  task. Production builds (apkRollout / playStore) strip the affordance.
- **Upload pipeline** (UP-01..19) — Phase 5. Phase 4 calls
  `HumynCapture.stop()` and trusts segments land in `recordings/` /
  `practice/` per Phase 3 D-FS-01..05. Phase 5 picks up.
- **iOS analogue** (`HumynHandDetector` Swift via MediaPipeTasksVision pod
  0.10.21, `HumynPhoneState` via CXCallObserver, etc.) — Phase 7.
- **Hash-verify worker + IMU-liveness backend check** — Phase 5.
- **Bystander-consent UI** — out of scope at MVP per PROJECT.md.

</domain>

<decisions>
## Implementation Decisions

### Camera handoff (gate ↔ active recording)

- **D-CAM-01:** Gate uses `react-native-vision-camera@4.7.3` (preview +
  `takePhoto()` only; the locked CLAUDE.md / STACK pin). Active recording
  hands off to HumynCapture (Camera2 owned by Phase 3). On gate-pass: VC
  unmounts → awaits camera close → `HumynCapture.start(opts)` → first
  frame. Phase 3's HumynCapture is NOT extended to expose preview; the
  module stays single-responsibility.
- **D-CAM-02:** Gate-pass → active transition is **sequential, masked by
  TTS**. Order: ring fills → 80 ms vibrate fires → TTS "Recording
  started" enqueues (en-IN female; ~600 ms speaking time) → brightness
  drop to 5 % → unmount VC + `HumynCapture.start(opts)` → await Promise
  resolution → cross-fade preview to active substate. The ~600 ms TTS
  line covers the ~300–500 ms VC tear-down + HC start; user perceives a
  continuous "started" moment. If `start()` rejects mid-transition
  (`thermal_throttling` / `permission_revoked` / `storage_full`), abort:
  voice cue "Phone too warm" or analogous + return to ready substate.
- **D-CAM-03:** Gate camera lens is read from
  `compat.lastResult.v1.checks.ultrawideDfov.cameraId` and passed
  explicitly to VC's `useCameraDevice()` filter so the gate sees what HC
  will record. Hands need to be detected from the egocentric ultrawide
  POV; default back lens framing skews the hand-in-frame check and could
  leak skin-tone-bias signal asymmetry into HAND-14 telemetry. JS reads
  the MMKV key once at RecordingScreen mount; the same lens id flows into
  `start(opts).startGate` for traceability.
- **D-CAM-04:** HandDetector invocation is **photo-to-disk → path → native
  bitmap** per design-spec §7c verbatim: VC `Camera.takePhoto()` →
  `cacheDir/hand-gate/{ulid}.jpg` → `HandDetector.detectHands(path)` →
  Kotlin `BitmapFactory.decodeFile(path)` at 320×240 RGB_565 → MediaPipe
  `HandLandmarker.detect(MPImage)` → `result.landmarks().size` → return
  Int. Cache JPEGs cleaned up after each check (delete on resolve;
  app-launch sweep deletes any stragglers). HAND-12 pre-warm wired
  explicitly: at RecordingScreen mount, run a single throwaway
  `takePhoto()` to warm CameraDevice + JPEG encoder so the first gate
  detection isn't blocked on cold-start latency.

### RecordingScreen route placement

- **D-NAV-01:** `RecordingScreen` lives at the **RootNativeStack level as
  a sibling of MainTabs / Profile / HelpCenter / ForceUpgrade**. Tab bar
  suppressed structurally (HOME-08 already enforced). Single route
  handles both isPractice=true and isPractice=false. Screen options:
  `gestureEnabled: false`, `headerShown: false`, animation `fade`. The
  `routeRegistry` invariant test (Pattern 54) gains `Recording` — its
  removal would fail CI.
- **D-NAV-02:** **Practice-only PRODUCTION entry + `__DEV__`-gated debug
  affordance on TasksPlaceholderScreen** for non-practice. Production
  builds (apkRollout / playStore) strip the affordance via `__DEV__`
  guard. Debug affordance pushes `Recording` with a hardcoded test task
  `{ taskId: 'cooking_chop_vegetables', taskName: 'Practice — Chop
vegetables', isPractice: false }`.
- **D-NAV-03:** **`PracticeIntroScreen` added to OnboardingStack between
  RigTutorial and the Recording route.** RigTutorial's existing `Next`
  CTA navigates to `PracticeIntro` (today it would advance to MainTabs;
  the navigation target moves). PracticeIntro's `Start practice` CTA
  does `navigation.replace('Recording', { taskId: '__practice__',
taskName: 'Practice — 60 sec', isPractice: true })` — jumping out of
  OnboardingStack into the RootNativeStack route.
- **D-NAV-04:** **`PracticeCompleteScreen` added to OnboardingStack after
  the isPractice=true Recording exit.** ONB-08 once-per-install-per-Google-
  account gate persisted as MMKV key
  `tutorial.practice_done.{googleAccountId}.v1` (keyed by the Google
  account `sub` from the JWT, versioned per Phase 2 `.v1` convention).
  `computeInitialRoute` extension checks the per-account flag at boot;
  missing flag → OnboardingStack initial route remains RigTutorial.
  Continue CTA: writes the flag → `navigation.reset({routes: [{name:
'MainTabs'}]})` → Home first-time hero. Reinstall wipes MMKV →
  tutorial re-runs.

### Lifecycle-edge handler strategy

- **D-LIFE-01:** **Single hook `useRecordingLifecycle` mounted in
  RecordingScreen.** Owns the `idea-brief.md §10` policy table — each
  event maps to one of: `stop()` (upload if ≥60 s, discard otherwise)
  | `continue()` | `alert+continue()` | `alert+refuse-new()`. Calls
  `HumynCapture.stop()` via the D-SEG-02 veto window when the policy
  says stop. Mounted in `useEffect`, torn down on unmount.
- **D-LIFE-02:** **Phone-call detection via in-house Kotlin module
  `HumynPhoneState` + AudioFocusChange fallback.** Use
  `TelephonyManager.registerTelephonyCallback()` (API 31+; minSdk is 26
  — fall back to deprecated `PhoneStateListener` for 26–30). DO NOT
  request `READ_PHONE_STATE` runtime perm — the call-state callback
  works without it for OFFHOOK / IDLE detection. Subscribe ALSO to
  `AudioManager.OnAudioFocusChangeListener` for alarm/notification
  detection (Telephony API doesn't see alarms). Policy: phone OFFHOOK
  = stop+upload; phone IDLE after OFFHOOK = continue stopped.
  AudioFocus transient_loss with phone IDLE = alarm → stop+upload per
  §10. The `HumynPhoneState` module sits next to `HumynCompat` /
  `HumynCapture` / `HumynUpdater` in `ai.humynlabs.capture.phonestate`.
- **D-LIFE-03:** **Dependency strategy = minimal libs + in-house
  natives.** New RN deps (locked stack from CLAUDE.md): `react-native-tts@4.1.1`,
  `react-native-vision-camera@4.7.3`, `react-native-worklets-core@1.6.3`,
  `react-native-reanimated@3.16.x`, `@shopify/react-native-skia@1.x`
  (≥1.2.1), `react-native-fs@2.20.0`, plus `react-native-orientation-locker@1.7.x`
  (the only non-CLAUDE-pinned addition; thin, well-maintained). New
  in-house Kotlin modules: `HumynHandDetector`, `HumynPhoneState`,
  `HumynBattery` (`Intent.ACTION_BATTERY_CHANGED` listener, ~50 LOC),
  `HumynScreenBrightness` (`WindowManager.LayoutParams.screenBrightness`,
  ~10–30 LOC). Battery-storage check uses `react-native-fs.getFSInfo()`
  (no extra Kotlin needed).
- **D-LIFE-04:** **Crash-recovery UX = on-launch toast.** Phase 4 adds
  a small extension to HumynCapture's package init to emit a one-shot
  `onCrashRecovery` event when Phase 3's app-launch sweep re-finalizes
  any orphan segments (sweep already exists per Phase 3 D-FS-04).
  Listener at app boot fires a Home toast "Recording recovered after
  force-quit — uploading." Phase 5 picks up the segment via the normal
  upload path. RecordingScreen NOT visible during recovery; the user
  sees their recording arrive in History (Phase 6).

### Phase 4 wave structure

- **D-WAVE-01:** **Phase 4 = 5 waves.**
  - **Wave 1 (foundation, parallel-OK):** RN deps install (vision-camera
    - worklets-core + reanimated + skia + tts + fs + orientation-locker),
      native module shells (`HumynHandDetector` + `HumynPhoneState` +
      `HumynBattery` + `HumynScreenBrightness` Kotlin scaffolds + their JS
      bindings under `apps/mobile/src/native/`), MMKV key for the tutorial
      gate (`tutorial.practice_done.{accountId}.v1`),
      `computeInitialRoute` extension that observes the per-account
      flag.
  - **Wave 2 (native impls, parallel after Wave 1):** `HumynHandDetector`
    full impl + `hand_landmarker.task` asset bundling + 320×240 RGB_565
    decode + HAND-12 pre-warm; `HumynPhoneState` TelephonyCallback
    (31+) + PhoneStateListener fallback (26–30) + AudioFocus listener;
    `HumynBattery` BatteryManager listener; `HumynScreenBrightness`
    activity-bound brightness write/restore.
  - **Wave 3 (screens scaffold, parallel after Wave 2):**
    `PracticeIntroScreen` + `PracticeCompleteScreen` +
    `RecordingScreen` shell (substate enum + chrome: top minute-bar,
    32-px circular X close, task name, overlay tip "Don't exit while
    recording.", floating stop button, voice-cue overlay pill) +
    OnboardingStack + RootNativeStack route additions +
    `routeRegistry` invariant update + visual-snapshot baselines per
    D-WAVE-03.
  - **Wave 4 (state machine + lifecycle, depends on Waves 2+3):** full
    `recState` machine; gate substate with VC + HandDetector polling
    loop (400 ms cadence; 5 consecutive hits target); gate-pass
    transition (vibrate → TTS → brightness → unmount VC →
    `HumynCapture.start(opts)`); `useRecordingLifecycle` hook with
    every §10 edge wired; `__DEV__`-gated debug affordance on
    TasksPlaceholderScreen.
  - **Wave 5 (smoke + recovery + Phase-3 UAT retirement):** crash-recovery
    listener + Home toast wiring; `04-MANUAL-SMOKE.md` operator runbook
    (practice E2E + non-practice via dev affordance + lifecycle edges
    - thermal injection); Pixel 10a re-walk; Phase 3's seven pending
      hardware UAT items effectively retire here.
- **D-WAVE-02:** **No Wave 0 cosmetic fix-up.** Phase 3 introduced no
  new user-facing visual surfaces (HumynCapture is JS-bridge-only).
  `02-COSMETIC-GAPS.md` and `03-W1-AMENDMENTS.md` are both addressed
  and frozen. Any cosmetic gaps that surface during Phase 4's
  RecordingScreen smoke walk get logged in `04-COSMETIC-GAPS.md`
  (Phase 5 may pick up, OR a Wave 5 fix-up before Phase 5 plan-phase).
- **D-WAVE-03:** **Visual snapshots for Phase 4 = baseline static
  surfaces; skip live-camera substates.** New baselines (~9 total):
  PracticeIntroScreen (1), PracticeCompleteScreen (1, captured
  pre-confetti for determinism), RecordingScreen rotate-prompt
  substate (1, mocked-orientation portrait), ready substate (1,
  mocked-camera-off), gate substate ring at 0 % / 50 % / 100 % (3,
  mocked-camera + mocked HandDetector return values), active
  substate at t=10 s + t=05:32 (2, mocked timers), Stop confirmation
  modal (1). Skip: live-camera substates, brightness-5 % substate
  (window manager not exercisable in jsdom), confetti animation
  (non-deterministic), thermal/battery alert pills (mocked event),
  Practice-complete with confetti firing. Total cumulative project
  visual coverage rises to ~19 baselines. Lives in
  `apps/mobile/__tests__/visual/` per Phase 3 D-WAVE-06.
- **D-WAVE-04:** **Phase 4 acceptance gate.** On Pixel 10a, the operator
  must be able to: (1) walk the practice flow end-to-end fresh-install
  → RigTutorial → PracticeIntro → RecordingScreen with hand-gate →
  60-s practice → Practice-complete → Home; (2) launch a non-practice
  10-min recording via the dev affordance, see the gate pass + 80 ms
  vibrate + TTS + brightness drop + active substate, observe a 10-min
  auto-segment cut without gate re-run, hit Stop, see the toast
  "{Hh Mm} added"; (3) verify lifecycle edges — phone-call-answered
  (stop), phone-call-declined (continue), rotation (stop), force-quit
  (recover on launch with toast); (4) verify thermal injection
  (`adb shell cmd thermalservice override-status 4`) shows the alert
  pill + 2.5-s graceful stop. Verifier accepts "module-ready +
  practice E2E passes + lifecycle edges manually verified" — Phase 3's
  seven pending hardware UAT items effectively retire here.

### Locked from upstream (carried forward, not re-discussed)

These are LOCKED in PROJECT.md / CLAUDE.md / `.planning/research/STACK.md`
/ `idea-brief.md` / `engineering-handoff.md` / Phase 3
`03-CONTEXT.md` and apply unconditionally:

- **Capture spec LOCKED** per `idea-brief.md §2.1`. Phase 4 does not
  alter capture; HumynCapture (Phase 3) owns it.
- **HumynCapture JS bridge LOCKED** per Phase 3 D-API-01..03.
  `start(opts) → Promise<{sessionId, segmentId, recordingId,
filenameBase}>`, `stop() → Promise<void>`, events `onSegmentStart`,
  `onSegmentComplete`, `onSessionStop`, `onThermalAbort`, `onError`.
  `start(opts).startGate` carries the gate result into per-segment
  metadata.
- **Practice files segregated by directory** per Phase 3 D-FS-02
  (`practice/` vs `recordings/`); Phase 4 sets `isPractice: true` in
  `start(opts)`; Phase 3 routes the segment.
- **10-min auto-segment owned by HumynCapture** per Phase 3 D-SEG-01.
  Hand-gate does NOT re-run at auto-segment cuts (CAP-10) — the
  `start_gate` block is preserved across all segments in the session.
- **Pre-record + mid-record thermal owned by HumynCapture** per Phase 3
  D-THERM-01. Phase 4 listens to `onThermalAbort`, fires the voice cue
  - toast.
- **Pause uploads on record start, resume on stop** per CAP-13 — Phase 3
  emits `onSessionStart` / `onSessionStop`; Phase 5 wires the upload-
  pause handlers. Phase 4 does NOT touch upload.
- **Designs LOCKED** per `prototype.html`, `design-spec.md`,
  `engineering-handoff.md`. No new design work.
- **TTS pinned at `react-native-tts@4.1.1`** per CLAUDE.md.
  Voice-fallback chain en-IN female → en-IN neutral → en-US female →
  first available en-\* per `engineering-handoff.md §6.3`.
- **MediaPipe pinned at 0.10.21** (`com.google.mediapipe:tasks-vision@0.10.21`
  Android) per CLAUDE.md. Pin reason: iOS pod 0.10.33+ has XCFramework
  linking issues.
- **VisionCamera pinned at 4.7.3** + worklets-core 1.6.3 + reanimated
  3.16.x + Skia ≥1.2.1 (the locked V4-Skia-frame-processor minimum).
  CameraX rejected; VisionCamera is preview + `takePhoto()` only.
- **English only at MVP**; TTS speaks en-IN female. No localization.
- **No notifications channel.** No `POST_NOTIFICATIONS`, no FCM/APNs.
  No `READ_PHONE_STATE` runtime permission requested.
- **No `ACCESS_NOTIFICATION_POLICY`; no programmatic DND toggle.** REC-09.
- **No Sentry / Datadog / third-party RUM at MVP.** Crashlytics +
  Firebase Analytics only.
- **MMKV `.v1` versioning convention** per Phase 2 (`auth.jwt.v1` /
  `compat.lastResult.v1`). Phase 4's new key is
  `tutorial.practice_done.{accountId}.v1`.
- **Native module shape** (Kotlin module under
  `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/{name}/`
  with a registered `ReactPackage`; JS surface at
  `apps/mobile/src/native/{Name}.ts`). Phase 4 ships
  `HumynHandDetector`, `HumynPhoneState`, `HumynBattery`,
  `HumynScreenBrightness` per this pattern.
- **Wave-anti-patterns from Phase 2 `.continue-here.md`** carry forward:
  surgical-stage protocol for protected files; no cosmetic chasing
  during smoke; never lower capture-spec thresholds.
- **No clan-chief / KGeN constructs** anywhere in Phase 4 surfaces
  (memory `feedback_no_clan_chief_constructs.md`).

### Claude's Discretion

Areas where the user did not specify and the planner has flexibility:

- **`RecState` shape implementation** — Zustand slice vs `useReducer` vs
  XState. Phase 2 used Zustand for the global appStore; Phase 4 may use
  Zustand for a `recordingStore` slice OR keep the recState inside
  RecordingScreen via `useReducer`. Planner picks based on whether other
  surfaces need to observe recording state (probably not — it's
  screen-local).
- **Hand-gate cache file lifecycle** — `cacheDir/hand-gate/{ulid}.jpg`.
  Delete on resolve vs delete on next-tick vs accumulate-and-sweep at
  app-launch. Planner picks.
- **HAND-12 pre-warm exact timing** — at RecordingScreen mount vs at
  ready-substate enter vs at gate-substate enter (just before first
  detection). Planner picks based on perceived gate latency on Pixel 7a.
- **Battery polling cadence** — `BatteryManager` listener fires on
  changes (no polling needed); planner confirms whether the listener
  delivers granular enough updates around 15 % / 5 % thresholds, or
  whether a periodic cross-check is needed.
- **Storage check cadence (REC-16)** — recurring storage check before
  each recording start. Planner picks: only at `start()` time, or also
  every N minutes during active recording.
- **`useRecordingLifecycle` exact subscription shape** — one big hook
  with internal sub-hooks vs flat top-level subscriptions. Planner picks.
- **`__DEV__` debug affordance UI** — long-press on TasksPlaceholder
  text vs hidden corner tap vs visible button under the placeholder
  copy. Planner picks; production builds strip via `__DEV__` guard.
- **Hardcoded test task choice for the dev affordance** — recommended
  `cooking_chop_vegetables`; planner picks any 65-task entry from
  `task-taxonomy.md` that produces a clean smoke walk.
- **`computeInitialRoute` extension exact signature** — adding a per-
  account tutorial flag check. Planner picks how to compose with the
  existing compat-signature gate.
- **`onCrashRecovery` event payload shape** — currently sketched as
  `{recovered: [filenameBase, ...]}`; planner finalizes; the listener
  is one-shot per app launch.
- **Brightness restore ordering** — on stop vs on screen unmount vs
  both. Planner picks; spec says "restored on stop or exit" so both
  paths must restore.
- **Stop confirmation modal title text** — design-spec calls out
  `"Stop recording?"` as recommended; planner can use as-is or confirm
  with PM. Body locked: `"Recordings under 1 minute are discarded."`
- **VoiceCue overlay duration** — design-spec §7d says 1.8 s for
  "Recording started" pill; planner picks dismissal animation.
- **Post-stop toast routing** — design-spec §7h: practice → Practice-done
  screen; real ≥60 s → toast + Home; real <60 s → toast + Ready substate.
  Planner picks the exact navigation API (`replace` vs `goBack` +
  programmatic state reset).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope, requirements, and success criteria

- `.planning/ROADMAP.md` — Phase 4 entry (success criteria #1–5;
  depends on Phase 3; UI hint: yes).
- `.planning/REQUIREMENTS.md` — 36 v1 requirements mapped to Phase 4:
  HAND-01..HAND-14 (lines 110–125), REC-01..REC-16 (lines 127–144),
  ONB-03..ONB-08 (lines 55–60).
- `.planning/PROJECT.md` — locked constraints (capture spec
  non-negotiable; React Native + native modules; English only; no
  notifications; battery / thermal budgets). Audio-drop banner is
  load-bearing — Phase 4 does NOT re-introduce audio capture.
- `.planning/STATE.md` — current position; resume notes carry the
  Phase 3 → Phase 4 handoff (verification status `human_needed`; 7/9
  Phase 3 UAT items pending real-device testing — retire during
  Phase 4 Wave 5).
- `CLAUDE.md` — pin table, Do-NOT-Use list, version-compatibility
  pinpoints. Audio-drop banner is the canonical reference for the
  drift invariant.

### Recording-surface source-of-truth (mandatory reads for Phase 4)

- `idea-brief.md` — Phase 4 hot-spots: §4 (Recording Workflow + hand-gate
  context); §5 (User Journey); §10 (App Lifecycle & Edge Cases — the
  policy table is canonical for `useRecordingLifecycle`); §13
  (UI / Brand — TTS voice spec rate 1.0 / pitch 0.95 / volume 0.85).
- `design-spec.md` — Phase 4 hot-spots: §5 (Tutorial Rig — already
  shipped Phase 2); §6 (Tutorial Practice intro `#tut-practice` — NEW
  in Phase 4); §7 (Recording surface — every substate 7a–7h); §8
  (Practice complete `#practice-done` — NEW in Phase 4); §18.2 (Stop
  recording confirm modal); §19.1–§19.3 (Toasts + VoiceCue overlay +
  Alert pill); §20 (Cross-screen behaviour notes).
- `engineering-handoff.md` — Phase 4 hot-spots: §3 (Navigation graph —
  RecordingScreen placement); §4.3 (Recording state machine `recState`
  — canonical shape including `gate.phase`, `gate.consecutiveHits`,
  `gate.targetHits`, `gate.cadenceMs`, `gate.skipped`, `gate.bypassed`);
  §5 (Native APIs table — Camera, Speech synthesis, Vibration,
  Battery monitoring, Thermal monitoring, Storage check, Background
  interruption, Hand detection, Screen brightness control rows); §6
  (Audio & haptics specification — §6.1 beeps, §6.2 vibration patterns
  including hand-gate-pass 80 ms, practice-done [40, 80, 40] ms,
  battery-alert [100, 50, 100] ms, thermal-alert 800 ms continuous;
  §6.3 speech voice fallback chain).
- `figure-app-hands.md` — reverse-engineered MediaPipe HandLandmarker
  integration pattern from Figure's "Minutes" app. The
  `HandDetector.detectHands(path)` signature, IMAGE mode, `numHands=2`,
  CPU delegate, 320×240 RGB_565 decode all flow from this.

### Phase 1 outputs (consume directly)

- `.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md`
  — backend / distribution decisions; not a Phase 4 dependency directly
  but flavor-aware behavior (apkRollout vs playStore) flows through
  for the `__DEV__`-gated debug affordance.

### Phase 2 outputs (consume directly)

- `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md`
  — Phase 2 implementation decisions; D-COMPAT-05 (`CompatResult` Zod
  schema with `cameraId` for the ultrawide lens) feeds Phase 4 D-CAM-03;
  D-NAV-_ navigation invariants apply (Pattern 54 routeRegistry
  invariant test); D-STATE-_ Zustand patterns; D-PKG-07 npm-only.
- `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` — Phase 2
  shipped this; Phase 4 changes the `Next` CTA target from MainTabs
  to PracticeIntro.
- `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` — Phase 2
  placeholder; Phase 4 wires the `__DEV__`-gated debug affordance for
  non-practice testing (production builds strip via `__DEV__` guard).
- `apps/mobile/src/navigation/{RootNativeStack,OnboardingStack,MainTabs}.tsx`
  — navigators Phase 4 extends. RootNativeStack adds `Recording`;
  OnboardingStack adds `PracticeIntro` + `PracticeComplete`; MainTabs
  unchanged.
- `apps/mobile/src/state/initialRoute.ts` — `computeInitialRoute` —
  Phase 4 extends with the per-account tutorial flag.
- `apps/mobile/src/state/appStore.ts` — Zustand store with `user` slice;
  Phase 4 reads `appStore.user.googleAccountSub` (or equivalent) for
  the per-account MMKV key.
- `apps/mobile/src/services/compatSignature.ts` —
  `computeCompatSignatureSync` — pattern reference for any new
  signature-style boot computation.
- `shared/types/CompatResult.ts` — Zod schema; `cameraId` on
  `ultrawideDfov` is the source for D-CAM-03 lens routing.

### Phase 3 outputs (consume directly)

- `.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md` —
  Phase 3 implementation decisions; D-API-01..03 (HumynCapture bridge
  contract), D-FS-01..05 (storage layout + practice segregation +
  app-launch sweep + sidecar), D-SEG-01..03 (segmentation ownership
  - veto window), D-FGS-01..02 (foreground service seam), D-THERM-01
    (thermal handling owned by module). Phase 4 D-LIFE-04 extends the
    app-launch sweep with the `onCrashRecovery` event.
- `apps/mobile/src/native/HumynCapture.ts` + `HumynCapture.types.ts` —
  the JS bridge Phase 4 calls. `start(opts) → Promise`, `stop() →
Promise`, 5 event subscriptions (`onSegmentStart`, `onSegmentComplete`,
  `onSessionStop`, `onThermalAbort`, `onError`).
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/`
  — Phase 3 Kotlin sources. Pattern source for Phase 4's
  `HumynHandDetector` / `HumynPhoneState` / `HumynBattery` /
  `HumynScreenBrightness` modules.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`
  — Phase 4 registers four new ReactPackages here and adds the
  `onCrashRecovery` listener wiring at boot.

### Locked-stack reference (mandatory)

- `.planning/research/STACK.md` — version pins. Phase 4 hot-spots:
  vision-camera + worklets-core + reanimated + skia stack recipe;
  MediaPipe `tasks-vision@0.10.21` dependency declaration recipe;
  TTS recipe; OEM-specific phone-state pitfalls.
- `.planning/research/PITFALLS.md` — Pitfall catalog. Phase 4
  hot-spots: vision-camera + new-arch interactions; MediaPipe
  task-loading pitfalls; phone-state OEM quirks (Xiaomi MIUI,
  Oppo ColorOS).

### Operational / future (referenced but not Phase 4 scope)

- `task-taxonomy.md` — 65-task catalog. Phase 4 picks one entry for
  the `__DEV__`-gated debug affordance; Phase 6 wires the real list.
- `help-center-content.md` — Phase 2 territory (already shipped).
- `0.16.0.apk` + `apk-extracted/` + `jadx-out/` — Figure's "Minutes"
  app, retained as the reverse-engineered reference for the hand-gate
  per `figure-app-hands.md` (memory `project_figure_minutes_app.md`).
- `imu-liveness-check.md` — Phase 5 territory.
- `testing-guide.md` — Pixel runbook + monorepo dev environment.
  Phase 4 Wave 5 appends `04-MANUAL-SMOKE.md` covering practice E2E +
  non-practice via dev affordance + lifecycle edges + thermal injection.

### Active memories (apply unconditionally)

- `feedback_no_clan_chief_constructs.md` — no clan-chief constructs in
  Phase 4 surfaces.
- `project_distribution_apk_then_play.md` — distribution = APK first →
  Play Store → iOS, direct to users.
- `project_drift_metrics.md` — drift figures `{max, mean, p99}` per
  `idea-brief.md §6.5`; Phase 4 doesn't compute drift but the
  `onSegmentComplete` payload carries the three figures.
- `project_figure_minutes_app.md` — Figure's app is the reverse-
  engineering reference for the hand-gate.
- `project_phase3_wave1_cosmetic_fixup.md` — Phase 3 Wave 1 was
  cosmetic; Phase 4 has no cosmetic Wave 0 (D-WAVE-02). Pattern still
  applies if Phase 4 surfaces new gaps that need a Wave 0 in Phase 5.
- `feedback_functionality_first_during_smoke.md` — defer cosmetic
  issues to a later cleanup wave; don't rebuild mid-smoke. Active
  during Wave 5 smoke walk.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets (from Phases 1–3)

- **`apps/mobile/src/native/HumynCapture.ts`** + `HumynCapture.types.ts`
  — Phase 3 bridge. Phase 4 imports `start`, `stop`, `onSegmentStart`,
  `onSegmentComplete`, `onSessionStop`, `onThermalAbort`, `onError`.
  All event subscriptions return `EmitterSubscription` — caller MUST
  `.remove()` on unmount (T-3.3-04 leak warning in the JSDoc).
- **`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/`**
  — pattern source for Phase 4's new Kotlin modules. The
  `HumynCompatModule.kt` `ReactContextBaseJavaModule` + `Promise`
  ergonomic, `HumynCompatPackage.kt` `ReactPackage` registration, and
  `MainApplication.kt` registration list are the templates.
- **`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/`**
  — Phase 3 Kotlin sources (HevcEncoder, FragmentedMuxerWrapper,
  ImuWriter, etc.) + `HumynCaptureModule.kt`. Phase 4 doesn't touch
  these but uses them as the reference shape for module emit patterns
  (`WritableMap` composition, `RCTDeviceEventEmitter` invocation).
- **`apps/mobile/src/state/appStore.ts`** — Zustand store with `user`
  slice. Phase 4 reads `appStore.user.googleAccountSub` (TBD field
  name; planner confirms based on Phase 2's `/me` shape) for the
  per-account MMKV key.
- **`apps/mobile/src/state/initialRoute.ts`** —
  `computeInitialRoute(state, signature)`. Phase 4 extends with the
  per-account tutorial flag check.
- **`apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`** — Phase 2
  shipped. Phase 4 changes the `Next` CTA navigation target.
- **`apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx`** — Phase 2
  placeholder. Phase 4 adds `__DEV__`-gated debug affordance.
- **`apps/mobile/__tests__/visual/`** — `jest-image-snapshot` infra
  (Phase 3 D-WAVE-06). Phase 4 adds ~9 new baselines under
  `__image_snapshots__/`.
- **`shared/types/CompatResult.ts`** — Zod schema; `cameraId` field on
  `ultrawideDfov` feeds D-CAM-03.
- **MMKV** — already wired (Phase 2 D-STATE-\*). Phase 4 adds the
  `tutorial.practice_done.{accountId}.v1` key with `.v1` versioning.
- **`react-native-haptic-feedback@2.3.3`** — already in deps. Phase 4
  uses it for the practice-done `[40, 80, 40]` ms haptic; the 80 ms
  hand-gate-pass vibrate; the 100 / 50 / 100 ms battery-alert pattern;
  the 800 ms thermal-alert continuous.

### Established Patterns (from Phases 1–3)

- **Native-module shape:** Kotlin module under
  `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/{name}/`
  with a registered `ReactPackage` in `MainApplication.kt`. JS surface
  at `apps/mobile/src/native/{Name}.ts` exposes a typed contract via
  `NativeModules.{Name}`. Phase 4 ships four new modules per this
  pattern.
- **MMKV key versioning:** `auth.jwt.v1` / `compat.lastResult.v1`
  pattern. Phase 4's new key `tutorial.practice_done.{accountId}.v1`
  follows the `.v1` suffix convention.
- **Flavor-scoped manifests:** per-flavor source sets at
  `android/app/src/{playStore,apkRollout}/AndroidManifest.xml`. Phase 4
  declares Camera + Mic in the main manifest (already declared); the
  TelephonyCallback API does not require runtime perms; brightness +
  battery do not require any manifest declarations.
- **`shared/types/`** Zod schemas — Phase 4 adds shared types for the
  recording state shape if/when Phase 5 needs to read the `start_gate`
  block from the metadata JSON. (Phase 3 already exposes
  `CaptureSessionOpts`.)
- **Test infra (Vitest + jsdom + jest-image-snapshot):**
  `apps/mobile/vitest.config.ts` + `vitest.setup.ts` already wired.
  Phase 4 unit tests against `NativeModules.HumynHandDetector` /
  `HumynPhoneState` / `HumynBattery` / `HumynScreenBrightness` mocks;
  state-machine logic unit-tested via fake-timer + native-module-mock
  pattern. Real Camera2 + MediaPipe verification is Wave 5 smoke walk
  on Pixel 10a.
- **Phase 3 manual smoke runbook** at
  `.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md`
  — Phase 4 Wave 5 appends `04-MANUAL-SMOKE.md` covering practice E2E
  - non-practice via dev affordance + lifecycle edges + thermal
    injection.

### Integration Points

- **Mobile → Native modules:** existing `AppFlavor`, `PlayIntegrity`,
  `HumynCompat`, `HumynUpdater`, `HumynCapture`, `HumynForegroundService`;
  Phase 4 adds `HumynHandDetector`, `HumynPhoneState`, `HumynBattery`,
  `HumynScreenBrightness`.
- **Mobile → Camera:** during gate, VC opens the SAME ultrawide lens
  that HumynCapture will use (cameraId from `compat.lastResult.v1`).
  On gate-pass, VC unmounts → HumynCapture grabs the camera. Two
  surfaces, one camera at a time; no concurrent access.
- **Mobile → Filesystem:** Phase 4 writes `cacheDir/hand-gate/{ulid}.jpg`
  for HandDetector inputs (deleted after each check); reads
  `recordings/` and `practice/` only via Phase 3's HumynCapture (no
  direct FS access for capture).
- **Mobile → MMKV:** Phase 4 reads `compat.lastResult.v1` for the lens
  id; reads/writes `tutorial.practice_done.{accountId}.v1` for the
  ONB-08 gate; reads `auth.jwt.v1` to derive `googleAccountSub`.
- **Mobile → SensorManager / TelephonyManager / AudioManager /
  BatteryManager / PowerManager:** Phase 4 wires phone state, audio
  focus, battery, orientation. Thermal stays owned by HumynCapture
  (Phase 3 D-THERM-01) — Phase 4 only listens to `onThermalAbort`.
- **Mobile → Firebase Remote Config:** Phase 4 reads
  `gate.consecutive_hits_required` (default 5 Android / 3 iOS),
  `gate.cadence_ms` (default 400 Android / 600 iOS),
  `gate.min_hand_detection_confidence` (default 0.5) — HAND-11.
- **Mobile → CI:** Phase 4 unit tests run inside the existing
  "Mobile build" job; new Kotlin modules compile into the same APK;
  visual snapshots gate CI (Phase 3 D-WAVE-06 pattern).

### Creative options the architecture enables

- **Module isolation pays off (continuing Phase 3 pattern):**
  HandDetector / PhoneState / Battery / ScreenBrightness as
  independent native modules means Phase 4's gate work doesn't touch
  Phase 3's encoder, and Phase 5's upload work won't touch any of
  them. The shared `HumynForegroundService` stays the single
  cross-phase integration point.
- **Single bridge, dual lens behavior** — D-CAM-03 reading the lens id
  from `compat.lastResult.v1` lets us guarantee the gate sees what HC
  records without re-doing camera enumeration. Pays off in OEM-quirky
  territory (Xiaomi MIUI, Oppo ColorOS) where automatic device
  selection differs.
- **TTS-masked transition (D-CAM-02)** turns a technical handoff
  latency (~300–500 ms) into a perceived UX moment ("Recording
  started"). The 80 ms vibrate front-loads the perception; the TTS
  line covers the gap; brightness-drop visually frames the
  transition. No spinner, no progress bar — the latency simply isn't
  visible.
- **`__DEV__`-gated dev affordance** lets Phase 4 ship without
  blocking on Phase 6 Tasks list, AND lets us fully exercise the
  non-practice path in production-grade smoke walks. Production
  builds (`apkRollout` / `playStore`) strip the affordance.

</code_context>

<specifics>
## Specific Ideas

- **Hand-gate cache directory layout** —
  `context.cacheDir/hand-gate/{ulid}.jpg`. Files written via VC
  `takePhoto({ flash: 'off', enableShutterSound: false, qualityPrioritization: 'speed' })`,
  passed to `HandDetector.detectHands(path)`, deleted on the JS-side
  Promise resolution (whether pass / fail / skip). App-launch sweep
  (extension to Phase 3's Phase 3 D-FS-04 path or independent JS-side
  startup task) deletes any stragglers from a crashed session.
- **`useRecordingLifecycle` hook policy table** mirrors §10 row by row:
  ```
  AppState 'background' (mid-record)        → stop()  // upload if ≥60s, discard else
  AppState 'inactive' + 'background' chain → stop()
  Linking 'force-quit'                       → no JS hook fires; HumynCapture FGS handles; recovery on launch
  PhoneState OFFHOOK                         → stop()
  PhoneState IDLE after OFFHOOK              → no-op (already stopped)
  AudioFocusChange transient_loss + IDLE     → stop()  // alarm
  Orientation NOT in landscape (mid-record)  → stop()  + toast "keep the phone in landscape"
  Battery ≤ 15% (transition)                 → alert+continue() // toast + 520Hz beep + [100,50,100] haptic + voice
  Battery ≤ 5% (transition, mid-record)      → stop()
  Battery < 5% (start guard)                 → refuse-new() until ≥15%
  Storage < 5GB (start guard, REC-16)        → refuse-new() with toast
  Storage write failure mid-record           → HC emits onError({code: 'storage_full'}); JS handles → stop()
  Logout                                     → stop(); preserve queue (Phase 5 owns queue)
  Permission revoked (Camera/Mic) mid-record → HC emits onError({code: 'permission_revoked'}); JS handles → stop()
  Thermal ≥ THROTTLING (start guard)         → HC's start() rejects with thermal_throttling; toast
  Thermal ≥ THROTTLING_SEVERE (mid-record)   → HC emits onThermalAbort; JS fires voice cue + toast
  ```
- **Dev affordance UI** — long-press (>800 ms) on the
  TasksPlaceholderScreen heading text fires the debug push (only when
  `__DEV__` is true). No visible button; not discoverable to
  non-developers; production builds the entire press handler is
  guarded. Hardcoded task: `{ taskId: 'cooking_chop_vegetables',
taskName: 'Practice — Chop vegetables', isPractice: false,
taskCategory: 'cooking', taskSetting: 'indoor' }`.
- **Per-account tutorial flag derivation** — `googleAccountSub` derived
  from the JWT payload (the `sub` claim is the Google account's stable
  ID). MMKV key shape: `tutorial.practice_done.${sub}.v1` —
  e.g., `tutorial.practice_done.108472831947509823746.v1 = true`.
- **`computeInitialRoute` extension** — pseudo-code:
  ```ts
  if (state.user == null || state.jwt == null)
    return { stack: 'OnboardingStack', initial: 'Splash' };
  if (!state.compatPassed) return { stack: 'OnboardingStack', initial: 'Splash' /* compat */ };
  const sub = decodeJwt(state.jwt).sub;
  const tutorialDone = mmkv.getBoolean(`tutorial.practice_done.${sub}.v1`) ?? false;
  if (!tutorialDone) return { stack: 'OnboardingStack', initial: 'RigTutorial' };
  return { stack: 'MainTabs' };
  ```
  Planner refines based on existing `computeInitialRoute` shape +
  test-pattern continuity.
- **VC + HC handoff exact ordering on gate-pass** —
  ```ts
  // gate.confirmed transition:
  await Promise.resolve(); // tick
  Vibration.vibrate(80);
  Tts.speak('Recording started.', { rate: 1.0, pitch: 0.95, volume: 0.85 });
  HumynScreenBrightness.set(0.05);
  await new Promise((r) => setTimeout(r, 100)); // let TTS engine spin up
  visionCameraRef.current?.unmount(); // VC tears down camera
  await new Promise((r) => setTimeout(r, 50)); // let close complete
  const startResult = await HumynCapture.start(opts); // HC opens camera
  // → recState transitions to 'active'
  ```
  Numbers are starting points; planner tunes after Pixel 7a hardware
  smoke. If `start()` rejects, fall back to ready substate with the
  appropriate toast/voice line.
- **Visual baselines exact list** (committed to
  `apps/mobile/__tests__/visual/__image_snapshots__/`):
  1. `practice-intro.png`
  2. `practice-complete-static.png` (pre-confetti)
  3. `recording-rotate-prompt.png` (mocked-orientation portrait)
  4. `recording-ready.png` (mocked-camera-off)
  5. `recording-gate-ring-0.png`
  6. `recording-gate-ring-50.png`
  7. `recording-gate-ring-100.png`
  8. `recording-active-t10s.png` (mocked-timer)
  9. `recording-active-t05m32s.png`
  10. `recording-stop-confirm-modal.png`
- **`04-MANUAL-SMOKE.md` runbook structure** (Wave 5) — pattern-match
  Phase 3's `03-MANUAL-SMOKE.md` + `03-WAVE1-SMOKE.md`:
  - §1 Pre-flight (device prep, debug build install, DnD off, plugged
    in, Pixel 10a)
  - §2 Practice E2E (fresh install → tutorial → 60-s practice →
    Practice-complete → Home)
  - §3 Non-practice via dev affordance (long-press TasksPlaceholder →
    10-min recording → 10-min auto-segment cut observed → Stop → toast)
  - §4 Lifecycle edges (call-answered, call-declined, rotation,
    force-quit + recovery, battery 15 % alert, battery 5 % end,
    storage refuse, alarm)
  - §5 Thermal injection (`adb shell cmd thermalservice override-status 4`)
  - §6 Sign-off (operator + `re-walked-on:` stamp)
  - §7 Amendments protocol (D-WAVE-09 pattern from Phase 3)

</specifics>

<deferred>
## Deferred Ideas

### Belongs in other phases or future cleanup

- **Tasks list / Task details / `Start Recording` CTA** — Phase 6.
  Phase 4 only ships the `__DEV__`-gated debug affordance for non-
  practice testing.
- **Upload pipeline (UP-01..19)** — Phase 5. Phase 4 calls
  `HumynCapture.stop()` and trusts segments land in `recordings/` /
  `practice/`.
- **Hash-verify worker + IMU-liveness backend check** — Phase 5.
- **iOS analogues** (`HumynHandDetector` Swift via MediaPipeTasksVision
  pod 0.10.21, `HumynPhoneState` via CXCallObserver, AVSpeechSynthesizer
  for TTS, `UIScreen.main.brightness` for brightness control,
  CoreMotion for orientation) — Phase 7.
- **Continuous on-device hands-in-frame enforcement during recording
  (cue loop / auto-stop on absence)** — out of MVP per PROJECT.md;
  only the one-shot pre-record gate is in MVP.
- **Per-locale `recording_gate_skipped` rate telemetry (HAND-14)** —
  Phase 4 wires the Firebase Analytics event emission; the
  per-locale dashboard cohort lives in Phase 7 (OBS-03).
- **Hand-gate target hits / cadence / confidence tuning via Firebase
  Remote Config (HAND-11)** — Phase 4 wires the Remote Config reads;
  ongoing tuning post-launch is operational, not a code change.
- **Bystander-consent in-app secondary-subject screen** — out of scope
  at MVP per PROJECT.md.
- **Mobile dark mode for non-recording surfaces** — out of scope at MVP;
  only the recording surface is dark.
- **PROJECT.md / REQUIREMENTS.md / ROADMAP.md / `idea-brief.md` §3.1
  cleanup of stale clan-chief / KGeN narrative** — already deferred
  in Phases 1–3 CONTEXT; remains deferred. Out-of-scope for any
  single phase; needs a `/gsd:cleanup` pass or a manual edit pass
  with user approval.
- **Phase 3 hardware UAT items #1–#7** — effectively retire during
  Phase 4 Wave 5 smoke walk (the 10-min HEVC capture + 25-min
  auto-segment integrity + drift figures + thermal handling + FGS
  type + SHA round-trip + onSessionStart/Stop seam all get exercised
  on hardware as part of Phase 4's smoke). Verifier should not
  separately re-block on them after Phase 4 closes.
- **`04-COSMETIC-GAPS.md`** — created during Wave 5 smoke if needed,
  per Phase 3 D-WAVE-09 amendment-protocol pattern. New cosmetic gaps
  surfaced during Phase 4 smoke walk go here; Phase 5 may pick up,
  OR a Wave 5 fix-up before Phase 5 plan-phase.

### Reviewed Todos (not folded)

None — todo enumeration not used during this discussion.

</deferred>

---

_Phase: 4-HandDetector, Recording UX & Practice Tutorial_
_Context gathered: 2026-05-11_
