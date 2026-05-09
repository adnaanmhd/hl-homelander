// Stub Permissions screen — real body (camera + mic permission requests with
// react-native-permissions) lands in plan 02-10.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function PermissionsScreen() {
  return (
    <ScreenContainer accessibilityLabel="Permissions screen">
      <Text variant="title28">Permissions</Text>
    </ScreenContainer>
  );
}
