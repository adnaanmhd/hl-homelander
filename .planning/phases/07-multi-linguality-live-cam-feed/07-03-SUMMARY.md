---
phase: 07-multi-linguality-live-cam-feed
plan: 03
subsystem: i18n
tags: [i18n, intl, telemetry, mobile, react-native, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'apps/mobile/src/util/analytics.ts EVENT_NAMES allowlist + logEvent wrapper that mirrors into telemetryRing'
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'apps/mobile/src/services/telemetryRing.ts append/snapshot/clear ring buffer at MMKV key telemetry.ring.v1'
provides:
  - formatDate(date, locale) helper with Intl.DateTimeFormat + numberingSystem 'latn' forcing (I18N-09 / D-37) and HAS_INTL module-init guard (D-36)
  - ERROR_TOAST_KEYS Record + GENERIC_ERROR_KEY constant + toastKeyForCode helper (I18N-08 / D-34)
  - EVENT_NAMES allowlist extended with 'locale_chosen' + 'locale_changed' so logEvent passes them through to the existing telemetryRing.append API (I18N-12 / D-30)
affects:
  - 07-04-choose-language-screen-and-profile-picker (consumes locale_chosen / locale_changed event names)
  - 07-05-screen-string-sweep-and-bilingual-consent (consumes ERROR_TOAST_KEYS + toastKeyForCode at the toast call sites; consumes formatDate at the ProfileScreen Joined + HistoryScreen recorded-at surfaces)
  - 07-06-tts-fallback-and-reverse-search (no direct dep, but shares the same Wave 1 i18n surface area)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure i18n helper modules under apps/mobile/src/i18n/ (parallel to existing services/ + lib/ conventions)'
    - 'Module-init Intl availability guard (HAS_INTL constant) — degrade gracefully when ICU missing'
    - 'Inline en.json schema snapshot in errorMap.test.ts to enable standalone Wave-1 testing without depending on plan 07-01s en.json file delivery'

key-files:
  created:
    - apps/mobile/src/lib/dates.ts
    - apps/mobile/src/i18n/errorMap.ts
    - apps/mobile/__tests__/lib/dates.test.ts
    - apps/mobile/__tests__/i18n/errorMap.test.ts
    - apps/mobile/__tests__/services/telemetryRing.locale.test.ts
  modified:
    - apps/mobile/src/util/analytics.ts

key-decisions:
  - 'Tests live in apps/mobile/__tests__/{subdir}/*.test.ts per project convention; the plans prescribed src/{subdir}/__tests__/ paths are outside vitests `include` glob — applied as a Rule-3 blocking deviation'
  - 'errorMap cross-validation runs against an INLINE en.json snapshot instead of importing apps/mobile/src/i18n/locales/en.json (plan 07-01 ships that file in the same wave, parallel worktrees) — full runtime cross-validation deferred to plan 07-05'
  - 'EVENT_NAMES extension keeps the existing allowlist order; the new locale_chosen + locale_changed entries are appended at the end so analytics-funnel ordering is preserved'
  - 'telemetryRing.ts is NOT modified (D-30 — no schema change); the locale events flow through the existing append API as-is'

patterns-established:
  - 'i18n helpers live alongside the future i18n/ directory (errorMap.ts) and the existing lib/ directory (dates.ts) following the closest analog convention rather than centralizing under i18n/'
  - 'TDD cycle for pure helpers: RED commit (test only, fails) → GREEN commit (source) → optional REFACTOR (none needed for these 2 tasks)'

requirements-completed: [I18N-08, I18N-09, I18N-12]

# Metrics
duration: 6min
completed: 2026-05-24
---

# Phase 7 Plan 03: i18n Helpers & Error Map Summary

**`formatDate(date, locale)` with `numberingSystem: 'latn'` forcing, `ERROR_TOAST_KEYS` API-code → i18n-key map with generic fallback, and `EVENT_NAMES` allowlist extended with `locale_chosen` + `locale_changed` — all on green TDD + zero schema change to `telemetryRing.ts`**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-24T13:59:46Z
- **Completed:** 2026-05-24T14:06:20Z
- **Tasks:** 2 (TDD — 2 RED + 2 GREEN commits)
- **Files created:** 5 (2 source + 3 test)
- **Files modified:** 1 (analytics.ts EVENT_NAMES allowlist)

## Accomplishments

- **`apps/mobile/src/lib/dates.ts`** — pure `formatDate(date, locale)` helper that wraps `Intl.DateTimeFormat` and forces `numberingSystem: 'latn'` so digits stay 0-9 across all 8 MVP locales (I18N-09 / D-37). Exports `HAS_INTL` module-init guard (D-36); falls back to `en-US toLocaleDateString` on a degenerate runtime and to ISO `YYYY-MM-DD` as the last-resort no-throw path.
- **`apps/mobile/src/i18n/errorMap.ts`** — `ERROR_TOAST_KEYS` Record + `GENERIC_ERROR_KEY` constant + `toastKeyForCode(code)` helper (I18N-08 / D-34). Maps 7 known API codes (auth × 3, upload × 2, recording × 1, compat × 1) to i18n keys that match the en.json skeleton plan 07-01 ships in the same wave. Unknown/null/empty codes fall through to `errors.generic`.
- **`apps/mobile/src/util/analytics.ts`** — `EVENT_NAMES` allowlist extended with `'locale_chosen'` + `'locale_changed'` (I18N-12 / D-30) so `logEvent` no longer drops them with a `[analytics] not in EVENT_NAMES allowlist` dev warning when the call sites land in plan 07-04. `telemetryRing.ts` itself is NOT modified — D-30 honored.

## Task Commits

Each task was committed atomically through the TDD cycle (test → feat):

1. **Task 1 RED — failing test for formatDate** — `d624547` (test)
2. **Task 1 GREEN — implement formatDate + HAS_INTL** — `d589061` (feat)
3. **Task 2 RED — failing tests for errorMap + locale telemetry** — `f8a552d` (test)
4. **Task 2 GREEN — ship errorMap + extend EVENT_NAMES** — `56b68f6` (feat)

REFACTOR pass was not needed for either task — both modules are minimal pure functions with no cleanup opportunity.

## Files Created / Modified

| Path | Role | Action |
| ---- | ---- | ------ |
| `apps/mobile/src/lib/dates.ts` | `formatDate` + `HAS_INTL` Intl wrapper (D-36 / D-37) | created |
| `apps/mobile/src/i18n/errorMap.ts` | API code → i18n-key map + generic fallback (D-34) | created |
| `apps/mobile/src/util/analytics.ts` | EVENT_NAMES allowlist (extension only — 2 new entries appended) | modified |
| `apps/mobile/__tests__/lib/dates.test.ts` | 6 vitest cases over the 8 MVP locales | created |
| `apps/mobile/__tests__/i18n/errorMap.test.ts` | 4 vitest cases + inline en.json snapshot cross-validation | created |
| `apps/mobile/__tests__/services/telemetryRing.locale.test.ts` | 3 vitest cases over the new allowlist entries | created |

Total: **13/13 vitest cases green** across the 3 new test files; pre-existing `util/analytics.test.ts`, `services/telemetryRing.test.ts`, and `lib/durationFormat.test.ts` continue to pass with no regression; `npx tsc --noEmit` exits clean across the entire `apps/mobile` package.

## Decisions Made

- **D-30 honored** — `apps/mobile/src/services/telemetryRing.ts` is byte-identical to the base commit. The locale events ride on the existing `append({ name, ts, props })` shape with no schema change. Verified via `git diff --stat 10e021c..HEAD -- apps/mobile/src/services/telemetryRing.ts` (empty).
- **D-34 / I18N-08 — Defensive `UPLOAD_QUOTA_EXCEEDED` key** — kept in `ERROR_TOAST_KEYS` even though FRAUD-05 (per-account daily upload cap) was descoped to §v2 on 2026-05-12 (per the CLAUDE.md MVP-descope banner). The code costs zero at runtime; if the cap is ever re-promoted from §v2 the toast key will already resolve.
- **D-36 / D-37** — `HAS_INTL` is checked once at module load (not per call); Hermes ships ICU so it is `true` under both RN-Hermes and Node test environments. The `numberingSystem: 'latn'` option is forced via a typed cast — TypeScript 5.x `Intl.DateTimeFormatOptions` does not yet include `numberingSystem` as a non-experimental field on all TS versions, but the option is accepted by ICU at runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file paths moved from `apps/mobile/src/{lib,i18n,services}/__tests__/` to `apps/mobile/__tests__/{lib,i18n,services}/`**

- **Found during:** Task 1 (before writing the RED test)
- **Issue:** The plan prescribed `apps/mobile/src/lib/__tests__/dates.test.ts`, `apps/mobile/src/i18n/__tests__/errorMap.test.ts`, and `apps/mobile/src/services/__tests__/telemetryRing.locale.test.ts`. These paths are outside the vitest `include` glob declared in `apps/mobile/vitest.config.ts` (`include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx']`), so the tests would silently never be discovered by `npm test` — defeating the entire TDD acceptance gate of the plan.
- **Fix:** Followed the project convention established by every existing test file (`apps/mobile/__tests__/lib/durationFormat.test.ts`, `apps/mobile/__tests__/util/analytics.test.ts`, `apps/mobile/__tests__/services/telemetryRing.test.ts`, etc.) and placed the three new test files at:
  - `apps/mobile/__tests__/lib/dates.test.ts`
  - `apps/mobile/__tests__/i18n/errorMap.test.ts`
  - `apps/mobile/__tests__/services/telemetryRing.locale.test.ts`
- **Files modified:** test file locations only — source file paths exactly match the plan
- **Verification:** `cd apps/mobile && npm test -- lib/dates.test.ts i18n/errorMap.test.ts services/telemetryRing.locale.test.ts` exits 0 with all 13 cases green
- **Committed in:** `d624547` + `f8a552d`

**2. [Rule 1 - Bug] Verify command corrected from `npm test -- --run <path>` to `npm test -- <path>`**

- **Found during:** Task 1 (before running the first verify)
- **Issue:** The plan's `<verify>` blocks use `npm test -- --run <path>` syntax. The `npm test` script already runs `vitest run`, and Vitest 4.x exposes `run` as a SUBCOMMAND (`vitest run`), not a `--run` flag. Passing `--run` causes vitest to treat it as an unrecognized flag (or in the pinned 4.1.5, as an extra positional that the run command does not understand).
- **Fix:** Used `npm test -- <path>` directly — which expands to `vitest run <path>`, the correct invocation.
- **Files modified:** none (verify-only behavior)
- **Verification:** Adjacent existing test `npm test -- util/analytics.test.ts` ran clean in the same shell session before the deviation was applied
- **Committed in:** N/A (process-only)

**3. [Rule 3 - Blocking] errorMap.test.ts cross-validation switched from importing `../locales/en.json` to an INLINE en.json snapshot**

- **Found during:** Task 2 (before writing the RED test)
- **Issue:** The plan's `errorMap.test.ts` body imports `import en from '../locales/en.json'` and walks every `ERROR_TOAST_KEYS` value against the loaded JSON. But `apps/mobile/src/i18n/locales/en.json` is shipped by plan **07-01** in the same Wave 1 — both plans run in parallel worktrees, so the file is not present in this worktree at execution time. Importing a non-existent JSON breaks both the RED commit (vitest fails to resolve the import at test discovery, not at the assertion level) and the GREEN commit.
- **Fix:** Inlined the en.json schema from plan 07-01's PLAN.md lines 280-329 as a typed `EN_SKELETON` constant inside the test file. Cross-validation walks the same keys against the inline snapshot. The runtime cross-validation against the real, populated catalog still happens — it lives in plan 07-05 (full screen-string sweep) and plan 07-02's catalog generator validates shape parity automatically. The contract this test protects is "every `ERROR_TOAST_KEYS` value is a well-formed dotted path that resolves in the documented en.json shape" — which is exactly what the inline snapshot proves.
- **Files modified:** `apps/mobile/__tests__/i18n/errorMap.test.ts` only
- **Verification:** 4 errorMap cases green; the snapshot was copy-pasted verbatim from plan 07-01 lines 280-329 so the contract drift surface is minimal
- **Committed in:** `f8a552d`

---

**Total deviations:** 3 auto-fixed (2 Rule-3 blocking — test discovery + parallel-wave file dependency; 1 Rule-1 bug — incorrect verify command)
**Impact on plan:** None of the auto-fixes change the contract the plan describes. The acceptance criteria (file existence + grep counts + green vitest cases + telemetryRing.ts untouched) all hold; only the *paths* and the *cross-validation source* moved to match the actual project layout + the parallel-wave file-delivery reality. No scope creep.

## Issues Encountered

- **Worktree `node_modules` missing** — the spawned worktree does not have its own `node_modules` and the parent shell's `npm test` invocations from inside the worktree fail with `Cannot find module '@vitejs/plugin-react'`. Resolved by symlinking `apps/mobile/node_modules` and the workspace-root `node_modules` from the main repo into the worktree. Symlinks are not committed (gitignored at the workspace level). This is a project-environment issue, not a plan issue.

## Threat Flags

No new threat surface introduced. The plan's `<threat_model>` (T-07-03-01 through T-07-03-04) was honored:

- **T-07-03-01** (Information Disclosure — English `detail` leak): mitigated by `ERROR_TOAST_KEYS` translating known codes through `toastKeyForCode` to translated keys; unknown codes fall back to `GENERIC_ERROR_KEY`. The Crashlytics breadcrumb wiring (D-35) is deferred to plan 07-05.
- **T-07-03-04** (Tampering — Intl returns unexpected value): mitigated by `formatDate`'s nested try/catch chain that falls back to en-US `Intl.DateTimeFormat`, then to ISO `YYYY-MM-DD` — never throws.
- T-07-03-02 + T-07-03-03 are `accept`-disposition in the plan; no mitigation work required.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 07-04 (Wave 2)** can consume `logEvent('locale_chosen', ...)` and `logEvent('locale_changed', ...)` without the runtime `[analytics] not in EVENT_NAMES allowlist` drop.
- **Plan 07-05 (Wave 2)** can wire `toastKeyForCode(code)` into the toast surface and the `formatDate(date, i18n.language)` into the `ProfileScreen.tsx` "Joined" row + `HistoryScreen.tsx` "recorded at" row.
- **Plan 07-05** is also the right home for the runtime cross-validation of `ERROR_TOAST_KEYS` against the populated `apps/mobile/src/i18n/locales/en.json` (this plan validates against an inline snapshot — see Deviation #3).

## Self-Check: PASSED

- `apps/mobile/src/lib/dates.ts` — FOUND
- `apps/mobile/src/i18n/errorMap.ts` — FOUND
- `apps/mobile/__tests__/lib/dates.test.ts` — FOUND
- `apps/mobile/__tests__/i18n/errorMap.test.ts` — FOUND
- `apps/mobile/__tests__/services/telemetryRing.locale.test.ts` — FOUND
- Commit `d624547` (test: dates RED) — FOUND
- Commit `d589061` (feat: dates GREEN) — FOUND
- Commit `f8a552d` (test: errorMap + telemetry RED) — FOUND
- Commit `56b68f6` (feat: errorMap + EVENT_NAMES GREEN) — FOUND
- `git diff --stat 10e021c..HEAD -- apps/mobile/src/services/telemetryRing.ts` — empty (D-30 honored)
- `cd apps/mobile && npm test -- lib/dates.test.ts i18n/errorMap.test.ts services/telemetryRing.locale.test.ts` — exits 0, 13/13 green
- `cd apps/mobile && npx tsc --noEmit` — exits 0

---

_Phase: 07-multi-linguality-live-cam-feed_
_Plan: 03_
_Completed: 2026-05-24_
