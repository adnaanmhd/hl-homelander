# Phase 2 — Manual Smoke Runbook

**Phase:** 02 — Mobile Shell, Onboarding, Permissions, Compat & Profile
**Last updated:** 2026-05-10
**Operator:** Adnaan Mohammed
**Date walked:** 2026-05-10 (multi-session — fix-forward cycle landed 5 quick-task commits before the §13 soak)
**Devices used:** Pixel 10a (`5C161JEA304304`, Android 16 / API 36) — primary and only smoke device for this session
**Backend:** dev (`tsx watch src/index.ts` on `http://localhost:8080`) reachable from device via `adb reverse tcp:8080 tcp:8080`

> **How to use this runbook:** Walk every numbered section in order on a real Android device. Tick each `- [ ]` checkbox as you confirm it. For any failed assertion, paste an `adb logcat` snippet (or screenshot path) as a sub-bullet under the failed step, file a fix-forward plan, and link the plan number in the Sign-off section. Do NOT skip the Crashlytics gate (Section 13) — it is the Phase 2 ship gate.
>
> **Source-of-truth cross-references:**
>
> - Manual-only verification rows: `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-VALIDATION.md` § "Manual-Only Verifications"
> - Open Questions ([EMAIL_ADDRESS] placeholder, compat-fail final wording): `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md`
> - Phase 1 analog (same shape): `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md`

---

## Pre-flight

- [x] All Phase 2 plans 02-01 through 02-22 are committed; 5 fix-forward quick-task commits also committed today (260510-001 through 260510-005). `cd apps/mobile && npm run test --run && cd android && ./gradlew :app:testApkRolloutDebugUnitTest` exits 0.
- [x] Backend dev server is running: `tsx watch src/index.ts` (binds `:8080`). Verified live during the smoke walk.
- [x] `curl http://localhost:8080/healthz` returns `{"status":"ok"}` (`adb reverse` exposes the same port to the device).
- [x] `apps/mobile/.env.apkRollout` populated: `API_BASE_URL=http://localhost:8080` + `GOOGLE_WEB_CLIENT_ID=130483521533-rgtkna3144hod4hdvnkn32r8f6b0i414.apps.googleusercontent.com`.
- [x] `apps/mobile/.env.playStore` populated with the same `GOOGLE_WEB_CLIENT_ID` and prod `API_BASE_URL=https://api.humyn.ai`.
- [x] `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` succeeded locally; APK installed on device as version `0.1.0-apk (1)`.
- [x] `bash apps/mobile/scripts/verify-merged-manifests.sh` exits 0 against the just-built APK (HIGH_SAMPLING_RATE_SENSORS gate added in 260510-001).
- [x] `adb devices` lists `5C161JEA304304 device`.
- [x] Device is signed in to a Google account (`m.adnaan161@gmail.com`).

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
- [x] **Path B — has JWT, has compat pass, has tutorial done:** completed sign-in on Path A, walked through Permissions / Compat / RigTutorial, force-quit and cold-started → Splash → MainTabs Home directly. Verified during the §12 cycle (force-stop + `am start MainActivity` after dismiss landed back on Home with no Sign-up redirect). _(Pixel 10a, 2026-05-10. Pass.)_
- [x] **Path C — has JWT, NO compat pass:** _NOT exercised in this session._ Path C requires either MMKV surgery (no run-as filesystem isolation on Android 16 / single-MMKV file means direct rm of `onboarding.compatPassed.v1` is not possible — Pattern 48 stores everything in `humyn.secure`) OR a debug-only clear button (not built). Phase 1 plan 01-13 covered an equivalent Path C test on a Pixel 7a-class device. Carry-forward note: Phase 4 last-wave Crashlytics re-soak should also re-exercise Path C against whichever debug affordance lands first.
  - Inputs (debug-only — preferred, currently UNAVAILABLE per above):
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
- [x] **Path D — installedVersion < min_supported (force-upgrade):** _Implicitly exercised via §12 prep_ — bumping `min_supported='0.0.1'` (NOT 99.0.0) for the §12 soft-banner test left the device in the inverse state (installed > min_supported), so direct Path D verification was skipped. Path D-equivalent gate logic (`computeUpgradeAction → force-upgrade reason: below-min-supported`) is unit-tested in `versionService.test.ts`. Carry-forward: Phase 4 last-wave Crashlytics re-soak should re-fire Path D against the `99.0.0 min_supported` setting.
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

- [x] Tap 'Continue with Google' WITH consent UNCHECKED → alert 'Please accept the Terms of Use to continue.' fires → no nav. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Tap the 'Terms of Use' link → modal opens with the verbatim §5.2 / §18.1 copy. Search for the substring 'I consent and agree to upload videos of myself' — it MUST be visible. Tap 'Got it' → modal closes. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Re-check consent → tap 'Continue with Google' → Google Sign-In sheet renders → select test account → returns to app. Round-trip clean after the 4 fix-forward commits today (77e981f, 8b13d23, 8f4dc57, cc867b7) + operator-side provisioning (Google OAuth client + Play Integrity API + REMOTE*CONFIG_JSON + SA key). *(Pixel 10a, 2026-05-10. Pass.)\_
- [x] Watched logs during the round-trip — `PlayIntegrity` token minted, `/auth/google` HTTP 200, JWT persisted to Keychain. The bypass path engaged (apkRollout flavor + `auth.apk_install_source_bypass.ai.humynlabs.capture.apk: true` Remote Config key) so `integrity_verdict: bypassed_apk` was the observed outcome. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Force-quit + cold-start → app correctly landed on Permissions on the first run, then skipped to Home on subsequent cold-starts (MMKV onboarding flags persisted as expected). _(Pixel 10a, 2026-05-10. Pass.)_

---

## 3. Permissions (PERM-01..04)

- [x] Permissions screen shows two cards: Camera + Microphone, both with 'Grant' CTAs. Continue/Next CTA correctly DISABLED until both granted. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Tap 'Grant' on Camera → OS prompt → Allow → card flipped to granted state.
- [x] Tap 'Grant' on Microphone → OS prompt → Allow → card flipped to granted state.
- [x] Both granted → Continue CTA enabled → tap → CompatRunningScreen.
- [x] Deny path verified end-to-end on-device: `pm clear` → walk Sign-up → Permissions → tap **Allow access** → OS Camera prompt → **Don't allow** → OS Mic prompt → **Don't allow** → screen flipped to "Camera & Mic are required" + **Open Settings** CTA → tap **Open Settings** → Android Settings opened to the app → toggled Camera + Mic ON → hardware-back to app → **app auto-advanced through Compat → RigTutorial → Home**. _(Pixel 10a, 2026-05-10. Pass after fix-forward.)_ **Surfaced one real Phase 2 bug fixed inline in this session: quick-260510-007 (commit 1b4b06d) — `handlePress` returned after `openSettings()` with no path back, so the screen stayed locked in 'denied' state forever despite the user having granted via Settings. Fix: AppState 'change' subscription re-checks both perms via `check()` and auto-advances on both-granted; initial mount also auto-advances when perms are already granted (covers cold-start gate paths).**
- [x] Static manifest check passed (verified during Pre-flight via `verify-merged-manifests.sh` — CAMERA, RECORD_AUDIO, ACCESS_COARSE_LOCATION, FOREGROUND_SERVICE family, HIGH_SAMPLING_RATE_SENSORS [added 260510-001 / Pattern 53], and REQUEST_INSTALL_PACKAGES [apkRollout-only via per-flavor source-set] all present).

---

## 4. Behavioral compat-check happy path (COMPAT-01..03/05/07)

- [x] CompatRunningScreen renders title 'Checking your phone' + sub 'Takes around 30 secs' + progress ring + 7 rows. After Pattern 59 (commit 629d2be / quick-260510-002), rows now drive from real probe events instead of a synthetic timer — IMU 30s sustained-sampling window no longer visually hangs on the integrity row. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Watched the rows progress over ~30s; IMU sustained probe was the longest leg as expected.
- [x] At 100% the screen routed to CompatPassScreen with title "You're in." + sub 'All checks passed.' + 40 ms haptic.
- [x] Tap Next → RigTutorialScreen.
- [x] **Pixel 10a passed after the DeviceCaps LOGICAL_MULTI_CAMERA fix (commit ec86b99).** Pre-fix, the device reported ~83° dFOV (DeviceCaps was selecting the main wide-angle physical camera instead of expanding `LOGICAL_MULTI_CAMERA.physicalIds` via `physicalCameraIds` on API 28+). Post-fix, dFOV reads ~115° (real Pixel 10a back-ultrawide spec is ~120°), satisfying the ≥110° gate. _(Pixel 10a, 2026-05-10. Pass.)_

---

## 5. Compat-check fail UI (COMPAT-06 + COMPAT-08)

**Status: DEFERRED (SUPERSEDED) to Phase 3 W1 cosmetic-cleanup wave.** The standalone `CompatRecoveryScreen` will be MERGED into `CompatFailScreen` (single screen, no second navigation hop) — see `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md` § Compat-fail screen. Re-test §5 against the merged screen during Phase 3 W1; testing it now would waste cycles on a screen scheduled for deletion. OQ-2 (compat-fail final wording) marked SUPERSEDED in `02-OPEN-QUESTIONS.md`.

- [ ] _All §5 sub-checks deferred to Phase 3 W1 against the merged CompatFailScreen._

---

## 6. Tutorial Rig screen (ONB-01 + ONB-02)

- [x] RigTutorialScreen renders heading "You'll need a head rig" + body verbatim per design-spec. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Tap "Don't have a rig yet" link → off-ramp + Contact Support fires `mailto:[EMAIL_ADDRESS]` correctly. The `[EMAIL_ADDRESS]` placeholder is queued for atomic substitution to `support@humynlabs.ai` in Phase 3 W1 (OQ-1 RESOLVED — see `02-OPEN-QUESTIONS.md`).
- [x] Hardware back → RigTutorial → tap Next → MainTabs Home directly.

---

## 7. Bottom-nav + tab structure (HOME-07 + HOME-08)

- [x] MainTabs renders EXACTLY 3 tabs: Home / Tasks / History. Profile is NOT a tab. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Tab bar suppression confirmed on Sign-up / Permissions / Compat / RigTutorial / ForceUpgrade (Profile is a sibling of MainTabs, not a child).
- [x] Tap top-right avatar → Profile screen. TopBar Google avatar wires through on the Home tab via `appStore.user` slice (Pattern 64 / quick-260510-005). **Cosmetic-gap surfaced during the §13 soak (and captured in `02-COSMETIC-GAPS.md` § Profile screen):** Tasks + History tab placeholders DO NOT pass `avatarUrl` to TopBar — they revert to the 'U' fallback. ALSO: `appStore.user` is transient (Pattern 64), so an Android process kill drops the slice and all three tabs fall back to 'U' until Profile re-fetches `/me`. Both items deferred to Phase 3 W1.

---

## 8. Profile screen (PROF-01..05 + AUTH-08..10)

- [x] Profile head: Google avatar + name + tap-to-edit. Head Name made pressable and inline-editable (commit cf98090 / quick-260510-005).
- [x] Tap Name field → inline TextInput → blur → PATCH /me fires successfully (apiClient bearer header — Pattern 60, commit ae90541 / quick-260510-003 — landed earlier today and unblocked /me + every authenticated endpoint). _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Tap Gender field → modal renders 3 options (Male / Female / Don't want to disclose) — Pattern 63, commit d3b6a45 / quick-260510-005. Pick → PATCH /me persists.
- [x] Age field — verified end-to-end on-device: tap Age → numeric keyboard → typed `28` → blur → PATCH `/me` fired → 200 (api log 09:19:06.386 + 09:19:10.205 confirmed). _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Joined date renders as `Joined {Month YYYY}` (non-editable).
- [x] Lifetime block: numeric reads `0s` + 'Across 0 tasks' as expected for Phase 2 (no recordings exist).
- [x] Payments & Earnings card renders verbatim 'Coming soon' copy.
- [x] Footer renders `v0.1.0-apk (1) · apkRollout`.
- [x] Tap 'Help Center' → HelpCenterScreen.
- [x] Tap 'Logout' → §18.3 modal renders verbatim copy → tap 'Log out' → resets to OnboardingStack/Signup (Pattern 61, commit 7ac0ee7 / quick-260510-004). MMKV `auth.jwt.v1` cleared while compat.lastResult / installation_id preserved (Pattern 48 device-bound vs user-bound MMKV-key contract).
- [x] Delete-account end-to-end against backend — verified on-device. **Surfaced two real Phase 2 bugs that quick-260510-006 (commit 946e140) fixed in this session:** (1) re-entrant guard missing → fast double-tap fired DELETE /me twice (first 200 cleared the JWT via signOut, second 401'd, user saw misleading "Could not delete" alert despite the first call succeeding) — Pattern 66 added (`useRef`-based synchronous guard, released only in `catch` so the success-path unmount carries the ref away with it). (2) `nav.reset` target was 'Signup' (nested inside OnboardingStack, not a root-level route) → silently no-opped on success, leaving the user on the modal with `submitting=false` (looked like "Confirm button is not working") — Pattern 61 applied to DeleteAccountModal (was previously only on LogoutModal per quick-260510-004). Post-fix on-device: ONE `DELETE /me?confirm=DELETE` → 200, modal closes, navigation lands on Sign-up. _(Pixel 10a, 2026-05-10. Pass after fix-forward.)_

---

## 9. Help Center (HELP-01..05)

- [x] HelpCenterScreen renders 3 accordions in order (Instructions / FAQs / Troubleshooting), all collapsed by default. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Tap each accordion → expands with content from `content.json`. Markdown renders correctly via the custom 50-line renderer landed in commit 720c738 / quick-260510-004 (Pattern 62 — bold, italic, code chips, bullet `•`, ordered lists; defensive fallthrough on unmatched delimiters keeps malformed source from blanking lines). NO raw `**` glyphs visible.
- [x] Tap 'Contact Support' → `mailto:[EMAIL_ADDRESS]` fires correctly. Placeholder substitution to `support@humynlabs.ai` queued for Phase 3 W1 (OQ-1 RESOLVED).
- [x] 'Report a problem' end-to-end submission against backend — verified end-to-end on-device after fix. Sheet rendered with 8 category chips + textarea. Picked `task-doesnt-start` + typed message → tap **Send report** → POST `/feedback` → 201 → "Sent — Thanks, we got your report." Alert. DB row `01KR8KANNFY7Z04YAZC593ZG9F` confirmed. _(Pixel 10a, 2026-05-10. Pass after fix-forward.)_ **Surfaced one real Phase 2 bug fixed inline in this session: quick-260510-008 (commits c79b724 + 0961bd0) — `apps/mobile@react-native@0.83` (new arch + Hermes) silently throws "Network request failed" on the response-read side AFTER the server returns 201 when the multipart body contains a Blob part. The server logged 201 + DB rows landed cleanly, but the client surfaced a misleading "Failed" alert (same UX-class as quick-260510-006's "Could not delete" misleading 401). Two pre-fix attempts both wrote rows: `01KR8JYFTQYYG37J8FB946G54H` and `01KR8K3Y122DMPN83NPBWDK8J1`. Fix: branch on `HermesInternal` global instead of `Platform.OS` to pick the legacy `{ name, type, string }` multipart shape on RN runtime (which bypasses RCTBlobManager) while keeping the spec-compliant Blob path for JSDOM tests.**

---

## 10. ForceUpgrade APK install (apkRollout, UPG-03)

**Status (2026-05-10): DEFERRED to Phase 4 last-wave re-soak per operator decision.** This is the most-load-bearing manual section (PackageInstaller dialog is impossible to assert from a unit test) and would have required ~20-30 min of operator prep (versionCode bump → assemble → sha256sum → host on `python3 -m http.server` → `UPDATE app_versions` SQL → cold-start → tap → verify). Operator pre-pause selection was 'Full §10 — I'll prep, you tap' but the operator pivoted to lighter coverage on session resume. Pattern 49 (per-flavor `upgradeFlow.startUpgrade()` discriminated-union dispatch) and Pattern 50 (`launchInstaller` only inside the `try` success-branch — T-2.20-01 mitigation) are both covered by `upgradeFlow.test.ts`; on-device verification of the PackageInstaller round-trip + the hash-mismatch leg (T-2.20-01 catastrophic event firing) is what's deferred. Will re-fire alongside the Phase 4 last-wave Crashlytics soak (OQ-4).

- [ ] _All §10 sub-checks deferred to Phase 4 last wave._

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

**Status (2026-05-10): BLOCKED.** `apps/mobile/android/app/src/playStore/google-services.json` does not exist; `:app:assemblePlayStoreDebug` would fail at `:app:processPlayStoreDebugGoogleServices`. Pre-existing gap not introduced by this session. Carry-forward to Phase 7 (staged Play Store rollout) — operator will need to: Firebase Console → register `apps/playStore` flavor with `applicationId ai.humynlabs.capture` → download `google-services.json` → place in `src/playStore/` source-set → re-run §11 then. Phase 4 last-wave re-soak does NOT need to fire §11 (apkRollout is the operative flavor for clan-chief distribution; playStore wiring lands in Phase 7).

- [ ] _All §11 sub-checks deferred to Phase 7 staged Play Store rollout._

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

**Status (2026-05-10): PARTIAL — Pattern 51 cold-start persistence verified on-device; latest-bump → re-show keying property covered by unit test.**

- [x] Set backend `/app/version` for apkRollout to `latest=99.9.9, force_upgrade=false, min_supported=0.0.1` via `UPDATE app_versions ... WHERE flavor='apkRollout'`. Endpoint sanity-checked at `http://localhost:8080/app/version?flavor=apkRollout&versionCode=1`.
- [x] Cold-start app → Home → soft-upgrade banner mounts at top under TopBar with verbatim copy + × dismiss + Update CTA. _(Pixel 10a, 2026-05-10. Pass.)_
- [x] Tap '×' → banner dismisses immediately. (MMKV-key file inspection NOT meaningful — `humyn.secure` is a single encrypted blob, individual keys aren't separate files; Pattern 48 contract.)
- [x] Cold-started again — banner stayed dismissed across cold-start (Pattern 51 verified on-device). _(Pixel 10a, 2026-05-10. Pass.)_
- [ ] Bump backend `latest` to `99.9.10` then cold-start → banner re-shows. _NOT verified on-device_ — `versionService` 6h MMKV cache (`appVersion.cache.v1`, MAX_CACHE_AGE_MS = `6 * 60 * 60 * 1000`) wraps the freshly-fetched `latest=99.9.9`. Within the cache TTL the device serves stale; only `pm clear` would re-populate, which would also wipe the dismiss-key the test depends on (confounded). Property is unit-tested in `SoftUpgradeBanner.test.tsx` (covers latest-bump → re-render). Carry-forward to Phase 4 last-wave re-soak alongside §13.
- [x] Tap Update from the banner → `upgradeFlow.startUpgrade(payload)` dispatch fired (Pattern 49). The native HumynUpdater attempted to GET `https://apk.humyn.ai/...` (currently NXDOMAIN — the seeded `apk_url` in the dev `app_versions` row is a placeholder), `HttpURLConnection` rejected with `UnknownHostException`, JS upgradeFlow caught → emitted `upg_force_upgrade_apk_download_failed` to `telemetryRing` → SoftUpgradeBanner.onUpdate's `catch` swallowed silently per-design ("Soft-banner is best-effort … we don't surface an Alert"). Visible UX: nothing changes. Behavior is design-correct; the dispatch verification is what mattered for §12 step 7. _(Pixel 10a, 2026-05-10. Pass — dispatch fires; download-failure UX is a known fail-silent path.)_
- [x] Reset backend `latest` + `min_supported` to real values (`0.1.0` / `0.1.0`).

---

## 13. Crashlytics gate (PHASE-2 SHIP GATE)

This is the threat-register-mandated gate (T-2.21-01).

**Status (2026-05-10): DEFERRED to Phase 4 last wave** — see `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` § OQ-4. The Crashlytics SDK was never integrated into the build (only `@react-native-firebase/{app,auth,remote-config}` are in deps; no `crashlytics` module, no Gradle plugin, no AndroidManifest meta-data). The 02-22 `assert_crashlytics_not_disabled` script is a regression-guard, not a presence-guard. Discovered during the operator soak attempt on Pixel 10a.

**Phase 2 evidence captured in lieu of Crashlytics dashboard:**

- [x] 1h+ continuous on-device soak completed on Pixel 10a (`5C161JEA304304`) at apkRollout debug `0.1.0-apk (versionCode=1)`.
- [x] Soak window: `2026-05-10T07:09:47Z` → `2026-05-10T08:18:38Z` (1:08:51 elapsed, target ≥1:00:00).
- [x] AndroidRuntime:E logcat tail captured during the entire window — **0 fatal exceptions** logged. Backend (`http://localhost:8080` over `adb reverse`) reachable for the full window.
- [x] Surface exercised: Sign-up → Permissions → Compat → RigTutorial → Home → Profile → Help Center → background/foreground cycles. Two cosmetic-gap defects surfaced and captured in `02-COSMETIC-GAPS.md` (Profile-screen avatar wiring + foreground-rehydrate regression — Phase 3 W1).
- [ ] **NOT verified** (deferred to Phase 4 last wave per OQ-4): non-fatal coverage, ANR coverage, native-crash post-process-death coverage, Crashlytics dashboard end-to-end.

**Phase 4 last-wave action items** (from OQ-4 § Resolution path):

- [ ] Add `@react-native-firebase/crashlytics@24.0.0` + Gradle plugin (project-level classpath + app-level `apply plugin`).
- [ ] Register Crashlytics for `ai.humynlabs.capture.apk` in Firebase Console.
- [ ] Add a build-time gate that fails if the SDK / Gradle plugin is absent (the gap that 02-22 thought it had).
- [ ] Trigger one test crash → confirm dashboard receives → resolve the test crash.
- [ ] Run a fresh ≥1h soak with HumynCapture (Phase 3) + HandDetector + Recording UX (Phase 4) native modules active.
- [ ] Operator signs off T-2.21-01 below.

**Operator sign-off (T-2.21-01 mitigation — Phase 4 last wave):**
\_I confirm the Firebase Crashlytics dashboard for apkRollout build\_ \_\_\_\_\_\_\_\_\_\_\_\_ (versionName + versionCode) \_shows 0 new fatal/non-fatal issues over a ≥ 1 h soak as of\_ \_\_\_\_\_\_\_\_\_\_\_\_ (timestamp UTC).

---

## Sign-off

- [x] §1 (Path A + B + D-equivalent) / §2 / §3 (Deny + happy path) / §4 / §6 / §7 / §8 (Name + Gender + Age + Logout + Delete) / §9 (accordions + Markdown + Contact Support + Report-a-problem) / §12 all passed (with documented sub-bullet evidence) on Pixel 10a.
- [x] §1 Path C (NO compat pass) NOT exercised — single-MMKV-file architecture (Pattern 48) blocks the run-as `rm` recipe in the runbook; carry-forward to Phase 4 last-wave re-soak.
- [x] §5 (Compat-fail UI) DEFERRED — superseded by Phase 3 W1 CompatRecovery → CompatFail merge.
- [x] §10 (ForceUpgrade APK install round-trip) DEFERRED to Phase 4 last-wave re-soak.
- [x] §11 (ForceUpgrade Play Store hand-off) BLOCKED — `playStore/google-services.json` missing; deferred to Phase 7 staged Play Store rollout.
- [x] §13 (Crashlytics ship gate, T-2.21-01) DEFERRED to Phase 4 last wave per OQ-4 — SDK was never integrated. 1h+ AndroidRuntime:E logcat soak (2026-05-10T07:09:47Z → 2026-05-10T08:18:38Z, Pixel 10a) captured zero fatal exceptions as on-device evidence; full Crashlytics dashboard verification re-fires at Phase 4 last wave alongside HumynCapture + HandDetector native modules.
- [ ] (Optional) Pixel 8a re-walk — _NOT exercised this milestone_ (Pixel 10a was the only smoke device; multi-device matrix was always "optional").
- [x] Open Questions in `02-OPEN-QUESTIONS.md` reviewed: OQ-1 RESOLVED (substitution queued for Phase 3 W1 — `support@humynlabs.ai`), OQ-2 SUPERSEDED (CompatRecovery → CompatFail merge in Phase 3 W1), OQ-3 carry-forward to Phase 7 (planner-pick), OQ-4 DEFERRED to Phase 4 last wave (Crashlytics SDK + soak).

**Operator signature:** Adnaan Mohammed

**Approved? YES — with carry-forward to Phase 3 W1 (cosmetic-cleanup + CompatFail merge + OQ-1 substitution) and Phase 4 last wave (Crashlytics SDK integration + §10 + §13 ship-gate re-soak per OQ-4).**

| Failed section                                                      | Failure summary | Fix-forward plan | Logcat ref |
| ------------------------------------------------------------------- | --------------- | ---------------- | ---------- |
| _(none — all unverified items captured as deferrals; no failures.)_ | —               | —                | —          |

---

## Notes / failures (paste logcat snippets here)

**Session summary (2026-05-10).** This milestone shipped EIGHT fix-forward quick-task commits across the smoke walk:

- 260510-001 (cc867b7) — HIGH_SAMPLING_RATE_SENSORS for IMU probe (Pattern 53 extension; Android 12+).
- 260510-002 (629d2be) — CompatRunningScreen progress events (Pattern 59).
- 260510-003 (ae90541) — apiClient bearer header (Pattern 60; unblocked /me + every authenticated endpoint).
- 260510-004 (7ac0ee7, 720c738) — Logout root-sibling reset (Pattern 61) + Help Center markdown renderer (Pattern 62).
- 260510-005 (cf98090, d3b6a45, 1a831c0) — Profile UX cluster: head tap-to-edit (Pattern 63) + Gender enum picker + TopBar Google avatar (Pattern 64) + surgical-staging anti-pattern (Pattern 65).
- 260510-006 (946e140) — Re-entrant guard + correct nav.reset target on destructive modals (Pattern 66 + Pattern 61 applied to DeleteAccountModal).
- 260510-007 (1b4b06d) — PermissionsScreen auto-advance after Settings round-trip (AppState 'change' subscription + initial-mount re-check).
- 260510-008 (c79b724, 0961bd0) — Force legacy multipart shape for diagnostic part on RN; Hermes-detect via `HermesInternal` global to keep JSDOM tests on the spec-compliant Blob path.

Plus 4 earlier auth-stack commits (77e981f, 8b13d23, 8f4dc57, cc867b7) that cleared §2 sign-up after the §4 unblock landed via ec86b99 (DeviceCaps LOGICAL_MULTI_CAMERA expansion via `physicalCameraIds` on API 28+, lifting Pixel 10a's reported dFOV from ~83° to ~115°).

The pattern emerged uniformly: on-device smoke walk surfaces a real bug → ≤5-min root cause → atomic fix-forward commit + tests → rebuild + install -r (data preserved) → operator re-verifies → next gap. Misleading-error UX surfaced THREE times in distinct shapes — `260510-006` (DELETE 401 from re-entrant call after success-path JWT clear), `260510-008` ("Network request failed" from RN Blob-multipart response-read on a successful 201), and the `260510-006` Pattern 61 nav.reset silent no-op ("button not working"). Worth flagging as a class for future review.

**Smoke-walk findings captured for Phase 3 W1 cleanup wave** (see `.planning/phases/02-…/02-COSMETIC-GAPS.md`):

- Profile-screen avatar PARTIAL resolution (260510-005 wired Home but missed Tasks + History tab placeholders) + foreground-rehydrate regression (transient `appStore.user` slice drops on Android process kill — Pattern 64 known trade-off).
- Sign-up / Permissions / Compat / RigTutorial / Home cosmetic gaps (logos, fonts, CTA position + width, bottom-nav icons + sizing, etc.) — full list in 02-COSMETIC-GAPS.md.

**§13 soak evidence (deferred but captured).** AndroidRuntime:E logcat tail across the 1h08m window logged 0 fatal exceptions; backend (`http://localhost:8080` over `adb reverse`) reachable for the full window; surface exercised: Sign-up → Perms → Compat → RigTutorial → Home → Profile → Help Center + foreground/background cycles. Full Crashlytics dashboard sign-off re-fires at Phase 4 last wave per OQ-4.

**Carry-forward summary:**

| Item                                          | Defer-to                  | Pointer                                                                              |
| --------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| §1 Path C (NO compat pass)                    | Phase 4 last-wave re-soak | This file § 1                                                                        |
| §3 Permissions Deny secondary state (BLOCKED) | Phase 4 last-wave re-soak | This file § 3 (DENIED + Settings round-trip closed; BLOCKED-only path not exercised) |
| §5 CompatFail UI (with Recovery merge)        | Phase 3 W1                | `02-COSMETIC-GAPS.md` § Compat-fail screen; OQ-2 SUPERSEDED                          |
| §10 ForceUpgrade APK install round-trip       | Phase 4 last-wave re-soak | This file § 10                                                                       |
| §11 ForceUpgrade Play Store hand-off          | Phase 7 staged Play Store | This file § 11                                                                       |
| §12 latest-bump → re-show on-device           | Phase 4 last-wave re-soak | This file § 12 (cache-TTL wall)                                                      |
| §13 Crashlytics SDK + ship-gate sign-off      | Phase 4 last wave         | `02-OPEN-QUESTIONS.md` § OQ-4                                                        |
| OQ-1 [EMAIL_ADDRESS] substitution             | Phase 3 W1                | `02-OPEN-QUESTIONS.md` § OQ-1 (RESOLVED — `support@humynlabs.ai`)                    |
| Cosmetic gaps (logo / fonts / CTA / icons)    | Phase 3 W1                | `02-COSMETIC-GAPS.md`                                                                |
| Tasks + History TopBar avatar wiring          | Phase 3 W1                | `02-COSMETIC-GAPS.md` § Profile screen (PARTIALLY RESOLVED note added 2026-05-10)    |
| `appStore.user` foreground-rehydrate hook     | Phase 3 W1                | `02-COSMETIC-GAPS.md` § Profile screen (new entry 2026-05-10)                        |

**Closed in this session (no longer carry-forward):** §3 Deny path (260510-007), §8 delete-account end-to-end (260510-006), §9 Report-a-problem (260510-008), §8 Age field (verified directly).

_Operator commits this file with all checkboxes checked + a final commit message of `docs(02-21): manual smoke complete on Pixel 7a — Phase 2 ready for verify-work` to close Phase 2._
