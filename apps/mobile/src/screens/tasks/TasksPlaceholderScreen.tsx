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
//
// Plan 04-08 (D-NAV-02) — __DEV__-gated non-practice debug entry to
// RecordingScreen: in dev builds a long-press (>800ms) on the heading
// pushes the 'Recording' route with a hardcoded real-task params shape so
// engineers can exercise the recording surface without the full
// onboarding/practice flow. Production apkRollout/playStore builds set
// `__DEV__ === false` → Metro dead-code-eliminates BOTH the long-press
// handler AND the Pressable wrapper (Pitfall 7 — the entire affordance is
// inside the `__DEV__` guard, not just the navigation call). Phase 6
// replaces this placeholder with the real Tasks list + Task details +
// Start Recording CTA.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import Pressable from '../../ui/primitives/Pressable';
import { TopBar } from '../../components/TopBar';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { spacing } from '../../ui/tokens';

// The hardcoded non-practice test task the __DEV__ long-press pushes —
// `isPractice: false` so it exercises the real-recording surface (no 60s
// cap), distinct from the PracticeIntro entry. Any clean 65-task taxonomy
// entry works; "Chop vegetables" (Cooking / Indoor) is the chosen one.
const DEBUG_TEST_TASK = {
  taskId: 'cooking_chop_vegetables',
  taskName: 'Practice — Chop vegetables',
  isPractice: false,
  taskCategory: 'cooking',
  taskSetting: 'indoor',
} as const;

const HEADING_STYLE = { paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl } as const;

type DebugNav = { push: (route: string, params?: Record<string, unknown>) => void };

export default function TasksPlaceholderScreen() {
  const topBarProps = useTabTopBarProps();
  const navigation = useNavigation() as unknown as DebugNav;

  // The ENTIRE handler lives behind `__DEV__` so Metro dead-code-eliminates
  // it (and the Pressable wrapper below) in release builds — never just the
  // `navigation.push` call (Pitfall 7).
  const onDebugLongPress = __DEV__
    ? () => {
        navigation.push('Recording', { ...DEBUG_TEST_TASK });
      }
    : undefined;

  return (
    <ScreenContainer accessibilityLabel="Tasks screen" padding={0}>
      <TopBar {...topBarProps} />
      {__DEV__ ? (
        <Pressable
          onLongPress={onDebugLongPress}
          delayLongPress={800}
          accessibilityLabel="tasks-heading"
        >
          <Text variant="body" tone="secondary" style={HEADING_STYLE}>
            Tasks — coming in Phase 6.
          </Text>
        </Pressable>
      ) : (
        <Text variant="body" tone="secondary" style={HEADING_STYLE}>
          Tasks — coming in Phase 6.
        </Text>
      )}
    </ScreenContainer>
  );
}
