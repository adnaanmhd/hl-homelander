---
status: partial
phase: 03-humyn-capture-native-module
source: [03-VERIFICATION.md]
started: 2026-05-11T00:31:07Z
updated: 2026-05-11T01:56:13Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 10-min HEVC capture on real Pixel 7a/8a — verify output MP4 honors locked spec

expected: ffprobe + NAL parser confirm 1920x1080 / 30 FPS / HEVC Main / 8 Mbps CBR / GOP 30 / no B-frames / 8-bit YUV 4:2:0 / no HDR / no OIS; fragmented MP4 with moov flush every 30 s; sidecar IMU CSV sustains ≥100 Hz floor; 48 kHz mono AAC-LC 128 kbps audio track present; zero frame drops
result: [pending]

### 2. 25-min continuous capture auto-segment integrity on Pixel 7a/8a

expected: Three sibling segment triples (MP4 + CSV + JSON) produced at ~10 / ~20 minute marks with ~0.5 s gap between them; each owns its own ULID recording_id with NO parent_recording_id linkage; filenames follow YYYYMMDD_HHMMSS_NNN.<ext> with the same base across the three sibling files; no segment drops
result: [pending]

### 3. imu*video_drift*{max,mean,p99}\_ms residual-subtraction on real Pixel 7a/8a 10-min segment

expected: Per-segment metadata JSON records all three drift figures as decimals (e.g., max ≈ 0.7 ms, mean ≈ 0.18 ms, p99 ≈ 0.5 ms per idea-brief.md §6.5 example); imu_min_rate_hz_observed_p1 ≥ 80.0 (above the rejection floor)
result: [pending]

### 4. Pre-record + mid-record thermal handling on real device

expected: Pre-record — induce ≥THROTTLING via prolonged camera load; start() rejects with code 'thermal_throttling'; toast "Phone is too warm. Let it cool before recording." visible. Mid-record — induce ≥THROTTLING_SEVERE; segment ends cleanly within ~2.5 s; onThermalAbort + onSessionStop events fire; metadata JSON written for the truncated segment.
result: [pending]

### 5. Foreground service runs as camera|microphone|dataSync with KEEP_SCREEN_ON during a real capture

expected: `adb shell dumpsys activity services | grep ai.humynlabs.capture.fgs.HumynForegroundService` shows `fgservicetype=camera|microphone|dataSync`; the "Recording in progress" notification is non-dismissible; KEEP_SCREEN_ON window flag observable via `adb shell dumpsys window | grep -i keepscreenon`
result: [pending]

### 6. Byte-for-byte file fidelity from device to S3 (CAP-18) — round-trip SHA verification

expected: After 10-min capture on Pixel 7a/8a — `adb pull` MP4, compute SHA-256 locally, compare to `file_sha256` stamped in the metadata JSON. Both SHAs must match exactly. Repeat for IMU CSV vs `imu_sha256`.
result: [pending]

### 7. Pause uploads on record start / resume on stop (CAP-13) — Phase 5 seam

expected: HumynCapture emits onSessionStart and onSessionStop events; HumynForegroundService.setUploadActive seam is callable. Phase 5 owns the JS-side upload-pause handler wiring.
result: [pending]

### 8. 03-REVIEW.md blocker review — operator decision on whether to fix in Phase 3 or carry into Phase 4

expected: Operator reviews 03-REVIEW.md's 7 BLOCKER findings (CR-01..CR-07) — concurrent ArrayList in CaptureSession, FGS START_STICKY misuse, rotateSegment swallowed exceptions, pump-loop close-ordering race, cleanupAfterPreFlightFailure ordering bug, errorCodeFor dead branch + fragile string matching, MetadataComposer.writeAtomic non-atomic fallback. Decide whether each is fixed-in-Phase-3 or carried-into-Phase-4 alongside the on-device smoke walk.
result: passed
evidence: Operator decision = fix-in-Phase-3 for all 7. CR-01 → 7a89585 (CopyOnWriteArrayList), CR-02 → 971c557 (START_NOT_STICKY), CR-03/04/05 → 857f9ac (segment lifecycle hardening), CR-06 → f945bc4 (writeAtomic via Files.move ATOMIC_MOVE), CR-07 → ef5059b (typed bridge exceptions). 14 WR-\* warnings additionally landed (WR-01..WR-14, commits 04c0542..11a3718).
resolved: 2026-05-11T01:56:13Z

### 9. Plan 03-04 Task 0 pre-flight stamp verification: 03-WAVE1-SMOKE.md `re-walked-on:` is present

expected: 03-WAVE1-SMOKE.md frontmatter / sign-off block carries `re-walked-on: 2026-05-10` (post-Plan-03-11 re-re-walk on Pixel 10a). Already confirmed via grep — stamp present.
result: passed
evidence: `re-walked-on: 2026-05-10` present at 03-WAVE1-SMOKE.md lines 7, 185, 202 (verified via grep 2026-05-11).
resolved: 2026-05-11T01:56:13Z

## Summary

total: 9
passed: 2
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
