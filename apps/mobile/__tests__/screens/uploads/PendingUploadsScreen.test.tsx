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
  // Bug 7 — PendingUploads now reads rows + progress from the store slice (fed
  // by the boot installer) instead of a local subscription. `uploadQueue` seeds
  // the live path; `uploadProgressById` seeds per-recording upload percent.
  mockState: {
    jwt: 'jwt-token' as string | null,
    uploadQueue: [] as UploadQueueRow[],
    uploadProgressById: {} as Record<string, number>,
  },
  hooks: {
    queueChangedRemove: vi.fn(),
    progressRemove: vi.fn(),
    // Enh 3 / D1 (2026-06-04): dead-letter Retry routes through reviveDeadLetterSafe
    // (was reupload — the /reupload endpoint + method were removed).
    reviveDeadLetterSafe: vi.fn().mockResolvedValue(undefined),
    retryNeedsAttentionSafe: vi.fn().mockResolvedValue(false),
    // Wave-1.5 Item 4 — capture the onUploadProgress listener so tests can fire it.
    progressListener: null as
      | ((e: { recordingId: string; bytesUploaded: number; bytesTotal: number }) => void)
      | null,
  },
}));

vi.mock('../../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: vi.fn(async () => mockQueue.rows),
    reviveDeadLetterSafe: hooks.reviveDeadLetterSafe,
    retryNeedsAttentionSafe: hooks.retryNeedsAttentionSafe,
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
    mockState.uploadQueue = [];
    mockState.uploadProgressById = {};
    hooks.queueChangedRemove.mockReset();
    hooks.progressRemove.mockReset();
    hooks.reviveDeadLetterSafe.mockReset();
    hooks.reviveDeadLetterSafe.mockResolvedValue(undefined);
    hooks.retryNeedsAttentionSafe.mockReset();
    hooks.retryNeedsAttentionSafe.mockResolvedValue(false);
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

  // (Enh 3 / D1, 2026-06-04: 'awaiting-verify' / 'verified' queue states +
  // the 'verifying' chip were removed — a row that reaches terminal success is
  // deleted from the queue on /finalize 200.)

  it('maps dead-letter → "Upload failed" + a Retry button that calls reviveDeadLetterSafe', () => {
    const { getByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'recX', state: 'dead-letter', deadLetterReason: 'too many retries' }),
        ]}
      />,
    );
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
    fireEvent.click(getByLabelText('pending-upload-retry'));
    expect(hooks.reviveDeadLetterSafe).toHaveBeenCalledWith('recX');
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

  it('reflects only own-sub rows from the store queue (UP-13 owner-pin)', async () => {
    mockState.uploadQueue = [
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

  // Bug 7 (2026-06-04) — the screen no longer subscribes to
  // onUploadQueueChanged / onUploadProgress directly (the single boot installer
  // does, covered by `__tests__/services/uploadQueueStore.test.ts`). The former
  // ".remove() on unmount" leak-contract test moved with the subscription.

  // Wave-1.5 Item 4 — live progress bar (now fed by the store's progress map).

  it('renders the sibling progress bar at the stored percent for an uploading row', () => {
    // Bug 7 — progress comes from the store slice (set by the boot installer's
    // onUploadProgress handler), keyed by recordingId. 47 → width: 47%.
    mockState.uploadProgressById = { rec1: 47 };
    const { getByLabelText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'uploading', recordingId: 'rec1' })]} />,
    );
    const fill = getByLabelText('pending-upload-progress-fill');
    // RN-Web renders style entries as inline CSS; the dynamic width comes through verbatim.
    const inline = (fill as HTMLElement).getAttribute('style') ?? '';
    expect(inline).toMatch(/width:\s*47%/);
  });

  it('progress bar does NOT render for finalizing / dead-letter / needs-attention rows', async () => {
    const { queryByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'r1', state: 'finalizing' }),
          row({ recordingId: 'r2', state: 'needs-attention' }),
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

  it('chip percent label reads "Uploading… 47%" from the stored progress percent', async () => {
    mockState.uploadProgressById = { rec1: 47 };
    const { findByText } = render(
      <PendingUploadsScreen __test_rows={[row({ state: 'uploading', recordingId: 'rec1' })]} />,
    );
    expect(await findByText(/Uploading… 47%/)).toBeTruthy();
  });
});
