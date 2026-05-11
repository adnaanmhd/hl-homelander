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
// Plan 03-02 — direct lucide-react-native imports for the bottom-nav
// tabs. The Icon primitive (apps/mobile/src/ui/primitives/Icon.tsx)
// indexes lucide-react-native by string name; the direct import keeps
// the BottomNav grep-discoverable per
// 02-COSMETIC-GAPS.md "Bottom-nav: no icons + size too small" follow-up
// (the rendered icons + size were correct, but the literal lucide import
// surface here makes future regressions cheaper to catch in PR review).
import { Home as HomeIcon, ListTodo, History as HistoryIcon } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
// Plan 03-11 (A3) — useSafeAreaInsets() lifts the BottomNav above the
// device gesture indicator (Instagram-style float) instead of touching
// the bottom edge. Inset handling is per-device — Pixel-class shows
// ~24 dp gesture-bar inset, so the row floats with insets.bottom + 12 dp.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '../ui/primitives/Pressable';
import { Text } from '../ui/primitives/Text';
import { colors, spacing, typography } from '../ui/tokens';

interface TabSpec {
  key: 'Home' | 'Tasks' | 'History';
  label: string;
  Icon: LucideIcon;
  accessibilityLabel: string;
}

const TABS: ReadonlyArray<TabSpec> = [
  { key: 'Home', label: 'Home', Icon: HomeIcon, accessibilityLabel: 'Home tab' },
  { key: 'Tasks', label: 'Tasks', Icon: ListTodo, accessibilityLabel: 'Tasks tab' },
  { key: 'History', label: 'History', Icon: HistoryIcon, accessibilityLabel: 'History tab' },
];

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityLabel="Bottom navigation"
      // Plan 03-11 (A3) — height + paddingBottom inflate by insets.bottom so
      // the nav row floats above the gesture indicator while preserving the
      // 68 dp content height. The +12 lift sits at the upper end of the A3
      // 8–12 dp recommendation (most legible separation against the bar).
      style={{
        height: 68 + insets.bottom,
        paddingBottom: insets.bottom + 12,
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
        const TabIcon = tab.Icon;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityState={{ selected: focused }}
            // Plan 03-02 — explicit ≥48 dp touch target via minHeight +
            // minWidth + hitSlop. Satisfies WCAG 2.1 AA pointer-target
            // size (and Android Material spec). The flex:1 distribution
            // already gives ~50 dp on a Pixel-class device but a
            // future bottomNav height shrink would silently break the
            // target — the explicit minHeight is a regression guard
            // (02-COSMETIC-GAPS.md "touch targets feel undersized").
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
              minHeight: 48,
              minWidth: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TabIcon size={24} color={tint} strokeWidth={focused ? 2.25 : 1.75} />
            <Text
              variant="tabLabel"
              style={{
                color: tint,
                marginTop: 2,
                ...typography.tabLabel,
                // WR-14 fix — WCAG 2.1 SC 1.4.1 (Use of Color) requires that
                // color is not the only visual means of conveying state.
                // The active/inactive distinction was previously color +
                // strokeWidth (2.25 vs 1.75), both at the threshold of
                // perceptibility on a small icon for users with color-vision
                // deficiency. Bold weight on the active label adds a
                // non-color cue that satisfies the SC.
                fontWeight: focused ? '700' : '400',
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default BottomNav;
