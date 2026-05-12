---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 02
subsystem: docs
tags: [requirements, roadmap, bullmq, redis, sqs, runbook, anti-fraud-descope, doc-polish]

# Dependency graph
requires:
  - phase: 04-handdetector-recording-ux-practice-tutorial
    provides: 04-COSMETIC-GAPS.md (D-09 doc-polish bucket), 04-MANUAL-SMOKE.md, 04-UI-SPEC.md
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: 05-CONTEXT.md (D-03/D-04/D-09 decisions), 05-VALIDATION.md (per-task map filled during planning), 05-01 (Wave-1 cleanup code)
provides:
  - FRAUD-05/06 formally retired to REQUIREMENTS.md §v2 (dated descope note, matrix rows → §v2)
  - Phase 5 re-titled "Upload Pipeline & Hash-Verify Worker" across ROADMAP.md (overview, list-bullet, section heading, progress table)
  - ROADMAP Success Criterion #5 (fraud surface) deleted; rescinded duration_seconds:0 tolerance note removed (D-03a); the 5-MiB cellular-part reconciliation note added inline to REQUIREMENTS UP-02 + ROADMAP SC#1
  - CLAUDE.md Redis carve-out (on-device upload queue vs the BullMQ hash-verify worker queue) + backend pins bullmq@5.76.8 / ioredis@5.10.1 / @aws-sdk/client-sqs@3.1044.0 / Redis 7.x; STACK.md "Backend — Hash-Verify Worker Queue" subsection
  - 04-MANUAL-SMOKE.md §2/§3 refreshed (120ms vibrate / en-US female TTS / 2×250ms gate dwell / live <HumynGateCameraView> preview / onSegmentStart-onSegmentComplete RN-bridge events / no is_practice in finalized JSON per D-08); owner deviations reflected into design-spec.md §6 + 04-UI-SPEC.md § Copywriting
  - .planning/runbooks/05-wave1-cleanup-smoke.md (D-03 force-quit-discards / D-05 device-distress→Home / D-06 alert tones at full volume / D-09 RotatePrompt glyph eyeball / §6 UP-08 iOS-gap note / §7 sign-off)
  - 05-VALIDATION.md per-task map re-verified against the executed task set; the 05-02-XX rows flipped to ✅ green
affects: [05-03, 05-04, 05-05, 05-06, 05-07, 05-08, phase-7-observability, ios-milestone]

# Tech tracking
tech-stack:
  added:
    [
      bullmq@5.76.8,
      ioredis@5.10.1,
      '@aws-sdk/client-sqs@3.1044.0',
      'Redis 7.x (ElastiCache prod / redis:7-alpine dev) — pins recorded only; no code',
    ]
  patterns:
    [
      'Redis carve-out: the on-device upload queue is MMKV/native-module-owned and Postgres-free; the hash-verify worker queue is the one Redis usage at MVP (BullMQ-on-Redis-on-ECS per VERIFY-01/07)',
    ]

key-files:
  created:
    - .planning/runbooks/05-wave1-cleanup-smoke.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - CLAUDE.md
    - .planning/research/STACK.md
    - deferred-decisions.md
    - design-spec.md
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/04-UI-SPEC.md
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md
    - .planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-VALIDATION.md

key-decisions:
  - 'FRAUD-05 (per-account daily upload-rate cap) and FRAUD-06 (pre-payout fraud dashboard) descoped to §v2 2026-05-12 (CONTEXT.md D-04); the MVP upload path is fully uncapped per account'
  - "Phase 5 re-titled 'Upload Pipeline & Hash-Verify Worker' (anti-fraud clause removed); directory slug 05-upload-pipeline-hash-verify-worker-anti-fraud is intentionally left unchanged"
  - "Cellular S3 part size reconciled to 5 MiB (S3's minimum non-final part size); idea-brief.md §7.1 still states 2 MB and is not edited — the dated reconciliation note is added inline to REQUIREMENTS UP-02 + ROADMAP SC#1"
  - 'The hash-verify worker queue is the one Redis carve-out at MVP (BullMQ-on-Redis-on-ECS); the on-device upload queue stays MMKV-backed and Postgres-free'
  - "UP-08's iOS clause is 'covered' for this phase by formally recording it as a documented gap (iOS deferred to §v2 IOS-01..07), not by implementing it"

patterns-established:
  - "Doc-only Wave-1 housekeeping plan: every requirement ID it 'completes' is completed by formally retiring it to §v2, not by building it"
  - 'Wave-1 cleanup smoke runbook mirrors the §-numbered checklist style of 04-MANUAL-SMOKE.md; mid-smoke nits go to *-COSMETIC-GAPS.md (runbook §7 amendments protocol), never the FROZEN amendment files'

requirements-completed: [FRAUD-05, FRAUD-06, UP-08]

# Metrics
duration: ~50min
completed: 2026-05-12
---

# Phase 5 Plan 02: Wave-1 Docs / Housekeeping Summary

**FRAUD-05/06 retired to §v2, Phase 5 re-titled "Upload Pipeline & Hash-Verify Worker", ROADMAP fraud-surface criterion + rescinded duration_seconds:0 note removed, CLAUDE.md/STACK.md Redis carve-out + BullMQ/Redis/SQS pins added, 04-MANUAL-SMOKE/design-spec/04-UI-SPEC refreshed with the shipped owner deviations, and a new Wave-1 cleanup smoke runbook (D-03/D-05/D-06/D-09 + the UP-08 iOS-gap note).**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-05-12T10:35:00Z (approx)
- **Completed:** 2026-05-12T11:27:00Z
- **Tasks:** 3
- **Files modified:** 9 (8 modified + 1 created)

## Accomplishments

- **Anti-fraud descope housekeeping (D-04/D-04d):** FRAUD-05/06 moved from the Phase-5 `### Anti-fraud` group to REQUIREMENTS.md §v2 with the dated "Descoped to §v2 2026-05-12 — see CONTEXT.md D-04" note; the Requirements-Matrix rows now read `§v2` / `Deferred (2026-05-12)`. ROADMAP.md re-titled Phase 5 in all four spots (overview paragraph, top list-bullet, section heading, progress table), dropped FRAUD-05/06 from the Requirements line, deleted Success Criterion #5 (Phase-5 SC list now has exactly 4 numbered items), removed the rescinded `duration_seconds: 0` tolerance note (D-03a), and added the dated 5-MiB cellular-part reconciliation note inline to both REQUIREMENTS UP-02 and ROADMAP SC#1. `deferred-decisions.md` got the FRAUD-05/06 descope line + an update to the IMU-liveness entry's stale "MVP anti-fraud =" summary.
- **CLAUDE.md Redis carve-out + backend pins:** the "Do NOT Use → Redis at MVP" line replaced with the on-device-upload-queue-vs-hash-verify-worker-queue carve-out; the backend pins block gained `bullmq@5.76.8` / `ioredis@5.10.1` / `@aws-sdk/client-sqs@3.1044.0` / `Redis 7.x`. STACK.md grew a "Backend — Hash-Verify Worker Queue" subsection mirroring those pins + the carve-out note; the "What NOT to Use → Redis for upload queue" row reworded to scope it to the on-device queue and point at the worker carve-out.
- **D-09 doc polish:** 04-MANUAL-SMOKE.md §2/§3 step text refreshed (120 ms vibrate not 80 ms; en-US female-leaning TTS not en-IN; 2×250 ms gate dwell not 5×400 ms; live `<HumynGateCameraView>` preview from `'ready'` onward; `onSegmentStart`/`onSegmentComplete` RN-bridge events not `onSessionStart`/`onSessionStop` logcat lines; no `is_practice` in the finalized `{base}.json` per D-08 — `task_id: __practice__` + `files/practice/` segregation instead); finding #5 + the §3 acceptance line updated; a header note records the UP-08 iOS gap. design-spec.md §6 gained the PracticeIntro shortened-copy owner deviation (commit `eaaa1fe`) + the RigTutorial camera-framing-tip deviation, and its "Voice synthesis" line is now en-US female-leaning (owner deviation from the en-IN mandate). 04-UI-SPEC.md § Copywriting reflects the same (PracticeIntro body shortened + muted line removed + RigTutorial tip + the gate-pass voice cue → en-US female-leaning).
- **Wave-1 cleanup smoke runbook:** `.planning/runbooks/05-wave1-cleanup-smoke.md` (93 lines) — §1 pre-flight (install Wave-1 build, full media volume) · §2 D-03 force-quit-discards verification (>30 s record → force-quit → relaunch → no recovered-segment toast, `files/recordings/` empty, `CaptureLaunchSweep` logs the discard) · §3 D-05 device-distress→Home nav (battery ≤5 % / thermal abort → Home; practice-mid-onboarding edge; normal sub-60 s discard still resets to ready) · §4 D-06 alert tones at FULL media volume (520 Hz battery beep + 440→560→680 Hz thermal sequence — only chase a HumynBeep/SoundPool fix if still silent) · §5 D-09 RotatePrompt glyph eyeball · §6 UP-08 iOS-gap note · §7 sign-off (verdict + findings → `*-COSMETIC-GAPS.md` per the runbook §7 amendments protocol).
- **05-VALIDATION.md re-verify:** the Per-Task Verification Map still matches the executed task set (no `5-XX` placeholder rows; `nyquist_compliant: true` intact); the three 05-02-XX rows flipped to ✅ green now that their automated verifies pass; the self-referential `'5-XX-XX'` literal in row 05-02-03's verify command swapped for an anchored `'^| 5-XX'` regex so the command no longer matches its own text.

## Task Commits

Each task was committed atomically:

1. **Task 1: Retire FRAUD-05/06 to §v2 + re-title Phase 5 + ROADMAP trims** — `fdb5b22` (docs)
2. **Task 2: CLAUDE.md Redis carve-out + backend pins + STACK.md Redis pin** — `dfa7de4` (docs) + a follow-on deviation commit `2d34e3c` (docs — CLAUDE.md anti-fraud banner alignment, see Deviations)
3. **Task 3: Doc polish (D-09) — 04-MANUAL-SMOKE refresh + design-spec/UI-SPEC owner deviations + Wave-1 cleanup smoke runbook + VALIDATION re-verify** — `34ad42b` (docs)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md) — see the final `docs(05-02): complete …` commit.

## Files Created/Modified

- `.planning/runbooks/05-wave1-cleanup-smoke.md` _(created)_ — the Wave-1 cleanup on-hardware smoke runbook (D-03/D-05/D-06/D-09 + the UP-08 iOS-gap note)
- `.planning/REQUIREMENTS.md` — FRAUD-05/06 relocated to §v2 with the dated descope note; matrix rows → §v2/Deferred; UP-02 gets the 5-MiB cellular-part reconciliation note
- `.planning/ROADMAP.md` — Phase 5 re-titled in all four spots; FRAUD-05/06 dropped from the Requirements line; Success Criterion #5 deleted; SC#1 gets the 5-MiB note; rescinded `duration_seconds:0` tolerance note removed
- `CLAUDE.md` — Redis carve-out + backend BullMQ/Redis/SQS pins; the IMU-liveness banner's stale "MVP anti-fraud =" line updated to drop the now-descoped upload-rate cap
- `.planning/research/STACK.md` — new "Backend — Hash-Verify Worker Queue" subsection + carve-out note; the "What NOT to Use → Redis for upload queue" row reworded
- `deferred-decisions.md` — FRAUD-05/06 descope line added to Fraud & integrity; the IMU-liveness entry's MVP-anti-fraud summary updated
- `design-spec.md` — §6 PracticeIntro shortened-copy + RigTutorial-tip owner deviations; "Voice synthesis" line → en-US female-leaning (now tracked by git for the first time, per this plan's `files_modified`)
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-UI-SPEC.md` — § Copywriting: PracticeIntro body shortened + muted line removed + RigTutorial tip + gate-pass voice cue → en-US female-leaning
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md` — §2/§3 step text refreshed; finding #5 + §3 acceptance updated; header UP-08 iOS-gap note
- `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-VALIDATION.md` — 05-02-XX rows → ✅ green; the self-referential `5-XX-XX` literal in 05-02-03's verify command fixed

## Decisions Made

- Followed the plan as specified. The slug `05-upload-pipeline-hash-verify-worker-anti-fraud` stays unchanged (per must_haves); the four ROADMAP.md FRAUD-05/06 mentions that remain are all §v2-pointing references (overview, list-bullet, Phase-5 goal descope note, plan-listing) — none assign FRAUD-05/06 to Phase 5, which is what the acceptance criteria require.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical / consistency] Updated CLAUDE.md's IMU-liveness banner to drop the now-descoped per-account upload-rate cap**

- **Found during:** Task 2 (CLAUDE.md edits)
- **Issue:** CLAUDE.md's "IMU-liveness fraud check deferred" banner stated "**MVP anti-fraud = Play Integrity at sign-in + per-account daily upload-rate cap + the on-device one-shot hand gate only.**" — that contradicts the FRAUD-05 §v2 descope this very plan applies. CLAUDE.md is a hard-constraints document; leaving the contradiction in place would mislead every downstream agent.
- **Fix:** Changed the banner to "MVP anti-fraud = Play Integrity at sign-in + the on-device one-shot hand gate only." with a parenthetical noting FRAUD-05/06 were themselves descoped to §v2 on 2026-05-12 (D-04) + the "fully uncapped per account" fact; the trail now points at §v2 FRAUD-03..06.
- **Files modified:** `CLAUDE.md`
- **Verification:** `grep` confirms the banner no longer says "per-account daily upload-rate cap" in the MVP-anti-fraud sentence.
- **Committed in:** `2d34e3c` (a separate follow-on commit after the main Task-2 commit `dfa7de4`)

**2. [Rule 1 - Bug] Fixed a self-referential verify command in 05-VALIDATION.md**

- **Found during:** Task 3 (05-VALIDATION.md re-verify)
- **Issue:** Row 05-02-03's automated verify command contained `! grep -q '5-XX-XX' …05-VALIDATION.md`, but the literal string `5-XX-XX` then appears inside that very command cell — so the command will always fail when run against the file (it matches its own text). It also tripped Task 3's own `<automated>` verify chain.
- **Fix:** Replaced the placeholder-absence check with an anchored regex `! grep -qE '^\| 5-X{2}' …05-VALIDATION.md` (matches an actual unfilled placeholder _row_ — `| 5-XX...` at line start — without the literal `5-XX-XX` substring appearing anywhere). The intent (no unfilled placeholder rows) is preserved.
- **Files modified:** `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-VALIDATION.md`
- **Verification:** `! grep -qE '^\| 5-X{2}' …05-VALIDATION.md && echo ok` → `ok`; the full Task-3 `<automated>` chain now passes.
- **Committed in:** `34ad42b` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical/consistency, 1 bug)
**Impact on plan:** Both auto-fixes were necessary for doc consistency / verify-command correctness. No scope creep — both stayed within the plan's own files.

## Issues Encountered

- The plan's Task 1 action text referenced "line 5" for the "Also surface in the plan proper: …`duration_seconds: 0` tolerance" sentence, but that sentence actually lives in the line-20 Phase-5 list-bullet (the overview paragraph is line 5). Removed it where it actually was. The `duration_seconds: 0` string no longer appears anywhere in ROADMAP.md (line 198's "rescinded duration_seconds:0 note" is `duration_seconds:0` without a space and only describes what 05-02 does — that's accurate plan-listing prose).

## User Setup Required

None — no external service configuration required (docs-only plan; the BullMQ/Redis/SQS pins are recorded for the Wave-2 backend plans, no infra stood up here).

## Next Phase Readiness

- Wave 1 of Phase 5 is complete (05-01 code cleanup + 05-02 docs/housekeeping). Wave 2 (05-03 backend infra/worker + 05-04 mobile native foundation) can proceed: the CLAUDE.md Redis carve-out unblocks the BullMQ-on-Redis design, the STACK.md pins are recorded, and FRAUD-05/06 are off the Phase-5 requirement set so the verifier won't block on them.
- The Wave-1 cleanup smoke runbook (`.planning/runbooks/05-wave1-cleanup-smoke.md`) is authored — it should be walked on-hardware before Phase 5 is considered done (D-06's alert-tone re-check at full volume + D-03's force-quit-discards verification + D-05's device-distress→Home + D-09's RotatePrompt glyph eyeball).
- No blockers.

## Self-Check: PASSED

- All created/modified files verified present on disk (10/10).
- All task commits verified in git log (`fdb5b22`, `dfa7de4`, `2d34e3c`, `34ad42b`).

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
