# Phase 2 — Open Questions

**Status:** Tracked but NOT blocking Phase 2 completion. Resolve before Phase 7 staged Play Store rollout (or earlier if Product / Ops / Writing returns final wording first).

**Source:** `.planning/STATE.md` § Blockers/Concerns → "Phase 2: Final Help Center support email (`[EMAIL_ADDRESS]` placeholder); compat-fail 'what now' recovery copy needs final wording".

**Convention:** Each Open Question has a unique `OQ-N` ID, an enumerated list of placeholder occurrences (file + line for fast search-and-replace), a resolution path, an explicit "why deferred" justification, and an owner + target.

---

## OQ-1: Help Center / Contact Support — final email address

**Status (2026-05-10):** **RESOLVED** — email is `support@humynlabs.ai`. Code substitution is queued in the Phase 3 Wave 1 cosmetic-cleanup commit (see `02-COSMETIC-GAPS.md` § Rig Tutorial screen). NOT applied out-of-band during the Phase 2 smoke walk per `feedback_functionality_first_during_smoke.md`.

**Description:** The `[EMAIL_ADDRESS]` placeholder is the user-visible support email. It surfaces at every Contact Support exit in the Phase 2 surface — three on-device touchpoints derived from one source-of-truth file. All five occurrences must flip to the real address atomically (one commit) so we never ship a build where some surfaces have the real email and some don't.

| File                                                      | Where                                                                                                                                                   | Phase                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `help-center-content.md`                                  | "Tap **Contact Support** below to email us at `[EMAIL_ADDRESS]`." (Troubleshooting → Contact Support, line 187)                                         | source                          |
| `apps/mobile/src/screens/help/content.json`               | Baked from the markdown above by `apps/mobile/scripts/build-help-content.mjs` (line 214 of the JSON; regenerated automatically on `npm run build:help`) | derived                         |
| `apps/mobile/src/screens/help/HelpCenterScreen.tsx`       | `const SUPPORT_EMAIL_PLACEHOLDER = '[EMAIL_ADDRESS]'` powering the `mailto:` URL on the Contact Support button (line 42)                                | runtime — Help Center           |
| `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` | `const SUPPORT_EMAIL_PLACEHOLDER = '[EMAIL_ADDRESS]'` powering the `mailto:` URL on the Contact Support fallback (COMPAT-08, line 23)                   | runtime — Compat fail recovery  |
| `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`  | `const SUPPORT_EMAIL = '[EMAIL_ADDRESS]'` powering the "Don't have a rig yet" off-ramp's mailto (T-2.11-01 — ONB-02 link, line 39)                      | runtime — Rig tutorial off-ramp |

**Resolution path:**

1. Product / Ops decides the support email (likely `support@humynlabs.ai` or similar).
2. Edit `help-center-content.md` — replace `[EMAIL_ADDRESS]` with the real address.
3. Run `cd apps/mobile && npm run build:help` to re-emit `apps/mobile/src/screens/help/content.json` (the `prebuild` hook ensures the JSON is in sync; do NOT hand-edit the JSON).
4. Search-and-replace `[EMAIL_ADDRESS]` in:
   - `apps/mobile/src/screens/help/HelpCenterScreen.tsx`
   - `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx`
   - `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`
5. Run `cd apps/mobile && npm run test --run` (the screen tests assert the placeholder string is gone — re-spec to assert the real address).
6. Commit: `docs(02): replace [EMAIL_ADDRESS] placeholder with <real-email>`.

**Why deferred:** The decision is operational (who owns the inbox, what auto-responder lives there, GDPR / DPDP / LGPD-style record-keeping); it does NOT block Phase 2 functional completeness. The placeholder is visible in the smoke runbook (`apps/mobile/02-MANUAL-SMOKE.md` § 5 / 6 / 9) so the operator confirms the placeholder rendering doesn't break the flow.

**Owner:** Product / Ops.
**Target:** Before first apkRollout distribution beyond internal smoke devices (and definitely before Phase 7 Play Store launch).

---

## OQ-2: Compat-fail "what now" recovery page — final wording

**Status (2026-05-10):** **SUPERSEDED** by Phase 3 Wave 1 scope change — `CompatRecoveryScreen` will be merged into `CompatFailScreen` (single screen, no second navigation hop). See `02-COSMETIC-GAPS.md` § Compat-fail screen. The writer pass now happens against the merged screen, not the standalone recovery screen. The original wording-quality concern still stands — re-target it at the merged screen during the cleanup. The text below stays as a record of the pre-merge state.

**Description:** `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` ships first-pass recovery copy that's technically accurate but has not had a writer pass. The prototype.html `#compat-fail` recovery state is currently a TBD per design-spec §4 ("Edge states (production)"). Final wording is owed before the screen is seen by paying users.

**Current copy (first-pass, technically correct):**

> "This phone doesn't meet the recording requirements. Try a different qualifying device, or reach out to support — share your phone model and roughly when this happened."
>
> Bullets:
>
> - Try a different phone with a 1080p ultrawide rear camera (≥110° dFOV) and a gyroscope + accelerometer.
> - Make sure the device is not rooted and was installed from a trusted source.
> - If you've changed phones recently, the check will re-run automatically the next time you sign in.

**Resolution path:**

1. PM / Writer reviews the prototype.html `#compat-fail` recovery state alongside the failure-mode taxonomy in `02-RESEARCH.md` (the same row that lists which compat probes most commonly fail on Helio-class devices).
2. Settles on final copy that (a) explains in plain English why the phone failed, (b) preserves the existing 3-bullet structure (or replaces it, if the writer prefers), (c) keeps the Contact Support button + mailto.
3. Edits `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` and the corresponding test fixtures in `apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx`.
4. Re-runs `cd apps/mobile && npm run test --run` — green.
5. Commits: `docs(compat): final wording for compat-fail what-now recovery page`.

**Why deferred:** The current copy is technically accurate and non-confusing. Wordsmithing is a writer pass, not engineering work; we don't gate Phase 2 on it. The smoke runbook (`apps/mobile/02-MANUAL-SMOKE.md` § 5) confirms the screen renders + the mailto fires; the wording is reviewed downstream.

**Owner:** Product / Writing.
**Target:** Before staged Play Store rollout (Phase 7).

---

## OQ-3: APK SHA-256 fingerprint disclosure UX (Phase 1 Open Question carried forward)

**Description:** Phase 1 STATE.md § Blockers carried this question: "Playstore/apkRollout APK SHA-256 fingerprint disclosure UX." Two candidate placements are obvious — the Profile footer (PROF-05 already shows `versionName-flavor (versionCode)`; could append a SHA prefix) or a dedicated Help Center FAQ entry. Phase 2 did NOT add it — no Phase 2 requirement covers it, and the Phase 2 CONTEXT § Deferred Ideas explicitly tags this as "planner-pick" for a later phase.

**Why deferred:** Not in any Phase 2 requirement (`02-CONTEXT.md` § Deferred); no security regression — the SHA is already in the APK metadata + Play Console + signed cert; users don't need to verify it manually for security. Disclosure is a transparency-narrative consideration, not a correctness one.

**Resolution path** (if revived in Phase 7):

1. Decide placement (Profile footer prefix vs. Help Center FAQ entry).
2. Source the SHA at build time from `apps/mobile/android/app/build/outputs/apk/<flavor>/release/app-<flavor>-release.apk` via `sha256sum` and bake it into a constant via Gradle's `BuildConfig` injection.
3. Render in the chosen surface; add a copy-on-long-press gesture if going the footer route.

**Owner:** Product / Security.
**Target:** Phase 7 if the transparency narrative needs it; otherwise dropped permanently.

---

_Reviewed at Phase 2 verify-work; carry forward to Phase 7 entry checklist. Update this file (mark `RESOLVED` + commit hash + date) when each item is closed._
