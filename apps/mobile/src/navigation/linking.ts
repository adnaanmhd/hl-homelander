// humyn:// deep-link config per engineering-handoff.md §3.4.
//
// Phase 2 routes that resolve directly:
//   humyn://signup       → OnboardingStack/Signup
//   humyn://permissions  → OnboardingStack/Permissions
//   humyn://home         → MainTabs/Home
//   humyn://tasks        → MainTabs/Tasks
//   humyn://history      → MainTabs/History
//   humyn://profile      → Profile (Root sibling — no tab bar)
//   humyn://help         → HelpCenter (Root sibling — no tab bar)
//
// Phase 4/6 routes (humyn://record/{taskId}, humyn://tasks/{taskId},
// humyn://history/{recordingId}) currently land on the Phase 2 Tasks /
// History placeholders. The placeholder bodies show "Coming soon" so a
// successful deep-link handoff still produces something coherent.
//
// Threat T-2.5-01 (deep-link tampering): React Navigation's path matcher
// rejects malformed paths; param values are extracted by the underlying
// matcher and passed as untyped strings to the screen component. Phase 4 /
// Phase 6 screens that read params MUST validate the shape (ULID for IDs,
// enum membership for category/range). At Phase 2 nothing consumes
// path-extracted params, so the surface is closed.

import type { LinkingOptions } from '@react-navigation/native';

// We hand-type the config tree because LinkingOptions's generic param ties
// every screen's path entry to the navigator's ParamList — Phase 2 hasn't
// declared the global ParamList yet (lands in plan 02-15 once every screen
// shape is known). Casting via `LinkingOptions<{}>` would error with
// "Object literal may only specify known properties" on every nested
// `screens` block. The interface below keeps the same shape as React
// Navigation's PathConfigMap but skips the parameter-list cross-check.
interface NestedPathMap {
  [routeName: string]: string | { screens: NestedPathMap };
}

interface RootPathConfig {
  screens: NestedPathMap;
}

interface AppLinkingOptions extends Omit<LinkingOptions<Record<string, never>>, 'config'> {
  config?: RootPathConfig;
}

export const linking: AppLinkingOptions = {
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
    },
  },
};
