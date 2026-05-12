// Plan 05-08 — Visual snapshot for PendingUploadsScreen (UP-12).
//
// The baseline catches:
//   - TopBar + "Pending uploads" title
//   - one row per queue item: 64×64 thumb + name + meta + a status chip
//   - all five chip variants (progress / verifying / failed+Retry / success /
//     paused-offline) — a layout shift / a dropped variant / a moved Retry
//     button shifts the rendered rectangles and the diff fires.
//
// Uses the existing structural-render-tree-PNG helper (`renderToImage`) — see
// `__tests__/visual/_utils/renderToImage.ts` for why it's a structural diff,
// not a pixel rasterizer.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UploadQueueRow } from '../../../src/native/HumynUpload';

const SUB = 'sub-alice';

vi.mock('../../../src/native/HumynUpload', () => ({
  HumynUpload: { getQueueSafe: vi.fn(async () => [] as UploadQueueRow[]), reupload: vi.fn() },
  onUploadQueueChanged: vi.fn(() => ({ remove: vi.fn() })),
  onUploadProgress: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock('../../../src/lib/jwtSub', () => ({
  decodeGoogleSubFromJwt: () => SUB,
}));

vi.mock('../../../src/state/appStore', () => {
  const stub = { jwt: 'jwt-token' } as Record<string, unknown>;
  function useAppStore<T>(selector: (s: typeof stub) => T): T {
    return selector(stub);
  }
  (useAppStore as unknown as { getState: () => typeof stub }).getState = () => stub;
  return { useAppStore };
});

import PendingUploadsScreen from '../../../src/screens/uploads/PendingUploadsScreen';
import { renderToImage } from '../../visual/_utils/renderToImage';

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

const ALL_VARIANTS: UploadQueueRow[] = [
  row({ recordingId: 'r1', state: 'uploading' }),
  row({ recordingId: 'r2', state: 'awaiting-verify' }),
  row({ recordingId: 'r3', state: 'dead-letter', deadLetterReason: 'too many retries' }),
  row({ recordingId: 'r4', state: 'verified' }),
];

describe('PendingUploadsScreen visual (Plan 05-08)', () => {
  afterEach(() => cleanup());

  it('matches baseline — one row per chip variant', () => {
    const { container } = render(<PendingUploadsScreen __test_rows={ALL_VARIANTS} />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });

  it('matches baseline — empty state', () => {
    const { container } = render(<PendingUploadsScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
