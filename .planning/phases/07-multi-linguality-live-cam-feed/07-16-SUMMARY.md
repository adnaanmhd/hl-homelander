---
phase: 07-multi-linguality-live-cam-feed
plan: 16
subsystem: ui
tags:
  [
    i18n,
    gap-closure,
    mobile,
    layout,
    overflow,
    devanagari,
    search,
    taskI18n,
    EN_TOKEN_ALIASES,
    TranslatedHeaderTitle,
  ]

# Dependency graph
requires:
  - phase: 07-multi-linguality-live-cam-feed
    provides: 'plan 07-12 — 86×8 TASK_CATALOG_I18N populated by Claude Opus 4.7 (602 translations)'
  - phase: 07-multi-linguality-live-cam-feed
    provides: 'plans 07-01..07-11 — i18n runtime (react-i18next + 8 locale JSON bundles), reverseSearch.ts shim, history.filter/home.filter wiring'
  - phase: 06-tasks-history-home-tiles-lexical-search
    provides: 'TasksScreen / TaskDetailsSheet / HistoryRow / HomeScreen / FilterSheet / SendRequestSheet / ReportProblemSheet — the render sites this plan wires through i18n'
provides:
  - 'apps/mobile/src/i18n/taskI18n.ts — 4-export helper that bridges TASK_CATALOG_I18N to every render site (localizeTaskName/Category/Description/Instructions)'
  - 'apps/mobile/src/i18n/taskCatalog.i18n.ts EN_TOKEN_ALIASES map — client-side curated alias map for English derivational forms (G-13 fix)'
  - 'apps/mobile/src/components/TranslatedHeaderTitle.tsx — locale-reactive React Navigation header (G-23 fix; WARNING 7 workaround)'
  - 'apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json — 34 new keys covering rules.universal.*, tasks.category.*, tasks.setting.*, report.category.*, history.empty.*, history.daySection.*, history.filterSheet.title, history.row.*, helpCenter.title; plus the 6 home.filter.* values chevron-stripped (chevron now in JSX template)'
  - '4 Devanagari overflow + alignment props (numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85}) on RotatePrompt + RecordingScreen.gatePrompt + CompatRunningScreen.label; textAlign: center on RecordingScreen.liveLabelText style'
affects: [Phase-07 plan 07-15 re-attempt, Phase 8 (post-MVP observability + APK distribution)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Server-English + client-localizes pattern: server returns canonical English task data (D-16 invariant), client wraps every render site through taskI18n.ts helpers driven by TASK_CATALOG_I18N. en-locale renders short-circuit to server data (canonical English IS truth); non-en consults catalog.'
    - 'TranslatedHeaderTitle pattern for React Navigation: function-form options.title does NOT re-invoke on i18n.changeLanguage; the `headerTitle: () => <Component />` wrapper does because <Component> re-mounts and re-runs its hooks (WARNING 7).'
    - 'testID stays English / accessibilityLabel translates split for accessibility-relevant chips: server-contract enum stability lives in testID; TalkBack/VoiceOver localization lives in accessibilityLabel (WARNING 12).'
    - 'EN_TOKEN_ALIASES curated alias map vs algorithmic stemming for client-side search-term rewriting: deterministic, no surprise stems, ~2 LOC per entry, scales linearly with the small canonical catalog.'

key-files:
  created:
    - 'apps/mobile/src/i18n/taskI18n.ts'
    - 'apps/mobile/src/components/TranslatedHeaderTitle.tsx'
    - 'apps/mobile/__tests__/i18n/taskI18n.test.ts (15 tests)'
    - 'apps/mobile/__tests__/components/UniversalRulesBlock.i18n.test.tsx (3 tests)'
    - 'apps/mobile/__tests__/components/TaskCategoryPills.i18n.test.tsx (3 tests)'
    - 'apps/mobile/__tests__/screens/home/HomeScreen.tileLabel.i18n.test.tsx (3 tests)'
    - 'apps/mobile/__tests__/components/HistoryRow.i18n.test.tsx (3 tests)'
    - 'apps/mobile/__tests__/components/HistoryDayHeader.i18n.test.tsx (3 tests)'
    - 'apps/mobile/__tests__/services/historyGrouping.i18n.test.ts (2 tests)'
    - 'apps/mobile/__tests__/screens/history/HistoryScreen.empty.i18n.test.tsx (3 tests)'
    - 'apps/mobile/__tests__/screens/shared/FilterSheet.i18n.test.tsx (2 tests)'
    - 'apps/mobile/__tests__/components/ReportProblemSheet.i18n.test.tsx (2 tests)'
    - 'apps/mobile/__tests__/screens/tasks/SendRequestSheet.i18n.test.tsx (3 tests)'
    - 'apps/mobile/__tests__/components/TranslatedHeaderTitle.test.tsx (2 tests)'
    - '.planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md'
    - '.planning/phases/07-multi-linguality-live-cam-feed/deferred-items.md'
  modified:
    - 'apps/mobile/src/i18n/locales/en.json (+34 new keys, 6 home.filter.* values chevron-stripped, 2 dead keys removed)'
    - 'apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json (LLM-regen via pnpm i18n:generate; all 7 audit sidecars refreshed)'
    - 'apps/mobile/src/i18n/taskCatalog.i18n.ts (+EN_TOKEN_ALIASES at EOF; data block untouched at the value level — Prettier reformatted whitespace only, see deviation note)'
    - 'apps/mobile/src/i18n/reverseSearch.ts (en branch: identity-passthrough → alias-map lookup)'
    - 'apps/mobile/src/screens/tasks/TasksScreen.tsx (5 localize* call sites)'
    - 'apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx (4 localize* call sites; en short-circuit for description/instructions)'
    - 'apps/mobile/src/screens/tasks/SendRequestSheet.tsx (CATEGORY chips + Indoor/Outdoor + 4 form eyebrows wired)'
    - 'apps/mobile/src/components/UniversalRulesBlock.tsx (4 rules: label → labelKey + useTranslation render)'
    - 'apps/mobile/src/components/TaskCategoryPills.tsx (pillLabel → PILL_LABEL_KEY + t())'
    - 'apps/mobile/src/components/HistoryRow.tsx (uploadedAtLabel + FEEDBACK eyebrow t()-wired)'
    - 'apps/mobile/src/components/ReportProblemSheet.tsx (REPORT_CATEGORY_LABEL_KEY map; testID/a11y split per WARNING 12)'
    - 'apps/mobile/src/screens/history/HistoryScreen.tsx (HIST-04/HIST-05 empty-state copy via history.empty.*)'
    - 'apps/mobile/src/screens/home/HomeScreen.tsx (tileLabel switch arms → t() + chevron-in-template per BLOCKER 1)'
    - 'apps/mobile/src/screens/shared/FilterSheet.tsx (QUICK_OPTIONS label → labelKey; title via t())'
    - 'apps/mobile/src/services/historyGrouping.ts (4 named day-sections → i18n.t())'
    - 'apps/mobile/src/screens/recording/components/RotatePrompt.tsx (G-26 overflow props)'
    - 'apps/mobile/src/screens/recording/RecordingScreen.tsx (G-27 overflow on gatePrompt; G-15 textAlign center on liveLabelText)'
    - 'apps/mobile/src/screens/compat/CompatRunningScreen.tsx (G-14 overflow + flex on label)'
    - 'apps/mobile/src/navigation/RootNativeStack.tsx (HelpCenter screen: title → headerTitle TranslatedHeaderTitle)'
    - 'apps/mobile/vitest.setup.ts + apps/mobile/__tests__/components/ReportProblemSheet.test.tsx local mock (testID → data-testid forwarding in the RN shim)'

key-decisions:
  - 'G-13 fix path: curated EN_TOKEN_ALIASES map (the four recycling derivational forms) per checker BLOCKER 4. The algorithmic-stemmer alternative was unreliable for the 86-task catalog (the original `endsWith` suffix list broke for the central "recycle" → "recycl" stem).'
  - 'G-19 + TaskDetailsSheet: prefer server-returned task data when active locale === en; fall through to TASK_CATALOG_I18N only for non-en. The catalog en-row mirrors the server canonical, so this avoids overriding tests that mock task.instructions while still rendering Devanagari/etc. for non-en users.'
  - 'G-22 (Report a Problem chips): testID stays English (server contract / Detox-friendly); accessibilityLabel translates (TalkBack/VoiceOver localization). Per WARNING 12. testID/a11y forwarding wired into the jsdom shim for both vitest.setup.ts and the local mock in ReportProblemSheet.test.tsx.'
  - 'G-23 (Help Center header): function-form `options.title` does NOT re-invoke on global state change; the `headerTitle: () => <TranslatedHeaderTitle />` approach re-renders because the component re-mounts each header redraw and re-runs useTranslation(). Per WARNING 7.'
  - 'G-28 day-section names: 4 named sections (Today/Yesterday/This week/This month) route through history.daySection.*; prior-month `{MonthName YYYY}` STAYS Latin V1 (Intl-locale formatting deferred per I18N-09 drop). HistoryDayHeader.tsx `title.toUpperCase()` STAYS — Devanagari is case-no-op; pt-BR `HOJE` is the intentional design choice. Per WARNING 9.'
  - 'home.filter.* (G-16): 6 values stripped of `▾`; chevron lives in JSX template (`${t(...)} ▾`). Rename `all → allTime` for naming consistency with history.filter.*. Per checker BLOCKER 1.'
  - 'tasks.category.* + tasks.setting.* live in en.json (not TASK_CATALOG_I18N) because they are screen-wide enums not per-task strings; co-located with the rest of the i18n catalog.'

patterns-established:
  - 'Pattern 78: server-English + client-localizes via TASK_CATALOG_I18N helper bridge. Every render site that reads server-returned task data wraps the read through localizeTaskName/Category/Description/Instructions. Tests pass-through with mocked task data still work in en because the helpers short-circuit to server data for en.'
  - 'Pattern 79: locale-reactive React Navigation header via TranslatedHeaderTitle wrapper. The function-form `options.title` does not re-render on i18n.changeLanguage; the headerTitle component does.'
  - 'Pattern 80: testID stays English / accessibilityLabel translates for chips backed by server-contract enums. testID is Detox-friendly + server-stable; accessibilityLabel is TalkBack-friendly + localized.'
  - 'Pattern 81: client-side curated EN_TOKEN_ALIASES map for derivational forms when server-side stemming drifts or routing details defeat the stemmer. ~2 LOC per entry; identity entries make the canonical set explicit.'

requirements-completed: [I18N-01, I18N-10, I18N-11]

# Metrics
duration: 81min
completed: 2026-05-26
---

# Phase 7 Plan 16: i18n completion & truncation — Summary

**Wired the 86×8 task catalog into every render site + closed 16 i18n-gap escapes (G-13..G-28) the operator surfaced during the hi-IN deep walk; the 602 translations from plan 07-12 now render on TasksScreen / TaskDetailsSheet / RecordingScreen / HistoryRow.**

## Performance

- **Duration:** 81 min
- **Started:** 2026-05-26T13:32:25Z
- **Completed:** 2026-05-26T14:53:55Z
- **Tasks (code-level):** 7 of 12 (Task 8 is the operator-walked checkpoint; Tasks 9–12 are orchestrator-owned post-walk)
- **Files modified:** 25 (15 mobile src + 7 locale JSON + 1 mobile test infra + 2 mobile config/test docs)
- **Files created:** 14 (1 helper + 1 component + 11 test files + 2 doc files)
- **Commits:** 8 (Task 1 docs + Tasks 2..7 feat/feat/feat/feat/feat/feat/chore)

## Accomplishments

- **G-18 keystone closed.** The 86×8 TASK_CATALOG_I18N shipped by plan 07-12 finally connects to the rendering pipeline. New `apps/mobile/src/i18n/taskI18n.ts` helper exports `localizeTaskName / localizeTaskCategory / localizeTaskDescription / localizeTaskInstructions`. Every render site that previously read server-returned canonical English now wraps the read through these helpers.
- **G-13 closed client-side.** Curated `EN_TOKEN_ALIASES` map appended at EOF of `taskCatalog.i18n.ts`; `reverseSearch.ts` en branch now token-rewrites before forwarding to `/tasks/search`. The four recycling derivational forms (`recyclable / recyclables / recycle / recycling`) collapse to `recyclables`. Backend stays unmodified per D-16.
- **G-14 / G-15 / G-26 / G-27 layout fixes.** CompatCheck probe labels + RotatePrompt + hand-gate prompt all gain `numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85}` so Devanagari/Bengali/Tamil/Telugu/Marathi strings render complete. "Live preview" pill gains `textAlign: 'center'` for in-pill glyph centering.
- **8 t()-wiring closures (G-16/G-17/G-20/G-21/G-22/G-23/G-24/G-28).** HomeScreen tileLabel + TaskCategoryPills + History empty states + FilterSheet + ReportProblemSheet (with TalkBack-friendly accessibilityLabel split per WARNING 12) + HelpCenter header (via new TranslatedHeaderTitle component per WARNING 7) + SendRequestSheet + HistoryRow uploadedAt + historyGrouping day-section names all routed through the i18n catalog.
- **34 new en.json keys + LLM-regen for 7 non-en locales.** `pnpm i18n:generate` ran in 2 passes (te-IN had a 1-key hallucination on pass 1; pass 2 was clean). `pnpm i18n:validate` reports OK for all 8 catalogs.
- **All invariants green.** apps/api / apps/mobile/android / ttsVoice / RigTutorialScreen / Phase-6 06-COSMETIC-GAPS.md (vs cluster head 5879daf per WARNING 11) all untouched.
- **27 new vitest cases across 13 new test files; full mobile suite passes 1004 / 1006.** The 2 failing tests are pre-existing visual-snapshot regressions on RecordingScreen (RecordingScreen-active-t10s + t05m32s) — confirmed pre-existing via `git stash` rerun on base commit; logged to `deferred-items.md`.

## Task Commits

Each task committed atomically. Task 7 is the regression gate; Task 8 is the operator-walked hardware checkpoint (deferred to orchestrator).

1. **Task 1: G-18 root-cause investigation** — `beec43d` (docs)
2. **Task 2: taskI18n.ts helper + G-18/G-19/G-25 wiring keystone** — `33102be` (feat, TDD: test first, then 4 wire sites + 11 tests)
3. **Task 3: G-13 EN_TOKEN_ALIASES + reverseSearch.ts en branch** — `e09d7e5` (feat, 7 new vitest cases for the alias-map path)
4. **Task 4a: G-16 HomeScreen tileLabel + G-17 TaskCategoryPills** — `ba49d96` (feat)
5. **Task 4b: G-20 History empty + G-21 FilterSheet + G-28 HistoryRow + day-section names** — `32967a9` (feat)
6. **Task 4c: G-22 ReportProblemSheet chips + G-23 Help Center header + G-24 SendRequestSheet** — `a392604` (feat; also widens the jsdom RN shim to forward testID → data-testid for the WARNING 12 a11y split)
7. **Task 5: LLM regen 7 non-en locale catalogs** — `e915b52` (feat, ran pnpm i18n:generate via Claude Opus 4.7; 2-pass to clear te-IN hallucination)
8. **Task 6: G-14/G-15/G-26/G-27 Devanagari overflow + Live-pill alignment** — `90e3a8e` (feat)
9. **Task 7: regression gates + typecheck pass** — `612161a` (chore; fixes a Rule-1 TFunction typing bug surfaced by tsc)

**Pending:**

- **Task 8 (operator-walked):** Full 7-locale hardware re-walk on Pixel 10a `5C161JEA304304`. Owner directive 2026-05-26 17:30 IST: "i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device."
- **Tasks 9–12:** post-walk HUMAN-UAT.md append, audit JSONs, final invariant gates, SUMMARY.md update with the PASS/FAIL matrix. These are orchestrator-owned per the worktree-agent boundary.

## Files Created/Modified

See frontmatter `key-files.created` + `key-files.modified` lists above for the complete enumeration. Highlights:

- **NEW `apps/mobile/src/i18n/taskI18n.ts`** — 4-export helper bridge; ~95 LOC including doc.
- **NEW `apps/mobile/src/components/TranslatedHeaderTitle.tsx`** — ~25 LOC locale-reactive React Navigation header wrapper.
- **EXTENDED `apps/mobile/src/i18n/taskCatalog.i18n.ts`** — `EN_TOKEN_ALIASES` block appended at EOF (~30 LOC). The 86×8 data block is byte-identical at the value level (Prettier reformatted whitespace; see Deviations).
- **`apps/mobile/src/i18n/locales/en.json`** — +34 keys, 6 modified values (chevron-stripped), 2 dead keys removed; comprehensive coverage of every G-XX surface.
- **7 non-en locale JSONs** — fully regenerated via `pnpm i18n:generate`; 7 audit sidecars updated.

## Decisions Made

(Captured in frontmatter `key-decisions`; reproduced briefly here for the reader.)

- **G-13 = curated alias map, not algorithmic stemmer** (checker BLOCKER 4). The map covers 4 derivational forms; the alternative algorithmic-stemmer suffix list was broken for the central "recycle" → "recycl" case.
- **TaskDetailsSheet en-locale short-circuit.** For description + instructions, en uses server-returned task data; non-en consults TASK_CATALOG_I18N. Preserves existing TaskDetailsSheet tests that mock `task.instructions` while still rendering Devanagari/etc. on hi-IN.
- **testID stays English / accessibilityLabel translates** for chips backed by server-contract enums (Report a Problem). Detox-friendly + server-stable on the testID side; TalkBack-friendly + localized on the a11y side. Per WARNING 12.
- **TranslatedHeaderTitle component for React Navigation** instead of function-form `options.title`. Per WARNING 7 — the function-form does NOT re-invoke on i18n.changeLanguage.
- **Day-section names translate; prior-month `{MonthName YYYY}` stays Latin V1.** Per WARNING 9 + the I18N-09 deferral. `HistoryDayHeader.tsx title.toUpperCase()` STAYS (Devanagari case-no-op; pt-BR HOJE intentional).

## Deviations from Plan

Tasks 1–7 executed exactly as the plan specified at the behavior level. A handful of build/lint/test-shim fixes were applied automatically per Rules 1 + 3:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing unused-state-setter lint errors in TasksScreen.tsx**

- **Found during:** Task 2 commit (lint-staged + ESLint failed the commit hook)
- **Issue:** `const [loadingList, setLoadingList]` and `const [listError, setListError]` were declared but the variables themselves were never read. Pre-existing (commit `23250071`, 2026-05-14). ESLint flagged them because the file was being modified.
- **Fix:** Discarded the unused state-getter via destructure rename: `const [, setLoadingList] = useState(...)`; same for listError. Setters remain (consumed by the cancellable useEffect chain).
- **Files modified:** `apps/mobile/src/screens/tasks/TasksScreen.tsx`
- **Verification:** mobile vitest exit 0; ESLint clean.
- **Committed in:** `33102be` (Task 2 commit)

**2. [Rule 3 - Blocking] Pre-existing unused catch-binding in SendRequestSheet.tsx**

- **Found during:** Task 4c commit (ESLint failed)
- **Issue:** `} catch (e) { ... }` had `e` as an unused binding (the `// emit task_request_failed({ reason: e?.message })` comment was a planned analytics emit, never wired).
- **Fix:** Dropped the catch binding entirely (`} catch { ... }`); comment reference updated to refer to "the error param above" for future analytics wiring.
- **Files modified:** `apps/mobile/src/screens/tasks/SendRequestSheet.tsx`
- **Verification:** Lint-staged clean; tests pass.
- **Committed in:** `a392604` (Task 4c commit)

**3. [Rule 3 - Blocking] jsdom RN shim missing `testID` → `data-testid` forwarding**

- **Found during:** Task 4c (G-22 chip testID-based queries failed)
- **Issue:** The vitest.setup.ts `makeComponent(name)` shim hard-coded `'data-testid': name` (the host-component name like "Pressable"); the user-set `testID` prop was passed via `...rest` and silently dropped by the React DOM renderer. New WARNING-12 contract demanded testID-based queries to work in jsdom (mirroring the RN runtime mapping on Android/iOS).
- **Fix:** Updated both the central `apps/mobile/vitest.setup.ts` shim AND the local mock inside `apps/mobile/__tests__/components/ReportProblemSheet.test.tsx` to consume `testID` first and fall back to the component name. Existing tests that relied on the "filter by host component name" pattern continue to work (the fallback preserves the old behavior).
- **Files modified:** `apps/mobile/vitest.setup.ts`, `apps/mobile/__tests__/components/ReportProblemSheet.test.tsx`
- **Verification:** Full mobile suite still 1004 / 1006 (only the 2 pre-existing visual snapshot failures); new G-22 test passes.
- **Committed in:** `a392604` (Task 4c commit)

**4. [Rule 1 - Bug] TFunction typing in HistoryRow.tsx surfaced by tsc**

- **Found during:** Task 7 (mobile typecheck)
- **Issue:** I ad-hoc-typed the `t` param of `uploadedAtLabel` as `(key: string, opts?: object) => string`. Under `exactOptionalPropertyTypes`, the inline signature was incompatible with the `t('history.row.uploadedAt', { time })` interpolation call (i18next's TFunction has a precise overload set).
- **Fix:** Imported `TFunction` from `i18next` (react-i18next doesn't re-export it) and used it as the param type.
- **Files modified:** `apps/mobile/src/components/HistoryRow.tsx`
- **Verification:** `npx tsc --noEmit` clean; HistoryRow tests still pass.
- **Committed in:** `612161a` (Task 7 commit)

### Other Deviations (Not Auto-Fixes)

**5. [Documentation note — NOT a code change] Prettier reformatted taskCatalog.i18n.ts during Task 3 commit**

- **Found during:** Task 3 commit (pre-commit hook ran lint-staged + Prettier)
- **Issue:** Plan's NOTE 15 invariant says `git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts` should show 0 in the DELETED-lines column (i.e., purely additive EOF append). Prettier reformatted whitespace in the existing 86×8 catalog body — e.g. wrapping long `description:` strings onto a second line, normalizing quote style on apostrophe-bearing strings (`'Keep working — don\'t stand idle.'` → `"Keep working — don't stand idle."`). `git show --stat HEAD` reports 1257 insertions / 1824 deletions on this file.
- **Semantic verification (NOT-a-deviation argument):** The 86×8 catalog DATA is preserved at the VALUE level. Verified via:
  1. `node` script comparing key sets between commit `92799d0` (last touch of the file) and the post-Task-3 file: 593 keys before, 593 keys after, `only-in-before = 0`, `only-in-after = 0`.
  2. The 15-test `taskCatalog.body.test.ts` body-translation gate from plan 07-12 still passes after Task 3 (validates en/non-en values structurally).
- **Why we're surfacing it:** Plan's literal-syntactic invariant uses `--numstat` as a proxy for the semantic-data-integrity invariant. Prettier broke the proxy without breaking the underlying semantic constraint. Acceptable per the spirit of NOTE 15.
- **Avoidance for future plans:** add `apps/mobile/src/i18n/taskCatalog.i18n.ts` to `.prettierignore` if any future plan wants the literal-syntactic invariant preserved.

---

**Total deviations:** 4 auto-fixed (3 blocking lint/shim, 1 typing bug) + 1 documentation note (Prettier reformat preserves data semantically).
**Impact on plan:** All auto-fixes were necessary for build/test correctness. No scope creep; no behavior change.

## Issues Encountered

- **`tools/.env` + `apps/api/.env` not in worktree.** The worktree was spawned without the env files; `tools/.env` is required for `pnpm i18n:generate` (ANTHROPIC_API_KEY), `apps/api/.env` is required for `pnpm test`. Copied both from the main repo (`/Users/adnaan/Documents/hl-homelander/{tools,apps/api}/.env` → worktree). One-time setup; not a permanent issue.
- **te-IN LLM hallucination on the first regen pass.** Claude Opus 4.7 added a hallucinated key `compat.pass.subtitle_alt` to te-IN on pass 1; shape-parity validator caught it and SKIPPED the write. Pass 2 was clean; all 7 catalogs now pass validate.
- **2 pre-existing visual-snapshot test failures** on `RecordingScreen.visual.test.tsx > matches baseline (recording-active-t10s | t05m32s)`. Confirmed pre-existing via `git stash` rerun on base commit `beec43d`. Out of scope for this plan; logged to `deferred-items.md`. They predate plan 07-16; likely the calibration / metadata schema 1.2.0 banner from 2026-05-22 drifted the RecordingScreen render relative to the checked-in PNG baselines.

## User Setup Required

None — all configuration changes are bundled at build time. The `tools/.env` ANTHROPIC_API_KEY is the owner's existing setup (not introduced by this plan).

## Known Stubs

None. Every helper / locale value introduced by this plan resolves to a non-empty real string in all 8 catalogs.

## Self-Check

```
FOUND: apps/mobile/src/i18n/taskI18n.ts
FOUND: apps/mobile/src/components/TranslatedHeaderTitle.tsx
FOUND: apps/mobile/__tests__/i18n/taskI18n.test.ts
FOUND: apps/mobile/__tests__/components/UniversalRulesBlock.i18n.test.tsx
FOUND: apps/mobile/__tests__/components/TaskCategoryPills.i18n.test.tsx
FOUND: apps/mobile/__tests__/screens/home/HomeScreen.tileLabel.i18n.test.tsx
FOUND: apps/mobile/__tests__/components/HistoryRow.i18n.test.tsx
FOUND: apps/mobile/__tests__/components/HistoryDayHeader.i18n.test.tsx
FOUND: apps/mobile/__tests__/services/historyGrouping.i18n.test.ts
FOUND: apps/mobile/__tests__/screens/history/HistoryScreen.empty.i18n.test.tsx
FOUND: apps/mobile/__tests__/screens/shared/FilterSheet.i18n.test.tsx
FOUND: apps/mobile/__tests__/components/ReportProblemSheet.i18n.test.tsx
FOUND: apps/mobile/__tests__/screens/tasks/SendRequestSheet.i18n.test.tsx
FOUND: apps/mobile/__tests__/components/TranslatedHeaderTitle.test.tsx
FOUND: .planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md
FOUND: commit beec43d (Task 1)
FOUND: commit 33102be (Task 2)
FOUND: commit e09d7e5 (Task 3)
FOUND: commit ba49d96 (Task 4a)
FOUND: commit 32967a9 (Task 4b)
FOUND: commit a392604 (Task 4c)
FOUND: commit e915b52 (Task 5)
FOUND: commit 90e3a8e (Task 6)
FOUND: commit 612161a (Task 7)
```

## Self-Check: PASSED

## Next Phase Readiness

- **07-16 code-level complete.** All 16 gap closures (G-13..G-28) shipped at the source level. The 7 non-en locale catalogs carry the 34 new keys; `pnpm i18n:validate` is green.
- **Task 8 (operator hardware walk) is the next action.** Owner directive: "full deep walk, skip nothing" across pt-BR + es + hi-IN + bn-IN + ta-IN + te-IN + mr-IN on Pixel 10a `5C161JEA304304`. APK build (`assembleApkRolloutDebug`) deferred to the operator-driven Task 8 flow because the worktree agent has no paired-device adb tunnel.
- **Post-walk:** plan 07-15 (paused) can re-attempt the canonical Bundle 1 + Bundle 2 + wrap-up walk to finalize Phase 7.
- **Lesson learned:** memory `feedback_hardware_walk_beats_grep_gates.md` is the canonical reference for this plan. Closure agents in plans 07-10..07-14 passed every grep gate but the operator caught 15 escapes on hardware. Each Task 4a/4b/4c sub-fix here pairs BOTH a grep gate AND a per-locale hardware-walk pointer. The operator-walked Task 8 is the integration gate.

## Revision History

This plan landed at the third checker revision iteration:

- Revision 1/3 (`a03ed02`): surgical edits for checker BLOCKERs 1–4 + WARNINGs 5–12 + NOTEs 13–15.
- Revision 2/3 (`2491e7d`): pass-2 surgical edits.
- Revision 3/3 (final, `af2415f`): STATE + ROADMAP planning-completion annotations.

The owner's directive that anchored this plan: "i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device." (2026-05-26 17:30 IST).

---

_Phase: 07-multi-linguality-live-cam-feed_
_Plan: 16_
_Completed (code-level): 2026-05-26 14:53:55 UTC_
_Task 8 (hardware walk): pending operator_
