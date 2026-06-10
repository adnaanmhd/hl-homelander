// PracticeCompleteScreen — design-spec §8 (Practice complete, `#practice-done`).
// The terminal screen of the onboarding flow: RigTutorial → PracticeIntro →
// Recording (practice mode) → **PracticeComplete** → MainTabs.
//
// Verbatim §8 / 04-UI-SPEC:
//   - 96×96 success badge (circle, `--success #2EB872` fill, 56 px white
//     check glyph, scale-pop 0 → 1.1 → 1.0 over 500 ms on mount).
//   - Confetti burst — 18 particles, random accent-palette hues, 800–1200 ms
//     rise (see ./components/Confetti).
//   - Vibrate pattern [40, 80, 40] ms on enter (engineering-handoff §6.2 —
//     `Vibration.vibrate([0, 40, 80, 40])`: a leading 0 = no initial pause,
//     so the array is off-0 / on-40 / off-80 / on-40, i.e. the §6.2 pattern).
//   - Heading (title28 28/34 700 -0.4px, centered): "You got it." (design-spec
//     §8 — prototype heading not fully captured; the spec's recommended
//     string; PM may override).
//   - Sticky CTA (btn-primary = `--text` fill, NOT accent): "Continue" →
//     writes the per-account ONB-08 once-per-install flag
//     (appStore.setPracticeDone(sub), sub from decodeGoogleSubFromJwt) then
//     navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] }) → Home
//     first-time hero.
//
// Spacing per 04-UI-SPEC § Spacing: screen gutter 32 px (`spacing.hh`),
// major top inset 48 px (`spacing.xxxxl`), bottom inset 24 px (`spacing.xxxl`).
//
// The badge scale-pop and the confetti rise both START in effects, so the
// rendered tree at first paint is the static pre-animation frame — keeps the
// `practice-complete-static.png` visual baseline deterministic.
//
// T-4.6-03: this screen MUST NOT log the JWT or `sub` — `practice_complete_*`
// analytics events carry no PII (analytics.ts PII guard).
//
// Analytics:
//   - practice_complete_shown     → fires once on mount
//   - practice_complete_continued → fires when "Continue" is tapped
// Both names are pre-registered in src/util/analytics.ts EVENT_NAMES.

import React, { useEffect } from 'react';
import { StyleSheet, Vibration, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { colors, spacing } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import { decodeGoogleSubFromJwt } from '../../lib/jwtSub';
import { postPracticeComplete } from '../../services/profileService';
import {
  markPracticeServerPostPending,
  clearPracticeServerPostPending,
} from '../../services/practiceSync';
import { logEvent } from '../../util/analytics';
import Confetti from './components/Confetti';

// design-spec §8 — badge is 96×96, check glyph 56 px white, scale-pop 500 ms.
const BADGE_SIZE = 96;
const CHECK_SIZE = 56;
const SCALE_POP_MS = 500;

// engineering-handoff §6.2 — practice-done vibrate `[40, 80, 40]` ms. RN's
// Vibration.vibrate([…]) array is interpreted off/on/off/on…, so prepend a
// 0 (no leading wait) to make the first 40 a vibrate.
const PRACTICE_DONE_VIBRATE = [0, 40, 80, 40] as const;

interface ResetNav {
  reset: (state: { index: number; routes: { name: string }[] }) => void;
  getParent: () => ResetNav | null | undefined;
}

export default function PracticeCompleteScreen() {
  const navigation = useNavigation() as unknown as ResetNav;
  const scale = useSharedValue(0);
  const { t } = useTranslation();

  useEffect(() => {
    logEvent('practice_complete_shown');
    // [40,80,40] ms haptic on enter (engineering-handoff §6.2). Best-effort —
    // Vibration is a no-op when the device has vibration disabled.
    try {
      Vibration.vibrate([...PRACTICE_DONE_VIBRATE]);
    } catch {
      /* haptic best-effort */
    }
    // Scale-pop 0 → 1.1 → 1.0 over 500 ms (design-spec §8).
    scale.value = withSequence(
      withTiming(1.1, { duration: SCALE_POP_MS * 0.6 }),
      withTiming(1.0, { duration: SCALE_POP_MS * 0.4 }),
    );
  }, [scale]);

  const badgeAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleContinue = () => {
    const sub = decodeGoogleSubFromJwt(useAppStore.getState().jwt);
    // Write the per-account ONB-08 once-per-install flag (write-through to
    // MMKV; computeInitialRoute reads it at the next boot to skip the
    // tutorial). Never log `sub` (T-4.6-03).
    useAppStore.getState().setPracticeDone(sub);
    // Bug 5 / D7 + Phase 3 (2026-06-10, Bug 2) — persist completion server-side
    // DURABLY. Non-blocking (navigation never waits on the network), but no
    // longer fire-and-forget: the per-sub pending flag is set BEFORE the
    // attempt and cleared on success, so a POST lost to offline / a process
    // kill / a stale server is re-flushed by practiceSync on the next boot or
    // app-foreground instead of silently dropped (which re-gated existing
    // users through the tutorial on their next reinstall).
    markPracticeServerPostPending(sub);
    void postPracticeComplete()
      .then(() => clearPracticeServerPostPending(sub))
      .catch((e: unknown) => {
        // 409 = the server already has it — done. Everything else keeps the
        // pending flag for the practiceSync flush.
        const msg = e instanceof Error ? e.message : '';
        if (/failed: 409/.test(msg)) clearPracticeServerPostPending(sub);
      });
    logEvent('practice_complete_continued');
    // MainTabs is a RootNativeStack route — reset on the parent navigator
    // when present (we are nested inside OnboardingStack); fall back to the
    // local navigator otherwise. Same parent-hop idiom RigTutorial uses.
    const parent = navigation.getParent?.();
    const target = parent && typeof parent.reset === 'function' ? parent : navigation;
    target.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  return (
    <ScreenContainer
      accessibilityLabel="PracticeComplete screen"
      padding={spacing.hh}
      style={styles.screen}
    >
      <View style={styles.center}>
        <View style={styles.badgeWrap} accessibilityLabel="practice complete badge">
          <Confetti />
          <Animated.View style={[styles.badge, badgeAnimStyle]}>
            <Check size={CHECK_SIZE} color={colors.surface} strokeWidth={3} />
          </Animated.View>
        </View>
        <View style={{ height: spacing.xl }} />
        <Text
          variant="title28"
          tone="primary"
          style={styles.heading}
          accessibilityLabel="practice complete heading"
        >
          {t('practiceComplete.heading')}
        </Text>
      </View>

      <Button
        variant="primary"
        label={t('practiceComplete.buttonContinue')}
        accessibilityLabel="Continue"
        onPress={handleContinue}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // 04-UI-SPEC § Spacing — major top inset 48px, bottom inset 24px (the
  // 32px horizontal gutter comes via ScreenContainer `padding`).
  screen: {
    paddingTop: spacing.xxxxl,
    paddingBottom: spacing.xxxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { textAlign: 'center' },
});
