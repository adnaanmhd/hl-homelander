/**
 * @doc Text primitive — implements design-spec §0.2 typography variants.
 *
 * Variant prop selects a typed entry from `typography` tokens (title28,
 * body, caption, btnLabel, sheetTitle, pitch, ...). Tone prop maps to
 * `colors.text` / `text2` / `text3` for primary/secondary/tertiary
 * grayscale text. Wraps RN Text and forwards accessibility props.
 *
 * Defaults: variant='body', tone='primary'. No hex literals — every value
 * comes from ../tokens.
 */
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, typography, type TypographyVariant } from '../tokens';

export type TextTone = 'primary' | 'secondary' | 'tertiary';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
}

const toneToColor: Record<TextTone, string> = {
  primary: colors.text,
  secondary: colors.text2,
  tertiary: colors.text3,
};

// Android ignores `fontWeight` once a custom `fontFamily` is set unless
// the OS happens to find a matching weighted variant under that name. Map
// each variant's numeric weight to the specific RethinkSans file we
// bundled (apps/mobile/assets/fonts/) so weight is preserved on every
// platform without relying on weight-aware font dispatch.
//
// Plan 03-02 diagnosis (Pattern 67 — RethinkSans on-device dispatch):
// Verified TTF post-script names via `fc-query -f "%{postscriptname}"`:
//   RethinkSans-Regular.ttf  → "RethinkSans-Regular"
//   RethinkSans-Medium.ttf   → "RethinkSans-Medium"
//   RethinkSans-SemiBold.ttf → "RethinkSans-SemiBold"
//   RethinkSans-Bold.ttf     → "RethinkSans-Bold"
//   RethinkSans-ExtraBold.ttf→ "RethinkSans-ExtraBold"
// Each post-script name matches the file basename (extension dropped) AND
// matches the `typography.fontFamily.*` token values (no `.ttf` suffix in
// either side). This is correct for both:
//   (a) Android's RCTFont dispatcher (RN's New Arch resolves a font asset
//       under `assets/fonts/` by exact basename — extension-stripped);
//   (b) iOS UIFont (resolves by post-script name).
// The font assets ARE bundled into the APK (verified via `unzip -l ...apk
// | grep RethinkSans` — 5 TTFs land at assets/fonts/). `react-native-asset`
// link is current (re-running it modifies nothing).
//
// If on-device rendering still falls back to system Roboto, the remaining
// candidates are:
//   1. A consumer that overrides `fontFamily` in its own `style` prop
//      (this primitive's cascade ends with the user `style`, so user
//      overrides win — verified one consumer at markdown.tsx uses
//      `typography.fontFamily.mono` deliberately for code blocks).
//   2. A consumer that re-introduces `fontWeight` AFTER `<Text>` (would
//      trigger the same Roboto fallback this primitive guards against).
//      Mitigation below: strip user-supplied `fontWeight` from the final
//      style cascade so even a leaky consumer can't break dispatch.
//   3. Hermes-side font registration timing — the Hermes engine loads JS
//      before the React Native bridge populates the asset font registry
//      on a slow cold start. Defense: this primitive is purely
//      declarative; the registry is populated long before the first
//      `<Text>` mounts inside any screen body (post-Splash gate).
function fontFamilyForWeight(weight: string | undefined): string {
  switch (weight) {
    case '500':
      return typography.fontFamily.medium;
    case '600':
      return typography.fontFamily.semibold;
    case '700':
      return typography.fontFamily.bold;
    case '800':
    case '900':
      return typography.fontFamily.extrabold;
    case '400':
    case '300':
    default:
      return typography.fontFamily.regular;
  }
}

/**
 * Strip `fontWeight` (and a few other dispatcher-confusing keys) from any
 * style entry in a flat or nested style array. The Text primitive's
 * cascade puts the user-supplied `style` last, which means a leaky
 * consumer can re-introduce `fontWeight` and force the Android dispatcher
 * to fall back to Roboto. Sanitizing here makes the dispatch bulletproof.
 *
 * Note: leaves `fontFamily` untouched in user-supplied entries — some
 * consumers (markdown.tsx code blocks) deliberately swap to the mono
 * family. Only `fontWeight` is stripped because we encode weight via
 * fontFamily here.
 */
function stripFontWeight<T>(style: T): T {
  if (style == null || (style as unknown) === false) return style;
  if (Array.isArray(style)) {
    return style.map((entry) => stripFontWeight(entry)) as unknown as T;
  }
  if (typeof style === 'object') {
    const { fontWeight: _omit, ...rest } = style as { fontWeight?: unknown } & Record<
      string,
      unknown
    >;
    return rest as unknown as T;
  }
  return style;
}

export function Text({
  variant = 'body',
  tone = 'primary',
  style,
  accessibilityLabel,
  accessibilityRole,
  children,
  ...rest
}: TextProps) {
  const variantStyle = typography[variant];
  const fontFamily = fontFamilyForWeight((variantStyle as { fontWeight?: string }).fontWeight);
  // Strip fontWeight from the variant style — Android's font dispatcher
  // picks a file by exact `fontFamily` match; passing `fontWeight: '700'`
  // alongside `fontFamily: 'RethinkSans-Bold'` makes it look for an
  // "auto-weighted" variant of that family and silently falls back to
  // the system default when it can't find one. Weight is already encoded
  // in the file name we picked.
  const { fontWeight: _omit, ...weightless } = variantStyle as {
    fontWeight?: string;
  } & Record<string, unknown>;
  return (
    <RNText
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[weightless, { fontFamily, color: toneToColor[tone] }, stripFontWeight(style)]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export default Text;
