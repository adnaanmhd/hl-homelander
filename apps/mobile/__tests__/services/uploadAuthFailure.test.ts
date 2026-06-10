// Phase 1 (2026-06-10, IMPLEMENTATION-PLAN-260610) — the native uploader's
// `onUploadAuthFailure` listener. The Kotlin coordinator pauses the queue +
// parks the row on a 401 and emits { slug }; the JS side must either run the
// eviction UX (device-evicted / reauth-required → same behavior as an evicted
// JS API call) or attempt a silent re-auth (plain expiry) and resume the queue
// with the fresh token.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Config from 'react-native-config';

const { hooks } = vi.hoisted(() => ({
  hooks: {
    authListener: null as ((e: { slug: string }) => void) | null,
    authRemove: vi.fn(),
  },
}));

vi.mock('../../src/native/HumynUpload', () => ({
  AUTH_FAILURE_REASON_PREFIX: 'auth: ',
  HumynUpload: {
    getQueueSafe: vi.fn(async () => []),
    setUploadContextSafe: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    // Review fix (2026-06-10): the auth-recovery path resumes via resumeAuth
    // (clears ONLY the 401 park — never the recording/logout pause, UP-10).
    resumeAuth: vi.fn(async () => undefined),
  },
  onUploadQueueChanged: vi.fn(() => ({ remove: vi.fn() })),
  onUploadProgress: vi.fn(() => ({ remove: vi.fn() })),
  onUploadAuthFailure: vi.fn((cb: (e: { slug: string }) => void) => {
    hooks.authListener = cb;
    return { remove: hooks.authRemove };
  }),
}));

vi.mock('../../src/services/api', () => ({
  applyDeviceEviction: vi.fn(),
}));

vi.mock('../../src/services/auth', () => ({
  silentReauth: vi.fn(async () => false),
}));

import {
  handleUploadAuthFailure,
  installUploadQueueStore,
} from '../../src/services/uploadQueueStore';
import { HumynUpload } from '../../src/native/HumynUpload';
import { applyDeviceEviction } from '../../src/services/api';
import { silentReauth } from '../../src/services/auth';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';

beforeEach(() => {
  vi.mocked(applyDeviceEviction).mockClear();
  vi.mocked(silentReauth).mockClear().mockResolvedValue(false);
  vi.mocked(HumynUpload.setUploadContextSafe).mockClear();
  vi.mocked(HumynUpload.resume).mockClear();
  vi.mocked(HumynUpload.resumeAuth).mockClear();
  hooks.authListener = null;
  (Config as Record<string, string>).API_BASE_URL = 'http://api.test';
  secureMmkv.remove(KEYS.AUTH_JWT);
});

describe('handleUploadAuthFailure', () => {
  it('device-evicted → the exact eviction UX (clear session + Signup notice), no re-auth attempt', async () => {
    await handleUploadAuthFailure('device-evicted');
    expect(applyDeviceEviction).toHaveBeenCalledWith('evicted');
    expect(silentReauth).not.toHaveBeenCalled();
    expect(HumynUpload.resume).not.toHaveBeenCalled();
    expect(HumynUpload.resumeAuth).not.toHaveBeenCalled();
  });

  it('reauth-required → eviction UX with the reauth copy', async () => {
    await handleUploadAuthFailure('reauth-required');
    expect(applyDeviceEviction).toHaveBeenCalledWith('reauth');
    expect(silentReauth).not.toHaveBeenCalled();
  });

  it('plain expiry (unknown slug) → silent re-auth; on success pushes the fresh JWT and auth-resumes the queue', async () => {
    vi.mocked(silentReauth).mockResolvedValue(true);
    secureMmkv.set(KEYS.AUTH_JWT, 'header.eyJzdWIiOiJzdWItYWxpY2UifQ.sig');
    await handleUploadAuthFailure('unknown');
    expect(silentReauth).toHaveBeenCalledTimes(1);
    expect(applyDeviceEviction).not.toHaveBeenCalled();
    expect(HumynUpload.setUploadContextSafe).toHaveBeenCalledWith(
      'http://api.test',
      'header.eyJzdWIiOiJzdWItYWxpY2UifQ.sig',
      expect.any(String),
    );
    // Review fix (2026-06-10): resumeAuth, NOT resume — a recording in
    // progress must keep uploads parked even when the re-auth lands
    // mid-capture (UP-10).
    expect(HumynUpload.resumeAuth).toHaveBeenCalledTimes(1);
    expect(HumynUpload.resume).not.toHaveBeenCalled();
  });

  it('plain expiry + failed silent re-auth → queue stays paused (no resume), no eviction', async () => {
    vi.mocked(silentReauth).mockResolvedValue(false);
    await handleUploadAuthFailure('unknown');
    expect(HumynUpload.resume).not.toHaveBeenCalled();
    expect(HumynUpload.resumeAuth).not.toHaveBeenCalled();
    expect(applyDeviceEviction).not.toHaveBeenCalled();
  });
});

describe('installUploadQueueStore auth-failure wiring', () => {
  it('subscribes onUploadAuthFailure and dispatches events through the handler', async () => {
    const teardown = installUploadQueueStore();
    expect(hooks.authListener).not.toBeNull();
    hooks.authListener?.({ slug: 'device-evicted' });
    // The handler is async fire-and-forget — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(applyDeviceEviction).toHaveBeenCalledWith('evicted');
    teardown();
    expect(hooks.authRemove).toHaveBeenCalledTimes(1);
  });
});
