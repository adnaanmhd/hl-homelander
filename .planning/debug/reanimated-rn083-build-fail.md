---
status: awaiting_human_verify
trigger: "Android build fails: `./gradlew installApkRolloutDebug` errors at `:react-native-reanimated:compileDebugJavaWithJavac` with 7 errors — `react-native-reanimated@3.16.7` Java sources reference RN APIs removed in `react-native@0.83.0`: `com.facebook.react.uimanager.UIManagerModuleListener` (cannot find symbol, ReanimatedModule.java:13,20), `Systrace.TRACE_TAG_REACT_JAVA_BRIDGE` (cannot find symbol, ReanimatedPackage.java:72,80), `UIManagerModule.addUIManagerListener(...)` (cannot find symbol, ReanimatedModule.java:83), an `@Override` that no longer overrides a supertype method (ReanimatedModule.java:107), and `LengthPercentage.resolve(int,int)` whose signature is now `resolve(float)` in RN 0.83's new-arch border-radius handling (BorderRadiiDrawableUtils.java:21). Reanimated 3.16.7's `android/src/reactNativeVersionPatch/` only ships variants `73`, `74`, `latest` — `latest` is selected for RN 0.83 but predates the new-architecture UIManager/Systrace/border-radius refactor. Blocks producing any APK, so the Phase-4 on-hardware smoke walk (04-MANUAL-SMOKE.md) cannot start. Fix candidates: (a) a `patch-package` patch backporting reanimated's RN-0.83 source migration onto 3.16.7; (b) bump reanimated to 4.x (touches a LOCKED CLAUDE.md pin + requires adding `react-native-worklets@0.8.x` + interacts with Skia frame-processor / worklets-core / VisionCamera). TS side unaffected — `npx vitest run` is 579/579 green, `tsc --noEmit` clean. Repro: `cd apps/mobile/android && ./gradlew installApkRolloutDebug`; full log at /tmp/gradle-install-apkrollout.log."
created: 2026-05-11T12:20:02Z
updated: 2026-05-11T12:23Z
---

## Current Focus

<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: "ROOT CAUSE CONFIRMED. The _entire_ react-native-reanimated 3.x line (3.16.7 through the latest 3.19.5) is incompatible with react-native 0.83.0 on Android. RN 0.83's bridgeless build removed the Paper-era APIs that reanimated 3.x's unconditional `main/` sourceSet still references: `com.facebook.react.uimanager.UIManagerModuleListener` (deleted), `UIManagerModule.addUIManagerListener(UIManagerModuleListener)` (deleted — only `addUIManagerEventListener(UIManagerListener)` remains), the Paper `ReanimatedUIManager extends UIManagerModule` class, `Systrace.TRACE_TAG_REACT_JAVA_BRIDGE` (`Systrace` is now `internal object` in Kotlin with only `TRACE_TAG_REACT`), and `LengthPercentage.resolve` (signature went `resolve(float,float)`→`resolve(float)`). There is NO `reactNativeVersionPatch` variant for this — the broken refs are in `main/`, not a swappable patch dir. The reanimated team's answer to RN ≥ 0.83 is reanimated 4.x, which is new-arch-only, declares `peerDependencies.react-native: \"0.81 - 0.85\"`, drops all those removed APIs, and adds a new peer dep `react-native-worklets@0.8.x` (the standalone package, distinct from the `react-native-worklets-core@1.6.3` that VisionCamera 4.7.3 uses for frame processors — the two can coexist). The CLAUDE.md note 'reanimated 4.x too new for the RN 0.83 ecosystem' is stale/inverted: 4.x IS the RN-0.83 line; 3.16.x is the wrong pin for RN 0.83."
test: "Whichever fix path is chosen, the success test is: `cd apps/mobile/android && ./gradlew :react-native-reanimated:compileDebugJavaWithJavac` succeeds, then `./gradlew installApkRolloutDebug` succeeds (Pixel 10a 5C161JEA304304), and `cd apps/mobile && npx vitest run && npx tsc --noEmit -p tsconfig.json` still pass. Reanimated is used in only 2 files (PracticeCompleteScreen.tsx, components/Confetti.tsx) and only via the core hooks `useSharedValue` / `useAnimatedStyle` / `withTiming` / `withSequence` / `Animated.View` — all API-stable across 3.x→4.x, so a 4.x bump is API-transparent to app code; the only ripple is native (add `react-native-worklets`, re-run `npm ci`, regenerate codegen, re-pod-install is N/A on Android)."
expecting: "Recommended path: bump react-native-reanimated to 4.x (latest 4.3.1) + add react-native-worklets@0.8.x, keep react-native-worklets-core@1.6.3 for VisionCamera, update CLAUDE.md's LOCKED pin + 'Do NOT Use' note + Version Compatibility Pinpoints. This touches a LOCKED constraint and the cross-cutting worklets/VisionCamera/Skia stack, so it needs an explicit human decision — surfaced as a checkpoint. Fallback (NOT recommended): a large patch-package patch backporting reanimated's RN-0.83 migration onto 3.16.7 — rewrites `ReanimatedModule.java`, `layoutReanimation/ReanimatedUIManager.java`, `ReanimatedPackage.java`, `BorderRadiiDrawableUtils.java`; fragile, unmaintained, and fights upstream."
next_action: "FIX APPLIED (user chose the reanimated-4.x bump, 2026-05-11). Verified: `./gradlew installApkRolloutDebug` BUILD SUCCESSFUL — reanimated 4.3.1 + react-native-worklets 0.8.3 both compile clean against RN 0.83; APK installed on Pixel 10a; vitest 579/579 + tsc clean. Commits 57ed029 (reanimated bump) and d97637a (a follow-on app-side bug the lifted build wall uncovered: HumynHandDetectorModule.kt imported HandLandmarkerOptions as top-level; it's nested in HandLandmarker in tasks-vision 0.10.21). Awaiting user confirmation to move this file to .planning/debug/resolved/. NOTE: a SEPARATE pre-existing runtime crash now surfaces on app launch — `Unable to get provider FirebaseInitProvider` → 'The Crashlytics build ID is missing — the Crashlytics Gradle plugin is missing from your app's build configuration' (the `com.google.firebase.crashlytics` Gradle plugin + `firebase-crashlytics-gradle` classpath are not applied in android/build.gradle + android/app/build.gradle, even though `@react-native-firebase/crashlytics@24.0.0` is installed). That is OUT OF SCOPE for this session — track it separately."
reasoning_checkpoint: null
tdd_checkpoint: null

## Symptoms

<!-- Written during gathering, then immutable -->

expected: "`cd apps/mobile/android && ./gradlew installApkRolloutDebug` builds and installs a debug APK of the apkRollout flavor on the connected Pixel 10a, containing the latest TS bundle (incl. the Phase-4 gap-closure changes 04-11/04-12)."
actual: "Build FAILS at task `:react-native-reanimated:compileDebugJavaWithJavac` — `Compilation failed; see the compiler output below. 7 errors`. No APK produced; the device still has the stale `0.1.0-apk` from 2026-05-11 09:22."
errors: |
:react-native-reanimated:compileDebugJavaWithJavac FAILED — 7 errors:

- ReanimatedModule.java:13 — cannot find symbol: class `com.facebook.react.uimanager.UIManagerModuleListener`
- ReanimatedModule.java:20 — cannot find symbol: class `UIManagerModuleListener` (implements clause)
- ReanimatedPackage.java:72 — cannot find symbol: variable `Systrace.TRACE_TAG_REACT_JAVA_BRIDGE`
- ReanimatedPackage.java:80 — cannot find symbol: variable `Systrace.TRACE_TAG_REACT_JAVA_BRIDGE`
- ReanimatedModule.java:83 — cannot find symbol: method `addUIManagerListener(ReanimatedModule)` on `UIManagerModule`
- ReanimatedModule.java:107 — `@Override` does not override or implement a method from a supertype
- BorderRadiiDrawableUtils.java:21 — method `resolve` in `LengthPercentage` cannot be applied: required `float`, found `int,int` (signature changed to `resolve(float)` in RN 0.83)
  (all files under apps/mobile/node_modules/react-native-reanimated/android/src/ — `reactNativeVersionPatch/.../latest/` + `main/`)
  reproduction: "`cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew installApkRolloutDebug` (Gradle 8.13, JDK 17 Zulu/Temurin, node_modules present in both repo root and apps/mobile/). Full log: /tmp/gradle-install-apkrollout.log (error block at lines ~480-565)."
  started: "Pre-existing — the Android Kotlin/Gradle/Robolectric toolchain has been non-functional in this dev env throughout Phase 4; documented in 04-10-SUMMARY.md and 04-VERIFICATION.md as the `reanimated × RN-0.83` wall. First surfaced when on-device validation was attempted; never produced a working Android build of any Phase-4 wave."

## Eliminated

<!-- APPEND only - prevents re-investigating after /clear -->

- timestamp: 2026-05-11T12:23Z
  candidate: "Add a small `reactNativeVersionPatch/.../83` (or `latest`) variant to reanimated 3.16.7 via patch-package — keeps the LOCKED 3.16.x pin cheaply."
  why_eliminated: "Not viable as a _small_ shim. The broken references are NOT confined to swappable `reactNativeVersionPatch/` dirs — `main/java/com/swmansion/reanimated/ReanimatedModule.java` (implements the deleted `UIManagerModuleListener`, calls the deleted `UIManagerModule.addUIManagerListener`), `main/.../layoutReanimation/ReanimatedUIManager.java` (`extends UIManagerModule`, a Paper class), and `main/.../ReanimatedPackage.java` (`Systrace.TRACE_TAG_REACT_JAVA_BRIDGE`) are all in the unconditional `main/` sourceSet. Verified the same breakage exists in reanimated 3.19.5 (latest 3.x) — `main/ReanimatedModule.java` still imports `UIManagerModuleListener` and calls `addUIManagerListener` (3.19.5's `ReanimatedPackage.java` did move off `Systrace` to `Trace.beginSection`, but the UIManager refs remain). A patch-package fix would mean manually backporting reanimated's entire RN-0.83 source migration — large, fragile, fights upstream, and the upstream answer is 'use reanimated 4'. Still technically possible as a last resort but not the recommended path.

- timestamp: 2026-05-11T12:23Z
  candidate: "Bump to a newer reanimated 3.x (e.g. 3.19.5) — stays inside the 3.16.x→3.x family, smaller jump than 4.x."
  why_eliminated: "reanimated 3.19.5's `android/build.gradle` sets `minimalReactNativeVersion = 78` (aspirational), but its `main/` Java still references `UIManagerModuleListener` + `UIManagerModule.addUIManagerListener` — both deleted in RN 0.83. So 3.19.5 fails the same compile. No 3.x release is buildable against RN 0.83. (Reanimated's official compat table for the 3.x line tops out below 0.83.)"

## Evidence

<!-- APPEND only - facts discovered during investigation -->

- timestamp: 2026-05-11T12:20Z
  checked: apps/mobile/node_modules/react-native-reanimated/android/src/reactNativeVersionPatch/ReanimatedUIManager/ directory listing + apps/mobile/node_modules/react-native-reanimated/package.json version
  found: only `73`, `74`, `latest` subdirs exist; installed reanimated version is `3.16.7` (package.json pins `~3.16.7`). RN is `0.83.0`. Reanimated picks `latest` for RN ≥ a threshold below 0.83, and that `latest` shim references pre-new-arch UIManager APIs.
  implication: reanimated 3.16.7 simply has no RN-0.83-aware patch variant; this is a version-compat gap, not a project-code bug.

- timestamp: 2026-05-11T12:20Z
  checked: apps/mobile/package.json scripts + devDependencies
  found: no `patch-package` dependency and no `postinstall` script — so if patch-package is the chosen path it must be added (dep + `postinstall: "patch-package"` + a `patches/react-native-reanimated+3.16.7.patch`).
  implication: patch-package fix requires wiring patch-package into the project first.

- timestamp: 2026-05-11T12:20Z
  checked: `npx vitest run` (apps/mobile) and `npx tsc --noEmit -p tsconfig.json` (apps/mobile) — re-run during Phase-4 gap-closure verification
  found: 579/579 vitest pass; tsc exit 0, clean.
  implication: the JS/TS layer is healthy; the failure is isolated to the Android Java compile of the reanimated module.

- timestamp: 2026-05-11T12:23Z
  checked: apps/mobile/node_modules/react-native-reanimated/android/build.gradle sourceSets logic (lines ~347-416) + the actual `latest`/`main` Java files (ReanimatedModule.java, layoutReanimation/ReanimatedUIManager.java, BorderRadiiDrawableUtils.java, ReanimatedPackage.java)
  found: For RN 0.83 (`REACT_NATIVE_MINOR_VERSION = 83`) reanimated 3.16.7 selects the `latest` variant for every `reactNativeVersionPatch/*` entry. `latest/.../ReanimatedModule.java` `implements ... UIManagerModuleListener` (import line 13, implements clause line 20), calls `uiManager.addUIManagerListener(this)` in `initialize()` (line 83), and has `@Override public void willDispatchViewUpdates(final UIManagerModule uiManager)` (line ~107) — all Paper APIs. `latest/.../ReanimatedUIManager.java` is `public class ReanimatedUIManager extends UIManagerModule` (Paper). `latest/.../BorderRadiiDrawableUtils.java` calls `length.resolve(bounds.width(), bounds.height())` — two `int` args. `main/.../ReanimatedPackage.java` uses `Systrace.beginSection(Systrace.TRACE_TAG_REACT_JAVA_BRIDGE, …)` / `Systrace.endSection(...)`.
  implication: confirms the 7 compile errors map exactly to RN-0.83-removed Paper APIs.

- timestamp: 2026-05-11T12:23Z
  checked: react-native 0.83.0 source — node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/UIManagerModule.java + com/facebook/systrace/Systrace.kt + com/facebook/react/uimanager/LengthPercentage.kt; `grep -rln UIManagerModuleListener node_modules/react-native/`
  found: `UIManagerModuleListener` interface — not present anywhere in RN 0.83. `UIManagerModule` has `addUIManagerEventListener(UIManagerListener)` / `removeUIManagerEventListener(...)` (Fabric-style) but NO `addUIManagerListener(...)` (Paper). `Systrace` is `internal object Systrace` (Kotlin) exposing only `const val TRACE_TAG_REACT: Long = 0L` — no `TRACE_TAG_REACT_JAVA_BRIDGE`, and `internal` means it is invisible to Java callers outside the module. `LengthPercentage.resolve` signature is `public fun resolve(referenceLength: Float): Float` — one arg.
  implication: every one of the 7 errors is a genuine RN-0.83 API removal/change. reanimated 3.16.7's Android sources predate the bridgeless cleanup.

- timestamp: 2026-05-11T12:23Z
  checked: `npm view react-native-reanimated dist-tags` + npm-packed react-native-reanimated@3.19.5 (latest 3.x) — package/package.json, android/build.gradle, main/ Java sources
  found: dist-tags: `reanimated-3` → 3.19.5, `latest` → 4.3.1. reanimated 3.19.5 still ships `main/java/com/swmansion/reanimated/ReanimatedModule.java` importing `com.facebook.react.uimanager.UIManagerModuleListener` (line 13), `implements LifecycleEventListener, UIManagerModuleListener, UIManagerListener` (line 21), `uiManager.addUIManagerListener(this)` (line 95), plus `main/.../layoutReanimation/ReanimatedUIManager.java` `extends UIManagerModule`. Its `android/build.gradle` `assertMinimalReactNativeVersion` sets `minimalReactNativeVersion = 78` (so it would not _refuse_ RN 0.83, but it would not _compile_ either). 3.19.5's `ReanimatedPackage.java` did move `Systrace.beginSection(...)` → `Trace.beginSection("createUIManagerModule")` — only that one error class is fixed in the newer 3.x.
  implication: no react-native-reanimated 3.x release (incl. the latest) compiles against RN 0.83. A 3.x bump does not fix this.

- timestamp: 2026-05-11T12:23Z
  checked: npm-packed react-native-reanimated@4.3.1 — package/package.json (peerDependencies), android/build.gradle, and `grep -rln 'UIManagerModuleListener|TRACE_TAG_REACT_JAVA_BRIDGE|addUIManagerListener' android/src/`
  found: reanimated 4.3.1 `peerDependencies`: `{ react: "*", "react-native": "0.81 - 0.85", "react-native-worklets": "0.8.x" }` — RN 0.83 explicitly in range; introduces a NEW peer dep `react-native-worklets@0.8.x` (the standalone package — NOT `react-native-worklets-core`). New-architecture only (old-arch tasks gated `onlyIf { !IS_NEW_ARCHITECTURE_ENABLED }`). None of the RN-0.83-removed APIs (`UIManagerModuleListener`, `TRACE_TAG_REACT_JAVA_BRIDGE`, `addUIManagerListener`) are referenced anywhere in 4.3.1's `android/src/`. Internal: `"react-native-worklets": "0.8.1"`.
  implication: reanimated 4.x IS the RN-0.83-compatible line. The CLAUDE.md note "reanimated 4.x too new for the RN 0.83 ecosystem" is stale/inverted. A 4.x bump is the clean fix but requires (1) adding `react-native-worklets@0.8.x` as a dep, (2) keeping `react-native-worklets-core@1.6.3` for VisionCamera 4.7.3 frame processors (the two worklets packages coexist), (3) updating the LOCKED CLAUDE.md pin + "Do NOT Use" note + Version Compatibility Pinpoints, (4) `npm ci` in apps/mobile + codegen regen.

- timestamp: 2026-05-11T12:23Z
  checked: `grep -rln react-native-reanimated apps/mobile/src/` + the two hit files (PracticeCompleteScreen.tsx, components/Confetti.tsx) + `grep -rn 'useFrameProcessor|worklets-core' apps/mobile/src/`
  found: reanimated is imported in exactly 2 files, both for animations only — `import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated'` (PracticeCompleteScreen: badge pop) and `import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'` (Confetti: 18 particles). No app code uses `react-native-worklets-core` directly; no app code uses VisionCamera frame processors (VisionCamera is `takePhoto()`-only per the capture constraint — CompatRing.tsx note "Reanimated worklets are pulled by VisionCamera in Phase 4" refers only to the transitive peer-dep graph, not actual usage).
  implication: the reanimated API surface this codebase relies on (`useSharedValue` / `useAnimatedStyle` / `withTiming` / `withSequence` / `Animated.View`) is stable across 3.x→4.x — a 4.x bump is API-transparent to app code (no JS source changes; the only changes are package.json + native rebuild + CLAUDE.md). Vitest already mocks reanimated to identity functions under jsdom, so the test suite is unaffected.

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: "react-native-reanimated 3.16.7 (and the entire 3.x line, through 3.19.5) is incompatible with react-native 0.83.0 on Android: RN 0.83's bridgeless build deleted the Paper-era APIs that reanimated 3.x's unconditional `main/` sourceSet still references — `com.facebook.react.uimanager.UIManagerModuleListener`, `UIManagerModule.addUIManagerListener(...)`, `ReanimatedUIManager extends UIManagerModule`, `Systrace.TRACE_TAG_REACT_JAVA_BRIDGE` (Systrace is now `internal`), and the `LengthPercentage.resolve` arity change. There is no `reactNativeVersionPatch` variant that fixes this because the broken refs live in `main/`, not a swappable patch dir. reanimated 4.x is the RN-0.83-compatible line (peerDep `react-native: \"0.81 - 0.85\"`, new-arch only, drops all the removed APIs) — but it adds a new peer dep `react-native-worklets@0.8.x` and bumping it touches a LOCKED CLAUDE.md pin + the worklets-core/VisionCamera/Skia stack."
fix: "APPLIED 2026-05-11 (user chose the reanimated-4.x bump). (1) apps/mobile/package.json: react-native-reanimated ~3.16.7 → ~4.3.1, add react-native-worklets ~0.8.3, keep react-native-worklets-core 1.6.3 (VisionCamera 4.7.3); (2) apps/mobile/babel.config.js: append `react-native-worklets/plugin` as the last plugin (replaces the old react-native-reanimated/plugin); (3) CLAUDE.md: updated the LOCKED pin (reanimated@4.x + worklets@0.8.x) + Version Compatibility Pinpoints; (4) `npm install` in apps/mobile (lockfile updated). Follow-on app-side bug the lifted build wall exposed at `:app:compileApkRolloutDebugKotlin`: HumynHandDetectorModule.kt imported `HandLandmarkerOptions` as a top-level class — it is nested in `HandLandmarker` in tasks-vision 0.10.21 — fixed the import. Commits: 57ed029 (reanimated bump + babel + CLAUDE.md), d97637a (HandLandmarkerOptions import)."
verification: "PASSED (build/compile/test level): `cd apps/mobile/android && ./gradlew installApkRolloutDebug` → BUILD SUCCESSFUL in 5m24s; `:react-native-reanimated:compileDebugJavaWithJavac` + `:react-native-worklets:compileDebugJavaWithJavac` both compile clean against RN 0.83; APK installed on Pixel 10a 5C161JEA304304 (lastUpdateTime 2026-05-11 18:05:36); `cd apps/mobile && npx vitest run` → 579/579; `npx tsc --noEmit -p tsconfig.json` → exit 0. Runtime smoke (launching the practice-complete screen to confirm the reanimated animations work) is BLOCKED by a SEPARATE, out-of-scope pre-existing crash: app crashes on launch with `Unable to get provider com.google.firebase.provider.FirebaseInitProvider` → `The Crashlytics build ID is missing — the Crashlytics Gradle plugin is missing from your app's build configuration` (the `com.google.firebase.crashlytics` Gradle plugin + `com.google.firebase:firebase-crashlytics-gradle` classpath are not applied in android/build.gradle / android/app/build.gradle, even though `@react-native-firebase/crashlytics@24.0.0` is a dep). That crash is unrelated to reanimated and must be tracked separately."
files_changed:

- apps/mobile/package.json
- apps/mobile/package-lock.json
- apps/mobile/babel.config.js
- CLAUDE.md
- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/handdetector/HumynHandDetectorModule.kt
