/**
 * RecordingScreen shell — substate-driven dark-theme chrome (engineering-handoff
 * §7 / §4.3 / design-spec §7).
 *
 * Plan 04-09 wires the live VisionCamera mount, the HAND-12 pre-warm, the
 * `useHandGate` poll loop, the gate-pass → active TTS-masked transition, the
 * `CaptureSessionOpts` construction, `useRecordingLifecycle`, the HAND-14
 * analytics, brightness restore (HumynScreenBrightness), orientation lock, and
 * post-stop routing. This shell ONLY renders the chrome for a given substate
 * so the visual baselines + the `Recording` route can land in Wave 3 — there
 * is no live camera, no lifecycle hook, no gate poll here.
 *
 * Each substate's chrome:
 *   rotate-prompt → <RotatePrompt /> (the __DEV__ "Pretend I rotated →" pill
 *                   dispatches LANDSCAPE_DETECTED)
 *   ready         → 88×88 coral record button + "Start Recording" label
 *                   (onPress → START_PRESSED; pre-flight→gate is plan 04-09)
 *   pre-flight    → spinner; auto-dispatches PRE_FLIGHT_OK after a tick so the
 *                   visual baseline can land on `gate` (the real thermal/storage/
 *                   battery checks are plan 04-09)
 *   gate          → <GateRing /> + the gate prompt + the "Skip" link (visible
 *                   from t=0, HAND-02). The <Camera> mount + the poll loop +
 *                   the gate-pass transition are plan 04-09.
 *   active        → 32px mono HH:MM:SS timer + the top 3px minute-bar + a
 *                   64×64 white stop button (22×22 coral square inside) +
 *                   <VoiceCuePill> + <AlertPill>
 *   stop-confirm  → the `active` chrome + <StopConfirmModal>
 *   stopped       → minimal (the post-stop toast routing is plan 04-09)
 *
 * Always rendered (above the substate switch): the top 3px full-width
 * minute-bar (only fills during `active`), the top-right 36px circular X
 * (`recording-close` — dispatches X_PRESSED when active, else `navigation.goBack()`),
 * the top-row task name, and the 3s "Don't exit while recording." overlay
 * (fades after 3s).
 *
 * `__test_initialState` escape hatch: the visual baselines + the render test
 * pass a complete `RecState` here so the screen can be exercised in each
 * substate deterministically. It's a render-only prop with no side effects;
 * production callers (PracticeIntro, the __DEV__ affordance) never pass it
 * (threat T-4.7-01).
 *
 * NO hex literals — colors from `colors.*`.
 */
import React, { useEffect, useReducer, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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

interface NavigationLike {
  goBack(): void;
  navigate(route: string): void;
}

interface RecordingRouteParams {
  taskId?: string;
  taskName?: string;
  isPractice?: boolean;
}

interface RecordingScreenProps {
  /** Visual-baseline / unit-test escape hatch — render-only, no side effects. */
  __test_initialState?: RecState;
}

const OVERLAY_TIP_MS = 3000;

/** Format a duration as HH:MM:SS. */
function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function RecordingScreen({ __test_initialState }: RecordingScreenProps = {}) {
  const navigation = useNavigation<NavigationLike>();
  const route = useRoute<{ key: string; name: string; params?: RecordingRouteParams }>();
  const params = route.params ?? {};
  const taskId = params.taskId ?? '__practice__';
  const taskName = params.taskName ?? 'Practice — 60 sec';
  const isPractice = params.isPractice ?? false;

  const [state, dispatch] = useReducer(
    recReducer,
    __test_initialState ?? initialRecState({ taskId, taskName, isPractice }),
  );

  // 3s "Don't exit while recording." overlay tip — fades out after 3s.
  const [tipVisible, setTipVisible] = useState(true);
  const tipOpacity = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(tipOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setTipVisible(false),
      );
    }, OVERLAY_TIP_MS);
    return () => clearTimeout(t);
  }, [tipOpacity]);

  // pre-flight is a transient placeholder in this shell — auto-advance to gate
  // so the chrome (and the visual baseline) can land on `gate`. The real
  // thermal/storage/battery start-guard is plan 04-09.
  useEffect(() => {
    if (state.substate !== 'pre-flight') return;
    const t = setTimeout(() => dispatch({ type: 'PRE_FLIGHT_OK', now: 0 }), 0);
    return () => clearTimeout(t);
  }, [state.substate]);

  const handleClose = () => {
    if (state.substate === 'active') {
      dispatch({ type: 'X_PRESSED' });
      return;
    }
    // Pre-record substates: silent dismiss (HAND-10 — no confirmation modal).
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
            {/* Skip link — visible from t=0 (HAND-02); hidden once the gate
                resolves (confirmed/skipped/bypassed) since it would be a no-op
                and plan 04-09 transitions to `active` from confirmed. */}
            {state.gate.phase !== 'confirmed' ? (
              <Pressable
                accessibilityLabel="recording-skip"
                onPress={() => dispatch({ type: 'GATE_SKIP', now: 0 })}
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
              onPress={() => dispatch({ type: 'STOP' })}
              style={styles.stopButton}
            >
              <View style={styles.stopSquare} />
            </Pressable>
            <VoiceCuePill text="Recording started" visible={false} />
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

      <StopConfirmModal
        visible={state.substate === 'stop-confirm'}
        onKeepRecording={() => dispatch({ type: 'STOP_CONFIRM_CANCEL' })}
        onStop={() => dispatch({ type: 'STOP_CONFIRM_STOP' })}
      />
    </ScreenContainer>
  );
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
  recordButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.coral,
  },
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
});
