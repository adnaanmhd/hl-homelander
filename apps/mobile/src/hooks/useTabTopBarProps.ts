// Plan 03-03 Task 1 — Pattern 71 — single source of TopBar avatar props for
// the three MainTabs tab bodies (Home / Tasks / History).
//
// Without this hook, Tasks + History regressed to the 'U' fallback during the
// Phase 2 §13 Crashlytics soak (2026-05-10). HomeSkeletonScreen had the
// avatar wiring inlined; Tasks + History rendered `<TopBar onAvatarPress=…/>`
// with no avatarInitial / avatarUrl, so switching tabs reverted the avatar.
// See `02-COSMETIC-GAPS.md` § Profile screen (item 1).
//
// The hook reads `appStore.user` (Pattern 64) and produces the three TopBar
// avatar props in one place. Pair with `useForegroundUserRehydrate`
// (Plan 03-03 Task 2 / Pattern 72) to keep the user slice repopulated after
// Android process kill.

import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../state/appStore';

export interface TabTopBarProps {
  avatarInitial: string;
  /**
   * Present ONLY when `appStore.user.avatarUrl` is a non-empty string.
   * Conditional-spread shape (NOT `string | undefined`) so consumers can
   * `<TopBar {...topBarProps} />` under `exactOptionalPropertyTypes: true`
   * without TS2375 against TopBarProps' optional `avatarUrl?: string`.
   */
  avatarUrl?: string;
  onAvatarPress: () => void;
}

export function useTabTopBarProps(): TabTopBarProps {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  const user = useAppStore((s) => s.user);
  const avatarInitial = (
    (user?.name ?? user?.email ?? 'U').trim().slice(0, 1) || 'U'
  ).toUpperCase();
  const base: TabTopBarProps = {
    avatarInitial,
    onAvatarPress: () => navigation.navigate('Profile'),
  };
  if (user?.avatarUrl) {
    return { ...base, avatarUrl: user.avatarUrl };
  }
  return base;
}

export default useTabTopBarProps;
