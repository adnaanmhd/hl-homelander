// HomeSkeletonScreen — Phase 2 Home shell (plan 02-16).
//
// What ships here (Phase 2):
//   - TopBar (Humyn Labs wordmark + avatar → Profile)
//   - SoftUpgradeBanner mount point (plan 02-20 lands the actual banner
//     component; 02-16 reserves the slot + the appStore selector)
//   - Skeleton body copy explaining the Phase-6 deferral
//
// What does NOT ship here (Phase 6 — HOME-01..06/09/10):
//   - First-time vs returning hero (greeting / lifetime number)
//   - Recording duration / Tasks recorded / Pending uploads tiles
//   - Time-range filters (today/yesterday/week/month/all/custom)
//   - Pull-to-refresh
//   - Offline banner inside Pending Uploads tile
//
// HOME-07 / HOME-08 satisfaction is structural (see MainTabs.tsx +
// RootNativeStack.tsx); this screen plays its part by routing the avatar
// tap to the RootNativeStack-level Profile route. Tab bar suppression is
// automatic — Profile is a sibling of MainTabs, not a child.

import React from 'react';
import { View, ScrollView } from 'react-native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { SoftUpgradeBanner } from '../../components/SoftUpgradeBanner';
import { useAppStore } from '../../state/appStore';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { spacing } from '../../ui/tokens';

// (Phase 3 smoke seam removed in Phase 4 — the real RecordingScreen now wires
//  the HumynCapture start path; trail: deferred-items.md D4-01 + commit 15d8a16.)

export default function HomeSkeletonScreen() {
  const topBarProps = useTabTopBarProps();
  const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);

  return (
    <ScreenContainer accessibilityLabel="Home screen" padding={0}>
      <TopBar {...topBarProps} />
      {softUpgradeAvailable ? (
        <View
          accessibilityLabel="soft-upgrade-banner-slot"
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}
        >
          {/* Plan 02-20 — UPG-04 / D-UPG-05. The banner self-protects
              against null payloads / per-version dismissal; the outer
              softUpgradeAvailable guard short-circuits the layout entirely
              when versionService hasn't flagged a soft upgrade. */}
          <SoftUpgradeBanner />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl }}
        accessibilityLabel="home-skeleton-body"
      >
        <Text variant="bodyLg" tone="primary" style={{ marginBottom: spacing.md }}>
          Home
        </Text>
        <Text variant="body" tone="secondary">
          Home tiles arrive in Phase 6. For now this is the structural shell that locks in HOME-07
          (3 tabs) and HOME-08 (tab bar suppression).
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
