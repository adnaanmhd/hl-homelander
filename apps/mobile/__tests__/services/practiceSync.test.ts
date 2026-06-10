// practiceSync — Phase 3 (2026-06-10, Bug 2): durable practice-completion
// POST. The pending flag is set before the POST attempt and must survive
// failures; the flush retries it on boot/foreground, clears on 2xx or
// 409/already-set, and never posts for the wrong (signed-out) account.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { postMock, appStateHooks } = vi.hoisted(() => ({
  postMock: vi.fn(),
  appStateHooks: {
    listener: null as ((s: string) => void) | null,
    remove: vi.fn(),
  },
}));

vi.mock('../../src/services/profileService', () => ({
  postPracticeComplete: postMock,
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active' as const,
    addEventListener: vi.fn((event: string, cb: (s: string) => void) => {
      if (event === 'change') appStateHooks.listener = cb;
      return { remove: appStateHooks.remove };
    }),
  },
}));

import {
  markPracticeServerPostPending,
  clearPracticeServerPostPending,
  flushPracticeServerPost,
  installPracticeSyncFlush,
} from '../../src/services/practiceSync';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS, practicePendingServerPostKey } from '../../src/state/keys';

// header.{"sub":"sub-alice"}.sig — decodeGoogleSubFromJwt reads the middle part.
const JWT_SUB_ALICE = 'header.eyJzdWIiOiJzdWItYWxpY2UifQ.sig';
const SUB = 'sub-alice';

beforeEach(() => {
  postMock.mockReset();
  appStateHooks.listener = null;
  appStateHooks.remove.mockClear();
  secureMmkv.remove(KEYS.AUTH_JWT);
  secureMmkv.remove(practicePendingServerPostKey(SUB));
});

describe('flushPracticeServerPost', () => {
  it('no JWT → never posts (a signed-out device must not stamp anyone)', async () => {
    markPracticeServerPostPending(SUB);
    await flushPracticeServerPost();
    expect(postMock).not.toHaveBeenCalled();
    // The flag survives for the next signed-in flush.
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(true);
  });

  it('no pending flag → no post', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, JWT_SUB_ALICE);
    await flushPracticeServerPost();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('pending + 2xx → posts once and clears the flag', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, JWT_SUB_ALICE);
    markPracticeServerPostPending(SUB);
    postMock.mockResolvedValue({ practiceCompletedAt: '2026-06-10T00:00:00Z' });

    await flushPracticeServerPost();
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(false);

    // A second flush is a no-op (flag cleared).
    await flushPracticeServerPost();
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('pending + 409 → clears the flag (server already has it)', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, JWT_SUB_ALICE);
    markPracticeServerPostPending(SUB);
    postMock.mockRejectedValue(new Error('POST /me/practice-complete failed: 409 conflict'));

    await flushPracticeServerPost();
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(false);
  });

  it('pending + network/5xx failure → flag survives for the next flush', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, JWT_SUB_ALICE);
    markPracticeServerPostPending(SUB);
    postMock.mockRejectedValue(new Error('Network request failed'));

    await flushPracticeServerPost();
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(true);

    // Back online: the next flush completes and clears.
    postMock.mockResolvedValue({ practiceCompletedAt: 'x' });
    await flushPracticeServerPost();
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(false);
  });

  it('clearPracticeServerPostPending removes the flag', () => {
    markPracticeServerPostPending(SUB);
    clearPracticeServerPostPending(SUB);
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(false);
  });
});

describe('installPracticeSyncFlush', () => {
  it('flushes on install AND on every AppState→active; teardown unsubscribes', async () => {
    secureMmkv.set(KEYS.AUTH_JWT, JWT_SUB_ALICE);
    markPracticeServerPostPending(SUB);
    // First (install-time) flush fails — the flag must survive to the
    // foreground flush.
    postMock.mockRejectedValueOnce(new Error('Network request failed'));
    postMock.mockResolvedValue({ practiceCompletedAt: 'x' });

    const teardown = installPracticeSyncFlush();
    await new Promise((r) => setTimeout(r, 0));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(true);

    appStateHooks.listener?.('active');
    await new Promise((r) => setTimeout(r, 0));
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(secureMmkv.getBoolean(practicePendingServerPostKey(SUB))).toBe(false);

    teardown();
    expect(appStateHooks.remove).toHaveBeenCalledTimes(1);
  });
});
