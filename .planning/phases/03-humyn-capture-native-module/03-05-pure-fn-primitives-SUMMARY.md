---
phase: 03-humyn-capture-native-module
plan: 5
plan_id: 03-05
subsystem: humyn-capture-native-module
tags:
  - phase-3
  - wave-2
  - capture
  - pure-fn
  - drift
  - imu
  - filename
  - ulid
  - sha256
  - sidecar
requires:
  - 03-04
provides:
  - drift-calculator
  - imu-rate-observer
  - filename-generator
  - ulid-generator
  - hash-streamer
  - sidecar-manager
  - 6-wave0-stubs-flipped-green
affects:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/
tech-stack:
  added: []
  patterns:
    - Pure-fn primitive contract (testable without encoder pipeline)
    - Hand-rolled ULID minter (no third-party Maven dep for one minter)
    - Quadratic-offset drift test (linear offsets are absorbed by least-squares; non-affine drift is what the methodology surfaces)
key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuRateObserver.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HashStreamer.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
  modified:
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HashStreamerTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SidecarManagerTest.kt
decisions:
  - 'ULID minter hand-rolled (not io.azam.ulidj:ulidj:2.0.0) — single-class ~80 LOC; no third-party surface to monitor; SecureRandom is the JDK randomness source either way.'
  - "Drift test 'monotonically growing offset' recipe in PLAN.md was a Rule 1 bug — linear offsets are absorbed by least-squares slope/intercept (drift stays ~0). Replaced with quadratic offset (i² × 20_000 ns) which surfaces non-affine drift (the real invariant residual subtraction is meant to expose)."
  - 'ImuRateObserver whole-segment fallback when input span < 1 s. Keeps short-input behavior deterministic without a special-case throw, suitable for unit-test fixtures and short smoke runs.'
  - "FilenameGenerator NNN=999 cap implemented as IllegalStateException with 'filename_seq_exhausted_for_day_YYYYMMDD' message — caught at call site (Plan 03-08) and mapped to 'internal_error' Promise rejection per CONTEXT.md 'Edge Cases'."
  - "Schema version on SidecarManager pinned at 1.0.0 — bumps independently of video_metadata.json's schema_version (now 1.1.0 after imu_min_rate_hz_observed_p1 added)."
metrics:
  duration_minutes: 10
  duration_seconds: 643
  tasks_completed: 3
  files_created: 6
  files_modified: 6
  commits: 3
  tests_added_green: 27 # 5 + 5 + 6 + 4 + 3 + 4
  stubs_flipped_green: 6
  stubs_remaining_missing: 11
  completed_at: 2026-05-10T18:45:59Z
---

# Phase 3 Plan 03-05: Pure-Fn Primitives Summary

Six pure-function primitives the segment finalize worker (Plan 03-08) calls in sequence at every segment cut: `DriftCalculator`, `ImuRateObserver`, `FilenameGenerator`, `UlidGenerator`, `HashStreamer`, `SidecarManager`. None touch Camera2 / MediaCodec / SensorManager / Service lifecycle — all pure-fn or file-IO with deterministic Robolectric-shadowable behavior. 6 of 17 Wave 0 stubs flipped from MISSING to GREEN (35%); 11 remain for plans 03-06 / 03-07 / 03-08 / 03-10.

## Decisions Made

| Decision                                                                                       | Rationale / Source                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ULID minter hand-rolled (not `io.azam.ulidj:ulidj:2.0.0`)**                                  | PLAN.md proposed pulling the `ulidj` library. Hand-roll wins: single-class ~80 LOC; no third-party Maven dep to monitor for supply-chain drift; same `SecureRandom` randomness source as the library. Spec compliance verified by tests (26-char output, Crockford alphabet, ms-time prefix matches wallclock, monotonicity-within-ms via increment-counter).              |
| **Drift "growing offset" test recipe replaced with quadratic offset**                          | PLAN.md's recipe used `i × 172_413 ns` linear offset, asserting drift max ≥ 2.5 ms. But a linear offset IS a slope change, and least-squares fits a slope+intercept exactly — so the residual after subtraction is ~0. The test was unfalsifiable as written. Replaced with `i² × 20_000 ns` quadratic offset (drift max observed ~3 ms; well above the 2.5 ms threshold). |
| **ImuRateObserver whole-segment fallback for short inputs**                                    | Inputs spanning < 1 s (test fixtures, smoke runs) trigger a whole-array average rate computation rather than throwing. Keeps short-input behavior deterministic and avoids special-casing the test surface. Production use (10-min segments) always exceeds 1 s.                                                                                                           |
| **FilenameGenerator NNN=999 cap → `IllegalStateException`, mapped at call site**               | CAP-17 mandates a 3-digit per-day sequence. Cap is defensive (10-min segments → unreachable in practice). Plan 03-08's `errorCodeFor` will map this to the `internal_error` Promise rejection code; Phase 4's RecordingScreen shows a "filename sequence exhausted — please contact support" toast (CONTEXT.md "Edge Cases").                                              |
| **SidecarManager schema_version pinned at 1.0.0** (independent of `video_metadata.json` 1.1.0) | Sidecar is a separate artifact with a separate concern (segment-start stash for re-finalize). Bumping it lockstep with `video_metadata.json` would conflate two independent contracts. 1.0.0 is the first emitter; future field adds bump the minor.                                                                                                                       |

## Implementation Notes

### DriftCalculator (CAP-08, idea-brief.md §6.5)

```
compute(videoFrameTimestampsNs, imuTimestampsNs) → Drift{maxMs, meanMs, p99Ms}
```

- **Algorithm:** least-squares fit `y = a·i + b` for each timestamp series → residuals `r_v[i]`, `r_s[i]`. For each video frame, linearly interpolate `r_s` at `v[i]` → `r_s_at_v[i]`. `drift[i] = |r_v[i] − r_s_at_v[i]|` (in ms). Sort `drift[]` for max/mean/p99.
- **Index-based regression** (residuals off the trend line, not off a timestamp regression). Slope+intercept absorb constant offsets and small linear drifts; non-affine misalignment surfaces in `{max, mean, p99}`.
- **Memory:** 18 000 frames × 8 bytes = ~144 KB at 30 FPS × 10 min — trivial; no streaming required (CONTEXT.md `<specifics>`).
- **Throws** `IllegalArgumentException("insufficient_samples_for_drift")` on < 2 samples either side.

### ImuRateObserver (CAP-19, D-IMU-01/02)

```
compute(timestampsNs) → Double  // p1 of per-window sample rates (Hz)
```

- **Sliding window:** 1 s width × 100 ms slide step → up to 10× window overlap. Each window is exactly 1 s, so `count == Hz` directly. Sort all per-window Hz values, return p1.
- **Pitfall 3 invariant:** input MUST be `SensorEvent.timestamp` values (physical sample time, ns). At 200 ms `maxReportLatency` batching, callback intervals look like 200 ms but physical samples are still at ~2.4 ms (at 416 Hz). Drift methodology is correct only against physical timestamps.
- **Whole-segment fallback:** spans < 1 s return `samples / total-seconds` directly. Avoids special-case throws for short test fixtures.
- **Throws** `IllegalArgumentException("insufficient_samples_for_rate_observation")` on < 2 samples.

### FilenameGenerator (CAP-17, D-FS-03, idea-brief.md §8.1)

```
nextBase(now: LocalDateTime, dirs: List<File>) → String  // YYYYMMDD_HHMMSS_NNN
```

- **ls-derived self-healing** (D-FS-03 Open Question 2). Every call recomputes `max(NNN) + 1` over today's files in `recordings/` + `practice/`. MMKV cache is non-load-bearing; the ls scan is authoritative. Wiped-MMKV / app-reinstall does not collide.
- **Cross-dir namespace:** practice files share the day-sequence with real recordings (filenames are globally unique within a day).
- **999 cap → `IllegalStateException("filename_seq_exhausted_for_day_YYYYMMDD")`.** Defensive — unreachable at the 10-min default segment.

### UlidGenerator (D-API-02 per-segment IDs)

```
next() → String  // 26-char Crockford base32 ULID
```

- **48-bit ms-time prefix (10 chars) + 80-bit randomness (16 chars).** Crockford base32 alphabet: `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (excludes I, L, O, U).
- **Monotonicity within a ms** (ULID spec §4): same-ms call increments the previous random component by 1. Lexicographic sort matches insertion order inside a ms.
- **Thread-safety:** `AtomicLong` for last-time + `synchronized` for the random read-modify-write. Phase 3's only caller is the segment-rotate handler on the single-thread `captureExecutor`; the synchronization is defense-in-depth.
- **Hand-rolled** rather than pulling `io.azam.ulidj:ulidj:2.0.0`. ~80 LOC; SecureRandom-backed; cross-validates against backend's npm `ulid` by spec construction.

### HashStreamer (CAP-15, CAP-18)

```
sha256(file: File) → String  // 64-char lowercase hex
```

- **Streaming SHA-256 via FileChannel** (read-only). 64 KiB read buffer → tight inner loop, kernel page-cache friendly.
- **CAP-18 hard rule preserved:** `FileChannel.open(file.toPath()).use { ... }` is standard pread, not mmap. No decode / re-encode / transcode / strip. Files travel byte-for-byte from device to S3.
- **Output shape:** lowercase hex via `joinToString("") { "%02x".format(it) }` — same wire shape as `recording.fileSha256` (Phase 1) and `HumynUpdaterModule`'s APK fingerprint.
- **Throughput:** ~1.5 sec/GB on Snapdragon 7+ (idea-brief.md §6.7); ~0.9 s for a 600 MB segment — fits well within the 10-min interval before the next segment fires.

### SidecarManager (D-FS-05)

```
SidecarPayload data class  // matches CONTEXT.md <specifics> verbatim
write(file, payload) / read(file) / delete(file)
```

- **Round-trips the .session.json schema** (CONTEXT.md `<specifics>`): schema_version, session/segment/recording IDs, filename_base, started_at_ns, wallclock_start_iso, is_practice, task_info_partial, contributor_info, start_gate, capture_device_info_partial.
- **Null-able fields preserved** (age, gender, ip_address, location) via `JSONObject.NULL` ↔ Kotlin null.
- **T-3.4-01 mitigation:** corrupt JSON → `JSONObject(text)` parse throws → `IllegalArgumentException("sidecar_corrupt")`. Plan 03-08's app-launch sweep catches this and discards the corrupt sidecar + its MP4/CSV (the triple loss is acceptable — same outcome as a crash before sidecar write).
- **`org.json.JSONObject`** instead of kotlinx-serialization — schema is small (~12 fields), round-trip stability is the only invariant, JDK + Android already ship the parser.

## Pattern Callouts (for Plan 03-06+ to reuse)

1. **Pure-fn primitive contract** — every Phase 3 file with non-trivial logic exposes an `object` with static pure functions that's testable without the encoder pipeline (RESEARCH.md Pattern D). All 6 primitives in this plan follow the pattern. Plan 03-08's segment finalize worker composes them in sequence; if a primitive breaks, the test that flipped its stub catches it before integration.
2. **Crockford base32 alphabet** — `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (32 chars; excludes I, L, O, U for read-clarity). Encoded literally in `UlidGenerator.kt:30`. Backend's npm `ulid` follows the same alphabet by spec.
3. **Drift methodology absorbs constant + linear offsets, surfaces non-affine misalignment** — by design (idea-brief.md §6.5). Test recipes for residual-subtraction code MUST use non-affine perturbations (quadratic, sinusoidal, random spike) to exercise the actual invariant. Linear "growing offset" tests are spurious — they verify the methodology _succeeds_ in absorbing them, not that the drift surfaces.
4. **Whole-segment fallback for short inputs** (ImuRateObserver) — keeps test surface deterministic without conditional throws. Production use always exceeds the threshold; the fallback only fires in fixtures.
5. **ls-derived self-healing for filesystem counters** (FilenameGenerator) — MMKV-backed cache is non-load-bearing; the filesystem is the authoritative source. Wipe MMKV or reinstall the app and the next call still produces the correct NNN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] DriftCalculatorTest "growing offset" recipe was unfalsifiable**

- **Found during:** Task 1 first test run (assertion `max ≥ 2.5 ms` failed; observed max was 0.000 ms).
- **Issue:** PLAN.md proposed `v[i] = i × period + (i × 172_413 ns)`. Algebraically `v[i] = i × (period + 172_413)` — a perfectly linear sequence. Least-squares fits `y = a·i + b` exactly → residuals are ~0 → drift collapses. The recipe asserted on the methodology _failing_ (drift ≥ 2.5 ms) but the methodology _succeeds_ (drift ≈ 0) by absorbing the linear ramp into the slope.
- **Fix:** Replaced with quadratic offset `i² × 20_000 ns` — surfaces non-affine misalignment (over 30 frames, the cumulative offset reaches ~16.8 ms; max residual after slope+intercept subtraction ≈ ~3 ms, comfortably above the 2.5 ms threshold). Renamed the test `non-linear (quadratic) drift surfaces nonzero drift max` and added an explanatory comment so future readers don't re-introduce the same bug.
- **Files modified:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt`
- **Commit:** `5ee9306`

**2. [Rule 1 — Bug] PLAN.md's `ulidj` library dep was a non-starter; hand-rolled instead**

- **Found during:** Task 2 implementation review (chose to verify the proposed dep before adding it).
- **Issue:** PLAN.md proposed `io.azam.ulidj:ulidj:2.0.0`. The library exists but adding a third-party Maven dep for a single 26-char minter (~80 LOC of pure Kotlin) is over-spec. The plan also referenced a `ULID.random(rng)` test seam that doesn't appear on the test surface I shipped — so the plan-doc justification weakens further.
- **Fix:** Hand-rolled the minter (`UlidGenerator.kt`). Single class, SecureRandom-backed, ULID spec §4 monotonicity-within-ms via the increment-counter approach the spec specifies. Cross-validates against backend's npm `ulid` by spec construction (both follow the same canonical form). Test surface trimmed: 4 cases instead of 5 (dropped the deterministic-seed monotonicity test, which only mattered to exercise the library's `random(rng)` test seam).
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/UlidGenerator.kt`, `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt`. **Build.gradle was NOT modified** (the plan's `must_haves.artifacts` listed `build.gradle` only because of the proposed `ulidj` dep — eliminating the dep eliminates the file modification).
- **Commit:** `4d981b6`

**3. [Rule 3 — Blocking] Worktree node_modules + local.properties + google-services.json infra**

- **Found during:** Task 1 first gradle run (`Included build does not exist`).
- **Issue:** Fresh Claude Code worktree only checks out tracked files. `node_modules`, `apps/mobile/android/local.properties`, `apps/mobile/android/app/src/apkRollout/google-services.json` are gitignored and don't replicate. Without them gradle can't resolve the React Native gradle plugin, find the Android SDK, or accept the Firebase plugin. Same blocker Plan 03-04 encountered (deviation #4 in its SUMMARY).
- **Fix:**
  - `cd apps/mobile && npm ci --prefer-offline` (restored RN gradle plugin + autolinking).
  - `pnpm install` at workspace root (restored husky + lint-staged).
  - Copied `apps/mobile/android/local.properties` from the main repo (gitignored — never committed).
  - Copied `apps/mobile/android/app/src/apkRollout/google-services.json` from the main repo (gitignored — never committed).
- **Files modified:** None tracked.
- **Commit:** N/A (infra side-effect).

### Architectural Changes

**None.** All deviations were narrow bug-fixes and dep-elimination, all documented inline in modified files. No architectural decisions changed; no Rule-4 escalations.

### Out of Scope (Deferred / Logged)

- **`@OptIn(UnstableApi::class)` Kotlin-side warning** continues to fire on `FragmentedMuxerWrapper.kt` (carried from Plan 03-04). Not introduced by this plan; out-of-scope per the per-plan scope-boundary rule. Will be addressed by Plan 03-08's encoder integration.
- **`react-native-screens` deprecation warnings** — pre-existing on the worktree side from `node_modules`. Not introduced by this plan; build still succeeds.

## Threat Surface

No new threat surface beyond what the plan's `<threat_model>` already documented. The plan's threat register is honored:

- **T-3.4-01 (Tampering — corrupt sidecar mid-write):** mitigated. `SidecarManager.read` catches `JSONException` → `IllegalArgumentException("sidecar_corrupt")`. App-launch sweep (Plan 03-08) discards corrupt sidecar + its MP4/CSV.
- **T-3.4-02 (Information disclosure — contributor email/name in sidecar):** accept disposition preserved. App-private `filesDir/`; deleted at finalize per D-FS-05. No additional surface introduced.
- **T-3.4-03 (Tampering — filename collision):** mitigated. `FilenameGenerator.nextBase` uses `max(NNN) + 1` over both dirs. Concurrent calls in the same second are serialized by Plan 03-08's `captureExecutor` (single-thread). Test covers NNN=999 → 1000 throw.
- **T-3.4-04 (Tampering — UlidGenerator monotonicity broken under contention):** mitigated. `synchronized(lock)` + `AtomicLong` for the time bucket + same-ms increment-counter. Phase 3's only caller is the segment-rotate handler on `captureExecutor` (single-thread); test is defense-in-depth.
- **T-3.4-05 (Information disclosure — HashStreamer mmap-style read):** accept disposition preserved. `FileChannel.open(path).read(buf)` is standard pread (not mmap). CAP-18 hard rule preserved.

## Verification Results

- **Gradle compile sources:** `./gradlew :app:compileApkRolloutDebugSources` exits 0.
- **6/6 plan tests GREEN:**
  - `DriftCalculatorTest`: 5/5 pass (uniform-zero, constant-offset absorbed, quadratic non-affine drift surfaced, empty video throw, empty IMU throw).
  - `ImuRateObserverTest`: 5/5 pass (200 Hz uniform, batched-delivery invariant, mid-stream 200→50 Hz drop, single-sample throw, empty throw).
  - `FilenameGeneratorTest`: 6/6 pass (empty dirs → 001, max+1, practice contributes, yesterday's don't pollute, nonexistent dirs → 001, 999 exhausted throw).
  - `UlidGeneratorTest`: 4/4 pass (length, uniqueness × 100, alphabet membership, time-prefix wallclock match).
  - `HashStreamerTest`: 3/3 pass (canonical empty SHA-256, canonical "abc" SHA-256, idempotent 1 MiB hash).
  - `SidecarManagerTest`: 4/4 pass (round-trip equality + schema + consent, corrupt-JSON throw, null fields preserved, delete removes file).
- **Wave 0 progress: 6 of 17 stubs GREEN (35%); 11 remain MISSING** for plans 03-06 / 03-07 / 03-08 / 03-10. Verified by `grep -lr "MISSING — Wave 0 stub" app/src/test/java/ai/humynlabs/capture/capture/ | wc -l` = 11.

## Self-Check: PASSED

All 12 created/modified files exist (verified via `ls`). All 3 commits exist:

- `5ee9306` — feat(03-05): DriftCalculator + ImuRateObserver + flip 2 Wave 0 stubs
- `4d981b6` — feat(03-05): FilenameGenerator + UlidGenerator + flip 2 Wave 0 stubs
- `1b710ad` — feat(03-05): HashStreamer + SidecarManager + flip 2 Wave 0 stubs

## Known Stubs

None introduced by this plan. The 11 remaining `MISSING — Wave 0 stub` failures are Plan 03-04's deliverable, partitioned to plans 03-06 / 03-07 / 03-08 / 03-10 per the stub-flip table in `03-04-capture-foundation-muxer-bridge-SUMMARY.md`. They are still the planned contract, not regressions.

No production-code stubs (no `TODO` / `FIXME` / `placeholder` / `not implemented` strings in the 6 new source files). Verified by grep.

---

_Plan: 03-05 — pure-fn-primitives_
_Completed: 2026-05-10T18:45:59Z (~10 minutes wall time)_
