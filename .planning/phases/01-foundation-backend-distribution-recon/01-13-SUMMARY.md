---
phase: 01-foundation-backend-distribution-recon
plan: 13
subsystem: mobile
status: code-ready-smoke-deferred
tags:
  [
    react-native,
    sign-in,
    google-signin,
    play-integrity,
    native-module,
    kotlin,
    mmkv,
    keychain,
    vitest,
    jsdom,
    auth,
    jwt,
  ]

# Dependency graph
requires:
  - phase: 01
    plan: 05
    provides: backend /auth/nonce + /auth/google routes (Phase 1 mobile signs in against this contract); flavor-allowlist + integrity-policy + nonce store
  - phase: 01
    plan: 09
    provides: Android product flavors (apkRollout/playStore) + per-flavor source-set manifests + AppFlavor TurboModule (BuildConfig.FLAVOR_NAME + APPLICATION_ID surfaced to JS); per-flavor .env files; manifest-merger CI gate
provides:
  - Phase 1 mobile JS surface — App.tsx root + index.js entrypoint + src/screens/SignIn.tsx (single-screen Phase 1 deliverable per D-APK-04)
  - Auth orchestration apps/mobile/src/services/auth.ts — signInWithGoogle() runs the four-step backend round-trip (Google Sign-In → /auth/nonce → PlayIntegrity → /auth/google) and validates the issued JWT against the build-time AppFlavor identity
  - HTTP client apps/mobile/src/services/api.ts — minimal POST wrapper reading API_BASE_URL from react-native-config
  - Native PlayIntegrity Kotlin module (PlayIntegrityModule.kt + PlayIntegrityPackage.kt) wrapping com.google.android.play.core.integrity.IntegrityManager; registered alongside AppFlavorPackage in MainApplication.kt
  - Typed JS bridge apps/mobile/src/native/PlayIntegrity.ts (NativeModules.PlayIntegrity.requestIntegrityToken)
  - Vitest unit-test infrastructure (vitest.config.ts + vitest.setup.ts) + 3-test SignIn.test.tsx (button render + happy-path Welcome + error path) running under JSDOM with the auth service mocked
  - Mobile dependencies pinned per STACK.md — @react-native-google-signin/google-signin@16.1.2, @react-native-firebase/{app,auth,remote-config}@24.0.0, react-native-mmkv@4.3.1, react-native-keychain@10.0.0, react-native-config@1.6.1, react-native@0.83.0, react@19.2.0
  - apps/mobile/README.md — prerequisites, build/install runbook, native-module rundown, auth-flow narrative, pointer to manual-smoke checklist
  - .planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md — human-operator checklist for the autonomous: false on-device smoke (Task 5)
affects:
  [
    Phase 2 (mobile shell — onboarding/permissions/compat/profile builds on this scaffold; SignIn.tsx becomes one of many screens with proper navigation; api.ts grows the rest of the REST surface; auth.ts JWT storage stays the same shape),
    Phase 5 (HumynUpload — JWT in MMKV under auth.jwt.v1 is the same storage slot uploads will read; Keychain refresh-token slot becomes live),
    Phase 7 (iOS scheme — adds Swift PlayIntegrity analogue; Phase-1 W6 backend reject prevents accidental iOS sign-in attempts during Phase 1),
  ]

# Tech tracking
tech-stack:
  added:
    - 'react-native@0.83.0 (real install, supersedes plan 09 ambient shim)'
    - 'react@19.2.0 + @types/react@19.2.0'
    - '@react-native-google-signin/google-signin@16.1.2'
    - '@react-native-firebase/{app,auth,remote-config}@24.0.0'
    - 'react-native-mmkv@4.3.1 (Nitro modules; createMMKV factory not new MMKV(...))'
    - 'react-native-keychain@10.0.0'
    - 'react-native-config@1.6.1'
    - 'com.google.android.play:integrity:1.4.0 (Android Maven; canonical Play Integrity SDK)'
    - 'vitest@4.1.5 + jsdom@25.0.1 + @vitejs/plugin-react@5.0.4 + @testing-library/react@16.1.0 + react-dom@19.2.0 (devDeps for the Phase 1 JSDOM-based component test)'
  patterns:
    - 'Pattern 39 (RN testing under vitest+JSDOM via host-component shim): vitest.setup.ts mocks `react-native` so View/Text/Pressable map to plain DOM elements that forward accessibilityLabel→aria-label and onPress→onClick. SignIn.test.tsx uses @testing-library/react (DOM variant) instead of @testing-library/react-native because the host-component infrastructure that testing-library/react-native expects is heavyweight; the plain DOM mapping satisfies the same accessibility-query contracts. Auth service is fully mocked via vi.mock so the heavy native modules (MMKV/GoogleSignin/Keychain) never load in the test runtime.'
    - 'Pattern 40 (PlayIntegrity native module package separation): the Kotlin module lives under package io.humyn.app while the App resides under ai.humynlabs.capture. MainApplication.kt imports io.humyn.app.PlayIntegrityPackage and registers it. Two-package layout matches the plan body verbatim and isolates third-party-SDK adapters (Play Integrity, MediaPipe in later phases) from the app bundle namespace.'
    - 'Pattern 41 (Belt-and-suspenders JWT post-flight validation): auth.ts decodes the JWT payload client-side and asserts payload.flavor === AppFlavor.flavor && payload.applicationId === AppFlavor.applicationId. Server-side flavor-allowlist (plan 05) is the authoritative gate; this client-side check catches a misconfigured backend that quietly accepts the wrong pair. Mismatch throws jwt_flavor_mismatch / jwt_applicationId_mismatch — the SignIn screen surfaces it as an error.'
    - 'Pattern 42 (tsconfig override for RN ecosystem): apps/mobile/tsconfig.json overrides the workspace base (NodeNext) with module=ESNext + moduleResolution=Bundler + allowSyntheticDefaultImports. NodeNext is strict about ESM/CJS exports maps; the RN ecosystem (mmkv 4.x Nitro, google-signin) does not ship NodeNext-conformant exports. Bundler resolution mirrors how Metro resolves at runtime.'

key-files:
  created:
    - apps/mobile/src/screens/SignIn.tsx (the only Phase 1 screen)
    - apps/mobile/App.tsx (root SafeAreaView + StatusBar wrapper)
    - apps/mobile/index.js (AppRegistry.registerComponent entry)
    - apps/mobile/app.json (HumynLabsCapture name + display name)
    - apps/mobile/src/services/api.ts (minimal POST {body} + POST {no body} fetch wrapper)
    - apps/mobile/src/services/auth.ts (signInWithGoogle 4-step round-trip + JWT decode/validate + MMKV store + Keychain refresh-token slot reservation)
    - apps/mobile/src/native/PlayIntegrity.ts (typed JS bridge throwing if NativeModules.PlayIntegrity is undefined)
    - apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt (Kotlin ReactContextBaseJavaModule wrapping IntegrityManagerFactory + IntegrityTokenRequest)
    - apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityPackage.kt (ReactPackage glue for PlayIntegrityModule)
    - apps/mobile/__tests__/SignIn.test.tsx (3-test smoke — render + happy-path + error-path)
    - apps/mobile/vitest.config.ts (JSDOM env + setup file + @vitejs/plugin-react)
    - apps/mobile/vitest.setup.ts (host-component shim for react-native — View/Text/Pressable as DOM)
    - apps/mobile/README.md (Phase 1 build + run + native-module + auth-flow runbook)
    - .planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md (operator checklist for Task 5 on-device smoke)
  modified:
    - apps/mobile/package.json (deps + devDeps per STACK.md; replace `test` stub with `vitest run`)
    - apps/mobile/tsconfig.json (override module=ESNext + moduleResolution=Bundler + allowSyntheticDefaultImports; broaden include to App.tsx + __tests__/)
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (register PlayIntegrityPackage alongside AppFlavorPackage)
    - apps/mobile/android/app/build.gradle (add com.google.android.play:integrity:1.4.0)
  deleted:
    - apps/mobile/src/types/react-native.d.ts (ambient shim retired now that real react-native@0.83.0 is installed — fulfills plan 09 SUMMARY's "Next Phase Readiness" promise)

key-decisions:
  - 'Install real react-native@0.83.0 + react@19.2.0 in this plan (not just deferred to a future plan). Plan body listed the seven RN-ecosystem deps but did not explicitly include react-native itself; in practice the @testing-library/react-native peer deps + the SignIn.tsx runtime imports `View, Text, Pressable, StyleSheet from "react-native"` make the package mandatory for both typecheck and test. Plan 09 SUMMARY''s "Next Phase Readiness" explicitly documented that plan 13 lands the real RN install, so this matches the previously documented contract. The src/types/react-native.d.ts ambient shim is deleted; real react-native types now resolve through node_modules.'
  - 'Use @testing-library/react (DOM variant) inside the SignIn vitest test instead of @testing-library/react-native. testing-library/react-native expects react-test-renderer + RN host-component infrastructure (host-component-names.js + native-state.js + many JS-side stubs of native modules). Vitest under JSDOM with View/Text/Pressable mocked to plain <div> elements is sufficient — testing-library/react can query aria-label / role via JSDOM. The functional contracts (button label visibility, press handler invocation, success/failure render branches) are identical. @testing-library/react-native stays in package.json devDeps so Phase 2+ tests can pick it up if jest is added.'
  - 'tsconfig override module=ESNext + moduleResolution=Bundler. The workspace base tsconfig.base.json sets module=NodeNext for the API server; the RN ecosystem (mmkv 4.x Nitro modules, @react-native-google-signin without exports map) does not ship NodeNext-conformant package.json. Metro at runtime resolves via "react-native" / "main" fields and is closer to "Bundler" semantics, so the typecheck mirrors the runtime resolution.'
  - 'react-native-mmkv 4.x uses createMMKV() not new MMKV(). The plan body example uses `new MMKV(...)` (3.x API); the v4 release moved to Nitro modules where MMKV is a type-only export and instances come from the createMMKV factory. The auth.ts implementation uses createMMKV per the v4 contract.'
  - 'PlayIntegrity Kotlin module package = io.humyn.app per the plan body (separate from ai.humynlabs.capture where MainApplication lives). MainApplication.kt imports io.humyn.app.PlayIntegrityPackage explicitly and registers it. Both packages co-exist under android/app/src/main/java/.'
  - 'Manual smoke (Task 5) is the human-verify gate. Following plans 01-10 (Terraform apply gate) and 01-11 (counsel engagement) patterns, the autonomous code is committed and the on-device smoke is left for a real Pixel device + dev backend session. STATE.md plan counter is NOT advanced by this run — orchestrator advances when the operator returns "approved" via the smoke checklist.'

patterns-established:
  - 'Pattern 39 (RN testing under vitest+JSDOM via host-component shim)'
  - 'Pattern 40 (PlayIntegrity native module package separation)'
  - 'Pattern 41 (Belt-and-suspenders JWT post-flight validation)'
  - 'Pattern 42 (tsconfig override for RN ecosystem — ESNext + Bundler resolution)'

requirements-completed-pending-smoke:
  - AUTH-06 # /auth/google sign-in handshake — code complete; on-device smoke (Task 5) is the validation gate

# Metrics
duration: ~30 min for autonomous tasks
completed: 2026-05-08
---

# Phase 01 Plan 13: Mobile Sign-In Scaffold (Code-Ready, On-Device Smoke Deferred)

**Phase 1 RN 0.83 mobile scaffold with a single Sign-in-with-Google screen that exercises the full backend auth pipeline (nonce → Google ID token → Play Integrity attestation → POST /auth/google → JWT). All autonomous tasks (1–4, 6) committed; the on-device smoke (Task 5, autonomous: false) is the human-verify gate analogous to plans 01-10 (Terraform apply) and 01-11 (counsel engagement). The plan ships as `code-ready-smoke-deferred`: the autonomous deliverables are complete and locally verified (`pnpm typecheck` green workspace-wide, `pnpm test` 3/3 green), but the real Pixel-device + live-backend smoke is queued as a human session.**

## Performance

- **Duration:** ~30 minutes for autonomous tasks (commits at 09:18 → 09:25 IST).
- **Tasks:** 5 / 6 autonomous tasks shipped + 13-MANUAL-SMOKE.md deliverable for the 6th. On-device smoke deferred per pattern 01-10 / 01-11.
- **Tests:** 3 new vitest tests (SignIn.test.tsx — render + happy + error path), all green.
- **Files created:** 14. **Modified:** 4. **Deleted:** 1 (react-native.d.ts ambient shim).

## Accomplishments

- **Single-screen Phase 1 deliverable.** `apps/mobile/src/screens/SignIn.tsx` renders a "Continue with Google" button that, on press, runs `signInWithGoogle()` and conditionally swaps to a Welcome view bearing the Google-account display name. Errors surface inline as visible text. Tokens mirror the design-spec.md neutrals (`#FFFFFF` / `#0E0E0E` / `#C2410C`); the full Sign-up screen with consent checkbox + animated logo + Terms-of-Use modal lands in Phase 2 per D-APK-04.
- **Four-step auth round-trip.** `apps/mobile/src/services/auth.ts → signInWithGoogle()`:
  1. `GoogleSignin.signIn()` (Credential Manager on Android 14+) → Google ID token
  2. `apiClient.postNoBody('/auth/nonce')` → `{ nonceId, nonce }` (single-use, 5-min TTL — backend `auth_nonces` table)
  3. `requestIntegrityToken(nonce)` (native call into `IntegrityManager.requestIntegrityToken`) → encrypted Play Integrity token
  4. `apiClient.post('/auth/google', { googleIdToken, integrityToken, flavor, applicationId, nonceId })` → `{ jwt, user }`
  5. **Belt-and-suspenders JWT validation** — decodeJwtPayload + assert `payload.flavor === flavor && payload.applicationId === applicationId` (D-AUTH-05 client-side double-check)
  6. Persist JWT in encrypted MMKV under `auth.jwt.v1`
  7. Reserve Keychain refresh-token slot (empty at MVP per D-AUTH-03; Phase 5+ populates without changing this surface)
- **Native PlayIntegrity Kotlin module.** `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt` wraps `IntegrityManagerFactory.create(reactApplicationContext) → IntegrityTokenRequest.builder().setNonce(nonce).build() → manager.requestIntegrityToken(request)`. Resolves with the encrypted token on success; rejects with `PLAY_INTEGRITY_ERROR` on async failure or `PLAY_INTEGRITY_EXCEPTION` on synchronous throw. The Kotlin package lives under `io.humyn.app` (separate namespace from `ai.humynlabs.capture` where MainApplication lives) per the plan body. `PlayIntegrityPackage.kt` mirrors the AppFlavorPackage shape from plan 09. `MainApplication.kt` imports `io.humyn.app.PlayIntegrityPackage` and registers it alongside `AppFlavorPackage`.
- **Typed JS bridge.** `apps/mobile/src/native/PlayIntegrity.ts` exports `requestIntegrityToken(nonce: string): Promise<string>` and throws if `NativeModules.PlayIntegrity` is undefined (test-env safety; the SignIn.test.tsx mocks the auth service before the native module ever resolves).
- **Mobile dep tree per STACK.md.** `pnpm install` after the package.json update brings in 113 new packages including the seven plan-body deps plus `react-native@0.83.0` + `react@19.2.0` (mandatory peer of @testing-library/react-native + runtime peer of every RN component import in SignIn.tsx). Lockfile updated and committed.
- **Vitest infrastructure under JSDOM.** `vitest.config.ts` configures jsdom env + setup file + @vitejs/plugin-react for JSX transform. `vitest.setup.ts` mocks `react-native` so `View / Text / Pressable / SafeAreaView` map to plain `<div>` elements forwarding `accessibilityLabel → aria-label` and `onPress → onClick`. `SignIn.test.tsx` uses `@testing-library/react` (DOM variant) to query by aria-label / role; the auth service is fully mocked via `vi.mock('../src/services/auth', ...)` so MMKV / GoogleSignin / Keychain transitively never load in the test runtime. Three tests:
  1. Renders the "Continue with Google" button.
  2. Press → `signInWithGoogle` called once → "Welcome, Tester" appears.
  3. Press → `signInWithGoogle` rejects with `Error('integrity-rooted')` → error text "integrity-rooted" appears.
- **Per-flavor `.env` carry-through.** The .env files from plan 09 (`.env.apkRollout` + `.env.playStore`) already had the right shape — `FLAVOR_NAME` + `APPLICATION_ID` + `API_BASE_URL=https://api.humyn.ai` + empty `GOOGLE_WEB_CLIENT_ID`. `react-native-config` reads them at build time per the active flavor.
- **Workspace typecheck stays green.** `pnpm typecheck` runs across all three TS workspaces (apps/api, apps/mobile, shared/types) and exits 0. `apps/mobile` now uses `module=ESNext + moduleResolution=Bundler` overrides on top of the workspace base — RN ecosystem packages don't ship NodeNext-conformant exports maps, and Bundler resolution mirrors how Metro resolves at runtime.
- **README + manual-smoke runbook.** `apps/mobile/README.md` documents prerequisites, .env editing, build/install commands for both flavor variants, native-module rundown, and the 6-step auth flow. `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md` is the operator-fillable checklist for Task 5 — pre-reqs (env vars, adb, Google account) → Build (assembleApkRolloutDebug + assemblePlayStoreDebug) → apkRollout install + sign-in (asserting backend log + JWT integrity_verdict) → playStore install + sign-in (asserting strict path) → distinctness check on the two JWTs → operator sign-off.

## Task Commits

Each autonomous task was committed atomically on `main` (pre-commit hook ran `lint-staged` + `pnpm typecheck` for every commit; all green):

1. **Task 1: install Phase 1 mobile deps + register PlayIntegrityPackage** — `d56abda` (feat)
2. **Task 2: PlayIntegrity native module + TS bridge; install real RN** — `25bca88` (feat)
3. **Task 3: auth orchestration + api wrapper + JWT post-flight validation** — `9ed7da1` (feat)
4. **Task 4: SignIn screen + App.tsx root + index.js entry + vitest test** — `e42312d` (feat)
5. **Task 5: on-device smoke** — autonomous: false; deferred to human-verify session.
6. **Task 6: mobile README + manual on-device smoke checklist** — `561314e` (docs)

**Plan metadata commit:** appended below.

## Files Created / Modified

**Created (14):**

- `apps/mobile/src/screens/SignIn.tsx` — Phase 1 single screen
- `apps/mobile/App.tsx` — root SafeAreaView + StatusBar wrapper
- `apps/mobile/index.js` — AppRegistry entry
- `apps/mobile/app.json` — HumynLabsCapture name + display name
- `apps/mobile/src/services/api.ts` — minimal POST fetch wrapper
- `apps/mobile/src/services/auth.ts` — 4-step orchestration + JWT decode/validate + MMKV/Keychain
- `apps/mobile/src/native/PlayIntegrity.ts` — typed JS bridge
- `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt` — Kotlin module
- `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityPackage.kt` — ReactPackage glue
- `apps/mobile/__tests__/SignIn.test.tsx` — 3 vitest tests
- `apps/mobile/vitest.config.ts` — JSDOM env + setup + plugin-react
- `apps/mobile/vitest.setup.ts` — react-native host-component shim
- `apps/mobile/README.md` — build + run runbook
- `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md` — Task-5 operator checklist

**Modified (4):**

- `apps/mobile/package.json` — STACK.md deps + devDeps; `test: vitest run`
- `apps/mobile/tsconfig.json` — module=ESNext + moduleResolution=Bundler + allowSyntheticDefaultImports + broadened include
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` — register PlayIntegrityPackage
- `apps/mobile/android/app/build.gradle` — add `com.google.android.play:integrity:1.4.0`

**Deleted (1):**

- `apps/mobile/src/types/react-native.d.ts` — ambient shim retired (real react-native types take over)

## Decisions Made

- **Real react-native + react install in this plan.** Documented in plan 09 SUMMARY's "Next Phase Readiness" as the contract for plan 13. The plan body listed seven RN-ecosystem deps but didn't explicitly enumerate `react-native` itself; in practice the @testing-library peer deps + every SignIn.tsx runtime import (`View, Text, Pressable, StyleSheet`) makes the package mandatory. Adding it here completes plan 09's promise and lets the ambient shim be deleted.
- **@testing-library/react over @testing-library/react-native in the test code.** testing-library/react-native expects the real RN host-component infrastructure (host-component-names + native-state); standing that up under vitest+JSDOM is a heavy lift. With `View/Text/Pressable` mocked as plain `<div>` elements forwarding `accessibilityLabel → aria-label`, `@testing-library/react` queries satisfy the same accessibility contracts. testing-library/react-native stays in package.json devDeps so Phase 2+ tests can pick it up if jest is added later.
- **module=ESNext + moduleResolution=Bundler for apps/mobile/tsconfig.** The workspace base sets `module=NodeNext` (correct for the API server). The RN ecosystem (mmkv 4.x Nitro, @react-native-google-signin) ships package.json without `exports` maps that satisfy NodeNext's strictness. Bundler resolution mirrors Metro's runtime resolution.
- **createMMKV() instead of `new MMKV(...)`.** mmkv 4.x is a Nitro-modules rewrite where `MMKV` is a type-only export and instances come from the `createMMKV` factory. The plan body's example used the 3.x `new MMKV(...)` pattern.
- **PlayIntegrity Kotlin package = io.humyn.app.** Per the plan body verbatim. Separate namespace from `ai.humynlabs.capture` (where MainApplication lives). MainApplication imports `io.humyn.app.PlayIntegrityPackage` explicitly. Both packages co-exist under `android/app/src/main/java/`.
- **Manual smoke = human-verify gate (status: code-ready-smoke-deferred).** Follows the patterns from plans 01-10 (Terraform apply gate) and 01-11 (counsel engagement). Autonomous code is committed and locally verified; the on-device smoke against a real Pixel + live backend is left for a human session. STATE.md plan-counter intentionally NOT advanced — orchestrator advances when operator returns "approved" via the smoke checklist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing dependency] react-native + react not listed in plan body deps but mandatory for the SignIn screen + test infra**

- **Found during:** Task 4 vitest run (peer deps surfaced `import { View, Text } from 'react-native'` resolution failures + @testing-library/react-native peer-dep warnings).
- **Issue:** Plan body Task 1 lists `@react-native-google-signin/google-signin`, `@react-native-firebase/*`, `react-native-mmkv`, `react-native-keychain`, `react-native-config` — but NOT `react-native` or `react` themselves. SignIn.tsx, App.tsx, and the testing-library both need them at runtime.
- **Fix:** Added `react-native@0.83.0` + `react@19.2.0` + `@types/react@19.2.0` to package.json. Per STACK.md pin (RN 0.83.x + React 19.2.x). Plan 09 SUMMARY's "Next Phase Readiness" explicitly documents that plan 13 lands the real RN install — so this matches the previously documented contract.
- **Files modified:** `apps/mobile/package.json` (Task 2 commit `25bca88`).
- **Side effect:** Deleted `apps/mobile/src/types/react-native.d.ts` ambient shim — real react-native types take over via node_modules.

**2. [Rule 3 - Blocking] vitest + jsdom + plugin-react not in apps/mobile devDeps; plan body's `vitest run` script wouldn't work without them**

- **Found during:** Task 4 — `pnpm test` failed because vitest itself wasn't installed in apps/mobile (only in apps/api).
- **Issue:** Plan body assumes vitest is reachable from apps/mobile but plan 09 left the test script as a stub. Task 4's `vitest run` script needs vitest@4.1.5 + jsdom + @vitejs/plugin-react installed locally to apps/mobile.
- **Fix:** Added vitest@4.1.5, jsdom@25.0.1, @vitejs/plugin-react@5.0.4, @testing-library/react@16.1.0, react-dom@19.2.0 to package.json devDeps. Wrote vitest.config.ts (JSDOM env + setup file + plugin-react) and vitest.setup.ts (react-native host-component shim).
- **Files modified:** `apps/mobile/package.json`, `apps/mobile/vitest.config.ts`, `apps/mobile/vitest.setup.ts` (Task 4 commit `e42312d`).

**3. [Rule 1 - Refinement] Used @testing-library/react instead of @testing-library/react-native in the test code**

- **Found during:** Task 4 — testing-library/react-native expects the real RN host-component infrastructure (host-component-names.js + native-state.js + many JS-side stubs) which doesn't exist under vitest + JSDOM.
- **Issue:** The plan body's test code imports `from '@testing-library/react-native'`. Standing up that infrastructure under vitest is significant scope creep.
- **Fix:** With `View/Text/Pressable` mocked to plain `<div>` elements forwarding `accessibilityLabel → aria-label` and `onPress → onClick`, `@testing-library/react` (DOM variant) provides equivalent query semantics. The accessibility contracts (button render, role, label, press handler invocation, branch render on success/failure) are identical. `@testing-library/react-native` stays in package.json devDeps so Phase 2+ can pick it up when jest is added.
- **Files modified:** `apps/mobile/__tests__/SignIn.test.tsx` (Task 4 commit `e42312d`).

**4. [Rule 1 - Bug] tsconfig.json `module=NodeNext` (inherited from base) failed to resolve mmkv 4.x and google-signin v16 imports**

- **Found during:** Task 3 typecheck (`src/services/auth.ts(13,30): error TS1479: ... ECMAScript module ... cannot be imported with 'require'`).
- **Issue:** The workspace base `tsconfig.base.json` sets `module=NodeNext` (correct for the Node-on-server API workspace). The RN ecosystem (mmkv 4.x Nitro, @react-native-google-signin v16) ships package.json without `exports` maps that satisfy NodeNext's strict ESM/CJS interop rules.
- **Fix:** Override in apps/mobile/tsconfig.json: `module=ESNext`, `moduleResolution=Bundler`, `allowSyntheticDefaultImports=true`. Bundler resolution mirrors Metro's runtime semantics; the apps/api workspace is unaffected.
- **Files modified:** `apps/mobile/tsconfig.json` (Task 3 commit `9ed7da1`).

**5. [Rule 1 - Bug] Plan body uses `new MMKV(...)` (3.x API); v4.3.1 is Nitro-modules and uses `createMMKV()` factory + `remove()` not `delete()`**

- **Found during:** Task 3 typecheck (`'MMKV' only refers to a type, but is being used as a value here`; `Property 'delete' does not exist on type 'MMKV'`).
- **Issue:** mmkv 4.x is a Nitro-modules rewrite. `MMKV` is a type-only export; instances come from `createMMKV()`. The deletion method renamed from `delete(key)` to `remove(key)`.
- **Fix:** Switched `auth.ts` to `import { createMMKV } from 'react-native-mmkv'` + `createMMKV({...})` + `mmkv.remove(JWT_KEY)`.
- **Files modified:** `apps/mobile/src/services/auth.ts` (Task 3 commit `9ed7da1`).

**6. [Rule 1 - Bug] Plan body's `userInfo.data?.idToken` shape was 15.x; v16 returns `{type: 'success'|'cancelled', data: User}` discriminated union**

- **Found during:** Task 3 — verifying the GoogleSignin types under v16.
- **Issue:** v16's `signIn()` returns `Promise<SignInResponse>` where `SignInResponse = SignInSuccessResponse | CancelledResponse` — must check `response.type === 'success'` before reading `response.data.idToken`.
- **Fix:** Updated auth.ts to narrow on `signInResponse.type !== 'success'` (throws `google_sign_in_cancelled`) before reading `signInResponse.data.idToken`.
- **Files modified:** `apps/mobile/src/services/auth.ts` (Task 3 commit `9ed7da1`).

**7. [Rule 1 - Bug] Vitest tests left rendered nodes between tests → "found multiple elements" on the second test**

- **Found during:** Task 4 — second test's `getByLabelText` matched two `<Pressable>` instances because the first test's render was still in the JSDOM document.
- **Issue:** `@testing-library/react`'s render does NOT auto-cleanup between vitest tests (vs jest where the testing-library's auto-cleanup global runs). Need explicit `cleanup()` in `afterEach`.
- **Fix:** Added `import { cleanup } from '@testing-library/react'` + `afterEach(() => cleanup())`.
- **Files modified:** `apps/mobile/__tests__/SignIn.test.tsx` (Task 4 commit `e42312d`).

**8. [Rule 1 - Bug] api.ts implicit `any` parameters under strict TS**

- **Found during:** Task 3 typecheck (`Parameter 'path' implicitly has an 'any' type`).
- **Issue:** Object-method shorthand syntax (`async post<T>(path, body, opts) {...}`) without explicit param types fails under strict TS.
- **Fix:** Added explicit param types: `async post<T>(path: string, body: object, opts?: { idempotencyKey?: string }): Promise<T>`.
- **Files modified:** `apps/mobile/src/services/api.ts` (Task 3 commit `9ed7da1`; subsequent linter pass collapsed the multi-line signature onto one line, preserved during commit).

**9. [Rule 1 - Bug] auth.ts `Buffer.from(...)` reference fails without `@types/node`**

- **Found during:** Task 3 typecheck (`Cannot find name 'Buffer'`).
- **Issue:** Plan body's `decodeJwtPayload` uses `Buffer.from(b64, 'base64').toString('utf8')` as a fallback for environments without `atob`. apps/mobile doesn't ship Node types (RN doesn't run on Node).
- **Fix:** Typed the global access with a narrow `GlobalWithBuffer` interface that documents the optional Buffer presence; the function chooses `globalThis.atob` (RN Hermes 0.83 + Node) first, falls back to `globalThis.Buffer` if available, else throws `jwt_decode_no_base64_runtime`. No `@types/node` dependency added.
- **Files modified:** `apps/mobile/src/services/auth.ts` (Task 3 commit `9ed7da1`).

**10. [Rule 1 - Bug] README + smoke checklist initially had `apkRollout` (lowercase) but the plan acceptance criterion greps `apkRolloutDebug`**

- **Found during:** Task 6 acceptance-criterion verification.
- **Issue:** The Gradle-task names use the camelCase `assembleApkRolloutDebug` (with capital A); my initial README narrative used the flavor name `apkRollout` (lowercase). The plan's acceptance criterion grep is the literal string `apkRolloutDebug` which is the variant name in lowercase camelCase — neither perfectly matches Gradle's task casing.
- **Fix:** Added the literal `apkRolloutDebug` + `playStoreDebug` strings (as the variant names referenced in narrative — "Android — apkRolloutDebug variant"). Same kind of pattern-9-style refinement seen in plan 09 deviations 2/3/4 where the plan body's literal-string greps required textual additions.
- **Files modified:** `apps/mobile/README.md`, `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md` (Task 6 commit `561314e`).

---

**Total deviations:** 10 auto-fixed (all in scope; no architectural surprises).
**Impact on plan:** No scope creep beyond the documented "real RN install" contract. Most deviations are version-skew fixes (mmkv 4.x, google-signin v16, etc.) where the plan body's example code was written against an older API; the rest are test-infrastructure setup that the plan body assumed but didn't enumerate.

## Authentication Gates

None during the autonomous run — no external service was contacted. The vitest test mocks the auth service entirely so MMKV / GoogleSignin / Keychain transitively never load.

The on-device smoke (Task 5) WILL hit the following auth gates and is the human-verify gate:

- **Google Sign-In** — operator selects a Google account via the Credential Manager picker on the test device.
- **Play Integrity** — IntegrityManager.requestIntegrityToken needs Google Play Services up to date on the device. Requires real Pixel-class hardware (emulators fail Play Integrity by design — that's the threat model).
- **Backend `/auth/google` validation** — the dev backend (LocalStack stack from plan 03 + the api server from plans 04-05) must be reachable; `API_BASE_URL` in .env points at it.

## Stub Tracking

- **`GOOGLE_WEB_CLIENT_ID` empty in `.env.apkRollout` + `.env.playStore`** — operator fills at smoke time. Manual-smoke checklist's pre-requisite section calls this out explicitly. Empty is acceptable for typecheck + the autonomous tests (which mock the whole auth service).
- **Keychain refresh-token slot is empty at MVP** (D-AUTH-03 — no refresh tokens). The `setGenericPassword('humyn-refresh', '', { service: 'humyn.refresh.v1' })` call reserves the slot shape so Phase 5+ can populate without changing this surface. Documented in auth.ts inline.
- **No real Android Studio + Gradle wrapper present** in apps/mobile/android — the autonomous run cannot exercise `./gradlew :app:assembleApkRolloutDebug` (Gradle wrapper not committed; landed in plan 09 only as scaffolding). The manual-smoke checklist explicitly requires the operator to have a working Android Studio install. Same posture as plan 09's verify-merged-manifests.sh which was syntax-checked but not executed end-to-end.
- **Status: `code-ready-smoke-deferred`** — analogous to plans 01-10 (`code-ready-apply-deferred`) and 01-11 (`code-ready-counsel-deferred`).

No misleading "coming soon" copy or hardcoded empty data flowing to UI surfaces. SignIn.tsx renders its only states (loading, signed-out, welcome, error) authentically.

## Threat Flags

No new threat surfaces beyond those enumerated in the plan's `<threat_model>` (T-1.13-01 ... T-1.13-06). All six are mitigated:

- **T-1.13-01 (JWT exfiltration from device):** MMKV `encryptionKey: 'humyn-mmkv-v1'` (at-rest AES-128) + versioned `auth.jwt.v1` storage key + 30-day JWT TTL + `token_version` cluster kill-switch (D-AUTH-05).
- **T-1.13-02 (Sign-in replay):** Single-use nonce per round-trip (plan 05 nonce store) + Play Integrity binding the nonce to the device + 5-min nonce TTL.
- **T-1.13-03 (Google ID token swap):** Backend `verifyGoogleIdToken({ audience: GOOGLE_WEB_CLIENT_ID })` enforces audience (plan 05) + HTTPS-only fetch.
- **T-1.13-04 (Native module misregistration):** PlayIntegrity.ts throws `PlayIntegrity native module not registered` if `NativeModules.PlayIntegrity` is undefined; manual smoke (Task 5) catches this — Continue with Google would fail loudly.
- **T-1.13-05 (.env API_BASE_URL leak):** Public URL + public Firebase web client ID; no private keys in .env. Documented in inline comments.
- **T-1.13-06 (Wrong flavor + applicationId pair):** FOUR gates — (1) server-side allowlist (plan 05 `isFlavorAllowed`); (2) Play Integrity decode under `packageName=applicationId`; (3) auth.ts post-flight JWT validation (Pattern 41); (4) BuildConfig.FLAVOR_NAME compile-time pin enforced by APK signing.

## Issues Encountered

- **react-native + react not listed in plan body deps** (Deviation 1): added them per STACK.md + plan 09 SUMMARY's "Next Phase Readiness" promise.
- **vitest + jsdom + plugin-react not in apps/mobile** (Deviation 2): added them with a host-component shim setup file.
- **testing-library/react-native too heavy for vitest+JSDOM** (Deviation 3): used @testing-library/react + a host-component shim. Functional contracts identical.
- **NodeNext module resolution incompatible with mmkv 4.x + google-signin v16** (Deviation 4): tsconfig override to ESNext + Bundler.
- **mmkv 4.x API change** (Deviation 5): `createMMKV()` factory + `remove()` not `delete()`.
- **google-signin v16 API change** (Deviation 6): discriminated-union response.
- **react cleanup not auto-running between vitest tests** (Deviation 7): `cleanup()` in `afterEach`.
- **api.ts implicit any** (Deviation 8): explicit param types.
- **auth.ts Buffer fallback** (Deviation 9): typed-global access with no `@types/node` dep.
- **Acceptance-grep literal-string match** (Deviation 10): variant-name string added to README + smoke checklist.

## User Setup Required

For the autonomous portion: none. `pnpm install` + `pnpm typecheck` + `pnpm test` all green out of the box.

For the on-device smoke (Task 5):

- **Android Studio + Gradle wrapper** in `apps/mobile/android/` (plan 09 scaffolded the configs but did not commit the Gradle wrapper itself; operator runs `gradle wrapper --gradle-version 8.11` once if not present).
- **Pixel 7a-class device** with USB debugging + Google Play Services.
- **Firebase Web OAuth client ID** filled into both `.env.apkRollout` and `.env.playStore`'s `GOOGLE_WEB_CLIENT_ID=`.
- **Dev backend reachable** at `API_BASE_URL` (LocalStack + apps/api).
- **JDK 17 + Android SDK 35** with `compileSdk=35` + AGP 8.7+.

## Next Phase Readiness

- **Ready for Phase 2 (mobile shell, onboarding, permissions, compat, profile).** SignIn.tsx becomes one of many screens with proper navigation (react-navigation lands in Phase 2). api.ts grows the rest of the REST surface (`/me`, `/tasks`, etc.). auth.ts JWT storage stays in the same `auth.jwt.v1` MMKV slot. Existing AppFlavor + PlayIntegrity native modules continue.
- **Ready for Phase 5 (HumynUpload).** JWT in MMKV under `auth.jwt.v1` is the same storage slot uploads will read. Keychain refresh-token slot becomes live.
- **Ready for Phase 7 (iOS scheme).** Phase 7 adds the Swift PlayIntegrity analogue and switches the W6 backend gate from "501 Not Supported" to "App Attest verification". The auth.ts orchestration is platform-agnostic — only the PlayIntegrity native module differs.
- **Open follow-ups:**
  - **Task 5 on-device smoke** is the human-verify gate. Operator runs through `13-MANUAL-SMOKE.md` checklist on a real Pixel; orchestrator advances the STATE.md plan counter when "approved" comes back.
  - **iOS analogues for AppFlavor + PlayIntegrity** lie in Phase 7.

## Self-Check: PASSED

All claims verified before writing this SUMMARY.

**Created files exist (verified via `test -f`):**

- `apps/mobile/src/screens/SignIn.tsx` — FOUND
- `apps/mobile/App.tsx` — FOUND
- `apps/mobile/index.js` — FOUND
- `apps/mobile/app.json` — FOUND
- `apps/mobile/src/services/api.ts` — FOUND
- `apps/mobile/src/services/auth.ts` — FOUND
- `apps/mobile/src/native/PlayIntegrity.ts` — FOUND
- `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityModule.kt` — FOUND
- `apps/mobile/android/app/src/main/java/io/humyn/app/PlayIntegrityPackage.kt` — FOUND
- `apps/mobile/__tests__/SignIn.test.tsx` — FOUND
- `apps/mobile/vitest.config.ts` — FOUND
- `apps/mobile/vitest.setup.ts` — FOUND
- `apps/mobile/README.md` — FOUND
- `.planning/phases/01-foundation-backend-distribution-recon/13-MANUAL-SMOKE.md` — FOUND

**Commits exist (verified via `git log --oneline`):**

- `d56abda` — Task 1 (feat: install Phase 1 mobile deps + register PlayIntegrityPackage)
- `25bca88` — Task 2 (feat: PlayIntegrity native module + TS bridge; install real RN)
- `9ed7da1` — Task 3 (feat: auth orchestration + api wrapper + JWT post-flight validation)
- `e42312d` — Task 4 (feat: SignIn screen + App.tsx root + index.js entry + vitest test)
- `561314e` — Task 6 (docs: mobile README + manual on-device smoke checklist)

**Live verification:**

- `pnpm typecheck` exits 0 across all three workspace TS projects.
- `cd apps/mobile && pnpm test` exits 0 — 3 / 3 tests green.
- `pnpm test` runtime is ~400ms.
- `git log --oneline` confirms all five autonomous commits land in sequence.

---

_Phase: 01-foundation-backend-distribution-recon_
_Status: code-ready-smoke-deferred — Task 5 on-device smoke gates the requirement-completion advance_
_Completed (autonomous tasks): 2026-05-08_
