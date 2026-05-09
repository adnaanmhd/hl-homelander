// Stub Force-Upgrade screen — real body (modal-presentation block + APK
// download / Play link) lands in plan 02-08.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function ForceUpgradeScreen() {
  return (
    <ScreenContainer accessibilityLabel="ForceUpgrade screen">
      <Text variant="title28">Force Upgrade</Text>
    </ScreenContainer>
  );
}
