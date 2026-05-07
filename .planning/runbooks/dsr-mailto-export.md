# DSR Access / Portability — Mailto-Ops Runbook (D-LEGAL-02)

**Status:** Phase 1. The DSR access/portability surface at MVP is **mailto + ops manual ZIP build**. There is NO `/me/export` HTTP endpoint (neither GET nor POST) — D-LEGAL-02 is method-agnostic.

**Reference:** `.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md` D-LEGAL-02; `idea-brief.md` §14 (privacy/consent).

## When this runbook fires

A user emails `dsr@humyn-labs.io` (placeholder address — TODO ops to confirm canonical address; must match the address printed in the in-app help center copy from `help-center-content.md`) and requests:

- A copy of their data (DPDP § 13 access right; LGPD article 18-II), OR
- A portable export of their data (LGPD article 18-V, "right to data portability")

Erasure is a separate flow: `DELETE /me` + `POST /me/restore` shipped in plan 01-08. Correction is `PATCH /me` (plan 01-08). Both are HTTP routes and DO NOT use this runbook.

ANPD/DPB regulator-mandated takedowns are a separate flow: see `.planning/runbooks/legal-takedown.md`.

## Step 1 — Verify identity (mandatory)

1. The user must email from the same Google account email registered on `users.email`.
2. Look up the user:
   ```sql
   SELECT id, email, name, deleted_at, delete_grace_until
   FROM users
   WHERE email = '<sender-email>';
   ```
3. **If multiple users share an email** (shouldn't happen at MVP — Google `sub` is the unique key, email is just denormalized — but defend in depth): require the user to confirm the Google `sub` via the email reply thread. Do not run the CLI until the `sub` matches.
4. **If no row matches**: reply asking the user to email from the account they used to sign in. Do not divulge whether the email exists in the system (information-disclosure guard, T-1.11-02).
5. **If the row matches but `deleted_at IS NOT NULL` and `delete_grace_until > now()`**: the user has soft-deleted. Ask whether they want a pre-erasure export (yes → proceed; no → confirm erasure-only).
6. **If the row matches but `delete_grace_until <= now()` and the row still exists**: the DSR cron stub from plan 01-08 hasn't hard-deleted yet. You MAY still build the export — log this in `dsr_log.notes` so counsel can see the pre-hard-delete fulfillment.

## Step 2 — Run the export CLI

From the `apps/api/` working tree:

```sh
OPS_ENGINEER="<your-name>" pnpm dsr:build-export <user_id>
```

The script (`apps/api/scripts/dsr-export.ts`):

- Pulls `users`, `profiles`, `recordings`, `contributions`, `events`, `consent_log` rows for that user.
- Writes `apps/api/dsr-exports/<user_id>/<export_id>.json` to local disk.
- Inserts a `dsr_log` row with `request_type='access'`, `fulfilled_at=now()`, `ops_engineer=<your-name>`.

`dsr-exports/` is `.gitignore`'d — never commit user export bundles to the repo.

## Step 3 — Zip + upload to the ops bucket

```sh
cd apps/api/dsr-exports/<user_id>
zip <export_id>.zip <export_id>.json

aws s3 cp <export_id>.zip s3://humyn-ops-dsr-prod/<user_id>/<export_id>.zip --sse AES256
```

The `humyn-ops-dsr-prod` bucket is provisioned by plan 10's Terraform (`infra/terraform/`). It is access-blocked + AES256-encrypted + NOT exposed via CloudFront.

(At MVP we provision the bucket separately from `humyn-recordings-prod` to keep blast-radius tight; counsel-side audit reads happen against `humyn-ops-dsr-prod` only.)

## Step 4 — Mint a 24-hour presigned GET URL

```sh
aws s3 presign s3://humyn-ops-dsr-prod/<user_id>/<export_id>.zip --expires-in 86400
```

The 24-h TTL is the operational tradeoff: long enough for users on flaky cellular connections to fetch; short enough that a leaked URL (T-1.11-03) is self-expiring.

## Step 5 — Reply to the user

Reply to the user's mail thread:

- Include the presigned URL.
- Note the 24-hour TTL and that the link cannot be re-issued automatically (they email back if expired).
- Note that recordings already used for AI training cannot be retroactively unlearned (consent text covers this — `apps/api/src/legal/consent-text.ts`).

## Step 6 — Audit

After replying:

- Confirm the `dsr_log` row exists:
  ```sql
  SELECT * FROM dsr_log WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;
  ```
- Update its `notes` column with the user's email subject line and reply timestamp.

## Quarterly review

This runbook is treated as code. Quarterly review checklist:

- Have the schema or column names changed? (`users`, `profiles`, `recordings`, `contributions`, `events`, `consent_log`)
- Has the canonical DSR mailto address changed? (sync with `help-center-content.md` + the in-app Help Center deep-link)
- Is the ops bucket name still `humyn-ops-dsr-prod`?
- Has the consent text + DSR rights wording in `apps/api/src/legal/consent-text.ts` been updated since the last review? If yes, counsel re-confirms our DSR fulfillment matches what users were shown.

If any answer is "yes" or "unsure", counsel review is triggered before applying the runbook to a new request.

## Identity-verification failure modes

- **User uses a different email:** ask them to email from their registered Google account. Do not extract data without an email match.
- **User claims their email is wrong on file:** counsel-escalate. The CLI does not run until counsel signs off on the alternative ID-verification path (passport, ID card, etc.).
- **Bulk request from a regulator:** do NOT run this runbook. Use `.planning/runbooks/legal-takedown.md` instead.
- **Request comes from someone other than the registered user (e.g., a power of attorney):** counsel-escalate; do not run the CLI.

## References

- DPDP Act (India) — section 13 (data subject access, correction, and erasure rights).
- LGPD (Brazil) — article 18 (data subject rights), specifically 18-II (access) + 18-V (portability).
- D-LEGAL-02 (CONTEXT.md) — DSR access/portability handled via Help Center mailto + ops manual ZIP build, method-agnostic — NO HTTP endpoint shipped at MVP.
- D-LEGAL-03 (CONTEXT.md) — `consent_log` is the audit trail covering exported rows.
- `apps/api/src/db/schema.ts` — `dsr_log` table + table shapes the CLI dumps.
- `apps/api/scripts/dsr-export.ts` — the CLI invoked by ops.
