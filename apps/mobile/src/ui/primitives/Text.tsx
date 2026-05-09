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
  return (
    <RNText
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[variantStyle, { color: toneToColor[tone] }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export default Text;
