---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 100
files_reviewed_list:
  - .env.example
  - CLAUDE.md
  - apps/api/.env.example
  - apps/api/package.json
  - apps/api/scripts/dev.sh
  - apps/api/src/app.ts
  - apps/api/src/cron/verify-sweep.ts
  - apps/api/src/db/migrations/0006_recording_events_outbox.sql
  - apps/api/src/db/schema.ts
  - apps/api/src/lib/queue.ts
  - apps/api/src/lib/recording-events.ts
  - apps/api/src/lib/recording-state.ts
  - apps/api/src/lib/sha256-stream.ts
  - apps/api/src/lib/verify-recording.ts
  - apps/api/src/plugins/events-outbox.ts
  - apps/api/src/plugins/logger.ts
  - apps/api/src/routes/recordings/finalize.ts
  - apps/api/src/routes/recordings/index.ts
  - apps/api/src/routes/recordings/init.ts
  - apps/api/src/routes/recordings/parts.ts
  - apps/api/src/routes/recordings/reupload.ts
  - apps/api/src/routes/recordings/schemas.ts
  - apps/api/src/routes/recordings/verified-ids.ts
  - apps/api/src/workers/hash-verify.ts
  - apps/api/src/workers/sqs-poller.ts
  - apps/api/test/fixtures/stub-bundle.ts
  - apps/api/test/lib/queue.test.ts
  - apps/api/test/lib/recording-state.test.ts
  - apps/api/test/lib/sha256-stream.test.ts
  - apps/api/test/plugins/events-outbox.test.ts
  - apps/api/test/routes/recordings-finalize.test.ts
  - apps/api/test/routes/recordings/init.test.ts
  - apps/api/test/routes/recordings/parts.test.ts
  - apps/api/test/routes/recordings/reupload.test.ts
  - apps/api/test/routes/recordings/verified-ids.test.ts
  - apps/api/test/workers/sqs-poller.test.ts
  - apps/api/test/workers/verify-recording.test.ts
  - apps/mobile/App.tsx
  - apps/mobile/__tests__/boot/bootRecoveryListener.test.ts
  - apps/mobile/__tests__/manifests/manifests.test.ts
  - apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx
  - apps/mobile/__tests__/screens/onboarding/BatteryOptimizationScreen.test.tsx
  - apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx
  - apps/mobile/__tests__/screens/recording/useRecordingLifecycle.test.tsx
  - apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.test.tsx
  - apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.visual.test.tsx
  - apps/mobile/__tests__/services/recordingEvents.test.ts
  - apps/mobile/__tests__/services/uploadReconcile.test.ts
  - apps/mobile/__tests__/state/uploadToastBus.test.ts
  - apps/mobile/android/app/build.gradle
  - apps/mobile/android/app/src/main/AndroidManifest.xml
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/BatteryOptimizationHelper.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/ChunkUploader.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/NetworkMonitor.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadJobService.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadQueueStore.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModuleTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/BatteryOptimizationHelperTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/ChunkUploaderRetryTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/NetworkMonitorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadQueueStoreTest.kt
  - apps/mobile/src/components/UploadStatusChip.tsx
  - apps/mobile/src/native/HumynUpload.ts
  - apps/mobile/src/navigation/RootNativeStack.tsx
  - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
  - apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/recording/useRecordingLifecycle.ts
  - apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx
  - apps/mobile/src/services/api.ts
  - apps/mobile/src/services/recordingEvents.ts
  - apps/mobile/src/services/uploadReconcile.ts
  - apps/mobile/src/state/keys.ts
  - apps/mobile/src/state/uploadToastBus.ts
  - deferred-decisions.md
  - design-spec.md
  - docker-compose.yml
  - infra/terraform/envs/prod/main.tf
  - infra/terraform/envs/staging/main.tf
  - infra/terraform/modules/ecs/outputs.tf
  - infra/terraform/modules/redis/main.tf
  - infra/terraform/modules/redis/outputs.tf
  - infra/terraform/modules/redis/variables.tf
  - infra/terraform/modules/verify-queue/main.tf
  - infra/terraform/modules/verify-queue/outputs.tf
  - infra/terraform/modules/verify-queue/variables.tf
  - shared/types/src/index.ts
  - shared/types/src/me.ts
  - shared/types/src/recording.ts
findings:
  critical: 4
  warning: 19
  info: 3
  total: 26
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 100
**Status:** issues_found
**Findings:** 4 BLOCKER (critical), 19 WARNING, 3 INFO (26 total)

## Summary

Large, carefully-designed Phase 5 upload-pipeline implementation. Most concerns (state-machine TOCTOU, per-route idempotency keys, idempotent `/init` / `/finalize`, ULID handling, T-5-\* threat-model items, IAM least-privilege) have been thought through and have backstops. That said, this review surfaces one **build-breaking** missing import in a test file, one **denial-of-service** vector via unbounded outbox writes, one **JS-thread / native-thread concurrency hazard** in the reupload pathway, and one **infinite-loop / cost-explosion** risk via `verify-sweep` re-enqueuing a row whose verify will always be a no-op. Several smaller concurrency and naming defects round out the warning set.

The depth of the planning trail (commit references in code comments, explicit threat-model labels, Pattern-22 / Wave-1.5 callouts) is unusually disciplined and made the review faster — but it does not save you from the four BLOCKERs below.

---

## BLOCKERS (Critical)

### CR-BL-01: `UploadCoordinatorTest.kt` uses `assertNotEquals` but never imports it — test compilation fails

**File:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt:682, 712, 715, 862-867`
**Severity:** critical

`assertNotEquals(...)` is called at lines 682, 712, 715, 862-867 (the "four distinct keys across init/parts/finalize/reupload" test — the very test that protects Wave-1.5 Item 1's bug fix). The imports block at lines 13-29 lists `assertEquals`, `assertNotNull`, `assertNull`, `assertTrue` only — there is no `import org.junit.Assert.assertNotEquals`. Kotlin will not resolve the symbol; the `:app:testApkRolloutDebugUnitTest` target fails. The sibling file `UploadQueueStoreTest.kt:15` imports it correctly, which is what makes this one stand out.

**Fix:** Add to the imports block:

```kotlin
import org.junit.Assert.assertNotEquals
```

### CR-BL-02: `recording_events_outbox` is unbounded — any "verified" or "re-upload" event for a soft-deleted / logged-out / cold-storage user grows the table forever

**File:** `apps/api/src/db/migrations/0006_recording_events_outbox.sql`, `apps/api/src/lib/recording-events.ts`
**Severity:** critical

The hash-verify worker writes one outbox row per verify result. The `events-outbox` onSend hook only marks rows `delivered_at` when the owning user makes an authenticated 2xx JSON request. Users who:

- have signed out and never come back,
- have soft-deleted their account (`users.deleted_at IS NOT NULL`),
- got their JWT permanently invalidated (token_version bump),
- never re-open the app between two verifies,

never drain their outbox. The partial index `WHERE delivered_at IS NULL` slows growth but doesn't bound it; the table is `ON DELETE CASCADE` from `users` and `recordings`, so it only releases rows when the user or recording is hard-deleted. With "upload path is fully uncapped per account at MVP" (FRAUD-05/06 descoped) this is a clear DoS vector: a malicious account can finalize → hash-mismatch → reupload → hash-mismatch → reupload... and never authenticate again. Each cycle writes a new outbox row that is never reaped.

No retention sweep cron, no `MAX_OUTBOX_AGE`, no cap-per-user is implemented. The Phase-1 DSR cron deletes by `users.deletedAt`, not by outbox staleness.

**Fix:** Add a retention sweep (mirror `cron/dsr-hard-delete.ts`):

```ts
// cron/outbox-prune.ts
const OUTBOX_RETENTION_DAYS = 30;
async function prune(): Promise<void> {
  const cutoff = new Date(Date.now() - OUTBOX_RETENTION_DAYS * 86400 * 1000);
  await db.delete(schema.recordingEventsOutbox).where(
    or(
      and(
        isNotNull(schema.recordingEventsOutbox.deliveredAt),
        lt(schema.recordingEventsOutbox.deliveredAt, cutoff),
      ),
      // also reap stale UNDELIVERED rows older than N days — the reconcile
      // sweep (verified-ids) is the convergent backstop for those clients.
      lt(schema.recordingEventsOutbox.createdAt, cutoff),
    ),
  );
}
```

Wire from `buildApp()` next to `startVerifySweep`.

### CR-BL-03: `HumynUploadModule.reupload(...)` mutates the in-memory queue row outside the drain lock — cross-thread race with `UploadCoordinator.drainNow()`

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt:289-339`
**Severity:** critical

`reupload(recordingId)` does:

1. `val row = queueStore.read().find { it.recordingId == recordingId }` — reads a shared, mutable `UploadRow` reference from disk.
2. Mutates `row.state`, `row.uploadId`, `row.imuUploadId`, `row.videoParts[].status`, `row.imuParts[].status`, `row.metadataPut`, etc. **directly on the in-memory object**.
3. THEN calls `queueStore.upsert(row)` to persist.

`UploadCoordinator.drainNow()` running on the FGS `HandlerThread` is iterating the SAME row reference. The `drainNow` `ReentrantLock` only serializes drain-vs-drain — it does NOT exclude `reupload()`'s row-mutation pass. So:

- Thread A (FGS): `drainNow()` → `uploadOne(row)` → halfway through part PUTs.
- Thread B (bridge): `reupload(id)` → mutates `row.uploadId = null`, `row.videoParts[].status = PENDING`, `row.metadataPut = PENDING`, then `queueStore.upsert(row)` while Thread A is still iterating `row.videoParts`.
- Thread A then writes its own `queueStore.upsert(row)` at line 337 with a half-mutated row — losing or corrupting Thread B's reset.

Also: in the `worker-fired re-upload` (else-branch at line 316), the mutation does `for (p in row.videoParts) { p.status = ... }` — Thread A might be `partExecutor.submit { ... uploadPart(row.videoParts, partNumber, ...) }` against the same list, hitting a non-thread-safe `ArrayList`.

The Plan-05-06 design comment explicitly justifies the drain-lock, but `reupload` is OUTSIDE that lock.

**Fix:** Make `reupload()` acquire the drain lock (or re-implement via `cancelInflight() + drainLock.lock() + mutate-and-upsert`). The simplest: drop the in-place mutation and have the bridge call a new `UploadCoordinator.markForReupload(recordingId, fullReset: Boolean)` method that takes the drain lock, reads fresh, mutates, upserts.

### CR-BL-04: `verify-sweep` cron re-enqueues a `recordings_to_verify` row whose recording moved to `takedown` indefinitely — wasted Redis/SQS traffic + an unbounded `recordings_to_verify` table

**File:** `apps/api/src/cron/verify-sweep.ts:23-35`, `apps/api/src/lib/verify-recording.ts:66-72`
**Severity:** critical

`verify-recording.ts:67-71` documents the design: when the row moved to `takedown` during the rehash window, the `recordings_to_verify` queue row is LEFT in place. The comment says "the verify-sweep cron reaps it after MAX_ATTEMPTS." But `findStaleVerifyRows` (lines 23-35) only returns rows with `attempts < MAX_ATTEMPTS` — there is no DELETE pass for rows whose `attempts >= MAX_ATTEMPTS`. So once the row hits 8 attempts, it simply stops being re-enqueued and sits in `recordings_to_verify` forever. The row has a FK to `recordings(id) ON DELETE CASCADE`, but takedown is a state flip, not a delete (`qaStatus = 'takedown'`), and the queue row leaks for every taken-down upload.

Also, until `attempts >= 8`, the sweep enqueues 8 BullMQ jobs per such row over ~80 min, each of which calls `verifyRecording()` → reads the recording row → `if (rec.qaStatus !== 'uploaded') return;` — that's 8 round-trips to Redis + 8 SELECTs + 8 S3 GetObject HEAD-equivalent calls per taken-down recording.

**Fix:**

- In `verify-recording.ts`, when the `rec.qaStatus !== 'uploaded'` early-return branch hits (line 41), DELETE the `recordings_to_verify` row — the recording will never re-enter `uploaded`, so the queue row is dead weight:

```ts
if (rec.qaStatus !== 'uploaded') {
  await db
    .delete(schema.recordingsToVerify)
    .where(eq(schema.recordingsToVerify.recordingId, recordingId));
  return;
}
```

- Add a `recordings_to_verify` reaper sweep that DELETEs rows with `attempts >= MAX_ATTEMPTS` to bound the table.

---

## WARNINGS

### WR-01: `processRecordingEvents` has a read-modify-write race on `UPLOAD_PROCESSED_EVENTS` MMKV blob

**File:** `apps/mobile/src/services/recordingEvents.ts:88-114`

The processed-events set is stored as a JSON-array string under one MMKV key. `processRecordingEvents` loops over the events and, **inside the loop**, calls `readProcessed()` → mutates → `writeProcessed()`. Two concurrent invocations (e.g. an `_events` envelope from `GET /me` racing with one from `GET /recordings/verified-ids`) overlap; invocation A reads `["X:verified"]`, B reads `["X:verified"]`, A pushes `Y:verified` → writes `["X:verified", "Y:verified"]`, B pushes `Z:re-upload` → writes `["X:verified", "Z:re-upload"]` — `Y:verified` is lost. Convergent in practice (the local file is already gone, native no-ops), but the dedup contract is silently violated.

**Fix:** Move `readProcessed()` to OUTSIDE the loop and a single `writeProcessed(set)` to the end (or guard with a module-level mutex).

### WR-02: `interceptEvents` runs `processRecordingEvents` synchronously on the JS thread for every authenticated response

**File:** `apps/mobile/src/services/api.ts:128-138`

`interceptEvents` does a sync MMKV read, a JSON parse, a `.push`, a JSON stringify, a sync MMKV write — all on the JS thread, before the awaited promise resolves. PROCESSED_CAP is 500 (~25 KB string per call). With the reconcile sweep + `_events` carriers, fires several times per app launch.

**Fix:** Move the dedup bookkeeping to `queueMicrotask(() => processRecordingEvents(ev))` so the response promise resolves first.

### WR-03: `verifyRecording` uses the stale `rec.userId` (read pre-rehash) for `appendOutboxEvent`'s `userId`

**File:** `apps/api/src/lib/verify-recording.ts:34-71`

The flow is: SELECT rec → re-hash from S3 (multi-second window) → UPDATE inside transaction. The `appendOutboxEvent({ userId: rec.userId, ... })` uses the **stale** `rec.userId`. If `userId` got reassigned during the rehash window (extremely unlikely — there's no UPDATE path for `recordings.userId` in this codebase — but the schema doesn't enforce it as immutable), the outbox row references a userId that no longer owns the recording.

**Fix:** Re-read `userId` from the UPDATE's `returning()` and use that for the outbox row.

### WR-04: `events-outbox` plugin's `await drainOutbox(sub)` adds to TTFB on every authenticated JSON call

**File:** `apps/api/src/plugins/events-outbox.ts:38-62`

Synchronous per-request DB query in the `onSend` hook. Fast on a clean outbox (partial index) but compounds with the CR-BL-02 backlog; no per-user "checked recently, was empty, skip" memo, no early return.

**Fix:** Per-user LRU memo with a 5-second TTL, or move the drain to `setImmediate(...)` after `reply.send()` (rely on reconcile sweep as the backstop).

### WR-05: `drainOutbox` + `markDelivered` are not in a transaction and lack `SKIP LOCKED` — two concurrent requests from the same user re-deliver the same events

**File:** `apps/api/src/lib/recording-events.ts:41-66`, `apps/api/src/plugins/events-outbox.ts:54-60`

`drainOutbox(sub)` (SELECT) → mutate response body → `markDelivered(rows.map(r => r.id))` (UPDATE). No `FOR UPDATE SKIP LOCKED`. Two concurrent authenticated calls SELECT the same undelivered rows, both attach them, both `markDelivered` — the client receives the SAME `_events` payload twice. The plugin header says "client de-dups on `(recording_id, event_type)`" so it's not a correctness break, but it doubles TTFB cost and mobile bandwidth.

**Fix:** Use `SELECT ... FOR UPDATE SKIP LOCKED` inside a tx that wraps the drain+mark pair, OR document that the design intentionally accepts duplicate delivery.

### WR-06: `UploadCoordinator.shutdown()` has a misleading docstring and shutting down mid-drain dead-letters a row that was logically clean

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:233-238`

`HumynUploadModule.invalidate()` correctly does NOT call `coordinator.shutdown()` (only detaches emitters — `HumynUploadModule.kt:501-509`). But `shutdown()` exists, is public, and its docstring at line 232 references `HumynUploadModule.invalidate()` suggesting the wrong caller. If a future contributor wires it up, `drainExecutor.shutdownNow()` + `partExecutor.shutdownNow()` mid-drain interrupts `chunkUploader.uploadPart(...)` → `DeadLetterException("upload interrupted", e)` — a row gets dead-lettered on what is logically a clean shutdown.

**Fix:** Either remove `shutdown()` or have it acquire `drainLock` and wait for the in-flight drain to finish before shutting down the executors. Also fix the docstring.

### WR-07: `parseInitResponse` rethrows `IOException` on 2xx-with-non-JSON-body, making it transient — infinite retry against a misconfigured endpoint

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:551-573`

Comment at line 549 justifies a body-free `IOException` to keep retry-transient semantics (T-5-06-02). Good on the leak side, but on a 2xx with a non-JSON body (a misconfigured proxy, a LocalStack dev shim returning HTML) the row never dead-letters — the next drain hits the same endpoint, gets the same non-JSON, retries forever.

**Fix:** Distinguish a non-2xx (transient — current behavior) from a 2xx-with-bad-JSON (treat as dead-letter):

```kotlin
} catch (e: org.json.JSONException) {
    throw DeadLetterException("$label response not valid JSON", null)
}
```

### WR-08: `presignVideoParts` is also used to presign IMU parts — misleading name has burned the team once

**File:** `apps/api/src/routes/recordings/init.ts:52`, `apps/api/src/routes/recordings/parts.ts:155-156`

`presignVideoParts(s3, bucket, key, uploadId, partsCount)` is a pure presigner. It's used for IMU parts too (`init.ts:89`, `parts.ts:156`). A future change that special-cases video behavior inside `presignVideoParts` will silently break IMU presigning.

**Fix:** Rename to `presignMultipartParts` or `presignParts` (one-line rename across three files).

### WR-09: `reupload.ts` mints fresh `CreateMultipartUpload` ids but doesn't `AbortMultipartUpload` the row's stale `s3UploadId` — S3 storage cost grows per reupload cycle

**File:** `apps/api/src/routes/recordings/reupload.ts:146-217`

The reupload flow: row in `hash-mismatch` has `s3UploadId='stale-upload-id'`. Reupload mints `videoMu` + `imuMu` via `CreateMultipartUpload`, then `UPDATE recordings SET s3UploadId = videoMu.UploadId`. The original `'stale-upload-id'` multipart is NEVER aborted — its parts (if any survived) sit in S3 indefinitely, billed monthly. With the design "uncapped hash-mismatch retries per recording" (D-04a), orphan growth is per-user proportional.

**Fix:** Abort the prior video multipart before minting a new one:

```ts
if (rec.s3UploadId) {
  await s3
    .send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: keys.video,
        UploadId: rec.s3UploadId,
      }),
    )
    .catch((err) => {
      if ((err as { name?: string }).name !== 'NoSuchUpload') throw err;
    });
}
```

Alternative: an S3 lifecycle rule for `AbortIncompleteMultipartUpload` after N days (separate infra change).

### WR-10: `verify-sweep` cron `tick()` is serial — N×(Redis RTT + DB RTT) per tick

**File:** `apps/api/src/cron/verify-sweep.ts:46-52`

`SWEEP_INTERVAL_MS = 5 * 60_000`. If stale rows accumulate during a Redis/SQS outage and one tick comes back with 1000 IDs, serial at 100 ms RTT each is 100 s — overlapping with the next tick. Not a correctness break (`jobId` dedup collapses doubles), but pegs the worker pod's event loop.

**Fix:** Batch with bounded concurrency (`Promise.all(slice(50).map(...))`).

### WR-11: `aws_iam_role.worker_execution_role` has formatting drift — double-space in `assume_role_policy`

**File:** `infra/terraform/modules/verify-queue/main.tf:137`

```hcl
assume_role_policy  = data.aws_iam_policy_document.ecs_assume.json   # double space
```

`terraform fmt` will rewrite on every CI run.

**Fix:** `terraform fmt infra/terraform/modules/verify-queue/main.tf`.

### WR-12: `sqs-poller` `JSON.parse(body)` is called twice for non-recording messages

**File:** `apps/api/src/workers/sqs-poller.ts:99-125`

`parseRecordingIdFromS3Event(body)` returns `null` for both "parseable-but-not-ours" and "unparseable". To distinguish, the poller re-parses at line 108. Throwaway cost per malformed message; over the lifetime of the long-poll loop, adds up.

**Fix:** Return a discriminated result:

```ts
export type ParseResult =
  | { kind: 'valid'; recordingId: string }
  | { kind: 'not-ours' }
  | { kind: 'unparseable' };
```

### WR-13: `HumynForegroundService.onStartCommand` `idleStopRunnable` has a subtle cross-thread sequencing race

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt:71, 220, 234-236`

`maybeScheduleIdleStop()` runs on the `uploadHandler` thread, posts a runnable to `mainHandler` that re-checks `queueHasWork()` but not `uploadActive.get()` or `recordingActive.get()`. The end state can be: idleStop scheduled AFTER an active upload restarted.

**Fix:** Re-check `uploadActive.get()` AND `recordingActive.get()` AND `queueHasWork()` inside the runnable on the main thread before scheduling the idle stop.

### WR-14: `RecordingScreen.handleStop`'s `HumynUpload.pause()`/`.resume()` swallow real failures silently

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:376-384`

The inner `.catch(() => undefined)` silently swallows any rejection from the async native call. This includes the FGS `startService` being denied by Android 14+ background-launch rules — a real failure mode on the `logout` path. A failed resume leaves the queue paused invisibly; the user sees no error; uploads silently stall.

**Fix:** Log the rejection via `logEvent('upload_pause_resume_failed', ...)` so the failure mode is observable in production telemetry.

### WR-15: `HumynUploadModule.reupload` doesn't document which fields are preserved across both branches

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt:261-285`

`UploadRow.enqueuedAt` is currently `val` (immutable — good). But the `reupload()` doc doesn't enumerate the fields preserved in each branch, making a future refactor that converts `enqueuedAt` to `var` (e.g. to "reset" the queue position on a retry) risky — silently changes Pending-Uploads UI sort order.

**Fix:** Add a "Fields preserved across both branches: `enqueuedAt`, `ownerUserId`, `mp4Path`, `csvPath`, `jsonPath`, `taskId`, `isPractice`, `chunkBytes`, `partsCount`, `*IdempotencyKey`" comment block above the `when`.

### WR-16: `verified-ids.ts` cursor resolution is two roundtrips per call — hot path

**File:** `apps/api/src/routes/recordings/verified-ids.ts:30-66`

The route resolves `since` (a recording_id) → `(verified_at, id)` via a SELECT, then issues the main SELECT. Two roundtrips per cursor-paginated call. The mobile client cold-starts and AppState→active call this.

**Fix:** Make `since` an opaque base64-encoded `{id, verifiedAt}` tuple (or accept `?since_id=&since_at=`), and store both alongside `UPLOAD_RECONCILE_CURSOR` on the client.

### WR-17: `chunkUploader.uploadPart` `ps.retryCount++` undercounts actual retries

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/ChunkUploader.kt:188-210`

`putPart` may loop up to 6 times internally; `ps.retryCount` advances by 1 per `uploadPart` invocation, not per actual retry. Per-row telemetry under-reports transfer-layer retries.

**Fix:** Have `putPart` accept an `onAttempt: () -> Unit` callback that increments `ps.retryCount`.

### WR-18: `MssSocketFactory.ClampedSocket.connect()` uses uncached reflective `Socket.getFileDescriptor$()` lookup

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/ChunkUploader.kt:268-291`

`Socket::class.java.getDeclaredMethod("getFileDescriptor$")` is called for every socket the upload pipeline opens (no memoization). ~200 μs per call. On a 1000-part upload that's ~200 ms invisible overhead. Hidden API; Android 15 enforcement may make it silently no-op.

**Fix:** Cache the reflective `Method` reference on first successful invocation; emit a one-shot Crashlytics breadcrumb when it succeeds vs. fails.

### WR-19: `recordings-finalize.test.ts` only covers length-1 `videoParts` — multi-part PartNumber-order regression slips through

**File:** `apps/api/test/routes/recordings-finalize.test.ts:124-127, 158-160`

`videoParts: [{ partNumber: 1, etag: v1 }]` always has length 1. The finalize route's `req.body.videoParts.map(...)` works for length 1, but the multi-part case (the production case for 8 MiB Wi-Fi chunks on a ≥9 MB recording) isn't covered. A regression that sorts `videoParts` differently (AWS expects ascending PartNumber on `CompleteMultipartUpload`) would pass these tests.

**Fix:** Add a 3-part finalize test that asserts the `CompleteMultipartUploadCommand` `Parts` array is in ascending PartNumber order.

---

## INFO (FYI — not warranted as separate findings)

### IN-01: `infra/terraform/modules/redis/main.tf` lacks `at_rest_encryption_enabled = true`

`engine_version = "7.1"` (good — matches CLAUDE.md Redis 7.x pin). No multi-AZ, no encryption at rest, no AUTH token — single-node `cache.t4g.micro` MVP is correct per plan, but the absence of `at_rest_encryption_enabled = true` is worth a Phase-6 follow-on.

### IN-02: `MainApplication.kt:77-78` `compat-probe-*.mp4` orphan sweep should be extended to `upload-queue/*.partial`

`UploadQueueStore.writeAtomic` leaves `.partial` files on a process crash; currently no sweep reaps them, so the cruft can accumulate.

### IN-03: `verify-recording.ts:51-91` duplicates the `(rowCount === 1)` branch logic between two `tx.update(...)` calls

A small helper would compress this and reduce the chance of one branch diverging from the other in a future edit.

---

## Findings Summary

| Severity           | Count  |
| ------------------ | ------ |
| Critical (BLOCKER) | 4      |
| Warning            | 19     |
| Info               | 3      |
| **Total**          | **26** |

**Top-priority fixes (gate before ship):**

1. **CR-BL-01** — add `import org.junit.Assert.assertNotEquals` to `UploadCoordinatorTest.kt` (one line, blocks CI).
2. **CR-BL-02** — wire an outbox-retention sweep cron (~30 LOC, mirrors DSR cron pattern).
3. **CR-BL-03** — gate `HumynUploadModule.reupload()` through `coordinator.drainLock` (concurrency hazard the existing tests don't exercise).
4. **CR-BL-04** — `verifyRecording` early-return branch should DELETE the `recordings_to_verify` row, and add a `MAX_ATTEMPTS` reaper to bound the table.

The most load-bearing files to re-walk after the fixes: `apps/api/src/lib/verify-recording.ts`, `apps/api/src/cron/verify-sweep.ts`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt`.

---

_Reviewer: Claude (gsd-code-reviewer), spawned by `/gsd:code-review 5` from /gsd:execute-phase 5 orchestrator._
_Depth: standard. No source files were modified — review is read-only._
