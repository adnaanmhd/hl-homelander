---
phase: 07-multi-linguality-live-cam-feed
plan: 13
subsystem: i18n
tags: [i18n, llm, claude-opus-4-7, help-center, markdown, tools, gap-closure]

# Dependency graph
requires:
  - phase: 07-multi-linguality-live-cam-feed
    provides: i18n runtime (07-01), screen-string LLM regen pattern (07-02 generate.ts), screen sweep + chrome t() calls in HelpCenterScreen (07-05)
provides:
  - apps/mobile/src/screens/help/contentLoader.ts (per-locale Help Center body loader)
  - 7 sibling content.{loc}.json files (LLM-translated Help Center body via Claude Opus 4.7)
  - tools/i18n/help-content-generate.ts + help-content-prompts.ts (repeatable LLM regen tool)
  - tools/i18n/__tests__/help-content-generate.test.ts (17 validator/parser unit tests)
  - apps/mobile/__tests__/screens/help/contentLoader.test.ts (loader contract tests)
  - apps/mobile/src/screens/help/content.audit.json (model + brief version + en sha + per-locale timestamps)
affects:
  [
    07-15 (operator's §help-walk re-walk closes G-10 on hardware),
    future passes that add Help Center copy,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Sibling-file i18n pattern for content-heavy markdown bodies (avoids 200+ flat t() keys)'
    - 'Per-locale static imports for tree-shake-able runtime selection (Metro)'
    - 'Empty-array fallback guard against partial-regen failure mode (POST-CHECKER-REV WARNING #3)'
    - 'Shape-parity validator with per-item kind enforcement (subsection|qa|issue tagged union)'

key-files:
  created:
    - tools/i18n/help-content-generate.ts
    - tools/i18n/help-content-prompts.ts
    - tools/i18n/__tests__/help-content-generate.test.ts
    - apps/mobile/src/screens/help/contentLoader.ts
    - apps/mobile/__tests__/screens/help/contentLoader.test.ts
    - apps/mobile/src/screens/help/content.pt-BR.json
    - apps/mobile/src/screens/help/content.es.json
    - apps/mobile/src/screens/help/content.hi-IN.json
    - apps/mobile/src/screens/help/content.bn-IN.json
    - apps/mobile/src/screens/help/content.ta-IN.json
    - apps/mobile/src/screens/help/content.te-IN.json
    - apps/mobile/src/screens/help/content.mr-IN.json
    - apps/mobile/src/screens/help/content.audit.json
  modified:
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (3 lines: import swap + loader call)
    - tools/package.json (1 script added)

key-decisions:
  - 'Validator enforces the REAL content.json shape (tagged-union items + contactSupport object), not the simplified <interfaces> sketch in the plan — silently allowing items[] drift would defeat the point of the validator'
  - 'Test location moved from apps/mobile/src/screens/help/__tests__/ to apps/mobile/__tests__/screens/help/ — mobile vitest.config.ts only discovers tests rooted at __tests__/ (Rule-3 deviation)'
  - 'Empty-array guard in contentLoader.ts returns enContent rather than rendering a blank Help Center — covers Task-1 stub state AND any future LLM regen that silently empties a locale'

patterns-established:
  - 'For content-heavy markdown bodies (Help Center, future docs surfaces), prefer the sibling-file pattern over flattening into t() keys — preserves authoring ergonomics and lets the LLM translate larger context blocks atomically'
  - 'Per-locale static imports + Record lookup gives Metro tree-shake-ability AND a runtime fallback for unknown/empty locales'

requirements-completed: [I18N-01]

# Metrics
duration: 37min
completed: 2026-05-26
---

# Phase 07 Plan 13: Help Center Body Translation Summary

**7 Help Center sibling content files generated via Claude Opus 4.7, runtime-selected by `loadHelpContent(i18n.language)`, with shape-parity validator + empty-array fallback guard — closes G-10 (Help Center renders in active locale).**

## Performance

- **Duration:** 37 min
- **Started:** 2026-05-26T09:48:53Z
- **Completed:** 2026-05-26T10:26:17Z
- **Tasks:** 2 (Task 1: tool plumbing + loader; Task 2: LLM regen)
- **Files created:** 13
- **Files modified:** 2

## Accomplishments

- `tools/i18n/help-content-generate.ts` — Claude Opus 4.7 regen tool for the Help Center body, runnable via `pnpm i18n:help-content:generate` from `tools/`. Validates accordion count + per-accordion id + per-item kind + kind-specific string fields + contactSupport shape before writing.
- `apps/mobile/src/screens/help/contentLoader.ts` — runtime per-locale selector with static imports of all 8 catalogs (en + 7 translated). Empty-array guard returns `enContent` for stub state OR a partial-regen failure mode.
- 7 sibling `content.{loc}.json` files translated by the LLM with markdown preservation (50 `**bold**` markers in every locale — drift = 0 vs en). hi-IN body contains 6,508 Devanagari characters.
- `content.audit.json` records `claude-opus-4-7` model, brief_version=1, en sha256, and per-locale ISO completion timestamps.
- `HelpCenterScreen.tsx` swaps the static `import content from './content.json'` for `loadHelpContent(i18n.language)`. The 4 existing chrome `t()` calls (`help.contactSupport`, `help.reportProblem`) are unchanged. JSX is unchanged.

## Task Commits

Each task was committed atomically; Task 1 follows the TDD RED/GREEN discipline:

1. **Task 1 RED: failing tests for validator + contentLoader** — `0c4304c` (test)
2. **Task 1 GREEN: tool plumbing + loader + stub siblings + screen wiring** — `13d7500` (feat)
3. **Task 2: LLM regen — 7 locales × 38 items + audit sidecar** — `f9deb9d` (feat)

_Note: TDD RED + GREEN gates both present in commit log per the plan's `type="auto" tdd="true"` directive on Task 1._

## Files Created/Modified

### Created (13)

- `tools/i18n/help-content-generate.ts` — LLM regen entrypoint + validator + parser.
- `tools/i18n/help-content-prompts.ts` — `HELP_CONTENT_VERNACULAR_BRIEF` (reuses D-10 register + adds markdown-preservation rules) + `helpContentUserPromptFor()`.
- `tools/i18n/__tests__/help-content-generate.test.ts` — 17 tests covering shape rejection (non-object, null, accordions missing, count drift, id drift, item-count drift, kind drift, type drift on every kind's string fields, contactSupport missing, headline non-string) + fence-strip (json / bare / malformed).
- `apps/mobile/src/screens/help/contentLoader.ts` — `loadHelpContent(locale)` with REGISTRY + empty-array guard.
- `apps/mobile/__tests__/screens/help/contentLoader.test.ts` — en byte-equality, every supported non-en locale defined, unknown/empty locale fallback, partial-regen guard sanity.
- `apps/mobile/src/screens/help/content.{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` — 7 LLM-translated sibling bodies.
- `apps/mobile/src/screens/help/content.audit.json` — regen provenance.

### Modified (2)

- `apps/mobile/src/screens/help/HelpCenterScreen.tsx` — import swap (3-line delta) + 4 lines inside the component body (read `i18n` from `useTranslation()`, call `loadHelpContent(i18n.language)`, derive `ACCORDIONS` per-render).
- `tools/package.json` — adds `"i18n:help-content:generate": "tsx i18n/help-content-generate.ts"`.

## Per-Locale Verification

| Locale | Accordions | Items | contactSupport.headline len | contactSupport.body len | `**` bold count |
| ------ | ---------- | ----- | --------------------------- | ----------------------- | --------------- |
| en     | 3          | 38    | 14                          | 152                     | 50              |
| pt-BR  | 3          | 38    | 22                          | 256                     | 50              |
| es     | 3          | 38    | 21                          | 237                     | 50              |
| hi-IN  | 3          | 38    | 13                          | 222                     | 50              |
| bn-IN  | 3          | 38    | 18                          | 236                     | 50              |
| ta-IN  | 3          | 38    | 20                          | 234                     | 50              |
| te-IN  | 3          | 38    | 17                          | 233                     | 50              |
| mr-IN  | 3          | 38    | 15                          | 230                     | 50              |

Shape parity: every locale matches en exactly on accordion count, item count per accordion (validator enforces id + kind match byte-for-byte). Bold-marker drift = 0 across all 7 locales. hi-IN Devanagari character count = 6,508.

## Sample Translation (3-sentence sanity)

**en — Instructions Guide → "While recording":**

> Keep your hands in frame as much as possible. Follow the per-task instructions on the task screen (gaze direction, pacing, what to focus on). The screen dims to save battery and reduce heat.

**hi-IN — same field:**

> कोशिश करें कि हाथ ज़्यादा से ज़्यादा फ्रेम में रहें। टास्क स्क्रीन पर दिए गए निर्देशों का पालन करें (कहां देखना है, गति, किस पर ध्यान देना है)। बैटरी बचाने और गर्मी कम करने के लिए स्क्रीन मद्धम हो जाती है।

**pt-BR — same field:**

> Mantenha as mãos no enquadramento o máximo possível. Siga as instruções de cada tarefa que aparecem na tela (direção do olhar, ritmo, no que focar). A tela escurece para economizar bateria e reduzir o calor.

**Accordion titles:**

| en                 | hi-IN                     | pt-BR                |
| ------------------ | ------------------------- | -------------------- |
| Instructions Guide | रिकॉर्डिंग गाइड           | Guia de Instruções   |
| FAQs               | अक्सर पूछे जाने वाले सवाल | Perguntas Frequentes |
| Troubleshooting    | समस्याएं और समाधान        | Solução de Problemas |

## Chrome `t()` Calls — Unchanged

The 4 existing `t()` calls in `HelpCenterScreen.tsx` are intentionally untouched per plan invariant:

- `t('help.contactSupport')` — Contact Support button label
- `t('help.reportProblem')` — Report a Problem button label

These resolve via `apps/mobile/src/i18n/locales/{locale}.json` (plan 07-11 scope), NOT via the contentLoader. The contentLoader only delivers the article BODY (titles + items + contactSupport.headline/body).

## Decisions Made

- **Validator shape matches the real content.json, not the plan's simplified sketch.** Plan's `<interfaces>` block showed `accordions[{id,title,body}]`, but the real shape has `accordions[{id,title,items[]}]` where `items[]` is a tagged union of `kind: 'subsection' | 'qa' | 'issue'` each with different field names, plus a top-level `contactSupport` object. A validator that only enforced the simplified shape would silently accept LLM hallucinations that dropped items or swapped kinds — defeating the entire point of the gate. Implemented the validator for the real shape; documented as a deviation below.
- **Test location moved.** Mobile vitest.config.ts only discovers tests rooted at `apps/mobile/__tests__/` (not co-located under `src/`). Plan specified `apps/mobile/src/screens/help/__tests__/contentLoader.test.ts` but that path would be silently skipped. Relocated to `apps/mobile/__tests__/screens/help/contentLoader.test.ts` matching the existing sibling `__tests__/screens/HelpCenterScreen.test.tsx`.
- **`pnpm i18n:help-content:generate` runs from `tools/`** (not repo root) — `tools/` is intentionally excluded from `pnpm-workspace.yaml` (mobile-on-npm decision) so its scripts aren't reachable via `pnpm -r`. The plan's verbatim script name `i18n:help-content:generate` was kept (vs orchestrator's hint `i18n:generate:help-content`) for fidelity to the plan's contract.
- **Static imports + empty-array guard (vs dynamic `require`).** Static imports give Metro tree-shake-ability + immediate TS validation; the empty-array guard handles the brief Task-1 stub state (and any future partial-regen quota error) by falling back to en.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test file relocated so vitest discovers it**

- **Found during:** Task 1 (writing the failing contentLoader test)
- **Issue:** The plan specifies `apps/mobile/src/screens/help/__tests__/contentLoader.test.ts`, but `apps/mobile/vitest.config.ts` sets `include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx']` — a glob rooted at the workspace root. Tests anywhere under `src/` are silently skipped. A test that never runs cannot enforce its contract.
- **Fix:** Wrote the test at `apps/mobile/__tests__/screens/help/contentLoader.test.ts` instead, matching the existing sibling `__tests__/screens/HelpCenterScreen.test.tsx`. Adjusted import paths (`../../../src/screens/help/contentLoader`).
- **Files modified:** `apps/mobile/__tests__/screens/help/contentLoader.test.ts` (new file at adjusted path).
- **Verification:** `npx vitest run __tests__/screens/help/contentLoader.test.ts` — 5/5 tests pass; the same file at the plan's path would have been a 0-test no-op.
- **Committed in:** `0c4304c` (RED) + `13d7500` (GREEN).

**2. [Rule 2 — Missing Critical] Validator enforces real content.json shape, not the simplified plan sketch**

- **Found during:** Task 1 (reading `apps/mobile/src/screens/help/content.json` before writing the validator)
- **Issue:** The plan's `<interfaces>` block sketches the accordion shape as `{ id, title, body }`, but the real shape is `{ id, title, items: AccordionItem[] }` where `items` is a tagged union with three variants (`subsection`/`qa`/`issue`), each with different string field names. The plan ALSO omits the top-level `contactSupport: { headline, body }` object that `HelpCenterScreen.tsx` reads at line 75. A validator built to the plan's sketch would not check the items at all (the field doesn't exist in the sketch) and would not check contactSupport (also absent) — allowing the LLM to silently drop items, swap kinds, or omit contactSupport, none of which would be caught before bundling.
- **Fix:** Built `validateHelpContentShape` to enforce: top-level object → accordions array length match → per-accordion id match (stable identifier, never translated) + items array → per-item kind match (stable enum) + kind-specific string fields are non-null strings → top-level contactSupport object with headline + body strings. 17 unit tests cover every rejection path.
- **Files modified:** `tools/i18n/help-content-generate.ts`, `tools/i18n/__tests__/help-content-generate.test.ts`, `tools/i18n/help-content-prompts.ts` (added DO-NOT-TRANSLATE rules for the `kind` field).
- **Verification:** All 7 LLM regen calls passed the validator on first attempt; per-item kind + accordion id match en byte-for-byte (verified via `jq` post-regen).
- **Committed in:** `13d7500` (GREEN) + `f9deb9d` (regen proves the validator gate in production).

### Out of Scope (logged to `deferred-items.md`)

- 2 pre-existing visual snapshot failures in `apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx` ("recording-active-t05m32s" 5.40% diff + 1 other). Reproduces on stashed `HEAD` before plan 07-13 edits — unrelated to this plan (RecordingScreen lives nowhere near help-center). Logged for the wave verifier / a later baseline-refresh pass.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical).
**Impact on plan:** Both auto-fixes essential. Rule-3 fix ensures the loader contract is actually enforced (vs silently bypassed); Rule-2 fix ensures the validator catches the failure modes it exists to prevent. No scope creep.

## Issues Encountered

- **APK build fresh-worktree gaps.** The Android build needed `apps/mobile/android/local.properties` + `apps/mobile/android/app/src/apkRollout/google-services.json` — both `.gitignore`d, so a fresh worktree doesn't have them. Copied from the main repo (one-time setup; the files contain SDK path + Firebase project id, both already trusted in the main repo). Final build: `BUILD SUCCESSFUL in 6m 15s`, 563 tasks executed.
- **`tools/pnpm-lock.yaml` generated by my install** (tools is workspace-excluded). Did not commit — never tracked previously, and a sibling agent in 07-12 also touches `tools/package.json` which would conflict on lockfile regen otherwise.

## Verification Evidence

```
=== tools test suite ===
Test Files  3 passed (3)
Tests       27 passed (27)

=== mobile test suite (excluding pre-existing RecordingScreen visual baseline drift) ===
Test Files  125 passed (125)
Tests       919 passed (919)

=== mobile typecheck ===
(clean)

=== Android APK assembleApkRolloutDebug ===
BUILD SUCCESSFUL in 6m 15s
563 actionable tasks: 496 executed, 67 up-to-date

=== invariant gates (all empty) ===
apps/mobile/ios/                                empty diff
apps/api/drizzle/migrations/                    empty diff
apps/mobile/android/                            empty diff (only gitignored secrets copied in)
.planning/phases/06-*                           empty diff
apps/mobile/src/screens/help/content.json       empty diff (en source byte-identical)
apps/mobile/src/screens/help/markdown.tsx       empty diff
apps/mobile/src/i18n/locales/                   empty diff
apps/mobile/src/i18n/taskCatalog.i18n.ts        empty diff
```

## User Setup Required

None. The LLM regen is repeatable via `pnpm i18n:help-content:generate` once `tools/.env` has `ANTHROPIC_API_KEY` set (same env contract as the existing `i18n:generate` for the screen-string catalog).

## Next Phase Readiness

- G-10 (Help Center body in English) closed at the **code level**. The operator's hardware §help-walk re-walk in **plan 07-15** is the final UAT confirmation:
  - Open Help Center in a hi-IN-active build → all 3 accordions render with Hindi titles; expanding each accordion shows Hindi subsection headings / question / issue heading / body text.
  - Bold/italic markers render correctly through `markdown.tsx` (the renderer is pure structural — it was untouched and consumes whatever string it's fed).
  - The "Contact Support" + "Report a Problem" button labels render in the active locale (driven by plan 07-11's screen-string sweep, not by this plan).
- Plan 07-15 §2 / §help-walk runs this verification on real Pixel 8a + 10a hardware to close the UAT loop.

## Self-Check: PASSED

Verified post-write:

- `tools/i18n/help-content-generate.ts` — present (5,720 bytes)
- `tools/i18n/help-content-prompts.ts` — present (2,127 bytes)
- `tools/i18n/__tests__/help-content-generate.test.ts` — present
- `apps/mobile/src/screens/help/contentLoader.ts` — present
- `apps/mobile/__tests__/screens/help/contentLoader.test.ts` — present
- 7 sibling `content.{loc}.json` files — present, non-stub (real translations)
- `apps/mobile/src/screens/help/content.audit.json` — present
- Commits `0c4304c`, `13d7500`, `f9deb9d` — all reachable on `worktree-agent-ab3b287fe27d71d1c`

---

_Phase: 07-multi-linguality-live-cam-feed_
_Completed: 2026-05-26_
