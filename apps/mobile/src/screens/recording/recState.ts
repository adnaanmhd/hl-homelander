// recState — the recording-surface state machine.
//
// VERBATIM shape from engineering-handoff.md §4.3 (the `RecState` type below
// reproduces that block exactly) with the `substate` discriminant added —
// the §4.3 diagram names the states, this module reproduces them as an enum
// so a `switch (state.substate)` can drive the chrome.
//
// PURE: no side effects, no `performance.now()` / `Date.now()` calls inside
// the reducer. Where a timestamp is needed, the CALLER supplies it via the
// action payload (`{ type: 'PRE_FLIGHT_OK', now }`, `{ type: 'CAPTURE_STARTED', now }`,
// `{ type: 'TICK', durationMs }`, …). Unknown action types and
// invalid-for-substate actions return `state` unchanged.
//
// Substate transition table (engineering-handoff §4.3 diagram):
//   initialRecState(params, gateConfig?) → substate 'rotate-prompt'
//   LANDSCAPE_DETECTED   on 'rotate-prompt'        → 'ready'           (no-op elsewhere)
//   ORIENTATION_LOST     on 'ready'|'pre-flight'|'gate' → 'rotate-prompt', gate reset to idle (device left landscape during a pre-record substate — re-gate so a take can't start in portrait; debug session handgate-never-passes. 'active' has its own mid-record stop in useRecordingLifecycle; 'rotate-prompt'/'stop-confirm'/'stopped' no-op)
//   SET_GATE_CONFIG      on a pre-gate substate    → gate.{targetHits,cadenceMs} updated, clamped (no-op once 'gate' entered) — HAND-11 RemoteConfig late resolve
//   START_PRESSED        on 'ready'                → 'pre-flight'
//   PRE_FLIGHT_OK        on 'pre-flight'           → 'gate' (phase 'loading', startedAt=now)
//   PRE_FLIGHT_FAILED    on 'pre-flight'           → 'ready'           (thermal/storage/battery start-guard)
//   CAMERA_READY         on 'gate' & phase loading → phase 'waiting'   (HAND-06 — accumulator starts at first frame)
//   GATE_HIT             on 'gate' & phase waiting → consecutiveHits+1; ≥targetHits → phase 'confirmed' (confirmedAt=now, skipped/bypassed false)
//   GATE_MISS            on 'gate' & phase waiting → consecutiveHits=0  (HAND-04 — instant reset; ring snap-to-0 is the component's job)
//   GATE_SKIP            on 'gate'                 → phase 'confirmed', skipped=true, confirmedAt=now
//   GATE_BYPASS          on 'gate'                 → phase 'confirmed', bypassed=true, confirmedAt=now
//   CAPTURE_STARTED      on 'gate' & phase confirmed → 'active', startedAt=now, durationMs=0
//   CAPTURE_START_FAILED on 'gate' & phase confirmed → 'ready', gate reset to idle
//   TICK                 on 'active'               → durationMs = action.durationMs (no auto-stop; the 60s practice cap is enforced by the screen dispatching STOP — PRACTICE_HARD_CAP is the explicit-case action)
//   PRACTICE_HARD_CAP    on 'active'               → 'stopped', ended=true   (the JS-owned 60s practice cap; HC's own timer auto-segments at 10m)
//   X_PRESSED            on 'active'               → 'stop-confirm'   (no-op on 'rotate-prompt'/'ready'/'gate' — the screen handles the pre-record silent dismiss; HAND-10 — no modal pre-record)
//   STOP_CONFIRM_CANCEL  on 'stop-confirm'         → 'active'
//   STOP_CONFIRM_STOP    on 'stop-confirm'         → 'stopped', ended=true
//   STOP                 on 'active'|'stop-confirm' → 'stopped', ended=true; if already ended → no-op (double-stop guard)
//   BATTERY_ALERT        anywhere                  → alerts.battery=true (overlay only — does NOT change substate)
//   THERMAL_ALERT        anywhere                  → alerts.thermal=true (overlay only)
//   RESET_FOR_FRESH      on 'stopped'              → 'rotate-prompt', gate reset to idle, durationMs=0, ended=false, alerts={} (REC-05 — a fresh recording re-runs the orientation gate so a 2nd take can't start in portrait; debug session handgate-never-passes)
//   (no timeout transition exists — HAND-05; the gate runs indefinitely until pass/skip)
//
// `gate.phase` is the sub-discriminant within substate==='gate'.
// `alerts.battery`/`alerts.thermal` are overlay flags (recording continues),
// not substates.

/** Recording-surface substates — the planner-derived discriminant over the
 *  engineering-handoff §4.3 diagram. */
export type RecSubstate =
  | 'rotate-prompt'
  | 'ready'
  | 'pre-flight'
  | 'gate'
  | 'active'
  | 'stop-confirm'
  | 'stopped';

/** Recording state — VERBATIM from engineering-handoff.md §4.3, plus the
 *  `substate` discriminant. */
export type RecState = {
  substate: RecSubstate;
  taskId: string;
  taskName: string;
  isPractice: boolean;
  startedAt: number | null; // performance.now() at active-recording start
  durationMs: number;
  cap: 60_000 | 1_200_000; // practice = 60s, real "doc value" 20m — JS owns ONLY the practice 60s hard cap; real recordings have no JS cap (HC auto-segments at 10m)
  ended: boolean; // double-stop guard
  alerts: { battery?: boolean; thermal?: boolean };
  gate: {
    phase: 'idle' | 'loading' | 'waiting' | 'confirmed';
    consecutiveHits: number; // count===2 streak; resets to 0 on any miss
    targetHits: number; // 2 Android (from RemoteConfig gate.consecutive_hits_required)
    cadenceMs: number; // 250 Android (from RemoteConfig gate.cadence_ms)
    skipped: boolean; // user tapped Skip
    bypassed: boolean; // HandDetector native module unavailable
    startedAt: number | null; // performance.now() at gate enter
    confirmedAt: number | null; // performance.now() at gate exit (success/skip/bypass)
  };
};

export type RecAction =
  | { type: 'LANDSCAPE_DETECTED' }
  | { type: 'ORIENTATION_LOST' }
  | { type: 'SET_GATE_CONFIG'; targetHits: number; cadenceMs: number }
  | { type: 'START_PRESSED' }
  | { type: 'PRE_FLIGHT_OK'; now: number }
  | { type: 'PRE_FLIGHT_FAILED' }
  | { type: 'CAMERA_READY' }
  | { type: 'GATE_HIT'; now: number }
  | { type: 'GATE_MISS' }
  | { type: 'GATE_SKIP'; now: number }
  | { type: 'GATE_BYPASS'; now: number }
  | { type: 'CAPTURE_STARTED'; now: number }
  | { type: 'CAPTURE_START_FAILED' }
  | { type: 'TICK'; durationMs: number }
  | { type: 'PRACTICE_HARD_CAP' }
  | { type: 'X_PRESSED' }
  | { type: 'STOP_CONFIRM_CANCEL' }
  | { type: 'STOP_CONFIRM_STOP' }
  | { type: 'STOP' }
  | { type: 'BATTERY_ALERT' }
  | { type: 'THERMAL_ALERT' }
  | { type: 'RESET_FOR_FRESH' };

// Android default (RemoteConfig gate.consecutive_hits_required). 2 hits × 250 ms
// cadence ≈ 0.5 s of "hands in frame" — the displayed copy still says "for 2
// secs"; the actual dwell was shortened (debug session handgate-never-passes,
// 2026-05-11, on-hardware UX: 5×400 ms then 3×400 ms still felt sluggish given
// the camera warmup; user directed 2×250 ms — still 2-hand, 2 consecutive frames).
const DEFAULT_TARGET_HITS = 2;
const DEFAULT_CADENCE_MS = 250; // Android default (RemoteConfig gate.cadence_ms)
const PRACTICE_CAP_MS = 60_000 as const;
const REAL_CAP_MS = 1_200_000 as const;

function idleGate(targetHits: number, cadenceMs: number): RecState['gate'] {
  return {
    phase: 'idle',
    consecutiveHits: 0,
    targetHits,
    cadenceMs,
    skipped: false,
    bypassed: false,
    startedAt: null,
    confirmedAt: null,
  };
}

export function initialRecState(
  params: { taskId: string; taskName: string; isPractice: boolean },
  gateConfig?: { targetHits?: number; cadenceMs?: number },
): RecState {
  const targetHits = gateConfig?.targetHits ?? DEFAULT_TARGET_HITS;
  const cadenceMs = gateConfig?.cadenceMs ?? DEFAULT_CADENCE_MS;
  return {
    substate: 'rotate-prompt',
    taskId: params.taskId,
    taskName: params.taskName,
    isPractice: params.isPractice,
    startedAt: null,
    durationMs: 0,
    cap: params.isPractice ? PRACTICE_CAP_MS : REAL_CAP_MS,
    ended: false,
    alerts: {},
    gate: idleGate(targetHits, cadenceMs),
  };
}

export function recReducer(state: RecState, action: RecAction): RecState {
  switch (action.type) {
    // ---- Overlay flags — never change substate; valid anywhere ----
    case 'BATTERY_ALERT':
      return state.alerts.battery
        ? state
        : { ...state, alerts: { ...state.alerts, battery: true } };
    case 'THERMAL_ALERT':
      return state.alerts.thermal
        ? state
        : { ...state, alerts: { ...state.alerts, thermal: true } };

    // ---- rotate-prompt → ready ----
    case 'LANDSCAPE_DETECTED':
      return state.substate === 'rotate-prompt' ? { ...state, substate: 'ready' } : state;

    // ---- ready/pre-flight/gate → rotate-prompt (device left landscape) ----
    //      Re-gate so a take can't START in portrait (debug session
    //      handgate-never-passes). 'active' is handled by useRecordingLifecycle
    //      (onStop('orientation')); 'rotate-prompt'/'stop-confirm'/'stopped' no-op.
    case 'ORIENTATION_LOST':
      if (
        state.substate === 'ready' ||
        state.substate === 'pre-flight' ||
        state.substate === 'gate'
      ) {
        return {
          ...state,
          substate: 'rotate-prompt',
          gate: idleGate(state.gate.targetHits, state.gate.cadenceMs),
        };
      }
      return state;

    // ---- RemoteConfig gate config (HAND-11) — only valid on a pre-gate
    //      substate; a no-op once the gate has been entered so it can't perturb
    //      an in-progress gate. targetHits floored at 1, cadenceMs at 100
    //      (mirrors remoteConfigGate's clamps — T-4.11-02). ----
    case 'SET_GATE_CONFIG':
      if (
        state.substate === 'rotate-prompt' ||
        state.substate === 'ready' ||
        state.substate === 'pre-flight'
      ) {
        return {
          ...state,
          gate: {
            ...state.gate,
            targetHits: Math.max(1, Math.round(action.targetHits)),
            cadenceMs: Math.max(100, Math.round(action.cadenceMs)),
          },
        };
      }
      return state;

    // ---- ready → pre-flight ----
    case 'START_PRESSED':
      return state.substate === 'ready' ? { ...state, substate: 'pre-flight' } : state;

    // ---- pre-flight → gate / pre-flight → ready ----
    case 'PRE_FLIGHT_OK':
      if (state.substate !== 'pre-flight') return state;
      return {
        ...state,
        substate: 'gate',
        gate: { ...state.gate, phase: 'loading', startedAt: action.now, confirmedAt: null },
      };
    case 'PRE_FLIGHT_FAILED':
      return state.substate === 'pre-flight' ? { ...state, substate: 'ready' } : state;

    // ---- gate.loading → gate.waiting ----
    case 'CAMERA_READY':
      if (state.substate !== 'gate' || state.gate.phase !== 'loading') return state;
      return { ...state, gate: { ...state.gate, phase: 'waiting' } };

    // ---- gate accumulation ----
    case 'GATE_HIT': {
      if (state.substate !== 'gate' || state.gate.phase !== 'waiting') return state;
      const next = state.gate.consecutiveHits + 1;
      if (next >= state.gate.targetHits) {
        return {
          ...state,
          gate: {
            ...state.gate,
            consecutiveHits: next,
            phase: 'confirmed',
            skipped: false,
            bypassed: false,
            confirmedAt: action.now,
          },
        };
      }
      return { ...state, gate: { ...state.gate, consecutiveHits: next } };
    }
    case 'GATE_MISS':
      if (state.substate !== 'gate' || state.gate.phase !== 'waiting') return state;
      return { ...state, gate: { ...state.gate, consecutiveHits: 0 } };

    // ---- gate skip / bypass ----
    case 'GATE_SKIP':
      if (state.substate !== 'gate') return state;
      return {
        ...state,
        gate: {
          ...state.gate,
          phase: 'confirmed',
          skipped: true,
          bypassed: false,
          confirmedAt: action.now,
        },
      };
    case 'GATE_BYPASS':
      if (state.substate !== 'gate') return state;
      return {
        ...state,
        gate: {
          ...state.gate,
          phase: 'confirmed',
          skipped: false,
          bypassed: true,
          confirmedAt: action.now,
        },
      };

    // ---- gate.confirmed → active / → ready ----
    case 'CAPTURE_STARTED':
      if (state.substate !== 'gate' || state.gate.phase !== 'confirmed') return state;
      return { ...state, substate: 'active', startedAt: action.now, durationMs: 0 };
    case 'CAPTURE_START_FAILED':
      if (state.substate !== 'gate' || state.gate.phase !== 'confirmed') return state;
      return {
        ...state,
        substate: 'ready',
        startedAt: null,
        durationMs: 0,
        gate: idleGate(state.gate.targetHits, state.gate.cadenceMs),
      };

    // ---- active ----
    case 'TICK':
      // No auto-stop here — the screen/useRecordingLifecycle enforces the
      // practice 60s cap by dispatching STOP. Just update the displayed
      // duration. (HC's own timer auto-segments at 10m.)
      return state.substate === 'active' ? { ...state, durationMs: action.durationMs } : state;
    case 'PRACTICE_HARD_CAP':
      return state.substate === 'active' ? { ...state, substate: 'stopped', ended: true } : state;
    case 'X_PRESSED':
      // Pre-record substates are a no-op at the reducer level — the screen
      // handles the silent-dismiss navigation (HAND-10).
      return state.substate === 'active' ? { ...state, substate: 'stop-confirm' } : state;

    // ---- stop-confirm ----
    case 'STOP_CONFIRM_CANCEL':
      return state.substate === 'stop-confirm' ? { ...state, substate: 'active' } : state;
    case 'STOP_CONFIRM_STOP':
      return state.substate === 'stop-confirm'
        ? { ...state, substate: 'stopped', ended: true }
        : state;

    // ---- stop (lifecycle policy / manual stop button) ----
    case 'STOP':
      if (state.ended) return state; // double-stop guard
      if (state.substate === 'active' || state.substate === 'stop-confirm') {
        return { ...state, substate: 'stopped', ended: true };
      }
      return state;

    // ---- stopped → rotate-prompt (real recording re-press) ----
    //      Back to 'rotate-prompt', NOT 'ready', so a 2nd take re-runs the
    //      landscape gate — otherwise stopping a take, rotating to portrait,
    //      and tapping record again starts a portrait recording (debug session
    //      handgate-never-passes). The screen also keeps the landscape lock
    //      across this transition (handleStop no longer unlocks on the <60s
    //      path — only the unmount cleanup / pre-record goBack unlocks).
    case 'RESET_FOR_FRESH':
      if (state.substate !== 'stopped') return state;
      return {
        ...state,
        substate: 'rotate-prompt',
        startedAt: null,
        durationMs: 0,
        ended: false,
        alerts: {},
        gate: idleGate(state.gate.targetHits, state.gate.cadenceMs),
      };

    default:
      return state;
  }
}
