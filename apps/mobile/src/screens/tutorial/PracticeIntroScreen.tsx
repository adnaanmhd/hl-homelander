// PracticeIntroScreen — design-spec §6 (Tutorial — Practice intro,
// `#tut-practice`). Registered in OnboardingStack between RigTutorial and the
// Recording surface (a RootNativeStack route, registered by plan 04-07).
//
// §6 / 04-UI-SPEC § Copywriting — ⚠ OWNER DEVIATION 2026-05-12 (debug-session
// smoke walk): the body copy is shortened to "We'll walk you through one short
// recording — 60 secs, to get the feel" and the "This is a practice task — it
// does not count towards your contribution." muted line is REMOVED. (Reflect
// into design-spec §6 / 04-UI-SPEC § Copywriting in a doc pass.) Now:
//   Heading (tutorialHeading 30/36 700 -0.5px) "One quick try"
//   Body    (tutBody 17/25 400)               "We'll walk you through one
//                                              short recording — 60 secs, to
//                                              get the feel"
//   Button  (btn-accent — `--accent #FF6A2D`) "Start practice"
//
// Same layout as RigTutorialScreen (centered text stack + bottom CTA). Screen
// gutter = 28px (`spacing.h`) per 04-UI-SPEC § Spacing ("Practice-intro
// screen gutter"). `--accent` is reserved for exactly this "go-do-the-
// recording" CTA on the light surfaces (04-UI-SPEC § Color).
//
// Start practice → `navigation.replace('Recording', { taskId: '__practice__',
// taskName: 'Practice — 60 sec', isPractice: true })`. `Recording` is a
// RootNativeStack-level route (plan 04-07), so we leave OnboardingStack via
// the parent navigator when one is present — same idiom RigTutorialScreen
// uses for its parent-navigator hop; falls back to the local navigator.
//
// Analytics:
//   - practice_intro_shown → fires once on mount
//   - practice_started     → fires when "Start practice" is tapped
// Both names are pre-registered in src/util/analytics.ts EVENT_NAMES.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { spacing } from '../../ui/tokens';
import { logEvent } from '../../util/analytics';

// The practice "task" — `__practice__` is the sentinel taskId the capture
// pipeline / upload queue use to mark a recording as practice (never
// uploaded, not in History, not counted). Mirrors prototype.html
// `startRecording('Practice — 60 sec', true)`.
//
// G-25 (Plan 07-17): taskName intentionally omitted from the const. The
// destination `RecordingScreen.tsx` falls back to
// `t('recording.practiceFallback')` so the active locale renders in the
// app-bar (was hardcoded English, defeating the locale switch in Profile).
const PRACTICE_ROUTE_PARAMS = {
  taskId: '__practice__',
  isPractice: true,
} as const;

interface ParentNav {
  replace: (route: string, params?: Record<string, unknown>) => void;
}
interface LocalNav {
  replace: (route: string, params?: Record<string, unknown>) => void;
  getParent: () => ParentNav | null | undefined;
}

export default function PracticeIntroScreen() {
  const navigation = useNavigation() as unknown as LocalNav;
  const { t } = useTranslation();

  useEffect(() => {
    logEvent('practice_intro_shown');
  }, []);

  const handleStart = () => {
    logEvent('practice_started');
    // 'Recording' is a RootNativeStack route (plan 04-07) — hop to the
    // parent navigator when present (we are nested inside OnboardingStack);
    // fall back to the local navigator otherwise.
    const parent = navigation.getParent?.();
    if (parent && typeof parent.replace === 'function') {
      parent.replace('Recording', { ...PRACTICE_ROUTE_PARAMS });
    } else {
      navigation.replace('Recording', { ...PRACTICE_ROUTE_PARAMS });
    }
  };

  return (
    <ScreenContainer accessibilityLabel="PracticeIntro screen" padding={spacing.h}>
      <View style={styles.center}>
        <Text
          variant="tutorialHeading"
          tone="primary"
          style={styles.heading}
          accessibilityLabel="practice intro heading"
        >
          {t('practiceIntro.heading')}
        </Text>
        <View style={{ height: spacing.md }} />
        <Text
          variant="tutBody"
          tone="secondary"
          style={styles.body}
          accessibilityLabel="practice intro body"
        >
          {t('practiceIntro.body')}
        </Text>
      </View>

      <Button
        variant="accent"
        label={t('practiceIntro.buttonStart')}
        accessibilityLabel="Start practice"
        onPress={handleStart}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 320 },
});
