---
phase: 07-multi-linguality-live-cam-feed
plan: 01
subsystem: i18n
tags: [i18n, react-native, mmkv, i18next, react-i18next, mobile, bootstrap]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'SafeAreaProvider + NavigationContainer + ToastHost root composition in App.tsx (the wrap target)'
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: 'secureMmkv createMMKV pattern + KEYS as-const naming convention (mirrored for localeMmkv + LOCALE_KEYS)'
provides:
  - 'localeMmkv (non-secure MMKV instance) + LOCALE_KEYS constants + SUPPORTED_LOCALES allowlist + Locale type'
  - 'Synchronous localeBootstrap() reader with allowlist-validated fallback to "en"'
  - 'i18next runtime initialized at module load with 8 BCP-47 locale resources + fallbackLng + compatibilityJSON v4'
  - '<I18nextProvider> wrapping <NavigationContainer> + <ToastHost> in App.tsx'
  - '8 placeholder catalog JSONs at apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json with identical key shape'
affects:
  - 07-02-llm-catalog-generator-tool (regenerates the 7 non-English catalogs from en.json via Claude Opus 4.7)
  - 07-03-i18n-helpers-and-error-map (consumes i18n.t() + i18n.language for errorMap + dates + reverseSearch)
  - 07-04-choose-language-screen-and-profile-picker (writes localeMmkv + calls i18n.changeLanguage)
  - 07-05-screen-string-sweep-and-bilingual-consent (replaces hardcoded strings with t() across 22 screens)
  - 07-06-tts-fallback-and-reverse-search (reads i18n.language for per-locale TTS voice resolution)

# Tech tracking
tech-stack:
  added:
    - 'i18next@^26.2.0 (i18n engine, CLDR plural rules, key-fallback)'
    - 'react-i18next@^17.0.8 (React bindings: useTranslation, I18nextProvider, Trans)'
  patterns:
    - 'Side-effect module that runs i18n.init at module load (NOT inside useEffect) — sync resolve before first render per D-23'
    - 'Per-purpose MMKV instance pattern: localeMmkv (non-secure) sibling to secureMmkv, both via createMMKV factory'
    - 'Allowlist-validated bootstrap reader: SUPPORTED_LOCALES gates the stored MMKV value (T-07-01-01 mitigation) before i18next sees it'
    - 'Vitest test placement under top-level __tests__/i18n/ (matching existing __tests__/native/ + __tests__/lib/ convention)'

key-files:
  created:
    - 'apps/mobile/src/i18n/storage.ts'
    - 'apps/mobile/src/i18n/bootstrap.ts'
    - 'apps/mobile/src/i18n/index.ts'
    - 'apps/mobile/src/i18n/locales/en.json'
    - 'apps/mobile/src/i18n/locales/pt-BR.json'
    - 'apps/mobile/src/i18n/locales/es.json'
    - 'apps/mobile/src/i18n/locales/hi-IN.json'
    - 'apps/mobile/src/i18n/locales/bn-IN.json'
    - 'apps/mobile/src/i18n/locales/ta-IN.json'
    - 'apps/mobile/src/i18n/locales/te-IN.json'
    - 'apps/mobile/src/i18n/locales/mr-IN.json'
    - 'apps/mobile/__tests__/i18n/bootstrap.test.ts'
    - 'apps/mobile/__tests__/i18n/i18n.test.ts'
  modified:
    - 'apps/mobile/App.tsx'
    - 'apps/mobile/package.json'
    - 'apps/mobile/package-lock.json'

key-decisions:
  - 'localeMmkv is a NEW non-secure MMKV instance (id="humyn.locale", no encryptionKey) — locale is not a secret (D-21)'
  - 'localeBootstrap() validates against SUPPORTED_LOCALES allowlist before returning (T-07-01-01 mitigation — unknown stored values fall back to "en")'
  - 'i18n.init runs as a module-level side-effect at first import (D-23) — synchronous, before first React render'
  - '<I18nextProvider> placed immediately INSIDE <SafeAreaProvider>, wrapping both <NavigationContainer> AND <ToastHost> (RESEARCH §"Provider Placement")'
  - 'Test files placed under apps/mobile/__tests__/i18n/ rather than the plan-stated apps/mobile/src/i18n/__tests__/ — required for vitest include glob discovery (Rule 3 deviation)'
  - 'Use .remove() not .delete() on MMKV in tests — Nitro v4 only exposes .remove() on the public MMKV type (the vitest in-memory shim aliased .delete for back-compat but it fails tsc against the real type)'

patterns-established:
  - 'i18n side-effect module: `import "./src/i18n"` at App.tsx top triggers init via the imported module side effects; default export provides the configured `i18n` instance for the provider'
  - 'Locale allowlist-validated bootstrap: SUPPORTED_LOCALES as const + Locale type + (allowlist as readonly string[]).includes(stored) before return — runtime + compile-time safety'
  - 'Test path override: when a plan stipulates a test path that the vitest config does not include, route to the conventional __tests__/{topic}/ location and document the deviation (Rule 3)'

requirements-completed: [I18N-01]

# Metrics
duration: 6min
completed: 2026-05-24
---

# Phase 7 Plan 01: i18n Runtime Bootstrap Summary

**i18next 26 + react-i18next 17 wired at App.tsx with non-secure localeMmkv + sync allowlist-validated bootstrap, 8 placeholder catalogs, and an <I18nextProvider> over the navigator + ToastHost — first render is in the correct locale before any consumer screen lands.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-24T13:59:45Z
- **Completed:** 2026-05-24T14:06:10Z
- **Tasks:** 2 (both `type="auto"` with `tdd="true"`)
- **Files modified:** 14 (13 created + 1 modified, plus package.json + lockfile)

## Accomplishments

- Installed `i18next@^26.2.0` + `react-i18next@^17.0.8` (the only two Phase 7 runtime deps — the LLM generator + 6 supporting deps stay in plan 07-02's `tools/` workspace).
- Stood up the i18n module triple (`storage.ts`, `bootstrap.ts`, `index.ts`) with the localeMmkv-validated → `i18n.init({ lng })` flow per D-21 / D-22 / D-23.
- Shipped 8 placeholder locale JSONs (en authoritative; 7 non-English mirror it verbatim until plan 07-02 runs the LLM regen) with identical key shapes per the 07-PATTERNS skeleton lines 1075-1101.
- Wrapped `<NavigationContainer>` + `<ToastHost>` with `<I18nextProvider>` immediately inside `<SafeAreaProvider>` per RESEARCH §"Provider Placement"; existing in-effect installers (`installBootRecoveryListener`, `installUploadReconcile`) untouched.
- 11 new vitest cases across 2 files cover: empty MMKV → 'en', 8-tag round-trip, unknown-value fallback, LOCALE_KEYS literals, D-18 ordering, 8 locales as resources, fresh-app English default, missing-key fall-through to key string, `changeLanguage('hi-IN')` round-trip, `compatibilityJSON: 'v4'`, `fallbackLng: 'en'`.
- Zero regressions: the full mobile suite is **846 / 846 passing across 114 files**; `tsc --noEmit` is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install i18n deps + create localeMmkv storage module** — `7f39e1d` (feat) — `package.json`, `package-lock.json`, `src/i18n/storage.ts`, `src/i18n/bootstrap.ts`, `__tests__/i18n/bootstrap.test.ts`.
2. **Task 2: Create i18n runtime + 8 placeholder JSONs + wire I18nextProvider** — `fed6fbb` (feat) — `App.tsx`, `src/i18n/index.ts`, 8 × `src/i18n/locales/*.json`, `__tests__/i18n/i18n.test.ts`, plus the `.delete` → `.remove` fix in the Task-1 bootstrap test (Rule 3 carry-back).

_Per-task tests landed in the same commit as the implementation (the TDD red/green/refactor sequence is internal to each task; the plan does not call for separate test/feat/refactor commits — each `<task tdd="true">` is one atomic unit per the existing Phase-7 plan convention)._

## Files Created/Modified

### Created (13)

- `apps/mobile/src/i18n/storage.ts` — non-secure `localeMmkv` MMKV instance (id `humyn.locale`, NO encryptionKey), `LOCALE_KEYS` constants (`locale.code`, `locale.chosen_at`), `SUPPORTED_LOCALES` 8-tag allowlist + `Locale` derived type.
- `apps/mobile/src/i18n/bootstrap.ts` — synchronous `localeBootstrap(): Locale` reader; allowlist-validates the stored MMKV value; empty / unknown / read-failure all fall through to `'en'`.
- `apps/mobile/src/i18n/index.ts` — side-effect module that runs `i18n.use(initReactI18next).init({ lng, resources, fallbackLng, compatibilityJSON, interpolation, returnNull })` at module load with all 8 statically-imported catalogs; default-exports the configured `i18n` instance.
- `apps/mobile/src/i18n/locales/en.json` — authoritative skeleton catalog per 07-PATTERNS lines 1075-1101 (`common`, `onboarding.chooseLanguage`, `profile.language`, `recording.preview`, `terms.consent`, `errors.{generic,auth,upload,recording,compat}`).
- `apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` — 7 × placeholder catalogs with identical key shape to en.json (English values mirrored verbatim; plan 07-02 regenerates).
- `apps/mobile/__tests__/i18n/bootstrap.test.ts` — 5 cases covering `localeBootstrap` invariants + the LOCALE_KEYS literals + D-18 ordering.
- `apps/mobile/__tests__/i18n/i18n.test.ts` — 6 cases covering the i18n runtime invariants (resources, default lang, fallback, changeLanguage, compatibilityJSON, fallbackLng).

### Modified (3)

- `apps/mobile/App.tsx` — side-effect `import './src/i18n'` + `import i18n from './src/i18n'` + `import { I18nextProvider } from 'react-i18next'`; wrapped `<NavigationContainer>` + `<ToastHost>` with `<I18nextProvider i18n={i18n}>` immediately inside `<SafeAreaProvider>`. Existing `enableScreens(true)`, `hydrate()`, and `useEffect` installers untouched.
- `apps/mobile/package.json` — added `i18next ^26.2.0` and `react-i18next ^17.0.8` to dependencies.
- `apps/mobile/package-lock.json` — npm dependency tree refresh (855 new packages).

## Decisions Made

All 6 implementation decisions are listed in the frontmatter `key-decisions` field above. None overrode any locked phase decision (D-06 / D-12 / D-21 / D-22 / D-23 / D-07 / D-18 all honored verbatim). The two judgment calls were:

1. **Test placement under `__tests__/i18n/`** — the plan's `<files>` frontmatter pointed at `apps/mobile/src/i18n/__tests__/` but vitest's `include` glob is rooted at `apps/mobile/__tests__/`. Placing the tests where the plan literally said would have silently dropped them from `npm test`, the very command the plan's `<verify>` block runs. Routing to the conventional location satisfies the plan's verify command AND the project's existing test layout.

2. **`.remove()` over `.delete()` on MMKV** — the vitest in-memory shim aliases both names but the real `react-native-mmkv@4.3.1` Nitro `MMKV` type only exposes `.remove(key)`. Caught by `tsc --noEmit` after the first test run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test files placed under `apps/mobile/__tests__/i18n/` instead of `apps/mobile/src/i18n/__tests__/`**

- **Found during:** Task 1 (bootstrap test creation)
- **Issue:** Plan's `<files>` frontmatter listed `apps/mobile/src/i18n/__tests__/bootstrap.test.ts` and `.../i18n.test.ts`, but vitest.config.ts `include` pattern is rooted at `apps/mobile/__tests__/**/*.test.ts(x)`. Tests placed at the plan-stated paths would be silently skipped — defeating the entire TDD red-green loop and breaking the plan's own `<verify>` automated command (`npm test -- --run src/i18n/**tests**/bootstrap.test.ts`).
- **Fix:** Created `apps/mobile/__tests__/i18n/{bootstrap,i18n}.test.ts` matching the existing convention (`__tests__/native/`, `__tests__/lib/`, `__tests__/boot/`, etc.). Imports updated to `../../src/i18n/...`.
- **Files modified:** `apps/mobile/__tests__/i18n/bootstrap.test.ts`, `apps/mobile/__tests__/i18n/i18n.test.ts`.
- **Verification:** `npm test -- --run __tests__/i18n/` runs 11 / 11 cases green; `npm test -- --run` runs full suite 846 / 846 green (zero regressions).
- **Committed in:** `7f39e1d` (Task 1) + `fed6fbb` (Task 2).

**2. [Rule 1 — Bug] `localeMmkv.delete(...)` failed `tsc --noEmit` against the real MMKV v4 Nitro type**

- **Found during:** Task 2 (after running `tsc --noEmit` in the plan's `<verification>` block)
- **Issue:** `react-native-mmkv@4.3.1` Nitro `MMKV` public type exposes `.remove(key)` (not `.delete(key)`). The vitest in-memory mock in `vitest.setup.ts` aliases both names for back-compat, so the test ran green at runtime, but `tsc --noEmit` (a phase-level verification step) errored with `TS2339: Property 'delete' does not exist on type 'MMKV'`.
- **Fix:** Switched the test's `beforeEach` to `localeMmkv.remove(LOCALE_KEYS.CODE)` with a clarifying comment about the vitest shim aliasing both names.
- **Files modified:** `apps/mobile/__tests__/i18n/bootstrap.test.ts`.
- **Verification:** `tsc --noEmit` exits 0; the 5 bootstrap tests still pass.
- **Committed in:** `fed6fbb` (Task 2 commit included the fix as a Rule-1 carry-back).

---

**Total deviations:** 2 auto-fixed (1 blocking — test path discovery; 1 bug — wrong MMKV API method)
**Impact on plan:** Both auto-fixes are necessary for the plan's own verify gates to pass. No scope creep; the plan's behavioral contract is met exactly as written.

## Issues Encountered

- **JSDoc `**/_`token tripped the esbuild parser.** First version of`bootstrap.test.ts`referenced the vitest include glob`**tests**/\*\*/_.test.ts(x)`inside a JSDoc block, but esbuild parsed the`_/` substring as a comment terminator (`Unexpected "_"`). Rewrote the comment to describe the glob in prose without the literal pattern characters. Caught + fixed in <1 minute; no impact on plan.
- **No other surprises.** The plan's `<read_first>` blocks already pointed at every analog needed (mmkv.ts factory shape, keys.ts as-const pattern, App.tsx bootstrap order, RESEARCH §"Pattern 1" verbatim skeleton); the implementation was a clean transcribe-with-citations pass.

## Known Stubs

- **The 7 non-English locale JSONs (`pt-BR.json`, `es.json`, `hi-IN.json`, `bn-IN.json`, `ta-IN.json`, `te-IN.json`, `mr-IN.json`) currently mirror `en.json` verbatim.** This is intentional per the plan — only the SKELETON shape ships in 07-01; plan 07-02 (LLM catalog generator tool) regenerates each via Claude Opus 4.7 with the vernacular brief from D-10. i18next's key-fallback to English would mask missing keys at runtime anyway, but the identical shape now lets plan 07-02 run shape-parity validation. The `en.json` skeleton itself is also a starter — plan 07-05 (screen-string sweep) adds the bulk of the keys from the 22 existing screens + the new ChooseLanguageScreen.
- **No other stubs.** The runtime is fully wired end-to-end at App.tsx; `useTranslation()` resolves keys from the very first frame onward.

## User Setup Required

None — no external service configuration needed for the i18n runtime. The LLM catalog generator in plan 07-02 will require an `ANTHROPIC_API_KEY` in `tools/.env` (gitignored), but that key is not consumed by this plan.

## Next Phase Readiness

- **07-02 (LLM catalog generator tool)** is unblocked. `en.json` is in place as the source-of-truth that the generator reads; the 7 placeholder files exist as overwrite targets.
- **07-03 (i18n helpers + error map)** can begin — `i18n.t`, `i18n.language`, and `i18n.changeLanguage` are all reachable from any consumer; `<I18nextProvider>` is mounted; `formatDate`, `errorMap`, `reverseSearch` can all hook in.
- **07-04 (ChooseLanguageScreen + Profile picker)** can begin — `localeMmkv` + `LOCALE_KEYS` + `SUPPORTED_LOCALES` are exported; the picker writes `locale.code` + `locale.chosen_at` and calls `i18n.changeLanguage(loc)`.
- **07-05 (screen-string sweep)** can begin — every screen under `<NavigationContainer>` has access to `useTranslation()`; the en.json skeleton is ready to accept the bulk of additional keys.
- **07-06 (TTS fallback + reverse search)** can begin — `i18n.language` is the input to the TTS chain selector.
- **07-07 (live-cam preview)** is independent of i18n and proceeds in parallel.

**No blockers, no concerns.** Plan 07-01 is the prerequisite for 7 downstream consumers in this phase and ships green-on-tests + clean-on-types.

## Self-Check: PASSED

**Verified files exist:**

- `apps/mobile/src/i18n/storage.ts` — FOUND
- `apps/mobile/src/i18n/bootstrap.ts` — FOUND
- `apps/mobile/src/i18n/index.ts` — FOUND
- `apps/mobile/src/i18n/locales/en.json` — FOUND
- `apps/mobile/src/i18n/locales/pt-BR.json` — FOUND
- `apps/mobile/src/i18n/locales/es.json` — FOUND
- `apps/mobile/src/i18n/locales/hi-IN.json` — FOUND
- `apps/mobile/src/i18n/locales/bn-IN.json` — FOUND
- `apps/mobile/src/i18n/locales/ta-IN.json` — FOUND
- `apps/mobile/src/i18n/locales/te-IN.json` — FOUND
- `apps/mobile/src/i18n/locales/mr-IN.json` — FOUND
- `apps/mobile/App.tsx` — MODIFIED (I18nextProvider wrap confirmed via grep)
- `apps/mobile/__tests__/i18n/bootstrap.test.ts` — FOUND
- `apps/mobile/__tests__/i18n/i18n.test.ts` — FOUND

**Verified commits exist:**

- `7f39e1d` (Task 1) — FOUND in `git log`
- `fed6fbb` (Task 2) — FOUND in `git log`

**Verified test gates:**

- `npm test -- --run __tests__/i18n/` — 11 / 11 green
- `npm test -- --run` (full suite) — 846 / 846 green
- `npx tsc --noEmit` — exit 0

---

_Phase: 07-multi-linguality-live-cam-feed_
_Completed: 2026-05-24_
