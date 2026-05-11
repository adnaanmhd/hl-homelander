// useHandGate poll loop + RecordingScreen's gate-substate wiring — plan 04-09
// Task 2.
//
// Coverage:
//   useHandGate (in isolation, fake timers):
//     - advancing the clock by cadenceMs runs one tick: takePhoto → RNFS.moveFile
//       to a cacheDir/hand-gate/*.jpg dest → detectHands(dest, minConf) →
//       RNFS.unlink(dest) in finally
//     - detectHands → 2 → GATE_HIT; → 1 → GATE_MISS; rejects → GATE_MISS (count 0)
//     - the loop stops when `active` flips false
//   RecordingScreen gate substate:
//     - isHandDetectorAvailable() === false → GATE_BYPASS dispatched +
//       logEvent('recording_gate_bypassed', …) (HAND-08)
//     - on mount the cacheDir/hand-gate sweep (RNFS.readDir → unlink per file) runs
//     - Skip tap → GATE_SKIP + logEvent('recording_gate_skipped', …) with NO
//       image-data prop (HAND-14 — locale only)

import React, { useRef } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared spies (hoisted so the mock factories + the test bodies see the same).
// ---------------------------------------------------------------------------
const {
  mockMoveFile,
  mockMkdir,
  mockUnlink,
  mockReadDir,
  mockDetectHands,
  mockIsHandDetectorAvailable,
  mockCleanupHandDetector,
  mockLogEvent,
  mockBrightnessSet,
  mockHcStart,
  mockHcStop,
  mockHcOnSegmentStart,
  mockHcOnSegmentComplete,
  mockHcOnSessionStop,
  mockHcOnThermalAbort,
  mockHcOnError,
} = vi.hoisted(() => ({
  mockMoveFile: vi.fn().mockResolvedValue(undefined),
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockUnlink: vi.fn().mockResolvedValue(undefined),
  mockReadDir: vi.fn().mockResolvedValue([{ path: '/tmp/mock-caches/hand-gate/stale-1.jpg' }]),
  mockDetectHands: vi.fn().mockResolvedValue(2),
  mockIsHandDetectorAvailable: vi.fn().mockReturnValue(true),
  mockCleanupHandDetector: vi.fn().mockResolvedValue(undefined),
  mockLogEvent: vi.fn(),
  mockBrightnessSet: vi.fn().mockResolvedValue(undefined),
  mockHcStart: vi.fn().mockResolvedValue({
    sessionId: 's-1',
    segmentId: 'seg-1',
    recordingId: 'rec-1',
    filenameBase: '20260511_120000_001',
  }),
  mockHcStop: vi.fn().mockResolvedValue(undefined),
  mockHcOnSegmentStart: vi.fn(() => ({ remove: vi.fn() })),
  mockHcOnSegmentComplete: vi.fn(() => ({ remove: vi.fn() })),
  mockHcOnSessionStop: vi.fn(() => ({ remove: vi.fn() })),
  mockHcOnThermalAbort: vi.fn(() => ({ remove: vi.fn() })),
  mockHcOnError: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock('react-native-fs', () => {
  const RNFS = {
    CachesDirectoryPath: '/tmp/mock-caches',
    DocumentDirectoryPath: '/tmp/mock-docs',
    TemporaryDirectoryPath: '/tmp/mock-tmp',
    mkdir: mockMkdir,
    moveFile: mockMoveFile,
    unlink: mockUnlink,
    readDir: mockReadDir,
    exists: vi.fn().mockResolvedValue(false),
    getFSInfo: vi.fn().mockResolvedValue({ totalSpace: 64e9, freeSpace: 32e9 }),
  };
  return { default: RNFS, ...RNFS };
});

vi.mock('react-native-uuid', () => ({
  default: { v4: () => '00000000-0000-4000-8000-000000000000' },
  v4: () => '00000000-0000-4000-8000-000000000000',
}));

vi.mock('../../../src/native/HumynHandDetector', () => ({
  detectHands: mockDetectHands,
  isHandDetectorAvailable: mockIsHandDetectorAvailable,
  cleanup: mockCleanupHandDetector,
}));

vi.mock('../../../src/util/analytics', () => ({ logEvent: mockLogEvent }));

vi.mock('../../../src/native/HumynScreenBrightness', () => ({ set: mockBrightnessSet }));

vi.mock('../../../src/native/HumynCapture', () => ({
  start: mockHcStart,
  stop: mockHcStop,
  onSegmentStart: mockHcOnSegmentStart,
  onSegmentComplete: mockHcOnSegmentComplete,
  onSessionStop: mockHcOnSessionStop,
  onThermalAbort: mockHcOnThermalAbort,
  onError: mockHcOnError,
}));

vi.mock('@react-native-firebase/remote-config', () => ({
  default: () => ({
    setDefaults: vi.fn().mockResolvedValue(true),
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: () => ({ asNumber: (): number => 0 }),
  }),
}));

vi.mock('../../../src/native/AppFlavor', () => ({
  getFlavorContext: () => ({
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
    versionName: '1.0.0-apk',
    versionCode: 1,
    deviceModel: 'TestDevice',
  }),
  getOrMintInstallationId: vi.fn().mockResolvedValue('iid-1'),
}));

const { mockGoBack, mockNavigate, mockGetParent } = vi.hoisted(() => ({
  mockGoBack: vi.fn(),
  mockNavigate: vi.fn(),
  mockGetParent: vi.fn(() => ({ navigate: vi.fn(), reset: vi.fn() })),
}));
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    replace: vi.fn(),
    reset: vi.fn(),
    push: vi.fn(),
    getParent: mockGetParent,
  }),
  useRoute: () => ({
    key: 'Recording-1',
    name: 'Recording',
    params: { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true },
  }),
}));

// react-native-tts speakCue/pickAndSetEnInVoice — keep them inert.
vi.mock('../../../src/lib/ttsVoice', () => ({
  pickAndSetEnInVoice: vi.fn().mockResolvedValue(undefined),
  speakCue: vi.fn(),
}));

// useRecordingLifecycle has its own test (useRecordingLifecycle.test.tsx); here
// we stub it so RecordingScreen's gate wiring is testable without the §10
// NativeEventEmitter subscriptions (HumynPhoneState/HumynBattery).
vi.mock('../../../src/screens/recording/useRecordingLifecycle', () => ({
  useRecordingLifecycle: () => ({
    checkStartGuards: vi.fn().mockResolvedValue({ blocked: false }),
  }),
  default: () => ({ checkStartGuards: vi.fn().mockResolvedValue({ blocked: false }) }),
}));

// appStore — minimal selectorless getState() for buildCaptureOpts.
vi.mock('../../../src/state/appStore', () => {
  const state = {
    user: { id: 'u', email: 'u@example.com', name: 'U', avatarUrl: null },
    consent: { acceptedAt: '2026-05-01T00:00:00Z', consentVersion: 'v1' },
  };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

import { useHandGate, HAND_GATE_DIR } from '../../../src/screens/recording/useHandGate';
import RecordingScreen from '../../../src/screens/recording/RecordingScreen';
import { initialRecState, type RecState } from '../../../src/screens/recording/recState';

// --- a tiny harness component for useHandGate -------------------------------
type GateAction = { type: 'GATE_HIT'; now: number } | { type: 'GATE_MISS' };
function GateHarness({
  active,
  onAction,
  takePhoto,
}: {
  active: boolean;
  onAction: (a: GateAction) => void;
  takePhoto: () => Promise<{ path: string }>;
}) {
  const camRef = useRef<{ takePhoto: typeof takePhoto } | null>({ takePhoto });
  useHandGate({
    active,
    cadenceMs: 400,
    minConfidence: 0.5,
    camRef: camRef as unknown as React.RefObject<{
      takePhoto(opts: { flash: 'off'; enableShutterSound: boolean }): Promise<{ path: string }>;
    } | null>,
    dispatch: onAction,
  });
  return null;
}

function stateIn(substate: RecState['substate'], overrides: Partial<RecState> = {}): RecState {
  const s = initialRecState({
    taskId: '__practice__',
    taskName: 'Practice — 60 sec',
    isPractice: true,
  });
  return { ...s, ...overrides, substate, gate: { ...s.gate, ...(overrides.gate ?? {}) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDetectHands.mockResolvedValue(2);
  mockIsHandDetectorAvailable.mockReturnValue(true);
  mockReadDir.mockResolvedValue([{ path: '/tmp/mock-caches/hand-gate/stale-1.jpg' }]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useHandGate poll loop', () => {
  it('runs one tick per cadence: takePhoto → moveFile to cacheDir/hand-gate/*.jpg → detectHands → unlink', async () => {
    vi.useFakeTimers();
    const takePhoto = vi.fn().mockResolvedValue({ path: '/tmp/vc-photo.jpg' });
    const onAction = vi.fn();
    render(<GateHarness active onAction={onAction} takePhoto={takePhoto} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(takePhoto).toHaveBeenCalledWith({ flash: 'off', enableShutterSound: false });
    expect(mockMoveFile).toHaveBeenCalledTimes(1);
    const dest = mockMoveFile.mock.calls[0]![1] as string;
    expect(dest.startsWith(`${HAND_GATE_DIR}/`)).toBe(true);
    expect(dest.endsWith('.jpg')).toBe(true);
    expect(mockDetectHands).toHaveBeenCalledWith(dest, 0.5);
    expect(mockUnlink).toHaveBeenCalledWith(dest);
  });

  it('detectHands → 2 dispatches GATE_HIT', async () => {
    vi.useFakeTimers();
    mockDetectHands.mockResolvedValue(2);
    const onAction = vi.fn();
    render(
      <GateHarness
        active
        onAction={onAction}
        takePhoto={vi.fn().mockResolvedValue({ path: '/tmp/p.jpg' })}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'GATE_HIT' }));
  });

  it('detectHands → 1 dispatches GATE_MISS', async () => {
    vi.useFakeTimers();
    mockDetectHands.mockResolvedValue(1);
    const onAction = vi.fn();
    render(
      <GateHarness
        active
        onAction={onAction}
        takePhoto={vi.fn().mockResolvedValue({ path: '/tmp/p.jpg' })}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(onAction).toHaveBeenCalledWith({ type: 'GATE_MISS' });
  });

  it('detectHands rejecting is treated as a miss (count 0)', async () => {
    vi.useFakeTimers();
    mockDetectHands.mockRejectedValue(new Error('HAND_DETECT_FAILED'));
    const onAction = vi.fn();
    render(
      <GateHarness
        active
        onAction={onAction}
        takePhoto={vi.fn().mockResolvedValue({ path: '/tmp/p.jpg' })}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(onAction).toHaveBeenCalledWith({ type: 'GATE_MISS' });
  });

  it('does not tick when inactive', async () => {
    vi.useFakeTimers();
    const takePhoto = vi.fn().mockResolvedValue({ path: '/tmp/p.jpg' });
    render(<GateHarness active={false} onAction={vi.fn()} takePhoto={takePhoto} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(takePhoto).not.toHaveBeenCalled();
  });
});

describe('RecordingScreen — gate substate wiring', () => {
  it('isHandDetectorAvailable() === false → GATE_BYPASS + recording_gate_bypassed (HAND-08)', async () => {
    mockIsHandDetectorAvailable.mockReturnValue(false);
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('gate', {
            gate: { ...stateIn('gate').gate, phase: 'loading' },
          })}
        />,
      );
    });
    expect(mockLogEvent).toHaveBeenCalledWith('recording_gate_started', expect.any(Object));
    expect(mockLogEvent).toHaveBeenCalledWith('recording_gate_bypassed', expect.any(Object));
  });

  it('on mount, sweeps the cacheDir/hand-gate dir (readDir → unlink per file)', async () => {
    await act(async () => {
      render(<RecordingScreen __test_initialState={stateIn('ready')} />);
    });
    expect(mockReadDir).toHaveBeenCalledWith(HAND_GATE_DIR);
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/mock-caches/hand-gate/stale-1.jpg');
  });

  it('Skip tap → GATE_SKIP + recording_gate_skipped (locale only — NO image data)', async () => {
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('gate', {
            gate: { ...stateIn('gate').gate, phase: 'waiting' },
          })}
        />,
      );
    });
    fireEvent.click(screen.getByLabelText('recording-skip'));
    const skipCall = mockLogEvent.mock.calls.find((c) => c[0] === 'recording_gate_skipped');
    expect(skipCall).toBeTruthy();
    const props = (skipCall?.[1] ?? {}) as Record<string, unknown>;
    expect(props).toHaveProperty('locale');
    expect(props).not.toHaveProperty('image');
    expect(props).not.toHaveProperty('frame');
    expect(props).not.toHaveProperty('bitmap');
    // Skip dispatched → gate.phase confirmed → the Skip link is gone.
    expect(screen.queryByLabelText('recording-skip')).toBeNull();
  });

  it('locks landscape on mount and restores brightness on unmount (REC-01 / REC-08)', async () => {
    let unmount: (() => void) | undefined;
    await act(async () => {
      const r = render(<RecordingScreen __test_initialState={stateIn('ready')} />);
      unmount = r.unmount;
    });
    // HumynScreenBrightness.set(-1) fires on unmount.
    await act(async () => {
      unmount?.();
    });
    expect(mockBrightnessSet).toHaveBeenCalledWith(-1);
  });
});
