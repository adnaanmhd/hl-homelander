---
phase: 07-multi-linguality-live-cam-feed
plan: 15
subsystem: planning
tags: [smoke, sign-off, verification, gap-closure, mobile, rewalk, superseded]
status: superseded_by_07_17
---

# 07-15 — Re-walk + Verification Refresh — SUPERSEDED BY 07-17

## What this plan was

The terminal Phase-7 plan: an operator-walked hardware re-walk of every §2/§3/§4/§6/§7/§8/§10/§11 section in `07-MANUAL-SMOKE.md` that had FAIL / PARTIAL / BLOCKED / PENDING verdicts, followed by a verification-refresh update to `07-VERIFICATION.md` + conditional ROADMAP/STATE advance.

## Why it's superseded

The plan was paused on 2026-05-26 after the first re-walk attempt surfaced 15 new English-on-translated-surface escapes (G-14..G-28) that the closure agents' grep gates didn't catch. Per `07-15-PAUSE.md`:

> _"the rewalk cannot complete with G-14..G-28 open; the new session should either merge `e79cc68` (cosmetic only) or discard the worktree and start clean after 07-16 lands."_

The recovery path was:

1. **Plan 07-16** — closes G-13..G-28 via 86×8 taskCatalog wiring + 34 new keys (commit `5879daf` → `612161a`).
2. **Plan 07-17** — closes 9 FAIL rows from 07-16's hi-IN walk + 4 Bucket C re-walks + G-29 + G-15 (initial code: commits `9bed0eb..c95074f`; re-walk fix cluster: `840e6e2..9dbb1d5`).
3. **07-17 Task 7 operator-walked verdict (2026-05-27)** — a full 7-locale hardware deep walk on APK `9dbb1d5` (`5C161JEA304304`, Android 16, apkRolloutDebug), backend running `pnpm dev` (Fastify API + hash-verify worker), LocalStack + Postgres + Redis up. Verdict captured in `07-HUMAN-UAT.md` "Re-walk 2026-05-27 (Plan 07-17 attempt 2 → attempt 3, APK `9dbb1d5`) — ALL PASS" block. Operator verbatim: _"i'm happy with all languages, push the changes."_

That walk satisfies 07-15's terminal-walk acceptance criteria in full:

- §2 — full per-locale loop (7 non-en locales × chrome translation + body translation): PASS
- §3 — bilingual dual-render visual (pt-BR + hi-IN): PASS
- §4 — TTS voice-vs-text in hi-IN: PASS (en-US female-leaning per CLAUDE.md owner deviation, text translated)
- §6 — reverse-search with translated catalog: PASS (Stage 1.5 substring + token-aggregate added in commit `9dbb1d5`)
- §7 — live-preview visual rendering: PASS (G-32 RotatePrompt + G-33 liveEyeHint stretched per re-walk)
- §8 — tap-reveal rolling + Stop hit-test: PASS
- §9 — A/B drift (the previously-BLOCKING gate): PASS — already walked as plan 07-10 Task 3 terminal acceptance (Δp99 +3.8%, within noise floor)
- §10 with-preview-ON cancel gate: PASS
- §11 grep gates: all 5 invariants empty diff vs main (iOS / migrations / Phase-6 cosmetic-gaps / capture pipeline / taskCatalog body byte-identical)

## Disposition

- 07-15's source-of-truth artifacts (`07-MANUAL-SMOKE.md`, `07-HUMAN-UAT.md`, `07-VERIFICATION.md`) are updated by the 07-17 cluster commits — there is no separate 07-15 commit chain.
- The single 07-15 commit `e79cc68` (pre-flight readiness annotation in `07-MANUAL-SMOKE.md`) was abandoned with the original 07-15 worktree per the PAUSE doc's recommendation; the 07-17 cluster captures equivalent readiness state in its `## Re-walk Pre-flight` block.
- ROADMAP.md Phase 7 entry + STATE.md current-phase pointer are advanced as part of the Phase-7 closeout commit (post 07-17 merge), NOT by a separate 07-15 commit.

## Files modified by 07-15

(none — superseded)

## Self-Check: PASSED (by inheritance from 07-17 Task 7 operator walk)

---

_Phase: 07-multi-linguality-live-cam-feed_
_Plan: 15 — superseded by plan 17_
_Original status: paused (2026-05-26 per `07-15-PAUSE.md`)_
_Superseded status recorded: 2026-05-27_
