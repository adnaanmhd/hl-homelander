---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 03
subsystem: api
tags: [bullmq, ioredis, redis, sqs, sha256, drizzle, postgres, outbox, s3, worker, cron]

# Dependency graph
requires:
  - phase: 05-02
    provides: Wave-1 docs/housekeeping closed (state aligned, CLAUDE.md anti-fraud banner reconciled)
  - phase: 01-foundation-backend-distribution-recon
    provides: recordings + recordings_to_verify tables, qa_status enum, recording-state.ts, s3-client.ts (recordingKeys/RECORDINGS_BUCKET), routes/recordings/finalize.ts (the qa_status-flip transaction shape), cron/dsr-hard-delete.ts (the timer-loop shape), the numbered-SQL migration convention (tsx scripts/migrate.ts)
provides:
  - Redis dev container (redis:7-alpine, localhost:6379) + REDIS_URL env contract
  - bullmq@5.76.8 / ioredis@5.10.1 / @aws-sdk/client-sqs@3.1044.0 deps on apps/api
  - apps/api/src/lib/queue.ts — getRedisConnection() / getQueue() lazy singletons + enqueueVerify(recordingId) (jobId=recordingId → idempotent enqueue)
  - recording_events_outbox table + recording_event_type enum + migration 0006 (pushed to the live dev DB) + partial index recording_events_outbox_user_undelivered_idx ON (user_id) WHERE delivered_at IS NULL
  - recording-state.ts hash-mismatch → pending edge (re-upload re-enters the upload lifecycle); isTerminal('hash-mismatch') unchanged
  - apps/api/src/lib/sha256-stream.ts — sha256OfS3Object(key) streamed GetObject().Body → crypto.createHash via stream/promises.pipeline (the byte-fidelity carve-out — server reads recording bytes here and only here)
  - apps/api/src/lib/recording-events.ts — appendOutboxEvent(tx,...) / drainOutbox(userId) / markDelivered(ids)
  - apps/api/src/lib/verify-recording.ts — verifyRecording(recordingId): re-hash → qa_status flip + outbox event in one transaction, idempotent, transient S3 error propagates (BullMQ retries)
  - apps/api/src/workers/hash-verify.ts — standalone BullMQ Worker('verify') ECS task entrypoint (node dist/workers/hash-verify.js), concurrency 4
  - apps/api/src/cron/verify-sweep.ts — re-enqueues stale recordings_to_verify rows (belt-and-suspenders for at-least-once); wired into app.ts
  - shared/types: RecordingServerEventSchema ({recording_id, event_type})
  - Wave-0 test harness: test/fixtures/stub-bundle.ts + test/lib/sha256-stream.test.ts + test/workers/verify-recording.test.ts + test/lib/recording-state.test.ts + test/lib/queue.test.ts
affects: [05-04, 05-05, 05-06, 05-07, 05-08, terraform-infra]

# Tech tracking
tech-stack:
  added: [bullmq@5.76.8, ioredis@5.10.1, '@aws-sdk/client-sqs@3.1044.0', redis:7-alpine (dev)]
  patterns:
    - 'Lazy memoized singletons for the Redis connection + BullMQ queue (same shape as s3-client.ts#getS3Client) — importing lib/queue.ts never opens a socket until something enqueues'
    - 'Outbox table + onSend-hook delivery for server→client events (the table + enqueue side ships here; the onSend hook is Plan 05-05)'
    - 'Streamed SHA-256 of an S3 object via stream/promises.pipeline — memory-bounded, never buffer-collects a multi-GB object'
    - 'Idempotent worker service: early-return if the row is missing or not in the expected qa_status — a redelivered queue message re-running the flip is a no-op'
    - 'Standalone ECS task entrypoint under src/workers/ — same Docker image as the API, different entrypoint; does not import buildApp()'
    - 'jobId = recordingId on BullMQ add() so a double-enqueue (SQS redelivery + verify-sweep cron) collapses to one job'

key-files:
  created:
    - apps/api/src/lib/queue.ts
    - apps/api/src/lib/sha256-stream.ts
    - apps/api/src/lib/recording-events.ts
    - apps/api/src/lib/verify-recording.ts
    - apps/api/src/workers/hash-verify.ts
    - apps/api/src/cron/verify-sweep.ts
    - apps/api/src/db/migrations/0006_recording_events_outbox.sql
    - apps/api/test/fixtures/stub-bundle.ts
    - apps/api/test/lib/queue.test.ts
    - apps/api/test/lib/recording-state.test.ts
    - apps/api/test/lib/sha256-stream.test.ts
    - apps/api/test/workers/verify-recording.test.ts
  modified:
    - docker-compose.yml
    - .env.example
    - apps/api/.env.example
    - apps/api/package.json
    - apps/api/src/db/schema.ts
    - apps/api/src/lib/recording-state.ts
    - apps/api/src/app.ts
    - shared/types/src/recording.ts

key-decisions:
  - "Migration numbered 0006 (the live DB only had 0001..0005 applied — the plan's '0008' label was off; the repo's active convention is hand-written numbered SQL applied via tsx scripts/migrate.ts, not drizzle-kit, whose meta/_journal.json only tracks 0001)"
  - 'Migration 0006 is fully idempotent (DO-block guard around CREATE TYPE, IF NOT EXISTS on table+indexes) — matches the 0005 style'
  - "ioredis imported as `import { Redis } from 'ioredis'` (the named export) — `import Redis from 'ioredis'` resolves to the namespace under NodeNext module resolution and isn't constructable as a type"
  - 'shared/types: did NOT bump SHARED_TYPES_VERSION — additive, non-breaking; Plan 05-05 adds more to recording.ts (the _events envelope + /reupload + /verified-ids schemas) and can bump then'
  - "verify-sweep wired into app.ts under its own `NODE_ENV !== 'test'` guard (not the GSD_DSR_CRON escape-hatch) — keeps the Redis connection from opening under the singleFork test pool"
  - 'metadata-cross-check (assert metadata.file_sha256 === rec.fileSha256) left out of verifyRecording — the plan marked it optional/behind-a-comment; the column hashes are the source of truth and D-03a means no special-casing duration:0/null drift'
  - "[BLOCKING] schema-push checkpoint satisfied non-interactively: `DATABASE_URL=... pnpm db:migrate` applied 0006 cleanly (committed-SQL convention, no drizzle-kit prompts); verified via `docker exec humyn-postgres psql` (\\d recording_events_outbox + \\dT recording_event_type + the partial index)"

patterns-established:
  - 'Server byte-fidelity boundary: the hash-verify worker (sha256-stream.ts + verify-recording.ts) is the only component that reads recording bytes, read-only + streamed; the Fastify API never touches recording bytes'
  - 'Outbox event row written inside the same db.transaction that flips qa_status — no lost-event window'

requirements-completed: [VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-07]

# Metrics
duration: 10min
completed: 2026-05-12
---

# Phase 5 Plan 03: Hash-Verify Worker Backend Foundation Summary

**The BullMQ-on-Redis hash-verify worker foundation — Redis dev container + bullmq/ioredis/sqs deps + the queue singleton, the recording_events_outbox table + enum + migration (pushed), the hash-mismatch→pending state edge, the streamed-SHA-256 helper, the outbox CRUD, the verify-one-recording service, the standalone Worker entrypoint, the stale-row re-enqueue cron, the shared-types stub, and the Wave-0 Vitest scaffolds — all green against the live LocalStack + pushed DB.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-12T11:31:31Z
- **Completed:** 2026-05-12T11:41:44Z
- **Tasks:** 5 (Task 3 was the [BLOCKING] schema-push checkpoint — satisfied non-interactively, no code commit)
- **Files modified:** 20 (12 created, 8 modified)

## Accomplishments

- `apps/api/src/lib/queue.ts` + the `redis:7-alpine` dev container + `bullmq@5.76.8` / `ioredis@5.10.1` / `@aws-sdk/client-sqs@3.1044.0` — the queue layer the worker subscribes to (VERIFY-01).
- `recording_events_outbox` table + `recording_event_type` enum + migration `0006` **pushed to the live dev DB** (table + partial index `recording_events_outbox_user_undelivered_idx ON (user_id) WHERE delivered_at IS NULL` + the enum confirmed present via `psql`).
- `lib/verify-recording.ts` — re-hashes `video.mp4` + `imu.csv` from S3 (VERIFY-02), matches → `qa_status='verified'` + outbox `'verified'` (VERIFY-03), mismatch → `qa_status='hash-mismatch'` + outbox `'re-upload'` (VERIFY-04), all in one transaction, idempotent on re-delivery, transient S3 error propagates so BullMQ retries.
- `workers/hash-verify.ts` — the standalone ECS-task BullMQ `Worker('verify')` entrypoint, `concurrency: 4`, horizontally safe by design (VERIFY-07).
- `cron/verify-sweep.ts` — re-enqueues stale `recordings_to_verify` rows (belt-and-suspenders for at-least-once), wired into `app.ts`.
- `recording-state.ts` — `hash-mismatch → pending` edge (closes the Pitfall-9 re-upload gap on the state layer); `isTerminal('hash-mismatch')` still true.
- Wave-0 test harness: `test/fixtures/stub-bundle.ts` + `test/lib/sha256-stream.test.ts` + `test/workers/verify-recording.test.ts` + `test/lib/recording-state.test.ts` + `test/lib/queue.test.ts` — 20 tests, all green (the LocalStack+DB suites pass against the dev stack + the pushed schema; gated on `AWS_ENDPOINT_URL` so they skip cleanly without it).

## Task Commits

1. **Task 1: Redis dev container + deps + lib/queue.ts** — `8ad71e4` (feat)
2. **Task 2: recording_events_outbox schema + migration + recording-state.ts edit** — `2e93a29` (test — RED gate), `81cac90` (feat — GREEN gate)
3. **Task 3: [BLOCKING] Drizzle schema push** — no commit (checkpoint task; satisfied non-interactively via `DATABASE_URL=... pnpm db:migrate`, verified via `docker exec ... psql`)
4. **Task 4: sha256-stream + recording-events + verify-recording + worker + cron + app.ts wiring + shared-types stub** — `06ea206` (feat)
5. **Task 5: LocalStack+DB Vitest scaffolds + stub-bundle fixture** — `8052030` (test)

**Plan metadata:** (this commit — docs)

_Note: Task 2 is a `type: tdd` task — its RED commit (`2e93a29`) precedes its GREEN commit (`81cac90`); no REFACTOR commit was needed._

## Files Created/Modified

- `apps/api/src/lib/queue.ts` — `getRedisConnection()` / `getQueue()` lazy singletons + `enqueueVerify(recordingId)` (jobId=recordingId)
- `apps/api/src/lib/sha256-stream.ts` — `sha256OfS3Object(key)`: streamed GetObject().Body → crypto.createHash via stream/promises.pipeline
- `apps/api/src/lib/recording-events.ts` — `appendOutboxEvent(tx,...)` / `drainOutbox(userId)` / `markDelivered(ids)` over `recording_events_outbox`
- `apps/api/src/lib/verify-recording.ts` — `verifyRecording(recordingId)`: re-hash → qa_status flip + outbox event in one transaction, idempotent
- `apps/api/src/workers/hash-verify.ts` — standalone BullMQ `Worker('verify')` entrypoint, concurrency 4, pino logger, SIGTERM/SIGINT graceful close
- `apps/api/src/cron/verify-sweep.ts` — `findStaleVerifyRows()` + `startVerifySweep()`/`stopVerifySweep()` mirroring `cron/dsr-hard-delete.ts`
- `apps/api/src/db/migrations/0006_recording_events_outbox.sql` — `CREATE TYPE recording_event_type` + `CREATE TABLE recording_events_outbox` + partial index + (user_id, created_at) index; idempotent
- `apps/api/test/fixtures/stub-bundle.ts` — synthetic video/IMU-CSV/metadata blobs + their precomputed SHA-256s
- `apps/api/test/lib/{queue,recording-state,sha256-stream}.test.ts`, `apps/api/test/workers/verify-recording.test.ts` — the Wave-0 scaffolds
- `docker-compose.yml` — `redis:7-alpine` service (localhost:6379, healthcheck)
- `.env.example` / `apps/api/.env.example` — `REDIS_URL=redis://localhost:6379`
- `apps/api/package.json` — `bullmq` / `ioredis` / `@aws-sdk/client-sqs` deps + `worker:hash-verify` / `worker:hash-verify:dev` scripts
- `apps/api/src/db/schema.ts` — `recordingEventTypeEnum` + `recordingEventsOutbox` table
- `apps/api/src/lib/recording-state.ts` — `ALLOWED['hash-mismatch'] = ['pending','takedown']`
- `apps/api/src/app.ts` — `startVerifySweep(app.log)` under the `NODE_ENV !== 'test'` guard
- `shared/types/src/recording.ts` — `RecordingServerEventSchema`

## Decisions Made

See `key-decisions` in the frontmatter. Highlights: migration numbered **0006** (not the plan's "0008" — the live DB only had 0001..0005; the active convention is hand-written numbered SQL via `tsx scripts/migrate.ts`); `import { Redis } from 'ioredis'` (named export — NodeNext); `SHARED_TYPES_VERSION` not bumped (additive, Plan 05-05 owns the next bump); the metadata-cross-check left out of `verifyRecording` (column hashes are the source of truth); the [BLOCKING] schema-push checkpoint was satisfied non-interactively.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `import { Redis } from 'ioredis'` instead of `import Redis from 'ioredis'`**

- **Found during:** Task 1 (lib/queue.ts)
- **Issue:** The plan's snippet used `import Redis from 'ioredis'`; under the repo's `module: NodeNext` setting that resolves to the ioredis _namespace_, which `tsc --noEmit` rejects ("Cannot use namespace 'Redis' as a type" / "This expression is not constructable") — the pre-commit hook blocked the commit.
- **Fix:** Switched to the named import `import { Redis } from 'ioredis'` (ioredis v5 exports the class under that name).
- **Files modified:** apps/api/src/lib/queue.ts
- **Verification:** `pnpm tsc --noEmit` exits 0; `pnpm vitest run test/lib/queue.test.ts` exits 0.
- **Committed in:** `8ad71e4` (Task 1 commit)

**2. [Rule 1 - Bug] `sha256-stream.ts` header comment literally contained the forbidden buffer-collect API name**

- **Found during:** Task 5 (running the plan's `<verification>`)
- **Issue:** The plan's `<verification>` asserts `grep -rn 'transformToByteArray' apps/api/src/lib/sha256-stream.ts` returns nothing; the explanatory header comment ("never calls .transformToByteArray()...") tripped that grep.
- **Fix:** Reworded the comment to "never buffer-collects a multi-GB object into memory" — same meaning, no literal API name.
- **Files modified:** apps/api/src/lib/sha256-stream.ts
- **Verification:** `grep -rn 'transformToByteArray' apps/api/src/lib/sha256-stream.ts` exits 1 (no match); `pnpm tsc --noEmit` exits 0; the LocalStack sha256-stream tests still pass.
- **Committed in:** `8052030` (Task 5 commit)

**3. [Rule 1 - Bug] test fixture user/task/recording IDs were 27 chars (varchar(26) overflow)**

- **Found during:** Task 5 (running the verify-recording integration test against the live DB)
- **Issue:** `TEST_USER_ID = '01HVTVERIFY00000000000000US'` and the queue test's `recordingId` were 27 chars — `value too long for type character varying(26)`.
- **Fix:** Trimmed to valid 26-char ULID-shaped strings (`01HVTVERIFYUSER0000000000A`, etc.).
- **Files modified:** apps/api/test/workers/verify-recording.test.ts, apps/api/test/lib/queue.test.ts
- **Verification:** `pnpm vitest run test/workers/verify-recording.test.ts test/lib/queue.test.ts` exits 0 with the dev stack up.
- **Committed in:** `8052030` (Task 5 commit)

**4. [Plan label correction] Migration numbered 0006, not 0008**

- **Found during:** Task 2 (creating the migration)
- **Issue:** The plan said "the next number is 0008"; the migrations directory only has 0001..0005 and the live DB's `schema_migrations` table confirmed only those five were applied.
- **Fix:** Created `0006_recording_events_outbox.sql` (the actual next free number) in the 0005 style; pushed it via `pnpm db:migrate`.
- **Files modified:** apps/api/src/db/migrations/0006_recording_events_outbox.sql
- **Verification:** `pnpm db:migrate` applied it; `docker exec humyn-postgres psql -c "\d recording_events_outbox"` shows the table + partial index; `"\dT recording_event_type"` shows the enum.
- **Committed in:** `81cac90` (Task 2 GREEN commit)

---

**Total deviations:** 4 (1 blocking, 2 bugs, 1 plan-label correction) — all auto-handled.
**Impact on plan:** No scope creep. The blocking/bug fixes were required for the code to compile + the tests to pass against the live DB; the 0006-vs-0008 correction matched the plan to the actual repo state. All plan-prescribed files exist, compile, and the prescribed verifications pass.

## Issues Encountered

- The pre-commit hook (`tsc --noEmit` via husky) caught the ioredis namespace-import type error on the first Task 1 commit attempt — fixed and re-committed (deviation #1). No other issues.
- Note for future executors: `pnpm vitest` in this environment does **not** auto-load `apps/api/.env` into `process.env` — the LocalStack+DB-gated tests skip unless the env is exported (`set -a && source apps/api/.env`). This matches the plan's `<verify>` which `echo`s "skipped" when `$AWS_ENDPOINT_URL` is unset. With the env sourced + the dev stack up, all 6 LocalStack+DB tests pass.

## TDD Gate Compliance

Plan task `Task 2` is `tdd="true"`: RED commit `2e93a29` (`test(05-03): add failing test for hash-mismatch → pending state edge` — confirmed failing before implementation), GREEN commit `81cac90` (`feat(05-03): ...`). No REFACTOR commit needed (the change was a single `ALLOWED` map entry). Tasks 4 and 5 are also marked `tdd="true"` but their testable behaviors (`sha256OfS3Object`, `verifyRecording`) require LocalStack + the pushed DB, so per the plan their tests land in Task 5 (committed `8052030`) — Task 4's own `<verify>` is `tsc --noEmit` + the `recording-state.test.ts` regression, which passed.

## User Setup Required

None — no external service configuration required. (The new `REDIS_URL` is in `.env.example`; the `redis:7-alpine` container is added to `docker-compose.yml` and comes up with `docker compose up -d redis` / the existing `scripts/dev-up.sh` should be updated to include `redis` in a follow-on, but that's not blocking.)

## Next Phase Readiness

- Plan 05-05 (depends on this) can now build: the `events-outbox` `onSend` plugin (uses `drainOutbox`/`markDelivered`), `POST /recordings/:id/reupload` (uses the `hash-mismatch → pending` edge), `GET /recordings/verified-ids`, the `req.ip` fix, and the `/finalize` dev shim that enqueues `verify` jobs (uses `enqueueVerify`). The `_events` envelope + the `/reupload`/`/verified-ids` zod schemas are still Plan 05-05's to add to `shared/types/src/recording.ts`.
- The Terraform side (ElastiCache Redis + EventBridge rule + SQS queue + the 2nd ECS task def for `node dist/workers/hash-verify.js` + the VERIFY-07 autoscale policy) is Plan 05-05's infra task.
- One minor follow-on (non-blocking): `scripts/dev-up.sh` still only starts `postgres localstack pgadmin` — add `redis` to its `docker compose up -d` line.

## Self-Check: PASSED

All 12 created source/test files + the SUMMARY exist on disk; all 5 task commits (`8ad71e4`, `2e93a29`, `81cac90`, `06ea206`, `8052030`) are in git history.

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
