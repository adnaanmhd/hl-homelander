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
import { View, ScrollView, Pressable } from 'react-native';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import { TopBar } from '../../components/TopBar';
import { SoftUpgradeBanner } from '../../components/SoftUpgradeBanner';
import { useAppStore } from '../../state/appStore';
import { useTabTopBarProps } from '../../hooks/useTabTopBarProps';
import { spacing } from '../../ui/tokens';
import * as HumynCapture from '../../native/HumynCapture';
import type { CaptureSessionOpts } from '@humyn/shared-types';

export default function HomeSkeletonScreen() {
  const topBarProps = useTabTopBarProps();
  const softUpgradeAvailable = useAppStore((s) => s.softUpgradeAvailable);
  const user = useAppStore((s) => s.user);

  // Phase 3 smoke seam — REMOVE in Phase 4 when RecordingScreen wires up
  // start()/stop() against the real Hand-detection gate + practice flow.
  // Documented anchor: 03-MANUAL-SMOKE.md §2 "edit a debug build to invoke
  // start() once". Validates UAT #5 (FGS), #6 (SHA), #7 (events) without
  // depending on Phase 4 deliverables.
  const [smokeState, setSmokeState] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [smokeMsg, setSmokeMsg] = React.useState<string | null>(null);

  const onSmokeCapture = React.useCallback(async () => {
    const opts: CaptureSessionOpts = {
      taskId: '01J5K7M9P0QR2STU4VWX6YZ8AB',
      taskName: 'Phase 3 smoke',
      taskCategory: 'smoke',
      taskSetting: 'indoor',
      contributor: {
        name: user?.name ?? 'Smoke Operator',
        email: user?.email ?? 'm.adnaan161@gmail.com',
        age: null,
        gender: null,
        consent: true,
      },
      isPractice: false,
      startGate: {
        type: 'hand_detection',
        passed: true,
        skipped: false,
        bypassed: false,
        durationMs: 1500,
        consecutiveHitsRequired: 5,
        platformCadenceMs: 100,
      },
      location: 'Phase 3 smoke',
      appVersion: '0.1.0-apk',
      dfovDegrees: 115.2,
    };

    console.log('[smoke] start() opts', JSON.stringify(opts));
    setSmokeState('running');
    setSmokeMsg(null);
    const subs: { remove: () => void }[] = [];
    try {
      subs.push(
        HumynCapture.onSegmentStart((e) =>
          console.log('[smoke] onSegmentStart', JSON.stringify(e)),
        ),
        HumynCapture.onSegmentComplete((e) =>
          console.log('[smoke] onSegmentComplete', JSON.stringify(e)),
        ),
        HumynCapture.onSessionStop((e) => console.log('[smoke] onSessionStop', JSON.stringify(e))),
        HumynCapture.onThermalAbort((e) =>
          console.log('[smoke] onThermalAbort', JSON.stringify(e)),
        ),
        HumynCapture.onError((e) => console.log('[smoke] onError', JSON.stringify(e))),
      );
      const result = await HumynCapture.start(opts);
      console.log('[smoke] start resolved', JSON.stringify(result));
      setSmokeMsg(`started: ${result.sessionId}`);
      await new Promise((r) => setTimeout(r, 30_000));
      console.log('[smoke] calling stop()');
      await HumynCapture.stop();
      console.log('[smoke] stop resolved');
      setSmokeMsg('stop resolved — check files/recordings');
      setSmokeState('done');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[smoke] error', e?.code, e?.message);
      setSmokeMsg(`${e?.code ?? 'unknown'}: ${e?.message ?? String(err)}`);
      setSmokeState('error');
    } finally {
      subs.forEach((s) => s.remove?.());
    }
  }, [user]);

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
        {__DEV__ ? (
          <View
            accessibilityLabel="phase-3-smoke-seam"
            style={{
              marginTop: spacing.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: '#ffaa00',
              borderRadius: 8,
            }}
          >
            <Text variant="bodyLg" tone="primary" style={{ marginBottom: spacing.s }}>
              DEBUG · Phase 3 Smoke Seam
            </Text>
            <Text variant="body" tone="secondary" style={{ marginBottom: spacing.md }}>
              Invokes HumynCapture.start() + stop() for a 30 s smoke capture (UAT #5/#6/#7). Removed
              in Phase 4 when RecordingScreen wires the real start path.
            </Text>
            <Pressable
              onPress={onSmokeCapture}
              disabled={smokeState === 'running'}
              accessibilityLabel="smoke-capture-button"
              style={{
                padding: spacing.md,
                backgroundColor: smokeState === 'running' ? '#888' : '#0066cc',
                borderRadius: 6,
              }}
            >
              <Text variant="body" tone="primary" style={{ color: '#fff', textAlign: 'center' }}>
                {smokeState === 'idle'
                  ? '▶ Smoke Capture (30s)'
                  : smokeState === 'running'
                    ? 'Recording…'
                    : smokeState === 'done'
                      ? '✓ Done — check logcat'
                      : '✗ Error'}
              </Text>
            </Pressable>
            {smokeMsg ? (
              <Text
                variant="body"
                tone="secondary"
                style={{
                  marginTop: spacing.s,
                  color: smokeState === 'error' ? '#cc0000' : undefined,
                }}
              >
                {smokeMsg}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
