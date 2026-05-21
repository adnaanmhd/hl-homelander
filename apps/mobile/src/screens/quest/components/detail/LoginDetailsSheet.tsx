import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Sheet } from '../../../../ui/primitives/Sheet';
import { Pressable } from '../../../../ui/primitives/Pressable';
import { Text } from '../../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../../ui/tokens';
import type { QuestDetail } from '../../types';

interface Props {
  visible: boolean;
  quest: QuestDetail;
  onDismiss: () => void;
  onSubmit: (loginType: string, loginValue: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function LoginDetailsSheet({
  visible,
  quest,
  onDismiss,
  onSubmit,
  isSubmitting,
}: Props) {
  const methods = quest.loginMethods ?? Object.keys(quest.loginMethodsWithTitle ?? {});
  const [loginType, setLoginType] = useState(methods[0] ?? 'User Name');
  const [loginValue, setLoginValue] = useState('');

  const handleSubmit = async () => {
    if (!loginValue.trim()) return;
    await onSubmit(loginType, loginValue.trim());
    setLoginValue('');
    onDismiss();
  };

  return (
    <Sheet visible={visible} onDismiss={onDismiss} accessibilityLabel="Login details">
      <Text variant="sheetTitle" style={{ color: colors.text, marginBottom: spacing.m }}>
        {quest.loginDetailsStage?.title ?? 'Login details'}
      </Text>

      {methods.length > 1 && (
        <View style={styles.methodRow}>
          {methods.map((m) => (
            <Pressable
              key={m}
              onPress={() => setLoginType(m)}
              style={[styles.methodChip, loginType === m && styles.methodChipActive]}
            >
              <Text
                variant="taskCardDesc"
                style={{ color: loginType === m ? colors.surface : colors.text2 }}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={loginValue}
        onChangeText={setLoginValue}
        placeholder={`Enter ${loginType}`}
        placeholderTextColor={colors.text3}
        style={styles.input}
        autoCapitalize="none"
      />

      <Pressable
        accessibilityLabel="Submit login"
        onPress={handleSubmit}
        disabled={isSubmitting || !loginValue.trim()}
        style={[styles.btn, (isSubmitting || !loginValue.trim()) && styles.btnDisabled]}
      >
        <Text variant="pillLabel" style={{ color: colors.surface }}>
          {isSubmitting ? 'SUBMITTING…' : 'SUBMIT'}
        </Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.m },
  methodChip: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  methodChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.chip,
    padding: spacing.m,
    color: colors.text,
    marginBottom: spacing.l,
    fontSize: 16,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.chip,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
});
