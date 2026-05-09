// TopBar — top navigation chrome per design-spec §0.5 + §9.
//
// 48 px min-height. Logo on the left ("Humyn" wordmark stub at MVP — design
// hands the real SVG via plan 02-15). Avatar 36 px circle on right. Tapping
// avatar invokes onAvatarPress (RootNativeStack wires this to
// navigation.navigate('Profile')).
//
// Why a stand-alone component: every screen inside MainTabs (and a couple of
// non-tab screens like Profile/HelpCenter) needs the same chrome — landing it
// here means a single token-bound implementation. Avatar gradient + initial
// styling stub is replaced with the real DiceBear/Pravatar in plan 02-19.

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '../ui/primitives/Pressable';
import { Text } from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';

export interface TopBarProps {
  onAvatarPress?: () => void;
  /** When set, renders a centered title between the logo and avatar. */
  title?: string;
  /** Pre-resolved initial for the avatar fallback. Defaults to "U". */
  avatarInitial?: string;
  style?: StyleProp<ViewStyle>;
}

export function TopBar({ onAvatarPress, title, avatarInitial = 'U', style }: TopBarProps) {
  return (
    <View
      accessibilityLabel="Top bar"
      style={[
        {
          minHeight: 48,
          paddingHorizontal: spacing.l,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.bg,
        },
        style,
      ]}
    >
      <View accessibilityLabel="Humyn logo">
        <Text variant="title28" tone="primary">
          Humyn
        </Text>
      </View>

      {title ? (
        <Text variant="compatTitle" tone="primary" accessibilityLabel={`Top bar title ${title}`}>
          {title}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile avatar"
        onPress={onAvatarPress}
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: colors.accent, // Stub gradient — real linear gradient lands in plan 02-19.
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="btnLabel" style={{ color: colors.surface, fontWeight: '700' }}>
          {avatarInitial}
        </Text>
      </Pressable>
    </View>
  );
}

export default TopBar;
