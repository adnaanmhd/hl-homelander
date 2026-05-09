---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 03
id: 02-03-state-store-and-hydration
name: Zustand app store, MMKV hydration, gate-decision tree, shared CompatResult schema
type: execute
wave: 1
depends_on: [02-02-test-scaffolding-and-deps]
files_modified:
  - apps/mobile/src/state/mmkv.ts
  - apps/mobile/src/state/keys.ts
  - apps/mobile/src/state/appStore.ts
  - apps/mobile/src/state/hydrate.ts
  - apps/mobile/src/state/initialRoute.ts
  - shared/types/src/CompatResult.ts
  - shared/types/src/index.ts
  - apps/mobile/__tests__/state/appStore.test.ts
  - apps/mobile/__tests__/state/hydrate.test.ts
  - apps/mobile/__tests__/state/initialRoute.test.ts
autonomous: true
requirements: [AUTH-07, AUTH-11, COMPAT-04, COMPAT-05, COMPAT-06]
must_haves:
  truths:
    - 'A single MMKV instance `humyn.secure` is shared across all services via a singleton module'
    - 'Versioned MMKV keys are declared as `const` strings in one place — no string literals scattered across services'
    - 'Zustand store hydrates from MMKV synchronously on App.tsx mount'
    - "initialRoute.ts implements the gate-decision tree from RESEARCH § 'Initial route gate-decision tree'"
    - 'shared/types exports a CompatResult Zod schema matching D-COMPAT-05 verbatim'
    - 'AUTH-11 is satisfied client-side: a stale `compatSignature` (different installation_id) routes the user to Compat re-run'
  artifacts:
    - path: 'apps/mobile/src/state/mmkv.ts'
      provides: 'Singleton humyn.secure MMKV instance'
      contains: 'createMMKV'
    - path: 'apps/mobile/src/state/keys.ts'
      provides: 'All MMKV key constants (auth.jwt.v1, onboarding.*.v1, installation_id.v1, compat.lastResult.v1, appVersion.cache.v1, telemetry.ring.v1)'
      contains: 'auth.jwt.v1'
    - path: 'apps/mobile/src/state/appStore.ts'
      provides: 'Zustand store with jwt, consent, perms, compat, tutorial, installationId, appVersionCache, softUpgrade fields + signOut, setCompatResult actions'
      contains: 'create<AppState>'
    - path: 'apps/mobile/src/state/hydrate.ts'
      provides: 'Sync MMKV→Zustand boot hydration'
      contains: 'useAppStore.setState'
    - path: 'apps/mobile/src/state/initialRoute.ts'
      provides: 'Gate-decision tree returning the initial RootStack route name'
      contains: 'compatSignature'
    - path: 'shared/types/src/CompatResult.ts'
      provides: 'Zod schema for compat result wire shape'
      contains: 'z.object'
  key_links:
    - from: 'apps/mobile/src/state/appStore.ts'
      to: 'apps/mobile/src/state/mmkv.ts'
      via: 'import secureMmkv'
      pattern: "from '\\./mmkv'"
    - from: 'apps/mobile/src/state/hydrate.ts'
      to: 'apps/mobile/src/state/keys.ts'
      via: 'import all key constants'
      pattern: "from '\\./keys'"
    - from: 'apps/mobile/src/services/auth.ts'
      to: 'apps/mobile/src/state/mmkv.ts'
      via: 'shared MMKV instance (refactor)'
      pattern: "from '\\.\\./state/mmkv'"
---

<objective>
Stand up the canonical state foundation Phase 2 builds on: a single MMKV instance + versioned keys + Zustand store + boot hydration + initial-route gate-decision tree, plus the `CompatResult` Zod schema in `shared/types`.

Purpose: D-STATE-01..04 + D-COMPAT-05. The 5+ Phase 2 services that touch persistent state (auth, compat, version, telemetry, installationId) all consume this foundation. AUTH-11 (new-device compat re-run) is satisfied here via the gate-decision tree's signature comparison.
Output: a hydrated Zustand store ready for `App.tsx` to consume in plan 02-05's navigator skeleton.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/auth.ts
@shared/types/src/app-version.ts
@shared/types/src/index.ts

<interfaces>
<!-- Phase 1 auth.ts MMKV pattern (02-PATTERNS.md Shared Pattern 1) -->
import { MMKV } from 'react-native-mmkv';
const mmkv = new MMKV({ id: 'humyn.secure', encryptionKey: 'humyn-mmkv-v1' });
const JWT_KEY = 'auth.jwt.v1';

<!-- Phase 1 app-version.ts schema shape (analog) -->

export const AppVersionResponseSchema = z.discriminatedUnion('flavor', [...]);
export type AppVersionResponse = z.infer<typeof AppVersionResponseSchema>;

<!-- D-COMPAT-05 CompatResult shape (verbatim from CONTEXT.md) -->

z.object({
signature: z.string(),
runAt: z.string().datetime(),
checks: z.object({
resolution: z.boolean(),
fps: z.boolean(),
ultrawideDfov: z.object({ pass: z.boolean(), measuredDeg: z.number() }),
imuSustained100Hz: z.object({ pass: z.boolean(), measuredHz: z.number() }),
imuP99Ms: z.object({ pass: z.boolean(), measuredMs: z.number() }),
micSampleRate: z.boolean(),
realtimeTimestamp: z.boolean(),
root: z.object({ pass: z.boolean(), verdict: z.string() }),
freeStorageGB: z.object({ pass: z.boolean(), warningOnly: z.boolean(), measuredGB: z.number() }),
encoderNoBFrames: z.boolean(),
oisOff: z.boolean(),
hdrSdrForced: z.boolean(),
}),
passed: z.boolean(),
failedKeys: z.array(z.string()),
});
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                       | Description                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| MMKV (encrypted at rest) → Zustand (in-memory) | hydration crosses this; values originate from a trusted local store       |
| Zustand store → JS code (read access)          | not a security boundary; same JS context                                  |
| `compat.lastResult.v1` MMKV value              | tamperable by a rooted-device user with file access — see threat T-2.3-01 |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                | Disposition | Mitigation Plan                                                                                                                                                                                                                                   |
| --------- | ---------------------- | ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.3-01  | Tampering              | `compat.lastResult.v1` MMKV value forged by user to fake compat-pass     | accept      | Compat is a UX gate, not a grant. Backend Play Integrity at sign-in is the binding gate. Phase 3 capture pipeline enforces the real spec at runtime — tampered compat-pass cannot upload non-spec recordings. (RESEARCH § Security Domain row 3.) |
| T-2.3-02  | Spoofing               | Forged `installation_id.v1` to bypass AUTH-11 cross-device compat re-run | accept      | Worst case: user skips a compat re-run on a real new device. The behavioral compat-check doesn't gate sign-in; sign-in is gated by Play Integrity (server-side).                                                                                  |
| T-2.3-03  | Information Disclosure | Zustand store leaks JWT to a debugger (Hermes inspector) in dev builds   | mitigate    | dev-only; `__DEV__` flag gates debugger attachment. JWT field on the store should be `string \| null`, never logged in `console.log` calls. Plan-checker greps for `console.log.*jwt` and rejects.                                                |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Create the shared MMKV singleton + key constants module</name>
  <files>apps/mobile/src/state/mmkv.ts (NEW), apps/mobile/src/state/keys.ts (NEW)</files>
  <read_first>
    - apps/mobile/src/services/auth.ts (current MMKV usage — see lines 22-25 in 02-PATTERNS.md Shared Pattern 1)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-STATE-01 (full key list)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "Shared Pattern 1: MMKV singleton + versioned keys"
  </read_first>
  <action>
    1. Create `apps/mobile/src/state/mmkv.ts`:
       ```ts
       /**
        * Single shared MMKV instance for the entire app, encrypted at rest with
        * the same key as Phase 1 auth.ts. NEVER create a second MMKV instance —
        * import this singleton from anywhere that needs persistent state.
        *
        * D-STATE-01.
        */
       import { MMKV } from 'react-native-mmkv';

       export const secureMmkv = new MMKV({
         id: 'humyn.secure',
         encryptionKey: 'humyn-mmkv-v1',
       });
       ```
       Filename `mmkv.ts` is intentional; do not name it `secureStore.ts` or similar — keep the impl detail surfaced.

    2. Create `apps/mobile/src/state/keys.ts` declaring every Phase 2 MMKV key as a `const`:
       ```ts
       /**
        * Versioned MMKV keys. NEVER hardcode a key string in a service — import
        * from here. New keys added in later phases extend this file with the
        * `.v1` (or `.v2` on schema break) suffix per Phase 1 convention.
        *
        * D-STATE-01.
        */
       export const KEYS = {
         AUTH_JWT: 'auth.jwt.v1',
         ONBOARDING_CONSENT: 'onboarding.consent.v1',
         ONBOARDING_PERMS_GRANTED: 'onboarding.permsGranted.v1',
         ONBOARDING_COMPAT_PASSED: 'onboarding.compatPassed.v1',
         ONBOARDING_TUTORIAL_DONE: 'onboarding.tutorialDone.v1',
         INSTALLATION_ID: 'installation_id.v1',
         COMPAT_LAST_RESULT: 'compat.lastResult.v1',
         APP_VERSION_CACHE: 'appVersion.cache.v1',
         TELEMETRY_RING: 'telemetry.ring.v1',
       } as const;

       /**
        * Per-version dismiss key for the soft-upgrade banner (D-UPG-05).
        * Pattern: `appVersion.softBannerDismissed.{latest}` (e.g., 1.6.2).
        */
       export function softBannerDismissKey(latest: string): string {
         return `appVersion.softBannerDismissed.${latest}`;
       }
       ```

    3. Update `apps/mobile/src/services/auth.ts` to import and use the new singleton + keys:
       - Replace local `const mmkv = new MMKV({...})` with `import { secureMmkv as mmkv } from '../state/mmkv';`.
       - Replace local `const JWT_KEY = 'auth.jwt.v1'` with `import { KEYS } from '../state/keys';` and use `KEYS.AUTH_JWT`.
       - Confirm tests still pass: `npm run test -- SignIn.test.tsx`.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/src/state/mmkv.ts && grep -q "humyn.secure" apps/mobile/src/state/mmkv.ts` succeeds.
    - `test -f apps/mobile/src/state/keys.ts && grep -q "AUTH_JWT" apps/mobile/src/state/keys.ts` succeeds.
    - `grep -c "'humyn.secure'" apps/mobile/src/services/auth.ts` returns 0 (auth.ts no longer hardcodes the id; uses singleton).
    - `grep -q "from '../state/mmkv'" apps/mobile/src/services/auth.ts` succeeds.
    - `cd apps/mobile && npm run test` (existing SignIn.test.tsx) passes.
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && test -f src/state/mmkv.ts && test -f src/state/keys.ts && grep -q "from '../state/mmkv'" src/services/auth.ts && (grep -c "new MMKV" src/services/auth.ts | awk '$1 == 0 { exit 0 } { exit 1 }') && npm run typecheck && npm run test</automated>
  </verify>
  <done>Singleton MMKV instance + key constants exist; auth.ts refactored to use them; Phase 1 tests still pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add CompatResult Zod schema to shared/types</name>
  <files>shared/types/src/CompatResult.ts (NEW), shared/types/src/index.ts</files>
  <read_first>
    - shared/types/src/app-version.ts (Phase 1 pattern — schema then type, header comment)
    - shared/types/src/index.ts (current SHARED_TYPES_VERSION)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-COMPAT-05 (canonical schema)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "shared/types/src/CompatResult.ts" lines 525-559
  </read_first>
  <action>
    1. Create `shared/types/src/CompatResult.ts`:
       ```ts
       /**
        * Wire shape for the device-compatibility check result.
        * Persisted in MMKV at `compat.lastResult.v1`; consumed by:
        *   - apps/mobile/src/services/compatService.ts (assemble + persist)
        *   - apps/mobile/src/screens/compat/CompatFailScreen.tsx (read failedKeys + measured*)
        *   - apps/mobile/src/state/initialRoute.ts (compatSignature staleness gate)
        *
        * Phase 2 D-COMPAT-05.
        */
       import { z } from 'zod';

       export const CompatChecksSchema = z.object({
         resolution: z.boolean(),
         fps: z.boolean(),
         ultrawideDfov: z.object({ pass: z.boolean(), measuredDeg: z.number() }),
         imuSustained100Hz: z.object({ pass: z.boolean(), measuredHz: z.number() }),
         imuP99Ms: z.object({ pass: z.boolean(), measuredMs: z.number() }),
         micSampleRate: z.boolean(),
         realtimeTimestamp: z.boolean(),
         root: z.object({ pass: z.boolean(), verdict: z.string() }),
         freeStorageGB: z.object({
           pass: z.boolean(),
           warningOnly: z.boolean(),
           measuredGB: z.number(),
         }),
         encoderNoBFrames: z.boolean(),
         oisOff: z.boolean(),
         hdrSdrForced: z.boolean(),
       });
       export type CompatChecks = z.infer<typeof CompatChecksSchema>;

       export const CompatResultSchema = z.object({
         signature: z.string(),
         runAt: z.string().datetime(),
         checks: CompatChecksSchema,
         passed: z.boolean(),
         failedKeys: z.array(z.string()),
       });
       export type CompatResult = z.infer<typeof CompatResultSchema>;
       ```

    2. Edit `shared/types/src/index.ts`:
       - Add `export * from './CompatResult.js';` (keep `.js` extension if Phase 1 follows that pattern; cross-check existing re-exports).
       - Bump `SHARED_TYPES_VERSION` from `'0.5.0'` → `'0.6.0'`.

    3. Run `pnpm --filter @humyn/shared-types build` (or whatever the existing build command is) and confirm dist artifact compiles.
    4. From `apps/mobile/`: re-install file: dep so the copy refreshes — `npm install` (re-resolves the file: link).

  </action>
  <acceptance_criteria>
    - `test -f shared/types/src/CompatResult.ts && grep -q "CompatResultSchema" shared/types/src/CompatResult.ts && grep -q "imuSustained100Hz" shared/types/src/CompatResult.ts && grep -q "encoderNoBFrames" shared/types/src/CompatResult.ts` succeeds.
    - `grep -q "CompatResult" shared/types/src/index.ts` succeeds.
    - `grep -q "SHARED_TYPES_VERSION = '0.6.0'" shared/types/src/index.ts` (or equivalent assignment) succeeds.
    - `pnpm --filter @humyn/shared-types build` exits 0 (or whatever the equivalent compile command is).
    - From `apps/mobile/`: `npm exec tsc --noEmit -- --noResolve false` does not error on `import { CompatResultSchema } from '@humyn/shared-types'`.
  </acceptance_criteria>
  <verify>
    <automated>test -f shared/types/src/CompatResult.ts && grep -q "CompatResultSchema" shared/types/src/CompatResult.ts && grep -q "from './CompatResult" shared/types/src/index.ts && cd apps/mobile && npm install && npm run typecheck</automated>
  </verify>
  <done>CompatResult Zod schema exists in shared/types; re-exported via index.ts; SHARED_TYPES_VERSION bumped; mobile typecheck clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Author the Zustand store + hydration + initial-route gate-decision tree</name>
  <files>apps/mobile/src/state/appStore.ts (NEW), apps/mobile/src/state/hydrate.ts (NEW), apps/mobile/src/state/initialRoute.ts (NEW), apps/mobile/__tests__/state/appStore.test.ts (NEW), apps/mobile/__tests__/state/hydrate.test.ts (NEW), apps/mobile/__tests__/state/initialRoute.test.ts (NEW)</files>
  <read_first>
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Pattern 1: Zustand store hydrated from MMKV at boot" lines 456-499
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Initial route gate-decision tree" lines 343-352
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-STATE-02..04 (Zustand, resume, AUTH-11)
    - shared/types/src/CompatResult.ts (Task 2 output)
    - apps/mobile/src/state/keys.ts (Task 1 output)
  </read_first>
  <behavior>
    Test 1 (appStore.test.ts): A fresh Zustand store has all state fields nullable/empty (`jwt: null`, `compatPassed: null`, `tutorialDone: false`, etc.).
    Test 2 (appStore.test.ts): `setCompatResult(result)` where `result.passed=true` populates `compatPassed: { signature, runAt }` + `compatLastResult: result`.
    Test 3 (appStore.test.ts): `signOut()` clears `jwt` to null AND removes `KEYS.AUTH_JWT` from MMKV.
    Test 4 (hydrate.test.ts): Given MMKV pre-seeded with `auth.jwt.v1=token123` + `installation_id.v1=uuid-abc` → after `hydrate()` → store.jwt === 'token123' AND store.installationId === 'uuid-abc'.
    Test 5 (hydrate.test.ts): Given MMKV pre-seeded with a malformed `compat.lastResult.v1` JSON → hydrate logs a warning and sets `compatLastResult: null`, `compatPassed: null` (graceful degrade).
    Test 6 (initialRoute.test.ts): Force-upgrade-blocked → returns 'ForceUpgrade'.
    Test 7 (initialRoute.test.ts): No JWT → returns 'OnboardingStack/Splash'.
    Test 8 (initialRoute.test.ts): Has JWT but no perms granted → returns 'OnboardingStack/Permissions'.
    Test 9 (initialRoute.test.ts): Has JWT + perms but compatSignature stale (different installation_id) → returns 'OnboardingStack/Compat' (AUTH-11 satisfied).
    Test 10 (initialRoute.test.ts): All gates passed but tutorialDone=false → returns 'OnboardingStack/RigTutorial'.
    Test 11 (initialRoute.test.ts): All gates green → returns 'MainTabs'.
  </behavior>
  <action>
    1. Create `apps/mobile/src/state/appStore.ts`:
       ```ts
       import { create } from 'zustand';
       import type { CompatResult } from '@humyn/shared-types';
       import { secureMmkv } from './mmkv';
       import { KEYS } from './keys';

       export interface ConsentState {
         acceptedAt: string;        // ISO datetime
         consentVersion: string;    // sha256 of canonical text — Phase 1 LEGAL constant
       }

       export interface PermsState {
         camera: boolean;
         mic: boolean;
         grantedAt: string;
       }

       export interface CompatPassedState {
         signature: string;
         runAt: string;
       }

       export interface AppVersionCacheEntry {
         response: unknown;        // typed once versionService lands
         fetchedAt: number;        // epoch ms
       }

       export interface AppState {
         jwt: string | null;
         consent: ConsentState | null;
         permsGranted: PermsState | null;
         compatPassed: CompatPassedState | null;
         compatLastResult: CompatResult | null;
         tutorialDone: boolean;
         installationId: string | null;
         appVersionCache: AppVersionCacheEntry | null;
         softUpgradeAvailable: { latest: string } | null;
         forceUpgradeBlocked: boolean;

         // actions
         setJwt(jwt: string | null): void;
         signOut(): void;
         setConsent(c: ConsentState): void;
         setPermsGranted(p: PermsState): void;
         setCompatResult(r: CompatResult): void;
         clearCompatPassed(): void;
         setTutorialDone(googleSub: string): void;
         setInstallationId(id: string): void;
         setAppVersionCache(c: AppVersionCacheEntry): void;
         setSoftUpgradeAvailable(s: { latest: string } | null): void;
         setForceUpgradeBlocked(b: boolean): void;
       }

       export const useAppStore = create<AppState>((set) => ({
         jwt: null,
         consent: null,
         permsGranted: null,
         compatPassed: null,
         compatLastResult: null,
         tutorialDone: false,
         installationId: null,
         appVersionCache: null,
         softUpgradeAvailable: null,
         forceUpgradeBlocked: false,

         setJwt: (jwt) => {
           if (jwt === null) secureMmkv.delete(KEYS.AUTH_JWT);
           else secureMmkv.set(KEYS.AUTH_JWT, jwt);
           set({ jwt });
         },
         signOut: () => {
           secureMmkv.delete(KEYS.AUTH_JWT);
           set({ jwt: null });
         },
         setConsent: (consent) => {
           secureMmkv.set(KEYS.ONBOARDING_CONSENT, JSON.stringify(consent));
           set({ consent });
         },
         setPermsGranted: (permsGranted) => {
           secureMmkv.set(KEYS.ONBOARDING_PERMS_GRANTED, JSON.stringify(permsGranted));
           set({ permsGranted });
         },
         setCompatResult: (r) => {
           secureMmkv.set(KEYS.COMPAT_LAST_RESULT, JSON.stringify(r));
           if (r.passed) {
             const compatPassed = { signature: r.signature, runAt: r.runAt };
             secureMmkv.set(KEYS.ONBOARDING_COMPAT_PASSED, JSON.stringify(compatPassed));
             set({ compatLastResult: r, compatPassed });
           } else {
             secureMmkv.delete(KEYS.ONBOARDING_COMPAT_PASSED);
             set({ compatLastResult: r, compatPassed: null });
           }
         },
         clearCompatPassed: () => {
           secureMmkv.delete(KEYS.ONBOARDING_COMPAT_PASSED);
           set({ compatPassed: null });
         },
         setTutorialDone: (googleSub) => {
           const v = { doneAt: new Date().toISOString(), googleSub };
           secureMmkv.set(KEYS.ONBOARDING_TUTORIAL_DONE, JSON.stringify(v));
           set({ tutorialDone: true });
         },
         setInstallationId: (id) => {
           secureMmkv.set(KEYS.INSTALLATION_ID, id);
           set({ installationId: id });
         },
         setAppVersionCache: (c) => {
           secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify(c));
           set({ appVersionCache: c });
         },
         setSoftUpgradeAvailable: (s) => set({ softUpgradeAvailable: s }),
         setForceUpgradeBlocked: (b) => set({ forceUpgradeBlocked: b }),
       }));
       ```

    2. Create `apps/mobile/src/state/hydrate.ts`:
       ```ts
       import { CompatResultSchema } from '@humyn/shared-types';
       import { secureMmkv } from './mmkv';
       import { KEYS } from './keys';
       import { useAppStore } from './appStore';

       function safeParse<T>(raw: string | undefined, parser: (v: unknown) => T): T | null {
         if (!raw) return null;
         try {
           return parser(JSON.parse(raw));
         } catch (_e) {
           return null;
         }
       }

       export function hydrate(): void {
         const jwt = secureMmkv.getString(KEYS.AUTH_JWT) ?? null;
         const consent = safeParse(secureMmkv.getString(KEYS.ONBOARDING_CONSENT), (v) => v as any);
         const permsGranted = safeParse(secureMmkv.getString(KEYS.ONBOARDING_PERMS_GRANTED), (v) => v as any);
         const compatPassed = safeParse(secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED), (v) => v as any);

         const compatLastRaw = secureMmkv.getString(KEYS.COMPAT_LAST_RESULT);
         let compatLastResult = null;
         if (compatLastRaw) {
           const parsed = CompatResultSchema.safeParse(JSON.parse(compatLastRaw));
           compatLastResult = parsed.success ? parsed.data : null;
         }

         const tutorialDoneRaw = secureMmkv.getString(KEYS.ONBOARDING_TUTORIAL_DONE);
         const tutorialDone = !!tutorialDoneRaw;

         const installationId = secureMmkv.getString(KEYS.INSTALLATION_ID) ?? null;
         const appVersionCache = safeParse(secureMmkv.getString(KEYS.APP_VERSION_CACHE), (v) => v as any);

         useAppStore.setState({
           jwt,
           consent,
           permsGranted,
           compatPassed,
           compatLastResult,
           tutorialDone,
           installationId,
           appVersionCache,
         });
       }
       ```

    3. Create `apps/mobile/src/state/initialRoute.ts`:
       ```ts
       import type { AppState } from './appStore';

       export type InitialRoute =
         | { stack: 'ForceUpgrade'; params: { hardBlock: true } }
         | { stack: 'OnboardingStack'; screen: 'Splash' }
         | { stack: 'OnboardingStack'; screen: 'Permissions' }
         | { stack: 'OnboardingStack'; screen: 'Compat' }
         | { stack: 'OnboardingStack'; screen: 'RigTutorial' }
         | { stack: 'MainTabs' };

       /**
        * Compute the compat signature from the running app context.
        * D-COMPAT-03: sha256(${appVersionCode}|${Build.FINGERPRINT}|${installation_id}).slice(0,16)
        *
        * The hashing happens in compatService when a probe runs; for the initial-route
        * decision we pass in the CURRENT signature (computed from versionCode+fingerprint+installId)
        * and compare to stored.
        */
       export function computeInitialRoute(
         s: AppState,
         currentCompatSignature: string | null,
       ): InitialRoute {
         if (s.forceUpgradeBlocked) {
           return { stack: 'ForceUpgrade', params: { hardBlock: true } };
         }
         if (!s.jwt) {
           return { stack: 'OnboardingStack', screen: 'Splash' };
         }
         if (!s.permsGranted || !s.permsGranted.camera || !s.permsGranted.mic) {
           return { stack: 'OnboardingStack', screen: 'Permissions' };
         }
         // AUTH-11 + COMPAT-04: stale signature → re-run compat
         if (
           !s.compatPassed ||
           (currentCompatSignature !== null && s.compatPassed.signature !== currentCompatSignature)
         ) {
           return { stack: 'OnboardingStack', screen: 'Compat' };
         }
         if (!s.tutorialDone) {
           return { stack: 'OnboardingStack', screen: 'RigTutorial' };
         }
         return { stack: 'MainTabs' };
       }
       ```

    4. Create the three test files in `apps/mobile/__tests__/state/`. Each test follows the Phase 1 vi.mock + describe pattern. Tests 1-3 in `appStore.test.ts`, 4-5 in `hydrate.test.ts`, 6-11 in `initialRoute.test.ts`. Use the `behavior` block above as the test plan.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/src/state/appStore.ts && grep -q "create<AppState>" apps/mobile/src/state/appStore.ts` succeeds.
    - `test -f apps/mobile/src/state/hydrate.ts && grep -q "useAppStore.setState" apps/mobile/src/state/hydrate.ts` succeeds.
    - `test -f apps/mobile/src/state/initialRoute.ts && grep -q "computeInitialRoute" apps/mobile/src/state/initialRoute.ts && grep -q "currentCompatSignature" apps/mobile/src/state/initialRoute.ts` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/state/` passes (all 11 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/state/</automated>
  </verify>
  <done>Zustand store + hydrate + initialRoute exist; 11 unit tests cover state set/clear, hydration, and gate-decision tree (including AUTH-11 stale-signature path); typecheck clean.</done>
</task>

</tasks>

<verification>
- shared/types CompatResult schema exists, re-exported, version bumped.
- Singleton MMKV + key constants module exist; auth.ts refactored.
- Zustand store + hydrate + initialRoute exist with full unit coverage.
- 11 state tests + existing Phase 1 tests all green.
- AUTH-11 (cross-device compat re-run) is satisfied via the gate-decision tree.
</verification>

<success_criteria>

- D-STATE-01..04 + D-COMPAT-05 implemented.
- Subsequent plans (02-04, 02-05, 02-08, 02-16, 02-20) all import from `apps/mobile/src/state/` without redefining MMKV instances or key constants.
- AUTH-07 (session persists across cold start), AUTH-11 (new device re-run), COMPAT-04 (re-run on app/OS update), COMPAT-05 (bar-raise gate), COMPAT-06 (failedKeys-driven fail screen) all have their state-layer support in place.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-03-SUMMARY.md` describing the singleton MMKV pattern, the Zustand store shape, and the gate-decision tree's behavior (especially AUTH-11 path).
</output>
