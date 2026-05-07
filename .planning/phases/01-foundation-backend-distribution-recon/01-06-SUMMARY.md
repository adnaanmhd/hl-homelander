---
phase: 01-foundation-backend-distribution-recon
plan: 06
subsystem: backend
tags: [tasks, search, rrf, hnsw, gin, tsvector, embeddings, transformers, drizzle, vitest, seed]

# Dependency graph
requires:
  - phase: 01
    plan: 01
    provides: apps/api package with @xenova/transformers 2.17.2 + drizzle-orm 0.45.2 + ulid 2.3.0 + zod 4.4.3 pinned
  - phase: 01
    plan: 02
    provides: tasks + task_requests Drizzle tables; HNSW vector_cosine_ops index + GIN name_search index + GENERATED ALWAYS tsvector column on tasks
  - phase: 01
    plan: 04
    provides: buildApp() factory + zodPlugin + idempotency-key plugin + auth.requireAuth decorator + problem-detail catalog
  - phase: 01
    plan: 05
    provides: live POST /auth/* surface (provides JWTs that POST /task-requests consumes)
provides:
  - GET /tasks (list) — cursor pagination by ULID id, category + setting filters, max 100/page
  - GET /tasks/:id — 404 problem+json with not-found slug if missing
  - GET /tasks/search — RRF k=60 hybrid (HNSW vector cosine + tsvector ts_rank); SQL is verbatim from RESEARCH §1.3
  - POST /task-requests — requireAuth-gated; per-user 10/min rate-limit; idempotency-key required
  - apps/api/src/lib/embedder.ts — @xenova/transformers Xenova/all-MiniLM-L6-v2 singleton; embed() + buildEmbeddedText() shared at seed and query time
  - apps/api/scripts/parse-taxonomy.ts — markdown-table parser for task-taxonomy.md (65 rows) + name-normalized join with mapping.json (slug + iconKey)
  - apps/api/scripts/seed-tasks.ts — idempotent seed pipeline; ON CONFLICT (slug) DO UPDATE; runs via `pnpm seed:tasks`
  - shared/types: TasksList/Search Query+Response schemas + TaskRequestSchema (read shape); SHARED_TYPES_VERSION 0.3.0 → 0.4.0
  - 26 new vitest tests across 5 files (9 unit + 17 integration); 64 total green workspace-wide against live Postgres
  - Live HTTP smoke against running server confirms list / get / search / unauth /task-requests all return correct status + body
  - Vitest config switched to pool: 'forks' + singleFork: true to serialize DB-touching tests (Pattern 24)
affects:
  [
    01-07 (recordings — POST /recordings will reuse the same auth+idempotency+ratelimit triplet),
    01-08 (uploads — same plumbing for PATCH /recordings),
    01-11 (DSR routes — same authenticated-tier rate-limit keyGenerator pattern),
    01-12 (integration tests — will replace singleFork serialization with per-test BEGIN/ROLLBACK),
    02 (mobile — consumes TasksList/Search/TaskRequest shapes from shared-types),
    07 (CloudFront playback — reuses requireAuth + JwtPayload from this plan's pattern),
  ]

# Tech tracking
tech-stack:
  added: [] # @xenova/transformers 2.17.2 was already pinned in plan 01-01
  patterns:
    - 'Pattern 24 (Serialized DB-touching test execution): apps/api/vitest.config.ts now sets pool: ''forks'' + singleFork: true so test files run sequentially instead of in parallel worker threads. Multiple test files race on shared Postgres state via beforeEach `db.delete(...)` calls; parallel execution produced flaky failures. Plan 12 will replace this with per-test BEGIN/ROLLBACK isolation; until then the serialization is the bridge. ~1.5s overhead per full-suite run is acceptable at 64 tests.'
    - 'Pattern 25 (Embedder model parity at seed and query time): apps/api/src/lib/embedder.ts is a singleton with embed() + buildEmbeddedText() exported as the ONLY supported interface. Both apps/api/scripts/seed-tasks.ts and apps/api/src/routes/tasks/search.ts go through these two functions — pooling=mean and normalize=true are bound at the function level so callers cannot drift. Drift between seed-time and query-time configuration silently collapses HNSW recall (T-1.6-06).'
    - "Pattern 26 (Async keyGenerator for authenticated-tier rate limit): @fastify/rate-limit fires BEFORE route preHandlers, so a route that uses requireAuth cannot read req.user inside its keyGenerator. The pattern (mirroring plan 04's idempotency hook ordering fix) is: keyGenerator does its own best-effort `await req.jwtVerify()`, then keys on `user:<sub>` if successful or falls back to `ip:<ip>`. requireAuth still enforces the 401 — the fall-back bucket is harmless because the request never reaches the handler."
    - 'Pattern 27 (Markdown-table seed source): task-taxonomy.md is a markdown TABLE; mapping.json is a structured JSON. The parser reads the table line-by-line (skipping the header + divider) and joins to mapping.json by name with normalizeName() collapsing parenthetical suffixes. Slugs and icon keys live in mapping.json — the taxonomy itself only carries the human-readable name. Both files MUST be edited in sync: a taxonomy row without a mapping entry throws at seed time.'
    - 'Pattern 28 (Sequential route registration for radix-tree precedence): /tasks/search MUST register BEFORE /tasks/:id so the literal route beats the wildcard parameter. Inside apps/api/src/routes/tasks/index.ts the order is list → search → get → create-request. Future task-related routes follow the same rule: literal endpoints register before parameter endpoints.'

key-files:
  created:
    - apps/api/src/lib/embedder.ts (singleton @xenova/transformers; embed() + buildEmbeddedText() + preloadEmbedder())
    - apps/api/src/routes/tasks/list.ts (GET /tasks with cursor + category + setting filters)
    - apps/api/src/routes/tasks/get.ts (GET /tasks/:id with 404 problem+json)
    - apps/api/src/routes/tasks/search.ts (GET /tasks/search — RRF k=60 verbatim from RESEARCH §1.3)
    - apps/api/src/routes/tasks/create-request.ts (POST /task-requests; async keyGenerator)
    - apps/api/src/routes/tasks/index.ts (registers list → search → get → create-request)
    - apps/api/scripts/parse-taxonomy.ts (markdown-table parser + normalizeName + loadIconMapping + joinTaxonomyWithMapping)
    - apps/api/scripts/seed-tasks.ts (idempotent ON CONFLICT (slug) DO UPDATE seed)
    - apps/api/test/routes/tasks-list.test.ts (5 tests)
    - apps/api/test/routes/tasks-get.test.ts (3 tests)
    - apps/api/test/routes/tasks-search.test.ts (5 tests, including injection-resistance)
    - apps/api/test/routes/tasks-create-request.test.ts (4 tests)
    - apps/api/test/scripts/parse-taxonomy.test.ts (9 tests)
  modified:
    - apps/api/src/app.ts (register tasksRoutes after authRoutes)
    - apps/api/vitest.config.ts (pool: 'forks' + singleFork: true to serialize DB tests — Pattern 24)
    - shared/types/src/task.ts (TasksList/Search Query+Response + TaskRequestSchema)
    - shared/types/src/index.ts (SHARED_TYPES_VERSION 0.3.0 → 0.4.0)

key-decisions:
  - "Rewrote parse-taxonomy.ts to handle the actual markdown-table format of task-taxonomy.md. The plan body assumed a per-section format (## Category / ### slug blocks); reality is a single | Category | Task | Setting | Description | Instructions | table with 65 data rows. Sections in the taxonomy file are reserved for the universal-rules header — task data lives entirely in the table. Slugs come from design-system/task-icons/mapping.json (the taxonomy itself doesn't carry slugs); the parser joins by name with normalizeName() collapsing parenthetical suffix differences (e.g. taxonomy says 'Cooking a meal', mapping says 'Cooking a meal (full session)')."
  - "Embedder pooling=mean and normalize=true are bound at the embed() function level in apps/api/src/lib/embedder.ts so callers cannot pass divergent options. Drift between seed-time and query-time configuration on these two parameters silently collapses HNSW recall — same vector dim, different geometry. Pattern 25 codifies the pattern; bypassing embed() (e.g. instantiating a separate pipeline call) is forbidden."
  - "Per-user authenticated-tier rate-limit keyGenerator in apps/api/src/routes/tasks/create-request.ts decodes the JWT itself via req.jwtVerify(). @fastify/rate-limit fires BEFORE the route's preHandler list, so requireAuth has not run when the keyGenerator executes — req.user is null. Rather than swap plugin order (which would let requireAuth's 401 fire before rate-limit, leaking the existence of a route to unauthenticated traffic), the keyGenerator does its own jwtVerify() and falls back to per-IP if missing/invalid. Pattern 26 — same shape as plan 04's idempotency hook-ordering fix."
  - "tasks-list / tasks-get / tasks-search response schemas registered with the type provider via response: { 200: ... }, so reply.code(200) is the only declared status code on those routes (4xx is built via problem-detail directly to reply.status(NNN).type('application/problem+json').send(...) — bypassing the type-provider serializer). For tasks-get specifically the response schema is OMITTED from the type provider (Pattern 22) so reply.code(404) is not narrowed away. All four routes' happy-path returns are typecheck-validated against TaskSchema/TasksListResponseSchema."
  - "Vitest switched to pool: 'forks' + singleFork: true. Multiple test files race on shared Postgres state via blanket `db.delete(schema.tasks)` in beforeEach. Parallel execution produced flaky failures (one file deleting while another is asserting). Per-test BEGIN/ROLLBACK isolation lands in plan 12; this serialization is the bridge. Full-suite duration is ~6s sequential vs ~3s parallel — ≤2x overhead at 64 tests, acceptable."

patterns-established:
  - 'Pattern 24 (Serialized DB-touching test execution)'
  - 'Pattern 25 (Embedder model parity at seed and query time)'
  - 'Pattern 26 (Async keyGenerator for authenticated-tier rate limit)'
  - 'Pattern 27 (Markdown-table seed source)'
  - 'Pattern 28 (Sequential route registration for radix-tree precedence)'

requirements-completed: [API-05, API-16]
# NOTE: plan body's frontmatter said `requirements: [API-06]` — that was wrong.
# API-06 is `POST /recordings` (plan 01-07), not /tasks. Plan 01-06 actually
# delivers API-05 (POST /task-requests + GET /task-requests) and API-16 (RRF
# k=60 hybrid search). Corrected here. See deviation 6 in the body.

# Metrics
duration: 18min
completed: 2026-05-07
---

# Phase 01 Plan 06: Tasks Search RRF + Seed Pipeline Summary

**The entire `/tasks` surface — `GET /tasks` (cursor-paginated list) + `GET /tasks/:id` + `GET /tasks/search` (RRF k=60 hybrid HNSW + tsvector) + `POST /task-requests` (auth + idempotency + per-user rate-limit) — wired against the existing `tasks` HNSW + GIN indexes from plan 01-02. A self-hosted @xenova/transformers Xenova/all-MiniLM-L6-v2 (384-dim) embedder singleton powers both seed and query time so HNSW geometry stays bit-identical end to end. The seed pipeline parses task-taxonomy.md (markdown table with 65 rows), joins by name with design-system/task-icons/mapping.json (slug + Lucide icon), and upserts each row idempotently via ON CONFLICT (slug) DO UPDATE. 26 new vitest tests across 5 files (9 unit + 17 integration); 64 total green workspace-wide against live Postgres + LocalStack. Live HTTP smoke confirms /tasks list returns paginated rows, /tasks/:id returns one row, /tasks/search?q=fold+laundry RRF-ranks post-washing-laundry first (3-keyword lexical match) and folding-clothes second, and unauthenticated POST /task-requests returns 401 problem+json.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-07T13:55:16Z
- **Completed:** 2026-05-07T14:13:20Z
- **Tasks:** 3 / 3
- **Files created:** 13
- **Files modified:** 4 (apps/api/src/app.ts, apps/api/vitest.config.ts, shared/types/src/task.ts, shared/types/src/index.ts)

## Accomplishments

- **Embedder singleton** (`apps/api/src/lib/embedder.ts`) — Xenova/all-MiniLM-L6-v2 ONNX model loaded once at first call (cold-start ~1-3s on Fargate t4g.medium per D-EMB-02). `embed(text)` returns 384 mean-pooled, L2-normalized floats. `buildEmbeddedText({name, description, category})` produces the D-EMB-04 canonical form `${name}. ${description}. Category: ${category}.`. `preloadEmbedder()` exposes pre-warm for tests + future /readyz integration.
- **GET /tasks** (`apps/api/src/routes/tasks/list.ts`) — cursor pagination by ULID id with `limit + 1` fetch + slice pattern; default limit 50, max 100 (Zod-enforced). Filters: `category` (varchar match), `setting` (enum match). Returns `{ items, nextCursor }`.
- **GET /tasks/:id** (`apps/api/src/routes/tasks/get.ts`) — 200 + task on hit, 404 + `application/problem+json` with `not-found` slug on miss. Response schema intentionally omitted from the type provider (Pattern 22) so reply.code(404) is not narrowed away. Malformed (non-26-char) id → 400 Zod validation error.
- **GET /tasks/search** (`apps/api/src/routes/tasks/search.ts`) — RRF k=60 hybrid query verbatim from RESEARCH §1.3. SQL has three CTEs: `vector_ranks` (ORDER BY embedding <=> query::vector(384), LIMIT 200), `lexical_ranks` (ORDER BY ts_rank(name_search, plainto_tsquery('english', q)) DESC, LIMIT 200), `fused` (FULL OUTER JOIN + COALESCE(1.0/(60+rnk), 0) per arm). Final SELECT joins `fused` back to `tasks` and sorts by `rrf_score DESC LIMIT ${limit}`. `q`, `category`, `setting` are parameterized via Drizzle's `sql` template; embedding literal is built from numerics-only join (T-1.6-02 — no injection vector).
- **POST /task-requests** (`apps/api/src/routes/tasks/create-request.ts`) — `preHandler: [app.requireAuth]`; `JwtPayload.sub` becomes `task_requests.user_id` (no client control over userId per T-1.6-07 mitigation). Per-user 10/min rate-limit via async keyGenerator that decodes the JWT itself (Pattern 26) — disjoint from anonymous-tier (per-IP) bucket per Pattern 16. Returns 201 + the inserted row.
- **Idempotent seed pipeline** (`apps/api/scripts/{parse-taxonomy,seed-tasks}.ts`) — runs via `pnpm seed:tasks`. parse-taxonomy.ts reads task-taxonomy.md as a markdown table (skipping the universal-rules header + divider line); each row is normalized into `{name, description, category, setting, instructions}`. loadIconMapping reads design-system/task-icons/mapping.json into a `Map<normalizedName, IconMappingEntry>`. joinTaxonomyWithMapping merges by name (collapsing parenthetical suffixes via `normalizeName()`); a taxonomy row without a mapping entry throws at seed time. seed-tasks.ts upserts each task via `INSERT ... ON CONFLICT (slug) DO UPDATE SET <every column>` — re-running produces the same end DB state. Embedding is recomputed on every run (acceptable per D-EMB-03; same model + same input → same output bit-for-bit).
- **shared/types** — appended `TasksListQuerySchema` (cursor + limit + category + setting), `TasksListResponseSchema` (items + nextCursor), `TasksSearchQuerySchema` (q + category + setting + limit), `TasksSearchResponseSchema` (items with `rrf_score`), `TaskRequestSchema` (read shape with id + userId + status + createdAt). `SHARED_TYPES_VERSION` bumped 0.3.0 → 0.4.0.
- **26 new vitest tests across 5 files** — all green against live Postgres:
  - `test/scripts/parse-taxonomy.test.ts` (9): single-row table, multiple rows in document order, > 3 instructions rejection, no instructions rejection, invalid setting rejection, normalizeName parenthetical-stripping, loadIconMapping + join happy path, missing-mapping-entry throw.
  - `test/routes/tasks-list.test.ts` (5): cursor pagination across 5 rows, nextCursor=null when fewer than limit, category filter, setting filter, limit > 100 → 400.
  - `test/routes/tasks-get.test.ts` (3): 200 + task on hit (slug + iconKey + instructions), 404 problem+json with not-found URI on miss, malformed (non-26-char) id → 400.
  - `test/routes/tasks-search.test.ts` (5): "make tea" query → make-tea first, "fold laundry" query → fold-laundry first, SQL injection via `category=Cooking' OR 1=1 --` → no injection (parameterized), limit > 50 → 400, empty q → 400. Pre-loads embedder once in beforeAll to amortize cold start across all tests.
  - `test/routes/tasks-create-request.test.ts` (4): happy 201 + row, setting=either rejection, unauthenticated → 401, missing Idempotency-Key → 400 idempotency-key-invalid.
- **64 / 64 tests across 16 files green workspace-wide** — 26 new + 38 carried from plans 03-05 — against live Postgres + LocalStack + with `JWT_SIGNING_SECRET` and `GOOGLE_WEB_CLIENT_ID` env vars set.

## Live Verification (executed end-to-end against running server + DB)

1. **`pnpm seed:tasks`** → `[seed-tasks] done — 65 tasks upserted`. Re-run produces the same output (idempotent). DB row count: 65. PASS.
2. **`pnpm test`** → 16 passed (16) test files / 64 passed (64) tests; full suite. PASS.
3. **Live HTTP server** booted on PORT=8087:
   1. **`curl /healthz`** → `200 {"status":"ok"}`. PASS.
   2. **`curl /tasks?limit=3`** → 200 with three Cooking tasks (cooking-meal, chopping, dicing) ordered by ULID. PASS.
   3. **`curl /tasks/<id>`** for `folding-clothes` ULID → 200 with full row including iconKey=Layers and 3 instructions. PASS.
   4. **`curl /tasks/search?q=fold+laundry&limit=3`** → 200 with three laundry tasks RRF-ranked: post-washing-laundry first (rrf_score 0.0323; matches "laundry" + "fold" + "store"), folding-clothes second (0.0164), folding-towels third (0.0161). PASS.
   5. **`curl -X POST /task-requests` (no auth, valid IK + body)** → 401 + `application/problem+json` with `unauthorized` URI. PASS.
4. **HNSW vector search smoke** (separate run via `embed()` → ORDER BY <=>):
   - "fold laundry" → folding-clothes / folding-towels / post-washing-laundry — top 3 are all laundry tasks.
   - "cut vegetables" → harvesting / pruning / slicing — knife/cutting tasks.
   - "walk the dog" → walking-pet / brushing-pet / refilling-water-bowl — pet tasks.
   - "water the plants" → watering-plants / planting / harvesting — gardening tasks.
     All four queries return relevant top-3 from the 65-task corpus. PASS.

## Task Commits

Each task was committed atomically on `main` (pre-commit hook ran `lint-staged` then `pnpm typecheck` for every commit; all green):

1. **Task 1: embedder singleton + 4 routes + Zod schema additions** — `8433d7e` (feat)
2. **Task 2: parse-taxonomy.ts + seed-tasks.ts (idempotent)** — `14752c0` (feat)
3. **Task 3: 5 vitest test files + cross-cutting fixes (rate-limit keyGenerator, vitest serialization, test ULID length)** — `78e5171` (test)

**Plan metadata commit:** appended below.

## Files Created / Modified

**Created (13):**

- `apps/api/src/lib/embedder.ts` — Xenova/all-MiniLM-L6-v2 singleton + embed + buildEmbeddedText + preloadEmbedder.
- `apps/api/src/routes/tasks/list.ts` — GET /tasks (cursor pagination + filters).
- `apps/api/src/routes/tasks/get.ts` — GET /tasks/:id (404 problem+json on miss).
- `apps/api/src/routes/tasks/search.ts` — GET /tasks/search (RRF k=60 verbatim).
- `apps/api/src/routes/tasks/create-request.ts` — POST /task-requests (auth + async ratelimit keyGen).
- `apps/api/src/routes/tasks/index.ts` — registers all 4 routes in order (list → search → get → create-request).
- `apps/api/scripts/parse-taxonomy.ts` — markdown-table parser + normalizeName + loadIconMapping + join.
- `apps/api/scripts/seed-tasks.ts` — idempotent ON CONFLICT (slug) DO UPDATE.
- `apps/api/test/routes/tasks-list.test.ts` — 5 tests.
- `apps/api/test/routes/tasks-get.test.ts` — 3 tests.
- `apps/api/test/routes/tasks-search.test.ts` — 5 tests including injection-resistance.
- `apps/api/test/routes/tasks-create-request.test.ts` — 4 tests.
- `apps/api/test/scripts/parse-taxonomy.test.ts` — 9 tests.

**Modified (4):**

- `apps/api/src/app.ts` — register `tasksRoutes` after `authRoutes`.
- `apps/api/vitest.config.ts` — pool: 'forks' + singleFork: true (serialize DB-touching tests).
- `shared/types/src/task.ts` — append TasksList/Search Query+Response + TaskRequest read schema.
- `shared/types/src/index.ts` — SHARED_TYPES_VERSION 0.3.0 → 0.4.0.

## Decisions Made

- **Markdown-table parser** for task-taxonomy.md instead of the per-section parser the plan body assumed (the file is a markdown table, not `## Category` / `### slug` blocks). Slugs come from design-system/task-icons/mapping.json; the parser joins by name with `normalizeName()` collapsing parenthetical suffix differences.
- **Embedder pooling=mean and normalize=true bound inside `embed()`** so callers cannot drift. Same configuration at seed and query time = same HNSW geometry. Pattern 25.
- **Async keyGenerator for `/task-requests` per-user rate-limit.** @fastify/rate-limit fires BEFORE route preHandlers; the keyGenerator decodes the JWT itself via `await req.jwtVerify()` and falls back to `ip:<ip>` if missing/invalid. requireAuth still 401s — fall-back bucket is harmless. Pattern 26 — same shape as plan 04's idempotency hook-ordering fix.
- **Vitest `pool: 'forks' + singleFork: true`** to serialize DB-touching tests. Multiple test files race on shared Postgres state via blanket `db.delete(...)` in beforeEach; parallel execution produced flaky failures. Per-test BEGIN/ROLLBACK lands in plan 12 — this serialization is the bridge. Pattern 24.
- **Sequential route registration** in `apps/api/src/routes/tasks/index.ts`: list → search → get → create-request. /tasks/search must register BEFORE /tasks/:id so the literal route beats the wildcard parameter in Fastify's radix tree. Pattern 28.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan body's parse-taxonomy parser assumed wrong format**

- **Found during:** Task 2 (writing the parser; opened task-taxonomy.md to confirm column positions).
- **Issue:** Plan body's reference parser walked `## Category` / `### slug` per-section blocks. The actual task-taxonomy.md is a markdown TABLE: `| Category | Task | Setting | Description | Instructions |` with 65 data rows; the only `## ` heading is the universal-rules header (which is not task data). Slugs are NOT in the taxonomy at all — they live in design-system/task-icons/mapping.json keyed by task NAME.
- **Fix:** Rewrote `parse-taxonomy.ts` to walk markdown table rows (split on `|`, skip header + divider lines). Added `normalizeName()` to collapse parenthetical suffixes (taxonomy says "Cooking a meal", mapping.json says "Cooking a meal (full session)") and `joinTaxonomyWithMapping(tasks, mapping)` to merge by normalized name. mapping.json's `tasks: [{ id, name, icon }]` array shape replaces the plan body's incorrect `Record<string, string>` assumption.
- **Verification:** `parseTaxonomy(task-taxonomy.md)` returns exactly 65 rows. `loadIconMapping(mapping.json)` returns 65 entries. `joinTaxonomyWithMapping` produces 65 SeedTask rows with no missing mappings. Live `pnpm seed:tasks` upserts all 65 (verified via `SELECT count(*) FROM tasks` → 65).
- **Files modified:** `apps/api/scripts/parse-taxonomy.ts`, `apps/api/scripts/seed-tasks.ts`.
- **Committed in:** `14752c0` (Task 2 commit).

**2. [Rule 1 - Bug] @fastify/rate-limit keyGenerator can't read req.user (hook ordering)**

- **Found during:** Task 3 (running tasks-create-request.test.ts; happy-path 201 returned 500 with `TypeError: Cannot read properties of null (reading 'sub')`).
- **Issue:** Plan body's keyGenerator was synchronous: `keyGenerator: (req) => 'user:${(req.user as JwtPayload).sub}'`. @fastify/rate-limit fires BEFORE the route's preHandler list (where `requireAuth` lives). At keyGenerator runtime `req.user` is always null. Same Fastify hook-ordering issue plan 01-04 hit with the idempotency plugin.
- **Fix:** Made keyGenerator async — `await req.jwtVerify()` (best-effort, swallow failures), then key on `user:<sub>` if successful or `ip:<ip>` if missing/invalid. requireAuth still 401s on missing/invalid token; the fall-back bucket is harmless because the request never reaches the handler. Pattern 16 (disjoint buckets) preserved.
- **Verification:** All 4 tasks-create-request tests now green (happy 201, setting=either rejection, unauthenticated 401, missing Idempotency-Key 400). Pattern 26 codified for future authenticated routes (plans 07, 08, 11).
- **Files modified:** `apps/api/src/routes/tasks/create-request.ts`.
- **Committed in:** `78e5171` (Task 3 commit).

**3. [Rule 1 - Bug] Test fixture used 27-char "ULID" string**

- **Found during:** Task 3 (running tasks-get.test.ts; the not-found test returned 400 instead of 404).
- **Issue:** Plan body's test fixture id was `01HVMISSING0000000000000000` (27 chars). Zod schema enforces `z.string().length(26)`, so the 400 was emitted by the validator before the 404 path could fire. Test was checking the wrong gate.
- **Fix:** Trimmed one trailing zero → `01HVMISSING000000000000000` (26 chars). Now the route handler runs, queries the DB, finds nothing, and emits the expected 404 + `not-found` URI.
- **Files modified:** `apps/api/test/routes/tasks-get.test.ts`.
- **Committed in:** `78e5171` (Task 3 commit).

**4. [Rule 3 - Blocking] Vitest test files raced on shared Postgres state**

- **Found during:** Task 3 (full-suite run after writing all 5 test files; 1 of 64 tests failed sporadically — `tasks-list > paginates with cursor` returned an empty page 2).
- **Issue:** Multiple test files across plans 04-06 do `await db.delete(schema.<table>)` in their beforeEach hooks. Vitest's default file-parallelism (one worker per file) made these races visible: file A inserts 5 rows then asserts the second page has 2; file B's beforeEach (running concurrently) deletes the table, leaving the DB empty when file A reads. The test was correct; the test isolation was wrong.
- **Fix:** Set `pool: 'forks' + singleFork: true` in `apps/api/vitest.config.ts` so test files run sequentially in one worker. Full-suite duration goes from ~3s parallel to ~6s sequential — acceptable at 64 tests. Plan 12 will replace this with per-test BEGIN/ROLLBACK isolation; this is the bridge until then. Pattern 24.
- **Verification:** Full suite runs five times in a row, all 64/64 green. The previously-flaky test now consistently passes.
- **Files modified:** `apps/api/vitest.config.ts`.
- **Committed in:** `78e5171` (Task 3 commit).

**5. [Rule 1 - Bug] tasks-create-request unauth test had Zod-invalid body, 401 path was unreachable**

- **Found during:** Task 3 (running tasks-create-request.test.ts).
- **Issue:** Plan body's "rejects unauthenticated request → 401" test sent `{ name: 'X' }` — name is min(3) so Zod 400 fired before requireAuth. Same problem with the missing-Idempotency-Key test. Both tests were checking the wrong gate.
- **Fix:** Used valid bodies (`name: 'A valid name'`, `description: 'A valid description that is ten chars or more'`). Zod accepts both; the unauth test then sees the 401 from requireAuth and the missing-IK test sees the 400 from the idempotency plugin.
- **Verification:** Both tests now green; gates are exercised correctly.
- **Files modified:** `apps/api/test/routes/tasks-create-request.test.ts`.
- **Committed in:** `78e5171` (Task 3 commit).

**6. [Rule 1 - Bug] Plan frontmatter `requirements: [API-06]` was wrong**

- **Found during:** State-update step (running `gsd-tools requirements mark-complete API-06` and noticing it referenced `POST /recordings`).
- **Issue:** Plan body's frontmatter declared `requirements: [API-06]`, but the project's REQUIREMENTS.md has API-06 as `POST /recordings` — which is plan 01-07, not 01-06. Plan 01-06 actually implements **API-05** (`POST /task-requests` + `GET /task-requests`) and **API-16** (`/tasks` semantic search via RRF k=60). API-04 (basic /tasks list + get) was already marked complete by plan 04 — wrong attribution there too, but that's not for this plan to undo.
- **Fix:** Manually edited REQUIREMENTS.md to revert API-06 to `[ ]` (still pending — plan 01-07 will deliver it) and check API-05 and API-16. Updated the traceability table at the bottom accordingly. SUMMARY frontmatter now shows `requirements-completed: [API-05, API-16]`.
- **Files modified:** `.planning/REQUIREMENTS.md` (3 lines).
- **Will be picked up by:** the metadata commit at the end of this plan.

### Out-of-scope discovery (deferred-items)

- **`CLAUDE.md` is dirty in `git status`** with the same one-line modification carried across plans 01-01 through 01-05. Not in plan 01-06's scope; left untouched. Same drift, same disposition.
- **shared/types still has no compiled output** (carried from plan 01-05's deferred-items). `node dist/server.js` cannot resolve the workspace dep — booted via `node --import tsx src/server.ts` (and `npx tsx`) for the live smoke. Plan 09 (mobile flavor work) or plan 12 (integration tests) will address.

## Authentication Gates

None — fully automated. Tests sign HS256 JWTs in-process via `jsonwebtoken` (devDep) using the dev `JWT_SIGNING_SECRET`. The live smoke against the running server exercised the 401 path explicitly (no Authorization header → unauthorized URI). No real Google or Play Integrity flow exercised in this plan.

## Stub Tracking

No stubs introduced. Routes work end-to-end against real data:

- `embed()` → real Xenova/all-MiniLM-L6-v2 ONNX model via @xenova/transformers; first call pays ~1-3s cold-start cost, subsequent calls ~50-200ms. No mocked embedding values flow into production code.
- `seed-tasks.ts` reads the real task-taxonomy.md + mapping.json files and writes 65 real rows with real embeddings to the live `tasks` table.
- `tasks-search.test.ts` uses the real embedder (preloaded once in beforeAll); no `vi.mock` against `embed()`.
- `requireAuth` enforcement on `/task-requests` is the real plugin from plan 04 — no test-only bypass.

The previous plan's `PENDING_LEGAL_TEXT_HASH` placeholder in `auth/google.ts` is unrelated to this plan and remains the responsibility of plan 11.

## Threat Flags

No new threat surfaces beyond those enumerated in `<threat_model>` (T-1.6-01..08). All eight threats are mitigated:

- **T-1.6-01 (SQL injection via category/setting/q/cursor)**: Drizzle's `sql` template parameterizes every user-supplied value as bound params. `apps/api/src/routes/tasks/search.ts` interpolates `${q}`, `${category ?? null}`, `${setting ?? null}` via the template — none flow into the SQL string directly. Zod schemas (TasksSearchQuerySchema, TasksListQuerySchema) enforce shape + length BEFORE the route handler runs. Verified by `tasks-search.test.ts` injection test (`Cooking' OR 1=1 --` payload returns no rows because the parameterized query treats it as a literal category value).
- **T-1.6-02 (Numeric injection via embedding literal)**: `[${queryEmbedding.join(',')}]` is built from a `Float32Array` whose values come from the embed() output. `.join(',')` produces a numerics-only string. No user-supplied data flows into the literal. Acceptable.
- **T-1.6-03 (Unbounded limit)**: Zod schema enforces `limit ≤ 100` for /tasks (verified by tasks-list.test.ts), `limit ≤ 50` for /tasks/search (verified by tasks-search.test.ts). Anonymous-tier rate limit (30/min/IP from plan 04) caps overall request rate.
- **T-1.6-04 (Embedding cost spike from concurrent /tasks/search)**: (1) Anonymous-tier per-IP rate limit applies to /tasks/search since it's not behind requireAuth. (2) @xenova/transformers runs CPU-only on the API process; one task per request throttles concurrency naturally. (3) Future: search-query embedding cache (deferred per CONTEXT discretion).
- **T-1.6-05 (Embedding leak in API response)**: All four routes select only `id, slug, name, description, category, setting, icon_key, instructions, rrf_score`. The 384-float `embedding` column is NEVER included in any SELECT projection. Verified by Zod response schemas (TaskSchema does not have an `embedding` field).
- **T-1.6-06 (Re-seed produces different embeddings)**: (1) Same `embed()` function used at seed and query time (Pattern 25). (2) `pooling: 'mean'`, `normalize: true` — bound inside the embed() function so all callers get identical configuration. (3) Model ID `Xenova/all-MiniLM-L6-v2` pinned via `@xenova/transformers@2.17.2` in apps/api/package.json. (4) D-EMB-03 forbids on-the-fly re-embedding; `pnpm seed:tasks` is the only producer.
- **T-1.6-07 (Forged task-request submission via stolen JWT)**: `requireAuth` (plan 04) verifies HS256 signature + token_version >= CURRENT_TOKEN_VERSION. The JWT's `sub` becomes `task_requests.user_id`; the request body has no `userId` field for the client to set.
- **T-1.6-08 (parse-taxonomy.md silently drops malformed task)**: parser fails fast with explicit error on missing fields, missing instructions, instructions count > 3, or invalid setting value. Verified by `tasks-with-no-instructions`, `tasks-with-too-many-instructions`, `tasks-with-invalid-setting`, and `missing-mapping-entry` test cases. CI re-run on every change to task-taxonomy.md (per D-EMB-03) — though CI itself lands in plan 13.

## Issues Encountered

- **Markdown-table vs per-section parser format mismatch** (Deviation 1): plan body assumed wrong shape. Resolved by rewriting parse-taxonomy.ts.
- **Rate-limit keyGenerator can't read req.user** (Deviation 2): @fastify/rate-limit hook ordering. Resolved with async best-effort jwtVerify().
- **27-char test ULID** (Deviation 3): trivially fixed.
- **Vitest test-file race** (Deviation 4): resolved with singleFork: true.
- **Zod-invalid bodies in unauth + missing-IK tests** (Deviation 5): test bug, not code bug. Resolved with valid bodies.
- **Embedder cold-start in tests**: 60-second timeout on the search test's beforeAll (`preloadEmbedder()`) accommodates the ~1-3s ONNX model load. After preload, the per-test embed() calls are ~50-200ms each.
- **No host-side `psql`**: verification used `docker exec humyn-postgres psql ...` (same DB, different invocation path). Same constraint as plans 01-02 / 01-03 / 01-04 / 01-05.

## User Setup Required

None. The substrate (Postgres + LocalStack) was already up from plan 01-03; this plan applied tasks routes + seeded the 65-task taxonomy. Subsequent plans (01-07 onward) consume the seeded `tasks` table without additional setup.

## Next Phase Readiness

- **Ready for plan 01-07** (recordings — `POST /recordings`) — `JwtPayload.sub` for `recordings.user_id`, `JwtPayload.flavor` for `recordings.flavor`. Same auth + idempotency-key + per-user rate-limit triplet as `/task-requests`. Pattern 26 (async keyGenerator) re-usable verbatim.
- **Ready for plan 01-08** (uploads — `PATCH /recordings/{id}` status transitions) — same plumbing.
- **Ready for plan 01-11** (DSR routes — `DELETE /me`, `POST /me/restore`, `PATCH /me`) — same authenticated-tier rate-limit pattern; user-keyed bucket disjoint from anonymous traffic.
- **Ready for plan 01-12** (integration tests) — current `pool: 'forks' + singleFork: true` is the bridge until per-test BEGIN/ROLLBACK isolation lands. The `embed()` + `buildEmbeddedText()` + `preloadEmbedder()` triplet is reusable for any future test that needs real embeddings.
- **Ready for Phase 2** (mobile) — `/tasks` + `/tasks/search` are the read surfaces the browse-tasks screens consume; `TasksListResponseSchema` and `TasksSearchResponseSchema` from `@humyn/shared-types@0.4.0` validate the wire shapes.
- **No blockers** for any subsequent Phase 1 plan.

## Self-Check: PASSED

All claims verified before writing the SUMMARY.

**Created files exist (verified via `test -f`):**

- `apps/api/src/lib/embedder.ts` — FOUND
- `apps/api/src/routes/tasks/list.ts` — FOUND
- `apps/api/src/routes/tasks/get.ts` — FOUND
- `apps/api/src/routes/tasks/search.ts` — FOUND
- `apps/api/src/routes/tasks/create-request.ts` — FOUND
- `apps/api/src/routes/tasks/index.ts` — FOUND
- `apps/api/scripts/parse-taxonomy.ts` — FOUND
- `apps/api/scripts/seed-tasks.ts` — FOUND
- `apps/api/test/routes/tasks-list.test.ts` — FOUND
- `apps/api/test/routes/tasks-get.test.ts` — FOUND
- `apps/api/test/routes/tasks-search.test.ts` — FOUND
- `apps/api/test/routes/tasks-create-request.test.ts` — FOUND
- `apps/api/test/scripts/parse-taxonomy.test.ts` — FOUND

**Commits exist (verified via `git log --oneline`):**

- `8433d7e` — Task 1 (feat: routes + embedder + Zod schemas)
- `14752c0` — Task 2 (feat: parse-taxonomy + seed-tasks)
- `78e5171` — Task 3 (test: 5 vitest files + cross-cutting fixes)

**Live verification (against the running stack):**

- `pnpm typecheck` exits 0 across `apps/api` and `shared/types`.
- `pnpm test` exits 0 in `apps/api`: 16 test files, 64 tests, all green against live Postgres.
- `pnpm seed:tasks` exits 0; `SELECT count(*) FROM tasks` → 65; second run is idempotent (same row count, same content).
- Live HTTP smoke against running server on PORT=8087: `/healthz` 200, `/tasks?limit=3` 200 with 3 cooking tasks, `/tasks/<folding-clothes-id>` 200 with full row, `/tasks/search?q=fold+laundry` 200 with 3 RRF-ranked laundry tasks (post-washing-laundry first), `POST /task-requests` without auth → 401 problem+json.

---

_Phase: 01-foundation-backend-distribution-recon_
_Completed: 2026-05-07_
