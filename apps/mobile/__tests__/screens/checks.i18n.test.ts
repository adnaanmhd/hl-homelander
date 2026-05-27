// 07-11 G-02 closure — CompatRunningScreen labels source-of-truth contract.
//
// The plan renames the CHECKS-row field from `label: string` (hardcoded
// English) to `labelKey: string` (i18n key path under `compat.checkLabels.*`)
// so CompatRunningScreen renders translated rows. These two structural tests
// pin the contract:
//
//   Test 1: every DISPLAY_ROWS row carries a `labelKey`, NOT a `label`.
//   Test 2: every labelKey resolves to a non-empty string under en.json's
//           `compat.checkLabels.*` namespace.
//
// Plan's frontmatter pointed at `src/screens/compat/__tests__/` but vitest's
// include glob is `apps/mobile/__tests__/**/*.test.ts[x]` (see 07-04 /
// 07-05 SUMMARY Rule-3 deviation). File lives where the existing
// CompatRunningScreen.test.tsx lives.

import { describe, it, expect } from 'vitest';

import { DISPLAY_ROWS } from '../../src/screens/compat/checks';
import enCatalog from '../../src/i18n/locales/en.json';

const EXPECTED_KEYS = [
  'compat.checkLabels.ultrawide',
  'compat.checkLabels.resolutionFps',
  'compat.checkLabels.motionSensors',
  'compat.checkLabels.imuStable',
  'compat.checkLabels.mic',
  'compat.checkLabels.realtime',
  'compat.checkLabels.integrity',
] as const;

function resolveDottedKey(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, seg) => {
    if (acc != null && typeof acc === 'object' && seg in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[seg];
    }
    return undefined;
  }, obj);
}

describe('CompatRunningScreen DISPLAY_ROWS — 07-11 G-02', () => {
  it('every row carries `labelKey` and NOT a bare `label` field', () => {
    expect(DISPLAY_ROWS.length).toBe(7);
    for (const row of DISPLAY_ROWS) {
      expect(typeof row.labelKey).toBe('string');
      expect(row.labelKey.startsWith('compat.checkLabels.')).toBe(true);
      // No `label` field — the rename is total, not duplicated.
      expect((row as Record<string, unknown>).label).toBeUndefined();
    }
  });

  it('every labelKey resolves to a non-empty string in en.json', () => {
    for (const key of EXPECTED_KEYS) {
      const resolved = resolveDottedKey(enCatalog, key);
      expect(typeof resolved).toBe('string');
      expect((resolved as string).length).toBeGreaterThan(0);
    }
  });

  it('DISPLAY_ROWS labelKeys match the expected en.json paths in order', () => {
    const got = DISPLAY_ROWS.map((r) => r.labelKey);
    expect(got).toEqual(EXPECTED_KEYS);
  });
});
