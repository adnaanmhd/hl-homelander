# Phase 5 — Cosmetic / UX / Observability Gaps (surfaced during the 2026-05-13 on-device smoke walk)

> Same convention as `02-COSMETIC-GAPS.md` and `04-COSMETIC-GAPS.md`. Items here are NOT in-walk patches — they're noted for a dedicated cleanup pass once the §2 upload-smoke walk is signed off end-to-end. Do not rebuild mid-walk ([[feedback_functionality_first_during_smoke]]).

> Surfacing context: the 2026-05-13 on-device half of the runbook (`.planning/runbooks/05-upload-smoke.md` §2) was unblocked by debug session [`init-400-capturedat-offset`](../../debug/init-400-capturedat-offset.md) — the server-side schema relax that lets the device's `+05:30`-offset `capturedAt` reach the handler. While that fix was applied, the user flagged the items below.

## UX

- **Contribution toast killed by RecordingScreen → Home transition.** The success toast `"{Hh Mm} added to your contribution."` (REC-13) fires at the end of a non-practice recording but is killed when the screen transitions back to Home — i.e. it never makes it onto Home long enough for the user to read it. Should survive the transition for ≥ 5 s globally. **Likely root cause:** the toast is hosted by RecordingScreen's `<ToastHost />` (per-screen), not the navigator-sibling global toast surface. The pattern used by the crash-recovery toast (`bootRecoveryListener.ts` → global `<ToastHost />` sibling-of-navigator, see `04-COSMETIC-GAPS.md` "Crash-recovery Home toast" entry) is the right target: stash the result + trigger the toast from the post-navigation Home mount, OR emit it on the global toast surface so it lives independently of the screen tree. Pixel-spec the duration ≥ 5 s.

- **Home → "Pending Uploads" row tap routes to an orphan screen.** Tapping a row inside the Home tab's "Pending uploads" section opens a standalone `Pending uploads` screen that has no back nav and no bottom-tab affordance — the user is stranded. Expected: the tap should route to the **History** tab (which is the natural home for the upload/contribution timeline) rather than spawning a separate screen, and / or the standalone screen should at minimum carry a back affordance + the tab bar. Owner preference: route to the History tab.

## Observability (carry-over from this debug session)

- **`/tmp/humyn-api.log` doesn't capture live request log lines (and is spammed by EADDRINUSE noise).** During the debug walk, the dev API listener's stdout/stderr both point at `/tmp/humyn-api.log` (per `lsof`), but live request lines from the running listener never appear. Two interacting causes:

  1. **Pino worker-transport eats stdout in dev** — `apps/api/src/plugins/logger.ts` configures `{ transport: { target: 'pino-pretty', ... } }` for non-production. Pino transports run on a separate `worker_thread` whose stdout is a private fd, not the parent's fd 1, so request log lines never reach `/tmp/humyn-api.log` even when the launching `pnpm dev` was redirected there. Fix candidates (a) drop the worker-transport entirely in dev and write JSON to `process.stdout` directly (pipe through `pino-pretty` externally if pretty output is desired), or (b) point the transport at an explicit `destination: 1` / `pretty-path` so the worker writes back to the parent's stdout. Either is small; pick whichever matches the team's dev-loop preference.
  2. **Multiple `tsx watch` instances racing for :8080.** The walk found three concurrent `tsx watch src/index.ts` chains; two kept failing with `EADDRINUSE: 0.0.0.0:8080` and ALL of them write to the same redirected log file, drowning real signal with crash-loop noise. Mitigation: the two zombie chains were killed mid-debug (`kill -TERM` on the bash → pnpm → tsx triplets); on a fresh `pnpm dev` only one should exist. A guard rail — `apps/api/scripts/dev.sh` that `lsof -i :8080`-checks and bails before spawning — would prevent re-occurrence.

  Combined effect: without dev request logs the on-device debug loop kept needing a host-side `safeParse` script (`apps/api/scripts/repro-init-400.ts`) to confirm 400 reasons. Pin (1) above as a Phase-5 cleanup item; (2) is a process gotcha the dev-stack startup script can defuse.

## Disposition

- All three items are Phase-5-owned cleanup; none gate the §2 upload-smoke walk re-run after the `init-400-capturedat-offset` fix lands.
- Folded into a future Wave (alongside any other Phase-5 cosmetic gaps that surface during the §2/§3 walks) per the same pattern as `04-COSMETIC-GAPS.md` → Phase-5 Wave 1 ([[project_phase5_wave1_cosmetic_fixup]]).
