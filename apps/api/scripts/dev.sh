#!/usr/bin/env bash
# Wave-1.5 Item 10 (optional half) — guard against the EADDRINUSE-tsx-watch-race
# observed on the 2026-05-13 walk. Bail loudly if port 8080 is already taken
# (three concurrent `tsx watch src/index.ts` chains were observed, two failing
# EADDRINUSE and ALL of them spamming /tmp/humyn-api.log). Opt-in: the
# operator invokes this directly (`./apps/api/scripts/dev.sh > /tmp/humyn-api.log
# 2>&1 &`); apps/api/package.json's `dev` script is unchanged.
#
# Trail: 05-COSMETIC-GAPS.md Wave-1.5 Item 10; 05-14-PLAN.md Task 4.
set -euo pipefail

PORT="${PORT:-8080}"
if lsof -nP -i ":${PORT}" -sTCP:LISTEN -t > /dev/null 2>&1; then
  echo "ERROR: port ${PORT} already in use. Run 'lsof -i :${PORT}' to find the owner, then 'kill -TERM <pid>'." >&2
  exit 1
fi

exec pnpm tsx watch src/index.ts "$@"
