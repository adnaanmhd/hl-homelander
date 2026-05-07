# ANPD / DPB Takedown Response Runbook

**Status:** Phase 1 — counsel sign-off PENDING. This runbook is authored. The autonomous: false counsel-engagement step in plan 11 is where a real attorney walks through it and signs off (`.planning/legal/counsel-checklist.md`).

**Authorities covered:**

- **ANPD** (Autoridade Nacional de Proteção de Dados — Brazil, LGPD enforcement)
- **DPB** (Data Protection Board of India — DPDP Act enforcement)
- Court order or other legal process from either jurisdiction

**Reference:** D-LEGAL-04 (`.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md`); `idea-brief.md` §14 (privacy/consent).

## Phase A — Receipt and triage (target: ≤24 hours)

1. **Acknowledge receipt.** Reply to the regulator using the on-file legal-contact email (`legal@humyn.ai`) within 24 hours. Reply MUST include a tracking ID — use a fresh ULID — and a stated response window per the regulator's rules.
2. **Verify authority.** Confirm the request is from the legitimate authority. Cross-check:
   - LGPD requests: Brazilian government domain (`gov.br`) or counsel-validated court order
   - DPDP requests: Indian government domain or counsel-validated High Court / Supreme Court order
   - Other: counsel decides
3. **Counsel notification.** Forward the request to retained counsel (per `.planning/legal/counsel-checklist.md`) within 24 hours. Counsel reviews and provides a written recommendation: comply / negotiate scope / contest.
4. **Open ticket.** Record the request in the team's ticket system with:
   - Regulator name + jurisdiction
   - Request ID assigned by the regulator (if any)
   - Our internal tracking ULID
   - Plaintext summary of what's being demanded (which user, which recordings, etc.)

(Plaintext request data lives in the ticket system, NOT in this repo — T-1.11-06 mitigation.)

## Phase B — Identify affected data (target: ≤48 hours)

5. **Identify affected user(s).** From the request, derive the affected user(s) by:
   - Email (look up `users.email`)
   - Account ID (`users.id`)
   - Phone, IP, or other identifier per request scope
6. **Identify affected recordings.**
   ```sql
   SELECT id, user_id, captured_at, s3_key_video, s3_key_imu, s3_key_metadata
   FROM recordings
   WHERE user_id = '<affected_user_id>'
     -- OR by other criteria from the request, e.g., date range, location, etc.
   ;
   ```
7. **Compute affected_recording_ids array.** Record as a JSON array of the recording ULIDs for the audit row.

## Phase C — Execute takedown (target: ≤72 hours from initial receipt unless counsel says otherwise)

8. **Update database state.** Mark the affected recordings as `qa_status = 'takedown'`:
   ```sql
   UPDATE recordings
   SET qa_status = 'takedown', updated_at = now()
   WHERE id IN ('<recording_id_1>', '<recording_id_2>', ...);
   ```
   This is the MVP "manual DB script" pattern from D-LEGAL-04 — no admin HTTP endpoint, no UI. Read-side handlers in plans 06 / 08 (lists, contributions, search) already filter `qa_status NOT IN ('takedown','rejected')` so the rows are immediately invisible to the user and to lifetime aggregates. The migration-0004 trigger then auto-deletes any contributions buckets that emptied as a result.
9. **Purge S3 objects.**
   ```sh
   for rid in <recording_id_1> <recording_id_2> ...; do
     aws s3 rm s3://humyn-recordings-prod/recordings/<user_id>/$rid/ --recursive
   done
   ```
   Then permanent-delete bucket-versioning copies:
   ```sh
   aws s3api list-object-versions \
     --bucket humyn-recordings-prod \
     --prefix recordings/<user_id>/ \
     --output json > /tmp/versions.json
   # Counsel + ops construct the delete-object command per the JSON.
   ```
10. **User-level takedown** (if request demands account erasure, not just recordings):
    ```sql
    UPDATE users
    SET deleted_at = now(),
        delete_grace_until = now() + interval '0 days'
    WHERE id = '<affected_user_id>';
    ```
    Note: regulator-mandated takedowns bypass the 30-day grace period (`delete_grace_until = now()`). The DSR cron stub from plan 01-08 will pick up the row on its next tick (Phase 1 = log-only; Phase 5 swaps in the actual hard-delete worker that purges S3 + anonymises rows).
11. **Audit row.** Append to `takedown_log`:
    ```sql
    INSERT INTO takedown_log (
      id, request_received_at, request_authority, affected_user_id,
      affected_recording_ids, action_taken, completed_at, counsel_reviewer, notes
    ) VALUES (
      '<ulid>', '<received_at>', '<ANPD|DPB|court|other>', '<user_id>',
      '["<recording_id_1>", "<recording_id_2>"]'::jsonb,
      '<plain-text description of what was done>',
      now(), '<attorney-name>', '<optional notes>'
    );
    ```

## Phase D — Response letter (target: within the regulator's mandated window)

12. **Counsel drafts the response letter.** Template lives at `.planning/legal/templates/takedown-response-letter.md` (created at counsel-engagement time per the checklist). The letter cites:
    - The internal tracking ULID
    - The `takedown_log` row id
    - The list of affected recording ids (or a summary count if regulator prefers aggregated)
    - The actions taken (per Phase C)
    - The compliance timestamp
13. **Send via the regulator's preferred channel.** ANPD / DPB each have official portals; counsel-validated.

## Quarterly review

This runbook is treated as code. Quarterly review checklist:

- Have the schema or column names changed? (`recordings.qa_status`, `takedown_log` columns)
- Have any new buckets / object prefixes been introduced? (currently `humyn-recordings-prod` + `humyn-ops-dsr-prod` + `humyn-feedback-prod`)
- Has the response-window for either regulator changed?
- Is the on-file legal contact still `legal@humyn.ai`?
- Has the consent text in `apps/api/src/legal/consent-text.ts` been updated since the last review? If yes, counsel re-validates that takedown actions still match what users were shown.

If any answer is "yes" or "unsure", counsel review is triggered before applying the runbook to a new request.

## References

- DPDP Act (India) — section 13 (data correction/erasure rights), section 38 (DPB powers).
- LGPD (Brazil) — article 18 (data subject rights), articles 55-A–55-L (ANPD enforcement).
- CONTEXT.md D-LEGAL-04 — takedown SOP shape (ops runbook + manual DB script; no admin HTTP endpoint).
- `apps/api/src/db/schema.ts` — `recordings.qa_status` enum (`takedown` value), `takedown_log` table.
- `apps/api/src/db/migrations/0005_takedown_log.sql` — `takedown_log` schema.
