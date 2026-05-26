/**
 * CompatRunningScreen — design-spec §4a/§4b.
 *
 * "Checking your phone" / "Takes around 30 secs" + 130×130 progress ring +
 * 7-row checklist with 22 px circular indicators.
 *
 * Lifecycle:
 *   1. On mount, kick off `runCompatCheck(onProgress)` (compatService) with a
 *      progress listener that drives row state and the percent ring from
 *      real probe lifecycle events instead of a fixed cosmetic timer.
 *      Probe order is encoder → imu → deviceCaps; each emits a `started` and
 *      a `completed` event. Rows transition from 'pending' → 'running' →
 *      'pass'/'fail' as their determining probe's data lands.
 *   2. On result resolve, `rowsFromResult` performs the authoritative final
 *      sweep, freezes the ring at 100 %, holds 400 ms for the ring transition,
 *      then navigation.replace to CompatPass / CompatFail.
 *   3. On probe rejection, route to CompatFail (the error path is rare; the
 *      detailed user-facing copy lives in 02-21 manual smoke runbook).
 *
 * Why per-probe events (not a fixed timer): the IMU probe runs for a LOCKED
 * 30 s sustained-sampling window per capture spec D-COMPAT-05. A fixed-cadence
 * cosmetic walk completes its sweep at ~5 s and parks on the integrity row,
 * misleading users into thinking "device integrity" is the long-pole. The
 * real long-pole is the IMU window; the row state and ring fill must reflect
 * that.
 *
 * NO hex literals — all colors come from `colors.*` tokens (design-spec
 * §0.1 / §0.2).
 *
 * Phase 2 plan 02-15 Task 3 (original); refactored in quick task 260510-002.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../ui/primitives/Text';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing } from '../../ui/tokens';
import { runCompatCheck, type CompatProgressEvent } from '../../services/compatService';
import { DISPLAY_ROWS, rowsFromResult, type DisplayRowKey } from './checks';
import { useAppStore } from '../../state/appStore';
import { CompatRing } from '../../components/CompatRing';
import type {
  EncoderProbeResult,
  ImuProbeResult,
  DeviceCapsResult,
} from '../../native/HumynCompat';

interface NavigationLike {
  replace(route: string): void;
}

type RowState = 'pending' | 'running' | 'pass' | 'fail';

// Percent-ring milestones tied to probe lifecycle.
const PERCENT_INITIAL = 0;
const PERCENT_ENCODER_STARTED = 5;
const PERCENT_ENCODER_COMPLETED = 15;
const PERCENT_IMU_COMPLETED = 90;
const PERCENT_DEVICE_CAPS_STARTED = 95;
const PERCENT_RESULT = 100;

// Animate 15 → 85 over the LOCKED 30 s IMU sustained-sampling window.
const IMU_DURATION_MS = 30_000;
const IMU_TICK_MS = 250;
const IMU_PERCENT_FLOOR = PERCENT_ENCODER_COMPLETED;
const IMU_PERCENT_CEILING = 85;

function initialRowStates(): Record<DisplayRowKey, RowState> {
  const out = {} as Record<DisplayRowKey, RowState>;
  for (const r of DISPLAY_ROWS) {
    out[r.key] = 'pending';
  }
  return out;
}

function glyphFor(s: RowState): string {
  switch (s) {
    case 'pass':
      return '✓';
    case 'fail':
      return '✕';
    case 'running':
      return '⋯';
    default:
      return '○';
  }
}

function indicatorStyle(s: RowState) {
  switch (s) {
    case 'pass':
      return { backgroundColor: colors.success };
    case 'fail':
      return { backgroundColor: colors.coral };
    case 'running':
      return { backgroundColor: colors.amber };
    default:
      return { backgroundColor: colors.line };
  }
}

interface AccumResults {
  encoder?: EncoderProbeResult;
  imu?: ImuProbeResult;
  caps?: DeviceCapsResult;
}

/**
 * Recompute row states from the probes that have completed so far. Mirrors
 * the row-collapse rules in `rowsFromResult` but tolerates partial state —
 * rows whose determining probes haven't completed stay 'running' (or
 * 'pending' until their probe started). The final result resolution still
 * runs `rowsFromResult` for the authoritative pass/fail snapshot.
 */
function deriveRowStates(
  prev: Record<DisplayRowKey, RowState>,
  accum: AccumResults,
): Record<DisplayRowKey, RowState> {
  const next = { ...prev };

  if (accum.imu) {
    const i = accum.imu;
    next.motionSensors = i.sustainedHz >= 100 || i.p99IntervalMs <= 12 ? 'pass' : 'fail';
    next.imu = i.sustainedHz >= 100 && i.p99IntervalMs <= 12 ? 'pass' : 'fail';
  }

  if (accum.caps) {
    const c = accum.caps;
    next.ultrawide = c.ultrawideDfovDeg >= 110 ? 'pass' : 'fail';
    const longEdge = Math.max(c.resolutionMax.w, c.resolutionMax.h);
    next.resolutionFps = longEdge >= 1920 && c.fpsMax >= 30 ? 'pass' : 'fail';
    next.mic = c.micSampleRateMax >= 48_000 ? 'pass' : 'fail';
    next.realtime = c.realtimeTimestampSource ? 'pass' : 'fail';
  }

  // Integrity needs BOTH encoder (b-frames + OIS + HDR) AND deviceCaps (root).
  if (accum.encoder && accum.caps) {
    const e = accum.encoder;
    const c = accum.caps;
    next.integrity = !c.rooted && !e.bFramePresent && e.oisOff && e.hdrSdrForced ? 'pass' : 'fail';
  }

  return next;
}

export default function CompatRunningScreen() {
  const navigation = useNavigation<NavigationLike>();
  const setCompatResult = useAppStore((s) => s.setCompatResult);
  const { t } = useTranslation();

  const [percent, setPercent] = useState(PERCENT_INITIAL);
  const [rowStates, setRowStates] = useState<Record<DisplayRowKey, RowState>>(initialRowStates);
  const cancelled = useRef(false);
  const accumResultsRef = useRef<AccumResults>({});
  const imuTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cancelled.current = false;
    accumResultsRef.current = {};

    const stopImuTick = () => {
      if (imuTickRef.current !== null) {
        clearInterval(imuTickRef.current);
        imuTickRef.current = null;
      }
    };

    const handleProgress = (event: CompatProgressEvent) => {
      if (cancelled.current) return;

      switch (event.phase) {
        case 'encoder': {
          if (event.status === 'started') {
            setPercent((p) => Math.max(p, PERCENT_ENCODER_STARTED));
            // Encoder is the first probe affecting integrity; show it as running.
            setRowStates((s) => ({ ...s, integrity: 'running' }));
          } else {
            accumResultsRef.current.encoder = event.result;
            setPercent((p) => Math.max(p, PERCENT_ENCODER_COMPLETED));
            // Integrity stays 'running' — still needs deviceCaps for root.
          }
          return;
        }
        case 'imu': {
          if (event.status === 'started') {
            setRowStates((s) => ({ ...s, motionSensors: 'running', imu: 'running' }));
            // Drive the ring smoothly across the 30 s IMU window.
            const start = Date.now();
            stopImuTick();
            imuTickRef.current = setInterval(() => {
              if (cancelled.current) {
                stopImuTick();
                return;
              }
              const elapsed = Date.now() - start;
              const fraction = Math.min(1, elapsed / IMU_DURATION_MS);
              const next = IMU_PERCENT_FLOOR + (IMU_PERCENT_CEILING - IMU_PERCENT_FLOOR) * fraction;
              setPercent((p) => Math.max(p, Math.round(next)));
              if (fraction >= 1) stopImuTick();
            }, IMU_TICK_MS);
          } else {
            stopImuTick();
            accumResultsRef.current.imu = event.result;
            setPercent((p) => Math.max(p, PERCENT_IMU_COMPLETED));
            setRowStates((s) => deriveRowStates(s, accumResultsRef.current));
          }
          return;
        }
        case 'deviceCaps': {
          if (event.status === 'started') {
            setPercent((p) => Math.max(p, PERCENT_DEVICE_CAPS_STARTED));
            setRowStates((s) => ({
              ...s,
              ultrawide: s.ultrawide === 'pending' ? 'running' : s.ultrawide,
              resolutionFps: s.resolutionFps === 'pending' ? 'running' : s.resolutionFps,
              mic: s.mic === 'pending' ? 'running' : s.mic,
              realtime: s.realtime === 'pending' ? 'running' : s.realtime,
            }));
          } else {
            accumResultsRef.current.caps = event.result;
            setRowStates((s) => deriveRowStates(s, accumResultsRef.current));
          }
          return;
        }
      }
    };

    runCompatCheck(handleProgress)
      .then((result) => {
        if (cancelled.current) return;
        stopImuTick();
        setPercent(PERCENT_RESULT);
        setCompatResult(result);
        // Final authoritative sweep — same logic that drives CompatPass/Fail.
        const display = rowsFromResult(result);
        const next = {} as Record<DisplayRowKey, RowState>;
        for (const r of display) {
          next[r.key] = r.pass ? 'pass' : 'fail';
        }
        setRowStates(next);
        // Brief 400 ms hold for the ring fill, then route.
        setTimeout(() => {
          if (cancelled.current) return;
          if (result.passed) {
            navigation.replace('CompatPass');
          } else {
            navigation.replace('CompatFail');
          }
        }, 400);
      })
      .catch(() => {
        if (cancelled.current) return;
        stopImuTick();
        // Defensive: route to Fail on probe error so the user sees the
        // recovery flow rather than a stalled screen.
        navigation.replace('CompatFail');
      });

    return () => {
      cancelled.current = true;
      stopImuTick();
    };
  }, [navigation, setCompatResult]);

  return (
    <ScreenContainer accessibilityLabel="CompatRunning screen" padding={spacing.h}>
      <View style={styles.ringWrap}>
        <CompatRing percent={percent} />
      </View>
      <Text variant="compatTitle" style={styles.title}>
        {t('compat.running.title')}
      </Text>
      <Text variant="caption" tone="secondary" style={styles.sub}>
        {t('compat.running.subtitle')}
      </Text>
      <View style={styles.checks}>
        {DISPLAY_ROWS.map((row) => (
          <View key={row.key} style={styles.row} accessibilityLabel={`compat-row-${row.key}`}>
            <View style={[styles.indicator, indicatorStyle(rowStates[row.key])]}>
              <Text variant="caption" style={styles.indicatorGlyph}>
                {glyphFor(rowStates[row.key])}
              </Text>
            </View>
            <Text variant="body" style={styles.label}>
              {t(row.labelKey)}
            </Text>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  ringWrap: { alignItems: 'center', marginTop: spacing.hh },
  title: { marginTop: spacing.xxxl, alignSelf: 'center' },
  sub: { marginTop: spacing.s, alignSelf: 'center' },
  checks: { marginTop: spacing.xxxl, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s },
  indicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  indicatorGlyph: { color: colors.surface },
  label: { color: colors.text },
});
