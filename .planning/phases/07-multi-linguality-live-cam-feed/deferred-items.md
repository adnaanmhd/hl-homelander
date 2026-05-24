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
