---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
reviewed: 2026-05-12T14:52:34Z
depth: standard
files_reviewed: 44
files_reviewed_list:
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
  - apps/api/src/routes/recordings/finalize.ts
  - apps/api/src/routes/recordings/index.ts
  - apps/api/src/routes/recordings/init.ts
  - apps/api/src/routes/recordings/reupload.ts
  - apps/api/src/routes/recordings/schemas.ts
  - apps/api/src/routes/recordings/verified-ids.ts
  - apps/api/src/workers/hash-verify.ts
  - apps/mobile/App.tsx
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
  - shared/types/src/index.ts
  - shared/types/src/recording.ts
findings:
  critical: 3
  warning: 9
  info: 5
  total: 17
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-12T14:52:34Z
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Reviewed the Phase-5 upload pipeline: the `HumynUpload` Android native module + S3 multipart coordinator, the BullMQ hash-verify worker, and the server→client `recording_events_outbox` channel. The code is generally careful (owner-pin guards, atomic queue writes, presigned-URL hygiene in the happy path, idempotent enqueue via `jobId`), but there are three correctness defects that break the pipeline for exactly the target conditions (slow cellular, process kills): the coordinator re-POSTs `/recordings/init` on every retry — minting a _new_ S3 multipart upload that orphans the already-uploaded parts' ETags; `/recordings/init` is non-idempotent server-side (returns `201` with a stale `s3UploadId`) which compounds it; and `drainNow()` is `public` and invoked directly off three different threads with no mutual exclusion, contradicting the "only one drain at a time" invariant the design depends on. A `finalize` that fails between the two `CompleteMultipartUpload` calls leaves a permanently un-finalizable recording. The events channel mutates problem-detail responses and has an unrecoverable loss window for `re-upload` events.

## Critical Issues

### CR-01: Coordinator re-POSTs `/recordings/init` on every retry → orphaned multipart parts, never recovers

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:194-233`
**Issue:** `uploadOne()` is called for any row in `PENDING`/`UPLOADING`/`FINALIZING` and _unconditionally_ calls `postInit()` (or `postReupload()`) near the top, then skips parts already `DONE` (keeping their cached ETags). But each `POST /recordings/init` creates a brand-new S3 multipart upload with a new `uploadId`. The ETags of parts uploaded under the _previous_ `uploadId` are not valid for the new one, so when the second drain's `uploadOne()` reaches `/finalize` with a mix of old + new ETags, S3 returns `InvalidPart`. That surfaces as an `IOException` in `drainNow()`, which is treated as _transient_ (not `DeadLetterException`) — so the row spins forever, never dead-letters, never uploads. This bites on every process-kill-mid-upload (OS LMK, force-quit, crash) and on every upload that exceeds the 15-min presigned TTL (large file on slow cellular — the documented target market).
**Fix:** Do not re-POST `/init` if the row already has `uploadId != null` AND any DONE parts. Either (a) add a server endpoint that re-presigns part URLs against the _existing_ `uploadId` (no `CreateMultipartUpload`), and have the coordinator call it on a re-drain; or (b) on a re-drain, `AbortMultipartUpload` the prior upload, reset _all_ parts to `PENDING` (drop cached ETags), and start over from the new `uploadId`. Sketch of (b):

```kotlin
val isReupload = row.reupload
val needsFreshUpload = isReupload || row.uploadId == null
if (!needsFreshUpload) {
    // re-presign against row.uploadId — requires a new server route; do NOT call /init
    ...
} else {
    if (row.uploadId != null) abortPriorMultipart(baseUrl, row) // don't leak the old one
    row.videoParts.forEach { it.status = PartStatus.PENDING; it.etag = null }
    row.imuParts.forEach { it.status = PartStatus.PENDING; it.etag = null }
    val initResp = if (isReupload) postReupload(...) else postInit(...)
    ...
}
```

### CR-02: `POST /recordings/init` is non-idempotent — second call returns 201 with a stale `s3UploadId`

**File:** `apps/api/src/routes/recordings/init.ts:86-191`
**Issue:** `init` always issues a fresh `CreateMultipartUpload` for video + IMU and presigns part URLs, but persists the row with `.onConflictDoNothing()`. When the client (e.g. the retry path in CR-01) calls `/init` again for an existing `recordingId`, the row's `s3UploadId` column is NOT updated — it still holds the _first_ `uploadId`. The response body, however, returns the _second_ `uploadId` + part URLs bound to it. The client uploads to the second upload; `/finalize` then uses `rec.s3UploadId` (the first) → `NoSuchUpload` / `InvalidPart`. The recording is permanently un-finalizable. Independently, returning HTTP `201` when nothing was inserted is misleading and leaks an orphaned multipart upload (no lifecycle abort) on every duplicate call.
**Fix:** Detect the conflict explicitly: `SELECT` the row first; if it exists and belongs to the caller and is still `pending`, treat `/init` as idempotent and _return its stored `s3UploadId`_ (re-presigning part URLs against it) instead of creating a new multipart upload; if it exists and is in a non-`pending` state, return a `409` problem-detail. Only `CreateMultipartUpload` + `INSERT` when there is no row. Never return `201` when the `INSERT` was a no-op.

### CR-03: `drainNow()` runs concurrently on three threads with no mutual exclusion

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:124-172, 482-505`; `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt:211-222`; `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadJobService.kt:37-53`
**Issue:** `getShared()`'s comment claims "only one drain runs at a time (the drain is also serialised internally on `drainExecutor`)", but `drainNow()` is `public` and is invoked **directly** — bypassing `drainExecutor` — from `HumynForegroundService.startUploadDrain()` (on the FGS `HandlerThread`) and from `UploadJobService.onStartJob()` (on a freshly-`start()`ed `Thread`), in addition to `HumynUploadModule.drain()` which _does_ hop onto `drainExecutor`. So the FGS thread and the JobService thread (and a module-driven drain) can all be inside `drainNow()` simultaneously: each iterates `queueStore.read()`, each calls `uploadOne(row)` on the same row, each POSTs `/recordings/init` for the same recording (compounding CR-01/CR-02), each lays out `row.videoParts`, each writes the shared mutable `row` back via `upsert`, and `row.uploadId` is overwritten by whichever finishes last. `synchronized(queueStore){ ... }` inside `uploadOne` doesn't help — `UploadQueueStore.upsert()` synchronizes on its own _private_ `lock` field, a different monitor than the `queueStore` instance.
**Fix:** Make `drainNow()` private and route all three callers through `drain()` (the `drainExecutor`-serialised entry); or add an explicit `private val drainLock = ReentrantLock()` and wrap the body of `drainNow()` in `if (!drainLock.tryLock()) return; try { ... } finally { drainLock.unlock() }`. Also fix the bogus `synchronized(queueStore)` in `uploadOne` — synchronize on the same object `UploadQueueStore` uses internally, or just rely on `upsert`'s own lock and drop the wrapper.

## Warnings

### WR-01: `finalize` is not atomic across the two `CompleteMultipartUpload` calls → permanently stuck recording

**File:** `apps/api/src/routes/recordings/finalize.ts:127-152`
**Issue:** The video `CompleteMultipartUpload` is sent, then the IMU one. If the IMU call fails (network blip, throttling), the video upload is already reassembled and _consumed_ in S3, but the DB row stays `pending` (the state flip is in a later `db.transaction`). A client retry re-issues the video `CompleteMultipartUpload` with the same — now-consumed — `s3UploadId` → `NoSuchUpload`. The recording can't be finalized (`/finalize` 500s forever — transient in the coordinator, never dead-letters) and can't be re-`/init`'d (CR-02). Combined with CR-01/CR-02 the same retry also won't help.
**Fix:** Make `/finalize` retry-safe: before each `CompleteMultipartUpload`, swallow `NoSuchUpload`/`already-completed` and `HeadObject` the key to confirm the object exists with the expected size; or do the IMU complete first (smaller, less likely to fail) and gate the video complete on it; or record per-channel completion progress on the row so a retry resumes. At minimum, on a `NoSuchUpload` for a channel whose object already exists, treat it as success rather than 500.

### WR-02: hash-verify worker's `qa_status` flip uses a stale read — no `WHERE qa_status = 'uploaded'` guard (TOCTOU)

**File:** `apps/api/src/lib/verify-recording.ts:21-60`
**Issue:** `rec` is `SELECT`ed once; the (expensive, multi-second) S3 re-hash happens outside the transaction; then `db.transaction` does `UPDATE recordings SET qa_status='verified' WHERE id = recordingId` with no `AND qa_status = 'uploaded'` predicate. If an ops action flipped the row to `takedown` (or a re-upload moved it to `pending`) during the hash window, this UPDATE silently resurrects it to `verified` and writes a stale outbox event. The `canTransition(rec.qaStatus, ...)` checks inside are dead — `rec.qaStatus` is always `'uploaded'` there because it was never re-read.
**Fix:** Add `AND qa_status = 'uploaded'` to both UPDATEs (and only append the outbox event / delete the `recordings_to_verify` row if the UPDATE affected a row), or re-`SELECT ... FOR UPDATE` the row inside the transaction and re-check `canTransition()`.

### WR-03: `events-outbox` onSend hook mutates problem-detail (`application/problem+json`) responses and consumes events on error responses

**File:** `apps/api/src/plugins/events-outbox.ts:29-48`
**Issue:** The hook fires on _every_ authenticated string-bodied JSON-object response, including `reply.type('application/problem+json').send(pd)` (404/403/409 from `finalize`/`reupload`). It JSON-parses the problem detail, adds `_events`, re-stringifies — so RFC 7807 error bodies now carry a non-standard `_events` key, and any pending outbox events are _marked delivered_ on a response a client is likely to treat as a hard failure and not parse for `_events`. Those events are then lost (until the reconcile sweep, which only backstops `verified` — see WR-04).
**Fix:** Skip the hook when the response status is ≥ 400, or when the content-type isn't `application/json`. E.g. `if (_reply.statusCode >= 400) return payload;` and/or check `_reply.getHeader('content-type')`.

### WR-04: a dropped `re-upload` event is unrecoverable — the reconcile sweep only backstops `verified`

**File:** `apps/api/src/routes/recordings/verified-ids.ts:18-67`; `apps/mobile/src/services/uploadReconcile.ts:74-116`
**Issue:** `events-outbox` is at-least-once with a documented loss window (response bytes drop _after_ `markDelivered`). For `verified` events the reconcile sweep (`GET /recordings/verified-ids`) is the convergent backstop. There is no equivalent for `re-upload` (hash-mismatch) events: if one is lost, the server has the row in `hash-mismatch` while the client thinks it's `awaiting-verify` forever — nothing reconciles, the local file is never re-uploaded, and the user has no recovery path.
**Fix:** Either make `verified-ids` also report `hash-mismatch` ids (and have the sweep call `HumynUpload.reupload()` for them), or add a `GET /recordings/mismatched-ids` companion, or have the client's `awaiting-verify` rows periodically `GET /recordings/:id` to learn the server state.

### WR-05: `RecordingFinalizeSchema` has no upper bound on `videoParts`/`imuParts` length, and no consistency check vs the row's `partsCount`

**File:** `shared/types/src/recording.ts:107-116`; `apps/api/src/routes/recordings/finalize.ts:127-152`
**Issue:** `videoParts: z.array(FinalizePartSchema)` is unbounded. A client can POST a huge array, which is forwarded verbatim into `MultipartUpload.Parts`. AWS will reject > 10 000 parts, but the array is fully materialised + sent first. There's also no check that `videoParts.length === rec.partsCount` or that part numbers are unique/contiguous, so a malformed client can produce confusing S3 errors instead of a clean 400.
**Fix:** `z.array(FinalizePartSchema).min(1).max(1000)` (matching `MAX_PARTS_PER_UPLOAD`); in the route, validate the part-number set against `rec.partsCount` and return a `validation` problem-detail on mismatch.

### WR-06: `parseInitResponse` throws a `JSONException` whose message includes the raw response body (presigned URLs) into a `Log.w`

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:425-443, 166-170`
**Issue:** If `/recordings/init` (or `/reupload`) returns a body that isn't valid JSON, `JSONObject(text)` throws `org.json.JSONException` whose message embeds a snippet of `text` — which on a near-miss response could contain presigned S3 URLs (signature query params). That exception propagates to `drainNow()`'s transient catch → `Log.w(TAG, "row ${row.recordingId} upload failed transiently: ${e.message}")` → presigned URLs in logcat (violates the T-5-06-02 "never log presigned URLs" intent).
**Fix:** In `parseInitResponse`/`postInit`/`postReupload`, catch `JSONException` and re-throw an `IOException("init response not valid JSON")` with no body content; never include `resp.body?.string()` in an exception message.

### WR-07: `init` mints `partsCount` presigned URLs for the IMU stream even though only part 1 is ever used; surplus + `init`-orphaned multipart uploads accumulate

**File:** `apps/api/src/routes/recordings/init.ts:123-137`; `apps/api/src/routes/recordings/reupload.ts:180-194`
**Issue:** Both routes presign `body.partsCount` IMU part URLs (up to 1000) when the client only ever uploads IMU part 1. More importantly, `/reupload` (and any `/init` retry) calls `CreateMultipartUpload` again without `AbortMultipartUpload`-ing the previous one — incomplete multipart uploads pile up in the bucket and bill until a lifecycle policy reaps them (and no such policy is referenced).
**Fix:** Presign only 1 IMU part URL; before re-minting in `/reupload`, `AbortMultipartUpload` any prior `s3UploadId`/IMU upload-id (store the IMU id on the row, or list-and-abort by prefix); ensure the S3 bucket has an `AbortIncompleteMultipartUpload` lifecycle rule.

### WR-08: `chunkVariantFor` / progress map keeps stale `progressById` entries forever; coordinator's `lastEmitMs` debounce map likewise unbounded

**File:** `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx:122, 138-148`; `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:116, 331-339`
**Issue:** `progressById` is only ever added to (on `onUploadProgress`), never pruned when a row leaves `uploading`. On the native side `lastEmitMs` is pruned only in `uploadOne`'s success tail (`lastEmitMs.remove`) — a dead-lettered or abandoned row's entry lingers. Slow unbounded growth keyed by recordingId; not a leak that matters at MVP volumes but unbounded nonetheless.
**Fix:** In `PendingUploadsScreen`, drop ids from `progressById` that aren't in the current `rows`; in `UploadCoordinator`, `lastEmitMs.remove(row.recordingId)` in the `DeadLetterException` branch of `drainNow` too.

### WR-09: `app.requireAuth`-gated routes derive `userId` via `(req.user as { sub: string }).sub` everywhere — no runtime assertion `sub` is present

**File:** `apps/api/src/routes/recordings/finalize.ts:77`; `apps/api/src/routes/recordings/init.ts:60-65`; `apps/api/src/routes/recordings/reupload.ts:74`; `apps/api/src/routes/recordings/verified-ids.ts:29`
**Issue:** Every recordings route does `const userId = (req.user as { sub: string }).sub` after `preHandler: [app.requireAuth]`. If a future refactor of the auth plugin populated `req.user` from a token without a `sub` claim (or as a string), `userId` would be `undefined` — which then flows into `recordingKeys()` (→ `recordings/undefined/.../video.mp4`) and `eq(schema.recordings.userId, undefined)` (Drizzle would likely emit `= NULL`, matching nothing — but the key derivation already wrote to an `undefined` prefix). The `as` cast hides this from the type checker.
**Fix:** Have `requireAuth` (or a tiny helper) assert `typeof req.user?.sub === 'string' && req.user.sub.length === 26` and 401 otherwise; expose a typed `req.userId` so routes don't re-cast.

## Info

### IN-01: `CaptureLaunchSweep.run()` always returns `emptyList()` — the crash-recovery toast path is dead code

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt:58-128`; `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt:86`
**Issue:** Post-D-03 the sweep never re-finalizes anything, so `pendingRecovery` is always an empty list and the `onCrashRecovery` event/toast can never fire. Documented as a "safety net", but it's effectively unreachable code carrying a `List<String>` plumbing it doesn't need.
**Fix:** Either delete the recovery-list plumbing (and the toast wiring) or leave a single TODO; not worth keeping a phantom code path live.

### IN-02: `UploadCoordinator.shutdown()` is never called — `watchdogExecutor`/`drainExecutor`/`partExecutor` live for the process lifetime

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:183-188`; `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt:422-430`
**Issue:** `HumynUploadModule.invalidate()` deliberately does _not_ call `coordinator.shutdown()` (it's a process-scoped singleton), and nothing else calls it. The three executors are daemon threads so it's not a process-exit blocker, but `shutdown()` is dead code as written.
**Fix:** Either remove `shutdown()` or document that it's test-only.

### IN-03: `HumynForegroundService.onRecordingFinalized()` / `setUploadActive(boolean)` instance methods are never invoked in production

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt:140-168`
**Issue:** The doc says the production path is the `ACTION_SET_UPLOAD_ACTIVE` intent dispatch; these two instance methods are "kept for same-package tests" but no caller in the reviewed source uses `onRecordingFinalized()`.
**Fix:** Mark `@VisibleForTesting` or drop `onRecordingFinalized()` if no test exercises it.

### IN-04: `RecordingsListItemSchema.qa_status` enum omits `'takedown'` — a `takedown` row reaching the serializer would 500

**File:** `apps/api/src/routes/recordings/schemas.ts:17-23`
**Issue:** The list response schema enumerates 5 of the 6 `qa_status` values; the comment says `takedown` rows are filtered at the DB layer. If that filter is ever missed, the strict zod serializer throws and the request 500s instead of degrading. (Same for `RecordingsGetResponseSchema.qa_status: z.enum(['uploaded'])`.)
**Fix:** Either include `'takedown'` in the enum and exclude such rows in the handler explicitly, or accept the coupling and add a comment-linked test that the DB query always filters `takedown`.

### IN-05: `verified-ids` cursor resolves arbitrary 26-char ids against the global `recordings` table

**File:** `apps/api/src/routes/recordings/verified-ids.ts:36-51`
**Issue:** When `since` is supplied, the route does `SELECT verified_at, id FROM recordings WHERE id = since` with no `user_id` predicate, then uses the resolved `verified_at` as a pagination bound. The result set is still gated by `userId`, so no cross-tenant data leaks — but an attacker can probe whether an arbitrary recording id exists and is verified by observing whether the extra `(verified_at, id) < (...)` predicate gets added (a faint timing/result-shape oracle).
**Fix:** Add `eq(schema.recordings.userId, userId)` to the cursor-resolution query so an out-of-scope id resolves nothing.

---

_Reviewed: 2026-05-12T14:52:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
