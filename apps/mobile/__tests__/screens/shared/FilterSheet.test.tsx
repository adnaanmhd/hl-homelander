// FilterSheet — Phase 6 Wave 4 (Plan 06-08) Task 3.
//
// Behavior matrix:
//   Test 1: Renders the 6 quick-select options (Today / Yesterday /
//           This week / This month / All time / Custom range).
//   Test 2: Selecting a non-custom option fires onChange(named) + closes
//           via onDismiss.
//   Test 3: Selecting 'Custom range' pushes to layer 16b (does NOT close).
//   Test 4: In layer 16b, Apply is disabled until both dates are valid.
//   Test 5: Inverted range (From > To) shows the inline coral error.
//   Test 6: Cancel returns to 16a without invoking onChange / onCustomChange.
//
// FilterSheet wraps a raw RN Modal; the vitest.setup.ts mock renders Modal
// as a passthrough <div>. Layer state lives inside the component; the test
// drives it via the option Pressables.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { FilterSheet } from '../../../src/screens/shared/FilterSheet';

afterEach(() => {
  cleanup();
});

describe('FilterSheet', () => {
  it('renders all 6 quick-select options', () => {
    const { getByText } = render(
      <FilterSheet
        visible={true}
        value="today"
        valueCustom={null}
        onDismiss={() => undefined}
        onChange={() => undefined}
        onCustomChange={() => undefined}
      />,
    );
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Yesterday')).toBeTruthy();
    expect(getByText('This week')).toBeTruthy();
    expect(getByText('This month')).toBeTruthy();
    expect(getByText('All time')).toBeTruthy();
    expect(getByText('Custom range')).toBeTruthy();
  });

  it('selecting a non-custom option fires onChange(named) and closes via onDismiss', () => {
    const onChange = vi.fn();
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <FilterSheet
        visible={true}
        value="today"
        valueCustom={null}
        onDismiss={onDismiss}
        onChange={onChange}
        onCustomChange={() => undefined}
      />,
    );
    fireEvent.click(getByLabelText('filter-option-yesterday'));
    expect(onChange).toHaveBeenCalledWith('yesterday');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("selecting 'Custom range' pushes to layer 16b (does NOT close)", () => {
    const onChange = vi.fn();
    const onDismiss = vi.fn();
    const { getByLabelText, queryByLabelText } = render(
      <FilterSheet
        visible={true}
        value="today"
        valueCustom={null}
        onDismiss={onDismiss}
        onChange={onChange}
        onCustomChange={() => undefined}
      />,
    );
    // 16a is visible initially
    expect(queryByLabelText('filter-sheet-16a')).toBeTruthy();
    expect(queryByLabelText('filter-sheet-16b')).toBeNull();
    fireEvent.click(getByLabelText('filter-option-custom-pick'));
    // After pushing custom, 16b is visible; 16a is gone; nothing was committed
    expect(queryByLabelText('filter-sheet-16a')).toBeNull();
    expect(queryByLabelText('filter-sheet-16b')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('in layer 16b, Apply is disabled (no-op) until both dates are valid', () => {
    const onCustomChange = vi.fn();
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <FilterSheet
        visible={true}
        value="today"
        valueCustom={null}
        onDismiss={onDismiss}
        onChange={() => undefined}
        onCustomChange={onCustomChange}
      />,
    );
    fireEvent.click(getByLabelText('filter-option-custom-pick'));
    // Empty From + To → Apply is a no-op (validation says 'missing')
    fireEvent.click(getByLabelText('filter-custom-apply'));
    expect(onCustomChange).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();

    // Plan 06-12 follow-on (Finding 5) — the From / To fields are now
    // tappable Pressables that open the native DateTimePicker; the test
    // stub renders an `<input testID="filter-custom-{from|to}-picker">`
    // we can fire `change` on to simulate a date selection.
    fireEvent.click(getByLabelText('filter-custom-from'));
    fireEvent.change(getByLabelText('filter-custom-from-picker'), {
      target: { value: '2026-05-01' },
    });
    fireEvent.click(getByLabelText('filter-custom-to'));
    fireEvent.change(getByLabelText('filter-custom-to-picker'), {
      target: { value: '2026-05-07' },
    });
    fireEvent.click(getByLabelText('filter-custom-apply'));
    expect(onCustomChange).toHaveBeenCalledWith('2026-05-01', '2026-05-07');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('inverted range (From > To) shows the inline coral error', () => {
    const { getByLabelText, queryByLabelText } = render(
      <FilterSheet
        visible={true}
        value="today"
        valueCustom={null}
        onDismiss={() => undefined}
        onChange={() => undefined}
        onCustomChange={() => undefined}
      />,
    );
    fireEvent.click(getByLabelText('filter-option-custom-pick'));
    // Plan 06-12 follow-on (Finding 5) — drive the native picker stub via
    // the testID-keyed hidden input.
    fireEvent.click(getByLabelText('filter-custom-from'));
    fireEvent.change(getByLabelText('filter-custom-from-picker'), {
      target: { value: '2026-05-07' },
    });
    fireEvent.click(getByLabelText('filter-custom-to'));
    fireEvent.change(getByLabelText('filter-custom-to-picker'), {
      target: { value: '2026-05-01' },
    });
    const err = queryByLabelText('filter-custom-error');
    expect(err).toBeTruthy();
    expect(err?.textContent).toBe('"From" date must be before "To" date.');
  });

  it('Cancel returns to 16a without invoking onChange / onCustomChange', () => {
    const onChange = vi.fn();
    const onCustomChange = vi.fn();
    const { getByLabelText, queryByLabelText } = render(
      <FilterSheet
        visible={true}
        value="today"
        valueCustom={null}
        onDismiss={() => undefined}
        onChange={onChange}
        onCustomChange={onCustomChange}
      />,
    );
    fireEvent.click(getByLabelText('filter-option-custom-pick'));
    expect(queryByLabelText('filter-sheet-16b')).toBeTruthy();
    fireEvent.click(getByLabelText('filter-custom-cancel'));
    // Back to 16a
    expect(queryByLabelText('filter-sheet-16a')).toBeTruthy();
    expect(queryByLabelText('filter-sheet-16b')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onCustomChange).not.toHaveBeenCalled();
  });
});
