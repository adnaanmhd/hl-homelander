// Stub Splash screen — body lands in plan 02-08 (versionService) once the
// version-check + force-upgrade logic is wired. Today: render an
// ScreenContainer with the screen name so the navigator graph compiles +
// nav-tree tests can locate it via accessibilityLabel.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function SplashScreen() {
  return (
    <ScreenContainer accessibilityLabel="Splash screen">
      <Text variant="title28">Splash</Text>
    </ScreenContainer>
  );
}
