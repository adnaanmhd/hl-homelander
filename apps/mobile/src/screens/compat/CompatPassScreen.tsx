// Stub Compat Pass screen — real body lands in plan 02-12.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function CompatPassScreen() {
  return (
    <ScreenContainer accessibilityLabel="CompatPass screen">
      <Text variant="title28">Compat Pass</Text>
    </ScreenContainer>
  );
}
