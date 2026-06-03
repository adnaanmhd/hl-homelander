---
phase: 07-multi-linguality-live-cam-feed
plan: 04
type: execute
wave: 2
depends_on: [01, 03]
files_modified:
  - apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx
  - apps/mobile/src/components/LanguageList.tsx
  - apps/mobile/src/components/LanguageSheet.tsx
  - apps/mobile/src/i18n/locale-meta.ts
  - apps/mobile/src/navigation/OnboardingStack.tsx
  - apps/mobile/src/navigation/RootNativeStack.tsx
  - apps/mobile/src/state/initialRoute.ts
  - apps/mobile/src/screens/profile/ProfileScreen.tsx
  - apps/mobile/src/screens/chooseLanguage/__tests__/ChooseLanguageScreen.test.tsx
  - apps/mobile/src/components/__tests__/LanguageSheet.test.tsx
  - apps/mobile/src/state/__tests__/initialRoute.locale.test.ts
autonomous: true
requirements: [I18N-02, I18N-03, I18N-04, I18N-12]
tags: [i18n, ui, navigation, mobile]
must_haves:
  truths:
    - 'On fresh install, ChooseLanguageScreen renders between Splash and Signup'
    - 'After Continue is tapped, `localeMmkv.locale.code` and `locale.chosen_at` are both set and the gate does not re-fire on relaunch'
    - 'Profile shows a Language row above Help Center; tapping it opens a bottom-sheet picker'
    - 'Single tap on a sheet row commits the new locale, dismisses the sheet, and triggers `i18n.changeLanguage` immediately'
    - 'Both surfaces use ONLY tokens that exist in `apps/mobile/src/ui/tokens.ts` (D-20 design carve-out #2; token-only contract per SPEC I18N-03)'
    - 'Both surfaces emit `locale_chosen` (first-launch) and `locale_changed` (Profile) telemetry events'
  artifacts:
    - path: apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx
      provides: 'First-launch language picker (design carve-out #2)'
      contains: 'navigation.replace'
    - path: apps/mobile/src/components/LanguageSheet.tsx
      provides: 'Bottom-sheet picker for Profile language row'
      contains: 'i18n.changeLanguage'
    - path: apps/mobile/src/components/LanguageList.tsx
      provides: 'Shared 8-row renderer used by both surfaces'
      exports: ['LanguageList']
    - path: apps/mobile/src/i18n/locale-meta.ts
      provides: 'Native + English display names per locale + canonical ordering'
      contains: 'LOCALE_NATIVE_NAMES'
    - path: apps/mobile/src/state/initialRoute.ts
      provides: 'Extended initial-route gate with ChooseLanguage check before Signup'
      contains: 'ChooseLanguage'
  key_links:
    - from: apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx
      to: apps/mobile/src/i18n/storage.ts
      via: localeMmkv.set + i18n.changeLanguage on Continue
      pattern: "localeMmkv\\.set"
    - from: apps/mobile/src/components/LanguageSheet.tsx
      to: apps/mobile/src/ui/primitives/Sheet.tsx
      via: Sheet primitive reuse (D-17)
      pattern: 'Sheet'
    - from: apps/mobile/src/state/initialRoute.ts
      to: apps/mobile/src/i18n/storage.ts
      via: localeMmkv.contains gate
      pattern: 'LOCALE_KEYS.CHOSEN_AT'
    - from: apps/mobile/src/screens/profile/ProfileScreen.tsx
      to: apps/mobile/src/components/LanguageSheet.tsx
      via: state-driven mount above Help Center
      pattern: 'LanguageSheet'
---

<objective>
Ship the two user-facing language-picker surfaces and the navigation gate that gets a fresh-install user from Splash to ChooseLanguage to Signup exactly once. After the language is chosen, the gate is silent forever (until delete-account or fresh-install clears MMKV).

Three deliverables:

1. **`ChooseLanguageScreen`** — design carve-out #2 (D-20), token-only screen with 8 language rows + Continue. Per D-22 the Continue tap: writes both MMKV keys atomically, calls `i18n.changeLanguage(loc)`, emits `locale_chosen` telemetry, `navigation.replace('Signup')`.
2. **`LanguageSheet`** + **`LanguageList`** — Profile bottom-sheet picker using the existing `Sheet` primitive (D-17, NOT `@gorhom/bottom-sheet`). Tap-to-commit + auto-dismiss (D-02). The shared `LanguageList` component is rendered by both `ChooseLanguageScreen` and `LanguageSheet` so the 8-row presentation stays consistent.
3. **Initial-route gate extension** in `apps/mobile/src/state/initialRoute.ts` — a new gate slotted BEFORE the existing Signup gate. When `localeMmkv.contains(LOCALE_KEYS.CHOSEN_AT) === false`, the route is `{ stack: 'OnboardingStack', screen: 'ChooseLanguage' }`. Once chosen, the gate is transparent and existing behavior is unchanged.

Output: a fresh-install user can pick a language ONCE and see it persist; a Profile user can change it any time via a tap-to-commit sheet. Both flows are covered by JS unit tests.
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
@apps/mobile/src/i18n/storage.ts
@apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
@apps/mobile/src/screens/shared/FilterSheet.tsx
@apps/mobile/src/navigation/OnboardingStack.tsx
@apps/mobile/src/state/initialRoute.ts
@apps/mobile/src/screens/profile/ProfileScreen.tsx
@apps/mobile/src/ui/primitives/Sheet.tsx
@apps/mobile/src/ui/tokens.ts

<interfaces>
From apps/mobile/src/i18n/storage.ts (plan 07-01):
```typescript
export const localeMmkv: MMKV;
export const LOCALE_KEYS = { CODE: 'locale.code', CHOSEN_AT: 'locale.chosen_at' } as const;
export const SUPPORTED_LOCALES = ['en','pt-BR','es','hi-IN','bn-IN','ta-IN','te-IN','mr-IN'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
```

From apps/mobile/src/navigation/OnboardingStack.tsx (current shape):

```tsx
<Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
  <Stack.Screen name="Splash" component={SplashScreen} />
  <Stack.Screen name="Signup" component={SignupScreen} options={{ animation: 'fade' }} />
  <Stack.Screen name="Permissions" component={PermissionsScreen} />
  // ...
</Stack.Navigator>
```

From apps/mobile/src/state/initialRoute.ts:

```typescript
export type InitialRoute =
  | { stack: 'ForceUpgrade'; params: { hardBlock: true } }
  | { stack: 'OnboardingStack'; screen: 'Signup' }
  | { stack: 'OnboardingStack'; screen: 'Permissions' }
  | { stack: 'OnboardingStack'; screen: 'Compat' }
  | { stack: 'OnboardingStack'; screen: 'RigTutorial' }
  | { stack: 'MainTabs' };
```

From apps/mobile/src/ui/tokens.ts — **the exact set of tokens that exist** (verified by reading the file on 2026-05-24):

```typescript
// colors (selection — full list in tokens.ts):
export const colors = {
  bg: '#FAF7F2', // app background — also used here for the language-row "subtle" surface
  surface: '#FFFFFF',
  text: '#1A1A1A',
  text2: '#6B6B6B',
  text3: '#9A9590', // tertiary text — used here for the English-name right column
  line: '#E8E5E0', // hairlines / row dividers — used here for the selected-row border
  accent: '#FF6A2D', // used here for the Check icon
  accentSoft: '#FFE6D8', // tinted accent — used here for the selected-row background
  // ...
} as const;

// spacing (selection):
export const spacing = {
  xs: 4,
  s: 6,
  m: 8,
  ms: 10,
  md: 12,
  mdl: 14,
  l: 16, // default screen gutter (used here for row paddingHorizontal)
  ll: 18,
  xl: 20,
  xxl: 22,
  xxxl: 24,
  h: 28,
  hh: 32,
  xxxxl: 48,
} as const;

// radii (selection — NO `radii.m`, NO `radii.md`; use `radii.input` / `radii.button` for medium-radius surfaces):
export const radii = {
  tile: 18,
  sheet: 24,
  modal: 20,
  button: 14, // used here for the language-row corner radius
  pill: 999,
  input: 12,
  chip: 6,
  chipPill: 999,
} as const;
```

**Token contract (SPEC I18N-03):** The token-only contract is hard. ONLY the tokens enumerated above may be referenced from `LanguageList.tsx` and `ChooseLanguageScreen.tsx`. The pinned choices for this plan are:

- Selected-row background: `colors.accentSoft` (NOT `colors.surfaceSubtle` — that token does not exist)
- Row corner radius: `radii.button` (NOT `radii.m` — that token does not exist)
- English-name right-column tone: `colors.text3`
- Check icon color: `colors.accent`
- Row gutter: `spacing.l` (horizontal) + `spacing.m` (vertical)
- Row gap between native + english slot: `spacing.s`

If a verbatim design hand-off later changes any of these picks, edit `tokens.ts` first (add the token) — never inline a hex literal.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: locale-meta + shared LanguageList + ChooseLanguageScreen + OnboardingStack route + initialRoute gate</name>
  <files>apps/mobile/src/i18n/locale-meta.ts, apps/mobile/src/components/LanguageList.tsx, apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx, apps/mobile/src/navigation/OnboardingStack.tsx, apps/mobile/src/navigation/RootNativeStack.tsx, apps/mobile/src/state/initialRoute.ts, apps/mobile/src/screens/chooseLanguage/__tests__/ChooseLanguageScreen.test.tsx, apps/mobile/src/state/__tests__/initialRoute.locale.test.ts</files>
  <read_first>
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (analog: token-only screen, telemetry-on-event, navigation.replace, Continue button)
    - apps/mobile/src/navigation/OnboardingStack.tsx (existing Stack.Screen list — insert position is between Splash and Signup)
    - apps/mobile/src/navigation/RootNativeStack.tsx (route-registry tests live here — extend the REQUIRED routes list)
    - apps/mobile/src/state/initialRoute.ts (existing gate ordering: ForceUpgrade → JWT-missing → Permissions → Compat → Practice → MainTabs)
    - apps/mobile/src/i18n/storage.ts (plan 07-01 exports)
    - apps/mobile/src/i18n/bootstrap.ts (plan 07-01)
    - apps/mobile/src/ui/tokens.ts (token surface — ChooseLanguage MUST use ONLY tokens enumerated in the `<interfaces>` block above)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-17, D-18, D-19, D-20, D-21, D-22, D-23, D-30
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "`apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx`" + "`apps/mobile/src/navigation/OnboardingStack.tsx`"
    - .planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md I18N-02, I18N-03
  </read_first>
  <behavior>
    - `LOCALE_NATIVE_NAMES['hi-IN'] === 'हिन्दी'`; full table covers all 8 locales.
    - `LOCALE_ENGLISH_NAMES['hi-IN'] === 'Hindi'`; full table covers all 8 locales.
    - `LOCALE_DISPLAY_ORDER` is the exact D-18 sequence: `['en','pt-BR','es','hi-IN','bn-IN','ta-IN','te-IN','mr-IN']`.
    - `LanguageList` renders 8 `Pressable` rows in `LOCALE_DISPLAY_ORDER` with native name (left) + English name (right) + lucide `Check` icon on the selected row.
    - On row press, `LanguageList` calls `onSelect(loc)` (parent owns the side effects).
    - On `ChooseLanguageScreen` mount, NO telemetry fires (per D-22 + D-30 — emit happens on Continue, not mount).
    - Tapping a row on `ChooseLanguageScreen` updates internal pending-selection state (does NOT commit until Continue).
    - Tapping Continue: writes `localeMmkv.set(LOCALE_KEYS.CODE, loc)` + `localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, new Date().toISOString())`; calls `i18n.changeLanguage(loc)`; emits `logEvent('locale_chosen', { installation_id, chosen_locale })`; calls `navigation.replace('Signup')`.
    - `computeInitialRoute` inserts a new gate BEFORE the JWT-missing gate: when `localeMmkv.contains(LOCALE_KEYS.CHOSEN_AT) === false` AND `!s.forceUpgradeBlocked`, returns `{ stack: 'OnboardingStack', screen: 'ChooseLanguage' }`.
    - When `localeMmkv.contains(LOCALE_KEYS.CHOSEN_AT) === true`, the gate is transparent — existing routing behavior unchanged.
    - **Token contract (SPEC I18N-03):** every style declaration in `LanguageList.tsx` and `ChooseLanguageScreen.tsx` references tokens by name (e.g. `colors.accentSoft`, `radii.button`, `spacing.l`). NO hex literals. NO references to tokens that do not exist in `tokens.ts` (the executor must NOT invent fallback tokens or guess names).
  </behavior>
  <action>
1. **Create `apps/mobile/src/i18n/locale-meta.ts`**:
   ```typescript
   /**
    * Locale display metadata per D-18 + D-19.
    * Order matches both the ChooseLanguageScreen list AND the Profile sheet.
    */
   import type { Locale } from './storage';

export const LOCALE_DISPLAY_ORDER: readonly Locale[] = [
'en', 'pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN',
] as const;

/\*_ Native name as the speakers write it (left column). _/
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
en: 'English',
'pt-BR': 'Português',
es: 'Español',
'hi-IN': 'हिन्दी',
'bn-IN': 'বাংলা',
'ta-IN': 'தமிழ்',
'te-IN': 'తెలుగు',
'mr-IN': 'मराठी',
};

/\*_ English label (right column, secondary tone). _/
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
en: 'English',
'pt-BR': 'Portuguese (Brazil)',
es: 'Spanish',
'hi-IN': 'Hindi',
'bn-IN': 'Bengali',
'ta-IN': 'Tamil',
'te-IN': 'Telugu',
'mr-IN': 'Marathi',
};

````

2. **Create `apps/mobile/src/components/LanguageList.tsx`** (shared row renderer per Claude's discretion item in CONTEXT.md). **Token-only contract:** use ONLY the tokens listed in the `<interfaces>` block. The exact picks are pinned below — do NOT swap in alternatives, do NOT invent fallbacks. If a token is missing, that is a planner bug — surface it, do not paper over it.

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Pressable } from '../ui/primitives/Pressable';
import { Text } from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';
import {
  LOCALE_DISPLAY_ORDER,
  LOCALE_NATIVE_NAMES,
  LOCALE_ENGLISH_NAMES,
} from '../i18n/locale-meta';
import type { Locale } from '../i18n/storage';

interface Props {
  value: Locale;
  onSelect: (loc: Locale) => void;
}

export function LanguageList({ value, onSelect }: Props): React.JSX.Element {
  return (
    <View accessibilityLabel="language-list">
      {LOCALE_DISPLAY_ORDER.map((loc) => {
        const isSelected = loc === value;
        return (
          <Pressable
            key={loc}
            accessibilityLabel={`language-row-${loc}`}
            onPress={() => onSelect(loc)}
            style={[styles.row, isSelected ? styles.rowSelected : null]}
          >
            <Text variant="body" style={styles.native}>
              {LOCALE_NATIVE_NAMES[loc]}
            </Text>
            <View style={styles.rightSlot}>
              <Text variant="caption" style={styles.english}>
                {LOCALE_ENGLISH_NAMES[loc]}
              </Text>
              {isSelected ? (
                <Check size={20} color={colors.accent} strokeWidth={2} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Token contract — every value below references tokens that exist in
// apps/mobile/src/ui/tokens.ts. NO hex literals. NO non-existent token names.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: radii.button, // 14 — the canonical medium radius in tokens.ts
    marginVertical: spacing.xs,
  },
  rowSelected: {
    backgroundColor: colors.accentSoft, // #FFE6D8 — tinted accent for selected state
  },
  native: {
    // Text primitive defaults handle color/typography; no overrides needed.
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  english: {
    color: colors.text3, // tertiary text — paired with `variant="caption"`
  },
});
````

**No fallback language.** If the executor finds that `Text` does NOT accept a `style.color` prop (because it is variant-driven), they MUST switch to a variant that conveys `text3` tone (e.g. `tone="tertiary"` if the primitive supports it — read `apps/mobile/src/ui/primitives/Text.tsx` first). Do NOT inline a hex.

3. **Create `apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx`** (analog: `RigTutorialScreen.tsx` shape — design carve-out #2 per D-20). Token contract identical: only `colors.*`, `spacing.*`, `radii.*` token references.

   ```tsx
   import React, { useState } from 'react';
   import { View, StyleSheet, ScrollView } from 'react-native';
   import { useNavigation } from '@react-navigation/native';
   import i18nDefault from '../../i18n';
   import { useTranslation } from 'react-i18next';
   import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
   import { Text } from '../../ui/primitives/Text';
   import { Button } from '../../ui/primitives/Button';
   import { LanguageList } from '../../components/LanguageList';
   import { localeMmkv, LOCALE_KEYS, type Locale } from '../../i18n/storage';
   import { spacing } from '../../ui/tokens';
   import { logEvent } from '../../util/analytics';
   import { useAppStore } from '../../state/appStore';

   /**
    * ChooseLanguageScreen — design carve-out #2 (D-20 / SPEC I18N-03).
    * Rendered between Splash and Signup on first launch only (D-22 MMKV gate).
    * The 3 locked design files (prototype.html / design-spec.md /
    * engineering-handoff.md) are NOT edited per SPEC I18N-03.
    *
    * Token contract: every style value references tokens.ts. NO hex literals.
    */
   export default function ChooseLanguageScreen(): React.JSX.Element {
     const navigation = useNavigation() as unknown as {
       replace: (name: 'Signup') => void;
     };
     const { t } = useTranslation();
     const [pending, setPending] = useState<Locale>('en'); // D-22 default
     const installationId = useAppStore((s) => s.installationId);

     const handleContinue = (): void => {
       try {
         localeMmkv.set(LOCALE_KEYS.CODE, pending);
         localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, new Date().toISOString());
       } catch {
         /* MMKV best-effort */
       }

       void i18nDefault.changeLanguage(pending);

       logEvent('locale_chosen' as never, {
         installation_id: installationId ?? 'unknown',
         chosen_locale: pending,
       });

       if (typeof navigation.replace === 'function') {
         navigation.replace('Signup');
       }
     };

     return (
       <ScreenContainer>
         <ScrollView contentContainerStyle={styles.body}>
           <Text variant="title28" style={styles.title}>
             {t('onboarding.chooseLanguage.title')}
           </Text>
           <View style={styles.list}>
             <LanguageList value={pending} onSelect={setPending} />
           </View>
         </ScrollView>
         <View style={styles.footer}>
           <Button accessibilityLabel="choose-language-continue" onPress={handleContinue}>
             {t('onboarding.chooseLanguage.continueButton')}
           </Button>
         </View>
       </ScreenContainer>
     );
   }

   const styles = StyleSheet.create({
     body: {
       paddingHorizontal: spacing.l,
       paddingTop: spacing.xl,
       paddingBottom: spacing.xl,
     },
     title: {
       marginBottom: spacing.l,
     },
     list: {
       marginTop: spacing.m,
     },
     footer: {
       paddingHorizontal: spacing.l,
       paddingBottom: spacing.xl,
     },
   });
   ```

   If `Button`, `ScreenContainer`, or `Text` props differ in your repo from this sketch, conform to the exact signatures already used in `RigTutorialScreen.tsx`. Re-read RigTutorialScreen if needed to match. Do NOT add new tokens — use only what `apps/mobile/src/ui/tokens.ts` already exports. If a typography variant is missing, edit `tokens.ts` FIRST.

4. **Modify `apps/mobile/src/navigation/OnboardingStack.tsx`** — insert the new screen between Splash and Signup:

   - Add `import ChooseLanguageScreen from '../screens/chooseLanguage/ChooseLanguageScreen';` at the top.
   - Insert `<Stack.Screen name="ChooseLanguage" component={ChooseLanguageScreen} />` immediately AFTER `<Stack.Screen name="Splash" ... />` and BEFORE `<Stack.Screen name="Signup" ... />`. The existing `gestureEnabled: false` covers the no-back-gesture requirement (SPEC I18N-02 / D-22) implicitly.

5. **Modify `apps/mobile/src/navigation/RootNativeStack.tsx`** — if it exposes a `REQUIRED_PHASE_*_ROUTES` array (Phase 4 added one for the Recording route per Pattern 54), add `'ChooseLanguage'` to it. If no such array exists for new phases, skip this step.

6. **Modify `apps/mobile/src/state/initialRoute.ts`** to add the locale gate. Read the existing function — the current ordering is:

   - 1: forceUpgradeBlocked → ForceUpgrade
   - 2: !s.jwt → Signup
   - 3-5: existing
   - 6: MainTabs

   Insert a new gate at position 1.5 (between ForceUpgrade and !s.jwt):

   ```typescript
   import { localeMmkv, LOCALE_KEYS } from '../i18n/storage';
   // ...
   export type InitialRoute =
     | { stack: 'ForceUpgrade'; params: { hardBlock: true } }
     | { stack: 'OnboardingStack'; screen: 'ChooseLanguage' } // NEW
     | { stack: 'OnboardingStack'; screen: 'Signup' }
     | { stack: 'OnboardingStack'; screen: 'Permissions' }
     | { stack: 'OnboardingStack'; screen: 'Compat' }
     | { stack: 'OnboardingStack'; screen: 'RigTutorial' }
     | { stack: 'MainTabs' };

   export function computeInitialRoute(
     s: AppState,
     currentCompatSignature: string | null,
   ): InitialRoute {
     // 1. Hard block first
     if (s.forceUpgradeBlocked) {
       return { stack: 'ForceUpgrade', params: { hardBlock: true } };
     }

     // 1.5 — NEW: First-launch language pick (D-22). Gates ALL non-force-upgrade
     // routing on locale being chosen. Cleared by delete-account / fresh install
     // since `localeMmkv` is wiped on uninstall/reinstall.
     try {
       if (!localeMmkv.contains(LOCALE_KEYS.CHOSEN_AT)) {
         return { stack: 'OnboardingStack', screen: 'ChooseLanguage' };
       }
     } catch {
       // MMKV best-effort — treat as already chosen on read failure
     }

     // 2. Existing JWT gate
     if (!s.jwt) {
       return { stack: 'OnboardingStack', screen: 'Signup' };
     }
     // ... rest unchanged
   }
   ```

7. **Modify the `delete-account` flow** to clear the locale gate so re-creating an account re-runs ChooseLanguage. Find the delete-account commit site by `grep -rn "DELETE /me\|deleteAccount\|delete-account" apps/mobile/src/ 2>&1 | head -5`. In the success branch (where `secureMmkv.delete(KEYS.AUTH_JWT)` and similar wipes happen), add:

   ```typescript
   try {
     localeMmkv.delete(LOCALE_KEYS.CODE);
     localeMmkv.delete(LOCALE_KEYS.CHOSEN_AT);
   } catch {
     /* best-effort */
   }
   ```

   This satisfies SPEC I18N-02's acceptance criterion: "clear MMKV `locale.chosen_at` (or simulate delete-account flow) → ChooseLanguage re-renders next launch".

8. **Create `apps/mobile/src/state/__tests__/initialRoute.locale.test.ts`**:

   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import { computeInitialRoute } from '../initialRoute';
   import { localeMmkv, LOCALE_KEYS } from '../../i18n/storage';

   describe('computeInitialRoute — locale gate (D-22)', () => {
     beforeEach(() => {
       try {
         localeMmkv.delete(LOCALE_KEYS.CODE);
         localeMmkv.delete(LOCALE_KEYS.CHOSEN_AT);
       } catch {}
     });

     const baseState = {
       jwt: null as string | null,
       forceUpgradeBlocked: false,
       permsGranted: null as null | { camera: boolean; mic: boolean },
       compatPassed: null as null | { signature: string | null },
     };

     it('routes to ChooseLanguage on fresh install (no MMKV locale key)', () => {
       const r = computeInitialRoute(baseState as never, null);
       expect(r).toEqual({ stack: 'OnboardingStack', screen: 'ChooseLanguage' });
     });

     it('routes to ForceUpgrade if hard-blocked regardless of locale gate', () => {
       const r = computeInitialRoute({ ...baseState, forceUpgradeBlocked: true } as never, null);
       expect(r.stack).toBe('ForceUpgrade');
     });

     it('routes to Signup once locale.chosen_at is set and JWT is missing', () => {
       localeMmkv.set(LOCALE_KEYS.CODE, 'en');
       localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, new Date().toISOString());
       const r = computeInitialRoute(baseState as never, null);
       expect(r).toEqual({ stack: 'OnboardingStack', screen: 'Signup' });
     });
   });
   ```

9. **Create `apps/mobile/src/screens/chooseLanguage/__tests__/ChooseLanguageScreen.test.tsx`** (covers I18N-02):

   ```tsx
   import React from 'react';
   import { describe, it, expect, beforeEach, vi } from 'vitest';
   import { render, fireEvent } from '@testing-library/react-native';
   import { NavigationContainer } from '@react-navigation/native';
   import ChooseLanguageScreen from '../ChooseLanguageScreen';
   import { localeMmkv, LOCALE_KEYS } from '../../../i18n/storage';
   import i18n from '../../../i18n';

   const replace = vi.fn();
   vi.mock('@react-navigation/native', async (importOriginal) => {
     const orig = await importOriginal<typeof import('@react-navigation/native')>();
     return {
       ...orig,
       useNavigation: () => ({ replace }),
     };
   });

   describe('ChooseLanguageScreen (I18N-02 / D-22)', () => {
     beforeEach(() => {
       try {
         localeMmkv.delete(LOCALE_KEYS.CODE);
       } catch {}
       try {
         localeMmkv.delete(LOCALE_KEYS.CHOSEN_AT);
       } catch {}
       replace.mockClear();
     });

     function r() {
       return render(
         <NavigationContainer>
           <ChooseLanguageScreen />
         </NavigationContainer>,
       );
     }

     it('renders all 8 language rows', () => {
       const { getByLabelText } = r();
       expect(getByLabelText('language-row-en')).toBeTruthy();
       expect(getByLabelText('language-row-pt-BR')).toBeTruthy();
       expect(getByLabelText('language-row-es')).toBeTruthy();
       expect(getByLabelText('language-row-hi-IN')).toBeTruthy();
       expect(getByLabelText('language-row-bn-IN')).toBeTruthy();
       expect(getByLabelText('language-row-ta-IN')).toBeTruthy();
       expect(getByLabelText('language-row-te-IN')).toBeTruthy();
       expect(getByLabelText('language-row-mr-IN')).toBeTruthy();
     });

     it('Continue commits English by default + sets MMKV keys + replaces to Signup', () => {
       const { getByLabelText } = r();
       fireEvent.press(getByLabelText('choose-language-continue'));
       expect(localeMmkv.getString(LOCALE_KEYS.CODE)).toBe('en');
       expect(localeMmkv.getString(LOCALE_KEYS.CHOSEN_AT)).toMatch(/^\d{4}-/); // ISO timestamp
       expect(replace).toHaveBeenCalledWith('Signup');
     });

     it('tapping a different row then Continue commits THAT locale', () => {
       const { getByLabelText } = r();
       fireEvent.press(getByLabelText('language-row-hi-IN'));
       fireEvent.press(getByLabelText('choose-language-continue'));
       expect(localeMmkv.getString(LOCALE_KEYS.CODE)).toBe('hi-IN');
       expect(i18n.language).toBe('hi-IN');
     });
   });
   ```

10. Run the tests to confirm green.
    </action>
    <verify>
    <automated>cd apps/mobile && npm test -- --run src/screens/chooseLanguage/**tests**/ChooseLanguageScreen.test.tsx src/state/**tests**/initialRoute.locale.test.ts 2>&1 | tail -30</automated>
    </verify>
    <acceptance_criteria> - File `apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx` exists. - `grep -c "navigation.replace('Signup')" apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx` returns 1. - `grep -c "ChooseLanguage" apps/mobile/src/navigation/OnboardingStack.tsx` returns at least 2 (import + Stack.Screen). - `grep -c "ChooseLanguage" apps/mobile/src/state/initialRoute.ts` returns at least 2 (type + return). - `grep -c "LOCALE_KEYS.CHOSEN_AT" apps/mobile/src/state/initialRoute.ts` returns at least 1. - All 8 native-name strings present: `grep -cE "(English|Português|Español|हिन्दी|বাংলা|தமிழ்|తెలుగు|मराठी)" apps/mobile/src/i18n/locale-meta.ts` returns at least 8. - **Token contract gate (SPEC I18N-03):** `grep -cE "#[0-9A-Fa-f]{3,6}" apps/mobile/src/components/LanguageList.tsx apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx` returns 0 (no hex literals). - **Token contract gate (SPEC I18N-03):** `grep -cE "surfaceSubtle|radii\.m\b|radii\.md\b" apps/mobile/src/components/LanguageList.tsx apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx` returns 0 (no non-existent token names). - Test command exits 0; all 3 initialRoute + 3 ChooseLanguageScreen cases green.
    </acceptance_criteria>
    <done>ChooseLanguageScreen renders with 8 rows from token-only design (every style value resolves to an existing token in tokens.ts); Continue commits MMKV + i18n + telemetry + nav.replace; initial-route gate routes fresh installs to ChooseLanguage; tests green.</done>
    </task>

<task type="auto" tdd="true">
  <name>Task 2: LanguageSheet + Profile row insertion + tests</name>
  <files>apps/mobile/src/components/LanguageSheet.tsx, apps/mobile/src/screens/profile/ProfileScreen.tsx, apps/mobile/src/components/__tests__/LanguageSheet.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/shared/FilterSheet.tsx (lines 115-237: tap-to-commit + auto-dismiss flow + Layer16a row pattern + `Check` icon)
    - apps/mobile/src/ui/primitives/Sheet.tsx (the existing primitive — verify its props before composition)
    - apps/mobile/src/screens/profile/ProfileScreen.tsx (lines 270-310: existing "Personal info" rows + Help Center row — insertion point is IMMEDIATELY BEFORE Help Center)
    - apps/mobile/src/i18n/locale-meta.ts (Task 1)
    - apps/mobile/src/components/LanguageList.tsx (Task 1)
    - apps/mobile/src/ui/tokens.ts (token surface — same contract as Task 1)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-02, D-04 (preview only — n/a here), D-17, D-19, D-30
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "LanguageSheet.tsx" + "ProfileScreen.tsx"
  </read_first>
  <behavior>
    - `LanguageSheet` is a controlled component (`visible: boolean`, `onDismiss: () => void`).
    - On mount/open, the sheet shows the 8-row `LanguageList` with the current `i18n.language` selected.
    - Tapping a row immediately: writes both MMKV keys (CODE = new locale, CHOSEN_AT = new timestamp), calls `i18n.changeLanguage(newLoc)`, emits `logEvent('locale_changed', { installation_id, from_locale, to_locale })`, calls `onDismiss()`.
    - No "Apply" button (D-02).
    - Sheet uses the existing `Sheet` primitive (D-17) — no new gesture dep.
    - On Profile: a new Pressable row labeled by `t('profile.language.row.label')` renders IMMEDIATELY ABOVE the existing Help Center row; on press, opens the sheet.
    - Profile date renders (the existing `me.createdAt` formatter at ~line 180) MIGRATES to `formatDate(new Date(me.createdAt), i18n.language)`.
    - Profile re-renders translated strings (e.g. greeting "Profile" header) when the active locale changes — verified by checking `useTranslation` is hooked.
    - **Token contract (SPEC I18N-03):** every style declaration in `LanguageSheet.tsx` references tokens by name; the Profile row uses the same `styles.row` shape as the existing Help Center row (no new style needed).
  </behavior>
  <action>
1. **Create `apps/mobile/src/components/LanguageSheet.tsx`** (composes existing `Sheet` per D-17):
   ```tsx
   import React from 'react';
   import { View, StyleSheet } from 'react-native';
   import { useTranslation } from 'react-i18next';
   import i18nDefault from '../i18n';
   import { Sheet } from '../ui/primitives/Sheet';
   import { Text } from '../ui/primitives/Text';
   import { LanguageList } from './LanguageList';
   import { localeMmkv, LOCALE_KEYS, type Locale } from '../i18n/storage';
   import { spacing } from '../ui/tokens';
   import { logEvent } from '../util/analytics';
   import { useAppStore } from '../state/appStore';

interface Props {
visible: boolean;
onDismiss: () => void;
}

/\*\*
_ LanguageSheet — Profile bottom-sheet picker per D-02 + D-17 + D-19.
_ Tap-to-commit + auto-dismiss; NO Apply button. \*
_ Token contract: every style value references tokens.ts. NO hex literals.
_/
export function LanguageSheet({ visible, onDismiss }: Props): React.JSX.Element {
const { t, i18n } = useTranslation();
const installationId = useAppStore((s) => s.installationId);
const current = (i18n.language as Locale) ?? 'en';

     const handleSelect = (loc: Locale): void => {
       if (loc === current) {
         onDismiss();
         return;
       }

       try {
         localeMmkv.set(LOCALE_KEYS.CODE, loc);
         localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, new Date().toISOString());
       } catch { /* best-effort */ }

       void i18nDefault.changeLanguage(loc);

       logEvent('locale_changed' as never, {
         installation_id: installationId ?? 'unknown',
         from_locale: current,
         to_locale: loc,
       });

       onDismiss();
     };

     return (
       <Sheet visible={visible} onDismiss={onDismiss}>
         <View style={styles.body} accessibilityLabel="language-sheet">
           <Text variant="sheetTitle" style={styles.title}>
             {t('profile.language.picker.title')}
           </Text>
           <LanguageList value={current} onSelect={handleSelect} />
         </View>
       </Sheet>
     );

}

const styles = StyleSheet.create({
body: {
paddingHorizontal: spacing.l,
paddingTop: spacing.l,
paddingBottom: spacing.xl,
},
title: {
marginBottom: spacing.m,
},
});

````

Confirm `Sheet` primitive's actual props by reading `apps/mobile/src/ui/primitives/Sheet.tsx` first. If its prop names differ (e.g. `open` instead of `visible`), conform. Same for the dismiss callback. If `sheetTitle` variant is missing from the Text primitive, switch to `title28` or `pitch` — re-read `apps/mobile/src/ui/primitives/Text.tsx` first; do NOT invent.

2. **Modify `apps/mobile/src/screens/profile/ProfileScreen.tsx`**:
- Add imports at top: `import { useState } from 'react';`, `import { useTranslation } from 'react-i18next';`, `import { LanguageSheet } from '../../components/LanguageSheet';`, `import { LOCALE_NATIVE_NAMES } from '../../i18n/locale-meta';`, `import { formatDate } from '../../lib/dates';`.
- Inside the component body, add hook calls:
  ```typescript
  const { t, i18n } = useTranslation();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  ```
- **Insert** a new `Pressable` row IMMEDIATELY BEFORE the existing Help Center row (around line 297-310). Use the exact `styles.row` shape currently used for Help Center:
  ```tsx
  <Pressable
    style={styles.row}
    onPress={() => setLanguageSheetVisible(true)}
    accessibilityLabel="profile-action-language"
  >
    <Text variant="body" style={styles.fieldLabel}>
      {t('profile.language.row.label')}
    </Text>
    <Text variant="body" style={styles.fieldValue}>
      {LOCALE_NATIVE_NAMES[(i18n.language as keyof typeof LOCALE_NATIVE_NAMES) ?? 'en'] ?? 'English'} ›
    </Text>
  </Pressable>
  ```
  The `styles.fieldValue` style here is the same one the Help Center row already uses for its trailing chevron / value — reuse, do NOT invent.
- **Migrate the existing date format**: find the existing `toLocaleDateString` call on `me.createdAt` (around line 180) and replace with `formatDate(new Date(me.createdAt), i18n.language)`. Keep the variable name and surrounding markup unchanged.
- **Mount the sheet** somewhere near the bottom of the JSX (before the closing `</ScreenContainer>`):
  ```tsx
  <LanguageSheet
    visible={languageSheetVisible}
    onDismiss={() => setLanguageSheetVisible(false)}
  />
  ```

3. **Create `apps/mobile/src/components/__tests__/LanguageSheet.test.tsx`**:
```tsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react-native';
import { LanguageSheet } from '../LanguageSheet';
import i18n from '../../i18n';
import { localeMmkv, LOCALE_KEYS } from '../../i18n/storage';

describe('LanguageSheet (D-02 / D-17 / D-19)', () => {
  beforeEach(async () => {
    try { localeMmkv.delete(LOCALE_KEYS.CODE); } catch {}
    try { localeMmkv.delete(LOCALE_KEYS.CHOSEN_AT); } catch {}
    await i18n.changeLanguage('en');
  });

  it('renders 8 language rows when visible', () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(<LanguageSheet visible onDismiss={onDismiss} />);
    expect(getByLabelText('language-row-en')).toBeTruthy();
    expect(getByLabelText('language-row-hi-IN')).toBeTruthy();
    expect(getByLabelText('language-row-mr-IN')).toBeTruthy();
  });

  it('tap on a row commits the locale, calls i18n.changeLanguage, and dismisses (D-02)', async () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(<LanguageSheet visible onDismiss={onDismiss} />);
    fireEvent.press(getByLabelText('language-row-hi-IN'));
    await new Promise((r) => setTimeout(r, 0));
    expect(localeMmkv.getString(LOCALE_KEYS.CODE)).toBe('hi-IN');
    expect(i18n.language).toBe('hi-IN');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('tap on the current row dismisses without committing again', () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(<LanguageSheet visible onDismiss={onDismiss} />);
    fireEvent.press(getByLabelText('language-row-en'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
````

4. Run the test to confirm green.
   </action>
   <verify>
   <automated>cd apps/mobile && npm test -- --run src/components/**tests**/LanguageSheet.test.tsx 2>&1 | tail -25</automated>
   </verify>
   <acceptance_criteria> - File `apps/mobile/src/components/LanguageSheet.tsx` exists; `grep -c "i18nDefault.changeLanguage" apps/mobile/src/components/LanguageSheet.tsx` returns at least 1. - `grep -c "LanguageSheet" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns at least 2 (import + JSX). - `grep -c "profile-action-language" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 1. - `grep -c "formatDate" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns at least 1 (date migration). - **Token contract gate:** `grep -cE "#[0-9A-Fa-f]{3,6}" apps/mobile/src/components/LanguageSheet.tsx` returns 0 (no hex literals introduced by the new sheet). - Test command exits 0; all 3 LanguageSheet cases green.
   </acceptance_criteria>
   <done>Profile shows a Language row above Help Center; tapping opens a bottom-sheet with 8 options; tap on a row commits + dismisses + emits telemetry; ProfileScreen date format migrated to formatDate(); tests green; no hex literals in the new sheet file.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                    | Description                              |
| --------------------------- | ---------------------------------------- |
| ChooseLanguageScreen → MMKV | Locale + timestamp persisted on Continue |
| LanguageSheet → MMKV + i18n | Mid-session locale change                |
| computeInitialRoute → MMKV  | Locale gate read at every boot           |

## STRIDE Threat Register

| Threat ID  | Category    | Component                                                                     | Disposition | Mitigation Plan                                                                                                                                                                                                                                                |
| ---------- | ----------- | ----------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-04-01 | Tampering   | User modifies `localeMmkv` keys via debug tool to force an unsupported locale | mitigate    | `localeBootstrap` (plan 07-01) already gates against `SUPPORTED_LOCALES` allowlist. If the gate trips here, i18n still falls back to `'en'`.                                                                                                                   |
| T-07-04-02 | Spoofing    | Telemetry event injection (locale_chosen with crafted installation_id)        | accept      | Per D-30, the existing telemetry ring is fire-and-forget through the same `secureMmkv` instance; installation_id comes from the existing appStore (set at first launch). No new endpoint introduced.                                                           |
| T-07-04-03 | DoS         | Spamming locale changes from Profile triggers provider-re-render storm        | mitigate    | Per 07-RESEARCH Pitfall 1, `i18n.changeLanguage` is fired only from ChooseLanguage Continue + LanguageSheet row tap — both single-shot user actions. Sheet has `onDismiss()` after commit so the row cannot be tapped repeatedly without re-opening the sheet. |
| T-07-04-04 | Repudiation | User cannot prove which locale was chosen                                     | mitigate    | `localeMmkv.locale.chosen_at` stamps an ISO timestamp on every Continue/row-tap; the telemetry ring carries both events with installation_id.                                                                                                                  |

</threat_model>

<verification>
- `cd apps/mobile && npm test -- --run src/screens/chooseLanguage/ src/components/__tests__/LanguageSheet.test.tsx src/state/__tests__/initialRoute.locale.test.ts` exits 0
- `cd apps/mobile && npx tsc --noEmit` exits 0
- No new dependencies added to `package.json` (D-17 reuse of existing `Sheet`)
- Token contract gate (SPEC I18N-03): no hex literals in LanguageList.tsx / ChooseLanguageScreen.tsx / LanguageSheet.tsx; no references to non-existent token names (`surfaceSubtle`, `radii.m`, `radii.md`)
- Manual sanity (operator step in 07-08 smoke runbook): fresh install lands on ChooseLanguageScreen; reinstall after Continue does NOT re-render it
</verification>

<success_criteria>

- ChooseLanguageScreen registered in OnboardingStack between Splash and Signup
- computeInitialRoute routes fresh installs to ChooseLanguage; otherwise transparent
- Profile Language row appears above Help Center; tap opens sheet; row tap commits + dismisses
- Both surfaces emit telemetry through the existing `logEvent` allowlist (extended in plan 07-03)
- All vitest cases pass; no hex literals introduced (plan-checker gate); only tokens that exist in `tokens.ts` are referenced (SPEC I18N-03 token-only contract)
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-04-SUMMARY.md` per the standard template. Note design carve-out #2 (D-20) explicitly in the summary so future audits can find it.
</output>
</content>
</invoke>
