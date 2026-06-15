-- 0014 — Bug 4 / D2 (2026-06-04): single-device, newest-login-wins.
--
-- Adds users.current_installation_id — the stable install id (UUID v4) of the
-- MOST-RECENT sign-in. POST /auth/google writes it on every sign-in;
-- requireAuth 401s any request whose JWT installationId no longer matches it
-- (the prior device is force-logged-out on its next request).
--
-- **Overrides LOCKED D-AUTH-03** (stateless 30-day JWT, no denylist) — auth
-- becomes stateful (one LRU-cached user lookup per request). Owner sign-off
-- `.planning/260604-locked-override-signoff.md` D2.
--
-- Nullable: existing rows carry NULL until their owner next signs in. Their
-- legacy JWTs lack the installationId claim, so requireAuth forces a one-time
-- re-sign-in (which binds the column) — there is no gap where a legacy session
-- escapes newest-wins. The idempotent migration runner applies this once;
-- IF NOT EXISTS keeps the ADD idempotent across reruns.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "current_installation_id" text;
