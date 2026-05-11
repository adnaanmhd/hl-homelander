// Plan 04-06 — PracticeIntroScreen contract (ONB-03, design-spec §6).
//
// Five behaviours, driven through the JSDOM host-component shim (vitest.setup.ts):
//
// Test 1: Verbatim §6 heading + body + muted-line copy renders.
// Test 2: "Start practice" CTA renders.
// Test 3: practice_intro_shown analytics event fires once on mount.
// Test 4: Tap "Start practice" → practice_started fires AND navigation
//         leaves OnboardingStack to 'Recording' with the practice route
//         params { taskId: '__practice__', taskName: 'Practice — 60 sec',
//         isPractice: true }. The screen prefers the parent navigator's
//         replace (Recording is a RootNativeStack route, plan 04-07).
// Test 5: Falls back to the local navigator's replace when getParent() has
//         no replace.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockReplace, mockParentReplace, mockGetParent, mockLogEvent } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockParentReplace: vi.fn(),
  mockGetParent: vi.fn(),
  mockLogEvent: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
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

vi.mock('../../src/util/analytics', () => ({
  logEvent: mockLogEvent,
  EVENT_NAMES: ['practice_intro_shown', 'practice_started'],
}));

import PracticeIntroScreen from '../../src/screens/tutorial/PracticeIntroScreen';

const PRACTICE_PARAMS = {
  taskId: '__practice__',
  taskName: 'Practice — 60 sec',
  isPractice: true,
};

describe('PracticeIntroScreen (plan 04-06 — ONB-03, design-spec §6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetParent.mockReturnValue({ replace: mockParentReplace });
  });
  afterEach(() => cleanup());

  it('Test 1: renders the verbatim §6 heading + body + muted-line copy', () => {
    const { getByText } = render(<PracticeIntroScreen />);
    expect(getByText('One quick try')).toBeTruthy();
    expect(
      getByText("We'll walk you through one short recording — 60 seconds, just to get the feel."),
    ).toBeTruthy();
    expect(
      getByText('This is a practice task — it does not count towards your contribution.'),
    ).toBeTruthy();
  });

  it('Test 2: renders the "Start practice" CTA', () => {
    const { getByLabelText } = render(<PracticeIntroScreen />);
    expect(getByLabelText('Start practice')).toBeTruthy();
  });

  it('Test 3: practice_intro_shown fires once on mount', () => {
    render(<PracticeIntroScreen />);
    expect(mockLogEvent).toHaveBeenCalledWith('practice_intro_shown');
    expect(mockLogEvent.mock.calls.filter((c) => c[0] === 'practice_intro_shown')).toHaveLength(1);
  });

  it('Test 4: tap "Start practice" → practice_started + parent.replace("Recording", practiceParams)', () => {
    const { getByLabelText } = render(<PracticeIntroScreen />);
    fireEvent.click(getByLabelText('Start practice'));
    expect(mockLogEvent).toHaveBeenCalledWith('practice_started');
    expect(mockParentReplace).toHaveBeenCalledWith('Recording', PRACTICE_PARAMS);
    // Local navigator NOT used when the parent has replace.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Test 5: falls back to local navigator.replace when getParent() lacks replace', () => {
    mockGetParent.mockReturnValue(undefined);
    const { getByLabelText } = render(<PracticeIntroScreen />);
    fireEvent.click(getByLabelText('Start practice'));
    expect(mockReplace).toHaveBeenCalledWith('Recording', PRACTICE_PARAMS);
  });
});
