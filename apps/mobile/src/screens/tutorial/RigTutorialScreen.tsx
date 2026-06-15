// Plan 02-11 RigTutorialScreen — ONB-01 + ONB-02.
// Plan 04-03: Next now goes to PracticeIntro (was MainTabs) — RigTutorial →
//   PracticeIntro → Recording → PracticeComplete → MainTabs. The
//   'PracticeIntro' route is registered by plan 04-06's OnboardingStack edit;
//   navigation here is loosely typed (`as unknown as LocalNav`) so this is not
//   a typecheck dependency.
//
// Verbatim §5 (design-spec.md, lines 256-264):
//   Heading (30/36, 700) "You'll need a head rig"
//   Body    (17/25)      "Mount your phone on the head rig and make sure it
//                         is steady while recording."
//   Button  (btn-primary) "Next" → PracticeIntro (Phase 4 spliced Practice
//                                  between this and MainTabs)
//
// OWNER-DIRECTED DEVIATION from "verbatim §5" (debug session
// handgate-never-passes, 2026-05-12): a one-line framing-check tip is added
// under the body — now that the recording surface shows a live ultrawide
// camera preview from 'ready' onward, contributors are told to use it (and to
// have a helper sanity-check the frame) before each take. Treated like the
// en-US-voice override — flag in the commit; reflect back into design-spec §5.
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
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { Sheet } from '../../ui/primitives/Sheet';
import { colors, spacing } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import { decodeGoogleSubFromJwt } from '../../lib/jwtSub';
import { secureMmkv } from '../../state/mmkv';
import { practiceDoneKey } from '../../state/keys';
import { fetchMe } from '../../services/profileService';
import { logEvent } from '../../util/analytics';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RIG_ILLUSTRATION = require('../../assets/illustrations/rig.png');

// Plan 03-02 — OQ-1 resolved: support email is `support@humynlabs.ai`
// (02-COSMETIC-GAPS.md "Rig Tutorial screen" + 02-OPEN-QUESTIONS.md OQ-1
// resolution). Replaced the placeholder constant. The 5th and final
// placeholder occurrence landed inside Plan 03-03's merged CompatFailScreen
// (the standalone CompatRecoveryScreen was merged + deleted in 03-03).
const SUPPORT_EMAIL = 'support@humynlabs.ai';

interface ParentNav {
  replace: (route: string) => void;
  reset?: (state: { index: number; routes: { name: string }[] }) => void;
}
interface LocalNav {
  replace: (route: string) => void;
  reset?: (state: { index: number; routes: { name: string }[] }) => void;
  getParent: () => ParentNav | null | undefined;
}

/**
 * Phase 3 item 3 (2026-06-10, Bug 2) — how long the mount-time server
 * double-check may take before we stop waiting and leave the user on the
 * tutorial (the safe default). Short: this is a corner-case rescue, not a
 * load-bearing fetch.
 */
const GATE_DOUBLE_CHECK_TIMEOUT_MS = 4_000;

export default function RigTutorialScreen() {
  const navigation = useNavigation() as unknown as LocalNav;
  const setTutorialDone = useAppStore((s) => s.setTutorialDone);
  const jwt = useAppStore((s) => s.jwt);
  const [offRampOpen, setOffRampOpen] = useState(false);
  const { t } = useTranslation();

  // ONB-01 telemetry — single fire on mount.
  useEffect(() => {
    logEvent('rig_tutorial_shown');
  }, []);

  // Phase 3 item 3 (2026-06-10, Bug 2) — gate double-check. Both routes into
  // this screen (computeInitialRoute step 5 at boot; CompatPass auto-advance)
  // decide off the LOCAL practiceDoneKey cache, which can be stale (e.g. the
  // account completed practice but the seed never landed on this install).
  // Before making the user redo the tutorial, ask the server once with a
  // short timeout: fetchMe() seeds practiceDoneKey from practice_completed_at
  // as a side effect; if it lands non-null we skip straight to MainTabs.
  // Offline/timeout/401 → stay here (practice is the safe default).
  useEffect(() => {
    if (!jwt) return undefined;
    const sub = decodeGoogleSubFromJwt(jwt);
    let cancelled = false;
    const skipIfDone = (): boolean => {
      if (secureMmkv.getBoolean(practiceDoneKey(sub)) !== true) return false;
      // MainTabs lives on the parent RootNativeStack — reset on the parent
      // when present (same idiom as PracticeCompleteScreen / CompatPass).
      const parent = navigation.getParent?.();
      const target = parent && typeof parent.reset === 'function' ? parent : navigation;
      target.reset?.({ index: 0, routes: [{ name: 'MainTabs' }] });
      return true;
    };
    // Already seeded (e.g. CompatPass's fetchMe landed after its timer fired
    // but before this mount) — skip without a network round-trip.
    if (skipIfDone()) return undefined;
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), GATE_DOUBLE_CHECK_TIMEOUT_MS);
    });
    void Promise.race([fetchMe().catch(() => null), timeout]).then(() => {
      if (cancelled) return;
      skipIfDone();
    });
    return () => {
      cancelled = true;
    };
    // Intentionally mount-only ([]): jwt is read once — the double-check is a
    // one-shot rescue, not a reactive gate.
  }, []);

  const handleNext = () => {
    const googleSub = decodeGoogleSubFromJwt(jwt);
    // The legacy onboarding.tutorialDone.v1 flag still flips here (separate
    // from the new per-account practice flag, which PracticeComplete writes).
    setTutorialDone(googleSub);
    // Phase 4: Next now advances to PracticeIntro (the new OnboardingStack
    // route from plan 04-06) → Recording → PracticeComplete → MainTabs. We
    // stay inside OnboardingStack here, so navigate on the local navigator;
    // fall back to the parent navigator if the local one lacks `replace`.
    if (typeof navigation.replace === 'function') {
      navigation.replace('PracticeIntro');
    } else {
      const parent = navigation.getParent?.();
      parent?.replace('PracticeIntro');
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
          {t('rigTutorial.heading')}
        </Text>
        <View style={{ height: spacing.m }} />
        <Text
          variant="tutBody"
          tone="secondary"
          style={styles.body}
          accessibilityLabel="rig tutorial body"
        >
          {t('rigTutorial.body')}
        </Text>
        <View style={{ height: spacing.m }} />
        <Text
          variant="caption"
          tone="tertiary"
          style={styles.body}
          accessibilityLabel="rig tutorial framing tip"
        >
          {t('rigTutorial.framingTip')}
        </Text>
        <View style={{ height: spacing.l }} />
        <Pressable
          onPress={handleNoRig}
          accessibilityRole="link"
          accessibilityLabel="Don't have a rig yet"
        >
          <Text variant="caption" style={styles.noRigLink}>
            {t('rigTutorial.noRigLink')}
          </Text>
        </Pressable>
      </View>

      <Button
        variant="primary"
        label={t('rigTutorial.buttonNext')}
        onPress={handleNext}
        accessibilityLabel="Next"
      />

      <Sheet
        visible={offRampOpen}
        onDismiss={() => setOffRampOpen(false)}
        accessibilityLabel="No rig off-ramp sheet"
      >
        <Text variant="sheetTitle" tone="primary" accessibilityLabel="off-ramp title">
          {t('rigTutorial.offRamp.title')}
        </Text>
        <View style={{ height: spacing.m }} />
        <Text variant="body" tone="primary" accessibilityLabel="off-ramp body">
          {t('rigTutorial.offRamp.bodyPrefix', { email: SUPPORT_EMAIL })}
        </Text>
        <View style={{ height: spacing.l }} />
        <Button
          variant="primary"
          label={t('rigTutorial.offRamp.emailSupport')}
          onPress={handleEmailSupport}
          accessibilityLabel="Email support about rig"
        />
        <View style={{ height: spacing.m }} />
        <Button
          variant="outline"
          label={t('rigTutorial.offRamp.gotIt')}
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
