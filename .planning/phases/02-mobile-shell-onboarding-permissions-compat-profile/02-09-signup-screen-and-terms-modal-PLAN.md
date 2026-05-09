---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 09
id: 02-09-signup-screen-and-terms-modal
name: SignupScreen + TermsOfUseModal (verbatim §5.2 copy) + auth orchestration
type: execute
wave: 2
depends_on: [02-05-navigation-skeleton, 02-04-installation-id-and-telemetry-ring]
files_modified:
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/screens/signup/TermsOfUseModal.tsx
  - apps/mobile/src/services/auth.ts
  - apps/mobile/__tests__/screens/SignupScreen.test.tsx
  - apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx
autonomous: true
requirements: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-08]
must_haves:
  truths:
    - "Sign-up screen lays out: logo (animated scalePop), pitch block 'Record real moments. / Train real intelligence. / Get paid', Continue with Google CTA, consent checkbox (default checked), Terms-of-Use link"
    - "Tapping Continue with Google with consent UNCHECKED shows alert 'Please accept the Terms of Use to continue.' and does NOT advance"
    - "Terms link opens a Modal with the verbatim §5.2 / §18.1 consent text — the SAME text rendered as a baked constant (D-HELP-01-style; Phase 2 inlines because it's a single block, no MD parse needed)"
    - 'Successful sign-in → consent + permsGranted state inspection → navigation.replace to next gate per initial-route tree'
    - 'AUTH-04: name/email pulled from signInWithGoogle(); age/gender absent (Google withholds — persisted as null elsewhere; this screen does not surface them)'
    - 'Logout helper (signOut) is exported from auth.ts for plan 02-18 Profile Logout to consume'
  artifacts:
    - path: 'apps/mobile/src/screens/signup/SignupScreen.tsx'
      provides: 'Full Sign-up screen per design-spec §2'
      contains: 'Continue with Google'
    - path: 'apps/mobile/src/screens/signup/TermsOfUseModal.tsx'
      provides: 'Verbatim Terms-of-Use modal (§5.2 / §18.1)'
      contains: 'I consent and agree to upload videos'
    - path: 'apps/mobile/src/services/auth.ts'
      provides: 'Extended with signOut() helper'
      contains: 'export function signOut'
  key_links:
    - from: 'apps/mobile/src/screens/signup/SignupScreen.tsx'
      to: 'apps/mobile/src/services/auth.ts'
      via: 'signInWithGoogle() call'
      pattern: 'signInWithGoogle'
    - from: 'apps/mobile/src/screens/signup/SignupScreen.tsx'
      to: 'apps/mobile/src/state/appStore.ts'
      via: 'store.setJwt + store.setConsent'
      pattern: 'setJwt'
---

<objective>
Implement the full Sign-up screen per design-spec §2, the Terms-of-Use modal with verbatim §5.2 / §18.1 copy, and extend `auth.ts` with a `signOut()` helper. Wraps the Phase 1 `signInWithGoogle()` orchestration without modifying it.

Purpose: AUTH-01..05 + AUTH-08 client-side. AUTH-08 (logout) actually fires from Profile (plan 02-18) but the helper lives here.
Output: a working Sign-up screen that, on tap of "Continue with Google" with consent checked, runs sign-in → records consent acceptance in MMKV → routes to Permissions.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/auth.ts
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/state/keys.ts
@design-spec.md
@idea-brief.md
@logo.js

<interfaces>
<!-- design-spec.md §2 verbatim copy for SignupScreen -->
- Tagline: "Real Humyns. Real Intelligence."
- Pitch (24/32, 700, centered):
    Record real moments.
    Train real intelligence.
    Get paid (in accent color)
- Google CTA label: "Continue with Google"
- Consent label: "I have read and agree to the [Terms of Use](#)"
- Default: consent CHECKED
- Unchecked + tap → alert "Please accept the Terms of Use to continue."

<!-- design-spec.md §18.1 verbatim Terms of Use modal copy -->

Title: "Terms of Use"
Body: "I consent and agree to upload videos of myself and/or others who consent to be recorded; performing certain daily activities/tasks. This content will be used to develop / train AI models and for research purposes. I confirm that I am 18 years or older and have the necessary permissions to share this content. I confirm that no one being recorded is a minor. I consent to my approximate location and IP address being captured alongside each recording. I understand that my data will be stored securely and used in accordance with Humyn's Privacy Policy."
Action: single btn-primary "Got it" (closes)
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                             | Description                                         |
| ------------------------------------ | --------------------------------------------------- |
| Google Sign-In SDK → JWT exchange    | TLS via SDK; backend Phase 1 D-AUTH-01..05 enforces |
| Consent text rendering → user → MMKV | static constant; no remote text injection           |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                         | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                      |
| --------- | ---------------------- | ----------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-2.9-01  | Tampering              | Consent text replaced via downstream commits                      | mitigate    | Constant ships in `apps/mobile/src/screens/signup/TermsOfUseModal.tsx` with a `// CANONICAL — sourced verbatim from idea-brief.md §5.2` comment; plan 02-21 manual-smoke runbook re-checks against idea-brief on phase gate. Backend Phase 1 logs consent version hash (D-LEGAL-02). |
| T-2.9-02  | Spoofing               | User clicks Continue with Google but a different account responds | accept      | Google Sign-In SDK provides authoritative ID token; backend re-validates.                                                                                                                                                                                                            |
| T-2.9-03  | Repudiation            | User claims they didn't accept consent                            | mitigate    | `setConsent(consent)` writes ISO datetime + consent version hash to MMKV; backend logs server-side per LEGAL-02.                                                                                                                                                                     |
| T-2.9-04  | Information Disclosure | Google profile fields (name, email) leak via console.log          | mitigate    | Plan-checker greps `console.log` for `email`/`name`; reject. Auth.ts already follows the rule.                                                                                                                                                                                       |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author TermsOfUseModal + extend auth.ts with signOut()</name>
  <files>apps/mobile/src/screens/signup/TermsOfUseModal.tsx (NEW), apps/mobile/src/services/auth.ts, apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx (NEW)</files>
  <read_first>
    - idea-brief.md §5.2 lines 87-95 (verbatim consent text)
    - design-spec.md §18.1 lines 673-677 (Terms of Use modal layout)
    - apps/mobile/src/services/auth.ts (current shape — confirm clearStoredJwt exists)
    - apps/mobile/src/ui/primitives/Modal.tsx (Task 02-02 — Modal primitive)
    - apps/mobile/src/ui/primitives/Button.tsx (Task 02-02 — Button primitive)
  </read_first>
  <action>
    1. Create `apps/mobile/src/screens/signup/TermsOfUseModal.tsx`:
       ```tsx
       import React from 'react';
       import { ScrollView } from 'react-native';
       import { Modal } from '../../ui/primitives/Modal';
       import { Text } from '../../ui/primitives/Text';
       import { Button } from '../../ui/primitives/Button';
       import { spacing } from '../../ui/tokens';

       /**
        * CANONICAL — sourced verbatim from idea-brief.md §5.2 / design-spec.md §18.1.
        * DO NOT EDIT without updating idea-brief.md first AND bumping the consent
        * version on the backend (LEGAL-02 / Phase 1 plan 01-11).
        */
       export const TERMS_OF_USE_TEXT =
         "I consent and agree to upload videos of myself and/or others who consent to be recorded; " +
         "performing certain daily activities/tasks. This content will be used to develop / train AI " +
         "models and for research purposes. I confirm that I am 18 years or older and have the " +
         "necessary permissions to share this content. I confirm that no one being recorded is a minor. " +
         "I consent to my approximate location and IP address being captured alongside each recording. " +
         "I understand that my data will be stored securely and used in accordance with Humyn's " +
         "Privacy Policy.";

       interface Props {
         visible: boolean;
         onClose(): void;
       }

       export function TermsOfUseModal({ visible, onClose }: Props) {
         return (
           <Modal visible={visible} title="Terms of Use" onRequestClose={onClose} accessibilityLabel="Terms of Use modal">
             <ScrollView style={{ maxHeight: 400 }}>
               <Text variant="body" tone="primary" style={{ marginBottom: spacing.l }}>
                 {TERMS_OF_USE_TEXT}
               </Text>
             </ScrollView>
             <Button variant="primary" onPress={onClose} accessibilityLabel="Got it">
               Got it
             </Button>
           </Modal>
         );
       }
       ```

    2. Edit `apps/mobile/src/services/auth.ts` to add a `signOut()` helper that wraps `clearStoredJwt()` plus a `useAppStore.getState().signOut()` call. Phase 5 will extend with upload-cancel; Phase 2 just clears auth state:
       ```ts
       import { useAppStore } from '../state/appStore';
       import { clearStoredJwt } from './auth-helpers'; // or inline if already in auth.ts

       export function signOut(): void {
         clearStoredJwt(); // existing Phase 1 helper
         useAppStore.getState().signOut(); // wipes jwt in store + MMKV (defense-in-depth)
       }
       ```
       (Adapt to the actual current auth.ts shape — confirm `clearStoredJwt` is exported; if not, inline the MMKV delete.)

    3. Author `__tests__/screens/TermsOfUseModal.test.tsx`:
       - Test 1: `visible=false` → modal not visible (queryByText returns null).
       - Test 2: `visible=true` → renders the title "Terms of Use" + the verbatim text starting with "I consent and agree to upload videos".
       - Test 3: Tap "Got it" → onClose called once.
       - Test 4 (snapshot): Body text matches the canonical TERMS_OF_USE_TEXT export verbatim.

  </action>
  <acceptance_criteria>
    - `grep -q "TERMS_OF_USE_TEXT" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` succeeds.
    - `grep -q "I consent and agree to upload videos" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` succeeds.
    - `grep -q "no one being recorded is a minor" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` succeeds (deep verbatim check).
    - `grep -q "I am 18 years or older" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` succeeds.
    - `grep -q "approximate location and IP address" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` succeeds.
    - `grep -q "Humyn's Privacy Policy" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` succeeds.
    - `grep -q "export function signOut" apps/mobile/src/services/auth.ts` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/screens/TermsOfUseModal.test.tsx` passes (4 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/screens/TermsOfUseModal.test.tsx && grep -q "no one being recorded is a minor" src/screens/signup/TermsOfUseModal.tsx && grep -q "approximate location and IP address" src/screens/signup/TermsOfUseModal.tsx</automated>
  </verify>
  <done>TermsOfUseModal renders verbatim §5.2/§18.1 copy; signOut helper exported; tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SignupScreen — full design-spec §2 layout + consent gate + auth orchestration</name>
  <files>apps/mobile/src/screens/signup/SignupScreen.tsx, apps/mobile/__tests__/screens/SignupScreen.test.tsx (NEW)</files>
  <read_first>
    - design-spec.md §2 lines 142-168 (full sign-up layout + 4 states)
    - design-spec.md §1 lines 130-138 (Splash logo styling — same pattern reused for sign-up logo)
    - apps/mobile/src/services/auth.ts (Phase 1 signInWithGoogle — confirm signature)
    - apps/mobile/src/state/appStore.ts (setJwt, setConsent actions from 02-03)
    - apps/mobile/src/screens/signup/TermsOfUseModal.tsx (Task 1 above)
    - logo.js (brand mark)
    - apps/mobile/src/screens/signup/SignupScreen.tsx (current 02-05 stub)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "SignupScreen.tsx" lines 131-198
  </read_first>
  <behavior>
    Test 1: Renders the brand logo (assert via accessibilityLabel "Humyn Labs logo").
    Test 2: Renders the verbatim pitch block: "Record real moments." + "Train real intelligence." + "Get paid".
    Test 3: Renders "Continue with Google" button (accessibilityLabel = "Continue with Google").
    Test 4: Consent checkbox is checked by default (mocked checkbox state).
    Test 5: Tap "Continue with Google" with consent unchecked → mocked Alert is called with title "Please accept the Terms of Use to continue."; signInWithGoogle is NOT called.
    Test 6: Tap with consent checked → signInWithGoogle is called; on success → store.setJwt called with the returned JWT; store.setConsent called with {acceptedAt: <ISO>, consentVersion: ...}; navigation.replace('Permissions') called.
    Test 7: signInWithGoogle rejects → screen shows error toast / inline error; state returns to 'idle'; navigation NOT replaced.
    Test 8: Tapping the "Terms of Use" link opens TermsOfUseModal (visible=true).
    Test 9: AUTH-04: name + email come back; age/gender absent — these are propagated to subsequent /me PATCH (Profile in 02-18); no failure on null.
  </behavior>
  <action>
    Replace `apps/mobile/src/screens/signup/SignupScreen.tsx` body with the full design-spec §2 implementation:
    ```tsx
    import React, { useState, useCallback } from 'react';
    import { View, StyleSheet, Alert, Pressable as RNPressable } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import Logo from '../../../../logo';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { Pressable } from '../../ui/primitives/Pressable';
    import { colors, spacing } from '../../ui/tokens';
    import { signInWithGoogle } from '../../services/auth';
    import { useAppStore } from '../../state/appStore';
    import { logEvent } from '../../util/analytics';
    import { TermsOfUseModal, TERMS_OF_USE_TEXT } from './TermsOfUseModal';

    /** Hash of TERMS_OF_USE_TEXT — Phase 1 plan 01-11 ships the canonical hash; we reference it
     *  via a build-time constant. For Phase 2, write a SHA-256 of TERMS_OF_USE_TEXT at module load. */
    function consentVersionFromText(): string {
      // Lightweight, sync hash for the consent version stamp. Hand-rolled FNV-1a is enough —
      // we only need a stable per-text identifier for client-side bookkeeping; the server-side
      // canonical hash (D-LEGAL-03) is stamped server-side with the canonical SHA-256.
      let h = 2166136261;
      for (let i = 0; i < TERMS_OF_USE_TEXT.length; i++) {
        h ^= TERMS_OF_USE_TEXT.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16);
    }

    export default function SignupScreen() {
      const navigation = useNavigation<any>();
      const setJwt = useAppStore((s) => s.setJwt);
      const setConsent = useAppStore((s) => s.setConsent);
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
          setConsent({ acceptedAt: new Date().toISOString(), consentVersion: consentVersionFromText() });
          logEvent('signup_google_completed');
          navigation.replace('Permissions');
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown_error';
          setError(reason);
          logEvent('signup_google_failed', { reason });
        } finally {
          setLoading(false);
        }
      }, [consent, navigation, setConsent, setJwt]);

      return (
        <ScreenContainer>
          <View style={styles.top}>
            <Logo width={140} height={48} accessibilityLabel="Humyn Labs logo" />
            <Text variant="caption" tone="secondary" style={{ marginTop: spacing.m }} accessibilityLabel="signup tagline">
              Real Humyns. Real Intelligence.
            </Text>
            <View style={{ height: spacing.hh }} />
            <Text variant="pitch" tone="primary" style={styles.pitchLine} accessibilityLabel="pitch line 1">
              Record real moments.
            </Text>
            <Text variant="pitch" tone="primary" style={styles.pitchLine} accessibilityLabel="pitch line 2">
              Train real intelligence.
            </Text>
            <Text variant="pitch" style={[styles.pitchLine, { color: colors.accent }]} accessibilityLabel="pitch line 3">
              Get paid
            </Text>
          </View>
          <View style={styles.bottom}>
            <Button
              variant="primary"
              onPress={handleSignIn}
              disabled={loading}
              accessibilityLabel="Continue with Google"
            >
              {loading ? 'Signing in…' : 'Continue with Google'}
            </Button>
            <View style={styles.consentRow}>
              <Pressable
                onPress={() => {
                  setConsentChecked((v) => !v);
                  logEvent('signup_consent_checked', { value: !consent ? 'true' : 'false' });
                }}
                accessibilityRole="checkbox"
                accessibilityLabel="Accept Terms of Use checkbox"
                accessibilityState={{ checked: consent }}
              >
                <View style={[styles.checkbox, consent && styles.checkboxChecked]} />
              </Pressable>
              <Text variant="caption" tone="primary" style={{ marginLeft: spacing.m }}>
                I have read and agree to the{' '}
                <Text
                  variant="caption"
                  style={{ color: colors.accent, textDecorationLine: 'underline' }}
                  onPress={() => {
                    setTermsOpen(true);
                    logEvent('signup_terms_opened');
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="Terms of Use link"
                >
                  Terms of Use
                </Text>
              </Text>
            </View>
            {error ? (
              <Text variant="caption" style={{ color: colors.coral, marginTop: spacing.m }} accessibilityLabel="signup error">
                {error}
              </Text>
            ) : null}
          </View>
          <TermsOfUseModal visible={termsOpen} onClose={() => setTermsOpen(false)} />
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      top: { paddingTop: 60, alignItems: 'center' },
      bottom: { paddingBottom: 32, gap: spacing.l },
      pitchLine: { textAlign: 'center', marginVertical: spacing.xs },
      consentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
      checkbox: { width: 16, height: 16, borderWidth: 1.5, borderColor: colors.line, borderRadius: 3 },
      checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
    });
    ```

    Author `__tests__/screens/SignupScreen.test.tsx` covering the 9 behaviors. Mock `../../src/services/auth` (signInWithGoogle), `../../src/state/appStore` (setJwt, setConsent), `react-native` Alert.alert via `vi.spyOn(Alert, 'alert')`, and the navigation hook.

  </action>
  <acceptance_criteria>
    - `grep -q "Continue with Google" apps/mobile/src/screens/signup/SignupScreen.tsx` succeeds.
    - `grep -q "Real Humyns. Real Intelligence." apps/mobile/src/screens/signup/SignupScreen.tsx` succeeds.
    - `grep -q "Record real moments." apps/mobile/src/screens/signup/SignupScreen.tsx` succeeds.
    - `grep -q "Train real intelligence." apps/mobile/src/screens/signup/SignupScreen.tsx` succeeds.
    - `grep -q "Get paid" apps/mobile/src/screens/signup/SignupScreen.tsx` succeeds.
    - `grep -q "Please accept the Terms of Use to continue" apps/mobile/src/screens/signup/SignupScreen.tsx` succeeds.
    - `grep -q "navigation.replace('Permissions')" apps/mobile/src/screens/signup/SignupScreen.tsx` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/screens/SignupScreen.test.tsx` passes (9 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/screens/SignupScreen.test.tsx</automated>
  </verify>
  <done>SignupScreen ships verbatim design-spec §2 layout + consent gate + auth orchestration; 9 unit tests cover gate, success, error, and modal-open paths.</done>
</task>

</tasks>

<verification>
- Verbatim §5.2 / §18.1 consent text in TermsOfUseModal (deep grep checks).
- Verbatim design-spec §2 pitch lines in SignupScreen.
- Consent gate enforced before signInWithGoogle.
- Logout helper exported for plan 02-18.
- 13 unit tests across this plan.
</verification>

<success_criteria>

- AUTH-01..05 + AUTH-08 client-side surfaces complete.
- Plan 02-18 (Profile Logout) imports `signOut` directly.
- consent acceptance is recorded in MMKV with timestamp + version.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-09-SUMMARY.md` documenting the consent-version computation (FNV-1a vs server-side SHA-256), the alert-based gate, and the analytics events fired.
</output>
