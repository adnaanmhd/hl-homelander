// useRecordingLifecycle — the idea-brief.md §10 policy table + the practice
// 60s hard cap + the pre-record start guards.
//
// Strategy: per-file mocks for react-native (AppState/Vibration),
// react-native-orientation-locker (device listener), react-native-fs
// (getFSInfo), and the four HumynCapture/HumynPhoneState/HumynBattery/HumynBeep
// JS bindings — each `addListener`-style helper captures the listener into a
// hoisted holder so the test can fire events synthetically. Fake timers for the
// audio-focus 7s grace timer + the practice 60s cap. The hook is exercised via
// @testing-library/react's `renderHook`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

type Holder = {
  appStateListener?: (s: string) => void;
  deviceOrientationListener?: (o: string) => void;
  audioFocusListener?: (e: { focus: string }) => void;
  batteryListener?: (e: { level: number; isCharging: boolean }) => void;
  errorListener?: (e: { code: string }) => void;
  thermalListener?: (e: unknown) => void;
};

const h = vi.hoisted(() => ({
  // captured listeners
  holder: {} as Holder,
  // spies
  appStateRemove: vi.fn(),
  removeDeviceOrientationListener: vi.fn(),
  audioFocusRemove: vi.fn(),
  batteryRemove: vi.fn(),
  errorRemove: vi.fn(),
  thermalRemove: vi.fn(),
  vibrate: vi.fn(),
  playTone: vi.fn().mockResolvedValue(undefined),
  phoneStart: vi.fn().mockResolvedValue(undefined),
  phoneStop: vi.fn().mockResolvedValue(undefined),
  batteryStart: vi.fn().mockResolvedValue(undefined),
  batteryStop: vi.fn().mockResolvedValue(undefined),
  getFSInfo: vi.fn().mockResolvedValue({ totalSpace: 64e9, freeSpace: 32e9 }),
  logEvent: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active' as const,
    addEventListener: (_event: string, listener: (s: string) => void) => {
      h.holder.appStateListener = listener;
      return { remove: h.appStateRemove };
    },
  },
  Vibration: { vibrate: h.vibrate, cancel: vi.fn() },
}));

vi.mock('react-native-orientation-locker', () => ({
  default: {
    addDeviceOrientationListener: (listener: (o: string) => void) => {
      h.holder.deviceOrientationListener = listener;
    },
    removeDeviceOrientationListener: h.removeDeviceOrientationListener,
  },
  OrientationType: {
    PORTRAIT: 'PORTRAIT',
    'LANDSCAPE-LEFT': 'LANDSCAPE-LEFT',
    'LANDSCAPE-RIGHT': 'LANDSCAPE-RIGHT',
    'PORTRAIT-UPSIDEDOWN': 'PORTRAIT-UPSIDEDOWN',
    UNKNOWN: 'UNKNOWN',
  },
}));

vi.mock('react-native-fs', () => ({ default: { getFSInfo: h.getFSInfo } }));

vi.mock('../../../src/native/HumynCapture', () => ({
  onError: (listener: (e: { code: string }) => void) => {
    h.holder.errorListener = listener;
    return { remove: h.errorRemove };
  },
  onThermalAbort: (listener: (e: unknown) => void) => {
    h.holder.thermalListener = listener;
    return { remove: h.thermalRemove };
  },
}));

vi.mock('../../../src/native/HumynPhoneState', () => ({
  start: h.phoneStart,
  stop: h.phoneStop,
  onAudioFocusChanged: (listener: (e: { focus: string }) => void) => {
    h.holder.audioFocusListener = listener;
    return { remove: h.audioFocusRemove };
  },
}));

vi.mock('../../../src/native/HumynBattery', () => ({
  start: h.batteryStart,
  stop: h.batteryStop,
  onBatteryChanged: (listener: (e: { level: number; isCharging: boolean }) => void) => {
    h.holder.batteryListener = listener;
    return { remove: h.batteryRemove };
  },
}));

vi.mock('../../../src/native/HumynBeep', () => ({ playTone: h.playTone }));

vi.mock('../../../src/util/analytics', () => ({ logEvent: h.logEvent }));

import {
  useRecordingLifecycle,
  type LifecycleCallbacks,
  type UseRecordingLifecycleArgs,
} from '../../../src/screens/recording/useRecordingLifecycle';

function makeCallbacks(): {
  callbacks: LifecycleCallbacks;
  onStop: ReturnType<typeof vi.fn>;
  showToast: ReturnType<typeof vi.fn>;
  voiceCue: ReturnType<typeof vi.fn>;
  setAlert: ReturnType<typeof vi.fn>;
} {
  const onStop = vi.fn();
  const showToast = vi.fn();
  const voiceCue = vi.fn();
  const setAlert = vi.fn();
  return {
    callbacks: { onStop, showToast, voiceCue, setAlert },
    onStop,
    showToast,
    voiceCue,
    setAlert,
  };
}

function setup(initial: Partial<UseRecordingLifecycleArgs> & { callbacks: LifecycleCallbacks }) {
  const args: UseRecordingLifecycleArgs = {
    substate: 'active',
    isPractice: false,
    durationMs: 0,
    ...initial,
  };
  return renderHook((p: UseRecordingLifecycleArgs) => useRecordingLifecycle(p), {
    initialProps: args,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.holder = {};
  h.getFSInfo.mockResolvedValue({ totalSpace: 64e9, freeSpace: 32e9 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRecordingLifecycle — §10 policy table', () => {
  it('AppState change to "background" while active → onStop("background")', () => {
    const { onStop } = makeCallbacks();
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.appStateListener?.('background'));
    expect(c.onStop).toHaveBeenCalledWith('background');
    void onStop;
  });

  it('AppState "inactive" then "background" while active → onStop("background")', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.appStateListener?.('inactive'));
    act(() => h.holder.appStateListener?.('background'));
    expect(c.onStop).toHaveBeenCalledWith('background');
  });

  it('audio-focus sustained "loss" while active → onStop("phone_call")', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.audioFocusListener?.({ focus: 'loss' }));
    expect(c.onStop).toHaveBeenCalledWith('phone_call');
  });

  it('audio-focus "transient_loss" then "gain" within 7s → NO onStop (call declined, REC-13)', () => {
    vi.useFakeTimers();
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.audioFocusListener?.({ focus: 'transient_loss' }));
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    act(() => h.holder.audioFocusListener?.({ focus: 'gain' }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(c.onStop).not.toHaveBeenCalled();
  });

  it('audio-focus "transient_loss" + advance 7s (no gain) → onStop("phone_call")', () => {
    vi.useFakeTimers();
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.audioFocusListener?.({ focus: 'transient_loss' }));
    expect(c.onStop).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    expect(c.onStop).toHaveBeenCalledWith('phone_call');
  });

  it('orientation device→PORTRAIT while active → onStop("orientation") + showToast', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.deviceOrientationListener?.('PORTRAIT'));
    expect(c.onStop).toHaveBeenCalledWith('orientation');
    expect(c.showToast).toHaveBeenCalledWith('Recording stopped — keep the phone in landscape.');
  });

  it('battery crossing >0.15 → ≤0.15 while active → alert + toast + beep + vibrate + voiceCue, NO onStop', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    // Seed a prior reading above the threshold so the crossing is detected.
    act(() => h.holder.batteryListener?.({ level: 0.5, isCharging: false }));
    act(() => h.holder.batteryListener?.({ level: 0.14, isCharging: false }));
    expect(c.setAlert).toHaveBeenCalledWith('battery', true);
    expect(c.showToast).toHaveBeenCalledWith('Battery low. Consider charging soon.');
    expect(h.playTone).toHaveBeenCalledWith('battery_alert');
    expect(h.vibrate).toHaveBeenCalledWith([0, 100, 50, 100]);
    expect(c.voiceCue).toHaveBeenCalledWith('Battery low. Consider charging soon.');
    expect(c.onStop).not.toHaveBeenCalled();
  });

  it('battery crossing to ≤0.05 while active → onStop("battery_critical")', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.batteryListener?.({ level: 0.5, isCharging: false }));
    act(() => h.holder.batteryListener?.({ level: 0.04, isCharging: false }));
    expect(c.onStop).toHaveBeenCalledWith('battery_critical');
  });

  it('HumynCapture.onError storage_full while active → onStop("storage_full") + showToast', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.errorListener?.({ code: 'storage_full' }));
    expect(c.onStop).toHaveBeenCalledWith('storage_full');
    expect(c.showToast).toHaveBeenCalledWith('Recording stopped — not enough storage.');
  });

  it('HumynCapture.onError permission_revoked while active → onStop("permission_revoked")', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.errorListener?.({ code: 'permission_revoked' }));
    expect(c.onStop).toHaveBeenCalledWith('permission_revoked');
  });

  it('HumynCapture.onThermalAbort → voiceCue + setAlert("thermal",true) + beep + vibrate(800), NO onStop', () => {
    const c = makeCallbacks();
    setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.thermalListener?.({}));
    expect(c.voiceCue).toHaveBeenCalledWith('Phone too hot, stopping recording');
    expect(c.setAlert).toHaveBeenCalledWith('thermal', true);
    expect(h.playTone).toHaveBeenCalledWith('thermal_alert');
    expect(h.vibrate).toHaveBeenCalledWith(800);
    expect(c.onStop).not.toHaveBeenCalled();
  });

  it('isPractice + active + advance 60s → onStop("practice_hard_cap")', () => {
    vi.useFakeTimers();
    const c = makeCallbacks();
    setup({ substate: 'active', isPractice: true, durationMs: 0, callbacks: c.callbacks });
    expect(c.onStop).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(c.onStop).toHaveBeenCalledWith('practice_hard_cap');
  });

  it('logout flag flips true while active → onStop("logout")', () => {
    const c = makeCallbacks();
    const { rerender } = setup({
      substate: 'active',
      loggedOut: false,
      callbacks: c.callbacks,
    });
    expect(c.onStop).not.toHaveBeenCalled();
    rerender({
      substate: 'active',
      isPractice: false,
      durationMs: 0,
      loggedOut: true,
      callbacks: c.callbacks,
    });
    expect(c.onStop).toHaveBeenCalledWith('logout');
  });

  it('checkStartGuards() → blocked when freeSpace < 5GB (REC-16)', async () => {
    h.getFSInfo.mockResolvedValueOnce({ totalSpace: 64e9, freeSpace: 4e9 });
    const c = makeCallbacks();
    const { result } = setup({ substate: 'ready', callbacks: c.callbacks });
    const guard = await result.current.checkStartGuards();
    expect(guard).toEqual({ blocked: true, toast: 'Not enough storage to record.' });
  });

  it('checkStartGuards() → blocked when last battery level < 5% and not charging', async () => {
    const c = makeCallbacks();
    const { result } = setup({ substate: 'active', callbacks: c.callbacks });
    act(() => h.holder.batteryListener?.({ level: 0.03, isCharging: false }));
    const guard = await result.current.checkStartGuards();
    expect(guard).toEqual({
      blocked: true,
      toast: 'Battery too low to start a recording. Charge to at least 15%.',
    });
  });

  it('checkStartGuards() → not blocked when storage healthy and no low-battery reading', async () => {
    const c = makeCallbacks();
    const { result } = setup({ substate: 'ready', callbacks: c.callbacks });
    const guard = await result.current.checkStartGuards();
    expect(guard).toEqual({ blocked: false });
  });

  it('unmount → every subscription is .remove()d / .stop()d', () => {
    const c = makeCallbacks();
    const { unmount } = setup({ substate: 'active', callbacks: c.callbacks });
    expect(h.appStateRemove).not.toHaveBeenCalled();
    unmount();
    expect(h.appStateRemove).toHaveBeenCalled();
    expect(h.removeDeviceOrientationListener).toHaveBeenCalled();
    expect(h.audioFocusRemove).toHaveBeenCalled();
    expect(h.batteryRemove).toHaveBeenCalled();
    expect(h.errorRemove).toHaveBeenCalled();
    expect(h.thermalRemove).toHaveBeenCalled();
    expect(h.phoneStop).toHaveBeenCalled();
    expect(h.batteryStop).toHaveBeenCalled();
  });

  it('does not subscribe when substate is a pre-record one (ready) — no AppState listener captured', () => {
    const c = makeCallbacks();
    setup({ substate: 'ready', callbacks: c.callbacks });
    expect(h.holder.appStateListener).toBeUndefined();
  });
});
