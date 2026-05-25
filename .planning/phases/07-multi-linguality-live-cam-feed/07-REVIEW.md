---
phase: 07-multi-linguality-live-cam-feed
reviewed: 2026-05-25T04:25:42Z
depth: standard
scope: WR-01 gap-closure (plan 07-09 — Profile + DeleteAccountModal i18n sweep)
files_reviewed: 3
files_reviewed_list:
  - apps/mobile/src/screens/profile/ProfileScreen.tsx
  - apps/mobile/src/components/DeleteAccountModal.tsx
  - apps/mobile/src/i18n/locales/en.json
findings:
  blocker: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 7: Code Review Report (WR-01 closure scope)

**Reviewed:** 2026-05-25T04:25:42Z
**Depth:** standard
**Scope:** Plan 07-09 — ProfileScreen.tsx + DeleteAccountModal.tsx i18n routing + en.json key-shape verification
**Files Reviewed:** 3
**Status:** issues_found

> Replaces the prior REVIEW.md (which covered the full Phase 7 surface — 99 files
> — pre-07-09). This narrow re-review surfaces 1 BLOCKER, 2 WARNINGs, and 3
> INFOs introduced or exposed by the 07-09 sweep.

## Summary

The 07-09 sweep routes ~25 hardcoded labels across two surfaces through
`useTranslation().t(...)`. The intentional retentions (`PAYMENTS_BODY`,
`STEP1_BODY` design-canon constants + `REQUIRED_TEXT='DELETE'` case-sensitive
validator + the `e.message` passthrough in `couldNotDelete`) are all
acknowledged in the user's review context and verified byte-equal to their
en.json counterparts (`node` confirmed `en.json profile.payments.body ===
PAYMENTS_BODY` and `en.json profile.delete.body === STEP1_BODY`).

One **BLOCKER** survived the sweep: the LLM-regenerated `pt-BR` and `es`
translations of `profile.delete.typeToConfirmTitle` translated the literal
DELETE token to language-native equivalents (EXCLUIR / ELIMINAR), but the
client-side validator + server-side `MeDeleteQuerySchema` still require the
case-sensitive string `DELETE`. Spanish and Brazilian-Portuguese users reading
the prompt and typing the word they're TOLD to type will see the Confirm
button stay disabled forever — they cannot delete their account through the
UI. Plan 07-09 Task 4 force-wrote the `placeholder` field to `"DELETE"` in
those two locales but did NOT extend the same protection to the TITLE that
prompts the user — the title is where the user actually reads what to type;
the placeholder is just the input's grey hint. This bug is entirely
non-English (es + pt-BR only); the en plus all 5 Indian locales correctly
preserved `DELETE` as a verbatim token inside the translated sentence.

Two **WARNINGs** are i18n leakage holes the sweep missed: a hardcoded
English `Loading…` literal at ProfileScreen.tsx:197 (the loading skeleton
is user-visible long enough to be noticed on cold start — and a
`common.loading` translation key already exists in every locale's
`common.loading`), and a user-rendered error string at ProfileScreen.tsx:186
that displays either raw server `e.message` (English server text leaking
through the UI) or the literal sentinel `'load_failed'` (un-translated
debug token) as visible body copy.

Three **INFOs** cover minor maintainability concerns (hardcoded `'English'`
fallback at line 341 that could reuse `LOCALE_NATIVE_NAMES.en` for byte
equality, key duplication between `profile.delete.cancel` and `common.cancel`,
and the absence of a permanent CI-side byte-parity assertion for the two
retained design-canon constants — currently relying on a one-off Task 1
node script per the plan).

The `saveField`/`commitHead` `useCallback` deps were verified — `t` from
`useTranslation()` is stable across renders in i18next (reads the singleton at
call time), so the missing-dep warning ESLint exhaustive-deps would emit is a
false positive given i18n's actual semantics. Not flagged.

## Critical Issues

### CR-01: es + pt-BR users cannot delete account — title prompt translates `DELETE` to a word the validator rejects

**Files:**

- `apps/mobile/src/i18n/locales/es.json:321`
- `apps/mobile/src/i18n/locales/pt-BR.json:321`
- (verified contract against) `apps/mobile/src/components/DeleteAccountModal.tsx:86,108`
- (verified contract against) `apps/mobile/src/i18n/locales/en.json:321-322`

**Severity:** BLOCKER

**Issue:** The case-sensitive validator at DeleteAccountModal.tsx:108
(`typed !== REQUIRED_TEXT` where `REQUIRED_TEXT = 'DELETE'` on line 86) is
fronted by a translated TITLE that instructs the user what to type. In two
locales the LLM-generated translation replaced the literal `DELETE` token with
a language-native equivalent:

- `es.json profile.delete.typeToConfirmTitle = "Escribe ELIMINAR para confirmar."`
- `pt-BR.json profile.delete.typeToConfirmTitle = "Digite EXCLUIR pra confirmar."`

The placeholder is `"DELETE"` in those locales (Task 4 force-wrote it), but
placeholder text is the grey input hint — the title is what the user actually
reads as the instruction. A Spanish-speaking user reads
`"Escribe ELIMINAR para confirmar."`, types `ELIMINAR`, watches the Confirm
button stay disabled (because `'ELIMINAR' !== 'DELETE'`), and has no
explanation — the placeholder shows `DELETE` faintly but they were told to
type ELIMINAR. Result: the Spanish-speaking and Brazilian-Portuguese
contributor cannot delete their account through the UI. The server-side
`?confirm=DELETE` enforcement at the backend would also reject any
hypothetical client patch.

All other locales preserved the literal `DELETE` token inside the translated
sentence (e.g. hi-IN: `"पक्का करने के लिए DELETE लिखें।"`, ta-IN: `"உறுதி பண்ண DELETE-ன்னு டைப் பண்ணுங்க."`)
— the bug is restricted to es + pt-BR.

This is the exact failure mode Task 4's `placeholder` force-write was meant
to prevent. The protection covered the wrong field — `placeholder` is
cosmetic; `typeToConfirmTitle` is the operative instruction.

**Fix:**

Force-write the literal token `DELETE` back into both translated titles
(matches the pattern already used by all 5 Indian locales: translate the
sentence around the literal token, keep the token verbatim):

```json
// apps/mobile/src/i18n/locales/es.json
"typeToConfirmTitle": "Escribe DELETE para confirmar.",

// apps/mobile/src/i18n/locales/pt-BR.json
"typeToConfirmTitle": "Digite DELETE pra confirmar.",
```

Then add a runtime / catalog-validate gate that asserts every locale's
`profile.delete.typeToConfirmTitle` contains the literal substring
`'DELETE'` (and `profile.delete.placeholder === 'DELETE'`). The same gate
should fire when future LLM regens touch this surface — the design-canon
byte-parity gate (currently restricted to `PAYMENTS_BODY` + `STEP1_BODY`)
should grow a sibling check for "tokens the case-sensitive validator
accepts." Suggested location: extend the catalog-validate script
(`scripts/i18n-validate.*` per plan 07-02) with:

```ts
for (const loc of SUPPORTED_LOCALES) {
  const cat = catalogs[loc];
  if (!cat.profile.delete.typeToConfirmTitle.includes('DELETE')) {
    throw new Error(`${loc}: typeToConfirmTitle missing literal DELETE token`);
  }
  if (cat.profile.delete.placeholder !== 'DELETE') {
    throw new Error(`${loc}: placeholder must be literal "DELETE"`);
  }
}
```

## Warnings

### WR-01: `Loading…` literal hardcoded in ProfileScreen loading state — won't translate

**File:** `apps/mobile/src/screens/profile/ProfileScreen.tsx:197`

**Severity:** WARNING

**Issue:** The loading skeleton at lines 192-202 renders the literal English
string `Loading…` as visible Text:

```tsx
<Text variant="body" tone="tertiary" style={styles.loadingLine}>
  Loading…
</Text>
```

This is user-visible during the cold-start fetchMe + fetchLifetimeContribution
round-trip and is exactly the class of label the WR-01 gap-closure sweep was
meant to eliminate. The translation key `common.loading: "Loading…"` already
exists in `en.json:12` (and in all 7 non-English locales — verified). The
sweep enumerated 14 labels in ProfileScreen but missed this one.

**Fix:**

```tsx
import { useTranslation } from 'react-i18next';
// ...
const { t } = useTranslation(); // already destructured at line 82
// ...
<Text variant="body" tone="tertiary" style={styles.loadingLine}>
  {t('common.loading')}
</Text>;
```

No catalog change needed — the key already exists in all 8 locales.

### WR-02: Error-state body renders untranslated `e.message` or literal sentinel `'load_failed'`

**File:** `apps/mobile/src/screens/profile/ProfileScreen.tsx:135-136, 181-191`

**Severity:** WARNING

**Issue:** On `fetchMe`/`fetchLifetimeContribution` rejection, the catch
handler stores either `e.message` (server-language English passthrough) or
the literal sentinel string `'load_failed'`:

```ts
.catch((e: unknown) => {
  if (!cancelled) setError(e instanceof Error ? e.message : 'load_failed');
});
```

That string is then rendered as visible body copy at line 186:

```tsx
{
  error;
}
```

The `'load_failed'` sentinel is an English debug token a non-English user
would see as a meaningless `load_failed` literal. The `e.message` path leaks
whatever string the API client throws — often English `Error: 401` or
`NetworkError when attempting to fetch resource.` This is the same anti-
pattern WR-01 was meant to eliminate (untranslated English in the user-
facing surface), but for an error state rather than a label.

The DeleteAccountModal's analogous error path (line 145) has an explicit
context comment exempting the `e.message` passthrough (T-07-09-04 accepted
risk: server-language English passthrough for debuggability, fallback IS
translated). ProfileScreen's load-error path has neither the translated
fallback NOR the explicit accept-risk comment, and it renders the message
inline as body copy (not inside an Alert dialog — it's the only thing on
screen).

**Fix:** Mirror the DeleteAccountModal pattern — let `e.message` pass through
but translate the sentinel fallback, and consider wrapping the render site
with a translated fallback for users who only see `error === 'load_failed'`:

```ts
.catch((e: unknown) => {
  if (!cancelled) setError(e instanceof Error ? e.message : null);
});
```

```tsx
// error render
<Text variant="body" style={styles.errorLine}>
  {error ?? t('errors.generic')}
</Text>
```

Add a new key under `profile.errors.couldNotLoad` (or reuse `errors.generic`
which already exists in `en.json:340` and all locales).

## Info

### IN-01: Hardcoded `'English'` fallback at language-row display defeats translation

**File:** `apps/mobile/src/screens/profile/ProfileScreen.tsx:341`

**Severity:** INFO

**Issue:** The current-language native-name display falls back to the
hardcoded English literal `'English'` when `i18n.language` is outside the
8-element `SUPPORTED_LOCALES` union:

```tsx
{LOCALE_NATIVE_NAMES[i18n.language as Locale] ?? 'English'} ›
```

In practice `i18n.language` always falls back to `'en'` per the i18next
bootstrap, so the `?? 'English'` branch is dead code. But if a future
locale extension lands an unmapped tag, this string stays English forever
and bypasses the `LOCALE_NATIVE_NAMES` table. Same byte-string is already
exported as `LOCALE_NATIVE_NAMES.en`.

**Fix:**

```tsx
{LOCALE_NATIVE_NAMES[i18n.language as Locale] ?? LOCALE_NATIVE_NAMES.en} ›
```

### IN-02: `profile.delete.cancel` duplicates `common.cancel` (same byte value, 8 locales)

**File:** `apps/mobile/src/i18n/locales/en.json:319` (and same key in DeleteAccountModal.tsx:169, 204)

**Severity:** INFO

**Issue:** `en.json` defines both `common.cancel: "Cancel"` (line 4) and
`profile.delete.cancel: "Cancel"` (line 319). The two-button row in
DeleteAccountModal could reuse `common.cancel`. Minor namespace bloat;
also means future translators see the same word twice and may translate
inconsistently.

**Fix:** Replace both render sites' `t('profile.delete.cancel')` with
`t('common.cancel')`. Then drop the `profile.delete.cancel` key from all
8 locale JSONs. Net: 8 fewer translation rows.

### IN-03: Byte-parity gate for `PAYMENTS_BODY` / `STEP1_BODY` is a one-off node script, not a permanent CI assertion

**Files:**

- `apps/mobile/src/screens/profile/ProfileScreen.tsx:58-60` (PAYMENTS_BODY)
- `apps/mobile/src/components/DeleteAccountModal.tsx:80-82` (STEP1_BODY)

**Severity:** INFO

**Issue:** The two retained design-canon constants are protected by a
byte-parity assertion that ran once (Task 1 step 5 of plan 07-09) — there
is no test or CI step that re-asserts on every commit. A future edit to
either side will not surface until the next manual re-run, and the inline
comments are the only code-review-time signal. Plan 07-09 §v2 follow-up
section already flagged this (`07-09-SUMMARY.md:198`).

This is not a regression — the retention pattern is sound per Pattern 67 in
07-PATTERNS — but the eslint-disable annotation alone is the entire
protection at the moment.

**Fix:** Add a vitest unit test (e.g.
`apps/mobile/__tests__/i18n/designCanonByteParity.test.ts`) that imports
both source files and the en catalog and asserts byte equality. Cheap to
add; would have caught the (hypothetical) drift on either side immediately.
Stub:

```ts
import en from '../../src/i18n/locales/en.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('design-canon byte parity (Pattern 67)', () => {
  it('en.json profile.payments.body === PAYMENTS_BODY literal', () => {
    const src = readFileSync(
      join(__dirname, '../../src/screens/profile/ProfileScreen.tsx'),
      'utf8',
    );
    const m = src.match(/PAYMENTS_BODY\s*=\s*\n?\s*'([^']*)'/);
    expect(m?.[1]).toBe(en.profile.payments.body);
  });
  it('en.json profile.delete.body === STEP1_BODY literal', () => {
    const src = readFileSync(
      join(__dirname, '../../src/components/DeleteAccountModal.tsx'),
      'utf8',
    );
    const m = src.match(/STEP1_BODY\s*=\s*\n?\s*'([^']*)'/);
    expect(m?.[1]).toBe(en.profile.delete.body);
  });
});
```

---

## Items Verified (NOT Flagged)

For the orchestrator: explicitly cleared during this re-review per the user-
supplied context, so the orchestrator won't re-investigate:

- `PAYMENTS_BODY` (ProfileScreen.tsx:59) + `STEP1_BODY` (DeleteAccountModal.tsx:81)
  retention: intentional design-canon drift detectors per Pattern 67; eslint-
  disable annotations correct; byte-parity to `en.json` verified live (`node`
  string equality `=== true`). NOT dead code.
- `profile.delete.placeholder = "DELETE"` literal across all 8 locales:
  intentional, case-sensitive validator contract; Task 4 force-write verified
  via per-locale `node` dump. NOT untranslated.
- `e.message` passthrough in DeleteAccountModal:145: intentional per
  T-07-09-04 accepted risk; translated fallback IS in place
  (`t('profile.delete.errors.couldNotDelete.body')`). NOT a leakage.
- `accessibilityLabel="Profile screen"` (lines 183, 194, 213): codebase
  convention — a11y labels are stable test-IDs, not user-facing copy
  (matches `HomeScreen "Home screen"`, `TasksScreen "Tasks screen"`).
- `saveField` / `commitHead` `useCallback([me])` missing `t` dep: false
  positive — i18next's `t` reads the singleton at call time, so the
  closure-capture concern doesn't apply in practice.
- `localeMmkv.remove(LOCALE_KEYS.CODE/.CHOSEN_AT)` (DeleteAccountModal:124-125):
  `.remove()` is the established codebase pattern (used identically in
  `state/appStore.ts:157,165,190,196,245`); MMKV v4 mock + Nitro typings
  both expose it.
- `useRef` re-entrancy guard pattern at lines 96, 112-113, 142: Pattern 66
  correctness verified against the file header rationale (release-on-error-
  only, never-on-success); the success path's nav.reset unmounts the
  component, ref dies with it.

---

_Reviewed: 2026-05-25T04:25:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (WR-01 closure narrow scope)_
