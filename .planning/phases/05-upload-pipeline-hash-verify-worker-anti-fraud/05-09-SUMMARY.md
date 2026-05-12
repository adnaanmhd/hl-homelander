---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 09
subsystem: api
tags: [fastify, s3, multipart-upload, presigned-urls, drizzle, zod, idempotency]

# Dependency graph
requires:
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: 'POST /recordings/init + /finalize + /complete-part + /reupload (Plan 01-07 / 05-05), recordings.s3UploadId column, recordingKeys() + presigned-URL helpers in s3-client.ts'
provides:
  - "POST /recordings/init is idempotent (CR-02): a duplicate /init for a pending row owned by the caller re-presigns video parts against the row's stored s3UploadId (NO 2nd video CreateMultipartUpload) + a fresh CreateMultipartUpload on the IMU stream only → 200 with the SAME uploadId; wrong owner → 403 (no row fields); non-pending → 409; never a no-op 201; .onConflictDoNothing() removed — self-heals the lost-201 retry loop"
  - "POST /recordings/:id/parts (UP-04) — re-presign video + IMU part URLs against the existing multipart uploads with NO CreateMultipartUpload/INSERT/UPDATE/state-change; the upload coordinator's preferred re-drain path (preserves DONE video AND IMU parts' ETags)"
  - 'shared-types: RecordingRePresignRequestSchema { partsCount, imuUploadId } + RecordingRePresignResponseSchema (= RecordingsInitResponseSchema)'
  - 'presignVideoParts / presignImuStream / presignMetadata helpers exported from init.ts (reused by /parts)'
affects: [05-10-mobile-upload-coordinator-re-drain, upload-pipeline, mobile-upload-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'SELECT-first idempotency guard on a create-style POST: SELECT the row before any side-effecting S3 call; if it exists, branch on owner (403) / state (409) / re-presign (200) and never INSERT a second row — drop .onConflictDoNothing() so a genuine concurrent-INSERT race is a 500, not a silent stale-id 201'
    - "Re-presign-only route: re-mint UploadPartCommand / PutObjectCommand presigns against EXISTING multipart upload-ids with zero DB writes and zero qa_status changes — preserves already-uploaded parts' ETags on a re-drain"

key-files:
  created:
    - apps/api/src/routes/recordings/parts.ts
    - apps/api/test/routes/recordings/parts.test.ts
  modified:
    - apps/api/src/routes/recordings/init.ts
    - apps/api/src/routes/recordings/index.ts
    - shared/types/src/recording.ts
    - apps/api/test/routes/recordings/init.test.ts

key-decisions:
  - "On a re-/init the IMU stream restarts (fresh CreateMultipartUpload) while the video stream keeps its upload-id: the IMU upload-id was never persisted on the row (no s3ImuUploadId column — only s3UploadId for video), so it's the single id that can't be re-presigned; a fresh one orphans nothing because the video upload it accompanies has zero uploaded parts at re-/init time. The dangling prior IMU upload is reaped by the bucket's AbortIncompleteMultipartUpload lifecycle rule (WR-07's domain)."
  - "/parts (which DOES take an imuUploadId in the body) is the coordinator's preferred re-drain route over re-/init — it re-presigns BOTH streams against existing ids with no state change. /init's idempotent path is the fallback (covers the lost-201 case where the client never persisted the ids)."
  - "Concurrent-INSERT race accepted as a 500 (was a silent 201 with a stale s3UploadId): the SELECT is immediately before the INSERT, the client is single-threaded per recording, and CR-03's drainLock serialises drains — not worth a SELECT … FOR UPDATE / advisory lock."

patterns-established:
  - 'SELECT-first idempotency on POST /recordings/init'
  - 'Re-presign-only route (POST /recordings/:id/parts) — no CreateMultipartUpload, no DB write'

requirements-completed: [UP-01, UP-04]

# Metrics
duration: ~25min
completed: 2026-05-12
---

# Phase 5 Plan 09: Idempotent /recordings/init + /recordings/:id/parts re-presign route Summary

**`POST /recordings/init` is now SELECT-first idempotent (a duplicate /init for a pending row re-presigns video against the stored s3UploadId + a fresh IMU multipart upload only → 200 with the same uploadId, `.onConflictDoNothing()` gone), and a new `POST /recordings/:id/parts` re-presigns video + IMU part URLs against the existing multipart uploads with zero state change — closing the duplicate-/init → un-finalizable-row bug, the lost-201 retry loop, and giving the mobile coordinator an ETag-preserving re-drain path (UP-01, UP-04).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-12T21:24Z
- **Completed:** 2026-05-12T21:34Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `POST /recordings/init` made idempotent: SELECT-first guard before any video `CreateMultipartUpload`; existing-row branches → 403 (wrong owner, no row fields) / 409 (`Cannot re-init from state <qaStatus>`) / 200 (re-presign video against `rec.s3UploadId` + a fresh `CreateMultipartUpload` on the IMU stream only, row NOT mutated); `.onConflictDoNothing()` removed; presign loops refactored into `presignVideoParts` / `presignImuStream` / `presignMetadata` helpers reused by both paths and by `/parts`.
- New `POST /recordings/:id/parts` route (173 lines): body `{ partsCount, imuUploadId }`; guards 400 (partsCount > MAX) / 404 (not found) / 403 (wrong owner) / 409 (non-pending) / 409 (no s3UploadId); on success re-presigns `partsCount` `UploadPartCommand`s against `rec.s3UploadId` (video) + `body.imuUploadId` (IMU) + a `PutObjectCommand` for metadata → 200 with `uploadId === rec.s3UploadId`; NO `CreateMultipartUpload`/`db.update`/`db.insert`/`qaStatus` change; registered after `completePartRoute`, before `recordingsGetRoute`.
- shared-types: `RecordingRePresignRequestSchema` + `RecordingRePresignRequest` + `RecordingRePresignResponseSchema` (= `RecordingsInitResponseSchema`) + `RecordingRePresignResponse` (exported via the `export * from './recording.js'` barrel).
- Vitest: `init.test.ts` + 4 new cases (duplicate → 200 + same `uploadId` + fresh `imuUploadId` + unchanged DB `s3UploadId`; wrong-owner → 403 with no row fields; non-pending → 409 with the right title; brand-new → 201). `parts.test.ts` (new, 6 cases): pending → 200 + `uploadId` unchanged + `partUrls`/`imuPartUrls` lengths + `imuUploadId` echoed + DB row unchanged; 404 / 403 (no row fields) / 409 / 400 / 401. Full api suite: 39 files, 161 tests, all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: make POST /recordings/init idempotent (SELECT-first; CR-02)** — `ecbf426` (feat)
2. **Task 2: add POST /recordings/:id/parts re-presign route (UP-04)** — `432a567` (feat)

_Note: both tasks were `tdd="true"`; the implementation + tests landed in one commit each (the route + spec moved together cleanly)._

## Files Created/Modified

- `apps/api/src/routes/recordings/init.ts` — SELECT-first idempotent `/init`; `presignVideoParts`/`presignImuStream`/`presignMetadata` helpers; `.onConflictDoNothing()` removed; `eq` imported from `drizzle-orm`.
- `apps/api/src/routes/recordings/parts.ts` — new `POST /recordings/:id/parts` re-presign route (no `CreateMultipartUpload`/state-change).
- `apps/api/src/routes/recordings/index.ts` — imports + registers `recordingsRePresignRoute` after `completePartRoute`, before `recordingsGetRoute`.
- `shared/types/src/recording.ts` — `RecordingRePresignRequestSchema` + `RecordingRePresignResponseSchema` + types.
- `apps/api/test/routes/recordings/init.test.ts` — 4 new idempotency cases + a second seeded user (`OTHER_USER_ID`); `recordingKeys` import; `initPayload` helper.
- `apps/api/test/routes/recordings/parts.test.ts` — new spec, 6 cases.

## Decisions Made

- IMU stream restarts on a re-/init (fresh `CreateMultipartUpload`), video keeps its upload-id — the IMU upload-id is the one id never persisted on the row; a fresh one orphans nothing (zero uploaded parts at re-/init time); the dangling prior IMU upload is reaped by the bucket's `AbortIncompleteMultipartUpload` lifecycle rule (WR-07's domain).
- `/parts` (takes an `imuUploadId` in the body) is the coordinator's _preferred_ re-drain route — re-presigns BOTH streams against existing ids, zero state change; `/init`'s idempotent path is the fallback covering the lost-201 case.
- Concurrent-INSERT race accepted as a 500 (down from a silent 201 with a stale `s3UploadId`) — the SELECT is immediately before the INSERT, the client is single-threaded per recording, CR-03's `drainLock` serialises drains.
- Kept the handler's `partsCount > MAX_PARTS_PER_UPLOAD` guard in both `init.ts` and `parts.ts` even though Zod's `.max(1000)` makes it unreachable — matches `reupload.ts`'s defensive pattern; the test's `partsCount: 1001` case asserts only `statusCode === 400` so it passes via either path.

## Deviations from Plan

None — plan executed exactly as written. (Minor: `existing.partsCount` is typed `number | null` in the Drizzle row type, so the idempotent re-presign path uses `existing.partsCount ?? body.partsCount` — a one-line null-coalesce, not a behaviour change; the column is always set on INSERT so the fallback never fires in practice.)

## Issues Encountered

- The worktree had no `node_modules` (pnpm installs at the workspace root) — ran `pnpm install` in the worktree once. Tests need `DATABASE_URL` / `AWS_ENDPOINT_URL` / `JWT_SIGNING_SECRET` / etc. exported (no `.env` in the worktree) — the LocalStack-gated test blocks (`describeIf` on `AWS_ENDPOINT_URL`) ran against the running dev `humyn-localstack` / `humyn-postgres` containers.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `POST /recordings/:id/parts` exists and is ready for Plan 05-10 (the mobile upload coordinator's "call `/recordings/:id/parts` on a re-drain instead of re-`/init`" change — wave 2, depends on this route).
- No blockers.

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
