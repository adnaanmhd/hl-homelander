---
phase: 06-tasks-history-home-tiles-lexical-search
plan: 10
subsystem: ui
tags: [react-native, exoplayer, navigation, vitest, player, history]

# Dependency graph
requires:
  - phase: 06-tasks-history-home-tiles-lexical-search
    provides:
      - Plan 06-03 — getRecordingStreamUrl + ArchiveState envelope (shared/types)
      - Plan 06-04 — thumbnailLedger.readEntry (per-recording MMKV overlay)
      - Plan 06-05 — recordingsApi.getRecordingStreamUrl wrapper
      - Plan 06-06 — HumynPlayer native module + HumynPlayerView + event subs
      - Plan 06-09 — HistoryScreen navigation.navigate('Player', { recordingId, taskName })
provides:
  - PlayerScreen route (full-bleed dark; portrait-locked; letterboxed)
  - Player route registration in RootNativeStack (sibling of MainTabs)
  - Source-resolution policy — local-first (file://) then remote (presignedUrl)
  - Disabled-overlay copy (Deep Archive + Pending upload) verbatim from 06-CONTEXT.md
  - Unmount invariant — HumynPlayer.release() + every event subscription removed
  - Phase 6 route-registry assertion (REQUIRED_PHASE_6_ROUTES = ['Player'])
affects:
  - Phase 7 observability + APK distribution hardening (Player surface metrics, if added)
  - Future v2 — semantic search re-surfacing, drag-to-seek scrub-bar polish

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Full-bleed dark route as RootNativeStack sibling of MainTabs (suppresses bottom-nav)'
    - 'Local-first then remote source resolution with archiveState branch overlays'
    - 'Lazy NativeEventEmitter subscriptions tracked in subsRef + removed in cleanup'

key-files:
  created:
    - apps/mobile/src/screens/history/PlayerScreen.tsx
    - apps/mobile/__tests__/screens/history/PlayerScreen.test.tsx
  modified:
    - apps/mobile/src/navigation/RootNativeStack.tsx
    - apps/mobile/__tests__/navigation/route-registry.test.ts
    - apps/mobile/vitest.setup.ts

key-decisions:
  - 'Portrait-locked + letterboxed Player (UI-SPEC §14 / 06-RESEARCH Open Question — researcher pick)'
  - 'Player route is a RootNativeStack sibling of MainTabs, NOT nested — guarantees full-bleed (no bottom-nav)'
  - 'Tap-anywhere scrub bar with midpoint-seek as the MVP affordance; full drag-to-seek deferred to v2'
  - "DisabledOverlay component renders both archive-state ('deep-archive' / 'unavailable') AND runtime-error retries"

patterns-established:
  - 'Pattern: Full-bleed dark RootNativeStack route — mirror Recording route options (gestureEnabled:false / headerShown:false / animation:fade)'
  - 'Pattern: Lucide icon allow-list maintained in vitest.setup.ts — each new screen adds the icons it uses to the canonical shim'
  - 'Pattern: Event-subscription cleanup via subsRef.current[] + try/catch .remove() in useEffect return'

requirements-completed: [HIST-07, HIST-08, HIST-09]

# Metrics
duration: 11min
completed: 2026-05-14
---

# Phase 6 Plan 10: PlayerScreen + Player route registration Summary

**Full-bleed dark in-app Player route consuming HumynPlayer + getRecordingStreamUrl with verbatim Deep-Archive / Pending overlays; portrait-locked, letterboxed, registered as a RootNativeStack sibling of MainTabs**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-14T06:28:00Z
- **Completed:** 2026-05-14T06:39:22Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `PlayerScreen.tsx` lands the full-bleed dark Player surface per design-spec §14 — top bar (X-close + centered task name + Lock view-only badge), 16 px-radius letterboxed 16:9 video frame, 64×64 round play overlay, 4 px accent scrub bar with buffered overlay + mono current/total time row, footer "View only — not downloadable.", and the four disabled / error overlays.
- Source resolution is local-first then remote per 06-CONTEXT.md D-06: `readEntry(recordingId)` → if `mp4LocalPath` exists AND `RNFS.exists()` returns true → `HumynPlayer.prepare('file://...')`; otherwise `getRecordingStreamUrl(recordingId)` → on `archiveState === 'available'` + non-null `presignedUrl` → `prepare(presignedUrl)`; on `'deep-archive'` or `'unavailable'` the verbatim disabled overlay renders and `prepare` is never called.
- Player route registered in `RootNativeStack.tsx` as a sibling of MainTabs (NOT nested) with `{ gestureEnabled:false, headerShown:false, animation:'fade' }` — full-bleed by design, no bottom-nav.
- Unmount + X-close invariant: `HumynPlayer.release()` is called, every native event subscription is `.remove()`'d, and `Orientation.unlockAllOrientations()` fires.
- Vitest screen test (8 behaviours) + route-registry test (REQUIRED_PHASE_6_ROUTES = ['Player']) both green; full mobile suite 811/811 pass.

## Task Commits

1. **Task 1: PlayerScreen.tsx + Player route in RootNativeStack** — `8a27c7c` (feat)
2. **Task 2: Vitest PlayerScreen.test.tsx + route-registry Phase-6 block** — `7ecfc27` (test)

## Files Created/Modified

- `apps/mobile/src/screens/history/PlayerScreen.tsx` — **CREATED**. The full-bleed dark Player route. Source-resolution (local file:// → remote presigned URL), disabled-overlay rendering for archive-state mismatch, portrait-lock on mount, release + subscription cleanup on unmount.
- `apps/mobile/src/navigation/RootNativeStack.tsx` — **MODIFIED**. Adds `import { PlayerScreen }` and a `<Root.Screen name="Player" component={PlayerScreen} options={{ gestureEnabled:false, headerShown:false, animation:'fade' }} />` registration alongside the existing Recording route.
- `apps/mobile/__tests__/screens/history/PlayerScreen.test.tsx` — **CREATED**. 8 tests covering the source-resolution branches, disabled-overlay copy, play / pause / scrub / unmount lifecycle, and event-subscription cleanup.
- `apps/mobile/__tests__/navigation/route-registry.test.ts` — **MODIFIED**. Adds `REQUIRED_PHASE_6_ROUTES = ['Player']` + a Phase-6 describe block; retires the historical "Phase-6+ early-warning" check (which asserted `Player` was NOT yet registered — now superseded).
- `apps/mobile/vitest.setup.ts` — **MODIFIED**. Adds `'Lock'` + `'Play'` to the `lucide-react-native` pre-populated icon allow-list (PlayerScreen's top-bar lock badge + the 64×64 play overlay).

## Decisions Made

- **Tap-anywhere midpoint seek** as the MVP scrub affordance (no draggable thumb). Rationale: design-spec §14 shows the 4 px accent fill without a thumb; full drag-to-seek is a v2 polish item. The `onSeek` wiring exists so the v2 upgrade is a one-component swap.
- **`DisabledOverlay` is an inline component** rather than a shared primitive — it has two distinct roles (archive-state-driven copy + runtime-error retry) and the styling is wholly internal to the Player surface. Promoting it to a primitive would over-generalize.
- **Mono time labels use a literal `'Menlo'` `fontFamily`** at the timeLabel site. The `typography.playerTime` token in tokens.ts doesn't carry a fontFamily (it lives on the `typography.fontFamily.mono` axis), and the Text primitive's variant→family resolver routes by weight. Inline `fontFamily: 'Menlo'` matches the existing pattern at the `recording/recState.ts` timer site (cmd / hh:mm:ss) and stays consistent with `typography.fontFamily.mono = 'Menlo'`.
- **Player error events fall through to the `network` retry state** (not `expired-link`) at the runtime-error catch site. The two states are conceptually distinct but the recovery action is identical (re-run `resolveSource`); the dedicated `'expired-link'` state is reachable through `refreshUrl` if a future server-side discriminator surfaces it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Symlinked main-repo `node_modules` into the worktree**

- **Found during:** Task 1 verify (`npm run typecheck`)
- **Issue:** The Claude Code worktree starts with no `node_modules` (only the git tree). `tsc --noEmit` failed across the board with `Cannot find module 'react' / 'react-native' / '@humyn/shared-types' / ...`. The pre-commit hook (`pnpm typecheck`) similarly failed with `tsc: command not found` for `apps/api` + `shared/types`.
- **Fix:** Symlinked the three needed `node_modules` directories from the main-repo checkout into the worktree: `apps/mobile/node_modules`, root `node_modules`, `apps/api/node_modules`. The shared install is the canonical worktree pattern and doesn't pollute git (all three paths are in `.gitignore`).
- **Files modified:** none (filesystem symlinks only).
- **Verification:** `npm run typecheck` exits 0 (only the pre-existing baseline error `design-system/task-icons/TaskIcon.tsx → lucide-react` remains); `pnpm typecheck` exits 0; pre-commit hook passes.
- **Committed in:** n/a (out-of-tree symlinks).

**2. [Rule 3 — Blocking] Extended `vitest.setup.ts` `lucide-react-native` allow-list with `Lock` + `Play`**

- **Found during:** Task 2 verify (`npm test -- --run PlayerScreen`)
- **Issue:** PlayerScreen renders the lock badge (`<Icon name="Lock" />`) and the play overlay (`<Icon name="Play" />`). The canonical `lucide-react-native` shim in `vitest.setup.ts` pre-populates an explicit allow-list (the proxy fallback doesn't surface through ES-module namespace lookup); `Lock` and `Play` weren't in it, so the Icon primitive's `LucideIcons[name]` resolved to `undefined` and React threw "No 'Lock' export is defined on the lucide-react-native mock."
- **Fix:** Added both icon names to the `ICONS` allow-list under a Phase 6 Plan 06-10 comment. Pattern matches the existing per-plan additions (Plan 02-10 Ban; Plan 04-07 RotateCw; Plan 06-07 Search / SearchX / etc.).
- **Files modified:** `apps/mobile/vitest.setup.ts`.
- **Verification:** Re-ran the test suite; all 8 PlayerScreen tests + the route-registry tests + the full 811-test mobile suite pass.
- **Committed in:** `7ecfc27` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (both Rule 3 — Blocking).
**Impact on plan:** Both auto-fixes were infrastructural — the symlinks restore the standard worktree-shared-install pattern (no behavioural change) and the lucide allow-list addition is the established per-plan convention for new icons. No scope creep, no behavioural change to PlayerScreen or the route registration.

## Issues Encountered

- **Pre-existing 3 unhandled rejections in `RootNativeStack.test.tsx`** (`HumynUpload.isBatteryOptimizationExemptSafe is not a function`). Baseline gap — `BatteryOptimizationScreen.tsx` (Plan 05-07) calls a HumynUpload method the vitest mock doesn't expose. These rejections existed before Plan 06-10 and are out of scope per the Rule-N scope boundary. Tracked elsewhere; full suite still passes 811/811 (rejections are unhandled but not assertion failures).

## TDD Gate Compliance

Task 2 was marked `tdd="true"` in the plan. The implementation (Task 1) intentionally landed before the test (Task 2) per the plan's task ordering — Task 1 (`feat`) lands the screen + route, Task 2 (`test`) lands the screen test + route-registry update. Git log shows:

1. `feat(06-10): add PlayerScreen + register Player route in RootNativeStack` (`8a27c7c`)
2. `test(06-10): PlayerScreen vitest + route-registry Phase-6 block` (`7ecfc27`)

The RED phase (a failing test before any implementation) was NOT exercised separately for this task — the production code was already in place by the time the test landed, so the test went GREEN on first run. This is consistent with the plan's explicit two-task split (Task 1 = implementation, Task 2 = test); the `tdd="true"` flag is honoured by the test-after pattern documented in the plan body. No gate trip.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `apps/mobile/src/screens/history/PlayerScreen.tsx` — FOUND
- `apps/mobile/src/navigation/RootNativeStack.tsx` — FOUND (modified)
- `apps/mobile/__tests__/screens/history/PlayerScreen.test.tsx` — FOUND
- `apps/mobile/__tests__/navigation/route-registry.test.ts` — FOUND (modified)
- `apps/mobile/vitest.setup.ts` — FOUND (modified)
- Commit `8a27c7c` (feat 06-10 Task 1) — present in git log
- Commit `7ecfc27` (test 06-10 Task 2) — present in git log
- Acceptance criteria — all grep counts pass; typecheck exits 0 (baseline only); 27 plan tests + 811 suite tests pass.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Player surface is wired end-to-end (HistoryRow tap → navigate('Player') → resolveSource → prepare); the `06-09` `navigation.navigate('Player', { recordingId, taskName })` call site (Wave 5 already shipped) now lands on a registered route.
- Phase 6 Wave 6 closes the streaming-in-MVP scope (HIST-07/08/09).
- Phase 7 observability work can now instrument the Player surface (loading-time, error-rate) — no `player_*` analytics event family exists at MVP per `06-UI-SPEC.md §Analytics`, but the screen has a clear instrumentation surface.
- v2 follow-ups (deferred): full drag-to-seek scrub thumb; semantic-search re-surfacing.

---

_Phase: 06-tasks-history-home-tiles-lexical-search_
_Completed: 2026-05-14_
