# Bug 3 — Precise location: consent-text + DPIA SHIP GATE (2026-06-04)

> **Status:** Capture CODE has landed (behind this review). Precise GPS is
> **NOT cleared to SHIP** until the consent-text update + DPIA review below are
> approved by the owner/legal and applied **with a backend consent-version bump**.
> Per owner sign-off `.planning/260604-locked-override-signoff.md` **D3**:
> _"Engineering will draft the consent-text + doc edits for owner/legal review
> BEFORE the precise-location capture ships. Code may land behind that review."_

This doc is the engineering DRAFT of the consent-text change + the DPIA review
checklist. It deliberately does **not** mutate the in-app consent strings,
because `TermsOfUseModal.tsx` carries a hard guardrail — _"DO NOT EDIT without
updating idea-brief.md first AND bumping the consent version on the backend
(LEGAL-02)"_ — and a consent-text change forces re-consent. That coordinated
change is the SHIP GATE; it is owner/legal-driven, not a silent code edit.

---

## 1. What landed (code — behind the gate)

Bug 3 / D3 + D4 capture pipeline, all suites green:

- **Metadata schema 1.4.0 → 1.5.0** — `capture_device_info.location` changed
  from a coarse string label to the precise object
  `{ lat, lng, accuracy_m, provider, captured_at, label }` (or `null`).
  Kotlin `LocationFix` / `LocationJson`; bridge, sidecar, MetadataComposer.
- **`HumynLocation` native module** — FusedLocationProviderClient
  `getCurrentLocation(PRIORITY_HIGH_ACCURACY)` + best-effort reverse-geocoded
  label; `play-services-location:21.3.0`. Resolves null when unavailable (never
  blocks capture). Wired in RecordingScreen (resolved at mount, non-practice).
- **Permission gate (D4)** — `ACCESS_FINE_LOCATION` added to the onboarding
  `PermissionsScreen` alongside Camera + Mic (block-until-granted). A partial
  "Approximate" (COARSE) grant still records (D3); only a full denial blocks.
  `users`-side perms state + `computeInitialRoute` gate updated.
- **Manifest + CI** — `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` declared;
  the `verify-merged-manifests.sh` FINE ban lifted; manifest tests inverted.
- **Backend** — `recordings.location jsonb` column (migration 0013) + zod
  `LocationSchema` on `/recordings/init` + persisted sibling to `ip_address`.
- Dead coarse-only `services/locationPermission.ts` (+ its test) removed.

These are inert from a privacy standpoint **until the APK actually ships** with
the updated consent — which is gated below.

---

## 2. Consent-text change (DRAFT — owner/legal to approve)

**Current (LOCKED, coarse-only):**

> "… I consent to my **approximate location** and IP address being captured
> alongside each recording. …"

**Proposed (precise):**

> "… I consent to my **precise location (GPS coordinates)** and IP address being
> captured alongside each recording. …"

(Final wording is legal's call — this is the engineering draft. Keep it within
the existing single-paragraph consent block; do not restructure the modal.)

### Apply-together checklist (a single coordinated change — do NOT split):

- [ ] `apps/mobile/src/screens/signup/TermsOfUseModal.tsx` — `TERMS_OF_USE_TEXT`.
- [ ] `apps/mobile/__tests__/screens/TermsOfUseModal.test.tsx` — the
      `'approximate location and IP address'` assertion.
- [ ] `apps/mobile/src/i18n/locales/en.json` — `*.consent.body` (and the 7
      sibling locales if/when localization is un-deferred; English-only at MVP).
- [ ] `apps/mobile/src/screens/help/content.json:81` + `help-center-content.md:75`
      — the "We use coarse location only — never precise GPS" answer is now
      FALSE; rewrite to describe precise capture + why.
- [ ] `idea-brief.md §5.2` + `§2.1` — the canonical consent text + the
      coarse-only capture line.
- [ ] `design-spec.md` §18.1 — the verbatim consent block.
- [ ] `engineering-handoff.md` — the "approximate location only … no precise
      lat/lng leaves device" line.
- [ ] `README.md` — "coarse location only — no precise GPS leaves the device."
- [ ] **Backend consent-version bump (LEGAL-02)** — bump the consent version so
      every existing user must re-accept the precise-location terms. Without
      this, prior consents (to "approximate") do not cover precise capture.

### DPIA / legal review items:

- [ ] DPIA covering precise lat/lng leaving the device (purpose, retention,
      access, minimization). `accuracy_m` + `provider` are audit fields that
      record the precision actually delivered.
- [ ] Confirm precise GPS is lawful for the MVP geos (India + Brazil) under the
      stated training/research purpose.
- [ ] Re-consent flow for existing users on the version bump.
- [ ] Privacy Policy update (the consent references "Humyn's Privacy Policy").

---

## 3. Spec-doc / banner updates (engineering — tracked under plan §8)

Beyond the consent text, the precise-location override needs the non-legal spec
docs aligned (these are the D3 row of `IMPLEMENTATION-PLAN-260604.md` §8):

- [ ] `CLAUDE.md` — the "Coarse location only — no precise GPS leaves the device"
      constraint line + a new D3 banner (mirror the existing override banners).
- [ ] `.planning/REQUIREMENTS.md` — `PERM-03` (coarse → precise; gated in
      onboarding) + a metadata-schema 1.5.0 note.
- [ ] `DATA-MODEL.md` — the `location` field shape + the new
      `recordings.location jsonb` column.
- [ ] `idea-brief.md §2.1` / `.planning/PROJECT.md` — the coarse-only LOCKED line.

---

## 4. Bottom line

**Do not ship the precise-location APK until §2 (consent + version bump + DPIA)
is approved and applied.** The capture code is complete and green; it is
gated on this review per sign-off D3.
