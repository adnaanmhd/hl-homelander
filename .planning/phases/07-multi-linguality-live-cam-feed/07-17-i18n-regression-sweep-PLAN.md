---
phase: 07-multi-linguality-live-cam-feed
plan: 17
type: execute
wave: 5
depends_on: [10, 11, 12, 13, 14, 16]
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
  - apps/mobile/src/screens/history/HistoryScreen.tsx
  - apps/mobile/src/screens/shared/FilterSheet.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/recording/components/RotatePrompt.tsx
  - apps/mobile/src/components/TaskCategoryPills.tsx
  - apps/mobile/src/components/ReportProblemSheet.tsx
  - apps/mobile/src/ui/primitives/Button.tsx
  - apps/mobile/src/screens/tasks/SendRequestSheet.tsx
  - apps/mobile/__tests__/screens/history/HistoryScreen.emptyTail.i18n.test.tsx
  - apps/mobile/__tests__/screens/shared/FilterSheet.customRange.i18n.test.tsx
  - apps/mobile/__tests__/screens/recording/RecordingScreen.practiceFallback.i18n.test.tsx
  - apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts
  - apps/mobile/__tests__/ui/Button.numberOfLines.test.tsx
  - .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md
  - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
autonomous: false
gap_closure: true
requirements:
  - I18N-01
  - I18N-11
# Trimmed honestly: this plan addresses one-locale-everywhere completeness
# (I18N-01) and the "Phase 6 cosmetic gaps not re-opened" invariant (I18N-11).
# Other phase requirements (I18N-02..10, I18N-12, REC-LIVE-*) are already
# satisfied by upstream plans 07-01..07-16 and are NOT re-claimed here. Plan
# 07-16's frontmatter listed [I18N-01, I18N-10, I18N-11]; 07-17 drops I18N-10
# because no task here touches the reverse-search / taskCatalog tokenization
# (G-13 closure path stays intact; this plan does not extend it).
tags: [i18n, gap-closure, mobile, layout, overflow, devanagari, regression-sweep, rewalk]
must_haves:
  truths:
    - "G-13 re-walked (carried into Task 8 from 07-16 Bucket C — NOT walked during the 2026-05-26 hi-IN walk because the operator never reached the search step). Verified on Pixel 10a: in TasksScreen search input, type 'recyclable' / 'recyclables' / 'recycle' / 'recycling' in en locale — each query returns the 'Sorting recyclables' task. Cross-check in hi-IN: typing the hi-IN catalog form for 'Sorting recyclables' (looked up live from `taskCatalog.i18n.ts['Sorting recyclables']['hi-IN'].name`) hits via reverseSearch.ts Stage 1. The 07-16 EN_TOKEN_ALIASES + reverseSearch.ts en-branch implementation stays UNTOUCHED by 07-17 — Task 8 verifies the implementation already shipped."
    - "G-14 re-walked (carried into Task 8 from 07-16 Bucket C — NOT walked during 2026-05-26 because CompatCheck doesn't fire on signed-in installs). Verified on Pixel 10a via a CLEAN install (`adb uninstall ai.humynlabs.capture.apk && adb install`): CompatCheck probe-label rows in hi-IN render complete Devanagari strings — no clipping. The 07-16 `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` props on CompatRunningScreen.tsx ~line 285 stay UNTOUCHED — Task 8 verifies on a fresh-install path."
    - "G-15 closed (Live preview pill tap-to-reveal hint truncation): the bug is NOT on the `liveLabelText` style (which 07-16 already fixed to `textAlign: 'center'`) but on the SIBLING `liveEyeHint` Text at RecordingScreen.tsx:1008-1010 (rendered during the dimmed state). The hi-IN value `recording.preview.tapToReveal` = `'प्रीव्यू देखने के लिए स्क्रीन पर टैप करें'` clips to `'...टैप'` because the Text has no overflow guards. Fix: add `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` to the `liveEyeHint` Text element AND give the parent `liveBottomCenter` view a `maxWidth` (or `paddingHorizontal`) so the Text has room to wrap to 2 lines without colliding with the screen edges."
    - "G-17 closed (TaskCategoryPills truncate when active/bold variant): TaskCategoryPills.tsx pill labels gain `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}` AND the `pill` / `pillActive` styles get `paddingHorizontal: spacing.l` REDUCED to `spacing.m` for non-cooking-class pills (keeping the active-bold visual but adding ~10% horizontal slack). The ScrollView contentContainerStyle gains `paddingRight: spacing.xl` so the rightmost pill (`बागवानी` per operator screenshot 7.png) has safe-area room not to clip at the screen edge."
    - "G-19 re-walked (carried into Task 8 from 07-16 Bucket C — NOT walked because the operator didn't tap any task in the 2026-05-26 walk). Verified on Pixel 10a: TaskDetailsSheet for at least one task renders translated name + category eyebrow + description + 4 ALWAYS rules + per-task instructions in the active locale. The 07-16 taskI18n.ts helpers (localizeTaskName/Category/Description/Instructions) + UniversalRulesBlock labelKey wiring stay UNTOUCHED — Task 8 verifies the existing wire fires correctly on real device data."
    - "G-20 closed (History empty-state trailing English literal): HistoryScreen.tsx:599 — the JSX literal ` and try one.` after the `<Text>{t('history.empty.firstTime.cta')}</Text>` link moves into a new en.json key `history.empty.firstTime.bodyTail` (value `' and try one.'` — including the leading space). Render becomes `{t('history.empty.firstTime.body')}{'\\n'}<Text>...cta...</Text>{t('history.empty.firstTime.bodyTail')}`. The same pattern is checked on the `filtered` empty branch — line 571 has a trailing literal `.` after `{t('history.empty.filtered.cta')}`; this stays as the period punctuation is uniform across languages OR also moves to `history.empty.filtered.bodyTail` if the LLM regen handles it more naturally. Decision recorded in Task 1 investigation."
    - "G-21 closed (FilterSheet Custom-range sub-sheet entirely untranslated): the 7 hardcoded English strings in `FilterSheet.tsx` Custom-range sub-sheet (lines 294 / 295 / 296 / 301 / 305 / 317+346 / 334 / 375 / 385) all move through new `t()` keys: `history.filter.customRange.{title,from,to,placeholder,errorMissing,errorInverted,errorFuture,cancel,apply}` (9 keys). en.json gains the 9 keys; Task 5 LLM-regen propagates to 7 non-en locales. The existing base sheet's `history.filter.*` and `history.filterSheet.title` (added by 07-16) stay UNTOUCHED."
    - "G-22 closed (Cancel button truncation in Report Problem + Custom-range sub-sheet — `रद्द करें` clips to `रद`): root cause is two distinct Text-without-overflow-guard sites. (a) The shared `Button` primitive at `apps/mobile/src/ui/primitives/Button.tsx:85` — the internal `<Text variant=\"btnLabel\">` has no `numberOfLines` / `adjustsFontSizeToFit` — handles ReportProblemSheet Cancel + ~30 other call sites. (b) FilterSheet Custom-range footer at `apps/mobile/src/screens/shared/FilterSheet.tsx:369-388` uses raw `<Pressable>` + `<Text variant=\"btnLabel\">` and does NOT consume `<Button>` (verified by plan-checker: `grep -c \"<Button\" FilterSheet.tsx` = 0; Task 3 Button primitive change does NOT propagate here). Fix: (a) add `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}` to Button.tsx:85's internal Text (Task 3). (b) add the SAME three props inline to both raw Text elements at FilterSheet.tsx:373 (Cancel) + FilterSheet.tsx:384 (Apply) — Task 2 G-21 step 3. ADDITIONALLY: ReportProblemSheet category chip Text (line 119-124) gains `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` so long Devanagari chip labels wrap inside the chip rather than overflowing past the parent's flexWrap row. All three fixes share the same heuristic but apply at different layers."
    - "G-24 closed (SendRequestSheet Indoor/Outdoor segmented toggle showing `घर के` for BOTH — Devanagari truncation, NOT a key collision): the hi-IN.json values are correctly distinct (`tasks.setting.indoor` = `'घर के अंदर'`, `tasks.setting.outdoor` = `'घर के बाहर'`). The bug is the segmented pill's Text has no overflow guard, so both 5-char Devanagari labels clip at the first `के`. Fix: add `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}` to both segmented pill labels in SendRequestSheet.tsx (lines 334-339 + 347-354). Add a Vitest regression test asserting `t('tasks.setting.indoor', { lng: L })` !== `t('tasks.setting.outdoor', { lng: L })` for every locale in SUPPORTED_LOCALES — guards against a future LLM-regen collision that the operator's truncation observation accidentally surfaced."
    - "G-25 closed (RecordingScreen app-bar shows `Practice — 60 sec` in English on hi-IN): bug site is `apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx:46-50` — `PRACTICE_ROUTE_PARAMS` hardcodes `taskName: 'Practice — 60 sec'`. AND `apps/mobile/src/screens/recording/RecordingScreen.tsx:178` has the matching fallback `params.taskName ?? 'Practice — 60 sec'`. Fix: (a) delete `taskName` from `PRACTICE_ROUTE_PARAMS` (let it fall through as `undefined`); (b) at RecordingScreen.tsx:178, change the fallback from the hardcoded literal to `t('recording.practiceFallback')` (key added to en.json + LLM-regen'd to 7 non-en locales in Task 5); (c) move the `taskName = params.taskName ?? ...` resolution INSIDE the component (after the `useTranslation()` hook at line 182) so the fallback is locale-reactive. Hindi value will be the LLM regen of `'Practice — 60 sec'`."
    - "G-26 closed (RotatePrompt body still 1-line clips even with 07-16's `numberOfLines={2}` + `adjustsFontSizeToFit`): the 07-16 fix is intact at `apps/mobile/src/screens/recording/components/RotatePrompt.tsx:115-123`, but the parent container in `RecordingScreen.tsx:1076 styles.body` has constraints that win over the Text's wrap. Root cause investigated in Task 1. Fix: (a) confirm `styles.body` in RecordingScreen.tsx does NOT have a fixed `height` — if it does, replace with `minHeight` + `flex: 1`; (b) confirm `styles.wrap` in RotatePrompt.tsx is `flex: 1` (it is — line 129) AND give the `styles.body` Text a `paddingHorizontal: spacing.l` so the wrap has horizontal slack. Additionally lower the `minimumFontScale` from `0.85` to `0.75` to handle the longest Devanagari/Tamil/Telugu/Bengali/Marathi rotate-prompt forms."
    - "G-27 closed (HandGate prompt wraps with visible vertical gap; Hindi prose awkwardness): root cause is the `recGatePrompt` Text variant in `apps/mobile/src/ui/tokens.ts:212-216` has `lineHeight: 24` on `fontSize: 17` — that's 41% leading, which renders as a visible vertical gap when wrapping to 2 lines. Fix: at the JSX call site `RecordingScreen.tsx:1093-1101`, OVERRIDE the variant lineHeight with an inline `style={[styles.gatePrompt, { lineHeight: 20 }]}` (20 = ~118% leading; more compact). Do NOT modify `ui/tokens.ts:recGatePrompt` (the variant is used by other call sites). Lower `minimumFontScale` from `0.85` to `0.75` to match G-26. Additionally: the hi-IN.json value `recording.gatePrompt` is reworded from `'2 सेकंड के लिए हाथ फ्रेम में छोड़ें'` to the spec form `'2 सेकंड तक अपने हाथ फ़्रेम में रखें'` (more natural Hindi; the LLM produced an awkward translation that even the wrap fix can't make readable). This is a direct hi-IN.json edit performed AFTER Task 5's LLM regen so it survives — see Task 5 step 7."
    - "G-28 re-walked (carried into Task 8 from 07-16 Bucket C — NOT walked because the operator's History was empty during 2026-05-26). Verified on Pixel 10a after capturing at least one practice or real recording: HistoryRow renders task name in active locale (downstream of G-25/G-18 fixes), `Uploaded at HH:MM` prefix translates via `t('history.row.uploadedAt', { time })`, FEEDBACK (COMING SOON) eyebrow translates, day-section header (TODAY / YESTERDAY / THIS WEEK / THIS MONTH) renders in active locale per the 07-16 historyGrouping.ts wire + WARNING-9 .toUpperCase() decision. The 07-16 wires stay UNTOUCHED — Task 8 verifies the existing implementation on real device data."
    - "G-29 disposition (NEW from 07-16 walk: operator reported History tab label rendering as `हिन्दी` (language name) instead of `इतिहास` / `हिस्ट्री`): Task 1 investigation found that the actual hi-IN.json `tabs.history` value is `'हिस्ट्री'` (correctly transliterated 'History'), and `BottomNav.tsx` correctly routes through `t('tabs.history')` (line 49 / line 131 — confirmed via grep). The screenshot evidence at `07-16-rewalk-evidence/2026-05-26-hi-IN/3.png` shows the History tab IS rendering as `हिस्ट्री`, NOT `हिन्दी` — the operator's matrix entry appears to be a TRANSCRIPTION ERROR. Task 1 records the discrepancy; Task 8 hardware re-walk confirms via fresh screenshot. NO code change required for G-29; the verdict is PASS by re-observation. If Task 8 reveals the bug IS real on a different code path (e.g. an alternate dev-build APK), Task 1's investigation flags it and the plan PAUSES for an in-scope fix."
    - "Operator-walked 7-locale hardware re-walk on Pixel 10a PASSES across all FAIL rows from 07-16 + the Bucket C deferred surfaces (G-13/G-14/G-19/G-28) + G-29 disposition. The walk order is the LOCKED one (hi-IN → pt-BR → es → bn-IN → ta-IN → te-IN → mr-IN — per memory `feedback_walk_locale_order`). Verdicts recorded row-by-row in a fresh `## Re-walk 2026-05-XX (Plan 07-17 closure)` block in `07-HUMAN-UAT.md`."
    - "Non-negotiable invariants green: iOS untouched (I18N-21 SPEC-local invariant) — `git diff --stat apps/mobile/ios/` empty; NO backend changes (D-16) — `git diff --stat apps/api/` empty (includes drizzle/migrations + routes + schema); Phase-6 cosmetic gaps untouched VS THE CURRENT MAIN HEAD (07-17 has no renumber-sweep pretext to touch it) — `git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty (I18N-11); ultrawide lens code + HevcEncoder + FinalizeWorker + MetadataComposer + RealtimeGate UNCHANGED (CLAUDE.md drift + cancel banners) — empty diffs on `CaptureSession.kt`, `HevcEncoder.kt`, `FinalizeWorker.kt`, `MetadataComposer.kt`; `taskCatalog.i18n.ts` UNCHANGED — `git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts` empty (the 07-16 EN_TOKEN_ALIASES additive append is unchanged); `ttsVoice.ts` UNCHANGED (TTS owner-deviation guard); `RigTutorialScreen.tsx` UNCHANGED (RigTutorial owner-deviation guard)."
  artifacts:
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md
      provides: 'Task 1 deliverable — recorded root-cause findings for G-25 (PracticeIntroScreen + RecordingScreen fallback path), G-29 (BottomNav tab-label trace; verifies the bug may be a transcription error), G-20 (history.empty.firstTime trailing literal site), G-22 (Cancel button shared Button primitive vs. hi-IN value), G-24 (Indoor/Outdoor truncation vs. key collision)'
      contains: 'Root cause'
    - path: apps/mobile/src/i18n/locales/en.json
      provides: '~12 new keys + 1 modified hi-IN value (in Task 5b post-regen patch). New keys: `history.empty.firstTime.bodyTail` (' and try one.'), `history.filter.customRange.{title,from,to,placeholder,errorMissing,errorInverted,errorFuture,cancel,apply}` (9), `recording.practiceFallback` (Practice — 60 sec). The existing keys (rules.universal.*, tasks.category.*, tasks.setting.*, report.category.*, history.empty.*, history.filterSheet.title, history.row.*, helpCenter.title — all added by 07-16) STAY UNTOUCHED.'
      contains: 'history.filter.customRange'
    - path: apps/mobile/src/i18n/locales/hi-IN.json
      provides: 'Hindi catalog regenerated by `pnpm i18n:generate` after en.json updates — shape parity with en.json + non-empty Devanagari values for the ~12 new keys. POST-REGEN PATCH (Task 5b): `recording.gatePrompt` overwritten from the LLM-produced awkward form to the spec form `2 सेकंड तक अपने हाथ फ़्रेम में रखें` (G-27 prose fix). The patch is surgical and the audit sidecar is updated to document the manual override per WARNING-style discipline.'
      contains: 'history.filter.customRange'
    - path: apps/mobile/src/screens/history/HistoryScreen.tsx
      provides: 'Line 599 — replace JSX literal ` and try one.` with `{t(''history.empty.firstTime.bodyTail'')}`. If Task 1 reveals the `.filtered` branch (line 571 ".") also needs a key, add it; otherwise the period punctuation stays as-is.'
      contains: 'history.empty.firstTime.bodyTail'
    - path: apps/mobile/src/screens/shared/FilterSheet.tsx
      provides: 'Custom-range sub-sheet (lines 294-388) — 7 hardcoded English literals replaced with t() calls: title (301), FROM/TO labels (305/334), Pick-a-date placeholders (317/346), 3 error messages (294-296), Cancel/Apply buttons (375/385).'
      contains: 'history.filter.customRange'
    - path: apps/mobile/src/screens/recording/RecordingScreen.tsx
      provides: 'Line 178 fallback moves from hardcoded `Practice — 60 sec` to `t(''recording.practiceFallback'')` — line is repositioned INSIDE the component after `useTranslation()` at line 182 so `t` is in scope. Line 1093-1101 gatePrompt Text gets `style={[styles.gatePrompt, { lineHeight: 20 }]}` + `minimumFontScale={0.75}` (G-27 leading + scale fix). Lines 1008-1010 `liveEyeHint` Text gets `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` (G-15 — distinct from 07-16''s `liveLabelText` fix).'
      contains: 'recording.practiceFallback'
    - path: apps/mobile/src/screens/recording/components/RotatePrompt.tsx
      provides: 'Lower minimumFontScale on the body Text from 0.85 to 0.75 (G-26 — handles longer Devanagari/Indic forms); add `paddingHorizontal: spacing.l` to `styles.body` (or `styles.wrap`) so the wrap has horizontal slack.'
      contains: 'minimumFontScale={0.75}'
    - path: apps/mobile/src/components/TaskCategoryPills.tsx
      provides: 'pill / pillActive style reduces paddingHorizontal from spacing.l to spacing.m (~10% slack); contentContainerStyle gains paddingRight: spacing.xl; the Text inside each pill gains numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}. The 11 pill enum values + the `pillLabel(value, t)` resolver (added by 07-16) STAY untouched.'
      contains: 'numberOfLines={1}'
    - path: apps/mobile/src/components/ReportProblemSheet.tsx
      provides: 'Chip Text element (lines 119-124) gains numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85} so Devanagari chip labels can wrap to 2 lines inside the chip. The chip style does NOT change (preserves the flexWrap + gap layout the 07-16 fix put in place).'
      contains: 'numberOfLines={2}'
    - path: apps/mobile/src/ui/primitives/Button.tsx
      provides: 'Internal `<Text variant="btnLabel">` at line 85 gains numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}. This is a CROSS-CUTTING change — every Button in the app (~30+ call sites) gets the new overflow guards. Risk: if any Button''s label was relying on multi-line wrap, that breaks. Mitigation: a new Vitest test asserts existing button labels in en + hi-IN render and pass through the props. Document in Task 3.'
      contains: 'numberOfLines={1}'
    - path: apps/mobile/src/screens/tasks/SendRequestSheet.tsx
      provides: 'Lines 334-339 + 347-353 — Indoor/Outdoor segmented Text elements gain numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}. The pill/Pressable styles + the t() wires from 07-16 stay UNTOUCHED.'
      contains: 'numberOfLines={1}'
    - path: apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts
      provides: 'Vitest regression test asserting `t(''tasks.setting.indoor'', { lng: L })` !== `t(''tasks.setting.outdoor'', { lng: L })` for every locale in SUPPORTED_LOCALES (8 locales × 2 keys = 16 assertions). Catches future LLM-regen collisions even if the operator hardware walk doesn''t.'
      contains: "tasks.setting.indoor"
    - path: apps/mobile/__tests__/screens/recording/RecordingScreen.practiceFallback.i18n.test.tsx
      provides: 'Renders RecordingScreen with `route.params = {}` (the practice flow) and locale=''hi-IN''. Asserts the rendered task name in the app-bar is the Hindi value of `recording.practiceFallback`, NOT the English `Practice — 60 sec`. Mirrors the test pattern from `apps/mobile/__tests__/screens/tasks/SendRequestSheet.i18n.test.tsx`.'
      contains: 'practiceFallback'
    - path: apps/mobile/__tests__/ui/Button.numberOfLines.test.tsx
      provides: 'Renders Button with a long Devanagari label (`रद्द करें` × 3 = ~30 chars) and asserts the internal Text receives `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.75}` props. Mirrors the test infra pattern from `apps/mobile/__tests__/components/LanguageSheet.test.tsx`.'
      contains: 'Button'
  key_links:
    - from: apps/mobile/src/screens/recording/RecordingScreen.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "params.taskName ?? t('recording.practiceFallback') — locale-reactive practice fallback"
      pattern: "recording\\.practiceFallback"
    - from: apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
      to: apps/mobile/src/screens/recording/RecordingScreen.tsx
      via: "PRACTICE_ROUTE_PARAMS no longer carries `taskName` — falls through to RecordingScreen's t() fallback"
      pattern: "PRACTICE_ROUTE_PARAMS"
    - from: apps/mobile/src/screens/history/HistoryScreen.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "t('history.empty.firstTime.bodyTail') — closes the JSX literal escape at line 599"
      pattern: "history\\.empty\\.firstTime\\.bodyTail"
    - from: apps/mobile/src/screens/shared/FilterSheet.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "t('history.filter.customRange.*') — 9 new keys covering title / FROM / TO / placeholder / 3 errors / Cancel / Apply"
      pattern: "history\\.filter\\.customRange"
    - from: apps/mobile/src/ui/primitives/Button.tsx
      to: apps/mobile/src/components/ReportProblemSheet.tsx
      via: "All Button consumers inherit numberOfLines={1} + adjustsFontSizeToFit on the internal Text — closes the `रद` truncation across ReportProblem (Button consumer) + every other Button call site (~30 sites). FilterSheet Custom-range Cancel/Apply use raw `<Pressable>`+`<Text>` (NOT the Button primitive — verified via grep returning 0 `<Button>` matches in FilterSheet.tsx); they receive matching guards inline at Task 2 step 3 instead."
      pattern: "numberOfLines=\\{1\\}"
    - from: apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts
      to: apps/mobile/src/i18n/locales/*.json
      via: "asserts t(setting.indoor) !== t(setting.outdoor) for each of 8 locales — regression guard against LLM-regen value collisions"
      pattern: "tasks\\.setting"
---

<objective>
**Gap closure plan for the 9 FAIL rows from the 07-16 hi-IN hardware walk + 4 deferred Bucket C re-walks + 1 new G-29 disposition + the post-07-16 escape G-15 (live-pill tap-to-reveal hint).** Plan 07-16 (commit `612161a` Tasks 1-7 landed; Task 8 operator walk surfaced regressions per `07-16-TASK-8-HANDOFF.md`) successfully wired the 86×8 task catalog through every render site and added 34+ keys for G-13..G-28 surfaces. BUT the operator's hi-IN deep walk on 2026-05-26 caught 9 surfaces where (a) the wire didn't land (G-25 practice fallback, G-20 trailing English literal, G-21 Custom-range sub-sheet missed scope), (b) the layout fix wasn't deep enough (G-15 — fixed the wrong Text variant; G-17 — pill width too tight for bold-active glyphs; G-22 — chips + Cancel button truncate; G-26 — minimum scale too high; G-27 — leading too tall), or (c) the i18n value reads awkwardly (G-27 hi-IN prose). PLUS 4 Bucket C deferrals (G-13 / G-14 / G-19 / G-28) were not walked at all — Task 8 of 07-17 covers them via fresh-install + tap + real-recording entry states.

**The single owner-locked decision driving this plan:** "skip nothing" (2026-05-26 17:30 IST). The 07-17 Task 8 walk covers ALL FAIL rows AND ALL Bucket C deferrals AND the new G-29 disposition AND a fresh hi-IN full deep walk to surface any 4th-order escapes. Locale order is hi-IN → pt-BR → es → bn-IN → ta-IN → te-IN → mr-IN per memory `feedback_walk_locale_order` (Devanagari fronts truncation/wrap escapes fastest, so hi-IN is the canary).

**The lesson 07-17 internalizes (from memory `feedback_hardware_walk_beats_grep_gates.md`):** the 07-16 closure agents passed every narrow grep gate AND the planner's must_haves verifier, AND STILL 15 escapes shipped. Each task in 07-17 pairs BOTH a grep gate AND a per-locale hardware-walk pointer; Task 1's investigation step is the gating PAUSE-or-proceed signal (if any finding contradicts the handoff's expected fix path, the plan halts and surfaces to the owner before committing to a wrong fix). Task 8 (operator-walked) is THE integration gate — not the source-of-truth grep counts.

**Non-negotiable invariants (LOCKED — same as 07-16 + a tighter Phase-6 cosmetic-gaps gate since 07-17 has no renumber-sweep cover):**

- D-16: no `apps/api/` changes (the G-13 closure stays at the client level via 07-16's `EN_TOKEN_ALIASES` map; 07-17 does not extend it).
- I18N-21: no `apps/mobile/ios/` changes (Android-only at MVP per CLAUDE.md).
- Drift gate: do NOT touch `CaptureSession.kt`, `HevcEncoder.kt`, `MetadataComposer.kt`, `FinalizeWorker.kt` (CLAUDE.md drift + cancel banners).
- TTS deviation: do NOT modify `apps/mobile/src/lib/ttsVoice.ts` (en-US female-leaning per 2026-05-12 owner directive).
- RigTutorial deviation: do NOT modify `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` (owner-directed camera-framing tip).
- `taskCatalog.i18n.ts` UNCHANGED — the 86×8 catalog block + the EOF EN_TOKEN_ALIASES from 07-16 stay byte-identical. 07-17 has no business touching it.
- Phase-6 cosmetic-gaps: `git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty (07-17 has no rename-sweep pretext that justified 07-16's `5879daf` cluster-base comparison).

**Tasks (9 total — 1 investigation + 4 wires/layout + 1 LLM regen + 2 testing/build + 1 operator-walked):**

1. Task 1: investigation (G-25 root cause, G-29 trace, G-20 literal site, G-22 Button primitive vs hi-IN value, G-24 truncation vs collision). PAUSE-or-proceed.
2. Task 2: Bucket A wire 1 (G-20 + G-21 — the 10 new t() wires in HistoryScreen + FilterSheet).
3. Task 3: Bucket A wire 2 + Button primitive overflow guards (G-25 + G-22). Touches the cross-cutting Button primitive — test thoroughly.
4. Task 4: Bucket B layout fixes (G-15 liveEyeHint, G-17 TaskCategoryPills, G-22 chip text wrap, G-24 Indoor/Outdoor segment, G-26 RotatePrompt scale, G-27 gatePrompt leading).
5. Task 5: Direct i18n value patches (G-24 indoor/outdoor collision-regression test) AND LLM regen for the 12 new en.json keys via `pnpm i18n:generate` + Task 5b post-regen surgical patch for G-27 hi-IN prose.
6. Task 6: Regression test suite + invariant gates + APK build.
7. Task 7: (merged into Task 6 — see Task 6 step 5).
8. Task 8: Operator-walked 7-locale hardware re-walk on Pixel 10a — closes all FAIL rows + Bucket C deferrals + G-29 disposition.

Output: a build where every gap from 07-16's hi-IN walk verdict matrix renders correctly across all 7 non-en locales (+ G-13 in en + cross-locale), and `07-HUMAN-UAT.md` records the verdicts in a fresh `## Re-walk 2026-05-XX (Plan 07-17 closure)` block. After 07-17 lands, the original 07-15 (paused) can re-attempt its Bundle 1 + Bundle 2 + wrap-up walk to finalize Phase 7.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-16-TASK-8-HANDOFF.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-16-SUMMARY.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-15-PAUSE.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-16-i18n-completion-and-truncation-PLAN.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@CLAUDE.md
@apps/mobile/src/i18n/locales/en.json
@apps/mobile/src/i18n/locales/hi-IN.json
@apps/mobile/src/i18n/locale-meta.ts
@apps/mobile/src/i18n/taskCatalog.i18n.ts
@apps/mobile/src/i18n/taskI18n.ts
@apps/mobile/src/screens/history/HistoryScreen.tsx
@apps/mobile/src/screens/shared/FilterSheet.tsx
@apps/mobile/src/screens/recording/RecordingScreen.tsx
@apps/mobile/src/screens/recording/components/RotatePrompt.tsx
@apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
@apps/mobile/src/screens/tasks/SendRequestSheet.tsx
@apps/mobile/src/components/TaskCategoryPills.tsx
@apps/mobile/src/components/ReportProblemSheet.tsx
@apps/mobile/src/components/BottomNav.tsx
@apps/mobile/src/navigation/MainTabs.tsx
@apps/mobile/src/ui/primitives/Button.tsx
@apps/mobile/src/ui/tokens.ts
@tools/i18n/generate.ts
@tools/i18n/validate.ts

<interfaces>
<!-- Contracts the executor must respect — no codebase scavenger-hunt needed. -->

From `apps/mobile/src/screens/history/HistoryScreen.tsx` (line 588-600 — the G-20 bug site):

```tsx
<Text
  variant="body"
  tone="secondary"
  accessibilityLabel="history-empty-body"
  style={styles.emptyBody}
>
  {t('history.empty.firstTime.body')}
  {'\n'}
  <Text
    accessibilityRole="link"
    accessibilityLabel="history-empty-pick-a-task"
    onPress={onPickTask}
    style={styles.emptyLink}
  >
    {t('history.empty.firstTime.cta')}
  </Text>{' '}
  and try one.
</Text>
```

After (G-20 fix — JSX literal moves into `history.empty.firstTime.bodyTail`):

```tsx
<Text
  variant="body"
  tone="secondary"
  accessibilityLabel="history-empty-body"
  style={styles.emptyBody}
>
  {t('history.empty.firstTime.body')}
  {'\n'}
  <Text
    accessibilityRole="link"
    accessibilityLabel="history-empty-pick-a-task"
    onPress={onPickTask}
    style={styles.emptyLink}
  >
    {t('history.empty.firstTime.cta')}
  </Text>
  {t('history.empty.firstTime.bodyTail')}
</Text>
```

en.json gains:

```json
"history": { "empty": { "firstTime": { "bodyTail": " and try one." } } }
```

(Leading space inside the value — preserves the natural reading flow after the link. For hi-IN the LLM-regen will produce e.g. ` और एक करके देखें।` — the leading space stays because Devanagari rendering also benefits from it.)

From `apps/mobile/src/screens/shared/FilterSheet.tsx` lines 280-388 — the G-21 Custom-range sub-sheet (entirely untranslated):

```tsx
let errorText: string | null = null;
if (error === 'missing') errorText = 'Pick both dates.';                          // (294)
else if (error === 'inverted') errorText = '"From" date must be before "To" date.'; // (295)
else if (error === 'future') errorText = "Dates can't be in the future.";          // (296)

return (
  <View accessibilityLabel="filter-sheet-16b">
    <Text variant="sheetTitle" style={styles.title16b}>
      Custom range                                                                  {/* (301) */}
    </Text>
    <ScrollView style={styles.formScroll}>
      <Text variant="formLabel" style={styles.formLabel}>
        FROM                                                                        {/* (305) */}
      </Text>
      <RNPressable>
        <Text style={...}>
          {from.length > 0 ? from : 'Pick a date'}                                  {/* (317) */}
        </Text>
      </RNPressable>
      ...
      <Text variant="formLabel" style={styles.formLabel}>
        TO                                                                          {/* (334) */}
      </Text>
      <RNPressable>
        <Text style={...}>
          {to.length > 0 ? to : 'Pick a date'}                                      {/* (346) */}
        </Text>
      </RNPressable>
      ...
    </ScrollView>
    <View style={styles.footer}>
      <Pressable ...>
        <Text variant="btnLabel" style={styles.btnOutlineLabel}>
          Cancel                                                                    {/* (375) */}
        </Text>
      </Pressable>
      <Pressable ...>
        <Text variant="btnLabel" style={styles.btnPrimaryLabel}>
          Apply                                                                     {/* (385) */}
        </Text>
      </Pressable>
    </View>
  </View>
);
```

After (G-21 fix — all 9 literals through t()):

```tsx
let errorText: string | null = null;
if (error === 'missing') errorText = t('history.filter.customRange.errorMissing');
else if (error === 'inverted') errorText = t('history.filter.customRange.errorInverted');
else if (error === 'future') errorText = t('history.filter.customRange.errorFuture');

return (
  <View accessibilityLabel="filter-sheet-16b">
    <Text variant="sheetTitle" style={styles.title16b}>
      {t('history.filter.customRange.title')}
    </Text>
    <ScrollView>
      <Text variant="formLabel" style={styles.formLabel}>
        {t('history.filter.customRange.from')}
      </Text>
      <RNPressable>
        <Text>{from.length > 0 ? from : t('history.filter.customRange.placeholder')}</Text>
      </RNPressable>
      <Text variant="formLabel" style={styles.formLabel}>
        {t('history.filter.customRange.to')}
      </Text>
      <RNPressable>
        <Text>{to.length > 0 ? to : t('history.filter.customRange.placeholder')}</Text>
      </RNPressable>
      ...
    </ScrollView>
    <View style={styles.footer}>
      <Pressable>
        <Text variant="btnLabel" style={styles.btnOutlineLabel}>
          {t('history.filter.customRange.cancel')}
        </Text>
      </Pressable>
      <Pressable>
        <Text variant="btnLabel" style={styles.btnPrimaryLabel}>
          {t('history.filter.customRange.apply')}
        </Text>
      </Pressable>
    </View>
  </View>
);
```

en.json gains (under existing `history.filter` block — the `customRange` key already exists as `"customRange": "custom range"` from 07-16, so this NESTS a child object under it):

```json
"history": {
  "filter": {
    "customRange": {
      "title": "Custom range",
      "from": "FROM",
      "to": "TO",
      "placeholder": "Pick a date",
      "errorMissing": "Pick both dates.",
      "errorInverted": "\"From\" date must be before \"To\" date.",
      "errorFuture": "Dates can't be in the future.",
      "cancel": "Cancel",
      "apply": "Apply"
    }
  }
}
```

**SHAPE-PARITY NOTE:** the existing top-level key `history.filter.customRange` from 07-16 was a STRING value (`"custom range"`). 07-17 changes it to an OBJECT with sub-keys. This is a SCHEMA-BREAKING change for any consumer that does `t('history.filter.customRange')` expecting a string. Task 1 investigation MUST grep for such consumers; if any exist, RENAME the existing key from `customRange` to `customRangeChip` (used in the base FilterSheet OPTIONS array) before adding the new `customRange` object. Otherwise the LLM regen will fail shape parity validation. The executor decides the rename target at execution time based on the grep result; recommended rename target is `customRangeChip` to preserve the chip-versus-sub-sheet semantic distinction.

From `apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx` lines 46-50 — the G-25 root cause:

```typescript
const PRACTICE_ROUTE_PARAMS = {
  taskId: '__practice__',
  taskName: 'Practice — 60 sec', // <-- BUG (G-25): hardcoded English; defeats RecordingScreen's t() fallback
  isPractice: true,
} as const;
```

After (G-25 fix — drop the taskName so RecordingScreen's locale-reactive fallback wins):

```typescript
const PRACTICE_ROUTE_PARAMS = {
  taskId: '__practice__',
  isPractice: true,
  // taskName intentionally omitted — RecordingScreen.tsx:178 falls back to
  // t('recording.practiceFallback') so the locale switch in Profile re-renders.
} as const;
```

From `apps/mobile/src/screens/recording/RecordingScreen.tsx` lines 173-188:

```typescript
export default function RecordingScreen({ __test_initialState }: RecordingScreenProps = {}) {
  const navigation = useNavigation<NavigationLike>();
  const route = useRoute<{ key: string; name: string; params?: RecordingRouteParams }>();
  const params = route.params ?? {};
  const taskId = params.taskId ?? '__practice__';
  const taskName = params.taskName ?? 'Practice — 60 sec';     // <-- BUG (G-25): hardcoded English
  const taskCategory = params.taskCategory ?? 'practice';
  const taskSetting: 'indoor' | 'outdoor' = params.taskSetting ?? 'indoor';
  const isPractice = params.isPractice ?? false;
  const { t, i18n } = useTranslation();                         // <-- t/i18n declared AFTER taskName fallback

  const [state, dispatch] = useReducer(
    recReducer,
    __test_initialState ?? initialRecState({ taskId, taskName, isPractice }),
  );
```

After (G-25 fix — move the fallback below the useTranslation hook so `t` is in scope):

```typescript
export default function RecordingScreen({ __test_initialState }: RecordingScreenProps = {}) {
  const navigation = useNavigation<NavigationLike>();
  const route = useRoute<{ key: string; name: string; params?: RecordingRouteParams }>();
  const params = route.params ?? {};
  const taskId = params.taskId ?? '__practice__';
  const taskCategory = params.taskCategory ?? 'practice';
  const taskSetting: 'indoor' | 'outdoor' = params.taskSetting ?? 'indoor';
  const isPractice = params.isPractice ?? false;
  const { t, i18n } = useTranslation();
  const taskName = params.taskName ?? t('recording.practiceFallback');   // <-- moved AFTER useTranslation

  const [state, dispatch] = useReducer(
    recReducer,
    __test_initialState ?? initialRecState({ taskId, taskName, isPractice }),
  );
```

en.json gains:

```json
"recording": { "practiceFallback": "Practice — 60 sec" }
```

From `apps/mobile/src/screens/recording/RecordingScreen.tsx` lines 1005-1012 — the G-15 actual bug site (07-16 fixed the wrong sibling):

```tsx
{
  state.substate === 'active' && brightnessState === 'dimmed' ? (
    <View style={styles.liveBottomCenter} pointerEvents="none">
      <Icon name="Eye" size={24} color={colors.accent} />
      <Text variant="caption" style={styles.liveEyeHint}>
        {' '}
        {/* (1008) — NO overflow guards */}
        {t('recording.preview.tapToReveal')}{' '}
        {/* hi-IN: "प्रीव्यू देखने के लिए स्क्रीन पर टैप करें" (40 chars) */}
      </Text>
    </View>
  ) : null;
}
```

After (G-15 fix — give the tap-to-reveal hint Text the overflow guards 07-16 missed):

```tsx
{
  state.substate === 'active' && brightnessState === 'dimmed' ? (
    <View style={styles.liveBottomCenter} pointerEvents="none">
      <Icon name="Eye" size={24} color={colors.accent} />
      <Text
        variant="caption"
        style={styles.liveEyeHint}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {t('recording.preview.tapToReveal')}
      </Text>
    </View>
  ) : null;
}
```

ALSO: the parent `liveBottomCenter` style (line ~1276) may need `maxWidth: '100%'` or `paddingHorizontal: spacing.xl` so the Text has horizontal room to wrap to 2 lines without colliding with the screen edges. Inspect at task execution time; only add if the wrap doesn't fit.

From `apps/mobile/src/ui/primitives/Button.tsx` lines 77-91 — the G-22 cross-cutting Cancel button truncation root cause:

```tsx
return (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled }}
    onPress={disabled ? undefined : onPress}
    style={[computed, style]}
  >
    <View>
      <Text variant="btnLabel" style={{ color: v.fg }}>
        {' '}
        {/* NO overflow guards */}
        {label}
      </Text>
    </View>
  </Pressable>
);
```

After (G-22 fix — overflow guards on the internal Text):

```tsx
return (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled }}
    onPress={disabled ? undefined : onPress}
    style={[computed, style]}
  >
    <View>
      <Text
        variant="btnLabel"
        style={{ color: v.fg }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </View>
  </Pressable>
);
```

**CROSS-CUTTING RISK NOTE:** every Button in the app inherits this change (~30+ call sites). The risk is that a multi-line Button label somewhere was depending on natural wrap. Mitigation: a Vitest regression test (Task 3) renders a list of long-label en + hi-IN Buttons and asserts the props propagate. The visual change is opt-in via `minimumFontScale={0.75}` — short labels stay at full font size.

From `apps/mobile/src/components/ReportProblemSheet.tsx` lines 117-124 — the G-22 chip text wrap:

```tsx
<Pressable
  key={c}
  onPress={() => setCategory(c)}
  testID={`category-${c}`}
  accessibilityLabel={label}
  style={selected ? styles.chipSelected : styles.chip}
>
  <Text variant="caption" style={selected ? styles.chipTextSelected : styles.chipText}>
    {label} {/* Hindi: "वीडियो की क्वालिटी में दिक्कत" (24 chars; clips at "में") */}
  </Text>
</Pressable>
```

After:

```tsx
<Pressable
  key={c}
  onPress={() => setCategory(c)}
  testID={`category-${c}`}
  accessibilityLabel={label}
  style={selected ? styles.chipSelected : styles.chip}
>
  <Text
    variant="caption"
    style={selected ? styles.chipTextSelected : styles.chipText}
    numberOfLines={2}
    adjustsFontSizeToFit
    minimumFontScale={0.85}
  >
    {label}
  </Text>
</Pressable>
```

From `apps/mobile/src/screens/tasks/SendRequestSheet.tsx` lines 334-354 — the G-24 Indoor/Outdoor segmented Text:

```tsx
<Pressable accessibilityLabel="send-request-setting-indoor" ... >
  <Text
    variant="pillLabel"
    style={setting === 'indoor' ? styles.segmentedLabelActive : styles.segmentedLabel}
  >
    {t('tasks.setting.indoor')}                                 {/* hi-IN: "घर के अंदर" (5 chars) — truncates to "घर के" */}
  </Text>
</Pressable>
<Pressable accessibilityLabel="send-request-setting-outdoor" ... >
  <Text
    variant="pillLabel"
    style={setting === 'outdoor' ? styles.segmentedLabelActive : styles.segmentedLabel}
  >
    {t('tasks.setting.outdoor')}                                {/* hi-IN: "घर के बाहर" (5 chars) — truncates to "घर के" */}
  </Text>
</Pressable>
```

After (both labels get the same 3 props):

```tsx
<Pressable accessibilityLabel="send-request-setting-indoor" ... >
  <Text
    variant="pillLabel"
    style={setting === 'indoor' ? styles.segmentedLabelActive : styles.segmentedLabel}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.75}
  >
    {t('tasks.setting.indoor')}
  </Text>
</Pressable>
<Pressable accessibilityLabel="send-request-setting-outdoor" ... >
  <Text
    variant="pillLabel"
    style={setting === 'outdoor' ? styles.segmentedLabelActive : styles.segmentedLabel}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.75}
  >
    {t('tasks.setting.outdoor')}
  </Text>
</Pressable>
```

From `apps/mobile/src/components/TaskCategoryPills.tsx` lines 86-99 + 119-134 — the G-17 fix:

```tsx
<Pressable
  key={value}
  accessibilityLabel={`pill-${value}`}
  ...
  style={active ? styles.pillActive : styles.pill}
>
  <Text variant="pillLabel" style={active ? styles.labelActive : styles.label}>
    {pillLabel(value, t)}
  </Text>
</Pressable>
```

After:

```tsx
<Pressable
  key={value}
  accessibilityLabel={`pill-${value}`}
  ...
  style={active ? styles.pillActive : styles.pill}
>
  <Text
    variant="pillLabel"
    style={active ? styles.labelActive : styles.label}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.75}
  >
    {pillLabel(value, t)}
  </Text>
</Pressable>
```

AND the `styles` const:

```typescript
// BEFORE
content: {
  paddingHorizontal: spacing.xl,
  gap: spacing.m,
  flexDirection: 'row',
},
pill: {
  paddingVertical: 9,
  paddingHorizontal: spacing.l,   // <-- reduce to spacing.m for ~10% slack on bold-active glyphs
  borderRadius: radii.pill,
  borderWidth: 1.5,
  borderColor: colors.line,
  backgroundColor: 'transparent',
},
pillActive: {
  paddingVertical: 9,
  paddingHorizontal: spacing.l,   // <-- reduce to spacing.m to match pill
  borderRadius: radii.pill,
  borderWidth: 1.5,
  borderColor: colors.text,
  backgroundColor: colors.text,
},

// AFTER
content: {
  paddingHorizontal: spacing.xl,
  paddingRight: spacing.xl + spacing.m,   // <-- extra safe-area right padding so the rightmost pill (e.g. बागवानी) doesn't clip
  gap: spacing.m,
  flexDirection: 'row',
},
pill: {
  paddingVertical: 9,
  paddingHorizontal: spacing.m,           // <-- reduced from spacing.l
  borderRadius: radii.pill,
  borderWidth: 1.5,
  borderColor: colors.line,
  backgroundColor: 'transparent',
},
pillActive: {
  paddingVertical: 9,
  paddingHorizontal: spacing.m,           // <-- reduced from spacing.l
  borderRadius: radii.pill,
  borderWidth: 1.5,
  borderColor: colors.text,
  backgroundColor: colors.text,
},
```

From `apps/mobile/src/screens/recording/RecordingScreen.tsx` lines 1093-1101 — the G-27 leading + scale fix:

```tsx
{
  /* G-27 (Plan 07-16): allow Devanagari + Bengali + Tamil + Telugu +
    Marathi to wrap to 2 lines + auto-shrink. RN-Text props only —
    the recGatePrompt variant is untouched. */
}
<Text
  variant="recGatePrompt"
  style={styles.gatePrompt}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.85}
>
  {t('recording.gatePrompt')}
</Text>;
```

After (G-27 fix — override lineHeight inline and lower scale floor):

```tsx
{
  /* G-27 (Plan 07-17): override variant lineHeight inline so 2-line wrap
    has compact leading (was 24/17 → 141% leading → visible vertical gap
    between lines); lower minimumFontScale to 0.75 to handle the longest
    Devanagari/Indic prompt forms. */
}
<Text
  variant="recGatePrompt"
  style={[styles.gatePrompt, { lineHeight: 20 }]}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.75}
>
  {t('recording.gatePrompt')}
</Text>;
```

`ui/tokens.ts:recGatePrompt` is UNTOUCHED (the variant is consumed by other call sites; the override is local to RecordingScreen).

From `apps/mobile/src/screens/recording/components/RotatePrompt.tsx` lines 115-123 + 128-131 — the G-26 scale + padding fix:

```tsx
// BEFORE
<Text
  variant="caption"
  style={styles.body}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.85}
>
  {t('recording.rotatePrompt')}
</Text>;

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.l },
  body: { color: colors.recTextCaption, textAlign: 'center' },
});

// AFTER
<Text
  variant="caption"
  style={styles.body}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.75}
>
  {t('recording.rotatePrompt')}
</Text>;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.l,
    paddingHorizontal: spacing.l,
  },
  body: { color: colors.recTextCaption, textAlign: 'center' },
});
```

(Two changes: lower `minimumFontScale` from 0.85 to 0.75; add `paddingHorizontal: spacing.l` to the wrap so the wrap has horizontal slack against the parent's `styles.body` flex.)

Locale walk order (LOCKED per memory `feedback_walk_locale_order`):
hi-IN → pt-BR → es → bn-IN → ta-IN → te-IN → mr-IN
(Devanagari fronts truncation/wrap escapes fastest; hi-IN is the canary.)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Investigate G-25 / G-29 / G-20 / G-22 / G-24 root causes; PAUSE if any contradicts the handoff</name>
  <files>.planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-16-TASK-8-HANDOFF.md (the canonical 07-17 scope per the orchestrator)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md `## Re-walk 2026-05-26` block (verdict matrix at lines 174-192)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-16-rewalk-evidence/2026-05-26-hi-IN/3.png (G-29 evidence)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-16-rewalk-evidence/2026-05-26-hi-IN/8.png (G-24 evidence)
    - apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx lines 46-50 (PRACTICE_ROUTE_PARAMS hardcodes English taskName — G-25 root cause)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 173-188 (taskName fallback chain — declared at line 178 BEFORE useTranslation at line 182)
    - apps/mobile/src/components/BottomNav.tsx lines 36-52 (the actual tab-label resolver — line 49 uses labelKey: 'tabs.history')
    - apps/mobile/src/navigation/MainTabs.tsx lines 35-50 (the navigator + tabBarLabel options — line 47 also t('tabs.history'))
    - apps/mobile/src/i18n/locales/hi-IN.json `tabs` block — confirm `tabs.history` is `"हिस्ट्री"` (Hindi for History; correct value) AND `LOCALE_NATIVE_NAMES['hi-IN']` is `"हिन्दी"` (Hindi the language; the operator's reported escape value)
    - apps/mobile/src/screens/history/HistoryScreen.tsx lines 540-605 (the G-20 firstTime/filtered empty-state JSX; line 599 hardcoded ` and try one.`)
    - apps/mobile/src/i18n/locales/hi-IN.json — full file; confirm `tasks.setting.indoor`/`tasks.setting.outdoor` ARE distinct values (`'घर के अंदर'` vs `'घर के बाहर'`) — G-24 is a TRUNCATION not a collision
    - apps/mobile/src/screens/tasks/SendRequestSheet.tsx lines 327-356 (the segmented styles use `flex: 1`; segmentedLabel + segmentedLabelActive have no width constraint)
    - apps/mobile/src/ui/primitives/Button.tsx lines 55-91 (the Button primitive's internal Text element — line 85; consumed by ReportProblemSheet footer + ~30 other call sites per `rg "import.*Button.*from.*primitives/Button" apps/mobile/src/`. FilterSheet Custom-range Cancel/Apply at lines 369-388 do NOT consume `<Button>` — they use raw `<Pressable>`+`<Text variant="btnLabel">`; the FilterSheet overflow guards land inline in Task 2 step 3, not via this primitive change.)
    - apps/mobile/src/i18n/locales/hi-IN.json `common.cancel` + `delete.cancel` keys — confirm value is `"रद्द करें"` (rad-da karen) — G-22 Cancel button truncation is at the Button primitive, NOT the i18n value
  </read_first>
  <action>
    Investigate FIVE root-cause questions in order. For each, write the finding into `.planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md` under the corresponding H2 section. If ANY finding contradicts the handoff's expected fix path, PAUSE and surface to the user before proceeding to Task 2.

    **1. G-29 (BottomNav History tab label showing `हिन्दी` instead of `हिस्ट्री`):**

    Run:
    ```bash
    grep -n "labelKey\|tabs\\.history\|nativeName" apps/mobile/src/components/BottomNav.tsx apps/mobile/src/navigation/MainTabs.tsx 2>/dev/null
    jq -r '.tabs.history' apps/mobile/src/i18n/locales/hi-IN.json
    jq -r '.tabs.history' apps/mobile/src/i18n/locales/pt-BR.json
    grep -rn "हिन्दी" apps/mobile/src/ 2>/dev/null
    ```

    Expected result: `jq` returns `"हिस्ट्री"` (correct); the only file containing `हिन्दी` is `apps/mobile/src/i18n/locale-meta.ts:42` (`LOCALE_NATIVE_NAMES['hi-IN'] = 'हिन्दी'`); BottomNav correctly routes through `t(tab.labelKey)` at line 131.

    **Decision matrix:**

    | hi-IN.json value | BottomNav grep | Disposition |
    |---|---|---|
    | `"हिस्ट्री"` | uses `t(tab.labelKey)` | G-29 is a TRANSCRIPTION ERROR by the operator. Task 8 confirms via fresh hi-IN walk. NO code change. |
    | `"हिन्दी"` (or other) | uses `t(tab.labelKey)` | hi-IN.json value bug — patch the value (direct JSON edit, NOT LLM regen). |
    | `"हिस्ट्री"` | uses `tab.nativeName` or `i18n.language` directly | the wire is wrong — fix the resolver. |

    Open the 3.png screenshot (`07-16-rewalk-evidence/2026-05-26-hi-IN/3.png`) and visually compare what it shows in the bottom tab bar to the operator's matrix entry. Document whether the screenshot CONFIRMS the bug or REFUTES it.

    **2. G-25 (RecordingScreen practice app-bar `Practice — 60 sec` in English on hi-IN):**

    Run:
    ```bash
    grep -n "PRACTICE_ROUTE_PARAMS\|taskName:" apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
    grep -n "params.taskName\|'Practice — 60 sec'\|practiceFallback" apps/mobile/src/screens/recording/RecordingScreen.tsx
    grep -n "recording.practiceFallback" apps/mobile/src/i18n/locales/en.json
    ```

    Expected result: PracticeIntroScreen.tsx:46-50 hardcodes `taskName: 'Practice — 60 sec'`; RecordingScreen.tsx:178 falls back to `'Practice — 60 sec'` (also English); the key `recording.practiceFallback` does NOT exist in en.json.

    Record the chain: `PRACTICE_ROUTE_PARAMS.taskName` flows through `navigation.replace('Recording', PRACTICE_ROUTE_PARAMS)` to `route.params.taskName` to `state.taskName` to the render at line 1033. The fix needs BOTH a route-params change AND the fallback rewrite.

    **3. G-29 + G-25 unified test:** verify that the screenshot evidence at `3.png` shows BOTH (a) History tab label correctly `हिस्ट्री` (G-29 transcription error) AND (b) the empty-state body trailing English literal `and try one.` (G-20). If the screenshot DOESN'T show one of these, surface the divergence — the verdict matrix may have other transcription issues.

    **4. G-20 (history.empty.firstTime trailing literal):**

    Run:
    ```bash
    grep -n "and try one\|history.empty.firstTime\|history.empty.filtered" apps/mobile/src/screens/history/HistoryScreen.tsx
    jq -r '.history.empty.firstTime, .history.empty.filtered' apps/mobile/src/i18n/locales/en.json
    ```

    Expected result: HistoryScreen.tsx:599 contains the literal ` and try one.` outside any `t()` call. The en.json `firstTime.cta` is `"Pick a task"` (the link text only); the `filtered.cta` is `"Show all time"` followed by a JSX literal `.` (period).

    Decision: add a NEW key `history.empty.firstTime.bodyTail` (value `" and try one."` including the leading space). The `filtered` branch's trailing `.` is a single punctuation character — investigate if any locale uses a different sentence-ender (हिंदी uses `।` "danda"). If yes, also add `history.empty.filtered.bodyTail`. If no, leave as-is.

    **5. G-22 (Cancel button `रद्द करें` truncating to `रद`):**

    Run:
    ```bash
    grep -n "<Button\|variant=\"btnLabel\"" apps/mobile/src/ui/primitives/Button.tsx
    jq -r '.common.cancel, .delete.cancel' apps/mobile/src/i18n/locales/hi-IN.json
    grep -rn "<Button" apps/mobile/src/components/ReportProblemSheet.tsx apps/mobile/src/screens/shared/FilterSheet.tsx | head -10
    ```

    Expected result: hi-IN.json values are CORRECTLY spelled `"रद्द करें"` (with the `्द` ligature); the Button primitive's internal Text at line 85 has NO `numberOfLines` / `adjustsFontSizeToFit` / `minimumFontScale`; ReportProblemSheet's Cancel button uses the shared `<Button>` primitive; FilterSheet Custom-range Cancel/Apply at lines 369-388 use raw `<Pressable>` + `<Text variant="btnLabel">` (NOT the Button primitive — verified via `grep -c "<Button" FilterSheet.tsx` returning 0). The truncation is a layout bug at TWO sites: (a) the shared Button primitive (Task 3 fix — propagates to ReportProblem + ~30 other consumers); (b) the raw FilterSheet Cancel/Apply Text elements (Task 2 G-21 inline fix — does NOT inherit from the Button primitive). NOT a value bug.

    **6. G-24 (Indoor/Outdoor both showing `घर के` — truncation OR collision):**

    Run:
    ```bash
    jq -r '.tasks.setting.indoor, .tasks.setting.outdoor' apps/mobile/src/i18n/locales/hi-IN.json
    grep -n "segmented\|tasks.setting" apps/mobile/src/screens/tasks/SendRequestSheet.tsx | head -10
    grep -A2 "segmented_:\|segmentedActive:\|segmentedLabel" apps/mobile/src/screens/tasks/SendRequestSheet.tsx | head -25
    ```

    Expected result: hi-IN.json values are DISTINCT (`"घर के अंदर"` vs `"घर के बाहर"` — confirmed by planner-time grep); the segmented pills use `flex: 1` (no fixed width); the Text inside has no overflow guards. G-24 is a TRUNCATION not a collision.

    Open the 8.png screenshot and confirm the operator's matrix entry by visually inspecting the segmented toggle.

    **7. Write `.planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md` with this structure:**

    ```markdown
    # G-25 / G-29 / G-20 / G-22 / G-24 Root-Cause Investigation (Plan 07-17 Task 1)

    **Date:** 2026-05-XX (Task 1 execution date)
    **Investigator:** {executor agent}

    ## TL;DR
    {N findings; M of them confirmed matching the handoff's expected fix paths; (N-M) divergences listed below — proceed/PAUSE decision}

    ## G-29 (BottomNav History tab label)
    {jq value of tabs.history; grep result of BottomNav.tsx label resolver; screenshot 3.png observation; verdict: TRANSCRIPTION ERROR / VALUE BUG / WIRE BUG}

    ## G-25 (RecordingScreen Practice — 60 sec fallback)
    {PRACTICE_ROUTE_PARAMS contents; RecordingScreen.tsx:178 fallback string; en.json absence of recording.practiceFallback; chain trace; fix: 3-part (PracticeIntro + RecordingScreen + en.json key)}

    ## G-20 (history.empty firstTime trailing literal)
    {HistoryScreen.tsx:599 literal; en.json firstTime.cta value; decision on bodyTail vs cta extension; filtered branch verdict}

    ## G-22 (Cancel button truncation root cause)
    {hi-IN.json common.cancel + delete.cancel values — confirmed correct; Button primitive internal Text props — confirmed no overflow guards; consumer trace: ReportProblemSheet consumes the `<Button>` primitive (Task 3 fix applies). FilterSheet Custom-range Cancel/Apply at lines 369-388 use raw `<Pressable>` + `<Text variant="btnLabel">` — NOT the Button primitive (grep -c "<Button" FilterSheet.tsx = 0). Task 2 G-21 step 3 adds inline overflow guards to those two raw Text elements.}

    ## G-24 (Indoor/Outdoor truncation vs collision)
    {hi-IN.json setting.indoor + setting.outdoor values — confirmed DISTINCT; segmented Pressable styles — confirmed flex:1 no overflow guards; verdict: TRUNCATION not collision}

    ## Proceed / PAUSE decision
    {For each finding: did it match the handoff's expected fix path? If all 5 matched, proceed to Tasks 2-7. If any diverged, PAUSE and surface to user.}

    ## Out-of-scope finds
    {Any additional gaps surfaced during the investigation that the handoff didn't list — surface to user but do NOT add to 07-17 scope without explicit owner approval.}
    ```

    8. **If any finding contradicts the handoff** (e.g. G-29 hi-IN.json value IS actually `"हिन्दी"`; G-22 hi-IN cancel value is mis-spelled; etc.): PAUSE and surface to the user with the alternate fix path before proceeding to Task 2.

    9. **Invariant pre-check:**
    ```bash
    git diff --stat apps/api/                                                       # empty (D-16)
    git diff --stat apps/mobile/ios/                                                # empty (I18N-21)
    git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts                        # empty (07-16 EOF append untouched)
    git diff --stat apps/mobile/src/lib/ttsVoice.ts                                 # empty (TTS deviation)
    git diff --stat apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx          # empty (RigTutorial deviation)
    git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md  # empty (Phase 6 cosmetics)
    ```
    All 6 must return empty before Task 2 begins. If any is non-empty at this point (worktree may have already drifted), surface to user.

  </action>
  <verify>
    <automated>test -f .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md && grep -cE "## TL;DR|## G-29|## G-25|## G-20|## G-22|## G-24|## Proceed / PAUSE" .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md</automated>
  </verify>
  <acceptance_criteria>
    - `07-17-INVESTIGATION.md` exists with the 7 required H2 sections + TL;DR.
    - Each of the 5 gap investigations records: (a) the grep/jq probe commands run; (b) the actual probe output; (c) the verdict (root cause confirmed / divergence found).
    - The G-29 section explicitly addresses the transcription-error hypothesis — either confirms or refutes it based on the screenshot + the file evidence.
    - The TL;DR sums up: N findings, M confirmed matching the handoff, (N-M) divergences; explicit proceed-or-PAUSE recommendation.
    - All 6 invariant pre-check git-diffs return empty.
    - `grep -c "^- \*\*Cancel\\|^- \*\*Indoor\\|^- \*\*Outdoor" .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md` returns at least 1 (the investigation references concrete strings the operator's screenshots showed).
  </acceptance_criteria>
  <done>Root causes confirmed (or PAUSE'd with surfaced divergence). Tasks 2-5 have a concrete fix-path-each to execute against. If any finding diverged, Task 2 is BLOCKED and the user decides the routing.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire G-20 (History empty bodyTail) + G-21 (FilterSheet Custom-range sub-sheet — 9 new keys)</name>
  <files>apps/mobile/src/i18n/locales/en.json, apps/mobile/src/screens/history/HistoryScreen.tsx, apps/mobile/src/screens/shared/FilterSheet.tsx, apps/mobile/__tests__/screens/history/HistoryScreen.emptyTail.i18n.test.tsx, apps/mobile/__tests__/screens/shared/FilterSheet.customRange.i18n.test.tsx</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md (Task 1 output — the recorded G-20 + G-21 fix paths)
    - apps/mobile/src/i18n/locales/en.json — locate the existing `history.filter` block (post-07-16 it has 6 chevron-stripped values: today/yesterday/thisWeek/thisMonth/allTime/customRange). Verify whether `customRange` is currently a string value or already an object.
    - apps/mobile/src/screens/history/HistoryScreen.tsx lines 540-605 (G-20 site)
    - apps/mobile/src/screens/shared/FilterSheet.tsx lines 280-388 (G-21 site — full Custom-range sub-sheet component)
    - apps/mobile/__tests__/screens/shared/FilterSheet.i18n.test.tsx (the 07-16 base-sheet test; mirror its pattern for the customRange test)
    - apps/mobile/__tests__/screens/history/HistoryScreen.empty.i18n.test.tsx (the 07-16 empty-state test; extend it OR mirror its pattern for the bodyTail test)
  </read_first>
  <behavior>
    - **G-20 (HistoryScreen empty bodyTail):**
      1. Extend en.json `history.empty.firstTime` with new key `bodyTail` value `" and try one."` (leading space included).
      2. Modify HistoryScreen.tsx:599 — replace JSX literal ` and try one.` with `{t('history.empty.firstTime.bodyTail')}`.
      3. Per Task 1 finding: if the `filtered` branch's trailing period also needs translation, add `history.empty.filtered.bodyTail` (value `"."`). Otherwise leave as-is.

    - **G-21 (FilterSheet Custom-range sub-sheet — 9 new keys):**
      1. Schema-breaking rename (per the <interfaces> SHAPE-PARITY NOTE) — execute it; do NOT pause. Plan-checker verified 3 consumer sites and pre-decided the strategy:
         - **Consumer 1 — FilterSheet.tsx:65:** `{ value: 'custom-pick', labelKey: 'history.filter.customRange' }` (the base-sheet OPTIONS array chip label). Update to `labelKey: 'history.filter.customRangeChip'`.
         - **Consumer 2 — HistoryScreen.tsx:142:** `if (custom == null) return t('history.filter.customRange');` (the time-range chip fallback when Custom is selected but no dates picked). Update to `t('history.filter.customRangeChip')`.
         - **Consumer 3 — HistoryScreen.tsx:146:** `return t('history.filter.customRange');` (same chip fallback, second branch). Update to `t('history.filter.customRangeChip')`.
         - **Test consumers** (skip — they read from the mocked `t`): `apps/mobile/__tests__/screens/history/HistoryScreen.tsx`-related test files that reference the old key string remain valid because they mock `t` and assert on call args — update any literal-key assertions if the test references `'history.filter.customRange'` as a STRING outside a `t()` call; otherwise leave.
         - en.json: rename the existing string-valued key from `"customRange": "custom range"` → `"customRangeChip": "custom range"` in the `history.filter` block. Then add the new OBJECT-valued `"customRange": { ... }` per step 2 below.
         - All 3 source rename + the en.json rename land in the SAME commit alongside the new object addition (atomic schema change).
         - If grep reveals consumers BEYOND these 3 + test files (e.g. a stray `t('history.filter.customRange')` somewhere else in the tree), PAUSE then — but the planner verification confirmed there are no others.
      2. Extend en.json `history.filter` with a new OBJECT-valued `customRange` carrying 9 sub-keys:
         ```json
         "customRange": {
           "title": "Custom range",
           "from": "FROM",
           "to": "TO",
           "placeholder": "Pick a date",
           "errorMissing": "Pick both dates.",
           "errorInverted": "\"From\" date must be before \"To\" date.",
           "errorFuture": "Dates can't be in the future.",
           "cancel": "Cancel",
           "apply": "Apply"
         }
         ```
      3. Modify FilterSheet.tsx lines 280-388:
         - Add `const { t } = useTranslation()` at the top of `Layer16b` function (line 280 area) — verify if useTranslation is already imported at module top (it should be — used by the base sheet).
         - Replace 9 hardcoded English strings (294 / 295 / 296 / 301 / 305 / 317 / 334 / 346 / 375 / 385) with their `t('history.filter.customRange.*')` equivalents per the <interfaces> mapping.
         - **CRITICAL — G-22 Cancel/Apply overflow guards (plan-checker BLOCKER 3 fix):** The Custom-range footer Cancel + Apply at FilterSheet.tsx:369-388 use raw `<Pressable>` + `<Text variant="btnLabel">` — NOT the shared `<Button>` primitive that Task 3 guards. Verified via `grep -n "<Button" apps/mobile/src/screens/shared/FilterSheet.tsx` returning 0 matches. The Task 3 Button primitive change does NOT propagate here. Add overflow guards to BOTH raw Text elements:
           ```tsx
           <Text
             variant="btnLabel"
             style={styles.btnOutlineLabel}
             numberOfLines={1}
             adjustsFontSizeToFit
             minimumFontScale={0.75}
           >
             {t('history.filter.customRange.cancel')}
           </Text>
           ```
           ```tsx
           <Text
             variant="btnLabel"
             style={styles.btnPrimaryLabel}
             numberOfLines={1}
             adjustsFontSizeToFit
             minimumFontScale={0.75}
           >
             {t('history.filter.customRange.apply')}
           </Text>
           ```
         - These guards match the Task 3 Button primitive guards (`numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}`) so the hi-IN `रद्द करें` / `अप्लाई` render identically across ReportProblem (via Button primitive) and FilterSheet Custom-range (via raw Pressable).

    - **Tests:**
      - `HistoryScreen.emptyTail.i18n.test.tsx`: render `HistoryScreen` with `recordings: []` + `historyRange: 'all'` + mock `useTranslation` to assert `t` is called with `'history.empty.firstTime.bodyTail'` AND the rendered output includes a Text component whose text is the mocked t-return value (preserves the linkable structure where the CTA is a Pressable Text inside the body).
      - `FilterSheet.customRange.i18n.test.tsx`: open the Custom-range sub-sheet (e.g. by setting `selectedNamedRange='custom-pick'` in the FilterSheet's state OR by mounting the sub-component directly if it's exported) and assert all 9 t() calls are made with the expected keys. Also assert the OPTIONS array entry for `'custom-pick'` reads `t('history.filter.customRangeChip')` (post-rename).

  </behavior>
  <action>
    1. **Read Task 1's investigation.** If the proceed-or-PAUSE recommendation is PAUSE, do NOT proceed — surface to user.

    2. **RED phase: write the 2 test files FIRST.** Mirror the 07-16 test infra patterns. Run `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -20`. Confirm the new tests FAIL (the keys don't exist; the wires aren't in place).

    3. **GREEN phase G-20:**
       - Extend en.json `history.empty.firstTime` with `bodyTail`.
       - Modify HistoryScreen.tsx:599 to use `{t('history.empty.firstTime.bodyTail')}`.
       - Re-run the test; confirm `emptyTail` test PASSES.

    4. **GREEN phase G-21:**
       - Grep for any `t('history.filter.customRange')` consumers; if only the OPTIONS array entry exists, rename the existing string key from `customRange` to `customRangeChip` in en.json AND update FilterSheet.tsx:65.
       - Add the new 9-key `customRange` OBJECT to en.json under `history.filter`.
       - Modify FilterSheet.tsx lines 280-388 to wire the 9 t() calls.
       - Re-run the test; confirm `customRange` test PASSES.

    5. **Run the full mobile test suite** per memory:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -30
       ```
       Confirm exit 0. If the suite fails on a pre-existing test unrelated to this task's changes, log per memory `feedback_post_merge_test_env`.

    6. **Run typecheck:**
       ```bash
       cd apps/mobile && npx tsc --noEmit 2>&1 | tail -15
       ```
       Exit 0.

    7. **Invariant gates:**
       ```bash
       git diff --stat apps/api/                                                       # empty (D-16)
       git diff --stat apps/mobile/ios/                                                # empty (I18N-21)
       git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts                        # empty
       git diff --stat apps/mobile/src/lib/ttsVoice.ts                                 # empty
       git diff --stat apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx          # empty
       git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md  # empty
       ```
       All 6 must return empty.

    8. **DO NOT run `pnpm i18n:validate` yet** — between Task 2 and Task 5 the non-en catalogs lack the new keys, so shape parity will FAIL during this intermediate window. The validate runs in Task 5 after LLM regen restores parity (per 07-16's N-NEW-2 lesson).

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `jq '.history.empty.firstTime.bodyTail' apps/mobile/src/i18n/locales/en.json` returns `" and try one."` (with leading space).
    - `jq '.history.filter.customRange.title, .history.filter.customRange.from, .history.filter.customRange.to, .history.filter.customRange.placeholder, .history.filter.customRange.errorMissing, .history.filter.customRange.errorInverted, .history.filter.customRange.errorFuture, .history.filter.customRange.cancel, .history.filter.customRange.apply' apps/mobile/src/i18n/locales/en.json` all 9 non-null.
    - `jq '.history.filter.customRangeChip' apps/mobile/src/i18n/locales/en.json` returns the post-rename string value (e.g. `"custom range"`) — confirms the chip-key rename if Task 1 chose that path.
    - `grep -c "and try one\\." apps/mobile/src/screens/history/HistoryScreen.tsx` returns 0 (literal removed).
    - `grep -c "t('history.empty.firstTime.bodyTail')" apps/mobile/src/screens/history/HistoryScreen.tsx` returns at least 1.
    - `grep -cE "'Custom range'|'Pick a date'|'FROM'|'TO'|'Pick both dates\\.'|'Apply'" apps/mobile/src/screens/shared/FilterSheet.tsx` returns 0 (all 9 literals removed).
    - `grep -c "t('history.filter.customRange\\." apps/mobile/src/screens/shared/FilterSheet.tsx` returns at least 9 (or via the existing destructured `t` — count is acceptable as ≥ 9 substring matches).
    - The 2 new test files exist and PASS.
    - JS test suite exit 0.
    - `npx tsc --noEmit` clean.
    - All 6 invariant gates empty.
  </acceptance_criteria>
  <done>G-20 + G-21 closed at code level. The Custom-range sub-sheet is fully wired through `t()`; the History empty-state's trailing English literal is closed. Task 5 regens the 7 non-en locales for the 10 new keys.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: G-25 practice fallback wire + G-22 Button primitive overflow guards (cross-cutting)</name>
  <files>apps/mobile/src/i18n/locales/en.json, apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx, apps/mobile/src/screens/recording/RecordingScreen.tsx, apps/mobile/src/ui/primitives/Button.tsx, apps/mobile/__tests__/screens/recording/RecordingScreen.practiceFallback.i18n.test.tsx, apps/mobile/__tests__/ui/Button.numberOfLines.test.tsx</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md (Task 1 G-25 + G-22 root-cause findings)
    - apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx lines 40-80 (PRACTICE_ROUTE_PARAMS + handleStart)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 173-188 (taskName resolution chain — confirm the order: route.params → useTranslation → state init)
    - apps/mobile/src/ui/primitives/Button.tsx full file (~93 LOC — the Button component + variants)
    - apps/mobile/__tests__/screens/tasks/SendRequestSheet.i18n.test.tsx (07-16 test infra pattern to mirror for practiceFallback)
    - grep all Button consumers to enumerate cross-cutting risk:
      ```bash
      grep -rn "^import.*Button\\b\\|from .*Button'\\|<Button " apps/mobile/src/ 2>/dev/null | head -30
      ```
  </read_first>
  <behavior>
    - **G-25 (practice fallback — 3-part fix):**
      1. **en.json:** add `recording.practiceFallback` = `"Practice — 60 sec"` under the existing `recording` namespace.
      2. **PracticeIntroScreen.tsx:46-50:** drop `taskName` from `PRACTICE_ROUTE_PARAMS`. Update the `as const` block to:
         ```typescript
         const PRACTICE_ROUTE_PARAMS = {
           taskId: '__practice__',
           isPractice: true,
         } as const;
         ```
         Add a brief comment above explaining the removal: `// G-25 (Plan 07-17): taskName intentionally omitted — RecordingScreen.tsx:178 falls back to t('recording.practiceFallback') so the locale switch in Profile re-renders the app-bar.`
      3. **RecordingScreen.tsx:173-188:** reorder the destructure so `useTranslation()` is called BEFORE the `taskName` fallback. The final block:
         ```typescript
         export default function RecordingScreen({ __test_initialState }: RecordingScreenProps = {}) {
           const navigation = useNavigation<NavigationLike>();
           const route = useRoute<{ key: string; name: string; params?: RecordingRouteParams }>();
           const params = route.params ?? {};
           const taskId = params.taskId ?? '__practice__';
           const taskCategory = params.taskCategory ?? 'practice';
           const taskSetting: 'indoor' | 'outdoor' = params.taskSetting ?? 'indoor';
           const isPractice = params.isPractice ?? false;
           const { t, i18n } = useTranslation();
           // G-25 (Plan 07-17): locale-reactive fallback. Was hardcoded
           // English; moved INSIDE the component so t() is in scope.
           const taskName = params.taskName ?? t('recording.practiceFallback');
           ...
         ```

    - **G-22 (Button primitive — 1-file cross-cutting):**
      1. **Button.tsx:85** — wrap the internal Text element with overflow guards:
         ```tsx
         <Text
           variant="btnLabel"
           style={{ color: v.fg }}
           numberOfLines={1}
           adjustsFontSizeToFit
           minimumFontScale={0.75}
         >
           {label}
         </Text>
         ```

    - **Tests:**
      - `RecordingScreen.practiceFallback.i18n.test.tsx`: render `RecordingScreen` with `route.params = {}` (practice flow scenario) + mocked `useTranslation` returning `{ t: (k) => k }` and `i18n.language = 'hi-IN'`. Assert `state.taskName` (or the rendered task-name Text content) is `'recording.practiceFallback'` (the mocked t-return value, NOT the English literal). Second variation: assert `state.taskName === 'Practice — 60 sec'` when `useTranslation` returns the en value.
      - `Button.numberOfLines.test.tsx`: render `<Button label="रद्द करें रद्द करें" variant="primary" onPress={() => {}} />` (a deliberately long Devanagari label) and use the existing jsdom RN shim to assert the internal Text element receives `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.75}` as props.

  </behavior>
  <action>
    1. **RED phase: write the 2 test files FIRST.** Mirror the 07-16 test infra patterns (specifically `RecordingScreen.practiceFallback` mirrors `SendRequestSheet.i18n.test.tsx`; `Button.numberOfLines` mirrors `LanguageSheet.test.tsx`). Run the suite; confirm both new tests FAIL.

    2. **GREEN phase G-25 (3 file edits):**
       - en.json: add `recording.practiceFallback`.
       - PracticeIntroScreen.tsx:46-50: drop the hardcoded taskName.
       - RecordingScreen.tsx:173-188: reorder + rewire the fallback.

    3. **GREEN phase G-22:**
       - Button.tsx:85: add the 3 props.

    4. **Re-run the suite:** confirm both new tests PASS + no existing test regresses. Pay special attention to existing Button-consuming tests — if any was asserting a specific text-wrap behavior, surface the regression and surface it to user.

    5. **Cross-cutting risk audit:**
       ```bash
       grep -rn "^import.*Button\\b\\|<Button " apps/mobile/__tests__/ 2>/dev/null | wc -l
       ```
       Count the test files that import or render Button. Document the count + confirm the test suite still passes (rough sanity check that no behavior regresses).

    6. **Typecheck:**
       ```bash
       cd apps/mobile && npx tsc --noEmit 2>&1 | tail -10
       ```
       Exit 0.

    7. **Invariant gates (same 6 as Task 2 + apps/mobile/android):**
       ```bash
       git diff --stat apps/api/ apps/mobile/ios/ apps/mobile/android/ apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/lib/ttsVoice.ts apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
       git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
       ```
       All 7 must return empty.

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `jq '.recording.practiceFallback' apps/mobile/src/i18n/locales/en.json` returns `"Practice — 60 sec"`.
    - `grep -c "taskName: 'Practice — 60 sec'" apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx` returns 0 (hardcoded literal removed).
    - `grep -c "taskName: '__practice__'\\|taskName:" apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx` — verify the taskName key was removed from the const, not just the value (count of `taskName:` should be 0 inside PRACTICE_ROUTE_PARAMS).
    - `grep -c "params.taskName ?? 'Practice — 60 sec'" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns 0 (literal fallback removed).
    - `grep -c "params.taskName ?? t('recording.practiceFallback')" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1.
    - The line declaring `const { t, i18n } = useTranslation()` in RecordingScreen.tsx comes BEFORE the line declaring `const taskName = ...` (verify by extracting the line numbers via grep).
    - `grep -c "numberOfLines={1}\\|numberOfLines=\\{1\\}" apps/mobile/src/ui/primitives/Button.tsx` returns at least 1.
    - `grep -c "adjustsFontSizeToFit" apps/mobile/src/ui/primitives/Button.tsx` returns at least 1.
    - `grep -c "minimumFontScale={0.75}" apps/mobile/src/ui/primitives/Button.tsx` returns at least 1.
    - JS test suite exit 0; both new test files PASS.
    - `npx tsc --noEmit` clean.
    - All 7 invariant gates empty.
  </acceptance_criteria>
  <done>G-25 + G-22 closed at code level. Practice flow's app-bar will render in the active locale. Every Button across the app (Cancel buttons in ReportProblem + FilterSheet Custom-range and ~30 other consumers) inherits the overflow guards.</done>
</task>

<task type="auto">
  <name>Task 4: Bucket B layout fixes — G-15 liveEyeHint + G-17 TaskCategoryPills + G-22 chip text + G-24 segmented + G-26 RotatePrompt scale + G-27 gatePrompt leading</name>
  <files>apps/mobile/src/screens/recording/RecordingScreen.tsx, apps/mobile/src/components/TaskCategoryPills.tsx, apps/mobile/src/components/ReportProblemSheet.tsx, apps/mobile/src/screens/tasks/SendRequestSheet.tsx, apps/mobile/src/screens/recording/components/RotatePrompt.tsx</files>
  <read_first>
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 1005-1012 (G-15 liveEyeHint actual site) + lines 1093-1101 (G-27 gatePrompt) + lines 1276-1306 (StyleSheet — `liveBottomCenter`, `liveLabelPill`, `liveLabelText`, `liveEyeHint`)
    - apps/mobile/src/components/TaskCategoryPills.tsx full file (~155 LOC — pill + pillActive styles, render at line 94)
    - apps/mobile/src/components/ReportProblemSheet.tsx lines 105-128 (chip render + style)
    - apps/mobile/src/screens/tasks/SendRequestSheet.tsx lines 327-356 (Indoor/Outdoor segmented Pressables)
    - apps/mobile/src/screens/recording/components/RotatePrompt.tsx full file (~133 LOC — Text at line 115; wrap + body styles at 128-131)
    - apps/mobile/src/ui/tokens.ts lines 208-216 (recGatePrompt variant — VERIFY but DO NOT MODIFY: `lineHeight: 24` on `fontSize: 17`)
  </read_first>
  <behavior>
    Apply 6 distinct layout/style edits across 5 files. Each is a self-contained inline-props or stylesheet change.

    - **G-15 — RecordingScreen.tsx liveEyeHint (lines 1005-1012):**
      Add `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` to the `<Text variant="caption" style={styles.liveEyeHint}>` element. Inspect the parent `liveBottomCenter` (line ~1276) — if `maxWidth` / `paddingHorizontal` is missing AND the Text has no room to wrap on a Pixel-class screen, add `paddingHorizontal: spacing.xl` to `liveBottomCenter` style. Otherwise leave the parent untouched. (07-16's `liveLabelText` `textAlign: 'center'` at line 1306 stays UNTOUCHED — different element, distinct fix.)

    - **G-17 — TaskCategoryPills.tsx:**
      1. Pill Text (line 94): add `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}`.
      2. `styles.pill` + `styles.pillActive`: reduce `paddingHorizontal: spacing.l` → `spacing.m` (~10% horizontal slack).
      3. `styles.content`: add `paddingRight: spacing.xl + spacing.m` (or equivalent — extra right padding so the rightmost pill doesn't clip at the screen edge per operator's 7.png evidence).

    - **G-22 — ReportProblemSheet.tsx (chip Text — lines 119-124):**
      Add `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` to the `<Text variant="caption" style={...}>` inside each chip Pressable. (Two-line wrap fits Devanagari `वीडियो की क्वालिटी में दिक्कत`.)

    - **G-24 — SendRequestSheet.tsx Indoor/Outdoor segmented (lines 334-354):**
      Add `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}` to BOTH segmented Text elements (the indoor + outdoor labels).

    - **G-26 — RotatePrompt.tsx (lines 115-123 + 128-131):**
      1. Lower `minimumFontScale` on the body Text from `0.85` to `0.75`.
      2. Add `paddingHorizontal: spacing.l` to `styles.wrap` (so the wrap has horizontal slack against the parent's flex constraints).

    - **G-27 — RecordingScreen.tsx gatePrompt (lines 1093-1101):**
      1. Change `style={styles.gatePrompt}` → `style={[styles.gatePrompt, { lineHeight: 20 }]}` (inline lineHeight override — `recGatePrompt` variant's `lineHeight: 24` produces visible vertical gap when wrapping; 20 = ~118% leading).
      2. Lower `minimumFontScale` from `0.85` to `0.75`.
      3. Add a brief comment above the Text explaining the override: `// G-27 (Plan 07-17): override variant lineHeight inline; do NOT modify ui/tokens.ts:recGatePrompt (consumed by other call sites).`

    No new design tokens. `ui/tokens.ts:recGatePrompt` MUST stay UNCHANGED.

    No new tests for raw layout — these are visual-only changes. Each touched line gets a comment block `// G-XX (Plan 07-17): {description}` for grep discoverability.

  </behavior>
  <action>
    1. Apply 6 edits per the behavior block. Execute in this order to minimize merge churn:
       1. G-26 (RotatePrompt.tsx — 2 changes in 1 file)
       2. G-15 (RecordingScreen.tsx liveEyeHint — 1 element + parent maybe)
       3. G-27 (RecordingScreen.tsx gatePrompt — 1 element)
       4. G-17 (TaskCategoryPills.tsx — 1 Text + 2 styles)
       5. G-22 (ReportProblemSheet.tsx — 1 Text)
       6. G-24 (SendRequestSheet.tsx — 2 Text elements)

    2. **Run the JS test suite** to confirm no regression:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
       ```
       Exit 0.

    3. **Typecheck:**
       ```bash
       cd apps/mobile && npx tsc --noEmit 2>&1 | tail -10
       ```
       Exit 0.

    4. **Invariant gates (the same 7 + `ui/tokens.ts` MUST stay empty per behavior):**
       ```bash
       git diff --stat apps/api/ apps/mobile/ios/ apps/mobile/android/ apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/lib/ttsVoice.ts apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx apps/mobile/src/ui/tokens.ts
       git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
       ```
       All 8 must return empty.

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "liveEyeHint" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 2 (style ref + the style definition).
    - The `<Text>` element using `style={styles.liveEyeHint}` in RecordingScreen.tsx now includes `numberOfLines={2}` + `adjustsFontSizeToFit` + `minimumFontScale={0.85}` props — verify via:
      ```bash
      awk '/style=\\{styles.liveEyeHint\\}/,/<\\/Text>/' apps/mobile/src/screens/recording/RecordingScreen.tsx | head -10
      ```
      should show all 3 new props.
    - `grep -c "lineHeight: 20" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1 (G-27 inline override).
    - `grep -c "minimumFontScale={0.75}" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1 (G-27 scale floor).
    - `grep -c "numberOfLines={1}" apps/mobile/src/components/TaskCategoryPills.tsx` returns at least 1.
    - `grep -c "adjustsFontSizeToFit" apps/mobile/src/components/TaskCategoryPills.tsx` returns at least 1.
    - `grep -c "paddingHorizontal: spacing.m" apps/mobile/src/components/TaskCategoryPills.tsx` returns at least 2 (pill + pillActive both reduced).
    - `grep -c "paddingRight: spacing\\." apps/mobile/src/components/TaskCategoryPills.tsx` returns at least 1 (content style gets paddingRight).
    - `grep -c "numberOfLines={2}" apps/mobile/src/components/ReportProblemSheet.tsx` returns at least 1.
    - `grep -c "numberOfLines={1}" apps/mobile/src/screens/tasks/SendRequestSheet.tsx` returns at least 2 (both indoor + outdoor pill labels).
    - `grep -c "minimumFontScale={0.75}" apps/mobile/src/screens/tasks/SendRequestSheet.tsx` returns at least 2 (matching pair).
    - `grep -c "minimumFontScale={0.75}" apps/mobile/src/screens/recording/components/RotatePrompt.tsx` returns at least 1 (was 0.85 per 07-16, now 0.75).
    - `grep -c "minimumFontScale={0.85}" apps/mobile/src/screens/recording/components/RotatePrompt.tsx` returns 0 (the old value is replaced, not added alongside).
    - `grep -c "paddingHorizontal: spacing.l\\|paddingHorizontal:.*spacing.l" apps/mobile/src/screens/recording/components/RotatePrompt.tsx` returns at least 1 (wrap gets the new horizontal slack).
    - `grep -v '^#' apps/mobile/src/screens/recording/RecordingScreen.tsx apps/mobile/src/components/TaskCategoryPills.tsx apps/mobile/src/components/ReportProblemSheet.tsx apps/mobile/src/screens/tasks/SendRequestSheet.tsx apps/mobile/src/screens/recording/components/RotatePrompt.tsx | grep -cE "// G-1[5-9]|// G-2[0-9]" | head -1` returns at least 6 (one comment per gap touched).
    - JS test suite exit 0.
    - `npx tsc --noEmit` clean.
    - All 8 invariant gates empty (especially `apps/mobile/src/ui/tokens.ts` — `recGatePrompt` variant untouched).
  </acceptance_criteria>
  <done>G-15 + G-17 + G-22 (chip text) + G-24 (segmented) + G-26 + G-27 closed at code level via 6 inline overflow-guard / leading / padding edits. No design-token modifications. Operator confirms visually in Task 8.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Indoor/Outdoor collision regression test + LLM regen 7 non-en catalogs + hi-IN G-27 prose surgical patch</name>
  <files>apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts, apps/mobile/src/i18n/locales/pt-BR.json, apps/mobile/src/i18n/locales/es.json, apps/mobile/src/i18n/locales/hi-IN.json, apps/mobile/src/i18n/locales/bn-IN.json, apps/mobile/src/i18n/locales/ta-IN.json, apps/mobile/src/i18n/locales/te-IN.json, apps/mobile/src/i18n/locales/mr-IN.json, apps/mobile/src/i18n/locales/pt-BR.audit.json, apps/mobile/src/i18n/locales/es.audit.json, apps/mobile/src/i18n/locales/hi-IN.audit.json, apps/mobile/src/i18n/locales/bn-IN.audit.json, apps/mobile/src/i18n/locales/ta-IN.audit.json, apps/mobile/src/i18n/locales/te-IN.audit.json, apps/mobile/src/i18n/locales/mr-IN.audit.json</files>
  <read_first>
    - tools/i18n/generate.ts (verify it picks up the new keys from en.json automatically + verify whether the tool overwrites manual edits — if yes, Task 5b's post-regen patch must run AFTER the regen)
    - tools/i18n/validate.ts (shape-parity rules)
    - tools/.env (must contain ANTHROPIC_API_KEY)
    - apps/mobile/src/i18n/locales/en.json (post-Task-2/3 — confirm the new ~12 keys are in place: `history.empty.firstTime.bodyTail`, `history.filter.customRange.{title,from,to,placeholder,errorMissing,errorInverted,errorFuture,cancel,apply}` (9), `recording.practiceFallback`, `history.filter.customRangeChip` rename)
    - apps/mobile/src/i18n/locales/hi-IN.json (post-07-16; confirm `recording.gatePrompt` currently has the awkward `'2 सेकंड के लिए हाथ फ्रेम में छोड़ें'` form — the G-27 prose target)
    - apps/mobile/src/i18n/storage.ts (the `SUPPORTED_LOCALES` array — needed for the collision-regression test)
  </read_first>
  <behavior>
    - **Task 5a (RED phase before regen): Indoor/Outdoor collision regression test.**

      Create `apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts` with this structure:

      ```typescript
      import { describe, it, expect } from 'vitest';
      import i18n from '../../src/i18n';
      import { SUPPORTED_LOCALES } from '../../src/i18n/storage';

      describe('i18n indoor/outdoor collision regression (G-24)', () => {
        for (const locale of SUPPORTED_LOCALES) {
          it(`indoor and outdoor are distinct in ${locale}`, () => {
            const indoor = i18n.getFixedT(locale)('tasks.setting.indoor');
            const outdoor = i18n.getFixedT(locale)('tasks.setting.outdoor');
            expect(indoor).toBeTruthy();
            expect(outdoor).toBeTruthy();
            expect(indoor).not.toBe(outdoor);
          });
        }
      });
      ```

      This test should PASS on the current code (the planner-time grep confirms hi-IN.json has DISTINCT values). It exists as a permanent regression guard — if a future LLM regen produces a collision, the test fails immediately rather than waiting for an operator hardware walk.

    - **Task 5b (regen — 7 non-en catalogs via LLM):**

      Run `pnpm i18n:generate` from the repo root. The tool reads en.json (post-Task-2/3 — ~12 new keys + 1 renamed key), then makes 7 sequential calls to Claude Opus 4.7 to produce each non-English locale JSON. Each call writes the full JSON + a fresh `*.audit.json` sidecar.

      Validate shape parity: `pnpm i18n:validate` should exit 0 across all 8 catalogs post-regen.

      Spot-check the hi-IN catalog for the 12 new keys + 1 renamed key:
      ```bash
      jq '.history.empty.firstTime.bodyTail' apps/mobile/src/i18n/locales/hi-IN.json
      jq '.history.filter.customRange' apps/mobile/src/i18n/locales/hi-IN.json
      jq '.history.filter.customRangeChip' apps/mobile/src/i18n/locales/hi-IN.json
      jq '.recording.practiceFallback' apps/mobile/src/i18n/locales/hi-IN.json
      ```

      Each should return non-empty Devanagari strings.

    - **Task 5c (post-regen surgical patch — G-27 hi-IN prose):**

      The LLM may overwrite the hi-IN `recording.gatePrompt` value with another awkward form (the G-27 prose issue). After the regen completes, directly patch hi-IN.json:

      ```bash
      # Read current value
      jq -r '.recording.gatePrompt' apps/mobile/src/i18n/locales/hi-IN.json
      ```

      If the value is NOT the spec form `"2 सेकंड तक अपने हाथ फ़्रेम में रखें"`, replace it via jq:

      ```bash
      jq '.recording.gatePrompt = "2 सेकंड तक अपने हाथ फ़्रेम में रखें"' apps/mobile/src/i18n/locales/hi-IN.json > apps/mobile/src/i18n/locales/hi-IN.json.tmp \
        && mv apps/mobile/src/i18n/locales/hi-IN.json.tmp apps/mobile/src/i18n/locales/hi-IN.json
      ```

      Then update the hi-IN audit sidecar to document the manual override:
      ```bash
      jq '.manual_overrides = (.manual_overrides // []) + [{"key": "recording.gatePrompt", "reason": "G-27 prose fix (Plan 07-17) — LLM produced awkward form; spec form is more natural Hindi", "date": "2026-05-XX"}]' apps/mobile/src/i18n/locales/hi-IN.audit.json > apps/mobile/src/i18n/locales/hi-IN.audit.json.tmp \
        && mv apps/mobile/src/i18n/locales/hi-IN.audit.json.tmp apps/mobile/src/i18n/locales/hi-IN.audit.json
      ```

      For the other 6 non-en locales (`pt-BR`, `es`, `bn-IN`, `ta-IN`, `te-IN`, `mr-IN`): the operator's hi-IN walk surfaced the prose issue. Skim the regen output for awkward forms in each locale's `recording.gatePrompt` — if any read as nonsense or back-translate as wrong meaning, log the discrepancy in the executor's narration BUT do NOT patch them in this plan (out-of-scope unless the operator surfaces them in Task 8). One value at a time.

    - **NO human-translator review pass at MVP** — per CONTEXT.md D-11 + "Deferred Ideas". The regen plus the surgical hi-IN patch is the post-MVP-quality-bar treatment for now.

  </behavior>
  <action>
    1. **Task 5a — RED phase for the collision regression test:**
       - Create `apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts` per the behavior block.
       - Run the test in isolation:
         ```bash
         set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" -- -t "indoor and outdoor are distinct" 2>&1 | tail -15
         ```
       - Confirm all 8 locale assertions PASS on the CURRENT hi-IN.json values (no LLM regen yet — this is the baseline guard). If any locale FAILS at this point (collision already exists), surface to user — the regen needs a length-aware retry.

    2. **Pre-flight env check (per memory `feedback_post_merge_test_env` + 07-16's checker WARNING 10):**
       ```bash
       grep -q "^ANTHROPIC_API_KEY=" tools/.env 2>/dev/null && echo "FOUND" || echo "MISSING"
       ```
       If MISSING, BLOCK + surface to the user with the exact env var name + dotfile path. Without it, the regen cannot proceed.

    3. **Task 5b — LLM regen:**
       ```bash
       pnpm i18n:generate 2>&1 | tee /tmp/07-17-i18n-regen.log
       ```
       Expected: 7 lines `[generate] {locale}: OK`. If any FAILS, investigate via the per-locale validator output and re-run.

    4. **Shape-parity validate:**
       ```bash
       pnpm i18n:validate 2>&1 | tail -20
       ```
       Exit 0; 7 lines `[validate] {locale}: OK`. (Now safe to run — the regen restored parity.)

    5. **Spot-check hi-IN for the 12 new keys + 1 renamed key:**
       ```bash
       jq '.history.empty.firstTime.bodyTail' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.history.filter.customRange.title, .history.filter.customRange.from, .history.filter.customRange.cancel, .history.filter.customRange.apply' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.history.filter.customRangeChip' apps/mobile/src/i18n/locales/hi-IN.json
       jq '.recording.practiceFallback' apps/mobile/src/i18n/locales/hi-IN.json
       ```
       Each should return a non-empty Devanagari-script value. If any is the English literal (LLM regen hole), surface to user.

    6. **Spot-check pt-BR + bn-IN for cross-locale sanity** (one Latin + one Indic):
       ```bash
       jq '.history.filter.customRange.cancel' apps/mobile/src/i18n/locales/pt-BR.json   # expect "Cancelar"
       jq '.history.filter.customRange.cancel' apps/mobile/src/i18n/locales/bn-IN.json   # expect Bengali script
       ```

    7. **Task 5c — surgical hi-IN G-27 prose patch:**
       - Read the post-regen hi-IN `recording.gatePrompt` value.
       - If not the spec form `"2 सेकंड तक अपने हाथ फ़्रेम में रखें"`, patch via the jq commands in the behavior block.
       - Re-validate shape parity (`pnpm i18n:validate`) — the patch is value-only, shape unchanged.
       - Update hi-IN.audit.json with the manual_overrides entry.

    8. **Re-run the collision regression test post-regen:**
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" -- -t "indoor and outdoor are distinct" 2>&1 | tail -15
       ```
       All 8 locale assertions must still PASS. If any FAILS (the regen produced a collision), surface to user — the regen needs a re-prompt with a stronger distinctness directive.

    9. **Run the full test suite** to confirm the regen didn't break anything:
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
       ```
       Exit 0.

    10. **Invariant gates (the 8 from Task 4):**
        ```bash
        git diff --stat apps/api/ apps/mobile/ios/ apps/mobile/android/ apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/lib/ttsVoice.ts apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx apps/mobile/src/ui/tokens.ts
        git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
        ```
        All 8 must return empty.

  </action>
  <verify>
    <automated>pnpm i18n:validate 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts` exists; the file has at least 8 assertions (one per locale).
    - All 8 locale assertions in the collision test PASS — both pre-regen baseline AND post-regen (the regen did NOT introduce a collision).
    - `pnpm i18n:validate` exits 0 with all 8 catalogs reporting `OK`.
    - `jq '.recording.practiceFallback' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari string (NOT the English literal `"Practice — 60 sec"`).
    - `jq '.history.filter.customRange.cancel' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari string (likely `"रद्द करें"` or similar).
    - `jq '.history.filter.customRange.apply' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari string.
    - `jq '.history.empty.firstTime.bodyTail' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari string.
    - `jq -r '.recording.gatePrompt' apps/mobile/src/i18n/locales/hi-IN.json` returns exactly `"2 सेकंड तक अपने हाथ फ़्रेम में रखें"` (the G-27 spec form — proves Task 5c surgical patch landed).
    - `jq '.manual_overrides[] | select(.key == "recording.gatePrompt")' apps/mobile/src/i18n/locales/hi-IN.audit.json` returns a non-null entry (proves the audit trail).
    - All 7 `*.audit.json` sidecars have `generated_at` timestamps within the last 24 hours of Task 5 completion.
    - JS test suite exit 0.
    - All 8 invariant gates empty.
  </acceptance_criteria>
  <done>7 non-English catalogs regenerated; shape parity validated; collision regression test added; hi-IN G-27 prose surgically patched + audit trail recorded. Catalog layer is feature-complete for 07-17. Tasks 6-8 verify everything ships together.</done>
</task>

<task type="auto">
  <name>Task 6: Full regression — JS + Kotlin + tools tests + i18n validate + 7 invariants + fresh APK on Pixel 10a</name>
  <files>(no source files — build output + test invocations + git status checks)</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-15-PAUSE.md `## Dev environment state` (Pixel 10a still paired)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-16-TASK-8-HANDOFF.md `## Cleanup state at handoff time` (dev API + adb tunnels)
    - CLAUDE.md memory references for `feedback_android_build_needs_jdk17`, `feedback_apk_build_pitfalls`, `feedback_dev_tunnels_include_localstack_4566`, `feedback_metro_intercepts_apk_walks`, `feedback_dev_api_runs_hash_verify_worker`, `feedback_post_merge_test_env`
  </read_first>
  <behavior>
    - Run the full JS + Kotlin + tools/ test suite.
    - Run `pnpm i18n:validate` one more time.
    - Run all 8 invariant grep gates (cross-referencing every file the plan touched + every file the LOCKED constraints forbid touching).
    - **Kill Metro on :8081 first** per memory `feedback_metro_intercepts_apk_walks` — a stale Metro server would intercept the APK walk and serve the wrong JS bundle.
    - Build a fresh `:app:assembleApkRolloutDebug` and install it on the Pixel 10a via `:app:installApkRolloutDebug`. Use JDK 17 per memory `feedback_android_build_needs_jdk17`. Do NOT use `gradle clean` (the reanimated prefab wipe) per `feedback_apk_build_pitfalls`. Copy gitignored files (`local.properties`, `apkRollout/google-services.json`) if missing in the worktree.
    - Confirm adb reverse tunnels (3 ports: 8080 + 8081 + 4566) per memory `feedback_dev_tunnels_include_localstack_4566`.
    - Confirm dev API is up + hash-verify worker is running per memory `feedback_dev_api_runs_hash_verify_worker`.
    - Pin the commit hash for Task 8.
  </behavior>
  <action>
    1. **Kill stale Metro on :8081 first (PRE-FLIGHT):**
       ```bash
       lsof -i :8081 -t 2>/dev/null | xargs -r kill -9
       # OR
       pkill -f "metro\\|react-native start" 2>/dev/null
       ```
       Confirm port is free:
       ```bash
       lsof -i :8081 -t 2>/dev/null || echo "Port 8081 free"
       ```

    2. **Run the full JS test suite (per memory `feedback_post_merge_test_env`):**
       ```bash
       set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test 2>&1 | tail -40
       ```
       Exit 0. If any test that 07-16 already noted as PRE-EXISTING failure (the 2 RecordingScreen visual snapshot tests) fails again, log and continue — these are not in scope per `deferred-items.md`.

    3. **Run the Kotlin unit test suite (per memory `feedback_android_build_needs_jdk17`):**
       ```bash
       cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:testApkRolloutDebugUnitTest 2>&1 | tail -20
       ```
       Exit 0.

    4. **Run the tools/ test suite:**
       ```bash
       cd tools && pnpm test 2>&1 | tail -15
       ```
       Exit 0.

    5. **Run `pnpm i18n:validate` (post-Task-5):**
       ```bash
       cd "$(git rev-parse --show-toplevel)" && pnpm i18n:validate 2>&1 | tail -10
       ```
       Exit 0; 8 lines `OK`.

    6. **Run the 8 invariant grep gates (final pre-build check):**
       ```bash
       git diff --stat main -- apps/api/                                                       # D-16 — empty
       git diff --stat main -- apps/mobile/ios/                                                # I18N-21 — empty
       git diff --stat main -- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt   # drift + cancel banners — empty
       git diff --stat main -- apps/mobile/src/lib/ttsVoice.ts                                 # TTS deviation — empty
       git diff --stat main -- apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx          # RigTutorial deviation — empty
       git diff --stat main -- apps/mobile/src/i18n/taskCatalog.i18n.ts                        # 07-16's EOF append untouched by 07-17 — empty
       git diff --stat main -- apps/mobile/src/ui/tokens.ts                                    # no new design tokens — empty
       git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md   # I18N-11 — empty
       ```
       All 8 must return empty.

    7. **Pre-build gitignored-file check (per memory `feedback_apk_build_pitfalls`):**
       ```bash
       ls -la apps/mobile/android/local.properties apps/mobile/android/app/src/apkRollout/google-services.json 2>/dev/null
       ```
       If either is missing, copy from the main repo at `/Users/adnaan/Documents/hl-homelander/apps/mobile/android/` (the worktree may not have them).

    8. **Build the APK + install on Pixel 10a (per memory `feedback_android_build_needs_jdk17` + `feedback_apk_build_pitfalls`):**

       Do NOT pipe to `| tail` — exit-code masking per `feedback_apk_build_pitfalls`. Do NOT run `gradle clean` — reanimated prefab wipe per same memory.

       ```bash
       cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug :app:installApkRolloutDebug
       APK_COMMIT=$(git -C "$(git rev-parse --show-toplevel)" rev-parse HEAD)
       echo "Fresh APK commit: $APK_COMMIT"
       ```

       Expected: `BUILD SUCCESSFUL` + the APK installed on device `5C161JEA304304`.

    9. **Confirm adb tunnels are up (per memory `feedback_dev_tunnels_include_localstack_4566`):**
       ```bash
       adb reverse --list 2>&1 | tee /tmp/07-17-adb-tunnels.log
       ```
       Expected: lines containing `tcp:8080`, `tcp:8081`, `tcp:4566`. If any is missing:
       ```bash
       adb reverse tcp:8080 tcp:8080 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4566 tcp:4566
       ```

    10. **Confirm dev API + hash-verify worker is up (per memory `feedback_dev_api_runs_hash_verify_worker`):**
        ```bash
        curl -sS http://localhost:8080/health
        ```
        If down OR returns non-2xx, surface to user: "Dev API on :8080 must be running for Task 8 (operator's APK walk). Start with `set -a && source apps/api/.env && set +a && pnpm --filter @humyn/api dev` in a separate terminal."

    11. **Echo the APK commit hash + device pairing** for Task 8's resume signal:
        ```bash
        echo "===== Task 6 ready for Task 8 ====="
        echo "APK commit: $APK_COMMIT"
        echo "Pixel 10a serial: 5C161JEA304304"
        echo "adb reverse tunnels: $(adb reverse --list | tr '\\n' ' ')"
        echo "Dev API health: $(curl -sS -o /dev/null -w '%{http_code}' http://localhost:8080/health)"
        ```

  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && pnpm i18n:validate 2>&1 | tail -10 && echo "---" && git diff --stat main -- apps/mobile/ios/ apps/api/ apps/mobile/src/lib/ttsVoice.ts apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx apps/mobile/src/ui/tokens.ts apps/mobile/src/i18n/taskCatalog.i18n.ts | head -10 && echo "---" && git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md | head -3</automated>
  </verify>
  <acceptance_criteria>
    - JS test suite exit 0; all Tasks 2-5 new tests still PASS.
    - Kotlin unit test suite exit 0.
    - tools/ test suite exit 0.
    - `pnpm i18n:validate` exits 0 with all 8 catalogs reporting OK.
    - APK build: `BUILD SUCCESSFUL`; APK installed on Pixel 10a `5C161JEA304304`.
    - APK_COMMIT recorded (matches `git rev-parse HEAD`).
    - adb tunnels list shows tcp:8080, tcp:8081, tcp:4566 all reversed.
    - `curl http://localhost:8080/health` returns 200 (or the user is instructed to start dev API).
    - All 8 invariant grep gates return empty:
      - `git diff --stat main -- apps/api/` empty
      - `git diff --stat main -- apps/mobile/ios/` empty
      - `git diff --stat main -- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/{HevcEncoder,FinalizeWorker,MetadataComposer,CaptureSession}.kt` empty (4 files in one path)
      - `git diff --stat main -- apps/mobile/src/lib/ttsVoice.ts` empty
      - `git diff --stat main -- apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` empty
      - `git diff --stat main -- apps/mobile/src/i18n/taskCatalog.i18n.ts` empty (07-16 EOF append untouched)
      - `git diff --stat main -- apps/mobile/src/ui/tokens.ts` empty (no new design tokens)
      - `git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty (Phase 6 cosmetics — strict main-base comparison, no `5879daf` cluster-base relaxation since 07-17 has no renumber-sweep pretext)
  </acceptance_criteria>
  <done>Fresh APK on Pixel 10a; all tests green; all invariants green. Operator can proceed to Task 7 (the 7-locale hardware re-walk).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Operator-walked FULL 7-locale hardware re-walk on Pixel 10a — close 07-16 FAILs + Bucket C deferrals + G-29 disposition</name>
  <files>.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md, .planning/phases/07-17-rewalk-evidence/ (NEW screenshots dir for fresh hi-IN tab evidence + G-13/G-14 probe screenshots)</files>
  <action>This is a checkpoint:human-verify task. See the canonical step-by-step walking sequence in the &lt;what-built&gt; + &lt;how-to-verify&gt; blocks below + the full per-locale per-gap walking protocol in the &lt;rewalk_protocol&gt; section at the bottom of this plan. The operator drives the Pixel 10a; the agent runs adb commands + reads jq/grep on demand + writes the PASS/FAIL matrix to 07-HUMAN-UAT.md from the operator narration.</action>
  <verify><automated>grep -c "Re-walk 2026.*Plan 07-17 closure" .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md</automated></verify>
  <done>Operator types resume signal &quot;approved — 07-17 walk all PASS&quot; OR &quot;07-17 walk done — FAILs: ...&quot;. 07-HUMAN-UAT.md gains a new ## Re-walk 2026-05-XX (Plan 07-17 closure) section with the PASS/FAIL matrix across all 7 locales + G-13/G-14/G-29 one-off rows.</done>
  <what-built>
    Tasks 1-6 shipped: G-25 practice-fallback chain rewired (PracticeIntroScreen + RecordingScreen); G-20 history empty bodyTail added; G-21 FilterSheet Custom-range sub-sheet wired through 9 new t() keys; G-22 two-site fix: (a) Button primitive overflow guards (cross-cutting — every Button consumer inherits numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}); (b) FilterSheet Custom-range Cancel/Apply raw Text elements get the SAME guards inline (does NOT inherit from Button — verified zero `<Button>` consumers in FilterSheet.tsx); G-22 ReportProblemSheet chip text 2-line wrap; G-24 SendRequestSheet Indoor/Outdoor segmented overflow guards (the collision was a TRUNCATION, NOT a value bug — Vitest regression test added); G-17 TaskCategoryPills overflow guards + padding tuning; G-15 RecordingScreen liveEyeHint overflow guards (the bug was on the SIBLING Text, not the liveLabelText that 07-16 fixed); G-26 RotatePrompt scale lowered to 0.75 + padding added; G-27 RecordingScreen gatePrompt inline lineHeight override + scale lowered (the ui/tokens.ts variant is UNTOUCHED); 7 non-en catalogs LLM-regenerated with the 12 new keys; hi-IN G-27 prose surgically patched to spec form `2 सेकंड तक अपने हाथ फ़्रेम में रखें`; fresh APK on Pixel 10a; all 8 invariants green.

    **Bucket C carry-forward:** the 2026-05-26 hi-IN walk did NOT walk G-13 (search probes), G-14 (CompatCheck — needs fresh install), G-19 (TaskDetailsSheet — needs operator tap), G-28 (HistoryRow — needs a real recording in History). Task 7 covers ALL FOUR via specific walking sequences below.

    **G-29 carry-forward:** Task 1 investigated and (per the proceed-or-PAUSE decision) determined G-29 was likely a TRANSCRIPTION ERROR (the actual hi-IN.json `tabs.history` value is `"हिस्ट्री"`, and the screenshot at `07-16-rewalk-evidence/2026-05-26-hi-IN/3.png` shows the History tab correctly translating to `हिस्ट्री`). Task 7 confirms via fresh hi-IN walk + screenshot. NO code change is in 07-17 for G-29.

    **Operator directive (verbatim, 2026-05-26 17:30 IST):** "i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device." Task 7 implements that directive.

    **The walk:** for EACH locale in [hi-IN, pt-BR, es, bn-IN, ta-IN, te-IN, mr-IN] — locale order is LOCKED per memory `feedback_walk_locale_order` (hi-IN first because Devanagari fronts truncation/wrap escapes fastest):

    1. **Switch locale:** Profile → Language → tap the locale row. Sheet auto-dismisses. Profile re-renders translated within 1 frame.

    2. **HomeScreen** — sanity check (already translated by 07-16).

    3. **TasksScreen** — confirm:
       - G-17 (re-verify): category filter chips render in active locale AND do NOT clip at the active-bold variant. Bold-active `घर का रखरखाव` should fit inside its pill without ellipsis.
       - G-18 (re-verify from 07-16): task cards render localized name + category eyebrow.
       - **G-13 (Bucket C dedicated walk — en locale only, then hi-IN cross-check):**
         - Switch to en. TasksScreen search input → type `"recyclable"`. Expected: "Sorting recyclables" task appears.
         - Repeat with `"recyclables"`, `"recycle"`, `"recycling"` — each returns the same task.
         - Switch to hi-IN. Search input → type the hi-IN catalog form for "Sorting recyclables" (look up the value live: `jq -r .[\"Sorting recyclables\"][\"hi-IN\"].name apps/mobile/src/i18n/taskCatalog.i18n.ts` — though its a TS file, the executor reads the value via grep / IDE — OR uses the canonical English form `"Sorting recyclables"` directly which still hits via reverseSearch en-fallback). Expected: the result list contains "Sorting recyclables" (or its localized name).

    4. **TaskDetailsSheet (G-19 Bucket C — needs tap):** tap any task → confirm the sheet renders translated name + category eyebrow + description + 4 ALWAYS rules + per-task instructions in the active locale. The "Start Recording" CTA already translated (07-16). Confirm the 07-16 G-19 wires fire on real device data.

    5. **Send Request flow** — confirm:
       - G-24 (re-verify): Indoor/Outdoor segmented toggle renders DISTINCT translated labels — `घर के अंदर` vs `घर के बाहर` (both VISIBLE, neither truncating to `घर के`).
       - G-22 base check: Cancel button reads `रद्द करें` (or locale equivalent) without truncating to `रद`.

    6. **RecordingScreen entry — Practice flow (G-25 dedicated walk):**
       - Profile → "Practice" (or whatever the practice entry point is — typically `PracticeIntroScreen` from the onboarding stack).
       - On the RecordingScreen, verify the app-bar task name reads in the ACTIVE LOCALE (e.g. Hindi for hi-IN — the LLM regen of `"Practice — 60 sec"`), NOT the English literal.
       - Verify G-26: rotate prompt renders complete (no truncation; 2-line wrap fits).
       - Verify G-27: hand-gate prompt renders complete with COMPACT line-height (no visible vertical gap between lines).
       - Verify G-15 (the actual fix this time — sibling text): tap to dismiss preview → wait for dim state → verify the "Tap on screen to see preview" hint (`liveEyeHint`) renders COMPLETE (no truncation at `टैप`).
       - Cover the lens to force a clean cancel OR Stop the recording.

    7. **RecordingScreen entry — Real-task flow:**
       - From TasksScreen → tap any task → tap "Start Recording" in the TaskDetailsSheet → on RecordingScreen, verify the app-bar task name reads in the ACTIVE LOCALE (taskI18n.ts wire from 07-16, downstream confirmation).

    8. **HistoryScreen — capture at least ONE recording so History is non-empty (G-28 Bucket C — needs real recording):**
       - Either the practice recording from step 6 OR the real-task recording from step 7. Stop the recording (dont cancel — let it persist to History).
       - Open History tab → verify:
         - G-20 (re-verify): empty state was correct; now superseded by row.
         - G-28: HistoryRow shows task name in active locale + `Uploaded at HH:MM` prefix translated + `FEEDBACK (COMING SOON)` eyebrow translated.
         - G-28: day-section header (`TODAY` / `YESTERDAY` / `THIS WEEK` / `THIS MONTH`) renders in active locale per 07-16s WARNING-9 decision (translated body + `.toUpperCase()` stays as design choice).
         - G-21 (re-verify): tap the time-filter chip → base FilterSheet opens with translated 6 options + sheet title. Tap "Custom range" → the Custom-range sub-sheet opens with ALL 9 NEW translated labels: title `Custom range` / `FROM` / `TO` / `Pick a date` placeholder / 3 error messages / Cancel / Apply.
         - G-29 (re-verify): the bottom tab bar — confirm History tab label reads `हिस्ट्री` (or active-locale equivalent), NOT `हिन्दी` (the language name). Take a fresh screenshot for the audit trail.

    9. **Help Center (sanity check from 07-16):** verify the header bar title translates AND the locale-reactive header re-renders (07-16 WARNING-7 fix).

    10. **Report a Problem (G-22 re-verify):**
        - From Profile → tap "Report a problem" → confirm category chips render translated (07-16 wire).
        - Confirm chip TEXT no longer truncates inside the chip (07-17 fix — 2-line wrap inside the chip for long Devanagari).
        - Cancel button (raw `<Pressable>`+`<Text>` per FilterSheet.tsx:369 — overflow guards added inline in Task 2 G-21 step 3) reads `रद्द करें` without truncating to `रद`. Apply button (same pattern at FilterSheet.tsx:382) reads `अप्लाई` or locale equivalent without truncation.

    11. **CompatCheck (G-14 Bucket C — needs CLEAN install):**
        - Uninstall + reinstall the APK: `adb uninstall ai.humynlabs.capture.apk.debug && adb install <APK_PATH>`. CompatCheck fires on first launch per Phase 2.
        - The current locale will reset to en (because MMKV `locale.chosen_at` is cleared on reinstall) — pick a non-English locale on ChooseLanguage to drive the CompatCheck through the hi-IN/etc surface.
        - Confirm probe-label rows render complete Devanagari (no truncation; 07-16 wire is intact).
        - This step ONLY needs to be done once (not per-locale) — confirm Devanagari renders complete in hi-IN; cross-locale parity for other Indic locales (Bengali / Tamil / Telugu / Marathi) is implied by the same fix.

    12. **Record verdicts:** for each gap above, write PASS or FAIL to the per-locale row in the `07-HUMAN-UAT.md` re-walk matrix.

    **Total walk sequence:** ~12 minutes per locale × 7 locales = ~80-90 minutes of operator time. Owner directive accepts this cost. G-13 + G-14 are walked ONCE (not per-locale), saving ~10 minutes total.

    **What the operator updates:** `07-HUMAN-UAT.md` gains a new section:

    ```markdown
    ## Re-walk 2026-05-XX (Pixel 10a, 7-locale, Plan 07-17 closure)

    APK commit: {APK_COMMIT from Task 6}
    Locale-walk-time: {actual minutes}

    | Gap | hi-IN | pt-BR | es | bn-IN | ta-IN | te-IN | mr-IN |
    |-----|-------|-------|-----|-------|-------|-------|-------|
    | G-13 search (en walked once) | PASS (cross-locale hi-IN: PASS) |
    | G-14 CompatCheck (fresh-install hi-IN walk) | PASS |
    | G-15 liveEyeHint overflow | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-17 category pill bold-active | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-19 TaskDetailsSheet body (re-verify) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-20 history empty bodyTail | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-21 FilterSheet Custom-range sub-sheet | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-22 chip text + Cancel button | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-24 Indoor/Outdoor distinct + visible | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-25 RecordingScreen practice fallback | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-26 RotatePrompt overflow | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-27 hand-gate prompt leading + prose | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-28 HistoryRow + day-section names (re-verify) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
    | G-29 BottomNav History tab (transcription-error disposition) | PASS (confirmed `हिस्ट्री`, NOT `हिन्दी`) |

    Verdict: {ALL PASS | N FAILS — listed below}

    Failed rows: {none / G-XX in {locale} — {description}}
    ```

    **Outcome routing:**
    - **All PASS** → 07-17 is feature-complete. Plan 07-15 (paused) can now re-attempt its Bundle 1 + Bundle 2 + wrap-up walk to finalize Phase 7.
    - **Any FAIL** → file the failed gap in a fresh `## Gaps surfaced during 07-17 closure walk` block in `07-HUMAN-UAT.md`. The orchestrator decides whether to re-route in-place OR plan a 07-18 follow-on.

  </what-built>
  <how-to-verify>
    **Pre-walk (Task 6 confirms; operator re-verifies):**
    1. `adb devices` shows Pixel 10a `5C161JEA304304`.
    2. The APK from Task 6 is installed (`adb shell pm list packages | grep humyn`). Force-stop the app: `adb shell am force-stop ai.humynlabs.capture.apk.debug`.
    3. adb reverse tunnels confirmed (3 ports per memory `feedback_dev_tunnels_include_localstack_4566`): `adb reverse --list`.
    4. Dev API on :8080 healthy: `curl -sS http://localhost:8080/health` returns 200.
    5. Metro on :8081 was killed pre-build (Task 6 step 1) — verify still free: `lsof -i :8081 -t || echo "free"`.
    6. Sign in if needed: m.adnaan161@gmail.com (per PAUSE doc + memory).

    **Walk:**
    7. For each locale in [hi-IN, pt-BR, es, bn-IN, ta-IN, te-IN, mr-IN]: follow the per-locale sequence in `<what-built>` steps 1-12. The operator describes what they see; the agent compares against the planned-translation reference values (from en.json + hi-IN.json + the LLM-regen output).
    8. G-13: en + hi-IN cross-check (one-off, ~5 min).
    9. G-14: fresh-install CompatCheck (one-off, ~5 min).
    10. G-28: capture at least one recording (~3 min — a 60s practice recording works).

    **Report back:**
    11. After all 7 locales walked, the operator narrates verdicts; the agent writes the PASS/FAIL matrix directly to `07-HUMAN-UAT.md` under a fresh `## Re-walk 2026-05-XX (Plan 07-17 closure)` section.

    **Resume:**
    12. Operator types one of: `"approved — 07-17 walk all PASS"` / `"07-17 walk done — FAILs: {locale}/{gap}, ..."` .

  </how-to-verify>
  <acceptance_criteria>
    - `07-HUMAN-UAT.md` gains a `## Re-walk 2026-05-XX (Pixel 10a, 7-locale, Plan 07-17 closure)` block with the PASS/FAIL matrix:
      - 7 locales × 12 per-locale gaps (G-15, G-17, G-19, G-20, G-21, G-22, G-24, G-25, G-26, G-27, G-28, G-29 — 12 verdicts/locale = 84 cells)
      - 1 row for G-13 (en + cross-locale)
      - 1 row for G-14 (one fresh-install walk)
    - All 7 non-en locales walked. No locale skipped (per the owner directive "skip nothing").
    - `grep -c "Re-walk 2026" .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md` returns at least 2 new occurrences (the 2026-05-26 + the new 07-17 closure block; the prior `## Re-walk 2026-05-26 (07-16 Task 8...)` block at line 160 stays).
    - Operator types a resume signal of the form: "approved — 07-17 walk all PASS" OR "07-17 walk done — FAILs: ..." (the operators explicit verbal sign-off is the gate).
  </acceptance_criteria>
  <resume-signal>Type "approved — 07-17 walk all PASS" to mark Phase 7 ready for the 07-15 re-attempt. Type "07-17 walk done — FAILs: {locale}/{gap} ..." if any walk failed; the agent will file the gaps in 07-HUMAN-UAT.md and route to a follow-on plan.</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                                                           | Description                                                                                                                                         |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM translation pipeline → user-facing copy                                        | Untrusted LLM output committed verbatim to the app bundle (Task 5 regen). Same trust posture as plans 07-11 / 07-12 / 07-13 / 07-16.                |
| en.json → 7 locale catalogs                                                        | Single-direction propagation; en.json is the canonical source. Audit sidecars record model + brief version + en.json SHA for every regen.           |
| Manual override of LLM output (Task 5c hi-IN G-27 prose patch) → committed catalog | The audit sidecar records the manual override in a `manual_overrides[]` array — provides an audit trail for divergence from automated regen output. |
| Cross-cutting Button primitive change (Task 3 G-22 fix) → all Button consumers     | The change is purely additive (overflow guards); risk surfaces if a consumer was relying on natural wrap. Vitest regression test guards.            |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                                 | Disposition | Mitigation Plan                                                                                                                                                                                                                                              |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-07-17-01 | Tampering              | LLM translation output (Task 5b regen)                                                    | mitigate    | `tools/i18n/validate.ts` enforces structural shape parity with en.json; the vernacular brief is a fixed system prompt; sidecar audit JSONs record model + brief version + en.json SHA. Same posture as plan 07-16.                                           |
| T-07-17-02 | Tampering              | Manual hi-IN override (Task 5c G-27 prose patch)                                          | mitigate    | The patch is recorded in `hi-IN.audit.json:manual_overrides[]` with a key + reason + date. A subsequent LLM regen would overwrite the override UNLESS the audit step re-applies the patch; the executor documents this in the Task 5 commit message.         |
| T-07-17-03 | Information Disclosure | en.json → catalogs                                                                        | accept      | en.json contains user-visible copy only — no secrets, no PII, no system identifiers.                                                                                                                                                                         |
| T-07-17-04 | Tampering              | Button primitive cross-cutting change (Task 3)                                            | mitigate    | A new Vitest test (`Button.numberOfLines.test.tsx`) renders a long Devanagari label and asserts the props propagate. Operators 7-locale walk in Task 7 visually confirms no Button regression across the app.                                                |
| T-07-17-05 | Spoofing               | LLM may produce culturally inappropriate output (Task 5b)                                 | accept      | Per-locale legal review deferred to §v2 per CONTEXT.md Deferred Ideas. Operators 7-locale walk (Task 7) is the final human review.                                                                                                                           |
| T-07-17-06 | Tampering              | Indoor/Outdoor LLM collision regression (Task 5a baseline; could surface in future regen) | mitigate    | The new `indoorOutdoorCollision.test.ts` permanently asserts `t(setting.indoor) !== t(setting.outdoor)` for every locale in SUPPORTED_LOCALES. A future regen producing a collision FAILS the test immediately rather than waiting for hardware observation. |

</threat_model>

<verification>
1. `pnpm i18n:validate` exits 0 across all 8 catalogs (post-Task-5 + post-Task-5c).
2. `pnpm -r --parallel test --filter "@humyn/mobile"` exits 0 with all Tasks 2-5 new tests PASS (including `indoorOutdoorCollision.test.ts` × 8 locales, `Button.numberOfLines.test.tsx`, `RecordingScreen.practiceFallback.i18n.test.tsx`, `HistoryScreen.emptyTail.i18n.test.tsx`, `FilterSheet.customRange.i18n.test.tsx`).
3. `cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:testApkRolloutDebugUnitTest` exits 0.
4. `cd tools && pnpm test` exits 0.
5. `cd apps/mobile && npx tsc --noEmit` clean.
6. All 8 invariant grep gates from Task 6 step 6 return empty:
   - apps/api/ untouched (D-16)
   - apps/mobile/ios/ untouched (I18N-21)
   - HevcEncoder.kt, FinalizeWorker.kt, MetadataComposer.kt, CaptureSession.kt all untouched (CLAUDE.md drift + cancel banners)
   - ttsVoice.ts untouched (TTS owner-deviation guard)
   - RigTutorialScreen.tsx untouched (RigTutorial owner-deviation guard)
   - taskCatalog.i18n.ts untouched (07-16s EN_TOKEN_ALIASES + 86×8 catalog block unchanged)
   - ui/tokens.ts untouched (no new design tokens; G-27 lineHeight override is INLINE on the JSX call site, NOT a variant edit)
   - 06-COSMETIC-GAPS.md untouched vs `main` (I18N-11; strict main-base comparison)
7. The Task 7 `07-HUMAN-UAT.md` Re-walk block records PASS for all gaps × 7 locales (or surfaces FAILs as a fresh gap list).
8. APK BUILD SUCCESSFUL on the Pixel 10a `apkRolloutDebug` flavor + installed.
9. The fresh hi-IN bottom-tab screenshot (taken during Task 7) shows the History tab as `हिस्ट्री` (NOT `हिन्दी`), confirming G-29 was a transcription error — or, if it shows `हिन्दी`, the discrepancy is logged and a 07-18 follow-on is triggered.
</verification>

<success_criteria>

- **G-13 re-walked PASS** (Bucket C deferred from 07-16): on Pixel 10a en locale, typing `recyclable` / `recyclables` / `recycle` / `recycling` in TasksScreen search returns "Sorting recyclables". hi-IN cross-locale check passes. The 07-16 EN_TOKEN_ALIASES + reverseSearch en-branch stay UNTOUCHED — 07-17 verifies the existing implementation works on hardware.
- **G-14 re-walked PASS** (Bucket C deferred from 07-16): on a clean APK install, CompatCheck probe-label rows in hi-IN render complete Devanagari (no truncation). The 07-16 numberOfLines + adjustsFontSizeToFit on CompatRunningScreen.tsx ~line 285 stays UNTOUCHED.
- **G-15 closed:** the actual buggy element (RecordingScreen.tsx `liveEyeHint` Text — the tap-to-reveal hint during dimmed state) gains numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85}. 07-16s `liveLabelText: { textAlign: center }` fix at line 1306 stays UNTOUCHED (different element).
- **G-17 closed:** TaskCategoryPills pill labels gain numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}; pill+pillActive styles reduce paddingHorizontal from spacing.l to spacing.m; the rows ScrollView content gains paddingRight: spacing.xl + spacing.m for safe-area.
- **G-19 re-walked PASS** (Bucket C deferred from 07-16): TaskDetailsSheet renders translated body via the 07-16 taskI18n.ts helpers + UniversalRulesBlock labelKey wires (UNTOUCHED by 07-17).
- **G-20 closed:** HistoryScreen.tsx:599 trailing JSX literal ` and try one.` moves to a new en.json key `history.empty.firstTime.bodyTail`.
- **G-21 closed:** FilterSheet Custom-range sub-sheet (lines 280-388) — 9 hardcoded English literals route through 9 new `history.filter.customRange.*` keys; existing `history.filter.customRange` string key renamed to `history.filter.customRangeChip` to make room for the new object-valued key.
- **G-22 closed (Cancel button + chip text wrap):** TWO fix sites because FilterSheet Custom-range does NOT consume `<Button>` (verified by plan-checker — grep returned 0 `<Button>` matches in FilterSheet.tsx). (1) Button primitive (`apps/mobile/src/ui/primitives/Button.tsx:85`) gains numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75} — cross-cutting fix benefiting every Button consumer (ReportProblem Cancel + ~30 other call sites). (2) FilterSheet Custom-range Cancel + Apply raw Text elements at lines 369-388 receive the SAME overflow guards inline (Task 2 G-21 step 3). ReportProblemSheet chip Text gains numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85} so long Devanagari chip labels wrap inside the chip.
- **G-24 closed:** SendRequestSheet Indoor/Outdoor segmented Text elements gain numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}; new Vitest regression test (`indoorOutdoorCollision.test.ts`) asserts the keys values are DISTINCT across all 8 locales (permanent guard against future LLM-regen collisions).
- **G-25 closed:** PracticeIntroScreen drops `taskName` from PRACTICE_ROUTE_PARAMS; RecordingScreen.tsx:178 fallback rewritten to `params.taskName ?? t(recording.practiceFallback)` AFTER the `useTranslation()` hook line. New en.json key `recording.practiceFallback` = `"Practice — 60 sec"` LLM-regend to 7 non-en locales.
- **G-26 closed:** RotatePrompt.tsx body Text minimumFontScale lowered from 0.85 to 0.75; wrap style gains paddingHorizontal: spacing.l for horizontal slack.
- **G-27 closed:** RecordingScreen.tsx gatePrompt JSX call site gains inline `style={[styles.gatePrompt, { lineHeight: 20 }]}` (overrides the `recGatePrompt` variants 24px lineHeight) + minimumFontScale lowered to 0.75. `ui/tokens.ts:recGatePrompt` variant UNTOUCHED. hi-IN `recording.gatePrompt` surgically patched to spec form `"2 सेकंड तक अपने हाथ फ़्रेम में रखें"` via Task 5c post-regen patch + audit sidecar manual_overrides entry.
- **G-28 re-walked PASS** (Bucket C deferred from 07-16): HistoryRow row task name + Uploaded at HH:MM prefix + FEEDBACK eyebrow + day-section header all render in active locale per 07-16s wires (UNTOUCHED by 07-17).
- **G-29 disposition:** Task 1 investigation + Task 7 fresh screenshot confirms the bottom-tab History label renders correctly as `हिस्ट्री` (or active-locale equivalent), NOT the language name `हिन्दी`. Operators matrix entry was a TRANSCRIPTION ERROR. NO code change.
- **7 non-English catalogs regenerated** by Task 5 with the 12 new keys + 1 renamed key; shape parity green; hi-IN G-27 prose surgical patch in place.
- **Operator-walked 7-locale re-walk PASSES** on Pixel 10a (Task 7), per the owner directive "skip nothing".
- **All invariants green:** iOS untouched / apps/api untouched / Phase-6 cosmetics untouched VS `main` (strict; no `5879daf` relaxation) / HevcEncoder+FinalizeWorker+MetadataComposer+CaptureSession.kt untouched / ttsVoice untouched / RigTutorial untouched / taskCatalog.i18n.ts untouched / ui/tokens.ts untouched.

</success_criteria>

<rewalk_protocol>

## Task 7 — Full 7-locale hardware re-walk protocol

**Device:** Pixel 10a `5C161JEA304304`
**APK:** the fresh `apkRolloutDebug` build from Task 6 (commit pinned in Task 6 step 11)
**Locales (in LOCKED order per memory `feedback_walk_locale_order`):** hi-IN → pt-BR → es → bn-IN → ta-IN → te-IN → mr-IN
**Operator directive (verbatim 2026-05-26 17:30 IST):** "i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device."

### Per-locale walking sequence (~12 min each)

For each of the 7 non-English locales:

1. **Switch locale:** Profile → Language → tap the locale row. Sheet auto-dismisses. Profile re-renders translated within 1 frame.

2. **HomeScreen sanity check** — confirm the 07-16 wires still hold (tile period chips translated; HomeHero greeting translated). This is NOT a 07-17 gap.

3. **TasksScreen** — confirm:

   - G-17 (07-17 fix): category filter chips render in active locale AND do NOT clip at the active-bold variant. Take screenshot evidence if a Devanagari/Bengali bold-active label fits inside its pill.
   - G-18 (07-16 carry-over): task cards render localized name + category eyebrow.
   - **G-13 (Bucket C dedicated walk — en locale + hi-IN cross-check):** see step 4 below.

4. **G-13 dedicated walk (en + cross-locale; do once during the hi-IN walk, then move on):**

   - Switch to en. TasksScreen search input → type `"recyclable"`. Expected: "Sorting recyclables" task appears in results.
   - Type `"recyclables"`. Expected: same task appears.
   - Type `"recycle"`. Expected: same task appears.
   - Type `"recycling"`. Expected: same task appears.
   - Switch back to hi-IN. Look up the hi-IN catalog form for "Sorting recyclables" via `jq -r .[\"Sorting recyclables\"][\"hi-IN\"].name apps/mobile/src/i18n/taskCatalog.i18n.ts` (or the executor reads it from the file).
   - Type the hi-IN form. Expected: same task appears via reverseSearch.ts Stage 1.
   - All 5 sub-checks must PASS. Verdict to the matrix row G-13.

5. **TaskDetailsSheet (G-19 Bucket C):** tap any task → sheet opens → verify name + category eyebrow + description + 4 ALWAYS rules + per-task instructions all in active locale.

6. **Send Request flow** — confirm:

   - G-24 (07-17 fix): Indoor/Outdoor segmented toggle renders DISTINCT translated labels — `घर के अंदर` vs `घर के बाहर` for hi-IN, both VISIBLE, neither truncated.
   - G-22 base: Cancel button reads complete (e.g. `रद्द करें` not truncated to `रद`).

7. **RecordingScreen Practice flow (G-25, G-26, G-27, G-15 dedicated walk):**

   - Navigate to PracticeIntroScreen (likely Profile → Settings → "Practice recording" OR the onboarding flows practice entry — verify in MainTabs/RootNativeStack route at execution time).
   - Tap "Start practice" → on the RecordingScreen, immediately verify:
     - **G-25:** the app-bar reads in the ACTIVE LOCALE. For hi-IN: NOT `Practice — 60 sec`; should be the LLM regen of that string in Devanagari.
   - The rotation portrait → landscape — verify:
     - **G-26:** rotate prompt renders complete in active locale (no truncation; 2-line wrap holds; auto-shrink kicks in for the longest Devanagari/Indic forms).
   - When the camera opens and hands arent yet in frame — verify:
     - **G-27:** hand-gate prompt renders complete (2-line wrap) WITH compact line-height (no visible vertical gap between lines). For hi-IN: the prose reads as the spec form `2 सेकंड तक अपने हाथ फ़्रेम में रखें`, NOT the awkward form the LLM produced.
   - Once the gate passes (or use "Skip"):
     - Recording starts. Verify the initial 15-s preview is active.
     - After 15s, the surface dims to 5% brightness. Verify the eye-icon glyph + the tap-to-reveal hint:
       - **G-15 (07-17 fix):** the `tapToReveal` hint Text (`प्रीव्यू देखने के लिए स्क्रीन पर टैप करें` for hi-IN) renders COMPLETE (2-line wrap; no truncation at `टैप`).
   - Cover the lens to force a clean cancel (or Stop the recording) OR let it persist for the G-28 walk in step 9.

8. **RecordingScreen Real-task flow (G-18 + G-25 downstream sanity check):**

   - From TasksScreen → tap any task → tap "Start Recording" → on RecordingScreen, verify the app-bar task name reads in the active locale (taskI18n.ts wire from 07-16 — UNTOUCHED by 07-17).
   - Stop the recording (dont cancel — let it persist to History for the next step).

9. **HistoryScreen (G-20, G-21, G-22, G-28 Bucket C):**

   - Now History should have at least 1 row from step 7 or 8.
   - Verify G-28 (Bucket C): the row shows task name in active locale + `Uploaded at HH:MM` prefix translated + `FEEDBACK (COMING SOON)` eyebrow translated. Day-section header (TODAY / YESTERDAY / etc.) translated per 07-16 WARNING-9 decision.
   - If the row is the FIRST EVER recording, the empty-state copy is no longer visible — but the G-20 wire is verified by tapping the time-filter chip (step below).
   - Tap the time-filter chip → base FilterSheet opens. Verify:
     - G-21 (07-16): sheet title + 6 base options translated.
   - Tap "Custom range" (the 6th option). The Custom-range sub-sheet opens. Verify:
     - **G-21 (07-17 fix):** sub-sheet title `Custom range` translated; FROM/TO labels translated; "Pick a date" placeholders translated; error messages translated (if you can force an error by leaving dates blank + tapping Apply); Cancel button translated AND not truncating; Apply button translated AND not truncating.
   - Close the sheet. Verify:
     - **G-29 (07-17 disposition):** the bottom-tab History label reads `हिस्ट्री` (or active-locale equivalent), NOT `हिन्दी` (the language name). Take a fresh screenshot for the audit trail — name it `07-17-rewalk-evidence/{locale}/{step}-history-tab.png`.

10. **Help Center (sanity check from 07-16):** Profile → Help Center → verify the header bar title translates (07-16 TranslatedHeaderTitle pattern).

11. **Report a Problem (G-22 chip-text re-verify):** Profile → "Report a problem" → bottom sheet opens. Verify:

    - G-22 (07-17 fix): each category chips TEXT renders without overflow (wraps to 2 lines inside the chip if needed for long Devanagari forms).
    - G-22 (07-17 cross-cutting Button fix): Cancel button reads complete.

12. **CompatCheck (G-14 Bucket C — do ONCE for hi-IN; cross-locale parity is implied):**

    - This must be done on a FRESH INSTALL: `adb uninstall ai.humynlabs.capture.apk.debug` (note: the debug variant suffix; verify package name).
    - `adb install <path-to-fresh-APK>` (from Task 6 output).
    - Launch the app. Pick hi-IN on ChooseLanguage.
    - CompatCheck fires automatically on first launch (per Phase 2). Verify probe-label rows render complete Devanagari (no truncation). The 07-16 wire at CompatRunningScreen.tsx ~line 285 should hold.
    - This step ONLY needs to be done once across the entire 7-locale walk (the same numberOfLines + adjustsFontSizeToFit fix applies to all Indic locales).

13. **Record verdicts** for each gap above into the `07-HUMAN-UAT.md` re-walk matrix per the operators narration.

### G-29 dedicated investigation step (one-off, done during hi-IN walk):

During the hi-IN walk, the operator pauses on the HistoryScreen and visually compares the bottom-tab History label to the expected hi-IN.json value. The agent reads `jq -r .tabs.history apps/mobile/src/i18n/locales/hi-IN.json` → expected `"हिस्ट्री"`. Operator confirms (or refutes) that the rendered tab label matches.

- If match (expected) → G-29 = TRANSCRIPTION ERROR confirmed. NO code change. Verdict = PASS.
- If mismatch (the operator sees `हिन्दी` or some other value) → G-29 is a REAL bug. Surface to user with a fresh screenshot; 07-17 PAUSES and a 07-18 follow-on is triggered.

### Operator sign-off

When all 7 locales walked + G-13 verified + G-14 verified + G-29 confirmed, operator types one of:

- `"approved — 07-17 walk all PASS"` → Phase 7 is ready for 07-15 re-attempt.
- `"07-17 walk done — FAILs: {locale}/{gap}, ..."` → the agent files the failed gaps + routes to follow-on plan.

</rewalk_protocol>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-17-SUMMARY.md` documenting:
- The 16 gap closures + dispositions (G-13/G-14/G-19/G-28 Bucket C re-walks; G-15/G-17/G-20/G-21/G-22/G-24/G-25/G-26/G-27 fixes; G-29 transcription-error disposition).
- The Task 1 investigation finding for each of G-29 / G-25 / G-20 / G-22 / G-24 root causes.
- A grep evidence block confirming every English literal removed (the grep assertions from Tasks 2-4 acceptance criteria).
- The `pnpm i18n:validate` output snapshot post-regen + the 8 invariant-gate empty diffs.
- The Pixel 10a 7-locale hardware re-walk verdict from Task 7 (PASS/FAIL matrix).
- A note that 07-15 (paused) is now unblocked and can re-attempt its Bundle 1 + Bundle 2 + wrap-up walk.
- Manual override audit trail: the hi-IN G-27 prose surgical patch in `hi-IN.audit.json:manual_overrides[]`.
- A "lesson learned" block referencing memory `feedback_hardware_walk_beats_grep_gates.md` — the 07-16 closure agents passed every narrow grep gate AND the planners must_haves verifier, AND STILL 15 escapes shipped. 07-17s Task 7 hardware walk is the only true integration test; future plans must include the operator-walked task BEFORE claiming closure.
</output>
