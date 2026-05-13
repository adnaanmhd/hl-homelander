// uploadReconcile — the app-launch / foreground reconciliation sweep (Plan
// 05-08; VERIFY-06).
//
// Coverage:
//   - GET /recordings/verified-ids returns ids that overlap the local queue →
//     HumynUpload.clearVerified called with the overlap + the cursor stored +
//     each id marked processed
//   - an empty result → no-op, cursor unchanged
//   - a network error → swallowed, cursor unchanged, returns 0
//   - a verified id NOT in the local queue → no clearVerified (the intersection)
//   - the AppState→active re-fire triggers another reconcileOnce
//   - installUploadReconcile pushes the auth context (setUploadContextSafe) on
//     boot + resumes on a jwt change
//
// Mocking: `../../src/services/api` (the authed GET), `../../src/native/HumynUpload`
// (getQueueSafe / clearVerified / resume / pause / setUploadContextSafe). The
// shared MMKV singleton + `react-native-config` + `react-native`'s AppState are
// the vitest.setup.ts stubs; we capture the AppState listener via a per-test
// override of `react-native`'s AppState.addEventListener. `appStore` is the real
// (mmkv-mocked) zustand store.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Config } from 'react-native-config';
import { AppState } from 'react-native';

const { hooks, appStateListeners } = vi.hoisted(() => ({
  hooks: {
    apiGet: vi.fn(),
    getQueueSafe: vi.fn(),
    clearVerified: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    setUploadContextSafe: vi.fn().mockResolvedValue(undefined),
    drainNowSafe: vi.fn().mockResolvedValue(undefined),
  },
  appStateListeners: [] as ((s: string) => void)[],
}));

vi.mock('../../src/services/api', () => ({
  apiClient: { get: hooks.apiGet },
}));

vi.mock('../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: hooks.getQueueSafe,
    clearVerified: hooks.clearVerified,
    resume: hooks.resume,
    pause: hooks.pause,
    setUploadContextSafe: hooks.setUploadContextSafe,
    drainNowSafe: hooks.drainNowSafe,
  },
}));

import { reconcileOnce, installUploadReconcile } from '../../src/services/uploadReconcile';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';
import { useAppStore } from '../../src/state/appStore';

function queueRow(recordingId: string) {
  return { recordingId, ownerUserId: 'sub-x', state: 'uploading' };
}

/** Flush enough microtask turns for the chained awaits in reconcileOnce/pushUploadContext. */
async function flush(n = 6): Promise<void> {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
}

describe('uploadReconcile (Plan 05-08 — VERIFY-06)', () => {
  beforeEach(() => {
    Config.API_BASE_URL = 'http://test.example';
    secureMmkv.remove(KEYS.UPLOAD_RECONCILE_CURSOR);
    secureMmkv.remove(KEYS.UPLOAD_PROCESSED_EVENTS);
    secureMmkv.remove(KEYS.AUTH_JWT);
    appStateListeners.length = 0;
    Object.values(hooks).forEach((h) => h.mockReset());
    hooks.clearVerified.mockResolvedValue(undefined);
    hooks.resume.mockResolvedValue(undefined);
    hooks.pause.mockResolvedValue(undefined);
    hooks.setUploadContextSafe.mockResolvedValue(undefined);
    hooks.drainNowSafe.mockResolvedValue(undefined);
    hooks.getQueueSafe.mockResolvedValue([]);
    vi.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: unknown,
      cb: (s: string) => void,
    ) => {
      appStateListeners.push(cb);
      return { remove: () => undefined };
    }) as unknown as typeof AppState.addEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({ jwt: null });
  });

  it('clearVerified()s the queue∩verified intersection + stores the next cursor + marks processed', async () => {
    hooks.getQueueSafe.mockResolvedValue([queueRow('R1'), queueRow('R2'), queueRow('R3')]);
    hooks.apiGet.mockResolvedValue({ ids: ['R1', 'R3', 'OTHER'], next_cursor: 'cursor-42' });
    const cleared = await reconcileOnce();
    expect(cleared).toBe(2);
    expect(hooks.clearVerified).toHaveBeenCalledWith(['R1', 'R3']);
    expect(secureMmkv.getString(KEYS.UPLOAD_RECONCILE_CURSOR)).toBe('cursor-42');
    const processed = JSON.parse(
      secureMmkv.getString(KEYS.UPLOAD_PROCESSED_EVENTS) ?? '[]',
    ) as string[];
    expect(processed).toEqual(expect.arrayContaining(['R1:verified', 'R3:verified']));
  });

  it('passes the stored cursor as ?since= on a subsequent sweep', async () => {
    secureMmkv.set(KEYS.UPLOAD_RECONCILE_CURSOR, 'cursor-prev');
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    await reconcileOnce();
    expect(hooks.apiGet).toHaveBeenCalledWith('/recordings/verified-ids', {
      query: { since: 'cursor-prev' },
    });
  });

  it('an empty verified set is a no-op (no clearVerified)', async () => {
    hooks.getQueueSafe.mockResolvedValue([queueRow('R1')]);
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(hooks.clearVerified).not.toHaveBeenCalled();
  });

  it('a verified id NOT in the local queue is skipped (the intersection)', async () => {
    hooks.getQueueSafe.mockResolvedValue([queueRow('R1')]);
    hooks.apiGet.mockResolvedValue({ ids: ['NOT_QUEUED'], next_cursor: null });
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(hooks.clearVerified).not.toHaveBeenCalled();
  });

  it('a network error is swallowed; cursor unchanged; returns 0', async () => {
    secureMmkv.set(KEYS.UPLOAD_RECONCILE_CURSOR, 'cursor-prev');
    hooks.apiGet.mockRejectedValue(new Error('GET /recordings/verified-ids failed: 503'));
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(secureMmkv.getString(KEYS.UPLOAD_RECONCILE_CURSOR)).toBe('cursor-prev');
  });

  it('pushes the upload auth context (setUploadContextSafe) on every sweep', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, 'jwt-xyz');
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    await reconcileOnce();
    expect(hooks.setUploadContextSafe).toHaveBeenCalledWith(
      'http://test.example',
      'jwt-xyz',
      expect.any(String),
    );
  });

  it('installUploadReconcile re-fires reconcileOnce on AppState→active', async () => {
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    const teardown = installUploadReconcile();
    await flush();
    const callsAfterBoot = hooks.apiGet.mock.calls.length;
    expect(callsAfterBoot).toBeGreaterThanOrEqual(1);
    // Fire the captured AppState listener with 'active'.
    appStateListeners.forEach((cb) => cb('active'));
    await flush();
    expect(hooks.apiGet.mock.calls.length).toBeGreaterThan(callsAfterBoot);
    teardown();
  });

  it('installUploadReconcile resumes + re-pushes the auth context on a jwt change (re-login)', async () => {
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    const teardown = installUploadReconcile();
    await flush();
    hooks.setUploadContextSafe.mockClear();
    hooks.resume.mockClear();
    secureMmkv.set(KEYS.AUTH_JWT, 'new-jwt'); // pushUploadContext reads the JWT from MMKV
    useAppStore.setState({ jwt: 'new-jwt' });
    await flush();
    expect(hooks.setUploadContextSafe).toHaveBeenCalled();
    expect(hooks.resume).toHaveBeenCalled();
    teardown();
  });

  it('installUploadReconcile pauses uploads on logout (jwt → null)', async () => {
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    useAppStore.setState({ jwt: 'jwt-before' });
    const teardown = installUploadReconcile();
    await flush();
    hooks.pause.mockClear();
    useAppStore.setState({ jwt: null });
    await flush();
    expect(hooks.pause).toHaveBeenCalled();
    teardown();
  });

  // Wave-1.5 Item 8 — cold-start drain on stale queue.
  it('reconcileOnce kicks drainNowSafe when a pending row is on disk (Wave-1.5 Item 8)', async () => {
    hooks.getQueueSafe.mockResolvedValue([{ ...queueRow('R1'), state: 'pending' }]);
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    await reconcileOnce();
    expect(hooks.drainNowSafe).toHaveBeenCalledTimes(1);
  });

  it('reconcileOnce kicks drainNowSafe when an uploading row is on disk (Wave-1.5 Item 8)', async () => {
    hooks.getQueueSafe.mockResolvedValue([{ ...queueRow('R1'), state: 'uploading' }]);
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    await reconcileOnce();
    expect(hooks.drainNowSafe).toHaveBeenCalledTimes(1);
  });

  it('reconcileOnce does NOT kick drainNowSafe when only awaiting-verify/verified rows are queued', async () => {
    hooks.getQueueSafe.mockResolvedValue([
      { ...queueRow('R1'), state: 'awaiting-verify' },
      { ...queueRow('R2'), state: 'verified' },
    ]);
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    await reconcileOnce();
    expect(hooks.drainNowSafe).not.toHaveBeenCalled();
  });

  it('reconcileOnce does NOT kick drainNowSafe when the queue is empty', async () => {
    hooks.getQueueSafe.mockResolvedValue([]);
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    await reconcileOnce();
    expect(hooks.drainNowSafe).not.toHaveBeenCalled();
  });

  it('reconcileOnce is boot-safe when getQueueSafe throws — does not crash, does not kick drainNowSafe', async () => {
    hooks.getQueueSafe.mockRejectedValue(new Error('native module missing'));
    hooks.apiGet.mockResolvedValue({ ids: [], next_cursor: null });
    // Must not throw.
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(hooks.drainNowSafe).not.toHaveBeenCalled();
  });
});
