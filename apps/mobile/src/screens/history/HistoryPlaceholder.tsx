// History placeholder — Phase 6 territory.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';

export default function HistoryPlaceholder() {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  return (
    <ScreenContainer accessibilityLabel="History screen" padding={0}>
      <TopBar onAvatarPress={() => navigation.navigate('Profile')} />
      <Text variant="title28" tone="primary" style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        History
      </Text>
      <Text variant="body" tone="secondary" style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        Coming in Phase 6.
      </Text>
    </ScreenContainer>
  );
}
