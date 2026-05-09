// RootNativeStack — top-level native stack.
//
// Sibling routes:
//   - OnboardingStack   (the pre-MainTabs flow)
//   - MainTabs          (the 3-tab post-onboarding shell)
//   - Profile           (RootNativeStack sibling — HOME-08 structural)
//   - HelpCenter        (sibling)
//   - ForceUpgrade      (modal-presentation sibling)
//   - LogoutModal       (transparent-modal sibling, plan 02-19 AUTH-08)
//   - DeleteAccountModal (transparent-modal sibling, plan 02-19 AUTH-09/10)
//
// HOME-08 satisfaction: Profile/HelpCenter/ForceUpgrade are mounted at the
// SAME LEVEL as MainTabs. The bottom tab bar lives ONLY inside MainTabs, so
// when the user navigates to Profile (avatar tap) or HelpCenter (settings
// menu) or ForceUpgrade (auto-replace from versionService), no tab chrome
// renders.
//
// initialRouteName comes from computeInitialRoute(state, signature) — pure
// function defined in src/state/initialRoute.ts. The store is hydrated by
// App.tsx synchronously BEFORE this component renders.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppStore } from '../state/appStore';
import { computeInitialRoute } from '../state/initialRoute';
import { computeCompatSignatureSync } from '../services/compatSignature';
import OnboardingStack from './OnboardingStack';
import MainTabs from './MainTabs';
import ProfileScreen from '../screens/profile/ProfileScreen';
import HelpCenterScreen from '../screens/help/HelpCenterScreen';
import ForceUpgradeScreen from '../screens/force-upgrade/ForceUpgradeScreen';
import { LogoutModal } from '../components/LogoutModal';

const Root = createNativeStackNavigator();

function rootInitialRouteName(): string {
  // Zustand store is hydrated by App.tsx BEFORE this renders, so getState()
  // here observes the fully-restored persistent state.
  const state = useAppStore.getState();
  // Plan 02-16 wires the real signature compute. Today this returns null,
  // which makes computeInitialRoute trust the persisted compatPassed (the
  // offline-boot caveat in initialRoute.ts).
  const sig = computeCompatSignatureSync();
  const target = computeInitialRoute(state, sig);
  if (target.stack === 'ForceUpgrade') return 'ForceUpgrade';
  if (target.stack === 'OnboardingStack') return 'OnboardingStack';
  return 'MainTabs';
}

export default function RootNativeStack() {
  const initial = rootInitialRouteName();
  return (
    <Root.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
      <Root.Screen name="OnboardingStack" component={OnboardingStack} />
      <Root.Screen name="MainTabs" component={MainTabs} />
      <Root.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: true, title: 'Profile' }}
      />
      <Root.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{ headerShown: true, title: 'Help Center' }}
      />
      <Root.Screen
        name="ForceUpgrade"
        component={ForceUpgradeScreen}
        options={{ presentation: 'modal', gestureEnabled: false }}
      />
      <Root.Screen
        name="LogoutModal"
        component={LogoutModal}
        options={{ presentation: 'transparentModal', gestureEnabled: false, animation: 'fade' }}
      />
    </Root.Navigator>
  );
}
