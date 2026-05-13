---
status: fix_applied_awaiting_on_device_verify
trigger: 'Phase 5 UAT Item 1 §3 hash-mismatch walk surfaced a Wave-1.5 incomplete-loop defect. The server-side hash-mismatch path is healthy end-to-end (worker flips `qa_status: uploaded → hash-mismatch`, outbox `re-upload` event delivered, `HumynUpload.reupload()` Path-A full-reset taken, drainer `postReupload` branch, server `POST /reupload` 200 with fresh `s3_upload_id`, all 9 video parts + 1 IMU part + metadata.json re-PUT to LocalStack against the new uploadId) but the post-reupload `POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize` returns **409 idempotency-key-conflict in 4 ms** (pre-S3, pre-DB-mutation). Root cause already isolated by inspection: `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt:316-328` (the `else ->` Path-A full-reset branch of `@ReactMethod fun reupload(recordingId, promise)`) resets `row.state / row.uploadId / row.imuUploadId / row.metadataPut / row.videoParts.{status,etag,retryCount} / row.imuParts.{status,etag,retryCount} / row.deadLetterReason / row.reupload` but does NOT rotate the three reusable per-route idempotency keys (`row.initIdempotencyKey`, `row.partsIdempotencyKey`, `row.finalizeIdempotencyKey`). Wave-1.5 Plan 05-14 Item 1 split the keys per-route within ONE upload session (closing cross-route 409s) but missed the rotation at the hash-mismatch boundary — the §2-original `finalizeIdempotencyKey="ee0bced9-c472-4a9f-8834-f4522121ac96"` is reused for the §3-post-reupload `/finalize` against a different `(uploadId, parts)` body → server`s `idempotency_keys (user_id, key)` cache (correctly) rejects with 409 `idempotency-key-conflict`. Minimal fix: three `UUID.randomUUID().toString()` assignments inside the `else ->` branch, parallel to the existing reset lines. Phase 5 UAT Item 1 cannot pass §3 (and thus cannot sign off) without this fix. Evidence preserved on-device + in S3 + DB at recording `01KRGB97X3MPJ784QF78SD77NJ`. Build: apkRollout-Debug HEAD `e5ff29b` (now `a326713` after the §3 finding commit). Device: Pixel 10a (5C161JEA304304, Android 16). Dev stack: humyn-postgres + humyn-redis + humyn-localstack all healthy; API on :8080 PID 22662; hash-verify worker (3-PID pnpm→tsx→node tree) alive and unrestricted (was SIGSTOPped + SIGCONTed during the §3 walk, now running normally); adb reverse 8080/8081/4566 all set; logcat backgrounded process has been killed. Goal: land the 3-line rotate-keys fix, rebuild apkRollout-Debug, and prepare for the §3 re-walk that flips Item 1 to `result: pass / severity: passed`.'
created: 2026-05-13T09:53:00Z
updated: 2026-05-13T10:08:00Z
symptoms_prefilled: true
linked_sessions:
  - init-400-no-idempotency-key # Plan 05-14 / Wave-1.5 Item 1 — split into four per-route keys; this defect is the incomplete-loop follow-on
---

## Symptoms

- **Expected behavior:** Per `.planning/runbooks/05-upload-smoke.md` §3 acceptance: corrupting the S3 object → worker `qa_status='hash-mismatch'` → a `re-upload` `_events` row → the app re-uploads from the local copy via `POST /recordings/:id/reupload` → re-verify → `qa_status='verified'` → locals deleted; the dead-letter "Retry" button drives the same path. Concretely for the §3 walk recording `01KRGB97X3MPJ784QF78SD77NJ`: after the `HumynUpload.reupload()` Path-A full-reset + drainer `postReupload` branch + `/reupload` 200 + re-PUT of all 9 video parts + 1 IMU part + metadata.json to LocalStack against the new `s3_upload_id=bVCQAmlbUJTGK...`, the drainer should call `POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize` → 200, the worker should re-hash → `qa_status='verified'`, the next authed call should piggyback `_events: [{event_type:'verified'}]`, `HumynUpload.clearVerified` should unlink the local triple, queue.json should drop to `[]`, and the `contributions` row should grow `recording_count: 1 → 2`.
- **Actual behavior:** All steps through `/reupload` + re-PUTs work. The drainer calls `POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize` at 2026-05-13T09:43:10.759Z and gets a **409 in 4 ms** (server-side idempotency-cache short-circuit; never reaches S3 or DB mutation). The on-device queue row is left in `state=FINALIZING` (videoParts.status=DONE, imuParts.status=DONE, metadataPut=DONE, uploadId=`bVCQAmlbUJTGK...`); the server-side DB row stays at `qa_status='pending', verified_at=null, upload_completed_at=null`; the local mp4/csv/json triple is still on disk; no follow-on `verified` outbox event is written; the contributions row stays at the §2 baseline `recording_count=1, task_count=1, duration_ms=92748`.
- **Error messages:** `/tmp/humyn-api.log` lines (paraphrased; full timestamps + response times):
  ```
  [09:40:39.338] INFO incoming request POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize
  [09:40:39.418] INFO request completed 200 in 79.91 ms       ← §2-original /finalize
  [09:43:08.840] INFO incoming request POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/reupload
  [09:43:08.955] INFO request completed 200 in 114.39 ms      ← §3 /reupload (Idempotency-Key d2fdba3f-...)
  [09:43:10.759] INFO incoming request POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize
  [09:43:10.764] INFO request completed 409 in 4.00 ms        ← §3-post-reupload /finalize — IDEMPOTENCY-CONFLICT
  ```
  Server-side problem-detail (per `apps/api/src/lib/problem-detail.ts:45` + the idempotency hook): `{ type: ".../idempotency-key-conflict", status: 409, ... }`. The 4 ms response time confirms the conflict was raised by the pre-handler check at `apps/api/src/lib/idempotency-store.ts` (lookup → hit on same key + different request_hash → 409), not by the route handler.
- **Timeline / ever worked:** Never worked on-device. The §3 hash-mismatch path has NEVER been exercised end-to-end on hardware — prior backend-only walks used host-side `curl` with freshly-minted UUIDv4 `Idempotency-Key` headers per request, so they side-stepped this code path entirely. The pre-condition for this defect to even fire was satisfied for the first time today (2026-05-13 afternoon) when the post-Plan-05-15 build successfully drove the §2 happy path end-to-end on the Pixel 10a, leaving the device in a state where the §3 walk could be attempted. Wave-1.5 Plan 05-14 Item 1 (the per-route key split, commit `2da5465..ff19694` series merged into main as `4e2897a`) is the most recent change to the idempotency-key surface; this defect is its incomplete-loop follow-on.
- **Reproduction:** Trivial on a fresh build. (1) Bring dev stack up (`docker compose up -d postgres redis localstack`, `pnpm --filter @humyn/api dev`, `pnpm --filter @humyn/api worker:hash-verify:dev`). (2) On Pixel 10a (5C161JEA304304) with `adb reverse 8080/8081/4566` set and the apkRollout-Debug build installed, record + auto-enqueue + let the §2 happy-path finish (qa_status='verified', locals deleted). (3) SIGSTOP the worker (`pkill -STOP -f "tsx.*hash-verify.ts"`). (4) Record a SECOND recording, let it land in S3 + `qa_status='uploaded'`. (5) Corrupt the S3 video.mp4: `curl -X PUT --data-binary "junk" http://localhost:4566/humyn-recordings-dev/recordings/<userId>/<recId>/video.mp4`. (6) SIGCONT the worker — it re-hashes → mismatch → outbox `re-upload` event. (7) App authed call delivers the event → `HumynUpload.reupload()` → drainer takes `postReupload` → `/reupload` 200 → re-PUTs parts → `/finalize` 409. (Alternative — host-side `curl` repro: replay the same UUIDv4 `Idempotency-Key` against two `POST /recordings/:id/finalize` calls with different `(uploadId, parts)` bodies under the same user JWT.)

## Current Focus

```yaml
hypothesis: |
  `HumynUploadModule.kt:316-328` (the Path-A full-reset branch of the @ReactMethod fun reupload(recordingId, promise)) resets row.{state, uploadId, imuUploadId, metadataPut, videoParts.*, imuParts.*, deadLetterReason, reupload} but does NOT rotate row.{init, parts, finalize}IdempotencyKey. Plan 05-14 Item 1 minted these as four per-route stable keys at row construction with the doc-comment "Minted once at construction; reused only across retries of <route> itself within the SAME upload session" — but a hash-mismatch re-upload is logically a NEW upload session for /init/parts/finalize even though it shares the row. The minimal fix is three UUID.randomUUID().toString() assignments inside the else -> branch, parallel to the existing reset lines around lines 320-327.
test: |
  Re-walk Phase 5 UAT Item 1 §3 on the rebuilt apkRollout-Debug APK with the fix applied: corrupt a fresh recording's S3 video.mp4 → worker flips hash-mismatch → app reuploads-from-local → /finalize returns 200 (not 409) → worker re-verifies → qa_status='verified' → locals deleted → contributions row recording_count: 1 → 2. Plus a backend vitest pinning that re-using one Idempotency-Key against two /finalize calls with different bodies under the same user returns 409 (locks the server contract). Plus a Robolectric / native unit test that asserts the three keys differ pre- and post-HumynUpload.reupload() Path-A on a row that has already consumed a /finalize against the original keys.
expecting: |
  /finalize 200, qa_status flips to 'verified' (second time for this recording), outbox 'verified' event written, clearVerified unlinks the local triple, queue.json drops to [], contributions row recording_count grows 1 → 2 (or duration_ms doubles if a single bucket_date row). Item 1 result flips partial → pass, severity flips partial-§3-blocked-by-defect → passed.
next_action: |
  Apply the 3-line fix at apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt:316-328 (inside the existing else -> Path-A full-reset branch, after the `row.deadLetterReason = null` line, add: `row.initIdempotencyKey = UUID.randomUUID().toString(); row.partsIdempotencyKey = UUID.randomUUID().toString(); row.finalizeIdempotencyKey = UUID.randomUUID().toString()`). Rebuild apkRollout-Debug (`cd apps/mobile/android && ./gradlew installApkRolloutDebug` from the host, with the Pixel 10a connected and Metro running). Add a Robolectric test in apps/mobile/android/app/src/test/ (or wherever HumynUpload tests live — pattern after the existing Wave-1.5 tests) that constructs an UploadRow, captures pre-keys, calls the reupload method, asserts post-keys differ on all three rotatable keys (init/parts/finalize) and matches on reuploadIdempotencyKey (one-shot replay, not rotated). Add a backend vitest in apps/api/src/__tests__/ (or wherever idempotency vitest lives) that exercises the 409 conflict shape directly. Then run mobile vitest + typecheck + the new Robolectric test, then on-device re-walk §3 on the rebuilt APK.
reasoning_checkpoint:
  current_thinking: |
    Root cause is fully isolated by code inspection + the §3 walk's API log evidence. The fix is mechanical — three UUID.randomUUID() lines. Confidence is high because:
    (1) The 409 response time was 4 ms (idempotency pre-handler short-circuit, not the route handler).
    (2) The server's idempotency_keys table directly shows the cached entry: `ee0bced9-c472-4a9f-8834-f4522121ac96 / POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize / 200 / created 2026-05-13 09:40:39.416597+00` — the post-reupload /finalize at 09:43:10 was the SECOND consumer of this key with a different (uploadId, parts) body.
    (3) The queue.json on device shows the persisted finalizeIdempotencyKey is the SAME `ee0bced9-...` it was at §2 — confirming `HumynUpload.reupload()` did not rotate it.
    (4) HumynUploadModule.kt:316-328 source confirms the reset code does not touch the idempotency keys.
    Risks before considering this resolved: (a) is there any path where rotating these keys breaks legitimate idempotent retries within the post-reupload session itself? — No, because Plan 05-14 already established that within one logical session the same key + same body returns the cached response, and a fresh session correctly starts a new key. (b) Does the Path-B (Wave-1.5 Item 2) branch at HumynUploadModule.kt:304-315 need the same rotation? — No, Path B keeps uploadId/parts/etags by design (the server row is still at qa_status='pending', not hash-mismatch), so the same finalizeIdempotencyKey + the same body = correct idempotent replay. The rotation belongs ONLY in the Path-A `else ->` branch. (c) Should reuploadIdempotencyKey also rotate? — No, /reupload is one-shot per re-upload cycle and replaying the same key + same body (just `{partsCount}`) is the correct idempotent behavior.
  candidate_explanations:
    - Wave-1.5 Plan 05-14 Item 1 split the keys per-route within one upload session but missed rotation at the hash-mismatch boundary. (CONFIRMED — primary)
    - Server-side idempotency_keys cache TTL is too long. (REJECTED — the cache works correctly; the bug is on the client which fails to rotate.)
    - LocalStack returning stale presigned URLs. (REJECTED — /reupload returned 200 with fresh uploadId; parts PUTs succeeded.)
  unknowns:
    - Whether existing apps/mobile/android/app/src/test/ tests exercise the reupload() @ReactMethod (probably partially — need to check Robolectric test layout).
    - Whether the apps/api/src/__tests__/ idempotency suite already has a "same key, different body → 409" case (likely it does, just not specifically for /finalize after /reupload).
tdd_checkpoint:
  test_first: false # TDD disabled per workflow.tdd_mode=false. The fix is mechanical + the test scaffolding can land alongside.
  failing_test_path: null
```

## Evidence

- timestamp: 2026-05-13T09:40:39Z
  source: /tmp/humyn-api.log
  observation: |
  `POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize` returned 200 in 79.91 ms. This is the §2-original /finalize consuming `finalizeIdempotencyKey='ee0bced9-c472-4a9f-8834-f4522121ac96'`. Server cached the (user_id, key) → (method, path, request_hash, status_code=200, response_body) tuple in idempotency_keys.
- timestamp: 2026-05-13T09:43:08Z
  source: /tmp/humyn-api.log + DB (recordings.s3_upload_id)
  observation: |
  `POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/reupload` returned 200 in 114.39 ms. Server reset the row (qa_status: hash-mismatch → pending, fresh s3_upload_id `bVCQAmlbUJTGK...`, fresh imuUploadId, verified_at null) and minted fresh presigned part URLs. Idempotency-Key `d2fdba3f-202d-4e81-bb30-58574bee9c8c` (reuploadIdempotencyKey) consumed for the first time.
- timestamp: 2026-05-13T09:43:10Z
  source: /tmp/humyn-api.log
  observation: |
  `POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize` returned **409 in 4.00 ms**. The 4 ms response time is the smoking gun: this is the idempotency pre-handler short-circuiting on a same-key/different-body conflict, NOT the route handler. The client re-sent `Idempotency-Key: ee0bced9-c472-4a9f-8834-f4522121ac96` (the §2-original finalizeIdempotencyKey) against a different `(uploadId, parts)` body (new uploadId `bVCQAmlbUJTGK...`, new parts list — same etags since LocalStack returns MD5-based ETag for identical bytes, but the new uploadId means different request_hash).
- timestamp: 2026-05-13T09:43:11Z
  source: adb shell run-as ai.humynlabs.capture.apk cat files/upload-queue/queue.json
  observation: |
  On-device queue.json shows `finalizeIdempotencyKey="ee0bced9-c472-4a9f-8834-f4522121ac96"` — UNCHANGED from the §2 happy path. Same for initIdempotencyKey (bb40c218-...) and partsIdempotencyKey (f82e9c44-...). Only reuploadIdempotencyKey (d2fdba3f-...) was consumed by the §3 /reupload. The row is in `state=FINALIZING` with all 9 video parts DONE, 1 IMU part DONE, metadataPut DONE, and the NEW uploadId persisted — so we can directly observe that `HumynUpload.reupload()` reset everything EXCEPT the three idempotency keys.
- timestamp: 2026-05-13T09:43:08Z
  source: docker exec humyn-postgres psql -c "SELECT user_id, key, method, path, status_code, created_at FROM idempotency_keys WHERE user_id = '01KRG9XG7VCSAYN823Q96FJ216' ORDER BY created_at DESC"
  observation: |
  Server-side idempotency_keys table directly shows the cached entries for the test user. The `ee0bced9-...` row (POST /recordings/01KRGB97X3MPJ784QF78SD77NJ/finalize, status 200, created 09:40:39.416597+00) is the §2-original /finalize cache entry; the post-reupload /finalize at 09:43:10 hit this row, found request_hash differed, returned 409. The five cached rows for the test user span all four routes (init x2, finalize x2, reupload x1) across the two recordings 01KRGA1B5H8BSRNFPSRHQFTHQ8 (§2) and 01KRGB97X3MPJ784QF78SD77NJ (§3).
- timestamp: 2026-05-13T09:50:00Z
  source: code inspection at apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt:316-328
  observation: |
  The else -> branch of the when block (Path-A full-reset for worker-fired re-upload after server qa_status='hash-mismatch') executes 8 reset assignments: `row.reupload = true; row.state = UploadState.PENDING; row.uploadId = null; row.imuUploadId = null; row.metadataPut = PartStatus.PENDING; row.deadLetterReason = null; for (p in row.videoParts) { p.status = PartStatus.PENDING; p.etag = null; p.retryCount = 0 }; for (p in row.imuParts) { p.status = PartStatus.PENDING; p.etag = null; p.retryCount = 0 }`. NO assignments to row.initIdempotencyKey, row.partsIdempotencyKey, or row.finalizeIdempotencyKey. The doc comments at UploadModels.kt:155-177 describe these as "Minted once at construction; reused only across retries of <route> itself within the SAME upload session" without clarifying the hash-mismatch boundary.
- timestamp: 2026-05-13T10:01:34Z
  source: ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.upload._"
  observation: |
  All 56 upload-package Robolectric tests PASS post-fix, including the 2 new
  HumynUploadModuleReuploadTest cases:
  • `reupload Path-A rotates initIdempotencyKey partsIdempotencyKey finalizeIdempotencyKey but NOT reuploadIdempotencyKey` (0.061s)
  • `reupload Path-B (DEAD_LETTER with uploadId set and !reupload) does NOT rotate any idempotency key` (0.010s)
  Test results XML at apps/mobile/android/app/build/test-results/testApkRolloutDebugUnitTest/TEST-ai.humynlabs.capture.upload.HumynUploadModuleReuploadTest.xml.
  Other suite-wide failures (17 in compat._/handdetector.\*) were verified to be PRE-EXISTING on clean main (commit a326713) by a stash-and-rerun — unrelated to this fix.
- timestamp: 2026-05-13T10:08:00Z
  source: ./gradlew :app:installApkRolloutDebug
  observation: |
  APK rebuilt + installed on Pixel 10a (5C161JEA304304). adb reverse 8080/8081/4566
  confirmed still set. Device ready for the §3 re-walk.

## Eliminated

(none yet — root cause is already isolated to a single code site by inspection + the §3 walk's API-log evidence)

## Resolution

**Status:** fixed at the unit-test layer (host-side); on-device §3 re-walk pending (orchestrator-driven per project convention).

**Root cause:** `HumynUploadModule.kt` `reupload(recordingId, promise)` Path-A (`else ->` branch — worker-fired re-upload after server `qa_status='hash-mismatch'`) reset the row's transfer state but did NOT rotate the three per-route idempotency keys (`init`, `parts`, `finalize`). Wave-1.5 Plan 05-14 Item 1's per-route key split (commit `2da5465`/`ff19694` merged as `4e2897a`) was scoped to retries within ONE upload session and missed the rotation at the hash-mismatch boundary. The §2-original `finalizeIdempotencyKey` was reused for the §3-post-reupload `/finalize` against a different `(uploadId, parts)` body → server's idempotency cache `(user_id, key)` correctly returned 409 `idempotency-key-conflict` in 4 ms in the pre-handler. The third client-rotation key (`reuploadIdempotencyKey`) is one-shot per re-upload cycle and intentionally NOT rotated — same-body (`{partsCount}`) replay is the correct idempotent behavior.

**Fix:**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt` — added `import java.util.UUID`; inside the `else ->` Path-A branch (now lines ~317-342), after `row.deadLetterReason = null`, inserted three lines:
  ```
  row.initIdempotencyKey = UUID.randomUUID().toString()
  row.partsIdempotencyKey = UUID.randomUUID().toString()
  row.finalizeIdempotencyKey = UUID.randomUUID().toString()
  ```
  Plus a doc-comment block explaining the rotation rationale + the asymmetry vs reuploadIdempotencyKey + link back to this debug session.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt` — updated `initIdempotencyKey` and `reuploadIdempotencyKey` KDoc to clarify the hash-mismatch boundary semantics (rotation happens for init/parts/finalize; reupload key intentionally NOT rotated).

**New test (regression pin):**

- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/HumynUploadModuleReuploadTest.kt` (NEW, 2 tests) — Robolectric tests that (a) Path-A rotates the three keys, leaves the reupload key unchanged, and resets the canonical fields; (b) Path-B (Wave-1.5 Item 2 client-side dead-letter on server `qa_status='pending'`) does NOT rotate any key (keeps uploadId/parts/etags by design; same-body replay is correct). Both PASS post-fix (0.061s + 0.010s).

**Drive-by build-time fixes** (unrelated to the root cause but blocked the new test from compiling on `main` commit `a326713`):

- `UploadCoordinatorTest.kt:743`, `UploadQueueStoreTest.kt:267,343` — three backticked test names contained Kotlin-illegal characters (`.` and `(`/`)`) and broke `compileApkRolloutDebugUnitTestKotlin` for the entire upload package. Renamed `Wave-1.5` → `Wave-1-5` and removed parens. Verified pre-existing failure on clean `main` by stash-and-rerun.
- `UploadQueueStoreTest.newStore()` — recreated `upload-queue` dir with `mkdirs()` after `deleteRecursively()` so the legacy-shape-migration test at line ~294 (which writes `queue.json` directly before any `store.enqueue()`) doesn't FileNotFoundException when run in isolation. Was masked on `main` only by the upstream compile failure.

**Backend contract:** no new backend test added — the generic "same `Idempotency-Key` + different body → 409 `idempotency-key-conflict`" contract is already pinned in `apps/api/test/plugins/idempotency.test.ts:80-90`. The `/finalize`-specific variant would have duplicated the pre-handler check that fires before the route handler.

**Verification:**

- `pnpm -r typecheck` — green (shared/types + apps/api).
- `cd apps/mobile && npm run typecheck` — green.
- `cd apps/mobile && npm test -- --run` — green (93 test files, 684 tests).
- `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.upload.*"` — 56/56 green (was 55+1 pre-existing test-ordering failure, now 56 after `newStore()` fix).
- `./gradlew :app:installApkRolloutDebug` — APK rebuilt + installed on Pixel 10a (5C161JEA304304); adb reverse 8080/8081/4566 confirmed still set.

**Pending — orchestrator-driven on-device step:**

- Re-walk Phase 5 UAT Item 1 §3 ON-DEVICE: corrupt a fresh recording's S3 `video.mp4` → worker `qa_status='hash-mismatch'` → app reuploads from local → `/finalize` returns 200 (not 409) → worker re-verifies → `qa_status='verified'` → `clearVerified` unlinks the local triple → contributions row `recording_count: 1 → 2`. DO NOT touch §3 recording `01KRGB97X3MPJ784QF78SD77NJ` or §2 recording `01KRGA1B5H8BSRNFPSRHQFTHQ8` — both preserved as UAT evidence.
- After §3 PASS, flip UAT Item 1 to `result: pass / severity: passed` and commit. DO NOT call phase.complete (Items 2-5 remain pending).

**Specialist review:** none — `specialist_hint` = `android`, which has no mapped specialist skill in the dispatch table. Proceeded directly.

**Cycles:** 1 (investigation pre-isolated in the trigger; fix + tests + verification landed in one pass).
