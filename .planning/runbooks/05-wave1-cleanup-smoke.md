# Phase 5 — Wave 1 Cleanup Smoke Runbook

**Status:** authored by Plan 05-02 (Wave 1, D-09). On-hardware checklist that closes out the open `04-COSMETIC-GAPS.md` items deferred into Phase 5 Wave 1 (D-03 / D-05 / D-06 / D-09) plus a formal note on the UP-08 iOS gap. Run this **before** the Phase-5 upload-pipeline work proceeds past Wave 1 (it is the cleanup-pass mirror of how `02-COSMETIC-GAPS.md` was Phase 3's Wave 1).

**Reference:** `04-COSMETIC-GAPS.md`; `05-CONTEXT.md` D-03 / D-03a / D-03b / D-05 / D-06 / D-07 / D-08 / D-09; `04-MANUAL-SMOKE.md` (the §-numbered convention this file mirrors); `05-VALIDATION.md` Manual-Only table (D-06 + D-09 rows).

> **Conventions.** The `apkRollout` flavor's package id is `ai.humynlabs.capture.apk` — every `adb shell run-as` below uses that. Run `adb logcat -c` before each section so the greps match the latest run. The app NEVER runs CLI commands; the operator only visits screens, taps UI, evaluates visuals/audio/haptics, and runs the `adb` diagnostics quoted inline. Mid-smoke cosmetic findings go to a `*-COSMETIC-GAPS.md` (the runbook §7 amendments protocol) — **never** into the FROZEN Phase-2/3 amendment files.

---

## §1 Pre-flight

- [ ] Install the **Wave-1 build** — `cd apps/mobile/android && ./gradlew installApkRolloutDebug` (or the release/staging build per the `__DEV__` caveat in `04-MANUAL-SMOKE.md` §1 if a substate's `__DEV__`-gated affordance is in the way).
- [ ] **Turn the device's media volume to MAXIMUM** (the D-06 alert-tone check below is meaningless at low media volume — that was the original false-negative).
- [ ] `adb logcat -c`.
- [ ] Confirm a head rig is available (the gate-pass / device-distress steps need a real recording underway).

---

## §2 D-03 — `CaptureLaunchSweep` discards crash-truncated fragments (no recovered-segment upload)

D-03: a force-quit/OS-evict **after** the first 30 s `moof` flush previously left a real ~30 s+ fragment that `CaptureLaunchSweep` re-finalized into a usable triple with degenerate metadata. The owner decision (D-03) is to **discard ALL crash-truncated fragments** — nothing recovered ever reaches the upload queue.

- [ ] Start a non-practice recording (the `__DEV__` Tasks-tab long-press affordance is fine), reach the **active substate**, let it run **> 30 s** (so at least one `moof` flush has happened).
- [ ] **Force-quit mid-record** — `adb shell am force-stop ai.humynlabs.capture.apk` (or swipe it away from Recents).
- [ ] **Relaunch the app.**
  - [ ] Confirm **NO** "Recording recovered after force-quit — uploading." toast appears (D-03b: with D-03 the post-30 s partial is discarded, so there is nothing recovered to upload — the toast wiring stays but should fire rarely-to-never; if it DOES fire here, that's a finding → `*-COSMETIC-GAPS.md`).
  - [ ] `adb shell run-as ai.humynlabs.capture.apk ls files/recordings/` shows **no leftover fragment** (no `{base}.mp4` / `.csv` / `.json` from the crashed session) and `adb shell run-as ai.humynlabs.capture.apk ls files/recordings/` shows **no lone `.session.json` sidecar** either.
  - [ ] `adb logcat | grep -i CaptureLaunchSweep` shows the discard log line for the crashed fragment (e.g. `crash-truncated fragment {base} — discarding` / the Pass-3 lone-sidecar sweep), **not** an `… Phase 4 re-finalize candidate` / `recovered=N` line.
- [ ] **Repeat with a < 30 s force-quit** — start, force-quit before 30 s → relaunch → confirm the sub-30 s `ftyp`+`moov` stub is discarded + its sidecar swept (same as before D-03 — this case was already discarded).

**§2 Acceptance:** a force-quit-mid-record (before OR after the 30 s flush) leaves nothing in `files/recordings/`; no recovered-segment toast; `CaptureLaunchSweep` logs the discard.

---

## §3 D-05 — device-distress mid-record stop → Home navigation

D-05: a device-distress mid-record stop (battery ≤ 5 % REC-11, or a thermal abort) navigates to **Home** after finalizing, instead of resetting to the RecordingScreen `'ready'` substate. A normal sub-60 s manual discard keeps its current behavior (REC-05 — re-pressing record starts a fresh recording; it does NOT bounce to Home).

- [ ] Start a recording, reach the **active substate**, then trigger device-distress:
  - **Battery ≤ 5 %:** `adb shell dumpsys battery unplug && adb shell dumpsys battery set level 5` → the recording **ends immediately** (REC-11).
  - **— or — thermal abort:** `adb shell cmd thermalservice override-status 4` → the thermal alert pill + the abort sequence → HumynCapture self-stops within ~2.5 s.
  - [ ] After the finalize: confirm the app lands on **Home / MainTabs** — NOT the RecordingScreen `'ready'` substate.
  - [ ] Reset: `adb shell dumpsys battery reset` / `adb shell cmd thermalservice override-status 0`.
- [ ] **Practice-mid-onboarding edge** (D-05 open edge) — start the 60 s practice recording during onboarding, trigger device-distress mid-practice → confirm the app lands on the **sane destination** (resume onboarding if Home doesn't exist yet, else Home) and does NOT brick / loop. (Whatever the planner picked in 05-01 — verify it's coherent.)
- [ ] **Sanity (normal sub-60 s discard still resets on-screen):** start a non-practice recording, stop it via the X-modal **before 60 s** → toast "Recording too short — discarded." → the screen returns to the **ready substate** (re-pressing record starts a fresh recording — REC-05), NOT Home. (Only device-distress stops bounce to Home.)

**§3 Acceptance:** battery-≤5 % and thermal-abort mid-record stops land on Home; the practice-mid-onboarding distress case has a sane destination; a normal sub-60 s manual discard still resets to ready (no Home bounce).

---

## §4 D-06 — alert-cue tones re-checked at FULL media volume

D-06: the re-walk found `HumynBeep.playTone` (the battery-15 % 520 Hz beep, the thermal-abort 440 → 560 → 680 Hz sequence) inaudible while media volume was at ~3.6 %; the louder TTS path was audible. Almost certainly device state, not a bug. **Action: re-check with media volume MAXED — only chase a `HumynBeep` / SoundPool fix if the tones are STILL silent at full media volume.**

- [ ] Confirm media volume is at **maximum** (from §1).
- [ ] **Battery-15 % beep** — start a recording, reach the active substate, `adb shell dumpsys battery unplug && adb shell dumpsys battery set level 15` → confirm the **520 Hz beep** is **audible** (alongside the "Battery 15%" pill + `[100,50,100]` ms haptic + voice "Battery low. Consider charging soon."). Reset: `adb shell dumpsys battery reset`.
- [ ] **Thermal-abort tone sequence** — start a recording, reach the active substate, `adb shell cmd thermalservice override-status 4` → confirm the **descending 440 → 560 → 680 Hz tone sequence** is **audible** (alongside the "Phone too hot" pill + 800 ms vibrate + voice "Phone too hot, stopping recording" + the ~2.5 s graceful self-stop). Reset: `adb shell cmd thermalservice override-status 0`.
- [ ] If **either** tone is still silent at full media volume → that IS a `HumynBeep`/SoundPool bug — log it to `*-COSMETIC-GAPS.md` for a follow-up fix. If both are audible at full volume → close D-06 as device-state, no code change.

**§4 Acceptance:** the battery-15 % beep and the thermal-abort tone sequence are audible at full media volume → D-06 closed as device-state; otherwise a HumynBeep/SoundPool fix is logged.

---

## §5 D-09 — RotatePrompt portrait-phone glyph eyeball

D-09 (doc-polish bucket): sanity-check that the `RotatePrompt.tsx` portrait-phone SVG glyph reads as "rotate your phone" on a real screen.

- [ ] Open **RecordingScreen** in **portrait** (e.g. enter from PracticeIntro / the `__DEV__` Tasks-tab affordance while the phone is held portrait) → confirm the `rotate-prompt` substate shows the portrait-phone SVG + the `RotateCw` icon + "Rotate to landscape and mount on rig".
- [ ] **Eyeball the glyph:** does the tilt/arrow read clearly as "rotate your phone to landscape"? (Not "back" / "refresh" / something ambiguous.) If it reads wrong → log to `*-COSMETIC-GAPS.md`; if it reads fine → close D-09's glyph item.
- [ ] (Reference: the doc-side of D-09 — `04-MANUAL-SMOKE.md` §2/§3 stale-text refresh + the `design-spec.md §6` / `04-UI-SPEC.md § Copywriting` owner-deviation reflections — was done in Plan 05-02 Task 3; this runbook step is just the on-device glyph eyeball.)

**§5 Acceptance:** the RotatePrompt portrait-phone glyph reads as "rotate your phone"; otherwise a fix is logged.

---

## §6 NOTE — UP-08 iOS clause is a DOCUMENTED gap (not built this phase)

UP-08 ("On iOS, uploads run via `URLSessionConfiguration.background(withIdentifier:)` with `sessionSendsLaunchEvents = true` and `isDiscretionary = false`; the multipart-complete POST runs as a foreground `dataTask` from inside `urlSessionDidFinishEvents`") is **NOT implemented this phase.** iOS is deferred to `REQUIREMENTS.md §v2` (IOS-01..07); there is **no `HumynUploadIOS`** native module and **no `URLSessionConfiguration.background`** work in Phase 5 — the entire upload path is Android-only (`HumynUpload` Kotlin module + the FGS/UIDT JobService architecture). UP-08 is "covered" for this phase by **formally recording the gap here** (and in `04-MANUAL-SMOKE.md` — the iOS clause is explicitly out of scope), not by building it. When the iOS milestone runs, UP-08 is implemented against the iOS native-module analogues alongside IOS-01..07.

- [ ] (No action — this is a recorded-gap note. Confirm there is no iOS upload work expected of this phase's smoke.)

---

## §7 Sign-off

- [ ] **Verdict: YES / NO** — all of §2 (D-03 discard), §3 (D-05 Home nav), §4 (D-06 tones at full volume), §5 (D-09 glyph) pass; §6's iOS-gap note is acknowledged.
- [ ] **Findings** — any failure or cosmetic nit goes to a `*-COSMETIC-GAPS.md` (the runbook §7 amendments protocol — `04-COSMETIC-GAPS.md` for Phase-4-owned surface, or a Phase-5 `05-COSMETIC-GAPS.md` for Phase-5-owned surface), **never** into the FROZEN Phase-2/3 amendment files. Note the device model + OS version + build flavor used for the walk.
- [ ] Record the verdict + the date + the device in this file (append, don't overwrite prior runs).

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud — Wave 1 cleanup smoke — authored by Plan 05-02 (D-09)_
