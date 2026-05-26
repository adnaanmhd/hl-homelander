# Phase 7 — Deferred items

Out-of-scope discoveries logged per executor scope-boundary rule. Each entry
records the discovery context so a future plan can fold it in deliberately.

## 2026-05-25 — Pre-existing `EncoderProbeTest` JVM unit-test failure (out of plan 07-07 scope)

**Test:** `ai.humynlabs.capture.compat.EncoderProbeTest > orphan compat-probe clips match the MainApplication sweep glob`

**Symptom:** Robolectric bootstrap throws `java.lang.NullPointerException` at
`com.facebook.soloader.ApplicationSoSource.getNativeLibDirFromContext(ApplicationSoSource.java:38)`
during test class init.

**Reproduces on `main`:**

```bash
cd /Users/adnaan/Documents/hl-homelander
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
cd apps/mobile/android
./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.compat.EncoderProbeTest"
# → BUILD FAILED with NPE in ApplicationSoSource
```

**Discovered during:** Phase 7 plan 07-07 (live-cam preview implementation) — the full
`:app:testApkRolloutDebugUnitTest` run reported this single failure outside any
file plan 07-07 touched.

**Out of scope rationale:** Pre-existing, not introduced by plan 07-07, not in any
file plan 07-07 modifies. All `ai.humynlabs.capture.capture.*` tests (the REC-LIVE-07
invariant surface plan 07-07 must preserve: FinalizeWorker / MetadataComposer /
MetadataSchemaConformance / HevcEncoderConfig / RealtimeGate / etc.) PASS.

**Suggested next-step:** A dedicated `/gsd-debug` session to investigate the Robolectric

- soloader interaction (likely a Robolectric SDK or AGP-version mismatch since
  this test pre-dates the recent capture pipeline changes). Not blocking any phase.

## 2026-05-26 — plan 07-13 — RecordingScreen visual baseline drift (out of scope)

Two visual snapshot failures in `apps/mobile/__tests__/visual/RecordingScreen.visual.test.tsx`:

- "recording-active-t05m32s" — 5.40% pixel diff
- (1 other in the same file — diff PNG at `__tests__/visual/__image_snapshots__/__diff_output__/`)

Pre-existing drift confirmed by reproducing on `HEAD` (before plan 07-13 edits)
via `git stash --include-untracked` + targeted vitest run. Plan 07-13 touches
help-center screens only; the RecordingScreen / live preview surface area is
unrelated. Logged for the wave's verifier or a later baseline-refresh pass.

### 2026-05-26 — Pre-existing visual-snapshot failures

Discovered during Task 2 (taskI18n.ts wiring). Confirmed via `git stash` + re-run on
the base branch (commit beec43d / 5bcac19 — the worktree base).

- `__tests__/visual/RecordingScreen.visual.test.tsx > matches baseline (recording-active-t10s)` — 5.40% diff vs snapshot, 20016 differing pixels.
- `__tests__/visual/RecordingScreen.visual.test.tsx > matches baseline (recording-active-t05m32s)` — 5.40% diff, 20016 pixels.

These failures predate plan 07-16 (the snapshot baselines drifted relative to the
current RecordingScreen render — likely the calibration / metadata schema 1.2.0
banner from 2026-05-22 changed the Text variant token references). Out of scope
for 07-16's i18n closure. Track in a follow-on visual-snapshot refresh quick task.
