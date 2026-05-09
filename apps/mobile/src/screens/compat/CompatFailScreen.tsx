// Stub Compat Fail screen — real body (failedKeys diagnostic UI + recovery
// CTA) lands in plan 02-12.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function CompatFailScreen() {
  return (
    <ScreenContainer accessibilityLabel="CompatFail screen">
      <Text variant="title28">Compat Fail</Text>
    </ScreenContainer>
  );
}
