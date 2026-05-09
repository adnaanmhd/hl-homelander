---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 05
id: 02-05-navigation-skeleton
name: React Navigation v7 RootStack + OnboardingStack + MainTabs + linking config + App.tsx rewrite
type: execute
wave: 1
depends_on: [02-03-state-store-and-hydration]
files_modified:
  - apps/mobile/src/navigation/RootNativeStack.tsx
  - apps/mobile/src/navigation/OnboardingStack.tsx
  - apps/mobile/src/navigation/MainTabs.tsx
  - apps/mobile/src/navigation/linking.ts
  - apps/mobile/src/components/BottomNav.tsx
  - apps/mobile/src/components/TopBar.tsx
  - apps/mobile/src/screens/tasks/TasksPlaceholder.tsx
  - apps/mobile/src/screens/history/HistoryPlaceholder.tsx
  - apps/mobile/App.tsx
  - apps/mobile/__tests__/navigation/RootNativeStack.test.tsx
  - apps/mobile/__tests__/navigation/MainTabs.test.tsx
  - apps/mobile/__tests__/navigation/linking.test.ts
autonomous: true
requirements: [HOME-07, HOME-08]
must_haves:
  truths:
    - 'RootNativeStack mounts OnboardingStack, MainTabs, Profile, HelpCenter, ForceUpgrade as siblings'
    - 'MainTabs has EXACTLY 3 tabs (Home / Tasks / History)'
    - 'Profile is reachable only via the avatar tap, NOT a tab'
    - 'Tabs are NOT mounted outside MainTabs — HOME-08 suppression is structural'
    - 'Hardware back follows engineering-handoff §3.3 (Sign-up exits app; Permissions/Compat/Tutorial no back; Profile/Help back to Home)'
    - 'Deep-link config covers humyn://signup / home / profile / help (Phase 2 routes); humyn://tasks / history / record / tasks/{id} / history/{id} resolve to placeholder handlers'
    - 'App.tsx hydrates Zustand from MMKV synchronously before rendering NavigationContainer'
  artifacts:
    - path: 'apps/mobile/src/navigation/RootNativeStack.tsx'
      provides: 'Top-level native stack — initialRoute computed from useAppStore + getInstallationIdSync'
      contains: 'createNativeStackNavigator'
    - path: 'apps/mobile/src/navigation/MainTabs.tsx'
      provides: 'Three-tab bottom-tab navigator'
      contains: 'createBottomTabNavigator'
    - path: 'apps/mobile/src/navigation/linking.ts'
      provides: 'humyn:// deep-link config'
      contains: 'prefixes'
    - path: 'apps/mobile/App.tsx'
      provides: 'Root component: SafeAreaProvider + hydrate() + NavigationContainer'
      contains: 'hydrate()'
  key_links:
    - from: 'apps/mobile/App.tsx'
      to: 'apps/mobile/src/state/hydrate.ts'
      via: 'hydrate() call before render'
      pattern: "hydrate\\(\\)"
    - from: 'apps/mobile/src/navigation/RootNativeStack.tsx'
      to: 'apps/mobile/src/state/initialRoute.ts'
      via: 'computeInitialRoute(state)'
      pattern: 'computeInitialRoute'
---

<objective>
Stand up the React Navigation v7 graph per D-NAV-01..04 with HOME-07 (3 tabs only) and HOME-08 (suppression) satisfied structurally — tabs only mount inside `MainTabs`, every other route is a sibling under RootNativeStack with no tab bar.

Purpose: every screen plan (08, 09, 10, 11, 15, 17, 18, 19, 20) needs concrete navigator names + routes to push/replace into. This plan creates them, deletes Phase 1's `App.tsx <SignIn />` shape, and hydrates Zustand from MMKV before render.
Output: a navigator skeleton with placeholder screens (TasksPlaceholder, HistoryPlaceholder, plus a 1-LOC Splash/Signup/Permissions/Compat/RigTutorial/Profile/HelpCenter/HomeSkeleton/ForceUpgrade stub that subsequent plans replace). Phase 2's screens get filled in 02-08..20; this plan ships their stubs.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/App.tsx
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/state/hydrate.ts
@apps/mobile/src/state/initialRoute.ts
@apps/mobile/src/services/installationId.ts
@design-spec.md
@engineering-handoff.md

<interfaces>
<!-- React Navigation v7 native-stack pattern (RESEARCH.md lines 830-855) -->
import { createNativeStackNavigator } from '@react-navigation/native-stack';
const Root = createNativeStackNavigator();
<Root.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
  <Root.Screen name="Onboarding" component={OnboardingStack} />
  <Root.Screen name="MainTabs" component={MainTabs} />
  <Root.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile' }} />
  <Root.Screen name="HelpCenter" component={HelpCenterScreen} options={{ headerShown: true, title: 'Help Center' }} />
  <Root.Screen name="ForceUpgrade" component={ForceUpgradeScreen} options={{ presentation: 'modal' }} />
</Root.Navigator>

<!-- engineering-handoff.md §3.4 deep-link surface -->

humyn://signup
humyn://home
humyn://tasks?cat={cooking|cleaning|laundry|self-care|outdoor}
humyn://tasks/{taskId}
humyn://record/{taskId}
humyn://history?range={today|yesterday|week|month|all|custom}&from=&to=
humyn://history/{recordingId}
humyn://profile
humyn://help
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                     | Description                                           |
| -------------------------------------------- | ----------------------------------------------------- |
| External `humyn://` deep-link → in-app route | untrusted intent extras; URL params must be validated |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                    | Disposition | Mitigation Plan                                                                                                                                                                                                                                   |
| --------- | ---------------------- | ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.5-01  | Tampering              | Deep-link `taskId` / `recordingId` from external app                         | mitigate    | Phase 2 stops at OnboardingStack + MainTabs + Profile/Help — no record-id consumers yet. linking.ts validates path params via a simple regex (alphanumeric+ULID-like); placeholder handlers ignore invalid IDs.                                   |
| T-2.5-02  | Spoofing               | `humyn://record/{taskId}` from a phishing app pre-empts the user's recording | accept      | Recording surface is Phase 4; not navigable in Phase 2. Placeholder handler shows "Coming soon" — no security action triggered.                                                                                                                   |
| T-2.5-03  | Information Disclosure | Deep-link sub-screens leak post-auth state to a not-yet-signed-in user       | mitigate    | RootNativeStack initialRoute is computed from auth state; deep-link to `humyn://profile` while no JWT lands the user on Splash → Sign-up first (per gate-decision tree); `getStateFromPath` resolves to the post-auth route after auth completes. |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author placeholder screens + nav primitives (TopBar, BottomNav)</name>
  <files>apps/mobile/src/components/TopBar.tsx (NEW), apps/mobile/src/components/BottomNav.tsx (NEW), apps/mobile/src/screens/splash/SplashScreen.tsx (NEW stub), apps/mobile/src/screens/signup/SignupScreen.tsx (NEW stub), apps/mobile/src/screens/permissions/PermissionsScreen.tsx (NEW stub), apps/mobile/src/screens/compat/CompatRunningScreen.tsx (NEW stub), apps/mobile/src/screens/compat/CompatPassScreen.tsx (NEW stub), apps/mobile/src/screens/compat/CompatFailScreen.tsx (NEW stub), apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx (NEW stub), apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (NEW stub), apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (NEW stub), apps/mobile/src/screens/tasks/TasksPlaceholder.tsx (NEW), apps/mobile/src/screens/history/HistoryPlaceholder.tsx (NEW), apps/mobile/src/screens/profile/ProfileScreen.tsx (NEW stub), apps/mobile/src/screens/help/HelpCenterScreen.tsx (NEW stub), apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx (NEW stub)</files>
  <read_first>
    - apps/mobile/src/ui/tokens.ts (Task 02-02)
    - apps/mobile/src/ui/primitives/Text.tsx + Button.tsx (Task 02-02)
    - design-spec.md §0.5 (Top bar, Bottom nav, Avatar specs) + §9 (Home top bar logo + avatar)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "Domain: Home / Navigation chrome"
  </read_first>
  <action>
    1. Create `apps/mobile/src/components/TopBar.tsx`:
       - 48 px min-height, logo on left (Phase 1 logo.js — `import Logo from '../../../../logo'` if accessible; otherwise inline a placeholder Text component reading "Humyn"), avatar 36 px circle on right (gradient #FFC09F → #FF6A2D, white bold initial). Tapping avatar dispatches `navigation.navigate('Profile')`.
       - Props: `onAvatarPress?: () => void`, `title?: string` (centered when present).
       - Uses tokens for colors/typography.

    2. Create `apps/mobile/src/components/BottomNav.tsx`:
       - Custom `tabBar` callback for `createBottomTabNavigator` — receives `BottomTabBarProps`.
       - 68 px height, 10 px bottom inset, blurred white `rgba(255,255,255,.92)` bg (use solid white at MVP; backdrop blur is iOS-only / future), 1 px top border `colors.line`.
       - Three tabs: Home (icon `Home` from lucide-react-native), Tasks (icon `ListTodo`), History (icon `History`). Active uses `colors.accent` + filled icon variant; inactive uses `colors.text2` + outlined.
       - Tab label uses `typography.tabLabel`.
       - Each tab is a `Pressable` with `accessibilityRole="tab"` + `accessibilityLabel="Home tab" / "Tasks tab" / "History tab"` for testability.

    3. Create stub screens. Each is ~10 LOC and renders `<ScreenContainer><Text>{ScreenName}</Text></ScreenContainer>` with proper `accessibilityLabel="{ScreenName} screen"` so the navigation test can find it. Stub screens to create:
       - `splash/SplashScreen.tsx`
       - `signup/SignupScreen.tsx`
       - `permissions/PermissionsScreen.tsx`
       - `compat/CompatRunningScreen.tsx`, `CompatPassScreen.tsx`, `CompatFailScreen.tsx`, `CompatRecoveryScreen.tsx`
       - `tutorial/RigTutorialScreen.tsx`
       - `home/HomeSkeletonScreen.tsx`
       - `profile/ProfileScreen.tsx`
       - `help/HelpCenterScreen.tsx`
       - `force-upgrade/ForceUpgradeScreen.tsx`
       Each stub MUST default-export the component. Subsequent plans replace each stub's body with real implementation; this plan ships only the file + minimal render so the navigator graph compiles.

    4. Create real placeholder screens (Phase 6 territory but the navigator needs them):
       - `tasks/TasksPlaceholder.tsx` — `<ScreenContainer><TopBar onAvatarPress={...}/><Text variant="title28" tone="primary">Tasks</Text><Text variant="body" tone="secondary">Coming in Phase 6.</Text></ScreenContainer>`
       - `history/HistoryPlaceholder.tsx` — similar.

  </action>
  <acceptance_criteria>
    - `ls apps/mobile/src/screens -R | grep -E "\\.tsx$" | wc -l` returns ≥ 13 (all stubs + placeholders).
    - `test -f apps/mobile/src/components/TopBar.tsx && test -f apps/mobile/src/components/BottomNav.tsx` succeeds.
    - `grep -q "accessibilityLabel" apps/mobile/src/components/BottomNav.tsx` succeeds (3 tabs labeled).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && (ls src/screens -R 2>/dev/null | grep -c "\\.tsx$" | awk '$1 >= 13 { exit 0 } { exit 1 }') && test -f src/components/BottomNav.tsx && npm run typecheck</automated>
  </verify>
  <done>14+ stub screens + TopBar + BottomNav exist; typecheck clean; tabs labeled for tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RootNativeStack + OnboardingStack + MainTabs + linking config</name>
  <files>apps/mobile/src/navigation/RootNativeStack.tsx (NEW), apps/mobile/src/navigation/OnboardingStack.tsx (NEW), apps/mobile/src/navigation/MainTabs.tsx (NEW), apps/mobile/src/navigation/linking.ts (NEW), apps/mobile/__tests__/navigation/RootNativeStack.test.tsx (NEW), apps/mobile/__tests__/navigation/MainTabs.test.tsx (NEW), apps/mobile/__tests__/navigation/linking.test.ts (NEW)</files>
  <read_first>
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "React Navigation v7 root-stack setup" lines 830-855
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-NAV-01..04
    - apps/mobile/src/state/initialRoute.ts (Task 02-03)
    - engineering-handoff.md §3.3 (routing semantics — back behavior) + §3.4 (deep-link surface)
  </read_first>
  <behavior>
    Test 1 (RootNativeStack.test.tsx): With `useAppStore` mocked to return `{jwt: null}`, the rendered tree contains a screen with accessibilityLabel matching "Splash screen" (or "Signup screen" — depends on initial-route decision tree).
    Test 2 (RootNativeStack.test.tsx): With `useAppStore` mocked to return all-pass state, the rendered tree contains "Home tab" (MainTabs mounted, BottomNav visible).
    Test 3 (RootNativeStack.test.tsx): The Profile route is registered as a sibling, NOT inside MainTabs (assert by checking BottomNav is NOT a parent of Profile in the test tree — querying `getAllByText('Home tab').length === 0` when Profile is the active route).
    Test 4 (MainTabs.test.tsx): MainTabs renders exactly 3 tabs labeled "Home tab", "Tasks tab", "History tab".
    Test 5 (linking.test.ts): `linking.config.screens.MainTabs.screens.Home === 'home'`; `linking.config.screens.OnboardingStack.screens.Signup === 'signup'`; `linking.prefixes` contains `'humyn://'`.
  </behavior>
  <action>
    1. Create `apps/mobile/src/navigation/MainTabs.tsx`:
       ```tsx
       import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
       import HomeSkeletonScreen from '../screens/home/HomeSkeletonScreen';
       import TasksPlaceholder from '../screens/tasks/TasksPlaceholder';
       import HistoryPlaceholder from '../screens/history/HistoryPlaceholder';
       import BottomNav from '../components/BottomNav';

       const Tab = createBottomTabNavigator();

       export default function MainTabs() {
         return (
           <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNav {...props} />}>
             <Tab.Screen name="Home" component={HomeSkeletonScreen} />
             <Tab.Screen name="Tasks" component={TasksPlaceholder} />
             <Tab.Screen name="History" component={HistoryPlaceholder} />
           </Tab.Navigator>
         );
       }
       ```
       3 tabs, no others. HOME-07 satisfied structurally.

    2. Create `apps/mobile/src/navigation/OnboardingStack.tsx`:
       ```tsx
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
       ```
       `gestureEnabled: false` enforces D-NAV-04 / engineering-handoff §3.3 — Permissions/Compat/Tutorial have NO back.

    3. Create `apps/mobile/src/navigation/RootNativeStack.tsx`:
       ```tsx
       import { createNativeStackNavigator } from '@react-navigation/native-stack';
       import { useAppStore } from '../state/appStore';
       import { computeInitialRoute } from '../state/initialRoute';
       import { getInstallationIdSync } from '../services/installationId';
       import OnboardingStack from './OnboardingStack';
       import MainTabs from './MainTabs';
       import ProfileScreen from '../screens/profile/ProfileScreen';
       import HelpCenterScreen from '../screens/help/HelpCenterScreen';
       import ForceUpgradeScreen from '../screens/force-upgrade/ForceUpgradeScreen';
       import { computeCompatSignature } from '../services/compatSignature'; // STUB created in plan 02-16; for this plan, `computeInitialRoute` accepts a `null` signature OK (route gates on stale-detection only when present)

       const Root = createNativeStackNavigator();

       function rootInitialRouteName(): string {
         // The Zustand store is hydrated by App.tsx BEFORE this renders.
         const state = useAppStore.getState();
         // Phase 2 plan 02-16 will provide the real compat signature.
         // At plan 02-05 time we pass null so initialRoute treats compat as "fresh"
         // when compatPassed exists; AUTH-11 stale-signature path activates once
         // computeCompatSignature is wired by 02-16.
         const sig = null;
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
             <Root.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile' }} />
             <Root.Screen name="HelpCenter" component={HelpCenterScreen} options={{ headerShown: true, title: 'Help Center' }} />
             <Root.Screen name="ForceUpgrade" component={ForceUpgradeScreen} options={{ presentation: 'modal', gestureEnabled: false }} />
           </Root.Navigator>
         );
       }
       ```

       Stub `apps/mobile/src/services/compatSignature.ts`:
       ```ts
       /** Stubbed in plan 02-05; real implementation lands in plan 02-16. */
       export async function computeCompatSignature(): Promise<string | null> {
         return null;
       }
       ```

    4. Create `apps/mobile/src/navigation/linking.ts`:
       ```ts
       import type { LinkingOptions } from '@react-navigation/native';

       export const linking: LinkingOptions<any> = {
         prefixes: ['humyn://'],
         config: {
           screens: {
             OnboardingStack: {
               screens: {
                 Signup: 'signup',
                 Permissions: 'permissions',
               },
             },
             MainTabs: {
               screens: {
                 Home: 'home',
                 Tasks: 'tasks',
                 History: 'history',
               },
             },
             Profile: 'profile',
             HelpCenter: 'help',
             // humyn://record/{taskId} resolves to the recording surface (Phase 4).
             // For Phase 2, we accept the deep-link path but route to a placeholder
             // resolved inside MainTabs.Tasks so users see "Coming soon".
           },
         },
       };
       ```

    5. Create the three test files implementing the `<behavior>` tests above. Mocks: rely on `@react-navigation/*` mocks already in `vitest.setup.ts`; mock `useAppStore.getState()` per test case.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/src/navigation/RootNativeStack.tsx && test -f apps/mobile/src/navigation/OnboardingStack.tsx && test -f apps/mobile/src/navigation/MainTabs.tsx && test -f apps/mobile/src/navigation/linking.ts` succeeds.
    - `grep -c "Tab.Screen" apps/mobile/src/navigation/MainTabs.tsx` returns exactly 3.
    - `grep -q "createNativeStackNavigator" apps/mobile/src/navigation/RootNativeStack.tsx` succeeds.
    - `grep -q "humyn://" apps/mobile/src/navigation/linking.ts` succeeds.
    - `grep -q "computeInitialRoute" apps/mobile/src/navigation/RootNativeStack.tsx` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/navigation/` passes (5 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && (grep -c "Tab.Screen" src/navigation/MainTabs.tsx | awk '$1 == 3 { exit 0 } { exit 1 }') && grep -q "humyn://" src/navigation/linking.ts && npm run typecheck && npm run test -- __tests__/navigation/</automated>
  </verify>
  <done>RootNativeStack mounts the 5 sibling routes; MainTabs has exactly 3 tabs (HOME-07); linking.ts wires Phase 2 routes; 5 unit tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Replace App.tsx with hydrated NavigationContainer + delete Phase 1 SignIn.tsx</name>
  <files>apps/mobile/App.tsx, apps/mobile/src/screens/SignIn.tsx (DELETE), apps/mobile/__tests__/SignIn.test.tsx (DELETE)</files>
  <read_first>
    - apps/mobile/App.tsx (current Phase 1 root — full file 17 LOC per 02-PATTERNS.md)
    - apps/mobile/src/screens/SignIn.tsx (Phase 1 — to be deleted; behaviors carry into 02-09 SignupScreen)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "App.tsx (REWRITE — root)" lines 676-722
  </read_first>
  <action>
    1. Replace `apps/mobile/App.tsx` body:
       ```tsx
       import React from 'react';
       import { StatusBar } from 'react-native';
       import { NavigationContainer } from '@react-navigation/native';
       import { SafeAreaProvider } from 'react-native-safe-area-context';
       import { enableScreens } from 'react-native-screens';
       import { hydrate } from './src/state/hydrate';
       import RootNativeStack from './src/navigation/RootNativeStack';
       import { linking } from './src/navigation/linking';

       enableScreens(true);

       // Sync hydrate before render — MMKV is sync, Zustand setState is sync.
       hydrate();

       export default function App() {
         return (
           <SafeAreaProvider>
             <StatusBar barStyle="dark-content" />
             <NavigationContainer linking={linking}>
               <RootNativeStack />
             </NavigationContainer>
           </SafeAreaProvider>
         );
       }
       ```

    2. Delete `apps/mobile/src/screens/SignIn.tsx` and `apps/mobile/__tests__/SignIn.test.tsx`. Plan 02-09 ships the new `SignupScreen` that supersedes them.
       Use `git rm apps/mobile/src/screens/SignIn.tsx apps/mobile/__tests__/SignIn.test.tsx` so deletion is staged.

    3. Run `cd apps/mobile && npm run typecheck && npm run test`. Expected: typecheck passes; tests run the navigation + state + service test suite — Phase 1's SignIn test is gone, but plan 02-02 primitives.test.tsx + plan 02-03/04 state-and-service tests + plan 02-05 navigation tests still run.

  </action>
  <acceptance_criteria>
    - `grep -q "hydrate()" apps/mobile/App.tsx && grep -q "NavigationContainer" apps/mobile/App.tsx && grep -q "enableScreens" apps/mobile/App.tsx` succeeds.
    - `test ! -f apps/mobile/src/screens/SignIn.tsx` succeeds (file removed).
    - `test ! -f apps/mobile/__tests__/SignIn.test.tsx` succeeds.
    - `cd apps/mobile && npm run typecheck` exits 0.
    - `cd apps/mobile && npm run test` passes ALL test files (navigation + state + service + ui).
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && grep -q "hydrate()" App.tsx && grep -q "NavigationContainer" App.tsx && test ! -f src/screens/SignIn.tsx && test ! -f __tests__/SignIn.test.tsx && npm run typecheck && npm run test</automated>
  </verify>
  <done>App.tsx uses NavigationContainer + hydrated Zustand; Phase 1 SignIn.tsx + test deleted (replaced by 02-09 work); full vitest suite green.</done>
</task>

</tasks>

<verification>
- `grep -c "Tab.Screen" apps/mobile/src/navigation/MainTabs.tsx` → 3 (HOME-07).
- Profile + HelpCenter + ForceUpgrade are RootNativeStack siblings → HOME-08 structural suppression.
- Deep-link config covers Phase 2 routes; placeholder behavior for Phase-4/6 surfaces.
- App.tsx hydrates Zustand before render.
- Full vitest suite green; typecheck clean.
</verification>

<success_criteria>

- HOME-07 (3 tabs only) + HOME-08 (suppression on splash/auth/perms/compat/tutorial/recording/force-upgrade) satisfied.
- Subsequent screen plans push/replace into named routes ('Permissions', 'Compat', 'CompatPass', 'CompatFail', 'CompatRecovery', 'RigTutorial', 'MainTabs', 'Profile', 'HelpCenter', 'ForceUpgrade') without further nav work.
- Phase 1 SignIn screen retired; replacement comes in 02-09.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-05-SUMMARY.md` documenting the route names + the gate-decision-tree → initial-route mapping for the executor's reference.
</output>
