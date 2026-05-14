// SearchInput — Phase 6 Plan 06-07 Task 1 (TASK-03 / 06-UI-SPEC §10).
//
// Always-visible debounced text input above the Tasks grid. Two independent
// debouncers run in parallel:
//   - `onChangeDebounced` fires 200ms after the last keystroke (TASK-03 —
//     drives the server-side `/tasks/search` query).
//   - `onAnalyticsDebounced` fires 400ms after the last keystroke (UI-SPEC
//     §Motion analytics throttle — drives the `tasks_search` Firebase event
//     with `query_length` only, NEVER the query string per T-6.7-04).
//
// Visuals per design-spec §10:
//   - 14px radius, 12/14 padding, 44px left padding for the leading Search
//     icon, 1px `line` border. Focus ring: 1.5px `accent` border.
//   - Leading icon: lucide `Search` 18px in `text2`.
//   - Trailing X-clear: lucide `X` 18px in `text2`, only when value !== ''.
//   - Placeholder text: `text3`.
//
// NO hex literals — every value bound to `../ui/tokens` (D-UI-01 gate).
import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing, radii, typography } from '../ui/tokens';

export interface SearchInputProps {
  /** Controlled input value. */
  value: string;
  /** Synchronous change handler — fired on every keystroke. */
  onChangeText: (next: string) => void;
  /** Placeholder text shown when value is empty. */
  placeholder?: string;
  /** Debounce window for `onChangeDebounced` (defaults to 200ms — TASK-03). */
  debounceMs?: number;
  /**
   * Debounced search callback — fires `debounceMs` after the last keystroke
   * with the latest value. Powers the lexical-search hook.
   */
  onChangeDebounced?: (next: string) => void;
  /** Debounce window for `onAnalyticsDebounced` (defaults to 400ms — UI-SPEC). */
  analyticsDebounceMs?: number;
  /**
   * Debounced analytics callback — fires `analyticsDebounceMs` after the last
   * keystroke. The TasksScreen wires this to a `tasks_search` event that logs
   * `{ query_length: q.length }` ONLY (never the query string — T-6.7-04 PII).
   */
  onAnalyticsDebounced?: (next: string) => void;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search tasks…',
  debounceMs = 200,
  onChangeDebounced,
  analyticsDebounceMs = 400,
  onAnalyticsDebounced,
}: SearchInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);

  // Two independent debounce timers — search (200ms) races ahead, analytics
  // (400ms) catches up. Both clear on every keystroke.
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyticsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (onChangeDebounced) {
      if (searchTimerRef.current != null) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        onChangeDebounced(value);
      }, debounceMs);
    }
    if (onAnalyticsDebounced) {
      if (analyticsTimerRef.current != null) clearTimeout(analyticsTimerRef.current);
      analyticsTimerRef.current = setTimeout(() => {
        onAnalyticsDebounced(value);
      }, analyticsDebounceMs);
    }
    return () => {
      if (searchTimerRef.current != null) clearTimeout(searchTimerRef.current);
      if (analyticsTimerRef.current != null) clearTimeout(analyticsTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clear = (): void => {
    onChangeText('');
  };

  return (
    <View
      accessibilityLabel="search-input-wrap"
      style={focused ? styles.wrapFocused : styles.wrap}
    >
      <View style={styles.leadingIcon} pointerEvents="none">
        <Search size={18} strokeWidth={1.75} color={colors.text2} />
      </View>
      <TextInput
        accessibilityLabel="task-search-input"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityLabel="task-search-clear"
          accessibilityRole="button"
          onPress={clear}
          hitSlop={8}
          style={styles.trailingIcon}
        >
          <X size={18} strokeWidth={1.75} color={colors.text2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const BASE_HEIGHT = 44;
const INPUT_FONT = typography.body.fontSize;

const styles = StyleSheet.create({
  wrap: {
    height: BASE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingLeft: 44, // 44px left for the icon (design-spec §10)
    paddingRight: spacing.md,
    paddingVertical: spacing.md, // 12 vertical
  },
  wrapFocused: {
    height: BASE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.accent, // focus ring (design-spec §10)
    backgroundColor: colors.surface,
    paddingLeft: 44,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  leadingIcon: {
    position: 'absolute',
    left: spacing.mdl, // 14px from the left edge
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  trailingIcon: {
    paddingLeft: spacing.m,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: INPUT_FONT,
    padding: 0, // RN TextInput ships with implicit padding on Android — strip it
  },
});

export default SearchInput;
