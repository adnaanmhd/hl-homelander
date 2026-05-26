// apps/mobile/src/lib/livePreviewState.ts
//
// Live-cam preview brightness state machine (Phase 7 plan 07-07).
//
// Implements REC-LIVE-01..04 / D-05 / D-28 / D-29:
//
//   - On entering 'initial-preview' (the moment captureStartedAt becomes
//     non-null after gate-pass / Skip), call brightness.set(-1) (restore
//     system level) and schedule a 15-s timer.
//   - On the 15-s timer firing, transition to 'dimmed' and call
//     brightness.set(0.05). The Lucide Eye corner glyph + the full-
//     surface Pressable for tap-to-reveal both render only in this state
//     (D-27 / D-28).
//   - In 'dimmed', a single tap transitions to 'tap-revealed' at system
//     brightness (REC-LIVE-02). A 10-s timer is scheduled.
//   - Subsequent taps in 'tap-revealed' cancel the existing 10-s timer
//     and schedule a fresh one (D-29 — rolling, NOT accumulating).
//   - On the 10-s timer firing, transition back to 'dimmed' at 0.05.
//   - stop() cancels any pending timer; the existing RecordingScreen
//     set(-1) restorers at unmount / stop / failed-start own the
//     terminal brightness restore (REC-LIVE-15 — no new native API).
//
// Pure module — no React, no native imports. The state transitions +
// timer management + brightness side-effects are all driven by injected
// collaborators (`brightness`, `schedule`). RecordingScreen wraps this
// in a thin `useLivePreviewStateMachine` hook; the JS unit tests drive
// the factory directly with `vi.useFakeTimers()` and a stubbed
// `brightness.set` — converts REC-LIVE-01..04 from "manual-only" to
// "unit-tested + manual-verified" per 07-VALIDATION.md.

export type LivePreviewState = 'initial-preview' | 'dimmed' | 'tap-revealed';

export const INITIAL_PREVIEW_MS = 15_000;
export const TAP_REVEAL_MS = 10_000;

/** Brightness wrapper — narrowed to the surface area the machine needs. */
export interface BrightnessApi {
  /**
   * Set the per-window brightness. `-1` restores system level; a value in
   * `[0, 1]` overrides the window's brightness. Mirrors `HumynScreenBrightness.set`
   * (apps/mobile/src/native/HumynScreenBrightness.ts).
   */
  set(level: number): Promise<void> | void;
}

/** Timer scheduler — abstracted so tests inject a fake-timer-aware version. */
export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface LivePreviewMachine {
  /** Current state — readable from a React subscriber. */
  getState(): LivePreviewState;
  /** Subscribe; returns an unsubscribe. */
  subscribe(listener: (s: LivePreviewState) => void): () => void;
  /**
   * Enter the 'initial-preview' state with brightness restored to system
   * level; schedules the 15-s fade-to-dim timer. Called the moment the
   * 'active' substate is entered (captureStartedAt becomes non-null).
   */
  start(): void;
  /**
   * Process a tap. In 'dimmed': transition to 'tap-revealed' + restore
   * brightness + schedule 10-s timer. In 'tap-revealed': cancel + reschedule
   * the 10-s timer (D-29 rolling). In 'initial-preview': no-op (the
   * RecordingScreen z-stack routes initial-preview taps to the Stop
   * button only — there's no Pressable overlay in that state).
   */
  tap(): void;
  /**
   * Cancel any pending timer and clear subscribers. Does NOT call
   * brightness.set — RecordingScreen owns the terminal restore (lines
   * 267 / 387 / 734 / 867).
   */
  stop(): void;
}

export function createLivePreviewStateMachine(deps: {
  brightness: BrightnessApi;
  schedule: Scheduler;
}): LivePreviewMachine {
  // Default starting state. `start()` re-asserts this + the side effects;
  // tests that check `getState()` before `start()` see the same value.
  let state: LivePreviewState = 'initial-preview';
  let pendingTimer: unknown = null;
  const listeners = new Set<(s: LivePreviewState) => void>();

  function emit(): void {
    for (const l of listeners) l(state);
  }

  function clearTimer(): void {
    if (pendingTimer != null) {
      deps.schedule.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function transition(next: LivePreviewState, level: number): void {
    state = next;
    // Best-effort — the brightness wrapper can throw (native module not
    // registered / failed bridge call); the visible state is the truth
    // and the next user action (or stop()) will resync the OS brightness
    // if needed.
    try {
      const result = deps.brightness.set(level);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* best-effort */
    }
    emit();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      clearTimer();
      transition('initial-preview', -1);
      pendingTimer = deps.schedule.setTimeout(() => {
        pendingTimer = null;
        transition('dimmed', 0.05);
      }, INITIAL_PREVIEW_MS);
    },
    tap() {
      if (state === 'dimmed') {
        clearTimer();
        transition('tap-revealed', -1);
        pendingTimer = deps.schedule.setTimeout(() => {
          pendingTimer = null;
          transition('dimmed', 0.05);
        }, TAP_REVEAL_MS);
      } else if (state === 'tap-revealed') {
        // D-29 rolling — cancel + restart, do NOT accumulate.
        clearTimer();
        pendingTimer = deps.schedule.setTimeout(() => {
          pendingTimer = null;
          transition('dimmed', 0.05);
        }, TAP_REVEAL_MS);
      }
      // No-op in 'initial-preview' — there is no Pressable overlay in that
      // state (the RecordingScreen z-stack only mounts the overlay in
      // 'dimmed'), so the machine never sees a tap from that state in
      // production. The unit suite still pins the no-op so a future regression
      // in the z-stack can't quietly fast-forward the state machine.
    },
    stop() {
      clearTimer();
      // Do NOT call brightness.set here — RecordingScreen's existing
      // restore calls (lines 267 / 387 / 734 / 867) own the lifecycle.
      // Subscribers are cleared so a unit test running `start()` then
      // `stop()` then `start()` does not double-fire on the second start.
      listeners.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// React hook wrapper
// ---------------------------------------------------------------------------
//
// Thin adapter exposed to RecordingScreen. The hook owns the machine
// instance + the brightness adapter that talks to `HumynScreenBrightness` +
// the global setTimeout/clearTimeout adapter. Tests instantiate
// `createLivePreviewStateMachine` directly (no React render context needed),
// so the hook itself is intentionally bare — its only job is wiring the
// machine to React state + tearing it down on unmount / captureStartedAt
// transition.
//
// The hook is exported FROM the same file (per plan 07-07 acceptance
// criterion `grep -c "useLivePreviewStateMachine\|createLivePreviewStateMachine"
// apps/mobile/src/lib/livePreviewState.ts >= 2`). Pure-machine tests still
// only import the factory + the constants.

import { useEffect, useRef, useState } from 'react';
import * as HumynScreenBrightness from '../native/HumynScreenBrightness';

export interface UseLivePreviewStateMachine {
  /** Current brightness state — drives the JSX z-stack render in RecordingScreen. */
  state: LivePreviewState;
  /** Pressable.onPress handler — RecordingScreen wires this on the dimmed-overlay Pressable. */
  tap: () => void;
}

/**
 * Mounts the brightness state machine for the lifetime of an 'active'
 * recording. Pass `captureStartedAt` (a number when the active state has
 * been entered; `null` before). Re-instantiates on every transition from
 * `null` → number; tears down on number → null (e.g. stop, navigate away).
 */
export function useLivePreviewStateMachine(
  captureStartedAt: number | null,
): UseLivePreviewStateMachine {
  const machineRef = useRef<LivePreviewMachine | null>(null);
  const [state, setState] = useState<LivePreviewState>('initial-preview');

  useEffect(() => {
    if (captureStartedAt == null) return undefined;
    const machine = createLivePreviewStateMachine({
      brightness: {
        set: (level: number) => HumynScreenBrightness.set(level),
      },
      schedule: {
        setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
        clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
      },
    });
    machineRef.current = machine;
    const unsub = machine.subscribe(setState);
    machine.start();
    return () => {
      unsub();
      machine.stop();
      machineRef.current = null;
    };
  }, [captureStartedAt]);

  return {
    state,
    tap: () => machineRef.current?.tap(),
  };
}
