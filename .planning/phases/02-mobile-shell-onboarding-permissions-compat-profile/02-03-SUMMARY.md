---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 03
subsystem: state
tags:
  [
    zustand,
    mmkv,
    hydrate,
    gate-decision-tree,
    compat-result,
    shared-types,
    zod,
    auth-11,
  ]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'Phase 2 RN-ecosystem deps installed at exact pins (zustand 5.0.2, react-native-mmkv 4.3.1); vitest.setup.ts mocks both MMKV class + createMMKV factory pointing at one shared in-memory store; design-token / primitive surface available'
provides:
  - 'apps/mobile/src/state/mmkv.ts — single secureMmkv singleton (humyn.secure / humyn-mmkv-v1) consumed by every Phase 2 service'
  - 'apps/mobile/src/state/keys.ts — versioned MMKV key constants (AUTH_JWT, ONBOARDING_*, INSTALLATION_ID, COMPAT_LAST_RESULT, APP_VERSION_CACHE, TELEMETRY_RING) + softBannerDismissKey(latest) helper'
  - 'apps/mobile/src/state/appStore.ts — Zustand store typed as AppState with persisted onboarding fields + transient upgrade flags + 12 actions (setJwt, signOut, setConsent, setPermsGranted, setCompatResult, clearCompatPassed, setTutorialDone, setInstallationId, setAppVersionCache, setSoftUpgradeAvailable, setForceUpgradeBlocked, plus state setter)'
  - 'apps/mobile/src/state/hydrate.ts — synchronous MMKV→Zustand boot hydration with safe-parse + Zod-shape validation on compat blob (graceful degrade on malformed/version-skewed data)'
  - 'apps/mobile/src/state/initialRoute.ts — pure computeInitialRoute(state, currentCompatSignature) returning the navigator initialRoute per RESEARCH gate-decision tree (forceUpgrade → Splash → Permissions → Compat → RigTutorial → MainTabs); satisfies AUTH-11 via signature staleness check'
  - 'shared/types/src/CompatResult.ts — Zod schema CompatResultSchema + CompatChecksSchema verbatim from D-COMPAT-05; exported from index + SHARED_TYPES_VERSION bumped 0.5.0 → 0.6.0'
affects:
  - 'plan 02-04 (auth + sign-up screen): consumes useAppStore.setJwt + setConsent on success'
  - 'plan 02-05 (App.tsx navigator skeleton): hydrate() + computeInitialRoute() drive initialRouteName at mount'
  - 'plan 02-06 (compat screen + service): writes via setCompatResult(); reads compatLastResult for diagnostic UI'
  - 'plan 02-08 (versionService): reads/writes appVersionCache; sets softUpgradeAvailable / forceUpgradeBlocked'
  - 'plan 02-16 (installationId service): consumes secureMmkv + KEYS.INSTALLATION_ID; setInstallationId() round-trips through MMKV'
  - 'plan 02-20 (telemetry ring): consumes secureMmkv + KEYS.TELEMETRY_RING'
  - 'every Phase 2 service test: vi.mock-of-the-store seam established here, no per-test MMKV redeclaration'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern: secureMmkv singleton at apps/mobile/src/state/mmkv.ts is the ONLY MMKV instance constructed in the app. Every persistent-state owner (auth, compat, version, installationId, telemetry) imports the singleton — `grep -E "createMMKV\(|new MMKV\(" apps/mobile/src/**/*.ts` MUST return zero matches outside src/state/mmkv.ts.'
    - 'Pattern: KEYS object at apps/mobile/src/state/keys.ts is the canonical key registry. New keys land here with the `.v1` suffix; schema breaks bump to `.v2` and add a fresh constant rather than mutating in place. Per-version keys (e.g. soft-banner dismiss-per-latest-version) come from helper functions that take the version string as a parameter.'
    - 'Pattern: setCompatResult() always persists the full result + the smaller compatPassed summary (or clears compatPassed when passed=false). Splitting the persisted state lets the gate-decision tree read a 2-field summary instead of a 30-field schema, while keeping the full diagnostic blob for the fail screen.'
    - 'Pattern: hydrate() runs JSON.parse THEN CompatResultSchema.safeParse on the compat blob. A JSON-valid-but-shape-broken blob (e.g. an old schema before this plan landed) degrades to null + a warning rather than crashing the navigator at boot. If the full result fails, the smaller compat-passed summary is also treated as cleared — never trust a half-good compat-state.'
    - 'Pattern: computeInitialRoute() is a pure function over AppState. Tests construct synthetic state shapes without touching the live store. AUTH-11 manifests as `compatPassed.signature !== currentCompatSignature` when the caller has a fresh signature; null currentCompatSignature trusts the stored pass (offline-boot UX over false-positive re-runs).'
    - 'Pattern: Zustand actions always call MMKV first, then `set({...})`. Order matters because Zustand subscribers run synchronously after set() — they must see a state where in-memory and on-disk match.'

key-files:
  created:
    - 'apps/mobile/src/state/mmkv.ts (15 LOC) — secureMmkv singleton via createMMKV (matches Phase 1 + 02-PATTERNS; v4 nitro API)'
    - 'apps/mobile/src/state/keys.ts (24 LOC) — KEYS object + softBannerDismissKey helper'
    - 'apps/mobile/src/state/appStore.ts (140 LOC) — Zustand store + 12 actions'
    - 'apps/mobile/src/state/hydrate.ts (84 LOC) — sync MMKV→Zustand boot'
    - 'apps/mobile/src/state/initialRoute.ts (66 LOC) — pure gate-decision tree'
    - 'shared/types/src/CompatResult.ts (39 LOC) — Zod schema verbatim from D-COMPAT-05'
    - 'apps/mobile/__tests__/state/appStore.test.ts (4 cases) — fresh defaults, setCompatResult passed/failed sides, signOut'
    - 'apps/mobile/__tests__/state/hydrate.test.ts (3 cases) — jwt+installation_id pass-through, valid CompatResult, malformed JSON graceful degrade'
    - 'apps/mobile/__tests__/state/initialRoute.test.ts (9 cases) — forceUpgrade, no-JWT, perms missing/partial, AUTH-11 stale signature, no-compat-pass, tutorial gate, all-green MainTabs, offline-boot null-signature trust path'
  modified:
    - 'apps/mobile/src/services/auth.ts — refactored: drops the local createMMKV call + JWT_KEY literal; imports singleton from `../state/mmkv` and KEYS.AUTH_JWT from `../state/keys`. No behavioral change; Phase 1 SignIn tests still pass 3/3.'
    - 'shared/types/src/index.ts — added `export * from "./CompatResult.js";` and bumped SHARED_TYPES_VERSION 0.5.0 → 0.6.0.'

key-decisions:
  - 'Used `createMMKV` factory in apps/mobile/src/state/mmkv.ts, NOT `new MMKV(...)` as the plan body suggested. Reason: react-native-mmkv@4.3.1 (Nitro modules) exports `MMKV` as a TYPE only — its runtime export is `createMMKV(config)`. The plan body example would fail at runtime with `MMKV is not a constructor`. Phase 1 auth.ts and 02-PATTERNS.md Shared Pattern 1 both use the factory form; followed runtime/patterns over plan-body code-text. Marked as Rule 1 (bug) deviation; the singleton mmkv.ts header documents it.'
  - 'Used `secureMmkv.remove(...)` for deletions, NOT `secureMmkv.delete(...)` as the plan body suggested. Reason: same Nitro API constraint — the runtime MMKV interface exposes `remove(key)` (returns boolean), not `delete(key)`. The vitest mock supports BOTH for forward-compat, but production runtime would crash on `delete()`. The 02-PATTERNS.md service-test pattern (line 619) also uses `remove`.'
  - 'Skipped the plan body Step 3-of-Task-2 `pnpm --filter @humyn/shared-types build` instruction. Reason: shared/types has no build script — its package.json `main` and `types` both point at `src/index.ts` (TypeScript-source-as-import via tsc moduleResolution: Bundler). The downstream apps/mobile already consumes via the file: link in place since 02-01; no re-install needed. Verified via vitest smoke-import that CompatResultSchema, CompatChecksSchema, and SHARED_TYPES_VERSION are reachable at test runtime.'
  - 'Hydrate() treats an unparseable compat.lastResult.v1 blob as a signal that the smaller compatPassed summary is also suspect and should be cleared — even when compatPassed itself parsed OK. Reason: the two values are written together by setCompatResult() so they should always agree; a broken full-result blob means tampering or a partial write, both of which should force a re-run rather than risking a stale signature pass. This is a Rule 2 mitigation of T-2.3-01 (tampered compat-pass) at the hydrate layer.'
  - 'computeInitialRoute() trusts the stored compatPassed when currentCompatSignature is null (offline boot, signature-compute failure). Reason: forcing a re-run on every transient init failure (compatService crashed during onMount, etc.) would be far worse UX than trusting the last known-good signature for the boot. AUTH-11 is the only signature mismatch that must trip the gate, and that requires a NON-null fresh signature to compare against. Behavior captured by initialRoute.test.ts Test 11b.'
  - 'Added 5 sub-cases beyond the plan-stated 11 tests (Test 2b failed-side, Test 4b valid-CompatResult-parse, Test 8b partial-perms, Test 9b no-compat-pass, Test 11b null-signature offline-boot). Each covers a real branch in the source that the original 11 don\'t exercise. Net 16 state tests; full mobile suite 29/29 green.'

patterns-established:
  - 'Pattern: `secureMmkv` singleton is the canonical handle. `apps/mobile/src/services/auth.ts` no longer constructs its own instance — it imports the same handle. Future Phase 2 services (compatService, versionService, installationId, telemetryRing) follow the same import path.'
  - 'Pattern: state-test seam — tests in `__tests__/state/` exercise the real store + real hydrate against the canonical react-native-mmkv mock from vitest.setup.ts. No per-test mock redeclarations.'
  - 'Pattern: gate-decision tree as a pure function. computeInitialRoute(state, currentSig) takes both the hydrated state AND a freshly-computed signature so the AUTH-11 mismatch detection is observable in unit tests without faking installation_id/Build.FINGERPRINT plumbing.'
  - 'Pattern: shared/types is consumed at TS-source level (no build step). New schemas land in shared/types/src/<Name>.ts, get re-exported through src/index.ts with the .js extension (matches existing entries — TS resolves the .js → .ts via moduleResolution: Bundler), and bump SHARED_TYPES_VERSION.'

requirements-completed: [AUTH-07, AUTH-11, COMPAT-04, COMPAT-05, COMPAT-06]

# Metrics
duration: ~30min
completed: 2026-05-09
---

# Phase 2 Plan 03: State store and hydration — Summary

**Three new source modules under apps/mobile/src/state/ (mmkv singleton, KEYS registry, Zustand store, hydrate, initialRoute), plus the shared/types CompatResult Zod schema. Zustand store hydrates from MMKV synchronously at boot; gate-decision tree returns the navigator initialRoute with AUTH-11 cross-device compat re-run satisfied via signature staleness — no backend round-trip. Phase 1 auth.ts refactored to consume the singleton; full mobile suite 29/29 green.**

## Performance

- **Duration:** ~30 min including TDD red/green for the Zustand layer
- **Tasks:** 3 of 3 executed (Tasks 1, 2, 3 all autonomous)
- **Commits:** 4 (Task 1, Task 2, Task 3 RED tests, Task 3 GREEN sources)
- **Files created:** 9 (5 sources + 1 shared schema + 3 test files)
- **Files modified:** 2 (`apps/mobile/src/services/auth.ts`, `shared/types/src/index.ts`)
- **Lines added/changed:** ~735 insertions across 4 commits

## Accomplishments

- **Singleton MMKV + KEYS registry in place (Task 1).** Every Phase 2 persistent-state owner now has a single import path. `apps/mobile/src/services/auth.ts` is the first consumer — its 3 lines of MMKV setup compress to one import. The `humyn.secure` instance ID + `humyn-mmkv-v1` encryption key are unchanged (zero migration risk for Phase 1 users on dogfood builds).
- **CompatResult schema in shared/types (Task 2).** D-COMPAT-05 is now the single contract between compatService (Phase 2.06), the fail screen (Phase 2.06+), and the gate-decision tree (this plan). 12 per-check fields verbatim from CONTEXT.md; SHARED_TYPES_VERSION bumped 0.5.0 → 0.6.0 so any consumer that later checks the version sees the bump.
- **Zustand store + hydrate + initialRoute ship with 16 unit tests (Task 3).** TDD red→green executed cleanly: RED phase committed first (3 test files importing missing source modules → 3 failures + 1 typecheck error per file); GREEN phase committed once tests passed. Full mobile suite 29/29 green afterwards.
- **AUTH-11 satisfied client-side.** A new install on a new device (fresh installation_id → fresh signature) walks straight from sign-in to Compat without any server round-trip. Test 9 in initialRoute.test.ts pins the behavior.
- **No regressions to 02-01 contributions.** `apps/mobile/android/settings.gradle` still uses `../node_modules/@react-native/gradle-plugin`; `apps/mobile/metro.config.js` still has the narrow `watchFolders: [sharedTypesRoot]` only (no `disableHierarchicalLookup`, no `workspaceRoot`).

## Task Commits

Each task committed atomically:

1. **Task 1: Singleton MMKV + KEYS** — `ead12cf` (feat)
2. **Task 2: CompatResult Zod schema in shared/types** — `e8cd0ed` (feat)
3. **Task 3 RED: failing tests for store/hydrate/initialRoute** — `6995814` (test)
4. **Task 3 GREEN: store/hydrate/initialRoute implementations** — `298d7b1` (feat)

_Plan was `autonomous: true` with `tdd: true` on Task 3. RED/GREEN/REFACTOR sequence: RED + GREEN both committed; no REFACTOR commit needed — the implementation came in clean and tests green on first run after the source landed._

## Files Created/Modified

### Created

- `apps/mobile/src/state/mmkv.ts` (15 LOC) — secureMmkv singleton via createMMKV. Header comment documents the runtime API (Nitro modules export MMKV as a type only).
- `apps/mobile/src/state/keys.ts` (24 LOC) — KEYS registry + softBannerDismissKey(latest) helper. All 9 Phase 2 persistent keys declared with `.v1` suffix.
- `apps/mobile/src/state/appStore.ts` (140 LOC) — Zustand store typed as AppState. 8 persisted fields + 2 transient + 12 actions. setCompatResult writes both the full blob AND the smaller compat-passed summary (or clears the summary when passed=false).
- `apps/mobile/src/state/hydrate.ts` (84 LOC) — synchronous MMKV→Zustand boot. Each blob safe-parses; the compat blob additionally Zod-validates. Console.warns on every degrade so dev-builds surface the issue without crashing.
- `apps/mobile/src/state/initialRoute.ts` (66 LOC) — pure computeInitialRoute(state, currentCompatSignature) returning the discriminated-union InitialRoute type. Comment block explains the 6-step gate sequence + AUTH-11 satisfaction model + offline-boot caveat.
- `shared/types/src/CompatResult.ts` (39 LOC) — CompatChecksSchema + CompatResultSchema. Verbatim from CONTEXT.md D-COMPAT-05 (12 check fields including ultrawide dFOV, IMU sustained Hz, IMU p99 ms, root verdict, free-storage GB).
- `apps/mobile/__tests__/state/appStore.test.ts` — 4 cases.
- `apps/mobile/__tests__/state/hydrate.test.ts` — 3 cases.
- `apps/mobile/__tests__/state/initialRoute.test.ts` — 9 cases.

### Modified

- `apps/mobile/src/services/auth.ts` — drops the local `createMMKV({...})` + `JWT_KEY` literal; now imports `secureMmkv` from `../state/mmkv` and `KEYS.AUTH_JWT` from `../state/keys`. Behavior identical; the JWT round-trip is byte-equivalent. Phase 1 SignIn tests pass unchanged.
- `shared/types/src/index.ts` — added `export * from './CompatResult.js';` and bumped `SHARED_TYPES_VERSION` 0.5.0 → 0.6.0.

## Decisions Made

- **`createMMKV` factory, not `new MMKV(...)`.** react-native-mmkv@4.3.1 exports `MMKV` as a TYPE only (Nitro modules); the runtime entry is `createMMKV(config)`. The plan body example would fail at runtime with `MMKV is not a constructor`. Phase 1 auth.ts and 02-PATTERNS.md Shared Pattern 1 both use the factory form. Followed runtime + patterns; documented inline in mmkv.ts header.
- **`remove`, not `delete`, for MMKV deletions.** Same root cause — the Nitro `MMKV` interface exposes `remove(key)`, not `delete(key)`. The vitest mock supports both for forward-compat, but production would crash on `delete()`. The 02-PATTERNS service-test pattern (line 619) also uses `remove`.
- **Skipped the `pnpm --filter @humyn/shared-types build` step.** No build script exists — `package.json` `main`/`types` both point at `src/index.ts` and downstream consumers compile via tsc with `moduleResolution: Bundler`. The file: link from apps/mobile is already in place since 02-01. Verified end-to-end via a vitest smoke-import (CompatResultSchema reachable + parseable).
- **hydrate() clears compatPassed when the full blob fails to parse.** Even if the smaller summary itself parses, a broken full result implies tampering or partial-write — never trust a half-good compat state. T-2.3-01 mitigation at the hydrate layer (Rule 2 — security-correctness).
- **computeInitialRoute() trusts the stored compatPassed when currentCompatSignature is null.** Forcing a re-run on transient signature-compute failures would be worse UX than trusting the last known-good. AUTH-11 only trips on a NON-null fresh signature. Pinned by initialRoute.test.ts Test 11b.
- **Added 5 sub-cases beyond the plan's 11.** Test 2b (failed-result side of setCompatResult), Test 4b (valid-CompatResult full-parse), Test 8b (partial-perms — camera missing), Test 9b (compatPassed=null), Test 11b (offline-boot null-signature trust). Each covers a real branch in source that the plan's 11 don't exercise. 16 state tests total.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan body's `new MMKV(...)` would fail at runtime — used `createMMKV` factory instead.**

- **Found during:** Task 1 — when reading the plan body's `mmkv.ts` example side-by-side with the actual `apps/mobile/node_modules/react-native-mmkv/lib/index.d.ts`.
- **Issue:** react-native-mmkv@4.3.1 exports `MMKV` as a TypeScript interface (Nitro modules) — `new MMKV(...)` would throw `MMKV is not a constructor` at the first JS evaluation. Phase 1 auth.ts already established `createMMKV({id, encryptionKey})` as the runtime entry; 02-PATTERNS.md Shared Pattern 1 also uses the factory.
- **Fix:** mmkv.ts uses `createMMKV({id: 'humyn.secure', encryptionKey: 'humyn-mmkv-v1'})`; same `humyn.secure` ID + same encryption key as Phase 1 (zero migration risk on dogfood builds).
- **Files modified:** `apps/mobile/src/state/mmkv.ts` (used factory from the start).
- **Verification:** typecheck clean; SignIn.test.tsx still passes; secureMmkv.set/getString/remove all callable.
- **Committed in:** `ead12cf` (Task 1 commit). Header comment in mmkv.ts records the rationale.

**2. [Rule 1 - Bug] Plan body's `secureMmkv.delete(...)` would also fail — used `remove(...)` instead.**

- **Found during:** Task 3 source authoring (writing appStore.ts actions). Same root cause as Deviation 1.
- **Issue:** The Nitro `MMKV` interface exposes `remove(key): boolean`, not `delete(key): void`. The vitest mock supports both names (for forward-compat), but production runtime would crash. 02-PATTERNS.md service-test pattern (line 619) uses `remove`.
- **Fix:** All deletions in appStore.ts (signOut, clearCompatPassed, setJwt(null), setCompatResult(failed)) call `secureMmkv.remove(...)`. setJwt(null) tests in appStore.test.ts pass.
- **Files modified:** `apps/mobile/src/state/appStore.ts` (used remove from the start).
- **Verification:** appStore.test.ts Test 3 pins `signOut()` clears the MMKV key — passes.
- **Committed in:** `298d7b1` (Task 3 GREEN commit).

**3. [Rule 3 - Blocking] pre-commit hook needed pnpm workspace node_modules — ran `pnpm install` once.**

- **Found during:** Task 1 first commit attempt. `.husky/pre-commit` runs `pnpm typecheck` which depends on the workspace `node_modules/.bin/tsc`. The worktree had no root install yet.
- **Issue:** Same shape as 02-02 Deviation 1. Worktree was a fresh checkout; pnpm-workspace deps for `apps/api` + `shared/types` weren't installed.
- **Fix:** Ran `pnpm install` (3s; lockfile already up to date). Re-attempted the commit; pre-commit hook ran cleanly thereafter for all 4 commits.
- **Files modified:** none inside the repo.
- **Verification:** all 4 commits hit a green pre-commit hook (lint-staged + pnpm typecheck both pass).
- **Committed in:** `ead12cf` (Task 1; the install itself isn't committed).

**4. [Rule 3 - Blocking] Plan body asks to `pnpm --filter @humyn/shared-types build` — there is no build script. Skipped, verified differently.**

- **Found during:** Task 2 — when looking up the shared/types build pipeline.
- **Issue:** `shared/types/package.json` has scripts `lint`, `typecheck`, `test` only. `main` and `types` both point at `src/index.ts` directly. Downstream consumers (apps/api, apps/mobile) compile via tsc with `moduleResolution: Bundler` which resolves `.js` import specifiers to the `.ts` source.
- **Fix:** Did NOT run a non-existent build. Verified the schema is reachable from apps/mobile by running a temporary vitest smoke-test that imports CompatResultSchema, CompatChecksSchema, SHARED_TYPES_VERSION — all resolve and parse correctly. Also did NOT re-run `npm install` from apps/mobile (the file: link from 02-01 already points at the same source tree; nothing to refresh).
- **Files modified:** none extra.
- **Verification:** `cd apps/mobile && npm run typecheck` clean; ad-hoc vitest run of a 3-assertion smoke file passes.
- **Committed in:** `e8cd0ed` (Task 2 commit) — the schema landing itself.

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs caused by stale plan-body code-text vs. actual library runtime, 1 Rule 3 environment blocker, 1 Rule 3 plan-step that asked to run a non-existent script).
**Impact on plan:** All 3 tasks landed under acceptance commands. The two Rule 1 bugs would have been runtime crashes had they shipped; catching them at write-time avoided burning the next plan's debugging budget on rediscovering the same Nitro API.

## Issues Encountered

- **shared/types `tsconfig.json` with `moduleResolution: Bundler` accepts `.js` import specifiers that physically point at `.ts` files.** This is the existing Phase 1 convention — index.ts re-exports use `from './user.js'` etc. Got it right by following the pattern (CompatResult.js); a node-only consumer (raw `node -e require(...)`) would fail to resolve, but Metro / vitest / tsc all handle it correctly. Documented in the decisions section.
- **The vitest mock for react-native-mmkv exposes BOTH `MMKV` (class form) AND `createMMKV` (factory). The runtime only exposes the factory.** Could trip a future plan that copies the mock surface area as the API surface. Mitigated by the mmkv.ts header comment + this summary explicitly calling out the asymmetry.

## Threat Flags

None — this plan does not introduce new endpoints, auth paths, file-access patterns, or schema mutations at trust boundaries that aren't already declared in the plan's `<threat_model>` block. The CompatResult schema is consumed cross-process (mobile → backend will get its own subset later), but at this layer it's purely client-side persistence.

The hydrate-clear-on-malformed behavior (Decision 4) addresses T-2.3-01 (tampered compat-pass) at the hydrate layer in addition to the plan's runtime-spec mitigation. Recorded as a Rule 2 mitigation — does NOT introduce a new threat surface; it tightens an existing one.

## User Setup Required

None — this is pure mobile-side state-layer work. No new external-service config, no env vars, no native module changes (the existing MMKV native module is unchanged; we just route through one singleton instead of multiple instances).

The Phase-2-level google-services.json gap (carried over from 02-01) is unrelated to this plan and remains outstanding for the eventual `:app:assembleApkRolloutDebug` operator-smoke / mobile-ci.yml `android-build` job. Resolution path documented in 02-01-SUMMARY.md.

## Next Phase Readiness

- **Plan 02-04 (auth + sign-up screen)** — can call `useAppStore.getState().setJwt(jwt)` + `setConsent({...})` on success. The store is hydrated at boot and the JWT is auto-persisted.
- **Plan 02-05 (App.tsx navigator skeleton)** — wires `hydrate()` synchronously then `computeInitialRoute(useAppStore.getState(), currentSignature)` into `<Stack.Navigator initialRouteName={...}>`. The `currentSignature` comes from the new compatService init (plan 02-06).
- **Plan 02-06 (compatService + Compat / CompatFail screens)** — calls `setCompatResult(parsedZodResult)` after assembling probe outputs. The fail screen reads `compatLastResult.checks` for the diagnostic UI (failedKeys + measured\* fields).
- **Plan 02-08 (versionService + force-upgrade gate)** — calls `setAppVersionCache({response, fetchedAt: Date.now()})` after a successful fetch and toggles `setForceUpgradeBlocked(true)` / `setSoftUpgradeAvailable({latest})` based on the discriminated-union response.
- **Plan 02-16 (installationId service)** — mints UUID v4 once, calls `setInstallationId(uuid)`, the store auto-persists. The hydrated installationId then feeds the next compat-signature computation in plan 02-06's compatService.
- **Plan 02-20 (telemetry ring buffer)** — uses `secureMmkv` directly + `KEYS.TELEMETRY_RING` for the FIFO array; no Zustand involvement (telemetry is fire-and-forget).
- **Every Phase 2 service test** — can `vi.mock` the service module under test and rely on the store's real behavior + the canonical react-native-mmkv mock. No per-test MMKV redeclarations.

## TDD Gate Compliance

Task 3 was `tdd="true"`. Gate sequence:

1. **RED gate (test commit):** `6995814` — `test(02-03): add failing tests for Zustand store, hydrate, initialRoute`. 3 test files committed; vitest run failed with "Failed to resolve import …/state/appStore" etc. (3 test files / no tests run / 3 failed). RED requirement met.
2. **GREEN gate (feat commit):** `298d7b1` — `feat(02-03): implement Zustand store, hydrate, initialRoute gate-tree`. 3 source modules committed; same vitest run now passes 16/16. GREEN requirement met.
3. **REFACTOR gate:** not exercised — implementation came in clean on first pass; no refactor commit needed (and per plan, "REFACTOR (if needed)" is optional).

Plan-level TDD compliance: PASS.

## Self-Check: PASSED

- File `apps/mobile/src/state/mmkv.ts` — FOUND
- File `apps/mobile/src/state/keys.ts` — FOUND
- File `apps/mobile/src/state/appStore.ts` — FOUND
- File `apps/mobile/src/state/hydrate.ts` — FOUND
- File `apps/mobile/src/state/initialRoute.ts` — FOUND
- File `shared/types/src/CompatResult.ts` — FOUND
- File `apps/mobile/__tests__/state/appStore.test.ts` — FOUND (4 cases)
- File `apps/mobile/__tests__/state/hydrate.test.ts` — FOUND (3 cases)
- File `apps/mobile/__tests__/state/initialRoute.test.ts` — FOUND (9 cases)
- `grep -q "humyn.secure" apps/mobile/src/state/mmkv.ts` — succeeds
- `grep -q "AUTH_JWT" apps/mobile/src/state/keys.ts` — succeeds
- `grep -c "'humyn.secure'" apps/mobile/src/services/auth.ts` returns 0 — VERIFIED
- `grep -c "new MMKV" apps/mobile/src/services/auth.ts` returns 0 — VERIFIED
- `grep -q "from '../state/mmkv'" apps/mobile/src/services/auth.ts` — succeeds
- `grep -q "CompatResultSchema" shared/types/src/CompatResult.ts` — succeeds
- `grep -q "imuSustained100Hz" shared/types/src/CompatResult.ts` — succeeds
- `grep -q "encoderNoBFrames" shared/types/src/CompatResult.ts` — succeeds
- `grep -q "from './CompatResult" shared/types/src/index.ts` — succeeds
- `grep -q "SHARED_TYPES_VERSION = '0.6.0'" shared/types/src/index.ts` — succeeds
- `grep -q "create<AppState>" apps/mobile/src/state/appStore.ts` — succeeds
- `grep -q "useAppStore.setState" apps/mobile/src/state/hydrate.ts` — succeeds
- `grep -q "computeInitialRoute" apps/mobile/src/state/initialRoute.ts` — succeeds
- `grep -q "currentCompatSignature" apps/mobile/src/state/initialRoute.ts` — succeeds
- `cd apps/mobile && npm run typecheck` — exits 0
- `cd apps/mobile && npm run test` — 5 test files / 29 tests / all passing
- Commit `ead12cf` (Task 1) — FOUND in git log
- Commit `e8cd0ed` (Task 2) — FOUND in git log
- Commit `6995814` (Task 3 RED) — FOUND in git log
- Commit `298d7b1` (Task 3 GREEN) — FOUND in git log
- 02-01 contributions intact: `apps/mobile/android/settings.gradle` references `../node_modules/@react-native/gradle-plugin` (no regression); `apps/mobile/metro.config.js` has `watchFolders: [sharedTypesRoot]` only (no `disableHierarchicalLookup`, no `workspaceRoot`).
- Phase 1 SignIn tests: `__tests__/SignIn.test.tsx` 3/3 still passing after the auth.ts refactor.
- 02-02 contributions intact: 8 UI primitives + 10 contract assertions still passing.

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
_AUTH-11 (cross-device compat re-run) is satisfied client-side via the gate-decision tree's signature staleness check — no backend round-trip required._
