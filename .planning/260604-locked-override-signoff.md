# Owner sign-off — LOCKED-spec overrides (2026-06-04)

Authorizes the three LOCKED-constraint overrides in `IMPLEMENTATION-PLAN-260604.md`
§1 (D1, D2, D3) and confirms one under-specified default (D6). Recorded per the
plan §11 requirement that LOCKED overrides get a written owner sign-off in
`.planning/` before their phases start.

**Decision captured:** 2026-06-04, owner (m.adnaan161@gmail.com), via execution checkpoint.
**Status:** APPROVED — all four below.

---

## D1 — Remove ALL upload hashing ✅ APPROVED (Phase 1 / Enh 3)

- Remove the server hash-verify worker **and** the device-side SHA-256 of video+IMU.
- `metadata.json` drops `file_sha256` / `imu_sha256`; `/recordings/init` stops accepting them.
- `uploaded` becomes the terminal success state (state machine collapses).
- ⚠ **KEEP `AppFlavorModule.sha256First16Hex`** — that is the compat-signature device
  fingerprint (`compatSignature.ts`), unrelated to upload verification.
- Redis/SQS/verify-queue infra reaped in a fast follow (code first).

## D2 — Single-device, newest-login-wins ✅ APPROVED (Phase 4 / Bug 4)

- **Overrides LOCKED `D-AUTH-03`** (stateless 30-day JWT, no denylist).
- Account binds to the most-recent device; prior device force-logged-out (401) on its
  next request. One LRU-cached `sub → current_installation_id` lookup per request.
- Reinstall on the same phone = a new device (installation id rotates) → evicts the
  prior session. Accepted as expected behaviour.
- Evicted device shows a friendly "used on another device" message on Signup.

## D3 — Precise GPS location ✅ APPROVED (with consent/DPIA gate) (Phase 3 / Bug 3)

- **Overrides the LOCKED "no precise GPS leaves the device" constraint.**
- Capture precise lat/lng + `accuracy_m` / `provider`; `ACCESS_FINE_LOCATION` in the
  manifest; remove the CI gate (`verify-merged-manifests.sh`) that currently fails the
  build if FINE is present.
- Location gated in onboarding `PermissionsScreen` alongside Camera+Mic (D4 —
  block-until-granted; partial COARSE grant still records, only a full denial blocks).
- **Consent-text + DPIA update is a ship gate.** Engineering will draft the
  consent-text (`idea-brief.md §5.2`) + doc edits for owner/legal review BEFORE the
  precise-location capture ships. Code may land behind that review.

## D6 — 3-minute minimum, trailing-segment handling ✅ Drop trailing <3-min segment (Phase 3 / Bug 8+Enh 1)

- Per-segment 3-min floor. A ≥3-min recording that auto-segments at the 10-min cap and
  leaves a trailing segment <3 min will **drop that trailing segment** (mirrors "drop
  segments < 3 min", consistent with the existing per-segment cancel-gate model).
- Minor tail-data loss accepted.

---

## Spec/doc updates these overrides require (tracked per phase, plan §8)

- **D1:** `UPLOAD-PIPELINE.md`, `DATA-MODEL.md` (drop sha fields), `CLAUDE.md`
  ("byte-for-byte"/fidelity note), `.planning/REQUIREMENTS.md` VERIFY-\*, `ROADMAP.md` Phase 5.
- **D2:** decision record overriding `D-AUTH-03`; `CLAUDE.md` Auth constraint;
  `deferred-decisions.md`.
- **D3:** `idea-brief.md §2.1` + `§5.2` (consent), `DATA-MODEL.md`, `CLAUDE.md`
  coarse-only line + new banner, `.planning/REQUIREMENTS.md` PERM-03, AndroidManifest
  comments, `verify-merged-manifests.sh`. **Legal/DPIA review before ship.**
- **D6:** `StopConfirmModal.tsx` "(LOCKED)" copy, `design-spec.md` /
  `engineering-handoff.md §6.3`, `.planning/REQUIREMENTS.md`, `CLAUDE.md` capture banner.
