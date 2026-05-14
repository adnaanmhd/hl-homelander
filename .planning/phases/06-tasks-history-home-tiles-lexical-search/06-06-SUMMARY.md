---
phase: 06-tasks-history-home-tiles-lexical-search
plan: 06
subsystem: mobile-native-player
tags:
  [
    native-module,
    kotlin,
    media3,
    exoplayer,
    in-app-player,
    hist-07,
    hist-08,
    hist-09,
    d-07,
    t-6.6-01,
  ]
requirements: [HIST-07, HIST-08, HIST-09]
provides:
  - HumynPlayer Kotlin native module (prepare / play / pause / seekTo / release + 4 events)
  - HumynPlayerView TextureView native component
  - JS bridge (apps/mobile/src/native/HumynPlayer.ts) — facade + isPlayerAvailable() + 4 event subscribers
  - androidx.media3:media3-exoplayer:1.10.0 dep pin
  - MainApplication.kt package-list wiring
requires:
  - androidx.media3:media3-muxer:1.10.0 (already on the app classpath from Phase 3 plan 03-04 — same media3 minor)
  - PlayerScreen consumer (Plan 06-10, not yet shipped)
affects:
  - apps/mobile/android/app/build.gradle (+1 dep)
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (+1 import +1 package registration)
tech-stack:
  added:
    - androidx.media3:media3-exoplayer:1.10.0
  patterns:
    - hand-rolled Kotlin native-module triad (Module + Package + View + ViewManager + Controller) — mirrors HumynGateCamera
    - JS bridge with ensure() facade + isPlayerAvailable() discriminant + lazy NativeEventEmitter — mirrors HumynGateCamera + HumynUpload
    - URI scheme sandbox in PlayerController.validateUriScheme — mirrors no in-tree analog (new gate for T-6.6-01)
key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/PlayerController.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerView.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerViewManager.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerPackage.kt
    - apps/mobile/src/native/HumynPlayer.ts
    - apps/mobile/src/native/HumynPlayer.types.ts
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/player/HumynPlayerModuleTest.kt
  modified:
    - apps/mobile/android/app/build.gradle
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
decisions:
  - D-07 (CONTEXT): hand-rolled native player on media3-exoplayer (not react-native-video — CLAUDE.md "Do NOT Use")
  - TextureView (not SurfaceView) — composes inside RN's view tree so design-spec §14 player chrome overlays cleanly
  - HEVC plain MP4 only — no MediaItem DRM configuration (T-6.6-05 — accepted, no DRM at MVP)
  - Single ExoPlayer instance via `object PlayerController` (one player alive at a time; PlayerScreen mounts one HumynPlayerView)
  - SurfaceTextureDestroyed clears the player's video surface but does NOT release the player (Pitfall 5 — backgrounding / rotating preserves the codec; JS module invalidate() is the final release gate)
metrics:
  duration_minutes: ~11
  completed_at: 2026-05-14T04:51:29Z
  tasks_completed: 4
  files_changed: 10
  loc_added: 756
---

# Phase 06 Plan 06: HumynPlayer — Hand-rolled In-App HEVC Player on media3-exoplayer Summary

Wave 3 of Phase 6 ships the in-app fullscreen HEVC player as a hand-rolled Kotlin native module wrapping `androidx.media3:media3-exoplayer:1.10.0`. Mirrors the `HumynGateCamera` Module/Package/View/ViewManager triad line-for-line; adds a single `PlayerController` singleton + URI-scheme sandbox. Unblocks PlayerScreen (Plan 06-10) which consumes this module for HIST-07 / HIST-08 / HIST-09 (play-local + stream-via-presigned-URL).

## What Shipped

**Native (Android / Kotlin) — 5 files under `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/`:**

- `PlayerController.kt` (224 LOC) — `object` singleton wrapping one `ExoPlayer`. Methods: `prepare(ctx, uri, cb)`, `play()`, `pause()`, `seekTo(ms)`, `release()`. Emits 4 events over RCTDeviceEventEmitter: `onProgress` (250 ms ticker), `onBuffer` (every Player.STATE\__ transition), `onEnd` (STATE_ENDED), `onError` (PlaybackException with code + msg). URI-scheme sandbox in `validateUriScheme(ctx, uri)`: accepts `file://<filesDir>/_`and`https://\*`only; rejects everything else with`IllegalArgumentException`.
- `HumynPlayerModule.kt` (97 LOC) — RN module with 5 `@ReactMethod` promise wrappers + the `addListener`/`removeListeners` event-emitter stubs. `override fun invalidate()` releases the player on catalyst teardown.
- `HumynPlayerView.kt` (67 LOC) — `TextureView` + `SurfaceTextureListener`. Publishes its `Surface` to `PlayerController.onSurfaceAvailable(s)`; on `SurfaceTextureDestroyed` calls `PlayerController.onSurfaceDestroyed()` (clears surface, keeps player alive — Pitfall 5).
- `HumynPlayerViewManager.kt` (50 LOC) — `SimpleViewManager<HumynPlayerView>`, name `HumynPlayerView`. Single no-op `@ReactProp` silences the `ViewManagerPropertyUpdater` warning. `onDropViewInstance` defensively clears the surface.
- `HumynPlayerPackage.kt` (24 LOC) — registers Module + ViewManager.

**JS bridge — 2 files under `apps/mobile/src/native/`:**

- `HumynPlayer.types.ts` — `PlayerProgressEvent` / `PlayerBufferEvent` / `PlayerErrorEvent` payload types.
- `HumynPlayer.ts` — `HumynPlayer` facade with `ensure()` lookup (5 promise methods), `HumynPlayerView` via `requireNativeComponent`, `isPlayerAvailable()` discriminant, 4 event subscribers (`onPlayerProgress` / `onPlayerBuffer` / `onPlayerEnd` / `onPlayerError`) on a lazy `NativeEventEmitter`.

**Build / wiring:**

- `apps/mobile/android/app/build.gradle` — added `implementation 'androidx.media3:media3-exoplayer:1.10.0'` adjacent to the existing `media3-muxer:1.10.0` (single-pin maintenance; same media3 minor). No `media3-ui` (RESEARCH §14 — chrome rendered in React).
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` — additive import + `packages.add(HumynPlayerPackage())` line after `HumynUploadPackage()`. **All 13 previously-registered packages preserved.**

**Test — 1 file under `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/player/`:**

- `HumynPlayerModuleTest.kt` — 5 `@Test` methods, all green (1.4 s total). Robolectric `@Config(sdk = [33], application = Application::class)` bypasses MainApplication SoLoader.init NPE.

## Verification

| Check                                  | Command                                                                         | Result                                    |
| -------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| media3-exoplayer 1.10.0 pinned         | `grep -c '...:media3-exoplayer:1.10.0' build.gradle`                            | `1`                                       |
| media3-muxer:1.10.0 preserved          | `grep -c '...:media3-muxer:1.10.0' build.gradle`                                | `1`                                       |
| media3-ui NOT introduced               | `grep -c '...:media3-ui' build.gradle`                                          | `0`                                       |
| HumynPlayerPackage registered          | `grep -c HumynPlayerPackage MainApplication.kt`                                 | `2` (import + add)                        |
| 5 Kotlin player files exist            | `ls ...player/*.kt \| wc -l`                                                    | `5`                                       |
| 2 JS bridge files exist                | `ls HumynPlayer{.ts,.types.ts} \| wc -l`                                        | `2`                                       |
| 1 Robolectric test file                | `ls ...test/...player/*.kt \| wc -l`                                            | `1`                                       |
| Kotlin compile                         | `./gradlew :app:compileApkRolloutDebugKotlin`                                   | BUILD SUCCESSFUL                          |
| Robolectric test                       | `./gradlew :app:testApkRolloutDebugUnitTest --tests '...HumynPlayerModuleTest'` | 5/5 passed, 1.359s                        |
| media3-exoplayer resolves              | `./gradlew :app:dependencies --configuration apkRolloutDebugRuntimeClasspath`   | `androidx.media3:media3-exoplayer:1.10.0` |
| Mobile JS typecheck                    | `npm run typecheck` (apps/mobile)                                               | exit 0                                    |
| Backend JS typecheck (pre-commit hook) | `pnpm -r --parallel typecheck` (apps/api + shared/types)                        | exit 0                                    |

## Commits

| Task | Hash      | Message                                                                          |
| ---- | --------- | -------------------------------------------------------------------------------- |
| 1    | `2c7d420` | feat(06-06): add media3-exoplayer:1.10.0 + register HumynPlayerPackage           |
| 2    | `59041fd` | feat(06-06): hand-rolled HumynPlayer Kotlin module (5 files, media3 ExoPlayer)   |
| 3    | `26be7a6` | feat(06-06): HumynPlayer JS bridge — facade + 4 event subscribers                |
| 4    | `8645afb` | test(06-06): Robolectric coverage for HumynPlayer URI gate + release idempotence |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] KDoc lexer trap: `/[slash][star]` inside `://*`**

- **Found during:** Task 2 — first Kotlin compile after writing PlayerController.kt
- **Issue:** The original KDoc on `validateUriScheme` contained `\`https://_\``(backtick-wrapped). Kotlin's block-comment lexer (which permits nested`/_ … _/`) saw the `/_`substring inside`://*` as opening a *nested\* block comment. That nested comment was never closed, so the compiler reported "Unclosed comment" at EOF and "Missing '}' " for the surrounding function body.
- **Fix:** Reworded the KDoc to avoid the literal `[slash][slash][star]` sequence — substituted prose ("`file://`-under-filesDir accepted", "`https://`-any-host accepted") and added a note explaining the constraint. Implementation code (`validateUriScheme`) unchanged.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/PlayerController.kt`
- **Commit:** Folded into Task 2 commit `59041fd` (written before staging).

**2. [Rule 3 — Blocking issue] Acceptance-criteria grep matched only single-line `requireNativeComponent<…>('HumynPlayerView')`**

- **Found during:** Task 3 — acceptance verification step
- **Issue:** Wrote `requireNativeComponent<{ style?: ViewStyle }>(\n  'HumynPlayerView',\n)` over two lines (prettier-friendly formatting). The plan's grep check `requireNativeComponent.*HumynPlayerView` is line-anchored and returned `0`, failing acceptance even though the semantics are identical.
- **Fix:** Reformatted to a single line: `export const HumynPlayerView = requireNativeComponent<{ style?: ViewStyle }>('HumynPlayerView');`
- **Files modified:** `apps/mobile/src/native/HumynPlayer.ts`
- **Commit:** Folded into Task 3 commit `26be7a6`.

**3. [Rule 3 — Blocking issue] Worktree missing node_modules + Android SDK / google-services config**

- **Found during:** Task 1 — first commit attempt (pre-commit hook called `pnpm exec lint-staged` + `pnpm typecheck` — `tsc not found`); Task 2 — first gradle invocation (`SDK location not found`, `google-services.json missing`).
- **Issue:** Parallel-executor worktrees don't inherit the main repo's `node_modules`, `apps/mobile/android/local.properties`, or `apps/mobile/android/app/src/apkRollout/google-services.json`. Pre-commit hook + gradle build cannot run without these.
- **Fix:**
  - `pnpm install --frozen-lockfile` at worktree root (3.6 s — restored 642 packages, lockfile-validated).
  - `npm install` inside `apps/mobile/` (18 s — restored 850 packages for the npm-only mobile workspace).
  - Copied `local.properties` + `google-services.json` from the main repo (gitignored; not part of the commit).
- **Files modified:** none in the commit; bootstrap artifacts only.
- **Commit:** N/A (bootstrap; no source changes).

## Authentication Gates

None.

## Skipped Validations

None.

## Known Stubs

None. The HumynPlayer module is fully wired — the only "stub" is the no-op `@ReactProp(name = "noOpPlaceholder")` on the ViewManager, which is a deliberate RN-quirk silence pattern documented inline (mirrors `HumynGateCameraViewManager`'s `gateActive` prop) and explicitly required by the acceptance criteria.

## Threat Flags

None. All security-relevant surface (URI scheme sandbox T-6.6-01 → tested; DoS T-6.6-03 / Pitfall 5 → tested; no DRM T-6.6-05 / no URL leakage in events T-6.6-04) is already in the plan's `<threat_model>`. No new threat surface introduced.

## Notes for Plan 06-10 (PlayerScreen Consumer)

- Mount `<HumynPlayerView style={StyleSheet.absoluteFill} />` ONCE at screen mount — releasing + remounting drops the codec.
- Guard with `isPlayerAvailable()` before calling any `HumynPlayer.*` method (JSDOM unit tests + the rare missing-module case).
- The 4 event subscribers MUST `.remove()` on screen unmount — leaks are silent.
- `seekTo(positionMs)` accepts `number`; native side casts to `Long` (positionMs is already Long-safe in JS up to 2^53 ms ≈ 285k years — non-issue).
- `prepare(uri)` is async (Promise) but the actual media-source decode happens after resolution — JS should subscribe to `onPlayerBuffer` BEFORE calling `play()` to catch the initial `buffering: true` transition.
- For local playback: pass `file://${filesDir}/recordings/${segmentId}.mp4` (must be under `ctx.filesDir` or the URI gate rejects).
- For streamed playback: pass the `https://recordings.humyn.ai/...` URL minted by `GET /recordings/:id/stream-url` (Plan 06-03). The URL has a 5-min TTL; if `prepare()` rejects with a CloudFront-403 error code in the eventual `onError`, the screen should re-mint and retry.

## TDD Gate Compliance

Plan frontmatter is `type: execute` (not `type: tdd`), so the plan-level TDD gate sequence does not apply. Task 4 is a `tdd="true"` task that ships a Robolectric test covering the URI-sandbox behavior implemented in Task 2's `PlayerController.validateUriScheme()`. Because the implementation lands in Task 2 (commit `59041fd`) before the test in Task 4 (commit `8645afb`), there is no separate RED commit — the test is written against a known implementation contract and runs green on first invocation. This deviates from strict RED-first TDD, but matches the plan's explicit task ordering (Task 2 first, then Task 4). The behavioral contract being tested IS clearly specified in the plan's `<behavior>` block, so the test serves its regression purpose; future modifications to `validateUriScheme()` will be guarded by the 5 assertions.

## Self-Check: PASSED

**Files (8 created, 2 modified):**

- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/PlayerController.kt
- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerModule.kt
- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerView.kt
- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerViewManager.kt
- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/player/HumynPlayerPackage.kt
- FOUND: apps/mobile/src/native/HumynPlayer.ts
- FOUND: apps/mobile/src/native/HumynPlayer.types.ts
- FOUND: apps/mobile/android/app/src/test/java/ai/humynlabs/capture/player/HumynPlayerModuleTest.kt
- FOUND: apps/mobile/android/app/build.gradle (modified)
- FOUND: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt (modified)

**Commits:**

- FOUND: 2c7d420 (Task 1)
- FOUND: 59041fd (Task 2)
- FOUND: 26be7a6 (Task 3)
- FOUND: 8645afb (Task 4)
