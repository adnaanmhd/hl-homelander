# Phase 3 — Deferred Items (out-of-scope for the plan that surfaced them)

Items logged here per the GSD execute-phase SCOPE BOUNDARY rule: an executor
that finds a pre-existing failure unrelated to its task records the failure
here rather than fixing it inside the current commit boundary.

---

## Pre-existing test failures observed at Plan 03-01 execution (2026-05-10)

**Discovered during:** Plan 03-01 Task 2 verification step (running `npx vitest run` after wiring jest-image-snapshot).

**Status:** Pre-existing on `main` BEFORE Plan 03-01 changes — confirmed by
`git stash` round-trip: failures reproduce with my Task 1 + Task 2 changes
stashed away.

**Failures (7 total across 2 files):**

- `apps/mobile/__tests__/screens/SplashScreen.test.tsx` — 4 tests fail with
  `Element type is invalid: ... got: undefined. ... Check the render method
of SplashScreen.` Last mutator commits: `5fe1443 fix(02-08): wire
react-native-config so Config.API_BASE_URL hydrates at runtime`,
  `5b9629c fix(02-08): break splash infinite loop + render real logo +
scalePop animation`. Likely cause: a transitive named-import drift
  (Config? Image? a primitive?) between the test's mock surface and the
  real screen's import shape post-Phase-2-soak fix-forward commits.
- `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx` — 3 tests
  fail with the same `Element type is invalid` shape (transitively
  rendering SplashScreen via the navigator's initial route).

**Why deferred (not fixed in 03-01):** Plan 03-01 ships ZERO screen edits
(per the plan body's explicit constraint: "DO NOT edit
`apps/mobile/src/screens/splash/SplashScreen.tsx` ... in this task — Plan
03-02 wires the new asset paths"). The render-time component-undefined
failure is a screen-import-graph regression that:

1. Is unrelated to the asset density-bucket addition (Task 1) — the failure
   reproduces with my changes stashed.
2. Is unrelated to the jest-image-snapshot adapter (Task 2) — the adapter
   only adds a vitest matcher; it does not touch React component imports.
3. Lives inside files that Plan 03-02 (cosmetic-screen-fixup) is the
   designated owner of — Plan 03-02 reads + edits `SplashScreen.tsx` per
   its `<files_modified>` block, so root-causing the render error there
   keeps the fix in its proper plan boundary.

**Where it should be fixed:** Plan 03-02 (cosmetic-screen-fixup). When
Plan 03-02's executor opens SplashScreen to wire the new asset paths,
the component-undefined regression will surface immediately on first
test run; Rule 1 (auto-fix bugs) applies inside that plan's scope.

**Verification command** (run inside Plan 03-02 to confirm fix):

```
cd apps/mobile && npx vitest run __tests__/screens/SplashScreen.test.tsx __tests__/navigation/RootNativeStack.test.tsx
```

Expected post-fix: 7 passed, 0 failed.
