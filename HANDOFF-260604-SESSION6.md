# Handoff — Session 6 (2026-06-05) — Phase 5 reactive refactor ✅ (Bug 7 + Bug 11 + Bug 10-client); tree GREEN

Resume doc for the **seventh** execution session of `IMPLEMENTATION-PLAN-260604.md`.
Session 6 finished the **Phase 5 reactive refactor** (the last remaining CODE work).
All 13 code items are now done; only the **non-code spec/doc sweep (Task #14)** remains.

Read the prior handoffs for full context:

1. `HANDOFF-260604-SESSION5.md` — Bug 4/5 + Bug 10-backend; the §3 spec for THIS session's work.
2. `HANDOFF-260604-SESSION{4,3,2}.md` / `HANDOFF-260604.md` — env, `/tmp` scripts, decisions, phase map.
3. `IMPLEMENTATION-PLAN-260604.md` — source-of-truth plan (11 bugs + 3 enh, D1–D8, §6, §7, **§8 = the doc sweep**).
4. `.planning/260604-locked-override-signoff.md` — owner sign-off (D1/D2/D3/D6 APPROVED).
5. `.planning/260604-bug3-precise-location-consent-dpia.md` — **Bug 3 consent/DPIA SHIP GATE**.
6. `CLAUDE.md` — project constraints.

> **GSD is bypassed.** Owner authorized editing the repo directly. Do NOT invoke GSD.
> **Working branch:** `fix/bugs-enhancements-260604`. **Nothing committed.** Commit/push
> ONLY when the owner asks.

---

## 0. ✅ TREE IS FULLY GREEN (verified end of Session 6)

| Gate               | Result                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| Mobile tests       | `cd apps/mobile && node_modules/.bin/vitest run` → **148 files / 1047 tests pass**      |
| Mobile typecheck   | `cd apps/mobile && npx tsc --noEmit` → **clean (exit 0)**                               |
| API tests          | `zsh /tmp/runapi.sh` → **37 files / 181 tests** (UNCHANGED — no API edits this session) |
| API e2e            | `zsh /tmp/runapi.sh --config vitest.e2e.config.ts` → **6 files / 16** (UNCHANGED)       |
| API typecheck      | `cd apps/api && npx tsc --noEmit` → clean (UNCHANGED)                                   |
| Kotlin             | **untouched** — Bug 7/10/11 are TS-only; last green baseline stands                     |
| Migrations applied | **through 0016** (high-water, unchanged)                                                |

Docker up (postgres/redis/localstack; redis unused). **Rebuild `shared/types` only if you edit it.**

> ⚠ **VERIFY GOTCHA (NEW this session):** do **NOT** run `npx tsc --noEmit` and
> `vitest run` concatenated in one shell line (`tsc …; vitest …`). Under that load
> the vitest workers fail to init and report a **false mass failure** (~154 files
> "failed", `setup 0ms`). Run them as **separate Bash calls**. Standalone they are
> both green. (Same family as the SESSION5 "don't trail with `; echo`" gotcha.)

---

## 1. Status — all 14 items

| #   | Item                              | Phase | Status                                                    |
| --- | --------------------------------- | ----- | --------------------------------------------------------- |
| 1   | Bug 1 delete-415                  | 0     | ✅ done (S1)                                              |
| 2   | Bug 2 preview                     | 0     | ✅ done (S1)                                              |
| 3   | Bug 9 task mislabel               | 0     | ✅ done (S1)                                              |
| 4   | Enh 2 dev task                    | 0     | ✅ done (S1)                                              |
| 5   | Enh 3 remove verify+hashing (D1)  | 1     | ✅ done (S3)                                              |
| 6   | Bug 6 thumbnails (D5)             | 2     | ✅ done (S3)                                              |
| 7   | Bug 8 + Enh 1 3-min gate (D6)     | 3     | ✅ done (S4)                                              |
| 8   | Bug 3 location (D3/D4) 🔴         | 3     | ✅ code done (S4) — **consent/DPIA ship-gate still open** |
| 9   | Bug 4 multi-device (D2) 🔴        | 4     | ✅ done (S5)                                              |
| 10  | Bug 5 practice-done (D7)          | 4     | ✅ done (S5)                                              |
| 11  | **Bug 7 History live**            | 5     | ✅ **done (S6)**                                          |
| 12  | **Bug 11 stats auto-update**      | 5     | ✅ **done (S6)**                                          |
| 13  | **Bug 10 Profile slow**           | 5     | ✅ **done (S6) — backend (S5) + client (S6)**             |
| 14  | **Spec/doc updates (plan §8)** 🔴 | —     | ⬜ **NOT STARTED — the only remaining work — §4 below**   |

**All code is complete.** Item #14 is non-code (spec/doc edits for the LOCKED overrides), plus the
still-open **Bug 3 consent/DPIA SHIP GATE** (owner/legal) and the optional first commit.

---

## 2. What Session 6 finished (all green)

The Phase-5 reactive refactor — Bug 7 + Bug 11 + Bug 10-client done as ONE unit (they share the
appStore reactive layer + ProfileScreen). Architecture: replace **three per-screen upload-queue
subscriptions** with **one app-lifetime Zustand slice** fed by **one boot installer**.

### Bug 7 — History shows in-progress uploads live ✅

- **`state/appStore.ts`** — NEW transient (never-persisted) slice: `uploadQueue: UploadQueueRow[]`,
  `uploadProgressById: Record<string,number>`, `contributionsVersion: number` + setters
  `setUploadQueue` / `setUploadProgress` / `bumpContributionsVersion`. Type-only
  `import type { UploadQueueRow }` (no runtime cycle — HumynUpload never imports the store).
  `setUploadQueue` also **GCs `uploadProgressById`** down to live recordingIds (see §3 fix #2).
- **NEW `services/uploadQueueStore.ts`** — `installUploadQueueStore()`: seeds `getQueueSafe →
setUploadQueue`; one `onUploadQueueChanged → setUploadQueue + bumpContributionsVersion`; one
  `onUploadProgress → setUploadProgress` (pct = `bytesUploaded/bytesTotal*100`); returns a teardown
  that `.remove()`s both. Boot-safe (per-subscribe try/catch) + a **seed-race guard** (see §3 fix #1).
- **`App.tsx`** — installs it beside `installUploadReconcile()` (same best-effort try/catch +
  combined teardown).
- **`HistoryScreen` / `HomeScreen` / `PendingUploadsScreen`** — each replaced its local
  `useState` + `onUploadQueueChanged`/`onUploadProgress` effect with store selectors:
  `uploadQueue.filter(r => r.ownerUserId === currentSub)` **gated on `currentSub` being truthy**
  (the null-`sub` race fix — the raw queue persists in the store and re-filters the moment `sub`
  resolves, so nothing is dropped; UP-13 owner-pin preserved). PendingUploads keeps its
  `cancelReason == null` exclusion + the `__test_rows` synchronous test hatch.
- History also **refetches `/recordings`** on a debounced `contributionsVersion` bump (promotes a
  synthesized in-flight device row to its authoritative server row) — on top of its focus refetch.

### Bug 11 — contribution time + task count auto-update ✅

- `bumpContributionsVersion()` fires on every queue mutation (the installer's
  `onUploadQueueChanged` handler — a mutation correlates with the server count change at
  `/recordings/init`). Progress ticks do NOT bump it.
- **HomeScreen** + **ProfileScreen** each have a `useEffect([contributionsVersion])` that
  **debounces ~1.5s** then reloads (Home: `reloadLifetime` + `reloadAggregate`; Profile:
  `loadLifetime`). Skip the initial `0` (the focus effect already loaded on cold mount).

### Bug 10 — Profile slow/stuck (client; backend was S5) ✅

`ProfileScreen.tsx` rebuilt:

- **Render off `/me` immediately** — the whole-screen loading gate now keys on `me` only (was
  `!me || !lifetime`). `Promise.allSettled([loadMe(), loadLifetime()])` so neither leg blocks/rejects
  the other.
- **Lazy lifetime block** with `lifetimeStatus: 'loading' | 'ready' | 'error'`:
  `lifetime != null` → numeric · else `error` → inline error + Retry · else → `<ActivityIndicator>`.
  Render precedence `lifetime != null` first means a background-refetch failure keeps the last-good
  numeric (error never shows while data exists).
- **13s UX deadline** (`LIFETIME_DEADLINE_MS`) → flips to error+Retry so a hanging `/contributions`
  can never infinite-spin. `lifetimeReqRef` makes the latest call win (stale resolves / their
  deadlines no-op). `mountedRef` guards setState-after-unmount.
- **Refetch on `useFocusEffect`** (transients self-heal on re-open) **+ on `contributionsVersion`**.
- Retry (`onRetryLifetime`) sets `'loading'` in the **press handler** (not render).
- i18n: NEW `profile.lifetime.loadError` in `en.json` (other locales fall back to `en` via the
  configured `fallbackLng: 'en'`); Retry reuses the already-localized `common.retry`.

> **Critical invariant (don't regress):** `loadLifetime` must **never `setState` synchronously**.
> It runs inside the `useFocusEffect` callback, which many test mocks (incl. the GLOBAL
> `vitest.setup` one that `RootNativeStack.test` uses) invoke **during render** — a render-phase
> setState there loops ("Too many re-renders"). Initial spinner comes from `useState('loading')`;
> Retry re-enters loading from the press handler.

### Tests added/updated

- NEW `__tests__/services/uploadQueueStore.test.ts` (6 — install/seed/event/progress/teardown +
  the seed-race guard) against the **real** store.
- `__tests__/state/appStore.test.ts` +2 (slice setters; `setUploadQueue` progress-GC + stable-ref).
- `__tests__/screens/history/HistoryScreen.test.tsx` +2 (store-fed device row "enqueue-while-unmounted";
  cross-user owner-pin) + mock now provides `jwt`/`uploadQueue`/`uploadProgressById`/`contributionsVersion`
  - a `jwtSub` mock.
- `__tests__/screens/ProfileScreen.test.tsx` +4 (render-off-`/me`; failure→error+Retry→success;
  13s deadline; `contributionsVersion`→refetch) + nav mock gains an **effect-correct** `useFocusEffect`.
- HomeScreen / PendingUploads (×3) / initialRoute (×2) test mocks updated for the new store fields;
  PendingUploads' progress tests now seed `uploadProgressById` (the `.remove()`-on-unmount test was
  removed — the subscription moved to the installer, covered there).

---

## 3. CODE REVIEW (thorough) — Session 6 changes

Method: a self-review + an **independent adversarial agent review** of the full working-tree diff
(`git diff -- apps/mobile/src`), focused on correctness (races, effect timing, state machine,
memory, leaks). **No blockers or highs.** Two findings were **fixed in-session**; the rest are
verified-correct or low-severity noted-for-later.

### Findings FIXED this session

| #   | Sev | File                           | Issue & fix                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | med | `services/uploadQueueStore.ts` | **Boot seed-vs-event race.** The async `getQueueSafe().then(setUploadQueue)` could overwrite a FRESHER `onUploadQueueChanged` payload that arrived during the seed's async gap (a row enqueued in the first ~ms of cold boot would transiently vanish until the next mutation). **Fixed** with a `let seeded` flag: whoever writes first sets it; the seed no-ops if an event already won. Covered by the new race-guard test. |
| 2   | low | `state/appStore.ts`            | **`uploadProgressById` grew unbounded** — a completed upload drops from the queue but its `recordingId → pct` entry lingered forever (transient/per-session, tiny, but technically unbounded). **Fixed:** `setUploadQueue` now prunes the progress map to live recordingIds, keeping the SAME map reference when nothing is pruned (no spurious progress-consumer re-renders). Covered by the new GC test.                     |

### Verified CORRECT (no action)

- **Null-`sub` gate (UP-13).** `decodeGoogleSubFromJwt` → `''` (falsy) for null/bad JWT; all three
  screens use `currentSub ? filter : []`. Rows are never dropped from the durable store, so they
  reappear the instant `sub` resolves; owner-pin preserved on every screen (PendingUploads keeps the
  extra `cancelReason == null` filter).
- **ProfileScreen state machine.** Cannot infinite-spin (13s deadline → error+Retry); cannot show
  error-while-data-exists (`lifetime != null` render precedence); `lifetimeReqRef` latest-wins has
  no stale-write / lost-data path (verified under Retry / focus / version-burst interleavings).
- **Seed does NOT bump `contributionsVersion`** → lazy-mount + seed never triggers a spurious
  contributions refetch; only real queue events bump.
- **Debounce effects** (History/Home/Profile on `contributionsVersion`) — correct cleanup
  (`clearTimeout`), collapse bursts into one refetch, skip-initial-`0` correct.
- **No remaining live consumer** expects the removed per-screen subscriptions. `HomeSkeletonScreen.tsx`
  still has them but is **dead code** (MainTabs renders `HomeScreen`, not the skeleton).

### Noted for later (low / deferred — NOT blocking)

- **Overlapping uncancelled `/contributions` fetches** (`ProfileScreen`). Latest-wins keeps results
  correct, but pathological focus-churn + version-bursts can leave several `fetchLifetimeContribution`
  requests in flight at once (no `AbortController`). Low impact; consider an abort if it ever shows up.
- **`profile.lifetime.loadError` is `en`-only.** The 7 other runtime locales resolve it via
  `fallbackLng: 'en'` (English text shown). No parity test fails. Fold a localized string into the
  plan-07-02 LLM regen / the doc sweep if desired. (Retry button already localized via `common.retry`.)
- **`saveField`/`commitHead` `useCallback` deps omit `t`** — **pre-existing** (not introduced here);
  `t` is stable in practice. Out of scope; noted because the file was reworked.
- **Superseded `loadLifetime` deadline timers** run to completion then self-no-op via the reqId
  guard (≤13s harmless timer, never fires a stale setState). Not worth cancelling.

---

## 4. NEXT — Task #14: spec/doc sweep (plan §8) — the ONLY remaining work

Non-code edits that bring the spec docs in line with the already-shipped LOCKED-override code.
**Re-grep line numbers — they drift.** Suggested order (do the code-reflecting ones first; treat D3
as a separate gated step):

- **D1 (remove hashing — Enh 3):** `UPLOAD-PIPELINE.md`, `DATA-MODEL.md` (drop `file_sha256`/`imu_sha256`),
  `CLAUDE.md` ("Files never re-encoded / byte-for-byte" note — fidelity proof removed),
  `.planning/REQUIREMENTS.md` VERIFY-\*, `ROADMAP.md` Phase 5.
- **D2 (multi-device, Bug 4 — SHIPPED):** a decision record overriding LOCKED `D-AUTH-03`
  (incl. the **D-AUTH-03 override record**); `CLAUDE.md` Auth-constraint banner (strict newest-wins;
  legacy no-claim JWTs forced to re-sign-in once; LRU `sub → current_installation_id` 60s TTL;
  `device-evicted` slug); `deferred-decisions.md`.
- **D5 (thumbnails):** `DATA-MODEL.md` (`recordings.s3_key_thumbnail`), `UPLOAD-PIPELINE.md`.
- **D6 (3-min floor):** `design-spec.md` / `engineering-handoff.md §6.3` / `.planning/REQUIREMENTS.md` /
  `CLAUDE.md` capture banner. (`StopConfirmModal.tsx` "(LOCKED)" copy note already done in S4.)
- **D7 (practice):** `DATA-MODEL.md` (`users.practice_completed_at`), `.planning/REQUIREMENTS.md`.
- **D3 (precise location, Bug 3) 🔴 SHIP GATE — handle SEPARATELY / surface to owner+legal:**
  `idea-brief.md §2.1` (coarse-only) + `§5.2` (consent text → precise), `DATA-MODEL.md`,
  `CLAUDE.md` (coarse-only line + new banner), `.planning/REQUIREMENTS.md` PERM-03,
  AndroidManifest comments, `verify-merged-manifests.sh`, and the **consent-version bump + DPIA
  checklist** in `.planning/260604-bug3-precise-location-consent-dpia.md`. **Do NOT edit consent
  strings or ship precise GPS without the owner/legal version bump** (per that gate doc + SESSION5 §5).

After the sweep, the branch is ready for the owner's first commit (commit/push **only when asked**).

---

## 5. Gotchas (carried + NEW)

- **NEW — don't concatenate `tsc` + `vitest`** in one Bash line → false mass failure (§0). Separate calls.
- **NEW — `ProfileScreen.loadLifetime` must not `setState` synchronously** (render-phase loop under
  during-render `useFocusEffect` mocks). See §2 Bug 10 invariant.
- **NEW — adding a store field breaks `AppState`-typed test fixtures.** `initialRoute.test.ts` +
  `initialRoute.locale.test.ts` build a full `AppState` object — any new required field must be added
  to both `baseState()` builders (data field + a `() => {}` action stub).
- **NEW — screen tests that mock `useAppStore`** must now provide `uploadQueue` / `uploadProgressById`
  (+ `contributionsVersion` for Home/History/Profile) or the screen crashes on `progressById[...]`.
- **navigationRef + partial nav mocks** (carried from S5): a test with a LOCAL
  `vi.mock('@react-navigation/native', …)` that renders a screen pulling `api.ts` must mock the
  pulled service OR add `createNavigationContainerRef`. ProfileScreen.test is safe (it mocks
  `profileService`). If you add `useFocusEffect` to a screen, its LOCAL nav mock must provide it.
- Stale `idempotency_keys` 409s — `TRUNCATE idempotency_keys;` before API runs.
- `cd apps/api` then a "mobile" command runs in the WRONG dir — cwd persists between Bash calls.

---

## 6. LOCKED decisions to keep consistent

- **Bug 7 / Bug 11 (SHIPPED):** single app-lifetime store slice (`uploadQueue` /
  `uploadProgressById` / `contributionsVersion`) fed by ONE boot installer
  (`installUploadQueueStore`); screens read selectors filtered by `currentSub` (truthy-gated,
  UP-13 owner-pin). `contributionsVersion` bumps on queue mutations only (not progress); consumers
  debounce ~1.5s. Progress map GC'd to live queue ids.
- **Bug 10 (SHIPPED):** render off `/me`; lifetime block independent with a 13s deadline →
  error+Retry; `lifetimeReqRef` latest-wins; refetch on focus + `contributionsVersion`.
- **Bug 4 / D2 (SHIPPED):** strict newest-wins; `device-evicted` 401 slug; LRU `sub →
current_installation_id` (60s TTL); legacy no-claim JWTs 401 → one-time re-sign-in.
- **Bug 5 / D7:** `users.practice_completed_at` set-if-NULL; `/me` surfaces it; client seeds
  `practiceDoneKey(sub)` in `fetchMe`.
- **Metadata schema = 1.5.0** (Bug 3). **Migration high-water = 0016.**
- **Bug 3 consent/DPIA = SHIP GATE** — do NOT edit consent strings without the version bump.
- `uploaded` = terminal success (Enh 3). KEEP `lru-cache` + `AppFlavorModule.sha256First16Hex`.

---

## 7. Files changed in Session 6 (branch `fix/bugs-enhancements-260604`, nothing committed)

NEW: `apps/mobile/src/services/uploadQueueStore.ts`,
`apps/mobile/__tests__/services/uploadQueueStore.test.ts`,
`HANDOFF-260604-SESSION6.md`.
MODIFIED (src): `apps/mobile/src/state/appStore.ts`, `apps/mobile/App.tsx`,
`apps/mobile/src/screens/history/HistoryScreen.tsx`, `apps/mobile/src/screens/home/HomeScreen.tsx`,
`apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx`,
`apps/mobile/src/screens/profile/ProfileScreen.tsx`, `apps/mobile/src/i18n/locales/en.json`.
MODIFIED (tests): `apps/mobile/__tests__/state/appStore.test.ts`,
`apps/mobile/__tests__/state/initialRoute.test.ts`,
`apps/mobile/__tests__/state/initialRoute.locale.test.ts`,
`apps/mobile/__tests__/screens/ProfileScreen.test.tsx`,
`apps/mobile/__tests__/screens/home/HomeScreen.test.tsx`,
`apps/mobile/__tests__/screens/history/HistoryScreen.test.tsx`,
`apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.test.tsx`,
`apps/mobile/__tests__/screens/uploads/PendingUploadsScreen-cancel-guard.test.tsx`,
`apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.visual.test.tsx`.
**No `apps/api`, `shared/types`, or Kotlin edits this session.**
