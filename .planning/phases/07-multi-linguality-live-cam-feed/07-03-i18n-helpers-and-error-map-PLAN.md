---
phase: 07-multi-linguality-live-cam-feed
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/lib/dates.ts
  - apps/mobile/src/i18n/errorMap.ts
  - apps/mobile/src/util/analytics.ts
  - apps/mobile/src/lib/__tests__/dates.test.ts
  - apps/mobile/src/i18n/__tests__/errorMap.test.ts
  - apps/mobile/src/services/__tests__/telemetryRing.locale.test.ts
autonomous: true
requirements: [I18N-08, I18N-09, I18N-12]
tags: [i18n, intl, telemetry, mobile]
must_haves:
  truths:
    - "`formatDate(date, locale)` renders dates via Intl.DateTimeFormat with `numberingSystem: 'latn'` so digits stay 0–9 across all 8 locales"
    - '`ERROR_TOAST_KEYS` maps known API error codes to translated i18n keys'
    - '`locale_chosen` and `locale_changed` are members of `EVENT_NAMES` and pass through the existing `logEvent` allowlist'
    - 'Intl-unavailable runtimes fall back to English `toLocaleDateString` without throwing'
  artifacts:
    - path: apps/mobile/src/lib/dates.ts
      provides: 'formatDate(date, locale) helper with latn forcing'
      exports: ['formatDate', 'HAS_INTL']
    - path: apps/mobile/src/i18n/errorMap.ts
      provides: 'ERROR_TOAST_KEYS Record + GENERIC_ERROR_KEY constant'
      exports: ['ERROR_TOAST_KEYS', 'GENERIC_ERROR_KEY', 'toastKeyForCode']
    - path: apps/mobile/src/util/analytics.ts
      provides: 'EVENT_NAMES extended with locale_chosen + locale_changed'
      contains: 'locale_chosen'
  key_links:
    - from: apps/mobile/src/lib/dates.ts
      to: 'Intl.DateTimeFormat'
      via: "new Intl.DateTimeFormat(locale, { dateStyle, numberingSystem: 'latn' })"
      pattern: "numberingSystem: 'latn'"
    - from: apps/mobile/src/i18n/errorMap.ts
      to: apps/mobile/src/i18n/locales/en.json
      via: i18n key references like 'errors.auth.invalidToken'
      pattern: "errors\\."
    - from: apps/mobile/src/util/analytics.ts
      to: apps/mobile/src/services/telemetryRing.ts
      via: existing logEvent → telemetryRing.append path
      pattern: 'locale_chosen'
---

<objective>
Ship the three remaining i18n helpers that the screen-sweep + Profile picker plans (07-04, 07-05) depend on, but that have no inter-file coupling with i18n bootstrap (07-01) or the LLM tool (07-02). All three can land in parallel with plans 07-01 and 07-02 since file ownership is disjoint.

1. `formatDate(date, locale)` — `Intl.DateTimeFormat` wrapper with `numberingSystem: 'latn'` forcing (I18N-09 / D-36 / D-37). Hermes ships ICU; we still guard for `typeof Intl === 'undefined'` per D-36.
2. `ERROR_TOAST_KEYS` map — known API error codes → translated i18n keys (I18N-08 / D-34). The wire-up to actual toast call sites lives in plan 07-05.
3. `EVENT_NAMES` extension in `apps/mobile/src/util/analytics.ts` to allowlist `locale_chosen` + `locale_changed` (I18N-12 / D-30). The emission sites are in plans 07-04 (ChooseLanguage Continue, LanguageSheet row tap) — this plan just unlocks them by adding the names to the allowlist.

Output: three small pure-JS modules + tests, ready for downstream consumers in Waves 2.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VALIDATION.md
@CLAUDE.md
@apps/mobile/src/util/analytics.ts
@apps/mobile/src/services/telemetryRing.ts
@apps/mobile/src/lib/durationFormat.ts

<interfaces>
From apps/mobile/src/util/analytics.ts:
```typescript
export const EVENT_NAMES = [
  // ... existing names ...
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
const eventSet = new Set<string>(EVENT_NAMES);
```

From apps/mobile/src/services/telemetryRing.ts:

```typescript
export interface TelemetryEvent {
  name: string;
  ts: number;
  props: Record<string, string | number | boolean>;
}
export const telemetryRing = {
  append(event: TelemetryEvent): void {
    /* ... */
  },
};
```

From apps/mobile/src/lib/durationFormat.ts (analog — module-level pure function in same dir):

```typescript
export function formatDuration(/* ... */): string {
  /* ... */
}
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: formatDate helper + Intl guard + tests</name>
  <files>apps/mobile/src/lib/dates.ts, apps/mobile/src/lib/__tests__/dates.test.ts</files>
  <read_first>
    - apps/mobile/src/lib/durationFormat.ts (analog: lib/ convention — pure function module, no React/native)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-36, D-37 + SPEC I18N-09
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Date formatting" + "formatDate helper (D-37)" (lines 1407-1429)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "`apps/mobile/src/lib/dates.ts`"
  </read_first>
  <behavior>
    - `formatDate(new Date('2026-05-13'), 'en')` returns `"May 13, 2026"` (English medium format).
    - `formatDate(new Date('2026-05-13'), 'pt-BR')` returns a pt-BR medium date (e.g. `"13 de mai. de 2026"`).
    - `formatDate(new Date('2026-05-13'), 'hi-IN')` returns Devanagari script for month name BUT Latin digits (0–9). Acceptance grep: `/[0-9]/`.
    - When `Intl` is missing (mock by deleting global `Intl`), falls back to `date.toLocaleDateString('en-US', { dateStyle: 'medium' })`.
    - Throws no exceptions — degenerate locales fall back to English.
    - Exports `HAS_INTL` boolean constant for downstream module-init checks.
  </behavior>
  <action>
1. **Create `apps/mobile/src/lib/dates.ts`**:
   ```typescript
   /**
    * Locale-aware date formatting per I18N-09. Forces `latn` numbering so
    * digits stay 0–9 across all 8 locales (D-37). Hermes ships ICU so
    * Intl.DateTimeFormat is expected to be present; the guard catches
    * degenerate runtimes (D-36).
    */

// Module-init guard per D-36 — one-shot at load time.
export const HAS_INTL: boolean =
typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined';

export function formatDate(date: Date, locale: string): string {
if (!HAS_INTL) {
try {
return date.toLocaleDateString('en-US', {
year: 'numeric',
month: 'short',
day: 'numeric',
});
} catch {
return date.toISOString().slice(0, 10);
}
}
try {
return new Intl.DateTimeFormat(locale, {
dateStyle: 'medium',
// Force Latin digits across all 8 locales (D-37 / SPEC I18N-09).
numberingSystem: 'latn',
} as Intl.DateTimeFormatOptions).format(date);
} catch {
// Locale unsupported or option set rejected — fall back to en-US.
try {
return date.toLocaleDateString('en-US', { dateStyle: 'medium' } as never);
} catch {
return date.toISOString().slice(0, 10);
}
}
}

````

2. **Create `apps/mobile/src/lib/__tests__/dates.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest';
import { formatDate, HAS_INTL } from '../dates';

describe('formatDate', () => {
  const sample = new Date('2026-05-13T12:00:00Z');

  it('HAS_INTL is true in Hermes/Node (ICU present)', () => {
    expect(HAS_INTL).toBe(true);
  });

  it('renders English in medium form', () => {
    const out = formatDate(sample, 'en');
    // ICU output for en-US medium is typically "May 13, 2026"
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/May|13/);
  });

  it('renders pt-BR with non-English month abbreviation', () => {
    const out = formatDate(sample, 'pt-BR');
    expect(out).toMatch(/2026/);
    // ICU pt-BR medium uses 'mai' or 'mai.'
    expect(out.toLowerCase()).toMatch(/mai/);
  });

  it('renders hi-IN with Devanagari month but Latin digits (D-37)', () => {
    const out = formatDate(sample, 'hi-IN');
    expect(out).toMatch(/2026/); // Latin digits forced
    // verify digits are Latin 0-9 only, no Devanagari numerals like ०१२
    expect(out).not.toMatch(/[०-९]/);
  });

  it('falls back to English on a totally unknown locale', () => {
    const out = formatDate(sample, 'zz-ZZ');
    // Node's ICU may either accept it or throw; either way no exception escapes
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('never throws on any input', () => {
    expect(() => formatDate(sample, 'en')).not.toThrow();
    expect(() => formatDate(sample, 'pt-BR')).not.toThrow();
    expect(() => formatDate(sample, 'hi-IN')).not.toThrow();
    expect(() => formatDate(sample, 'bn-IN')).not.toThrow();
    expect(() => formatDate(sample, 'ta-IN')).not.toThrow();
    expect(() => formatDate(sample, 'te-IN')).not.toThrow();
    expect(() => formatDate(sample, 'mr-IN')).not.toThrow();
    expect(() => formatDate(sample, 'es')).not.toThrow();
  });
});
````

  </action>
  <verify>
    <automated>cd apps/mobile && npm test -- --run src/lib/__tests__/dates.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/mobile/src/lib/dates.ts` exists.
    - `grep -c "numberingSystem: 'latn'" apps/mobile/src/lib/dates.ts` returns 1.
    - `grep -c "HAS_INTL" apps/mobile/src/lib/dates.ts` returns at least 2 (export + usage).
    - Test command above exits 0; all 6 `it()` cases under "formatDate" green.
  </acceptance_criteria>
  <done>formatDate helper + Intl guard land with green tests; the digit-script assertion proves D-37 latn forcing on hi-IN.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ERROR_TOAST_KEYS map + EVENT_NAMES extension for locale events + tests</name>
  <files>apps/mobile/src/i18n/errorMap.ts, apps/mobile/src/util/analytics.ts, apps/mobile/src/i18n/__tests__/errorMap.test.ts, apps/mobile/src/services/__tests__/telemetryRing.locale.test.ts</files>
  <read_first>
    - apps/mobile/src/util/analytics.ts (lines 27-111: existing EVENT_NAMES allowlist + Set-based eventSet check at line 115 + logEvent at lines 131-153)
    - apps/mobile/src/services/telemetryRing.ts (lines 22-62: TelemetryEvent shape + append() API — D-30 says use as-is, no schema change)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-30, D-34, D-35
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "errorMap.ts (D-34)" (lines 1432-1449)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "errorMap.ts" + "telemetry-ring event emission"
  </read_first>
  <behavior>
    - `ERROR_TOAST_KEYS` is a `Record<string, string>` keyed by API error code (e.g. `'AUTH_INVALID_TOKEN'`) valued by i18n key (e.g. `'errors.auth.invalidToken'`).
    - `GENERIC_ERROR_KEY === 'errors.generic'`.
    - `toastKeyForCode(code)` returns `ERROR_TOAST_KEYS[code]` when present, else `GENERIC_ERROR_KEY`.
    - All i18n keys referenced exist in the `apps/mobile/src/i18n/locales/en.json` skeleton shipped in plan 07-01 (cross-validated by the test).
    - `EVENT_NAMES` in `apps/mobile/src/util/analytics.ts` is extended to include `'locale_chosen'` and `'locale_changed'` as additional readonly array entries.
    - `eventSet.has('locale_chosen')` returns true after the extension (Set is rebuilt from the array).
    - `telemetryRing.append({ name: 'locale_chosen', ... })` writes to the ring with no errors (regression coverage for the consumers in 07-04).
  </behavior>
  <action>
1. **Create `apps/mobile/src/i18n/errorMap.ts`** (D-34 verbatim shape):
   ```typescript
   /**
    * API error code → i18n toast-key map per D-34 / SPEC I18N-08.
    * Wire-up to actual toast call sites lives in plan 07-05.
    * Keep keys identical to the structure shipped in apps/mobile/src/i18n/locales/en.json
    * so the runtime t() lookup resolves.
    */
   export const GENERIC_ERROR_KEY = 'errors.generic';

export const ERROR_TOAST_KEYS: Record<string, string> = {
AUTH_INVALID_TOKEN: 'errors.auth.invalidToken',
AUTH_EXPIRED_TOKEN: 'errors.auth.expiredToken',
AUTH_GOOGLE_FAILED: 'errors.auth.googleFailed',
UPLOAD_QUOTA_EXCEEDED: 'errors.upload.quotaExceeded', // FRAUD-05/06 descoped MVP — kept defensively
UPLOAD_NETWORK_LOST: 'errors.upload.networkLost',
RECORDING_TOO_SHORT: 'errors.recording.tooShort',
COMPAT_FAILED: 'errors.compat.failed',
};

export function toastKeyForCode(code: string | null | undefined): string {
if (!code) return GENERIC_ERROR_KEY;
return ERROR_TOAST_KEYS[code] ?? GENERIC_ERROR_KEY;
}

````

2. **Extend `EVENT_NAMES` in `apps/mobile/src/util/analytics.ts`** — read the file first, locate the existing `EVENT_NAMES` array (declared with `as const`), and append the two new entries inside the existing literal so the `as const` discriminated-union type picks them up automatically. Add them at the END of the array (do NOT reorder existing entries — preserves analytics-funnel order). Include a short comment block:
```typescript
  // Phase 7 — locale telemetry (I18N-12 / D-30)
  'locale_chosen',
  'locale_changed',
] as const;
````

(The exact insertion: use the Edit tool to insert the two new lines + comment immediately before the closing `] as const;` of the `EVENT_NAMES` array — preserving the trailing comma convention already used in that file.)

3. **Create `apps/mobile/src/i18n/__tests__/errorMap.test.ts`**:

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { ERROR_TOAST_KEYS, GENERIC_ERROR_KEY, toastKeyForCode } from '../errorMap';
   import en from '../locales/en.json';

   function readPath(obj: unknown, path: string): unknown {
     return path
       .split('.')
       .reduce<unknown>(
         (acc, k) =>
           acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined,
         obj,
       );
   }

   describe('errorMap', () => {
     it('GENERIC_ERROR_KEY is "errors.generic" and exists in en.json', () => {
       expect(GENERIC_ERROR_KEY).toBe('errors.generic');
       expect(readPath(en, GENERIC_ERROR_KEY)).toBeTypeOf('string');
     });

     it('every mapped key resolves in en.json (no dangling references)', () => {
       for (const [code, key] of Object.entries(ERROR_TOAST_KEYS)) {
         const v = readPath(en, key);
         expect(v, `code=${code} key=${key} not in en.json`).toBeTypeOf('string');
       }
     });

     it('toastKeyForCode returns the mapped key for known codes', () => {
       expect(toastKeyForCode('AUTH_INVALID_TOKEN')).toBe('errors.auth.invalidToken');
       expect(toastKeyForCode('UPLOAD_NETWORK_LOST')).toBe('errors.upload.networkLost');
     });

     it('toastKeyForCode returns the generic key for unknown codes', () => {
       expect(toastKeyForCode('NEVER_HEARD_OF_THIS')).toBe(GENERIC_ERROR_KEY);
       expect(toastKeyForCode(null)).toBe(GENERIC_ERROR_KEY);
       expect(toastKeyForCode(undefined)).toBe(GENERIC_ERROR_KEY);
       expect(toastKeyForCode('')).toBe(GENERIC_ERROR_KEY);
     });
   });
   ```

4. **Create `apps/mobile/src/services/__tests__/telemetryRing.locale.test.ts`**:

   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import { telemetryRing } from '../telemetryRing';
   import { EVENT_NAMES, logEvent } from '../../util/analytics';

   describe('telemetry ring — locale events (I18N-12 / D-30)', () => {
     beforeEach(() => {
       try {
         telemetryRing.clear?.();
       } catch {}
     });

     it('locale_chosen + locale_changed are in EVENT_NAMES allowlist', () => {
       expect(EVENT_NAMES).toContain('locale_chosen');
       expect(EVENT_NAMES).toContain('locale_changed');
     });

     it('logEvent accepts locale_chosen with installation_id + chosen_locale', () => {
       expect(() =>
         logEvent('locale_chosen' as never, {
           installation_id: 'install-xyz',
           chosen_locale: 'hi-IN',
         }),
       ).not.toThrow();
     });

     it('logEvent accepts locale_changed with from_locale + to_locale', () => {
       expect(() =>
         logEvent('locale_changed' as never, {
           installation_id: 'install-xyz',
           from_locale: 'en',
           to_locale: 'pt-BR',
         }),
       ).not.toThrow();
     });
   });
   ```

   (If `telemetryRing.clear` does not exist, the `try/catch` swallows it — Phase 7 does not add to telemetryRing's API per D-30.)
   </action>
   <verify>
   <automated>cd apps/mobile && npm test -- --run src/i18n/**tests**/errorMap.test.ts src/services/**tests**/telemetryRing.locale.test.ts 2>&1 | tail -25</automated>
   </verify>
   <acceptance_criteria> - File `apps/mobile/src/i18n/errorMap.ts` exists; `grep -c "errors.auth.invalidToken" apps/mobile/src/i18n/errorMap.ts` returns 1. - `grep -c "'locale_chosen'" apps/mobile/src/util/analytics.ts` returns 1. - `grep -c "'locale_changed'" apps/mobile/src/util/analytics.ts` returns 1. - No change to `apps/mobile/src/services/telemetryRing.ts` (D-30): `git diff --stat apps/mobile/src/services/telemetryRing.ts` returns empty. - Test command above exits 0; all 4 errorMap cases + 3 telemetry-locale cases green.
   </acceptance_criteria>
   <done>Error code → toast key map exists with all keys resolvable in en.json; EVENT_NAMES allowlist extended; telemetryRing.ts itself untouched per D-30.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                          | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| API error response → client toast | Server `code` field used to look up translated copy |
| logEvent props → telemetry ring   | locale identifiers persisted in the ring buffer     |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                    | Disposition | Mitigation Plan                                                                                                                                                                                        |
| ---------- | ---------------------- | ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-07-03-01 | Information Disclosure | English `detail` field leaked into the UI                                    | mitigate    | `ERROR_TOAST_KEYS` translates KNOWN codes; unknown codes fall through to the generic translated key. The raw English `detail` is logged to Crashlytics only (call-site wiring in plan 07-05 per D-35). |
| T-07-03-02 | Tampering              | Server returns a malicious error code intended to surface a misleading toast | accept      | The `code` is bounded by the server's RFC 7807 enum; the worst case is the generic toast. No privilege escalation.                                                                                     |
| T-07-03-03 | Information Disclosure | Locale stored in telemetry ring                                              | accept      | Locale is not PII per the consent policy; CONTEXT D-30 explicitly uses the ring for these events.                                                                                                      |
| T-07-03-04 | Tampering              | Intl format string parsing returns an unexpected value                       | mitigate    | `formatDate` wraps the `Intl.DateTimeFormat.format` call in try/catch and falls back to English; degenerate runtimes go through the `HAS_INTL` guard.                                                  |

</threat_model>

<verification>
- `cd apps/mobile && npm test -- --run src/lib/__tests__/dates.test.ts src/i18n/__tests__/errorMap.test.ts src/services/__tests__/telemetryRing.locale.test.ts` exits 0
- `cd apps/mobile && npx tsc --noEmit` exits 0
- `git diff apps/mobile/src/services/telemetryRing.ts` returns empty (D-30 — no schema change)
</verification>

<success_criteria>

- 3 new source files + 2 tests + 1 modified file (`analytics.ts`)
- All vitest cases green
- No untouched-file modifications outside the explicit list
- All errorMap i18n keys resolve to a string in en.json (no dangling references)
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-03-SUMMARY.md` per the standard template.
</output>
