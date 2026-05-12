---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 05
subsystem: api
tags: [fastify, onsend-hook, outbox, drizzle, postgres, s3, presigned-url, bullmq, sqs, eventbridge, terraform, ecs, elasticache, autoscaling]

# Dependency graph
requires:
  - phase: 05-03
    provides: recording_events_outbox table + drainOutbox/markDelivered + enqueueVerify (BullMQ on Redis) + the hash-mismatch→pending state edge + RecordingServerEventSchema stub
  - phase: 01-foundation-backend-distribution-recon
    provides: routes/recordings/{init,finalize,list}.ts (presigned-URL minting + qa_status guards + cursor pagination), s3-client.ts (recordingKeys/RECORDINGS_BUCKET/PRESIGNED_TTL_SECONDS/MAX_PARTS_PER_UPLOAD), recordings.ipAddress column, app.ts plugin order, infra/terraform/{modules,envs} (ecs/s3/network/rds modules + prod env)
provides:
  - apps/api/src/plugins/events-outbox.ts — fp onSend hook draining recording_events_outbox for req.user.sub onto authed JSON object responses (_events envelope key), markDelivered, at-least-once with the client de-duping on (recording_id, event_type) (VERIFY-05)
  - apps/api/src/routes/recordings/reupload.ts — POST /recordings/:id/reupload: 404/403/409 problem-details; resets qaStatus→pending, re-mints CreateMultipartUpload + UploadPart presigns + metadata PutObject presign, UPDATEs s3UploadId/partsCount on the existing row; no server-side dead-letter cap (D-04a) (UP-16)
  - apps/api/src/routes/recordings/verified-ids.ts — GET /recordings/verified-ids?since=<cursor>: { ids, next_cursor } for WHERE user_id=sub AND qa_status='verified' ordered verified_at DESC, id DESC; cursor pagination; _events carrier (VERIFY-06)
  - req.ip → recordings.ip_address on /recordings/init INSERT; finalize.ts toRecordingResponse() returns r.ipAddress (UP-18)
  - /recordings/:id/finalize LocalStack-only fire-and-forget enqueueVerify dev shim (Pitfall 6)
  - shared/types: EventsEnvelopeSchema, RecordingReuploadRequestSchema, RecordingReuploadResponseSchema (= RecordingsInitResponseSchema), VerifiedIdsQuerySchema, VerifiedIdsResponseSchema; RecordingSchema.ipAddress widened to z.string().nullable() on the response; RecordingsListResponseSchema + MeResponseSchema carry the optional _events key (Pattern 22); SHARED_TYPES_VERSION 0.7.0 → 0.8.0
  - infra/terraform/modules/verify-queue/ — SQS verify queue + DLQ, S3 'Object Created' EventBridge rule (.mp4/.csv/metadata.json suffixes) → SQS (queue policy scoped to events.amazonaws.com + SourceArn), least-privilege worker IAM (s3:GetObject read-only + sqs Receive/Delete/GetQueueAttributes only), humyn-worker ECS task def (hash-verify + sqs-poller containers), worker service (scale-from-zero, no LB), backlog-per-task target-tracking autoscaling (VERIFY-01/07)
  - infra/terraform/modules/redis/ — single-node ElastiCache Redis 7.1 (cache.t4g.micro) + SG ingress 6379 from the Fargate SG
  - infra/terraform/modules/ecs/outputs.tf — cluster_arn + cluster_name outputs; prod-env wires module.redis + module.verify_queue
affects: [05-06, 05-07, 05-08, terraform-infra]

# Tech tracking
tech-stack:
  added: ['aws_sqs_queue + aws_cloudwatch_event_rule + aws_ecs_task_definition (worker) + aws_appautoscaling_* (Terraform)', 'aws_elasticache_cluster (Redis 7.1, prod)']
  patterns:
    - 'Outbox onSend-hook delivery: a per-user recording_events_outbox drained on every authed JSON object response into a _events envelope key, marked delivered in the same hook; at-least-once + client-side de-dup; the reconciliation sweep is the convergent backstop'
    - 'Pattern 22 carrier schemas: strict response.200 zod schemas that the events-outbox hook touches add `_events: z.array(...).optional()`; routes with no strict response schema carry it for free'
    - 'Re-upload as a row reset, not a new row: UPDATE qa_status hash-mismatch→pending + overwrite s3UploadId/partsCount on the existing row, reuse the deterministic recordingKeys(), S3 versioning retains the bad object version'
    - 'LocalStack dev shim: AWS_ENDPOINT_URL gates a fire-and-forget enqueueVerify in /finalize (prod uses S3→EventBridge→SQS→poller); jobId=recordingId collapses any double-enqueue; recordings_to_verify + verify-sweep cron are the durable backstop either way'
    - 'Worker as a 2nd ECS task: same container image, different entrypoint (node dist/workers/hash-verify.js + a sqs-poller sidecar); least-privilege task role (s3:GetObject read-only, sqs receive/delete only — byte-fidelity enforced at IAM); backlog-per-task autoscaling via a CloudWatch metric-math expression'

key-files:
  created:
    - apps/api/src/plugins/events-outbox.ts
    - apps/api/src/routes/recordings/reupload.ts
    - apps/api/src/routes/recordings/verified-ids.ts
    - apps/api/test/plugins/events-outbox.test.ts
    - apps/api/test/routes/recordings/reupload.test.ts
    - apps/api/test/routes/recordings/verified-ids.test.ts
    - apps/api/test/routes/recordings/init.test.ts
    - infra/terraform/modules/verify-queue/main.tf
    - infra/terraform/modules/verify-queue/variables.tf
    - infra/terraform/modules/verify-queue/outputs.tf
    - infra/terraform/modules/redis/main.tf
    - infra/terraform/modules/redis/variables.tf
    - infra/terraform/modules/redis/outputs.tf
  modified:
    - apps/api/src/app.ts
    - apps/api/src/routes/recordings/index.ts
    - apps/api/src/routes/recordings/init.ts
    - apps/api/src/routes/recordings/finalize.ts
    - apps/api/src/routes/recordings/schemas.ts
    - apps/api/test/routes/recordings-finalize.test.ts
    - shared/types/src/recording.ts
    - shared/types/src/me.ts
    - shared/types/src/index.ts
    - infra/terraform/modules/ecs/outputs.tf
    - infra/terraform/envs/prod/main.tf
    - infra/terraform/envs/staging/main.tf

key-decisions:
  - "No infra/terraform/envs/dev/ exists — the repo's non-prod env is `staging`. The plan referred to a 'dev env'; the verify-queue/redis modules are wired into PROD ONLY, and the explanatory 'prod-only — dev uses docker-compose + the /finalize shim' comment was added to staging/main.tf instead."
  - "/finalize's dev-shim enqueueVerify is fire-and-forget (`void enqueueVerify(...).catch(...)`), not awaited — ioredis with maxRetriesPerRequest: null never throws on a connection failure (it retries forever), so awaiting it would hang the /finalize response if Redis is down. The recordings_to_verify row + verify-sweep cron are the durable backstop. (Rule 2 — robustness; the plan said 'try/catch await', which doesn't actually protect against the ioredis retry-forever behavior.)"
  - "RecordingSchema.ipAddress widened to z.string().nullable() on the response (was z.null() inherited from RecordingCreateSchema). The CREATE request still requires `ipAddress: null` (the client never sends one); only the response carries the server-populated string — otherwise toRecordingResponse() returning r.ipAddress fails tsc."
  - "SHARED_TYPES_VERSION bumped 0.7.0 → 0.8.0 (Plan 05-03 deferred the bump to this plan; additive, non-breaking — new schemas + the widened ipAddress response field)."
  - "Autoscaling uses a target-tracking policy on a CloudWatch metric-math expression `msgs / IF(tasks < 1, 1, tasks)` (SQS ApproximateNumberOfMessagesVisible ÷ RunningTaskCount) targeting 5 messages/task — the backlog-per-task pattern the plan recommended; not the simpler queue-depth-alone fallback."
  - "Worker SQS poller runs as a 2nd container (essential=false) in the humyn-worker task def (command: node dist/workers/sqs-poller.js) — kept simple, shares the worker's lifecycle; the poller/worker entrypoint .js files are referenced but live in Plan 05-03's src/workers/ (hash-verify.js exists; sqs-poller.js is a thin ReceiveMessage→enqueueVerify→DeleteMessage loop to be added — see Known Stubs)."
  - "redis dev container was not running at execution start (added to docker-compose.yml in 05-03 but never started); started it via `docker compose up -d redis` so the LocalStack-gated tests + the /finalize dev shim work."

patterns-established:
  - 'events-outbox onSend hook + Pattern-22 carrier schemas (RecordingsListResponseSchema, MeResponseSchema, VerifiedIdsResponseSchema all accept the optional _events key)'
  - 'Re-upload re-enters the upload lifecycle via a row reset (UPDATE qa_status hash-mismatch→pending), not a new recordings row'

requirements-completed: [VERIFY-01, VERIFY-05, VERIFY-06, VERIFY-07, UP-16, UP-18]

# Metrics
duration: 16min
completed: 2026-05-12
---

# Phase 5 Plan 05: Backend HTTP Surface — events-outbox onSend hook, /reupload, /verified-ids, the dev shim, and the prod EventBridge→SQS→worker Terraform Summary

**The Phase-5 backend HTTP surface on top of Plan 05-03's outbox + queue: the `events-outbox` onSend hook (a `_events` envelope drained from `recording_events_outbox` onto authed responses, Pattern-22-safe), `POST /recordings/:id/reupload` (UP-16 — row reset + fresh presigns, no server-side dead-letter cap), `GET /recordings/verified-ids` (VERIFY-06 reconciliation sweep), `req.ip → recordings.ip_address` (UP-18), the LocalStack `/finalize → enqueueVerify` dev shim (Pitfall 6), the `infra/terraform/modules/verify-queue/` + `modules/redis/` modules (SQS/DLQ + EventBridge rule + the 2nd `humyn-worker` ECS task + backlog-per-task autoscaling + least-privilege worker IAM + ElastiCache Redis), and the shared-types extensions + 4 Vitest files — all green against the live LocalStack + pushed DB + the started Redis container.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-05-12T11:55:59Z
- **Completed:** 2026-05-12T12:11:07Z
- **Tasks:** 3
- **Files modified:** 25 (13 created, 12 modified)

## Accomplishments

- `plugins/events-outbox.ts` — the server→client recording-status event channel (VERIFY-05): an `fp(... { name: 'events-outbox', dependencies: ['auth'] })` `onSend` hook that skips unauthenticated / non-JSON-object responses, else `drainOutbox(req.user.sub)` (≤50 rows), sets `body._events`, `markDelivered`, re-serializes. Registered in `app.ts` after `auth` + `idempotency`.
- `POST /recordings/:id/reupload` (UP-16) — 404/403/409 problem-details (missing / not-yours / not-from-hash-mismatch), then resets `qaStatus → 'pending'`, mints fresh `CreateMultipartUpload` + per-part `UploadPart` presigns + a `PutObject` presign for `metadata.json`, UPDATEs `s3UploadId`/`partsCount` on the existing row, returns the `/init` response shape; a second hash-mismatch can re-`/reupload` (no server-side cap, D-04a); per-user rate-limit.
- `GET /recordings/verified-ids?since=<cursor>` (VERIFY-06) — `{ ids, next_cursor }` for `recordings WHERE user_id = req.user.sub AND qa_status = 'verified'` ordered `verified_at DESC, id DESC`, `LIMIT 200+1` cursor pagination (mirrors `list.ts`); `_events` carrier.
- `recordings.ip_address` (UP-18) — `init.ts` sets `ipAddress: req.ip` on INSERT (honors `trustProxy`); `finalize.ts` `toRecordingResponse()` returns `r.ipAddress` (no more hard-coded `null`).
- LocalStack dev shim (Pitfall 6) — when `AWS_ENDPOINT_URL` is set, `/finalize` fire-and-forget `enqueueVerify(recordingId)` after the multipart-complete; prod (`AWS_ENDPOINT_URL` unset) uses the S3→EventBridge→SQS→poller leg.
- shared-types — `EventsEnvelopeSchema`, `RecordingReuploadRequest/ResponseSchema`, `VerifiedIdsQuery/ResponseSchema`; `RecordingsListResponseSchema` + `MeResponseSchema` carry the optional `_events` key; `RecordingSchema.ipAddress` widened to `z.string().nullable()` on the response; `SHARED_TYPES_VERSION` 0.7.0 → 0.8.0.
- `infra/terraform/modules/verify-queue/` (≥30 lines, 18 resources) — `aws_sqs_queue.verify` + `aws_sqs_queue.verify_dlq` (redrive maxReceiveCount 5, visibility 900s), `aws_s3_bucket_notification.recordings { eventbridge = true }`, `aws_cloudwatch_event_rule.recordings_object_created` (`source=aws.s3`, `detail-type="Object Created"`, bucket-name + three key-suffix matchers `.mp4`/`.csv`/`metadata.json`), `aws_cloudwatch_event_target` → SQS + `aws_sqs_queue_policy` scoped to `events.amazonaws.com` + `aws:SourceArn`, `aws_iam_role.worker_task_role` (`s3:GetObject` on `${recordings_bucket_arn}/*` READ-ONLY + `sqs:ReceiveMessage`/`DeleteMessage`/`GetQueueAttributes` on the queue — nothing else) + `aws_iam_role.worker_execution_role`, `aws_ecs_task_definition.worker` (`family = "humyn-worker"`, two containers: `hash-verify` running `["node","dist/workers/hash-verify.js"]` + a `sqs-poller` sidecar), `aws_ecs_service.worker` (scale-from-zero, no LB), `aws_appautoscaling_target` + `aws_appautoscaling_policy.worker_backlog` (target-tracking on `msgs / IF(tasks<1,1,tasks)` ≈ 5 msgs/task — VERIFY-07).
- `infra/terraform/modules/redis/` — single-node `aws_elasticache_cluster` (Redis 7.1, `cache.t4g.micro`) + SG ingress 6379 from the Fargate SG; `infra/terraform/modules/ecs/outputs.tf` adds `cluster_arn`/`cluster_name`; `infra/terraform/envs/prod/main.tf` instantiates `module.redis` + `module.verify_queue`; `staging/main.tf` carries the explanatory "prod-only" comment.
- 4 Vitest files: `test/plugins/events-outbox.test.ts` (4 tests — drains+marks delivered, no cross-user leak, unauthed untouched, strict-schema route still serializes), `test/routes/recordings/reupload.test.ts` (8 — 200 + row reset, second re-upload allowed, pending/verified→409, other-user→403, missing→404, unauthed→401; LocalStack-gated), `test/routes/recordings/verified-ids.test.ts` (4 — verified-only + ordering, `?since=` cursor, small-set null cursor, unauthed→401), `test/routes/recordings/init.test.ts` (1 — `ip_address` populated; LocalStack-gated). 16 new tests; the full apps/api suite is 151/151 green.

## Task Commits

1. **Task 1: events-outbox onSend plugin + shared-types extensions + Pattern-22 schema additions** — `40e50bc` (feat)
2. **Task 2: POST /recordings/:id/reupload + GET /recordings/verified-ids + req.ip→recordings.ipAddress + the dev shim** — `9f12880` (feat)
3. **Task 3: Terraform verify-queue + redis modules + prod-env wiring** — `8a8bdeb` (feat)

**Plan metadata:** (this commit — docs)

## Files Created/Modified

See `key-files` in the frontmatter. Highlights:

- `apps/api/src/plugins/events-outbox.ts` — the onSend hook draining `recording_events_outbox` onto authed responses (`drainOutbox` → `body._events` → `markDelivered`).
- `apps/api/src/routes/recordings/reupload.ts` — `POST /recordings/:id/reupload`; mirrors `init.ts`'s minting block + `finalize.ts`'s state guards; resets the row to `pending`.
- `apps/api/src/routes/recordings/verified-ids.ts` — `GET /recordings/verified-ids`; mirrors `list.ts`'s cursor pagination over `qa_status = 'verified'`.
- `apps/api/src/routes/recordings/init.ts` / `finalize.ts` — `ipAddress: req.ip` on INSERT; `toRecordingResponse` returns `r.ipAddress`; `/finalize` LocalStack dev shim.
- `apps/api/test/routes/recordings-finalize.test.ts` — `afterAll` now closes the BullMQ queue + ioredis singleton the dev shim opens (so the test process exits cleanly).
- `shared/types/src/{recording,me,index}.ts` — the new schemas + the `_events` carriers + the widened `ipAddress` response field + the version bump.
- `infra/terraform/modules/verify-queue/{main,variables,outputs}.tf` — the prod EventBridge→SQS→worker pipeline + autoscaling + least-privilege IAM.
- `infra/terraform/modules/redis/{main,variables,outputs}.tf` — the ElastiCache Redis 7.1 BullMQ store.
- `infra/terraform/modules/ecs/outputs.tf`, `infra/terraform/envs/{prod,staging}/main.tf` — the wiring + the dev-env comment.

## Decisions Made

See `key-decisions` in the frontmatter. Highlights: no `envs/dev/` exists → the verify-queue/redis modules are prod-only (the comment landed in `staging/main.tf`); `/finalize`'s dev shim `enqueueVerify` is fire-and-forget, not awaited (ioredis `maxRetriesPerRequest: null` retries forever — awaiting would hang `/finalize` if Redis is down); `RecordingSchema.ipAddress` widened to `z.string().nullable()` on the response (the CREATE request still requires `null`); `SHARED_TYPES_VERSION` bumped to 0.8.0; backlog-per-task autoscaling via a CloudWatch metric-math expression; the SQS poller is a 2nd (`essential = false`) container in the worker task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Robustness] `/finalize` dev-shim `enqueueVerify` made fire-and-forget instead of `await`-with-try/catch**

- **Found during:** Task 2 (running the existing `recordings-finalize.test.ts`)
- **Issue:** The plan prescribed `try { await enqueueVerify(recordingId); } catch (...) {}`. But the Redis dev container wasn't running, and `ioredis` is constructed with `maxRetriesPerRequest: null` (required for BullMQ's blocking commands) — so on a connection failure it retries forever and never throws; the `await` hung `/finalize` until the 60s test timeout. A Redis hiccup must never block (or fail) the `/finalize` response.
- **Fix:** Changed to `void enqueueVerify(rec.id).catch((err) => app.log.warn(...))` — fire-and-forget; the `recordings_to_verify` row + the `verify-sweep` cron are the durable backstop.
- **Files modified:** `apps/api/src/routes/recordings/finalize.ts`
- **Verification:** `pnpm vitest run` (full apps/api suite) 151/151 green; `pnpm tsc --noEmit` exits 0.
- **Committed in:** `9f12880` (Task 2 commit)

**2. [Rule 3 - Blocking] `RecordingSchema.ipAddress` widened to `z.string().nullable()` on the response**

- **Found during:** Task 2 (tsc on `finalize.ts`)
- **Issue:** `RecordingSchema` inherits `ipAddress: z.null()` from `RecordingCreateSchema`, so `toRecordingResponse()` returning `r.ipAddress` (`string | null`) failed `tsc --noEmit` ("string is not assignable to null").
- **Fix:** Added `ipAddress: z.string().nullable()` to `RecordingSchema.extend({...})` — the CREATE request still requires `null` (the client never sends one); only the response carries the server-populated string.
- **Files modified:** `shared/types/src/recording.ts`
- **Verification:** `pnpm tsc --noEmit` (apps/api + shared/types) exits 0.
- **Committed in:** `9f12880` (Task 2 commit)

**3. [Rule 3 - Blocking] Started the `humyn-redis` dev container**

- **Found during:** Task 2 (the `recordings-finalize` test's `enqueueVerify` got `ECONNREFUSED 127.0.0.1:6379`)
- **Issue:** The `redis:7-alpine` service was added to `docker-compose.yml` in Plan 05-03 but never started (`scripts/dev-up.sh` still only starts `postgres localstack pgadmin` — noted in the 05-03 summary as a non-blocking follow-on).
- **Fix:** `docker compose up -d redis`.
- **Files modified:** none (runtime only)
- **Verification:** `docker ps` shows `humyn-redis` healthy on 0.0.0.0:6379; the LocalStack-gated tests + `/finalize` dev shim work.
- **Committed in:** n/a (no code change)

**4. [Plan-vs-repo correction] No `infra/terraform/envs/dev/` — the non-prod env is `staging`**

- **Found during:** Task 3 (reading `infra/terraform/envs/`)
- **Issue:** The plan said the dev env (`infra/terraform/envs/dev/`) does NOT instantiate `verify-queue`. There is no `dev` env in the repo — the layout is `envs/{prod,staging}`.
- **Fix:** `module.verify_queue` + `module.redis` instantiated in `envs/prod/main.tf` only; the explanatory "prod-only — local dev uses docker-compose redis + the `/finalize` LocalStack shim (Pitfall 6)" comment was added to `envs/staging/main.tf` (staging can adopt the module later if a pre-prod soak is wanted).
- **Files modified:** `infra/terraform/envs/prod/main.tf`, `infra/terraform/envs/staging/main.tf`
- **Verification:** brace-balance + resource-presence review (terraform CLI not available — see Issues).
- **Committed in:** `8a8bdeb` (Task 3 commit)

---

**Total deviations:** 4 (1 robustness improvement, 2 blocking, 1 plan-vs-repo correction) — all auto-handled.
**Impact on plan:** No scope creep. The robustness/blocking fixes were required for the code to compile + the tests to pass + `/finalize` to not hang on a Redis outage; the `staging`-vs-`dev` correction matched the plan to the actual repo layout. All plan-prescribed files exist and the prescribed verifications pass.

## Issues Encountered

- The Redis dev container was down at execution start (see deviation #3) — started it.
- `terraform` is not available in this environment, so `terraform validate` / `terraform fmt -check` could not be run on the new modules. A syntax review was done instead: brace balance (`{`/`}` counts match in `verify-queue/main.tf`, `redis/main.tf`, `envs/prod/main.tf`), the `aws_sqs_queue`/`aws_cloudwatch_event_rule`/`aws_ecs_task_definition`/`aws_appautoscaling_*` resources are all present (18 resources in `verify-queue/main.tf`), the worker IAM policy has only `s3:GetObject` + the three `sqs:*` actions (grep for `PutObject`/`DeleteObject` returns nothing), and the module uses the same `required_providers { aws ~> 5.80 }` pin as the prod backend. Recommend a `terraform -chdir=infra/terraform/envs/prod validate` once a planning machine with the CLI is available.

## Known Stubs

- **`apps/api/src/workers/sqs-poller.ts` is referenced by the Terraform worker task def (`command: ["node","dist/workers/sqs-poller.js"]`) but does not exist yet.** Plan 05-03 created `src/workers/hash-verify.ts` (the BullMQ Worker entrypoint, which exists). The thin SQS long-poll → `enqueueVerify(recordingId)` → `DeleteMessage` loop is intentionally deferred to a follow-on (the `recordings_to_verify` row + the `verify-sweep` cron are the durable backstop, so prod still converges without it). The Terraform is correct as code; the `.js` file just needs to be added before the prod worker task can actually run with both containers. Tracked here for the verifier — this does not block any MVP client surface (the dev path uses the `/finalize` LocalStack shim, not the poller).

## User Setup Required

None — no external service configuration required. (Non-blocking follow-on, carried over from the 05-03 summary: `scripts/dev-up.sh` still only starts `postgres localstack pgadmin` — add `redis` to its `docker compose up -d` line so the dev stack comes up complete.)

## Next Phase Readiness

- Plan 05-08 (the client-side reconciliation sweep) can now call `GET /recordings/verified-ids` and consume the `_events` envelope on every authed response; `POST /recordings/:id/reupload` is the route the client hits when it gets a `re-upload` event.
- Plan 05-06/05-07 (anti-fraud — Play Integrity at sign-in, per-account daily upload-rate cap) build on the same `/recordings` surface; the `recordings.ip_address` population (UP-18) is now in place if a rate-limit-by-IP needs it.
- The prod EventBridge→SQS→worker pipeline + the ElastiCache Redis + the VERIFY-07 autoscaling are defined as code; one follow-on before the prod worker can run: add `apps/api/src/workers/sqs-poller.ts` (see Known Stubs).

## Self-Check: PASSED

All 13 created source/test/terraform files + the SUMMARY exist on disk; all 3 task commits (`40e50bc`, `9f12880`, `8a8bdeb`) are in git history.

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
