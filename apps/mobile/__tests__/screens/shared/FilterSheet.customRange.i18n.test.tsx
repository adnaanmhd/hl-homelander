// FilterSheet Custom-range sub-sheet — Plan 07-17 Task 2 G-21.
//
// Pins the en.json contract for the 9 new
// `history.filter.customRange.{title,from,to,placeholder,errorMissing,
// errorInverted,errorFuture,cancel,apply}` keys + the schema-breaking rename
// of the existing string `history.filter.customRange` -> `customRangeChip`
// (preserves the chip-versus-sub-sheet semantic distinction). Mirrors the
// 07-16 base FilterSheet.i18n.test.tsx pattern.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import i18n from '../../../src/i18n';
import enJson from '../../../src/i18n/locales/en.json';

const FILTER_SHEET_SOURCE = readFileSync(
  resolve(import.meta.dirname, '../../../src/screens/shared/FilterSheet.tsx'),
  'utf8',
);
const HISTORY_SCREEN_SOURCE = readFileSync(
  resolve(import.meta.dirname, '../../../src/screens/history/HistoryScreen.tsx'),
  'utf8',
);

describe('FilterSheet Custom-range sub-sheet — Plan 07-17 G-21 (i18n)', () => {
  it('en.json carries the 9 new history.filter.customRange.* sub-keys', () => {
    const cr = enJson.history.filter.customRange as Record<string, string>;
    expect(cr.title).toBe('Custom range');
    expect(cr.from).toBe('FROM');
    expect(cr.to).toBe('TO');
    expect(cr.placeholder).toBe('Pick a date');
    expect(cr.errorMissing).toBe('Pick both dates.');
    expect(cr.errorInverted).toBe('"From" date must be before "To" date.');
    expect(cr.errorFuture).toBe("Dates can't be in the future.");
    expect(cr.cancel).toBe('Cancel');
    expect(cr.apply).toBe('Apply');
  });

  it('en.json carries the renamed history.filter.customRangeChip string for the base-sheet chip', () => {
    expect((enJson.history.filter as Record<string, unknown>).customRangeChip).toBe('Custom range');
  });

  it('all 9 customRange sub-keys resolve to non-empty en strings (no missing-key)', () => {
    void i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    const KEYS = [
      'history.filter.customRange.title',
      'history.filter.customRange.from',
      'history.filter.customRange.to',
      'history.filter.customRange.placeholder',
      'history.filter.customRange.errorMissing',
      'history.filter.customRange.errorInverted',
      'history.filter.customRange.errorFuture',
      'history.filter.customRange.cancel',
      'history.filter.customRange.apply',
    ];
    for (const k of KEYS) {
      const v = t(k);
      expect(v.length, `${k} non-empty`).toBeGreaterThan(0);
      expect(v, `${k} not raw key`).not.toBe(k);
    }
  });

  it('FilterSheet.tsx Custom-range sub-sheet has no hardcoded English literals (G-21 close)', () => {
    // The 9 literals at lines 294/295/296/301/305/317/334/346/375/385 must
    // all be removed (they now live behind t() calls).
    expect(FILTER_SHEET_SOURCE).not.toContain("'Pick both dates.'");
    expect(FILTER_SHEET_SOURCE).not.toContain('\'"From" date must be before "To" date.\'');
    expect(FILTER_SHEET_SOURCE).not.toContain('"Dates can\'t be in the future."');
    // The 4 inline JSX strings (title, FROM/TO labels, picker placeholders):
    expect(FILTER_SHEET_SOURCE).not.toMatch(/>\s*Custom range\s*</);
    expect(FILTER_SHEET_SOURCE).not.toMatch(/>\s*FROM\s*</);
    expect(FILTER_SHEET_SOURCE).not.toMatch(/>\s*TO\s*</);
    expect(FILTER_SHEET_SOURCE).not.toMatch(/:\s*'Pick a date'/);
    // The 2 button labels (Cancel/Apply) at lines 375/385:
    expect(FILTER_SHEET_SOURCE).not.toMatch(/>\s*Cancel\s*</);
    expect(FILTER_SHEET_SOURCE).not.toMatch(/>\s*Apply\s*</);
  });

  it('FilterSheet.tsx wires t(history.filter.customRange.*) for each sub-key', () => {
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.title')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.from')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.to')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.placeholder')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.errorMissing')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.errorInverted')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.errorFuture')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.cancel')");
    expect(FILTER_SHEET_SOURCE).toContain("t('history.filter.customRange.apply')");
  });

  it('FilterSheet.tsx OPTIONS array routes the base-sheet chip through customRangeChip', () => {
    expect(FILTER_SHEET_SOURCE).toContain("'history.filter.customRangeChip'");
  });

  it('HistoryScreen.tsx filterChipLabel routes through the renamed customRangeChip key', () => {
    expect(HISTORY_SCREEN_SOURCE).toContain("t('history.filter.customRangeChip')");
  });

  it('FilterSheet.tsx Cancel + Apply raw Text elements receive overflow guards (G-22 inline)', () => {
    // Cancel + Apply at lines 369-388 are raw <Pressable>+<Text>, not the
    // shared <Button> primitive. Task 2 G-21 step 3 inlines the same overflow
    // guards on those two raw Text elements so Devanagari labels render
    // identically across ReportProblem (Button consumer) and FilterSheet
    // Custom-range (raw Text).
    expect(FILTER_SHEET_SOURCE).toContain('numberOfLines={1}');
    expect(FILTER_SHEET_SOURCE).toContain('adjustsFontSizeToFit');
    expect(FILTER_SHEET_SOURCE).toContain('minimumFontScale={0.75}');
  });
});
