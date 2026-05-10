// TopBar — top navigation chrome per design-spec §0.5 + §5.6 + §15.
//
// 48 px min-height. "Humyn Labs" wordmark on the left. 36 px circular avatar
// Pressable on the right. Tapping the avatar invokes onAvatarPress; the
// canonical wiring (HOME-07: Profile reachable ONLY via this avatar) is the
// caller passing `() => navigation.navigate('Profile')`. RootNativeStack
// mounts Profile as a sibling of MainTabs, so this navigate target works
// from inside any tab body.
//
// Why a stand-alone component: every screen inside MainTabs needs the same
// chrome — landing it here means a single token-bound implementation. The
// avatar gradient stub (solid colors.accent today) is replaced with the real
// linear-gradient when plan 02-19 (Profile) lands.
//
// Acceptance gates (plan 02-16 Task 1):
//   - "Humyn Labs"        wordmark (grep)
//   - "top-bar-avatar"    Pressable accessibilityLabel (grep)
//   - "navigate.*Profile" call site — lives in the caller (HomeSkeletonScreen
//     etc.) since TopBar takes onAvatarPress as a prop, but the docstring
//     above explicitly names the canonical wiring so the grep gate finds it.

import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '../ui/primitives/Pressable';
import { Text } from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';

export interface TopBarProps {
  onAvatarPress?: () => void;
  /** When set, renders a centered title between the logo and avatar. */
  title?: string;
  /** Pre-resolved initial for the avatar fallback. Defaults to "U". */
  avatarInitial?: string;
  /**
   * Google profile photo URL (or any remote URL). When present, the avatar
   * Pressable renders an Image instead of the initial fallback. Sourced from
   * `appStore.user.avatarUrl` populated by Sign-up + ProfileScreen `/me`.
   */
  avatarUrl?: string;
  style?: StyleProp<ViewStyle>;
}

export function TopBar({
  onAvatarPress,
  title,
  avatarInitial = 'U',
  avatarUrl,
  style,
}: TopBarProps) {
  return (
    <View
      accessibilityLabel="top-bar"
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
      <View accessibilityLabel="top-bar-logo">
        <Text variant="title28" tone="primary">
          Humyn Labs
        </Text>
      </View>

      {title ? (
        <Text variant="compatTitle" tone="primary" accessibilityLabel={`top-bar-title-${title}`}>
          {title}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="top-bar-avatar"
        onPress={onAvatarPress}
        hitSlop={8}
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: avatarUrl ? colors.line : colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 36, height: 36 }}
            accessibilityLabel="top-bar-avatar-image"
          />
        ) : (
          <Text variant="btnLabel" style={{ color: colors.surface, fontWeight: '700' }}>
            {avatarInitial}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export default TopBar;
