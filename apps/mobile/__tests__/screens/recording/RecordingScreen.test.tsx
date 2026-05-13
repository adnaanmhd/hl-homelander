// RecordingScreen — the live recording surface (plan 04-09; was plan 04-07's
// chrome-only shell test).
//
// The screen is substate-driven; this test exercises each substate via the
// `__test_initialState` escape hatch and asserts:
//   - the dark-theme chrome renders the verbatim copy + substate affordances
//   - REC-01: Orientation.lockToLandscape() on mount; unlockAllOrientations() +
//     HumynScreenBrightness.set(-1) on unmount (REC-08)
//   - the gate-pass → active transition (passed): Vibration.vibrate(120) +
//     speakCue('Recording started') + HumynScreenBrightness.set(0.05) +
//     HumynCapture.start(<opts that parse>) → CAPTURE_STARTED → 'active'
//   - HumynCapture.start reject {code:'thermal_throttling'} → set(-1) + toast +
//     back to 'ready'
//   - gate confirmed via Skip → NO vibrate, NO 'Recording started' cue, but
//     set(0.05) STILL called + HumynCapture.start STILL called (HAND-07)
//   - practice recording stopped → HumynCapture.stop() + nav toward PracticeComplete
//   - real recording stopped ≥60s → showToast(…added to your contribution.) + nav toward MainTabs
//   - real recording stopped <60s → showToast('Recording too short — discarded.') + RESET_FOR_FRESH
//   - checkStartGuards blocked → showToast(toast) + back to 'ready' (REC-16)

import React from 'react';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vibration } from 'react-native';
// Wave-1.5 Item 5 — the contribution toast moved from RecordingScreen's
// local `<Toast>` host to the global ToastHost via the deliver-on-Home bus.
// The ≥60s post-stop test (§7h) drains the bus instead of asserting an
// in-screen `recording-toast` element.
import {
  drainPendingUploadToast,
  __test_resetUploadToastBus,
} from '../../../src/state/uploadToastBus';

// The global react-native mock (vitest.setup.ts) ships Vibration as a no-op
// object; spy on it so the gate-pass haptic is assertable without re-mocking
// react-native (whose real index.js is Flow and can't be transformed).
const vibrateSpy = vi.spyOn(Vibration, 'vibrate');

const {
  mockLogEvent,
  mockSpeakCue,
  mockPickVoice,
  mockBrightnessSet,
  mockHcStart,
  mockHcStop,
  mockHcEvtSub,
  mockDetectAvailable,
  mockCleanupHandDetector,
  mockOrientationLock,
  mockOrientationUnlock,
  mockGetDeviceOrientation,
  mockAddDeviceOrientationListener,
  mockRemoveDeviceOrientationListener,
  deviceOrientationListeners,
  mockReadDir,
  mockUnlink,
  mockCheckStartGuards,
  mockGoBack,
  mockNavigate,
  mockParentNavigate,
  mockParentReset,
  lifecycleCallbacksRef,
} = vi.hoisted(() => {
  const deviceOrientationListeners: Array<(o: string) => void> = [];
  return {
    mockLogEvent: vi.fn(),
    mockSpeakCue: vi.fn(),
    mockPickVoice: vi.fn().mockResolvedValue(undefined),
    mockBrightnessSet: vi.fn().mockResolvedValue(undefined),
    mockHcStart: vi.fn().mockResolvedValue({
      sessionId: 's',
      segmentId: 'seg',
      recordingId: 'rec',
      filenameBase: '20260511_120000_001',
    }),
    mockHcStop: vi.fn().mockResolvedValue(undefined),
    mockHcEvtSub: vi.fn(() => ({ remove: vi.fn() })),
    mockDetectAvailable: vi.fn().mockReturnValue(true),
    mockCleanupHandDetector: vi.fn().mockResolvedValue(undefined),
    mockOrientationLock: vi.fn(),
    mockOrientationUnlock: vi.fn(),
    // CR-01 — the screen's new rotate-prompt → ready effect drives
    // `getDeviceOrientation(cb)` (fire-once) + `addDeviceOrientationListener`.
    // Default the fire-once read to PORTRAIT (a fresh mount stays in
    // rotate-prompt unless a test overrides `getDeviceOrientation`); capture
    // every registered listener so a test can drive it.
    mockGetDeviceOrientation: vi.fn((cb: (o: string) => void) => cb('PORTRAIT')),
    mockAddDeviceOrientationListener: vi.fn((fn: (o: string) => void) => {
      deviceOrientationListeners.push(fn);
    }),
    mockRemoveDeviceOrientationListener: vi.fn((fn: (o: string) => void) => {
      const i = deviceOrientationListeners.indexOf(fn);
      if (i >= 0) deviceOrientationListeners.splice(i, 1);
    }),
    deviceOrientationListeners,
    mockReadDir: vi.fn().mockResolvedValue([]),
    mockUnlink: vi.fn().mockResolvedValue(undefined),
    mockCheckStartGuards: vi.fn().mockResolvedValue({ blocked: false }),
    mockGoBack: vi.fn(),
    mockNavigate: vi.fn(),
    mockParentNavigate: vi.fn(),
    mockParentReset: vi.fn(),
    // Captures the `callbacks` object the screen passes to useRecordingLifecycle
    // so a test can drive `onStop(reason)` directly (the §10 lifecycle hook is
    // mocked out, so this is the only way to reach handleStop with a non-'manual'
    // StopReason — e.g. 'battery_critical' / 'thermal' for the D-05 routing).
    lifecycleCallbacksRef: { current: null as null | { onStop: (r: string) => void } },
  };
});

vi.mock('../../../src/util/analytics', () => ({ logEvent: mockLogEvent }));

vi.mock('../../../src/lib/ttsVoice', () => ({
  speakCue: mockSpeakCue,
  pickAndSetEnInVoice: mockPickVoice,
}));

vi.mock('../../../src/native/HumynScreenBrightness', () => ({ set: mockBrightnessSet }));

vi.mock('../../../src/native/HumynCapture', () => ({
  start: mockHcStart,
  stop: mockHcStop,
  onSegmentStart: mockHcEvtSub,
  onSegmentComplete: mockHcEvtSub,
  onSessionStop: mockHcEvtSub,
  onThermalAbort: mockHcEvtSub,
  onError: mockHcEvtSub,
}));

vi.mock('../../../src/native/HumynHandDetector', () => ({
  isHandDetectorAvailable: mockDetectAvailable,
  detectHands: vi.fn().mockResolvedValue(0),
  cleanup: mockCleanupHandDetector,
}));

// Native Camera2 gate camera (debug handgate-never-passes). `startGate` returns
// a never-settling promise so the gate stays in its `loading` phase (CAMERA_READY
// never fires) — the existing chrome tests assert "Preparing camera…" /
// gate-ring rendering, not the post-CAMERA_READY poll loop. `isGateCameraAvailable`
// is true so the HAND-08 bypass doesn't fire spuriously.
vi.mock('../../../src/native/HumynGateCamera', () => ({
  startGate: vi.fn(() => new Promise<void>(() => undefined)),
  captureFrame: vi.fn().mockResolvedValue(undefined),
  stopGate: vi.fn().mockResolvedValue(undefined),
  isGateCameraAvailable: () => true,
  HumynGateCameraView: () => null,
}));

vi.mock('react-native-orientation-locker', () => {
  const ENUM = {
    PORTRAIT: 'PORTRAIT',
    'LANDSCAPE-LEFT': 'LANDSCAPE-LEFT',
    'LANDSCAPE-RIGHT': 'LANDSCAPE-RIGHT',
    'PORTRAIT-UPSIDEDOWN': 'PORTRAIT-UPSIDEDOWN',
    UNKNOWN: 'UNKNOWN',
  };
  const Orientation = {
    lockToLandscape: mockOrientationLock,
    unlockAllOrientations: mockOrientationUnlock,
    getDeviceOrientation: mockGetDeviceOrientation,
    getInitialOrientation: vi.fn(() => 'PORTRAIT'),
    addDeviceOrientationListener: mockAddDeviceOrientationListener,
    removeDeviceOrientationListener: mockRemoveDeviceOrientationListener,
    addOrientationListener: vi.fn(),
    removeOrientationListener: vi.fn(),
  };
  return { default: Orientation, OrientationType: ENUM, OrientationLocker: () => null };
});

vi.mock('react-native-fs', () => {
  const RNFS = {
    CachesDirectoryPath: '/tmp/mock-caches',
    DocumentDirectoryPath: '/tmp/mock-docs',
    TemporaryDirectoryPath: '/tmp/mock-tmp',
    mkdir: vi.fn().mockResolvedValue(undefined),
    moveFile: vi.fn().mockResolvedValue(undefined),
    unlink: mockUnlink,
    readDir: mockReadDir,
    exists: vi.fn().mockResolvedValue(false),
    getFSInfo: vi.fn().mockResolvedValue({ totalSpace: 64e9, freeSpace: 32e9 }),
  };
  return { default: RNFS, ...RNFS };
});

vi.mock('../../../src/screens/recording/useRecordingLifecycle', () => {
  const useRecordingLifecycle = (args: { callbacks: { onStop: (r: string) => void } }) => {
    // Stash the live callbacks so a test can fire onStop('battery_critical') etc.
    lifecycleCallbacksRef.current = args?.callbacks ?? null;
    return { checkStartGuards: mockCheckStartGuards };
  };
  return { useRecordingLifecycle, default: useRecordingLifecycle };
});

vi.mock('../../../src/native/AppFlavor', () => ({
  getFlavorContext: () => ({
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
    versionName: '1.0.0-apk',
    versionCode: 1,
    deviceModel: 'TestDevice',
  }),
  getOrMintInstallationId: vi.fn().mockResolvedValue('iid'),
}));

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

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    replace: vi.fn(),
    reset: vi.fn(),
    push: vi.fn(),
    getParent: () => ({ navigate: mockParentNavigate, reset: mockParentReset }),
  }),
  useRoute: () => mockRoute(),
}));

let _routeParams: Record<string, unknown> = {
  taskId: '__practice__',
  taskName: 'Practice — 60 sec',
  isPractice: true,
};
function mockRoute() {
  return { key: 'Recording-1', name: 'Recording', params: _routeParams };
}

import RecordingScreen from '../../../src/screens/recording/RecordingScreen';
import { initialRecState, type RecState } from '../../../src/screens/recording/recState';
import { CaptureSessionOptsSchema } from '@humyn/shared-types';

function stateIn(substate: RecState['substate'], overrides: Partial<RecState> = {}): RecState {
  const s = initialRecState({
    taskId: (_routeParams.taskId as string) ?? '__practice__',
    taskName: (_routeParams.taskName as string) ?? 'Practice — 60 sec',
    isPractice: (_routeParams.isPractice as boolean) ?? false,
  });
  return { ...s, ...overrides, substate, gate: { ...s.gate, ...(overrides.gate ?? {}) } };
}

function confirmedGate(kind: 'passed' | 'skipped' | 'bypassed'): RecState {
  const base = stateIn('gate', {
    gate: {
      ...stateIn('gate').gate,
      phase: 'confirmed',
      startedAt: 0,
      confirmedAt: 1500,
      skipped: kind === 'skipped',
      bypassed: kind === 'bypassed',
      consecutiveHits: kind === 'passed' ? stateIn('gate').gate.targetHits : 0,
    },
  });
  return base;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHcStart.mockResolvedValue({
    sessionId: 's',
    segmentId: 'seg',
    recordingId: 'rec',
    filenameBase: '20260511_120000_001',
  });
  mockCheckStartGuards.mockResolvedValue({ blocked: false });
  mockDetectAvailable.mockReturnValue(true);
  // vi.clearAllMocks() drops the orientation-mock implementations — re-prime them.
  mockGetDeviceOrientation.mockImplementation((cb: (o: string) => void) => cb('PORTRAIT'));
  mockAddDeviceOrientationListener.mockImplementation((fn: (o: string) => void) => {
    deviceOrientationListeners.push(fn);
  });
  mockRemoveDeviceOrientationListener.mockImplementation((fn: (o: string) => void) => {
    const i = deviceOrientationListeners.indexOf(fn);
    if (i >= 0) deviceOrientationListeners.splice(i, 1);
  });
  deviceOrientationListeners.length = 0;
  _routeParams = { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true };
  __test_resetUploadToastBus();
});
afterEach(() => cleanup());

describe('RecordingScreen chrome (substate-driven)', () => {
  it('renders the dark surface with the task name + close button + overlay tip', async () => {
    await act(async () => {
      render(<RecordingScreen __test_initialState={stateIn('ready')} />);
    });
    expect(screen.getByLabelText('Recording screen')).toBeTruthy();
    expect(screen.getByText('Practice — 60 sec')).toBeTruthy();
    expect(screen.getByLabelText('recording-close')).toBeTruthy();
    expect(screen.getByText("Don't exit while recording.")).toBeTruthy();
  });

  it('rotate-prompt / ready / gate substates render their chrome', async () => {
    await act(async () => {
      render(<RecordingScreen __test_initialState={stateIn('rotate-prompt')} />);
    });
    expect(screen.getByLabelText('rotate-prompt')).toBeTruthy();
    cleanup();
    await act(async () => {
      render(<RecordingScreen __test_initialState={stateIn('ready')} />);
    });
    expect(screen.getByLabelText('recording-record-button')).toBeTruthy();
    expect(screen.getByText('Start Recording')).toBeTruthy();
    cleanup();
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('gate', {
            gate: { ...stateIn('gate').gate, phase: 'waiting' },
          })}
        />,
      );
    });
    expect(screen.getByLabelText('gate-ring')).toBeTruthy();
    expect(
      screen.getByText('Mount the phone on your head and bring your hands in frame for 2 secs'),
    ).toBeTruthy();
    expect(screen.getByLabelText('recording-skip')).toBeTruthy();
  });

  it('gate.loading shows "Preparing camera…" when the detector IS available', async () => {
    mockDetectAvailable.mockReturnValue(true);
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('gate', {
            gate: { ...stateIn('gate').gate, phase: 'loading' },
          })}
        />,
      );
    });
    expect(screen.getByText('Preparing camera…')).toBeTruthy();
  });

  it('gate.loading + detector UNAVAILABLE → GATE_BYPASS (HAND-08) — bypassed event fired', async () => {
    mockDetectAvailable.mockReturnValue(false);
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('gate', {
            gate: { ...stateIn('gate').gate, phase: 'loading' },
          })}
        />,
      );
    });
    expect(mockLogEvent).toHaveBeenCalledWith('recording_gate_bypassed', expect.any(Object));
  });

  it('active substate renders the HH:MM:SS timer + stop button', async () => {
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 332_000 })}
        />,
      );
    });
    expect(screen.getByText('00:05:32')).toBeTruthy();
    expect(screen.getByLabelText('recording-stop')).toBeTruthy();
  });

  it('stop-confirm renders the StopConfirmModal with the LOCKED body copy', async () => {
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('stop-confirm', { startedAt: 0, durationMs: 5000 })}
        />,
      );
    });
    expect(screen.getByText('Stop recording?')).toBeTruthy();
    expect(screen.getByText('Recordings under 1 minute are discarded.')).toBeTruthy();
  });
});

describe('CR-01 — rotate-prompt is reachable in a non-__DEV__ build', () => {
  // These tests deliberately mount RecordingScreen with the DEFAULT
  // initialRecState — NO __test_initialState — so they exercise the production
  // rotate-prompt → ready path (the device-orientation effect), the exact path
  // every prior RecordingScreen.test.tsx case bypassed by injecting state.
  it('default mount renders rotate-prompt, then the device-orientation listener reporting LANDSCAPE-LEFT advances the surface to ready', async () => {
    await act(async () => {
      render(<RecordingScreen />);
    });
    expect(screen.getByLabelText('rotate-prompt')).toBeTruthy();
    expect(screen.queryByLabelText('recording-record-button')).toBeNull();
    // Drive the captured device-orientation listener with a landscape value.
    const listener = deviceOrientationListeners[0];
    expect(listener).toBeTruthy();
    await act(async () => {
      listener!('LANDSCAPE-LEFT');
    });
    expect(screen.queryByLabelText('rotate-prompt')).toBeNull();
    expect(screen.getByLabelText('recording-record-button')).toBeTruthy();
  });

  it('device already in landscape on mount → the fire-once getDeviceOrientation read lands the surface directly in ready (no rotate-prompt flash)', async () => {
    mockGetDeviceOrientation.mockImplementation((cb: (o: string) => void) => cb('LANDSCAPE-RIGHT'));
    await act(async () => {
      render(<RecordingScreen />);
    });
    expect(screen.queryByLabelText('rotate-prompt')).toBeNull();
    expect(screen.getByLabelText('recording-record-button')).toBeTruthy();
  });

  it('a PORTRAIT report while in rotate-prompt does NOT advance the surface', async () => {
    await act(async () => {
      render(<RecordingScreen />);
    });
    expect(screen.getByLabelText('rotate-prompt')).toBeTruthy();
    const listener = deviceOrientationListeners[0];
    expect(listener).toBeTruthy();
    await act(async () => {
      listener!('PORTRAIT');
    });
    expect(screen.getByLabelText('rotate-prompt')).toBeTruthy();
    expect(screen.queryByLabelText('recording-record-button')).toBeNull();
  });
});

describe('RecordingScreen — orientation + brightness lifecycle (REC-01 / REC-08)', () => {
  it('locks landscape on mount; unlocks + restores brightness on unmount', async () => {
    let unmount: (() => void) | undefined;
    await act(async () => {
      const r = render(<RecordingScreen __test_initialState={stateIn('ready')} />);
      unmount = r.unmount;
    });
    expect(mockOrientationLock).toHaveBeenCalled();
    await act(async () => {
      unmount?.();
    });
    expect(mockOrientationUnlock).toHaveBeenCalled();
    expect(mockBrightnessSet).toHaveBeenCalledWith(-1);
  });

  it('close pre-record (ready) → silent dismiss: unlock + brightness reset + reset root onto MainTabs (HAND-10; goBack() would throw — Recording is a root sibling)', async () => {
    await act(async () => {
      render(<RecordingScreen __test_initialState={stateIn('ready')} />);
    });
    fireEvent.click(screen.getByLabelText('recording-close'));
    expect(mockOrientationUnlock).toHaveBeenCalled();
    expect(mockBrightnessSet).toHaveBeenCalledWith(-1);
    expect(mockParentReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('close while active → X_PRESSED → stop-confirm modal', async () => {
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 5000 })}
        />,
      );
    });
    expect(screen.queryByLabelText('stop-confirm-modal')).toBeNull();
    fireEvent.click(screen.getByLabelText('recording-close'));
    expect(screen.getByLabelText('stop-confirm-modal')).toBeTruthy();
  });
});

describe('RecordingScreen — gate-pass → active transition (HAND-09)', () => {
  it('passed: Vibration.vibrate(120) + speakCue("Recording started") + set(0.05) + HumynCapture.start(<parseable opts>) → active', async () => {
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    await act(async () => {
      render(<RecordingScreen __test_initialState={confirmedGate('passed')} />);
    });
    await waitFor(() => expect(mockHcStart).toHaveBeenCalledTimes(1));
    expect(vibrateSpy).toHaveBeenCalledWith(120);
    expect(mockSpeakCue).toHaveBeenCalledWith('Recording started');
    expect(mockBrightnessSet).toHaveBeenCalledWith(0.05);
    const opts = mockHcStart.mock.calls[0]![0] as {
      startGate: { skipped: boolean; passed: boolean };
    };
    expect(() => CaptureSessionOptsSchema.parse(opts)).not.toThrow();
    // CAPTURE_STARTED → substate 'active' (the HH:MM:SS timer appears).
    await waitFor(() => expect(screen.getByLabelText('recording-timer')).toBeTruthy());
  });

  it('HumynCapture.start reject {code:thermal_throttling} → set(-1) + toast + back to ready', async () => {
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    mockHcStart.mockRejectedValue(
      Object.assign(new Error('thermal'), { code: 'thermal_throttling' }),
    );
    await act(async () => {
      render(<RecordingScreen __test_initialState={confirmedGate('passed')} />);
    });
    await waitFor(() => expect(mockHcStart).toHaveBeenCalled());
    await waitFor(() => expect(mockBrightnessSet).toHaveBeenCalledWith(-1));
    await waitFor(() => expect(screen.getByLabelText('recording-record-button')).toBeTruthy());
  });

  it('Skip: NO vibrate(120), NO "Recording started" cue, but set(0.05) STILL called + HumynCapture.start STILL called (HAND-07)', async () => {
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    await act(async () => {
      render(<RecordingScreen __test_initialState={confirmedGate('skipped')} />);
    });
    await waitFor(() => expect(mockHcStart).toHaveBeenCalledTimes(1));
    expect(vibrateSpy).not.toHaveBeenCalledWith(80);
    expect(mockSpeakCue).not.toHaveBeenCalledWith('Recording started');
    expect(mockBrightnessSet).toHaveBeenCalledWith(0.05);
    const opts = mockHcStart.mock.calls[0]![0] as {
      startGate: { skipped: boolean; passed: boolean };
    };
    expect(opts.startGate.skipped).toBe(true);
    expect(opts.startGate.passed).toBe(false);
  });
});

describe('RecordingScreen — §7h post-stop routing', () => {
  it('practice recording stopped → HumynCapture.stop() + nav toward PracticeComplete', async () => {
    _routeParams = { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true };
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 12_000 })}
        />,
      );
    });
    fireEvent.click(screen.getByLabelText('recording-stop'));
    await waitFor(() => expect(mockHcStop).toHaveBeenCalled());
    await waitFor(() => {
      const wentTo =
        mockParentReset.mock.calls.length > 0 ||
        mockParentNavigate.mock.calls.some((c) => c[0] === 'PracticeComplete') ||
        mockNavigate.mock.calls.some((c) => c[0] === 'PracticeComplete');
      expect(wentTo).toBe(true);
    });
  });

  it('real recording ≥60s stopped → uploadToastBus carries the contribution toast (5s) + nav toward MainTabs', async () => {
    // Wave-1.5 Item 5 — the contribution toast no longer renders in
    // RecordingScreen's local `<Toast>` host (it would die when
    // `navigateToHome` unmounts the screen). RecordingScreen now calls
    // `setPendingUploadToast(text, 5_000)` BEFORE `navigateToHome`;
    // HomeSkeletonScreen drains it on mount and fires the global ToastHost
    // (App.tsx:78). The assertion is the bus carries the right payload + the
    // ≥60s nav lands on MainTabs.
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 75_000 })}
        />,
      );
    });
    fireEvent.click(screen.getByLabelText('recording-stop'));
    await waitFor(() => expect(mockHcStop).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockParentNavigate.mock.calls.some((c) => c[0] === 'MainTabs')).toBe(true),
    );
    // The bus holds the deferred contribution toast; HomeSkeletonScreen would
    // drain it on mount. Asserted via the same drain hatch a real Home mount uses.
    const pending = drainPendingUploadToast();
    expect(pending).not.toBeNull();
    expect(pending!.text).toMatch(/added to your contribution\.$/);
    expect(pending!.durationMs).toBe(5_000);
  });

  it('real recording <60s stopped → showToast("Recording too short — discarded.") + RESET_FOR_FRESH (back to the landscape gate)', async () => {
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 30_000 })}
        />,
      );
    });
    fireEvent.click(screen.getByLabelText('recording-stop'));
    await waitFor(() => expect(screen.getByText('Recording too short — discarded.')).toBeTruthy());
    // RESET_FOR_FRESH now lands on 'rotate-prompt' (not 'ready') so a 2nd take
    // re-runs the landscape gate — debug session handgate-never-passes.
    await waitFor(() => expect(screen.getByLabelText('rotate-prompt')).toBeTruthy());
  });

  // --- D-05 — device-distress mid-record stop → Home, not the on-screen reset --

  it('real recording <60s stopped by battery_critical → Home (MainTabs), NOT RESET_FOR_FRESH', async () => {
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 20_000 })}
        />,
      );
    });
    await act(async () => {
      lifecycleCallbacksRef.current?.onStop('battery_critical');
    });
    await waitFor(() =>
      expect(mockParentNavigate.mock.calls.some((c) => c[0] === 'MainTabs')).toBe(true),
    );
    expect(screen.getByText('Recording stopped — your phone needs attention.')).toBeTruthy();
    // It did NOT fall back to the on-screen rotate-prompt reset.
    expect(screen.queryByLabelText('rotate-prompt')).toBeNull();
  });

  it('real recording <60s stopped by thermal abort → Home (MainTabs), NOT RESET_FOR_FRESH', async () => {
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 25_000 })}
        />,
      );
    });
    await act(async () => {
      lifecycleCallbacksRef.current?.onStop('thermal');
    });
    await waitFor(() =>
      expect(mockParentNavigate.mock.calls.some((c) => c[0] === 'MainTabs')).toBe(true),
    );
    expect(screen.queryByLabelText('rotate-prompt')).toBeNull();
  });

  it('a NORMAL sub-60s manual discard still does RESET_FOR_FRESH (stays on screen — D-05 leaves it)', async () => {
    _routeParams = {
      taskId: 'cooking_chop',
      taskName: 'Chop vegetables',
      taskCategory: 'cooking',
      taskSetting: 'indoor',
      isPractice: false,
    };
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 20_000 })}
        />,
      );
    });
    await act(async () => {
      lifecycleCallbacksRef.current?.onStop('manual');
    });
    await waitFor(() => expect(screen.getByText('Recording too short — discarded.')).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText('rotate-prompt')).toBeTruthy());
    expect(mockParentNavigate.mock.calls.some((c) => c[0] === 'MainTabs')).toBe(false);
  });

  it('practice recording stopped by battery_critical → PracticeComplete (D-05 — simplest sane destination mid-onboarding)', async () => {
    _routeParams = { taskId: '__practice__', taskName: 'Practice — 60 sec', isPractice: true };
    await act(async () => {
      render(
        <RecordingScreen
          __test_initialState={stateIn('active', { startedAt: 0, durationMs: 10_000 })}
        />,
      );
    });
    await act(async () => {
      lifecycleCallbacksRef.current?.onStop('battery_critical');
    });
    await waitFor(() => {
      const wentTo =
        mockParentReset.mock.calls.length > 0 ||
        mockParentNavigate.mock.calls.some((c) => c[0] === 'PracticeComplete') ||
        mockNavigate.mock.calls.some((c) => c[0] === 'PracticeComplete');
      expect(wentTo).toBe(true);
    });
  });
});

describe('RecordingScreen — start guards (REC-16)', () => {
  it('checkStartGuards blocked → showToast(toast) + back to ready', async () => {
    mockCheckStartGuards.mockResolvedValue({
      blocked: true,
      toast: 'Not enough storage to record.',
    });
    await act(async () => {
      render(<RecordingScreen __test_initialState={stateIn('pre-flight')} />);
    });
    await waitFor(() => expect(screen.getByText('Not enough storage to record.')).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText('recording-record-button')).toBeTruthy());
  });

  it('checkStartGuards OK → PRE_FLIGHT_OK → gate substate', async () => {
    mockCheckStartGuards.mockResolvedValue({ blocked: false });
    await act(async () => {
      render(<RecordingScreen __test_initialState={stateIn('pre-flight')} />);
    });
    await waitFor(() => expect(screen.getByLabelText('gate-ring')).toBeTruthy());
  });
});
