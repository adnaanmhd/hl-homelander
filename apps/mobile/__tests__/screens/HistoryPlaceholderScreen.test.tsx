// HistoryPlaceholderScreen unit tests — Plan 03-03 Task 1.
//
// Coverage mirrors TasksPlaceholderScreen.test.tsx (sibling regression — same
// bug class fixed in the same commit). See that file for the gap context.

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

import HistoryPlaceholderScreen from '../../src/screens/history/HistoryPlaceholderScreen';

describe('HistoryPlaceholderScreen (Plan 03-03 Task 1)', () => {
  afterEach(() => {
    cleanup();
    mockState.user = null;
    mockNavigate.mockReset();
  });

  it('renders the History placeholder copy + TopBar wordmark + avatar Pressable', () => {
    const { getByText, getByLabelText } = render(<HistoryPlaceholderScreen />);
    expect(getByText('History — coming in Phase 6.')).toBeTruthy();
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
    const { getByLabelText, queryByText } = render(<HistoryPlaceholderScreen />);
    expect(getByLabelText('top-bar-avatar-image')).toBeTruthy();
    expect(queryByText('U')).toBeNull();
  });

  it('renders the user-name initial when avatarUrl is null but name is set', () => {
    mockState.user = {
      id: '1',
      email: 'bob@x.com',
      name: 'Bob',
      avatarUrl: null,
    };
    const { getByText, queryByLabelText } = render(<HistoryPlaceholderScreen />);
    expect(getByText('B')).toBeTruthy();
    expect(queryByLabelText('top-bar-avatar-image')).toBeNull();
  });

  it('falls back to "U" initial when appStore.user is null (pre-rehydrate window)', () => {
    mockState.user = null;
    const { getByText, queryByLabelText } = render(<HistoryPlaceholderScreen />);
    expect(getByText('U')).toBeTruthy();
    expect(queryByLabelText('top-bar-avatar-image')).toBeNull();
  });

  it('tapping the avatar fires navigation.navigate("Profile")', () => {
    const { getByLabelText } = render(<HistoryPlaceholderScreen />);
    fireEvent.click(getByLabelText('top-bar-avatar'));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });
});
