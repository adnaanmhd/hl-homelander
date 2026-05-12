# Phase 4 Manual Smoke — HandDetector + Recording UX + Practice Tutorial (on-hardware acceptance, D-WAVE-04)

**Status:** WALKED 2026-05-12 (operator Adnaan Mohammed, Pixel 10a / Android 16) — **verdict NO**: core capture/UX works, but a set of on-hardware findings (sub-60 s recordings not deleted; <5 % battery start-guard doesn't fire; force-quit recover-toast missing + orphan not re-finalized; mid-record thermal abort unverified) need a fix round before Phase 4 is done. §4 phone-calls/alarm/storage edges not walked (owner call). See §6 for the full record + findings.

> Per `04-RESEARCH.md` § "Validation Architecture — Wave 0" + `04-CONTEXT.md` D-WAVE-04: **Phase 4 acceptance is module-ready (vitest suite green) + the practice E2E passing + the `idea-brief.md §10` lifecycle edges manually verified + the §5b drift figures measured & recorded.** The seven Phase 3 hardware-UAT items (`.planning/STATE.md` "Phase 3 hardware UAT pending") effectively RETIRE during this walk — the verifier should not separately re-block on them after Phase 4 closes.
>
> **§5b drift gate relaxed (owner, 2026-05-12).** §5b — the video↔IMU drift on the gate→record handoff / ultrawide recording path — is **no longer `[BLOCKING]`**. On-hardware it regressed badly (clean 10-min gate-pass segment: max 6.16 / mean 5.58 / p99 5.63 ms vs the Phase-3 smoke-7 baseline of 0.594 / 0.728 ms), almost certainly because the HEVC stream now records on the ultrawide via `CONTROL_ZOOM_RATIO` (heavy distortion-correction / fusion → CPU contention). Decision: keep computing & recording `imu_video_drift_{max,mean,p99}_ms` in every segment's metadata (fleet-health telemetry), don't gate anything on it, and don't change the ultrawide lens code. Full write-up: `ULTRAWIDE-DRIFT-FINDINGS.md` (repo root); the `CLAUDE.md` Core-Value line carries a banner.

**Operator:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Date:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Device:** Pixel 10a (5C161JEA304304) **Android version:** **\_\_\_\_**
(Secondary device, if walked: Pixel 7a / 8a — **\_\_\_\_** — `idea-brief.md` battery/thermal budget is the 7a-class baseline.)

> Throughout: the app package id for the `apkRollout` flavor is `ai.humynlabs.capture.apk` — every `adb shell run-as` below uses that. Run `adb logcat -c` before each section so the logcat greps match the latest run. The app NEVER runs CLI commands; the operator only visits screens, taps UI, evaluates visuals/audio/haptics, and runs the `adb` diagnostics quoted inline.
>
> **iOS is out of scope (Android-only MVP).** UP-08's iOS clause (`URLSessionConfiguration.background` + `sessionSendsLaunchEvents=true` + the multipart-complete POST inside `urlSessionDidFinishEvents`) is a **documented gap** — no `HumynUploadIOS` / iOS upload path ships; iOS is deferred to `REQUIREMENTS.md §v2` (IOS-01..07). See `.planning/runbooks/05-wave1-cleanup-smoke.md` §6. (The whole `apks` smoke runbook line is Android-only by design.)

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
- [ ] **RecordingScreen — rotate-prompt → ready (CR-01 regression check)** — on first entry the screen shows the `rotate-prompt` body (the `RotateCw` icon + "Rotate to landscape and mount on rig"); **physically rotate the phone to landscape** → the surface advances to `ready` (the 88×88 record button appears). **Do NOT** use the `__DEV__`-only "Pretend I rotated →" pill for this step. **⚠ The `apkRollout` _debug_ build ships `__DEV__ === true`**, which makes that pill visible and would mask the CR-01 release-build dead-end — for this step either (a) install a _release/staging_ `apkRollout` build (`cd apps/mobile/android && ./gradlew installApkRolloutRelease` — `__DEV__` false), or (b) on the debug build, deliberately ignore the pill and only count the _physical-rotation_ path as the pass. (If the device is already in landscape when RecordingScreen mounts — e.g. it was held landscape from PracticeIntro — the screen should land directly in `ready` with no `rotate-prompt` flash; that also counts as a pass for the fire-once `Orientation.getDeviceOrientation` read.)
- [ ] **RecordingScreen — pre-flight → ready** — the screen auto-rotates + locks to landscape (REC-01); the 3-second "Don't exit while recording." overlay shows then fades; the 88×88 record button is visible.
- [ ] Tap the **88×88 record button** → enters the **gate substate**: the 130×130 gate ring, the prompt "Mount the phone on your head and bring your hands in frame for 2 secs", and the **Skip** link visible from t=0 (HAND-07). (Brightness has NOT dropped yet — the drop happens on gate-pass.) Note: from the `'ready'` substate (once landscape) through the gate, a **live Camera2-fed camera preview (`<HumynGateCameraView>`)** is shown so the operator/helper can check rig placement + hands-in-frame before pressing Start (it's released before `HumynCapture.start()` opens its own session — one back-camera client at a time).
- [ ] **Bring 2 hands into frame on the rig** (head-mounted) → the ring fills over a **2 × 250 ms gate dwell** (2 consecutive 2-hand detections — HAND-03/04/11; the cadence/target/confidence are Firebase Remote Config keys with the `2 / 250 / 0.5` Android fallback).
- [ ] **Gate-pass** (passed, not skipped/bypassed) → in this exact order: a **120 ms vibrate** → **en-US female-leaning TTS "Recording started"** (owner deviation 2026-05-12 — `ttsVoice.ts`: `Tts.setDefaultLanguage('en-US')` baseline → an en-US female-ish voice → any en-US → first `en-*`; `idea-brief.md §13` / REC-14 mandated Indian-English female but that fallback sounded bad on the test device) + the **VoiceCue pill** text "Recording started" duplicated on-screen for accessibility (REC-15) → **screen dims to ~5%** brightness → the **active substate**: the 32-px mono **HH:MM:SS** timer counting up + the top minute-bar growing + the 64×64 white floating Stop button.
- [ ] Let it run to **~60 s** → at **exactly 60 s** the practice recording **auto-stops** (the JS-owned practice hard cap — `useRecordingLifecycle`, plan 04-08; NOT a 10-min segment cut) → voice **"Recording stopped"** → routes to **PracticeCompleteScreen** ("You got it.", confetti + scale-pop, `[40, 80, 40]` ms haptic — `04-UI-SPEC.md §8`).
- [ ] Tap **Continue** → routes to **Home** (the first-time hero variant).

**Assertions (run after the practice run completes):**

- [ ] The practice recording landed in `files/practice/` — `adb shell run-as ai.humynlabs.capture.apk ls files/practice/` shows a `{base}.mp4` (+ `.csv` + `.json`).
- [ ] The practice recording is **NOT in History** and does **NOT count toward contribution** (ONB-04) — re-launch the app, open History (Phase 6 stub) / check the Home contribution tile: the practice run is absent. Practice recordings are segregated by the `files/practice/` directory + `task_id: __practice__` — there is **NO `is_practice` field in the finalized `{base}.json`** (per D-08; the `.session.json` sidecar still carries `is_practice`). Confirm `files/practice/{base}.json` exists and `task_id` is `__practice__` — `adb shell run-as ai.humynlabs.capture.apk cat files/practice/{base}.json | python -m json.tool | grep -i task_id`.
- [ ] **Tutorial does not re-run** — fully restart the app (`adb shell am force-stop ai.humynlabs.capture.apk` then re-launch) → cold-start goes straight to Home; the RigTutorial / PracticeIntro do NOT re-appear (ONB-08, the per-Google-account flag persisted via `practiceDoneKey(sub)`).
- [ ] The hand-gate frame JPEGs are **gone** — `adb shell run-as ai.humynlabs.capture.apk ls cache/hand-gate/` is empty (the JPEGs were deleted on each gate-check resolve + the mount-time sweep — Security V8/V12).

**§2 Acceptance:** all transitions occur in order — including the **rotate-prompt → ready transition driven by a PHYSICAL rotation** (NOT the `__DEV__` pill; the debug-build `__DEV__ === true` caveat above applies — verify on a release/staging build or count only the physical-rotation path); practice landed in `files/practice/` with `task_id: __practice__` (no `is_practice` field in the finalized JSON — D-08), never appears in History/contribution; tutorial doesn't re-run; `cache/hand-gate/` is clean.

---

## §3 Non-practice recording via the `__DEV__` dev affordance (CAP-10 / REC-04..08 / spec-compliance — Phase-3 UAT #1/#2/#5/#6/#7 retire here)

- [ ] **Long-press (>800 ms)** the "Tasks — coming in Phase 6." heading on the **Tasks** tab → routes to **RecordingScreen** with `{ taskId: 'cooking_chop_vegetables', taskName: 'Practice — Chop vegetables', isPractice: false }` (the `__DEV__`-gated affordance from plan 04-08/04-09).
- [ ] Tap record → gate substate → bring 2 hands in frame → **gate-pass** (120 ms vibrate + en-US female-leaning TTS "Recording started" + brightness drop to ~5% + active substate) — same transition as §2.
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
- [ ] **`onSegmentStart` / `onSegmentComplete` RN-bridge events fire** (the upload-pause seam — log-only at Phase 4; Phase 5 wires the actual pause) — these are RN-bridge events delivered to `RecordingScreen`'s `segMetaRef` subscription, **NOT** native `adb logcat` lines; verify via the dev console / a temporary `Log.i` if a trace is wanted.

**§3 Acceptance:** the 10-min auto-segment cut is silent + the `start_gate` block is preserved; the Stop button stops directly while the X button shows the discard-warning modal; sub-60 s recordings are discarded with the documented toast and never persisted; a ≥60 s segment is spec-compliant (1080p/30/HEVC-Main/8 Mbps CBR/GOP 30/no-B); IMU ≥100 Hz; FGS type + KEEP_SCREEN_ON correct; on-disk SHA matches the metadata; the `onSegmentStart`/`onSegmentComplete` RN-bridge events fire.

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

## §5b video↔IMU drift re-measurement on the gate→record handoff / ultrawide recording — measure & record (NOT blocking)

**This section measures the video↔IMU drift on the Phase-4 capture path and records it; it does not pass/fail anything (owner, 2026-05-12 — see `ULTRAWIDE-DRIFT-FINDINGS.md`).** The pre-record hand-gate now runs on a native Camera2 path (the debug session `handgate-never-passes` replaced the original VisionCamera `<Camera>`); `RecordingScreen.tsx`'s `stopGate()` awaits a full session+device close before `HumynCapture.start()` opens Camera2 for the HEVC pipeline (the `SETTLE_MS = 80` margin sits on top of that). The bigger drift contributor turned out to be the recording stream itself running on the ultrawide via `CONTROL_ZOOM_RATIO` (not the handoff timing).

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

**Reference (not a gate):** the Phase-3 smoke-7 post-audio-unwire baseline was mean 0.594 ms / p99 0.728 ms; the LOCKED spec target is ±1 ms (`idea-brief.md` §2.1). On the Phase-4 ultrawide-recording path these figures regressed to the ~1.7–6.2 ms range — that is **expected and accepted** for now (owner, 2026-05-12). Just record what you measure; do not re-walk or escalate on the number. If we ever decide to drive drift back down, `ULTRAWIDE-DRIFT-FINDINGS.md` §3 lists the options (open the physical ultrawide by id; disable distortion correction; etc.) — all out of scope here, and audio is **NOT** re-introduced regardless.

**Note:** Phase 3's hardware-UAT item #3 (`imu_video_drift_{max,mean,p99}_ms` residual) retires here — these figures, recorded above, are the canonical Phase-4 drift evidence (telemetry, not a gate).

---

## §6 Sign-off

> **RE-WALK NOTES — 2026-05-12, Pixel 10a (5C161JEA304304), Android 16, operator Adnaan Mohammed (post `/gsd-debug phase4-smoke-fixes`).** Walked again after the fix round. **All four FINDINGS from the first walk are fixed + verified on hardware** (see below); a 5th bug found mid-fix — the **auto-segment cut deadlocked the session thread** (`openCameraSync` dispatched the camera `StateCallback` to the same `sessionHandler` it then blocked on inside `latch.await`; first-segment open worked because `start()` runs on the capture executor, but `rotateSegment` runs on `sessionHandler` → 2 s `camera_open_timeout` on every cut) — fixed (dedicated `HumynCapture-CameraCb` HandlerThread for camera callbacks) + verified (clean 2-segment auto-cut). Two cosmetic items (`start_gate.duration_ms`, `HumynGateCameraViewManager` warning) were fixed in the round. Two NEW follow-up items surfaced (alert-cue tones inaudible — almost certainly device media volume at ~3.6 %, not a code bug; device-distress stop leaves you on RecordingScreen-'ready' not Home) — filed to `04-COSMETIC-GAPS.md`, neither blocking. The deferred §4(a)/(b)/(c)/(h) (phone-calls/alarm/storage<5 GB) were again NOT walked — owner call, same as the first walk (the unit-test policy table + Phase-3 walks cover them). **Re-walk verdict: YES — Phase 4 is done.** Full trail: `.planning/debug/phase4-smoke-fixes.md`.
>
> **WALK NOTES — 2026-05-12, Pixel 10a (5C161JEA304304), Android 16, operator Adnaan Mohammed (first walk).** Walked post the `handgate-never-passes` debug-session fix (native Camera2 gate + ultrawide HEVC recording + VisionCamera removed). Two bugs found mid-walk in §2 were fixed in-walk (X-close nav, landscape-stick) + a PracticeIntro copy change; the rest were filed below. §4 was wrapped after the rotation/battery/force-quit edges (phone-calls/alarm/storage-fill NOT walked — owner call; the unit-test policy table + Phase-3 walks cover those). **First-walk verdict: NO** — needed the follow-up fix round (the filed findings). Core capture/UX worked (see the ✓ list).

**What PASSED:**

- [x] §1 pre-flight (device, debug build w/ `__DEV__`, DND off, charged, backend up, ffprobe/python).
- [x] §2 practice E2E — fresh install → onboarding → RigTutorial → PracticeIntro → Start practice → RecordingScreen → **physical rotate → ready** → record → **gate-PASS** (`passed:true`, 2 hits / 250 ms) → ~60 s auto-stop → PracticeComplete (confetti/pop/haptic — exercises reanimated 4 at runtime) → Continue → Home; `files/practice/` has the triple; `cache/hand-gate/` clean; `dfov_degrees` 115.4 (ultrawide). NOTE: no `is_practice` field in the metadata — practice is segregated by the `files/practice/` directory + `task_id:__practice__` (the old "verify `is_practice:true`" assertion is stale).
- [x] §3 non-practice — long-press dev affordance → RecordingScreen (`isPractice:false`, "Practice — Chop vegetables"); auto-segment cut (2-min, **silent**, `start_gate` block **identical** across the cut — CAP-10); Stop button stops **directly** (no modal); X button → **"Stop recording?"** modal w/ "Recordings under 1 minute are discarded." + Keep/Stop; X-close pre-record → Home, **no red error** (Bug-1 fix verified); landscape un-sticks after stop (Bug-2 fix verified). Spec-compliance on the ~2-min segment: `hevc`/`Main`/`1920×1080`/`r_frame_rate 179/6`(~29.83 fps)/`~7.78 Mbps` CBR/GOP 30/**0 B-frames**; IMU ~798 Hz (`imu_min_rate_hz_observed_p1:798`); on-disk mp4+csv SHAs **match** the metadata `file_sha256`/`imu_sha256` (CAP-18).
- [x] §3/§4 — FGS while recording: `HumynForegroundService` `isForeground=true`, `types=0x000000C1` = **`camera|microphone|dataSync`** ✓; `mHoldingDisplaySuspendBlocker=true` (screen won't sleep mid-capture).
- [x] §4(d) rotate-to-portrait mid-record → recording stops + toast "Recording stopped — keep the phone in landscape." + voice "Recording stopped".
- [x] §4(f) battery 15% → alert pill "Battery 15%" + 520 Hz beep + [100,50,100] ms haptic + voice "Battery low. Consider charging soon." → continues.
- [x] §4(g) battery 5% → recording ends immediately.
- [x] §4 DND untouched — `settings get global zen_mode` = 0 before AND after the walk (REC-09 ✓).
- [x] §5 pre-record thermal refuse — `cmd thermalservice override-status 3` (SEVERE) → tap record → refused, voice "Phone too warm", stays in Ready (no gate/recording).
- [x] §5b drift table filled in (below) — measure-only, **not a gate** (owner 2026-05-12; ultrawide-recording path; `ULTRAWIDE-DRIFT-FINDINGS.md`).
- [x] Phase-3 hardware-UAT #1/#2/#5/#6/#7 retire here (auto-segment integrity, spec-compliance, FGS+KEEP_SCREEN_ON, SHA round-trip — verified above). #3 (drift residual) retires here as telemetry. #4 (thermal abort) — see the finding below (unverified this walk).

**FINDINGS — first-walk (the §6 = NO reason) → ALL RESOLVED in the 2026-05-12 `/gsd-debug phase4-smoke-fixes` round + re-verified on hardware:**

1. **~~Sub-60 s recordings are NOT deleted from disk.~~ FIXED ✓.** `CaptureSession.stop()` now deletes the segment's mp4/csv/json/sidecar via `discardSegmentArtifacts()` when `segmentsCompleted == 0 && durationMs < 60_000` instead of running `FinalizeWorker` (a session that already auto-segmented keeps a trailing short segment — segments are independent units). Re-walk: X-modal → Stop on a ~45 s recording → "Recording too short — discarded." toast + `files/recordings/` empty ✓.
2. **~~<5 % battery start-guard doesn't fire.~~ FIXED ✓.** New `HumynBatteryModule.getCurrentLevel()` (synchronous sticky `ACTION_BATTERY_CHANGED` read) exposed via `HumynBattery.ts`; `useRecordingLifecycle.checkStartGuards()` now `await`s it on demand instead of the stale `lastBatteryLevelRef` (which is only populated by the `onBatteryChanged` subscription that mounts at the gate substate — i.e. after the guard runs). Re-walk: `dumpsys battery unplug && set status 3 && set level 4` → tap record → refused with "Battery too low to start a recording. Charge to at least 15%." toast, no gate/recording ✓.
3. **~~Force-quit recover-on-launch: toast doesn't show + orphan not re-finalized + old sidecars not swept.~~ FIXED ✓.** (a) New `HumynCaptureModule.getPendingRecovery()` (non-clearing) — `bootRecoveryListener.ts` queries it synchronously on boot AND keeps the legacy `onCrashRecovery` event, de-duped via a `delivered` flag; `App.tsx` moved `installBootRecoveryListener()` into a `useEffect` so `<ToastHost/>` is mounted first; toast duration bumped to 15 s so it survives the SplashScreen bootstrap (the original 5 s faded before Home — that was the actual bug; proper "defer to Home-mount" fix noted in `04-COSMETIC-GAPS.md`). (b)(c) `CaptureLaunchSweep` rewritten: orphan `.mp4` + valid sidecar → top-level ISO-BMFF box scan (`mp4LooksPlayable()` — `ftyp`+`moov`+≥1 `moof`, header-only) → if playable, SHA + compose `video_metadata.json` from the sidecar (degenerate drift/IMU — lost with the crash) + `writeAtomic` + delete sidecar → complete triple, "recovered"; if absent (the 778-byte pre-30 s-flush stub) → discard the triple (D-FS-04), NOT "recovered"; new Pass 3 deletes any lone `.session.json` with no matching `.mp4` (+ lone `.csv` residue). Re-walk: ~60 s recording → `am force-stop` → relaunch → Home toast "Recording recovered after force-quit — uploading." ✓ + orphan re-finalized into `{base}.{mp4,csv,json}` with on-disk SHAs matching the composed metadata, sidecar deleted ✓; a <30 s force-quit → stub discarded + sidecar deleted ✓; a lone `_002.session.json` swept on a later launch (`orphan_sidecar_no_mp4=…002 — deleting`) ✓.
4. **~~Mid-record thermal abort unverified / possibly broken.~~ FIXED ✓.** `CaptureSession` adds a 5 s thermal poll on the session HandlerThread + `onThermalEscalation(status)` single chokepoint used by BOTH the OS `OnThermalStatusChangedListener` AND the poll, de-duped via `@Volatile thermalAbortFired` (emits `onThermalAbort` once, posts the 2.5 s graceful self-stop). Re-walk: `cmd thermalservice override-status 4` mid-record → "Phone too hot" pill + 800 ms vibrate + voice "Phone too hot, stopping recording" + graceful self-stop within ~2.5 s + "Recording stopped — phone needs to cool." toast ✓ (logcat: `onThermalEscalation(status=4)` → 2.5 s delayed `stop()`). The descending tone sequence didn't play — device media volume artifact, see `04-COSMETIC-GAPS.md`. (The async OS listener actually delivered the override callback this run; the 5 s poll is the belt-and-suspenders backup.)
5. **~~Cosmetic / metadata nits~~** — `start_gate.duration_ms` bogus and the `HumynGateCameraViewManager` prop-setter warning were both fixed in the round (see `04-COSMETIC-GAPS.md` for details + the new follow-up items). The rotate-prompt glyph eyeball + the §2/§3-stale-text refresh were folded into **Plan 05-02 (Wave 1, D-09)** — done: this file's §2/§3 now say 120 ms / en-US female / 2 × 250 ms gate dwell / live `<HumynGateCameraView>` preview / `onSegmentStart`/`onSegmentComplete` RN-bridge events (not `onSessionStart/Stop` logcat lines) / no `is_practice` in the finalized JSON (D-08); the rotate-prompt glyph check lives in `.planning/runbooks/05-wave1-cleanup-smoke.md` §5.

**BONUS BUG found+fixed mid-round (not in the first-walk findings):** the auto-segment cut deadlocked — `openCameraSync` / `openCaptureSession` dispatched the Camera2 `StateCallback` onto `sessionHandler` and then `latch.await`ed; for the FIRST segment that's fine (`start()` runs on the capture executor), but `rotateSegment()` runs on `sessionHandler` itself → the callback post sat behind the blocked `await` on the same looper → 2 s `camera_open_timeout` + `onError(rotate_failed)` on every auto-cut. Fixed: a dedicated `HumynCapture-CameraCb` HandlerThread for the camera-framework callbacks. Re-walk: ~3½ min recording → clean SILENT ~2-min auto-cut (no `onError`, camera re-opened for seg 2 in ~0.8 s) → two consecutive triples with **identical `start_gate` blocks** (`duration_ms: 1943` — a sane value; the cosmetic fix works too) → CAP-09/CAP-10 ✓.

**NOT walked this session** (owner call — wrap §4 early; Phase-3 walks + the unit-test policy table cover them): §4(a)/(b) phone-call answered/declined → stop/continue; §4(c) alarm → stop; §4(h) storage <5 GB → refuse-to-start. To be picked up in a re-walk after the fix round.

**Recorded §5b drift figures** (post-fresh-install ≥60 s segments; ALL >±1 ms — ultrawide-recording path, not a gate): seg1 (`_021201_003`, 120.7 s, skip) max **2.603** / mean **2.384** / p99 **2.427** ms · seg2 (`_022525_007`, 111.3 s, skip) max **63.59** / mean **22.27** / p99 **60.65** ms _(anomalous — likely a glitch on that recording; the ~2 ms ones are typical)_ · seg3 (`_022811_008`, 61.0 s, skip) max **2.081** / mean **1.758** / p99 **1.781** ms. (Also: debug-session 10-min gate-pass segment earlier ran 6.16 / 5.58 / 5.63 ms; the §2 60-s practice gate-pass ran 12.63 / 3.05 / 12.58 ms.) Per `idea-brief.md §2.1` the LOCKED target is ±1 ms; relaxed to measure-and-record 2026-05-12 (`CLAUDE.md` drift banner / `ULTRAWIDE-DRIFT-FINDINGS.md`).

| Segment                        | `imu_video_drift_max_ms` | `imu_video_drift_mean_ms` | `imu_video_drift_p99_ms` |
| ------------------------------ | ------------------------ | ------------------------- | ------------------------ |
| seg 1 (`_021201_003`, 120.7 s) | 2.603                    | 2.384                     | 2.427                    |
| seg 2 (`_022525_007`, 111.3 s) | 63.593                   | 22.267                    | 60.652                   |
| seg 3 (`_022811_008`, 61.0 s)  | 2.081                    | 1.758                     | 1.781                    |

Operator signature: **Adnaan Mohammed**

Smoke-walked-on: **2026-05-12** on Pixel 10a (5C161JEA304304), Android 16.

re-walked-on: **2026-05-12** on Pixel 10a (5C161JEA304304), Android 16, after the `/gsd-debug phase4-smoke-fixes` round (findings 1–4 + the auto-segment-rotate deadlock fixed & re-verified on hardware; the §5b drift figures re-recorded — see the table above for first-walk values and the RE-WALK NOTES / `.planning/debug/phase4-smoke-fixes.md` for the re-walk values: seg1 `_130130_001` 9.249/2.686/9.106 ms · seg2 `_130331_002` 5.919/4.900/5.806 ms — recorded, not gated). The deferred §4(a)/(b)/(c)/(h) edges were again not walked (owner call).

Approved? **YES** (re-walk verdict, 2026-05-12) — the four first-walk findings are fixed + verified on hardware, the auto-segment deadlock found mid-fix is fixed + verified, §3 (spec-compliance / SHA / discard / auto-segment / preserved start_gate) and the on-hardware-walkable §4/§5 edges all pass; the new follow-up items (alert-cue tones inaudible — almost certainly device media volume; device-distress stop leaves you on RecordingScreen-'ready') are non-blocking and filed to `04-COSMETIC-GAPS.md`. (First-walk verdict was NO — superseded.) §5b drift is recorded, not a gate.

Trail: `.planning/debug/phase4-smoke-fixes.md` (status: resolved) — the `/gsd-debug` fix round + re-walk. The debug session this walk originally resumed (`handgate-never-passes`) is separately resolved.

---

## §7 Amendments protocol (D-WAVE-09 pattern)

New **cosmetic** gaps surfaced during this smoke walk (visual nits, copy tweaks, spacing) go into a NEW file:

`.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-COSMETIC-GAPS.md` (create it on first use).

They are picked up either by Phase 5's plan-phase (it may roll them into an early plan) OR by a dedicated Wave-5 fix-up plan before Phase 5 starts — per memory `feedback_functionality_first_during_smoke.md` (do NOT rebuild mid-smoke; defer cosmetics to a later cleanup wave).

**Never** write Phase-4 amendments back into the FROZEN `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md` or `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` — those are closed.

Functional regressions (broken behavior, spec violations) are NOT cosmetic — they block §6 sign-off and get a debug session (`/gsd-debug`), not an amendment-file entry.
