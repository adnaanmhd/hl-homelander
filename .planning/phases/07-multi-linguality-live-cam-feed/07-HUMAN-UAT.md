---
status: partial
phase: 07-multi-linguality-live-cam-feed
source: [07-VERIFICATION.md]
started: 2026-05-25T05:15:00Z
updated: 2026-05-25T19:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. §1 i18n bootstrap on fresh install

expected: All six §1 PASS rows checked — Pixel 10a fresh APK install: 8 rows in D-18 order, native+English name presentation (D-19), English pre-selected, Continue→Signup (no back), cold relaunch does NOT re-render ChooseLanguage, tokens-only grep gate (I18N-03)
result: PASS — Pixel 10a 5C161JEA304304 / Android 16 / apkRolloutDebug, 2026-05-25; 8 rows D-18 order confirmed, D-19 native+English presentation confirmed, English pre-selected, Continue→Signup with no back-gesture return, force-stop + cold-launch landed on Signup (ChooseLanguage suppressed by `locale.chosen_at` MMKV key), tokens-only grep gate returned 0 hex literals in ChooseLanguageScreen.tsx + LanguageList.tsx.

### 2. §2 Profile language picker per-locale walk (post-07-09 add-on)

expected: All 7 non-English locales PASS plus `locale_changed` ring-buffer event firing AND Profile + Delete-Account fully translated. For each of pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN: sheet auto-dismiss + translated re-render within 1 frame + persists across cold-launch + locale_changed telemetry ring entry in logcat. **AFTER 07-09 CLOSURE:** also verify ProfileScreen labels (Name/Age/Gender/Joined/Help Center/Logout/Delete account/tap to edit/payments/lifetime captions) AND the Delete Account modal (both steps + DELETE-input flow) render fully in the selected locale.
result: PARTIAL — Pixel 10a 5C161JEA304304, 2026-05-25, hi-IN selected on-device. **Picker-UX subset PASS:** MMKV `humyn.locale.code=hi-IN` after picker tap (sheet auto-dismiss + commit verified), `locale_changed` logEvent path clean (no `[analytics] logEvent failed` in logcat → ring-buffer write fired), force-stop + cold-launch preserved hi-IN. **Translation-completeness criterion FAIL:** operator observed extensive untranslated surfaces — CompatCheckScreen labels (G-02), RotatePrompt practice copy (G-03), TTS audio cue (G-04 — ambiguous text-vs-voice), HomeScreen hero (G-05), tab bar labels Home/Tasks/History (G-06), History time-filter chips (G-07), TasksScreen task data name/category/description/instructions (G-08), session history rows (G-09), entire HelpCenter body (G-10). Per owner directive 2026-05-25, compressed: did not loop the picker walk for all 7 non-English locales (the gap is structural, not per-locale). Wave-2 plan (07-10 candidate) to extend the sweep + re-walk §2-§6 after gap closure. See `## Gaps` for inventory.

### 3. §3 Bilingual consent rendering

expected: All four §3 PASS rows checked — pt-BR + hi-IN active locale: Signup consent paragraph + Terms-of-Use modal show translated text on top + English at ~70% opacity below; server-side `consent_text_version` stays canonical English; English locale shows single-body (no duplicate)
result: CODE-VERIFIED PASS — grep-confirmed dual-render wiring at SignupScreen.tsx:229,236 (consent-label + Terms-link English underlays) and TermsOfUseModal.tsx:47/76/79 (`englishUnderlay = i18nDefault.getFixedT('en')('terms.consent.body')` rendered below translated body). Plan 07-05 SUMMARY confirms D-32/D-33 byte-parity verified at ship. Operator did NOT directly visually verify dual-render on hardware in pt-BR or hi-IN (was on Signup only briefly during §1→§2 transition, reported COSMETIC-01 alignment issue but not dual-render absence/presence). Compressed per owner directive 2026-05-25 — full on-hardware visual deferred to Wave-2 re-walk after gap closure. Server-side `consent_text_version` canonical-English contract = code-verified in CR-01 prior commits + unchanged by 07-09.

### 4. §4 Per-locale TTS on Pixel 10a

expected: All 8 locale-voice rows PASS plus fallback case. For each of pt-BR / es / hi-IN / bn-IN / ta-IN / te-IN / mr-IN with the engine installed: "Recording started" cue plays in the active locale; uninstalled locale falls back to en-US AND emits Crashlytics `tts_locale_fallback` breadcrumb; English locale preserves owner-deviation voice
result: PENDING — will be folded into §7/§9 recording walks (the operator records 2× 10-min in §9 for A/B drift, both recordings will fire the TTS cue and we'll observe what voice plays in hi-IN). Pre-flight observation under G-04: operator reported audio cue "still in English" — to be disambiguated as text-vs-voice during §7. Crashlytics fallback breadcrumb path (5-step chain in ttsVoice.ts) is code-verified via prior CR; on-hardware fallback observation deferred.

### 5. §5 Date formatting + Latin numerals

expected: All five §5 PASS rows checked — hi-IN: Devanagari month name + Latin 0-9 digits in History day-header (NOT Devanagari numerals); pt-BR Portuguese month form; all 4 Indic locales render locale-appropriate month + Latin digits; Profile Joined date locale-formatted
result: PASS — hi-IN on Pixel 10a, 2026-05-25. Operator visually confirmed Profile "Joined" date renders both (a) Devanagari month name AND (b) Latin digits 0-9 (NOT Devanagari numerals). dates.ts grep-confirmed `Intl.DateTimeFormat(locale, { dateStyle: 'medium', numberingSystem: 'latn' })` at line 58-62 — D-36 + D-37 properly wired. Compressed per owner directive 2026-05-25 — full per-locale loop (pt-BR / 4 Indic / en) skipped since the latn forcing is structurally locale-independent and the hi-IN case is the strictest one (Devanagari script has its own numerals, so latn-forcing actively changes the output — pass here implies pass elsewhere).

### 6. §6 Reverse-search task query + full body translation

expected: All §6 PASS rows checked — hi-IN active: TasksScreen shows translated task names where present; search "चाय बनाओ" surfaces Make tea (Stage 1); "बनाओ" surfaces token-fallback matches (Stage 2); random Hindi returns zero (Stage 3 degraded-OK); TaskDetailsSheet shows full Hindi body (name + description + instructions + examples); pt-BR Stage 1 "fazer chá" → Make tea
result: DEGRADED-FAIL per D-15 + G-08 — reverseSearch.ts code-verified (3-stage chain wired at apps/mobile/src/i18n/reverseSearch.ts:52-80), but reverseSearch.ts:23-28 documents the SKELETON-PHASE: "until the LLM regen tool populates the 7 non-English entries in taskCatalog.i18n.ts, the localized name === the English name for every task". The hi-IN `taskCatalog.i18n.ts` body therefore matches G-08 (task names + categories + descriptions + instructions in English while locale = hi-IN — operator-observed). Stage 1 "चाय बनाओ" cannot hit because the hi-IN catalog doesn't have it as a localized entry — by D-15 design. PT-BR has the same skeleton-English state (the 07-06 SUMMARY documents 7 skeleton entries; the operator's observation that ALL task data is English suggests the scope of the skeleton-state may be broader — Wave-2 plan-time verification). Compressed per owner directive 2026-05-25; full §6 walk is blocked on the LLM-regen step (I18N-05, deferred from Phase 7 per ROADMAP).

### 7. §7 Live-cam preview — initial 15-s window + practice-flow D-05

expected: All six §7 PASS rows checked — real flow: 15-s full-screen ultrawide preview at system brightness with static translated "Live preview" indicator; fades to dimmed state with Eye glyph bottom-right; Stop hit-testable during preview; practice flow: practice instructional copy MUST NOT render during the 15-s preview window; translated label in non-English locale
result: FAIL (mixed) — Pixel 10a hi-IN, 2026-05-25 real-flow walk:
• PASS row 1 (15-s preview renders + fades): **FAIL** — G-11 surface never renders camera frames; the label timer transitions correctly (label visible 15s → hides → reappears 10s on tap) but the actual ultrawide camera Surface remains black/blank throughout. Logcat shows zero `HumynLivePreview` / `CaptureSession` activity + Camera HAL `Camera3-PreviewFrameSpacer: queueBufferToClientLocked: Failed to queue buffer to client: Broken pipe(-32)` at 12:12:30 (suspected: native HumynLivePreviewView surface attachment never completes). Fade-to-dim transition not observable (G-12 — dimming a black surface is imperceptible; brightness machine may still be firing but has no visual feed to dim).
• PASS row 2 (Practice D-05 copy not during preview): **UNVERIFIED** — deferred to Wave-2 re-walk per owner directive 2026-05-25 (low signal value while G-11 unfixed; D-05 contract is meaningless on a blank-surface 15-s window).
• PASS row 3 (Stop hit-testable during initial-preview state): **PASS** — operator tapped Stop during the chrome-visible state; recording stopped + returned to MainTabs.
• PASS row 4 (Static "Live preview" indicator no per-second numeral): **PASS** — confirmed static text, no countdown.
• PASS row 5 (Eye glyph bottom-right of dimmed state): **PARTIAL** — glyph present, but visibility too low to be useful (operator UX feedback: "make it orange so that it's visible" — COSMETIC-03).
• PASS row 6 (Translated label in hi-IN): **FAIL** — label rendered in English on hi-IN; same root cause as G-05 i18n sweep gaps.
**Verdict:** §7 FAIL. Central gating row (preview rendering) blocks the whole §7 acceptance. G-11 + COSMETIC-02 + COSMETIC-03 logged.

### 8. §8 Tap-reveal rolling 10-s + Stop hit-test all 3 states + brightness restore

expected: All five §8 PASS rows checked — from dimmed: tap restores preview at system brightness for 10 s; subsequent tap at ~5 s extends to ~10 s (rolling, NOT accumulating); Stop hit-testable in dimmed AND tap-revealed states; brightness restores to system on Stop/unmount
result: [pending]

### 9. §9 BLOCKING A/B drift smoke (REC-LIVE-05 / D-04)

expected: delta < 0.50 → phase sign-off unblocked; delta >= 0.50 → BLOCKER, plan 07-07 CaptureSession.kt must be reverted to Option A (Surface splitter via GL). Pixel 10a, room temperature, same-device + same-day + same-scene: 10-min recording with preview OFF + 10-min recording with preview ON; extract `imu_video_drift_p99_ms` from metadata.json; compute delta = (p99_ON − p99_OFF) / p99_OFF.
result: [pending]

### 10. §10 Capture-quality cancel gates UNCHANGED

expected: All five §10 PASS rows checked — forced `fps_dropped` (cover lens for 60s+) shows "Canceled — frame rate dropped" chip + segment NOT in upload queue + translated copy in hi-IN; `insufficient_frames` (stop within 1s) shows "Canceled — recording too short"; cancel works with preview ON and preview OFF
result: [pending]

## Summary

total: 10
passed: 3
issues: 3
pending: 4
skipped: 0
blocked: 0

## Gaps

- COSMETIC-01 — Signup consent text not center-aligned (en locale, observed 2026-05-25 during §2 sign-in prep, Pixel 10a / Android 16 / apkRolloutDebug). Functional path unaffected; deferred to Phase-7 Wave-2 cosmetic-gaps sweep (analog to 02-COSMETIC-GAPS / 04-COSMETIC-GAPS / 06-COSMETIC-GAPS pattern). Re-inspect during §3 once dual-rendering walk reaches the Signup screen in pt-BR + hi-IN.
- G-02 — CompatCheckScreen LABELS remain in English while locale = hi-IN (Pixel 10a, 2026-05-25 during §2 onboarding walk). Operator confirmed "labels", not values — so this is NOT the codec-string / API-constant carve-out; it is a translation completeness gap. The 07-09 sweep scope was ProfileScreen + DeleteAccountModal only — CompatCheckScreen was NOT enumerated and was not swept. Material to §2 PASS as a whole (runbook: "Each cycle should show translated copy on every screen visited"). Action: spin a follow-on plan (07-10 candidate, post-walk) to extend the i18n sweep into CompatCheckScreen — add label keys to en.json + 7 locale catalogs + wire `t(...)` call sites. Defer for Wave-2; do NOT rebuild mid-walk. §2 PASS-vs-FAIL verdict to be decided at wrap-time based on full per-locale results.
- G-03 — **Practice tutorial "Rotate to landscape and mount on rig" hardcoded English** (Pixel 10a, hi-IN active, 2026-05-25). Grep-confirmed: `apps/mobile/src/screens/recording/components/RotatePrompt.tsx:108` has the literal JSX string `Rotate to landscape and mount on rig` — NOT wrapped in `t()`. The file comment at line 11 even labels it "verbatim label", suggesting an intentional carve-out that should have been undone during the i18n sweep. Wave-2 fix: replace with `{t('recording.rotatePrompt')}` + add the key to all 8 catalogs.
- G-04 — **TTS cue text literally in English source** (Pixel 10a, hi-IN active, 2026-05-25). Operator reported "Recording Started" / "Recording Stopped" audio cue still in English. Grep-confirmed: `apps/mobile/src/screens/recording/RecordingScreen.tsx:414/425/657` calls `speakCue('Recording started')` / `'Recording stopped'` with literal English strings. AMBIGUITY: 07-MANUAL-SMOKE §4 might intend voice-in-locale (TTS engine speaks the English phrase with the locale's voice/accent) rather than translated text — but the operator's report suggests neither the voice NOR the text is in hi-IN. Need to disambiguate during a re-walk: is the issue (a) wrong VOICE engine selected (English voice, not Hindi voice) → §4 fallback failure, OR (b) text should have been translated → §4 text-translation gap. Wave-2 ACTION: clarify §4 spec intent; if text-should-translate, replace literals with `t('recording.cue.started')` keys; if voice-should-locale, fix `ttsVoice.ts` pickAndSetLocaleVoice() fallback chain.
- G-05 — **HomeScreen hero section in English while locale = hi-IN** (Pixel 10a, 2026-05-25). Operator-reported; needs grep confirmation in Wave-2 plan-time (likely missing `t()` call sites in the hero card content).
- G-06 — **Tab labels (Home/Tasks/History) in English while locale = hi-IN** (Pixel 10a, 2026-05-25). Operator-reported on MainTabs tab bar. Wave-2: locate the navigation/tab-bar config and wire label-translations.
- G-07 — **History screen time-filter chips in English while locale = hi-IN** (Pixel 10a, 2026-05-25). Operator-reported on History tab. Wave-2: HistoryScreen.tsx time-filter component.
- G-08 — **TasksScreen task names + categories + descriptions + instructions in English while locale = hi-IN** (Pixel 10a, 2026-05-25). Operator-reported. BROADER than the 7 skeleton-English carve-out documented in 07-06 SUMMARY (which only covers 7 of 86 catalog rows). Suspect: either the 86-row `taskCatalog.i18n.ts` shape is correct but the screen call sites aren't reading the active-locale entry, OR the hi-IN catalog body is missing real translations for far more than the 7 carve-outs. Wave-2 plan-time: verify (a) the screen call sites correctly read from `taskCatalog.i18n.ts[locale][slug]`, and (b) the hi-IN catalog actually has translated values for the non-carve-out 79 tasks. **This also fails §6 (reverse-search + full body translation) acceptance.**
- G-09 — **Session history rows in English while locale = hi-IN** (Pixel 10a, 2026-05-25). Operator-reported. Wave-2: identify the HistoryScreen row rendering (status chips, action labels, "Verified" / "Pending" / "Failed" copy) and wire `t()` calls.
- G-10 — **Entire Help Center body in English while locale = hi-IN** (Pixel 10a, 2026-05-25). Grep-confirmed: `apps/mobile/src/screens/help/HelpCenterScreen.tsx` has 4 `t()` calls (chrome only) but `apps/mobile/src/screens/help/content.json` + `markdown.tsx` have **0** `t()` calls — the article content is loaded from a single English-only JSON. Wave-2: this is a larger LP-style sweep (8 catalogs × ~20 articles); may need to be its own discrete plan since it's bulk content translation, not call-site wiring.

## Wave-2 Synthesis

The 07-09 i18n sweep covered ProfileScreen + DeleteAccountModal only — leaving many surfaces unswept. Gaps G-02 through G-10 are all material to SC#1 ("new language takes effect immediately across all 23 screens") and the runbook §2 "every screen visited" criterion. §2 picker-UX subset PASSED (sheet auto-dismiss + 1-frame re-render + cold-launch persistence + `locale_changed` telemetry); §2 full-translation criterion FAILED. §3-§6 are largely blocked by the same root cause (incomplete sweep) — to be re-walked after Wave-2 lands. §7-§10 are i18n-independent and walked fully on this pass.

Recommended Wave-2 plan name (07-10 candidate): "Extend i18n sweep to unenumerated surfaces + Help Center content translation."

- **G-11 — Live-cam preview Surface never renders camera frames (Pixel 10a, hi-IN, 2026-05-25, apkRolloutDebug, real recording flow).** REC-LIVE-01 hard FAIL on the central §7 gating PASS row. Symptoms: the `<HumynLivePreviewView>` chrome paints correctly (the static "Live preview" label appears for 15 s, hides, reappears 10 s on tap — timer state machine intact), but the actual ultrawide camera SurfaceTexture/SurfaceView is always black/blank — no frame data ever displayed. Logcat shows ZERO `HumynLivePreview` / `LivePreviewSurfaceRegistry` / `CaptureSession` activity AND Google Camera HAL emits `Camera3-PreviewFrameSpacer: queueBufferToClientLocked: Failed to queue buffer to client: Broken pipe(-32)` (suggesting the consumer side of the preview Surface closed unexpectedly OR was never attached). Suspect: Plan 07-07's `LivePreviewSurfaceRegistry` / `CaptureSession.kt:620-689` Option-B two-Surface implementation either fails to register the second Surface OR the JS-side native view ref doesn't propagate the SurfaceTexture handle to the registry. Wave-2: native Camera2 debug session (analog to `handgate-never-passes`) to localize whether (a) the second Surface is being added to the CaptureRequest target list at all, (b) the Surface IS added but the consumer closes immediately, or (c) the JS bridge never delivers the SurfaceTexture to the native module. **Impact on §9 A/B drift gate:** if the native side never attaches the second Surface, the "preview ON" treatment is effectively identical to the "preview OFF" baseline — the A/B gate becomes meaningless (delta ≈ 0 by construction). §9 will still be walked and metadata extracted, but the result MUST be interpreted with G-11 caveat (a passing delta gate doesn't prove Option-B is safe; it might prove Option-B never engaged).
- **G-12 — Fade-to-dim brightness transition not observable.** Operator reported "screen remains as is, no transition" after the 15-s window. Likely-not-a-real-bug: with G-11 leaving the Surface black/blank, dimming a black surface to 5% brightness is visually indistinguishable from 100% brightness. The `createLivePreviewStateMachine` timer IS firing correctly (label appears/hides at the right intervals), so the brightness setter call is probably happening — just imperceptible. Re-verify post-G-11 fix; do not classify as a real-bug until G-11 is closed.
- **COSMETIC-02 — Top-right z-stack: "Live preview" label overlaps with the X / Stop button** (Pixel 10a, hi-IN, 2026-05-25). The static "Live preview" indicator and the Stop button render on top of each other in the top-right corner. Wave-2 fix: separate the layout (move label to top-LEFT or shrink z-overlap; spec D-26 says "top-right (or corner per implementation)" — implementation chose top-right but collided with the existing Stop placement).
- **COSMETIC-03 — Eye glyph visibility too low** (Pixel 10a, 2026-05-25, dimmed-state attempt). Operator UX feedback: "make it orange so that it's visible". Current implementation likely renders the lucide `Eye` glyph in a low-contrast neutral token; against a black/dimmed background it's hard to find. Wave-2: bump to a brighter accent token (orange / amber); ensure WCAG-AA contrast against the dimmed-state black background.
