// LogoutModal — design-spec §18.3 contract + AUTH-08 wiring.
//
// Tests:
//   1. Verbatim §18.3 title + body copy renders.
//   2. Cancel calls navigation.goBack and does NOT call signOut.
//   3. Log out calls signOut() AND navigation.reset to OnboardingStack
//      (NOT 'Signup' directly — Signup is nested inside OnboardingStack and
//      is not addressable from the root navigator).
//   4. accessibilityLabel="logout-modal" is present (lets ProfileScreen
//      smoke-tests assert the modal has rendered).
//
// Pattern: relies on vitest.setup.ts for the react-native host-component shim
// (Modal renders children as a <div> in JSDOM). signOut + useNavigation are
// mocked at the module boundary so the real auth.ts / @react-navigation/native
// never load. Mirrors the LogoutModal pattern from the plan body, with the
// 02-17 / 02-18 explicit `cleanup()` in afterEach to handle multi-render
// queries under vitest globals: false.

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock factories are hoisted above all imports, so closures over const
// declarations in the test file would race the hoist. Use vi.hoisted to bind
// the spies into the same hoist-scope as the factory body.
const { goBackFn, resetFn, signOutFn } = vi.hoisted(() => ({
  goBackFn: vi.fn(),
  resetFn: vi.fn(),
  signOutFn: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: goBackFn, reset: resetFn }),
}));

vi.mock('../../src/services/auth', () => ({
  signOut: signOutFn,
}));

import { LogoutModal } from '../../src/components/LogoutModal';

beforeEach(() => {
  goBackFn.mockClear();
  resetFn.mockClear();
  signOutFn.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('LogoutModal (design-spec §18.3 / AUTH-08)', () => {
  it('renders verbatim §18.3 title + body copy', () => {
    render(<LogoutModal />);
    expect(screen.getByText('Log out?')).toBeTruthy();
    expect(screen.getByText("You'll need to sign in again to keep contributing.")).toBeTruthy();
  });

  it('renders the modal container with accessibilityLabel="logout-modal"', () => {
    render(<LogoutModal />);
    expect(screen.getByLabelText('logout-modal')).toBeTruthy();
  });

  it('Cancel calls navigation.goBack and does NOT signOut', () => {
    render(<LogoutModal />);
    fireEvent.click(screen.getByLabelText('logout-cancel'));
    expect(goBackFn).toHaveBeenCalledTimes(1);
    expect(signOutFn).not.toHaveBeenCalled();
    expect(resetFn).not.toHaveBeenCalled();
  });

  it('Log out calls signOut() + navigation.reset to OnboardingStack', () => {
    render(<LogoutModal />);
    fireEvent.click(screen.getByLabelText('logout-confirm'));
    expect(signOutFn).toHaveBeenCalledTimes(1);
    expect(resetFn).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'OnboardingStack' }] });
  });
});
