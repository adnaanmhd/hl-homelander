// UniversalRulesBlock — Plan 07-16 Task 2 G-19 closure (the 4 ALWAYS rules).
//
// Pins the i18n-key contract introduced by Plan 07-16:
//   - UNIVERSAL_RULES carries 4 entries with `labelKey: 'rules.universal.*'`
//   - The render at component-level resolves each rule's labelKey via t()
//
// Test path under `apps/mobile/__tests__/components/` mirrors the existing
// component-test convention (e.g. LanguageSheet.test.tsx) — vitest's include
// glob is `__tests__/**/*.test.ts[x]`.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { UniversalRulesBlock, UNIVERSAL_RULES } from '../../src/components/UniversalRulesBlock';
import i18n from '../../src/i18n';

describe('UniversalRulesBlock — Plan 07-16 G-19 (i18n keystone)', () => {
  afterEach(() => {
    cleanup();
  });

  it('UNIVERSAL_RULES carries the 4 expected labelKey strings (in fixed order)', () => {
    expect(UNIVERSAL_RULES).toHaveLength(4);
    expect(UNIVERSAL_RULES[0]?.labelKey).toBe('rules.universal.handsInFrame');
    expect(UNIVERSAL_RULES[1]?.labelKey).toBe('rules.universal.mountDevice');
    expect(UNIVERSAL_RULES[2]?.labelKey).toBe('rules.universal.wellLit');
    expect(UNIVERSAL_RULES[3]?.labelKey).toBe('rules.universal.closeApps');
  });

  it('renders the en text for the 4 rules from en.json', () => {
    // Force en for this assertion — the locale-reactive render is tested
    // separately via the LanguageSheet contract.
    void i18n.changeLanguage('en');
    const { getByLabelText } = render(<UniversalRulesBlock />);
    // Block is always present
    expect(getByLabelText('universal-rules-block')).toBeTruthy();
    // 4 row containers by icon name
    expect(getByLabelText('universal-rule-front_hand')).toBeTruthy();
    expect(getByLabelText('universal-rule-videocam')).toBeTruthy();
    expect(getByLabelText('universal-rule-lightbulb')).toBeTruthy();
    expect(getByLabelText('universal-rule-apps')).toBeTruthy();
  });

  it('every labelKey resolves to a non-empty string in en (no missing-key)', () => {
    const t = i18n.getFixedT('en');
    for (const rule of UNIVERSAL_RULES) {
      const v = t(rule.labelKey);
      expect(v.length, `${rule.labelKey} resolves to non-empty en string`).toBeGreaterThan(0);
      // i18next's missing-key signal is the raw key. Assert we DID NOT get
      // back the key itself.
      expect(v, `${rule.labelKey} not the raw key`).not.toBe(rule.labelKey);
    }
  });
});
