---
phase: 04-handdetector-recording-ux-practice-tutorial
plan: 05
subsystem: infra
tags:
  [
    react-native,
    native-modules,
    kotlin,
    android,
    audio-focus,
    battery,
    screen-brightness,
    soundpool,
    vitest,
  ]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial
    provides: (plan 04-02) the four in-house Kotlin native-module SHELLS (HumynPhoneState / HumynBattery / HumynScreenBrightness / HumynBeep) + their ReactPackages + JS bindings + the RCTDeviceEventEmitter event-name contract (onAudioFocusChanged / onBatteryChanged) + the set(-1) restore sentinel + the playTone tone names (battery_alert / thermal_alert); the canonical 3-file native-module triad pattern (Module/Package/JS-binding)
  - phase: 03-humyn-capture-native-module
    provides: HumynCaptureModule's emitEvent() RCTDeviceEventEmitter idiom + Arguments.createMap() composition + the currentActivity + runOnUiThread null-safe window-mutation idiom (applyKeepScreenOn); the __tests__/native/ vi.doMock('react-native', ...) test pattern
provides:
  - HumynPhoneStateModule.kt — real body — AudioFocusRequest(AUDIOFOCUS_GAIN) + AudioManager.OnAudioFocusChangeListener; emits onAudioFocusChanged({focus: gain|loss|transient_loss|transient_loss_can_duck}) via RCTDeviceEventEmitter; abandons the focus request on stop() AND on invalidate(); NO TelephonyManager / PhoneStateListener / READ_PHONE_STATE (the D-LIFE-02 corrected finding — AudioManager only)
  - HumynBatteryModule.kt — real body — BroadcastReceiver for Intent.ACTION_BATTERY_CHANGED; emits onBatteryChanged({level: Double 0..1, isCharging: Boolean}) de-duplicated, plus a synthesized initial emit from the sticky broadcast on start(); unregisters on stop() AND on invalidate()
  - HumynScreenBrightnessModule.kt — real body — set(value) writes activity.window.attributes.screenBrightness on the UI thread; value<0 (the -1 sentinel) → WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE (restore system default), else value.toFloat().coerceIn(0f,1f); per-window only (NOT the OS-wide system brightness setting → no WRITE_SETTINGS); reuses HumynCaptureModule's currentActivity + runOnUiThread idiom
  - HumynBeepModule.kt — real body — SoundPool over bundled .wav assets; lazy pool build + preload of both clips; playTone(name) validates name against {battery_alert, thermal_alert} → UNKNOWN_TONE reject for anything else; releases the pool on invalidate(); no third-party RN sound libs, no MediaPlayer
  - apps/mobile/android/app/src/main/assets/audio/battery_alert.wav — 520 Hz sine, 200 ms, 44.1 kHz mono 16-bit PCM (engineering-handoff §6.1 battery-alert cue)
  - apps/mobile/android/app/src/main/assets/audio/thermal_alert.wav — descending three-note 440→560→680 Hz at 180/180/220 ms, 44.1 kHz mono 16-bit PCM (engineering-handoff §6.1 thermal-alert cue)
affects:
  [
    04-08 (useRecordingLifecycle — subscribes to onAudioFocusChanged / onBatteryChanged, owns the answered-vs-declined timing heuristic + the ≤15%/≤5%/<5%-start-guard battery thresholds, calls HumynScreenBrightness.set / HumynBeep.playTone),
    04-RecordingScreen-plans (every plan that wires the low-battery cue, the thermal-kill cue, the 5%-brightness drop/restore, or the phone-call interruption),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: in-house event-emitter native modules teardown on BOTH stop() AND invalidate() — the @ReactMethod stop() is the screen-lifecycle teardown; the BaseJavaModule.invalidate() override is the catalyst-instance-destroy safety net (RN 0.83's modern replacement for onCatalystInstanceDestroy) — every receiver/focus-request/SoundPool is double-covered (PITFALLS.md Pitfall 5)"
    - "Pattern: docstrings name forbidden-API symbols only DESCRIPTIVELY, never literally — the threat-model acceptance grep gates (T-4.5-01 / T-4.5-02) grep these source files for the forbidden symbol strings; a literal mention in a comment trips the gate (same trap plan 04-02 hit with HumynPhoneStateModule)"
    - "Pattern: pre-baked tone assets generated at build time with ffmpeg sine + small (~4–5 ms) afade in/out to suppress boundary clicks; concat three faded segments for the multi-note thermal cue"

key-files:
  created:
    - apps/mobile/android/app/src/main/assets/audio/battery_alert.wav
    - apps/mobile/android/app/src/main/assets/audio/thermal_alert.wav
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/phonestate/HumynPhoneStateModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/HumynBatteryModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/screenbrightness/HumynScreenBrightnessModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt

key-decisions:
  - "Used the BaseJavaModule.invalidate() override (not onCatalystInstanceDestroy) for the catalyst-destroy teardown — onCatalystInstanceDestroy is deprecated in RN 0.83's BaseJavaModule (line ~90 docstring points at invalidate()); invalidate() is the supported hook and matches the project's RN-0.83 conventions."
  - "thermal_alert.wav: engineering-handoff §6.1 lists '440→560→680 Hz, 180/180/220 ms (descending three-note)' — the frequencies ascend but the spec calls it 'descending'; reproduced the three frequencies + durations VERBATIM (no gaps between notes, since §6.1 specifies none — three consecutive faded segments concatenated)."
  - "playTone validates the JS name against a fixed map {battery_alert→audio/battery_alert.wav, thermal_alert→audio/thermal_alert.wav} — the JS string never becomes part of an asset path; an unknown name rejects with UNKNOWN_TONE (T-4.5-04 input-validation mitigation)."
  - "HumynBeep SoundPool is built + both clips preloaded LAZILY on the first playTone (not at module construction) — SoundPool decodes async, and both cues fire well after RecordingScreen mount, so a lazy preload has the clip ready in practice without doing decode work at app boot."
  - "Did NOT auto-fix the 2 still-red mobile tests (HomeSkeletonScreen.tsx hex literals + visual baseline) or the 3 'setPermsGranted is not a function' unhandled errors from RootNativeStack.test.tsx — all pre-existing D4-01 carry-forwards in files outside this plan's files_modified set, already logged in deferred-items.md (owner: the Phase-4 RecordingScreen plan that deletes the __DEV__ smoke seam). Per the SCOPE BOUNDARY rule they're not in scope here."

patterns-established:
  - "in-house event-module teardown on stop() AND invalidate() (double-covered receiver/focus-request/SoundPool release)"
  - "docstrings name forbidden APIs descriptively, never literally (threat-model grep-gate safe)"
  - "pre-baked tone assets via ffmpeg sine + small afade; concat faded segments for multi-note cues"

requirements-completed: [REC-08, REC-10, REC-11, REC-12, REC-13]

# Metrics
duration: 12min
completed: 2026-05-11
---

# Phase 4 Plan 05: Recording-UX native-module bodies (PhoneState / Battery / ScreenBrightness / Beep) Summary

**Filled in the real Kotlin bodies of the four small in-house recording-UX native modules — `HumynPhoneState` (pure `AudioManager.OnAudioFocusChangeListener` — no telephony API, no `READ_PHONE_STATE`; the corrected D-LIFE-02 finding), `HumynBattery` (`Intent.ACTION_BATTERY_CHANGED` sticky-broadcast receiver), `HumynScreenBrightness` (per-window `screenBrightness` override + `BRIGHTNESS_OVERRIDE_NONE` restore), `HumynBeep` (`SoundPool` over two pre-baked `.wav` cues) — each with leak-clean teardown on both `stop()` and `invalidate()`, and generated the `battery_alert.wav` (520 Hz / 200 ms) + `thermal_alert.wav` (440→560→680 Hz at 180/180/220 ms) assets.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-11T~14:20Z (first task)
- **Completed:** 2026-05-11T~14:32Z (last task commit)
- **Tasks:** 2 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- **`HumynPhoneStateModule.kt`** — real body: builds an `AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)` with an `AudioManager.OnAudioFocusChangeListener` + `USAGE_MEDIA` / `CONTENT_TYPE_SPEECH` attributes, calls `requestAudioFocus(...)` on `start()`, `abandonAudioFocusRequest(...)` on `stop()` and on `invalidate()`. The listener maps the raw `AUDIOFOCUS_*` int → `"gain"` / `"loss"` / `"transient_loss"` / `"transient_loss_can_duck"` (unknown → no emit) and pushes `onAudioFocusChanged({focus})` through `RCTDeviceEventEmitter`. It is a **dumb pipe of raw focus transitions** — the answered-vs-declined timing heuristic lives JS-side in `useRecordingLifecycle` (plan 04-08). The file is grep-clean of `TelephonyManager` / `PhoneStateListener` / `READ_PHONE_STATE` (incl. the docstring — T-4.5-01).
- **`HumynBatteryModule.kt`** — real body: a `BroadcastReceiver` registered for `IntentFilter(Intent.ACTION_BATTERY_CHANGED)`; `onReceive` reads `EXTRA_LEVEL` / `EXTRA_SCALE` → `pct = level/scale` (skips on level<0 or scale≤0), `EXTRA_STATUS` → `isCharging = STATUS_CHARGING || STATUS_FULL`; emits `onBatteryChanged({level: Double 0..1, isCharging: Boolean})` only when level or charging actually changed (de-dup). `registerReceiver` returns the last sticky broadcast → synthesizes an initial emit so the JS side has a starting value. Unregisters on `stop()` and on `invalidate()`. No permission (protected broadcast).
- **`HumynScreenBrightnessModule.kt`** — real body: `set(value: Double, promise)` grabs `reactApplicationContext.currentActivity` (RN-0.83 replacement getter, like `HumynCaptureModule.applyKeepScreenOn`), `activity.runOnUiThread { lp.screenBrightness = if (value < 0) BRIGHTNESS_OVERRIDE_NONE else value.toFloat().coerceIn(0f, 1f); window.attributes = lp }`. Per-window only — does NOT touch the OS-wide system brightness setting (no `WRITE_SETTINGS`). Rejects `NO_ACTIVITY` / `NO_WINDOW` / `BRIGHTNESS_FAILED` on the failure paths.
- **`HumynBeepModule.kt`** — real body: lazily builds `SoundPool.Builder().setMaxStreams(2).setAudioAttributes(USAGE_ASSISTANCE_SONIFICATION / CONTENT_TYPE_SONIFICATION)` on the first `playTone`, preloading both bundled `.wav`s (`assets.openFd("audio/${name}.wav") → pool.load(afd, 1)`); `playTone(name)` validates `name` against the fixed map `{battery_alert, thermal_alert}` (unknown → `UNKNOWN_TONE`), then `pool.play(id, 1f, 1f, 1, 0, 1f)`. Releases the pool on `invalidate()`. No `react-native-sound` / `react-native-track-player`, no `MediaPlayer`.
- **`battery_alert.wav`** (17,718 bytes — 520 Hz sine, 200 ms, 5 ms fade in/out, 44.1 kHz mono 16-bit PCM) + **`thermal_alert.wav`** (51,234 bytes — three faded sine segments 440 Hz @ 180 ms → 560 Hz @ 180 ms → 680 Hz @ 220 ms concatenated, total 580 ms, 44.1 kHz mono 16-bit PCM) generated with `ffmpeg`'s `lavfi sine` + `afade` filters. Both start with the `RIFF` magic; `ffprobe`-verified `pcm_s16le` / 44100 Hz / 1 channel.
- All 6 JS contract tests for the four modules stayed green (`__tests__/native/HumynPhoneState.test.ts` 5 + `HumynBattery.test.ts` 5 → wait, those two together are 10; `HumynScreenBrightness.test.ts` 3 + `HumynBeep.test.ts` 3 → 6; combined 16). The JS bindings from plan 04-02 are unchanged — only the Kotlin bodies were filled in. `tsc --noEmit` clean (pre-commit hook).

## Task Commits

Each task was committed atomically:

1. **Task 1: HumynPhoneStateModule (AudioFocus listener) + HumynBatteryModule (ACTION_BATTERY_CHANGED) bodies** — `10fe4d1` (feat)
2. **Task 2: HumynScreenBrightnessModule (per-window override) + HumynBeepModule (SoundPool) bodies + battery_alert.wav + thermal_alert.wav** — `4cb1e95` (feat)

**Plan metadata:** the final docs commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS) — see git log.

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/phonestate/HumynPhoneStateModule.kt` — AudioFocusRequest + OnAudioFocusChangeListener body; emits `onAudioFocusChanged`; abandons on stop()/invalidate(); no telephony API.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/HumynBatteryModule.kt` — ACTION_BATTERY_CHANGED receiver body; emits `onBatteryChanged` (de-dup + initial sticky emit); unregisters on stop()/invalidate().
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/screenbrightness/HumynScreenBrightnessModule.kt` — `set(value)` per-window brightness override on the UI thread; `-1` → BRIGHTNESS_OVERRIDE_NONE; not the OS-wide setting.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt` — `playTone(name)` SoundPool over bundled `.wav`s; name validated; releases pool on invalidate().
- `apps/mobile/android/app/src/main/assets/audio/battery_alert.wav` — 520 Hz / 200 ms tone (REC-10 battery cue).
- `apps/mobile/android/app/src/main/assets/audio/thermal_alert.wav` — 440→560→680 Hz @ 180/180/220 ms tone (REC-10 / thermal-kill cue).

## Decisions Made

See `key-decisions` in the frontmatter — the substantive calls: (1) `invalidate()` override (not deprecated `onCatalystInstanceDestroy`) for the catalyst-destroy teardown; (2) reproduced the §6.1 thermal-cue frequencies + durations verbatim (frequencies ascend but §6.1 calls it "descending"; no inter-note gaps since §6.1 specifies none); (3) `playTone` validates the JS name against a fixed map so the string never enters an asset path (T-4.5-04); (4) SoundPool built + clips preloaded lazily on the first `playTone` (async decode, both cues fire well after mount); (5) the 2 still-red mobile tests + the 3 `setPermsGranted` errors are pre-existing D4-01 carry-forwards outside this plan's scope — not auto-fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Threat-model T-4.5-01 / T-4.5-02 mitigation] Reworded three docstrings so the forbidden-symbol grep gates stay clean**

- **Found during:** Both tasks (self-check verification)
- **Issue:** The plan's action text says the docstrings should mention the forbidden APIs (`TelephonyManager` / `PhoneStateListener` in `HumynPhoneStateModule`, `Settings.System.SCREEN_BRIGHTNESS` in `HumynScreenBrightnessModule`, `react-native-sound` / `MediaPlayer` in `HumynBeepModule`). The threat-model acceptance criteria require those source files to NOT contain those literal strings — and the criteria grep the _file_, comments included (same trap plan 04-02 hit). Writing the symbols literally in the docstrings tripped the gates.
- **Fix:** Reworded each docstring to name the forbidden APIs descriptively ("the Android telephony-callback / call-state-listener pair", "the OS-wide system brightness setting", "the third-party RN sound / track-player libraries", "the platform media-player class") so each file is now grep-clean of `TelephonyManager` / `PhoneStateListener` / `READ_PHONE_STATE` / `Settings.System` / `WRITE_SETTINGS` / `react-native-sound` / `MediaPlayer`.
- **Files modified:** `HumynPhoneStateModule.kt`, `HumynScreenBrightnessModule.kt`, `HumynBeepModule.kt`
- **Verification:** `grep -nE 'TelephonyManager|PhoneStateListener|READ_PHONE_STATE'` on the phonestate file → 0 matches (exit 1); `grep -nE 'Settings\.System|WRITE_SETTINGS'` on the brightness file → 0 (exit 1); `grep -nE 'react-native-sound|MediaPlayer'` on the beep file → 0 (exit 1). The required-symbol greps (`OnAudioFocusChangeListener`/`AudioFocusRequest`/`AUDIOFOCUS_GAIN`/`abandonAudioFocusRequest`/`onAudioFocusChanged`, `ACTION_BATTERY_CHANGED`/`EXTRA_LEVEL`/`EXTRA_SCALE`/`unregisterReceiver`/`onBatteryChanged`, `screenBrightness`/`BRIGHTNESS_OVERRIDE_NONE`/`runOnUiThread`/`coerceIn(0f, 1f)`, `SoundPool`/`battery_alert`/`thermal_alert`) all match.
- **Committed in:** `10fe4d1` (phonestate) + `4cb1e95` (brightness + beep) — folded into the task commits, no separate fixup.

---

**Total deviations:** 1 auto-fixed (1 × Rule 2 / threat-model T-4.5-01 + T-4.5-02 grep-gate refinement).
**Impact on plan:** No scope creep — docstring rewrites within the plan's own four files that make the threat-model acceptance gates actually pass. All 6 files (2 created, 4 modified) match the plan's `files_modified` set exactly; both task verifies passed; the full-suite verification passed modulo the pre-existing D4-01 carry-forwards.

## Issues Encountered

- **Full mobile suite is 403/405 + 3 unhandled errors, not 0-failures.** The plan's Task-2 acceptance criterion says `npm --prefix apps/mobile test -- --run` exits 0, but the suite carries pre-existing failures inherited from the Phase-3 `HomeSkeletonScreen.tsx` `__DEV__`-gated smoke seam + the `RootNativeStack.test.tsx` `setPermsGranted` reference: `__tests__/ui/no-hex-literals.test.ts` (the hex literals in that seam), `__tests__/visual/HomeSkeletonScreen.visual.test.tsx` (stale baseline now that the `__DEV__` block renders), and 3 `TypeError: setPermsGranted is not a function` unhandled rejections from `PermissionsScreen.tsx` via `RootNativeStack.test.tsx`. These are the already-logged D4-01 carry-forwards (see plan 04-01 / 04-02 SUMMARYs and `deferred-items.md` — owner: the Phase-4 RecordingScreen plan that deletes the `__DEV__` smoke seam and fixes the `setPermsGranted` reference), all in files outside this plan's `files_modified` set. Per the SCOPE BOUNDARY rule they are not auto-fixed here. My 16 native-binding tests (10 phone+battery, 6 brightness+beep) all pass and `tsc --noEmit` is clean.

## User Setup Required

None — no external service configuration required. The two `.wav` assets are bundled read-only assets committed to the repo; no permissions are added (audio-focus listening, `ACTION_BATTERY_CHANGED`, per-window brightness, and SoundPool playback all need no permission).

## Next Phase Readiness

- **Plan 04-08 (`useRecordingLifecycle`)** can now subscribe to `HumynPhoneState.onAudioFocusChanged` / `HumynBattery.onBatteryChanged`, call `HumynPhoneState.start()` / `stop()` + `HumynBattery.start()` / `stop()` at the recording boundary, implement the answered-vs-declined timing heuristic (≈6–8 s timer on `transient_loss`; `gain` within window → no-op; timer fires or permanent `loss` → `stop()` — errs toward stopping) and the battery threshold transitions (≤15 % cue, ≤5 % beep + end-segment, <5 % start-guard) + the ~60 s periodic battery cross-check (PITFALLS.md Pitfall 11), call `HumynScreenBrightness.set(0.05)` on record-start + `set(-1)` on stop AND on unmount (Pitfall 6), and `HumynBeep.playTone('battery_alert')` / `playTone('thermal_alert')` — every native-side contract is now final and exercised.
- **Carry-forward (unchanged):** the 2 red mobile tests (`HomeSkeletonScreen.tsx` hex literals + visual baseline) + the 3 `setPermsGranted` unhandled errors — the Phase-4 RecordingScreen plan should delete the `__DEV__` smoke seam, regenerate the visual baseline, and fix the `setPermsGranted` reference in `PermissionsScreen.tsx` / `RootNativeStack.test.tsx`. See `deferred-items.md` D4-01.

---

## Self-Check: PASSED

- Files created/modified exist — verified `battery_alert.wav` (17,718 B, `RIFF` magic) + `thermal_alert.wav` (51,234 B, `RIFF` magic) present; all 4 `Humyn*Module.kt` files updated with their real bodies on disk.
- Commits exist — `10fe4d1` (Task 1, feat) + `4cb1e95` (Task 2, feat) both FOUND in `git log`.
- Verification: `npm --prefix apps/mobile test -- --run __tests__/native/HumynPhoneState.test.ts __tests__/native/HumynBattery.test.ts` → 10/10 pass; `npm --prefix apps/mobile test -- --run __tests__/native/HumynScreenBrightness.test.ts __tests__/native/HumynBeep.test.ts` → 6/6 pass; full mobile suite → 403/405 (2 pre-existing D4-01 failures + 3 pre-existing `setPermsGranted` unhandled errors, out of scope); `tsc --noEmit` → clean (pre-commit hook). `HumynPhoneStateModule.kt` grep-clean of `TelephonyManager`/`PhoneStateListener`/`READ_PHONE_STATE`; `HumynScreenBrightnessModule.kt` grep-clean of `Settings.System`/`WRITE_SETTINGS`, contains `BRIGHTNESS_OVERRIDE_NONE`; `HumynBeepModule.kt` grep-clean of `react-native-sound`/`MediaPlayer`, contains `SoundPool`/`battery_alert`/`thermal_alert`; both `.wav`s start with `RIFF`.

_Phase: 04-handdetector-recording-ux-practice-tutorial_
_Completed: 2026-05-11_
