/**
 * Terms-of-Use modal — design-spec §18.1 + idea-brief §5.2.
 *
 * The body text is the canonical consent copy; treat this constant as
 * IMMUTABLE without a coordinated update to (a) idea-brief.md §5.2,
 * (b) design-spec.md §18.1, and (c) the backend's canonical SHA-256
 * (Phase 1 D-LEGAL-02 / D-LEGAL-03 stamps a hash of the SAME byte
 * sequence into every consent_log row at sign-in time). Drift between
 * client text and the server-computed hash is a P0 audit-trail bug.
 *
 * The plan-checker will fail if any of the verbatim sentinel substrings
 * (e.g. "no one being recorded is a minor") drift; the plan 02-21 manual
 * smoke runbook re-verifies against idea-brief.md.
 */
import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nDefault from '../../i18n';
import { Modal } from '../../ui/primitives/Modal';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { spacing } from '../../ui/tokens';

/**
 * CANONICAL — sourced verbatim from idea-brief.md §5.2 / design-spec.md §18.1.
 * DO NOT EDIT without updating idea-brief.md first AND bumping the consent
 * version on the backend (LEGAL-02 / Phase 1 plan 01-11).
 */
// prettier-ignore
export const TERMS_OF_USE_TEXT =
  'I consent and agree to upload videos of myself and/or others who consent to be recorded; ' +
  'performing certain daily activities/tasks. This content will be used to develop / train AI ' +
  'models and for research purposes. I confirm that I am 18 years or older and have the ' +
  'necessary permissions to share this content. I confirm that no one being recorded is a minor. ' +
  'I consent to my approximate location and IP address being captured alongside each recording. ' +
  "I understand that my data will be stored securely and used in accordance with Humyn's Privacy Policy.";

export interface TermsOfUseModalProps {
  visible: boolean;
  onClose(): void;
}

export function TermsOfUseModal({ visible, onClose }: TermsOfUseModalProps) {
  const { t } = useTranslation();
  const isEnglish = i18nDefault.language === 'en';
  const translatedBody = t('terms.consent.body');
  const englishUnderlay = i18nDefault.getFixedT('en')('terms.consent.body');
  return (
    <Modal
      visible={visible}
      title={t('terms.consent.modalTitle')}
      onDismiss={onClose}
      accessibilityLabel="Terms of Use modal"
      actions={
        <Button
          variant="primary"
          label={t('common.gotIt')}
          accessibilityLabel="Got it close terms"
          onPress={onClose}
        />
      }
    >
      <ScrollView style={{ maxHeight: 400 }}>
        <Text
          variant="body"
          tone="primary"
          accessibilityLabel="Terms of Use body"
          style={{ marginBottom: spacing.l }}
        >
          {translatedBody}
        </Text>
        {!isEnglish ? (
          <Text
            variant="caption"
            tone="secondary"
            accessibilityLabel="Terms of Use English underlay"
            style={{ opacity: 0.7, marginBottom: spacing.l }}
          >
            {englishUnderlay}
          </Text>
        ) : null}
      </ScrollView>
    </Modal>
  );
}

export default TermsOfUseModal;
