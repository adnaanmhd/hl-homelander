// TasksPlaceholderScreen — Phase 6 territory (TASK-01..10). Today this is
// the active Tasks tab body so users navigating to the Tasks tab see
// "Coming in Phase 6" instead of a blank screen. The TopBar render here
// matches HomeSkeletonScreen so the avatar-tap → Profile path works from
// any tab. Per plan 02-16, the Profile route is RootNativeStack-level —
// HOME-07 requires the avatar in the top-right is the ONLY entry point.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { spacing } from '../../ui/tokens';

export default function TasksPlaceholderScreen() {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  return (
    <ScreenContainer accessibilityLabel="Tasks screen" padding={0}>
      <TopBar onAvatarPress={() => navigation.navigate('Profile')} />
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
