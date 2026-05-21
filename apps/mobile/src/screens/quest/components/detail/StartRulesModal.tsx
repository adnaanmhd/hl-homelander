import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Modal } from '../../../../ui/primitives/Modal';
import { Pressable } from '../../../../ui/primitives/Pressable';
import { Text } from '../../../../ui/primitives/Text';
import { colors, spacing } from '../../../../ui/tokens';
import type { QuestDetail } from '../../types';

interface Props {
  visible: boolean;
  quest: QuestDetail;
  onDismiss: () => void;
  onAgree: () => void;
}

export default function StartRulesModal({ visible, quest, onDismiss, onAgree }: Props) {
  const rules = quest.rules?.points ?? [];
  const notes = quest.notes?.points ?? [];

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      title={quest.rules?.title ?? 'Quest rules'}
      actions={
        <View style={styles.actions}>
          <Pressable onPress={onDismiss} style={styles.secondaryBtn}>
            <Text variant="pillLabel" style={{ color: colors.text2 }}>
              CANCEL
            </Text>
          </Pressable>
          <Pressable onPress={onAgree} style={styles.primaryBtn}>
            <Text variant="pillLabel" style={{ color: colors.surface }}>
              AGREE & START
            </Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView style={{ maxHeight: 280 }}>
        {rules.map((point, i) => (
          <Text key={`r-${i}`} variant="body" tone="secondary" style={{ marginBottom: spacing.s }}>
            • {point}
          </Text>
        ))}
        {notes.length > 0 && (
          <>
            <Text variant="eyebrow" tone="tertiary" style={{ marginTop: spacing.m }}>
              {quest.notes?.title ?? 'Notes'}
            </Text>
            {notes.map((point, i) => (
              <Text
                key={`n-${i}`}
                variant="body"
                tone="secondary"
                style={{ marginBottom: spacing.s }}
              >
                • {point}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.m },
  secondaryBtn: { flex: 1, paddingVertical: spacing.ms, alignItems: 'center' },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
});
