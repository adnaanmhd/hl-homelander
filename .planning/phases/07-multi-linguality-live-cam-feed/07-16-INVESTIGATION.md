# G-18 Root Cause Investigation (Plan 07-16 Task 1)

**Date:** 2026-05-26
**Investigator:** worktree-agent-ac2f149bac0cdff08 (gsd-executor for plan 07-16)
**Scope:** G-13 (search recyclable derivational form) + G-18 (TasksScreen task
cards English-only despite 07-12's 602-translation regen). Branches the rest of
the plan from the recorded finding.

## TL;DR

**Client-side wiring gap.** The 86×8 `TASK_CATALOG_I18N` shipped by plan 07-12
contains the Devanagari/Bengali/Tamil/Telugu/Marathi/pt-BR/es translations for
every task — verified via Devanagari grep on the catalog body. But every render
site that displays task `name` / `category` / `description` reads the
SERVER-RETURNED canonical English string directly from `Task.name` /
`Task.category` / `Task.description` (per `/tasks/list`, `/tasks/search`,
`/tasks/get`). No call site looks the canonical English up in
`TASK_CATALOG_I18N`. The 602 LLM translations exist but are not connected to
the rendering pipeline. The fix is purely client-side per D-16 — add a
`taskI18n.ts` helper and wire every render site.

For G-13 (the search escape on `"recyclable"`/`"recyclables"`/`"recycle"`),
the route's `plainto_tsquery('english', ${q})` _does_ apply Snowball
stemming server-side (verified via `apps/api/src/routes/tasks/search.ts:57`

- `:60` reading the route literally), so on a healthy dev DB
  `"recyclable"`/`"recycle"`/`"recyclables"` should all stem to `recycl` and hit
  the `name_search @@ plainto_tsquery(...)` predicate. The operator's escape
  either reflects a routing detail that didn't reach the operator (e.g. the dev
  seed didn't include `Sorting recyclables` at smoke time, the mobile
  `reverseSearch.ts` en-branch is currently a pass-through so server stemming
  SHOULD work) OR an as-yet-undiagnosed difference between the operator's
  hardware run and the static route. Per checker BLOCKER 3 the plan PROHIBITS a
  live HTTP probe (no dev API auth bypass available); per BLOCKER 4 the chosen
  remediation is a CURATED `EN_TOKEN_ALIASES` map on the client that
  deterministically guarantees the four forms collapse to `'recyclables'` before
  hitting the wire. This is harmlessly additive — even if the server stemmer
  already handles the case, the map produces an identical query.

## Catalog status

`grep -nE "खाना पकाना|Sorting recyclables|कचरा|Folding towels"
apps/mobile/src/i18n/taskCatalog.i18n.ts` returns:

```
90:      name: 'खाना पकाना',
1576:      description: '...कचरा...।',
1612:      description: '...कचरा....',
2574:      description: '...कचराडब्यातून....',
2611:      name: 'कचरा बाहर ले जाना',
2612:      description: 'बँधी हुई कचरे की थैली...',
2647:      name: 'कचरा बाहेर टाकणे',
2730:  'Sorting recyclables': {
```

Conclusion: `TASK_CATALOG_I18N` carries genuine Devanagari/Marathi/etc.
translations for the keystone tasks. Plan 07-12's 602 translations DID land in
the catalog body. The catalog is the SOURCE OF TRUTH (D-15) and currently
unused by the render path — that's the gap.

## Render-path trace

`grep -nE "item\.name|item\.category|task\.name|task\.category|state\.taskName|taskName="`
across the 5 render sites + the 1 navigation-param hand-off:

| Site                                        | File                                    | Line                           | Reads from                                                       | Source                                                            | Localized?                                 |
| ------------------------------------------- | --------------------------------------- | ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| TaskCard `name` prop                        | `screens/tasks/TasksScreen.tsx`         | 206                            | `item.name`                                                      | server `/tasks/list` or `/tasks/search` response                  | NO — English                               |
| TaskCard `category` prop                    | `screens/tasks/TasksScreen.tsx`         | 207                            | `item.category`                                                  | server response                                                   | NO — English                               |
| RecordingScreen navigation param `taskName` | `screens/tasks/TasksScreen.tsx`         | 180                            | `task.name`                                                      | server response                                                   | NO — English (downstream `state.taskName`) |
| TaskDetailsSheet category eyebrow           | `screens/tasks/TaskDetailsSheet.tsx`    | 119                            | `task.category.toUpperCase()`                                    | server (lifted via TasksScreen `selectedTask`)                    | NO — English                               |
| TaskDetailsSheet name                       | `screens/tasks/TaskDetailsSheet.tsx`    | 137                            | `task.name`                                                      | server                                                            | NO — English                               |
| TaskDetailsSheet description                | `screens/tasks/TaskDetailsSheet.tsx`    | 145 (`{task.description}`)     | server                                                           | NO — English                                                      |
| TaskDetailsSheet instructions               | `screens/tasks/TaskDetailsSheet.tsx`    | 158 (`.map(line => …{line}…)`) | server                                                           | NO — English                                                      |
| RecordingScreen app-bar task name           | `screens/recording/RecordingScreen.tsx` | 1033                           | `state.taskName` (← `params.taskName` ← TasksScreen `task.name`) | propagated English                                                | NO — English                               |
| HistoryRow task name                        | `components/HistoryRow.tsx`             | 390                            | `row.taskName`                                                   | server-derived; populated by HistoryScreen from canonical English | NO — English                               |
| UniversalRulesBlock 4 ALWAYS rules          | `components/UniversalRulesBlock.tsx`    | 47-50                          | hardcoded `label: 'Keep your hands in frame'` etc. (NOT server)  | client constant                                                   | NO — hardcoded English literal in source   |
| TaskCategoryPills 11 chips                  | `components/TaskCategoryPills.tsx`      | 45-47 (`pillLabel`)            | `TASK_CATEGORY_PILLS` const + `value === 'all' ? 'All' : value`  | client constant                                                   | NO — hardcoded English literal             |

## Server status

**Read-only inspected — no changes proposed (D-16 enforced).**

- `apps/api/src/routes/tasks/list.ts:28-30`: selects `name` + `category` from
  `schema.tasks` — English-only per I18N-10.
- `apps/api/src/routes/tasks/get.ts:22-24`: same shape — English-only.
- `apps/api/src/routes/tasks/search.ts:57,60`: query uses
  `plainto_tsquery('english', ${q})` against `t.name_search @@` — Snowball
  stemming via the English text-search config. Routes return canonical English.
- `apps/api/src/routes/tasks/create-request.ts` is a write endpoint not a read
  endpoint — not in the rendering path.

`git diff --stat apps/api/` at end of Task 1: empty.

The server contract is intact. The plan's keystone D-16 invariant holds —
G-13 + G-18 fixes happen ENTIRELY on the client.

## Chosen fix path

### G-18 / G-19 / G-25 — the keystone wiring (Task 2)

New file: `apps/mobile/src/i18n/taskI18n.ts` with 4 exports:

```typescript
export function localizeTaskName(canonicalEn: string, locale: string): string;
export function localizeTaskCategory(category: string, locale: string): string;
export function localizeTaskDescription(canonicalEn: string, locale: string): string;
export function localizeTaskInstructions(canonicalEn: string, locale: string): string[];
```

Wiring sites (exact lines from the trace above):

1. `screens/tasks/TasksScreen.tsx:206-207` → wrap `item.name` /
   `item.category` through `localizeTaskName(item.name, i18n.language)` /
   `localizeTaskCategory(item.category, i18n.language)`.
2. `screens/tasks/TasksScreen.tsx:180` (the navigation handler that opens
   RecordingScreen) → pass `localizeTaskName(task.name, i18n.language)` and
   `localizeTaskCategory(task.category, i18n.language)` as the navigation
   params, so `state.taskName` reads localized from the start
   (closes G-25 without touching RecordingScreen's state.taskName chain).
3. `screens/tasks/TaskDetailsSheet.tsx:119` → wrap
   `task.category.toUpperCase()` with `localizeTaskCategory(...)`.
4. `screens/tasks/TaskDetailsSheet.tsx:137` → wrap `task.name`.
5. `screens/tasks/TaskDetailsSheet.tsx:145` → wrap `task.description`.
6. `screens/tasks/TaskDetailsSheet.tsx:158-167` → wrap each instructions
   `line` via `localizeTaskInstructions(task.name, i18n.language)`.
7. `components/UniversalRulesBlock.tsx:46-50,72` → replace
   `label: 'Keep your hands in frame'` etc. with `labelKey:
'rules.universal.handsInFrame'` etc., and the render at `:72` from
   `{rule.label}` to `{t(rule.labelKey)}`. Add `useTranslation()` import
   at top of file.

### G-13 — client-side alias map (Task 3)

Append-only at EOF of `apps/mobile/src/i18n/taskCatalog.i18n.ts`:

```typescript
export const EN_TOKEN_ALIASES: Record<string, string> = {
  recyclable: 'recyclables',
  recyclables: 'recyclables',
  recycle: 'recyclables',
  recycling: 'recyclables',
  // Add future entries here as new G-XX search escapes surface.
};
```

Then in `apps/mobile/src/i18n/reverseSearch.ts:53` (the existing
`if (locale === 'en') return input;`) replace with a tokenize → alias-map → join
loop so each whitespace-token is rewritten via the alias map before forwarding
to the server. The non-en branches are byte-identical.

### Other gap closures (Tasks 4a/4b/4c/6)

Documented per the plan's <interfaces> block — no investigation findings
required for these (the bug sites are direct hardcoded literals or the
existing `t()` keys with stale chevron-laden values; the plan's behavior block
already names the exact lines).

## Out-of-scope

Findings surfaced during this investigation that don't belong in 07-16:

- `HistoryRow.tsx` renders the task name via `row.taskName` (a client-resolved
  field, populated by HistoryScreen). If HistoryScreen reads task names from a
  separate server endpoint that returns the canonical English, the localization
  must happen at the screen level (or via a hook) BEFORE the value is passed
  to HistoryRow. **Note for the keystone wiring:** HistoryRow itself doesn't
  need wrapping; the upstream resolver does. This is captured as G-28
  downstream of G-18 already in the plan's <success_criteria> ("HistoryRow
  task name in active locale (downstream of G-18)").
- The server `search.ts` route looks like a normal stemmer setup. If the
  operator's smoke walk re-confirms G-13 fails AFTER the alias-map ships, the
  next investigation should run the psql probes that BLOCKER 3 prohibited (in
  an env where the auth surface allows it).
- The `taskCategory` field surface is also propagated as a navigation param to
  RecordingScreen (line 181). The plan doesn't fix the RecordingScreen
  app-bar category render (only the task name). Confirmed at execution time
  that RecordingScreen does NOT render `taskCategory` anywhere visibly — it's
  collected for downstream metadata only. No additional fix needed.
