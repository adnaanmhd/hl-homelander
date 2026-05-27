# Phase 7: Multi-linguality & Live-Cam Feed — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 32 (24 new, 8 modified)
**Analogs found:** 30 / 32 (2 → no existing analog; use RESEARCH.md code sketches)

The repo has zero prior i18n, so the i18n-runtime new files have only loose analogs (MMKV-instance pattern + provider-mounted-at-App root). The native live-preview view, by contrast, has a near-perfect analog in the gate-camera ViewManager+View+Package+Module quad introduced in the `handgate-never-passes` debug session.

---

## File Classification

### Multi-linguality — i18n runtime + storage + helpers

| New/Modified File                                                            | Role                            | Data Flow             | Closest Analog                                                         | Match Quality |
| ---------------------------------------------------------------------------- | ------------------------------- | --------------------- | ---------------------------------------------------------------------- | ------------- |
| `apps/mobile/src/i18n/index.ts`                                              | runtime-bootstrap               | one-shot init         | (none — first i18n in repo; use RESEARCH §"Pattern 1")                 | no-analog     |
| `apps/mobile/src/i18n/storage.ts`                                            | MMKV-instance + KEYS            | sync read/write       | `apps/mobile/src/state/mmkv.ts` + `apps/mobile/src/state/keys.ts`      | exact         |
| `apps/mobile/src/i18n/errorMap.ts`                                           | utility (lookup table)          | static map            | `apps/mobile/src/services/api.ts` (Record-shaped header builder)       | partial       |
| `apps/mobile/src/i18n/reverseSearch.ts`                                      | utility (transform shim)        | request-transform     | `apps/mobile/src/services/historyGrouping.ts` (table-driven mapper)    | role-match    |
| `apps/mobile/src/i18n/locales/en.json`                                       | catalog                         | static asset          | (none — first catalog)                                                 | no-analog     |
| `apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` | LLM-generated catalog           | static asset          | (none)                                                                 | no-analog     |
| `apps/mobile/src/i18n/taskCatalog.i18n.ts`                                   | static data + reverse-map build | module-load transform | `apps/mobile/src/services/historyGrouping.ts` (MONTH_NAMES + builders) | role-match    |
| `apps/mobile/src/lib/dates.ts`                                               | utility (Intl wrapper)          | pure function         | `apps/mobile/src/lib/durationFormat.ts`                                | exact         |

### Multi-linguality — UI surfaces

| New/Modified File                                                             | Role                   | Data Flow             | Closest Analog                                               | Match Quality                     |
| ----------------------------------------------------------------------------- | ---------------------- | --------------------- | ------------------------------------------------------------ | --------------------------------- |
| `apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx`             | screen (onboarding)    | event→commit→navigate | `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`     | exact (token-only carve-out twin) |
| `apps/mobile/src/components/LanguageSheet.tsx`                                | bottom-sheet component | event→commit→dismiss  | `apps/mobile/src/screens/shared/FilterSheet.tsx` (16a layer) | exact                             |
| `apps/mobile/src/components/LanguageList.tsx` (optional, Claude's discretion) | shared row renderer    | render-only           | `FilterSheet.tsx::Layer16a` row loop                         | exact                             |

### Multi-linguality — modifications to existing files

| Modified File                                                       | Role             | Data Flow                 | Reference / Excerpt source                                                                |
| ------------------------------------------------------------------- | ---------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/mobile/App.tsx`                                               | root component   | bootstrap order           | self (already-existing init: `enableScreens` → `hydrate` → `installBootRecoveryListener`) |
| `apps/mobile/src/navigation/OnboardingStack.tsx`                    | navigation graph | route registration        | self (existing `Stack.Screen` rows + gestureEnabled:false convention)                     |
| `apps/mobile/src/screens/profile/ProfileScreen.tsx` (lines 270-295) | screen           | row insertion             | self (existing "Personal info" section rows + Pressable nav row at 299-310)               |
| `apps/mobile/src/screens/signup/TermsOfUseModal.tsx`                | modal            | bilingual render          | self + `apps/mobile/src/screens/signup/SignupScreen.tsx` consent paragraph                |
| `apps/mobile/src/lib/ttsVoice.ts`                                   | TTS adapter      | extend fallback chain     | self (lines 60-97 — the 3-step chain becomes the 5-step chain)                            |
| `apps/mobile/src/services/tasksApi.ts` (lines 61-73)                | API wrapper      | reverse-map shim          | self (the `searchTasks` body + 5s timeout)                                                |
| `apps/mobile/src/services/telemetryRing.ts`                         | telemetry sink   | append (no schema change) | self (lines 46-52 — `append()` API used as-is)                                            |
| `apps/mobile/src/util/analytics.ts`                                 | event allowlist  | add 2 names               | self (lines 27-111 — extend `EVENT_NAMES` with `locale_chosen`, `locale_changed`)         |

### Live-cam preview — native + JS

| New/Modified File                                                                                       | Role                        | Data Flow          | Closest Analog                                                                                        | Match Quality |
| ------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | ------------- |
| `apps/mobile/src/native/HumynLivePreviewView.tsx` (JS bridge + `<HumynLivePreviewView>` component)      | RN native-component wrapper | view-only          | `apps/mobile/src/native/HumynGateCamera.ts`                                                           | exact         |
| `apps/mobile/src/lib/livePreviewState.ts`                                                               | brightness state machine    | timer-driven state | `apps/mobile/src/screens/recording/RecordingScreen.tsx` lines 240-322 (orientation listener pattern)  | role-match    |
| `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt`        | native view (TextureView)   | Surface lifecycle  | `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraView.kt`        | exact         |
| `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt` | ViewManager                 | view registration  | `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraViewManager.kt` | exact         |
| `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt`      | RN module (Surface publish) | promise-based ops  | `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraModule.kt`      | exact         |
| `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewPackage.kt`     | ReactPackage                | DI registration    | `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraPackage.kt`     | exact         |

### Live-cam preview — modifications to existing files

| Modified File                                                                                          | Role                   | Data Flow                              | Reference / Excerpt source                                               |
| ------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `apps/mobile/src/screens/recording/RecordingScreen.tsx`                                                | screen                 | brightness state machine + tap zone    | self (existing `HumynScreenBrightness.set` calls at 267/387/655/734/867) |
| `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` (line ~48-56)          | DI registration        | add 1 package                          | self (existing `packages.add(HumynGateCameraPackage())` row)             |
| `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` (lines 589-660) | Camera2 session config | extend to 2-Surface (Option B in PLAN) | self (single-Surface analog at lines 599-605)                            |

### Catalog generation tool — `tools/`

| New File                                                        | Role                        | Data Flow       | Closest Analog                                                       | Match Quality |
| --------------------------------------------------------------- | --------------------------- | --------------- | -------------------------------------------------------------------- | ------------- |
| `tools/package.json`                                            | workspace bootstrap         | n/a             | `apps/api/package.json` (Node-side TS)                               | role-match    |
| `tools/tsconfig.json`                                           | build config                | n/a             | `apps/api/tsconfig.json`                                             | role-match    |
| `tools/.env`                                                    | secret storage              | n/a             | `apps/api/.env` (existing pattern; gitignored)                       | exact         |
| `tools/i18n/generate.ts`                                        | offline LLM tool            | one-shot script | (none — first offline tool; use RESEARCH §"Catalog Generation Tool") | no-analog     |
| `tools/i18n/prompts.ts` (vernacular brief + per-locale prompts) | constants                   | static          | n/a                                                                  | no-analog     |
| `tools/i18n/locale-config.ts`                                   | constants (locale ordering) | static          | n/a                                                                  | no-analog     |

### Process / smoke

| New File                                                                | Role    | Data Flow | Closest Analog                                                                       | Match Quality |
| ----------------------------------------------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------ | ------------- |
| `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` | runbook | docs      | `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md` | role-match    |

---

## Pattern Assignments

### `apps/mobile/src/i18n/storage.ts` (NEW — MMKV instance + KEYS)

**Analog:** `apps/mobile/src/state/mmkv.ts` + `apps/mobile/src/state/keys.ts`

**Imports + factory pattern** (`mmkv.ts:1-19` — verbatim shape):

```typescript
/**
 * Single shared MMKV instance for the entire app, encrypted at rest with
 * the same key as Phase 1 auth.ts. NEVER create a second MMKV instance —
 * import this singleton from anywhere that needs persistent state.
 *
 * D-STATE-01.
 *
 * Implementation note: react-native-mmkv v4 (Nitro modules) exports `MMKV`
 * as a TYPE only; the runtime constructor is the `createMMKV` factory.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

export const secureMmkv: MMKV = createMMKV({
  id: 'humyn.secure',
  encryptionKey: 'humyn-mmkv-v1',
});
```

**KEYS constant module pattern** (`keys.ts:1-31`):

```typescript
export const KEYS = {
  AUTH_JWT: 'auth.jwt.v1',
  ONBOARDING_CONSENT: 'onboarding.consent.v1',
  // ...
  TELEMETRY_RING: 'telemetry.ring.v1',
} as const;
```

**Replicate:**

- `createMMKV` factory call (not `new MMKV` — already a known runtime bug per the doc-comment).
- `LOCALE_KEYS = { CODE: 'locale.code', CHOSEN_AT: 'locale.chosen_at' } as const` mirror of the `KEYS` shape.
- Single-instance discipline: export a single `localeMmkv` from this module.

**Diverge:**

- **No encryption** per D-21 (locale is not a secret; only `secureMmkv` carries the encryption key). Use `createMMKV({ id: 'humyn.locale' })` with NO `encryptionKey` field.
- Keys do NOT get a `.v1` suffix per D-21's literal `locale.code` / `locale.chosen_at` — but per Phase 1 versioning convention, planner may add `.v1` for forward compat. Note this in PLAN.

---

### `apps/mobile/src/i18n/index.ts` (NEW — i18n runtime init)

**Analog:** None in repo. Use RESEARCH §"Pattern 1: i18n bootstrap before navigator" (07-RESEARCH.md lines 393-451) verbatim as the skeleton.

**Bootstrap-order analog** (`apps/mobile/App.tsx:33-37`):

```typescript
enableScreens(true);

// Sync hydrate before render — MMKV is sync, Zustand setState is sync.
hydrate();
```

**Replicate the principle:**

- Sync read of MMKV BEFORE render (D-23). `localeMmkv.getString('locale.code')` is synchronous; do it at module top-level so `i18n.init({ lng })` finishes before `<NavigationContainer>` mounts.
- No `useEffect` for the init — must be done in module load order.

**Diverge:**

- Import block needs `i18next`, `react-i18next` (NEW deps per RESEARCH §Standard Stack: `i18next@^26.2.0`, `react-i18next@^17.0.8`).
- Static-import all 8 JSONs (no `i18next-http-backend`; catalogs bundle at build time per D-07).
- Set `compatibilityJSON: 'v4'` explicitly (RESEARCH note — suppresses console warning).
- `useSuspense: false` is the default; don't override it.

---

### `apps/mobile/src/i18n/errorMap.ts` (NEW — code → i18n-key map)

**Analog:** No exact one. The structurally similar table-driven pattern lives in `apps/mobile/src/util/analytics.ts:27-111` (EVENT_NAMES allowlist) and `apps/mobile/src/services/historyGrouping.ts:42-55` (MONTH_NAMES static table).

**Replicate the export shape from `analytics.ts:27`:**

```typescript
export const EVENT_NAMES = [
  // ...
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
const eventSet = new Set<string>(EVENT_NAMES);
```

**Apply to errorMap:**

```typescript
// Plain Record<string,string> per D-34
export const ERROR_TOAST_KEYS: Record<string, string> = {
  AUTH_INVALID_TOKEN: 'errors.auth.invalidToken',
  UPLOAD_QUOTA_EXCEEDED: 'errors.upload.quotaExceeded',
  // ...
};
```

**Diverge:** errorMap is consumed by t() at call sites; no allowlist enforcement needed. Unknown codes fall through to `'errors.generic'` (D-34 contract).

---

### `apps/mobile/src/i18n/reverseSearch.ts` (NEW — 3-stage reverse map)

**Analog:** `apps/mobile/src/services/historyGrouping.ts` (table-driven transform with module-load setup).

**Analog pattern** (`historyGrouping.ts:42-55, 67-89`):

```typescript
// Static table at module load
const MONTH_NAMES = ['January', 'February', /* ... */ 'December'] as const;

export function groupByDay<T extends GroupableRow>(
  rows: T[],
  now: Date = new Date(),
): DaySection<T>[] {
  // Pure function: table lookup + reduction
}
```

**Replicate:**

- Build reverse-maps once at module load (D-15: NOT pre-built JSON, computed from `taskCatalog.i18n.ts`).
- Pure synchronous function with no side effects.

**Code skeleton from RESEARCH.md §"Pattern 3" (lines 495-528) — copy verbatim into the new file**, then wire `TASK_CATALOG_I18N` from `./taskCatalog.i18n.ts`.

**Diverge:**

- Stage 3 (passthrough) — return input as-is when both stages miss. RESEARCH says "let pg_trgm try"; no error logging.
- Use `.normalize('NFC').toLowerCase()` for Indic-script normalization (RESEARCH covers this).

---

### `apps/mobile/src/lib/dates.ts` (NEW — `formatDate(date, locale)`)

**Analog:** `apps/mobile/src/lib/durationFormat.ts` (existing pure formatting helper in the same directory).

**Analog directory contents:**

```
apps/mobile/src/lib/
  buildCaptureOpts.ts
  durationFormat.ts   ← closest analog
  jwtSub.ts
  remoteConfigGate.ts
  ttsVoice.ts
  userDisplayName.ts
```

**Replicate the lib/ convention:**

- One-purpose module, plain functions, no React, no native modules.
- Module-init guard (D-36) at top of file (one-shot Intl availability check).

**Excerpt template from RESEARCH §D-36/D-37 (07-RESEARCH.md):**

```typescript
// Module-init guard per D-36
const HAS_INTL = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined';

export function formatDate(date: Date, locale: string): string {
  if (!HAS_INTL) {
    return date.toLocaleDateString('en-US', { dateStyle: 'medium' } as never);
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    numberingSystem: 'latn', // D-37 — force Latin digits
  }).format(date);
}
```

**Diverge:** The existing call sites (`ProfileScreen.tsx:180` — `toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })`; `HistoryScreen.tsx:108`) get migrated to `formatDate(date, i18n.language)`.

---

### `apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx` (NEW — design carve-out)

**Analog:** `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` (token-only screen with Continue/Next button + Sheet integration + telemetry on mount + `navigation.replace` on Continue).

**Imports + telemetry pattern** (`RigTutorialScreen.tsx:36-77`):

```typescript
import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { Sheet } from '../../ui/primitives/Sheet';
import { colors, spacing } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import { logEvent } from '../../util/analytics';

export default function RigTutorialScreen() {
  const navigation = useNavigation() as unknown as LocalNav;

  // ONB-01 telemetry — single fire on mount.
  useEffect(() => {
    logEvent('rig_tutorial_shown');
  }, []);
```

**Continue-then-replace pattern** (`RigTutorialScreen.tsx:78-92`):

```typescript
const handleNext = () => {
  const googleSub = decodeGoogleSubFromJwt(jwt);
  setTutorialDone(googleSub);
  if (typeof navigation.replace === 'function') {
    navigation.replace('PracticeIntro');
  }
```

**Replicate:**

- Token-only imports (`colors`, `spacing` from `ui/tokens`).
- `ScreenContainer` wrap + `Text` primitive (no hex literals).
- `logEvent` on mount for `locale_chosen` only fires AFTER Continue commits (D-30 + D-22).
- `navigation.replace('Signup')` after commit per D-22 (NOT `navigate`, NOT `push`).

**Diverge:**

- The body is a `FlatList`/`ScrollView` of 8 rows (per D-19 — native name left, English name right, lucide `Check` on selected row), not an illustration + heading + body.
- This is **design carve-out #2** per SPEC I18N-03 + D-20 — document in PLAN.
- Telemetry call wraps two store writes: `localeMmkv.set('locale.code', loc)` + `localeMmkv.set('locale.chosen_at', new Date().toISOString())` + `i18n.changeLanguage(loc)` + `telemetryRing.append({ name: 'locale_chosen', ts: Date.now(), props: { installation_id, chosen_locale: loc } })`.

---

### `apps/mobile/src/components/LanguageSheet.tsx` (NEW — Profile picker)

**Analog:** `apps/mobile/src/screens/shared/FilterSheet.tsx` (the 16a layer — list of options + `Check` icon on selected + `onPress` commits + auto-dismiss).

**Layer 16a row pattern** (`FilterSheet.tsx:194-237`):

```tsx
function Layer16a({
  currentValue,
  onPickNamed,
  onPushCustom,
}: { /* ... */ }): React.JSX.Element {
  return (
    <View accessibilityLabel="filter-sheet-16a">
      <Text variant="bodyLg" style={styles.title16a}>
        Filter by
      </Text>
      {QUICK_OPTIONS.map((opt) => {
        const isSelected = /* ... */ ;
        return (
          <Pressable
            key={opt.value}
            accessibilityLabel={`filter-option-${opt.value}`}
            onPress={() => {
              onPickNamed(opt.value as NamedRange);
              onDismiss();
            }}
            style={styles.optionRow}
          >
            <Text variant="body" style={[styles.optionLabel, /* ... */]}>
              {opt.label}
            </Text>
            {isSelected ? <Check size={20} color={colors.accent} strokeWidth={2} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
```

**FilterSheet's haptic+commit+dismiss flow** (`FilterSheet.tsx:115-126` — verbatim):

```typescript
const handlePickNamed = useCallback(
  (named: NamedRange) => {
    try {
      HapticFeedback.trigger('selection');
    } catch {
      /* haptic best-effort */
    }
    onChange(named);
    onDismiss();
  },
  [onChange, onDismiss],
);
```

**Replicate:**

- Tap-to-commit + auto-dismiss (D-02 verbatim).
- `Check` icon on the selected row (D-19).
- Sibling scrim + sheet body (NOT nested Pressables per FilterSheet's JSDOM bug-fix comment at line 152-157 — important pattern callout).
- Tokens-only (`colors`, `radii`, `spacing` from `ui/tokens`).
- Optional `HapticFeedback.trigger('selection')` on row tap.

**Diverge:**

- Use the existing `Sheet` primitive per D-17 (`apps/mobile/src/ui/primitives/Sheet.tsx`) — not the inline `RNModal` + `RNPressable` of FilterSheet. The `Sheet` primitive wraps the same pattern. (FilterSheet has the inline shape because of the JSDOM-tap-stop-propagation issue; reuse `Sheet` if `LanguageSheet` doesn't share that constraint — verify in PLAN.)
- Two text columns per row (native left, English right), not one.

---

### `apps/mobile/src/native/HumynLivePreviewView.tsx` (NEW — JS bridge)

**Analog:** `apps/mobile/src/native/HumynGateCamera.ts` (exact role match — the native ViewManager-backed component + module triad).

**JS bridge shape** (`HumynGateCamera.ts:33-75`):

```typescript
import { NativeModules, requireNativeComponent, type ViewStyle } from 'react-native';

interface HumynGateCameraNativeModule {
  startGate(): Promise<void>;
  captureFrame(outPath: string): Promise<void>;
  stopGate(): Promise<void>;
}

function ensure(): HumynGateCameraNativeModule {
  const native = NativeModules.HumynGateCamera as HumynGateCameraNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynGateCamera native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/** `true` iff the native module is registered. */
export const isGateCameraAvailable = (): boolean => NativeModules.HumynGateCamera != null;

/** The live gate-camera preview (native TextureView). Mount full-screen behind the gate ring. */
export const HumynGateCameraView = requireNativeComponent<{ style?: ViewStyle }>(
  'HumynGateCameraView',
);
```

**Replicate:**

- `requireNativeComponent<{ style?: ViewStyle }>('HumynLivePreviewView')`.
- `ensure()` guard + canonical "not registered" error message pointing at `MainApplication.kt`.
- `isLivePreviewAvailable()` discriminant — RecordingScreen falls back to "no preview" silently if the module isn't registered (analogous to HAND-08 bypass).

**Diverge per D-25:**

- This view does NOT open a camera client. So its module surface does NOT expose `startGate()` / `captureFrame()` / `stopGate()`. Instead it probably exposes nothing (the Surface is published from the native view directly to `CaptureSession.kt`, see Option B in RESEARCH §"Surface-source A/B"). Module may exist only for symmetry / registration; the heavy lifting is in the view + CaptureSession.
- Style prop pass-through only — same `<HumynLivePreviewView style={StyleSheet.absoluteFill} />` mount pattern.

---

### `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewView.kt` (NEW)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraView.kt` (exact role match — Camera2-fed TextureView with Matrix transform).

**TextureView + SurfaceTexture publish pattern** (`HumynGateCameraView.kt:44-87`):

```kotlin
class HumynGateCameraView(context: Context) : TextureView(context), TextureView.SurfaceTextureListener {

    private var surface: Surface? = null
    private val previewSize = Size(1280, 720)

    init {
        surfaceTextureListener = this
        if (isAvailable) {
            surfaceTexture?.let { onSurfaceTextureAvailable(it, width, height) }
        }
    }

    override fun onSurfaceTextureAvailable(st: SurfaceTexture, width: Int, height: Int) {
        st.setDefaultBufferSize(previewSize.width, previewSize.height)
        configureTransform(width, height)
        val s = Surface(st)
        surface = s
        GateCameraController.onPreviewSurfaceAvailable(s)
    }

    override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
        GateCameraController.onPreviewSurfaceDestroyed(surface)
        surface?.release()
        surface = null
        return true
    }
```

**Matrix transform pattern** (`HumynGateCameraView.kt:98-121` — the standard "rotate-to-upright + center-crop fill" landscape-locked transform): **copy verbatim** — Phase 7 records on the same ultrawide; the same SENSOR_ORIENTATION = 90 transform applies.

**Replicate:**

- `TextureView` + `SurfaceTextureListener` shape, identical.
- `previewSize = Size(1280, 720)` (any back camera supports this; exact resolution is operator-only).
- `configureTransform(viewWidth, viewHeight)` verbatim.
- `displayRotation()` helper verbatim.
- Surface release on `onSurfaceTextureDestroyed`.

**Diverge per D-25:**

- DO NOT open a camera client. Instead, on Surface-available, publish to a static slot (`LivePreviewSurfaceRegistry.onSurfaceAvailable(s)`) that `CaptureSession.kt` reads when Option B is selected (PLAN choice).
- New class name + new ViewManager registration name (`HumynLivePreviewView`).
- The GateCameraController equivalent is a `LivePreviewSurfaceRegistry` (or similar) — just a Surface-slot holder, NOT a Camera2 session owner.

---

### `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewViewManager.kt` (NEW)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraViewManager.kt` (exact — SimpleViewManager with REACT_CLASS const + no-op `@ReactProp` to silence the codegen warning).

**Verbatim shape** (`HumynGateCameraViewManager.kt:18-55`):

```kotlin
class HumynGateCameraViewManager : SimpleViewManager<HumynGateCameraView>() {

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): HumynGateCameraView =
        HumynGateCameraView(reactContext)

    /**
     * No-op prop. The view genuinely has no settable props ... but a ViewManager
     * with zero @ReactProp setters makes RN's ViewManagersPropertyCache log a
     * "Could not find generated setter" warning on every mount. Declaring one
     * harmless setter silences that benign warning (Phase-4 04-COSMETIC-GAPS).
     */
    @Suppress("UNUSED_PARAMETER")
    @ReactProp(name = "gateActive", defaultBoolean = false)
    fun setGateActive(view: HumynGateCameraView, active: Boolean) {
        // intentionally empty — camera lifecycle is module-driven, not prop-driven
    }

    override fun onDropViewInstance(view: HumynGateCameraView) {
        GateCameraController.onPreviewSurfaceDestroyed(null)
        super.onDropViewInstance(view)
    }

    companion object {
        const val REACT_CLASS = "HumynGateCameraView"
    }
}
```

**Replicate verbatim** (rename to `HumynLivePreviewViewManager` / `HumynLivePreviewView` / `REACT_CLASS = "HumynLivePreviewView"`).

**Diverge:** The no-op `@ReactProp` keeps that codegen workaround; rename `gateActive` → e.g. `previewActive` (cosmetic; still a no-op).

---

### `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewPackage.kt` (NEW)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraPackage.kt` (exact — ReactPackage that returns both a NativeModule and a ViewManager).

**Verbatim shape** (`HumynGateCameraPackage.kt:16-22`):

```kotlin
class HumynGateCameraPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(HumynGateCameraModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(HumynGateCameraViewManager())
}
```

**Replicate verbatim** (rename to `HumynLivePreviewPackage`, swap module + view-manager names).

---

### `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/livepreview/HumynLivePreviewModule.kt` (NEW)

**Analog:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraModule.kt`.

**`@ReactModule` + `getName()` + `@ReactMethod` shape** (`HumynGateCameraModule.kt:28-47`):

```kotlin
@ReactModule(name = HumynGateCameraModule.NAME)
class HumynGateCameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynGateCamera"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun startGate(promise: Promise) {
        GateCameraController.start(reactApplicationContext) { result ->
            result.fold(
                onSuccess = { promise.resolve(null) },
                onFailure = { promise.reject("GATE_CAMERA_START_FAILED", it.message, it) },
            )
        }
    }
```

**Replicate the module-registration boilerplate.**

**Diverge per D-25:** The module body is mostly empty / contains query-only methods (e.g. `isAvailable(promise)` returning boolean, or none at all). Per D-25, the view does NOT open a camera — Surface lifecycle is driven by the view's `onSurfaceTextureAvailable`/`Destroyed` callbacks pushing into the registry, and `CaptureSession.kt` reads from that registry directly. The module exists for registration symmetry; planner decides if it has any methods at all.

---

### `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` (MODIFY — add 1 package)

**Self-analog at lines 48-54** (existing `packages.add(...)` lines):

```kotlin
packages.add(HumynGateCameraPackage())       // debug handgate-never-passes — native Camera2 pre-record-gate camera + preview (replaces VisionCamera)
packages.add(HumynHandDetectorPackage())     // Plan 04-02 — HAND-01 pre-record hand gate (MediaPipe; body in 04-04)
packages.add(HumynPhoneStatePackage())       // Plan 04-02 — AudioManager focus-loss interruption signal (body in 04-05)
packages.add(HumynBatteryPackage())          // Plan 04-02 — battery level/charging signal (body in 04-05)
packages.add(HumynScreenBrightnessPackage()) // Plan 04-02 — REC-08 per-window brightness (body in 04-05)
```

**Replicate:** Add `packages.add(HumynLivePreviewPackage())  // Phase 7 — REC-LIVE-13/14 live ultrawide preview during record (no camera client; shares CaptureSession Surface)`. Also add the import line at the top (`import ai.humynlabs.capture.livepreview.HumynLivePreviewPackage`).

---

### `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` (MODIFY — Surface-source per PLAN's choice)

**Self-analog at lines 589-660** (the single-output `openCaptureSession` body):

```kotlin
private fun openCaptureSession(
    cam: CameraDevice,
    surface: Surface,
    mgr: CameraManager,
): CameraCaptureSession {
    val latch = CountDownLatch(1)
    var session: CameraCaptureSession? = null
    var sessionError: Throwable? = null

    @Suppress("DEPRECATION")
    cam.createCaptureSession(
        listOf(surface),
        object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(s: CameraCaptureSession) {
                try {
                    val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
                    builder.addTarget(surface)
                    /* zoom + AF + OIS setters... */
```

**Replicate:**

- Same `CaptureSession.StateCallback` shape + `addTarget` + `CountDownLatch` synchronization.

**Diverge — depends on PLAN's Surface-source choice (D-24, REC-LIVE-19, no owner steer):**

- **Option A (share encoder Surface via SurfaceTexture splitter)**: minimal CaptureSession diff; the encoder Surface goes through an intermediate SurfaceTexture that splits to both encoder + preview. Risk: SurfaceTexture copy may add drift.
- **Option B (LEADING per RESEARCH)**: change `createCaptureSession(listOf(surface), …)` to `createCaptureSession(listOf(encoderSurface, previewSurface), …)`. Conditionally `builder.addTarget(previewSurface)` only when the preview is visible (15-s + 10-s windows). The preview Surface comes from `LivePreviewSurfaceRegistry.currentSurface()`.
- **Option C (mid-record reconfigure)**: highest implementation risk; PLAN measures drift A/B for each option (per D-04: `(p99_on − p99_off) / p99_off < 0.50`).

**RESEARCH §"System Architecture Diagram" (07-RESEARCH.md lines 288-307)** has the three-option diagram. The A/B drift measurement IS the deciding gate per D-04 — planner reads p99 from `metadata.json` for two same-day 10-min segments (one off, one on).

**HEVC Encoder analog at `HevcEncoder.kt:86-93`** stays unchanged for Option B:

```kotlin
fun configure(): Pair<MediaCodec, Surface> {
    val format = buildMediaFormat()
    val codec = MediaCodec.createEncoderByType(MIME)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val inputSurface = codec.createInputSurface()
    codec.start()
    return codec to inputSurface
}
```

For Option B, the encoder's `inputSurface` is one of the two targets passed to `createCaptureSession`; the preview Surface is the second. No change to HevcEncoder.

---

### `apps/mobile/src/screens/recording/RecordingScreen.tsx` (MODIFY — brightness state machine + tap zone)

**Self-analog:** existing brightness calls at lines 267, 387, 655, 734, 867 (the `set(-1)` restores) and 655 (the `set(0.05)` dim). The new state machine wraps these.

**Existing brightness call sites** (verbatim):

```typescript
// Line 267 (in cleanup on unmount):
HumynScreenBrightness.set(-1).catch(() => undefined);

// Line 387 (in handleStop):
await HumynScreenBrightness.set(-1).catch(() => undefined);

// Line 655 (after gate exit, dropping to 5% before HumynCapture.start):
await HumynScreenBrightness.set(0.05).catch(() => undefined);

// Line 734 + 867: on-stop / on-failed-start restorers
await HumynScreenBrightness.set(-1).catch(() => undefined);
```

**Tap-zone z-stack pattern — from RESEARCH §"Pattern 2" (07-RESEARCH.md lines 458-489) — copy verbatim:**

```tsx
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

**Timer-reset useRef pattern** (D-29) — direct from RESEARCH:

```typescript
const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

const handleTapReveal = useCallback(() => {
  // 1. cancel any pending fade timer
  if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  // 2. restore brightness
  HumynScreenBrightness.set(-1).catch(() => undefined);
  // 3. render preview
  setBrightnessState('tap-revealed');
  // 4. start fresh 10-s timer
  fadeTimerRef.current = setTimeout(() => {
    HumynScreenBrightness.set(0.05).catch(() => undefined);
    setBrightnessState('dimmed');
  }, 10_000);
}, []);
```

**Replicate:**

- Wrap the existing `set(0.05)` at line 655 with a new "after Start" state-machine entry (initial-preview, 15s) that defers the `set(0.05)` call until t=15s.
- The existing `set(-1)` restorers at 267/387/734/867 stay as-is (on-stop / on-unmount / on-failed-start) — those are correct behavior unchanged per REC-LIVE-15.
- Lifecycle effect cleanup must also `clearTimeout(fadeTimerRef.current)`.

**Diverge per D-05:** Practice flow render: the existing practice-instructional copy must NOT render during the 15-s initial preview (full-screen preview only). Add a substate gate in the practice-copy render block.

**Existing existing-pattern reference for `useEffect` cleanup** (`RecordingScreen.tsx:254-281`):

```typescript
useEffect(() => {
  dfovMeasuredDeg.current = readCompatUltrawideDfovDeg();
  appVersionRef.current = readAppVersion();
  pickAndSetEnInVoice().catch(() => undefined);
  Orientation.lockToLandscape();
  return () => {
    Orientation.unlockAllOrientations();
    HumynScreenBrightness.set(-1).catch(() => undefined);
    // ... existing cleanup
  };
}, []);
```

The fade-timer cleanup adds a `clearTimeout(fadeTimerRef.current)` to this return block.

---

### `apps/mobile/src/lib/ttsVoice.ts` (MODIFY — extend 3-step to 5-step chain)

**Self-analog at lines 60-97** (the existing `pickAndSetEnInVoice`):

```typescript
export async function pickAndSetEnInVoice(): Promise<void> {
  await Tts.getInitStatus();

  let voices: TtsVoice[] = [];
  try {
    voices = ((await Tts.voices()) as TtsVoice[]) ?? [];
  } catch {
    voices = [];
  }
  const usable = voices.filter((v) => !v.notInstalled);

  const id =
    usable.find((v) => v.language === 'en-US' && looksFemale(v))?.id ?? // 1. en-US female-ish
    usable.find((v) => v.language === 'en-US')?.id ?? // 2. any en-US
    usable.find((v) => (v.language ?? '').toLowerCase().startsWith('en'))?.id; // 3. first en-*

  try {
    await Tts.setDefaultLanguage('en-US');
  } catch {
    /* best-effort */
  }
  if (id) {
    try {
      await Tts.setDefaultVoice(id);
    } catch {
      /* best-effort */
    }
  }

  Tts.setDefaultRate(1.0, true);
  Tts.setDefaultPitch(0.95);
}
```

**Replicate the structure:**

- `await Tts.getInitStatus()` guard at top.
- `Tts.voices()` + `notInstalled` filter.
- Best-effort try/catch around every Tts call.
- `Tts.setDefaultRate(1.0, true)` + `Tts.setDefaultPitch(0.95)` at the bottom (do NOT touch — these are owner-locked).

**Diverge per D-31 — extend the chain:**

```typescript
// new function signature accepts the active locale (or reads i18n.language inside)
export async function pickAndSetLocaleVoice(activeLocale: string): Promise<void> {
  await Tts.getInitStatus();
  /* voices read */
  const usable = voices.filter((v) => !v.notInstalled);

  // Pin to the active locale first (NOT en-US — except when locale is 'en', in which case the OWNER DEVIATION en-US pin is preserved).
  const langTag = activeLocale === 'en' ? 'en-US' : activeLocale;
  try {
    await Tts.setDefaultLanguage(langTag);
  } catch {
    /* best-effort */
  }

  const id =
    usable.find((v) => v.language === activeLocale && looksFemale(v))?.id ?? // 1. locale female-ish
    usable.find((v) => v.language === activeLocale)?.id ?? // 2. any locale voice
    usable.find((v) => v.language === 'en-US' && looksFemale(v))?.id ?? // 3. en-US female (owner-preferred)
    usable.find((v) => v.language === 'en-US')?.id ?? // 4. any en-US
    usable.find((v) => (v.language ?? '').toLowerCase().startsWith('en'))?.id; // 5. first en-*

  if (id) {
    try {
      await Tts.setDefaultVoice(id);
    } catch {
      /* best-effort */
    }
  }

  // Crashlytics breadcrumb on fallback (steps 3+) per D-31:
  const fellBack = !usable.find((v) => v.language === activeLocale);
  if (fellBack) {
    // crashlytics().log('tts_locale_fallback');
    // crashlytics().setAttributes({ locale: activeLocale, fallback: 'true' });
  }

  Tts.setDefaultRate(1.0, true); // owner-locked
  Tts.setDefaultPitch(0.95); // owner-locked
}
```

**Important:** Keep `pickAndSetEnInVoice` as an export per D-31 ("the existing `EnIn` symbol-name choice stays for import-call stability") — make it call `pickAndSetLocaleVoice('en')` so the import sites in RecordingScreen (`pickAndSetEnInVoice().catch(...)` at line 258) don't change.

---

### `apps/mobile/src/services/tasksApi.ts` (MODIFY — reverse-map shim at lines 61-73)

**Self-analog at lines 61-73** (the existing `searchTasks`):

```typescript
export async function searchTasks(
  q: string,
  args: SearchTasksArgs = {},
): Promise<TasksSearchResponse> {
  const query: Record<string, string> = { q };
  if (args.category) query.category = args.category;
  if (args.setting) query.setting = args.setting;
  if (args.limit !== undefined) query.limit = String(args.limit);
  return apiClient.getJson<TasksSearchResponse>('/tasks/search', {
    query,
    timeoutMs: 5_000,
  });
}
```

**Replicate:** Keep the existing surface (parameters, return type, 5-s timeout) — do NOT change the call signature.

**Diverge per D-14, D-15, D-16:**

```typescript
import { reverseSearch } from '../i18n/reverseSearch';
import i18n from '../i18n';

export async function searchTasks(
  q: string,
  args: SearchTasksArgs = {},
): Promise<TasksSearchResponse> {
  // D-14 — reverse-map locale input to canonical English before the network call.
  // Stage 1 → full-string lookup; Stage 2 → token-fallback; Stage 3 → passthrough.
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

The 200-ms debounce in `useTaskSearch` (lines 97-131) does NOT change — the reverse-map runs inside the same call.

---

### `apps/mobile/src/services/telemetryRing.ts` (USE AS-IS — no schema change per D-30)

**Self-analog at lines 22-62** (the existing API):

```typescript
export interface TelemetryEvent {
  name: string;
  ts: number; // epoch ms
  props: Record<string, string | number | boolean>;
}

export const telemetryRing = {
  append(event: TelemetryEvent): void {
    const arr = read();
    arr.push(event);
    if (arr.length > RING_CAP) arr.splice(0, arr.length - RING_CAP);
    write(arr);
  },
  // ...
};
```

**Replicate (use as-is):** Phase 7 makes ZERO changes to this file (D-30 verbatim). The new events `locale_chosen` / `locale_changed` flow through `telemetryRing.append(...)` directly.

**Modify `apps/mobile/src/util/analytics.ts:27-111`** instead — extend the `EVENT_NAMES` allowlist to include `'locale_chosen'` and `'locale_changed'`. Otherwise `logEvent('locale_chosen', ...)` is dropped with a `[analytics] event 'locale_chosen' not in EVENT_NAMES allowlist; dropped` dev warning (analytics.ts:137).

---

### `apps/mobile/src/screens/signup/TermsOfUseModal.tsx` (MODIFY — bilingual render per D-32)

**Self-analog at lines 41-69** (the existing modal body):

```tsx
export function TermsOfUseModal({ visible, onClose }: TermsOfUseModalProps) {
  return (
    <Modal
      visible={visible}
      title="Terms of Use"
      onDismiss={onClose}
      accessibilityLabel="Terms of Use modal"
      actions={/* ... */}
    >
      <ScrollView style={{ maxHeight: 400 }}>
        <Text
          variant="body"
          tone="primary"
          accessibilityLabel="Terms of Use body"
          style={{ marginBottom: spacing.l }}
        >
          {TERMS_OF_USE_TEXT}
        </Text>
      </ScrollView>
    </Modal>
  );
}
```

**`TERMS_OF_USE_TEXT` constant at lines 28-34** stays VERBATIM in the file (it's the immutable canonical English per the file's IMMUTABLE warning at lines 1-13 — that warning STAYS) — it gets used as the English underlay AND continues to be the hash basis for the server-side consent record (D-33).

**Diverge per D-32:**

```tsx
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

export function TermsOfUseModal({ visible, onClose }: TermsOfUseModalProps) {
  const { t } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const translatedBody = t('terms.consent.body');
  // English underlay loaded via getFixedT regardless of active locale (D-32):
  const englishUnderlay = i18n.getFixedT('en')('terms.consent.body');

  return (
    <Modal /* ... */ title={t('terms.consent.modalTitle')}>
      <ScrollView style={{ maxHeight: 400 }}>
        <Text
          variant="body"
          tone="primary"
          accessibilityLabel="Terms of Use body"
          style={{ marginBottom: spacing.l }}
        >
          {translatedBody}
        </Text>
        {!isEnglish && (
          <Text
            variant="caption" // smaller font step
            tone="secondary"
            style={{ marginBottom: spacing.l, opacity: 0.7 }} // ~70% opacity per D-32
            accessibilityLabel="Terms of Use English underlay"
          >
            {englishUnderlay}
          </Text>
        )}
      </ScrollView>
    </Modal>
  );
}
```

**Important:** The `TERMS_OF_USE_TEXT` constant remains as the canonical hash source per D-33 — the server-side `consent_text_version` POST payload uses this constant; the on-screen English underlay uses `i18n.getFixedT('en')('terms.consent.body')` for catalog-consistency (the catalog's `en.json` MUST contain the same byte sequence). Planner verifies the catalog `en.json` value matches `TERMS_OF_USE_TEXT` byte-for-byte.

---

### `apps/mobile/src/screens/profile/ProfileScreen.tsx` (MODIFY — insert Language row above Help Center)

**Self-analog at lines 297-310** (the existing "Help Center" Pressable row):

```tsx
{/* Actions — PROF-04 */}
<View style={styles.section}>
  <Pressable
    style={styles.row}
    onPress={() => nav.navigate('HelpCenter')}
    accessibilityLabel="profile-action-help"
  >
    <Text variant="body" style={styles.fieldLabel}>
      Help Center
    </Text>
    <Text variant="body" tone="tertiary">
      ›
    </Text>
  </Pressable>
```

**Replicate:** Insert a new `Pressable` with the same styling structure, IMMEDIATELY BEFORE the Help Center row, per SPEC I18N-04. Wire `onPress` to open `LanguageSheet` (component-state visible boolean).

```tsx
<Pressable
  style={styles.row}
  onPress={() => setLanguageSheetVisible(true)}
  accessibilityLabel="profile-action-language"
>
  <Text variant="body" style={styles.fieldLabel}>
    {t('profile.language.row.label')}
  </Text>
  <Text variant="body" tone="tertiary">
    {/* current locale's native name (e.g. 'हिन्दी') */}
    {LOCALE_NATIVE_NAMES[i18n.language] ?? 'English'} ›
  </Text>
</Pressable>
```

Existing date render at line 180 (`new Date(me.createdAt).toLocaleDateString('en-US', ...)`) gets migrated to `formatDate(new Date(me.createdAt), i18n.language)` per I18N-09 / D-37.

---

### `apps/mobile/App.tsx` (MODIFY — bootstrap i18n before navigator)

**Self-analog at lines 33-37** (the existing top-of-module init):

```typescript
enableScreens(true);

// Sync hydrate before render — MMKV is sync, Zustand setState is sync.
hydrate();
```

**Replicate:** Add a third sync init step BEFORE the `App` component renders:

```typescript
import './src/i18n'; // side-effect: reads localeMmkv and runs i18n.init({ lng })
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';

enableScreens(true);
hydrate();
// i18n.init runs as a side effect of the './src/i18n' import above.
```

Then wrap `<NavigationContainer>` in `<I18nextProvider i18n={i18n}>` per D-23 + RESEARCH §"Provider Placement" (placement: immediately inside `<SafeAreaProvider>`, around `<NavigationContainer>`).

Existing in-effect installers (`installBootRecoveryListener`, `installUploadReconcile`) stay unchanged.

---

### `apps/mobile/src/navigation/OnboardingStack.tsx` (MODIFY — insert ChooseLanguage between Splash and Signup)

**Self-analog at lines 29-43** (the existing stack body):

```tsx
export default function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
```

**Replicate:** Insert `<Stack.Screen name="ChooseLanguage" component={ChooseLanguageScreen} />` between Splash and Signup. Existing `gestureEnabled: false` covers the "no back gesture" requirement from SPEC I18N-02 / D-22 implicitly.

**Per D-22:** The render gate (`localeMmkv.contains('locale.chosen_at') === false`) is NOT a Stack.Screen guard — it's the `initialRouteName` logic in `computeInitialRoute` (planner identifies). If the gate fails (already chosen), `computeInitialRoute` skips `ChooseLanguage` and lands on `Signup` or the next route.

---

### `apps/mobile/src/i18n/locales/en.json` (NEW — source of truth)

**No code analog** — this is the first translation catalog in the repo.

**Per D-07 + D-08, shape:**

```json
{
  "common": { "continue": "Continue", "cancel": "Cancel", "save": "Save" },
  "onboarding": {
    "chooseLanguage": {
      "title": "Choose your language",
      "continueButton": "Continue"
    }
  },
  "profile": {
    "language": {
      "row": { "label": "Language" },
      "picker": { "title": "Select language" }
    }
  },
  "recording": {
    "preview": { "live": "Live preview" }
  },
  "terms": {
    "consent": { "body": "I consent and agree to upload videos ..." }
  },
  "errors": {
    "generic": "Something went wrong",
    "auth": { "invalidToken": "Please sign in again" }
  }
}
```

**Author by hand** by sweeping every hardcoded UI string across the 22 existing screens + ChooseLanguageScreen. Anti-pattern per RESEARCH lines 530-538: do NOT let the LLM generate `en.json`.

---

### `apps/mobile/src/i18n/locales/{pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` (NEW — LLM-generated)

**No code analog.** Generated by `tools/i18n/generate.ts`. Per D-12, add an audit metadata block (separate `.audit.json` sidecar — JSON can't carry comments) recording `{ model, generated_at, brief_version, en_source_sha }`.

---

### `apps/mobile/src/i18n/taskCatalog.i18n.ts` (NEW — 65 tasks × 8 locales + reverse maps)

**Closest analog:** `apps/mobile/src/services/historyGrouping.ts:42-89` (static table + module-load derived structure).

**Source of truth:** `task-taxonomy.md` (the 65-task catalog, per `07-CONTEXT.md` canonical refs).

**Shape per D-01 + D-15:**

```typescript
// Full-body translation per D-01 (name + description + instructions + examples)
export const TASK_CATALOG_I18N: Record<string, Record<string, {
  name: string;
  description: string;
  instructions: string[];
  examples: string[];
}>> = {
  'Make tea': {
    'en': { name: 'Make tea', description: '...', instructions: [...], examples: [...] },
    'hi-IN': { name: 'चाय बनाओ', description: '...', instructions: [...], examples: [...] },
    /* ... other 6 locales ... */
  },
  /* ... 64 more tasks ... */
};

// Reverse-map derived at module-load time per D-15.
// Consumed by reverseSearch.ts.
export const REVERSE_BY_LOCALE: Record<string, { fullStringMap: Record<string, string>; tokenMap: Record<string, string> }> = buildReverseMaps(TASK_CATALOG_I18N);
```

---

### `tools/i18n/generate.ts` + `tools/package.json` + `tools/tsconfig.json` + `tools/.env`

**No exact codebase analog** — first offline Node tool at repo root.

**Use `apps/api/`'s shape as a loose template:**

- `tools/package.json` — Node 22+ shape; deps `@anthropic-ai/sdk@^0.98.0` + `zod@^4.4.3`; devDeps `typescript@^5.6.3` + `tsx@^4.0.0` (RESEARCH §"Installation").
- `tools/tsconfig.json` — Node module resolution (`"moduleResolution": "nodenext"`, `"target": "es2022"`).
- `tools/.env` — gitignored, contains only `ANTHROPIC_API_KEY=...`. Add `tools/.env` to repo root `.gitignore`.
- `tools/i18n/generate.ts` — full skeleton in RESEARCH §"Catalog Generation Tool" (07-RESEARCH.md lines 649-702), including the verbatim D-10 vernacular brief.

---

### `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md`

**Analog:** `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md` (Phase 4 manual smoke runbook — section structure: setup, hardware-required tests, per-walk checklists).

**Replicate the §-numbered walk structure** (each acceptance-criteria checkbox → a §-numbered manual walk with concrete steps).

**Phase-7-specific walks** to include:

- §1 — i18n bootstrap on fresh install (ChooseLanguageScreen renders / MMKV-gate persists / re-launch skips).
- §2 — Profile Language picker (8 walks, one per locale).
- §3 — Bilingual consent rendering (1 walk in each non-English locale).
- §4 — Per-locale TTS on Pixel 10a (7 walks — fallback case included).
- §5 — Date formatting + Latin numerals (hi-IN + pt-BR + ta-IN).
- §6 — Reverse-search task query (1 walk per non-English locale).
- §7 — Live-cam preview 15-s initial (real + practice flows).
- §8 — Tap-reveal rolling 10-s + Stop button hit-test in all 3 states.
- §9 — **A/B drift smoke** (D-04) — two same-device same-day 10-min segments (preview off then on), extract `imu_video_drift_p99_ms` from each `metadata.json`, compute `(p99_on − p99_off) / p99_off`, gate at < 0.50.
- §10 — Capture-quality cancel re-verification (forced-low-fps + forced-low-res + insufficient-frames; cancel still fires regardless of preview).
- §11 — Renumber sweep grep gate.

---

## Shared Patterns

### Telemetry-ring event emission

**Source:** `apps/mobile/src/services/telemetryRing.ts:46-52` (the `append()` API) + `apps/mobile/src/util/analytics.ts:131-153` (the `logEvent()` wrapper).

**Apply to all locale events (D-30):**

```typescript
// Through the existing logEvent wrapper (preferred; gives PII-allowlist enforcement):
logEvent('locale_chosen', { installation_id, chosen_locale: loc });
logEvent('locale_changed', { installation_id, from_locale, to_locale });
```

Prereq: extend `EVENT_NAMES` in `analytics.ts:27-111` to include both names, otherwise `logEvent` drops them silently in release (dev warning logged).

---

### Best-effort native-module guard

**Source:** `apps/mobile/src/native/HumynGateCamera.ts:44-55`:

```typescript
function ensure(): HumynGateCameraNativeModule {
  const native = NativeModules.HumynGateCamera as HumynGateCameraNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynGateCamera native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

export const isGateCameraAvailable = (): boolean => NativeModules.HumynGateCamera != null;
```

**Apply to** `HumynLivePreviewView.tsx` (if a module exists) AND to any TTS / Brightness / Crashlytics native-module call inside `ttsVoice.ts`'s extended fallback chain — every native call already wraps in `try { ... } catch { /* best-effort */ }`.

---

### Token-only styling (NO hex literals)

**Source:** `apps/mobile/src/ui/tokens.ts` + `apps/mobile/src/screens/shared/FilterSheet.tsx` (the `styles` object at lines 387-494 uses ONLY `colors.*`, `radii.*`, `spacing.*`, `typography.*`).

**Apply to:**

- `ChooseLanguageScreen.tsx` (design carve-out #2 — D-20 + SPEC I18N-03).
- `LanguageSheet.tsx` (composes `Sheet` + `Check` icon from lucide).
- Live-cam tap-zone overlay + eye-icon container (`Pressable` style + `View` for the eye-icon corner).

The plan-checker has a no-hex gate (referenced in FilterSheet:392 comment `// rgba — allowed by no-hex gate (no '#')`) — only `rgba(...)` literals are permitted; everything else must be a token reference.

---

### `tools/.env` discipline

**Source:** `apps/api/.env` (referenced indirectly in memory `feedback_post_merge_test_env.md`: `set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test`).

**Apply to:**

- Create `tools/.env` ONLY with `ANTHROPIC_API_KEY=`.
- Add `tools/.env` to the repo root `.gitignore`.
- Reference in PLAN: setup step is "create `tools/.env` from a Claude API key".

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md skeletons instead):

| File                                  | Role                         | Reason             | RESEARCH §-anchor                                                      |
| ------------------------------------- | ---------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `apps/mobile/src/i18n/index.ts`       | i18n runtime bootstrap       | First i18n in repo | RESEARCH §"Pattern 1: i18n bootstrap before navigator" (lines 393-451) |
| `apps/mobile/src/i18n/locales/*.json` | translation catalogs         | First catalog      | RESEARCH §"Repository Layout" (lines 339-389) — directory only         |
| `tools/i18n/generate.ts`              | offline LLM generator        | First offline tool | RESEARCH §"Catalog Generation Tool" (lines 649-702) — full skeleton    |
| `tools/i18n/prompts.ts`               | constants (vernacular brief) | First              | RESEARCH §"Prompt Skeleton" (lines 649-661)                            |
| `tools/i18n/locale-config.ts`         | constants (locale ordering)  | First              | D-18 + RESEARCH §"Standard Stack" (locale list)                        |

---

## Metadata

**Analog search scope:**

- `apps/mobile/src/native/` (RN JS bridges)
- `apps/mobile/src/services/` (telemetryRing, tasksApi, api)
- `apps/mobile/src/lib/` (ttsVoice, durationFormat)
- `apps/mobile/src/state/` (mmkv, keys)
- `apps/mobile/src/screens/{tutorial,shared,signup,profile,recording}/` (UI analogs)
- `apps/mobile/src/ui/primitives/` (Sheet)
- `apps/mobile/src/util/analytics.ts` (event allowlist)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/` (native quad — strongest live-preview analog)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/` (CaptureSession + HevcEncoder)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`

**Files scanned:** ~30 files (Kotlin + TypeScript).

**Pattern extraction date:** 2026-05-24.

---

## PATTERN MAPPING COMPLETE

**Phase:** 7 - Multi-linguality & Live-Cam Feed
**Files classified:** 32 (24 new, 8 modified)
**Analogs found:** 30 / 32

### Coverage

- Files with exact analog: 18
- Files with role-match analog: 10
- Files with partial analog: 2
- Files with no analog: 2 (i18n runtime + LLM tool — RESEARCH.md skeletons cover them)

### Key Patterns Identified

- Hand-rolled native module **quad** (Package + Module + ViewManager + View) — the gate-camera quad is the verbatim template for the live-preview quad; only the Surface-source diverges (per PLAN's Option B leading hypothesis).
- MMKV **non-secure instance** for non-secret state (locale.code / locale.chosen_at) — new `localeMmkv` mirrors `secureMmkv` shape but drops the `encryptionKey` field.
- **Token-only screens** with explicit `// — verbatim §X` design-citation header (RigTutorialScreen pattern) — ChooseLanguageScreen is design carve-out #2 with the same convention.
- **Bottom-sheet picker = `Sheet` primitive + FilterSheet's 16a row loop** — tap-to-commit + auto-dismiss + `Check` icon on selected row (D-02 + D-17 + D-19) all derive from FilterSheet's existing pattern.
- **Telemetry through `logEvent` wrapper** (NOT direct `telemetryRing.append`) — keeps the `EVENT_NAMES` allowlist + PII guard intact for the two new locale events.
- **Best-effort `try/catch` around every native call** (TTS, brightness, native modules) — every existing call site does this; extend the pattern to Crashlytics breadcrumb emission per D-31 + D-35.
- **Brightness state-machine wraps the existing `HumynScreenBrightness.set(...)` calls** — Phase 7 introduces NO new native brightness API per REC-LIVE-15; the existing 5 call sites (one `set(0.05)`, four `set(-1)`) all stay; the JS state machine just adds a sixth state-transition path (the rolling 10-s tap-reveal).
- **Reverse-search shim wraps the existing `searchTasks` call** — backend is untouched per D-16; the lexical `ts_vector + GIN + pg_trgm` from Phase 6 continues to serve the rewritten English query.

### File Created

`/Users/adnaan/Documents/hl-homelander/.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md`

### Ready for Planning

Pattern mapping complete. Planner can now reference analog patterns by file path + line number in PLAN.md files. The Surface-source A/B decision (REC-LIVE-19 / D-24) remains a PLAN-time call gated by the on-hardware drift measurement (D-04).
