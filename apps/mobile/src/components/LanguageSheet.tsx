// LanguageSheet — Phase 7 Plan 07-04 Task 2 (I18N-04 + D-02 + D-17 + D-19).
//
// Profile bottom-sheet picker. Composes the existing `Sheet` primitive per
// D-17 (no new gesture dep, NOT @gorhom/bottom-sheet) + the shared
// `LanguageList` row renderer + `i18n.changeLanguage` + the locale telemetry
// channel extended in plan 07-03.
//
// Behavioural contract:
//   - Tap-to-commit + auto-dismiss (D-02). NO Apply button.
//   - Single tap on a non-current row:
//       1. localeMmkv.set(LOCALE_KEYS.CODE, loc)
//       2. localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, ISO)
//       3. i18n.changeLanguage(loc) — provider re-renders downstream
//       4. logEvent('locale_changed', { installation_id, from_locale, to_locale })
//       5. onDismiss()
//   - Single tap on the current row: only onDismiss() (no commit, no
//     telemetry — re-committing the same locale would emit a no-op event).
//
// Token contract (SPEC I18N-03): all style values reference tokens that
// exist in `apps/mobile/src/ui/tokens.ts`. NO hex literals.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nDefault from '../i18n';
import { Sheet } from '../ui/primitives/Sheet';
import { Text } from '../ui/primitives/Text';
import { LanguageList } from './LanguageList';
import { localeMmkv, LOCALE_KEYS, type Locale } from '../i18n/storage';
import { spacing } from '../ui/tokens';
import { logEvent } from '../util/analytics';
import { useAppStore } from '../state/appStore';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function LanguageSheet({ visible, onDismiss }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const installationId = useAppStore((s) => s.installationId);
  const current = (i18n.language as Locale) ?? 'en';

  const handleSelect = (loc: Locale): void => {
    if (loc === current) {
      onDismiss();
      return;
    }

    try {
      localeMmkv.set(LOCALE_KEYS.CODE, loc);
      localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, new Date().toISOString());
    } catch {
      // MMKV best-effort.
    }

    void i18nDefault.changeLanguage(loc);

    logEvent('locale_changed', {
      installation_id: installationId ?? 'unknown',
      from_locale: current,
      to_locale: loc,
    });

    onDismiss();
  };

  return (
    <Sheet visible={visible} onDismiss={onDismiss} accessibilityLabel="language-sheet">
      <View style={styles.body}>
        <Text variant="sheetTitle" tone="primary" style={styles.title}>
          {t('profile.language.picker.title')}
        </Text>
        <LanguageList value={current} onSelect={handleSelect} />
      </View>
    </Sheet>
  );
}

// Token contract — every value below references tokens that exist in
// apps/mobile/src/ui/tokens.ts. NO hex literals.
const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.s,
  },
  title: {
    marginBottom: spacing.m,
  },
});

export default LanguageSheet;
