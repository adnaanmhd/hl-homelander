// TranslatedHeaderTitle — Plan 07-16 Task 4c G-23 closure.
//
// Tiny wrapper for React Navigation `options.headerTitle` that re-renders on
// `i18n.changeLanguage` (the function-form `title` / `options` approach does
// NOT re-invoke on a global state change — RN re-runs it only when its
// screen-prop deps change. See checker WARNING 7).
//
// Usage:
//   <Stack.Screen
//     name="HelpCenter"
//     component={HelpCenterScreen}
//     options={{
//       headerShown: true,
//       headerTitle: () => <TranslatedHeaderTitle i18nKey="helpCenter.title" />,
//     }}
//   />
//
// The header glyph (back arrow, etc.) stays controlled by the navigator's
// default chrome; only the TITLE renders through this component. The Text
// variant defaults to `body` + semibold; the consumer can pass `variant` to
// override (e.g. when the screen needs a custom title weight).
import React from 'react';
import { useTranslation } from 'react-i18next';
import Text from '../ui/primitives/Text';
import type { TextProps } from '../ui/primitives/Text';

export interface TranslatedHeaderTitleProps {
  /** i18n key for the title. */
  i18nKey: string;
  /** Text variant override (defaults to 'body'). */
  variant?: TextProps['variant'];
}

export function TranslatedHeaderTitle({
  i18nKey,
  variant = 'body',
}: TranslatedHeaderTitleProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Text variant={variant} accessibilityLabel={`header-title-${i18nKey}`}>
      {t(i18nKey)}
    </Text>
  );
}

export default TranslatedHeaderTitle;
