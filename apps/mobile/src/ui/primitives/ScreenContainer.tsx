/**
 * @doc ScreenContainer primitive — implements design-spec §0.5 screen frame.
 *
 * Every full-screen route wraps its content in `ScreenContainer` so the
 * canonical `colors.bg` background, default 20 px horizontal gutter, and
 * top/bottom safe-area respect (via react-native-safe-area-context) all
 * land in one place. Pass `padding` to override the gutter; pass
 * `noSafeArea` to opt out of insets (e.g., immersive recording surface).
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../tokens';

export interface ScreenContainerProps {
  children: React.ReactNode;
  /** Horizontal padding override; defaults to spacing.xl (20). */
  padding?: number;
  /** Skip safe-area insets (e.g., REC view that fills the entire screen). */
  noSafeArea?: boolean;
  /** Override the canonical bg color (e.g., REC view uses colors.recBg). */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ScreenContainer({
  children,
  padding = spacing.xl,
  noSafeArea = false,
  backgroundColor = colors.bg,
  style,
  accessibilityLabel,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const computed: ViewStyle = {
    flex: 1,
    backgroundColor,
    paddingTop: noSafeArea ? 0 : insets.top,
    paddingBottom: noSafeArea ? 0 : insets.bottom,
    paddingLeft: padding,
    paddingRight: padding,
  };
  return (
    <View accessibilityLabel={accessibilityLabel} style={[computed, style]}>
      {children}
    </View>
  );
}

export default ScreenContainer;
