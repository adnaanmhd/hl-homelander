// MainTabs — bottom-tab navigator with EXACTLY 3 tabs (Home / Tasks / History).
//
// HOME-07 satisfied STRUCTURALLY: only three tab screens are registered
// below. Profile is NOT a tab — it lives at the RootNativeStack level so it
// renders WITHOUT the bottom tab bar (HOME-08 structural suppression).
//
// `headerShown: false` because every tab body owns its own TopBar (so the
// avatar tap target lives where the user expects it, in the screen chrome
// not the navigator chrome).

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeSkeletonScreen from '../screens/home/HomeSkeletonScreen';
import TasksPlaceholderScreen from '../screens/tasks/TasksPlaceholderScreen';
import HistoryPlaceholderScreen from '../screens/history/HistoryPlaceholderScreen';
import BottomNav from '../components/BottomNav';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomNav {...props} />}
    >
      <Tab.Screen name="Home" component={HomeSkeletonScreen} />
      <Tab.Screen name="Tasks" component={TasksPlaceholderScreen} />
      <Tab.Screen name="History" component={HistoryPlaceholderScreen} />
    </Tab.Navigator>
  );
}
