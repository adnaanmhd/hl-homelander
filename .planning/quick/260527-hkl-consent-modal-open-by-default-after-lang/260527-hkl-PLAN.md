---
phase: quick-260527-hkl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/screens/signup/TermsOfUseModal.tsx
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/i18n/locales/en.json
  - apps/mobile/src/i18n/locales/hi-IN.json
  - apps/mobile/src/i18n/locales/pt-BR.json
  - apps/mobile/src/i18n/locales/es.json
  - apps/mobile/src/i18n/locales/bn-IN.json
  - apps/mobile/src/i18n/locales/ta-IN.json
  - apps/mobile/src/i18n/locales/te-IN.json
  - apps/mobile/src/i18n/locales/mr-IN.json
  - apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx
  - apps/mobile/__tests__/screens/SignupScreen.test.tsx
  - .planning/REQUIREMENTS.md
autonomous: true
requirements:
  - AUTH-02
  - AUTH-03
  - I18N-07
  - LEGAL-02
user_setup: []

must_haves:
  truths:
    - 'On a fresh install with no MMKV consent record, the Terms-of-Use modal auto-opens the FIRST time SignupScreen mounts (after Splash → ChooseLanguage commits)'
    - "On a relaunch where the MMKV consent record's consentVersion matches the current TERMS_OF_USE_TEXT FNV-1a, the modal does NOT auto-open and the checkbox is pre-checked"
    - 'The modal is non-dismissable: no X / close affordance is rendered, outside-tap is a no-op, and Android hardware back returns true (blocked) while the modal is mounted'
    - "A sticky banner sits between the modal title and the scrollable body (does not scroll with content) with the copy 'Scroll to the bottom and click on Agree after reading.' (localized)"
    - "The Privacy Policy hyperlink is rendered inline in the modal body, styled as a link (accent color + underline), and onPress calls Linking.openURL('https://humynlabs.ai/privacy-policy')"
    - "The Agree button is disabled (opacity ~0.4 + non-pressable) until the ScrollView's onScroll reports the bottom is reached (contentOffset.y + layoutMeasurement.height >= contentSize.height - 4); once enabled, it stays enabled even if the user scrolls back up"
    - 'Tapping Agree calls setConsent({ acceptedAt: new Date().toISOString(), consentVersion: CONSENT_VERSION }), closes the modal, and the SignupScreen checkbox becomes a checked read-only indicator'
    - 'The Continue-with-Google primary CTA on SignupScreen is disabled until the local MMKV consent record exists (consent !== null AND consent.consentVersion === CONSENT_VERSION)'
    - 'Tapping the (now read-only) checkbox after consent does nothing; tapping it BEFORE consent re-opens the consent modal'
    - 'Sign-in flow continues unchanged — server stamps consent_log via the existing /auth/google handler (consent_version + consent_text_hash logged server-side per LEGAL-02); no client payload change required for backend persistence'
    - 'All 8 locale files (en, hi-IN, pt-BR, es, bn-IN, ta-IN, te-IN, mr-IN) contain the new keys signup.consent.scrollBanner + signup.consent.agreeButton + signup.consent.privacyPolicyLink with locale-appropriate translations (no English fallback in non-English bundles)'
    - 'Lint + typecheck pass; the four new behavior tests pass (auto-open gating, BackHandler block, scroll-gates-enable Agree, primary CTA disabled until consent)'
  artifacts:
    - path: 'apps/mobile/src/screens/signup/TermsOfUseModal.tsx'
      provides: 'Auto-open + scroll-gated + BackHandler-blocked consent modal with sticky banner + Privacy Policy Linking.openURL hyperlink'
      contains: 'BackHandler.addEventListener'
      contains_2: 'Linking.openURL'
      contains_3: 'humynlabs.ai/privacy-policy'
      contains_4: 'onScroll'
    - path: 'apps/mobile/src/screens/signup/SignupScreen.tsx'
      provides: 'Auto-mount-gate that opens the modal when no local consent record exists; primary CTA disabled until consent persisted'
      contains: 'CONSENT_VERSION'
      contains_2: 'useEffect'
    - path: 'apps/mobile/src/i18n/locales/en.json'
      provides: 'Canonical English copy for the three new consent keys'
      contains: 'scrollBanner'
      contains_2: 'agreeButton'
      contains_3: 'privacyPolicyLink'
    - path: 'apps/mobile/src/i18n/locales/hi-IN.json'
      provides: 'Hindi translations for the three new consent keys (Devanagari)'
      contains: 'scrollBanner'
    - path: 'apps/mobile/src/i18n/locales/pt-BR.json'
      provides: 'Brazilian Portuguese translations'
      contains: 'scrollBanner'
    - path: 'apps/mobile/src/i18n/locales/es.json'
      provides: 'Spanish translations'
      contains: 'scrollBanner'
    - path: 'apps/mobile/src/i18n/locales/bn-IN.json'
      provides: 'Bengali translations'
      contains: 'scrollBanner'
    - path: 'apps/mobile/src/i18n/locales/ta-IN.json'
      provides: 'Tamil translations'
      contains: 'scrollBanner'
    - path: 'apps/mobile/src/i18n/locales/te-IN.json'
      provides: 'Telugu translations'
      contains: 'scrollBanner'
    - path: 'apps/mobile/src/i18n/locales/mr-IN.json'
      provides: 'Marathi translations (parity with the Phase-7 8-locale set)'
      contains: 'scrollBanner'
    - path: 'apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx'
      provides: 'Updated tests covering auto-open, BackHandler block, scroll-gate enable, Linking.openURL invocation'
      contains: 'scrollToEnd'
    - path: 'apps/mobile/__tests__/screens/SignupScreen.test.tsx'
      provides: 'Updated tests covering CTA-disabled-until-consent and modal-not-auto-opened-when-record-exists'
      contains: 'consentVersion'
  key_links:
    - from: 'apps/mobile/src/screens/signup/SignupScreen.tsx'
      to: 'apps/mobile/src/screens/signup/TermsOfUseModal.tsx'
      via: 'termsOpen state initialized from useAppStore consent slice + useEffect on mount'
      pattern: 'useEffect.*setTermsOpen|termsOpen.*=.*!consent'
    - from: 'apps/mobile/src/screens/signup/TermsOfUseModal.tsx'
      to: 'https://humynlabs.ai/privacy-policy'
      via: "Linking.openURL on the Privacy Policy <Text accessibilityRole='link'> press"
      pattern: "Linking\\.openURL.*humynlabs\\.ai/privacy-policy"
    - from: 'apps/mobile/src/screens/signup/TermsOfUseModal.tsx'
      to: 'react-native BackHandler'
      via: 'useEffect subscription that returns true while modal visible'
      pattern: "BackHandler\\.addEventListener.*hardwareBackPress"
    - from: 'apps/mobile/src/screens/signup/TermsOfUseModal.tsx'
      to: 'apps/mobile/src/state/appStore.ts setConsent'
      via: 'onAgree handler called from the (initially disabled) Agree button after scroll-bottom'
      pattern: "setConsent\\(\\{"
    - from: 'apps/mobile/src/screens/signup/SignupScreen.tsx'
      to: 'apps/mobile/src/state/appStore.ts consent slice'
      via: 'useAppStore((s) => s.consent) used both to gate CTA disabled-state and to seed termsOpen on mount'
      pattern: 'useAppStore.*consent'
---

<objective>
Convert the existing on-demand Terms-of-Use modal into an auto-opening, non-dismissable, scroll-gated consent gate that fires the FIRST time SignupScreen mounts when no local MMKV consent record exists. Add a sticky "scroll to the bottom and click on Agree after reading" banner under the title, an inline Privacy Policy hyperlink (system browser via Linking.openURL), and a scroll-gated Agree button. Translate the three new strings across all 8 locale bundles. Server-side consent persistence is already handled by the existing /auth/google handler on sign-in — no backend or API client change is required.

Purpose: Tighten the consent UX so users actually read the terms before agreeing (today's UX pre-checks the box, modal is opt-in via a link tap) and harden the legal audit trail (the LOCKED idea-brief.md §5.2 consent contract is unchanged — only the UX wrapper around it gets stricter).

Output: A modified TermsOfUseModal + SignupScreen that auto-open + gate the primary CTA + persist consent locally on Agree, with eight locale bundles translated and unit tests covering the four new behaviors.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@CLAUDE.md

@apps/mobile/src/screens/signup/SignupScreen.tsx
@apps/mobile/src/screens/signup/TermsOfUseModal.tsx
@apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx
@apps/mobile/src/navigation/OnboardingStack.tsx
@apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/ui/primitives/Modal.tsx
@apps/mobile/src/i18n/locales/en.json
@apps/mobile/**tests**/screens/TermsOfUseModal.test.tsx
@apps/mobile/**tests**/screens/SignupScreen.test.tsx

<interfaces>
<!-- Key contracts the executor needs. Pre-extracted to eliminate codebase exploration. -->

From apps/mobile/src/state/appStore.ts:

```typescript
export interface ConsentState {
  acceptedAt: string; // ISO timestamp
  consentVersion: string; // FNV-1a hex of TERMS_OF_USE_TEXT
}
export interface AppState {
  consent: ConsentState | null;
  setConsent(c: ConsentState): void;
  // ...
}
```

From apps/mobile/src/screens/signup/TermsOfUseModal.tsx (current shape — to be modified):

```typescript
export const TERMS_OF_USE_TEXT: string; // CANONICAL, do NOT edit
export interface TermsOfUseModalProps {
  visible: boolean;
  onClose(): void;
}
export function TermsOfUseModal(props: TermsOfUseModalProps): JSX.Element;
```

After this plan the props become:

```typescript
export interface TermsOfUseModalProps {
  visible: boolean;
  onAgree(): void; // called after scroll-gate + Agree tap
}
// NOTE: `onClose` removed — modal is non-dismissable. `onAgree` is the
// ONLY exit. Backward-compat shim: keep an optional `onClose` prop
// typed-but-unused if any other caller exists. (grep confirms only
// SignupScreen calls it; no shim needed — change the signature outright.)
```

From apps/mobile/src/screens/signup/SignupScreen.tsx:

```typescript
const CONSENT_VERSION = consentVersionFromText(TERMS_OF_USE_TEXT);
// useAppStore((s) => s.setConsent) — used to persist
// useAppStore((s) => s.consent) — read for gating CTA + auto-open seed
```

From apps/mobile/src/ui/primitives/Modal.tsx:

```typescript
export interface ModalProps {
  visible: boolean;
  onDismiss: () => void; // RNModal onRequestClose — Android back
  title?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  // ...
}
```

NOTE: the existing primitive passes onDismiss through to RNModal's
onRequestClose. To enforce non-dismissable, pass a no-op `() => {}` for
onDismiss AND register a BackHandler listener (defense in depth — the
RNModal onRequestClose is hit by Android back, but we also want any
parent BackHandler chain to short-circuit). Outside-tap on the scrim
is NOT wired to dismiss in the primitive today — keep it that way.

From apps/api/src/routes/auth/google.ts (server-side; READ-ONLY here):

```typescript
// Every successful POST /auth/google INSERT INTO consent_log:
//   { user_id, consent_version: CONSENT_VERSION /* server-canonical */,
//     consent_text_hash: CONSENT_TEXT_SHA256, accepted_at, ip, ua, flavor }
// Server uses its OWN CONSENT_VERSION (Phase 1 D-LEGAL-03), not the
// client value. The client-side FNV-1a is local audit-trail only.
// → No client payload change is needed for server-side consent logging;
//   it already happens unconditionally on sign-in.
```

From apps/mobile/src/i18n/locales/en.json (shape — new keys go under signup.consent.\*):

```json
{
  "signup": {
    "consentLabelPrefix": "I have read and agree to the ",
    "consentLink": "Terms of Use",
    "consent": {
      "paragraph": "I have read and agree to the Terms of Use"
      // ADD: "scrollBanner": "Scroll to the bottom and click on Agree after reading."
      // ADD: "agreeButton": "Agree"
      // ADD: "privacyPolicyLink": "Privacy Policy"
    }
  },
  "terms": { "consent": { "modalTitle": "Terms of Use", "body": "..." } }
}
```

</interfaces>

<known_knobs>

<!-- Things the verifier should NOT flag as missing. -->

- **Consent versioning strategy:** stay with the FNV-1a `consentVersion` approach (current behavior). The "always re-prompt on cold start" alternative is a known knob the user noted; do NOT implement it.
- **Server payload:** the client does NOT need to send { consent_version, consented_at } on /auth/google. The server stamps its own consent_log row unconditionally on every sign-in (apps/api/src/routes/auth/google.ts lines 220-230). Adding a client payload would be a no-op and would require a server schema change.
- **mr-IN locale:** the Phase 7 8-language set includes Marathi (mr-IN). The task spec says 7 locales; include mr-IN for parity (the verifier greps all 8).
- **The LOCKED §5.2 consent contract is unchanged.** Do NOT edit idea-brief.md §5.2 or design-spec.md §18.1. The new UX is additive (scroll-gate + sticky banner + Privacy Policy link) — none of those modify the canonical TERMS_OF_USE_TEXT or its server SHA-256.
- **No new dependency.** Use `Linking.openURL` (already used in 4+ files: HelpCenterScreen, CompatFailScreen, RigTutorialScreen, upgradeFlow) for the Privacy Policy link. Do NOT add an in-app WebView library.
- **Outside-tap on scrim:** the existing Modal primitive does not wire outside-tap to dismiss — keep it that way. No new pointer-events block needed; the scrim is a non-interactive `<View>`.
- **The bilingual D-32 underlay on non-English locales** (the small grey English text below the translated consent body in TermsOfUseModal) stays — it satisfies I18N-07. Apply the same bilingual treatment to the new sticky banner string so non-English locales render the translated banner on top + the English underlay below.
  </known_knobs>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite TermsOfUseModal — non-dismissable, sticky banner, Privacy Policy link, scroll-gated Agree, BackHandler block</name>
  <files>
    apps/mobile/src/screens/signup/TermsOfUseModal.tsx,
    apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx
  </files>
  <behavior>
    - Test 1 (RED first): rendering `<TermsOfUseModal visible={true} onAgree={mock} />` shows the title "Terms of Use" + a sticky banner element with `accessibilityLabel="consent-scroll-banner"` containing the localized "Scroll to the bottom and click on Agree after reading." copy ABOVE the scrollable body.
    - Test 2: the Agree button (`accessibilityLabel="consent-agree-button"`) starts with `accessibilityState.disabled === true` and `opacity` style ~0.4.
    - Test 3: firing a synthetic onScroll event on the inner ScrollView (`accessibilityLabel="consent-scroll-body"`) with `{ contentOffset: { y: 800 }, layoutMeasurement: { height: 400 }, contentSize: { height: 1198 } }` (i.e. y + h >= contentSize.height - 4) toggles `accessibilityState.disabled === false`. A subsequent onScroll with smaller y (user scrolled back up) keeps `disabled === false` (sticky enable).
    - Test 4: tapping Agree AFTER it's enabled invokes the `onAgree` callback exactly once.
    - Test 5: pressing the Privacy Policy link (`accessibilityLabel="privacy-policy-link"`) calls `Linking.openURL('https://humynlabs.ai/privacy-policy')` exactly once. Mock `Linking.openURL` via `vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined)`.
    - Test 6: while `visible={true}`, the BackHandler listener registered by the modal returns `true` (back is blocked). Verify via `BackHandler.addEventListener` mock (capture the handler arg, invoke it, expect true). When `visible={false}` the subscription is removed (remove mock called).
    - Test 7: no element with `accessibilityLabel="close-button"` or `accessibilityRole="button"` matching "Close"/"X" is rendered (non-dismissable invariant).
  </behavior>
  <action>
    1. Update the TermsOfUseModal component file:
       - Change the props interface: `{ visible: boolean; onAgree(): void; }` (drop `onClose` — modal is non-dismissable; the only exit is Agree).
       - Add a `useState<boolean>(false)` named `agreeEnabled`. NEVER reset to false once true (sticky enable).
       - Wrap the existing body `<ScrollView>` with an outer container; ABOVE the ScrollView and BELOW the modal title, render a sticky `<View accessibilityLabel="consent-scroll-banner">` containing a `<Text variant="caption" tone="primary">{t('signup.consent.scrollBanner')}</Text>` plus, when `i18nDefault.language !== 'en'`, the same bilingual D-32 English underlay treatment used today for the consent body.
       - Give the ScrollView `accessibilityLabel="consent-scroll-body"` (was unlabeled). Wire `onScroll={(e) => { const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent; if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 4) setAgreeEnabled(true); }}` and `scrollEventThrottle={16}`.
       - Inside the existing body, AFTER the translated body Text + English underlay, append an inline `<Text>` with `accessibilityLabel="privacy-policy-link"`, `accessibilityRole="link"`, `style={{ color: colors.accent, textDecorationLine: 'underline' }}`, and `onPress={() => { void Linking.openURL('https://humynlabs.ai/privacy-policy'); }}` rendering `t('signup.consent.privacyPolicyLink')`.
       - Replace the existing `actions={<Button label={t('common.gotIt')} onPress={onClose} />}` with an Agree button: `accessibilityLabel="consent-agree-button"`, `label={t('signup.consent.agreeButton')}`, `disabled={!agreeEnabled}`, `style={!agreeEnabled ? { opacity: 0.4 } : undefined}`, `onPress={onAgree}`. The Button primitive already wires `pointerEvents` from `disabled`; no extra pointerEvents prop needed.
       - Pass `onDismiss={() => {}}` (no-op) to the inner `<Modal>` primitive so RNModal's onRequestClose does nothing.
       - Add a `useEffect` that subscribes to `BackHandler.addEventListener('hardwareBackPress', () => true)` when `visible === true` and `.remove()`s the subscription in cleanup or when `visible` flips false. Mirror the pattern in apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx (lines 58-66).
       - Add the import: `import { Linking, BackHandler } from 'react-native';` (BackHandler is the existing dependency — no new package).
       - `TERMS_OF_USE_TEXT` export stays byte-identical (per the LEGAL-02 audit-trail invariant in the file's docblock).
    2. Replace apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx with the seven tests above. Use `@testing-library/react-native`'s `fireEvent.scroll` for Test 3 (`fireEvent.scroll(getByLabelText('consent-scroll-body'), { nativeEvent: { contentOffset: { y: 800 }, layoutMeasurement: { height: 400 }, contentSize: { height: 1198 } } })`). For BackHandler in Test 6, spy on `BackHandler.addEventListener` and capture the handler.
    3. Run `pnpm --filter @humyn/mobile lint --max-warnings 0` and `pnpm --filter @humyn/mobile typecheck` to clear the cliff before running tests.
  </action>
  <verify>
    <automated>cd apps/mobile && pnpm test -- TermsOfUseModal.test.tsx --run 2>&1 | tail -40 && pnpm lint --max-warnings 0 src/screens/signup/TermsOfUseModal.tsx __tests__/screens/TermsOfUseModal.test.tsx 2>&1 | tail -20 && pnpm typecheck 2>&1 | tail -20</automated>
  </verify>
  <done>All 7 TermsOfUseModal tests pass; lint clean; typecheck clean; the file exports a 1-prop `{ visible, onAgree }` component; grep confirms `BackHandler.addEventListener` + `Linking.openURL.*humynlabs.ai/privacy-policy` + `scrollBanner` + `onScroll` are all present in TermsOfUseModal.tsx.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire SignupScreen auto-open + CTA-disabled-until-consent + read-only checkbox; update SignupScreen tests</name>
  <files>
    apps/mobile/src/screens/signup/SignupScreen.tsx,
    apps/mobile/__tests__/screens/SignupScreen.test.tsx
  </files>
  <behavior>
    - Test 1 (RED first): when `useAppStore.getState().consent === null` on mount, `termsOpen` is `true` (modal auto-opens). Verify via `getByLabelText('Terms of Use modal')` being present.
    - Test 2: when `useAppStore.getState().consent === { acceptedAt, consentVersion: <matches current CONSENT_VERSION> }` on mount, `termsOpen` is `false` (modal does NOT auto-open) and the checkbox renders in checked state.
    - Test 3: when `useAppStore.getState().consent === { acceptedAt, consentVersion: 'stale-old-hash' }` on mount, `termsOpen` is `true` (a consent-version bump re-prompts). The current CONSENT_VERSION is derived from TERMS_OF_USE_TEXT and is stable; the test seeds an obviously-mismatched string.
    - Test 4: the primary CTA (`accessibilityLabel="Continue with Google"`) is rendered with `accessibilityState.disabled === true` whenever `consent === null` OR `consent.consentVersion !== CONSENT_VERSION`.
    - Test 5: after the modal invokes its `onAgree` callback, the test asserts that (a) `setConsent` is called once with `{ acceptedAt: <ISO string>, consentVersion: CONSENT_VERSION }`, (b) `termsOpen` becomes false, (c) the checkbox shows as checked, and (d) the CTA's `accessibilityState.disabled` flips to `false`.
    - Test 6: tapping the (now read-only) checkbox AFTER consent is persisted does nothing — `setConsent` is not called again and `termsOpen` stays false. Tapping the checkbox BEFORE consent re-opens the modal (regression coverage for the "checkbox tap re-opens if not yet consented" branch).
  </behavior>
  <action>
    1. In apps/mobile/src/screens/signup/SignupScreen.tsx:
       - Replace the existing `const [consent, setConsentChecked] = useState(true);` local state. The component's "is consent persisted?" derives from the store: `const consentRecord = useAppStore((s) => s.consent); const consentPersisted = consentRecord !== null && consentRecord.consentVersion === CONSENT_VERSION;`.
       - Replace `const [termsOpen, setTermsOpen] = useState(false);` initial value with a `useEffect` on mount that calls `setTermsOpen(!consentPersisted)`. (Use `useEffect(() => { if (!consentPersisted) setTermsOpen(true); }, []);` — only fires on mount; later store updates do NOT re-open the modal.) Reading the store on the initial render via `useAppStore.getState()` for the initial `useState(() => !consentPersisted)` is also acceptable — pick the form that gives a deterministic mount-time gate (D-32 prefers the lazy initializer for SSR/test determinism; this is RN, no SSR concern — use the `useEffect` form for clarity).
       - Wire the modal: `<TermsOfUseModal visible={termsOpen} onAgree={handleAgree} />`. Replace the old `onClose` with `handleAgree = useCallback(() => { setConsent({ acceptedAt: new Date().toISOString(), consentVersion: CONSENT_VERSION }); setTermsOpen(false); logEvent('consent_agreed', { consent_version: CONSENT_VERSION }); }, [setConsent]);`.
       - Update the CTA's `disabled` prop: `disabled={loading || !consentPersisted}`. Drop the legacy `consentRequiredAlert` branch in `handleSignIn` — the CTA being disabled is the gate now, but keep a defense-in-depth `if (!consentPersisted) return;` at the top of `handleSignIn`.
       - Inside `handleSignIn` after the existing `signInWithGoogle()` resolves, drop the existing `setConsent({ acceptedAt: ..., consentVersion: CONSENT_VERSION })` call — consent is now persisted by the modal's Agree handler, not on sign-in. Keep the `setJwt` + `setUser` + `logEvent('signup_google_completed')` + `navigation.replace('Permissions')` calls.
       - Replace the `toggleConsent` callback with `handleCheckboxPress = useCallback(() => { if (!consentPersisted) setTermsOpen(true); /* else: no-op — checkbox is a read-only indicator */ }, [consentPersisted]);`. Wire the checkbox `<Pressable onPress={handleCheckboxPress}>` and `accessibilityState={{ checked: consentPersisted, disabled: consentPersisted }}`. The visual "checked ✓" branch already keys off `consent` — re-key off `consentPersisted`.
       - Drop the `openTerms` + `closeTerms` callbacks and the inline `<Text accessibilityRole="link" onPress={openTerms}>` Terms-of-Use link — they're obsolete (modal auto-opens; the link is no longer the entry point). The consent paragraph still renders ("I have read and agree to the Terms of Use") but the Terms-of-Use sub-link is no longer pressable; render it as plain text so the design + bilingual underlay are preserved. (If the visual review wants the link still pressable for explicit re-open before consent, an `onPress={handleCheckboxPress}` on the wrapping Text works — pick whichever the design-spec snapshot allows; keep the plain-text form by default to avoid a second re-open path.)
    2. Update apps/mobile/__tests__/screens/SignupScreen.test.tsx with the six tests above. Mock `useAppStore` via the existing pattern in apps/mobile/__tests__/screens/SignupScreen.test.tsx (don't introduce a new mocking utility). Mock `react-i18next` (existing pattern). For Tests 5-6, drive the modal's onAgree by capturing the prop on the rendered `<TermsOfUseModal>` via `vi.mock('../../src/screens/signup/TermsOfUseModal', ...)` and exposing the captured `onAgree` to the test.
    3. The existing snapshot test at apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx will need a fresh baseline because the consent row no longer has a pressable Terms-of-Use sub-link. Re-baseline with `vitest --run -u apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx`.
  </action>
  <verify>
    <automated>cd apps/mobile && pnpm test -- SignupScreen.test.tsx --run 2>&1 | tail -40 && pnpm test -- SignupScreen.visual.test.tsx --run 2>&1 | tail -20 && pnpm typecheck 2>&1 | tail -20 && pnpm lint --max-warnings 0 src/screens/signup/SignupScreen.tsx __tests__/screens/SignupScreen.test.tsx 2>&1 | tail -10</automated>
  </verify>
  <done>All 6 SignupScreen tests pass; visual snapshot re-baselined (1 file touched, no other surface affected); lint clean; typecheck clean; grep confirms `useEffect` + `consentPersisted` + `CONSENT_VERSION` references in SignupScreen.tsx; the old `consentRequiredAlert` branch is gone (`grep -v '^#' apps/mobile/src/screens/signup/SignupScreen.tsx | grep -c consentRequiredAlert` returns 0).</done>
</task>

<task type="auto">
  <name>Task 3: Translate the three new keys into all 8 locale bundles + refine REQUIREMENTS.md consent rows</name>
  <files>
    apps/mobile/src/i18n/locales/en.json,
    apps/mobile/src/i18n/locales/hi-IN.json,
    apps/mobile/src/i18n/locales/pt-BR.json,
    apps/mobile/src/i18n/locales/es.json,
    apps/mobile/src/i18n/locales/bn-IN.json,
    apps/mobile/src/i18n/locales/ta-IN.json,
    apps/mobile/src/i18n/locales/te-IN.json,
    apps/mobile/src/i18n/locales/mr-IN.json,
    .planning/REQUIREMENTS.md
  </files>
  <action>
    1. Add three new keys under `signup.consent.*` in EACH of the 8 locale files (the parent `signup.consent` object already exists in all 8 — it currently holds the legacy `paragraph` key). Insert the new keys alphabetically AFTER `paragraph`:
       - `signup.consent.agreeButton` — the Agree button label
       - `signup.consent.privacyPolicyLink` — the Privacy Policy link text
       - `signup.consent.scrollBanner` — the sticky banner copy: "Scroll to the bottom and click on Agree after reading."
       
       Translations (match the tone of each existing locale bundle — informal/casual to mirror the I18N-05 brief):
       
       | Locale | scrollBanner | agreeButton | privacyPolicyLink |
       |--------|--------------|-------------|-------------------|
       | en | Scroll to the bottom and click on Agree after reading. | Agree | Privacy Policy |
       | hi-IN | पढ़ने के बाद नीचे तक स्क्रॉल करें और सहमत हूँ पर टैप करें। | सहमत हूँ | प्राइवेसी पॉलिसी |
       | pt-BR | Role até o final e clique em Concordo depois de ler. | Concordo | Política de Privacidade |
       | es | Desplázate hasta el final y haz clic en Acepto después de leer. | Acepto | Política de Privacidad |
       | bn-IN | পড়ার পর নিচ পর্যন্ত স্ক্রল করুন এবং সম্মত আছি-তে ট্যাপ করুন। | সম্মত আছি | প্রাইভেসি পলিসি |
       | ta-IN | படித்த பிறகு கீழே ஸ்க்ரோல் செய்து ஒப்புக்கொள்கிறேன் என்பதைத் தட்டவும். | ஒப்புக்கொள்கிறேன் | தனியுரிமை கொள்கை |
       | te-IN | చదివిన తర్వాత కిందికి స్క్రోల్ చేసి అంగీకరిస్తున్నాను నొక్కండి. | అంగీకరిస్తున్నాను | ప్రైవసీ పాలసీ |
       | mr-IN | वाचल्यानंतर खाली स्क्रोल करा आणि सहमत आहे वर टॅप करा. | सहमत आहे | प्रायव्हसी पॉलिसी |
       
       Validate JSON parseability after each edit (a trailing comma or unbalanced brace will kill the i18n bootstrap; the test suite's `i18n.test.ts` already covers this — run it after Task 3).
    2. In .planning/REQUIREMENTS.md:
       - Refine `AUTH-02` (line 22) — replace the "default checked; unchecked + tap shows the alert" wording with: "Consent modal auto-opens on first SignupScreen mount when no local MMKV consent record exists; modal is non-dismissable (no X button, outside-tap no-op, Android hardware back blocked); Agree button is disabled until ScrollView reports bottom reached; primary CTA is disabled until consent is persisted locally."
       - Refine `AUTH-03` (line 23) — replace the "popup before consenting" wording with: "Consent modal renders the full canonical Terms of Use copy (verbatim from idea-brief.md §5.2) in a non-dismissable, scroll-gated, scrollable card with a sticky 'scroll to the bottom and click on Agree after reading' banner above the body, an inline Privacy Policy hyperlink (https://humynlabs.ai/privacy-policy) opened via Linking.openURL, and an Agree button that becomes enabled only after the user scrolls to the bottom."
       - Add a `[x]` under the §v1 LEGAL block (after LEGAL-05) — a new row `LEGAL-06: Consent modal scroll-gated Agree button is the on-device gate before the local MMKV consent record is written; server-side /auth/google consent_log persistence (LEGAL-02) is unchanged and remains the authoritative legal record.` — mark complete with a `_2026-05-27: closed by quick task 260527-hkl_` annotation.
       - No edit to I18N-07 (already covers bilingual rendering for non-English locales — the new sticky banner inherits the same treatment).
       - Update the trace table (lines 647-651) to add the LEGAL-06 row pointing at this quick task.
    3. Do NOT edit idea-brief.md §5.2 or design-spec.md §18.1 (the new behavior is additive — the LOCKED consent contract is unchanged). Confirm by grep: `grep -c "Scroll to the bottom" idea-brief.md design-spec.md` MUST return 0 (the banner copy lives in i18n, not in the spec docs).
  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander && for f in apps/mobile/src/i18n/locales/{en,hi-IN,pt-BR,es,bn-IN,ta-IN,te-IN,mr-IN}.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('OK $f')"; done && for f in apps/mobile/src/i18n/locales/{en,hi-IN,pt-BR,es,bn-IN,ta-IN,te-IN,mr-IN}.json; do for k in scrollBanner agreeButton privacyPolicyLink; do grep -q "\"$k\"" "$f" || echo "MISSING $k in $f"; done; done && grep -c "Scroll to the bottom" idea-brief.md design-spec.md 2>/dev/null && cd apps/mobile && pnpm test -- i18n --run 2>&1 | tail -20</automated>
  </verify>
  <done>All 8 locale files parse as valid JSON; all 8 contain the three new keys (`scrollBanner`, `agreeButton`, `privacyPolicyLink`); idea-brief.md + design-spec.md do NOT contain "Scroll to the bottom" (LOCKED docs untouched); the i18n test suite passes; REQUIREMENTS.md AUTH-02 + AUTH-03 + LEGAL-06 rows reflect the new behavior with a 2026-05-27 annotation.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                    | Description                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal → outside             | Modal must not be dismissable; outside-tap / hardware-back / X-button paths are all blocked.                                                                              |
| Client → Privacy Policy URL | `Linking.openURL` hands off to the system browser; URL is a string literal, no user input concatenation.                                                                  |
| Client MMKV → /auth/google  | Local consent record is bookkeeping; server stamps the authoritative consent_log row using its OWN CONSENT_VERSION on every sign-in (apps/api/src/routes/auth/google.ts). |

## STRIDE Threat Register

| Threat ID   | Category               | Component                 | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                            |
| ----------- | ---------------------- | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-260527-01 | Tampering              | Local MMKV consent record | accept      | The MMKV consent record is local bookkeeping only; server-side /auth/google unconditionally writes the authoritative consent_log row (CONSENT_VERSION + CONSENT_TEXT_SHA256 + IP + UA + flavor) per LEGAL-02. A user who tampers with their MMKV record cannot bypass the server log.                                                      |
| T-260527-02 | Repudiation            | Sign-in consent claim     | mitigate    | Server stamps consent_log row inside the same transaction as the user UPSERT (apps/api/src/routes/auth/google.ts lines 182-237). The audit trail is server-side, not client. No client change needed.                                                                                                                                      |
| T-260527-03 | Information disclosure | Privacy Policy link       | accept      | `Linking.openURL('https://humynlabs.ai/privacy-policy')` is a string literal with no PII concatenation. The system browser handles cookies/referrer per its own policy.                                                                                                                                                                    |
| T-260527-04 | Denial of service      | BackHandler block         | accept      | Returning `true` from a BackHandler listener is a UX gate, not a process-level lock — the user can still force-quit / uninstall. Modal lives only on the Signup screen before sign-in; there's no high-value attack surface to harden.                                                                                                     |
| T-260527-05 | Elevation of privilege | Scroll-gate bypass        | mitigate    | The Agree button's `disabled` state is enforced at the React layer via the Button primitive's existing `pointerEvents` wiring. A reverse-engineered APK could patch this, but the server-side consent_log is the authoritative legal record (T-260527-01 mitigation) — bypassing the on-device gate does not bypass the legal audit trail. |

</threat_model>

<verification>
1. `pnpm --filter @humyn/mobile lint --max-warnings 0` passes.
2. `pnpm --filter @humyn/mobile typecheck` passes (no new `any`, no broken imports).
3. `pnpm --filter @humyn/mobile test --run` passes — the three updated/new test files (TermsOfUseModal.test.tsx, SignupScreen.test.tsx, SignupScreen.visual.test.tsx) green; no regression in other test files.
4. `grep -v '^#' apps/mobile/src/screens/signup/TermsOfUseModal.tsx | grep -c "BackHandler.addEventListener"` >= 1.
5. `grep -v '^#' apps/mobile/src/screens/signup/TermsOfUseModal.tsx | grep -c "humynlabs.ai/privacy-policy"` >= 1.
6. `grep -v '^#' apps/mobile/src/screens/signup/TermsOfUseModal.tsx | grep -c "onScroll"` >= 1.
7. `for f in apps/mobile/src/i18n/locales/{en,hi-IN,pt-BR,es,bn-IN,ta-IN,te-IN,mr-IN}.json; do grep -q '"scrollBanner"' "$f" && grep -q '"agreeButton"' "$f" && grep -q '"privacyPolicyLink"' "$f" || echo "MISSING in $f"; done` returns no MISSING.
8. `grep -c "Scroll to the bottom" idea-brief.md design-spec.md 2>/dev/null` MUST return 0 in each (LOCKED docs untouched).
9. Server-side /auth/google handler (apps/api/src/routes/auth/google.ts) is UNCHANGED — no commits touch it (`git diff apps/api/src/routes/auth/google.ts` returns empty).
</verification>

<success_criteria>

- Modal auto-opens on first SignupScreen mount when `useAppStore.getState().consent === null || consent.consentVersion !== CONSENT_VERSION`.
- Modal is non-dismissable (no X, no outside-tap dismiss, BackHandler returns true).
- Sticky banner renders above the scrollable body; on non-English locales the bilingual English underlay below the banner mirrors the existing D-32 consent-body treatment.
- Privacy Policy hyperlink calls `Linking.openURL('https://humynlabs.ai/privacy-policy')`.
- Agree button is disabled until ScrollView reports bottom reached (within 4 px); once enabled, stays enabled.
- Tapping Agree persists `{ acceptedAt, consentVersion: CONSENT_VERSION }` to MMKV via `setConsent`, closes the modal, and checks the now-read-only checkbox.
- Continue-with-Google CTA is disabled until the local consent record exists.
- All 8 locale bundles contain the three new keys with locale-appropriate (non-English-fallback) translations.
- The LOCKED idea-brief.md §5.2 and design-spec.md §18.1 are unchanged.
- Lint + typecheck + the three updated/new test files all pass.
  </success_criteria>

<output>
After completion, create `.planning/quick/260527-hkl-consent-modal-open-by-default-after-lang/260527-hkl-SUMMARY.md` covering:
- Files touched + line counts
- Locale key parity table (8 × 3 = 24 new translation strings)
- The "no idea-brief.md §5.2 spec change" disposition (per the task spec's "only edit if the new behavior MATERIALLY changes the LOCKED consent contract" rule — it does not; the new UX wraps the same canonical text)
- The "server-side /auth/google unchanged" disposition (server already stamps consent_log unconditionally on sign-in — no client payload change needed)
- The two known knobs the verifier should NOT flag (consent-version strategy stays FNV-1a; mr-IN included for parity even though task spec said 7 locales)
- Manual smoke pointer: hi-IN → pt-BR → en walk on a Pixel 10a APK build (out-of-band per /verify; not an executor task)
</output>
