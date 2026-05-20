// ModuleNavigator — top-level 2-module switcher: Capture | Quest.
//
// Capture wraps the existing MainTabs (Home / Tasks / History) unchanged.
// Quest is an independent screen tree starting from QuestScreen.
//
// Both modules are kept mounted at all times (display:'none' hides the
// inactive one) so navigation state inside MainTabs survives module switches.
//
// A pill switcher bar is absolutely-positioned at the top of the screen and
// handles its own status-bar inset. SafeAreaInsetsContext.Provider injects an
// adjusted `top` (= device insets.top + SWITCHER_BAR_HEIGHT) to all children
// so every screen's ScreenContainer automatically clears the switcher bar
// without needing any per-screen changes.

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import MainTabs from './MainTabs';
import QuestScreen from '../screens/quest/QuestScreen';
import { Pressable } from '../ui/primitives/Pressable';
import { Text } from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';

type Module = 'Capture' | 'Quest';
const MODULES: Module[] = ['Capture', 'Quest'];

const SWITCHER_BAR_HEIGHT = 44;

export default function ModuleNavigator() {
  const [active, setActive] = useState<Module>('Capture');
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaInsetsContext.Provider
      value={{
        top: insets.top + SWITCHER_BAR_HEIGHT,
        bottom: insets.bottom,
        left: insets.left,
        right: insets.right,
      }}
    >
      <View style={styles.root}>
        <View style={[styles.content, active !== 'Capture' && styles.hidden]}>
          <MainTabs />
        </View>

        <View style={[styles.content, active !== 'Quest' && styles.hidden]}>
          <QuestScreen />
        </View>

        {/* Switcher rendered last so it sits above content in the stacking order */}
        <View
          style={[
            styles.switcher,
            { paddingTop: insets.top, height: insets.top + SWITCHER_BAR_HEIGHT },
          ]}
        >
          {MODULES.map((mod) => {
            const focused = active === mod;
            return (
              <Pressable
                key={mod}
                accessibilityRole="tab"
                accessibilityLabel={`${mod} module`}
                accessibilityState={{ selected: focused }}
                onPress={() => setActive(mod)}
                style={[styles.pill, focused && styles.pillActive]}
              >
                <Text
                  variant="pillLabel"
                  style={{ color: focused ? colors.surface : colors.text2 }}
                >
                  {mod}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaInsetsContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  switcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.s,
    gap: spacing.s,
  },
  pill: {
    flex: 1,
    height: 30,
    borderRadius: radii.chipPill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  pillActive: {
    backgroundColor: colors.accent,
  },
});
