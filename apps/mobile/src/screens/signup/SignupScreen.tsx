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
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { colors, spacing } from '../../ui/tokens';
import { signInWithGoogle } from '../../services/auth';
import { useAppStore } from '../../state/appStore';
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

  const [consent, setConsentChecked] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    if (!consent) {
      Alert.alert('Please accept the Terms of Use to continue.');
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
        name: result.user.name,
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
  }, [consent, navigation, setConsent, setJwt, setUser]);

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
        {/* Logo: stub wordmark; design-spec §2 calls for the brand SVG. The
            accessibilityLabel is the stable contract — see plan 02-15. */}
        <View accessibilityLabel="Humyn Labs logo" style={styles.logoWell}>
          <Text variant="title28" tone="primary">
            Humyn Labs
          </Text>
        </View>
        <Text
          variant="caption"
          tone="secondary"
          style={styles.tagline}
          accessibilityLabel="signup tagline"
        >
          Real Humyns. Real Intelligence.
        </Text>
        <View style={{ height: spacing.hh }} />
        <Text variant="pitch" tone="primary" style={styles.pitchLine}>
          Record real moments.
        </Text>
        <Text variant="pitch" tone="primary" style={styles.pitchLine}>
          Train real intelligence.
        </Text>
        <Text variant="pitch" style={[styles.pitchLine, { color: colors.accent }]}>
          Get paid
        </Text>
      </View>

      <View style={styles.bottom}>
        <Button
          variant="primary"
          label={loading ? 'Signing in…' : 'Continue with Google'}
          accessibilityLabel="Continue with Google"
          onPress={handleSignIn}
          disabled={loading}
        />

        <View style={styles.consentRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Accept Terms of Use checkbox"
            accessibilityState={{ checked: consent }}
            onPress={toggleConsent}
            style={[styles.checkbox, consent ? styles.checkboxChecked : null]}
          >
            {consent ? (
              <View
                accessibilityLabel="checkbox checked indicator"
                style={styles.checkboxInner}
                // data-testid sentinel for tests — the host-component shim
                // forwards unknown props onto the DOM, which lets the test
                // assert against `[data-testid="checkbox-checked-indicator"]`.
                {...{ 'data-testid': 'checkbox-checked-indicator' }}
              />
            ) : null}
          </Pressable>
          <Text
            variant="caption"
            tone="primary"
            style={{ marginLeft: spacing.m }}
            accessibilityLabel="Consent label"
          >
            I have read and agree to the{' '}
            <Text
              variant="caption"
              accessibilityRole="link"
              accessibilityLabel="Terms of Use link"
              onPress={openTerms}
              style={{ color: colors.accent, textDecorationLine: 'underline' }}
            >
              Terms of Use
            </Text>
          </Text>
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
  container: {
    paddingTop: 60,
    paddingHorizontal: 28,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  top: {
    alignItems: 'center',
  },
  logoWell: {
    marginBottom: spacing.m,
    alignItems: 'center',
  },
  tagline: {
    marginTop: spacing.m,
    textAlign: 'center',
  },
  pitchLine: {
    textAlign: 'center',
    marginVertical: spacing.xs,
  },
  bottom: {
    paddingBottom: spacing.m,
    gap: spacing.l,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 16,
    height: 16,
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
  checkboxInner: {
    width: 8,
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 1,
  },
});
