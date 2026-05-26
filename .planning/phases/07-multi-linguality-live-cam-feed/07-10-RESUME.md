---
status: in-progress
phase: 07-multi-linguality-live-cam-feed
plan: 07-10-live-preview-surface-debug-and-fix
session_paused: 2026-05-26
---

# 07-10 Resume Handoff

Plan 07-10 has 8 commits landed on `main`. SUMMARY.md is **NOT** written yet
because the operator §9 A/B drift gate (Task 3) was reshaped mid-session by
the JS keep-mounted refactor. This file is the bridge from the paused
session to the resumed one.

## Commit log (in order)

| Commit    | What                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `79bf7c7` | Task 1 — instrument Surface lifecycle (`Log.i` tags + debug journal)                                                                     |
| `34597a2` | Task 2 (first attempt) — always-two-Surface CaptureSession + dynamic preview reissue                                                     |
| `cdcada9` | Task 2 — defer onAddTarget/onRemoveTarget to sessionHandler (still failed)                                                               |
| `eb70d33` | Task 2 — 200ms postDelayed (still failed; structural, not timing)                                                                        |
| `82d2ff7` | **Task 2 — JS-side keep-mounted (THE FIX)** — toggle opacity instead of mount/unmount; SurfaceTexture lives once per recording           |
| `c35ac8f` | Polish — Pressable also during 'tap-revealed' (timer roll); bottom-right indicator + brand orange + new "Tap screen to preview" i18n key |
| `45b5f52` | Polish — move indicators from bottom-right to bottom-center                                                                              |
| `b041d51` | Polish — nudge bottom-center up 5 px                                                                                                     |

## Root cause + fix (canonical)

`HumynLivePreviewView` was being unmounted on every fade-to-dim and
remounted on every tap-reveal. Each remount produced a fresh
SurfaceTexture-backed Surface; Camera2's `updateOutputConfiguration` on
the new Surface failed with `IllegalArgumentException: Surface was
abandoned` because the new SurfaceTexture's BufferQueue producer hadn't
connected yet (post-delay 0 ms / 4 ms / 200 ms all hit the same exception
— structural, not timing).

`82d2ff7` keeps the view mounted throughout the 'active' substate and
toggles visibility via `opacity: 0 | 1`. The SurfaceTexture is created
once per recording; `finalizeOutputConfigurations` attaches it once and
no subsequent `updateOutputConfiguration` swap is needed on the common
path. The native onAddTarget/onRemoveTarget swap code stays as defence
in case some future event triggers a remount mid-recording.

Side-effect: the preview Surface is now a Camera2 target for the entire
'active' substate, not just visible windows. This makes the §9 A/B drift
gate a strictly-more-conservative test (continuous two-Surface session
vs encoder-only baseline) than the original intermittent-target plan.

## Drift telemetry (Pixel 10a `5C161JEA304304`, preview ON, walked 3 times)

| Recording                    | Duration | drift max | drift mean | **p99**     | fps   | res       |
| ---------------------------- | -------- | --------- | ---------- | ----------- | ----- | --------- |
| `01KSHCY4XMRWT5H53A5QMRJW70` | 278 s    | 1.86      | 1.61       | **1.65 ms** | 29.86 | 1920×1080 |
| `01KSHDG57RHEJ5044BA7T4T24R` | 600 s    | 3.20      | 2.82       | **2.88 ms** | 29.86 | 1920×1080 |
| `01KSHE2G9DEP3J01QZSTV0N8TF` | 150 s    | 4.52      | 4.27       | **4.32 ms** | 29.86 | 1920×1080 |

All three within the relaxed envelope (CLAUDE.md cites 1.7–6.2 ms p99 as
typical post-ultrawide). fps stayed at 29.86 across all three (above the
29 cancel-gate). Resolution locked at 1920×1080. dFOV = 115.4°.

## What's left to close 07-10

1. **Operator decision on the §9 A/B reshape.** The classical A/B requires
   a `preview-OFF` baseline. The JS keep-mounted refactor means preview is
   always attached during 'active' — to get a clean baseline you'd need
   to add a debug flag (e.g. `__DEV_DISABLE_LIVE_PREVIEW__`) that skips
   the JSX mount. Or accept the de-facto evidence: 3 walks with preview
   ON × different durations all within the relaxed envelope.

2. **Write 07-10 SUMMARY.md** — covers commits 79bf7c7..b041d51, the H1
   diagnosis, the JS-side keep-mounted fix, the polish round, and the
   §9 drift evidence above.

3. **Update `.planning/debug/07-live-preview-broken-pipe.md`** with the
   final § Conclusion / § Fix applied / § §9 A/B drift outcome / § Files
   changed sections and move the file to `.planning/debug/resolved/`.

4. **Update `07-MANUAL-SMOKE.md`** §7 + §8 + §9 with PASS evidence.

5. **Update plan progress** (`gsd-sdk roadmap.update-plan-progress 07
07-10 complete`) + STATE.md.

## Known unrelated finding (don't action in 07-10)

The server's `imu_video_drift_*` DB columns are NULL even though the
metadata.json carries the values. The fields are FLOAT in metadata but
INTEGER in `recordings` schema — the Drizzle insert silently drops them.
Source of truth is the S3 metadata.json. This is a separate ingest gap;
file it as a §v2 server-side todo, not a 07-10 blocker.

## Hardware setup needed at resume

- Device: Pixel 10a `5C161JEA304304` (already paired)
- Dev API + worker on 8080 (run `cd apps/api && set -a && source .env && set +a && pnpm dev`)
- Metro on 8081 (run `cd apps/mobile && npx react-native start`)
- `adb reverse tcp:8080 tcp:8080 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4566 tcp:4566`
- Latest APK on the device is commit `b041d51`

## Resume command

```
/gsd:execute-phase 7
```

The workflow will:

1. Discover plans, see 07-10 has no SUMMARY.md → resumes 07-10
2. Spawn a continuation executor that reads this file + the debug journal
   - the commit log, decides the §9 A/B path (write SUMMARY accepting
     de-facto evidence vs add a debug flag for a clean baseline), and
     completes the plan.
3. Continue into 07-11 (i18n sweep extension), 07-13 (Help Center body
   translation), 07-12 (task catalog body), 07-14 (cosmetic), 07-15
   (operator hardware re-walk + VERIFICATION refresh).
