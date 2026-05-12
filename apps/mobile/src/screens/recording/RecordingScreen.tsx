/**
 * RecordingScreen — the live recording surface (engineering-handoff §7 / §4.3 /
 * design-spec §7). Plan 04-09 wired the live camera mount onto the plan-04-07
 * shell; the debug session handgate-never-passes (2026-05-11) replaced the
 * VisionCamera `<Camera>` with the native Camera2 gate camera.
 *
 * What's live here:
 *   - the native Camera2 gate camera (`HumynGateCamera` — back ULTRAWIDE,
 *     `CONTROL_AF_MODE_OFF` + fixed focus, `CONTROL_ZOOM_RATIO` driven to the
 *     ultrawide; replaces VisionCamera, which couldn't disable AF or reach the
 *     ultrawide on a logical-multi-camera device). `<HumynGateCameraView>` is the
 *     live preview (a native TextureView), mounted only during the `gate`
 *     substate; `startGate()` on gate-enter → CAMERA_READY (gate.loading →
 *     waiting); `stopGate()` on the gate→record handoff + on unmount.
 *   - `useHandGate` poll loop (HAND-03/04/13 — HumynGateCamera.captureFrame →
 *     cacheDir/hand-gate/{uuid}.jpg → HumynHandDetector.detectHands →
 *     GATE_HIT/GATE_MISS)
 *   - HAND-08 silent bypass (`!isHandDetectorAvailable() || !isGateCameraAvailable()`
 *     → GATE_BYPASS) / HAND-07 Skip (→ GATE_SKIP, no voice/haptic, brightness
 *     still drops)
 *   - the HAND-09 TTS-masked gate-pass → active transition (Vibration.vibrate(120)
 *     → speakCue('Recording started') → VoiceCue pill 1.8s → set(0.05) →
 *     stopGate() → SETTLE_MS → HumynCapture.start(buildCaptureOpts(...))
 *     → CAPTURE_STARTED, or on reject set(-1) + CAPTURE_START_FAILED + toast)
 *   - HAND-11 RemoteConfig gate reads (readGateConfig); HAND-14 analytics
 *   - REC-01 Orientation.lockToLandscape() on mount / unlockAllOrientations() on
 *     unmount; REC-08 HumynScreenBrightness.set(-1) on stop AND unmount
 *   - the §7h post-stop routing (practice → PracticeComplete; real ≥60s → toast
 *     "{Hh Mm} added to your contribution." + Home; real <60s → toast +
 *     RESET_FOR_FRESH); REC-05 re-press starts fresh; REC-16 start guards
 *   - `useRecordingLifecycle` mount (plan 04-08) with onStop/showToast/voiceCue/setAlert
 *
 * `__test_initialState`: a render-only escape hatch — the visual baselines + the
 * render test inject a complete RecState here so each substate is exercisable
 * deterministically. Production callers never pass it (threat T-4.7-01).
 *
 * NO hex literals — colors from `colors.*`.
 */
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Orientation, { type OrientationType } from 'react-native-orientation-locker';
import RNFS from 'react-native-fs';
import { Text } from '../../ui/primitives/Text';
import { Icon } from '../../ui/primitives/Icon';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, radii, spacing } from '../../ui/tokens';
import { recReducer, initialRecState, type RecState } from './recState';
import { GateRing } from './components/GateRing';
import { VoiceCuePill } from './components/VoiceCuePill';
import { StopConfirmModal } from './components/StopConfirmModal';
import { AlertPill } from './components/AlertPill';
import { RotatePrompt } from './components/RotatePrompt';
import { useHandGate, HAND_GATE_DIR } from './useHandGate';
import { useRecordingLifecycle, type StopReason } from './useRecordingLifecycle';
import * as HumynCapture from '../../native/HumynCapture';
import {
  isHandDetectorAvailable,
  cleanup as cleanupHandDetector,
} from '../../native/HumynHandDetector';
import {
  isGateCameraAvailable,
  startGate as startGateCamera,
  stopGate as stopGateCamera,
  HumynGateCameraView,
} from '../../native/HumynGateCamera';
import * as HumynScreenBrightness from '../../native/HumynScreenBrightness';
import { pickAndSetEnInVoice, speakCue } from '../../lib/ttsVoice';
import { formatContributionDuration } from '../../lib/durationFormat';
import { buildCaptureOpts } from '../../lib/buildCaptureOpts';
import { readGateConfig, GATE_DEFAULTS, type GateConfig } from '../../lib/remoteConfigGate';
import { getFlavorContext } from '../../native/AppFlavor';
import { useAppStore } from '../../state/appStore';
import { secureMmkv } from '../../state/mmkv';
import { KEYS } from '../../state/keys';
import { logEvent } from '../../util/analytics';

interface NavigationLike {
  goBack(): void;
  navigate(route: string, params?: Record<string, unknown>): void;
  replace?(route: string, params?: Record<string, unknown>): void;
  reset?(state: unknown): void;
  getParent?: () => NavigationLike | undefined;
}

interface RecordingRouteParams {
  taskId?: string;
  taskName?: string;
  taskCategory?: string;
  taskSetting?: 'indoor' | 'outdoor';
  isPractice?: boolean;
}

interface RecordingScreenProps {
  /** Visual-baseline / unit-test escape hatch — render-only, no side effects. */
  __test_initialState?: RecState;
}

const OVERLAY_TIP_MS = 3000;
const VOICE_CUE_MS = 1800; // design-spec §7d — VoiceCue pill visible 1.8s.
const TICK_MS = 250; // active-recording timer/minute-bar refresh.

// [TUNABLE — re-measure the ±1ms video↔IMU drift on the gate→record camera
//  handoff in plan 04-10's smoke runbook (the [BLOCKING] gate). Phase 3 smoke 7
//  was mean 0.594 ms / p99 0.728 ms; if HumynCapture.start() stalls because the
//  native gate Camera2 session hasn't fully released the back camera, bump this
//  — or escalate a "HC.start() polls for camera availability" change to Phase 3.
//  (T-4.9-01 / Pitfall 1.) NB: with the native gate camera, stopGate() awaits a
//  full session+device close before resolving, so the back camera is genuinely
//  free by the time SETTLE_MS starts — but keep the margin until §5b re-confirms.]
const SETTLE_MS = 80;

/** Format a duration as HH:MM:SS. */
function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** The device locale string (en-IN / pt-BR / …) — the only HAND-14 cohort dim. */
function deviceLocale(): string {
  try {
    return (
      (Intl as unknown as { DateTimeFormat?: () => { resolvedOptions(): { locale: string } } })
        .DateTimeFormat?.()
        .resolvedOptions().locale ?? 'en'
    );
  } catch {
    return 'en';
  }
}

/** Read `compat.lastResult.v1` from MMKV — best-effort; never throws. */
function readCompatUltrawideDfovDeg(): number | null {
  try {
    const raw = secureMmkv.getString(KEYS.COMPAT_LAST_RESULT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { checks?: { ultrawideDfov?: { measuredDeg?: number } } };
    const deg = parsed?.checks?.ultrawideDfov?.measuredDeg;
    return typeof deg === 'number' && deg > 0 ? deg : null;
  } catch {
    return null;
  }
}

/** Best-effort APK version name; falls back to a parseable semver. */
function readAppVersion(): string {
  try {
    return getFlavorContext().versionName || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export default function RecordingScreen({ __test_initialState }: RecordingScreenProps = {}) {
  const navigation = useNavigation<NavigationLike>();
  const route = useRoute<{ key: string; name: string; params?: RecordingRouteParams }>();
  const params = route.params ?? {};
  const taskId = params.taskId ?? '__practice__';
  const taskName = params.taskName ?? 'Practice — 60 sec';
  const taskCategory = params.taskCategory ?? 'practice';
  const taskSetting: 'indoor' | 'outdoor' = params.taskSetting ?? 'indoor';
  const isPractice = params.isPractice ?? false;

  const [state, dispatch] = useReducer(
    recReducer,
    __test_initialState ?? initialRecState({ taskId, taskName, isPractice }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  // Per-segment telemetry IDs kept current from CAPTURE_STARTED + onSegment*
  // events (no UI; D-SEG-01 — the 10-min auto-segment cut is SILENT).
  const segMetaRef = useRef<{ recordingId?: string; filenameBase?: string }>({});

  // --- transient screen UI (toast / voice-cue pill) -------------------------
  const [toast, setToast] = useState<{ text: string; visible: boolean }>({
    text: '',
    visible: false,
  });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string) => {
    setToast({ text, visible: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }, []);

  const [voiceCue, setVoiceCue] = useState<{ text: string; visible: boolean }>({
    text: '',
    visible: false,
  });
  const voiceCueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showVoiceCue = useCallback((text: string) => {
    speakCue(text);
    setVoiceCue({ text, visible: true });
    if (voiceCueTimerRef.current) clearTimeout(voiceCueTimerRef.current);
    voiceCueTimerRef.current = setTimeout(
      () => setVoiceCue((v) => ({ ...v, visible: false })),
      VOICE_CUE_MS,
    );
  }, []);

  // --- gate camera: native Camera2 (back ultrawide, AF OFF) -----------------
  // The lens is selected in Kotlin (BackUltrawidePicker.pick + CONTROL_ZOOM_RATIO
  // → the ultrawide); JS just drives the lifecycle: startGate() on gate-enter →
  // CAMERA_READY, stopGate() on the gate→record handoff + on unmount. There's no
  // cameraId/device to pick from JS (D-COMPAT-05 only persists measuredDeg).

  // --- gate config (HAND-11 — RemoteConfig, defaulted-then-updated) ---------
  // The reducer starts the gate at the hard-coded 5/400 (DEFAULT_TARGET_HITS /
  // DEFAULT_CADENCE_MS); when RemoteConfig resolves we both keep the local
  // `gateCfg` (for `minHandDetectionConfidence`, which lives only here) AND
  // push targetHits/cadenceMs into the reducer via SET_GATE_CONFIG so the
  // GateRing target, the poll cadence, and the per-segment metadata all reflect
  // the live values (WR-01). SET_GATE_CONFIG's own substate guard means a late
  // resolve after the user already pressed record is a harmless no-op.
  const [gateCfg, setGateCfg] = useState<GateConfig>(GATE_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    readGateConfig().then((cfg) => {
      if (cancelled) return;
      setGateCfg(cfg);
      dispatch({ type: 'SET_GATE_CONFIG', targetHits: cfg.targetHits, cadenceMs: cfg.cadenceMs });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- compat dfov + app version (read once at mount) -----------------------
  const dfovMeasuredDeg = useRef<number | null>(null);
  const appVersionRef = useRef<string>('1.0.0');
  // pickAndSetEnInVoice + Orientation lock + cacheDir sweep — once on mount.
  useEffect(() => {
    dfovMeasuredDeg.current = readCompatUltrawideDfovDeg();
    appVersionRef.current = readAppVersion();
    pickAndSetEnInVoice().catch(() => undefined);
    Orientation.lockToLandscape();
    // Sweep stragglers from a crashed previous gate session (Security V8/V12 —
    // in addition to the Phase-3 app-launch sweep).
    RNFS.readDir(HAND_GATE_DIR)
      .then((files) => files.forEach((f) => RNFS.unlink(f.path).catch(() => undefined)))
      .catch(() => undefined);
    return () => {
      Orientation.unlockAllOrientations();
      HumynScreenBrightness.set(-1).catch(() => undefined);
      cleanupHandDetector().catch(() => undefined);
      // Release the native Camera2 gate session if the screen unmounts mid-gate
      // (idempotent — resolves harmlessly when nothing is running).
      stopGateCamera().catch(() => undefined);
      // WR-02 — unconditionally recall any native capture session
      // (camera/encoders/IMU/FGS) that a HumynCapture.start() already in flight
      // (or just-resolved during the gate→record handoff) brought up. Rejects
      // 'no_active_session' harmlessly when nothing is running, so it's safe to
      // fire on every unmount — this is the single chokepoint that prevents an
      // orphaned session / stuck "recording" foreground-service notification
      // when the user exits during the handoff (T-4.11-01).
      HumynCapture.stop().catch(() => undefined);
    };
  }, []);

  // ===========================================================================
  // CR-01 — the PRODUCTION orientation gate. Active across ALL pre-record
  // substates ('rotate-prompt' | 'ready' | 'pre-flight' | 'gate'), not just
  // 'rotate-prompt': a device-orientation (PHYSICAL) listener (works regardless
  // of the landscape lock) plus a fire-once read on (re)entry.
  //   • LANDSCAPE → dispatch LANDSCAPE_DETECTED (advances 'rotate-prompt' → 'ready';
  //     no-op on the others). Without this the surface is a dead-end in release
  //     builds (initialRecState() starts at 'rotate-prompt').
  //   • PORTRAIT  → dispatch ORIENTATION_LOST (kicks 'ready'/'pre-flight'/'gate'
  //     back to 'rotate-prompt'; no-op on 'rotate-prompt'). So you can't stop a
  //     take, rotate to portrait, and start a new one in portrait (debug session
  //     handgate-never-passes). Mid-RECORD ('active') rotation is handled
  //     separately by useRecordingLifecycle's onStop('orientation').
  // The reducer guards each action by substate, so a late listener fire is
  // harmless (T-4.11-03).
  // ===========================================================================
  useEffect(() => {
    const PRE_RECORD = ['rotate-prompt', 'ready', 'pre-flight', 'gate'];
    if (!PRE_RECORD.includes(state.substate)) return;
    // Ongoing rotation (the listener): landscape → advance; portrait → re-gate.
    const onChange = (o: OrientationType) => {
      if (o === 'LANDSCAPE-LEFT' || o === 'LANDSCAPE-RIGHT') {
        dispatch({ type: 'LANDSCAPE_DETECTED' });
      } else if (o === 'PORTRAIT' || o === 'PORTRAIT-UPSIDEDOWN') {
        dispatch({ type: 'ORIENTATION_LOST' });
      }
    };
    // Fire-once read for the "already in landscape on (re)entry" case — ONLY
    // the advance, never ORIENTATION_LOST: a stale 'PORTRAIT' read here would
    // bounce a take that just legitimately entered 'ready' in landscape (and a
    // real later rotation is caught by the listener above).
    Orientation.getDeviceOrientation((o) => {
      const ot = o as OrientationType;
      if (ot === 'LANDSCAPE-LEFT' || ot === 'LANDSCAPE-RIGHT') {
        dispatch({ type: 'LANDSCAPE_DETECTED' });
      }
    });
    Orientation.addDeviceOrientationListener(onChange);
    return () => Orientation.removeDeviceOrientationListener(onChange);
  }, [state.substate]);

  // --- 3s "Don't exit while recording." overlay tip -------------------------
  const [tipVisible, setTipVisible] = useState(true);
  const tipOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(tipOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setTipVisible(false),
      );
    }, OVERLAY_TIP_MS);
    return () => clearTimeout(t);
  }, [tipOpacity]);

  // ===========================================================================
  // useRecordingLifecycle — the §10 policy table (plan 04-08).
  // ===========================================================================
  // `endedRef` guards handleStop against double-stop (the reducer also has
  // `ended`, but a stop reason can fire from multiple lifecycle sources).
  const handlingStopRef = useRef(false);
  const handleStop = useCallback(
    async (_reason: StopReason) => {
      if (handlingStopRef.current || stateRef.current.ended) {
        // STOP still needs to reach the reducer (e.g. orientation stop from
        // useRecordingLifecycle while the screen hasn't dispatched yet).
        if (!stateRef.current.ended) dispatch({ type: 'STOP' });
        return;
      }
      handlingStopRef.current = true;
      const durationMs = stateRef.current.durationMs;
      const practice = stateRef.current.isPractice;
      // End the reducer state first so the chrome stops the timer immediately.
      dispatch({ type: 'STOP' });
      // IN-09 — capture the stop() rejection rather than swallowing it. A
      // 'no_active_session' reject is harmless (the gate→record handoff hasn't
      // brought up a session yet); a real reject means the segment may not have
      // finalized — we log it and, on the real-recording ≥60s path, surface a
      // "finalizing failed" toast instead of claiming a clean save.
      const stopErr = await HumynCapture.stop()
        .then(() => null)
        .catch((e: unknown) => e);
      if (stopErr) {
        logEvent('recording_stop_failed', {
          code: (stopErr as { code?: string } | undefined)?.code ?? 'unknown',
        });
      }
      await HumynScreenBrightness.set(-1).catch(() => undefined);
      // The two navigate-away paths (practice → PracticeComplete, real ≥60s →
      // Home) must unlock orientation HERE, synchronously, before navigating —
      // relying on the screen's unmount cleanup left the next screen stuck in
      // landscape after a recording auto-stop (smoke walk, debug session
      // handgate-never-passes). The real-<60s path is the exception: it stays
      // on this screen and goes back to 'rotate-prompt' (RESET_FOR_FRESH), so
      // it must STAY landscape-locked (readable rotate-prompt; no 2nd take in
      // portrait) — that branch deliberately does NOT unlock.
      if (practice) {
        Orientation.unlockAllOrientations();
        logEvent('recording_stopped');
        speakCue('Recording stopped');
        navigateToPracticeComplete(navigation);
        return;
      }
      if (durationMs >= 60_000) {
        Orientation.unlockAllOrientations();
        logEvent('recording_stopped');
        speakCue('Recording stopped');
        showToast(
          stopErr
            ? 'Recording saved, but finalizing failed — it may not upload.'
            : `${formatContributionDuration(durationMs)} added to your contribution.`,
        );
        navigateToHome(navigation);
        return;
      }
      // Real recording under 1 minute — discarded (HumynCapture owns the file
      // deletion at finalize per REC-07 / 03-CONTEXT D-FS-*; the screen shows
      // the toast then returns to the landscape gate for a fresh attempt — REC-05).
      logEvent('recording_too_short');
      showToast('Recording too short — discarded.');
      handlingStopRef.current = false;
      dispatch({ type: 'RESET_FOR_FRESH' });
    },
    [navigation, showToast],
  );

  // WR-06 — `loggedOut` wired to the auth-token signal: the §10 "logout while
  // active → onStop('logout')" policy fires when `appStore.jwt` flips to null
  // (signOut()). Selector returns a boolean so the screen only re-renders on
  // the actual login/logout transition.
  const loggedOut = useAppStore((s) => s.jwt == null);

  const { checkStartGuards } = useRecordingLifecycle({
    substate: state.substate,
    isPractice,
    durationMs: state.durationMs,
    startedAt: state.startedAt,
    loggedOut,
    callbacks: {
      onStop: (reason) => {
        handleStop(reason).catch(() => undefined);
      },
      showToast,
      voiceCue: showVoiceCue,
      setAlert: (which, on) => {
        if (!on) return; // overlay flags don't need clearing mid-record.
        dispatch(which === 'battery' ? { type: 'BATTERY_ALERT' } : { type: 'THERMAL_ALERT' });
      },
    },
  });

  // ===========================================================================
  // pre-flight → gate (REC-16 start guards: storage <5GB / battery <5%).
  // ===========================================================================
  useEffect(() => {
    if (state.substate !== 'pre-flight') return;
    let cancelled = false;
    checkStartGuards().then((g) => {
      if (cancelled) return;
      if (g.blocked) {
        showToast(g.toast);
        dispatch({ type: 'PRE_FLIGHT_FAILED' });
      } else {
        dispatch({ type: 'PRE_FLIGHT_OK', now: nowMs() });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.substate, checkStartGuards, showToast]);

  // ===========================================================================
  // Native Camera2 gate-camera lifecycle (back ULTRAWIDE, AF OFF, fixed focus;
  // CONTROL_ZOOM_RATIO driven to the ultrawide so the operator sees the SAME
  // FOV the HumynCapture HEVC recording will capture). The camera is open across
  // ALL the camera pre-record substates — 'ready' | 'pre-flight' | 'gate' — not
  // just 'gate': the operator (or a helper standing in front of them) can verify
  // the head-rig placement / that their hands are in frame / that the scene is
  // visible BEFORE pressing Start. It's closed by the gate→record handoff (one
  // back-camera client — HumynCapture opens its own Camera2 session for the HEVC
  // pipeline; see the SETTLE_MS dance in `run()`), and whenever the surface
  // leaves the pre-record flow ('rotate-prompt' via ORIENTATION_LOST / 'active'
  // / 'stopped' / unmount). `startGateCamera()` is fired at most ONCE per
  // open-window (it is NOT idempotent — calling start() while running fails
  // "gate_camera_busy"), tracked by `cameraStartedRef`.
  // ===========================================================================
  const cameraStartedRef = useRef(false); // startGateCamera() in flight or resolved
  const cameraReadyRef = useRef(false); // startGateCamera() resolved OK
  const cameraFailedRef = useRef(false); // startGateCamera() exhausted retries
  const resetCameraState = () => {
    cameraStartedRef.current = false;
    cameraReadyRef.current = false;
    cameraFailedRef.current = false;
  };
  useEffect(() => {
    const wantsCamera =
      state.substate === 'ready' || state.substate === 'pre-flight' || state.substate === 'gate';
    if (!wantsCamera) {
      if (cameraStartedRef.current) {
        resetCameraState();
        stopGateCamera().catch(() => undefined);
      }
      return;
    }
    if (!isGateCameraAvailable() || cameraStartedRef.current) return;
    cameraStartedRef.current = true;
    let cancelled = false;
    const open = (attempt: number): void => {
      startGateCamera()
        .then(() => {
          if (cancelled) return;
          cameraReadyRef.current = true;
          // No-op unless we're in 'gate' phase 'loading' (→ 'waiting'); if we're
          // still in 'ready'/'pre-flight', the gate-enter effect re-dispatches
          // CAMERA_READY once 'gate' is reached.
          dispatch({ type: 'CAMERA_READY' });
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 1) {
            setTimeout(() => {
              if (!cancelled) open(attempt + 1);
            }, 250);
          } else {
            // Couldn't open the camera. Mark it; the gate-enter effect bypasses
            // the gate (HAND-08-style) if/when we reach 'gate'. No CAMERA_READY.
            cameraFailedRef.current = true;
            dispatch({ type: 'GATE_BYPASS', now: nowMs() }); // no-op outside 'gate'
          }
        });
    };
    open(0);
    return () => {
      cancelled = true;
    };
  }, [state.substate]);

  // ===========================================================================
  // gate enter — analytics + HAND-08 silent bypass + advance the gate once the
  // camera (opened on entering 'ready' above) is ready.
  // ===========================================================================
  const gateEnteredRef = useRef(false);
  // Cosmetic fix (Phase-4 smoke): monotonic gate-start/confirm timestamps,
  // captured here from effects rather than relying on the reducer's
  // `state.gate.{startedAt,confirmedAt}` for the metadata `start_gate.duration_ms`
  // — a gate-PASS run once stamped 59929 ms (≈ the whole recording) because
  // `state.gate.startedAt` wasn't reliably populated before `confirmedAt` on the
  // pass path, so `confirmedAt - 0` leaked the absolute performance.now() value.
  const gateStartMsRef = useRef<number | null>(null);
  const gateConfirmedMsRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.substate !== 'gate') {
      gateEnteredRef.current = false;
      return;
    }
    if (gateEnteredRef.current) return;
    gateEnteredRef.current = true;
    gateStartMsRef.current = nowMs();
    gateConfirmedMsRef.current = null;
    logEvent('recording_gate_started', { locale: deviceLocale() });
    // HAND-08 — no native hand-gate (HandLandmarker missing OR the gate camera
    // module didn't register OR the camera failed to open) → silent bypass (same
    // UX as Skip). Only on the natural entry phase ('loading'); a screen rendered
    // directly into a later phase (__test_initialState / hot-reload) is past it.
    if (
      state.gate.phase === 'loading' &&
      (!isHandDetectorAvailable() || !isGateCameraAvailable() || cameraFailedRef.current)
    ) {
      logEvent('recording_gate_bypassed', { locale: deviceLocale() });
      dispatch({ type: 'GATE_BYPASS', now: nowMs() });
      return;
    }
    // The camera was opened on entering 'ready'. If it already resolved →
    // advance the gate to 'waiting' now; otherwise the lifecycle effect's
    // startGateCamera().then() above will dispatch CAMERA_READY when it does.
    if (cameraReadyRef.current && state.gate.phase === 'loading') {
      dispatch({ type: 'CAMERA_READY' });
    }
  }, [state.substate]);

  // The gate poll loop — only while gate.waiting (i.e. after startGate() resolved).
  useHandGate({
    active: state.substate === 'gate' && state.gate.phase === 'waiting',
    cadenceMs: state.gate.cadenceMs,
    minConfidence: gateCfg.minHandDetectionConfidence,
    dispatch,
  });

  // ===========================================================================
  // gate.confirmed → active — the HAND-09 TTS-masked camera handoff (Pattern 2).
  // ===========================================================================
  const transitionStartedRef = useRef(false);
  useEffect(() => {
    if (state.substate !== 'gate' || state.gate.phase !== 'confirmed') {
      if (state.substate !== 'gate') transitionStartedRef.current = false;
      return;
    }
    if (transitionStartedRef.current) return;
    transitionStartedRef.current = true;
    // Stamp the confirm time the instant we observe phase === 'confirmed'
    // (before the SETTLE_MS handoff dance below), so the start_gate duration
    // reflects the gate window, not the gate + camera handoff.
    if (gateConfirmedMsRef.current == null) gateConfirmedMsRef.current = nowMs();

    let cancelled = false;
    const run = async (): Promise<void> => {
      const passed = !state.gate.skipped && !state.gate.bypassed;
      if (passed) {
        Vibration.vibrate(120);
        showVoiceCue('Recording started');
        logEvent('recording_gate_passed', { locale: deviceLocale() });
        logEvent('recording_started');
      }
      // For ALL exit kinds (passed/skipped/bypassed): drop brightness, release
      // the native gate Camera2 session, settle, then start HumynCapture
      // (REC-08 / HAND-07/09). The gate camera MUST be closed before
      // HumynCapture.start() opens Camera2 for the HEVC pipeline — one
      // back-camera client at a time (the SETTLE_MS handoff).
      await HumynScreenBrightness.set(0.05).catch(() => undefined);
      await stopGateCamera().catch(() => undefined);
      // Mirror the close into the lifecycle-effect refs so that, if
      // HumynCapture.start() rejects below (→ CAPTURE_START_FAILED → 'ready'),
      // the lifecycle effect re-opens the camera for the post-fail preview.
      resetCameraState();
      await new Promise<void>((r) => setTimeout(r, SETTLE_MS));
      if (cancelled) return;
      // Use the monotonic refs captured by the gate-enter / gate-confirm
      // effects above; clamp to [0, 5 min] so a missing start (shouldn't
      // happen, but defensively) or a clock anomaly can't leak a bogus
      // multi-minute value into start_gate.duration_ms (cosmetic fix).
      const gateStartMs = gateStartMsRef.current;
      const gateConfirmedMs = gateConfirmedMsRef.current ?? nowMs();
      const gateDurationMs =
        gateStartMs == null ? 0 : Math.max(0, Math.min(gateConfirmedMs - gateStartMs, 300_000));
      const u = useAppStore.getState();
      try {
        const opts = buildCaptureOpts({
          taskId,
          taskName,
          taskCategory,
          taskSetting,
          isPractice,
          gate: {
            passed,
            skipped: state.gate.skipped,
            bypassed: state.gate.bypassed,
            durationMs: Math.max(0, gateDurationMs),
          },
          gateConfig: { targetHits: state.gate.targetHits, cadenceMs: state.gate.cadenceMs },
          // The measured ultrawide dFOV from the passed compat-check (Phase 2
          // D-COMPAT-05); if it's somehow missing from MMKV (corrupted store,
          // a build that skipped the check) fall back to the spec floor (110°,
          // idea-brief §2.1) — `dfovDegrees` must be > 0 to pass the schema.
          compat: {
            ultrawideDfovMeasuredDeg:
              dfovMeasuredDeg.current != null && dfovMeasuredDeg.current > 0
                ? dfovMeasuredDeg.current
                : 110,
          },
          user: {
            name: u.user?.name ?? '',
            email: u.user?.email ?? '',
            age: null,
            gender: null,
            consentPresent: u.consent != null,
          },
          appVersion: appVersionRef.current,
        });
        const r = await HumynCapture.start(opts);
        if (cancelled) {
          // WR-02 — the screen unmounted (or the gate re-ran) while start() was
          // in flight; recall the session immediately rather than waiting for
          // the mount-effect cleanup, so the FGS notification doesn't linger.
          HumynCapture.stop().catch(() => undefined);
          return;
        }
        segMetaRef.current = { recordingId: r.recordingId, filenameBase: r.filenameBase };
        dispatch({ type: 'CAPTURE_STARTED', now: nowMs() });
      } catch (e) {
        const code = (e as { code?: string } | undefined)?.code;
        speakCue(
          code === 'thermal_throttling'
            ? 'Phone too warm'
            : code === 'permission_revoked'
              ? 'Camera permission needed'
              : 'Could not start recording',
        );
        await HumynScreenBrightness.set(-1).catch(() => undefined);
        showToast(
          code === 'storage_full'
            ? 'Not enough storage to record.'
            : code === 'thermal_throttling'
              ? 'Phone too warm — let it cool and try again.'
              : 'Could not start recording.',
        );
        dispatch({ type: 'CAPTURE_START_FAILED' });
      }
    };
    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [state.substate, state.gate.phase]);

  // recording/segment telemetry hooks (onSegmentComplete/onSegmentStart) are
  // SILENT (CAP-10 / D-SEG-01 — no gate re-run, no voice cue), subscribed only
  // to keep the telemetry IDs current.
  useEffect(() => {
    const startSub = HumynCapture.onSegmentStart((e) => {
      segMetaRef.current = { recordingId: e.recordingId, filenameBase: e.filenameBase };
    });
    const completeSub = HumynCapture.onSegmentComplete((e) => {
      segMetaRef.current = { ...segMetaRef.current, recordingId: e.recordingId };
    });
    return () => {
      startSub.remove();
      completeSub.remove();
    };
  }, []);

  // ===========================================================================
  // active duration TICK — drives the timer + the minute-bar.
  // ===========================================================================
  useEffect(() => {
    if (state.substate !== 'active') return;
    const id = setInterval(() => {
      const started = stateRef.current.startedAt ?? nowMs();
      dispatch({ type: 'TICK', durationMs: nowMs() - started });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.substate]);

  // --- toast / voice-cue timer cleanup --------------------------------------
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (voiceCueTimerRef.current) clearTimeout(voiceCueTimerRef.current);
    };
  }, []);

  // ===========================================================================
  // X button — stop-confirm while active; silent dismiss → Home pre-record (HAND-10).
  // ===========================================================================
  const handleClose = () => {
    if (state.substate === 'active') {
      dispatch({ type: 'X_PRESSED' });
      return;
    }
    // Pre-record substates: silent dismiss, no confirmation, no data to discard.
    // `Recording` is a root-stack sibling and the practice path got here via
    // PracticeIntro.replace(...) (which popped the rest of the stack), so a plain
    // navigation.goBack() throws "GO_BACK was not handled by any navigator"
    // (smoke walk, debug session handgate-never-passes). Reset the root onto
    // MainTabs (Home) — mirrors navigateToHome / navigateToPracticeComplete.
    HumynScreenBrightness.set(-1).catch(() => undefined);
    Orientation.unlockAllOrientations();
    const target = navigation.getParent?.() ?? navigation;
    if (target.reset) {
      target.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      target.navigate('MainTabs');
    }
  };

  const minuteBarFraction =
    state.substate === 'active' ? Math.min(1, state.durationMs / 60_000) : 0;

  return (
    <ScreenContainer
      accessibilityLabel="Recording screen"
      backgroundColor={colors.recBg}
      noSafeArea
      padding={0}
    >
      {/* Live gate-camera preview — a native TextureView fed by the Camera2
          gate session (back ULTRAWIDE, AF OFF, fixed focus; CONTROL_ZOOM_RATIO
          driven to the ultrawide so the operator sees the same FOV the
          HumynCapture HEVC recording captures). Mounted across ALL the camera
          pre-record substates ('ready' | 'pre-flight' | 'gate') so the operator
          (or a helper) can check the rig placement / hands-in-frame / scene
          before pressing Start — NOT during 'active' (the recording surface
          dims to ~5% with no preview, design-spec §7 — the rig is head-mounted
          and a preview would just burn battery/thermal). The Camera2 session
          lifecycle (open on entering 'ready', close on the gate→record handoff
          / leaving the pre-record flow / unmount) is driven by the effects
          above, NOT by mount/unmount of this view. NEVER the HEVC pipeline —
          that's HumynCapture (one back-camera client at a time; the gate
          session is closed via stopGate() + SETTLE_MS before HumynCapture.start
          opens Camera2 — T-4.9-06). */}
      {state.substate === 'ready' ||
      state.substate === 'pre-flight' ||
      state.substate === 'gate' ? (
        <HumynGateCameraView style={StyleSheet.absoluteFill} />
      ) : null}

      {/* Top 3px full-width minute-bar (only fills during active recording). */}
      <View style={styles.minuteBarTrack} accessibilityLabel="recording-minute-bar">
        <View style={[styles.minuteBarFill, { width: `${minuteBarFraction * 100}%` }]} />
      </View>

      {/* Top row: task name + 36px circular X. */}
      <View style={styles.topRow}>
        <Text variant="pillLabel" style={styles.taskName} numberOfLines={1}>
          {state.taskName}
        </Text>
        <Pressable
          accessibilityLabel="recording-close"
          onPress={handleClose}
          style={styles.closeBtn}
        >
          <Icon name="X" size={20} color={colors.recTextPrimary} />
        </Pressable>
      </View>

      {/* 3s "Don't exit while recording." overlay tip. */}
      {tipVisible ? (
        <Animated.View
          style={[styles.overlayTip, { opacity: tipOpacity }]}
          accessibilityLabel="recording-overlay-tip"
        >
          <Text variant="caption" style={styles.overlayTipText}>
            Don&apos;t exit while recording.
          </Text>
        </Animated.View>
      ) : null}

      {/* 'ready' record button — bottom-anchored over the live preview. Owner
          directive (debug session handgate-never-passes): now that the gate
          camera's preview fills the screen from 'ready' onward, the "Start
          Recording" button sits at the bottom of the screen over the preview,
          not centered in the middle of it — mirrors the 'active' Stop button /
          prototype.html's `.rec-bottom` placement. Label text unchanged. */}
      {state.substate === 'ready' ? (
        <View style={styles.recordButtonBottom}>
          <Pressable
            accessibilityLabel="recording-record-button"
            onPress={() => dispatch({ type: 'START_PRESSED' })}
            style={styles.recordButton}
          />
          <Text variant="pillLabel" style={styles.recordLabel}>
            Start Recording
          </Text>
        </View>
      ) : null}

      {/* Substate-driven chrome. */}
      <View style={styles.body}>
        {state.substate === 'rotate-prompt' ? <RotatePrompt /> : null}

        {state.substate === 'pre-flight' ? (
          <View style={styles.centerStack} accessibilityLabel="recording-preflight" />
        ) : null}

        {state.substate === 'gate' ? (
          <View style={styles.centerStack}>
            <GateRing
              hits={state.gate.consecutiveHits}
              target={state.gate.targetHits}
              loading={state.gate.phase === 'loading'}
            />
            <Text variant="recGatePrompt" style={styles.gatePrompt}>
              Mount the phone on your head and bring your hands in frame for 2 secs
            </Text>
            {/* Skip link — visible from t=0 (HAND-02); hidden once confirmed. */}
            {state.gate.phase !== 'confirmed' ? (
              <Pressable
                accessibilityLabel="recording-skip"
                onPress={() => {
                  logEvent('recording_gate_skipped', { locale: deviceLocale() });
                  dispatch({ type: 'GATE_SKIP', now: nowMs() });
                }}
                style={styles.skipLink}
              >
                <Text variant="recSkipLink" style={styles.skipLinkText}>
                  Skip
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {state.substate === 'active' || state.substate === 'stop-confirm' ? (
          <View style={styles.centerStack}>
            <Text variant="monoTimer" style={styles.timer} accessibilityLabel="recording-timer">
              {formatTimer(state.durationMs)}
            </Text>
            <Pressable
              accessibilityLabel="recording-stop"
              onPress={() => handleStop('manual')}
              style={styles.stopButton}
            >
              <View style={styles.stopSquare} />
            </Pressable>
            <VoiceCuePill text={voiceCue.text} visible={voiceCue.visible} />
            <AlertPill
              label={
                state.alerts.battery ? 'Battery 15%' : state.alerts.thermal ? 'Phone too hot' : ''
              }
              visible={!!state.alerts.battery || !!state.alerts.thermal}
            />
          </View>
        ) : null}

        {state.substate === 'stopped' ? (
          <View style={styles.centerStack} accessibilityLabel="recording-stopped" />
        ) : null}
      </View>

      {/* Transient toast. */}
      {toast.visible ? (
        <View style={styles.toast} accessibilityLabel="recording-toast">
          <Text variant="caption" style={styles.toastText}>
            {toast.text}
          </Text>
        </View>
      ) : null}

      <StopConfirmModal
        visible={state.substate === 'stop-confirm'}
        onKeepRecording={() => dispatch({ type: 'STOP_CONFIRM_CANCEL' })}
        onStop={() => handleStop('manual')}
      />
    </ScreenContainer>
  );
}

// --- §7h post-stop navigation helpers ---------------------------------------
// PracticeComplete lives in OnboardingStack (D-NAV-04); Recording is a sibling
// route on the same root native stack — and PracticeIntro.replace('Recording')
// pops OnboardingStack off the root stack on the way in, so PracticeComplete is
// not reachable by name from here. Rebuild the root stack with OnboardingStack
// focused on PracticeComplete (PracticeComplete's "Continue" then resets the
// root to MainTabs). The `getParent() ?? navigation` idiom matches the rest of
// the onboarding flow (PracticeCompleteScreen / RigTutorialScreen). Real-recording
// stop lands the user back on the Home tab (MainTabs).

function navigateToPracticeComplete(navigation: NavigationLike): void {
  const target = navigation.getParent?.() ?? navigation;
  if (target.reset) {
    target.reset({
      index: 0,
      routes: [
        {
          name: 'OnboardingStack',
          state: { index: 0, routes: [{ name: 'PracticeComplete' }] },
        },
      ],
    });
    return;
  }
  // Fallback for shallow nav stubs that lack `reset`.
  target.navigate('OnboardingStack', { screen: 'PracticeComplete' });
}

function navigateToHome(navigation: NavigationLike): void {
  const parent = navigation.getParent?.();
  if (parent?.navigate) {
    parent.navigate('MainTabs');
    return;
  }
  navigation.navigate('MainTabs');
}

const styles = StyleSheet.create({
  minuteBarTrack: { height: 3, width: '100%', backgroundColor: colors.recRingTrack },
  minuteBarFill: { height: 3, backgroundColor: colors.accent },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
  },
  taskName: { color: colors.recTextPrimary, flexShrink: 1, marginRight: spacing.m },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.recRingTrack,
  },
  overlayTip: {
    position: 'absolute',
    top: 88,
    alignSelf: 'center',
    backgroundColor: colors.recOverlayTip,
    borderRadius: radii.pill,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
  },
  overlayTipText: { color: colors.recTextCaption },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerStack: { alignItems: 'center', justifyContent: 'center', gap: spacing.l },
  // 'ready' substate only — pinned to the bottom of the screen over the live
  // preview (prototype `.rec-bottom` sits ~24px off the bottom; +a touch for
  // the gesture nav bar). `gap` matches the prototype's `.rec-btn-wrap` (14px).
  recordButtonBottom: {
    position: 'absolute',
    bottom: spacing.hh,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.mdl,
  },
  recordButton: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.coral },
  recordLabel: { color: colors.recTextPrimary },
  gatePrompt: {
    color: colors.recTextSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  skipLink: { paddingVertical: spacing.m, paddingHorizontal: spacing.l },
  skipLinkText: { color: colors.recSkipLink },
  timer: { color: colors.recTextPrimary },
  stopButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.recTextPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: { width: 22, height: 22, borderRadius: 4, backgroundColor: colors.coral },
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.recToastBg,
    borderRadius: radii.pill,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
    maxWidth: '90%',
  },
  toastText: { color: colors.recTextCaption, textAlign: 'center' },
});
