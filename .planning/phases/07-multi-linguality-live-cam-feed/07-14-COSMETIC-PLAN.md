---
phase: 07-multi-linguality-live-cam-feed
plan: 14
type: execute
wave: 2
depends_on: [11]
files_modified:
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md
autonomous: true
gap_closure: true
requirements: [I18N-01, REC-LIVE-01, REC-LIVE-03]
tags: [cosmetic, ui, gap-closure, mobile, layout, design-tokens]
must_haves:
  truths:
    - 'COSMETIC-01 closed: SignupScreen consent text is center-aligned in en locale; the centering does NOT break the bilingual dual-render (D-32) in non-en locales (translated text on top + English underlay at ~70% opacity below stay centered).'
    - "COSMETIC-02 closed: the static 'Live preview' label in RecordingScreen no longer overlaps the Stop button. The label moves to top-LEFT (`{ position: 'absolute', top: <existing>, left: <existing-or-new> }`); the Stop button stays at top-RIGHT (D-28 hit-test invariant). Pointer-events on the label stay `'none'` so the surrounding tap-zone remains hit-routable to the dimmed-state Pressable."
    - 'COSMETIC-03 closed: the lucide `<Eye>` glyph in the dimmed state renders in the accent token (`colors.accent`) — bright orange-ish — visible against the 5%-brightness black surface. WCAG-AA contrast (≥ 4.5:1) verified.'
    - "D-26 spec contract preserved: the label is still in a corner; it's just the LEFT corner (the spec explicitly allows 'top-right (or corner per implementation)')."
    - 'D-27 spec contract preserved: glyph is still a lucide `Eye` at low opacity; only the token color changes; opacity unchanged.'
    - 'D-28 spec contract preserved: Stop button hit-testable in all three visible states; the layout change to the label does not regress hit-testing (verified by the existing 07-07 Pattern-2 z-stack rules).'
    - '07-COSMETIC-GAPS.md status flipped from `open` to `closed` with per-row status updates.'
    - "No new design-token file changes unless the operator's owner-directed color is explicitly not `colors.accent` (in which case a new `colors.dimGlyph` token is added with a doc-comment)."
    - 'iOS untouched (I18N-21); no DB migration (D-16); Phase-6 cosmetic-gaps untouched (I18N-11); Android untouched; HevcEncoder / FinalizeWorker / MetadataComposer untouched; the existing 07-07 live-preview wiring (`<HumynLivePreviewView>` + state machine) untouched.'
  artifacts:
    - path: apps/mobile/src/screens/signup/SignupScreen.tsx
      provides: "Consent paragraph + Terms link with center-aligned styling (textAlign: 'center' + alignSelf: 'center' as appropriate)"
      contains: 'textAlign'
    - path: apps/mobile/src/screens/recording/RecordingScreen.tsx
      provides: 'Live-preview label relocated to top-LEFT corner; Eye glyph color bumped to accent token'
      contains: 'colors.accent'
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md
      provides: 'Status flipped to `closed` with per-row updates'
      contains: 'status: closed'
  key_links:
    - from: apps/mobile/src/screens/signup/SignupScreen.tsx
      to: apps/mobile/src/screens/signup/TermsOfUseModal.tsx
      via: 'Consent paragraph layout — bilingual dual-render (D-32) preserved post-centering'
      pattern: 'consent'
    - from: apps/mobile/src/screens/recording/RecordingScreen.tsx
      to: apps/mobile/src/ui/tokens.ts
      via: 'Eye glyph color = colors.accent (existing token)'
      pattern: 'colors.accent'
---

<objective>
Close the three cosmetic findings from the operator's Pixel-10a §2 + §7 walk
(2026-05-25):

- **COSMETIC-01** — Signup consent text not center-aligned (en locale).
- **COSMETIC-02** — "Live preview" label overlaps Stop button (top-right z-stack collision).
- **COSMETIC-03** — Eye glyph visibility too low in dimmed state (operator: "make it orange").

This is a **Wave-2 plan** in the gap-closure cluster: it MUST serialize AFTER
plan 07-11 because both modify `apps/mobile/src/screens/recording/RecordingScreen.tsx`.
07-11 touches the cue-text lines 414/425/657 (speakCue / showVoiceCue call
sites); 07-14 touches the `<Eye>` color + the `liveLabelCorner` style block.
The acceptance gate `grep -cE "speakCue\\(t\\('recording\\.cue|showVoiceCue\\(t\\('recording\\.cue" apps/mobile/src/screens/recording/RecordingScreen.tsx returns at least 3`
explicitly REQUIRES 07-11 to have landed first — the frontmatter
`depends_on: [11]` + `wave: 2` enforces that scheduling order in the
orchestrator. File-disjoint otherwise from plans 07-10 (native live-preview
debug — touches `livepreview/` + `capture/CaptureSession.kt`), 07-12 (taskCatalog
body), 07-13 (Help Center body).

> **Wave ordering (POST-CHECKER-REV):** Wave 1 = {07-10, 07-11, 07-12, 07-13}
> (file-disjoint inside Wave 1). Wave 2 = {07-14} (depends on 07-11's
> RecordingScreen.tsx diff landing). 07-15 picks up its own wave (Wave 3 — the
> re-walk + verification refresh).

Per memory `feedback_functionality_first_during_smoke.md`, cosmetic fixes go
in a discrete plan, NOT mid-walk. This is that plan.

**Non-negotiable invariants:**

- `git diff --stat apps/mobile/ios/` MUST remain empty (I18N-21).
- `git diff --stat apps/api/drizzle/migrations/` MUST remain empty (D-16).
- `06-COSMETIC-GAPS.md` MUST remain untouched (I18N-11).
- `git diff --stat apps/mobile/android/` MUST remain empty.
- The 07-07 live-preview wiring (`<HumynLivePreviewView>` mount, brightness state machine, `LivePreviewSurfaceRegistry` consumers) MUST remain UNCHANGED — only the LABEL position + the EYE GLYPH color move; the underlying state machine + Surface lifecycle stay.
- The 07-05 bilingual consent rendering (D-32 — translated on top + English underlay at ~70% opacity for non-en) MUST keep working post-centering; verify by reading the SignupScreen.tsx render block AND TermsOfUseModal.tsx (which already does this for the modal).

Output: a build in which the en-locale Signup screen renders the consent block centered, the Recording screen's "Live preview" label sits in the top-LEFT corner (Stop stays top-right), and the Eye glyph in the dimmed state is visibly orange.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-07-live-preview-native-and-recording-screen-PLAN.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-07-SUMMARY.md
@apps/mobile/src/screens/signup/SignupScreen.tsx
@apps/mobile/src/screens/signup/TermsOfUseModal.tsx
@apps/mobile/src/screens/recording/RecordingScreen.tsx
@apps/mobile/src/ui/tokens.ts
@CLAUDE.md

<interfaces>
<!-- Existing shapes the executor must respect. -->

From apps/mobile/src/screens/signup/SignupScreen.tsx (existing — the consent block; see lines 220-240 area):

- The consent paragraph reads `t('signup.consentLabelPrefix')` + a Pressable wrapping `t('signup.consentLink')` (Terms-of-Use link).
- Below it in non-en locales: the English underlay via `i18n.getFixedT('en')('signup.consent.paragraph')` at 70% opacity (D-32 from plan 07-05).
- The current container styling lacks consistent `textAlign: 'center'` or `alignSelf: 'center'`.

From apps/mobile/src/screens/recording/RecordingScreen.tsx (existing — the z-stack from plan 07-07's Pattern 2):

```tsx
{
  /* "Live preview" label — D-26 — visible during initial-preview + tap-revealed */
}
{
  brightnessState === 'initial-preview' || brightnessState === 'tap-revealed' ? (
    <View style={styles.liveLabelCorner} pointerEvents="none">
      <Text variant="caption">{t('recording.preview.live')}</Text>
    </View>
  ) : null;
}
```

The `styles.liveLabelCorner` is defined in the StyleSheet block — currently uses `top: 16, right: 16` (or similar). Move to `top: 16, left: 16`.

```tsx
{
  /* Eye-icon glyph — D-27, dimmed state only */
}
{
  brightnessState === 'dimmed' ? (
    <View style={styles.eyeIconCorner} pointerEvents="none">
      <Eye color={colors.text3} size={24} />
    </View>
  ) : null;
}
```

Change `colors.text3` to `colors.accent`.

From apps/mobile/src/ui/tokens.ts (existing):

- `colors.accent` is the brand orange/amber used throughout the app.
- `colors.text3` is a low-contrast neutral.
- The contrast ratio of `colors.accent` against `#000000` (dimmed-state background) needs to be ≥ 4.5:1 (WCAG AA). The brand orange typically satisfies this.
  </interfaces>
  </context>

<tasks>

<task type="auto">
  <name>Task 1: Apply all three cosmetic fixes (COSMETIC-01 / 02 / 03) + update 07-COSMETIC-GAPS.md status + JS test coverage</name>
  <files>apps/mobile/src/screens/signup/SignupScreen.tsx, apps/mobile/src/screens/recording/RecordingScreen.tsx, .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md (the three open findings + their proposed fixes)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md ## Gaps COSMETIC-01..03
    - apps/mobile/src/screens/signup/SignupScreen.tsx (the consent block — find the Pressable wrapping the consent label + Terms link; identify the container's style block)
    - apps/mobile/src/screens/signup/TermsOfUseModal.tsx (the modal whose dual-render pattern we're not breaking — confirm where the `signup.consent.paragraph` key is read for the underlay)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx (lines 650-720 area — the Pattern-2 z-stack from plan 07-07; locate the `styles.liveLabelCorner` and `styles.eyeIconCorner` style definitions; locate the Eye color prop)
    - apps/mobile/src/ui/tokens.ts (confirm `colors.accent` exists and its hex; verify WCAG-AA contrast against `#000000`)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-07-live-preview-native-and-recording-screen-PLAN.md (the Pattern-2 z-stack reference — confirm we're touching ONLY the styles and the Eye color prop, NOT the live-preview state machine or the `<HumynLivePreviewView>` mount lifecycle)
  </read_first>
  <behavior>
    - **COSMETIC-01 (SignupScreen)** — add `textAlign: 'center'` to the consent paragraph's `Text` style AND `alignSelf: 'center'` to its container's View style (whichever combination is needed to center both the English literal AND the translated text). The dual-render block (when non-en locale: translated + 70%-opacity English underlay) MUST stay center-aligned across BOTH lines. Verify the Pressable around the Terms link inherits the centering or has its own `textAlign: 'center'`.
    - **COSMETIC-02 (RecordingScreen label)** — change `styles.liveLabelCorner` from `right: <px>` to `left: <px>` (preserve the `top: <px>` value). The Stop button's container style stays UNCHANGED — it remains top-RIGHT. Verify pointerEvents on the label View is still `'none'` so taps pass through.
    - **COSMETIC-03 (RecordingScreen Eye glyph)** — change `<Eye color={colors.text3} size={24} />` to `<Eye color={colors.accent} size={24} />`. If the existing `Eye` import is missing, verify it's still imported from `lucide-react-native`. The opacity styling on the surrounding View (if any) stays UNCHANGED — D-27 mandates "low opacity (token-defined)" and the existing token controls opacity, not color.
    - **07-COSMETIC-GAPS.md** — flip the file's `status:` frontmatter from `open` to `closed`. Update each of the three table rows from `OPEN` to `CLOSED — Plan 07-14 / {commit-hash}` (the executor fills the commit hash after the cleanup commit).
    - **Existing 07-07 wiring stays intact:** the `<HumynLivePreviewView>` mount lifecycle, the `useLivePreviewStateMachine` hook, the brightness state machine, the Pressable tap-zone, the StopButton — all UNCHANGED by this plan. Verify with grep.
    - **Existing 07-05 D-32 bilingual rendering stays intact:** the `i18n.getFixedT('en')('signup.consent.paragraph')` underlay (or wherever D-32 is realized in SignupScreen) keeps working in non-en locales.
    - **Existing 07-11 cue-translation stays intact:** the speakCue/showVoiceCue calls at lines 414/425/657 of RecordingScreen.tsx stay as `t('recording.cue.started/stopped')` — verify with grep. **NOTE (POST-CHECKER-REV):** Because this plan is now `wave: 2` with `depends_on: [11]`, 07-11 has ALREADY landed when this task runs; the grep gate is therefore enforceable as a pre-condition, not an optimistic guard.
  </behavior>
  <action>
1. **COSMETIC-01 (SignupScreen):**

Read `apps/mobile/src/screens/signup/SignupScreen.tsx` to find the consent block. It will look approximately like:

```tsx
<View style={styles.consentBlock}>
  <Text style={styles.consentText}>
    {t('signup.consent.paragraph') /* or consentLabelPrefix */}
  </Text>
  {/* in non-en: English underlay at 70% opacity per D-32 */}
  {!isEnglish && (
    <Text style={[styles.consentEnglishUnderlay, { opacity: 0.7 }]}>
      {i18nDefault.getFixedT('en')('signup.consent.paragraph')}
    </Text>
  )}
</View>
```

Add to the StyleSheet block (or modify the existing entries):

```typescript
consentBlock: {
  // ... existing fields ...
  alignSelf: 'center',
  alignItems: 'center',
},
consentText: {
  // ... existing fields ...
  textAlign: 'center',
},
consentEnglishUnderlay: {
  // ... existing fields ...
  textAlign: 'center',
},
```

If the existing styles already have some of these fields (e.g. one had `textAlign: 'left'`), REPLACE — do not duplicate. Verify with `grep -n "textAlign" apps/mobile/src/screens/signup/SignupScreen.tsx` afterward.

If there's a Pressable wrapping the Terms-link line, add `alignSelf: 'center'` to its style too so the link sits centered.

2. **COSMETIC-02 (Live-preview label position):**

   In `apps/mobile/src/screens/recording/RecordingScreen.tsx`, find the StyleSheet block (typically at the bottom of the file). Locate `liveLabelCorner` (or the named style applied to the live-preview label View):

   ```typescript
   liveLabelCorner: {
     position: 'absolute',
     top: 16,
     right: 16, // <-- CHANGE THIS
     // ...
   },
   ```

   Change `right: 16` to `left: 16`. Preserve all other fields.

   Verify the Stop button container (typically `stopButtonContainer` or similar) is still at `top: 16, right: 16` — DO NOT touch it.

3. **COSMETIC-03 (Eye glyph color):**

   Find the `<Eye>` glyph render in RecordingScreen.tsx (from plan 07-07's Pattern 2):

   ```tsx
   <Eye color={colors.text3} size={24} />
   ```

   Change to:

   ```tsx
   <Eye color={colors.accent} size={24} />
   ```

   That's the entire change. Do NOT touch the surrounding View's opacity or the conditional render gating (`brightnessState === 'dimmed'`).

4. **Verify the WCAG-AA contrast** of `colors.accent` against `#000000`:

   ```bash
   grep -nE "accent:|accent: " apps/mobile/src/ui/tokens.ts
   ```

   Read the hex value (e.g. `#FA672A`). Compute the contrast ratio against `#000000` mentally OR use a quick approximation: any color in the orange/amber/yellow band has a relative luminance > 0.30, giving a contrast ratio against pure black > 7:1 (well above AA 4.5:1 and even AAA 7:1). Document the hex in `07-COSMETIC-GAPS.md` COSMETIC-03 closure note.

   If `colors.accent` is unexpectedly low-contrast (< 4.5:1), STOP — the owner directive said "orange" specifically; add a new token `colors.dimGlyph` to `tokens.ts` with a hex that satisfies AA contrast, and reference it from the Eye glyph render instead. (Unlikely path; the brand orange satisfies AA.)

5. **Update 07-COSMETIC-GAPS.md:**

   - Change frontmatter `status: open` → `status: closed`.
   - Update the STATUS table rows from `OPEN` to `CLOSED — Plan 07-14 / {commit-hash}` for each of #1, #2, #3. (Use `{commit-hash}` as a placeholder; the executor fills it in after the commit.)
   - Optionally add a "Closure trail" section at the bottom referencing the commit hash and the date.

6. **Run the JS test suite** (per memory `feedback_post_merge_test_env.md`):

   ```bash
   set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
   ```

   Confirm exit 0. The existing SignupScreen tests + RecordingScreen tests should pass with the layout changes (they're snapshot/structural; if a snapshot needs updating, use `pnpm test -- -u` and visually verify the diff is purely the style change).

7. **Run the APK build:**

   ```bash
   cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug 2>&1 | tail -10
   ```

   BUILD SUCCESSFUL.

8. **Invariant checks:**
   - `git diff --stat apps/mobile/ios/` empty
   - `git diff --stat apps/api/drizzle/migrations/` empty
   - `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty
   - `git diff --stat apps/mobile/android/` empty
   - `git diff --stat apps/mobile/src/i18n/` empty (no i18n changes in this plan; plan 07-11 owns those)
   - `git diff --stat apps/mobile/src/screens/help/` empty (plan 07-13 owns that)
   - `git diff --stat apps/mobile/src/native/HumynLivePreviewView.tsx apps/mobile/src/lib/livePreviewState.ts` empty (plan 07-07 / 07-10 own those)
   - **Plan-07-07-wiring intact:** `grep -c "useLivePreviewStateMachine" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1; `grep -c "<HumynLivePreviewView" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1.
   - **Plan-07-11-wiring intact (pre-condition gate — 07-11 must have landed before this plan runs per `depends_on: [11]`):** `grep -cE "speakCue\\(t\\('recording\\.cue|showVoiceCue\\(t\\('recording\\.cue" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 3.
     </action>
     <verify>
     <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -15</automated>
     </verify>
     <acceptance_criteria>
   - `grep -c "textAlign: 'center'" apps/mobile/src/screens/signup/SignupScreen.tsx` returns at least 1 (consent text centering).
   - `grep -cE "alignSelf: 'center'|alignItems: 'center'" apps/mobile/src/screens/signup/SignupScreen.tsx` returns at least 1 (consent block container centering).
   - `grep -cE "liveLabelCorner:.*\\n.*position: 'absolute'|left: 16" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1 (label position moved to left).
   - `grep -c "right: 16" apps/mobile/src/screens/recording/RecordingScreen.tsx | head -1` — counts the Stop button container's `right: 16`; expected to still be at least 1 (Stop unchanged).
   - `grep -c "<Eye color={colors.text3}" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns 0 (old color removed).
   - `grep -c "<Eye color={colors.accent}" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1 (new accent color applied).
   - `grep -c "status: closed" .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md` returns at least 1 (frontmatter flipped).
   - All three table rows in 07-COSMETIC-GAPS.md STATUS table show `CLOSED — Plan 07-14`: `grep -c "CLOSED — Plan 07-14" .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md` returns at least 3.
   - Plan-07-07 wiring intact: `grep -c "useLivePreviewStateMachine" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1.
   - Plan-07-11 wiring intact (Wave-2 pre-condition gate): `grep -cE "speakCue\\(t\\('recording\\.cue|showVoiceCue\\(t\\('recording\\.cue" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 3.
   - All four invariant gates green: `git diff --stat apps/mobile/ios/ apps/api/drizzle/migrations/ .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md apps/mobile/android/` all empty.
   - `git diff --stat apps/mobile/src/i18n/ apps/mobile/src/screens/help/ apps/mobile/src/native/HumynLivePreviewView.tsx apps/mobile/src/lib/livePreviewState.ts` all empty.
   - Test suite exit 0, APK build BUILD SUCCESSFUL.
     </acceptance_criteria>
     <done>All three cosmetic findings closed at code level. 07-COSMETIC-GAPS.md status flipped to closed. Plan-07-07 + plan-07-11 wiring intact. Pixel-10a hardware re-walk of §3 + §7 + §8 happens in plan 07-15.</done>
     </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                  | Description                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Layout token changes → user-facing visual | Cosmetic token changes affect what the user sees but no security boundary. |

## STRIDE Threat Register

| Threat ID  | Category          | Component                                 | Disposition | Mitigation Plan                                                                                                                                                                           |
| ---------- | ----------------- | ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-14-01 | Tampering         | Eye glyph token change to `colors.accent` | accept      | The token is a brand color used in 30+ places; changing one usage doesn't expand attack surface. Visibility-increase is intentional per owner directive.                                  |
| T-07-14-02 | Denial-of-Service | Live-preview label position change        | mitigate    | Position move from right to left; pointerEvents on the label stays `'none'`; the Stop button hit-zone (top-right) is unchanged. Plan-07-07 z-stack rules from Pattern 2 are not modified. |
| T-07-14-03 | Spoofing          | Consent-block centering                   | accept      | Layout-only change; no functional effect on the legal consent record (D-33 — server-side `consent_text_version` stays canonical English regardless of layout).                            |

</threat_model>

<verification>
1. `pnpm -r --parallel test --filter "@humyn/mobile"` exits 0.
2. `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` BUILD SUCCESSFUL.
3. `grep` evidence for the three fixes per the acceptance-criteria block.
4. All 4 invariant gates green.
5. Plan-07-07 + plan-07-11 wiring intact (grep evidence).
</verification>

<success_criteria>

- COSMETIC-01 closed.
- COSMETIC-02 closed (Stop hit-test invariant intact).
- COSMETIC-03 closed.
- 07-COSMETIC-GAPS.md flipped to status: closed.
- Plan-07-07 + plan-07-11 wiring intact.
- All invariants green.
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-14-SUMMARY.md` documenting:
- The diff snapshot for each of the three fixes (grep evidence + file:line).
- The chosen color token + its hex + WCAG-AA contrast ratio against `#000000`.
- Confirmation that 07-COSMETIC-GAPS.md is now status: closed.
- Pointer to plan 07-15 §3 + §7 + §8 for the operator's hardware re-walk verification.
</output>
</output>
