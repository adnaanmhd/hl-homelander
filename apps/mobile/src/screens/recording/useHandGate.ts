// useHandGate — the HAND-03 / HAND-04 / HAND-13 photo-to-disk poll loop that
// drives the pre-record hand gate (04-RESEARCH Pattern 1).
//
// While the gate is in its `waiting` phase, on every `cadenceMs`-ms tick:
//   1. `camRef.current.takePhoto({ flash:'off', enableShutterSound:false })`
//      → a small JPEG written to VisionCamera's temp dir (we use
//      `photoQualityBalance="speed"` on the <Camera>, paired with the Kotlin
//      RGB_565 / 320×240 / recycle hygiene — Pitfall 10).
//   2. `RNFS.mkdir(cacheDir/hand-gate)` (best-effort) then
//      `RNFS.moveFile(photo.path, cacheDir/hand-gate/{uuid}.jpg)` — internal
//      storage only, never external, never in backup (Security V8/V12).
//   3. `HumynHandDetector.detectHands(dest, minConfidence)` → the hand COUNT
//      (0 / 1 / 2). A rejection (corrupt file, MediaPipe error) is treated as
//      0 hands ("no hands this poll").
//   4. `dispatch(count === 2 ? GATE_HIT : GATE_MISS)` (the reducer owns the
//      streak accumulation + the snap-to-0; HAND-04).
//   5. `RNFS.unlink(dest)` in a `finally` — delete the frame on every resolve
//      so camera frames never linger (the mount-time + app-launch sweeps mop
//      up stragglers from a crashed gate session).
//
// The recursive `setTimeout` (NOT `setInterval` — we want one tick to finish
// before the next is scheduled) + a `cancelled` ref are cleared on transition
// out of `gate.waiting` / unmount (Pitfall 5 leak discipline; mirrors
// CompatRunningScreen's `imuTickRef` / `cancelled` pattern).

import { useEffect, useRef } from 'react';
import uuid from 'react-native-uuid';
import RNFS from 'react-native-fs';
import { detectHands } from '../../native/HumynHandDetector';

/** The subset of the VisionCamera ref the gate uses (still-capture only). */
export interface HandGateCameraRef {
  takePhoto(opts: { flash: 'off'; enableShutterSound: boolean }): Promise<{ path: string }>;
}

export interface UseHandGateArgs {
  /** True iff substate==='gate' && gate.phase==='waiting' (the only window the loop runs). */
  active: boolean;
  /** Poll cadence in ms (gate.cadenceMs — RemoteConfig HAND-11). */
  cadenceMs: number;
  /** minHandDetectionConfidence (RemoteConfig HAND-11). */
  minConfidence: number;
  /** The VisionCamera <Camera> ref. */
  camRef: React.RefObject<HandGateCameraRef | null>;
  /** Dispatch onto recReducer — GATE_HIT (count===2) / GATE_MISS (else). */
  dispatch: (a: { type: 'GATE_HIT'; now: number } | { type: 'GATE_MISS' }) => void;
}

/** The cacheDir subfolder gate frames are moved through. */
export const HAND_GATE_DIR = `${RNFS.CachesDirectoryPath}/hand-gate`;

/**
 * Run the gate poll loop while `args.active`. All side effects are torn down on
 * deactivation / unmount.
 */
export function useHandGate(args: UseHandGateArgs): void {
  const { active, cadenceMs, minConfidence, camRef, dispatch } = args;

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
      const cam = camRef.current;
      if (cam == null) {
        // Camera not yet bound — retry on the next cadence.
        if (!cancelled) timer = setTimeout(tick, cadenceMs);
        return;
      }
      let dest: string | null = null;
      try {
        const photo = await cam.takePhoto({ flash: 'off', enableShutterSound: false });
        if (cancelled) {
          // Loop torn down while the photo was in flight — still clean up.
          if (photo?.path) RNFS.unlink(photo.path).catch(() => undefined);
          return;
        }
        await RNFS.mkdir(HAND_GATE_DIR).catch(() => undefined);
        dest = `${HAND_GATE_DIR}/${uuid.v4() as string}.jpg`;
        await RNFS.moveFile(photo.path, dest);
        const count = await detectHands(dest, minConfRef.current).catch(() => 0);
        if (!cancelled) {
          dispatchRef.current(
            count === 2 ? { type: 'GATE_HIT', now: nowMs() } : { type: 'GATE_MISS' },
          );
        }
      } catch {
        // takePhoto / moveFile threw — treat as a miss; the next tick retries.
        if (!cancelled) dispatchRef.current({ type: 'GATE_MISS' });
      } finally {
        if (dest) RNFS.unlink(dest).catch(() => undefined);
        if (!cancelled) timer = setTimeout(tick, cadenceMs);
      }
    };

    // First tick fires after one cadence (the <Camera> needs onInitialized +
    // the HAND-12 pre-warm to land first; the screen only flips `active` true
    // once gate.phase==='waiting', which is the CAMERA_READY transition).
    timer = setTimeout(tick, cadenceMs);

    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [active, cadenceMs, camRef]);
}

/** `performance.now()` with a `Date.now()` fallback (jsdom / older RN). */
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export default useHandGate;
