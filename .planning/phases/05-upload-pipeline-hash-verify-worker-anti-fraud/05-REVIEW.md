---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - apps/api/src/routes/recordings/init.ts
  - apps/api/src/routes/recordings/parts.ts
  - apps/api/src/routes/recordings/index.ts
  - apps/api/src/routes/recordings/finalize.ts
  - apps/api/src/routes/recordings/verified-ids.ts
  - apps/api/src/lib/verify-recording.ts
  - apps/api/src/plugins/events-outbox.ts
  - apps/api/src/workers/hash-verify.ts
  - apps/api/src/workers/sqs-poller.ts
  - shared/types/src/recording.ts
  - infra/terraform/modules/verify-queue/main.tf
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt
  - apps/api/test/routes/recordings/init.test.ts
  - apps/api/test/routes/recordings/parts.test.ts
  - apps/api/test/routes/recordings-finalize.test.ts
  - apps/api/test/routes/recordings/verified-ids.test.ts
  - apps/api/test/workers/verify-recording.test.ts
  - apps/api/test/workers/sqs-poller.test.ts
  - apps/api/test/plugins/events-outbox.test.ts
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 5 (gap-closure 05-09..05-13): Code Review Report

**Reviewed:** 2026-05-12
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the Phase-5 gap-closure changes only: idempotent `POST /recordings/init` (CR-02), the new `POST /recordings/:id/parts` re-presign route, mobile `UploadCoordinator` re-drain via `/parts` + `row.reupload` clearing + 409→dead-letter + log-leak hardening (CR-01/WR-06), the `drainLock` ReentrantLock (CR-03), the prod `sqs-poller.ts` (VERIFY-01), retry-safe `/finalize` (WR-01), TOCTOU-safe `verifyRecording` (WR-02), the 2xx-only `events-outbox` hook (WR-03), and the user-gated `verified-ids` cursor (IN-05).

The core mechanics are sound: the idempotency SELECT-first guard, the `tryLock()` serialisation, the `AND qa_status='uploaded'` SQL predicate in `verifyRecording`, the `parseInitResponse` body-free re-throw, and the 2xx/JSON gate in the outbox hook all do what they claim and have test coverage. No BLOCKER-class defects found.

The findings: (WR-01) a re-drain of a `FINALIZING` row whose `/finalize` already committed dead-letters spuriously; (WR-02, WR-03) several mobile HTTP error codes fall through to an infinite transient-retry loop instead of dead-lettering; (WR-04) a pre-existing TOCTOU on the `/finalize` state UPDATE that the gap-closure rewrote but didn't harden the way WR-02 hardened `verifyRecording`; (WR-05) a brief persisted-`reupload=true`-with-`uploadId` window; plus seven lower-severity items (stale comments, untested branches, an over-broad EventBridge filter, an API contract coupled to one client's behaviour).

## Warnings

### WR-01: Re-draining a `FINALIZING` row whose `/finalize` already committed dead-letters it spuriously

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:192-197, 276-281, 379-381` and `apps/api/src/routes/recordings/parts.ts:118-131`
**Issue:** When a drain reaches step 4 it sets `row.state = UploadState.FINALIZING`, `queueStore.upsert(row)`, then calls `postFinalize`. If the `/finalize` request commits server-side (row flipped `pending → uploaded`, verify enqueued) but the **HTTP response is lost on the wire** (a routine event on the flaky cellular links this app targets), `postFinalize` throws `IOException` → `drainNow` treats it as transient → the row stays `FINALIZING` on disk. `drainNow()` does **not** skip `FINALIZING` rows (line 192-197 only skips `AWAITING_VERIFY/VERIFIED/DEAD_LETTER`), so the next drain re-enters `uploadOne(row)`. Because `row.uploadId != null` and `!row.reupload`, it calls `postRePresign` → `POST /recordings/:id/parts` → the server row is now `'uploaded'`, not `'pending'` → **409** → `postRePresign` throws `DeadLetterException("…/parts -> 409 (upload not resumable)")` → the row dead-letters and the user sees `chip-failed` for a recording that actually uploaded and verified fine. (It's eventually un-stuck by the `verified-ids` reconcile sweep / `_events` channel — but only if the client clears DEAD_LETTER rows on a `verified` event.)
**Fix:** When re-draining a row already in `FINALIZING`, retry `postFinalize` directly (it's idempotent — returns 200 for an `'uploaded'` row) before falling back to `postRePresign`; or, in `postRePresign`, on a `409` first re-`GET /recordings/:id` and if the row is `'uploaded'`/`'verified'` treat it as a successful finalize (advance to `AWAITING_VERIFY`) rather than dead-lettering. E.g.:

```kotlin
if (row.state == UploadState.FINALIZING && row.uploadId != null) {
    // The previous drain's /finalize may have committed; retry it (idempotent) first.
    runCatching { postFinalize(baseUrl, row) }.onSuccess {
        row.state = UploadState.AWAITING_VERIFY; queueStore.upsert(row); emitQueueChanged(); return
    }
}
```

### WR-02: `/recordings/init` 400 from a malformed metadata bundle → infinite transient retry, never dead-letters

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:457-485`
**Issue:** `postInit` reads the SHAs/sizes/timestamp out of `metadata.json` with `m.optString("file_sha256", "")` etc. If the file is present but a field is missing/garbage (a partially written `MetadataComposer` output, or a crash-truncated file), the body carries `fileSha256: ""` (or a non-hex value), and the server's `RecordingsInitRequestSchema` (`.length(64).regex(/^[0-9a-f]{64}$/)`) rejects it with **400**. `postInit` only dead-letters on `409`/`403`; a `400` falls through to `if (!resp.isSuccessful) throw IOException(...)` → caught in `drainNow` as a _transient_ error → the row stays `PENDING` and every subsequent drain repeats the same `400` forever. A `400` here is structurally non-retryable.
**Fix:** Treat a `400` from `/recordings/init` (and `/reupload`, `/parts`) as a `DeadLetterException`, same as `409`/`403`:

```kotlin
if (resp.code == 400 || resp.code == 409 || resp.code == 403) {
    throw DeadLetterException("/recordings/init -> ${resp.code} (request rejected — not resumable)", null)
}
```

### WR-03: `/recordings/:id/finalize` 409 → infinite transient retry, never dead-letters / re-routes

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:566-568`
**Issue:** `postFinalize` only checks `!resp.isSuccessful` → `IOException`. If `/finalize` returns **409** (the server row moved to `verified`/`hash-mismatch`/`rejected`/`takedown` between the upload and finalize — an ops takedown, or a `hash-mismatch` from a prior verify cycle the client hasn't reconciled), the row keeps re-draining the full part-upload + finalize loop forever instead of dead-lettering (or, for `hash-mismatch`, re-routing through `/reupload`). Same class as WR-02.
**Fix:** Inspect the `/finalize` response code: `409` (and `404`) → `DeadLetterException` (the reconcile sweep / `_events` channel converges the row's true state afterward); keep `5xx`/network as transient.

### WR-04: `/finalize`'s state-flip transaction has no `AND qa_status='pending'` guard — a concurrent takedown is silently clobbered

**File:** `apps/api/src/routes/recordings/finalize.ts:211-226`
**Issue:** The transaction does `tx.update(schema.recordings).set({ qaStatus: 'uploaded', uploadCompletedAt: new Date() }).where(eq(schema.recordings.id, rec.id))` with **no** predicate on the current `qa_status`. The route's `canTransition` / `rec.qaStatus === 'uploaded'` short-circuits use the _stale_ `rec` read at line 130-134. If an ops takedown (`D-LEGAL-04`) flips the row to `'takedown'` after that SELECT but before the transaction, `/finalize` overwrites it back to `'uploaded'`, the verify worker then re-flips it to `'verified'`, and the legal takedown is undone. This is the exact TOCTOU class WR-02 fixed in `verifyRecording` (`AND qa_status='uploaded'` + only side-effect on `rowCount === 1`); the same hardening was not applied here even though the gap-closure rewrote this transaction. (Pre-existing pattern, not newly introduced — but adjacent to the WR-01 change and worth closing while the file is open.)
**Fix:** Make the UPDATE conditional and detect the no-op:

```ts
const updated = await db.transaction(async (tx) => {
  const res = await tx.update(schema.recordings)
    .set({ qaStatus: 'uploaded', uploadCompletedAt: new Date() })
    .where(and(eq(schema.recordings.id, rec.id), eq(schema.recordings.qaStatus, 'pending')));
  if ((res.rowCount ?? 0) !== 1) { /* row moved out from under us — return the current row, do NOT enqueue */ }
  await tx.insert(schema.recordingsToVerify).values({ recordingId: rec.id }).onConflictDoNothing();
  ...
});
```

### WR-05: `uploadOne` persists `row.reupload === true` together with the fresh `uploadId`, before clearing the flag

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:281-294`
**Issue:** Line 281-284 does `row.uploadId = initResp.uploadId; row.imuUploadId = …; row.state = UPLOADING; queueStore.upsert(row)` **while `row.reupload` is still `true`** (it's only cleared at line 291-294 in a second `upsert`). If the process is killed between those two writes, the on-disk row has `reupload == true` _and_ `uploadId != null`. The next drain's `when` (line 276) checks `row.reupload` first → calls `postReupload` _again_, minting another fresh video/IMU multipart upload pair and orphaning the one just persisted. (It self-heals — on a first re-upload drain all parts are still `PENDING`, so re-running `/reupload` re-uploads everything against the new ids — but it's an avoidable extra `/reupload` round-trip + orphaned MUs, and the comment at line 286-290 claiming the marker is cleared "IMMEDIATELY" isn't actually guaranteed by the two-write sequence.)
**Fix:** Clear `row.reupload` before the persist at line 284, in the same `upsert`:

```kotlin
row.uploadId = initResp.uploadId
row.imuUploadId = initResp.imuUploadId
if (wasReupload) row.reupload = false
row.state = UploadState.UPLOADING
queueStore.upsert(row)
```

## Info

### IN-01: `sqs-poller.ts` regex comment says "SECOND capture group" but there is only one capture group

**File:** `apps/api/src/workers/sqs-poller.ts:24-28, 76`
**Issue:** `RECORDING_KEY_RE` is `^recordings\/[0-9A-HJKMNP-TV-Z]{26}\/([0-9A-HJKMNP-TV-Z]{26})\/(?:video\.mp4|imu\.csv|metadata\.json)$` — the userId segment is **not** parenthesized and the suffix alternation is `(?:…)` non-capturing, so `m[1]` (used by the code, correctly) is the recordingId. The comment "userId & recordingId are 26-char … The SECOND capture group is the recordingId" is wrong.
**Fix:** Reword the comment ("the only capture group is the recordingId"), or wrap the userId in a group for symmetry and read `m[2]`.

### IN-02: WR-02's `AND qa_status='uploaded'` SQL predicate has no test exercising the 0-row branch

**File:** `apps/api/test/workers/verify-recording.test.ts:232-277`
**Issue:** The "row moved to takedown during the re-hash" test admits it "can't interleave mid-call" and instead flips the row to `takedown` _before_ calling `verifyRecording`, so the early `qaStatus !== 'uploaded'` guard short-circuits and the `AND qa_status='uploaded'` UPDATE predicate (the actual WR-02 fix) is never reached. The `rowCount !== 1` branch (skip outbox event, leave queue row) is untested.
**Fix:** Add a test that inserts the row as `'uploaded'`, stubs `sha256OfS3Object` to flip the row to `'takedown'` (via a real `db.update`) before resolving, then asserts no outbox row and the queue row left in place — that exercises the SQL predicate, not the early guard.

### IN-03: `sqs-poller.ts` `pollOnce`/`loop` (delete-on-JSON-parse, enqueue-then-delete, backoff) is untested

**File:** `apps/api/test/workers/sqs-poller.test.ts` (only `parseRecordingIdFromS3Event` is covered)
**Issue:** The subtle "if the body parsed as JSON, `DeleteMessage`; if it didn't even parse, leave it for the DLQ" logic in `pollOnce` (lines 102-125), and the "enqueue succeeded → delete; enqueue failed → don't delete" branch (lines 127-138), have no coverage. A regression that deleted unparseable messages (silently dropping a real-but-corrupted event) or deleted on enqueue failure (dropping a verify) would not be caught.
**Fix:** Add a `pollOnce` test with a mocked `SQSClient` covering: well-formed event → enqueue + delete; non-recording key + valid JSON → delete, no enqueue; non-JSON body → no delete; `enqueueVerify` rejects → no delete.

### IN-04: EventBridge rule filters on `.mp4`/`.csv` suffixes bucket-wide, not scoped to `recordings/`

**File:** `infra/terraform/modules/verify-queue/main.tf:70-86`
**Issue:** The `event_pattern` matches `object.key` ending in `.mp4`, `.csv`, or `metadata.json` anywhere in `humyn-recordings-${env}`. Any future non-recording `.mp4`/`.csv` object in that bucket would also fire the rule → land on the SQS queue → the poller's `RECORDING_KEY_RE` rejects it → the message is logged + deleted. Wasteful (extra SQS traffic + poller cycles) but not incorrect.
**Fix:** Add a `prefix = "recordings/"` constraint alongside the suffix filters in the `object.key` matcher.

### IN-05: `aws_sqs_queue.verify` `visibility_timeout_seconds = 900` is dead config — the poller overrides it to 60s

**File:** `infra/terraform/modules/verify-queue/main.tf:45-47` vs `apps/api/src/workers/sqs-poller.ts:94`
**Issue:** The queue default `visibility_timeout_seconds = 900` is justified by a comment about "the worker re-hashes potentially multi-GB objects" — but the SQS consumer is the _poller_ (which only does a Redis `enqueueVerify` then `DeleteMessage`), not the BullMQ hash-verify worker (which reads from Redis). The poller's `ReceiveMessageCommand` always sets `VisibilityTimeout: 60`, overriding the queue default for every received message. The 900s value is therefore inert and the comment is misleading.
**Fix:** Drop the queue-level `visibility_timeout_seconds` (or set it to ~60) and correct the comment to say the consumer is the thin poller.

### IN-06: `/recordings/init`'s idempotent path re-issues a fresh IMU `CreateMultipartUpload` on every re-`/init`, orphaning the prior one

**File:** `apps/api/src/routes/recordings/init.ts:215-229, 79-91`
**Issue:** Each duplicate `/init` for a `pending` row mints a brand-new IMU multipart upload (the IMU upload-id isn't persisted on the row). The inline comment justifies this with "a fresh one orphans nothing because the video upload it accompanies has zero uploaded parts at that point" — that holds for _this_ upload coordinator (which uses `/parts`, not `/init`, on re-drains, so it only re-`/init`s before any part is uploaded), but it's a contract assumption coupled to one client's behaviour: any other caller that uploads IMU parts then re-`/init`s strands those parts. Orphaned MUs are reaped by the recordings bucket's `abort_incomplete_multipart_upload { days_after_initiation = 1 }` lifecycle rule, so the leak is bounded.
**Fix:** Document the client coupling explicitly in the route comment, or (more robustly) persist the IMU upload-id on the row like the video one so the idempotent path can re-presign it instead of recreating it.

### IN-07: `UploadCoordinator.kt:311` `row.chunkBytes ?: chunkBytesForNetwork(false)` is dead — `chunkBytes` is already non-null here

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:311` (also `:403`)
**Issue:** `row.chunkBytes` is unconditionally set at line 253-255 (`if (row.chunkBytes == null) row.chunkBytes = …`) before line 311 reads it, so the `?: chunkBytesForNetwork(false)` fallback can never fire. `doneBytes` (line 403) has the same dead fallback. Harmless but misleading (it implies `chunkBytes` can legitimately be null mid-`uploadOne`, which would actually be a layout bug).
**Fix:** Replace with `row.chunkBytes!!` for clarity, or drop the local and read `row.chunkBytes!!` inline.

---

_Reviewed: 2026-05-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
