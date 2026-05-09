// BottomNav — custom tabBar callback for createBottomTabNavigator.
//
// 68 px height + 10 px bottom inset baseline (real safe-area insets handled
// by the underlying screen). White background (rgba(255,255,255,.92) is
// post-MVP — backdrop blur is iOS-only and we're shipping Android-first).
// 1 px top hairline border in colors.line.
//
// Three tabs only — Home / Tasks / History — satisfying HOME-07 STRUCTURALLY
// because this component renders exactly three Pressables, never more. Active
// uses colors.accent + filled icon; inactive uses colors.text2 + outlined.
// Each tab is a Pressable with accessibilityRole="tab" + an
// accessibilityLabel of "{Name} tab" so navigation tests can find them.

import React from 'react';
import { View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable } from '../ui/primitives/Pressable';
import { Text } from '../ui/primitives/Text';
import { Icon, type IconName } from '../ui/primitives/Icon';
import { colors, spacing, typography } from '../ui/tokens';

interface TabSpec {
  key: 'Home' | 'Tasks' | 'History';
  label: string;
  icon: IconName;
  accessibilityLabel: string;
}

const TABS: ReadonlyArray<TabSpec> = [
  { key: 'Home', label: 'Home', icon: 'Home', accessibilityLabel: 'Home tab' },
  { key: 'Tasks', label: 'Tasks', icon: 'ListTodo', accessibilityLabel: 'Tasks tab' },
  { key: 'History', label: 'History', icon: 'History', accessibilityLabel: 'History tab' },
];

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  return (
    <View
      accessibilityLabel="Bottom navigation"
      style={{
        height: 68,
        paddingBottom: 10,
        paddingTop: spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {TABS.map((tab, index) => {
        const focused = state.index === index;
        const tint = focused ? colors.accent : colors.text2;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const routeName = state.routes[index]?.name ?? tab.key;
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[index]?.key ?? tab.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(routeName);
              }
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={tab.icon} size={24} color={tint} strokeWidth={focused ? 2.25 : 1.75} />
            <Text variant="tabLabel" style={{ color: tint, marginTop: 2, ...typography.tabLabel }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default BottomNav;
