// HistoryScreen empty-state trailing literal — Plan 07-17 Task 2 G-20.
//
// Pins the en.json contract for the new `history.empty.firstTime.bodyTail`
// key + the source-grep that HistoryScreen.tsx:599 no longer has the JSX
// literal ` and try one.` outside a `t()` call. Mirrors the 07-16 base
// HistoryScreen.empty.i18n.test.tsx pattern.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import i18n from '../../../src/i18n';
import enJson from '../../../src/i18n/locales/en.json';

const SOURCE = readFileSync(
  resolve(import.meta.dirname, '../../../src/screens/history/HistoryScreen.tsx'),
  'utf8',
);

describe('HistoryScreen empty-state bodyTail — Plan 07-17 G-20 (i18n)', () => {
  it('en.json carries the new history.empty.firstTime.bodyTail key with leading space', () => {
    expect(enJson.history.empty.firstTime.bodyTail).toBe(' and try one.');
  });

  it('the new bodyTail key resolves to a non-empty en string (no missing-key)', () => {
    void i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    const v = t('history.empty.firstTime.bodyTail');
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toBe('history.empty.firstTime.bodyTail');
  });

  it('HistoryScreen.tsx no longer carries the JSX literal " and try one." (G-20 close)', () => {
    // The trailing English literal was at line 599 in the firstTime empty-state
    // body. After the fix it lives inside the new bodyTail i18n key.
    expect(SOURCE).not.toMatch(/and try one\./);
  });

  it('HistoryScreen.tsx wires the new t(history.empty.firstTime.bodyTail) call', () => {
    expect(SOURCE).toContain("t('history.empty.firstTime.bodyTail')");
  });
});
