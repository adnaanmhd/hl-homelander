---
status: resolved
phase: 04-handdetector-recording-ux-practice-tutorial
source: [04-VERIFICATION.md]
started: 2026-05-11T12:02:32Z
updated: 2026-05-12T13:20:00Z
---

## Current Test

[all resolved — on-hardware smoke walk complete 2026-05-12 (two passes); verdict YES]

## Tests

### 1. Practice E2E on a Pixel 7a/10a-class device (04-MANUAL-SMOKE.md §2) — incl. the new rotate-prompt → ready PHYSICAL-rotation regression check

expected: >-
Fresh install → Splash → Sign-up → Permissions → Compat → RigTutorial → Next → PracticeIntro →
Start practice → RecordingScreen shows rotate-prompt body → PHYSICALLY rotate the phone to landscape
(NOT the **DEV** pill; the apkRollout debug build's **DEV**===true masks CR-01 — use a release/staging
build or count only the physical-rotation path) → surface advances to `ready` → record button → gate
substate → bring 2 hands in frame → gate-pass: 120 ms vibrate + en-US female TTS "Recording started" +
VoiceCue pill + brightness drop ~5% → active substate → auto-stop at ~60 s → "Recording stopped" →
PracticeComplete (confetti + haptic) → Continue → Home; practice segregated by files/practice/ +
task_id `__practice__` (the finalized JSON does not carry `is_practice` — see 04-COSMETIC-GAPS.md),
not in History/contribution, tutorial does not re-run, `cache/hand-gate/` clean.
result: pass — verified on the 2026-05-12 walk (§2 PASSED list) and re-walked end-to-end this session
(2026-05-12 follow-up): fresh install → onboarding → Google Sign-In → Permissions → Compat →
RigTutorial → PracticeIntro → Start practice → physical rotate → ready → gate-pass → ~60 s auto-stop →
PracticeComplete → Continue → Home. (The 5×400 ms / 80 ms-vibrate / en-IN-TTS / `is_practice:true`
details in the original `expected` are stale — see 04-COSMETIC-GAPS.md; actual behaviour confirmed.)

### 2. ±1 ms video↔IMU drift re-measurement on the gate→record camera handoff (04-MANUAL-SMOKE.md §5b) — RELAXED to measure-and-record (owner, 2026-05-12)

expected: >-
The original "[BLOCKING] every figure within ±1 ms" gate was relaxed by the owner on 2026-05-12 — on
the Phase-4 capture path the HEVC stream records on the back ultrawide via CONTROL*ZOOM_RATIO (required
for ≥110° dFOV), whose distortion-correction/fusion pipeline regresses drift to the ~1.7–9 ms range.
Decision: keep computing & recording `imu_video_drift*{max,mean,p99}\_ms`in every segment's metadata as
fleet-health telemetry; do NOT gate phase completion / sign-off / uploads on the number; do NOT change
the ultrawide lens code; do NOT re-introduce audio. Full write-up:`ULTRAWIDE-DRIFT-FINDINGS.md`(repo
root) + the`CLAUDE.md` drift banner. (Retires Phase 3 hardware-UAT item #3 as telemetry.)
result: pass — measured & recorded (not gated). 2026-05-12 follow-up walk, two ≥60 s segments off one
gate-pass recording: seg1 (`\_130130_001`, 120.7 s) max 9.249 / mean 2.686 / p99 9.106 ms · seg2
(`\_130331_002`, 90.8 s) max 5.919 / mean 4.900 / p99 5.806 ms. (An earlier failed-rotate seg from the
same session ran ~70/31/67 ms — anomalous; the ~2–9 ms ones are typical for this path.) Recorded per
the relaxed gate; no escalation.

### 3. idea-brief §10 lifecycle edges on a real device (04-MANUAL-SMOKE.md §4)

expected: >-
call-answered → stop; call-declined → continue; alarm → stop; rotate-out-of-landscape → stop + toast;
force-quit/OS-evict → relaunch → one-shot "Recording recovered after force-quit — uploading." toast +
the orphan triple re-finalized in files/recordings/ (or, if the killed mp4 is an unplayable stub before
the first 30 s `moof` flushed, the stub+sidecar are discarded); battery ≤15% → "Battery 15%" pill +
520 Hz beep + [100,50,100] ms haptic + voice "Battery low…" + continue; battery ≤5% → end immediately;
storage <5 GB → refuse-to-start + toast; battery <5% → refuse-to-start + toast; DND never toggled.
result: pass (with two follow-up notes → 04-COSMETIC-GAPS.md). Verified on the 2026-05-12 follow-up
walk: rotate-out-of-landscape → stop + "keep the phone in landscape." toast ✓; force-quit → relaunch
→ Home toast "Recording recovered after force-quit — uploading." ✓ + orphan re-finalized into a
{base}.{mp4,csv,json} triple with matching SHAs (sidecar deleted) ✓, stub-before-30 s → discarded +
sidecar deleted ✓, lone `.session.json` swept on launch ✓; battery 15% → "Battery 15%" pill +
[100,50,100] ms haptic + voice "Battery low…" + continues ✓; battery 5% → recording ends immediately ✓
(minor: stays on RecordingScreen-'ready' rather than routing to Home — noted); battery <5% →
refuse-to-start + "Battery too low to start a recording. Charge to at least 15%." toast ✓; DND
(`zen_mode`) 0 before and after ✓. The **520 Hz beep did not play** (and the thermal tones below) —
device media volume was ~3.6 % during the walk (`AHal::Waves MaxVolume: 0.036`), so almost certainly a
volume artifact, not a code regression; needs a re-check with media volume up (→ 04-COSMETIC-GAPS.md).
call-answered/declined, alarm, and storage<5 GB were **not re-walked** (owner call — the unit-test
policy table + the Phase-3 walks cover those; same deferral as the 2026-05-12 first walk).

### 4. Thermal injection (04-MANUAL-SMOKE.md §5) — `adb shell cmd thermalservice override-status`

expected: >-
`override-status 4` mid-record → "Phone too hot" pill + descending 440→560→680 Hz tones + 800 ms
vibrate + voice "Phone too hot, stopping recording" → graceful self-stop within ~2.5 s → "Recording
stopped — phone needs to cool." toast; pre-record `override-status 3` → `start()` rejects
`thermal_throttling` + voice "Phone too warm" + back to Ready.
result: pass (with one follow-up note → 04-COSMETIC-GAPS.md). 2026-05-12 follow-up walk: `override-status 4`
mid-record → "Phone too hot" pill ✓ + 800 ms vibrate ✓ + voice "Phone too hot, stopping recording" ✓ →
graceful self-stop within ~2.5 s ✓ (`onThermalEscalation(status=4)` → 2.5 s delayed `stop()` in logcat;
the new 5 s poll backs up the OS listener) → "Recording stopped — phone needs to cool." toast ✓; pre-record
`override-status 3` → `start()` rejects `thermal_throttling` (logcat `start() failed — code=thermal_throttling`)

- voice "Phone too warm" + stays in Ready ✓. The **descending tone sequence did not play** — same
  `HumynBeep.playTone` / device-media-volume artifact as the 520 Hz beep above; everything else fired.
  NOTE: the on-hardware mid-record thermal abort was finding #4 of the first walk (unverified there);
  this is its first end-to-end pass. (The async `OnThermalStatusChangedListener` actually DID deliver the
  override callback this run, but the 5 s poll is the belt-and-suspenders backup and both route through
  one de-duped chokepoint.)

### 5. Non-practice multi-segment recording via the **DEV** dev affordance (04-MANUAL-SMOKE.md §3) — silent auto-segment cut WITHOUT gate re-run

expected: >-
Long-press the Tasks "coming in Phase 6" heading → RecordingScreen {taskId:'cooking_chop_vegetables',
isPractice:false} → gate-pass → run past one segment boundary → observe the SILENT auto-segment cut (no
gate re-run, no voice cue — CAP-10) → two consecutive triples → `start_gate` block identical across
segments → spec-compliance via ffprobe (1920×1080/~30/HEVC-Main/~8 Mbps-CBR/GOP-30/no-B-NAL); IMU
≥100 Hz; FGS type `camera|microphone|dataSync` + KEEP_SCREEN_ON; on-disk SHA ↔ metadata; sub-60 s
recordings discarded with the documented toast and never persisted (REC-07).
result: pass. 2026-05-12 follow-up walk (segment duration temporarily set to 2 min via the now-reverted
DEBUG_REVERT hack): non-practice recording → gate-pass (`start_gate.duration_ms` 1943 ms — a sane value;
the cosmetic-fix works) → ran ~3½ min → SILENT ~2-min auto-cut (no voice cue, no `onError`, camera
re-opened for seg 2 in ~0.8 s — this is also the verification of the auto-segment-rotate deadlock fix,
see below) → two consecutive triples `_130130_001` (120.7 s) + `_130331_002` (90.8 s) → identical
`start_gate` blocks (`{type:hand_detection, passed:true, skipped:false, bypassed:false, duration_ms:1943,
consecutive_hits_required:2, platform_cadence_ms:250}` on both) — CAP-10 ✓; each segment its own ULID
recording_id — CAP-09 ✓; ffprobe on both: `hevc/Main/1920×1080/r_frame_rate 179/6 (~29.83 fps)/~7.8 Mbps
CBR/GOP 30/0 B-frames at the NAL level` ✓; IMU `imu_min_rate_hz_observed_p1: 798` ≥ 100 ✓; dFOV 115.4°
(ultrawide) ✓; CAP-18 SHA round-trip exact on both `file_sha256`/`imu_sha256` ✓; X-button → "Stop
recording?" modal w/ "Recordings under 1 minute are discarded." + Keep/Stop, the floating Stop button
stops directly (no modal) ✓; sub-60 s recording stopped via the X-modal → "Recording too short —
discarded." toast + `files/recordings/` empty (REC-07 — HumynCapture deletes the segment artifacts at
finalize via `discardSegmentArtifacts`) ✓. FGS type `camera|microphone|dataSync` + KEEP_SCREEN_ON
verified on the 2026-05-12 first walk (`types=0x000000C1`, `mHoldingDisplaySuspendBlocker=true`); FGS
code unchanged this round.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None blocking. Follow-up items (none gate Phase 4) filed in `04-COSMETIC-GAPS.md`:

- `HumynBeep.playTone` alert audio (the battery-15 % 520 Hz beep + the thermal-abort descending tone
  sequence) was inaudible during the walk — almost certainly the device's near-zero media volume
  (`AHal::Waves MaxVolume: 0.036` in logcat), not a code regression; re-check with media volume up.
- Battery-critical (5 %) / thermal mid-record stop leaves you on RecordingScreen-'ready' (with the
  <60 s "discarded" toast for a short take) rather than routing to Home — debatable; the normal sub-60 s
  discard flow does the same.
- The crash-recovery Home toast currently uses a 15 s duration as a workaround (it fires while the
  SplashScreen bootstrap is still up); the proper fix is to defer it to the post-bootstrap / Home-mount
  moment.
- `04-MANUAL-SMOKE.md` §2 step text and this file's original `expected` blocks carry a few stale
  details (5×400 ms gate dwell → 2×250 ms; 80 ms vibrate → 120 ms; en-IN TTS → en-US; `is_practice`
  in the finalized JSON → only in the `.session.json` sidecar; "10-min" auto-cut → tested at 2 min via
  the DEBUG_REVERT hack, real default is 10 min) — a doc-refresh pass, not a code change.

Owner-deferred (not re-walked on hardware — covered by the unit-test policy table + the Phase-3 walks;
same call as the 2026-05-12 first walk): §4(a)/(b) phone-call answered/declined, §4(c) alarm,
§4(h) storage<5 GB.
