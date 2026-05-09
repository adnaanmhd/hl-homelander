// OnboardingStack — native stack for the pre-MainTabs flow.
//
// `gestureEnabled: false` enforces D-NAV-04 / engineering-handoff §3.3:
// Permissions, Compat (Running/Pass/Fail/Recovery), and RigTutorial expose
// NO back gesture. The Splash and Signup screens also opt out of swipe-back
// to keep the flow linear.
//
// Splash → Signup → Permissions → Compat (Running → Pass → RigTutorial OR
// Running → Fail → Recovery → Running) → MainTabs (handled by RootNativeStack
// via navigation.replace).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/splash/SplashScreen';
import SignupScreen from '../screens/signup/SignupScreen';
import PermissionsScreen from '../screens/permissions/PermissionsScreen';
import CompatRunningScreen from '../screens/compat/CompatRunningScreen';
import CompatPassScreen from '../screens/compat/CompatPassScreen';
import CompatFailScreen from '../screens/compat/CompatFailScreen';
import CompatRecoveryScreen from '../screens/compat/CompatRecoveryScreen';
import RigTutorialScreen from '../screens/tutorial/RigTutorialScreen';

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Compat" component={CompatRunningScreen} />
      <Stack.Screen name="CompatPass" component={CompatPassScreen} />
      <Stack.Screen name="CompatFail" component={CompatFailScreen} />
      <Stack.Screen name="CompatRecovery" component={CompatRecoveryScreen} />
      <Stack.Screen name="RigTutorial" component={RigTutorialScreen} />
    </Stack.Navigator>
  );
}
