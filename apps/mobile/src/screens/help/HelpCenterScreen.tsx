/**
 * HelpCenterScreen — design-spec §17 Help Center.
 *
 * Layout:
 *   - 3 stacked AccordionItems in HELP-01 order: Instructions Guide / FAQs /
 *     Troubleshooting. All start collapsed.
 *   - Below the third accordion: a Contact Support headline + two CTAs —
 *     "Contact Support" (mailto:support@humynlabs.ai) and "Report a problem"
 *     (opens the ReportProblemSheet).
 *
 * Reachability (HELP-04): this screen is registered as a sibling of MainTabs
 * in RootNativeStack and is reached only via the Profile row's
 * `navigation.navigate('HelpCenter')` call (plan 02-17). No bottom-tab entry,
 * no settings menu — intentional surface minimisation.
 *
 * Content source (D-HELP-01): the imported `./content.json` is baked from
 * `help-center-content.md` at build time (apps/mobile/scripts/build-help-content.mjs).
 * Editing the markdown re-runs the script via `npm run prebuild`.
 *
 * Plan 03-02 — OQ-1 resolved: SUPPORT_EMAIL is `support@humynlabs.ai`
 * (02-COSMETIC-GAPS.md "Rig Tutorial screen" + 02-OPEN-QUESTIONS.md OQ-1
 * resolution). The 5th and final placeholder occurrence landed inside
 * Plan 03-03's merged CompatFailScreen (the standalone CompatRecoveryScreen
 * was merged into CompatFailScreen and deleted in the same plan).
 *
 * NO hex literals — every spacing/color token comes from `../../ui/tokens`.
 */
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { spacing } from '../../ui/tokens';
import { AccordionItem } from '../../components/AccordionItem';
import { ReportProblemSheet } from '../../components/ReportProblemSheet';
import { Markdown } from './markdown';
import { loadHelpContent } from './contentLoader';

// Plan 03-02 — OQ-1 resolved: support email is `support@humynlabs.ai`
// (02-OPEN-QUESTIONS.md OQ-1 resolution path). Constant name kept for
// stable diff history; the value is no longer a placeholder.
const SUPPORT_EMAIL_PLACEHOLDER = 'support@humynlabs.ai';

type AccordionItemPayload =
  | { kind: 'subsection'; heading: string; body: string }
  | { kind: 'qa'; question: string; answer: string }
  | { kind: 'issue'; heading: string; resolution: string };

type AccordionContent = {
  id: string;
  title: string;
  items: AccordionItemPayload[];
};

export function HelpCenterScreen(): React.JSX.Element {
  const [reportOpen, setReportOpen] = useState(false);
  const { t, i18n } = useTranslation();
  // plan 07-13 (G-10): per-locale Help Center body. Falls back to en for
  // unknown locales or when a sibling content.{loc}.json is still a stub
  // (accordions: []).
  const content = loadHelpContent(i18n.language);
  const ACCORDIONS: AccordionContent[] = (content as { accordions: AccordionContent[] }).accordions;

  return (
    <ScreenContainer accessibilityLabel="help-center-screen" padding={0}>
      <ScrollView contentContainerStyle={styles.body}>
        {ACCORDIONS.map((acc) => (
          <AccordionItem key={acc.id} title={acc.title} testID={`accordion-${acc.id}`}>
            {renderAccordion(acc)}
          </AccordionItem>
        ))}

        <Text variant="body" tone="secondary" style={styles.contactHeadline}>
          {content.contactSupport.headline}
        </Text>

        <View style={styles.ctaWrap}>
          <Button
            variant="primary"
            accessibilityLabel="help-contact-support-mailto"
            label={t('help.contactSupport')}
            onPress={() =>
              Linking.openURL(
                `mailto:${SUPPORT_EMAIL_PLACEHOLDER}?subject=${encodeURIComponent(
                  'Help — Humyn Labs Capture',
                )}`,
              )
            }
          />
        </View>

        <View style={styles.ctaWrap}>
          <Button
            variant="outline"
            accessibilityLabel="help-report-problem"
            label={t('help.reportProblem')}
            onPress={() => setReportOpen(true)}
          />
        </View>
      </ScrollView>

      {reportOpen ? <ReportProblemSheet onClose={() => setReportOpen(false)} /> : null}
    </ScreenContainer>
  );
}

function renderAccordion(acc: AccordionContent): React.ReactNode {
  return acc.items.map((it: AccordionItemPayload, idx: number) => {
    if (it.kind === 'subsection') {
      return (
        <View key={idx} style={styles.subsection}>
          <Text variant="body" style={styles.subsectionHeading}>
            {it.heading}
          </Text>
          <View style={styles.subsectionBody}>
            <Markdown source={it.body} />
          </View>
        </View>
      );
    }
    if (it.kind === 'qa') {
      return (
        <View key={idx} style={styles.qa}>
          <Text variant="body" style={styles.qaQuestion}>
            {it.question}
          </Text>
          <View style={styles.qaAnswer}>
            <Markdown source={it.answer} />
          </View>
        </View>
      );
    }
    // troubleshooting issue
    return (
      <View key={idx} style={styles.qa}>
        <Text variant="body" style={styles.qaQuestion}>
          {it.heading}
        </Text>
        <View style={styles.qaAnswer}>
          <Markdown source={it.resolution} />
        </View>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, paddingBottom: 60 },
  subsection: { marginBottom: spacing.mdl },
  subsectionHeading: { marginBottom: spacing.xs },
  subsectionBody: {},
  qa: { marginBottom: spacing.ll },
  qaQuestion: { marginBottom: spacing.s },
  qaAnswer: {},
  contactHeadline: { marginTop: spacing.xxxl, textAlign: 'center' },
  ctaWrap: { marginTop: spacing.md, alignSelf: 'center', maxWidth: 280, width: '100%' },
});

// Default export preserved for the existing `import HelpCenterScreen from
// '../screens/help/HelpCenterScreen'` in RootNativeStack.tsx (plan 02-05's
// HelpCenter sibling registration). Removing the default would force a
// RootNativeStack edit that plan 02-19 also touches; keeping both shapes
// avoids the merge.
export default HelpCenterScreen;
