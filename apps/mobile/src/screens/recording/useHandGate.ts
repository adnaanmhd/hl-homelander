// useHandGate — the HAND-03 / HAND-04 / HAND-13 frame-to-disk poll loop that
// drives the pre-record hand gate (04-RESEARCH Pattern 1).
//
// While the gate is in its `waiting` phase, on every `cadenceMs`-ms tick:
//   1. `HumynGateCamera.captureFrame(cacheDir/hand-gate/{uuid}.jpg)` — the
//      native Camera2 gate camera (back ultrawide, AF OFF, fixed focus —
//      debug session handgate-never-passes, 2026-05-11) writes a small JPEG
//      straight to that app-internal path (never external, never in backup —
//      Security V8/V12). [Was: VisionCamera `takePhoto()` → `RNFS.moveFile`,
//      which ran on the main WIDE lens with continuous AF hunting → blurry
//      frames → the 5-consecutive-2-hand streak never completed.]
//   2. `HumynHandDetector.detectHands(dest, minConfidence)` → the hand COUNT
//      (0 / 1 / 2). A rejection (corrupt file, MediaPipe error) is treated as
//      0 hands ("no hands this poll").
//   3. `dispatch(count === 2 ? GATE_HIT : GATE_MISS)` (the reducer owns the
//      streak accumulation + the snap-to-0; HAND-04).
//   4. `RNFS.unlink(dest)` in a `finally` — delete the frame on every resolve
//      so camera frames never linger (the mount-time + app-launch sweeps mop
//      up stragglers from a crashed gate session).
//
// The native Camera2 session itself is opened (`startGate`) / closed
// (`stopGate`) by RecordingScreen around the `gate` substate, not here — this
// hook only does the poll while `args.active`.
//
// The recursive `setTimeout` (NOT `setInterval` — we want one tick to finish
// before the next is scheduled) + a `cancelled` ref are cleared on transition
// out of `gate.waiting` / unmount (Pitfall 5 leak discipline; mirrors
// CompatRunningScreen's `imuTickRef` / `cancelled` pattern).

import { useEffect, useRef } from 'react';
import uuid from 'react-native-uuid';
import RNFS from 'react-native-fs';
import { detectHands } from '../../native/HumynHandDetector';
import { captureFrame } from '../../native/HumynGateCamera';

export interface UseHandGateArgs {
  /** True iff substate==='gate' && gate.phase==='waiting' (the only window the loop runs). */
  active: boolean;
  /** Poll cadence in ms (gate.cadenceMs — RemoteConfig HAND-11). */
  cadenceMs: number;
  /** minHandDetectionConfidence (RemoteConfig HAND-11). */
  minConfidence: number;
  /** Dispatch onto recReducer — GATE_HIT (count===2) / GATE_MISS (else). */
  dispatch: (a: { type: 'GATE_HIT'; now: number } | { type: 'GATE_MISS' }) => void;
}

/** The cacheDir subfolder gate frames are written to / swept from. */
export const HAND_GATE_DIR = `${RNFS.CachesDirectoryPath}/hand-gate`;

/**
 * Run the gate poll loop while `args.active`. All side effects are torn down on
 * deactivation / unmount.
 */
export function useHandGate(args: UseHandGateArgs): void {
  const { active, cadenceMs, minConfidence, dispatch } = args;

  // Stable refs so the effect closure always sees the latest values without
  // re-running the loop on every render.
  const minConfRef = useRef(minConfidence);
  minConfRef.current = minConfidence;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      const startedAt = nowMs();
      const dest = `${HAND_GATE_DIR}/${uuid.v4() as string}.jpg`;
      try {
        await RNFS.mkdir(HAND_GATE_DIR).catch(() => undefined);
        await captureFrame(dest);
        if (cancelled) {
          RNFS.unlink(dest).catch(() => undefined);
          return;
        }
        const count = await detectHands(dest, minConfRef.current).catch(() => 0);
        if (!cancelled) {
          dispatchRef.current(
            count === 2 ? { type: 'GATE_HIT', now: nowMs() } : { type: 'GATE_MISS' },
          );
        }
      } catch {
        // captureFrame threw (camera not running, capture failed/timed out) —
        // treat as a miss; the next tick retries.
        if (!cancelled) dispatchRef.current({ type: 'GATE_MISS' });
      } finally {
        // Delete the frame on every resolve so camera frames never linger
        // (Security V8/V12 leak discipline; the mount-time + app-launch sweeps
        // mop up stragglers from a crashed gate session).
        RNFS.unlink(dest).catch(() => undefined);
        // Honour the cadence as a STEADY period, not an extra idle gap on top
        // of the (~150–250 ms) capture+detect work: if a tick took most/all of
        // `cadenceMs`, the next one fires (almost) immediately, so the ring
        // fills in ≈ `targetHits × cadenceMs` ("2 secs") rather than ≈ 2× that.
        if (!cancelled) {
          const remaining = Math.max(0, cadenceMs - (nowMs() - startedAt));
          timer = setTimeout(tick, remaining);
        }
      }
    };

    // First tick fires after a short warmup (not a full cadence) — RecordingScreen
    // only flips `active` true once gate.phase==='waiting' (the CAMERA_READY
    // transition, i.e. after `HumynGateCamera.startGate()` resolved AND the
    // preview's repeating request has been converging AE), so the camera is
    // already warm enough; ~100 ms just lets this render commit first.
    const FIRST_TICK_DELAY_MS = 100;
    timer = setTimeout(tick, FIRST_TICK_DELAY_MS);

    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [active, cadenceMs]);
}

/** `performance.now()` with a `Date.now()` fallback (jsdom / older RN). */
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export default useHandGate;
