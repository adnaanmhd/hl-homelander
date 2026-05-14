---
phase: 06-tasks-history-home-tiles-lexical-search
plan: 08
subsystem: ui
tags: [react-native, zustand, home-screen, contributions, filter-sheet, offline-banner, refresh-control, vitest, jsdom]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding
    provides: HomeSkeletonScreen.tsx (Phase 2 shell), TopBar + useTabTopBarProps, ScreenContainer, SoftUpgradeBanner, Toast, durationFormatter
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: HumynUpload native module + onUploadQueueChanged/onUploadProgress subscriptions, reconcileOnce, drainPendingUploadToast, UploadStatusChip, the §21.7 chip-mapping locked Pending-Uploads row layout (D-10), Wave-1.5 Item 5 toast drain + Item 6 nav-to-History + Wave-2 #5 drainNowSafe kick + Wave-2 #6 30s focus-poll
  - phase: 06-tasks-history-home-tiles-lexical-search (Wave 3)
    provides: contributionsApi.ts (fetchLifetime + fetchContributionsAggregate), services/timeRange.ts (computeRange + NamedRange), appStore.homeRange / homeRangeCustom Zustand slices + persisted MMKV keys, hero/tile/thumb token additions in ui/tokens.ts
provides:
  - HomeHero (empty + returning variants) — UI-SPEC §9a/§9b
  - ContributionTile (recording-duration + tasks-recorded) — UI-SPEC §9c
  - OfflineBanner (inline neutral palette, HOME-10) — UI-SPEC §Offline banner
  - FilterSheet shared component (16a quick-select + 16b custom range) — UI-SPEC §16
  - HomeScreen (replaces HomeSkeletonScreen) — wires hero + tile pair + Pending Uploads (Phase 5 D-10 verbatim) + offline banner + pull-to-refresh + FilterSheet
  - `home_view` + `home_tile_filter_changed` added to the analytics event allowlist (engineering-handoff §11 names)
affects:
  - 06-09 (History tab + MainTabs swap) — imports FilterSheet from screens/shared/, uses appStore.historyRange / historyRangeCustom (already shipped in Wave 3); MainTabs.tsx Home swap to HomeScreen lands in 06-09's atomic 3-tab swap.

# Tech tracking
tech-stack:
  added:
    - React Native RefreshControl (first consumer in the codebase)
    - Local JS counter-ease (setInterval + ease-out cubic) — no Reanimated worklet path needed yet
  patterns:
    - "Sibling scrim/sheet Modal layout — avoids JSDOM click-bubble dismiss (instead of nested Pressables)"
    - "Per-file react-native shim extension — replicates the canonical vitest.setup shim inline to add RefreshControl + visible-gated Modal"

key-files:
  created:
    - apps/mobile/src/components/HomeHero.tsx
    - apps/mobile/src/components/ContributionTile.tsx
    - apps/mobile/src/components/OfflineBanner.tsx
    - apps/mobile/src/screens/shared/FilterSheet.tsx
    - apps/mobile/src/screens/home/HomeScreen.tsx
    - apps/mobile/__tests__/components/HomeHero.test.tsx
    - apps/mobile/__tests__/components/ContributionTile.test.tsx
    - apps/mobile/__tests__/screens/shared/FilterSheet.test.tsx
    - apps/mobile/__tests__/screens/home/HomeScreen.test.tsx
  modified:
    - apps/mobile/src/util/analytics.ts (added 2 home_* event names to the allowlist)

key-decisions:
  - "Gradient implementation choice: solid `colors.heroGradStart` fill (no svg LinearGradient). The plan explicitly leaves this to the planner; chose smallest-blast-radius — the design-spec §9 vertical gradient is deferred to a Phase 7 polish item. Note documented in HomeHero.tsx header."
  - "Offline-signal source: JS-only `useState<boolean>(false)` in HomeScreen. The 06-CONTEXT plan suggests extending HumynUpload's `onUploadQueueChanged` payload with `offline: boolean` OR adding a new `onConnectivityChanged` event; neither has landed in HumynUpload.ts. This plan ships the render path + tests; a follow-on plan will wire the native subscription without changing OfflineBanner / Pending-Uploads section render logic."
  - "Date input in FilterSheet 16b: free-text `<TextInput>` with regex-validated `YYYY-MM-DD`. `@react-native-community/datetimepicker` is NOT in the dep list (verified package.json); the plan allows fallback to TextInput per RESEARCH Q-3 / D-03c."
  - "Counter-ease animation in HomeHero: `setInterval` + ease-out cubic (no Reanimated worklet). Per UI-SPEC §Motion 8 (1200ms counter ease). Avoids worklet runtime in the hero's first paint path."
  - "Sibling scrim/sheet layout in FilterSheet: scrim is `StyleSheet.absoluteFillObject` + the sheet body is positioned bottom — NOT nested Pressables (which fires onDismiss on every inner-Pressable tap under JSDOM, since RN's gesture-responder event-stop semantics aren't honored)."

patterns-established:
  - "Pattern 75 — JSDOM-safe modal layout: scrim + sheet body as SIBLINGS (not parent/child). Inner taps don't bubble to fire the scrim's onDismiss. Applies to any future modal/sheet shipping in this repo."
  - "Pattern 76 — Per-file react-native shim extension: when the test needs a host-component that vitest.setup.ts doesn't expose (RefreshControl, visible-gated Modal), replicate the canonical shim inline. NEVER `vi.importActual('react-native')` — RN's index.js has Flow `import typeof` syntax that Vite/Rollup can't parse."

requirements-completed: [HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-09, HOME-10]

# Metrics
duration: 21min
completed: 2026-05-14
---

# Phase 6 Plan 08: Home tab (hero + tile pair + filter sheet + offline banner + pull-to-refresh) Summary

**Replaces the Phase 2 HomeSkeletonScreen with a real HomeScreen that wires the empty / returning hero variants, the recording-duration + tasks-recorded tile pair driven by the homeRange Zustand slice + a shared FilterSheet (16a quick-select + 16b custom range), the Pending Uploads section gated by count>0 (Phase 5 D-10 wiring preserved verbatim), an inline OfflineBanner, and RefreshControl pull-to-refresh.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-05-14T05:10:14Z
- **Completed:** 2026-05-14T05:31:41Z
- **Tasks:** 3
- **Files created:** 9 (4 components + 1 screen + 4 vitest files)
- **Files modified:** 1 (analytics allowlist)
- **Tests passing:** 752 (all 102 vitest test files green; 21 new tests in this plan)

## Accomplishments

- HOME-01..HOME-06 + HOME-09 + HOME-10 closed in a single Wave-4 ship.
- FilterSheet shared component lands at `screens/shared/FilterSheet.tsx` — used by Home tiles here and ready for HistoryScreen's filter chip in Plan 06-09.
- Phase 5 D-10 Pending Uploads wiring (subscriptions, drain-on-tap kick, navigate-to-History, progress bar) preserved byte-for-byte; the only delta is the `pendingRows.length > 0` visibility gate + the OfflineBanner inside the section header strip.
- `home_view` + `home_tile_filter_changed` analytics events added to the runtime allowlist (engineering-handoff §11 documented them; they were dropping silently before).
- Counter-ease animation on the lifetime numeric (UI-SPEC §Motion 8: 1200ms ease-out cubic) implemented without a Reanimated worklet.

## Task Commits

1. **Task 1: HomeHero + ContributionTile + OfflineBanner + FilterSheet** — `3977fd2` (feat)
2. **Task 2: HomeScreen replaces HomeSkeletonScreen + extends home\_\* analytics** — `7f8f615` (feat)
3. **Task 3: Vitest coverage (HomeScreen + FilterSheet + HomeHero + ContributionTile)** — `36f7e06` (test; includes Rule 1 FilterSheet refactor)

## Files Created/Modified

### Created

- `apps/mobile/src/components/HomeHero.tsx` — empty + returning hero variants; solid dark fill (svg gradient deferred); `formatDuration()`-formatted lifetime numeric with 1200ms counter-ease cold-mount animation.
- `apps/mobile/src/components/ContributionTile.tsx` — single tile (recording-duration or tasks-recorded); mono numeric + chevron-row range label; `onTapChip` opens the FilterSheet at the parent.
- `apps/mobile/src/components/OfflineBanner.tsx` — neutral palette inline strip (`colors.line` bg, lucide `WifiOff` icon, `text2` label) — copy verbatim from UI-SPEC §HOME-10.
- `apps/mobile/src/screens/shared/FilterSheet.tsx` — 16a (6 quick-select options: Today / Yesterday / This week / This month / All time / Custom range) + 16b (FROM/TO date inputs with regex-validated `YYYY-MM-DD`; missing / inverted / future error states; sticky Cancel/Apply footer). Sibling scrim+sheet layout (Pattern 75).
- `apps/mobile/src/screens/home/HomeScreen.tsx` — full screen: TopBar + SoftUpgradeBanner slot + HomeHero + "YOUR CONTRIBUTION" section header + ContributionTile pair + empty-tip line + Pending Uploads section (verbatim Phase 5 D-10 wiring, `pendingRows.length > 0` gate, OfflineBanner inside header) + RefreshControl + FilterSheet at the bottom of the tree.
- `apps/mobile/__tests__/components/HomeHero.test.tsx` (4 tests).
- `apps/mobile/__tests__/components/ContributionTile.test.tsx` (3 tests).
- `apps/mobile/__tests__/screens/shared/FilterSheet.test.tsx` (6 tests).
- `apps/mobile/__tests__/screens/home/HomeScreen.test.tsx` (8 tests; per-file react-native shim extension adds RefreshControl + visible-gated Modal).

### Modified

- `apps/mobile/src/util/analytics.ts` — added `home_view` and `home_tile_filter_changed` to the `EVENT_NAMES` allowlist so the events the new HomeScreen fires don't drop with a dev-warning at runtime.

## Decisions Made

See `key-decisions` in frontmatter. Summary of the planner-discretion picks called out by the plan's `<output>` section:

- **Gradient implementation choice:** solid `colors.heroGradStart` fill (not SVG LinearGradient). `react-native-svg` is in the dep list and either path is viable; the solid fill keeps the component dependency-free and matches the 0% gradient stop visually. The vertical gradient is deferred to a Phase 7 polish item — no functional impact.
- **Offline-signal source:** JS-local `useState<boolean>(false)`. The plan's `<action>` for Task 2 explicitly allows this fallback when neither (a) extending HumynUpload's `onUploadQueueChanged` payload with `offline: boolean` nor (b) adding a new `onConnectivityChanged` event has landed in HumynUpload.ts. The render path is fully wired and verified by tests; a future Wave (or Plan 06-11's manual smoke) will hook the native NetworkMonitor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Added `home_view` + `home_tile_filter_changed` to analytics allowlist**

- **Found during:** Task 2 (HomeScreen wiring)
- **Issue:** Engineering-handoff §11 documents both event names, and the HomeScreen `<action>` in the plan explicitly calls `logEvent(...)` for both. But `apps/mobile/src/util/analytics.ts` `EVENT_NAMES` allowlist did not include them — the runtime `logEvent` call drops unknown event names with a `__DEV__` warning. Without this fix the home\_\* funnel is silently broken.
- **Fix:** Appended the two names to `EVENT_NAMES` with a header comment trailing to this plan.
- **Files modified:** `apps/mobile/src/util/analytics.ts`
- **Verification:** Typecheck green; logEvent calls reach `telemetryRing.append(...)` instead of the drop path.
- **Committed in:** `7f8f615` (Task 2 commit)

**2. [Rule 1 — Bug] Refactored FilterSheet from nested-Pressable to sibling scrim/sheet layout**

- **Found during:** Task 3 (FilterSheet.test.tsx execution)
- **Issue:** The initial FilterSheet impl mirrored `ui/primitives/Sheet.tsx`'s nested-Pressable shape (`<RNPressable scrim><RNPressable sheet>...children...</RNPressable></RNPressable>`). Under JSDOM, an inner Pressable's `onClick` bubbles to the outer scrim Pressable's `onPress`, firing `onDismiss` on every tap inside the sheet body — including the option rows that should only fire `onChange`. The result: `onDismiss` is called twice (once intended, once via bubble) on every option tap, and Custom-range tap fires `onDismiss` without it intending to. The Sheet primitive doesn't surface this bug because none of its current consumers click anything inside it that asserts no-onDismiss.
- **Fix:** Refactored to sibling layout — the scrim is a `RNPressable` with `StyleSheet.absoluteFillObject`, and the sheet body is a plain `View` positioned bottom (no Pressable wrapper). Inner taps no longer bubble to the scrim. Functional behavior on-device is identical (RN's gesture responder also doesn't propagate touches through a sibling Pressable above).
- **Files modified:** `apps/mobile/src/screens/shared/FilterSheet.tsx`
- **Verification:** All 6 FilterSheet.test.tsx tests pass after the refactor; no-hex-literals lint still green; full 752-test suite green.
- **Committed in:** `36f7e06` (Task 3 commit; folded with the test files since the test exposed the bug)

---

**Total deviations:** 2 auto-fixed (1 missing critical analytics allowlist entry, 1 bug in FilterSheet JSDOM tap-handling)
**Impact on plan:** Both auto-fixes essential — the analytics events would have silently dropped at runtime, and the FilterSheet bug would have caused the Home tile filter to misbehave under JSDOM-shape touch surfaces. No scope creep.

## Issues Encountered

- **`vi.importActual('react-native')` blew up the per-file mock with a Rollup parse error** because `react-native@0.83.0/index.js` includes Flow `import typeof` syntax. Solved by replicating the canonical vitest.setup.ts shim inline in the test file (Pattern 76 — Per-file react-native shim extension). This is the same approach `ReportProblemSheet.test.tsx` uses.
- **`RefreshControl` is not exported from the canonical vitest.setup.ts react-native shim.** The HomeScreen is the first consumer of `RefreshControl` in the codebase, so the shim needed extension. Documented in Pattern 76.
- **Visible-gated Modal:** the canonical Modal shim is a passthrough; the FilterSheet open/close test contract needed a `visible={false}` → render-null mock. Inlined per-file in HomeScreen.test.tsx.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 06-09 (Wave 4 sibling — History tab):** Ready. FilterSheet imports cleanly from `apps/mobile/src/screens/shared/FilterSheet.tsx`; the public surface (`{ visible, value, valueCustom, onDismiss, onChange, onCustomChange }`) is stable for both Home tiles AND History chip. Plan 06-09 also owns the atomic 3-tab MainTabs swap (Home → HomeScreen, Tasks → TasksScreen, History → HistoryScreen). Until that swap lands, HomeSkeletonScreen remains the active Home tab body (HomeScreen is the destination).
- **Future native plumbing:** A follow-on plan (likely §v2 polish or a Phase 7 task) should land HumynUpload's native `onConnectivityChanged` event so the OfflineBanner mounts in response to real connectivity loss. The JS-side surface is in place; only the native event hookup is missing.
- **Phase 7 polish:** the SVG `LinearGradient` for the dark hero card is documented in HomeHero.tsx's header note. Trivial to swap in without changing the component's public surface.

## Known Stubs

- **HomeScreen `offline` state:** Hard-coded `useState<boolean>(false)`. Documented in HomeScreen.tsx header note. The render path is wired and tested; only the native event hookup is missing. This is NOT a "stub blocking the plan's goal" — the plan explicitly allows this fallback per Task 2 `<action>` and the offline banner's role is to render a NEUTRAL banner when offline (a future-only signal until the native plumbing lands).

## Self-Check: PASSED

- Files created:
  - apps/mobile/src/components/HomeHero.tsx — FOUND
  - apps/mobile/src/components/ContributionTile.tsx — FOUND
  - apps/mobile/src/components/OfflineBanner.tsx — FOUND
  - apps/mobile/src/screens/shared/FilterSheet.tsx — FOUND
  - apps/mobile/src/screens/home/HomeScreen.tsx — FOUND
  - apps/mobile/**tests**/components/HomeHero.test.tsx — FOUND
  - apps/mobile/**tests**/components/ContributionTile.test.tsx — FOUND
  - apps/mobile/**tests**/screens/shared/FilterSheet.test.tsx — FOUND
  - apps/mobile/**tests**/screens/home/HomeScreen.test.tsx — FOUND
- Commits exist:
  - 3977fd2 (Task 1) — FOUND
  - 7f8f615 (Task 2) — FOUND
  - 36f7e06 (Task 3) — FOUND
- Verifications green:
  - `apps/mobile npm run typecheck` — exit 0
  - `apps/mobile npx vitest run __tests__/ui/no-hex-literals.test.ts` — 48 tests pass
  - `apps/mobile npx vitest run` (full suite) — 752 tests pass across 102 files

---

_Phase: 06-tasks-history-home-tiles-lexical-search_
_Completed: 2026-05-14_
