// Stub Compat (Running) screen — real body (probe orchestration + animated
// progress ring + per-check telemetry) lands in plan 02-11.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function CompatRunningScreen() {
  return (
    <ScreenContainer accessibilityLabel="CompatRunning screen">
      <Text variant="title28">Compat Running</Text>
    </ScreenContainer>
  );
}
