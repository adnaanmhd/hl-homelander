# Walk Report — 20260527-1524

**Started:** 2026-05-27 15:24 IST
**Ended:** 2026-05-27 16:00 IST
**Duration:** ~00:36 (bring-up only; no in-app walk performed)
**Test account:** m.adnaan161@gmail.com
**Device:** Pixel 10a (`5C161JEA304304`) · Android 16
**APK build:** `0.1.0-apk` · git HEAD `deeda5c` · installed 2026-05-27 15:32:57

## Pre-flight gates

| Gate               | Result                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| adb device         | `5C161JEA304304` · state=`device`                                       |
| Docker containers  | humyn-postgres / humyn-localstack / humyn-redis — all `Up · healthy`    |
| Postgres tasks     | 87 rows (≥ 86)                                                          |
| LocalStack buckets | humyn-recordings-dev / humyn-apk-dev / humyn-feedback-dev — all present |
| Metro :8081        | free                                                                    |
| API :8080          | one stale process (PID 58369) — killed before fresh start               |
| JDK                | temurin-17 located; JAVA_HOME exported before gradle                    |

## Wipe scope applied

- **Postgres** (per-table, schema-introspected; `compat_results` and `uploads` tables don't exist in current schema — skipped):
  - `consent_log` — **8 rows deleted**
  - `recordings` — **2 rows deleted**
  - `contributions` — 0 rows deleted
  - `users` — **1 row deleted** (`m.adnaan161@gmail.com`)
  - Post-wipe verify: users for test email = 0 · tasks total = 87 (preserved)
- **LocalStack S3** `s3://humyn-recordings-dev/recordings/` recursively deleted (5 keys: 1 user segment × 3 files + 2 sha256 stream-test files); post-wipe listing empty
- **Redis** FLUSHDB applied; DBSIZE=0
- **App data** `pm clear ai.humynlabs.capture.apk` + Crashlytics local crash log wipe

## Build

- Stage 1 — `./gradlew clean` → BUILD SUCCESSFUL in 7s
- Stage 2 — `./gradlew :app:assembleApkRolloutDebug :app:installApkRolloutDebug --no-build-cache` → BUILD SUCCESSFUL in 6m 45s (711 tasks)

## Tunnels

`adb reverse --list`:

- `tcp:8080 → tcp:8080` (Fastify API)
- `tcp:8081 → tcp:8081` (Metro — unused, kept for symmetry)
- `tcp:4566 → tcp:4566` (LocalStack S3)

## API + worker startup

```
[09:55:38.177] INFO: hash-verify worker started · concurrency=4
[09:55:38.976] INFO: Server listening at http://127.0.0.1:8080
```

Only WARN emitted during the bring-up window:

```
[10:30:14.809] WARN: CLOUDFRONT_RECORDINGS_* unset — falling back to S3 presigned GET (dev only).
```

(Expected dev-mode warning; not load-bearing.)

## Walk timeline

**No in-app events recorded.** Operator typed `walk done` immediately after bring-up. The launch screencap (`screencaps/00-launch.png`) captured a black frame because the device dozed off between `KEYCODE_WAKEUP` and the screencap, and ADB cannot bypass the PIN keyguard to drive the actual app surface.

`dumpsys window` did confirm the app was the top focused activity (`mFocusedApp=ai.humynlabs.capture.apk/.MainActivity`) — the install + launch sequence completed correctly, the phone just needed a manual unlock to make it visible.

## Recordings created

None.

## Incidents

None.

## Closing verdict

**PASS WITH NO WALK DATA — bring-up sanity check only.**

Every backend / build / wipe / tunnel gate landed green. The APK installed cleanly on top of a fully-wiped dev stack (Postgres + LocalStack + Redis + app data + Crashlytics local log), the API + hash-verify worker came up healthy, all three reverse tunnels are live. The app is the top activity on the device.

What this walk does **not** signal: anything about runtime behavior of the app — no sign-in, consent, compat-check, rig tutorial, recording, upload, or history surface was exercised. To validate user-facing flows, re-run the walk with the operator present at the phone to unlock + drive the UI.
