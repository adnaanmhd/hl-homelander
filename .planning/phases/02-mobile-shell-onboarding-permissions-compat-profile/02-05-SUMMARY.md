---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 05
subsystem: navigation
tags:
  [
    react-navigation,
    native-stack,
    bottom-tabs,
    deep-linking,
    home-07,
    home-08,
    d-nav-01,
    d-nav-02,
    d-nav-03,
    d-nav-04,
    gate-decision-tree,
  ]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'Phase 2 RN-ecosystem deps installed (02-02), Zustand store + hydrate + computeInitialRoute (02-03), UI primitives (Text/Pressable/Icon/ScreenContainer 02-02)'
provides:
  - 'apps/mobile/src/navigation/RootNativeStack.tsx — top-level navigator with 5 sibling routes (OnboardingStack, MainTabs, Profile, HelpCenter, ForceUpgrade); initialRouteName via computeInitialRoute(state, sig)'
  - 'apps/mobile/src/navigation/OnboardingStack.tsx — pre-MainTabs flow (Splash → Signup → Permissions → Compat[Running/Pass/Fail/Recovery] → RigTutorial); gestureEnabled=false (D-NAV-04 — no back on Permissions/Compat/Tutorial)'
  - 'apps/mobile/src/navigation/MainTabs.tsx — 3-tab bottom navigator (Home/Tasks/History) — HOME-07 structural'
  - 'apps/mobile/src/navigation/linking.ts — humyn:// deep-link config covering Phase 2 routes; Phase 4/6 routes resolve to placeholders'
  - 'apps/mobile/src/components/TopBar.tsx — 48 px screen chrome (Humyn wordmark + 36 px avatar Pressable wired to Profile route)'
  - 'apps/mobile/src/components/BottomNav.tsx — custom tabBar callback rendering exactly 3 Pressables with accessibilityLabel="{Name} tab"'
  - 'apps/mobile/App.tsx — Phase 2 root: enableScreens(true) + hydrate() before render; SafeAreaProvider → NavigationContainer(linking) → RootNativeStack'
  - '13 stub screens + 2 placeholder screens (Tasks, History) — every Phase 2 plan that fills a screen body has a named route to push/replace into'
  - 'apps/mobile/src/services/compatSignature.ts — sync stub returning null (real impl lands in plan 02-16)'
affects:
  - "plan 02-08 (versionService): replaces ForceUpgradeScreen + SplashScreen stub bodies; calls navigation.replace('ForceUpgrade') when forceUpgradeBlocked flips"
  - "plan 02-09 (Sign-up screen): replaces SignupScreen stub body; uses useNavigation().replace('Permissions')"
  - "plan 02-10 (Permissions screen): replaces PermissionsScreen stub body; navigates to 'Compat' on success"
  - "plan 02-11 (Compat service + Compat[Running] screen): replaces CompatRunningScreen stub body; on result navigates to 'CompatPass' or 'CompatFail'"
  - "plan 02-12 (CompatPass/Fail/Recovery): replaces those stub bodies; on pass navigates to 'RigTutorial' or 'MainTabs'"
  - "plan 02-13 (Rig tutorial): replaces RigTutorialScreen body; on done navigates to 'MainTabs'"
  - 'plan 02-15 (Home screen + global ParamList): replaces HomeSkeletonScreen body; declares the global RootNativeStack ParamList that linking.ts can drop the local NestedPathMap workaround for'
  - 'plan 02-16 (compat signature): replaces compatSignature.ts stub with the real sha256(versionCode|fingerprint|installation_id) implementation, activating AUTH-11 cross-device re-run'
  - 'plan 02-19 (Profile screen): replaces ProfileScreen stub body; reachable via TopBar avatar tap from Home/Tasks/History'
  - 'plan 02-20 (Help Center screen): replaces HelpCenterScreen stub body'
  - 'every Phase 2 screen test from plan 02-09 onward: vitest.setup.ts now invokes the bottom-tabs tabBar callback so tests can assert tab labels; lucide-react-native mock pre-populates Phase 2 icons'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern: HOME-07 / HOME-08 satisfaction is STRUCTURAL — MainTabs.tsx registers exactly 3 Tab.Screen elements (no fourth path in source); Profile/HelpCenter/ForceUpgrade are RootNativeStack siblings, never tab children. The structural choice means the tab bar physically cannot render on those routes (no conditional logic, no runtime check) — the navigator graph itself is the contract. A future plan adding a 4th tab MUST modify MainTabs.tsx; no other code path can mount one.'
    - "Pattern: gestureEnabled=false at the OnboardingStack screenOptions level enforces D-NAV-04 once for every screen inside it. Per-screen overrides ride on top (Signup adds animation:'fade') but the no-back default applies uniformly to Permissions/Compat[Running/Pass/Fail/Recovery]/RigTutorial without per-screen boilerplate."
    - 'Pattern: TopBar lives inside the screen body (HomeSkeletonScreen, TasksPlaceholder, HistoryPlaceholder) — NOT in MainTabs.screenOptions.header. This keeps the tab bar a pure 3-button row and lets each tab decide whether to render TopBar (Phase-6 deep links to Tasks/History keep the chrome consistent) or omit it (a future immersive view).'
    - "Pattern: linking.ts uses a hand-typed RootPathConfig (NestedPathMap) instead of LinkingOptions<RootParamList>. Reason: Phase 2 hasn't declared the global ParamList yet (lands in plan 02-15); the LinkingOptions generic forces a strict cross-check that errors on every nested screens block. The cast happens at the App.tsx container boundary so linking.ts itself stays pure config."
    - 'Pattern: RootNativeStack reads useAppStore.getState() at mount (NOT useAppStore() with the hook). Reason: initialRouteName is computed once per mount from the already-hydrated store; using the hook would re-render on every store update and React Navigation does not re-evaluate initialRouteName after first mount anyway.'
    - "Pattern: vitest.setup.ts bottom-tabs mock now invokes tabBar(props) so tests can render BottomNav and assert tab labels. Phase 2 test seam — Phase 1 didn't have a tab navigator so the original mock was a pure passthrough. Synthetic state.routes is built from React.Children name props."
    - "Pattern: lucide-react-native mock pre-populates Phase 2 icon names (Home, ListTodo, History, etc.) instead of relying on a Proxy fallback. Reason: Vitest 4 ES-module namespace strictness — `import * as X` reads the factory return value's enumerable own keys at module-init time; a bare Proxy doesn't expose any. Allow-list extends as plans land."

key-files:
  created:
    - "apps/mobile/src/components/TopBar.tsx (~75 LOC) — 48 px header with Humyn wordmark + 36 px avatar Pressable. onAvatarPress prop wired by HomeSkeletonScreen / Tasks / History to navigation.navigate('Profile')."
    - 'apps/mobile/src/components/BottomNav.tsx (~85 LOC) — custom tabBar callback for createBottomTabNavigator. 3 Pressables with accessibilityRole="tab" + accessibilityLabel="{Name} tab". Active = colors.accent + strokeWidth 2.25; inactive = colors.text2 + strokeWidth 1.75.'
    - 'apps/mobile/src/screens/{splash,signup,permissions,compat[4],tutorial,home,profile,help,force-upgrade}/*.tsx (13 stub screens) — each ~10 LOC; ScreenContainer + Text wrap so accessibilityLabel="{Name} screen" is queryable. Bodies replaced by 02-08..20.'
    - 'apps/mobile/src/screens/tasks/TasksPlaceholder.tsx, apps/mobile/src/screens/history/HistoryPlaceholder.tsx — Phase 6 placeholders with TopBar chrome and "Coming in Phase 6" copy.'
    - 'apps/mobile/src/navigation/RootNativeStack.tsx (~70 LOC) — 5 sibling routes; initialRouteName via computeInitialRoute(getState(), computeCompatSignatureSync()).'
    - 'apps/mobile/src/navigation/OnboardingStack.tsx (~35 LOC) — 8 screens with gestureEnabled=false default.'
    - 'apps/mobile/src/navigation/MainTabs.tsx (~25 LOC) — 3 Tab.Screen registrations, custom BottomNav tabBar.'
    - 'apps/mobile/src/navigation/linking.ts (~50 LOC) — humyn:// prefix; OnboardingStack, MainTabs, Profile, HelpCenter routes; hand-typed NestedPathMap.'
    - 'apps/mobile/src/services/compatSignature.ts (10 LOC) — sync stub returning null. Real signature compute (sha256 over versionCode|fingerprint|installation_id) lands in plan 02-16.'
    - 'apps/mobile/__tests__/navigation/RootNativeStack.test.tsx (3 cases) — fresh boot routes to Splash; all-pass routes to Home tab; Profile/HelpCenter/ForceUpgrade are reachable as Root-level siblings.'
    - 'apps/mobile/__tests__/navigation/MainTabs.test.tsx (2 cases) — exactly 3 tab labels; no Profile tab.'
    - 'apps/mobile/__tests__/navigation/linking.test.ts (5 cases) — humyn:// prefix; signup mapping; home mapping; Profile/HelpCenter as Root siblings; tasks/history mappings.'
  modified:
    - 'apps/mobile/App.tsx — full rewrite: enableScreens(true) + hydrate() before render; SafeAreaProvider → NavigationContainer(linking) → RootNativeStack. LinkingOptions cast at the container boundary.'
    - 'apps/mobile/vitest.setup.ts — bottom-tabs mock now invokes tabBar(props) with synthetic state derived from Children name props; lucide-react-native mock pre-populates Phase 2 icon names instead of relying on a Proxy fallback.'
  deleted:
    - "apps/mobile/src/screens/SignIn.tsx — Phase 1's only screen; superseded by the OnboardingStack/Signup stub (real Sign-up screen lands in 02-09)."
    - "apps/mobile/__tests__/SignIn.test.tsx — Phase 1 SignIn test; the sign-in flow's test coverage moves to 02-09's Signup screen test."

key-decisions:
  - "Used a hand-typed NestedPathMap in linking.ts instead of LinkingOptions<RootParamList>. Reason: Phase 2 hasn't declared the global ParamList yet (lands in plan 02-15). The generic ParamList check fails on nested screens blocks. NestedPathMap keeps the runtime config shape correct; the cast happens once at the App.tsx container boundary. Plan 02-15 will replace the workaround with a proper RootStackParamList declaration."
  - "Stubbed apps/mobile/src/services/compatSignature.ts to return null. Reason: the real signature compute is sha256(versionCode | Build.FINGERPRINT | installation_id) which depends on (a) computeCompatSignature wiring through to Kotlin (Build.FINGERPRINT) — that's plan 02-16's job, and (b) the installation_id sync read which is already provided by 02-04. computeInitialRoute trusts a null signature (offline-boot caveat documented in initialRoute.ts), so the gate runs through Compat → Pass → Tutorial → MainTabs cleanly without AUTH-11 firing prematurely. AUTH-11 fully activates when 02-16 lands."
  - "vitest.setup.ts bottom-tabs mock now invokes tabBar(props) with synthetic state. Reason: Phase 1's mock was a pure passthrough (no tab navigator existed). Phase 2 plan 02-05's MainTabs test asserts the rendered BottomNav exposes 3 accessibility labels — without invoking the callback the labels never reach the DOM. Synthetic state.routes is derived from React.Children name props, so the mock is generic across any future bottom-tab navigator (Phase 6 may stand up additional ones)."
  - "vitest.setup.ts lucide-react-native mock now pre-populates Phase 2 icon names instead of relying on a bare Proxy fallback. Reason: Vitest 4's ES-module namespace strictness — `import * as X` reads the factory return value's enumerable own keys at module-init time; a Proxy that traps `get` doesn't expose any keys, so `LucideIcons[name]` (in Icon.tsx) gets undefined. Pre-populating Home/ListTodo/History/etc. as plain object properties resolves the namespace lookup. Future plans add to the allow-list as they import new icons."
  - "TopBar uses colors.accent as the avatar background instead of the design-spec gradient (#FFC09F → #FF6A2D). Reason: react-native-linear-gradient is not in the Phase 2 dep tree (it's queued for plan 02-15 with the real Home screen). Solid accent is visually faithful enough for the navigator skeleton; plan 02-19 (Profile) and 02-15 (Home) will land the proper gradient when the avatar component graduates from stub to real."
  - "Added a 6th deviation beyond the plan-stated test set (linking has 5 tests not 1). Reason: the plan specifies a single linking.test.ts assertion; the implementation tests 5 specific path mappings (signup, home, tasks, history, profile, help) plus the prefix check. Each maps a Phase 2 screen plan's deep-link entry from engineering-handoff.md §3.4 — losing any one of them silently breaks an entry. Cost: 4 extra test lines."
  - 'App.tsx and the Phase 1 SignIn deletion split into 2 commits (3cd50ad + b3791ca) instead of 1. Reason: the initial `git add` ran before `git rm` had been recorded as deletions, so the first commit captured only the deletions. Per the never-amend rule the App.tsx body landed in a follow-up commit. Both commits are tagged feat(02-05) / refactor(02-05) so the plan provenance is unambiguous.'

patterns-established:
  - 'Pattern: every screen body wraps in <ScreenContainer accessibilityLabel="{Name} screen">. Stubs and placeholders alike use this; subsequent plans replace the body but preserve the accessibilityLabel so the navigator-tree tests remain stable.'
  - 'Pattern: the avatar-tap → Profile flow is anchored at TopBar.onAvatarPress. Three call sites today (HomeSkeletonScreen, TasksPlaceholder, HistoryPlaceholder); plan 02-19 swaps the stub Profile body for the real one but the entry path is fixed here.'
  - 'Pattern: humyn:// deep links into Phase-4/6-only routes (humyn://record/{taskId}, humyn://tasks/{taskId}, humyn://history/{recordingId}) currently land on the Phase 2 placeholders. The placeholders show "Coming in Phase 6" so a successful deep-link still produces something coherent — Phase 6 plans will register the param-bearing routes at MainTabs.Tasks.screens.detail / MainTabs.History.screens.detail levels without changing the prefix or the host config.'

requirements-completed: [HOME-07, HOME-08]

# Metrics
duration: ~22min
completed: 2026-05-09
---

# Phase 2 Plan 05: Navigation skeleton — Summary

**React Navigation v7 graph stood up with HOME-07 (3 tabs only) + HOME-08 (suppression) satisfied STRUCTURALLY: MainTabs registers exactly 3 Tab.Screen elements; Profile/HelpCenter/ForceUpgrade are RootNativeStack siblings (no tab bar can render on them). 13 stub screens + 2 placeholders + TopBar/BottomNav primitives + humyn:// deep-link config + App.tsx rewrite (hydrate + NavigationContainer) ship together. Phase 1 SignIn deleted; replacement comes in 02-09. Full mobile suite 44/44 green.**

## Performance

- **Duration:** ~22 min including TDD red/green for Task 2 + the linking.ts type workaround + the lucide-react-native mock fix.
- **Tasks:** 3 of 3 executed (all autonomous; Task 2 was tdd=true)
- **Commits:** 5 (Task 1, Task 2 RED tests, Task 2 GREEN sources, Task 3 SignIn deletion, Task 3 App.tsx rewrite)
- **Files created:** 23 (16 source modules + 1 service stub + 3 navigation tests + 3 path-of-test layout)
- **Files modified:** 2 (apps/mobile/App.tsx, apps/mobile/vitest.setup.ts)
- **Files deleted:** 2 (apps/mobile/src/screens/SignIn.tsx, apps/mobile/\_\_tests\_\_/SignIn.test.tsx)
- **Test delta:** +7 net (10 new navigation tests, 3 SignIn tests removed); 44 / 44 green

## Accomplishments

- **Navigation skeleton in place (Tasks 1-3).** Subsequent screen plans (02-08, 02-09, 02-10, 02-11, 02-12, 02-13, 02-15, 02-19, 02-20) push/replace into named routes ('Permissions', 'Compat', 'CompatPass', 'CompatFail', 'CompatRecovery', 'RigTutorial', 'MainTabs', 'Profile', 'HelpCenter', 'ForceUpgrade') without further nav work.
- **HOME-07 + HOME-08 satisfied structurally.** MainTabs registers exactly 3 Tab.Screen children (`grep -c "Tab.Screen" src/navigation/MainTabs.tsx` → 3). Profile/HelpCenter/ForceUpgrade are mounted as RootNativeStack siblings, so the bottom tab bar physically cannot render on those routes.
- **TopBar avatar-tap → Profile route wired.** HomeSkeletonScreen, TasksPlaceholder, and HistoryPlaceholder all render `<TopBar onAvatarPress={() => navigation.navigate('Profile')} />`. Plan 02-19 will swap the Profile stub body without touching the entry-path wiring.
- **Deep-link config covers every Phase 2 route from engineering-handoff §3.4.** humyn://signup, humyn://permissions, humyn://home, humyn://tasks, humyn://history, humyn://profile, humyn://help all resolve. Phase 4/6 routes (humyn://record/{taskId}, humyn://tasks/{taskId}, humyn://history/{recordingId}) currently land on the Phase 2 placeholders.
- **App.tsx hydrates Zustand synchronously before NavigationContainer mounts.** RootNativeStack reads `useAppStore.getState()` once on render to compute initialRouteName via `computeInitialRoute(state, sig)`. Plan 02-03's gate-decision tree drives the Splash/Permissions/Compat/RigTutorial/MainTabs decision today, with AUTH-11 lying dormant (compatSignature is a null-returning stub) until plan 02-16 wires the real signature.
- **vitest test infra extended cleanly.** bottom-tabs mock now invokes the tabBar callback with synthetic state derived from React.Children, so MainTabs.test asserts the rendered BottomNav exposes 3 accessibility-labelled Pressables. lucide-react-native mock pre-populates Phase 2 icon names so `import * as` namespace lookups resolve under Vitest 4 ES strictness.

## Initial-route gate-decision tree → route mapping (executor reference)

For follow-on plans that need to know which screen mounts under which gate state:

| Gate state                                      | computeInitialRoute returns                              | Mounts under RootNativeStack |
| ----------------------------------------------- | -------------------------------------------------------- | ---------------------------- |
| forceUpgradeBlocked = true                      | `{ stack: 'ForceUpgrade', params: { hardBlock: true } }` | `ForceUpgrade` (modal)       |
| jwt missing                                     | `{ stack: 'OnboardingStack', screen: 'Splash' }`         | `OnboardingStack`            |
| permsGranted missing OR camera/mic = false      | `{ stack: 'OnboardingStack', screen: 'Permissions' }`    | `OnboardingStack`            |
| compatPassed missing OR signature stale (sig≠s) | `{ stack: 'OnboardingStack', screen: 'Compat' }`         | `OnboardingStack`            |
| tutorialDone = false                            | `{ stack: 'OnboardingStack', screen: 'RigTutorial' }`    | `OnboardingStack`            |
| all green                                       | `{ stack: 'MainTabs' }`                                  | `MainTabs`                   |

Inside OnboardingStack the inner `screen` value selects the actual screen (Splash | Signup | Permissions | Compat | CompatPass | CompatFail | CompatRecovery | RigTutorial). RootNativeStack's `rootInitialRouteName()` only chooses the OUTER navigator name (one of 'OnboardingStack' | 'MainTabs' | 'ForceUpgrade'); inside-OnboardingStack route selection happens via `navigation.replace('Permissions')` from Splash/Signup once 02-08 / 02-09 land.

## Route-name registry (executor reference)

```
RootNativeStack
├── OnboardingStack            (gestureEnabled=false default)
│   ├── Splash
│   ├── Signup                 (animation='fade')
│   ├── Permissions
│   ├── Compat                 (running)
│   ├── CompatPass
│   ├── CompatFail
│   ├── CompatRecovery
│   └── RigTutorial
├── MainTabs                   (3 tabs only — HOME-07)
│   ├── Home
│   ├── Tasks
│   └── History
├── Profile                    (Root sibling — HOME-08; headerShown:true)
├── HelpCenter                 (Root sibling — HOME-08; headerShown:true)
└── ForceUpgrade               (Root sibling — modal, gestureEnabled=false)
```

## Task Commits

Each task committed atomically:

1. **Task 1: stub screens + TopBar/BottomNav primitives** — `5665458` (feat)
2. **Task 2 RED: failing nav tests** — `ad4c875` (test)
3. **Task 2 GREEN: RootNativeStack + OnboardingStack + MainTabs + linking** — `b5e0c28` (feat)
4. **Task 3a: delete Phase 1 SignIn (.tsx + test)** — `3cd50ad` (refactor)
5. **Task 3b: rewrite App.tsx (hydrated NavigationContainer)** — `b3791ca` (feat)

_Plan was `autonomous: true` with `tdd: true` on Task 2. RED/GREEN executed cleanly; no REFACTOR commit needed._

## Files Created/Modified

### Created (23)

#### Components

- `apps/mobile/src/components/TopBar.tsx` — 48 px chrome with Humyn wordmark + 36 px avatar Pressable. Avatar background uses `colors.accent` solid (gradient deferred to plan 02-15/19 — react-native-linear-gradient not in Phase 2 dep tree).
- `apps/mobile/src/components/BottomNav.tsx` — custom tabBar callback. 3 Pressables, accessibilityRole="tab", `accessibilityLabel="{Home|Tasks|History} tab"`, active tint = colors.accent + strokeWidth 2.25, inactive = colors.text2 + strokeWidth 1.75. Top hairline border in colors.line.

#### Screens — stubs (13)

- `splash/SplashScreen.tsx`, `signup/SignupScreen.tsx`, `permissions/PermissionsScreen.tsx`
- `compat/CompatRunningScreen.tsx`, `CompatPassScreen.tsx`, `CompatFailScreen.tsx`, `CompatRecoveryScreen.tsx`
- `tutorial/RigTutorialScreen.tsx`
- `home/HomeSkeletonScreen.tsx`
- `profile/ProfileScreen.tsx`
- `help/HelpCenterScreen.tsx`
- `force-upgrade/ForceUpgradeScreen.tsx`

Each stub is ~10 LOC: `<ScreenContainer accessibilityLabel="{Name} screen"><Text variant="title28">{Name}</Text></ScreenContainer>`. HomeSkeletonScreen, TasksPlaceholder, HistoryPlaceholder additionally render `<TopBar onAvatarPress={...} />`.

#### Screens — placeholders (2)

- `tasks/TasksPlaceholder.tsx`, `history/HistoryPlaceholder.tsx` — same shape as the stubs but with TopBar chrome + "Coming in Phase 6" body so a Phase-6 deep link still lands on something coherent.

#### Navigation

- `navigation/RootNativeStack.tsx` — 5 sibling routes; computes initialRouteName via `computeInitialRoute(useAppStore.getState(), computeCompatSignatureSync())`.
- `navigation/OnboardingStack.tsx` — 8 screens, gestureEnabled=false default.
- `navigation/MainTabs.tsx` — 3 Tab.Screen registrations, custom BottomNav tabBar.
- `navigation/linking.ts` — humyn:// prefix; hand-typed NestedPathMap (LinkingOptions generic awaits 02-15 ParamList).

#### Service

- `services/compatSignature.ts` — sync stub `computeCompatSignatureSync(): string | null` returning `null`. Real implementation lands in plan 02-16.

#### Tests (3 files, 10 cases)

- `__tests__/navigation/RootNativeStack.test.tsx` — fresh boot → Splash; all-pass → Home tab; Profile/HelpCenter/ForceUpgrade reachable as Root-level siblings.
- `__tests__/navigation/MainTabs.test.tsx` — exactly 3 tab labels; no Profile tab.
- `__tests__/navigation/linking.test.ts` — humyn:// prefix; signup → OnboardingStack/Signup; home → MainTabs/Home; Profile + HelpCenter at Root level; tasks + history paths.

### Modified (2)

- `apps/mobile/App.tsx` — full rewrite: `enableScreens(true)` + `hydrate()` before render; SafeAreaProvider → NavigationContainer(linking) → RootNativeStack. LinkingOptions cast at the container boundary.
- `apps/mobile/vitest.setup.ts` — bottom-tabs mock invokes tabBar(props) with synthetic state derived from Children; lucide-react-native mock pre-populates Phase 2 icon names instead of relying on a Proxy fallback.

### Deleted (2)

- `apps/mobile/src/screens/SignIn.tsx` — Phase 1's only screen; superseded by the OnboardingStack/Signup stub. Real Sign-up screen lands in plan 02-09 (covers the same auth flow plus consent + Terms-of-Use modal + animated logo).
- `apps/mobile/__tests__/SignIn.test.tsx` — Phase 1 SignIn test; coverage moves to 02-09's Signup screen test.

## Decisions Made

- **Hand-typed NestedPathMap in linking.ts.** React Navigation's `LinkingOptions<RootParamList>` cross-checks every nested `screens` block against the global ParamList. Phase 2 hasn't declared one yet — that lands in plan 02-15. NestedPathMap keeps the runtime config shape correct; the cast happens once at the App.tsx container boundary. Plan 02-15 will replace this with a proper RootStackParamList declaration that the existing linking.ts consumes without further changes.
- **Stubbed `computeCompatSignatureSync()` returning null.** Real signature compute (sha256 over versionCode | Build.FINGERPRINT | installation_id) depends on Kotlin Build.FINGERPRINT plumbing (plan 02-16) that's out of scope here. computeInitialRoute trusts a null signature per the offline-boot caveat in initialRoute.ts; AUTH-11 only trips when the signature is non-null AND mismatches. So the navigator works correctly today (all-pass state lands on MainTabs) and AUTH-11 activates the moment 02-16 lands the real compute.
- **vitest.setup.ts bottom-tabs mock now invokes tabBar.** Phase 1's mock was a pure passthrough; the new mock derives synthetic `state.routes` from React.Children name props and calls `tabBar({state, navigation: {emit, navigate}})`. Generic across any bottom-tab navigator that might land in Phase 6.
- **vitest.setup.ts lucide-react-native mock pre-populates icons (allow-list pattern).** Vitest 4's strict ES module namespace handling: `import * as X` only sees the factory return value's enumerable own keys at module-init time; a Proxy `get` trap is never exercised through the namespace wrapper. Allow-list (`Home`, `ListTodo`, `History`, ...) is extended as plans land.
- **TopBar avatar uses solid colors.accent (not gradient).** react-native-linear-gradient is not in the Phase 2 dep tree (queued for plan 02-15 / 02-19 with real avatar work). Solid accent is visually faithful enough for the navigator skeleton.
- **Two commits for Task 3 instead of one** (3cd50ad refactor + b3791ca feat). The initial `git add apps/mobile/App.tsx __tests__/SignIn.test.tsx src/screens/SignIn.tsx` failed because git rm had already removed the tree entries; the App.tsx change wasn't picked up. Per the never-amend rule, the App.tsx rewrite landed in a follow-up commit. Both tagged with `02-05` so plan provenance is unambiguous.
- **5 linking tests vs the plan's 1.** Each maps a Phase 2 screen plan's deep-link entry from engineering-handoff §3.4. Losing any one silently breaks a humyn:// path. Cost: 4 extra test lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] LinkingOptions generic strictness blocked typecheck.**

- **Found during:** Task 2 GREEN, immediately after authoring linking.ts.
- **Issue:** `LinkingOptions<RootParamList>` requires the global ParamList to enumerate every nested screen. Phase 2 hasn't declared one yet (plan 02-15's job). The plan-body example used `LinkingOptions<any>` which the project's `exactOptionalPropertyTypes: true` tsconfig rejects.
- **Fix:** Hand-typed `NestedPathMap` interface in linking.ts; cast at the App.tsx container boundary via `LinkingOptions<Record<string, never>>`. Linking.ts itself stays free of `any`.
- **Files modified:** `apps/mobile/src/navigation/linking.ts` (added NestedPathMap type), `apps/mobile/App.tsx` (cast at NavigationContainer boundary).
- **Commits:** `b5e0c28` + `b3791ca`.

**2. [Rule 3 - Blocking] Vitest 4 ES-module namespace strictness broke the lucide-react-native Proxy mock.**

- **Found during:** Task 2 GREEN, when MainTabs.test rendered through Icon.tsx for the first time.
- **Issue:** Phase 1's mock used `vi.mock('lucide-react-native', () => new Proxy({}, {get: ...}))`. Vitest 4 enforces strict ES module namespace handling: `import * as LucideIcons` reads the factory return value's enumerable own keys at module-init time; a bare Proxy with a `get` trap exposes no own keys, so `LucideIcons[name]` returns undefined. Error: `No "Home" export is defined on the "lucide-react-native" mock.`
- **Fix:** Pre-populate Phase 2 icon names (Home, ListTodo, History, plus a defensive set) as plain object properties in the factory return value. Allow-list extends as plans land.
- **Files modified:** `apps/mobile/vitest.setup.ts`.
- **Commit:** `b5e0c28`.

**3. [Rule 3 - Blocking] vi.mock hoisting broke the RootNativeStack store-spy reference.**

- **Found during:** Task 2 GREEN, first run of RootNativeStack.test.tsx.
- **Issue:** `vi.mock('../../src/state/appStore', () => ({useAppStore: {getState: mockGetState}}))` is hoisted to the top of the file by Vitest's transformer. The bare `const mockGetState = vi.fn()` declaration runs AFTER the hoisted mock factory, producing `Cannot access 'mockGetState' before initialization`.
- **Fix:** Used `vi.hoisted(() => ({mockGetState: vi.fn()}))` so the spy is declared at the same hoisted level as the mock factory.
- **Files modified:** `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx`.
- **Commit:** `b5e0c28`.

**4. [Rule 2 - Missing functionality] bottom-tabs vitest mock didn't invoke the tabBar callback.**

- **Found during:** Task 2 GREEN, first run of MainTabs.test.tsx.
- **Issue:** Phase 1's bottom-tabs mock was a pure passthrough — it didn't invoke the `tabBar` prop, so BottomNav was never rendered into the DOM. MainTabs.test asserts the BottomNav exposes 3 accessibility-labelled Pressables; without invoking the callback the labels never reach the DOM.
- **Fix:** Updated the mock to derive synthetic `state.routes` from React.Children name props and call `tabBar({state, navigation: {emit, navigate}})`. Generic across any bottom-tab navigator.
- **Files modified:** `apps/mobile/vitest.setup.ts`.
- **Commit:** `b5e0c28`.

**5. [Rule 1 - Bug] Comment containing the substring "Tab.Screen" tripped the plan's grep -c "Tab.Screen" → 3 acceptance.**

- **Found during:** Task 2 acceptance verification.
- **Issue:** The first iteration of MainTabs.tsx had a comment "only three Tab.Screen registrations exist here". The plan acceptance is `grep -c "Tab.Screen" src/navigation/MainTabs.tsx | awk '$1 == 3 ...'` which counted 4 (3 JSX uses + 1 comment).
- **Fix:** Reworded the comment to "only three tab screens are registered below" — same meaning, doesn't trip the substring grep. Same comment-substring discipline that 02-01 SUMMARY documented for pnpm-workspace.yaml.
- **Files modified:** `apps/mobile/src/navigation/MainTabs.tsx`.
- **Commit:** included in `b5e0c28`.

---

**Total deviations:** 5 auto-fixed (1 plan-body type drift, 4 test-infra issues stemming from RN-ecosystem evolution since 02-02 landed).
**Impact on plan:** All 3 tasks landed under acceptance commands. The fixes are all upstream of the navigator graph itself — none changed the navigator behavior, only how the test runtime exercises it. Future Phase 2 plans benefit from the upgraded mocks (any plan that renders an Icon or a tab navigator now has working tests on first run).

## Issues Encountered

- **Phase 1 lucide-react-native mock Proxy doesn't work under Vitest 4 ES strictness.** Documented and resolved by the allow-list pattern; future plans that import a new icon need to add it to the allow-list (the mock returns `undefined` for off-list names, producing a clear error rather than silent failure). Long-term fix: Vitest 5 may relax the namespace check, OR move to a plugin that injects all icons via codegen — neither is in scope for Phase 2.
- **bottom-tabs mock is now opinionated about the tabBar callback signature.** It assumes the callback uses `state.index`, `state.routes[i].name`, `state.routes[i].key`, `navigation.emit`, and `navigation.navigate`. Any future tabBar that relies on additional BottomTabBarProps (e.g., `descriptors`, `insets`) would need to extend the synthetic shape. Mitigated by the comment block in vitest.setup.ts that lists the assumed surface.
- **NestedPathMap escape hatch** in linking.ts is a temporary hack until plan 02-15 lands the global ParamList. The cast site at App.tsx is the only place it touches the rest of the app — once 02-15 lands, the cast can become a typed `LinkingOptions<RootStackParamList>` import.

## Threat Flags

None — this plan does not introduce new endpoints, auth paths, file-access patterns, or schema mutations at trust boundaries that aren't already declared in the plan's `<threat_model>` block. The deep-link surface (T-2.5-01..03) is at-spec: Phase 2 has no record-id consumer, the placeholder handlers ignore params, and the gate-decision tree routes a not-yet-signed-in user to Splash → Signup before any post-auth deep-link target is reachable.

## User Setup Required

None — pure mobile-side wiring. No new external service config, no env vars, no native module changes.

The Phase-2-level google-services.json gap (carried over from 02-01) is unrelated to this plan and remains outstanding for the eventual `:app:assembleApkRolloutDebug` operator-smoke / mobile-ci.yml `android-build` job.

## Next Phase Readiness

- **Plan 02-08 (versionService + Splash + ForceUpgrade)** — replaces SplashScreen + ForceUpgradeScreen stub bodies. Calls `useAppStore.setForceUpgradeBlocked(true)` then `navigation.replace('ForceUpgrade')` (RootNativeStack sibling); for soft upgrade, sets `softUpgradeAvailable` and the home-skeleton banner picks it up.
- **Plan 02-09 (Sign-up screen)** — replaces SignupScreen stub. Real flow: animated logo + consent + Google Sign-In. On success, `navigation.replace('Permissions')`. Phase 1's SignIn test is gone; this plan ships the new test pinning the same auth flow + consent + Terms-of-Use modal.
- **Plan 02-10 (Permissions screen)** — replaces PermissionsScreen stub. Calls react-native-permissions; on success, `navigation.replace('Compat')`.
- **Plan 02-11 (Compat service + Compat[Running])** — replaces CompatRunningScreen stub. Probe orchestration writes via setCompatResult; on done, `navigation.replace('CompatPass')` or `'CompatFail'`.
- **Plan 02-12 (CompatPass/Fail/Recovery)** — three stub bodies. CompatPass → 'RigTutorial' (or 'MainTabs' if tutorialDone). CompatFail → CompatRecovery → CompatRunning loop.
- **Plan 02-13 (RigTutorial)** — three-step rig-setup carousel. On done, setTutorialDone(googleSub) + `navigation.replace('MainTabs')`.
- **Plan 02-15 (Home screen + global ParamList)** — replaces HomeSkeletonScreen body. ALSO declares the global RootStackParamList; the linking.ts NestedPathMap workaround can drop in favour of a proper `LinkingOptions<RootStackParamList>` import once that lands.
- **Plan 02-16 (compat signature)** — replaces compatSignature.ts stub with the real sha256 compute. RootNativeStack's `rootInitialRouteName()` will activate AUTH-11 the moment this lands (cross-device boot → fresh installation_id → fresh signature → mismatch → Compat re-run).
- **Plan 02-19 (Profile screen)** — replaces ProfileScreen stub. Reachable via TopBar avatar tap from Home/Tasks/History; the entry-path wiring is already in place.
- **Plan 02-20 (Help Center screen)** — replaces HelpCenterScreen stub.

## TDD Gate Compliance

Task 2 was `tdd="true"`. Gate sequence:

1. **RED gate (test commit):** `ad4c875` — `test(02-05): add failing tests for RootNativeStack, MainTabs, linking`. 3 test files committed; vitest run reported 3 failed test files (all "Failed to resolve import" — sources not yet authored). RED requirement met.
2. **GREEN gate (feat commit):** `b5e0c28` — `feat(02-05): implement RootNativeStack + OnboardingStack + MainTabs + linking`. 4 source modules + 1 service stub + 2 test infra fixes committed; the 3 RED test files now pass 10/10.
3. **REFACTOR gate:** not exercised — implementation came in clean on first pass (after the 5 auto-fix iterations on test infra, none of which changed the navigator source's behavior).

Plan-level TDD compliance: PASS.

## Self-Check: PASSED

- File `apps/mobile/src/components/TopBar.tsx` — FOUND
- File `apps/mobile/src/components/BottomNav.tsx` — FOUND
- File `apps/mobile/src/navigation/RootNativeStack.tsx` — FOUND
- File `apps/mobile/src/navigation/OnboardingStack.tsx` — FOUND
- File `apps/mobile/src/navigation/MainTabs.tsx` — FOUND
- File `apps/mobile/src/navigation/linking.ts` — FOUND
- File `apps/mobile/src/services/compatSignature.ts` — FOUND
- File `apps/mobile/src/screens/splash/SplashScreen.tsx` — FOUND (and 12 sibling stubs)
- File `apps/mobile/src/screens/tasks/TasksPlaceholder.tsx` — FOUND
- File `apps/mobile/src/screens/history/HistoryPlaceholder.tsx` — FOUND
- File `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx` — FOUND (3 cases)
- File `apps/mobile/__tests__/navigation/MainTabs.test.tsx` — FOUND (2 cases)
- File `apps/mobile/__tests__/navigation/linking.test.ts` — FOUND (5 cases)
- `grep -c "Tab.Screen" apps/mobile/src/navigation/MainTabs.tsx` returns 3 — VERIFIED
- `grep -q "createNativeStackNavigator" apps/mobile/src/navigation/RootNativeStack.tsx` — succeeds
- `grep -q "humyn://" apps/mobile/src/navigation/linking.ts` — succeeds
- `grep -q "computeInitialRoute" apps/mobile/src/navigation/RootNativeStack.tsx` — succeeds
- `grep -q "hydrate()" apps/mobile/App.tsx` — succeeds
- `grep -q "NavigationContainer" apps/mobile/App.tsx` — succeeds
- `grep -q "enableScreens" apps/mobile/App.tsx` — succeeds
- `test ! -f apps/mobile/src/screens/SignIn.tsx` — VERIFIED (file removed)
- `test ! -f apps/mobile/__tests__/SignIn.test.tsx` — VERIFIED (file removed)
- `cd apps/mobile && npm run typecheck` — exits 0
- `cd apps/mobile && npm run test` — 10 test files / 44 tests / all passing
- 02-01 contributions intact: `apps/mobile/android/settings.gradle` references `../node_modules/@react-native/gradle-plugin`; `apps/mobile/metro.config.js` retains `watchFolders: [sharedTypesRoot]` (no `disableHierarchicalLookup`, no `workspaceRoot`).
- 02-03 contributions intact: `apps/mobile/src/state/mmkv.ts` is the only MMKV constructor in the app (`grep -rn "createMMKV(\|new MMKV(" apps/mobile/src/ | grep -v "src/state/mmkv.ts"` returns 0 matches).
- 02-04 contributions intact: `apps/mobile/src/util/analytics.ts` + `src/services/installationId.ts` + `src/services/telemetryRing.ts` unchanged.
- Commit `5665458` (Task 1) — FOUND in git log
- Commit `ad4c875` (Task 2 RED) — FOUND in git log
- Commit `b5e0c28` (Task 2 GREEN) — FOUND in git log
- Commit `3cd50ad` (Task 3a SignIn deletion) — FOUND in git log
- Commit `b3791ca` (Task 3b App.tsx rewrite) — FOUND in git log

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
_HOME-07 + HOME-08 satisfied STRUCTURALLY: MainTabs registers exactly 3 tabs; Profile/HelpCenter/ForceUpgrade are RootNativeStack siblings — the bottom tab bar physically cannot render on those routes._
