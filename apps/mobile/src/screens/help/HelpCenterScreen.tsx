// Stub Help Center screen — real body (Instructions / FAQs / Troubleshooting
// accordion + diagnostic snapshot) lands in plan 02-20.
import React from 'react';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';

export default function HelpCenterScreen() {
  return (
    <ScreenContainer accessibilityLabel="HelpCenter screen">
      <Text variant="title28">Help Center</Text>
    </ScreenContainer>
  );
}
