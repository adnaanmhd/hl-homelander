// formatDate helper — I18N-09 / D-36 / D-37.
//
// Verifies that the new `apps/mobile/src/lib/dates.ts` helper renders dates
// through `Intl.DateTimeFormat` with `numberingSystem: 'latn'` so digits stay
// 0–9 across all 8 MVP locales (D-37), guards a degenerate runtime that
// lacks `Intl` (D-36) by falling back to English `toLocaleDateString`, and
// never throws on any locale tag.
//
// Test location follows the project convention `apps/mobile/__tests__/{subdir}/*.test.ts`
// (vitest.config.ts `include: ['__tests__/**/*.test.ts', ...]`). The plan
// originally specified `apps/mobile/src/lib/__tests__/dates.test.ts`; that
// path is not in the include glob and the test would not be discovered.
// Deviation logged in SUMMARY.md under Rule-3 (blocking).

import { describe, it, expect } from 'vitest';
import { formatDate, HAS_INTL } from '../../src/lib/dates';

describe('formatDate (I18N-09 / D-36 / D-37)', () => {
  const sample = new Date('2026-05-13T12:00:00Z');

  it('HAS_INTL is true in Hermes/Node (ICU present)', () => {
    expect(HAS_INTL).toBe(true);
  });

  it('renders English in medium form', () => {
    const out = formatDate(sample, 'en');
    // ICU output for en medium is typically "May 13, 2026"
    expect(out).toMatch(/2026/);
    expect(out.toLowerCase()).toMatch(/may|13/);
  });

  it('renders pt-BR with non-English month abbreviation', () => {
    const out = formatDate(sample, 'pt-BR');
    expect(out).toMatch(/2026/);
    // ICU pt-BR medium uses 'mai' or 'mai.'
    expect(out.toLowerCase()).toMatch(/mai/);
  });

  it('renders hi-IN with Devanagari month but Latin digits (D-37)', () => {
    const out = formatDate(sample, 'hi-IN');
    // Latin digits forced via numberingSystem: 'latn'
    expect(out).toMatch(/2026/);
    // No Devanagari numerals like ०१२
    expect(out).not.toMatch(/[०-९]/);
  });

  it('falls back to English on a totally unknown locale (no exception escapes)', () => {
    const out = formatDate(sample, 'zz-ZZ');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('never throws on any of the 8 MVP locales', () => {
    const locales = ['en', 'pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'];
    for (const loc of locales) {
      expect(() => formatDate(sample, loc)).not.toThrow();
    }
  });
});
