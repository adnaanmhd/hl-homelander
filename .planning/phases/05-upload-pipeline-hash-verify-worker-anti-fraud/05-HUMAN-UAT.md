---
status: paused_pending_wave_1_5
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
source: [05-VERIFICATION.md]
started: 2026-05-12T16:46:52Z
updated: 2026-05-13T11:45:00Z
---

## Current Test

**On-device walk PAUSED 2026-05-13 afternoon — pending a Phase-5 Wave-1.5 batch fix-up.** Backend half of items 1+3 was walked 2026-05-13 morning by an automated probe against the dev stack (Postgres + Redis + LocalStack + the real hash-verify worker process) — `POST /recordings/init` → PUT parts to LocalStack → PUT `metadata.json` → `POST /recordings/:id/finalize` → (dev shim) `enqueueVerify` → the BullMQ worker re-hashed the S3 bytes → `recordings.qa_status='verified'` (+ `verified_at`) → `GET /me` carried `_events: [{recording_id, event_type:'verified'}]` and a second `GET /me` did NOT re-carry it (delivered). Hash-mismatch path: a recording that claimed a wrong `file_sha256` at `/init` → worker → `qa_status='hash-mismatch'` → `_events: [{…, event_type:'re-upload'}]` → `POST /recordings/:id/reupload` → row reset to `qa_status='pending'` with a fresh `s3UploadId` + `verified_at` cleared. Plus the Phase-5 gap-closure routes: a duplicate `POST /recordings/init` on a `pending` row → `200` with the SAME `uploadId` (CR-02 idempotent `/init` / lost-201 self-heal); `POST /recordings/:id/parts` → `200`, re-presigned video against the existing `uploadId`, row unchanged (CR-02 new re-presign route). `ip_address` server-populated (UP-18); `recordings_to_verify` drained on both verified + mismatch. **No backend findings.**

The on-device half (item 1's device leg + items 2–5) was attempted 2026-05-13 afternoon on a Pixel 10a (`5C161JEA304304`, Android 16) with the apkRollout build loaded from Metro. The attempt surfaced **five distinct root causes** for the same observable `POST /recordings/init → 400` symptom; the first three were fixed inline through three `/gsd-debug` sessions:

1. ✅ `debug-task-id-init-400` (commit `48dea49`) — `DEBUG_TEST_TASK.taskId` was the 23-char taxonomy slug `cooking_chop_vegetables`, failing `RecordingsInitRequestSchema.taskId = z.string().length(26)` and the `recordings.task_id → tasks.id` FK. Fix: dev-seed task at the fixed ULID `01HVDEVSEEDTASK00000000000`; `TasksPlaceholderScreen.tsx` `DEBUG_TEST_TASK.taskId` retargeted at it; runbook §1/§2 patched to call out the seed step + the `installApkRolloutDebug`-ships-`--dev false`-offline-bundle gotcha.
2. ✅ `init-400-capturedat-offset` (commit `692e295`) — Zod's default `.string().datetime()` rejects `+05:30` numeric offsets; the device's `MetadataComposer` emits local-time-with-offset for `start_timestamp`, which `UploadCoordinator.kt` forwards verbatim as `capturedAt`. Fix: `shared/types/src/recording.ts` relaxed three client-supplied datetime sites to `.datetime({ offset: true })`. Host-side `apps/api/scripts/repro-init-400.ts` proves before/after.
3. ✅ `init-400-no-idempotency-key` (commit `5c0b2d8`) — `apps/api/src/plugins/idempotency.ts` rejects every POST/PATCH lacking an `Idempotency-Key: <UUIDv4>` header (Phase 5 contract); the native `UploadCoordinator.authedJsonRequest()` only set `Authorization` + `Content-Type`. Fix: `UploadRow.idempotencyKey: String = UUID.randomUUID().toString()` minted at construction, persisted to `queue.json`, threaded through all four POST callers (init/reupload/parts/finalize) with a one-shot fromJson migration for legacy rows.

After all three fixes landed and `adb reverse tcp:4566 tcp:4566` was added (LocalStack tunnel — also a runbook §1 setup gap, see `05-COSMETIC-GAPS.md`), the next §2 attempt got nearly all the way through: `/init -> 201`, all 10 video parts PUT to S3 (etags captured in `queue.json`), `metadata.json` PUT, then **`/finalize -> 409`** because the third fix gave each `UploadRow` exactly ONE `idempotencyKey` and reused it across `/init`, `/parts`, `/finalize`, `/reupload`. The API's idempotency hook keys cache by `(user_id, key)` and treats a same-key/different-`(method, path, body)` as a conflict → 409 `idempotency-key-conflict`. So `/finalize`'s POST hit the cached init-201 by key, saw the request hashes differ, and returned 409 → 6 retries → DEAD_LETTER. A subsequent "Retry" tap also 409'd because server-side `/reupload` only accepts `qa_status='hash-mismatch'` (the canonical worker-flagged path, NOT a client-side dead-letter on a pending row); the runbook §3 sanity-check wording for client-side dead-letter Retry is wrong on the server contract.

Five total root causes (3 fixed inline + 2 outstanding) + adjacent cosmetic / setup gaps logged. Rather than continue patch-and-pray, owner decision is to **pause the §2 walk and batch-fix in a Phase-5 Wave-1.5 plan** before re-walking on a single coherent build. Full enumeration with fix recipes in `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md` under the new "Wave-1.5 follow-on items" section. Backend half stays VERIFIED — no backend regression today; the new functional issues are all in the native upload coordinator + the runbook's setup section.

## Tests

### 1. End-to-end upload (Pixel 7a/8a-class + dev backend) + the hash-mismatch path

expected: On a Pixel 7a/8a-class device with the dev backend up (Postgres + Redis + LocalStack + worker), record a ≥60 s task → the bundle (mp4 + IMU CSV + metadata.json) auto-enqueues; the Pending Uploads tile/screen shows "Uploading…" progressing, then the row drops once verified. Bundle lands in S3 (`aws --endpoint-url=http://localhost:4566 s3 ls s3://humyn-recordings-dev/recordings/`), the BullMQ hash-verify worker re-hashes, `recordings.qa_status='verified'`, the next authed API response carries `_events: [{recording_id, event_type:'verified'}]`, the local mp4+csv+json are deleted, the row disappears from the queue. Then corrupt the S3 object → hash-mismatch → `re-upload` event → re-upload-from-local → re-verify. Runbook: `.planning/runbooks/05-upload-smoke.md`.
result: [partial — backend half VERIFIED 2026-05-13 via automated probe (init → PUT to LocalStack → finalize → BullMQ hash-verify worker → qa_status='verified' + verified_at → `_events: verified` → 2nd call doesn't re-carry; hash-mismatch → `_events: re-upload` → `/reupload` row-reset; + CR-02 idempotent `/init` returning the same uploadId + `/parts` re-presign; ip_address server-populated; recordings_to_verify drained — no findings). On-device half PENDING: record on real Pixel 7a/8a-class hardware, FGS survival through background+force-quit, local mp4/csv/json delete via HumynUpload.clearVerified, app-relaunch reconciliation sweep.]

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
