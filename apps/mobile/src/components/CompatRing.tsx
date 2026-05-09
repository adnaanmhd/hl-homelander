/**
 * CompatRing — 130×130 stroke-dashoffset progress ring per design-spec §4
 * visual + §0.4 motion (350 ms standard ease curve).
 *
 * Phase 2 plan 02-15 Task 2.
 *
 * Design rationale:
 *   - SVG circle radius = (130 - 8 stroke) / 2 = 61 px
 *   - circumference  = 2π · 61 ≈ 383.27 px
 *   - strokeDashoffset = circumference · (1 - percent / 100)
 *   - 350 ms transition; cubic-bezier(.2, .8, .2, 1)
 *
 * NO Reanimated dependency at this seam — RN built-in `Animated` drives the
 * dashoffset. Reanimated worklets are pulled by VisionCamera in Phase 4 but
 * this seam doesn't need them, and skipping the dep keeps boot-time bundle
 * tighter.
 *
 * NO hex literals — every color comes from `colors.*` tokens (design-spec
 * §0.1).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '../ui/primitives/Text';
import { colors, motion } from '../ui/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 130;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2; // 61
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface CompatRingProps {
  /** 0..100 — values outside this range are clamped before rendering. */
  percent: number;
}

export function CompatRing({ percent }: CompatRingProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  useEffect(() => {
    Animated.timing(offset, {
      toValue: CIRCUMFERENCE * (1 - clamped / 100),
      duration: motion.compatRingStrokeMs,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      // SVG attribute animation cannot use the native driver; useNativeDriver
      // must be false here.
      useNativeDriver: false,
    }).start();
  }, [clamped, offset]);

  return (
    <View
      style={styles.wrap}
      accessibilityLabel="compat-ring"
      accessibilityValue={{ now: clamped, min: 0, max: 100 }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.line}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progress (rotated -90° so 0% sits at 12-o'clock) */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.accent}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset as unknown as number}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.percentWrap} pointerEvents="none">
        <Text variant="title28">{`${Math.round(clamped)}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  percentWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});

export default CompatRing;
