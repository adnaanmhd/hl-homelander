#!/usr/bin/env bash
# Per-device adb-reverse watchdog. Re-applies 8080+8081+4566 if any has dropped.
# Polls every 15s. Logs each (re-)apply to OUT/reverse-watchdog-<serial>.log.
#
# Why this exists: adb reverse tunnels can silently drop on:
#   - brief USB disconnects (cable, host sleep, adb daemon restart)
#   - app pm clear + reinstall (sometimes — non-deterministic)
#   - host network changes
# When they drop, every HTTP call from the device gets "Connection refused"
# loopback-side, but Android logs only show as transient network errors —
# the cause is invisible from on-device logs. The /finalize watchdog +
# bounded-worker fix don't help here because there's no server to talk to.
#
# Stop with `kill $(cat reverse-watchdog-<serial>.pid)`.

set -euo pipefail
SERIAL="${1:?usage: reverse-watchdog.sh <adb-serial> <out-log>}"
LOG="${2:?usage: reverse-watchdog.sh <adb-serial> <out-log>}"

PORTS=(8080 8081 4566)

echo "[$(date -u +%FT%TZ)] reverse-watchdog started for $SERIAL" >>"$LOG"

while true; do
  # Read current reverse list once
  CURRENT=$(adb -s "$SERIAL" reverse --list 2>/dev/null || true)
  for p in "${PORTS[@]}"; do
    if ! echo "$CURRENT" | grep -q "tcp:$p tcp:$p"; then
      ts=$(date -u +%FT%TZ)
      echo "[$ts] $SERIAL  missing tcp:$p — re-applying" >>"$LOG"
      adb -s "$SERIAL" reverse "tcp:$p" "tcp:$p" >>"$LOG" 2>&1 || \
        echo "[$ts] $SERIAL  re-apply tcp:$p FAILED" >>"$LOG"
    fi
  done
  sleep 15
done
