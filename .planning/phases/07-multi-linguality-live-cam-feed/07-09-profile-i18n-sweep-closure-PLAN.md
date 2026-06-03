---
phase: 07-multi-linguality-live-cam-feed
plan: 09
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/i18n/locales/en.json
  - apps/mobile/src/i18n/locales/pt-BR.json
  - apps/mobile/src/i18n/locales/es.json
  - apps/mobile/src/i18n/locales/hi-IN.json
  - apps/mobile/src/i18n/locales/bn-IN.json
  - apps/mobile/src/i18n/locales/ta-IN.json
  - apps/mobile/src/i18n/locales/te-IN.json
  - apps/mobile/src/i18n/locales/mr-IN.json
  - apps/mobile/src/screens/profile/ProfileScreen.tsx
  - apps/mobile/src/components/DeleteAccountModal.tsx
autonomous: true
gap_closure: true
requirements: [I18N-01, I18N-11]
tags: [i18n, ui, mobile, profile, gap-closure]
must_haves:
  truths:
    - 'A hi-IN (or any non-en) user landing on Profile sees every visible label rendered in the active locale: head "tap to edit" caption, lifetime "contributed" + "Across {{count}} tasks", payments card title + "COMING SOON" badge + body, personal-info field labels Name / Age / Gender / Joined, action rows Help Center / Logout / Delete account, plus the "Could not update" Alert.'
    - 'A hi-IN (or any non-en) user opening the Delete Account modal sees every visible label rendered in the active locale across BOTH steps: Step 1 title "Delete your Humyn account?" + body + Cancel + Continue to delete; Step 2 title "Type DELETE to confirm." + placeholder + Cancel + Confirm / Deleting…; plus the "Could not delete" Alert.'
    - 'The English source-of-truth catalog `apps/mobile/src/i18n/locales/en.json` (D-12) gains the new `profile.*` (head / lifetime / fields / actions / payments / errors) and `profile.delete.*` (title / body / cancel / continueToDelete / typeToConfirmTitle / placeholder / confirm / deleting / errors.couldNotDelete) key trees. The 7 non-English catalogs are regenerated via the LLM tool from plan 07-02 and pass `pnpm i18n:validate` shape parity.'
    - 'ProfileScreen.tsx and DeleteAccountModal.tsx contain ZERO hardcoded English user-visible label string literals — every call site routes through `t(...)`.'
    - 'Phase 6 cosmetic-gaps doc remains untouched (I18N-11 invariant); zero files under `apps/mobile/ios/` modified (I18N-21 invariant); zero Camera2 / MediaCodec / FinalizeWorker / MetadataComposer / Calibration / Phase 6 cosmetic-gaps file modified.'
  artifacts:
    - path: apps/mobile/src/i18n/locales/en.json
      provides: 'Canonical source-of-truth catalog with new `profile.*` + `profile.delete.*` namespaces covering every ProfileScreen + DeleteAccountModal label'
      contains: 'profile.delete.title'
    - path: apps/mobile/src/screens/profile/ProfileScreen.tsx
      provides: 'Profile screen where every user-visible label flows through `t(...)` — no hardcoded English string literals remain in JSX or Alert calls'
      contains: "t('profile.fields.name')"
    - path: apps/mobile/src/components/DeleteAccountModal.tsx
      provides: 'Delete-account two-step modal where every user-visible label + the "Could not delete" Alert flows through `t(...)`'
      contains: "t('profile.delete.title')"
  key_links:
    - from: apps/mobile/src/screens/profile/ProfileScreen.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "useTranslation() + t('profile.fields.name') / t('profile.actions.help') / t('profile.errors.couldNotUpdate.title') / t('profile.errors.couldNotUpdate.body') / etc."
      pattern: "t\\('profile\\."
    - from: apps/mobile/src/components/DeleteAccountModal.tsx
      to: apps/mobile/src/i18n/locales/en.json
      via: "useTranslation() + t('profile.delete.title') / t('profile.delete.body') / t('profile.delete.confirm') / t('profile.delete.deleting') / t('profile.delete.errors.couldNotDelete.title') / etc."
      pattern: "t\\('profile\\.delete\\."
---

<objective>
**Gap closure for WR-01.** Plan 07-05 ("screen string sweep + bilingual consent") explicitly promised to route every user-visible string across the 22 Phase-2 screens through `t()`. The Phase 7 verifier (`07-VERIFICATION.md`) found the sweep INCOMPLETE on two surfaces: `ProfileScreen.tsx` (14 hardcoded labels) and `DeleteAccountModal.tsx` (9 hardcoded labels). A hi-IN / pt-BR / es / bn-IN / ta-IN / te-IN / mr-IN user sees the Language row label + Joined date translated but Name / Age / Gender / Joined-LABEL / Help Center / Logout / Delete account / payments card / Delete-modal copy still in English — directly violating SC#1's "new language take effect immediately across all 23 screens".

This plan closes WR-01 ONLY. It is a Wave 1 follow-on to the already-shipped plans 07-01..07-08 — NOT a child of 07-05 (07-05 is committed). It adds the missing `profile.*` + `profile.delete.*` keys to `en.json` (the D-12 source of truth), routes every hardcoded label in the two files through `t()`, then runs `pnpm i18n:generate` + `pnpm i18n:validate` to regenerate + shape-parity-validate the 7 non-English catalogs.

Scope reminders that ARE NOT loosenings:

- **I18N-11 invariant** — Phase 6 cosmetic-gaps doc is NOT re-opened; this plan modifies copy only via `t()` substitution, not via restyling.
- **I18N-21 invariant** — Android-only. Zero files under `apps/mobile/ios/` modified.
- **Capture-spec invariants UNCHANGED** — no Camera2 / MediaCodec / FinalizeWorker / MetadataComposer / Calibration / drift-telemetry / cancel-gate / ultrawide-lens code touched. Per CLAUDE.md banners, those paths are not in scope for this gap closure.
- **Design-locked files UNCHANGED** — `prototype.html`, `design-spec.md`, `engineering-handoff.md`, `idea-brief.md §5.11` (Profile design spec) stay untouched. The PAYMENTS_BODY constant + STEP1_BODY constant are the design canon; `en.json` values for those keys MUST be byte-equal to the existing constants (mirror the Plan 07-05 Task 3 byte-parity pattern used for TERMS_OF_USE_TEXT vs `en.json` `terms.consent.body`).

Output: ProfileScreen + DeleteAccountModal read every user-visible string from the catalog; `i18n.changeLanguage(loc)` causes both surfaces to re-render in the new locale via the `<I18nextProvider>` re-render path; 7 non-English JSONs are regenerated by the LLM tool and pass shape parity.

**Operator follow-up (NOT this plan's job):** After this plan lands, re-run `07-MANUAL-SMOKE.md` §2 on at least one non-English locale (hi-IN recommended) to confirm Profile + Delete Account flows render translated. The other 9 §-sections of the smoke runbook are unaffected by this gap closure.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-05-screen-string-sweep-and-bilingual-consent-PLAN.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-05-SUMMARY.md
@CLAUDE.md
@apps/mobile/src/screens/profile/ProfileScreen.tsx
@apps/mobile/src/components/DeleteAccountModal.tsx
@apps/mobile/src/i18n/locales/en.json
@tools/i18n/generate.ts
@tools/i18n/validate.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase. -->
<!-- Executor MUST use these directly — no codebase exploration needed. -->

From apps/mobile/src/screens/profile/ProfileScreen.tsx (existing imports + the LANGUAGE row pattern that already calls t()):

```typescript
import { useTranslation } from 'react-i18next';
// ...
const { t, i18n } = useTranslation();
// Existing call (Plan 07-04, line 322-323):
<Text variant="body" style={styles.fieldLabel}>
  {t('profile.language.row.label')}
</Text>
```

From apps/mobile/src/i18n/locales/en.json (existing `profile.*` subtree — KEEP this and add siblings):

```json
"profile": {
  "language": {
    "row": { "label": "Language" },
    "sheet": { "title": "Choose language" }
  }
}
```

From apps/mobile/src/components/DeleteAccountModal.tsx:

```typescript
// File does NOT currently import useTranslation — must be ADDED.
// Existing imports to KEEP:
import React, { useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../ui/primitives/Text';
import { Button } from '../ui/primitives/Button';
import { colors, radii, spacing } from '../ui/tokens';

// Existing constant that MUST remain unchanged (design canon, drift detector):
const STEP1_BODY =
  'Your account will be deactivated for 30 days. Log in within that window to restore it. After 30 days, deletion is permanent. Recordings already uploaded remain on our servers.';

// Existing constant that MUST remain unchanged (case-sensitive validator):
const REQUIRED_TEXT = 'DELETE';
```

From apps/mobile/src/screens/profile/ProfileScreen.tsx:

```typescript
// Existing constant that MUST remain unchanged (design canon — verbatim
// from idea-brief.md §5.11). en.json `profile.payments.body` MUST be
// byte-equal to this constant:
const PAYMENTS_BODY =
  'Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed.';
```

From tools/package.json scripts (the regen + validate invocations — match the existing Plan 07-05 Task 3 phrasing):

```json
"scripts": {
  "i18n:generate": "tsx i18n/generate.ts",
  "i18n:validate": "tsx i18n/validate.ts"
}
```

Invocation (matches Plan 07-05 Task 3 step 5/6):

```bash
cd tools && pnpm i18n:generate
cd tools && pnpm i18n:validate
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add `profile.*` + `profile.delete.*` keys to en.json (D-12 canonical source of truth)</name>
  <files>apps/mobile/src/i18n/locales/en.json</files>
  <read_first>
    - apps/mobile/src/i18n/locales/en.json (existing canonical catalog; existing `profile.language` subtree at the `profile:` key — KEEP it, add siblings)
    - apps/mobile/src/screens/profile/ProfileScreen.tsx (full file — the English source strings come from these exact lines, verbatim; pay special attention to lines 51-52 PAYMENTS_BODY constant + lines 156, 246, 258, 261, 269, 273, 278, 284, 286, 293, 301, 335, 347, 359)
    - apps/mobile/src/components/DeleteAccountModal.tsx (full file — the English source strings come from lines 72-73 STEP1_BODY constant + lines 99, 133, 146, 156, 164, 173, 181, 191, 199)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-05-screen-string-sweep-and-bilingual-consent-PLAN.md (reference pattern for key naming convention D-08 `screen.section.element`, interpolation syntax `{{var}}`, and acceptance-criteria phrasing — match its style)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md (D-08 key-naming convention; D-12 en.json is the canonical surface; the LLM regen tool overwrites the 7 non-English JSONs from en.json)
  </read_first>
  <action>
**This task adds NEW keys ONLY — do NOT touch the existing `profile.language` subtree (Plan 07-04 ships it). Insert all new keys as siblings of `profile.language` under the existing `profile:` object.**

The full new key inventory + the EXACT English source string for each key (copied verbatim from the file line numbers above so the executor never needs to re-read VERIFICATION.md):

```json
{
  "profile": {
    "language": {
      /* EXISTING — DO NOT MODIFY */
    },

    "head": {
      "tapToEdit": "tap to edit"
    },

    "lifetime": {
      "contributed": "contributed",
      "acrossNTasks": "Across {{count}} tasks"
    },

    "fields": {
      "name": "Name",
      "age": "Age",
      "gender": "Gender",
      "joined": "Joined"
    },

    "actions": {
      "help": "Help Center",
      "logout": "Logout",
      "delete": "Delete account"
    },

    "payments": {
      "title": "Payments & Earnings",
      "comingSoon": "COMING SOON",
      "body": "Payouts process offline. Your earnings will reflect in the app soon. Keep recording — your data is safe and your payouts are guaranteed."
    },

    "errors": {
      "couldNotUpdate": {
        "title": "Could not update",
        "body": "Please try again."
      }
    },

    "delete": {
      "title": "Delete your Humyn account?",
      "body": "Your account will be deactivated for 30 days. Log in within that window to restore it. After 30 days, deletion is permanent. Recordings already uploaded remain on our servers.",
      "cancel": "Cancel",
      "continueToDelete": "Continue to delete",
      "typeToConfirmTitle": "Type DELETE to confirm.",
      "placeholder": "DELETE",
      "confirm": "Confirm",
      "deleting": "Deleting…",
      "errors": {
        "couldNotDelete": {
          "title": "Could not delete",
          "body": "Try again later."
        }
      }
    }
  }
}
```

**Critical drift-detector parity (mirrors Plan 07-05 Task 3 step 4 pattern):**

- `en.json` `profile.payments.body` MUST be BYTE-EQUAL to the `PAYMENTS_BODY` constant at `apps/mobile/src/screens/profile/ProfileScreen.tsx` line 51-52. The constant is the design canon (verbatim from `idea-brief.md §5.11`). If you cannot achieve byte-parity, STOP — fix `en.json` to match (NEVER the constant).
- `en.json` `profile.delete.body` MUST be BYTE-EQUAL to the `STEP1_BODY` constant at `apps/mobile/src/components/DeleteAccountModal.tsx` line 72-73 (verbatim from `design-spec.md §18.4`).
- `en.json` `profile.delete.placeholder` is the literal string `"DELETE"` matching the `REQUIRED_TEXT` constant (case-sensitive validator at line 77). DO NOT translate this string in any locale; the LLM regen will need to be guided OR the value must be preserved post-regen (acceptance criterion verifies this).
- `en.json` `profile.delete.typeToConfirmTitle` is the string `"Type DELETE to confirm."` — the word `DELETE` inside the sentence is part of UX copy and CAN translate per-locale (e.g. Hindi might render `"पुष्टि के लिए DELETE लिखें।"` or similar — that's the LLM's call), but the placeholder (`profile.delete.placeholder`) MUST stay literal `"DELETE"` because the validator at line 98 compares `typed === REQUIRED_TEXT` (`'DELETE'`).

**Implementation steps:**

1. Read `apps/mobile/src/i18n/locales/en.json` in full.

2. Locate the existing `"profile": { "language": { ... } }` object (per the grep result, the only existing `profile.*` subtree is `profile.language`).

3. Add the new sibling keys (`head`, `lifetime`, `fields`, `actions`, `payments`, `errors`, `delete`) UNDER the existing `profile:` object. Preserve `profile.language` verbatim.

4. Ensure JSON formatting matches existing en.json style (2-space indent, double-quoted keys, no trailing commas).

5. Verify byte-parity for the two design-canon strings:

   ```bash
   node -e "
   const fs = require('fs');
   const en = JSON.parse(fs.readFileSync('apps/mobile/src/i18n/locales/en.json','utf8'));
   const profSrc = fs.readFileSync('apps/mobile/src/screens/profile/ProfileScreen.tsx','utf8');
   const delSrc = fs.readFileSync('apps/mobile/src/components/DeleteAccountModal.tsx','utf8');
   const pmMatch = profSrc.match(/PAYMENTS_BODY\s*=\s*\n?\s*'([^']*)'/);
   const stepMatch = delSrc.match(/STEP1_BODY\s*=\s*\n?\s*'([^']*)'/);
   if (!pmMatch) { console.error('FAIL: cannot find PAYMENTS_BODY'); process.exit(2); }
   if (!stepMatch) { console.error('FAIL: cannot find STEP1_BODY'); process.exit(2); }
   if (en.profile?.payments?.body !== pmMatch[1]) {
     console.error('FAIL: en.profile.payments.body byte-mismatch vs PAYMENTS_BODY constant');
     console.error('en value:', JSON.stringify(en.profile?.payments?.body));
     console.error('src value:', JSON.stringify(pmMatch[1]));
     process.exit(3);
   }
   if (en.profile?.delete?.body !== stepMatch[1]) {
     console.error('FAIL: en.profile.delete.body byte-mismatch vs STEP1_BODY constant');
     process.exit(4);
   }
   console.log('OK: design-canon byte-parity verified');
   "
   ```

6. Verify the JSON parses cleanly:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('apps/mobile/src/i18n/locales/en.json','utf8')); console.log('OK: en.json valid JSON');"
   ```

  </action>
  <verify>
    <automated>node -e "const j=require('./apps/mobile/src/i18n/locales/en.json'); const p=j.profile||{}; const need=['head','lifetime','fields','actions','payments','errors','delete','language']; for(const k of need){ if(!p[k]){ console.error('MISSING profile.'+k); process.exit(1); } } if(!p.head.tapToEdit||!p.lifetime.contributed||!p.lifetime.acrossNTasks||!p.fields.name||!p.fields.age||!p.fields.gender||!p.fields.joined||!p.actions.help||!p.actions.logout||!p.actions.delete||!p.payments.title||!p.payments.comingSoon||!p.payments.body||!p.errors.couldNotUpdate.title||!p.errors.couldNotUpdate.body){ console.error('MISSING leaf'); process.exit(2); } const d=p.delete; if(!d.title||!d.body||!d.cancel||!d.continueToDelete||!d.typeToConfirmTitle||!d.placeholder||!d.confirm||!d.deleting||!d.errors.couldNotDelete.title||!d.errors.couldNotDelete.body){ console.error('MISSING delete leaf'); process.exit(3); } if(d.placeholder!=='DELETE'){ console.error('placeholder must be literal DELETE'); process.exit(4); } console.log('OK: all required leaves present');"</automated>
  </verify>
  <acceptance_criteria>
    - `node -e "JSON.parse(require('fs').readFileSync('apps/mobile/src/i18n/locales/en.json','utf8'))"` exits 0 (still valid JSON).
    - `grep -c '"profile":' apps/mobile/src/i18n/locales/en.json` returns at least 1.
    - `node -e "const p=require('./apps/mobile/src/i18n/locales/en.json').profile; const need=['language','head','lifetime','fields','actions','payments','errors','delete']; for(const k of need){ if(!p[k]){process.exit(1)} } console.log('OK')"` exits 0 with `OK`.
    - All 17 documented dotted-path leaves resolve to non-empty strings (see automated verify above).
    - `node -e "const p=require('./apps/mobile/src/i18n/locales/en.json').profile; if(p.delete.placeholder!=='DELETE')process.exit(1)"` exits 0 (placeholder is literal `DELETE`).
    - Byte-parity script (action step 5) exits 0 (`profile.payments.body` byte-equal to PAYMENTS_BODY; `profile.delete.body` byte-equal to STEP1_BODY).
    - Existing `profile.language.row.label` is preserved (regression check): `node -e "if(require('./apps/mobile/src/i18n/locales/en.json').profile.language.row.label!=='Language')process.exit(1)"` exits 0.
  </acceptance_criteria>
  <done>en.json contains the new `profile.*` (head/lifetime/fields/actions/payments/errors) + `profile.delete.*` (title/body/cancel/continueToDelete/typeToConfirmTitle/placeholder/confirm/deleting/errors.couldNotDelete) namespaces with byte-parity to the two design-canon constants. JSON parses cleanly; existing `profile.language` subtree untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Route every hardcoded label in ProfileScreen.tsx through t() at the 14 enumerated call sites</name>
  <files>apps/mobile/src/screens/profile/ProfileScreen.tsx</files>
  <read_first>
    - apps/mobile/src/screens/profile/ProfileScreen.tsx (full file — the executor edits ONLY these line ranges: 156, 246, 258, 261, 269, 273, 278, 284, 286, 293, 301, 335, 347, 359; everything else stays as-is)
    - apps/mobile/src/i18n/locales/en.json (post-Task-1 state — the keys this task references)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-05-screen-string-sweep-and-bilingual-consent-PLAN.md (Task 1 procedure — match the same `t('key')` substitution + `useTranslation()` destructure pattern; the file ALREADY has `const { t, i18n } = useTranslation();` at line 74, so no new hook destructure is needed)
  </read_first>
  <action>
**The file ALREADY imports `useTranslation` (line 22) AND destructures `t` + `i18n` (line 74)** because Plan 07-04 added the Language row. NO new imports or destructures are needed — only the call-site substitutions.

**The 14 enumerated call sites + EXACT diff per site** (copy verbatim — line numbers reference the current file state):

**Line 156** — `saveField` error Alert:

```diff
- Alert.alert('Could not update', 'Please try again.');
+ Alert.alert(t('profile.errors.couldNotUpdate.title'), t('profile.errors.couldNotUpdate.body'));
```

**Line 246** — head "tap to edit" caption:

```diff
- <Text variant="caption" tone="tertiary">
-   tap to edit
- </Text>
+ <Text variant="caption" tone="tertiary">
+   {t('profile.head.tapToEdit')}
+ </Text>
```

**Line 258** — lifetime "contributed":

```diff
- <Text variant="caption" tone="secondary">
-   contributed
- </Text>
+ <Text variant="caption" tone="secondary">
+   {t('profile.lifetime.contributed')}
+ </Text>
```

**Line 261** — lifetime "Across {N} tasks" (i18next interpolation `{{count}}` per D-08):

```diff
- <Text variant="caption" tone="secondary">
-   Across {lifetime.taskCount} tasks
- </Text>
+ <Text variant="caption" tone="secondary">
+   {t('profile.lifetime.acrossNTasks', { count: lifetime.taskCount })}
+ </Text>
```

**Line 269** — payments card title:

```diff
- <Text variant="btnLabel" style={styles.earningsTitle}>
-   Payments & Earnings
- </Text>
+ <Text variant="btnLabel" style={styles.earningsTitle}>
+   {t('profile.payments.title')}
+ </Text>
```

**Line 273** — COMING SOON badge:

```diff
- <Text variant="comingSoonBadge" style={styles.comingSoonText}>
-   COMING SOON
- </Text>
+ <Text variant="comingSoonBadge" style={styles.comingSoonText}>
+   {t('profile.payments.comingSoon')}
+ </Text>
```

**Line 278** — PAYMENTS_BODY render. The constant `PAYMENTS_BODY` (lines 51-52) stays UNCHANGED (design canon, drift detector). The render site swaps to `t()`:

```diff
- <Text variant="caption" tone="secondary" style={styles.earningsBody}>
-   {PAYMENTS_BODY}
- </Text>
+ <Text variant="caption" tone="secondary" style={styles.earningsBody}>
+   {t('profile.payments.body')}
+ </Text>
```

NOTE: Do NOT remove the `PAYMENTS_BODY` constant declaration. It remains as the design-canon drift detector (any future edit shows up in code review; the Task-1 byte-parity gate enforces en.json stays equal to it). The constant becomes a static reference that the runtime no longer reads — that is INTENTIONAL.

**Line 284** — Name field label (InlineEditField `label` prop):

```diff
- <InlineEditField label="Name" value={me.name} onSave={(v) => saveField('name', v)} />
+ <InlineEditField label={t('profile.fields.name')} value={me.name} onSave={(v) => saveField('name', v)} />
```

**Line 286** — Age field label:

```diff
- label="Age"
+ label={t('profile.fields.age')}
```

**Line 293** — Gender field label:

```diff
- label="Gender"
+ label={t('profile.fields.gender')}
```

**Line 301** — Joined field label (the inner `<Text>` containing "Joined"; the formatDate `{joined}` render below it at line 304 stays as-is — already locale-aware via Plan 07-04 D-37):

```diff
- <Text variant="body" style={styles.fieldLabel}>
-   Joined
- </Text>
+ <Text variant="body" style={styles.fieldLabel}>
+   {t('profile.fields.joined')}
+ </Text>
```

**Line 335** — Help Center action row label:

```diff
- <Text variant="body" style={styles.fieldLabel}>
-   Help Center
- </Text>
+ <Text variant="body" style={styles.fieldLabel}>
+   {t('profile.actions.help')}
+ </Text>
```

**Line 347** — Logout action row label:

```diff
- <Text variant="body" style={styles.fieldLabel}>
-   Logout
- </Text>
+ <Text variant="body" style={styles.fieldLabel}>
+   {t('profile.actions.logout')}
+ </Text>
```

**Line 359** — Delete account action row label (the inner `<Text>` with `styles.dangerLabel` containing "Delete account"; the `›` chevron `<Text>` below stays as-is — it's a UI glyph, not translatable copy):

```diff
- <Text variant="body" style={styles.dangerLabel}>
-   Delete account
- </Text>
+ <Text variant="body" style={styles.dangerLabel}>
+   {t('profile.actions.delete')}
+ </Text>
```

**Explicitly NOT modified** (these are debug-only identifiers or already-translated / non-translatable):

- All `accessibilityLabel="..."` props (debug identifiers per Plan 07-05 Task 1 rule — `"profile-action-language"`, `"profile-action-help"`, etc.)
- Line 188 `"Loading…"` placeholder (out of scope — the gap report only lists the 14 lines above; a `Loading…` substitution is plausible-good but outside WR-01's enumerated artifact list, so leave it for a future sweep)
- Line 218 `(me.name || 'A')` fallback letter (not translatable)
- Line 326 `LOCALE_NATIVE_NAMES[...] ?? 'English'` fallback (English native-name fallback — not translatable; the native name IS the user-facing form)
- Line 338, 350, 362 `›` chevron `<Text>` (UI glyph, not translatable copy)
- Line 174 `{error}` error message (server-side string, not in `en.json`)
- Line 374 footer `v{versionName} ({versionCode}) · {flavor}` (technical identifier)
- Lines 51-52 `PAYMENTS_BODY` constant (design canon — KEEP)
- All `GENDER_OPTIONS` strings (line 58 — owner-locked enum sent to backend; backend stores literal string. NOT in scope per WR-01 enumeration.)

**After making all 14 edits:**

1. Run TypeScript:

   ```bash
   cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "(ProfileScreen|error TS)" | head -10
   ```

   Expected: zero errors related to ProfileScreen.tsx.

2. Verify no other hardcoded English label literals remain at the enumerated lines:

   ```bash
   # Spot-check: search for the exact removed strings on the modified lines.
   grep -nE "'tap to edit'|>tap to edit<|>contributed<|>Across \{|'Payments & Earnings'|>Payments & Earnings<|>COMING SOON<|label=\"Name\"|label=\"Age\"|label=\"Gender\"|>Joined<|>Help Center<|>Logout<|>Delete account<" apps/mobile/src/screens/profile/ProfileScreen.tsx
   ```

   Expected: zero hits (the regex is intentionally narrow — it catches JSX text children and `label=` prop literals only, not comments or doc-block prose).

3. Verify the substitutions landed (at least 14 new `t('profile...` calls in the file):
   ```bash
   grep -cE "t\('profile\." apps/mobile/src/screens/profile/ProfileScreen.tsx
   ```
   Expected: >= 15 (14 new + the existing `t('profile.language.row.label')` from Plan 07-04).

  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "(profile/ProfileScreen).*error TS" | head -5; HITS=$(grep -cE "t\('profile\." apps/mobile/src/screens/profile/ProfileScreen.tsx); echo "t('profile... hits: $HITS"; if [ "$HITS" -lt 15 ]; then echo "FAIL: expected >=15 t() calls, got $HITS"; exit 1; fi; BAD=$(grep -cE "label=\"Name\"|label=\"Age\"|label=\"Gender\"" apps/mobile/src/screens/profile/ProfileScreen.tsx); if [ "$BAD" -gt 0 ]; then echo "FAIL: hardcoded label= literals remain"; exit 2; fi; echo "OK"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -cE "t\\('profile\\." apps/mobile/src/screens/profile/ProfileScreen.tsx` returns at least 15 (14 new + 1 pre-existing `profile.language.row.label`).
    - `grep -cE 'label="Name"|label="Age"|label="Gender"' apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 0 (InlineEditField `label=` props are now t() calls, not string literals).
    - `grep -c "Alert.alert('Could not update'" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 0 (Alert routes through t()).
    - `grep -nE "(>tap to edit<|>contributed<|>Payments & Earnings<|>COMING SOON<|>Joined<|>Help Center<|>Logout<|>Delete account<)" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 0 matches (every enumerated JSX text-child label flows through t()).
    - `grep -c "PAYMENTS_BODY" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns at least 1 (constant declaration retained as design-canon drift detector — its render site swapped to `t('profile.payments.body')` but the constant declaration stays).
    - `grep -c "useTranslation" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns at least 1 (import already present from Plan 07-04 — unchanged).
    - `cd apps/mobile && npx tsc --noEmit` produces no new errors for `apps/mobile/src/screens/profile/ProfileScreen.tsx`.
    - `cd apps/mobile && npm test -- --run 2>&1 | tail -5` exits 0 (no regression in existing tests; if any ProfileScreen test asserts on a literal English label that is now translated, update that test to assert on `t('profile.fields.name')`-style resolution OR keep the literal because in tests i18n.language defaults to 'en' and `t()` returns the English string — both are acceptable).
  </acceptance_criteria>
  <done>14 hardcoded English label literals + 1 Alert call in ProfileScreen.tsx are routed through `t(...)` per the enumerated diff. PAYMENTS_BODY constant retained as design-canon drift detector. TypeScript clean; mobile test suite green.</done>
</task>

<task type="auto">
  <name>Task 3: Route every hardcoded label in DeleteAccountModal.tsx through t() at the 9 enumerated call sites</name>
  <files>apps/mobile/src/components/DeleteAccountModal.tsx</files>
  <read_first>
    - apps/mobile/src/components/DeleteAccountModal.tsx (full file — the executor edits ONLY these line ranges: 99, 133, 146, 156, 164, 173, 181, 191, 199; everything else stays as-is including the file's header documentation comment block lines 1-57 and Pattern 66 / Pattern 61 logic)
    - apps/mobile/src/i18n/locales/en.json (post-Task-1 state — the keys this task references under `profile.delete.*`)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-05-screen-string-sweep-and-bilingual-consent-PLAN.md (Task 1 procedure — `useTranslation()` import + destructure pattern; this file does NOT yet import useTranslation, so the import + destructure MUST be added)
  </read_first>
  <action>
**The file does NOT currently import `useTranslation`** (unlike ProfileScreen.tsx). The first change adds the import + the destructure.

**Step A — add the import** (insert after the existing React import block at the top, sibling to the `'@react-navigation/native'` line):

```diff
  import React, { useRef, useState } from 'react';
  import { Alert, Modal, StyleSheet, TextInput, View } from 'react-native';
  import { useNavigation } from '@react-navigation/native';
+ import { useTranslation } from 'react-i18next';
  import { Text } from '../ui/primitives/Text';
```

**Step B — destructure `t` inside the component body** (insert as the first line of the `DeleteAccountModal` component body, sibling to the existing `const nav = useNavigation<...>(...)` line at line 80):

```diff
  export function DeleteAccountModal(): React.JSX.Element {
+   const { t } = useTranslation();
    const nav = useNavigation<{ goBack: () => void; reset: (state: object) => void }>();
```

**Step C — the 9 enumerated call-site diffs:**

**Line 99** — typed-text validator error Alert (single-arg form; t() returns the title-as-message):

```diff
- Alert.alert('Type DELETE to confirm.');
+ Alert.alert(t('profile.delete.typeToConfirmTitle'));
```

**Line 133** — deleteMe() failure Alert (preserves the `e instanceof Error ? e.message : <fallback>` pattern — the FALLBACK string flows through t(); the `e.message` from the API error stays in its original language per D-35 "raw English `detail` to Crashlytics" precedent — surfacing it untranslated is consistent with Plan 07-05 D-34 error-toast mapping where unknown codes show generic translated copy):

```diff
- Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again later.');
+ Alert.alert(
+   t('profile.delete.errors.couldNotDelete.title'),
+   e instanceof Error ? e.message : t('profile.delete.errors.couldNotDelete.body'),
+ );
```

**Line 146** — Step 1 title:

```diff
- <Text variant="sheetTitle" style={styles.title}>
-   Delete your Humyn account?
- </Text>
+ <Text variant="sheetTitle" style={styles.title}>
+   {t('profile.delete.title')}
+ </Text>
```

**Line 149** — Step 1 body. The constant `STEP1_BODY` (lines 72-73) stays UNCHANGED (design canon, drift detector — same pattern as ProfileScreen PAYMENTS_BODY in Task 2). The render site swaps to `t()`:

```diff
- <Text variant="body" tone="secondary" style={styles.body}>
-   {STEP1_BODY}
- </Text>
+ <Text variant="body" tone="secondary" style={styles.body}>
+   {t('profile.delete.body')}
+ </Text>
```

NOTE: Do NOT remove the `STEP1_BODY` constant declaration. It remains as the design-canon drift detector; the Task-1 byte-parity gate enforces `en.json profile.delete.body` stays equal to it.

**Line 156** — Step 1 Cancel button label:

```diff
- label="Cancel"
+ label={t('profile.delete.cancel')}
```

(There are TWO `label="Cancel"` Button calls in this file — at line 156 inside Step 1 and at line 191 inside Step 2. Both translate to the same key `profile.delete.cancel`. This diff applies to BOTH occurrences.)

**Line 164** — Step 1 Continue-to-delete button label:

```diff
- label="Continue to delete"
+ label={t('profile.delete.continueToDelete')}
```

**Line 173** — Step 2 title:

```diff
- <Text variant="sheetTitle" style={styles.title}>
-   Type DELETE to confirm.
- </Text>
+ <Text variant="sheetTitle" style={styles.title}>
+   {t('profile.delete.typeToConfirmTitle')}
+ </Text>
```

**Line 181** — TextInput placeholder. The placeholder visual hint translates per-locale, BUT the validator at line 98 compares `typed !== REQUIRED_TEXT` ('DELETE' literal). The placeholder is a HINT, not the validator input — so the placeholder string itself stays the literal `DELETE` so the user sees what to type. Task 1 already enforced `en.json profile.delete.placeholder === 'DELETE'`, and the LLM regen prompt must preserve this literal in non-English locales (Task 4 acceptance verifies):

```diff
- placeholder="DELETE"
+ placeholder={t('profile.delete.placeholder')}
```

**Line 191** — Step 2 Cancel button label (SECOND `label="Cancel"` occurrence — same diff as Line 156):

```diff
- label="Cancel"
+ label={t('profile.delete.cancel')}
```

**Line 199** — submit button label, dynamic submitting/idle:

```diff
- label={submitting ? 'Deleting…' : 'Confirm'}
+ label={t(submitting ? 'profile.delete.deleting' : 'profile.delete.confirm')}
```

**Explicitly NOT modified:**

- File header comment block (lines 1-57) — documentation, not user-visible.
- `accessibilityLabel="delete-cancel"`, `"delete-continue"`, `"delete-cancel-2"`, `"delete-confirm"`, `"delete-typing-input"`, `"delete-account-modal"` — debug identifiers per Plan 07-05 Task 1 rule.
- `placeholderTextColor={colors.text3}` — style prop.
- `STEP1_BODY` constant declaration (lines 72-73) — design-canon drift detector, KEEP.
- `REQUIRED_TEXT` constant (line 77) — case-sensitive validator literal, KEEP.
- The `localeMmkv.remove(...)` block (lines 113-118) — Plan 07-04 wiring, untouched.

**After making all edits:**

1. TypeScript check:

   ```bash
   cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "(DeleteAccountModal).*error TS" | head -10
   ```

   Expected: zero errors related to DeleteAccountModal.tsx.

2. Verify all 9 substitutions landed:

   ```bash
   grep -cE "t\('profile\.delete\." apps/mobile/src/components/DeleteAccountModal.tsx
   ```

   Expected: >= 10 (9 unique keys + the Cancel key referenced twice = 10 total t() invocations).

3. Verify no hardcoded English label literals remain at the enumerated lines:
   ```bash
   grep -nE "(label=\"Cancel\"|label=\"Confirm\"|label=\"Deleting|label=\"Continue to delete\"|placeholder=\"DELETE\"|>Delete your Humyn account\?<|>Type DELETE to confirm\.<)" apps/mobile/src/components/DeleteAccountModal.tsx
   ```
   Expected: zero hits.

  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "(components/DeleteAccountModal).*error TS" | head -5; HITS=$(grep -cE "t\('profile\.delete\." apps/mobile/src/components/DeleteAccountModal.tsx); echo "t('profile.delete... hits: $HITS"; if [ "$HITS" -lt 10 ]; then echo "FAIL: expected >=10 t() calls, got $HITS"; exit 1; fi; BAD=$(grep -cE 'label="Cancel"|label="Confirm"|label="Continue to delete"' apps/mobile/src/components/DeleteAccountModal.tsx); if [ "$BAD" -gt 0 ]; then echo "FAIL: hardcoded label= literals remain"; exit 2; fi; UT=$(grep -c "useTranslation" apps/mobile/src/components/DeleteAccountModal.tsx); if [ "$UT" -lt 1 ]; then echo "FAIL: useTranslation not imported"; exit 3; fi; echo "OK"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "useTranslation" apps/mobile/src/components/DeleteAccountModal.tsx` returns at least 1 (import + destructure added).
    - `grep -cE "t\\('profile\\.delete\\." apps/mobile/src/components/DeleteAccountModal.tsx` returns at least 10 (9 unique keys + Cancel referenced twice).
    - `grep -cE 'label="Cancel"|label="Confirm"|label="Continue to delete"|placeholder="DELETE"' apps/mobile/src/components/DeleteAccountModal.tsx` returns 0.
    - `grep -c "Alert.alert('Could not delete'" apps/mobile/src/components/DeleteAccountModal.tsx` returns 0; `grep -c "Alert.alert('Type DELETE" apps/mobile/src/components/DeleteAccountModal.tsx` returns 0 (both Alerts route through t()).
    - `grep -nE "(>Delete your Humyn account\\?<|>Type DELETE to confirm\\.<)" apps/mobile/src/components/DeleteAccountModal.tsx` returns 0 (Step 1 + Step 2 titles flow through t()).
    - `grep -c "STEP1_BODY" apps/mobile/src/components/DeleteAccountModal.tsx` returns at least 1 (constant declaration retained as design-canon drift detector).
    - `grep -c "REQUIRED_TEXT" apps/mobile/src/components/DeleteAccountModal.tsx` returns at least 2 (constant declaration + the `typed !== REQUIRED_TEXT` validator at the existing line 98 unchanged).
    - `cd apps/mobile && npx tsc --noEmit` produces no new errors for `apps/mobile/src/components/DeleteAccountModal.tsx`.
    - `cd apps/mobile && npm test -- --run 2>&1 | tail -5` exits 0 (no regression).
  </acceptance_criteria>
  <done>9 hardcoded English labels + 2 Alert calls in DeleteAccountModal.tsx are routed through `t(...)` per the enumerated diff. `useTranslation` import + destructure added. STEP1_BODY + REQUIRED_TEXT constants retained. TypeScript clean; mobile test suite green.</done>
</task>

<task type="auto">
  <name>Task 4: Regenerate 7 non-English locale catalogs via LLM tool + validate shape parity</name>
  <files>apps/mobile/src/i18n/locales/pt-BR.json, apps/mobile/src/i18n/locales/es.json, apps/mobile/src/i18n/locales/hi-IN.json, apps/mobile/src/i18n/locales/bn-IN.json, apps/mobile/src/i18n/locales/ta-IN.json, apps/mobile/src/i18n/locales/te-IN.json, apps/mobile/src/i18n/locales/mr-IN.json</files>
  <read_first>
    - apps/mobile/src/i18n/locales/en.json (post-Task-1 — the source the LLM regen reads)
    - tools/i18n/generate.ts (the LLM regen tool from Plan 07-02; entry script `pnpm i18n:generate` per tools/package.json)
    - tools/i18n/validate.ts (the shape-parity validator from Plan 07-02; entry script `pnpm i18n:validate`)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-05-screen-string-sweep-and-bilingual-consent-PLAN.md Task 3 step 5/6 (the analogous regen + validate invocation used at the end of Plan 07-05; match its phrasing exactly)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md §decisions D-10, D-11, D-12 (LLM provider, execution model, drift handling via i18next key-fallback)
  </read_first>
  <action>
**Pre-flight requirement:** `tools/.env` must have a valid `ANTHROPIC_API_KEY` per Plan 07-02 user_setup. Verify before starting:

```bash
test -f tools/.env && grep -q "^ANTHROPIC_API_KEY=" tools/.env && echo "OK: ANTHROPIC_API_KEY present" || echo "FAIL: tools/.env missing or ANTHROPIC_API_KEY not set"
```

**If the API key is NOT provisioned**: STOP. Surface this in the SUMMARY as a Wave-2 follow-up (NOT a blocker for the in-code Tasks 1-3, but the catalogs cannot regenerate without the key). Per Plan 07-05 Task 3 step 5 precedent — "do not attempt to commit placeholder data as translated".

**Regen invocation (matches Plan 07-05 Task 3 step 5 verbatim):**

```bash
cd tools && pnpm i18n:generate 2>&1 | tail -30
```

This makes 7 sequential Claude Opus 4.7 calls (D-10), one per non-English locale (D-11), each sending the full updated `en.json` + the vernacular system brief + a per-locale user prompt. Each response OVERWRITES the corresponding `apps/mobile/src/i18n/locales/{loc}.json` file. The script's built-in shape-parity gate runs against each locale; failures are logged + skipped (the existing file stays in place — per D-12 + Plan 07-02 design).

**Critical post-regen sanity checks specific to this gap closure:**

1. **The `profile.delete.placeholder` literal MUST be preserved as `"DELETE"` in every locale.** The TextInput placeholder hint must match the case-sensitive validator at DeleteAccountModal.tsx line 98 (`typed !== REQUIRED_TEXT` where REQUIRED_TEXT === 'DELETE'). The LLM may try to translate it; if any locale has a non-DELETE value, manually patch the JSON to `"DELETE"` (per-locale single-string fix, no need to re-run the full LLM regen):

   ```bash
   for loc in pt-BR es hi-IN bn-IN ta-IN te-IN mr-IN; do
     VAL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('apps/mobile/src/i18n/locales/$loc.json','utf8')).profile?.delete?.placeholder)")
     if [ "$VAL" != "DELETE" ]; then
       echo "FIX_NEEDED: $loc placeholder = '$VAL' (must be 'DELETE')"
       node -e "
         const fs = require('fs');
         const p = 'apps/mobile/src/i18n/locales/$loc.json';
         const j = JSON.parse(fs.readFileSync(p,'utf8'));
         j.profile.delete.placeholder = 'DELETE';
         fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
         console.log('FIXED: $loc placeholder forced to DELETE');
       "
     else
       echo "OK: $loc placeholder = 'DELETE'"
     fi
   done
   ```

2. **The `profile.payments.body` MUST be a real translation, not skeleton-English copy.** Spot-check at least one locale (hi-IN):

   ```bash
   node -e "const j=require('./apps/mobile/src/i18n/locales/hi-IN.json'); console.log('hi-IN profile.payments.body:', j.profile?.payments?.body)"
   ```

   Expected: Devanagari script, not the English source text. If skeleton-English remains, the LLM call for that locale failed silently — re-run the regen for that one locale or hand-fix.

3. **The `profile.delete.body` MUST be a real translation.** Same spot-check:
   ```bash
   node -e "const j=require('./apps/mobile/src/i18n/locales/hi-IN.json'); console.log('hi-IN profile.delete.body:', j.profile?.delete?.body)"
   ```

**Validate shape parity across all 7 non-English catalogs (matches Plan 07-05 Task 3 step 6 verbatim):**

```bash
cd tools && pnpm i18n:validate 2>&1 | tail -10
```

Expected output: `[validate] {loc}: OK` for all 7 locales. If any reports `missing` or `extra` paths, re-run the regen for that locale or hand-fix.

**Confirm all 7 non-English JSONs + their audit sidecars are committed:**

```bash
git status apps/mobile/src/i18n/locales/
```

7 JSONs + 7 `{loc}.audit.json` sidecars should show as modified (the audit sidecars are written by `buildAuditSidecar` inside `generate.ts` per Plan 07-02 / Plan 07-05 Task 3 step 7).

**Programmatic shape-parity cross-check** (mirrors the Plan 07-05 Task 3 acceptance phrasing — every locale has the same dotted-walk paths as en.json):

```bash
node -e "
const fs = require('fs');
function paths(o, prefix='') {
  const out = [];
  for (const k of Object.keys(o)) {
    const next = prefix ? prefix + '.' + k : k;
    if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) {
      out.push(...paths(o[k], next));
    } else {
      out.push(next);
    }
  }
  return out.sort();
}
const en = JSON.parse(fs.readFileSync('apps/mobile/src/i18n/locales/en.json','utf8'));
const enPaths = paths(en);
const enSet = new Set(enPaths);
let failed = false;
for (const loc of ['pt-BR','es','hi-IN','bn-IN','ta-IN','te-IN','mr-IN']) {
  const j = JSON.parse(fs.readFileSync('apps/mobile/src/i18n/locales/' + loc + '.json','utf8'));
  const locPaths = paths(j);
  const locSet = new Set(locPaths);
  const missing = enPaths.filter(p => !locSet.has(p));
  const extra = locPaths.filter(p => !enSet.has(p));
  if (missing.length || extra.length) {
    failed = true;
    console.error('FAIL ' + loc + ': missing=' + missing.length + ', extra=' + extra.length);
    if (missing.length) console.error('  missing[0..5]:', missing.slice(0,5));
    if (extra.length) console.error('  extra[0..5]:', extra.slice(0,5));
  } else {
    console.log('OK ' + loc + ': ' + locPaths.length + ' leaves match en.json');
  }
}
process.exit(failed ? 1 : 0);
"
```

  </action>
  <verify>
    <automated>cd tools && pnpm i18n:validate 2>&1 | tail -10 && echo "---shape-parity-cross-check---" && node -e "const fs=require('fs');function paths(o,p=''){const o2=[];for(const k of Object.keys(o)){const n=p?p+'.'+k:k;if(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k]))o2.push(...paths(o[k],n));else o2.push(n);}return o2.sort();}const en=JSON.parse(fs.readFileSync('apps/mobile/src/i18n/locales/en.json','utf8'));const enS=new Set(paths(en));let f=false;for(const l of ['pt-BR','es','hi-IN','bn-IN','ta-IN','te-IN','mr-IN']){const j=JSON.parse(fs.readFileSync('apps/mobile/src/i18n/locales/'+l+'.json','utf8'));const lp=paths(j);const lS=new Set(lp);const m=paths(en).filter(p=>!lS.has(p));const e=lp.filter(p=>!enS.has(p));if(m.length||e.length){f=true;console.error('FAIL '+l+': missing='+m.length+', extra='+e.length);}else console.log('OK '+l);}process.exit(f?1:0);"</automated>
  </verify>
  <acceptance_criteria>
    - All 8 locale JSONs parseable: `for f in apps/mobile/src/i18n/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || exit 1; done` exits 0.
    - `cd tools && pnpm i18n:validate` exits 0 with `OK` per locale (assuming `ANTHROPIC_API_KEY` was provisioned; if not, the deferral is documented in the SUMMARY per Plan 07-05 Task 3 step 5 precedent).
    - Shape-parity cross-check (action step's node one-liner) prints `OK {loc}` for all 7 non-English locales and exits 0.
    - `profile.delete.placeholder === "DELETE"` in all 7 non-English locales (case-sensitive validator preservation): `for loc in pt-BR es hi-IN bn-IN ta-IN te-IN mr-IN; do node -e "if(require('./apps/mobile/src/i18n/locales/$loc.json').profile.delete.placeholder !== 'DELETE') process.exit(1)" || exit 1; done` exits 0.
    - hi-IN `profile.delete.body` is non-empty AND NOT byte-equal to the English source (proves real translation, not skeleton-English fallback): `node -e "const en=require('./apps/mobile/src/i18n/locales/en.json').profile.delete.body; const hi=require('./apps/mobile/src/i18n/locales/hi-IN.json').profile.delete.body; if(!hi||hi.length===0)process.exit(1); if(hi===en){console.warn('WARN: hi-IN profile.delete.body is skeleton-English — LLM regen for hi-IN may have failed silently'); process.exit(2);} console.log('OK: hi-IN body is translated, '+hi.length+' chars');"` exits 0 (warns + exits 2 if skeleton-English, which means the executor must re-run the regen for hi-IN before considering the plan done).
    - Same spot-check for pt-BR `profile.delete.body` (the other regen-quality canary for the bilingual consent §3 walk's analog).
    - Audit sidecars present: `for loc in pt-BR es hi-IN bn-IN ta-IN te-IN mr-IN; do test -f "apps/mobile/src/i18n/locales/$loc.audit.json" || exit 1; done` exits 0.
  </acceptance_criteria>
  <done>7 non-English locale JSONs regenerated with real translations (no skeleton-English on the new `profile.*` + `profile.delete.*` subtrees). Shape parity holds across all 8 catalogs. `profile.delete.placeholder` literally `"DELETE"` in every locale (case-sensitive validator preserved). Audit sidecars committed.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                              | Description                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| LLM API response → mobile bundle                      | Translated catalog values rendered as Text via `t(...)`         |
| Catalog JSON → React Text rendering                   | Plural rules + `{{count}}` interpolation surface                |
| TextInput placeholder hint → case-sensitive validator | `placeholder` is UX hint; `typed !== REQUIRED_TEXT` is the gate |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                                                                                                                                                                                                             | Disposition | Mitigation Plan                                                                                                                                                                                                                                      |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-09-01 | Tampering              | LLM translates `profile.delete.placeholder` to a non-DELETE string in some locale, breaking the case-sensitive validator at `DeleteAccountModal.tsx:98` (user types the translated placeholder, validator rejects, user cannot delete account)        | mitigate    | Task 4 action step 1 enforces placeholder preservation via a per-locale node check that force-writes `"DELETE"` if drift detected. Acceptance criterion 4 verifies post-Task-4 state.                                                                |
| T-07-09-02 | Tampering              | LLM hallucinates additional keys not present in en.json (e.g. `profile.delete.foo`) under a non-English locale, shape parity drifts                                                                                                                   | mitigate    | `tools/i18n/validate.ts` shape-parity gate runs inside `pnpm i18n:validate` AND the standalone cross-check node one-liner in Task 4 verify. Mismatches log + the executor hand-fixes per Plan 07-05 step 6 precedent.                                |
| T-07-09-03 | Repudiation            | Design-canon drift if `PAYMENTS_BODY` or `STEP1_BODY` constant changes but `en.json` does not (the constants are still declared in the source files but no longer rendered — a future maintainer might edit either without noticing the parity break) | mitigate    | Task 1 action step 5 + acceptance enforces byte-parity at plan-execution time. Suggested follow-up (NOT in this plan): a CI gate or unit test that re-asserts the byte-parity on every commit. Flag this in the SUMMARY as a §v2 quality investment. |
| T-07-09-04 | Information Disclosure | `e.message` from `deleteMe()` failures bypasses the i18n surface and shows server-language English to a non-English user at `DeleteAccountModal.tsx:133`                                                                                              | accept      | Consistent with D-35 (raw English `detail` to Crashlytics + Plan 07-05 D-34 unknown-code generic fallback). The fallback string `'Try again later.'` IS translated; the `e.message` branch is best-effort server-text passthrough for debuggability. |
| T-07-09-05 | DoS                    | LLM regen makes 7 sequential API calls; single-locale failure does not abort others                                                                                                                                                                   | mitigate    | Per D-11 + Plan 07-02 generate.ts try/catch around each `generateLocale` call. Plan 07-05 Task 3 step 5 / 6 verbatim invocation pattern reused.                                                                                                      |

</threat_model>

<verification>
- `cd apps/mobile && npx tsc --noEmit` exits 0 (no TS errors introduced)
- `cd apps/mobile && npm test -- --run` exits 0 (no test regressions)
- `cd tools && pnpm i18n:validate` exits 0 (shape parity across all 7 non-English locales)
- `grep -cE "t\('profile\." apps/mobile/src/screens/profile/ProfileScreen.tsx` returns at least 15
- `grep -cE "t\('profile\.delete\." apps/mobile/src/components/DeleteAccountModal.tsx` returns at least 10
- `grep -cE 'label="Cancel"|label="Confirm"|label="Continue to delete"|placeholder="DELETE"' apps/mobile/src/components/DeleteAccountModal.tsx` returns 0
- `grep -c "Alert.alert('Could not update'" apps/mobile/src/screens/profile/ProfileScreen.tsx` returns 0
- `grep -c "Alert.alert('Could not delete'" apps/mobile/src/components/DeleteAccountModal.tsx` returns 0
- `git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md` returns empty (I18N-11 invariant — Phase 6 cosmetic-gaps doc untouched)
- `git diff --stat apps/mobile/ios/` returns empty (I18N-21 invariant — Android only)
- `git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/` returns empty (capture-spec invariant — Camera2 / MediaCodec / FinalizeWorker / MetadataComposer / Calibration code UNTOUCHED)
- `git diff --stat apps/api/drizzle/migrations/` returns empty (D-16 invariant — no DB migration)
- `git diff --stat idea-brief.md design-spec.md engineering-handoff.md prototype.html` returns empty (design-locked files unchanged)
- For all 7 non-English locales, `profile.delete.placeholder === "DELETE"` (case-sensitive validator preserved)
</verification>

<success_criteria>

- ProfileScreen.tsx renders 100% of its user-visible labels through `t(...)`
- DeleteAccountModal.tsx renders 100% of its user-visible labels through `t(...)`
- en.json gains the new `profile.*` (head/lifetime/fields/actions/payments/errors) + `profile.delete.*` (title/body/cancel/continueToDelete/typeToConfirmTitle/placeholder/confirm/deleting/errors.couldNotDelete) namespaces; PAYMENTS_BODY + STEP1_BODY byte-parity verified
- 7 non-English locale JSONs regenerated with real translations; shape parity holds; `profile.delete.placeholder === "DELETE"` literal preserved per locale
- No Phase 6 cosmetic-gaps doc edits (I18N-11 invariant)
- No iOS file modifications (I18N-21 invariant)
- No Camera2 / MediaCodec / FinalizeWorker / MetadataComposer / Calibration / capture-spec code touched (CLAUDE.md invariants)
- No DB migration (D-16 invariant)
- No design-locked file edits (prototype.html / design-spec.md / engineering-handoff.md / idea-brief.md §5.11 unchanged)
- TypeScript clean; full mobile test suite green

</success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-09-SUMMARY.md` per the standard template. Surface explicitly:

- The post-Task-1 en.json line-count delta + the count of new `profile.*` + `profile.delete.*` leaves added
- Confirmation that PAYMENTS_BODY + STEP1_BODY byte-parity gates passed
- Confirmation that the LLM regen ran (or, if `ANTHROPIC_API_KEY` was not available, the deferral flagged for the operator)
- The 7 audit sidecar SHA values for traceability (mirrors Plan 07-05 Task 3 step 7)
- Confirmation that `profile.delete.placeholder === "DELETE"` in every locale (preserves case-sensitive validator)
- Spot-check translations for hi-IN `profile.delete.body` + `profile.payments.body` to prove real-translation (not skeleton-English)

**Operator follow-up (NOT this plan's responsibility — surface in the SUMMARY for the next-step section):** Re-run `07-MANUAL-SMOKE.md` §2 (Profile Language picker per-locale walk) on at least one non-English locale (hi-IN recommended) to confirm Profile + Delete Account flows render fully translated. The other 9 §-sections of the smoke runbook (§1 i18n bootstrap, §3 bilingual consent, §4 TTS, §5 dates, §6 reverse-search, §7 live preview, §8 tap-reveal, §9 BLOCKING A/B drift, §10 capture-quality cancel gates, §11 grep gates) are unaffected by this gap closure and do NOT need re-walking.
</output>
