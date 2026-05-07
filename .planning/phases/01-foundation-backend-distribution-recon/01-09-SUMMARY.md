---
phase: 01-foundation-backend-distribution-recon
plan: 09
subsystem: mobile
tags:
  [
    android,
    gradle,
    product-flavors,
    manifest-merger,
    react-native,
    kotlin,
    turbomodule,
    flavor-allowlist,
    ci-gate,
    keystore,
  ]

# Dependency graph
requires:
  - phase: 01
    plan: 01
    provides: apps/mobile/ workspace skeleton with stub package.json + tsconfig.json (extends ../../tsconfig.base.json with jsx=react-native + DOM lib); root .gitignore already excludes apps/mobile/android/keystores/ + apps/mobile/ios/Pods/
  - phase: 01
    plan: 05
    provides: server-side flavor allowlist (apps/api/src/auth/flavor-allowlist.ts) cross-checks (flavor, applicationId) — this plan's apkRollout=ai.humynlabs.capture.apk + playStore=ai.humynlabs.capture matches the wire contract verbatim
provides:
  - Two Android product flavors (apkRollout, playStore) with distinct applicationIds (D-FLAV-01) and identical branding (D-FLAV-03), each with its own signingConfig reading from CI env vars
  - Per-flavor AndroidManifest.xml source set — apkRollout adds REQUEST_INSTALL_PACKAGES via flavor-only manifest at android/app/src/apkRollout/AndroidManifest.xml; base manifest never declares it (Play-Store auto-reject mitigation T-1.9-01)
  - apps/mobile/android/keystores/ directory present in repo (with .gitignore that excludes everything else) so CI can drop decrypted keystores at build time without polluting the working tree (T-1.9-02 mitigation)
  - Custom Kotlin AppFlavor TurboModule (AppFlavorModule.kt + AppFlavorPackage.kt + MainApplication.kt) exposing BuildConfig.FLAVOR_NAME + BuildConfig.APPLICATION_ID as RN bridge constants — wire-side identity for /auth/google
  - Typed JS wrapper apps/mobile/src/native/AppFlavor.ts — Flavor = 'apkRollout' | 'playStore' union (NO iosAppStore — Phase 7; NO third recon flavor — DIST-07 rescinded)
  - Per-flavor .env files (.env.apkRollout, .env.playStore) with FLAVOR_NAME + APPLICATION_ID + API_BASE_URL + empty GOOGLE_WEB_CLIENT_ID placeholder for CI fill
  - CI gate script apps/mobile/scripts/verify-merged-manifests.sh — runs `:app:processApkRolloutDebugManifest` + `:app:processPlayStoreDebugManifest`, walks the AGP-version-flexible merged-manifest paths, asserts apkRollout has REQUEST_INSTALL_PACKAGES and playStore does NOT
  - apps/mobile typecheck script now runs `tsc --noEmit` against the new src/ tree (replaces the deferred-to-plan-13 echo stub)
  - Minimal `react-native` ambient declaration shim under apps/mobile/src/types/ keeping Phase 1 typecheck self-contained until plan 13 installs the real RN package
affects:
  [
    01-13 (Sign-In screen lands on top of this scaffolding — uses NativeModules.AppFlavor for the /auth/google body's flavor + applicationId; deletes the react-native.d.ts shim once the real package is installed),
    Phase 7 (iOS scheme target + iosAppStore flavor wiring lands here — the AppFlavor module's iOS analogue mirrors this Kotlin shape),
    CI (verify-merged-manifests.sh becomes a required step on every PR that touches apps/mobile/android/),
  ]

# Tech tracking
tech-stack:
  added: [] # All Android tooling pins were established in CLAUDE.md / STACK.md; this plan applies them.
  patterns:
    - 'Pattern 35 (Per-flavor source-set manifest gating): permissions that Play Store auto-rejects (REQUEST_INSTALL_PACKAGES) live ONLY in flavor-specific manifests at android/app/src/{flavor}/AndroidManifest.xml — never in the base manifest. Manifest merger gates the merge; CI verify-merged-manifests.sh fails the build if it leaks. Two-layer defense: code review (grep base manifest at PR time) + build-time merger gate.'
    - 'Pattern 36 (CI env-var keystore paths): signingConfigs reference keystores via System.getenv("PLAY_STORE_KEYSTORE_PATH") / "APK_ROLLOUT_KEYSTORE_PATH") with file-based fallback to apps/mobile/android/keystores/{playstore,apkrollout}.keystore. CI provider injects decrypted keystores at build time; the keystores directory has its own .gitignore (* + !.gitignore) so the dir exists but no real key can be committed. Defense-in-depth alongside root .gitignore.'
    - 'Pattern 37 (BuildConfig flavor exposure to RN via custom TurboModule): the canonical wire-side identity (flavor + applicationId) is set as buildConfigField on each productFlavor block; a Kotlin ReactContextBaseJavaModule reads BuildConfig.FLAVOR_NAME + BuildConfig.APPLICATION_ID and exposes them as constants via getConstants() so JS can read sync via NativeModules.AppFlavor.flavor. Overrides RESEARCH §4.7 react-native-config recommendation per the prompt directive — keeps the surface inside the app rather than threading another dependency through the bundler.'
    - 'Pattern 38 (Two-flavors-only with rescinded marker): DIST-07 (compatRecon) carries through requirements: as a rescinded marker string ("DIST-07 [rescinded — see CONTEXT.md D-DIST-01]") so the coverage gate sees the ID, but build.gradle has zero string-mentions of compatRecon or iosAppStore (verified by acceptance criterion `grep -c "compatRecon|iosAppStore" -eq 0`). iOS distribution is an Xcode scheme, not an Android product flavor — Phase 7 wires it separately.'

key-files:
  created:
    - apps/mobile/android/build.gradle (root Gradle config — AGP 8.7.3, Kotlin 2.0.21, compileSdk 35, JDK 17 per CLAUDE.md)
    - apps/mobile/android/settings.gradle (RN autolink + :app include)
    - apps/mobile/android/gradle.properties (Hermes + new arch enabled, useAndroidX, nonTransitiveRClass)
    - apps/mobile/android/app/build.gradle (productFlavors block — apkRollout + playStore; signingConfigs from env vars; buildConfigFields FLAVOR_NAME + APPLICATION_ID)
    - apps/mobile/android/app/src/main/AndroidManifest.xml (BASE manifest — INTERNET + ACCESS_NETWORK_STATE only; never the install-source permission)
    - apps/mobile/android/app/src/apkRollout/AndroidManifest.xml (FLAVOR-only manifest — adds REQUEST_INSTALL_PACKAGES with tools:targetApi=34)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt (ReactContextBaseJavaModule exposing BuildConfig values via getConstants())
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorPackage.kt (ReactPackage glue)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (RN 0.83 / Hermes / new-arch Application with AppFlavorPackage registered)
    - apps/mobile/android/keystores/.gitignore (`*` + `!.gitignore` — keep dir, exclude all keystores)
    - apps/mobile/.env.apkRollout (FLAVOR_NAME=apkRollout / APPLICATION_ID=ai.humynlabs.capture.apk)
    - apps/mobile/.env.playStore (FLAVOR_NAME=playStore / APPLICATION_ID=ai.humynlabs.capture)
    - apps/mobile/src/native/AppFlavor.ts (typed JS wrapper — Flavor union + getFlavorContext())
    - apps/mobile/src/index.ts (Phase 1 entrypoint placeholder — bootInfo() exports getFlavorContext)
    - apps/mobile/src/types/react-native.d.ts (minimal NativeModules ambient shim until plan 13)
    - apps/mobile/scripts/verify-merged-manifests.sh (CI gate script, executable)
  modified:
    - .gitignore (refine apps/mobile/android/keystores/ rule to preserve the directory's own .gitignore as a defense-in-depth marker)
    - apps/mobile/package.json (typecheck: tsc --noEmit; verify-manifests script wired)
    - apps/mobile/tsconfig.json (types: [] — defer real RN types to plan 13)

key-decisions:
  - 'Locked applicationIds per D-FLAV-01: apkRollout=ai.humynlabs.capture.apk, playStore=ai.humynlabs.capture. Source: PLAN.md frontmatter must_haves.truths line "Per-flavor applicationId: apkRollout=ai.humynlabs.capture.apk; playStore=ai.humynlabs.capture (D-FLAV-01)" + CONTEXT.md D-FLAV-01 + the existing test fixture apps/api/test/routes/auth-google-iosAppStore.test.ts (which sends `applicationId: ai.humynlabs.capture` for iosAppStore, mirroring playStore canonical). Resolves the STATE.md blocker entry: "Phase 1: APK build flavor `applicationId` choice (`ai.humynlabs.capture.apk` vs `ai.humynlabs.capture`) — locked before flavor structure built". Server-side flavor-allowlist.ts (plan 05) already cross-checks both pairs verbatim.'
  - 'react-native types deferred to plan 13 via a minimal ambient shim (apps/mobile/src/types/react-native.d.ts). Adding the full react-native@0.83.x install at this plan would expand the dep tree by ~30 packages for a Phase 1 scaffold whose only TS surface is one NativeModules access. Plan 13 already owns the full RN install and will delete the shim. Rationale: keeps the typecheck self-contained, preserves install footprint, and matches plan 01-01''s explicit deferred-to-plan-13 comment in apps/mobile/package.json.'
  - 'Kotlin TurboModule overrides RESEARCH §4.7 react-native-config recommendation per the prompt directive. The plan body explicitly says "this plan ships a custom Kotlin module named `AppFlavor`, not `react-native-config`". JS reads via NativeModules.AppFlavor.flavor; cleaner than threading another bundler dep through Phase 1.'
  - 'Refined root .gitignore from `apps/mobile/android/keystores/` to `apps/mobile/android/keystores/*` + `!apps/mobile/android/keystores/.gitignore`. The original blanket-ignore meant the keystores directory could not exist in the repo (its own `.gitignore` would have been ignored too). The refined rule keeps every keystore file ignored while letting the directory marker through. Defense-in-depth: the in-dir `.gitignore` ALSO excludes everything via `*` + re-includes itself; either layer alone is sufficient.'
  - 'Removed the explicit string mentions of "compatRecon" and "iosAppStore" from build.gradle comments to satisfy the acceptance criterion `grep -c "compatRecon|iosAppStore" -eq 0`. Replacement comment preserves the same intent ("Two flavors only. DIST-07 ... rescinded ... iOS distribution is an Xcode scheme target, not an Android product flavor; Phase 7 wires that separately"). The DIST-07 marker remains in the PLAN.md frontmatter as the canonical rescinded-requirement record for the coverage gate.'

patterns-established:
  - 'Pattern 35 (Per-flavor source-set manifest gating)'
  - 'Pattern 36 (CI env-var keystore paths)'
  - 'Pattern 37 (BuildConfig flavor exposure to RN via custom TurboModule)'
  - 'Pattern 38 (Two-flavors-only with rescinded DIST-07 marker)'

requirements-completed: [DIST-01, DIST-02, DIST-03] # DIST-07 is rescinded — appears in requirements: as a marker only, no implementation; not "completed" in the affirmative sense but resolved by the rescind decision per D-DIST-01.

# Metrics
duration: 7min
completed: 2026-05-07
---

# Phase 01 Plan 09: Mobile Build Flavors and Source Sets Summary

**Two Android product flavors (apkRollout, playStore) with distinct applicationIds (D-FLAV-01) and identical branding, per-flavor AndroidManifest.xml source sets gating REQUEST_INSTALL_PACKAGES (only on apkRollout — Play Store auto-rejects), a CI manifest-merger gate that fails the build if the playStore APK leaks the permission, a typed JS wrapper backed by a custom Kotlin AppFlavor TurboModule for runtime flavor reads, and per-flavor .env files. DIST-07 (third compatRecon flavor) rescinded per CONTEXT.md D-DIST-01 — not built. iOS flavor wiring deferred to Phase 7. Workspace typecheck remains green across all three TS projects (apps/api, apps/mobile, shared/types).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-07T15:32:46Z
- **Completed:** 2026-05-07T15:40:24Z
- **Tasks:** 3 / 3
- **Files created:** 16
- **Files modified:** 3

## Accomplishments

- **Two Android product flavors** (`apkRollout`, `playStore`) declared in `apps/mobile/android/app/build.gradle` with the locked applicationIds — `apkRollout=ai.humynlabs.capture.apk` (D-FLAV-01 `.apk` suffix; co-installs with playStore; matches plan 05's `flavor-allowlist.ts`) and `playStore=ai.humynlabs.capture` (canonical, permanent — once on Play Store, never changes). Both flavors share the same display name "Humyn Labs Capture" and launcher-icon resources per D-FLAV-03; channel signal lives in app behavior and the `BuildConfig.FLAVOR_NAME` constant, never in branding.
- **Manifest source-set gating** for `REQUEST_INSTALL_PACKAGES`. Base manifest at `apps/mobile/android/app/src/main/AndroidManifest.xml` declares `INTERNET` + `ACCESS_NETWORK_STATE` only — verified clean by `! grep "REQUEST_INSTALL_PACKAGES"`. Flavor-only manifest at `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` adds the in-app installer permission with `tools:targetApi="34"` to silence Android 14+ lint. The Gradle manifest merger merges this into the apkRollout APK only; the playStore APK is structurally clean and will pass Play Console policy review.
- **CI manifest-merger gate** at `apps/mobile/scripts/verify-merged-manifests.sh` (executable, runs the standard `processApkRolloutDebugManifest` + `processPlayStoreDebugManifest` Gradle tasks, walks the AGP-version-flexible merged-manifest output paths, and asserts `apk_count >= 1` while `ps_count == 0`). Failure message explicitly says "Play Store will reject this APK" so the regression mode is unambiguous in CI logs. Wired as `pnpm --filter @humyn/mobile verify-manifests`.
- **Per-flavor signing configs** in `apps/mobile/android/app/build.gradle` reading from CI env vars `PLAY_STORE_KEYSTORE_PATH` + `PLAY_STORE_KEYSTORE_PASSWORD` + `PLAY_STORE_KEY_ALIAS` + `PLAY_STORE_KEY_PASSWORD` (and the mirror set for `APK_ROLLOUT_*`). Local fallback to `${rootProject.projectDir}/keystores/{playstore,apkrollout}.keystore` so dev builds can drop a self-signed test keystore without env-var setup. Real keystores arrive at CI runtime via decrypted secrets per D-APK-03.
- **Keystores directory** `apps/mobile/android/keystores/` exists in the repo with a local `.gitignore` (`*` + `!.gitignore`) that excludes any real keystore file — defense-in-depth alongside the refined root `.gitignore` rule (`apps/mobile/android/keystores/*` + `!apps/mobile/android/keystores/.gitignore`). Either layer alone is sufficient to prevent a committed key.
- **Custom Kotlin AppFlavor TurboModule** (`AppFlavorModule.kt` + `AppFlavorPackage.kt` + `MainApplication.kt`). The module reads `BuildConfig.FLAVOR_NAME` + `BuildConfig.APPLICATION_ID` (set as `buildConfigField` on each productFlavor) and exposes them as RN bridge constants via `getConstants()` so JS can read `NativeModules.AppFlavor.flavor` + `.applicationId` synchronously. Async `get()` also exposed for future TurboModule consumers. `MainApplication.kt` is the RN 0.83 / Hermes / new-architecture shape with `AppFlavorPackage` appended to the auto-linked `PackageList(this).packages`.
- **Typed JS wrapper** `apps/mobile/src/native/AppFlavor.ts` exports `Flavor = 'apkRollout' | 'playStore'` (the type union is the canonical Phase 1 contract — NO `iosAppStore`, NO third compatRecon flavor) and `AppApplicationId = 'ai.humynlabs.capture' | 'ai.humynlabs.capture.apk'` plus `getFlavorContext()` which throws if the native module is unregistered (test/web safety; plan 13 will mock or stub for unit tests).
- **Per-flavor `.env` files** at `apps/mobile/.env.apkRollout` + `apps/mobile/.env.playStore` carrying `FLAVOR_NAME` + `APPLICATION_ID` + `API_BASE_URL=https://api.humyn.ai` + an empty `GOOGLE_WEB_CLIENT_ID` placeholder. CI fills the Web OAuth client ID at build time per the @react-native-google-signin/google-signin Credential Manager flow.
- **Workspace typecheck remains green.** `pnpm typecheck` runs across all three TypeScript projects (apps/api, apps/mobile, shared/types) and exits 0; the new mobile src/ files compile under `tsc --noEmit` against the minimal `react-native` ambient shim. The shim documents that plan 13 will delete it once the real `react-native` package + bundled types are installed.

## Task Commits

Each task was committed atomically on `main`. The pre-commit hook ran `lint-staged` + `pnpm typecheck` for every commit; all green.

1. **Task 1: Android Gradle config — flavors, signing, base manifest, apkRollout flavor manifest, keystores .gitignore** — `79809ab` (feat)
2. **Task 2: Custom Kotlin AppFlavor TurboModule + JS wrapper + per-flavor .env files** — `5220af8` (feat)
3. **Task 3: Manifest-merger CI verification script + mobile typecheck wiring** — `a2049bd` (feat)

**Plan metadata commit:** appended below.

## Files Created / Modified

**Created (16):**

- `apps/mobile/android/build.gradle` — root Gradle config (AGP 8.7.3, Kotlin 2.0.21, compileSdk 35, JDK 17).
- `apps/mobile/android/settings.gradle` — RN autolink + `:app` include.
- `apps/mobile/android/gradle.properties` — Hermes + new arch enabled, useAndroidX, nonTransitiveRClass.
- `apps/mobile/android/app/build.gradle` — `productFlavors { apkRollout, playStore }` + signingConfigs from env vars + `buildConfigField FLAVOR_NAME + APPLICATION_ID`.
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — base manifest, `INTERNET` + `ACCESS_NETWORK_STATE` only.
- `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` — flavor-only, adds `REQUEST_INSTALL_PACKAGES` with `tools:targetApi="34"`.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` — `ReactContextBaseJavaModule` exposing `BuildConfig.FLAVOR_NAME` + `BuildConfig.APPLICATION_ID` via `getConstants()`.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorPackage.kt` — `ReactPackage` glue.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` — RN 0.83 / Hermes / new-arch `Application` with `AppFlavorPackage` registered.
- `apps/mobile/android/keystores/.gitignore` — `*` + `!.gitignore`.
- `apps/mobile/.env.apkRollout` — `FLAVOR_NAME=apkRollout` + `APPLICATION_ID=ai.humynlabs.capture.apk` + API + empty `GOOGLE_WEB_CLIENT_ID`.
- `apps/mobile/.env.playStore` — `FLAVOR_NAME=playStore` + `APPLICATION_ID=ai.humynlabs.capture` + API + empty `GOOGLE_WEB_CLIENT_ID`.
- `apps/mobile/src/native/AppFlavor.ts` — typed JS wrapper: `Flavor` union + `getFlavorContext()`.
- `apps/mobile/src/index.ts` — Phase 1 entrypoint placeholder; `bootInfo()` re-exports `getFlavorContext`.
- `apps/mobile/src/types/react-native.d.ts` — minimal `NativeModules` ambient shim until plan 13.
- `apps/mobile/scripts/verify-merged-manifests.sh` — CI gate script (executable).

**Modified (3):**

- `.gitignore` — refine `apps/mobile/android/keystores/` rule to keep the directory's own `.gitignore` tracked (defense-in-depth; both layers exclude real keystores).
- `apps/mobile/package.json` — `typecheck: tsc --noEmit`; `verify-manifests: bash scripts/verify-merged-manifests.sh`.
- `apps/mobile/tsconfig.json` — `types: []` (was: `['react-native']`); real RN type install lands in plan 13.

## Decisions Made

- **applicationId lock per D-FLAV-01.** Resolves the STATE.md blocker entry "Phase 1: APK build flavor `applicationId` choice (`ai.humynlabs.capture.apk` vs `ai.humynlabs.capture`) — locked before flavor structure built". Sources cited: (1) PLAN.md frontmatter `must_haves.truths` line "Per-flavor applicationId: apkRollout=ai.humynlabs.capture.apk; playStore=ai.humynlabs.capture (D-FLAV-01)"; (2) CONTEXT.md D-FLAV-01 verbatim; (3) the existing test fixture `apps/api/test/routes/auth-google-iosAppStore.test.ts` which sends `applicationId: 'ai.humynlabs.capture'` for iosAppStore (mirroring playStore canonical, confirming the `.apk` suffix is reserved exclusively for apkRollout); (4) plan 05's `flavor-allowlist.ts` already wired with both pairs.
- **react-native types deferred to plan 13.** Adding the real `react-native@0.83.x` install at this plan would expand the dep tree by ~30 packages for a scaffold whose entire TS surface is one `NativeModules.AppFlavor` access. A minimal ambient shim at `apps/mobile/src/types/react-native.d.ts` keeps Phase 1 typecheck self-contained; plan 13 deletes the shim once the real package is installed. Matches the deferred-to-plan-13 stance set in plan 01-01's `apps/mobile/package.json` script comments.
- **Kotlin TurboModule over react-native-config.** Plan body explicitly overrides RESEARCH §4.7's `react-native-config` recommendation: "this plan ships a custom Kotlin module named `AppFlavor`, not `react-native-config`". Cleaner — keeps the surface inside the app rather than threading another bundler dep through Phase 1; `BuildConfig.FLAVOR_NAME` + `BuildConfig.APPLICATION_ID` are already compile-time constants set by Gradle.
- **Refined root .gitignore for keystores.** Original `apps/mobile/android/keystores/` (blanket-ignore) meant the keystores directory could not exist in the repo (its own `.gitignore` was ignored too). Refined to `apps/mobile/android/keystores/*` + `!apps/mobile/android/keystores/.gitignore` so the directory marker is tracked while every keystore file remains ignored. Defense-in-depth alongside the in-dir `.gitignore` (which independently excludes everything via `*` + re-includes itself).
- **Removed string mentions of `compatRecon` / `iosAppStore` from `build.gradle`** to satisfy the acceptance criterion `grep -c "compatRecon|iosAppStore" -eq 0`. Replacement comment preserves intent ("Two flavors only. DIST-07 ... rescinded ... iOS distribution is an Xcode scheme target, not an Android product flavor; Phase 7 wires that separately"). The DIST-07 rescinded marker remains in PLAN.md frontmatter `requirements:` as the canonical record for the coverage gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root `.gitignore` blanket-ignored the entire keystores directory; the in-dir `.gitignore` would have been ignored too**

- **Found during:** Task 1 (`git check-ignore -v apps/mobile/android/keystores/.gitignore` showed the file matched the root `.gitignore` line `apps/mobile/android/keystores/`).
- **Issue:** The plan's acceptance criterion required `apps/mobile/android/keystores/.gitignore` to exist in the repo so the directory exists. The blanket root-level ignore would have prevented even the local `.gitignore` placeholder from being tracked, so the directory wouldn't appear after a fresh clone.
- **Fix:** Refined the root `.gitignore` rule from `apps/mobile/android/keystores/` to `apps/mobile/android/keystores/*` + `!apps/mobile/android/keystores/.gitignore`. The negation re-includes the directory marker while still excluding every other file (real keystores). Defense-in-depth alongside the in-dir `.gitignore` (which independently does the same via `*` + `!.gitignore`).
- **Files modified:** `.gitignore` (root).
- **Committed in:** `79809ab` (Task 1 commit).

**2. [Rule 1 - Bug] Comment in base `AndroidManifest.xml` mentioned `REQUEST_INSTALL_PACKAGES` literally — failed `! grep -q "REQUEST_INSTALL_PACKAGES"` acceptance criterion**

- **Found during:** Task 1 acceptance-criteria run (`grep -c "REQUEST_INSTALL_PACKAGES" base.AndroidManifest.xml` returned 1, not 0).
- **Issue:** The plan body specified `<!-- Common permissions ONLY. NEVER add REQUEST_INSTALL_PACKAGES here. -->` as the leading comment. The acceptance criterion `! grep -q "REQUEST_INSTALL_PACKAGES" apps/mobile/android/app/src/main/AndroidManifest.xml` is a string match, not a `<uses-permission>` match — comments count.
- **Fix:** Rewrote the comment to describe the policy without using the permission's literal name: "NEVER add the in-app install-source permission here — Play Store auto-rejects APKs that declare it." Equivalent intent, satisfies the acceptance criterion.
- **Files modified:** `apps/mobile/android/app/src/main/AndroidManifest.xml`.
- **Committed in:** `79809ab` (Task 1 commit).

**3. [Rule 1 - Bug] Comments in `apps/mobile/android/app/build.gradle` mentioned `compatRecon` + `iosAppStore` literally — failed `[ $(grep -c "compatRecon|iosAppStore" build.gradle) -eq 0 ]` acceptance criterion**

- **Found during:** Task 1 acceptance-criteria run (`grep -cE "compatRecon|iosAppStore" build.gradle` returned 2, not 0).
- **Issue:** Same root cause as Deviation 2 — the acceptance criterion is a literal string match, including comments. The plan body's leading comment "Note: NO compatRecon flavor. DIST-07 rescinded per CONTEXT.md D-DIST-01. Note: iosAppStore is NOT an Android product flavor — Phase 7 wires Xcode schemes for iOS." carried both forbidden tokens.
- **Fix:** Replaced the comment with "Two flavors only. DIST-07 (third-flavor recon build) is rescinded per CONTEXT.md D-DIST-01. iOS distribution is an Xcode scheme target, not an Android product flavor; Phase 7 wires that separately." Preserves all the same intent without literal-match strings.
- **Files modified:** `apps/mobile/android/app/build.gradle`.
- **Committed in:** `79809ab` (Task 1 commit).

**4. [Rule 1 - Bug] `apps/mobile/src/native/AppFlavor.ts` comment mentioned `compatRecon` literally — failed `! grep -q "compatRecon" AppFlavor.ts` acceptance criterion**

- **Found during:** Task 2 acceptance-criteria run.
- **Issue:** Same pattern as Deviations 2 + 3.
- **Fix:** Rewrote "compatRecon is rescinded per CONTEXT.md D-DIST-01" → "The third recon flavor is rescinded per CONTEXT.md D-DIST-01". Equivalent intent.
- **Files modified:** `apps/mobile/src/native/AppFlavor.ts`.
- **Committed in:** `5220af8` (Task 2 commit).

**5. [Rule 3 - Blocking] `tsconfig.json` `types: ["react-native"]` failed `tsc --noEmit` because `react-native` package is not yet installed (deferred to plan 13)**

- **Found during:** Task 3 (`pnpm typecheck` after wiring the typecheck script to `tsc --noEmit`).
- **Issue:** TS error TS2688 "Cannot find type definition file for 'react-native'." Plan 01-01 deliberately scaffolded `apps/mobile/package.json` as a deferred-to-plan-13 stub; no `node_modules`. Adding the real `react-native@0.83.x` install at this plan would pull ~30 transitive deps for a scaffold whose only TS surface is one `NativeModules` access.
- **Fix:** Two-part: (a) `apps/mobile/tsconfig.json` `types: []` (was `["react-native"]`) so TS doesn't search for the missing type root; (b) added `apps/mobile/src/types/react-native.d.ts`, a minimal ambient shim that declares only `export const NativeModules: Record<string, unknown>`. The shim's docstring documents that plan 13 will delete it once the real `react-native` package + bundled types are installed.
- **Files modified:** `apps/mobile/tsconfig.json`; **created:** `apps/mobile/src/types/react-native.d.ts`.
- **Verification:** `pnpm typecheck` exits 0 across all three workspace projects (apps/api, apps/mobile, shared/types).
- **Committed in:** `a2049bd` (Task 3 commit).

---

**Total deviations:** 5 auto-fixed (2 Rule 3 blocking — `.gitignore` rule prevented file tracking, `react-native` types not yet installed; 3 Rule 1 bugs — literal-string acceptance-criteria failures on comments containing forbidden tokens).
**Impact on plan:** No scope creep. All five were necessary to make the specified acceptance criteria green. Deviations 2/3/4 are documentation refinements (comments rewritten to convey the same intent without triggering literal-string greps); Deviation 1 is a single-line `.gitignore` refinement; Deviation 5 is the ambient-shim approach that defers the real RN install to plan 13 (matching the existing deferred-to-plan-13 stance set in plan 01-01).

## Authentication Gates

None — fully automated. No external service was contacted; the verify-merged-manifests.sh script was syntax-checked but not executed end-to-end (would require the Android SDK + Gradle wrapper, which lands in plan 13). The script is wired and ready; CI will exercise it on the first PR that touches `apps/mobile/android/`.

## Stub Tracking

- **`apps/mobile/src/types/react-native.d.ts`** — minimal NativeModules ambient declaration. Plan 13 deletes this file when the real `react-native` package is installed (its bundled types take over). Documented inline + in the Decisions Made section. Not a stub-that-prevents-feature-completion: the AppFlavor JS wrapper compiles cleanly; the only thing missing is the rest of the RN type surface (which Phase 1 doesn't use).
- **`apps/mobile/src/index.ts`** `bootInfo()` is a placeholder export; the real `AppRegistry.registerComponent('humyn-mobile', () => App)` wiring lands in plan 01-13. The function exists so tsc has source files to typecheck and so the AppFlavor wrapper has a guaranteed importer. Not a stub-that-prevents-feature-completion.
- **GOOGLE_WEB_CLIENT_ID empty in `.env.apkRollout` + `.env.playStore`** — CI fills this at build time per the @react-native-google-signin/google-signin Credential Manager flow. Plan 13 wires the Sign-In screen; until then, the empty placeholder is correct.
- **No real keystores in `apps/mobile/android/keystores/`** — by design (T-1.9-02 mitigation). CI provider injects decrypted keystores at build time per D-APK-03; offline cold backup outside the repo. Not a stub: the keystore directory is the contract; real keys arrive at build time, never in the repo.

No misleading "coming soon" copy or empty data flowing to UI surfaces. All scaffolded surfaces work as documented.

## Threat Flags

No new threat surfaces beyond those enumerated in `<threat_model>` (T-1.9-01..06). All six are mitigated:

- **T-1.9-01 (Future merge accidentally adds REQUEST_INSTALL_PACKAGES to BASE manifest):** Two-layer defense — (1) `verify-merged-manifests.sh` CI gate fails the build if `playStore` merged manifest contains the permission; (2) Task 1 acceptance criterion `! grep -q "REQUEST_INSTALL_PACKAGES" apps/mobile/android/app/src/main/AndroidManifest.xml` runs at code-review time. Either layer alone is sufficient.
- **T-1.9-02 (Keystore committed to repo):** Three-layer defense — (1) `apps/mobile/android/keystores/.gitignore` excludes everything via `*` + re-includes itself via `!.gitignore`; (2) refined root `.gitignore` (`apps/mobile/android/keystores/*` + `!apps/mobile/android/keystores/.gitignore`) does the same independently; (3) `.gitattributes` from plan 01-01 marks `*.{jks,keystore}` as binary so accidental commits show as binary diffs in PR reviews.
- **T-1.9-03 (Attacker rebuilds APK with different applicationId to bypass server allowlist):** Triple-gated by plan 05 (signing key + Play Integrity attestation + server-side `flavor-allowlist.ts`). This plan supplies the wire-side identity (`BuildConfig.FLAVOR_NAME` + `BuildConfig.APPLICATION_ID`) that the JWT carries; plan 05's allowlist is the cross-check.
- **T-1.9-04 (DIST-07 / compatRecon flavor accidentally re-introduced):** (1) PLAN.md `<truths>` line "Two flavors only — apkRollout, playStore. NOT three"; (2) Task 1 acceptance criterion `[ $(grep -c "compatRecon|iosAppStore" build.gradle) -eq 0 ]` enforces at PR-review time; (3) `requirements:` field carries `"DIST-07 [rescinded — see CONTEXT.md D-DIST-01]"` as a string-literal marker for the coverage gate, NOT as a build target.
- **T-1.9-05 (Build flavor metadata leaks into telemetry where users can spoof it):** Accepted. `BuildConfig.FLAVOR_NAME` is a compile-time constant baked into the APK by Gradle; attackers who modify the APK invalidate the signing-cert chain → Play Integrity rejects. Wire-side telemetry trusts the JWT-borne flavor (plan 05).
- **T-1.9-06 (versionCode regression — apkRollout APK with versionCode lower than installed → in-app upgrade flow refuses to install):** RESEARCH §4.4 versionCode shared from `${HUMYN_VERSION_CODE}` (CI's monotonically-increasing sequence) — this plan wires `versionCode (project.hasProperty('humynVersionCode') ? project.humynVersionCode.toInteger() : 1)` in `defaultConfig`. Phase 2 CI enforces `git tag` monotonicity; Phase 5 owns the in-app PackageInstaller flow that consumes the value.

## Issues Encountered

- **Root `.gitignore` rule needed refinement** (Deviation 1): blanket `apps/mobile/android/keystores/` would have prevented even the directory marker from being tracked.
- **Acceptance criteria treat comments as content** (Deviations 2/3/4): three rewrites needed to satisfy literal-string greps without losing comment intent.
- **`react-native` types deferred to plan 13** (Deviation 5): minimal ambient shim keeps Phase 1 typecheck self-contained; plan 13 deletes the shim once the real package is installed.
- **No Android SDK / Gradle wrapper in this scaffold** — verify-merged-manifests.sh was syntax-checked but not executed end-to-end. The wrapper + SDK install lands in plan 13.

## User Setup Required

None. The Android Gradle config is ready for plan 13 to layer the Gradle wrapper + RN application code on top. CI keystores arrive at build time via the env vars `PLAY_STORE_KEYSTORE_PATH` + `APK_ROLLOUT_KEYSTORE_PATH` (and matching password / alias / key_password vars). No external service configuration required for this plan.

## Next Phase Readiness

- **Ready for plan 01-13 (Sign-In screen).** The AppFlavor JS wrapper exposes `getFlavorContext()` returning `{ flavor, applicationId }` — plan 13's `/auth/google` POST body draws those fields directly. Plan 13 also installs the real `react-native@0.83.x` (deletes the ambient shim at `apps/mobile/src/types/react-native.d.ts`) and lands `MainActivity.kt`, `AppRegistry.registerComponent`, the Google Sign-In SDK init, and the actual UI (one logo image + one button + one "Welcome, {name}" text node per CONTEXT.md `<specifics>`).
- **Ready for Phase 7 (iOS).** The Kotlin AppFlavor module shape is the canonical contract; the Phase 7 Swift analogue mirrors `getConstants()` returning `flavor` + `applicationId`. The `Flavor` JS type union extends to `'iosAppStore'` at that point; the `AppApplicationId` union stays the same since iosAppStore mirrors playStore canonical (`ai.humynlabs.capture`) per D-FLAV-01.
- **Ready for CI integration.** `pnpm --filter @humyn/mobile verify-manifests` runs the manifest-merger gate; CI step lands in plan 01-10 (Terraform) or wherever the GitHub Actions workflow file is added. The script is executable, syntax-clean, and uses standard Gradle tasks.
- **No blockers** for any subsequent Phase 1 plan. The STATE.md blocker entry "Phase 1: APK build flavor `applicationId` choice — locked before flavor structure built" is now resolved (locked per D-FLAV-01).

## Self-Check: PASSED

All claims verified before writing this SUMMARY.

**Created files exist (verified via `test -f`):**

- `apps/mobile/android/build.gradle` — FOUND
- `apps/mobile/android/settings.gradle` — FOUND
- `apps/mobile/android/gradle.properties` — FOUND
- `apps/mobile/android/app/build.gradle` — FOUND
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — FOUND
- `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorModule.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/AppFlavorPackage.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` — FOUND
- `apps/mobile/android/keystores/.gitignore` — FOUND
- `apps/mobile/.env.apkRollout` — FOUND
- `apps/mobile/.env.playStore` — FOUND
- `apps/mobile/src/native/AppFlavor.ts` — FOUND
- `apps/mobile/src/index.ts` — FOUND
- `apps/mobile/src/types/react-native.d.ts` — FOUND
- `apps/mobile/scripts/verify-merged-manifests.sh` — FOUND (executable)

**Commits exist (verified via `git log --oneline -5`):**

- `79809ab` — Task 1 (feat: Android Gradle config + per-flavor manifests + keystores ignore)
- `5220af8` — Task 2 (feat: AppFlavor Kotlin module + JS wrapper + per-flavor .env files)
- `a2049bd` — Task 3 (feat: verify-merged-manifests CI gate + wire mobile typecheck)

**Live verification:**

- `pnpm typecheck` exits 0 across all three workspace TS projects.
- `bash -n apps/mobile/scripts/verify-merged-manifests.sh` returns clean (script syntax valid).
- `[ $(grep -c "REQUEST_INSTALL_PACKAGES" apps/mobile/android/app/src/main/AndroidManifest.xml) -eq 0 ]` — base manifest clean.
- `[ $(grep -c "REQUEST_INSTALL_PACKAGES" apps/mobile/android/app/src/apkRollout/AndroidManifest.xml) -eq 1 ]` — flavor manifest declares it.
- `[ $(grep -cE "compatRecon|iosAppStore" apps/mobile/android/app/build.gradle) -eq 0 ]` — no forbidden flavor mentions.
- `grep -E "Flavor =" apps/mobile/src/native/AppFlavor.ts` returns `export type Flavor = 'apkRollout' | 'playStore';` — type union exact.

---

_Phase: 01-foundation-backend-distribution-recon_
_Completed: 2026-05-07_
