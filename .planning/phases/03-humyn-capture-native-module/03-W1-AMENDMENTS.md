---
status: closed-by-03-11-2026-05-10
phase: 03-humyn-capture-native-module
wave: 1
source: 03-WAVE1-SMOKE.md (D-WAVE-09 amendment protocol)
device: Pixel 10a (5C161JEA304304, Android 16 / API 36)
operator: Adnaan Mohammed
started: 2026-05-10T20:25:00+05:30
updated: 2026-05-10T17:35:00Z
closed-by: Plan 03-11 (Tasks 1–5 — A1+A3 / A4 / A5 / A6 / A2)
a2_status: closed-by-prototype-svg-raster # rig PNGs rasterized from prototype.html:1224-1235 (locked design source)
re_re_walked_on: 2026-05-10 # post-Plan-03-11 verification walk on Pixel 10a — all A1–A6 confirmed closed on-device
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

**Closure:** Plan 03-11 Task 1 — body string tightened to 'Used only while you hit record' verbatim. PermissionsScreen idle-state body Text now renders the single-line tooltip; recovery (denied / partial) copy unchanged. PermissionsScreen.test.tsx Test 1 assertion updated in lockstep. Visual baseline unchanged (text-only diff, structural-render-tree-PNG encoder is shape-only).

### A2 — RigTutorial illustration is invisible

- **Section:** §6 Rig Tutorial
- **What you saw:** Rig page renders title + body + "Don't have a rig yet?" link + Next CTA, but the head-rig illustration area at the top is empty (white space). Screenshot captured during the walk.
- **Root cause:** Plan 03-01 explicitly scaffolded `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` as **transparent placeholders** (sizes 280/280/560/840 px) because the actual rig artwork was not provided. The asset slot is wired correctly in `RigTutorialScreen.tsx` and Plan 03-01's SUMMARY.md flagged this dependency on real artwork.
- **What it should be:** Real rig illustration (or at minimum a recognisable line-art placeholder) shipped at the same density-bucketed path so RN auto-picks the right resolution per device DPI.
- **Owner file:** `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` (asset replacement — no code change needed once real PNGs land).
- **Severity:** Medium (functional regression — page intent is unclear without the illustration, even with the title text).
- **Logcat ref:** screenshot path captured during walk.

**Closure:** Plan 03-11 follow-up (post-escalation, 2026-05-10) — user directed orchestrator to rasterize the canonical rig SVG from `prototype.html:1224-1235` (the design source of truth per CLAUDE.md "Designs LOCKED" rule). Rendered via `sharp(svgBuffer).resize(N,N,{fit:'contain',background:{alpha:0}}).png()` at 280/280/560/840 dp into `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png`. Final byte sizes 11611 / 11611 / 24678 / 38633 — all clear the ≥4096 byte real-PNG threshold. RigTutorialScreen visual baseline unchanged (encoder is shape-only — same 280×280 canvas, same require path); full visual suite 10/10 passes; TS clean.

### A2 — closure attempt (Plan 03-11 Task 5)

**Disposition:** escalate-to-user.

**Reason:** No source rig artwork found in `design-system/illustrations/`
(directory does not exist) or anywhere under
`/Users/adnaan/Documents/hl-homelander/` outside the four transparent
placeholders shipped by Plan 03-01. The probe ran:

```bash
ls -la design-system/illustrations/rig.png \
       design-system/illustrations/rig.svg \
       design-system/illustrations/rig*.png 2>&1 | grep -v "No such"
find design-system -iname "rig*" -type f
find . -maxdepth 2 -iname "rig*" -type f | grep -v ".planning" | grep -v "apps/mobile/src/assets"
```

All three queries returned empty. The `design-system/` directory contains
`fonts/`, `logos/`, `task-icons/`, and a brand-book PDF — no `illustrations/`
sub-tree. Per CLAUDE.md "Designs LOCKED" rule, the planner does not
generate substitute artwork (line-art SVG, AI-generated PNG, or otherwise)
without design sign-off.

**Required from user:** drop a real rig PNG (≥ 4096 bytes, transparent
background, ~280 dp wide intrinsic) at
`/Users/adnaan/Documents/hl-homelander/design-system/illustrations/rig.png`
and re-run a follow-up plan that uses the Plan 03-01 / Pattern 65
density-bucket re-export (sharp(source).trim() → 280/560/840 dp). The
RigTutorialScreen.tsx require path is unchanged so the asset replacement
needs no code change.

**Status:** A2 ORIGINALLY ESCALATED, then RESOLVED by post-escalation rasterization of `prototype.html` rig SVG into the four density buckets (see A2 Closure stamp above). All six amendments (A1–A6) closed by Plan 03-11.

### A3 — Bottom nav sits too low; lift it like Instagram

- **Section:** §7 Home tab
- **What you saw:** BottomNav touches the very bottom edge of the screen — feels visually cramped against the system gesture bar. Reference: Instagram's bottom nav floats with a small lift above the gesture indicator.
- **What it should be:** Raise the BottomNav by adding bottom padding/margin equivalent to ~8–12 dp above the device's bottom safe-area inset, so the nav row visually floats with the gesture bar instead of fighting it.
- **Owner file:** `apps/mobile/src/components/BottomNav.tsx` (style block — likely `paddingBottom` and/or `bottom` adjustment using `useSafeAreaInsets()`).
- **Severity:** Low (cosmetic).
- **Logcat ref:** screenshot captured during walk (Home tab, image #2).

**Closure:** Plan 03-11 Task 1 — useSafeAreaInsets()-driven `paddingBottom: insets.bottom + 12` and `height: 68 + insets.bottom` lift the nav above the gesture indicator. Vitest mock for react-native-safe-area-context returns zero insets, so test layout matches pre-edit (paddingBottom 12, height 68); on-device the row floats by insets.bottom + 12 dp.

### A4 — TopBar wordmark is a text stub on Home/Tasks/History; should be the orange logo

- **Section:** §7 Home tab + §8 Tasks tab + §9 History tab
- **What you saw:** TopBar renders the literal text "Humyn Labs" (typographic stub) on all 3 main tabs. Screenshot captured.
- **What it should be:** Replace the text wordmark with the orange logo `Image` from `apps/mobile/src/assets/logos/orange_logo.png` at an appropriate TopBar height (likely ~28–32 dp tall, aspect-preserving — the asset is 320×73 → ~3.5 dp tall per 1 dp wide).
- **Why this wasn't in Wave 1 already:** Plan 03-02 explicitly flagged this as a Known Stub in its SUMMARY ("HomeSkeletonScreen logo upgrade NOT done — TopBar refactoring deferred to a future TopBar-owning plan"). The user has now confirmed this should land — promoting from "Known Stub" to "real gap."
- **Owner file:** `apps/mobile/src/components/TopBar.tsx` (or wherever `useTabTopBarProps` plumbs the wordmark into the bar).
- **Severity:** Medium (the design-spec specifies the orange wordmark as the brand surface; the text stub is a noticeable downgrade).
- **Logcat ref:** screenshot captured during walk (image #2).

**Closure:** Plan 03-11 Task 2 — TopBar wordmark Image (28 dp tall × aspectRatio 320/73 ≈ 122.7 dp wide) replaces the literal "Humyn Labs" Text node. Single component edit propagates to Home/Tasks/History via Pattern 71. 4 test files updated to query by accessibilityLabel 'Humyn Labs Capture wordmark'. 3 visual baselines refreshed (Home, Tasks, History).

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

**Closure:** Plan 03-11 Task 3 — `<View style={styles.bullets}>` block + 3 recovery-bullet-\* Text nodes deleted; recoveryBody tightened to single sentence "This phone doesn't meet the recording requirements." Orphaned `bullets` and `bullet` style entries removed. CompatFail visual baseline refreshed; CompatFailScreen.test.tsx Test 6 rewritten + Test 6b added as regression guard.

### A6 — Splash + Sign-up logos are too large; shrink ~20%

- **Section:** §1 Splash + §2 Sign-up
- **What you saw:** Orange wordmark logo on Splash + Sign-up renders larger than the visual hierarchy wants — it dominates the top of each screen.
- **What it should be:** Reduce the logo's display size by ~20% on both surfaces. Splash + Sign-up currently render at the `lg` size (310×90 per `prototype.html .logo-img.lg`); target ≈248×72 (or the closest aspect-correct integer pair given the 320×73 source asset).
- **Owner files:**
  - `apps/mobile/src/screens/splash/SplashScreen.tsx` — splash logo style block
  - `apps/mobile/src/screens/signup/SignupScreen.tsx` — sign-up `styles.logo` (currently `{ width: 310, height: 90 }` after Plan 03-02 commit `d42c513`; reduce to ~248×72 or aspect-equivalent)
- **Severity:** Low (cosmetic — bounded scale change).
- **Logcat ref:** —

**Closure:** Plan 03-11 Task 4 — explicit `style={{ width: 256, height: 58, resizeMode: 'contain' }}` on Splash + Sign-up Image. ~20% smaller than the Plan 03-02 intrinsic render; aspect within ±1% of source 320:73 (256/58 ≈ 4.41:1). Visual baselines unchanged because the structural-render-tree-PNG encoder is shape-only (style diffs do not shift the wireframe); source-level grep gate verifies the change.

## Compat-fail walk apparatus (separate from amendments)

To walk §4 (Compat-fail merge), the operator chose option (a) from the runbook's §4 operator note — temporarily force a check failure via a debug-only edit. The toggle:

- **File:** `apps/mobile/src/services/compatService.ts`
- **Edit:** force `imuSustained100Hz.pass = false` for the smoke walk.
- **Revert:** the edit lives behind a TODO comment with `WAVE1-SMOKE-FORCE-FAIL` so the revert is obvious. After §4 walks pass, the operator reverts via `git checkout -- apps/mobile/src/services/compatService.ts` (no amendment entry needed — purely test apparatus).

## Sign-off

Amendments above DO NOT block §1–§3, §5–§12 walk completion. They are each bounded follow-ups for a Wave 1 polish plan (or absorbed into the next TopBar-owning plan). Wave 2 entry decision is the operator's at sign-off time:

- **Option 1 (recommended):** ship Wave 1 polish plan (`03-1.1-wave1-polish` or similar) covering A1–A4 BEFORE Wave 2 capture-foundation work begins. Keeps Wave 2 focused on Kotlin native modules without UI-polish noise mixing in.
- **Option 2:** continue to Wave 2 with these documented amendments; address them in a later cleanup wave alongside the deferred test-mock cleanup (Permissions store mock noise from `1b4b06d`).

## Plan 03-11 closure (2026-05-10)

Plan 03-11 landed Option 1: Wave 1 polish plan covering A1, A3, A4, A5, A6. A2 originally escalated for missing source artwork; resolved in a follow-up step the same day by rasterizing the canonical rig SVG from `prototype.html:1224-1235` (the locked design source per CLAUDE.md) into the four density buckets via `sharp`. All six amendments (A1–A6) now closed by Plan 03-11. Per-amendment closure stamps recorded inline above (search for `**Closure:**`).

## Post-Plan-03-11 re-re-walk (2026-05-10)

Adnaan Mohammed walked the runbook again on the same Pixel 10a after Plan 03-11 landed, with Claude Opus 4.7 driving adb. Build: `installApkRolloutDebug` → BUILD SUCCESSFUL in 47s on top of commit `b0d7305`. Device data fully cleared via `pm clear` so the cold-start gate, sign-up, permissions, compat, and rig-tutorial flows walked from scratch.

**On-device verification:**

| Amendment | UI hierarchy / measurement                                                                                                                                | Verdict  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1        | `text="Used only while you hit record"` (PermissionsScreen idle body)                                                                                     | ✓ closed |
| A2        | RigTutorialScreen renders rasterized prototype-SVG illustration; PNGs 11.6 / 24.7 / 38.6 KB at @1×/@2×/@3×                                                | ✓ closed |
| A3        | BottomNav 91.8 dp tall + 35.4 dp gap below tab content (matches `68 + insets.bottom` / `paddingBottom: insets.bottom + 12`)                               | ✓ closed |
| A4        | TopBar wordmark = `android.widget.ImageView` 122.7 × 28.2 dp (intrinsic 320×73 asset); Pattern 71 propagates identically to Tasks + History               | ✓ closed |
| A5        | CompatFailScreen "What Now" 3-bullet block deletion verified by source grep + Plan 03-11 baseline refresh; live walk skipped per runbook §4 operator note | ✓ closed |
| A6        | Sign-up wordmark measured 256 × 57.9 dp on Pixel 10a (matches explicit `width: 256, height: 58, resizeMode: 'contain'` from Plan 03-11 Task 4)            | ✓ closed |

Additional observations during the re-re-walk:

- §2 consent-gate Alert.alert("Please accept the Terms of Use to continue.") fires correctly when CTA tapped with consent unchecked.
- §3 auto-advances to Compat after Camera + Mic granted (no manual "Continue" tap — matches `PermissionsScreen.tsx:15` contract). Runbook §3 line 66 was stale; flipped in the same commit.
- §11 Pattern 72: force-stop via adb → relaunch → Google avatar visible in TopBar within ~2.7 s, no manual Profile detour.

**Wave 2 entry gate — D-WAVE-08 status:** ALL four conditions satisfied. Wave 2 plan-phase (Plan 03-04 capture-foundation-muxer-bridge) is **UNBLOCKED**.
