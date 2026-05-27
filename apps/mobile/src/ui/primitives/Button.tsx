/**
 * @doc Button primitive — implements design-spec §0.5 button variants.
 *
 * Variants:
 *   - primary  → text bg + surface label (high-emphasis CTA)
 *   - accent   → accent bg + surface label (orange brand CTA)
 *   - outline  → transparent bg + line border + text label (low-emphasis)
 *   - coral    → coral bg + surface label (destructive / cancel)
 *
 * Always full-width by default; pass `width` style to override. `disabled`
 * collapses opacity to 0.4 and suppresses onPress. accessibilityLabel is
 * required for screen-reader and testing-library-by-label assertions.
 */
import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../tokens';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'coral';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * Required for accessibility AND for testing-library `getByLabelText`
   * queries. Falls back to `label` if not supplied (so consumers don't need
   * to repeat themselves), but tests can still pass an explicit override.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

interface VariantStyles {
  bg: string;
  fg: string;
  borderColor?: string;
  borderWidth?: number;
}

const variantToStyles: Record<ButtonVariant, VariantStyles> = {
  primary: { bg: colors.text, fg: colors.surface },
  accent: { bg: colors.accent, fg: colors.surface },
  outline: {
    bg: colors.surface,
    fg: colors.text,
    borderColor: colors.line,
    borderWidth: 1,
  },
  coral: { bg: colors.coral, fg: colors.surface },
};

export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const v = variantToStyles[variant];
  const computed: ViewStyle = {
    backgroundColor: v.bg,
    borderRadius: radii.button,
    borderColor: v.borderColor,
    borderWidth: v.borderWidth,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    opacity: disabled ? 0.4 : 1,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={[computed, style]}
    >
      {/* G-22 (Plan 07-17, re-walk 2026-05-27): cross-cutting overflow
          guards on the internal Text. Every Button consumer (~30 call
          sites incl. ReportProblem Cancel + Submit) inherits these props.
          The 1st 07-17 attempt wrapped this Text in a `<View>` (no width)
          which defeated `adjustsFontSizeToFit` on Android — "मंज़ूरी दें"
          → "मंज़ूरी", "रिकॉर्डिंग शुरू करें" → "रिकॉर्डिंग शुरू", etc.
          The 2nd attempt (initial re-walk fix) replaced the View with
          `flex: 1` on the Text — but RN's default `flexDirection: 'column'`
          on the Pressable made `flex: 1` stretch the Text VERTICALLY
          (wrong axis) and on hi-IN the Continue button rendered with the
          label invisible. The current shape uses `width: '100%'` so the
          Text spans the Pressable's inner width regardless of flex axis,
          giving `adjustsFontSizeToFit` a finite width to engage against. */}
      <Text
        variant="btnLabel"
        style={{ color: v.fg, width: '100%', textAlign: 'center' }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default Button;
