/**
 * GateRing — 130×130 hand-gate progress ring (design-spec §7c / §5.8,
 * engineering-handoff §3.2 `Ring.HandGate`).
 *
 * A FRESH component (per design-spec §5.8 — same SVG technique as
 * `CompatRing`, not a reuse): a translucent track circle + an accent fill
 * circle whose `strokeDashoffset` walks clockwise (`rotate(-90 …)`) toward
 * `CIRC·(1 − hits/target)`. The fill animates on a `hits` INCREASE; on a
 * `hits` DROP (a non-2-hand miss, HAND-04) the Animated value is set
 * DIRECTLY — instant snap-to-0, no `Animated.timing`.
 *
 * `loading` (gate.phase === 'loading'): the camera isn't ready yet — render a
 * spinner inside the ring well + the caption "Preparing camera…" below; the
 * ring sits at 0 (HAND-06 — the accumulator doesn't start until the first
 * frame is available).
 *
 * 6 px stroke (vs CompatRing's 8 px); track = `colors.recRingTrack`
 * (`rgba(255,255,255,.18)` — the dark-theme track). NO hex literals — every
 * color comes from `colors.*`.
 */
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '../../../ui/primitives/Text';
import { colors, motion } from '../../../ui/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 130;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2; // 62
const CIRC = 2 * Math.PI * RADIUS;

export interface GateRingProps {
  /** consecutive 2-hand hits accumulated so far. */
  hits: number;
  /** target hit count (5 Android / 3 iOS). */
  target: number;
  /** gate.phase === 'loading' — camera not ready yet. */
  loading: boolean;
}

export function GateRing({ hits, target, loading }: GateRingProps): React.JSX.Element {
  const clampedTarget = Math.max(1, target);
  const fraction = Math.min(1, Math.max(0, loading ? 0 : hits / clampedTarget));
  const offset = useRef(new Animated.Value(CIRC)).current;
  const prevHits = useRef(hits);

  useEffect(() => {
    const toValue = CIRC * (1 - fraction);
    if (hits < prevHits.current) {
      // Miss — instant snap to 0 progress (offset back to full CIRC). No
      // animation: HAND-04 wants the ring to vanish the moment a frame
      // reports ≠ 2 hands.
      offset.setValue(CIRC);
    } else {
      Animated.timing(offset, {
        toValue,
        duration: motion.compatRingStrokeMs,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        // SVG attribute animation cannot use the native driver.
        useNativeDriver: false,
      }).start();
    }
    prevHits.current = hits;
  }, [hits, fraction, offset]);

  return (
    <View
      style={styles.wrap}
      accessibilityLabel="gate-ring"
      accessibilityValue={{ now: loading ? 0 : hits, min: 0, max: clampedTarget }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.recRingTrack}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.accent}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={offset as unknown as number}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      {loading ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.recTextPrimary} accessibilityLabel="gate-ring-spinner" />
        </View>
      ) : null}
      {loading ? (
        <Text variant="caption" style={styles.loadingCaption}>
          Preparing camera…
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  loadingCaption: { position: 'absolute', bottom: -28, color: colors.recTextCaption },
});

export default GateRing;
