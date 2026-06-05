// SignupScreen unit tests — quick task 260527-hkl Task 2.
//
// Behaviour matrix (6 new behaviour assertions + the regression set inherited
// from Phase 2 plan 02-09):
//   Test 1: useAppStore.getState().consent === null on mount → termsOpen=true
//           (Terms-of-Use modal auto-opens).
//   Test 2: consent record with consentVersion === CONSENT_VERSION on mount →
//           termsOpen=false (modal does NOT auto-open) + checkbox renders
//           with the checked indicator child.
//   Test 3: consent record with consentVersion === 'stale-old-hash' on mount →
//           termsOpen=true (a consent-version bump re-prompts).
//   Test 4: Continue-with-Google CTA has disabled accessibilityState whenever
//           consent === null OR consent.consentVersion !== CONSENT_VERSION
//           (the click is a no-op because Button passes onPress=undefined
//           when disabled; we assert via signInWithGoogle never called).
//   Test 5: invoking the modal's captured onAgree calls setConsent({
//           acceptedAt: <ISO>, consentVersion: CONSENT_VERSION }), closes the
//           modal, checks the checkbox, and enables the CTA.
//   Test 6: tapping the checkbox AFTER consent is persisted is a no-op
//           (setConsent NOT called again, modal stays closed). Tapping the
//           checkbox BEFORE consent re-opens the modal.
//
// Plus the regression invariants we must NOT regress (Phase 2 plan 02-09):
//   - logo + pitch block render
//   - Continue-with-Google rendered
//   - happy-path sign-in: signInWithGoogle → setJwt → navigation.replace('Permissions')
//   - rejection path: signInWithGoogle throws → signup error surfaces
//
// Tests run under JSDOM with the host-component shim from vitest.setup.ts.

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted spies — must be declared inside vi.hoisted() so the (also-
// hoisted) vi.mock factories below can reference them.
// ---------------------------------------------------------------------------
const {
  mockSignInWithGoogle,
  mockSetJwt,
  mockSetConsent,
  mockSetUser,
  mockReplace,
  mockLogEvent,
  mockAlert,
  mockClearDeviceEvicted,
  consentRef,
  deviceEvictedRef,
  capturedOnAgreeRef,
} = vi.hoisted(() => ({
  mockSignInWithGoogle: vi.fn(),
  mockSetJwt: vi.fn(),
  mockSetConsent: vi.fn(),
  mockSetUser: vi.fn(),
  mockReplace: vi.fn(),
  mockLogEvent: vi.fn(),
  mockAlert: vi.fn(),
  mockClearDeviceEvicted: vi.fn(),
  // Mutable holder so each test can seed the consent slice BEFORE rendering.
  consentRef: { current: null as null | { acceptedAt: string; consentVersion: string } },
  // Bug 4 / D2 — mutable holder so a test can seed the eviction flag before render.
  deviceEvictedRef: { current: false as boolean },
  // Captured onAgree prop from the (mocked) TermsOfUseModal — tests fire it
  // directly to drive the Agree-button user gesture without going through
  // the real modal's scroll-gate.
  capturedOnAgreeRef: { current: (() => undefined) as () => void },
}));

// ---------------------------------------------------------------------------
// react-native shim extension — add Alert as a spy-able object.
// ---------------------------------------------------------------------------
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
    Alert: { alert: mockAlert },
    Linking: {
      openURL: vi.fn().mockResolvedValue(undefined),
      canOpenURL: vi.fn().mockResolvedValue(true),
    },
    BackHandler: {
      addEventListener: () => ({ remove: () => undefined }),
      removeEventListener: () => undefined,
      exitApp: () => undefined,
    },
  };
});

// ---------------------------------------------------------------------------
// Service mock.
// ---------------------------------------------------------------------------
vi.mock('../../src/services/auth', () => ({
  signInWithGoogle: mockSignInWithGoogle,
  signOut: vi.fn(),
  getStoredJwt: vi.fn(() => undefined),
  clearStoredJwt: vi.fn(),
}));

// ---------------------------------------------------------------------------
// useAppStore — selector-aware mock that ALSO honours the consent slice
// reads SignupScreen now does. The consent slice is sourced from consentRef
// (mutable per-test); setConsent is the recorded mock. getState() returns the
// same view so initializer-time reads work.
// ---------------------------------------------------------------------------
vi.mock('../../src/state/appStore', () => {
  function buildState() {
    return {
      setJwt: mockSetJwt,
      setConsent: mockSetConsent,
      setUser: mockSetUser,
      consent: consentRef.current,
      deviceEvicted: deviceEvictedRef.current,
      clearDeviceEvicted: mockClearDeviceEvicted,
    };
  }
  function useAppStore<T>(selector: (s: ReturnType<typeof buildState>) => T): T {
    return selector(buildState());
  }
  (useAppStore as unknown as { getState: () => ReturnType<typeof buildState> }).getState =
    buildState;
  return { useAppStore };
});

// ---------------------------------------------------------------------------
// Navigation hook.
// ---------------------------------------------------------------------------
vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children as React.ReactElement,
  useNavigation: () => ({
    replace: mockReplace,
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
// Analytics.
// ---------------------------------------------------------------------------
vi.mock('../../src/util/analytics', () => ({
  logEvent: mockLogEvent,
  EVENT_NAMES: [
    'signup_started',
    'signup_consent_checked',
    'signup_terms_opened',
    'signup_google_started',
    'signup_google_completed',
    'signup_google_failed',
    'consent_agreed',
  ],
}));

// ---------------------------------------------------------------------------
// TermsOfUseModal — mock that captures the `onAgree` prop on every render so
// tests can drive the Agree handler directly (bypassing the modal's real
// scroll gate, which is exercised by TermsOfUseModal.test.tsx).
// ---------------------------------------------------------------------------
vi.mock('../../src/screens/signup/TermsOfUseModal', async () => {
  const ReactModule = await import('react');
  const React_ = ReactModule;
  // The real TERMS_OF_USE_TEXT export must stay byte-identical (LEGAL-02);
  // re-import from the real file to preserve the FNV-1a CONSENT_VERSION
  // SignupScreen derives at module load.
  const real = await vi.importActual<typeof import('../../src/screens/signup/TermsOfUseModal')>(
    '../../src/screens/signup/TermsOfUseModal',
  );
  function MockModal(props: { visible: boolean; onAgree?: () => void }) {
    if (typeof props.onAgree === 'function') {
      capturedOnAgreeRef.current = props.onAgree;
    }
    return props.visible
      ? React_.createElement(
          'div',
          { 'data-testid': 'Modal', 'aria-label': 'Terms of Use modal' },
          null,
        )
      : null;
  }
  return {
    TermsOfUseModal: MockModal,
    TERMS_OF_USE_TEXT: real.TERMS_OF_USE_TEXT,
    default: MockModal,
  };
});

// Import AFTER mocks so the screen sees the mocked deps.
import SignupScreen from '../../src/screens/signup/SignupScreen';
import { TERMS_OF_USE_TEXT } from '../../src/screens/signup/TermsOfUseModal';

// Recompute the CONSENT_VERSION the same way SignupScreen does (FNV-1a).
function consentVersionFromText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
const CURRENT_CONSENT_VERSION = consentVersionFromText(TERMS_OF_USE_TEXT);

beforeEach(() => {
  vi.clearAllMocks();
  // Fresh-install default: no consent record on disk → modal auto-opens.
  consentRef.current = null;
  deviceEvictedRef.current = false;
  capturedOnAgreeRef.current = () => undefined;
});

afterEach(() => {
  cleanup();
});

describe('SignupScreen (quick 260527-hkl Task 2 — auto-open + CTA-disabled-until-consent)', () => {
  // ---------------------------------------------------------------------------
  // Regression invariants (Phase 2 plan 02-09 baseline)
  // ---------------------------------------------------------------------------
  it('renders the Humyn Labs logo + pitch block + Continue-with-Google CTA', () => {
    const { getByLabelText, getByText } = render(<SignupScreen />);
    expect(getByLabelText('Humyn Labs logo')).toBeTruthy();
    expect(getByText('Record real moments.')).toBeTruthy();
    expect(getByText('Train real intelligence.')).toBeTruthy();
    expect(getByText('Get paid')).toBeTruthy();
    expect(getByLabelText('Continue with Google')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Test 1 — modal auto-opens when no consent record exists
  // ---------------------------------------------------------------------------
  it('Test 1: fresh install (consent === null) → modal auto-opens on mount', () => {
    consentRef.current = null;
    const { getByLabelText } = render(<SignupScreen />);
    expect(getByLabelText('Terms of Use modal')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Bug 4 / D2 — device-evicted notice (newest-login-wins eviction lands here)
  // ---------------------------------------------------------------------------
  it('Bug 4 / D2: deviceEvicted flag on mount → shows the eviction notice + clears the flag', () => {
    consentRef.current = {
      acceptedAt: '2026-05-27T10:00:00.000Z',
      consentVersion: CURRENT_CONSENT_VERSION,
    };
    deviceEvictedRef.current = true;
    const { getByLabelText } = render(<SignupScreen />);
    const notice = getByLabelText('device-evicted notice');
    expect(notice).toBeTruthy();
    expect(notice.textContent).toContain('another device');
    // One-shot: cleared on mount so it does not re-show on a later Signup visit.
    expect(mockClearDeviceEvicted).toHaveBeenCalledTimes(1);
  });

  it('Bug 4 / D2: no eviction notice on a normal Signup mount', () => {
    consentRef.current = {
      acceptedAt: '2026-05-27T10:00:00.000Z',
      consentVersion: CURRENT_CONSENT_VERSION,
    };
    deviceEvictedRef.current = false;
    const { queryByLabelText } = render(<SignupScreen />);
    expect(queryByLabelText('device-evicted notice')).toBeNull();
    expect(mockClearDeviceEvicted).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Test 2 — current consent record → modal does NOT auto-open + checkbox checked
  // ---------------------------------------------------------------------------
  it('Test 2: existing consent matching CONSENT_VERSION → modal stays closed + checkbox checked', () => {
    consentRef.current = {
      acceptedAt: '2026-05-27T10:00:00.000Z',
      consentVersion: CURRENT_CONSENT_VERSION,
    };
    const { queryByLabelText } = render(<SignupScreen />);
    expect(queryByLabelText('Terms of Use modal')).toBeNull();
    const checkbox = queryByLabelText('Accept Terms of Use checkbox');
    expect(checkbox).toBeTruthy();
    // The screen renders the "✓" indicator only when consent is persisted.
    const indicator = checkbox?.querySelector('[data-testid="checkbox-checked-indicator"]');
    expect(indicator).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Test 3 — stale consent version → modal auto-opens
  // ---------------------------------------------------------------------------
  it('Test 3: stale consent version → modal auto-opens (consent-version bump re-prompts)', () => {
    consentRef.current = {
      acceptedAt: '2026-01-01T00:00:00.000Z',
      consentVersion: 'stale-old-hash',
    };
    const { getByLabelText } = render(<SignupScreen />);
    expect(getByLabelText('Terms of Use modal')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Test 4 — CTA disabled until consent is persisted
  // ---------------------------------------------------------------------------
  it('Test 4: Continue-with-Google CTA is a no-op while consent is missing OR stale', async () => {
    // Case A: consent === null.
    consentRef.current = null;
    let view = render(<SignupScreen />);
    fireEvent.click(view.getByLabelText('Continue with Google'));
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    view.unmount();

    // Case B: stale consent version.
    consentRef.current = {
      acceptedAt: '2026-01-01T00:00:00.000Z',
      consentVersion: 'stale-old-hash',
    };
    view = render(<SignupScreen />);
    fireEvent.click(view.getByLabelText('Continue with Google'));
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Test 5 — modal.onAgree → setConsent + close + checked + CTA enabled
  // ---------------------------------------------------------------------------
  it('Test 5: invoking the modal onAgree persists consent + closes modal + enables CTA', async () => {
    consentRef.current = null;
    const { getByLabelText, queryByLabelText, rerender } = render(<SignupScreen />);
    // Modal is open initially.
    expect(getByLabelText('Terms of Use modal')).toBeTruthy();
    // Fire the captured onAgree (drives the Agree-button user gesture).
    capturedOnAgreeRef.current();
    // setConsent called with the canonical CONSENT_VERSION + an ISO timestamp.
    expect(mockSetConsent).toHaveBeenCalledTimes(1);
    const consentArg = mockSetConsent.mock.calls[0]?.[0] as {
      acceptedAt: string;
      consentVersion: string;
    };
    expect(typeof consentArg.acceptedAt).toBe('string');
    expect(Number.isNaN(Date.parse(consentArg.acceptedAt))).toBe(false);
    expect(consentArg.consentVersion).toBe(CURRENT_CONSENT_VERSION);
    // Re-render with the store now reflecting persisted consent (in real life
    // this happens automatically via Zustand; under the mock we mirror the
    // post-Agree store state and re-render to assert the derived UI).
    consentRef.current = consentArg;
    rerender(<SignupScreen />);
    // Modal closes.
    expect(queryByLabelText('Terms of Use modal')).toBeNull();
    // Checkbox renders the checked indicator.
    const checkbox = getByLabelText('Accept Terms of Use checkbox');
    expect(checkbox.querySelector('[data-testid="checkbox-checked-indicator"]')).not.toBeNull();
    // CTA click is now actionable (signInWithGoogle is invoked).
    mockSignInWithGoogle.mockResolvedValueOnce({
      jwt: 'fake.jwt.token',
      user: {
        id: '01HVFAKE0000000000000000US',
        email: 'tester@example.com',
        name: 'Tester',
        avatarUrl: null,
      },
    });
    fireEvent.click(getByLabelText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Permissions'));
    // setConsent is NOT called a second time on sign-in (consent is persisted
    // by the modal's Agree handler, not by handleSignIn).
    expect(mockSetConsent).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Test 6 — checkbox is a read-only indicator after consent
  // ---------------------------------------------------------------------------
  it('Test 6: tapping the checkbox after consent is a no-op; tapping BEFORE consent re-opens the modal', () => {
    // PHASE A — BEFORE consent: tapping the checkbox re-opens the modal.
    // The first render auto-opens it; we drive a full Agree flow first
    // (so the modal closes via the real handler path), then re-open via
    // the checkbox press to prove the "tap re-opens if not yet consented"
    // branch fires.
    consentRef.current = null;
    const { getByLabelText, queryByLabelText, rerender } = render(<SignupScreen />);
    expect(getByLabelText('Terms of Use modal')).toBeTruthy();
    // Drive onAgree (close + persist). The store-side persistence is a mock;
    // we mirror it manually for the rerender below.
    capturedOnAgreeRef.current();
    expect(mockSetConsent).toHaveBeenCalledTimes(1);
    // After onAgree the modal is closed (setTermsOpen(false) inside the
    // handler). Re-tap the checkbox while consent is STILL null in the store
    // (the rerender below feeds the persisted value); the handler should
    // re-open the modal because consentPersisted is still false on this
    // render pass.
    fireEvent.click(getByLabelText('Accept Terms of Use checkbox'));
    expect(getByLabelText('Terms of Use modal')).toBeTruthy();

    // PHASE B — AFTER consent: rerender with the persisted record in the
    // store, then drive onAgree once more (so the modal closes). Tap the
    // checkbox: no-op (setConsent NOT called a second time, modal stays
    // closed).
    consentRef.current = {
      acceptedAt: '2026-05-27T10:00:00.000Z',
      consentVersion: CURRENT_CONSENT_VERSION,
    };
    rerender(<SignupScreen />);
    capturedOnAgreeRef.current();
    rerender(<SignupScreen />);
    expect(queryByLabelText('Terms of Use modal')).toBeNull();
    const callsBefore = mockSetConsent.mock.calls.length;
    fireEvent.click(getByLabelText('Accept Terms of Use checkbox'));
    expect(queryByLabelText('Terms of Use modal')).toBeNull();
    expect(mockSetConsent.mock.calls.length).toBe(callsBefore);
  });

  // ---------------------------------------------------------------------------
  // Regression: signInWithGoogle rejection still flows the error path.
  // ---------------------------------------------------------------------------
  it('signInWithGoogle rejection → state returns to idle; signup error surfaces', async () => {
    consentRef.current = {
      acceptedAt: '2026-05-27T10:00:00.000Z',
      consentVersion: CURRENT_CONSENT_VERSION,
    };
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('google_sign_in_cancelled'));
    const { getByLabelText } = render(<SignupScreen />);
    fireEvent.click(getByLabelText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
    await waitFor(() => {
      const err = getByLabelText('signup error');
      expect(err.textContent).toContain('google_sign_in_cancelled');
    });
  });
});
