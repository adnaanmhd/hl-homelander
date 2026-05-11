---
status: partial
phase: 04-handdetector-recording-ux-practice-tutorial
source: [04-VERIFICATION.md]
started: 2026-05-11T12:02:32Z
updated: 2026-05-11T12:02:32Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Practice E2E on a Pixel 7a/10a-class device (04-MANUAL-SMOKE.md §2) — incl. the new rotate-prompt → ready PHYSICAL-rotation regression check

expected: >-
Fresh install → Splash → Sign-up → Permissions → Compat → RigTutorial → Next → PracticeIntro →
Start practice → RecordingScreen shows rotate-prompt body → PHYSICALLY rotate the phone to landscape
(NOT the **DEV** pill; the apkRollout debug build's **DEV**===true masks CR-01 — use a release/staging
build or count only the physical-rotation path) → surface advances to `ready` (88×88 record button) →
record button → gate substate (130×130 ring + prompt + Skip from t=0) → bring 2 hands in frame → ring
fills over ~5×400 ms (or the RemoteConfig values) → gate-pass: 80 ms vibrate + en-IN female TTS
"Recording started" + VoiceCue pill + brightness drop ~5% → active substate (32 px mono timer +
minute-bar + 64×64 Stop) → auto-stop at exactly 60 s → "Recording stopped" → PracticeComplete
(confetti + [40,80,40] ms haptic) → Continue → Home first-time hero; metadata `is_practice:true`, in
files/practice/, not in History/contribution, tutorial does not re-run, `cache/hand-gate/` clean.
result: [pending]

### 2. [BLOCKING] ±1 ms video↔IMU drift re-measurement on the gate→record camera handoff (04-MANUAL-SMOKE.md §5b)

expected: >-
Record a non-practice recording started THROUGH the hand-gate; read `imu_video_drift_{max,mean,p99}_ms`
from the first 2-3 segments' metadata JSON; every figure within ±1 ms AND no regression past Phase 3
smoke 7 (mean 0.594 ms / p99 0.728 ms). If it regresses → Phase-4 BLOCKER: first bump `SETTLE_MS` in
`RecordingScreen.tsx` and re-walk, then escalate a "HumynCapture.start() polls for camera availability
before opening Camera2" change to Phase 3 — never re-introduce audio. (Retires Phase 3 hardware-UAT
item #3 — D-WAVE-04.)
result: [pending]

### 3. idea-brief §10 lifecycle edges on a real device (04-MANUAL-SMOKE.md §4) — incl. the WR-04 first-tone-audible check

expected: >-
call-answered → stop; call-declined → continue; alarm → stop; rotate-out-of-landscape → stop + toast;
force-quit/OS-evict → relaunch → one-shot "Recording recovered after force-quit — uploading." toast +
the orphan triple in files/recordings/; battery ≤15% → "Battery 15%" pill + 520 Hz beep (FIRST fire
audible — confirms the WR-04 SoundPool fix on hardware) + [100,50,100] ms haptic + voice "Battery
low…" + continue; battery ≤5% → end immediately; storage <5 GB → refuse-to-start + toast; battery
<5% → refuse-to-start + toast; DND never programmatically toggled.
result: [pending]

### 4. Thermal injection (04-MANUAL-SMOKE.md §5) — `adb shell cmd thermalservice override-status`

expected: >-
`override-status 4` mid-record → "Phone too hot" pill + descending 440→560→680 Hz tones (FIRST tone
audible — WR-04) + 800 ms vibrate + voice "Phone too hot, stopping recording" → graceful self-stop
within ~2.5 s → "Recording stopped — phone needs to cool." toast; pre-record `override-status 3` →
`start()` rejects `thermal_throttling` + voice "Phone too warm" + back to Ready.
result: [pending]

### 5. Non-practice 10-min recording via the **DEV** dev affordance (04-MANUAL-SMOKE.md §3) — silent 10-min auto-segment cut WITHOUT gate re-run

expected: >-
Long-press the Tasks "coming in Phase 6" heading → RecordingScreen {taskId:'cooking_chop_vegetables',
isPractice:false} → gate-pass → run ~10+ min → observe the SILENT 10-min auto-segment cut (no gate
re-run, no voice cue — CAP-10) → two consecutive triples ~0.5 s apart → `start_gate` block identical
across segments → spec-compliance via ffprobe (1920×1080/30/HEVC-Main/8 Mbps-CBR/GOP-30/no-B-NAL);
IMU ≥100 Hz; FGS type `camera|microphone|dataSync` + KEEP_SCREEN_ON; on-disk SHA ↔ metadata. Also
confirms the WR-03 unmount-during-gate-poll no-crash path on hardware.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
