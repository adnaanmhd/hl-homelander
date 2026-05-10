---
phase: 03-humyn-capture-native-module
plan_id: 03-03
plan: 3
type: execute
wave: 1
depends_on: [03-01, 03-02]
files_modified:
  - apps/mobile/src/hooks/useTabTopBarProps.ts
  - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx
  - apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx
  - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
  - apps/mobile/src/screens/compat/CompatFailScreen.tsx
  - apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx
  - apps/mobile/src/screens/compat/CompatPassScreen.tsx
  - apps/mobile/src/navigation/RootNativeStack.tsx
  - apps/mobile/src/navigation/MainTabs.tsx
  - apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx
  - apps/mobile/__tests__/screens/CompatFailScreen.test.tsx
  - apps/mobile/__tests__/screens/CompatPassScreen.test.tsx
  - apps/mobile/__tests__/screens/TasksPlaceholderScreen.test.tsx
  - apps/mobile/__tests__/screens/HistoryPlaceholderScreen.test.tsx
  - apps/mobile/__tests__/navigation/RouteRegistry.test.tsx
  - apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/CompatPassScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx
  - apps/mobile/src/hooks/useForegroundUserRehydrate.ts
  - .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md
  - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md
requirements: []
autonomous: true
must_haves:
  truths:
    - useTabTopBarProps() hook is the single source of TopBar props (avatarInitial, avatarUrl, onAvatarPress) for Home + Tasks + History tabs
    - Tasks tab and History tab render the Google avatar identically to Home (no 'U' fallback when appStore.user is populated)
    - Foreground rehydrate hook fires fetchMe() when AppState transitions to 'active' AND appStore.user == null && jwt != null — repopulates the user slice before any avatar surface renders
    - Compat-fail and Compat-recovery are merged into a single CompatFailScreen (failure list + recovery body + Contact Support CTA in one scrollable screen); CompatRecoveryScreen.tsx + its test file are deleted
    - The route-registry invariant test no longer lists CompatRecovery as a registered route; CompatFail entry is preserved
    - Compat-pass auto-routes to the next onboarding step after ~1.5 s (no tap required); 40 ms haptic still fires
    - Final 5th [EMAIL_ADDRESS] → support@humynlabs.ai substitution lands inside the merged CompatFailScreen
    - 03-WAVE1-SMOKE.md exists with the operator re-walk runbook (per Phase 2 02-MANUAL-SMOKE.md pattern)
  artifacts:
    - path: apps/mobile/src/hooks/useTabTopBarProps.ts
      provides: shared TopBar props hook (avatarInitial, avatarUrl, onAvatarPress)
      exports: ['useTabTopBarProps']
    - path: apps/mobile/src/hooks/useForegroundUserRehydrate.ts
      provides: AppState-change-driven rehydrate hook firing fetchMe() when user is null + jwt is present
      exports: ['useForegroundUserRehydrate']
    - path: apps/mobile/src/screens/compat/CompatFailScreen.tsx
      provides: merged Compat-fail + Recovery screen with failure list + recovery body + Contact Support CTA
      contains: support@humynlabs.ai
    - path: .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md
      provides: operator re-walk runbook for Wave 2 acceptance gate (D-WAVE-08)
      contains: re-walked-on
  key_links:
    - from: apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx
      to: apps/mobile/src/hooks/useTabTopBarProps.ts
      via: const topBarProps = useTabTopBarProps()
      pattern: useTabTopBarProps\(\)
    - from: apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx
      to: apps/mobile/src/hooks/useTabTopBarProps.ts
      via: const topBarProps = useTabTopBarProps()
      pattern: useTabTopBarProps\(\)
    - from: apps/mobile/src/navigation/RootNativeStack.tsx
      to: apps/mobile/src/hooks/useForegroundUserRehydrate.ts
      via: useForegroundUserRehydrate() invoked at top of component
      pattern: useForegroundUserRehydrate\(\)
    - from: apps/mobile/src/screens/compat/CompatPassScreen.tsx
      to: navigation.replace('RigTutorial')
      via: setTimeout auto-advance after ~1500 ms
      pattern: setTimeout.*navigation\.(replace|navigate)
---

<objective>
Resolve every navigation-graph-touching entry from `02-COSMETIC-GAPS.md` (frozen 2026-05-10) — the second of two D-WAVE-05 plans. Lands AFTER Plans 03-01 + 03-02 so jest-image-snapshot baselines for the merged Compat-fail + the auto-advancing Compat-pass + Tasks/History TopBar avatars capture against a stable visual surface.

Purpose: per CONTEXT.md D-WAVE-03, Wave 1 explicitly includes the functional regressions surfaced during Phase 2 smoke. The Wave 2 acceptance gate (D-WAVE-08) requires both Wave 1 plans land + the operator on-device re-walk on Pixel 10a passes before HumynCapture native-module work begins.

Output: shared `useTabTopBarProps()` hook + `useForegroundUserRehydrate()` hook; Tasks + History TopBars render Google avatar; CompatFail + CompatRecovery merged; CompatPass auto-advances; route registry test updated; CompatRecovery route deleted; `03-WAVE1-SMOKE.md` runbook authored for operator re-walk.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md
@.planning/phases/03-humyn-capture-native-module/03-PATTERNS.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md
@apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/services/profileService.ts
@apps/mobile/02-MANUAL-SMOKE.md

<interfaces>
<!-- The HomeSkeletonScreen TopBar wiring (lines 31–45 of HomeSkeletonScreen.tsx) is the analog this plan extracts into a hook and re-applies in Tasks + History. -->

From apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (lines 31–45):

```tsx
const navigation = useNavigation<{ navigate: (route: string) => void }>();
const user = useAppStore((s) => s.user);
const avatarInitial = (
  (user?.name ?? user?.email ?? 'U').trim().slice(0, 1) || 'U'
).toUpperCase();

return (
  <ScreenContainer accessibilityLabel="Home screen" padding={0}>
    <TopBar
      onAvatarPress={() => navigation.navigate('Profile')}
      avatarInitial={avatarInitial}
      {...(user?.avatarUrl ? { avatarUrl: user.avatarUrl } : {})}
    />
    {/* ... */}
```

From apps/mobile/src/services/profileService.ts (line 70):

```ts
export async function fetchMe(): Promise<UserDisplay> {
  return apiClient.get<MeResponse>('/me');
}
```

From apps/mobile/src/state/appStore.ts (UserDisplay interface and setter):

```ts
export interface UserDisplay {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}
// store exposes setUser(user: UserDisplay) action
```

Pattern 54 (route-registry invariant test) — currently locks `Compat`, `CompatFail`, `CompatRecovery`, etc. as registered routes. This plan removes `CompatRecovery` from the locked-routes list.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract useTabTopBarProps() hook + wire to Home/Tasks/History tabs</name>
  <files>apps/mobile/src/hooks/useTabTopBarProps.ts, apps/mobile/src/screens/home/HomeSkeletonScreen.tsx, apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx, apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx, apps/mobile/__tests__/screens/TasksPlaceholderScreen.test.tsx, apps/mobile/__tests__/screens/HistoryPlaceholderScreen.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (lines 31–45 — the source pattern)
    - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx (current shape: TopBar with onAvatarPress only — missing avatarInitial / avatarUrl)
    - apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx (same regression as Tasks)
    - apps/mobile/src/state/appStore.ts (UserDisplay interface + selector pattern)
    - apps/mobile/src/components/TopBar.tsx (verify avatarUrl + avatarInitial prop names)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md ("Profile screen" → "Refactor candidate (Phase 3 W1)")
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("useTabTopBarProps() hook extract (D-WAVE-03)")
  </read_first>
  <action>
    Create `apps/mobile/src/hooks/useTabTopBarProps.ts` with the exact body below — extracted verbatim from `HomeSkeletonScreen.tsx` lines 32–37 + line 41–45 spread shape:

    ```tsx
    import { useNavigation } from '@react-navigation/native';
    import { useAppStore } from '../state/appStore';

    export interface TabTopBarProps {
      avatarInitial: string;
      avatarUrl?: string | undefined;
      onAvatarPress: () => void;
    }

    /**
     * Pattern 66 — single source of TopBar avatar props for the three MainTabs
     * tab bodies (Home / Tasks / History). Without this, Tasks + History
     * regressed to the 'U' fallback during Phase 2 §13 Crashlytics soak
     * (2026-05-10 — see 02-COSMETIC-GAPS.md "Profile screen").
     */
    export function useTabTopBarProps(): TabTopBarProps {
      const navigation = useNavigation<{ navigate: (route: string) => void }>();
      const user = useAppStore((s) => s.user);
      const avatarInitial = (
        (user?.name ?? user?.email ?? 'U').trim().slice(0, 1) || 'U'
      ).toUpperCase();
      return {
        avatarInitial,
        avatarUrl: user?.avatarUrl ?? undefined,
        onAvatarPress: () => navigation.navigate('Profile'),
      };
    }
    ```

    Then refactor the three consumers:

    **HomeSkeletonScreen.tsx** — replace lines 32–45 with:
    ```tsx
    const topBarProps = useTabTopBarProps();
    const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);
    return (
      <ScreenContainer accessibilityLabel="Home screen" padding={0}>
        <TopBar {...topBarProps} />
        {/* rest unchanged */}
    ```

    **TasksPlaceholderScreen.tsx** — replace `<TopBar onAvatarPress={() => navigation.navigate('Profile')} />` with `const topBarProps = useTabTopBarProps(); return (<><TopBar {...topBarProps} />/* ... */</>);`. Drop unused `useNavigation` import if no longer used.

    **HistoryPlaceholderScreen.tsx** — same edit as Tasks.

    Update existing screen tests `__tests__/screens/TasksPlaceholderScreen.test.tsx` and `HistoryPlaceholderScreen.test.tsx`:
      - Mock `appStore.user` with `{name: 'Alice', email: 'alice@x.com', avatarUrl: 'https://x/a.jpg', id: '1'}`
      - Render the screen
      - Assert `getByLabelText(/topbar/i)` (or whatever the TopBar accessibilityLabel is — check the component) renders with `avatarInitial="A"` (NOT "U")
      - Assert avatarUrl prop forwarded
      - Use the vi.hoisted spy binding pattern from Pattern 47 (Phase 2) when mocking `@react-navigation/native`

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/screens/HomeSkeletonScreen.test.tsx __tests__/screens/TasksPlaceholderScreen.test.tsx __tests__/screens/HistoryPlaceholderScreen.test.tsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/src/hooks/useTabTopBarProps.ts` exists with `export function useTabTopBarProps()` and exported `interface TabTopBarProps`
    - `grep -q "useTabTopBarProps" apps/mobile/src/screens/home/HomeSkeletonScreen.tsx`
    - `grep -q "useTabTopBarProps" apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx`
    - `grep -q "useTabTopBarProps" apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx`
    - `grep -q "avatarInitial" apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` returns no match (the prop spreads through `{...topBarProps}` — direct grep on the literal will miss; verify the spread instead)
    - `grep -E "<TopBar\\s+\\{\\.\\.\\.topBarProps\\}" apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx apps/mobile/src/screens/home/HomeSkeletonScreen.tsx | wc -l` returns ≥ 3
    - `cd apps/mobile && npx tsc --noEmit` exits 0
    - `cd apps/mobile && npm test -- --run __tests__/screens/HomeSkeletonScreen.test.tsx __tests__/screens/TasksPlaceholderScreen.test.tsx __tests__/screens/HistoryPlaceholderScreen.test.tsx` exits 0
  </acceptance_criteria>
  <done>useTabTopBarProps() hook extracted; Home + Tasks + History render the avatar identically.</done>
</task>

<task type="auto">
  <name>Task 2: Add foreground rehydrate hook (fires /me when user==null && jwt!=null on AppState 'active')</name>
  <files>apps/mobile/src/hooks/useForegroundUserRehydrate.ts, apps/mobile/src/navigation/RootNativeStack.tsx, apps/mobile/__tests__/navigation/ForegroundRehydrate.test.tsx</files>
  <read_first>
    - apps/mobile/src/navigation/RootNativeStack.tsx (top-level mount point — where the hook fires)
    - apps/mobile/src/state/appStore.ts (jwt field + user slice + setUser action)
    - apps/mobile/src/services/profileService.ts (fetchMe function — `apiClient.get<MeResponse>('/me')`)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md ("Profile screen" → "Avatar regresses to 'U' on app foreground after Android process kill")
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-05 plan 2 — option (a) preferred)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("Foreground rehydrate hook" section)
  </read_first>
  <action>
    Create `apps/mobile/src/hooks/useForegroundUserRehydrate.ts` with the exact body below:

    ```tsx
    import { useEffect } from 'react';
    import { AppState, type AppStateStatus } from 'react-native';
    import { useAppStore } from '../state/appStore';
    import { fetchMe } from '../services/profileService';

    /**
     * Pattern 67 — fires `/me` when the JS context rehydrates on Android
     * process kill: appStore.user is transient (Pattern 64; not MMKV-backed
     * by design — staleness-vs-backend trade-off). When MMKV restores jwt
     * but the user slice rehydrates as null, every avatar surface (Home /
     * Tasks / History TopBar, Profile) shows 'U' until ProfileScreen mount
     * fires fetchMe() — the tab TopBars NEVER fire it, so the regression
     * from 02-COSMETIC-GAPS.md "Profile screen" item 2 persists across the
     * whole tab surface.
     *
     * Hook fires on:
     *   1. Mount (cold boot) when user==null && jwt!=null.
     *   2. AppState change to 'active' when same condition holds (Android
     *      foreground from Recents after process kill).
     *
     * Errors are swallowed — the next ProfileScreen mount will retry.
     */
    export function useForegroundUserRehydrate(): void {
      useEffect(() => {
        const rehydrate = async () => {
          const { user, jwt, setUser } = useAppStore.getState();
          if (user == null && jwt != null) {
            try {
              const me = await fetchMe();
              setUser(me);
            } catch (_) { /* swallow — next ProfileScreen mount retries */ }
          }
        };
        rehydrate();
        const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
          if (s === 'active') void rehydrate();
        });
        return () => sub.remove();
      }, []);
    }
    ```

    Wire into `apps/mobile/src/navigation/RootNativeStack.tsx` at the top of the component body (before the Stack/Navigator JSX):

    ```tsx
    useForegroundUserRehydrate();
    ```

    And add the import at the top of the file: `import { useForegroundUserRehydrate } from '../hooks/useForegroundUserRehydrate';`.

    Author the test at `apps/mobile/__tests__/navigation/ForegroundRehydrate.test.tsx`:

      1. Mock `react-native` AppState with `vi.doMock` and a custom `addEventListener` that captures the callback handle (Pattern 47 vi.hoisted binding from Phase 2).
      2. Mock `appStore` initial state so `jwt='token'`, `user=null`, `setUser=vi.fn()`.
      3. Mock `fetchMe` so it resolves to `{id:'1', email:'a@x.com', name:'Alice', avatarUrl:'https://x/a.jpg'}`.
      4. Render a thin parent that calls `useForegroundUserRehydrate()`.
      5. Wait one microtask, assert `setUser` called with the resolved user.
      6. Reset mocks; simulate AppState change to `'active'`; assert `setUser` called again.
      7. Reset mocks; flip appStore so `user!=null`; simulate AppState change; assert `setUser` NOT called (short-circuit holds).

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/navigation/ForegroundRehydrate.test.tsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/src/hooks/useForegroundUserRehydrate.ts` exists with `export function useForegroundUserRehydrate()`
    - `grep -q "useForegroundUserRehydrate()" apps/mobile/src/navigation/RootNativeStack.tsx`
    - `grep -q "AppState.addEventListener" apps/mobile/src/hooks/useForegroundUserRehydrate.ts`
    - `apps/mobile/__tests__/navigation/ForegroundRehydrate.test.tsx` exists with at least 3 `it(...)` blocks (mount, AppState→active, no-op when user!=null)
    - `cd apps/mobile && npm test -- --run __tests__/navigation/ForegroundRehydrate.test.tsx` exits 0
    - `cd apps/mobile && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Foreground rehydrate hook lives at the navigator root; tab TopBars no longer regress to 'U' after Android process kill.</done>
</task>

<task type="auto">
  <name>Task 3: Merge CompatFail + CompatRecovery into one screen, delete CompatRecovery, update route registry, swap final [EMAIL_ADDRESS]</name>
  <files>apps/mobile/src/screens/compat/CompatFailScreen.tsx, apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx, apps/mobile/src/navigation/MainTabs.tsx, apps/mobile/__tests__/screens/CompatFailScreen.test.tsx, apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx, apps/mobile/__tests__/navigation/RouteRegistry.test.tsx, apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/compat/CompatFailScreen.tsx (parent — keep + extend)
    - apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx (child — body inlined; file deleted)
    - apps/mobile/src/navigation/RootNativeStack.tsx OR MainTabs.tsx (route registry — delete CompatRecovery entry)
    - apps/mobile/__tests__/navigation/RouteRegistry.test.tsx (or wherever Pattern 54 invariant lives — drop CompatRecovery from REQUIRED_PHASE_2_ROUTES)
    - apps/mobile/__tests__/screens/CompatFailScreen.test.tsx (keep + extend)
    - apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx (delete)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md ("Compat-fail screen" section — full merge spec)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md (OQ-1 5th [EMAIL_ADDRESS] occurrence resolution path)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("Compat-fail + Recovery merge (D-WAVE-05 plan 2)")
  </read_first>
  <action>
    **3A — Merge:** in `apps/mobile/src/screens/compat/CompatFailScreen.tsx`:

      1. Inline `CompatRecoveryScreen.tsx`'s render body AFTER the existing failure-list block, before the bottom-sheet/CTA region.
      2. Center-align content both horizontally and vertically: wrap the entire scroll body in `<ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>`.
      3. The "Contact Support" button stacks immediately under the recovery block with `alignSelf: 'center'` content-driven width (mirrors Plan 03-02 Task 2B Sign-up + Permissions CTA rule).
      4. Replace the literal `[EMAIL_ADDRESS]` (the 5th and final occurrence per Plan 03-02 Task 2D) with `support@humynlabs.ai` in the Contact Support mailto URL.
      5. Drop the legacy "What now?" CTA + `navigation.navigate('CompatRecovery')` call — recovery is now inline.

    **3B — Delete CompatRecovery files:**
      - Delete `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx`
      - Delete `apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx`

    **3C — Route registry:** find Pattern 54's invariant test (likely `apps/mobile/__tests__/navigation/RouteRegistry.test.tsx` or similar — search for `REQUIRED_PHASE_2_ROUTES` or `'CompatRecovery'` literal). Drop the `CompatRecovery` entry from the locked-routes list. Also remove the `CompatRecovery` `<Stack.Screen>` (or `<Tab.Screen>`) registration from `apps/mobile/src/navigation/RootNativeStack.tsx` / `MainTabs.tsx` — whichever Phase 2 plan 02-05 placed it in.

    **3D — Update + extend `CompatFailScreen.test.tsx`:**
      - Drop the previous `What now? → navigate('CompatRecovery')` test.
      - Add a test asserting the recovery body renders inline (`getByText(/try a different qualifying device/i)` or whatever the Recovery copy is).
      - Add a test asserting the Contact Support mailto URL contains `support@humynlabs.ai`.
      - Add a test asserting the failure list still renders the failed-checks rows.

    **3E — Visual snapshot test:** create `apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx` (mirrors the Plan 03-02 Task 3 visual-test pattern). Render the merged screen with a synthetic `compat.lastResult.v1` MMKV state that has 2 failed checks; capture baseline at `__image_snapshots__/CompatFailScreen.visual.test.tsx-snap.png`. The baseline lands AFTER the merge, so the snapshot reflects the post-merge layout.

    **3F — Update OQ-2 in `02-OPEN-QUESTIONS.md`:** the OQ-2 entry ("compat-fail 'what now' recovery copy needs final wording") is **superseded** — the wording pass now happens against the merged screen. Mark OQ-2 as `status: superseded-by-03-02-merge` and reference the new screen file path. Also mark OQ-1 (`[EMAIL_ADDRESS]`) as **resolved** since the 5th and final occurrence is replaced in this task.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && test ! -f src/screens/compat/CompatRecoveryScreen.tsx && test ! -f __tests__/screens/CompatRecoveryScreen.test.tsx && grep -q "support@humynlabs.ai" src/screens/compat/CompatFailScreen.tsx && npm test -- --run __tests__/screens/CompatFailScreen.test.tsx __tests__/navigation/RouteRegistry.test.tsx __tests__/visual/CompatFailScreen.visual.test.tsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `test ! -f apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` exits 0 (file deleted)
    - `test ! -f apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx` exits 0 (file deleted)
    - `grep -q "support@humynlabs.ai" apps/mobile/src/screens/compat/CompatFailScreen.tsx`
    - `grep -c '\[EMAIL_ADDRESS\]' apps/mobile/src/screens/compat/CompatFailScreen.tsx` returns `0`
    - `grep -q "'CompatRecovery'" apps/mobile/__tests__/navigation/RouteRegistry.test.tsx` returns no match (and same for the navigator file)
    - `grep -q "name=\"CompatRecovery\"" apps/mobile/src/navigation/RootNativeStack.tsx apps/mobile/src/navigation/MainTabs.tsx` returns no match
    - `cd apps/mobile && npm test -- --run __tests__/screens/CompatFailScreen.test.tsx __tests__/navigation/RouteRegistry.test.tsx` exits 0
    - `apps/mobile/__tests__/visual/__image_snapshots__/CompatFailScreen.visual.test.tsx-snap.png` exists
    - `02-OPEN-QUESTIONS.md` OQ-1 marked resolved AND OQ-2 marked superseded — `grep -E "OQ-1.*resolved|OQ-2.*superseded" .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` matches both
  </acceptance_criteria>
  <done>CompatFail + CompatRecovery merged into one screen; CompatRecovery files deleted; route registry updated; final [EMAIL_ADDRESS] replaced; OQ-1 resolved; OQ-2 superseded.</done>
</task>

<task type="auto">
  <name>Task 4: Compat-pass auto-advance + Tasks/History visual baselines + 03-WAVE1-SMOKE.md runbook</name>
  <files>apps/mobile/src/screens/compat/CompatPassScreen.tsx, apps/mobile/__tests__/screens/CompatPassScreen.test.tsx, apps/mobile/__tests__/visual/CompatPassScreen.visual.test.tsx, apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx, apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx, .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md</files>
  <read_first>
    - apps/mobile/src/screens/compat/CompatPassScreen.tsx (current "tap to continue" CTA shape)
    - apps/mobile/src/screens/splash/SplashScreen.tsx (timer-based auto-route analog for Pattern reuse)
    - apps/mobile/__tests__/screens/CompatPassScreen.test.tsx (existing CompatPass→next CTA test — replaces with auto-routes-after-N-ms)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-MANUAL-SMOKE.md (Phase 2 runbook shape — Pattern 56)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md ("Compat-pass screen" section)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-08 — Wave 2 acceptance gate steps; D-WAVE-09 — amendment protocol pointing at 03-W1-AMENDMENTS.md)
  </read_first>
  <action>
    **4A — Compat-pass auto-advance:** in `apps/mobile/src/screens/compat/CompatPassScreen.tsx`:

      1. Replace the existing "Continue" CTA Pressable with a transient success-state body (success badge + "You're in. All checks passed." copy + 40 ms haptic on mount).
      2. Add `useEffect(() => { const t = setTimeout(() => navigation.replace('RigTutorial'), 1500); return () => clearTimeout(t); }, []);` (or whichever next-onboarding-step route is used — verify in `RootNativeStack.tsx`; treat the pass state as a transient confirmation).
      3. Drop the manual CTA entirely. The screen now auto-routes after ~1.5 s.

    Update `apps/mobile/__tests__/screens/CompatPassScreen.test.tsx`:
      - Drop the existing `tap CTA → navigate('RigTutorial')` test.
      - Add a test that uses `vi.useFakeTimers()`, renders the screen, advances `vi.advanceTimersByTime(1500)`, asserts `navigation.replace` (or `.navigate`) was called with `'RigTutorial'`.
      - Add a test that asserts the 40 ms haptic still fires on mount.
      - Add a test that asserts no manual "Continue" Pressable is rendered (`queryByRole('button', { name: /continue/i })` returns null).

    **4B — Visual baselines for the post-merge surfaces:**
      - `apps/mobile/__tests__/visual/CompatPassScreen.visual.test.tsx` — render with mocked timer, capture baseline of the success-state body (no CTA visible).
      - `apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx` — render with mocked appStore.user, capture baseline showing the avatar (NOT 'U').
      - `apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx` — same.

    Run `cd apps/mobile && npm test -- --run __tests__/visual --update` to capture baselines. Inspect each PNG before commit.

    **4C — `03-WAVE1-SMOKE.md` runbook:** create `.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md` mirroring the Phase 2 `02-MANUAL-SMOKE.md` shape (Pattern 56). Required sections:

      - **Pre-flight:** Pixel 10a connected via adb (5C161JEA304304); apkRollout debug build installed; backend reachable.
      - **§1 Splash + animation re-check:** boot app cold, observe Splash logo cropping + 700 ms scalePop + 600 ms tagline fade. Acceptance: logo renders generously without resizing dance; animations match prototype.html timing.
      - **§2 Sign-up:** observe RethinkSans rendering; observe value-prop spacing tightened; observe CTA stacks under content with content-width.
      - **§3 Permissions:** observe CTA stacks under content with content-width.
      - **§4 Compat-fail merge:** simulate a compat-fail (force a check failure); observe failure list + recovery body + Contact Support all in one scrollable screen; tap mailto and confirm `support@humynlabs.ai`.
      - **§5 Compat-pass auto-advance:** observe success body for ~1.5 s; observe automatic route to RigTutorial without tapping; observe 40 ms haptic.
      - **§6 RigTutorial:** observe rig illustration (Plan 03-02 Task 2A + Plan 03-01 Task 1); observe Contact Support email.
      - **§7 Home tab:** observe wordmark + Lucide icons in BottomNav (Home / ListTodo / History) at ≥48 dp targets; observe Google avatar in TopBar.
      - **§8 Tasks tab:** TopBar Google avatar present.
      - **§9 History tab:** TopBar Google avatar present.
      - **§10 Profile:** existing surface unchanged.
      - **§11 Foreground rehydrate:** background app via Recents; force-stop via `adb shell am force-stop ai.humynlabs.capture.apk`; relaunch via Recents card. Observe TopBar avatar repopulates within 1-2 s of foreground (NOT 'U').
      - **Sign-off:** `re-walked-on: 2026-MM-DD` line at the bottom (operator fills in).
      - **New gap protocol (D-WAVE-09):** reminder that any new gap surfaced during this re-walk goes to `03-W1-AMENDMENTS.md`, NOT back into `02-COSMETIC-GAPS.md` (which is frozen 2026-05-10).

    Add a `T-3.2-01 visual snapshot CI gate ≥ 1 h soak` Crashlytics-equivalent line: confirm visual snapshot suite stays green in CI for 1 h after merge before declaring Wave 1 complete.

    The doc is operator-driven; this task does NOT execute the runbook (operator runs after both Wave 1 plans land per D-WAVE-08).

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/screens/CompatPassScreen.test.tsx __tests__/visual --reporter=verbose && test -f /Users/adnaan/Documents/hl-homelander/.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "setTimeout.*navigation\\.(replace|navigate)" apps/mobile/src/screens/compat/CompatPassScreen.tsx` matches
    - `grep -q "Continue" apps/mobile/src/screens/compat/CompatPassScreen.tsx` returns no match (CTA removed) — OR if "Continue" appears in copy unrelated to a button, verify there is no `<Pressable>` with onPress firing navigation
    - `apps/mobile/__tests__/visual/CompatPassScreen.visual.test.tsx` exists
    - `apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx` exists
    - `apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx` exists
    - 3 new PNG baselines exist under `apps/mobile/__tests__/visual/__image_snapshots__/`
    - `.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md` exists
    - `grep -q "re-walked-on:" .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md`
    - `grep -q "03-W1-AMENDMENTS.md" .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md`
    - `cd apps/mobile && npm test -- --run __tests__/screens/CompatPassScreen.test.tsx` exits 0 (auto-advance test passes)
  </acceptance_criteria>
  <done>Compat-pass auto-advances after 1.5 s; 3 new visual baselines captured; `03-WAVE1-SMOKE.md` runbook ready for operator re-walk.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                 | Description                                        |
| ---------------------------------------- | -------------------------------------------------- |
| JS context (Android process kill) → MMKV | jwt persists; appStore.user is transient by design |
| user → mailto                            | Contact Support mailto opens external mail app     |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                                    | Disposition | Mitigation Plan                                                                                                                                                                                                                               |
| --------- | ---------------------- | -------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.2-01  | Spoofing               | `useForegroundUserRehydrate` calls `/me` with whatever JWT is in MMKV                        | accept      | Phase 1 backend's `requireAuth` middleware verifies the JWT cryptographically; a stale/forged JWT fails the request and the catch block swallows the error (next ProfileScreen mount retries). Same trust model as ProfileScreen.tsx mount.   |
| T-3.2-02  | Information disclosure | mailto link with pre-filled body could leak diagnostic info to the user's mail draft         | accept      | The diagnostic snapshot pattern (Phase 2 plan 02-18) is opt-in (user taps "Report a problem"), NOT a passive mailto. Plain Contact Support mailto with `support@humynlabs.ai` ships no PII.                                                   |
| T-3.2-03  | DoS                    | `useForegroundUserRehydrate` could fire `/me` rapidly on AppState thrash                     | mitigate    | Hook checks `user == null && jwt != null` before dispatching — once the rehydrate fires and `setUser` populates, subsequent AppState 'active' events are short-circuited. Phase 1 backend `/me` rate limit (per-user 60/min) is the backstop. |
| T-3.2-04  | Tampering              | Route registry test could be circumvented by editing the test's REQUIRED_PHASE_2_ROUTES list | accept      | Pattern 54 (the test) is in-repo; PR review surfaces unintended route-registry changes. CompatRecovery removal is exactly the kind of edit the test is designed to flag — the PR delta makes the change explicit.                             |
| T-3.2-05  | DoS                    | CompatPass `setTimeout` could be cancelled mid-flight by rapid back-press                    | mitigate    | useEffect cleanup `clearTimeout(t)` cancels the pending route call on unmount. Manual back-press during the 1.5 s window unmounts the screen and the navigation never fires — same behavior as the pre-merge "didn't tap Continue" path.      |

</threat_model>

<verification>
- All Wave 1 acceptance criteria from `02-COSMETIC-GAPS.md` resolved (visual + functional).
- `cd apps/mobile && npm test` exits 0 (full mobile suite green).
- `cd apps/mobile && npx tsc --noEmit` exits 0.
- `git status` shows the 5 deleted entries (CompatRecoveryScreen.tsx + its test, plus the 3 prior assets) and the 14+ modified/new files this plan owns.
- 9 visual baselines in `__image_snapshots__/` (6 from Plan 03-02 + 3 new from this plan — CompatFail merged, CompatPass auto-advance, Tasks/History TopBar avatar).

Operator-driven follow-up (D-WAVE-08 acceptance gate — NOT in this plan's executable scope):

- Operator re-walks `03-WAVE1-SMOKE.md` on Pixel 10a; signs off with `re-walked-on:` stamp.
- Wave 2 (HumynCapture native module — Plan 03-04 onward) is gated on this sign-off.
  </verification>

<success_criteria>

- ✓ `useTabTopBarProps()` hook is the single source of TopBar avatar props for all 3 tab bodies (Home / Tasks / History).
- ✓ `useForegroundUserRehydrate()` hook lives at the navigator root; fires `/me` on AppState 'active' when user==null && jwt!=null.
- ✓ CompatFail + CompatRecovery merged into one centered, scrollable screen with inline recovery body.
- ✓ CompatRecoveryScreen.tsx + its test deleted; CompatRecovery removed from route registry + Pattern 54 invariant.
- ✓ CompatPass auto-routes to RigTutorial after ~1.5 s; manual CTA removed; haptic preserved.
- ✓ 5th and final `[EMAIL_ADDRESS]` replaced with `support@humynlabs.ai` inside the merged CompatFail.
- ✓ OQ-1 marked `resolved`; OQ-2 marked `superseded-by-03-02-merge`.
- ✓ 9 jest-image-snapshot baselines (6 from 03-02 + 3 new) committed.
- ✓ `03-WAVE1-SMOKE.md` runbook authored with operator re-walk steps + amendment protocol pointing at `03-W1-AMENDMENTS.md` (D-WAVE-09).
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-03-SUMMARY.md` per the canonical summary template — including:

- Pattern 66 callout (`useTabTopBarProps`) and Pattern 67 callout (`useForegroundUserRehydrate`).
- Phase-2 → Phase-3-W1 carryforward note: 02-COSMETIC-GAPS.md remains the historical record (frozen-2026-05-10); any new gaps the operator surfaces during the re-walk land in `03-W1-AMENDMENTS.md` per D-WAVE-09.
- Wave 2 gate state: "Both Wave 1 plans landed; awaiting operator re-walk on Pixel 10a per `03-WAVE1-SMOKE.md` D-WAVE-08 step 3 + 4 sign-off."
  </output>
