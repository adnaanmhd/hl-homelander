---
name: 07-16-task-8-handoff
phase: 07-multi-linguality-live-cam-feed
plan: 07-16-i18n-completion-and-truncation-PLAN.md
operator_walk_date: 2026-05-26
operator_walk_locale: hi-IN
operator_decision: route_to_follow_on_plan
status: blocked_on_regressions
---

# Plan 07-16 Task 8 — operator walk handoff

This file exists because `SendMessage` is not available in the current orchestrator's deferred tools — the executor agent `ac2f149bac0cdff08` (paused at Task 8) cannot be resumed directly. The verdict matrix is persisted here + in `07-HUMAN-UAT.md` so on next resume (or fresh orchestrator spawn) the next operator/agent picks up cleanly.

## TL;DR

Operator walked plan 07-16 Task 8 on Pixel 10a `5C161JEA304304` in hi-IN locale only. The walk surfaced **9 regressions** in the 07-16 Tasks 1-7 fixes plus **1 new escape** (G-29). Other locales NOT walked — most failures are universal-not-locale-specific, so other-locale walks would surface the same gaps.

Operator's call: **route to a follow-on plan** (proposed name: **07-17 — i18n regression sweep + Custom-range translation + Devanagari overflow on chips/buttons**) rather than inline patches to 07-16 Tasks 1-7.

## What I (the orchestrator) did

1. Pre-flight: killed Metro on :8081 (was free), verified worktree `local.properties` + `apkRollout/google-services.json` exist, confirmed adb device.
2. Incremental build: `JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug :app:installApkRolloutDebug` → BUILD SUCCESSFUL 1m 13s, GRADLE_EXIT=0, installed on Pixel 10a, lastUpdateTime 2026-05-26 21:45:53.
3. Sign-in failed with "network request failed" → diagnosed missing dev API on :8080 → started `pnpm --filter @humyn/api dev` after sourcing `apps/api/.env` (JWT_SIGNING_SECRET not loaded otherwise — append to memory `feedback_post_merge_test_env` to also cover dev). Fastify came up on :8080, hash-verify worker concurrency 4. Sign-in then succeeded.
4. Operator walked hi-IN through HomeScreen / TasksScreen / TaskCards / HistoryScreen empty / FilterSheet / Custom-range / RecordingScreen Practice / RotatePrompt / HandGate prompt / Live indicator / Help Center / Report-Problem sheet / Send-Request sheet.
5. 9 screenshots captured at `07-16-rewalk-evidence/2026-05-26-hi-IN/{2..10}.png`.
6. Verdict matrix written to `07-HUMAN-UAT.md` under `## Re-walk 2026-05-26` block.

## Verdict matrix (canonical)

See `07-HUMAN-UAT.md` `## Re-walk 2026-05-26 (07-16 Task 8, hi-IN only — BLOCKED on regressions)` section.

**FAIL rows:** G-15, G-17, G-20, G-21, G-22 (partial), G-24 (critical — both options same string), G-25, G-26, G-27 + new **G-29** (History tab label rendering as language name).
**PASS rows:** G-18 (cards), G-23 (Help Center header).
**NOT WALKED:** G-13, G-14, G-19, G-28 (HistoryRow needs a real recording first).

## Proposed follow-on plan (07-17) — high-level scope

Three buckets, distinct fix paths:

**Bucket A — translation / wire gaps (additive, no layout work):**

- G-20: extract trailing "and try one." into the hi-IN.json + 6 other locales for `history.empty.{firstTime,filtered}.body` — or rework the `<Trans>` interpolation so the entire sentence lives inside `t()`.
- G-21: translate the Custom-range sub-sheet — new keys for `history.filter.customRange.{title,from,to,placeholder,errorBothDates,cancel,apply}`. LLM-regen 7 non-en locales.
- G-24: fix the `tasks.setting.indoor` / `tasks.setting.outdoor` collision in hi-IN.json (and likely other locales — operator must spot-check; the same LLM might have collapsed both in 6 of the 7 locales). Add a unit test: assert `t('tasks.setting.indoor', { lng })` !== `t('tasks.setting.outdoor', { lng })` for all 8 locales.
- G-25: confirm `t('recording.practiceFallback')` is wired in RecordingScreen.tsx and the key exists in all 8 locale catalogs.
- G-29 (new): trace the third bottom-tab label render path — almost certainly using `i18n.language` or an `availableLocales[i18n.language].nativeName` lookup instead of `t('tabs.history')`. Spot-check `tabs.history` key exists in en.json + 7 locale catalogs.

**Bucket B — Devanagari/Indic-script overflow fixes (layout work):**

- G-15 (Live preview pill — text clipped) — increase pill min-width OR drop to a single icon-only state for narrow widths OR allow 2-line wrap.
- G-17 (category pills truncate when selected) — pills' active/bold variant width must accommodate the full label. Likely needs `flexShrink: 0` + `paddingHorizontal` increase OR a `numberOfLines={1}` + `adjustsFontSizeToFit minimumFontScale={0.75}` on the chip's `<Text>`. Also `paddingRight` on the chip row for safe-area.
- G-22 (Report chips + Cancel button truncate) — same chip width-fit fix as G-17. Cancel button `रद → रद्द` may be an i18n string fix (not truncation but a missing glyph in the value — verify the key's hi-IN value spells `रद्द` correctly).
- G-26 (RotatePrompt body still 1-line clips even with the prior fix) — investigate the parent container's `height` constraint; the prior `numberOfLines={2}` doesn't help if the parent caps height. Likely needs the parent to drop a fixed height in favor of `minHeight` + content-driven sizing.
- G-27 (HandGate prompt wraps but with detached line) — adjust `lineHeight` on the Text variant `recGatePrompt` in `ui/tokens.ts` OR remove the explicit lineHeight so it inherits from the system. Operator also flagged the Hindi prose reads awkwardly — consider a one-line LLM regen pass for `recording.handGatePrompt` in hi-IN to use the spec form `2 सेकंड तक अपने हाथ फ़्रेम में रखें` rather than `2 सेकंड के लिए हाथ फ्रेम में छोड़ें`.

**Bucket C — verification dimensions deferred to a second hardware walk:**

- G-13 (en + hi-IN reverse-search probes).
- G-14 (CompatCheck — needs fresh install).
- G-19 (TaskDetailsSheet — needs operator tap).
- G-28 (HistoryRow + day-section headers — needs a real recording in History; History was empty during this walk).

## Constraints (still LOCKED)

- D-16: no apps/api/ changes.
- I18N-21: no apps/mobile/ios/ changes.
- Drift gates: do NOT touch the ultrawide lens code (CLAUDE.md drift banner).

## Why this is a follow-on plan and not in-place patches to 07-16 Tasks 1-7

The 07-16 commit `a3673ad` is the closure of Tasks 1-7 with a clean test/grep gate pass. Patching in-place would muddy the audit trail. A new plan 07-17 keeps the 07-16 closure intact (with its `Tasks 1-7 PASS` provenance) and treats the 9 regressions as a discrete remediation pass — which is what the rewalk_protocol's "07-16 walk done — FAILs: ..." branch is designed for.

## Concrete next action for the next orchestrator

1. Read this file + `07-HUMAN-UAT.md ## Re-walk 2026-05-26` block.
2. Spawn `/gsd:plan-phase` for **plan 07-17** with the three-bucket scope above as the discuss/research seed.
3. Confirm with operator: in-place patches to 07-16 (faster, messier audit) vs. 07-17 follow-on plan (cleaner audit, slightly slower).
4. After 07-17 closes, the FULL 7-locale walk (hi-IN → pt-BR → es → bn-IN → ta-IN → te-IN → mr-IN) per the 07-16 plan's `<rewalk_protocol>` block can re-attempt. Only then does 07-16 Task 9 (07-HUMAN-UAT.md update with all-PASS rows), Task 10 (en.json key audit), Task 11 (07-16-SUMMARY.md), Task 12 (STATE + ROADMAP marks) become unblocked.

## Cleanup state at handoff time

- Dev API still running (Fastify :8080 + hash-verify worker concurrency 4) — left up so the operator can keep the device app live without re-doing the env-sourced startup. Kill with `pgrep -f "tsx watch src/index.ts\|tsx watch src/workers/hash-verify.ts" | xargs kill` when done.
- adb reverse tunnels still bound: tcp:8080, tcp:8081, tcp:4566.
- Worktree HEAD: `a3673ad` (07-16 Tasks 1-7) + this commit (planning artifacts only — no source changes).
- Operator's 9 screenshots persisted at `07-16-rewalk-evidence/2026-05-26-hi-IN/{2..10}.png`.
