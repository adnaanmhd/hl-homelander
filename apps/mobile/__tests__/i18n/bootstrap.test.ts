/**
 * Plan 07-01 Task 1 — bootstrap-reader contract test (I18N-01 sub-coverage).
 *
 * The synchronous `localeBootstrap()` (per D-23) is what App.tsx will call
 * BEFORE the first React render to feed `lng` into `i18n.init`. This test
 * pins three invariants:
 *
 *   1. **MMKV empty → 'en'** — the SPEC-locked default per D-22 (the
 *      ChooseLanguageScreen renders in English on first launch).
 *   2. **stored ∈ SUPPORTED_LOCALES → stored** — round-trips every one of
 *      the 8 BCP-47 tags so a returning user lands back in their chosen
 *      locale on cold start.
 *   3. **stored ∉ SUPPORTED_LOCALES → 'en'** — defense in depth (T-07-01-01
 *      threat: tampered MMKV value). Catalog drift / a stale `'fr'` from a
 *      hypothetical future locale set must NEVER be passed through to
 *      i18next, where it would resolve to an empty resource set.
 *
 * Note on test path placement: vitest.config.ts `include` glob is
 * rooted at `apps/mobile/__tests__/`. The plan's `<files>` frontmatter
 * listed `apps/mobile/src/i18n/__tests__/...` but that path is NOT
 * discovered by the existing config — a test placed there would be
 * silently skipped. Mirroring the established convention under
 * `apps/mobile/__tests__/i18n/` (see `__tests__/native/`,
 * `__tests__/lib/`, etc.) so `npm test` picks it up. Documented as a
 * Rule 3 deviation in 07-01-SUMMARY.md.
 *
 * The in-memory MMKV mock in `vitest.setup.ts` shares a store across all
 * imports of `react-native-mmkv` — `beforeEach` clears the locale key so
 * each `it()` starts from a fresh empty state.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { localeBootstrap } from '../../src/i18n/bootstrap';
import { localeMmkv, LOCALE_KEYS, SUPPORTED_LOCALES } from '../../src/i18n/storage';

describe('localeBootstrap', () => {
  beforeEach(() => {
    try {
      // MMKV v4 (Nitro) public method is `.remove(key)` — `.delete` exists
      // on the vitest in-memory shim for back-compat but not on the runtime
      // type. Always use `.remove(...)` so tests typecheck.
      localeMmkv.remove(LOCALE_KEYS.CODE);
    } catch {
      /* best-effort — vitest in-memory mock never throws */
    }
  });

  it('returns "en" when MMKV has no stored locale', () => {
    expect(localeBootstrap()).toBe('en');
  });

  it('returns the stored locale for each of the 8 supported BCP-47 tags', () => {
    for (const loc of SUPPORTED_LOCALES) {
      localeMmkv.set(LOCALE_KEYS.CODE, loc);
      expect(localeBootstrap()).toBe(loc);
    }
  });

  it('returns "en" when MMKV has an unknown locale stored (T-07-01-01 mitigation)', () => {
    localeMmkv.set(LOCALE_KEYS.CODE, 'fr');
    expect(localeBootstrap()).toBe('en');
    localeMmkv.set(LOCALE_KEYS.CODE, 'xx-YY');
    expect(localeBootstrap()).toBe('en');
    localeMmkv.set(LOCALE_KEYS.CODE, '');
    expect(localeBootstrap()).toBe('en');
  });

  it('exports LOCALE_KEYS with the D-22 literal key strings', () => {
    expect(LOCALE_KEYS.CODE).toBe('locale.code');
    expect(LOCALE_KEYS.CHOSEN_AT).toBe('locale.chosen_at');
  });

  it('exports the 8 locales in the D-18 order (en first, then LatAm, then India)', () => {
    expect([...SUPPORTED_LOCALES]).toEqual([
      'en',
      'pt-BR',
      'es',
      'hi-IN',
      'bn-IN',
      'ta-IN',
      'te-IN',
      'mr-IN',
    ]);
  });
});
