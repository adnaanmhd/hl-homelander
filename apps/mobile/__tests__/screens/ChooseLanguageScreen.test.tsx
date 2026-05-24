// ChooseLanguageScreen — Phase 7 plan 07-04 Task 1 contract (I18N-02 + I18N-03).
//
// Three behaviours pin the design carve-out #2:
//   Test 1: renders all 8 language rows (D-19 row presentation).
//   Test 2: Continue with default selection (English) commits both MMKV
//           keys + calls navigation.replace('Signup').
//   Test 3: tapping a different row then Continue commits THAT locale +
//           calls i18n.changeLanguage(loc).
//
// Test path under `apps/mobile/__tests__/screens/` matches the existing
// convention (e.g. RigTutorialScreen.test.tsx) — see 07-01-SUMMARY.md /
// 07-03-SUMMARY.md Rule-3 deviation re: plan-stated `src/.../__tests__/`
// paths being outside the vitest include glob.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

const { mockReplace, mockLogEvent } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockLogEvent: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children as React.ReactElement,
  useNavigation: () => ({ replace: mockReplace }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
  useIsFocused: () => true,
}));

vi.mock('../../src/util/analytics', () => ({
  logEvent: mockLogEvent,
  EVENT_NAMES: ['locale_chosen', 'locale_changed'],
}));

// useAppStore mock — selector pattern (matches RigTutorialScreen.test.tsx).
vi.mock('../../src/state/appStore', () => {
  const state = { installationId: 'inst-uuid-1' };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

// Import AFTER mocks so the screen sees the mocked deps.
import ChooseLanguageScreen from '../../src/screens/chooseLanguage/ChooseLanguageScreen';
import { localeMmkv, LOCALE_KEYS } from '../../src/i18n/storage';
import i18n from '../../src/i18n';

describe('ChooseLanguageScreen — Phase 7 plan 07-04 (I18N-02 / D-22)', () => {
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
    // Reset i18n active language to 'en' so test 3's changeLanguage
    // assertion observes the FROM→TO transition cleanly.
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('Test 1: renders all 8 language rows in D-18 order', () => {
    const { getByLabelText } = render(<ChooseLanguageScreen />);
    expect(getByLabelText('language-row-en')).toBeTruthy();
    expect(getByLabelText('language-row-pt-BR')).toBeTruthy();
    expect(getByLabelText('language-row-es')).toBeTruthy();
    expect(getByLabelText('language-row-hi-IN')).toBeTruthy();
    expect(getByLabelText('language-row-bn-IN')).toBeTruthy();
    expect(getByLabelText('language-row-ta-IN')).toBeTruthy();
    expect(getByLabelText('language-row-te-IN')).toBeTruthy();
    expect(getByLabelText('language-row-mr-IN')).toBeTruthy();
  });

  it('Test 2: Continue with English (default) commits MMKV + replaces to Signup', () => {
    const { getByLabelText } = render(<ChooseLanguageScreen />);
    fireEvent.click(getByLabelText('choose-language-continue'));
    expect(localeMmkv.getString(LOCALE_KEYS.CODE)).toBe('en');
    // ISO timestamp — YYYY-MM-DDTHH:MM:SS.sssZ
    expect(localeMmkv.getString(LOCALE_KEYS.CHOSEN_AT)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('Signup');
    expect(mockLogEvent).toHaveBeenCalledWith('locale_chosen', {
      installation_id: 'inst-uuid-1',
      chosen_locale: 'en',
    });
  });

  it('Test 3: tapping hi-IN then Continue commits hi-IN + i18n.changeLanguage(hi-IN)', async () => {
    const { getByLabelText } = render(<ChooseLanguageScreen />);
    fireEvent.click(getByLabelText('language-row-hi-IN'));
    fireEvent.click(getByLabelText('choose-language-continue'));
    // Allow the void-Promise i18n.changeLanguage(...) to resolve.
    await new Promise((r) => setTimeout(r, 0));
    expect(localeMmkv.getString(LOCALE_KEYS.CODE)).toBe('hi-IN');
    expect(i18n.language).toBe('hi-IN');
    expect(mockLogEvent).toHaveBeenCalledWith(
      'locale_chosen',
      expect.objectContaining({ chosen_locale: 'hi-IN' }),
    );
  });
});
