# Phase 7: Multi-linguality & Live-Cam Feed — Research

**Researched:** 2026-05-24
**Domain:** React Native i18n runtime + LLM-driven catalog generation + Android Camera2 multi-output Surface design + recording-screen brightness state machine
**Confidence:** HIGH (i18n + catalog + brightness state machine); MEDIUM (Surface-source A/B — pending on-hardware measurement); HIGH (renumber sweep — annotations already in place)

## Summary

Phase 7 has two technically-independent tracks plus a renumber sweep. **Track 1 (multi-linguality)** introduces a brand-new i18n surface to a codebase that today has zero i18n: no library installed, all UI copy hardcoded, `ttsVoice.ts` pinned to en-US (owner deviation), dates rendered via `toLocaleDateString` defaults. The work is largely additive across 23 screens, a new `ChooseLanguageScreen`, a Profile Language row, a `tools/i18n/generate.ts` LLM catalog generator, an extended `ttsVoice.ts` fallback chain, a bilingual consent renderer, an error-code-to-toast-key map, an `Intl.DateTimeFormat` date helper, a `taskCatalog.i18n.ts` full-body translation table with a reverse-search client-side shim for `/tasks/search`, and a telemetry-ring locale event channel. The runtime stack is `react-i18next@17.0.8` + `i18next@26.2.0` (peer-pinned together) with a hand-rolled MMKV-backed locale detector (the published `i18next-react-native-language-detector` was last updated 2016 and is effectively abandoned). Catalog generation runs through `@anthropic-ai/sdk@0.98.0` with Claude Opus 4.7 as the model, 7 calls (one per non-English locale), full-catalog overwrite.

**Track 2 (live-cam preview)** breaks the 25-min dim-screen contract for two visibility windows: a 15-s initial full-screen preview after `HumynCapture.start()` succeeds, and a rolling 10-s tap-reveal in the dimmed state. The work is architecturally riskier — the recording path's `imu_video_drift_p99_ms` budget is the gating constraint via D-04's same-device same-day A/B (`(p99_on - p99_off) / p99_off < 0.50`). Three Camera2 Surface-source strategies are on the table: (A) split the encoder's `inputSurface` via a SurfaceTexture intermediate, (B) add a sibling preview-target Surface to the existing single-output CaptureSession (changing `createCaptureSession(listOf(surface), ...)` at `CaptureSession.kt:600` to a two-Surface list), or (C) reconfigure the CaptureSession mid-record to attach/detach the preview Surface only during the 15-s + 10-s windows. This research recommends **Option B as the leading hypothesis** based on Android Camera2 documentation (the platform natively supports multiple simultaneous output targets, and every Camera2-supporting device since API 21 can drive ≥3 simultaneous PRIV streams) — but the call must be made by on-hardware A/B drift measurement during PLAN time. The capture-quality cancel gates (`fps_dropped` / `resolution_dropped` / `insufficient_frames`) and the recorded drift telemetry are non-negotiable; preview is purely a UX feature.

**Track 3 (renumber sweep)** is mostly already done — the live planning artifacts (ROADMAP, STATE, REQUIREMENTS, CLAUDE.md) already carry the explicit "was Phase 7 pre-2026-05-24 renumber" annotations that SPEC I18N-20 grandfathers in. The remaining work is verifying no live PLAN/SUMMARY/VERIFICATION doc in an unshipped phase directory still refers to "Phase 7" in an observability context; there is no `/phases/08-*/` directory yet, so the only verification surface is a grep against `phases/07-multi-linguality-live-cam-feed/` itself.

**Primary recommendation:** Wave 1 = i18n infrastructure (deps, MMKV instance, App.tsx bootstrap, catalog generator + 8 baseline JSONs); Wave 2 = i18n screen-by-screen rollout + TTS fallback chain + reverse-search; Wave 3 = live-cam preview with Surface-source A/B drift measurement against a Pixel 10a baseline as the gating step; Wave 4 = manual smoke + renumber-sweep grep gate.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**SPEC-time D-decisions (D-01..D-05):**

- **D-01** — Task body fully translated (name + description + instructions + examples), not just name.
- **D-02** — Profile picker is tap-to-commit + auto-dismiss; no Apply button.
- **D-03** — Help Center body fully translates (Instructions / FAQs / Troubleshooting all in scope).
- **D-04** — Drift regression gate: same-device same-day A/B, `(p99_on - p99_off) / p99_off < 0.50`.
- **D-05** — Practice flow shows the 15-s full-screen preview FIRST (no practice instructional copy during the preview), THEN fade-to-dim + render the practice copy.

**Discuss-phase D-decisions (D-06..D-37):**

- **D-06** — i18n runtime: `react-i18next` + `i18next`. `i18next-react-native-language-detector` OR a hand-rolled MMKV-backed detector (planner's call).
- **D-07** — Catalog shape: monolithic JSON per locale under `apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json`; deeply-nested keys.
- **D-08** — Locale-key naming: `screen.section.element` (three-level dotted path, lowercase); pluralizable strings use i18next's `_one` / `_other` suffix.
- **D-09** — Bilingual consent: composite key with two keys + view-side composition (English at the same key in `en.json`, loaded via `i18n.getFixedT('en')` for the underlay).
- **D-10** — LLM: Claude Opus 4.7 via `@anthropic-ai/sdk`; ANTHROPIC_API_KEY from `tools/.env`; the vernacular brief lives verbatim in source as the `system` prompt.
- **D-11** — 7 calls (one per non-English locale), full-catalog overwrite, manual `pnpm i18n:generate` trigger.
- **D-12** — Catalog drift: rely on i18next built-in key-fallback to English; no git-hook auto-regen.
- **D-13** — Cost: ~$5-15 per full regen; not a meaningful constraint.
- **D-14** — Reverse-search map: per-locale full-string lookup → token-fallback → passthrough.
- **D-15** — Reverse-map source-of-truth: `taskCatalog.i18n.ts` (same file that powers UI); computed at module-load time.
- **D-16** — No backend changes; `/tasks/search` + `ts_vector + pg_trgm` unchanged.
- **D-17** — Bottom-sheet picker: reuse existing `Sheet` primitive at `apps/mobile/src/ui/primitives/Sheet.tsx`; new `LanguageSheet` composes Sheet + FlatList. Zero new deps. NOT `@gorhom/bottom-sheet`.
- **D-18** — Locale ordering on both surfaces: `[en, pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN]`.
- **D-19** — Row presentation: native name on left, English name on right (lucide `Check` icon on selected row).
- **D-20** — ChooseLanguageScreen is design carve-out #2; uses `apps/mobile/src/ui/tokens.ts` only; no diffs to the 3 locked design files.
- **D-21** — Locale state lives in a NEW non-secure MMKV instance `localeMmkv` (NOT `secureMmkv`); two keys: `locale.code` (BCP-47), `locale.chosen_at` (ISO timestamp).
- **D-22** — ChooseLanguageScreen render gate: `localeMmkv.contains('locale.chosen_at') === false`. Continue → set both keys + `navigation.replace('Signup')`. Reset gate on delete-account / fresh install.
- **D-23** — i18n bootstrap order: `localeMmkv.getString('locale.code')` is read BEFORE the navigator renders at App.tsx mount; pass `lng` to `i18n.init`.
- **D-24** — Surface-source choice DEFERRED TO PLAN.md per REC-LIVE-19. No owner steer. A/B drift bound is the gate. SPEC pre-commits only that Stop stays hit-testable in all three states.
- **D-25** — New `<HumynLivePreviewView>` native component, not a dual-mode reuse of `<HumynGateCameraView>`. Does NOT open a camera client — it exposes a Surface the recording path renders into.
- **D-26** — Countdown indicator copy: static `"Live preview"` label (translated key `recording.preview.live`). No per-second numeral countdown.
- **D-27** — Eye-icon: lucide-react-native `Eye` at low opacity, bottom-right corner.
- **D-28** — Tap-zone: full-surface `Pressable` overlay covering the entire RecordingScreen surface EXCEPT the Stop hit-zone. Stop absolute-positions ABOVE the Pressable in the z-stack. Single onPress fires: (1) cancel pending fade timer, (2) restore brightness via `HumynScreenBrightness.set(-1)`, (3) render preview View, (4) start fresh 10-s timer.
- **D-29** — Tap-during-preview semantics: timer reset (rolling, not accumulating); single `useRef<NodeJS.Timeout | null>(null)` cleared + reassigned per tap.
- **D-30** — Locale events: existing `telemetryRing.append()` API; event shapes `{ name: 'locale_chosen', ts, props: { installation_id, chosen_locale } }` and `{ name: 'locale_changed', ts, props: { installation_id, from_locale, to_locale } }`.
- **D-31** — TTS extension: `Tts.setDefaultLanguage(activeLocaleBcp47)` then walks the 5-step chain (locale-female → locale-any → en-US-female → en-US-any → first en-\*). Falling back to step 3+ emits a Crashlytics breadcrumb.
- **D-32** — Bilingual consent composition: view-side, not catalog-side. `TermsOfUseModal.tsx` reads `t('terms.consent.body')` for active locale AND `i18n.getFixedT('en')('terms.consent.body')` for the English underlay. Suppress underlay when `i18n.language === 'en'`.
- **D-33** — Sign-up POST payload unchanged. `CONSENT_TEXT_VERSION_EN` continues to reference canonical English regardless of active locale.
- **D-34** — Error-code → toast-key map at `apps/mobile/src/i18n/errorMap.ts` as a plain `Record<string, string>`.
- **D-35** — Crashlytics breadcrumb on every API error: `{ code, raw_detail }` (English detail).
- **D-36** — Intl availability guard at module init in `apps/mobile/src/lib/dates.ts` (new file or extend existing).
- **D-37** — `latn` numbering forced on every date render via `new Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium', numberingSystem: 'latn' })`; exported as `formatDate(date, locale)`.

### Claude's Discretion

- Locale switcher provider placement (`<I18nextProvider>` at App.tsx root vs scoped to navigators) — standard pattern.
- Whether to add a `tools/i18n/generate.ts` snapshot test that re-runs the LLM with a frozen seed and diffs against a checked-in expected — not blocking for MVP.
- Whether to add a Storybook/QA harness for visual locale-switching across 23 screens — not in scope; manual smoke covers it.
- How `<LanguageSheet>` and `<ChooseLanguageScreen>` share the 8-row rendering logic (a `<LanguageList>` shared component vs duplicate the FlatList).

### Deferred Ideas (OUT OF SCOPE)

- Incremental drift detection for `tools/i18n/generate.ts`.
- Snapshot test for the LLM generator output.
- Locale-switching visual regression harness across 23 screens.
- iOS analogue for `<HumynLivePreviewView>`.
- Human translator review pass.
- Per-locale legal counsel review.
- pgvector + RRF semantic-search surface in non-English locales (still §v2 SEARCH-V2-01).

## Project Constraints (from CLAUDE.md)

These directives have the same authority as locked decisions:

- **GSD workflow enforcement** — All file changes flow through GSD commands (`/gsd-execute-phase 7` for this work). [VERIFIED: ./CLAUDE.md "GSD Workflow Enforcement" section]
- **Drift gate relaxed but recorded** — `imu_video_drift_{max,mean,p99}_ms` continues to be measured + stamped per segment; the original ±1 ms gate is relaxed. Phase 7's D-04 A/B is the only drift gate. The ultrawide lens code is NOT to be changed. [VERIFIED: ./CLAUDE.md "±1 ms drift gate relaxed 2026-05-12" banner]
- **Capture-quality cancel gate unchanged** — `mean_fps < 29` (`fps_dropped`), MP4 track-header `<1920×1080` (`resolution_dropped`), `videoFrameTimestamps.size < 2` (`insufficient_frames`). Phase 7 must NOT alter `FinalizeWorker` cancel logic. [VERIFIED: ./CLAUDE.md "Capture-quality cancel gate added 2026-05-17" banner]
- **Calibration block always present** — `metadata.json` carries the `calibration` block on every segment; Phase 7 doesn't touch metadata schema. [VERIFIED: ./CLAUDE.md "Calibration + filename-prefix added 2026-05-22" banner]
- **Audio stays dropped** — Live-cam preview is video-only; do NOT reintroduce audio capture. [VERIFIED: ./CLAUDE.md "Audio dropped 2026-05-11" banner]
- **Android only at MVP** — No file under `apps/mobile/ios/` is modified. iOS analogues stay deferred per §v2 IOS-01..07. [VERIFIED: ./CLAUDE.md "MVP descoped 2026-05-11" banner]
- **TTS owner deviation preserved for `en`** — `ttsVoice.ts` pins to en-US for the English locale (NOT en-IN). Phase 7 preserves this when `i18n.language === 'en'` while extending the fallback chain for the other 7 locales. [VERIFIED: ./CLAUDE.md TTS owner deviation note + `apps/mobile/src/lib/ttsVoice.ts` header comment]
- **Do NOT Use list applies** — No `react-native-vision-camera` (any role), no CameraX, no `MediaPipeTasksVision` pod ≥ 0.10.33, no AsyncStorage, no `react-native-background-fetch`. [VERIFIED: ./CLAUDE.md "Do NOT Use" section]
- **Design files NOT edited** — `prototype.html` / `design-spec.md` / `engineering-handoff.md` stay untouched. `ChooseLanguageScreen` is the second design carve-out (first = CLAUDE.md owner deviations). [VERIFIED: ./CLAUDE.md "Designs LOCKED" line]
- **`idea-brief.md §5.2` NOT edited** — Canonical English consent text unchanged; bilingual rendering is UX-only. [VERIFIED: ./CLAUDE.md "Privacy / consent" line]
- **Conventional Commits + author identity** — Commits via Adnaan Mohammed <m.adnaan161@gmail.com>. [VERIFIED: memory `feedback_git_commit_email.md`]
- **Functionality first during smoke walks** — Cosmetic issues defer to a later cleanup wave; don't rebuild mid-smoke. [VERIFIED: memory `feedback_functionality_first_during_smoke.md`]

## Phase Requirements

| ID          | Description                                        | Research Support                                                          |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| I18N-01     | 8 locales selectable + active                      | "Standard Stack" (i18next 26 + react-i18next 17) + "i18n Runtime" section |
| I18N-02     | ChooseLanguageScreen first-launch only, MMKV-gated | "MMKV bootstrap order" section + D-21..D-23                               |
| I18N-03     | ChooseLanguageScreen designed against tokens       | "Project Constraints" (design files untouched) + D-20                     |
| I18N-04     | Profile Language row + immediate-commit picker     | "Reuse Sheet primitive" code-context note + D-17..D-19                    |
| I18N-05     | LLM-generated catalogs with vernacular brief       | "Catalog Generation Tool" section + D-10..D-13                            |
| I18N-06     | Per-locale device TTS with fallback chain          | "Per-locale TTS fallback chain" section + D-31                            |
| I18N-07     | Bilingual consent rendering                        | "Bilingual consent rendering" section + D-09, D-32, D-33                  |
| I18N-08     | API error code → translated toast                  | "Error-code map" pattern + D-34, D-35                                     |
| I18N-09     | Locale-aware date formatting with `latn` numerals  | "Date formatting" section + D-36, D-37                                    |
| I18N-10     | Task body fully translated + reverse-search map    | "Reverse-search map architecture" section + D-14..D-16                    |
| I18N-11     | Phase 6 cosmetic gaps NOT re-opened                | Constraint, not a research output (planner enforces)                      |
| I18N-12     | Locale telemetry through existing ring             | "Telemetry" subsection + D-30 + `telemetryRing.append` reuse              |
| REC-LIVE-01 | 15-s full-screen preview on Start                  | "Brightness state machine" section + Surface-source A/B                   |
| REC-LIVE-02 | Tap-reveal rolling 10-s preview                    | "Tap-zone implementation" section + D-28, D-29                            |
| REC-LIVE-03 | Brightness wrapper drives both windows             | "Brightness state machine" section + D-28                                 |
| REC-LIVE-04 | Applies to BOTH practice + real flows              | "Brightness state machine" section + D-05                                 |
| REC-LIVE-05 | Drift telemetry unchanged; A/B regression bound    | "Surface-source A/B" section + D-04                                       |
| REC-LIVE-06 | Surface-approach chosen during planning            | "Surface-source A/B" section — leading hypothesis + on-hardware A/B plan  |
| REC-LIVE-07 | Capture-quality cancel gates unchanged             | "Project Constraints" cancel-gate banner                                  |

## Architectural Responsibility Map

| Capability                             | Primary Tier                               | Secondary Tier                            | Rationale                                                                                                                    |
| -------------------------------------- | ------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Locale chosen + persisted              | Mobile JS (MMKV)                           | —                                         | Locale is per-device, per-install state; no server roundtrip needed (telemetry is fire-and-forget through the existing ring) |
| UI string translation                  | Mobile JS (i18next runtime)                | —                                         | Catalogs bundle at build time; runtime is purely JS                                                                          |
| TTS voice selection                    | Mobile JS → native TTS engine              | —                                         | `react-native-tts` bridges JS to Android `TextToSpeech`; voice enumeration happens on the JS side                            |
| Bilingual consent rendering            | Mobile JS (view composition)               | —                                         | View-side per D-32; server unchanged                                                                                         |
| API error → translated toast           | Mobile JS (error map)                      | —                                         | Server `detail` stays English; client maps `code` to a translated key                                                        |
| Date formatting                        | Mobile JS (Hermes Intl)                    | —                                         | Hermes ships ICU; no native bridge needed                                                                                    |
| Reverse-search map for `/tasks/search` | Mobile JS (`tasksApi.ts` shim)             | Backend (unchanged)                       | Backend is canonical English `ts_vector`; mobile rewrites the query before the network call                                  |
| LLM catalog generation                 | Node.js tooling (`tools/i18n/generate.ts`) | —                                         | Runs offline at build time; not in mobile bundle                                                                             |
| Live-cam preview Surface               | Android native (Camera2)                   | Mobile JS (`<HumynLivePreviewView>` host) | The Camera2 multi-output decision lives entirely in native Kotlin; JS owns the brightness state machine + tap timer          |
| Brightness state machine               | Mobile JS (RecordingScreen useEffect)      | Native (`HumynScreenBrightness`)          | JS owns the 3-state timer logic; native wrapper is unchanged                                                                 |
| Drift A/B measurement                  | Manual smoke runbook                       | Mobile JS (existing drift telemetry)      | Drift is already stamped per-segment in `metadata.json`; the A/B reads the stamped values                                    |

## Standard Stack

### Core (new for Phase 7)

| Library             | Version | Purpose                                                           | Why Standard                                                            |
| ------------------- | ------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `i18next`           | 26.2.0  | i18n engine, CLDR plural rules, key-fallback, namespace lazy-load | The de-facto JS i18n runtime; what `react-i18next@17` peer-pins         |
| `react-i18next`     | 17.0.8  | React bindings (`useTranslation`, `<I18nextProvider>`, `Trans`)   | The standard React wrapper for i18next; required to make `t()` reactive |
| `@anthropic-ai/sdk` | 0.98.0  | Claude Opus 4.7 client for `tools/i18n/generate.ts`               | Official Anthropic TypeScript SDK; Node ≥18; per D-10                   |

`[VERIFIED: npm view react-i18next version → 17.0.8]`
`[VERIFIED: npm view i18next version → 26.2.0]`
`[VERIFIED: npm view @anthropic-ai/sdk version → 0.98.0, published 2 days ago as of 2026-05-24]`
`[CITED: https://github.com/i18next/react-i18next/blob/master/package.json — react-i18next@17.0.8 peer dep "i18next: >=26.2.0", "react: >=16.8.0"]`

### Supporting (already installed — Phase 7 reuses)

| Library                              | Version  | Purpose                                                          | When to Use                                                |
| ------------------------------------ | -------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `react-native-mmkv`                  | 4.3.1    | NEW `localeMmkv` instance for `locale.code` + `locale.chosen_at` | At App.tsx bootstrap + on every locale commit (D-21..D-23) |
| `react-native-tts`                   | 4.1.1    | Per-locale `Tts.setDefaultLanguage` + `Tts.setDefaultVoice`      | At RecordingScreen mount + on locale change (D-31)         |
| `lucide-react-native`                | 1.14.0   | `Check` (row selection), `Eye` (tap-affordance glyph)            | D-19 (row check), D-27 (eye icon)                          |
| `react-native-svg`                   | ≥15.15.4 | Existing — no new use                                            | Not new for Phase 7                                        |
| `@react-native-firebase/crashlytics` | 24.0.0   | TTS fallback breadcrumb + API error breadcrumb                   | D-31, D-35                                                 |
| `zod`                                | ^4.4.3   | Validate locale code at boot (one of the 8 BCP-47 tags)          | At App.tsx hydrate before `i18n.init`                      |

`[VERIFIED: apps/mobile/package.json — all 6 already in dependencies]`

### Alternatives Considered

| Instead of                              | Could Use                                | Tradeoff                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react-i18next@17` + `i18next@26`       | LinguiJS                                 | Lingui is compile-time-extraction-based; nice DX but adds a Babel macro + a `.po` file format that doesn't match our LLM-emits-JSON catalog model. react-i18next runtime matches what D-10's generator naturally produces.                                                                                                                       |
| Hand-rolled MMKV-backed locale detector | `i18next-react-native-language-detector` | Published 2016 (last version 1.0.2, 2016-09-12); unmaintained for 10 years; predates RN New Architecture / Hermes / TurboModules entirely. **Strong recommendation: hand-roll a ~30-line detector** that reads `localeMmkv.getString('locale.code')` synchronously.                                                                              |
| Hand-rolled MMKV-backed locale detector | `react-native-localize@3.7.0`            | Maintained native module that exposes the device's locale list. Adds a native dep + autolinking step to the Android build for a single use (the default-selection hint on ChooseLanguageScreen). Could be added if planner wants device-locale-aware default selection; not strictly required (D-22 default is English-pre-selected regardless). |
| `@gorhom/bottom-sheet`                  | Existing `Sheet` primitive               | Per D-17, reuse `Sheet.tsx` (RN Modal with `transparent + animationType='slide'`) for `LanguageSheet` — zero new deps.                                                                                                                                                                                                                           |
| LLM catalog gen via `@anthropic-ai/sdk` | OpenAI / Google APIs                     | Owner picked Claude Opus 4.7 (D-10).                                                                                                                                                                                                                                                                                                             |

**Installation:**

```bash
cd apps/mobile
npm install --save i18next@^26.2.0 react-i18next@^17.0.8

# tools/ (new directory at repo root)
cd ../../tools
# package.json setup with @anthropic-ai/sdk@^0.98.0
npm init -y
npm install --save @anthropic-ai/sdk@^0.98.0 zod@^4.4.3
npm install --save-dev typescript@^5.6.3 tsx@^4.0.0
```

**Version verification (current as of 2026-05-24):**

- `react-i18next@17.0.8` — published recently per WebFetch of the package.json
- `i18next@26.2.0` — minimum required peer of react-i18next 17.x
- `@anthropic-ai/sdk@0.98.0` — published ~2 days before 2026-05-24

## Architecture Patterns

### System Architecture Diagram

```
                        BOOT
                          │
                          ▼
    ┌───────────────── App.tsx ─────────────────┐
    │  1. enableScreens(true)                   │
    │  2. hydrate()        ← Zustand from MMKV  │
    │  3. localeBootstrap()  ← NEW             │
    │       reads localeMmkv.getString('locale.code')  ─┐
    │       defaults to 'en' if unset                    │
    │       calls i18n.init({ lng, resources })          │
    │  4. installBootRecoveryListener()                  │
    │  5. installUploadReconcile()                       │
    └───────────────────┬───────────────────────┘        │
                        ▼                                 │
                  <I18nextProvider>                       │
                        │                                 │
                        ▼                                 │
              <NavigationContainer>                       │
                        │                                 │
                        ▼                                 │
              RootNativeStack                             │
                  ├── OnboardingStack ──┐                 │
                  │      Splash         │                 │
                  │      ChooseLanguage ← gated on        │
                  │      Signup          localeMmkv       │
                  │      Permissions    │                 │
                  │      Compat         │                 │
                  │      RigTutorial    │                 │
                  │      PracticeIntro  │                 │
                  │      Recording ← live-cam preview wave│
                  │      PracticeComplete                 │
                  ├── MainTabs                            │
                  │      Home / Tasks / History           │
                  └── Profile ─── ProfileScreen           │
                         (Language row → LanguageSheet)   │
                                                          │
   Locale change                                          │
       │                                                  │
       ▼                                                  │
   i18n.changeLanguage(loc) ──┬──► <I18nextProvider> re-renders
                              │                           │
                              └──► localeMmkv.set('locale.code', loc) ─┘
                                   localeMmkv.set('locale.chosen_at', iso)
                                   telemetryRing.append({ name: 'locale_changed', ... })


   Catalog generation (offline, manual)
   ───────────────────────────────────────
   tools/i18n/generate.ts
       │
       ▼
   en.json (source of truth, hand-authored from existing screens)
       │
       ▼  (× 7 calls, one per non-English locale)
   @anthropic-ai/sdk Messages.create({
       model: 'claude-opus-4-7',
       system: VERNACULAR_BRIEF,
       messages: [{ role: 'user', content: 'Translate to {locale}: ...' }]
     })
       │
       ▼
   {pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json (overwrites)


   Reverse-search shim (per /tasks/search request)
   ────────────────────────────────────────────────
   user input "चाय बनाओ"           taskCatalog.i18n.ts
        │                              │
        ▼                              ▼
   tasksApi.ts:searchTasks ──► reverseSearch(input, locale)
                                     │
                                     ├─ Stage 1: full-string lookup
                                     │     { 'चाय बनाओ': 'Make tea' }
                                     │     → 'Make tea'
                                     ├─ Stage 2: token-fallback
                                     │     tokenize + map per locale
                                     │     → 'make tea'
                                     └─ Stage 3: passthrough
                                           → raw input
                                     │
                                     ▼
                              apiClient.getJson('/tasks/search', { query: <english> })
                                     │
                                     ▼
                              Backend: ts_vector + GIN + pg_trgm (UNCHANGED)


   Live-cam preview Surface (THREE CANDIDATES — A/B picks)
   ────────────────────────────────────────────────────────
   HumynCapture.start()
        │
        ▼
   CaptureSession.kt openCaptureSession
        │
        ├─ Option A: SurfaceTexture splits codec.createInputSurface()
        │     codec inputSurface → SurfaceTexture → both encoder + preview
        │     (encoder reads same Surface; preview composites the SurfaceTexture)
        │
        ├─ Option B [LEADING] : two-Surface CaptureSession
        │     createCaptureSession(listOf(encoderSurface, previewSurface), ...)
        │     CaptureRequest.Builder.addTarget(encoderSurface)
        │     CaptureRequest.Builder.addTarget(previewSurface) ← only during 15s + 10s windows
        │
        └─ Option C: reconfigure mid-record
              start with single-Surface, then createCaptureSession(both) during windows
              then revert to single-Surface for dimmed periods


   Brightness state machine (RecordingScreen)
   ──────────────────────────────────────────
   substate = 'active' AND first frame stamped
        │
        ▼
   STATE 1: initial-preview (15s)
        brightness = system (set(-1))
        <HumynLivePreviewView> visible
        Stop button visible
        timer T1 = setTimeout(15000, → STATE 2)
        │
        ▼
   STATE 2: dimmed
        brightness = 0.05 (existing set(0.05) call)
        <HumynLivePreviewView> hidden
        Eye icon glyph visible bottom-right
        Stop button visible
        full-surface Pressable active (under Stop in z-stack)
        │  tap detected (NOT on Stop)
        ▼
   STATE 3: tap-revealed (10s rolling)
        brightness = system (set(-1))
        <HumynLivePreviewView> visible
        Eye icon hidden
        Stop button visible
        timer T2 = setTimeout(10000, → STATE 2)
        each new tap: clearTimeout(T2); T2 = setTimeout(10000, ...)
```

### Recommended Project Structure

```
apps/mobile/
├── src/
│   ├── i18n/                            # NEW
│   │   ├── index.ts                     # i18n.init({ resources }) + types
│   │   ├── locales/
│   │   │   ├── en.json                  # SOURCE OF TRUTH (hand-authored)
│   │   │   ├── pt-BR.json               # LLM-generated
│   │   │   ├── es.json                  # LLM-generated
│   │   │   ├── hi-IN.json               # LLM-generated
│   │   │   ├── bn-IN.json               # LLM-generated
│   │   │   ├── ta-IN.json               # LLM-generated
│   │   │   ├── te-IN.json               # LLM-generated
│   │   │   └── mr-IN.json               # LLM-generated
│   │   ├── storage.ts                   # localeMmkv + LOCALE_KEYS constants
│   │   ├── bootstrap.ts                 # localeBootstrap() — read MMKV before i18n.init
│   │   ├── errorMap.ts                  # API code → translation key map (D-34)
│   │   ├── taskCatalog.i18n.ts          # 65 tasks × 8 locales + reverse-search tables
│   │   └── reverseSearch.ts             # Stage 1/2/3 reverse-map logic (D-14)
│   ├── lib/
│   │   ├── ttsVoice.ts                  # EXTENDED — 5-step fallback chain (D-31)
│   │   └── dates.ts                     # NEW (or extend) — formatDate(date, locale) (D-37)
│   ├── components/
│   │   ├── LanguageList.tsx             # NEW — shared row rendering (Claude's discretion)
│   │   └── LanguageSheet.tsx            # NEW — bottom-sheet wrapper using Sheet primitive
│   ├── screens/
│   │   ├── chooseLanguage/              # NEW
│   │   │   └── ChooseLanguageScreen.tsx
│   │   ├── recording/
│   │   │   └── RecordingScreen.tsx      # EXTENDED — brightness state machine + tap zone
│   │   ├── profile/
│   │   │   └── ProfileScreen.tsx        # EXTENDED — new Language row above Help Center
│   │   └── (every other screen)         # EXTENDED — t() instead of string literals
│   └── navigation/
│       └── OnboardingStack.tsx          # EXTENDED — ChooseLanguage between Splash and Signup
│
├── android/app/src/main/java/ai/humynlabs/capture/
│   ├── capture/
│   │   ├── CaptureSession.kt            # EXTENDED — multi-Surface mode (PLAN's Surface choice)
│   │   └── HevcEncoder.kt               # UNCHANGED — encoder Surface stays the muxer feed
│   └── livepreview/                     # NEW directory
│       ├── HumynLivePreviewModule.kt    # NEW — Surface lifecycle
│       └── HumynLivePreviewViewManager.kt  # NEW — RN ViewManager (TextureView)
│
tools/                                    # NEW directory at repo root
├── package.json                         # NEW — @anthropic-ai/sdk dep
├── .env                                 # NEW — ANTHROPIC_API_KEY (gitignored)
└── i18n/
    ├── generate.ts                      # NEW — manual `pnpm i18n:generate` entry
    └── vernacularBrief.ts               # NEW — the verbatim system prompt
```

### Pattern 1: i18n bootstrap before navigator

```typescript
// apps/mobile/App.tsx (EXTENDED)
// Source: react-i18next docs + D-23
import './src/i18n';   // side-effect: runs i18n.init() with localeMmkv read
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';

export default function App() {
  // existing useEffect for boot listeners stays
  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNativeStack />
        </NavigationContainer>
        <ToastHost />
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

// apps/mobile/src/i18n/index.ts
// Source: i18next docs + D-07 + D-23
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { localeBootstrap } from './bootstrap';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';
import hiIN from './locales/hi-IN.json';
import bnIN from './locales/bn-IN.json';
import taIN from './locales/ta-IN.json';
import teIN from './locales/te-IN.json';
import mrIN from './locales/mr-IN.json';

const lng = localeBootstrap();  // sync MMKV read, returns 'en' if unset

i18n
  .use(initReactI18next)
  .init({
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },  // React already escapes
    compatibilityJSON: 'v4',
    resources: {
      en: { translation: en },
      'pt-BR': { translation: ptBR },
      es: { translation: es },
      'hi-IN': { translation: hiIN },
      'bn-IN': { translation: bnIN },
      'ta-IN': { translation: taIN },
      'te-IN': { translation: teIN },
      'mr-IN': { translation: mrIN },
    },
  });

export default i18n;
```

`[CITED: https://react.i18next.com/getting-started — Provider placement and i18n.init pattern]`

### Pattern 2: tap-zone z-stack with Stop ABOVE Pressable

```tsx
// apps/mobile/src/screens/recording/RecordingScreen.tsx (EXTENDED — D-28)
// The Pressable covers the entire surface; the Stop button is absolutely
// positioned ON TOP so its onPress wins React Native's hit-test.
// Pattern: React Native hit-test descends to the topmost responder, so
// the Stop button MUST be rendered AFTER (later in JSX) the Pressable.

<View style={StyleSheet.absoluteFill}>
  {/* z = 0: Live preview (visible during initial-15s + tap-10s states) */}
  {previewVisible && <HumynLivePreviewView style={StyleSheet.absoluteFill} />}

  {/* z = 1: full-surface Pressable for tap-to-reveal (active in dimmed state only) */}
  {brightnessState === 'dimmed' && (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={handleTapReveal}
      accessibilityLabel="Reveal live preview"
    />
  )}

  {/* z = 2: Stop button — last in JSX so it wins hit-test in all 3 states */}
  <View style={styles.stopButtonContainer} pointerEvents="box-none">
    <StopButton onPress={handleStop} />
  </View>

  {/* z = 3: Eye icon glyph (visible in dimmed state only) */}
  {brightnessState === 'dimmed' && (
    <View style={styles.eyeIconCorner} pointerEvents="none">
      <Eye color={colors.dimGlyph} size={24} />
    </View>
  )}
</View>
```

`[ASSUMED: React Native hit-test ordering — confirmed via RN docs in training but not re-verified in this session]`

### Pattern 3: Reverse-search shim

```typescript
// apps/mobile/src/i18n/reverseSearch.ts (NEW — D-14, D-15)
import { TASK_CATALOG_I18N } from './taskCatalog.i18n';

interface ReverseMap {
  fullStringMap: Record<string, string>; // 'चाय बनाओ' → 'Make tea'
  tokenMap: Record<string, string>; // 'चाय' → 'tea', 'बनाओ' → 'make'
}

// Computed once at module load — D-15 says module-load time, not pre-built JSON.
const REVERSE_BY_LOCALE: Record<string, ReverseMap> = buildReverseMaps(TASK_CATALOG_I18N);

export function reverseSearch(input: string, locale: string): string {
  if (locale === 'en' || !REVERSE_BY_LOCALE[locale]) return input;
  const map = REVERSE_BY_LOCALE[locale];

  // Stage 1: full-string lookup (case-insensitive, NFC-normalized)
  const normalized = input.trim().normalize('NFC').toLowerCase();
  const hit = map.fullStringMap[normalized];
  if (hit) return hit;

  // Stage 2: token-fallback
  const tokens = input
    .trim()
    .split(/\s+/)
    .map((t) => t.normalize('NFC').toLowerCase());
  const mapped = tokens.map((t) => map.tokenMap[t] ?? t);
  // If at least one token was mapped, return the rebuilt English query
  if (mapped.some((t, i) => t !== tokens[i])) return mapped.join(' ');

  // Stage 3: passthrough — let pg_trgm try
  return input;
}
```

### Anti-Patterns to Avoid

- **Async i18n bootstrap at App.tsx**. If `i18n.init` is awaited inside a useEffect, the first frame renders in English regardless of the user's stored locale → ChooseLanguageScreen flickers if it's the gate-passing screen. `MMKV.getString` is synchronous; do the read BEFORE `<NavigationContainer>` mounts (D-23).
- **Putting locale in `secureMmkv`**. Locale is not a secret; `secureMmkv` is encrypted-at-rest and reserved for tokens / telemetry ring / PII-adjacent ledgers. Use a new `localeMmkv` instance per D-21.
- **Letting the LLM generate the `en.json`**. English is the source of truth. The LLM only produces the 7 non-English files; `en.json` is hand-authored from existing screen strings.
- **Embedding the canonical English consent text inside non-English JSON values**. Per D-09 / D-32, both translated and English live under the SAME key `terms.consent.body`; the view composes them. Embedding English inside non-English values bloats the catalogs and creates a sync hazard if `idea-brief.md §5.2` ever changes.
- **Changing `FinalizeWorker` cancel logic for any reason**. The capture-quality cancel gates (`fps_dropped` / `resolution_dropped` / `insufficient_frames`) are non-negotiable per the 2026-05-17 banner. The live-cam preview must not "soften" them.
- **Re-introducing `react-native-vision-camera` for the live preview**. It's banned per CLAUDE.md "Do NOT Use". The native `<HumynLivePreviewView>` is the only path.

## Don't Hand-Roll

| Problem                        | Don't Build                                    | Use Instead                                                | Why                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plural rules per locale        | Per-locale `if/else` plural logic              | i18next built-in (CLDR-based)                              | i18next ships every locale's plural-category function; 8 locales' rules are not trivial (hi-IN has its own categories)                                        |
| Locale-to-flag-emoji mapping   | Hand-written switch statement                  | Native-name string (D-19)                                  | No flag rendering needed; D-19 specifies native name + English name                                                                                           |
| Locale negotiation algorithm   | Hand-rolled BCP-47 parser                      | i18next `fallbackLng: 'en'`                                | Built-in; key-fallback on missing strings to English                                                                                                          |
| Bidirectional date formatting  | Hand-rolled formatter per locale               | `Intl.DateTimeFormat(locale, { numberingSystem: 'latn' })` | Hermes ships ICU; `latn` numbering keeps digits Latin (D-37)                                                                                                  |
| TTS locale-to-voice resolution | Hand-rolled voice filter                       | `Tts.voices()` + `setDefaultLanguage` + `setDefaultVoice`  | The Android `TextToSpeech.Engine` already runs its own resolution; we layer a preference filter on top                                                        |
| Camera2 multi-Surface routing  | Hand-rolled Surface-multiplexer                | Native multi-output `CaptureSession` (Option B)            | Android Camera2 natively supports up to 3 simultaneous PRIV streams per API 21+ device; `createCaptureSession(listOf(s1, s2), ...)` is the documented pattern |
| Locale-aware bottom-sheet      | New gesture library                            | Existing `Sheet` primitive                                 | D-17 — `apps/mobile/src/ui/primitives/Sheet.tsx` already wraps `<Modal transparent animationType='slide'>`; reusing it is zero-deps                           |
| MMKV locale detector           | `i18next-react-native-language-detector@1.0.2` | Hand-rolled (~30 LOC)                                      | The published detector hasn't been updated since 2016 (pre-Hermes, pre-New-Arch). Reading MMKV synchronously at boot is ~3 lines                              |

**Key insight:** The i18n track has near-zero custom-runtime risk because the i18next ecosystem covers every edge (plurals, key-fallback, interpolation, React rerender on language change). The risk is concentrated in two places: (1) the LLM catalog quality (D-12 says rely on key-fallback if a translation is missing — accept this), and (2) the reverse-search token table coverage for the 5 Indic locales (Bengali / Tamil / Telugu / Marathi tokenization is non-trivial).

## Runtime State Inventory

> Phase 7 is mostly greenfield (i18n didn't exist before) plus an additive recording-screen feature. The renumber sweep is the only rename-style work — most of it is already completed in the live planning artifacts.

| Category            | Items Found                                                                                                              | Action Required                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Stored data         | None — `localeMmkv` is a NEW instance; the existing `secureMmkv` keys are untouched. No DB migration. No S3 key changes. | None (no migration; the new MMKV instance starts empty on every install)                    |
| Live service config | None — no n8n / Datadog / Cloudflare Tunnel config references "Phase 7"                                                  | None                                                                                        |
| OS-registered state | None — no Windows Task Scheduler / pm2 / launchd / systemd state for this Android-only app                               | None                                                                                        |
| Secrets / env vars  | NEW `ANTHROPIC_API_KEY` in `tools/.env` (gitignored). Existing `apps/api/.env` + `apps/mobile/.env.*` untouched.         | Operator generates a Claude API key + writes to `tools/.env`. Mention in PLAN's setup step. |
| Build artifacts     | None — no compiled binaries / pip eggs / Docker tags carry "Phase 7"                                                     | None                                                                                        |

**Renumber-sweep findings:**

- The grep `grep -rE 'Phase 7.*(observ\|distribution\|HumynUpdater\|Bull-Board\|APK)' .planning/ CLAUDE.md` (per SPEC acceptance criteria) returns:
  - `CLAUDE.md:17` — annotated as "Phase 8 (was Phase 7 pre-2026-05-24 renumber)" — **OK, grandfathered by SPEC**
  - `REQUIREMENTS.md:674` — annotated as "Phase 7 narrowed to observability + APK-distribution hardening (later renumbered to Phase 8 — 2026-05-24)" — **OK, grandfathered**
  - `STATE.md:24, 52, 132, 137` — all annotated with the renumber note — **OK, grandfathered**
  - `ROADMAP.md:5, 7, 25, 303` — explicit "Phase swap 2026-05-24" banner + SPEC acceptance criteria entry — **OK, grandfathered**
- No `phases/08-*/` directory exists yet (Phase 8 has not been planned) — so there are no live PLAN / SUMMARY / VERIFICATION artifacts to sweep.
- Active phase directory under PR scope: `phases/07-multi-linguality-live-cam-feed/` (the new Phase 7's own SPEC + CONTEXT, which correctly refer to themselves as Phase 7 multi-linguality).
- Frozen history (`.planning/quick/` + `.planning/debug/` + commit messages) is intentionally NOT swept per SPEC I18N-20.

**The canonical question:** After every active planning file is checked, what runtime systems still have the old string cached or registered? Answer: nothing — `Phase 7` is a planning identifier only; no code, no DB record, no S3 key, no env var, no MMKV key carries the literal text "Phase 7".

## i18n Runtime — react-i18next + RN 0.83.x Integration

### Version Pins (Phase 7 additions to `apps/mobile/package.json`)

```json
{
  "dependencies": {
    "i18next": "^26.2.0",
    "react-i18next": "^17.0.8"
  }
}
```

`[VERIFIED: npm view react-i18next@17.0.8 peerDependencies — i18next >=26.2.0, react >=16.8.0, typescript ^5 || ^6 (optional)]`

`react-i18next@17` peers `react: >=16.8.0` (compatible with this project's `react@19.2.0`). It does NOT pin a `react-native` peer — JS-only, no native module. Compatible with RN 0.83 / New Arch / Hermes by default.

### `i18next-react-native-language-detector` — DO NOT USE

`[VERIFIED: npm view i18next-react-native-language-detector time --json → last version 1.0.2 published 2016-09-12]`

The library is effectively abandoned. It predates Hermes (2018), TurboModules (2020), and New Architecture (2022) by many years. Even if it still loads in JSDOM, the underlying device-locale-read path it would call may not exist on RN 0.83. **Recommendation: hand-roll a ~30-line MMKV-backed detector** that simply reads `localeMmkv.getString('locale.code')`. This matches D-21 / D-23 exactly.

### Provider Placement

Place `<I18nextProvider i18n={i18n}>` immediately INSIDE `<SafeAreaProvider>` at App.tsx root. This makes `useTranslation()` available to every screen in `RootNativeStack` + `OnboardingStack` + `MainTabs` + any Modal that mounts as a sibling (like `<ToastHost />`). Scoping to individual navigators is unnecessary complexity.

### Init Order at App.tsx Mount

1. `enableScreens(true)` (existing)
2. `hydrate()` (existing — Zustand from MMKV)
3. **NEW: `localeBootstrap()`** — synchronously reads `localeMmkv.getString('locale.code')`, defaults to `'en'` if unset, calls `i18n.init({ lng, ... })`
4. **NEW: `<I18nextProvider i18n={i18n}>`** wraps `<NavigationContainer>`
5. `installBootRecoveryListener()` (existing, in useEffect)
6. `installUploadReconcile()` (existing, in useEffect)

Steps 2 and 3 are synchronous (MMKV reads are synchronous; `i18n.init` resolves synchronously when `initImmediate: false`). Do them at module top-level (outside the React tree) so the first render already has the right locale.

### Common Pitfalls on RN 0.83 New Arch

- **`Intl.PluralRules`** — Hermes ships ICU; CLDR plural rules work out-of-box. `[ASSUMED — verified for Intl.DateTimeFormat in CLAUDE.md but specific Intl.PluralRules support on Hermes-RN-0.83 not re-verified in this session]`
- **`Intl.Segmenter`** — Hermes' ICU bundle does NOT include the Segmenter API as of 2025 per general training knowledge (RN's bundled ICU is dimension-trimmed to keep APK size down). This matters for the reverse-search token-fallback on the 5 Indic locales — see "Reverse-Search Map Architecture" section below. `[ASSUMED — Hermes ICU surface is documented to be subset; specific Segmenter status not verified in this session]`
- **`compatibilityJSON: 'v4'`** is mandatory in `i18n.init` config — i18next 26 ships v4 plural rule format by default but the option must be explicit to suppress a console warning on locales like `pt-BR` that have v3-vs-v4 plural changes.
- **No Suspense boundary needed** — by default `react-i18next` v17 does NOT use Suspense for translations (`useSuspense: false` is the default); a Suspense boundary is only needed if `useSuspense: true` is set.

## Catalog Generation Tool (`tools/i18n/generate.ts`)

### Repository Layout

```
tools/                              # NEW directory at repo root, not inside apps/mobile
├── package.json                    # tsx + @anthropic-ai/sdk@0.98.0 + zod
├── tsconfig.json
├── .env                            # gitignored; ANTHROPIC_API_KEY
└── i18n/
    ├── generate.ts                 # entry point (manual `pnpm i18n:generate`)
    └── vernacularBrief.ts          # the verbatim system prompt
```

### `@anthropic-ai/sdk@0.98.0`

`[VERIFIED: npm view @anthropic-ai/sdk version → 0.98.0]`
`[CITED: https://www.npmjs.com/package/@anthropic-ai/sdk — Node 18+ required, official Anthropic SDK]`

### ANTHROPIC_API_KEY Sourcing

Per D-10: `tools/.env`, NOT the mobile app environment. `tools/i18n/generate.ts` reads via `process.env.ANTHROPIC_API_KEY` (loaded by `dotenv` or `--env-file` flag in Node 20+). The key never ships in the APK.

### Prompt Skeleton

````typescript
// tools/i18n/vernacularBrief.ts (the verbatim D-10 brief)
export const VERNACULAR_BRIEF = `Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists.`;

// tools/i18n/generate.ts (sketch)
import Anthropic from '@anthropic-ai/sdk';
import { VERNACULAR_BRIEF } from './vernacularBrief';
import en from '../../apps/mobile/src/i18n/locales/en.json';

const TARGET_LOCALES = ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'] as const;
const LOCALE_NAMES: Record<string, string> = {
  'pt-BR': 'Brazilian Portuguese',
  es: 'Spanish',
  'hi-IN': 'Hindi (India)',
  'bn-IN': 'Bengali (India)',
  'ta-IN': 'Tamil (India)',
  'te-IN': 'Telugu (India)',
  'mr-IN': 'Marathi (India)',
};

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

async function generateLocale(loc: string) {
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 16000, // each catalog ~500 strings × ~30 tokens = ~15K
    system: VERNACULAR_BRIEF,
    messages: [
      {
        role: 'user',
        content: `Translate this catalog to ${LOCALE_NAMES[loc]}. Keep the JSON structure exactly; translate only the string VALUES. Return the full JSON, nothing else.\n\n${JSON.stringify(en, null, 2)}`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Strip markdown code fences if the model wraps the JSON
  const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(cleaned);

  // Audit-trail header at the top of the locale file
  const header = `// LLM-generated by tools/i18n/generate.ts on ${new Date().toISOString()}\n// Model: claude-opus-4-7 (Anthropic)\n// Vernacular brief version: 1\n// DO NOT EDIT BY HAND — re-run \`pnpm i18n:generate\` to regenerate.\n`;
  await fs.writeFile(`apps/mobile/src/i18n/locales/${loc}.json`, JSON.stringify(parsed, null, 2));
  // (Header lives in a sibling .header.txt or as a comment-only top-of-file
  //  — JSON doesn't permit comments, so the audit metadata goes into a
  //  separate ${loc}.audit.json file. Planner's call.)
}

for (const loc of TARGET_LOCALES) await generateLocale(loc);
````

`[CITED: https://www.npmjs.com/package/@anthropic-ai/sdk — Messages.create API shape]`
`[ASSUMED: model name "claude-opus-4-7" — owner chose Opus 4.7 per D-10; confirm the current Opus 4.7 model ID at PLAN time via Anthropic's models endpoint or current docs]`

### Output Validation

Two-layer validation per locale write:

1. **JSON parse** — the response MUST be parseable JSON; reject and re-prompt if not.
2. **Shape parity with `en.json`** — recursively walk both objects; the locale's key set MUST equal the English key set (no missing keys, no extra keys). i18next's key-fallback handles missing-at-runtime, but at generation time we want to know if Opus dropped a key.

Optionally a third layer: a string-length sanity check — non-English Indic translations can be 1.5–2× the English byte count; flag any value that's >5× as a probable hallucination.

### Per-Locale Call Shape

7 sequential calls (one per non-English locale). Sequential rather than parallel keeps the rate-limit footprint small and the error story simple. Each call is independent; a single-locale failure does NOT abort the others (catch + log + continue).

### Audit-Trail Header

Per D-12: each locale JSON's accompanying `.audit.json` records `{ model: 'claude-opus-4-7', generated_at: ISO, brief_version: 1, en_source_sha: <SHA of en.json at generation time> }`. This lets a future diff detect when a re-generation is needed (e.g., the English catalog drifted).

## Reverse-Search Map Architecture

### Stages per D-14

**Stage 1: full-string lookup** — exact NFC-normalized lowercase match in a `{ translated_full_name: canonical_en_name }` table built at module load from `taskCatalog.i18n.ts`. Fast (O(1) hash lookup), high-confidence (the user literally typed a known task name).

**Stage 2: token-fallback** — split input on whitespace, look up each token in a per-locale token table, rebuild an English query. Token table is derived from the catalog at module-load time:

```
Hindi task: 'चाय बनाओ' (= 'Make tea')
  → tokens: ['चाय', 'बनाओ']
  → token table: { 'चाय': 'tea', 'बनाओ': 'make' }
```

**Stage 3: passthrough** — raw input to `/tasks/search`. The backend's `pg_trgm` fallback (Phase 6 D-02 threshold 0.3) will probably return zero rows for non-English text; that's the expected degraded state, not a bug.

### Token Table Derivation Strategy

Walk every entry in `TASK_CATALOG_I18N`. For each `{ canonical_en_name, locales: { [loc]: { name, description, ... } } }`:

1. For Stage 1: register `{ name: canonical_en_name }` per locale.
2. For Stage 2: tokenize both the canonical English name AND the translated name; align tokens 1-to-1 IF the token counts match; for mismatched-count tokenizations, fall back to a heuristic mapping based on positional + content-word ordering.

The token-mapping problem is genuinely hard for the 5 Indic locales because of agglutinative morphology (Tamil/Telugu) and compound formation (Hindi/Bengali/Marathi). The MVP strategy is **conservative**: only register tokens where the English-side word is a content-bearing noun/verb (not articles, prepositions, etc.), and accept that the Stage 2 fallback will have lower recall than Stage 1 — the goal is "user types the full task name and gets a hit" first; "user types a partial query in their language" is a stretch goal.

### Edge Cases

- **Hindi/Bengali/Marathi compound words** — `'चाय बनाओ'` (`'Make tea'`) parses cleanly because Hindi separates these with a space. But e.g. `'खाना पकाओ'` (`'Cook food'`) vs `'खानापकाओ'` (no space, dialectal) are different tokens — accept the dialectal variant misses in MVP.
- **Tamil/Telugu agglutinative segmentation** — these languages glue suffixes onto stems (`'சாப்பிடு'` `'eat'` vs `'சாப்பிடுங்கள்'` `'eat-PLURAL-HONORIFIC'`). The Stage 1 full-string lookup gets the canonical name verbatim; Stage 2 misses agglutinated variants — accept this in MVP.
- **Accent stripping for pt-BR / es** — `'pão'` vs `'pao'`. Apply Unicode NFD decomposition + strip combining marks before lookup so users typing without the diacritics still hit. Implementation: `input.normalize('NFD').replace(/\p{Mn}/gu, '').normalize('NFC')`.

### `Intl.Segmenter` on Hermes RN 0.83

`Intl.Segmenter` would be the right tool for proper word-segmentation on languages without whitespace tokens, but Hermes' bundled ICU does NOT include the Segmenter API as of late 2025 (the Hermes ICU surface is trimmed for APK size). Confirm at PLAN time via a runtime `typeof Intl.Segmenter` probe on a Pixel 10a; if absent, the MVP token-fallback uses whitespace splitting only and Stage 3 passthrough catches the rest.

`[ASSUMED: Intl.Segmenter absence on Hermes RN 0.83 — based on training knowledge of Hermes ICU subset; needs runtime verification on Pixel 10a in Wave 1]`

## Per-Locale TTS Fallback Chain

### `Tts.voices()` Shape on Pixel 10a Android

Per `apps/mobile/src/lib/ttsVoice.ts:41-46` and the existing `react-native-tts@4.1.1` integration:

```typescript
interface TtsVoice {
  id?: string;
  name?: string;
  language?: string; // BCP-47 e.g. 'en-US', 'hi-IN', 'pt-BR'
  notInstalled?: boolean; // filter these out FIRST
  // no gender field — gender heuristic via name/id pattern
}
```

`[VERIFIED: apps/mobile/src/lib/ttsVoice.ts:41-46 — current interface in repo]`
`[ASSUMED: Pixel 10a Google TTS voice IDs follow the `xx-yy-x-zzz-local`pattern (e.g.,`en-us-x-tpf-local` for female en-US); confirm at smoke time when each locale's engine is installed]`

### The 5-Step Chain (D-31)

```typescript
// apps/mobile/src/lib/ttsVoice.ts (EXTENDED)
import crashlytics from '@react-native-firebase/crashlytics';

export async function pickAndSetVoiceForLocale(activeLocale: string): Promise<void> {
  await Tts.getInitStatus();

  let voices: TtsVoice[] = [];
  try {
    voices = ((await Tts.voices()) as TtsVoice[]) ?? [];
  } catch {
    voices = [];
  }
  const usable = voices.filter((v) => !v.notInstalled);

  // Step 1: a voice matching activeLocale that looks female-leaning
  let pick =
    usable.find((v) => v.language === activeLocale && looksFemale(v))?.id ??
    // Step 2: any voice matching activeLocale
    usable.find((v) => v.language === activeLocale)?.id ??
    // Step 3: en-US female-leaning (existing owner-preferred chain)
    usable.find((v) => v.language === 'en-US' && looksFemale(v))?.id ??
    // Step 4: any en-US voice
    usable.find((v) => v.language === 'en-US')?.id ??
    // Step 5: first en-* voice
    usable.find((v) => (v.language ?? '').toLowerCase().startsWith('en'))?.id;

  // Set language to the active locale (or en-US baseline as fallback)
  try {
    await Tts.setDefaultLanguage(activeLocale);
  } catch {
    try {
      await Tts.setDefaultLanguage('en-US');
    } catch {
      /* engine has no en-US */
    }
  }

  if (pick) {
    try {
      await Tts.setDefaultVoice(pick);
    } catch {
      /* best-effort */
    }
  }

  // Crashlytics breadcrumb when we fell back to step 3+ (English instead of locale)
  const fellBackToEnglish = !usable.some((v) => v.language === activeLocale && v.id === pick);
  if (fellBackToEnglish && activeLocale !== 'en') {
    crashlytics().log(
      JSON.stringify({
        event: 'tts_locale_fallback',
        locale: activeLocale,
        fallback: true,
      }),
    );
  }

  Tts.setDefaultRate(1.0, true); // skipTransform=true — Android raw 1.0
  Tts.setDefaultPitch(0.95);
}
```

### Owner-Deviation Preservation for `en`

When `i18n.language === 'en'`, the chain naturally short-circuits at step 3 (active locale `en` ≅ `en-US`-or-similar lookup), which preserves the existing en-US owner-deviation behavior at `apps/mobile/src/lib/ttsVoice.ts:50-92`. The `EnIn` symbol-name in the existing file (`pickAndSetEnInVoice`) stays for import-call stability; a new `pickAndSetVoiceForLocale(activeLocale)` is added that supersedes it but keeps the old export as a thin wrapper that passes `'en'` for backward compatibility.

### Crashlytics Breadcrumb Shape

Per D-31: `{ event: 'tts_locale_fallback', locale: activeLocale, fallback: true }`. Stringify to JSON before `crashlytics().log(...)` so it appears in crash reports as a single line. Don't fire on the en case (always-true fallback for en is noise).

## Bilingual Consent Rendering

### Composite-Key Pattern (D-09 + D-32)

The translated paragraph lives at `terms.consent.body` in each non-English JSON. The canonical English ALSO lives at `terms.consent.body` in `en.json`. The view composes them when active locale ≠ en.

```typescript
// apps/mobile/src/screens/signup/TermsOfUseModal.tsx (EXTENDED)
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

export function TermsOfUseModal() {
  const { t } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const en = i18n.getFixedT('en');  // bound to 'en' regardless of active

  return (
    <View>
      <Text style={styles.body}>{t('terms.consent.body')}</Text>
      {!isEnglish && (
        <Text style={[styles.body, styles.englishUnderlay]}>
          {en('terms.consent.body')}
        </Text>
      )}
    </View>
  );
}

const styles = {
  body: { fontSize: 14, color: colors.text },
  englishUnderlay: {
    opacity: 0.7,
    fontSize: 12,
    marginTop: spacing.sm,
  },
};
```

### Why `i18n.getFixedT('en')` Works for the Underlay

`getFixedT(lng)` returns a `t` function bound to the given language regardless of the current active language. This sidesteps having to switch the global i18n state (which would trigger every `useTranslation` re-render in the tree). It's the canonical i18next pattern for "render this one thing in a specific language."

`[CITED: https://www.i18next.com/overview/api#getfixedt — getFixedT returns a t-function bound to a language]`

### View-Side vs Catalog-Side

Per D-09 + D-32: view-side. Catalog-side would mean embedding the English text as a duplicate string in every non-English JSON (`terms.consent.body_en` keys, or a `[translated]\n\n[English]` joined value). Both options bloat the catalogs and create a sync hazard if `idea-brief.md §5.2` changes. View-side composition keeps `terms.consent.body` as a single key with one English source-of-truth.

## MMKV Bootstrap Order at App.tsx

### Sync Read Before Navigator Mount (D-23)

```typescript
// apps/mobile/src/i18n/bootstrap.ts (NEW)
import { localeMmkv, LOCALE_KEYS } from './storage';

const SUPPORTED = ['en', 'pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'] as const;
type Locale = (typeof SUPPORTED)[number];

export function localeBootstrap(): Locale {
  const stored = localeMmkv.getString(LOCALE_KEYS.CODE);
  if (stored && (SUPPORTED as readonly string[]).includes(stored)) {
    return stored as Locale;
  }
  return 'en';
}
```

```typescript
// apps/mobile/src/i18n/storage.ts (NEW)
import { createMMKV, type MMKV } from 'react-native-mmkv';

export const localeMmkv: MMKV = createMMKV({
  id: 'humyn.locale',
  // No encryption — locale isn't a secret per D-21
});

export const LOCALE_KEYS = {
  CODE: 'locale.code',
  CHOSEN_AT: 'locale.chosen_at',
} as const;
```

### Risk of Async Bootstrap

If `i18n.init` is awaited inside a useEffect, the first frame renders before i18n is ready → `useTranslation()` returns the key string (`'recording.preview.live'`) instead of `'Live preview'` → user sees raw keys flash → ChooseLanguageScreen (the gate-passing screen on first launch) renders in the wrong language for one frame. **Synchronous bootstrap is non-negotiable** because both MMKV reads and `i18n.init` resolve synchronously when `initImmediate: false` is not set (it isn't, by default).

## Live-Cam Preview Surface-Source A/B

The defining question for Phase 7's recording-screen work. Per D-24 and REC-LIVE-06, the choice is deferred to PLAN time with on-hardware drift as the gate. This research enumerates the three candidates per the 4-question framework.

### Camera2 Context

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:599-602` currently calls:

```kotlin
cam.createCaptureSession(
    listOf(surface),                  // ONE Surface: the encoder's input
    object : CameraCaptureSession.StateCallback() { ... },
    sessionHandler,
)
```

And `HevcEncoder.kt:90` produces that single Surface via `codec.createInputSurface()`. The current pipeline is single-output.

`[VERIFIED: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:599-602 — single-Surface session]`
`[VERIFIED: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt:86-93 — encoder Surface allocation]`

### Option A: Share the Encoder's Input Surface via SurfaceTexture

**API surface required:**

- `codec.createInputSurface()` returns a `Surface` that the encoder reads frames from. This is a _consumer_ Surface — Camera2 pushes pixels INTO it.
- To split, we'd need to: create a `SurfaceTexture` → `Surface(surfaceTexture)` for Camera2; render the SurfaceTexture's GL texture both into the encoder's input Surface (via `EGLSurface`) AND into a preview View's `SurfaceTexture`.
- Requires a GL context + EGL surfaces + a render thread. Non-trivial.

**Drift impact:** Adds a GL composite step between Camera HAL and encoder input. Each rendered frame goes Camera HAL → SurfaceTexture (GL texture) → fragment shader → encoder Surface, instead of Camera HAL → encoder Surface direct. The extra GPU pass adds latency (microseconds to low milliseconds) and CPU work on the render thread, which competes with the IMU sample collection thread for scheduler time. **Expected drift impact: moderate-to-high regression**, possibly tripping D-04.

**Capture-quality cancel risk:** Moderate. If the GL pipeline drops a frame under thermal pressure, the encoder receives fewer frames per second → `mean_fps` falls → `fps_dropped` cancel. The Pixel 10a's ultrawide HEVC pipeline is already near the thermal envelope at 1080p30; adding a GPU stage pushes it closer.

**A/B test design:** Two 10-min recordings on Pixel 10a same-day:

- Baseline: existing single-Surface code path (no GL intermediate).
- Variant: Option A wired up. Measure `p99_ms` from each `metadata.json`. Compute `(p99_var − p99_base) / p99_base`.

### Option B: Two-Surface CaptureSession (LEADING HYPOTHESIS)

**API surface required:**

- Allocate a `SurfaceTexture` for the preview TextureView (the `<HumynLivePreviewView>` exposes one).
- Wrap it: `Surface previewSurface = new Surface(textureView.surfaceTexture)`.
- Pass BOTH to the CaptureSession: `cam.createCaptureSession(listOf(encoderSurface, previewSurface), ...)`.
- In the CaptureRequest builder, call `builder.addTarget(encoderSurface)` AND `builder.addTarget(previewSurface)` ONLY during the 15-s + 10-s windows; revert to encoder-only for dimmed periods.

This is the documented Camera2 multi-output pattern. Per the Android developer docs, every Camera2-supporting device (API 21+) can drive up to 3 simultaneous PRIV streams.

`[CITED: https://developer.android.com/media/camera/camera2/multiple-camera-streams-simultaneously — "Every device that supports Camera2 (API level 21 and higher) can output up to three simultaneous streams"]`
`[CITED: https://developer.android.com/media/camera/camera2/multi-camera — multi-output session configuration]`

**Drift impact:** The Camera HAL produces ONE buffer per frame and distributes it to N consumer Surfaces via reference counting (no extra copy on most hardware). The encoder Surface remains a direct HAL → encoder path; the preview Surface receives the same buffer in parallel. **Expected drift impact: low** — the HAL already does this internally for multi-stream consumers; the encoder thread isn't blocked by preview rendering.

**Capture-quality cancel risk:** Low-moderate. The CaptureSession reconfiguration overhead is borne once at session start, not per-frame. The two-target CaptureRequest costs slightly more CPU per frame (HAL has to dispatch to 2 consumers instead of 1), which on a thermally-stressed device could regress fps by a tenth of a frame — unlikely to cross the 29.0 gate but worth measuring.

**A/B test design:** Same as Option A — two 10-min recordings on Pixel 10a same-day, baseline (encoder-only Surface) vs. variant (encoder + preview Surfaces, preview hidden but Surface present). The drift delta should be the lowest of the three options.

### Option C: Attach/Detach Mid-Record

**API surface required:**

- Start with `createCaptureSession(listOf(encoderSurface), ...)` (current code).
- At the 15-s preview start: call `cam.createCaptureSession(listOf(encoderSurface, previewSurface), ...)` — this **closes the existing session and creates a new one** (`CameraCaptureSession` is immutable once configured).
- At the 15-s preview end: another `createCaptureSession(listOf(encoderSurface), ...)` to drop the preview Surface.
- Repeat for each 10-s tap-reveal.

**Drift impact:** **HIGH RISK**. CameraCaptureSession reconfiguration is expensive and historically causes frame drops — the HAL must drain its in-flight buffers, reconfigure the pipeline, and re-warm. The window of "no frames produced" is typically 50–500 ms on Android, during which the encoder pump loop sees empty intervals. This is the lever that breaks `imu_video_drift_max_ms` (the per-segment maximum) and likely the `p99` as well.

**Capture-quality cancel risk:** **HIGH**. The reconfiguration drop windows shrink `videoFrameTimestamps.size` for the segment proportional to how many tap-reveals fire. A user who taps every 10 seconds for 25 minutes would trigger ~150 reconfigurations — almost certainly tripping `fps_dropped` (mean_fps < 29) and possibly `insufficient_frames`.

**A/B test design:** Same shape as A and B, but the variant must include at least one full state-cycle (15-s preview → dim → tap → 10-s reveal → dim) within the 10-min window to expose the reconfiguration cost. **Expected to fail the D-04 gate; documented for completeness.**

### Recommendation

**Option B is the leading hypothesis.** It maps directly to the documented Camera2 multi-output pattern, requires no GL render thread (Option A's footprint) and no mid-record reconfiguration (Option C's drop windows). The likely drift delta is in the noise.

**However**, per D-24 the planner MUST run the on-hardware A/B at PLAN time before locking. Specifically:

1. Build a throwaway native experiment branch that wires Option B end-to-end.
2. Record two 10-min segments back-to-back on the Pixel 10a (same device, same day, same lighting, same scene).
3. Extract `imu_video_drift_p99_ms` from both `metadata.json`s.
4. Compute `delta = (p99_on − p99_off) / p99_off`. Acceptance: `delta < 0.50`.
5. If Option B fails: fall back to Option A's measurement, accept that drift will be higher but possibly under the gate. If both fail: escalate to the owner — the preview feature has to scope down (e.g., shorter windows, or sample preview at 15 fps instead of 30 fps via a `setRepeatingBurst` cadence).

### 4-Question Summary Table

| Question               | Option A (share via SurfaceTexture)                                   | Option B (two-Surface session)                                                             | Option C (attach/detach mid-record)                                                   |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Camera2 API surface    | `createInputSurface` + GL render thread + EGLSurface + SurfaceTexture | `createCaptureSession(listOf(s1, s2), ...)`; `addTarget(s1)` + conditional `addTarget(s2)` | `createCaptureSession` called 2N+1 times where N = tap-reveals                        |
| Expected drift impact  | Moderate-to-high (GPU composite stage in critical path)               | Low (HAL native multi-consumer; same buffer ref-counted)                                   | High (reconfigure-drop windows)                                                       |
| Cancel-gate risk       | Moderate (`fps_dropped` if GPU drops frames under thermal load)       | Low-moderate (extra HAL dispatch cost)                                                     | **High** (reconfigure drops will shrink frame count; very likely trips `fps_dropped`) |
| On-hardware A/B design | 10-min baseline vs 10-min variant; same Pixel 10a, same day           | 10-min baseline vs 10-min variant; same Pixel 10a, same day                                | 10-min baseline vs 10-min variant _with at least 3 state cycles in window_            |

`[ASSUMED: drift impact rankings — based on training knowledge of Camera2 multi-output semantics + frame-pipeline behavior; on-hardware measurement is the only authoritative source]`

## Live-Cam Preview Brightness State Machine

### Three States

1. **`initial-preview`** (15 s after `HumynCapture.start()` resolves)

   - brightness = system (via `HumynScreenBrightness.set(-1)`)
   - `<HumynLivePreviewView>` visible (full-screen)
   - Stop button visible (z-stack top)
   - Practice instructional copy NOT visible (per D-05)
   - Timer T1 = setTimeout(15000ms, → `dimmed`)

2. **`dimmed`** (default state after T1 fires; the existing dim state today)

   - brightness = 0.05 (via existing `HumynScreenBrightness.set(0.05)`)
   - `<HumynLivePreviewView>` hidden
   - Eye icon glyph visible (bottom-right, low opacity)
   - Practice instructional copy visible (if practice mode — D-05)
   - Full-surface `Pressable` active

3. **`tap-revealed`** (10 s after a tap in `dimmed` state)
   - brightness = system (via `HumynScreenBrightness.set(-1)`)
   - `<HumynLivePreviewView>` visible (full-screen)
   - Eye icon glyph hidden (covered by preview)
   - Stop button visible
   - Timer T2 = setTimeout(10000ms, → `dimmed`); each new tap clears + resets T2 (D-29)

### Interaction with Existing `HumynScreenBrightness.set(-1)` Calls (D-28)

Per `apps/mobile/src/screens/recording/RecordingScreen.tsx`:

- Line 267: `set(-1)` on cleanup (unmount).
- Line 387: `set(-1)` on failed capture-start.
- Line 655: `set(0.05)` on gate exit → active.
- Line 734: `set(-1)` on stop/exit.

The state machine ADDS calls on top of these existing ones; it does not modify them. The state-machine transitions trigger `set(-1)` or `set(0.05)` _between_ the existing landmark calls (gate-exit → active still calls `set(0.05)` at 655; the state machine fires `set(-1)` immediately afterwards for the initial 15-s window, then `set(0.05)` again at T1 fire to enter `dimmed`).

`[VERIFIED: apps/mobile/src/screens/recording/RecordingScreen.tsx grep results — set(-1) at lines 267, 387, 734; set(0.05) at line 655]`

### Timer-Management Pattern

```typescript
// apps/mobile/src/screens/recording/RecordingScreen.tsx (EXTENDED)
import { useRef, useState, useEffect, useCallback } from 'react';

type PreviewState = 'initial-preview' | 'dimmed' | 'tap-revealed';

function useLivePreviewStateMachine(captureStartedAt: number | null) {
  const [state, setState] = useState<PreviewState>('initial-preview');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup any pending timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // T1: 15-s initial preview → dimmed
  useEffect(() => {
    if (captureStartedAt == null) return;
    setState('initial-preview');
    HumynScreenBrightness.set(-1);
    timerRef.current = setTimeout(() => {
      setState('dimmed');
      HumynScreenBrightness.set(0.05);
    }, 15000);
    return () => clearTimer();
  }, [captureStartedAt, clearTimer]);

  // Tap handler: dimmed → tap-revealed → dimmed
  const handleTapReveal = useCallback(() => {
    if (state === 'tap-revealed') {
      // Rolling: reset T2 (D-29)
      clearTimer();
      timerRef.current = setTimeout(() => {
        setState('dimmed');
        HumynScreenBrightness.set(0.05);
      }, 10000);
      return;
    }
    if (state !== 'dimmed') return;
    setState('tap-revealed');
    HumynScreenBrightness.set(-1);
    timerRef.current = setTimeout(() => {
      setState('dimmed');
      HumynScreenBrightness.set(0.05);
    }, 10000);
  }, [state, clearTimer]);

  return { state, handleTapReveal };
}
```

## Tap-Zone Implementation

### Z-Stack Ordering (D-28)

React Native's hit-test traverses children in reverse paint order. The element rendered LAST in JSX is the topmost in z-stack and gets first crack at touch events.

```tsx
// RecordingScreen.tsx render output (sketch)
<View style={StyleSheet.absoluteFill}>
  {/* Layer 1 (bottom): live preview when visible */}
  {previewVisible && <HumynLivePreviewView style={StyleSheet.absoluteFill} />}

  {/* Layer 2: full-surface tap zone (ONLY in dimmed state) */}
  {brightnessState === 'dimmed' && (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={handleTapReveal}
      accessibilityLabel="Reveal live preview"
    />
  )}

  {/* Layer 3: eye icon glyph (dimmed state) */}
  {brightnessState === 'dimmed' && (
    <View style={styles.eyeIconCorner} pointerEvents="none">
      <Eye color={colors.dimGlyph} size={24} />
    </View>
  )}

  {/* Layer 4 (top): Stop button — last in JSX so it wins hit-test */}
  <View style={styles.stopButtonContainer} pointerEvents="box-none">
    <StopButton onPress={handleStop} />
  </View>
</View>
```

### Risk: Gesture Conflict in Dimmed State

The full-surface `Pressable` covers the screen. If the user taps on the Stop button:

- React Native hit-tests from the top down.
- Stop button is rendered LAST → it receives the touch first.
- If Stop's `onPress` fires, the Pressable below is NOT triggered.

This works because React Native's `Pressable` is implemented with native gesture responders that obey z-order. **Verify on-device** that tapping precisely on the Stop button never bubbles to the Pressable underneath (the SPEC acceptance criterion is: "Stop is hit-testable in all three visible states").

The `pointerEvents="box-none"` on the Stop button's container is critical — it makes the container itself non-receiving but lets its child (the actual button) receive touches. Without it, the container would intercept taps on its bounding box but the inner button might not receive them.

`[ASSUMED: React Native hit-test order is reverse paint order — well-documented behavior in RN core; not re-verified in this session]`

## Renumber Sweep

### Currently-Annotated References (DO NOT EDIT — grandfathered)

Per SPEC I18N-20 acceptance criterion: `grep -rE 'Phase 7.*(observ|distribution|HumynUpdater|Bull-Board)' .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/STATE.md CLAUDE.md` should return ONLY the explicit "was Phase 7 pre-2026-05-24 renumber" annotation lines.

Verified in this research session:

| File                        | Lines                               | Status                                                                                                                             |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                 | 17 (MVP descoped 2026-05-11 banner) | ANNOTATED — "Phase 8 (was Phase 7 pre-2026-05-24 renumber — see ROADMAP "Phase swap 2026-05-24" banner)" — **keep**                |
| `.planning/REQUIREMENTS.md` | 674 (Last updated trailer)          | ANNOTATED — "Phase 7 narrowed to observability + APK-distribution hardening (later renumbered to Phase 8 — 2026-05-24)" — **keep** |
| `.planning/STATE.md`        | 24, 52, 132, 137                    | All four lines carry explicit renumber notes — **keep**                                                                            |
| `.planning/ROADMAP.md`      | 5, 7, 25, 303                       | Phase swap banner + Phase 8 entry + SPEC acceptance criterion mention — **keep**                                                   |

### Active Planning Directories — In Scope to Update

Only one Phase 7 directory exists today: `.planning/phases/07-multi-linguality-live-cam-feed/`. It contains:

- `07-SPEC.md` — refers to itself as Phase 7 (correctly the new Phase 7) — **keep**
- `07-CONTEXT.md` — same — **keep**
- (no PLAN / SUMMARY / VERIFICATION files yet)

No `.planning/phases/08-*/` directory exists; Phase 8 hasn't been planned. So there are zero live planning artifacts that say "Phase 7 = observability" in an unannotated way.

### Frozen History (DO NOT EDIT per SPEC)

Per SPEC I18N-20: `.planning/quick/` + `.planning/debug/` entries from before 2026-05-24 and historical commit messages are intentionally NOT swept. They are frozen history.

### PLAN-Time Verification

The Wave 4 manual-smoke runbook should include a final grep gate:

```bash
# Returns only lines that explicitly mention the 2026-05-24 renumber annotation
grep -rE 'Phase 7.*(observ|distribution|HumynUpdater|Bull-Board|APK)' \
  .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/STATE.md CLAUDE.md \
  | grep -v 'pre-2026-05-24\|renumber\|swap 2026-05-24\|Phase 7 narrowed\|was Phase 7'
# Expected: zero output
```

Any non-annotated stale reference surfaced by this grep is a PLAN bug to fix before sign-off.

## Validation Architecture

### Test Framework

| Property                     | Value                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| JS framework                 | Vitest 4.1.5 (already installed — `apps/mobile/package.json`)                                                                             |
| JS config file               | `apps/mobile/vitest.config.ts` (already exists)                                                                                           |
| Quick run command (per file) | `cd apps/mobile && npm test -- --run path/to/test.test.ts`                                                                                |
| Full mobile suite            | `cd apps/mobile && npm test -- --run`                                                                                                     |
| Kotlin framework             | Robolectric / JUnit 4 (existing — `apps/mobile/android/app/src/test/`)                                                                    |
| Kotlin quick run             | `cd apps/mobile/android && ./gradlew :app:testDebugUnitTest --tests ClassName`                                                            |
| Kotlin full                  | `cd apps/mobile/android && ./gradlew :app:testDebugUnitTest`                                                                              |
| Backend framework            | Vitest 4.x at `apps/api/` (existing)                                                                                                      |
| API command                  | `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test` per memory `feedback_post_merge_test_env.md` |
| On-hardware framework        | Manual smoke runbook (`07-MANUAL-SMOKE.md`) on Pixel 10a `5C161JEA304304`                                                                 |

### Phase Requirements → Test Map

| Req ID      | Behavior                               | Test Type                                              | Automated Command                                                                                                | File Exists?                                    |
| ----------- | -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| I18N-01     | 8 locales selectable                   | unit (JS)                                              | `npm test -- src/i18n/__tests__/i18n.test.ts`                                                                    | ❌ Wave 0                                       |
| I18N-02     | ChooseLanguageScreen MMKV gate         | unit (JS)                                              | `npm test -- src/screens/chooseLanguage/__tests__/ChooseLanguageScreen.test.tsx`                                 | ❌ Wave 0                                       |
| I18N-03     | Tokens-only ChooseLanguage design      | visual snapshot (jest-image-snapshot)                  | `npm test -- src/screens/chooseLanguage/__tests__/visual.test.tsx`                                               | ❌ Wave 0                                       |
| I18N-04     | Profile language row + tap-commit      | unit (JS)                                              | `npm test -- src/screens/profile/__tests__/ProfileScreen.test.tsx`                                               | partial — Phase 6 test exists                   |
| I18N-05     | Generator script with vernacular brief | unit (Node)                                            | `cd tools && npx tsx --test i18n/__tests__/generate.test.ts`                                                     | ❌ Wave 0                                       |
| I18N-06     | TTS per-locale fallback chain          | unit (JS) + on-hardware                                | `npm test -- src/lib/__tests__/ttsVoice.test.ts` + manual Pixel 10a walk                                         | partial — test exists for current `ttsVoice.ts` |
| I18N-07     | Bilingual consent renders              | unit (JS)                                              | `npm test -- src/screens/signup/__tests__/TermsOfUseModal.test.tsx`                                              | partial — Phase 2 test exists                   |
| I18N-08     | API error → translated toast           | unit (JS)                                              | `npm test -- src/i18n/__tests__/errorMap.test.ts`                                                                | ❌ Wave 0                                       |
| I18N-09     | `Intl.DateTimeFormat` with `latn`      | unit (JS)                                              | `npm test -- src/lib/__tests__/dates.test.ts`                                                                    | ❌ Wave 0                                       |
| I18N-10     | Reverse-search map                     | unit (JS)                                              | `npm test -- src/i18n/__tests__/reverseSearch.test.ts`                                                           | ❌ Wave 0                                       |
| I18N-11     | Phase 6 cosmetic gaps NOT re-opened    | manual (planner enforces in PR review)                 | n/a                                                                                                              | n/a                                             |
| I18N-12     | locale_chosen / locale_changed events  | unit (JS)                                              | `npm test -- src/services/__tests__/telemetryRing.locale.test.ts`                                                | partial — telemetryRing.test.ts exists          |
| REC-LIVE-01 | 15-s initial preview                   | unit (JS state machine) + manual Pixel 10a             | `npm test -- src/screens/recording/__tests__/livePreview.test.tsx`                                               | ❌ Wave 0                                       |
| REC-LIVE-02 | Tap-reveal 10-s rolling                | unit (JS state machine) + manual                       | same as above                                                                                                    | ❌ Wave 0                                       |
| REC-LIVE-03 | Brightness wrapper drives both         | unit (JS) — mock HumynScreenBrightness                 | same as above                                                                                                    | ❌ Wave 0                                       |
| REC-LIVE-04 | Practice + real both use preview       | unit (JS) + manual Pixel 10a practice walk             | same as above                                                                                                    | ❌ Wave 0                                       |
| REC-LIVE-05 | Drift A/B regression bound             | on-hardware ONLY (Pixel 10a)                           | `07-MANUAL-SMOKE.md` §A/B walk                                                                                   | ❌ Wave 0 (runbook)                             |
| REC-LIVE-06 | Surface-approach in PLAN.md            | manual (PLAN.md contains the table)                    | n/a                                                                                                              | n/a                                             |
| REC-LIVE-07 | Capture-quality cancel gates unchanged | unit (Kotlin) — re-run existing `FinalizeWorker` tests | `cd apps/mobile/android && ./gradlew :app:testDebugUnitTest --tests FinalizeWorkerTest`                          | ✅ exists                                       |
| I18N-20     | Renumber sweep clean                   | shell grep gate in manual smoke runbook                | `grep -rE 'Phase 7.*(observ\|distribution\|HumynUpdater\|Bull-Board)' .planning/ CLAUDE.md \| grep -v annotated` | ❌ Wave 0 (runbook)                             |
| I18N-21     | Android only                           | shell grep gate                                        | `git diff --stat main -- apps/mobile/ios/` (should be empty)                                                     | ❌ Wave 0 (runbook)                             |

### Sampling Rate

- **Per task commit:** `npm test -- --run` (mobile JS suite; ~2-5s for the new i18n tests)
- **Per wave merge:** Full mobile JS suite + Kotlin unit tests (`./gradlew :app:testDebugUnitTest`)
- **Phase gate (before `/gsd-verify-work`):** Full mobile suite green + Kotlin unit suite green + `07-MANUAL-SMOKE.md` operator sign-off **YES** on Pixel 10a (the D-04 drift A/B is the BLOCKING line)

### Wave 0 Gaps

- [ ] `apps/mobile/src/i18n/__tests__/i18n.test.ts` — covers I18N-01
- [ ] `apps/mobile/src/i18n/__tests__/errorMap.test.ts` — covers I18N-08
- [ ] `apps/mobile/src/i18n/__tests__/reverseSearch.test.ts` — covers I18N-10
- [ ] `apps/mobile/src/screens/chooseLanguage/__tests__/ChooseLanguageScreen.test.tsx` — covers I18N-02
- [ ] `apps/mobile/src/screens/chooseLanguage/__tests__/visual.test.tsx` — covers I18N-03 (jest-image-snapshot)
- [ ] `apps/mobile/src/lib/__tests__/dates.test.ts` — covers I18N-09
- [ ] `apps/mobile/src/screens/recording/__tests__/livePreview.test.tsx` — covers REC-LIVE-01..04
- [ ] `apps/mobile/src/services/__tests__/telemetryRing.locale.test.ts` — covers I18N-12
- [ ] `tools/i18n/__tests__/generate.test.ts` — covers I18N-05 (validates the JSON shape parity check, not the actual LLM call)
- [ ] `tools/package.json` + `tools/tsconfig.json` — Wave 0 prerequisite
- [ ] `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` — Wave 4 runbook

## Security Domain

ASVS Level 1 enforcement per `.planning/config.json` (`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`).

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                    |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | partial | Sign-up flow touched (bilingual consent rendering) — Google Sign-In + Play Integrity stack unchanged. New `consent_text_version` still references canonical English (D-33).                         |
| V3 Session Management | no      | Locale state is not session state; no session changes                                                                                                                                               |
| V4 Access Control     | no      | No new endpoints, no new authz surfaces                                                                                                                                                             |
| V5 Input Validation   | yes     | Reverse-search input must be normalized (NFC + lowercase + trim) before lookup. Zod validation on the locale code at bootstrap. ANTHROPIC_API_KEY validated as non-empty before `generate.ts` runs. |
| V6 Cryptography       | no      | localeMmkv is not encrypted (locale isn't a secret); existing `secureMmkv` encryption unchanged                                                                                                     |
| V7 Error Handling     | yes     | API errors map to translated toasts (I18N-08) without leaking server `detail` to UI — `detail` goes ONLY to Crashlytics. Unknown codes fall through to generic translated key.                      |
| V14 Configuration     | yes     | ANTHROPIC_API_KEY in `tools/.env` MUST be gitignored. NEVER commit. Mention in PLAN setup step.                                                                                                     |

### Known Threat Patterns for This Stack

| Pattern                                                                                    | STRIDE                                | Standard Mitigation                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret leak via committed `.env`                                                           | Information Disclosure                | `.gitignore` covers `tools/.env`; PLAN includes a `git status` step before `pnpm i18n:generate` runs                                                                  |
| Catalog injection (LLM produces malicious JS-looking strings)                              | Tampering                             | i18next escapes interpolations by default (`{{var}}` is HTML-escaped); React's text rendering is XSS-safe by default. Acceptable.                                     |
| Reverse-search bypass (user crafts input that reverses to a different task's English name) | Tampering (low impact)                | Backend `/tasks/search` is unauthenticated-list query; no privileged data behind it. Worst case: user sees a different task than they meant. Not a security boundary. |
| ANTHROPIC_API_KEY exfil via mobile bundle                                                  | Information Disclosure                | Generator runs in `tools/` (Node) — never in the mobile bundle. Verify by grepping `apps/mobile/` for `ANTHROPIC_API_KEY` (expected: zero hits).                      |
| TTS engine downloads non-English voice data over cellular                                  | Information Disclosure (low — no PII) | Not a Phase-7 surface; the Android TTS engine handles this. Optionally surface a settings hint if voice data download fails (deferred — not in scope).                |

## Common Pitfalls

### Pitfall 1: i18n provider re-render storm on every key press

**What goes wrong:** A user typing in a search input rapidly that calls `i18n.changeLanguage()` would trigger a re-render of every `useTranslation()`-consuming subscreen.

**Why it happens:** `<I18nextProvider>` propagates language changes via React Context; every consumer re-renders.

**How to avoid:** `i18n.changeLanguage` should fire ONLY from ChooseLanguageScreen (Continue tap) and LanguageSheet (row tap) — both single-shot user actions. Don't wire it to any input/typing surface.

**Warning signs:** Profiler shows >100 ms render time on Profile after a locale tap (one-time spike is fine; recurring is a bug).

### Pitfall 2: `Tts.voices()` race on Android 14+

**What goes wrong:** On Android 14+ the TextToSpeech service may take 500 ms+ to enumerate voices on first call after install. A call to `Tts.voices()` before this completes returns an empty array → the fallback chain falls through to step 5 immediately, falsely flagging a fallback in Crashlytics.

**Why it happens:** The Google TTS service caches voices lazily on the first `getVoices()` after engine init.

**How to avoid:** `pickAndSetVoiceForLocale()` already calls `await Tts.getInitStatus()` before `Tts.voices()` per the existing `ttsVoice.ts:60-61`. Keep that. On a Pixel 10a smoke walk, verify the chain by waiting at least 1 s after RecordingScreen mount before triggering the first voice cue.

**Warning signs:** Crashlytics floods with `tts_locale_fallback: true` entries even when the locale voice IS installed.

### Pitfall 3: `Pressable` absolute-position z-stack ordering on Android

**What goes wrong:** On Android, RN's hit-test order can interact oddly with `pointerEvents` on parent Views. If the Stop button's container has `pointerEvents="auto"` (the default), the container may swallow taps before they reach the Stop button itself.

**Why it happens:** RN translates `pointerEvents` to Android's `View.dispatchTouchEvent` semantics; absolute-positioned children inside a container with `pointerEvents="auto"` work most of the time but edge-case touch coordinates can route to the container.

**How to avoid:** Use `pointerEvents="box-none"` on the Stop button's wrapper container (lets touches pass through to children but not the wrapper itself). This is shown in the Pattern 2 code sketch above.

**Warning signs:** Stop button stops responding when the full-surface Pressable is mounted (dimmed state).

### Pitfall 4: Camera2 Surface multi-consumer hardware limits

**What goes wrong:** Although Android Camera2 documentation says every API 21+ device supports ≥3 simultaneous PRIV streams, some OEM HALs (Samsung Exynos, MediaTek Helio) regress to 2 streams under thermal pressure or when the ultrawide is active. Adding a preview Surface as a 2nd consumer may silently drop frames on these devices.

**Why it happens:** The Camera2 spec is a minimum guarantee; OEM HALs can throttle below that under runtime conditions.

**How to avoid:** Phase 7's reference device is the Pixel 10a (Tensor G3 — Google's own HAL, well-behaved). The on-hardware A/B is the proof. For the §v2 OEM device sweep (Phase 8 carry-over), revisit with at least one Samsung + one Xiaomi device.

**Warning signs:** Pixel 10a A/B passes (drift delta < 50%) but the Phase 8 OEM sweep shows `fps_dropped` cancels on certain devices when preview is on.

### Pitfall 5: i18next + `compatibilityJSON: 'v4'` mismatch

**What goes wrong:** Without explicit `compatibilityJSON: 'v4'` in `i18n.init`, a non-default locale (especially `pt-BR`) may emit a console warning about plural rule format and fall back to v3 plural categories.

**Why it happens:** i18next 26 ships with v4 by default but the option needs to be explicit to suppress the warning (and to lock the behavior across i18next minor bumps).

**How to avoid:** Set `compatibilityJSON: 'v4'` in `apps/mobile/src/i18n/index.ts`. Already in the Pattern 1 sketch above.

**Warning signs:** Metro console emits `i18next: pluralResolver: Your environment seems to use a v3 plurals` warning.

### Pitfall 6: MMKV "locale" key collision with future feature

**What goes wrong:** Phase 8 (or §v2) adds a "user preferences" surface and someone introduces a `user.preferences.locale` key in `secureMmkv`, then assumes that's the source of truth → divergence between `localeMmkv.locale.code` and `secureMmkv.user.preferences.locale`.

**Why it happens:** Two MMKV instances + no central registry.

**How to avoid:** Document `localeMmkv` as the single source of truth for locale in `apps/mobile/src/i18n/storage.ts` header comment. Add a Phase 7 entry to the project's "MMKV key layout" decision log (if one exists in PROJECT.md or similar).

**Warning signs:** Future PRs add a `locale` key to `secureMmkv` — flag in code review.

### Pitfall 7: Unicode normalization gotchas in reverse-search

**What goes wrong:** User types `'चाय'` (NFC form) but the catalog stored `'चाय'` (NFD form, or vice versa) → lookup fails.

**Why it happens:** Hindi/Bengali/Marathi/Tamil/Telugu have multiple Unicode forms for visually-identical characters (e.g., precomposed vs. decomposed Devanagari).

**How to avoid:** Always `.normalize('NFC')` both the catalog values (at module load) AND the user input. The reverse-search code sketch already does this.

**Warning signs:** Users report search "doesn't find" tasks they typed; reproduce by checking input vs catalog with `Array.from(s).map((c) => c.codePointAt(0))`.

## Code Examples

### Catalog generation invocation

```bash
# tools/package.json scripts entry
{
  "scripts": {
    "i18n:generate": "tsx i18n/generate.ts",
    "i18n:validate": "tsx i18n/validate.ts"  # shape parity check vs en.json
  }
}

# Operator workflow
cd tools/
cp .env.example .env
# edit .env: ANTHROPIC_API_KEY=sk-ant-...
npm install
npm run i18n:generate    # ~$5-15, ~7 min for 7 locales sequentially
npm run i18n:validate    # gate: all 8 JSONs have identical key sets
```

### `formatDate` helper (D-37)

```typescript
// apps/mobile/src/lib/dates.ts (NEW)
// Source: I18N-09 + D-36 + D-37

const INTL_AVAILABLE = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined';

export function formatDate(date: Date, locale: string): string {
  if (!INTL_AVAILABLE) {
    // Hermes ships ICU but degenerate runtimes may not — fall back to en-US
    return date.toLocaleDateString('en-US', { dateStyle: 'medium' } as Intl.DateTimeFormatOptions);
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      numberingSystem: 'latn', // D-37 — Latin digits 0-9 always
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-US', { dateStyle: 'medium' } as Intl.DateTimeFormatOptions);
  }
}
```

### `errorMap.ts` (D-34)

```typescript
// apps/mobile/src/i18n/errorMap.ts (NEW)
// Source: I18N-08 + D-34

export const ERROR_CODE_TO_KEY: Record<string, string> = {
  AUTH_INVALID_TOKEN: 'errors.auth.invalidToken',
  AUTH_EXPIRED_TOKEN: 'errors.auth.expiredToken',
  AUTH_GOOGLE_FAILED: 'errors.auth.googleFailed',
  UPLOAD_QUOTA_EXCEEDED: 'errors.upload.quotaExceeded', // descoped at MVP — kept for defense
  UPLOAD_NETWORK_LOST: 'errors.upload.networkLost',
  RECORDING_TOO_SHORT: 'errors.recording.tooShort',
  COMPAT_FAILED: 'errors.compat.failed',
  // ...extend as the rest of the surfaces are inventoried in PLAN
};

export const GENERIC_ERROR_KEY = 'errors.generic';
```

## State of the Art

| Old Approach                                       | Current Approach                                        | When Changed                     | Impact                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `react-native-i18n` (archived)                     | `react-i18next@17` + `i18next@26`                       | ~2019                            | Standard JS i18n; deeper ecosystem                                                          |
| `MOMENT.js` for date format                        | `Intl.DateTimeFormat` (Hermes ICU)                      | RN 0.65+ (Hermes ICU on Android) | Native, no extra deps, locale-aware                                                         |
| Static-only translation catalogs (hand-translated) | LLM-generated (GPT-4 / Claude Opus / Sonnet)            | 2024-2025 industry shift         | $5-15 + ~10 min vs $X thousand human translation; MVP-appropriate for vernacular-brief work |
| `Tts.setDefaultLanguage('en-US')` static pin       | Per-locale + fallback chain                             | Phase 7                          | Honors user's chosen locale; degrades gracefully                                            |
| Single-Surface Camera2 CaptureSession (Phase 3)    | Multi-Surface CaptureSession (Phase 7 Option B leading) | Phase 7                          | Enables preview without GL composite or reconfigure-drops                                   |

**Deprecated / outdated:**

- `i18next-react-native-language-detector@1.0.2` (2016): unmaintained; do not use.
- `i18next-icu`: not needed for this work; CLDR plural rules from i18next core cover the 8 locales.
- `react-native-localize@3.x`: maintained but unnecessary — locale is user-chosen, not auto-detected, per D-22.

## Assumptions Log

| #   | Claim                                                                                       | Section                                                | Risk if Wrong                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `Intl.Segmenter` is not available in Hermes RN 0.83's bundled ICU                           | "Reverse-Search Map Architecture"                      | Low. If it IS available, the token-fallback for Indic locales can be more sophisticated; the MVP whitespace-tokenizer is still a valid baseline. Verify at PLAN time via runtime probe.                                                                  |
| A2  | Drift impact rankings (Option B < A < C)                                                    | "Live-Cam Preview Surface-Source A/B"                  | Medium. The leading-hypothesis claim drives the planner's first-attempt implementation. If Option B fails the A/B, fall back to A; if A also fails, escalate. The A/B procedure itself is the authoritative source — research only ranks the candidates. |
| A3  | React Native `Pressable` z-stack hit-test order is reverse paint order                      | "Tap-Zone Implementation"                              | Low. Well-documented RN behavior. Verify by Pixel 10a tap-on-Stop walk during dimmed state.                                                                                                                                                              |
| A4  | Pixel 10a Google TTS voice IDs follow `xx-yy-x-zzz-local` pattern                           | "Per-Locale TTS Fallback Chain"                        | Low. Existing `ttsVoice.ts` already encodes this assumption in `FEMALE_HEURISTIC` regex. Verify by `Tts.voices()` dump at smoke time.                                                                                                                    |
| A5  | Claude model ID `claude-opus-4-7` is the current Opus 4.7 identifier                        | "Catalog Generation Tool"                              | Low. Confirm at PLAN time via Anthropic's `/v1/models` endpoint or current docs. The wrong model ID surfaces as a 404 from the SDK, not as silent wrong output.                                                                                          |
| A6  | The published `i18next-react-native-language-detector@1.0.2` won't work on RN 0.83 New Arch | "i18n Runtime — react-i18next + RN 0.83.x Integration" | Low. Even if it works, it's better to hand-roll because the dependency is unmaintained for 10 years. The hand-rolled detector is ~30 LOC anyway.                                                                                                         |
| A7  | OEM HAL multi-Surface support holds on Pixel 10a (Tensor G3)                                | "Pitfall 4"                                            | Low. Google's own HAL; well-behaved. The §v2 OEM device sweep (Phase 8) is the correct surface for cross-OEM verification.                                                                                                                               |

**If this table is non-empty:** A1, A2, A3 are the highest-priority assumptions; the planner should validate A1 (Intl.Segmenter probe) and A3 (Pressable hit-test) during Wave 1, and A2 is the entire point of the D-04 A/B procedure in Wave 3.

## Open Questions

The questions below are intentional gaps for the planner to close at PLAN time.

1. **Final Surface-source choice (Option A vs B vs C)**

   - What we know: All three candidates enumerated; Option B is leading per Android Camera2 docs.
   - What's unclear: Actual drift delta on Pixel 10a — unknown until on-hardware A/B runs.
   - Recommendation: PLAN.md Wave 3 starts with an Option B prototype; the A/B walk decides. If Option B fails the gate, PLAN re-bakes with Option A and re-walks. Option C is documented for completeness but expected to fail.

2. **English-source-of-truth authoring strategy for `en.json`**

   - What we know: D-12 — drift handling via i18next key-fallback. `en.json` is hand-authored.
   - What's unclear: Does the planner sweep all 23 screens and extract strings into `en.json` in one plan, or progressively per-screen across multiple plans?
   - Recommendation: One screen per plan keeps plan size manageable + reviewable; but the LLM catalog regen only fires AFTER all English strings are stable. Defer `pnpm i18n:generate` to a late Wave-2 plan.

3. **Default locale on ChooseLanguageScreen when device locale is one of the 8**

   - What we know: D-22 default selection is English (`'en'` pre-selected on first render).
   - What's unclear: Should the screen pre-select the device's locale if it's one of the 8 (e.g., a Pixel set to Brazilian Portuguese auto-selects pt-BR)?
   - Recommendation: SPEC I18N-02 says "Default selection = English" — keep as-is unless owner wants to soften. If they do, `react-native-localize@3.7.0` is the right read-the-device-locale dep.

4. **Snapshot test for LLM generator output**

   - What we know: D-12 + Deferred Ideas — out of scope at MVP.
   - What's unclear: Is the planner OK with zero unit coverage on the actual LLM call?
   - Recommendation: Add a `generate.test.ts` that validates the JSON shape parity check + the validate.ts script (with a mocked Anthropic client), without making real LLM calls. That's MVP-appropriate coverage.

5. **Reverse-search token table density for the 5 Indic locales**

   - What we know: D-15 — derived at module-load time from `taskCatalog.i18n.ts`.
   - What's unclear: How robust is the auto-derived token table when source/target token counts mismatch (common in Indic compounds + Tamil/Telugu agglutination)?
   - Recommendation: Wave 2 plan that lands `reverseSearch.ts` should also land a `__tests__/reverseSearch.test.ts` with ~10 sample inputs per locale (extracted from `taskCatalog.i18n.ts` after LLM regen) to measure Stage 1 / Stage 2 hit rates. Accept <50% Stage 2 hit rate at MVP per D-14 Stage 3 passthrough being the documented degraded state.

6. **TTS pre-warm at ChooseLanguageScreen Continue tap**

   - What we know: D-31 — fallback chain runs at RecordingScreen mount.
   - What's unclear: Should we proactively call `pickAndSetVoiceForLocale(loc)` AT ChooseLanguage's Continue tap so the engine pre-warms before the user reaches Recording?
   - Recommendation: Yes — adds ~200 ms of init time to Continue→Signup but eliminates a first-recording TTS cold-start. Planner's call.

7. **Audit-trail format for LLM catalog headers**
   - What we know: D-12 — record LLM model + prompt version in a header comment at top of each locale JSON.
   - What's unclear: JSON doesn't support comments. Sibling `.audit.json` file? README at `apps/mobile/src/i18n/locales/`? Inline as a special `__meta__` key in the JSON?
   - Recommendation: `__meta__` key inside the JSON (i18next will see it as an extra key — falls through key-fallback as no-op). Single source of truth; ships with each catalog regen.

## Environment Availability

| Dependency                                 | Required By                           | Available                                | Version          | Fallback                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------- | ---------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                                    | `tools/i18n/generate.ts`              | yes (project already uses Node)          | ≥18              | none — required by @anthropic-ai/sdk                                                                                                                                                                      |
| ANTHROPIC_API_KEY                          | `tools/i18n/generate.ts`              | NO (must be provisioned)                 | n/a              | Block PLAN step until operator provisions; skippable for code-only PRs that don't regen catalogs                                                                                                          |
| Anthropic API (`api.anthropic.com`)        | `tools/i18n/generate.ts`              | yes (network)                            | n/a              | none — required for catalog regen; without it, en.json key-fallback covers runtime                                                                                                                        |
| Pixel 10a `5C161JEA304304`                 | D-04 drift A/B + per-locale TTS smoke | yes (owner has it; used through Phase 6) | Android 16       | none — A/B is the gating measurement                                                                                                                                                                      |
| Android TTS engine + per-locale voice data | I18N-06 smoke walk                    | partial                                  | varies           | For locales without engine: cues play English-fallback + Crashlytics breadcrumb. Operator must install engines (e.g., Google TTS supports all 8 via Settings → Languages & input → Text-to-speech output) |
| `pnpm`                                     | `tools/` workspace                    | yes                                      | per repo         | none                                                                                                                                                                                                      |
| Existing `node_modules` for `apps/mobile/` | most of the work                      | yes                                      | per package.json | none                                                                                                                                                                                                      |

**Missing dependencies with no fallback:**

- `ANTHROPIC_API_KEY` — operator provisioning step in PLAN setup.

**Missing dependencies with fallback:**

- Per-locale Android TTS voice data — fallback chain (D-31) handles absence with a Crashlytics breadcrumb.

## Sources

### Primary (HIGH confidence)

- npm registry — `npm view <pkg> version` for `react-i18next@17.0.8`, `i18next@26.2.0`, `@anthropic-ai/sdk@0.98.0`, `i18next-react-native-language-detector@1.0.2` (last published 2016)
- GitHub: https://github.com/i18next/react-i18next — package.json peer dependencies
- Android docs: https://developer.android.com/media/camera/camera2/multiple-camera-streams-simultaneously — multi-output CaptureSession pattern + "every Camera2 device supports ≥3 PRIV streams"
- Android docs: https://developer.android.com/media/camera/camera2/multi-camera — multi-camera API
- Anthropic SDK npm: https://www.npmjs.com/package/@anthropic-ai/sdk — Messages.create API + Node 18+ requirement
- Local code: `apps/mobile/package.json` — confirmed all existing deps + versions
- Local code: `apps/mobile/src/lib/ttsVoice.ts` — current TTS implementation + owner deviation
- Local code: `apps/mobile/src/native/HumynGateCamera.ts` — current gate camera surface model
- Local code: `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt` + `CaptureSession.kt` — current single-Surface session
- Local code: `apps/mobile/App.tsx` — current boot order
- Local code: `apps/mobile/src/services/telemetryRing.ts` — existing event shape

### Secondary (MEDIUM confidence)

- React Native 0.83 release post: https://reactnative.dev/blog/2025/12/10/react-native-0.83 — Hermes V1 + ICU bundling notes
- react-i18next docs: https://react.i18next.com/getting-started — Provider placement + `useTranslation`
- i18next docs: https://www.i18next.com/overview/api#getfixedt — `getFixedT` semantics

### Tertiary (LOW confidence)

- Training-data knowledge of `Intl.Segmenter` absence in Hermes RN 0.83 — flagged as A1; needs runtime probe at PLAN time
- Drift impact rankings between Surface-source options — flagged as A2; ONLY the on-hardware A/B is authoritative

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified via npm registry; peers verified via GitHub package.json fetch
- Architecture (i18n + brightness + tap-zone): HIGH — all patterns map to existing code or well-documented RN / Android primitives
- Surface-source choice (Option A vs B vs C): MEDIUM — rankings are training-knowledge-based; only the on-hardware A/B at PLAN time is authoritative
- Renumber sweep: HIGH — grep results inspected directly; all references already annotated
- Pitfalls: HIGH for #1, #2, #3, #5, #6, #7 (known issues in the respective libraries); MEDIUM for #4 (OEM HAL behavior is a §v2 question)

**Research date:** 2026-05-24
**Valid until:** 2026-06-23 (30 days for stable; the Anthropic SDK + Camera2 advice is stable, but re-verify the Opus 4.7 model ID just before running `pnpm i18n:generate`)

## RESEARCH COMPLETE
