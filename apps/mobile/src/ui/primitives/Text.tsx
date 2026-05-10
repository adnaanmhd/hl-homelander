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
  // Strip fontWeight from the cascade — Android's font dispatcher picks
  // a file by exact `fontFamily` match; passing `fontWeight: '700'`
  // alongside `fontFamily: 'RethinkSans-Bold'` makes it look for an
  // "auto-weighted" variant of that family and silently falls back to
  // the system default when it can't find one. The weight is already
  // encoded in the file name we picked.
  const { fontWeight: _omit, ...weightless } = variantStyle as {
    fontWeight?: string;
  } & Record<string, unknown>;
  return (
    <RNText
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[weightless, { fontFamily, color: toneToColor[tone] }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export default Text;
