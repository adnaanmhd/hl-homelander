/**
 * VoiceCuePill — center pill that duplicates the spoken voice cue on screen
 * (design-spec §7d / §19.2, REC-15). White-96% pill, dark text, centered;
 * auto-fades after `durationMs` (default 1800 ms — "Recording started" per
 * §7d). Rendering the cue text on-screen is the accessibility duplicate of
 * the TTS utterance.
 *
 * Fade-only (no slide) per engineering-handoff §3.2 `VoiceCue`. NO hex
 * literals — colors from `colors.*`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Text } from '../../../ui/primitives/Text';
import { colors, motion, radii, spacing } from '../../../ui/tokens';

export interface VoiceCuePillProps {
  text: string;
  visible: boolean;
  /** auto-fade delay in ms (default 1800 — design-spec §7d). */
  durationMs?: number;
}

const PILL_WIDTH = 260;

export function VoiceCuePill({
  text,
  visible,
  durationMs,
}: VoiceCuePillProps): React.JSX.Element | null {
  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.fadeInMs,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: motion.fadeInMs,
          useNativeDriver: true,
        }).start(() => setMounted(false));
      }, durationMs ?? 1800);
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: motion.fadeInMs,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [visible, durationMs, opacity]);

  if (!mounted) return null;
  return (
    <Animated.View style={[styles.pill, { opacity }]} accessibilityLabel="voice-cue-pill">
      <Text variant="pillLabel" style={styles.text}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    width: PILL_WIDTH,
    backgroundColor: colors.recVoiceCueBg,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.text, textAlign: 'center' },
});

export default VoiceCuePill;
