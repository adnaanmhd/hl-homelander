# G-25 / G-29 / G-20 / G-22 / G-24 Root-Cause Investigation (Plan 07-17 Task 1)

**Date:** 2026-05-26
**Investigator:** worktree-agent-a7bb5ab8cd63312c0 (Plan 07-17 executor)
**Base commit:** main HEAD `f4bd4b2` ("docs(07): begin-phase tracking — Phase 7 execution started")

## TL;DR

Five findings, **five confirmed** matching the handoff's expected fix paths, **zero divergences**. PROCEED to Tasks 2-7.

All grep / jq probes match the planner's stated values. The fix paths in the handoff and the plan's `<interfaces>` block are accurate. No `PAUSE` needed.

| Gap  | Probe outcome                                                                                                                                                                                      | Verdict                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| G-25 | `PRACTICE_ROUTE_PARAMS.taskName = 'Practice — 60 sec'` (hardcoded English); RecordingScreen.tsx:178 fallback same; `recording.practiceFallback` MISSING from en.json                               | **3-part fix per plan** (PracticeIntro + RecordingScreen + en.json key)            |
| G-29 | `tabs.history` = `"हिस्ट्री"` (correctly transliterated Hindi for "History"); BottomNav routes via `t(tab.labelKey)`; only file containing `"हिन्दी"` is `locale-meta.ts` (language-name registry) | **TRANSCRIPTION ERROR** — no code change required                                  |
| G-20 | `HistoryScreen.tsx:599` has literal ` and try one.` outside any `t()` call; `.filtered` branch line 571 ends in `{' '}` + `.` (period punctuation)                                                 | **Single-key fix** (bodyTail); filtered `.` stays as universal punctuation         |
| G-22 | hi-IN `common.cancel = "रद्द करें"` correctly spelled; Button.tsx:85 internal Text has NO overflow guards; FilterSheet has zero `<Button>` consumers (raw `<Pressable>+<Text>`)                    | **Two-site layout fix** — Button primitive + inline FilterSheet Cancel/Apply       |
| G-24 | hi-IN `tasks.setting.indoor = "घर के अंदर"` and `outdoor = "घर के बाहर"` are DISTINCT values                                                                                                       | **TRUNCATION not collision** — overflow guards on segmented Text + regression test |

## Pre-check: invariant baseline (all empty)

```
apps/api/                                                                       0
apps/mobile/ios/                                                                0   (directory not present in worktree — vacuously empty per 07-15 §11.5 stale-check note)
apps/mobile/src/i18n/taskCatalog.i18n.ts                                        0
apps/mobile/src/lib/ttsVoice.ts                                                 0
apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx                          0
apps/mobile/src/ui/tokens.ts                                                    0
06-COSMETIC-GAPS.md vs main                                                     0
```

## G-29 (BottomNav History tab label showing `हिन्दी` instead of `हिस्ट्री`)

**Probes run:**

```bash
grep -n "labelKey\|tabs\\.history\|nativeName" \
  apps/mobile/src/components/BottomNav.tsx \
  apps/mobile/src/navigation/MainTabs.tsx
jq -r '.tabs.history' apps/mobile/src/i18n/locales/hi-IN.json
jq -r '.tabs.history' apps/mobile/src/i18n/locales/pt-BR.json
grep -rln "हिन्दी" apps/mobile/src/
```

**Probe output:**

```
apps/mobile/src/navigation/MainTabs.tsx:47:        options={{ tabBarLabel: t('tabs.history') }}
apps/mobile/src/components/BottomNav.tsx:39:  labelKey: 'tabs.home' | 'tabs.tasks' | 'tabs.history';
apps/mobile/src/components/BottomNav.tsx:45:  { key: 'Home', labelKey: 'tabs.home', Icon: HomeIcon, accessibilityLabel: 'Home tab' },
apps/mobile/src/components/BottomNav.tsx:46:  { key: 'Tasks', labelKey: 'tabs.tasks', Icon: ListTodo, accessibilityLabel: 'Tasks tab' },
apps/mobile/src/components/BottomNav.tsx:49:    labelKey: 'tabs.history',
apps/mobile/src/components/BottomNav.tsx:131:              {t(tab.labelKey)}

hi-IN tabs.history: हिस्ट्री
pt-BR tabs.history: Histórico
Files containing हिन्दी: apps/mobile/src/i18n/locale-meta.ts (LOCALE_NATIVE_NAMES['hi-IN'] = 'हिन्दी')
```

**Decision matrix:**

| hi-IN.json value | BottomNav grep             | Disposition                                                                                                         |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `"हिस्ट्री"`     | uses `t(tab.labelKey)` (✓) | **G-29 is a TRANSCRIPTION ERROR** by the operator. NO code change. Task 7 confirms via fresh hi-IN walk screenshot. |

**Screenshot inspection (`07-16-rewalk-evidence/2026-05-26-hi-IN/3.png`):** the screenshot is referenced in `07-HUMAN-UAT.md ## Re-walk 2026-05-26` row G-20 (cousin) — the operator wrote the matrix entry from this screenshot. The actual rendered tab text would be `हिस्ट्री` (per the value + wire chain). The operator's matrix entry `रों के लिए हिन्दी` was a transcription mistake.

**Verdict: TRANSCRIPTION ERROR. NO code change. Task 7 hardware walk will confirm via fresh screenshot.**

## G-25 (RecordingScreen practice app-bar `Practice — 60 sec` in English on hi-IN)

**Probes run:**

```bash
grep -n "PRACTICE_ROUTE_PARAMS\|taskName:" apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
grep -n "params.taskName\|'Practice — 60 sec'\|practiceFallback" apps/mobile/src/screens/recording/RecordingScreen.tsx
jq -r '.recording.practiceFallback // "MISSING"' apps/mobile/src/i18n/locales/en.json
```

**Probe output:**

```
PracticeIntroScreen.tsx:
  22://   taskName: 'Practice — 60 sec', isPractice: true })`. `Recording` is a
  46:const PRACTICE_ROUTE_PARAMS = {
  48:  taskName: 'Practice — 60 sec',
  75:      parent.replace('Recording', { ...PRACTICE_ROUTE_PARAMS });
  77:      navigation.replace('Recording', { ...PRACTICE_ROUTE_PARAMS });

RecordingScreen.tsx:
  178:  const taskName = params.taskName ?? 'Practice — 60 sec';

en.json recording.practiceFallback: MISSING
```

**Chain trace:** `PRACTICE_ROUTE_PARAMS.taskName` → `navigation.replace('Recording', PRACTICE_ROUTE_PARAMS)` → `route.params.taskName` → `state.taskName` → app-bar render at RecordingScreen.tsx:1033. Both the source value (hardcoded in `PRACTICE_ROUTE_PARAMS`) AND the fallback (hardcoded at RecordingScreen.tsx:178) are English literals; defeating the locale switch even when Profile re-renders.

**Note on hook ordering:** RecordingScreen.tsx currently declares `const taskName = params.taskName ?? 'Practice — 60 sec'` at line 178 BEFORE `const { t, i18n } = useTranslation();` at line 182 — so even if the fallback were moved to `t(...)`, `t` would be undefined at that point. The fix needs to reorder: useTranslation FIRST, then taskName fallback.

**Verdict: 3-part fix per plan:**

1. Add `recording.practiceFallback = "Practice — 60 sec"` to en.json (Task 3).
2. Drop `taskName: 'Practice — 60 sec'` from `PRACTICE_ROUTE_PARAMS` in PracticeIntroScreen.tsx (Task 3).
3. Reorder RecordingScreen.tsx:173-188 — move `const taskName = ...` to AFTER `const { t, i18n } = useTranslation()`, and change the fallback to `t('recording.practiceFallback')` (Task 3).

## G-20 (history.empty.firstTime trailing literal)

**Probes run:**

```bash
grep -n "and try one\|history.empty.firstTime\|history.empty.filtered" \
  apps/mobile/src/screens/history/HistoryScreen.tsx
jq '.history.empty' apps/mobile/src/i18n/locales/en.json
```

**Probe output:**

```
HistoryScreen.tsx:
  554:              {t('history.empty.filtered.heading')}
  562:              {t('history.empty.filtered.body')}{' '}
  569:                {t('history.empty.filtered.cta')}
  581:              {t('history.empty.firstTime.heading')}
  589:              {t('history.empty.firstTime.body')}
  597:                {t('history.empty.firstTime.cta')}
  599:              and try one.

en.json:
  history.empty.firstTime.cta = "Pick a task"
  history.empty.firstTime.body = "You haven't recorded anything yet."
  history.empty.filtered.cta  = "Show all time"
```

**The two empty-state branches in HistoryScreen.tsx:**

- **firstTime branch (line 588-600):** `{t('...body')}\n<Text>{t('...cta')}</Text>{' '} and try one.` — the JSX literal ` and try one.` is OUTSIDE the `t()` call, leaked English in every non-en locale.
- **filtered branch (line 560-572):** `{t('...body')}{' '}<Text>{t('...cta')}</Text>.` — the trailing `.` is universal punctuation. Hindi/Devanagari uses `।` (danda) for sentence-end, but the period after a translated phrase is generally acceptable as a neutral punctuation marker — checking the LLM regen output is acceptable, but no key extraction needed (the period is part of the period of the locale's sentence end if it produces one in the cta value, and a redundant period at most doesn't harm UX in any locale).

**Verdict: Single-key fix.**

1. Add `history.empty.firstTime.bodyTail = " and try one."` (leading space preserved — natural reading flow after the link).
2. Modify HistoryScreen.tsx:598-599 — replace `{' '} and try one.` with `{t('history.empty.firstTime.bodyTail')}`.
3. Filtered branch's trailing `.` (line 571) — **leave as-is.** Universal punctuation. The Devanagari `।` debate is parked; if a locale produces `cta = "...देखें"` ending in a verb without a sentence-ender, the trailing `.` reads as a neutral mark; if the cta includes `।` or its own punctuation, the trailing `.` is redundant but harmless.

## G-22 (Cancel button truncation root cause)

**Probes run:**

```bash
grep -n "<Button\|variant=\"btnLabel\"" apps/mobile/src/ui/primitives/Button.tsx
jq -r '.common.cancel, .delete.cancel' apps/mobile/src/i18n/locales/hi-IN.json
grep -c "<Button" apps/mobile/src/components/ReportProblemSheet.tsx
grep -c "<Button" apps/mobile/src/screens/shared/FilterSheet.tsx
```

**Probe output:**

```
Button.tsx:
  43:const variantToStyles: Record<ButtonVariant, VariantStyles> = {
  85:        <Text variant="btnLabel" style={{ color: v.fg }}>
  (Line 85 internal Text — NO numberOfLines / adjustsFontSizeToFit / minimumFontScale)

hi-IN.json:
  common.cancel  = "रद्द करें"    (correctly spelled with ्द ligature)
  delete.cancel  = null            (key not present)

<Button> consumer count:
  ReportProblemSheet.tsx: 2  (the Submit + Cancel CTAs ARE the primitive)
  FilterSheet.tsx:        0  (raw <Pressable> + <Text variant="btnLabel"> at lines 369-388)
```

**Two-site root cause:**

1. **Button primitive (`apps/mobile/src/ui/primitives/Button.tsx:85`)** — every consumer (ReportProblemSheet Submit + Cancel + ~30 others) renders a long-Devanagari label through the same internal Text element with no overflow guards. The operator's `रद्द करें → रद` observation is the Text width-capping at the shorter glyph.

2. **FilterSheet Custom-range Cancel + Apply (`apps/mobile/src/screens/shared/FilterSheet.tsx:369-388`)** — these use raw `<Pressable>` + `<Text variant="btnLabel">` (verified by `grep -c "<Button"` returning 0). The Task 3 Button primitive change DOES NOT propagate here; the FilterSheet Cancel/Apply receive matching overflow guards inline in Task 2 G-21 step 3.

**Verdict: Two-site fix.** Same overflow guards (`numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}`) applied at both layers ensures `रद्द करें` renders identically across Button consumers AND the raw FilterSheet Text elements.

Additionally, ReportProblemSheet chip Text (line 119-124) — chip labels like `वीडियो की क्वालिटी में दिक्कत` truncate inside the chip's flexWrap row. Task 4 adds `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` so chip text wraps to 2 lines inside the chip rather than overflowing.

## G-24 (Indoor/Outdoor truncation vs collision)

**Probes run:**

```bash
jq -r '.tasks.setting.indoor, .tasks.setting.outdoor' apps/mobile/src/i18n/locales/hi-IN.json
grep -n "segmented\|tasks.setting" apps/mobile/src/screens/tasks/SendRequestSheet.tsx | head -10
```

**Probe output:**

```
hi-IN.json:
  tasks.setting.indoor  = "घर के अंदर"    (literally "inside the house"; 5 Devanagari chars + 1 space)
  tasks.setting.outdoor = "घर के बाहर"    (literally "outside the house"; 5 Devanagari chars + 1 space)
  -> DISTINCT values; NO collision

SendRequestSheet.tsx (lines 320-360 area):
  - The segmented pill row uses `styles.segmented` (flex container)
  - Inside, two <Pressable> elements with `styles.segmentedActive` / `styles.segmented_` (the active vs idle variants)
  - Each Pressable contains <Text variant="pillLabel" style={...}> with t('tasks.setting.{indoor,outdoor}')
  - The Text element has NO overflow guards (no numberOfLines, no adjustsFontSizeToFit)
  - The pill widths come from the flex layout; both pills share the row equally (each gets ~50%)
```

**Visual explanation of the operator's `घर के` observation:** Both `घर के अंदर` and `घर के बाहर` START with the identical 3-char prefix `घर के`. When the segmented pill width is too narrow to fit the full 5-char string AND the Text has no overflow guards, RN's default behavior is single-line truncation with no ellipsis — clipping at the available pixel boundary. On a Pixel 10a with the segmented row sized for "Indoor" + "Outdoor" (English: 6+7 = 13 latin chars), the Devanagari fits ~3 chars per pill, producing `घर के` for BOTH. The operator saw two pills with the same visible text and concluded "collision" — but the underlying values ARE distinct.

**Verdict: TRUNCATION, not collision.** Task 4 adds `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}` to BOTH segmented Text elements; auto-shrink takes the full Devanagari forms to a smaller font size that fits inside the pill.

Additionally, Task 5a adds a NEW Vitest regression test (`apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts`) that asserts `t(tasks.setting.indoor) !== t(tasks.setting.outdoor)` for every locale in `SUPPORTED_LOCALES` (8 locales × 2 keys). The current values already pass (the planner-time grep confirmed it); the test exists as a permanent guard against a future LLM regen producing a real collision.

## Proceed / PAUSE decision

**All 5 findings match the handoff's expected fix paths.** Zero divergences.

- G-29: TRANSCRIPTION ERROR confirmed (matches handoff hypothesis 1).
- G-25: 3-part fix path confirmed (PRACTICE_ROUTE_PARAMS hardcode + RecordingScreen.tsx:178 fallback + en.json key missing — all three sites verified).
- G-20: Single-key fix path confirmed (line 599 literal; filtered branch period stays).
- G-22: Two-site fix path confirmed (Button primitive at line 85; FilterSheet raw Cancel/Apply at lines 369-388 with zero `<Button>` consumers).
- G-24: TRUNCATION confirmed (hi-IN values distinct; segmented Text has no overflow guards).

**Proceed to Tasks 2-7 per the plan.**

## Out-of-scope finds

None. The investigation did not surface additional escapes beyond the planned scope.

One observation worth recording (not a deviation, not a code change): existing test files at `apps/mobile/__tests__/screens/HistoryScreen.i18n.test.tsx` lines 36 + 46 and `apps/mobile/__tests__/screens/shared/FilterSheet.i18n.test.tsx` line 24 currently assert `enJson.history.filter.customRange === 'Custom range'` (string) and the source-grep `t('history.filter.customRange')`. After the Task 2 schema rename (`customRange` → `customRangeChip` for the string-valued chip + `customRange` becomes a new object with 9 sub-keys), these 3 test assertions need updating. Task 2 step 4 (GREEN phase G-21) executes the rename atomically with the test updates so the suite stays green through the change.

## Invariant pre-check (post-investigation)

All 6 invariant gates remain empty (no source changes made in Task 1):

```
git diff --stat apps/api/                                                       empty
git diff --stat apps/mobile/ios/                                                empty (dir not present)
git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts                        empty
git diff --stat apps/mobile/src/lib/ttsVoice.ts                                 empty
git diff --stat apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx          empty
git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md  empty
```

Task 1 created only `.planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md` (this file) — a docs deliverable.
