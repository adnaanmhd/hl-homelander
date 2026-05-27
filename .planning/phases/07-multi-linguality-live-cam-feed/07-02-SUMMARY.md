---
phase: 07-multi-linguality-live-cam-feed
plan: 02
subsystem: tools
tags: [tools, llm, anthropic, i18n, vitest, claude-opus]

requires:
  - phase: '07'
    provides: PLAN 07-01 (i18n runtime, en.json source-of-truth) — NOT YET SHIPPED; this plan ships the tooling that will consume en.json once 07-01 lands and 07-05 finalizes en.json
provides:
  - tools/ workspace at repo root (standalone npm, not part of pnpm-workspace.yaml)
  - @anthropic-ai/sdk-backed catalog generator (Claude Opus 4.7) at tools/i18n/generate.ts
  - Verbatim D-10 vernacular brief at tools/i18n/prompts.ts
  - Shape-parity validator (recursive key-set diff vs en.json) at tools/i18n/validate.ts with CLI mode
  - Audit sidecar contract (model / generated_at / brief_version / en_source_sha) per D-12
  - Locale ordering + LOCALE_NAMES constant (D-18) — single source for downstream consumers
  - tools/.env gitignored end-to-end (root .gitignore + tools/.gitignore defense-in-depth)
affects:
  - 07-05 (screen sweep): final task will provision tools/.env and run `pnpm i18n:generate` once en.json stabilizes
  - 07-03 / 07-04 / 07-06+ (downstream i18n plans): the locale-config constants + audit sidecar contract are the canonical references

tech-stack:
  added:
    - '@anthropic-ai/sdk@^0.98.0 (tools workspace only — never ships in mobile bundle)'
    - 'zod@^4.4.3 (tools workspace; not yet used at runtime — present for future Anthropic response validation)'
    - 'tsx@^4.0.0 (tools workspace dev — CLI entry for the generator)'
    - 'vitest@^4.1.5 (tools workspace dev — matches the api/mobile vitest pin)'
    - 'typescript@^5.6.3 (tools workspace dev)'
  patterns:
    - 'NodeNext + .js-suffixed relative imports for ESM-only Node tooling'
    - 'CLI-as-script-import-marker (\`if (import.meta.url === \`file://${process.argv[1]}\`)\`)'
    - 'Mock-the-client async generator test pattern (no real network in vitest)'
    - 'tools/ workspace pattern: standalone npm + own package-lock, not pnpm-workspace member'

key-files:
  created:
    - tools/package.json
    - tools/tsconfig.json
    - tools/package-lock.json
    - tools/.env.example
    - tools/.gitignore
    - tools/i18n/locale-config.ts
    - tools/i18n/validate.ts
    - tools/i18n/generate.ts
    - tools/i18n/prompts.ts
    - tools/i18n/__tests__/validate.test.ts
    - tools/i18n/__tests__/generate.test.ts
  modified:
    - .gitignore (added explicit tools/.env + tools/node_modules/ block)

key-decisions:
  - 'tools/ is standalone npm (not in pnpm-workspace.yaml) — mirrors apps/mobile pattern, keeps pnpm scope to api + shared/*'
  - 'NodeNext moduleResolution chosen (matches apps/api ergonomics; gives strict ESM correctness with .js-suffixed relative imports)'
  - 'Audit sidecar lives in a SEPARATE {loc}.audit.json file (JSON does not permit comments, per RESEARCH §Audit-Trail Header)'
  - 'package-lock.json committed (reproducible installs match apps/mobile pattern documented in pnpm-workspace.yaml)'
  - 'Defense-in-depth on tools/.env: matched by root `.env` rule + explicit `tools/.env` line + tools/.gitignore `.env` line'

patterns-established:
  - 'Pattern: NodeNext .js-suffix relative imports in tools/ (test files must use .js even though source is .ts)'
  - 'Pattern: shape-parity validator as a reusable export — both vitest tests and the generator post-write gate consume it'
  - 'Pattern: D-10-style verbatim-prompt-as-source-string (no template rendering, no environment substitution — the brief IS the source)'

requirements-completed: [I18N-05]

duration: ~32min
completed: 2026-05-24
---

# Phase 7 Plan 02: LLM Catalog Generator Tool Summary

**Claude Opus 4.7 catalog generator (Anthropic SDK) with verbatim D-10 vernacular brief, audit sidecar, and recursive shape-parity validator — tooling ships green; the LLM run itself is deferred to plan 07-05's final task per the plan contract.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-05-24T13:32:00Z (approx)
- **Completed:** 2026-05-24T14:04:38Z
- **Tasks:** 2 (both TDD, RED + GREEN gates per task)
- **Files created:** 11
- **Files modified:** 1 (.gitignore)

## Accomplishments

- Brand-new `tools/` workspace at repo root — standalone npm package with deterministic `package-lock.json`, vitest, tsx, and `@anthropic-ai/sdk@^0.98.0`.
- Shape-parity validator (`tools/i18n/validate.ts`) with 5 vitest cases covering exact match, missing top-level, missing nested (dotted path), extra (LLM hallucination), and leaf-type-mismatch behaviors. CLI mode walks all 7 `TARGET_LOCALES` and exits non-zero on any mismatch.
- Catalog generator (`tools/i18n/generate.ts`) with 5 offline vitest cases (mock Anthropic client — zero real network in tests). Strips markdown fences, throws helpful errors on malformed JSON, gates writes through the shape-parity validator.
- Verbatim D-10 brief (`tools/i18n/prompts.ts` — `VERNACULAR_BRIEF`) frozen as source text + a `BRIEF_VERSION` integer that the audit sidecar stamps for change-tracking.
- Audit sidecar contract (`buildAuditSidecar(enSource) → { model, generated_at, brief_version, en_source_sha }`) materializes per D-12 — every generated locale ships with a sibling `{loc}.audit.json` so future diff tools can detect when a re-generation is needed.
- Defense-in-depth on `tools/.env`: matched by root `.env`, additional explicit `tools/.env` block, plus per-package `tools/.gitignore`. `git status tools/.env` returns nothing — never tracked.

## Task Commits

Each task was committed atomically with TDD ritual (RED → GREEN):

1. **Task 1 RED: shape-parity validator failing test + tools/ workspace bootstrap** — `6b8c4bc` (test)
2. **Task 1 GREEN: implement validateShapeParity + locale-config** — `0c20430` (feat)
3. **Task 2 RED: catalog-generator failing tests (offline LLM mocks)** — `553abb9` (test)
4. **Task 2 GREEN: implement generator + verbatim brief** — `1da1652` (feat)

Plan metadata commit (this SUMMARY): pending — final commit at end of plan execution.

## Files Created/Modified

- `tools/package.json` — `@humyn/tools` workspace with `i18n:generate` + `i18n:validate` + `test` scripts; deps `@anthropic-ai/sdk@^0.98.0` + `zod@^4.4.3`; dev deps `typescript@^5.6.3` + `tsx@^4.0.0` + `vitest@^4.1.5`.
- `tools/tsconfig.json` — NodeNext ESM config, strict, noEmit, includes `i18n/**/*.ts`.
- `tools/package-lock.json` — committed for reproducible installs (mirrors apps/mobile pattern).
- `tools/.env.example` — documents `ANTHROPIC_API_KEY` source (Anthropic Console → Settings → API Keys) with explicit "NEVER commit a real key" warning.
- `tools/.gitignore` — `.env` + `node_modules/`.
- `tools/i18n/locale-config.ts` — `TARGET_LOCALES` (D-18 ordering) + `LOCALE_NAMES` map ("Brazilian Portuguese", "Hindi (India)", etc).
- `tools/i18n/validate.ts` — `validateShapeParity(en, loc) → { missing[], extra[] }` recursive walker + CLI entry point.
- `tools/i18n/generate.ts` — `generateLocale(client, loc, en)` + `buildAuditSidecar(enSource)` exports + CLI `main()` with env-key guard.
- `tools/i18n/prompts.ts` — `VERNACULAR_BRIEF` (verbatim D-10) + `BRIEF_VERSION` (= 1) + `userPromptFor(localeName, en)` helper.
- `tools/i18n/__tests__/validate.test.ts` — 5 cases.
- `tools/i18n/__tests__/generate.test.ts` — 5 cases (all mock the Anthropic client).
- `.gitignore` — added explicit `tools/.env` + `tools/node_modules/` block under a "Phase 7" header (defense-in-depth on top of the existing root `.env` rule).

## Decisions Made

- **NodeNext + .js-suffix imports**: Picked NodeNext over CommonJS to match the `apps/api` ergonomics and force strict ESM correctness. Pre-commit `tsc --noEmit` caught the missing `.js` suffix on test imports immediately — fixed inline as a Rule-1 bug.
- **Audit sidecar in a separate file**: JSON doesn't permit comments, and embedding audit metadata as a key inside the catalog itself would pollute the i18next key namespace. Sibling `{loc}.audit.json` is the cleanest match for RESEARCH's "Audit-Trail Header" guidance.
- **`package-lock.json` committed**: `tools/` is standalone npm (per `pnpm-workspace.yaml` excluding it), so the lockfile is the reproducibility anchor — same pattern as `apps/mobile`.
- **`zod` declared as a dep but not yet used at runtime**: PLAN listed it; we kept it for the inevitable Anthropic response schema validation pass (probably the first thing plan 07-05's final task will reach for) rather than dropping it and re-adding later.
- **`pnpm install` ran at the worktree root**: The pre-commit hook requires `lint-staged` + `tsc` from the root + apps/api `node_modules`. Worktree spawned without those, so the very first commit attempt failed with "lint-staged not found". `pnpm install` resolved it in 4s (lockfile up to date, reused cache). Documented here so the next worktree spawn doesn't waste time chasing the same symptom.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-file relative imports missing `.js` extension under NodeNext moduleResolution**

- **Found during:** Task 2 GREEN (`npx tsc --noEmit` after writing `generate.ts` + `prompts.ts`)
- **Issue:** `tools/tsconfig.json` uses `moduleResolution: "nodenext"`, which requires relative imports to carry an explicit `.js` extension (the file is `.ts` on disk but the runtime ESM resolver resolves to `.js`). Both test files were initially written with `from '../validate'` / `from '../generate'` / `from '../prompts'` — vitest accepts the unsuffixed form (it bypasses Node's loader), but `tsc --noEmit` (an acceptance-criterion) failed with `TS2835`.
- **Fix:** Edited both test files to use `.js`-suffixed relative imports. Confirmed `tsc --noEmit` clean + all 10 tests still pass.
- **Files modified:** `tools/i18n/__tests__/validate.test.ts`, `tools/i18n/__tests__/generate.test.ts`
- **Verification:** `cd tools && npx tsc --noEmit` exit 0; `npm test` 10/10 pass.
- **Committed in:** `1da1652` (folded into the Task 2 GREEN commit since it was part of the same GREEN gate).

**2. [Rule 3 - Blocking] Worktree spawned without root `node_modules` — pre-commit hook fatal**

- **Found during:** Task 1 RED commit attempt
- **Issue:** The Claude-Code worktree-spawn doesn't include the pnpm-managed `node_modules`. The pre-commit hook runs `pnpm exec lint-staged` + `pnpm typecheck`, both of which require `tsc` + `lint-staged` on `PATH`. First commit attempt failed with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "lint-staged" not found` and `sh: tsc: command not found`.
- **Fix:** Ran `pnpm install` at worktree root (4s — lockfile up to date, 642 packages reused from cache).
- **Files modified:** None (install only — lockfile unchanged).
- **Verification:** Re-ran `git commit`; pre-commit hook passed cleanly.
- **Committed in:** N/A (the fix was an install, not a code change).

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — tsc-acceptance-criterion bug, 1 Rule 3 — worktree env bootstrap).
**Impact on plan:** Zero scope drift. Both fixes were strictly required to clear the plan's stated acceptance criteria (`tsc --noEmit` exits 0; pre-commit hook passes).

## Issues Encountered

- **Prettier reformatted source files in-flight via `lint-staged`** — the pre-commit hook ran prettier on staged files and slightly reformatted `tools/i18n/locale-config.ts` (collapsed the `TARGET_LOCALES` array to one line) and `tools/i18n/generate.ts` (collapsed a multi-line `writeFileSync` call). Functionally inert; no follow-up needed. Documented here so a reader doesn't go hunting for the difference between the PLAN's quoted block and the committed bytes.

## User Setup Required

**`ANTHROPIC_API_KEY` is required to actually run `pnpm i18n:generate`** — but the run is deferred to plan 07-05's final task per this plan's contract. Tooling ships now; the LLM call doesn't fire until the screen-sweep finalizes `en.json`.

When 07-05's final task lands, the operator step is:

1. Visit the [Anthropic Console](https://console.anthropic.com/settings/keys) → Settings → API Keys → Create Key.
2. Copy the key (starts with `sk-ant-...`).
3. `cp tools/.env.example tools/.env` then paste the real key into `tools/.env` (NEVER into `apps/mobile/.env` or `apps/api/.env`).
4. `cd tools && npm run i18n:generate`.

The full key never enters the mobile bundle — `tools/` is a Node-only workspace and is never imported from `apps/mobile/`.

## Next Phase Readiness

- **For plan 07-01 (i18n runtime + en.json scaffold):** No coupling — 07-01 hand-authors `en.json` and stands up `i18next`; this plan's tooling does NOT consume `en.json` at PLAN-time.
- **For plan 07-05 (screen sweep, final task = invoke generator):** Ready. Tooling tested, gitignore safe, audit-sidecar contract documented. Operator only needs to drop `ANTHROPIC_API_KEY` into `tools/.env` and run `cd tools && npm run i18n:generate` after en.json stabilizes.
- **For downstream i18n plans (07-03, 07-04, 07-06+):** `TARGET_LOCALES` + `LOCALE_NAMES` from `tools/i18n/locale-config.ts` are the canonical references for locale ordering / display name — import from there rather than re-declaring.
- **No blockers identified.**

## Self-Check: PASSED

Files verified to exist (`[ -f path ] && echo FOUND`):

- `tools/package.json` FOUND
- `tools/tsconfig.json` FOUND
- `tools/.env.example` FOUND
- `tools/.gitignore` FOUND
- `tools/i18n/locale-config.ts` FOUND
- `tools/i18n/validate.ts` FOUND
- `tools/i18n/generate.ts` FOUND
- `tools/i18n/prompts.ts` FOUND
- `tools/i18n/__tests__/validate.test.ts` FOUND
- `tools/i18n/__tests__/generate.test.ts` FOUND

Commits verified (`git log --oneline | grep`):

- `6b8c4bc` FOUND — test(07-02) RED for Task 1
- `0c20430` FOUND — feat(07-02) GREEN for Task 1
- `553abb9` FOUND — test(07-02) RED for Task 2
- `1da1652` FOUND — feat(07-02) GREEN for Task 2

Acceptance verifications:

- `cd tools && npm test` → 2 files, 10 tests, all pass.
- `cd tools && npx tsc --noEmit` → exit 0 (clean).
- `git status tools/.env` → "nothing to commit" (never tracked).
- `grep -rE "(ANTHROPIC_API_KEY|sk-ant-)" apps/mobile/ apps/api/` (excluding node_modules) → zero hits (no key leakage into the mobile/api bundles).

## TDD Gate Compliance

Both Task 1 and Task 2 followed the RED → GREEN cycle:

- Task 1 RED `6b8c4bc` (test) → GREEN `0c20430` (feat). Confirmed RED failed with "Cannot find module" before GREEN.
- Task 2 RED `553abb9` (test) → GREEN `1da1652` (feat). Confirmed RED failed with "Cannot find module" before GREEN.

No REFACTOR commit needed — both implementations were minimal-to-pass.

---

_Phase: 07-multi-linguality-live-cam-feed_
_Completed: 2026-05-24_
