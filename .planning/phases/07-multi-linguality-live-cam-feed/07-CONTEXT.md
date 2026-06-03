# Phase 7: Multi-linguality & Live-Cam Feed — Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Two sub-goals, captured + locked in `07-SPEC.md` (21 requirements, ambiguity 0.07):

1. **Multi-linguality (12 reqs)** — ship the app in 8 locales end-to-end across UI copy + device-TTS audio cues + locale-aware date formatting:

   - New `ChooseLanguageScreen` between Splash and Signup (MMKV-gated first-launch only)
   - Profile "Language" row + bottom-sheet picker (tap-to-commit, no Apply button — D-02)
   - LLM-generated translation catalog with a vernacular brief (no human-translator pass at MVP)
   - Per-locale TTS with locale-female → locale-any → en-US-female-leaning fallback chain
   - Bilingual consent rendering (translated on top, English at ~70% opacity below) when locale ≠ en; English remains the legal record
   - API error codes → translated toast (server-side `detail` stays English; Crashlytics-logged)
   - `Intl.DateTimeFormat(activeLocale, { numberingSystem: 'latn' })` so digits stay 0-9
   - Full task body translation for all 65 tasks: name + description + instructions + examples (D-01) + reverse-search map for `/tasks/search` (client-side, no DB migration)
   - `locale_chosen` / `locale_changed` events through the existing telemetry ring (no new server endpoint)

2. **Live-cam preview during recording (7 reqs)** — break the 25-min dim-screen contract:

   - 15-s full-screen ultrawide preview after `HumynCapture.start()` succeeds (gate-passed OR Skip)
   - In the dimmed state, a single tap re-shows the preview for 10 s; subsequent taps reset the timer (rolling, not accumulating)
   - Brightness wrapper drives system → 0.05 → system across the three states; on-stop/on-exit brightness restore unchanged
   - Applies to BOTH practice and real recordings; in practice mode the instructional copy renders AFTER the 15-s preview, not during (D-05)
   - Drift telemetry continues to be measured + stamped; phase blocks if a same-device same-day A/B fails `(p99_on − p99_off) / p99_off < 0.50` (D-04)
   - Capture-quality cancel gates (`fps_dropped` / `resolution_dropped` / `insufficient_frames`) stay live and unchanged
   - Stop button stays hit-testable in all three visible states

3. **Process / sweep (2 reqs)** — clean renumber sweep (Phase 7 observability work moved to Phase 8 on 2026-05-24); Android only (iOS analogues stay deferred per §v2 IOS-01..07).

**Out of scope (from SPEC.md):** iOS native modules / iOS distribution; new server endpoints; DB migration; editing the 3 locked design files (`prototype.html` / `design-spec.md` / `engineering-handoff.md`) — `ChooseLanguageScreen` is the second design carve-out; editing `idea-brief.md §5.2`; re-opening Phase 6 cosmetic gaps; locking the live-cam Surface-source choice (PLAN-time, per REC-LIVE-19); reintroducing audio capture; force-upgrade / observability / distribution-hardening work (now Phase 8); pgvector + RRF semantic search; per-locale legal review; human translator review pass.

</domain>

<spec_lock>

## Requirements (locked via SPEC.md)

**21 requirements are locked.** See `07-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `07-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**

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

**Out of scope (from SPEC.md):**

- iOS native-module changes (`HumynCaptureIOS`, iOS gate camera, etc.) — deferred per §v2 (IOS-01..07)
- New server endpoints or database migrations
- Editing the 3 locked design files
- Editing `idea-brief.md §5.2`
- Re-opening previously-closed Phase 6 cosmetic gaps
- Locking the Surface-source approach for the live-cam feed (PLAN-time, REC-LIVE-19)
- Reintroducing audio capture
- Force-upgrade / observability / distribution-hardening work (Phase 8)
- pgvector + RRF semantic-search client surface (§v2 SEARCH-V2-01)
- Per-locale legal review
- Human translator review pass

**Decisions already locked in SPEC.md (D-01..D-05):**

- **D-01** — Task body fully translated (name + description + instructions + examples), not just name.
- **D-02** — Profile picker is tap-to-commit + auto-dismiss; no Apply button.
- **D-03** — Help Center body fully translates (Instructions / FAQs / Troubleshooting all in scope).
- **D-04** — Drift regression gate: same-device same-day A/B, `(p99_on − p99_off) / p99_off < 0.50`.
- **D-05** — Practice flow shows the 15-s full-screen preview FIRST (no practice instructional copy during the preview), THEN fade-to-dim + render the practice copy.

</spec_lock>

<decisions>
## Implementation Decisions

These are the HOW decisions captured during the discuss-phase pass. They extend SPEC.md's D-01..D-05.

### i18n runtime (I18N-01..I18N-04)

- **D-06: i18n runtime library = `react-i18next`** with `i18next` as the engine. RN-standard, JSON-catalog model matches what `tools/i18n/generate.ts` will emit, CLDR plural rules built-in for all 8 locales, `i18n.changeLanguage('hi-IN')` triggers a Provider re-render. ~30 KB. Add to `apps/mobile/package.json` along with the `react-i18next` peer + `i18next-react-native-language-detector` (or hand-rolled MMKV-backed detector — planner's call).

  - Sub-libs: `i18next` + `react-i18next`. No `i18next-http-backend` (catalogs are bundled at build time).
  - Plural rules ship with i18next; we don't author per-locale plural functions.

- **D-07: Catalog shape = monolithic JSON per locale** under `apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` (matches the path SPEC.md already names). Deeply-nested keys (e.g. `recording.preview.live`, `profile.language.picker.title`). 8 files total. Simpler for the LLM generator to produce + diff; fewer moving pieces than namespaced lazy-loaded chunks.

- **D-08: Locale-key naming convention = `screen.section.element`** (three-level dotted path, lowercase). Examples: `onboarding.chooseLanguage.continueButton`, `recording.preview.live`, `profile.language.row.label`, `tasks.search.placeholder`, `terms.consent.body`. Pluralizable strings use i18next's `_one` / `_other` suffix convention (e.g. `home.tile.recordingsCount_one` / `home.tile.recordingsCount_other`).

- **D-09: Bilingual consent rendering = composite key with two keys + view-side composition**, NOT a single key. The translated paragraph lives at `terms.consent.body` (translated by the LLM in each non-English locale); the canonical English remains at the SAME key in `en.json` AND is loaded separately via `i18n.getFixedT('en')('terms.consent.body')` for the underlay. The Signup/Terms-of-Use view composes them visually (translated on top, English below at ~70% opacity) when active locale ≠ en. Avoids embedding English fragments inside non-English JSON values.

### Catalog generation pipeline (I18N-05)

- **D-10: LLM provider = Claude Opus 4.7** via `@anthropic-ai/sdk` in `tools/i18n/generate.ts`. ANTHROPIC_API_KEY sourced from `tools/.env` (NOT the mobile app environment). The vernacular brief from I18N-05 lives verbatim in the source as the `system` prompt:

  - _"Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists."_

- **D-11: Execution model = 7 calls (one per non-English locale), full-catalog overwrite, manual trigger.** `pnpm i18n:generate` is the entry point. Each call sends the full `en.json` + the system brief + a per-locale user prompt ("Translate this catalog to {locale_name} — keep the JSON structure, translate the string values"). Response is the full translated JSON for that locale, OVERWRITES the locale file. No incremental drift logic in tool v1.

- **D-12: Drift handling = rely on i18next's built-in key-fallback.** If a new English string is added to `en.json` and the locale files haven't been regenerated, the missing-key falls back to the en value at runtime. No git-hook auto-regen; no commit-time LLM calls. PLAN should record the LLM model + prompt version in a header comment at the top of each locale JSON for audit.

- **D-13: Cost model** — first generation is ~$5-15 on Opus 4.7 across 7 locales (~500 strings × ~150 input + ~100 output tokens per locale). Subsequent full regenerations cost the same. Cost not a meaningful constraint at MVP cadence.

### Reverse-search map for /tasks/search (I18N-10)

- **D-14: Reverse map shape = per-locale full-string lookup + token-fallback.** Two-stage in `services/tasksApi.ts`:

  - **Stage 1 (full-string match):** look up the typed string in a per-locale map `{ [translated_task_name]: canonical_en_name }` derived from `taskCatalog.i18n.ts`. Instant hit when users type a full task name in their locale (e.g. `'चाय बनाओ' → 'Make tea'`).
  - **Stage 2 (token-fallback):** tokenize the input on whitespace; reverse-map each token against a per-locale token table; rebuild an English query from the matched tokens. The token tables are derived from the locale catalog at module load (no separate authoring step).
  - **Stage 3 (passthrough):** if neither matches, send the raw input to `/tasks/search` and let `ts_vector + pg_trgm` try its best (likely returns zero — that's the expected degraded state, not a bug).

- **D-15: Reverse map source-of-truth = `taskCatalog.i18n.ts`.** The same file that powers the UI translations IS the source for the reverse maps. The reverse maps are computed at module-load time (not pre-built JSON) — keeps a single source-of-truth and lets the i18n generator regenerate the catalog without a separate reverse-map regen step.

- **D-16: No backend changes.** `apps/api/src/routes/tasks/search.ts` is unchanged. `apps/api/drizzle/migrations/` count is unchanged. The `ts_vector` index + `pg_trgm` fallback from Phase 6 continue to handle the English query that the reverse-map produces.

### Language picker UI + ChooseLanguageScreen (I18N-02, I18N-03, I18N-04)

- **D-17: Bottom-sheet picker = reuse the existing `Sheet` primitive** at `apps/mobile/src/ui/primitives/Sheet.tsx` (wraps RN `Modal` with `transparent + animationType='slide'`). Add a `LanguageSheet` component that composes `Sheet` + a `FlatList` of 8 rows (FlatList for safety on low-end Android even at 8 items). Single tap on a row calls `i18n.changeLanguage(loc)` + `localeMmkv.set('locale.code', loc)` + `onDismiss()`. Zero new deps. NOT `@gorhom/bottom-sheet` (would add 50+ KB + a peer dep on `react-native-gesture-handler` for a 2-place usage).

- **D-18: Locale ordering on both surfaces = `[en, pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN]`.** English first (it's the default selection + the formal-language fallback), then LatAm (pt-BR, es — pt-BR first because Brazil is the bigger MVP geo by volume), then India by speaker count (hi-IN > bn-IN > ta-IN > te-IN > mr-IN). Apply this ordering to BOTH the ChooseLanguageScreen list AND the Profile bottom-sheet picker.

- **D-19: Row presentation = native name on left, English name on right** (e.g. `"हिन्दी"` left-aligned, `"Hindi"` right-aligned in a secondary token color). Current selection on the Profile sheet shows a check (lucide-react-native `Check`) on the right side after the English name; the ChooseLanguageScreen radio-style indicator on the row uses the same `Check` icon with default-English pre-selected on first render.

- **D-20: ChooseLanguageScreen design carve-out** — per SPEC I18N-03, the screen uses ONLY tokens from `apps/mobile/src/ui/tokens.ts` (Inter font, orange accent, RigTutorial-style rounded cards). No diffs are made to `prototype.html` / `design-spec.md` / `engineering-handoff.md`. Documented in PLAN as the second design carve-out (first = owner deviations in `CLAUDE.md`).

### MMKV key layout (supports I18N-02, I18N-04)

- **D-21: Locale state lives in a NEW non-secure MMKV instance `localeMmkv`** — not in `secureMmkv` (locale isn't a secret; `secureMmkv` is reserved for tokens / telemetry ring / PII-adjacent ledgers). Two dotted keys: `locale.code` (string, BCP-47 tag e.g. `'hi-IN'`) + `locale.chosen_at` (ISO timestamp string).

- **D-22: ChooseLanguageScreen render gate** = `localeMmkv.contains('locale.chosen_at') === false`. On Continue, set both keys atomically and `navigation.replace('Signup')` (no back gesture per SPEC I18N-02). On delete-account / fresh-install reset (planner identifies the call sites), clear BOTH keys to re-enable the gate.

- **D-23: i18n bootstrap order at app start** — at `apps/mobile/src/App.tsx` mount, read `localeMmkv.getString('locale.code')` BEFORE rendering the navigator; pass it to `i18n.init({ lng })`. Default to `'en'` if unset (the gate-passing redirect to ChooseLanguageScreen renders in English, which is the SPEC-locked default).

### Live-cam preview integration (REC-LIVE-13..19)

- **D-24: Surface-source choice DEFERRED TO PLAN.md per SPEC REC-LIVE-19.** Owner steer captured: NO steer — the planner compares all 3 options (share encoder Surface / dedicated preview target / attach-detach mid-record) with on-hardware drift measurements as the deciding gate. The PLAN.md A/B drift bound `(p99_on − p99_off) / p99_off < 0.50` (D-04) is the only gate. SPEC pre-commits only that Stop stays hit-testable in all three visible states.

- **D-25: Preview RN component = NEW `<HumynLivePreviewView>`**, not a dual-mode reuse of `<HumynGateCameraView>`. Single-purpose components (mirrors the `HumynPlayer` / `HumynGateCamera` pattern — each native view owns one responsibility). `<HumynGateCameraView>` stays dedicated to the gate (it opens its OWN Camera2 session). `<HumynLivePreviewView>` does NOT open a camera client — it exposes a Surface that `HumynCapture` renders into (whichever Surface model PLAN picks).

- **D-26: Countdown indicator copy = static `"Live preview"` label** during the 15-s window AND the 10-s tap-reveal window. NO per-second numeral countdown. Translated via the i18n catalog as `recording.preview.live`. Reduces render thrash + simplifies the React tree state.

- **D-27: Eye-icon glyph = lucide-react-native `Eye` icon** at low opacity (token-defined) in the bottom-right corner of the dimmed surface. `lucide-react-native@1.14.0` is already installed (CLAUDE.md tech-stack pin).

- **D-28: Tap-zone implementation = full-surface `Pressable` overlay** that covers the entire RecordingScreen surface EXCEPT the Stop hit-zone. The Stop button absolute-positions ABOVE the Pressable in the z-stack so its onPress fires before the Pressable's. Single `onPress` on the Pressable fires:

  1. cancel any pending fade timer
  2. restore brightness via `HumynScreenBrightness.set(-1)` (uses existing wrapper, no new native API per REC-LIVE-15)
  3. render the preview View
  4. start a fresh 10-s timer that on completion: dims to 0.05, hides the preview, shows the eye-icon glyph

- **D-29: Tap-during-preview semantics = timer reset (rolling, not accumulating)** per SPEC REC-LIVE-14. Each tap during the active 10-s window clears the existing fade timer and starts a fresh 10-s one. Implementation: a single `useRef<NodeJS.Timeout | null>(null)` cleared + reassigned per tap.

### Telemetry (I18N-12)

- **D-30: Locale events use the existing `telemetryRing.append()` API** at `apps/mobile/src/services/telemetryRing.ts`. Event shape stays `{ name, ts, props }` (no schema change):
  - First-launch pick: `{ name: 'locale_chosen', ts: Date.now(), props: { installation_id, chosen_locale } }`
  - Profile change: `{ name: 'locale_changed', ts: Date.now(), props: { installation_id, from_locale, to_locale } }`
  - Both flow through the same `secureMmkv`-backed ring (100-entry cap, existing trim). No new route in `apps/api/src/routes/`. No new ring-buffer schema field.

### Per-locale TTS (I18N-06)

- **D-31: `apps/mobile/src/lib/ttsVoice.ts` extension preserves owner-deviation behavior for en.** At session start the existing code calls `Tts.setDefaultLanguage('en-US')`; the extension changes this to `Tts.setDefaultLanguage(activeLocaleBcp47)` then walks the fallback chain:
  1. a voice matching the active locale that looks female-leaning
  2. any voice matching the active locale
  3. an en-US female-leaning voice (the existing owner-preferred chain)
  4. any en-US voice
  5. first en-\* voice
     When falling back to step 3+, emit a Crashlytics breadcrumb `{ event: 'tts_locale_fallback', locale: activeLocale, fallback: true }`. The existing `EnIn` symbol-name choice stays for import-call stability.

### Bilingual consent rendering (I18N-07)

- **D-32: Composition is view-side, not catalog-side.** `TermsOfUseModal.tsx` and the Signup consent paragraph read `t('terms.consent.body')` for the active locale AND `i18n.getFixedT('en')('terms.consent.body')` for the English underlay. When `i18n.language === 'en'`, the underlay is suppressed (no duplicate render). The English underlay uses the same Text component with a `~70% opacity` style token + a smaller font size step.

- **D-33: Sign-up POST payload unchanged.** The `consent_text_version` field in the `/auth/google` (or wherever consent is stamped — planner identifies) request body continues to reference the canonical English version. Server-side consent record is English. SPEC I18N-07 locked this; D-33 captures the implementation: the version-string constant `CONSENT_TEXT_VERSION_EN` lives in `apps/mobile/src/constants/legal.ts` (or wherever it lives today — planner confirms) and is sent as-is regardless of active locale.

### API error → translated toast (I18N-08)

- **D-34: Error-code → toast-key map lives at `apps/mobile/src/i18n/errorMap.ts`** as a plain `Record<string, string>`. Example: `{ 'AUTH_INVALID_TOKEN': 'errors.auth.invalidToken', 'UPLOAD_QUOTA_EXCEEDED': 'errors.upload.quotaExceeded' }`. The toast surface calls `t(errorMap[code] ?? 'errors.generic')`. Unknown codes resolve to the translated generic key.

- **D-35: Crashlytics breadcrumb on every API error** records `{ code, raw_detail }` (English detail) for triage. The breadcrumb is independent of the toast — they both fire on the same error surface. Planner identifies the existing API error handler in `apps/mobile/src/services/` to hook in.

### Date formatting (I18N-09)

- **D-36: Intl availability guard at module init** — `apps/mobile/src/lib/dates.ts` (new file or extend existing) does a one-shot check `typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined'` at module load. Hermes ships ICU (verified in CLAUDE.md pins) so this is expected to pass; the guard catches a degenerate runtime. On miss, fall back to `Date.prototype.toLocaleDateString` in `'en-US'`.

- **D-37: `latn` numbering forced on every date render** via `new Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium', numberingSystem: 'latn' })` (or per-call dateStyle). Helper exported as `formatDate(date, locale)` so call sites don't reach for `Intl` directly.

### Claude's Discretion

- Locale switcher provider placement (`<I18nextProvider>` at App.tsx root vs scoped to navigators) — planner's call; standard pattern.
- Whether to add a `tools/i18n/generate.ts` snapshot test that re-runs the LLM with a frozen seed and diffs against a checked-in expected — not blocking for MVP.
- Whether to add a Storybook/QA harness for visual locale-switching across 23 screens — not in scope; manual smoke covers it.
- How `<LanguageSheet>` and `<ChooseLanguageScreen>` share the 8-row rendering logic (a `<LanguageList>` shared component vs duplicate the FlatList) — planner's call; both are valid.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 sources

- `.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md` — **Locked requirements (21).** MUST read before planning. Includes the 5 SPEC-time decisions D-01..D-05, the boundaries list, the constraints list, and the 24-checkbox acceptance criteria.
- `.planning/ROADMAP.md` Phase 7 entry — phase goal + the Phase swap 2026-05-24 banner.
- `.planning/REQUIREMENTS.md` §v1 (I18N-01..I18N-12, REC-LIVE-13..REC-LIVE-19) + §v2 (IOS-01..07 — iOS analogues deferred).
- `.planning/STATE.md` — current phase posture + carry-forward items.

### Specs the user explicitly invoked or that govern Phase 7 behavior

- `idea-brief.md §2.1` — Locked capture spec (1080p / 30 FPS / ≥110° dFOV / ≥100 Hz IMU). Phase 7 may not regress; capture-quality cancel gates from 2026-05-17 stay live.
- `idea-brief.md §5.2` — Canonical English consent text. NOT edited in Phase 7. English remains the legal record; bilingual rendering is UX-only.
- `idea-brief.md §13` + `engineering-handoff.md §6.3` — TTS spec (en-IN female mandate). Phase 7 introduces per-locale TTS while preserving the existing owner-deviation behavior for the English locale (CLAUDE.md TTS banner).
- `engineering-handoff.md §11` — Telemetry ring buffer pattern; Phase 7 uses the existing ring + event shape, no schema change.
- `engineering-handoff.md §6.3` — Recording-cue voice spec context.
- `design-spec.md` — Design source-of-truth for the 22 existing screens. NOT edited in Phase 7. ChooseLanguageScreen is the second design carve-out (first = owner deviations in CLAUDE.md).
- `prototype.html` — Design source-of-truth for the 22 existing screens. NOT edited.
- `task-taxonomy.md` — 65-task catalog source. The full-body translations (D-01) cover name + description + instructions + examples for every task in this list.

### CLAUDE.md banners that constrain Phase 7

- `CLAUDE.md` "±1 ms drift gate relaxed 2026-05-12" banner — drift metrics continue to be measured + stamped (not gated); Phase 7's A/B drift bound (D-04) is a delta gate, not an absolute one.
- `CLAUDE.md` "Capture-quality cancel gate added 2026-05-17" banner — `fps_dropped` / `resolution_dropped` / `insufficient_frames` post-encode cancels stay live and unchanged. Phase 7 must not alter `FinalizeWorker` cancel logic.
- `CLAUDE.md` "Calibration + filename-prefix added 2026-05-22 (metadata schema 1.2.0)" banner — calibration block + filename prefix shipped; Phase 7 doesn't touch metadata schema.
- `CLAUDE.md` "Audio dropped 2026-05-11" banner — audio stays dropped; live-cam preview is video-only.
- `CLAUDE.md` "MVP descoped 2026-05-11" banner — Android-only at MVP; iOS analogues deferred. Phase 7 enforces this for its scope.
- `CLAUDE.md` "Do NOT Use" section — `react-native-vision-camera`, CameraX, MediaPipeTasksVision pod 0.10.33+ remain banned. Phase 7 doesn't introduce any of these.
- `CLAUDE.md` "TTS owner deviation" note — `apps/mobile/src/lib/ttsVoice.ts` pins to en-US for the English locale; Phase 7 preserves this for `i18n.language === 'en'` while extending the fallback chain for the other 7 locales.

### Prior phase context the user implicitly relies on

- `.planning/phases/06-tasks-history-home-tiles-lexical-search/06-CONTEXT.md` — Phase 6's `/tasks/search` (`ts_vector + GIN + pg_trgm`); Phase 7's reverse-search map produces English queries that this lexical search consumes. D-01 (lexical-only) + D-02 (pg_trgm threshold 0.3) are still in force.
- `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-CONTEXT.md` — Telemetry ring pattern + `secureMmkv` instance.
- `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-CONTEXT.md` — Practice flow shape; Phase 7's D-05 (preview-then-overlay) modifies the dim-screen render order.
- `.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md` — `HumynCapture` hand-rolled native module pattern; `HumynLivePreviewView` follows the same single-purpose-view convention.

### Hand-deviated memory pointers (already-applied owner directives)

- Memory: `feedback_ultrawide_full_capture_path.md` — ≥110° dFOV applies to the actual HEVC stream's lens; live-cam preview Surface choice in PLAN must honor this.
- Memory: `project_drift_metrics.md` — `{max, mean, p99}` drift figures per segment; A/B test reads p99 specifically.
- Memory: `feedback_d09_audibility_deferred.md` — Don't reopen the beep-audibility question.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`apps/mobile/src/ui/primitives/Sheet.tsx:31`** — RN-Modal-based bottom sheet (`transparent + animationType='slide'`). REUSE for `<LanguageSheet>` in the Profile picker (D-17). Zero new deps.
- **`apps/mobile/src/services/telemetryRing.ts:48-52`** — `telemetryRing.append(event)` with event shape `{ name, ts, props }`. REUSE for `locale_chosen` / `locale_changed` (D-30). No schema change.
- **`apps/mobile/src/native/HumynGateCamera.ts:72`** — `<HumynGateCameraView>` (Camera2-fed TextureView). DON'T reuse — Phase 7 adds a sibling `<HumynLivePreviewView>` (D-25) to keep components single-purpose.
- **`apps/mobile/src/lib/ttsVoice.ts:81`** — `await Tts.setDefaultLanguage('en-US')`. EXTEND to call with the active BCP-47 tag + walk the 5-step locale-female → en-\* fallback chain (D-31).
- **`apps/mobile/src/screens/recording/RecordingScreen.tsx:655`** — `HumynScreenBrightness.set(0.05)`. WRAP behind a brightness-state state machine for the three states (initial 15-s preview at system / dim at 0.05 / tap-revealed 10-s preview at system). Lines 267, 387, 734, 867 (`set(-1)`) stay as on-unmount / on-stop / on-failed-start restorers (D-28 references these).
- **`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt:90`** — `val inputSurface = codec.createInputSurface()`. The Surface-source A/B in PLAN (D-24) inspects whether to share this Surface, add a sibling preview Surface to the CaptureSession, or attach/detach mid-record.
- **`apps/mobile/src/screens/profile/ProfileScreen.tsx:272-294`** — Existing personal-info rows (Name / Age / Gender / Joined). New "Language" row inserts ABOVE Help Center per SPEC I18N-04 — planner identifies the exact insertion point.
- **`apps/mobile/src/navigation/OnboardingStack.tsx`** — Current order: Splash → Signup → Permissions → Compat → CompatPass → CompatFail → RigTutorial → PracticeIntro → PracticeComplete. ChooseLanguageScreen inserts between Splash and Signup per SPEC I18N-02. Planner adjusts the Stack.Screen list.
- **`apps/mobile/src/services/tasksApi.ts:69-72`** — `apiClient.getJson<TasksSearchResponse>('/tasks/search', { query, ... })`. WRAP this call with the reverse-map shim (D-14): rewrite `query` from the user's locale to canonical English before the network call. Original locale-typed query optionally logged for telemetry.

### Established Patterns

- **Hand-rolled native module per responsibility** (HumynCapture / HumynPlayer / HumynUpload / HumynGateCamera / HumynScreenBrightness / HumynBeep). Phase 7's `<HumynLivePreviewView>` follows this convention — single-purpose, ~50-150 LOC.
- **MMKV with `KEYS` constant module** (Phase 5/6 pattern in `apps/mobile/src/services/telemetryRing.ts` and elsewhere). Phase 7's `localeMmkv` instance gets its own `LOCALE_KEYS` constants module (`apps/mobile/src/i18n/storage.ts`) — `LOCALE_KEYS.CODE = 'locale.code'`, `LOCALE_KEYS.CHOSEN_AT = 'locale.chosen_at'`.
- **Telemetry-via-ring, no new endpoints** (Compat + permissions follow this; Phase 7's locale events follow the same).
- **Token-only screens** (`apps/mobile/src/ui/tokens.ts`). ChooseLanguageScreen is design-carve-out #2 and uses tokens only (D-20).
- **Owner-deviation banners** (CLAUDE.md). The TTS extension (D-31) preserves the existing en-US owner-deviation banner while extending the chain for the other 7 locales.

### Integration Points

- **i18n bootstrap at App.tsx mount** — read `localeMmkv.getString('locale.code')` BEFORE `<NavigationContainer>` renders; pass to `i18n.init({ lng, resources })` (D-23).
- **ChooseLanguageScreen MMKV gate** in OnboardingStack — render the screen iff `localeMmkv.contains('locale.chosen_at') === false`; on Continue write both keys and `navigation.replace('Signup')` (D-22).
- **Profile picker → i18n.changeLanguage → app-wide re-render** — `i18n.changeLanguage(loc)` triggers a `<I18nextProvider>` re-render which propagates through `useTranslation()` hooks across mounted screens; `localeMmkv.set('locale.code', loc)` persists. Already-mounted screens deeper in the stack pick up the new locale on next render.
- **tasksApi.ts search call** — the reverse-map shim sits between the user's input and `/tasks/search` (D-14, D-15). Backend is untouched (D-16).
- **TTS session-start** — `ttsVoice.ts` is called once per recording session; the locale-aware extension reads `i18n.language` and walks the fallback chain (D-31).
- **Recording-screen brightness state machine** — three states (initial-15s / dimmed / tap-revealed-10s) compose with the existing `HumynScreenBrightness.set(0.05)` and `set(-1)` calls (D-28).
- **<HumynLivePreviewView>** Surface wiring — depends on the PLAN-time Surface-source choice (D-24). The RN component is single-purpose either way.

</code_context>

<specifics>
## Specific Ideas

- **Locale ordering: en, pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN** (D-18). Owner-directed via Other-answer follow-up.
- **Static "Live preview" label, no numeral countdown** (D-26). Owner picked over per-second countdown.
- **No Surface-source steer from owner** (D-24). Planner compares all 3 with on-hardware drift A/B as the deciding gate.
- **Catalog generation: Claude Opus 4.7 over Sonnet 4.6** (D-10). Owner preference for the higher-quality vernacular brief tracking, despite the larger cost.

</specifics>

<deferred>
## Deferred Ideas

- **Incremental drift detection for `tools/i18n/generate.ts`** — Not in scope for Phase 7. Built-in i18next key-fallback covers the gap (D-12). Revisit if catalog regeneration becomes painful (e.g. >10 string changes per week).
- **Snapshot test for the LLM generator output** — Out of scope. Would need a frozen seed and a deterministic LLM (Anthropic doesn't expose a deterministic mode at MVP cadence).
- **Locale-switching visual regression harness across 23 screens** — Manual smoke covers it at MVP. Storybook/Detox visual diffs would be a §v2 quality investment.
- **iOS analogue for `<HumynLivePreviewView>`** — Deferred with the rest of the iOS native modules (§v2 IOS-01..07).
- **Human translator review pass** — LLM-only per I18N-05. A future review pass is out of scope for Phase 7; the LLM-generated catalogs are the MVP truth.
- **Per-locale legal counsel review** — Bilingual rendering keeps the canonical English legal record (I18N-07). Per-locale review is a §v2 question if/when the bilingual UX changes the legal posture.
- **pgvector + RRF semantic-search surface in non-English locales** — Still §v2 (SEARCH-V2-01). The Phase 7 reverse-map approach is the MVP search story for non-English locales.

### Reviewed Todos (not folded)

None — no todos surfaced via `gsd-tools query todo.match-phase 7`.

</deferred>

---

_Phase: 07-multi-linguality-live-cam-feed_
_Context gathered: 2026-05-24_
