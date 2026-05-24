---
phase: 07-multi-linguality-live-cam-feed
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 99
files_reviewed_list:
  - .gitignore
  - apps/mobile/App.tsx
  - apps/mobile/__tests__/components/LanguageSheet.test.tsx
  - apps/mobile/__tests__/i18n/bootstrap.test.ts
  - apps/mobile/__tests__/i18n/errorMap.test.ts
  - apps/mobile/__tests__/i18n/i18n.test.ts
  - apps/mobile/__tests__/i18n/reverseSearch.test.ts
  - apps/mobile/__tests__/i18n/taskCatalog.test.ts
  - apps/mobile/__tests__/lib/dates.test.ts
  - apps/mobile/__tests__/lib/livePreviewState.test.ts
  - apps/mobile/__tests__/lib/ttsVoice.test.ts
  - apps/mobile/__tests__/screens/ChooseLanguageScreen.test.tsx
  - apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx
  - apps/mobile/__tests__/screens/practiceFlow.test.tsx
  - apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx
  - apps/mobile/__tests__/screens/recording/handGate.test.tsx
  - apps/mobile/__tests__/screens/recording/livePreview.test.tsx
  - apps/mobile/__tests__/services/api.errorToast.test.ts
  - apps/mobile/__tests__/services/telemetryRing.locale.test.ts
  - apps/mobile/__tests__/state/initialRoute.locale.test.ts
  - apps/mobile/__tests__/state/initialRoute.test.ts
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewPackage.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/LivePreviewSurfaceRegistry.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt
  - apps/mobile/package.json
  - apps/mobile/src/components/DeleteAccountModal.tsx
  - apps/mobile/src/components/LanguageList.tsx
  - apps/mobile/src/components/LanguageSheet.tsx
  - apps/mobile/src/components/ReportProblemSheet.tsx
  - apps/mobile/src/i18n/bootstrap.ts
  - apps/mobile/src/i18n/errorMap.ts
  - apps/mobile/src/i18n/index.ts
  - apps/mobile/src/i18n/locale-meta.ts
  - apps/mobile/src/i18n/locales/bn-IN.audit.json
  - apps/mobile/src/i18n/locales/bn-IN.json
  - apps/mobile/src/i18n/locales/en.json
  - apps/mobile/src/i18n/locales/es.audit.json
  - apps/mobile/src/i18n/locales/es.json
  - apps/mobile/src/i18n/locales/hi-IN.audit.json
  - apps/mobile/src/i18n/locales/hi-IN.json
  - apps/mobile/src/i18n/locales/mr-IN.audit.json
  - apps/mobile/src/i18n/locales/mr-IN.json
  - apps/mobile/src/i18n/locales/pt-BR.audit.json
  - apps/mobile/src/i18n/locales/pt-BR.json
  - apps/mobile/src/i18n/locales/ta-IN.audit.json
  - apps/mobile/src/i18n/locales/ta-IN.json
  - apps/mobile/src/i18n/locales/te-IN.audit.json
  - apps/mobile/src/i18n/locales/te-IN.json
  - apps/mobile/src/i18n/reverseSearch.ts
  - apps/mobile/src/i18n/storage.ts
  - apps/mobile/src/i18n/taskCatalog.i18n.ts
  - apps/mobile/src/lib/dates.ts
  - apps/mobile/src/lib/livePreviewState.ts
  - apps/mobile/src/lib/ttsVoice.ts
  - apps/mobile/src/native/HumynLivePreviewView.tsx
  - apps/mobile/src/navigation/OnboardingStack.tsx
  - apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx
  - apps/mobile/src/screens/compat/CompatFailScreen.tsx
  - apps/mobile/src/screens/compat/CompatPassScreen.tsx
  - apps/mobile/src/screens/compat/CompatRunningScreen.tsx
  - apps/mobile/src/screens/force-upgrade/ForceUpgradeScreen.tsx
  - apps/mobile/src/screens/help/HelpCenterScreen.tsx
  - apps/mobile/src/screens/history/HistoryScreen.tsx
  - apps/mobile/src/screens/history/PlayerScreen.tsx
  - apps/mobile/src/screens/home/HomeScreen.tsx
  - apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx
  - apps/mobile/src/screens/permissions/PermissionsScreen.tsx
  - apps/mobile/src/screens/profile/ProfileScreen.tsx
  - apps/mobile/src/screens/recording/RecordingScreen.tsx
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/screens/signup/TermsOfUseModal.tsx
  - apps/mobile/src/screens/splash/SplashScreen.tsx
  - apps/mobile/src/screens/tasks/SendRequestSheet.tsx
  - apps/mobile/src/screens/tasks/TaskDetailsSheet.tsx
  - apps/mobile/src/screens/tasks/TasksScreen.tsx
  - apps/mobile/src/screens/tutorial/PracticeCompleteScreen.tsx
  - apps/mobile/src/screens/tutorial/PracticeIntroScreen.tsx
  - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
  - apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx
  - apps/mobile/src/services/api.ts
  - apps/mobile/src/services/tasksApi.ts
  - apps/mobile/src/state/initialRoute.ts
  - apps/mobile/src/util/analytics.ts
  - apps/mobile/vitest.setup.ts
  - tools/.env.example
  - tools/.gitignore
  - tools/i18n/__tests__/generate.test.ts
  - tools/i18n/__tests__/validate.test.ts
  - tools/i18n/generate.ts
  - tools/i18n/locale-config.ts
  - tools/i18n/prompts.ts
  - tools/i18n/validate.ts
  - tools/package.json
  - tools/tsconfig.json
findings:
  critical: 0
  warning: 8
  info: 12
  total: 20
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-25
**Depth:** standard
**Files Reviewed:** 99
**Status:** issues_found

## Summary

Reviewed Phase 7 deliverables across five areas: i18n runtime (bootstrap + 8 locale catalogs + helpers + error map), the LLM catalog-generator tool, the screen-string sweep, the live-cam preview native module (Kotlin Camera2 second-Surface routing), and the test surface.

Capture-spec invariants are well-defended: `CaptureSession.openCaptureSession` snapshots the preview surface at session-config time only, never reconfigures mid-record (Option B), always lists the encoder Surface first in the outputs list, and nulls the registry callbacks before `captureSession.close()` to avoid the IllegalStateException race. The drift telemetry path and FinalizeWorker cancel gates are untouched.

i18n shape parity is clean — all 8 locale JSONs share exactly 202 leaf keys, zero missing, zero extra (verified via dotted-path walk). The bootstrap synchronously validates against the SUPPORTED_LOCALES allow-list, the runtime initializes with `initImmediate:false` for sync-first-render guarantees, and `fallbackLng: 'en'` provides the missing-key safety net.

**No BLOCKER-class issues found** — no security vulnerabilities, no data loss risks, no capture-spec regressions, no authentication bypasses. The 20 findings below are WARNING + INFO concerning maintainability, race-condition hardening, hardcoded English in a few legacy surfaces, and test-assertion strength.

## Warnings

### WR-01: Locale-aware Profile field labels not migrated to i18n — "Name", "Age", "Gender", "Joined", "Help Center", "Logout", "Delete account" hardcoded

**File:** `apps/mobile/src/screens/profile/ProfileScreen.tsx:261,284,286,293,301,335,347,359`
**Issue:** The Phase 7 plan 07-05 ("screen string sweep + bilingual consent") migrated `terms.consent.body`, `profile.language.row.label`, and similar to i18n — but ProfileScreen still hardcodes English for the `InlineEditField` labels ("Name"/"Age"/"Gender"), the "Joined" row label, "contributed"/"Across N tasks" captions, "tap to edit" caption (line 246), "Payments & Earnings" / "COMING SOON" / `PAYMENTS_BODY` constant, "Help Center" / "Logout" / "Delete account" row labels, and the `Alert.alert('Could not update', 'Please try again.')` toast. A user with `i18n.language === 'hi-IN'` sees the Language picker label translated but the entire surrounding screen in English. This is an incomplete-sweep gap that the plan's "screen string sweep" promised to close.
**Fix:** Add corresponding keys to each of the 8 locale JSONs under a `profile.*` namespace (e.g. `profile.head.tapToEdit`, `profile.lifetime.contributed`, `profile.lifetime.acrossNTasks` with `{{count}}`, `profile.fields.{name,age,gender,joined}`, `profile.actions.{help,logout,delete}`, `profile.payments.{title,comingSoon,body}`, `profile.errors.couldNotUpdate{Title,Body}`) and route every label through `t(...)`. Same applies to DeleteAccountModal.tsx (Step1 body, "Cancel"/"Continue to delete"/"Confirm"/"Type DELETE to confirm.", Alert.alert calls — all English-only).

### WR-02: `LOCALE_NATIVE_NAMES[i18n.language as Locale] ?? 'English'` — hardcoded English fallback when the lookup should fall back through the locale-meta table

**File:** `apps/mobile/src/screens/profile/ProfileScreen.tsx:326`
**Issue:** `LOCALE_NATIVE_NAMES[i18n.language as Locale] ?? 'English'` — the `as Locale` cast is unsafe (i18n.language is `string`, not a narrow union; it can return values like `'hi-IN-x-private'`, `'en-US'`, or any tag passed to `changeLanguage`). When the lookup misses, the fallback is the literal English string `'English'`, which is inconsistent with the rest of the i18n architecture and means a user whose `i18n.language` somehow drifts away from the 8 supported tags sees "English ›" on their language row regardless of what's actually configured.
**Fix:**

```tsx
const currentLocale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
  ? (i18n.language as Locale)
  : 'en';
// ...
<Text variant="body" tone="tertiary">
  {LOCALE_NATIVE_NAMES[currentLocale]} ›
</Text>;
```

This mirrors `localeBootstrap()`'s allow-list check (`apps/mobile/src/i18n/bootstrap.ts:16`) and keeps "English" sourced from `LOCALE_NATIVE_NAMES['en']`, not a literal.

### WR-03: `LivePreviewSurfaceRegistry.onAddTarget`/`onRemoveTarget` cleared at session-close but never replaced between sessions — two concurrent CaptureSessions would race

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt:662-689,1044-1045`
**Issue:** `openCaptureSession` assigns the registry's `onAddTarget` / `onRemoveTarget` global callbacks unconditionally when `previewSurfaceAtConfig != null`. The new callbacks close over THIS session's `s` (CameraCaptureSession) and `cam` (CameraDevice). If a second `CaptureSession` is somehow started before the first one's `closeSegmentResources` runs (e.g. the JS layer races a start→stop→start during the gate→record handoff, or a thermal escalation posts the graceful stop on top of an in-flight rotate), the second session OVERWRITES the registry's callbacks with closures over its own state — but then the first session's `closeSegmentResources` will null both slots, leaving the second session with NO live-preview toggle even though its preview Surface is published. Worse, between the assignments the registry can briefly hold a callback that references the FIRST session's closed `s`, which would throw IllegalStateException on the next `setRepeatingRequest`. The `try { ... } catch (_: Throwable)` blocks on lines 669, 685 absorb that, but the silent-failure path means the preview never re-attaches and the user sees a dead live-cam in subsequent windows. Mitigation: store these as `WeakReference`s, or guard the assignment with a session-identity check (e.g. registry tracks `onAddTargetOwner: CaptureSession?` and `onAddTarget?.invoke()` only runs when ownership matches), or document explicitly that only one CaptureSession may be alive at any moment AND assert it (`require(LivePreviewSurfaceRegistry.onAddTarget == null)` at the assignment).
**Fix:**

```kotlin
// In LivePreviewSurfaceRegistry.kt — track owner:
@Volatile private var owner: Any? = null
fun installCallbacks(o: Any, add: () -> Unit, remove: () -> Unit) {
    owner = o; onAddTarget = add; onRemoveTarget = remove
}
fun clearCallbacksFor(o: Any) {
    if (owner === o) { owner = null; onAddTarget = null; onRemoveTarget = null }
}
// In CaptureSession.openCaptureSession: replace direct assignment with installCallbacks(this, ...)
// In closeSegmentResources: replace nulling with clearCallbacksFor(this)
```

### WR-04: `HumynLivePreviewViewManager.onDropViewInstance` force-clears the registry with `null` — defeats the `slot === s` re-mount-race guard

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt:51-52`
**Issue:** `onDropViewInstance` calls `LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)`. The registry treats `null` as a force-clear (LivePreviewSurfaceRegistry.kt:77 — `if (s == null || slot === s) { slot = null }`). The CaptureSessionLivePreviewTest test "non-matching Surface does NOT clear" relies on the matching-identity guard to prevent a re-mount race from clearing the NEW slot — but `onDropViewInstance` deliberately defeats that guard with the `null` argument. If RN drops the OLD view AFTER a NEW `<HumynLivePreviewView>` has already mounted and published its Surface (which can happen during a re-render cycle — the ViewManager destroy ordering is not guaranteed to precede the next view's creation), the OLD view's `onDropViewInstance` will clear the NEW view's published Surface. The comment on line 47-53 acknowledges this is "defensive belt-and-braces" but the choice to pass `null` (force-clear) instead of passing the view's `view.surface` (matching-identity clear) is the wrong defense for the exact race the registry guard was designed to prevent.
**Fix:** Add a `currentSurface(): Surface?` getter on the view class (or expose `view.surface` via a public field — currently private at HumynLivePreviewView.kt:54), then pass it:

```kotlin
override fun onDropViewInstance(view: HumynLivePreviewView) {
    LivePreviewSurfaceRegistry.onSurfaceDestroyed(view.surfaceForRegistry)
    super.onDropViewInstance(view)
}
```

And on `HumynLivePreviewView`, expose:

```kotlin
internal val surfaceForRegistry: Surface? get() = surface
```

### WR-05: LLM generator `generate.ts` writes audit sidecar with sha of the en.json BYTE STRING but writes the locale JSON with a re-serialization — sha doesn't authenticate what was actually translated

**File:** `tools/i18n/generate.ts:50-57,86-92`
**Issue:** `buildAuditSidecar(enSource)` hashes the raw `enSource` byte string from `readFileSync(enPath, 'utf8')`. The locale JSON is then written with `JSON.stringify(translated, null, 2) + '\n'` — a re-serialization with a 2-space indent and trailing newline. If `en.json` ever has different formatting (different indent, different trailing whitespace, BOM, key ordering), the sha changes even when the SEMANTIC content is identical. Conversely, the sidecar's `en_source_sha` does NOT authenticate that the locale file was translated from THAT en.json content — only that the generator was RUN against a file whose bytes hashed to that value. A subsequent en.json edit that doesn't change semantics still invalidates every audit sidecar. Worse, the sidecar doesn't include a hash of the WRITTEN locale JSON, so there's no way to verify the on-disk locale file matches what the LLM produced if anyone hand-edits it later.
**Fix:** Either (a) normalize en.json before hashing (`crypto.createHash('sha256').update(JSON.stringify(JSON.parse(enSource)))`) so it's content-addressed not byte-addressed; or (b) add an `output_sha` field to the audit sidecar that hashes the WRITTEN locale JSON so post-hoc tampering is detectable:

```ts
const localeJson = JSON.stringify(translated, null, 2) + '\n';
writeFileSync(resolve(localesDir, `${loc}.json`), localeJson);
writeFileSync(
  resolve(localesDir, `${loc}.audit.json`),
  JSON.stringify(
    {
      ...buildAuditSidecar(enSource),
      output_sha: createHash('sha256').update(localeJson, 'utf8').digest('hex'),
    },
    null,
    2,
  ) + '\n',
);
```

### WR-06: `userPromptFor` interpolates entire en.json into a single LLM prompt with no length guard — silent failure mode at ~16K-token output cap

**File:** `tools/i18n/generate.ts:23-28,15`, `tools/i18n/prompts.ts:12-18`
**Issue:** `MAX_TOKENS = 16_000` is hard-coded; `userPromptFor` interpolates the entire `enCatalog` via `JSON.stringify(enCatalog, null, 2)`. The current en.json has 202 leaf keys + a ~3KB nested terms.consent.body string. If the catalog grows past ~500 strings (or any single string grows to ~12K tokens — the terms-of-use body alone is ~150 tokens), the LLM may TRUNCATE the response (Anthropic's response stops at `max_tokens` mid-JSON). The downstream JSON.parse on cleaned text will then throw "Unexpected end of JSON input"; this is caught and logged as "response was not valid JSON" — but the `extra.length=0, missing.length=N` shape-parity branch is bypassed because the parse itself failed. A user re-running the generator with a slightly bigger catalog gets a silently-incomplete locale set with no diagnostic about which key the truncation hit. There's also no `stop_sequences` guard or response-shape validation beyond fence-stripping.
**Fix:** (1) Check `response.stop_reason === 'end_turn'` and reject with a clear "max_tokens hit — locale catalog too large for single-call generation, consider chunking" error if not. (2) Add a runtime check on cleaned-text length before parsing. (3) Track the actual usage and surface it: `console.log("[generate] ${loc}: tokens out=", response.usage?.output_tokens)` so the operator sees when they're approaching the cap.

### WR-07: `reverseSearch.ts` Stage-2 returns rebuilt query when ANY token matched — partial-match leaks raw locale text into backend ts_vector query

**File:** `apps/mobile/src/i18n/reverseSearch.ts:70-76`
**Issue:** Stage 2 splits the input on whitespace, maps each token through `tokenMap`, and returns `mapped.join(' ')` if `anyMapped` is true. For a query like `"चाय और toast"` (Hindi "tea and toast"), if only `"और"` happens to be a stopword-filtered token that doesn't map, but `"चाय"` maps to `"tea"` and `"toast"` doesn't map (stays as-is — `t ?? t` line 72), the rewritten query becomes `"tea और toast"`. The Devanagari `और` then flows to the backend's `ts_vector` which is indexed against English-only — this contaminates the query with characters that `to_tsquery` may reject (depending on the search config). The backend's pg_trgm fuzzy fallback (Phase 6 D-02) is the supposed safety net, but mixing scripts in a query is more degenerate than pure passthrough. Also: the Stage 2 path applies `normalizeForReverseSearch` to tokens (NFC + lowercase + accent-strip) but then JOINS the normalized tokens — losing the original casing in the rebuilt query. For a search backend that does case-insensitive matching this is harmless; if pg_trgm config ever changes, it becomes a silent quality regression.
**Fix:** Either reject mixed-script Stage-2 results (`if (mapped.every(t => isLatinScript(t)))`) and fall through to Stage 3 passthrough, or document the partial-rewrite behavior + add a unit test pinning the mixed-script case so a future reviewer sees the contract. The current test (`reverseSearch.test.ts`) only covers pure-locale and pure-English inputs.

### WR-08: `taskCatalog.i18n.ts` `buildReverseMaps` skips ENGLISH_STOPWORDS filtering on the LOCALIZED side — non-English stopwords pollute tokenMap

**File:** `apps/mobile/src/i18n/taskCatalog.i18n.ts:5287-5297`
**Issue:** The Stage 2 token map is built by iterating English tokens and localized tokens by INDEX (`for (let i = 0; i < enTokens.length; i++)`) and only filters when the ENGLISH side hits `ENGLISH_STOPWORDS`. Once the LLM regen lands and localized names differ from English, the `if (enTokens.length === locTokens.length && enTokens.length > 0)` precondition will frequently fail (different languages tokenize differently — "Cooking a meal" = 3 tokens; "खाना बनाना" = 2 tokens; "Cocinar una comida" = 3 tokens). When it DOES match by chance, the localized stopword (e.g. Spanish "una") gets paired with English "a" and the map records `una → a` — fine. But when English tokens like "or" appear (e.g. "Plating or serving food/drinks") the loop SKIPS them via `ENGLISH_STOPWORDS.has(enTok)` — yet the localized token at the same index (which may be a content word like Spanish "o" or might be "servir") never gets a mapping. So Stage-2 token rewrites will under-cover content words AND the resulting maps will be biased toward English-language-structure tasks. This is a "skeleton-phase OK / post-regen quality issue" finding — the skeleton phase has English on both sides so the lookups are identity and the issue is invisible until the LLM regen completes.
**Fix:** (a) Add a post-regen integration test that runs after `tsx tools/i18n/generate-tasks.ts` to verify token coverage above some threshold; (b) consider switching Stage 2 to use a non-positional alignment (e.g. all combinations) for languages where token-count rarely matches; (c) at minimum, add a code comment warning that Stage-2 hit rate post-regen depends on the LLM choosing language-translations with matching token counts — which is a fragile contract.

## Info

### IN-01: `console.log` calls in SplashScreen.tsx bootstrap path — debug artifacts in production

**File:** `apps/mobile/src/screens/splash/SplashScreen.tsx:91,96,98,110,124,141`
**Issue:** Six `console.log` / `console.warn` calls in the production bootstrap path: `bootstrap_start`, `installation_id_done`, `fetchAppVersion_failed`, `bootstrap_hard_timeout`, `versionResponse=`, `initial_route=`. These run on every cold start of every shipped APK. In release builds Hermes still evaluates console.log args (the call is no-op'd by ProGuard only if the build pipeline strips it explicitly). Phase 7 didn't add these (pre-existing) but they touch the same flow Phase 7's locale gate gates on. Not blocking — Hermes string interpolation is cheap — but they leak the user's `installation_id` and bootstrap timing to logcat.
**Fix:** Gate behind `__DEV__`:

```tsx
if (__DEV__) console.log('[splash] bootstrap_start');
```

Or remove them entirely; the `logEvent('splash_shown')` call on line 90 already provides production telemetry.

### IN-02: `tools/.env.example` example value `sk-ant-...` could be mis-pasted as a real placeholder — add explicit "REPLACE_ME" sentinel

**File:** `tools/.env.example:4`
**Issue:** `ANTHROPIC_API_KEY=sk-ant-...` looks like a real API key prefix. A developer who accidentally `cp tools/.env.example tools/.env` and forgets to fill in their real key gets a 401 from the Anthropic API — fine. But a tool that scans environment files for "anything that looks like a sk-ant-... key" (Detect Secrets, gitleaks) may flag the example file. Compare with `apps/api/.env.example` (not in this scope) which likely uses `CHANGE_ME` placeholders.
**Fix:** Use an obvious placeholder: `ANTHROPIC_API_KEY=REPLACE_WITH_YOUR_KEY` or `ANTHROPIC_API_KEY=sk-ant-REPLACE-ME`.

### IN-03: `i18n.test.ts` "fallback to the key for a missing key" tests `i18n.t('totally.unknown.key' as never)` returns the key — fragile contract

**File:** `apps/mobile/__tests__/i18n/i18n.test.ts:62-68`
**Issue:** The test asserts `expect(i18n.t('totally.unknown.key' as never)).toBe('totally.unknown.key')`. This is the i18next default behavior when both the active catalog AND the fallback catalog (en) have no match — but it depends on `returnNull: false` AND on i18next not introducing a `keySeparator` change that would interpret `'totally.unknown.key'` differently (e.g. as a single literal key with no nesting). A test that pins the fallback-string is brittle to i18next version bumps. Better: add a key that exists ONLY in en (`errors.generic` already works) and test that switching to hi-IN still resolves it via fallback — that's the contract Phase 7 actually relies on.
**Fix:**

```ts
// Replace the missing-key test with a fallback-resolution test:
it('falls back from a locale-specific missing key to the English value', async () => {
  await i18n.changeLanguage('hi-IN');
  // Even if hi-IN doesn't have errors.generic, the en fallback fills it in.
  expect(i18n.t('errors.generic' as never)).toBeTypeOf('string');
  expect(i18n.t('errors.generic' as never)).not.toBe('errors.generic');
});
```

### IN-04: `taskCatalog.test.ts` invariant "every English entry has non-empty description AND >=1 instruction" — but the test doesn't enforce the same on NON-English locales

**File:** `apps/mobile/__tests__/i18n/taskCatalog.test.ts:40-48`
**Issue:** The "non-placeholder gate" test only walks `byLocale.en`. The non-English entries (currently English-skeleton, plan 07-06's regen target) are only checked for shape (`typeof body.name === 'string'`, etc.). If a future regen produces a `hi-IN` entry with `description: ""` or `instructions: []`, no test catches it. The plan-06 regen flow needs THIS file's tests to be the gate.
**Fix:** Extend the loop:

```ts
for (const loc of expected) {
  const body = byLocaleRec[loc];
  // ... existing shape checks
  expect(body.description.length, `${canonical}/${loc} description non-empty`).toBeGreaterThan(0);
  expect(body.instructions.length, `${canonical}/${loc} >=1 instruction`).toBeGreaterThanOrEqual(1);
}
```

### IN-05: `CaptureSessionLivePreviewTest.kt` doesn't exercise the actual CaptureSession integration with the registry — only the registry in isolation

**File:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionLivePreviewTest.kt`
**Issue:** Despite the filename `CaptureSession*Test`, NONE of the 6 test cases instantiate or interact with `CaptureSession`. Every test calls only `LivePreviewSurfaceRegistry` directly. The class-level KDoc on line 18-29 acknowledges that "the fuller test ... requires real Pixel hardware and is the operator's manual walk in `07-MANUAL-SMOKE.md §9` per D-04". That's true for the two-Surface drift A/B, but the JVM unit could still cover (with Robolectric Shadow / fakes) the higher-value invariants: (a) `openCaptureSession` reads `currentSurface()` at call time and constructs the right output list, (b) the registry callbacks fire `setRepeatingRequest` with the right target set, (c) `closeSegmentResources` clears the callbacks BEFORE `captureSession.close()` (the IllegalStateException race protection). Filename is misleading.
**Fix:** Either rename to `LivePreviewSurfaceRegistryTest.kt` (matches its actual scope), or extend the test class to cover at least the callback ordering in close (mockito-kotlin or a `CameraCaptureSession` stub from Robolectric).

### IN-06: `tools/i18n/generate.ts` catches per-locale errors and `continue`s — fail-loud telemetry hidden by `console.error`

**File:** `tools/i18n/generate.ts:94-96,79-87`
**Issue:** When the LLM call fails (network, 5xx, rate limit) the loop catches and `console.error`s, then continues to the next locale. The main() function returns 0 even if 5 of 7 locales failed. CI consumers (`pnpm i18n:generate` in a script) get an exit-0 with a partial catalog set. The shape-parity validator (`tools/i18n/validate.ts`) IS the CI gate, but it runs against EXISTING locale JSONs; a partial generate that wrote 2 of 7 leaves the other 5 stale — and validate.ts doesn't know they're stale.
**Fix:** Track `let failures = 0` in the main loop, and `process.exit(failures > 0 ? 1 : 0)` at the end. This way a partial-failure surfaces in CI and the operator knows to re-run.

### IN-07: `LanguageSheet.tsx` `void i18nDefault.changeLanguage(loc)` — fire-and-forget without catch, unhandled-rejection risk

**File:** `apps/mobile/src/components/LanguageSheet.tsx:57`, `apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx:64`
**Issue:** `void i18n.changeLanguage(pending)` returns a Promise that the comment acknowledges may reject ("if it rejects we still continue to Signup"). The `void` keyword silences TypeScript's no-floating-promises rule but does NOT install a `.catch()` — if the underlying i18next call rejects synchronously OR asynchronously, an unhandled-rejection lands on the global handler. React Native ships with `console.error` + LogBox red-box default; in release builds without an installed handler this propagates to Crashlytics as an unhandled rejection with no useful context. Compare with `pickAndSetLocaleVoice(i18n.language).catch(() => undefined)` (RecordingScreen.tsx:269) which explicitly silences.
**Fix:**

```ts
void i18nDefault.changeLanguage(pending).catch(() => undefined);
```

### IN-08: Two-line magic-number `MAX_TOKENS = 16_000` in `generate.ts` — unmotivated value without "tokens/string" comment math

**File:** `tools/i18n/generate.ts:16`
**Issue:** The inline comment `// ~500 strings × ~30 tokens each` is a math guess that doesn't survive the current en.json (202 leaf keys × ~30 ≈ 6,060 tokens output for English; non-English locales like hi-IN are 2-3× longer due to UTF-8 byte counts in Indic scripts, putting total output at ~12-18K tokens). The 16K ceiling is a single-call budget that's already close to the failure boundary for the larger locales. Move to a more defensive 24K or 32K (Opus 4.7 supports it) and add a comment with the actual math.
**Fix:**

```ts
const MAX_TOKENS = 24_000; // ~202 leaf keys × ~30 tokens (en) × ~2.5x for Indic scripts × 1.5 safety = 22.7K
```

### IN-09: `RecordingScreen.tsx:269` — `pickAndSetLocaleVoice(i18n.language)` reads i18n.language once at mount and never re-resolves on mid-session locale change

**File:** `apps/mobile/src/screens/recording/RecordingScreen.tsx:266-292`
**Issue:** The mount-effect comment at line 263-265 acknowledges this: "Intentionally `[]` deps — we want the locale read ONCE at mount, not on every re-render. A mid-session locale change would not propagate here, but that's an extreme corner case (the user would have to background the app, change locale in Profile, then return mid-recording)." Accurate, but: there's no defense against the case. The user IS allowed to change locale in Profile while a recording is in flight (the Profile picker has no "locked while recording" gate). If they do, the voice cues for the rest of the take will be in the OLD locale. Either lock the locale picker during 'active' recording (good) OR re-subscribe to i18n's `languageChanged` event in the effect (also fine).
**Fix:** Subscribe to i18n events in the effect:

```tsx
useEffect(() => {
  pickAndSetLocaleVoice(i18n.language).catch(() => undefined);
  const onChange = () => pickAndSetLocaleVoice(i18n.language).catch(() => undefined);
  i18n.on('languageChanged', onChange);
  return () => {
    i18n.off('languageChanged', onChange);
  };
}, []);
```

### IN-10: `apps/mobile/src/i18n/index.ts:72` — `as Parameters<typeof i18n.init>[0]` cast hides whether `initImmediate: false` is actually consumed

**File:** `apps/mobile/src/i18n/index.ts:61,72`
**Issue:** Comment on lines 53-60 explains that `initImmediate` is "a valid i18next runtime option but the bundled @types/i18next stripped it from InitOptions a few minor versions back — cast to keep TS clean". The cast `as Parameters<typeof i18n.init>[0]` is a type assertion, not a runtime guarantee. If i18next 26+ silently RENAMES the option (it would, given the typedef drift mentioned) the cast hides the breakage. The test `i18n.test.ts` doesn't assert `i18n.options.initImmediate === false`. A test pinning the resolved runtime config would catch a future i18next upgrade that drops this option.
**Fix:** Add to `i18n.test.ts`:

```ts
it('initImmediate is false (sync first-render guarantee per D-23)', () => {
  expect((i18n.options as { initImmediate?: boolean }).initImmediate).toBe(false);
});
```

### IN-11: `prompts.ts:14-17` — `userPromptFor` instructs the model to "Return the full JSON, nothing else" but generator.ts STILL strips markdown fences as defensive cleanup

**File:** `tools/i18n/prompts.ts:14-17`, `tools/i18n/generate.ts:36-39`
**Issue:** The prompt explicitly tells the model "Return the full JSON, nothing else" but the generator ALSO strips `json ... ` fences. Either the prompt is right and the strip is dead code, or the model regularly disobeys and the prompt is wishful thinking. Both are fine, but a comment should pick one position. If the model regularly disobeys, the prompt could be tightened (e.g. "Do NOT wrap the JSON in markdown code fences. Start your response with the `{` character and end with `}`.").
**Fix:** Either drop the strip if it's truly never needed, OR tighten the prompt:

```ts
return (
  `Translate this catalog to ${localeName}. Keep the JSON structure ` +
  `exactly; translate only the string VALUES. Output ONLY the JSON ` +
  `object — no markdown fences, no prose, no preamble. Start with ` +
  `\`{\` and end with \`}\`.\n\n${JSON.stringify(enCatalog, null, 2)}`
);
```

### IN-12: `tools/i18n/locale-config.ts` ordering — `'pt-BR'` not capitalized but referenced as quoted-key — internal inconsistency

**File:** `tools/i18n/locale-config.ts:1`, `apps/mobile/src/i18n/storage.ts:42-50`
**Issue:** The tool-side `TARGET_LOCALES` array order is `['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']`. The app-side `SUPPORTED_LOCALES` is `['en', 'pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']`. They differ ONLY in `'en'` being skipped on the tool side (correct — we don't LLM-translate English). But there's no enforced relationship between the two arrays: a future addition of `'fr'` to one but not the other would silently slip through. A 5-line cross-validation test (in either codebase) would pin the contract.
**Fix:** Add to either `tools/i18n/__tests__/validate.test.ts` or `apps/mobile/__tests__/i18n/bootstrap.test.ts`:

```ts
it('TARGET_LOCALES is exactly SUPPORTED_LOCALES minus "en"', () => {
  const supported = new Set(SUPPORTED_LOCALES);
  supported.delete('en');
  expect(new Set(TARGET_LOCALES)).toEqual(supported);
});
```

(Requires cross-package import — alternatively, hard-code the expected list at both ends and have ONE place be the source of truth.)

---

## Capture-spec verification

Verified per task #1 from the review brief: the Phase 7 CaptureSession.kt changes do NOT regress drift telemetry, do NOT touch the ultrawide lens code, and do NOT touch the FinalizeWorker cancel gates.

- **Drift telemetry path:** `runPumpLoop` lines 818-869 unchanged — the CAP-08 `seg.videoFrameTimestamps.add(info.presentationTimeUs * 1_000L)` write at line 856 still happens BEFORE `muxer.writeSampleData`. The encoder is always the first output target (line 622).
- **Ultrawide lens code:** `applyRecordingRequestSettings` (lines 731-794) — `CONTROL_ZOOM_RATIO` driven to the lower bound when < 1.0 (line 769-771), AF off + fixed focus (lines 776-792). Unchanged. Applied to both the initial `setRepeatingRequest` (line 645-646) AND the in-session rebuild paths (lines 667, 683) — important: a rebuild that forgot to re-apply these would briefly hunt focus / lose ultrawide routing.
- **Capture-quality cancel gates:** No reference to FinalizeWorker in this diff. The encoder Surface remains the always-present output target across the whole session per the explicit comment at lines 599-619.
- **Two-Surface session lifecycle:** Option B correctly implemented — `previewSurfaceAtConfig` snapshotted at session config (line 620), used in the initial outputs list (lines 621-625), and re-used as the toggle target in the rebuild callbacks (lines 666, 682). NEVER a mid-record `createCaptureSession` reconfigure (Option C), which would drop frames and trip the `mean_fps < 29` cancel gate.

The CR-04 / CR-05 pump-loop teardown ordering (encoder EOS → pumpShouldStop → await latch → release encoder/muxer/surface) is preserved and remains correct — verified at lines 1013-1074.

## i18n shape-parity verification

Verified per task #3 from the review brief. Programmatic walk of all 8 locale JSONs:

| Locale | Leaf keys | Missing vs en | Extra vs en |
| ------ | --------- | ------------- | ----------- |
| en     | 202       | —             | —           |
| pt-BR  | 202       | 0             | 0           |
| es     | 202       | 0             | 0           |
| hi-IN  | 202       | 0             | 0           |
| bn-IN  | 202       | 0             | 0           |
| ta-IN  | 202       | 0             | 0           |
| te-IN  | 202       | 0             | 0           |
| mr-IN  | 202       | 0             | 0           |

The 07-02 LLM generator's `validateShapeParity` did its job — every locale catalog matches the en.json structure exactly.

## Secret hygiene verification

Verified per task #4 from the review brief.

- `tools/.env` is gitignored (`tools/.gitignore:1`).
- `tools/.env.example` carries only the literal placeholder `sk-ant-...` — NOT a valid key (see IN-02 for the cosmetic improvement).
- `tools/i18n/generate.ts` reads the API key from `process.env.ANTHROPIC_API_KEY` only; no fallback string, no hardcoded credential.
- `tools/i18n/generate.ts` resolves filesystem paths via `resolve(import.meta.dirname, '..', '..')` — anchored to the script's own directory, NOT user input. The `localesDir` write target is fixed at `apps/mobile/src/i18n/locales`. No arbitrary file write surface.
- The LLM prompt content is fixed (no user-controlled input fed to the model); prompt-injection risk is therefore the model interpreting CONTENT FROM en.json — which contains only project-controlled English strings written by the project team. Acceptable threat surface.

No secret leaks. No path-traversal vectors. No `eval` / `exec` / `spawn` / arbitrary shell calls in tools/.

---

_Reviewed: 2026-05-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
