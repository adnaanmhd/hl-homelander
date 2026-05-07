# Counsel Engagement Checklist (Phase 1)

**Status:** Phase 1 ships THIS CHECKLIST as an artifact. The autonomous: false counsel-engagement step in plan 11 is where a real human ticks the boxes during attorney engagement.

**Reference:** D-LEGAL-01 (`.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md`) — counsel review is a parallel ops track, NOT a hard gate on distribution. APK + Play Store + iOS App Store distribution is unblocked even if this checklist is in progress.

## How to use this checklist

1. The repo lead engages a DPDP attorney (India) and an LGPD attorney (Brazil). Firm + lead-attorney + engagement-date go in the slots below.
2. Each attorney walks through the items applicable to their jurisdiction and provides written sign-off (email, signed PDF, or counter-signed PR).
3. The repo lead commits the updated checklist with the boxes ticked + signatures filled in.
4. If counsel returns redlines on `.planning/runbooks/legal-takedown.md` or `.planning/runbooks/dsr-mailto-export.md`, the repo lead pushes a follow-up commit updating the runbook + getting re-sign-off.

## India — Digital Personal Data Protection (DPDP) Act

- [ ] **DPDP attorney engaged.** Firm: \_\_\_\_\_\_\_\_\_\_ Lead attorney: \_\_\_\_\_\_\_\_\_\_ Engagement date: \_\_\_\_\_\_\_\_\_\_
- [ ] **Consent text reviewed.** Counsel signs off on `apps/api/src/legal/consent-text.ts` content + the version `CONSENT_VERSION` in code. The committed `CONSENT_TEXT_SHA256` is the byte-hash counsel approved (boot-guard refuses to start on drift — `apps/api/src/legal/boot-guard.ts`).
- [ ] **Retention policy reviewed.** Counsel signs off on the S3 lifecycle (Glacier IR @ +7d, Deep Archive @ +90d, no automatic deletion at MVP — recordings persist for the model lifecycle per consent).
- [ ] **Data Fiduciary registration.** If we cross the threshold for "Significant Data Fiduciary" (likely not at MVP), file the registration. Counsel decides.
- [ ] **Cross-border transfer notice.** Counsel confirms our data flow (Mumbai-hosted, served to India + Brazil) is compliant with DPDP cross-border rules.
- [ ] **Breach notification SOP.** Counsel signs off on our breach-notification procedure (target: within 72h of detection per DPDP).
- [ ] **Data subject rights.** Counsel confirms our `DELETE /me` + `POST /me/restore` + `PATCH /me` endpoints (plan 01-08) plus the mailto + `pnpm dsr:build-export` ops flow (plan 01-11 / D-LEGAL-02) satisfy DPDP Article 13 (access, correction, erasure).

## Brazil — Lei Geral de Proteção de Dados (LGPD)

- [ ] **LGPD attorney engaged.** Firm: \_\_\_\_\_\_\_\_\_\_ Lead attorney: \_\_\_\_\_\_\_\_\_\_ Engagement date: \_\_\_\_\_\_\_\_\_\_
- [ ] **Consent text reviewed (Portuguese localization).** At MVP we ship English-only (CLAUDE.md). Counsel confirms English-language consent is sufficient for our user demographic, OR we add a Portuguese localization. Decision recorded here:
  - Decision: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_\_\_\_\_\_\_
- [ ] **Cross-border transfer adequacy.** LGPD requires either an adequacy decision (Brazil → India is NOT in the adequacy list as of 2024) OR explicit consent. Our consent text covers this; counsel confirms wording is sufficient.
- [ ] **Data Protection Officer (DPO).** Counsel decides whether we must appoint a Brazilian DPO at MVP scale.
- [ ] **ANPD reporting.** Counsel signs off on our ANPD-incident-reporting SOP (target: 72h per LGPD article 48).
- [ ] **Right to portability.** Counsel confirms the mailto + `pnpm dsr:build-export` ops flow (per `.planning/runbooks/dsr-mailto-export.md`) satisfies LGPD Article 18-V.

## Cross-jurisdictional ops

- [ ] **Takedown response runbook reviewed.** Counsel walks through `.planning/runbooks/legal-takedown.md` end-to-end and signs off on Phases A through D.
- [ ] **DSR mailto-ops runbook reviewed.** Counsel walks through `.planning/runbooks/dsr-mailto-export.md` end-to-end and signs off on the identity-verification + CLI + presigned-URL flow.
- [ ] **Response-letter template signed off.** Counsel drafts `.planning/legal/templates/takedown-response-letter.md` (or equivalent in the team's doc system).
- [ ] **Legal-contact email configured.** `legal@humyn.ai` is monitored by counsel + an ops engineer.
- [ ] **Quarterly review cadence agreed.** Calendar invite set; first review date: \_\_\_\_\_\_\_\_\_\_.

## Sign-offs

| Item                       | Name | Signature | Date |
| -------------------------- | ---- | --------- | ---- |
| DPDP attorney engagement   |      |           |      |
| LGPD attorney engagement   |      |           |      |
| Consent text v1.0.0 review |      |           |      |
| Takedown SOP review        |      |           |      |
| DSR mailto-ops runbook     |      |           |      |
| Retention policy review    |      |           |      |
| Breach SOP review          |      |           |      |

**Note:** Phase 1 ships this CHECKLIST. The autonomous: false step in plan 11 is the engagement itself — when an actual human ticks the boxes after working through the items with counsel. Distribution (APK + Play Store + iOS) is NOT gated on completion (D-LEGAL-01).
