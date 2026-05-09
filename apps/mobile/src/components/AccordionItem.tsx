/**
 * AccordionItem — design-spec §17 Help Center accordion row.
 *
 * Shape: a header row (title + chevron) over a collapsible body. The header
 * is a Pressable; tapping it toggles the body. Chevron flips
 * ChevronDown → ChevronUp on expand. A 1 px bottom line separates rows.
 *
 * Accessibility:
 *   - The whole row is labelled `accordion-{title}` (or the explicit testID
 *     prop) so screen readers announce the section.
 *   - The toggle Pressable carries `accessibilityRole="button"` plus
 *     `accessibilityState={{ expanded }}`, which is the WAI-ARIA contract
 *     for a disclosure button.
 *   - The body, when rendered, is queryable as `accordion-body-{title}` so
 *     tests can assert open/closed state by label rather than poking the
 *     internal React state.
 *
 * NO hex literals — every color/spacing comes from `../ui/tokens`.
 */
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Text } from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing } from '../ui/tokens';

export interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /**
   * Optional override for the row-level accessibility label. Defaults to
   * `accordion-{title}`. Tests use this to disambiguate when multiple rows
   * share a title (rare; today only design-spec §17 numbered accordions).
   */
  testID?: string;
}

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
  testID,
}: AccordionItemProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <View style={styles.row} accessibilityLabel={testID ?? `accordion-${title}`}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityLabel={`accordion-toggle-${title}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text variant="btnLabel" style={styles.title}>
          {title}
        </Text>
        {open ? (
          <ChevronUp size={18} color={colors.text2} />
        ) : (
          <ChevronDown size={18} color={colors.text2} />
        )}
      </Pressable>
      {open ? (
        <View style={styles.body} accessibilityLabel={`accordion-body-${title}`}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: colors.line },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.ll,
  },
  title: {},
  body: { paddingBottom: spacing.ll },
});

export default AccordionItem;
