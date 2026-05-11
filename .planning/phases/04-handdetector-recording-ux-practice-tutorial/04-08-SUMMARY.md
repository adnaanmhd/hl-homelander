---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 08
subsystem: ui
tags:
  [
    react-native,
    react-navigation,
    react-native-tts,
    react-native-orientation-locker,
    react-native-fs,
    hooks,
    vitest,
    lifecycle-policy,
  ]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-02)
    provides: HumynPhoneState (onAudioFocusChanged) / HumynBattery (onBatteryChanged) / HumynScreenBrightness / HumynBeep (playTone) JS bindings + the react-native-tts / react-native-fs / react-native-orientation-locker vitest mocks
  - phase: 04-handdetector-recording-ux-practice-tutorial (plan 04-07)
    provides: recState.ts (RecSubstate type — the lifecycle hook's substate arg) + the 'Recording' route (the __DEV__ affordance navigates to it) + the recording_stopped analytics event name (already in EVENT_NAMES from plan 04-06)
  - phase: 02 (plan 02-17)
    provides: services/durationFormatter.formatDuration(seconds) — the HOME-06 rule durationFormat.formatContributionDuration delegates to
provides:
  - 'src/screens/recording/useRecordingLifecycle.ts — the idea-brief.md §10 policy table as a hook over AppState / orientation device-listener / HumynPhoneState audio focus / HumynBattery / HumynCapture onError+onThermalAbort + the practice 60s hard cap (ONB-05) + checkStartGuards() (REC-16 storage <5GB + battery <5% start guard); leak-clean teardown (every sub/timer/interval + HumynPhoneState.stop()/HumynBattery.stop() in the single useEffect cleanup); REC-09 negative req asserted (no DND / notification-policy / telephony APIs); emits logEvent("recording_stopped", { reason }) — no PII'
  - 'src/lib/ttsVoice.ts — pickAndSetEnInVoice() (REC-14 fallback chain: en-IN female → en-IN any → en-US female → first en-*; notInstalled filtered; setDefaultRate(1.0, true) + setDefaultPitch(0.95); graceful empty-voices fallback) + speakCue(text) helper (androidParams KEY_PARAM_VOLUME 0.85)'
  - 'src/lib/durationFormat.ts — formatContributionDuration(ms): "<1min→Xs" / "<1hr→Xm" / "≥1hr→Xh Ym" floored to the previous minute (REC-04 / HOME-06); delegates to services/durationFormatter.formatDuration'
  - 'TasksPlaceholderScreen __DEV__-gated debug entry — long-press on the heading (>800ms) pushes the Recording route with a hardcoded non-practice test task; dead-code-eliminated when __DEV__===false'
  - '4 new test files: durationFormat (10), ttsVoice (9), useRecordingLifecycle (18), devAffordance (2, incl. __DEV__===false)'
affects:
  [
    04-09 (RecordingScreen live wiring — imports useRecordingLifecycle against the documented signature; mounts it in useEffect; wires onStop→HumynCapture.stop()+§7h routing; calls pickAndSetEnInVoice() at mount; uses speakCue for the gate-pass + battery cues; uses formatContributionDuration for the post-stop toast),
    Phase 5 (the §10 logout-while-active edge feeds the upload-queue-preserved path),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRecordingLifecycle — the §10 policy table as a SINGLE useEffect keyed on the substate (active when substate ∈ {gate, active}) with a subs[] + timers[] accumulator pattern; callbacks + durationMs + substate held in refs so the effect doesn't churn; a separate small effect arms the practice 60s setTimeout exactly when active starts; a third effect fires onStop('logout') when the loggedOut flag flips"
    - "battery threshold-crossing tracking — keep lastBatteryLevelRef; fire the ≤5% stop / ≤15% alert only on the *crossing* (prev>threshold → new≤threshold), not on every onBatteryChanged; also feeds checkStartGuards()'s battery<5% start guard"
    - "audio-focus answered-vs-declined heuristic (A12) — on transient_loss arm a 7s setTimeout; gain within 7s cancels it (call declined, REC-13); timer-fires-or-permanent-loss → onStop('phone_call') (answered/alarm — the reason is for telemetry/toast wording, both stop)"
    - "REC-04/HOME-06 ms-formatter delegates to the seconds-based services/durationFormatter — formatContributionDuration(ms) = formatDuration(Math.floor(ms/1000)) so the formatting is byte-identical to the Profile lifetime caption"
    - "__DEV__-gated affordance discipline (Pitfall 7) — the ENTIRE press handler AND the Pressable wrapper inside the __DEV__ guard so Metro dead-code-eliminates both in release builds; the visual baseline pins the __DEV__===false rendering"

key-files:
  created:
    - apps/mobile/src/screens/recording/useRecordingLifecycle.ts
    - apps/mobile/src/lib/ttsVoice.ts
    - apps/mobile/src/lib/durationFormat.ts
    - apps/mobile/__tests__/screens/recording/useRecordingLifecycle.test.tsx
    - apps/mobile/__tests__/lib/ttsVoice.test.ts
    - apps/mobile/__tests__/lib/durationFormat.test.ts
    - apps/mobile/__tests__/screens/recording/devAffordance.test.tsx
  modified:
    - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx
    - apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx

key-decisions:
  - "durationFormat.ts delegates to services/durationFormatter.formatDuration (the existing HOME-06 formatter from Phase 2 plan 02-17) rather than re-implementing the rule — formatContributionDuration(ms) = formatDuration(Math.floor(ms/1000)). The 'profileService' the plan's read_first pointed at doesn't export formatDuration; durationFormatter.ts is the right module."
  - "Used react-native-tts's `Options` typedef workaround in speakCue — the typedef lists `iosVoiceId` + `rate` as required but the native side treats them as optional; passed `iosVoiceId: ''` (inert — iOS is descoped at MVP) + `rate: 1.0` (matches the default set by setDefaultRate(1.0, true)) so tsc passes."
  - "useRecordingLifecycle's §10 docstring names the forbidden APIs (DND / notification-policy / telephony) descriptively, never as the literal symbols ACCESS_NOTIFICATION_POLICY / READ_PHONE_STATE — the T-4.8-02 acceptance gate greps the file for those literals (same precedent as plan 04-02's T-4.2-01 deviation)."
  - "logEvent('recording_stopped', { reason }) — `recording_stopped` was already in EVENT_NAMES (added in plan 04-06), so no analytics.ts edit was needed."
  - "TasksPlaceholderScreen visual test (NOT in the plan's files_modified) needed `vi.stubGlobal('__DEV__', false)` — the new __DEV__ wrapper changed the dev DOM tree (Pressable + button role + press transform). Stubbing __DEV__===false in the visual test pins the production rendering (also more representative); the existing baseline PNG is unchanged."
  - "devAffordance.test.tsx mocks the Pressable primitive as a <button> forwarding onLongPress→onClick so the long-press intent is exercisable via fireEvent.click (the RN host shim maps onPress→onClick but not onLongPress)."

patterns-established:
  - "useRecordingLifecycle hook — the canonical §10 lifecycle-policy hook; plan 04-09's RecordingScreen mounts it and wires onStop/showToast/voiceCue/setAlert"
  - "speakCue(text) — the standard recording-surface TTS call site (androidParams volume 0.85); RecordingScreen + the lifecycle hook's voiceCue callback use it"
  - "formatContributionDuration(ms) — the REC-04 / HOME-06 ms-duration formatter; the §7h post-stop toast uses it"
  - "__DEV__-gated affordance discipline — entire handler + wrapper inside the __DEV__ guard; visual baseline pins __DEV__===false"

requirements-completed:
  [REC-04, REC-07, REC-09, REC-10, REC-11, REC-12, REC-13, REC-14, REC-15, REC-16, ONB-05, ONB-06]

# Metrics
duration: 18min
completed: 2026-05-11
---

# Phase 4 Plan 08: Recording-lifecycle support modules (useRecordingLifecycle + ttsVoice + durationFormat + __DEV__ affordance) Summary

**The `idea-brief.md §10` lifecycle-edge policy table as a leak-clean `useRecordingLifecycle` hook (AppState background → stop; audio-focus answered/alarm → stop, declined → no-op REC-13; orientation portrait mid-record → stop+toast; battery ≤15% → alert+beep+haptic+voiceCue+continue REC-10, ≤5% → stop REC-11; HumynCapture storage_full/permission_revoked → stop; onThermalAbort → voiceCue+alert+beep+vibrate(800), no stop; logout → stop) plus the practice 60s hard cap (ONB-05) and `checkStartGuards()` (REC-16 storage <5GB + battery <5% start guard) — with no DND / notification-policy / telephony APIs (REC-09) — alongside `ttsVoice.pickAndSetEnInVoice()` (the REC-14 en-IN voice fallback chain + the `setDefaultRate(1.0, true)` rate-scale correction + a `speakCue` helper), the `durationFormat.formatContributionDuration(ms)` REC-04/HOME-06 formatter, and the `__DEV__`-gated long-press debug entry to `RecordingScreen` on `TasksPlaceholderScreen` — all behind 39 new passing tests.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-11T~09:08Z
- **Completed:** 2026-05-11T~09:46Z
- **Tasks:** 3
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments

- **`src/lib/durationFormat.ts`** — `formatContributionDuration(ms)`: `<1min → 'Xs'`, `<1hr → 'Xm'`, `≥1hr → 'Xh Ym'` all floored to the previous minute (so `90_000 → '1m'`, `3_930_000 → '1h 5m'`). Delegates to `services/durationFormatter.formatDuration(seconds)` — `= formatDuration(Math.floor(ms/1000))` — so the formatting is byte-identical to the Profile lifetime caption (HOME-06). Non-finite/negative → `'0s'`.
- **`src/lib/ttsVoice.ts`** — `pickAndSetEnInVoice()`: `await Tts.getInitStatus()` → `Tts.voices().catch(() => [])` → filter `notInstalled` → the 4-step chain (`en-IN` & `looksFemale` → any `en-IN` → `en-US` & `looksFemale` → first `language.startsWith('en')`) → `setDefaultVoice(id)` if found → always `setDefaultRate(1.0, true)` (the §13 rate, raw-passthrough so it's Android's normal speed — Pattern 4 correction) + `setDefaultPitch(0.95)`. Empty `voices()` → no `setDefaultVoice`, still sets rate/pitch (engine default). Plus `speakCue(text)` — `Tts.speak(text, { iosVoiceId:'', rate:1.0, androidParams:{ KEY_PARAM_VOLUME:0.85, KEY_PARAM_PAN:0, KEY_PARAM_STREAM:'STREAM_MUSIC' } })` so call sites don't repeat the androidParams (and the cue text can be duplicated on-screen — REC-15).
- **`src/screens/recording/useRecordingLifecycle.ts`** — the `idea-brief.md §10` policy table as a hook. Signature exactly per the plan's `<interfaces>`: `useRecordingLifecycle({ substate, isPractice, durationMs, loggedOut?, callbacks })` → `{ checkStartGuards }`. Implementation:
  - Top block-comment reproduces the §10 table row by row.
  - A single `useEffect` keyed on `monitoring` (true when `substate ∈ {gate, active}`). Inside: `AppState.addEventListener('change')` (`'background'`/`'inactive'` while `active` → `onStop('background')`), `Orientation.addDeviceOrientationListener` (`'PORTRAIT'`/`'PORTRAIT-UPSIDEDOWN'` while `active` → `onStop('orientation')` + `showToast('Recording stopped — keep the phone in landscape.')`), `HumynPhoneState.start()` + `onAudioFocusChanged` (the A12 heuristic: `'loss'` → `onStop('phone_call')`; `'transient_loss'` → arm a 7 000 ms `setTimeout` → `onStop('phone_call')` if it fires; `'gain'` → cancel the timer, NO stop — REC-13; `'transient_loss_can_duck'` → no-op), `HumynBattery.start()` + `onBatteryChanged` (track `lastBatteryLevelRef`; `≤0.05` crossing → `onStop('battery_critical')` REC-11; `≤0.15` crossing → `setAlert('battery', true)` + `showToast('Battery low. Consider charging soon.')` + `playTone('battery_alert')` + `Vibration.vibrate([0,100,50,100])` + `voiceCue(...)` — NO stop, REC-10), `HumynCapture.onError` (`storage_full` → `onStop('storage_full')` + `showToast('Recording stopped — not enough storage.')`; `permission_revoked` → `onStop('permission_revoked')`), `HumynCapture.onThermalAbort` (`voiceCue('Phone too hot, stopping recording')` + `setAlert('thermal', true)` + `playTone('thermal_alert')` + `Vibration.vibrate(800)` — does NOT call `onStop`; HC self-stops), and a 60 000 ms `setInterval` belt-and-suspenders storage re-poll (`RNFS.getFSInfo()` → `onStop('storage_full')` if free drops below 5 GB). The cleanup `.remove()`s every sub, `clearTimeout`s the audio-focus timer, `clearInterval`s the periodic guard, and `HumynPhoneState.stop()` + `HumynBattery.stop()` — Pitfall 5.
  - A separate small effect arms the practice 60 s hard cap: when `isPractice && substate === 'active'`, `setTimeout(() => onStop('practice_hard_cap'), max(0, 60_000 − durationMs))` (fires at exactly 60 s of recording; immediate if already past — ONB-05; takes precedence — it's a standalone timer, not gated on any other event).
  - A third effect fires `onStop('logout')` when `loggedOut` flips true while `active`.
  - `checkStartGuards()`: `RNFS.getFSInfo().freeSpace < 5e9` → `{ blocked, toast:'Not enough storage to record.' }` (REC-16); `lastBatteryLevelRef < 0.05 && !charging` → `{ blocked, toast:'Battery too low to start a recording. Charge to at least 15%.' }`; else `{ blocked: false }`.
  - Emits `logEvent('recording_stopped', { reason })` on every stop path (no PII — `recording_stopped` was already in `EVENT_NAMES`). REC-09: no DND / notification-policy / telephony API anywhere — the §10 docstring names those APIs descriptively, never as the literal forbidden symbols (the T-4.8-02 grep gate is clean).
  - `ONB-06`: the practice 60 s cap and every alert run for `isPractice` recordings (the `monitoring` effect doesn't branch on `isPractice` — only the hard-cap effect adds the practice-only timer).
- **`src/screens/tasks/TasksPlaceholderScreen.tsx`** — added a `__DEV__`-gated long-press (>800 ms) on the "Tasks — coming in Phase 6." heading that `navigation.push('Recording', { taskId:'cooking_chop_vegetables', taskName:'Practice — Chop vegetables', isPractice:false, taskCategory:'cooking', taskSetting:'indoor' })`. The ENTIRE handler (`const onDebugLongPress = __DEV__ ? () => {...} : undefined`) AND the `Pressable` wrapper (`{__DEV__ ? <Pressable accessibilityLabel="tasks-heading" onLongPress={...} delayLongPress={800}>…</Pressable> : <Text …>}`) are inside the `__DEV__` guard so Metro dead-code-eliminates both in `apkRollout`/`playStore` builds (Pitfall 7 / T-4.8-01). The TopBar + the existing copy are unchanged.
- **Tests** — `durationFormat.test.ts` (10 cases — the `<behavior>` formatter bullets incl. `90_000→'1m'` and `3_930_000→'1h 5m'`), `ttsVoice.test.ts` (9 cases — the 4 chain steps, `notInstalled` filtering, empty-`voices()` fallback, `voices()` rejecting, `getInitStatus`/rate/pitch always run, `speakCue` androidParams; each `vi.doMock`s `react-native-tts` per-case + `vi.resetModules()` + dynamic import), `useRecordingLifecycle.test.tsx` (18 cases via `@testing-library/react`'s `renderHook` + fake timers — AppState background, inactive-then-background, audio-focus loss, transient-loss-then-gain-within-7s = no stop, transient-loss + advance 7 s = stop, orientation portrait, battery ≤15% crossing = alert+beep+vibrate+voiceCue no stop, battery ≤5% crossing = stop, onError storage_full, onError permission_revoked, onThermalAbort, practice + advance 60 s = practice_hard_cap, logout flag = stop, checkStartGuards blocked on freeSpace<5GB / battery<5% / not blocked when healthy, unmount = every sub `.remove()`d + `.stop()`d, no subscription when substate is pre-record), `devAffordance.test.tsx` (2 cases — `__DEV__===true`: long-press → `navigation.push('Recording', testTask)`; `__DEV__===false`: no `tasks-heading` Pressable, copy still renders).
- **`__tests__/visual/TasksPlaceholderScreen.visual.test.tsx`** — added `vi.stubGlobal('__DEV__', false)` (+ `vi.unstubAllGlobals()` teardown) so the visual baseline pins the production rendering (the new `__DEV__` wrapper changed the dev DOM tree); the baseline PNG is unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: durationFormat.ts + ttsVoice.ts + tests** — `73d57f6` (feat) — TDD task; test + impl in one `feat` commit (config `tdd_mode: false`, MVP_MODE/TDD_MODE not passed → the strict per-task RED/GREEN gate is not enforced).
2. **Task 2: useRecordingLifecycle hook + test** — `9fda6e1` (feat) — TDD task; single `feat` commit.
3. **Task 3: __DEV__-gated debug affordance on TasksPlaceholderScreen + devAffordance test + visual-test __DEV__ stub** — `d1d5db1` (feat).

**Plan metadata:** _(this commit)_ `docs(04-08): complete plan`

_(Concurrent `docs(quick-260511-*): …` commits — `6dca55c` and others — landed on `main` from a separate quick-task session; they touch only `.planning/` + `ImuWriter` and are not part of this plan.)_

## Files Created/Modified

(See `key-files` in the frontmatter.) Highlights:

- `apps/mobile/src/screens/recording/useRecordingLifecycle.ts` — NEW. The §10 policy table + practice 60 s cap + `checkStartGuards`, leak-clean teardown, REC-09 negative req.
- `apps/mobile/src/lib/ttsVoice.ts` — NEW. `pickAndSetEnInVoice()` (REC-14 chain + rate/pitch) + `speakCue(text)`.
- `apps/mobile/src/lib/durationFormat.ts` — NEW. `formatContributionDuration(ms)` (REC-04 / HOME-06) — wraps `services/durationFormatter.formatDuration`.
- `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` — added the `__DEV__`-gated long-press debug entry to `RecordingScreen`.
- `apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx` — `vi.stubGlobal('__DEV__', false)` so the baseline pins the production rendering.
- `apps/mobile/__tests__/screens/recording/{useRecordingLifecycle.test.tsx,devAffordance.test.tsx}` + `apps/mobile/__tests__/lib/{ttsVoice.test.ts,durationFormat.test.ts}` — NEW (39 cases total).

## Decisions Made

See `key-decisions` in the frontmatter — the substantive calls: (1) `durationFormat.ts` delegates to `services/durationFormatter.formatDuration` (the existing HOME-06 formatter; the plan's read_first pointed at `profileService` but the formatter lives in `durationFormatter.ts`); (2) the `react-native-tts` `Options` typedef workaround in `speakCue` (`iosVoiceId:''` + `rate:1.0` to satisfy tsc — iOS is descoped); (3) the §10 docstring names the forbidden DND/telephony APIs descriptively, never literally, so the T-4.8-02 grep gate stays clean; (4) `recording_stopped` was already in `EVENT_NAMES` (plan 04-06) — no analytics edit; (5) the visual test (not in `files_modified`) needed `__DEV__===false` stubbing — a Rule-1 fix for the dev-DOM-tree change the new `__DEV__` wrapper introduced; (6) `devAffordance.test.tsx` mocks the `Pressable` primitive as a `<button>` so `onLongPress` is exercisable via `fireEvent.click`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `TasksPlaceholderScreen.visual.test.tsx` baseline went red after Task 3 — stub `__DEV__===false` in the visual test**

- **Found during:** Task 3 (adding the `__DEV__`-gated affordance to `TasksPlaceholderScreen`)
- **Issue:** `vitest.setup.ts` defaults `__DEV__` truthy, so the visual test rendered the screen WITH the new `__DEV__` wrapper (`Pressable` → `<div role="button">` + the press-transform style) — a different DOM tree than the existing baseline PNG (generated against the old plain-`Text` screen) → `toMatchImageSnapshot` mismatch.
- **Fix:** Added `beforeEach(() => vi.stubGlobal('__DEV__', false))` + `afterEach(() => vi.unstubAllGlobals())` to the visual test so it baselines the production rendering (the affordance dead-code-eliminated) — which is the representative case and leaves the existing baseline PNG unchanged.
- **Files modified:** `apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx`
- **Verification:** `npm --prefix apps/mobile test -- --run __tests__/visual/TasksPlaceholderScreen.visual.test.tsx` → 1/1 pass; the full suite is back to the pre-plan failure set (2 failed = the pre-existing D4-01 `HomeSkeletonScreen` hex + visual).
- **Committed in:** `d1d5db1` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 × Rule 1 — a direct consequence of in-scope work; the new `__DEV__` wrapper changed the dev DOM tree, so the dev-mode visual baseline had to be pinned to the production rendering).
**Impact on plan:** No scope creep — the change is a 4-line test adjustment in one already-related test file. All 7 plan-listed files were created/modified exactly as the `files_modified` set + the task actions specified; both task verifies and the full-suite verification (modulo the documented pre-existing D4-01 failures) passed.

## Issues Encountered

- **`eslint-disable-next-line react-hooks/exhaustive-deps` comments errored the pre-commit hook** — the project's ESLint config doesn't register the `react-hooks` plugin (`useForegroundUserRehydrate.ts` has a `useEffect(() => {…}, [])` with no disable comment and lints clean). Removed the three disable comments from `useRecordingLifecycle.ts`; tsc + the suite stay green. Resolved before the Task-2 commit.
- **`react-native-tts`'s `Options` typedef** — `speak(utterance, options?)` types `options` as `{ iosVoiceId: string; rate: number; androidParams: AndroidOptions }` (all required) even though the native side treats `iosVoiceId`/`rate` as optional. Passed `iosVoiceId: ''` + `rate: 1.0` in `speakCue` so `tsc --noEmit` passes — documented inline. Resolved before the Task-1 commit.
- **`renderHook` was net-new to the suite** — no prior test used `@testing-library/react`'s `renderHook`; it's available in `@testing-library/react@16.1.0` and works fine under jsdom with fake timers. No infra change needed.
- **Pre-existing full-suite failures (NOT introduced by this plan):** `npm --prefix apps/mobile test -- --run` reports 2 failed + 3 unhandled errors — `__tests__/ui/no-hex-literals.test.ts` (`HomeSkeletonScreen.tsx` hex literals), `__tests__/visual/HomeSkeletonScreen.visual.test.tsx` (baseline drift), and 3 `setPermsGranted is not a function` rejections in `__tests__/navigation/RootNativeStack.test.tsx`. Identical on the pre-plan baseline; already tracked as **D4-01** in `.planning/phases/04-handdetector-recording-ux-practice-tutorial/deferred-items.md` (the `15d8a16` `__DEV__` smoke seam in `HomeSkeletonScreen.tsx`, slated for removal in plan 04-09 per the 04-07 summary). Out of scope per the SCOPE BOUNDARY rule — not touched. Every test this plan owns or modifies is green; `tsc --noEmit` is clean across the mobile + api + shared/types workspaces.

## Known Stubs

None. `useRecordingLifecycle` is fully implemented (every §10 row + the practice cap + `checkStartGuards`); `ttsVoice` / `durationFormat` are complete pure utilities; the `__DEV__` affordance is a deliberate dev-only entry (dead-code-eliminated in release builds — that's by design, not a stub). The hook is consumed (not yet mounted) — plan 04-09's `RecordingScreen` is the live-wiring caller, which is the documented phase split (this plan ships the support modules; 04-09 mounts them).

## Threat Flags

| Flag     | File | Description                                                                                                                                                                                                                                                  |
| -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _(none)_ | —    | No new network endpoints / auth paths / file-access patterns / trust-boundary schema changes beyond the plan's `<threat_model>` (T-4.8-01 the `__DEV__` affordance, T-4.8-02 no-DND, T-4.8-03 leak-clean teardown, T-4.8-04 PII-clean logging — all `mitigate`d as planned; T-4.8-05 the audio-focus heuristic `accept`ed). |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 04-09** (RecordingScreen live wiring) can now `import { useRecordingLifecycle } from './useRecordingLifecycle'` against the documented signature, mount it in `useEffect`, and wire `onStop` → `HumynCapture.stop()` + the §7h post-stop routing (practice → PracticeComplete; real ≥60 s → `showToast(\`${formatContributionDuration(durationMs)} added to your contribution.\`)` + Home; real <60 s → toast "Recording too short — discarded." + ready); call `pickAndSetEnInVoice()` at mount; use `speakCue` for the gate-pass "Recording started." line + the lifecycle hook's `voiceCue` callback; use `checkStartGuards()` before `HumynCapture.start()`. It also owns the orientation `lockToLandscape()` + the UI-orientation `LANDSCAPE_DETECTED` dispatch (those are screen concerns, not the lifecycle hook's), and removing the `15d8a16` `HomeSkeletonScreen` `__DEV__` smoke seam (D4-01) — that plan should regenerate the `home-skeleton-screen` visual baseline + fix the `setPermsGranted` reference in `RootNativeStack.test.tsx` while it's there.
- **Concern:** the full mobile suite still does not exit 0 because of the pre-existing D4-01 failures (HomeSkeletonScreen hex + visual baseline + RootNativeStack `setPermsGranted`). All tests this plan touches are green; `tsc --noEmit` is clean.

## Self-Check: PASSED

All claimed files exist on disk (verified):

- `apps/mobile/src/screens/recording/useRecordingLifecycle.ts`, `apps/mobile/src/lib/ttsVoice.ts`, `apps/mobile/src/lib/durationFormat.ts`
- `apps/mobile/__tests__/screens/recording/{useRecordingLifecycle.test.tsx,devAffordance.test.tsx}`, `apps/mobile/__tests__/lib/{ttsVoice.test.ts,durationFormat.test.ts}`
- modified: `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx`, `apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx`
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-08-SUMMARY.md`

Task commits present in `git log`: `73d57f6` (feat — Task 1), `9fda6e1` (feat — Task 2), `d1d5db1` (feat — Task 3).

Acceptance greps: `useRecordingLifecycle.ts` grep-clean of `ACCESS_NOTIFICATION_POLICY` / `READ_PHONE_STATE` / `Settings.setSetting` (exit 1); references `60_000`, `0.15`, `0.05`, `7_000`. `TasksPlaceholderScreen.tsx` — `navigation.push('Recording'…)` is inside the `__DEV__ ?` guard. `useRecordingLifecycle.test.tsx` has 18 `it(` cases. `devAffordance.test.tsx` has the `__DEV__===false` case.

---

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
