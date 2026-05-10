---
status: complete
phase: 02-mobile-shell-onboarding-permissions-compat-profile
source: 02-01 through 02-22 SUMMARY.md + apps/mobile/02-MANUAL-SMOKE.md walked Pixel 10a 2026-05-10
started: 2026-05-10T15:25:00Z
updated: 2026-05-10T15:36:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold-start gate routing

expected: Splash routes correctly between Sign-up / Compat / RigTutorial / MainTabs Home / ForceUpgrade based on persisted MMKV state. Path A (fresh install) lands on Sign-up; Path B (full onboarding done) lands on Home directly. Path D (force-upgrade) covered by computeUpgradeAction unit tests.
result: pass

### 2. Sign-up + Terms-of-Use modal

expected: Google sign-in round-trip works end-to-end. Consent checkbox enforces "must be checked before sign-in"; Terms-of-Use modal renders verbatim §5.2 + §18.1 copy. Backend `/auth/google` returns 200 with `integrity_verdict: bypassed_apk` for the apkRollout flavor (Remote Config + flavor-allowlist gate). JWT persisted to Keychain; cold-start picks up the session.
result: pass

### 3. Permissions flow (PERM-01..04)

expected: Camera + Mic prompts work in sequence (modal OS prompts, can't overlap). Both granted → advance to Compat. Deny path: tap Allow → Don't allow → screen flips to "Camera & Mic are required" + Open Settings CTA → tap → Android Settings deep-links to the app's permission page. Granting via Settings → returning to app → AppState 'change' fires → re-check both perms → both granted → app auto-advances to Compat (quick-260510-007 fix verified on-device).
result: pass

### 4. Behavioral Compat check (COMPAT-01..03/05/07)

expected: CompatRunningScreen renders 7 probe rows with progress driven from real probe events (Pattern 59). At 100% on a qualifying device, routes to CompatPassScreen with title "You're in." + 40 ms haptic. On Pixel 10a after the DeviceCaps LOGICAL_MULTI_CAMERA fix (ec86b99), reported back-ultrawide dFOV is ~115° (≥110° gate).
result: pass

### 5. Onboarding tutorial + bottom-nav structure

expected: RigTutorialScreen renders heading + body verbatim per design-spec. "Don't have a rig yet" → off-ramp + Contact Support mailto. Tap Next → MainTabs Home. MainTabs renders EXACTLY 3 tabs (Home / Tasks / History) with tab bar suppression on Sign-up / Permissions / Compat / RigTutorial / ForceUpgrade. Avatar tap → Profile screen (sibling of MainTabs, not a child).
result: pass

### 6. Profile edits + auth lifecycle (PROF-01..05 + AUTH-08..10)

expected: Profile head shows Google avatar + name + tap-to-edit. Tap Name → inline TextInput → blur → PATCH /me persists. Tap Gender → modal with 3 options (Male / Female / Don't want to disclose) → pick → PATCH /me persists. Tap Age → numeric keyboard → type → blur → PATCH /me persists. Logout → §18.3 modal → Log out → returns to Sign-up via OnboardingStack (Pattern 61). Delete-account → §18.4 two-step (informational + DELETE typing gate, case-sensitive) → confirms → ONE DELETE /me request fires (Pattern 66 re-entrancy guard) → 200 → returns to Sign-up via OnboardingStack (Pattern 61 applied).
result: pass
note: User flagged "profile avatar becomes 'U' again after closing app and reopening" — accepted Phase 3 W1 deferral. Reinforced entry in 02-COSMETIC-GAPS.md § Profile screen with explicit UAT-confirmed annotation.

### 7. Help Center (HELP-01..05)

expected: HelpCenterScreen renders 3 accordions in order (Instructions / FAQs / Troubleshooting), all collapsed by default. Tap each → expands with markdown content (bold, italic, code chips, bullets, ordered lists) rendered via the custom 50-line parser (Pattern 62). Contact Support → mailto fires with placeholder. Report-a-problem → sheet with 8 category chips + textarea → Send report → POST /feedback returns 201 → "Sent — Thanks, we got your report." Alert (quick-260510-008 fix: Hermes-detect + legacy multipart shape verified on-device).
result: pass

### 8. Soft-upgrade banner (UPG-04)

expected: When backend `/app/version` returns latest > installed but installed ≥ minSupported, SoftUpgradeBanner mounts at the top of Home (under TopBar). Tap × dismisses; cold-starting again keeps the banner dismissed (per-version dismiss key — Pattern 51 verified on-device). Tap Update fires `upgradeFlow.startUpgrade(payload)` — the same Pattern 49 dispatch as ForceUpgrade. Latest-bump → re-show keying property covered by SoftUpgradeBanner.test.tsx (cache TTL wall blocks on-device step).
result: pass

### 9. ForceUpgrade gate (UPG-01/02/03/05)

expected: Code-side Pattern 49 (per-flavor discriminated-union dispatch) + Pattern 50 (catastrophic-event defense-in-depth — launchInstaller only inside try success-branch + hash-mismatch fires `upg_force_upgrade_apk_hash_mismatch` Analytics event) covered by unit tests. The Path D force-upgrade route + ForceUpgradeScreen render + tap Update dispatch verified across plan 02-20 unit tests. On-device APK round-trip + PackageInstaller dialog + hash-mismatch path explicitly DEFERRED to Phase 4 last wave per Notes section of `apps/mobile/02-MANUAL-SMOKE.md` § 10.
result: skipped
reason: User-confirmed deferral of on-device leg to Phase 4 last wave (alongside §10 ForceUpgrade APK round-trip + Crashlytics ship gate per OQ-4). Code-side Pattern 49 + Pattern 50 unit-test coverage stands.

### 10. Phase 2 ship gate (Crashlytics T-2.21-01)

expected: This is the threat-register-mandated ship gate. **Status: DEFERRED to Phase 4 last wave per OQ-4** (`02-OPEN-QUESTIONS.md`). The Crashlytics SDK (`@react-native-firebase/crashlytics`) was never integrated — discovered during the §13 soak attempt when Firebase Console showed "Add SDK" CTA. On-device evidence captured in lieu: 1h08m AndroidRuntime:E logcat soak on Pixel 10a (2026-05-10T07:09:47Z → 08:18:38Z) with 0 fatal exceptions; surface exercised: Sign-up → Perms → Compat → RigTutorial → Home → Profile → Help Center → background/foreground cycles. Full Crashlytics dashboard sign-off re-fires at Phase 4 last wave alongside HumynCapture (Phase 3) + HandDetector (Phase 4) native modules.
result: skipped
reason: User-confirmed deferral. SDK integration + 1h Crashlytics-dashboard soak re-fires at Phase 4 last wave per OQ-4. 1h+ on-device AndroidRuntime:E clean-logcat soak captured as Phase-2 acceptance evidence in lieu.

## Summary

total: 10
passed: 8
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps

[none — all skipped items have explicit deferral reasons + carry-forward pointers in 02-MANUAL-SMOKE.md and 02-OPEN-QUESTIONS.md OQ-4]
