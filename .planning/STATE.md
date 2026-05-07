---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Plan 01-08 complete + committed (commits d189572, 90df5a9, 5dae6e1). Full /me + /contributions + /events + /feedback + /app/version surface — API-10/11/12/13/14/15 shipped. Migration 0004 installs the recordings → contributions denormalization trigger; DSR cron stub logs daily candidates past the 30-day grace (Phase 5 owns actual hard-delete). 24 new vitest tests across 6 files; 108 total green. Phase 1 backend API surface is feature-complete (only hash-verify worker — Phase 5 — remains). Ready for plan 01-09.
last_updated: '2026-05-07T15:29:03.774Z'
last_activity: 2026-05-07
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 13
  completed_plans: 8
  percent: 62
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** On-device capture quality is non-negotiable — every uploaded segment must hit the locked spec (1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz / ±1 ms timestamp alignment) or the bytes are worthless for training.
**Current focus:** Phase 1 — foundation-backend-distribution-recon

## Current Position

Phase: 1 (foundation-backend-distribution-recon) — EXECUTING
Plan: 8 of 13 complete (sequential order in wave 1+2: 01-01 ✓ → 01-03 ✓ → 01-02 ✓ → 01-04 ✓ → 01-05 ✓ → 01-06 ✓ → 01-07 ✓ → 01-08 ✓; 01-09 next)
Status: Plan 01-08 complete; full /me + /contributions + /events + /feedback + /app/version surface shipped + 24 new vitest tests; ready for 01-09
Last activity: 2026-05-07

Progress: [██████░░░░] 62%

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: ~11 min
- Total execution time: ~1.45 hours

**By Phase:**

| Phase    | Plans  | Total  | Avg/Plan |
| -------- | ------ | ------ | -------- |
| Phase 01 | 8 / 13 | 87 min | ~11 min  |

**Recent Trend:**

- Last 8 plans: 01-01 (7 min, 3 tasks, 22 files), 01-03 (5 min, 3 tasks, 7 files), 01-02 (6 min, 3 tasks + checkpoint, 11 files), 01-04 (9 min, 3 tasks, 18 files), 01-05 (13 min, 4 tasks, 25 files), 01-06 (18 min, 3 tasks, 17 files), 01-07 (12 min, 4 tasks, 17 files), 01-08 (17 min, 3 tasks, 28 files)
- Trend: 01-08 the second-longest of the phase — 7 endpoint groups in one plan, 5 deviations to resolve, full multipart wiring + DSR cron + migration 0004 trigger. Phase 1 backend API surface is now feature-complete (only hash-verify worker — Phase 5 — remains). Plan 01-09 should be lighter (final API hardening).

_Updated after each plan completion_
| Phase 01 P08 | 17 min | 3 tasks | 28 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Codename "Homelander"; product brand "Humyn Labs Capture"
- Init: Backend included in MVP scope (Fastify + Postgres + S3) — hash-verify and presigned URLs are core to upload reliability
- Init: Designs LOCKED to `prototype.html` + `design-spec.md` + `engineering-handoff.md` — no new design work
- Init: Hand-detection gate (one-shot pre-record) moved into MVP, supersedes deferred entry
- Init: Server-side IMU liveness fraud check **promoted from v2 to MVP** backend scope (Phase 5) — capture spec already collects the data; on-device hand-gate alone is trivially defeated by TV-replay
- Roadmap: Horizontal-layer phase structure (7 phases) compressed from research's 12-phase suggestion per granularity=standard
- [Phase 1]: Plan 01-01: ESLint 9.16.0 forced flat-config migration; created eslint.config.mjs at root, deleted .eslintrc.json, added @eslint/js + typescript-eslint umbrella
- [Phase 1]: Plan 01-01: @aws-sdk/cloudfront-signer pinned at 3.1036.0 (not 3.1044.0); cloudfront-signer is on a slower release cadence than other AWS SDK v3 modules
- [Phase 1]: Plan 01-01: bootstrap pnpm via corepack (corepack prepare pnpm@9.15.0 --activate); matches package.json packageManager pin and is reproducible across machines
- [Phase 1]: Plan 01-03: pgvector image ships 0.8.2 (vs locked 0.8.0 floor); same major.minor, bugfix-only, HNSW API identical — accept the image default rather than pinning a specific image SHA
- [Phase 1]: Plan 01-03: localstack image pinned at major.minor `localstack/localstack:4.0` (runtime resolves to 4.0.3) so patch fixes flow without docker-compose churn
- [Phase 1]: Plan 01-03: LocalStack readiness gating lives in scripts/dev-up.sh (not docker-compose `depends_on`), keeping compose declarative and concentrating dev ergonomics in one shell script
- [Phase 1]: Plan 01-03: lifecycle JSON in infra/localstack/init/01-create-buckets.sh is the single source of truth — plan 01-10 Terraform will use byte-identical JSON for prod parity (LEGAL-05)
- [Phase 1]: Plan 01-02: Renamed drizzle-kit auto-generated migration filename `0000_overconfident_major_mapleleaf.sql` → `0001_init.sql` (and `meta/_journal.json` tag accordingly); auto-name's random third-word component is non-deterministic across machines, deterministic naming makes the migration committable
- [Phase 1]: Plan 01-02: 0001_init.sql is a hybrid file — drizzle-kit auto-generated DDL bookended by hand-written CREATE EXTENSION (top) and DROP/ADD generated tsvector + HNSW + GIN (bottom). Future migrations needing pg-only features follow the same pattern (Pattern 9)
- [Phase 1]: Plan 01-02: schema declares `nameSearch` as a regular tsvector column in Drizzle (Drizzle 0.45 has no GENERATED ALWAYS DSL); migration replaces it with the generated variant. INSERT/UPDATE statements against tasks must NOT include name_search in the column list (Postgres rejects writes to GENERATED ALWAYS columns) — plan 01-06 task seeding inherits this rule
- [Phase 1]: Plan 01-04: fastify-type-provider-zod 4.x is incompatible with zod@4 (locked in plan 01-01) — bumped to 6.1.0 (first version with peer zod >= 4.1.5); the API surface used (validatorCompiler, serializerCompiler, ZodTypeProvider) is unchanged
- [Phase 1]: Plan 01-04: Idempotency global preHandler MUST decode the JWT itself via best-effort `req.jwtVerify()` — Fastify runs `app.addHook('preHandler', ...)` BEFORE route-level requireAuth, so the original `req.user.sub` lookup always observed undefined and persistence never fired. Failed token decodes fall through to route-level requireAuth for the standard 401.
- [Phase 1]: Plan 01-04: @fastify/rate-limit's errorResponseBuilder THROWS its return value through setErrorHandler; returning a plain object falls through the catch-all 500 branch. Builder now returns Error subclass with `.problemDetail` field; error-handler short-circuits on that (Pattern 14) — preserves wire-side extensions like `tier: 'anonymous'` and `retryAfterSeconds`.
- [Phase 1]: Plan 01-04: req.user typing across the codebase comes from augmenting `@fastify/jwt`'s FastifyJWT interface (`payload: JwtPayload; user: JwtPayload`), not the Fastify-side FastifyRequest interface (which collides with @fastify/jwt's own augmentation) — Pattern 15.
- [Phase 1]: Plan 01-05: Idempotent migration runner with schema_migrations bookkeeping table — plan 02's runner hard-coded 0001_init.sql; backfilled the bookkeeping table by hand once at this transition (Pattern 23)
- [Phase 1]: Plan 01-05: JwtPayload.iat/exp relaxed to optional in apps/api/src/plugins/auth.ts — exactOptionalPropertyTypes broke app.jwt.sign at the sign site; jsonwebtoken auto-fills both at sign-time and asserts at verify-time so runtime guarantee preserved
- [Phase 1]: Plan 01-05: Response schema intentionally omitted from /auth/google ZodTypeProvider config — declaring response: { 200: ... } narrows reply.code() to 200, breaking non-200 problem-detail returns. Body schema still validated; happy-path response shape enforced manually in the return statement (Pattern 22)
- [Phase 1]: Plan 01-05: Status code split 401 vs 403 for integrity rejects — nonce + stale = 401 (auth gate); device-integrity + flavor + package + allowlist mismatches = 403 (policy gate). RFC 7235-correct semantics; refines plan body's universal-403 (Pattern 21)
- [Phase 1]: Plan 01-05: PENDING_LEGAL_TEXT_HASH placeholder in /auth/google — plan 11 owns the consent text + sha256; consent_log rows still written (D-LEGAL-03 audit trail). Plan 11 swaps the constant + can backfill historical rows if counsel requires
- [Phase 1]: Plan 01-05: Three-gate install-source bypass — (1) STATIC_BYPASS_ALLOWED hard-codes playStore=false; (2) flavor-allowlist cross-check; (3) Remote Config key keyed by applicationId. ALL three must pass; playStore APK structurally cannot read the apkRollout RC key (Pattern 17)
- [Phase 1]: Plan 01-05: W6 Phase-1 iOS gate via gatePhase1Flavor() throwing UnsupportedFlavorError — /auth/google emits 501 + integrity-flavor-not-supported. Phase 7 swaps the gate body for App Attest verification; the route handler is unchanged (Pattern 18)
- [Phase 1]: Plan 01-06: Markdown-table parser for task-taxonomy.md (Pattern 27) — taxonomy is a single | Category | Task | Setting | Description | Instructions | table; slugs come from mapping.json (joined by name with normalizeName collapsing parenthetical suffixes). Plan body's per-section parser was wrong format.
- [Phase 1]: Plan 01-06: Embedder pooling=mean and normalize=true bound inside embed() (Pattern 25) — same configuration at seed and query time; drift collapses HNSW recall (T-1.6-06). Bypassing embed() is forbidden.
- [Phase 1]: Plan 01-06: Async keyGenerator for authenticated-tier rate-limit (Pattern 26) — @fastify/rate-limit fires before route preHandlers, so keyGenerator must do its own best-effort jwtVerify() and fall back to per-IP. Same shape as plan 04 idempotency hook-ordering fix.
- [Phase 1]: Plan 01-06: Vitest pool: 'forks' + singleFork: true (Pattern 24) — multiple test files race on shared Postgres state via blanket db.delete in beforeEach; serialized execution is the bridge until plan 12 BEGIN/ROLLBACK isolation lands.
- [Phase 1]: Plan 01-06: /tasks/search must register BEFORE /tasks/:id (Pattern 28) — Fastify radix-tree precedence; literal beats wildcard when sequential.
- [Phase ?]: [Phase 1]: Plan 01-08: Per-applicationId rate-limit bucket on DELETE /me — 5/min keyed by 'delete-me:${applicationId}' caps account-deletion DoS even with rotating JWTs from the same build flavor (Pattern 29).
- [Phase ?]: [Phase 1]: Plan 01-08: Migration 0004 trigger AUTO-DELETES empty contribution buckets when v_count=0 — keeps the contributions table sparse and matches /contributions/timeseries oldest-first iteration semantics (Pattern 30).
- [Phase ?]: [Phase 1]: Plan 01-08: AppVersionResponseSchema = z.discriminatedUnion('flavor') — three concrete shapes (apkRollout, playStore, iosAppStore) per D-APK-02; clients narrow on flavor for type-safe upgrade-URL access (Pattern 33).
- [Phase ?]: [Phase 1]: Plan 01-08: /feedback registers @fastify/multipart INSIDE the route plugin (not globally) — global idempotency hook keeps its standard JSON-body hash path; multipart hash falls back to (method, path, undefined-body) which is acceptable since UUIDv4 reuse with different multipart body is a client error (Pattern 31).
- [Phase ?]: [Phase 1]: Plan 01-08: Test-side idempotency_keys cleanup — deterministic UUIDs in vitest files would replay stale responses across runs; beforeAll/beforeEach deletes idempotency_keys for the test user (Pattern 32). Plan 12 BEGIN/ROLLBACK isolation will retire this.
- [Phase ?]: [Phase 1]: Plan 01-08: NODE_ENV=test gate on startDsrCron — singleFork test pool would accumulate setInterval handles + log noise across test files; production server.ts boot path always runs it (Pattern 34).
- [Phase ?]: [Phase 1]: Plan 01-08: GET /app/version intentionally NO requireAuth — pre-sign-in clients need force_upgrade BEFORE they can sign in; Cache-Control public, max-age=21600 (6h) lets CDN edges serve copies, eating most of the load.
- [Phase ?]: [Phase 1]: Plan 01-08: feedback diagnostic stored BOTH in S3 (full 5 MB) AND inline on row (first 100 KB after JSON.parse + truncate) — support reads inline without an S3 hop, investigators read full file from S3; inline always wraps with {\_s3_key} so each row is self-describing.
- [Phase ?]: [Phase 1]: Plan 01-08: EVENT_NAMES is a hard-coded const (14 names) — adding a new telemetry event requires shipping shared/types release; type-level schema-creep guard against one-off telemetry calls (T-1.8-05).

### Pending Todos

None yet.

### Blockers/Concerns

Decisions to resolve during phase planning (per research SUMMARY.md):

- Phase 1: APK build flavor `applicationId` choice (`ai.humynlabs.capture.apk` vs `ai.humynlabs.capture`) — locked before flavor structure built
- Phase 1: Embedding provider for `/tasks` semantic search (OpenAI `text-embedding-3-small` vs local sentence-transformers)
- Phase 1: DPDP / LGPD counsel engagement is an operational track that gates Play Store launch (Phase 7)
- Phase 2: Final Help Center support email (`[EMAIL_ADDRESS]` placeholder); compat-fail "what now" recovery copy needs final wording
- Phase 5: Hash-verify worker placement migration trigger (BullMQ + ECS at MVP → Lambda at 1M-hour scale)
- Phase 6: Published payouts-window date (replaces "Payments coming soon" copy)
- Project-wide: Real-device test-matrix procurement (Pixel 7a / 8a / Helio-class / Snapdragon-7 / Exynos 1280-1380) — current testing-guide six-device matrix is heavy on flagships

## Deferred Items

| Category                   | Item | Status | Deferred At |
| -------------------------- | ---- | ------ | ----------- |
| _(none — first milestone)_ |      |        |             |

## Session Continuity

Last session: 2026-05-07T15:29:03.771Z
Stopped at: Plan 01-08 complete + committed (commits d189572, 90df5a9, 5dae6e1). Full /me + /contributions + /events + /feedback + /app/version surface — API-10/11/12/13/14/15 shipped. Migration 0004 installs the recordings → contributions denormalization trigger; DSR cron stub logs daily candidates past the 30-day grace (Phase 5 owns actual hard-delete). 24 new vitest tests across 6 files; 108 total green. Phase 1 backend API surface is feature-complete (only hash-verify worker — Phase 5 — remains). Ready for plan 01-09.
Resume file: None
