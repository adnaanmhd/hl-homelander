// Plan 02-11 RigTutorialScreen — ONB-01 + ONB-02.
//
// Verbatim §5 (design-spec.md, lines 256-264):
//   Heading (30/36, 700) "You'll need a head rig"
//   Body    (17/25)      "Mount your phone on the head rig and make sure it
//                         is steady while recording."
//   Button  (btn-primary) "Next" → MainTabs (Phase 2 stops here; Phase 4
//                                  splices Practice between this and MainTabs)
//
// ONB-02 off-ramp ("Don't have a rig yet?") opens a Sheet with the support
// mailto target but does NOT block the user — they can still tap Next from
// either before or after viewing the off-ramp (the CONTEXT.md "must NOT
// soft-lock" rule).
//
// T-2.11-01: SUPPORT_EMAIL was a placeholder until OQ-1 resolved in
// Plan 03-02 — see SUPPORT_EMAIL constant below for the canonical value.
//
// Analytics:
//   - rig_tutorial_shown        → fires once on mount
//   - rig_no_rig_link_tapped    → fires when the off-ramp link is tapped
//
// Both names are pre-registered in src/util/analytics.ts EVENT_NAMES.

import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { Sheet } from '../../ui/primitives/Sheet';
import { colors, spacing } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import { logEvent } from '../../util/analytics';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RIG_ILLUSTRATION = require('../../assets/illustrations/rig.png');

// Plan 03-02 — OQ-1 resolved: support email is `support@humynlabs.ai`
// (02-COSMETIC-GAPS.md "Rig Tutorial screen" + 02-OPEN-QUESTIONS.md OQ-1
// resolution). Replaced the placeholder constant. The 5th and final
// placeholder occurrence landed inside Plan 03-03's merged CompatFailScreen
// (the standalone CompatRecoveryScreen was merged + deleted in 03-03).
const SUPPORT_EMAIL = 'support@humynlabs.ai';

/**
 * Decode the `sub` claim from a JWS-shaped JWT (header.payload.signature)
 * without verifying the signature. Used to thread the user's googleSub into
 * `setTutorialDone(googleSub)` per the appStore contract (D-STATE-04).
 *
 * Returns an empty string for any malformed input. The empty string still
 * flows through `setTutorialDone('')` which flips the persisted flag —
 * onboarding does not soft-lock if JWT decoding glitches.
 */
function decodeGoogleSubFromJwt(jwt: string | null): string {
  if (!jwt) return '';
  const parts = jwt.split('.');
  if (parts.length !== 3) return '';
  try {
    const segment = parts[1] ?? '';
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padNeeded = (4 - (b64.length % 4)) % 4;
    const padded = b64 + '='.repeat(padNeeded);
    type GlobalWithBuffer = typeof globalThis & {
      Buffer?: { from(data: string, enc: string): { toString(enc: string): string } };
    };
    const g = globalThis as GlobalWithBuffer;
    let json: string;
    if (typeof g.atob === 'function') {
      json = g.atob(padded);
    } else if (g.Buffer) {
      json = g.Buffer.from(padded, 'base64').toString('utf8');
    } else {
      return '';
    }
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload?.sub === 'string' ? payload.sub : '';
  } catch {
    return '';
  }
}

interface ParentNav {
  replace: (route: string) => void;
}
interface LocalNav {
  replace: (route: string) => void;
  getParent: () => ParentNav | null | undefined;
}

export default function RigTutorialScreen() {
  const navigation = useNavigation() as unknown as LocalNav;
  const setTutorialDone = useAppStore((s) => s.setTutorialDone);
  const jwt = useAppStore((s) => s.jwt);
  const [offRampOpen, setOffRampOpen] = useState(false);

  // ONB-01 telemetry — single fire on mount.
  useEffect(() => {
    logEvent('rig_tutorial_shown');
  }, []);

  const handleNext = () => {
    const googleSub = decodeGoogleSubFromJwt(jwt);
    setTutorialDone(googleSub);
    // Phase 2 stops onboarding here. Phase 4 will splice the Practice screen
    // between this Next handler and MainTabs (per CONTEXT.md domain note).
    // Prefer the parent navigator (RootNativeStack) so we can leave the
    // OnboardingStack entirely; fall back to the local navigator if the
    // parent is not available.
    const parent = navigation.getParent?.();
    if (parent && typeof parent.replace === 'function') {
      parent.replace('MainTabs');
    } else {
      navigation.replace('MainTabs');
    }
  };

  const handleNoRig = () => {
    setOffRampOpen(true);
    logEvent('rig_no_rig_link_tapped');
  };

  const handleEmailSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=No%20rig%20yet`);
  };

  return (
    <ScreenContainer accessibilityLabel="RigTutorial screen" style={styles.screen}>
      <View style={styles.center}>
        {/*
          design-spec §5 specifies a 280 px illustration. Plan 03-01
          shipped transparent placeholder PNGs at the spec dimensions
          (280/560/840 px @1x/@2x/@3x); the real artwork lands later by
          re-exporting to the same paths (no JSX edit required). Until
          then the Image renders transparent — the heading + body + Next
          CTA are functional parity with the spec.
        */}
        <Image
          source={RIG_ILLUSTRATION}
          style={styles.illustration}
          accessibilityLabel="rig illustration"
        />
        <View style={{ height: spacing.xxxl }} />
        <Text
          variant="tutorialHeading"
          tone="primary"
          style={styles.heading}
          accessibilityLabel="rig tutorial heading"
        >
          You&apos;ll need a head rig
        </Text>
        <View style={{ height: spacing.m }} />
        <Text
          variant="tutBody"
          tone="secondary"
          style={styles.body}
          accessibilityLabel="rig tutorial body"
        >
          Mount your phone on the head rig and make sure it is steady while recording.
        </Text>
        <View style={{ height: spacing.l }} />
        <Pressable
          onPress={handleNoRig}
          accessibilityRole="link"
          accessibilityLabel="Don't have a rig yet"
        >
          <Text variant="caption" style={styles.noRigLink}>
            Don&apos;t have a rig yet?
          </Text>
        </Pressable>
      </View>

      <Button variant="primary" label="Next" onPress={handleNext} accessibilityLabel="Next" />

      <Sheet
        visible={offRampOpen}
        onDismiss={() => setOffRampOpen(false)}
        accessibilityLabel="No rig off-ramp sheet"
      >
        <Text variant="sheetTitle" tone="primary" accessibilityLabel="off-ramp title">
          No rig yet?
        </Text>
        <View style={{ height: spacing.m }} />
        <Text variant="body" tone="primary" accessibilityLabel="off-ramp body">
          You&apos;ll need a head rig to record. We&apos;re working on getting rigs to contributors.
          Email us at {SUPPORT_EMAIL} and we&apos;ll let you know when one ships your way. You can
          keep exploring the app in the meantime.
        </Text>
        <View style={{ height: spacing.l }} />
        <Button
          variant="primary"
          label="Email support"
          onPress={handleEmailSupport}
          accessibilityLabel="Email support about rig"
        />
        <View style={{ height: spacing.m }} />
        <Button
          variant="outline"
          label="Got it"
          onPress={() => setOffRampOpen(false)}
          accessibilityLabel="Got it close off-ramp"
        />
      </Sheet>
    </ScreenContainer>
  );
}

// design-spec §5 padding: 24/28/28 (top/horizontal/bottom). ScreenContainer
// applies the canonical safe-area + 20 px gutter; we override to match the
// tutorial-specific values via `style` and the illustration is centered.
const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.h,
    paddingBottom: spacing.h,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Plan 03-02 — illustration uses the @1x/@2x/@3x density-bucketed
  // placeholder from Plan 03-01 (280×280 @1x). Force the rendered size
  // to design-spec §5's 280 px target so the layout doesn't reflow when
  // the real artwork arrives at different intrinsic dimensions.
  illustration: {
    width: 280,
    height: 280,
  },
  heading: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  noRigLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
