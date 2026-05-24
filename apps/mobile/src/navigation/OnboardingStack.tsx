// OnboardingStack — native stack for the pre-MainTabs flow.
//
// `gestureEnabled: false` enforces D-NAV-04 / engineering-handoff §3.3:
// Permissions, Compat (Running/Pass/Fail), RigTutorial, PracticeIntro, and
// PracticeComplete expose NO back gesture. The Splash and Signup screens also
// opt out of swipe-back to keep the flow linear.
//
// Splash → Signup → Permissions → Compat → RigTutorial → PracticeIntro →
// (Recording, a RootNativeStack route registered by plan 04-07) →
// PracticeComplete → MainTabs (PracticeComplete.Continue does
// navigation.reset). PracticeIntro + PracticeComplete added Phase 4 plan
// 04-06. CompatRecoveryScreen + its route were merged into CompatFailScreen
// in Plan 03-03 (02-COSMETIC-GAPS.md § Compat-fail screen).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/splash/SplashScreen';
import ChooseLanguageScreen from '../screens/chooseLanguage/ChooseLanguageScreen';
import SignupScreen from '../screens/signup/SignupScreen';
import PermissionsScreen from '../screens/permissions/PermissionsScreen';
import CompatRunningScreen from '../screens/compat/CompatRunningScreen';
import CompatPassScreen from '../screens/compat/CompatPassScreen';
import CompatFailScreen from '../screens/compat/CompatFailScreen';
import RigTutorialScreen from '../screens/tutorial/RigTutorialScreen';
import PracticeIntroScreen from '../screens/tutorial/PracticeIntroScreen';
import PracticeCompleteScreen from '../screens/tutorial/PracticeCompleteScreen';

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      {/* Phase 7 plan 07-04 — first-launch language picker (D-22). Sits
          between Splash and Signup; Splash's `navigation.replace(initial.screen)`
          drives the user here when `localeMmkv.contains(LOCALE_KEYS.CHOSEN_AT)
          === false`. After Continue commits, the locale gate is transparent
          and Splash routes straight to Signup. `gestureEnabled: false` on the
          stack default screenOptions enforces "no back gesture" implicitly. */}
      <Stack.Screen name="ChooseLanguage" component={ChooseLanguageScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Compat" component={CompatRunningScreen} />
      <Stack.Screen name="CompatPass" component={CompatPassScreen} />
      <Stack.Screen name="CompatFail" component={CompatFailScreen} />
      <Stack.Screen name="RigTutorial" component={RigTutorialScreen} />
      <Stack.Screen name="PracticeIntro" component={PracticeIntroScreen} />
      <Stack.Screen name="PracticeComplete" component={PracticeCompleteScreen} />
    </Stack.Navigator>
  );
}
