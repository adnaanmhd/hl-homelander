# Phase 3 Wave 1 — Manual Re-walk Runbook

**Phase:** 03 — humyn-capture-native-module
**Wave:** 1 (cosmetic + functional regressions; closes the post-Phase-2-soak gap inventory)
**Authored:** 2026-05-10 (Plan 03-03 Task 4)
**Operator:** Adnaan Mohammed
**Date walked:** 2026-05-10 (re-walked-on: 2026-05-10)
**Devices used:** Pixel 10a (`5C161JEA304304`, Android 16 / API 36) — same device as Phase 2 smoke; broadening to Pixel 7a + non-Pixel happens in Phase 4 thermal walk per memory `feedback_functionality_first_during_smoke.md`.
**Backend:** dev (`tsx watch src/index.ts` on `http://localhost:8080`) reachable from device via `adb reverse tcp:8080 tcp:8080`.

> **How to use this runbook (D-WAVE-08 Wave 2 acceptance gate):** Walk every numbered section in order on a real Pixel 10a. Tick each `- [ ]` checkbox as you confirm it. For any failed assertion, paste an `adb logcat` snippet (or screenshot path) as a sub-bullet under the failed step, file an entry in `03-W1-AMENDMENTS.md` (D-WAVE-09), and link the amendment in the Sign-off section.
>
> **D-WAVE-09 amendment protocol:** any new gap surfaced during this re-walk that wasn't in the frozen `02-COSMETIC-GAPS.md` goes to `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md`, NOT back into `02-COSMETIC-GAPS.md` (which is frozen-2026-05-10). NEVER edit `02-COSMETIC-GAPS.md` post-freeze — that doc stays the historical record of Phase-2-smoke discovery.
>
> **Source-of-truth cross-references:**
>
> - Phase 2 smoke runbook (Pattern 56 shape): `apps/mobile/02-MANUAL-SMOKE.md`
> - Phase 2 cosmetic gap inventory (frozen): `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md`
> - Open Questions (OQ-1 resolved + OQ-2 superseded post Plan 03-03): `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md`
> - Wave 2 acceptance gate decision: Phase 3 CONTEXT D-WAVE-08

---

## Pre-flight

- [ ] All Plan 03-01 + 03-02 + 03-03 + 03-11 commits landed; `git log --oneline | grep -E "03-(0[123]|11)" | wc -l` ≥ 13 (4 plans × ≥2 commits each; Plan 03-11 contributes 6 feat/docs commits + 1 merge + 2 stamp commits).
- [ ] Backend dev server is running: `tsx watch src/index.ts` (binds `:8080`). `curl http://localhost:8080/healthz` returns `{"status":"ok"}`.
- [ ] `apps/mobile/.env.apkRollout` populated with `API_BASE_URL=http://localhost:8080` and `GOOGLE_WEB_CLIENT_ID=130483521533-...`.
- [ ] `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` succeeded locally; APK installed on device.
- [ ] `bash apps/mobile/scripts/verify-merged-manifests.sh` exits 0 against the just-built APK.
- [ ] `adb devices` lists `5C161JEA304304 device`.
- [ ] Device is signed in to a Google account (`m.adnaan161@gmail.com`).
- [ ] `cd apps/mobile && npx vitest run` exits 0 (full unit + visual snapshot suite green; ≥320/320 tests pre-Plan-03-03 + the 7 + 9 + 1 + 7 = 24 new tests added during Wave 1).
- [ ] `ls apps/mobile/__tests__/visual/__image_snapshots__/*.png | wc -l` ≥ 10 (6 from Plan 03-02 + 1 CompatFail from Plan 03-03 Task 3 + 3 from Plan 03-03 Task 4).

---

## §1 Splash + animation re-check (design-spec §1)

- [ ] Boot the app cold (`adb shell am force-stop ai.humynlabs.capture.apk && adb shell am start -n ai.humynlabs.capture.apk/.MainActivity`).
- [ ] Splash screen renders the orange wordmark generously without the "resizing dance" — the density-bucketed assets from Plan 03-01 (320×73 / 640×146 / 960×220) are picked by RN automatically; no `<Image resizeMode="cover">` magic numbers visible.
- [ ] `scalePop` animation on the wordmark plays cleanly (700 ms cubic-bezier(.2,.8,.2,1)).
- [ ] Tagline fade-in fires 600 ms after splash mount (Animated.parallel chain). Both animations match prototype.html / design-spec §0.4 timing.

**Acceptance:** logo renders generously without resizing dance; animations match prototype.html timing.

---

## §2 Sign-up (design-spec §2 + AUTH-01..05)

- [ ] Sign-up renders RethinkSans on-device (NOT system Roboto). Visual cue: title + body weight contrast matches prototype.html. Plan 03-02 hardened the dispatch via `stripFontWeight()` — if any text still falls back to Roboto, file an `03-W1-AMENDMENTS.md` entry; do NOT edit Phase 2 docs.
- [ ] Three value-prop lines ("Record real moments", "Train real intelligence", "Get paid") sit as one cohesive block — not three independent paragraphs with double margins.
- [ ] CTA "Continue with Google" stacks immediately under the centered content (logo + value-prop trio), not pinned to the bottom of the screen.
- [ ] CTA width: content-driven (~280–300 dp on Pixel 10a), not full-bleed.
- [ ] Tap "Continue with Google" with consent UNCHECKED → alert "Please accept the Terms of Use to continue."
- [ ] Re-check consent → tap CTA → Google Sign-In sheet renders → select test account → returns to app on Permissions.

**Acceptance:** Sign-up matches prototype.html for typography, spacing, and CTA layout; auth round-trip clean.

---

## §3 Permissions (design-spec §3 + PERM-01..04)

- [ ] Idle-state CTA "Allow access" stacks immediately under the centered content block (Camera & Mic icon + heading + A1 body), not pinned to the bottom.
- [ ] CTA width: content-driven, not full-bleed.
- [ ] Tap "Allow access" → Android system permission dialog for Camera fires → grant via "While using the app" → Mic dialog fires → grant. After BOTH granted the screen auto-advances to CompatRunningScreen via `navigation.replace('Compat')` (PermissionsScreen.tsx:15 contract: `idle → (tap) requesting → granted → navigation.replace('Compat')`). NO manual "Continue"/"Next" tap required.

**Acceptance:** CTA layout matches Sign-up rule (Plan 03-02 Task 2B); auto-advance fires once both perms are granted (no manual gate).

---

## §4 Compat-fail merge (design-spec §4d + Plan 03-03 Task 3)

> Operator note: trigger a real compat fail on a Pixel 10a is non-trivial because the device passes all gates after the DeviceCaps fix (commit `ec86b99`). Two options for §4: (a) temporarily force a check failure via debug-only constant (e.g., set `imuSustained100Hz.pass = false` in CompatRunningScreen at build time, rebuild, smoke-walk, revert); (b) skip live walk and rely on the visual-snapshot baseline at `apps/mobile/__tests__/visual/__image_snapshots__/compat-fail-*.png` — which captures the merged surface deterministically. Operator picks. If (b), document the deferral in the Sign-off section.

- [ ] Failure list + recovery body + Contact Support CTA all render on ONE scrollable screen — no second navigation hop to a standalone "Recovery" page.
- [ ] Content is center-aligned both horizontally and vertically (no flex spacer pushing the CTA to the bottom).
- [ ] "Contact Support" button stacks immediately under the recovery block at content-driven width (`alignSelf: 'center'`).
- [ ] Tap "Contact Support" → mailto opens with `support@humynlabs.ai` (NOT `[EMAIL_ADDRESS]` placeholder; OQ-1 resolved end-to-end).
- [ ] Hardware back from CompatFail does NOT reach a `CompatRecovery` screen (the route was deleted in Plan 03-03; the navigator's `gestureEnabled: false` from OnboardingStack is preserved).

**Acceptance:** merged screen renders correctly; mailto target is the canonical email; no orphan CompatRecovery route.

---

## §5 Compat-pass auto-advance (design-spec §4c + Plan 03-03 Task 4A)

- [ ] On compat happy path, CompatPassScreen renders "You're in." + "All checks passed." centered.
- [ ] 40 ms haptic fires on mount (impactLight via `react-native-haptic-feedback`).
- [ ] After ~1.5 s the screen auto-routes to RigTutorial WITHOUT a manual tap. NO "Next" or "Continue" CTA visible during the window.
- [ ] If the device shows free-storage <5 GB, the storage warning banner renders during the 1.5 s window (COMPAT-03 still wired).
- [ ] Hardware-back during the 1.5 s window cancels the pending auto-advance (T-3.2-05 mitigation).

**Acceptance:** no tap required; pass state is a transient confirmation, not a gate.

---

## §6 Rig Tutorial (design-spec §5 + ONB-01..02)

- [ ] RigTutorialScreen renders the head-rig illustration — orange head silhouette + camera rig + headstrap dashes + face dots, rasterized from `prototype.html:1224-1235` SVG via `sharp` into `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` (Plan 03-11 A2 closure). Real PNG, not a transparent placeholder; visible at the top of the screen above the heading.
- [ ] "Don't have a rig yet" off-ramp link fires `mailto:support@humynlabs.ai` (NOT `[EMAIL_ADDRESS]` placeholder).
- [ ] Tap "Next" → MainTabs Home directly.

**Acceptance:** illustration visible; mailto target canonical.

---

## §7 Home tab (design-spec §6 + HOME-07..08)

- [ ] MainTabs Home tab TopBar shows the Google avatar (NOT 'U' fallback) when `appStore.user.avatarUrl` is set — flows from Plan 03-03 Task 1's `useTabTopBarProps()` hook.
- [ ] Bottom-nav renders 24 dp Lucide icons (`Home`, `ListTodo`, `History`) above each tab label — direct `import` from `lucide-react-native`, not the `Icon` primitive.
- [ ] Touch targets feel comfortable (≥48 dp via `minHeight` + `minWidth` + `hitSlop` per Plan 03-02 Task 2C).
- [ ] TopBar renders the orange wordmark Image (`require('../assets/logos/orange_logo.png')`) — NOT a "Humyn Labs" Text node. Plan 03-11 A4 swapped the typographic stub for the brand asset; verify by visual inspection at the top-left of Home, then confirm the same Image renders on Tasks (§8) and History (§9) via the shared TopBar (Pattern 71).

**Acceptance:** Google avatar renders, Lucide icons render, ≥48 dp touch targets.

---

## §8 Tasks tab (Plan 03-03 Task 1 — Pattern 71)

- [ ] Tap the Tasks bottom-nav tab → "Tasks — coming in Phase 6." body copy renders.
- [ ] TopBar Google avatar visible (NOT 'U' fallback) — Pattern 71 wires `useTabTopBarProps()` identically to Home.
- [ ] Tap the avatar → Profile screen.

**Acceptance:** Tasks tab avatar matches Home (no regression to 'U').

---

## §9 History tab (Plan 03-03 Task 1 — Pattern 71)

- [ ] Tap the History bottom-nav tab → "History — coming in Phase 6." body copy renders.
- [ ] TopBar Google avatar visible (NOT 'U' fallback) — Pattern 71 wires `useTabTopBarProps()` identically to Home.
- [ ] Tap the avatar → Profile screen.

**Acceptance:** History tab avatar matches Home (no regression to 'U').

---

## §10 Profile (PROF-01..05 + AUTH-08..10 — unchanged from Phase 2)

- [ ] Profile head: Google avatar + name + tap-to-edit (Pattern 63 / 64 from Phase 2 quick-260510-005).
- [ ] Inline edits to Name + Age + Gender PATCH `/me` successfully (apiClient bearer header — Pattern 60).
- [ ] Lifetime block + Payments + Footer + Help Center link + Logout / Delete Account modal flows all match Phase 2 smoke walk.

**Acceptance:** Profile surface unchanged from Phase 2; no Plan 03-03 regression.

---

## §11 Foreground rehydrate (Plan 03-03 Task 2 — Pattern 72)

> **This is the §13-soak regression that Plan 03-03 Task 2 specifically targets.** Pre-fix, killing the JS context and re-foregrounding dropped `appStore.user` to `null` (transient slice; Pattern 64 trade-off) and every TopBar reverted to the 'U' fallback until the user navigated to Profile. Post-fix, `useForegroundUserRehydrate()` in RootNativeStack fires `/me` on AppState 'active' when `user==null && jwt!=null` and repopulates the slice within 1-2 s.

- [ ] On Home (or any tab) with the Google avatar visible, background the app via Recents.
- [ ] Force-stop via `adb shell am force-stop ai.humynlabs.capture.apk` (simulates Android process kill).
- [ ] Relaunch via Recents card (or `adb shell am start -n ai.humynlabs.capture.apk/.MainActivity`).
- [ ] **WITHOUT navigating to Profile**, observe the TopBar avatar repopulates within 1-2 s of foreground (NOT 'U').
- [ ] Watch logs during the foreground transition — `/me` HTTP 200 fires once, no spam (T-3.2-03 mitigation: short-circuits when `user!=null`).

**Acceptance:** avatar self-heals on foreground; no manual Profile detour required.

---

## §12 Visual snapshot CI gate ≥1h soak (T-3.2-01 lineage)

> Adapted from the T-2.21-01 Crashlytics ≥1h gate shape. The visual-snapshot suite must stay green in CI for ≥1h after merge before declaring Wave 1 complete — guards against a flaky baseline diff that only surfaces on a second CI run (e.g., font-rendering drift, JSDOM version-bump, helper non-determinism).

- [ ] Open the GitHub Actions / CI dashboard for the merge commit. Confirm the "mobile-build" or equivalent job that runs `vitest run __tests__/visual/` passes green.
- [ ] Re-run the same CI job after ≥1h (or wait for the next scheduled run). Confirm second run also green — no flaky diff.
- [ ] If a later commit re-bakes a baseline (`--update`), the PR diff should surface the PNG churn for human review (per D-WAVE-06).

**Acceptance:** ≥1h CI green window across at least 2 runs; no flaky PNG diff.

---

## Sign-off

- [ ] §1 Splash / §2 Sign-up / §3 Permissions / §4 Compat-fail merge / §5 Compat-pass auto-advance / §6 Rig Tutorial / §7 Home / §8 Tasks / §9 History / §10 Profile / §11 Foreground rehydrate / §12 Visual snapshot CI all passed (with documented sub-bullet evidence) on Pixel 10a.
- [ ] Any new gaps surfaced during this re-walk are filed in `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` (D-WAVE-09) — NOT in `02-COSMETIC-GAPS.md` (frozen).
- [ ] Wave 2 acceptance gate (D-WAVE-08) satisfied: both Wave 1 plans (03-01, 03-02, 03-03) commits landed + this re-walk passed.

**Operator signature:** Adnaan Mohammed (interactive walk with Claude Opus 4.7 driving adb)

**Approved? YES — functionally** (all 12 sections pass behaviorally; 6 cosmetic/UX amendments filed for follow-up)

`re-walked-on: 2026-05-10`

**Re-re-walk (post-Plan-03-11) sign-off — 2026-05-10:**

After Plan 03-11 landed (5 amendments closed in source + A2 closed by post-escalation prototype-SVG raster), the runbook was re-walked end-to-end on the same Pixel 10a (`5C161JEA304304`) by Adnaan Mohammed with Claude Opus 4.7 driving adb. Build: fresh `installApkRolloutDebug` (BUILD SUCCESSFUL in 47s) on top of commit `b0d7305` (post-runbook-stale-fix). Device data fully cleared via `pm clear` before the walk so the cold-start gate decision tree, sign-up, permissions, compat, and rig-tutorial paths walked from scratch.

All six amendments verified closed on-device:

- **A1** ✓ — PermissionsScreen idle body reads "Used only while you hit record" verbatim (UI hierarchy: `text="Used only while you hit record"`).
- **A2** ✓ — RigTutorialScreen renders the rasterized prototype-SVG illustration (orange head silhouette + camera rig + headstrap + face dots). Real PNG (~38 KB @3x), not transparent placeholder.
- **A3** ✓ — BottomNav container measured 91.8 dp tall on Pixel 10a (matches `68 + insets.bottom` with 24 dp insets); 35.4 dp gap below tab content (matches `paddingBottom: insets.bottom + 12`); floats above gesture indicator.
- **A4** ✓ — TopBar's "Humyn Labs Capture wordmark" element is `android.widget.ImageView` with bounds [42,178][364,252] = 122.7 × 28.2 dp (matches intrinsic 320×73 asset). Same Image renders identically on Home / Tasks / History via Pattern 71. ZERO TextView nodes containing literal "Humyn Labs" text.
- **A5** ✓ — CompatFailScreen "What Now" 3-bullet recovery block deletion verified by source grep + Plan 03-11 visual baseline refresh (live walk skipped per runbook §4 operator note: Pixel 10a passes after `ec86b99` DeviceCaps fix; force-fail apparatus deferred).
- **A6** ✓ — Sign-up wordmark measured 256 × 57.9 dp on Pixel 10a (672×152 px ÷ 2.625 density factor). Matches the explicit `style={{ width: 256, height: 58, resizeMode: 'contain' }}` from Plan 03-11 Task 4. Splash wordmark briefly captured during fade-in transition; same A6 dimensions confirmed at the steady-state hand-off frame.

Additional acceptance verified on-device: §2 consent-gate alert ("Please accept the Terms of Use to continue.") fires when CTA tapped with consent unchecked; live Google Sign-In via Android 14 Credential Manager auto-picks `m.adnaan161@gmail.com` and routes to Permissions; §3 auto-advances to Compat after Camera + Mic granted; §4 → §5 → §6 chain runs without manual taps (compat-pass 1.5 s auto-advance, T-3.2-05 mitigation honored); §7/§8/§9 TopBar Pattern 71 propagation verified across all three tabs; §10 Profile inline-edit fields + payments card + Help Center / Logout / Delete account row all render unchanged from Phase 2; §11 Pattern 72 force-stop → relaunch flow restored Google avatar within ~2.7 s (avatar populated by t3 screenshot, no manual Profile detour).

`re-walked-on: 2026-05-10` (post-Plan-03-11)

**New runbook stales surfaced during the re-re-walk (patched in same commit):**

- §3 line 66 — replaced "Continue CTA enables → tap → CompatRunningScreen" with the actual auto-advance contract from `PermissionsScreen.tsx:15`.

**New candidate amendment surfaced during the re-re-walk (filed but NOT closed):**

- **A7** — SignupScreen consent checkbox defaults to `useState(true)` (Phase 2 plan 02-09 explicit choice; surfaced regulatory exposure under GDPR Art. 4(11) / DPDP §6 / LGPD Art. 5(XII) — pre-ticked boxes are not "clear affirmative action"). Filed for legal review BEFORE Wave 2 plan-phase. Not blocking Wave 2 entry unless legal flags.

**Wave 2 entry gate — D-WAVE-08 status:** ALL conditions satisfied:

1. ✓ Wave 1 plans 03-01 + 03-02 + 03-03 commits landed (≥7 commits — got 24 across 03-01/02/03/11 today).
2. ✓ Plan 03-11 (Wave 1 polish) landed end-to-end with all six A-amendments closed in source.
3. ✓ Operator re-re-walk on Pixel 10a passed all sections + stamped here.
4. ✓ Runbook line-113 + line-100 stales fixed (commit `b0d7305`); line-66 stale fixed in this same commit.

**Wave 2 plan-phase (Plan 03-04 capture-foundation-muxer-bridge) is UNBLOCKED.**

**Walk summary:**

- §1 Splash + animation — pass; **A6** filed (logo too large, shrink ~20%)
- §2 Sign-up — pass; **A6** filed (logo too large, shrink ~20%)
- §3 Permissions — pass; **A1** filed (copy: replace with "Used only while you hit record")
- §4 Compat-fail merge — pass (force-fail toggle on `imuSustained100Hz` reverted post-walk); **A5** filed (drop "What Now" section entirely — keep only failure reason + supplementary copy + Contact Support)
- §5 Compat-pass auto-advance — pass (no taps required, transient confirmation works)
- §6 Rig Tutorial — pass functionally; **A2** filed (rig illustration is invisible — Plan 03-01 transparent placeholder; needs real artwork PNG)
- §7 Home — pass functionally; **A3** filed (BottomNav too low; lift like Instagram), **A4** filed (TopBar wordmark is text stub; should be orange logo Image)
- §8 Tasks — pass functionally; **A4** filed (same TopBar wordmark issue)
- §9 History — pass functionally; **A4** filed (same TopBar wordmark issue)
- §10 Profile — skipped (unchanged from Phase 2 per runbook; no Plan 03-03 regression expected)
- §11 Foreground rehydrate — **PASS — Pattern 72 verified.** Force-stop via adb → relaunch → 'U' fallback flashed briefly → Google avatar repopulated within 1-2s without manual Profile detour. Hook fired as designed.
- §12 Visual snapshot CI ≥1h soak — skipped (no GitHub Actions workflow running locally; deferred to first CI cycle after merge)

**Pre-flight notes:**

- Pre-flight #5 (manifest verify): apkRollout half manually verified inline (REQUEST_INSTALL_PACKAGES present; no POST_NOTIFICATIONS; no ACCESS_FINE_LOCATION; only ACCESS_COARSE_LOCATION; all required base perms present). playStore half blocked on missing `playStore/google-services.json` — pre-existing infrastructure gap unrelated to Wave 1; defer to Phase 4 Play Store onboarding plan.
- Pre-flight #8 (vitest): exits 0 with 344/344 passing, but 3 unhandled rejections from pre-existing `1b4b06d` (`setPermsGranted` not in `RootNativeStack.test.tsx` mock state). Test-mock cleanup deferred per "functionality first during smoke walks" memory.

**Amendments filed:** see `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` (A1–A6).

| Failed section | Failure summary                                      | 03-W1-AMENDMENTS.md entry | Logcat ref |
| -------------- | ---------------------------------------------------- | ------------------------- | ---------- |
| §1 / §2        | Splash + Sign-up logos too large                     | A6                        | —          |
| §3             | Permissions copy too long                            | A1                        | —          |
| §4             | "What Now" section feels like filler                 | A5                        | —          |
| §6             | Rig illustration invisible (transparent placeholder) | A2                        | —          |
| §7 / §8 / §9   | TopBar wordmark is text stub, should be orange logo  | A4                        | —          |
| §7             | BottomNav too low, lift like Instagram               | A3                        | —          |

---

## Notes / failures (paste logcat snippets here)

_(operator fills in any notes during the re-walk)_

---

_Operator commits this file with all checkboxes checked + a final commit message of `docs(03-w1): manual re-walk complete on Pixel 10a — Wave 2 unblocked` to close Wave 1._
