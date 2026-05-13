// HomeSkeletonScreen — Phase 2 plan 02-16 Task 2.
//
// Behaviour matrix (3 tests, drives the Phase 2 Home shell contract):
//   Test 1: Renders the TopBar (Humyn Labs wordmark) + an avatar Pressable
//           wired to navigate to Profile (HOME-07: only entry point).
//   Test 2: Hides the soft-upgrade banner slot when softUpgradeAvailable=null.
//   Test 3: Renders the soft-upgrade banner slot when softUpgradeAvailable
//           is non-null (plan 02-20 wires the actual banner into this slot).
//
// Mocking notes:
//   - vitest.setup.ts mocks @react-navigation/native globally (useNavigation
//     returns spy fns); we use that as-is.
//   - useAppStore is mocked per-test via vi.hoisted so a single hoisted
//     selector spy can return different shapes for the soft-upgrade-on/off
//     branches. The Zustand-style selector hook contract is preserved:
//     `useAppStore((s) => s.softUpgradeAvailable)` returns the value the
//     selector pulls from the synthetic state object.

import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UploadQueueRow } from '../../src/native/HumynUpload';

// ---------------------------------------------------------------------------
// vi.hoisted spies — declared at the same hoisted level as the vi.mock
// factory below so the factory can reference them safely. Module-level
// const declarations execute AFTER hoisted vi.mock factories.
//
// Plan 03-03 Task 1 — `user` slice added to mockState because the screen now
// sources avatar props through the shared `useTabTopBarProps()` hook
// (Pattern 71) which selects `appStore.user`.
//
// Plan 05-14 Task 8 / 10 — adds mocks for HumynUpload + onUploadQueueChanged
// + onUploadProgress so the pending-uploads tile + progress bar can be
// exercised. The mock also captures the progressListener so tests can fire
// synthetic onUploadProgress events.
// ---------------------------------------------------------------------------
type MockUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
} | null;

const SUB = 'sub-alice';

const { mockState, mockQueue, hooks } = vi.hoisted(() => ({
  mockState: {
    softUpgradeAvailable: null as { latest: string } | null,
    user: null as MockUser,
    jwt: 'jwt-token' as string | null,
  },
  mockQueue: { rows: [] as UploadQueueRow[] },
  hooks: {
    queueChangedRemove: vi.fn(),
    progressRemove: vi.fn(),
    progressListener: null as
      | ((e: { recordingId: string; bytesUploaded: number; bytesTotal: number }) => void)
      | null,
  },
}));

vi.mock('../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: typeof mockState) => T) => selector(mockState),
}));

// Wave-2 #5 — `drainNowSafe` is exercised by the tile-tap kick test. Spy
// declared via vi.hoisted so the factory below can reference it.
const { drainNowSafeMock } = vi.hoisted(() => ({
  drainNowSafeMock: vi.fn(async () => undefined),
}));

vi.mock('../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: vi.fn(async () => mockQueue.rows),
    drainNowSafe: drainNowSafeMock,
  },
  onUploadQueueChanged: vi.fn(() => ({ remove: hooks.queueChangedRemove })),
  onUploadProgress: vi.fn(
    (cb: (e: { recordingId: string; bytesUploaded: number; bytesTotal: number }) => void) => {
      hooks.progressListener = cb;
      return { remove: hooks.progressRemove };
    },
  ),
}));

vi.mock('../../src/lib/jwtSub', () => ({
  decodeGoogleSubFromJwt: (jwt: string | null) => (jwt ? SUB : ''),
}));

// Import AFTER the mock so the screen's import of useAppStore resolves to
// the mocked module.
import HomeSkeletonScreen from '../../src/screens/home/HomeSkeletonScreen';

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

const navigateMock = vi.fn();
// Wave-2 #6 — `useFocusEffect` is invoked on every render in tests (RN
// stack would only fire it when the screen actually gains focus). We
// invoke the effect's setup fn synchronously and capture its cleanup so
// the test can simulate Home → blur by triggering the cleanup directly.
const focusCleanups: Array<() => void> = [];
vi.mock('@react-navigation/native', async () => ({
  useNavigation: () => ({ navigate: navigateMock }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === 'function') focusCleanups.push(cleanup);
  },
}));

// Wave-2 #6 — mock `reconcileOnce` so the test can assert the auto-poll
// interval calls it at the 30 s cadence (without actually hitting the
// network or the native upload module). The factory closes over a vi.fn
// declared via vi.hoisted so the assertions can target the same spy the
// screen's import resolves to.
const { reconcileOnceMock } = vi.hoisted(() => ({
  reconcileOnceMock: vi.fn(async () => 0),
}));
vi.mock('../../src/services/uploadReconcile', () => ({
  reconcileOnce: reconcileOnceMock,
}));

describe('HomeSkeletonScreen', () => {
  afterEach(() => {
    cleanup();
    mockState.softUpgradeAvailable = null;
    mockState.user = null;
    mockState.jwt = 'jwt-token';
    mockQueue.rows = [];
    hooks.queueChangedRemove.mockReset();
    hooks.progressRemove.mockReset();
    hooks.progressListener = null;
    navigateMock.mockReset();
    reconcileOnceMock.mockClear();
    drainNowSafeMock.mockClear();
    focusCleanups.length = 0;
  });

  it('renders the TopBar (Humyn Labs wordmark) and an avatar Pressable', () => {
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    // Plan 03-11 (A4) — wordmark is now an Image (orange logo); assert the
    // accessibility label of the Image rather than the legacy 'Humyn Labs'
    // Text node which has been removed.
    expect(getByLabelText('Humyn Labs Capture wordmark')).toBeTruthy();
    expect(getByLabelText('top-bar-avatar')).toBeTruthy();
  });

  it('hides the soft-upgrade banner slot when softUpgradeAvailable is null', () => {
    mockState.softUpgradeAvailable = null;
    const { queryByLabelText } = render(<HomeSkeletonScreen />);
    expect(queryByLabelText('soft-upgrade-banner-slot')).toBeNull();
  });

  it('renders the soft-upgrade banner slot when softUpgradeAvailable is non-null', () => {
    mockState.softUpgradeAvailable = { latest: '0.16.0' };
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    expect(getByLabelText('soft-upgrade-banner-slot')).toBeTruthy();
  });

  it('renders avatar with Google initial when appStore.user is populated (Pattern 71)', () => {
    mockState.user = {
      id: '1',
      email: 'alice@x.com',
      name: 'Alice',
      avatarUrl: 'https://x/a.jpg',
    };
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    // avatarUrl is set → an Image renders inside the Pressable instead of an
    // initial fallback. Assert the Image's accessibility label is present.
    expect(getByLabelText('top-bar-avatar-image')).toBeTruthy();
    // Plan 03-11 (A4) — wordmark Image still present alongside the avatar.
    expect(getByLabelText('Humyn Labs Capture wordmark')).toBeTruthy();
  });

  it('falls back to "U" initial when appStore.user is null', () => {
    mockState.user = null;
    const { getByText, queryByLabelText } = render(<HomeSkeletonScreen />);
    expect(queryByLabelText('top-bar-avatar-image')).toBeNull();
    // The 'U' initial renders as Text inside the Pressable.
    expect(getByText('U')).toBeTruthy();
  });

  // Wave-1.5 Item 4 — live progress bar on the Home tile.

  it('renders the sibling progress bar on a tile-row when an uploading row gets a progress event', async () => {
    mockQueue.rows = [row({ recordingId: 'rec1', state: 'uploading' })];
    const { findByLabelText } = render(<HomeSkeletonScreen />);
    // Wait for getQueueSafe to resolve.
    await findByLabelText('pending-uploads-tile-row');
    act(() => {
      hooks.progressListener?.({ recordingId: 'rec1', bytesUploaded: 47, bytesTotal: 100 });
    });
    const fill = await findByLabelText('pending-uploads-tile-progress-fill');
    const inline = (fill as HTMLElement).getAttribute('style') ?? '';
    expect(inline).toMatch(/width:\s*47%/);
  });

  it('does NOT render the tile progress bar for non-uploading rows', async () => {
    mockQueue.rows = [row({ recordingId: 'rec1', state: 'awaiting-verify' })];
    const { findByLabelText, queryByLabelText } = render(<HomeSkeletonScreen />);
    await findByLabelText('pending-uploads-tile-row');
    // Even firing a progress event has no effect — the row's state isn't 'uploading'.
    act(() => {
      hooks.progressListener?.({ recordingId: 'rec1', bytesUploaded: 47, bytesTotal: 100 });
    });
    expect(queryByLabelText('pending-uploads-tile-progress-fill')).toBeNull();
  });

  it('tile chip label shows "Uploading… 47%" when a progress event arrives (47 of 100 bytes)', async () => {
    mockQueue.rows = [row({ recordingId: 'rec1', state: 'uploading' })];
    const { findByText } = render(<HomeSkeletonScreen />);
    // Use act to wait for getQueueSafe to resolve and the row to render, then fire progress.
    await new Promise((r) => setTimeout(r, 0));
    act(() => {
      hooks.progressListener?.({ recordingId: 'rec1', bytesUploaded: 47, bytesTotal: 100 });
    });
    expect(await findByText(/Uploading… 47%/)).toBeTruthy();
  });

  // Wave-1.5 Item 6 — Home pending-uploads-tile tap routes to MainTabs/History.

  it('pending-uploads-tile tap routes to MainTabs → History (Wave-1.5 Item 6)', async () => {
    const fireEvent = (await import('@testing-library/react')).fireEvent;
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    fireEvent.click(getByLabelText('pending-uploads-tile'));
    expect(navigateMock).toHaveBeenCalledWith('MainTabs', { screen: 'History' });
  });

  it('pending-uploads-tile tap does NOT route to the standalone PendingUploads orphan screen', async () => {
    const fireEvent = (await import('@testing-library/react')).fireEvent;
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    fireEvent.click(getByLabelText('pending-uploads-tile'));
    // Old (Phase-5-08) route was navigation.navigate('PendingUploads') — Wave-1.5 Item 6 removes it.
    expect(navigateMock).not.toHaveBeenCalledWith('PendingUploads');
    expect(navigateMock).not.toHaveBeenCalledWith('PendingUploads', expect.anything());
  });

  // Wave-2 #6 — verified-event auto-poll while Home is focused.

  it('schedules a 30s reconcileOnce poll while Home is focused, and clears it on blur (Wave-2 #6)', () => {
    vi.useFakeTimers();
    try {
      render(<HomeSkeletonScreen />);
      // No poll has fired yet — only the interval is scheduled, not an immediate tick.
      expect(reconcileOnceMock).toHaveBeenCalledTimes(0);
      vi.advanceTimersByTime(29_999);
      expect(reconcileOnceMock).toHaveBeenCalledTimes(0);
      vi.advanceTimersByTime(1);
      expect(reconcileOnceMock).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(30_000);
      expect(reconcileOnceMock).toHaveBeenCalledTimes(2);
      // Simulate the screen losing focus: run the captured useFocusEffect
      // cleanup. After that, no further ticks fire even as time advances.
      const before = reconcileOnceMock.mock.calls.length;
      focusCleanups.forEach((fn) => fn());
      vi.advanceTimersByTime(120_000);
      expect(reconcileOnceMock).toHaveBeenCalledTimes(before);
    } finally {
      vi.useRealTimers();
    }
  });

  // Wave-2 #5 — tile-tap kicks the drainer in addition to navigating.

  it('pending-uploads-tile tap also kicks HumynUpload.drainNowSafe (Wave-2 #5)', async () => {
    const fireEvent = (await import('@testing-library/react')).fireEvent;
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    fireEvent.click(getByLabelText('pending-uploads-tile'));
    expect(drainNowSafeMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('MainTabs', { screen: 'History' });
  });

  it('pending-uploads-tile tap still navigates when drainNowSafe rejects (Wave-2 #5 — never starves nav)', async () => {
    drainNowSafeMock.mockRejectedValueOnce(new Error('no native module'));
    const fireEvent = (await import('@testing-library/react')).fireEvent;
    const { getByLabelText } = render(<HomeSkeletonScreen />);
    fireEvent.click(getByLabelText('pending-uploads-tile'));
    // Synchronously navigates even though the drainNowSafe promise is rejected
    // (the `.catch(() => undefined)` swallows; the navigate call sits after the
    // void-prefixed drainNowSafe invocation in the same press handler).
    expect(navigateMock).toHaveBeenCalledWith('MainTabs', { screen: 'History' });
  });

  it('swallows reconcileOnce errors without crashing the poll loop (Wave-2 #6)', () => {
    vi.useFakeTimers();
    reconcileOnceMock.mockRejectedValueOnce(new Error('network down'));
    try {
      render(<HomeSkeletonScreen />);
      // The rejected promise must not be thrown synchronously by the interval
      // tick — if it were, the next tick would never schedule and the test
      // would observe exactly one call. Two ticks of 30 s each prove the loop
      // survives the error.
      vi.advanceTimersByTime(30_000);
      vi.advanceTimersByTime(30_000);
      expect(reconcileOnceMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
