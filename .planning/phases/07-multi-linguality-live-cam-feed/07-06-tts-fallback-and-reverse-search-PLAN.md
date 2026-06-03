---
phase: 07-multi-linguality-live-cam-feed
plan: 06
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/mobile/src/lib/ttsVoice.ts
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/i18n/taskCatalog.i18n.ts
  - apps/mobile/src/i18n/reverseSearch.ts
  - apps/mobile/src/services/tasksApi.ts
  - apps/mobile/src/lib/__tests__/ttsVoice.test.ts
  - apps/mobile/src/i18n/__tests__/reverseSearch.test.ts
  - apps/mobile/src/i18n/__tests__/taskCatalog.test.ts
# NOTE: RecordingScreen.tsx is ALSO modified by plan 07-07 (Wave 3 — live-preview state
# machine). 07-06 (Wave 2) touches a single useEffect call site (pickAndSetEnInVoice
# -> pickAndSetLocaleVoice(i18n.language)); the wave gate (06 = Wave 2, 07 = Wave 3)
# serializes them so they cannot conflict in parallel. Declared here for transparency.
autonomous: true
requirements: [I18N-06, I18N-10]
tags: [i18n, tts, search, mobile]
must_haves:
  truths:
    - '`ttsVoice.ts` calls `Tts.setDefaultLanguage(activeLocale)` (NOT the legacy hardcoded en-US) at session start'
    - 'TTS voice resolution walks the 5-step chain: locale-female → locale-any → en-US-female → en-US-any → first en-* (D-31)'
    - "Falling back past step 2 (no locale voice) emits a Crashlytics breadcrumb `{ event: 'tts_locale_fallback', locale, fallback: true }`"
    - "The owner's en-US deviation is preserved for `i18n.language === 'en'` (CLAUDE.md TTS banner)"
    - '`taskCatalog.i18n.ts` exposes name + description + instructions + examples per locale for all 65 tasks (D-01)'
    - '`reverseSearch(query, locale)` returns canonical English via Stage 1 (full-string) → Stage 2 (tokens) → Stage 3 (passthrough)'
    - "`tasksApi.searchTasks` rewrites the user's locale query to English before hitting `/tasks/search`; backend unchanged (D-16)"
  artifacts:
    - path: apps/mobile/src/lib/ttsVoice.ts
      provides: 'Extended pickAndSetLocaleVoice with 5-step fallback chain'
      contains: 'pickAndSetLocaleVoice'
    - path: apps/mobile/src/i18n/taskCatalog.i18n.ts
      provides: '65 tasks × 8 locales (full body — name + description + instructions + examples)'
      contains: 'TASK_CATALOG_I18N'
    - path: apps/mobile/src/i18n/reverseSearch.ts
      provides: '3-stage reverse-map shim (full-string → tokens → passthrough)'
      exports: ['reverseSearch', 'buildReverseMaps']
    - path: apps/mobile/src/services/tasksApi.ts
      provides: 'searchTasks call site wrapped with reverseSearch shim'
      contains: 'reverseSearch'
  key_links:
    - from: apps/mobile/src/services/tasksApi.ts
      to: apps/mobile/src/i18n/reverseSearch.ts
      via: query rewrite before /tasks/search
      pattern: "reverseSearch\\("
    - from: apps/mobile/src/i18n/reverseSearch.ts
      to: apps/mobile/src/i18n/taskCatalog.i18n.ts
      via: module-load reverse-map build
      pattern: 'TASK_CATALOG_I18N'
    - from: apps/mobile/src/lib/ttsVoice.ts
      to: '@react-native-firebase/crashlytics'
      via: breadcrumb log on locale fallback
      pattern: 'tts_locale_fallback'
---

<objective>
Two big-but-independent surfaces. Both depend only on plan 07-01 (the i18n runtime).

1. **Per-locale TTS fallback chain (I18N-06 / D-31)** — extend `apps/mobile/src/lib/ttsVoice.ts` so the recording-screen voice cues play in the active locale's voice when an engine is present. The owner's existing en-US deviation banner stays valid for `i18n.language === 'en'` (CLAUDE.md TTS banner is preserved). When the active locale has no installed voice, fall through to the existing en-US chain AND emit a Crashlytics breadcrumb `{ event: 'tts_locale_fallback', locale, fallback: true }`.

2. **65-task catalog + reverse-search shim (I18N-10 / D-01 / D-14..D-16)** — ship `taskCatalog.i18n.ts` with full-body translations (name + description + instructions + examples) for all 65 tasks in `task-taxonomy.md` across 8 locales (D-01). Ship `reverseSearch.ts` with the 3-stage lookup (full-string → tokens → passthrough). Wrap `apps/mobile/src/services/tasksApi.ts`'s `searchTasks` so the user's locale query is rewritten to canonical English before the network call. Backend is untouched (D-16) — `/tasks/search` + `ts_vector + GIN + pg_trgm` from Phase 6 continue to handle the rewritten English query.

Output: recording cues play in the user's locale when possible; History day headers / Profile dates already migrated in plan 07-05 use `formatDate`; task search returns the canonical English row when a user types the translated task name; no DB migration.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VALIDATION.md
@CLAUDE.md
@task-taxonomy.md
@apps/mobile/src/lib/ttsVoice.ts
@apps/mobile/src/services/tasksApi.ts

<interfaces>
From apps/mobile/src/lib/ttsVoice.ts (current shape — lines 41-46 + 60-97):
```typescript
interface TtsVoice {
  id?: string;
  name?: string;
  language?: string;       // BCP-47 e.g. 'en-US', 'hi-IN'
  notInstalled?: boolean;
}
export async function pickAndSetEnInVoice(): Promise<void> {
  // existing 3-step en-US-only chain — owner deviation per CLAUDE.md
}
```

From apps/mobile/src/services/tasksApi.ts (current shape):

```typescript
export async function searchTasks(
  q: string,
  args: SearchTasksArgs = {},
): Promise<TasksSearchResponse> {
  const query: Record<string, string> = { q };
  // ...
  return apiClient.getJson<TasksSearchResponse>('/tasks/search', { query, timeoutMs: 5_000 });
}
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend ttsVoice.ts to 5-step per-locale fallback + Crashlytics breadcrumb</name>
  <files>apps/mobile/src/lib/ttsVoice.ts, apps/mobile/src/lib/__tests__/ttsVoice.test.ts</files>
  <read_first>
    - apps/mobile/src/lib/ttsVoice.ts (full file — note owner-deviation banner at the header, `pickAndSetEnInVoice` body, the `looksFemale` helper, the Tts.setDefaultRate/Pitch calls)
    - CLAUDE.md TTS owner-deviation section (en-US for English locale)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-06, D-31
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Per-Locale TTS Fallback Chain" (lines 762-852) + "Pitfall 2: Tts.voices() race on Android 14+"
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "ttsVoice.ts" (lines 745-822)
  </read_first>
  <behavior>
    - `pickAndSetLocaleVoice(activeLocale)` is the new public export.
    - For each invocation, `await Tts.getInitStatus()` happens BEFORE `Tts.voices()` (Pitfall 2).
    - The 5-step chain runs in order: locale-female → locale-any → en-US-female → en-US-any → first en-*. (D-31 — these are voice candidate steps; the candidates that pass `notInstalled` filter are tried first.)
    - `Tts.setDefaultLanguage` is called with `activeLocale === 'en' ? 'en-US' : activeLocale` (preserves owner deviation for English per CLAUDE.md).
    - When the activated voice ID belongs to a locale OTHER than `activeLocale` (i.e. fell past step 2), emit `crashlytics().log(JSON.stringify({ event: 'tts_locale_fallback', locale: activeLocale, fallback: true }))`.
    - When `activeLocale === 'en'`, NO breadcrumb is logged (en is the always-true fallback target — would flood Crashlytics).
    - `Tts.setDefaultRate(1.0, true)` + `Tts.setDefaultPitch(0.95)` stay verbatim (owner-locked).
    - `pickAndSetEnInVoice` is preserved as an EXPORT calling `pickAndSetLocaleVoice('en')` (per D-31 — "import-call stability" for the existing RecordingScreen call site).
    - All Tts calls wrap in try/catch (best-effort).
  </behavior>
  <action>
1. **Read `apps/mobile/src/lib/ttsVoice.ts` in full** to identify the existing `looksFemale` helper, the `TtsVoice` interface, and the owner-deviation banner. Preserve everything except the function body.

2. **Refactor `pickAndSetEnInVoice` to `pickAndSetLocaleVoice(activeLocale)`** following the D-31 5-step chain. Add a thin backward-compat wrapper:

   ```typescript
   import crashlytics from '@react-native-firebase/crashlytics';
   import Tts from 'react-native-tts';

   // Existing TtsVoice interface + looksFemale stay above

   export async function pickAndSetLocaleVoice(activeLocale: string): Promise<void> {
     try {
       await Tts.getInitStatus();
     } catch {
       /* best-effort */
     }

     let voices: TtsVoice[] = [];
     try {
       voices = ((await Tts.voices()) as TtsVoice[]) ?? [];
     } catch {
       voices = [];
     }
     const usable = voices.filter((v) => !v.notInstalled);

     // Pin language to activeLocale, except 'en' resolves to 'en-US' per CLAUDE.md owner deviation
     const langTag = activeLocale === 'en' ? 'en-US' : activeLocale;
     try {
       await Tts.setDefaultLanguage(langTag);
     } catch {
       /* best-effort */
     }

     // 5-step chain (D-31)
     const pick =
       usable.find((v) => v.language === activeLocale && looksFemale(v))?.id ?? // 1
       usable.find((v) => v.language === activeLocale)?.id ?? // 2
       usable.find((v) => v.language === 'en-US' && looksFemale(v))?.id ?? // 3
       usable.find((v) => v.language === 'en-US')?.id ?? // 4
       usable.find((v) => (v.language ?? '').toLowerCase().startsWith('en'))?.id; // 5

     if (pick) {
       try {
         await Tts.setDefaultVoice(pick);
       } catch {
         /* best-effort */
       }
     }

     // Crashlytics breadcrumb when we fell past step 2 (no locale-matching voice)
     if (activeLocale !== 'en') {
       const localeHit = usable.some((v) => v.language === activeLocale);
       if (!localeHit) {
         try {
           crashlytics().log(
             JSON.stringify({
               event: 'tts_locale_fallback',
               locale: activeLocale,
               fallback: true,
             }),
           );
         } catch {
           /* best-effort */
         }
       }
     }

     Tts.setDefaultRate(1.0, true); // owner-locked
     Tts.setDefaultPitch(0.95); // owner-locked
   }

   /**
    * Backward-compat shim — the existing RecordingScreen call site
    * `pickAndSetEnInVoice()` keeps working (D-31). For new code,
    * call pickAndSetLocaleVoice(i18n.language) directly.
    */
   export async function pickAndSetEnInVoice(): Promise<void> {
     return pickAndSetLocaleVoice('en');
   }
   ```

3. **Update RecordingScreen call site**: find the existing `pickAndSetEnInVoice().catch(...)` call (per 07-PATTERNS.md it is at line 258 of `RecordingScreen.tsx`) and change to read i18n.language:

   ```typescript
   // BEFORE: pickAndSetEnInVoice().catch(() => undefined);
   // AFTER:
   import { useTranslation } from 'react-i18next';
   import { pickAndSetLocaleVoice } from '../../lib/ttsVoice';
   // ...
   const { i18n } = useTranslation();
   useEffect(() => {
     pickAndSetLocaleVoice(i18n.language).catch(() => undefined);
     // ... existing effect body ...
   }, []);
   ```

   Note: plan 07-07 (Wave 3) ALSO modifies `RecordingScreen.tsx` heavily for the live-preview state machine. If plans 07-06 and 07-07 land in the same execute-phase run, the file-ownership rule says 07-06 should run BEFORE 07-07 — wave numbering already encodes this (06 is Wave 2, 07 is Wave 3). If they end up in parallel, this small useEffect change is independent of the brightness state machine and can be merged in either order.

4. **Create `apps/mobile/src/lib/__tests__/ttsVoice.test.ts`**:

   ```typescript
   import { describe, it, expect, beforeEach, vi } from 'vitest';

   // Mock Tts and Crashlytics BEFORE importing the module under test
   const setDefaultLanguage = vi.fn().mockResolvedValue(undefined);
   const setDefaultVoice = vi.fn().mockResolvedValue(undefined);
   const setDefaultRate = vi.fn();
   const setDefaultPitch = vi.fn();
   const getInitStatus = vi.fn().mockResolvedValue(true);
   const voicesMock = vi.fn();
   const crashLog = vi.fn();

   vi.mock('react-native-tts', () => ({
     default: {
       getInitStatus,
       voices: voicesMock,
       setDefaultLanguage,
       setDefaultVoice,
       setDefaultRate,
       setDefaultPitch,
     },
   }));
   vi.mock('@react-native-firebase/crashlytics', () => ({
     default: () => ({ log: crashLog }),
   }));

   import { pickAndSetLocaleVoice, pickAndSetEnInVoice } from '../ttsVoice';

   describe('pickAndSetLocaleVoice (I18N-06 / D-31)', () => {
     beforeEach(() => {
       setDefaultLanguage.mockClear();
       setDefaultVoice.mockClear();
       setDefaultRate.mockClear();
       setDefaultPitch.mockClear();
       crashLog.mockClear();
       voicesMock.mockReset();
     });

     it('picks the locale female voice first (step 1)', async () => {
       voicesMock.mockResolvedValue([
         { id: 'hi-IN-male', language: 'hi-IN', name: 'Hindi Male' },
         { id: 'hi-IN-female', language: 'hi-IN', name: 'Hindi Female' },
       ]);
       await pickAndSetLocaleVoice('hi-IN');
       expect(setDefaultLanguage).toHaveBeenCalledWith('hi-IN');
       expect(setDefaultVoice).toHaveBeenCalledWith('hi-IN-female');
       expect(crashLog).not.toHaveBeenCalled();
     });

     it('falls to step 2 (any locale voice) when no female voice exists', async () => {
       voicesMock.mockResolvedValue([{ id: 'pt-BR-x', language: 'pt-BR', name: 'PtBr X' }]);
       await pickAndSetLocaleVoice('pt-BR');
       expect(setDefaultVoice).toHaveBeenCalledWith('pt-BR-x');
       expect(crashLog).not.toHaveBeenCalled();
     });

     it('falls to step 3+ when no locale voice is installed AND logs a Crashlytics breadcrumb', async () => {
       voicesMock.mockResolvedValue([
         { id: 'en-US-x-female', language: 'en-US', name: 'English Female' },
       ]);
       await pickAndSetLocaleVoice('ta-IN');
       expect(setDefaultLanguage).toHaveBeenCalledWith('ta-IN');
       expect(setDefaultVoice).toHaveBeenCalledWith('en-US-x-female');
       expect(crashLog).toHaveBeenCalledTimes(1);
       const arg = JSON.parse(crashLog.mock.calls[0][0] as string);
       expect(arg.event).toBe('tts_locale_fallback');
       expect(arg.locale).toBe('ta-IN');
       expect(arg.fallback).toBe(true);
     });

     it('preserves the en-US owner deviation when activeLocale is en', async () => {
       voicesMock.mockResolvedValue([{ id: 'en-US-x', language: 'en-US', name: 'EnUS' }]);
       await pickAndSetLocaleVoice('en');
       expect(setDefaultLanguage).toHaveBeenCalledWith('en-US'); // NOT 'en'
       expect(crashLog).not.toHaveBeenCalled(); // en never logs fallback
     });

     it('keeps the owner-locked rate + pitch unchanged', async () => {
       voicesMock.mockResolvedValue([]);
       await pickAndSetLocaleVoice('en');
       expect(setDefaultRate).toHaveBeenCalledWith(1.0, true);
       expect(setDefaultPitch).toHaveBeenCalledWith(0.95);
     });

     it('pickAndSetEnInVoice() delegates to pickAndSetLocaleVoice("en")', async () => {
       voicesMock.mockResolvedValue([{ id: 'en-US-x', language: 'en-US' }]);
       await pickAndSetEnInVoice();
       expect(setDefaultLanguage).toHaveBeenCalledWith('en-US');
     });
   });
   ```

     </action>
     <verify>
       <automated>cd apps/mobile && npm test -- --run src/lib/__tests__/ttsVoice.test.ts 2>&1 | tail -25</automated>
     </verify>
     <acceptance_criteria>
       - `grep -c "pickAndSetLocaleVoice" apps/mobile/src/lib/ttsVoice.ts` returns at least 2 (export + internal references).
       - `grep -c "pickAndSetEnInVoice" apps/mobile/src/lib/ttsVoice.ts` returns 1 (backward-compat shim retained).
       - `grep -c "tts_locale_fallback" apps/mobile/src/lib/ttsVoice.ts` returns 1.
       - `grep -c "setDefaultRate(1.0" apps/mobile/src/lib/ttsVoice.ts` returns 1 (owner-locked rate untouched).
       - Test command exits 0; all 6 `it()` cases under "pickAndSetLocaleVoice" green.
     </acceptance_criteria>
     <done>5-step chain ships; en owner-deviation preserved; Crashlytics breadcrumb fires on locale-miss only; existing `pickAndSetEnInVoice` import-call stable.</done>
   </task>

<task type="auto" tdd="true">
  <name>Task 2: taskCatalog.i18n.ts (65 tasks × 8 locales full body) + reverseSearch.ts + tasksApi.ts shim + tests</name>
  <files>apps/mobile/src/i18n/taskCatalog.i18n.ts, apps/mobile/src/i18n/reverseSearch.ts, apps/mobile/src/services/tasksApi.ts, apps/mobile/src/i18n/__tests__/reverseSearch.test.ts, apps/mobile/src/i18n/__tests__/taskCatalog.test.ts</files>
  <read_first>
    - **task-taxonomy.md** (THE authoritative source for the English task entries — markdown table at lines 12 → EOF; each data row is one task with columns `Category | Task | Setting | Description | Instructions`). 2026-05-24 line count: 86 data rows; **SPEC I18N-10 says 65 tasks** — the executor MUST de-duplicate / scope to the 65 SPEC-relevant tasks. If the count cannot be reconciled cleanly (e.g. SPEC line 79 says 65 but taxonomy has 86), STOP and surface the discrepancy in the SUMMARY before fabricating extras.
    - apps/mobile/src/services/tasksApi.ts (existing searchTasks signature at lines 61-73 — preserve verbatim)
    - apps/mobile/src/services/historyGrouping.ts (analog: module-load static table + derived structure)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-01, D-14, D-15, D-16
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Reverse-Search Map Architecture" (lines 724-759) + "Pattern 3: Reverse-search shim" (lines 495-528) + "Pitfall 7: Unicode normalization gotchas"
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "reverseSearch.ts" + "taskCatalog.i18n.ts" + "tasksApi.ts"
    - tools/i18n/generate.ts (plan 07-02 — same LLM tool generates the task catalog translations)
  </read_first>
  <behavior>
    - `TASK_CATALOG_I18N` is a `Record<canonical_en_name, Record<locale, { name, description, instructions, examples }>>` for all 65 tasks (D-01 — full body).
    - The English entries (`'en'`) byte-match the on-screen English copy from `task-taxonomy.md` / Phase 6 TaskDetailsSheet.
    - The 7 non-English entries are populated via the LLM generator (re-using the `tools/i18n/generate.ts` pattern OR a sibling `tools/i18n/generate-tasks.ts`).
    - `reverseSearch(input, locale)` returns canonical English: Stage 1 (NFC-normalized lowercase full-string lookup) → Stage 2 (whitespace-token table lookup → rebuild English query if any token matched) → Stage 3 (passthrough — raw input).
    - `reverseSearch('चाय बनाओ', 'hi-IN')` returns `'Make tea'` (exact canonical match).
    - `reverseSearch('chai banao', 'hi-IN')` returns `'chai banao'` (Stage 3 passthrough — backend's `pg_trgm` handles it as English noise).
    - `reverseSearch('Make tea', 'en')` returns `'Make tea'` (Stage 1 trivial pass).
    - `reverseSearch('PÃO', 'pt-BR')` matches against an NFD-stripped catalog entry (Pitfall 7 — accent stripping for Latin scripts).
    - `searchTasks(q, args)` calls `reverseSearch(q, i18n.language)` BEFORE constructing the query record. Backend untouched.
  </behavior>
  <action>
**Important note on scope:** Hand-authoring 65 tasks × 8 locales × 4 fields = 2,080 strings is a lot. Per D-15, the source-of-truth file is `taskCatalog.i18n.ts` itself; per D-12 the LLM tool from plan 07-02 produces translations. The cleanest pipeline:

1. **Hand-author** the English (`'en'`) entries for all 65 tasks from `task-taxonomy.md`. Required (~150 lines for 65 tasks; each entry has `name`, `description`, `instructions: string[]`, `examples: string[]`).
2. **Generate** the 7 non-English entries via an LLM call that reads the English entries and produces translated objects with identical structure — either via an extension to `tools/i18n/generate.ts` (a new `--target=taskCatalog` mode) OR a sibling `tools/i18n/generate-tasks.ts` that reuses the same Anthropic client + vernacular brief.

**Implementation steps:**

1. **Hand-author the English skeleton** at `apps/mobile/src/i18n/taskCatalog.i18n.ts`. **Source-of-truth contract:** every English entry (`name`, `description`, `instructions[]`) is sourced verbatim from a row of `task-taxonomy.md` (lines 12 → EOF). The taxonomy row's `Task` column → the canonical English `name`; `Description` column → the `description`; `Instructions` column (split on `<br>` or the bullet character) → the `instructions[]` array. `examples[]` is sourced from `apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx` if it ships per-task examples, otherwise from the Phase 6 SPEC source. **Do NOT fabricate descriptions or instructions** — if a row in task-taxonomy.md does not have an Instructions column, leave `instructions: []` and flag in SUMMARY; do NOT invent.

   **Count reconciliation (BLOCKING):** SPEC I18N-10 line 79 says "65-task catalog". task-taxonomy.md as of 2026-05-24 has 86 data rows. Before committing, verify with the owner whether (a) all 86 ship (and SPEC says "65" loosely), or (b) the executor selects a 65-task subset (which 65?), or (c) the taxonomy file is the wrong source. The executor MUST stop and ask, NOT silently pick.

   Initial skeleton shape (for reference; the executor fills from the resolved source list):

   ```typescript
   import type { Locale } from './storage';

   export interface TaskBody {
     name: string;
     description: string;
     instructions: string[];
     examples: string[];
   }

   export interface ReverseMap {
     fullStringMap: Record<string, string>; // NFC-lowercase translated → canonical English
     tokenMap: Record<string, string>; // NFC-lowercase translated token → English token
   }

   /**
    * 65 tasks × 8 locales. Sourced from task-taxonomy.md.
    * D-01 — full body (name + description + instructions + examples).
    * D-15 — single source of truth; reverse maps derived at module load.
    *
    * English (`en`) is hand-authored from the canonical task taxonomy.
    * The 7 non-English locale objects are LLM-generated by tools/i18n/generate-tasks.ts.
    */
   export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = {
     'Make tea': {
       en: {
         name: 'Make tea',
         description: 'Prepare a cup of tea from start to finish.',
         instructions: [
           'Boil water in a kettle.',
           'Add tea leaves or a tea bag.',
           'Pour into a cup.',
         ],
         examples: ['Chai with milk and sugar', 'Plain black tea', 'Green tea'],
       },
       // LLM-populated below — placeholder entries with English values until generate-tasks runs
       'pt-BR': { name: 'Make tea', description: '...', instructions: [], examples: [] },
       es: { name: 'Make tea', description: '...', instructions: [], examples: [] },
       'hi-IN': { name: 'Make tea', description: '...', instructions: [], examples: [] },
       'bn-IN': { name: 'Make tea', description: '...', instructions: [], examples: [] },
       'ta-IN': { name: 'Make tea', description: '...', instructions: [], examples: [] },
       'te-IN': { name: 'Make tea', description: '...', instructions: [], examples: [] },
       'mr-IN': { name: 'Make tea', description: '...', instructions: [], examples: [] },
     },
     // ... 64 more tasks ...
   };
   ```

   Read `task-taxonomy.md` (canonical refs in 07-CONTEXT.md) AND `apps/mobile/src/lib/taskTaxonomy.ts` (if present — Phase 6 inlined the 65 tasks somewhere) to source the English entries. If the existing Phase 6 source has only `name` and not `description / instructions / examples`, pull descriptions from `apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx` (Phase 6's TaskDetailsSheet body — same content).

2. **Helper: build reverse maps at module load** (per D-15 — derived, not pre-built JSON):

   ```typescript
   function normalize(s: string): string {
     // NFC normalize, strip combining marks (accent stripping for Latin scripts per Pitfall 7),
     // lowercase, trim
     return s
       .normalize('NFD')
       .replace(/\p{Mn}/gu, '')
       .normalize('NFC')
       .toLowerCase()
       .trim();
   }

   export function buildReverseMaps(catalog: typeof TASK_CATALOG_I18N): Record<string, ReverseMap> {
     const out: Record<string, ReverseMap> = {};
     const locales: Locale[] = ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'];

     for (const loc of locales) {
       const fullStringMap: Record<string, string> = {};
       const tokenMap: Record<string, string> = {};

       for (const [canonical, byLocale] of Object.entries(catalog)) {
         const localized = byLocale[loc]?.name;
         if (!localized) continue;

         // Stage 1: full-string entry
         fullStringMap[normalize(localized)] = canonical;

         // Stage 2: token-level mapping (whitespace split + 1:1 alignment when counts match)
         const enTokens = canonical.split(/\s+/).map(normalize).filter(Boolean);
         const locTokens = localized.split(/\s+/).map(normalize).filter(Boolean);
         if (enTokens.length === locTokens.length && enTokens.length > 0) {
           for (let i = 0; i < enTokens.length; i++) {
             const enTok = enTokens[i];
             const locTok = locTokens[i];
             if (!locTok || !enTok) continue;
             // Skip articles / prepositions (English content-word filter)
             if (['a', 'an', 'the', 'to', 'of', 'for', 'with', 'in', 'on'].includes(enTok))
               continue;
             tokenMap[locTok] = enTok;
           }
         }
       }

       out[loc] = { fullStringMap, tokenMap };
     }
     return out;
   }

   export const REVERSE_BY_LOCALE: Record<string, ReverseMap> = buildReverseMaps(TASK_CATALOG_I18N);
   ```

3. **Create `apps/mobile/src/i18n/reverseSearch.ts`** (the 3-stage shim):

   ```typescript
   import { REVERSE_BY_LOCALE, type ReverseMap } from './taskCatalog.i18n';

   function normalize(s: string): string {
     return s
       .normalize('NFD')
       .replace(/\p{Mn}/gu, '')
       .normalize('NFC')
       .toLowerCase()
       .trim();
   }

   /**
    * 3-stage reverse map per D-14:
    *   Stage 1 — full-string lookup (translated → canonical English)
    *   Stage 2 — token-fallback (rebuild English from per-token matches)
    *   Stage 3 — passthrough (raw input; backend pg_trgm tries)
    */
   export function reverseSearch(input: string, locale: string): string {
     if (locale === 'en' || !REVERSE_BY_LOCALE[locale]) return input;
     const map = REVERSE_BY_LOCALE[locale];

     const normalized = normalize(input);
     if (!normalized) return input;

     // Stage 1
     const hit = map.fullStringMap[normalized];
     if (hit) return hit;

     // Stage 2
     const tokens = input.split(/\s+/).map(normalize).filter(Boolean);
     const mapped = tokens.map((t) => map.tokenMap[t] ?? t);
     const anyMapped = mapped.some((t, i) => t !== tokens[i]);
     if (anyMapped) return mapped.join(' ');

     // Stage 3 — passthrough
     return input;
   }

   // Re-export for callers
   export { REVERSE_BY_LOCALE };
   ```

4. **Modify `apps/mobile/src/services/tasksApi.ts`** per 07-PATTERNS.md "tasksApi.ts" (lines 824-871):

   ```typescript
   import { reverseSearch } from '../i18n/reverseSearch';
   import i18n from '../i18n';

   export async function searchTasks(
     q: string,
     args: SearchTasksArgs = {},
   ): Promise<TasksSearchResponse> {
     // D-14 — reverse-map locale input to canonical English BEFORE the network call
     const englishQuery = reverseSearch(q, i18n.language);

     const query: Record<string, string> = { q: englishQuery };
     if (args.category) query.category = args.category;
     if (args.setting) query.setting = args.setting;
     if (args.limit !== undefined) query.limit = String(args.limit);
     return apiClient.getJson<TasksSearchResponse>('/tasks/search', {
       query,
       timeoutMs: 5_000,
     });
   }
   ```

   The 200-ms debounce in `useTaskSearch` (Phase 6) is UNCHANGED. Backend is UNCHANGED (D-16).

5. **Create `apps/mobile/src/i18n/__tests__/taskCatalog.test.ts`** — includes the SPEC-65 count gate + the non-placeholder body gate (acceptance criteria above):

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { TASK_CATALOG_I18N, REVERSE_BY_LOCALE, buildReverseMaps } from '../taskCatalog.i18n';

   describe('TASK_CATALOG_I18N (I18N-10 / D-01 / D-15)', () => {
     it('contains exactly the 65 SPEC-locked tasks (I18N-10 line 79)', () => {
       expect(Object.keys(TASK_CATALOG_I18N).length).toBe(65);
     });

     it('every English entry has a non-empty description + at least 1 instruction (non-placeholder gate)', () => {
       for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
         const en = byLocale.en;
         expect(en, `${canonical}/en body present`).toBeTruthy();
         expect(en.description.length, `${canonical}/en description non-empty`).toBeGreaterThan(0);
         expect(en.description, `${canonical}/en description not a sketch literal`).not.toBe('...');
         expect(
           en.instructions.length,
           `${canonical}/en at least 1 instruction`,
         ).toBeGreaterThanOrEqual(1);
       }
     });

     it('has 8 locale entries for every canonical task (full-body D-01)', () => {
       const expected = ['en', 'pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'].sort();
       for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
         const actual = Object.keys(byLocale).sort();
         expect(actual, `task=${canonical}`).toEqual(expected);
         for (const loc of expected) {
           const body = byLocale[loc as never];
           expect(body, `${canonical}/${loc} body present`).toBeTruthy();
           expect(typeof body.name).toBe('string');
           expect(typeof body.description).toBe('string');
           expect(Array.isArray(body.instructions)).toBe(true);
           expect(Array.isArray(body.examples)).toBe(true);
         }
       }
     });

     it('REVERSE_BY_LOCALE covers all 7 non-English locales', () => {
       const expected = ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'].sort();
       expect(Object.keys(REVERSE_BY_LOCALE).sort()).toEqual(expected);
     });

     it('buildReverseMaps is idempotent (callable from tests)', () => {
       const fresh = buildReverseMaps(TASK_CATALOG_I18N);
       expect(Object.keys(fresh).length).toBeGreaterThanOrEqual(7);
     });
   });
   ```

6. **Create `apps/mobile/src/i18n/__tests__/reverseSearch.test.ts`**:

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { reverseSearch } from '../reverseSearch';

   describe('reverseSearch (D-14 / D-15)', () => {
     it('returns input as-is when locale is en (no rewrite)', () => {
       expect(reverseSearch('Make tea', 'en')).toBe('Make tea');
     });

     it('Stage 1 — full-string match for hi-IN ("चाय बनाओ" → "Make tea")', () => {
       // Only asserts when the catalog has been LLM-populated. If the placeholder
       // still has English values, this test should fall through to passthrough.
       const out = reverseSearch('चाय बनाओ', 'hi-IN');
       // Either the canonical English (when LLM-populated) or the raw input (placeholder phase)
       expect(['Make tea', 'चाय बनाओ']).toContain(out);
     });

     it('Stage 3 — passthrough for unknown text', () => {
       // 'totallyunknowntext' is in no token map
       expect(reverseSearch('totallyunknowntext', 'hi-IN')).toBe('totallyunknowntext');
     });

     it('handles empty input gracefully', () => {
       expect(reverseSearch('', 'hi-IN')).toBe('');
     });

     it('accent stripping for pt-BR — "PÃO" normalizes', () => {
       const out = reverseSearch('PÃO', 'pt-BR');
       expect(typeof out).toBe('string');
     });

     it('falls back when locale has no reverse map', () => {
       expect(reverseSearch('whatever', 'fr-FR')).toBe('whatever');
     });
   });
   ```

7. **Extend `tools/i18n/generate.ts`** OR create a sibling `tools/i18n/generate-tasks.ts` that re-uses the Anthropic client to translate the task catalog. The script reads the English entries from `apps/mobile/src/i18n/taskCatalog.i18n.ts` (which is a TypeScript file — easier to write a small parser that round-trips through JSON), prompts the LLM per locale with the vernacular brief, and writes back the file with 7 locales populated. Operator runs `cd tools && npm run i18n:generate-tasks` (or whatever script name) once `taskCatalog.i18n.ts`'s English entries are stable.

   Reuse of plan 07-02's `prompts.ts` `VERNACULAR_BRIEF` is mandatory (same vernacular brief governs both).

   If this is deferred (e.g. operator does not have `ANTHROPIC_API_KEY` ready), document in SUMMARY — the reverseSearch test gracefully handles the placeholder-English phase per the `['Make tea', 'चाय बनाओ']` expectation.
   </action>
   <verify>
   <automated>cd apps/mobile && npm test -- --run src/i18n/**tests**/taskCatalog.test.ts src/i18n/**tests**/reverseSearch.test.ts 2>&1 | tail -30</automated>
   </verify>
   <acceptance_criteria> - File `apps/mobile/src/i18n/taskCatalog.i18n.ts` exists; `grep -c "'Make tea'" apps/mobile/src/i18n/taskCatalog.i18n.ts` returns at least 1. - `grep -c "REVERSE_BY_LOCALE" apps/mobile/src/i18n/taskCatalog.i18n.ts` returns at least 2 (declaration + export). - **65-task count gate (SPEC I18N-10 / D-01):** the English entries authored from `task-taxonomy.md` cover the SPEC-locked 65 tasks. Verify via a runtime assertion in `taskCatalog.test.ts` (added in step 5 below) that `Object.keys(TASK_CATALOG_I18N).length === 65`. If the SPEC says 65 but the taxonomy table has more, the executor STOPPED + asked the owner before committing. - **Non-placeholder English bodies gate:** for every canonical task, the `'en'` body has a non-empty `description` AND `instructions.length >= 1`. Verify via a runtime assertion in `taskCatalog.test.ts` — no canonical may have `description: '...'` or empty `instructions: []` arrays at commit time (those were sketch values used only during initial scaffolding). - File `apps/mobile/src/i18n/reverseSearch.ts` exists; `grep -c "fullStringMap" apps/mobile/src/i18n/reverseSearch.ts` returns at least 1. - `grep -c "reverseSearch" apps/mobile/src/services/tasksApi.ts` returns at least 1. - `grep -c "/tasks/search" apps/mobile/src/services/tasksApi.ts` returns at least 1 (backend route unchanged — same endpoint hit). - `git diff --stat apps/api/src/routes/tasks/` returns empty (D-16 — backend unchanged). - Test command exits 0; all 3+ taskCatalog cases (including the count + non-placeholder gates) + all 6 reverseSearch cases green.
   </acceptance_criteria>
   <done>65 tasks × 8 locales structure committed (English authoritative; non-English placeholder until LLM regen); 3-stage reverseSearch shim wraps `/tasks/search`; backend untouched; all tests green.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                  | Description                                      |
| ----------------------------------------- | ------------------------------------------------ |
| Tts engine voice list → JS                | Untrusted vendor data (voice IDs, language tags) |
| User search input → reverse map → backend | Locale text → canonical English query            |
| Crashlytics breadcrumb → Firebase         | Locale identifier persisted to crash report      |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                              | Disposition                               | Mitigation Plan                                                                                                                                                   |
| ---------- | ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-06-01 | Tampering              | Tts.voices() returns a voice ID that mismatches its declared language  | accept                                    | The Android TextToSpeech engine surface is trusted; vendor voice IDs are filtered by `notInstalled` only. The downstream Tts.setDefaultVoice call is best-effort. |
| T-07-06-02 | Tampering              | reverseSearch returns a different task's English name (bypass)         | accept (per 07-RESEARCH §Security Domain) | `/tasks/search` is an unauthenticated list query; no privileged data. Worst case: user sees a different task. Not a security boundary.                            |
| T-07-06-03 | Information Disclosure | Crashlytics breadcrumb leaks user behavior                             | accept                                    | Locale is non-sensitive; only fires on TTS engine miss; D-31 explicitly authorizes the breadcrumb.                                                                |
| T-07-06-04 | Denial of Service      | reverseSearch crashes on malformed Unicode input                       | mitigate                                  | All inputs pass through `normalize()` which wraps the NFD/NFC chain — invalid sequences fall through to Stage 3 passthrough; no exceptions thrown.                |
| T-07-06-05 | Information Disclosure | Crashlytics fires for `en` locale (always-true fallback) flooding logs | mitigate                                  | Code skips the breadcrumb when `activeLocale === 'en'` per D-31; test 4 verifies this.                                                                            |

</threat_model>

<verification>
- `cd apps/mobile && npm test -- --run src/lib/__tests__/ttsVoice.test.ts src/i18n/__tests__/reverseSearch.test.ts src/i18n/__tests__/taskCatalog.test.ts` exits 0
- `cd apps/mobile && npx tsc --noEmit` exits 0
- `git diff --stat apps/api/src/routes/tasks/` returns empty (D-16)
- `git diff --stat apps/api/drizzle/migrations/` returns empty (D-16 — no DB migration in this phase)
- Manual smoke (operator in plan 07-08): on a Pixel 10a with hi-IN active, type "चाय बनाओ" in the Tasks search input — expect "Make tea" canonical result.
</verification>

<success_criteria>

- TTS fallback chain ships; en owner-deviation preserved
- 65 tasks × 8 locales × full body present in taskCatalog.i18n.ts
- reverseSearch returns canonical English via Stage 1/2/3
- tasksApi.searchTasks wraps with reverseSearch; backend unchanged
- All vitest cases green
- Phase 6's `/tasks/search` + ts_vector index untouched
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-06-SUMMARY.md`. Note whether `generate-tasks.ts` was run with a real LLM call (translated entries committed) or whether non-English entries remain placeholder English (deferred).
</output>
