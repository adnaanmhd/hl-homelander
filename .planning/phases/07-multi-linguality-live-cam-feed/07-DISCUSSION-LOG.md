# Phase 7: Multi-linguality & Live-Cam Feed - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 07-multi-linguality-live-cam-feed
**Areas discussed:** i18n runtime library, Catalog generation pipeline, Reverse-search map, Language picker UI + MMKV layout, Live-cam feed implementation

---

## Gray-area selection

| Option                                 | Description                                                                       | Selected |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| i18n runtime library                   | Which library powers `t('...')` calls across 23 screens.                          | ✓        |
| Catalog generation pipeline            | How `tools/i18n/generate.ts` runs.                                                | ✓        |
| Reverse-search map for `/tasks/search` | How locale-typed query becomes English before the network call.                   | ✓        |
| Language picker UI + MMKV key layout   | Sheet primitive vs lib; locale ordering; MMKV layout.                             | ✓        |
| Live-cam feed implementation           | Owner-added via Other (despite SPEC explicitly deferring Surface choice to PLAN). | ✓        |

**User's choice:** All four pre-presented areas plus a fifth (live-cam feed implementation) added by the owner.
**Notes:** SPEC.md REC-LIVE-19 explicitly defers the Surface-source choice to PLAN.md with on-hardware drift as the gate. Owner asked to discuss live-cam anyway — handled by capturing the surrounding decisions (component reuse, countdown copy, eye-icon source, tap-zone implementation) while preserving SPEC's Surface-decision deferral.

---

## i18n runtime library

| Option                | Description                                                                                                                                             | Selected |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| react-i18next         | RN-standard, JSON catalogs match the generator output, CLDR plurals built-in, `i18n.changeLanguage()` runtime switching. ~30 KB.                        | ✓        |
| react-intl (FormatJS) | Full ICU MessageFormat, gold standard for plurals/ordinals. ~45 KB. Harder for the LLM to produce ICU syntax consistently across 7 non-English locales. |          |
| Lingui                | Compile-time extraction, ~15 KB runtime. Fights the LLM-generated-JSON model (Lingui prefers babel-macro source extraction).                            |          |
| i18n-js minimal       | ~5 KB. No CLDR plural engine — would need hand-coded Hindi/Tamil/Bengali plural rules.                                                                  |          |

**User's choice:** react-i18next.
**Notes:** Most pragmatic for the LLM-generated JSON catalog model. CLDR plural rules for all 8 locales come built-in.

## Catalog structure follow-up

| Option                                         | Description                                                                                      | Selected |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Monolithic JSON per locale                     | One file per locale at `apps/mobile/src/i18n/locales/{locale}.json`. Matches SPEC path. 8 files. | ✓        |
| Namespaced (one folder per locale, many JSONs) | Lazy-loadable per-screen namespaces. 64+ files total. More complex generator.                    |          |

**User's choice:** Monolithic per-locale JSON.
**Notes:** Simpler for the LLM generator to produce + diff; matches the path SPEC already names.

---

## Catalog generation pipeline — LLM provider

| Option                                  | Description                                                                                                                                 | Selected |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Claude Sonnet 4.6 via @anthropic-ai/sdk | Already-familiar SDK. Strong multilingual including Indic languages.                                                                        |          |
| Claude Opus 4.7                         | Slightly better at the vernacular brief tracking ("no English loanwords where a native word exists"). Costlier but cost differential small. | ✓        |
| OpenAI GPT-4o / GPT-5                   | Multilingual quality on par but weaker brief-tracking + adds a second SDK + key.                                                            |          |

**User's choice:** Claude Opus 4.7.
**Notes:** Owner prioritized translation quality over per-run cost.

## Execution model + drift detection

| Option                                                                        | Description                                                                                              | Selected |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| 7 calls (one per locale), full-catalog overwrite, manual `pnpm i18n:generate` | Predictable, repeatable. Drift via i18next's built-in key-fallback.                                      | ✓        |
| Incremental + git-hook auto-regen                                             | Diff-only translation, pre-commit hook. Cheaper per-run but fragile + adds LLM-at-commit-time fragility. |          |
| Single batched call (7 locales in one request)                                | Cheaper if it fits, but hits output-token limits + transient failure loses all 7.                        |          |

**User's choice:** 7 calls, full overwrite, manual trigger.
**Notes:** Simplicity wins. Drift handled by i18next's missing-key fallback to en.

---

## Reverse-search map shape

| Option                                         | Description                                                                                                           | Selected |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Per-locale full-string lookup + token-fallback | Stage 1: exact match against translated task names. Stage 2: tokenize + reverse-map each token. Stage 3: passthrough. | ✓        |
| Single normalized index across all 8 locales   | Smaller code but cross-locale token collisions (`'cha'` ambiguous across pt/es).                                      |          |
| Passthrough always                             | Sends raw input to `/tasks/search`. ts_vector + pg_trgm reliably fail on non-Latin scripts. Violates I18N-10.         |          |

**User's choice:** Per-locale full-string + token-fallback.
**Notes:** Stage 1 hits when users type a full task name in their locale; Stage 2 reverse-maps individual tokens. taskCatalog.i18n.ts is the single source of truth for both reverse maps (derived at module load).

---

## Language picker UI

| Option                                                     | Description                                                                    | Selected |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Reuse existing Sheet primitive (`ui/primitives/Sheet.tsx`) | Already wraps RN Modal with transparent + slide animation. Zero new deps.      | ✓        |
| Add @gorhom/bottom-sheet                                   | 50+ KB + peer dep on react-native-gesture-handler. Overkill for 2-place usage. |          |

**User's choice:** Reuse Sheet primitive.

## Locale ordering — initial answer

| Option                                                                                     | Description                                 | Selected |
| ------------------------------------------------------------------------------------------ | ------------------------------------------- | -------- |
| India locales first (Hindi, Bengali, Tamil, Telugu, Marathi), then pt-BR, es, English last | India-first geo-weighted.                   |          |
| English first, then alphabetical by code                                                   | Predictable but buries Hindi/Tamil/Bengali. |          |
| Alphabetical by native name                                                                | Mixes scripts.                              |          |
| Other (free-text)                                                                          | "latam first, then indian locale"           | ✓        |

**User's choice (free-text):** "latam first, then indian locale" — owner-directed via Other; followed up with a question pinning English's exact spot.

## English placement follow-up

| Option                                                           | Description                                          | Selected |
| ---------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| English first, then pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN | Default selection at the top.                        | ✓        |
| pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN, en                 | English last as formal fallback.                     |          |
| pt-BR, es, en, hi-IN, bn-IN, ta-IN, te-IN, mr-IN                 | English in the middle grouping Latin-script locales. |          |

**User's choice:** English first, then LatAm (pt-BR, es), then India (hi-IN, bn-IN, ta-IN, te-IN, mr-IN).
**Notes:** Final locale ordering on both ChooseLanguageScreen and Profile picker: `[en, pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN]`.

## MMKV key layout

| Option                                              | Description                                                                               | Selected |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Separate keys, new non-secure `localeMmkv` instance | Two dotted keys (`locale.code`, `locale.chosen_at`). Atomic reads. Locale isn't a secret. | ✓        |
| One JSON blob in secureMmkv                         | Single key, parse-cost per render, unnecessarily in the secure instance.                  |          |
| Single string key in secureMmkv                     | Cheap but loses the chosen_at timestamp for diagnostics.                                  |          |

**User's choice:** Separate keys in a new non-secure `localeMmkv` instance.

---

## Live-cam Surface-source — owner steer

| Option                                                   | Description                                                                              | Selected |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Steer toward B (dedicated preview target)                | Add a second Surface to the Camera2 CaptureSession at session create. Industry standard. |          |
| Steer toward A (share encoder Surface)                   | GLES blit. Zero new ISP load but EGL complexity.                                         |          |
| Steer toward C (attach/detach mid-record)                | Session reconfigure mid-record. Likely fails A/B drift bound.                            |          |
| No steer — let PLAN compare all 3 with on-hardware drift | Trust the measurement. SPEC REC-LIVE-19 locks the 3-option comparison.                   | ✓        |

**User's choice:** No steer.
**Notes:** Honors SPEC.md REC-LIVE-19 explicitly. PLAN.md compares all 3 with the on-hardware A/B drift bound `(p99_on − p99_off) / p99_off < 0.50` (D-04) as the deciding gate.

## Preview RN component

| Option                                 | Description                                                                           | Selected |
| -------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Introduce new HumynLivePreviewView     | Single-purpose; mirrors HumynPlayer / HumynGateCamera pattern.                        | ✓        |
| Reuse HumynGateCameraView in dual-mode | `mode: 'gate' \| 'live-preview'` prop. Smaller code but couples two responsibilities. |          |

**User's choice:** New `<HumynLivePreviewView>`.

## Countdown indicator copy

| Option                                   | Description                                                       | Selected |
| ---------------------------------------- | ----------------------------------------------------------------- | -------- |
| Per-second countdown 15→14→...→0         | Visible deterministic signal. Same model for the 10-s tap-reveal. |          |
| Static "Live preview" only, no countdown | Simpler label, no timer surface.                                  | ✓        |
| Coarse intervals: 15s → 10s → 5s → 0s    | Updates only at coarse marks. Janky.                              |          |

**User's choice:** Static "Live preview" only, no numeral.
**Notes:** Owner picked simplicity over the per-second affordance.

## Eye-icon glyph + tap-zone

| Option                                                        | Description                                                   | Selected |
| ------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| lucide-react-native Eye icon + full-surface Pressable overlay | Pressable covers RecordingScreen except Stop hit-zone.        | ✓        |
| Custom SVG eye + onTouchEnd on brightness wrapper             | More custom but tangles tap semantics with RN gesture system. |          |
| No glyph + full-surface Pressable                             | Violates SPEC REC-LIVE-14 — not viable.                       |          |

**User's choice:** lucide-react-native `Eye` icon + full-surface Pressable overlay.

---

## Wrap-up

| Option                                     | Description           | Selected |
| ------------------------------------------ | --------------------- | -------- |
| Write CONTEXT.md and DISCUSSION-LOG.md now | All 5 areas captured. | ✓        |
| One more area — I'll specify               | Continue discussing.  |          |

**User's choice:** Write the file.

---

## Claude's Discretion

The following call-outs were noted as planner's choice (CONTEXT.md `<decisions>` "Claude's Discretion" subsection):

- `<I18nextProvider>` placement at App.tsx root vs scoped to navigators — standard pattern, planner's call.
- Whether to add a snapshot test that re-runs the LLM with a frozen seed against an expected output — not blocking for MVP.
- Whether to add a Storybook/QA harness for visual locale-switching across 23 screens — manual smoke covers it.
- Whether `<LanguageSheet>` and `<ChooseLanguageScreen>` share row-rendering via a `<LanguageList>` component or duplicate the FlatList — planner's call.
- Exact `apps/mobile/src/i18n/storage.ts` module shape for `LOCALE_KEYS` constants — follows the existing `KEYS` pattern (Phase 5/6).
- Specific lucide opacity token for the dim eye glyph — defer to tokens.ts authoring.
- `i18next-react-native-language-detector` vs hand-rolled MMKV-backed detector — planner's call; both valid.

---

## Deferred Ideas

The following surfaced as candidate work but belong outside Phase 7 (CONTEXT.md `<deferred>` section):

- Incremental drift detection in `tools/i18n/generate.ts`.
- Snapshot test for LLM generator output.
- Locale-switching visual regression harness across 23 screens.
- iOS analogue for `<HumynLivePreviewView>` (§v2 IOS-01..07).
- Human translator review pass.
- Per-locale legal counsel review.
- pgvector + RRF semantic-search surface in non-English locales (§v2 SEARCH-V2-01).
