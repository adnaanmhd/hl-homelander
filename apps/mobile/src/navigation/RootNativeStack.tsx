// RootNativeStack — top-level native stack.
//
// Sibling routes:
//   - OnboardingStack   (the pre-MainTabs flow)
//   - MainTabs          (the 3-tab post-onboarding shell)
//   - Recording         (full-bleed dark recording surface, plan 04-07 —
//                        gestureEnabled:false / headerShown:false / animation:fade;
//                        reached from PracticeIntro.Start-practice with practice
//                        route params and (plan 04-08) the __DEV__ task affordance)
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
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../state/appStore';
import { computeInitialRoute } from '../state/initialRoute';
import { computeCompatSignatureSync } from '../services/compatSignature';
import OnboardingStack from './OnboardingStack';
import MainTabs from './MainTabs';
import RecordingScreen from '../screens/recording/RecordingScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import PendingUploadsScreen from '../screens/uploads/PendingUploadsScreen';
import BatteryOptimizationScreen from '../screens/onboarding/BatteryOptimizationScreen';
import HelpCenterScreen from '../screens/help/HelpCenterScreen';
import ForceUpgradeScreen from '../screens/force-upgrade/ForceUpgradeScreen';
import { LogoutModal } from '../components/LogoutModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { useForegroundUserRehydrate } from '../hooks/useForegroundUserRehydrate';

const Root = createNativeStackNavigator();

// Plan 05-08 — the BatteryOptimizationScreen (UP-09) is surfaced once on the
// first auto-enqueue (RecordingScreen, gated on shouldShowBatteryOptimizationPrompt()).
// It's a route here so RecordingScreen can `navigation.navigate('BatteryOptimization')`;
// "Done"/"Skip" pops back to wherever the user was.
function BatteryOptimizationRoute(): React.JSX.Element {
  const navigation = useNavigation<{ goBack: () => void; navigate: (r: string) => void }>();
  return <BatteryOptimizationScreen onDone={() => navigation.goBack()} />;
}

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
  // Pattern 72 — fires fetchMe() when JS context rehydrates on Android process
  // kill (jwt restored via MMKV, user slice null). Lives at the navigator root
  // so every surface that mounts via this stack — including the three MainTabs
  // tab bodies that never fire /me on their own — observes a populated user
  // slice within 1-2 s of foreground. Closes the regression captured during
  // Phase 2 §13 soak (02-COSMETIC-GAPS.md § Profile screen item 2).
  useForegroundUserRehydrate();
  const initial = rootInitialRouteName();
  return (
    <Root.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
      <Root.Screen name="OnboardingStack" component={OnboardingStack} />
      <Root.Screen name="MainTabs" component={MainTabs} />
      <Root.Screen
        name="Recording"
        component={RecordingScreen}
        options={{ gestureEnabled: false, headerShown: false, animation: 'fade' }}
      />
      <Root.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: true, title: 'Profile' }}
      />
      {/* Plan 05-08 (UP-12) — the upload-queue screen; reached from the Home
          "Pending uploads" tile. Header is suppressed (the screen owns its own
          TopBar with a "Pending uploads" centered title). */}
      <Root.Screen name="PendingUploads" component={PendingUploadsScreen} />
      {/* Plan 05-08 (UP-09) — the first-upload battery-optimization walkthrough,
          surfaced once by RecordingScreen on the first auto-enqueue. Modal. */}
      <Root.Screen
        name="BatteryOptimization"
        component={BatteryOptimizationRoute}
        options={{ presentation: 'modal' }}
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
      <Root.Screen
        name="DeleteAccountModal"
        component={DeleteAccountModal}
        options={{ presentation: 'transparentModal', gestureEnabled: false, animation: 'fade' }}
      />
    </Root.Navigator>
  );
}
