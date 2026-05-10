---
slug: playintegrity-invalid-project
status: resolved
trigger: 'Phase 2 manual smoke walk Section 2.3 blocked on Pixel 10a (apkRollout flavor, package ai.humynlabs.capture.apk). After tapping Continue with Google → selecting test account → returning to app, an error overlay renders on the Sign-up screen showing -16: Integrity API error (-16): The provided cloud project number is invalid.'
created: 2026-05-10
updated: 2026-05-10
phase: 02-mobile-shell-onboarding-permissions-compat-profile
goal: find_and_fix
tdd_mode: false
---

# Debug session: playintegrity-invalid-project

## Symptoms

### Expected behavior

After the user taps "Continue with Google" → picks a test account → returns to app:

1. `signInWithGoogle()` resolves with the Google ID token + nonce.
2. `NativeModules.PlayIntegrity.requestIntegrityToken(nonce)` resolves with an opaque encrypted Play Integrity token (string).
3. The mobile auth orchestrator POSTs `{ google_id_token, integrity_token, nonce }` to `/auth/google` on the dev API (`http://localhost:8080` via `adb reverse tcp:8080 tcp:8080`).
4. Backend returns 200 with a JWT (per Phase 1 plan 01-05); JWT persisted to Keychain.
5. logcat should show: `PlayIntegrity` token-mint line → `/auth/google` HTTP 200 → `integrity_verdict: bypassed_apk` (apkRollout flavor takes the bypass branch per D-AUTH-02 + plan 01-05 three-gate bypass).
6. App navigates to Permissions screen (or Compat / Tutorial / Home depending on flow state — fresh install lands on Permissions).

### Actual behavior

After Google account selection returns control to the app, a red error overlay renders ON THE SIGN-UP SCREEN (does not navigate forward). Error text:

```
-16: Integrity API error (-16): The provided cloud project number is invalid.
Use the cloud project number which can be found in Project info in your Google
Cloud Console for the cloud project where Play Integrity API is enabled.
(https://developer.android.com/google/play/integrity/reference/com/google/android/play/core/integrity/model/IntegrityErrorCode.html#CLOUD_PROJECT_NUMBER_IS_INVALID)
```

Auth flow halts. No `/auth/google` POST is made (the integrity token is never minted).

### Error messages

- On-device: see "Actual behavior" above.
- logcat (filtered for `PlayIntegrity|/auth/google|signInWithGoogle|integrity_verdict|GoogleSignIn|SIGN_IN|DEVELOPER_ERROR|ApiException|ReactNativeJS`) at the time of failure shows the Google Sign-In sheet rendered + returned successfully (`com.google.android.gms.signin.action.SIGN_IN result code=0`). The error fires AFTER on the subsequent native `PlayIntegrity.requestIntegrityToken` call. Background tail at `/private/tmp/claude-501/-Users-adnaan-Documents-hl-homelander/158e8bd1-4d98-4ced-93ab-9815637d0547/tasks/bed95v2uz.output`.

### Timeline

- 2026-05-10 ~08:30 — first observation.
- This is the FIRST time the smoke walk has gotten past the prior OAuth Android client gate (the previous blocker, which produced `DEVELOPER_ERROR` from `@react-native-google-signin/google-signin`, was resolved earlier today after the user registered the Android OAuth client in Google Cloud Console).
- The PlayIntegrity native module (`apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt`) was created in Phase 1 plan 01-13 but has never before been exercised end-to-end on real hardware — Phase 1 plan 01-13 was `code-ready-smoke-deferred` and the module's only prior validation was unit tests (Pattern 39 host-component shim + vi.mock).

### Reproduction steps

1. Backend running: `curl http://localhost:8080/healthz` → `{"status":"ok"}`.
2. Pixel 10a connected via USB; `adb devices` shows `5C161JEA304304 device`.
3. `adb reverse tcp:8080 tcp:8080` active.
4. apkRollout debug APK installed: `apps/mobile/android` → `./gradlew :app:assembleApkRolloutDebug` → `adb install -r app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`.
5. Launch app: `adb shell am start -n ai.humynlabs.capture.apk/ai.humynlabs.capture.MainActivity`.
6. On Sign-up screen, check the consent box.
7. Tap "Continue with Google".
8. Pick test account in the Google sheet.
9. Observe error overlay on return.

## Suspected root cause (UNCONFIRMED — verify before fixing)

`apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt:42` builds the request as:

```kotlin
val request = IntegrityTokenRequest.builder().setNonce(nonce).build()
```

No `setCloudProjectNumber(...)` call. Play Integrity Classic API REQUIRES an explicit cloud project number when the app's package is NOT registered in a Google Play Console app linked to a GCP project. The apkRollout flavor (`ai.humynlabs.capture.apk`) is INTENTIONALLY never in Play Console — D-FLAV-01 / D-DIST-01 establish it as the sideload-distribution flavor that ships before Play Store. So Play Integrity has no project to attribute the request to → returns `-16 CLOUD_PROJECT_NUMBER_IS_INVALID`.

The cloud project number should be `130483521533` — visible as the prefix of `GOOGLE_WEB_CLIENT_ID` in both `apps/mobile/.env.apkRollout` and `apps/mobile/.env.playStore`:

```
GOOGLE_WEB_CLIENT_ID=130483521533-rgtkna3144hod4hdvnkn32r8f6b0i414.apps.googleusercontent.com
```

### Operator dependency to confirm in parallel

Play Integrity API must be ENABLED on GCP project `130483521533` at https://console.cloud.google.com/apis/library/playintegrity.googleapis.com . If it's not enabled, even a correct `setCloudProjectNumber(130483521533L)` call will return a similar error. Worth surfacing to the user as a parallel operator check before declaring the fix verified.

## Constraints (do NOT violate)

- **Anti-pattern: cosmetic chasing during smoke.** Per saved memory `feedback_functionality_first_during_smoke.md`, do NOT touch the two uncommitted cosmetic-attempt edits in working tree:
  - `apps/mobile/src/screens/signup/SignupScreen.tsx`
  - `apps/mobile/src/ui/primitives/Text.tsx`
    These are mid-attempt cosmetic refinements (splash logo size, RethinkSans font, sign-up centering) deferred to Phase 3 Wave 1 per `02-COSMETIC-GAPS.md`.
- **Stack pin:** Play Integrity → custom Kotlin module (no third-party RN wrapper). MediaPipe stays at 0.10.21 (irrelevant here but a STACK.md hard rule). Do not introduce a new Play-Integrity npm package.
- **Module package separation (Pattern 40):** `PlayIntegrityModule` lives under `io.humyn.app.*`; the app body lives under `ai.humynlabs.capture.*`. Preserve this layout.
- **Per-flavor config wiring:** Existing pattern in `apps/mobile/android/app/build.gradle` is per-flavor `buildConfigField` blocks for `FLAVOR_NAME` and `APPLICATION_ID`. Match this pattern for the new cloud-project-number field rather than introducing react-native-config-only access (the recent commit 5fe1443 wires react-native-config for JS-side `Config.API_BASE_URL`, but native-side modules read BuildConfig).

## Side issue to fix in the same change

`apps/mobile/.env.playStore` had a DUPLICATE `API_BASE_URL` line:

```
API_BASE_URL=https://api.humyn.ai            ← intended (prod)
GOOGLE_WEB_CLIENT_ID=...
API_BASE_URL=http://192.168.1.10:8080         ← accidental dev override (LAN IP)
```

The second line wins (later override). Stripped.

## Context references

- Plan 01-13 (Phase 1, mobile sign-in scaffold) created `PlayIntegrityModule.kt` under `io.humyn.app/*` — module package separation per Pattern 40. Summary: `.planning/phases/01-foundation-backend-distribution-recon/01-13-SUMMARY.md`.
- Plan 01-05 (Phase 1, backend `/auth/google`) defines the three-gate install-source bypass (Pattern 17) and the apkRollout `integrity_verdict: bypassed_apk` outcome. Summary: `.planning/phases/01-foundation-backend-distribution-recon/01-05-SUMMARY.md`.
- Phase 2 plan 02-21 manual smoke runbook: `apps/mobile/02-MANUAL-SMOKE.md` (Section 2.3 is the blocked checkbox).
- Paused-mid-smoke handoff: `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/.continue-here.md` (created earlier today after the prior OAuth Android client blocker resolved).
- Existing logcat tail (background Bash `bed95v2uz`) at `/private/tmp/claude-501/-Users-adnaan-Documents-hl-homelander/158e8bd1-4d98-4ced-93ab-9815637d0547/tasks/bed95v2uz.output`.
- Test environment is UP and ready for re-test after fix:
  - Backend: `localhost:8080` ✓
  - Device: Pixel 10a `5C161JEA304304` ✓
  - `adb reverse tcp:8080 tcp:8080` active ✓
  - Cloud project number: `130483521533`
  - Debug keystore SHA-1: `F8:16:58:1D:44:79:5E:77:A3:DF:A4:B9:62:F2:03:37:42:58:42:7A`

## Current Focus

hypothesis: PlayIntegrityModule.kt missing setCloudProjectNumber(130483521533L) call; apkRollout package ai.humynlabs.capture.apk is not Play-Console-linked, so Classic Play Integrity API has no project to attribute the request to → returns -16 CLOUD_PROJECT_NUMBER_IS_INVALID.
test: Read PlayIntegrityModule.kt + build.gradle + .env.\* to confirm code-side gap; cross-check Play Integrity SDK version + setter signature; pick the type-safe wiring that matches the existing FLAVOR_NAME / APPLICATION_ID per-flavor BuildConfig pattern without producing a duplicate-field type collision against react-native-config's dotenv plugin.
expecting: Single missing setter call + per-flavor BuildConfig long; .env.playStore duplicate-API_BASE_URL side issue stripped; Play Integrity API enablement on GCP project 130483521533 surfaced as a parallel operator action.
next_action: Resolved. Compiled apkRolloutDebug variant against the new code. Surface operator action to enable Play Integrity API on GCP project 130483521533. Hand back to orchestrator for rebuild + reinstall + Section 2.3 re-test.

## Evidence

- timestamp: 2026-05-10 — Read `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt` (53 lines). Confirmed line 42 builds `IntegrityTokenRequest.builder().setNonce(nonce).build()` with no `setCloudProjectNumber(...)` call. Hypothesis confirmed at the call site.
- timestamp: 2026-05-10 — Read `apps/mobile/android/app/build.gradle`. Confirmed:
  - SDK pin: `implementation 'com.google.android.play:integrity:1.4.0'` (line 142) → Classic Play Integrity API; `IntegrityTokenRequest.setCloudProjectNumber(Long)` is the documented setter.
  - `flavorDimensions += 'distribution'` with two flavors `playStore` and `apkRollout`.
  - Per-flavor `buildConfigField 'String', 'FLAVOR_NAME', '...'` and `buildConfigField 'String', 'APPLICATION_ID', '...'` is the established native-side wiring pattern (lines 65-66, 74-75).
- timestamp: 2026-05-10 — Read `apps/mobile/.env.apkRollout` (9 lines). Cloud project number prefix `130483521533` confirmed inside `GOOGLE_WEB_CLIENT_ID`. No duplicate `API_BASE_URL`.
- timestamp: 2026-05-10 — Read `apps/mobile/.env.playStore` (5 lines). Confirmed duplicate `API_BASE_URL=http://192.168.1.10:8080` (LAN IP) on line 5 overriding the intended `API_BASE_URL=https://api.humyn.ai` on line 3. Side issue confirmed.
- timestamp: 2026-05-10 — Read `apps/mobile/node_modules/react-native-config/android/dotenv.gradle` (77 lines). CRITICAL FINDING: dotenv.gradle iterates ALL `.env` keys and emits `buildConfigField "String", k, "\"$v\""` in `defaultConfig` (lines 70-75). This means adding `GOOGLE_CLOUD_PROJECT_NUMBER=...` to `.env` files would emit a `String` BuildConfig field at defaultConfig scope. If we ALSO declared `buildConfigField 'long', 'GOOGLE_CLOUD_PROJECT_NUMBER', '130483521533L'` per-flavor, AGP would have to merge a `String` defaultConfig field with a `long` per-flavor field of the same name → type-mismatch build error. Therefore the cloud project number must NOT be added to `.env` files; it lives ONLY as a per-flavor `buildConfigField 'long', ...` block in build.gradle. (This deviates from the orchestrator handoff's preliminary suggestion to add it to .env, but corrects a guess that would have caused a fresh build break.)
- timestamp: 2026-05-10 — Searched `apps/mobile/src` for `GOOGLE_CLOUD_PROJECT_NUMBER`, `cloudProjectNumber`, `CloudProjectNumber`. Zero matches. JS-side has no caller, so dropping the .env entry costs nothing and avoids the type collision.
- timestamp: 2026-05-10 — Wrote `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt` (rewrite): added cross-package `import ai.humynlabs.capture.BuildConfig`; chained `.setCloudProjectNumber(BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER)` into the request builder; updated docstring to explain why the setter is required for non-Play-linked packages and to add `-16 CLOUD_PROJECT_NUMBER_IS_INVALID` to the error legend. No mtime/import changes outside the module.
- timestamp: 2026-05-10 — Wrote `apps/mobile/android/app/build.gradle` (rewrite): added `buildConfigField 'long', 'GOOGLE_CLOUD_PROJECT_NUMBER', '130483521533L'` to BOTH `playStore` and `apkRollout` flavor blocks, with explanatory comments distinguishing the rationale (playStore: redundant-but-uniform; apkRollout: required because never in Play Console). No other build-script changes.
- timestamp: 2026-05-10 — Wrote `apps/mobile/.env.playStore`: stripped the duplicate `API_BASE_URL=http://192.168.1.10:8080 ` line and the trailing whitespace from the `GOOGLE_WEB_CLIENT_ID` line. Did NOT add `GOOGLE_CLOUD_PROJECT_NUMBER` (see dotenv.gradle finding above).
- timestamp: 2026-05-10 — `.env.apkRollout` left UNCHANGED (no need; cloud project number lives in build.gradle only). Verified no working-tree change to that file via `git diff --stat`.
- timestamp: 2026-05-10 — Verified working tree: `git diff --stat` reports exactly 3 files changed (`apps/mobile/.env.playStore`, `apps/mobile/android/app/build.gradle`, `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt`). The two cosmetic Phase 3 Wave 1 files (`SignupScreen.tsx`, `Text.tsx`) are NOT in the fix diff (they remain in their pre-existing uncommitted state). Anti-pattern constraint honored.
- timestamp: 2026-05-10 — Ran `./gradlew :app:tasks --quiet`. Gradle parses the modified build.gradle cleanly; per-flavor task names (`assembleApkRolloutDebug`, `compileApkRolloutDebugKotlin`, etc.) all generate. No script-eval errors.
- timestamp: 2026-05-10 — Ran `rm -rf app/build/tmp/kotlin-classes/apkRolloutDebug app/build/generated/source/buildConfig/apkRollout/debug && ./gradlew :app:compileApkRolloutDebugKotlin`. **BUILD SUCCESSFUL** with `:app:compileApkRolloutDebugKotlin` actually executed (not UP-TO-DATE). The new `.setCloudProjectNumber(BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER)` call compiles against the freshly-generated apkRollout BuildConfig (`public static final long GOOGLE_CLOUD_PROJECT_NUMBER = 130483521533L;`). Cross-package import `ai.humynlabs.capture.BuildConfig` from `io.humyn.app.PlayIntegrityModule` resolves. All warnings present in the build are pre-existing deprecation notices unrelated to this fix.
- timestamp: 2026-05-10 — Ran `./gradlew :app:compilePlayStoreDebugKotlin`. BUILD FAILED, but at `:app:processPlayStoreDebugGoogleServices` because `app/src/playStore/google-services.json` does not exist. This is a pre-existing provisioning gap unrelated to this fix (only `app/src/apkRollout/google-services.json` is in the tree). The orchestrator's smoke pipeline only ever builds `assembleApkRolloutDebug`, so the playStore-flavor build path is not exercised during the manual smoke walk.

## Eliminated hypotheses

- **H-1: Wrong cloud project number.** Eliminated by inspection — the OAuth Web Client ID prefix is the GCP project number by Google's own convention (`{projectNumber}-{clientHash}.apps.googleusercontent.com`). Both `.env.apkRollout` and `.env.playStore` carry the same `GOOGLE_WEB_CLIENT_ID=130483521533-...`, so the project number is unambiguous: `130483521533`.
- **H-2: SDK at wrong API version (Standard vs. Classic).** Eliminated. `com.google.android.play:integrity:1.4.0` is the Classic API. The IntegrityTokenRequest.builder() / requestIntegrityToken() / setCloudProjectNumber(Long) shape used in the module matches the Classic API; Standard API would use `StandardIntegrityManager` + `prepareIntegrityToken()`. No SDK-version change is required.
- **H-3: Add cloud project number to .env files (orchestrator's preliminary suggestion).** Eliminated by the dotenv.gradle inspection. dotenv emits a `String` BuildConfig field for every .env key in defaultConfig; declaring the same field as `long` per-flavor would cause an AGP type-mismatch. The .env entries would also have to be parsed via `BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER.toLong()` in Kotlin, which gives no benefit since no JS caller reads `Config.GOOGLE_CLOUD_PROJECT_NUMBER` (grep for the symbol in apps/mobile/src returns zero matches). Going build.gradle-only is type-safe, idiomatic for native-only values, and matches the dotenv plugin's behavior without collision.
- **H-4: Need to register apkRollout package in Play Console.** Eliminated by design intent. D-FLAV-01 / D-DIST-01 establish apkRollout as the intentionally-sideload distribution flavor; per the project decision log it MUST NOT appear in Play Console. The Play Integrity Classic API documentation explicitly supports `setCloudProjectNumber(...)` as the path for non-Play-linked apps.

## Resolution

**Root cause.** `IntegrityTokenRequest` was built without `setCloudProjectNumber(Long)`. The Classic Play Integrity API requires this setter when the calling package is not registered in a Play Console app linked to a GCP project. The apkRollout flavor (`ai.humynlabs.capture.apk`, D-FLAV-01 / D-DIST-01) is intentionally never in Play Console — it is the sideload distribution flavor that ships before Play Store. With no Play Console linkage and no explicit project number, the Integrity API has no GCP project to attribute the request to and returns `-16 CLOUD_PROJECT_NUMBER_IS_INVALID`. (The playStore flavor would normally be auto-attributed once published, but we set the number on every flavor so the call site is uniform and a future Play-Console-linkage misconfiguration cannot silently regress us.)

**Fix.** Three files changed (verified compile-clean for `apkRolloutDebug`):

1. `apps/mobile/android/app/build.gradle` — added per-flavor `buildConfigField 'long', 'GOOGLE_CLOUD_PROJECT_NUMBER', '130483521533L'` to BOTH `playStore` and `apkRollout` flavor blocks, mirroring the existing `FLAVOR_NAME` / `APPLICATION_ID` per-flavor pattern. Project number is the prefix of `GOOGLE_WEB_CLIENT_ID` in the `.env.*` files.
2. `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt` — chained `.setCloudProjectNumber(BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER)` into the `IntegrityTokenRequest.builder()` call. Added cross-package import `ai.humynlabs.capture.BuildConfig` (the module lives in `io.humyn.app.*` per Pattern 40, but `BuildConfig` is generated under the app's namespace `ai.humynlabs.capture`). Updated the docstring to explain why the setter is required and added `-16` to the error-code legend.
3. `apps/mobile/.env.playStore` — side issue: stripped the duplicate `API_BASE_URL=http://192.168.1.10:8080` line on line 5 (a stale LAN-IP override that was silently shadowing the intended prod URL `https://api.humyn.ai`); also stripped trailing whitespace from the `GOOGLE_WEB_CLIENT_ID` line.

**Deliberately NOT changed.**

- `.env.apkRollout` — orchestrator handoff suggested adding `GOOGLE_CLOUD_PROJECT_NUMBER=130483521533`, but inspection of `node_modules/react-native-config/android/dotenv.gradle` shows the dotenv plugin emits a `String` BuildConfig field for every .env key in defaultConfig. Adding it would collide with the per-flavor `long` declaration in build.gradle (AGP merges defaultConfig→flavor BuildConfig fields and rejects type mismatches). No JS caller reads `Config.GOOGLE_CLOUD_PROJECT_NUMBER` (verified via grep on `apps/mobile/src`), so the build.gradle-only approach is correct and type-safe — `BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER` is consumed directly as a `Long` by the Play Integrity setter without any string parsing.
- `apps/mobile/src/screens/signup/SignupScreen.tsx` and `apps/mobile/src/ui/primitives/Text.tsx` — Phase 3 Wave 1 cosmetic backlog per `feedback_functionality_first_during_smoke.md` saved memory. Untouched.

**Verification performed in this session.**

- `./gradlew :app:tasks --quiet` — modified build.gradle parses; all per-flavor task variants generate.
- `./gradlew :app:compileApkRolloutDebugKotlin` (with cleared kotlin-classes + buildConfig outputs) — BUILD SUCCESSFUL; the new `.setCloudProjectNumber(BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER)` call compiles against the freshly-generated apkRollout `BuildConfig` (`public static final long GOOGLE_CLOUD_PROJECT_NUMBER = 130483521533L;`). The cross-package `import ai.humynlabs.capture.BuildConfig` from `io.humyn.app.PlayIntegrityModule` resolves at compile time.
- `./gradlew :app:compilePlayStoreDebugKotlin` — failed at `:app:processPlayStoreDebugGoogleServices` because `app/src/playStore/google-services.json` is missing. This is a pre-existing provisioning gap (only `app/src/apkRollout/google-services.json` is in the tree); it is NOT introduced by this fix and the smoke walk only ever builds `assembleApkRolloutDebug`, so the playStore variant is not on the verification path for this debug session. (Flagged here for the orchestrator's awareness when the playStore variant first comes online in a later phase.)

**Operator action required BEFORE re-test.**
Confirm the **Play Integrity API is enabled** on GCP project `130483521533`. Open https://console.cloud.google.com/apis/library/playintegrity.googleapis.com (with the project picker set to project number `130483521533`). If the page shows an "Enable" button, click it and wait ~30s for propagation. If it shows "API enabled" / "Manage" / "Try this API", you're already good. Without this, even the corrected `setCloudProjectNumber(130483521533L)` call will surface the SAME `-16` error code (the SDK conflates "project number invalid" and "Play Integrity API not enabled on the project" into the same error message).

**Post-fix orchestrator steps (handed back).**

1. From `apps/mobile/android/`, run `./gradlew :app:assembleApkRolloutDebug`.
2. `adb install -r app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`.
3. Re-launch via `adb shell am start -n ai.humynlabs.capture.apk/ai.humynlabs.capture.MainActivity`.
4. Have the operator re-attempt §2.3: tap consent → Continue with Google → pick test account.
5. Watch logcat (existing tail at `/private/tmp/claude-501/-Users-adnaan-Documents-hl-homelander/158e8bd1-4d98-4ced-93ab-9815637d0547/tasks/bed95v2uz.output`) for: `PlayIntegrity` token-mint line → `/auth/google` HTTP 200 → `integrity_verdict: bypassed_apk` (apkRollout takes the bypass branch per plan 01-05).

**Suggested commit message.**

```
fix(02-21): wire setCloudProjectNumber for Play Integrity Classic + strip duplicate API_BASE_URL

- PlayIntegrityModule.kt now chains .setCloudProjectNumber(BuildConfig.GOOGLE_CLOUD_PROJECT_NUMBER)
  into IntegrityTokenRequest.builder(). The apkRollout package
  (ai.humynlabs.capture.apk) is intentionally never registered in Play Console
  (D-FLAV-01 / D-DIST-01), so without an explicit project number the Classic
  Play Integrity API has no GCP project to attribute the request to and fails
  with -16 CLOUD_PROJECT_NUMBER_IS_INVALID.
- build.gradle: per-flavor `buildConfigField 'long', 'GOOGLE_CLOUD_PROJECT_NUMBER',
  '130483521533L'` added to both playStore and apkRollout (mirrors the
  FLAVOR_NAME / APPLICATION_ID per-flavor pattern). Number is the prefix of
  GOOGLE_WEB_CLIENT_ID in the .env files.
- .env.playStore: stripped a duplicate API_BASE_URL line on L5 that was
  silently shadowing the prod URL with a stale LAN IP.
- .env.apkRollout: deliberately NOT modified — react-native-config's
  dotenv.gradle would emit a duplicate String BuildConfig field colliding with
  the per-flavor long declaration; no JS caller reads Config.GOOGLE_CLOUD_PROJECT_NUMBER.

Verified by ./gradlew :app:compileApkRolloutDebugKotlin (clean rebuild).

Pre-req for runtime success: Play Integrity API must be enabled on GCP
project 130483521533 (operator-side; one-click in GCP Console).

Unblocks Phase 2 manual smoke walk Section 2.3.
```

(A new pattern entry "Pattern 58 — per-flavor BuildConfig long for Play Integrity cloud project number, with dotenv-collision rationale" can be drafted by the orchestrator after the runtime green light if it wants to memorialize the dotenv-vs-explicit-buildConfigField gotcha.)
