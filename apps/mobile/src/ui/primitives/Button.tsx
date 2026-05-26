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
import { View, type StyleProp, type ViewStyle } from 'react-native';
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
      <View>
        {/* G-22 (Plan 07-17): cross-cutting overflow guards on the internal
            Text. Every Button consumer (~30 call sites incl. ReportProblem
            Cancel + Submit) inherits these props — handles long Devanagari
            labels (`रद्द करें` etc.) by auto-shrinking down to 75% of the
            normal font size rather than truncating. Short en labels stay at
            full size; this is opt-in via the scale floor. */}
        <Text
          variant="btnLabel"
          style={{ color: v.fg }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default Button;
