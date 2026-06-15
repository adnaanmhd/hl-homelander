// uploadReconcile — the app-launch / foreground reconciliation sweep (Plan
// 05-08; Enh 3 / D1 backstop).
//
// Coverage:
//   - GET /recordings returns rows at terminal success that overlap the local
//     queue → HumynUpload.clearUploaded called with the overlap (Enh 3 / D1
//     backstop — replaces the removed GET /recordings/verified-ids sweep)
//   - an empty result → no-op, cursor unchanged
//   - a network error → swallowed, cursor unchanged, returns 0
//   - a verified id NOT in the local queue → no clearUploaded (the intersection)
//   - the AppState→active re-fire triggers another reconcileOnce
//   - installUploadReconcile pushes the auth context (setUploadContextSafe) on
//     boot + resumes on a jwt change
//   - review fixes V5/V6 (2026-06-10): auth-parked rows get the resumeAuthSafe
//     recovery probe (only with a JWT present) and are excluded from the blind
//     revive/drain; a jwt ROTATION resumes via resumeAuth (auth pause only)
//     while a sign-in-after-logout resumes via resume (js pause)
//
// Mocking: `../../src/services/api` (the authed GET), `../../src/native/HumynUpload`
// (getQueueSafe / clearUploaded / resume / pause / setUploadContextSafe). The
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
    clearUploaded: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    resumeAuth: vi.fn().mockResolvedValue(undefined),
    resumeAuthSafe: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    setUploadContextSafe: vi.fn().mockResolvedValue(undefined),
    drainNowSafe: vi.fn().mockResolvedValue(undefined),
    reviveDeadLetterSafe: vi.fn().mockResolvedValue(true),
  },
  appStateListeners: [] as ((s: string) => void)[],
}));

vi.mock('../../src/services/api', () => ({
  apiClient: { get: hooks.apiGet },
}));

vi.mock('../../src/native/HumynUpload', () => ({
  AUTH_FAILURE_REASON_PREFIX: 'auth: ',
  HumynUpload: {
    getQueueSafe: hooks.getQueueSafe,
    clearUploaded: hooks.clearUploaded,
    resume: hooks.resume,
    resumeAuth: hooks.resumeAuth,
    resumeAuthSafe: hooks.resumeAuthSafe,
    pause: hooks.pause,
    setUploadContextSafe: hooks.setUploadContextSafe,
    drainNowSafe: hooks.drainNowSafe,
    reviveDeadLetterSafe: hooks.reviveDeadLetterSafe,
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
    hooks.clearUploaded.mockResolvedValue(undefined);
    hooks.resume.mockResolvedValue(undefined);
    hooks.resumeAuth.mockResolvedValue(undefined);
    hooks.resumeAuthSafe.mockResolvedValue(undefined);
    hooks.pause.mockResolvedValue(undefined);
    hooks.setUploadContextSafe.mockResolvedValue(undefined);
    hooks.drainNowSafe.mockResolvedValue(undefined);
    hooks.reviveDeadLetterSafe.mockResolvedValue(true);
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

  it('clearUploaded()s the queue ∩ server-terminal-success intersection', async () => {
    // Enh 3 / D1 (2026-06-04): backstop reads GET /recordings and clears local
    // rows the server already reports at terminal success ('uploaded' / legacy
    // 'verified'). R1=uploaded + R3=verified are in the queue → cleared; OTHER is
    // server-only; R2 is queued but still pending server-side → kept.
    hooks.getQueueSafe.mockResolvedValue([queueRow('R1'), queueRow('R2'), queueRow('R3')]);
    hooks.apiGet.mockResolvedValue({
      items: [
        { recording_id: 'R1', qa_status: 'uploaded' },
        { recording_id: 'R2', qa_status: 'pending' },
        { recording_id: 'R3', qa_status: 'verified' },
        { recording_id: 'OTHER', qa_status: 'uploaded' },
      ],
    });
    const cleared = await reconcileOnce();
    expect(cleared).toBe(2);
    expect(hooks.clearUploaded).toHaveBeenCalledWith(['R1', 'R3']);
  });

  it('reads GET /recordings (limit 100) for the backstop', async () => {
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.apiGet).toHaveBeenCalledWith('/recordings', { query: { limit: '100' } });
  });

  it('an empty server result is a no-op (no clearUploaded)', async () => {
    hooks.getQueueSafe.mockResolvedValue([queueRow('R1')]);
    hooks.apiGet.mockResolvedValue({ items: [] });
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(hooks.clearUploaded).not.toHaveBeenCalled();
  });

  it('a terminal-success id NOT in the local queue is skipped (the intersection)', async () => {
    hooks.getQueueSafe.mockResolvedValue([queueRow('R1')]);
    hooks.apiGet.mockResolvedValue({
      items: [{ recording_id: 'NOT_QUEUED', qa_status: 'uploaded' }],
    });
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(hooks.clearUploaded).not.toHaveBeenCalled();
  });

  it('a still-pending queued id is NOT cleared (only terminal success)', async () => {
    hooks.getQueueSafe.mockResolvedValue([queueRow('R1')]);
    hooks.apiGet.mockResolvedValue({ items: [{ recording_id: 'R1', qa_status: 'pending' }] });
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(hooks.clearUploaded).not.toHaveBeenCalled();
  });

  it('a network error is swallowed; returns 0', async () => {
    hooks.apiGet.mockRejectedValue(new Error('GET /recordings failed: 503'));
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
  });

  it('pushes the upload auth context (setUploadContextSafe) on every sweep', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, 'jwt-xyz');
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.setUploadContextSafe).toHaveBeenCalledWith(
      'http://test.example',
      'jwt-xyz',
      expect.any(String),
    );
  });

  it('installUploadReconcile re-fires reconcileOnce on AppState→active', async () => {
    hooks.apiGet.mockResolvedValue({ items: [] });
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
    hooks.apiGet.mockResolvedValue({ items: [] });
    const teardown = installUploadReconcile();
    await flush();
    hooks.setUploadContextSafe.mockClear();
    hooks.resume.mockClear();
    secureMmkv.set(KEYS.AUTH_JWT, 'new-jwt'); // pushUploadContext reads the JWT from MMKV
    useAppStore.setState({ jwt: 'new-jwt' });
    await flush();
    expect(hooks.setUploadContextSafe).toHaveBeenCalled();
    // null → value = sign-in after a logout: the JS-lifecycle pause clears
    // (resume), NOT the auth pause (review fix V6 — the pause-reason split).
    expect(hooks.resume).toHaveBeenCalled();
    expect(hooks.resumeAuth).not.toHaveBeenCalled();
    teardown();
  });

  it('a jwt ROTATION (value → value) resumes via resumeAuth only — never the js pause (review fix V6)', async () => {
    // A silent re-auth landing MID-RECORDING must not clear the recording's
    // JS-lifecycle pause (UP-10) — rotation clears only the 401 park.
    hooks.apiGet.mockResolvedValue({ items: [] });
    secureMmkv.set(KEYS.AUTH_JWT, 'jwt-old');
    useAppStore.setState({ jwt: 'jwt-old' });
    const teardown = installUploadReconcile();
    await flush();
    hooks.resume.mockClear();
    hooks.resumeAuth.mockClear();
    secureMmkv.set(KEYS.AUTH_JWT, 'jwt-rotated');
    useAppStore.setState({ jwt: 'jwt-rotated' });
    await flush();
    expect(hooks.resumeAuth).toHaveBeenCalled();
    expect(hooks.resume).not.toHaveBeenCalled();
    teardown();
  });

  it('installUploadReconcile pauses uploads on logout (jwt → null)', async () => {
    hooks.apiGet.mockResolvedValue({ items: [] });
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
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.drainNowSafe).toHaveBeenCalledTimes(1);
  });

  it('reconcileOnce kicks drainNowSafe when an uploading row is on disk (Wave-1.5 Item 8)', async () => {
    hooks.getQueueSafe.mockResolvedValue([{ ...queueRow('R1'), state: 'uploading' }]);
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.drainNowSafe).toHaveBeenCalledTimes(1);
  });

  it('reconcileOnce does NOT kick drainNowSafe when only finalizing rows are queued', async () => {
    // finalizing rows are not 'pending'/'uploading'/'dead-letter', so the drain
    // kick condition is false. (Enh 3 / D1: 'awaiting-verify'/'verified' removed.)
    hooks.getQueueSafe.mockResolvedValue([
      { ...queueRow('R1'), state: 'finalizing' },
      { ...queueRow('R2'), state: 'finalizing' },
    ]);
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.drainNowSafe).not.toHaveBeenCalled();
  });

  it('reconcileOnce does NOT kick drainNowSafe when the queue is empty', async () => {
    hooks.getQueueSafe.mockResolvedValue([]);
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.drainNowSafe).not.toHaveBeenCalled();
  });

  it('reconcileOnce is boot-safe when getQueueSafe throws — does not crash, does not kick drainNowSafe', async () => {
    hooks.getQueueSafe.mockRejectedValue(new Error('native module missing'));
    hooks.apiGet.mockResolvedValue({ items: [] });
    // Must not throw.
    const cleared = await reconcileOnce();
    expect(cleared).toBe(0);
    expect(hooks.drainNowSafe).not.toHaveBeenCalled();
  });

  // Review fix V5 (2026-06-10) — auth-parked rows must not strand: the 401
  // park dies with the process but the row marker is durable, and nothing
  // else retriggers these rows. With a JWT present the sweep fires the
  // dedicated resumeAuthSafe probe; they stay OUT of the blind revive/drain.
  it('auth-parked rows + JWT present → resumeAuthSafe probe; excluded from blind revive/drain (review fixes V5 + Phase 1 item 7)', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, 'jwt-present');
    hooks.getQueueSafe.mockResolvedValue([
      { ...queueRow('R1'), state: 'pending', lastFailureReason: 'auth: device-evicted' },
      { ...queueRow('R2'), state: 'dead-letter', lastFailureReason: 'auth: reauth-required' },
    ]);
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.resumeAuthSafe).toHaveBeenCalledTimes(1);
    // The auth-marked dead-letter is NOT blind-revived, and auth-marked
    // pending rows alone never kick the generic drain.
    expect(hooks.reviveDeadLetterSafe).not.toHaveBeenCalled();
    expect(hooks.drainNowSafe).not.toHaveBeenCalled();
  });

  it('auth-parked rows + NO jwt → no resumeAuthSafe (a doomed 401 probe is pointless)', async () => {
    secureMmkv.remove(KEYS.AUTH_JWT);
    hooks.getQueueSafe.mockResolvedValue([
      { ...queueRow('R1'), state: 'pending', lastFailureReason: 'auth: reauth-required' },
    ]);
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.resumeAuthSafe).not.toHaveBeenCalled();
  });

  it('a NON-auth dead-letter still gets the blind revive + drain alongside an auth-parked row', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, 'jwt-present');
    hooks.getQueueSafe.mockResolvedValue([
      { ...queueRow('R1'), state: 'dead-letter', lastFailureReason: 'part PUT failed: 503' },
      { ...queueRow('R2'), state: 'pending', lastFailureReason: 'auth: device-evicted' },
    ]);
    hooks.apiGet.mockResolvedValue({ items: [] });
    await reconcileOnce();
    expect(hooks.reviveDeadLetterSafe).toHaveBeenCalledTimes(1);
    expect(hooks.reviveDeadLetterSafe).toHaveBeenCalledWith('R1');
    expect(hooks.drainNowSafe).toHaveBeenCalledTimes(1);
    expect(hooks.resumeAuthSafe).toHaveBeenCalledTimes(1);
  });
});
