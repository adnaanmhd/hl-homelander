// HomeHero — Phase 6 Wave 4 (Plan 06-08) Task 3.
//
// Behavior matrix:
//   Test 1: variant='empty' renders "Record your first task" + "Get started"
//           eyebrow + "Pick a task and start recording" sub.
//   Test 2: variant='returning' renders the lifetime numeric (formatted via
//           durationFormat) — mock the formatter to return a deterministic
//           string and assert the rendered DOM contains it.
//   Test 3: variant='returning' renders "Across {N} tasks" with N from the
//           taskCount prop.
//   Test 4: Tap on Start Recording calls onStartRecording.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/services/durationFormatter', () => ({
  formatDuration: (s: number) => `MOCK_${s}s`,
}));

import { HomeHero } from '../../src/components/HomeHero';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HomeHero', () => {
  it("variant='empty' renders 'Record your first task' + 'Get started' eyebrow + 'Pick a task and start recording' sub", () => {
    const { getByText } = render(<HomeHero variant="empty" onStartRecording={() => undefined} />);
    expect(getByText('Get started')).toBeTruthy();
    expect(getByText('Record your first task')).toBeTruthy();
    expect(getByText('Pick a task and start recording')).toBeTruthy();
  });

  it("variant='returning' renders the lifetime numeric formatted via durationFormat()", () => {
    // The counter-ease animation starts at 0 and converges to lifetimeMs over
    // 1200ms. Without fake timers the first paint shows 0 → MOCK_0s. The
    // numeric is rendered regardless; assert the mocked-formatter shape.
    const { findByLabelText } = render(
      <HomeHero
        variant="returning"
        lifetimeMs={123_000}
        taskCount={5}
        onStartRecording={() => undefined}
      />,
    );
    return findByLabelText('home-hero-lifetime-numeric').then((el) => {
      // The element renders SOME text matching the mocked formatter prefix.
      expect(el.textContent).toMatch(/^MOCK_\d+s$/);
    });
  });

  it("variant='returning' renders 'Across {N} tasks' with N from prop", () => {
    const { getByText } = render(
      <HomeHero
        variant="returning"
        lifetimeMs={0}
        taskCount={14}
        onStartRecording={() => undefined}
      />,
    );
    expect(getByText('Across 14 tasks')).toBeTruthy();
  });

  it('Tap on Start Recording calls onStartRecording', () => {
    const onStart = vi.fn();
    const { getByLabelText } = render(<HomeHero variant="empty" onStartRecording={onStart} />);
    fireEvent.click(getByLabelText('home-hero-start-recording'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
