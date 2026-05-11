// Plan 04-06 — practice-tutorial chain integration test (ONB-03 / ONB-07 / ONB-08).
//
// Asserts the wired onboarding chain end-to-end at the screen level:
//
//   RigTutorial --[Next]--> PracticeIntro --[Start practice]--> Recording
//     --(practice mode, plan 04-07)--> PracticeComplete --[Continue]-->
//     MainTabs (via navigation.reset)  +  the per-account ONB-08 flag write.
//
// (a) RigTutorialScreen "Next" → navigation.replace('PracticeIntro') — the
//     retarget landed in plan 04-03; here we re-assert the route arg is
//     'PracticeIntro', NOT 'MainTabs' (the pre-Phase-4 target).
// (b) PracticeIntroScreen "Start practice" → navigation leaves OnboardingStack
//     to 'Recording' with { taskId: '__practice__', taskName:
//     'Practice — 60 sec', isPractice: true }.
// (c) PracticeCompleteScreen "Continue" → setPracticeDone(<sub>) THEN
//     navigation.reset({ routes: [{ name: 'MainTabs' }] }) + Vibration.vibrate
//     ([0,40,80,40]) on enter.
// (d) The screen-level write feeds the boot-level read: PracticeComplete writes
//     `practiceDoneKey(sub)` and computeInitialRoute returns 'MainTabs' when
//     that key is set / 'RigTutorial' when it is not. (The deep version of
//     this lives in __tests__/state/initialRoute.test.ts from plan 04-03;
//     here we just confirm the same key the screen writes is the key the boot
//     gate reads.)
//
// Each screen is rendered with its own mocked navigation; the RN host shim is
// declared inline (RigTutorial imports Linking + Image; PracticeComplete
// imports Vibration). Mocking conventions mirror the existing screen tests.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockReplace,
  mockParentReplace,
  mockReset,
  mockParentReset,
  mockGetParent,
  mockSetTutorialDone,
  mockSetPracticeDone,
  mockVibrate,
  FAKE_JWT,
} = vi.hoisted(() => {
  const json = JSON.stringify({ sub: 'flow-sub-7' });
  const b64 = (
    globalThis as { Buffer?: { from(d: string, e: string): { toString(e: string): string } } }
  )
    .Buffer!.from(json, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return {
    mockReplace: vi.fn(),
    mockParentReplace: vi.fn(),
    mockReset: vi.fn(),
    mockParentReset: vi.fn(),
    mockGetParent: vi.fn(),
    mockSetTutorialDone: vi.fn(),
    mockSetPracticeDone: vi.fn(),
    mockVibrate: vi.fn(),
    FAKE_JWT: `header.${b64}.signature`,
  };
});

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
    Modal: makeComponent('Modal'),
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
    Linking: { openURL: vi.fn(async () => undefined), canOpenURL: vi.fn(async () => true) },
    Vibration: { vibrate: mockVibrate, cancel: vi.fn() },
  };
});

vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children as React.ReactElement,
  useNavigation: () => ({
    replace: mockReplace,
    reset: mockReset,
    getParent: mockGetParent,
    navigate: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
  useIsFocused: () => true,
}));

vi.mock('../../src/state/appStore', () => {
  const state = {
    setTutorialDone: mockSetTutorialDone,
    setPracticeDone: mockSetPracticeDone,
    jwt: FAKE_JWT,
  };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

vi.mock('../../src/util/analytics', () => ({
  logEvent: vi.fn(),
  EVENT_NAMES: [
    'rig_tutorial_shown',
    'rig_no_rig_link_tapped',
    'practice_intro_shown',
    'practice_started',
    'practice_complete_shown',
    'practice_complete_continued',
  ],
}));

import RigTutorialScreen from '../../src/screens/tutorial/RigTutorialScreen';
import PracticeIntroScreen from '../../src/screens/tutorial/PracticeIntroScreen';
import PracticeCompleteScreen from '../../src/screens/tutorial/PracticeCompleteScreen';
import { decodeGoogleSubFromJwt } from '../../src/lib/jwtSub';

// Boot-gate helpers — reuse the real implementations so step (d) is a true
// "screen write feeds boot read" assertion, not a re-stub.
import { secureMmkv } from '../../src/state/mmkv';
import { practiceDoneKey } from '../../src/state/keys';
import { computeInitialRoute } from '../../src/state/initialRoute';

const PRACTICE_PARAMS = {
  taskId: '__practice__',
  taskName: 'Practice — 60 sec',
  isPractice: true,
};

describe('practice-tutorial chain (plan 04-06 — ONB-03 / ONB-07 / ONB-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetParent.mockReturnValue({ replace: mockParentReplace, reset: mockParentReset });
  });
  afterEach(() => cleanup());

  it('(a) RigTutorial "Next" → navigation.replace("PracticeIntro") (NOT "MainTabs")', () => {
    const { getByLabelText } = render(<RigTutorialScreen />);
    fireEvent.click(getByLabelText('Next'));
    expect(mockReplace).toHaveBeenCalledWith('PracticeIntro');
    expect(mockReplace).not.toHaveBeenCalledWith('MainTabs');
    expect(mockSetTutorialDone).toHaveBeenCalledWith('flow-sub-7');
  });

  it('(b) PracticeIntro "Start practice" → navigation → "Recording" with practice params', () => {
    const { getByLabelText } = render(<PracticeIntroScreen />);
    fireEvent.click(getByLabelText('Start practice'));
    expect(mockParentReplace).toHaveBeenCalledWith('Recording', PRACTICE_PARAMS);
  });

  it('(c) PracticeComplete "Continue" → setPracticeDone(sub) then reset(MainTabs); vibrates on enter', () => {
    const { getByLabelText } = render(<PracticeCompleteScreen />);
    // [40,80,40]ms haptic on enter.
    expect(mockVibrate).toHaveBeenCalledWith([0, 40, 80, 40]);
    fireEvent.click(getByLabelText('Continue'));
    expect(mockSetPracticeDone).toHaveBeenCalledWith('flow-sub-7');
    expect(mockParentReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
    const setOrder = mockSetPracticeDone.mock.invocationCallOrder[0]!;
    const resetOrder = mockParentReset.mock.invocationCallOrder[0]!;
    expect(setOrder).toBeLessThan(resetOrder);
  });

  it('(d) screen write feeds boot read — computeInitialRoute: RigTutorial when unset, MainTabs when set', () => {
    const sub = decodeGoogleSubFromJwt(FAKE_JWT);
    expect(sub).toBe('flow-sub-7');
    // A green-onboarding AppState with the practice flag NOT yet written.
    // currentCompatSignature = null → the compat gate trusts the stored
    // compatPassed (offline-boot caveat), so only the practice gate decides.
    const greenState = {
      jwt: FAKE_JWT,
      permsGranted: { camera: true, mic: true },
      compatPassed: { signature: 'sig-abc' },
      tutorialDone: true,
    } as unknown as Parameters<typeof computeInitialRoute>[0];

    secureMmkv.remove(practiceDoneKey(sub));
    expect(computeInitialRoute(greenState, null)).toEqual({
      stack: 'OnboardingStack',
      screen: 'RigTutorial',
    });

    // Simulate PracticeComplete.Continue's MMKV write-through.
    secureMmkv.set(practiceDoneKey(sub), true);
    expect(computeInitialRoute(greenState, null)).toEqual({ stack: 'MainTabs' });

    secureMmkv.remove(practiceDoneKey(sub));
  });
});
