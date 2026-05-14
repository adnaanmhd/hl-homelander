// PlayerScreen — Phase 6 Wave 6 (Plan 06-10) Task 2.
//
// Closes HIST-07/08/09. Eight behaviours, exercising the source-resolution
// branches + the disabled-overlay branches + the lifecycle invariants:
//
//   Test 1: Ledger has thumbnailPath AND mp4LocalPath AND RNFS.exists is true
//           → HumynPlayer.prepare(`file://…`) is called.
//   Test 2: Ledger has no mp4LocalPath (post-verified clear) →
//           getRecordingStreamUrl(recordingId) is called.
//   Test 3: getRecordingStreamUrl returns archiveState='deep-archive' → the
//           verbatim "This recording has been archived. Contact support for
//           retrieval." copy renders AND HumynPlayer.prepare is NOT called.
//   Test 4: getRecordingStreamUrl returns archiveState='unavailable' → the
//           verbatim "Still uploading — try again in a moment." copy renders.
//   Test 5: Tapping the X close button calls HumynPlayer.release() AND
//           navigation.goBack().
//   Test 6: Tapping the play overlay calls HumynPlayer.play() AND flips
//           paused → false (the overlay disappears).
//   Test 7: An onPlayerProgress event updates the rendered current-time
//           label.
//   Test 8: Unmount cleanup calls HumynPlayer.release() AND removes every
//           native event subscription.
//
// Service-layer + native-bridge mocks mirror HistoryScreen.test.tsx (the
// per-file pattern is well-established across Wave 5 tests). Navigation +
// route mocks supply the {recordingId, taskName} route params verbatim from
// the route registration contract (Plan 06-09 wires the navigate() call).

import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PROGRESS_LISTENERS: Array<
  (e: { positionMs: number; bufferedMs: number; durationMs: number }) => void
> = [];
const BUFFER_LISTENERS: Array<(e: { buffering: boolean }) => void> = [];
const END_LISTENERS: Array<() => void> = [];
const ERROR_LISTENERS: Array<(e: { code: number; msg: string }) => void> = [];
const PROGRESS_SUB_REMOVE = vi.fn();
const BUFFER_SUB_REMOVE = vi.fn();
const END_SUB_REMOVE = vi.fn();
const ERROR_SUB_REMOVE = vi.fn();

const {
  mockPrepare,
  mockPlay,
  mockPause,
  mockSeekTo,
  mockRelease,
  mockGetStreamUrl,
  mockReadEntry,
  mockRNFSExists,
  mockOrientationLock,
  mockOrientationUnlock,
  mockGoBack,
} = vi.hoisted(() => ({
  mockPrepare: vi.fn().mockResolvedValue(undefined),
  mockPlay: vi.fn().mockResolvedValue(undefined),
  mockPause: vi.fn().mockResolvedValue(undefined),
  mockSeekTo: vi.fn().mockResolvedValue(undefined),
  mockRelease: vi.fn().mockResolvedValue(undefined),
  mockGetStreamUrl: vi.fn(),
  mockReadEntry: vi.fn(),
  mockRNFSExists: vi.fn(),
  mockOrientationLock: vi.fn(),
  mockOrientationUnlock: vi.fn(),
  mockGoBack: vi.fn(),
}));

vi.mock('../../../src/native/HumynPlayer', () => ({
  HumynPlayer: {
    prepare: mockPrepare,
    play: mockPlay,
    pause: mockPause,
    seekTo: mockSeekTo,
    release: mockRelease,
  },
  // The native view registry is jsdom-mocked via requireNativeComponent in
  // vitest.setup.ts, but this module is mocked in its entirety here so the
  // event-subscription factory and the View must be supplied explicitly.
  HumynPlayerView: () => null,
  isPlayerAvailable: () => true,
  onPlayerProgress: (
    l: (e: { positionMs: number; bufferedMs: number; durationMs: number }) => void,
  ) => {
    PROGRESS_LISTENERS.push(l);
    return { remove: PROGRESS_SUB_REMOVE };
  },
  onPlayerBuffer: (l: (e: { buffering: boolean }) => void) => {
    BUFFER_LISTENERS.push(l);
    return { remove: BUFFER_SUB_REMOVE };
  },
  onPlayerEnd: (l: () => void) => {
    END_LISTENERS.push(l);
    return { remove: END_SUB_REMOVE };
  },
  onPlayerError: (l: (e: { code: number; msg: string }) => void) => {
    ERROR_LISTENERS.push(l);
    return { remove: ERROR_SUB_REMOVE };
  },
}));

vi.mock('../../../src/services/recordingsApi', () => ({
  getRecordingStreamUrl: mockGetStreamUrl,
}));

vi.mock('../../../src/services/thumbnailLedger', () => ({
  readEntry: mockReadEntry,
}));

vi.mock('react-native-fs', () => {
  const RNFS = {
    exists: mockRNFSExists,
    CachesDirectoryPath: '/tmp/mock-caches',
    DocumentDirectoryPath: '/tmp/mock-docs',
    TemporaryDirectoryPath: '/tmp/mock-tmp',
  };
  return { default: RNFS, ...RNFS };
});

vi.mock('react-native-orientation-locker', () => {
  const Orientation = {
    lockToPortrait: mockOrientationLock,
    unlockAllOrientations: mockOrientationUnlock,
    lockToLandscape: vi.fn(),
    getDeviceOrientation: vi.fn(),
    addDeviceOrientationListener: vi.fn(),
    removeDeviceOrientationListener: vi.fn(),
  };
  return { default: Orientation };
});

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({
    params: {
      recordingId: 'TEST_REC_ID_01H8XGJWBWBAQ4TBKAYV5VW9XK',
      taskName: 'Cooking a meal',
    },
  }),
}));

// Import AFTER mocks.
import { PlayerScreen } from '../../../src/screens/history/PlayerScreen';

beforeEach(() => {
  mockPrepare.mockClear();
  mockPlay.mockClear();
  mockPause.mockClear();
  mockSeekTo.mockClear();
  mockRelease.mockClear();
  mockGetStreamUrl.mockReset();
  mockReadEntry.mockReset();
  mockRNFSExists.mockReset();
  mockOrientationLock.mockClear();
  mockOrientationUnlock.mockClear();
  mockGoBack.mockClear();
  PROGRESS_LISTENERS.length = 0;
  BUFFER_LISTENERS.length = 0;
  END_LISTENERS.length = 0;
  ERROR_LISTENERS.length = 0;
  PROGRESS_SUB_REMOVE.mockClear();
  BUFFER_SUB_REMOVE.mockClear();
  END_SUB_REMOVE.mockClear();
  ERROR_SUB_REMOVE.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('PlayerScreen (Plan 06-10 — HIST-07/08/09)', () => {
  it('Test 1: ledger has mp4LocalPath AND RNFS.exists → HumynPlayer.prepare(file://) called', async () => {
    mockReadEntry.mockReturnValue({
      recordingId: 'TEST_REC_ID_01H8XGJWBWBAQ4TBKAYV5VW9XK',
      thumbnailPath: '/filesDir/thumbs/x.thumb.jpg',
      filename: 'rec.mp4',
      mp4LocalPath: '/filesDir/recordings/rec.mp4',
      createdAtMs: 1_700_000_000_000,
    });
    mockRNFSExists.mockResolvedValue(true);
    render(<PlayerScreen />);
    await waitFor(() => expect(mockPrepare).toHaveBeenCalled());
    expect(mockPrepare).toHaveBeenCalledWith('file:///filesDir/recordings/rec.mp4');
    // Remote stream-url is NOT consulted when the local file exists.
    expect(mockGetStreamUrl).not.toHaveBeenCalled();
  });

  it('Test 2: ledger has no mp4LocalPath (cleared post-verify) → getRecordingStreamUrl is called', async () => {
    // Ledger entry exists but mp4LocalPath is empty (D-04 post-verified clear).
    mockReadEntry.mockReturnValue({
      recordingId: 'TEST_REC_ID_01H8XGJWBWBAQ4TBKAYV5VW9XK',
      thumbnailPath: '/filesDir/thumbs/x.thumb.jpg',
      filename: 'rec.mp4',
      mp4LocalPath: '',
      createdAtMs: 1_700_000_000_000,
    });
    mockGetStreamUrl.mockResolvedValue({
      presignedUrl: 'https://recordings.humyn.ai/signed.mp4',
      expiresAt: '2026-05-14T12:00:00.000Z',
      archiveState: 'available',
    });
    render(<PlayerScreen />);
    await waitFor(() =>
      expect(mockGetStreamUrl).toHaveBeenCalledWith('TEST_REC_ID_01H8XGJWBWBAQ4TBKAYV5VW9XK'),
    );
    await waitFor(() =>
      expect(mockPrepare).toHaveBeenCalledWith('https://recordings.humyn.ai/signed.mp4'),
    );
  });

  it('Test 3: archiveState="deep-archive" → verbatim copy renders AND prepare NOT called', async () => {
    mockReadEntry.mockReturnValue(null);
    mockGetStreamUrl.mockResolvedValue({
      presignedUrl: null,
      expiresAt: '2026-05-14T12:00:00.000Z',
      archiveState: 'deep-archive',
    });
    const { findByText } = render(<PlayerScreen />);
    await findByText('This recording has been archived. Contact support for retrieval.');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('Test 4: archiveState="unavailable" → verbatim "Still uploading — try again in a moment." renders', async () => {
    mockReadEntry.mockReturnValue(null);
    mockGetStreamUrl.mockResolvedValue({
      presignedUrl: null,
      expiresAt: '2026-05-14T12:00:00.000Z',
      archiveState: 'unavailable',
    });
    const { findByText } = render(<PlayerScreen />);
    await findByText('Still uploading — try again in a moment.');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('Test 5: tapping X close calls HumynPlayer.release() AND navigation.goBack()', async () => {
    mockReadEntry.mockReturnValue(null);
    mockGetStreamUrl.mockResolvedValue({
      presignedUrl: 'https://recordings.humyn.ai/signed.mp4',
      expiresAt: '2026-05-14T12:00:00.000Z',
      archiveState: 'available',
    });
    const { findByLabelText } = render(<PlayerScreen />);
    const closeBtn = await findByLabelText('player-close');
    mockRelease.mockClear();
    fireEvent.click(closeBtn);
    expect(mockRelease).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('Test 6: tapping play overlay calls HumynPlayer.play() AND hides the overlay', async () => {
    mockReadEntry.mockReturnValue(null);
    mockGetStreamUrl.mockResolvedValue({
      presignedUrl: 'https://recordings.humyn.ai/signed.mp4',
      expiresAt: '2026-05-14T12:00:00.000Z',
      archiveState: 'available',
    });
    const { findByLabelText, queryByLabelText } = render(<PlayerScreen />);
    // Drive the buffer→ready transition so the loading state clears and the
    // play overlay is rendered (the screen only shows the overlay when
    // archiveState === 'available' && paused && !loading).
    await waitFor(() => expect(BUFFER_LISTENERS.length).toBeGreaterThan(0));
    for (const l of BUFFER_LISTENERS) l({ buffering: false });
    const playBtn = await findByLabelText('player-play-overlay');
    fireEvent.click(playBtn);
    expect(mockPlay).toHaveBeenCalled();
    // Overlay disappears once paused flips to false.
    await waitFor(() => expect(queryByLabelText('player-play-overlay')).toBeNull());
  });

  it('Test 7: onPlayerProgress event updates the rendered current-time label', async () => {
    mockReadEntry.mockReturnValue(null);
    mockGetStreamUrl.mockResolvedValue({
      presignedUrl: 'https://recordings.humyn.ai/signed.mp4',
      expiresAt: '2026-05-14T12:00:00.000Z',
      archiveState: 'available',
    });
    const { findByText, findAllByText, queryByText } = render(<PlayerScreen />);
    // Drive buffer→ready so the scrub row renders.
    await waitFor(() => expect(BUFFER_LISTENERS.length).toBeGreaterThan(0));
    for (const l of BUFFER_LISTENERS) l({ buffering: false });
    // Initial scrub row renders BOTH the current-time (0:00) and the total-
    // time (0:00) labels before any progress / duration event fires.
    const initial = await findAllByText('0:00');
    expect(initial.length).toBeGreaterThanOrEqual(2);
    // Fire a progress event at 65000ms = 1:05.
    await waitFor(() => expect(PROGRESS_LISTENERS.length).toBeGreaterThan(0));
    for (const l of PROGRESS_LISTENERS)
      l({ positionMs: 65_000, bufferedMs: 70_000, durationMs: 120_000 });
    // Current-time label updates to "1:05" and total to "2:00".
    await findByText('1:05');
    await findByText('2:00');
    // The defensive queryByText sanity check: 0:00 no longer renders (current
    // moved to 1:05; total moved to 2:00).
    expect(queryByText('0:00')).toBeNull();
  });

  it('Test 8: unmount cleanup calls HumynPlayer.release() AND removes event subscriptions', async () => {
    mockReadEntry.mockReturnValue(null);
    mockGetStreamUrl.mockResolvedValue({
      presignedUrl: 'https://recordings.humyn.ai/signed.mp4',
      expiresAt: '2026-05-14T12:00:00.000Z',
      archiveState: 'available',
    });
    const { unmount } = render(<PlayerScreen />);
    await waitFor(() => expect(PROGRESS_LISTENERS.length).toBeGreaterThan(0));
    mockRelease.mockClear();
    unmount();
    expect(mockRelease).toHaveBeenCalled();
    // Every native event subscription is .remove()'d on unmount.
    expect(PROGRESS_SUB_REMOVE).toHaveBeenCalled();
    expect(BUFFER_SUB_REMOVE).toHaveBeenCalled();
    expect(END_SUB_REMOVE).toHaveBeenCalled();
    expect(ERROR_SUB_REMOVE).toHaveBeenCalled();
    // Orientation unlock fires on unmount.
    expect(mockOrientationUnlock).toHaveBeenCalled();
  });
});
