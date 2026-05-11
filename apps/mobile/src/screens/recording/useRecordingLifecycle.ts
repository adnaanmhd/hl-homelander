// useRecordingLifecycle — the `idea-brief.md §10` "App Lifecycle & Edge Cases"
// policy table, as a hook over AppState / orientation / audio-focus / battery /
// storage / HumynCapture-error / thermal, plus the practice 60s hard cap and
// the pre-record start guards (REC-16 storage + battery <5%).
//
// §10 policy table (read idea-brief.md §10 directly — this is the mapping):
//
//   AppState 'background'/'inactive' mid-record (substate==='active')
//     → onStop('background')                    // upload if ≥60s, else discard (REC-12)
//   audio-focus sustained 'loss' while active
//     → onStop('phone_call')                    // answered call / done (REC-12)
//   audio-focus 'transient_loss' while active   → arm a ~7s timer:
//     • 'gain' arrives within 7s → cancel the timer, NO stop (call declined, REC-13)
//     • timer fires (still no gain) OR a 'loss' arrives → onStop('phone_call')
//       (the heuristic can't distinguish answered-call from alarm by focus type
//        alone; both stop — the `reason` is for telemetry/toast wording, A12)
//   orientation device-listener → 'PORTRAIT'/'PORTRAIT-UPSIDEDOWN' while active
//     → onStop('orientation') + showToast('Recording stopped — keep the phone in landscape.')
//   battery crossing >0.15 → ≤0.15 while active
//     → setAlert('battery', true) + showToast('Battery low. Consider charging soon.')
//       + HumynBeep.playTone('battery_alert') + Vibration.vibrate([0,100,50,100])
//       + voiceCue('Battery low. Consider charging soon.')   // NO stop (REC-10)
//   battery crossing to ≤0.05 while active
//     → onStop('battery_critical')              // end current segment immediately (REC-11)
//   isPractice && active && durationMs >= 60_000
//     → onStop('practice_hard_cap')             // JS-owned practice cap (ONB-05); takes precedence
//   HumynCapture.onError({code:'storage_full'}) while active
//     → onStop('storage_full') + showToast('Recording stopped — not enough storage.')
//   HumynCapture.onError({code:'permission_revoked'}) while active
//     → onStop('permission_revoked')
//   HumynCapture.onThermalAbort(...)
//     → voiceCue('Phone too hot, stopping recording') + setAlert('thermal', true)
//       + HumynBeep.playTone('thermal_alert') + Vibration.vibrate(800)   // NO stop;
//       HC self-stops within ~2.5s; the screen reacts to onSessionStop + shows
//       the "Recording stopped — phone needs to cool." toast
//   logout (`loggedOut` flag flips true) while active
//     → onStop('logout')                        // upload queue preserved (Phase 5 owns it)
//   checkStartGuards():
//     • RNFS.getFSInfo().freeSpace < 5e9 → { blocked, toast:'Not enough storage to record.' }  (REC-16)
//     • last-seen battery level < 0.05 && !charging → { blocked, toast:'Battery too low to start a recording. Charge to at least 15%.' }
//     • else { blocked:false }
//   notifications during recording                → no-op (REC-09 — Do-Not-Disturb is
//     NEVER toggled programmatically; this hook deliberately uses NONE of the
//     notification-policy permission, the telephony / call-state permission, or
//     the Settings DND APIs — call detection is audio-focus only, see
//     HumynPhoneState; the acceptance gate greps this file for those forbidden
//     symbols, so they are named descriptively here, never literally)
//   HumynCapture.start() reject 'thermal_throttling' → toast — handled by the SCREEN, not here
//
// Leak discipline (Pitfall 5): every subscription (AppState, Orientation UI +
// device, HumynPhoneState.onAudioFocusChanged, HumynBattery.onBatteryChanged,
// HumynCapture.onError/onThermalAbort) + every timer (the audio-focus 7s timer,
// the practice 60s cap timer, the 60s periodic storage/battery guard interval) +
// HumynPhoneState.stop()/HumynBattery.stop() is torn down in the single
// `useEffect` cleanup.

import { useCallback, useEffect, useRef } from 'react';
import { AppState, Vibration, type AppStateStatus } from 'react-native';
import Orientation, { type OrientationType } from 'react-native-orientation-locker';
import RNFS from 'react-native-fs';
import { onError, onThermalAbort } from '../../native/HumynCapture';
import {
  start as phoneStart,
  stop as phoneStop,
  onAudioFocusChanged,
} from '../../native/HumynPhoneState';
import {
  start as batteryStart,
  stop as batteryStop,
  onBatteryChanged,
} from '../../native/HumynBattery';
import { playTone } from '../../native/HumynBeep';
import { logEvent } from '../../util/analytics';
import type { RecSubstate } from './recState';

// --- thresholds (idea-brief.md §10) -----------------------------------------
const BATTERY_ALERT_LEVEL = 0.15; // ≤15% → alert + continue
const BATTERY_CRITICAL_LEVEL = 0.05; // ≤5% → stop (mid-record) / refuse-new (start)
const PRACTICE_HARD_CAP_MS = 60_000; // ONB-05 — JS-owned practice cap
const AUDIO_FOCUS_GRACE_MS = 7_000; // transient-loss → stop if not regained within this window (A12 tunable)
const STORAGE_MIN_FREE_BYTES = 5e9; // REC-16 — <5GB at start → refuse-new
const PERIODIC_GUARD_MS = 60_000; // 60s belt-and-suspenders storage/battery re-poll

// --- toast strings (UI-SPEC § Error / failure states) -----------------------
const TOAST_ORIENTATION = 'Recording stopped — keep the phone in landscape.';
const TOAST_BATTERY_LOW = 'Battery low. Consider charging soon.';
const TOAST_STORAGE_FULL = 'Recording stopped — not enough storage.';
const TOAST_START_STORAGE = 'Not enough storage to record.';
const TOAST_START_BATTERY = 'Battery too low to start a recording. Charge to at least 15%.';
const VOICE_BATTERY_LOW = 'Battery low. Consider charging soon.';
const VOICE_THERMAL = 'Phone too hot, stopping recording';

export type StopReason =
  | 'manual'
  | 'background'
  | 'phone_call'
  | 'alarm'
  | 'orientation'
  | 'battery_critical'
  | 'storage_full'
  | 'permission_revoked'
  | 'logout'
  | 'thermal'
  | 'practice_hard_cap';

export type LifecycleCallbacks = {
  /** Stop the active recording. The screen wires this to HumynCapture.stop()
   *  then routes per §7h (practice → PracticeComplete; real ≥60s → toast
   *  "{Hh Mm} added to your contribution." + Home; real <60s → toast
   *  "Recording too short — discarded." + ready). */
  onStop: (reason: StopReason) => void;
  /** Show a transient toast on the recording surface. */
  showToast: (text: string) => void;
  /** Speak a voice cue (TTS) AND duplicate it as the VoiceCue pill text (REC-15). */
  voiceCue: (text: string) => void;
  /** Set an overlay alert flag (battery/thermal) — recording continues underneath. */
  setAlert: (which: 'battery' | 'thermal', on: boolean) => void;
};

export type UseRecordingLifecycleArgs = {
  /** The recState reducer's substate discriminant. */
  substate: RecSubstate;
  isPractice: boolean;
  /** Current active-recording duration (the screen's TICK value, ms). */
  durationMs: number;
  /** Flips true when the user logs out while a recording is active (§10). */
  loggedOut?: boolean;
  callbacks: LifecycleCallbacks;
};

export type StartGuardResult = { blocked: true; toast: string } | { blocked: false };

type Removable = { remove: () => void };

/**
 * The §10 policy table + the practice 60s hard cap + the pre-record start
 * guards, as a hook. Mounted by RecordingScreen (plan 04-09). All side effects
 * route through the `callbacks` object the screen passes in.
 */
export function useRecordingLifecycle(args: UseRecordingLifecycleArgs): {
  /** Pre-record start guards (REC-16 storage <5GB / battery <5%): the screen
   *  calls this before dispatching START_PRESSED / before HumynCapture.start();
   *  returns `{ blocked:false }` if OK, or `{ blocked:true, toast }` if blocked. */
  checkStartGuards: () => Promise<StartGuardResult>;
} {
  const { substate, isPractice, durationMs, loggedOut, callbacks } = args;

  // Stable refs so the single effect doesn't churn on every render.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const durationMsRef = useRef(durationMs);
  durationMsRef.current = durationMs;
  const substateRef = useRef(substate);
  substateRef.current = substate;

  // Battery threshold-crossing tracking + the last charging state (for the
  // start guard). `-1` = "no battery reading yet".
  const lastBatteryLevelRef = useRef<number>(-1);
  const lastBatteryChargingRef = useRef<boolean>(false);

  // checkStartGuards — REC-16 storage + battery <5% start guard. Stable.
  const checkStartGuards = useCallback(async (): Promise<StartGuardResult> => {
    try {
      const fs = await RNFS.getFSInfo();
      if (fs.freeSpace < STORAGE_MIN_FREE_BYTES) {
        return { blocked: true, toast: TOAST_START_STORAGE };
      }
    } catch {
      // If we can't read free space, don't block on it — HC's own pre-flight
      // `storage_full` rejection is the backstop.
    }
    if (
      lastBatteryLevelRef.current >= 0 &&
      lastBatteryLevelRef.current < BATTERY_CRITICAL_LEVEL &&
      !lastBatteryChargingRef.current
    ) {
      return { blocked: true, toast: TOAST_START_BATTERY };
    }
    return { blocked: false };
  }, []);

  // The active flag the effect closes over for the §10 edges. We re-run the
  // effect when the substate enters/leaves {gate, active}; inside, `isActive`
  // re-derives from substateRef so the AppState/orientation handlers don't fire
  // a stop while in 'gate'.
  const monitoring = substate === 'gate' || substate === 'active';

  useEffect(() => {
    if (!monitoring) return;

    const subs: Removable[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let audioFocusTimer: ReturnType<typeof setTimeout> | null = null;
    let periodicGuard: ReturnType<typeof setInterval> | null = null;

    const isActive = () => substateRef.current === 'active';
    const cb = () => callbacksRef.current;

    // --- AppState: background/inactive mid-record → stop --------------------
    const appStateSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if ((s === 'background' || s === 'inactive') && isActive()) {
        logEvent('recording_stopped', { reason: 'background' });
        cb().onStop('background');
      }
    });
    subs.push(appStateSub);

    // --- orientation: device rotates out of landscape mid-record → stop ----
    const onDeviceOrientation = (o: OrientationType) => {
      if ((o === 'PORTRAIT' || o === 'PORTRAIT-UPSIDEDOWN') && isActive()) {
        logEvent('recording_stopped', { reason: 'orientation' });
        cb().onStop('orientation');
        cb().showToast(TOAST_ORIENTATION);
      }
    };
    Orientation.addDeviceOrientationListener(onDeviceOrientation);
    subs.push({ remove: () => Orientation.removeDeviceOrientationListener(onDeviceOrientation) });

    // --- audio focus: answered-call/alarm vs declined heuristic (A12) ------
    const clearAudioFocusTimer = () => {
      if (audioFocusTimer != null) {
        clearTimeout(audioFocusTimer);
        audioFocusTimer = null;
      }
    };
    phoneStart().catch(() => undefined);
    const audioFocusSub = onAudioFocusChanged((e) => {
      if (!isActive()) return;
      if (e.focus === 'loss') {
        clearAudioFocusTimer();
        logEvent('recording_stopped', { reason: 'phone_call' });
        cb().onStop('phone_call');
      } else if (e.focus === 'transient_loss') {
        clearAudioFocusTimer();
        audioFocusTimer = setTimeout(() => {
          audioFocusTimer = null;
          if (isActive()) {
            logEvent('recording_stopped', { reason: 'phone_call' });
            cb().onStop('phone_call');
          }
        }, AUDIO_FOCUS_GRACE_MS);
      } else if (e.focus === 'gain') {
        // Call declined / brief interruption — recording continues (REC-13).
        clearAudioFocusTimer();
      }
      // 'transient_loss_can_duck' → no-op (a notification chirp; we keep going).
    });
    subs.push(audioFocusSub);

    // --- battery: ≤15% alert+continue / ≤5% stop ---------------------------
    batteryStart().catch(() => undefined);
    const batterySub = onBatteryChanged((e) => {
      const prev = lastBatteryLevelRef.current;
      lastBatteryLevelRef.current = e.level;
      lastBatteryChargingRef.current = e.isCharging;
      if (!isActive()) return;
      // ≤5% crossing → stop (REC-11). Check this first (it subsumes ≤15%).
      if (e.level <= BATTERY_CRITICAL_LEVEL && (prev < 0 || prev > BATTERY_CRITICAL_LEVEL)) {
        logEvent('recording_stopped', { reason: 'battery_critical' });
        cb().onStop('battery_critical');
        return;
      }
      // ≤15% crossing → alert + continue (REC-10).
      if (
        e.level <= BATTERY_ALERT_LEVEL &&
        e.level > BATTERY_CRITICAL_LEVEL &&
        (prev < 0 || prev > BATTERY_ALERT_LEVEL)
      ) {
        cb().setAlert('battery', true);
        cb().showToast(TOAST_BATTERY_LOW);
        playTone('battery_alert').catch(() => undefined);
        Vibration.vibrate([0, 100, 50, 100]);
        cb().voiceCue(VOICE_BATTERY_LOW);
      }
    });
    subs.push(batterySub);

    // --- HumynCapture mid-session errors -----------------------------------
    const errSub = onError((e) => {
      if (!isActive()) return;
      if (e.code === 'storage_full') {
        logEvent('recording_stopped', { reason: 'storage_full' });
        cb().onStop('storage_full');
        cb().showToast(TOAST_STORAGE_FULL);
      } else if (e.code === 'permission_revoked') {
        logEvent('recording_stopped', { reason: 'permission_revoked' });
        cb().onStop('permission_revoked');
      }
    });
    subs.push(errSub);

    // --- HumynCapture thermal abort: alert only; HC self-stops -------------
    const thermalSub = onThermalAbort(() => {
      cb().voiceCue(VOICE_THERMAL);
      cb().setAlert('thermal', true);
      playTone('thermal_alert').catch(() => undefined);
      Vibration.vibrate(800);
    });
    subs.push(thermalSub);

    // --- 60s periodic storage/battery guard (belt-and-suspenders) ----------
    periodicGuard = setInterval(() => {
      RNFS.getFSInfo()
        .then((fs) => {
          if (isActive() && fs.freeSpace < STORAGE_MIN_FREE_BYTES) {
            // Mirror HC's own onError({code:'storage_full'}) path — but HC is
            // the authoritative source; this is the safety net for ROMs that
            // don't deliver granular storage signals to HC in time.
            logEvent('recording_stopped', { reason: 'storage_full' });
            cb().onStop('storage_full');
            cb().showToast(TOAST_STORAGE_FULL);
          }
        })
        .catch(() => undefined);
      // Battery is event-driven (onBatteryChanged); BATTERY_PROPERTY_CAPACITY
      // isn't reachable from JS, so there's nothing to re-poll here — the
      // sticky ACTION_BATTERY_CHANGED broadcast keeps lastBatteryLevelRef fresh.
    }, PERIODIC_GUARD_MS);

    return () => {
      for (const s of subs) {
        try {
          s.remove();
        } catch {
          /* ignore — already removed */
        }
      }
      clearAudioFocusTimer();
      for (const t of timers) clearTimeout(t);
      if (periodicGuard != null) clearInterval(periodicGuard);
      phoneStop().catch(() => undefined);
      batteryStop().catch(() => undefined);
    };
  }, [monitoring]);

  // --- practice 60s hard cap (ONB-05) ---------------------------------------
  // A separate effect so it re-arms exactly when active starts (or fires
  // immediately if the recording is already past 60s). Takes precedence over
  // every other lifecycle event — the cap fires at exactly 60s of recording.
  useEffect(() => {
    if (!isPractice || substate !== 'active') return;
    const remaining = Math.max(0, PRACTICE_HARD_CAP_MS - durationMsRef.current);
    const t = setTimeout(() => {
      logEvent('recording_stopped', { reason: 'practice_hard_cap' });
      callbacksRef.current.onStop('practice_hard_cap');
    }, remaining);
    return () => clearTimeout(t);
  }, [isPractice, substate]);

  // --- logout while active → stop -------------------------------------------
  useEffect(() => {
    if (loggedOut && substate === 'active') {
      logEvent('recording_stopped', { reason: 'logout' });
      callbacksRef.current.onStop('logout');
    }
  }, [loggedOut, substate]);

  return { checkStartGuards };
}

export default useRecordingLifecycle;
