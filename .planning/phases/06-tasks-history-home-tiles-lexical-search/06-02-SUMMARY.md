---
phase: 06-tasks-history-home-tiles-lexical-search
plan: 02
subsystem: api
tags: [postgres, pg_trgm, ts_vector, drizzle, fastify, search, zod, vitest]

# Dependency graph
requires:
  - phase: 01-foundation-backend-distribution-recon
    provides: 'tasks table + name_search tsvector + GIN index; pgvector + HNSW + embedder.ts (now dead-on-arrival, retained for §v2 SEARCH-V2-01)'
  - phase: 01-foundation-backend-distribution-recon
    provides: '/tasks/search route (was RRF k=60 hybrid; gutted to lexical-only here)'
provides:
  - 'pg_trgm extension live in dev Postgres (migration 0007 + journal entry)'
  - '/tasks/search route: lexical-only ts_rank + pg_trgm fuzzy fallback at explicit threshold 0.3'
  - 'shared/types TasksSearchResponseSchema.lex_score (was rrf_score)'
  - 'Vitest coverage: lexical hit, pg_trgm fallback, both-miss, lex_score presence, category filter, plus the Phase 1 safety nets'
affects:
  - 06-07 (mobile useTaskSearch hook will compile against lex_score)
  - 06-10 (TasksScreen renders /tasks/search results)
  - v2 SEARCH-V2-01 (revives pgvector + RRF hybrid client surface via git history)

# Tech tracking
tech-stack:
  added:
    - pg_trgm extension (Postgres built-in; CREATE EXTENSION IF NOT EXISTS)
  patterns:
    - 'pg_trgm threshold pinned explicitly in WHERE (similarity(...) > 0.3) — never rely on session-level pg_trgm.similarity_threshold (Pitfall 4)'
    - 'Two-stage search: ts_vector happy path, pg_trgm fuzzy fallback only when stage-1 returns zero rows'
    - 'Dead-on-arrival columns retained for §v2 revival (embedding vector(384), HNSW index, embedder.ts)'

key-files:
  created:
    - apps/api/src/db/migrations/0007_pg_trgm.sql
  modified:
    - apps/api/src/db/migrations/meta/_journal.json (idx 1 / tag 0007_pg_trgm)
    - apps/api/src/routes/tasks/search.ts (gut RRF → lexical+pg_trgm)
    - shared/types/src/task.ts (rrf_score → lex_score in TasksSearchResponseSchema)
    - apps/api/test/routes/tasks-search.test.ts (drop RRF assertions, add 5 lexical/fuzzy/empty/lex_score/category tests)

key-decisions:
  - "Used the project's custom apps/api/scripts/migrate.ts runner (`pnpm db:migrate`) rather than drizzle-kit push, matching the existing schema_migrations bookkeeping pattern (6 prior migrations all applied via this runner)."
  - 'Used the typo `sweping` (not `sweepng`) for the pg_trgm fallback test: similarity(`sweping`, `Sweeping the floor`) ≈ 0.35 > 0.3 threshold, while `sweepng` only reaches 0.286 (full task name dilutes the trigram match).'
  - 'Tasks 2 + 3 (schema rename + route gut) were committed together because pre-commit `pnpm typecheck` rejects either commit alone — they are co-dependent.'

patterns-established:
  - 'Pattern: explicit pg_trgm threshold in WHERE (`similarity(col, $q) > 0.3`) instead of relying on session-level pg_trgm.similarity_threshold default — survives connection pooling + concurrent sessions safely.'
  - 'Pattern: two-stage search with happy-path fast-out — second query runs only on the zero-row branch, so the common case pays only one round-trip.'

requirements-completed: [TASK-03, TASK-10]

# Metrics
duration: 25min
completed: 2026-05-14
---

# Phase 6 Plan 06-02: Lexical Task Search (RRF descope) Summary

**`/tasks/search` gutted from RRF k=60 hybrid to lexical-only `ts_rank` with `pg_trgm` fuzzy fallback at explicit threshold 0.3; pgvector + embedder code retained on-disk for §v2 SEARCH-V2-01 revival.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-14T03:58:00Z (approx)
- **Completed:** 2026-05-14T04:23:54Z
- **Tasks:** 5 (Tasks 2+3 combined into a single commit — see deviation below)
- **Files modified:** 4 (1 new, 3 edited)

## Accomplishments

- New migration `0007_pg_trgm.sql` installs `pg_trgm` extension idempotently; journal entry slots in at idx 1 with tag `0007_pg_trgm`.
- `/tasks/search` now runs a two-stage query: ts_vector with `ts_rank` DESC, and on a zero-row result it retries with `similarity(name, $q) > 0.3 OR similarity(description, $q) > 0.3` ordered by `GREATEST(similarity(name,$q), similarity(description,$q))`. The 0.3 threshold is pinned explicitly in the WHERE clause (never reliant on the session-level `pg_trgm.similarity_threshold`).
- `shared/types`: `TasksSearchResponseSchema.items[*].rrf_score` renamed `lex_score` with the D-01a marker comment. Header comment on the schema rewritten to reflect the lexical-only + pg_trgm fallback contract.
- Backend Vitest now covers: (1) lexical hit, (2) pg_trgm fallback on typo `sweping` (similarity 0.35 > 0.3), (3) empty `items` array on both-miss, (4) `lex_score` present + `rrf_score` absent on the response, (5) category narrowing. Plus the three retained safety nets from Phase 1 (SQL-injection-via-category, Zod limit>50, Zod empty-q). 8/8 tests pass.
- pg_trgm extension live in dev DB; `SELECT similarity('sweepng','sweeping') > 0.3` returns `t`.
- pgvector / HNSW / `embedder.ts` / `embedding vector(384)` column remain on disk untouched — §v2 SEARCH-V2-01 can revive via git history.

## Task Commits

1. **Task 1: Land pg_trgm migration 0007 + update Drizzle journal** — `e3dafd9` (feat)
2. **Tasks 2 + 3: Rename `rrf_score` → `lex_score` + gut `/tasks/search` to lexical-only + pg_trgm fallback** — `1e08664` (feat) — combined commit, see Deviation #2.
3. **Task 4: Apply pg_trgm migration to dev DB** — no commit (DB state change only, no file changes).
4. **Task 5: Rewrite Vitest coverage for the new contract** — `d32e75b` (test)

## Files Created/Modified

- `apps/api/src/db/migrations/0007_pg_trgm.sql` (new) — `CREATE EXTENSION IF NOT EXISTS pg_trgm`. Optional GIN trigram indexes commented out; 65-row catalog is sub-millisecond on a full scan.
- `apps/api/src/db/migrations/meta/_journal.json` (modified) — appended idx 1 / tag `0007_pg_trgm`.
- `apps/api/src/routes/tasks/search.ts` (modified) — gutted from RRF hybrid CTE to a two-stage `ts_vector` + `pg_trgm` query. Dropped `embed` import. `mapRows()` extracted to a standalone helper that returns `lex_score: number`. Route remains intentionally public (no `requireAuth` preHandler).
- `shared/types/src/task.ts` (modified) — `TasksSearchResponseSchema` items field renamed `rrf_score` → `lex_score` with the D-01a marker comment; the `// GET /tasks/search` header comment rewritten to reflect lexical-only contract.
- `apps/api/test/routes/tasks-search.test.ts` (modified) — dropped RRF assertions; added the five new tests + `hasExtension()` helper to gate the pg_trgm test safely.

## Decisions Made

- **Migration runner = `pnpm db:migrate` (custom `scripts/migrate.ts`), not `npx drizzle-kit push`.** The project tracks applied migrations in a `schema_migrations` table updated by the custom runner; all six prior migrations were applied via this path. `drizzle-kit push` would diff schema-introspection and prompt interactively — wrong tool for this codebase. The plan's directive to use `drizzle-kit push` reflects boilerplate research, not the project's actual practice.
- **pg_trgm fallback test typo = `sweping`.** The plan suggested `sweepng`, but empirically `similarity('sweepng', 'Sweeping the floor') ≈ 0.286` — below the 0.3 threshold (the full task name dilutes the trigram match). `similarity('sweping', 'Sweeping the floor') ≈ 0.35 > 0.3` reliably triggers the fallback. ts_vector still misses `sweping` (the english stemmer doesn't recover the transposition), so the test still exercises the fallback path as intended.
- **Tasks 2 + 3 combined into a single commit.** The pre-commit hook runs `pnpm typecheck` across all workspaces; the schema rename in `shared/types` and the route mapping rename in `apps/api/src/routes/tasks/search.ts` are co-dependent (typecheck breaks if either lands alone). Treating them as one logical commit ("rename and gut the search route") is the cleanest atomic unit. Documented as a Rule 3 deviation below.

## Deviations from Plan

### Rule 3 - Blocking

**1. [Rule 3 - Blocking] Used `pnpm db:migrate` (custom runner) instead of `npx drizzle-kit push`**

- **Found during:** Task 4 — DB migration apply
- **Issue:** The plan instructs `npx drizzle-kit push`, but this project uses a custom `apps/api/scripts/migrate.ts` (a file-based runner tracked by a `schema_migrations` table). All six prior migrations were applied via `pnpm db:migrate`; `drizzle-kit push` would not respect the existing bookkeeping.
- **Fix:** Ran `cd apps/api && DATABASE_URL=… pnpm db:migrate`. Output: `Applying 0007_pg_trgm.sql ... 0007_pg_trgm.sql applied. Migrations: 1 applied, 6 skipped (total 7).`
- **Files modified:** none (DB-state change only)
- **Verification:** `docker exec humyn-postgres psql -U humyn -d humyn_dev -tAc "SELECT extname FROM pg_extension WHERE extname='pg_trgm'"` returns `pg_trgm`. `SELECT similarity('sweepng','sweeping') > 0.3` returns `t`.
- **Committed in:** N/A (no file changes)

**2. [Rule 3 - Blocking] Combined Tasks 2 + 3 into a single commit (pre-commit typecheck couples them)**

- **Found during:** Task 2 commit attempt
- **Issue:** Renaming `rrf_score` → `lex_score` in `shared/types/src/task.ts` makes the `apps/api/src/routes/tasks/search.ts` mapper (which still returns `rrf_score`) typecheck-fail. The husky pre-commit hook runs `pnpm typecheck`, so a Task 2-only commit is blocked. The plan's task-atomicity rule and the typecheck gate are incompatible here.
- **Fix:** Combined Task 2 (schema rename) and Task 3 (route gut + mapper rename) into a single commit `1e08664`. The commit message explicitly calls out the merge.
- **Files modified:** `shared/types/src/task.ts`, `apps/api/src/routes/tasks/search.ts`
- **Verification:** `pnpm -r --parallel typecheck` exits 0 inside the pre-commit hook output (both workspaces).
- **Committed in:** `1e08664`

**3. [Rule 3 - Blocking] Skipped the `shared/types` build verification (no build script / no dist artifact)**

- **Found during:** Task 2 verification
- **Issue:** The plan's acceptance criteria call for `npm run build --workspace=shared/types` exits 0 and `grep -rc 'rrf_score' shared/types/dist/` to be 0. The actual package has no `build` script (`shared/types/package.json` scripts: `lint`, `typecheck`, `test`), and `shared/types/dist/` does not exist — the package is consumed via `"main": "src/index.ts"` directly (TypeScript-source workspace). There is no dist artifact to rebuild or grep.
- **Fix:** Verified the source-level rename instead — `grep -c 'rrf_score' shared/types/src/task.ts` returns 0, `grep -c 'lex_score: z.number()'` returns 1. Workspace typecheck (`pnpm -r --parallel typecheck`) passes, which is the dist-equivalent gate for source-only workspaces.
- **Files modified:** none beyond Task 2 itself
- **Verification:** pre-commit hook runs `tsc --noEmit` on `shared/types` workspace — passed inside the Tasks 2+3 commit output.
- **Committed in:** N/A (no extra commit)

**4. [Rule 3 - Blocking] Test file references `rrf_score` to assert its absence (acceptance grep is overly strict)**

- **Found during:** Task 5 acceptance check
- **Issue:** The plan's acceptance criterion `grep -c "rrf_score" apps/api/test/routes/tasks-search.test.ts == 0` directly conflicts with the prescribed Test 4 behaviour: "response items carry `lex_score`, never `rrf_score` — `body.items[0]` does NOT have a `rrf_score` field." To assert `not.toHaveProperty('rrf_score')`, the literal string `rrf_score` must appear in the test source.
- **Fix:** Kept the literal in the assertion (test title + `expect(items[0]).not.toHaveProperty('rrf_score')` + the explanatory comment); grep returns 3 instead of 0. The spirit of the criterion (no RRF logic in tests) is preserved — there are zero references to RRF math, embedder, vector_ranks, k=60.
- **Files modified:** `apps/api/test/routes/tasks-search.test.ts`
- **Verification:** All 8 tests pass; the negative assertion runs and confirms `rrf_score` is absent on the wire.
- **Committed in:** `d32e75b`

---

**Total deviations:** 4 (all Rule 3 — blocking adaptations required to keep the workflow moving).
**Impact on plan:** No scope creep; no behavior change beyond what the plan specifies. All four are interface adjustments between the plan's prescriptive acceptance criteria and the project's actual tooling / typecheck gates / test semantics.

## Issues Encountered

- **First test run: 1/8 failed (pg_trgm fallback).** The plan's suggested typo `sweepng` against full task name `Sweeping the floor` only reached similarity 0.286 — below the 0.3 threshold. Diagnosed with `docker exec humyn-postgres psql … "SELECT similarity('sweepng','Sweeping the floor')"`. Switched to `sweping` (similarity 0.35, ts_vector still misses), re-ran: 8/8 pass.
- **Worktree had no `node_modules` at start.** First commit attempt failed in the pre-commit hook (`tsc: command not found`). Ran `pnpm install --frozen-lockfile` in the worktree (3.8s, all packages reused from the pnpm store); re-staged + retried the commit successfully. The worktree-spawn process does NOT auto-install.
- **Worktree had no `apps/api/.env`.** `.env` is gitignored, so the file did not propagate from main. Copied `apps/api/.env` from the main repo (`/Users/adnaan/Documents/hl-homelander/apps/api/.env`) into the worktree before running Vitest. Tests do not load the env file themselves — the runtime note in my prompt is enforced via shell `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm --filter @humyn/api test ...`.

## Self-Check

| Claim                                                           | Verification                                                                                     | Result         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- | ----------------- | ------------ | ----- |
| `apps/api/src/db/migrations/0007_pg_trgm.sql` exists            | `[ -f apps/api/src/db/migrations/0007_pg_trgm.sql ]`                                             | FOUND          |
| migration journal updated                                       | `grep -c 0007_pg_trgm apps/api/src/db/migrations/meta/_journal.json` → 1                         | FOUND          |
| `shared/types/src/task.ts` carries `lex_score`, not `rrf_score` | `grep -c rrf_score shared/types/src/task.ts` → 0; `grep -c lex_score` → 1                        | FOUND          |
| `/tasks/search` route gutted (no RRF, no embed)                 | `grep -v "^[[:space:]]\*//" apps/api/src/routes/tasks/search.ts \| grep -c 'rrf_score\\          | vector_ranks\\ | FULL OUTER JOIN\\ | embed('` → 0 | FOUND |
| explicit threshold 0.3 in WHERE                                 | `grep -F 'similarity(t.name, ${q}) > 0.3' apps/api/src/routes/tasks/search.ts` → 1               | FOUND          |
| pg_trgm extension installed in dev DB                           | `psql … "SELECT extname FROM pg_extension WHERE extname='pg_trgm'"` → `pg_trgm`                  | FOUND          |
| Vitest 8/8 pass                                                 | `pnpm --filter @humyn/api test -- --run test/routes/tasks-search.test.ts` → `Tests 8 passed (8)` | FOUND          |
| Commit `e3dafd9` present                                        | `git log --all --oneline \| grep -q e3dafd9`                                                     | FOUND          |
| Commit `1e08664` present                                        | `git log --all --oneline \| grep -q 1e08664`                                                     | FOUND          |
| Commit `d32e75b` present                                        | `git log --all --oneline \| grep -q d32e75b`                                                     | FOUND          |

## Self-Check: PASSED

## User Setup Required

None — no external service configuration. The pg_trgm extension is bundled with the `pgvector/pgvector:pg17` container image (no `apt install`, no superuser shenanigans). When this branch merges to main, downstream developers must run `cd apps/api && pnpm db:migrate` against their local dev DB to apply 0007.

## Next Phase Readiness

- Plan 06-07 (mobile `useTaskSearch` hook) will compile against `lex_score`; the wire-format rename is complete.
- Plan 06-03 (Wave 2 — stream-url + range-filter route work) is unblocked. pg_trgm presence is verified, so any Wave-2 plan that runs Vitest against the live DB sees the extension.
- §v2 SEARCH-V2-01 can revive the RRF hybrid surface via git history — every file from the pgvector path (`apps/api/src/lib/embedder.ts`, `apps/api/src/db/migrations/0001_init.sql` HNSW index, `tasks.embedding` column) remains untouched.

---

_Phase: 06-tasks-history-home-tiles-lexical-search_
_Completed: 2026-05-14_
