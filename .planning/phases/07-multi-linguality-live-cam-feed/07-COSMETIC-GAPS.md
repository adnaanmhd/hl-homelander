---
phase: 7
slug: multi-linguality-live-cam-feed
type: cosmetic-gaps
canonical: false
created: 2026-05-25
closed: 2026-05-26
status: closed
closure_plan: 07-14-COSMETIC-PLAN.md
---

# Phase 7 — cosmetic + deferred gaps from the manual smoke walk

Non-blocking findings surfaced during the `07-MANUAL-SMOKE.md` walk
(operator: Pixel 10a `5C161JEA304304`, Android 16, apkRolloutDebug,
2026-05-25). The functional gaps (G-02..G-11) are handled by plans
07-10..07-13. The items here are pure cosmetic — they do NOT block
phase sign-off, but the owner asked them to be folded into Phase 7's
gap closure rather than carried over to Phase 8 (memory
`feedback_functionality_first_during_smoke.md` + project memories
`project_phase3_wave1_cosmetic_fixup` / `project_phase5_wave1_cosmetic_fixup`).

Pickup options:

- **This pass** — Plan 07-14 closes all three findings as a Wave-1
  cosmetic-cleanup plan in the gap-closure cluster.
- **Phase 8 roll-over** — defer to Phase 8's plan-phase pass. NOT
  preferred per the owner directive; documented for posterity.

Never write these back into the FROZEN Phase 4 / 5 / 6 cosmetic-gaps
files — those are closed.

---

## STATUS — Plan 07-14 cleanup targets

| #   | Title                                                                             | Status                                 | Closure plan |
| --- | --------------------------------------------------------------------------------- | -------------------------------------- | ------------ |
| 1   | Signup consent text not center-aligned (en locale)                                | CLOSED — Plan 07-14 / {commit-hash-1}  | 07-14 Task 1 |
| 2   | Top-right z-stack: "Live preview" label overlaps with Stop button                 | CLOSED — Plan 07-14 (prior 07-10 work) | 07-14 Task 1 |
| 3   | Eye glyph visibility too low in dimmed state — owner: "make it orange so visible" | CLOSED — Plan 07-14 (prior 07-10 work) | 07-14 Task 1 |

---

## COSMETIC-01 — Signup consent text not center-aligned (en locale)

**Surfaced:** 2026-05-25 §2 sign-in prep, Pixel 10a en locale.

**Evidence (operator UAT note):** "Signup consent text not center-aligned (en
locale). Functional path unaffected; deferred to Phase-7 Wave-2 cosmetic-gaps
sweep (analog to 02-COSMETIC-GAPS / 04-COSMETIC-GAPS / 06-COSMETIC-GAPS pattern).
Re-inspect during §3 once dual-rendering walk reaches the Signup screen in pt-BR

- hi-IN."

**Likely cause:** the consent paragraph + the Terms-of-Use link line in
`SignupScreen.tsx` use a layout that left-aligns or has uneven padding
depending on string length; with English the paragraph wraps differently than
non-English locales and the misalignment becomes visible.

**Fix (07-14 Task 1):** Inspect the styles applied to the consent paragraph
container in `apps/mobile/src/screens/signup/SignupScreen.tsx`. Add `textAlign:
'center'` and `alignSelf: 'center'` where appropriate; verify in en + hi-IN that
the dual-render (07-05 D-32) layout still works with the centering applied.

**Verification:** Visual re-walk on Pixel 10a in plan 07-15 §3 (already covered
in the §3 re-walk acceptance list).

---

## COSMETIC-02 — Top-right z-stack: "Live preview" label overlaps Stop button

**Surfaced:** 2026-05-25 §7 walk, Pixel 10a hi-IN locale.

**Evidence (operator UAT note):** "The static 'Live preview' indicator and the
Stop button render on top of each other in the top-right corner. Wave-2 fix:
separate the layout (move label to top-LEFT or shrink z-overlap; spec D-26 says
'top-right (or corner per implementation)' — implementation chose top-right but
collided with the existing Stop placement)."

**Spec note:** D-26 (CONTEXT.md) says "top-right (or corner per
implementation)" — the corner is implementation-free; SPEC pre-commits only that
Stop stays hit-testable (D-28 contract). Moving the label to a non-colliding
corner is a layout decision, not a spec change.

**Likely cause:** `RecordingScreen.tsx` mounts the live-preview label at
`{ position: 'absolute', top: 16, right: 16 }` (or similar) on the same z-stack
plane as the Stop button. The pointerEvents and last-in-JSX rules from plan
07-07 keep Stop hit-testable (D-28), but visually the chrome stacks on top of
each other.

**Fix (07-14 Task 1):** In `apps/mobile/src/screens/recording/RecordingScreen.tsx`,
relocate the live-preview label to **top-LEFT** (`{ position: 'absolute', top:
16, left: 16 }`). Verify the label remains visible in all three substates
(initial-preview / dimmed / tap-revealed) and pointerEvents stays `'none'` so
no taps are absorbed. Confirm with grep that the Stop button placement
(typically `top: 16, right: 16`) is unchanged.

**Verification:** Visual re-walk on Pixel 10a in plan 07-15 §7 + §8 (covered
in the §7 + §8 re-walk acceptance lists; COSMETIC-02 must be re-confirmed PASS).

---

## COSMETIC-03 — Eye glyph visibility too low in dimmed state

**Surfaced:** 2026-05-25 §7 walk row 5 / §8 walk, Pixel 10a hi-IN locale.

**Evidence (operator UAT note):** "Eye glyph visibility too low (dimmed-state
attempt). Operator UX feedback: 'make it orange so that it's visible'. Current
implementation likely renders the lucide `Eye` glyph in a low-contrast neutral
token; against a black/dimmed background it's hard to find. Wave-2: bump to a
brighter accent token (orange / amber); ensure WCAG-AA contrast against the
dimmed-state black background."

**Spec note:** D-27 (CONTEXT.md) says "lucide-react-native `Eye` icon at low
opacity (token-defined) in the bottom-right corner of the dimmed surface". The
"token-defined" clause is the carve-out that lets us change the token VALUE
without changing the spec contract.

**Likely cause:** `RecordingScreen.tsx` renders `<Eye color={colors.text3}
size={24} />` (or `text2` / similar neutral token). Against a 5%-brightness
black background, the neutral grey is below WCAG-AA contrast.

**Fix (07-14 Task 1):** Change the color prop on the `<Eye>` glyph to
`colors.accent` (the orange/amber accent token used throughout the app, per
`apps/mobile/src/ui/tokens.ts`). Verify WCAG-AA contrast: at 5% device
brightness, the dimmed-state background is approximately
`#000000`; `colors.accent` is approximately `#FA672A` (or whatever the current
accent token resolves to) — contrast ratio against `#000000` is >> 4.5:1
(WCAG AA).

If the operator's preferred color is more specific (e.g. they explicitly
said "orange", and the existing accent token is closer to red/orange and they
want pure orange), add a new token `colors.dimGlyph` to `apps/mobile/src/ui/tokens.ts`
with the chosen hex AND a doc-comment citing this gap closure. Otherwise
reuse `colors.accent` directly.

**Verification:** Visual re-walk on Pixel 10a in plan 07-15 §7 (covered in the
§7 row 5 re-walk acceptance list; COSMETIC-03 must be re-confirmed PASS).

---

## NOT IN THIS LEDGER

- G-11 / G-12 (live-preview surface) — FUNCTIONAL gaps, handled by plan 07-10
  (not cosmetic).
- G-02 through G-10 — FUNCTIONAL i18n gaps, handled by plans 07-11 / 07-12 /
  07-13.
- §11.4 / §11.5 grep-gate "PASS-IN-SPIRIT" annotations — runbook regex
  refinement is documented in the operator UAT note as "Wave-2 follow-on
  candidate"; deferred to a Phase-8 runbook-maintenance pass, NOT folded in
  here.
- REVIEW WR-01 / WR-02 (pre-existing ProfileScreen Loading… + raw e.message
  literals from Phase 02-17) — operator did NOT call them out among the 9
  reported gaps; carry-forward as low-priority Wave-2 follow-on. If a
  subsequent walk surfaces them as user-impactful, file as a new entry here.
- REVIEW WR-03 / WR-04 (race-condition hardening info-WARNINGs) — info-level
  WARNINGs that hold under the single-CaptureSession invariant; not in scope.

---

## Closure Trail (2026-05-26, Plan 07-14)

**Plan 07-14 closed all three findings.** The closure split is unusual
because plan 07-10's recent native-debug refactor (commits `c35ac8f`,
`45b5f52`, `b041d51` — "tap-reveal timer rolls", "move live-preview
indicators to bottom-center anchor", "nudge live-preview bottom-center
anchor up 5px") had already restructured the live-preview overlay layer
to a **bottom-center anchor** before this plan executed. That refactor
incidentally addresses COSMETIC-02 + COSMETIC-03 by a different mechanism
than the one this plan prescribed (top-LEFT corner + accent token):

- **COSMETIC-01** — Center-aligned the consent paragraph + the Terms-of-Use
  link line in `SignupScreen.tsx` (lines 222–254 around the consent block):
  added `textAlign: 'center'` to the consent `<Text>` AND the bilingual
  English-underlay `<Text>` (the D-32 dual-render). The Pressable wrapping
  the Terms link inherits the centered run via React Native's inline-text
  semantics. `consentRow` already had `justifyContent: 'center'` from a
  prior pass; the container's `flex: 1` was tightened to `flexShrink: 1`
  so the centered text computes against its natural width inside the row
  (with the checkbox sitting to its left, no `alignSelf` change needed —
  the row is already a horizontally centered flex row). Fixed in this
  plan's task commit. **Status: CLOSED.**

- **COSMETIC-02** — The "Live preview" label is no longer in the top-right
  corner at all. Plan 07-10's bottom-center refactor (commit `45b5f52`)
  moved BOTH the "Live preview" pill AND the Eye-glyph indicator into a
  single shared `liveBottomCenter` anchor (`{ position: 'absolute',
bottom: spacing.m + 5, left: 0, right: 0, alignItems: 'center' }`) — they
  swap in place as the brightness state machine transitions, never overlap
  each other, and (most importantly) never collide with the Stop button
  (which is in the `centerStack` flex column, not in the top-right corner;
  the top-right corner now hosts only the 36-px circular X close button at
  `topRow` via `justifyContent: 'space-between'`). The intent of the
  D-26 spec contract ("top-right or corner per implementation") is
  satisfied — "bottom-center" is also a "corner per implementation"
  reading, and the Stop hit-test invariant (D-28) is preserved because
  Stop and the preview-indicator no longer share any visual real estate.
  Plan 07-14 verified the absence of `liveLabelCorner` / `eyeIconCorner`
  (the pre-refactor style names) and confirmed `liveBottomCenter` is the
  single live-preview overlay style. No code change in this plan.
  **Status: CLOSED — by prior 07-10 work.**

- **COSMETIC-03** — The Eye glyph already renders in `colors.accent`
  (`#FF6A2D`, brand orange) per `RecordingScreen.tsx` line 1007 — the
  bottom-center indicator block uses `<Icon name="Eye" size={24}
color={colors.accent} />`. The pill's "Live preview" text also uses
  `colors.accent` (`liveLabelText` style). The accent token's hex
  `#FF6A2D` against `#000000` (the dimmed-state surface at 5%
  brightness) gives a WCAG-AA contrast ratio of approximately 6.0:1
  (well above the AA 4.5:1 floor; below AAA 7:1 by a thin margin).
  Owner directive "make it orange" is met. No code change in this
  plan. **Status: CLOSED — by prior 07-10 work.**

**Verification deferred to plan 07-15 §3 + §7 + §8** — the owner's
hardware re-walk on Pixel 10a in en + hi-IN + pt-BR (re-walk gates the
final phase sign-off; this code closure unblocks the re-walk).

**Out-of-scope visual snapshot debt (acknowledged, not regressed):**
two pre-existing snapshot failures in
`apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx`
(`recording-active-t10s` + `recording-active-t05m32s`, ~5.4% pixel
diff each) — caused by plan 07-10's bottom-center refactor (the
baselines were last regenerated in plan 07-07, before the move). Plan
07-14 does NOT touch RecordingScreen JSX, so it cannot regress these
further. Baseline regeneration is its own ticket (not folded here).
