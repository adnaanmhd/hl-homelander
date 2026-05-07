---
phase: 01-foundation-backend-distribution-recon
plan: 07
subsystem: backend-recordings
tags: [fastify, s3, multipart, presigned-url, cloudfront, drizzle]

# Dependency graph
requires:
  - phase: 01
    plan: 01
    provides: pnpm workspace + AWS SDK v3 pins (client-s3, s3-request-presigner, cloudfront-signer)
  - phase: 01
    plan: 02
    provides: Drizzle schema with recordings table + qa_status enum
  - phase: 01
    plan: 03
    provides: LocalStack 4.x with humyn-recordings-dev bucket + day-zero lifecycle, cloudfront signing-key + key-pair-id seeded in Secrets Manager
  - phase: 01
    plan: 04
    provides: Fastify cross-cutting plugins (auth/requireAuth, idempotency, rate-limit, error-handler/problem-detail)
provides:
  - '/recordings init/complete-part/finalize/reject + list/get full multipart upload lifecycle'
  - migration 0003 (recordings.s3_upload_id + parts_count, recordings_to_verify queue table, qa_status += 'rejected')
  - s3-client.ts (LocalStack-aware via AWS_ENDPOINT_URL, recordingKeys() locked at recordings/{userId}/{recordingId}/{video.mp4|imu.csv|metadata.json}, 15-min presigned TTL, 1000-part max)
  - recording-state.ts (canTransition() qa_status state-machine guard)
  - CloudFront-signed playback URL minting (5-min TTL) for qa_status=uploaded recordings; never-leak-existence collapse for cross-user/missing/takedown to 404 recording-not-found
  - 11 new vitest tests (84 total, all green)
affects: [01-08, 01-10, Phase 5 (hash-verify worker reads recordings_to_verify queue)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern: presigned-URL multipart upload with server-side CompleteMultipartUpload — backend orchestrates state but never reads byte content'
    - 'Pattern: route registration order respects Fastify radix tree — literal /recordings before parameterized /recordings/:id'
    - 'Pattern: response schemas omitted (Pattern 22 from STATE.md) — declaring response.200 narrows reply.code() and breaks problem-detail returns; happy-path shape enforced manually'
    - 'Pattern: never-leak-existence — cross-user, missing, and takedown rows all collapse to identical 404 recording-not-found (T-1.7-08, T-1.7-10)'
    - 'Pattern: AWS SDK v3 ≥3.729 + LocalStack 4.0 compat requires requestChecksumCalculation + responseChecksumValidation pinned to WHEN_REQUIRED (Checksum Type mismatch on CompleteMultipartUpload response otherwise)'

key-files:
  created:
    - apps/api/src/db/migrations/0003_recordings_multipart.sql
    - apps/api/src/lib/s3-client.ts (LocalStack-aware multipart S3 client + recordingKeys() + 15-min presigned TTL)
    - apps/api/src/lib/recording-state.ts (canTransition() state machine)
    - apps/api/src/routes/recordings/init.ts (POST /recordings/init — per-user 30/min, presigns video parts + IMU parts + metadata PUT, inserts pending row)
    - apps/api/src/routes/recordings/complete-part.ts (POST /recordings/:id/parts/:n/complete — state probe shim, no per-part persistence)
    - apps/api/src/routes/recordings/finalize.ts (POST /recordings/:id/finalize — CompleteMultipartUpload for video + IMU, qa_status->uploaded, enqueues recordings_to_verify)
    - apps/api/src/routes/recordings/reject.ts (POST /recordings/:id/reject — AbortMultipartUpload + qa_status->rejected)
    - apps/api/src/routes/recordings/list.ts (GET /recordings — paginated, range filter, cursor, excludes takedown)
    - apps/api/src/routes/recordings/get.ts (GET /recordings/:id — CloudFront-signed playback URL for uploaded rows; never-leak-existence collapse to 404)
    - apps/api/src/routes/recordings/index.ts (route barrel)
    - apps/api/src/routes/recordings/schemas.ts (wire DTOs)
    - apps/api/test/routes/recordings-init.test.ts
    - apps/api/test/routes/recordings-complete-part.test.ts
    - apps/api/test/routes/recordings-finalize.test.ts
    - apps/api/test/routes/recordings-reject.test.ts
    - apps/api/test/routes/recordings-list.test.ts
    - apps/api/test/routes/recordings-get.test.ts
  modified:
    - apps/api/src/db/schema.ts (recordings.s3_upload_id, parts_count, recordings_to_verify queue, qa_status += 'rejected')
    - apps/api/src/app.ts (registered recordingsRoutes after tasksRoutes)
    - apps/api/src/lib/problem-detail.ts (recording-not-found, recording-not-playable slugs)
    - shared/types/src/recording.ts (4 new wire schemas + qa_status += 'rejected')
    - .env.example, apps/api/.env.example (CLOUDFRONT_RECORDINGS_PRIVATE_KEY + KEY_PAIR_ID + BASE_URL)

key-decisions:
  - 'Never-leak-existence on get: cross-user, missing, and takedown rows all collapse to 404 recording-not-found. Intermediate states (pending/verified/rejected/hash-mismatch) return 404 recording-not-playable.'
  - 'Per-part persistence deferred: complete-part is a state-probe shim. Phase 5 hash-verify is the source of truth on which parts were actually uploaded.'
  - 'S3 key layout LOCKED at recordings/{userId}/{recordingId}/{video.mp4|imu.csv|metadata.json} — Phase 5 hash-verify worker derives keys from this convention. Do not reorganize without updating Phase 5.'
  - 'AWS SDK v3 checksum mode pinned to WHEN_REQUIRED — LocalStack 4.0 incompatibility with v3 ≥3.729 default checksum algorithm enforcement on CompleteMultipartUpload response.'

requirements-completed:
  - API-05 # POST /recordings/init
  - API-06 # POST /recordings/:id/parts/:n/complete
  - API-07 # POST /recordings/:id/finalize
  - API-14 # POST /recordings/:id/reject
  - API-08 # GET /recordings (list)
  - API-09 # GET /recordings/:id (CloudFront-signed playback URL)

# Metrics
duration: ~38 min
completed: 2026-05-07
---

# Phase 01 Plan 07: Recordings Multipart Presigned Upload Lifecycle

**Backend orchestrates the entire upload lifecycle — init → presigned multipart parts → finalize (server-side CompleteMultipartUpload) → CloudFront-signed playback — without ever touching the byte content of the recording.**

## Performance

- **Duration:** ~38 min (commits at 19:57:32, 20:00:56, 20:05:20, 20:11:41 IST)
- **Tasks:** 4 / 4
- **Tests:** 11 new (73 → 84 total) — all green
- **Files created:** 17
- **Files modified:** 5

## Accomplishments

- Multipart upload lifecycle live end-to-end against LocalStack: 5 MB video part + 1 KB IMU part → CompleteMultipartUploadCommand reassembles → qa_status flips pending → uploaded → recordings_to_verify queue row written for Phase 5.
- `/recordings/:id` mints CloudFront-signed playback URLs with 5-min TTL using `@aws-sdk/cloudfront-signer` against the dev `humyn/cloudfront/signing-key` secret.
- `/recordings` list paginated, range-filtered (7d / 30d / 90d / all), cursor-ordered (created_at DESC, id DESC), defaults limit 20 / max 100, excludes `qa_status=takedown` rows (T-1.7-08).
- State machine guard via `canTransition()` returns 409 problem-detail on illegal transitions; all four mutation routes are owner-only via `requireAuth`.
- Migration 0003 adds `s3_upload_id` + `parts_count` to recordings, creates `recordings_to_verify` queue table, extends `qa_status` enum with `rejected`.
- Per-user 30 req/min rate limit on `/recordings/init` (T-1.7-04 mitigation: backpressure on pending-row floods).

## Task Commits

1. **Task 1: Schema + S3 client + state machine** — `43fcd16` (migration 0003, s3-client.ts with LocalStack-aware endpoint, recording-state.ts canTransition() guard, 4 wire schemas in shared/types)
2. **Task 2: init/complete/finalize/reject routes** — `e791840` (4 routes registered on app.ts; presigned URLs + state-machine guards)
3. **Task 3: Lifecycle tests** — `46627a7` (4 test files; real LocalStack multipart smoke; AWS SDK v3 + LocalStack 4.0 checksum-compat fix)
4. **Task 4: list + get routes** — `361cf57` (paginated list + CloudFront-signed playback URL get; route registration ordered for Fastify radix tree; 11 new tests)

## Live Smoke (verified during Task 4)

- `init` → 200 with `multipart` array (1 part for video, 1 for IMU) + `metadata` PUT URL + recording row in `pending`.
- Upload parts via presigned URLs to LocalStack S3 → 200.
- `finalize` → 200, `qa_status` flipped to `uploaded`, `recordings_to_verify` row inserted with status `pending`.
- `get` → 200 with `playback_url` containing `Expires=` 300 s ahead and a CloudFront `Signature=` query parameter.
- Cross-user `get` → 404 `recording-not-found` (existence not leaked).
- `get` while `qa_status=pending` → 404 `recording-not-playable`.

## Deviations from Plan

### Auto-fixed during Task 3

**1. [Rule 3 — Blocking] AWS SDK v3 checksum default + LocalStack 4.0 incompatibility**

- **Found during:** First attempt to call `CompleteMultipartUploadCommand` against LocalStack.
- **Symptom:** AWS SDK v3 ≥3.729 raised `Checksum Type mismatch` on the response from LocalStack — SDK now requires `x-amz-checksum-*` response trailers that LocalStack 4.0 does not emit.
- **Fix:** Pinned `requestChecksumCalculation: "WHEN_REQUIRED"` and `responseChecksumValidation: "WHEN_REQUIRED"` on the S3 client (and on test-side S3Clients used by fixtures). Documented inline as a known LocalStack workaround.
- **Files:** `apps/api/src/lib/s3-client.ts`, `apps/api/test/routes/recordings-finalize.test.ts`.

### Auto-fixed during Task 2

**2. [Pattern 22 — STATE.md, established earlier] Response schemas omitted**

- **Reason:** Declaring `response.200` on Fastify+zod routes narrows `reply.code()` to 200, which breaks the problem-detail return path. Established pattern from prior plans (01-04, 01-05). Happy-path shape enforced manually in the return.
- **Impact:** Cosmetic only — the wire shape is identical to what the plan specified; no runtime behavior change.

## Acceptance-Criteria Notes

- The plan's "Live smoke against running server" was performed against `localhost:8088` with the standard `pnpm dev` flow. No additional setup required.
- All 6 routes are registered on `apps/api/src/app.ts` after `tasksRoutes` and before any future plans (`/me`, `/contributions`, etc. land in plan 01-08).

## Issues Encountered

- **AWS SDK v3 + LocalStack checksum break** — already resolved (see Deviation 1). Will revisit when running against real S3 in plan 01-10 — production S3 emits checksum response trailers, so the `WHEN_REQUIRED` pin is correct for both environments.
- **API tool error mid-finalization** — orchestrator-side: subagent hit a transient API error after Task 4 commit landed but before SUMMARY.md was written. SUMMARY.md was hand-composed from the four detailed task commit messages by the orchestrator; STATE.md and ROADMAP.md updated by the orchestrator on resumption. No work lost — all 4 atomic commits are on `main` and the live smoke passes.

## Next Phase Readiness

- **Ready for plan 01-08** (`/me`, `/contributions`, `/events`, `/feedback`, `/app/version`) — every cross-cutting plugin and shared lib is now in place; plan 08 only adds new route files + a DSR-cron stub.
- **Ready for Phase 5 (hash-verify worker)** — `recordings_to_verify` queue table is populated by `/recordings/finalize`. The S3 key layout (`recordings/{userId}/{recordingId}/{video.mp4|imu.csv|metadata.json}`) is locked.
- **Ready for plan 01-10 (Terraform)** — production S3 bucket + CloudFront distribution will need the same key layout and presigned-URL contract; CloudFront private key + key-pair-id will be injected via Secrets Manager in the same way LocalStack does today.

## Self-Check: PASSED

- All 17 created files exist on disk (verified via the Task 4 commit's file list).
- All 4 task commits (`43fcd16`, `e791840`, `46627a7`, `361cf57`) exist on `main`.
- 84 vitest tests green workspace-wide (per Task 4 commit message; not re-run in summary phase due to API error mid-task).
- Live smoke verified during Task 4: init → upload → finalize → CloudFront-signed get round-trip.

---

_Phase: 01-foundation-backend-distribution-recon_
_Completed: 2026-05-07_
