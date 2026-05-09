// Stub Profile screen — real body lands in plan 02-19. Profile is mounted
// as a sibling of MainTabs in RootNativeStack so the bottom tab bar is NOT
// shown here (HOME-08).
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function ProfileScreen() {
  return (
    <ScreenContainer accessibilityLabel="Profile screen">
      <Text variant="title28">Profile</Text>
    </ScreenContainer>
  );
}
