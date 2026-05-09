// SignupScreen unit tests — Phase 2 plan 02-09 Task 2.
//
// Behaviour matrix (9 tests, drives the screen contract):
//   Test 1: Renders the Humyn Labs logo (queryable by accessibilityLabel).
//   Test 2: Renders the verbatim pitch block — "Record real moments." +
//           "Train real intelligence." + "Get paid".
//   Test 3: Renders "Continue with Google" button (accessibilityLabel match).
//   Test 4: Consent checkbox is checked by default (accessibilityState).
//   Test 5: Tap "Continue with Google" with consent UNchecked → mocked
//           Alert.alert is called with "Please accept the Terms of Use to
//           continue." and signInWithGoogle is NOT called.
//   Test 6: Tap with consent checked → signInWithGoogle invoked; on success
//           store.setJwt called with returned JWT, store.setConsent called
//           with {acceptedAt: ISO, consentVersion: <hex>}; navigation.replace
//           called with 'Permissions'.
//   Test 7: signInWithGoogle rejects → state returns to idle (button enabled
//           again); navigation.replace NOT called.
//   Test 8: Tapping the "Terms of Use" link opens the TermsOfUseModal
//           (visible=true asserted via the modal accessibilityLabel).
//   Test 9: AUTH-04 — name + email come back from signInWithGoogle; the
//           screen does not crash when nullable fields (avatarUrl) are null.
//           Phase 2 propagation to /me PATCH happens in plan 02-18 Profile;
//           this test asserts the absence of crash + happy-path completion.
//
// Tests run under JSDOM with the host-component shim from vitest.setup.ts.
// react-native's Alert is not exposed in the shim — we extend it inline.

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted spies — must be declared inside vi.hoisted() so the (also-
// hoisted) vi.mock factories below can reference them. Module-level const
// declarations execute AFTER hoisted vi.mock factories.
// ---------------------------------------------------------------------------
const { mockSignInWithGoogle, mockSetJwt, mockSetConsent, mockReplace, mockLogEvent, mockAlert } =
  vi.hoisted(() => ({
    mockSignInWithGoogle: vi.fn(),
    mockSetJwt: vi.fn(),
    mockSetConsent: vi.fn(),
    mockReplace: vi.fn(),
    mockLogEvent: vi.fn(),
    mockAlert: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// react-native shim extension — vitest.setup.ts already shims View/Text/etc.
// We add Alert as a spy-able object. Same pattern as RigTutorialScreen.test.tsx.
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
    Alert: {
      alert: mockAlert,
    },
  };
});

// ---------------------------------------------------------------------------
// Service mock — signInWithGoogle is the orchestration entry point. Plan 02-09
// wraps it (does NOT modify it). Tests assert call shape + return-value handling.
// ---------------------------------------------------------------------------
vi.mock('../../src/services/auth', () => ({
  signInWithGoogle: mockSignInWithGoogle,
  // signOut is exported by Task 1; not exercised by SignupScreen tests but the
  // mock must still expose it so transitive imports don't fail.
  signOut: vi.fn(),
  getStoredJwt: vi.fn(() => undefined),
  clearStoredJwt: vi.fn(),
}));

// ---------------------------------------------------------------------------
// useAppStore — selector-aware mock. SignupScreen reads two action selectors.
// ---------------------------------------------------------------------------
vi.mock('../../src/state/appStore', () => {
  const state = {
    setJwt: mockSetJwt,
    setConsent: mockSetConsent,
  };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

// ---------------------------------------------------------------------------
// Navigation hook — replace() is the only method the screen uses on success.
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
// Analytics — captured for downstream assertions (no per-event allowlist
// enforcement in tests; the runtime allowlist guard lives in util/analytics.ts).
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
  ],
}));

// Import AFTER all vi.mock declarations so the screen sees the mocked deps.
import SignupScreen from '../../src/screens/signup/SignupScreen';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SignupScreen (plan 02-09 Task 2 — design-spec §2)', () => {
  it('Test 1: renders the Humyn Labs logo (queryable by accessibilityLabel)', () => {
    const { getByLabelText } = render(<SignupScreen />);
    expect(getByLabelText('Humyn Labs logo')).toBeTruthy();
  });

  it('Test 2: renders the verbatim pitch block — three lines with the locked copy', () => {
    const { getByText } = render(<SignupScreen />);
    expect(getByText('Record real moments.')).toBeTruthy();
    expect(getByText('Train real intelligence.')).toBeTruthy();
    expect(getByText('Get paid')).toBeTruthy();
  });

  it('Test 3: renders "Continue with Google" CTA (accessibilityLabel match)', () => {
    const { getByLabelText } = render(<SignupScreen />);
    expect(getByLabelText('Continue with Google')).toBeTruthy();
  });

  it('Test 4: consent checkbox is checked by default', () => {
    const { getByLabelText } = render(<SignupScreen />);
    const checkbox = getByLabelText('Accept Terms of Use checkbox');
    // Host-component shim forwards accessibilityState as `aria-checked` only
    // when the role is checkbox AND a state is supplied; for robustness we
    // assert via the checkbox's role attribute — design-spec §2 default state
    // is checked, and the screen must reflect that on first mount.
    expect(checkbox.getAttribute('role')).toBe('checkbox');
    // SignupScreen renders a child indicator when checked; we look for the
    // testid="checkbox-checked-indicator" element inside the checkbox.
    const checkedIndicator = checkbox.querySelector('[data-testid="checkbox-checked-indicator"]');
    expect(checkedIndicator).not.toBeNull();
  });

  it('Test 5: consent unchecked + tap CTA → Alert.alert fires; signInWithGoogle NOT called', () => {
    const { getByLabelText } = render(<SignupScreen />);
    // Toggle the checkbox off first.
    fireEvent.click(getByLabelText('Accept Terms of Use checkbox'));
    fireEvent.click(getByLabelText('Continue with Google'));
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith('Please accept the Terms of Use to continue.');
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetJwt).not.toHaveBeenCalled();
  });

  it('Test 6: consent checked + tap CTA → signInWithGoogle → setJwt + setConsent + navigation.replace(Permissions)', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce({
      jwt: 'fake.jwt.token',
      user: {
        id: '01HVFAKE0000000000000000US',
        email: 'tester@example.com',
        name: 'Tester',
        avatarUrl: null,
      },
    });
    const { getByLabelText } = render(<SignupScreen />);
    fireEvent.click(getByLabelText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSetJwt).toHaveBeenCalledWith('fake.jwt.token'));
    expect(mockSetConsent).toHaveBeenCalledTimes(1);
    const consentArg = mockSetConsent.mock.calls[0]?.[0] as {
      acceptedAt: string;
      consentVersion: string;
    };
    expect(typeof consentArg.acceptedAt).toBe('string');
    expect(Number.isNaN(Date.parse(consentArg.acceptedAt))).toBe(false);
    expect(typeof consentArg.consentVersion).toBe('string');
    expect(consentArg.consentVersion.length).toBeGreaterThan(0);
    expect(mockReplace).toHaveBeenCalledWith('Permissions');
  });

  it('Test 7: signInWithGoogle rejects → state returns to idle; no navigation.replace', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('google_sign_in_cancelled'));
    const { getByLabelText } = render(<SignupScreen />);
    fireEvent.click(getByLabelText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    // After rejection, the screen must NOT advance.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetJwt).not.toHaveBeenCalled();
    // Error displayed in-screen (accessibility-labeled signup error).
    await waitFor(() => {
      const err = getByLabelText('signup error');
      expect(err.textContent).toContain('google_sign_in_cancelled');
    });
    // signup_google_failed analytics event fired with reason.
    const failedCall = mockLogEvent.mock.calls.find((c) => c[0] === 'signup_google_failed');
    expect(failedCall).toBeDefined();
    expect(failedCall?.[1]).toMatchObject({ reason: 'google_sign_in_cancelled' });
  });

  it('Test 8: tapping "Terms of Use" link opens the TermsOfUseModal', () => {
    const { getByLabelText } = render(<SignupScreen />);
    fireEvent.click(getByLabelText('Terms of Use link'));
    // After opening, the modal accessibilityLabel "Terms of Use modal" is queryable.
    const modal = getByLabelText('Terms of Use modal');
    expect(modal).toBeTruthy();
    // signup_terms_opened analytics event fires.
    const opened = mockLogEvent.mock.calls.find((c) => c[0] === 'signup_terms_opened');
    expect(opened).toBeDefined();
  });

  it('Test 9: AUTH-04 — happy path completes when avatarUrl is null (Google withholds optional fields)', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce({
      jwt: 'fake.jwt.token2',
      user: {
        id: '01HVFAKE0000000000000000US',
        email: 'tester@example.com',
        name: 'Tester',
        avatarUrl: null, // Google may withhold; SignupScreen does not surface it
      },
    });
    const { getByLabelText } = render(<SignupScreen />);
    fireEvent.click(getByLabelText('Continue with Google'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Permissions'));
    expect(mockSetJwt).toHaveBeenCalledWith('fake.jwt.token2');
  });
});
