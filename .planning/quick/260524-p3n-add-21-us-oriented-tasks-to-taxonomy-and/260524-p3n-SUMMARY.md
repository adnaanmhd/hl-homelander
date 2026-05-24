---
phase: 260524-p3n
plan: 01
subsystem: data
tags: [taxonomy, task-data, seed, lucide, dev-db]

# Dependency graph
requires:
  - phase: 01-foundation-backend-distribution-recon
    provides: parse-taxonomy.ts + seed-tasks.ts + tasks pgvector schema (the seed contract this depends on)
provides:
  - 21 new US-oriented task rows in task-taxonomy.md (across 10 categories)
  - 21 matching slug/icon entries in design-system/task-icons/mapping.json (lucide-react)
  - Dev tasks table populated with 86 taxonomy/mapping-defined rows (65 prior + 21 new)
affects:
  [phase-2 task-selection UX (search expands to 86 trainable surfaces), any US-locale rollout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Quick-task additive data pattern: append to taxonomy + mapping in lockstep, idempotent seed picks them up'

key-files:
  created:
    - .planning/quick/260524-p3n-add-21-us-oriented-tasks-to-taxonomy-and/260524-p3n-SUMMARY.md
  modified:
    - task-taxonomy.md
    - design-system/task-icons/mapping.json

key-decisions:
  - "Kept all 21 spec icons verbatim — no Lucide fallback swaps needed (every name verified against the v0.400+ export list in the plan's fallback table)"
  - 'Sourced apps/api/.env from the main repo (not the agent worktree) — worktrees inherit tracked files only, so DATABASE_URL has to come from /Users/adnaan/Documents/hl-homelander/apps/api/.env'

patterns-established:
  - "Insert-bottom-up: when appending multiple category blocks to an existing markdown table, walk anchors bottom-up so earlier-line anchors don't shift mid-edit"

requirements-completed: [QUICK-260524-P3N-01]

# Metrics
duration: ~25min
completed: 2026-05-24
---

# Quick 260524-p3n: Add 21 US-oriented tasks to taxonomy and mapping — Summary

**21 new tasks (snow shoveling, BBQ grilling, dishwasher load/unload, garbage disposal, dryer lint trap, fitted-sheet fold, smoke-detector battery, holiday string lights, etc.) appended to task-taxonomy.md + design-system/task-icons/mapping.json; dev `tasks` table seeded — total trainable surface goes 65 → 86.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-24T12:24:00Z (approx)
- **Completed:** 2026-05-24T12:49:00Z
- **Tasks:** 1 (atomic data append + seed)
- **Files modified:** 2 (taxonomy + mapping); 1 created (SUMMARY)

## Accomplishments

- 21 new task rows appended to `task-taxonomy.md` — one row per spec entry, inserted at the END of each row's category section. Bottom-up insertion preserved all existing row order.
- 21 new `tasks[]` entries appended to `design-system/task-icons/mapping.json` — name-matched character-for-character with the taxonomy rows, slug + Lucide icon per the spec.
- `parseTaxonomy()` parses 86 rows; `loadIconMapping()` returns 86 entries; `joinTaxonomyWithMapping()` produces 86 SeedTasks with zero missing-mapping errors.
- `pnpm --filter @humyn/api seed:tasks` ran cleanly: `parsed 86 taxonomy rows, joined with 86 mapping entries → 86 seed rows / done — 86 tasks upserted`.
- Dev `tasks` table verified post-seed: all 21 new slugs present.

## Task Commits

1. **Task 1: Append 21 rows to taxonomy + mapping, run seed** — `2fbb65e` (feat)

_Note: prettier (lint-staged pre-commit) reformatted the markdown table's column widths to fit the new content — 235 insertions / 67 deletions in the diff stat are mostly cosmetic re-alignment. Data is unchanged; post-prettier parser dry-run still returns `parsed: 86, mapping: 86, joined: 86`. The mapping.json diff is purely additive (147 insertions, 0 deletions of existing keys)._

## Files Created/Modified

- `task-taxonomy.md` — 21 new rows appended at category-section ends. Categories touched: Dishwashing (+2), Kitchen (+1), Cooking (+4), Laundry (+3), Cleaning (+2), Tidying (+1), Home Maintenance (+3), Gardening (+2), Pet Care (+2), Hobby (+1). Total = 21.
- `design-system/task-icons/mapping.json` — 21 new `tasks[]` entries with the same category distribution, slug + Lucide icon per spec. `gift-wrapping` gained a trailing comma (no longer array-last); `hanging-string-lights` is the new array-last (no trailing comma). JSON is valid.
- `.planning/quick/260524-p3n-add-21-us-oriented-tasks-to-taxonomy-and/260524-p3n-SUMMARY.md` (this file)

## Seed Result

✅ **Seed succeeded.**

```
[seed-tasks] parsed 86 taxonomy rows, joined with 86 mapping entries → 86 seed rows
[seed-tasks]   86/86 upserted
[seed-tasks] done — 86 tasks upserted
```

DB verification (via tsx + drizzle, since `psql` isn't on PATH in the agent worktree):

- `SELECT count(*) FROM tasks` → **87** (one more than the expected 86 — see "Out-of-scope observation" below).
- All 21 new slugs found in `tasks` (alphabetical sweep listed all 21).
- Zero slugs from `mapping.json` missing from the DB.

### Out-of-scope observation

The dev `tasks` table count is **87**, not the 86 predicted by the plan. The extra row is a pre-existing `dev-seed-chop-vegetables` ("Dev — Chop vegetables") inserted on 2026-05-23 (yesterday) — a leftover dev/test fixture that lives in the DB but is not in `mapping.json` or `task-taxonomy.md`. It is unrelated to this quick task (it predates the commit) and was not touched. Documented here for transparency; cleanup is out of scope for 260524-p3n. The seed itself produced exactly 86 upserts for the 86 taxonomy/mapping-defined slugs (all present).

## Icon Swaps

**None.** All 21 spec icons were kept verbatim — `Soup`, `Sparkles`, `Cog`, `Coffee`, `Bean`, `Beef`, `Cookie`, `RotateCw`, `Filter`, `Snowflake`, `AirVent`, `BedSingle`, `Recycle`, `RectangleHorizontal`, `Package`, `Grab`, `Bird`, `Footprints`, `Battery`, `Lightbulb`, `PartyPopper`. No Lucide fallbacks were needed (seed succeeded without import errors; downstream UI not exercised in this task per scope).

## Decisions Made

- Insertion order within each category block: new rows appended to the END of the category's contiguous block, not interleaved — preserves the existing row-order convention and keeps the diff a clean tail-append per category.
- `apps/api/.env` sourced from the main repo (worktrees don't include untracked files like `.env`).
- `pnpm install --frozen-lockfile` had to run in the worktree before the pre-commit hook could execute (lint-staged + tsc were not on PATH). Auto-fixed as a Rule 3 blocker — restored the worktree to a state where the hook chain can run, then re-staged + retried the commit (the previous failed `git commit` had not landed, so no amend was needed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Installed pnpm workspace dependencies in the agent worktree**

- **Found during:** First `git commit` attempt
- **Issue:** `lint-staged` pre-commit hook + `tsc --noEmit` typecheck step failed with `Command "lint-staged" not found` and `sh: tsc: command not found` because the agent worktree has no `node_modules/`.
- **Fix:** Ran `pnpm install --frozen-lockfile` (lockfile-up-to-date, 642 packages reused/added, ~5s).
- **Files modified:** none tracked (only `node_modules/` populated in the worktree).
- **Verification:** Re-ran `git commit`; lint-staged + typecheck both passed and the commit landed.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Tooling-environment fix only; no scope creep; no data or code logic changed.

## Issues Encountered

- The dev DB had a pre-existing out-of-scope row (`dev-seed-chop-vegetables`) inflating the total count to 87 instead of 86. Documented; left in place.

## User Setup Required

None — no external services touched.

## Self-Check: PASSED

- File `task-taxonomy.md` — FOUND (modified; 21 new rows landed; parser sees 86 rows)
- File `design-system/task-icons/mapping.json` — FOUND (modified; 86 `tasks[]` entries; valid JSON)
- File `.planning/quick/260524-p3n-add-21-us-oriented-tasks-to-taxonomy-and/260524-p3n-SUMMARY.md` — FOUND (this file)
- Commit `2fbb65e` (feat(taxonomy): add 21 US-oriented tasks (260524-p3n)) — FOUND (`git log -1 --format=%H` reachable)
- Dev `tasks` table — 21 new slugs verified present via tsx + drizzle (psql unavailable in worktree PATH)
- Diff additive-only check — PASS (zero deletions of existing rows/entries; prettier-driven whitespace shuffles are not row deletions)

## Next Phase Readiness

- Dev seed is idempotent — re-running picks up future taxonomy edits without state cleanup.
- Downstream UI task-selection (Phase 2 surface) will see 86 trainable tasks instead of 65 once those screens point at the dev DB.
- No blockers; no follow-up tickets.

---

_Quick task: 260524-p3n-add-21-us-oriented-tasks-to-taxonomy-and-mapping_
_Completed: 2026-05-24_
