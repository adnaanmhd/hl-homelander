/**
 * @doc Pressable primitive — implements design-spec §0.4 (motion.pressScale)
 * + §0.5 universal pressable contract.
 *
 * Thin wrapper over RN Pressable that applies the canonical press transform
 * (scale 0.98) on press and defaults `accessibilityRole="button"` so
 * testing-library's getByRole('button') queries work without each consumer
 * setting it. Forwards every other RN Pressable prop.
 */
import React from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { motion } from '../tokens';

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

export function Pressable({
  style,
  accessibilityRole = 'button',
  accessibilityLabel,
  children,
  ...rest
}: PressableProps) {
  return (
    <RNPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        style,
        pressed ? { transform: [{ scale: motion.pressScale }] } : null,
      ]}
      {...rest}
    >
      {children as React.ReactNode}
    </RNPressable>
  );
}

export default Pressable;
