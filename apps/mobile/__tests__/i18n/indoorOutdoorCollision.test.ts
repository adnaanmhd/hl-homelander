// Indoor/Outdoor collision regression — Plan 07-17 Task 5a G-24.
//
// Asserts that `tasks.setting.indoor !== tasks.setting.outdoor` for every
// locale in SUPPORTED_LOCALES. The operator's hi-IN walk surfaced both
// values rendering as `घर के` (visual truncation, NOT a real value collision
// — Task 1 confirmed the values are distinct). This test exists as a
// PERMANENT regression guard: if a future LLM regen produces actually-
// identical values for both keys, the test fails immediately rather than
// waiting for an operator to spot it on hardware.
//
// 8 locales × 2 keys = 16 assertions per `it` block; the test loops once per
// locale producing one `it` per locale for clean failure output.
import { describe, it, expect } from 'vitest';
import i18n from '../../src/i18n';
import { SUPPORTED_LOCALES } from '../../src/i18n/storage';

describe('i18n indoor/outdoor collision regression — Plan 07-17 G-24', () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`indoor and outdoor are distinct + non-empty in ${locale}`, () => {
      const t = i18n.getFixedT(locale);
      const indoor = t('tasks.setting.indoor');
      const outdoor = t('tasks.setting.outdoor');
      expect(indoor.length, `${locale} indoor non-empty`).toBeGreaterThan(0);
      expect(outdoor.length, `${locale} outdoor non-empty`).toBeGreaterThan(0);
      expect(indoor, `${locale} indoor not raw key`).not.toBe('tasks.setting.indoor');
      expect(outdoor, `${locale} outdoor not raw key`).not.toBe('tasks.setting.outdoor');
      expect(indoor, `${locale} indoor !== outdoor`).not.toBe(outdoor);
    });
  }
});
