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
  ScrollView,
} from 'react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
// Plan 06-12 follow-on (Finding 5, owner directive 2026-05-14) — replace
// the two free-text `YYYY-MM-DD` TextInputs in the 16b custom-range layer
// with the platform native date picker. Picker honours device locale +
// dark theme out of the box on Android 14+.
import DateTimePicker from '@react-native-community/datetimepicker';
import Text from '../../ui/primitives/Text';
import { Pressable } from '../../ui/primitives/Pressable';
import { colors, radii, spacing, typography } from '../../ui/tokens';
import type { NamedRange } from '../../services/timeRange';

const SCRIM_COLOR = 'rgba(0, 0, 0, 0.5)';

/** YYYY-MM-DD client-side guard (mirror of the server regex in
 *  ContributionsTimeseriesQuerySchema). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The 6 quick-select options exactly per UI-SPEC §16a, in order.
 *
 * G-21 (Plan 07-16): the `label` field is now an i18n KEY resolved at render
 * time via t(opt.labelKey). The 6 values are already in en.json under
 * `history.filter.*` (Phase 6 + 07-05 sweep). */
const QUICK_OPTIONS: ReadonlyArray<{ value: NamedRange | 'custom-pick'; labelKey: string }> = [
  { value: 'today', labelKey: 'history.filter.today' },
  { value: 'yesterday', labelKey: 'history.filter.yesterday' },
  { value: 'this-week', labelKey: 'history.filter.thisWeek' },
  { value: 'this-month', labelKey: 'history.filter.thisMonth' },
  { value: 'all', labelKey: 'history.filter.allTime' },
  // `Custom range` is a navigation action (push to 16b), not a value the
  // sheet commits on tap — distinguished here by 'custom-pick'.
  { value: 'custom-pick', labelKey: 'history.filter.customRange' },
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

  // The scrim and sheet body are SIBLINGS — not parent/child. JSDOM doesn't
  // honor RN's gesture-responder event-stop semantics, so a nested-Pressable
  // pattern (the Sheet primitive's shape) fires `onDismiss` whenever a child
  // Pressable's click bubbles up. Making the scrim a sibling keeps inner
  // taps from triggering dismiss. The sheet body is absolute-positioned
  // bottom; the scrim absolute-positioned fills the remaining backdrop.
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.modalRoot}>
        <RNPressable
          accessibilityLabel="filter-sheet-scrim"
          onPress={onDismiss}
          style={styles.scrim}
        />
        <View accessibilityLabel="filter-sheet" style={styles.sheet}>
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
        </View>
      </View>
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
  const { t } = useTranslation();
  return (
    <View accessibilityLabel="filter-sheet-16a">
      <Text variant="bodyLg" style={styles.title16a}>
        {t('history.filterSheet.title')}
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
              {t(opt.labelKey)}
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

/** Helper — parse a YYYY-MM-DD string into a local Date, fall back to today. */
function parseIsoDateOrToday(iso: string): Date {
  if (ISO_DATE_RE.test(iso)) {
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** Format a Date as `YYYY-MM-DD` in the device's local timezone. */
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  // Plan 06-12 follow-on (Finding 5) — picker visibility for each leg.
  // Android's native picker is a one-shot modal; we mount the component
  // conditionally and unmount it on `onChange` (the user either picked a
  // date or dismissed the dialog).
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const maxDate = new Date();

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
        <RNPressable
          accessibilityLabel="filter-custom-from"
          accessibilityRole="button"
          onPress={() => setShowFromPicker(true)}
          style={styles.input}
        >
          <Text
            variant="body"
            style={from.length === 0 ? styles.inputPlaceholder : styles.inputValue}
          >
            {from.length > 0 ? from : 'Pick a date'}
          </Text>
        </RNPressable>
        {showFromPicker ? (
          <DateTimePicker
            testID="filter-custom-from-picker"
            value={parseIsoDateOrToday(from)}
            mode="date"
            display="default"
            maximumDate={maxDate}
            onChange={(_e, selected) => {
              setShowFromPicker(false);
              if (selected) setFrom(dateToIso(selected));
            }}
          />
        ) : null}
        <Text variant="formLabel" style={styles.formLabel}>
          TO
        </Text>
        <RNPressable
          accessibilityLabel="filter-custom-to"
          accessibilityRole="button"
          onPress={() => setShowToPicker(true)}
          style={styles.input}
        >
          <Text
            variant="body"
            style={to.length === 0 ? styles.inputPlaceholder : styles.inputValue}
          >
            {to.length > 0 ? to : 'Pick a date'}
          </Text>
        </RNPressable>
        {showToPicker ? (
          <DateTimePicker
            testID="filter-custom-to-picker"
            value={parseIsoDateOrToday(to)}
            mode="date"
            display="default"
            maximumDate={maxDate}
            onChange={(_e, selected) => {
              setShowToPicker(false);
              if (selected) setTo(dateToIso(selected));
            }}
          />
        ) : null}
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SCRIM_COLOR, // rgba — allowed by no-hex gate (no '#')
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
    marginBottom: spacing.l,
    // The Pressable replacing the TextInput needs a min height that matches
    // the input's previous vertical padding (Plan 06-12 Finding 5).
    minHeight: 44,
    justifyContent: 'center',
  },
  // Owner directive 2026-05-14 — placeholder + filled-value styles for the
  // Pressable that now hosts the picker affordance (where a TextInput once
  // lived).
  inputPlaceholder: {
    color: colors.text3,
  },
  inputValue: {
    color: colors.text,
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
