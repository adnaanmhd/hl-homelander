---
phase: quick-260527-hkl
verified: 2026-05-27T13:25:00Z
status: human_needed
score: 13/13 must-haves verified (automated); 1 human-hardware walk pending
overrides_applied: 0
re_verification:
  previous_status: none
  initial: true
gaps: []
human_verification:
  - test: 'Manual hi-IN → pt-BR → en walk on a Pixel 10a APK build (apkRolloutDebug)'
    expected: 'Modal auto-opens on first SignupScreen mount; non-dismissable (no X, outside-tap no-op, Android hardware back blocked while modal mounted); Agree button transitions from opacity 0.4 → full saturation when user reaches scroll bottom; Privacy Policy link opens system browser at https://humynlabs.ai/privacy-policy; on Agree the modal closes, the checkbox renders ✓, Continue-with-Google becomes pressable; cold-relaunch does NOT re-open the modal; bilingual D-32 underlay banner renders on hi-IN + pt-BR'
    why_human: 'Hardware-only UX behaviors — visual opacity transition, real Android BackHandler propagation through OS, real Linking.openURL browser hand-off, real MMKV persistence across cold restart, real Devanagari/accented-char rendering on a 1080×1920 Pixel 10a screen. Cannot be exercised through JSDOM unit tests.'
---

# Quick Task 260527-hkl: Consent modal — Verification Report

**Task Goal:** Consent modal — open by default after Language Selection, scroll-gated Agree, all locales
**Verified:** 2026-05-27T13:25:00Z
**Status:** human_needed (all automated gates PASS; hi-IN hardware walk pending per `/verify`)

## Goal Achievement

### Observable Truths (from PLAN frontmatter must_haves)

| #   | Truth                                                                                                             | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Auto-open on fresh-install (no MMKV record) on first SignupScreen mount                                           | VERIFIED | `SignupScreen.tsx:101-105` — `useEffect(() => { const initial = useAppStore.getState().consent; const persistedAtMount = initial !== null && initial.consentVersion === CONSENT_VERSION; if (!persistedAtMount) setTermsOpen(true); }, [])` — mount-only deps, deterministic gate                                                                                 |
| 2   | Modal does NOT auto-open + checkbox pre-checked when current consent record exists                                | VERIFIED | `SignupScreen.tsx:88-89` — `consentPersisted = consentRecord !== null && consentRecord.consentVersion === CONSENT_VERSION` + `Test 2` SignupScreen.test.tsx asserts both invariants; tests PASS 8/8                                                                                                                                                               |
| 3   | Non-dismissable: no X, outside-tap no-op, Android back returns true                                               | VERIFIED | `TermsOfUseModal.tsx:102-106` — `BackHandler.addEventListener('hardwareBackPress', () => true)` with subscription cleanup; `:131` `onDismiss={() => undefined}`; no `accessibilityLabel="close-button"` rendered (Test 7 asserts); `Test 6` of `TermsOfUseModal.test.tsx` verifies handler returns true + remove() called on visible→false                        |
| 4   | Sticky banner above scroll body with localized scrollBanner copy                                                  | VERIFIED | `TermsOfUseModal.tsx:147-161` — `<View accessibilityLabel="consent-scroll-banner">` rendered OUTSIDE the `<ScrollView>` (sticky-by-DOM-order); Test 1 asserts `compareDocumentPosition(body) & 4 === 4` (banner precedes body in document) — PASS                                                                                                                 |
| 5   | Privacy Policy hyperlink calls Linking.openURL with the canonical URL                                             | VERIFIED | `TermsOfUseModal.tsx:79` const `PRIVACY_POLICY_URL = 'https://humynlabs.ai/privacy-policy'`; `:194-196` `onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL); }}`; styled accent + underline (`:197`); Test 5 asserts `openSpy.toHaveBeenCalledWith('https://humynlabs.ai/privacy-policy')` — PASS                                                          |
| 6   | Agree disabled until scroll-bottom; sticky once enabled                                                           | VERIFIED | `TermsOfUseModal.tsx:84` `BOTTOM_SLOP_PX = 4`; `:108-124` `onScroll` handler computes `y + h >= total - BOTTOM_SLOP_PX` and only calls `setAgreeEnabled(true)` (never `false`); `:139-140` `disabled={!agreeEnabled}` + `opacity: 0.4` style; Test 3 fires bottom-reached then scroll-back-up and asserts agree stays enabled — PASS                              |
| 7   | Tapping Agree calls setConsent({ acceptedAt, consentVersion: CONSENT_VERSION }) + closes modal + checkbox checked | VERIFIED | `SignupScreen.tsx:140-147` `handleAgree` calls `setConsent({ acceptedAt: new Date().toISOString(), consentVersion: CONSENT_VERSION })` + `setTermsOpen(false)` + `logEvent('consent_agreed', ...)`; Test 5 of SignupScreen.test.tsx asserts setConsent called with valid ISO timestamp + CURRENT_CONSENT_VERSION, modal closes, checkbox indicator renders — PASS |
| 8   | Continue-with-Google CTA disabled until consent persisted at CURRENT version                                      | VERIFIED | `SignupScreen.tsx:208` `disabled={loading                                                                                                                                                                                                                                                                                                                         |     | !consentPersisted}`; Test 4 asserts no signInWithGoogle / no navigation.replace when consent === null OR stale version — PASS |
| 9   | Read-only checkbox after consent; tap before consent re-opens modal                                               | VERIFIED | `SignupScreen.tsx:151-156` `handleCheckboxPress` — `if (!consentPersisted) setTermsOpen(true)`; else no-op. `:216` `accessibilityState={{ checked: consentPersisted, disabled: consentPersisted }}`. Test 6 covers both branches — PASS                                                                                                                           |
| 10  | Server-side /auth/google consent_log persistence unchanged                                                        | VERIFIED | `git diff main..HEAD -- apps/api/src/routes/auth/google.ts` returns empty; `git log --since=2026-05-27 -- apps/api/src/routes/auth/google.ts` empty; repo-wide `pnpm -r --parallel typecheck` passes for apps/api                                                                                                                                                 |
| 11  | All 8 locale files contain the three new keys with locale-appropriate (non-en-fallback) translations              | VERIFIED | All 8 JSON files parse + contain {`scrollBanner`, `agreeButton`, `privacyPolicyLink`}; node-driven equality check confirms each of {hi-IN, pt-BR, es, bn-IN, ta-IN, te-IN, mr-IN} `scrollBanner` differs from the en value; visual inspection of values shows correct script (Devanagari, Latin-accented, Bengali, Tamil, Telugu, Marathi-Devanagari)             |
| 12  | Lint + typecheck + 4 new behavior tests pass                                                                      | VERIFIED | `npm run typecheck` (mobile) exit 0; `pnpm -r --parallel typecheck` (api + shared) exit 0; TermsOfUseModal.test.tsx 9/9 PASS; SignupScreen.test.tsx 8/8 PASS; i18n 133/133 PASS; SignupScreen.visual.test.tsx 1/1 PASS. Lint script in apps/mobile is a no-op stub ("deferred to plan 13") — not a regression of this task                                        |
| 13  | LOCKED docs (idea-brief.md §5.2, design-spec.md §18.1) UNCHANGED                                                  | VERIFIED | `grep -c "Scroll to the bottom" idea-brief.md design-spec.md` returns 0 for both; `git diff 3544853..HEAD -- idea-brief.md design-spec.md` returns empty                                                                                                                                                                                                          |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact                                                 | Expected                                                                     | Status   | Details                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/screens/signup/TermsOfUseModal.tsx`     | Auto-open + scroll-gated + BackHandler + sticky banner + Privacy Policy link | VERIFIED | 207 lines; sentinels `BackHandler.addEventListener` (line 104), `Linking.openURL` (lines 188, 195), `humynlabs.ai/privacy-policy` (line 79), `onScroll` (lines 108, 166) all present; `TERMS_OF_USE_TEXT` export byte-identical to canonical §5.2 (invariant test passes) |
| `apps/mobile/src/screens/signup/SignupScreen.tsx`        | Auto-open useEffect + CTA gating + read-only checkbox                        | VERIFIED | 347 lines; sentinels `CONSENT_VERSION` (line 76), `useEffect` (line 101), `consentPersisted` (line 88) all present; legacy `consentRequiredAlert` branch removed (grep confirms 0 matches in file)                                                                        |
| `apps/mobile/src/i18n/locales/en.json`                   | Three new keys                                                               | VERIFIED | scrollBanner / agreeButton / privacyPolicyLink all present under `signup.consent.*`                                                                                                                                                                                       |
| `apps/mobile/src/i18n/locales/hi-IN.json`                | Hindi translations                                                           | VERIFIED | Devanagari translations confirmed (पढ़ने / सहमत हूँ / प्राइवेसी पॉलिसी)                                                                                                                                                                                                   |
| `apps/mobile/src/i18n/locales/pt-BR.json`                | Portuguese translations                                                      | VERIFIED | Latin-accented translations (Role / Concordo / Política de Privacidade)                                                                                                                                                                                                   |
| `apps/mobile/src/i18n/locales/es.json`                   | Spanish translations                                                         | VERIFIED | (Desplázate / Acepto / Política de Privacidad)                                                                                                                                                                                                                            |
| `apps/mobile/src/i18n/locales/bn-IN.json`                | Bengali translations                                                         | VERIFIED | (পড়ার / সম্মত আছি / প্রাইভেসি পলিসি)                                                                                                                                                                                                                                     |
| `apps/mobile/src/i18n/locales/ta-IN.json`                | Tamil translations                                                           | VERIFIED | (படித்த / ஒப்புக்கொள்கிறேன் / தனியுரிமை கொள்கை)                                                                                                                                                                                                                           |
| `apps/mobile/src/i18n/locales/te-IN.json`                | Telugu translations                                                          | VERIFIED | (చదివిన / అంగీకరిస్తున్నాను / ప్రైవసీ పాలసీ)                                                                                                                                                                                                                              |
| `apps/mobile/src/i18n/locales/mr-IN.json`                | Marathi translations                                                         | VERIFIED | (वाचल्यानंतर / सहमत आहे / प्रायव्हसी पॉलिसी)                                                                                                                                                                                                                              |
| `apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx` | Tests for auto-open, BackHandler, scroll-gate, Linking                       | VERIFIED | 9 tests (7 behavior + 2 invariants), all PASS; `scrollToEnd` equivalent (`fireScroll(800)` synthetic Event dispatch) present                                                                                                                                              |
| `apps/mobile/__tests__/screens/SignupScreen.test.tsx`    | Tests for CTA gating + auto-open + read-only checkbox                        | VERIFIED | 8 tests (6 behavior + 2 regression), all PASS; `consentVersion` sentinel present                                                                                                                                                                                          |

### Key Link Verification

| From                  | To                                    | Via                                                                    | Status | Details                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SignupScreen.tsx`    | `TermsOfUseModal.tsx`                 | `useEffect` + `setTermsOpen` based on `useAppStore.getState().consent` | WIRED  | SignupScreen.tsx:101-105 + `:284` `<TermsOfUseModal visible={termsOpen} onAgree={handleAgree} />`; data-flow trace: store consent slice → useEffect → setTermsOpen → modal `visible` prop                                       |
| `TermsOfUseModal.tsx` | `https://humynlabs.ai/privacy-policy` | `Linking.openURL` on Text accessibilityRole="link"                     | WIRED  | TermsOfUseModal.tsx:194-196; `PRIVACY_POLICY_URL` constant at line 79; Test 5 verifies the spy receives the exact URL                                                                                                           |
| `TermsOfUseModal.tsx` | `react-native BackHandler`            | `useEffect` subscription that returns true while visible               | WIRED  | TermsOfUseModal.tsx:102-106; Test 6 verifies addEventListener called with `hardwareBackPress` and the handler returns `true`; sub.remove() called when visible=false                                                            |
| `TermsOfUseModal.tsx` | `appStore.setConsent`                 | `onAgree` callback handed down from SignupScreen                       | WIRED  | TermsOfUseModal.tsx:138 `onPress={() => onAgree?.()}`; SignupScreen.tsx:140-147 `handleAgree` calls `setConsent({ acceptedAt, consentVersion: CONSENT_VERSION })`; Test 5 of SignupScreen.test.tsx asserts the exact payload    |
| `SignupScreen.tsx`    | `appStore.consent` slice              | `useAppStore((s) => s.consent)` for CTA gating + mount-time seed       | WIRED  | SignupScreen.tsx:83 selector subscribes; `consentPersisted` derived value gates both CTA `disabled` (line 208) AND `accessibilityState.checked/disabled` on the checkbox (line 216) AND `handleCheckboxPress` branch (line 152) |

### Data-Flow Trace (Level 4)

| Artifact              | Data Variable      | Source                                                                                                           | Produces Real Data                                                                                           | Status  |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| `SignupScreen.tsx`    | `consentRecord`    | `useAppStore((s) => s.consent)` — MMKV-backed Zustand slice                                                      | Yes (real MMKV-persisted store; mocked in tests but the production wiring is intact via the appStore export) | FLOWING |
| `SignupScreen.tsx`    | `termsOpen`        | `useState(false)` initialized in useEffect from `useAppStore.getState().consent`                                 | Yes — mount-time read is deterministic and gates the modal at first render                                   | FLOWING |
| `TermsOfUseModal.tsx` | `agreeEnabled`     | `useState(false)` + `onScroll` handler with real RN ScrollEvent contentOffset/layoutMeasurement/contentSize math | Yes (handler also defensively reads the jsdom DOM-event shape for testability)                               | FLOWING |
| `TermsOfUseModal.tsx` | `translatedBanner` | `t('signup.consent.scrollBanner')` via i18next                                                                   | Yes — all 8 locales have the key with locale-appropriate values                                              | FLOWING |

### Behavioral Spot-Checks

| Behavior                   | Command                                                           | Result                                                                                                                                                                                                                                                                                                                                   | Status |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TermsOfUseModal test suite | `npm test -- --run TermsOfUseModal.test.tsx` (in apps/mobile)     | 9 passed (9) — banner above body, agree disabled→enabled, Linking.openURL spy hit with canonical URL, BackHandler handler returns true, no close affordance, TERMS_OF_USE_TEXT invariant, bilingual underlay invariant                                                                                                                   | PASS   |
| SignupScreen test suite    | `npm test -- --run SignupScreen.test.tsx` (in apps/mobile)        | 8 passed (8) — auto-open with null consent, modal-closed with current consent + checkbox checked, auto-open with stale consent, CTA disabled while consent missing/stale, onAgree persists+closes+enables-CTA, checkbox post-consent no-op + pre-consent re-opens, signInWithGoogle rejection surfaces error, regression baseline render | PASS   |
| Visual snapshot            | `npm test -- --run SignupScreen.visual.test.tsx` (in apps/mobile) | 1 passed (1) — re-baselined snapshot stable                                                                                                                                                                                                                                                                                              | PASS   |
| i18n suite                 | `npm test -- --run i18n` (in apps/mobile)                         | 133 passed (133) across 27 test files — locale catalog parse + key-coverage gates green                                                                                                                                                                                                                                                  | PASS   |
| Repo typecheck             | `pnpm -r --parallel typecheck`                                    | apps/api + shared/types Done; apps/mobile `tsc --noEmit` exit 0                                                                                                                                                                                                                                                                          | PASS   |
| Locale parity check        | `node -e ...` per-locale scrollBanner inequality vs en            | All 7 non-en locales differ from en — no English-fallback regression                                                                                                                                                                                                                                                                     | PASS   |
| LOCKED-doc grep            | `grep -c "Scroll to the bottom" idea-brief.md design-spec.md`     | Returns 0 for both files                                                                                                                                                                                                                                                                                                                 | PASS   |
| Server invariance          | `git diff main..HEAD -- apps/api/src/routes/auth/google.ts`       | Empty diff                                                                                                                                                                                                                                                                                                                               | PASS   |

### Requirements Coverage

| Requirement | Source Plan                    | Description                                                                                                                                             | Status    | Evidence                                                                                                                                                                                                                                                        |
| ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-02     | 260527-hkl-PLAN.md             | Consent modal auto-opens; non-dismissable; Agree disabled until scroll-bottom; CTA disabled until consent persisted                                     | SATISFIED | REQUIREMENTS.md line 22 reworded with 2026-05-27 annotation; behavior verified in Truths #1, #3, #6, #8                                                                                                                                                         |
| AUTH-03     | 260527-hkl-PLAN.md             | Modal renders canonical Terms of Use text, sticky scroll banner, inline Privacy Policy hyperlink, scroll-gated Agree                                    | SATISFIED | REQUIREMENTS.md line 23 reworded with 2026-05-27 annotation; behavior verified in Truths #4, #5, #6; TERMS_OF_USE_TEXT invariant test asserts byte-identity to canonical §5.2                                                                                   |
| I18N-07     | 260527-hkl-PLAN.md             | Bilingual D-32 English underlay on non-English locales for the new sticky banner                                                                        | SATISFIED | TermsOfUseModal.tsx:151-160 renders `consent-scroll-banner-english-underlay` with i18n `getFixedT('en')` payload when `i18nDefault.language !== 'en'`; Invariant B test asserts `Terms of Use English underlay` element present after `changeLanguage('hi-IN')` |
| LEGAL-02    | 260527-hkl-PLAN.md (READ-ONLY) | Server stamps consent_log unconditionally on /auth/google sign-in; client-side change does not affect server invariant                                  | SATISFIED | apps/api/src/routes/auth/google.ts untouched (git diff empty); client persists local MMKV record only; SUMMARY.md decision row #4 documents this disposition                                                                                                    |
| LEGAL-06    | 260527-hkl-PLAN.md (new)       | Consent modal scroll-gated Agree is the on-device gate before the local MMKV consent record is written; server-side persistence (LEGAL-02) is unchanged | SATISFIED | REQUIREMENTS.md line 313 added with `[x]` and 2026-05-27 annotation; trace table line 653 added                                                                                                                                                                 |

### Anti-Patterns Found

| File                  | Line    | Pattern                                                                         | Severity | Impact                                                                                                                                   |
| --------------------- | ------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `TermsOfUseModal.tsx` | 76      | `onClose?: () => void` — optional shim prop accepted but never invoked          | Info     | Documented as temporary backward-compat (lines 67-75); follow-up to tighten is low risk. Not a stub — the actual exit path is `onAgree`. |
| `SignupScreen.tsx`    | 101-105 | `useEffect(..., [])` with empty deps reading store via `useAppStore.getState()` | Info     | Intentional mount-only pattern documented in inline comment + plan known-knobs; mirrors codebase convention                              |

No blocker or warning anti-patterns. Stub-detection grep against the artifacts shows no `TODO`/`FIXME`/`placeholder`/`return null` defects in the new code paths.

### Human Verification Required

#### 1. hi-IN → pt-BR → en hardware walk on Pixel 10a APK

**Test:**

1. Build a fresh `apkRolloutDebug` APK (kill any Metro on :8081 first per [feedback_metro_intercepts_apk_walks](MEMORY.md))
2. Cold install on Pixel 10a; pick **hi-IN** at Language Selection
3. Confirm modal auto-opens on SignupScreen mount
4. Press Android hardware back → modal must NOT close (back is blocked)
5. Tap outside the modal scrim → no-op
6. Confirm sticky banner is visible ABOVE the scrollable body in Devanagari + bilingual English underlay below
7. Tap Privacy Policy link → system browser opens at https://humynlabs.ai/privacy-policy
8. Scroll to the bottom of the modal body → Agree button transitions from grey/opacity 0.4 → fully saturated dark
9. Tap Agree → modal closes; checkbox shows ✓; Continue-with-Google CTA becomes pressable
10. Force-quit + cold-relaunch → modal does NOT re-open (consent record persisted in MMKV); checkbox still shows ✓
11. Repeat the same walk on **pt-BR**: accented characters render cleanly in Latin script (Concordo, Política de Privacidade) without wrap-collapse
12. Repeat on **en** as the baseline regression check
13. `adb logcat | grep -i firebase` while on Agree → confirm `consent_agreed` analytics event fires with `consent_version` extra

**Expected:** All 13 sub-steps PASS on real hardware.

**Why human:** Hardware-only UX behaviors — visual opacity transition timing, real Android BackHandler propagation through the OS event chain, real Linking.openURL handing off to the system browser, real MMKV persistence across cold restart, real Devanagari/accented-character rendering on the 1080×1920 Pixel 10a panel, real Firebase Analytics event dispatch. None of these are exercisable through JSDOM unit tests; the SUMMARY explicitly routes this to /verify out-of-band.

### Gaps Summary

**No automated gaps.** Every must-have in the PLAN frontmatter resolved to VERIFIED:

- Truth-level (Steps 3): 13/13 PASS
- Artifact-level (Step 4 — exists + substantive + wired + data flowing): 12/12 PASS
- Key-link-level (Step 5): 5/5 WIRED
- Requirements coverage: 5/5 SATISFIED (AUTH-02, AUTH-03, I18N-07, LEGAL-02, LEGAL-06)
- Behavioral spot-checks (Step 7b): 8/8 PASS
- LOCKED docs: 0/0 violations (idea-brief.md + design-spec.md untouched)
- Server invariance: API google.ts untouched (server-side LEGAL-02 unchanged)

**Auto-fixed deviations from the plan** (documented in SUMMARY.md "Auto-fixed Issues"):

1. en.json keys added in Task 1's commit (not Task 3 only) — needed for Task 1's tests to render the localized banner; Task 3 then added the other 7 locales as scheduled. Net effect on the codebase is identical.
2. `onClose?` kept optional in `TermsOfUseModalProps` for one cycle — needed for per-task atomic commits to clear project-wide tsc before Task 2 lands. Runtime contract unchanged (the prop is accepted but never invoked).
3. `consent_agreed` added to analytics EVENT_NAMES allowlist — a small surface-area additive change driven by Task 2's call site; the allowlist policy is "code-review-gated", which this verification serves as.
4. `act()` wrap around synthetic scroll event dispatch in unit tests — React 19 + JSDOM batching workaround; not a production-code concern.

None of these change the must-have outcomes; they're justified plumbing choices visible in the diff. The status is `human_needed` (not `passed`) ONLY because of the hi-IN hardware walk, which is the canonical out-of-band step `/verify` routes to the operator per [feedback_hardware_walk_beats_grep_gates](MEMORY.md).

---

_Verified: 2026-05-27T13:25:00Z_
_Verifier: Claude (gsd-verifier)_
