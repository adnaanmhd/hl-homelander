// DeleteAccountModal — design-spec §18.4 + AUTH-09 / AUTH-10 contract.
//
// Tests:
//   1. Step 1 renders verbatim §18.4 title + body.
//   2. Continue-to-delete advances to step 2 typing gate.
//   3. Confirm with typed='delete' (lowercase) — does NOT call deleteMe
//      (case-sensitive AUTH-10 + Confirm button is rendered disabled).
//   4. Confirm with typed='DELETE' — calls deleteMe, then signOut, then
//      navigation.reset to Signup.
//   5. Cancel on step 1 calls navigation.goBack.
//   6. deleteMe rejection → Alert + step stays open (no signOut, no nav reset).
//
// Pattern: per-file `vi.mock('react-native', ...)` so Alert.alert can be
// spied on. Mirrors ReportProblemSheet.test.tsx. Uses `vi.hoisted` to bind
// spies into the same hoist-scope as the factory body.

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted spies — see ReportProblemSheet.test.tsx for the pattern rationale.
// ---------------------------------------------------------------------------
const { mockDeleteMe, mockSignOut, mockGoBack, mockReset, mockAlert } = vi.hoisted(() => ({
  mockDeleteMe: vi.fn(),
  mockSignOut: vi.fn(),
  mockGoBack: vi.fn(),
  mockReset: vi.fn(),
  mockAlert: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, reset: mockReset }),
}));

vi.mock('../../src/services/profileService', () => ({
  deleteMe: mockDeleteMe,
}));

vi.mock('../../src/services/auth', () => ({
  signOut: mockSignOut,
}));

// react-native: per-file shim with Alert.alert spy. Mirrors the
// ReportProblemSheet pattern; ensures the JSDOM render of TextInput maps to
// <input> with onChangeText → onChange shim so fireEvent.change drives state.
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
  function makeTextInput() {
    return React_.forwardRef<
      HTMLInputElement,
      Record<string, unknown> & {
        value?: string;
        onChangeText?: (t: string) => void;
        placeholder?: string;
      }
    >(function TextInputShim(props, ref) {
      const {
        value,
        onChangeText,
        accessibilityLabel,
        style,
        placeholderTextColor: _ptc,
        autoFocus: _af,
        autoCapitalize: _ac,
        autoCorrect: _acr,
        ...rest
      } = props;
      const dom: Record<string, unknown> = {
        ref,
        'data-testid': 'TextInput',
        value: value ?? '',
        ...rest,
      };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof onChangeText === 'function') {
        dom['onChange'] = (e: { target: { value: string } }) => onChangeText(e.target.value);
      }
      const resolved = resolveStyle(style);
      if (resolved) dom['style'] = resolved;
      return React_.createElement('input', dom);
    });
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    ScrollView: makeComponent('ScrollView'),
    TextInput: makeTextInput(),
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
  };
});

import { DeleteAccountModal } from '../../src/components/DeleteAccountModal';

beforeEach(() => {
  mockDeleteMe.mockReset();
  mockSignOut.mockClear();
  mockGoBack.mockClear();
  mockReset.mockClear();
  mockAlert.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('DeleteAccountModal (design-spec §18.4 / AUTH-09 / AUTH-10)', () => {
  it('Step 1 renders verbatim §18.4 title + body copy', () => {
    const { getByText } = render(<DeleteAccountModal />);
    expect(getByText('Delete your Humyn account?')).toBeTruthy();
    expect(getByText(/Your account will be deactivated for 30 days/)).toBeTruthy();
    expect(getByText(/After 30 days, deletion is permanent/)).toBeTruthy();
    expect(getByText(/Recordings already uploaded remain on our servers\./)).toBeTruthy();
  });

  it('Continue to delete advances to Step 2 typing gate', () => {
    const { getByLabelText, getByText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-continue'));
    expect(getByText('Type DELETE to confirm.')).toBeTruthy();
    expect(getByLabelText('delete-typing-input')).toBeTruthy();
  });

  it('Confirm is disabled (and does NOT call deleteMe) when typed text is lowercase "delete" — case-sensitive AUTH-10', () => {
    const { getByLabelText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-continue'));
    fireEvent.change(getByLabelText('delete-typing-input'), { target: { value: 'delete' } });
    // Pressable shim forwards onPress→onClick only when defined; Button's
    // disabled=true sets onPress=undefined so the click is a no-op even if
    // dispatched. Either way deleteMe MUST NOT be called.
    fireEvent.click(getByLabelText('delete-confirm'));
    expect(mockDeleteMe).not.toHaveBeenCalled();
  });

  it('Confirm fires deleteMe + signOut + nav.reset when typed === "DELETE"', async () => {
    mockDeleteMe.mockResolvedValue(undefined);
    const { getByLabelText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-continue'));
    fireEvent.change(getByLabelText('delete-typing-input'), { target: { value: 'DELETE' } });
    fireEvent.click(getByLabelText('delete-confirm'));
    await waitFor(() => expect(mockDeleteMe).toHaveBeenCalledTimes(1));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'OnboardingStack' }] });
  });

  it('Cancel on Step 1 calls nav.goBack and does NOT call deleteMe', () => {
    const { getByLabelText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-cancel'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockDeleteMe).not.toHaveBeenCalled();
  });

  it('deleteMe rejection surfaces via Alert; modal stays open (no signOut, no nav reset)', async () => {
    mockDeleteMe.mockRejectedValue(new Error('DELETE /me failed: 429 rate-limited'));
    const { getByLabelText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-continue'));
    fireEvent.change(getByLabelText('delete-typing-input'), { target: { value: 'DELETE' } });
    fireEvent.click(getByLabelText('delete-confirm'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  // Pattern 66 — synchronous re-entrancy guard. Regression test for
  // quick-260510-006: a fast double-tap of Confirm (before React re-renders
  // the disabled state) MUST NOT result in two DELETE /me requests. See
  // file header in DeleteAccountModal.tsx for the full rationale.
  it('Pattern 66 — guard holds across a tap arriving AFTER the first deleteMe + signOut + nav.reset success path (the actual bug we are fixing — releasing the ref in finally is WRONG)', async () => {
    mockDeleteMe.mockResolvedValue(undefined);
    const { getByLabelText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-continue'));
    fireEvent.change(getByLabelText('delete-typing-input'), { target: { value: 'DELETE' } });
    // First tap: success path — deleteMe + signOut + nav.reset all run.
    fireEvent.click(getByLabelText('delete-confirm'));
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockDeleteMe).toHaveBeenCalledTimes(1);
    // Second tap arriving AFTER the success path completed but before the
    // component unmounts (simulated here by the still-mounted test render).
    // If the ref was released in `finally`, this would pass through and
    // fire a second DELETE — that's the 08:50:13.503 401 bug. Guard MUST
    // hold across the success boundary.
    fireEvent.click(getByLabelText('delete-confirm'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockDeleteMe).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('Pattern 66 — guard releases on error so the user can retry (network failure / 429 rate-limit)', async () => {
    mockDeleteMe
      .mockRejectedValueOnce(new Error('DELETE /me failed: 503 transient'))
      .mockResolvedValueOnce(undefined);
    const { getByLabelText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-continue'));
    fireEvent.change(getByLabelText('delete-typing-input'), { target: { value: 'DELETE' } });
    fireEvent.click(getByLabelText('delete-confirm'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    // Retry tap after the error path released the guard.
    fireEvent.click(getByLabelText('delete-confirm'));
    await waitFor(() => expect(mockDeleteMe).toHaveBeenCalledTimes(2));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('Pattern 66 — fires deleteMe ONCE even when Confirm is tapped twice synchronously while the first deleteMe is still in flight (the original repro)', async () => {
    // Holder pattern (NOT `let resolve = null`) so TS keeps the function-typed
    // narrow after the Promise-executor capture; otherwise control-flow
    // analysis collapses to `never` at the optional-chain call site.
    const resolveHolder: { fn: (() => void) | null } = { fn: null };
    mockDeleteMe.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveHolder.fn = () => resolve();
        }),
    );
    const { getByLabelText } = render(<DeleteAccountModal />);
    fireEvent.click(getByLabelText('delete-continue'));
    fireEvent.change(getByLabelText('delete-typing-input'), { target: { value: 'DELETE' } });
    // Two synchronous taps before the awaited deleteMe settles — pre-fix,
    // both would have entered confirmDelete and fired separate DELETEs.
    fireEvent.click(getByLabelText('delete-confirm'));
    fireEvent.click(getByLabelText('delete-confirm'));
    expect(mockDeleteMe).toHaveBeenCalledTimes(1);
    // Resolve to drain the awaited path so signOut + nav.reset assertions
    // hold post-success too.
    resolveHolder.fn?.();
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockReset).toHaveBeenCalledTimes(1);
    // Even after success, deleteMe is STILL only called once.
    expect(mockDeleteMe).toHaveBeenCalledTimes(1);
  });
});
