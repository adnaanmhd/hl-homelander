/**
 * @doc Modal primitive — implements design-spec §18 centered modal card.
 *
 * Centered card on rgba(0,0,0,.5) scrim, 20 px radius (`radii.modal`),
 * 24 px padding. Title slot + children body slot + optional action row.
 * Internally uses RN Modal with `animationType="fade"` (the design-spec
 * §18 "scale-pop" entry is delegated to a future Reanimated pass; the
 * primitive shape stays unchanged).
 */
import React from 'react';
import { Modal as RNModal, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../tokens';
import { Text } from './Text';

export interface ModalProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children?: React.ReactNode;
  /** Optional action row rendered at the bottom of the modal. */
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const SCRIM_COLOR = 'rgba(0, 0, 0, 0.5)';

export function Modal({
  visible,
  onDismiss,
  title,
  children,
  actions,
  style,
  accessibilityLabel,
}: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        accessibilityLabel={accessibilityLabel ?? 'Modal'}
        style={{
          flex: 1,
          backgroundColor: SCRIM_COLOR,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
        }}
      >
        <View
          style={[
            {
              backgroundColor: colors.surface,
              borderRadius: radii.modal,
              padding: spacing.xxxl,
              width: '100%',
              maxWidth: 480,
            },
            style,
          ]}
        >
          {title ? (
            <Text variant="sheetTitle" style={{ marginBottom: spacing.md }}>
              {title}
            </Text>
          ) : null}
          {children}
          {actions ? <View style={{ marginTop: spacing.xxxl }}>{actions}</View> : null}
        </View>
      </View>
    </RNModal>
  );
}

export default Modal;
