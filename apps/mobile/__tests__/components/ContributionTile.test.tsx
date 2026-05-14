// ContributionTile — Phase 6 Wave 4 (Plan 06-08) Task 3.
//
// Behavior matrix:
//   Test 1: Renders `valueText` (mono numeric).
//   Test 2: Renders the `rangeLabel` (e.g. "today ▾").
//   Test 3: Tap on the chevron-row calls `onTapChip`.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { ContributionTile } from '../../src/components/ContributionTile';

afterEach(() => {
  cleanup();
});

describe('ContributionTile', () => {
  it('renders the valueText', () => {
    const { getByText } = render(
      <ContributionTile
        kind="duration"
        valueText="47m"
        rangeLabel="today ▾"
        onTapChip={() => undefined}
      />,
    );
    expect(getByText('47m')).toBeTruthy();
  });

  it('renders the rangeLabel', () => {
    const { getByText } = render(
      <ContributionTile
        kind="taskCount"
        valueText="3"
        rangeLabel="today ▾"
        onTapChip={() => undefined}
      />,
    );
    expect(getByText('today ▾')).toBeTruthy();
  });

  it('Tap on the chevron-row calls onTapChip', () => {
    const onTap = vi.fn();
    const { getByLabelText } = render(
      <ContributionTile kind="duration" valueText="47m" rangeLabel="today ▾" onTapChip={onTap} />,
    );
    fireEvent.click(getByLabelText('contribution-tile-duration-filter'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
