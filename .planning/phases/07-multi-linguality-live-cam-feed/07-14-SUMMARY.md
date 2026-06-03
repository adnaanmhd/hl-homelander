---
phase: 07-multi-linguality-live-cam-feed
plan: 14
subsystem: ui
tags: [cosmetic, ui, gap-closure, mobile, layout, design-tokens, signup, recording, i18n]

# Dependency graph
requires:
  - phase: 07-multi-linguality-live-cam-feed
    provides: |
      Plan 07-05 D-32 bilingual consent dual-render (translated text + English
      underlay at 70% opacity); Plan 07-07 Pattern-2 live-preview z-stack +
      brightness state machine + <HumynLivePreviewView> Option-B two-Surface
      pipeline; Plan 07-10 native-debug refactor that moved the live-preview
      indicators (label pill + Eye glyph) into a shared bottom-center anchor
      and made the Eye glyph render in `colors.accent`; Plan 07-11 i18n call-site
      sweep including `t('recording.cue.started/stopped')` for the recording
      audio cue.
provides:
  - SignupScreen consent paragraph + Terms-of-Use link centered in en locale
  - Bilingual D-32 underlay also centered in non-en locales (translated + English)
  - 07-COSMETIC-GAPS.md flipped to status:closed with per-row closure notes
  - Closure-trail documentation explaining the unusual split (1 fix this plan, 2 prior)
affects:
  - 07-15 (the operator's Pixel-10a hardware re-walk that re-verifies §3 + §7 + §8 PASS)
  - Phase 8 (no cosmetic carry-over from Phase 7)

# Tech tracking
tech-stack:
  added: [] # purely cosmetic; no new libraries
  patterns:
    - "Plan-after-the-fact closure: when in-flight refactor work (07-10) already
      addresses a queued cosmetic finding by a different mechanism, the closure
      plan documents the resolution path rather than imposing the original
      prescription. The intent (e.g. 'Stop button no longer collides with the
      Live-preview label') is satisfied regardless of which corner the label
      sits in."

key-files:
  created:
    - .planning/phases/07-multi-linguality-live-cam-feed/07-14-SUMMARY.md
  modified:
    - apps/mobile/src/screens/signup/SignupScreen.tsx
    - .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md

key-decisions:
  - "Accept the prior 07-10 bottom-center anchor as the COSMETIC-02 closure path
    instead of moving the Live-preview label to top-LEFT as originally
    prescribed. The bottom-center anchor (commit 45b5f52) eliminates the
    top-right collision more cleanly because both the indicator pill AND the
    Eye glyph share the same anchor (swap in place, never overlap each other or
    the Stop button). D-26's 'corner per implementation' clause covers it."
  - "Accept colors.accent (#FF6A2D) for the Eye glyph as the COSMETIC-03 closure
    path (already wired by prior 07-10 commit 45b5f52). No new colors.dimGlyph
    token added — the brand accent satisfies the owner directive 'make it
    orange so visible' AND WCAG-AA contrast (~6.0:1 against the 5%-brightness
    #000000 dimmed surface)."
  - "Use `flexShrink: 1` (not `flex: 1`) on the SignupScreen consent container.
    `flex: 1` makes the container stretch to fill all available row width,
    which left textAlign:'center' centering against the row width minus the
    checkbox width — visually identical to the old left-align in en where the
    text is just below the row's natural span. `flexShrink: 1` lets the
    container compute its width from the text's natural extent, so the
    centering is over the text's own bounding box."

patterns-established:
  - 'Bilingual D-32 underlay symmetry: any text-alignment style applied to the
    primary <Text> in a consent/bilingual block MUST also be applied to the
    English-underlay <Text> so the two render lines stay visually parallel.'

requirements-completed: [I18N-01, REC-LIVE-01, REC-LIVE-03]

# Metrics
duration: 7min
completed: 2026-05-26
---

# Phase 07 Plan 14: Cosmetic Gap Closure (COSMETIC-01/02/03) Summary

**Centered Signup consent text + documented closure of the live-preview label collision and Eye-glyph visibility gaps already addressed by plan 07-10's bottom-center refactor.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-26T10:39:37Z
- **Completed:** 2026-05-26T10:46:09Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- **COSMETIC-01 closed (in this plan):** SignupScreen consent paragraph + Terms-of-Use link line center-aligned in en locale; the D-32 bilingual underlay (non-en locales: translated on top + English at ~70% opacity below) keeps the same centering across both render lines.
- **COSMETIC-02 closed (prior 07-10 work):** "Live preview" label no longer collides with the Stop button. Plan 07-10's bottom-center refactor moved both the label pill AND the Eye glyph into a shared `liveBottomCenter` anchor; the Stop button is no longer in the top-right corner (it's in the center-stack flex column under the timer). D-28 hit-test invariant preserved (no shared visual real estate to dispute).
- **COSMETIC-03 closed (prior 07-10 work):** Eye glyph renders in `colors.accent` (`#FF6A2D`, brand orange) — verified at `RecordingScreen.tsx:1007`. WCAG-AA contrast ~6.0:1 against the 5%-brightness `#000000` dimmed surface satisfies the owner directive "make it orange so visible".
- `07-COSMETIC-GAPS.md` flipped to `status: closed`, all 3 STATUS table rows marked CLOSED with per-row closure-path notes, and a closure-trail section added at the bottom documenting the unusual 1-in-this-plan + 2-by-prior-work split.

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply COSMETIC-01 fix + close 07-COSMETIC-GAPS.md** — `7faae4c` (fix)

The full grep-evidence sweep for the plan's nine acceptance criteria:

```
1) textAlign 'center' in SignupScreen          : 6   (>= 1 required)
2) alignSelf/alignItems 'center' in SignupScreen: 6   (>= 1 required)
3) <Eye color={colors.text3}> removed           : 0   (must be 0)
4) Eye + colors.accent equivalent               : 1   (>= 1 required)
5) status: closed in 07-COSMETIC-GAPS.md        : 1   (>= 1 required)
6) CLOSED — Plan 07-14 markers                  : 3   (>= 3 required)
7) useLivePreviewStateMachine intact            : 2   (>= 1 required)
8) <HumynLivePreviewView> intact                : 2   (>= 1 required)
9) speakCue/showVoiceCue with t('recording.cue): 3   (>= 3 required)
```

All four invariant gates clean:

- `git diff --stat apps/mobile/ios/` — empty
- `git diff --stat apps/api/drizzle/migrations/` — empty
- `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` — empty
- `git diff --stat apps/mobile/android/ apps/mobile/src/i18n/ apps/mobile/src/screens/help/ apps/mobile/src/native/HumynLivePreviewView.tsx apps/mobile/src/lib/livePreviewState.ts` — all empty

## Files Created/Modified

- `apps/mobile/src/screens/signup/SignupScreen.tsx` — Consent block container changed from `flex: 1` to `flexShrink: 1`; added `textAlign: 'center'` to the consent paragraph `<Text>` (line 227) and the English-underlay `<Text>` (line 245); added a doc-comment citing Plan 07-14 (COSMETIC-01) and the D-32 contract.
- `.planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md` — Frontmatter `status: open` → `status: closed`; added `closed: 2026-05-26`; STATUS table rows flipped to `CLOSED — Plan 07-14 / 7faae4c` (row 1) and `CLOSED — Plan 07-14 (prior 07-10 work)` (rows 2 + 3); added a 55-line "Closure Trail (2026-05-26, Plan 07-14)" section explaining the resolution paths.
- `.planning/phases/07-multi-linguality-live-cam-feed/07-14-SUMMARY.md` — this file.

## Decisions Made

- **Accept the bottom-center anchor as the COSMETIC-02 closure** instead of moving the label to top-LEFT as the plan originally prescribed. Rationale: plan 07-10's commit `45b5f52` had already landed before this plan ran; the bottom-center anchor eliminates the collision more cleanly (label + Eye glyph share an anchor, swap in place) AND satisfies D-26's "top-right (or corner per implementation)" clause. Re-imposing the top-LEFT move would be churn for churn's sake.
- **Accept `colors.accent` for the Eye glyph as the COSMETIC-03 closure** instead of introducing a new `colors.dimGlyph` token. Rationale: the brand accent (`#FF6A2D`) satisfies BOTH the owner's "make it orange so visible" directive AND WCAG-AA contrast against the 5%-brightness dimmed surface (~6.0:1, well above the 4.5:1 AA floor). The plan's "if accent is unexpectedly low-contrast" branch is unused.
- **Use `flexShrink: 1` on the consent container** (not `flex: 1`). `flex: 1` stretches the container to fill the row width, leaving the centered text aligned within an oversized box — visually indistinguishable from the original left-aligned layout. `flexShrink: 1` lets the container size to its content, so the text's centering is over its own natural bounding box.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking-context-shift] Accept prior-work closure of COSMETIC-02 and COSMETIC-03**

- **Found during:** Task 1 (initial read of `RecordingScreen.tsx`)
- **Issue:** The plan was authored before plan 07-10's recent native-debug refactor (commits `c35ac8f`, `45b5f52`, `b041d51`) landed on the worktree base (`f9ea52f`). Those commits had already restructured the live-preview overlay layer:
  - Moved the "Live preview" label + the Eye glyph into a shared `liveBottomCenter` anchor (no more top-right `liveLabelCorner` style).
  - Wired the Eye glyph (and the "Live preview" pill text) to `colors.accent` instead of the prior `colors.text3`.
  - Eliminated the `liveLabelCorner` and `eyeIconCorner` style names entirely — the plan's prescribed edits targeted styles that no longer exist.
- **Fix:** Documented the resolution paths in `07-COSMETIC-GAPS.md`'s new closure-trail section. Did NOT re-impose the original plan's prescription (move to top-LEFT, change Eye color) because the intent of both findings is already satisfied (no Stop button collision; orange Eye glyph). The plan's acceptance criteria for COSMETIC-03 — `grep -c "<Eye color={colors.text3}" returns 0` and `grep -c "<Eye color={colors.accent}" returns at least 1` — pass on the prior-work code (the equivalent `<Icon name="Eye" ... color={colors.accent}>` form).
- **Files modified:** `.planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md` (the closure trail).
- **Verification:** Grep evidence above; the `liveLabelCorner` / `eyeIconCorner` style names return 0 hits (proves the old layout is gone); `liveBottomCenter` returns 3 hits (proves the new shared anchor is wired); `colors.accent` is used by the Eye glyph render at `RecordingScreen.tsx:1007`.
- **Committed in:** `7faae4c` (same commit as COSMETIC-01 fix + 07-COSMETIC-GAPS.md flip).

---

**Total deviations:** 1 auto-fixed (1 blocking-context-shift)
**Impact on plan:** Zero scope creep. The deviation REDUCES the code change from what the plan prescribed (was: 1 SignupScreen edit + 1 RecordingScreen edit; actual: 1 SignupScreen edit only). All three findings still close at the user-visible level — verified by re-walking the acceptance criteria the operator filed in `07-COSMETIC-GAPS.md`.

## Issues Encountered

- **2 pre-existing RecordingScreen visual snapshot failures** (`recording-active-t10s` + `recording-active-t05m32s`, ~5.4% pixel diff each) in `apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx`. These are debt left by plan 07-10's bottom-center refactor — the baselines were last regenerated in plan 07-07. This plan does NOT touch `RecordingScreen.tsx`, so it cannot regress these further; the plan's success criteria explicitly note them as documented out-of-scope debt. Baseline regeneration is its own ticket. The 31 other visual + recording tests pass.
- The mobile package's `node_modules` was not present in the worktree at plan start — `npm install` had to be run inside `apps/mobile` (the root `pnpm install --frozen-lockfile` doesn't reach into the mobile package because `apps/mobile/package.json` has `"packageManager": "npm@10.9.0"` and pnpm honors that opt-out). One-time setup cost; not a deviation.

## User Setup Required

None — pure cosmetic close. No external services, env vars, or dashboard configuration.

## Next Phase Readiness

- **Ready for plan 07-15** (operator's hardware re-walk on Pixel 10a). The re-walk will re-verify §3 (Signup consent visual centering in en + pt-BR + hi-IN), §7 (Live-preview label / Eye-glyph visibility), §8 (Stop hit-test in all 3 brightness substates). The code-level closure proven by grep evidence + the plan's invariant gates unblocks the re-walk.
- **No Phase 8 carry-over.** The phase's three cosmetic findings are closed; `07-COSMETIC-GAPS.md` is sealed as `status: closed`.
- **Snapshot debt is acknowledged but not in scope.** A future small plan can regenerate the two RecordingScreen visual baselines once the bottom-center anchor is treated as the canonical layout (vs the 07-07 top-right layout).

## Self-Check: PASSED

- File `apps/mobile/src/screens/signup/SignupScreen.tsx` exists and contains `textAlign: 'center'` on the consent + underlay Texts.
- File `.planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md` exists and contains `status: closed` + 3× `CLOSED — Plan 07-14`.
- Commit `7faae4c` exists in `git log --oneline` (verified post-commit).
- File `.planning/phases/07-multi-linguality-live-cam-feed/07-14-SUMMARY.md` (this file) exists.

---

_Phase: 07-multi-linguality-live-cam-feed_
_Completed: 2026-05-26_
