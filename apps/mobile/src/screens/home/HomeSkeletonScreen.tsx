// Stub Home (skeleton) screen — real body (greeting, lifetime number, task
// preview, top bar) lands in plan 02-15. Today: render TopBar + the screen
// label so MainTabs renders something coherent for nav-tree tests.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';

export default function HomeSkeletonScreen() {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  return (
    <ScreenContainer accessibilityLabel="Home screen" padding={0}>
      <TopBar onAvatarPress={() => navigation.navigate('Profile')} />
      <Text variant="title28" style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        Home
      </Text>
    </ScreenContainer>
  );
}
