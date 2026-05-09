// TopBar — Phase 2 plan 02-16 Task 1.
//
// Behaviour matrix (3 tests, drives the chrome contract):
//   Test 1: Renders the "Humyn Labs" wordmark + a Pressable with
//           accessibilityLabel="top-bar-avatar".
//   Test 2: Renders the avatarInitial fallback when no photoURL is supplied
//           (default "U", explicit "A" when passed).
//   Test 3: HOME-07 — tapping the avatar invokes onAvatarPress. The canonical
//           wiring at the call site (HomeSkeletonScreen / Tasks / History) is
//           `() => navigation.navigate('Profile')`, asserted in the
//           HomeSkeletonScreen.test below; here we only confirm the callback
//           is invoked exactly once on press.
//
// Why prop-driven (not store-driven) here: appStore.ts has no `user` field
// at Phase 2 (lands with /me hydration in plan 02-19). Each tab body
// passes `() => navigation.navigate('Profile')` explicitly, which keeps
// TopBar a pure dumb-component and the navigate target visible at the call
// site — making future PRs that touch the avatar wiring easier to grep.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { TopBar } from '../../src/components/TopBar';

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Humyn Labs logo and an avatar Pressable', () => {
    const { getByText, getByLabelText } = render(<TopBar onAvatarPress={() => undefined} />);
    expect(getByText('Humyn Labs')).toBeTruthy();
    expect(getByLabelText('top-bar-avatar')).toBeTruthy();
  });

  it('renders the supplied avatarInitial fallback when no photo is supplied', () => {
    const { getByText } = render(<TopBar onAvatarPress={() => undefined} avatarInitial="A" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('tapping the avatar invokes onAvatarPress (HOME-07: only entry point to Profile)', () => {
    const onAvatarPress = vi.fn();
    const { getByLabelText } = render(<TopBar onAvatarPress={onAvatarPress} />);
    fireEvent.click(getByLabelText('top-bar-avatar'));
    expect(onAvatarPress).toHaveBeenCalledTimes(1);
  });
});
