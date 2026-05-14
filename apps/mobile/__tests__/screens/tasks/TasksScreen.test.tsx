// TasksScreen — Phase 6 Plan 06-07 Task 3.
//
// Covers (TASK-01..04 + TASK-10):
//   - Test 1: renders the 11 category pills (All + 10 taxonomy categories).
//   - Test 2: renders all task cards by default (mocked fetchTasks returns 6).
//   - Test 3: tapping a category pill triggers fetchTasks({category:…}).
//   - Test 4: typing in the search input triggers useTaskSearch (we mock the
//     hook to return controllable results).
//   - Test 5: empty search results render the TASK-10 empty state (verbatim
//     "No tasks match. Try clearing filters or send a request.").
//   - Test 6: tapping a task card opens the TaskDetailsSheet (rendered via a
//     stubbed child component so we can spy on visibility).
//   - Test 7: tapping the footer "Send request →" link opens the
//     SendRequestSheet (stubbed child as in Test 6).

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task, TasksListResponse } from '@humyn/shared-types';

const { mockFetch, mockUseTaskSearch, taskDetailsSpy, sendRequestSpy } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUseTaskSearch: vi.fn(),
  taskDetailsSpy: vi.fn(),
  sendRequestSpy: vi.fn(),
}));

vi.mock('../../../src/services/tasksApi', () => ({
  fetchTasks: mockFetch,
  searchTasks: vi.fn(),
  useTaskSearch: (q: string) => mockUseTaskSearch(q),
}));

// Stub the two sheets so we can confirm visibility via a per-mount spy. The
// real sheets render Modal portals which complicate JSDOM queries; here we
// render a passthrough `<div>` with the `visible` prop forwarded so a query
// can detect the open/closed state via the aria-label data attribute.
vi.mock('../../../src/screens/tasks/TaskDetailsSheet', () => ({
  TaskDetailsSheet: (props: {
    visible: boolean;
    task: Task | null;
    onDismiss: () => void;
    onStartRecording: (t: Task) => void;
  }) => {
    taskDetailsSpy(props);
    if (!props.visible) return null;
    return React.createElement(
      'div',
      { 'aria-label': 'task-details-sheet-stub', 'data-task-id': props.task?.id ?? '' },
      'task-details-open',
    );
  },
}));
vi.mock('../../../src/screens/tasks/SendRequestSheet', () => ({
  SendRequestSheet: (props: { visible: boolean; onDismiss: () => void }) => {
    sendRequestSpy(props);
    if (!props.visible) return null;
    return React.createElement(
      'div',
      { 'aria-label': 'send-request-sheet-stub' },
      'send-request-open',
    );
  },
}));

// Stub the design-system barrel from both call-site relative paths. Each
// vi.mock factory imports React lazily inside the factory body — the factory
// is invoked after module loading begins, so React is resolvable then.
//   - TaskCard       (apps/mobile/src/components/)      → 4 levels up
//   - TaskDetailsSheet/TasksScreen direct (src/screens/tasks/) → 5 levels up
vi.mock('../../../../design-system/task-icons', async () => {
  const ReactMod = await import('react');
  return {
    TaskIcon: (props: { task: string; size?: number }) =>
      ReactMod.createElement('span', {
        'data-testid': 'TaskIcon',
        'data-task': props.task,
        size: props.size,
        'data-icon': 'TaskIconShim',
      }),
  };
});
vi.mock('../../../../../design-system/task-icons', async () => {
  const ReactMod = await import('react');
  return {
    TaskIcon: (props: { task: string; size?: number }) =>
      ReactMod.createElement('span', {
        'data-testid': 'TaskIcon',
        'data-task': props.task,
        size: props.size,
        'data-icon': 'TaskIconShim',
      }),
  };
});

vi.mock('../../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: { user: null }) => T) => selector({ user: null }),
}));

import { TasksScreen } from '../../../src/screens/tasks/TasksScreen';

const sampleTasks: Task[] = [
  {
    id: '01HVCHOPPING00000000000000',
    slug: 'chopping',
    name: 'Chopping',
    description: 'Cut vegetables on a board.',
    category: 'Cooking',
    setting: 'indoor',
    iconKey: 'Carrot',
    instructions: ['Use a board.', 'Hold the knife firmly.'],
  },
  {
    id: '01HVDICING00000000000000000',
    slug: 'dicing',
    name: 'Dicing',
    description: 'Dice vegetables.',
    category: 'Cooking',
    setting: 'indoor',
    iconKey: 'Grid2x2',
    instructions: ['Use a board.'],
  },
  {
    id: '01HVSLICING0000000000000000',
    slug: 'slicing',
    name: 'Slicing',
    description: 'Slice vegetables.',
    category: 'Cooking',
    setting: 'indoor',
    iconKey: 'Slice',
    instructions: ['Steady the food.'],
  },
  {
    id: '01HVPEELING0000000000000000',
    slug: 'peeling',
    name: 'Peeling',
    description: 'Peel produce.',
    category: 'Cooking',
    setting: 'indoor',
    iconKey: 'Banana',
    instructions: [],
  },
  {
    id: '01HVDISHWASH000000000000000',
    slug: 'dishwashing',
    name: 'Washing dishes',
    description: 'Wash dishes.',
    category: 'Dishwashing',
    setting: 'indoor',
    iconKey: 'Bath',
    instructions: [],
  },
  {
    id: '01HVCLEANING00000000000000',
    slug: 'cleaning',
    name: 'Sweeping',
    description: 'Sweep the floor.',
    category: 'Cleaning',
    setting: 'indoor',
    iconKey: 'Brush',
    instructions: [],
  },
];
const listResponse: TasksListResponse = { items: sampleTasks, nextCursor: null };

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(listResponse);
  mockUseTaskSearch.mockReset();
  mockUseTaskSearch.mockReturnValue({ results: null, loading: false, error: null });
  taskDetailsSpy.mockReset();
  sendRequestSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('TasksScreen (Plan 06-07 Task 3)', () => {
  it('renders the 11 category pills (All + 10 taxonomy categories)', async () => {
    const { getByLabelText } = render(<TasksScreen />);
    expect(getByLabelText('pill-all')).toBeTruthy();
    expect(getByLabelText('pill-Cooking')).toBeTruthy();
    expect(getByLabelText('pill-Dishwashing')).toBeTruthy();
    expect(getByLabelText('pill-Kitchen')).toBeTruthy();
    expect(getByLabelText('pill-Cleaning')).toBeTruthy();
    expect(getByLabelText('pill-Tidying')).toBeTruthy();
    expect(getByLabelText('pill-Laundry')).toBeTruthy();
    expect(getByLabelText('pill-Gardening')).toBeTruthy();
    expect(getByLabelText('pill-Pet Care')).toBeTruthy();
    expect(getByLabelText('pill-Home Maintenance')).toBeTruthy();
    expect(getByLabelText('pill-Hobby')).toBeTruthy();
  });

  it('renders all task cards by default (mocked fetchTasks returns 6)', async () => {
    const { getByLabelText } = render(<TasksScreen />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await waitFor(() => expect(getByLabelText('task-card-chopping')).toBeTruthy());
    expect(getByLabelText('task-card-dicing')).toBeTruthy();
    expect(getByLabelText('task-card-cleaning')).toBeTruthy();
  });

  it('tapping a category pill re-fires fetchTasks with the new category', async () => {
    const { getByLabelText } = render(<TasksScreen />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    mockFetch.mockClear();
    fireEvent.click(getByLabelText('pill-Cooking'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenLastCalledWith({ category: 'Cooking' });
  });

  it('typing in the search input updates the query that feeds useTaskSearch (200ms debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { getByLabelText } = render(<TasksScreen />);
      const input = getByLabelText('task-search-input');
      fireEvent.change(input, { target: { value: 'chop' } });
      // Advance past the 200ms debounce window.
      await vi.advanceTimersByTimeAsync(220);
      // useTaskSearch is called every render with the latest debouncedQuery.
      // After the 200ms timer fires the most recent call args should be
      // 'chop'.
      const lastCall = mockUseTaskSearch.mock.calls[mockUseTaskSearch.mock.calls.length - 1];
      expect(lastCall[0]).toBe('chop');
    } finally {
      vi.useRealTimers();
    }
  });

  it('TASK-10: empty search results render "No tasks match. Try clearing filters or send a request."', async () => {
    mockUseTaskSearch.mockReturnValue({ results: [], loading: false, error: null });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { getByLabelText, getByText } = render(<TasksScreen />);
      fireEvent.change(getByLabelText('task-search-input'), { target: { value: 'zzz' } });
      await vi.advanceTimersByTimeAsync(220);
      // The TASK-10 verbatim copy lives inside a multi-Text composition, so
      // assert the leading phrase + the inline link separately.
      expect(getByText(/No tasks match\. Try clearing filters or/)).toBeTruthy();
      expect(getByLabelText('tasks-empty-send-request')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('tapping a task card opens the TaskDetailsSheet', async () => {
    const { getByLabelText } = render(<TasksScreen />);
    await waitFor(() => expect(getByLabelText('task-card-chopping')).toBeTruthy());
    fireEvent.click(getByLabelText('task-card-chopping'));
    await waitFor(() => expect(getByLabelText('task-details-sheet-stub')).toBeTruthy());
    // The stub records every prop snapshot. The final call should be visible:true
    const lastCall = taskDetailsSpy.mock.calls[taskDetailsSpy.mock.calls.length - 1];
    expect(lastCall[0].visible).toBe(true);
    expect(lastCall[0].task?.id).toBe('01HVCHOPPING00000000000000');
  });

  it('tapping the footer "Send request →" link opens the SendRequestSheet', async () => {
    const { getByLabelText } = render(<TasksScreen />);
    await waitFor(() => expect(getByLabelText('task-card-chopping')).toBeTruthy());
    fireEvent.click(getByLabelText('tasks-footer-send-request'));
    await waitFor(() => expect(getByLabelText('send-request-sheet-stub')).toBeTruthy());
    const lastCall = sendRequestSpy.mock.calls[sendRequestSpy.mock.calls.length - 1];
    expect(lastCall[0].visible).toBe(true);
  });
});
