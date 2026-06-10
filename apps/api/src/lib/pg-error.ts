// Review extraction (2026-06-10) — shared unwrap for (possibly drizzle-
// wrapped) node-postgres errors. drizzle-orm ≥0.44 wraps the pg DatabaseError
// in a DrizzleQueryError whose `.cause` carries the original, so classifiers
// must check both levels; two routes had private copies of this unwrap
// (feedback's content-error classifier + init's unique-violation check) that
// would have drifted on the next ORM upgrade.

/** SQLSTATE of a pg error (`err.code`, or `err.cause.code` when ORM-wrapped). */
export function pgErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const cause = (err as { cause?: unknown }).cause;
  const code =
    (err as { code?: unknown }).code ?? (cause as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Violated-constraint name of a pg error, unwrapped like [pgErrorCode]. */
export function pgErrorConstraint(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const cause = (err as { cause?: unknown }).cause;
  const constraint =
    (err as { constraint?: unknown }).constraint ??
    (cause as { constraint?: unknown } | null | undefined)?.constraint;
  return typeof constraint === 'string' ? constraint : undefined;
}
