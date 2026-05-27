---
phase: 07-multi-linguality-live-cam-feed
plan: 05
type: execute
wave: 2
depends_on: [01, 02, 03, 04]
files_modified:
  - apps/mobile/src/i18n/locales/en.json
  - apps/mobile/src/i18n/locales/pt-BR.json
  - apps/mobile/src/i18n/locales/es.json
  - apps/mobile/src/i18n/locales/hi-IN.json
  - apps/mobile/src/i18n/locales/bn-IN.json
  - apps/mobile/src/i18n/locales/ta-IN.json
  - apps/mobile/src/i18n/locales/te-IN.json
  - apps/mobile/src/i18n/locales/mr-IN.json
  - apps/mobile/src/screens/splash/SplashScreen.tsx
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/screens/signup/TermsOfUseModal.tsx
  - apps/mobile/src/screens/permissions/PermissionsScreen.tsx
  - apps/mobile/src/screens/compat/CompatRunningScreen.tsx
  - apps/mobile/src/screens/compat/CompatPassScreen.tsx
  - apps/mobile/src/screens/compat/CompatFailScreen.tsx
  - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
  - apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
  - apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/home/HomeScreen.tsx
  - apps/mobile/src/screens/tasks/TasksScreen.tsx
  - apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx
  - apps/mobile/src/screens/tasks/SendRequestSheet.tsx
  - apps/mobile/src/screens/history/HistoryScreen.tsx
  - apps/mobile/src/screens/history/PlayerScreen.tsx
  - apps/mobile/src/screens/help/HelpCenterScreen.tsx
  - apps/mobile/src/components/ReportProblemSheet.tsx
  - apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx
  - apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx
  - apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx
  - apps/mobile/src/screens/signup/__tests__/TermsOfUseModal.test.tsx
autonomous: true
requirements: [I18N-07, I18N-08, I18N-09, I18N-11, I18N-12]
tags: [i18n, ui, mobile, screens]
must_haves:
  truths:
    - "All 22 existing screens use `t('...')` for user-visible copy where copy is not literally locked by design files"
    - '`en.json` is the source of truth for every translated string (D-12); the 7 non-English JSONs are regenerated via the LLM tool from plan 07-02 after the sweep'
    - 'TermsOfUseModal + Signup consent paragraph render bilingual when active locale ≠ en (translated on top, English ~70% opacity below) (D-32)'
    - 'The canonical English `TERMS_OF_USE_TEXT` constant is unchanged; `consent_text_version` POST payload still references the canonical English (D-33)'
    - 'API error → translated toast wiring is live across the mobile API client (D-34, D-35)'
    - 'Phase 6 cosmetic-gaps doc unchanged (I18N-11 — no re-opening)'
    - 'After the sweep, `pnpm i18n:generate` produces 7 non-English catalogs that pass the shape-parity gate'
  artifacts:
    - path: apps/mobile/src/i18n/locales/en.json
      provides: 'Fully populated English catalog covering every translated UI string'
      contains: 'terms.consent.body'
    - path: apps/mobile/src/screens/signup/TermsOfUseModal.tsx
      provides: 'Bilingual modal — translated on top, English underlay below at ~70% opacity'
      contains: "i18n.getFixedT('en')"
  key_links:
    - from: apps/mobile/src/screens/signup/TermsOfUseModal.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: i18n.getFixedT('en')('terms.consent.body')
      pattern: 'terms.consent.body'
    - from: apps/mobile/src/services/api.ts
      to: apps/mobile/src/i18n/errorMap.ts
      via: toastKeyForCode + t() at the error-toast surface
      pattern: 'toastKeyForCode'
---

<objective>
Sweep every hardcoded user-visible string across the 22 existing mobile screens into `apps/mobile/src/i18n/locales/en.json` (the canonical source of truth per D-12), replace each call site with a `useTranslation()` + `t('screen.section.element')` call, ship the bilingual consent renderer per D-32 / D-33, wire the API-error → translated toast pipeline per D-34 / D-35, and finalize the locale catalogs by running `pnpm i18n:generate` (plan 07-02's tool) to regenerate the 7 non-English JSONs from the now-stable `en.json`.

Scope reminders that ARE NOT loosenings:

- **I18N-11** — Phase 6 cosmetic gaps are NOT re-opened; this plan modifies copy only via `t()` substitution, not via re-styling. If a screen has a Phase 6 owner-deferred cosmetic gap (Finding 4 / 9 in `06-COSMETIC-GAPS.md`), leave it.
- **I18N-21** — Android only. No file under `apps/mobile/ios/` is modified.
- **Design locked files unchanged** — `prototype.html`, `design-spec.md`, `engineering-handoff.md` stay untouched. The English source-of-truth IS the existing on-screen copy at the time of the sweep.

Output: every screen reads its strings from the catalog; ChooseLanguage + the LanguageSheet (plan 07-04) commits cause every mounted screen to re-render in the new locale via the `<I18nextProvider>` re-render path. The 7 non-English JSONs are regenerated with LLM-translated values that pass `tools/i18n/validate.ts`'s shape-parity gate.
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
@idea-brief.md
@apps/mobile/src/screens/signup/TermsOfUseModal.tsx
@apps/mobile/src/services/api.ts
@apps/mobile/src/i18n/errorMap.ts
@apps/mobile/src/i18n/locales/en.json
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Screen-by-screen string sweep into en.json + t() substitution across 22 screens</name>
  <files>apps/mobile/src/i18n/locales/en.json, apps/mobile/src/screens/splash/SplashScreen.tsx, apps/mobile/src/screens/signup/SignupScreen.tsx, apps/mobile/src/screens/permissions/PermissionsScreen.tsx, apps/mobile/src/screens/compat/CompatRunningScreen.tsx, apps/mobile/src/screens/compat/CompatPassScreen.tsx, apps/mobile/src/screens/compat/CompatFailScreen.tsx, apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx, apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx, apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx, apps/mobile/src/screens/recording/RecordingScreen.tsx, apps/mobile/src/screens/home/HomeScreen.tsx, apps/mobile/src/screens/tasks/TasksScreen.tsx, apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx, apps/mobile/src/screens/tasks/SendRequestSheet.tsx, apps/mobile/src/screens/history/HistoryScreen.tsx, apps/mobile/src/screens/history/PlayerScreen.tsx, apps/mobile/src/screens/help/HelpCenterScreen.tsx, apps/mobile/src/components/ReportProblemSheet.tsx, apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx, apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx, apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx</files>
  <read_first>
    - apps/mobile/src/i18n/locales/en.json (plan 07-01's skeleton — extend with sweep keys)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-07, D-08, D-12 (key naming convention)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md I18N-09 (date format migration — use formatDate)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md — the per-screen sections (the "Modified File" rows) document the existing call sites
    - apps/mobile/src/lib/dates.ts (plan 07-03 — use formatDate for any date render)
    - help-center-content.md (Phase 2's verbatim Help Center copy — Help Center body translates per D-03)
    - Each target screen file before editing it
  </read_first>
  <behavior>
    - For every user-visible literal string in the 22 screens, a key is added to `en.json` and the source replaced with `t('key')`.
    - Key naming follows D-08: `screen.section.element` (three-level dotted, lowercase). Example: `recording.timer.label`, `tasks.search.placeholder`, `home.tile.recordingDuration.title`.
    - Pluralizable strings use i18next's `_one` / `_other` suffix convention (D-08): e.g. `home.tile.recordingsCount_one` ("1 recording") / `home.tile.recordingsCount_other` ("{{count}} recordings").
    - Date renders (`toLocaleDateString`, `Date(...).toLocale...`) are migrated to `formatDate(date, i18n.language)` from plan 07-03.
    - Interpolated strings use i18next's `{{var}}` syntax — e.g. `"{{count}} tasks recorded"`.
    - Accessibility labels (`accessibilityLabel`) that are user-facing are translated; debug-only labels (e.g. `language-row-en`) are left as English identifiers.
    - Files NOT in the 22-screen list (e.g. `ChooseLanguageScreen.tsx` from plan 07-04; `TermsOfUseModal.tsx` covered in Task 3) are NOT touched in this task.
    - The Profile screen (`ProfileScreen.tsx`) was already updated in plan 07-04 — it is NOT re-touched here.
  </behavior>
  <action>
**Scope discovery first.** Run:
```bash
ls apps/mobile/src/screens/*/*.tsx | grep -v __tests__ | grep -v profile
```
to confirm the list of files matches `files_modified`. If a file in `files_modified` does not exist (e.g. a screen was renamed since 07-PATTERNS.md was written), skip it and note in the summary. If a screen exists but is NOT in `files_modified`, evaluate it: if it has user-visible copy, add it to the sweep; if it is pure layout/no copy, skip.

**Per-screen sweep procedure** — for each of the 22 target screens, in series:

1. **Read the file** to identify every literal string passed to `<Text>`, `accessibilityLabel`, `placeholder`, `title`, `toast.show`, etc.

2. **Categorize each literal**:

   - **Owner-locked-design copy** (RigTutorialScreen header verbatim §X copy, Permissions verbatim copy, etc.) — DOES translate. The design files stay untouched but the runtime copy goes through `t()`. The English `en.json` value MUST byte-match the existing constant.
   - **Owner-deviation banners** (e.g. RigTutorialScreen's one-line camera-framing tip per `feedback_ultrawide_full_capture_path.md`) — stay as-is in English (the deviation is owner-directed; do not retranslate).
   - **Debug-only / accessibility identifiers** (e.g. `accessibilityLabel="task-tile-row"`) — stay as English identifiers (not user-visible).
   - **User-visible labels / placeholders / toast messages / button text / empty-state copy** — translate.

3. **Add the key to `en.json`** under the appropriate `screen.section.element` path. Example for `RecordingScreen.tsx`:

   ```json
   {
     "recording": {
       "overlay": { "dontExitWhileRecording": "Don't exit while recording." },
       "stopButton": { "label": "Stop" },
       "toast": {
         "tooShort": "Recording was less than 1 minute and discarded.",
         "stopped": "Recording stopped — {{duration}}"
       }
     }
   }
   ```

4. **Replace each literal in the source** with the `t('key')` call. Example diff:

   ```diff
   - <Text>{`Recording stopped — ${duration}`}</Text>
   + <Text>{t('recording.toast.stopped', { duration })}</Text>
   ```

5. **Migrate any date renders** to `formatDate(date, i18n.language)`:

   ```diff
   - {new Date(row.recordedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
   + {formatDate(new Date(row.recordedAt), i18n.language)}
   ```

   Add `import { formatDate } from '../../lib/dates';` + add `i18n` to the destructure: `const { t, i18n } = useTranslation();`.

6. **Ensure i18n.changeLanguage triggers re-renders**: every screen that ships `t()` MUST have `const { t } = useTranslation();` at the top of its component body. This is what subscribes the screen to the i18next change-language event.

**Recommended order** (matches Wave 2's natural dependency flow):

- Onboarding/auth: Splash, Signup, Permissions, Compat (Running/Pass/Fail), RigTutorial, PracticeIntro, PracticeComplete
- Main: Home, Tasks, TaskDetailsSheet, SendRequestSheet, History, Player
- Profile-adjacent: HelpCenter, ReportProblemSheet, ForceUpgrade, PendingUploads, BatteryOptimization
- Recording: RecordingScreen (largest — covers REC-LIVE-related copy plus all rec UI)

**The largest file in the sweep is `RecordingScreen.tsx`**. Be careful: do NOT translate strings that are stamped INTO metadata.json (those are machine-readable codes like `'fps_dropped'`, NOT user copy). Translate only what is rendered in `<Text>` or shown in a Toast/Alert.

**en.json shape requirement**: After this task, `en.json` is the canonical surface. Run `node -e "console.log(JSON.stringify(require('./apps/mobile/src/i18n/locales/en.json'), null, 2).split('\n').length)"` to confirm the file grew substantially from the starter skeleton (expect 300+ lines).

**Help Center body translates fully** per D-03 — pull the verbatim content from `help-center-content.md` (Phase 2's source) into `en.json` under `help.instructions.*`, `help.faqs.*`, `help.troubleshooting.*` paths. Each accordion section becomes a multi-line string (or an array of strings if the existing code uses arrays).

**Type-check after the sweep** to catch missing-key references:

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | tail -30
```

  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -5; cd apps/mobile && npm test -- --run 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l apps/mobile/src/i18n/locales/en.json` returns at least 200 lines (substantial growth from the ~40-line skeleton).
    - `node -e "JSON.parse(require('fs').readFileSync('apps/mobile/src/i18n/locales/en.json','utf8'))"` exits 0 (still valid JSON).
    - `grep -rln "useTranslation" apps/mobile/src/screens/ | wc -l` returns at least 20 (most screens hooked to i18n).
    - `grep -rcE "toLocaleDateString" apps/mobile/src/screens/ 2>&1 | grep -v ':0$' | wc -l` returns 0 OR the remaining hits are inside accessibility-only contexts that are documented in the SUMMARY.
    - `cd apps/mobile && npx tsc --noEmit` exits 0 (no TS errors introduced).
    - Full mobile test suite passes: `cd apps/mobile && npm test -- --run` exits 0.
  </acceptance_criteria>
  <done>22 screens sweep complete; en.json grew to >=200 lines covering every user-visible string; TypeScript clean; no test regressions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: API-error → translated toast wiring + Crashlytics breadcrumb (I18N-08)</name>
  <files>apps/mobile/src/services/api.ts, apps/mobile/src/services/__tests__/api.errorToast.test.ts</files>
  <read_first>
    - apps/mobile/src/services/api.ts (existing API client + where errors surface — find the error handler that shows toasts)
    - apps/mobile/src/i18n/errorMap.ts (plan 07-03 exports `ERROR_TOAST_KEYS`, `GENERIC_ERROR_KEY`, `toastKeyForCode`)
    - apps/mobile/src/components/Toast.tsx (the existing module-level `showToast` from Phase 4)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-34, D-35
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Per-locale TTS Fallback Chain" pattern for Crashlytics breadcrumb shape (similar pattern reused here)
  </read_first>
  <behavior>
    - Whenever an API call fails with an error that has a `code` field, the client surfaces a translated toast via `t(toastKeyForCode(code))`.
    - The raw English `detail` is logged to Crashlytics as a breadcrumb `{ event: 'api_error', code, raw_detail }` (D-35).
    - Unknown codes (or no code) surface `t('errors.generic')`.
    - The Crashlytics call is best-effort (try/catch — never throws).
    - The error handler does NOT alter the existing retry behavior, status codes, or HTTP semantics — it only adds toast + breadcrumb side effects.
  </behavior>
  <action>
1. **Read `apps/mobile/src/services/api.ts`** to find:
   - Where API errors are caught (likely a central `apiClient` fetch wrapper).
   - Where the existing toast (`showToast` from Phase 4) is currently called for errors — there may already be calls passing raw English `detail` to the toast.

2. **Add imports**:

   ```typescript
   import { toastKeyForCode } from '../i18n/errorMap';
   import i18n from '../i18n';
   import crashlytics from '@react-native-firebase/crashlytics';
   import { showToast } from '../components/Toast';
   ```

3. **Wrap the error-surface call**: at the point where the client currently shows a user-facing toast for an API error (typically a central catch block or `_events` envelope error consumer), replace the call shape:

   ```typescript
   // BEFORE — surfaces server English
   // showToast(error.detail ?? 'Something went wrong');

   // AFTER (D-34 + D-35)
   const code = typeof error.code === 'string' ? error.code : null;
   const key = toastKeyForCode(code);
   showToast(i18n.t(key as never));
   try {
     crashlytics().log(
       JSON.stringify({
         event: 'api_error',
         code: code ?? 'UNKNOWN',
         raw_detail: typeof error.detail === 'string' ? error.detail : null,
       }),
     );
   } catch {
     /* best-effort */
   }
   ```

   The exact insertion point depends on the existing error-handling shape. If there are MULTIPLE error-toast sites (e.g. one per service module), prefer to centralize the logic into a helper in `apps/mobile/src/services/api.ts` and call it from each site:

   ```typescript
   export function surfaceApiError(error: { code?: string; detail?: string }): void {
     const code = typeof error.code === 'string' ? error.code : null;
     const key = toastKeyForCode(code);
     showToast(i18n.t(key as never));
     try {
       crashlytics().log(
         JSON.stringify({
           event: 'api_error',
           code: code ?? 'UNKNOWN',
           raw_detail: typeof error.detail === 'string' ? error.detail : null,
         }),
       );
     } catch {
       /* best-effort */
     }
   }
   ```

   Then `import { surfaceApiError } from '../services/api';` at each consumer.

4. **Create `apps/mobile/src/services/__tests__/api.errorToast.test.ts`**:

   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';

   const showToast = vi.fn();
   const crashLog = vi.fn();

   vi.mock('../../components/Toast', () => ({ showToast }));
   vi.mock('@react-native-firebase/crashlytics', () => ({
     default: () => ({ log: crashLog }),
   }));

   import i18n from '../../i18n';
   import { surfaceApiError } from '../api';

   describe('surfaceApiError (I18N-08 / D-34 / D-35)', () => {
     beforeEach(async () => {
       showToast.mockClear();
       crashLog.mockClear();
       await i18n.changeLanguage('en');
     });

     it('maps a known code to the translated toast key', () => {
       surfaceApiError({ code: 'AUTH_INVALID_TOKEN', detail: 'jwt expired' });
       expect(showToast).toHaveBeenCalledTimes(1);
       // en.json says "Please sign in again" for errors.auth.invalidToken
       expect(showToast.mock.calls[0][0]).toBe('Please sign in again');
     });

     it('falls through to the generic toast for unknown code', () => {
       surfaceApiError({ code: 'NEVER_HEARD', detail: 'mystery' });
       expect(showToast).toHaveBeenCalledWith('Something went wrong');
     });

     it('handles missing code field gracefully', () => {
       surfaceApiError({ detail: 'no code at all' } as never);
       expect(showToast).toHaveBeenCalledWith('Something went wrong');
     });

     it('writes a Crashlytics breadcrumb with code + raw_detail (D-35)', () => {
       surfaceApiError({ code: 'UPLOAD_NETWORK_LOST', detail: 'tcp reset' });
       expect(crashLog).toHaveBeenCalledTimes(1);
       const arg = JSON.parse(crashLog.mock.calls[0][0] as string);
       expect(arg.event).toBe('api_error');
       expect(arg.code).toBe('UPLOAD_NETWORK_LOST');
       expect(arg.raw_detail).toBe('tcp reset');
     });

     it('Crashlytics failures do not propagate', () => {
       crashLog.mockImplementationOnce(() => {
         throw new Error('flaky');
       });
       expect(() => surfaceApiError({ code: 'COMPAT_FAILED', detail: 'oops' })).not.toThrow();
     });
   });
   ```

   If the existing test infrastructure already mocks Crashlytics differently, adapt — but the public behavior (translated toast + best-effort breadcrumb) is what the test asserts.
   </action>
   <verify>
   <automated>cd apps/mobile && npm test -- --run src/services/**tests**/api.errorToast.test.ts 2>&1 | tail -25</automated>
   </verify>
   <acceptance_criteria> - File `apps/mobile/src/services/api.ts` contains `surfaceApiError` or equivalent centralized handler; `grep -c "toastKeyForCode" apps/mobile/src/services/api.ts` returns at least 1. - `grep -c "crashlytics" apps/mobile/src/services/api.ts` returns at least 1. - Test command exits 0; all 5 surfaceApiError cases green.
   </acceptance_criteria>
   <done>API errors surface translated toasts; raw English detail goes only to Crashlytics; unknown codes fall through to the generic translated key.</done>
   </task>

<task type="auto" tdd="true">
  <name>Task 3: Bilingual TermsOfUseModal + Signup consent paragraph + regenerate non-English catalogs</name>
  <files>apps/mobile/src/screens/signup/TermsOfUseModal.tsx, apps/mobile/src/screens/signup/SignupScreen.tsx, apps/mobile/src/screens/signup/__tests__/TermsOfUseModal.test.tsx, apps/mobile/src/i18n/locales/pt-BR.json, apps/mobile/src/i18n/locales/es.json, apps/mobile/src/i18n/locales/hi-IN.json, apps/mobile/src/i18n/locales/bn-IN.json, apps/mobile/src/i18n/locales/ta-IN.json, apps/mobile/src/i18n/locales/te-IN.json, apps/mobile/src/i18n/locales/mr-IN.json</files>
  <read_first>
    - apps/mobile/src/screens/signup/TermsOfUseModal.tsx (existing modal — note the IMMUTABLE header warning at lines 1-13 and the `TERMS_OF_USE_TEXT` constant at lines 28-34)
    - apps/mobile/src/screens/signup/SignupScreen.tsx (consent paragraph placement — locate via grep "consent" or "Terms of Use")
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-09, D-32, D-33
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Bilingual Consent Rendering" (lines 853-899)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "TermsOfUseModal.tsx (MODIFY — bilingual render per D-32)"
    - idea-brief.md §5.2 (canonical English consent — DO NOT edit)
    - tools/i18n/generate.ts (plan 07-02 — for the regen at the end)
  </read_first>
  <behavior>
    - `TERMS_OF_USE_TEXT` constant in `TermsOfUseModal.tsx` is UNCHANGED (it is the legal canonical English; D-33).
    - The `en.json` value at `terms.consent.body` is byte-equal to `TERMS_OF_USE_TEXT` (cross-validated).
    - When `i18n.language === 'en'`: the modal renders ONLY the English body (no duplicate render).
    - When `i18n.language !== 'en'`: the modal renders TWO blocks — the translated text on top (`t('terms.consent.body')`) and the English underlay below (`i18n.getFixedT('en')('terms.consent.body')`) at ~70% opacity + smaller font.
    - The Signup screen's consent paragraph follows the same bilingual rule (Pattern 32).
    - The Sign-up POST payload's `consent_text_version` field continues to reference the canonical English version constant (D-33 — unchanged).
    - After the modal change, run `cd tools && pnpm i18n:generate` (or `npm run i18n:generate` if the workspace uses npm) to regenerate the 7 non-English JSONs from the now-final `en.json`. The shape-parity gate inside `generate.ts` runs automatically; the resulting catalogs are committed.
  </behavior>
  <action>
1. **Modify `apps/mobile/src/screens/signup/TermsOfUseModal.tsx`** per 07-PATTERNS.md:
   - KEEP the file's IMMUTABLE warning comment block (lines 1-13) verbatim.
   - KEEP the `TERMS_OF_USE_TEXT` constant verbatim (D-33).
   - Add `import { useTranslation } from 'react-i18next';` + `import i18n from '../../i18n';`.
   - In the component body, add:
     ```typescript
     const { t } = useTranslation();
     const isEnglish = i18n.language === 'en';
     const translatedBody = t('terms.consent.body');
     const englishUnderlay = i18n.getFixedT('en')('terms.consent.body');
     ```
   - Replace the existing single `<Text>{TERMS_OF_USE_TEXT}</Text>` render with:
     ```tsx
     <Text variant="body" tone="primary" accessibilityLabel="Terms of Use body">
       {translatedBody}
     </Text>
     {!isEnglish && (
       <Text
         variant="caption"
         tone="secondary"
         style={{ opacity: 0.7, marginTop: spacing.s }}
         accessibilityLabel="Terms of Use English underlay"
       >
         {englishUnderlay}
       </Text>
     )}
     ```
   - **Verify `en.json` has `terms.consent.body` == `TERMS_OF_USE_TEXT`** byte-for-byte. If not, update `en.json` (NOT the constant) to match. This is the only acceptable direction — the constant is the legal canon.

2. **Modify `apps/mobile/src/screens/signup/SignupScreen.tsx`** for the in-page consent paragraph (NOT the modal trigger button):

   - Find the consent paragraph rendered on the screen (typically just before the "Continue with Google" CTA).
   - Apply the same bilingual rule: `t('signup.consent.paragraph')` on top, `i18n.getFixedT('en')('signup.consent.paragraph')` below when locale ≠ en.
   - Add the corresponding key to `en.json` if not present.

3. **Update `apps/mobile/src/screens/signup/__tests__/TermsOfUseModal.test.tsx`** (or create if not present):

   ```tsx
   import React from 'react';
   import { describe, it, expect, beforeEach } from 'vitest';
   import { render } from '@testing-library/react-native';
   import { TermsOfUseModal } from '../TermsOfUseModal';
   import i18n from '../../../i18n';

   describe('TermsOfUseModal (I18N-07 / D-32 / D-33)', () => {
     beforeEach(async () => {
       await i18n.changeLanguage('en');
     });

     it('renders only the English body when active locale is en', () => {
       const { queryByLabelText } = render(<TermsOfUseModal visible onClose={() => {}} />);
       expect(queryByLabelText('Terms of Use body')).toBeTruthy();
       expect(queryByLabelText('Terms of Use English underlay')).toBeFalsy();
     });

     it('renders translated body on top + English underlay below when locale ≠ en', async () => {
       await i18n.changeLanguage('hi-IN');
       const { queryByLabelText } = render(<TermsOfUseModal visible onClose={() => {}} />);
       expect(queryByLabelText('Terms of Use body')).toBeTruthy();
       expect(queryByLabelText('Terms of Use English underlay')).toBeTruthy();
     });
   });
   ```

4. **Verify byte parity between `TERMS_OF_USE_TEXT` and `en.json`'s `terms.consent.body`**:

   ```bash
   node -e "
   const fs = require('fs');
   const en = JSON.parse(fs.readFileSync('apps/mobile/src/i18n/locales/en.json','utf8'));
   const src = fs.readFileSync('apps/mobile/src/screens/signup/TermsOfUseModal.tsx','utf8');
   const match = src.match(/TERMS_OF_USE_TEXT\s*=\s*([\`\']\)([\s\S]*?)\1/);
   if (!match) { console.error('FAIL: cannot find TERMS_OF_USE_TEXT constant'); process.exit(2); }
   if (en.terms?.consent?.body !== match[2]) {
     console.error('FAIL: en.json terms.consent.body !== TERMS_OF_USE_TEXT constant');
     process.exit(3);
   }
   console.log('OK: parity verified');
   "
   ```

   If this fails, update `en.json` to match the constant (NOT the other way around — the constant is the legal canon).

5. **Run the LLM regeneration**. Pre-flight: operator has provisioned `tools/.env` with a valid `ANTHROPIC_API_KEY` (per plan 07-02 user_setup):

   ```bash
   cd tools && npm install
   npm run i18n:generate 2>&1 | tail -30
   ```

   This produces 7 translated JSONs that overwrite the placeholder files shipped in plan 07-01. The script's built-in shape-parity gate runs against each locale; failures are logged + skipped (the placeholder stays in place).

   If `ANTHROPIC_API_KEY` is not provisioned, **stop and flag** in the SUMMARY — do not attempt to commit placeholder data as translated. The plan's verifier will catch this in `07-08`'s smoke runbook.

6. **Run the standalone validator** to confirm shape parity post-regen:

   ```bash
   cd tools && npm run i18n:validate
   ```

   Expected: `[validate] {loc}: OK` for all 7 locales. If any locale reports `missing` or `extra` paths, re-run the regen for that locale or hand-fix.

7. **Confirm each locale JSON is committed**:
   ```bash
   git status apps/mobile/src/i18n/locales/ tools/
   ```
   8 JSONs + 7 audit sidecars (the `{loc}.audit.json` files written by `buildAuditSidecar`) should show as modified or new.
   </action>
   <verify>
   <automated>cd apps/mobile && npm test -- --run src/screens/signup/**tests**/TermsOfUseModal.test.tsx 2>&1 | tail -15 && cd tools && npm run i18n:validate 2>&1 | tail -10</automated>
   </verify>
   <acceptance_criteria> - `grep -c "TERMS_OF_USE_TEXT" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` returns at least 1 (constant still present). - `grep -c "getFixedT('en')" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` returns at least 1. - `grep -c "English underlay" apps/mobile/src/screens/signup/TermsOfUseModal.tsx` returns 1. - `grep -c "consent_text_version" apps/mobile/src/` (across all files): if changed, the change is value-preserving (constant unchanged per D-33). - All 8 locale JSONs are parseable JSON: `for f in apps/mobile/src/i18n/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || exit 1; done` exits 0. - `cd tools && npm run i18n:validate` exits 0 with `OK` per locale (assuming operator provisioned `ANTHROPIC_API_KEY`; if not, document the deferral in the SUMMARY). - Test command above exits 0.
   </acceptance_criteria>
   <done>Bilingual rendering live; canonical English constant unchanged; en.json byte-equal to the constant; 7 non-English JSONs regenerated via LLM with shape parity; audit sidecars committed.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                             | Description                                |
| ------------------------------------ | ------------------------------------------ |
| LLM API response → mobile bundle     | Translated catalog values rendered as Text |
| Catalog JSON → React Text rendering  | Plural rules / interpolation surface       |
| Server error code → translated toast | `code` from RFC 7807 used as map key       |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                                     | Disposition | Mitigation Plan                                                                                                                                                                                                                |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-07-05-01 | Tampering              | LLM produces a string that uses {{var}}-like syntax interpolating an internal value           | mitigate    | i18next escapes `{{var}}` by default (`escapeValue: false` only disables HTML escape since React handles that — interpolation MUST use the matching `t('key', { var })` signature; any unmatched `{{...}}` renders literally). |
| T-07-05-02 | Information Disclosure | English `detail` leaks into Crashlytics with PII                                              | accept      | Crashlytics is access-controlled; the server-side `detail` field is the production error message designed for engineering — PII is excluded by API design.                                                                     |
| T-07-05-03 | Tampering              | Catalog injection adds keys not present in en.json (LLM hallucinated paths)                   | mitigate    | `tools/i18n/validate.ts` shape-parity gate runs as part of `generate.ts`; mismatches log + skip the locale, leaving the placeholder in place.                                                                                  |
| T-07-05-04 | Repudiation            | Legal record drift if en.json `terms.consent.body` diverges from `TERMS_OF_USE_TEXT` constant | mitigate    | Task 3 step 4 enforces byte-parity via a node script before the LLM regen; the constant remains the legal canon per D-33.                                                                                                      |
| T-07-05-05 | DoS                    | LLM regen makes 7 sequential API calls — single-locale failure does not abort others          | mitigate    | Per D-11 + the script's try/catch around each `generateLocale` call.                                                                                                                                                           |

</threat_model>

<verification>
- `cd apps/mobile && npm test -- --run` exits 0
- `cd apps/mobile && npx tsc --noEmit` exits 0
- `cd tools && npm run i18n:validate` exits 0 (shape parity across all 7 non-English locales)
- `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` returns empty (I18N-11 — Phase 6 cosmetic-gaps doc untouched)
- `git diff --stat idea-brief.md` returns empty (consent text canon unchanged)
- `git diff --stat apps/mobile/ios/` returns empty (I18N-21 — Android only)
</verification>

<success_criteria>

- All 22 screens read user-visible copy through `t()` calls
- Bilingual consent renders correctly in both en + non-en locales
- API errors surface translated toasts; raw English in Crashlytics only
- 7 non-English locale JSONs regenerated with shape parity to en.json
- No Phase 6 cosmetic-gaps doc edits (I18N-11)
- No iOS file modifications (I18N-21)
- TypeScript clean; full mobile test suite green
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-05-SUMMARY.md` per the standard template. Surface explicitly:
- The line-count delta of en.json before/after the sweep
- Confirmation that the LLM regen ran (or, if `ANTHROPIC_API_KEY` was not available, flag this as a Wave-2.5 follow-up)
- The audit sidecar SHA values for traceability
</output>
