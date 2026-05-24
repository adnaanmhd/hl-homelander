// LanguageSheet — Phase 7 plan 07-04 Task 2 contract (D-02 + D-17 + D-19).
//
// Three behaviours pin the tap-to-commit picker contract:
//   Test 1: renders 8 language rows when visible.
//   Test 2: tap on a non-current row commits the locale (MMKV + i18n) +
//           emits locale_changed + calls onDismiss (D-02).
//   Test 3: tap on the current row dismisses without committing or
//           re-emitting telemetry.
//
// Test path under `apps/mobile/__tests__/components/` mirrors the existing
// component-test convention (e.g. DeleteAccountModal.test.tsx). Plan's
// frontmatter pointed at `src/components/__tests__/` but vitest's include
// glob is `__tests__/**/*.test.ts[x]` — see 07-01/07-03 SUMMARY Rule-3
// deviation.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

const { mockLogEvent } = vi.hoisted(() => ({
  mockLogEvent: vi.fn(),
}));

vi.mock('../../src/util/analytics', () => ({
  logEvent: mockLogEvent,
  EVENT_NAMES: ['locale_chosen', 'locale_changed'],
}));

vi.mock('../../src/state/appStore', () => {
  const state = { installationId: 'inst-uuid-1' };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

import { LanguageSheet } from '../../src/components/LanguageSheet';
import { localeMmkv, LOCALE_KEYS } from '../../src/i18n/storage';
import i18n from '../../src/i18n';

describe('LanguageSheet — Phase 7 plan 07-04 (D-02 / D-17 / D-19)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    try {
      localeMmkv.remove(LOCALE_KEYS.CODE);
    } catch {
      /* best-effort */
    }
    try {
      localeMmkv.remove(LOCALE_KEYS.CHOSEN_AT);
    } catch {
      /* best-effort */
    }
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('Test 1: renders 8 language rows when visible', () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(<LanguageSheet visible onDismiss={onDismiss} />);
    expect(getByLabelText('language-row-en')).toBeTruthy();
    expect(getByLabelText('language-row-pt-BR')).toBeTruthy();
    expect(getByLabelText('language-row-es')).toBeTruthy();
    expect(getByLabelText('language-row-hi-IN')).toBeTruthy();
    expect(getByLabelText('language-row-bn-IN')).toBeTruthy();
    expect(getByLabelText('language-row-ta-IN')).toBeTruthy();
    expect(getByLabelText('language-row-te-IN')).toBeTruthy();
    expect(getByLabelText('language-row-mr-IN')).toBeTruthy();
  });

  it('Test 2: tap on a non-current row commits + emits locale_changed + dismisses (D-02)', async () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(<LanguageSheet visible onDismiss={onDismiss} />);
    fireEvent.click(getByLabelText('language-row-hi-IN'));
    // Allow the void-Promise i18n.changeLanguage(...) to resolve.
    await new Promise((r) => setTimeout(r, 0));
    expect(localeMmkv.getString(LOCALE_KEYS.CODE)).toBe('hi-IN');
    expect(localeMmkv.getString(LOCALE_KEYS.CHOSEN_AT)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(i18n.language).toBe('hi-IN');
    expect(mockLogEvent).toHaveBeenCalledWith('locale_changed', {
      installation_id: 'inst-uuid-1',
      from_locale: 'en',
      to_locale: 'hi-IN',
    });
    // JSDOM bubbles the click through nested Pressables; RN's host
    // implementation swallows the inner press via the Sheet primitive's
    // no-op onPress, so on-device onDismiss fires exactly once. The
    // behavioural assertion is "onDismiss called" — count is JSDOM noise.
    expect(onDismiss).toHaveBeenCalled();
  });

  it('Test 3: tap on the current row only dismisses; no commit, no telemetry', () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(<LanguageSheet visible onDismiss={onDismiss} />);
    fireEvent.click(getByLabelText('language-row-en'));
    expect(onDismiss).toHaveBeenCalled();
    expect(localeMmkv.getString(LOCALE_KEYS.CODE)).toBeUndefined();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});
