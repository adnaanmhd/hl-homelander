import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/primitives/Pressable';
import { Text } from '../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../ui/tokens';
import type { FilterType } from '../types';

const { width } = Dimensions.get('window');
const TAB_W = (width - spacing.l * 2) / 4;

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'Live', value: 'Live' },
  { label: 'All', value: 'All' },
  { label: 'Upcoming', value: 'Upcoming' },
  { label: 'Ended', value: 'Ended' },
];

interface Props {
  selected: FilterType;
  onChange: (f: FilterType) => void;
  disabled?: boolean;
}

export default function FilterTabs({ selected, onChange, disabled }: Props) {
  return (
    <View style={styles.container}>
      {FILTERS.map((item) => {
        const active = item.value === selected;
        return (
          <Pressable
            key={item.value}
            accessibilityLabel={`Filter ${item.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            disabled={disabled}
            onPress={() => onChange(item.value)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text variant="caption" style={{ color: active ? colors.surface : colors.text2 }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.chip,
    height: 34,
    overflow: 'hidden',
    marginTop: spacing.l,
    marginBottom: spacing.m,
  },
  tab: {
    width: TAB_W,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
});
