// PendingUploadsScreen unit tests (Plan 05-08 — UP-11 / UP-12 / UP-13).
//
// Coverage:
//   - renders rows from a mocked getQueueSafe() — name + meta + a status chip
//   - chip variant per state: uploading → "Uploading…", awaiting-verify →
//     "Uploaded — verifying…", dead-letter → "Upload failed" + a Retry button
//     that calls HumynUpload.reupload(recordingId), verified → "✓ Uploaded"
//   - the __test_offlineOverride hatch maps in-flight rows to "Paused — no Wi-Fi"
//   - only the current sub's rows render (UP-13 owner-pin)
//   - NO cancel affordance anywhere (UP-11)
//   - empty state copy
//   - the onUploadQueueChanged / onUploadProgress subscriptions are .remove()'d
//     on unmount (the bridge's leak contract)
//
// Mocking notes: we mock `../../src/native/HumynUpload` (not `react-native`) so
// the screen's bridge imports resolve to spies; @react-navigation/native +
// react-native are stubbed globally by vitest.setup.ts. `useAppStore` is
// mocked per-test so `jwt` decodes to a deterministic `sub`. `decodeGoogleSubFromJwt`
// is mocked so we don't have to hand-craft a JWT.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UploadQueueRow } from '../../../src/native/HumynUpload';

const SUB = 'sub-alice';

function row(over: Partial<UploadQueueRow>): UploadQueueRow {
  return {
    recordingId: 'rec1',
    ownerUserId: SUB,
    mp4Path: '/data/recordings/20260512_101500_001.mp4',
    csvPath: '/data/recordings/20260512_101500_001.csv',
    jsonPath: '/data/recordings/20260512_101500_001.json',
    taskId: 'cooking.make_tea',
    isPractice: false,
    state: 'uploading',
    videoParts: [],
    imuParts: [],
    metadataPut: 'pending',
    enqueuedAt: 1,
    lastProgressAt: 1,
    ...over,
  };
}

const { mockQueue, mockState, hooks } = vi.hoisted(() => ({
  mockQueue: { rows: [] as UploadQueueRow[] },
  mockState: { jwt: 'jwt-token' as string | null },
  hooks: {
    queueChangedRemove: vi.fn(),
    progressRemove: vi.fn(),
    reupload: vi.fn().mockResolvedValue(undefined),
    // Wave-1.5 Item 4 — capture the onUploadProgress listener so tests can fire it.
    progressListener: null as
      | ((e: { recordingId: string; bytesUploaded: number; bytesTotal: number }) => void)
      | null,
  },
}));

vi.mock('../../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: vi.fn(async () => mockQueue.rows),
    reupload: hooks.reupload,
  },
  onUploadQueueChanged: vi.fn(() => ({ remove: hooks.queueChangedRemove })),
  onUploadProgress: vi.fn(
    (cb: (e: { recordingId: string; bytesUploaded: number; bytesTotal: number }) => void) => {
      hooks.progressListener = cb;
      return { remove: hooks.progressRemove };
    },
  ),
}));

vi.mock('../../../src/lib/jwtSub', () => ({
  decodeGoogleSubFromJwt: (jwt: string | null) => (jwt ? SUB : ''),
}));

vi.mock('../../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: typeof mockState) => T) => selector(mockState),
}));

import PendingUploadsScreen from '../../../src/screens/uploads/PendingUploadsScreen';

describe('PendingUploadsScreen (Plan 05-08)', () => {
  afterEach(() => {
    cleanup();
    mockQueue.rows = [];
    mockState.jwt = 'jwt-token';
    hooks.queueChangedRemove.mockReset();
    hooks.progressRemove.mockReset();
    hooks.reupload.mockReset();
    hooks.reupload.mockResolvedValue(undefined);
    hooks.progressListener = null;
  });

  it('renders the empty-state copy when the queue is empty', () => {
    const { getByLabelText } = render(<PendingUploadsScreen />);
    expect(getByLabelText('pending-uploads-empty')).toBeTruthy();
  });

  it('renders a row with name + meta + a status chip from __test_rows', () => {
    const { getAllByLabelText, getByLabelText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'uploading' })]} />,
    );
    expect(getAllByLabelText('pending-upload-row')).toHaveLength(1);
    expect(getByLabelText('pending-upload-name').textContent).toBe('20260512_101500_001.mp4');
    expect(getByLabelText('pending-upload-meta')).toBeTruthy();
    // uploading → "Uploading…"
    expect(getByLabelText('upload-status-chip-progress')).toBeTruthy();
  });

  it('maps awaiting-verify → "Uploaded — verifying…" (distinct label)', () => {
    const { getByLabelText, getByText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'awaiting-verify' })]} />,
    );
    expect(getByLabelText('upload-status-chip-verifying')).toBeTruthy();
    expect(getByText('Uploaded — verifying…')).toBeTruthy();
  });

  it('maps dead-letter → "Upload failed" + a Retry button that calls HumynUpload.reupload', () => {
    const { getByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'recX', state: 'dead-letter', deadLetterReason: 'too many retries' }),
        ]}
      />,
    );
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
    fireEvent.click(getByLabelText('pending-upload-retry'));
    expect(hooks.reupload).toHaveBeenCalledWith('recX');
  });

  it('maps verified → "✓ Uploaded" (transient success chip)', () => {
    const { getByLabelText, getByText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'verified' })]} />,
    );
    expect(getByLabelText('upload-status-chip-success')).toBeTruthy();
    expect(getByText('✓ Uploaded')).toBeTruthy();
  });

  it('renders "Paused — no Wi-Fi" on in-flight rows when offline (the one new variant)', () => {
    const { getByLabelText, getByText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'uploading' })]} __test_offlineOverride />,
    );
    expect(getByLabelText('upload-status-chip-paused-offline')).toBeTruthy();
    expect(getByText('Paused — no Wi-Fi')).toBeTruthy();
  });

  it('filters out rows owned by a different sub (UP-13 owner-pin, seeded path)', () => {
    const { getAllByLabelText, getByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'mine' }),
          row({ recordingId: 'theirs', ownerUserId: 'sub-bob' }),
        ]}
      />,
    );
    expect(getAllByLabelText('pending-upload-row')).toHaveLength(1);
    expect(getByLabelText('pending-upload-name').textContent).toBe('20260512_101500_001.mp4');
  });

  it('reflects only own-sub rows from the live getQueueSafe() path', async () => {
    mockQueue.rows = [
      row({ recordingId: 'mine', ownerUserId: SUB }),
      row({ recordingId: 'theirs', ownerUserId: 'sub-bob' }),
    ];
    const { findAllByLabelText } = render(<PendingUploadsScreen />);
    const rendered = await findAllByLabelText('pending-upload-row');
    expect(rendered).toHaveLength(1);
  });

  it('has NO cancel affordance anywhere (UP-11)', () => {
    const { queryByLabelText, queryByText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ state: 'uploading' }),
          row({ recordingId: 'r2', state: 'dead-letter' }),
        ]}
      />,
    );
    expect(queryByLabelText(/cancel/i)).toBeNull();
    expect(queryByText(/cancel/i)).toBeNull();
  });

  it('.remove()s the onUploadQueueChanged / onUploadProgress subscriptions on unmount', () => {
    const { unmount } = render(<PendingUploadsScreen />);
    unmount();
    expect(hooks.queueChangedRemove).toHaveBeenCalledTimes(1);
    expect(hooks.progressRemove).toHaveBeenCalledTimes(1);
  });

  // Wave-1.5 Item 4 — live progress bar.

  it('renders the sibling progress bar when an uploading row gets a progress event', async () => {
    const { act } = await import('@testing-library/react');
    const { getByLabelText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'uploading', recordingId: 'rec1' })]} />,
    );
    // Fire a synthetic onUploadProgress event at 47%.
    act(() => {
      hooks.progressListener?.({ recordingId: 'rec1', bytesUploaded: 47, bytesTotal: 100 });
    });
    const fill = getByLabelText('pending-upload-progress-fill');
    // RN-Web renders style entries as inline CSS; the dynamic width comes through verbatim.
    const inline = (fill as HTMLElement).getAttribute('style') ?? '';
    expect(inline).toMatch(/width:\s*47%/);
  });

  it('progress bar does NOT render for awaiting-verify / verified / dead-letter rows', async () => {
    const { queryByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'r1', state: 'awaiting-verify' }),
          row({ recordingId: 'r2', state: 'verified' }),
          row({ recordingId: 'r3', state: 'dead-letter' }),
        ]}
      />,
    );
    // Even if a progress event were fired, the row.state !== 'uploading' so
    // pct stays undefined and the bar is not rendered.
    expect(queryByLabelText('pending-upload-progress-fill')).toBeNull();
  });

  it('progress bar does NOT render before a progress event arrives (uploading-but-no-progress)', () => {
    const { queryByLabelText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'uploading' })]} />,
    );
    // No progressListener fire — pct is undefined; the bar should not render.
    expect(queryByLabelText('pending-upload-progress-fill')).toBeNull();
  });

  it('chip percent label reads "Uploading… 47%" when a progress event is fired (47 of 100 bytes)', async () => {
    const { act } = await import('@testing-library/react');
    const { findByText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'uploading', recordingId: 'rec1' })]} />,
    );
    act(() => {
      hooks.progressListener?.({ recordingId: 'rec1', bytesUploaded: 47, bytesTotal: 100 });
    });
    expect(await findByText(/Uploading… 47%/)).toBeTruthy();
  });
});
