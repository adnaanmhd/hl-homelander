# Phase 4 Manual Smoke — HandDetector + Recording UX + Practice Tutorial (on-hardware acceptance, D-WAVE-04)

**Status:** OPEN — fill in the checkboxes during the manual smoke; commit the file when complete.

> Per `04-RESEARCH.md` § "Validation Architecture — Wave 0" + `04-CONTEXT.md` D-WAVE-04: **Phase 4 acceptance is module-ready (vitest suite green) + the practice E2E passing + the `idea-brief.md §10` lifecycle edges manually verified + the §5b drift figures within ±1 ms.** The seven Phase 3 hardware-UAT items (`.planning/STATE.md` "Phase 3 hardware UAT pending") effectively RETIRE during this walk — the verifier should not separately re-block on them after Phase 4 closes. §5b — the ±1 ms video↔IMU drift re-measurement on the new gate→record camera handoff — is **`[BLOCKING]`**: a Phase-4 blocker (not a Phase-5 deferral) if it regresses past Phase 3 smoke 7's mean 0.594 ms / p99 0.728 ms.

**Operator:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Date:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Device:** Pixel 10a (5C161JEA304304) **Android version:** **\_\_\_\_**
(Secondary device, if walked: Pixel 7a / 8a — **\_\_\_\_** — `idea-brief.md` battery/thermal budget is the 7a-class baseline.)

> Throughout: the app package id for the `apkRollout` flavor is `ai.humynlabs.capture.apk` — every `adb shell run-as` below uses that. Run `adb logcat -c` before each section so the logcat greps match the latest run. The app NEVER runs CLI commands; the operator only visits screens, taps UI, evaluates visuals/audio/haptics, and runs the `adb` diagnostics quoted inline.

---

## §1 Pre-flight

- [ ] Pixel 10a connected via adb — `adb devices` lists `5C161JEA304304` as `device`.
- [ ] Debug build of the **`apkRollout`** flavor installed: `cd apps/mobile/android && ./gradlew installApkRolloutDebug`. (Confirm it's the debug variant — `adb shell dumpsys package ai.humynlabs.capture.apk | grep -i versionName`; the debug build is the one that ships `__DEV__ === true`.)
- [ ] DND **off** (Quick Settings tile inactive) — the app never toggles DND (REC-09), and a live DND state would mask the call/alarm lifecycle edges in §4.
- [ ] Phone plugged in (the §4 battery edges set the level via `adb`, but start the walk charged so a real low-battery event doesn't fire mid-walk).
- [ ] The Phase-1 dev API + backend reachable per the `.env.apkRollout` URL (Phase 5 owns the upload seam, so a recording landing in `files/recordings/` or `files/practice/` is enough for Phase 4 — but a reachable backend keeps sign-in working).
- [ ] Confirm `__DEV__` is `true` in this build — the §3 non-practice path uses the `__DEV__`-gated long-press affordance on the Tasks tab (plan 04-08 / 04-09); if `__DEV__` is false, that affordance is dead-code-eliminated and §3 can't be walked. Sanity: `adb logcat | grep -i "__DEV__\|DevSettings"` shows dev-mode chatter, or the Tasks tab's "coming in Phase 6" heading responds to a long-press.
- [ ] Device signed into a Google account (Phase 2 sign-in completed); a per-account record exists so the ONB-08 once-per-install tutorial gate is meaningful.
- [ ] `ffprobe` available on the workstation (for the §3 spec checks); `python` (or `python3`) available (for the §5b drift JSON greps).
- [ ] `adb logcat -c`.

---

## §2 Practice E2E (ONB-03/04/05/08 + the gate-pass transition)

Fresh-install path through the tutorial → 60-second practice recording → Practice-complete → Home.

- [ ] Fresh install (`adb uninstall ai.humynlabs.capture.apk` then re-install) → cold-launch.
- [ ] **Splash → Sign-up → Permissions → Compat** — walk through (Phase 2 surface; no Phase-4 assertions here beyond "they still render and advance").
- [ ] **RigTutorial** → the rig illustration renders; tap **Next** → routes to **PracticeIntro** (NOT straight to Home — plan 04-03 retargeted the Next CTA).
- [ ] **PracticeIntro ("One quick try")** — copy matches `04-UI-SPEC.md §6`; tap **"Start practice"** → routes to **RecordingScreen** with `{ taskId: '__practice__', taskName: '<practice label>', isPractice: true }`.
- [ ] **RecordingScreen — pre-flight → ready** — the screen auto-rotates + locks to landscape (REC-01); the 3-second "Don't exit while recording." overlay shows then fades; the 88×88 record button is visible.
- [ ] Tap the **88×88 record button** → enters the **gate substate**: the 130×130 gate ring, the prompt "Mount the phone on your head and bring your hands in frame for 2 secs", and the **Skip** link visible from t=0 (HAND-07). (Brightness has NOT dropped yet — the drop happens on gate-pass.)
- [ ] **Bring 2 hands into frame on the rig** (head-mounted) → the ring fills over ~5 × 400 ms (5 consecutive 2-hand detections — HAND-03/04/11; the cadence/target/confidence are Firebase Remote Config keys with the hard-coded `5 / 400 / 0.5` Android fallback).
- [ ] **Gate-pass** (passed, not skipped/bypassed) → in this exact order: an **80 ms vibrate** → Indian-English-female **TTS "Recording started"** (en-IN voice if a TTS pack is installed; the fallback chain en-IN female → en-IN any → en-US female → first `en-*` per `idea-brief.md §13`) + the **VoiceCue pill** text "Recording started" duplicated on-screen for accessibility (REC-15) → **screen dims to ~5%** brightness → the **active substate**: the 32-px mono **HH:MM:SS** timer counting up + the top minute-bar growing + the 64×64 white floating Stop button.
- [ ] Let it run to **~60 s** → at **exactly 60 s** the practice recording **auto-stops** (the JS-owned practice hard cap — `useRecordingLifecycle`, plan 04-08; NOT a 10-min segment cut) → voice **"Recording stopped"** → routes to **PracticeCompleteScreen** ("You got it.", confetti + scale-pop, `[40, 80, 40]` ms haptic — `04-UI-SPEC.md §8`).
- [ ] Tap **Continue** → routes to **Home** (the first-time hero variant).

**Assertions (run after the practice run completes):**

- [ ] The practice recording landed in `files/practice/` — `adb shell run-as ai.humynlabs.capture.apk ls files/practice/` shows a `{base}.mp4` (+ `.csv` + `.json`).
- [ ] The practice recording is **NOT in History** and does **NOT count toward contribution** (ONB-04) — re-launch the app, open History (Phase 6 stub) / check the Home contribution tile: the practice run is absent. Confirm the metadata JSON carries `is_practice: true` — `adb shell run-as ai.humynlabs.capture.apk cat files/practice/{base}.json | python -m json.tool | grep -i practice`.
- [ ] **Tutorial does not re-run** — fully restart the app (`adb shell am force-stop ai.humynlabs.capture.apk` then re-launch) → cold-start goes straight to Home; the RigTutorial / PracticeIntro do NOT re-appear (ONB-08, the per-Google-account flag persisted via `practiceDoneKey(sub)`).
- [ ] The hand-gate frame JPEGs are **gone** — `adb shell run-as ai.humynlabs.capture.apk ls cache/hand-gate/` is empty (the JPEGs were deleted on each gate-check resolve + the mount-time sweep — Security V8/V12).

**§2 Acceptance:** all transitions occur in order; practice landed in `files/practice/`, is `is_practice:true`, never appears in History/contribution; tutorial doesn't re-run; `cache/hand-gate/` is clean.

---

## §3 Non-practice recording via the `__DEV__` dev affordance (CAP-10 / REC-04..08 / spec-compliance — Phase-3 UAT #1/#2/#5/#6/#7 retire here)

- [ ] **Long-press (>800 ms)** the "Tasks — coming in Phase 6." heading on the **Tasks** tab → routes to **RecordingScreen** with `{ taskId: 'cooking_chop_vegetables', taskName: 'Practice — Chop vegetables', isPractice: false }` (the `__DEV__`-gated affordance from plan 04-08/04-09).
- [ ] Tap record → gate substate → bring 2 hands in frame → **gate-pass** (80 ms vibrate + TTS "Recording started" + brightness drop to ~5% + active substate) — same transition as §2.
- [ ] Let it run **~10+ minutes** and observe the **10-minute auto-segment cut**: it is a **SILENT** segment swap — **no gate re-run**, no voice cue, no visible UI hiccup beyond the timer continuing (CAP-10). The minute-bar / timer keep counting through the cut.
- [ ] After ~10 min, `adb shell run-as ai.humynlabs.capture.apk ls -la files/recordings/` shows **two triples** — `{base1}.mp4/.csv/.json` and `{base2}.mp4/.csv/.json` — with consecutive `YYYYMMDD_HHMMSS_NNN` names and a ~0.5 s wallclock gap (Phase-3 UAT #2 — auto-segment integrity — retires here).
- [ ] `adb shell run-as ai.humynlabs.capture.apk cat files/recordings/{base2}.json | python -m json.tool | grep -A6 -i start_gate` — the `start_gate` block in segment 2 is **identical** to segment 1's (the gate result is preserved across the cut, not re-computed — CAP-10).
- [ ] Tap the **64×64 white floating Stop button** → it stops the recording **directly** (no confirm modal) → voice **"Recording stopped"** → a Home toast **"{Hh Mm} added to your contribution."** (e.g. "11m added to your contribution." — `formatContributionDuration`, plan 04-08) → routes to Home.
- [ ] **Now test the X button path separately** — start another non-practice recording, get to the active substate, tap the **X (close) button** → the **"Stop recording?"** modal appears with body **"Recordings under 1 minute are discarded."** + buttons **"Keep recording"** / **"Stop"**. Tap **"Keep recording"** → the modal dismisses, recording continues. Re-open it, tap **"Stop"** → recording stops, voice + toast as above (REC-06). (So: the floating Stop button stops directly; the X button shows the modal.)
- [ ] **Sub-60 s discard** — start a non-practice recording, stop it via the X-modal **before 60 s** → toast **"Recording too short — discarded."**; `adb shell run-as ai.humynlabs.capture.apk ls files/recordings/` shows no new triple (HumynCapture owns the file deletion at finalize — REC-07). Re-pressing record starts a **fresh** recording with no countdown (REC-05).

**Spec-compliance assertions on a ≥60 s non-practice segment (Phase-3 UAT #1/#5/#6/#7 retire here):**

- [ ] `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,r_frame_rate,bit_rate -of default=nw=1 <pulled {base}.mp4>` → `h265` (HEVC) / `Main` profile / `1920x1080` / `30/1` / ~`8000000` bit_rate (CBR). Pull with `adb shell run-as ai.humynlabs.capture.apk cat files/recordings/{base}.mp4 > /tmp/seg.mp4`.
- [ ] GOP = 30, **no B-frames** at the NAL level — `ffprobe -v error -show_frames -select_streams v:0 -of csv /tmp/seg.mp4 | head -40` shows only `I`/`P` pict_type (no `B`), an IDR every 30 frames.
- [ ] The IMU CSV sustains **≥100 Hz** — `adb shell run-as ai.humynlabs.capture.apk cat files/recordings/{base}.csv | wc -l` divided by the segment duration in seconds is ≥100; and the metadata JSON's `imu_min_rate_hz_observed_p1` (the sliding-1s p1) is ≥100 — `... cat files/recordings/{base}.json | python -m json.tool | grep -i imu_min_rate`.
- [ ] **FGS type + KEEP_SCREEN_ON during the recording** (Phase-3 UAT #5) — while a recording is active: `adb shell dumpsys activity services | grep -A6 -i humyn` shows the foreground service running with type `camera|microphone|dataSync`; `adb shell dumpsys window | grep -i "ai.humynlabs.capture"` (or `dumpsys activity` for the top activity) shows `FLAG_KEEP_SCREEN_ON` set. The screen does NOT sleep mid-capture.
- [ ] **CAP-18 byte-for-byte SHA round-trip** (Phase-3 UAT #6) — `adb shell run-as ai.humynlabs.capture.apk cat files/recordings/{base}.mp4 | sha256sum` equals the `file_sha256` field in `{base}.json`; same for `{base}.csv` ↔ `imu_sha256`. (Phase 5 owns the device→S3 leg; here we verify the on-disk SHA matches the stamped value — the file is byte-for-byte what the metadata claims.)
- [ ] **`onSessionStart` / `onSessionStop` upload-pause seam fires** (Phase-3 UAT #7 — log-only at Phase 4; Phase 5 wires the actual pause) — `adb logcat | grep -i "onSessionStart\|onSessionStop\|HumynCaptureModule"` shows the events around start/stop.

**§3 Acceptance:** the 10-min auto-segment cut is silent + the `start_gate` block is preserved; the Stop button stops directly while the X button shows the discard-warning modal; sub-60 s recordings are discarded with the documented toast and never persisted; a ≥60 s segment is spec-compliant (1080p/30/HEVC-Main/8 Mbps CBR/GOP 30/no-B); IMU ≥100 Hz; FGS type + KEEP_SCREEN_ON correct; on-disk SHA matches the metadata; the session start/stop events fire.

---

## §4 Lifecycle edges (`idea-brief.md §10` — REC-09..16 / D-LIFE-04)

For each: start a recording (non-practice via the dev affordance is fine), reach the active substate, then trigger the edge. Reset battery with `adb shell dumpsys battery reset` after the battery sub-steps.

- [ ] **(a) Phone call ANSWERED mid-record** — place a call to the device from another phone, **answer** it → the recording **stops** (uploads if ≥60 s, discards if not — same finalize path); voice "Recording stopped". (REC-12 — `idea-brief.md §10` "interruption: phone call (answered)" → stop.)
- [ ] **(b) Phone call DECLINED** — place a call, let it ring, **decline** before answering → the recording **CONTINUES** uninterrupted (no stop, no voice cue). (REC-13 — call-not-answered ≠ interruption.)
- [ ] **(c) Alarm rings mid-record** — set a system alarm to fire in ~1 min, start a recording, wait for the alarm → the recording **stops**; voice "Recording stopped". (REC-12 — alarm → stop.)
- [ ] **(d) Rotate out of landscape mid-record** — physically rotate the phone toward portrait → the recording **stops** + toast **"Recording stopped — keep the phone in landscape."** (REC-12 — orientation lost → stop; REC-01 the surface is landscape-locked but a hard physical rotation past the lock counts as an exit.)
- [ ] **(e) Force-quit / OS-evict mid-record** — swipe the app away from Recents (or `adb shell am force-stop ai.humynlabs.capture.apk`) **while a recording is active** → re-launch the app → a **one-shot Home toast "Recording recovered after force-quit — uploading."** appears (D-LIFE-04 / REC-12 — `bootRecoveryListener` → `showToast`) AND the orphan segment was re-finalized off its `.session.json` sidecar — `adb logcat | grep -i CaptureLaunchSweep` shows `orphan_with_sidecar={base} — Phase 4 re-finalize candidate` and `adb logcat | grep -i onCrashRecovery` shows `onCrashRecovery emitted — recovered=N`; `adb shell run-as ai.humynlabs.capture.apk ls files/recordings/` shows the orphan triple (Phase 5's upload path picks it up later — Phase 4 just surfaces the toast). The toast fires **once per launch** — re-launching again (with no new orphan) does NOT re-toast.
- [ ] **(f) Battery ≤15% mid-record** — `adb shell dumpsys battery set level 15` while recording → an **alert pill "Battery 15%"** + a **520 Hz beep** + `[100, 50, 100]` ms haptic + voice **"Battery low. Consider charging soon."** → the recording **CONTINUES**. (REC-10.)
- [ ] **(g) Battery ≤5% mid-record** — `adb shell dumpsys battery set level 5` while recording → the recording **ends immediately** (the segment finalizes). (REC-11.) Then `adb shell dumpsys battery reset`.
- [ ] **(h) Storage <5 GB — refuse to start** — fill the device (or simulate) so free space is under 5 GB, then tap record → the start is **refused** with a toast (e.g. "Not enough storage to record."); the screen stays in the ready substate. (REC-16 — recurring storage check before each start.) Clear space afterward.
- [ ] **(i) Battery <5% — refuse to start** — `adb shell dumpsys battery set level 4`, then tap record → the start is **refused** with a toast; ready substate. Then `adb shell dumpsys battery reset`. (The battery start guard — `checkStartGuards`, plan 04-08.)
- [ ] **DND untouched** — note the DND state before this whole section and confirm it's **unchanged** after — the app never programmatically toggles DND (REC-09).

**§4 Acceptance:** every `idea-brief.md §10` edge behaves per the table — answered-call/alarm/rotation/force-quit → stop (force-quit also → recover-on-launch toast + sidecar re-finalize); declined-call → continue; battery 15% → alert + continue; battery 5% → end; storage <5 GB and battery <5% → refuse-to-start with a toast; DND never toggled.

---

## §5 Thermal injection (D-THERM-01 — Phase-3 UAT #4 retires here)

Requires `adb shell cmd thermalservice override-status` (available on userdebug builds). Reset with `adb shell cmd thermalservice override-status 0` after each.

- [ ] **Mid-record SEVERE thermal** — start a recording, reach the active substate, then `adb shell cmd thermalservice override-status 4` (`THERMAL_STATUS_CRITICAL` — ≥ SEVERE) → the **thermal alert pill "Phone too hot"** + the **descending 440 → 560 → 680 Hz tone sequence** + an **800 ms continuous vibrate** + voice **"Phone too hot, stopping recording"** → HumynCapture **self-stops within ~2.5 s** (the graceful-stop budget) → toast **"Recording stopped — phone needs to cool."** → returns to Home / ready. `adb logcat | grep -i "onThermalAbort\|ThermalGate"` shows the abort event. Reset: `adb shell cmd thermalservice override-status 0`.
- [ ] **Pre-record thermal refuse** — `adb shell cmd thermalservice override-status 3` (`THERMAL_STATUS_SEVERE`), then tap record → `HumynCapture.start()` **rejects with `thermal_throttling`** → voice **"Phone too warm"** + the screen stays in the Ready substate (no gate, no recording). `adb logcat | grep -i "thermal_throttling"`. Reset: `adb shell cmd thermalservice override-status 0`.

**§5 Acceptance:** mid-record SEVERE → multimodal alert + graceful self-stop within ~2.5 s + the documented toast; pre-record SEVERE → `start()` rejects `thermal_throttling` + the documented voice cue + back to Ready.

---

## §5b ±1 ms video↔IMU drift re-measurement on the gate→record handoff — `[BLOCKING]`

**This is the section that satisfies the capture-quality invariant for the new Phase-4 camera handoff.** Phase 4 introduced a VisionCamera `<Camera>` (preview + `takePhoto()` for the hand-gate) that must be released before `HumynCapture.start()` opens Camera2 — the `RecordingScreen.tsx` `SETTLE_MS = 80` tunable (plan 04-09) is the delay between `isActive=false` on the VC camera and `HumynCapture.start()`. If that delay is too short, Camera2 opens before VC fully released the device, which (per `04-RESEARCH.md` Pitfall 1) can perturb the timestamp alignment.

**Procedure:**

1. Record a **non-practice** recording started **THROUGH the hand-gate** (so the camera was just released by VisionCamera right before `HumynCapture.start()`) — i.e. the §3 path with hands brought into frame for a real gate-pass, NOT a Skip/bypass. Let it run long enough to produce at least 2–3 segments (~25 min — or temporarily lower `capture.segment_minutes` via Remote Config / its default to shorten the run).
2. For the **first 2–3 segments**, read the drift figures from each segment's metadata JSON:
   ```
   adb shell run-as ai.humynlabs.capture.apk cat files/recordings/{base}.json | python -m json.tool | grep -i drift
   ```
   (the fields are `imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms` — the `{max, mean, p99}` set per `idea-brief.md §6.5` least-squares residual subtraction; memory `project_drift_metrics.md` — three figures, never just `mean`.)
3. If any lifecycle path re-calls `HumynCapture.start()` on a fresh screen (the force-quit + relaunch path does NOT — it re-finalizes off the sidecar without a new `start()`), repeat the measurement for that path too. If no Phase-4 path re-calls `start()` beyond the gate→record handoff, the gate→record handoff alone suffices.
4. **Record the measured figures below.**

| Segment | `imu_video_drift_max_ms` | `imu_video_drift_mean_ms` | `imu_video_drift_p99_ms` |
| ------- | ------------------------ | ------------------------- | ------------------------ |
| seg 1   |                          |                           |                          |
| seg 2   |                          |                           |                          |
| seg 3   |                          |                           |                          |

**Pass criterion (`[BLOCKING]`):** every figure on every segment is within **±1 ms**, AND specifically **does not regress past Phase 3 smoke 7's mean 0.594 ms / p99 0.728 ms** (post-audio-unwire baseline — see `CLAUDE.md` audio-drop banner + `.planning/phases/03-humyn-capture-native-module/03-HUMAN-UAT.md` GAP-3).

**If any segment exceeds ±1 ms (or regresses past the smoke-7 baseline):** this is a **Phase-4 BLOCKER** — do NOT close Phase 4.

1. First remedy: increase `SETTLE_MS` in `apps/mobile/src/screens/recording/RecordingScreen.tsx` (it has a drift-re-measurement comment pointing here) and re-walk this section.
2. If bumping `SETTLE_MS` doesn't bring it back inside ±1 ms: escalate a surgical change to Phase 3 — `HumynCapture.start()` should poll for camera availability (Camera2 device fully released) before opening Camera2, rather than relying on a fixed JS-side delay. Use the surgical-stage protocol (a focused Phase-3 follow-up plan).
3. Audio is **NOT** re-introduced under any circumstance (`CLAUDE.md` banner — re-introducing audio requires its own on-hardware proof that drift stays inside ±1 ms; that is out of scope here).

**Note:** Phase 3's hardware-UAT item #3 (`imu_video_drift_{max,mean,p99}_ms` residual) retires here — these figures, recorded above, are the canonical Phase-4 drift evidence.

---

## §6 Sign-off

- [ ] All §1 boxes ticked (pre-flight).
- [ ] All §2 boxes ticked (practice E2E — transitions, `files/practice/`, `is_practice:true`, not-in-History, tutorial-once, clean `cache/hand-gate/`).
- [ ] All §3 boxes ticked (non-practice via dev affordance — silent 10-min cut + preserved `start_gate`, Stop-button-direct vs X-modal, sub-60 s discard, spec-compliance, IMU ≥100 Hz, FGS type + KEEP_SCREEN_ON, on-disk SHA, session start/stop events).
- [ ] All §4 boxes ticked (lifecycle edges — answered-call/alarm/rotation/force-quit → stop; force-quit → recover-toast + sidecar re-finalize; declined-call → continue; battery 15% → alert+continue; battery 5% → end; storage <5 GB / battery <5% → refuse; DND untouched).
- [ ] All §5 boxes ticked (thermal — mid-record SEVERE graceful stop ~2.5 s + multimodal alert; pre-record SEVERE → `start()` rejects `thermal_throttling`).
- [ ] **§5b `[BLOCKING]` — the drift table above is filled in and every figure is within ±1 ms (and does not regress past mean 0.594 / p99 0.728 ms).**
- [ ] Phase-3 hardware-UAT items #1–#7 are considered RETIRED by this walk (the verifier should not separately re-block on them after Phase 4 closes — per D-WAVE-04).

**Recorded §5b drift figures (copy from the §5b table):** seg1 max **\_** / mean **\_** / p99 **\_** · seg2 max **\_** / mean **\_** / p99 **\_** · seg3 max **\_** / mean **\_** / p99 **\_**

Operator signature: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

Smoke-walked-on: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** on Pixel 10a (5C161JEA304304).

re-walked-on: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** (post-amendments verification walk, if any §7 amendments were filed.)

Approved? **YES / NO**

If NO: describe the failure mode and link to the bug ticket / debug-session below. If the §5b drift gate failed, note the `SETTLE_MS` value tried and whether a Phase-3 escalation was opened.

---

## §7 Amendments protocol (D-WAVE-09 pattern)

New **cosmetic** gaps surfaced during this smoke walk (visual nits, copy tweaks, spacing) go into a NEW file:

`.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-COSMETIC-GAPS.md` (create it on first use).

They are picked up either by Phase 5's plan-phase (it may roll them into an early plan) OR by a dedicated Wave-5 fix-up plan before Phase 5 starts — per memory `feedback_functionality_first_during_smoke.md` (do NOT rebuild mid-smoke; defer cosmetics to a later cleanup wave).

**Never** write Phase-4 amendments back into the FROZEN `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md` or `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` — those are closed.

Functional regressions (broken behavior, spec violations) are NOT cosmetic — they block §6 sign-off and get a debug session (`/gsd-debug`), not an amendment-file entry.
