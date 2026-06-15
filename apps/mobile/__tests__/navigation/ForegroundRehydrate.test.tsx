// useForegroundUserRehydrate hook unit tests — Plan 03-03 Task 2 (Pattern 72).
//
// Coverage:
//   1. Mount: when user==null && jwt!=null, fetchMe is called and setUser
//      receives the resolved user payload.
//   2. AppState 'active' transition fires the same rehydrate path.
//   3. No-op short-circuit: when user!=null, neither mount nor AppState
//      'active' triggers fetchMe (T-3.2-03 mitigation).
//   4. Cleanup: the AppState subscription's `.remove()` is called on unmount.
//
// Mocking notes:
//   - Pattern 47 vi.hoisted spy bindings so AppState's addEventListener
//     captures the listener handle into a hoisted variable (the vi.mock
//     factory runs BEFORE module-import-time, so closing over a let-binding
//     would TDZ at hoist time).
//   - The appStore mock exposes a synthetic `getState()` with `user`, `jwt`,
//     and a `setUser` spy. The mock's state mutates between cases via a
//     hoisted holder so multiple `it()` blocks can reset to a known state.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type MockUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
} | null;

const { mockState, fetchMeMock, addEventListenerSpy, removeSpy } = vi.hoisted(() => ({
  mockState: {
    user: null as MockUser,
    jwt: null as string | null,
    setUser: vi.fn<(u: MockUser) => void>(),
  },
  fetchMeMock: vi.fn(),
  addEventListenerSpy: vi.fn(),
  removeSpy: vi.fn(),
}));

vi.mock('../../src/state/appStore', () => {
  function useAppStore<T>(selector: (s: typeof mockState) => T): T {
    return selector(mockState);
  }
  (useAppStore as unknown as { getState: () => typeof mockState }).getState = () => mockState;
  return { useAppStore };
});

vi.mock('../../src/services/profileService', () => ({
  fetchMe: fetchMeMock,
}));

// react-native AppState — capture the listener so tests can fire 'change'
// synthetically. The shim's default `addEventListener` from vitest.setup.ts
// returns `{ remove: () => undefined }`; we spy on it to capture the cb +
// instrument removal.
vi.mock('react-native', async () => {
  return {
    AppState: {
      currentState: 'active' as const,
      addEventListener: addEventListenerSpy,
    },
  };
});

import { useForegroundUserRehydrate } from '../../src/hooks/useForegroundUserRehydrate';

function HostComponent() {
  useForegroundUserRehydrate();
  return null;
}

let capturedListener: ((s: string) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mockState.user = null;
  mockState.jwt = null;
  mockState.setUser = vi.fn();
  fetchMeMock.mockReset();
  capturedListener = undefined;
  addEventListenerSpy.mockImplementation((event: string, listener: (s: string) => void) => {
    if (event === 'change') capturedListener = listener;
    return { remove: removeSpy };
  });
});

afterEach(() => {
  cleanup();
});

const RESOLVED_ME = {
  id: 'u1',
  email: 'alice@x.com',
  name: 'Alice',
  age: 28,
  gender: null,
  avatarUrl: 'https://x/a.jpg',
  consentVersion: 'v1',
  flavor: 'apkRollout' as const,
  applicationId: 'ai.humynlabs.capture.apk',
  deletedAt: null,
  deleteGraceUntil: null,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useForegroundUserRehydrate (Plan 03-03 Task 2 / Pattern 72)', () => {
  it('Test 1: mount fires fetchMe + setUser when user==null && jwt!=null', async () => {
    mockState.user = null;
    mockState.jwt = 'token';
    fetchMeMock.mockResolvedValue(RESOLVED_ME);

    render(<HostComponent />);
    // Allow the mount-time rehydrate microtask + setState chain to settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMeMock).toHaveBeenCalledTimes(1);
    expect(mockState.setUser).toHaveBeenCalledWith({
      id: 'u1',
      email: 'alice@x.com',
      name: 'Alice',
      avatarUrl: 'https://x/a.jpg',
    });
  });

  it('Test 2: AppState change → "active" fires the rehydrate path', async () => {
    mockState.user = null;
    mockState.jwt = 'token';
    fetchMeMock.mockResolvedValue(RESOLVED_ME);

    render(<HostComponent />);
    await new Promise((r) => setTimeout(r, 0));
    // Reset post-mount fire so the assertion isolates the AppState path.
    fetchMeMock.mockClear();
    (mockState.setUser as ReturnType<typeof vi.fn>).mockClear();

    expect(capturedListener).toBeDefined();
    capturedListener?.('active');
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMeMock).toHaveBeenCalledTimes(1);
    expect(mockState.setUser).toHaveBeenCalledTimes(1);
  });

  // Phase 2 item 1 (2026-06-10, Bug 3) — the old contract ("no-op when
  // user!=null") is GONE: an evicted device that only browsed cached screens
  // never made an authed call and stayed signed-in forever. Now a populated
  // session still fires a throttled (≥60 s) /me ping so the API client's
  // maybeHandleEviction can evict within seconds of the app being looked at.
  it('Test 3: user!=null → throttled session ping (one /me per 60 s; AppState thrash coalesced)', async () => {
    mockState.user = {
      id: 'u1',
      email: 'alice@x.com',
      name: 'Alice',
      avatarUrl: 'https://x/a.jpg',
    };
    mockState.jwt = 'token';
    fetchMeMock.mockResolvedValue(RESOLVED_ME);

    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      render(<HostComponent />);
      await new Promise((r) => setTimeout(r, 0));
      // Mount counts as a "looked at" — one ping fires; the response body is
      // ignored (no setUser churn on a populated session).
      expect(fetchMeMock).toHaveBeenCalledTimes(1);
      expect(mockState.setUser).not.toHaveBeenCalled();

      // Rapid background↔active thrash inside the 60 s window is coalesced.
      capturedListener?.('active');
      await new Promise((r) => setTimeout(r, 0));
      capturedListener?.('active');
      await new Promise((r) => setTimeout(r, 0));
      expect(fetchMeMock).toHaveBeenCalledTimes(1);

      // Past the window, the next foreground pings again.
      nowMs += 61_000;
      capturedListener?.('active');
      await new Promise((r) => setTimeout(r, 0));
      expect(fetchMeMock).toHaveBeenCalledTimes(2);
      expect(mockState.setUser).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('Test 3b: a failing session ping is swallowed (eviction handling lives in the API client)', async () => {
    mockState.user = {
      id: 'u1',
      email: 'alice@x.com',
      name: 'Alice',
      avatarUrl: 'https://x/a.jpg',
    };
    mockState.jwt = 'token';
    fetchMeMock.mockRejectedValue(new Error('GET /me failed: 401 device-evicted'));

    render(<HostComponent />);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMeMock).toHaveBeenCalledTimes(1);
    // No throw escaped; the store is untouched by the hook itself (the API
    // client's maybeHandleEviction owns the eviction side effects).
    expect(mockState.setUser).not.toHaveBeenCalled();
  });

  it('Test 4: no-op when jwt==null (signed out — never fire /me)', async () => {
    mockState.user = null;
    mockState.jwt = null;

    render(<HostComponent />);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMeMock).not.toHaveBeenCalled();

    capturedListener?.('active');
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMeMock).not.toHaveBeenCalled();
  });

  it('Test 5: AppState change → non-active state does NOT fire rehydrate', async () => {
    mockState.user = null;
    mockState.jwt = 'token';
    fetchMeMock.mockResolvedValue(RESOLVED_ME);

    render(<HostComponent />);
    await new Promise((r) => setTimeout(r, 0));
    fetchMeMock.mockClear();

    capturedListener?.('background');
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMeMock).not.toHaveBeenCalled();

    capturedListener?.('inactive');
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMeMock).not.toHaveBeenCalled();
  });

  it('Test 6: fetchMe rejection is swallowed — next mount/foreground retries', async () => {
    mockState.user = null;
    mockState.jwt = 'token';
    fetchMeMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(RESOLVED_ME);

    render(<HostComponent />);
    await new Promise((r) => setTimeout(r, 0));
    // First call rejected; setUser not called, but no throw bubbled out.
    expect(fetchMeMock).toHaveBeenCalledTimes(1);
    expect(mockState.setUser).not.toHaveBeenCalled();

    // Foreground 'active' triggers a retry that resolves cleanly.
    capturedListener?.('active');
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMeMock).toHaveBeenCalledTimes(2);
    expect(mockState.setUser).toHaveBeenCalledTimes(1);
  });

  it('Test 7: unmount removes the AppState subscription', async () => {
    mockState.user = null;
    mockState.jwt = 'token';
    fetchMeMock.mockResolvedValue(RESOLVED_ME);

    const { unmount } = render(<HostComponent />);
    await new Promise((r) => setTimeout(r, 0));
    expect(removeSpy).not.toHaveBeenCalled();

    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});
