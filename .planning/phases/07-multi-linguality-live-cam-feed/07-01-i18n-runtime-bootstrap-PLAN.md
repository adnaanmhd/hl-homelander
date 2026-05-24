---
phase: 07-multi-linguality-live-cam-feed
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/package.json
  - apps/mobile/src/i18n/index.ts
  - apps/mobile/src/i18n/storage.ts
  - apps/mobile/src/i18n/bootstrap.ts
  - apps/mobile/src/i18n/locales/en.json
  - apps/mobile/src/i18n/locales/pt-BR.json
  - apps/mobile/src/i18n/locales/es.json
  - apps/mobile/src/i18n/locales/hi-IN.json
  - apps/mobile/src/i18n/locales/bn-IN.json
  - apps/mobile/src/i18n/locales/ta-IN.json
  - apps/mobile/src/i18n/locales/te-IN.json
  - apps/mobile/src/i18n/locales/mr-IN.json
  - apps/mobile/App.tsx
  - apps/mobile/src/i18n/__tests__/i18n.test.ts
  - apps/mobile/src/i18n/__tests__/bootstrap.test.ts
autonomous: true
requirements: [I18N-01]
tags: [i18n, react-native, mmkv, mobile]
must_haves:
  truths:
    - 'i18next is initialized with all 8 locale resources before the first React render'
    - 'localeMmkv reads `locale.code` synchronously and the result drives i18n.init({ lng })'
    - '`<I18nextProvider>` wraps `<NavigationContainer>` so `useTranslation` works in every screen'
    - "An undefined or unknown `locale.code` in MMKV defaults to `'en'` without crashing"
  artifacts:
    - path: apps/mobile/src/i18n/index.ts
      provides: 'i18n module that side-effect initializes i18next with 8 locales'
      contains: 'initReactI18next'
    - path: apps/mobile/src/i18n/storage.ts
      provides: 'localeMmkv non-secure MMKV instance + LOCALE_KEYS constants'
      contains: 'humyn.locale'
    - path: apps/mobile/src/i18n/bootstrap.ts
      provides: 'localeBootstrap() synchronous reader'
      exports: ['localeBootstrap']
    - path: apps/mobile/src/i18n/locales/en.json
      provides: 'Starter English catalog (skeleton — bulk added in plan 07-05)'
      contains: 'common'
  key_links:
    - from: apps/mobile/App.tsx
      to: apps/mobile/src/i18n/index.ts
      via: side-effect import + provider wrap
      pattern: 'I18nextProvider'
    - from: apps/mobile/src/i18n/index.ts
      to: apps/mobile/src/i18n/bootstrap.ts
      via: synchronous call before i18n.init
      pattern: 'localeBootstrap'
    - from: apps/mobile/src/i18n/bootstrap.ts
      to: apps/mobile/src/i18n/storage.ts
      via: localeMmkv.getString
      pattern: 'LOCALE_KEYS.CODE'
---

<objective>
Stand up the i18n runtime in a codebase that today has zero i18n. Install `i18next@^26.2.0` + `react-i18next@^17.0.8`, create the new non-secure `localeMmkv` instance (D-21), implement the synchronous `localeBootstrap()` that reads `locale.code` before any React render (D-23), wire `<I18nextProvider>` immediately inside `<SafeAreaProvider>` at App.tsx root, and ship eight placeholder locale JSONs so `i18n.init({ resources })` does not throw. The starter `en.json` holds only the skeleton object shape from `07-PATTERNS.md` lines 1075-1101; the 22-screen string sweep that fills it lives in plan 07-05.

Purpose: every downstream plan in this phase depends on `useTranslation()` and `i18n.language` being reactive at the root provider. This plan must complete before any consumer (Profile picker, screen sweep, TTS chain, reverseSearch, error map) can land.

Output: a buildable mobile app where `i18n.language === 'en'` at boot (or the stored locale if previously set), the provider re-renders on `i18n.changeLanguage()`, and key-fallback to English is wired for missing keys (D-12).
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VALIDATION.md
@CLAUDE.md
@apps/mobile/App.tsx
@apps/mobile/src/state/mmkv.ts
@apps/mobile/src/state/keys.ts
@apps/mobile/package.json

<interfaces>
<!-- Extracted from analogs so the executor does not have to explore. -->

From apps/mobile/src/state/mmkv.ts:

```typescript
import { createMMKV, type MMKV } from 'react-native-mmkv';
export const secureMmkv: MMKV = createMMKV({
  id: 'humyn.secure',
  encryptionKey: 'humyn-mmkv-v1',
});
```

From apps/mobile/src/state/keys.ts:

```typescript
export const KEYS = {
  AUTH_JWT: 'auth.jwt.v1',
  ONBOARDING_CONSENT: 'onboarding.consent.v1',
  // ...
  TELEMETRY_RING: 'telemetry.ring.v1',
} as const;
```

From apps/mobile/App.tsx (current top of module):

```typescript
enableScreens(true);
// Sync hydrate before render — MMKV is sync, Zustand setState is sync.
hydrate();
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Install i18n deps + create localeMmkv storage module</name>
  <files>apps/mobile/package.json, apps/mobile/src/i18n/storage.ts, apps/mobile/src/i18n/bootstrap.ts, apps/mobile/src/i18n/__tests__/bootstrap.test.ts</files>
  <read_first>
    - apps/mobile/package.json (existing dep versions; confirm `react-native-mmkv@4.3.1` already present)
    - apps/mobile/src/state/mmkv.ts (analog: `createMMKV` factory shape; do NOT use `new MMKV` — runtime bug per file's header comment)
    - apps/mobile/src/state/keys.ts (analog: `as const` KEYS pattern)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-06, D-21, D-22, D-23
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "`apps/mobile/src/i18n/storage.ts` (NEW — MMKV instance + KEYS)"
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "MMKV Bootstrap Order at App.tsx" + "i18next-react-native-language-detector — DO NOT USE"
  </read_first>
  <behavior>
    - `localeMmkv` is a SECOND MMKV instance with `id: 'humyn.locale'` and NO `encryptionKey` field (D-21 — locale is not a secret).
    - `LOCALE_KEYS.CODE === 'locale.code'`; `LOCALE_KEYS.CHOSEN_AT === 'locale.chosen_at'` (D-22 literal keys).
    - `localeBootstrap()` returns `'en'` when MMKV is empty.
    - `localeBootstrap()` returns the stored value when it equals one of the 8 BCP-47 tags `['en','pt-BR','es','hi-IN','bn-IN','ta-IN','te-IN','mr-IN']`.
    - `localeBootstrap()` returns `'en'` (NOT the raw value) when the stored value is something unknown like `'fr'` or `'xx'` — defense in depth against catalog drift.
    - `localeBootstrap()` does NOT throw; MMKV read errors result in `'en'` (best-effort).
  </behavior>
  <action>
Install i18n dependencies and scaffold the MMKV storage module.

1. **Install deps** in `apps/mobile/`:

   ```bash
   cd apps/mobile
   npm install --save i18next@^26.2.0 react-i18next@^17.0.8
   ```

   Verify both lines appear in `apps/mobile/package.json` `dependencies`. Do NOT install `i18next-react-native-language-detector` (unmaintained since 2016 per 07-RESEARCH.md "DO NOT USE" — hand-roll the detector).

2. **Create `apps/mobile/src/i18n/storage.ts`** (mirror `apps/mobile/src/state/mmkv.ts` shape):

   ```typescript
   /**
    * Locale state lives in a NEW non-secure MMKV instance per D-21.
    * Locale is NOT a secret — `secureMmkv` is reserved for tokens / telemetry
    * ring / PII-adjacent ledgers. See 07-CONTEXT.md decisions.
    */
   import { createMMKV, type MMKV } from 'react-native-mmkv';

   export const localeMmkv: MMKV = createMMKV({
     id: 'humyn.locale',
     // No encryptionKey — locale is not a secret (D-21).
   });

   export const LOCALE_KEYS = {
     CODE: 'locale.code',
     CHOSEN_AT: 'locale.chosen_at',
   } as const;

   export const SUPPORTED_LOCALES = [
     'en',
     'pt-BR',
     'es',
     'hi-IN',
     'bn-IN',
     'ta-IN',
     'te-IN',
     'mr-IN',
   ] as const;
   export type Locale = (typeof SUPPORTED_LOCALES)[number];
   ```

3. **Create `apps/mobile/src/i18n/bootstrap.ts`** (synchronous reader):

   ```typescript
   /**
    * Synchronous MMKV read at app startup per D-23. Called BEFORE
    * `i18n.init({ lng })` so the first render is in the correct locale.
    * Must never throw — best-effort fall-back to 'en'.
    */
   import { localeMmkv, LOCALE_KEYS, SUPPORTED_LOCALES, type Locale } from './storage';

   export function localeBootstrap(): Locale {
     try {
       const stored = localeMmkv.getString(LOCALE_KEYS.CODE);
       if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
         return stored as Locale;
       }
     } catch {
       // MMKV read failures fall through to default
     }
     return 'en';
   }
   ```

4. **Create `apps/mobile/src/i18n/__tests__/bootstrap.test.ts`** (Wave 0 — RED-then-GREEN as part of this task):

   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   import { localeBootstrap } from '../bootstrap';
   import { localeMmkv, LOCALE_KEYS } from '../storage';

   describe('localeBootstrap', () => {
     beforeEach(() => {
       try {
         localeMmkv.delete(LOCALE_KEYS.CODE);
       } catch {}
     });

     it('returns "en" when MMKV has no stored locale', () => {
       expect(localeBootstrap()).toBe('en');
     });

     it('returns the stored locale for each of the 8 supported BCP-47 tags', () => {
       for (const loc of ['en', 'pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']) {
         localeMmkv.set(LOCALE_KEYS.CODE, loc);
         expect(localeBootstrap()).toBe(loc);
       }
     });

     it('returns "en" when MMKV has an unknown locale stored', () => {
       localeMmkv.set(LOCALE_KEYS.CODE, 'fr');
       expect(localeBootstrap()).toBe('en');
       localeMmkv.set(LOCALE_KEYS.CODE, 'xx-YY');
       expect(localeBootstrap()).toBe('en');
     });
   });
   ```

5. Confirm vitest mocks for `react-native-mmkv` are already in place (Phase 2's `02-02-test-scaffolding-and-deps-PLAN` set these up); if the test fails with a missing-native-module error, add a `__mocks__/react-native-mmkv.ts` that exposes an in-memory map shim.
   </action>
   <verify>
   <automated>cd apps/mobile && npm test -- --run src/i18n/**tests**/bootstrap.test.ts 2>&1 | tail -20</automated>
   </verify>
   <acceptance_criteria> - `grep -c '"i18next"' apps/mobile/package.json` returns >= 1 (filter comments: `grep -v '^[[:space:]]*//' apps/mobile/package.json | grep -c '"i18next"'`). - `grep -c '"react-i18next"' apps/mobile/package.json` returns >= 1. - File `apps/mobile/src/i18n/storage.ts` exists; `grep -c "humyn.locale" apps/mobile/src/i18n/storage.ts` returns 1. - File `apps/mobile/src/i18n/storage.ts` does NOT contain the literal `encryptionKey` (D-21 — locale not a secret); `grep -c "encryptionKey" apps/mobile/src/i18n/storage.ts` returns 0. - File `apps/mobile/src/i18n/bootstrap.ts` exports `localeBootstrap`; `grep -c "export function localeBootstrap" apps/mobile/src/i18n/bootstrap.ts` returns 1. - Test command above exits 0 with all three `it()` cases green.
   </acceptance_criteria>
   <done>Deps installed, localeMmkv + LOCALE_KEYS + SUPPORTED_LOCALES exported, localeBootstrap() returns 'en' on empty/invalid and the stored value on each of the 8 valid tags, bootstrap test green.</done>
   </task>

<task type="auto" tdd="true">
  <name>Task 2: Create i18n runtime + 8 placeholder locale JSONs + wire I18nextProvider in App.tsx</name>
  <files>apps/mobile/src/i18n/index.ts, apps/mobile/src/i18n/locales/en.json, apps/mobile/src/i18n/locales/pt-BR.json, apps/mobile/src/i18n/locales/es.json, apps/mobile/src/i18n/locales/hi-IN.json, apps/mobile/src/i18n/locales/bn-IN.json, apps/mobile/src/i18n/locales/ta-IN.json, apps/mobile/src/i18n/locales/te-IN.json, apps/mobile/src/i18n/locales/mr-IN.json, apps/mobile/App.tsx, apps/mobile/src/i18n/__tests__/i18n.test.ts</files>
  <read_first>
    - apps/mobile/App.tsx (existing top-of-module init order at lines 33-37 per 07-PATTERNS.md)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Pattern 1: i18n bootstrap before navigator" (lines 393-451) — copy verbatim as the skeleton
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "i18next + `compatibilityJSON: 'v4'` mismatch" pitfall — MUST set `compatibilityJSON: 'v4'` explicitly
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-06, D-07, D-08, D-23
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "`apps/mobile/src/i18n/index.ts`" + "`apps/mobile/App.tsx` (MODIFY)"
    - apps/mobile/src/i18n/bootstrap.ts (created in Task 1)
    - apps/mobile/src/i18n/storage.ts (created in Task 1)
  </read_first>
  <behavior>
    - `i18n.init` runs as a module-level side effect at first import (not inside a hook / useEffect).
    - All 8 locale JSONs static-imported (no `i18next-http-backend`).
    - `i18n.language` reflects `localeBootstrap()` result on first render.
    - `fallbackLng: 'en'` configured so missing keys fall back to English (D-12).
    - `compatibilityJSON: 'v4'` set explicitly (suppress i18next 26 plural warning per 07-RESEARCH Pitfall 5).
    - `i18n.changeLanguage('hi-IN')` followed by `i18n.t('common.continue')` returns the Hindi value (proves the provider re-render path).
    - `<I18nextProvider i18n={i18n}>` wraps `<NavigationContainer>` at App.tsx (inside `<SafeAreaProvider>` per 07-RESEARCH "Provider Placement").
  </behavior>
  <action>
1. **Create 8 placeholder locale JSONs** at `apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json`. Per D-08 use `screen.section.element` dotted paths. Per 07-PATTERNS.md lines 1075-1101 ship the STARTER skeleton — the screen sweep in plan 07-05 will add the bulk of the keys, plan 07-02 will regenerate the 7 non-English files via the LLM tool.

`apps/mobile/src/i18n/locales/en.json` (authoritative — hand-authored per D-12):

```json
{
  "common": {
    "continue": "Continue",
    "cancel": "Cancel",
    "save": "Save",
    "close": "Close"
  },
  "onboarding": {
    "chooseLanguage": {
      "title": "Choose your language",
      "continueButton": "Continue"
    }
  },
  "profile": {
    "language": {
      "row": { "label": "Language" },
      "picker": { "title": "Select language" }
    }
  },
  "recording": {
    "preview": { "live": "Live preview" }
  },
  "terms": {
    "consent": {
      "modalTitle": "Terms of Use",
      "body": "I consent and agree to upload videos."
    }
  },
  "errors": {
    "generic": "Something went wrong",
    "auth": {
      "invalidToken": "Please sign in again",
      "expiredToken": "Your session expired — please sign in again",
      "googleFailed": "Google sign-in failed"
    },
    "upload": {
      "quotaExceeded": "Upload quota reached for today",
      "networkLost": "Network lost — retry when back online"
    },
    "recording": {
      "tooShort": "Recording was too short"
    },
    "compat": {
      "failed": "Your device is not compatible"
    }
  }
}
```

For each of the 7 non-English locales create a JSON with the SAME KEY SHAPE. For the placeholder pass, use the English values verbatim — the LLM regeneration in plan 07-02 + 07-05 replaces these with translated values. (i18next key-fallback would mask missing keys anyway, but having the shape parity now lets us run shape-parity validation in plan 07-02.)

2. **Create `apps/mobile/src/i18n/index.ts`** per 07-RESEARCH §"Pattern 1" verbatim skeleton:

   ```typescript
   import i18n from 'i18next';
   import { initReactI18next } from 'react-i18next';
   import { localeBootstrap } from './bootstrap';
   import en from './locales/en.json';
   import ptBR from './locales/pt-BR.json';
   import es from './locales/es.json';
   import hiIN from './locales/hi-IN.json';
   import bnIN from './locales/bn-IN.json';
   import taIN from './locales/ta-IN.json';
   import teIN from './locales/te-IN.json';
   import mrIN from './locales/mr-IN.json';

   const lng = localeBootstrap();

   void i18n.use(initReactI18next).init({
     lng,
     fallbackLng: 'en',
     interpolation: { escapeValue: false }, // React already escapes
     compatibilityJSON: 'v4',
     returnNull: false,
     resources: {
       en: { translation: en },
       'pt-BR': { translation: ptBR },
       es: { translation: es },
       'hi-IN': { translation: hiIN },
       'bn-IN': { translation: bnIN },
       'ta-IN': { translation: taIN },
       'te-IN': { translation: teIN },
       'mr-IN': { translation: mrIN },
     },
   });

   export default i18n;
   ```

3. **Modify `apps/mobile/App.tsx`**: add the side-effect import + provider wrap.

   - Add at top of imports: `import './src/i18n';` and `import { I18nextProvider } from 'react-i18next';` and `import i18n from './src/i18n';`
   - Keep existing `enableScreens(true);` and `hydrate();` lines unchanged at module top-level (Task 1's MMKV read for `localeBootstrap` runs as a side effect of the `./src/i18n` import, which precedes the navigator render).
   - Inside the `App` component's JSX return, wrap `<NavigationContainer>` (and any siblings like `<ToastHost />`) with `<I18nextProvider i18n={i18n}>`. The provider goes IMMEDIATELY inside `<SafeAreaProvider>` per 07-RESEARCH "Provider Placement".

4. **Create `apps/mobile/src/i18n/__tests__/i18n.test.ts`** (I18N-01 coverage):

   ```typescript
   import { describe, it, expect } from 'vitest';
   import i18n from '../index';

   describe('i18n runtime', () => {
     it('exposes the 8 supported locales as resources', () => {
       const langs = Object.keys(i18n.options.resources ?? {});
       expect(langs.sort()).toEqual([
         'bn-IN',
         'en',
         'es',
         'hi-IN',
         'mr-IN',
         'pt-BR',
         'ta-IN',
         'te-IN',
       ]);
     });

     it('defaults to English on a fresh app start', () => {
       expect(['en']).toContain(i18n.language ?? 'en');
     });

     it('falls back to English for a missing key', () => {
       // 'totally.unknown.key' exists in NO catalog
       expect(i18n.t('totally.unknown.key' as never)).toBe('totally.unknown.key');
       // The skeleton key exists in en.json — should resolve
       expect(i18n.t('common.continue' as never)).toBe('Continue');
     });

     it('changeLanguage switches the active language synchronously enough for reads', async () => {
       await i18n.changeLanguage('hi-IN');
       expect(i18n.language).toBe('hi-IN');
       // catalog is placeholder (English values) until LLM regen — the value is still resolvable
       expect(typeof i18n.t('common.continue' as never)).toBe('string');
       await i18n.changeLanguage('en');
     });

     it('configured with compatibilityJSON v4', () => {
       expect(i18n.options.compatibilityJSON).toBe('v4');
     });
   });
   ```

     </action>
     <verify>
       <automated>cd apps/mobile && npm test -- --run src/i18n/__tests__/i18n.test.ts src/i18n/__tests__/bootstrap.test.ts 2>&1 | tail -25</automated>
     </verify>
     <acceptance_criteria>
       - All 8 files `apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` exist and parse as JSON: `for f in apps/mobile/src/i18n/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || exit 1; done` exits 0.
       - `grep -c "compatibilityJSON: 'v4'" apps/mobile/src/i18n/index.ts` returns 1.
       - `grep -c "fallbackLng: 'en'" apps/mobile/src/i18n/index.ts` returns 1.
       - `grep -c "I18nextProvider" apps/mobile/App.tsx` returns at least 2 (the import + the JSX usage).
       - `grep -c "import './src/i18n'" apps/mobile/App.tsx` returns 1 (side-effect import that triggers init).
       - Test command above exits 0; all 5 `it()` cases under "i18n runtime" green plus the 3 cases from Task 1.
     </acceptance_criteria>
     <done>i18n runtime initialized at module load, provider wraps NavigationContainer, all 8 placeholder JSONs parseable with identical key shape to en.json, `i18n.changeLanguage('hi-IN')` switches successfully, tests green.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                     | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| MMKV → JS runtime            | Stored locale value read from disk into i18n.init |
| package.json → mobile bundle | New npm deps shipped into the Hermes-compiled APK |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                  | Disposition | Mitigation Plan                                                                                                                                                                         |
| ---------- | ---------------------- | ------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-01-01 | Tampering              | `localeMmkv` value                         | mitigate    | `localeBootstrap()` validates against the `SUPPORTED_LOCALES` allowlist before returning; unknown values fall back to `'en'` (Task 1 behavior + tested).                                |
| T-07-01-02 | Information Disclosure | Locale catalog JSONs                       | accept      | Catalogs contain UI copy only — no PII, no secrets. Standard React text rendering is XSS-safe; i18next escapes `{{var}}` interpolations by default.                                     |
| T-07-01-03 | Tampering              | Catalog injection via LLM-generated JSON   | mitigate    | Shape-parity validation lives in plan 07-02; this plan ships placeholder JSONs hand-edited from `en.json`, no LLM output yet.                                                           |
| T-07-01-04 | Denial of Service      | Async i18n bootstrap renders raw keys      | mitigate    | `i18n.init` runs as module-level side effect (sync resolve when `initImmediate` defaulted) per 07-RESEARCH "Sync Read Before Navigator Mount". First render already has correct locale. |
| T-07-01-05 | Information Disclosure | Logging of locale to telemetry/Crashlytics | accept      | Locale is a non-sensitive value (chosen language); appears in events in plan 07-05 only.                                                                                                |

</threat_model>

<verification>
Phase-level checks after this plan lands:
- `cd apps/mobile && npm test -- --run src/i18n/` passes
- `cd apps/mobile && npx tsc --noEmit` exits 0
- `grep -rn "from 'react-i18next'" apps/mobile/src/ apps/mobile/App.tsx | wc -l` returns at least 2 (index.ts + App.tsx)
- No regressions in existing mobile suite: `cd apps/mobile && npm test -- --run` exits 0
</verification>

<success_criteria>

- 2 i18n source files exist (`index.ts`, `bootstrap.ts`) + `storage.ts`
- 8 locale JSONs committed with identical key shapes (parity checked in plan 07-02)
- App boots with `i18n.language` equal to either the stored locale or `'en'`
- Test commands above all green
- `I18nextProvider` reachable via `useTranslation` from any screen under `<NavigationContainer>`
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-01-SUMMARY.md` per `@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md`.
</output>
