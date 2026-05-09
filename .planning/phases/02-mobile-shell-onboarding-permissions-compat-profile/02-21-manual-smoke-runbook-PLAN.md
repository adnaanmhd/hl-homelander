---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 21
id: 02-21-manual-smoke-runbook
name: 02-MANUAL-SMOKE.md runbook + Open Question tracking ([EMAIL_ADDRESS] placeholder + compat fail copy) + Crashlytics gate documentation
type: execute
wave: 5
depends_on:
  [
    02-15-compat-screens-and-service,
    02-17-profile-screen,
    02-18-help-center-and-feedback,
    02-19-logout-and-delete-account,
    02-20-force-upgrade-and-soft-banner,
  ]
files_modified:
  - apps/mobile/02-MANUAL-SMOKE.md
  - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md
autonomous: false
requirements: []
must_haves:
  truths:
    - '02-MANUAL-SMOKE.md is a markdown checkbox runbook the operator walks step-by-step on a real Pixel 7a/8a/10a class device for the apkRollout build (and a separate playStore-flavor walk for Play Store deep-link verification)'
    - 'Runbook covers: cold-start gate decision tree (4 paths) → Sign-up + Terms-of-Use modal → Permissions (Camera + Mic) → Compat (happy path on a passing device + downgraded device for COMPAT-06/08 fail UI) → Tutorial Rig → Profile (avatar tap, inline-edit name + age + gender, Joined date, Payments card copy, lifetime numeric, Help / Logout / Delete entries, footer with version+flavor) → Help Center (3 accordions, mailto, Report-a-problem) → ForceUpgrade (apkRollout: install older APK → bump backend min_supported → cold-start → SHA-256 verify → system installer; playStore: market:// hand-off) → Soft-upgrade banner (dismiss + per-version reset)'
    - "Each manual-only behavior from 02-VALIDATION.md § 'Manual-Only Verifications' has a numbered step in the runbook with explicit input commands (adb / fastboot / curl / Android Studio bumps) and assertions"
    - 'Runbook ends with a Crashlytics gate: ≥ 1 hour soak time on the smoke device, then operator confirms Firebase Crashlytics dashboard shows zero new fatal/non-fatal issues for the apkRollout build'
    - "02-OPEN-QUESTIONS.md tracks the [EMAIL_ADDRESS] placeholder occurrences (compat recovery + help center + content.json) and the compat-fail 'what now' final wording — both flagged for resolution before Play Store launch (Phase 7), not blocking Phase 2 completion"
    - 'Runbook is committed to git BEFORE the operator walks it; failures during the smoke walk produce sub-bullets with timestamps + adb logcat snippets pasted directly into the runbook'
  artifacts:
    - path: 'apps/mobile/02-MANUAL-SMOKE.md'
      provides: 'Phase 2 manual smoke runbook (apkRollout + playStore on Pixel-class)'
      contains: 'ForceUpgrade APK install'
    - path: '.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md'
      provides: 'Tracked Open Questions for resolution before Play Store launch'
      contains: '[EMAIL_ADDRESS]'
  key_links:
    - from: 'apps/mobile/02-MANUAL-SMOKE.md'
      to: '.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-VALIDATION.md'
      via: 'manual-only verification rows'
      pattern: 'Manual-Only Verifications'
---

<objective>
Author the Phase 2 manual smoke runbook. This is the single source of truth for operator-driven gating before phase completion. Pulls every "manual-only" verification listed in 02-VALIDATION.md into a numbered, checkbox-shaped walk-through with concrete adb / fastboot / curl commands and screenshot expectations. Also lands 02-OPEN-QUESTIONS.md tracking the two known unresolved-but-non-blocking items (the [EMAIL_ADDRESS] support email placeholder + the compat-fail final wording).

Purpose: Phase 2 ships by-vibe per PROJECT.md. The smoke runbook is how we confirm the Android-tier surface actually works on a real device before declaring Phase 2 complete. The runbook is `autonomous: false` — execute-plan pauses for the operator to walk it step-by-step on the smoke device.
Output: a committed, reviewable runbook + an Open Questions file capturing the known placeholders that the operator must agree to defer to phase 7 (or earlier if the user / counsel returns).
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-VALIDATION.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md
@apps/mobile/02-MANUAL-SMOKE.md

<interfaces>
<!-- 02-VALIDATION.md § Manual-Only Verifications — 5 manual rows -->
1. Behavioral compat-check end-to-end on physical Pixel 7a/8a/10a (COMPAT-07)
2. Force-upgrade APK install on apkRollout (UPG-03)
3. Force-upgrade market:// hand-off on playStore (UPG-03)
4. Soft-banner persistence across cold start (UPG-04)
5. Crashlytics zero-new-issues gate

<!-- Phase 1 Manual Smoke pattern (analog from 13-MANUAL-SMOKE.md) -->

- Numbered checkbox steps
- "Inputs" block per step (adb / fastboot / curl / Android Studio actions)
- "Assertions" block per step (what the operator sees / Crashlytics state)
- "If failed" block referencing the smallest-blast-radius fix-forward plan number
  </interfaces>
  </context>

<threat_model>

## Trust Boundaries

| Boundary                | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| operator → smoke device | trusted (the operator is the developer running phase gate) |
| Crashlytics dashboard   | trusted reporting                                          |

## STRIDE Threat Register

| Threat ID | Category    | Component                                                          | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                          |
| --------- | ----------- | ------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.21-01 | Repudiation | Operator skips Crashlytics gate, ships Phase 2 with a latent crash | mitigate    | The smoke runbook ends with an explicit checkbox the operator MUST tick: 'I have confirmed Firebase Crashlytics dashboard for apkRollout build {versionName} ({versionCode}) shows 0 new fatal/non-fatal issues over a ≥1 h soak.' The phase-end /gsd-verify-work flow blocks until the runbook is committed with this checkbox checked. |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author 02-MANUAL-SMOKE.md runbook</name>
  <files>apps/mobile/02-MANUAL-SMOKE.md</files>
  <read_first>
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-VALIDATION.md § "Manual-Only Verifications"
    - .planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md (Phase 1 analog — same shape)
    - REQUIREMENTS.md Phase 2 success criteria
  </read_first>
  <action>
    Author `apps/mobile/02-MANUAL-SMOKE.md`:
    ```markdown
    # Phase 2 — Manual Smoke Runbook

    **Phase:** 02 — Mobile Shell, Onboarding, Permissions, Compat & Profile
    **Last updated:** {DATE — fill at commit time}
    **Operator:** _____________________
    **Devices used:** Pixel 7a (primary), Pixel 8a / 10a (secondary if available)
    **Backend:** dev (`pnpm --filter @humyn/api dev` on :8080) reachable from device via LAN IP or ngrok

    ## Pre-flight

    - [ ] All Phase 2 plans 02-01 through 02-20 are committed and `cd apps/mobile && npm run test --run && cd android && ./gradlew :app:testApkRolloutDebugUnitTest` exits 0.
    - [ ] Backend dev server is running and `curl http://<LAN-IP>:8080/healthz` returns 200.
    - [ ] `apps/mobile/.env.apkRollout` is populated with the same Web Client ID Phase 1 used.
    - [ ] `cd apps/mobile && cd android && ./gradlew assembleApkRolloutDebug` succeeds locally.
    - [ ] `bash apps/mobile/scripts/verify-merged-manifests.sh` exits 0 against the just-built APK.

    ## 1. Cold-start gate decision tree (AUTH-07 + UPG-01/02/05 + COMPAT-04/05/06)

    - [ ] **Path A — fresh install, no JWT:** uninstall app, reinstall apkRollout debug APK, cold-start → Splash (~2.4 s) → Sign-up screen.
      - Inputs: `adb uninstall ai.humynlabs.capture.apk && adb install apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`
      - Assertion: Sign-up screen renders the design-spec §2 layout (logo + tagline + 'Continue with Google' + Terms-of-Use checkbox PRE-CHECKED).

    - [ ] **Path B — has JWT, has compat pass, has tutorial done:** sign-in once on path A, cold-start → Splash → MainTabs Home directly (no compat re-run).

    - [ ] **Path C — has JWT, NO compat pass:** clear MMKV onboarding.compatPassed.v1 (`adb shell run-as ai.humynlabs.capture.apk rm -f /data/data/.../mmkv/onboarding.compatPassed.v1` or rebuild with a debug-only clear button), cold-start → Splash → CompatRunningScreen (skips Sign-up because JWT present).

    - [ ] **Path D — installedVersion < min_supported:** modify backend `/app/version` to return min_supported `99.0.0` (sql update or env override), cold-start → ForceUpgradeScreen with hardBlock=true; tap hardware back → no exit (D-NAV-04).
      - Reset backend min_supported when done.

    ## 2. Sign-up + Terms-of-Use modal (AUTH-01..05)

    - [ ] Tap 'Continue with Google' WITH consent UNCHECKED → alert 'Please accept the Terms of Use to continue.' → no nav.
    - [ ] Tap the 'Terms of Use' link → modal opens with the verbatim §5.2 / §18.1 copy. Search for the substring 'I consent and agree to upload videos of myself' — must be visible. Tap 'Got it' → modal closes.
    - [ ] Re-check consent + tap 'Continue with Google' → Google Sign-In sheet → select test account → returns to app.
    - [ ] Watch logs: `adb logcat | grep -E "PlayIntegrity|/auth/google|signInWithGoogle"`. Expected: Play Integrity token minted, /auth/google round-trip 200, JWT persisted.
    - [ ] Cold-start app — should land on Permissions (or Compat / Tutorial / Home depending on flow state).

    ## 3. Permissions (PERM-01..04)

    - [ ] Permissions screen shows two cards: Camera + Microphone, both with 'Grant' CTAs.
    - [ ] Tap 'Grant' on Camera → OS prompt → Allow → card flips to granted.
    - [ ] Tap 'Grant' on Microphone → OS prompt → Allow → card flips to granted.
    - [ ] Once both granted, Continue/Next CTA enabled → tap → CompatRunningScreen.
    - [ ] Re-test Deny path on a fresh install: tap Grant → Deny → card shows recovery copy + 'Open Settings' link → tap → Settings opens to the app's permission page.

    ## 4. Behavioral compat-check happy path (COMPAT-01..03/05/07)

    - [ ] CompatRunningScreen renders title 'Checking your phone' + sub 'Takes around 30 secs' + 130×130 progress ring + 7 rows.
    - [ ] Watch the rows progress over ~30 s. The IMU sustained probe is the longest leg.
    - [ ] At 100% the screen routes to CompatPassScreen with title "You're in." + sub 'All checks passed.' + 40 ms haptic.
    - [ ] Tap Next → RigTutorialScreen.
    - [ ] (Optional) On a Pixel 7a or better, the device is expected to pass. On a downgrade-fixture device or a Helio-class budget Android, expect failure — see step 5.

    ## 5. Compat-check fail UI (COMPAT-06 + COMPAT-08)

    - [ ] Force a fail. Easiest path: install a debug build that overrides the IMU sustained probe to return 44 Hz (debug toggle in `compatService.ts` behind `__DEV__`). Or run on an actual Helio-class device.
    - [ ] CompatRunningScreen → CompatFailScreen with title "This phone can't record yet" + line "Stable motion sensors at 100 Hz+ required (yours: 44 Hz)" — verbatim per design-spec §4d.
    - [ ] No Next CTA. Tap 'What now' → CompatRecoveryScreen.
    - [ ] CompatRecoveryScreen renders 'What now' title + 3 recovery bullets + Contact Support button.
    - [ ] Tap Contact Support → mailto sheet opens with the placeholder email **[EMAIL_ADDRESS]** in the To field. **NOTE:** the `[EMAIL_ADDRESS]` placeholder is an Open Question (see 02-OPEN-QUESTIONS.md); the operator confirms the placeholder shows up but does NOT need to send the email.
    - [ ] Hardware back from CompatRecoveryScreen → CompatFailScreen. Hardware back from CompatFailScreen → either re-runs compat or stays put (per D-NAV-04 — confirm Phase 2 implementation does not reach Sign-up).

    ## 6. Tutorial Rig screen (ONB-01 + ONB-02)

    - [ ] RigTutorialScreen renders heading "You'll need a head rig" + body "Mount your phone on the head rig and make sure it is steady while recording." (verbatim).
    - [ ] Tap "Don't have a rig yet" link → off-ramp screen with recovery info + Contact Support link (ONB-02).
    - [ ] Back → RigTutorial → tap Next → MainTabs Home (Phase 4 Practice Intro is not in Phase 2; Next routes directly to Home).

    ## 7. Bottom-nav + tab structure (HOME-07 + HOME-08)

    - [ ] MainTabs renders EXACTLY 3 tabs: Home / Tasks / History. Profile is NOT a tab.
    - [ ] Tap each tab — TopBar visible on all 3; tab bar suppressed on Splash/Sign-up/Permissions/Compat/Tutorial/ForceUpgrade (already verified by paths above).
    - [ ] Tap top-right avatar → Profile screen (PROF-01..05).

    ## 8. Profile screen (PROF-01..05 + AUTH-08..10)

    - [ ] Profile head: avatar (Google photoURL or initial fallback) + name + 'tap to edit'.
    - [ ] Tap Name field → inline TextInput → type a new name → blur → PATCH /me fires (watch `adb logcat | grep PATCH`) → optimistic UI; reverts on backend error.
    - [ ] Tap Age field → numeric keyboard → type 28 → blur → PATCH /me succeeds.
    - [ ] Tap Gender field → keyboard → leave blank + blur → PATCH /me with gender:null succeeds (PROF-01 nullable).
    - [ ] Lifetime block: numeric reads `0s` (Phase 2 has no recordings yet) + 'Across 0 tasks' (PROF-03).
    - [ ] Payments & Earnings card: 'Coming soon' badge + body verbatim 'Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed.'
    - [ ] Footer: `v0.1.0 (1) · apkRollout` (or current versionName/versionCode/flavor). Long-press to copy is nice-to-have.
    - [ ] Tap 'Help Center' → HelpCenterScreen.
    - [ ] Back to Profile → tap 'Logout' → §18.3 modal renders verbatim copy → tap 'Log out' → returns to Sign-up. JWT cleared (`adb shell run-as ... cat /data/data/.../mmkv/...` shows auth.jwt.v1 absent).
    - [ ] Re-sign-in → Profile → tap 'Delete account' → §18.4 step 1 ('Your account will be deactivated for 30 days...' verbatim) → Continue → step 2 ('Type DELETE to confirm.') → type 'delete' (lowercase) → Confirm disabled. Type 'DELETE' → Confirm enabled → tap → DELETE /me?confirm=DELETE fires → MMKV cleared → returns to Sign-up. Backend logs show deletedAt set.
    - [ ] Re-sign-in within 30 days → Phase 1 server-side restore behavior un-soft-deletes the account.

    ## 9. Help Center (HELP-01..05)

    - [ ] HelpCenterScreen renders 3 accordions in order: Instructions Guide / FAQs / Troubleshooting (HELP-01). All collapsed by default.
    - [ ] Tap each accordion → expands with verbatim copy from `help-center-content.md`. Compare against the source file by visual inspection of the first item per accordion.
    - [ ] Below the third accordion: 'Need more help?' + 'Contact Support' button → tap → mailto sheet with **[EMAIL_ADDRESS]** in To. **(Open Question — see 02-OPEN-QUESTIONS.md.)**
    - [ ] Tap 'Report a problem' → sheet renders 8 category chips (FEEDBACK_CATEGORIES) + textarea.
    - [ ] Pick category 'upload-stuck' + type a message → 'Send report' → POST /feedback succeeds (watch `adb logcat | grep /feedback`); backend logs show feedback row inserted with diagnostic snapshot containing telemetry ring entries.

    ## 10. ForceUpgrade APK install (apkRollout, UPG-03)

    - [ ] Note current installed `versionCode` (e.g. 1) on apkRollout.
    - [ ] Bump backend `/app/version` to return `minSupported: 99.0.0` for apkRollout — easiest via the dev DB seed override.
    - [ ] Cold-start app → Splash → ForceUpgradeScreen renders 'Update to continue.' + Update CTA.
    - [ ] Tap Update → APK download (progress UI is basic per CONTEXT § Deferred 'APK download progress UI polish').
    - [ ] On hash match: Settings 'Allow from this source' prompt may appear → grant → PackageInstaller dialog → tap Install → app updates and re-launches.
    - [ ] On simulated hash mismatch (modify backend to return wrong apkSha256 on the same apkUrl): Update → 'Update failed (integrity check). Try again or contact support.' Alert → check Firebase Analytics for `force_upgrade_apk_hash_mismatch` event (Phase 7 Crashlytics dashboard surfaces this).
    - [ ] Reset backend min_supported.

    ## 11. ForceUpgrade Play Store hand-off (playStore, UPG-03)

    - [ ] Build and install the playStore-flavor APK: `cd apps/mobile/android && ./gradlew assemblePlayStoreDebug && adb install ...playStore-debug.apk`.
    - [ ] Bump backend `/app/version` to return min_supported `99.0.0` for playStore.
    - [ ] Cold-start → ForceUpgradeScreen → tap Update → Play Store opens to the app listing (or Play Store install if Play Store app missing).
    - [ ] Reset backend min_supported.

    ## 12. Soft-upgrade banner (UPG-04)

    - [ ] Set backend `/app/version` to return `latest: 99.9.9, forceUpgrade: false, minSupported: 0.0.1` for the current flavor (so installedVersion < latest but ≥ minSupported).
    - [ ] Cold-start app → Home → soft-upgrade banner mounts at top.
    - [ ] Tap '×' → banner dismisses; tap Update → upgrade flow fires per flavor (apkRollout downloads / playStore market://).
    - [ ] Cold-start again → banner stays dismissed (per-version dismiss key).
    - [ ] Bump backend latest to a different value (e.g. `99.9.10`). Cold-start → banner re-shows (new latest = fresh dismiss key).
    - [ ] Reset backend latest.

    ## 13. Crashlytics gate

    - [ ] Run the apkRollout debug build for ≥ 1 hour on the smoke device, exercising at least Sign-up → Compat → Profile → Help Center → Logout → Sign-up.
    - [ ] Open Firebase Console → Crashlytics → apkRollout build `0.x.y (z)`. Confirm: zero new fatal issues, zero new non-fatal issues during the soak window.
    - [ ] **Operator sign-off:** _I confirm the Crashlytics dashboard for apkRollout build_ ____________ (versionName + versionCode) _shows 0 new fatal/non-fatal issues over a ≥ 1 h soak as of_ ____________ (timestamp).

    ## Sign-off

    - [ ] All sections above passed (or documented sub-bullet failures with logcat snippets) on Pixel 7a (primary).
    - [ ] (Optional) Repeated on Pixel 8a / 10a — note any device-specific failures.
    - [ ] Open Questions in `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` reviewed; the operator agrees to defer them to Phase 7 if not blocking.

    ---

    _Operator commits this file with all checkboxes checked + a final commit message of `docs(02-21): manual smoke complete on Pixel 7a — Phase 2 ready for verify-work` to close Phase 2._
    ```

    Run a sanity check: `wc -l apps/mobile/02-MANUAL-SMOKE.md` returns ≥ 100 lines.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/02-MANUAL-SMOKE.md` succeeds.
    - `grep -c "^- \[ \]" apps/mobile/02-MANUAL-SMOKE.md` returns ≥ 25 (numbered checkbox steps).
    - `grep -c "^## " apps/mobile/02-MANUAL-SMOKE.md` returns ≥ 12 (12 section headers per the runbook above + sign-off).
    - `grep -q "Crashlytics" apps/mobile/02-MANUAL-SMOKE.md` succeeds.
    - `grep -q "EMAIL_ADDRESS" apps/mobile/02-MANUAL-SMOKE.md` succeeds (placeholder explicitly flagged).
    - `grep -q "PackageInstaller\|hash-mismatch\|integrity check" apps/mobile/02-MANUAL-SMOKE.md` succeeds (UPG-03 mismatch path documented).
  </acceptance_criteria>
  <verify>
    <automated>test -f apps/mobile/02-MANUAL-SMOKE.md && [ "$(grep -c '^- \[ \]' apps/mobile/02-MANUAL-SMOKE.md)" -ge 25 ]</automated>
  </verify>
  <done>02-MANUAL-SMOKE.md is committed with all 13 sections; operator can walk it on a real device.</done>
</task>

<task type="auto">
  <name>Task 2: 02-OPEN-QUESTIONS.md tracking placeholder + final-wording items</name>
  <files>.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md</files>
  <read_first>
    - .planning/STATE.md § Blockers/Concerns ('Phase 2: Final Help Center support email ([EMAIL_ADDRESS] placeholder); compat-fail "what now" recovery copy needs final wording')
    - apps/mobile/src/screens/help/content.json (placeholder occurrence 1)
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (placeholder occurrence 2)
    - apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx (placeholder occurrence 3)
  </read_first>
  <action>
    Author `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md`:
    ```markdown
    # Phase 2 — Open Questions

    **Status:** Tracked but not blocking Phase 2 completion. Resolve before Phase 7 staged Play Store rollout.

    ---

    ## OQ-1: Help Center / Contact Support — final email address

    **Description:** `[EMAIL_ADDRESS]` placeholder appears in three places:

    | File | Where | Phase |
    |------|-------|-------|
    | `help-center-content.md` | "Tap **Contact Support** below to email us at `[EMAIL_ADDRESS]`" (Contact Support section) | source |
    | `apps/mobile/src/screens/help/content.json` | Baked from the markdown above by `apps/mobile/scripts/build-help-content.mjs` | derived |
    | `apps/mobile/src/screens/help/HelpCenterScreen.tsx` | `mailto:` URL in the Contact Support button | runtime |
    | `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` | `mailto:` URL in the Contact Support fallback (COMPAT-08) | runtime |

    **Resolution path:**
    1. Product / Ops decides the support email (likely `support@humynlabs.ai` or similar).
    2. Edit `help-center-content.md` — replace `[EMAIL_ADDRESS]` with the real address.
    3. Run `cd apps/mobile && npm run build:help` to re-emit `content.json`.
    4. Search-and-replace `[EMAIL_ADDRESS]` in `HelpCenterScreen.tsx` and `CompatRecoveryScreen.tsx`.
    5. Commit: `docs(02): replace [EMAIL_ADDRESS] placeholder with <real-email>`.

    **Why deferred:** The decision is operational (who owns the inbox, what auto-responder lives there, GDPR-style record-keeping); it does NOT block Phase 2 functional completeness. The placeholder is visible in the smoke runbook so the operator can confirm it doesn't break the flow.

    **Owner:** Product / Ops.
    **Target:** Before first apkRollout distribution beyond internal smoke devices.

    ---

    ## OQ-2: Compat-fail "what now" recovery page final wording

    **Description:** `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` ships first-pass recovery copy:

    > "This phone doesn't meet the recording requirements. Try a different qualifying device, or reach out to support — share your phone model and roughly when this happened."
    >
    > Bullets:
    > - Try a different phone with a 1080p ultrawide rear camera (≥110° dFOV) and a gyroscope + accelerometer.
    > - Make sure the device is not rooted and was installed from a trusted source.
    > - If you've changed phones recently, the check will re-run automatically the next time you sign in.

    **Resolution path:** PM / writer reviews the prototype.html `#compat-fail` recovery state (currently a TBD per design-spec §4 'Edge states (production)'), settles on final copy, edits CompatRecoveryScreen.tsx + the corresponding test fixtures.

    **Why deferred:** The current copy is technically accurate and non-confusing. Wordsmithing is a writer pass, not engineering work; we don't gate Phase 2 on it.

    **Owner:** Product / Writing.
    **Target:** Before staged Play Store rollout (Phase 7).

    ---

    ## OQ-3: APK SHA-256 fingerprint disclosure UX (Phase 1 Open Question carried forward)

    **Description:** STATE.md § Blockers from Phase 1: "Playstore/apkRollout APK SHA-256 fingerprint disclosure UX". Could land in Profile footer (PROF-05 already shows `versionName-flavor (versionCode)`; could append SHA prefix) or Help Center FAQ. Phase 2 did NOT add it.

    **Why deferred:** Not in any Phase 2 requirement; CONTEXT § Deferred Ideas tags this as planner-pick. No security regression — the SHA is in the APK metadata + Play Console + signed cert; users don't need to verify it manually.

    **Owner:** Product / Security.
    **Target:** Phase 7 if needed for transparency narrative; otherwise dropped.

    ---

    _Reviewed at Phase 2 verify-work; carry forward to Phase 7 entry checklist._
    ```

  </action>
  <acceptance_criteria>
    - `test -f .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` succeeds.
    - `grep -c "^## OQ-" .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` returns 3.
    - `grep -q "EMAIL_ADDRESS" .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` succeeds.
    - `grep -q "compat-fail" .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` succeeds.
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md && grep -c "^## OQ-" .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md | grep -q 3</automated>
  </verify>
  <done>Open Questions tracked + paths to resolution documented; the placeholder occurrences are enumerated for fast search-and-replace at Phase 7 entry.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3 — Operator walks 02-MANUAL-SMOKE.md on a real Pixel-class device</name>
  <what-built>02-MANUAL-SMOKE.md (Task 1) + 02-OPEN-QUESTIONS.md (Task 2). All 12 sections of automated work for Phase 2 are committed and green.</what-built>
  <how-to-verify>
1. Plug in a Pixel 7a / 8a / 10a class device with USB debugging enabled (`adb devices` should list it).
2. Build both APKs:
   - `cd apps/mobile/android && ./gradlew assembleApkRolloutDebug && ./gradlew assemblePlayStoreDebug`.
3. Open `apps/mobile/02-MANUAL-SMOKE.md` and walk every section in order. Tick each checkbox as you go. For any failed step, paste an `adb logcat` snippet under that step's bullet.
4. The Crashlytics gate (Section 13) requires ≥ 1 hour of soak. Check the Firebase console at the end.
5. After all sections pass, sign Section "Sign-off" with your name + timestamp.
6. Commit: `docs(02-21): manual smoke complete on Pixel 7a — Phase 2 ready for verify-work`.
  </how-to-verify>
  <resume-signal>Type "approved" once 02-MANUAL-SMOKE.md is committed with all sections passed; OR describe any failures so we can file a fix-forward plan.</resume-signal>
</task>

</tasks>

<verification>
- `test -f apps/mobile/02-MANUAL-SMOKE.md && test -f .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md`.
- After operator walk: `grep -c "^- \[x\]" apps/mobile/02-MANUAL-SMOKE.md` returns ≥ 25 (all checkboxes ticked).
</verification>

<success_criteria>

- Manual smoke runbook exists, is comprehensive, follows the Phase 1 13-MANUAL-SMOKE.md shape.
- Open Questions are tracked + path-to-resolution documented (no surprises at Phase 7 entry).
- Operator runs the smoke on a real device and signs off.
- Phase 2 is gated on the runbook's checkboxes being checked + the Crashlytics gate.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-21-SUMMARY.md` per templates/summary.md. Note any sub-bullet failures from the smoke walk + the fix-forward plan numbers in the SUMMARY.
</output>
