---
status: open
phase: 03-humyn-capture-native-module
wave: 1
source: 03-WAVE1-SMOKE.md (D-WAVE-09 amendment protocol)
device: Pixel 10a (5C161JEA304304, Android 16 / API 36)
operator: Adnaan Mohammed
started: 2026-05-10T20:25:00+05:30
updated: 2026-05-10T20:25:00+05:30
---

## Context

Gaps surfaced during the Pixel 10a re-walk of `03-WAVE1-SMOKE.md` that were NOT in the frozen `02-COSMETIC-GAPS.md`. Per D-WAVE-09 protocol, these go HERE — not back into the frozen Phase 2 doc.

Each amendment is bounded enough to land in a focused follow-up plan (likely a Wave 1 polish plan, e.g. `03-1.1-wave1-polish` or rolled into a future TopBar-owning plan), per project memory `feedback_functionality_first_during_smoke.md`: do NOT rebuild mid-smoke.

## Amendments

### A1 — Permissions copy: tighten "while you hit record" framing

- **Section:** §3 Permissions (design-spec §3 + PERM-01..04)
- **What you saw:** Camera + Mic permission rows currently use longer copy that reads more like a manifesto than a runtime tooltip.
- **What it should be:** Replace the body copy under each permission row with `Used only while you hit record`. One line, no manifesto.
- **Owner file (likely):** `apps/mobile/src/screens/permissions/PermissionsScreen.tsx` (copy strings — locate the body Text under each row).
- **Severity:** Low (cosmetic).
- **Logcat ref:** —

### A2 — RigTutorial illustration is invisible

- **Section:** §6 Rig Tutorial
- **What you saw:** Rig page renders title + body + "Don't have a rig yet?" link + Next CTA, but the head-rig illustration area at the top is empty (white space). Screenshot captured during the walk.
- **Root cause:** Plan 03-01 explicitly scaffolded `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` as **transparent placeholders** (sizes 280/280/560/840 px) because the actual rig artwork was not provided. The asset slot is wired correctly in `RigTutorialScreen.tsx` and Plan 03-01's SUMMARY.md flagged this dependency on real artwork.
- **What it should be:** Real rig illustration (or at minimum a recognisable line-art placeholder) shipped at the same density-bucketed path so RN auto-picks the right resolution per device DPI.
- **Owner file:** `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` (asset replacement — no code change needed once real PNGs land).
- **Severity:** Medium (functional regression — page intent is unclear without the illustration, even with the title text).
- **Logcat ref:** screenshot path captured during walk.

### A3 — Bottom nav sits too low; lift it like Instagram

- **Section:** §7 Home tab
- **What you saw:** BottomNav touches the very bottom edge of the screen — feels visually cramped against the system gesture bar. Reference: Instagram's bottom nav floats with a small lift above the gesture indicator.
- **What it should be:** Raise the BottomNav by adding bottom padding/margin equivalent to ~8–12 dp above the device's bottom safe-area inset, so the nav row visually floats with the gesture bar instead of fighting it.
- **Owner file:** `apps/mobile/src/components/BottomNav.tsx` (style block — likely `paddingBottom` and/or `bottom` adjustment using `useSafeAreaInsets()`).
- **Severity:** Low (cosmetic).
- **Logcat ref:** screenshot captured during walk (Home tab, image #2).

### A4 — TopBar wordmark is a text stub on Home/Tasks/History; should be the orange logo

- **Section:** §7 Home tab + §8 Tasks tab + §9 History tab
- **What you saw:** TopBar renders the literal text "Humyn Labs" (typographic stub) on all 3 main tabs. Screenshot captured.
- **What it should be:** Replace the text wordmark with the orange logo `Image` from `apps/mobile/src/assets/logos/orange_logo.png` at an appropriate TopBar height (likely ~28–32 dp tall, aspect-preserving — the asset is 320×73 → ~3.5 dp tall per 1 dp wide).
- **Why this wasn't in Wave 1 already:** Plan 03-02 explicitly flagged this as a Known Stub in its SUMMARY ("HomeSkeletonScreen logo upgrade NOT done — TopBar refactoring deferred to a future TopBar-owning plan"). The user has now confirmed this should land — promoting from "Known Stub" to "real gap."
- **Owner file:** `apps/mobile/src/components/TopBar.tsx` (or wherever `useTabTopBarProps` plumbs the wordmark into the bar).
- **Severity:** Medium (the design-spec specifies the orange wordmark as the brand surface; the text stub is a noticeable downgrade).
- **Logcat ref:** screenshot captured during walk (image #2).

### A5 — CompatFail: drop the "What Now" section entirely

- **Section:** §4 Compat-fail merge (design-spec §4d + Plan 03-03 Task 3)
- **What you saw:** Merged CompatFailScreen renders the failure list + a "What Now" recovery section + Contact Support CTA. The "What Now" content reads as filler between the failure reason and the action — adds vertical noise without adding actionable info.
- **What it should be:** Drop the entire "What Now" block. Keep only:
  1. The failure list (the per-check rows that flagged a problem)
  2. Supplementary copy that contextualises the failure (a short line — not a multi-step recovery walkthrough)
  3. The Contact Support button
- **Owner file:** `apps/mobile/src/screens/compat/CompatFailScreen.tsx` (the "What Now" `View` block — including its heading and any wrapper styles).
- **Severity:** Medium (UX — the screen feels denser than it needs to; user explicitly called this out as filler).
- **Logcat ref:** —

### A6 — Splash + Sign-up logos are too large; shrink ~20%

- **Section:** §1 Splash + §2 Sign-up
- **What you saw:** Orange wordmark logo on Splash + Sign-up renders larger than the visual hierarchy wants — it dominates the top of each screen.
- **What it should be:** Reduce the logo's display size by ~20% on both surfaces. Splash + Sign-up currently render at the `lg` size (310×90 per `prototype.html .logo-img.lg`); target ≈248×72 (or the closest aspect-correct integer pair given the 320×73 source asset).
- **Owner files:**
  - `apps/mobile/src/screens/splash/SplashScreen.tsx` — splash logo style block
  - `apps/mobile/src/screens/signup/SignupScreen.tsx` — sign-up `styles.logo` (currently `{ width: 310, height: 90 }` after Plan 03-02 commit `d42c513`; reduce to ~248×72 or aspect-equivalent)
- **Severity:** Low (cosmetic — bounded scale change).
- **Logcat ref:** —

## Compat-fail walk apparatus (separate from amendments)

To walk §4 (Compat-fail merge), the operator chose option (a) from the runbook's §4 operator note — temporarily force a check failure via a debug-only edit. The toggle:

- **File:** `apps/mobile/src/services/compatService.ts`
- **Edit:** force `imuSustained100Hz.pass = false` for the smoke walk.
- **Revert:** the edit lives behind a TODO comment with `WAVE1-SMOKE-FORCE-FAIL` so the revert is obvious. After §4 walks pass, the operator reverts via `git checkout -- apps/mobile/src/services/compatService.ts` (no amendment entry needed — purely test apparatus).

## Sign-off

Amendments above DO NOT block §1–§3, §5–§12 walk completion. They are each bounded follow-ups for a Wave 1 polish plan (or absorbed into the next TopBar-owning plan). Wave 2 entry decision is the operator's at sign-off time:

- **Option 1 (recommended):** ship Wave 1 polish plan (`03-1.1-wave1-polish` or similar) covering A1–A4 BEFORE Wave 2 capture-foundation work begins. Keeps Wave 2 focused on Kotlin native modules without UI-polish noise mixing in.
- **Option 2:** continue to Wave 2 with these documented amendments; address them in a later cleanup wave alongside the deferred test-mock cleanup (Permissions store mock noise from `1b4b06d`).
