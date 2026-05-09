// HomeSkeletonScreen — Phase 2 plan 02-16 Task 2.
//
// Behaviour matrix (3 tests, drives the Phase 2 Home shell contract):
//   Test 1: Renders the TopBar (Humyn Labs wordmark) + an avatar Pressable
//           wired to navigate to Profile (HOME-07: only entry point).
//   Test 2: Hides the soft-upgrade banner slot when softUpgradeAvailable=null.
//   Test 3: Renders the soft-upgrade banner slot when softUpgradeAvailable
//           is non-null (plan 02-20 wires the actual banner into this slot).
//
// Mocking notes:
//   - vitest.setup.ts mocks @react-navigation/native globally (useNavigation
//     returns spy fns); we use that as-is.
//   - useAppStore is mocked per-test via vi.hoisted so a single hoisted
//     selector spy can return different shapes for the soft-upgrade-on/off
//     branches. The Zustand-style selector hook contract is preserved:
//     `useAppStore((s) => s.softUpgradeAvailable)` returns the value the
//     selector pulls from the synthetic state object.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted spies — declared at the same hoisted level as the vi.mock
// factory below so the factory can reference them safely. Module-level
// const declarations execute AFTER hoisted vi.mock factories.
// ---------------------------------------------------------------------------
const { mockState } = vi.hoisted(() => ({
  mockState: { softUpgradeAvailable: null as { latest: string } | null },
}));

vi.mock('../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: typeof mockState) => T) => selector(mockState),
}));

// Import AFTER the mock so the screen's import of useAppStore resolves to
// the mocked module.
import HomeSkeletonScreen from '../../src/screens/home/HomeSkeletonScreen';

describe('HomeSkeletonScreen', () => {
  afterEach(() => {
    cleanup();
    mockState.softUpgradeAvailable = null;
  });

  it('renders the TopBar (Humyn Labs wordmark) and an avatar Pressable', () => {
    const { getByText, getByLabelText } = render(<HomeSkeletonScreen />);
    expect(getByText('Humyn Labs')).toBeTruthy();
    expect(getByLabelText('top-bar-avatar')).toBeTruthy();
  });

  it('hides the soft-upgrade banner slot when softUpgradeAvailable is null', () => {
    mockState.softUpgradeAvailable = null;
    const { queryByLabelText } = render(<HomeSkeletonScreen />);
    expect(queryByLabelText('soft-upgrade-banner-slot')).toBeNull();
  });

  it('renders the soft-upgrade banner slot when softUpgradeAvailable is non-null', () => {
    mockState.softUpgradeAvailable = { latest: '0.16.0' };
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    expect(getByLabelText('soft-upgrade-banner-slot')).toBeTruthy();
  });
});
