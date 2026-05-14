// FilterSheet — Phase 6 Wave 4 (Plan 06-08).
//
// Shared bottom sheet used by Home tiles (this plan) AND by History filter
// chip (Plan 06-09). Two layers per UI-SPEC §Filter sheet (§16):
//   - 16a "Filter by" — 6 quick-select rows (Today / Yesterday / This week
//     / This month / All time / Custom range).
//   - 16b "Custom range" — From + To date inputs + sticky Cancel/Apply
//     footer; validations: missing dates, inverted range, future dates.
//
// Date input choice (planner — D-03c / RESEARCH Q-3):
//   `@react-native-community/datetimepicker` is NOT in the package.json
//   dep list. Per the plan's <action>, the simplest MVP path is a free-text
//   `<TextInput>` with regex-validated `YYYY-MM-DD`. Documented in the
//   06-08-SUMMARY. A follow-on plan can swap in a real picker without
//   changing the FilterSheet's public surface (the {start, end} ISO
//   strings stay the same).
//
// Component is internally stateful for layer + the in-progress custom
// date pair; once Apply fires the parent commits via `onCustomChange`.
// Cancelling 16b returns to 16a (NOT closes the sheet) — matches
// design-spec §16b "back to 16a" implied by the dual-button footer.
//
// Tokens-only; no hex literals.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal as RNModal,
  Pressable as RNPressable,
  TextInput,
  ScrollView,
} from 'react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import { Check } from 'lucide-react-native';
import Text from '../../ui/primitives/Text';
import { Pressable } from '../../ui/primitives/Pressable';
import { colors, radii, spacing, typography } from '../../ui/tokens';
import type { NamedRange } from '../../services/timeRange';

const SCRIM_COLOR = 'rgba(0, 0, 0, 0.5)';

/** YYYY-MM-DD client-side guard (mirror of the server regex in
 *  ContributionsTimeseriesQuerySchema). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The 6 quick-select options exactly per UI-SPEC §16a, in order. */
const QUICK_OPTIONS: ReadonlyArray<{ value: NamedRange | 'custom-pick'; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'all', label: 'All time' },
  // `Custom range` is a navigation action (push to 16b), not a value the
  // sheet commits on tap — distinguished here by 'custom-pick'.
  { value: 'custom-pick', label: 'Custom range' },
];

export interface FilterSheetProps {
  visible: boolean;
  /** The currently-selected named range (drives the "selected" highlight). */
  value: NamedRange;
  /** The current custom-range pair, when `value === 'custom'`. Used to
   *  pre-populate 16b inputs on re-open. */
  valueCustom?: { start: string; end: string } | null;
  onDismiss: () => void;
  /** Fires when the user taps a non-custom quick-select option. */
  onChange: (named: NamedRange) => void;
  /** Fires when the user submits a valid From/To pair from 16b. */
  onCustomChange: (start: string, end: string) => void;
}

type Layer = '16a' | '16b';
type ValidationError = null | 'missing' | 'inverted' | 'future';

function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function validate(start: string, end: string): ValidationError {
  if (!ISO_DATE_RE.test(start) || !ISO_DATE_RE.test(end)) return 'missing';
  if (start > end) return 'inverted';
  if (end > todayIso()) return 'future';
  return null;
}

export function FilterSheet({
  visible,
  value,
  valueCustom,
  onDismiss,
  onChange,
  onCustomChange,
}: FilterSheetProps): React.JSX.Element {
  const [layer, setLayer] = useState<Layer>('16a');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  // Reset internal state when the sheet (re-)opens. Pre-populate From/To
  // from `valueCustom` if the caller has a custom range pinned.
  useEffect(() => {
    if (visible) {
      setLayer('16a');
      setFrom(valueCustom?.start ?? '');
      setTo(valueCustom?.end ?? '');
    }
  }, [visible, valueCustom]);

  const handlePickNamed = useCallback(
    (named: NamedRange) => {
      try {
        HapticFeedback.trigger('selection');
      } catch {
        /* haptic best-effort */
      }
      onChange(named);
      onDismiss();
    },
    [onChange, onDismiss],
  );

  const handlePushCustom = useCallback(() => {
    try {
      HapticFeedback.trigger('selection');
    } catch {
      /* haptic best-effort */
    }
    setLayer('16b');
  }, []);

  const error = validate(from, to);
  const canApply = error == null;

  const handleApply = useCallback(() => {
    if (validate(from, to) != null) return;
    onCustomChange(from, to);
    onDismiss();
  }, [from, to, onCustomChange, onDismiss]);

  const handleCancel16b = useCallback(() => {
    // Cancel returns to 16a (NOT closes the sheet) — matches design-spec
    // §16b's dual-button footer; the scrim/back gesture closes the sheet.
    setLayer('16a');
  }, []);

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <RNPressable accessibilityLabel="filter-sheet-scrim" onPress={onDismiss} style={styles.scrim}>
        <RNPressable
          accessibilityLabel="filter-sheet"
          onPress={() => {
            /* swallow taps on the sheet body */
          }}
          style={styles.sheet}
        >
          {layer === '16a' ? (
            <Layer16a
              currentValue={value}
              onPickNamed={handlePickNamed}
              onPushCustom={handlePushCustom}
            />
          ) : (
            <Layer16b
              from={from}
              to={to}
              setFrom={setFrom}
              setTo={setTo}
              error={error}
              canApply={canApply}
              onCancel={handleCancel16b}
              onApply={handleApply}
            />
          )}
        </RNPressable>
      </RNPressable>
    </RNModal>
  );
}

// -----------------------------------------------------------------------------
// 16a — quick-select layer
// -----------------------------------------------------------------------------
function Layer16a({
  currentValue,
  onPickNamed,
  onPushCustom,
}: {
  currentValue: NamedRange;
  onPickNamed: (n: NamedRange) => void;
  onPushCustom: () => void;
}): React.JSX.Element {
  return (
    <View accessibilityLabel="filter-sheet-16a">
      <Text variant="bodyLg" style={styles.title16a}>
        Filter by
      </Text>
      {QUICK_OPTIONS.map((opt) => {
        const isSelected =
          opt.value === 'custom-pick' ? currentValue === 'custom' : currentValue === opt.value;
        const press = () => {
          if (opt.value === 'custom-pick') {
            onPushCustom();
          } else {
            onPickNamed(opt.value as NamedRange);
          }
        };
        return (
          <Pressable
            key={opt.value}
            accessibilityLabel={`filter-option-${opt.value}`}
            onPress={press}
            style={styles.optionRow}
          >
            <Text
              variant="body"
              style={[styles.optionLabel, isSelected ? styles.optionLabelSelected : null]}
            >
              {opt.label}
            </Text>
            {isSelected ? <Check size={20} color={colors.accent} strokeWidth={2} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// -----------------------------------------------------------------------------
// 16b — custom range layer
// -----------------------------------------------------------------------------
function Layer16b({
  from,
  to,
  setFrom,
  setTo,
  error,
  canApply,
  onCancel,
  onApply,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  error: ValidationError;
  canApply: boolean;
  onCancel: () => void;
  onApply: () => void;
}): React.JSX.Element {
  let errorText: string | null = null;
  if (error === 'missing') errorText = 'Pick both dates.';
  else if (error === 'inverted') errorText = '"From" date must be before "To" date.';
  else if (error === 'future') errorText = "Dates can't be in the future.";

  return (
    <View accessibilityLabel="filter-sheet-16b">
      <Text variant="sheetTitle" style={styles.title16b}>
        Custom range
      </Text>
      <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Text variant="formLabel" style={styles.formLabel}>
          FROM
        </Text>
        <TextInput
          accessibilityLabel="filter-custom-from"
          value={from}
          onChangeText={setFrom}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text3}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
        />
        <Text variant="formLabel" style={styles.formLabel}>
          TO
        </Text>
        <TextInput
          accessibilityLabel="filter-custom-to"
          value={to}
          onChangeText={setTo}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text3}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
        />
        {errorText ? (
          <Text variant="caption" accessibilityLabel="filter-custom-error" style={styles.errorText}>
            {errorText}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="filter-custom-cancel"
          onPress={onCancel}
          style={styles.btnOutline}
        >
          <Text variant="btnLabel" style={styles.btnOutlineLabel}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="filter-custom-apply"
          onPress={canApply ? onApply : undefined}
          style={canApply ? styles.btnPrimary : styles.btnPrimaryDisabled}
          disabled={!canApply}
        >
          <Text variant="btnLabel" style={styles.btnPrimaryLabel}>
            Apply
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: SCRIM_COLOR, // rgba — allowed by no-hex gate (no '#')
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxxl,
  },
  // 16a
  title16a: {
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.mdl, // 14 px vertical per UI-SPEC §16a
    paddingHorizontal: spacing.l, // 16 px horizontal label inset
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  optionLabel: {
    color: colors.text,
  },
  optionLabelSelected: {
    color: colors.accent,
    fontFamily: typography.fontFamily.semibold,
  },
  // 16b
  title16b: {
    color: colors.text,
    marginBottom: spacing.l,
  },
  formScroll: {
    maxHeight: 300,
  },
  formLabel: {
    color: colors.text2,
    marginBottom: spacing.s,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.l,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    marginBottom: spacing.l,
  },
  errorText: {
    color: colors.coral,
    marginBottom: spacing.m,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.ms,
    marginTop: spacing.l,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.l,
  },
  btnOutlineLabel: {
    color: colors.text,
  },
  btnPrimary: {
    backgroundColor: colors.text,
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.l,
  },
  btnPrimaryDisabled: {
    backgroundColor: colors.line,
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.l,
  },
  btnPrimaryLabel: {
    color: colors.surface,
  },
});

export default FilterSheet;
