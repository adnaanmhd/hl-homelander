// Phase 3 item 3 (2026-06-10, Bug 2) — RigTutorial gate double-check. When a
// JWT-holding user lands on the tutorial off a STALE local practiceDoneKey
// cache, the screen asks the server once (fetchMe, short timeout); if
// practice_completed_at comes back non-null (fetchMe seeds the MMKV flag as a
// side effect) the user skips straight to MainTabs instead of redoing
// practice. Offline/timeout → stays on the tutorial (safe default).

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { fetchMeMock, parentReset, parentReplace, JWT_SUB_ALICE } = vi.hoisted(() => ({
  fetchMeMock: vi.fn(),
  parentReset: vi.fn(),
  parentReplace: vi.fn(),
  // header.{"sub":"sub-alice"}.sig — decodeGoogleSubFromJwt reads the payload.
  JWT_SUB_ALICE: 'header.eyJzdWIiOiJzdWItYWxpY2UifQ.sig',
}));

const SUB = 'sub-alice';

vi.mock('../../src/services/profileService', () => ({
  fetchMe: fetchMeMock,
  postPracticeComplete: vi.fn(),
}));

vi.mock('../../src/state/appStore', () => {
  const state = {
    setTutorialDone: vi.fn(),
    jwt: JWT_SUB_ALICE,
  };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

vi.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => false,
    resetRoot: vi.fn(),
    reset: vi.fn(),
    navigate: vi.fn(),
    dispatch: vi.fn(),
    getRootState: vi.fn(),
    current: null,
  }),
  useNavigation: () => ({
    replace: vi.fn(),
    getParent: () => ({ replace: parentReplace, reset: parentReset }),
  }),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
  useIsFocused: () => true,
}));

import RigTutorialScreen from '../../src/screens/tutorial/RigTutorialScreen';
import { secureMmkv } from '../../src/state/mmkv';
import { practiceDoneKey } from '../../src/state/keys';

beforeEach(() => {
  vi.clearAllMocks();
  secureMmkv.remove(practiceDoneKey(SUB));
});

afterEach(() => {
  cleanup();
});

describe('RigTutorial gate double-check (Phase 3, Bug 2)', () => {
  it('stale local cache + server says practiced → seeds the flag and resets to MainTabs', async () => {
    // Simulate the REAL fetchMe side effect: a non-null practice_completed_at
    // seeds the local practiceDoneKey.
    fetchMeMock.mockImplementation(async () => {
      secureMmkv.set(practiceDoneKey(SUB), true);
      return { practiceCompletedAt: '2026-06-01T00:00:00Z' };
    });

    render(<RigTutorialScreen />);
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMeMock).toHaveBeenCalledTimes(1);
    expect(parentReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });

  it('offline (fetchMe rejects) → stays on the tutorial (safe default)', async () => {
    fetchMeMock.mockRejectedValue(new Error('offline'));

    render(<RigTutorialScreen />);
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMeMock).toHaveBeenCalledTimes(1);
    expect(parentReset).not.toHaveBeenCalled();
  });

  it('server says NOT practiced (no seed) → stays on the tutorial', async () => {
    fetchMeMock.mockResolvedValue({ practiceCompletedAt: null });

    render(<RigTutorialScreen />);
    await new Promise((r) => setTimeout(r, 0));

    expect(parentReset).not.toHaveBeenCalled();
  });

  it('flag already seeded by the time the screen mounts → immediate skip, no network call', async () => {
    secureMmkv.set(practiceDoneKey(SUB), true);

    render(<RigTutorialScreen />);
    await new Promise((r) => setTimeout(r, 0));

    expect(parentReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
    expect(fetchMeMock).not.toHaveBeenCalled();
  });
});
