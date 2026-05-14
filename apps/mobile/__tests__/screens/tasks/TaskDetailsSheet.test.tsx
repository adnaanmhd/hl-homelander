// TaskDetailsSheet — Phase 6 Plan 06-07 Task 3.
//
// Covers (TASK-04..07):
//   - Test 1: renders the 4 UniversalRules rows with verbatim labels (TASK-06
//     verbatim — "Keep your hands in frame" / "Mount the device firmly on
//     the rig" / "Make sure your space is well-lit" / "Close all other apps
//     before you start").
//   - Test 2: renders up to 3 instructions verbatim from `task.instructions`.
//   - Test 3: Outdoor chip visible when task.setting === 'outdoor'.
//   - Test 4: Outdoor chip NOT rendered when task.setting === 'indoor'.
//   - Test 5: Tap on "Start Recording" closes the sheet AND fires
//     onStartRecording(task) (the navigation lives in the caller — the sheet
//     itself just calls onStartRecording).

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Task } from '@humyn/shared-types';

// Vitest doesn't honour Metro's `.native.tsx` resolution — stub the barrel.
vi.mock('../../../../../design-system/task-icons', () => ({
  TaskIcon: (props: { task: string; size?: number; strokeWidth?: number; color?: string }) =>
    React.createElement('span', {
      'data-testid': 'TaskIcon',
      'data-task': props.task,
      size: props.size,
      'data-icon': 'TaskIconShim',
    }),
}));

import { TaskDetailsSheet } from '../../../src/screens/tasks/TaskDetailsSheet';

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: '01HVCHOPPING00000000000000',
    slug: 'chopping',
    name: 'Chopping',
    description: 'Cut vegetables on a cutting board.',
    category: 'Cooking',
    setting: 'indoor',
    iconKey: 'Carrot',
    instructions: [
      'Place a board on a steady surface.',
      'Hold the knife with a firm grip.',
      'Cut at a steady pace.',
    ],
    ...over,
  };
}

afterEach(() => {
  cleanup();
});

describe('TaskDetailsSheet (Plan 06-07 Task 3)', () => {
  it('renders the 4 UniversalRules rows with verbatim labels (TASK-06)', () => {
    const { getByText } = render(
      <TaskDetailsSheet
        visible
        task={makeTask()}
        onDismiss={() => undefined}
        onStartRecording={() => undefined}
      />,
    );
    expect(getByText('Keep your hands in frame')).toBeTruthy();
    expect(getByText('Mount the device firmly on the rig')).toBeTruthy();
    expect(getByText('Make sure your space is well-lit')).toBeTruthy();
    expect(getByText('Close all other apps before you start')).toBeTruthy();
  });

  it('renders up to 3 instructions verbatim from task.instructions', () => {
    const task = makeTask({
      instructions: [
        'Step one verbatim.',
        'Step two verbatim.',
        'Step three verbatim.',
      ],
    });
    const { getByText } = render(
      <TaskDetailsSheet
        visible
        task={task}
        onDismiss={() => undefined}
        onStartRecording={() => undefined}
      />,
    );
    expect(getByText('Step one verbatim.')).toBeTruthy();
    expect(getByText('Step two verbatim.')).toBeTruthy();
    expect(getByText('Step three verbatim.')).toBeTruthy();
  });

  it('renders the Outdoor chip when task.setting === "outdoor"', () => {
    const { getByLabelText } = render(
      <TaskDetailsSheet
        visible
        task={makeTask({ setting: 'outdoor', name: 'Walking a pet' })}
        onDismiss={() => undefined}
        onStartRecording={() => undefined}
      />,
    );
    expect(getByLabelText('task-details-outdoor-chip')).toBeTruthy();
  });

  it('does NOT render the Outdoor chip when task.setting === "indoor"', () => {
    const { queryByLabelText } = render(
      <TaskDetailsSheet
        visible
        task={makeTask({ setting: 'indoor' })}
        onDismiss={() => undefined}
        onStartRecording={() => undefined}
      />,
    );
    expect(queryByLabelText('task-details-outdoor-chip')).toBeNull();
  });

  it('tapping "Start Recording" fires onStartRecording(task)', () => {
    const task = makeTask();
    const onStartRecording = vi.fn();
    const { getByLabelText } = render(
      <TaskDetailsSheet
        visible
        task={task}
        onDismiss={() => undefined}
        onStartRecording={onStartRecording}
      />,
    );
    fireEvent.click(getByLabelText('task-details-start-recording'));
    expect(onStartRecording).toHaveBeenCalledTimes(1);
    expect(onStartRecording).toHaveBeenCalledWith(task);
  });
});
