# Phase 2 — Manual Smoke Runbook

**Phase:** 02 — Mobile Shell, Onboarding, Permissions, Compat & Profile
**Last updated:** 2026-05-09
**Operator:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**Date walked:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**Devices used:** Pixel 7a (primary), Pixel 8a / 10a (secondary, optional)
**Backend:** dev (`pnpm --filter @humyn/api dev` on :8080) reachable from device via LAN IP or ngrok

> **How to use this runbook:** Walk every numbered section in order on a real Android device. Tick each `- [ ]` checkbox as you confirm it. For any failed assertion, paste an `adb logcat` snippet (or screenshot path) as a sub-bullet under the failed step, file a fix-forward plan, and link the plan number in the Sign-off section. Do NOT skip the Crashlytics gate (Section 13) — it is the Phase 2 ship gate.
>
> **Source-of-truth cross-references:**
>
> - Manual-only verification rows: `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-VALIDATION.md` § "Manual-Only Verifications"
> - Open Questions ([EMAIL_ADDRESS] placeholder, compat-fail final wording): `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md`
> - Phase 1 analog (same shape): `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md`

---

## Pre-flight

- [ ] All Phase 2 plans 02-01 through 02-22 are committed and `cd apps/mobile && npm run test --run && cd android && ./gradlew :app:testApkRolloutDebugUnitTest` exits 0.
- [ ] Backend dev server is running: `pnpm --filter @humyn/api dev` (binds :8080).
- [ ] `curl http://<LAN-IP>:8080/healthz` returns 200 from a separate terminal (replace `<LAN-IP>` with the Mac's LAN IP, or use an ngrok tunnel).
- [ ] `apps/mobile/.env.apkRollout` is populated with the same Web Client ID Phase 1 used (per `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md` § Pre-requisites).
- [ ] `apps/mobile/.env.playStore` is populated with the same Web Client ID.
- [ ] `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` succeeds locally; APK at `app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`.
- [ ] `bash apps/mobile/scripts/verify-merged-manifests.sh` exits 0 against the just-built APK.
- [ ] `adb devices` lists the Pixel 7a/8a/10a class device with `device` (not `unauthorized`) status.
- [ ] Device is signed in to a Google account (Settings → Accounts).

---

## 1. Cold-start gate decision tree (AUTH-07 + UPG-01/02/05 + COMPAT-04/05/06)

The cold-start gate has four navigation paths depending on persisted MMKV state. Walk all four.

- [x] **Path A — fresh install, no JWT:** uninstall app, reinstall apkRollout debug APK, cold-start → Splash (~2.4 s) → Sign-up screen. _(Pixel 10a, 2026-05-09. Functional pass. Cosmetic gaps deferred — see `.planning/phases/02-…/02-COSMETIC-GAPS.md`.)_
  - Inputs:
    ```
    adb uninstall ai.humynlabs.capture.apk
    adb install apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk
    adb shell am start -n ai.humynlabs.capture.apk/.MainActivity
    ```
  - Assertion: Sign-up screen renders the design-spec §2 layout (logo + tagline + 'Continue with Google' + Terms-of-Use checkbox PRE-CHECKED).
- [ ] **Path B — has JWT, has compat pass, has tutorial done:** complete sign-in once on Path A, walk through Permissions / Compat / RigTutorial, force-quit and cold-start → Splash → MainTabs Home directly (no compat re-run, no Sign-up).
- [ ] **Path C — has JWT, NO compat pass:** clear MMKV `onboarding.compatPassed.v1` then cold-start. Two ways:
  - Inputs (debug-only — preferred):
    ```
    adb shell run-as ai.humynlabs.capture.apk \
      ls files/mmkv/   # confirm key file present
    adb shell run-as ai.humynlabs.capture.apk \
      rm -f files/mmkv/onboarding.compatPassed.v1
    adb shell am force-stop ai.humynlabs.capture.apk
    adb shell am start -n ai.humynlabs.capture.apk/.MainActivity
    ```
  - OR rebuild with a debug-only "clear compat" button if the MMKV path differs in your build.
  - Assertion: Splash → CompatRunningScreen (skips Sign-up because JWT present, skips MainTabs because compat MUST re-run).
- [ ] **Path D — installedVersion < min_supported (force-upgrade):** modify backend `/app/version` to return `min_supported: 99.0.0` for the apkRollout flavor (sql update against `app_versions` table or env override), force-quit and cold-start → ForceUpgradeScreen with `hardBlock=true`.
  - Inputs:
    ```
    psql $DATABASE_URL -c "UPDATE app_versions SET min_supported='99.0.0' WHERE flavor='apkRollout';"
    adb shell am force-stop ai.humynlabs.capture.apk
    adb shell am start -n ai.humynlabs.capture.apk/.MainActivity
    ```
  - Assertion: ForceUpgradeScreen renders title 'Update to continue.' + Update CTA + NO 'Later' / dismiss CTA. Tap hardware back → no exit (D-NAV-04 — back is suppressed on hard-block).
  - Reset:
    ```
    psql $DATABASE_URL -c "UPDATE app_versions SET min_supported='0.1.0' WHERE flavor='apkRollout';"
    ```

---

## 2. Sign-up + Terms-of-Use modal (AUTH-01..05)

- [ ] Tap 'Continue with Google' WITH consent UNCHECKED → alert 'Please accept the Terms of Use to continue.' fires → no nav.
- [ ] Tap the 'Terms of Use' link → modal opens with the verbatim §5.2 / §18.1 copy. Search for the substring 'I consent and agree to upload videos of myself' — it MUST be visible. Tap 'Got it' → modal closes.
- [ ] Re-check consent → tap 'Continue with Google' → Google Sign-In sheet renders → select test account → returns to app.
- [ ] Watch logs in a separate terminal:
  ```
  adb logcat -v color | grep -E "PlayIntegrity|/auth/google|signInWithGoogle|integrity_verdict"
  ```
  - Expected: `PlayIntegrity` token minted line, then a `/auth/google` round-trip with HTTP 200, then `integrity_verdict: bypassed_apk` (apkRollout) OR `integrity_verdict: passed`. JWT persisted to Keychain.
- [ ] Force-quit + cold-start → app should land on Permissions (or Compat / Tutorial / Home depending on flow state — see Path B/C above).

---

## 3. Permissions (PERM-01..04)

- [ ] Permissions screen shows two cards: Camera + Microphone, both with 'Grant' CTAs. Continue/Next CTA is DISABLED until both granted.
- [ ] Tap 'Grant' on Camera → OS prompt → Allow → card flips to granted state.
- [ ] Tap 'Grant' on Microphone → OS prompt → Allow → card flips to granted state.
- [ ] Once both granted, Continue/Next CTA enabled → tap → CompatRunningScreen.
- [ ] Re-test the Deny path on a fresh install:
  - Inputs: `adb shell pm clear ai.humynlabs.capture.apk` then re-launch.
  - Tap Grant on Camera → Deny → card shows recovery copy + 'Open Settings' link → tap → Settings opens to the app's permission page.
- [ ] Static manifest check (defense-in-depth — already gated in CI, but confirm on the smoke device):
  ```
  adb shell dumpsys package ai.humynlabs.capture.apk | grep -E "android.permission.(CAMERA|RECORD_AUDIO|ACCESS_COARSE_LOCATION|FOREGROUND_SERVICE|REQUEST_INSTALL_PACKAGES)"
  ```
  Expected: CAMERA, RECORD_AUDIO, ACCESS_COARSE_LOCATION, FOREGROUND_SERVICE\* family, and REQUEST_INSTALL_PACKAGES (apkRollout-only) all present.

---

## 4. Behavioral compat-check happy path (COMPAT-01..03/05/07)

- [ ] CompatRunningScreen renders title 'Checking your phone' + sub 'Takes around 30 secs' + 130×130 progress ring + 7 rows.
- [ ] Watch the rows progress over ~30 s. The IMU sustained probe is the longest leg (full 30 s with preview running).
- [ ] At 100% the screen routes to CompatPassScreen with title "You're in." + sub 'All checks passed.' + 40 ms haptic.
- [ ] Tap Next → RigTutorialScreen.
- [ ] On a Pixel 7a or better, the device is expected to pass. On a downgrade-fixture device or a Helio-class budget Android, expect failure — see Section 5.

---

## 5. Compat-check fail UI (COMPAT-06 + COMPAT-08)

- [ ] Force a fail. Easiest path: install a debug build that overrides the IMU sustained probe to return 44 Hz (debug-only toggle in `compatService.ts` behind `__DEV__`). Or run on an actual Helio-class device that organically fails.
- [ ] CompatRunningScreen → CompatFailScreen with title "This phone can't record yet" + line "Stable motion sensors at 100 Hz+ required (yours: 44 Hz)" — verbatim per design-spec §4d.
- [ ] No Next CTA. Tap 'What now' → CompatRecoveryScreen.
- [ ] CompatRecoveryScreen renders 'What now' title + 3 recovery bullets + Contact Support button.
- [ ] Tap Contact Support → mailto sheet opens with the placeholder email **[EMAIL_ADDRESS]** in the To field. **NOTE:** the `[EMAIL_ADDRESS]` placeholder is a tracked Open Question (see `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` § OQ-1); the operator confirms the placeholder shows up but does NOT need to send the email.
- [ ] Hardware back from CompatRecoveryScreen → CompatFailScreen. Hardware back from CompatFailScreen → either re-runs compat or stays put (per D-NAV-04 — confirm the Phase 2 implementation does NOT reach Sign-up).

---

## 6. Tutorial Rig screen (ONB-01 + ONB-02)

- [ ] RigTutorialScreen renders heading "You'll need a head rig" + body "Mount your phone on the head rig and make sure it is steady while recording." (verbatim from design-spec).
- [ ] Tap "Don't have a rig yet" link → off-ramp screen with recovery info + Contact Support link (mailto:[EMAIL_ADDRESS]) (ONB-02). The placeholder is the same Open Question as Section 5.
- [ ] Hardware back → RigTutorial → tap Next → MainTabs Home (Phase 4 Practice Intro is NOT in Phase 2; Next routes directly to Home).

---

## 7. Bottom-nav + tab structure (HOME-07 + HOME-08)

- [ ] MainTabs renders EXACTLY 3 tabs: Home / Tasks / History. Profile is NOT a tab. (CI gate apps/mobile/**tests**/navigation/route-registry.test.ts already enforces this; confirm on-device for sanity.)
- [ ] Tap each tab — TopBar visible on all 3. Tab bar suppressed on Splash / Sign-up / Permissions / Compat\* / RigTutorial / ForceUpgrade (already verified by paths above; spot-check by tapping back into Sign-up after Logout in Section 8).
- [ ] Tap top-right avatar → Profile screen (PROF-01..05).

---

## 8. Profile screen (PROF-01..05 + AUTH-08..10)

- [ ] Profile head: avatar (Google photoURL or initial fallback) + name + 'tap to edit'.
- [ ] Tap Name field → inline TextInput → type a new name → blur → PATCH /me fires (watch `adb logcat | grep "PATCH /me"` in a separate terminal) → optimistic UI; reverts on backend error.
- [ ] Tap Age field → numeric keyboard → type 28 → blur → PATCH /me succeeds.
- [ ] Tap Gender field → keyboard → leave blank + blur → PATCH /me with `gender:null` succeeds (PROF-01 nullable).
- [ ] Joined date renders as `Joined {Month YYYY}` (non-editable).
- [ ] Lifetime block: numeric reads `0s` (Phase 2 has no recordings yet) + 'Across 0 tasks' (PROF-03).
- [ ] Payments & Earnings card: 'Coming soon' badge + body verbatim "Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed."
- [ ] Footer: `v0.1.0 (1) · apkRollout` (or current versionName/versionCode/flavor). Long-press to copy is nice-to-have.
- [ ] Tap 'Help Center' → HelpCenterScreen.
- [ ] Hardware back to Profile → tap 'Logout' → §18.3 modal renders verbatim copy → tap 'Log out' → returns to Sign-up. JWT cleared:
  ```
  adb shell run-as ai.humynlabs.capture.apk ls files/mmkv/   # auth.jwt.v1 absent
  ```
- [ ] Re-sign-in → Profile → tap 'Delete account' → §18.4 step 1 ('Your account will be deactivated for 30 days...' verbatim) → Continue → step 2 ('Type DELETE to confirm.') → type 'delete' (lowercase) → Confirm DISABLED. Type 'DELETE' (uppercase) → Confirm ENABLED → tap → DELETE /me?confirm=DELETE fires → MMKV cleared → returns to Sign-up. Backend logs show `deletedAt` set:
  ```
  psql $DATABASE_URL -c "SELECT email, deletedAt FROM users ORDER BY deletedAt DESC NULLS LAST LIMIT 5;"
  ```
- [ ] Re-sign-in within 30 days → Phase 1 server-side restore behavior un-soft-deletes the account (deletedAt → NULL). Confirm with the same SQL.

---

## 9. Help Center (HELP-01..05)

- [ ] HelpCenterScreen renders 3 accordions in order: Instructions Guide / FAQs / Troubleshooting (HELP-01). All collapsed by default.
- [ ] Tap each accordion → expands with verbatim copy from `apps/mobile/src/screens/help/content.json` (sourced from `help-center-content.md` via `npm run build:help`). Compare against the source file by visual inspection of the first item per accordion.
- [ ] Below the third accordion: 'Need more help?' + 'Contact Support' button → tap → mailto sheet opens with **[EMAIL_ADDRESS]** in To. **(Open Question — see 02-OPEN-QUESTIONS.md § OQ-1.)**
- [ ] Tap 'Report a problem' → sheet renders 8 category chips (FEEDBACK_CATEGORIES) + textarea.
- [ ] Pick category 'upload-stuck' + type a message → 'Send report' → POST /feedback succeeds:
  ```
  adb logcat | grep "/feedback"
  psql $DATABASE_URL -c "SELECT id, category, diagnostic_inline FROM feedback ORDER BY created_at DESC LIMIT 1;"
  ```
  Expected: feedback row inserted with diagnostic snapshot containing telemetry ring entries (first 100 KB inline + full file in S3 — D-HELP-02 + Pattern from 02-18 SUMMARY).

---

## 10. ForceUpgrade APK install (apkRollout, UPG-03)

This is the most-load-bearing manual section. The PackageInstaller dialog is impossible to assert from a unit test.

- [ ] Note the current installed `versionCode` on the smoke device:
  ```
  adb shell dumpsys package ai.humynlabs.capture.apk | grep versionCode
  ```
  (e.g. `versionCode=1`). Keep this value.
- [ ] Pre-build a NEW apkRollout APK at a higher versionCode (e.g. bump `defaultConfig.versionCode = 2` in `apps/mobile/android/app/build.gradle.kts`, then `assembleApkRolloutDebug`). Note the SHA-256:
  ```
  sha256sum apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk
  ```
  Upload this APK to a host the device can reach (e.g. `python3 -m http.server 9000` on the Mac, or S3 dev bucket).
- [ ] Bump backend `/app/version` to return `minSupported: 99.0.0` + `apkUrl: http://<host>:9000/app-apkRollout-debug.apk` + `apkSha256: <sha-from-above>` for the apkRollout flavor:
  ```
  psql $DATABASE_URL -c "UPDATE app_versions SET min_supported='99.0.0', apk_url='http://<LAN-IP>:9000/app-apkRollout-debug.apk', apk_sha256='<SHA>' WHERE flavor='apkRollout';"
  ```
- [ ] Cold-start app → Splash → ForceUpgradeScreen renders 'Update to continue.' + Update CTA.
- [ ] Tap Update → APK download (progress UI is basic per CONTEXT § Deferred 'APK download progress UI polish').
- [ ] On hash match: Settings 'Allow from this source' prompt may appear → grant → PackageInstaller dialog → tap Install → app updates and re-launches with the new versionCode.
- [ ] Confirm new versionCode:
  ```
  adb shell dumpsys package ai.humynlabs.capture.apk | grep versionCode
  ```
- [ ] **Hash-mismatch (integrity check) test:** modify backend to return wrong `apkSha256` (e.g. all zeros) on the same `apkUrl`. Cold-start → tap Update → after download, JS-side rejects → 'Update failed (integrity check). Try again or contact support.' Alert. Confirm via:
  ```
  adb logcat | grep -E "force_upgrade_apk_hash_mismatch|hash-mismatch|integrity check"
  ```
  Expected: a Firebase Analytics `force_upgrade_apk_hash_mismatch` event fires (Phase 7 Crashlytics dashboard surfaces this; per Pattern 50, the structural gate guarantees `launchInstaller` is NEVER called after a hash-mismatch rejection — T-2.20-01 mitigation).
- [ ] Reset backend min_supported + apk_sha256 to the real values when done.

---

## 11. ForceUpgrade Play Store hand-off (playStore, UPG-03)

- [ ] Build and install the playStore-flavor APK:
  ```
  cd apps/mobile/android && ./gradlew :app:assemblePlayStoreDebug
  adb uninstall ai.humynlabs.capture            # uninstall the OLDER playStore build if present
  adb install app/build/outputs/apk/playStore/debug/app-playStore-debug.apk
  ```
- [ ] Bump backend `/app/version` to return `min_supported: 99.0.0` for the playStore flavor:
  ```
  psql $DATABASE_URL -c "UPDATE app_versions SET min_supported='99.0.0' WHERE flavor='playStore';"
  ```
- [ ] Cold-start → ForceUpgradeScreen → tap Update → Play Store opens to the app listing (or Play Store install if Play Store app missing — emulators may not have Play Store installed; smoke MUST run on a real device with Play Store).
- [ ] Reset backend min_supported.

---

## 12. Soft-upgrade banner (UPG-04)

- [ ] Set backend `/app/version` to return `latest: 99.9.9, forceUpgrade: false, minSupported: 0.0.1` for the current flavor (so installedVersion < latest but ≥ minSupported):
  ```
  psql $DATABASE_URL -c "UPDATE app_versions SET latest='99.9.9', force_upgrade=false, min_supported='0.0.1' WHERE flavor='apkRollout';"
  ```
- [ ] Cold-start app → Home → soft-upgrade banner mounts at the top of the screen.
- [ ] Tap '×' → banner dismisses. Watch for the MMKV write:
  ```
  adb shell run-as ai.humynlabs.capture.apk ls files/mmkv/ | grep softBannerDismissed
  ```
  Expected: a key like `appVersion.softBannerDismissed.99.9.9` appears.
- [ ] Cold-start again → banner stays dismissed (per-version dismiss key — Pattern 51).
- [ ] Bump backend `latest` to a different value (e.g. `99.9.10`):
  ```
  psql $DATABASE_URL -c "UPDATE app_versions SET latest='99.9.10' WHERE flavor='apkRollout';"
  ```
  Cold-start → banner re-shows (new `latest` = fresh dismiss key, T-2.20-04 mitigation verified on-device).
- [ ] Tap Update from the banner → upgrade flow fires per flavor (apkRollout downloads / playStore market://); same paths as Section 10 / 11.
- [ ] Reset backend `latest` to the real value.

---

## 13. Crashlytics gate (PHASE-2 SHIP GATE)

This is the threat-register-mandated gate (T-2.21-01). The runbook is incomplete without it.

- [ ] Run the apkRollout debug build for **≥ 1 hour of continuous soak time** on the smoke device, exercising at least: Sign-up → Permissions → Compat → RigTutorial → Home → Profile (full edit) → Help Center (open all 3 accordions + Report-a-problem submit) → Logout → Sign-up.
- [ ] During soak, confirm the device has network reachability so Crashlytics events flush. Optionally verify with:
  ```
  adb logcat | grep -E "FirebaseCrashlytics|CrashlyticsCore"
  ```
  Expected: SDK-init lines on cold start, no `Fatal Exception` lines.
- [ ] After ≥ 1 hour, open Firebase Console → Crashlytics → apkRollout build (`<versionName> (<versionCode>)`). Confirm: **zero new fatal issues**, **zero new non-fatal issues** during the soak window.
- [ ] **Operator sign-off (T-2.21-01 mitigation — DO NOT SKIP):**
      _I confirm the Firebase Crashlytics dashboard for apkRollout build_ \_\_\_\_\_\_\_\_\_\_\_\_ (versionName + versionCode) _shows 0 new fatal/non-fatal issues over a ≥ 1 h soak as of_ \_\_\_\_\_\_\_\_\_\_\_\_ (timestamp UTC).

---

## Sign-off

- [ ] All sections above passed (or documented sub-bullet failures with logcat snippets + fix-forward plan numbers) on Pixel 7a (primary).
- [ ] (Optional) Repeated Sections 1–9 + 12 on Pixel 8a / 10a — note any device-specific failures here.
- [ ] Open Questions in `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` reviewed; the operator agrees to defer them to Phase 7 (or earlier if Product/Ops returns wording before then).

**Operator signature:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Approved? YES / NO**

If NO: list the failed sections + fix-forward plan numbers below:

| Failed section | Failure summary | Fix-forward plan | Logcat ref |
| -------------- | --------------- | ---------------- | ---------- |
|                |                 |                  |            |

---

## Notes / failures (paste logcat snippets here)

_Operator commits this file with all checkboxes checked + a final commit message of `docs(02-21): manual smoke complete on Pixel 7a — Phase 2 ready for verify-work` to close Phase 2._
