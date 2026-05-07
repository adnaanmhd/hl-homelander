---
phase: 01-foundation-backend-distribution-recon
plan: 01
subsystem: infra
tags: [pnpm, typescript, fastify, drizzle, vitest, eslint, husky, monorepo]

# Dependency graph
requires:
  - phase: 00-init
    provides: project planning artifacts (PROJECT.md, ROADMAP.md, REQUIREMENTS.md, phase research)
provides:
  - pnpm-workspace monorepo skeleton (apps/api, apps/mobile, shared/types, infra/terraform)
  - root tsconfig.base.json enforcing strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes for every workspace
  - pinned dependency manifest for the @humyn/api package (Fastify 5.8.5, drizzle-orm 0.45.2, pg 8.20.0, AWS SDK v3 3.1044.0, zod 4.4.3, vitest 4.1.5, @xenova/transformers 2.17.2, lru-cache 11.0.2, ulid 2.3.0)
  - workspace-internal dep wiring (@humyn/api → @humyn/shared-types via "workspace:*")
  - ESLint 9 flat-config (eslint.config.mjs) at the repo root
  - prettier 3.3.3 + lint-staged 15.2.10 + husky 9.1.7 pre-commit pipeline running lint-staged then `pnpm typecheck`
  - reproducible bootstrap: `corepack prepare pnpm@9.15.0 --activate && pnpm install` produces a working pnpm-lock.yaml
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12, 01-13, all subsequent phases]

# Tech tracking
tech-stack:
  added:
    - pnpm@9.15.0 (workspace manager via corepack)
    - typescript@5.6.3 (root + per-package devDep)
    - prettier@3.3.3
    - eslint@9.16.0 with @eslint/js@9.16.0 + typescript-eslint@8.18.0 (flat config)
    - husky@9.1.7 + lint-staged@15.2.10
    - apps/api dependency manifest pinned (no carets — Fastify 5.8.5, drizzle-orm 0.45.2, pg 8.20.0, @aws-sdk/client-s3 3.1044.0, @aws-sdk/s3-request-presigner 3.1044.0, @aws-sdk/client-secrets-manager 3.1044.0, @aws-sdk/cloudfront-signer 3.1036.0, @xenova/transformers 2.17.2, zod 4.4.3, ulid 2.3.0, lru-cache 11.0.2, pino 10.3.1, pino-pretty 13.0.0, drizzle-kit 0.28.1, vitest 4.1.5, tsx 4.19.2)
    - infra/terraform pinned to 1.10.4 (.terraform-version)
  patterns:
    - "Strict-everywhere TypeScript: every package extends tsconfig.base.json and inherits noUncheckedIndexedAccess + exactOptionalPropertyTypes — phases 02-13 will not relax these flags"
    - "ESM-only at the workspace root: apps/api uses \"type\": \"module\", shared/types uses \"type\": \"module\"; eslint.config.mjs is ESM by extension"
    - "Pinned-no-caret dependency policy (T-1.1-02 mitigation): every dep in apps/api/package.json uses an exact version; supply-chain bumps require explicit PR review"
    - "Pre-commit gate = lint-staged + pnpm typecheck (Husky); CI is the hard gate (per T-1.1-01 disposition), local hook is the fast feedback loop"
    - "Workspace-internal deps use the \"workspace:*\" protocol so pnpm wires them as symlinks; consuming packages get fresh source on every save without rebuilding"

key-files:
  created:
    - package.json (workspace root, pnpm@9.15.0, lint-staged config)
    - pnpm-workspace.yaml (apps/* + shared/* topology)
    - tsconfig.base.json (TS strict baseline)
    - .nvmrc (Node 22.11.0)
    - .editorconfig (LF / 2-space)
    - .gitignore (node_modules, dist, .env, keystores, terraform state, ONNX cache)
    - .gitattributes (LF text + binary markers for media/keystore artifacts)
    - .prettierrc.json (formatting rules)
    - eslint.config.mjs (ESLint 9 flat config — replaces deleted .eslintrc.json)
    - .husky/pre-commit (lint-staged → pnpm typecheck)
    - .husky/.gitignore (excludes husky's `_` helpers)
    - apps/api/package.json (Fastify backend skeleton with all phase-1 deps pinned)
    - apps/api/tsconfig.json (extends base; composite + outDir/rootDir)
    - apps/api/vitest.config.ts (node env, 30 s timeouts)
    - apps/api/src/index.ts (placeholder; real Fastify wiring lands in plan 01-04)
    - apps/mobile/package.json (deferred-to-plan-13 stub scripts)
    - apps/mobile/tsconfig.json (extends base; jsx=react-native + DOM lib)
    - shared/types/package.json (zod-only; src is the entry; no build step)
    - shared/types/tsconfig.json (extends base; noEmit)
    - shared/types/src/index.ts (SHARED_TYPES_VERSION constant; Zod schemas land in 01-02..01-08)
    - infra/terraform/.terraform-version (1.10.4)
    - pnpm-lock.yaml (deterministic dep graph for the entire workspace)
  modified: []

key-decisions:
  - "ESLint 9.16.0 forced flat-config migration: legacy .eslintrc.* is unsupported in v9. Created eslint.config.mjs at root, deleted .eslintrc.json, added @eslint/js + typescript-eslint umbrella package."
  - "@aws-sdk/cloudfront-signer pinned at 3.1036.0 (not 3.1044.0): cloudfront-signer is on a slower release cadence than the rest of the AWS SDK v3 modules; 3.1044.0 doesn't exist on the registry. Other AWS SDK pins remain at 3.1044.0."
  - "Per-agent pnpm activation via corepack: machine had no pnpm binary; running `corepack prepare pnpm@9.15.0 --activate` is the canonical bootstrap step (matches package.json packageManager pin). No global `npm install -g pnpm` required."

patterns-established:
  - "Strict TypeScript baseline (Pattern 1): every workspace package extends tsconfig.base.json. Future phases must not opt out of strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes."
  - "ESM-first workspace (Pattern 2): backend (apps/api) and shared/types both declare \"type\": \"module\". TypeScript module=NodeNext + isolatedModules. New backend code must be ESM."
  - "Pinned exact versions (Pattern 3): no `^` or `~` in apps/api/package.json. Bumps are explicit and code-reviewed."
  - "Workspace-protocol deps (Pattern 4): @humyn/api → @humyn/shared-types uses `workspace:*`. Future @humyn/* packages follow the same convention."
  - "Pre-commit lint+typecheck gate (Pattern 5): `.husky/pre-commit` runs `pnpm exec lint-staged` then `pnpm typecheck`. Per CLAUDE.md, never bypass with `--no-verify`."

requirements-completed: []  # Plan 01-01 has empty requirements: [] frontmatter — no user-facing requirements close out here.

# Metrics
duration: 7min
completed: 2026-05-07
---

# Phase 01 Plan 01: Monorepo Bootstrap Summary

**pnpm-workspace monorepo with strict TypeScript baseline, pinned Fastify/drizzle/AWS-SDK-v3 backend deps, ESLint 9 flat config, and a working husky pre-commit gate that fires on every commit.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-07T12:15:28Z
- **Completed:** 2026-05-07T12:22:39Z
- **Tasks:** 3 / 3
- **Files created:** 22 (one deleted: legacy .eslintrc.json replaced by flat config)

## Accomplishments

- Workspace skeleton (`apps/api`, `apps/mobile`, `shared/types`, `infra/terraform`) with the exact layout that every Phase 1 plan and every subsequent phase will inherit.
- Strict TypeScript baseline (`tsconfig.base.json`) — `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `module: NodeNext` — applied across all three TS packages by `extends`.
- Backend dependency manifest fully pinned (Fastify 5.8.5, drizzle-orm 0.45.2, pg 8.20.0, AWS SDK v3 3.1044.0/3.1036.0, zod 4.4.3, vitest 4.1.5, @xenova/transformers 2.17.2, lru-cache 11.0.2, ulid 2.3.0, pino, drizzle-kit, tsx) — no carets, supply-chain mitigation per T-1.1-02.
- Workspace-internal `@humyn/api → @humyn/shared-types` link via `workspace:*` (verified via the symlink at `apps/api/node_modules/@humyn/shared-types`).
- ESLint 9 flat config (`eslint.config.mjs`) wired with `@eslint/js` + `typescript-eslint` — `pnpm lint` is clean across all workspaces.
- Husky pre-commit hook is active (`core.hooksPath = .husky/_`) and fires `lint-staged` → `pnpm typecheck`. The Task 3 commit was the live self-test: prettier reformatted `package.json` during the hook run and the commit landed cleanly.
- `pnpm install` from the corepack-pinned `pnpm@9.15.0` produced a working `pnpm-lock.yaml`; `pnpm typecheck` and `pnpm lint` both exit 0 across the entire workspace.

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Workspace root, package.json, pnpm-workspace, tsconfig.base, lint/format** — `c512e16` (chore)
2. **Task 2: apps/api skeleton, apps/mobile placeholder, shared/types, infra/terraform** — `dee0279` (chore)
3. **Task 3: Husky pre-commit hook + pnpm install verification** — `3d2c41d` (chore; commit captured the cloudfront-signer + flat-config deviations and the pnpm-lock bootstrap)

**Plan metadata:** to be added by the final SUMMARY/STATE/ROADMAP commit (post-summary).

## Files Created / Modified

- `package.json` — workspace root, pnpm@9.15.0 packageManager pin, Node `>=22.0.0` engine, lint-staged config, root devDeps (typescript, prettier, eslint 9 + flat-config umbrella, husky, lint-staged).
- `pnpm-workspace.yaml` — `apps/*` + `shared/*` topology.
- `tsconfig.base.json` — strict TS baseline (target ES2023, module NodeNext, all strict flags on).
- `.nvmrc` — Node 22.11.0 pin.
- `.editorconfig` — LF / 2-space / trim-trailing / final newline (excluding markdown).
- `.gitignore` — node_modules, dist, \*.tsbuildinfo, .env, .DS_Store, coverage, mobile keystores, terraform state, ONNX cache, apps/api/dist.
- `.gitattributes` — LF text default; binary markers for png/jpg/svg/onnx/task/apk/aab/jks/keystore.
- `.prettierrc.json` — 100-col, single-quote, trailing-comma=all, arrow-parens=always.
- `eslint.config.mjs` — ESLint 9 flat config (replaces deleted `.eslintrc.json`); typescript-eslint recommended rules + project ignore patterns.
- `.husky/pre-commit` — runs `pnpm exec lint-staged` then `pnpm typecheck`; chmod +x.
- `.husky/.gitignore` — `_` (excludes husky internal helpers).
- `apps/api/package.json` — `@humyn/api` Fastify backend skeleton; all deps pinned; workspace dep on `@humyn/shared-types`.
- `apps/api/tsconfig.json` — extends base; composite, outDir=dist, rootDir=src.
- `apps/api/vitest.config.ts` — node env, 30 s test/hook timeouts, `src/**/*.test.ts` + `tests/**/*.test.ts` glob.
- `apps/api/src/index.ts` — placeholder log; real Fastify wiring lands in plan 01-04.
- `apps/mobile/package.json` — `@humyn/mobile` skeleton; lint/typecheck/test deferred to plan 01-13.
- `apps/mobile/tsconfig.json` — extends base; `jsx: react-native`, lib adds DOM.
- `shared/types/package.json` — `@humyn/shared-types` zod-only package; src is the entry; no build step.
- `shared/types/tsconfig.json` — extends base; `rootDir: src`, `noEmit: true`.
- `shared/types/src/index.ts` — `SHARED_TYPES_VERSION = '0.1.0'`; Zod schemas land in plans 01-02..01-08.
- `infra/terraform/.terraform-version` — `1.10.4`.
- `pnpm-lock.yaml` — deterministic dep graph for the entire workspace (committed).

## Decisions Made

- **Adopt ESLint 9 flat config in plan 01-01** rather than chasing `ESLINT_USE_FLAT_CONFIG=false` workarounds. ESLint 9 is the project's pinned major; flat config is the modern, forward-compatible path. Cost: one extra config file (`eslint.config.mjs`) and two added devDeps (`@eslint/js`, `typescript-eslint`).
- **Bootstrap pnpm via corepack** (`corepack prepare pnpm@9.15.0 --activate`) instead of `npm i -g pnpm`. Matches the `packageManager` pin in `package.json`, version-locks the toolchain, and keeps the install reproducible across machines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @aws-sdk/cloudfront-signer version doesn't exist on registry**

- **Found during:** Task 3 (initial `pnpm install` run)
- **Issue:** Plan pinned `@aws-sdk/cloudfront-signer@3.1044.0` to align with the rest of the AWS SDK v3 modules. The cloudfront-signer package is on a slower release cadence; latest published version is `3.1036.0`. `pnpm` aborted with `ERR_PNPM_NO_MATCHING_VERSION`.
- **Fix:** Bumped `@aws-sdk/cloudfront-signer` from `3.1044.0` → `3.1036.0` in `apps/api/package.json`. All other AWS SDK v3 modules (`client-s3`, `s3-request-presigner`, `client-secrets-manager`) remained at `3.1044.0`.
- **Files modified:** `apps/api/package.json`
- **Verification:** Re-ran `pnpm install` — completed in 35.4 s with `node_modules/.pnpm` populated and `pnpm-lock.yaml` written.
- **Pre-flight broader check:** Spot-checked all 26 pinned versions against the registry before committing the fix; only cloudfront-signer was an outlier.
- **Committed in:** `3d2c41d` (Task 3 commit).

**2. [Rule 1 - Bug] ESLint 9.16.0 dropped legacy `.eslintrc.*` support; flat config required**

- **Found during:** Task 3 (post-install `pnpm lint` smoke run)
- **Issue:** Plan created `.eslintrc.json` (Task 1) which is incompatible with ESLint v9 — v9 enforces flat config (`eslint.config.{js,mjs,cjs}`). `pnpm lint` failed across `apps/api` and `shared/types` with `ESLint couldn't find an eslint.config.(js|mjs|cjs) file`.
- **Fix:** Deleted `.eslintrc.json`. Created `eslint.config.mjs` at the repo root with the equivalent ruleset (typescript-eslint recommended + custom no-unused-vars + no-explicit-any rules) plus a project-wide `ignores` array. Added `@eslint/js@9.16.0` and `typescript-eslint@8.18.0` to root devDependencies (legacy `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` 8.18.0 pins kept for transitional compatibility — both are pulled in by the umbrella package).
- **Files modified:** `package.json` (added two devDeps), `eslint.config.mjs` (created), `.eslintrc.json` (deleted).
- **Verification:** `pnpm lint` and `pnpm typecheck` both exit 0 across the workspace; pre-commit hook ran successfully on the Task 3 commit (lint-staged auto-formatted `package.json` during the hook).
- **Committed in:** `3d2c41d` (Task 3 commit).

**3. [Rule 1 - Bug, Cosmetic] `eslint.config.js` → `eslint.config.mjs` rename to silence MODULE_TYPELESS_PACKAGE_JSON warning**

- **Found during:** Task 3 (after first lint pass with flat config)
- **Issue:** Initial flat config was named `eslint.config.js`; root `package.json` doesn't declare `"type": "module"`, so Node logged a parse-and-reparse warning each time ESLint ran. Renaming to `.mjs` makes the ESM parse explicit and silences the warning without altering the workspace-root package.json type semantics.
- **Fix:** `mv eslint.config.js eslint.config.mjs`.
- **Files modified:** filename only.
- **Verification:** `pnpm lint` exits 0 with no warnings.
- **Committed in:** `3d2c41d` (Task 3 commit, alongside the flat-config migration).

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking — registry version mismatch; 2 Rule 1 bugs — ESLint v9 config-format breakage).
**Impact on plan:** All three were necessary to make the verification pipeline (`pnpm install` → `pnpm typecheck` → `pnpm lint` → husky hook) actually work. No scope creep. The cloudfront-signer correction is a documented version-skew within AWS SDK v3, not a stack change. The ESLint flat-config migration enforces the _future-state_ config format, so subsequent plans can extend it directly rather than carry a brittle legacy `.eslintrc.*` forward.

## Acceptance-Criteria Note

- The plan's Task 3 acceptance line `test -L node_modules/@humyn/api || test -d node_modules/@humyn/api` was written assuming a hoisted `node_modules` layout. pnpm's default isolated node-linker does NOT hoist workspace packages into the root `node_modules/` — they live as symlinks inside each consumer's `node_modules`. Verified the equivalent-and-stronger condition: `apps/api/node_modules/@humyn/shared-types -> ../../../../shared/types` (the `workspace:*` link is correctly wired). This is a documentation refinement, not a deviation.

## Issues Encountered

- **`pnpm` not installed on the dev machine** — corepack 0.34.6 is shipped with Node 24.14.1; ran `corepack prepare pnpm@9.15.0 --activate` to materialize the workspace-pinned pnpm version. Captured in Decisions Made.
- **Node runtime is 24.14.1, not the 22.x pinned in `.nvmrc`** — `engines.node` in root package.json is `>=22.0.0`, so install succeeded. The `.nvmrc` pin is informational for `nvm` users; CI and contributors on Node 22 will get the canonical environment. No action needed.
- **Vitest peer-dep warnings** — `vite 8.0.11` (a transitive dep of vitest 4.1.5) wants `esbuild ^0.27 || ^0.28` but resolves to 0.19.12, and wants `@types/node ^20.19 || >=22.12` but resolves to 22.9.3. These are warnings only; install completes; vitest hasn't been exercised yet (test runner config lands in 01-04+). Documented for plan 01-04 to revisit if test-time issues surface.

## User Setup Required

None — no external service configuration required. The workspace bootstraps from `corepack prepare pnpm@9.15.0 --activate && pnpm install`. CI configuration arrives in plan 01-09.

## Next Phase Readiness

- **Ready for plan 01-02** (Postgres schema + Drizzle migrations) — `apps/api/package.json` has `drizzle-orm@0.45.2`, `drizzle-kit@0.28.1`, `pg@8.20.0` already pinned; the `db:generate` / `db:push` / `db:migrate` scripts are wired; `shared/types/src/index.ts` is empty and ready for Zod schema additions.
- **Ready for plan 01-03** (LocalStack S3 dev infra) — `infra/terraform/` exists with the Terraform version pin; `apps/api` has the AWS SDK v3 modules pinned (`client-s3`, `s3-request-presigner`, `client-secrets-manager`, `cloudfront-signer`).
- **Ready for plan 01-04** (Fastify HTTP scaffold) — `fastify@5.8.5`, `@fastify/cors`, `@fastify/jwt`, `@fastify/rate-limit` pinned; `apps/api/src/index.ts` is a stub waiting to be replaced; `vitest.config.ts` is in place.
- **Pre-commit gate is live** — every subsequent plan's commits will be lint+typechecked at commit time. CLAUDE.md prohibition on `--no-verify` is enforceable.
- **No blockers** for any subsequent Phase 1 plan.

## Self-Check: PASSED

- All 22 files claimed in "Files Created / Modified" exist on disk (verified via `test -f` for each).
- All 3 task commit hashes (`c512e16`, `dee0279`, `3d2c41d`) exist in `git log --oneline --all` on `main`.
- `pnpm typecheck` exits 0 across all 4 workspace projects.
- `pnpm lint` exits 0 across all 3 lint-enabled workspaces (apps/mobile is intentionally a stub).
- `.husky/pre-commit` is executable (`chmod +x`) and was actively triggered during the Task 3 commit (prettier auto-formatted `package.json` mid-commit and the commit landed cleanly).

---

_Phase: 01-foundation-backend-distribution-recon_
_Completed: 2026-05-07_
