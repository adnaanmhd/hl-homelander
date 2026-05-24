/**
 * Plan 07-01 Task 2 — i18n runtime contract test (I18N-01 main coverage).
 *
 * Side-effect import of `../../src/i18n` runs `i18n.init` at module load
 * (D-23). These tests pin the five runtime invariants every downstream
 * Phase 7 plan depends on:
 *
 *   1. All 8 BCP-47 locales are wired as resources (no typo'd file path,
 *      no missing static import).
 *   2. The fresh-app boot defaults to English (the empty-MMKV path —
 *      mocked store is empty until any test writes to LOCALE_KEYS.CODE).
 *   3. `fallbackLng: 'en'` (D-12) — a missing key resolves to the key
 *      string (the i18next default when the locale catalog has no value
 *      AND the fallback catalog has no value either).
 *   4. `changeLanguage(tag)` synchronously enough for `t()` reads —
 *      proves the provider re-render path that the Profile picker and
 *      the recording-screen TTS will trigger in later plans.
 *   5. `compatibilityJSON: 'v4'` is set (i18next 26 plural-rule guard,
 *      07-RESEARCH Pitfall 5).
 *
 * Like the bootstrap test, this file lives under `__tests__/i18n/` (not
 * the plan-stated `src/i18n/__tests__/`) so the existing vitest include
 * glob picks it up. See 07-01-SUMMARY.md Rule 3 deviation.
 */
import { describe, it, expect, beforeAll } from 'vitest';

// The import runs the side-effect i18n.init() at module evaluation.
// Using a dynamic import inside beforeAll so we can `await` the implicit
// init promise (i18next.init returns a promise; `void` in index.ts means
// we don't await the rejection, but the runtime IS initialized
// synchronously for the resources path we care about — see test 4 below).
let i18n: typeof import('../../src/i18n').default;

beforeAll(async () => {
  i18n = (await import('../../src/i18n')).default;
});

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
    // The mocked MMKV store is empty at first import, so localeBootstrap()
    // returns 'en'. (If a later test races a changeLanguage(), the value
    // may have moved — assert via `??` to be defensive.)
    expect(['en']).toContain(i18n.language ?? 'en');
  });

  it('falls back to the key for a missing key, resolves a known key', () => {
    // 'totally.unknown.key' exists in NO catalog → i18next returns the key
    // string (its standard missing-key signal when returnNull is false).
    expect(i18n.t('totally.unknown.key' as never)).toBe('totally.unknown.key');
    // The skeleton key exists in en.json and resolves.
    expect(i18n.t('common.continue' as never)).toBe('Continue');
    // Nested key also resolves.
    expect(i18n.t('onboarding.chooseLanguage.title' as never)).toBe('Choose your language');
  });

  it('changeLanguage switches the active language and t() reads from the new catalog', async () => {
    await i18n.changeLanguage('hi-IN');
    expect(i18n.language).toBe('hi-IN');
    // Placeholder catalog mirrors English values verbatim until plan 07-02
    // runs the LLM regen — the assertion is just that the read resolves
    // to a string, not what the string says.
    expect(typeof i18n.t('common.continue' as never)).toBe('string');
    // Roundtrip back to en so other tests / module state stay clean.
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
  });

  it('is configured with compatibilityJSON v4 (07-RESEARCH Pitfall 5)', () => {
    expect(i18n.options.compatibilityJSON).toBe('v4');
  });

  it('is configured with fallbackLng "en" (D-12)', () => {
    // i18next normalizes string `fallbackLng` to an array internally.
    const fb = i18n.options.fallbackLng;
    if (typeof fb === 'string') {
      expect(fb).toBe('en');
    } else if (Array.isArray(fb)) {
      expect(fb).toContain('en');
    } else {
      // Object form { 'default': ['en'] } — also acceptable.
      expect(JSON.stringify(fb)).toContain('en');
    }
  });
});
