// Quick task 260517-p5g CAPTURE-QA-05 — PendingUploadsScreen defensive
// filter for canceled-segment rows.
//
// Test G: When `__test_rows` includes a row with `cancelReason='fps_dropped'`
//         (defensive — should never happen at runtime since
//         UploadQueueStore.enqueue refuses canceled rows + the JS-side
//         RecordingScreen handler is the primary gate), the screen
//         filters it out and does NOT render a row.
// Test H: Normal {pending,uploading,dead-letter} rows continue to render
//         (regression guard).
//
// Mirrors the existing PendingUploadsScreen.test.tsx scaffolding —
// mocks `../../src/native/HumynUpload` and `../../src/state/appStore` so
// the screen's bridge imports resolve to spies; the canonical
// vitest.setup react-native shim covers the host components.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UploadQueueRow } from '../../../src/native/HumynUpload';

const SUB = 'sub-alice';

function row(over: Partial<UploadQueueRow>): UploadQueueRow {
  return {
    recordingId: 'rec-default',
    ownerUserId: SUB,
    mp4Path: '/data/recordings/20260517_120000_001.mp4',
    csvPath: '/data/recordings/20260517_120000_001.csv',
    jsonPath: '/data/recordings/20260517_120000_001.json',
    taskId: 'cooking.chopping',
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
  },
}));

vi.mock('../../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: vi.fn(async () => mockQueue.rows),
    reupload: hooks.reupload,
  },
  onUploadQueueChanged: vi.fn(() => ({ remove: hooks.queueChangedRemove })),
  onUploadProgress: vi.fn(() => ({ remove: hooks.progressRemove })),
}));

vi.mock('../../../src/lib/jwtSub', () => ({
  decodeGoogleSubFromJwt: (jwt: string | null) => (jwt ? SUB : ''),
}));

vi.mock('../../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: typeof mockState) => T) => selector(mockState),
}));

import PendingUploadsScreen from '../../../src/screens/uploads/PendingUploadsScreen';

afterEach(() => {
  cleanup();
  mockQueue.rows = [];
  mockState.jwt = 'jwt-token';
});

describe('PendingUploadsScreen — canceled-segment defensive guard (CAPTURE-QA-05)', () => {
  it('Test G — filters out a row with cancelReason=fps_dropped (seeded path)', () => {
    const { queryByLabelText, queryAllByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'should-render', state: 'uploading' }),
          row({
            recordingId: 'canceled-must-hide',
            state: 'uploading',
            cancelReason: 'fps_dropped',
          }),
        ]}
      />,
    );
    // Exactly one row renders — the non-canceled one. The canceled row
    // is filtered out defensively.
    expect(queryAllByLabelText('pending-upload-row')).toHaveLength(1);
    // The visible row carries the non-canceled file name (the default).
    expect(queryByLabelText('pending-upload-name')?.textContent).toBe('20260517_120000_001.mp4');
  });

  it('Test G2 — filters out cancelReason=resolution_dropped + insufficient_frames too', () => {
    const { queryAllByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'r1', cancelReason: 'fps_dropped' }),
          row({ recordingId: 'r2', cancelReason: 'resolution_dropped' }),
          row({ recordingId: 'r3', cancelReason: 'insufficient_frames' }),
        ]}
      />,
    );
    // All three canceled rows filtered out → empty state.
    expect(queryAllByLabelText('pending-upload-row')).toHaveLength(0);
  });

  it('Test H — normal pending/uploading/dead-letter rows continue to render (regression)', () => {
    const { queryAllByLabelText, getByLabelText } = render(
      <PendingUploadsScreen
        __test_rows={[
          row({ recordingId: 'r-pending', state: 'pending' }),
          row({ recordingId: 'r-uploading', state: 'uploading' }),
          row({ recordingId: 'r-deadletter', state: 'dead-letter' }),
        ]}
      />,
    );
    expect(queryAllByLabelText('pending-upload-row')).toHaveLength(3);
    // Spot-check that the dead-letter Retry affordance is still there
    // (canceled-guard must not accidentally suppress it).
    expect(getByLabelText('pending-upload-retry')).toBeTruthy();
  });

  it('Test H2 — live getQueueSafe path also filters canceled rows', async () => {
    mockQueue.rows = [
      row({ recordingId: 'mine-ok', ownerUserId: SUB }),
      row({
        recordingId: 'mine-canceled',
        ownerUserId: SUB,
        cancelReason: 'resolution_dropped',
      }),
    ];
    const { findAllByLabelText } = render(<PendingUploadsScreen />);
    const rendered = await findAllByLabelText('pending-upload-row');
    expect(rendered).toHaveLength(1);
  });
});
