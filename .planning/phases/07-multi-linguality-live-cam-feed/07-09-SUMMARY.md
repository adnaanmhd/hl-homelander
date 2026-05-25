---
phase: 07-multi-linguality-live-cam-feed
plan: 09
subsystem: ui
tags: [i18n, react-i18next, profile, delete-account-modal, gap-closure, llm-translation, mobile]

# Dependency graph
requires:
  - phase: 07-multi-linguality-live-cam-feed
    provides: 07-02 i18n bootstrap (i18next + useTranslation + LLM regen tool) and 07-04/07-05 screen sweep that wired the Language row + 22 other screens through t()
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: ProfileScreen.tsx and DeleteAccountModal.tsx structural components (PROF-01..05 / AUTH-09..10) — this plan does NOT alter their layout or behavior, only routes their labels through t()

provides:
  - 'i18n closure for WR-01: ProfileScreen.tsx + DeleteAccountModal.tsx render every user-visible label through t()'
  - 'New en.json subtrees: profile.head / profile.lifetime / profile.fields / profile.actions / profile.payments / profile.errors / profile.delete (10 leaf groups, 21 new leaves)'
  - 'Regenerated pt-BR / es / hi-IN / bn-IN / ta-IN / te-IN / mr-IN catalogs with shape-parity = 227 leaves per locale'
  - "Case-sensitive validator preserved across all 8 locales: profile.delete.placeholder === 'DELETE' (LLM translated pt-BR -> EXCLUIR / es -> ELIMINAR; both force-written back to 'DELETE')"
  - 'Design-canon drift detectors retained: PAYMENTS_BODY + STEP1_BODY constants kept (eslint-disabled) with en.json byte-parity gate enforcing they cannot drift'

affects:
  [
    07-MANUAL-SMOKE §2 (operator must re-walk Profile + Delete-Account flows on at least one non-English locale),
    phase 08-distribution-observability (i18n-completeness is now a stronger pre-ship invariant),
  ]

# Tech tracking
tech-stack:
  added: [] # No new libraries — i18next + react-i18next + the LLM regen tool all pre-existed from Phase 7 plans 07-02..07-05
  patterns:
    - 'Design-canon drift-detector pattern (eslint-disabled constant + en.json byte-parity gate) extended to a second surface — first established for PAYMENTS_BODY in PROF-02; this plan applies the same pattern to STEP1_BODY in DeleteAccountModal.'
    - "Post-LLM-regen integrity fix-up loop: scan a known-invariant key (placeholder must be 'DELETE') across all 7 generated catalogs, force-write back to canonical literal if the LLM translated it. Reusable for any future case-sensitive validator string that flows through the i18n catalog."

key-files:
  created: []
  modified:
    - apps/mobile/src/i18n/locales/en.json (added profile.* + profile.delete.* subtrees, 21 new leaves, +45 lines)
    - apps/mobile/src/i18n/locales/pt-BR.json (LLM regen, +profile subtrees)
    - apps/mobile/src/i18n/locales/es.json (LLM regen, +profile subtrees)
    - apps/mobile/src/i18n/locales/hi-IN.json (LLM regen, +profile subtrees, Devanagari)
    - apps/mobile/src/i18n/locales/bn-IN.json (LLM regen, +profile subtrees, Bengali)
    - apps/mobile/src/i18n/locales/ta-IN.json (LLM regen, +profile subtrees, Tamil)
    - apps/mobile/src/i18n/locales/te-IN.json (LLM regen, +profile subtrees, Telugu)
    - apps/mobile/src/i18n/locales/mr-IN.json (LLM regen, +profile subtrees, Marathi)
    - apps/mobile/src/i18n/locales/{loc}.audit.json (7 audit sidecars — shared en_source_sha = d8797892...)
    - apps/mobile/src/screens/profile/ProfileScreen.tsx (14 hardcoded labels + 1 Alert routed through t(); PAYMENTS_BODY annotated as design-canon)
    - apps/mobile/src/components/DeleteAccountModal.tsx (9 hardcoded labels + 2 Alerts routed through t(); STEP1_BODY annotated as design-canon; useTranslation import + destructure added)

key-decisions:
  - 'PAYMENTS_BODY + STEP1_BODY constants retained at render-site eslint-disable rather than deleted. The design-canon byte-parity gate (Task 1) is the regression detector — preserving the constants keeps the en.json -> design-spec.md §5.11 / §18.4 traceability intact.'
  - "Post-regen force-write of profile.delete.placeholder to literal 'DELETE' in pt-BR + es catalogs after the LLM translated them ('EXCLUIR' / 'ELIMINAR'). The plan anticipated this exact outcome and provided the per-locale fix-up loop; the case-sensitive DeleteAccountModal validator at line 99 (`typed !== REQUIRED_TEXT`) MUST be preserved across all locales."
  - 'Mobile workspace uses npm (not pnpm) per Phase 2 D-PKG-01..07; ran `npm ci --ignore-scripts` in worktree to skip esbuild postinstall version-mismatch (worktree-specific oddity) without affecting the catalog work.'
  - 'tools/ pnpm scripts (`pnpm i18n:generate` / `i18n:validate`) ran cleanly after `npm install --no-package-lock` populated tools/node_modules; the workspace config excludes tools/ from the root pnpm workspace, so it installs standalone.'

patterns-established:
  - 'Pattern 67 — i18n design-canon drift detector: when a user-visible string is verbatim copy from a locked design doc (idea-brief.md §5.11 / design-spec.md §18.4), keep the literal constant in the source file even after routing the render through t(). Annotate with eslint-disable-next-line @typescript-eslint/no-unused-vars + a comment citing the en.json byte-parity gate. Future maintainers see the original literal in code review, while the runtime renders the translated form.'
  - "Pattern 68 — post-LLM regen invariant fix-up: after `pnpm i18n:generate`, sweep all locales for invariant-bound keys (e.g. case-sensitive validator literals like `profile.delete.placeholder === 'DELETE'`) and force-write the canonical value back to any locale where the LLM translated it. The LLM cannot reliably know about runtime validators that compare against the string."

requirements-completed: [I18N-01, I18N-11]

# Metrics
duration: ~33 min (including LLM regen which dominated at ~17 min for 7 sequential Claude Opus calls)
completed: 2026-05-25
---

# Phase 07 Plan 09: Profile i18n Sweep Closure Summary

**i18n closure for WR-01: ProfileScreen.tsx + DeleteAccountModal.tsx now render every user-visible label through t(...) across all 8 MVP locales — 21 new profile._ / profile.delete._ leaves added to en.json, 7 non-English catalogs LLM-regenerated with shape parity, case-sensitive DELETE validator preserved per locale.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-05-25T03:42:00Z (approx; worktree HEAD reset)
- **Completed:** 2026-05-25T04:15:00Z (approx; final commit + post-prettier validate)
- **Tasks:** 4 / 4
- **Files modified:** 17 (1 en.json source + 7 non-English JSONs + 7 audit sidecars + ProfileScreen.tsx + DeleteAccountModal.tsx)

## Accomplishments

- **WR-01 closed** — Phase 7 verifier's "incomplete sweep on Profile surfaces" gap eliminated; a hi-IN / pt-BR / es / bn-IN / ta-IN / te-IN / mr-IN user now sees every Profile label and every Delete-Account-modal label rendered in their active locale (SC#1 from plan 07-05 finally satisfied for screen-23-equivalent surfaces).
- **en.json grew from 312 to 357 lines** (+45 lines, +21 leaf keys under `profile.head` / `profile.lifetime` / `profile.fields` / `profile.actions` / `profile.payments` / `profile.errors` / `profile.delete`).
- **Design-canon byte-parity verified** at en.json -> source-file boundary: `en.json profile.payments.body` byte-equal to `PAYMENTS_BODY` constant (ProfileScreen.tsx:51-52); `en.json profile.delete.body` byte-equal to `STEP1_BODY` constant (DeleteAccountModal.tsx:72-73). Both verified pre-commit + post-prettier-format.
- **LLM regen succeeded across all 7 locales** in a single coherent pass (every audit sidecar references the same `en_source_sha = d8797892432f601bdb5f3a4ea452e0ba748552900ccce46fe3a2644abfedd851`).
- **Shape parity holds**: 227 leaves match en.json across pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN. Both `pnpm i18n:validate` and the standalone `paths()` cross-check report `OK` for all 7.
- **Translation quality canaries passed**: hi-IN profile.delete.body is Devanagari (~150 chars); hi-IN profile.payments.body is Devanagari (~115 chars); pt-BR equivalents are Portuguese — none returned skeleton-English.
- **Case-sensitive DeleteAccountModal validator preserved across all locales**: `profile.delete.placeholder === 'DELETE'` in all 8 catalogs. The LLM translated pt-BR -> "EXCLUIR" and es -> "ELIMINAR"; the planned per-locale fix-up loop caught both and force-wrote 'DELETE' back. hi-IN / bn-IN / ta-IN / te-IN / mr-IN preserved 'DELETE' natively.

## Task Commits

Each task committed atomically on `worktree-agent-a60ad80cc64fb345c`:

1. **Task 1: Add `profile.*` + `profile.delete.*` keys to en.json (D-12 canonical SOT)** — `fae6b26` (feat)
2. **Task 2: Route ProfileScreen.tsx labels through t() (14 sites + 1 Alert)** — `43d653c` (feat)
3. **Task 3: Route DeleteAccountModal.tsx labels through t() (9 sites + 2 Alerts)** — `a452979` (feat)
4. **Task 4: Regenerate 7 non-English locale catalogs via LLM tool + validate shape parity** — `e894f9d` (chore)

**Plan metadata commit** will be added by the orchestrator after merge.

## Files Created/Modified

- `apps/mobile/src/i18n/locales/en.json` — Canonical SOT. +45 lines, 21 new leaves across 7 top-level profile._ subtrees + profile.delete._ subtree. Existing `profile.language.{row,picker}` preserved verbatim.
- `apps/mobile/src/i18n/locales/pt-BR.json` — LLM regen; `profile.delete.placeholder` force-written back to 'DELETE' after LLM translated to 'EXCLUIR'.
- `apps/mobile/src/i18n/locales/es.json` — LLM regen; `profile.delete.placeholder` force-written back to 'DELETE' after LLM translated to 'ELIMINAR'.
- `apps/mobile/src/i18n/locales/hi-IN.json` — LLM regen; Devanagari; placeholder preserved as 'DELETE' natively.
- `apps/mobile/src/i18n/locales/bn-IN.json` — LLM regen; Bengali; placeholder preserved as 'DELETE' natively.
- `apps/mobile/src/i18n/locales/ta-IN.json` — LLM regen; Tamil; placeholder preserved as 'DELETE' natively.
- `apps/mobile/src/i18n/locales/te-IN.json` — LLM regen; Telugu; placeholder preserved as 'DELETE' natively.
- `apps/mobile/src/i18n/locales/mr-IN.json` — LLM regen; Marathi; placeholder preserved as 'DELETE' natively.
- `apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.audit.json` — 7 audit sidecars with shared `en_source_sha`, `model: claude-opus-4-7`, `brief_version: 1`, per-locale `generated_at`.
- `apps/mobile/src/screens/profile/ProfileScreen.tsx` — 14 hardcoded labels + 1 Alert routed through t(); PAYMENTS_BODY annotated with eslint-disable + extended comment documenting the en.json byte-parity gate.
- `apps/mobile/src/components/DeleteAccountModal.tsx` — 9 hardcoded labels + 2 Alerts routed through t(); useTranslation import + destructure added (file previously had none); STEP1_BODY annotated identically to PAYMENTS_BODY.

## Decisions Made

- **D-09-01 — Retain PAYMENTS_BODY and STEP1_BODY as eslint-disabled constants** rather than delete them. The design-canon byte-parity gate (Task 1 step 5) asserts the en.json values are byte-equal to these literals; keeping the constants visible in the source files preserves traceability to design-spec.md §15 / §18.4 / idea-brief.md §5.11. Annotated with `// eslint-disable-next-line @typescript-eslint/no-unused-vars` + extended comment explaining the runtime-vs-design split. Rationale also surfaces in code review when either side is touched.
- **D-09-02 — Post-regen force-write of profile.delete.placeholder** in pt-BR + es to the literal 'DELETE' (LLM translated to 'EXCLUIR' / 'ELIMINAR'). The case-sensitive validator at DeleteAccountModal.tsx:99 (`typed !== REQUIRED_TEXT` where REQUIRED_TEXT === 'DELETE') is the upstream invariant; the typed-text gate would break in pt-BR/es if the placeholder hint suggested any other word. Plan anticipated this exact LLM failure mode and provided the fix-up loop.
- **D-09-03 — `e.message` server-text passthrough preserved** at DeleteAccountModal.tsx Alert (deleteMe failure). The Alert title + fallback body translate through t(); the `e instanceof Error ? e.message : <fallback>` branch keeps server English passthrough for debuggability, consistent with D-35 (raw English `detail` to Crashlytics) and Plan 07-05 D-34 (unknown error codes show translated generic copy). Documented in T-07-09-04 of the plan's threat register, accepted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PAYMENTS_BODY + STEP1_BODY constants tripped ESLint after their render sites swapped to t()**

- **Found during:** Task 2 (first commit attempt of ProfileScreen.tsx) and proactively pre-empted in Task 3 (DeleteAccountModal.tsx)
- **Issue:** The pre-commit lint-staged hook ran `eslint --fix` on the modified TSX, which flagged the design-canon constants under `@typescript-eslint/no-unused-vars` ("PAYMENTS*BODY is assigned a value but never used. Allowed unused vars must match /^*/u"). The plan explicitly says to retain these constants as design-canon drift detectors (not delete them).
- **Fix:** Annotated both constants with `// eslint-disable-next-line @typescript-eslint/no-unused-vars` and extended the surrounding comment to document the rationale (runtime renders the catalog value; constant exists for design-spec traceability + the en.json byte-parity gate's anchor). The underscore-prefix alternative (`_PAYMENTS_BODY`) was rejected because it signals "throwaway/private" — the opposite of the intent.
- **Files modified:** apps/mobile/src/screens/profile/ProfileScreen.tsx (PAYMENTS_BODY), apps/mobile/src/components/DeleteAccountModal.tsx (STEP1_BODY)
- **Verification:** ESLint clean post-fix for both files; the byte-parity regex (`/PAYMENTS_BODY\s*=\s*\n?\s*'([^']*)'/` and `/STEP1_BODY\s*=\s*\n?\s*'([^']*)'/`) still resolves both constants since the annotation comment doesn't break the surrounding pattern; mobile typecheck + tests + i18n:validate all green.
- **Committed in:** 43d653c (Task 2), a452979 (Task 3) — the eslint-disable annotation is part of the same task commit, not a separate fix commit.

**2. [Rule 3 - Blocking] tools/.env + tools/node_modules + mobile/node_modules absent in worktree**

- **Found during:** Task 4 start (Run i18n:generate)
- **Issue:** The worktree was freshly spawned with `git worktree add` — it had no `tools/.env` (where `ANTHROPIC_API_KEY` lives, gitignored), no `tools/node_modules` (pnpm workspace excludes tools/), and `apps/mobile/node_modules` was missing too. Cannot run `pnpm i18n:generate` / `npx tsc` / `npm test` without these.
- **Fix:** (a) Copied `tools/.env` from the main repo into the worktree (gitignored, never committed; verified via `git check-ignore tools/.env`). (b) Ran `npm install --no-package-lock --ignore-scripts` inside tools/ to populate node_modules (tools/ uses pnpm scripts but the dependency tree was satisfiable by npm since tools/ is not a workspace child). (c) Ran `npm ci --ignore-scripts` inside apps/mobile to install RN deps (skipped scripts to bypass an esbuild postinstall version-mismatch in this worktree).
- **Files modified:** None tracked in commits (all are gitignored or in node_modules)
- **Verification:** `pnpm i18n:generate` completed successfully for all 7 locales; `npx tsc --noEmit` exited 0; `npm test -- --run` ran 918 / 918 passing.
- **Committed in:** N/A (environment fix, no tracked file changes)

**3. [Rule 1 - Bug] `profile.delete.placeholder` translated by LLM in pt-BR + es**

- **Found during:** Task 4 step 1 (post-regen sanity sweep)
- **Issue:** The LLM regen translated `profile.delete.placeholder` to `'EXCLUIR'` in pt-BR and `'ELIMINAR'` in es. The TextInput placeholder hint MUST match the case-sensitive validator at DeleteAccountModal.tsx:99 (`typed !== REQUIRED_TEXT` where REQUIRED_TEXT === 'DELETE'); the user would see the translated placeholder, type that word, and the validator would reject the typed text — they could not delete their account.
- **Fix:** The plan explicitly anticipated this and provided the per-locale fix-up loop (Task 4 action step 1). Ran the loop: it detected both translations, force-wrote 'DELETE' back into each locale JSON, and printed `FIXED: pt-BR placeholder forced to DELETE` / `FIXED: es placeholder forced to DELETE`. hi-IN / bn-IN / ta-IN / te-IN / mr-IN preserved 'DELETE' natively (the LLM appears to leave the literal alone when the script doesn't have a obvious translation; Brazilian Portuguese and Spanish are the only ones with idiomatic single-word equivalents).
- **Files modified:** apps/mobile/src/i18n/locales/pt-BR.json, apps/mobile/src/i18n/locales/es.json
- **Verification:** All 8 catalogs now report `placeholder = 'DELETE'`; mobile test suite still 918/918 green; i18n:validate shape parity OK across all 7 non-English catalogs (227 leaves each).
- **Committed in:** e894f9d (Task 4 commit; the fix is part of the LLM-regen task)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 anticipated-LLM-translation-bug). All three were explicitly anticipated by the plan (D-09-01 / Task 4 step 1).
**Impact on plan:** Zero scope creep. The eslint-disable annotation is the smallest-diff way to honor the plan's "retain the constants as design-canon drift detectors" requirement under the project's no-unused-vars rule. The post-regen placeholder fix-up loop is documented Task 4 procedure, not an unplanned deviation.

## Issues Encountered

- **First Task 2 commit attempt failed lint-staged** — see Deviation #1. Resolved by adding the eslint-disable annotation; the failed commit attempt left the working tree unchanged (lint-staged reverts on failure), so the second attempt cleanly committed with `git rev-parse --short HEAD = 43d653c`.
- **`cd apps/mobile && ...` chained across separate Bash tool calls did not preserve cwd** — the harness resets shell state between Bash tool calls. Worked around by chaining all relevant commands in a single tool call (`cd apps/mobile && tsc && eslint && test`) and using absolute paths from worktree root for Node one-liner verifiers.
- **`pnpm i18n:generate` auto-backgrounded** after the first few seconds because the LLM call duration exceeded the foreground threshold. Background completion notification arrived ~17 minutes later with `[generate] {loc}: OK` for all 7 locales and exit code 0.

## Threat Surface Scan

This plan introduces no new network endpoints, no new auth paths, no new file-access patterns, and no schema changes at trust boundaries. The Profile + Delete-Account surfaces themselves predate this plan; only their label-rendering pipeline shifted from JSX string literals to `t(...)` calls. **No new threat flags.**

The plan's existing threat register (T-07-09-01 through T-07-09-05) was fully mitigated at plan execution time:

- T-07-09-01 (LLM translates placeholder): Mitigated — caught for pt-BR + es, force-fix applied.
- T-07-09-02 (LLM hallucinates extra keys): Mitigated — `pnpm i18n:validate` + standalone shape-parity cross-check both report OK across all 7 locales (zero missing, zero extra).
- T-07-09-03 (PAYMENTS_BODY / STEP1_BODY drift): Mitigated at execution time via Task 1 step 5 byte-parity gate; recommended §v2 follow-up: convert the gate into a CI assertion or runtime unit test.
- T-07-09-04 (e.message English passthrough at DeleteAccountModal.tsx:133): Accepted, consistent with D-35.
- T-07-09-05 (single-locale regen failure does not abort others): Mitigated by generate.ts try/catch per-locale; not exercised (all 7 succeeded).

## User Setup Required

None. The catalog-regen step required `ANTHROPIC_API_KEY` from `tools/.env`, but that file was already provisioned in the main repo and is gitignored (per `tools/.gitignore`). The operator does NOT need to provision new env vars or service accounts as a result of this plan.

## Audit Sidecar Provenance

All 7 audit sidecars committed in e894f9d share the same `en_source_sha`, confirming a single coherent regen pass against the post-Task-1 en.json:

| Locale | sidecar SHA256                                                     | generated_at             |
| ------ | ------------------------------------------------------------------ | ------------------------ |
| pt-BR  | `b60273511630acc893056437a37a43f729f29da3d8a0f79a4f6397a4dc1191d2` | 2026-05-25T03:58:55.110Z |
| es     | `c6f44f40eb0e58f48285f45bdce13c4f37cf983651e91a572ecf6adec5a2be49` | 2026-05-25T04:00:08.371Z |
| hi-IN  | `33cb91f4dc4f27cd33914c25131731d2747a2d00cf6ff927e6fb03770ee2f9ab` | 2026-05-25T04:02:10.843Z |
| bn-IN  | `c9c02af3b906422c5080fcaedf480b80502f7b53aac42a371d3c75a8d924b5c5` | 2026-05-25T04:04:06.549Z |
| ta-IN  | `ec3209f8fee282fc2983bcaac33e5fd188391f13095b09d596c42b2a40cd6b75` | 2026-05-25T04:07:10.367Z |
| te-IN  | `f4923c21d0a32e60349bfc8e4d1b0e29f8d376a724a1e6232b3dfdb30a42408a` | 2026-05-25T04:10:40.442Z |
| mr-IN  | `5b65d4e53ae297bb783376d2e14635edc113cb2d6e085a61055835ccfcf85ec8` | 2026-05-25T04:13:05.034Z |

Shared `en_source_sha`: `d8797892432f601bdb5f3a4ea452e0ba748552900ccce46fe3a2644abfedd851`
Model: `claude-opus-4-7` (D-10) — `brief_version: 1`

## Next Phase Readiness

- **Ready for Phase 7 final verification re-walk.** The single WR-01 sweep gap identified in `07-VERIFICATION.md` is closed. Phase 7's other 10 operator items (the §-3 through §-11 manual smoke sections + the remaining 10 verification items from `07-VERIFICATION.md`) are untouched by this plan and remain whatever state they were in before — the orchestrator should treat them as independent gates.
- **Operator follow-up (NOT a blocker for this plan):** Re-run `07-MANUAL-SMOKE.md §2` (Profile Language picker per-locale walk) on at least one non-English locale — hi-IN strongly recommended (Devanagari script is the most distinctive visual confirmation; if Profile + Delete-Account both render entirely in Hindi with no English fallback strings, the sweep is operator-verified). The §3 through §11 walks of the smoke runbook are unaffected by this gap closure and do NOT need re-walking.
- **§v2 quality-investment candidate** surfaced in T-07-09-03: convert the design-canon byte-parity check (currently a one-off Task 1 step 5 node script) into a CI gate or runtime unit test that re-asserts `en.json profile.payments.body === PAYMENTS_BODY` and `en.json profile.delete.body === STEP1_BODY` on every commit. Not in scope for this plan — flagging for the next phase's planner.

## Self-Check: PASSED

Verified post-plan:

- All 4 task commits present in `git log --oneline 5a66e616..HEAD`: fae6b26, 43d653c, a452979, e894f9d.
- All 17 files in `git diff --stat 5a66e616..HEAD` match the plan's `files_modified` (10) + 7 audit sidecars exactly.
- `pnpm i18n:validate` exits 0 with `OK` for pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN.
- Standalone shape-parity cross-check exits 0 — all 7 non-English catalogs have 227 leaves matching en.json.
- All 8 catalogs report `profile.delete.placeholder === 'DELETE'` (case-sensitive validator pin holds).
- Mobile typecheck + ESLint + test suite (918/918) all green.
- All capture-spec / iOS / Phase 6 cosmetic / design-locked invariants UNCHANGED (`git diff --stat` empty for each).

---

_Phase: 07-multi-linguality-live-cam-feed_
_Plan: 09 (gap-closure for WR-01)_
_Completed: 2026-05-25_
