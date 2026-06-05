// Bug 4 / D2 (2026-06-04) — a module-level navigation handle so non-component
// code can drive navigation. The app is otherwise hook-based (useNavigation);
// the ONLY caller is services/api.ts, which routes to Signup when an authed
// request 401s with the `device-evicted` slug (this device was superseded by a
// newer sign-in). `resetToOnboarding()` mirrors LogoutModal's reset —
// OnboardingStack registers Signup as its initial route, so this lands the user
// on Signup with a fresh stack. Best-effort: a no-op until the
// NavigationContainer attaches the ref at boot (App.tsx).

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Reset the root stack to OnboardingStack (lands on Signup). No-op until ready. */
export function resetToOnboarding(): void {
  if (!navigationRef.isReady()) return;
  // resetRoot accepts a PartialState; OnboardingStack registers Signup as its
  // initial route, so this mirrors LogoutModal's reset.
  navigationRef.resetRoot({ index: 0, routes: [{ name: 'OnboardingStack' }] });
}
