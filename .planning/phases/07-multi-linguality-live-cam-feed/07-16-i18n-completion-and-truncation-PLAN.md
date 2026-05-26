---
phase: 07-multi-linguality-live-cam-feed
plan: 16
type: execute
wave: 4
depends_on: [10, 11, 12, 13, 14]
files_modified:
  - apps/mobile/src/i18n/locales/en.json
  - apps/mobile/src/i18n/locales/pt-BR.json
  - apps/mobile/src/i18n/locales/es.json
  - apps/mobile/src/i18n/locales/hi-IN.json
  - apps/mobile/src/i18n/locales/bn-IN.json
  - apps/mobile/src/i18n/locales/ta-IN.json
  - apps/mobile/src/i18n/locales/te-IN.json
  - apps/mobile/src/i18n/locales/mr-IN.json
  - apps/mobile/src/i18n/locales/en.audit.json
  - apps/mobile/src/i18n/locales/pt-BR.audit.json
  - apps/mobile/src/i18n/locales/es.audit.json
  - apps/mobile/src/i18n/locales/hi-IN.audit.json
  - apps/mobile/src/i18n/locales/bn-IN.audit.json
  - apps/mobile/src/i18n/locales/ta-IN.audit.json
  - apps/mobile/src/i18n/locales/te-IN.audit.json
  - apps/mobile/src/i18n/locales/mr-IN.audit.json
  - apps/mobile/src/i18n/taskI18n.ts
  - apps/mobile/src/i18n/taskCatalog.i18n.ts
  - apps/mobile/src/i18n/reverseSearch.ts
  - apps/mobile/src/components/TaskCard.tsx
  - apps/mobile/src/components/TaskCategoryPills.tsx
  - apps/mobile/src/components/UniversalRulesBlock.tsx
  - apps/mobile/src/components/HistoryRow.tsx
  - apps/mobile/src/components/HistoryDayHeader.tsx
  - apps/mobile/src/components/ReportProblemSheet.tsx
  - apps/mobile/src/components/TranslatedHeaderTitle.tsx
  - apps/mobile/src/screens/tasks/TasksScreen.tsx
  - apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx
  - apps/mobile/src/screens/tasks/SendRequestSheet.tsx
  - apps/mobile/src/screens/history/HistoryScreen.tsx
  - apps/mobile/src/screens/home/HomeScreen.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/recording/components/RotatePrompt.tsx
  - apps/mobile/src/screens/compat/CompatRunningScreen.tsx
  - apps/mobile/src/services/historyGrouping.ts
  - apps/mobile/src/navigation/RootNativeStack.tsx
  - apps/mobile/src/i18n/__tests__/taskI18n.test.ts
  - apps/mobile/src/screens/tasks/__tests__/TasksScreen.i18n.test.tsx
  - apps/mobile/src/screens/tasks/__tests__/TaskDetailsSheet.i18n.test.tsx
  - apps/mobile/src/screens/tasks/__tests__/SendRequestSheet.i18n.test.tsx
  - apps/mobile/src/components/__tests__/ReportProblemSheet.i18n.test.tsx
  - apps/mobile/src/components/__tests__/UniversalRulesBlock.i18n.test.tsx
  - apps/mobile/src/components/__tests__/HistoryRow.i18n.test.tsx
  - apps/mobile/src/components/__tests__/HistoryDayHeader.i18n.test.tsx
  - apps/mobile/src/components/__tests__/TaskCategoryPills.i18n.test.tsx
  - apps/mobile/src/screens/history/__tests__/HistoryScreen.empty.i18n.test.tsx
  - apps/mobile/src/screens/home/__tests__/HomeScreen.tileLabel.i18n.test.tsx
  - apps/mobile/src/screens/shared/FilterSheet.tsx
  - apps/mobile/src/screens/shared/__tests__/FilterSheet.i18n.test.tsx
  - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
  - .planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md
autonomous: false
gap_closure: true
requirements:
  - I18N-01
  - I18N-10
  - I18N-11
# Trimmed from prior revision per checker BLOCKER 2: I18N-08 (error-code→toast — plan does NOT touch any error-code surface; the report categories are a feedback FORM, not API errors), I18N-09 (Intl date formatting — plan touches `formatUploadedAt` with raw `Date.getHours()` NOT Intl), I18N-12 (telemetry — plan does NOT touch telemetry), REC-LIVE-01 (live preview indicator with 'auto-hides in {N}s' — only RecordingScreen edits here are textAlign + 3 inline overflow props, not REC-LIVE-01's specific contract). I18N-21 is referenced as a SPEC-local invariant (Android-only; REQUIREMENTS.md only goes to I18N-12 per NOTE 13) — guarded by the invariant grep gates but not listed as a satisfied requirement.
tags: [i18n, gap-closure, mobile, layout, overflow, devanagari, search, rewalk]
must_haves:
  truths:
    - "G-13 closed: with locale=en, typing 'recyclable' / 'recyclables' / 'recycle' in TasksScreen search returns the 'Sorting recyclables' task. The fix is CLIENT-SIDE — a curated `EN_TOKEN_ALIASES` map appended to `taskCatalog.i18n.ts` (Path B per checker BLOCKER 4 recommendation — more reliable than algorithmic stemming for the curated 86-task catalog). reverseSearch.ts en branch consults the alias map and rewrites query tokens to a canonical form the server's `to_tsquery` matches. Server `ts_vector` route + drizzle migrations UNCHANGED (D-16). NO live HTTP probe step (no `/tasks/search` curl) — the fix is verified via a Vitest unit test of `reverseSearch('recyclable', 'en')` and the operator's hardware walk in Task 8."
    - "G-14 closed: CompatCheckScreen probe-label rows in hi-IN (and the other 6 non-en locales) render complete Devanagari strings — no clipping. Probe rows wrap to 2 lines when needed (`numberOfLines={2}` + `flexShrink: 1` in row + label-side flex container) so 'सेंसर का सही' renders as 'सेंसर का सही ढंग से काम करना' (or the LLM-translated full form)."
    - 'G-15 closed: the ''Live preview'' indicator pill — JSX site at RecordingScreen.tsx ~line 1018 (`<Text variant="caption" style={styles.liveLabelText}>`); StyleSheet at ~line 1287 (`liveLabelText`). Fix is at the StyleSheet: `liveLabelText: { color: colors.accent, textAlign: ''center'' }`. The parent `liveBottomCenter` View (~line 1276) already centers via `alignItems: ''center''` + `left: 0, right: 0`; the new `textAlign: ''center''` centers GLYPHS within the pill''s padding. Confirmed visually on hardware in Task 8.'
    - 'G-16 closed: HomeScreen tile period-chip renders translated. The BUG SITE is `HomeScreen.tsx:tileLabel(named, custom)` at line ~150 — a switch statement with 6 hardcoded English literals (`''today ▾''`, `''yesterday ▾''`, `''this week ▾''`, `''this month ▾''`, `''all time ▾''`, `''custom range ▾''`). Fix: SIX new `home.filter.{today,yesterday,thisWeek,thisMonth,allTime,customRange}` keys carry ONLY the text portion (e.g. `"today"` — NOT `"today ▾"`); the chevron `▾` stays in the JSX/return template (`return ${t(''home.filter.today'')} ▾`) so the chevron stays consistent across locales. The existing `home.filter.*` block in en.json (per the existing `home.filter` dict with `"today": "today ▾"` etc.) is REPLACED with chevron-stripped values (existing keys are owned by this plan — `git diff` will show the 6 values losing their ` ▾` suffix). The switch arms (`case ''today'':` etc.) stay; only the returned literal becomes a `t()`-interpolated string + ` ▾`. `StatCard.tsx` does NOT exist and is NOT touched (per checker BLOCKER 1 — the original plan''s path was wrong). `ContributionTile.tsx` just passes `rangeLabel` through unchanged.'
    - "G-17 closed: TasksScreen category filter chips (TaskCategoryPills) render translated. `TASK_CATEGORY_PILLS` constant in `TaskCategoryPills.tsx` stays as the canonical English enum (it's a route/state value, not a display label), but the `pillLabel(value)` resolver routes each value through new `tasks.category.{cooking|dishwashing|kitchen|cleaning|tidying|laundry|gardening|petCare|homeMaintenance|hobby}` i18n keys plus `tasks.category.all`. 11 new en keys + 7 LLM-regen passes."
    - 'G-18 closed (KEYSTONE): TasksScreen task cards render translated task names + categories + descriptions. Root cause investigated in Task 1 and recorded in 07-16-INVESTIGATION.md — `TasksScreen.tsx:206-207` reads `item.name` + `item.category` directly from the SERVER `/tasks` response (English-only catalog, per I18N-10 + D-16 lock). The fix is a NEW client-side helper `apps/mobile/src/i18n/taskI18n.ts` that exports `localizeTaskName(canonicalEn, locale): string` + `localizeTaskCategory(category, locale): string` + `localizeTaskDescription(canonicalEn, locale): string` — all driven by `TASK_CATALOG_I18N` from `taskCatalog.i18n.ts`. TasksScreen + TaskCard then wrap the server-returned `item.name`/`item.category`/`item.description` through these helpers at the render site. Catalog already carries 86×7 = 602 translated bodies (07-12); this plan wires them to the rendering path.'
    - "G-19 closed (downstream of G-18): TaskDetailsSheet renders translated task name + category eyebrow (the `task.category.toUpperCase()` at line 119) + description + the 4 ALWAYS rules (`UniversalRulesBlock.tsx` line 47-50 — 4 hardcoded English `label:` strings: 'Keep your hands in frame' / 'Mount the device firmly on the rig' / 'Make sure your space is well-lit' / 'Close all other apps before you start') + per-task instructions. Universal-rule labels move to new `rules.universal.{handsInFrame|mountDevice|wellLit|closeApps}` i18n keys. Task-specific instructions resolve through the same `taskI18n.ts` helpers."
    - "G-20 closed: HistoryScreen empty-state body (line 577 'Your recordings will live here.' + the sibling subtitle + the 'Pick a task' link at line 592) renders via `t('history.empty.firstTime.{heading|body|cta}')` and `t('history.empty.filtered.{heading|body|cta}')` (two distinct empty states per HIST-04 + HIST-05 comments in the source). The keys partially exist (`history.emptyHeading`/`emptyBody` per existing en.json line ~150) — verify which subset and extend; if both states share keys, split them."
    - "G-21 closed: the shared `FilterSheet.tsx` (lines 53-60) options array literals — `'Today'` / `'Yesterday'` / `'This week'` / `'This month'` / `'All time'` / `'Custom range'` — plus the sheet title 'Filter by' move through `t('history.filterSheet.title')` + `t('history.filter.{today|yesterday|thisWeek|thisMonth|allTime|customRange}')`. The existing `history.filter.*` block in en.json has 6 keys already (today/yesterday/thisWeek/thisMonth/allTime/customRange — all 6 present per planner-time `jq` check). Reuse them; add only `history.filterSheet.title`."
    - "G-22 closed: ReportProblemSheet renders translated category chips. `FEEDBACK_CATEGORIES` in `feedbackService.ts` stays as the canonical English enum (it's the server contract — submitted as-is per I18N-08 'server stays English'), but the chip render at `ReportProblemSheet.tsx:87-105` routes each value through new `report.category.{appCrashed|taskDoesntStart|uploadStuck|loginIssue|videoQualityIssue|imuIssue|thermalIssue|other}` keys (8 new keys). Display labels are intentionally simpler than the raw enum (`imu-issue` → 'Sensor issue', `thermal-issue` → 'Device overheating') — noted here so QA does NOT flag as mistranslation (per checker WARNING 8). The chip's `testID` `category-${value}` STAYS English (server-contract / test ID); the `accessibilityLabel` ALSO routes through `t(REPORT_CATEGORY_LABEL_KEY[c])` so screen-reader users (TalkBack/VoiceOver) hear the chip in their locale (per checker WARNING 12 — `accessibilityLabel ≠ testID`)."
    - 'G-23 closed: ''Help Center'' app-bar title — `RootNativeStack.tsx:114-116` `options={{ headerShown: true, title: ''Help Center'' }}` changes to use a NEW `TranslatedHeaderTitle.tsx` component (per checker WARNING 7 — function-form options DO NOT re-invoke on locale change because React Navigation re-runs them only on screen-prop change, NOT on global state changes). The fix: `options={{ headerShown: true, headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" /> }}` where `TranslatedHeaderTitle` is a tiny component that calls `useTranslation()` and re-renders on locale change. Add `helpCenter.title` to en.json if missing.'
    - "G-24 closed: SendRequestSheet renders translated category chips + Indoor/Outdoor segmented toggle (lines 291-308). Reuse the new `tasks.category.*` keys from G-17 for the chip labels. Add new `tasks.setting.{indoor|outdoor}` keys for the segmented toggle. The form eyebrows `TASK NAME / DESCRIPTION / CATEGORY / SETTING` are already routed through `t('sendRequest.label.*')` (per the existing `t(...)` pattern in the file — verify) OR they're hardcoded uppercase Latin (planner-time grep confirmed `t('report.labelCategory')` exists in ReportProblemSheet, so SendRequest likely follows the same pattern — if any literal remains, add the key)."
    - "G-25 closed (downstream of G-18): RecordingScreen task-name in app-bar (line 1033 `{state.taskName}`) renders translated. The `state.taskName` value is set at line 178 (`const taskName = params.taskName ?? 'Practice — 60 sec'`) from the `Recording` navigation params — which are populated by `TaskDetailsSheet.tsx` when the user taps 'Start Recording'. Fix at the source: TaskDetailsSheet passes the localized name (via `taskI18n.ts` helper) as the navigation param, so `state.taskName` is already-localized by the time RecordingScreen reads it. The fallback `'Practice — 60 sec'` also moves to `t('recording.practiceFallback')`."
    - 'G-26 closed: RotatePrompt.tsx body text container allows Devanagari to wrap to 2 lines OR auto-shrinks. The fix: `<Text variant="body" style={styles.body} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{t(''recording.rotatePrompt'')}</Text>`. No new design tokens. Operator visually re-confirms the hi-IN string `फ़ोन को घुमाकर लैंडस्केप करें और रिग पर लगाएँ` (or the LLM regen value) renders complete on the Pixel 10a.'
    - 'G-27 closed: hand-gate prompt at RecordingScreen.tsx:1090 (`<Text variant="recGatePrompt" style={styles.gatePrompt}>`) gains `numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}` so the hi-IN string `फ़ोन को सिर पर लगाएँ और 2 सेकंड तक अपने हाथ फ़्रेम में रखें` (or LLM regen value) renders complete. The `recGatePrompt` text variant in `ui/tokens.ts` is NOT modified — only the inline style props on the call site change.'
    - 'G-28 closed: HistoryRow.tsx `formatUploadedAt(d)` (line ~280-284) — the hardcoded string `"Uploaded at HH:MM"` becomes `t(''history.row.uploadedAt'', { time: ''HH:MM'' })`. The ''FEEDBACK (COMING SOON)'' uppercase eyebrow (likely in HistoryRow.tsx) moves to `t(''history.row.feedbackComingSoon'')`. The ''TODAY'' day-header eyebrow: PLANNER MAKES THE CALL (per checker WARNING 9) — the section titles (''Today'' / ''Yesterday'' / ''This week'' / ''This month'' + the `{MonthName YYYY}` prior-month label) are emitted by `services/historyGrouping.ts` `groupByDay()` (lines ~96-103 push hardcoded English literals). Add SIX new `history.daySection.{today,yesterday,thisWeek,thisMonth,older,custom}` keys (the actual section enum is ''Today'' | ''Yesterday'' | ''This week'' | ''This month'' | `{MonthName YYYY}` — for prior months we keep the `{MonthName YYYY}` Latin form for V1; only the 4 named sections get t() lookups). Replace the hardcoded section names in `historyGrouping.ts` with `t(...)` lookups (the service takes `t` as an optional param OR imports the i18n singleton — pick the second for fewer call-site changes). KEEP the `.toUpperCase()` in `HistoryDayHeader.tsx:37` (preserves design; Devanagari is a no-op for casing; pt-BR gets `HOJE` instead of `Hoje` — intentional design choice). For prior-month labels (''April 2026''), defer Intl-based locale formatting to v2 (out of scope here per the I18N-09 drop in BLOCKER 2).'
    - 'Operator-walked 7-locale hardware re-walk PASSES on Pixel 10a: pt-BR + es + hi-IN + bn-IN + ta-IN + te-IN + mr-IN — every gap surface from G-13..G-28 visually confirmed PASS per locale, recorded row-by-row in 07-HUMAN-UAT.md under a fresh `## Re-walk 2026-XX-XX` block.'
    - 'Non-negotiable invariants green: iOS untouched (I18N-21 SPEC-local invariant, Android-only) — `git diff --stat apps/mobile/ios/` empty; NO backend changes (D-16) — `git diff --stat apps/api/` empty (this includes drizzle/migrations + routes + schema); Phase-6 cosmetic gaps untouched VS THE CLUSTER-HEAD COMMIT `5879daf` (per checker WARNING 11 — the file already drifted on `main` from the renumber sweep `db5e721`, so comparing against `main` is self-defeating) — the gate is `git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty (I18N-11); ultrawide lens code + HevcEncoder + FinalizeWorker + MetadataComposer + RealtimeGate UNCHANGED (CLAUDE.md drift + cancel banners); `taskCatalog.i18n.ts` data byte-identical for the 86×8 catalog block — the new `EN_TOKEN_ALIASES` export appended at EOF is the ONLY addition (per checker NOTE 15 — `git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts` shows 0 DELETED lines).'
  artifacts:
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md
      provides: 'Task 1 deliverable — the recorded root-cause finding for G-18 (where the TasksScreen / TaskDetailsSheet / RecordingScreen task-data actually flows from + the chosen fix path)'
      contains: 'Root cause'
    - path: apps/mobile/src/i18n/taskI18n.ts
      provides: 'NEW client-side localization helper. Exports `localizeTaskName(canonicalEn: string, locale: string): string`, `localizeTaskCategory(category: string, locale: string): string`, `localizeTaskDescription(canonicalEn: string, locale: string): string`, `localizeTaskInstructions(canonicalEn: string, locale: string): string[]`. All driven by `TASK_CATALOG_I18N` from `taskCatalog.i18n.ts`. Returns the canonical English when the locale entry is missing (graceful fallback per D-12 i18next key-fallback pattern). The category helper consults the new `tasks.category.*` i18n keys via `i18n.t(...)`.'
      contains: 'localizeTaskName'
    - path: apps/mobile/src/components/TranslatedHeaderTitle.tsx
      provides: 'NEW tiny component that wraps `useTranslation()` + `<Text>{t(i18nKey)}</Text>`, designed for React Navigation `options.headerTitle` so the header re-renders on global i18n.changeLanguage. Used by RootNativeStack for HelpCenter (G-23 per checker WARNING 7).'
      contains: 'TranslatedHeaderTitle'
    - path: apps/mobile/src/i18n/locales/en.json
      provides: 'Master English catalog extended with ~34 new keys covering: `tasks.category.{all,cooking,dishwashing,kitchen,cleaning,tidying,laundry,gardening,petCare,homeMaintenance,hobby,other}` (12), `tasks.setting.{indoor,outdoor}` (2), `rules.universal.{handsInFrame,mountDevice,wellLit,closeApps}` (4), `report.category.{appCrashed,taskDoesntStart,uploadStuck,loginIssue,videoQualityIssue,imuIssue,thermalIssue,other}` (8), `history.filterSheet.title`, `history.row.uploadedAt` (with `{{time}}` interpolation), `history.row.feedbackComingSoon`, `history.empty.firstTime.{heading,body,cta}`, `history.empty.filtered.{heading,body,cta}`, `history.daySection.{today,yesterday,thisWeek,thisMonth}` (4), `recording.practiceFallback`, `helpCenter.title` (if missing). PLUS: 6 existing `home.filter.*` values are REPLACED with chevron-stripped versions (text-only; chevron stays in JSX template per G-16 fix)."'
      contains: 'tasks.category'
    - path: apps/mobile/src/i18n/locales/hi-IN.json
      provides: 'Hindi catalog regenerated by `pnpm i18n:generate` after en.json updates — shape parity with en.json + non-empty Devanagari values for every new key.'
      contains: 'tasks.category'
    - path: apps/mobile/src/components/UniversalRulesBlock.tsx
      provides: '`UNIVERSAL_RULES` array values change from `label: "Keep your hands in frame"` (hardcoded English) to `labelKey: "rules.universal.handsInFrame"`; render at line 60 uses `t(rule.labelKey)`.'
      contains: 'labelKey'
    - path: apps/mobile/src/screens/tasks/TasksScreen.tsx
      provides: 'Task card render at lines 206-207 wraps `item.name` + `item.category` through `localizeTaskName(item.name, i18n.language)` + `localizeTaskCategory(item.category, i18n.language)`.'
      contains: 'localizeTaskName'
    - path: apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx
      provides: 'Renders translated name/category/description/instructions via taskI18n.ts helpers. The hardcoded `task.category.toUpperCase()` at line 119 is replaced with `localizeTaskCategory(task.category, i18n.language).toUpperCase()` (or the helper itself returns the uppercase-translated form — planner picks). The navigation param `taskName` passed to RecordingScreen is the localized form.'
      contains: 'localizeTaskName'
    - path: apps/mobile/src/screens/home/HomeScreen.tsx
      provides: '`tileLabel(named, custom)` switch at line ~150: each `case` returns `${t("home.filter.<named>")} ▾` instead of a hardcoded English literal. The 6 switch arms (today/yesterday/this-week/this-month/all/custom) stay — only the returned string changes. The custom-pick branch (`return ${startLbl} – ${endLbl} ▾`) stays Latin (Intl-based locale formatting deferred per I18N-09 drop).'
      contains: "t('home.filter."
    - path: apps/mobile/src/services/historyGrouping.ts
      provides: '`groupByDay()` (lines ~96-103) pushes localized section titles: `push(t("history.daySection.today"), r)` instead of `push("Today", r)`. The service imports the i18n singleton at top (`import i18n from "../i18n"`) so the helper signature does NOT change.'
      contains: 'history.daySection'
    - path: apps/mobile/src/screens/recording/components/RotatePrompt.tsx
      provides: 'Text element gains `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` so Devanagari renders complete (G-26).'
      contains: 'numberOfLines'
    - path: apps/mobile/src/screens/recording/RecordingScreen.tsx
      provides: 'gatePrompt Text (line ~1090) gains the same overflow-safe props (G-27); liveLabelText StyleSheet block (line ~1287) gains `textAlign: "center"` (G-15). Three call-site edits + one StyleSheet line. (JSX site for the live label is at line ~1018 — the only edit at that line is verifying the existing variant/style ref stays the same; the actual fix is one line down in the StyleSheet block at ~1287.)'
      contains: 'liveLabelText'
    - path: apps/mobile/src/components/HistoryRow.tsx
      provides: 'formatUploadedAt rewritten to use `t("history.row.uploadedAt", { time })` (G-28).'
      contains: 'history.row.uploadedAt'
    - path: apps/mobile/src/screens/shared/FilterSheet.tsx
      provides: 'OPTIONS array hardcoded literals routed through t() at render time (G-21).'
      contains: 'history.filter'
    - path: apps/mobile/src/navigation/RootNativeStack.tsx
      provides: 'HelpCenter screenOptions.title replaced with `headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" />` (G-23 — fixes the function-form options locale-staleness per checker WARNING 7).'
      contains: 'TranslatedHeaderTitle'
    - path: apps/mobile/src/i18n/taskCatalog.i18n.ts
      provides: 'New `EN_TOKEN_ALIASES: Record<string, string>` exported at EOF (additive only — 0 DELETED lines in `git diff --numstat`). Curated alias map for English derivational forms: recyclable/recyclables/recycle → recyclables; chopping/chop → chopping; etc. The G-13 fix — `reverseSearch.ts` en branch consults this map.'
      contains: 'EN_TOKEN_ALIASES'
    - path: apps/mobile/src/i18n/reverseSearch.ts
      provides: 'en branch (was `if (locale === "en") return input`) now rewrites each whitespace-split token through `EN_TOKEN_ALIASES[tok.toLowerCase()] ?? tok` before joining. Non-en branches byte-identical.'
      contains: 'EN_TOKEN_ALIASES'
  key_links:
    - from: apps/mobile/src/screens/tasks/TasksScreen.tsx
      to: apps/mobile/src/i18n/taskI18n.ts
      via: 'localizeTaskName(item.name, i18n.language) + localizeTaskCategory(item.category, i18n.language)'
      pattern: 'localizeTaskName\\(item\\.name'
    - from: apps/mobile/src/i18n/taskI18n.ts
      to: apps/mobile/src/i18n/taskCatalog.i18n.ts
      via: 'TASK_CATALOG_I18N[canonicalEn]?.[locale]?.name (with English-fallback)'
      pattern: 'TASK_CATALOG_I18N'
    - from: apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx
      to: apps/mobile/src/i18n/taskI18n.ts
      via: 'localizeTaskName/Category/Description/Instructions all four helpers'
      pattern: 'localizeTask'
    - from: apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx
      to: apps/mobile/src/screens/recording/RecordingScreen.tsx
      via: 'navigation.navigate("Recording", { taskName: localizeTaskName(task.name, i18n.language), ... }) — RecordingScreen reads the already-localized name from params'
      pattern: 'taskName: localizeTaskName'
    - from: apps/mobile/src/components/UniversalRulesBlock.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: 't(rule.labelKey) where labelKey ∈ rules.universal.{handsInFrame,mountDevice,wellLit,closeApps}'
      pattern: 'rules.universal'
    - from: apps/mobile/src/screens/home/HomeScreen.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "tileLabel switch arms return `${t('home.filter.<named>')} ▾` (chevron preserved in JSX template)"
      pattern: "t\\('home\\.filter\\."
    - from: apps/mobile/src/services/historyGrouping.ts
      to: apps/mobile/src/i18n/locales/en.json
      via: "push(i18n.t('history.daySection.today'), r) — 4 section titles localized"
      pattern: 'history.daySection'
    - from: apps/mobile/src/components/HistoryRow.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: 't("history.row.uploadedAt", { time: "HH:MM" })'
      pattern: 'history.row.uploadedAt'
    - from: apps/mobile/src/components/ReportProblemSheet.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: 't(`report.category.${toCamel(value)}`) for the chip TEXT AND the accessibilityLabel (testID stays English)'
      pattern: 'report.category'
    - from: apps/mobile/src/screens/tasks/SendRequestSheet.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: 't(`tasks.category.${toCamel(value)}`) for chips + t(`tasks.setting.${value}`) for Indoor/Outdoor'
      pattern: 'tasks.setting'
    - from: apps/mobile/src/navigation/RootNativeStack.tsx
      to: apps/mobile/src/components/TranslatedHeaderTitle.tsx
      via: 'headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" /> — locale-reactive header'
      pattern: 'TranslatedHeaderTitle'
    - from: apps/mobile/src/i18n/reverseSearch.ts
      to: apps/mobile/src/i18n/taskCatalog.i18n.ts
      via: 'EN_TOKEN_ALIASES[tok.toLowerCase()] ?? tok — curated alias map (NOT algorithmic stemming, per checker BLOCKER 4)'
      pattern: 'EN_TOKEN_ALIASES'
---

<objective>
**Gap closure plan for 16 escapes (G-13..G-28) surfaced by the operator-walked Wave-3 re-verification (plan 07-15) on Pixel 10a hi-IN, 2026-05-26.** The Phase 7 cluster 07-10..07-14 passed every narrow grep gate the closure agents wrote and merged at commit `5879daf`, but the operator's eyes caught 15 new English-on-translated-surface escapes (G-14..G-28) the closure agents' grep gates did not. Together with the previously-parked G-13 (server `ts_vector` tokenizer behavior on derivational forms — but D-16 forbids backend changes, so this plan solves G-13 client-side via a curated alias map) these are the 16 gaps.

**The keystone gap is G-18** (TasksScreen task cards in English): plan 07-12 claimed 602 LLM translations landed in `taskCatalog.i18n.ts` and the `taskCatalog.body.test.ts` 15/15 PASS confirmed it. But TasksScreen showed English on hardware. Planner-time grep proves why: `TasksScreen.tsx:206-207` reads `item.name` + `item.category` straight from the server response (`fetchTasks` / `searchTasks` in `tasksApi.ts`) — NOT from the client-side `TASK_CATALOG_I18N`. Per locked decisions I18N-10 + D-16, **the server stays English** (no DB migration, no route change) — the client localizes by looking the server-returned canonical English name UP in `TASK_CATALOG_I18N` keyed by `task.name`. That client-side lookup helper does not exist yet; this plan adds it (`apps/mobile/src/i18n/taskI18n.ts`) and wires every render site (TasksScreen card, TaskDetailsSheet, RecordingScreen task-title via navigation param, HistoryRow task-name via the same path).

**Revision iteration 1/3 fixes (per checker feedback 2026-05-26):**

- **BLOCKER 1:** G-16 fix path corrected — `StatCard.tsx` does NOT exist; the bug site is `HomeScreen.tsx:tileLabel` (line ~150) with 6 hardcoded English literals. SIX new `home.filter.*` text-only values (chevron `▾` stays in JSX template) overwrite the existing 6 chevron-laden values in `home.filter.*`.
- **BLOCKER 2:** `requirements:` trimmed from `[I18N-01, I18N-08, I18N-09, I18N-10, I18N-11, I18N-12, REC-LIVE-01]` to `[I18N-01, I18N-10, I18N-11]`.
- **BLOCKER 3:** Task 3 probe step DROPPED — no live HTTP probe (the dev API requires auth; the bypass header was fictional). G-13 is verified via Vitest unit tests + the operator's hardware walk in Task 8.
- **BLOCKER 4:** Algorithmic `EN_STEM_SUFFIXES` REPLACED with a curated `EN_TOKEN_ALIASES` map (more reliable for the 86-task catalog; the original suffix list had duplicates and was broken for the central 'recycle' case).
- **WARNING 7:** G-23 fix uses a NEW `TranslatedHeaderTitle` component (function-form `options` DO NOT re-invoke on locale change; locale switch from Profile sheet does not trigger a navigator re-render).
- **WARNING 9:** G-28 'TODAY' day-header decision MADE — translate via 4 new `history.daySection.*` keys; keep `.toUpperCase()` in `HistoryDayHeader.tsx`.
- **WARNING 5:** Task 4 split into 3 sub-tasks (4a + 4b + 4c).
- **WARNING 6:** G-15 line numbers corrected: JSX at ~1018, StyleSheet at ~1287 (the fix is on the StyleSheet line).
- **WARNING 11:** Phase-6 cosmetic-gaps invariant compares against `5879daf` (cluster HEAD), not `main`.
- **WARNING 12:** G-22 accessibilityLabel now also translates (only `testID` stays English).
- **WARNINGs 8, 10**: G-22 enum→display mapping documented; Task 5 ANTHROPIC_API_KEY missing-fallback explicit.

**Task ordering (10 tasks after Task-4 split, mostly autonomous + a final operator-walked task):**

1. Task 1 (investigation): root-cause G-18 and record finding in `07-16-INVESTIGATION.md`. Branch the rest of the plan from the recorded finding.
2. Task 2 (G-18/G-19/G-25 keystone): build `taskI18n.ts` helper + wire TasksScreen + TaskCard + TaskDetailsSheet + UniversalRulesBlock + RecordingScreen task-name path. Includes the en.json keys for the 4 ALWAYS rules.
3. Task 3 (G-13 client-side): append `EN_TOKEN_ALIASES` to `taskCatalog.i18n.ts` + wire reverseSearch en branch. The fix is CLIENT-SIDE — D-16 holds. No HTTP probe.
4. Task 4a (G-16 + G-17 t() wires for home + tasks chips).
5. Task 4b (G-20 + G-21 + G-28 t() wires for history empty + filter sheet + row + day-section names).
6. Task 4c (G-22 + G-23 + G-24 t() wires for report + help + send).
7. Task 5 (LLM regen): run `pnpm i18n:generate` to regen 7 non-English catalogs with the new keys. Validate shape parity.
8. Task 6 (G-14/G-26/G-27 overflow + G-15 alignment): layout fixes on 3 Text containers (numberOfLines + adjustsFontSizeToFit + minimumFontScale) + 1 textAlign flip on `liveLabelText`.
9. Task 7 (regression test + APK build): post-merge JS test + invariant gates + fresh APK on Pixel 10a.
10. Task 8 (OPERATOR-WALKED): full 7-locale hardware re-walk on Pixel 10a per the owner's directive "skip nothing" — pt-BR + es + hi-IN + bn-IN + ta-IN + te-IN + mr-IN, every gap surface, every locale. Records PASS/FAIL row-by-row in a fresh `## Re-walk 2026-XX-XX` block in `07-HUMAN-UAT.md`.

**Non-negotiable invariants:**

- iOS untouched (I18N-21 SPEC-local invariant).
- NO backend changes (D-16 + I18N-10) — server `/tasks/search` route + `ts_vector` config + drizzle migrations + apps/api source UNCHANGED. G-13's fix is client-side.
- Phase-6 cosmetic-gaps doc untouched VS COMMIT `5879daf` (the cluster HEAD; `main` already drifted via `db5e721` renumber sweep — per checker WARNING 11).
- Ultrawide lens / HevcEncoder / FinalizeWorker / MetadataComposer / RealtimeGate UNCHANGED (CLAUDE.md drift + cancel banners).
- `apps/mobile/src/i18n/taskCatalog.i18n.ts` 86×8 catalog block BYTE-IDENTICAL — the 602 LLM translations from 07-12 stay. The new `EN_TOKEN_ALIASES` export is APPENDED at the bottom of the file (verified via `git diff --numstat` showing `+N\t0\t` — 0 DELETED lines, per NOTE 15).
- Owner deviation guard: `RigTutorialScreen.tsx` camera-framing tip preserved.
- TTS owner deviation (en-US baseline) preserved: `ttsVoice.ts` untouched.

**The lesson this plan internalizes (from `feedback_hardware_walk_beats_grep_gates.md`):** the closure agents passed every grep gate but the operator's eyes caught 15 escapes. Each Task 4a/4b/4c / Task 6 sub-fix includes BOTH a grep gate AND a per-locale hardware-walk pointer. The operator-walked Task 8 is the integration gate.

Output: a build where every surface from G-13..G-28 renders correctly in every locale, and the 07-HUMAN-UAT.md Re-walk block records the verdicts. After this plan, 07-15 (paused) can re-attempt the canonical Bundle 1 + Bundle 2 + wrap-up walk to finalize Phase 7.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-15-PAUSE.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-11-i18n-sweep-extension-PLAN.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-11-SUMMARY.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-12-SUMMARY.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-13-SUMMARY.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-14-SUMMARY.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-14-COSMETIC-PLAN.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@apps/mobile/src/i18n/locales/en.json
@apps/mobile/src/i18n/taskCatalog.i18n.ts
@apps/mobile/src/i18n/reverseSearch.ts
@apps/mobile/src/services/tasksApi.ts
@apps/mobile/src/services/historyGrouping.ts
@apps/mobile/src/screens/tasks/TasksScreen.tsx
@apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx
@apps/mobile/src/screens/tasks/SendRequestSheet.tsx
@apps/mobile/src/screens/history/HistoryScreen.tsx
@apps/mobile/src/screens/home/HomeScreen.tsx
@apps/mobile/src/screens/recording/RecordingScreen.tsx
@apps/mobile/src/screens/recording/components/RotatePrompt.tsx
@apps/mobile/src/screens/compat/CompatRunningScreen.tsx
@apps/mobile/src/screens/shared/FilterSheet.tsx
@apps/mobile/src/navigation/RootNativeStack.tsx
@apps/mobile/src/components/TaskCard.tsx
@apps/mobile/src/components/TaskCategoryPills.tsx
@apps/mobile/src/components/UniversalRulesBlock.tsx
@apps/mobile/src/components/HistoryRow.tsx
@apps/mobile/src/components/HistoryDayHeader.tsx
@apps/mobile/src/components/ReportProblemSheet.tsx
@apps/mobile/src/services/feedbackService.ts
@tools/i18n/generate.ts
@tools/i18n/validate.ts
@CLAUDE.md

<interfaces>
<!-- Contracts the executor must respect — no codebase scavenger-hunt needed. -->

From apps/mobile/src/i18n/taskCatalog.i18n.ts (line 43-67):

```typescript
export interface TaskBody {
  name: string;
  description: string;
  instructions: string[];
  examples: string[];
}

export interface ReverseMap {
  fullStringMap: Record<string, string>;
  tokenMap: Record<string, string>;
}

// Keyed by CANONICAL ENGLISH name (e.g. 'Cooking a meal', 'Sorting recyclables').
// The server returns task.name === canonical English (per I18N-10 + D-16 lock).
export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = {
  'Cooking a meal': {
    en: { name: 'Cooking a meal', description: '...', instructions: [...], examples: [] },
    'pt-BR': { name: 'Preparar uma refeição', ... },
    'hi-IN': { name: 'खाना पकाना', ... },
    // ... all 7 non-en locales populated by plan 07-12
  },
  // ... 85 more entries
};
```

From apps/mobile/src/screens/home/HomeScreen.tsx (lines 150-176 — the bug site for G-16, per checker BLOCKER 1):

```tsx
/** Build the lowercase chevron-down label per UI-SPEC §Tile filter labels (§9c). */
function tileLabel(named: NamedRange, custom: { start: string; end: string } | null): string {
  switch (named) {
    case 'today':
      return 'today ▾';
    case 'yesterday':
      return 'yesterday ▾';
    case 'this-week':
      return 'this week ▾';
    case 'this-month':
      return 'this month ▾';
    case 'all':
      return 'all time ▾';
    case 'custom': {
      if (custom == null) return 'custom range ▾';
      // ... custom date-range formatting (stays as-is for V1)
    }
  }
}
```

After (the switch arms STAY; only the returned string changes; the chevron `▾` is preserved in the template per checker BLOCKER 1 recommendation):

```tsx
function tileLabel(
  named: NamedRange,
  custom: { start: string; end: string } | null,
  t: TFunction,
): string {
  switch (named) {
    case 'today':
      return `${t('home.filter.today')} ▾`;
    case 'yesterday':
      return `${t('home.filter.yesterday')} ▾`;
    case 'this-week':
      return `${t('home.filter.thisWeek')} ▾`;
    case 'this-month':
      return `${t('home.filter.thisMonth')} ▾`;
    case 'all':
      return `${t('home.filter.allTime')} ▾`;
    case 'custom': {
      if (custom == null) return `${t('home.filter.customRange')} ▾`;
      // ... existing custom date-range formatting unchanged (Intl-based locale formatting deferred per I18N-09 drop)
    }
  }
}
// Call site at line ~396 (`tileLabel(homeRange, homeRangeCustom)`) becomes `tileLabel(homeRange, homeRangeCustom, t)` — pass the destructured t from useTranslation().
```

en.json `home.filter.*` keys (REPLACING the existing chevron-laden values):

```json
{
  "home": {
    "filter": {
      "today": "today",
      "yesterday": "yesterday",
      "thisWeek": "this week",
      "thisMonth": "this month",
      "allTime": "all time",
      "customRange": "custom range"
    }
  }
}
```

(The existing values were `"today ▾"` etc. The chevron now lives in the JSX template, not the i18n string. This is an OWNED change to `home.filter.*` — `git diff -- apps/mobile/src/i18n/locales/en.json` will show 6 modified lines.)

From apps/mobile/src/screens/tasks/TasksScreen.tsx (lines 200-210 — the bug site for G-18):

```tsx
const renderTaskItem: ListRenderItem<Task> = ({ item }) => (
  <TaskCard
    taskId={item.taskId}
    name={item.name} // <-- BUG (G-18): item.name from server, English.
    category={item.category} // <-- BUG (G-18): item.category from server, English enum.
    onPress={() => handleCardPress(item)}
  />
);
```

After this plan:

```tsx
const renderTaskItem: ListRenderItem<Task> = ({ item }) => (
  <TaskCard
    taskId={item.taskId}
    name={localizeTaskName(item.name, i18n.language)}
    category={localizeTaskCategory(item.category, i18n.language)}
    onPress={() => handleCardPress(item)}
  />
);
```

From apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx (line ~119 — the eyebrow):

```tsx
<Text>{task.category.toUpperCase()}</Text>
```

After:

```tsx
<Text>{localizeTaskCategory(task.category, i18n.language).toUpperCase()}</Text>
```

From apps/mobile/src/components/UniversalRulesBlock.tsx (lines 46-50 — the 4 hardcoded English ALWAYS rules):

```typescript
export const UNIVERSAL_RULES: readonly UniversalRule[] = [
  { icon: 'front_hand', label: 'Keep your hands in frame', lucide: HandMetal },
  { icon: 'videocam', label: 'Mount the device firmly on the rig', lucide: Video },
  { icon: 'lightbulb', label: 'Make sure your space is well-lit', lucide: Lightbulb },
  { icon: 'apps', label: 'Close all other apps before you start', lucide: LayoutGrid },
];
```

After:

```typescript
export const UNIVERSAL_RULES: readonly UniversalRule[] = [
  { icon: 'front_hand', labelKey: 'rules.universal.handsInFrame', lucide: HandMetal },
  { icon: 'videocam', labelKey: 'rules.universal.mountDevice', lucide: Video },
  { icon: 'lightbulb', labelKey: 'rules.universal.wellLit', lucide: Lightbulb },
  { icon: 'apps', labelKey: 'rules.universal.closeApps', lucide: LayoutGrid },
];
// And the render at line 60 changes from {rule.label} to {t(rule.labelKey)}.
```

From apps/mobile/src/components/TaskCategoryPills.tsx (lines 22-48):

```typescript
export const TASK_CATEGORY_PILLS = [
  'all',
  'Cooking',
  'Dishwashing',
  'Kitchen',
  'Cleaning',
  'Tidying',
  'Laundry',
  'Gardening',
  'Pet Care',
  'Home Maintenance',
  'Hobby',
] as const;
export type TaskCategoryPill = (typeof TASK_CATEGORY_PILLS)[number];

// Render-only label resolver. The const above stays as the canonical enum.
function pillLabel(value: TaskCategoryPill): string {
  return value === 'all' ? 'All' : value;
}
```

After (the const STAYS — it's a state value; only the render-time resolver changes):

```typescript
function pillLabel(value: TaskCategoryPill, t: TFunction): string {
  const keyMap: Record<TaskCategoryPill, string> = {
    all: 'tasks.category.all',
    Cooking: 'tasks.category.cooking',
    Dishwashing: 'tasks.category.dishwashing',
    Kitchen: 'tasks.category.kitchen',
    Cleaning: 'tasks.category.cleaning',
    Tidying: 'tasks.category.tidying',
    Laundry: 'tasks.category.laundry',
    Gardening: 'tasks.category.gardening',
    'Pet Care': 'tasks.category.petCare',
    'Home Maintenance': 'tasks.category.homeMaintenance',
    Hobby: 'tasks.category.hobby',
  };
  return t(keyMap[value]);
}
```

From apps/mobile/src/services/historyGrouping.ts (lines ~96-103 — the day-section bug site for G-28):

```typescript
if (d >= startOfToday) {
  push('Today', r);
} else if (d >= startOfYesterday) {
  push('Yesterday', r);
} else if (d >= startOfWeekCutoff) {
  push('This week', r);
} else if (sameMonth) {
  push('This month', r);
}
```

After (the service imports `i18n` from `../i18n` at top; sections drawn from `t('history.daySection.*')`):

```typescript
import i18n from '../i18n';

// ...

if (d >= startOfToday) {
  push(i18n.t('history.daySection.today'), r);
} else if (d >= startOfYesterday) {
  push(i18n.t('history.daySection.yesterday'), r);
} else if (d >= startOfWeekCutoff) {
  push(i18n.t('history.daySection.thisWeek'), r);
} else if (sameMonth) {
  push(i18n.t('history.daySection.thisMonth'), r);
}
// Prior-month label (currently `{MonthName YYYY}`) stays Latin V1 — Intl-locale formatting deferred per I18N-09 drop.
```

`HistoryDayHeader.tsx:37` — `{title.toUpperCase()}` STAYS as-is (Devanagari is a no-op for casing; pt-BR gets `HOJE` — intentional design choice per checker WARNING 9).

From apps/mobile/src/components/HistoryRow.tsx (line 277-284):

```typescript
/** "Uploaded at HH:MM" — uses verifiedAtIso when present, else createdAt fallback. */
function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `Uploaded at ${hh}:${mm}`;
}
```

After (the function takes `t` as a param OR is replaced with an inline render):

```typescript
function formatUploadedAt(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return t('history.row.uploadedAt', { time: `${hh}:${mm}` });
}
```

en.json gains: `"history": { "row": { "uploadedAt": "Uploaded at {{time}}" } }`.

From apps/mobile/src/components/ReportProblemSheet.tsx (lines 83-105) + apps/mobile/src/services/feedbackService.ts (lines 38-45):

```typescript
// feedbackService.ts — the canonical enum. STAYS English (server contract per I18N-08).
export const FEEDBACK_CATEGORIES = [
  'app-crashed', 'task-doesnt-start', 'upload-stuck', 'login-issue',
  'video-quality-issue', 'imu-issue', 'thermal-issue', 'other',
] as const;

// ReportProblemSheet.tsx — the chip render at lines 87-105 currently:
{FEEDBACK_CATEGORIES.map((c) => {
  // ...
  return (
    <Pressable
      testID={`category-${c}`}                    // <-- STAYS English (server contract / test ID).
      accessibilityLabel={`category-${c}`}        // <-- BUG (G-22 + checker WARNING 12): screen-reader hears English.
      ...
    >
      <Text>{c}</Text>   {/* <-- BUG (G-22): renders the raw enum value */}
    </Pressable>
  );
})}
```

After (the enum stays — only the rendered LABEL + accessibilityLabel change):

```typescript
const REPORT_CATEGORY_LABEL_KEY: Record<FeedbackCategory, string> = {
  'app-crashed': 'report.category.appCrashed',
  'task-doesnt-start': 'report.category.taskDoesntStart',
  'upload-stuck': 'report.category.uploadStuck',
  'login-issue': 'report.category.loginIssue',
  'video-quality-issue': 'report.category.videoQualityIssue',
  'imu-issue': 'report.category.imuIssue',
  'thermal-issue': 'report.category.thermalIssue',
  other: 'report.category.other',
};
// And the render at line 98 becomes:
//   <Pressable
//     testID={`category-${c}`}                       // English, server contract / test ID
//     accessibilityLabel={t(REPORT_CATEGORY_LABEL_KEY[c])}  // translated for TalkBack/VoiceOver
//   >
//     <Text>{t(REPORT_CATEGORY_LABEL_KEY[c])}</Text>
//   </Pressable>
//
// QA note (per checker WARNING 8): the display labels are intentionally simpler than the raw enum
// ('imu-issue' → 'Sensor issue', 'thermal-issue' → 'Device overheating') for UX clarity; the server
// still receives the raw 'imu-issue' / 'thermal-issue' enum verbatim per I18N-10.
```

From apps/mobile/src/screens/shared/FilterSheet.tsx (lines 53-60):

```typescript
const OPTIONS: ReadonlyArray<{ value: NamedRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom-pick', label: 'Custom range' },
];
```

After (the `value` stays as the state key; `label` becomes `labelKey`):

```typescript
const OPTIONS: ReadonlyArray<{ value: NamedRange; labelKey: string }> = [
  { value: 'today', labelKey: 'history.filter.today' },
  { value: 'yesterday', labelKey: 'history.filter.yesterday' },
  { value: 'this-week', labelKey: 'history.filter.thisWeek' },
  { value: 'this-month', labelKey: 'history.filter.thisMonth' },
  { value: 'all', labelKey: 'history.filter.allTime' },
  { value: 'custom-pick', labelKey: 'history.filter.customRange' },
];
// Render call sites: {t(opt.labelKey)}. Sheet title: {t('history.filterSheet.title')}.
// NOTE: en.json `history.filter.*` block already has these 6 keys (planner-time `jq` check confirmed).
```

From apps/mobile/src/navigation/RootNativeStack.tsx (lines 114-116):

```typescript
<Stack.Screen
  name="HelpCenter"
  component={HelpCenterScreen}
  options={{ headerShown: true, title: 'Help Center' }}
/>
```

After (per checker WARNING 7 — function-form options do NOT re-invoke on locale change because RN re-runs them only on screen-prop change. Solution: use `headerTitle` with a translated component that re-renders on locale change):

```typescript
<Stack.Screen
  name="HelpCenter"
  component={HelpCenterScreen}
  options={{
    headerShown: true,
    headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" />,
  }}
/>
```

`apps/mobile/src/components/TranslatedHeaderTitle.tsx` (NEW file — small wrapper):

```tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import Text from '../ui/primitives/Text';

export interface TranslatedHeaderTitleProps {
  i18nKey: string;
}

/** Re-renders on i18n.changeLanguage — use inside React Navigation `options.headerTitle`
 *  so the header re-localizes when the user switches locales from Profile (G-23). */
export function TranslatedHeaderTitle({ i18nKey }: TranslatedHeaderTitleProps): React.JSX.Element {
  const { t } = useTranslation();
  return <Text variant="headerTitle">{t(i18nKey)}</Text>;
}

export default TranslatedHeaderTitle;
```

(Use whichever `Text` variant the existing header uses — verify in `HelpCenterScreen.tsx` at execution time; if there's no specific variant, default to `body` + bold weight.)

From apps/mobile/src/screens/recording/components/RotatePrompt.tsx (line ~108):

```tsx
<Text variant="body" style={styles.body}>
  {t('recording.rotatePrompt')}
</Text>
```

After:

```tsx
<Text
  variant="body"
  style={styles.body}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.85}
>
  {t('recording.rotatePrompt')}
</Text>
```

From apps/mobile/src/screens/recording/RecordingScreen.tsx (line ~1090 — hand-gate prompt):

```tsx
<Text variant="recGatePrompt" style={styles.gatePrompt}>
  {t('recording.gatePrompt')}
</Text>
```

After:

```tsx
<Text
  variant="recGatePrompt"
  style={styles.gatePrompt}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.85}
>
  {t('recording.gatePrompt')}
</Text>
```

From apps/mobile/src/screens/recording/RecordingScreen.tsx — Live indicator (G-15 per checker WARNING 6):

- JSX at line ~1018:
  ```tsx
  <View style={styles.liveLabelPill}>
    <Text variant="caption" style={styles.liveLabelText}>
      ...
    </Text>
  </View>
  ```
- StyleSheet at line ~1287 (THE FIX SITE):
  ```typescript
  liveLabelText: { color: colors.accent },
  ```

After (only the StyleSheet line changes; JSX is untouched):

```typescript
liveLabelText: { color: colors.accent, textAlign: 'center' },
```

The parent `liveBottomCenter` View (line ~1276) ALREADY centers its children via `alignItems: 'center'` + `left: 0, right: 0`. The new `textAlign: 'center'` centers GLYPHS within the pill's padding (distinct concern from centering the pill itself).

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Investigate G-18 root cause and record findings in 07-16-INVESTIGATION.md (blocking for Task 2)</name>
  <files>.planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md</files>
  <read_first>
    - apps/mobile/src/screens/tasks/TasksScreen.tsx (full file, especially lines 200-210 — the bug site for G-18)
    - apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx (full file, especially around line 119)
    - apps/mobile/src/services/tasksApi.ts (the fetchTasks + useTaskSearch + searchTasks signatures)
    - apps/mobile/src/i18n/taskCatalog.i18n.ts (lines 43-67 — the TASK_CATALOG_I18N shape) + grep for the catalog key for "Sorting recyclables" / "Folding towels or bedsheets" / "Chopping" / "Slicing" — the entries the operator's evidence screenshots showed in English
    - apps/mobile/src/i18n/reverseSearch.ts (full file — the existing locale → English query rewrite)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 170-200 (where state.taskName is initialized from params)
    - apps/mobile/src/components/HistoryRow.tsx full file (HistoryRow renders the task name in the History list, line 318 area)
    - apps/api/src/routes/tasks/ — the server endpoint that returns the task list. CONFIRM (do NOT modify) that the server returns canonical English `name` + `category` per I18N-10 + D-16. Read-only inspection only — note in the investigation doc but do NOT touch.
    - .planning/REQUIREMENTS.md line 290 (I18N-10 — "UI displays translated names; backend ts_vector GIN search stays English-only")
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md D-15 + D-16 (catalog as single source of truth; no backend changes)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-12-SUMMARY.md (the catalog body translation that landed; confirm 602 slots populated)
  </read_first>
  <action>
    1. **Confirm the catalog has the data.** Run:
       ```bash
       grep -n "खाना पकाना\|Sorting recyclables\|कचरा\|Folding towels" apps/mobile/src/i18n/taskCatalog.i18n.ts | head -10
       ```
       Expected: at least one Devanagari match per task that should have a hi-IN translation. If matches show the catalog DOES have the translations → root cause is rendering-path; proceed with the helper-wiring approach. If catalog is still English-skeleton → root cause is 07-12 didn't actually translate those entries; redirect Task 2 to fix the catalog file first.

    2. **Trace the render path.** Run:
       ```bash
       grep -nE "item\.name|item\.category|task\.name|task\.category|state\.taskName|taskName=" apps/mobile/src/screens/tasks/TasksScreen.tsx apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx apps/mobile/src/screens/recording/RecordingScreen.tsx apps/mobile/src/components/HistoryRow.tsx apps/mobile/src/components/TaskCard.tsx | head -25
       ```
       Map each render site to its data source (server response / navigation param / context). Document which sites need to be wrapped with `localizeTaskName` / `localizeTaskCategory`.

    3. **Confirm the server returns English.** Run:
       ```bash
       grep -nE "name:|category:" apps/api/src/routes/tasks/*.ts 2>/dev/null | head -20
       grep -rnE "TASK_CATALOG|taskCatalog" apps/api/src/ 2>/dev/null | head -10
       ```
       If the server is English-only (expected per I18N-10 + D-16), record the finding. If the server has a locale param (unexpected; would imply 07-12 also touched the API), note the deviation.

    4. **Write `.planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md`** with the following structure:

       ```markdown
       # G-18 Root Cause Investigation (Plan 07-16 Task 1)

       **Date:** 2026-05-26
       **Investigator:** {executor agent}

       ## TL;DR
       {Client-side wiring gap | Catalog-file gap | Server gap} — the actual finding.

       ## Catalog status
       {grep results — does taskCatalog.i18n.ts contain the hi-IN translations for the 6 cards visible in img-4?}

       ## Render-path trace
       {Table of every render site that displays task name/category/description, plus its data source}

       ## Server status
       {Confirmed: server returns English-only name+category per I18N-10 + D-16. No backend changes proposed.}

       ## Chosen fix path
       {Detailed description of the helper interface + the call sites to update, including the exact line numbers.}

       ## Out-of-scope
       {Anything that surfaced during the investigation but doesn't belong in 07-16 — e.g. additional gaps the planner missed.}
       ```

    5. **If the investigation reveals a deviation from the planner's expected root cause** (e.g. the catalog IS still skeleton-English for the operator's hi-IN cards, OR the server already has a locale param the plan didn't account for): PAUSE and surface to the user with the alternate fix path. Do NOT proceed to Task 2 silently with a wrong assumption.

  </action>
  <verify>
    <automated>test -f .planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md && grep -cE "## TL;DR|## Catalog status|## Render-path trace|## Server status|## Chosen fix path" .planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md</automated>
  </verify>
  <acceptance_criteria>
    - `07-16-INVESTIGATION.md` exists with the 5 required H2 sections.
    - The TL;DR identifies the root cause as one of: client-side wiring gap / catalog-file gap / server gap. The planner's expected finding is "client-side wiring gap" (the catalog has the data, TasksScreen reads from the server response without lookup).
    - The render-path trace table covers all 4 render sites: TasksScreen card / TaskDetailsSheet body / RecordingScreen task-name app-bar / HistoryRow task-name.
    - The server status section EXPLICITLY records that the server endpoint is read-only inspected (no changes proposed), preserving D-16.
    - The chosen fix path section lists EXACT line numbers for each call site to update + the EXACT helper interface (`localizeTaskName(canonicalEn, locale) -> string`, etc.).
    - `git diff --stat apps/api/` empty at end of Task 1 (no backend reads modified anything).
  </acceptance_criteria>
  <done>Root cause documented in 07-16-INVESTIGATION.md; Task 2 has a concrete fix-path to execute against. If the investigation reveals an unexpected root cause, Task 2 is BLOCKED and surfaces to the user for a decision.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build taskI18n.ts helper + wire G-18 / G-19 / G-25 task-data localization (keystone)</name>
  <files>apps/mobile/src/i18n/taskI18n.ts, apps/mobile/src/i18n/__tests__/taskI18n.test.ts, apps/mobile/src/screens/tasks/TasksScreen.tsx, apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx, apps/mobile/src/components/UniversalRulesBlock.tsx, apps/mobile/src/components/__tests__/UniversalRulesBlock.i18n.test.tsx, apps/mobile/src/screens/tasks/__tests__/TasksScreen.i18n.test.tsx, apps/mobile/src/screens/tasks/__tests__/TaskDetailsSheet.i18n.test.tsx, apps/mobile/src/i18n/locales/en.json</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-16-INVESTIGATION.md (Task 1 output — the recorded fix path)
    - apps/mobile/src/i18n/taskCatalog.i18n.ts lines 43-67 (TASK_CATALOG_I18N shape)
    - apps/mobile/src/i18n/reverseSearch.ts (existing helper pattern — taskI18n.ts mirrors its export style and module-load preference)
    - apps/mobile/src/screens/tasks/TasksScreen.tsx lines 200-210 (the bug site)
    - apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx full file (line ~119 + the description/instructions render block — verify which fields are currently rendered from `task.*` vs from a static array)
    - apps/mobile/src/components/TaskCard.tsx (the consumer of TasksScreen's localized values)
    - apps/mobile/src/components/UniversalRulesBlock.tsx lines 46-65 (UNIVERSAL_RULES + render at line 60)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 170-200 (where `state.taskName` is set — confirm taskName comes from navigation params NOT from a hook that re-reads the server)
    - apps/mobile/src/i18n/storage.ts (the `Locale` type — taskI18n.ts must reuse it)
    - apps/mobile/__tests__/i18n/taskCatalog.body.test.ts (the existing 15-assertion gate from 07-12 — write taskI18n.test.ts in the same style)
  </read_first>
  <behavior>
    - **NEW file `apps/mobile/src/i18n/taskI18n.ts`** with these exports:
      ```typescript
      import { TASK_CATALOG_I18N, type TaskBody } from './taskCatalog.i18n';
      import type { Locale } from './storage';
      import i18n from './';  // the bootstrap singleton; used for category labels which live in locale JSON

      /**
       * Resolve canonical-English task name to active-locale display name.
       * Returns the canonical English when the locale entry is missing or unmapped (D-12 fallback).
       */
      export function localizeTaskName(canonicalEn: string, locale: string): string {
        const entry = TASK_CATALOG_I18N[canonicalEn]?.[locale as Locale];
        return entry?.name ?? canonicalEn;
      }

      /**
       * Resolve canonical-English category enum ('Cooking', 'Dishwashing', ...) to active-locale label.
       * The category lives in the en.json + LLM-regen catalogs under `tasks.category.*`, NOT in TASK_CATALOG_I18N.
       */
      export function localizeTaskCategory(category: string, locale: string): string {
        // Map canonical English category enum to its i18n key.
        // KEEP IN SYNC with TaskCategoryPills.tsx pillLabel().
        const keyMap: Record<string, string> = {
          'all': 'tasks.category.all',
          'Cooking': 'tasks.category.cooking',
          'Dishwashing': 'tasks.category.dishwashing',
          'Kitchen': 'tasks.category.kitchen',
          'Cleaning': 'tasks.category.cleaning',
          'Tidying': 'tasks.category.tidying',
          'Laundry': 'tasks.category.laundry',
          'Gardening': 'tasks.category.gardening',
          'Pet Care': 'tasks.category.petCare',
          'Home Maintenance': 'tasks.category.homeMaintenance',
          'Hobby': 'tasks.category.hobby',
          'Other': 'tasks.category.other',
        };
        const key = keyMap[category];
        if (!key) return category;
        return i18n.getFixedT(locale)(key, { defaultValue: category });
      }

      export function localizeTaskDescription(canonicalEn: string, locale: string): string {
        const entry = TASK_CATALOG_I18N[canonicalEn]?.[locale as Locale];
        return entry?.description ?? TASK_CATALOG_I18N[canonicalEn]?.en.description ?? '';
      }

      export function localizeTaskInstructions(canonicalEn: string, locale: string): string[] {
        const entry = TASK_CATALOG_I18N[canonicalEn]?.[locale as Locale];
        return entry?.instructions ?? TASK_CATALOG_I18N[canonicalEn]?.en.instructions ?? [];
      }
      ```

    - **`apps/mobile/src/i18n/__tests__/taskI18n.test.ts`** — 8-assertion vitest suite mirroring `taskCatalog.body.test.ts` pattern:
      - Test 1: `localizeTaskName('Cooking a meal', 'hi-IN')` returns `'खाना पकाना'`
      - Test 2: `localizeTaskName('Cooking a meal', 'en')` returns `'Cooking a meal'`
      - Test 3: `localizeTaskName('Cooking a meal', 'pt-BR')` returns `'Preparar uma refeição'`
      - Test 4: `localizeTaskName('Unknown task name xyz', 'hi-IN')` returns `'Unknown task name xyz'` (fallback to canonical en)
      - Test 5: `localizeTaskCategory('Cooking', 'hi-IN')` returns the i18n.t value (mock i18n to assert the call shape)
      - Test 6: `localizeTaskDescription('Cooking a meal', 'hi-IN')` returns a non-empty Devanagari string
      - Test 7: `localizeTaskInstructions('Cooking a meal', 'hi-IN')` returns an array of 3 Devanagari strings
      - Test 8: missing-locale fallback for description + instructions returns the en entries (not empty / not undefined)

    - **Wire `TasksScreen.tsx` lines 200-210**: add `import { useTranslation } from 'react-i18next'` if not present, destructure `i18n` from `useTranslation()`, wrap `item.name` + `item.category` through the helpers. Pass `i18n.language` not a hardcoded locale.

    - **Wire `TaskDetailsSheet.tsx`** (one or more sites): the category eyebrow at line 119 (`task.category.toUpperCase()` → `localizeTaskCategory(task.category, i18n.language).toUpperCase()`). The task name render (find it — likely a `<Text>{task.name}</Text>` near the eyebrow). The description render (find it — likely a `<Text>{task.description}</Text>`). The instructions render (find it — likely a `.map(instr => <Text>{instr}</Text>)`). Also: when the user taps "Start Recording" in the sheet, the `navigation.navigate('Recording', { taskName: ..., taskId: ... })` call MUST pass `taskName: localizeTaskName(task.name, i18n.language)` so RecordingScreen receives the localized name as a param (closes G-25 without touching RecordingScreen's state.taskName chain).

    - **Wire `UniversalRulesBlock.tsx`** lines 46-65: change `UniversalRule` shape from `{ icon, label, lucide }` to `{ icon, labelKey, lucide }`. Update the const at lines 46-50 with the 4 new labelKey values. The render at line 60 (`<Text>{rule.label}</Text>`) becomes `<Text>{t(rule.labelKey)}</Text>` — add `useTranslation` import at top of file. Add a unit test asserting the 4 rules' labelKey strings.

    - **Extend `en.json`** with the new keys:
      ```json
      {
        "rules": {
          "universal": {
            "handsInFrame": "Keep your hands in frame",
            "mountDevice": "Mount the device firmly on the rig",
            "wellLit": "Make sure your space is well-lit",
            "closeApps": "Close all other apps before you start"
          }
        },
        "tasks": {
          "category": {
            "all": "All",
            "cooking": "Cooking",
            "dishwashing": "Dishwashing",
            "kitchen": "Kitchen",
            "cleaning": "Cleaning",
            "tidying": "Tidying",
            "laundry": "Laundry",
            "gardening": "Gardening",
            "petCare": "Pet Care",
            "homeMaintenance": "Home Maintenance",
            "hobby": "Hobby",
            "other": "Other"
          }
        }
      }
      ```
      (Other keys for G-20..G-24/G-28 are added in Task 4a/4b/4c — this task only adds the keys for G-18/G-19's universal-rules + the canonical category enum that downstream tasks will also reuse.)

    - **Tests**:
      - `TasksScreen.i18n.test.tsx`: render TasksScreen with a mock `fetchTasks` returning `[{ taskId: 'x', name: 'Cooking a meal', category: 'Cooking', ... }]` and i18n.language='hi-IN'; assert the rendered `<TaskCard name="...">` prop is `'खाना पकाना'` (or assert `localizeTaskName` is called with `('Cooking a meal', 'hi-IN')`).
      - `TaskDetailsSheet.i18n.test.tsx`: render with the same mock task, locale='hi-IN'; assert the eyebrow text is the Hindi category, description text is Hindi, instructions array maps to Hindi strings.
      - `UniversalRulesBlock.i18n.test.tsx`: assert `UNIVERSAL_RULES[0].labelKey === 'rules.universal.handsInFrame'` (etc.); render-time t() call uses the labelKey.

  </behavior>
  <action>
    1. **Read the Task 1 investigation finding.** If it says "client-side wiring gap" (expected), proceed. If it says anything else, PAUSE and surface to user.

    2. **RED phase (tdd): write taskI18n.test.ts FIRST** with all 8 assertions. Run `pnpm -r --parallel test --filter "@humyn/mobile"` and confirm the 8 new tests FAIL (the helper doesn't exist).

    3. **GREEN phase: create `apps/mobile/src/i18n/taskI18n.ts`** with the 4 exports per the behavior block. Re-run the test suite — the 8 tests should now PASS.

    4. **Wire TasksScreen.tsx** at lines 200-210 with the helpers. Confirm `useTranslation` is imported (it likely is — line 34 of the file).

    5. **Wire TaskDetailsSheet.tsx** at all 4 render sites: category eyebrow (line ~119), task name, description, instructions. Also wire the `navigation.navigate('Recording', { taskName: ... })` call site to pass the localized name (this is the G-25 fix piggy-backed on G-19).

    6. **Wire UniversalRulesBlock.tsx**: rename `label` to `labelKey` in the const + the type def at line 37; update the 4 values; update the render at line 60.

    7. **Extend en.json** with `rules.universal.*` (4) + `tasks.category.*` (12). DO NOT regen non-en locales yet — that's Task 5.

    8. **Write the 3 component-level i18n tests** (TasksScreen, TaskDetailsSheet, UniversalRulesBlock). Mirror the test infra pattern from `apps/mobile/src/components/__tests__/LanguageSheet.test.tsx`.

    9. **Run the full mobile test suite** per memory `feedback_post_merge_test_env.md`:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -30
       ```
       Confirm exit 0.

    10. **Invariant checks**:
        ```bash
        git diff --stat apps/mobile/ios/        # empty (I18N-21)
        git diff --stat apps/api/                # empty (D-16)
        git diff --stat apps/mobile/android/    # empty (Android JS-only edits in this task)
        # The 86×8 catalog DATA must be byte-identical; only Task 3's EOF append is allowed.
        # For Task 2, no diff at all:
        git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts  # empty
        git diff --stat apps/mobile/src/lib/ttsVoice.ts  # empty (TTS owner-deviation guard)
        ```
        All five should return empty for this task.

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/src/i18n/taskI18n.ts` exists with 4 exports: `localizeTaskName`, `localizeTaskCategory`, `localizeTaskDescription`, `localizeTaskInstructions`. `grep -cE "^export function localizeTask" apps/mobile/src/i18n/taskI18n.ts` returns at least 4.
    - `apps/mobile/src/i18n/__tests__/taskI18n.test.ts` has at least 8 test cases. `grep -cE "^\s*it\(|test\(" apps/mobile/src/i18n/__tests__/taskI18n.test.ts` returns at least 8.
    - `grep -c "localizeTaskName" apps/mobile/src/screens/tasks/TasksScreen.tsx` returns at least 1.
    - `grep -c "localizeTaskCategory" apps/mobile/src/screens/tasks/TasksScreen.tsx` returns at least 1.
    - `grep -c "localizeTaskName\|localizeTaskCategory\|localizeTaskDescription\|localizeTaskInstructions" apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx` returns at least 3.
    - `grep -nE "navigation\.navigate.*Recording" apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx` shows the params include `localizeTaskName(...)`.
    - `grep -v '^#' apps/mobile/src/components/UniversalRulesBlock.tsx | grep -c "label: 'Keep your hands in frame'"` returns 0 (literal removed).
    - `grep -c "labelKey: 'rules.universal." apps/mobile/src/components/UniversalRulesBlock.tsx` returns at least 4.
    - `grep -c "t(rule.labelKey)" apps/mobile/src/components/UniversalRulesBlock.tsx` returns at least 1.
    - `jq '.rules.universal.handsInFrame, .rules.universal.mountDevice, .rules.universal.wellLit, .rules.universal.closeApps' apps/mobile/src/i18n/locales/en.json` returns all four non-null strings.
    - `jq '.tasks.category.all, .tasks.category.cooking, .tasks.category.dishwashing, .tasks.category.kitchen, .tasks.category.cleaning, .tasks.category.tidying, .tasks.category.laundry, .tasks.category.gardening, .tasks.category.petCare, .tasks.category.homeMaintenance, .tasks.category.hobby, .tasks.category.other' apps/mobile/src/i18n/locales/en.json` returns all twelve non-null.
    - JS test suite exit 0; all 8 taskI18n.test.ts + 3 component i18n tests pass.
    - `git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/lib/ttsVoice.ts` all 5 paths return empty.
  </acceptance_criteria>
  <done>G-18 + G-19 + G-25 closed at code level. `taskI18n.ts` helper exists, all 4 task-data render sites wired, UniversalRules labels routed through i18n, en.json carries the 4+12 new keys. Task 5's LLM regen will populate the 7 non-en locales for these keys. Operator-walked hardware re-walk in Task 8 confirms on Pixel 10a.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Close G-13 (search recyclable/recyclables) client-side — append curated EN_TOKEN_ALIASES + wire reverseSearch en branch</name>
  <files>apps/mobile/src/i18n/taskCatalog.i18n.ts, apps/mobile/src/i18n/reverseSearch.ts, apps/mobile/src/i18n/__tests__/taskI18n.test.ts</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md D-14 + D-15 + D-16 (3-stage reverse search; catalog as source of truth; NO backend changes)
    - .planning/REQUIREMENTS.md line 290 (I18N-10 — backend ts_vector stays English-only; client reverse-maps locale text to English)
    - apps/mobile/src/i18n/reverseSearch.ts full file (the existing 3-stage chain; line 54 — the en early-return)
    - apps/mobile/src/i18n/taskCatalog.i18n.ts lines 6486-6561 (the normalizeForReverseSearch + buildReverseMaps functions + REVERSE_BY_LOCALE export — and the end of the file where the new EN_TOKEN_ALIASES export will append)
    - apps/mobile/src/services/tasksApi.ts lines 74-80 (the reverseSearch call site BEFORE the network call)
    - grep for "recyclable" in `apps/mobile/src/i18n/taskCatalog.i18n.ts` to confirm the canonical task name "Sorting recyclables" and the en-side tokens already produced by `buildReverseMaps`
  </read_first>
  <behavior>
    - **Root cause (per checker BLOCKER 3 + 4 — recommended decision):** the operator typed `"recyclable"` in the en locale. For en, `reverseSearch.ts:54` returns the input verbatim (`if (locale === 'en') return input;`). The English query `"recyclable"` then hits the server, which doesn't match the indexed `"recyclables"` (different derivational form).

      Per D-16 we CANNOT change the backend. The original revision's algorithmic `EN_STEM_SUFFIXES` was unreliable (broken for 'recycle' — `endsWith('e')` is not in the suffix list, so no strip happens) and had duplicate entries. The checker explicitly recommended the **curated alias map** approach (Path B): more reliable for the 86-task catalog; small curated list; no surprise edge cases.

    - **Implementation (curated alias map — the ONLY path; no probe step):**

      Append at EOF of `apps/mobile/src/i18n/taskCatalog.i18n.ts` (additive only — 0 DELETED lines in `git diff --numstat`):

      ```typescript
      // ─────────────────────────────────────────────────────────────────────────
      // EN_TOKEN_ALIASES — G-13 closure (plan 07-16).
      // ─────────────────────────────────────────────────────────────────────────
      // Curated map of English derivational forms → canonical form the server's
      // `to_tsquery` ts_vector index matches. The backend stays unmodified per
      // D-16; this is the client-side bridge so the operator can type
      // "recyclable" / "recycle" / "recyclables" and all three hit "Sorting
      // recyclables". Maintain this list when adding new canonical task names
      // whose user-typed derivational forms differ from the indexed stem.
      //
      // Keep entries lowercase (the consumer in reverseSearch.ts lowercases the
      // input token before lookup). Identity entries are optional but useful for
      // making the canonical set explicit.
      export const EN_TOKEN_ALIASES: Record<string, string> = {
        // recycling family — operator's escape (G-13 evidence: 2026-05-26)
        'recyclable':  'recyclables',
        'recyclables': 'recyclables',
        'recycle':     'recyclables',
        'recycling':   'recyclables',

        // Add future entries here as new G-XX search escapes surface. Each entry
        // is ~2 LOC; the cost is negligible vs the precision benefit over
        // algorithmic stemming.
      };
      ```

      Then in `apps/mobile/src/i18n/reverseSearch.ts`:

      ```typescript
      // Top of file, near the existing imports:
      import { EN_TOKEN_ALIASES } from './taskCatalog.i18n';

      // Replace the existing en early-return (line 54):
      // OLD: if (locale === 'en') return input;
      // NEW:
      if (locale === 'en') {
        return input
          .split(/\s+/)
          .filter(Boolean)
          .map((tok) => EN_TOKEN_ALIASES[tok.toLowerCase()] ?? tok)
          .join(' ');
      }
      ```

    - **Tests** in `apps/mobile/src/i18n/__tests__/taskI18n.test.ts` (extending the file Task 2 created — 7 new test cases):
      - `reverseSearch('recyclable', 'en')` returns `'recyclables'` (alias hit)
      - `reverseSearch('Recyclable', 'en')` returns `'recyclables'` (case-insensitive lookup)
      - `reverseSearch('recyclables', 'en')` returns `'recyclables'` (identity passthrough)
      - `reverseSearch('recycle', 'en')` returns `'recyclables'` (verb form)
      - `reverseSearch('recyclable bottles', 'en')` returns `'recyclables bottles'` (multi-token; unmapped 'bottles' passes through)
      - `reverseSearch('cooking a meal', 'en')` returns `'cooking a meal'` (no alias entries — all tokens pass through)
      - `reverseSearch('चाय बनाओ', 'hi-IN')` returns the existing Stage 1 hit (regression test — the non-en branch is untouched)

  </behavior>
  <action>
    1. **Append `EN_TOKEN_ALIASES` to `taskCatalog.i18n.ts`** at EOF. Verify the existing 86×8 catalog DATA is byte-identical via `git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts` showing `+N\t0\t` (N added lines, 0 deleted) per checker NOTE 15.

    2. **Modify `reverseSearch.ts` line 54** to consult the alias map for the en branch. Add the `EN_TOKEN_ALIASES` import at the top.

    3. **Add 7 test cases to `taskI18n.test.ts`** (the file Task 2 created). Run the test suite; confirm exit 0 + new tests PASS.

    4. **NO live HTTP probe** (per checker BLOCKER 3 — the original probe was non-runnable; the dev API requires auth, and the `x-debug-bypass` header was fictional). G-13's correctness is verified via:
       - The unit tests above (deterministic).
       - The operator's hardware walk in Task 8 (the only true integration gate — operator types `"recyclable"` in TasksScreen search on the device and confirms "Sorting recyclables" appears).

    5. **Invariant check:**
       ```bash
       git diff --stat apps/api/                                                    # empty (D-16)
       git diff --stat apps/mobile/android/                                         # empty
       git diff --stat apps/mobile/ios/                                             # empty
       git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts               # +N\t0\t (0 DELETED lines, per NOTE 15)
       ```

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" -- -t "reverseSearch\|EN_TOKEN_ALIASES" 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "EN_TOKEN_ALIASES" apps/mobile/src/i18n/reverseSearch.ts` returns at least 1.
    - `grep -c "export const EN_TOKEN_ALIASES" apps/mobile/src/i18n/taskCatalog.i18n.ts` returns 1.
    - `reverseSearch.ts:54` no longer reads `if (locale === 'en') return input;` verbatim — the en branch now goes through the alias map.
    - `grep -c "if (locale === 'en') return input;" apps/mobile/src/i18n/reverseSearch.ts` returns 0.
    - The 7 new test cases in `taskI18n.test.ts` PASS.
    - `git diff --stat apps/api/` empty (D-16 invariant).
    - `git diff --stat apps/mobile/android/ apps/mobile/ios/ apps/mobile/src/lib/ttsVoice.ts` all empty.
    - `git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts` shows 0 in the DELETED-lines column (purely additive EOF append per NOTE 15).
    - The non-en branches in reverseSearch.ts are byte-identical to the pre-task version (verify by running `git diff -- apps/mobile/src/i18n/reverseSearch.ts` and confirming only lines 1-2 of imports + lines 54-60 of the en branch changed; the rest of the file untouched).
  </acceptance_criteria>
  <done>G-13 closed at the client level via curated alias map. The fix did NOT touch apps/api. Operator confirms in Task 8 by typing "recyclable" + "recyclables" + "recycle" in the TasksScreen search box in en (and a non-en locale for cross-locale parity) and finding the "Sorting recyclables" task.</done>
</task>

<task type="auto">
  <name>Task 4a: Wire t() for G-16 (HomeScreen tileLabel) + G-17 (TaskCategoryPills) + en.json keys</name>
  <files>apps/mobile/src/i18n/locales/en.json, apps/mobile/src/screens/home/HomeScreen.tsx, apps/mobile/src/components/TaskCategoryPills.tsx, apps/mobile/src/components/__tests__/TaskCategoryPills.i18n.test.tsx, apps/mobile/src/screens/home/__tests__/HomeScreen.tileLabel.i18n.test.tsx</files>
  <read_first>
    - apps/mobile/src/i18n/locales/en.json (verify the existing `home.filter.*` block has all 6 keys with their chevron-laden values; this task REPLACES the values with chevron-stripped versions)
    - apps/mobile/src/screens/home/HomeScreen.tsx lines 150-176 (the `tileLabel` switch — the bug site per BLOCKER 1) + the call site at line ~396 (`tileLabel(homeRange, homeRangeCustom)`)
    - apps/mobile/src/components/TaskCategoryPills.tsx lines 22-48 (the const + `pillLabel` function)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-11-i18n-sweep-extension-PLAN.md (the `t()`-wiring pattern used by the prior plan — mirror its style)
  </read_first>
  <behavior>
    - **G-16 fix (per BLOCKER 1):**
      1. Update `en.json` `home.filter.*` block — REPLACE 6 chevron-laden values with chevron-stripped versions:
         ```json
         "home": {
           "filter": {
             "today": "today",
             "yesterday": "yesterday",
             "thisWeek": "this week",
             "thisMonth": "this month",
             "allTime": "all time",
             "customRange": "custom range"
           }
         }
         ```
      2. Modify `HomeScreen.tsx:tileLabel` — change the 6 switch arms to return `${t('home.filter.<named>')} ▾` (chevron stays in template); thread `t` through the function signature (or close over `t` via a hook-level closure if simpler). Call site at line ~396 becomes `tileLabel(homeRange, homeRangeCustom, t)`.

    - **G-17 (TaskCategoryPills):** mutate `pillLabel(value)` at line 46-48 to take `t` as a parameter and consult the `tasks.category.*` keys from Task 2. The const `TASK_CATEGORY_PILLS` STAYS English (it's a state value). Call site in TasksScreen passes the destructured `t` to `pillLabel(value, t)`.

    - **Tests:**
      - `HomeScreen.tileLabel.i18n.test.tsx`: render with locale='hi-IN'; assert the tile-period chip text is the Hindi `home.filter.today` value + the chevron `▾` suffix.
      - `TaskCategoryPills.i18n.test.tsx`: `pillLabel('Cooking', mockT)` returns `mockT('tasks.category.cooking')`; the 11 enum values all have corresponding keys.

  </behavior>
  <action>
    1. **Update `en.json` `home.filter.*` block** — strip the ` ▾` chevron suffix from all 6 existing values (today/yesterday/thisWeek/thisMonth/all/customRange). Note: existing en.json key is `all` (not `allTime`) — DECIDE: rename to `allTime` for consistency with `history.filter.*` (this is a 1-line schema change; the value is purely client-internal so renaming is safe). The plan recommends the rename — update `tileLabel`'s `case 'all':` to look up `home.filter.allTime`.

    2. **Modify `HomeScreen.tsx:tileLabel`** — thread `t` through the function. Update 6 case-returns + the custom-pick `null` branch + the custom-pick fallback `return 'custom range ▾'` to `return \`${t('home.filter.customRange')} ▾\``. The actual date-range render (`return \`${startLbl} – ${endLbl} ▾\``) stays Latin-month-abbreviation V1 (Intl-locale formatting deferred per I18N-09 drop). Update call site at line ~396.

    3. **Wire TaskCategoryPills.tsx pillLabel(value, t)** — add the keyMap inside the function; thread t through.

    4. **Write the 2 component i18n tests.** Mirror the existing `apps/mobile/src/components/__tests__/LanguageSheet.test.tsx` pattern.

    5. **Run the JS test suite** per memory:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
       ```
       Exit 0.

    6. **Invariant checks** (per WARNING 11 — compare against `5879daf`, not `main`):
       ```bash
       git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/lib/ttsVoice.ts
       git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
       ```
       All 6 paths empty.

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `grep -cE "'today ▾'|'yesterday ▾'|'this week ▾'|'this month ▾'|'all time ▾'|'custom range ▾'" apps/mobile/src/screens/home/HomeScreen.tsx` returns 0 (English literals removed).
    - `grep -c "case 'today':" apps/mobile/src/screens/home/HomeScreen.tsx` returns at least 1 (switch arm STAYS).
    - `grep -c "case 'yesterday':" apps/mobile/src/screens/home/HomeScreen.tsx` returns at least 1.
    - `grep -c "case 'this-week':" apps/mobile/src/screens/home/HomeScreen.tsx` returns at least 1.
    - `grep -c "case 'this-month':" apps/mobile/src/screens/home/HomeScreen.tsx` returns at least 1.
    - `grep -c "case 'all':" apps/mobile/src/screens/home/HomeScreen.tsx` returns at least 1.
    - `grep -c "case 'custom':" apps/mobile/src/screens/home/HomeScreen.tsx` returns at least 1.
    - `grep -c "t('home.filter\\." apps/mobile/src/screens/home/HomeScreen.tsx` returns at least 6 (6 switch arms + the custom-null fallback).
    - `jq '.home.filter.today, .home.filter.yesterday, .home.filter.thisWeek, .home.filter.thisMonth, .home.filter.allTime, .home.filter.customRange' apps/mobile/src/i18n/locales/en.json` all 6 non-null AND none contain `▾`.
    - `grep -cE "'All'|'Cooking'|'Dishwashing'" apps/mobile/src/components/TaskCategoryPills.tsx | head -1` — the `TASK_CATEGORY_PILLS` const STAYS, but `pillLabel` no longer returns literals.
    - `grep -c "t(keyMap\\[value\\])" apps/mobile/src/components/TaskCategoryPills.tsx` returns at least 1.
    - JS test suite exit 0; new tests PASS.
    - `git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/lib/ttsVoice.ts` all empty (the taskCatalog file may be non-empty IF Task 3 ran first and appended EN_TOKEN_ALIASES — in that case, validate via `git diff --numstat` showing 0 DELETED lines).
    - `git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty (I18N-11; WARNING 11 base).
  </acceptance_criteria>
  <done>G-16 + G-17 closed at code level. HomeScreen tile chips + TasksScreen category pills route through t(). Chevron preserved in JSX template per BLOCKER 1 fix.</done>
</task>

<task type="auto">
  <name>Task 4b: Wire t() for G-20 (History empty) + G-21 (FilterSheet) + G-28 (HistoryRow + day-section names)</name>
  <files>apps/mobile/src/i18n/locales/en.json, apps/mobile/src/screens/history/HistoryScreen.tsx, apps/mobile/src/screens/shared/FilterSheet.tsx, apps/mobile/src/components/HistoryRow.tsx, apps/mobile/src/services/historyGrouping.ts, apps/mobile/src/components/__tests__/HistoryRow.i18n.test.tsx, apps/mobile/src/components/__tests__/HistoryDayHeader.i18n.test.tsx, apps/mobile/src/screens/history/__tests__/HistoryScreen.empty.i18n.test.tsx, apps/mobile/src/screens/shared/__tests__/FilterSheet.i18n.test.tsx</files>
  <read_first>
    - apps/mobile/src/i18n/locales/en.json (verify the existing `history.filter.*` block has all 6 keys WITHOUT chevrons — planner-time `jq` confirmed: today/yesterday/thisWeek/thisMonth/allTime/customRange all present)
    - apps/mobile/src/components/HistoryRow.tsx full file (`formatUploadedAt` at line 277-284 + the FEEDBACK eyebrow location)
    - apps/mobile/src/screens/history/HistoryScreen.tsx lines 540-600 (the empty-state body — 4 hardcoded strings around line 577 + 592)
    - apps/mobile/src/screens/shared/FilterSheet.tsx lines 53-60 (OPTIONS array) + the title literal (`'Filter by'` — grep the file)
    - apps/mobile/src/services/historyGrouping.ts lines 86-103 (the `push('Today', r)` etc. — 4 hardcoded day-section literals; bug site for G-28's day-section per WARNING 9)
    - apps/mobile/src/components/HistoryDayHeader.tsx lines 28-40 (the `{title.toUpperCase()}` render — STAYS as-is per WARNING 9 decision)
  </read_first>
  <behavior>
    - **en.json key additions** (extending Task 2's additions):
      ```json
      {
        "history": {
          "filterSheet": {
            "title": "Filter by"
          },
          "row": {
            "uploadedAt": "Uploaded at {{time}}",
            "feedbackComingSoon": "FEEDBACK (COMING SOON)"
          },
          "empty": {
            "firstTime": {
              "heading": "Your recordings will live here.",
              "body": "You haven't recorded anything yet.",
              "cta": "Pick a task and try one."
            },
            "filtered": {
              "heading": "No recordings in this range.",
              "body": "Try a wider range or see all recordings.",
              "cta": "Show all time"
            }
          },
          "daySection": {
            "today": "Today",
            "yesterday": "Yesterday",
            "thisWeek": "This week",
            "thisMonth": "This month"
          }
        }
      }
      ```
      (The existing `history.filter.*` 6 keys are reused unchanged — no overwrite.)

    - **G-20 (History empty-state):** two empty states per the HIST-04 + HIST-05 comments at lines 14-20. Lines 540-600 of HistoryScreen.tsx have two render branches. Wire each to `t('history.empty.firstTime.{heading,body,cta}')` + `t('history.empty.filtered.{heading,body,cta}')` respectively. The CTA links keep their press handlers — only the text changes.

    - **G-21 (FilterSheet):** mutate the `OPTIONS` array at lines 53-60 to use `labelKey` instead of `label`. Update each call site (`opt.label` → `t(opt.labelKey)`). The sheet's title (grep `'Filter by'` in `FilterSheet.tsx`) routes through `t('history.filterSheet.title')`.

    - **G-28 part 1 (HistoryRow):** `formatUploadedAt(iso)` at line 277-284 mutates to take `t` (per the <interfaces> block).

    - **G-28 part 2 (FEEDBACK eyebrow):** grep at task execution time: `grep -nE "FEEDBACK|COMING SOON" apps/mobile/src/components/HistoryRow.tsx`. Wire through `t('history.row.feedbackComingSoon')`.

    - **G-28 part 3 (day-section names — per WARNING 9):**
      1. In `apps/mobile/src/services/historyGrouping.ts`, add `import i18n from '../i18n'` at the top.
      2. Replace the 4 hardcoded `push('Today', r)` / `push('Yesterday', r)` / `push('This week', r)` / `push('This month', r)` with `push(i18n.t('history.daySection.today'), r)` etc. (lines ~96-103).
      3. The `{MonthName YYYY}` prior-month label STAYS Latin V1 — Intl-based locale formatting deferred (per I18N-09 drop).
      4. `HistoryDayHeader.tsx:37`'s `{title.toUpperCase()}` STAYS — preserves design; Devanagari is a no-op for casing; pt-BR `HOJE` is intentional.

    - **Tests (4 new test files):**
      - `HistoryRow.i18n.test.tsx`: `formatUploadedAt('2026-05-26T17:26:00.000Z', mockT)` returns the expected interpolated form; the FEEDBACK eyebrow render uses `t()`.
      - `HistoryDayHeader.i18n.test.tsx`: render with `title="आज"` (Hindi for Today); assert the rendered text is `"आज".toUpperCase()` (which is still `"आज"` since Devanagari has no case).
      - `HistoryScreen.empty.i18n.test.tsx`: render with `recordings=[]` and `historyRange='all'` → asserts firstTime empty render; render with `recordings=[]` and `historyRange='today'` → asserts filtered empty render. Mock `t` to return the key (so the assertion is the key string).
      - `FilterSheet.i18n.test.tsx`: assert each of the 6 options renders the translated label and the sheet title is `t('history.filterSheet.title')`.

  </behavior>
  <action>
    1. **Extend en.json** with the new keys per the behavior block. Use `jq` or hand-edit; keep the existing structure intact (don't reorder existing keys; the `history.filter.*` block stays untouched).

    2. **Wire HistoryScreen.tsx empty-states** (G-20).

    3. **Wire FilterSheet.tsx OPTIONS array + title** (G-21).

    4. **Wire HistoryRow.tsx formatUploadedAt + FEEDBACK eyebrow** (G-28 parts 1-2).

    5. **Wire historyGrouping.ts** to localize 4 day-section titles (G-28 part 3 / WARNING 9).

    6. **Write 4 component i18n tests.**

    7. **Run the JS test suite** per memory:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
       ```
       Exit 0.

    8. **Invariant checks:**
       ```bash
       git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts
       git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
       ```
       All 5 paths empty.

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `jq '.history.filterSheet.title, .history.row.uploadedAt, .history.row.feedbackComingSoon, .history.empty.firstTime.heading, .history.empty.firstTime.body, .history.empty.firstTime.cta, .history.empty.filtered.heading, .history.empty.filtered.body, .history.empty.filtered.cta, .history.daySection.today, .history.daySection.yesterday, .history.daySection.thisWeek, .history.daySection.thisMonth' apps/mobile/src/i18n/locales/en.json` all 13 non-null.
    - `grep -cE "'Today'|'Yesterday'|'This week'|'This month'|'All time'|'Custom range'|'Filter by'" apps/mobile/src/screens/shared/FilterSheet.tsx` returns 0.
    - `grep -c "labelKey:" apps/mobile/src/screens/shared/FilterSheet.tsx` returns at least 6.
    - `grep -c "t(opt.labelKey)" apps/mobile/src/screens/shared/FilterSheet.tsx` returns at least 1.
    - `grep -cE "'Your recordings will live here\\.'|\"Your recordings will live here\\.\"" apps/mobile/src/screens/history/HistoryScreen.tsx` returns 0.
    - `grep -c "t('history.empty.firstTime\\|t('history.empty.filtered" apps/mobile/src/screens/history/HistoryScreen.tsx` returns at least 4.
    - `grep -c "return \`Uploaded at " apps/mobile/src/components/HistoryRow.tsx` returns 0.
    - `grep -c "t('history.row.uploadedAt'" apps/mobile/src/components/HistoryRow.tsx` returns at least 1.
    - `grep -cE "push\\('Today'|push\\('Yesterday'|push\\('This week'|push\\('This month'" apps/mobile/src/services/historyGrouping.ts` returns 0.
    - `grep -c "i18n\\.t\\('history\\.daySection\\." apps/mobile/src/services/historyGrouping.ts` returns at least 4.
    - `grep -c "title\\.toUpperCase()" apps/mobile/src/components/HistoryDayHeader.tsx` returns 1 (STAYS — WARNING 9 decision).
    - JS test suite exit 0; all 4 new test files PASS.
    - `git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts` all empty.
    - `git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty.
  </acceptance_criteria>
  <done>G-20 + G-21 + G-28 (all three sub-parts: formatUploadedAt, FEEDBACK eyebrow, day-section names) closed at code level. en.json carries 13 new keys; historyGrouping.ts localizes 4 day-section titles per WARNING 9 decision.</done>
</task>

<task type="auto">
  <name>Task 4c: Wire t() for G-22 (ReportProblemSheet) + G-23 (Help Center header) + G-24 (SendRequestSheet)</name>
  <files>apps/mobile/src/i18n/locales/en.json, apps/mobile/src/components/ReportProblemSheet.tsx, apps/mobile/src/components/TranslatedHeaderTitle.tsx, apps/mobile/src/navigation/RootNativeStack.tsx, apps/mobile/src/screens/tasks/SendRequestSheet.tsx, apps/mobile/src/components/__tests__/ReportProblemSheet.i18n.test.tsx, apps/mobile/src/screens/tasks/__tests__/SendRequestSheet.i18n.test.tsx</files>
  <read_first>
    - apps/mobile/src/components/ReportProblemSheet.tsx lines 80-105 (chip render block) + apps/mobile/src/services/feedbackService.ts lines 38-45 (FEEDBACK_CATEGORIES)
    - apps/mobile/src/navigation/RootNativeStack.tsx line 114-116 (the HelpCenter screen options)
    - apps/mobile/src/screens/tasks/SendRequestSheet.tsx full file (verify which strings are already t()-wired; identify what remains: category chips + Indoor/Outdoor toggle around lines 291-308)
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (verify there's no existing header-title pattern Claude can mirror)
  </read_first>
  <behavior>
    - **en.json key additions** (extending Tasks 2 + 4a + 4b's additions):
      ```json
      {
        "tasks": {
          "setting": {
            "indoor": "Indoor",
            "outdoor": "Outdoor"
          }
        },
        "report": {
          "category": {
            "appCrashed": "App crashed",
            "taskDoesntStart": "Task doesn't start",
            "uploadStuck": "Upload stuck",
            "loginIssue": "Login issue",
            "videoQualityIssue": "Video quality issue",
            "imuIssue": "Sensor issue",
            "thermalIssue": "Device overheating",
            "other": "Other"
          }
        },
        "helpCenter": {
          "title": "Help Center"
        }
      }
      ```
      (Note: `report.category.imuIssue` = `"Sensor issue"` and `report.category.thermalIssue` = `"Device overheating"` are intentional UX simplifications of the raw enum, per checker WARNING 8. QA reviewers should NOT flag as mistranslations; the server still receives `imu-issue` / `thermal-issue` verbatim per I18N-10.)

    - **G-22 (ReportProblemSheet chips — per checker WARNING 12):** add the `REPORT_CATEGORY_LABEL_KEY` map at the top of `ReportProblemSheet.tsx`. Change BOTH:
      - The chip text render from `{c}` to `{t(REPORT_CATEGORY_LABEL_KEY[c])}`.
      - The `accessibilityLabel={`category-${c}`}` to `accessibilityLabel={t(REPORT_CATEGORY_LABEL_KEY[c])}` so TalkBack/VoiceOver users hear the chip in their locale.
      - The `testID={`category-${c}`}` STAYS English (test ID / server-contract).

    - **G-23 (Help Center header — per checker WARNING 7):**
      1. Create NEW file `apps/mobile/src/components/TranslatedHeaderTitle.tsx` (per the <interfaces> block — a 12-line component that calls `useTranslation()` and re-renders on locale change).
      2. Modify `RootNativeStack.tsx:114-116` from `options={{ headerShown: true, title: 'Help Center' }}` to:
         ```typescript
         options={{
           headerShown: true,
           headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" />,
         }}
         ```
      3. Add import `import TranslatedHeaderTitle from '../components/TranslatedHeaderTitle'` at the top of `RootNativeStack.tsx`.
      4. Verify in the operator's Task 8 walk: navigate to Help Center in en, then switch locale via Profile → Language to hi-IN, then navigate back to Help Center — the title should show in Hindi. (The function-form options approach would FAIL this test; the `headerTitle: () => <Component>` approach passes because `<Component>` re-mounts on every render and re-runs its hooks.)

    - **G-24 (SendRequestSheet):** category chips reuse the canonical `TASK_CATEGORY_PILLS` set OR `SEND_REQUEST_CATEGORIES`. Verify which at task execution time, then wire through `t('tasks.category.*')` using the same keyMap as G-17. The Indoor/Outdoor segmented toggle at lines 291-308 has literal `Indoor` (line 300) — find the parallel Outdoor literal at lines 304-310. Wire both to `t('tasks.setting.indoor')` / `t('tasks.setting.outdoor')`.

    - **Tests (2 new test files):**
      - `ReportProblemSheet.i18n.test.tsx`: render with locale='hi-IN' + a stubbed `REPORT_CATEGORY_LABEL_KEY` mock; assert each chip's TEXT matches the t() resolved string AND each chip's accessibilityLabel matches the same translated string. testID remains English `category-{value}`.
      - `SendRequestSheet.i18n.test.tsx`: render with locale='hi-IN'; assert category chips + Indoor/Outdoor render translated values.

  </behavior>
  <action>
    1. **Extend en.json** with the new keys per the behavior block (3 new top-level paths: `tasks.setting.*`, `report.category.*`, `helpCenter.title`).

    2. **Create `TranslatedHeaderTitle.tsx`** (12 LOC component).

    3. **Wire ReportProblemSheet.tsx** — add the `REPORT_CATEGORY_LABEL_KEY` map; change chip text + accessibilityLabel; testID stays English.

    4. **Modify RootNativeStack.tsx:114-116** — replace static title with `headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" />`. Add the import.

    5. **Wire SendRequestSheet.tsx** — category chips + Indoor/Outdoor toggle.

    6. **Write 2 component i18n tests.**

    7. **Run the JS test suite:**
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
       ```
       Exit 0.

    8. **Invariant checks:**
       ```bash
       git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts
       git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
       ```
       All 5 paths empty.

    9. **Surface any literals the planner missed**. If during this task you find an English literal that should be translated but isn't in the G-13..G-28 list, surface it to the user before proceeding — do NOT silently expand scope.

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `jq '.tasks.setting.indoor, .tasks.setting.outdoor' apps/mobile/src/i18n/locales/en.json` both non-null.
    - `jq '.report.category.appCrashed, .report.category.taskDoesntStart, .report.category.uploadStuck, .report.category.loginIssue, .report.category.videoQualityIssue, .report.category.imuIssue, .report.category.thermalIssue, .report.category.other' apps/mobile/src/i18n/locales/en.json` all 8 non-null. `jq -r '.report.category.imuIssue' apps/mobile/src/i18n/locales/en.json` is `"Sensor issue"`. `jq -r '.report.category.thermalIssue' apps/mobile/src/i18n/locales/en.json` is `"Device overheating"`.
    - `jq '.helpCenter.title' apps/mobile/src/i18n/locales/en.json` is `"Help Center"` (non-null).
    - `test -f apps/mobile/src/components/TranslatedHeaderTitle.tsx && grep -c "export function TranslatedHeaderTitle\\|export default TranslatedHeaderTitle" apps/mobile/src/components/TranslatedHeaderTitle.tsx` returns at least 1.
    - `grep -c "TranslatedHeaderTitle" apps/mobile/src/navigation/RootNativeStack.tsx` returns at least 2 (1 import + 1 use).
    - `grep -c "title: 'Help Center'" apps/mobile/src/navigation/RootNativeStack.tsx` returns 0.
    - `grep -c "headerTitle: () => <TranslatedHeaderTitle" apps/mobile/src/navigation/RootNativeStack.tsx` returns at least 1.
    - `grep -c "REPORT_CATEGORY_LABEL_KEY\\|t(REPORT_CATEGORY" apps/mobile/src/components/ReportProblemSheet.tsx` returns at least 1.
    - `grep -c "accessibilityLabel={t(" apps/mobile/src/components/ReportProblemSheet.tsx` returns at least 1.
    - `grep -c "testID={\`category-" apps/mobile/src/components/ReportProblemSheet.tsx` returns at least 1 (testID STAYS English).
    - `grep -cE ">Indoor<|>Outdoor<" apps/mobile/src/screens/tasks/SendRequestSheet.tsx` returns 0.
    - JS test suite exit 0; all 2 new test files PASS.
    - `git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts` all empty.
    - `git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty.
  </acceptance_criteria>
  <done>G-22 + G-23 + G-24 closed at code level. ReportProblemSheet renders translated chips (text + accessibilityLabel; testID stays English per WARNING 12). Help Center header uses TranslatedHeaderTitle for locale-reactive header (per WARNING 7). SendRequestSheet category chips + Indoor/Outdoor toggle wired.</done>
</task>

<task type="auto">
  <name>Task 5: Regenerate 7 non-English locale catalogs via `pnpm i18n:generate` + shape-parity validate</name>
  <files>apps/mobile/src/i18n/locales/pt-BR.json, apps/mobile/src/i18n/locales/es.json, apps/mobile/src/i18n/locales/hi-IN.json, apps/mobile/src/i18n/locales/bn-IN.json, apps/mobile/src/i18n/locales/ta-IN.json, apps/mobile/src/i18n/locales/te-IN.json, apps/mobile/src/i18n/locales/mr-IN.json, apps/mobile/src/i18n/locales/pt-BR.audit.json, apps/mobile/src/i18n/locales/es.audit.json, apps/mobile/src/i18n/locales/hi-IN.audit.json, apps/mobile/src/i18n/locales/bn-IN.audit.json, apps/mobile/src/i18n/locales/ta-IN.audit.json, apps/mobile/src/i18n/locales/te-IN.audit.json, apps/mobile/src/i18n/locales/mr-IN.audit.json</files>
  <read_first>
    - tools/i18n/generate.ts (the entry point — confirmed invocable via `pnpm i18n:generate` per plan 07-02 + 07-11)
    - tools/i18n/validate.ts (shape-parity rules)
    - tools/i18n/prompts.ts (the vernacular brief — should NOT change for this plan; the brief was locked at 07-02)
    - tools/.env (must contain ANTHROPIC_API_KEY — the executor's local file, gitignored per plan 07-02. If missing, BLOCK and surface to user — see action step 1 below.)
    - apps/mobile/src/i18n/locales/en.json (the freshly-updated catalog from Tasks 2 + 4a + 4b + 4c)
  </read_first>
  <behavior>
    - Run `pnpm i18n:generate` from the repo root. The tool makes 7 sequential calls to Claude Opus 4.7 and overwrites each non-English locale JSON + writes a fresh `*.audit.json` sidecar.
    - Run `pnpm i18n:validate` to confirm shape parity across all 8 catalogs.
    - Spot-check each non-en catalog for the new keys: `rules.universal.handsInFrame`, `tasks.category.cooking`, `tasks.setting.indoor`, `report.category.appCrashed`, `history.empty.firstTime.heading`, `history.daySection.today`, `helpCenter.title`. None should be the English fallback. The 6 modified `home.filter.*` values (chevron-stripped) should also be translated.
    - **NO human-translator review pass at MVP** — per CONTEXT.md D-11 + "Deferred Ideas".
    - **Owner-deviation re-check:** the regen MUST NOT translate API constants, codec strings, encoder field names, or the canonical `tasks.category.*` ENUM VALUES (e.g. the value `'Cooking'` in the en.json `tasks.category.cooking` IS the English display label, but the FEEDBACK_CATEGORIES values `'app-crashed'` etc. STAY English in the enum — the i18n keys for them are display-only). The vernacular brief from 07-02 already handles this correctly.
  </behavior>
  <action>
    1. **Confirm `tools/.env` contains `ANTHROPIC_API_KEY=...`** (per checker WARNING 10):
       ```bash
       grep -q "^ANTHROPIC_API_KEY=" tools/.env 2>/dev/null && echo "FOUND" || echo "MISSING"
       ```
       If MISSING, BLOCK + surface to the user with the exact env var name + dotfile path: "ANTHROPIC_API_KEY is required in `tools/.env` for `pnpm i18n:generate`. Without it, Task 5 cannot regen 7 non-en locales and Task 8 will FAIL because the locales will fall through to en. Please add the key and rerun." Do NOT silently skip the regen.

    2. **Run the LLM regen tool:**
       ```bash
       pnpm i18n:generate 2>&1 | tee /tmp/07-16-i18n-regen.log
       ```
       Expected: 7 lines `[generate] {locale}: OK`. If any FAILS, investigate via the per-locale validator output and re-run.

    3. **Run shape-parity validate:**
       ```bash
       pnpm i18n:validate 2>&1 | tail -20
       ```
       Exit 0; 7 lines `[validate] {locale}: OK`.

    4. **Spot-check the hi-IN catalog** (most important for the operator's re-walk):
       ```bash
       jq '.rules.universal' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.tasks.category' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.tasks.setting' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.report.category' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.history.empty.firstTime' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.history.daySection' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.history.filterSheet.title' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.history.row.uploadedAt' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.home.filter' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.helpCenter.title' apps/mobile/src/i18n/locales/hi-IN.json
       ```
       Each should return a non-empty Devanagari-script value. If any is the English literal (e.g. `"App crashed"` instead of `"ऐप क्रैश हो गया"`), the LLM regen had a hole — investigate + re-run targeted.

    5. **Also spot-check 2 of the other 6 locales** for the same key paths (e.g. `pt-BR.json` for `report.category.appCrashed` should be `"App travou"` or similar, and `bn-IN.json` for the same key should be Bengali script). Don't manually check all keys × 7 locales — that's the operator's job in Task 8.

    6. **Run the JS test suite** to confirm the regen didn't break anything:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
       ```
       Exit 0.

    7. **Invariant checks:**
       ```bash
       git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts
       git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
       git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts  # 0 in DELETED column per NOTE 15
       ```
       All paths empty (taskCatalog has the additive EOF append from Task 3).

    8. **Document the LLM model + audit timestamp** in the 7 fresh `*.audit.json` sidecars (the tool auto-writes these — verify via `cat apps/mobile/src/i18n/locales/hi-IN.audit.json` that the timestamp is recent).

  </action>
  <verify>
    <automated>pnpm i18n:validate 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - All 7 non-English locale JSONs have non-empty translated values for every new key from Tasks 2 + 4a + 4b + 4c (verified via `jq` spot-check on hi-IN + 2 other locales).
    - `pnpm i18n:validate` exits 0 with shape parity green across all 8 catalogs.
    - All 7 `*.audit.json` sidecars have `generated_at` timestamps within the last 24 hours of Task 5 completion.
    - `jq '.rules.universal.handsInFrame' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari-script string (NOT the English literal `"Keep your hands in frame"`).
    - `jq '.tasks.category.cooking' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari-script string.
    - `jq '.history.empty.firstTime.heading' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari-script string.
    - `jq '.history.daySection.today' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari-script string (likely `"आज"`).
    - `jq '.helpCenter.title' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari-script string.
    - `jq '.home.filter.today' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari-script string AND does NOT contain `▾` (chevron stays in JSX template).
    - JS test suite exit 0; all Tasks 2 + 3 + 4a + 4b + 4c tests still PASS post-regen.
    - `git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts` all empty.
    - `git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty.
    - `git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts` shows 0 in the DELETED-lines column (per NOTE 15 — additive EOF append from Task 3 is the only change).
  </acceptance_criteria>
  <done>7 non-English catalogs regenerated with the ~34 new keys + 6 modified `home.filter.*` values; shape parity validated; sidecars refreshed; downstream tests green. The catalog data layer is feature-complete; remaining work in Task 6 (overflow fixes) + Task 7 (regression test + APK) + Task 8 (operator-walked re-walk).</done>
</task>

<task type="auto">
  <name>Task 6: Devanagari overflow + alignment fixes (G-14 CompatCheck, G-15 Live indicator, G-26 RotatePrompt, G-27 hand-gate prompt)</name>
  <files>apps/mobile/src/screens/recording/components/RotatePrompt.tsx, apps/mobile/src/screens/recording/RecordingScreen.tsx, apps/mobile/src/screens/compat/CompatRunningScreen.tsx</files>
  <read_first>
    - apps/mobile/src/screens/recording/components/RotatePrompt.tsx full file (~125 LOC — the Text element at line ~108)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 1085-1100 (the gate prompt Text element at line ~1090) + lines 1015-1025 (the live label JSX at ~1018 — per WARNING 6 verify but DO NOT edit) + lines 1276-1294 (the liveLabelPill + liveLabelText styles — THE FIX SITE for G-15)
    - apps/mobile/src/screens/compat/CompatRunningScreen.tsx lines 280-300 (the DISPLAY_ROWS render block — find the `<Text variant="body" style={styles.label}>{t(row.labelKey)}</Text>` block and its container `<View style={styles.row}>`) — verify if the row uses `numberOfLines` on the label or has flex constraints that truncate
    - apps/mobile/src/screens/compat/CompatRunningScreen.tsx around line 310-360 (the `styles` const — confirm `styles.row` + `styles.label` widths/flex)
    - apps/mobile/src/i18n/locales/hi-IN.json `compat.checkLabels` (post-Task-5 regen — verify the Hindi values for the 7 probe labels). If a value is excessively long (>30 Devanagari chars), the layout fix alone may not suffice and the regen needs a length-aware re-prompt — surface to user.
  </read_first>
  <behavior>
    - **G-14 CompatCheck probe-label truncation** — at `CompatRunningScreen.tsx` lines ~285 the label Text is:
      ```tsx
      <Text variant="body" style={styles.label}>{t(row.labelKey)}</Text>
      ```
      Modify to:
      ```tsx
      <Text variant="body" style={styles.label} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
        {t(row.labelKey)}
      </Text>
      ```
      AND inspect `styles.row` + `styles.label` for any fixed widths. If `styles.label` has a fixed `width: 200` or similar, change it to `flex: 1` + `flexShrink: 1` so the label can wrap to 2 lines without overflowing the row. Mirror the existing flex pattern in the row's indicator-pill + label arrangement.

    - **G-15 "Live preview" indicator alignment (per WARNING 6 — JSX at line ~1018, StyleSheet at ~1287):**
      JSX at line ~1018 is the consumer:
      ```tsx
      <View style={styles.liveLabelPill}>
        <Text variant="caption" style={styles.liveLabelText}>
          ...
        </Text>
      </View>
      ```
      JSX is UNTOUCHED. The fix is at the StyleSheet line ~1287:
      ```typescript
      liveLabelText: { color: colors.accent },
      ```
      Change to:
      ```typescript
      liveLabelText: { color: colors.accent, textAlign: 'center' },
      ```
      (The parent `liveBottomCenter` View at line ~1276 already centers via `alignItems: 'center'` + `left: 0, right: 0`. The Text inside the pill needs `textAlign: 'center'` to center the GLYPHS within the pill's padding — distinct concern from centering the pill itself. Confirm on hardware in Task 8.)

    - **G-26 Rotate-to-landscape prompt truncation** — at `RotatePrompt.tsx` line ~108:
      ```tsx
      <Text variant="body" style={styles.body}>
        {t('recording.rotatePrompt')}
      </Text>
      ```
      Change to:
      ```tsx
      <Text
        variant="body"
        style={styles.body}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {t('recording.rotatePrompt')}
      </Text>
      ```

    - **G-27 Hand-gate prompt truncation** — at `RecordingScreen.tsx` line ~1090:
      ```tsx
      <Text variant="recGatePrompt" style={styles.gatePrompt}>
        {t('recording.gatePrompt')}
      </Text>
      ```
      Change to:
      ```tsx
      <Text
        variant="recGatePrompt"
        style={styles.gatePrompt}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {t('recording.gatePrompt')}
      </Text>
      ```

    - **No new design tokens.** `numberOfLines` + `adjustsFontSizeToFit` + `minimumFontScale` are RN-Text props, not tokens. The text variants in `ui/tokens.ts` are NOT modified.

    - **No new tests for layout** — visual layout is operator-confirmed in Task 8. Add a small comment block at each touched line referencing the gap ID for future readers (e.g. `// G-26 (Plan 07-16): allow Devanagari to wrap + auto-shrink`).

  </behavior>
  <action>
    1. **Read** the post-regen hi-IN values for `compat.checkLabels.*` + `recording.rotatePrompt` + `recording.gatePrompt`. If any is unusually long (>40 Devanagari chars), surface to the user — the LLM regen may need a length-aware retry. Otherwise proceed.

    2. **Apply the 4 layout/style edits**:
       - `RotatePrompt.tsx` line ~108: add 3 props (G-26).
       - `RecordingScreen.tsx` line ~1090: add 3 props (G-27).
       - `RecordingScreen.tsx` line ~1287: add `textAlign: 'center'` to `liveLabelText` style (G-15). JSX at ~1018 is UNTOUCHED.
       - `CompatRunningScreen.tsx` line ~285: add 3 props. If `styles.label` has fixed width, change to flex (G-14).

    3. **Run the JS test suite** to confirm no regression:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -20
       ```

    4. **Invariant checks**:
       ```bash
       git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts apps/mobile/src/ui/tokens.ts
       git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
       ```
       All 6 paths empty (`tokens.ts` MUST stay untouched — no new design tokens).

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "numberOfLines={2}" apps/mobile/src/screens/recording/components/RotatePrompt.tsx` returns at least 1.
    - `grep -c "adjustsFontSizeToFit" apps/mobile/src/screens/recording/components/RotatePrompt.tsx` returns at least 1.
    - `grep -c "numberOfLines={2}" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1.
    - `grep -c "adjustsFontSizeToFit" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1.
    - `grep -c "textAlign: 'center'" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 2 (the new one for liveLabelText + the existing one(s) at lines 1243 / 1268).
    - `grep -c "numberOfLines={2}" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` returns at least 1.
    - `grep -c "adjustsFontSizeToFit" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` returns at least 1.
    - `grep -v '^#' apps/mobile/src/screens/recording/components/RotatePrompt.tsx apps/mobile/src/screens/recording/RecordingScreen.tsx apps/mobile/src/screens/compat/CompatRunningScreen.tsx | grep -cE "// G-1[4-9]|// G-2[0-9]"` returns at least 4 (one comment per gap touched).
    - JS test suite exit 0.
    - `git diff --stat apps/mobile/ios/ apps/api/ apps/mobile/android/ apps/mobile/src/lib/ttsVoice.ts apps/mobile/src/ui/tokens.ts` all empty.
    - `git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty.
  </acceptance_criteria>
  <done>G-14 + G-15 + G-26 + G-27 closed at code level. Devanagari prompts can wrap to 2 lines + auto-shrink. Live indicator pill text is centered. Operator confirms visually on Pixel 10a in Task 8.</done>
</task>

<task type="auto">
  <name>Task 7: Build fresh APK + run full regression + run all invariant gates one more time</name>
  <files>(no source files — build output + git status check)</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-15-PAUSE.md ## Dev environment state (Pixel 10a still paired, dev API running, adb tunnels up)
    - apps/mobile/android/app/build.gradle (the `apkRolloutDebug` variant — same as plan 07-15)
  </read_first>
  <behavior>
    - Run the full JS + Kotlin + tools/ test suite.
    - Run `pnpm i18n:validate` one more time.
    - Run all invariant grep gates (the 6 invariants enforced by every prior task). **Compare 06-COSMETIC-GAPS.md against `5879daf`, NOT `main`** — per WARNING 11.
    - Build a fresh `:app:assembleApkRolloutDebug` and install it on the Pixel 10a via `:app:installApkRolloutDebug`.
    - Pin the commit hash for the operator's re-walk in Task 8.
  </behavior>
  <action>
    1. **Run the full JS test suite** (per memory):
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test 2>&1 | tail -40
       ```
       Exit 0.

    2. **Run the Kotlin unit test suite** (per memory `feedback_android_build_needs_jdk17.md`):
       ```bash
       cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:testApkRolloutDebugUnitTest 2>&1 | tail -20
       ```
       Exit 0.

    3. **Run the tools/ test suite:**
       ```bash
       cd tools && pnpm test 2>&1 | tail -15
       ```
       Exit 0.

    4. **Run `pnpm i18n:validate`** one more time post-Task-6:
       ```bash
       cd "$(git rev-parse --show-toplevel)" && pnpm i18n:validate 2>&1 | tail -10
       ```
       Exit 0.

    5. **Build the APK + install on Pixel 10a:**
       ```bash
       cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug :app:installApkRolloutDebug 2>&1 | tail -20
       APK_COMMIT=$(git -C "$(git rev-parse --show-toplevel)" rev-parse HEAD)
       echo "Fresh APK commit: $APK_COMMIT"
       ```
       Expected: BUILD SUCCESSFUL + the APK installed on device `5C161JEA304304`.

    6. **Confirm adb tunnels are up** per memory `feedback_dev_tunnels_include_localstack_4566.md`:
       ```bash
       adb reverse --list
       ```
       Expected: `tcp:8080 tcp:8080`, `tcp:8081 tcp:8081`, `tcp:4566 tcp:4566`. If any is missing:
       ```bash
       adb reverse tcp:8080 tcp:8080 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4566 tcp:4566
       ```

    7. **Confirm dev API + worker is up** per memory `feedback_dev_api_runs_hash_verify_worker.md`:
       ```bash
       curl -sS http://localhost:8080/health  # should return 200
       ```
       If down, instruct user to run `cd apps/api && pnpm dev` in a separate terminal (NOT in this task — Task 7 doesn't manage the dev process).

    8. **Run the 6 invariant grep gates** one final time (per WARNING 11 — use `5879daf` as base for the Phase-6 cosmetic-gaps doc):
       ```bash
       git diff --stat main -- apps/mobile/ios/                                                    # I18N-21
       git diff --stat main -- apps/api/                                                            # D-16
       git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md  # I18N-11 (vs cluster HEAD, NOT main)
       git diff --stat main -- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt  # CLAUDE.md drift + cancel banners
       git diff --stat main -- apps/mobile/src/lib/ttsVoice.ts                                     # TTS owner-deviation
       git diff --stat main -- apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx              # RigTutorial owner-deviation guard
       ```
       All 6 should return empty.

    9. **Echo the APK commit hash + the device pairing** for Task 8's resume signal.

  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && pnpm i18n:validate 2>&1 | tail -10 && echo "---" && git diff --stat main -- apps/mobile/ios/ apps/api/ apps/mobile/src/lib/ttsVoice.ts apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx | head -10 && echo "---" && git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md | head -3</automated>
  </verify>
  <acceptance_criteria>
    - JS test suite exit 0; all Tasks 1-6 tests still PASS.
    - Kotlin unit test suite exit 0.
    - tools/ test suite exit 0.
    - `pnpm i18n:validate` exits 0.
    - APK build: `BUILD SUCCESSFUL`; APK installed on Pixel 10a `5C161JEA304304`.
    - APK_COMMIT recorded for Task 8 (matches `git rev-parse HEAD`).
    - adb tunnels list shows tcp:8080, tcp:8081, tcp:4566 all reversed.
    - `curl http://localhost:8080/health` returns 200 (or the user is instructed to start dev API).
    - All 6 invariant grep gates return empty:
      - `git diff --stat main -- apps/mobile/ios/` empty
      - `git diff --stat main -- apps/api/` empty
      - `git diff --stat 5879daf -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty (per WARNING 11 — comparing against cluster HEAD, NOT main; the file already drifted on main via `db5e721` renumber sweep)
      - `git diff --stat main -- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` empty
      - `git diff --stat main -- apps/mobile/src/lib/ttsVoice.ts` empty
      - `git diff --stat main -- apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` empty
  </acceptance_criteria>
  <done>Fresh APK on Pixel 10a; all tests green; all invariants green. Operator can proceed to Task 8 (the 7-locale hardware re-walk).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 8: Operator-walked FULL 7-locale hardware re-walk on Pixel 10a — close G-13..G-28 visually</name>
  <what-built>
    Tasks 1-7 shipped: G-18 keystone fix (taskI18n.ts helper wired to TasksScreen + TaskDetailsSheet + RecordingScreen task-name + UniversalRulesBlock), G-13 client-side fix (curated EN_TOKEN_ALIASES map in taskCatalog.i18n.ts + reverseSearch.ts en branch — per checker BLOCKER 3 + 4), 8 t() wires across Tasks 4a/4b/4c (G-16 HomeScreen tileLabel per BLOCKER 1 / G-17 TaskCategoryPills / G-20 HistoryScreen empty / G-21 FilterSheet / G-22 ReportProblemSheet chips with TalkBack-friendly accessibilityLabel per WARNING 12 / G-23 Help Center via TranslatedHeaderTitle per WARNING 7 / G-24 SendRequestSheet / G-28 HistoryRow + historyGrouping day-section names per WARNING 9), 7 LLM-regen non-en catalogs, 4 Devanagari overflow + alignment fixes (G-14/15/26/27 — CompatCheck label / Live indicator StyleSheet line ~1287 per WARNING 6 / RotatePrompt / hand-gate prompt), fresh APK on Pixel 10a, all 6 invariants green (Phase-6 cosmetic-gaps invariant uses `5879daf` cluster-HEAD base per WARNING 11).

    **Operator directive (verbatim, 2026-05-26 17:30 IST):** "i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device." — this task implements that directive.

    This task is the operator's full 7-locale hardware re-walk on Pixel 10a `5C161JEA304304`. Walk EVERY gap surface in EVERY non-English locale: pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN — and additionally re-walk G-13 in en (since the operator originally surfaced it in en locale).

    See the `<rewalk_protocol>` block at the bottom of this plan for the exact per-locale per-surface walking sequence.

    **The walk:**
    1. With APK installed (Task 7 done), open the app on Pixel 10a.
    2. For EACH locale in [pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN]:
       a. Profile → Language → tap the locale row → sheet auto-dismisses → re-render.
       b. Walk Home → confirm G-16 (tile period chip translated, with chevron ▾ still present).
       c. Walk Tasks → confirm G-17 (category filter chips) + G-18 (task cards translated).
       d. Tap a task → TaskDetailsSheet → confirm G-19 (name + category eyebrow + description + instructions + ALWAYS rules all translated).
       e. Send Request (from tasks) → confirm G-24 (category chips + Indoor/Outdoor).
       f. Tap Start Recording on a real task → confirm G-25 (RecordingScreen app-bar task name translated). Cover the lens immediately to abort cleanly OR walk through the gate to see G-27 (hand-gate prompt no truncation), then rotate the device to see G-26 (rotate prompt no truncation), then during the active recording confirm G-15 ("Live preview" pill TEXT is center-aligned within the pill).
       g. Stop recording → History → confirm G-20 (empty-state first-time) IF empty, OR G-28 (uploaded row task name + "Uploaded at HH:MM" + "FEEDBACK (COMING SOON)" + day-header eyebrow showing translated TODAY/YESTERDAY/THIS WEEK/THIS MONTH per WARNING 9 decision) IF rows exist. Tap the time-filter chip → FilterSheet opens → confirm G-21 (sheet title + 6 options translated).
       h. From the topbar, navigate to Help Center → confirm G-23 (header bar title translated). Then switch locale via Profile sheet and re-navigate to Help Center to verify the header re-localizes (the WARNING 7 fix — TranslatedHeaderTitle re-renders on locale change).
       i. From Profile, tap "Report a problem" → confirm G-22 (issue category chips translated). With TalkBack enabled (Settings → Accessibility → TalkBack), swipe through the chips to verify the accessibilityLabel speaks the translated label, not the English enum (per WARNING 12 fix).
       j. Run the CompatCheck (Profile → Settings → "Run compatibility check" OR `adb shell am start -n ai.humynlabs.capture.apk/.CompatActivity` — if the entry point isn't trivially accessible, skip and re-check G-14 via the next clean install) — confirm G-14 (probe labels not truncated).
       k. Record the PASS/FAIL verdict per gap for this locale in `07-HUMAN-UAT.md` under a fresh `## Re-walk 2026-05-XX` block.
    3. For G-13 (search tokenizer), in en locale only: TasksScreen → search input → type `"recyclable"` → expected: "Sorting recyclables" task appears in results. Repeat with `"recyclables"` + `"recycle"` + `"recycling"`. Cross-check in hi-IN with the analogous `"पुनर्चक्रण योग्य"` / `"रिसाइकिल"` (whatever the LLM produced) — the locale-side reverseSearch should map to the same en token-aliased form.

    **Total walk sequence:** ~12 minutes per locale × 7 locales = ~80-90 minutes of operator time. Owner directive accepts this cost.

    **What the operator updates:** the `07-HUMAN-UAT.md` file gains a new `## Re-walk 2026-05-XX (Pixel 10a, 7-locale, plan 07-16 closure)` section with a per-gap per-locale PASS/FAIL matrix:

    ```markdown
    ## Re-walk 2026-05-XX (Pixel 10a, 7-locale, plan 07-16 closure)

    APK commit: {APK_COMMIT from Task 7}
    Locale-walk-time: {actual minutes}

    | Gap | pt-BR | es | hi-IN | bn-IN | ta-IN | te-IN | mr-IN |
    |-----|-------|-----|-------|-------|-------|-------|-------|
    | G-13 (en search) | PASS (cross-locale check in hi-IN: PASS) |
    | G-14 CompatCheck overflow | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-15 Live indicator center | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-16 tile period chip | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-17 category filter chips | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-18 task cards | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-19 TaskDetails body | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-20 History empty | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-21 FilterSheet | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-22 Report Problem chips (text + a11y) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-23 Help Center title (locale-reactive) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-24 Send Request chips + Indoor/Outdoor | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-25 RecordingScreen task name | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-26 Rotate prompt overflow | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-27 hand-gate prompt overflow | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-28 History row + day-section names | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

    Verdict: {ALL PASS | N FAILS — listed below}

    Failed rows: {none / G-XX in {locale} — {description}}
    ```

    **Outcome routing:**
    - **All PASS** → 07-16 is feature-complete. 07-15 (paused) can now re-attempt its Bundle 1 + Bundle 2 + wrap-up walk. Note this in the operator's verdict signal.
    - **Any FAIL** → file the failed gap in a fresh `## Gaps surfaced during 07-16 closure walk` block in `07-HUMAN-UAT.md`. The orchestrator decides whether to re-route to Task 2/3/4a/4b/4c/6 OR plan a 07-17 follow-on.

  </what-built>
  <how-to-verify>
    **Pre-walk:**
    1. Confirm Pixel 10a `5C161JEA304304` is paired: `adb devices` shows it.
    2. Confirm the APK from Task 7 is installed. Force-stop the app: `adb shell am force-stop ai.humynlabs.capture.apk`. Clear MMKV locale chosen flag if needed (to re-trigger ChooseLanguageScreen for the first locale walk): `adb shell run-as ai.humynlabs.capture.apk rm -f /data/data/ai.humynlabs.capture.apk/files/mmkv/localeMmkv` — OR skip the clear and switch locales via Profile → Language (the locked-in default behavior).
    3. Confirm dev API on port 8080 is healthy: `curl -sS http://localhost:8080/health`. Confirm adb tunnels (Task 7 acceptance).
    4. Sign in if needed: m.adnaan161@gmail.com (per PAUSE doc).

    **Walk:**
    5. For each locale in [pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN]: follow the per-locale sequence in `<what-built>` step 2. The operator describes what they see; Claude tells them what to compare against (the planned-translation reference values from en.json + the regenerated locale JSON).
    6. For G-13: en locale only + a hi-IN cross-check.

    **Report back:**
    7. After all 7 locales walked, the operator pastes the PASS/FAIL matrix into chat OR Claude writes it directly to `07-HUMAN-UAT.md` from the operator's running narration.

    **Resume:**
    8. Operator types one of: "approved — 07-16 walk all PASS" / "07-16 walk done — FAILs: {locale,gap}, {locale,gap}, ..."

  </how-to-verify>
  <acceptance_criteria>
    - `07-HUMAN-UAT.md` gains a `## Re-walk 2026-05-XX (Pixel 10a, 7-locale, plan 07-16 closure)` block with the PASS/FAIL matrix (16 gaps × 7 locales = 112 verdicts, PLUS the G-13 en + cross-locale row).
    - All 7 non-en locales walked. No locale skipped (per the owner directive "skip nothing").
    - `grep -c "Re-walk 2026" .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md` returns at least 1 new occurrence (the prior re-walk block at line 112 stays — the new one is appended).
    - Operator types a resume signal of the form: "approved — 07-16 walk all PASS" OR "07-16 walk done — FAILs: ..." (the operator's explicit verbal sign-off is the gate).
  </acceptance_criteria>
  <resume-signal>Type "approved — 07-16 walk all PASS" to mark Phase 7 ready for the 07-15 re-attempt. Type "07-16 walk done — FAILs: {locale,gap} ..." if any walk failed; Claude will file the gaps in 07-HUMAN-UAT.md and route to a follow-on plan.</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                                                                            | Description                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM translation pipeline → user-facing copy                                                         | Untrusted LLM output committed verbatim to the app bundle (Task 5 regen). Same as plan 07-11 / 07-12 / 07-13.                                                                                                                                                                             |
| en.json → 7 locale catalogs                                                                         | Single-direction propagation; en.json is the canonical source.                                                                                                                                                                                                                            |
| Server `/tasks/search` response (English-only `name` + `category`) → client `localizeTask*` helpers | Server-returned canonical English strings cross the network boundary; the client uses them as KEYS into TASK_CATALOG_I18N. A malicious server response (English string not in TASK_CATALOG_I18N) falls through to the en-canonical fallback per D-12 — graceful degradation, not a crash. |
| Client-side `EN_TOKEN_ALIASES` → server `/tasks/search` query                                       | Client-side query rewriting (Task 3 G-13 fix). The server is unmodified per D-16.                                                                                                                                                                                                         |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                    | Disposition | Mitigation Plan                                                                                                                                                                                                    |
| ---------- | ---------------------- | ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-07-16-01 | Tampering              | LLM translation output (Task 5 regen)                                        | mitigate    | `tools/i18n/validate.ts` enforces structural shape parity with en.json; the vernacular brief is a fixed system prompt; sidecar audit JSONs record model + brief version + en.json SHA. Same posture as plan 07-11. |
| T-07-16-02 | Information Disclosure | en.json → catalogs                                                           | accept      | en.json contains user-visible copy only — no secrets, no PII, no system identifiers.                                                                                                                               |
| T-07-16-03 | Spoofing               | LLM may produce culturally inappropriate output                              | accept      | Per-locale legal review deferred to §v2 per CONTEXT.md Deferred Ideas. Operator's full-deep 7-locale walk (Task 8) is the final human review.                                                                      |
| T-07-16-04 | Tampering              | Server returns unexpected English `task.name` not in TASK_CATALOG_I18N       | mitigate    | `localizeTaskName` falls back to the canonical English (the input) per D-12 — graceful, not crash. No new attack surface vs the pre-plan state.                                                                    |
| T-07-16-05 | Denial of Service      | EN_TOKEN_ALIASES lookup applied to malicious en query (extremely long token) | accept      | Token-length is implicitly bounded by the search input field; the alias map lookup is O(1) per token; CPU cost is negligible.                                                                                      |

</threat_model>

<verification>
1. `pnpm i18n:validate` exits 0 across all 8 catalogs.
2. `pnpm -r --parallel test --filter "@humyn/mobile"` exits 0 with all Tasks 2-6 new tests PASS.
3. `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest` exits 0.
4. `cd tools && pnpm test` exits 0.
5. All 6 invariant grep gates from Task 7 return empty (iOS / apps/api / Phase-6 cosmetics vs `5879daf` per WARNING 11 / HevcEncoder+FinalizeWorker+MetadataComposer / ttsVoice / RigTutorial).
6. The 07-HUMAN-UAT.md Re-walk block (Task 8) records PASS for all 16 gaps × 7 locales (or surfaces FAILs as a fresh gap list).
7. `git diff --numstat -- apps/mobile/src/i18n/taskCatalog.i18n.ts` shows 0 in the DELETED-lines column (additive EOF EN_TOKEN_ALIASES append from Task 3 is the only change — per NOTE 15).
8. APK BUILD SUCCESSFUL on the Pixel 10a flavor + installed.
</verification>

<success_criteria>

- **G-13 closed:** client-side curated EN_TOKEN_ALIASES map (recyclable / recyclables / recycle / recycling → recyclables) — verified via Vitest + the operator's hardware walk. NO live HTTP probe (per checker BLOCKER 3). Backend `/tasks/search` untouched (D-16).
- **G-14 closed:** CompatCheck probe-label rows allow 2-line wrap + auto-shrink; Devanagari renders complete.
- **G-15 closed:** "Live preview" pill text center-aligned within the pill (StyleSheet fix at ~line 1287 per WARNING 6; JSX at ~line 1018 unchanged).
- **G-16 closed:** HomeScreen `tileLabel(named, custom, t)` routes 6 hardcoded literals through `t('home.filter.<named>')`; chevron `▾` stays in JSX template; `StatCard.tsx` does NOT exist and is NOT touched (per BLOCKER 1).
- **G-17 closed:** TaskCategoryPills route 11 enum values through `tasks.category.*` keys.
- **G-18 closed (KEYSTONE):** TasksScreen task cards render translated name + category via new `taskI18n.ts` helpers driven by TASK_CATALOG_I18N (the 602 LLM translations from 07-12 finally connect to the rendering path).
- **G-19 closed:** TaskDetailsSheet renders translated name + category + description + instructions + the 4 ALWAYS rules (UniversalRulesBlock).
- **G-20 closed:** History empty-state copy routes through `t('history.empty.{firstTime,filtered}.{heading,body,cta}')`.
- **G-21 closed:** FilterSheet OPTIONS array routed through `t()`; sheet title via `t('history.filterSheet.title')`. Reuses the existing `history.filter.*` 6 keys (chevron-free since these are sheet rows).
- **G-22 closed:** ReportProblemSheet chip TEXT + accessibilityLabel route through `t('report.category.*')` (8 keys); testID stays English (server contract). UX simplifications documented (`imu-issue` → 'Sensor issue', `thermal-issue` → 'Device overheating') per WARNING 8.
- **G-23 closed:** RootNativeStack HelpCenter screenOptions use `headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" />` — locale-reactive header (per WARNING 7).
- **G-24 closed:** SendRequestSheet category chips reuse `tasks.category.*`; Indoor/Outdoor toggle routes through `tasks.setting.{indoor,outdoor}`.
- **G-25 closed:** RecordingScreen app-bar task name receives the localized form via the navigation param set by TaskDetailsSheet.
- **G-26 closed:** RotatePrompt Text gains numberOfLines={2} + adjustsFontSizeToFit; Devanagari renders complete.
- **G-27 closed:** Hand-gate prompt Text gains the same overflow-safe props.
- **G-28 closed:** HistoryRow `formatUploadedAt` routes through `t('history.row.uploadedAt', { time })`; FEEDBACK (COMING SOON) routes through `t('history.row.feedbackComingSoon')`; historyGrouping.ts day-section titles route through `t('history.daySection.{today,yesterday,thisWeek,thisMonth}')` per WARNING 9; `HistoryDayHeader.tsx:37` `.toUpperCase()` STAYS (intentional design choice).
- **7 non-English catalogs regenerated** by Task 5 with the ~34 new keys + the 6 modified `home.filter.*` chevron-stripped values; shape parity green.
- **Operator-walked 7-locale re-walk PASSES** on Pixel 10a (Task 8), per the owner directive "skip nothing".
- **All invariants green:** iOS untouched (I18N-21 SPEC-local) / apps/api untouched (D-16) / Phase-6 cosmetics untouched VS `5879daf` (per WARNING 11) / HevcEncoder+FinalizeWorker+MetadataComposer untouched / ttsVoice untouched / RigTutorial untouched.
- **`taskCatalog.i18n.ts` 86×8 catalog DATA byte-identical** (per NOTE 15) — the new `EN_TOKEN_ALIASES` export is the only addition, appended at EOF with 0 DELETED lines.

</success_criteria>

<rewalk_protocol>

## Task 8 — Full 7-locale hardware re-walk protocol

**Device:** Pixel 10a `5C161JEA304304`
**APK:** the fresh `apkRolloutDebug` build from Task 7 (commit pinned in Task 7 step 5)
**Locales (in order):** pt-BR → es → hi-IN → bn-IN → ta-IN → te-IN → mr-IN
**Operator directive (verbatim 2026-05-26 17:30 IST):** "i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device."

### Per-locale walking sequence (~12 min each)

For each of the 7 non-English locales:

1. **Switch locale:** Profile → Language → tap the locale row. Sheet auto-dismisses. Profile re-renders translated within 1 frame.

2. **HomeScreen** — confirm:

   - G-16: tile period chip text reads in active locale ("today" → Hindi "आज" etc.), with the chevron `▾` still rendered.
   - The HomeHero greeting + empty-state copy already translated (07-11 closure) — sanity check, not a 07-16 gap.

3. **TasksScreen** — confirm:

   - G-17: category filter chips at the top read in active locale ("Cooking" → Hindi "खाना पकाना" / pt-BR "Cozinhar" / etc.)
   - G-18: task cards in the grid render translated name + category eyebrow. Specifically check the 6 cooking cards visible in img-4: Chopping, Dicing, Slicing, Peeling, Kneading or rolling dough, Plating or serving food/drinks — each should render in the active locale.
   - **G-13 reverse-check** (any locale): in the search input, type a localized task name. The full-string Stage-1 hit should resolve to the canonical EN. Verify by checking the resulting card list is non-empty.

4. **TaskDetailsSheet** (tap any task) — confirm:

   - G-19: task name + category eyebrow + description + instructions all in active locale.
   - The 4 ALWAYS rules (UniversalRulesBlock) — "Keep your hands in frame" → Hindi "अपने हाथ फ़्रेम में रखें" (or LLM regen) / pt-BR "Mantenha as mãos enquadradas" / etc.
   - Task-specific instructions (the 3 strings under "इस काम के लिए" / similar localized section header).
   - The "Start Recording" CTA already translated (07-11 closure) — sanity check.

5. **Send Request flow** (from TasksScreen footer link OR empty-state CTA) — confirm:

   - G-24: category chips (the 11 categories) in active locale.
   - G-24: Indoor / Outdoor segmented toggle in active locale.
   - The form eyebrow labels (TASK NAME, DESCRIPTION, CATEGORY, SETTING) already translated (verify; if not, this is a new gap for a follow-on).

6. **RecordingScreen entry** (tap a task → Start Recording → walk into the recording UI) — confirm:

   - G-25: app-bar task name in active locale (not the English source).
   - G-26: rotate-to-landscape prompt — if the device is portrait, the prompt renders without truncation; the full Devanagari string is visible. (Rotate the device once to clear the prompt.)
   - G-27: hand-gate prompt — when the camera opens but no hands are detected, the gate prompt renders without truncation. (Wait 2 seconds OR cover the lens so the gate doesn't pass immediately.)
   - Once the gate passes and recording starts (or use the "Skip" button to skip the gate):
     - G-15: the "Live preview" pill at the bottom-center — the text INSIDE the pill is center-aligned.
   - Cover the lens to force `fps_dropped` cancel OR Stop the recording cleanly.

7. **HistoryScreen** — confirm:

   - G-20: if empty (e.g. after a clean install), the empty-state copy in active locale.
   - G-28: if rows exist, each row shows the task name in active locale (downstream of G-18), "Uploaded at HH:MM" prefix translated, "FEEDBACK (COMING SOON)" eyebrow translated. The day-section headers (TODAY / YESTERDAY / THIS WEEK / THIS MONTH) render in the active locale, uppercase (Latin locales get the uppercase form; Devanagari/etc are casing-no-ops).
   - G-21: tap the time-filter chip at the top → FilterSheet opens → sheet title "Filter by" + 6 option rows all in active locale.

8. **Help Center** (from Profile or via the help icon) — confirm:

   - G-23: app-bar title "Help Center" in active locale.
   - **Locale-reactive header check (WARNING 7 fix):** after entering Help Center in one locale, swipe back to Profile → Language → switch to another locale → re-navigate to Help Center → the header should now show in the NEW locale (the function-form-options approach would FAIL this check; the TranslatedHeaderTitle approach passes).
   - Article body already translated (07-13 closure) — sanity check.

9. **Report a Problem** (from Profile) — confirm:

   - G-22: issue category chips in active locale (8 chips).
   - **TalkBack accessibilityLabel check (WARNING 12 fix):** enable TalkBack via Settings → Accessibility → TalkBack; swipe through the chips. TalkBack should speak the chips in the active locale, NOT in English. (The testID stays English for testing, but accessibilityLabel is now localized.)
   - The form labels + CTAs already translated (07-11 closure) — sanity check.

10. **CompatCheck** — confirm:

    - G-14: probe labels (Ultrawide camera / Resolution & frame rate / Motion sensors / Stable sensor stream / Microphone / Time sync source / Device integrity) render complete in active locale, no truncation. The 2-line wrap kicks in for Devanagari/Bengali/Tamil/Telugu where needed.
    - **How to invoke CompatCheck:** Profile → Settings → "Run compatibility check" OR a direct deep-link if available. If neither is trivially accessible, defer G-14 verification to a clean-install walk (CompatCheck fires automatically on first launch per Phase 2).

11. **Record verdicts:** for each gap above, write PASS or FAIL to the per-locale row in the `07-HUMAN-UAT.md` re-walk matrix.

### G-13 dedicated walk (en + cross-locale)

**en locale:**

- TasksScreen → search input → type `"recyclable"` → expected: "Sorting recyclables" task in results. PASS / FAIL.
- Repeat with `"recyclables"` (plural). PASS / FAIL.
- Repeat with `"recycle"` (verb form). PASS / FAIL.
- Repeat with `"recycling"` (gerund). PASS / FAIL.

**hi-IN cross-check:**

- Switch to hi-IN. Search input → type `"पुनर्चक्रण योग्य"` (or whatever the LLM regen produced for "Sorting recyclables" — verify by checking `apps/mobile/src/i18n/taskCatalog.i18n.ts` `'Sorting recyclables'.'hi-IN'.name`). The Stage-1 hit should map to canonical EN `"Sorting recyclables"`, server search should match, result list non-empty. PASS / FAIL.

### Operator sign-off

When all 7 locales walked + G-13 verified, operator types one of:

- `"approved — 07-16 walk all PASS"` → Phase 7 is ready for 07-15 re-attempt
- `"07-16 walk done — FAILs: {locale}/{gap}, ..."` → Claude files the failed gaps + routes to follow-on plan

</rewalk_protocol>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-16-SUMMARY.md` documenting:
- The 16 gaps closed (G-13..G-28) with per-gap files-modified evidence and the LLM-regen audit timestamp.
- The Task 1 root-cause finding for G-18 (the key insight that TasksScreen reads from the server, not the catalog — and the helper added in Task 2 bridges this).
- A `grep` evidence block confirming every English literal removed (the grep assertions from the acceptance criteria).
- The `pnpm i18n:validate` output snapshot post-regen.
- The Pixel 10a 7-locale hardware re-walk verdict from Task 8 (PASS/FAIL matrix).
- A note that 07-15 (paused) is now unblocked and can re-attempt its Bundle 1 + Bundle 2 + wrap-up walk.
- The revision history: revision iteration 1/3 fixes per checker BLOCKERs 1-4 + WARNINGs 5-12 + NOTEs 13-15.
- A "lesson learned" block referencing memory `feedback_hardware_walk_beats_grep_gates.md` — for future closure agents to take to heart.
</output>
