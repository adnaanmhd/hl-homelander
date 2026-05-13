// __DEV__-gated debug affordance on TasksPlaceholderScreen — plan 04-08 / D-NAV-02.
//
// (a) __DEV__ === true (vitest default — the setup shim sets it truthy): a
//     long-press on the heading Pressable (accessibilityLabel "tasks-heading")
//     pushes the 'Recording' route with the hardcoded non-practice test task.
// (b) __DEV__ === false (stubbed before import + resetModules): the Pressable
//     wrapper / the long-press handler is absent; the screen still renders the
//     "Tasks — coming in Phase 6." copy + TopBar (no regression). Pitfall 7 —
//     the ENTIRE affordance is dead-code-eliminated in release builds.
//
// The Pressable primitive is mocked here as a <button> that forwards
// `accessibilityLabel` → `aria-label` and `onLongPress` → `onClick`, so the
// long-press intent is exercisable via `fireEvent.click` under jsdom (the RN
// host shim only maps `onPress` → onClick, not `onLongPress`).

import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockState, mockPush, mockNavigate } = vi.hoisted(() => ({
  mockState: {
    user: null as {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    } | null,
  },
  mockPush: vi.fn<(route: string, params?: Record<string, unknown>) => void>(),
  mockNavigate: vi.fn<(route: string) => void>(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: vi.fn(),
    reset: vi.fn(),
    goBack: vi.fn(),
    push: mockPush,
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('../../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: typeof mockState) => T) => selector(mockState),
}));

vi.mock('../../../src/ui/primitives/Pressable', () => {
  function PressableMock(props: {
    children?: React.ReactNode;
    accessibilityLabel?: string;
    onLongPress?: () => void;
  }) {
    return React.createElement(
      'button',
      {
        type: 'button',
        'aria-label': props.accessibilityLabel,
        onClick: props.onLongPress,
      },
      props.children,
    );
  }
  return { default: PressableMock, Pressable: PressableMock };
});

afterEach(() => {
  cleanup();
  mockState.user = null;
  mockPush.mockReset();
  mockNavigate.mockReset();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('TasksPlaceholderScreen __DEV__ debug affordance (plan 04-08)', () => {
  it('__DEV__ === true: long-press on the heading pushes the Recording route with the test task', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.resetModules();
    const { default: TasksPlaceholderScreen } = await import(
      '../../../src/screens/tasks/TasksPlaceholderScreen'
    );
    const { getByLabelText, getByText } = render(<TasksPlaceholderScreen />);
    expect(getByText('Tasks — coming in Phase 6.')).toBeTruthy();
    const heading = getByLabelText('tasks-heading');
    expect(heading).toBeTruthy();
    fireEvent.click(heading);
    // Aligned to the current dev-seed task ULID (debug session
    // `debug-task-id-init-400`, 2026-05-13). The 23-char taxonomy slug
    // `'cooking_chop_vegetables'` is rejected by `RecordingsInitRequestSchema`
    // (`z.string().length(26)`); the canonical dev-seed ULID is inserted by
    // `pnpm --filter @humyn/api seed:dev-task` and lives at
    // `DEV_TASK_ID` in `apps/api/scripts/seed-dev-task.ts`. Keep in
    // lockstep with `DEBUG_TEST_TASK` in `TasksPlaceholderScreen.tsx`.
    expect(mockPush).toHaveBeenCalledWith('Recording', {
      taskId: '01HVDEVSEEDTASK00000000000',
      taskName: 'Dev — Chop vegetables',
      isPractice: false,
      taskCategory: 'cooking',
      taskSetting: 'indoor',
    });
  });

  it('__DEV__ === false: the affordance is absent (no tasks-heading Pressable) but the copy still renders', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.resetModules();
    const { default: TasksPlaceholderScreen } = await import(
      '../../../src/screens/tasks/TasksPlaceholderScreen'
    );
    const { queryByLabelText, getByText } = render(<TasksPlaceholderScreen />);
    expect(getByText('Tasks — coming in Phase 6.')).toBeTruthy();
    expect(queryByLabelText('tasks-heading')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
