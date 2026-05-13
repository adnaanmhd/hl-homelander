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

vi.mock('../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: vi.fn(async () => mockQueue.rows),
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
vi.mock('@react-navigation/native', async () => ({
  // Preserve the global vitest.setup.ts mock for everything else; we just want
  // useNavigation to return our spy so we can assert routes.
  useNavigation: () => ({ navigate: navigateMock }),
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
});
