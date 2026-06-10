// Plan 02-11 RigTutorialScreen contract — ONB-01 + ONB-02.
//
// Six behaviours, all driven through the JSDOM host-component shim from
// vitest.setup.ts (the canonical Phase 2 testing-library/react path):
//
// Test 1: Verbatim §5 heading + body copy renders.
// Test 2: "Next" CTA + "Don't have a rig yet?" off-ramp link both render.
// Test 3: Tap "Next" → setTutorialDone(googleSub) called → local
//         navigator.replace('PracticeIntro') called (plan 04-03 retargeted
//         the Next CTA; the OnboardingStack now runs RigTutorial →
//         PracticeIntro → Recording → PracticeComplete → MainTabs).
// Test 4: Tap "Don't have a rig yet?" → off-ramp Sheet opens; sheet body
//         mentions the support@humynlabs.ai mailto target (T-2.11-01: OQ-1 resolved)
//         intentionally bundled at MVP; swap tracked in 02-21 manual smoke).
// Test 5: After viewing the off-ramp, "Next" still works — the sheet does
//         NOT block onboarding completion (CONTEXT.md "must NOT soft-lock").
// Test 6: rig_tutorial_shown analytics event fires on mount;
//         rig_no_rig_link_tapped fires on off-ramp link tap.
//
// We mock useAppStore selectors so the store can return a synthetic JWT for
// googleSub decoding. Linking.openURL is spied via vi.mocked because the RN
// shim in vitest.setup.ts does not export Linking — we extend the shim
// inline at file scope so the screen's `import { Linking } from 'react-native'`
// resolves to a spy-able stub.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted spies — shared between the (hoisted) vi.mock factories and the
// per-test assertions.
// ---------------------------------------------------------------------------
const { mockSetTutorialDone, mockReplace, mockGetParent, mockLogEvent, mockOpenURL, FAKE_JWT } =
  vi.hoisted(() => {
    // Header-shim payload: example JWT with sub="google-sub-12345" so the
    // screen's decoder returns that value. The header/signature halves are
    // inert (atob just needs a base64 payload). Built inside vi.hoisted so it
    // is available to the (also-hoisted) vi.mock factories below — top-level
    // const declarations execute AFTER hoisted vi.mock factories run, which
    // is why FAKE_JWT must live here instead of as a module-level const.
    const json = JSON.stringify({ sub: 'google-sub-12345', flavor: 'apkRollout' });
    const b64 = (
      globalThis as { Buffer?: { from(d: string, e: string): { toString(e: string): string } } }
    )
      .Buffer!.from(json, 'utf8')
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return {
      mockSetTutorialDone: vi.fn(),
      mockReplace: vi.fn(),
      mockGetParent: vi.fn(),
      mockLogEvent: vi.fn(),
      mockOpenURL: vi.fn(),
      FAKE_JWT: `header.${b64}.signature`,
    };
  });

// ---------------------------------------------------------------------------
// react-native shim extension — vitest.setup.ts already shims View/Text/etc.
// We need to additionally expose `Linking.openURL` as a spy. The setup file's
// vi.mock factory returns a fixed object, so we layer a second vi.mock here
// that takes precedence at module-resolution time (vitest applies the most
// recent vi.mock first).
// ---------------------------------------------------------------------------
vi.mock('react-native', async () => {
  // Reuse the canonical Phase 2 shim by importing it from the setup module's
  // vi.mock registration is already active. Here we declare a fresh factory
  // that mirrors the host-component contract and ALSO exposes Linking.openURL.
  // Keeping host-components in lock-step with vitest.setup.ts; adding new
  // primitives here means duplicating a chunk of the setup file. Acceptable
  // because Phase 2 only needs View/Text/Pressable/Modal/StatusBar/StyleSheet
  // for this screen.
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
    Modal: makeComponent('Modal'),
    StatusBar: () => null,
    Image: makeComponent('Image'),
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      flatten: (s: unknown) => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: (o: { android?: unknown; ios?: unknown; default?: unknown }) =>
        o.android ?? o.default,
    },
    Linking: {
      openURL: mockOpenURL,
      canOpenURL: vi.fn(async () => true),
    },
  };
});

// ---------------------------------------------------------------------------
// useAppStore — selector-aware mock. The screen uses two selectors:
//   useAppStore((s) => s.setTutorialDone)
//   useAppStore((s) => s.jwt)
// We expose a synthetic state and run the selector against it.
// ---------------------------------------------------------------------------
vi.mock('../../src/state/appStore', () => {
  const state = {
    setTutorialDone: mockSetTutorialDone,
    jwt: FAKE_JWT,
  };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  // expose getState for parity with zustand
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

// ---------------------------------------------------------------------------
// useNavigation — overrides the canonical setup-file mock with a
// getParent()-aware variant (the screen prefers the parent navigator when
// present, falling back to the local navigator).
// ---------------------------------------------------------------------------
vi.mock('@react-navigation/native', () => ({
  // Phase 3 (2026-06-10) — the screen now transitively imports
  // services/profileService → services/api → navigation/navigationRef, which
  // calls createNavigationContainerRef at module load. Mirror the
  // vitest.setup stub (reports NOT ready → resetToOnboarding no-ops here).
  createNavigationContainerRef: () => ({
    isReady: () => false,
    resetRoot: vi.fn(),
    reset: vi.fn(),
    navigate: vi.fn(),
    dispatch: vi.fn(),
    getRootState: vi.fn(),
    current: null,
  }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children as React.ReactElement,
  useNavigation: () => ({
    replace: mockReplace,
    getParent: mockGetParent,
    reset: vi.fn(),
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

// ---------------------------------------------------------------------------
// analytics util — logEvent is captured by mockLogEvent so the test can
// assert event-name + payload.
// ---------------------------------------------------------------------------
vi.mock('../../src/util/analytics', () => ({
  logEvent: mockLogEvent,
  EVENT_NAMES: ['rig_tutorial_shown', 'rig_no_rig_link_tapped'],
}));

// Import AFTER mocks so the screen sees the mocked deps.
import RigTutorialScreen from '../../src/screens/tutorial/RigTutorialScreen';

describe('RigTutorialScreen (plan 02-11 — ONB-01 + ONB-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetParent.mockReturnValue({ replace: mockReplace });
  });
  afterEach(() => {
    cleanup();
  });

  it('Test 1: renders the verbatim §5 heading + body copy', () => {
    const { getByText } = render(<RigTutorialScreen />);
    expect(getByText("You'll need a head rig")).toBeTruthy();
    expect(
      getByText('Mount your phone on the head rig and make sure it is steady while recording.'),
    ).toBeTruthy();
  });

  it('Test 2: renders Next CTA + "Don\'t have a rig yet?" secondary link', () => {
    const { getByLabelText, getByText } = render(<RigTutorialScreen />);
    expect(getByLabelText('Next')).toBeTruthy();
    expect(getByText("Don't have a rig yet?")).toBeTruthy();
  });

  it('Test 3: tap Next → setTutorialDone(googleSub) → navigation.replace("PracticeIntro")', () => {
    const { getByLabelText } = render(<RigTutorialScreen />);
    fireEvent.click(getByLabelText('Next'));
    expect(mockSetTutorialDone).toHaveBeenCalledTimes(1);
    expect(mockSetTutorialDone).toHaveBeenCalledWith('google-sub-12345');
    // Plan 04-03: 'PracticeIntro' is an OnboardingStack sibling, so we
    // navigate on the local navigator (no getParent hop).
    expect(mockReplace).toHaveBeenCalledWith('PracticeIntro');
  });

  it('Test 4: tap "Don\'t have a rig yet?" → off-ramp sheet opens with mailto target', () => {
    const { getByLabelText, getByText } = render(<RigTutorialScreen />);
    fireEvent.click(getByLabelText("Don't have a rig yet"));
    // Sheet body mentions the support email
    expect(getByLabelText('No rig off-ramp sheet')).toBeTruthy();
    // Plan 03-02 — OQ-1 resolved: support email = `support@humynlabs.ai`.
    // The body copy contains the canonical address (no placeholder).
    expect(getByText(/support@humynlabs\.ai/)).toBeTruthy();
    // Email button → Linking.openURL with the mailto URL
    fireEvent.click(getByLabelText('Email support about rig'));
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringMatching(/^mailto:support@humynlabs\.ai/),
    );
  });

  it('Test 5: off-ramp sheet does NOT soft-lock — Next still works after viewing', () => {
    const { getByLabelText } = render(<RigTutorialScreen />);
    // Open the sheet
    fireEvent.click(getByLabelText("Don't have a rig yet"));
    // Close via "Got it"
    fireEvent.click(getByLabelText('Got it close off-ramp'));
    // Tap Next — still works
    fireEvent.click(getByLabelText('Next'));
    expect(mockSetTutorialDone).toHaveBeenCalledWith('google-sub-12345');
    expect(mockReplace).toHaveBeenCalledWith('PracticeIntro');
  });

  it('Test 6: rig_tutorial_shown fires on mount; rig_no_rig_link_tapped fires on off-ramp tap', () => {
    const { getByLabelText } = render(<RigTutorialScreen />);
    expect(mockLogEvent).toHaveBeenCalledWith('rig_tutorial_shown');
    fireEvent.click(getByLabelText("Don't have a rig yet"));
    expect(mockLogEvent).toHaveBeenCalledWith('rig_no_rig_link_tapped');
  });
});
