---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 12
subsystem: infra
tags: [sqs, bullmq, eventbridge, worker, aws-sdk, vitest]

# Dependency graph
requires:
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: the verify-queue Terraform module (EventBridge rule + SQS queue + worker task def) and the BullMQ `verify` queue + `enqueueVerify` + the hash-verify worker
provides:
  - apps/api/src/workers/sqs-poller.ts — the prod EventBridge→SQS→BullMQ trigger leg (the file the verify-queue worker task def's 2nd container references)
  - parseRecordingIdFromS3Event — pure, exported, defensive S3-event-key → recordingId parser
  - the worker:sqs-poller / worker:sqs-poller:dev npm scripts
affects: [phase-07-observability, deployment, verify-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Standalone ECS-container worker entrypoint mirroring hash-verify.ts (no buildApp; pino child logger; SIGTERM/SIGINT → graceful flag flip)'
    - "Test-importable worker module: bootstrap gated on WORKER_BOOTSTRAP !== 'false' so a unit test can import a pure exported helper without launching the loop"

key-files:
  created:
    - apps/api/src/workers/sqs-poller.ts
    - apps/api/test/workers/sqs-poller.test.ts
  modified:
    - apps/api/package.json
    - infra/terraform/modules/verify-queue/main.tf

key-decisions:
  - 'Bootstrap gate via WORKER_BOOTSTRAP env (not a separate module) keeps the pure parser unit-testable while preserving the single-file standalone-entrypoint shape used by hash-verify.ts'
  - "Key-mismatch-but-valid-JSON messages are DeleteMessage'd immediately (don't requeue garbage); non-JSON bodies are left to dead-letter after maxReceiveCount"

patterns-established:
  - 'Worker entrypoint shape: standalone, pino child logger keyed by component, signal handlers, bootstrap guard for tests'

requirements-completed: [VERIFY-01]

# Metrics
duration: 12min
completed: 2026-05-12
---

# Phase 5 Plan 12: prod sqs-poller (EventBridge→SQS→BullMQ trigger leg) Summary

**Implemented `apps/api/src/workers/sqs-poller.ts` — the standalone ECS worker that long-polls the `verify` SQS queue, derives `recordingId` from the S3 'Object Created' event key, `enqueueVerify`s a BullMQ job (jobId=recordingId → the 3 events per bundle collapse), and DeleteMessages — closing the dangling Terraform reference in the verify-queue worker task def.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-12T15:24Z (approx)
- **Completed:** 2026-05-12T15:59Z
- **Tasks:** 1 (TDD: RED + GREEN commits)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `apps/api/src/workers/sqs-poller.ts` exists and is the real prod EventBridge→SQS→BullMQ leg: imports `{ SQSClient, ReceiveMessageCommand, DeleteMessageCommand }` from `@aws-sdk/client-sqs`; standalone (no `buildApp`); `pino(loggerOptions).child({ component: 'sqs-poller' })`; `loop()` reads `process.env.VERIFY_QUEUE_URL` (fail-fast inside the loop, not at import); `while (running)` → `pollOnce` with `ReceiveMessageCommand({ MaxNumberOfMessages: 10, WaitTimeSeconds: 20, VisibilityTimeout: 60 })`; per message → `parseRecordingIdFromS3Event` → `enqueueVerify(recordingId)` → `DeleteMessageCommand`; `SIGTERM`/`SIGINT` → `running = false`; bootstrap gated on `WORKER_BOOTSTRAP !== 'false'`.
- `parseRecordingIdFromS3Event(messageBody)` exported + pure: JSON-parse in try/catch (→ `null`); handles both the EventBridge envelope (`detail.object.key`) and the S3-direct shape (`Records[0].s3.object.key`); best-effort `decodeURIComponent(key.replace(/\+/g, ' '))` with raw-key fallback; validates against `/^recordings\/[0-9A-HJKMNP-TV-Z]{26}\/([0-9A-HJKMNP-TV-Z]{26})\/(?:video\.mp4|imu\.csv|metadata\.json)$/` and returns capture group 2 (the `recordingId`) or `null`.
- `apps/api/package.json` gains `worker:sqs-poller` + `worker:sqs-poller:dev` (mirroring the hash-verify pair); `@aws-sdk/client-sqs@3.1044.0` confirmed pre-existing in `dependencies` (unchanged).
- `infra/terraform/modules/verify-queue/main.tf` — the `sqs-poller` container comment now references `apps/api/src/workers/sqs-poller.ts` (Plan 05-12); the "known stub" caveat dropped; `command = ["node","dist/workers/sqs-poller.js"]` + env/secrets/logConfiguration unchanged.
- Vitest coverage in `apps/api/test/workers/sqs-poller.test.ts`: 11 parser cases (well-formed EventBridge video.mp4/imu.csv/metadata.json → recordingId; non-`recordings/` prefix → null; non-base32 / wrong-length / I-L-O-U recordingId → null; non-JSON body → null; JSON-with-no-key → null; S3-direct body → recordingId; `%2F`-encoded key → resolves via decode; malformed-`%` key → null and no throw; empty body → null). All green; `tsc --noEmit` clean.

## Task Commits

1. **Task 1 (TDD RED): add failing parser tests for sqs-poller** — `ead20d0` (test)
2. **Task 1 (TDD GREEN): implement prod sqs-poller** — `03e3bc3` (feat)

_(No REFACTOR commit — the GREEN implementation was clean; the only post-GREEN tweak was a one-line `tsc`-driven fix folded into the same task scope, see Deviations.)_

## Files Created/Modified

- `apps/api/src/workers/sqs-poller.ts` (created) — the prod SQS long-poll → `enqueueVerify` → `DeleteMessage` loop + the exported pure `parseRecordingIdFromS3Event`.
- `apps/api/test/workers/sqs-poller.test.ts` (created) — Vitest parser unit tests; sets `WORKER_BOOTSTRAP=false` before importing the module.
- `apps/api/package.json` (modified) — `worker:sqs-poller` + `worker:sqs-poller:dev` scripts.
- `infra/terraform/modules/verify-queue/main.tf` (modified) — `sqs-poller` container comment cleanup (no structural change).

## Decisions Made

- **`WORKER_BOOTSTRAP` env gate** for the bootstrap line (`if (process.env.WORKER_BOOTSTRAP !== 'false') void loop();`) — keeps the module a single standalone entrypoint (matching `hash-verify.ts`) while making the pure parser unit-testable without a live SQS/Redis or a spinning loop. The `VERIFY_QUEUE_URL` fail-fast moved inside `loop()` so importing the module never `process.exit`s.
- **Bad-message handling split:** valid-JSON-but-wrong-key → `DeleteMessage` immediately (don't requeue garbage); non-JSON → leave it (dead-letters after the queue's `maxReceiveCount`). Logs `msgId` only — never the raw body or full key (threat T-5-12-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `m[1]` typed `string | undefined` under `noUncheckedIndexedAccess`**

- **Found during:** Task 1 (GREEN — `tsc --noEmit`)
- **Issue:** `return m ? m[1] : null;` failed `tsc` (`Type 'string | undefined' is not assignable to type 'string | null'`) because the project enables `noUncheckedIndexedAccess`.
- **Fix:** changed to `return m?.[1] ?? null;`
- **Files modified:** apps/api/src/workers/sqs-poller.ts
- **Verification:** `pnpm tsc --noEmit` exits 0; the 11 Vitest cases still pass.
- **Committed in:** `03e3bc3` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial type-safety fix; no scope change.

## Issues Encountered

- The worktree had no `node_modules` (fresh worktree). Ran `pnpm install --frozen-lockfile` (lockfile up to date, ~5s) to get `vitest` / `tsc` available — no dependency changes.
- Vitest 4 prints a `test.poolOptions was removed` deprecation warning from `vitest.config.ts` — pre-existing, out of scope, logged for awareness only (no action; `deferred-items.md` not touched since it's a known-config warning, not a code defect).
- The Vitest run emits a `SQS poller shutting down / signal: SIGTERM` log line at teardown — that's the process exiting and the SIGTERM handler firing; harmless (the loop never started under `WORKER_BOOTSTRAP=false`).

## User Setup Required

None — no external service configuration required. (The prod ECS worker task def already injects `VERIFY_QUEUE_URL` / `REDIS_URL` / `AWS_REGION` — Terraform, unchanged.)

## Next Phase Readiness

- VERIFY-01's prod trigger leg is now real, not a dangling reference — the `sqs-poller` container can run as the Terraform task def defines it.
- Dev still uses the `/finalize` LocalStack shim; `recordings_to_verify` + the `verify-sweep` cron remain the durable backstop either way.
- No blockers.

## Self-Check: PASSED

- Files: `apps/api/src/workers/sqs-poller.ts`, `apps/api/test/workers/sqs-poller.test.ts`, `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-12-SUMMARY.md` — all present.
- Commits: `ead20d0` (test/RED), `03e3bc3` (feat/GREEN), `5997257` (docs/SUMMARY) — all in history.
- `apps/api/package.json` has the `worker:sqs-poller` script; `infra/terraform/modules/verify-queue/main.tf` comment references `apps/api/src/workers/sqs-poller.ts`.
- Verification: `WORKER_BOOTSTRAP=false pnpm vitest run test/workers/sqs-poller.test.ts` → 11/11 pass; `pnpm tsc --noEmit` → exit 0.

## TDD Gate Compliance

- RED gate: `ead20d0` `test(05-12): add failing parser tests for sqs-poller` (test failed — module did not exist).
- GREEN gate: `03e3bc3` `feat(05-12): implement prod sqs-poller ...` (after RED; tests + tsc green).
- REFACTOR gate: none (GREEN was clean; the one-line `tsc` fix was folded into the GREEN commit's scope).

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
