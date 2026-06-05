// Plan 04-06 — PracticeCompleteScreen contract (ONB-07 + ONB-08, design-spec §8).
//
// Six behaviours through the JSDOM host-component shim (vitest.setup.ts):
//
// Test 1: Verbatim §8 heading "You got it." + "Continue" CTA + the 96×96
//         success badge render.
// Test 2: practice_complete_shown analytics event fires once on mount.
// Test 3: Vibration.vibrate([0, 40, 80, 40]) fires on mount (the §6.2
//         practice-done [40,80,40]ms haptic; the leading 0 = no initial wait).
// Test 4: Tap "Continue" → setPracticeDone(<sub from JWT>) is called, then
//         practice_complete_continued fires, then the parent navigator's
//         reset({ index: 0, routes: [{ name: 'MainTabs' }] }) is called.
// Test 5: setPracticeDone is called BEFORE navigation.reset (the ONB-08 flag
//         write must land before we leave the screen).
// Test 6: Falls back to the local navigator.reset when getParent() lacks reset.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockSetPracticeDone,
  mockReset,
  mockParentReset,
  mockGetParent,
  mockLogEvent,
  mockVibrate,
  mockPostPracticeComplete,
  FAKE_JWT,
} = vi.hoisted(() => {
  // JWT with sub="practice-sub-99" so decodeGoogleSubFromJwt returns it.
  const json = JSON.stringify({ sub: 'practice-sub-99' });
  const b64 = (
    globalThis as { Buffer?: { from(d: string, e: string): { toString(e: string): string } } }
  )
    .Buffer!.from(json, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return {
    mockSetPracticeDone: vi.fn(),
    mockReset: vi.fn(),
    mockParentReset: vi.fn(),
    mockGetParent: vi.fn(),
    mockLogEvent: vi.fn(),
    mockVibrate: vi.fn(),
    // Returns a resolved promise so the screen's `void postPracticeComplete()
    // .catch(...)` has a thenable to chain (Bug 5 / D7).
    mockPostPracticeComplete: vi.fn(() =>
      Promise.resolve({ practiceCompletedAt: '2026-06-04T00:00:00.000Z' }),
    ),
    FAKE_JWT: `header.${b64}.signature`,
  };
});

// react-native shim extension — add Vibration.vibrate as a spy. Mirrors the
// canonical Phase 2 host-component shim from vitest.setup.ts (RigTutorialScreen
// test does the same trick for Linking.openURL).
vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const React_ = ReactModule;
  function resolveStyle(value: unknown): Record<string, unknown> | undefined {
    if (value == null || value === false) return undefined;
    if (typeof value === 'function') {
      return resolveStyle((value as (s: { pressed: boolean }) => unknown)({ pressed: false }));
    }
    if (Array.isArray(value)) {
      const merged: Record<string, unknown> = {};
      for (const entry of value) {
        const r = resolveStyle(entry);
        if (r) Object.assign(merged, r);
      }
      return Object.keys(merged).length ? merged : undefined;
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return undefined;
  }
  function makeComponent(name: string) {
    return React_.forwardRef<
      HTMLDivElement,
      Record<string, unknown> & { children?: React.ReactNode }
    >(function HostComponent(props, ref) {
      const { children, accessibilityLabel, accessibilityRole, onPress, style, ...rest } = props;
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
      if (typeof onPress === 'function') dom['onClick'] = onPress;
      const resolved = resolveStyle(style);
      if (resolved) dom['style'] = resolved;
      return React_.createElement('div', dom, children as React.ReactNode);
    });
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    ScrollView: makeComponent('ScrollView'),
    Image: makeComponent('Image'),
    StatusBar: () => null,
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      flatten: (s: unknown) => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select: (o: { android?: unknown; default?: unknown }) => o.android ?? o.default,
    },
    Vibration: {
      vibrate: mockVibrate,
      cancel: vi.fn(),
    },
  };
});

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    reset: mockReset,
    getParent: mockGetParent,
    replace: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('../../src/state/appStore', () => {
  const state = { jwt: FAKE_JWT, setPracticeDone: mockSetPracticeDone };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

vi.mock('../../src/util/analytics', () => ({
  logEvent: mockLogEvent,
  EVENT_NAMES: ['practice_complete_shown', 'practice_complete_continued'],
}));

// Bug 5 / D7 — mock profileService so the real api.ts → navigationRef import
// chain isn't pulled (this file's local @react-navigation/native mock omits
// createNavigationContainerRef), and so we can assert the server write fires.
vi.mock('../../src/services/profileService', () => ({
  postPracticeComplete: mockPostPracticeComplete,
}));

import PracticeCompleteScreen from '../../src/screens/tutorial/PracticeCompleteScreen';

describe('PracticeCompleteScreen (plan 04-06 — ONB-07 + ONB-08, design-spec §8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetParent.mockReturnValue({ reset: mockParentReset });
  });
  afterEach(() => cleanup());

  it('Test 1: renders "You got it." + "Continue" CTA + the success badge', () => {
    const { getByText, getByLabelText } = render(<PracticeCompleteScreen />);
    expect(getByText('You got it.')).toBeTruthy();
    expect(getByLabelText('Continue')).toBeTruthy();
    expect(getByLabelText('practice complete badge')).toBeTruthy();
  });

  it('Test 2: practice_complete_shown fires once on mount', () => {
    render(<PracticeCompleteScreen />);
    expect(mockLogEvent).toHaveBeenCalledWith('practice_complete_shown');
    expect(mockLogEvent.mock.calls.filter((c) => c[0] === 'practice_complete_shown')).toHaveLength(
      1,
    );
  });

  it('Test 3: Vibration.vibrate([0, 40, 80, 40]) fires on mount', () => {
    render(<PracticeCompleteScreen />);
    expect(mockVibrate).toHaveBeenCalledTimes(1);
    expect(mockVibrate).toHaveBeenCalledWith([0, 40, 80, 40]);
  });

  it('Test 4: tap Continue → setPracticeDone(sub) → practice_complete_continued → parent.reset(MainTabs)', () => {
    const { getByLabelText } = render(<PracticeCompleteScreen />);
    fireEvent.click(getByLabelText('Continue'));
    expect(mockSetPracticeDone).toHaveBeenCalledWith('practice-sub-99');
    // Bug 5 / D7 — also persists completion server-side (best-effort).
    expect(mockPostPracticeComplete).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith('practice_complete_continued');
    expect(mockParentReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('Test 5: setPracticeDone is called before navigation.reset', () => {
    const { getByLabelText } = render(<PracticeCompleteScreen />);
    fireEvent.click(getByLabelText('Continue'));
    const setOrder = mockSetPracticeDone.mock.invocationCallOrder[0]!;
    const resetOrder = mockParentReset.mock.invocationCallOrder[0]!;
    expect(setOrder).toBeLessThan(resetOrder);
  });

  it('Test 6: falls back to local navigator.reset when getParent() lacks reset', () => {
    mockGetParent.mockReturnValue(undefined);
    const { getByLabelText } = render(<PracticeCompleteScreen />);
    fireEvent.click(getByLabelText('Continue'));
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });
});
