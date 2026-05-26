---
phase: 07-multi-linguality-live-cam-feed
plan: 17
subsystem: ui
tags: [i18n, gap-closure, mobile, layout, overflow, devanagari, regression-sweep, rewalk]

# Dependency graph
requires:
  - phase: 07-multi-linguality-live-cam-feed
    provides: 'plan 07-16 — 86×8 taskCatalog wired through every render site + 34 new keys (the keystone closure 07-17 sweeps regressions for)'
  - phase: 07-multi-linguality-live-cam-feed
    provides: 'plans 07-01..07-15 — i18n runtime, locale bundles, reverseSearch shim, taskCatalog body, EN_TOKEN_ALIASES, TranslatedHeaderTitle pattern'
provides:
  - 'apps/mobile/src/i18n/locales/en.json — 12 new keys: history.empty.firstTime.bodyTail, history.filter.customRange.{title,from,to,placeholder,errorMissing,errorInverted,errorFuture,cancel,apply} (9), recording.practiceFallback; 1 renamed key history.filter.customRangeChip (was string customRange)'
  - 'apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json — LLM-regen via pnpm i18n:generate; all 7 audit sidecars refreshed; hi-IN.audit.json gains manual_overrides[] entry for the G-27 prose patch'
  - 'apps/mobile/src/screens/history/HistoryScreen.tsx — G-20 bodyTail wire + 2 filterChipLabel sites renamed to customRangeChip'
  - 'apps/mobile/src/screens/shared/FilterSheet.tsx — Layer16b useTranslation() + 9 t() wires + inline overflow guards on raw Cancel/Apply Text; OPTIONS array routes through customRangeChip'
  - 'apps/mobile/src/screens/recording/RecordingScreen.tsx — G-25 taskName fallback reordered AFTER useTranslation + locale-reactive; G-15 liveEyeHint overflow guards (actual fix this time vs 07-16 sibling); G-27 gatePrompt inline lineHeight: 20 override + minimumFontScale: 0.75 (ui/tokens.ts UNCHANGED)'
  - 'apps/mobile/src/screens/recording/components/RotatePrompt.tsx — G-26 minimumFontScale lowered 0.85 → 0.75 + paddingHorizontal: spacing.l on wrap'
  - 'apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx — G-25 PRACTICE_ROUTE_PARAMS no longer hardcodes taskName'
  - 'apps/mobile/src/components/TaskCategoryPills.tsx — G-17 pill Text overflow guards + pill/pillActive paddingHorizontal reduced spacing.l → spacing.m + content contentContainerStyle paddingRight: spacing.xl + spacing.m'
  - 'apps/mobile/src/components/ReportProblemSheet.tsx — G-22 chip Text numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85}'
  - 'apps/mobile/src/screens/tasks/SendRequestSheet.tsx — G-24 BOTH segmented Text elements numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}'
  - 'apps/mobile/src/ui/primitives/Button.tsx — G-22 cross-cutting internal Text overflow guards (every Button consumer inherits)'
  - 'apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts — permanent regression guard: t(setting.indoor) !== t(setting.outdoor) across all 8 locales'
  - 'apps/mobile/__tests__/ui/Button.numberOfLines.test.tsx — 4 assertions: source-grep for the 3 overflow props + long Devanagari smoke + short en regression + accessibilityLabel override pattern'
  - '4 other new test files: HistoryScreen.emptyTail.i18n + FilterSheet.customRange.i18n + RecordingScreen.practiceFallback.i18n + indoorOutdoorCollision'
  - '.planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md — Task 1 root-cause record for G-25/G-29/G-20/G-22/G-24'
affects: [Phase-07 plan 07-15 re-attempt (currently paused; unblocked after Task 7 PASSES)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Operator-walked re-walk before claiming closure: memory `feedback_hardware_walk_beats_grep_gates` is the canonical reference. The 07-16 closure agents passed every grep gate AND the planner verifier AND STILL 15 escapes shipped. 07-17 pairs both grep gates AND the operator hardware walk (Task 7) as the integration test.'
    - 'Two-site overflow guard for hi-IN btnLabel: the shared Button primitive carries the cross-cutting fix, BUT FilterSheet Custom-range Cancel/Apply use raw <Pressable>+<Text> (not the primitive) — same triplet inlined at the raw Text call sites to keep visual parity.'
    - 'Post-LLM-regen surgical patch with audit trail: when an LLM regen produces an awkward locale form (G-27 hi-IN prose), patch via jq and record the override in the audit sidecar manual_overrides[] array so future regens know to either preserve or re-apply.'
    - 'Schema-breaking child rename for adding sub-keys: when an existing string-valued key needs to become an object, rename the original to {keyName}Chip (or analogous) first, then add the new object. Atomic with the source-consumer renames; the LLM regen handles the propagation across non-en catalogs.'

key-files:
  created:
    - '.planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md'
    - 'apps/mobile/__tests__/screens/history/HistoryScreen.emptyTail.i18n.test.tsx (4 tests)'
    - 'apps/mobile/__tests__/screens/shared/FilterSheet.customRange.i18n.test.tsx (8 tests)'
    - 'apps/mobile/__tests__/screens/recording/RecordingScreen.practiceFallback.i18n.test.tsx (6 tests)'
    - 'apps/mobile/__tests__/ui/Button.numberOfLines.test.tsx (4 tests)'
    - 'apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts (8 tests, one per locale)'
  modified:
    - 'apps/mobile/src/i18n/locales/en.json (+12 new keys + 1 renamed key)'
    - 'apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json (LLM-regen for the 12 new + 1 renamed key)'
    - 'apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.audit.json (regen audit sidecars; hi-IN gains manual_overrides[] entry for G-27)'
    - 'apps/mobile/src/screens/history/HistoryScreen.tsx (G-20 bodyTail wire + 2 customRangeChip rename sites)'
    - 'apps/mobile/src/screens/shared/FilterSheet.tsx (G-21 9 t() wires + G-22 inline Cancel/Apply overflow guards)'
    - 'apps/mobile/src/screens/recording/RecordingScreen.tsx (G-25 reorder + G-15 + G-27)'
    - 'apps/mobile/src/screens/recording/components/RotatePrompt.tsx (G-26)'
    - 'apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx (G-25 PRACTICE_ROUTE_PARAMS taskName dropped)'
    - 'apps/mobile/src/components/TaskCategoryPills.tsx (G-17)'
    - 'apps/mobile/src/components/ReportProblemSheet.tsx (G-22 chip)'
    - 'apps/mobile/src/screens/tasks/SendRequestSheet.tsx (G-24)'
    - 'apps/mobile/src/ui/primitives/Button.tsx (G-22 cross-cutting)'
    - 'apps/mobile/__tests__/screens/HistoryScreen.i18n.test.tsx (post-rename assertion update)'
    - 'apps/mobile/__tests__/screens/shared/FilterSheet.i18n.test.tsx (post-rename assertion update)'
    - 'apps/mobile/__tests__/screens/PracticeIntroScreen.test.tsx (auto-fix: PRACTICE_PARAMS const drops taskName)'
    - 'apps/mobile/__tests__/screens/practiceFlow.test.tsx (auto-fix: PRACTICE_PARAMS const drops taskName)'

key-decisions:
  - "G-29 dispositioned as TRANSCRIPTION ERROR by Task 1 investigation (no code change). Task 7 hardware walk confirms via fresh screenshot. The actual hi-IN.json `tabs.history` value is `हिस्ट्री` (correctly transliterated); BottomNav routes via t(tab.labelKey); the only file containing `हिन्दी` is `locale-meta.ts` (LOCALE_NATIVE_NAMES — the language name registry, distinct from the tab label). The operator's matrix entry in 07-HUMAN-UAT.md was a transcription mistake when reading screenshot 3.png."
  - 'G-22 two-site fix (Button primitive cross-cutting + FilterSheet Custom-range inline). The plan-checker BLOCKER 3 verified `grep -c "<Button" FilterSheet.tsx` = 0; the Custom-range Cancel/Apply use raw `<Pressable>+<Text variant="btnLabel">`, NOT the shared Button primitive. The Task 3 Button primitive change does NOT propagate to FilterSheet; the same overflow guard triplet (numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}) is INLINED on both raw Text elements. Result: hi-IN `रद्द करें` / `अप्लाई` render identically across Button-consumer and raw-Pressable sites.'
  - "G-24 reclassified as TRUNCATION, not collision. hi-IN values `घर के अंदर` / `घर के बाहर` are DISTINCT (planner-time + Task 1 jq probe confirmed). Both share the 3-char prefix `घर के`; without overflow guards both pills truncate at the same boundary producing the operator's perceived `घर के / घर के` collision. Fix: numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75} on both segmented Text elements + a permanent Vitest regression test (indoorOutdoorCollision.test.ts) asserting distinctness across all 8 SUPPORTED_LOCALES."
  - "G-27 ui/tokens.ts:recGatePrompt variant UNTOUCHED. The 24px lineHeight on 17px fontSize (~141% leading) is consumed by other call sites that prefer that vertical spacing. The fix is an INLINE `style={[styles.gatePrompt, { lineHeight: 20 }]}` (~118% leading) ONLY at the RecordingScreen gatePrompt call site. minimumFontScale lowered 0.85 → 0.75 to match G-26's Indic-language floor."
  - 'G-27 hi-IN prose surgical patch (Task 5c). The LLM regen kept the awkward form the operator flagged in 07-16. Patched via jq to the spec form `2 सेकंड तक अपने हाथ फ़्रेम में रखें`; hi-IN.audit.json gains a `manual_overrides[]` entry (key + reason + date + plan). Future LLM regens will need to either preserve or re-apply this override.'
  - 'history.filter.customRange schema-breaking child rename. Existing string `"customRange": "Custom range"` renamed to `customRangeChip` (preserves the chip-versus-sub-sheet semantic distinction); the new `customRange` becomes an OBJECT with 9 sub-keys. Atomic source-consumer updates (FilterSheet.tsx:65 + HistoryScreen.tsx:142,146) ship in the same commit. Plan-checker verified 3 consumer sites; no out-of-scope consumers surfaced.'

patterns-established:
  - 'Pattern 82: post-LLM-regen surgical override with audit trail. When the regen produces an awkward locale form, patch the locale.json via jq AND record the override in `{locale}.audit.json:manual_overrides[]` with key + reason + date + plan. Future regens of the same key know to preserve or re-apply. Mirrors the 07-16 N-NEW-2 lesson: do NOT run `pnpm i18n:validate` between Task 2 (en.json key add) and Task 5 (LLM regen) — shape parity is intentionally broken in that window.'
  - 'Pattern 83: schema-breaking child rename for adding sub-keys to an existing string-valued key. Rename the string to `{keyName}Chip` (or analogous semantic suffix) to preserve the original meaning, then add the new object-valued `{keyName}` containing the new sub-keys. Source consumers + tests update atomically.'

requirements-completed: [I18N-01, I18N-11]

# Metrics
duration: ~120min
completed: 2026-05-27
---

# Phase 7 Plan 17: i18n regression sweep — Summary

**Closed 9 regression FAIL rows + 4 Bucket C deferrals + 1 transcription-error disposition from the 07-16 hi-IN hardware walk. Fresh APK built at commit `85645d7`; awaiting operator's 7-locale Pixel 10a re-walk (Task 7) to confirm closure.**

## Performance

- **Duration:** ~120 minutes (Tasks 1-6 code-level; Task 7 operator walk pending)
- **Started:** 2026-05-26T23:50:00Z (Task 1 commit timestamp)
- **Completed (code-level Tasks 1-6):** 2026-05-27T00:55:00Z (APK build commit)
- **Tasks (code-level):** 6 of 7 (Task 7 is the operator-walked checkpoint, deferred per `<checkpoint_handling>`)
- **Files modified:** 23 (12 mobile src + 7 locale JSON + 7 audit JSON + 4 test files updated)
- **Files created:** 6 (5 test files + 1 INVESTIGATION doc)
- **Commits:** 5 (1 docs + 4 feat; Task 6 is verification-only, no commit)
- **APK build:** SUCCESSFUL in 6m 19s; 263 MB at `apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`

## Accomplishments

- **All 5 root causes confirmed in Task 1 investigation** matching the handoff's expected fix paths (G-25 / G-29 / G-20 / G-22 / G-24). Zero divergences, proceed-not-PAUSE decision.
- **G-20 closed:** HistoryScreen.tsx:599 JSX literal ` and try one.` moves into new key `history.empty.firstTime.bodyTail` with leading space preserved.
- **G-21 closed:** FilterSheet Custom-range sub-sheet (lines 280-388) — 9 hardcoded English literals route through `t('history.filter.customRange.*')`; existing string key `customRange` renamed to `customRangeChip` to make room for the 9-sub-key object.
- **G-22 closed at TWO sites:** (a) shared Button primitive (`Button.tsx:85`) gains numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75} — cross-cutting benefit for every Button consumer (ReportProblem + ~30 other call sites); (b) FilterSheet Custom-range Cancel + Apply raw Text elements gain the SAME triplet INLINE (Task 2). Plus G-22 chip text: ReportProblemSheet chip Text gains numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85} for in-chip 2-line wrap on long Devanagari labels.
- **G-24 closed (TRUNCATION not collision):** SendRequestSheet Indoor/Outdoor segmented Text elements (BOTH) gain numberOfLines={1} + adjustsFontSizeToFit + minimumFontScale={0.75}. Permanent Vitest regression test guards distinctness across 8 SUPPORTED_LOCALES.
- **G-25 closed:** 3-part fix — en.json `recording.practiceFallback` added; PracticeIntroScreen.tsx PRACTICE_ROUTE_PARAMS drops hardcoded `taskName`; RecordingScreen.tsx reorders `const taskName = ...` to AFTER `const { t, i18n } = useTranslation()` and changes the fallback to `t('recording.practiceFallback')` — locale-reactive.
- **G-15 closed (the actual bug site this time):** RecordingScreen.tsx:1005-1012 liveEyeHint Text (the "Tap screen to preview" hint during dimmed state) gains numberOfLines={2} + adjustsFontSizeToFit + minimumFontScale={0.85}. Distinct from the sibling liveLabelText that 07-16 fixed.
- **G-17 closed:** TaskCategoryPills pill Text overflow guards + pill/pillActive paddingHorizontal reduced (spacing.l → spacing.m) + content contentContainerStyle paddingRight: spacing.xl + spacing.m for the rightmost-pill safe-area.
- **G-26 closed:** RotatePrompt body Text minimumFontScale lowered 0.85 → 0.75; `styles.wrap` gains paddingHorizontal: spacing.l for horizontal slack.
- **G-27 closed:** RecordingScreen gatePrompt INLINE `style={[styles.gatePrompt, { lineHeight: 20 }]}` override + minimumFontScale lowered 0.85 → 0.75. `ui/tokens.ts:recGatePrompt` STAYS UNCHANGED. Plus the hi-IN prose surgical patch (Task 5c) replaces the LLM's awkward form with the spec form `2 सेकंड तक अपने हाथ फ़्रेम में रखें`; `hi-IN.audit.json` gains a manual_overrides[] entry.
- **G-29 dispositioned as TRANSCRIPTION ERROR:** the actual hi-IN.json `tabs.history` value is `हिस्ट्री` (correctly transliterated Hindi for "History"); BottomNav routes via `t(tab.labelKey)`; only file containing `हिन्दी` (language name) is `locale-meta.ts:LOCALE_NATIVE_NAMES`. NO code change for G-29; Task 7 hardware walk confirms via fresh screenshot.
- **7 non-English catalogs LLM-regen'd:** `pnpm i18n:generate` ran 7 sequential calls to Claude Opus 4.7 (~25 min total). `pnpm i18n:validate` reports OK across all 8 catalogs post-regen. hi-IN G-27 prose patch applied via jq + manual_overrides[] entry recorded.
- **APK build SUCCESSFUL:** `:app:assembleApkRolloutDebug` BUILD SUCCESSFUL in 6m 19s on JDK 17. APK 263 MB at `apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`. Pixel 10a `5C161JEA304304` paired via adb.
- **All 8 invariant gates green** vs `main` HEAD: apps/api/ empty / apps/mobile/ios/ vacuous (dir not in repo) / HevcEncoder + FinalizeWorker + MetadataComposer + CaptureSession.kt empty / ttsVoice.ts empty / RigTutorialScreen.tsx empty / taskCatalog.i18n.ts empty / ui/tokens.ts empty / 06-COSMETIC-GAPS.md empty (strict main-base comparison; no relaxation since 07-17 has no renumber-sweep pretext).

## Task Commits

Each task committed atomically. Task 6 is verification-only (no source changes). Task 7 is the operator-walked checkpoint, deferred.

1. **Task 1: investigation (G-25 / G-29 / G-20 / G-22 / G-24 root causes)** — `9bed0eb` (docs)
2. **Task 2: G-20 + G-21 wires (history.empty.firstTime.bodyTail + FilterSheet Custom-range sub-sheet 9 keys)** — `e657c92` (feat, TDD: test first, then 3 source files + schema rename across 5 source/test sites)
3. **Task 3: G-25 + G-22 (practice fallback + Button primitive cross-cutting overflow guards)** — `48b75bc` (feat, TDD: test first, then 4 source files; reorder `useTranslation()` BEFORE the taskName fallback)
4. **Task 4: G-15 + G-17 + G-22(chip) + G-24 + G-26 + G-27 — 6 Bucket B layout fixes** — `05a65f4` (feat; 5 files, all inline overflow-guard / leading / padding edits; ui/tokens.ts UNCHANGED)
5. **Task 5: collision regression test + LLM regen 7 non-en + hi-IN G-27 prose patch** — `85645d7` (feat; collision test guards future regens; 7 non-en + 7 audit; hi-IN gains manual_overrides[] entry; auto-fix: 2 existing test files update for the Task 3 PRACTICE_ROUTE_PARAMS shape change)

**No Task 6 commit** — Task 6 is full regression sweep + APK build; produces no source changes (verification only). The APK build output lives at `apps/mobile/android/app/build/outputs/apk/apkRollout/debug/` (not committed; build artifact).

**Pending:**

- **Task 7 (operator-walked):** Full 7-locale hardware re-walk on Pixel 10a `5C161JEA304304`. Awaiting operator's verbal sign-off after the canonical walk sequence in `<rewalk_protocol>` (Plan 07-17). Locale order LOCKED per memory `feedback_walk_locale_order`: hi-IN → pt-BR → es → bn-IN → ta-IN → te-IN → mr-IN. Owner directive 2026-05-26 17:30 IST: "i want to do full deep walk, skip nothing."

## Files Created/Modified

See frontmatter `key-files.created` + `key-files.modified` lists above. Highlights:

- **NEW `apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts`** — permanent regression guard; 8 locales × distinctness assertion (~22 LOC).
- **NEW `.planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md`** — Task 1 root-cause record (~246 lines); 5 H2 sections + TL;DR + invariant pre-check + Proceed/PAUSE decision + Out-of-scope finds.
- **EXTENDED `apps/mobile/src/i18n/locales/en.json`** — +12 new keys + 1 renamed (`history.filter.customRange` string → `customRangeChip` string; new `customRange` object holds 9 sub-keys).
- **EXTENDED `apps/mobile/src/i18n/locales/hi-IN.audit.json`** — gains `manual_overrides[]` array with the G-27 prose patch entry.
- **7 non-en locale JSONs** — fully regenerated via `pnpm i18n:generate`; shape parity validated; hi-IN gets the surgical G-27 patch.

## Decisions Made

(Captured in frontmatter `key-decisions`; reproduced briefly here.)

- **G-29 = TRANSCRIPTION ERROR, no code change.** Task 1 investigation found the hi-IN.json `tabs.history` value is correctly `हिस्ट्री`; the operator's matrix entry read the screenshot wrong. Task 7 hardware walk takes a fresh screenshot for the audit trail.
- **G-22 two-site fix (Button primitive cross-cutting + FilterSheet Custom-range inline).** FilterSheet has zero `<Button>` consumers (grep verified); same overflow-guard triplet inlined at the two raw Text sites to keep visual parity.
- **G-24 = TRUNCATION not collision.** hi-IN values are DISTINCT; both share `घर के` prefix → both truncate at the same boundary → visual "collision". Fix: overflow guards + regression test guarding distinctness across 8 locales.
- **ui/tokens.ts:recGatePrompt variant UNTOUCHED.** G-27 lineHeight override is INLINE at the RecordingScreen JSX call site only; other variant consumers stay at 24px leading.
- **Post-LLM-regen surgical patch with audit trail.** hi-IN `recording.gatePrompt` patched to the spec form `2 सेकंड तक अपने हाथ फ़्रेम में रखें`; `hi-IN.audit.json:manual_overrides[]` records the override (key + reason + date + plan).
- **Schema-breaking child rename `customRange` → `customRangeChip` + new object `customRange`.** Plan-checker verified 3 consumer sites; atomic source + test updates land in the same commit (Task 2).

## Deviations from Plan

Tasks 1–6 executed exactly as the plan specified at the behavior level. A handful of test-shim updates were applied automatically per Rule 1 + Rule 3 once the Task 3 PRACTICE_ROUTE_PARAMS shape change rippled through pre-existing tests.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing practice-flow tests asserted PRACTICE_PARAMS shape with taskName**

- **Found during:** Task 5 (post-Task-3-refactor; the Task 3 G-25 fix dropped `taskName` from `PRACTICE_ROUTE_PARAMS` in PracticeIntroScreen.tsx)
- **Issue:** `apps/mobile/__tests__/screens/PracticeIntroScreen.test.tsx` Tests 4 + 5 and `apps/mobile/__tests__/screens/practiceFlow.test.tsx` Test (b) all assert `parent.replace('Recording', PRACTICE_PARAMS)` with `PRACTICE_PARAMS = { taskId, taskName: 'Practice — 60 sec', isPractice }` — the new shape is `{ taskId, isPractice }` (taskName intentionally omitted so the recipient screen's t() fallback wins).
- **Fix:** Both PRACTICE_PARAMS consts drop the `taskName` field; both files gain a G-25 (Plan 07-17) comment line explaining the omission and pointing at the new fallback contract. The visible app behavior is unchanged; only the test contract aligns to the new implementation.
- **Files modified:** `apps/mobile/__tests__/screens/PracticeIntroScreen.test.tsx`, `apps/mobile/__tests__/screens/practiceFlow.test.tsx`
- **Verification:** All 17 affected tests now PASS (PracticeIntroScreen 5/5 + practiceFlow 12/12 across both files post-fix).
- **Committed in:** `85645d7` (Task 5 commit, alongside the LLM regen + collision regression test).

### Other deviations

None. The five Task 1 investigation hypotheses all matched the handoff's expected fix paths exactly; no PAUSE was needed.

## Issues Encountered

- **`tools/.env` + `apps/api/.env` not in worktree.** Same as 07-16 — the worktree was spawned without the env files. Copied from main repo (`/Users/adnaan/Documents/hl-homelander/{tools,apps/api}/.env` → worktree). One-time setup; not a permanent issue.
- **node_modules + tools/node_modules + apps/mobile/node_modules missing in fresh worktree.** Ran `pnpm install --frozen-lockfile` at root + `npm ci` in `apps/mobile/` + `npm ci` in `tools/` to populate. One-time setup.
- **gitignored Android build files not in worktree.** `apps/mobile/android/local.properties` + `apps/mobile/android/app/src/apkRollout/google-services.json` were missing. Copied from main repo (gitignored per design). Required for the `:app:assembleApkRolloutDebug` build to succeed.
- **2 pre-existing visual-snapshot test failures** on `RecordingScreen.visual.test.tsx > matches baseline (recording-active-t10s | t05m32s)`. Pre-existing per `deferred-items.md` (the 2026-05-26 entry); confirmed by reproducing on `main` HEAD. Out of scope for 07-17; not introduced by this plan's changes. Both touch the `RecordingScreen` visual baseline PNG — likely drifted relative to the calibration / metadata schema 1.2.0 banner from 2026-05-22. Documented but not fixed.
- **17 pre-existing Kotlin unit-test failures** in `DeviceCapsTest` / `EncoderProbeTest` / `ImuProbeTest` / `NalParserTest` / `HumynHandDetectorModuleTest` — Robolectric SoLoader bootstrap NPE on capture/handdetector pipeline tests. The `EncoderProbeTest` failure is explicitly documented in `deferred-items.md` (2026-05-25 entry); the others share the same pre-existing pattern. **Confirmed on main HEAD: same 17 failures.** Plan 07-17's `git diff --stat main..HEAD -- apps/mobile/android/` returns ZERO Kotlin/Java changes (invariant gate green); these are infrastructure pre-existing, NOT introduced.

## User Setup Required

None — all changes are bundled at build time. The `tools/.env` ANTHROPIC_API_KEY is the owner's existing setup (not introduced by this plan).

## Known Stubs

None. Every helper / locale value introduced by this plan resolves to a non-empty real string in all 8 catalogs.

## Self-Check

```
FOUND: .planning/phases/07-multi-linguality-live-cam-feed/07-17-INVESTIGATION.md
FOUND: apps/mobile/__tests__/i18n/indoorOutdoorCollision.test.ts
FOUND: apps/mobile/__tests__/screens/history/HistoryScreen.emptyTail.i18n.test.tsx
FOUND: apps/mobile/__tests__/screens/shared/FilterSheet.customRange.i18n.test.tsx
FOUND: apps/mobile/__tests__/screens/recording/RecordingScreen.practiceFallback.i18n.test.tsx
FOUND: apps/mobile/__tests__/ui/Button.numberOfLines.test.tsx
FOUND: apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk (263 MB)
FOUND: commit 9bed0eb (Task 1)
FOUND: commit e657c92 (Task 2)
FOUND: commit 48b75bc (Task 3)
FOUND: commit 05a65f4 (Task 4)
FOUND: commit 85645d7 (Task 5)
```

## Self-Check: PASSED

## Next Phase Readiness

- **07-17 code-level complete (Tasks 1-6).** All 9 regression FAIL rows from 07-16's hi-IN walk closed at the source level. 4 Bucket C deferrals are ready for the hardware re-walk on real device. G-29 is dispositioned as transcription error.
- **Task 7 (operator-walked) is the next action.** Owner directive (verbatim, 2026-05-26 17:30 IST): "i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device." APK ready at commit `85645d7`. Pixel 10a paired.
- **After Task 7 PASSES:** Plan 07-15 (paused) re-attempts its Bundle 1 + Bundle 2 + wrap-up walk to finalize Phase 7.
- **Lesson learned (re-affirmed from 07-16):** Memory `feedback_hardware_walk_beats_grep_gates.md` is the canonical reference. The 07-16 closure agents passed every grep gate AND the planner verifier AND STILL 15 escapes shipped. 07-17's Tasks 1-6 pair both grep gates AND a thorough Task 1 investigation; Task 7 (operator-walked) is THE integration test. Future plans must include the operator-walked task BEFORE claiming closure.

## Threat Flags

None. The plan's `<threat_model>` covers the LLM translation pipeline (already mitigated by `validate.ts`), the manual override audit trail (mitigated by hi-IN.audit.json:manual_overrides[]), the cross-cutting Button primitive change (mitigated by Button.numberOfLines.test.tsx), and the Indoor/Outdoor collision regression risk (mitigated by indoorOutdoorCollision.test.ts). No new security-relevant surface introduced.

---

_Phase: 07-multi-linguality-live-cam-feed_
_Plan: 17_
_Completed (code-level, Tasks 1-6): 2026-05-27 00:55:00 UTC_
_Task 7 (hardware walk): pending operator_
