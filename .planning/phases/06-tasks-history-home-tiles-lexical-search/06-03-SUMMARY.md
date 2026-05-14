---
phase: 06-tasks-history-home-tiles-lexical-search
plan: 03
subsystem: backend-recordings-contributions
tags:
  [
    fastify,
    drizzle,
    zod,
    cloudfront-signer,
    vitest,
    time-range,
    archive-state,
    pattern-22,
    pattern-28,
  ]

# Dependency graph
requires:
  - phase: 01-foundation-backend-distribution-recon
    provides: GET /recordings (list) + GET /recordings/:id (get) + GET /contributions/timeseries (Phase 1 surface); recordings schema (s3_key_video, created_at, qa_status enum); CloudFront-signer env contract (CLOUDFRONT_RECORDINGS_PRIVATE_KEY/KEY_PAIR_ID/BASE_URL); problem-detail builder + PROBLEM_SLUGS.recordingNotFound; per-user rate-limit keyGenerator pattern from /contributions/list.ts
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: events-outbox `_events` onSend hook + EventsEnvelopeSchema (the stream-url response is an _events carrier)
provides:
  - "GET /recordings/:id/stream-url — CloudFront-signed playback URL with discriminated archiveState envelope ('available' | 'unavailable' | 'deep-archive'); 5-min TTL; 60/min/user rate-limit; T-1.7-10 no-existence-leak on takedown/rejected/cross-user"
  - "GET /recordings — extended with optional start/end ISO 'YYYY-MM-DD' query params (D-03) and Accept-Timezone IANA header (D-03b); start/end take precedence over `range`"
  - 'GET /contributions/timeseries — extended with optional start/end + Accept-Timezone + aggregate=true flag (D-03a) for one summed bucket with COUNT(DISTINCT task_id)'
  - 'Reworded REQUIREMENTS.md HIST-07/08/09 to reflect D-06 streaming-in-MVP scope expansion'
  - 'Shared zod types: ArchiveStateSchema enum, RecordingsStreamUrlParamsSchema, RecordingsStreamUrlResponseSchema (with _events envelope carrier)'
  - 'PG idiom Pattern: `::date::timestamp AT TIME ZONE tz` (NOT `::date AT TIME ZONE tz`) for interpreting wall-clock YYYY-MM-DD AS IF in tz'
affects:
  [
    phase-06-wave-3,
    phase-06-wave-4,
    phase-06-wave-5,
    plan-06-05-mobile-recordings-api,
    plan-06-08-history-screen,
    plan-06-10-player-screen,
  ]

# Tech tracking
tech-stack:
  added: [] # no new deps; reuses existing @aws-sdk/cloudfront-signer, Drizzle sql template, fastify-zod
  patterns:
    - 'Pattern 22 — response schema omitted when route returns both 200 and 4xx problem-detail (applied to stream-url + list.ts; declaring response.200 narrows reply.code() and breaks the 400/404 send)'
    - 'Pattern 28 — Fastify radix-tree precedence: literal /recordings/:id/stream-url MUST register BEFORE the parameterised /recordings/:id'
    - 'Pattern 16 — per-user rate-limit keyGenerator with best-effort jwtVerify + ip fallback (60/min/user on stream-url)'
    - 'PG `::date::timestamp AT TIME ZONE tz` pattern for converting a wall-clock YYYY-MM-DD in IANA tz to UTC timestamptz (the inverse direction of `timestamptz AT TIME ZONE tz` rendering)'
    - "Single-bucket aggregate variant of a daily-bucket time-series endpoint: same response shape (`buckets: [...]`), single element, distinct-task count from raw recordings table (so it can't double-count cross-day)"

key-files:
  created:
    - apps/api/src/routes/recordings/stream-url.ts
    - apps/api/test/routes/recordings-stream-url.test.ts
    - apps/api/test/routes/contributions-timeseries.test.ts
  modified:
    - apps/api/src/routes/recordings/schemas.ts
    - apps/api/src/routes/recordings/list.ts
    - apps/api/src/routes/recordings/index.ts
    - apps/api/src/routes/contributions/timeseries.ts
    - apps/api/test/routes/recordings-list.test.ts
    - shared/types/src/recording.ts
    - shared/types/src/contributions.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - 'Stream-URL mints CloudFront-signed URLs (NOT S3 presigned) — keeps prod parity with /recordings/:id (06-RESEARCH Q-1). Same env contract: CLOUDFRONT_RECORDINGS_PRIVATE_KEY + KEY_PAIR_ID + BASE_URL.'
  - "Deep-Archive cutoff derived from created_at > 90d in-process (NOT an S3 HeadObject) — matches Phase 1 S3 lifecycle without a per-request AWS call. archiveState='deep-archive' / presignedUrl=null."
  - "qa_status='pending' (no S3 object yet) → archiveState='unavailable' / presignedUrl=null; takedown/rejected/cross-user → 404 problem-detail (T-1.7-10 no existence leak)."
  - "Pattern 22 applied to list.ts as a Rule-3 deviation. The plan said 'list.ts already follows Pattern 22'; in fact it had `response: { 200: RecordingsListResponseSchema }`. With the new 400 problem-detail path for invalid Accept-Timezone, fastify-zod narrowed reply.code() to 200 only. Removed the response.200 declaration; body shape preserved via explicit `RecordingsListResponse` return type."
  - "PG `AT TIME ZONE` gotcha (Rule 1 bug fix) — `'2026-05-14'::date AT TIME ZONE 'Asia/Kolkata'` implicitly casts date→timestamptz via the SESSION TZ first, then renders in 'Asia/Kolkata' — the OPPOSITE direction. Correct idiom: `('2026-05-14'::date::timestamp AT TIME ZONE 'Asia/Kolkata')` interprets the bare wall-clock midnight AS IF in IST and returns a timestamptz (2026-05-13 18:30+00). Both list.ts and timeseries.ts use this idiom; verified end-to-end by the IST boundary test."
  - "aggregate=true single-bucket variant (D-03a) preserves the existing daily-buckets response shape (`buckets: [...]`) — one element instead of N. Bucket-date anchors at `start` when provided, today's ISO date when only `range` provided. Distinct task count comes from `COUNT(DISTINCT task_id)` over `recordings` rows, NOT a sum across daily buckets (would double-count tasks recurring on multiple days)."
  - 'Stream-URL route uses `RecordingsStreamUrlParamsSchema` (new) rather than reusing `RecordingsGetParamsSchema` from `schemas.ts` — keeps the shared/types package the single source of truth for the public wire surface (mobile client consumes the new params + response schemas from `@humyn/shared-types`).'

patterns-established:
  - "Pattern (PG): `::date::timestamp AT TIME ZONE tz` for the 'interpret bare YYYY-MM-DD AS IF in tz, return timestamptz' direction. Bare `::date AT TIME ZONE tz` does the OPPOSITE direction (renders an existing timestamptz in tz)."
  - 'Pattern (Fastify-zod): When extending an existing route to add a non-200 return path, audit `response: { 200: ... }` declarations. Per Pattern 22, drop the response.200 schema; preserve body typing via an explicit `type X = z.infer<typeof XSchema>` return-type annotation.'
  - "Pattern (test): For the deep-archive case, override `created_at` directly via raw INSERT (Drizzle's defaultNow forces now()). The seedRec(opts: { createdAtOverride? }) helper extends the existing recordings-get.test.ts seedRec pattern."

requirements-completed: [HOME-03, HOME-04, HIST-03, HIST-07, HIST-08, HIST-09, HIST-01]

# Metrics
duration: ~15min
completed: 2026-05-14
---

# Phase 6 Plan 03: Backend Half-B — Time-Range Endpoints + Stream-URL + REQUIREMENTS Rewording Summary

**Three thin endpoint changes land the time-range + stream-URL contract for the Phase 6 client: `GET /recordings` and `GET /contributions/timeseries` now accept optional `start`/`end` ISO dates + an `Accept-Timezone` IANA header (so "this week" / "this month" respect device local-tz boundaries); `/contributions/timeseries?aggregate=true` returns one summed bucket with a correct `COUNT(DISTINCT task_id)` for Home tiles; and the new `GET /recordings/:id/stream-url` mints CloudFront-signed playback URLs with a discriminated `archiveState` envelope (`available` / `unavailable` / `deep-archive`) so the player can render the disabled state without a second round-trip. REQUIREMENTS.md HIST-07/08/09 now reflect D-06 streaming-in-MVP.**

## Tasks Executed

| Task | Name                                                                                                                                                        | Commit    | Files                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Extend zod schemas (RecordingsListQuery start/end; ContributionsTimeseriesQuery start/end+aggregate; new RecordingsStreamUrlParams/Response + ArchiveState) | `90ea7eb` | `apps/api/src/routes/recordings/schemas.ts`, `shared/types/src/contributions.ts`, `shared/types/src/recording.ts`                                                                                                                                                      |
| 2    | Honor start/end + Accept-Timezone + aggregate flag in routes; drop response.200 schema on list.ts (Pattern 22)                                              | `18f2c13` | `apps/api/src/routes/recordings/list.ts`, `apps/api/src/routes/contributions/timeseries.ts`                                                                                                                                                                            |
| 3    | Mint `GET /recordings/:id/stream-url`; register BEFORE `/:id` (Pattern 28)                                                                                  | `b0019d1` | `apps/api/src/routes/recordings/stream-url.ts` (NEW), `apps/api/src/routes/recordings/index.ts`                                                                                                                                                                        |
| 4    | Vitest coverage (10 stream-url + 5 new list + 6 timeseries) + PG `::date::timestamp` bug fix                                                                | `d8ef894` | `apps/api/test/routes/recordings-stream-url.test.ts` (NEW), `apps/api/test/routes/contributions-timeseries.test.ts` (NEW), `apps/api/test/routes/recordings-list.test.ts`, `apps/api/src/routes/recordings/list.ts`, `apps/api/src/routes/contributions/timeseries.ts` |
| 5    | Reword REQUIREMENTS.md HIST-07/08/09 per CONTEXT D-06 (streaming in MVP)                                                                                    | `645bffd` | `.planning/REQUIREMENTS.md`                                                                                                                                                                                                                                            |

## What Got Built

### `GET /recordings/:id/stream-url` (D-08)

CloudFront-signed playback URL endpoint with the discriminated `archiveState` envelope:

| Input state                                                     | Output                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `qa_status` ∈ {uploaded, verified, hash-mismatch}, `age ≤ 90 d` | `200 { presignedUrl: <CF-signed>, expiresAt: ISO, archiveState: 'available' }` |
| `qa_status='pending'`                                           | `200 { presignedUrl: null, expiresAt: ISO, archiveState: 'unavailable' }`      |
| `age > 90 d` (Deep Archive)                                     | `200 { presignedUrl: null, expiresAt: ISO, archiveState: 'deep-archive' }`     |
| `qa_status` ∈ {takedown, rejected} OR cross-user OR not-found   | `404 application/problem+json` (T-1.7-10 no leak)                              |
| No JWT                                                          | `401`                                                                          |

- TTL = 5 min (`STREAM_TTL_SECONDS = 5 * 60`)
- Deep-Archive cutoff = 90 d (`DEEP_ARCHIVE_DAYS = 90`) derived from `created_at` (no S3 HeadObject)
- Per-user 60/min rate limit (Pattern 16 keyGenerator with IP fallback)
- Pattern 22 — response schema omitted (200 + 404 coexist)
- CAP-18 preserved — server never reads recording bytes (only mints the signed URL)

### `GET /recordings` extensions (D-03 + D-03b)

- Optional `start` + `end` query params, ISO `YYYY-MM-DD`, regex-validated. When both present, they take precedence over `range`.
- Optional `Accept-Timezone` IANA header (e.g. `Asia/Kolkata`), validated via `Intl.DateTimeFormat(tz).resolvedOptions()`. Unknown TZ → 400 problem-detail.
- WHERE clause uses `${start}::date::timestamp AT TIME ZONE ${tz}` (NOT `${start}::date AT TIME ZONE ${tz}` — see PG idiom decision below).
- `range` enum (`7d|30d|90d|all`) preserved as a convenience alias.

### `GET /contributions/timeseries` extensions (D-03 + D-03a)

- Same `start`/`end` + `Accept-Timezone` plumbing as `/recordings`.
- New `aggregate=true` (default false) returns ONE summed bucket from the `recordings` table directly:
  ```json
  { "buckets": [{ "bucketDate": "<start or today>", "durationMs": SUM, "recordingCount": COUNT(*), "taskCount": COUNT(DISTINCT task_id) }] }
  ```
- The single-bucket variant is for Home tiles (HOME-03 / HOME-04). Summing daily buckets client-side would double-count tasks recurring on multiple days; querying recordings directly with `COUNT(DISTINCT task_id)` is exact.
- `aggregate=false` (default) preserves the Phase-1 daily-buckets shape unchanged.

### Shared zod types (`@humyn/shared-types`)

```typescript
// recording.ts
export const ArchiveStateSchema = z.enum(['available', 'unavailable', 'deep-archive']);
export const RecordingsStreamUrlParamsSchema = z.object({ id: z.string().length(26) });
export const RecordingsStreamUrlResponseSchema = z
  .object({
    presignedUrl: z.string().url().nullable(),
    expiresAt: z.string().datetime(),
    archiveState: ArchiveStateSchema,
  })
  .extend(EventsEnvelopeSchema.shape); // _events carrier

// contributions.ts
export const ContributionsTimeseriesQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d'),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  aggregate: z.coerce.boolean().default(false),
});
```

### REQUIREMENTS.md HIST-07/08/09 reworded (D-06)

| Before                                                                                                      | After                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIST-07: "...while the local MP4 still exists"                                                              | "Plays from the local MP4 when present; otherwise streams via the server (see HIST-09)."                                                                          |
| HIST-08: "thumbnail remains but tap shows 'This recording has been securely uploaded. Local copy cleared.'" | "tap streams via the server. If Deep Archive (>90d), tap shows 'This recording has been archived. Contact support for retrieval.'"                                |
| HIST-09: "Streaming uploaded recordings back from the server is **out of MVP**"                             | "Streaming uploaded recordings back from the server is **in MVP** for Phase 6, via short-TTL CloudFront-signed GET ... Deep-Archive async-thaw is §v2 / Phase 7." |

Each entry tagged "_Reworded by Phase 6 Plan 06-03 per CONTEXT D-06_". HIST-10/HIST-11 untouched. Traceability table preserved.

## Pattern 28 Registration Order — proof

```
$ grep -n 'recordingsStreamUrlRoute\|recordingsGetRoute' apps/api/src/routes/recordings/index.ts
14:import recordingsStreamUrlRoute from './stream-url.js';
15:import recordingsGetRoute from './get.js';
32:  await app.register(recordingsStreamUrlRoute); // GET /recordings/:id/stream-url (Phase 6 plan 06-03)
33:  await app.register(recordingsGetRoute); // GET /recordings/:id (parameterized — LAST)
```

stream-url at line 32, get at line 33 — literal-before-parameterised confirmed. Without this ordering, `/recordings/:id` would match `id="<ulid>/stream-url"` and surface a 400 (28-char id fails the 26-char ULID schema), not a 200 from the new route.

## Verification

```
$ pnpm -r --parallel typecheck
shared/types typecheck: Done
apps/api typecheck: Done

$ pnpm --filter @humyn/api test -- --run \
    test/routes/recordings-stream-url.test.ts \
    test/routes/recordings-list.test.ts \
    test/routes/contributions-timeseries.test.ts \
    test/routes/contributions.test.ts \
    test/routes/recordings-get.test.ts
Test Files  5 passed (5)
Tests       35 passed (35)
```

Test breakdown:

- `recordings-stream-url.test.ts` — 10/10 (full D-08 behavior matrix)
- `recordings-list.test.ts` — 10/10 (5 original + 5 new D-03/D-03b: start/end precedence, invalid date 400, unknown TZ 400, IST midnight boundary, UTC no-op)
- `contributions-timeseries.test.ts` — 6/6 (one-bucket shape, COUNT(DISTINCT) correctness with 3 rows / 2 tasks → taskCount=2, aggregate=false unchanged, start/end window narrowing, Accept-Timezone window edges, unknown TZ 400)
- `contributions.test.ts` — 3/3 (Phase-1 surface unchanged)
- `recordings-get.test.ts` — 6/6 (regression check on the `/:id` route — confirms Pattern 28 didn't break it)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `apps/api/src/routes/recordings/list.ts` had `response: { 200: RecordingsListResponseSchema }` declared (Pattern 22 violation discovered).**

- **Found during:** Task 2 typecheck after adding the 400 problem-detail return path for invalid Accept-Timezone
- **Issue:** Plan claimed "list.ts already follows this [Pattern 22]"; in fact the route had a `response.200` schema, which fastify-zod uses to narrow `reply.code()` to `200`. Adding `return reply.status(400).send(pd)` produced TS2345: "Argument of type '400' is not assignable to parameter of type '200'."
- **Fix:** Removed the `response.200` declaration; added an explicit `type RecordingsListResponse = z.infer<typeof RecordingsListResponseSchema>` return-type annotation so the body shape stays statically checked on the 200 path. The `RecordingsListResponseSchema` import is still used by tests and downstream consumers.
- **Files modified:** `apps/api/src/routes/recordings/list.ts`
- **Commit:** `18f2c13`

**2. [Rule 1 — Bug] PG `::date AT TIME ZONE tz` interprets in the WRONG direction.**

- **Found during:** Task 4 — the `Asia/Kolkata IST midnight boundaries` test failed (`expect(items).toHaveLength(1)` got `0`).
- **Issue:** PostgreSQL's `'2026-05-14'::date AT TIME ZONE 'Asia/Kolkata'` returns `timestamp without time zone` valued `2026-05-14 05:30:00`. PG implicitly casts `date → timestamptz` via the session TZ (UTC in our setup) first, then `AT TIME ZONE tz` _renders_ in IST — that's the OPPOSITE direction from "interpret YYYY-MM-DD AS IST midnight, return UTC timestamptz." The original code matched no rows because the comparison was against a timestamp 05:30 hours later than intended.
- **Fix:** Cast `::date::timestamp` (NOT `::date`) before `AT TIME ZONE tz`. `'2026-05-14'::date::timestamp AT TIME ZONE 'Asia/Kolkata'` correctly returns `2026-05-13 18:30:00+00` (IST midnight expressed in UTC). Applied in both `list.ts` and `timeseries.ts`. Verified with the IST boundary test:
  - `'2026-05-13T18:31:00Z'` ∈ window `start=2026-05-14 end=2026-05-15` when `tz=Asia/Kolkata` ✓
  - `'2026-05-13T18:29:00Z'` ∉ window (one minute earlier IST) ✓
- **Files modified:** `apps/api/src/routes/recordings/list.ts`, `apps/api/src/routes/contributions/timeseries.ts`
- **Commit:** `d8ef894`

### Tooling

- The plan's Task 1 verification command `npm run build --workspace=shared/types` does not exist — `shared/types/package.json` exposes only `lint`, `typecheck`, and `test`; the `main`/`types` fields point at `src/index.ts` directly (no build step). Substituted `pnpm --filter @humyn/shared-types typecheck`. No content change.
- The plan referenced `npm run` for workspace commands; the repo uses `pnpm` (per `pnpm-lock.yaml`). Adopted `pnpm --filter @humyn/<pkg>` form throughout. No content change.
- ESLint rule `@typescript-eslint/no-new` is not configured in this repo. Replaced the `eslint-disable-next-line` directive with a `.resolvedOptions()` call that forces the constructor side-effect without triggering the base `no-new` rule. Same runtime behavior; eslint passes.

### No architectural changes

All deviations were auto-fix-able under Rules 1-3. No Rule 4 (architectural) decisions surfaced — the threat model and the planner-locked discretion calls (CloudFront over S3-presigned; sum-locally vs new aggregate route → went with aggregate flag) were already resolved in 06-CONTEXT.md and 06-RESEARCH.md.

## Threat Model — Mitigations Applied

| Threat ID                                        | Disposition | How verified                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-6.3-01 (cross-user spoofing on stream-url)     | mitigate    | `recordings-stream-url.test.ts` cases 5/6/7 — takedown / rejected / cross-user all return 404, never leak existence                                                                                                                            |
| T-6.3-02 (Accept-Timezone header injection)      | mitigate    | `Intl.DateTimeFormat(tz).resolvedOptions()` validator + Drizzle `sql` parameter binding (not concatenation); `recordings-list.test.ts` `Made/Up_TZ` case + `contributions-timeseries.test.ts` `Made/Up_TZ` case both return 400 problem-detail |
| T-6.3-03 (massive-window DoS)                    | mitigate    | per-user rate limits unchanged (`/recordings` inherits existing; `/stream-url` is 60/min); `range=all` already allowed unbounded windows                                                                                                       |
| T-6.3-04 (URL leak in logs)                      | mitigate    | Signed URL is in response body only; pino redaction unchanged. `req.url` captures route path, not signed URL                                                                                                                                   |
| T-6.3-05 (replay after takedown)                 | accept      | URL TTL = 5 min; tradeoff documented in plan                                                                                                                                                                                                   |
| T-6.3-06 (rate-limit bypass via stale JWT)       | mitigate    | keyGenerator does its own `jwtVerify()` + ip fallback (Pattern 16); same as `/contributions`                                                                                                                                                   |
| T-6.3-07 (per-user storm)                        | mitigate    | 60/min/user matches `/contributions` ceiling                                                                                                                                                                                                   |
| T-6.3-08 (deep-archive existence leak via age)   | accept      | Owner of the row only; not a leak (authenticated user querying their own data)                                                                                                                                                                 |
| T-6.3-09 (CAP-18 violation — server reads bytes) | mitigate    | Verified by inspection: `stream-url.ts` only mints the URL; no `GetObjectCommand` body read                                                                                                                                                    |

No new threat surface introduced beyond what the plan enumerated. No `threat_flag` section needed.

## Self-Check

- ✓ `apps/api/src/routes/recordings/stream-url.ts` — FOUND
- ✓ `apps/api/test/routes/recordings-stream-url.test.ts` — FOUND
- ✓ `apps/api/test/routes/contributions-timeseries.test.ts` — FOUND
- ✓ Commit `90ea7eb` (feat 06-03 schemas) — FOUND
- ✓ Commit `18f2c13` (feat 06-03 routes) — FOUND
- ✓ Commit `b0019d1` (feat 06-03 stream-url) — FOUND
- ✓ Commit `d8ef894` (test 06-03) — FOUND
- ✓ Commit `645bffd` (docs 06-03 REQUIREMENTS) — FOUND

## Self-Check: PASSED
