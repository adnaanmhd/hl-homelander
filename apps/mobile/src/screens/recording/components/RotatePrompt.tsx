/**
 * RotatePrompt — the `rotate-prompt` substate body (design-spec §7a,
 * engineering-handoff §4.3, prototype.html `#rotate-prompt`). Shown until the
 * device physically reports landscape (mounted on the rig).
 *
 * Centered: the portrait-phone glyph from prototype.html's `rotateAnimSVG()`
 * (a rounded-rect body with a camera dot, speaker slit, and a "screen content"
 * block) tipping a quarter-turn counter-clockwise to landscape and back, on the
 * prototype's exact `@keyframes rotatePhone` timeline (2.8 s ease-in-out:
 * hold portrait 0→18%, rotate to -90° 18→42%, hold landscape 42→72%, rotate
 * back 72→100%) — plus the verbatim label sourced from
 * `recording.rotatePrompt` in the i18n catalog (was hardcoded English until
 * the 07-11 sweep). Nothing else — the `__DEV__`-only "Pretend I rotated →"
 * bypass pill was removed (debug session handgate-never-passes, owner
 * directive: it let a take start without the device actually being in
 * landscape).
 *
 * The rotate-prompt → ready exit is the `RecordingScreen` device-orientation
 * effect (CR-01): a physical rotation to landscape (or the device already being
 * in landscape) dispatches LANDSCAPE_DETECTED. There is no longer any in-app
 * shortcut — you must turn the phone.
 *
 * `useNativeDriver: false` on the tilt: the native-driver transform was a no-op
 * on the Pixel 10a new-arch build (debug session handgate-never-passes —
 * "rotate animation absent" on-device); a JS-driven tween of one small SVG
 * costs nothing. The animation carries no logic; torn down with the component.
 *
 * NO hex literals — colors from `colors.*` (the prototype's `#FF6A2D` is
 * `colors.accent`; its translucent fills become `fillOpacity`).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../ui/primitives/Text';
import { colors, spacing } from '../../../ui/tokens';

// prototype.html @keyframes rotatePhone — 2.8 s, ease-in-out, 0°→-90°→0° with
// holds at the ends. Expressed as ms segments of the 2800 ms cycle:
//   0→18%  hold 0°        → 504 ms delay
//   18→42% rotate to -90° → 672 ms tween
//   42→72% hold -90°      → 840 ms delay
//   72→100% rotate to 0°  → 784 ms tween
const HOLD_PORTRAIT_MS = 504;
const TILT_TO_LANDSCAPE_MS = 672;
const HOLD_LANDSCAPE_MS = 840;
const TILT_BACK_MS = 784;

export function RotatePrompt(): React.JSX.Element {
  const { t } = useTranslation();
  // 0 → 1 → 0; mapped to 0° → -90° → 0° (a quarter-turn CCW tilt, repeating).
  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const tiltTo = (toValue: number, duration: number) =>
      Animated.timing(tilt, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false, // JS thread — native-driver transform was a no-op on-device
      });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(HOLD_PORTRAIT_MS),
        tiltTo(1, TILT_TO_LANDSCAPE_MS),
        Animated.delay(HOLD_LANDSCAPE_MS),
        tiltTo(0, TILT_BACK_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [tilt]);
  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] });

  return (
    <View style={styles.wrap} accessibilityLabel="rotate-prompt">
      <Animated.View style={{ transform: [{ rotate }] }}>
        {/* prototype.html rotateAnimSVG() — a portrait-phone outline. */}
        <Svg width={64} height={100} viewBox="0 0 64 100">
          <Rect
            x={3}
            y={3}
            width={58}
            height={94}
            rx={9}
            fill={colors.accent}
            fillOpacity={0.15}
            stroke={colors.accent}
            strokeWidth={2}
          />
          <Circle cx={32} cy={14} r={2} fill={colors.accent} />
          <Rect
            x={22}
            y={10}
            width={20}
            height={2.5}
            rx={1.25}
            fill={colors.accent}
            opacity={0.6}
          />
          <Rect
            x={14}
            y={74}
            width={36}
            height={20}
            rx={3}
            fill={colors.accent}
            fillOpacity={0.25}
          />
        </Svg>
      </Animated.View>
      {/* [07-11] Moved to i18n catalog under recording.rotatePrompt.
          G-26 (Plan 07-16): allow Devanagari + Bengali + Tamil + Telugu +
          Marathi to wrap to 2 lines + auto-shrink. RN-Text props only — no
          new design tokens; the recording-caption variant is untouched.
          G-26 (Plan 07-17): lowered `minimumFontScale` from 0.85 to 0.75 to
          handle the longest Devanagari/Indic rotate-prompt forms (operator
          2026-05-26 hi-IN walk: 0.85 floor still clipped). The wrap also
          gains paddingHorizontal so it has horizontal slack against the
          parent's flex constraints. */}
      <Text
        variant="caption"
        style={styles.body}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {t('recording.rotatePrompt')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.l,
    paddingHorizontal: spacing.l,
  },
  // Plan 07-17 re-walk 2026-05-27 (Bug C-2): `wrap.alignItems: 'center'`
  // makes the body Text content-hug horizontally, so the hi-IN value
  // "फ़ोन को घुमाकर लैंडस्केप करें और रिग पर लगाएँ" clipped to
  // "...रिग पर". `alignSelf: 'stretch'` overrides that and lets the Text
  // span the wrap's padded width, so the existing `numberOfLines={2} +
  // adjustsFontSizeToFit + minimumFontScale={0.75}` overflow guards on
  // the Text element can actually engage.
  body: {
    color: colors.recTextCaption,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});

export default RotatePrompt;
