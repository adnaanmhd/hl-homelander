// TaskCard — Phase 6 Plan 06-07 Task 3.
//
// Covers:
//   - Test 1: renders the task name verbatim.
//   - Test 2: renders the category eyebrow UPPERCASE.
//   - Test 3: description renders with numberOfLines={2}.
//   - Test 4: TaskIcon mounts with size=28 + strokeWidth=1.75 (forwarded to
//     the underlying lucide stub via data-* attributes the lucide mock emits).
//   - Test 5: onPress callback fires when the card is pressed.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// The barrel `design-system/task-icons` re-exports from the web `TaskIcon.tsx`
// (lucide-react); vitest's resolver doesn't honour Metro's `.native.tsx` rule.
// Stub the barrel here so tests run against a minimal TaskIcon that forwards
// size + strokeWidth + color to a span the assertions can read.
vi.mock('../../../../design-system/task-icons', () => ({
  TaskIcon: (props: { task: string; size?: number; strokeWidth?: number; color?: string }) =>
    React.createElement('span', {
      'data-testid': 'TaskIcon',
      'data-task': props.task,
      size: props.size,
      strokeWidth: props.strokeWidth,
      'data-color': props.color,
      'data-icon': 'TaskIconShim',
    }),
}));

import { TaskCard } from '../../src/components/TaskCard';

afterEach(() => {
  cleanup();
});

describe('TaskCard (Plan 06-07 Task 3)', () => {
  it('renders the task name verbatim', () => {
    const { getByText } = render(
      <TaskCard
        slug="chopping"
        name="Chopping"
        category="Cooking"
        description="Cut vegetables on a board."
      />,
    );
    expect(getByText('Chopping')).toBeTruthy();
  });

  it('renders the category eyebrow UPPERCASE', () => {
    const { getByText } = render(
      <TaskCard
        slug="chopping"
        name="Chopping"
        category="Cooking"
        description="Cut vegetables on a board."
      />,
    );
    expect(getByText('COOKING')).toBeTruthy();
  });

  it('renders the description with numberOfLines={2} prop on the underlying Text element', () => {
    const { getByLabelText } = render(
      <TaskCard
        slug="chopping"
        name="Chopping"
        category="Cooking"
        description="A very long description that would otherwise wrap to many lines but the TaskCard clamps it to two."
      />,
    );
    const descNode = getByLabelText('task-card-chopping-desc');
    // The vitest react-native shim passes RN props through to the DOM, so
    // numberOfLines=2 becomes the attribute `numberoflines="2"` on the div.
    expect(descNode.getAttribute('numberoflines')).toBe('2');
  });

  it('renders TaskIcon at size 28 + strokeWidth 1.75 via the lucide stub', () => {
    const { container } = render(
      <TaskCard
        slug="chopping"
        name="Chopping"
        category="Cooking"
        description="Cut vegetables."
      />,
    );
    // The lucide mock renders <span data-icon="<Name>" {...props}>. The
    // TaskIcon resolves "chopping" → "Carrot" (per mapping.ts) but in the
    // vitest setup only an allow-list of icons resolves; everything else
    // falls through to the Sparkles fallback. Either way we should see at
    // least one element with size + strokeWidth attributes mirroring the
    // 28 / 1.75 props.
    const icons = container.querySelectorAll('[data-icon]');
    expect(icons.length).toBeGreaterThan(0);
    // The first <span data-icon> is the task-card icon (UniversalRulesBlock
    // is NOT rendered by TaskCard). Assert the size + strokeWidth attrs.
    const first = icons[0] as HTMLElement;
    // React DOM converts camelCase props to kebab-case for unknown
    // attributes (`strokeWidth` → `stroke-width`). Native RN keeps the
    // camelCase contract; on-device this is `strokeWidth={1.75}` per spec.
    expect(first.getAttribute('size')).toBe('28');
    expect(first.getAttribute('stroke-width')).toBe('1.75');
  });

  it('onPress callback fires when pressed', () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(
      <TaskCard
        slug="chopping"
        name="Chopping"
        category="Cooking"
        description="Cut vegetables."
        onPress={onPress}
      />,
    );
    fireEvent.click(getByLabelText('task-card-chopping'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
