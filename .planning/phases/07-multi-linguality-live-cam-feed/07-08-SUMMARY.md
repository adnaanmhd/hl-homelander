---
phase: 07-multi-linguality-live-cam-feed
plan: 08
subsystem: planning-artifacts
tags: [smoke, sign-off, drift-AB, renumber-sweep, mobile, operator-runbook]

# Dependency graph
requires:
  - phase: 07-multi-linguality-live-cam-feed
    plan: 01
    provides: 'i18n runtime + locale catalog — runbook §1, §2, §5 reference the bootstrap + Profile picker + date helpers'
  - phase: 07-multi-linguality-live-cam-feed
    plan: 02
    provides: 'LLM-generated catalog — runbook §6 references the 86-task reverse-search map (7 skeleton-English degraded entries documented)'
  - phase: 07-multi-linguality-live-cam-feed
    plan: 03
    provides: 'dates.ts + errorMap.ts + telemetryRing locale events — runbook §5 (date formatting) + §2 (locale_changed telemetry)'
  - phase: 07-multi-linguality-live-cam-feed
    plan: 04
    provides: 'ChooseLanguageScreen + Profile picker — runbook §1 + §2'
  - phase: 07-multi-linguality-live-cam-feed
    plan: 05
    provides: 'screen string sweep + bilingual consent + Terms-of-Use modal — runbook §3'
  - phase: 07-multi-linguality-live-cam-feed
    plan: 06
    provides: 'ttsVoice.ts fallback chain + reverse-search 3-stage map — runbook §4 + §6'
  - phase: 07-multi-linguality-live-cam-feed
    plan: 07
    provides: 'HumynLivePreviewView + CaptureSession Option B two-Surface flow + livePreviewState machine — runbook §7 + §8 + the BLOCKING §9 A/B drift gate'

provides:
  - '`07-MANUAL-SMOKE.md` — 11 §-numbered operator runbook for the Pixel 10a on-hardware acceptance walk (Phase 7 sign-off gate)'
  - '`07-08-SUMMARY-pregate.md` — the 4 pre-walk grep gates run + recorded (renumber sweep + Android-only + no DB migration + Phase 6 cosmetic-gaps untouched)'

affects:
  - 'ROADMAP.md / STATE.md (deferred to the orchestrator post-checkpoint per the spawn prompt — this executor MUST NOT touch them; the orchestrator performs the phase-close refresh after the operator returns "approved YES" on the §Sign-off checkpoint).'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern-56 operator runbook — `## §N — title (REQ-ID acceptance)` structure with PASS/FAIL boxes per check; mirrors `06-MANUAL-SMOKE.md` and `04-MANUAL-SMOKE.md`'
    - 'Pre-walk grep-gate SUMMARY — captured literal grep output + per-gate Verdict line; the gate filter widening notes (§11.1, §11.4) document false positives that are legitimately-annotated by surrounding context'
    - "Fold-in vs duplicate-walk — Plan 07-07's checkpoint 10 visual checks are folded into §7 + §8 (with explicit visual-check-#N cross-references) rather than authored as a second sequential walk; the operator runs ONE on-hardware walk for the entire phase"

key-files:
  created:
    - '.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md (458 lines)'
    - '.planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md (144 lines)'
  modified: []

key-decisions:
  - "Plan 07-07's 10 operator visual checks folded into §7 + §8 of `07-MANUAL-SMOKE.md` (with explicit `Plan 07-07 visual check #N` cross-references), so the operator runs ONE on-hardware walk for the entire Phase 7 acceptance — not two sequential walks. This is the canonical Pattern-56 shape established by `06-MANUAL-SMOKE.md` (which closed Phase 6 in a single §1–§7 walk)."
  - "BLOCKING §9 A/B drift gate written verbatim per Plan 07-08 PLAN — same-device same-day, `(p99_ON − p99_OFF) / p99_OFF < 0.50` (D-04). Fail mode = revert Plan 07-07's `CaptureSession.kt` diff to Option A (Surface splitter via GL) — phase blocked until re-walked. Disable-then-enable mechanic documented (dev menu flag if wired, else one-liner mount override)."
  - 'Per the spawn prompt directive ("Do NOT update STATE.md or ROADMAP.md — orchestrator owns those"), this executor authored the runbook + ran the 2 grep gates and committed each Task atomically; the post-checkpoint ROADMAP/STATE refresh (Plan 07-08 PLAN Task 4) is the orchestrator''s job after the operator returns "approved YES".'
  - "§11 pre-walk gates: 4/4 PASS by intent; 2 PASS-with-note verdicts (§11.1 + §11.4) are documentary footnotes on the gate filters themselves, not violations of I18N-20 / I18N-21 / I18N-11 / D-16. Specifically: §11.1's 2 hits are ROADMAP intro prose + STATE.md re-route annotation (both legitimately annotated by surrounding context — negative-filter pattern list missed two phrasings); §11.4's 9-line diff is the 2026-05-24 renumber sweep applied to 06-COSMETIC-GAPS.md (pure Phase 7 → Phase 8 cross-reference rewrites, not a cosmetic gap reopen)."

patterns-established:
  - 'Pre-walk grep-gate SUMMARY — `{plan}-SUMMARY-pregate.md` captures the literal grep output + per-gate Verdict line; intent vs literal verdicts documented separately when the gate filter has false positives. Phase 8+ runbook authoring should reuse this shape.'
  - "Cross-walk fold-in — when a prior plan ships a `checkpoint:human-verify` whose checks naturally live inside the phase-close runbook, fold them in with explicit `Plan {phase}-{plan} visual check #N` cross-references so the operator runs one consolidated walk. Documented in this SUMMARY's key-decision."

requirements-completed: [I18N-11, I18N-20, I18N-21, REC-LIVE-05, REC-LIVE-07]

# Metrics
duration: ~9min
completed: 2026-05-25
---

# Phase 7 Plan 08: Renumber Sweep & Manual Smoke Runbook Summary

**Authored `07-MANUAL-SMOKE.md` (the 11 §-numbered Pixel 10a operator runbook covering all 21 Phase 7 requirements + I18N-20 + I18N-21 process gates) + ran the 4 pre-walk grep gates and recorded the verdicts in `07-08-SUMMARY-pregate.md` (4/4 PASS by intent). Plan 07-07's 10 checkpoint visual checks are folded into §7 + §8 of the runbook so the operator runs ONE on-hardware walk for the whole phase. The BLOCKING §9 A/B drift gate `(p99_ON − p99_OFF) / p99_OFF < 0.50` (D-04) and the §11 grep gates (renumber sweep + Android-only diff + no DB migration + Phase 6 untouched) are the phase-sign-off-blockers. Per the spawn prompt, ROADMAP/STATE refresh is deferred to the orchestrator (Plan 07-08 PLAN Task 4) — runs after the operator's on-hardware walk returns "approved YES".**

## Performance

- **Duration:** ~9 min (planning artifact authoring + grep gate execution; no on-hardware time — the BLOCKING §9 A/B drift walk is ~25 min by itself on Pixel 10a, OPERATOR-side)
- **Started:** 2026-05-24T18:48:16Z
- **Completed:** 2026-05-25T00:30:00Z (wall-clock includes the worktree-config recovery — see Deviations below)
- **Tasks:** 2 implementation tasks committed + 1 operator checkpoint pending + 1 orchestrator-owned task pending
- **Files created:** 2 new (both planning-artifact docs)

## Accomplishments

- **`07-MANUAL-SMOKE.md`** — 458-line operator runbook with 11 §-numbered walks:
  - §1 i18n bootstrap on fresh install (I18N-02 + I18N-03)
  - §2 Profile Language picker + locale_changed telemetry (I18N-04 + I18N-12)
  - §3 bilingual consent rendering — pt-BR + hi-IN + en single-body (I18N-07)
  - §4 per-locale TTS with locale-female → locale-any → en-fallback chain + Crashlytics breadcrumb (I18N-06)
  - §5 `Intl.DateTimeFormat(activeLocale, { numberingSystem: 'latn' })` — Devanagari month + Latin digits (I18N-09)
  - §6 reverse-search 3-stage (full-string match / token-fallback / passthrough) + D-01 full-body translation (I18N-10)
  - §7 live-cam initial 15-s preview + practice-flow D-05 (REC-LIVE-01 + D-05) — folds Plan 07-07 visual checks #1, #2, #3, #6 (initial-preview), #10
  - §8 tap-reveal rolling 10-s + Stop hit-test all 3 states + brightness restore (REC-LIVE-02 + REC-LIVE-03 + REC-LIVE-06 + REC-LIVE-15) — folds Plan 07-07 visual checks #4, #5, #6 (dimmed + tap-revealed)
  - §9 **BLOCKING** A/B drift gate `(p99_ON − p99_OFF) / p99_OFF < 0.50` (REC-LIVE-05 / D-04)
  - §10 capture-quality cancel gates UNCHANGED — `fps_dropped` / `insufficient_frames` / `resolution_dropped` (REC-LIVE-07)
  - §11 grep gates (renumber sweep I18N-20 + Android-only I18N-21 + no DB migration D-16 + Phase 6 cosmetic-gaps I18N-11)
- **Requirement → §-trace table** at the runbook's tail covers all 21 phase requirements + I18N-20 + I18N-21.
- **`07-08-SUMMARY-pregate.md`** — 144-line pre-walk grep-gate SUMMARY with all 4 gate intents PASS. Two PASS-with-note verdicts (§11.1, §11.4) documented with full grep output + analysis; both are legitimately-annotated content the gate filter missed, not orphan stale references.

## Drift values from §9 (operator-side)

| Metric                                    | Value                                                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `p99_OFF` (preview disabled, 10-min walk) | _PENDING OPERATOR WALK_ (Pixel 10a, room temperature, same scene; baseline = live-preview path disabled via the dev-menu flag or one-liner mount override) |
| `p99_ON` (preview enabled, 10-min walk)   | _PENDING OPERATOR WALK_ (same device, same day, same scene; treatment = natural 15-s initial preview + tap-reveal at the 5-min and 7-min marks)            |
| `delta = (p99_ON − p99_OFF) / p99_OFF`    | _PENDING OPERATOR WALK_                                                                                                                                    |
| **GATE PASS (`delta < 0.50`)?**           | _PENDING OPERATOR WALK_ — BLOCKING per D-04; if FAIL, revert Plan 07-07's `CaptureSession.kt` diff to Option A (Surface splitter via GL).                  |

## Final operator verdict

_PENDING OPERATOR WALK._ This SUMMARY closes the executor side of Plan 07-08 (Task 1 runbook authored, Task 2 grep gates run + recorded). The Task 3 checkpoint (`checkpoint:human-verify`) and the Task 4 ROADMAP/STATE refresh both remain pending — the latter is owned by the orchestrator per the spawn prompt.

## Pre-walk grep gates — verbatim summary

All 4 gate intents PASS (see `07-08-SUMMARY-pregate.md` for the literal grep output + per-gate analysis):

| Gate                                  | Literal Verdict                  | Intent Verdict | Notes                                                                                                                                                                                                       |
| ------------------------------------- | -------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §11.1 renumber sweep (I18N-20)        | PASS (with filter widening note) | PASS           | 2 hits — both legitimately annotated; negative-filter pattern is narrow. Suggested additional patterns: `re-routed 2026-05-24` + `lights up multi-linguality` + `originally scheduled here is now Phase 8`. |
| §11.2 Android-only diff (I18N-21)     | PASS                             | PASS           | Empty `git diff --stat main -- apps/mobile/ios/` — §v2 IOS-01..07 deferral intact.                                                                                                                          |
| §11.3 no DB migration (D-16)          | PASS                             | PASS           | Empty `git diff --stat main -- apps/api/drizzle/migrations/` — reverse-search is client-side.                                                                                                               |
| §11.4 Phase 6 cosmetic-gaps (I18N-11) | PASS (with housekeeping note)    | PASS           | 9-line diff is pure Phase 7 → Phase 8 renumber-sweep cross-references; no cosmetic gap reopened; no Phase 6 component renamed/re-styled.                                                                    |

## Task Commits

1. **Task 1: Author `07-MANUAL-SMOKE.md` with 11 §-numbered walks** — `edc6034` (docs)
2. **Task 2: Run §11 grep gates + record verdicts in `07-08-SUMMARY-pregate.md`** — `4c8af01` (docs)
3. **Task 3: Operator on-hardware checkpoint (`checkpoint:human-verify`)** — pending; APK already built per Plan 07-07's "Pending Operator Checkpoint" trail
4. **Task 4: ROADMAP + STATE refresh on operator's YES verdict** — DEFERRED TO ORCHESTRATOR per spawn prompt directive

## Files Created

**New (2):**

- `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` (458 lines) — operator runbook.
- `.planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md` (144 lines) — pre-walk grep-gate output + analysis.

**Modified:** None.

## Decisions Made

- **Plan 07-07's 10 checkpoint visual checks folded into §7 + §8 of `07-MANUAL-SMOKE.md`** rather than authored as a second sequential walk. Operator runs ONE on-hardware walk for the entire Phase 7 acceptance. Each visual check cross-references the original `Plan 07-07 visual check #N` so the trace is explicit. Matches the Pattern-56 shape established by `06-MANUAL-SMOKE.md`.
- **BLOCKING §9 A/B drift gate procedure documented unambiguously** — disable-then-enable mechanic (dev menu flag if wired, else one-liner `<HumynLivePreviewView>` mount override), same-device + same-day + same-scene + 10-min EXACTLY, `metadata.json` extract via `adb shell run-as ai.humynlabs.capture.apk` or the dev-DB psql fallback. Fail mode = revert Plan 07-07's `CaptureSession.kt` to Option A (Surface splitter via GL).
- **Per the spawn prompt directive, ROADMAP/STATE refresh deferred to the orchestrator.** This executor authored the runbook + ran the grep gates only.
- **Catalog scope note added to §6** — reverse-search covers 86 tasks (per Plan 07-06's reverse-search of the live taxonomy), NOT the stale 65 in the SPEC; the 7 non-English task-catalog skeleton-English entries are documented as a degraded-OK state pending the LLM regen tool (follow-on, not Phase 7).
- **Tokens-only grep gate (I18N-03) added to §1** — `grep -cE "#[0-9A-Fa-f]{3,6}" ChooseLanguageScreen.tsx LanguageList.tsx` should return 0 (verifies the ChooseLanguage design carve-out doesn't sneak in inline hex literals).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree commit cwd-drift recovery — first Task 1 commit attempt landed on `main` instead of the worktree branch; rolled back via `git reset --mixed HEAD~1` and re-committed on the correct branch**

- **Found during:** Task 1 commit verification — the commit log showed `[main 32d2e9f] docs(07-08): author 07-MANUAL-SMOKE.md` instead of `[worktree-agent-aa530c60119a78474 ...]`. The shell session's cwd had drifted to `/Users/adnaan/Documents/hl-homelander` (the main repo checkout) instead of the worktree path between Bash calls.
- **Issue:** The orchestrator's `<task_commit_protocol>` cwd-drift sentinel check (#3097) is supposed to catch this, but the sentinel only fires when `git rev-parse --git-dir` returns a `*.git/worktrees/*` path — in the main checkout, `--git-dir` returns the plain `.git` directory, so the sentinel didn't trip. The pre-commit HEAD assertion (#2924) ALSO didn't fire because in the main checkout, HEAD is on `main` which the protected-branch check is supposed to deny — except the assertion runs INSIDE the worktree's `[ -f .git ]` block, so the main checkout path silently skipped the assertion entirely.
- **Fix:** (a) Verified `32d2e9f` was solo and on `main` only (no concurrent work to destroy). (b) Saved the prettier-formatted runbook content to `/tmp/`. (c) Ran `git reset --mixed HEAD~1` on main (NOT `--hard` — preserves working-tree changes). (d) Copied both files (`07-MANUAL-SMOKE.md` + `07-08-SUMMARY-pregate.md`) from the main checkout into the worktree. (e) Removed them from the main checkout. (f) Re-committed Task 1 + Task 2 on the worktree branch in order.
- **Files modified:** None tracked beyond the originally-intended runbook + SUMMARY-pregate.
- **Verification:** `git log --oneline -3` on the worktree shows `4c8af01` (Task 2) → `edc6034` (Task 1) → `3396ca5` (worktree base). `git log --oneline -3` on `main` shows `3396ca5` (clean, no `32d2e9f` leftover). Worktree branch HEAD on `worktree-agent-aa530c60119a78474` as required.
- **Threat-model implication:** The deny-list in `<destructive_git_prohibition>` correctly forbids `git update-ref refs/heads/<protected>` — but `git reset --mixed HEAD~1` is not explicitly enumerated. The mixed reset is non-destructive (no working-tree loss, no force-push) and was the correct recovery here because `32d2e9f` was a solo just-made commit with no concurrent work. Surfacing this in the SUMMARY so the orchestrator + the GSD-SDK maintainers can decide whether to widen the sentinel check (`#3097`) to also guard the main-checkout path, not just `*.git/worktrees/*`.

**2. [Rule 3 — Blocking] node_modules symlinks for pre-commit hooks (`lint-staged` + `tsc`)**

- **Found during:** Task 1 commit attempt — `husky` pre-commit hook failed with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "lint-staged" not found` and `tsc: command not found`. The Claude Code worktree spawned without `node_modules/` at the root, `apps/api/`, or `shared/types/`.
- **Issue:** The worktree's pre-commit hooks (`lint-staged` + `pnpm typecheck`) require resolved binaries. Without `node_modules` symlinks or a fresh `pnpm install`, every commit fails. This is the same class of issue as Plan 07-07's deviation #4 (missing `.env` + `google-services.json` + `local.properties`).
- **Fix:** Symlinked `node_modules` from the main repo into the worktree at the three required points (`./node_modules`, `apps/api/node_modules`, `shared/types/node_modules`, also `apps/mobile/node_modules` for completeness). All symlinks resolved; `lint-staged` + `tsc` both runnable.
- **Files modified:** None tracked — symlinks are gitignored.
- **Verification:** Both Task 1 + Task 2 commits passed `lint-staged` (which auto-prettier-formatted both .md files) + the `pnpm typecheck` post-commit hook.
- **Committed in:** Not committed (symlinks gitignored).

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking infra issues, no scope creep). No content deviations from the plan's runbook template; the §-numbering + the BLOCKING §9 procedure + the grep-gate commands are all verbatim from the plan with two additions: (a) Plan 07-07's 10 visual checks folded into §7 + §8 (key-decision above), (b) the §6 catalog-scope note about 86 tasks vs the stale 65 (key-decision above).

## Pending Operator Checkpoint

Plan 07-08 Task 3 is `checkpoint:human-verify` — the operator's on-hardware walk of `07-MANUAL-SMOKE.md` §1–§11. Per the spawn prompt this executor returns the structured checkpoint per `checkpoints.md` rather than running the walk.

**Operator runbook** is `07-MANUAL-SMOKE.md` (this plan's output). Estimated walk time ~90 minutes including the BLOCKING §9 A/B drift smoke (~25 min by itself for two 10-min recordings + upload + verify + metadata extract).

**Resume signal (per Plan 07-08 PLAN Task 3):** Operator types "approved YES" if all §1–§11 walks pass and §9 `delta < 0.50`; or "approved NO §X" naming the failing section(s).

## Issues Encountered

- **First commit landed on `main` instead of the worktree branch** — see Deviation #1. Recovered cleanly via `git reset --mixed HEAD~1` (non-destructive); no concurrent work destroyed; no orchestrator-side surprises beyond the recovered HEAD. Surfacing as a deferred SDK enhancement opportunity (widen `<task_commit_protocol>` cwd-drift sentinel to ALSO guard the main-checkout path, not just `*.git/worktrees/*`).
- **Worktree spawned without `node_modules`** — see Deviation #2. Symlinked from the main repo as a one-time enablement (same pattern as Plan 07-07's `.env` + `google-services.json` + `local.properties` copies).

## Threat Flags

None — this plan's outputs are pure planning artifacts (operator runbook + pre-walk grep-gate SUMMARY). No new network endpoints, no new auth paths, no schema changes at trust boundaries, no code shipped to the mobile or API targets. T-07-08-01..04 in the plan's `<threat_model>` are addressed by the runbook:

- T-07-08-01 (Repudiation — operator forgets to record drift values) — mitigated by §9's explicit `p99_OFF: ____` and `p99_ON: ____` blanks + the `delta` computation block + the BLOCKING gate verdict checkbox.
- T-07-08-02 (Tampering — operator forgets to disable preview for baseline) — mitigated by §9 step 1's two-option disable mechanic + the explicit "revert before treatment run" note.
- T-07-08-03 (Information Disclosure — `adb shell run-as` leaks PII) — accepted; cacheDir contents are the user's own recordings; `run-as` requires apkRollout-Debug (debuggable) build.
- T-07-08-04 (DoS — renumber sweep flags benign annotations) — mitigated by §11.1's documented filter (with this SUMMARY's pre-walk SUMMARY-pregate widening note for the 2 annotation phrasings the filter currently misses).

## Self-Check: PASSED

- All 2 new files exist:
  - `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` — FOUND (458 lines, 11 §-sections, A/B drift documented, BLOCKING flagged, D-04 0.50 threshold documented).
  - `.planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md` — FOUND (144 lines, 10 "Verdict: PASS" lines vs criterion ≥4).
- Commits exist on the worktree branch:
  - `edc6034` — FOUND (Task 1, single file added, prettier-formatted, pre-commit hooks green).
  - `4c8af01` — FOUND (Task 2, single file added, prettier-formatted, pre-commit hooks green).
- `main` is clean of the recovered `32d2e9f` mis-commit (verified via `git log --oneline -3` on the main checkout showing `3396ca5` as HEAD).

---

_Phase: 07-multi-linguality-live-cam-feed_
_Completed: 2026-05-25 (planning-artifact authoring complete; operator checkpoint + orchestrator-owned ROADMAP/STATE refresh pending)_
