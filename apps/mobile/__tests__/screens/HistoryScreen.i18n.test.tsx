// 07-11 G-07 closure — HistoryScreen's `filterChipLabel` returns translated
// strings for every NamedRange. Two structural checks:
//
//   Test 1: source-grep — HistoryScreen.tsx no longer returns the historical
//           hardcoded 'Today' / 'Yesterday' / 'This week' / 'This month'
//           literals; the switch routes to `t('history.filter.*')`.
//   Test 2: every NamedRange the switch handles has a corresponding
//           non-empty en.json key under `history.filter.*`.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import enCatalog from '../../src/i18n/locales/en.json';

const SOURCE = readFileSync(
  resolve(import.meta.dirname, '../../src/screens/history/HistoryScreen.tsx'),
  'utf8',
);

describe('HistoryScreen filterChipLabel — 07-11 G-07', () => {
  it('no `return <English literal>` survives for the named-range branches', () => {
    expect(SOURCE).not.toMatch(/return 'Today'/);
    expect(SOURCE).not.toMatch(/return 'Yesterday'/);
    expect(SOURCE).not.toMatch(/return 'This week'/);
    expect(SOURCE).not.toMatch(/return 'This month'/);
    expect(SOURCE).not.toMatch(/return 'All time'/);
  });

  it('every named-range branch routes through t(history.filter.*)', () => {
    expect(SOURCE).toContain("t('history.filter.today')");
    expect(SOURCE).toContain("t('history.filter.yesterday')");
    expect(SOURCE).toContain("t('history.filter.thisWeek')");
    expect(SOURCE).toContain("t('history.filter.thisMonth')");
    expect(SOURCE).toContain("t('history.filter.allTime')");
    // Plan 07-17 G-21: the chip label key was renamed from `customRange`
    // (string) to `customRangeChip` to make room for the new object-valued
    // `customRange` carrying the Custom-range sub-sheet's 9 sub-keys.
    expect(SOURCE).toContain("t('history.filter.customRangeChip')");
  });

  it('en.json carries non-empty values for every history.filter.* key', () => {
    const f = enCatalog.history.filter;
    expect(f.today).toBe('Today');
    expect(f.yesterday).toBe('Yesterday');
    expect(f.thisWeek).toBe('This week');
    expect(f.thisMonth).toBe('This month');
    expect(f.allTime).toBe('All time');
    // Plan 07-17 G-21: same English value, renamed key (see comment above).
    expect((f as Record<string, unknown>).customRangeChip).toBe('Custom range');
    // The Custom-range sub-sheet's 9-sub-key object lives here now.
    expect((f.customRange as Record<string, string>).title).toBe('Custom range');
  });
});
