/**
 * RecordingScreen — the live recording surface (engineering-handoff §7 / §4.3 /
 * design-spec §7). Plan 04-09 wires the live VisionCamera mount onto the plan-
 * 04-07 shell.
 *
 * What's live here:
 *   - the VisionCamera `<Camera>` mount (preview + `takePhoto()` ONLY — never
 *     the HEVC pipeline; that's HumynCapture) on the ultrawide lens, `isActive`
 *     only during the `gate` substate, `photoQualityBalance="speed"`,
 *     `onInitialized` → CAMERA_READY (gate.loading → waiting); the HAND-12
 *     throwaway pre-warm `takePhoto()` fires once after onInitialized
 *   - `useHandGate` poll loop (HAND-03/04/13 — takePhoto → cacheDir/hand-gate/
 *     {uuid}.jpg → HumynHandDetector.detectHands → GATE_HIT/GATE_MISS)
 *   - HAND-08 silent bypass (`isHandDetectorAvailable()===false` → GATE_BYPASS)
 *     / HAND-07 Skip (→ GATE_SKIP, no voice/haptic, brightness still drops)
 *   - the HAND-09 TTS-masked gate-pass → active transition (Vibration.vibrate(80)
 *     → speakCue('Recording started') → VoiceCue pill 1.8s → set(0.05) →
 *     setCameraActive(false) → SETTLE_MS → HumynCapture.start(buildCaptureOpts(...))
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
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraDevices,
  type CameraDevice,
} from 'react-native-vision-camera';
import Orientation, { type OrientationType } from 'react-native-orientation-locker';
import RNFS from 'react-native-fs';
import { Text } from '../../ui/primitives/Text';
import { Icon } from '../../ui/primitives/Icon';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing } from '../../ui/tokens';
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
//  was mean 0.594 ms / p99 0.728 ms; if HumynCapture.start() stalls because VC
//  hasn't fully released Camera2, bump this — or escalate a "HC.start() polls
//  for camera availability" change to Phase 3. (T-4.9-01 / Pitfall 1.)]
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

  // --- camera: the compat-chosen ultrawide lens -----------------------------
  const camRef = useRef<Camera | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  // useCameraDevice is a hook — call it unconditionally. There is no stored
  // cameraId in compat.lastResult (D-COMPAT-05 only persists measuredDeg), so
  // the physicalDevices filter is the lens selector (Open Q 1 / Assumption A2).
  const fallbackDevice = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle-camera'],
  });
  const devices = useCameraDevices();
  const ultrawide = useMemo<CameraDevice | undefined>(() => {
    const back = (devices ?? []).find(
      (d) => d.position === 'back' && d.physicalDevices?.includes('ultra-wide-angle-camera'),
    );
    return back ?? fallbackDevice ?? undefined;
  }, [devices, fallbackDevice]);

  // --- gate config (HAND-11 — RemoteConfig, defaulted-then-updated) ---------
  const [gateCfg, setGateCfg] = useState<GateConfig>(GATE_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    readGateConfig().then((cfg) => {
      if (!cancelled) setGateCfg(cfg);
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
    };
  }, []);

  // ===========================================================================
  // CR-01 — the PRODUCTION rotate-prompt → ready path. Without this the
  // recording surface is a dead-end in any non-__DEV__ build: initialRecState()
  // always starts at 'rotate-prompt' and the only other production exit (the
  // RotatePrompt "Pretend I rotated →" pill) is __DEV__-only and dead-code-
  // eliminated in release. Use the device-orientation (PHYSICAL) listener so it
  // works regardless of the landscape lock, plus a fire-once read for the
  // device-already-in-landscape-on-mount case. The reducer's LANDSCAPE_DETECTED
  // case no-ops outside 'rotate-prompt' and this effect tears down once substate
  // changes, so a late listener fire is harmless either way (T-4.11-03).
  // ===========================================================================
  useEffect(() => {
    if (state.substate !== 'rotate-prompt') return;
    const onOrient = (o: OrientationType) => {
      if (o === 'LANDSCAPE-LEFT' || o === 'LANDSCAPE-RIGHT') {
        dispatch({ type: 'LANDSCAPE_DETECTED' });
      }
    };
    Orientation.getDeviceOrientation((o) => onOrient(o as OrientationType));
    Orientation.addDeviceOrientationListener(onOrient);
    return () => Orientation.removeDeviceOrientationListener(onOrient);
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
      await HumynCapture.stop().catch(() => undefined);
      await HumynScreenBrightness.set(-1).catch(() => undefined);
      Orientation.unlockAllOrientations();
      if (practice) {
        logEvent('recording_stopped');
        speakCue('Recording stopped');
        navigateToPracticeComplete(navigation);
        return;
      }
      if (durationMs >= 60_000) {
        logEvent('recording_stopped');
        speakCue('Recording stopped');
        showToast(`${formatContributionDuration(durationMs)} added to your contribution.`);
        navigateToHome(navigation);
        return;
      }
      // Real recording under 1 minute — discarded (HumynCapture owns the file
      // deletion at finalize per REC-07 / 03-CONTEXT D-FS-*; the screen only
      // shows the toast + returns to ready for a fresh attempt — REC-05).
      logEvent('recording_too_short');
      showToast('Recording too short — discarded.');
      handlingStopRef.current = false;
      dispatch({ type: 'RESET_FOR_FRESH' });
    },
    [navigation, showToast],
  );

  const { checkStartGuards } = useRecordingLifecycle({
    substate: state.substate,
    isPractice,
    durationMs: state.durationMs,
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
  // gate enter — analytics + HAND-08 silent bypass.
  // ===========================================================================
  const gateEnteredRef = useRef(false);
  useEffect(() => {
    if (state.substate !== 'gate') {
      gateEnteredRef.current = false;
      return;
    }
    if (gateEnteredRef.current) return;
    gateEnteredRef.current = true;
    logEvent('recording_gate_started', { locale: deviceLocale() });
    // HAND-08 — no native hand-gate → silent bypass (same UX as Skip). Only
    // fires on the natural entry phase ('loading'); a screen rendered directly
    // into a later phase (the __test_initialState escape hatch, or a hot-reload)
    // is past this gate already.
    if (state.gate.phase === 'loading' && !isHandDetectorAvailable()) {
      logEvent('recording_gate_bypassed', { locale: deviceLocale() });
      dispatch({ type: 'GATE_BYPASS', now: nowMs() });
    }
    setCameraActive(true);
  }, [state.substate]);

  // onInitialized → CAMERA_READY (gate.loading → waiting) + the HAND-12 pre-warm.
  const onCameraInitialized = useCallback(() => {
    dispatch({ type: 'CAMERA_READY' });
    // HAND-12 — fire a single throwaway takePhoto() to pre-warm the photo
    // pipeline so the first real gate-poll capture isn't slow (Pitfall 9).
    const cam = camRef.current as unknown as {
      takePhoto?: (o: { flash: 'off'; enableShutterSound: boolean }) => Promise<{ path: string }>;
    } | null;
    cam
      ?.takePhoto?.({ flash: 'off', enableShutterSound: false })
      .then((p) => {
        if (p?.path) RNFS.unlink(p.path).catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  // The gate poll loop — only while gate.waiting.
  useHandGate({
    active: state.substate === 'gate' && state.gate.phase === 'waiting',
    cadenceMs: state.gate.cadenceMs,
    minConfidence: gateCfg.minHandDetectionConfidence,
    camRef: camRef as unknown as React.RefObject<{
      takePhoto(opts: { flash: 'off'; enableShutterSound: boolean }): Promise<{ path: string }>;
    } | null>,
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

    let cancelled = false;
    const run = async (): Promise<void> => {
      const passed = !state.gate.skipped && !state.gate.bypassed;
      if (passed) {
        Vibration.vibrate(80);
        showVoiceCue('Recording started');
        logEvent('recording_gate_passed', { locale: deviceLocale() });
        logEvent('recording_started');
      }
      // For ALL exit kinds (passed/skipped/bypassed): drop brightness, release
      // the VC camera, settle, then start HumynCapture (REC-08 / HAND-07/09).
      await HumynScreenBrightness.set(0.05).catch(() => undefined);
      setCameraActive(false);
      await new Promise<void>((r) => setTimeout(r, SETTLE_MS));
      if (cancelled) return;
      const gateDurationMs = (state.gate.confirmedAt ?? 0) - (state.gate.startedAt ?? 0);
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
        if (cancelled) return;
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
  // X button — stop-confirm while active; silent goBack pre-record (HAND-10).
  // ===========================================================================
  const handleClose = () => {
    if (state.substate === 'active') {
      dispatch({ type: 'X_PRESSED' });
      return;
    }
    // Pre-record substates: silent dismiss, no confirmation, no data to discard.
    HumynScreenBrightness.set(-1).catch(() => undefined);
    Orientation.unlockAllOrientations();
    navigation.goBack();
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
      {/* Live camera mount — preview + takePhoto() only, NEVER the HEVC
          pipeline. isActive only during the gate substate (releases Camera2
          before HumynCapture.start opens it — T-4.9-06). photoQualityBalance
          "speed" keeps the gate JPEG small (Pitfall 10). */}
      {ultrawide && state.substate === 'gate' && cameraActive ? (
        <Camera
          ref={camRef}
          device={ultrawide}
          isActive={cameraActive}
          photo
          photoQualityBalance="speed"
          onInitialized={onCameraInitialized}
          style={StyleSheet.absoluteFill}
        />
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

      {/* Substate-driven chrome. */}
      <View style={styles.body}>
        {state.substate === 'rotate-prompt' ? (
          <RotatePrompt onPretendRotated={() => dispatch({ type: 'LANDSCAPE_DETECTED' })} />
        ) : null}

        {state.substate === 'ready' ? (
          <View style={styles.centerStack}>
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
// PracticeComplete lives in OnboardingStack (D-NAV-04); the Recording route is
// a RootNativeStack sibling — so we hop via the parent navigator. Real-recording
// stop lands the user back on the Home tab (MainTabs).

function navigateToPracticeComplete(navigation: NavigationLike): void {
  const parent = navigation.getParent?.();
  if (parent?.reset) {
    parent.reset({
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
  if (parent?.navigate) {
    parent.navigate('PracticeComplete');
    return;
  }
  if (navigation.replace) navigation.replace('PracticeComplete');
  else navigation.navigate('PracticeComplete');
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
    borderRadius: 999,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
  },
  overlayTipText: { color: colors.recTextCaption },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerStack: { alignItems: 'center', justifyContent: 'center', gap: spacing.l },
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
    borderRadius: 999,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
    maxWidth: '90%',
  },
  toastText: { color: colors.recTextCaption, textAlign: 'center' },
});
