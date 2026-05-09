/**
 * @doc Sheet primitive — implements design-spec §17 bottom-anchored sheet.
 *
 * White surface, top radius `radii.sheet` (24), 20 px horizontal padding.
 * Internally uses RN Modal with `transparent` so the screen below shows
 * through; a tap on the rgba(0,0,0,.5) scrim dismisses. Children render
 * inside the white surface.
 */
import React from 'react';
import {
  Modal as RNModal,
  View,
  Pressable as RNPressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../tokens';

export interface SheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const SCRIM_COLOR = 'rgba(0, 0, 0, 0.5)';

export function Sheet({ visible, onDismiss, children, style, accessibilityLabel }: SheetProps) {
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <RNPressable
        accessibilityLabel="Sheet scrim"
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: SCRIM_COLOR,
          justifyContent: 'flex-end',
        }}
      >
        <RNPressable
          // Inner pressable swallows taps so they don't propagate to the
          // scrim. We rely on the press handler being a no-op rather than
          // stopPropagation (RN's Pressable doesn't expose that directly).
          onPress={() => {}}
          accessibilityLabel={accessibilityLabel ?? 'Sheet'}
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xxxl,
              paddingBottom: spacing.xxxxl,
            },
            style,
          ]}
        >
          <View>{children}</View>
        </RNPressable>
      </RNPressable>
    </RNModal>
  );
}

export default Sheet;
