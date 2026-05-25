---
phase: 7
slug: multi-linguality-live-cam-feed
type: cosmetic-gaps
canonical: false
created: 2026-05-25
status: open
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

| #   | Title                                                                             | Status | Closure plan |
| --- | --------------------------------------------------------------------------------- | ------ | ------------ |
| 1   | Signup consent text not center-aligned (en locale)                                | OPEN   | 07-14 Task 1 |
| 2   | Top-right z-stack: "Live preview" label overlaps with Stop button                 | OPEN   | 07-14 Task 1 |
| 3   | Eye glyph visibility too low in dimmed state — owner: "make it orange so visible" | OPEN   | 07-14 Task 1 |

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
