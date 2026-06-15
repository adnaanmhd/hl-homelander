/**
 * @doc SignupScreen — Phase 2 plan 02-09 implementation of design-spec §2;
 * quick task 260527-hkl — consent UX hardening.
 *
 * Layout (top→bottom): logo + tagline + 3-line pitch (top block); Continue-
 * with-Google CTA + consent row (bottom block).
 *
 * Quick task 260527-hkl (2026-05-27) — consent UX:
 *   - The Terms-of-Use modal AUTO-OPENS the first time SignupScreen mounts
 *     when the local MMKV consent record is missing OR carries a stale
 *     `consentVersion` (FNV-1a hash of TERMS_OF_USE_TEXT). A bump of the
 *     canonical text changes the hash and re-prompts every user.
 *   - The modal is non-dismissable (no X, outside-tap no-op, Android back
 *     blocked); the ONLY exit is the modal's scroll-gated Agree button.
 *   - On Agree the screen persists `{ acceptedAt, consentVersion }` to MMKV
 *     via `setConsent` — NOT on sign-in. The server still stamps consent_log
 *     unconditionally on /auth/google sign-in (Phase 1 LEGAL-02), so no
 *     client payload change is needed.
 *   - The Continue-with-Google CTA is DISABLED until the local consent
 *     record exists AND matches the current CONSENT_VERSION.
 *   - The consent-row checkbox is a READ-ONLY indicator once consent is
 *     persisted; tapping it before consent re-opens the modal. The Terms-of-
 *     Use sub-link is now plain text (no longer pressable) — the modal is
 *     the entry point.
 *
 * AUTH-01..05 + AUTH-08 (logout helper exported from auth.ts is consumed by
 * plan 02-18). Wraps Phase 1 signInWithGoogle without modifying it.
 *
 * Logo: at MVP we use the wordmark image (the brand SVG land late). The
 * accessibilityLabel "Humyn Labs logo" stays stable for tests + a11y.
 *
 * Consent versioning: the canonical consent text is exported by
 * TermsOfUseModal as TERMS_OF_USE_TEXT. Phase 1 plan 01-11 ships the
 * authoritative SHA-256 (server-side LEGAL-02). Client-side we compute a
 * lightweight FNV-1a hash for a stable per-text identifier in the local
 * MMKV consent record. Server cross-checks via D-LEGAL-03 — drift is
 * flagged in the audit log (server canonical hash is the legal source of
 * truth; client hash is bookkeeping).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
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
 * FNV-1a 32-bit hash of TERMS_OF_USE_TEXT — client-side bookkeeping stamp.
 * The server-side canonical SHA-256 (Phase 1 D-LEGAL-03) is the authoritative
 * legal hash; this stamp is for local audit-trail only.
 */
function consentVersionFromText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

// Invariant (Bug 3 / D3 follow-up): client re-consent is driven by THIS FNV hash
// of the client-rendered TERMS_OF_USE_TEXT, which is INDEPENDENT of the server's
// semver CONSENT_VERSION (apps/api/.../legal/consent-text.ts). To force a global
// re-consent you MUST change the client-rendered text (so this hash changes) —
// bumping only the server semver will NOT re-prompt the client.
const CONSENT_VERSION = consentVersionFromText(TERMS_OF_USE_TEXT);

export default function SignupScreen() {
  const navigation = useNavigation<NavigationLike>();
  const setJwt = useAppStore((s) => s.setJwt);
  const setConsent = useAppStore((s) => s.setConsent);
  const setUser = useAppStore((s) => s.setUser);
  const consentRecord = useAppStore((s) => s.consent);
  const clearDeviceEvicted = useAppStore((s) => s.clearDeviceEvicted);
  const { t } = useTranslation();
  const isEnglish = i18nDefault.language === 'en';

  // Derived: is consent persisted at the CURRENT canonical text version?
  const consentPersisted =
    consentRecord !== null && consentRecord.consentVersion === CONSENT_VERSION;

  // Modal visibility — initialized on mount from the consent slice; later
  // store updates do NOT re-open the modal automatically (the Agree handler
  // closes it explicitly, and the checkbox re-opens it on user gesture
  // before consent is persisted).
  const [termsOpen, setTermsOpen] = useState(false);
  // Mount-only: read consentPersisted ONCE on mount; later store updates do
  // NOT re-open the modal automatically. `useEffect(..., [])` is intentional
  // here — quick-260527-hkl plan Task 2 calls this out explicitly. Reading
  // `useAppStore.getState()` inside the effect avoids the linter dep-cycle
  // entirely (no `consentPersisted` reference inside the closure).
  useEffect(() => {
    const initial = useAppStore.getState().consent;
    const persistedAtMount = initial !== null && initial.consentVersion === CONSENT_VERSION;
    if (!persistedAtMount) setTermsOpen(true);
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bug 4 / D2 — if this device was evicted (a newer sign-in on another device
  // took over the account), the api.ts 401 handler flips the store flag and
  // resets navigation here. Read it ONCE on mount, surface the notice, and
  // clear the flag so it doesn't re-show on a later Signup visit.
  const [evictedNotice, setEvictedNotice] = useState<'evicted' | 'reauth' | null>(null);
  useEffect(() => {
    const s = useAppStore.getState();
    if (s.deviceEvicted) {
      setEvictedNotice(s.deviceEvictedReason ?? 'evicted');
      clearDeviceEvicted();
      logEvent('signup_device_evicted_notice');
    }
  }, [clearDeviceEvicted]);

  const handleSignIn = useCallback(async () => {
    // Defense in depth — the CTA's `disabled` prop is the primary gate, but
    // if a stale Pressable click slips through (race during state flush)
    // we still short-circuit to avoid signing in without consent.
    if (!consentPersisted) return;
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
      // Consent is persisted by the modal's Agree handler (NOT here). The
      // server still stamps consent_log on /auth/google unconditionally.
      logEvent('signup_google_completed');
      navigation.replace('Permissions');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error';
      setError(reason);
      logEvent('signup_google_failed', { reason });
    } finally {
      setLoading(false);
    }
  }, [consentPersisted, navigation, setJwt, setUser]);

  const handleAgree = useCallback(() => {
    setConsent({
      acceptedAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    });
    setTermsOpen(false);
    logEvent('consent_agreed', { consent_version: CONSENT_VERSION });
  }, [setConsent]);

  // Checkbox press: BEFORE consent re-opens the modal; AFTER consent the
  // checkbox is a read-only "✓" indicator — tap is a no-op.
  const handleCheckboxPress = useCallback(() => {
    if (!consentPersisted) {
      setTermsOpen(true);
      logEvent('signup_terms_opened');
    }
  }, [consentPersisted]);

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
        {/* Plan 03-02 — three value-prop lines render as ONE cohesive block. */}
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
        {evictedNotice ? (
          <Text
            variant="caption"
            accessibilityLabel="device-evicted notice"
            style={{ color: colors.coral, textAlign: 'center', marginBottom: spacing.m }}
          >
            {t(evictedNotice === 'reauth' ? 'signup.reauthRequired' : 'signup.deviceEvicted')}
          </Text>
        ) : null}
        {/* Plan 03-02 — CTA stacks immediately under the centered content
            block; alignSelf:'center' + paddingHorizontal makes the
            button content-driven width (~280-300 dp). Quick 260527-hkl —
            CTA is disabled until the local consent record matches the
            current CONSENT_VERSION. */}
        <View style={styles.ctaWrap}>
          <Button
            variant="primary"
            label={loading ? t('common.signingIn') : t('signup.ctaSignIn')}
            accessibilityLabel="Continue with Google"
            onPress={handleSignIn}
            disabled={loading || !consentPersisted}
          />
        </View>

        <View style={styles.consentRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Accept Terms of Use checkbox"
            accessibilityState={{ checked: consentPersisted, disabled: consentPersisted }}
            onPress={handleCheckboxPress}
            style={[styles.checkbox, consentPersisted ? styles.checkboxChecked : null]}
          >
            {consentPersisted ? (
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
          {/* Plan 07-14 (COSMETIC-01) — consent paragraph + (formerly Terms-
              link) line center-aligned. Quick 260527-hkl — the Terms-of-Use
              sub-link is no longer pressable (modal auto-opens; the link
              path is dead). Render it as plain text so the design + bilingual
              underlay are preserved. The bilingual D-32 underlay block
              (non-en locales) keeps the same centering across both the
              translated text on top AND the English underlay below. */}
          <View style={{ marginLeft: spacing.m, flexShrink: 1 }}>
            <Text
              variant="caption"
              tone="primary"
              accessibilityLabel="Consent label"
              style={{ textAlign: 'center' }}
            >
              {t('signup.consentLabelPrefix')}
              <Text variant="caption" accessibilityLabel="Terms of Use text">
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
                  accessibilityLabel="Terms of Use text English underlay"
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

      <TermsOfUseModal visible={termsOpen} onAgree={handleAgree} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
