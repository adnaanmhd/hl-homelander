---
phase: 07-multi-linguality-live-cam-feed
plan: 11
type: execute
wave: 1
depends_on: [01, 02, 03, 05, 09]
files_modified:
  - apps/mobile/src/i18n/locales/en.json
  - apps/mobile/src/i18n/locales/pt-BR.json
  - apps/mobile/src/i18n/locales/es.json
  - apps/mobile/src/i18n/locales/hi-IN.json
  - apps/mobile/src/i18n/locales/bn-IN.json
  - apps/mobile/src/i18n/locales/ta-IN.json
  - apps/mobile/src/i18n/locales/te-IN.json
  - apps/mobile/src/i18n/locales/mr-IN.json
  - apps/mobile/src/screens/compat/checks.ts
  - apps/mobile/src/screens/compat/CompatRunningScreen.tsx
  - apps/mobile/src/screens/recording/components/RotatePrompt.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/components/HomeHero.tsx
  - apps/mobile/src/screens/home/HomeScreen.tsx
  - apps/mobile/src/navigation/MainTabs.tsx
  - apps/mobile/src/screens/history/HistoryScreen.tsx
  - apps/mobile/src/components/UploadStatusChip.tsx
  - apps/mobile/src/components/__tests__/UploadStatusChip.i18n.test.tsx
  - apps/mobile/src/screens/recording/components/__tests__/RotatePrompt.i18n.test.tsx
  - apps/mobile/src/screens/compat/__tests__/checks.i18n.test.ts
  - apps/mobile/src/navigation/__tests__/MainTabs.i18n.test.tsx
  - apps/mobile/src/screens/home/__tests__/HomeHero.i18n.test.tsx
  - apps/mobile/src/screens/history/__tests__/HistoryScreen.i18n.test.tsx
autonomous: true
gap_closure: true
requirements: [I18N-01, I18N-11]
tags: [i18n, ui, mobile, gap-closure, sweep-extension]
must_haves:
  truths:
    - 'G-02 closed: CompatCheckScreen labels (Ultrawide camera / Resolution & frame rate / Motion sensors / Stable sensor stream / Microphone / Time sync source / Device integrity) render in the active locale, not English, when locale = hi-IN / pt-BR / etc.'
    - "G-03 closed: `apps/mobile/src/screens/recording/components/RotatePrompt.tsx:108` no longer contains the literal JSX string `Rotate to landscape and mount on rig`; it reads `{t('recording.rotatePrompt')}`; all 8 catalogs include the key."
    - "G-04 (text half) closed: `apps/mobile/src/screens/recording/RecordingScreen.tsx` no longer calls `speakCue('Recording started')` / `speakCue('Recording stopped')` with English literals; the call sites at lines 414/425/657 read `speakCue(t('recording.cue.started'))` / `speakCue(t('recording.cue.stopped'))`; the keys exist in all 8 catalogs."
    - 'G-04 (voice half) — NOT closed by code-edits in this plan. The voice-engine `pickAndSetLocaleVoice` chain was shipped in plan 07-06 (D-31) and `apps/mobile/src/lib/ttsVoice.ts` is INTENTIONALLY untouched here (POST-CHECKER-REV: the file is therefore NOT in `files_modified`). The voice-half closure is operator-walk-only — re-verified on Pixel-10a hi-IN during plan 07-15 §4. Code-side: ttsVoice.ts unchanged this plan.'
    - "G-05 closed: `apps/mobile/src/components/HomeHero.tsx` no longer contains the literal `Hi {greetingTarget}` / `Hi there`; the greeting and the empty-state hero render with `t('home.hero.*')` keys; the en.json greeting fragment uses i18next interpolation `{{name}}`."
    - 'G-06 closed: `apps/mobile/src/navigation/MainTabs.tsx` provides `tabBarLabel` via `t(''tabs.home'')` / `t(''tabs.tasks'')` / `t(''tabs.history'')` (or equivalent options-prop wrapper); raw `name="Home"|"Tasks"|"History"` survives (those are route names, not display labels) but the visible chip text is locale-driven.'
    - "G-07 closed: `apps/mobile/src/screens/history/HistoryScreen.tsx::filterChipLabel` no longer returns the literals `'Today'` / `'Yesterday'` / `'This week'` / `'This month'`; it returns `t('history.filter.today')` / `.yesterday` / `.thisWeek` / `.thisMonth` (plus the existing custom-range branch); the keys exist in all 8 catalogs."
    - "G-09 closed: `apps/mobile/src/components/UploadStatusChip.tsx::LABELS` no longer hardcodes English (`'Uploading…'` / `'Uploaded — verifying…'` / `'Upload failed'` / `'✓ Uploaded'` / `'Paused — no Wi-Fi'`); the component uses `useTranslation()` + `t('uploadChip.*')` keys; the keys exist in all 8 catalogs."
    - 'Owner deviation preserved: the RigTutorial camera-framing tip (per `feedback_ultrawide_full_capture_path.md`) still renders post-sweep — call sites in `RigTutorialScreen.tsx` are not touched by this plan.'
    - 'All 7 non-English locale catalogs are re-generated via the LLM tool (`tools/i18n/generate.ts`) and pass `pnpm i18n:validate` shape parity against `en.json`.'
    - 'iOS untouched (I18N-21); no DB migration (D-16); Phase-6 cosmetic-gaps untouched (I18N-11); ultrawide lens code untouched; HevcEncoder / FinalizeWorker / MetadataComposer untouched.'
  artifacts:
    - path: apps/mobile/src/i18n/locales/en.json
      provides: 'Master English catalog extended with `compat.checkLabels.*`, `recording.rotatePrompt`, `recording.cue.started`, `recording.cue.stopped`, `home.hero.*` (greeting + empty), `tabs.home/tasks/history`, `history.filter.{today,yesterday,thisWeek,thisMonth}`, `uploadChip.{uploading,verifying,failed,success,pausedOffline}` keys'
      contains: 'compat.checkLabels'
    - path: apps/mobile/src/i18n/locales/hi-IN.json
      provides: 'Hindi catalog re-generated by `tools/i18n/generate.ts` after en.json updates; shape parity with en.json'
      contains: 'compat.checkLabels'
    - path: apps/mobile/src/screens/compat/checks.ts
      provides: 'CHECKS rows now carry a `labelKey: string` field (i18n key) instead of hardcoded `label: string`; CompatRunningScreen reads `t(row.labelKey)` at render'
      contains: 'labelKey'
    - path: apps/mobile/src/components/UploadStatusChip.tsx
      provides: "UploadStatusChip wires `useTranslation` and renders `t('uploadChip.*')` per variant"
      contains: 'useTranslation'
    - path: apps/mobile/src/navigation/MainTabs.tsx
      provides: "Tab labels via `options={{ tabBarLabel: t('tabs.home') }}` (or the dynamic-component equivalent so labels react to `i18n.changeLanguage`)"
      contains: 'tabBarLabel'
  key_links:
    - from: apps/mobile/src/screens/compat/CompatRunningScreen.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: 't(row.labelKey) where row.labelKey ∈ compat.checkLabels.{ultrawide,resolutionFps,motionSensors,imuStable,mic,realtime,integrity}'
      pattern: 'compat.checkLabels'
    - from: apps/mobile/src/screens/recording/components/RotatePrompt.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "t('recording.rotatePrompt')"
      pattern: 'recording.rotatePrompt'
    - from: apps/mobile/src/screens/recording/RecordingScreen.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "speakCue(t('recording.cue.started')) + speakCue(t('recording.cue.stopped'))"
      pattern: 'recording.cue.started'
    - from: apps/mobile/src/navigation/MainTabs.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "Tab.Screen options.tabBarLabel = t('tabs.home') | t('tabs.tasks') | t('tabs.history')"
      pattern: 'tabBarLabel'
    - from: apps/mobile/src/components/UploadStatusChip.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: 't(`uploadChip.${variant}`)'
      pattern: 'uploadChip'
---

<objective>
Extend the i18n sweep from plan 07-05 (which covered onboarding/permissions/compat-pass-fail/tutorial/recording-chrome) and plan 07-09 (which covered Profile + DeleteAccountModal) into the **8 unswept surfaces** the operator surfaced on the Pixel-10a hi-IN walk: G-02 (CompatCheckScreen labels), G-03 (RotatePrompt hardcoded English), G-04 text-half (RecordingScreen TTS-cue literals), G-05 (HomeHero hero copy), G-06 (MainTabs tab labels), G-07 (HistoryScreen time-filter chips), G-09 (UploadStatusChip labels).

**Note on scope:** G-08 (TasksScreen task-data — name/category/description/instructions) is **handled by a separate plan 07-12** because investigation of `apps/mobile/src/i18n/taskCatalog.i18n.ts` confirms ALL 77 task entries are English-skeleton across ALL 7 non-English locales (not just the 7 originally documented). That is a catalog-body translation task that requires the LLM regen tool to be EXTENDED — see 07-12. This plan handles the **call-site wiring** for G-02..G-07 + G-09 (chrome-only translations) and the **en.json key tree additions** that the LLM regen consumes for ALL non-English locales.

**G-04 disambiguation (POST-CHECKER-REV):** G-04 splits into two halves:

- **G-04 text-half** — the speakCue / showVoiceCue call sites in `RecordingScreen.tsx` pass English literals. **CLOSED BY THIS PLAN** via the call-site `t()` wiring (Task 1).
- **G-04 voice-half** — the TTS-engine `pickAndSetLocaleVoice` chain in `apps/mobile/src/lib/ttsVoice.ts`. The chain was shipped in plan 07-06 (D-31). This plan does NOT touch `ttsVoice.ts` (confirmed by `ttsVoice.ts` being ABSENT from `files_modified`); voice-half closure is operator-walk-only, re-verified on Pixel-10a hi-IN at plan **07-15 §4**.

**Two-wave execution within the plan:**

- **Task 1** — call-site wiring: replace literal strings with `t('...')` calls in the 8 source files; extend `en.json` with the new key tree; write JVM/JS unit tests that assert the call-sites no longer carry the English literals AND that the new en.json keys exist.
- **Task 2** — LLM catalog regeneration: run `pnpm i18n:generate` (the tool from plan 07-02) to translate the new keys into all 7 non-English catalogs; run `pnpm i18n:validate` to confirm shape parity; commit the regenerated JSON files.

**Owner-deviation guard (per `<planning_rules>` rule 8 + memory `feedback_ultrawide_full_capture_path.md`):** the RigTutorial camera-framing tip lives in `RigTutorialScreen.tsx` — a screen plan 07-05 already swept. This plan does NOT touch `RigTutorialScreen.tsx`; the verbatim-tip line stays as the owner-deviation block intact. The audit gate enforces this.

**Non-negotiable invariants (per `<planning_rules>` + CLAUDE.md banners):**

- `git diff --stat apps/mobile/ios/` MUST remain empty (I18N-21).
- `git diff --stat apps/api/drizzle/migrations/` MUST remain empty (D-16).
- `06-COSMETIC-GAPS.md` MUST remain untouched (I18N-11).
- The ultrawide lens code + HevcEncoder + FinalizeWorker + MetadataComposer + RealtimeGate UNCHANGED (CLAUDE.md drift + cancel banners) — this plan is JS/JSON only with the exception of zero Kotlin diffs. Verified with `git diff --stat apps/mobile/android/`.
- The Phase 7 carve-outs from 07-05 SUMMARY (API constants / codec strings / encoder field names — `imu_video_drift_*`, `hevc`, `4k`, etc.) STAY English: do NOT translate them.
- `apps/mobile/src/i18n/taskCatalog.i18n.ts` is NOT touched by this plan — task-data translation is plan 07-12's scope.
- `apps/mobile/src/screens/help/content.json` is NOT touched by this plan — Help Center body is plan 07-13's scope (G-10).
- `apps/mobile/src/lib/ttsVoice.ts` is NOT touched by this plan — see G-04 disambiguation above.
- Telemetry events (`logEvent('...')` first arg) are NOT translated — those are the allowlist in `analytics.ts`, not user-facing copy.

Output: a build in which a hi-IN (or any non-en) user walks Onboarding → MainTabs → Home → Tasks → History → Recording with **chrome rendering fully in the active locale** (task data still pending plan 07-12; Help Center body pending plan 07-13). G-02 / G-03 / G-04 (text) / G-05 / G-06 / G-07 / G-09 all resolved.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-05-screen-string-sweep-and-bilingual-consent-PLAN.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-05-SUMMARY.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-09-profile-i18n-sweep-closure-PLAN.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-09-SUMMARY.md
@apps/mobile/src/i18n/locales/en.json
@apps/mobile/src/screens/compat/checks.ts
@apps/mobile/src/screens/compat/CompatRunningScreen.tsx
@apps/mobile/src/screens/recording/components/RotatePrompt.tsx
@apps/mobile/src/screens/recording/RecordingScreen.tsx
@apps/mobile/src/lib/ttsVoice.ts
@apps/mobile/src/components/HomeHero.tsx
@apps/mobile/src/screens/home/HomeScreen.tsx
@apps/mobile/src/navigation/MainTabs.tsx
@apps/mobile/src/screens/history/HistoryScreen.tsx
@apps/mobile/src/components/UploadStatusChip.tsx
@tools/i18n/generate.ts
@tools/i18n/validate.ts
@tools/i18n/prompts.ts
@CLAUDE.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/references/project-skills-discovery.md

<interfaces>
<!-- Key shapes the executor must respect — no need to re-discover. -->

From apps/mobile/src/screens/compat/checks.ts (current — line 26):

```typescript
const CHECKS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'ultrawide', label: 'Ultrawide camera' },
  { key: 'resolutionFps', label: 'Resolution & frame rate' },
  { key: 'motionSensors', label: 'Motion sensors' },
  { key: 'imu', label: 'Stable sensor stream' },
  { key: 'mic', label: 'Microphone' },
  { key: 'realtime', label: 'Time sync source' },
  { key: 'integrity', label: 'Device integrity' },
];
```

After this plan:

```typescript
const CHECKS: ReadonlyArray<{ key: string; labelKey: string }> = [
  { key: 'ultrawide', labelKey: 'compat.checkLabels.ultrawide' },
  { key: 'resolutionFps', labelKey: 'compat.checkLabels.resolutionFps' },
  // ... etc
];
```

And CompatRunningScreen.tsx:285-287 changes from `row.label` to `t(row.labelKey)`.

From apps/mobile/src/screens/recording/components/RotatePrompt.tsx (current — line 108):

```tsx
<Text variant="body" style={styles.body}>
  Rotate to landscape and mount on rig
</Text>
```

After: `{t('recording.rotatePrompt')}`.

From apps/mobile/src/screens/recording/RecordingScreen.tsx (current — lines 414, 425, 657):

```typescript
speakCue('Recording stopped'); // 414, 425
showVoiceCue('Recording started'); // 657 (which calls speakCue + sets VoiceCue pill)
```

After: `speakCue(t('recording.cue.started'))` / `speakCue(t('recording.cue.stopped'))`; `showVoiceCue(t('recording.cue.started'))`.

From apps/mobile/src/components/HomeHero.tsx (current — line 138):

```typescript
const greeting = greetingTarget.length > 0 ? `Hi ${greetingTarget}` : 'Hi there';
```

After:

```typescript
const greeting =
  greetingTarget.length > 0
    ? t('home.hero.greetingNamed', { name: greetingTarget })
    : t('home.hero.greetingAnonymous');
```

From apps/mobile/src/navigation/MainTabs.tsx (current — lines 34-36):

```tsx
<Tab.Screen name="Home" component={HomeScreen} />
<Tab.Screen name="Tasks" component={TasksScreen} />
<Tab.Screen name="History" component={HistoryScreen} />
```

After (the `name` stays for route stability; visible label moves to options):

```tsx
function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarLabel: t('tabs.tasks') }} />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: t('tabs.history') }}
      />
    </Tab.Navigator>
  );
}
```

From apps/mobile/src/screens/history/HistoryScreen.tsx (current — lines 120-130):

```typescript
function filterChipLabel(named: NamedRange, custom: { start: string; end: string } | null): string {
  if (named === 'today') return 'Today';
  if (named === 'yesterday') return 'Yesterday';
  if (named === 'thisWeek') return 'This week';
  if (named === 'thisMonth') return 'This month';
  // existing custom-range branch ...
}
```

After: pass `t` into the function (or inline the switch) and return `t('history.filter.today')` etc.

From apps/mobile/src/components/UploadStatusChip.tsx (current — lines 44-58):

```typescript
const LABELS: Record<UploadStatusVariant, string> = {
  progress: 'Uploading…',
  verifying: 'Uploaded — verifying…',
  failed: 'Upload failed',
  success: '✓ Uploaded',
  pausedOffline: 'Paused — no Wi-Fi',
};
```

After:

```typescript
const LABEL_KEYS: Record<UploadStatusVariant, string> = {
  progress: 'uploadChip.uploading',
  verifying: 'uploadChip.verifying',
  failed: 'uploadChip.failed',
  success: 'uploadChip.success',
  pausedOffline: 'uploadChip.pausedOffline',
};
// inside the component:
const { t } = useTranslation();
const label =
  progressPercent != null && variant === 'progress'
    ? `${t('uploadChip.uploading')} ${progressPercent}%`
    : t(LABEL_KEYS[variant]);
```

From tools/i18n/generate.ts (existing — plan 07-02):

- Entrypoint `pnpm i18n:generate` invokes `main()` in `tools/i18n/generate.ts`
- Reads `apps/mobile/src/i18n/locales/en.json`, makes 7 sequential calls to Claude Opus 4.7, writes each locale JSON + audit sidecar.
- Shape parity enforced by `validate.ts::validateShapeParity`.
- Run with `tsx tools/i18n/generate.ts` or `pnpm i18n:generate` (see tools/package.json).
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Call-site wiring for G-02 + G-03 + G-04(text) + G-05 + G-06 + G-07 + G-09 + en.json key-tree additions + unit tests</name>
  <files>apps/mobile/src/i18n/locales/en.json, apps/mobile/src/screens/compat/checks.ts, apps/mobile/src/screens/compat/CompatRunningScreen.tsx, apps/mobile/src/screens/recording/components/RotatePrompt.tsx, apps/mobile/src/screens/recording/RecordingScreen.tsx, apps/mobile/src/components/HomeHero.tsx, apps/mobile/src/screens/home/HomeScreen.tsx, apps/mobile/src/navigation/MainTabs.tsx, apps/mobile/src/screens/history/HistoryScreen.tsx, apps/mobile/src/components/UploadStatusChip.tsx, apps/mobile/src/components/__tests__/UploadStatusChip.i18n.test.tsx, apps/mobile/src/screens/recording/components/__tests__/RotatePrompt.i18n.test.tsx, apps/mobile/src/screens/compat/__tests__/checks.i18n.test.ts, apps/mobile/src/navigation/__tests__/MainTabs.i18n.test.tsx, apps/mobile/src/screens/home/__tests__/HomeHero.i18n.test.tsx, apps/mobile/src/screens/history/__tests__/HistoryScreen.i18n.test.tsx</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md ## Gaps G-02 through G-07 + G-09 (line-anchored evidence)
    - apps/mobile/src/i18n/locales/en.json (existing structure — confirm the `compat`, `recording`, `home`, `history`, `tabs`, `uploadChip` namespaces; create the namespaces that don't exist yet)
    - apps/mobile/src/screens/compat/checks.ts (the 7-row CHECKS constant)
    - apps/mobile/src/screens/compat/CompatRunningScreen.tsx lines 271-310 (the render block that consumes `row.label`)
    - apps/mobile/src/screens/recording/components/RotatePrompt.tsx full file (file comment at line 11 labels the literal "verbatim label" — the comment STAYS but the literal moves to the catalog)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 200-260 (the `showVoiceCue` + `useTranslation` import already at line 44 + 182)
    - apps/mobile/src/components/HomeHero.tsx full file (138-LOC component; greeting at line 138, "Hi there" fallback)
    - apps/mobile/src/screens/home/HomeScreen.tsx lines 400-470 (the hero section call site — confirm what props it passes to HomeHero)
    - apps/mobile/src/navigation/MainTabs.tsx full file (35 LOC; the Tab.Screen rows)
    - apps/mobile/src/screens/history/HistoryScreen.tsx lines 118-135 (the `filterChipLabel` function)
    - apps/mobile/src/components/UploadStatusChip.tsx full file (LABELS constant + label-resolution logic)
    - apps/mobile/src/screens/recording/RecordingScreen.tsx lines 414, 425, 657 (speakCue / showVoiceCue call sites — the existing `useTranslation` hook is already wired)
    - tools/i18n/validate.ts (shape-parity rules — ensure your new en.json keys are nested under existing namespaces or add new top-level namespaces consistently)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md (verify the pattern for adding new keys to en.json + the call-site wiring style)
  </read_first>
  <behavior>
    - **`apps/mobile/src/i18n/locales/en.json`** gains the following keys (exact dotted paths the executor MUST use — these are the contract for the LLM regen step in Task 2 and the JVM/JS tests):
      - `compat.checkLabels.ultrawide = "Ultrawide camera"`
      - `compat.checkLabels.resolutionFps = "Resolution & frame rate"`
      - `compat.checkLabels.motionSensors = "Motion sensors"`
      - `compat.checkLabels.imuStable = "Stable sensor stream"`
      - `compat.checkLabels.mic = "Microphone"`
      - `compat.checkLabels.realtime = "Time sync source"`
      - `compat.checkLabels.integrity = "Device integrity"`
      - `recording.rotatePrompt = "Rotate to landscape and mount on rig"`
      - `recording.cue.started = "Recording started"`
      - `recording.cue.stopped = "Recording stopped"`
      - `home.hero.greetingNamed = "Hi {{name}}"`
      - `home.hero.greetingAnonymous = "Hi there"`
      - `tabs.home = "Home"`
      - `tabs.tasks = "Tasks"`
      - `tabs.history = "History"`
      - `history.filter.today = "Today"`
      - `history.filter.yesterday = "Yesterday"`
      - `history.filter.thisWeek = "This week"`
      - `history.filter.thisMonth = "This month"`
      - `uploadChip.uploading = "Uploading…"`
      - `uploadChip.verifying = "Uploaded — verifying…"`
      - `uploadChip.failed = "Upload failed"`
      - `uploadChip.success = "✓ Uploaded"`
      - `uploadChip.pausedOffline = "Paused — no Wi-Fi"`
    - **`checks.ts`** — field renamed from `label` to `labelKey`; values become i18n key strings (see <interfaces>). The export shape change is internal (only `CompatRunningScreen.tsx` consumes CHECKS); update CompatRunningScreen to call `t(row.labelKey)` at the render site.
    - **`RotatePrompt.tsx`** — the JSX literal at line 108 becomes `{t('recording.rotatePrompt')}`. Import `useTranslation` at the top (mirror the pattern from `RigTutorialScreen.tsx`). The file comment at line 11 labelling the literal "verbatim label" stays unchanged (historical note) but is supplemented with `// [07-11] Moved to i18n catalog under recording.rotatePrompt.` so future readers know.
    - **`RecordingScreen.tsx`** — three call sites: line 414 `speakCue('Recording stopped')`, line 425 `speakCue('Recording stopped')`, line 657 `showVoiceCue('Recording started')`. The `useTranslation` hook is already destructured at line 182 (`const { t, i18n } = useTranslation();`). Replace literals with `t('recording.cue.stopped')` / `t('recording.cue.started')` respectively. (The `showVoiceCue` helper internally calls `speakCue(text)` + `setToast({ text, visible: true })` per the function signature at lines 207-225 — passing a translated string flows through cleanly.)
    - **`HomeHero.tsx`** — at the top of the component, `const { t } = useTranslation();`. The `greeting` computation at line 138 becomes the interpolated keys. The empty-state hero text (lines 104-115) — re-verify if the existing `t()` calls cover the empty-state body; if a literal "Start your first recording" or similar is hardcoded, fix it too (search the file for any remaining English literal strings; the operator's G-05 evidence says "hero section in English" — likely both the greeting AND any hero body copy).
    - **`HomeScreen.tsx`** — call sites of HomeHero (line 427) — if HomeScreen is passing English literals as props to HomeHero (e.g. `title="Start recording"`), translate those at the call site or move the literal into HomeHero with a `t(...)` call. Verify the existing `home.*` keys in en.json cover the hero CTA copy.
    - **`MainTabs.tsx`** — three Tab.Screen rows gain `options={{ tabBarLabel: t('tabs.{home|tasks|history}') }}`. The `name` prop stays English (route stability). `useTranslation` imported at the top. Verify the existing `tabBarLabelStyle` token from `ui/tokens.ts` is unaffected by the change.
    - **`HistoryScreen.tsx::filterChipLabel`** — refactor to accept `t` as a parameter, OR convert into a hook-friendly pattern by inlining the switch where it's used (verify pattern by reading lines 530-590 — the call site context determines which is cleaner). Return `t('history.filter.today')` etc. The custom-range branch stays as-is (uses formatted dates, not literals).
    - **`UploadStatusChip.tsx`** — add `import { useTranslation } from 'react-i18next';` at the top. Inside the component (it's a function component), add `const { t } = useTranslation();`. Change the `LABELS` constant to `LABEL_KEYS: Record<UploadStatusVariant, string>` mapping variant -> i18n key. The label resolution at the existing `const label = ...` line becomes a `t()` call. **Special case** for the `progress` variant with a percentage suffix: the existing logic appends ` 47%` to the label when `progressPercent` is provided — preserve that interpolation logic (it concatenates a translated base label with the raw percentage; do NOT translate the percentage glyph).
    - **Unit tests** for each touched file (the 6 `__tests__` test files listed in `files_modified`) assert two things: (a) the source file no longer contains the English literal (grep-style assertion in the test, OR a structural snapshot test that asserts the rendered output reads from `t()`); (b) the en.json catalog contains the new keys. Use `vitest` (existing infra) + `react-i18next` test utilities. Mirror the pattern from `apps/mobile/src/components/__tests__/LanguageSheet.test.tsx` if present.
    - **Owner-deviation audit:** confirm `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` is NOT in this plan's `files_modified` (it's swept by plan 07-05 and carries the owner-deviation camera-framing tip). A grep at verify time confirms no edits there.
    - **G-04 voice-half guard (POST-CHECKER-REV):** confirm `apps/mobile/src/lib/ttsVoice.ts` is NOT in this plan's `files_modified`. A grep at verify time confirms zero diff there. The voice-engine chain stays as plan 07-06 shipped it; voice-half closure is operator-walk-only at 07-15 §4.
    - **Phase 7 carve-out preservation:** literals like `'hevc'` / `'1080p'` / `'imu_video_drift_p99_ms'` / `'HumynCapture.start'` / log tags / route names stay English. Only USER-FACING display strings move to the catalog.
  </behavior>
  <action>
1. **Read the 11 source files** listed in `<read_first>`. Map every literal English string that's user-visible to one of the 24 new key paths in `<behavior>`. Note any literal that appears in `<read_first>` files but is NOT in the 24 keys above — surface it to the user before editing (likely a deferral candidate or already covered by existing keys).

2.  **Extend `apps/mobile/src/i18n/locales/en.json`** with the 24 new keys. Use the existing namespace structure (the `"compat"` block already exists with `running`/`pass`/`fail` sub-trees; add `checkLabels` as a sibling). For `home`, the existing keys are `sectionContribution`, `emptyTip`, `tile.*`, etc. — add a new `hero` sub-tree. For `tabs`, no existing namespace; create as a new top-level key. For `history`, the existing namespace has `emptyHeading`, `emptyBody`, etc. — add a new `filter` sub-tree. For `uploadChip`, no existing namespace; create top-level.

3.  **Modify `apps/mobile/src/screens/compat/checks.ts`** — rename `label` → `labelKey` and replace values with i18n key strings. Export the same const (no API surface change for non-consumers). Update the TypeScript shape if the file exports a public type.

4.  **Modify `apps/mobile/src/screens/compat/CompatRunningScreen.tsx`** — at the render site that currently reads `{row.label}`, change to `{t(row.labelKey)}`. The `useTranslation` import is already present (line 31 likely; verify) — if not, add it at the top.

5.  **Modify `apps/mobile/src/screens/recording/components/RotatePrompt.tsx`** — import `useTranslation`, destructure `t`, replace the literal JSX text with `{t('recording.rotatePrompt')}`. Append the `// [07-11] Moved to i18n catalog under recording.rotatePrompt.` comment underneath the existing line-11 "verbatim label" comment.

6.  **Modify `apps/mobile/src/screens/recording/RecordingScreen.tsx`** — three call-site edits at lines 414 / 425 / 657. The `t` is already destructured at line 182. Replace `speakCue('Recording stopped')` with `speakCue(t('recording.cue.stopped'))`, and `showVoiceCue('Recording started')` with `showVoiceCue(t('recording.cue.started'))`. **Do NOT** touch anything else in RecordingScreen (the brightness state machine, the live-preview wiring from plan 07-07, the existing `pickAndSetLocaleVoice` call at line 258 — all stay). **Do NOT touch `apps/mobile/src/lib/ttsVoice.ts`** — the voice-engine chain stays as plan 07-06 shipped it (G-04 voice-half is operator-walk-only at 07-15 §4).

7.  **Modify `apps/mobile/src/components/HomeHero.tsx`** — add `useTranslation` import; replace the line-138 greeting computation with `t('home.hero.greetingNamed', { name: greetingTarget })` / `t('home.hero.greetingAnonymous')`. Scan the rest of the file for additional English literals (`'Start recording'`, `'Hi there'`, any hero body copy) and either move them to keys in en.json under `home.hero.*` (and update this plan's en.json delta to include them) or surface them for owner confirmation if they were intentional design copy.

8.  **Modify `apps/mobile/src/screens/home/HomeScreen.tsx`** — verify HomeHero usage at line 427; if HomeScreen passes any English literal props, fix at the call site. Otherwise no changes needed here — the `t()` calls inside the existing `t('home.sectionContribution')` etc. stay as-is.

9.  **Modify `apps/mobile/src/navigation/MainTabs.tsx`** — convert from a fully static body to a function-body using `useTranslation()`. Add `options={{ tabBarLabel: t('tabs.{home|tasks|history}') }}` per row. Verify the navigation type definitions in `apps/mobile/src/navigation/RootNativeStack.tsx` (or equivalent) don't break — the `name` prop is the route key and stays English.

10. **Modify `apps/mobile/src/screens/history/HistoryScreen.tsx::filterChipLabel`** — refactor to take `t` as a parameter OR convert to a hook by inlining the switch where it's called. The function is a pure helper today; the cleanest path is to pass `t` as a second argument: `filterChipLabel(named, custom, t)`. Update each call site (there appear to be 1–2 inside `HistoryScreen`) to pass the destructured `t`. The custom-range branch (returns formatted dates from `formatDate`) is unchanged.

11. **Modify `apps/mobile/src/components/UploadStatusChip.tsx`** — wire `useTranslation`, replace the `LABELS` constant with `LABEL_KEYS`, preserve the progress-percent interpolation (use `t('uploadChip.uploading') + ' ' + progressPercent + '%'` or i18next interpolation `t('uploadChip.uploadingWithPercent', { percent: progressPercent })` — pick the simpler one; if you choose interpolation, add the additional key to en.json: `uploadChip.uploadingWithPercent = "Uploading… {{percent}}%"`).

12. **Write 6 unit tests** (one per call-site cluster):

    - `apps/mobile/src/screens/compat/__tests__/checks.i18n.test.ts` — assert `CHECKS[0].labelKey === 'compat.checkLabels.ultrawide'` (and similar for the other 6 rows); assert `CHECKS[0]` has NO `label` property (the field was renamed).
    - `apps/mobile/src/screens/recording/components/__tests__/RotatePrompt.i18n.test.tsx` — render `<RotatePrompt />` inside an `<I18nextProvider>` with a stubbed resources catalog; assert the rendered text is the stub value AND the source file does NOT contain the literal `Rotate to landscape and mount on rig` outside a comment block. Use `vitest` `it.todo` pattern if RN render isn't testable in your harness — at minimum, assert via `readFileSync` that `grep "Rotate to landscape and mount on rig" RotatePrompt.tsx` returns 0 non-comment matches.
    - `apps/mobile/src/navigation/__tests__/MainTabs.i18n.test.tsx` — assert the Tab.Screen `options.tabBarLabel` is a `t('tabs.home')` call (snapshot or static analysis test).
    - `apps/mobile/src/screens/home/__tests__/HomeHero.i18n.test.tsx` — render HomeHero with locale='hi-IN' and an i18n stub; assert the rendered text matches the stubbed Hindi value and does NOT contain the literal `Hi there` or `Hi {name}` (English).
    - `apps/mobile/src/screens/history/__tests__/HistoryScreen.i18n.test.tsx` — assert the `filterChipLabel` function (or its replacement) returns a translated string for each NamedRange when given the active-locale `t` function.
    - `apps/mobile/src/components/__tests__/UploadStatusChip.i18n.test.tsx` — render the chip for each variant (progress, verifying, failed, success, pausedOffline) and assert the label text matches `t('uploadChip.{variant}')` AND does NOT contain the English literal.

    Use `vitest`. Use `react-i18next`'s `initReactI18next` with a minimal resources stub. Mirror the test infrastructure pattern from existing tests (e.g. `apps/mobile/src/components/__tests__/LanguageSheet.test.tsx`).

13. **Run the JS test suite** (per memory `feedback_post_merge_test_env.md`):

    ```bash
    set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test 2>&1 | tail -30
    ```

    Confirm exit 0 and all 6 new tests pass.

14. **Invariant checks:**

        - `git diff --stat apps/mobile/ios/` → empty
        - `git diff --stat apps/api/drizzle/migrations/` → empty
        - `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` → empty
        - `git diff --stat apps/mobile/android/` → empty (this plan is JS/JSON-only)
        - `git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts` → empty (G-08 is plan 07-12's scope)
        - `git diff --stat apps/mobile/src/screens/help/content.json apps/mobile/src/screens/help/markdown.tsx apps/mobile/src/screens/help/HelpCenterScreen.tsx` → empty (G-10 is plan 07-13's scope)
        - `git diff --stat apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` → empty (owner-deviation guard)
        - `git diff --stat apps/mobile/src/lib/ttsVoice.ts` → empty (G-04 voice-half guard — file deliberately excluded from `files_modified`; voice-engine work was completed in plan 07-06 (D-31) and re-verified by operator at 07-15 §4)
        - `git diff --stat apps/mobile/src/screens/profile/ProfileScreen.tsx apps/mobile/src/components/DeleteAccountModal.tsx` → empty (plan 07-09 closed those; do not re-touch)

      </action>
      <verify>
        <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25</automated>
      </verify>
      <acceptance_criteria>
        - `grep -v '^#' apps/mobile/src/screens/recording/components/RotatePrompt.tsx | grep -c 'Rotate to landscape and mount on rig'` returns 0 (no non-comment occurrence of the literal — self-invalidating-grep-gate-safe; only the comment-block reference at line 11 remains).
        - `grep -c "t('recording.rotatePrompt')" apps/mobile/src/screens/recording/components/RotatePrompt.tsx` returns at least 1.
        - `grep -c "speakCue('Recording" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns 0 (all literals removed from speakCue / showVoiceCue calls).
        - `grep -cE "speakCue\\(t\\('recording\\.cue|showVoiceCue\\(t\\('recording\\.cue" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 3 (line 414, 425, 657).
        - `grep -c "labelKey:" apps/mobile/src/screens/compat/checks.ts` returns at least 7 (one per CHECKS row).
        - `grep -c "label:" apps/mobile/src/screens/compat/checks.ts` returns 0 (the field is renamed, not duplicated).
        - `grep -c "t(row.labelKey)" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` returns at least 1.
        - `grep -cE "'Hi '|'Hi there'|\\\`Hi \\\$" apps/mobile/src/components/HomeHero.tsx` returns 0.
        - `grep -c "t('home.hero" apps/mobile/src/components/HomeHero.tsx` returns at least 2 (named + anonymous).
        - `grep -c "tabBarLabel:" apps/mobile/src/navigation/MainTabs.tsx` returns at least 3 (one per Tab.Screen).
        - `grep -c "useTranslation" apps/mobile/src/navigation/MainTabs.tsx` returns at least 1.
        - `grep -cE "return 'Today'|return 'Yesterday'|return 'This week'|return 'This month'" apps/mobile/src/screens/history/HistoryScreen.tsx` returns 0.
        - `grep -cE "t\\('history\\.filter\\." apps/mobile/src/screens/history/HistoryScreen.tsx` returns at least 4.
        - `grep -cE "'Uploading…'|'Upload failed'|'✓ Uploaded'|'Paused — no Wi-Fi'" apps/mobile/src/components/UploadStatusChip.tsx` returns 0.
        - `grep -c "useTranslation" apps/mobile/src/components/UploadStatusChip.tsx` returns at least 1.
        - `jq '.compat.checkLabels.ultrawide' apps/mobile/src/i18n/locales/en.json` returns a non-null string (and similar for the other 6 rows).
        - `jq '.recording.rotatePrompt' apps/mobile/src/i18n/locales/en.json` returns `"Rotate to landscape and mount on rig"`.
        - `jq '.recording.cue.started, .recording.cue.stopped' apps/mobile/src/i18n/locales/en.json` returns `"Recording started"\n"Recording stopped"`.
        - `jq '.home.hero.greetingNamed, .home.hero.greetingAnonymous' apps/mobile/src/i18n/locales/en.json` both non-null.
        - `jq '.tabs.home, .tabs.tasks, .tabs.history' apps/mobile/src/i18n/locales/en.json` all three non-null.
        - `jq '.history.filter.today, .history.filter.yesterday, .history.filter.thisWeek, .history.filter.thisMonth' apps/mobile/src/i18n/locales/en.json` all four non-null.
        - `jq '.uploadChip.uploading, .uploadChip.verifying, .uploadChip.failed, .uploadChip.success, .uploadChip.pausedOffline' apps/mobile/src/i18n/locales/en.json` all five non-null.
        - All six new test files exist + the `pnpm -r --parallel test` invocation exits 0.
        - `git diff --stat apps/mobile/ios/` empty (I18N-21).
        - `git diff --stat apps/api/drizzle/migrations/` empty (D-16).
        - `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty (I18N-11).
        - `git diff --stat apps/mobile/android/` empty (Android untouched).
        - `git diff --stat apps/mobile/src/lib/ttsVoice.ts` empty (G-04 voice-half guard — file deliberately excluded from `files_modified`).
        - `git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/screens/help/content.json apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` empty (G-08 / G-10 / owner-deviation guards).
      </acceptance_criteria>
      <done>All 8 unswept surfaces (G-02, G-03, G-04 text-half, G-05, G-06, G-07, G-09) wired to `t()` calls; en.json gains 24 new keys with English source values; 6 new unit tests assert the wiring + key existence; mobile JS test suite green. G-04 voice-half closure is operator-walk-only at 07-15 §4 (no code-side change in this plan).</done>
    </task>

<task type="auto">
  <name>Task 2: Regenerate 7 non-English locale catalogs via the LLM tool + shape-parity validate + commit</name>
  <files>apps/mobile/src/i18n/locales/pt-BR.json, apps/mobile/src/i18n/locales/es.json, apps/mobile/src/i18n/locales/hi-IN.json, apps/mobile/src/i18n/locales/bn-IN.json, apps/mobile/src/i18n/locales/ta-IN.json, apps/mobile/src/i18n/locales/te-IN.json, apps/mobile/src/i18n/locales/mr-IN.json</files>
  <read_first>
    - tools/i18n/generate.ts (the entry point — confirm it's invokable via `pnpm i18n:generate`)
    - tools/i18n/validate.ts (shape parity rules)
    - tools/i18n/prompts.ts (the vernacular brief)
    - tools/i18n/locale-config.ts (the 7-locale list)
    - tools/.env.example (confirm ANTHROPIC_API_KEY env-var expectation) and tools/.env (the executor's local file with the actual key — operator's pre-existing setup per plan 07-02)
    - apps/mobile/src/i18n/locales/en.json (the freshly-updated catalog from Task 1)
  </read_first>
  <behavior>
    - Run `pnpm i18n:generate` (or `cd tools && pnpm tsx i18n/generate.ts` — match the exact invocation in `tools/package.json` `scripts`). The tool reads the freshly-updated `apps/mobile/src/i18n/locales/en.json` from Task 1 and overwrites each of the 7 non-English locale JSONs with a freshly-translated full catalog from Claude Opus 4.7.
    - After regeneration, run `pnpm i18n:validate` (or `cd tools && pnpm tsx i18n/validate.ts`) to confirm shape parity across all 8 catalogs.
    - Each regenerated JSON gains a fresh `*.audit.json` sidecar (the existing pattern from plan 07-02).
    - **No human-translator review pass at MVP** — per CONTEXT.md D-11 + the "Deferred Ideas" block. The LLM output is the MVP source of truth.
    - **Owner deviation re-check** (carve-out from RESEARCH §"En carve-outs"): the regen MUST NOT translate API constants, codec strings, encoder field names, the `recording.preview.live` label (already locked in 07-07 as a translated key but the LLM should produce per-locale values for it — verify the output looks reasonable for `recording.preview.live` in hi-IN; per CONTEXT.md D-26 it's a static label that gets translated).
  </behavior>
  <action>
1. **Confirm `tools/.env` contains `ANTHROPIC_API_KEY=...`** (the executor's local file, gitignored per plan 07-02). If missing, prompt the user to paste in their key (this is a one-time setup; once set it persists for subsequent regens).

2. **Run the LLM regen tool:**

   ```bash
   pnpm i18n:generate 2>&1 | tee /tmp/07-11-i18n-regen.log
   ```

   The tool makes 7 sequential calls to Claude Opus 4.7 (one per non-English locale) and writes each locale JSON + audit sidecar. Expected output: 7 lines like `[generate] {locale}: OK`. If any line says `[generate] {locale}: SKIPPED — fix prompt or re-run`, investigate (`validate.ts::validateShapeParity` reports missing/extra keys) and re-run the failing locale only by adding a targeted invocation if needed.

3. **Run shape-parity validate:**

   ```bash
   pnpm i18n:validate 2>&1 | tail -20
   ```

   Expected output: 7 lines `[validate] {locale}: OK` (or equivalent based on the tool's actual stdout). Exit 0.

4. **Spot-check the hi-IN catalog** for sanity (verify the translations look reasonable, especially the new keys from Task 1):

   ```bash
   jq '.compat.checkLabels' apps/mobile/src/i18n/locales/hi-IN.json
   jq '.tabs' apps/mobile/src/i18n/locales/hi-IN.json
   jq '.recording.cue' apps/mobile/src/i18n/locales/hi-IN.json
   jq '.history.filter' apps/mobile/src/i18n/locales/hi-IN.json
   jq '.uploadChip' apps/mobile/src/i18n/locales/hi-IN.json
   jq '.home.hero' apps/mobile/src/i18n/locales/hi-IN.json
   ```

   Each block should contain Devanagari script translations (not English fallback). If any block is English-fallback, investigate (likely the LLM hit a quota or the key path was misnamed and silently fell through to en) and re-run.

5. **Run the JS test suite again** to confirm the regen didn't break Task 1's tests:

   ```bash
   set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test --filter "@humyn/mobile" 2>&1 | tail -25
   ```

   Confirm exit 0.

6. **Invariant checks (same as Task 1):** confirm all 4 invariant gates green; specifically that the regen did NOT touch `taskCatalog.i18n.ts` (the LLM tool only reads/writes `locales/*.json`, not the task catalog).

7. **Document the LLM model + audit timestamp** in the per-locale `*.audit.json` sidecars. The existing `tools/i18n/generate.ts::buildAuditSidecar` already does this — verify via `cat apps/mobile/src/i18n/locales/hi-IN.audit.json` that the new audit reflects today's timestamp.
   </action>
   <verify>
   <automated>cd "$(git rev-parse --show-toplevel)" && pnpm i18n:validate 2>&1 | tail -10</automated>
   </verify>
   <acceptance_criteria> - All 7 non-English locale JSONs (`pt-BR.json`, `es.json`, `hi-IN.json`, `bn-IN.json`, `ta-IN.json`, `te-IN.json`, `mr-IN.json`) have non-empty translated values for each of the 24 new key paths from Task 1. - Spot-check `jq '.compat.checkLabels.ultrawide' apps/mobile/src/i18n/locales/hi-IN.json` returns a non-empty Devanagari-script string (NOT the English literal `"Ultrawide camera"`). - Spot-check `jq '.tabs.home' apps/mobile/src/i18n/locales/hi-IN.json` returns a Devanagari-script string. - `pnpm i18n:validate` exits 0 with shape parity green across all 8 catalogs. - All 7 `*.audit.json` sidecars have a `generated_at` timestamp within the last 24 hours of Task 2 completion. - The JS test suite exits 0 with all Task-1 tests still passing post-regen. - `git diff --stat apps/mobile/src/i18n/taskCatalog.i18n.ts apps/mobile/src/screens/help/content.json apps/mobile/ios/ apps/api/drizzle/migrations/ apps/mobile/android/` empty. - `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` empty.
   </acceptance_criteria>
   <done>7 non-English catalogs regenerated with the 24 new keys; shape parity validated; sidecars refreshed; downstream tests green; the i18n sweep extension is now feature-complete pending the operator's §2 re-walk in plan 07-15.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                    | Description                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| LLM translation pipeline → user-facing copy | Untrusted LLM output is committed verbatim into the app bundle as user-visible UI text. |
| en.json → 7 locale catalogs                 | Single-direction propagation; en.json is the canonical source.                          |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                               | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                     |
| ---------- | ---------------------- | ----------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-11-01 | Tampering              | LLM translation output                                                  | mitigate    | The shape-parity validator (`tools/i18n/validate.ts`) enforces structural equivalence with en.json; the vernacular brief is a fixed system prompt; sidecar audit JSONs record model + brief version + en.json SHA so any drift is auditable. Human-translator review pass deferred per CONTEXT.md "Deferred Ideas". |
| T-07-11-02 | Information Disclosure | en.json → catalogs                                                      | accept      | en.json contains user-visible copy only — no secrets, no PII, no system identifiers. Each non-English catalog is a translation of strictly user-facing strings.                                                                                                                                                     |
| T-07-11-03 | Spoofing               | LLM-generated translations may produce culturally inappropriate content | accept      | Per-locale legal review deferred to §v2 per CONTEXT.md "Deferred Ideas". The vernacular brief explicitly forbids loanwords from English where a common native word exists — reducing risk of awkward output. The operator's §2 re-walk in plan 07-15 is the final human review.                                     |

</threat_model>

<verification>
1. `pnpm i18n:validate` exits 0.
2. `pnpm -r --parallel test --filter "@humyn/mobile"` exits 0.
3. `grep -v '^#' apps/mobile/src/screens/recording/components/RotatePrompt.tsx | grep -c 'Rotate to landscape and mount on rig'` returns 0.
4. `grep -c "speakCue(t('recording.cue" apps/mobile/src/screens/recording/RecordingScreen.tsx` returns at least 1.
5. All 8 catalog JSONs have a `compat.checkLabels.ultrawide` value (jq smoke check).
6. iOS / migrations / Phase-6 cosmetics / Android / taskCatalog / Help-Center / RigTutorial / **ttsVoice.ts** all untouched.
</verification>

<success_criteria>

- G-02 (CompatCheckScreen labels) closed: every label rendered via `t(row.labelKey)`.
- G-03 (RotatePrompt) closed: literal removed, key added, 8-locale catalogs cover the key.
- G-04 text-half closed: speakCue/showVoiceCue calls use `t()` for the cue text.
- G-04 voice-half — NOT closed by this plan. The voice-engine `pickAndSetLocaleVoice` chain was shipped in plan 07-06 (D-31); `ttsVoice.ts` is deliberately excluded from this plan's scope. Voice-half closure is operator-walk-only and re-verified at plan **07-15 §4** on Pixel-10a hi-IN.
- G-05 (HomeHero) closed: greeting + empty-state hero copy rendered via `t()`.
- G-06 (Tab labels) closed: tabBarLabel reads `t('tabs.{home|tasks|history}')`.
- G-07 (HistoryScreen time-filter chips) closed: filterChipLabel returns `t()`.
- G-09 (UploadStatusChip) closed: variant labels rendered via `t('uploadChip.*')`.
- 7 non-English catalogs regenerated with the new keys.
- Owner deviation (RigTutorial camera-framing tip) preserved.
- All invariants green.
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-11-SUMMARY.md` documenting:
- The 24 new en.json keys + the source files they wire.
- A `grep` evidence block confirming the 8 English literals removed.
- The `pnpm i18n:validate` output snapshot post-regen.
- Pixel-10a hardware re-walk deferred to plan 07-15 §2 (full per-locale loop) and plan **07-15 §4** (G-04 voice-half — operator-walk-only since `ttsVoice.ts` is intentionally untouched here).
- A note that G-08 (TasksScreen task data) remains open and is handled by plan 07-12.
- A note that G-10 (Help Center body) remains open and is handled by plan 07-13.
</output>
</output>
