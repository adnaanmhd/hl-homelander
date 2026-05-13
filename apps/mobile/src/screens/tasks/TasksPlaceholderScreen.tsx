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
//
// Debug session `debug-task-id-init-400` (2026-05-13) — `taskId` was
// `'cooking_chop_vegetables'` (a 23-char taxonomy SLUG). A recording made
// via this affordance auto-enqueues fine but the upload coordinator's
// `POST /recordings/init` 400s forever: `RecordingsInitRequestSchema.taskId`
// is `z.string().length(26)` (a task ULID) and `recordings.task_id` FKs
// `tasks.id`. Now points at the canonical dev-seed task ULID — keep in
// lockstep with `DEV_TASK_ID` in `apps/api/scripts/seed-dev-task.ts`
// (`pnpm --filter @humyn/api seed:dev-task` inserts it; the Phase-5
// upload-smoke runbook §1 runs that seed).
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
// cap) AND the full Phase-5 upload pipeline (practice never uploads — see
// RecordingScreen.tsx D-08). `taskId` MUST be a real 26-char `tasks.id`
// (the upload `/recordings/init` schema + the `recordings.task_id` FK both
// require it) — this is the reserved canonical dev-seed task ULID; run
// `pnpm --filter @humyn/api seed:dev-task` to make sure it exists in the
// dev DB. Keep this constant === `DEV_TASK_ID` in
// `apps/api/scripts/seed-dev-task.ts`.
const DEBUG_TEST_TASK = {
  taskId: '01HVDEVSEEDTASK00000000000',
  taskName: 'Dev — Chop vegetables',
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
