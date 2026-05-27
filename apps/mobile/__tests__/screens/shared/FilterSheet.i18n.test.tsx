// FilterSheet — Plan 07-16 Task 4b G-21.
//
// Pins the 16a layer's i18n contract: the 6 OPTIONS rows + the "Filter by"
// title route through `history.filter.*` + `history.filterSheet.title`.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { FilterSheet } from '../../../src/screens/shared/FilterSheet';
import i18n from '../../../src/i18n';
import enJson from '../../../src/i18n/locales/en.json';

describe('FilterSheet — Plan 07-16 G-21 (i18n)', () => {
  afterEach(() => {
    cleanup();
  });

  it('en.json carries the 6 history.filter.* keys (reused) + history.filterSheet.title', () => {
    expect(enJson.history.filter.today).toBe('Today');
    expect(enJson.history.filter.yesterday).toBe('Yesterday');
    expect(enJson.history.filter.thisWeek).toBe('This week');
    expect(enJson.history.filter.thisMonth).toBe('This month');
    expect(enJson.history.filter.allTime).toBe('All time');
    // Plan 07-17 G-21: the base-sheet chip label was renamed from
    // `customRange` (string) to `customRangeChip` so the new `customRange`
    // slot can hold the Custom-range sub-sheet's 9-sub-key object.
    expect((enJson.history.filter as Record<string, unknown>).customRangeChip).toBe('Custom range');
    expect(enJson.history.filterSheet.title).toBe('Filter by');
  });

  it('renders the 6 quick-select option rows with stable accessibility labels', () => {
    void i18n.changeLanguage('en');
    const { getByLabelText } = render(
      <FilterSheet
        visible
        value="today"
        onDismiss={() => undefined}
        onChange={() => undefined}
        onCustomChange={() => undefined}
      />,
    );
    // The 6 option rows
    expect(getByLabelText('filter-option-today')).toBeTruthy();
    expect(getByLabelText('filter-option-yesterday')).toBeTruthy();
    expect(getByLabelText('filter-option-this-week')).toBeTruthy();
    expect(getByLabelText('filter-option-this-month')).toBeTruthy();
    expect(getByLabelText('filter-option-all')).toBeTruthy();
    expect(getByLabelText('filter-option-custom-pick')).toBeTruthy();
  });
});
