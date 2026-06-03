/**
 * Phase 7 plan 07-07 — unit suite for the live-cam-preview brightness state
 * machine (REC-LIVE-01..04 / D-05 / D-28 / D-29).
 *
 * Drives `createLivePreviewStateMachine` directly with `vi.useFakeTimers()`
 * + a stubbed `brightness.set`. Converts REC-LIVE-01..04 from "manual-only"
 * to "unit-tested + manual-verified" per 07-VALIDATION.md.
 *
 * Note: vitest's discovery pattern (vitest.config.ts) is
 * `__tests__/**`/*.test.ts`; the plan's nominal path
 * `apps/mobile/src/lib/__tests__/livePreviewState.test.ts` is not picked
 * up. Filed as a Rule 3 (blocking) deviation in the SUMMARY — the file
 * sits here under `__tests__/lib/` to match the project convention
 * established by `__tests__/lib/buildCaptureOpts.test.ts` /
 * `__tests__/lib/durationFormat.test.ts` / `__tests__/lib/ttsVoice.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createLivePreviewStateMachine,
  INITIAL_PREVIEW_MS,
  TAP_REVEAL_MS,
} from '../../src/lib/livePreviewState';

function makeRig() {
  vi.useFakeTimers();
  const set = vi.fn().mockResolvedValue(undefined);
  const setTimeoutSpy = vi.fn((fn: () => void, ms: number) => globalThis.setTimeout(fn, ms));
  const clearTimeoutSpy = vi.fn((h: unknown) =>
    globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
  );
  const machine = createLivePreviewStateMachine({
    brightness: { set },
    schedule: { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy },
  });
  return { machine, set, setTimeoutSpy, clearTimeoutSpy };
}

describe('createLivePreviewStateMachine (REC-LIVE-01..04 / D-05 / D-29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in initial-preview at brightness -1 (system level)', () => {
    const { machine, set } = makeRig();
    machine.start();
    expect(machine.getState()).toBe('initial-preview');
    expect(set).toHaveBeenLastCalledWith(-1);
  });

  it('after 15 s, transitions to dimmed and sets brightness 0.05', () => {
    const { machine, set } = makeRig();
    machine.start();
    vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
    expect(machine.getState()).toBe('dimmed');
    expect(set).toHaveBeenLastCalledWith(0.05);
  });

  it('tap in dimmed transitions to tap-revealed at system brightness (REC-LIVE-02)', () => {
    const { machine, set } = makeRig();
    machine.start();
    vi.advanceTimersByTime(INITIAL_PREVIEW_MS); // → dimmed
    machine.tap();
    expect(machine.getState()).toBe('tap-revealed');
    expect(set).toHaveBeenLastCalledWith(-1);
  });

  it('10-s timer in tap-revealed returns to dimmed', () => {
    const { machine, set } = makeRig();
    machine.start();
    vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
    machine.tap();
    vi.advanceTimersByTime(TAP_REVEAL_MS);
    expect(machine.getState()).toBe('dimmed');
    expect(set).toHaveBeenLastCalledWith(0.05);
  });

  it('subsequent taps in tap-revealed reset the timer (D-29 rolling, NOT accumulating)', () => {
    const { machine, clearTimeoutSpy } = makeRig();
    machine.start();
    vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
    machine.tap(); // enter tap-revealed
    const clearCallsBeforeSecondTap = clearTimeoutSpy.mock.calls.length;
    vi.advanceTimersByTime(5_000); // 5s in
    machine.tap(); // should cancel + restart, NOT add 10s
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(clearCallsBeforeSecondTap);
    vi.advanceTimersByTime(5_000); // 10s total from first tap; should STILL be tap-revealed
    expect(machine.getState()).toBe('tap-revealed');
    vi.advanceTimersByTime(5_000); // 10s after second tap
    expect(machine.getState()).toBe('dimmed');
  });

  it('tap in initial-preview is a no-op (Stop button owns that hit-region)', () => {
    const { machine } = makeRig();
    machine.start();
    machine.tap();
    expect(machine.getState()).toBe('initial-preview');
  });

  it('stop() cancels pending timers and does NOT call brightness.set (lifecycle restore owns it)', () => {
    const { machine, set, clearTimeoutSpy } = makeRig();
    machine.start();
    const callsBeforeStop = set.mock.calls.length;
    machine.stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(set.mock.calls.length).toBe(callsBeforeStop); // no new set() after stop
  });

  it('subscribers are notified on every transition', () => {
    const { machine } = makeRig();
    const states: string[] = [];
    const unsub = machine.subscribe((s) => states.push(s));
    machine.start();
    vi.advanceTimersByTime(INITIAL_PREVIEW_MS);
    machine.tap();
    expect(states).toEqual(['initial-preview', 'dimmed', 'tap-revealed']);
    unsub();
  });
});
