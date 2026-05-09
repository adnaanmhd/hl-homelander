---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 16
id: 02-16-home-skeleton-and-tabs
name: HomeSkeletonScreen + TopBar (avatar→Profile) + 3-tab MainTabs structural HOME-07/08 lock
type: execute
wave: 4
depends_on: [02-05-navigation-skeleton, 02-09-signup-screen-and-terms-modal]
files_modified:
  - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
  - apps/mobile/src/components/TopBar.tsx
  - apps/mobile/src/navigation/MainTabs.tsx
  - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx
  - apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx
  - apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx
  - apps/mobile/__tests__/components/TopBar.test.tsx
  - apps/mobile/__tests__/navigation/MainTabs.test.tsx
autonomous: true
requirements: [HOME-07, HOME-08]
must_haves:
  truths:
    - 'MainTabs renders EXACTLY 3 tabs in order: Home / Tasks / History — not 4, not 2; Profile is NOT a tab'
    - "TopBar renders Humyn logo (left) + circular avatar Pressable (right) — tapping avatar navigates to RootStack 'Profile' (NOT a tab)"
    - 'HOME-08 suppression is structural: tab bar mounts only inside MainTabs; OnboardingStack / Recording / Player / ForceUpgrade live as siblings on RootNativeStack and have no tab bar by construction (no per-screen tab-bar suppression flag is required)'
    - 'HomeSkeletonScreen ships the bare-minimum scaffold (logo top, avatar, body placeholder for tiles, soft-upgrade banner mount point); full Home tiles + filters + first-time vs returning hero ship in Phase 6 (HOME-01..06/09/10)'
    - "TasksPlaceholderScreen + HistoryPlaceholderScreen exist as no-op tab screens to satisfy MainTabs.tsx imports until Phase 6 fills them in (per CONTEXT.md § Discretion 'Deep-link routes for Phase-4/6 surfaces')"
    - 'SoftUpgradeBanner mount point is reserved at the top of HomeSkeletonScreen; the actual banner component is plan 02-20'
  artifacts:
    - path: 'apps/mobile/src/screens/home/HomeSkeletonScreen.tsx'
      provides: 'Phase 2 Home skeleton — scaffold for HOME-07/08, banner mount point'
      contains: 'HomeSkeletonScreen'
    - path: 'apps/mobile/src/components/TopBar.tsx'
      provides: 'Logo + avatar TopBar for tab screens'
      contains: 'navigate.*Profile'
    - path: 'apps/mobile/src/navigation/MainTabs.tsx'
      provides: 'Bottom-tabs navigator with exactly 3 tabs'
      contains: 'createBottomTabNavigator'
  key_links:
    - from: 'apps/mobile/src/components/TopBar.tsx'
      to: 'apps/mobile/src/navigation/RootNativeStack.tsx'
      via: "navigation.navigate('Profile')"
      pattern: 'Profile'
    - from: 'apps/mobile/src/navigation/MainTabs.tsx'
      to: 'apps/mobile/src/screens/home/HomeSkeletonScreen.tsx'
      via: "Tab.Screen name='Home' component={HomeSkeletonScreen}"
      pattern: 'HomeSkeletonScreen'
---

<objective>
Lock in the HOME-07 / HOME-08 structural rules: MainTabs renders exactly 3 tabs (Home / Tasks / History), Profile is reachable ONLY via the avatar in the TopBar (not a tab), and the bottom-tab bar is suppressed automatically on every onboarding/recording/upgrade screen because those screens live as RootNativeStack siblings of MainTabs (not children of it). Ship the Home skeleton (sufficient for Phase 2 — Phase 6 fills in tiles), the Tasks/History placeholders, and the TopBar component.

Purpose: HOME-07 + HOME-08 are the only Home requirements in Phase 2 (HOME-01..06/09/10 are Phase 6). The structural shape locked here prevents Phase 4 (Recording) and Phase 6 (Tasks/History/Player) from inadvertently re-introducing the tab bar in the wrong contexts.
Output: a working 3-tab MainTabs + a Home skeleton with avatar→Profile navigation and a soft-upgrade banner mount point.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/navigation/MainTabs.tsx
@apps/mobile/src/navigation/RootNativeStack.tsx
@apps/mobile/src/state/appStore.ts
@logo.js
@design-spec.md
@engineering-handoff.md

<interfaces>
<!-- design-spec §5.6 — Home header layout (idea-brief.md §5.6) -->
Header: logo (left), avatar (right). No hamburger menu, no center logo.
Tap avatar → Profile screen.
Bottom navigation (persistent on Home, Tasks, History): 3 tabs — Home, Tasks, History.
Profile reached only via avatar in top-right.
Bottom-nav suppressed on splash/sign-up/permissions/compat/tutorial/recording/force-upgrade.

<!-- D-NAV-02 — navigator graph -->

RootNativeStack
├── OnboardingStack (Splash → Signup → Permissions → Compat → RigTutorial)
├── MainTabs (bottom-tabs: Home / Tasks / History)
├── Profile ← stack-level, NOT a tab
├── Help ← stack-level under Profile flow
├── Recording (Phase 4)
├── Player (Phase 6)
└── ForceUpgrade (modal)
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary            | Description                             |
| ------------------- | --------------------------------------- |
| Tab bar render path | mounts only inside MainTabs; structural |

## STRIDE Threat Register

| Threat ID | Category  | Component                                                       | Disposition | Mitigation Plan                                                                                                                                                             |
| --------- | --------- | --------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.16-01 | Tampering | A future plan adds a fourth tab to MainTabs (HOME-07 violation) | mitigate    | This plan ships a vitest test that grep-asserts EXACTLY 3 `<Tab.Screen>` invocations in MainTabs.tsx. Phase 4/6 plans that touch MainTabs must update this gate explicitly. |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: TopBar component + tabs/history placeholder screens</name>
  <files>apps/mobile/src/components/TopBar.tsx, apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx, apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx, apps/mobile/__tests__/components/TopBar.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/SignIn.tsx (analog: View + Pressable + StyleSheet)
    - apps/mobile/src/state/appStore.ts (avatar URL from store.user.photoURL)
    - logo.js (Humyn logo SVG component)
    - design-spec.md §5.6 / §15 (TopBar layout: logo left, avatar right; Profile reached via avatar tap)
  </read_first>
  <action>
    Author `apps/mobile/src/components/TopBar.tsx`. Use Text + Pressable primitives from `../ui/primitives/*`; tokens from `../ui/tokens` — NO hex literals. The avatar Image stays raw RN (no Image primitive ships in 02-02):
    ```tsx
    import React from 'react';
    import { View, Image, StyleSheet } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../ui/primitives/Text';
    import { Pressable } from '../ui/primitives/Pressable';
    import { colors, spacing } from '../ui/tokens';
    import { useAppStore } from '../state/appStore';

    /**
     * Header bar rendered on tab screens (Home / Tasks / History).
     * - Left: Humyn logo wordmark.
     * - Right: circular avatar Pressable → Profile (RootStack-level navigation).
     *
     * design-spec §5.6 / §15 — avatar is the ONLY entry to Profile (HOME-07).
     */
    export function TopBar(): React.JSX.Element {
      const nav = useNavigation<any>();
      const photoURL = useAppStore((s) => s.user?.photoURL ?? null);
      const initial = useAppStore((s) => (s.user?.name ?? '').slice(0, 1).toUpperCase() || 'A');

      return (
        <View style={styles.bar} accessibilityLabel="top-bar">
          <Text variant="btnLabel" style={styles.logo}>Humyn Labs</Text>
          <Pressable
            onPress={() => nav.navigate('Profile')}
            accessibilityLabel="top-bar-avatar"
            hitSlop={8}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text variant="btnLabel" style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </Pressable>
        </View>
      );
    }

    const styles = StyleSheet.create({
      bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
      logo: {},
      avatar: { width: 36, height: 36, borderRadius: 18 },
      avatarFallback: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
      avatarInitial: { color: colors.accent },
    });
    ```

    Author `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx`. Use Text + ScreenContainer primitives from `../../ui/primitives/*`; tokens from `../../ui/tokens` — NO hex literals:
    ```tsx
    import React from 'react';
    import { StyleSheet } from 'react-native';
    import { Text } from '../../ui/primitives/Text';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { spacing } from '../../ui/tokens';
    import { TopBar } from '../../components/TopBar';

    /** Placeholder for Phase 6 (TASK-01..10). Phase 2 ships only the tab shell. */
    export function TasksPlaceholderScreen(): React.JSX.Element {
      return (
        <ScreenContainer padding={0}>
          <TopBar />
          <Text variant="body" tone="secondary" style={styles.text}>Tasks — coming in Phase 6.</Text>
        </ScreenContainer>
      );
    }
    const styles = StyleSheet.create({
      text: { padding: spacing.xxxl },
    });
    ```

    Author `apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx` (identical shape, label 'History — coming in Phase 6.', same primitive + token imports — NO hex literals).

    Author `apps/mobile/__tests__/components/TopBar.test.tsx`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { render, screen, fireEvent } from '@testing-library/react';
    import React from 'react';

    const navigateFn = vi.fn();
    vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: navigateFn }) }));
    vi.mock('../../src/state/appStore', () => ({
      useAppStore: (sel: any) => sel({ user: { name: 'Adnaan', photoURL: null } }),
    }));

    import { TopBar } from '../../src/components/TopBar';

    beforeEach(() => navigateFn.mockClear());

    describe('TopBar', () => {
      it('renders the Humyn Labs logo and an avatar Pressable', () => {
        render(<TopBar />);
        expect(screen.getByText('Humyn Labs')).toBeTruthy();
        expect(screen.getByLabelText('top-bar-avatar')).toBeTruthy();
      });

      it('falls back to initial when photoURL is null', () => {
        render(<TopBar />);
        expect(screen.getByText('A')).toBeTruthy();
      });

      it('tapping avatar navigates to Profile (HOME-07: only entry point)', () => {
        render(<TopBar />);
        fireEvent.click(screen.getByLabelText('top-bar-avatar'));
        expect(navigateFn).toHaveBeenCalledWith('Profile');
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- TopBar --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "navigate.*Profile" apps/mobile/src/components/TopBar.tsx` succeeds.
    - `grep -q "Humyn Labs" apps/mobile/src/components/TopBar.tsx` succeeds.
    - `grep -q "top-bar-avatar" apps/mobile/src/components/TopBar.tsx` succeeds.
    - `test -f apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx && test -f apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx` succeeds.
    - `cd apps/mobile && npm run test -- TopBar --run` exits 0; 3 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- TopBar --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/TopBar.tsx apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx; test $? -eq 1)</automated>
  </verify>
  <done>TopBar renders logo + avatar; avatar tap navigates to RootStack Profile route; placeholders exist for Tasks + History tabs. NO hex literals in TopBar/TasksPlaceholder/HistoryPlaceholder.</done>
</task>

<task type="auto">
  <name>Task 2: HomeSkeletonScreen + soft-upgrade banner mount point</name>
  <files>apps/mobile/src/screens/home/HomeSkeletonScreen.tsx, apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx</files>
  <read_first>
    - apps/mobile/src/components/TopBar.tsx (Task 1 output)
    - apps/mobile/src/state/appStore.ts (softUpgradeAvailable selector — confirm it exists from 02-08)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-UPG-05 (Soft-upgrade banner mounts at the top of Home only)
    - design-spec.md §9 / §19.4 (Banners)
  </read_first>
  <action>
    Author `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx`. Use Text + ScreenContainer primitives from `../../ui/primitives/*`; tokens from `../../ui/tokens` — NO hex literals:
    ```tsx
    import React from 'react';
    import { View, StyleSheet, ScrollView } from 'react-native';
    import { Text } from '../../ui/primitives/Text';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { spacing } from '../../ui/tokens';
    import { TopBar } from '../../components/TopBar';
    import { useAppStore } from '../../state/appStore';

    /**
     * Phase 2 Home skeleton.
     *
     * What ships here:
     *  - TopBar (logo + avatar → Profile)
     *  - SoftUpgradeBanner mount point (banner component lands in plan 02-20)
     *  - Placeholder body
     *
     * What does NOT ship here (Phase 6, HOME-01..06/09/10):
     *  - First-time vs returning hero
     *  - Recording duration / Tasks recorded / Pending uploads tiles
     *  - Time-range filters
     *  - Pull-to-refresh
     *  - Offline banner inside Pending Uploads tile
     */
    export function HomeSkeletonScreen(): React.JSX.Element {
      const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);
      const userName = useAppStore((s) => s.user?.name ?? 'there');

      return (
        <ScreenContainer padding={0}>
          <TopBar />
          {softUpgradeAvailable ? (
            <View accessibilityLabel="soft-upgrade-banner-slot" style={styles.bannerSlot}>
              {/* Plan 02-20 mounts SoftUpgradeBanner here. Slot reserves layout space + a stable test hook. */}
            </View>
          ) : null}
          <ScrollView contentContainerStyle={styles.body} accessibilityLabel="home-skeleton-body">
            <Text variant="bodyLg" style={styles.heroLine}>Hi, {userName}.</Text>
            <Text variant="body" tone="secondary" style={styles.placeholder}>
              Home tiles arrive in Phase 6. For now this is the structural shell that locks in
              HOME-07 (3 tabs) and HOME-08 (tab bar suppression).
            </Text>
          </ScrollView>
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      bannerSlot: { paddingHorizontal: spacing.xl },
      body: { padding: spacing.xl },
      heroLine: { marginBottom: spacing.md },
      placeholder: {},
    });
    ```

    Author `apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx`:
    ```typescript
    import { describe, it, expect, vi } from 'vitest';
    import { render, screen } from '@testing-library/react';
    import React from 'react';

    let mockSoftUpgrade = false;
    vi.mock('../../src/state/appStore', () => ({
      useAppStore: (sel: any) => sel({ user: { name: 'Adnaan', photoURL: null }, softUpgradeAvailable: mockSoftUpgrade }),
    }));
    vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: vi.fn() }) }));

    import { HomeSkeletonScreen } from '../../src/screens/home/HomeSkeletonScreen';

    describe('HomeSkeletonScreen', () => {
      it('renders TopBar + greeting using user.name', () => {
        render(<HomeSkeletonScreen />);
        expect(screen.getByText('Humyn Labs')).toBeTruthy();
        expect(screen.getByText('Hi, Adnaan.')).toBeTruthy();
      });

      it('hides the soft-upgrade banner slot when softUpgradeAvailable is false', () => {
        mockSoftUpgrade = false;
        render(<HomeSkeletonScreen />);
        expect(screen.queryByLabelText('soft-upgrade-banner-slot')).toBeNull();
      });

      it('renders the soft-upgrade banner slot when softUpgradeAvailable is true', () => {
        mockSoftUpgrade = true;
        render(<HomeSkeletonScreen />);
        expect(screen.getByLabelText('soft-upgrade-banner-slot')).toBeTruthy();
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- HomeSkeletonScreen --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "TopBar" apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` succeeds.
    - `grep -q "softUpgradeAvailable" apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` succeeds.
    - `grep -q "soft-upgrade-banner-slot" apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` succeeds (mount point reserved).
    - `cd apps/mobile && npm run test -- HomeSkeletonScreen --run` exits 0; 3 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- HomeSkeletonScreen --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/home/HomeSkeletonScreen.tsx; test $? -eq 1)</automated>
  </verify>
  <done>Home skeleton ships, banner mount point reserved, tests cover the conditional render. NO hex literals in HomeSkeletonScreen source.</done>
</task>

<task type="auto">
  <name>Task 3: MainTabs — exactly 3 tabs + grep-gate test for HOME-07 invariant</name>
  <files>apps/mobile/src/navigation/MainTabs.tsx, apps/mobile/__tests__/navigation/MainTabs.test.tsx</files>
  <read_first>
    - apps/mobile/src/navigation/MainTabs.tsx (current — 02-05 shipped a stub; this task fleshes it out with real screen imports)
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (Task 2 output)
    - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx (Task 1 output)
    - apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx (Task 1 output)
    - REQUIREMENTS.md HOME-07 + HOME-08 verbatim
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-NAV-02
  </read_first>
  <action>
    Replace `apps/mobile/src/navigation/MainTabs.tsx` body:
    ```tsx
    import React from 'react';
    import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
    import { Home, ListChecks, History } from 'lucide-react-native';
    import { HomeSkeletonScreen } from '../screens/home/HomeSkeletonScreen';
    import { TasksPlaceholderScreen } from '../screens/tasks/TasksPlaceholderScreen';
    import { HistoryPlaceholderScreen } from '../screens/history/HistoryPlaceholderScreen';

    /**
     * HOME-07: EXACTLY 3 tabs in this exact order — Home, Tasks, History.
     * HOME-08: tab bar suppression is structural — MainTabs is a sibling of OnboardingStack,
     *          Recording, Player, and ForceUpgrade in RootNativeStack. Onboarding/recording
     *          screens never see the tab bar because they aren't children of MainTabs.
     *
     * If you add a fourth tab here you violate HOME-07. The vitest grep-gate in
     * __tests__/navigation/MainTabs.test.tsx will fail loudly.
     */
    const Tab = createBottomTabNavigator();

    export function MainTabs(): React.JSX.Element {
      return (
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarLabelPosition: 'below-icon',
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeSkeletonScreen}
            options={{ tabBarLabel: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
          />
          <Tab.Screen
            name="Tasks"
            component={TasksPlaceholderScreen}
            options={{ tabBarLabel: 'Tasks', tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }}
          />
          <Tab.Screen
            name="History"
            component={HistoryPlaceholderScreen}
            options={{ tabBarLabel: 'History', tabBarIcon: ({ color, size }) => <History color={color} size={size} /> }}
          />
        </Tab.Navigator>
      );
    }
    ```

    Author `apps/mobile/__tests__/navigation/MainTabs.test.tsx` — this is a **structural grep-gate test**, not a render test, so we sidestep React Navigation's mock surface (which would balloon test scope):
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { readFileSync } from 'node:fs';
    import { join } from 'node:path';

    const SOURCE = readFileSync(
      join(__dirname, '../../src/navigation/MainTabs.tsx'),
      'utf-8',
    );

    describe('MainTabs structural HOME-07 invariant', () => {
      it('declares EXACTLY 3 Tab.Screen elements', () => {
        // Strip line comments before counting to avoid false positives from a future doc comment
        // that mentions <Tab.Screen> in markdown.
        const code = SOURCE.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
        const matches = code.match(/<Tab\.Screen\b/g) ?? [];
        expect(matches.length).toBe(3);
      });

      it('declares the tabs in the order Home → Tasks → History', () => {
        const homeIdx = SOURCE.indexOf('name="Home"');
        const tasksIdx = SOURCE.indexOf('name="Tasks"');
        const historyIdx = SOURCE.indexOf('name="History"');
        expect(homeIdx).toBeGreaterThan(0);
        expect(tasksIdx).toBeGreaterThan(homeIdx);
        expect(historyIdx).toBeGreaterThan(tasksIdx);
      });

      it('does NOT declare a Profile tab (HOME-07: Profile reachable only via TopBar avatar)', () => {
        expect(SOURCE).not.toContain('name="Profile"');
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- MainTabs --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -c "Tab.Screen" apps/mobile/src/navigation/MainTabs.tsx` returns 3 (exactly).
    - `grep -q 'name="Home"' apps/mobile/src/navigation/MainTabs.tsx` succeeds.
    - `grep -q 'name="Tasks"' apps/mobile/src/navigation/MainTabs.tsx` succeeds.
    - `grep -q 'name="History"' apps/mobile/src/navigation/MainTabs.tsx` succeeds.
    - `grep -c 'name="Profile"' apps/mobile/src/navigation/MainTabs.tsx` returns 0 (HOME-07 enforcement).
    - `cd apps/mobile && npm run test -- MainTabs --run` exits 0; 3 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- MainTabs --run</automated>
  </verify>
  <done>MainTabs has exactly 3 tabs in the correct order, Profile is not a tab, structural test gate prevents future violations.</done>
</task>

</tasks>

<verification>
- `cd apps/mobile && npm run test -- "TopBar|HomeSkeletonScreen|MainTabs" --run` runs all 9 tests green.
- `grep -v '^[[:space:]]*//' apps/mobile/src/navigation/MainTabs.tsx | grep -c '<Tab.Screen'` returns 3.
- Manual (deferred to 02-21): on a Pixel 7a, sign-up → permissions → compat → tutorial → MainTabs renders with Home/Tasks/History; tapping the avatar opens Profile; backgrounding the app and returning to Onboarding (e.g., logging out) shows NO tab bar (structural HOME-08 gate).
</verification>

<success_criteria>

- HOME-07 is structurally locked at exactly 3 tabs; structural test enforces the invariant on every PR.
- HOME-08 is satisfied by construction — no per-screen flag is needed because the tab bar lives only inside MainTabs.
- Profile is reached only via TopBar avatar tap (no tab, no hamburger).
- Soft-upgrade banner has a stable mount point that 02-20 wires.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-16-SUMMARY.md` per templates/summary.md.
</output>
