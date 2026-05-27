// ChooseLanguageScreen — Phase 7 Plan 07-04 Task 1 (I18N-02 + I18N-03).
//
// Design carve-out #2 per D-20 / SPEC I18N-03 (the second carve-out from the
// 3 locked design files; first = owner deviations documented in CLAUDE.md).
// The screen is token-only — no hex literals, no references to tokens that
// do not exist in `apps/mobile/src/ui/tokens.ts`.
//
// Rendered between Splash and Signup on FIRST LAUNCH ONLY (D-22). The
// initial-route gate (`computeInitialRoute` in `src/state/initialRoute.ts`)
// returns `{ stack: 'OnboardingStack', screen: 'ChooseLanguage' }` while
// `localeMmkv.contains(LOCALE_KEYS.CHOSEN_AT) === false`; once the user
// taps Continue and both keys are stamped, the gate is transparent until
// delete-account / fresh install clears MMKV.
//
// Continue contract (D-22 + D-30):
//   1. Write localeMmkv.CODE       = pending locale (BCP-47)
//   2. Write localeMmkv.CHOSEN_AT  = new Date().toISOString()
//   3. i18n.changeLanguage(pending) — provider re-renders downstream
//   4. logEvent('locale_chosen', { installation_id, chosen_locale })
//   5. navigation.replace('Signup') — D-22 explicitly says replace (not
//      navigate) so the user cannot back-gesture into ChooseLanguage; the
//      stack's `gestureEnabled: false` (OnboardingStack screen options) is
//      defense-in-depth.
//
// Default selection (D-22): pre-selects 'en'. The Continue tap commits the
// SELECTED row's locale — so a user who never touches a row still gets the
// English locale stamped (the existing localeBootstrap default is 'en' but
// CHOSEN_AT must be set so the gate doesn't re-fire on relaunch).

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18nDefault from '../../i18n';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { LanguageList } from '../../components/LanguageList';
import { localeMmkv, LOCALE_KEYS, type Locale } from '../../i18n/storage';
import { spacing } from '../../ui/tokens';
import { logEvent } from '../../util/analytics';
import { useAppStore } from '../../state/appStore';

interface NavigationLike {
  replace: (name: 'Signup') => void;
}

export default function ChooseLanguageScreen(): React.JSX.Element {
  const navigation = useNavigation() as unknown as NavigationLike;
  const { t } = useTranslation();
  const [pending, setPending] = useState<Locale>('en');
  const installationId = useAppStore((s) => s.installationId);

  const handleContinue = (): void => {
    try {
      localeMmkv.set(LOCALE_KEYS.CODE, pending);
      localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, new Date().toISOString());
    } catch {
      // MMKV best-effort — never block the user on a write failure.
    }

    // Fire-and-forget. i18n.changeLanguage returns a Promise; if it rejects
    // we still continue to Signup (the fallback chain falls back to 'en').
    void i18nDefault.changeLanguage(pending);

    logEvent('locale_chosen', {
      installation_id: installationId ?? 'unknown',
      chosen_locale: pending,
    });

    if (typeof navigation.replace === 'function') {
      navigation.replace('Signup');
    }
  };

  return (
    <ScreenContainer accessibilityLabel="ChooseLanguage screen" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body} accessibilityLabel="choose-language-scroll">
        <Text
          variant="title28"
          tone="primary"
          style={styles.title}
          accessibilityLabel="choose-language-title"
        >
          {t('onboarding.chooseLanguage.title')}
        </Text>
        <View style={styles.list}>
          <LanguageList value={pending} onSelect={setPending} />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          variant="primary"
          label={t('onboarding.chooseLanguage.continueButton')}
          accessibilityLabel="choose-language-continue"
          onPress={handleContinue}
        />
      </View>
    </ScreenContainer>
  );
}

// Token contract — every value below references tokens that exist in
// apps/mobile/src/ui/tokens.ts. NO hex literals.
const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  body: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.l,
  },
  list: {
    marginTop: spacing.m,
  },
  footer: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xl,
  },
});
