// Tasks placeholder — Phase 6 territory. Today this is the active tab body
// so users navigating to the Tasks tab see "Coming in Phase 6" instead of a
// blank screen. The TopBar render here matches HomeSkeletonScreen so the
// avatar-tap → Profile path works from any tab.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';

export default function TasksPlaceholder() {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  return (
    <ScreenContainer accessibilityLabel="Tasks screen" padding={0}>
      <TopBar onAvatarPress={() => navigation.navigate('Profile')} />
      <Text variant="title28" tone="primary" style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        Tasks
      </Text>
      <Text variant="body" tone="secondary" style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        Coming in Phase 6.
      </Text>
    </ScreenContainer>
  );
}
