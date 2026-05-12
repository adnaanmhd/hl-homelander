---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 13
subsystem: backend / upload-pipeline + hash-verify worker
tags: [upload, finalize, hash-verify, events-outbox, idempotency, toctou, security]
requires:
  - apps/api/src/routes/recordings/finalize.ts (Plan 05-pre / 05-09)
  - apps/api/src/lib/verify-recording.ts (Plan 05-03)
  - apps/api/src/plugins/events-outbox.ts (Plan 05-05)
  - apps/api/src/routes/recordings/verified-ids.ts (Plan 05-05)
  - apps/api/src/workers/hash-verify.ts (Plan 05-03)
provides:
  - retry-safe POST /recordings/:id/finalize (NoSuchUpload-tolerant + HeadObject-confirmed state flip + already-uploaded short-circuit)
  - TOCTOU-safe verifyRecording qa_status flip (AND qa_status='uploaded' + rowCount-gated outbox/cleanup)
  - 2xx-application/json-only events-outbox onSend hook (no _events on problem+json, no events lost on error responses)
  - user-gated verified-ids cursor SELECT (closes the IN-05 existence oracle)
  - reconciled 05-VALIDATION.md Per-Task Verification Map (rows 05-09-01…05-13-03)
affects:
  - the upload coordinator's /finalize retry path (UploadCoordinator) — a retry now converges instead of 500ing forever
  - the hash-verify worker — its qa_status flip is correct under concurrent ops actions
  - the _events client channel — RFC-7807 error bodies stay clean; pending events survive error responses
tech-stack:
  added: []
  patterns:
    - "idempotent S3 multipart complete: swallow NoSuchUpload/NoSuchMultipartUpload, HeadObject the key, 'exists' = success"
    - 'TOCTOU-safe state flip: AND <status> = <expected> in the UPDATE + side effects gated on rowCount === 1'
    - 'outbox onSend hook gated on 2xx + content-type application/json (never application/problem+json)'
key-files:
  created:
    - .planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-13-SUMMARY.md
  modified:
    - apps/api/src/routes/recordings/finalize.ts
    - apps/api/src/lib/verify-recording.ts
    - apps/api/src/workers/hash-verify.ts
    - apps/api/src/plugins/events-outbox.ts
    - apps/api/src/routes/recordings/verified-ids.ts
    - apps/api/test/routes/recordings-finalize.test.ts
    - apps/api/test/workers/verify-recording.test.ts
    - apps/api/test/plugins/events-outbox.test.ts
    - apps/api/test/routes/recordings/verified-ids.test.ts
    - .planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-VALIDATION.md
decisions:
  - "On a 'row moved during re-hash' (rowCount 0) in verifyRecording: leave the recordings_to_verify row in place (the verify-sweep cron reaps it after MAX_ATTEMPTS; the row will never return to 'uploaded' from takedown/rejected anyway) — over deleting it. Log at info."
  - "verifyRecording's optional logger param is typed as a minimal `{ info(obj, msg?) }` interface (not the full pino Logger) — keeps the lib free of a pino type dependency; the worker passes its pino child."
metrics:
  duration: ~40min
  completed: 2026-05-12
---

# Phase 5 Plan 13: Backend Gap Closure (WR-01 / WR-02 / WR-03 / IN-05 + VALIDATION reconcile) Summary

Retry-safe `/finalize` + TOCTOU-safe hash-verify state flip + 2xx-only `_events` outbox hook + user-gated `verified-ids` cursor — the three backend warnings the verifier flagged inside the otherwise-wired hash-verify pipeline, plus the IN-05 one-liner and the MINOR-7 validation-map reconcile.

## What Shipped

### Task 1 — WR-01: retry-safe `POST /recordings/:id/finalize` (commit `1e276a0`)

- New `completeOrConfirm(s3, bucket, key, uploadId, parts)` helper: `try` the `CompleteMultipartUploadCommand`; on a `NoSuchUpload` / `NoSuchMultipartUpload` / `NoSuchUploadException` (the multipart upload is already gone — a prior `/finalize` attempt consumed it, or it expired), `HeadObject` the key — "the object exists" ⇒ treat as success (idempotent retry). `HeadObject` throws `NotFound`/404 if the object isn't there → that propagates (a genuine failure; the coordinator retries / it dead-letters). Any other S3 error also propagates.
- The handler now calls `completeOrConfirm` for both video and IMU instead of raw `CompleteMultipartUploadCommand`, then `HeadObject`s **both** keys before the `db.transaction` — the row only flips to `qa_status='uploaded'` once both objects are confirmed present, so a half-finished `/finalize` never strands a row.
- A row already in `qa_status='uploaded'` short-circuits to a `200` (the prior `/finalize`'s response dropped on the wire) — no `CompleteMultipartUpload` call. A row in `verified`/`hash-mismatch`/`rejected`/`takedown` still `409`s.
- `recordings-finalize.test.ts` extended (drives real LocalStack S3 — the WR-01 scenario is reproduced by completing the video multipart before calling `/finalize`; the "object gone" case by aborting it): retry-after-already-completed → `200` + verify-queue row; both-gone → propagates (≥500) + row stays `pending`; already-uploaded → `200`, no Complete call; verified → `409`; the existing happy path re-runs. **5/5 pass.**

### Task 2 — WR-02 + WR-03 + IN-05 (commit `fd04f20`)

- **WR-02 (`verify-recording.ts`):** both `qa_status` UPDATEs carry `AND qa_status = 'uploaded'` (`and(eq(id,...), eq(qaStatus,'uploaded'))`); the `appendOutboxEvent` + the `recordings_to_verify` delete only happen if the UPDATE affected a row (`(res.rowCount ?? 0) === 1`); a 0-row update logs at `info` ('row moved during re-hash; skipping') and returns with no side effects — an ops takedown / re-upload during the multi-second S3 re-hash window is not silently resurrected. The dead `canTransition(rec.qaStatus, ...)` check (always `'uploaded'` because `rec` is a stale read) was removed; the SQL predicate is the guard. `verifyRecording` gained an optional `log?` second param; `hash-verify.ts`'s worker callback now passes its pino child (`verifyRecording(job.data.recordingId, log)`).
- **WR-03 (`events-outbox.ts`):** the `onSend` hook renamed `_reply` → `reply` and added, right after the `sub` check: `if (reply.statusCode < 200 || reply.statusCode >= 300) return payload;` and `const ct = reply.getHeader('content-type'); if (typeof ct !== 'string' || !ct.startsWith('application/json')) return payload;`. So `application/problem+json` (RFC-7807) bodies and every non-2xx response are skipped — they never carry `_events`, and pending outbox events are never marked delivered on a response the client treats as a hard failure. The normal carrier routes (`/me`, `/recordings`, `/recordings/verified-ids`, `/recordings/:id/reupload`) send `application/json; charset=utf-8` → still handled.
- **IN-05 (`verified-ids.ts`):** the cursor-resolution SELECT's `where(eq(recordings.id, since))` → `where(and(eq(recordings.id, since), eq(recordings.userId, userId)))` — an out-of-scope `since` resolves nothing (closing the faint existence oracle); the result set was already user-gated, so no behaviour change for a legitimate cursor.
- Tests: `verify-recording.test.ts` gains a "row moved to takedown during the re-hash window → not resurrected, no outbox event, queue row left" case (gated on `AWS_ENDPOINT_URL`); `events-outbox.test.ts` (4 existing tests kept) gains "404 `application/problem+json` → no `_events`, row stays `deliveredAt === null`" + the "200 `application/json` regression: `_events` present, row marked delivered" guard; `verified-ids.test.ts` (4 existing tests kept) gains the IN-05 case (`?since=<other user's id>` ≡ `?since=<unknown id>` ≡ no `since`). **15/15 pass; `tsc --noEmit` clean.**

### Task 3 — MINOR 7: reconcile `05-VALIDATION.md` Per-Task Verification Map (commit `d9e4f12`)

- Appended rows `05-09-01`, `05-09-02`, `05-10-01`, `05-11-01`, `05-12-01`, `05-13-01`, `05-13-02`, `05-13-03` to the "## Per-Task Verification Map" table (10-column format kept), each citing the task's `<automated>` verify command verbatim + requirement(s) + threat ref + a one-line secure-behavior summary. Updated the bottom note to record that the gap-closure plans are reflected. `nyquist_compliant` stays `true`; `wave_0_complete` untouched. (lint-staged's prettier reformatted the table columns on commit — content unchanged.)

## Deviations from Plan

None — plan executed as written. (The plan offered a choice on the "row moved during re-hash" cleanup behaviour — "leave it or delete it, match the chosen behaviour"; I chose **leave the `recordings_to_verify` row**, matching the comment guidance, and the test asserts that.)

## Verification

- `cd apps/api && pnpm vitest run test/routes/recordings-finalize.test.ts test/workers/verify-recording.test.ts test/plugins/events-outbox.test.ts test/routes/recordings/verified-ids.test.ts` → **20/20 pass** (5 finalize + 5 verify-recording + 6 events-outbox + 4 verified-ids; run with the dev `docker-compose` stack — Postgres + LocalStack + Redis — and the `.env.example` env)
- `cd apps/api && pnpm tsc --noEmit` → clean (`shared/types` too)
- `grep -n 'HeadObjectCommand' apps/api/src/routes/recordings/finalize.ts` → hit
- `grep -c "qaStatus, 'uploaded'" apps/api/src/lib/verify-recording.ts` → 2; `grep -c 'rowCount' …` → 3
- `grep -c 'statusCode' apps/api/src/plugins/events-outbox.ts` → 1; `grep -c '_reply' …` → 0
- `grep -c 'eq(schema.recordings.userId, userId)' apps/api/src/routes/recordings/verified-ids.ts` → 2
- `grep -c '05-09-01\|05-09-02\|05-10-01\|05-11-01\|05-12-01\|05-13-01\|05-13-02\|05-13-03' .planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-VALIDATION.md` → 9; `grep -c 'nyquist_compliant: true' …` → 3

## Notes

- The new finalize tests reproduce the WR-01 stuck-recording scenario against **real LocalStack** (no S3 mocking — the existing test file's convention): the "video multipart already completed" case calls `CompleteMultipartUploadCommand` before `/finalize`; the "video object also gone" case `AbortMultipartUploadCommand`s it first (so `CompleteMultipartUpload` → `NoSuchUpload`, `HeadObject` → `NotFound` → propagates). One expected `ERROR: unhandled_error` log line surfaces on that propagation path — it's the route correctly re-throwing a genuine S3 failure.
- The `verify-recording.test.ts` TOCTOU case flips the row to `takedown` before calling `verifyRecording` (we can't interleave mid-call) — so it exercises the early `qaStatus !== 'uploaded'` guard rather than the in-transaction `AND qa_status='uploaded'` predicate directly; the test pins the invariant that matters ("a non-`uploaded` row is never written to `verified` and never gets an outbox event"). The SQL predicate is the second line of defence behind that early guard and is the must-have per the plan.

## Self-Check: PASSED

All 11 listed files exist; all 4 commits (`1e276a0`, `fd04f20`, `d9e4f12`, `d801e7e`) are in the log.
