// recState reducer policy table — one assertion per transition bullet from
// engineering-handoff.md §4.3 (mirrors the initialRoute.test.ts shape: a
// baseState(overrides) helper + one it() per branch).
//
// Covers: initialRecState defaults (cap + gate config + gateConfig override),
// every substate transition, the no-op-for-wrong-substate cases, the
// GATE_HIT→target→confirmed boundary, the GATE_MISS→0 reset, SKIP/BYPASS,
// the double-stop guard, the alert overlays, RESET_FOR_FRESH, and
// PRACTICE_HARD_CAP. PURE-reducer guarantee: timestamps come from action
// payloads, never from inside the reducer.

import { describe, it, expect } from 'vitest';
import {
  initialRecState,
  recReducer,
  type RecState,
  type RecAction,
} from '../../../src/screens/recording/recState';

function baseState(overrides: Partial<RecState> = {}): RecState {
  const s = initialRecState({ taskId: 't1', taskName: 'Task One', isPractice: false });
  return { ...s, ...overrides, gate: { ...s.gate, ...(overrides.gate ?? {}) } };
}

describe('initialRecState', () => {
  it('starts at substate rotate-prompt with the supplied task params', () => {
    const s = initialRecState({
      taskId: '__practice__',
      taskName: 'Practice — 60 sec',
      isPractice: true,
    });
    expect(s.substate).toBe('rotate-prompt');
    expect(s.taskId).toBe('__practice__');
    expect(s.taskName).toBe('Practice — 60 sec');
    expect(s.isPractice).toBe(true);
    expect(s.startedAt).toBeNull();
    expect(s.durationMs).toBe(0);
    expect(s.ended).toBe(false);
    expect(s.alerts).toEqual({});
  });

  it('cap = 60_000 for a practice task', () => {
    expect(initialRecState({ taskId: 'p', taskName: 'p', isPractice: true }).cap).toBe(60_000);
  });

  it('cap = 1_200_000 for a real task', () => {
    expect(initialRecState({ taskId: 'r', taskName: 'r', isPractice: false }).cap).toBe(1_200_000);
  });

  it('default gate config — targetHits 5 / cadenceMs 400, phase idle', () => {
    const g = initialRecState({ taskId: 'r', taskName: 'r', isPractice: false }).gate;
    expect(g.phase).toBe('idle');
    expect(g.targetHits).toBe(5);
    expect(g.cadenceMs).toBe(400);
    expect(g.consecutiveHits).toBe(0);
    expect(g.skipped).toBe(false);
    expect(g.bypassed).toBe(false);
    expect(g.startedAt).toBeNull();
    expect(g.confirmedAt).toBeNull();
  });

  it('gateConfig override — RemoteConfig iOS values 3 / 600', () => {
    const g = initialRecState(
      { taskId: 'r', taskName: 'r', isPractice: false },
      { targetHits: 3, cadenceMs: 600 },
    ).gate;
    expect(g.targetHits).toBe(3);
    expect(g.cadenceMs).toBe(600);
  });
});

describe('recReducer — substate transitions', () => {
  it('LANDSCAPE_DETECTED on rotate-prompt → ready', () => {
    expect(
      recReducer(baseState({ substate: 'rotate-prompt' }), { type: 'LANDSCAPE_DETECTED' }).substate,
    ).toBe('ready');
  });

  it('LANDSCAPE_DETECTED on ready → no-op', () => {
    expect(
      recReducer(baseState({ substate: 'ready' }), { type: 'LANDSCAPE_DETECTED' }).substate,
    ).toBe('ready');
  });

  it('SET_GATE_CONFIG on ready → gate.targetHits / gate.cadenceMs updated, rest of gate untouched', () => {
    const s = baseState({ substate: 'ready' });
    const next = recReducer(s, { type: 'SET_GATE_CONFIG', targetHits: 7, cadenceMs: 500 });
    expect(next.gate.targetHits).toBe(7);
    expect(next.gate.cadenceMs).toBe(500);
    expect(next.gate.phase).toBe('idle');
    expect(next.gate.consecutiveHits).toBe(0);
    expect(next.substate).toBe('ready');
  });

  it('SET_GATE_CONFIG on rotate-prompt / pre-flight → also updated', () => {
    expect(
      recReducer(baseState({ substate: 'rotate-prompt' }), {
        type: 'SET_GATE_CONFIG',
        targetHits: 3,
        cadenceMs: 600,
      }).gate.targetHits,
    ).toBe(3);
    expect(
      recReducer(baseState({ substate: 'pre-flight' }), {
        type: 'SET_GATE_CONFIG',
        targetHits: 3,
        cadenceMs: 600,
      }).gate.cadenceMs,
    ).toBe(600);
  });

  it('SET_GATE_CONFIG on gate / active / stop-confirm → no-op (cannot perturb an in-progress gate)', () => {
    const inGate = baseState({ substate: 'gate', gate: { ...baseState().gate, phase: 'waiting' } });
    const afterGate = recReducer(inGate, {
      type: 'SET_GATE_CONFIG',
      targetHits: 9,
      cadenceMs: 900,
    });
    expect(afterGate).toBe(inGate);
    expect(
      recReducer(baseState({ substate: 'active', startedAt: 0 }), {
        type: 'SET_GATE_CONFIG',
        targetHits: 9,
        cadenceMs: 900,
      }).gate.targetHits,
    ).toBe(5);
    expect(
      recReducer(baseState({ substate: 'stop-confirm', startedAt: 0 }), {
        type: 'SET_GATE_CONFIG',
        targetHits: 9,
        cadenceMs: 900,
      }).gate.cadenceMs,
    ).toBe(400);
  });

  it('SET_GATE_CONFIG clamps a garbage RemoteConfig value (targetHits 0 → 1, cadenceMs 10 → 100)', () => {
    const next = recReducer(baseState({ substate: 'ready' }), {
      type: 'SET_GATE_CONFIG',
      targetHits: 0,
      cadenceMs: 10,
    });
    expect(next.gate.targetHits).toBe(1);
    expect(next.gate.cadenceMs).toBe(100);
  });

  it('START_PRESSED on ready → pre-flight', () => {
    expect(recReducer(baseState({ substate: 'ready' }), { type: 'START_PRESSED' }).substate).toBe(
      'pre-flight',
    );
  });

  it('START_PRESSED on rotate-prompt → no-op', () => {
    expect(
      recReducer(baseState({ substate: 'rotate-prompt' }), { type: 'START_PRESSED' }).substate,
    ).toBe('rotate-prompt');
  });

  it('PRE_FLIGHT_OK on pre-flight → gate with phase loading + startedAt set', () => {
    const next = recReducer(baseState({ substate: 'pre-flight' }), {
      type: 'PRE_FLIGHT_OK',
      now: 1000,
    });
    expect(next.substate).toBe('gate');
    expect(next.gate.phase).toBe('loading');
    expect(next.gate.startedAt).toBe(1000);
  });

  it('PRE_FLIGHT_FAILED on pre-flight → ready (thermal/storage/battery start-guard)', () => {
    expect(
      recReducer(baseState({ substate: 'pre-flight' }), { type: 'PRE_FLIGHT_FAILED' }).substate,
    ).toBe('ready');
  });

  it('CAMERA_READY on gate.loading → gate.waiting (accumulator starts at first frame, HAND-06)', () => {
    const s = baseState({ substate: 'gate', gate: { ...baseState().gate, phase: 'loading' } });
    expect(recReducer(s, { type: 'CAMERA_READY' }).gate.phase).toBe('waiting');
  });

  it('CAMERA_READY on gate.waiting → no-op', () => {
    const s = baseState({ substate: 'gate', gate: { ...baseState().gate, phase: 'waiting' } });
    expect(recReducer(s, { type: 'CAMERA_READY' }).gate.phase).toBe('waiting');
  });

  it('GATE_HIT on gate.waiting → consecutiveHits+1 (below target stays waiting)', () => {
    const s = baseState({
      substate: 'gate',
      gate: { ...baseState().gate, phase: 'waiting', consecutiveHits: 0 },
    });
    const next = recReducer(s, { type: 'GATE_HIT', now: 5 });
    expect(next.gate.consecutiveHits).toBe(1);
    expect(next.gate.phase).toBe('waiting');
  });

  it('GATE_HIT reaching targetHits → phase confirmed, confirmedAt set, skipped/bypassed false', () => {
    const s = baseState({
      substate: 'gate',
      gate: { ...baseState().gate, phase: 'waiting', consecutiveHits: 4, targetHits: 5 },
    });
    const next = recReducer(s, { type: 'GATE_HIT', now: 42 });
    expect(next.gate.consecutiveHits).toBe(5);
    expect(next.gate.phase).toBe('confirmed');
    expect(next.gate.confirmedAt).toBe(42);
    expect(next.gate.skipped).toBe(false);
    expect(next.gate.bypassed).toBe(false);
  });

  it('GATE_HIT while gate.loading → no-op (HAND-06)', () => {
    const s = baseState({
      substate: 'gate',
      gate: { ...baseState().gate, phase: 'loading', consecutiveHits: 0 },
    });
    expect(recReducer(s, { type: 'GATE_HIT', now: 1 }).gate.consecutiveHits).toBe(0);
  });

  it('GATE_MISS on gate.waiting → consecutiveHits reset to 0 (HAND-04 instant reset)', () => {
    const s = baseState({
      substate: 'gate',
      gate: { ...baseState().gate, phase: 'waiting', consecutiveHits: 3 },
    });
    expect(recReducer(s, { type: 'GATE_MISS' }).gate.consecutiveHits).toBe(0);
  });

  it('GATE_MISS while gate.loading → no-op', () => {
    const s = baseState({
      substate: 'gate',
      gate: { ...baseState().gate, phase: 'loading', consecutiveHits: 0 },
    });
    expect(recReducer(s, { type: 'GATE_MISS' }).gate.consecutiveHits).toBe(0);
  });

  it('GATE_SKIP on gate → phase confirmed, skipped=true', () => {
    const s = baseState({ substate: 'gate', gate: { ...baseState().gate, phase: 'waiting' } });
    const next = recReducer(s, { type: 'GATE_SKIP', now: 7 });
    expect(next.gate.phase).toBe('confirmed');
    expect(next.gate.skipped).toBe(true);
    expect(next.gate.bypassed).toBe(false);
    expect(next.gate.confirmedAt).toBe(7);
  });

  it('GATE_BYPASS on gate → phase confirmed, bypassed=true (detector unavailable)', () => {
    const s = baseState({ substate: 'gate', gate: { ...baseState().gate, phase: 'loading' } });
    const next = recReducer(s, { type: 'GATE_BYPASS', now: 9 });
    expect(next.gate.phase).toBe('confirmed');
    expect(next.gate.bypassed).toBe(true);
    expect(next.gate.skipped).toBe(false);
    expect(next.gate.confirmedAt).toBe(9);
  });

  it('GATE_SKIP on a non-gate substate → no-op', () => {
    expect(
      recReducer(baseState({ substate: 'ready' }), { type: 'GATE_SKIP', now: 1 }).substate,
    ).toBe('ready');
  });

  it('CAPTURE_STARTED on gate.confirmed → active, startedAt set, durationMs 0', () => {
    const s = baseState({ substate: 'gate', gate: { ...baseState().gate, phase: 'confirmed' } });
    const next = recReducer(s, { type: 'CAPTURE_STARTED', now: 1234 });
    expect(next.substate).toBe('active');
    expect(next.startedAt).toBe(1234);
    expect(next.durationMs).toBe(0);
  });

  it('CAPTURE_STARTED on gate.waiting → no-op', () => {
    const s = baseState({ substate: 'gate', gate: { ...baseState().gate, phase: 'waiting' } });
    expect(recReducer(s, { type: 'CAPTURE_STARTED', now: 1 }).substate).toBe('gate');
  });

  it('CAPTURE_START_FAILED on gate.confirmed → ready with gate reset to idle', () => {
    const s = baseState({
      substate: 'gate',
      gate: { ...baseState().gate, phase: 'confirmed', consecutiveHits: 5, skipped: true },
    });
    const next = recReducer(s, { type: 'CAPTURE_START_FAILED' });
    expect(next.substate).toBe('ready');
    expect(next.gate.phase).toBe('idle');
    expect(next.gate.consecutiveHits).toBe(0);
    expect(next.gate.skipped).toBe(false);
  });

  it('TICK on active → durationMs = action.durationMs', () => {
    const s = baseState({ substate: 'active', startedAt: 0, durationMs: 0 });
    expect(recReducer(s, { type: 'TICK', durationMs: 12_345 }).durationMs).toBe(12_345);
  });

  it('TICK on a non-active substate → no-op', () => {
    expect(
      recReducer(baseState({ substate: 'ready' }), { type: 'TICK', durationMs: 999 }).durationMs,
    ).toBe(0);
  });

  it('PRACTICE_HARD_CAP on active → stopped, ended=true (JS-owned 60s cap)', () => {
    const next = recReducer(baseState({ substate: 'active', startedAt: 0, durationMs: 60_000 }), {
      type: 'PRACTICE_HARD_CAP',
    });
    expect(next.substate).toBe('stopped');
    expect(next.ended).toBe(true);
  });

  it('PRACTICE_HARD_CAP on a non-active substate → no-op', () => {
    expect(
      recReducer(baseState({ substate: 'ready' }), { type: 'PRACTICE_HARD_CAP' }).substate,
    ).toBe('ready');
  });

  it('X_PRESSED on active → stop-confirm', () => {
    expect(
      recReducer(baseState({ substate: 'active', startedAt: 0 }), { type: 'X_PRESSED' }).substate,
    ).toBe('stop-confirm');
  });

  it('X_PRESSED on gate / ready / rotate-prompt → no-op at the reducer level (HAND-10)', () => {
    expect(recReducer(baseState({ substate: 'gate' }), { type: 'X_PRESSED' }).substate).toBe(
      'gate',
    );
    expect(recReducer(baseState({ substate: 'ready' }), { type: 'X_PRESSED' }).substate).toBe(
      'ready',
    );
    expect(
      recReducer(baseState({ substate: 'rotate-prompt' }), { type: 'X_PRESSED' }).substate,
    ).toBe('rotate-prompt');
  });

  it('STOP_CONFIRM_CANCEL on stop-confirm → active', () => {
    expect(
      recReducer(baseState({ substate: 'stop-confirm', startedAt: 0 }), {
        type: 'STOP_CONFIRM_CANCEL',
      }).substate,
    ).toBe('active');
  });

  it('STOP_CONFIRM_STOP on stop-confirm → stopped, ended=true', () => {
    const next = recReducer(baseState({ substate: 'stop-confirm', startedAt: 0 }), {
      type: 'STOP_CONFIRM_STOP',
    });
    expect(next.substate).toBe('stopped');
    expect(next.ended).toBe(true);
  });

  it('STOP on active → stopped, ended=true', () => {
    const next = recReducer(baseState({ substate: 'active', startedAt: 0 }), { type: 'STOP' });
    expect(next.substate).toBe('stopped');
    expect(next.ended).toBe(true);
  });

  it('STOP on stop-confirm → stopped, ended=true', () => {
    const next = recReducer(baseState({ substate: 'stop-confirm', startedAt: 0 }), {
      type: 'STOP',
    });
    expect(next.substate).toBe('stopped');
    expect(next.ended).toBe(true);
  });

  it('STOP when already ended → no-op (the ended-guard short-circuits before the substate check)', () => {
    // Construct a state that is `ended` but somehow still marked active (a
    // belt-and-braces guard against a re-entrant STOP).
    const endedButActive: RecState = {
      ...baseState({ substate: 'active', startedAt: 0 }),
      ended: true,
    };
    const again = recReducer(endedButActive, { type: 'STOP' });
    expect(again).toBe(endedButActive); // identity preserved — no churn
    expect(again.substate).toBe('active');
  });

  it('double STOP from active — second STOP is a no-op (returns the same stopped state object)', () => {
    const stopped = recReducer(baseState({ substate: 'active', startedAt: 0 }), { type: 'STOP' });
    const second = recReducer(stopped, { type: 'STOP' });
    expect(second).toBe(stopped);
  });

  it('RESET_FOR_FRESH on stopped → ready, gate idle, durationMs 0, ended false, alerts {} (REC-05)', () => {
    const s = baseState({
      substate: 'stopped',
      ended: true,
      durationMs: 90_000,
      alerts: { battery: true },
      startedAt: 5,
      gate: { ...baseState().gate, phase: 'confirmed', consecutiveHits: 5 },
    });
    const next = recReducer(s, { type: 'RESET_FOR_FRESH' });
    expect(next.substate).toBe('ready');
    expect(next.gate.phase).toBe('idle');
    expect(next.gate.consecutiveHits).toBe(0);
    expect(next.durationMs).toBe(0);
    expect(next.ended).toBe(false);
    expect(next.alerts).toEqual({});
    expect(next.startedAt).toBeNull();
  });

  it('RESET_FOR_FRESH on a non-stopped substate → no-op', () => {
    expect(
      recReducer(baseState({ substate: 'active', startedAt: 0 }), { type: 'RESET_FOR_FRESH' })
        .substate,
    ).toBe('active');
  });
});

describe('recReducer — overlay alerts (do not change substate)', () => {
  it('BATTERY_ALERT sets alerts.battery=true, substate unchanged', () => {
    const next = recReducer(baseState({ substate: 'active', startedAt: 0 }), {
      type: 'BATTERY_ALERT',
    });
    expect(next.alerts.battery).toBe(true);
    expect(next.substate).toBe('active');
  });

  it('THERMAL_ALERT sets alerts.thermal=true, substate unchanged', () => {
    const next = recReducer(baseState({ substate: 'active', startedAt: 0 }), {
      type: 'THERMAL_ALERT',
    });
    expect(next.alerts.thermal).toBe(true);
    expect(next.substate).toBe('active');
  });

  it('repeated BATTERY_ALERT is idempotent (same object back)', () => {
    const once = recReducer(baseState({ substate: 'active', startedAt: 0 }), {
      type: 'BATTERY_ALERT',
    });
    expect(recReducer(once, { type: 'BATTERY_ALERT' })).toBe(once);
  });
});

describe('recReducer — purity / unknown actions', () => {
  it('an unknown action type returns the same state object', () => {
    const s = baseState();
    expect(recReducer(s, { type: 'NOT_A_REAL_ACTION' } as unknown as RecAction)).toBe(s);
  });

  it('reducer does not mutate the input state on a real transition', () => {
    const s = baseState({ substate: 'rotate-prompt' });
    const snapshot = JSON.stringify(s);
    recReducer(s, { type: 'LANDSCAPE_DETECTED' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
