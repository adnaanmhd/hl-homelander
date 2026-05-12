---
status: partial
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
source: [05-VERIFICATION.md]
started: 2026-05-12T16:46:52Z
updated: 2026-05-12T16:46:52Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end upload (Pixel 7a/8a-class + dev backend) + the hash-mismatch path

expected: On a Pixel 7a/8a-class device with the dev backend up (Postgres + Redis + LocalStack + worker), record a ≥60 s task → the bundle (mp4 + IMU CSV + metadata.json) auto-enqueues; the Pending Uploads tile/screen shows "Uploading…" progressing, then the row drops once verified. Bundle lands in S3 (`aws --endpoint-url=http://localhost:4566 s3 ls s3://humyn-recordings-dev/recordings/`), the BullMQ hash-verify worker re-hashes, `recordings.qa_status='verified'`, the next authed API response carries `_events: [{recording_id, event_type:'verified'}]`, the local mp4+csv+json are deleted, the row disappears from the queue. Then corrupt the S3 object → hash-mismatch → `re-upload` event → re-upload-from-local → re-verify. Runbook: `.planning/runbooks/05-upload-smoke.md` (authored, not yet walked).
result: [pending]

### 2. Force-quit / OS-evict recovery + Android-14 FGS type downgrade + Android-15 UIDT onTimeout handoff

expected: Force-quit / OS-evict the app mid-upload on Android, then relaunch → the upload resumes from the persisted per-part state via `POST /recordings/:id/parts` (re-presign against the existing `uploadId`; already-DONE parts keep their ETags, not re-PUT) and eventually completes + verifies. Background the app for >5 min → the FGS type downgrades `camera|microphone|dataSync` → `dataSync` → stops after 5 min idle; the FGS notification flips from "Recording in progress" (camera/mic privacy indicators) to "Uploading recordings…" (indicators gone) then disappears after 5 min idle. On Android 15, the `dataSync` 6-h `onTimeout` hands off to the UIDT `UploadJobService` which picks up true-background work past the 6-h cap. (The CR-01/CR-03 defects that previously made a mid-upload process-kill leave the row stuck are now fixed in code — this test confirms the fix holds on-device.)
result: [pending]

### 3. OEM battery-optimization deep-links (Xiaomi/Oppo/Vivo/Samsung) + the AOSP fallback

expected: On a Xiaomi (MIUI) / Oppo (ColorOS) / Vivo (FunTouch) / Samsung (OneUI) device — or the AOSP fallback on a Pixel — trigger the first-upload `BatteryOptimizationScreen`. The "Open Autostart settings" button appears only when an OEM component resolves and launches it; the AOSP `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` exemption button always works; the standalone fallback line is always shown; the per-vendor steps match `help-center-content.md`.
result: [pending]

### 4. CGNAT-cellular MSS clamp + the 30 s no-progress watchdog

expected: On a CGNAT cellular link (Jio / Vivo Brasil), upload a multi-hundred-MB MP4. A stalled part transfer is abandoned within ~30 s (the no-progress watchdog cancels the stalled OkHttp Call) and retried on a fresh socket without restarting the whole file; the upload eventually completes over the bad link. Check logcat for whether the `TCP_MAXSEG=1280` `MssSocketFactory` clamp takes or no-ops.
result: [pending]

### 5. Wave-1 cleanup on hardware (force-quit fragment discard, device-distress→Home nav, alert-cue audibility, RotatePrompt glyph legibility)

expected: Per `.planning/runbooks/05-wave1-cleanup-smoke.md` (authored, not yet walked) — D-03: a force-quit mid-record leaves only crash-truncated fragments and `CaptureLaunchSweep` discards ALL of them (no re-finalized stub recording appears in History). D-05: a mid-record device-distress stop (battery ≤5% / thermal abort) navigates to Home, not the RecordingScreen "ready" substate. D-06: the recording alert cues are audible on the device speaker at the en-US female-leaning voice. D-09: the RotatePrompt portrait-phone glyph is legible. The crash-recovery toast shows for 5 s (not the 15 s workaround).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
