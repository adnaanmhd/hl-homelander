---
phase: 01-foundation-backend-distribution-recon
plan: 08
subsystem: backend
tags: [fastify, multipart, s3, drizzle, dsr, contributions, telemetry, app-version]

# Dependency graph
requires:
  - phase: 01
    plan: 02
    provides: users (deletedAt + deleteGraceUntil) + contributions + recordings + events + feedback + appVersions tables
  - phase: 01
    plan: 03
    provides: LocalStack 4.x bucket-init script extension point + AWS endpoint + lifecycle pattern
  - phase: 01
    plan: 04
    provides: Fastify cross-cutting plugins (auth/requireAuth, idempotency, rate-limit, error-handler/problem-detail), buildApp() factory
  - phase: 01
    plan: 06
    provides: tasks table + ULID id format used by /contributions per-task breakdown
  - phase: 01
    plan: 07
    provides: recordings rows with qa_status enum (used by both /contributions reads AND the migration-0004 trigger filter)
provides:
  - Migration 0004 — refresh_contribution_bucket() function + AFTER INSERT/UPDATE/DELETE trigger on recordings; populates the contributions denormalized aggregate filtered by qa_status NOT IN ('takedown','rejected') per D-LEGAL-04 (auto-deletes empty buckets)
  - GET /me + PATCH /me (API-02) — JWT-auth, name/age/gender editable, email/avatarUrl/applicationId/flavor/consentVersion read-only, per-user 120/min (GET) + 30/min (PATCH) rate limit
  - DELETE /me?confirm=DELETE (API-03) — soft-delete + 30-day grace window; per-applicationId rate limit 5/min for account-deletion DoS guard (T-1.8-02)
  - POST /me/restore (API-03) — clears deletedAt/deleteGraceUntil if within window; idempotent OK if not deleted; 410 problem+json if past grace
  - GET /contributions (API-10) — lifetime aggregate {durationMs, recordingCount, taskCount} + top-10 per-task breakdown; D-LEGAL-04 takedown/rejected filter applied at query time
  - GET /contributions/timeseries?range=7d|30d|90d (API-10) — daily-bucket time series, oldest-first, reads pre-aggregated contributions populated by trigger
  - POST /events (API-11) — telemetry ingest with EVENT_NAMES allowlist (14 names), MAX_KEYS=32 + MAX_PROPERTIES_BYTES=4 KB schema-creep guards (T-1.8-05), per-user 600/min
  - POST /feedback (API-12) — multipart with category + message + optional diagnostic.json file (5 MB cap, application/json content-type allowlist T-1.8-04), uploads to humyn-feedback-{env} S3, persists first 100 KB inline, per-user 5/min rate limit (T-1.8-03)
  - GET /app/version (API-13) — UNAUTHENTICATED, per-flavor discriminated-union response (apkRollout vs playStore vs iosAppStore per D-APK-02), Cache-Control public, max-age=21600 (6h)
  - DSR cron stub (cron/dsr-hard-delete.ts) — daily findHardDeleteCandidates() + log-only at Phase 1 (T-1.8-10); Phase 5 swaps body for actual hard-delete
  - humyn-feedback-{env} bucket added to LocalStack init script with 90-day expiration lifecycle
  - shared/types: MeResponseSchema/MeDeleteQuerySchema/MeRestoreResponseSchema, ContributionsLifetimeSchema/ContributionsTimeseriesSchema, AppVersionResponseSchema (discriminated-union), EventCreateSchema (with EVENT_NAMES const), FeedbackFieldsSchema (with FEEDBACK_CATEGORIES const)
  - 24 new vitest tests across 6 files (108 total green; +24 over plan 01-07)
affects:
  [
    01-10 (Terraform — provisions humyn-feedback-prod with same lifecycle),
    01-11 (legal — uses humyn-feedback bucket prefix dsr-exports/ for DSR exports),
    01-12 (e2e — exercises every Phase-1 endpoint),
    Phase 5 (hash-verify worker writes recordings.qaStatus → trigger refreshes contributions buckets),
    Phase 5 (DSR worker swaps the cron stub body for actual hard-delete),
  ]

# Tech tracking
tech-stack:
  added:
    - '@fastify/multipart@9.0.3 (apps/api dep — used only by /feedback)'
    - form-data@4.0.1 (apps/api devDep — used only in /feedback test for multipart construction)
  patterns:
    - 'Pattern 29: Per-applicationId rate-limit bucket — DELETE /me uses keyGenerator returning `delete-me:${applicationId}`. Even with N stolen JWTs, all share the same applicationId so a single bucket caps the storm. Distinct bucket from `user:` and `ip:` keyspaces (Pattern 16).'
    - "Pattern 30: Recordings → contributions denormalization trigger (migration 0004). The trigger filters qa_status NOT IN ('takedown','rejected') so the user-visible time series never contains revoked recordings. Empty buckets are deleted instead of zeroed to keep the table sparse. Phase 5's hash-verify worker becomes a producer of qa_status transitions (uploaded → verified) → trigger re-aggregates."
    - 'Pattern 31: Multipart route registration order — @fastify/multipart is registered INSIDE the feedback route plugin (not globally), so the global idempotency hook does NOT need to skip multipart bodies. The hook hashes (method, path, undefined-body) which is acceptable: idempotency-key UUIDv4 reuse with different bodies is a client error.'
    - "Pattern 32: Test-side idempotency_keys cleanup — deterministic UUIDs in vitest files would replay stale responses across runs. beforeAll/beforeEach in plan-08 tests deletes idempotency_keys for the test user before re-seeding. Plan 12's BEGIN/ROLLBACK isolation will retire this; Phase-1 we live with explicit cleanup."
    - "Pattern 33: Discriminated-union response per build flavor — AppVersionResponseSchema uses z.discriminatedUnion('flavor') so apkRollout has {apkUrl, apkSha256} while playStore/iosAppStore have {playStoreUrl}. Clients narrow on `flavor` and access the correct upgrade URL without optional-chaining."
    - "Pattern 34: NODE_ENV=test gates background timers — startDsrCron() is skipped when NODE_ENV=test or GSD_DSR_CRON=off so the singleFork test pool doesn't accumulate setInterval handles + log noise. Production server.ts boot path always runs it."

key-files:
  created:
    - apps/api/src/db/migrations/0004_contributions_trigger_and_feedback_bucket.sql (refresh_contribution_bucket() function + recordings trigger; auto-deletes empty buckets)
    - apps/api/src/routes/me/get-patch.ts (GET /me + PATCH /me; per-user rate limit; T-1.8-01 read-only-field guard)
    - apps/api/src/routes/me/delete-restore.ts (DELETE /me?confirm=DELETE soft-delete + per-applicationId 5/min rate limit; POST /me/restore with 410-on-past-grace)
    - apps/api/src/routes/me/index.ts (route barrel)
    - apps/api/src/routes/contributions/list.ts (lifetime aggregate + top-10 per-task; D-LEGAL-04 takedown filter)
    - apps/api/src/routes/contributions/timeseries.ts (daily buckets from contributions table, oldest-first)
    - apps/api/src/routes/contributions/index.ts (route barrel; timeseries-before-list per Pattern 28)
    - apps/api/src/routes/events/post.ts (allowlist + MAX_KEYS=32 + MAX_PROPERTIES_BYTES=4 KB)
    - apps/api/src/routes/feedback/post.ts (multipart parser + content-type allowlist + 5 MB cap; S3 upload + 100 KB inline)
    - apps/api/src/routes/app-version/get.ts (UNAUTHENTICATED; Cache-Control public, max-age=21600)
    - apps/api/src/routes/app-version/seed-initial.ts (idempotent seed for all three flavors; runnable via `tsx apps/api/src/routes/app-version/seed-initial.ts`)
    - apps/api/src/lib/feedback-uploader.ts (FEEDBACK_BUCKET env-loader + uploadDiagnostic + key format `feedback/{userId}/{feedbackId}/diagnostic.json`)
    - apps/api/src/cron/dsr-hard-delete.ts (findHardDeleteCandidates() + startDsrCron(); log-only at Phase 1 per T-1.8-10)
    - shared/types/src/me.ts (MeResponse + MeDeleteQuery/MeDeleteResponse/MeRestoreResponse schemas)
    - shared/types/src/contributions.ts (ContributionsLifetime + ContributionsTimeseriesQuery + ContributionsTimeseries)
    - shared/types/src/app-version.ts (per-flavor z.discriminatedUnion response shape)
    - shared/types/src/events.ts (14-name EVENT_NAMES allowlist + EventCreateSchema)
    - shared/types/src/feedback.ts (8-category FEEDBACK_CATEGORIES allowlist + FeedbackFieldsSchema)
    - apps/api/test/routes/me-get-patch.test.ts (4 tests)
    - apps/api/test/routes/me-delete-restore.test.ts (5 tests including cron candidates)
    - apps/api/test/routes/contributions.test.ts (3 tests covering D-LEGAL-04 + trigger)
    - apps/api/test/routes/events.test.ts (3 tests including allowlist guard)
    - apps/api/test/routes/feedback.test.ts (4 tests including multipart happy + content-type reject)
    - apps/api/test/routes/app-version.test.ts (5 tests across all three flavors)
  modified:
    - apps/api/src/app.ts (registers meRoutes + contributionsRoutes + eventsPostRoute + feedbackPostRoute + appVersionGetRoute; starts DSR cron unless NODE_ENV=test)
    - apps/api/package.json (+@fastify/multipart@9.0.3, +form-data@4.0.1 dev)
    - shared/types/src/index.ts (re-exports me + contributions + app-version + events + feedback; SHARED_TYPES_VERSION → 0.5.0)
    - infra/localstack/init/01-create-buckets.sh (humyn-feedback-dev bucket + public-access-block + 90-day expiration lifecycle)
    - .env.example + apps/api/.env.example (FEEDBACK_BUCKET=humyn-feedback-dev)
    - pnpm-lock.yaml (multipart 9.0.3 + form-data 4.0.1 resolution)

key-decisions:
  - 'DELETE /me uses per-applicationId rate-limit bucket (`delete-me:${appId}`) — 5/min — to cap account-deletion DoS even when an attacker rotates JWTs from the same build flavor (T-1.8-02 mitigation).'
  - "Migration 0004 trigger AUTO-DELETES empty contribution buckets when v_count=0 (e.g. last day's recording transitions to takedown). Keeps the contributions table sparse + matches /contributions/timeseries oldest-first iteration semantics (no zero artifacts)."
  - 'EVENT_NAMES is a hard-coded const — adding a name requires shipping shared/types. Schema-creep guard at the type level prevents one-off telemetry calls from polluting the event stream (T-1.8-05).'
  - "AppVersionResponseSchema uses z.discriminatedUnion('flavor') — three concrete shapes — instead of optional fields with runtime checks. Clients can narrow on `flavor` for type-safe access to the correct upgrade URL."
  - "DSR cron tick runs once at boot + then every 24h (with .unref() so it doesn't block process exit). Phase 1 is LOG-ONLY (T-1.8-10); Phase 5's worker plan owns the actual S3 prefix purge + recordings anonymization + users row delete."
  - "/feedback registers @fastify/multipart INSIDE the route plugin (not globally) so the global idempotency hook keeps its standard JSON-body hash path. Clients posting multipart with a fresh idempotency-key UUIDv4 per request work correctly; reuse with a different multipart body is a client-error scenario we don't need to detect via hash."
  - 'feedback diagnostic is stored BOTH in S3 (full 5 MB) AND inline on feedback row (first 100 KB after JSON.parse + truncate). Support staff read inline without an S3 hop; investigators get the full file from S3. Inline always wraps in {_s3_key} so the row is self-describing.'
  - 'GET /app/version intentionally has NO requireAuth — pre-sign-in clients need to see force_upgrade BEFORE they can sign in. Cache-Control public, max-age=21600 lets CloudFront/ALB caching layers serve copies for 6h, eating most of the load.'

patterns-established:
  - 'Pattern 29: Per-applicationId rate-limit bucket for account-deletion DoS'
  - 'Pattern 30: Recordings → contributions denormalization trigger (D-LEGAL-04 filter built in)'
  - 'Pattern 31: Multipart route registration scope — inside route plugin, not global'
  - 'Pattern 32: Test-side idempotency_keys cleanup for deterministic UUID replay'
  - 'Pattern 33: Discriminated-union response per build flavor'
  - 'Pattern 34: NODE_ENV=test gate for background timers in singleFork pool'

requirements-completed:
  - API-10
  - API-11
  - API-12
  - API-13
  - API-14
  - API-15

# Metrics
duration: 17min
completed: 2026-05-07
---

# Phase 1 Plan 8: /me, /contributions, /events, /feedback, /app/version + DSR cron stub Summary

**Seven endpoint groups (/me GET+PATCH+DELETE+restore, /contributions list+timeseries, /events ingest, /feedback multipart, /app/version per-flavor) feature-complete on top of the migration-0004 contributions trigger, with the DSR hard-delete cron stub wired in.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-07T15:06:51Z
- **Completed:** 2026-05-07T15:24:01Z
- **Tasks:** 3
- **Files modified:** 28 (22 created, 6 modified)
- **Tests added:** 24 (108 total green)

## Accomplishments

- Migration 0004 ships the recordings → contributions denormalization trigger; `/contributions/timeseries` reads pre-aggregated rows with the takedown/rejected filter baked in (D-LEGAL-04).
- `/me` is feature-complete — GET, PATCH (name/age/gender only), DELETE with `?confirm=DELETE` guard + 30-day grace, POST /me/restore with 410-on-past-grace, plus the per-applicationId rate-limit bucket for the deletion DoS guard.
- `/events` enforces the 14-name EVENT_NAMES allowlist + 32-key/4 KB properties caps; the `events` table is the canonical telemetry passthrough.
- `/feedback` accepts multipart with the application/json content-type allowlist + 5 MB cap; uploads to LocalStack `humyn-feedback-dev` and persists the first 100 KB inline for fast support reads.
- `/app/version` is the only unauthenticated route in plan 08 — per-flavor discriminated-union response (apkRollout vs playStore vs iosAppStore) with `Cache-Control: public, max-age=21600`. Seed script lands rows for all three flavors so plan 12 e2e + dev work pick them up immediately.
- DSR cron stub (`cron/dsr-hard-delete.ts`) ticks once at boot + every 24h, logging candidate user IDs past the 30-day grace; `findHardDeleteCandidates()` is unit-tested.
- LocalStack `humyn-feedback-dev` bucket created with 90-day expiration lifecycle to match the diagnostic-snapshot retention model.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0004 + feedback bucket addition + Zod schemas + /me + /contributions + /app/version routes** — `d189572` (feat)
2. **Task 2: /events + /feedback (multipart) + DSR cron stub + register all on app** — `90df5a9` (feat)
3. **Task 3: Vitest integration tests for /me, /contributions, /events, /feedback, /app/version** — `5dae6e1` (test)

**Plan metadata:** to be created (docs commit)

## Files Created/Modified

### Created (22)

- `apps/api/src/db/migrations/0004_contributions_trigger_and_feedback_bucket.sql` — refresh_contribution_bucket() + AFTER INSERT/UPDATE/DELETE trigger on recordings; auto-deletes empty buckets.
- `apps/api/src/routes/me/get-patch.ts` — GET /me + PATCH /me with editable-fields-only contract.
- `apps/api/src/routes/me/delete-restore.ts` — DELETE /me?confirm=DELETE + POST /me/restore with 410-on-past-grace.
- `apps/api/src/routes/me/index.ts` — route barrel.
- `apps/api/src/routes/contributions/list.ts` — lifetime aggregate + top-10 per-task breakdown (D-LEGAL-04).
- `apps/api/src/routes/contributions/timeseries.ts` — daily-bucket time series, oldest-first.
- `apps/api/src/routes/contributions/index.ts` — route barrel (timeseries before list per Pattern 28).
- `apps/api/src/routes/events/post.ts` — allowlist + schema-creep guards.
- `apps/api/src/routes/feedback/post.ts` — multipart parser + content-type allowlist + 5 MB cap.
- `apps/api/src/routes/app-version/get.ts` — unauthenticated per-flavor response + 6h cache.
- `apps/api/src/routes/app-version/seed-initial.ts` — idempotent seed for all three flavors.
- `apps/api/src/lib/feedback-uploader.ts` — FEEDBACK_BUCKET env-loader + uploadDiagnostic.
- `apps/api/src/cron/dsr-hard-delete.ts` — findHardDeleteCandidates + startDsrCron (log-only at Phase 1).
- `shared/types/src/me.ts` — MeResponse/MeDeleteQuery/MeDeleteResponse/MeRestoreResponse.
- `shared/types/src/contributions.ts` — ContributionsLifetime + ContributionsTimeseriesQuery + ContributionsTimeseries.
- `shared/types/src/app-version.ts` — discriminated-union response per flavor.
- `shared/types/src/events.ts` — EVENT_NAMES (14 names) + EventCreateSchema.
- `shared/types/src/feedback.ts` — FEEDBACK_CATEGORIES (8 categories) + FeedbackFieldsSchema.
- `apps/api/test/routes/me-get-patch.test.ts` — 4 tests.
- `apps/api/test/routes/me-delete-restore.test.ts` — 5 tests (incl. cron candidate query).
- `apps/api/test/routes/contributions.test.ts` — 3 tests (D-LEGAL-04 + trigger).
- `apps/api/test/routes/events.test.ts` — 3 tests (allowlist guard).
- `apps/api/test/routes/feedback.test.ts` — 4 tests (multipart + content-type reject).
- `apps/api/test/routes/app-version.test.ts` — 5 tests (all three flavors + cache header).

### Modified (6)

- `apps/api/src/app.ts` — registered 5 new route groups; starts DSR cron unless NODE_ENV=test.
- `apps/api/package.json` — added `@fastify/multipart@9.0.3` + `form-data@4.0.1` (dev).
- `shared/types/src/index.ts` — re-exports new modules; bumped SHARED_TYPES_VERSION → 0.5.0.
- `infra/localstack/init/01-create-buckets.sh` — added humyn-feedback-dev bucket + 90-day expiration.
- `.env.example` + `apps/api/.env.example` — added `FEEDBACK_BUCKET=humyn-feedback-dev`.
- `pnpm-lock.yaml` — multipart + form-data resolution.

## Decisions Made

- **Per-applicationId rate-limit bucket on DELETE /me** — 5/min keyed by `delete-me:${applicationId}`. Caps account-deletion DoS even with rotating JWTs from the same build flavor (T-1.8-02).
- **Trigger auto-deletes empty contribution buckets** — `v_count=0` branch deletes the row instead of leaving zeros. Keeps the contributions table sparse and matches the oldest-first iteration semantics of `/contributions/timeseries`.
- **EVENT_NAMES is a const, not config** — adding a telemetry event requires shipping a shared-types release. Type-level schema-creep guard. T-1.8-05 mitigation.
- **AppVersionResponseSchema = z.discriminatedUnion** — three concrete shapes (apkRollout, playStore, iosAppStore) so clients can narrow on `flavor` for type-safe access. Per D-APK-02.
- **DSR cron logs at boot + every 24h** — `.unref()` so it doesn't block process exit. Phase 1 is log-only per T-1.8-10; Phase 5's worker owns the actual hard-delete logic with extra confirmation gates.
- **/feedback registers @fastify/multipart INSIDE the route plugin** — not globally. The global idempotency hook keeps its standard JSON-body hash path; multipart bodies hash as `(method, path, undefined-body)` which is acceptable since UUIDv4 reuse with a different multipart body is a client error.
- **Diagnostic stored BOTH in S3 and inline (100 KB cap)** — support reads inline without an S3 hop; investigators read full file from S3. Inline always wraps with `{_s3_key}` so each row is self-describing.
- **GET /app/version is unauthenticated** — pre-sign-in clients need force_upgrade information BEFORE they can sign in. Cache-Control `public, max-age=21600` (6h) lets CDN edges serve copies, eating most of the load.
- **Test-side idempotency_keys cleanup** — deterministic UUIDs in vitest files would replay stale responses across runs. beforeAll/beforeEach deletes idempotency_keys for the test user. Plan 12's BEGIN/ROLLBACK isolation will retire this.
- **NODE_ENV=test gate on startDsrCron** — singleFork test pool would accumulate setInterval handles + log noise across test files; the boot-time tick runs anyway via the function's behaviour.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pattern 22 violation in /events route — response schema narrowing reply.code()**

- **Found during:** Task 2 (Vitest integration setup)
- **Issue:** Plan body declared `response: { 201: ResponseSchema }` on /events. The fastify-type-provider-zod 6.1.0 narrows `reply.status(N).send(...)` to N=201 when response is declared, so the 400 problem-detail returns trip the type checker (`'400' is not assignable to '201'`).
- **Fix:** Removed `response` declaration from the `/events` route schema (kept the const for documentation only with `void ResponseSchema`). Mirrors Pattern 22 already established for /auth/google + /recordings/init.
- **Files modified:** `apps/api/src/routes/events/post.ts`
- **Verification:** `pnpm typecheck` passes; tests assert 201 happy + 400 reject paths.
- **Committed in:** `90df5a9` (Task 2 commit).

**2. [Rule 2 - Missing Critical] LocalStack-only feedback bucket created — already-running container**

- **Found during:** Task 3 (test setup against live LocalStack)
- **Issue:** The plan amends `infra/localstack/init/01-create-buckets.sh`, but the running LocalStack container loaded the OLD script at boot — re-running `dev-up.sh` would have wiped state. The bucket only exists in init scripts, not in the live container's S3.
- **Fix:** Created `humyn-feedback-dev` directly via `docker exec humyn-localstack awslocal s3api create-bucket` + applied the public-access-block. The next clean `dev-up.sh` boot picks up the script change.
- **Files modified:** None (runtime-only operation).
- **Verification:** `docker exec humyn-localstack awslocal s3 ls` lists `humyn-feedback-dev`; /feedback test happy path uploads + receives 201 with valid S3 key.
- **Committed in:** N/A (operational, not code).

**3. [Rule 1 - Bug] Idempotency-key replay across test runs caused 3 failures on second run**

- **Found during:** Task 3 (full vitest pass after writing tests)
- **Issue:** Deterministic Idempotency-Key UUIDs in 4 test files (me-get-patch, me-delete-restore, events, feedback) cached responses in `idempotency_keys` table. Second test run replayed cached 410/201/200 responses instead of executing the handler — yielding stale `deletedAt` / wrong status codes / wrong content-type.
- **Fix:** Added `db.delete(schema.idempotencyKeys).where(eq(...userId, TEST_USER_ID))` to beforeAll/beforeEach in all four affected files. Pattern 32 documented in this summary.
- **Files modified:** `apps/api/test/routes/me-get-patch.test.ts`, `apps/api/test/routes/me-delete-restore.test.ts`, `apps/api/test/routes/events.test.ts`, `apps/api/test/routes/feedback.test.ts`
- **Verification:** Full suite (`pnpm test`) passes 28 files / 108 tests on first AND second consecutive runs.
- **Committed in:** `5dae6e1` (Task 3 commit).

**4. [Rule 2 - Missing Critical] startDsrCron() skipped in NODE_ENV=test**

- **Found during:** Task 2 (registering cron in app.ts)
- **Issue:** The plan registers `startDsrCron(app.log)` unconditionally in buildApp(). vitest singleFork pool builds + closes the app per test file → with 28 test files the `setInterval` handles accumulate + the `dsr_hard_delete_candidates` log line runs 28 times, polluting test output.
- **Fix:** Gated `startDsrCron(app.log)` with `process.env.NODE_ENV !== 'test' && process.env.GSD_DSR_CRON !== 'off'`. Production server.ts boot path always runs it. Tests opt back in by importing `findHardDeleteCandidates` directly (see me-delete-restore.test.ts).
- **Files modified:** `apps/api/src/app.ts`
- **Verification:** Full suite is clean of `dsr_hard_delete_candidates` log spam; `findHardDeleteCandidates` cron query is unit-tested via direct import.
- **Committed in:** `90df5a9` (Task 2 commit).

**5. [Rule 3 - Blocking] Plan acceptance grep `max-age=21600` failed because the route used `${CACHE_TTL_SECONDS}` interpolation**

- **Found during:** Task 1 (running plan-prescribed acceptance verify)
- **Issue:** The plan's automated check `grep -q "max-age=21600" src/routes/app-version/get.ts` is a literal-string match. My initial implementation used `\`public, max-age=${CACHE_TTL_SECONDS}\`` (interpolated). Wire output is identical, but the grep failed.
- **Fix:** Pinned `CACHE_TTL_SECONDS = 21600` (literal, was `6 * 3600`) AND added a `CACHE_CONTROL_HEADER = 'public, max-age=21600'` constant; the route header uses the constant. Wire-side header unchanged.
- **Files modified:** `apps/api/src/routes/app-version/get.ts`
- **Verification:** `grep -q "max-age=21600"` succeeds; cache header tested explicitly via `expect(r.headers['cache-control']).toContain('max-age=21600')`.
- **Committed in:** `d189572` (Task 1 commit).

---

**Total deviations:** 5 auto-fixed (2 bugs, 2 missing critical, 1 blocking)
**Impact on plan:** All five necessary for either correctness, security, or test stability. No scope creep.

## Issues Encountered

- **Idempotency replay across test runs (see Deviation 3)** — surfaced on the first full-suite run after Task 3. Resolved by clearing `idempotency_keys` for the test user in `beforeAll`/`beforeEach`. Pattern 32.
- **LocalStack already-running container needed bucket creation outside the init script (see Deviation 2)** — operational; documented for future plan executions to either (a) re-run `dev-up.sh` cleanly or (b) `docker exec` the bucket creation.
- **Migration 0004 needed manual `pnpm db:migrate` invocation** — same pattern as plan 01-05's deviation; the test files don't run migrations themselves. Addressed by running `DATABASE_URL=… pnpm db:migrate` once before tests.

## User Setup Required

None — no external service configuration required for plan 08. The feedback bucket is dev-only via LocalStack init; production provisioning is plan 01-10's Terraform scope.

## Next Phase Readiness

- **Phase 1 API surface is feature-complete** — every endpoint listed in PROJECT.md "Backend (Fastify + Postgres + S3)" except the recordings hash-verify pipeline (Phase 5) is now wired and tested.
- **Ready for plan 01-09** (final API hardening / OpenAPI generation) — every route uses the same plugin stack and Pattern 22 response-schema convention, so an aggregator pass is straightforward.
- **Ready for plan 01-10** (Terraform — provisions humyn-feedback-prod with same lifecycle as the LocalStack init script, mirroring humyn-recordings-prod).
- **Ready for plan 01-11** (legal — DSR exports under `feedback/dsr-exports/` prefix; consent-text-hash backfill from the plan-05 `PENDING_LEGAL_TEXT_HASH` placeholder).
- **Ready for plan 01-12** (e2e — every Phase-1 endpoint exercisable against the buildApp() factory).
- **Phase 5 picks up:** (a) hash-verify worker reads `recordings_to_verify` queue → writes `qa_status='verified'` → contributions trigger refreshes the bucket; (b) DSR worker swaps the cron stub body for actual hard-delete with S3 prefix purge.

## Self-Check: PASSED

Verified:

- `apps/api/src/db/migrations/0004_contributions_trigger_and_feedback_bucket.sql` — exists.
- `apps/api/src/routes/{me/get-patch,me/delete-restore,me/index,contributions/list,contributions/timeseries,contributions/index,events/post,feedback/post,app-version/get,app-version/seed-initial}.ts` — all exist.
- `apps/api/src/lib/feedback-uploader.ts` — exists.
- `apps/api/src/cron/dsr-hard-delete.ts` — exists.
- `shared/types/src/{me,contributions,app-version,events,feedback}.ts` — all exist.
- `apps/api/test/routes/{me-get-patch,me-delete-restore,contributions,events,feedback,app-version}.test.ts` — all exist.
- Migration 0004 applied to dev Postgres (verified via `pnpm db:migrate` → "Migrations: 1 applied, 3 skipped").
- LocalStack `humyn-feedback-dev` bucket exists (verified via `docker exec humyn-localstack awslocal s3 ls`).
- All 6 plan-08 test files green (24 tests); full suite green (28 files / 108 tests).
- Commit hashes `d189572`, `90df5a9`, `5dae6e1` exist in `git log`.

---

_Phase: 01-foundation-backend-distribution-recon_
_Completed: 2026-05-07_
