// InlineEditField — D-PROF-01 inline-edit row.
//
// Tap a label row → it becomes a TextInput → blur fires onSave with the new
// value (or null when input is empty for nullable fields). Optimistic UI is
// the caller's concern (revert + toast on error); this component just owns
// the editing-mode toggle + draft state.
//
// Design-spec §15 row layout: label on the left, value on the right with a
// hairline border between rows. Uses tokens — NO hex literal in this file.

import React, { useState, useCallback } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Text } from '../../ui/primitives/Text';
import { Pressable } from '../../ui/primitives/Pressable';
import { colors, spacing } from '../../ui/tokens';

export interface InlineEditFieldProps {
  /** Label text (also used as the accessibilityLabel base). */
  label: string;
  /** Current value or null. Nullable display renders the placeholder copy. */
  value: string | null;
  /** Placeholder shown when value is null. Defaults to "— Add". */
  placeholder?: string;
  /** RN keyboardType — used for `age` (numeric). */
  keyboardType?: 'default' | 'numeric';
  /**
   * If true, an empty trimmed input on commit calls onSave(null) (clearing the
   * field). If false, an empty input is treated as a cancel — onSave is not
   * called and the row reverts to the original value.
   */
  nullable?: boolean;
  /** Called with the new value (or null) when the user commits the edit. */
  onSave: (next: string | null) => Promise<void>;
}

export function InlineEditField(props: InlineEditFieldProps): React.JSX.Element {
  const {
    label,
    value,
    placeholder = '— Add',
    keyboardType = 'default',
    nullable = false,
    onSave,
  } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);

  const commit = useCallback(async () => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? (nullable ? null : value) : trimmed;
    if (next === value) {
      setEditing(false);
      return;
    }
    try {
      setBusy(true);
      await onSave(next);
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }, [draft, nullable, onSave, value]);

  if (editing) {
    return (
      <View style={styles.row} accessibilityLabel={`field-${label}-editing`}>
        <Text variant="body" style={styles.label}>
          {label}
        </Text>
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          keyboardType={keyboardType}
          editable={!busy}
          style={styles.input}
          accessibilityLabel={`field-${label}-input`}
        />
      </View>
    );
  }

  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      accessibilityLabel={`field-${label}`}
    >
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
      <Text variant="body" tone={value == null ? 'tertiary' : 'primary'} style={styles.value}>
        {value == null ? placeholder : value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.mdl,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: {},
  value: {},
  input: {
    fontSize: 15,
    minWidth: 120,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    color: colors.text,
  },
});

export default InlineEditField;
