// HistoryRow — Plan 07-16 Task 4b G-28 parts 1+2 (uploadedAt + FEEDBACK).
//
// The contract: the visible "Uploaded at HH:MM" + "Feedback (coming soon)"
// strings now route through the en.json `history.row.*` keys. Pins the en
// values and confirms the i18n key shape.
import { describe, it, expect } from 'vitest';
import i18n from '../../src/i18n';
import enJson from '../../src/i18n/locales/en.json';

describe('HistoryRow — Plan 07-16 G-28 part 1+2 (uploadedAt + FEEDBACK)', () => {
  it('en.json has the new history.row.uploadedAt key with {{time}} interpolation', () => {
    expect(enJson.history.row.uploadedAt).toBe('Uploaded at {{time}}');
  });

  it('en.json has history.row.feedbackComingSoon', () => {
    expect(enJson.history.row.feedbackComingSoon).toBe('Feedback (coming soon)');
  });

  it('i18n.t resolves uploadedAt with {{time}} interpolation in en', () => {
    void i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    expect(t('history.row.uploadedAt', { time: '14:23' })).toBe('Uploaded at 14:23');
  });
});
