/**
 * LanguageList — shared 8-row renderer per 07-CONTEXT Claude's-discretion
 * item + 07-PATTERNS "LanguageList.tsx" section.
 *
 * Rendered by both:
 *   - ChooseLanguageScreen (first-launch, design carve-out #2 / D-20)
 *   - LanguageSheet (Profile bottom-sheet picker, D-17)
 *
 * Behavioural contract per D-19:
 *   - Renders 8 rows in `LOCALE_DISPLAY_ORDER` (D-18).
 *   - Each row: native name on the LEFT, English name on the RIGHT
 *     (tertiary tone), plus a lucide `Check` icon on the selected row.
 *   - Single tap on any row fires `onSelect(loc)` — the parent owns the
 *     side effects (MMKV write, i18n.changeLanguage, telemetry, dismiss).
 *
 * Token contract (SPEC I18N-03): every style value references tokens that
 * already exist in `apps/mobile/src/ui/tokens.ts`. NO hex literals. The
 * exact picks (see 07-04 PLAN `<interfaces>` block):
 *   - Selected-row bg:        colors.accentSoft
 *   - Row corner radius:      radii.button (14)
 *   - English-name tone:      colors.text3 via Text tone="tertiary"
 *   - Check icon color:       colors.accent
 *   - Row gutter:             spacing.l (h) / spacing.m (v)
 *   - Slot gap (native↔eng):  spacing.s
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Pressable } from '../ui/primitives/Pressable';
import { Text } from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';
import {
  LOCALE_DISPLAY_ORDER,
  LOCALE_NATIVE_NAMES,
  LOCALE_ENGLISH_NAMES,
} from '../i18n/locale-meta';
import type { Locale } from '../i18n/storage';

interface Props {
  value: Locale;
  onSelect: (loc: Locale) => void;
}

export function LanguageList({ value, onSelect }: Props): React.JSX.Element {
  return (
    <View accessibilityLabel="language-list">
      {LOCALE_DISPLAY_ORDER.map((loc) => {
        const isSelected = loc === value;
        return (
          <Pressable
            key={loc}
            accessibilityLabel={`language-row-${loc}`}
            onPress={() => onSelect(loc)}
            style={[styles.row, isSelected ? styles.rowSelected : null]}
          >
            <Text variant="body" tone="primary">
              {LOCALE_NATIVE_NAMES[loc]}
            </Text>
            <View style={styles.rightSlot}>
              <Text variant="caption" tone="tertiary">
                {LOCALE_ENGLISH_NAMES[loc]}
              </Text>
              {isSelected ? <Check size={20} color={colors.accent} strokeWidth={2} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Token contract — every value below references tokens that exist in
// apps/mobile/src/ui/tokens.ts (verified 2026-05-24). NO hex literals.
// NO references to tokens that the token surface does not define (see the
// 07-04 PLAN `<interfaces>` block for the canonical-existing-token list).
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: radii.button,
    marginVertical: spacing.xs,
  },
  rowSelected: {
    backgroundColor: colors.accentSoft,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
});

export default LanguageList;
