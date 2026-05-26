// MainTabs — bottom-tab navigator with EXACTLY 3 tabs (Home / Tasks / History).
//
// HOME-07 satisfied STRUCTURALLY: only three tab screens are registered
// below. Profile is NOT a tab — it lives at the RootNativeStack level so it
// renders WITHOUT the bottom tab bar (HOME-08 structural suppression).
//
// `headerShown: false` because every tab body owns its own TopBar (so the
// avatar tap target lives where the user expects it, in the screen chrome
// not the navigator chrome).
//
// Phase 6 Wave 5 (Plan 06-09) — atomic 3-tab swap. Plans 06-07 and 06-08
// each shipped a real Home/Tasks screen but deferred their MainTabs swap
// to this plan to avoid same-wave file conflict on the shared MainTabs.tsx
// file (Wave-4 parallelism). This plan performs all three swaps in a
// single commit: Home → HomeScreen, Tasks → TasksScreen, History →
// HistoryScreen. The previous skeleton + placeholder screens are now
// unused; the Phase 4 RootNativeStack does not reference them either.

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import HomeScreen from '../screens/home/HomeScreen';
import { TasksScreen } from '../screens/tasks/TasksScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import BottomNav from '../components/BottomNav';

const Tab = createBottomTabNavigator();

// 07-11 G-06 closure: the visible tab labels are owned by `BottomNav` (a custom
// `tabBar` callback) which translates `tabs.{home,tasks,history}` directly via
// `useTranslation()`. The `tabBarLabel` options below are belt-and-suspenders
// for any future plan that swaps off the custom BottomNav — react-navigation
// will fall back to these strings for the default tab-bar renderer. Route
// `name` (Home/Tasks/History) stays English for route-stability per HOME-07.
export default function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomNav {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarLabel: t('tabs.tasks') }} />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: t('tabs.history') }}
      />
    </Tab.Navigator>
  );
}
