# Handoff — Session 5 (2026-06-04) — Bug 4 ✅ + Bug 5 ✅ + Bug 10 (backend) ✅; tree GREEN

Resume doc for the **sixth** execution session of `IMPLEMENTATION-PLAN-260604.md`.
Read the prior handoffs for full context — this records **what Session 5 finished
(all green), the remaining work, and the exact next edits**:

1. `HANDOFF-260604-SESSION4.md` — Bug 8 + Bug 3 done; Bug 4 was mid-edit (now ✅).
2. `HANDOFF-260604-SESSION{3,2}.md` / `HANDOFF-260604.md` — env, /tmp scripts, decisions.
3. `IMPLEMENTATION-PLAN-260604.md` — source-of-truth plan (11 bugs + 3 enh, D1–D8, §6, §7).
4. `.planning/260604-locked-override-signoff.md` — owner sign-off (D1/D2/D3/D6 APPROVED).
5. `.planning/260604-bug3-precise-location-consent-dpia.md` — **Bug 3 consent/DPIA SHIP GATE**.
6. `CLAUDE.md` — project constraints.

> **GSD is bypassed.** Owner authorized editing the repo directly. Do NOT invoke GSD.
> **Working branch:** `fix/bugs-enhancements-260604`. **Nothing committed.** Commit/push
> ONLY when the owner asks.

---

## 0. ✅ TREE IS FULLY GREEN (verified end of Session 5)

| Gate               | Result                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| API tests          | `zsh /tmp/runapi.sh` → **37 files / 181 tests pass**                                                                                            |
| API e2e            | `zsh /tmp/runapi.sh --config vitest.e2e.config.ts` → **6 files / 16 pass**                                                                      |
| API typecheck      | `cd apps/api && npx tsc --noEmit` → clean                                                                                                       |
| Mobile tests       | `node_modules/.bin/vitest run` → **147 files / 1034 tests pass**                                                                                |
| Mobile typecheck   | `cd apps/mobile && npx tsc --noEmit` → clean                                                                                                    |
| Kotlin             | **untouched this session** — Bug 4/5/10 are TS + backend only; last green baseline (`:app:testApkRolloutDebugUnitTest` BUILD SUCCESSFUL) stands |
| Migrations applied | **through 0016** (high-water)                                                                                                                   |

Docker up (postgres/redis/localstack healthy; redis unused). `/tmp/runapi.sh` + `/tmp/runkt.sh`
exist (contents in `HANDOFF-260604.md` §6). **Rebuild `shared/types` (`cd shared/types && npm
run build`) after ANY edit there** (nodenext → relative imports need a `.js` extension).

### Gotchas (carried + NEW this session)

- **NEW — `navigationRef` + partial nav mocks:** `services/api.ts` now imports
  `navigation/navigationRef.ts`, which calls `createNavigationContainerRef()` at module load.
  The GLOBAL `@react-navigation/native` mock in `vitest.setup.ts` now provides it. BUT any test
  with a **LOCAL** `vi.mock('@react-navigation/native', …)` that renders a screen which
  transitively imports `api.ts` will crash with _"No createNavigationContainerRef export"_.
  Fix per-test by EITHER mocking the service that pulls api.ts (preferred — see
  `PracticeCompleteScreen.test.tsx` mocking `profileService`) OR adding
  `createNavigationContainerRef: () => ({ isReady: () => false, resetRoot: vi.fn() })` to the
  local mock. ~27 screen tests have local nav mocks — most are fine because they already mock
  their services; only newly-pulled chains break.
- **NEW — `idempotency` route config key is now typed** (`src/plugins/idempotency.ts` augments
  `FastifyContextConfig`). `config: { idempotency: false }` now compiles on plain `app.post`
  (it previously only compiled via the body-schema `withTypeProvider` overload).
- `; echo "EXIT=$?"` masks the real bg exit code — grep the log for `BUILD SUCCESSFUL` /
  `Tests N failed` instead.
- Stale `idempotency_keys` 409s — `docker exec humyn-postgres psql -U humyn -d humyn_dev -c
"TRUNCATE idempotency_keys;"` before API runs.
- **perl in-place insert pitfall:** `\s*$` in the match CONSUMES the trailing `\n` (perl `\s`
  includes newline) and merges the inserted line with the next. Use `[ \t]*$` (horizontal-only).
  Cost two corrective passes this session on the test fixtures.
- `cd apps/api` then a "mobile" command runs in the WRONG dir — cwd persists between Bash calls.
- Edit tool needs a fresh `Read` after a `sed`/`perl`/Bash edit of a file.
- API tests mint JWTs inline per-file; each now needs `installationId` in the claim +
  `currentInstallationId` on the user seed (Bug 4). New route/seed test files MUST include both.

---

## 1. Status — all 14 items

| #   | Item                             | Phase | Status                                                        |
| --- | -------------------------------- | ----- | ------------------------------------------------------------- |
| 1   | Bug 1 delete-415                 | 0     | ✅ done (S1)                                                  |
| 2   | Bug 2 preview                    | 0     | ✅ done (S1)                                                  |
| 3   | Bug 9 task mislabel              | 0     | ✅ done (S1)                                                  |
| 4   | Enh 2 dev task                   | 0     | ✅ done (S1)                                                  |
| 5   | Enh 3 remove verify+hashing (D1) | 1     | ✅ done (S3)                                                  |
| 6   | Bug 6 thumbnails (D5)            | 2     | ✅ done (S3)                                                  |
| 7   | Bug 8 + Enh 1 3-min gate (D6)    | 3     | ✅ done (S4)                                                  |
| 8   | Bug 3 location (D3/D4) 🔴        | 3     | ✅ code done (S4) — **consent/DPIA ship-gate still open**     |
| 9   | **Bug 4** multi-device (D2) 🔴   | 4     | ✅ **done (S5) — all layers green, incl. e2e**                |
| 10  | **Bug 5** practice-done (D7)     | 4     | ✅ **done (S5) — green**                                      |
| 11  | Bug 7 History live               | 5     | ⬜ **NOT STARTED — §3 (reactive refactor)**                   |
| 12  | Bug 11 stats auto-update         | 5     | ⬜ **NOT STARTED — §3 (pairs with Bug 7)**                    |
| 13  | **Bug 10** Profile slow          | 5     | 🟡 **backend ✅ (S5); client (ProfileScreen) remaining — §3** |
| 14  | Spec/doc updates (plan §8)       | —     | ⬜ deferred non-code (D1/D2/D3/D6) — §4                       |

---

## 2. What Session 5 finished (all green)

### Bug 4 — single-device newest-login-wins (D2) ✅

The SESSION4 backend SOURCE was correct; Session 5 made it GREEN + added the client + tests.

- **shared/types rebuilt** (`installationId` on `AuthGoogleRequestSchema`); **migration 0014
  applied** (`users.current_installation_id`).
- **~20 API test fixtures** — added `installationId: 'inst-test'` to every inline `tok()` claim +
  `currentInstallationId: 'inst-test'` to every `db.insert(schema.users)` seed (perl, two passes —
  see the `\s*$` gotcha). `idempotency.test.ts` got a real user seed (its authed `/_test/echo`
  route now needs a bound row). `auth-google-iosAppStore.test.ts` + the 4 `/auth/google`-body
  files (`auth-google.test.ts`, e2e `golden-path`/`auth-rejects`, `seed-fixtures`) got
  `installationId` in the body (else zod 400s before the handler).
- **`auth-google.test.ts`** — happy path asserts the minted JWT carries `installationId` +
  `users.current_installation_id` is set; **added the D2 eviction test** (device A signs in →
  device B signs in same googleSub → A's `GET /me` → 401 `device-evicted`; B works). Added
  `_clearInstallationCache()` to its `beforeEach`.
- **Client:** `services/auth.ts` sends `installationId` (from `getInstallationId()`) on
  `/auth/google`. `services/api.ts` gained `maybeHandleEviction(status, body)` called before each
  verb's throw → on a 401 with slug `device-evicted` it clears the session + flags it (guarded
  to fire once) + resets nav to Signup. NEW `src/navigation/navigationRef.ts`
  (`navigationRef` + `resetToOnboarding()` via `resetRoot`), wired into `App.tsx`
  `<NavigationContainer ref={navigationRef}>`. `appStore` gained transient `deviceEvicted` +
  `notifyDeviceEvicted()` (clears jwt+user, KEEPS onboarding flags for smooth re-login) +
  `clearDeviceEvicted()`. `SignupScreen` reads the flag once on mount → shows
  `t('signup.deviceEvicted')` notice → clears it; new i18n key in all 8 locales; new analytics
  event `signup_device_evicted_notice`.
- **Tests:** `auth.signIn.test.ts` (sends installationId), `api.deviceEvicted.test.ts` (evicted
  401 → session cleared + flag; generic 401 does NOT evict), `SignupScreen.test.tsx` +2 (notice
  shown + cleared / not shown). `vitest.setup.ts` global nav mock gained
  `createNavigationContainerRef`.

### Bug 5 — persist practice-done server-side (D7) ✅

- **DB:** `users.practice_completed_at timestamptz` (nullable) + **migration 0015 applied**.
- **`/me`:** `MeResponseSchema.extend({ practiceCompletedAt: z.string().datetime().nullable() })`;
  `rowToMe` surfaces it. NEW `MePracticeCompleteResponseSchema`.
- **NEW route** `routes/me/practice-complete.ts` — `POST /me/practice-complete`, idempotent
  (set-if-NULL → returns the timestamp), `config: { idempotency: false }` (no key needed),
  per-user rate-limit; registered in `me/index.ts`. Test `me-practice-complete.test.ts` (401
  w/o auth; first call stamps + `/me` reflects; idempotent second call → same timestamp).
- **Client:** `profileService.fetchMe()` seeds the local ONB-08 flag
  (`secureMmkv.set(practiceDoneKey(sub), true)`) when `practiceCompletedAt` is non-null →
  `computeInitialRoute` skips the tutorial on a fresh install / new device. NEW
  `postPracticeComplete()`; `PracticeCompleteScreen.handleContinue` fires it best-effort +
  non-blocking alongside `setPracticeDone`. Tests: `profileService.test.ts` +2 (seeds / doesn't),
  `PracticeCompleteScreen.test.tsx` (asserts the server write) + `practiceFlow` + the visual test
  (mock `profileService` to avoid the nav-ref import chain).

### Bug 10 — Profile slow/stuck (backend portion) ✅

- **`db/index.ts`** pool: `connectionTimeoutMillis: 5_000` + `statement_timeout: 15_000` (fail
  fast instead of hanging past the client's 30s abort).
- **`routes/contributions/list.ts`** — the two per-user scans now run concurrently (`Promise.all`).
- **Covering index** `recordings_user_qa_idx ON recordings (user_id, qa_status) INCLUDE
(duration_ms, task_id)` — **migration 0016 applied**; declared (prefix-only, no `.include()` in
  drizzle 0.45) in `schema.ts`.
- **`services/api.ts`** — `post`/`postNoBody` got AbortController timeout parity (they had none).

---

## 3. NEXT — Phase 5 reactive refactor (Bug 7 + Bug 11 + Bug 10 client) ← DO THIS

These three SHARE the appStore reactive layer + ProfileScreen, so do them as ONE unit. The
full surface map (signatures, types, line anchors) is in this session's exploration — summarized:

**Native upload API (`src/native/HumynUpload.ts`):**

- `onUploadQueueChanged(cb: (rows: UploadQueueRow[]) => void): EmitterSubscription` (`.remove()`).
- `onUploadProgress(cb: (e: UploadProgressEvent) => void): EmitterSubscription`. `UploadProgressEvent =
{ recordingId, bytesUploaded, bytesTotal }`.
- `getQueueSafe(): Promise<UploadQueueRow[]>` (never throws).
- `UploadQueueRow` has `recordingId`, `ownerUserId`, `state`
  (`pending|uploading|finalizing|dead-letter|needs-attention`), `cancelReason?`, `enqueuedAt`, …
- Three screens (`History`, `Home`, `PendingUploads`) EACH subscribe independently + filter
  `ownerUserId === currentSub` (`currentSub = decodeGoogleSubFromJwt(useAppStore(s=>s.jwt))`).
  History merges device rows over server `/recordings` rows (keyed by recordingId); progress is
  `progressById[recordingId] = pct`. Boot installer `installUploadReconcile()` lives in `App.tsx`
  (useEffect + teardown) next to where the new store installer goes.

**Step 1 — appStore slice (Bug 7 + Bug 11).** Add transient (NOT persisted) state:
`uploadQueue: UploadQueueRow[]` (use `import type { UploadQueueRow } from '../native/HumynUpload'`
— type-only, no runtime cycle), `uploadProgressById: Record<string, number>`,
`contributionsVersion: number`. Actions: `setUploadQueue(rows)`, `setUploadProgress(recordingId,
pct)`, `bumpContributionsVersion()`. Initial: `[]`, `{}`, `0`.

**Step 2 — boot installer.** NEW `src/services/uploadQueueStore.ts` exporting
`installUploadQueueStore(): () => void`: seed `getQueueSafe()→setUploadQueue`; `onUploadQueueChanged
(rows)→setUploadQueue(rows)+bumpContributionsVersion()`; `onUploadProgress(e)→setUploadProgress(...)`;
return a teardown that `.remove()`s both. Install in `App.tsx` next to `installUploadReconcile()`
(same try/catch + combined teardown). (Bump contributionsVersion on every queue mutation — fires a
handful of times per recording; consumers debounce/refetch. Queue mutations correlate with the
server-side count change at `/recordings/init`.)

**Step 3 — rewire screens to the store (Bug 7).** `HistoryScreen`, `HomeScreen`,
`PendingUploadsScreen`: replace each local `useState`+`onUploadQueueChanged`/`onUploadProgress`
effect with store selectors (`useAppStore(s => s.uploadQueue)` filtered by `currentSub`;
`uploadProgressById`). Keep each screen's own filter nuance (PendingUploads also excludes
`cancelReason != null`). Refetch the server `/recordings` list when History focuses or a queue
event marks a row terminal; fix the `currentSub`-null race (don't drop rows during a null-`sub`
window — gate the filter on `sub !== ''`).

**Step 4 — contributions auto-update (Bug 11).** `HomeScreen` + `ProfileScreen` effects key on
`contributionsVersion` (debounced ~1–2s) → call their reload fns. Home already has
`reloadLifetime`/`reloadAggregate`; add a `useEffect([contributionsVersion])`.

**Step 5 — ProfileScreen client (Bug 10 client).** `ProfileScreen.tsx:110-141` currently does
`Promise.all([fetchMe(), fetchLifetimeContribution()])` with no deadline → swap to
`Promise.allSettled`, render off `/me` immediately (fast PK read), lazy-load the lifetime block
with a small spinner + a 12–15s loading deadline → error + Retry; refetch on `useFocusEffect` +
on `contributionsVersion`. (Backend already fixed in §2.)

**Step 6 — tests.** Store slice + installer unit tests; History "enqueue while unmounted → focus
→ row present"; Home/Profile "mock upload-complete → tiles refetch"; Profile "slow/hanging
/contributions → /me content + Retry, never infinite spinner". ⚠ Watch the **navigationRef
partial-mock gotcha** (§0) for every screen test with a local `@react-navigation/native` mock.

**Verify:** `cd apps/mobile && npx tsc --noEmit && node_modules/.bin/vitest run`; backend already
green. Keep each step green before the next.

---

## 4. Task #14 — spec/doc sweep (plan §8) — non-code, batch last

- **D1** (remove hashing): `UPLOAD-PIPELINE.md`, `DATA-MODEL.md` (drop sha fields), `CLAUDE.md`
  ("byte-for-byte" note), `.planning/REQUIREMENTS.md` VERIFY-\*, `ROADMAP.md` Phase 5.
- **D2** (multi-device, Bug 4 — NOW SHIPPED): decision record overriding LOCKED `D-AUTH-03`;
  `CLAUDE.md` Auth-constraint banner (strict newest-wins; legacy JWTs forced to re-sign-in once;
  LRU-cached `sub→current_installation_id` 60s TTL; `device-evicted` slug); `deferred-decisions.md`.
- **D3** (precise location — Bug 3): the consent/DPIA gate doc's apply-together checklist +
  consent-version bump (owner/legal driven; **SHIP GATE** — precise GPS must not ship until it lands).
- **D6** (3-min floor): `StopConfirmModal.tsx` LOCKED-copy note already done; `design-spec.md` /
  `engineering-handoff.md §6.3` / `.planning/REQUIREMENTS.md` / `CLAUDE.md` capture banner.
- **D5/D7** (thumbnails / practice): `DATA-MODEL.md` (`s3_key_thumbnail`,
  `users.practice_completed_at`), `.planning/REQUIREMENTS.md`.

---

## 5. LOCKED decisions to keep consistent

- **Bug 4 / D2 (SHIPPED):** strict newest-wins; `device-evicted` 401 slug; LRU `sub →
current_installation_id` (60s TTL, `lru-cache@11`); invalidate on sign-in; legacy (no-claim)
  JWTs 401 → one-time re-sign-in. Eviction clears jwt+user but KEEPS onboarding flags.
- **Bug 5 / D7:** `users.practice_completed_at` set-if-NULL (idempotent); `/me` surfaces it;
  client seeds `practiceDoneKey(sub)` from it in `fetchMe`. Independent of the practice upload.
- **Metadata schema = 1.5.0** (Bug 3). **Migration high-water = 0016.**
- **Bug 3 consent/DPIA** = SHIP GATE — do NOT edit consent strings without the version bump.
- `uploaded` = terminal success (Enh 3). KEEP `lru-cache` + `AppFlavorModule.sha256First16Hex`.

---

## 6. Files changed in Session 5 (branch `fix/bugs-enhancements-260604`, nothing committed)

NEW: `apps/api/src/routes/me/practice-complete.ts`, `apps/api/src/db/migrations/{0015,0016}_*.sql`,
`apps/api/test/routes/me-practice-complete.test.ts`, `apps/mobile/src/navigation/navigationRef.ts`,
`apps/mobile/__tests__/services/{auth.signIn,api.deviceEvicted}.test.ts`.
MODIFIED (Bug 4): `shared/types/src/auth.ts` (rebuilt), `apps/api` auth chain (already in S4),
~20 API test fixtures, `auth-google*.test.ts`, `vitest.setup.ts`, mobile `services/{auth,api}.ts`,
`state/appStore.ts`, `App.tsx`, `screens/signup/SignupScreen.tsx` (+ test), `util/analytics.ts`,
8 locale jsons, `__tests__/state/initialRoute*.test.ts`.
MODIFIED (Bug 5): `apps/api/src/db/schema.ts`, `routes/me/{get-patch,index}.ts`,
`shared/types/src/me.ts`, mobile `services/profileService.ts`, `screens/tutorial/PracticeCompleteScreen.tsx`,
`__tests__/services/profileService.test.ts`, `__tests__/screens/{PracticeCompleteScreen,practiceFlow}.test.tsx`,
`__tests__/visual/PracticeCompleteScreen.visual.test.tsx`.
MODIFIED (Bug 10 backend): `apps/api/src/db/{index,schema}.ts`, `routes/contributions/list.ts`,
mobile `services/api.ts` (post/postNoBody abort).
