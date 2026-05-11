// Confetti — design-spec §8 ("Confetti burst — 18 particles radiating from
// badge centre, random hues from accent palette, 800–1200 ms rise + rotate
// animation"). Used only by PracticeCompleteScreen.
//
// ~50 LOC, no new dependency — Reanimated 3.16.x (already pinned) + plain
// Animated.View particles. Each particle: a small 8×8 square (matches the
// prototype `.confetti { width:8px; height:8px; border-radius:1px }`), a
// deterministic per-index x-offset + hue (from a small warm palette around
// `--accent #FF6A2D` — the one sanctioned multi-hue / decorative use per
// 04-UI-SPEC § Color), rising 800–1200 ms with a fade-out + rotate.
//
// The rise/rotate/fade animations START in an effect (useEffect via
// useSharedValue + withTiming on mount) so the rendered tree at first paint
// is the static pre-animation frame — that keeps PracticeCompleteScreen's
// visual baseline deterministic (the snapshot is captured at render() time).
// Under jsdom, react-native-reanimated is mocked to identity functions, so
// this renders the static particle layout (animations are no-ops there).

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { confettiPalette } from '../../../ui/tokens';

const PARTICLE_COUNT = 18;

// Random hues "from the accent palette" — design-spec §8. The hex values
// live in tokens.ts (`confettiPalette`) so no hex literal leaks into a
// screen/component body (D-UI-01).
const ACCENT_PALETTE = confettiPalette;

const PARTICLE_SIZE = 8;
const RISE_MIN_MS = 800;
const RISE_MAX_MS = 1200;

interface ParticleSpec {
  hue: string;
  // deterministic per-index horizontal offset from badge centre (px)
  dx: number;
  // deterministic per-index rise duration in [800, 1200] ms
  durationMs: number;
  // deterministic per-index rise distance (px)
  riseBy: number;
}

// Deterministic pseudo-random in [0,1) from an integer seed — keeps the
// particle layout identical across runs (visual-baseline stability).
function seeded(n: number): number {
  const x = Math.sin(n * 99.137 + 12.345) * 43758.5453;
  return x - Math.floor(x);
}

const PARTICLES: ParticleSpec[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  hue: ACCENT_PALETTE[i % ACCENT_PALETTE.length]!,
  dx: Math.round((seeded(i + 1) - 0.5) * 220), // ±110 px spread
  durationMs: Math.round(RISE_MIN_MS + seeded(i + 7) * (RISE_MAX_MS - RISE_MIN_MS)),
  riseBy: Math.round(80 + seeded(i + 13) * 80), // 80–160 px rise
}));

function Particle({ spec }: { spec: ParticleSpec }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: spec.durationMs });
  }, [progress, spec.durationMs]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: spec.dx * progress.value },
      { translateY: -spec.riseBy * progress.value },
      { rotate: `${progress.value * 360}deg` },
    ],
  }));
  return <Animated.View style={[styles.particle, { backgroundColor: spec.hue }, animatedStyle]} />;
}

export function Confetti() {
  return (
    <View style={styles.layer} pointerEvents="none" accessibilityLabel="practice complete confetti">
      {PARTICLES.map((spec, i) => (
        <Particle key={i} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE,
    // prototype.html `.confetti { border-radius: 1px }`
    borderRadius: 1,
  },
});

export default Confetti;
