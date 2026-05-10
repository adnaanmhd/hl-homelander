// TasksPlaceholderScreen — Phase 6 territory (TASK-01..10). Today this is
// the active Tasks tab body so users navigating to the Tasks tab see
// "Coming in Phase 6" instead of a blank screen. The TopBar render here
// matches HomeSkeletonScreen so the avatar-tap → Profile path works from
// any tab. Per plan 02-16, the Profile route is RootNativeStack-level —
// HOME-07 requires the avatar in the top-right is the ONLY entry point.
//
// Plan 03-03 Task 1 — TopBar avatar props now flow through the shared
// `useTabTopBarProps()` hook (Pattern 71). Pre-fix, this screen rendered
// `<TopBar onAvatarPress={…} />` with no avatarInitial / avatarUrl, so
// switching from Home → Tasks reverted the avatar to the 'U' fallback even
// when `appStore.user` was populated. Surfaced during Phase 2 §13 soak;
// see `02-COSMETIC-GAPS.md` § Profile screen item 1.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { spacing } from '../../ui/tokens';

export default function TasksPlaceholderScreen() {
  const topBarProps = useTabTopBarProps();
  return (
    <ScreenContainer accessibilityLabel="Tasks screen" padding={0}>
      <TopBar {...topBarProps} />
      <Text
        variant="body"
        tone="secondary"
        style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl }}
      >
        Tasks — coming in Phase 6.
      </Text>
    </ScreenContainer>
  );
}
