---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 01
subsystem: infra
tags: [pnpm, npm, monorepo, react-native, gradle, github-actions, husky, lint-staged]

# Dependency graph
requires:
  - phase: 01-foundation-backend-distribution-recon
    provides: 'mobile package layout under apps/mobile (pnpm-tracked workspace member with full RN 0.83 + Hermes new-arch dep tree)'
provides:
  - 'apps/mobile isolated from the pnpm workspace and managed by npm with a committed package-lock.json'
  - 'shared/types consumed by mobile via file: dependency, no longer through workspace: protocol'
  - 'mobile-ci.yml workflow exercising npm ci + Gradle assembleApkRolloutDebug on every mobile-touching PR'
  - 'root mobile:install / mobile:test / mobile:typecheck scripts that surface npm-managed mobile commands'
  - 'husky pre-commit branched: pnpm path for backend/shared, no-op-for-now mobile path until plan 02-13 lands a lint-staged config'
affects:
  - 'every Phase 2 plan (02-02..02-N) — D-PKG-07 marks 02-01 BLOCKING for the rest of the phase'
  - 'Phase 4 mobile capture/hand-detect plans (HumynCapture, HumynHandDetector) — flat npm node_modules satisfies their Gradle relative-path assumptions'
  - 'Phase 7 iOS plans — same npm-managed apps/mobile package at that point'

# Tech tracking
tech-stack:
  added:
    - 'npm 10.9.0 (pinned via apps/mobile/package.json packageManager field)'
  patterns:
    - 'Mobile-side npm-isolation pattern: removing apps/mobile from pnpm-workspace.yaml + packageManager pin + file: link to shared/* eliminates pnpm symlink farm in node_modules and matches RN/Gradle relative-path assumptions'
    - 'Per-package CI workflow split: api-ci.yml stays pnpm, mobile-ci.yml is npm-only; path filters narrow each so a mobile change does not trigger the API workflow and vice-versa'
    - 'Husky pre-commit branching by staged-file globs: root pnpm path for backend/shared, optional mobile path gated on apps/mobile/package.json declaring lint-staged'

key-files:
  created:
    - 'apps/mobile/.gitignore (D-PKG-02 marker that package-lock.json is COMMITTED + ignores node_modules/build outputs)'
    - 'apps/mobile/package-lock.json (lockfileVersion 3, ~380 KB, npm-managed)'
    - '.github/workflows/mobile-ci.yml (npm-only mobile CI: lint+typecheck+test job + Android Gradle build job)'
  modified:
    - 'pnpm-workspace.yaml (apps/* glob → apps/api literal; comment block documents the split)'
    - 'apps/mobile/package.json (added packageManager npm@10.9.0 + @humyn/shared-types: file:../../shared/types)'
    - 'package.json (added mobile:install / mobile:test / mobile:typecheck root scripts)'
    - '.husky/pre-commit (branched on staged-file globs; pnpm path unchanged, mobile path gated)'
    - 'pnpm-lock.yaml (~5.9k lines removed as the mobile dep tree leaves the workspace)'

key-decisions:
  - 'Comment-substring sensitivity: dropped any literal "apps/mobile" substring from pnpm-workspace.yaml because the plan acceptance grep `grep -E "apps/mobile" pnpm-workspace.yaml` is intentionally strict. Comments now use generic phrasing ("the mobile package") to keep the file machine-checkable.'
  - 'Same comment-substring discipline applied to mobile-ci.yml — banned the literal "pnpm" token from comments (used "npm + actions/setup-node" instead) so the plan acceptance grep `grep -q "pnpm" mobile-ci.yml` returns zero matches.'
  - 'Did NOT pre-create a lint-staged config inside apps/mobile. Plan 02-13 (mobile shell scaffolding) is the natural place to land it; the pre-commit hook silently no-ops on the mobile branch via a `package.json["lint-staged"]` existence gate, so commits inside this plan and follow-ons do not error.'
  - 'Did NOT attempt the full Gradle assembleApkRolloutDebug build inside this worktree. The worktree has JDK 26 (not the required 17) and ANDROID_HOME unset. Per plan body Task 2: "build may fail later in the chain on missing native modules — that is acceptable here; what we verify is that the path-resolution-stage passes." Path resolution is verified by the directory `apps/mobile/node_modules/@react-native/gradle-plugin` existing under the flat npm tree (which `apps/mobile/android/settings.gradle` references via `../../../node_modules/@react-native/gradle-plugin`). The full apkRolloutDebug build is operator territory at the Task 4 checkpoint.'

patterns-established:
  - 'Pattern: Mobile-side `file:` link to shared/types replaces workspace: protocol (npm 10 actually symlinks file: deps in node_modules — works for the type-import use case Phase 2 needs).'
  - 'Pattern: CI workflow path filters mutually exclusive between api-ci.yml (apps/api/**, shared/types/**, pnpm-lock.yaml, etc.) and mobile-ci.yml (apps/mobile/**, shared/types/**, .github/workflows/mobile-ci.yml). `shared/types/**` is in BOTH because a shared/* contract change exercises both stacks.'
  - 'Pattern: pre-commit hook gates mobile lint-staged on a `package.json["lint-staged"]` JSON-existence check via `node -e "process.exit(require(...)['lint-staged'] ? 0 : 1)"` — keeps the hook resilient to plans landing the mobile config in any order.'

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-05-09
---

# Phase 2 Plan 01: Mobile package-manager migration (pnpm → npm) Summary

**apps/mobile isolated from the pnpm workspace and migrated to npm with a committed lockfile, file: link to shared/types, dedicated mobile-ci.yml exercising npm ci + Gradle assembleApkRolloutDebug — operator smoke deferred to the Task 4 human-verify checkpoint.**

## Performance

- **Duration:** ~10 min (Tasks 1-3 only; Task 4 is the operator-smoke checkpoint that gates plan completion)
- **Started:** 2026-05-09T06:49:20Z
- **Completed (Tasks 1-3):** 2026-05-09T07:00:13Z
- **Tasks:** 3 of 4 executed (Task 4 is `checkpoint:human-verify gate="blocking"`)
- **Files modified:** 8 (3 created + 5 modified across 3 commits)

## Accomplishments

- **Workspace surgery clean (Task 1).** `pnpm-workspace.yaml` lists `apps/api` + `shared/*` only; `pnpm install` from repo root reports the workspace as 3 projects (root + apps/api + shared/types), no apps/mobile.
- **Flat npm node_modules in place (Task 2).** `apps/mobile/package-lock.json` minted at lockfileVersion 3 (~380 KB). `apps/mobile/node_modules/react-native` resolves to a real flat tree; no `.pnpm/` symlink farm; `@humyn/shared-types` resolves through npm's `file:` symlink to `shared/types`. Gradle's `apps/mobile/android/settings.gradle` reference `../../../node_modules/@react-native/gradle-plugin` resolves cleanly under the flat tree (verified by directory existence).
- **CI + tooling re-routed for the npm/pnpm split (Task 3).** `.github/workflows/mobile-ci.yml` is npm-only (Node 22 + Temurin JDK 17 + npm cache keyed on `apps/mobile/package-lock.json`); root `package.json` exposes `mobile:install`/`mobile:test`/`mobile:typecheck` scripts; `.husky/pre-commit` branches on staged-file globs so mobile commits do not get pulled through the root pnpm lint-staged path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Surgery — drop apps/mobile from pnpm workspace** — `8ef39b8` (chore)
2. **Task 2: Generate the npm lockfile + verify Gradle relative-paths still resolve** — `1a7051d` (chore)
3. **Task 3: Update root scripts, lint-staged/Husky, CI workflow** — `ecbfe96` (chore)
4. **Task 4: Operator smoke — clean checkout npm install + Gradle build** — PENDING (`checkpoint:human-verify gate="blocking"`)

_Note: this plan is `autonomous: false`. Task 4 requires the developer machine (JDK 17, ANDROID_HOME, Gradle wrapper bootstrapped) and on-PR CI green light; the parallel-executor cannot run those steps inside the worktree._

## Files Created/Modified

- `apps/mobile/.gitignore` — D-PKG-02 marker that `package-lock.json` is COMMITTED for npm reproducibility; ignores `node_modules/`, Metro/Gradle build outputs, iOS Pods (Phase 7), and `.DS_Store`/logs.
- `apps/mobile/package-lock.json` — npm-minted lockfile, lockfileVersion 3, ~380 KB. Generated by `npm install` against the post-Task-1 `package.json` from a clean `node_modules`.
- `.github/workflows/mobile-ci.yml` — Two-job npm-only workflow: (1) `lint-typecheck-test` runs `npm ci + npm run typecheck + npm run lint + npm run test`; (2) `android-build` (depends on first) runs `npm ci`, `./gradlew :app:testApkRolloutDebugUnitTest`, `./gradlew assembleApkRolloutDebug`, and the existing `verify-merged-manifests.sh`. Triggered by `apps/mobile/**`, `shared/types/**`, and the workflow file itself.
- `pnpm-workspace.yaml` — Replaced `apps/*` glob with explicit `apps/api`. Comment block at top documents the npm split.
- `apps/mobile/package.json` — Added `"packageManager": "npm@10.9.0"` and `"@humyn/shared-types": "file:../../shared/types"`. No removals; `private: true` already present.
- `package.json` — Added `mobile:install`, `mobile:test`, `mobile:typecheck` root scripts. Existing `lint`/`typecheck`/`test` continue to operate over the pnpm workspace (apps/api + shared/\*) only.
- `.husky/pre-commit` — Branches on `git diff --cached --name-only --diff-filter=ACMR | grep '^apps/mobile/'`. Always runs root `pnpm exec lint-staged` + `pnpm typecheck`. Additionally runs `apps/mobile`-side lint-staged when (a) at least one mobile file is staged AND (b) `apps/mobile/package.json` declares a `lint-staged` field. Plan 02-13 will land that config.
- `pnpm-lock.yaml` — Auto-shrunk by `pnpm install` (~5.9k lines removed) when the mobile dep tree left the workspace.

## Decisions Made

- **Comment-substring discipline:** dropped the literal `apps/mobile` substring from `pnpm-workspace.yaml` and the literal `pnpm` token from `mobile-ci.yml` comments because the plan acceptance greps are intentionally substring-based (`grep -E "apps/mobile" pnpm-workspace.yaml` and `grep -q "pnpm" mobile-ci.yml`). Both files now use generic phrasing ("the mobile package", "npm + actions/setup-node") so the greps return zero matches without losing reviewer context. **Why:** the plan body explicitly defines the verify command as `! grep -q "apps/mobile" pnpm-workspace.yaml`, treating any substring as a workspace declaration; matching that intent is more important than a verbose comment.
- **No mobile lint-staged config landed in this plan.** Plan 02-13 (mobile shell scaffolding) is the natural place to define which file globs run which formatters/linters inside `apps/mobile`. The pre-commit hook is structured so mobile commits succeed today (the `package.json["lint-staged"]` existence gate falls through silently) and pick up the config the moment plan 02-13 declares it.
- **Did NOT attempt the full Gradle `assembleApkRolloutDebug` build inside the worktree.** Per plan Task 2 explicit guidance: "what we verify is that the path-resolution-stage passes." Path resolution is verified directly by the directory existence of `apps/mobile/node_modules/@react-native/gradle-plugin` (referenced by `apps/mobile/android/settings.gradle` via `../../../node_modules/@react-native/gradle-plugin`). The worktree environment is also unsuitable: JDK 26 (not 17), `ANDROID_HOME` unset. The full apkRolloutDebug build runs on the developer machine + CI at the Task 4 operator-smoke checkpoint.
- **`apps/mobile/package.json` did not previously declare any `workspace:*` ref to `@humyn/shared-types`** — Phase 1 mobile scaffold's deps did not need it. Adding the `file:` link in this plan is forward-looking: future Phase 2 plans (e.g., 02's CompatResult schema landing in `shared/types/src/CompatResult.ts`) will import from `@humyn/shared-types` via this link.

## Deviations from Plan

None — all task acceptance criteria pass exactly as written. The two comment-rewordings (in `pnpm-workspace.yaml` and `mobile-ci.yml`) are NOT deviations; they are the natural consequence of the plan's strict substring-grep acceptance commands and were noted in the commit messages.

**Total deviations:** 0
**Impact on plan:** All 3 executable tasks landed under their plan-body acceptance commands; Task 4 is a `checkpoint:human-verify` deferred to the operator.

## Issues Encountered

- **Plan acceptance grep matched a literal in a comment.** The first iteration of `pnpm-workspace.yaml` included a comment containing the substring `apps/mobile`, which the plan's own automated check (`! grep -q "apps/mobile" pnpm-workspace.yaml`) flagged as a fail. Resolved by rewording the comment to use generic phrasing ("the mobile package"). Same shape repeated for `pnpm` in `mobile-ci.yml` comments. Resolved before any commit was finalised.

## Threat Flags

None — this plan does not introduce any new endpoints, auth paths, file-access patterns, or schema mutations at trust boundaries. The only network surfaces it touches are the npm registry (Threat T-2.1-01, mitigated by the committed lockfile + integrity hashes) and the local `file:` link to `shared/types` (Threat T-2.1-02, accepted as a same-trust-boundary path).

## Self-Check: PASSED

- File `apps/mobile/.gitignore` — FOUND
- File `apps/mobile/package-lock.json` — FOUND (lockfileVersion 3, ~380 KB)
- File `.github/workflows/mobile-ci.yml` — FOUND
- File `pnpm-workspace.yaml` modification — VERIFIED (`apps/api` + `shared/*` only, no `apps/mobile`)
- File `apps/mobile/package.json` modification — VERIFIED (`packageManager: npm@10.9.0` + `@humyn/shared-types: file:../../shared/types`)
- File `package.json` modification — VERIFIED (3 new mobile:\* scripts)
- File `.husky/pre-commit` modification — VERIFIED (mobile-staged-file branch added)
- Commit `8ef39b8` — FOUND in git log
- Commit `1a7051d` — FOUND in git log
- Commit `ecbfe96` — FOUND in git log
- Plan automated verifies (Task 1, Task 2, Task 3) — all exit 0

## Checkpoint State (Task 4 — `checkpoint:human-verify`)

**Type:** human-verify
**Plan:** 02-01
**Progress:** 3 / 4 tasks complete

### Completed Tasks

| Task | Name                                                 | Commit  | Key files                                                                             |
| ---- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| 1    | Drop apps/mobile from pnpm workspace                 | 8ef39b8 | pnpm-workspace.yaml, apps/mobile/package.json, apps/mobile/.gitignore, pnpm-lock.yaml |
| 2    | Generate npm lockfile + verify Gradle relative-paths | 1a7051d | apps/mobile/package-lock.json                                                         |
| 3    | Root scripts + Husky scoping + mobile-ci.yml         | ecbfe96 | package.json, .husky/pre-commit, .github/workflows/mobile-ci.yml                      |

### Current Task

**Task 4 — Operator smoke: clean checkout npm install + Gradle build**

Status: awaiting verification on the developer machine + first-PR CI run.

### Awaiting (Operator)

On a clean clone (or after `rm -rf apps/mobile/node_modules`):

1. `cd apps/mobile && npm ci` — must succeed end-to-end with no errors.
2. `cd apps/mobile && npm run typecheck` — Phase 1 mobile code is already typecheck-clean.
3. `cd apps/mobile && npm run test` — Phase 1 vitest suite must pass.
4. `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` — should produce `apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`. Requires JDK 17 + `ANDROID_HOME` exported.
5. From repo root: `pnpm install && pnpm typecheck && pnpm test` — backend + shared still pass (regression check).
6. Push the branch and verify `mobile-ci.yml` workflow runs (both jobs green) on the PR.

Resume signal: type "approved" if all 6 steps pass, or describe failures (especially Gradle path-resolution errors).

## User Setup Required

None — no new external service configuration. The only environmental dependencies (JDK 17, ANDROID_HOME, Gradle wrapper) already exist in the Phase 1 STATE.md resume path.

## Next Phase Readiness

- **Phase 2 plans 02-02..02-N are unblocked** the moment Task 4 receives the operator "approved" — D-PKG-07 marks 02-01 BLOCKING for the rest of Phase 2.
- **Mobile-side foundation in place** for plan 02-13's RN dependency additions (React Navigation v7, Zustand, lucide-react-native, react-native-asset, react-native-permissions) — they will install through `npm install` from inside `apps/mobile/` and re-mint `package-lock.json` cleanly.
- **`shared/types/src/CompatResult.ts`** (planned for plan 02-02 or wherever the Compat domain lands) will be importable from mobile via `import { CompatResultSchema } from '@humyn/shared-types'` because the `file:` link is in place.
- **Phase 1 historical docs (D-PKG-06)** intentionally not rewritten. They describe the state at Phase 1's timestamp — accurate at that time. Phase 2 readers find the migration rationale here.

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed (Tasks 1-3): 2026-05-09_
_Checkpoint pending: Task 4 operator smoke_
