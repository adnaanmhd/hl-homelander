// TasksPlaceholderScreen unit tests — Plan 03-03 Task 1.
//
// Coverage:
//   - Tasks tab renders the TopBar with the Google avatar from
//     `appStore.user` (NOT the 'U' fallback). Pre-fix this screen rendered
//     `<TopBar onAvatarPress={…} />` with no avatarInitial / avatarUrl.
//     See `02-COSMETIC-GAPS.md` § Profile screen item 1.
//   - Avatar image (Pattern 64) renders when `avatarUrl` is set.
//   - Falls back to 'U' initial when `appStore.user` is null (foreground-
//     rehydrate window — Plan 03-03 Task 2 closes that hole).
//   - Tapping the avatar fires navigation.navigate('Profile') (HOME-07
//     entry-point invariant; the only way to reach Profile from a tab body).
//
// Mocking notes: Pattern 47 vi.hoisted spy binding for the
// `@react-navigation/native` mock (so the navigate spy is live before the
// vi.mock factory body executes). useAppStore is mocked per-test via the same
// hoisted shape used in HomeSkeletonScreen.test.tsx so the screen's
// `useTabTopBarProps()` selector resolves through the mock.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

type MockUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
} | null;

const { mockState, mockNavigate } = vi.hoisted(() => ({
  mockState: { user: null as MockUser },
  mockNavigate: vi.fn<(route: string) => void>(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: vi.fn(),
    reset: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: typeof mockState) => T) => selector(mockState),
}));

import TasksPlaceholderScreen from '../../src/screens/tasks/TasksPlaceholderScreen';

describe('TasksPlaceholderScreen (Plan 03-03 Task 1)', () => {
  afterEach(() => {
    cleanup();
    mockState.user = null;
    mockNavigate.mockReset();
  });

  it('renders the Tasks placeholder copy + TopBar wordmark + avatar Pressable', () => {
    const { getByText, getByLabelText } = render(<TasksPlaceholderScreen />);
    expect(getByText('Tasks — coming in Phase 6.')).toBeTruthy();
    expect(getByText('Humyn Labs')).toBeTruthy();
    expect(getByLabelText('top-bar-avatar')).toBeTruthy();
  });

  it('renders the Google avatar Image when appStore.user.avatarUrl is set (NOT "U" fallback)', () => {
    mockState.user = {
      id: '1',
      email: 'alice@x.com',
      name: 'Alice',
      avatarUrl: 'https://x/a.jpg',
    };
    const { getByLabelText, queryByText } = render(<TasksPlaceholderScreen />);
    expect(getByLabelText('top-bar-avatar-image')).toBeTruthy();
    // 'U' fallback MUST be absent when avatarUrl is set.
    expect(queryByText('U')).toBeNull();
  });

  it('renders the user-name initial when avatarUrl is null but name is set', () => {
    mockState.user = {
      id: '1',
      email: 'bob@x.com',
      name: 'Bob',
      avatarUrl: null,
    };
    const { getByText, queryByLabelText } = render(<TasksPlaceholderScreen />);
    expect(getByText('B')).toBeTruthy();
    expect(queryByLabelText('top-bar-avatar-image')).toBeNull();
  });

  it('falls back to "U" initial when appStore.user is null (pre-rehydrate window)', () => {
    mockState.user = null;
    const { getByText, queryByLabelText } = render(<TasksPlaceholderScreen />);
    expect(getByText('U')).toBeTruthy();
    expect(queryByLabelText('top-bar-avatar-image')).toBeNull();
  });

  it('tapping the avatar fires navigation.navigate("Profile")', () => {
    const { getByLabelText } = render(<TasksPlaceholderScreen />);
    fireEvent.click(getByLabelText('top-bar-avatar'));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });
});
