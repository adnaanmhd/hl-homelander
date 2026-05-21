import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { Pressable } from '../../../../ui/primitives/Pressable';
import { colors, spacing } from '../../../../ui/tokens';

interface Props {
  onShare: () => void;
}

export default function QuestDetailHeader({ onShare }: Props) {
  const navigation = useNavigation();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Go back"
        onPress={() => navigation.goBack()}
        style={styles.iconBtn}
      >
        <ChevronLeft size={22} color={colors.text} />
      </Pressable>
      <Pressable accessibilityLabel="Share quest" onPress={onShare} style={styles.iconBtn}>
        <Share2 size={20} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
});
