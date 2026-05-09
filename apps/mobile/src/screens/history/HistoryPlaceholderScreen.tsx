// HistoryPlaceholderScreen — Phase 6 territory (HIST-01..06). Today this is
// the active History tab body so users navigating to the History tab see
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

export default function HistoryPlaceholderScreen() {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  return (
    <ScreenContainer accessibilityLabel="History screen" padding={0}>
      <TopBar onAvatarPress={() => navigation.navigate('Profile')} />
      <Text
        variant="body"
        tone="secondary"
        style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl }}
      >
        History — coming in Phase 6.
      </Text>
    </ScreenContainer>
  );
}
