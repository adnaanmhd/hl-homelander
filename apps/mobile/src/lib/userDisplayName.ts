// userDisplayName — shared name-coalesce helper used by the three
// `useAppStore.user.name` write sites (SignupScreen post-Google-Sign-In,
// ProfileScreen post-/me, useForegroundUserRehydrate post-/me). Google's
// `displayName` is null/empty for accounts that never set one; the
// server's `users.name` is `text` and nullable for the same reason. Per
// the 05-HUMAN-UAT.md Gaps entry (2026-05-13), the previous pattern of
// `setUser({ name: result.user.name, ... })` propagated `null`/empty
// straight into the store → `buildCaptureOpts` got `args.user.name = ''`
// → the Kotlin bridge rejected with `invalid_opts: name` and recording
// never started. This helper coalesces to the email-local-part (the part
// BEFORE the `@`) when the upstream name is absent, mirroring the
// common convention used by other consumer apps when Google withholds a
// display name. If even the email-local-part is empty (a malformed
// address that somehow survived sign-in), we return `null` and let the
// buildCaptureOpts JS-side guard (code: 'profile_incomplete') surface
// a clear user-facing toast at recording-start time.
//
// Trim semantics: a single whitespace-only `name` is treated as absent
// (Google's `displayName` is occasionally ` ` for institutional
// accounts); the email-local-part is also trimmed. NEVER throws — the
// call sites use the return value directly in `setUser({ name: ... })`.

export function coalesceDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const trimmedName = (name ?? '').trim();
  if (trimmedName.length > 0) return trimmedName;
  const trimmedEmail = (email ?? '').trim();
  if (trimmedEmail.length === 0) return null;
  const localPart = trimmedEmail.split('@')[0]?.trim() ?? '';
  if (localPart.length === 0) return null;
  return localPart;
}
