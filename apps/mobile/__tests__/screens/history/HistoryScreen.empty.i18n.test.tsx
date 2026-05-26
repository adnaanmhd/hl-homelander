// HistoryScreen empty-state — Plan 07-16 Task 4b G-20.
//
// Pins en.json i18n key shape for the two empty states (firstTime vs filtered)
// without rendering the full screen (which depends on multiple zustand slices,
// native modules, and the upload-queue subscription).
import { describe, it, expect } from 'vitest';
import i18n from '../../../src/i18n';
import enJson from '../../../src/i18n/locales/en.json';

describe('HistoryScreen empty state — Plan 07-16 G-20 (i18n)', () => {
  it('en.json carries the 6 history.empty.{firstTime|filtered}.{heading|body|cta} keys', () => {
    expect(enJson.history.empty.firstTime.heading).toBe('Your recordings will live here.');
    expect(enJson.history.empty.firstTime.body).toBe("You haven't recorded anything yet.");
    expect(enJson.history.empty.firstTime.cta).toBe('Pick a task');
    expect(enJson.history.empty.filtered.heading).toBe('No recordings in this range.');
    expect(enJson.history.empty.filtered.body).toBe('No recordings in this range.');
    expect(enJson.history.empty.filtered.cta).toBe('Show all time');
  });

  it('all 6 empty-state keys resolve to non-empty en strings (no missing-key)', () => {
    void i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    const KEYS = [
      'history.empty.firstTime.heading',
      'history.empty.firstTime.body',
      'history.empty.firstTime.cta',
      'history.empty.filtered.heading',
      'history.empty.filtered.body',
      'history.empty.filtered.cta',
    ];
    for (const k of KEYS) {
      const v = t(k);
      expect(v.length, `${k} non-empty`).toBeGreaterThan(0);
      expect(v, `${k} not raw key`).not.toBe(k);
    }
  });

  it('legacy flat history.emptyHeading and history.emptyBody are removed from en.json', () => {
    // Plan 07-16 Task 4b step 0 (per checker N-NEW-1) removed these because
    // no code path consumed them. The Task-5 LLM regen propagates the
    // removal to the 7 non-en catalogs.
    expect((enJson.history as Record<string, unknown>).emptyHeading).toBeUndefined();
    expect((enJson.history as Record<string, unknown>).emptyBody).toBeUndefined();
  });
});
