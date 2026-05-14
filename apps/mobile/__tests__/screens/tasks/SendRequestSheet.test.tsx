// SendRequestSheet — Phase 6 Plan 06-07 Task 3.
//
// Covers (TASK-08 / TASK-09):
//   - Test 1: Submit button disabled when name < 3 chars.
//   - Test 2: Submit button disabled when description < 10 chars.
//   - Test 3: Inline coral error "Task name needs at least 3 characters."
//     surfaces when name has been touched but is < 3.
//   - Test 4: Successful submit calls submitTaskRequest({…}) AND shows the
//     success toast (showToast spy) AND closes the sheet (onDismiss called).
//   - Test 5: Failed submit shows the in-sheet banner "Couldn't send. Try
//     again." + Retry link; tapping Retry re-fires submitTaskRequest.

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSubmit, mockShowToast } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock('../../../src/services/taskRequestService', () => ({
  submitTaskRequest: mockSubmit,
}));
vi.mock('../../../src/components/Toast', () => ({
  showToast: mockShowToast,
  DEFAULT_TOAST_MS: 2000,
  hideToast: vi.fn(),
  ToastHost: () => null,
}));

import { SendRequestSheet } from '../../../src/screens/tasks/SendRequestSheet';

function fillValidForm(getByLabelText: (label: string) => HTMLElement) {
  // Pick a category first (required for the submit-enabled check).
  fireEvent.click(getByLabelText('send-request-category-Cooking'));
  const name = getByLabelText('send-request-name');
  fireEvent.change(name, { target: { value: 'Iron clothes' } });
  const desc = getByLabelText('send-request-description');
  fireEvent.change(desc, {
    target: { value: 'A short description of what to record.' },
  });
}

beforeEach(() => {
  mockSubmit.mockReset();
  mockShowToast.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SendRequestSheet (Plan 06-07 Task 3)', () => {
  it('Submit button disabled when name < 3 chars', () => {
    const { getByLabelText } = render(
      <SendRequestSheet visible onDismiss={() => undefined} />,
    );
    // Pick a category + valid description but leave name short
    fireEvent.click(getByLabelText('send-request-category-Cooking'));
    fireEvent.change(getByLabelText('send-request-description'), {
      target: { value: 'long enough description here' },
    });
    fireEvent.change(getByLabelText('send-request-name'), { target: { value: 'AB' } });
    const submitBtn = getByLabelText('send-request-submit');
    // The Button primitive applies opacity 0.4 and suppresses onPress when
    // disabled. We assert the accessibilityState exposes `disabled: true` via
    // the aria-disabled attribute the RN shim forwards.
    // The Button primitive uses `accessibilityState={{ disabled }}` which RN-on-
    // DOM doesn't translate to aria-disabled in the shim; check by clicking and
    // confirming submitTaskRequest is NOT invoked.
    fireEvent.click(submitBtn);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('Submit button disabled when description < 10 chars', () => {
    const { getByLabelText } = render(
      <SendRequestSheet visible onDismiss={() => undefined} />,
    );
    fireEvent.click(getByLabelText('send-request-category-Cooking'));
    fireEvent.change(getByLabelText('send-request-name'), {
      target: { value: 'Iron clothes' },
    });
    fireEvent.change(getByLabelText('send-request-description'), {
      target: { value: 'short' },
    });
    fireEvent.click(getByLabelText('send-request-submit'));
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('inline coral error "Task name needs at least 3 characters." surfaces when name length 1-2', () => {
    const { getByLabelText, getByText } = render(
      <SendRequestSheet visible onDismiss={() => undefined} />,
    );
    fireEvent.change(getByLabelText('send-request-name'), { target: { value: 'A' } });
    expect(getByText('Task name needs at least 3 characters.')).toBeTruthy();
  });

  it('successful submit calls submitTaskRequest and shows success toast + closes sheet', async () => {
    mockSubmit.mockResolvedValue({ id: '01HVTASKREQ0000000000000000' });
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <SendRequestSheet visible onDismiss={onDismiss} />,
    );
    fillValidForm(getByLabelText);
    fireEvent.click(getByLabelText('send-request-submit'));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit).toHaveBeenCalledWith({
      name: 'Iron clothes',
      description: 'A short description of what to record.',
      category: 'Cooking',
      setting: 'indoor',
    });
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        "Request sent. We'll review and add it to your list.",
        2000,
      ),
    );
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('failed submit shows banner "Couldn\'t send. Try again." + Retry link re-fires submit', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('boom'));
    const { getByLabelText, getByText } = render(
      <SendRequestSheet visible onDismiss={() => undefined} />,
    );
    fillValidForm(getByLabelText);
    fireEvent.click(getByLabelText('send-request-submit'));
    await waitFor(() =>
      expect(getByText(/Couldn't send\. Try again\./)).toBeTruthy(),
    );

    // Tap Retry — the second attempt resolves successfully.
    mockSubmit.mockResolvedValueOnce({ id: '01HVTASKREQ0000000000000001' });
    fireEvent.click(getByLabelText('send-request-retry'));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(2));
  });
});
