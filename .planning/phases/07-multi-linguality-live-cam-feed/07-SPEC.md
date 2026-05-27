# Phase 7: Multi-linguality & Live-Cam Feed — Specification

**Created:** 2026-05-24
**Ambiguity score:** 0.07 (gate: ≤ 0.20)
**Requirements:** 21 locked

## Goal

Ship the app in 8 languages (English, pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN) end-to-end across UI copy + device-TTS audio cues + locale-aware date formatting (language chosen once at first launch on a new Choose-Language screen, changeable in Profile); and add a live ultrawide camera feed during recording (15 s automatically after Start, then rolling 10 s on tap) — without regressing the recorded `imu_video_drift_{max,mean,p99}_ms` telemetry or the fps/resolution/insufficient_frames capture-quality cancel gates.

## Background

Today the app is English-only end-to-end: no i18n library is installed in `apps/mobile/package.json`; copy is hard-coded in component bodies; `apps/mobile/src/lib/ttsVoice.ts` is pinned to en-US (with owner deviation banner — see `CLAUDE.md`); History day headers and Tasks list render English dates via `toLocaleDateString` defaults; the 22-screen onboarding/main stack (`Splash → Signup → Permissions → Compat → RigTutorial → PracticeIntro → Recording → PracticeComplete → MainTabs` plus the Profile / History / Tasks / Help / ForceUpgrade screens) has no locale switching. `/tasks/search` is `ts_vector + GIN` and accepts English query text only; `services/tasksApi.ts` has no reverse-map.

Today there is no live preview during recording: from the moment `HumynCapture.start()` succeeds, the screen drops to 5% brightness (`HumynScreenBrightness.set(0.05)` in `RecordingScreen.tsx:655`) and renders the dimmed "task name centered + Stop button" surface for the entire 25-min session. The `<HumynGateCameraView>` Camera2-fed TextureView **does** show a live ultrawide preview during the hand gate (one back-camera client at a time; the gate camera is closed before `HumynCapture` opens its own Camera2 session — see `apps/mobile/src/native/HumynGateCamera.ts` and the Kotlin module under `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/`), but that preview ends at the gate→record transition.

The recorded `imu_video_drift_{max,mean,p99}_ms` telemetry sits at ~1.7–6.2 ms on the ultrawide path (`CLAUDE.md` 2026-05-12 drift banner). The fps + resolution + insufficient_frames post-encode cancel gates added 2026-05-17 are live in `FinalizeWorker`. Phase 7 may not regress either.

Phase 7 was inserted between Phases 6 and the prior Phase 7 on 2026-05-24; the previous Phase 7 (Observability & APK Distribution Hardening) renumbered to Phase 8 unchanged.

## Requirements

### Multi-linguality (12 reqs)

1. **8-language support**: App ships translated UI / TTS cues / date formatting in 8 locales.

   - Current: English-only end-to-end; no i18n library in `apps/mobile/package.json`
   - Target: `en` (default), `pt-BR`, `es`, `hi-IN`, `bn-IN`, `ta-IN`, `te-IN`, `mr-IN` all selectable and active across UI + TTS + Intl.DateTimeFormat
   - Acceptance: A fresh install can switch to each of the 8 locales and the active locale name is reflected at runtime via `t('common.greeting')` or equivalent catalog key in every translated screen

2. **Choose-Language first-launch screen**: New screen renders once between Splash and Sign-up.

   - Current: First-launch flow goes Splash → Signup directly via `OnboardingStack.tsx`
   - Target: New `ChooseLanguageScreen` registered in `OnboardingStack` between Splash and Signup; renders iff MMKV key `locale.chosen_at` is unset; default selection = English; tapping Continue persists `{ locale, locale.chosen_at }` to MMKV; route is replaced (no back gesture); never re-renders unless the MMKV key is cleared (delete-account / fresh install)
   - Acceptance: Fresh install renders ChooseLanguage on first launch; tap Continue → Signup; relaunch the app → ChooseLanguage does NOT render again; clear MMKV `locale.chosen_at` (or simulate delete-account flow) → ChooseLanguage re-renders next launch

3. **Choose-Language screen design (in-plan carve-out)**: Designed against existing tokens — no external hand-off.

   - Current: No design asset exists for ChooseLanguageScreen in `prototype.html` / `design-spec.md` / `engineering-handoff.md`
   - Target: Screen uses `apps/mobile/src/ui/tokens.ts` (Inter font, orange accent, RigTutorial-style rounded cards); header + 8 language rows (native name + English name, e.g. "हिन्दी / Hindi") + Continue button. The 3 locked design files stay untouched. This is documented as the second design carve-out (first = owner deviations in `CLAUDE.md`)
   - Acceptance: SPEC + PLAN identify this as a design carve-out; no diffs are made to `prototype.html` / `design-spec.md` / `engineering-handoff.md`; screen uses only tokens from `ui/tokens.ts` (no inline literal hex/spacing)

4. **Profile Language row (immediate-commit picker)**: Profile screen gets a new "Language" row above Help Center.

   - Current: ProfileScreen has no language affordance; locale is implicit
   - Target: New "Language" row above Help Center in `apps/mobile/src/screens/profile/ProfileScreen.tsx`; tap opens a bottom-sheet picker with the same 8 options; a **single tap on a row commits the new locale and dismisses the sheet** (D-02 — no Apply button); the next screen render uses the new locale and the choice persists in MMKV
   - Acceptance: Tap the Language row → bottom sheet appears with 8 options + current locale highlighted; tap a different locale → sheet auto-dismisses + Profile re-renders translated within 1 frame; relaunch app → new locale persisted

5. **LLM-generated catalog (`tools/i18n/generate.ts`)**: All translations LLM-only with a vernacular brief.

   - Current: No translation catalog or generation tooling exists
   - Target: Generation script lives at `tools/i18n/generate.ts` with system-prompt brief _"Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists."_ Output JSON per locale at `apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json`; the catalogs ARE committed to the repo; no human translation step required
   - Acceptance: `tools/i18n/generate.ts` exists with the brief verbatim in source; 8 locale JSONs are committed under `apps/mobile/src/i18n/locales/`; PLAN records the LLM model + prompt version used

6. **Per-locale device TTS**: Recording audio cues play in the active locale's voice (graceful fallback).

   - Current: `apps/mobile/src/lib/ttsVoice.ts` is pinned to en-US via `Tts.setDefaultLanguage('en-US')` at session start and prefers an en-US female-leaning voice
   - Target: `ttsVoice.ts` extended — `Tts.setDefaultLanguage()` is called with the active locale's BCP-47 tag at session start; voice-selection preference order: (a) a voice for the locale that looks female-leaning, (b) any voice for the locale, (c) fall back to the existing en-US female-leaning chain. If no voice for the locale is installed, cues play English-fallback and a Crashlytics breadcrumb is logged with `{ locale, fallback: true }`. The owner's existing en-US-deviation behavior is preserved when the active locale is English
   - Acceptance: On a Pixel 10a with the active locale switched to `pt-BR` / `es` / `hi-IN` / `bn-IN` / `ta-IN` / `te-IN` / `mr-IN`, an instrumented Tts.speak call routes through the locale's voice when present; with the locale set to a known-missing engine, the cue plays in English AND a Crashlytics breadcrumb is recorded

7. **Bilingual consent rendering (non-English)**: Consent + Terms-of-Use show LLM-translated text on top, canonical English below at ~70% opacity.

   - Current: `apps/mobile/src/screens/signup/TermsOfUseModal.tsx` renders only the canonical English copy from `idea-brief.md §5.2`
   - Target: When active locale ≠ `en`, the Signup-screen consent paragraph + the Terms-of-Use modal render bilingual: the LLM-translated string on top, the canonical English string below in smaller font (~70% opacity). When active locale = `en`, only the English string renders (no duplicate). `idea-brief.md §5.2` is NOT edited. The `consent_text_version` POSTed to `/auth/google` (or wherever the consent record is stamped) continues to reference the **canonical English** version — English remains the legal record
   - Acceptance: With a non-English locale active, the consent paragraph + Terms-of-Use modal show two language strings (translated on top, English below at ~70% opacity); the server consent record on the Sign-up POST still contains the canonical English `consent_text_version`

8. **API error → translated toast (server stays English)**: Mobile client maps known error codes to translated toast strings.

   - Current: `/feedback` and other API endpoints return English `detail` strings; the client surfaces them as-is in toasts
   - Target: Server response shapes (RFC 7807 `detail`, error `code`) stay English. The mobile client maps known error codes (e.g. `AUTH_INVALID_TOKEN`, `UPLOAD_QUOTA_EXCEEDED`, etc.) to translated toast strings via the i18n catalog. The raw English `detail` is sent to Crashlytics for triage. Unknown error codes show a translated generic "Something went wrong" toast
   - Acceptance: Triggering each known error code in a non-English locale renders the translated toast; the same trigger writes the English `detail` to Crashlytics; an unknown error code renders the generic translated toast

9. **Locale-aware date formatting (Intl, Latin numerals)**: Dates render via `Intl.DateTimeFormat`; digits stay 0–9.

   - Current: History day headers / Profile dates / Home tiles use English-only formatting (e.g. `toLocaleDateString` default)
   - Target: Date renders use `Intl.DateTimeFormat(activeLocale, { ..., numberingSystem: 'latn' })` so digits stay 0–9 even in non-Latin scripts. At runtime, if `Intl` is unavailable / undefined, fall back to English formatting (Hermes ships ICU; verified at module init)
   - Acceptance: With `hi-IN` active, the History day header "13 May 2026" renders as "13 मई 2026" (digits stay Latin 0–9); with `pt-BR` active it renders "13 mai. 2026"; runtime sanity check confirms `Intl.DateTimeFormat` is defined before relying on it

10. **65-task catalog: UI translated, search reverse-map (no DB migration) — full body translated (D-01)**: Task names + descriptions + step-by-step instructions in TaskDetailsSheet all translate; `/tasks/search` stays English.

    - Current: Task names and TaskDetailsSheet bodies are English-only in `apps/mobile/src/screens/tasks/`; `/tasks/search` consumes English text via `ts_vector + GIN`
    - Target: A new `taskCatalog.i18n.ts` exposes `{ canonical_en_name → { [locale]: { name, description, instructions, examples } } }` for all 65 tasks. The UI (TasksScreen list, TaskDetailsSheet description / instructions / example bullets) renders translated strings for the active locale (D-01 — full task copy in scope). Search-input text typed in the user's language is reverse-mapped to canonical English terms in `services/tasksApi.ts` before hitting `/tasks/search`. The `tasks` table + `ts_vector` index are unchanged; **no backend migration in this phase**
    - Acceptance: With `hi-IN` active, a user typing "चाय बनाओ" in the search input gets reverse-mapped to "make tea" before `/tasks/search` is called and the canonical "Make tea" row returns; opening TaskDetailsSheet on "Make tea" shows the full Hindi description + instructions + examples (not just the name); no Drizzle migration ships in Phase 7

11. **Phase 6 cosmetic gaps are NOT re-opened**: Translation is purely additive.

    - Current: 13/15 entries in `06-COSMETIC-GAPS.md` are resolved; 2 are deferred (Finding 4 HumynBeep audibility per `feedback_d09_audibility_deferred`, Finding 9 Player drag-to-seek byte-0 — deferred to Phase 8 remux)
    - Target: The translation rollout uses the final approved Phase 6 English strings as its source; nothing in Phase 6 is re-opened, re-styled, or otherwise altered by Phase 7
    - Acceptance: Phase 6 cosmetic-gaps doc remains unchanged in this PR; no Phase 6 component is renamed / re-styled / re-themed under cover of "translation work"

12. **Anonymous first-launch + change-locale telemetry via ring buffer (no new endpoint)**: First-launch language pick + Profile locale-change flow through the existing telemetry ring.
    - Current: Compat outcomes + permission grants flow through the existing telemetry ring buffer (`engineering-handoff.md §11`); no new server endpoint for those — same pattern applied here
    - Target: First-launch language pick (`installation_id` + `chosen_locale`) is appended to the existing telemetry ring; subsequent Profile locale-change events flow through the same ring. **No new server endpoint, no new ring-buffer event schema field beyond `event_name = 'locale_chosen' | 'locale_changed'` + `chosen_locale` payload**
    - Acceptance: Both events appear in the telemetry ring on emission; no new route is added to the backend; nothing in `apps/api/src/routes/` changes

### Recording — Live-Cam Preview (7 reqs)

13. **15-s initial preview on Start**: When recording starts (hand gate passed OR Skip), the live ultrawide camera feed renders full-screen for 15 s with a corner indicator.

    - Current: Once `HumynCapture.start()` succeeds, `RecordingScreen.tsx:655` immediately drops brightness to 0.05 and renders the dimmed surface (no preview)
    - Target: On the gate-passed-or-skipped transition into `substate = 'active'`, the live ultrawide camera feed renders **full-screen for 15 s** with a faint corner indicator "Live preview · auto-hides in {N}s" (translated; countdown in seconds). At t=15 s, fade to the existing dimmed state (5% brightness, black, task name centered, Stop button visible). The Surface-source approach (share encoder Surface vs. dedicated preview target vs. attach/detach preview Surface mid-record) is a PLAN-time decision per REC-LIVE-06 — not locked here
    - Acceptance: On a Pixel 10a, starting a recording shows the live ultrawide preview full-screen for 15 s with the translated countdown indicator visible; at 15 s the screen fades to the dimmed state and the task name + Stop are visible

14. **Tap-reveal rolling 10-s preview**: While dimmed, a single tap brings the preview back for 10 s; subsequent taps reset the timer back to 10 s.

    - Current: No tap affordance exists on the dimmed recording surface; tap regions today are only the Stop button and the exit-overlays
    - Target: In the dimmed state, a small dim eye-icon glyph in the bottom-right corner signals the tap affordance. A **single tap anywhere on the recording surface** (except the Stop hit-zone) re-shows the live preview for 10 s. Each subsequent tap during the window **resets the timer back to 10 s** (rolling, not accumulating). At the 10-s mark with no further taps, fade back to dimmed
    - Acceptance: In the dimmed state, eye-icon glyph visible bottom-right; a single tap renders the preview + the brightness jumps to system level; tapping again within the 10-s window resets the visible countdown to 10 s; 10 s of inactivity → fade back to dimmed; the Stop button hit-region remains tappable during all 3 states (initial 15 s preview, dimmed, tap-revealed 10 s preview)

15. **Brightness wrapper drives both preview windows**: Brightness goes to system level during preview; back to 0.05 on fade.

    - Current: `HumynScreenBrightness.set(0.05)` drives the dim state today; `HumynScreenBrightness.set(-1)` restores system brightness on exit (`RecordingScreen.tsx:734`)
    - Target: During the initial 15-s window AND the tap-revealed 10-s window, the wrapper is driven to system brightness (e.g. `set(-1)` or the equivalent "release" call). On fade-back to dim, brightness returns to 0.05. The transitions use the existing `HumynScreenBrightness` wrapper — no new native brightness API
    - Acceptance: On a Pixel 10a, screen brightness measurably increases during the 15-s preview and during the tap-reveal window, and drops back to dim between them; the on-stop / on-exit brightness restore (REC-08) still fires unchanged

16. **Live-cam applies to BOTH practice and real recordings (D-05 preview-then-overlay)**: Same component, same timing — but the practice instructional overlay shows AFTER the 15-s preview ends.

    - Current: Practice recording (PracticeIntro → Recording → PracticeComplete) follows the same `RecordingScreen` as real recordings; today neither shows a preview
    - Target: For BOTH practice and real recordings, the **first 15 s after Start is a full-screen preview only — the existing practice instructional copy (centered task name, etc.) does NOT render during the preview** (D-05). At t=15 s, fade-to-dim AND render the practice instructional copy (matching today's behavior). Tap-reveal during the practice run also pre-empts the practice copy for the 10-s window
    - Acceptance: Practice flow: starting practice → full-screen preview for 15 s with NO practice copy visible → fade-to-dim + practice copy renders centered. Real flow: same 15 s + same fade-to-dim. Both flows reach the practice/real `PracticeComplete` or History terminal state without breaking

17. **Drift telemetry continues unchanged; A/B regression bound (D-04)**: Recorded `imu_video_drift_{max,mean,p99}_ms` continues to be measured + stamped; preview must not regress drift > 50% in a same-device A/B.

    - Current: Drift metrics are computed in `HumynCapture` and stamped into the segment's `metadata.json` (relaxed-but-recorded gate per `CLAUDE.md` 2026-05-12); current ultrawide baseline ~1.7–6.2 ms on the recorded p99
    - Target: Drift continues to be measured + recorded unchanged. The smoke walk runs **a same-device same-day A/B**: a 10-minute segment with the live-cam preview path OFF (baseline), followed by a 10-minute segment with the live-cam preview path ON. The pass/fail rule (D-04): `(p99_ON − p99_OFF) / p99_OFF < 0.50`. If the A/B fails, the implementation must be revised before phase sign-off (Surface-approach choice in PLAN per REC-LIVE-06 is the lever)
    - Acceptance: Both A/B segments are recorded into the project DB; their `imu_video_drift_p99_ms` values are extracted into the manual-smoke runbook; the recorded delta passes the < 50% bound; if not, PHASE blocks until the Surface choice in PLAN is revised + re-walked

18. **Capture-quality cancel gates unchanged**: `fps_dropped` / `resolution_dropped` / `insufficient_frames` post-encode cancels fire regardless of whether preview was visible.

    - Current: `FinalizeWorker` enforces fps<29 / width<1920 OR height<1080 / `videoFrameTimestamps.size<2` post-encode (CLAUDE.md 2026-05-17 banner)
    - Target: Live-cam preview must not alter `FinalizeWorker`'s cancel logic. Both A/B segments AND any UAT segments must continue to exhibit the same cancel-on-spec-fail behavior (e.g. a forced-low-fps test still cancels with `fps_dropped` regardless of preview-ON/OFF)
    - Acceptance: A negative test segment (e.g. forced-low-fps scenario from Phase 4/5 negatives) cancels with the appropriate `cancel_reason` whether preview was visible or not; positive A/B segments finalize with `qa_status = 'uploaded'` → `qa_status = 'verified'` end-to-end

19. **Surface-approach is a PLAN-time decision; Stop stays hit-testable**: The Surface choice is locked in PLAN.md, not SPEC.
    - Current: No live-preview implementation exists; the Surface model is open
    - Target: Three Surface options (share encoder Surface / dedicated preview target / add+remove mid-record) are compared in PLAN.md with on-hardware drift measurements as the decision gate. SPEC pre-commits ONLY that the **Stop button remains hit-testable in all three visible states** (initial 15-s preview, dimmed, tap-revealed 10-s preview)
    - Acceptance: PLAN.md contains the 3-option comparison with measured drift numbers (the A/B from req 17 is the gate); Stop tap-test passes in all three states on Pixel 10a manual smoke

### Process / sweep (2 reqs)

20. **Renumber sweep is clean**: All Phase-7-referencing planning artifacts correctly show observability work as Phase 8.

    - Current: As of 2026-05-24, ROADMAP / REQUIREMENTS / STATE / CLAUDE.md have been swept; `.planning/quick/` and `.planning/debug/` directories carrying historical "Phase 7" references are intentionally left as frozen history (ROADMAP "Phase swap 2026-05-24" banner)
    - Target: No live planning artifact (current PLAN / SUMMARY / VERIFICATION docs for phases that haven't yet shipped) references "Phase 7" in an observability context. The historical commit messages + `.planning/quick/*` + `.planning/debug/*` entries from before 2026-05-24 are NOT edited
    - Acceptance: `grep -rE 'Phase 7.*(observ|distribution|HumynUpdater|Bull-Board)' .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/STATE.md CLAUDE.md` returns only the explicit "was Phase 7 pre-2026-05-24 renumber" annotation lines; no orphan references remain

21. **Android only — iOS analogues stay deferred**: This phase ships Android only.
    - Current: iOS native modules (`HumynCaptureIOS`, etc.) and the iOS distribution channel were descoped from MVP 2026-05-11 (REQUIREMENTS.md §v2 IOS-01..07)
    - Target: All Phase 7 work targets Android. No iOS native-module changes ship. The i18n catalog itself is platform-neutral (JSON) and will be reusable by a future iOS milestone, but no iOS-side runtime wiring or build configuration is touched in Phase 7
    - Acceptance: No file under `apps/mobile/ios/` is modified by this phase; iOS deferrals in REQUIREMENTS.md §v2 remain in §v2

## Boundaries

**In scope:**

- New `ChooseLanguageScreen` registered in `OnboardingStack.tsx` between Splash and Signup (first-launch only, MMKV-gated)
- New Profile "Language" row + bottom-sheet picker with tap-to-commit + auto-dismiss
- i18n runtime + catalog generation tool (`tools/i18n/generate.ts` + 8 JSONs under `apps/mobile/src/i18n/locales/`)
- Full UI string sweep across all 23 screens (22 existing + ChooseLanguage)
- Per-locale device-TTS in `apps/mobile/src/lib/ttsVoice.ts` with English fallback + Crashlytics breadcrumb
- Bilingual consent / Terms-of-Use rendering for non-English locales (translated on top, English below at ~70% opacity)
- API-error-code → translated toast mapping on the mobile client (server stays English)
- `Intl.DateTimeFormat(activeLocale, { numberingSystem: 'latn' })` for date renders with English fallback
- `taskCatalog.i18n.ts` for the 65 tasks — full body translation (name + description + instructions + examples) AND reverse-map for `/tasks/search`
- Telemetry ring buffer entries for `locale_chosen` / `locale_changed` (no new endpoint)
- Live-cam preview during recording: 15-s initial + rolling 10-s tap-reveal, brightness-coupled, both practice + real flows, full-screen preview-then-overlay (D-05)
- Manual smoke runbook with the same-device same-day A/B drift comparison (D-04) and capture-quality-cancel re-verification

**Out of scope:**

- iOS native-module changes (`HumynCaptureIOS`, iOS gate camera, etc.) — deferred per §v2 (IOS-01..07)
- New server endpoints or database migrations — `/tasks/search` reverse-map is client-side (I18N-10); error toasts client-side (I18N-08); telemetry uses the existing ring (I18N-12); consent record keeps canonical English server-side (I18N-07)
- Editing the 3 locked design files (`prototype.html` / `design-spec.md` / `engineering-handoff.md`) — ChooseLanguage is the second design carve-out (the first being CLAUDE.md owner deviations)
- Editing `idea-brief.md §5.2` — canonical English consent is unchanged
- Re-opening previously-closed Phase 6 cosmetic gaps — translation is additive against the approved English (I18N-11)
- Locking the Surface-source approach for the live-cam feed — that decision is made in PLAN.md with the A/B drift as the gating measurement (REC-LIVE-06 / req 19)
- Reintroducing audio capture — audio dropped 2026-05-11 stays dropped; live-cam preview is video-only
- Force-upgrade / observability / distribution-hardening work — that's Phase 8 (was Phase 7 pre-2026-05-24)
- The pgvector + RRF semantic-search client surface — still §v2 (SEARCH-V2-01)
- Per-locale legal review — DPDP / LGPD counsel already scoped at Phase 1; bilingual rendering keeps the canonical English legal record (I18N-07)
- Human translator review pass — translations are LLM-only per I18N-05; a future post-MVP pass is out of scope for Phase 7

## Constraints

- **Drift gate** (D-04): On a Pixel 10a back-to-back same-day A/B, `(p99_preview_on − p99_preview_off) / p99_preview_off < 0.50`. The ~1.7–6.2 ms ultrawide baseline from `CLAUDE.md` 2026-05-12 is the reference range, but the comparison is **per-device per-day**, not against the absolute band.
- **Capture-quality cancel gates** (`CLAUDE.md` 2026-05-17): `fps_dropped` / `resolution_dropped` / `insufficient_frames` post-encode cancels stay live and unchanged.
- **One back-camera client at a time** (Camera2): the gate-camera Surface must be released before `HumynCapture` opens its own session, AND any preview-Surface the recording path attaches must coexist with the encoder Surface (not contend for the camera client). The Surface model is PLAN-time.
- **No new server endpoint** (I18N-08, I18N-12); no DB migration (I18N-10); server error `detail` strings stay English (Crashlytics-logged).
- **Hermes ICU at runtime**: `Intl.DateTimeFormat` is verified defined before use; fallback to English formatting if not.
- **`latn` numbering**: All numeric values (dates, durations, contribution counts, drift telemetry if surfaced in debug) force `latn` so digits stay 0–9 across all 8 locales.
- **Translation prompt brief** (verbatim): _"Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists."_ — must appear in source at `tools/i18n/generate.ts`.
- **TTS fallback chain** (I18N-06): locale-female → locale-any → en-US female-leaning → en-US any → engine default. Missing-engine fallback emits a Crashlytics breadcrumb.
- **Manual-smoke device**: A/B drift comparison runs on a Pixel 10a (current development device); TTS per-locale walk runs on the same device with each TTS engine installed.
- **Android only** — no iOS file under `apps/mobile/ios/` is modified.
- **English remains the legal record**: bilingual consent rendering changes the UX only; the server-side `consent_text_version` continues to reference canonical English.

## Acceptance Criteria

- [ ] `ChooseLanguageScreen` renders on fresh install between Splash and Signup; does not re-render after the MMKV `locale.chosen_at` key is set; re-renders if that key is cleared
- [ ] Profile "Language" row opens a bottom-sheet with 8 options; single tap commits + dismisses; next screen render is in the new locale; choice persists across app restart
- [ ] All 23 screens (22 existing + ChooseLanguage) render correctly with each of the 8 locales active
- [ ] `tools/i18n/generate.ts` exists with the verbatim translation brief in source; 8 locale JSONs committed under `apps/mobile/src/i18n/locales/`
- [ ] `ttsVoice.ts` selects a per-locale voice when available; falls back to en-US chain when missing; logs a Crashlytics breadcrumb on fallback
- [ ] Per-locale TTS walked on a Pixel 10a for `pt-BR` / `es` / `hi-IN` / `bn-IN` / `ta-IN` / `te-IN` / `mr-IN` (engine-installed cases)
- [ ] Bilingual consent renders translated-on-top + English-at-70%-below for non-English locales; Sign-up POST still records the canonical English `consent_text_version`
- [ ] All known API error codes mapped to translated toast strings; raw English `detail` logged to Crashlytics; unknown codes fall through to a translated generic toast
- [ ] History day headers render via `Intl.DateTimeFormat` with the active locale and Latin numerals (verified for `hi-IN` + `pt-BR` at minimum)
- [ ] `taskCatalog.i18n.ts` provides full-body translations (name + description + instructions + examples) for all 65 tasks
- [ ] Search input typed in `hi-IN` (e.g. "चाय बनाओ") reverse-maps to canonical English before `/tasks/search` is called and returns the expected canonical task
- [ ] No Drizzle migration ships in this phase (`apps/api/drizzle/migrations/` count unchanged)
- [ ] `locale_chosen` + `locale_changed` events appear in the existing telemetry ring buffer; no new route added to `apps/api/src/routes/`
- [ ] On Start (gate-passed or Skip): full-screen ultrawide preview renders for 15 s with the translated countdown indicator
- [ ] Practice flow: the 15-s preview is full-screen with NO practice copy visible during it; practice copy renders only after fade-to-dim (D-05)
- [ ] In the dimmed state, an eye-icon glyph is visible bottom-right; a single tap re-shows the preview for 10 s with brightness at system level
- [ ] Subsequent taps within the 10-s window reset the timer back to 10 s (rolling, not accumulating)
- [ ] Stop button is hit-testable in all three states (initial 15-s preview / dimmed / tap-revealed 10-s preview)
- [ ] Brightness wrapper drives system → 0.05 → system transitions; on-stop/on-exit brightness restore unchanged
- [ ] Pixel 10a A/B drift smoke: `(p99_preview_on − p99_preview_off) / p99_preview_off < 0.50` (D-04). If fail: Phase blocks until PLAN's Surface choice is revised + re-walked
- [ ] Capture-quality cancel gates still fire on negative tests regardless of preview-ON/OFF (`fps_dropped` / `resolution_dropped` / `insufficient_frames`)
- [ ] PLAN.md contains the 3-option Surface comparison (share encoder Surface vs. dedicated preview target vs. add/remove mid-record) with measured drift numbers
- [ ] Renumber sweep: no live planning artifact (PLAN / SUMMARY / VERIFICATION for not-yet-shipped phases) references "Phase 7" in an observability context except the explicit renumber-annotation lines
- [ ] No file under `apps/mobile/ios/` is modified

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes                                                                       |
| ------------------- | ----- | ----- | ------ | --------------------------------------------------------------------------- |
| Goal Clarity        | 0.94  | 0.75  | ✓      | Two well-bounded sub-goals (i18n + live-cam), each with explicit acceptance |
| Boundary Clarity    | 0.93  | 0.70  | ✓      | Explicit out-of-scope list; iOS / DB / new endpoints / design files locked  |
| Constraint Clarity  | 0.92  | 0.65  | ✓      | A/B drift bound, capture-quality cancels, TTS chain, `latn` numbering       |
| Acceptance Criteria | 0.92  | 0.70  | ✓      | 24 pass/fail checkboxes; A/B procedure is fully specified                   |
| **Ambiguity**       | 0.07  | ≤0.20 | ✓      | Gate passed cleanly                                                         |

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                                           |
| ----- | --------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| 1     | Researcher      | Task copy translation scope (D-01)        | Full body — name + description + instructions translate                   |
| 1     | Researcher      | Profile picker commit UX (D-02)           | Tap-to-commit + auto-dismiss (no Apply button)                            |
| 1     | Researcher      | Help Center body translation scope (D-03) | Full body — Instructions / FAQs / Troubleshooting all translate           |
| 2     | Boundary Keeper | Drift regression gate definition (D-04)   | Same-device same-day A/B: `(p99_on − p99_off) / p99_off < 0.50`           |
| 2     | Failure Analyst | Practice + preview interaction (D-05)     | Full-screen 15-s preview first; practice instructional copy appears AFTER |

---

_Phase: 07-multi-linguality-live-cam-feed_
_Spec created: 2026-05-24_
_Next step: /gsd-discuss-phase 7 — implementation decisions (Surface-source choice, catalog wiring lib choice, MMKV key layout, bottom-sheet library, etc.)_
