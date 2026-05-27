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
 *
 * Quick task 260527-hkl — the modal is now an auto-opening, non-dismissable,
 * scroll-gated consent gate. Props were `{ visible, onClose }`; now they're
 * `{ visible, onAgree }`. The ONLY exit is the Agree button, which is
 * disabled until the inner ScrollView reports the bottom is reached.
 * A sticky banner sits above the scrollable body; an inline Privacy Policy
 * hyperlink (Linking.openURL → system browser) is rendered inside the body.
 * A BackHandler listener returns true while the modal is visible (Android
 * hardware back is blocked — defense in depth alongside the no-op onDismiss
 * passed to the Modal primitive's RNModal.onRequestClose).
 *
 * The LOCKED §5.2 byte-sequence (TERMS_OF_USE_TEXT) is unchanged — only
 * the UX wrapper around it gets stricter. Bilingual D-32 underlay (the
 * grey English text under the translated copy on non-en locales) stays;
 * the new sticky banner inherits the same treatment.
 */
import React, { useEffect, useState } from 'react';
import { BackHandler, Linking, ScrollView, View } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18nDefault from '../../i18n';
import { Modal } from '../../ui/primitives/Modal';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { colors, spacing } from '../../ui/tokens';

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
  /**
   * The ONLY exit. Called after the user scrolls to the bottom AND taps Agree.
   * Optional in TS to allow a clean per-task atomic commit during quick task
   * 260527-hkl: Task 1 (modal rewrite) lands before Task 2 (SignupScreen
   * rewires to onAgree), and the project-wide tsc that Task 1's verify runs
   * would otherwise reject the legacy SignupScreen call site. After Task 2
   * lands, every caller passes `onAgree`; the optionality can be tightened
   * back to `onAgree(): void` in a follow-up if desired, but the runtime
   * contract is unchanged (taps after the scroll gate STILL flow through).
   */
  onAgree?: () => void;
  /**
   * Legacy backward-compat shim — the pre-quick-260527-hkl modal exposed an
   * `onClose` prop that closed the modal on "Got it". The modal is now
   * non-dismissable; the only exit is `onAgree`. This prop is accepted but
   * ignored so the per-task atomic commit landing in this quick task keeps
   * typecheck green between Task 1 (modal rewrite) and Task 2 (SignupScreen
   * rewires to onAgree). Drop once Task 2 lands and SignupScreen no longer
   * passes onClose.
   */
  onClose?: () => void;
}

const PRIVACY_POLICY_URL = 'https://humynlabs.ai/privacy-policy';

// The 4-px slop matches the existing engineering-handoff §… scroll-bottom
// heuristic and survives sub-pixel measurement noise on Android Pixel-class
// devices (the OEM Compose snapshot rounds layoutMeasurement.height to one dp).
const BOTTOM_SLOP_PX = 4;

export function TermsOfUseModal({ visible, onAgree }: TermsOfUseModalProps) {
  const { t } = useTranslation();
  const isEnglish = i18nDefault.language === 'en';
  const translatedBody = t('terms.consent.body');
  const englishUnderlay = i18nDefault.getFixedT('en')('terms.consent.body');
  const translatedBanner = t('signup.consent.scrollBanner');
  const englishBanner = i18nDefault.getFixedT('en')('signup.consent.scrollBanner');

  // Sticky enable: once the user reaches the bottom, the Agree button stays
  // enabled even if they scroll back up.
  const [agreeEnabled, setAgreeEnabled] = useState(false);

  // BackHandler — defense in depth alongside the no-op onDismiss passed to
  // the Modal primitive (RNModal.onRequestClose is fired by Android hardware
  // back; we also intercept any parent BackHandler chain). Mirrors the
  // pattern in apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // On the real RN bridge `e.nativeEvent` is the ScrollEvent payload. Under
    // the jsdom host-component shim there is no SyntheticEvent wrapper; the
    // EventInit fields land directly on the DOM Event. Coalesce both shapes.
    const evt = e as unknown as Record<string, unknown>;
    const native = (evt.nativeEvent as Record<string, unknown>) ?? evt;
    const contentOffset = native.contentOffset as { y?: number } | undefined;
    const layoutMeasurement = native.layoutMeasurement as { height?: number } | undefined;
    const contentSize = native.contentSize as { height?: number } | undefined;
    if (!contentOffset || !layoutMeasurement || !contentSize) return;
    const y = contentOffset.y ?? 0;
    const h = layoutMeasurement.height ?? 0;
    const total = contentSize.height ?? 0;
    if (y + h >= total - BOTTOM_SLOP_PX) {
      setAgreeEnabled(true);
    }
  };

  return (
    <Modal
      visible={visible}
      title={t('terms.consent.modalTitle')}
      // No-op — non-dismissable. The only exit is the Agree button below.
      onDismiss={() => undefined}
      accessibilityLabel="Terms of Use modal"
      actions={
        <Button
          variant="primary"
          label={t('signup.consent.agreeButton')}
          accessibilityLabel="consent-agree-button"
          onPress={() => onAgree?.()}
          disabled={!agreeEnabled}
          style={!agreeEnabled ? { opacity: 0.4 } : undefined}
        />
      }
    >
      {/* Sticky banner — sits ABOVE the scrollable body and does NOT scroll
          with content. Localized copy on top + D-32 English underlay on
          non-en locales (mirrors the consent-body bilingual treatment). */}
      <View accessibilityLabel="consent-scroll-banner" style={{ marginBottom: spacing.m }}>
        <Text variant="caption" tone="primary">
          {translatedBanner}
        </Text>
        {!isEnglish ? (
          <Text
            variant="caption"
            tone="secondary"
            accessibilityLabel="consent-scroll-banner-english-underlay"
            style={{ opacity: 0.7, marginTop: spacing.xs }}
          >
            {englishBanner}
          </Text>
        ) : null}
      </View>

      <ScrollView
        accessibilityLabel="consent-scroll-body"
        style={{ maxHeight: 400 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
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
        {/* Privacy Policy — inline hyperlink, opens in the system browser via
            Linking.openURL (no new dep; the existing pattern from
            HelpCenterScreen / CompatFailScreen / RigTutorialScreen). */}
        <Text
          variant="caption"
          accessibilityRole="link"
          accessibilityLabel="privacy-policy-link"
          onPress={() => {
            void Linking.openURL(PRIVACY_POLICY_URL);
          }}
          style={{ color: colors.accent, textDecorationLine: 'underline' }}
        >
          {t('signup.consent.privacyPolicyLink')}
        </Text>
      </ScrollView>
    </Modal>
  );
}

export default TermsOfUseModal;
