// HomeScreen tileLabel — Plan 07-16 Task 4a G-16 closure.
//
// Pins the i18n contract for the 6 named-range tile labels and the chevron-
// in-JSX template choice (BLOCKER 1 fix). The 6 `home.filter.*` en values are
// chevron-stripped; the `▾` lives in the JSX template.
//
// We test the contract via i18n.t() against en.json directly rather than
// rendering the full HomeScreen (which depends on the upload-queue
// subscription + zustand store + native modules). The tileLabel function is
// internal to HomeScreen.tsx; this file pins the i18n contract it consumes.
import { describe, it, expect } from 'vitest';
import i18n from '../../../src/i18n';
import enJson from '../../../src/i18n/locales/en.json';

describe('HomeScreen tileLabel — Plan 07-16 G-16 (i18n)', () => {
  it('en.json `home.filter.*` carries 6 chevron-stripped values', () => {
    expect(enJson.home.filter.today).toBe('today');
    expect(enJson.home.filter.yesterday).toBe('yesterday');
    expect(enJson.home.filter.thisWeek).toBe('this week');
    expect(enJson.home.filter.thisMonth).toBe('this month');
    // Rename: en.json was `all: "all time ▾"` → `allTime: "all time"`.
    expect(enJson.home.filter.allTime).toBe('all time');
    expect(enJson.home.filter.customRange).toBe('custom range');
  });

  it('NONE of the 6 home.filter en values carry the chevron glyph', () => {
    const f = enJson.home.filter;
    expect(f.today).not.toContain('▾');
    expect(f.yesterday).not.toContain('▾');
    expect(f.thisWeek).not.toContain('▾');
    expect(f.thisMonth).not.toContain('▾');
    expect(f.allTime).not.toContain('▾');
    expect(f.customRange).not.toContain('▾');
  });

  it('every named-range key resolves to a non-null en string', () => {
    void i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    const KEYS = [
      'home.filter.today',
      'home.filter.yesterday',
      'home.filter.thisWeek',
      'home.filter.thisMonth',
      'home.filter.allTime',
      'home.filter.customRange',
    ];
    for (const k of KEYS) {
      const v = t(k);
      expect(v.length, `${k} non-empty`).toBeGreaterThan(0);
      expect(v, `${k} not the raw key`).not.toBe(k);
    }
  });
});
