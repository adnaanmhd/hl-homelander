/**
 * @doc SignupScreen — Phase 2 plan 02-09 implementation of design-spec §2.
 *
 * Layout (top→bottom): logo + tagline + 3-line pitch (top block); Continue-
 * with-Google CTA + consent row + Terms-of-Use link (bottom block). Tapping
 * the CTA with consent UNchecked fires an Alert; with consent checked, runs
 * the Phase 1 signInWithGoogle() handshake, persists the JWT + consent stamp,
 * and replaces the navigator with 'Permissions'.
 *
 * AUTH-01..05 + AUTH-08 (logout helper exported from auth.ts is consumed by
 * plan 02-18). Wraps Phase 1 signInWithGoogle without modifying it.
 *
 * Logo: at MVP we use the wordmark stub ("Humyn Labs" Text node) to keep the
 * accessibilityLabel "Humyn Labs logo" stable for tests + a11y. The real
 * brand SVG lands in plan 02-15 (TopBar already does the same — design hands
 * the SVG late). The 02-21 manual-smoke runbook re-checks the rendered logo
 * against the design-spec §2 reference shot.
 *
 * Consent versioning: the canonical consent text is exported by
 * TermsOfUseModal as TERMS_OF_USE_TEXT. Phase 1 plan 01-11 ships the
 * authoritative SHA-256 (server-side LEGAL-02). Client-side we compute a
 * lightweight FNV-1a hash for a stable per-text identifier in the local
 * MMKV consent record. Server cross-checks via D-LEGAL-03 — drift is
 * flagged in the audit log (server canonical hash is the legal source of
 * truth; client hash is bookkeeping).
 */
import React, { useCallback, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18nDefault from '../../i18n';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ORANGE_LOGO = require('../../assets/logos/orange_logo.png');
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { colors, spacing } from '../../ui/tokens';
import { signInWithGoogle } from '../../services/auth';
import { useAppStore } from '../../state/appStore';
import { coalesceDisplayName } from '../../lib/userDisplayName';
import { logEvent } from '../../util/analytics';
import { TermsOfUseModal, TERMS_OF_USE_TEXT } from './TermsOfUseModal';

interface NavigationLike {
  replace(route: string): void;
}

/**
 * FNV-1a 32-bit hash of TERMS_OF_USE_TEXT — Phase 2 client-side bookkeeping
 * stamp. The server-side canonical SHA-256 (Phase 1 D-LEGAL-03) is the
 * authoritative legal hash; this stamp is for local audit-trail only.
 */
function consentVersionFromText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

const CONSENT_VERSION = consentVersionFromText(TERMS_OF_USE_TEXT);

export default function SignupScreen() {
  const navigation = useNavigation<NavigationLike>();
  const setJwt = useAppStore((s) => s.setJwt);
  const setConsent = useAppStore((s) => s.setConsent);
  const setUser = useAppStore((s) => s.setUser);
  const { t } = useTranslation();
  const isEnglish = i18nDefault.language === 'en';

  const [consent, setConsentChecked] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    if (!consent) {
      Alert.alert(t('signup.consentRequiredAlert'));
      return;
    }
    setLoading(true);
    setError(null);
    logEvent('signup_google_started');
    try {
      const result = await signInWithGoogle();
      setJwt(result.jwt);
      setUser({
        id: result.user.id,
        email: result.user.email,
        name: coalesceDisplayName(result.user.name, result.user.email),
        avatarUrl: result.user.avatarUrl,
      });
      setConsent({
        acceptedAt: new Date().toISOString(),
        consentVersion: CONSENT_VERSION,
      });
      logEvent('signup_google_completed');
      navigation.replace('Permissions');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error';
      setError(reason);
      logEvent('signup_google_failed', { reason });
    } finally {
      setLoading(false);
    }
  }, [consent, navigation, setConsent, setJwt, setUser, t]);

  const toggleConsent = useCallback(() => {
    setConsentChecked((prev) => {
      const next = !prev;
      // Analytics — the value reflects the NEW state (post-toggle).
      logEvent('signup_consent_checked', { value: next ? 'true' : 'false' });
      return next;
    });
  }, []);

  const openTerms = useCallback(() => {
    setTermsOpen(true);
    logEvent('signup_terms_opened');
  }, []);

  const closeTerms = useCallback(() => {
    setTermsOpen(false);
  }, []);

  return (
    <ScreenContainer accessibilityLabel="Signup screen" style={styles.container}>
      <View style={styles.top}>
        <View accessibilityLabel="Humyn Labs logo" style={styles.logoWell}>
          {/* Plan 03-11 (A6) — explicit shrunk 256×58 dp dimensions per
              Pixel 10a re-walk amendment. Sign-up logo no longer dominates
              the top of the screen; aspect preserved (256/58 ≈ 4.41:1 vs
              source 320/73 ≈ 4.38:1, within ±1%). */}
          <Image
            source={ORANGE_LOGO}
            accessibilityLabel="Humyn Labs Capture wordmark"
            accessibilityIgnoresInvertColors
            style={{ width: 256, height: 58, resizeMode: 'contain' }}
          />
        </View>
        <Text
          variant="caption"
          tone="secondary"
          style={styles.tagline}
          accessibilityLabel="signup tagline"
        >
          {t('signup.tagline')}
        </Text>
        <View style={{ height: spacing.hh }} />
        {/* Plan 03-02 — three value-prop lines render as ONE cohesive block,
            not three independent paragraphs. `gap: spacing.xs` (4 px between
            siblings) plus the variant's own line-height (32 px) gives the
            trio the right amount of breathing without losing the unity. The
            previous `marginVertical: spacing.xs` on each line doubled the
            inter-line gap (4 px top + 4 px bottom + 32 px line-height) so
            the trio read as separate paragraphs (02-COSMETIC-GAPS.md
            "Reduce vertical spacing between the three value-prop lines"). */}
        <View style={styles.valueProps}>
          <Text variant="pitch" tone="primary" style={styles.pitchLine}>
            {t('signup.pitchLine1')}
          </Text>
          <Text variant="pitch" tone="primary" style={styles.pitchLine}>
            {t('signup.pitchLine2')}
          </Text>
          <Text variant="pitch" style={[styles.pitchLine, { color: colors.accent }]}>
            {t('signup.pitchLine3')}
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        {/* Plan 03-02 — CTA stacks immediately under the centered content
            block; alignSelf:'center' + paddingHorizontal makes the
            button content-driven width (~280-300 dp) instead of full
            bleed (02-COSMETIC-GAPS.md "CTA position: immediately below
            content, NOT pinned to the bottom" + "CTA width: adaptive,
            NOT full-width"). */}
        <View style={styles.ctaWrap}>
          <Button
            variant="primary"
            label={loading ? t('common.signingIn') : t('signup.ctaSignIn')}
            accessibilityLabel="Continue with Google"
            onPress={handleSignIn}
            disabled={loading}
          />
        </View>

        <View style={styles.consentRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Accept Terms of Use checkbox"
            accessibilityState={{ checked: consent }}
            onPress={toggleConsent}
            style={[styles.checkbox, consent ? styles.checkboxChecked : null]}
          >
            {consent ? (
              <Text
                variant="caption"
                accessibilityLabel="checkbox checked indicator"
                style={styles.checkboxGlyph}
                // data-testid sentinel for tests — the host-component shim
                // forwards unknown props onto the DOM, which lets the test
                // assert against `[data-testid="checkbox-checked-indicator"]`.
                {...{ 'data-testid': 'checkbox-checked-indicator' }}
              >
                {'✓'}
              </Text>
            ) : null}
          </Pressable>
          {/* Plan 07-14 (COSMETIC-01) — consent paragraph + Terms-link line
              center-aligned. `textAlign: 'center'` on each Text node centers
              the wrapped lines (the inline <Text> for the Terms link inherits
              from its parent so the link sits in the centered run). The
              container drops `flex: 1` so the centering computes against the
              text's natural width inside the row (with the checkbox to its
              left). The bilingual D-32 underlay block (non-en locales) keeps
              the same centering across both the translated text on top AND
              the English underlay below — verified visually in pt-BR + hi-IN
              during plan 07-15 §3 re-walk. */}
          <View style={{ marginLeft: spacing.m, flexShrink: 1 }}>
            <Text
              variant="caption"
              tone="primary"
              accessibilityLabel="Consent label"
              style={{ textAlign: 'center' }}
            >
              {t('signup.consentLabelPrefix')}
              <Text
                variant="caption"
                accessibilityRole="link"
                accessibilityLabel="Terms of Use link"
                onPress={openTerms}
                style={{ color: colors.accent, textDecorationLine: 'underline' }}
              >
                {t('signup.consentLink')}
              </Text>
            </Text>
            {!isEnglish ? (
              <Text
                variant="caption"
                tone="secondary"
                accessibilityLabel="Consent label English underlay"
                style={{ opacity: 0.7, marginTop: spacing.xs, textAlign: 'center' }}
              >
                {i18nDefault.getFixedT('en')('signup.consentLabelPrefix')}
                <Text
                  variant="caption"
                  style={{ opacity: 0.7 }}
                  accessibilityLabel="Terms of Use link English underlay"
                >
                  {i18nDefault.getFixedT('en')('signup.consentLink')}
                </Text>
              </Text>
            ) : null}
          </View>
        </View>

        {error ? (
          <Text
            variant="caption"
            accessibilityLabel="signup error"
            style={{ color: colors.coral, marginTop: spacing.m }}
          >
            {error}
          </Text>
        ) : null}
      </View>

      <TermsOfUseModal visible={termsOpen} onClose={closeTerms} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Plan 03-02 — drop the `space-between` body layout. The screen now
  // renders ONE vertically-centered group: logo + tagline + value-props
  // (top) directly above CTA + consent + error (bottom). No flex spacer
  // pushes the CTA to the bottom of the screen (02-COSMETIC-GAPS.md
  // "CTA position: immediately below content, NOT pinned to the
  // bottom"). The container uses `justifyContent: 'center'` so the
  // whole group sits as one centered group.
  container: {
    paddingTop: 60,
    paddingHorizontal: 28,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  top: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logoWell: {
    alignItems: 'center',
  },
  tagline: {
    textAlign: 'center',
  },
  // Plan 03-02 — drop the per-line marginVertical; the parent
  // `valueProps` container's `gap: spacing.xs` provides the inter-line
  // spacing (4 px between siblings, no double-stacking).
  pitchLine: {
    textAlign: 'center',
  },
  valueProps: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  bottom: {
    paddingTop: spacing.xl,
    gap: spacing.l,
  },
  // Plan 03-02 — CTA wrapper centers the button at content-driven width.
  // alignSelf:'center' bounds the wrapper to its child's natural size;
  // the Button primitive picks up its own paddingHorizontal so the final
  // visual width is ~280-300 dp on a Pixel-class device (Google logo +
  // label + horizontal padding) instead of the previous full-bleed.
  ctaWrap: {
    alignSelf: 'center',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxGlyph: {
    color: colors.surface,
    fontSize: 13,
    lineHeight: 14,
    fontWeight: '700' as const,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
