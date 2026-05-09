---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 01
id: 02-01-mobile-npm-migration
name: Mobile package-manager migration (pnpm → npm)
type: execute
wave: 0
depends_on: []
files_modified:
  - pnpm-workspace.yaml
  - apps/mobile/package.json
  - apps/mobile/package-lock.json
  - apps/mobile/.gitignore
  - .github/workflows/mobile-ci.yml
  - .husky/pre-commit
  - package.json
autonomous: false
requirements: []
must_haves:
  truths:
    - 'apps/mobile is no longer a pnpm workspace member'
    - 'apps/mobile installs via npm with a committed package-lock.json'
    - 'shared/types is consumed by mobile via file: dependency, not workspace: protocol'
    - 'Backend (apps/api) and shared/* still install via pnpm at the root with no regression'
    - 'CI exercises npm ci + Gradle assembleApkRolloutDebug on every mobile-touching PR'
  artifacts:
    - path: 'apps/mobile/package-lock.json'
      provides: 'npm lockfile for mobile package'
      contains: 'lockfileVersion'
    - path: 'pnpm-workspace.yaml'
      provides: 'workspace declaration WITHOUT apps/mobile'
      contains: 'apps/api'
    - path: '.github/workflows/mobile-ci.yml'
      provides: 'Mobile-only CI workflow (npm + Gradle)'
      contains: 'npm ci'
  key_links:
    - from: 'apps/mobile/package.json'
      to: 'shared/types'
      via: '"@humyn/shared-types": "file:../../shared/types" dependency'
      pattern: '"@humyn/shared-types": "file:'
    - from: '.github/workflows/mobile-ci.yml'
      to: 'apps/mobile/package-lock.json'
      via: 'actions/setup-node cache-dependency-path'
      pattern: 'cache-dependency-path: apps/mobile/package-lock.json'
---

<objective>
Isolate `apps/mobile/` from the pnpm workspace and migrate it to npm with a committed `package-lock.json` and a `file:` link to `shared/types`. Establishes the foundation for the rest of Phase 2 — D-PKG-07 makes this BLOCKING for every other plan.

Purpose: pnpm's symlink-heavy `node_modules` layout breaks RN 0.83 + Hermes new-arch autolinking and Gradle relative-path resolution, producing recurring build failures. Flat npm `node_modules` matches Metro/Gradle assumptions verbatim. Backend + shared stay on pnpm — surgery is scoped to mobile.
Output: a clean `npm ci` + `cd android && ./gradlew assembleApkRolloutDebug` cycle on a fresh checkout, plus a dedicated `mobile-ci.yml` that runs the same on every PR.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/package.json
@apps/mobile/android/settings.gradle
@pnpm-workspace.yaml
@.github/workflows/api-ci.yml
</context>

<threat_model>

## Trust Boundaries

| Boundary                 | Description                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| local dev → npm registry | npm pulls third-party tarballs; lockfile + integrity hashes are the sole authentication |
| CI → npm registry        | same, in CI; no secrets crossed                                                         |

## STRIDE Threat Register

| Threat ID | Category    | Component                 | Disposition | Mitigation Plan                                                                                                                                                                 |
| --------- | ----------- | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.1-01  | Tampering   | npm dependency tarballs   | mitigate    | `npm ci --ignore-scripts` is NOT used (RN postinstalls required) but `package-lock.json` is committed and includes integrity SHA-512 hashes; CI uses `npm ci` (lockfile-strict) |
| T-2.1-02  | Tampering   | shared/types `file:` link | accept      | local file path; no network surface; same trust boundary as the rest of the monorepo                                                                                            |
| T-2.1-03  | Repudiation | mobile-ci.yml             | accept      | GitHub Actions log retention + commit signing on workflow file changes; no separate audit needed for a CI config file                                                           |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Surgery — drop apps/mobile from pnpm workspace</name>
  <files>pnpm-workspace.yaml, apps/mobile/.gitignore, apps/mobile/package.json</files>
  <read_first>
    - pnpm-workspace.yaml (current shape — confirm apps/mobile is in `packages:`)
    - apps/mobile/package.json (current pnpm form — note `"@humyn/shared-types": "workspace:*"` if present)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § "Mobile package-manager migration" (D-PKG-01..07)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "Domain: Package-manager migration"
  </read_first>
  <action>
    1. Edit `pnpm-workspace.yaml`: remove the `apps/mobile` glob entry. Final `packages:` MUST contain exactly: `apps/api`, `shared/*`. Preserve any other entries verbatim.
    2. Edit `apps/mobile/package.json`:
       - Replace any `"@humyn/shared-types": "workspace:*"` (or `"workspace:^"`) with `"@humyn/shared-types": "file:../../shared/types"`.
       - Add `"packageManager": "npm@10.9.0"` field at top level (next to `"name"`/`"version"`) — locks the package manager for this directory.
       - Confirm `"private": true` is present.
    3. Edit `apps/mobile/.gitignore`: ensure it does NOT exclude `package-lock.json`. If a line `package-lock.json` exists, remove it. Add a comment `# package-lock.json is COMMITTED for npm reproducibility (D-PKG-02)` at top.
    4. Run `pnpm install` from repo root and confirm `apps/mobile` is no longer listed in the workspace summary. If pnpm fails to drop it, manually remove `apps/mobile/node_modules/` and re-run.
  </action>
  <acceptance_criteria>
    - `grep -E "apps/mobile" pnpm-workspace.yaml` returns NO match (apps/mobile fully removed).
    - `grep -E "workspace:" apps/mobile/package.json` returns NO match.
    - `grep -E "\"@humyn/shared-types\":\\s*\"file:\\.\\./\\.\\./shared/types\"" apps/mobile/package.json` matches once.
    - `grep -E "\"packageManager\":\\s*\"npm@" apps/mobile/package.json` matches once.
    - `pnpm install` from repo root succeeds and reports a workspace member count of `apps/api + shared/*` only (no apps/mobile).
  </acceptance_criteria>
  <verify>
    <automated>! grep -q "apps/mobile" pnpm-workspace.yaml && grep -q "\"@humyn/shared-types\": \"file:../../shared/types\"" apps/mobile/package.json && grep -q "\"packageManager\": \"npm@" apps/mobile/package.json</automated>
  </verify>
  <done>pnpm-workspace.yaml no longer references apps/mobile; apps/mobile/package.json has the `file:` link and explicit `packageManager: npm@10.9.0`; root `pnpm install` clean.</done>
</task>

<task type="auto">
  <name>Task 2: Generate the npm lockfile + verify Gradle relative-paths still resolve</name>
  <files>apps/mobile/package-lock.json (NEW), apps/mobile/node_modules/ (regenerated)</files>
  <read_first>
    - apps/mobile/package.json (post Task 1 edits)
    - apps/mobile/android/settings.gradle (confirm `../../../node_modules/...` references — these MUST work under flat npm node_modules)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-PKG-07 task list
    - .planning/research/STACK.md (confirm RN 0.83 + Hermes new-arch dep matrix)
  </read_first>
  <action>
    1. From repo root: `rm -rf apps/mobile/node_modules` (clean slate; pnpm-style symlinks would otherwise confuse npm).
    2. `cd apps/mobile && npm install` (no `--no-save` — this generates `package-lock.json`).
    3. Confirm `apps/mobile/node_modules/.package-lock.json` exists and `apps/mobile/node_modules/@humyn/shared-types/` resolves to a real file tree (npm's `file:` install copies; it does NOT symlink by default for `file:` paths in lockfile mode).
    4. Confirm `apps/mobile/node_modules/react-native/` exists (no `.pnpm/` directory anywhere in the tree).
    5. Stage and commit `apps/mobile/package-lock.json`.
    6. Run `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug --offline` to confirm Gradle's `../../../node_modules/...` relative paths still resolve under the flat npm tree. (The build may fail later in the chain on missing native modules — that's acceptable here; what we verify is that the path-resolution-stage passes. Capture the build log; if `Could not find` errors are NOT path-resolution errors, mark passing.)
       - If Gradle fails with `node_modules/...not found`, fix by adjusting `apps/mobile/android/settings.gradle` `rootProject.projectDir` references to point at the npm-flat layout (Phase 1 already used `../../../node_modules`; should not need changes).
  </action>
  <acceptance_criteria>
    - `apps/mobile/package-lock.json` exists, file size > 50 KB, contains `"lockfileVersion": 3`.
    - `test -d apps/mobile/node_modules/react-native` returns 0.
    - `test ! -d apps/mobile/node_modules/.pnpm` returns 0 (pnpm tree absent).
    - `test -d apps/mobile/node_modules/@humyn/shared-types` returns 0.
    - `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug --offline` either succeeds OR fails with errors that are NOT relative-path resolution errors. (`grep -E "Could not find.*node_modules" gradle.log` returns no matches.)
  </acceptance_criteria>
  <verify>
    <automated>test -f apps/mobile/package-lock.json && test -d apps/mobile/node_modules/react-native && test ! -d apps/mobile/node_modules/.pnpm && grep -q '"lockfileVersion": 3' apps/mobile/package-lock.json</automated>
  </verify>
  <done>package-lock.json committed; flat npm node_modules in place; Gradle relative-path resolution still finds the node_modules tree (build may fail downstream on dependency-introduction concerns; that's a future-task problem).</done>
</task>

<task type="auto">
  <name>Task 3: Update root scripts, lint-staged/Husky, CI workflow</name>
  <files>package.json, .husky/pre-commit, .github/workflows/mobile-ci.yml (NEW)</files>
  <read_first>
    - package.json (root — see existing root scripts: `lint`, `typecheck`, `test`)
    - .husky/pre-commit (current shape)
    - .github/workflows/api-ci.yml (analog template per 02-PATTERNS.md)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-PKG-04, D-PKG-05
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § ".github/workflows/mobile-ci.yml" (NEW) lines 798-855
  </read_first>
  <action>
    1. Edit root `package.json` (no install side-effects — only script changes):
       - Add a new root script `"mobile:install": "cd apps/mobile && npm ci"`.
       - Add `"mobile:test": "cd apps/mobile && npm run test"`.
       - Add `"mobile:typecheck": "cd apps/mobile && npm run typecheck"`.
       - DO NOT change root `lint`/`typecheck`/`test` — those continue to operate over pnpm workspace members (apps/api + shared/*) only.
    2. Edit `.husky/pre-commit`: if it currently calls a global `pnpm lint-staged` that walks the entire repo including apps/mobile, scope it. Replace the body so:
       - For staged files matching `apps/mobile/**`: run `cd apps/mobile && npx --no-install lint-staged --concurrent false` (lint-staged config inside apps/mobile; if absent, skip — file the lint-staged config addition as a follow-up task in a later mobile plan).
       - For all other staged files: keep existing `pnpm lint-staged` invocation.
       - Use a simple branch on `git diff --cached --name-only --diff-filter=ACMR | grep -q '^apps/mobile/'` to choose. (For Phase 2 simplicity, if the existing pre-commit hook is trivial, just run BOTH lint-staged invocations — that's acceptable given the small repo.)
    3. Create `.github/workflows/mobile-ci.yml` verbatim from the template in 02-PATTERNS.md lines 798-855. Specifically:
       - Trigger: `on.pull_request.paths: ['apps/mobile/**', 'shared/types/**', '.github/workflows/mobile-ci.yml']` plus `on.push.branches: [main]`.
       - Two jobs: `lint-typecheck-test` (Node 22, npm cache keyed on `apps/mobile/package-lock.json`, runs `npm ci && npm run typecheck && npm run lint && npm run test`) and `android-build` (depends on first, sets up JDK 17 Temurin + Node 22, runs `npm ci`, then `cd android && ./gradlew :app:testApkRolloutDebugUnitTest && ./gradlew assembleApkRolloutDebug && cd .. && bash scripts/verify-merged-manifests.sh`).
       - NO pnpm references anywhere in this workflow — mobile is npm-only post-migration.
    4. Confirm existing `.github/workflows/api-ci.yml` does NOT touch `apps/mobile` (it shouldn't — its `paths` should already exclude it; if it triggers on mobile changes, narrow its `paths` to `apps/api/**`, `shared/**`).
  </action>
  <acceptance_criteria>
    - `grep -q "\"mobile:test\"" package.json` matches.
    - `test -f .github/workflows/mobile-ci.yml` returns 0.
    - `grep -c "npm ci" .github/workflows/mobile-ci.yml` returns ≥ 2 (lint job + android job).
    - `grep -q "pnpm" .github/workflows/mobile-ci.yml` returns NO matches (file MUST NOT mention pnpm).
    - `grep -q "cache-dependency-path: apps/mobile/package-lock.json" .github/workflows/mobile-ci.yml` matches.
    - `grep -q "actions/setup-java" .github/workflows/mobile-ci.yml` matches with `java-version: '17'`.
    - `.husky/pre-commit` runs without error on a synthetic commit touching `apps/mobile/package.json` (manual smoke acceptable).
  </acceptance_criteria>
  <verify>
    <automated>test -f .github/workflows/mobile-ci.yml && grep -q "npm ci" .github/workflows/mobile-ci.yml && ! grep -q "pnpm" .github/workflows/mobile-ci.yml && grep -q "cache-dependency-path: apps/mobile/package-lock.json" .github/workflows/mobile-ci.yml && grep -q "\"mobile:test\"" package.json</automated>
  </verify>
  <done>Root scripts expose mobile commands without entangling root pnpm; pre-commit hook respects the boundary; mobile-ci.yml is npm-only and exercises both lint+test and Gradle assembleApkRolloutDebug.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Operator smoke — clean checkout npm install + Gradle build</name>
  <what-built>
    Mobile package isolated from pnpm workspace; npm-managed with committed lockfile; CI workflow added.
  </what-built>
  <how-to-verify>
    On a clean clone of the repo (or after `git clean -fdx apps/mobile/node_modules` and `rm -rf apps/mobile/node_modules`):
    1. `cd apps/mobile && npm ci` — must succeed end-to-end with no errors.
    2. `cd apps/mobile && npm run typecheck` — should succeed (Phase 1 mobile code is already typecheck-clean).
    3. `cd apps/mobile && npm run test` — Phase 1 vitest suite must pass.
    4. `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` — should produce a signed `apkRollout-debug` APK at `apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`.
    5. From repo root: `pnpm install && pnpm typecheck && pnpm test` — backend + shared still pass (regression check).
    6. Push the branch and verify `mobile-ci.yml` workflow runs (both jobs green) on the PR.
  </how-to-verify>
  <resume-signal>Type "approved" if all 6 steps pass, or describe failures (especially Gradle path-resolution errors).</resume-signal>
</task>

</tasks>

<verification>
- pnpm-workspace.yaml does not contain `apps/mobile`.
- `apps/mobile/package.json` declares `"@humyn/shared-types": "file:../../shared/types"`.
- `apps/mobile/package-lock.json` is committed.
- `apps/mobile/node_modules` is npm-flat (no `.pnpm/`).
- `.github/workflows/mobile-ci.yml` exists and is npm-only.
- Phase 1 backend + mobile tests still pass after migration.
</verification>

<success_criteria>

- D-PKG-01..07 all implemented.
- Operator-confirmed clean `npm ci` + Gradle `assembleApkRolloutDebug` on a fresh checkout.
- `mobile-ci.yml` workflow runs green on a PR.
- No regression in backend (`apps/api`) or `shared/*` workspace state.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-01-SUMMARY.md` capturing the migration delta, any unexpected Gradle wiring fixes, and a brief note for future readers explaining D-PKG-06 (why Phase 1 historical docs are NOT rewritten).
</output>
