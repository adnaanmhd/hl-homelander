/**
 * @doc Field primitive — implements design-spec §0.5 form input + §6.x
 * onboarding form pattern.
 *
 * Composition: uppercase form label (typography.formLabel) → TextInput
 * (12 px input radius) → optional error line in coral. Forwards value /
 * onChangeText / placeholder / secureTextEntry / keyboardType. The
 * accessibility label auto-derives from the form label so screen
 * readers and getByLabelText queries find the input by the visible
 * caption.
 */
import React from 'react';
import {
  TextInput as RNTextInput,
  View,
  type StyleProp,
  type ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import { colors, radii, spacing, typography } from '../tokens';
import { Text } from './Text';

export interface FieldProps {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  /** Optional override; defaults to the visible label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType,
  accessibilityLabel,
  style,
}: FieldProps) {
  return (
    <View style={[{ width: '100%' }, style]}>
      <Text variant="formLabel" tone="secondary" style={{ marginBottom: spacing.m }}>
        {label}
      </Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        accessibilityLabel={accessibilityLabel ?? label}
        style={{
          borderWidth: 1,
          borderColor: error ? colors.coral : colors.line,
          borderRadius: radii.input,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: typography.body.fontSize,
          lineHeight: typography.body.lineHeight,
        }}
      />
      {error ? (
        <Text
          variant="caption"
          style={{ color: colors.coral, marginTop: spacing.s }}
          accessibilityLabel={`${label} error`}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default Field;
