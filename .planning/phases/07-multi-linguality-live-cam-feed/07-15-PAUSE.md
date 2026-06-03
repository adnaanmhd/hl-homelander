---
status: paused
phase: 07-multi-linguality-live-cam-feed
plan: 07-15-rewalk-and-verification-refresh
session_paused: 2026-05-26
pause_reason: hi-IN re-walk surfaced ~15 new gaps; phase needs a 07-16 cleanup cluster before 07-15 can complete
---

# Phase 7 Re-walk Pause — Resume Handoff

The Phase 7 multi-linguality cluster (07-10..07-14) was claimed complete by its closure agents (all SUMMARYs green, all narrow grep gates passing) and merged to `main` at commit `5879daf`. The operator-walked Wave-3 re-verification (plan 07-15) reached the §2 hi-IN deep walk and **surfaced ~15 new English-on-translated-surface escapes** that the closure agents' narrow grep gates did not catch.

This is the bridge from the paused session to the resumed one.

## TL;DR

- **HEAD on main:** `5879daf` (Wave 1 + Wave 2 fully merged + `__DEV_DISABLE_LIVE_PREVIEW__` flag deleted at `f9ea52f`)
- **In-flight worktree:** `worktree-agent-a38e22c00ef00a5e2` (locked) — 07-15 agent at Bundle 1 checkpoint, only commit is the small pre-flight runbook annotation `e79cc68`. **Status: ABANDON.** The 07-15 rewalk cannot complete with G-14..G-28 open; the new session should either merge `e79cc68` (cosmetic only) or discard the worktree and start clean after 07-16 lands.
- **Newly-surfaced gaps (G-14..G-28):** captured in `07-HUMAN-UAT.md` under the "Wave-3 Re-Walk Findings" section. Evidence screenshots in `07-15-rewalk-evidence/img-{1,3,4,5,6,7,8,9,10,11,12,13}.png`.
- **Operator directive (verbatim, 2026-05-26 17:30 IST):** _"i want to do full deep walk, skip nothing. You run the commands, handle the builds, etc. I will only interact with the device."_ Then after walking §1 PASS + §2 hi-IN partial: _"might I say, what a shit job you've done on this one."_
- **G-13 (search bug)** is still open, parked, joined now by G-14..G-28. All 16 gaps must close before 07-15 can re-walk.
- **Routing already chosen** (operator chose "Run 07-15 first; fold G-13 + any new findings into one cleanup plan after"). With G-14..G-28 now in the bag, the **07-16 cleanup-plan** scope is locked.

## What landed before this session (cluster 07-10..07-14)

| Commit    | Plan  | Claim                                                        | Reality (hi-IN walk)                                                                                                                                                                                                                                                                   |
| --------- | ----- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f72ecaf` | 07-10 | Live-preview Surface keep-mounted + §9 A/B drift             | ✓ Genuinely closed. §9 A/B Δp99 +3.8% (within noise floor).                                                                                                                                                                                                                            |
| `f61d3d9` | 07-11 | i18n sweep — G-02..G-07 + G-09 closed across 8 surfaces      | Partial. CompatCheck strings translated but TRUNCATED (G-14). History filter SHEET still English (G-21). RecordingScreen task title still English (G-25). Rotate + hand-gate prompts truncated (G-26, G-27).                                                                           |
| `957439c` | 07-13 | Help Center body translation                                 | Body ✓ but header bar "Help Center" still English (G-23).                                                                                                                                                                                                                              |
| `203dea8` | 07-12 | taskCatalog body 86×7 = 602 slots translated                 | Tasks list + TaskDetailsSheet + RecordingScreen task title still ALL English (G-18, G-19, G-25, G-28). Root cause needs investigation — either the catalog file IS translated but the screen reads from a different source, OR the catalog file still has skeleton-English carve-outs. |
| `ac85e73` | 07-14 | COSMETIC-01 Signup consent centered; COSMETIC-02/03 by 07-10 | Not re-walked yet (we paused before §3). Likely fine.                                                                                                                                                                                                                                  |
| `f9ea52f` | n/a   | Removed `__DEV_DISABLE_LIVE_PREVIEW__` flag (debt cleanup)   | ✓ done, mobile typecheck + livePreviewState 8/8 tests green.                                                                                                                                                                                                                           |

## Newly-surfaced gaps (full list)

Detail + fix-path-each in `07-HUMAN-UAT.md` "Wave-3 Re-Walk Findings" section.

| Gap  | Surface                                                                     | Class                                  |
| ---- | --------------------------------------------------------------------------- | -------------------------------------- |
| G-14 | CompatCheck Hindi labels TRUNCATED (img-3)                                  | overflow / layout                      |
| G-15 | "Live" indicator left-aligned in recording (no screenshot)                  | layout                                 |
| G-16 | HomeScreen stats-card "today" period chip English (img-1)                   | missing `t()` wire                     |
| G-17 | TasksScreen category filter chips English (img-4)                           | missing `t()` wire                     |
| G-18 | TasksScreen task cards in English — G-08 REGRESSION (img-4)                 | **critical — investigate 07-12 work**  |
| G-19 | TaskDetailsSheet task data in English — downstream of G-18 (img-5)          | **critical — investigate 07-12 work**  |
| G-20 | History empty-state copy English (img-6)                                    | missing `t()` wire                     |
| G-21 | History "Filter by" bottom-sheet English — G-07 partial regression (img-7)  | missing `t()` wire on the sheet        |
| G-22 | Report Problem sheet issue-category chips English (img-8)                   | missing `t()` wire                     |
| G-23 | Help Center app-bar title "Help Center" English (img-9)                     | missing `t()` wire                     |
| G-24 | Send Request Task sheet category chips + Indoor/Outdoor English (img-10)    | missing `t()` wire                     |
| G-25 | RecordingScreen task-name in app-bar English (img-11/12)                    | downstream of G-18 OR independent wire |
| G-26 | Rotate-to-landscape prompt TRUNCATED (img-11)                               | overflow / layout                      |
| G-27 | Hand-gate prompt TRUNCATED (img-12)                                         | overflow / layout                      |
| G-28 | History row "Uploaded at HH:MM" + "FEEDBACK (COMING SOON)" English (img-13) | missing `t()` wire                     |

Plus the previously-parked **G-13** (server-side `ts_vector` tokenizer — `"recyclable"` returns 0 results).

## Proposed 07-16 plan scope

Open the 07-16 plan with this scope. The operator directive _"skip nothing"_ implies a full 7-locale hardware re-walk for 07-16, not just hi-IN.

1. **Investigate G-18 root-cause first.** Plan 07-12's SUMMARY claimed `taskCatalog.body.test.ts` 15/15 + 602 TaskBody slots translated. Either (a) `taskCatalog.i18n.ts[hi-IN]` is NOT actually translated (skeleton-English carve-out somewhere), (b) the TasksScreen / TaskDetailsSheet / RecordingScreen read from a different source, OR (c) the dev DB seed re-overwrote with English values. Trace: `apps/mobile/src/services/tasksApi.ts` → does it hit the server or read the i18n file? Whichever path it takes, ensure the active-locale entries flow end-to-end. This is the BIGGEST gap (3 screens affected: G-18/G-19/G-25), and the second-biggest if you count G-28's task-name source.
2. **Backend `ts_vector` tokenizer fix (G-13).** Hit `apps/api/src/.../tasks-search` route. Likely needs `to_tsquery('english', query)` or `plainto_tsquery` on the query side. Pure backend — no device interaction.
3. **`t()` wire additions** for G-16, G-17, G-20, G-21, G-22, G-23, G-24, G-28. Each is a small grep-and-wire: add the key to `en.json`, add the call site, regen the 7 non-English catalogs via `pnpm i18n:generate`.
4. **Devanagari overflow / truncation fixes** for G-14, G-26, G-27, G-15 (G-15 is alignment, not overflow). These are layout fixes — `numberOfLines`, `adjustsFontSizeToFit`, container width, flex-wrap, `flexShrink`.
5. **Hardware re-walk for 07-16 closure**, then **re-walk 07-15** with the operator across all 7 locales.

## Dev environment state (carried over)

- **Device:** Pixel 10a `5C161JEA304304` paired
- **APK on device:** `5879daf` (assembleApkRolloutDebug, installed by the orchestrator before this session's 07-15 dispatch)
- **Active locale on device:** hi-IN (the operator selected this in §1 of the walk)
- **Dev API + worker:** running on `:8080`
- **Metro:** running on `:8081` from `apps/mobile/` of the main repo
- **LocalStack:** on `:4566`
- **adb reverse tunnels:** all three ports up (8080 + 8081 + 4566)
- **App state at pause:** force-stopped between walking sessions; ChooseLanguage suppressed by MMKV `locale.chosen_at` key (set during §1 walk)

When the new session resumes, the operator may need to relaunch the app + sign in again (`m.adnaan161@gmail.com`).

## What the new session should do

1. **Read this file first** + `07-HUMAN-UAT.md` "Wave-3 Re-Walk Findings" + the 12 screenshots in `07-15-rewalk-evidence/`.
2. **Decide worktree fate** for `worktree-agent-a38e22c00ef00a5e2`: either merge `e79cc68` (small runbook annotation, harmless) or `git worktree remove --force` + `git branch -D`. Recommendation: merge, since the runbook annotation is useful for the eventual 07-15 re-walk after 07-16 lands.
3. **Open plan 07-16** via `/gsd:plan-phase 07 --gaps` (gap-closure flag) OR by manually authoring `07-16-i18n-completion-and-truncation-PLAN.md`. Plan scope per the section above.
4. **Execute 07-16** via `/gsd:execute-phase 07 --wave 4` (or similar). The wave gating will need to be set up — Wave 3 (07-15) is currently in_progress; 07-16 is a NEW wave.
5. **Hardware re-walk 07-16 closure** with operator (all 7 locales, full deep — operator directive).
6. **Re-attempt 07-15** with the operator across the canonical Bundle 1 (§1-§3) + Bundle 2 (§4-§8) + wrap-up (§10-§11).
7. **Phase 7 closeout:** code-review gate, regression gate, schema-drift gate, gsd-verifier agent, `gsd-sdk phase.complete`, close phase todos, evolve PROJECT.md.

## Resume command

```
/gsd:execute-phase 7
```

(The workflow's discovery step will see 07-15 has no SUMMARY, see the new 07-15-PAUSE.md, and route appropriately. Alternatively, the new session can be invoked with the prompt `"Read .planning/phases/07-multi-linguality-live-cam-feed/07-15-PAUSE.md and continue Phase 7 closure"`.)

## Honest assessment (for the next session's awareness)

The 07-10..07-14 cluster passed its narrow grep gates AND its narrow file-list gates. What it failed was the _integration test the operator's eyes are_. The closure agents acted on the gap inventory G-02..G-10 verbatim, and the gap inventory itself was incomplete — surfaces like RecordingScreen task-title-in-app-bar, History "Filter by" bottom-sheet (vs the chip), Help Center header bar (vs body), Report Problem option chips, Request Task category chips, HomeScreen stats period chip, Recording rotate-prompt / hand-gate-prompt overflow — none of these were in the operator's original Wave-2 synthesis list, so none of the closure agents had them in scope. **The lesson for 07-16: don't trust the gap inventory; grep the codebase for ALL user-visible string literals + walk hardware ourselves before claiming closure.**
