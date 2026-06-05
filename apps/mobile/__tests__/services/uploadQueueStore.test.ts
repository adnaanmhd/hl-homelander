// uploadQueueStore — the single app-lifetime upload-queue → store bridge
// (Bug 7 + Bug 11, 2026-06-04). These tests cover the actual reactive
// mechanism the three screens (History / Home / PendingUploads) now depend on:
// install seeds the store from getQueueSafe(); the one onUploadQueueChanged
// subscription replaces `uploadQueue` + bumps `contributionsVersion`; the one
// onUploadProgress subscription writes `uploadProgressById`; teardown removes
// both. We run against the REAL appStore (not a mock) so the slice + setters are
// exercised end-to-end.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UploadQueueRow } from '../../src/native/HumynUpload';

type ProgressEvent = { recordingId: string; bytesUploaded: number; bytesTotal: number };

const { hooks } = vi.hoisted(() => ({
  hooks: {
    queueListener: null as ((rows: UploadQueueRow[]) => void) | null,
    progressListener: null as ((e: ProgressEvent) => void) | null,
    queueRemove: vi.fn(),
    progressRemove: vi.fn(),
    queueRows: [] as UploadQueueRow[],
  },
}));

vi.mock('../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: vi.fn(async () => hooks.queueRows),
  },
  onUploadQueueChanged: vi.fn((cb: (rows: UploadQueueRow[]) => void) => {
    hooks.queueListener = cb;
    return { remove: hooks.queueRemove };
  }),
  onUploadProgress: vi.fn((cb: (e: ProgressEvent) => void) => {
    hooks.progressListener = cb;
    return { remove: hooks.progressRemove };
  }),
}));

import { installUploadQueueStore } from '../../src/services/uploadQueueStore';
import { HumynUpload } from '../../src/native/HumynUpload';
import { useAppStore } from '../../src/state/appStore';

function makeRow(over: Partial<UploadQueueRow>): UploadQueueRow {
  return {
    recordingId: 'rec1',
    ownerUserId: 'sub-alice',
    mp4Path: '/data/rec1.mp4',
    csvPath: '/data/rec1.csv',
    jsonPath: '/data/rec1.json',
    taskId: 'task-1',
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

beforeEach(() => {
  hooks.queueListener = null;
  hooks.progressListener = null;
  hooks.queueRemove.mockClear();
  hooks.progressRemove.mockClear();
  hooks.queueRows = [];
  useAppStore.setState({ uploadQueue: [], uploadProgressById: {}, contributionsVersion: 0 });
});

describe('installUploadQueueStore', () => {
  it('seeds uploadQueue from getQueueSafe() on install', async () => {
    hooks.queueRows = [makeRow({ recordingId: 'seed-1' })];
    const teardown = installUploadQueueStore();
    // The seed is async (getQueueSafe().then) — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(useAppStore.getState().uploadQueue).toHaveLength(1);
    expect(useAppStore.getState().uploadQueue[0]?.recordingId).toBe('seed-1');
    teardown();
  });

  it('onUploadQueueChanged replaces uploadQueue AND bumps contributionsVersion (Bug 7 + Bug 11)', async () => {
    const teardown = installUploadQueueStore();
    await Promise.resolve();
    const before = useAppStore.getState().contributionsVersion;
    hooks.queueListener?.([makeRow({ recordingId: 'a' }), makeRow({ recordingId: 'b' })]);
    expect(useAppStore.getState().uploadQueue).toHaveLength(2);
    // Every queue mutation bumps the contributions version (Bug 11 invalidation).
    expect(useAppStore.getState().contributionsVersion).toBe(before + 1);
    teardown();
  });

  it('onUploadProgress writes the percent (0..100) without bumping the version', async () => {
    const teardown = installUploadQueueStore();
    await Promise.resolve();
    const before = useAppStore.getState().contributionsVersion;
    hooks.progressListener?.({ recordingId: 'rec1', bytesUploaded: 47, bytesTotal: 100 });
    expect(useAppStore.getState().uploadProgressById.rec1).toBe(47);
    // Progress is high-frequency; it must NOT bump the contributions version
    // (that would refetch contributions on every byte tick).
    expect(useAppStore.getState().contributionsVersion).toBe(before);
    teardown();
  });

  it('onUploadProgress with bytesTotal 0 stores 0% (no divide-by-zero)', async () => {
    const teardown = installUploadQueueStore();
    await Promise.resolve();
    hooks.progressListener?.({ recordingId: 'rec1', bytesUploaded: 0, bytesTotal: 0 });
    expect(useAppStore.getState().uploadProgressById.rec1).toBe(0);
    teardown();
  });

  it('teardown removes both subscriptions (leak contract)', () => {
    const teardown = installUploadQueueStore();
    teardown();
    expect(hooks.queueRemove).toHaveBeenCalledTimes(1);
    expect(hooks.progressRemove).toHaveBeenCalledTimes(1);
  });

  it('a live event that arrives before the slow seed resolves is NOT clobbered by the stale seed (race guard)', async () => {
    // Make getQueueSafe hang so we can fire a fresher live event first, then
    // resolve the (now stale) seed and prove it does not overwrite the event.
    // Definite-assignment: the Promise executor runs synchronously inside
    // installUploadQueueStore()'s getQueueSafe() call, so resolveSeed is set
    // before we invoke it below.
    let resolveSeed!: (rows: UploadQueueRow[]) => void;
    vi.mocked(HumynUpload.getQueueSafe).mockImplementationOnce(
      () =>
        new Promise<UploadQueueRow[]>((res) => {
          resolveSeed = res;
        }),
    );
    const teardown = installUploadQueueStore();
    // A live event arrives first, carrying the just-enqueued row.
    hooks.queueListener?.([makeRow({ recordingId: 'fresh' })]);
    expect(useAppStore.getState().uploadQueue).toHaveLength(1);
    expect(useAppStore.getState().uploadQueue[0]?.recordingId).toBe('fresh');
    // The slow seed now resolves with the STALE (empty) boot snapshot — it must
    // be ignored (the event already won the race).
    resolveSeed([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(useAppStore.getState().uploadQueue).toHaveLength(1);
    expect(useAppStore.getState().uploadQueue[0]?.recordingId).toBe('fresh');
    teardown();
  });
});
