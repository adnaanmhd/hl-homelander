# Phase 3: HumynCapture Native Module (Bytes-on-disk) - Context

**Gathered:** 2026-05-10
**Updated:** 2026-05-11 (Phase 3 closed; audio dropped from capture spec — see closure note below)
**Status:** Phase 3 COMPLETE 2026-05-11. See `03-HUMAN-UAT.md` for final disposition + `03-VERIFICATION.md` for closure trail.

> **2026-05-11 closure note — Audio dropped.** Many decisions below (D-API-02, D-CAP-\* boundaries that touch the audio path, D-WAVE-01 success-criteria scope) originally encompassed a 48 kHz mono AAC-LC 128 kbps audio track. After Phase 3 execution and smoke walks on Pixel 10a, audio capture was dropped from the locked spec to preserve the ±1 ms drift target. See `03-HUMAN-UAT.md` GAP-3 for the full decision trail. Decisions below remain historically accurate at planning time; live runtime state is per the GAP-3 disposition.

<domain>
## Phase Boundary

Phase 3 delivers two distinct workstreams in one phase, ordered by waves:

**Wave 1 — Phase 2 cosmetic fix-up (must land first):** Resolves every entry
in `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md`
plus any new gaps surfaced during the still-running Phase 2 §10–§13 manual
smoke walk on Pixel 10a. Includes both visual-only items (logo cropping +
asset-density buckets, font-rendering on Android, CTA position/width
across Sign-up/Permissions/Compat-fail, bottom-nav icons, Rig
illustration) and functional regressions captured during smoke (TopBar
avatar prop missing on Tasks/History tabs, foreground-rehydrate of
`appStore.user` after Android process kill, Compat-fail/Recovery merge,
Compat-pass auto-advance). Wave 1's detailed plan content (one bundled
plan vs split, snapshot-test infra placement, navigator-changing items)
is **deferred to a post-soak scoping pass** because the gap list is
still mutating; Wave 1 acceptance gate = `02-COSMETIC-GAPS.md` carries
`status: frozen-YYYY-MM-DD` AND every listed item has a corresponding
diff in the Wave 1 plan(s).

**Wave 2+ — `HumynCapture` Kotlin Camera2 + MediaCodec native module
(blocked on Wave 1 commit):** Produces the spec-compliant fragmented
MP4 + IMU CSV + metadata JSON triple per `idea-brief.md §6`. Concretely:

- A new `ai.humynlabs.capture.capture` Kotlin package (sibling of
  Phase 2's `ai.humynlabs.capture.compat` and `.updater`) with a
  `HumynCaptureModule` exposing a Promise + `NativeEventEmitter` API
  (`start(opts) → Promise`, `stop() → Promise`, events
  `onSegmentStart`, `onSegmentComplete`, `onSessionStop`,
  `onThermalAbort`, `onError`).
- Camera2 capture session at 1920×1080 / 30 FPS / no-OIS / no-HDR /
  REALTIME timestamp source feeding MediaCodec HEVC Main / 8 Mbps CBR
  / `KEY_LATENCY=1` + `KEY_MAX_B_FRAMES=0` / GOP 30, muxed via
  `MediaMuxer` into a fragmented MP4 with periodic moov-flush every
  30 s.
- 48 kHz mono AAC-LC 128 kbps audio stream timestamped against the
  same `SystemClock.elapsedRealtimeNanos` clock as video and IMU.
- IMU sidecar CSV (`timestamp_ns,sensor_type,x,y,z`, both sensors
  interleaved by timestamp) sampled at `SENSOR_DELAY_FASTEST` with
  `maxReportLatency` batching, sustaining ≥100 Hz (target) with an
  `imu_min_rate_hz_observed_p1` runtime observation recorded into
  metadata.
- 10-min auto-segmentation (Firebase Remote Config knob
  `capture.segment_minutes`, default `10L`) with a 0.5 s gap. Module
  owns the timer; emits per-segment events; concurrent finalize
  (segment N+1's encoder starts immediately after N closes file
  handles; segment N's SHA + drift + metadata-JSON run on a worker
  thread).
- Per-segment ULID `recording_id`, no `parent_recording_id` linkage,
  filename convention `YYYYMMDD_HHMMSS_NNN.<ext>` with a per-day
  sequence counter persisted in MMKV (or recovered by `ls
recordings/`).
- Per-segment finalize: SHA-256 of MP4 + SHA-256 of CSV; drift
  figures `{max, mean, p99}` via least-squares residual-subtraction
  per `idea-brief.md §6.5`; metadata JSON written atomically per
  `video_metadata.json` schema (extended with
  `imu_min_rate_hz_observed_p1`; schema_version → `1.1.0`).
- `HumynForegroundService` (`ai.humynlabs.capture.fgs`) holds type
  `camera|microphone|dataSync` during recording; `setUploadActive`
  seam exposed for Phase 5's `dataSync` downgrade + idle-stop +
  UIDT JobService extensions.
- Pre-record thermal refuse `≥ THROTTLING` and mid-record
  `≥ THROTTLING_SEVERE` 2.5 s graceful stop both owned by the module
  via `PowerManager.OnThermalStatusChangedListener`.
- App-launch sweep cleans `recordings/` orphans (re-finalize
  attempt for `.mp4`-without-`.json` using a per-segment
  `.session.json` sidecar; discard if MP4 corrupt) and `practice/`
  files older than 24 h.

**Explicitly OUT of Phase 3 scope:**

- No recording surface UX, no hand-detection gate, no TTS lifecycle,
  no §10 lifecycle edges (rotation / call / alarm / battery /
  storage). All of that is **Phase 4**. Phase 3 ships the bytes-on-disk
  module + the JS surface contract; Phase 4 integrates and runs the
  10-min E2E verification on a Pixel 7a/8a.
- No upload pipeline, no hash-verify worker, no `verified` event
  handling, no upload-pause coordination beyond emitting
  `onSessionStart` / `onSessionStop`. All **Phase 5**.
- No iOS analogue (`AVCaptureSession` + `AVAssetWriter` +
  `CMMotionManager` + `AVAudioRecorder`). **Phase 7**.
- No debug "Capture Test" RN screen. The 10-min real-device
  verification is deferred to Phase 4's smoke walk against the real
  `RecordingScreen`. Phase 3 acceptance is module-ready + unit tests
  - JS bridge contract; success-criteria #1–#5 from
    `ROADMAP.md` are downgraded to "module ready, full E2E verification
    deferred to Phase 4 smoke walk" — verifier must NOT fail Phase 3
    for missing real-device proof.

</domain>

<decisions>
## Implementation Decisions

### Wave structure

- **D-WAVE-01:** Phase 3 has two waves. Wave 1 = Phase 2 cosmetic
  fix-up (resolves `02-COSMETIC-GAPS.md` + post-soak additions).
  Wave 2+ = HumynCapture native module + tests + JS surface. Wave 2 is
  blocked on Wave 1 landing first (per memory
  `project_phase3_wave1_cosmetic_fixup.md`).
- **D-WAVE-02:** Wave 1's post-soak scoping pass **happened on
  2026-05-10**; the deferral is now resolved. Phase 2 manual smoke
  walk completed (commits `c2aa6dd` smoke complete, `5d038e2` UAT
  8/0, `94dfce6` security 61/61). `02-COSMETIC-GAPS.md` is stamped
  `status: frozen-2026-05-10` (D-WAVE-04). Wave 1 plan layout and
  snapshot infra are now locked in D-WAVE-05 / D-WAVE-06 instead of
  being deferred. Sequence today:
  1. ✅ Phase 2 manual smoke complete on Pixel 10a (2026-05-10).
  2. ✅ `02-COSMETIC-GAPS.md` frozen 2026-05-10 (D-WAVE-04).
  3. ⏭ `/gsd:plan-phase 3` runs and produces the two Wave 1 plans
     per D-WAVE-05 against the frozen gap list.
  4. ⏭ Both Wave 1 plans execute + on-device re-walk passes
     (D-WAVE-08), then Wave 2+ HumynCapture plans land on top.
- **D-WAVE-03:** Wave 1 in scope explicitly INCLUDES the functional
  regressions surfaced during smoke that ride alongside the
  cosmetic fixes — Tasks/History TopBar avatar wiring, foreground-
  rehydrate of `appStore.user` (option (a) from `02-COSMETIC-GAPS.md`:
  `RootNativeStack`/`MainTabs` foreground hook firing `/me` when
  `user == null && jwt != null`), `useTabTopBarProps()` extraction,
  Compat-fail + Compat-recovery merge into one screen (deletes the
  `CompatRecovery` route and updates the route-registry invariant
  test), Compat-pass auto-advance.

- **D-WAVE-04:** **`02-COSMETIC-GAPS.md` is frozen 2026-05-10.**
  The frontmatter carries `status: frozen-2026-05-10` and a
  `frozen:` line pointing at this decision. Phase 3 Wave 1 plans
  are written against the gap list **as it stands today**; new
  gaps surfaced during the Wave 1 on-device re-walk go to a
  separate `03-W1-AMENDMENTS.md` (D-WAVE-09), NOT back into
  `02-COSMETIC-GAPS.md`. This honors the freeze and keeps the
  Phase 2 doc as the historical record of what the smoke
  uncovered.

- **D-WAVE-05:** **Wave 1 plan layout = SPLIT: visual-only +
  nav-impact.** Two plans, executed in order:

  1. **`03-01-cosmetic-visual-fixup-PLAN.md`** — pure visual
     fixes that don't touch the navigator: logo asset re-export
     (D-WAVE-07, Task 1), font-not-RethinkSans diagnosis +
     resolution, CTA position + adaptive-width pass across
     Sign-up / Permissions / Compat-fail (post-merge), tighten
     value-prop spacing on Sign-up, rig illustration asset, bottom-
     nav Lucide icon wiring + touch-target sizing, support email
     substitution (5 `[EMAIL_ADDRESS]` occurrences), Splash
     animation re-verification, consent checkbox glyph upgrade,
     `react-native-asset` re-run if needed.
  2. **`03-02-cosmetic-functional-regressions-PLAN.md`** —
     navigation-graph-touching changes (depends on plan 1
     landing): Compat-fail + CompatRecovery merge into one screen
     (deletes the `CompatRecovery` route, updates Pattern 54
     route-registry invariant test, supersedes OQ-2 wording
     against the merged screen), Compat-pass auto-advance
     (replaces the existing CompatPass→next CTA test with
     `auto-routes after N ms`), `useTabTopBarProps()` hook
     extraction + Tasks/History TopBar avatar wiring,
     `RootNativeStack`/`MainTabs` foreground rehydrate hook
     firing `/me` when `appStore.user == null && jwt != null`.
     Reasoning: keeps navigator changes in their own atomic commit
     boundary so reviewer cognitive load stays manageable; visual
     baselines (D-WAVE-06) capture against a stable nav graph in
     plan 1, then plan 2 adds the merged Compat-fail screen as a
     new baseline. Plan 1 is independently shippable if plan 2
     deviates.

- **D-WAVE-06:** **Visual-snapshot infra = `jest-image-snapshot`
  driven through Vitest.** Phase 2 already has Vitest + jsdom
  wired (`apps/mobile/vitest.config.ts` + `vitest.setup.ts`).
  Plan 1 of Wave 1 adds:

  - `jest-image-snapshot` dev dep (peer with `expect.extend`
    adapter for Vitest).
  - `apps/mobile/__tests__/visual/` directory with one test per
    Phase 2 surface (Splash, Sign-up, Permissions, Compat-fail
    [merged], Compat-pass, RigTutorial, Home, Tasks, History,
    Profile).
  - Baselines committed to
    `apps/mobile/__tests__/visual/__image_snapshots__/`
    (in-repo, not gitignored). Default jest-image-snapshot path;
    versions with the source so PR reviewers see PNG churn when
    intentional design tweaks ship. Scale is small enough
    (~10 PNGs × ~30–100 KB) that Git LFS is not required.
  - CI `mobile-build` job runs the visual suite on every commit;
    a pixel-diff failure surfaces the diff PNG as a CI artifact.
    Why not hand-rolled DOM-tree snapshots: this gap list is
    CSS/layout-level (font choice, CTA position, logo crop) — the
    React tree shape stays identical across all the regressions we
    care about. Tree snapshots would catch zero of them.

- **D-WAVE-07:** **Logo asset re-export is Task 1 of
  `03-01-cosmetic-visual-fixup-PLAN.md`.** Subsequent visual
  tasks (CTA position, font diagnosis, rig illustration, etc.)
  build on top of the new asset baselines. Concretely Task 1:
  pre-crop the source 800×800 transparent-padded PNG in
  `design-system/logos/` to a tight wordmark bounding box,
  export at `@1x.png` / `@2x.png` / `@3x.png` density buckets,
  place under `apps/mobile/src/assets/logos/`, re-run
  `npx react-native-asset` if Metro doesn't pick the new buckets
  through the existing `require()` path, then swap usages on
  Splash + Sign-up + Home + (any other surface that took the
  cover-cropped 800×800). Drops the `<Image resizeMode="cover"
style={{width:N, height:M}}/>` magic-number dance everywhere.
  After Task 1 lands, jest-image-snapshot baselines (D-WAVE-06)
  are captured against the new asset, so subsequent tasks have
  clean baselines.

- **D-WAVE-08:** **Wave 2 acceptance gate = both Wave 1 plans
  land + on-device re-walk on Pixel 10a passes.** Concretely,
  Wave 2 (HumynCapture native module) plan-phase MUST NOT
  start until ALL of:

  1. `03-01-cosmetic-visual-fixup-PLAN.md` executor `done`
     commit landed (verify-work passed).
  2. `03-02-cosmetic-functional-regressions-PLAN.md` executor
     `done` commit landed (verify-work passed).
  3. Operator re-walks Splash → Sign-up → Permissions →
     Compat-fail (merged) → Compat-pass (auto-advance) →
     RigTutorial → Home (with logo + bottom-nav icons) →
     Tasks tab (avatar) → History tab (avatar) → Profile on
     **Pixel 10a only** (same device as Phase 2 smoke;
     broadening to 7a + non-Pixel happens in Phase 4 thermal
     walk per memory `feedback_functionality_first_during_smoke.md`).
  4. Operator signs off in `.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md`
     (created by plan 2's last task; Phase 2's `02-MANUAL-SMOKE.md`
     pattern). The sign-off includes a `re-walked-on: 2026-MM-DD`
     stamp.
     Visual-snapshot baselines (D-WAVE-06) gate CI but are NOT a
     substitute for the operator re-walk — pixel-perfect doesn't
     catch perceptual regressions like "the logo still looks
     small in person."

- **D-WAVE-09:** **New gap protocol during Wave 1 re-walk =
  `03-W1-AMENDMENTS.md` + fold into in-flight plan.** If the
  operator surfaces a NEW cosmetic or functional gap during the
  Wave 1 re-walk (D-WAVE-08 step 3) that wasn't in the frozen
  `02-COSMETIC-GAPS.md`:
  1. Append to `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md`
     (operator OR Claude during smoke; same shape as
     `02-COSMETIC-GAPS.md` — screen heading + bullet description).
  2. If discovered while plan 2 (functional regressions) is
     still in-flight: fold into plan 2 as a deviation entry
     (Rule 2 — completeness).
  3. If discovered after plan 2 ships: a third plan
     `03-03-cosmetic-amendments-PLAN.md` executes against the
     amendments doc BEFORE Wave 2 plan-phase starts (Wave 2
     gate D-WAVE-08 slips by exactly one plan execution).
  4. NEVER edit `02-COSMETIC-GAPS.md` post-freeze — that doc
     stays the historical record of Phase-2-smoke discovery.
     Why not "defer all amendments to a post-Wave-2 cleanup": the
     Phase 2 anti-pattern of cosmetic items getting punted forward
     indefinitely is exactly what the freeze stamp is meant to
     prevent. Amendments stay close to the surface they apply to.

### HumynCapture JS API surface

- **D-API-01:** **Promise + `NativeEventEmitter`** API. `start(opts)`
  returns `Promise<{sessionId, segmentId, recordingId, filenameBase}>`
  resolving when the encoder is up and the first frame is written.
  `stop()` returns `Promise<void>` resolving after the final segment
  finalizes. Events: `onSegmentStart`, `onSegmentComplete`,
  `onSessionStop`, `onThermalAbort`, `onError`. Failure surfaces via
  Promise rejection on the operation that triggered it (e.g.,
  `start()` rejects with `{code: 'thermal_throttling', recoverable:
true, currentStatus}` when pre-record thermal gate fires).
- **D-API-02:** `start(opts)` shape (JS owns user/task data; native
  synthesizes capture data):
  ```ts
  type CaptureSessionOpts = {
    taskId: string;
    taskName: string;
    taskCategory: string;
    taskSetting: 'indoor' | 'outdoor';
    contributor: {
      name: string;
      email: string;
      age: number | null;
      gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
      consent: true;
    };
    isPractice: boolean;
    startGate: {
      type: 'hand_detection';
      passed: boolean;
      skipped: boolean;
      bypassed: boolean;
      durationMs: number;
      consecutiveHitsRequired: number;
      platformCadenceMs: number;
    };
    location: string | null; // coarse, JS pre-resolves
    appVersion: string; // BuildConfig.VERSION_NAME
    dfovDegrees: number; // JS pre-resolves from
    //   compat.lastResult.v1
  };
  ```
  Native synthesizes: per-segment ULID `recording_id`, Build-derived
  device fields (`Build.MODEL`, `Build.VERSION.RELEASE`),
  `task_info.environment` (default `'residential'`),
  `task_info.time_of_day` (derived from local clock at recording
  start), filename, the entire `metadata.metadata` block (sizes,
  hashes, drift, codec params, timestamps, `start_gate` carried from
  opts).
- **D-API-03:** Event payload contracts (shaped for Phase 4
  consumption):
  ```ts
  onSegmentStart: { segmentId, recordingId, startedAt: string,
                    filenameBase: string };
  onSegmentComplete: { segmentId, recordingId, mp4Path, csvPath,
                       jsonPath, durationMs,
                       drift: { max: number, mean: number, p99: number },
                       imuMinRateHzObservedP1: number };
  onSessionStop: { sessionId, segmentsCompleted: number };
  onThermalAbort: { segmentId, currentStatus: string };
  onError: { code: string, message: string, recoverable: boolean,
             segmentId?: string };
  ```

### Segmentation ownership

- **D-SEG-01:** **Kotlin module owns the 10-min auto-segment timer.**
  JS calls `start(opts)` once; module schedules its own internal
  cuts; emits `onSegmentComplete` per cut + `onSegmentStart` for the
  next segment. JS calls `stop()` to end the whole session. Drives
  by `Firebase Remote Config` key `capture.segment_minutes`
  (default `10L`) read natively via the existing
  `@react-native-firebase/remote-config` SDK.
  Reasoning: IMU samples arrive every ~2.4 ms (at 416 Hz) — keeping
  the cut decision off the JS bridge eliminates round-trip latency
  in the IMU writer hot path. §4.3 explicitly says auto-segment cuts
  are silent (no TTS / haptic / gate re-run), so JS has nothing to
  do during the cut window.
- **D-SEG-02:** **Veto window** — JS can call `stop()` between
  segments (after `onSegmentComplete` and before `onSegmentStart`)
  to halt the session. Phase 4's recording-surface state machine
  uses this to honor §10 lifecycle events (rotation drop, thermal
  arrived during the gap, etc).
- **D-SEG-03:** **0.5 s gap mechanic** — concurrent finalize.
  Segment N+1's encoder + IMU writer start immediately after segment
  N closes file handles. Segment N's SHA + drift + metadata-JSON
  write run on a worker thread (the ~0.9 s SHA of a 600 MB MP4
  wouldn't fit in the 0.5 s gap if sequential). Planner picks the
  exact thread-pool layout.

### Storage layout, practice segregation, cleanup

- **D-FS-01:** **Real recordings:** flat
  `filesDir/recordings/{filenameBase}.{mp4,csv,json}`. Three sibling
  files per segment, one directory. Phase 5's upload pipeline globs
  `recordings/*.mp4` and finds matching `.csv` + `.json` by base
  name.
- **D-FS-02:** **Practice recordings:**
  `filesDir/practice/{filenameBase}.{mp4,csv,json}`. Structurally
  separate from `recordings/`. Phase 5's upload pipeline globs ONLY
  `recordings/`, so practice files are invisible to upload by
  directory boundary — not by an `is_practice` flag check. The
  metadata JSON schema is identical for practice and real (no schema
  fork); the directory IS the segregation.
- **D-FS-03:** **Filename convention** locked per `idea-brief.md
§8.1`: `YYYYMMDD_HHMMSS_NNN.<ext>` with `NNN` as the per-day
  sequence. Same base name across MP4 / CSV / JSON. Counter persists
  across restarts (recovered from `ls recordings/` + `ls practice/`
  if MMKV is wiped).
- **D-FS-04:** **App-launch sweep** owned by HumynCapture (runs in
  `MainApplication.onCreate` via the module's package init):
  - For each `recordings/*.mp4` without a matching `.json`, attempt
    re-finalize using the per-segment `.session.json` sidecar (see
    D-FS-05). Write the missing metadata JSON. Discard the triple
    if MP4 is corrupt (header parse fails) or the sidecar is
    missing.
  - Delete `recordings/*.json` orphans (no matching `.mp4`).
  - Delete `practice/*` files older than 24 h (defensive — ONB-08
    says practice runs once per install per Google account; old
    practice files are crash residue).
    Phase 5 still owns delete-on-`verified` for already-uploaded
    `recordings/*` triples. Phase 3 does NOT touch verified-but-
    undeleted files (Phase 5's reconciliation sweep already covers
    this).
- **D-FS-05:** **Per-segment `.session.json` sidecar.** Stashed at
  segment-start with the data JS provided in `start(opts)` —
  taskId, contributor, startGate, location, dfovDegrees,
  appVersion, isPractice, segment-start timestamp. Used at finalize
  time to compose the full metadata JSON, AND used at app-launch
  sweep time to re-finalize crashed segments. Sidecar lives next
  to the MP4 (e.g.,
  `recordings/{filenameBase}.session.json`); deleted at the moment
  of final-`.json` write so an orphan sidecar is an unambiguous
  crash signal. Lives in `recordings/` or `practice/` matching the
  segment's permanent home.

### CAP-19 IMU floor + foreground service + thermal

- **D-IMU-01:** **CAP-19 floor-reject is finalize-only mark.** Module
  observes IMU rate throughout the segment and computes
  `imu_min_rate_hz_observed_p1` at finalize. Stamps the figure into
  the metadata JSON. Does NOT mid-record reject. Server-side QA
  pipeline / `qa_status` derivation owns the actual rejection.
  _Interpretation note for planner:_ CAP-19's wording ("rejects
  segments client-side if sustained rate drops below 80 Hz") is
  honored by client-side _measurement_ + server-side filtering
  rather than mid-record stopping. This is a deliberate user
  decision; do NOT re-litigate.
- **D-IMU-02:** **`imu_min_rate_hz_observed_p1`** is a new field
  added to the `metadata.metadata` block of `video_metadata.json`.
  Schema version bumps from `1.0.0` → `1.1.0`. Planner confirms
  exact computation window (sliding-window-p1 vs whole-segment-p1).
- **D-FGS-01:** **HumynForegroundService** lives in Phase 3 at
  `ai.humynlabs.capture.fgs.HumynForegroundService.kt`. Started by
  HumynCaptureModule on `start()` with type
  `camera|microphone|dataSync` and `KEEP_SCREEN_ON` window flag set
  via the foreground activity. On `stop()`: if `setUploadActive(true)`
  has been called by Phase 5's HumynUpload (no-op in Phase 3), the
  service downgrades to `dataSync`-only; otherwise the service
  stops. Phase 5 extends this service — adds the 5-min-idle stop +
  UIDT JobService integration + the actual upload-side calls to
  `setUploadActive`.
- **D-FGS-02:** **`setUploadActive(boolean)`** is the seam Phase 3
  ships even though Phase 3 has no upload pipeline. No-op at Phase 3
  (nothing calls it); Phase 5 wires it.
- **D-THERM-01:** **HumynCapture owns both thermal checks.** Pre-
  record: `start()` reads `PowerManager.getCurrentThermalStatus()`
  first thing and rejects with
  `{code: 'thermal_throttling', recoverable: true, currentStatus}`
  if `≥ THROTTLING`. Mid-record: module subscribes to
  `PowerManager.OnThermalStatusChangedListener` at session start;
  on `≥ THROTTLING_SEVERE`, schedules a native 2.5 s graceful stop
  (TTS line plays from JS — Phase 4 listens to `onThermalAbort`
  and fires the voice cue + toast), finalizes the segment, emits
  `onThermalAbort` then `onSessionStop`.
- **D-UPL-01:** **CAP-13 pause-uploads** is structurally a no-op in
  Phase 3 (HumynUpload doesn't exist yet). Phase 3 emits
  `onSessionStart` and `onSessionStop`; Phase 5 wires JS-side
  listeners to `HumynUpload.pauseAll()` / `.resumeAll()`. CONTEXT.md
  flags this seam so Phase 5's discuss-phase doesn't re-invent it.

### Locked from upstream (carried forward, not re-discussed)

These are LOCKED in PROJECT.md / `.planning/research/STACK.md` /
`idea-brief.md` / `engineering-handoff.md` / `video_metadata.json` /
Phase 2 CONTEXT (`.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md`)
and unconditionally apply:

- **Capture spec LOCKED** per `idea-brief.md §2.1`: 1080p / 30 FPS /
  HEVC Main / 8 Mbps CBR / GOP 30 / no B-frames (`KEY_LATENCY=1` +
  verified at NAL-unit level) / 8-bit YUV 4:2:0 / no HDR / no OIS /
  48 kHz mono AAC-LC 128 kbps audio / IMU sustained ≥100 Hz captured
  at device max via `SENSOR_DELAY_FASTEST` /
  `SystemClock.elapsedRealtimeNanos` clock /
  `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME` / ±1 ms clock-domain
  alignment. Devices that fail any of these at compat are blocked
  from recording (Phase 2's gate). Lowering any threshold
  "to unblock smoke walk" is a blocking anti-pattern (per Phase 2
  `.continue-here.md` table).
- **Capture pipeline must NOT route through VisionCamera or
  CameraX** — encoder controls (B-frames, bitrate mode) aren't
  exposed (per `STACK.md` hard rules + PROJECT.md tech-stack
  constraint).
- **Files NEVER decoded / re-encoded / transcoded / stripped** —
  byte-for-byte from device to S3 (PROJECT.md constraint + CAP-18).
- **Drift methodology** — least-squares residual subtraction per
  `idea-brief.md §6.5`; metrics are `{max, mean, p99}` (memory
  `project_drift_metrics.md`).
- **IMU CSV format** locked per `idea-brief.md §6.4 / §8.2`:
  `timestamp_ns,sensor_type,x,y,z` columns; both sensors interleaved
  by timestamp; native sensor units (rad/s for gyro, m/s² for
  accel); no inline header units.
- **Metadata JSON schema** — `video_metadata.json` at repo root is
  canonical. Phase 3 adds one new field
  (`imu_min_rate_hz_observed_p1`); schema_version bumps to `1.1.0`.
- **Filename convention** `YYYYMMDD_HHMMSS_NNN.<ext>` per
  `idea-brief.md §8.1` and CAP-17.
- **10-min auto-segment** (Remote Config knob), 0.5 s silent gap,
  per-segment ULID, no `parent_recording_id` linkage (CAP-09).
- **Hand-gate does NOT re-run at auto-segment cuts** (CAP-10).
  Module preserves `start_gate` block from `start(opts)` across all
  segments in the session.
- **Foreground service type `camera|microphone|dataSync` during
  recording, `KEEP_SCREEN_ON`** (CAP-14).
- **Pre-record thermal refuse `≥ THROTTLING`, mid-record
  `≥ THROTTLING_SEVERE` ends segment within ~2.5 s** (CAP-11/12).
- **Pause uploads on record start, resume on stop** (CAP-13) — the
  _signal_ (events) ships in Phase 3; the _handler_ lands in
  Phase 5.
- **SHA-256 of MP4 + CSV at finalize**, stamped into metadata JSON
  as `file_sha256` / `imu_sha256` (CAP-15).
- **iOS deferred to Phase 7.** Phase 3 is Android-only.
- **Phase 4 owns** recording-surface UX, hand-detection gate, §10
  lifecycle edges, practice-recording flow. Phase 3 ships the
  bytes-on-disk module + JS bridge contract.
- **Phase 5 owns** upload pipeline, hash-verify worker, IMU-liveness
  fraud check, OEM battery-optimization walkthrough, delete-on-
  `verified`. Phase 3 ships the per-segment artifact (MP4 + CSV +
  JSON) + the FGS seam.
- **No clan-chief / KGeN narrative** anywhere in Phase 3 surfaces
  (memory `feedback_no_clan_chief_constructs.md` —
  `PROJECT.md` / `REQUIREMENTS.md` / `idea-brief.md §3.1` references
  to clan-chief network are stale and superseded).
- **No precise location capture; coarse only.** JS resolves coarse
  location to a city/country string and passes via `start(opts)`;
  module never calls Location APIs directly.
- **English only at MVP** — TTS voice line on thermal abort fires
  from JS (Phase 4) per `engineering-handoff.md §6.3` chain (en-IN
  female → en-IN neutral → en-US female → first available en-\*).
- **No notifications channel** — no `POST_NOTIFICATIONS`, no
  FCM/APNs (PROJECT.md constraint).
- **No success metrics gating phase completion** (PROJECT.md). Phase
  3 ships by-vibe.
- **Wave 1 anti-pattern lessons from Phase 2 `.continue-here.md`
  apply.** Three blocking patterns carry into Phase 3:
  1. Surgical-stage protocol for protected files (`SignupScreen.tsx`,
     `Text.tsx`, `CLAUDE.md`) when they carry uncommitted backlog —
     never blanket `git add`.
  2. No cosmetic chasing during smoke; gaps go into the structured
     parking lot only.
  3. Never lower capture-spec thresholds to "unblock" anything —
     root-cause the code path instead.

### Claude's Discretion

Areas where the user did not specify and the planner has flexibility:

- **0.5 s gap mechanic exact threading** — concurrent finalize is
  locked (D-SEG-03); planner picks the worker-thread layout (single
  finalize-thread vs per-segment thread vs `Executors.newCachedThreadPool`).
- **Error semantics on encoder/storage crash** — fragmented MP4
  up-to-last-30s-flush stays on disk, partial CSV stays, NO
  metadata JSON written for the crashed segment; emit
  `onError({code, segmentId, recoverable})` then `onSessionStop`.
  Phase 4 decides finalize vs discard. Planner picks the exact
  error code taxonomy.
- **IMU sensor batching `maxReportLatency` value** — `~200 ms` is
  industry-standard; planner picks. Tradeoff: longer batch →
  better battery, samples arrive in bursts (drift methodology
  handles this); shorter batch → more wakeups.
- **`imu_min_rate_hz_observed_p1` exact computation** — sliding-
  window-p1 (e.g., 1 s windows over the segment) vs whole-segment
  p1. Planner picks based on what the QA pipeline actually
  consumes.
- **Per-day filename sequence (`_NNN`) recovery** — MMKV-backed
  counter vs `ls recordings/ | ls practice/`-derived. Planner
  picks. MMKV is faster; ls-based is self-healing.
- **Camera2 device selection** — Phase 2's DeviceCaps already
  enumerates ultrawide. HumynCapture should reuse the same
  enumeration logic. Planner picks: extract a shared util in
  `ai.humynlabs.capture.common`, vs duplicate with a
  `// keep in sync with DeviceCaps` comment, vs HumynCapture
  reads from `compat.lastResult.v1` and trusts the lens id from
  there.
- **Audio source mode** — `MediaRecorder.AudioSource.MIC` vs
  `VOICE_RECOGNITION` (suppresses some platform AGC). Planner
  picks based on `engineering-handoff.md §5` "measurement /
  video chat mode" guidance.
- **Encoder buffer pool size + pre-allocation** — pre-allocated at
  recording start per `idea-brief.md §6.6`. Exact sizes are
  planner-level.
- **`HumynCapture.ts` JS surface file location** — likely
  `apps/mobile/src/native/HumynCapture.ts` matching Phase 2's
  pattern. Confirmed; planner ships at this path.
- **Re-finalize policy for edge cases** — partial CSV with no
  matching gyro/accel pair on the trailing edge; missing audio
  buffer at the cut. Planner picks the discard-vs-truncate-vs-
  pad rule.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope, requirements, and success criteria

- `.planning/ROADMAP.md` — Phase 3 entry (success criteria #1–5;
  depends on Phase 1; UI hint: no).
- `.planning/REQUIREMENTS.md` — 19 v1 requirements mapped to
  Phase 3: CAP-01..CAP-19 (lines 88–108 of REQUIREMENTS.md). Note:
  CAP-19's "rejects segments client-side" wording is honored by
  client-side measurement + server-side filtering per D-IMU-01.
- `.planning/PROJECT.md` — locked constraints (capture spec
  non-negotiable; Camera2 + MediaCodec; files never re-encoded;
  English only; no notifications). **NOTE:** PROJECT.md still
  carries stale clan-chief / KGeN narrative; treat as superseded
  per memory `feedback_no_clan_chief_constructs.md`.
- `.planning/STATE.md` — current position; resume notes carry the
  Phase 2 → Phase 3 handoff.

### Capture-spec source-of-truth (mandatory reads for Phase 3)

- `idea-brief.md` — capture spec source. Phase 3 hot-spots:
  §2 (Capture Requirements; §2.1 strict, §2.2 preferences); §6
  (Capture Pipeline Technical — §6.1 stack, §6.2 encoder config,
  §6.3 audio, §6.4 IMU, §6.5 synchronization + drift methodology,
  §6.6 mid-recording resilience, §6.7 post-recording finalization);
  §8 (Data & File Outputs — §8.1 filename convention, §8.2 IMU CSV
  format, §8.3 metadata JSON); §10 (App Lifecycle & Edge Cases —
  table is Phase 4 territory but the thermal / battery / storage
  rows touch Phase 3's module-level checks).
- `video_metadata.json` (repo root) — canonical metadata JSON
  schema. Phase 3 emits this verbatim per segment + adds one new
  field `imu_min_rate_hz_observed_p1`; schema_version → `1.1.0`.
- `engineering-handoff.md` — engineering contract. Phase 3
  hot-spots: §4.3 (Recording state machine — `RecState` shape;
  Phase 4 owns the state machine but the `gate` block flows
  through Phase 3's `start(opts).startGate`); §5 (Native APIs
  table — Camera2, MediaCodec, AudioRecord, SensorManager,
  PowerManager.thermalStatus rows); §6.3 (Speech voice fallback
  chain — Phase 4 wiring but referenced from D-THERM-01).

### Phase 1 outputs (consume directly)

- `.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md`
  — backend / distribution decisions; Phase 3's metadata JSON
  schema must align with Phase 1's `POST /recordings` payload
  shape (Phase 5 mediates the upload).
- `apps/api/src/routes/recordings/` — Phase 1 backend handlers for
  `/recordings` lifecycle. Phase 5 will consume; Phase 3 verifies
  the metadata-JSON shape can be mapped 1:1 to the API's expected
  payload.

### Phase 2 outputs (consume directly + the cosmetic backlog)

- `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md`
  — Phase 2 implementation decisions; the entire D-COMPAT-_ +
  D-NAV-_ + D-STATE-_ + D-UI-_ + D-PKG-\* blocks carry into Phase 3
  unmodified. **D-COMPAT-05** (`CompatResult` Zod schema) is the
  source for `dfovDegrees` that JS passes via `start(opts)`.
- `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md`
  — **Wave 1 input. Frozen 2026-05-10** (D-WAVE-04). Planner
  reads at plan-time; both Wave 1 plans (D-WAVE-05) resolve every
  entry. Do NOT edit post-freeze; new gaps go to
  `03-W1-AMENDMENTS.md` per D-WAVE-09.
- `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md`
  — **created during Wave 1 re-walk if needed.** Per-screen list
  of new gaps the operator surfaces during the on-device re-walk
  (D-WAVE-08 step 3) that weren't in the frozen
  `02-COSMETIC-GAPS.md`. Folded into in-flight plan or a
  third Wave 1 plan per D-WAVE-09.
- `.planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md`
  — **created by `03-02-cosmetic-functional-regressions-PLAN.md`'s
  last task.** The operator-driven re-walk runbook for the Wave 2
  acceptance gate (D-WAVE-08); pattern-match against Phase 2's
  `02-MANUAL-SMOKE.md`. Sign-off includes a `re-walked-on:
2026-MM-DD` stamp; that stamp is the gate that unblocks Wave 2
  HumynCapture plan-phase.
- `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/.continue-here.md`
  — three blocking anti-patterns that carry into Phase 3 (surgical-
  stage protocol for protected files; no cosmetic chasing during
  smoke; never lower capture-spec thresholds).
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/`
  — pattern source for Phase 3's HumynCapture module:
  - `HumynCompatModule.kt` — `ReactContextBaseJavaModule` +
    `Promise` ergonomic. Phase 3's `HumynCaptureModule.kt`
    follows this skeleton.
  - `HumynCompatPackage.kt` — `ReactPackage` registration.
    Phase 3 adds an analogous `HumynCapturePackage.kt`.
  - `EncoderProbe.kt` — Camera2 + MediaCodec + MediaMuxer
    end-to-end pattern (5 s probe). Phase 3's actual capture path
    is structurally similar but stripped of the probe-cleanup
    `finally` and extended to handle the IMU + audio + drift +
    SHA + segment lifecycle.
  - `ImuProbe.kt` — `SensorManager.registerListener` +
    `SENSOR_DELAY_FASTEST` + `maxReportLatency` pattern. Phase 3's
    IMU writer reuses the listener pattern; writes to CSV
    instead of computing rates.
  - `NalParser.kt` — H.265 NAL-unit walker with B-frame detection.
    Phase 3 may invoke this once at session start as a sanity
    check on the encoder's first GOP, OR skip (compat already
    verified the device can produce no-B-frame HEVC).
  - `DeviceCaps.kt` — ultrawide-camera enumeration. Phase 3's
    Camera2 device selection should reuse the same enumeration
    logic (planner picks: extract shared util vs read from
    `compat.lastResult.v1`).
- `apps/mobile/src/native/HumynCompat.ts` — JS-side native-module
  binding pattern for Phase 3's `HumynCapture.ts`.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`
  — `onCreate` is where Phase 3 hooks the app-launch sweep
  (D-FS-04). Phase 2 already wired the `compat-probe-*.mp4`
  orphan sweep here; Phase 3 adds the `recordings/` + `practice/`
  sweep alongside.
- `shared/types/CompatResult.ts` — Zod schema for compat results;
  Phase 3's JS layer reads `compat.lastResult.v1.checks.ultrawideDfov.measuredDeg`
  to populate `dfovDegrees` in `start(opts)`.

### Research synthesis (background; some references are stale)

- `.planning/research/STACK.md` — version pins. Phase 3 reads:
  Camera2 + MediaCodec recipe, OEM-specific pitfalls (Pitfall 1),
  MediaMuxer fragmented-MP4 recipe, AudioRecord configuration,
  SensorManager batching guidance, Android 14/15 foreground-service-
  type-restriction notes (will be Phase 5 territory but the
  service-class lands here).
- `.planning/research/PITFALLS.md` — Pitfall catalog. Phase 3
  hot-spots: Pitfall 1 (Camera2 + MediaCodec gotchas); Pitfall 2
  (OIS readback verification — already proved out in
  `EncoderProbe.kt`); Pitfall 3 (HDR→SDR force on API 33+).
- `.planning/research/ARCHITECTURE.md` — system architecture.
  Phase 3 lives entirely in the device plane; backend plane is
  consumed via the metadata JSON shape that Phase 5 ships to
  Phase 1's `/recordings` API.
- `.planning/research/SUMMARY.md` — research synthesis.
  **NOTE:** still references the chief-recon narrative; treat as
  superseded.

### Operational / future (referenced but not Phase 3 scope)

- `imu-liveness-check.md` — Phase 5 territory. Phase 3's IMU CSV
  is the input to Phase 5's liveness check; the format is locked.
- `figure-app-hands.md` — Phase 4 reference (hand-gate). Phase 3
  takes the gate-block as input via `start(opts)`; doesn't
  implement hand detection.
- `testing-guide.md` — Pixel runbook + monorepo dev environment.
  Phase 3 will append a `03-MANUAL-SMOKE` entry covering the
  apkRollout module-load + unit-test smoke (NOT a 10-min E2E —
  that's Phase 4).
- `0.16.0.apk` — Figure's "Minutes" app, retained as a
  reverse-engineering reference for the hand-gate (Phase 4).
  Phase 3 does NOT consume it (memory
  `project_figure_minutes_app.md`).
- `deferred-decisions.md` — v2 deferrals. Per-upload attestation,
  perceptual hash dedup, etc.
- `strategic-suggestions.md` — PM-level v2 concerns.

### Active memories (apply unconditionally)

- `feedback_no_clan_chief_constructs.md` — no clan-chief
  constructs anywhere in Phase 3 (relevant only because
  `idea-brief.md §3.1` and `PROJECT.md` mention clan-chief
  network; Phase 3 metadata JSON should NOT include any
  clan-chief field).
- `project_distribution_apk_then_play.md` — distribution = APK
  first → Play Store → iOS, direct to users (relevant for
  flavor-aware behavior if any lands in Phase 3; default = none,
  HumynCapture is flavor-agnostic).
- `project_drift_metrics.md` — drift figures `{max, mean, p99}`
  per `idea-brief.md §6.5`. Phase 3 emits all three.
- `project_figure_minutes_app.md` — Figure's app is reference for
  hand-gate (Phase 4), not Phase 3.
- `project_phase3_wave1_cosmetic_fixup.md` — Phase 3 Wave 1 =
  cosmetic fix-up; addresses `02-COSMETIC-GAPS.md` BEFORE any
  HumynCapture work lands.
- `feedback_functionality_first_during_smoke.md` — defer cosmetic
  issues to a later cleanup wave; don't rebuild mid-smoke. Active
  during Wave 1 plan write-up.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets (from Phase 2)

- **`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/`** —
  the entire HumynCompat module is the _pattern source_ for
  HumynCapture. The Camera2 + MediaCodec + MediaMuxer end-to-end
  in `EncoderProbe.kt` (5 s probe) covers the exact moving parts
  Phase 3 builds on (encoder config with HEVC Main / 8 Mbps CBR /
  no-B-frames / no-OIS / no-HDR; Camera2 device selection;
  `MediaMuxer` muxing; `TotalCaptureResult` readback). The IMU
  capture pattern from `ImuProbe.kt` (`SensorManager.registerListener`
  - `SENSOR_DELAY_FASTEST` + `maxReportLatency` batching) carries
    over to Phase 3's IMU CSV writer. The NAL parser in
    `NalParser.kt` is reusable for an optional encoder-output sanity
    check. The ultrawide-camera enumeration in `DeviceCaps.kt` is the
    source for Phase 3's lens id.
- **`apps/mobile/src/native/HumynCompat.ts`** — JS-side native-module
  binding pattern. Phase 3's `apps/mobile/src/native/HumynCapture.ts`
  follows the same `NativeModules.HumynCapture` shape.
- **`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt`**
  — `onCreate` already runs Phase 2's `compat-probe-*.mp4` orphan
  sweep. Phase 3 adds `recordings/` + `practice/` sweep alongside
  in the same hook.
- **`shared/types/CompatResult.ts`** — Zod schema; the
  `measuredDeg` field on `ultrawideDfov` is the source for
  `dfovDegrees` JS passes to `start(opts)`.
- **`apps/mobile/src/state/appStore.ts`** — Zustand store with the
  `user` slice (Pattern 64 from Phase 2). Phase 3's JS layer reads
  `appStore.user` for the contributor block in `start(opts)`.
  **Caveat:** the `user` slice is non-MMKV-persisted by design;
  Wave 1 fixes the foreground-rehydrate hole that surfaces when
  Android process-kills the JS context.
- **`apps/mobile/src/services/installationId.ts`** — `installation_id.v1`
  is NOT consumed by Phase 3 (recording_id is server-minted ULID;
  installation_id stays in the diagnostic snapshot only).

### Established Patterns (from Phase 1 and Phase 2)

- **Native-module shape:** Kotlin module under
  `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/{name}/`
  with a registered `ReactPackage`. JS surface at
  `apps/mobile/src/native/{Name}.ts` exposes a typed contract via
  `NativeModules.{Name}`. Phase 3 ships `HumynCapture` per this
  pattern.
- **MMKV key versioning:** `auth.jwt.v1` / `compat.lastResult.v1`
  pattern. Phase 3's MMKV reads (Wave 2 reads
  `compat.lastResult.v1.checks.ultrawideDfov.measuredDeg`) follow
  the `.v1` suffix convention.
- **Flavor-scoped manifests:** per-flavor source sets at
  `android/app/src/{playStore,apkRollout}/AndroidManifest.xml`.
  Phase 3 does NOT add flavor-scoped permissions — capture
  permissions (Camera + Mic) are universal across flavors and
  declared in the main manifest.
- **`shared/types/`** Zod schemas — Phase 3 adds
  `shared/types/CaptureSessionOpts.ts` mirroring the `start(opts)`
  contract.
- **Test infra (Vitest + jsdom):** `apps/mobile/vitest.config.ts`
  - `vitest.setup.ts` already wired. Phase 3 unit tests against
    `NativeModules.HumynCapture` mocks; segmentation timer logic
    unit-tested via fake-timer + native-module-mock pattern. Real
    Camera2 + MediaCodec verification is deferred to Phase 4 smoke
    walk per D-WAVE-01 Wave 2+ acceptance.
- **Phase 2 manual smoke runbook** at
  `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-MANUAL-SMOKE.md`
  — Phase 3 appends a `03-MANUAL-SMOKE.md` covering Wave 1
  cosmetic verification + Wave 2 module-load + JS-bridge unit-
  test smoke. Phase 4 will own the 10-min real-device walk.

### Integration Points

- **Mobile → Native modules:** `AppFlavor`, `PlayIntegrity`,
  `HumynCompat`, `HumynUpdater` (existing Phase 1 + 2);
  `HumynCapture` (new in Phase 3); `HumynForegroundService`
  (new in Phase 3, extended by Phase 5).
- **Mobile → Filesystem:** Phase 3 writes to
  `context.filesDir/recordings/` and `context.filesDir/practice/`.
  Both segregated from `context.cacheDir/compat-probe-*.mp4`
  (Phase 2's transient probe artefact location) and
  `context.cacheDir/update-{epochMs}.apk` (Phase 2's APK download
  cache).
- **Mobile → Camera2:** ultrawide back-facing lens, exposure /
  white-balance auto, no preview surface during recording (Phase 4
  attaches preview separately for the recording surface).
- **Mobile → AudioRecord / MediaRecorder:** mic capture; gain
  control choice is planner-level (D-API-02 + Claude's
  Discretion).
- **Mobile → SensorManager:** gyro + accel at
  `SENSOR_DELAY_FASTEST` with `maxReportLatency` batching.
- **Mobile → PowerManager:** thermal status read at session start
  - listener subscribed throughout.
- **Mobile → Firebase Remote Config:** `capture.segment_minutes`
  read natively (Kotlin); default `10L`. Phase 2 already wired
  `@react-native-firebase/remote-config`.
- **Mobile → MMKV:** Phase 3's JS layer reads
  `compat.lastResult.v1` for `dfovDegrees` and the contributor
  block (via `appStore.user` which mirrors `/me`).
- **Mobile → CI:** Phase 3 unit tests run inside the existing
  "Mobile build" job (`apps/mobile/android/build.gradle`
  unchanged; new Kotlin module compiles into the same APK).

### Creative options the architecture enables

- **Module isolation pays off:** HumynCompat / HumynCapture /
  HumynUpload as independent native modules means Phase 3's
  encoder work doesn't touch Phase 2's compat probe, and Phase 5's
  upload pipeline doesn't touch Phase 3's capture pipeline. The
  shared `HumynForegroundService` is the only cross-phase
  integration point and it's an explicit seam (`setUploadActive`).
- **Sidecar-driven re-finalize** means a Phase 3 crash mid-segment
  is recoverable without losing user data (assuming the MP4 last-
  flush survived). This makes Phase 3's app-launch sweep a real
  data-rescue mechanism, not just a janitor.
- **Schema-version bump (`1.0.0` → `1.1.0`) on
  `imu_min_rate_hz_observed_p1` addition** lets Phase 5's server
  validate the schema strictly without breaking earlier
  Phase 3-pre-finalize artefacts (none exist).

</code_context>

<specifics>
## Specific Ideas

- **Per-segment `.session.json` sidecar layout** — JSON file with
  schema:
  ```json
  {
    "schema_version": "1.0.0",
    "session_id": "...",
    "segment_id": "01J...",
    "recording_id": "01J...",
    "filename_base": "20260505_003020_001",
    "started_at_ns": 12345678901234,
    "wallclock_start_iso": "2026-05-05T00:30:20.000+05:30",
    "is_practice": false,
    "task_info_partial": {
      "task_id": "...",
      "task_name": "...",
      "task_category": "...",
      "task_setting": "indoor"
    },
    "contributor_info": {
      "name": "...",
      "email": "...",
      "age": null,
      "gender": null,
      "consent": true
    },
    "start_gate": {
      /* per D-API-02 */
    },
    "capture_device_info_partial": {
      "type": "phone",
      "model": "Pixel 10a",
      "os": "android",
      "os_version": "...",
      "app_version": "1.0.0",
      "dfov_degrees": 115,
      "ip_address": null,
      "location": "Bangalore, India"
    }
  }
  ```
  Native fills the rest at finalize and writes the canonical
  `{filenameBase}.json`.
- **Per-day filename sequence (`_NNN`) recovery** — at first
  `start()` of an app session, count
  `recordings/YYYYMMDD_*.mp4` + `practice/YYYYMMDD_*.mp4` for
  today's date and pick `max(NNN) + 1`. Avoids MMKV staleness
  across uninstalls.
- **`HumynForegroundService` notification UX** — Android requires a
  notification while a foreground service runs. Use a low-priority
  `NotificationChannel` ("Recording" / "Upload") with the brand
  icon + "Recording in progress" / "Uploading recording". Channel
  is created in `MainApplication.onCreate` (Phase 2 / Phase 3
  shared concern). No user dismissibility while service is running
  (system policy).
- **Schema version bump rationale** — `imu_min_rate_hz_observed_p1`
  is a NEW field, not a rename. Backward-compatible additions
  bump the minor (`1.0.0` → `1.1.0`); breaking changes would bump
  the major. Backend (Phase 5) parses the schema and accepts both
  for the transition window (none exists in practice, since
  Phase 3 is the first emitter).
- **Drift computation memory bound** — at 30 FPS × 10 min = 18,000
  video frames; IMU at 416 Hz × 10 min = 249,600 samples. Per-
  frame drift array is 18k × 8 bytes (double) = ~144 KB. Sort of
  `|d[i]|` for max/mean/p99 is trivial. No streaming required.
- **No B-frame verification** — `EncoderProbe` already proves the
  device can encode without B-frames at compat time. Phase 3 sets
  `KEY_LATENCY=1` + `KEY_MAX_B_FRAMES=0` and trusts the encoder.
  Optional: parse the first GOP via `NalParser` at session start
  as a sanity check (planner's call; ROI low if compat passed).
- **OIS + HDR readback** — set `CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE = OFF`
  - `DYNAMIC_RANGE_PROFILE = STANDARD` on every capture request.
    Trust the readback path; compat already verified the device honors
    the override.
- **Wave 1 visual-snapshot tests location** — locked at
  `apps/mobile/__tests__/visual/` per `02-COSMETIC-GAPS.md` §"How
  Phase 3 Wave 1 should pick this up" §4 + D-WAVE-06. Framework
  locked at `jest-image-snapshot` driven through Vitest;
  baselines committed in
  `apps/mobile/__tests__/visual/__image_snapshots__/`.

</specifics>

<deferred>
## Deferred Ideas

### Belongs in other phases or future cleanup

- **PROJECT.md / REQUIREMENTS.md / ROADMAP.md / `idea-brief.md` §3.1
  cleanup of stale clan-chief / KGeN narrative** — already deferred
  in Phase 1 + Phase 2 CONTEXT; remains deferred. Out-of-scope for
  any single phase; needs a `/gsd:cleanup` pass or a manual edit
  pass with user approval.
- **Hand-detection gate (HAND-01..14)** — Phase 4. Phase 3 takes
  the gate result as input via `start(opts).startGate`.
- **Recording surface UX state machine (REC-01..16)** — Phase 4.
  Phase 3 ships only the bytes-on-disk module.
- **§10 lifecycle edges** (rotation / call / alarm / battery /
  storage-full / DND / phone-call-declined-continues) — Phase 4
  state machine. Phase 3's module-level guarantees (thermal-only)
  do NOT cover these.
- **Practice-recording UX flow (ONB-03..07)** — Phase 4. Phase 3
  segregates practice files by directory; Phase 4 owns the
  Practice-complete screen + confetti + haptic.
- **Upload pipeline (UP-01..19)** — Phase 5. Phase 3 emits the
  artefact triple + the FGS seam; Phase 5 wires uploads.
- **Hash-verify worker + IMU-liveness backend check** — Phase 5.
- **iOS analogue (`HumynCapture` Swift)** — Phase 7.
- **TTS voice line wiring for thermal abort** — Phase 4. Phase 3
  emits `onThermalAbort`; Phase 4 fires the voice cue.
- **Battery alert + low-battery refuse + ≤5% segment-end** —
  Phase 4. Phase 3's module does not check battery.
- **Storage-full mid-record graceful end** — Phase 4 gates this at
  session start (reads free-space). Phase 3 may surface a writer-
  side `IOException` and emit `onError({code: 'storage_full'})`,
  but the prevention path is Phase 4.
- **Tasks browsing / Home tiles / History list / Player** — Phase 6.
  Phase 3 metadata JSON is the input to Phase 6's History row.
- **Observability / iOS parity / staged rollout** — Phase 7.
- **Wave 1 plan layout** — one bundled plan vs split, snapshot-test
  framework choice, navigator-changing-items grouping. Deferred
  to plan-phase against the frozen `02-COSMETIC-GAPS.md`.
- **Compat-tightening propagation** (existing devices that newly
  fail when bar is raised — COMPAT-05) — already deferred from
  Phase 2; remains deferred to Phase 4 alongside Remote Config
  wiring.
- **D-FLAG-04: `RecordingsInitRequestSchema.imuVideoDriftMaxMs .int()`
  vs decimal-on-disk drift conflict** — Phase 5 follow-up. Phase 3's
  metadata JSON on disk stays decimal per the canonical
  `video_metadata.json` schema (idea-brief.md §6.5 example values
  `0.7`, `0.18`, `0.5`). The wire-shape mismatch with
  `shared-types/recording.ts` line 30–32 (`z.number().int()`) is
  recorded here for Phase 5's planner to reconcile when the upload
  pipeline wires the multipart init request — either drop the
  `.int()` constraint OR multiply by 1000 to nanoseconds-as-int on
  the wire. Phase 3 does NOT alter the on-disk schema.

## Edge Cases

- **`filename_seq_exhausted`** — `FilenameGenerator.nextBase` throws
  `IllegalStateException("filename_seq_exhausted_for_day_${date}")`
  when a single calendar day exceeds 999 segments per second-bucket
  (CAP-17 mandates a 3-digit per-day sequence). At the 10-min
  default segment, 999/day is unreachable; this is a defensive cap,
  not a runtime concern. The `start()` Promise rejects with
  `internal_error` (mapped via `errorCodeFor` in HumynCaptureModule);
  Phase 4's RecordingScreen surfaces a "filename sequence exhausted —
  please contact support" toast.

### Reviewed Todos (not folded)

None — no `gsd-tools list-todos` available; no todos enumerated.

</deferred>

---

_Phase: 3-HumynCapture Native Module (Bytes-on-disk)_
_Context gathered: 2026-05-10_
_Updated: 2026-05-10 (post-Phase-2-soak — D-WAVE-04..09 added)_
