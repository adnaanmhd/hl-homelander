#!/usr/bin/env bash
# Poll dumpsys meminfo for ai.humynlabs.capture.apk every 60s.
# Writes one CSV row per sample. Per-device — pass serial as $1, out-file as $2.
#
# Schema:
#   timestamp_iso, secs_since_start, java_heap_total_kb, native_heap_total_kb, total_pss_kb, total_rss_kb
#
# Why these columns:
#   - java_heap_total_kb is the BUG-01 signal: post-fix expectation is sawtooth that drops at each
#     segment boundary (every 10 min); pre-fix it grew monotonically until OOM at ~256 MB.
#   - native_heap_total_kb covers HumynCapture's MediaCodec / Camera2 native allocations.
#   - total_pss + total_rss for context.
#
# Stop with `kill $(cat .planning/debug/walk-260518/meminfo-<serial>.pid)`.

set -euo pipefail

SERIAL="${1:?usage: poll-meminfo.sh <adb-serial> <out-csv>}"
OUT="${2:?usage: poll-meminfo.sh <adb-serial> <out-csv>}"
PKG="ai.humynlabs.capture.apk"

START_EPOCH=$(date +%s)

echo "timestamp_iso,secs_since_start,java_heap_total_kb,native_heap_total_kb,total_pss_kb,total_rss_kb" >"$OUT"

while true; do
  NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  NOW_EPOCH=$(date +%s)
  SECS=$((NOW_EPOCH - START_EPOCH))

  # dumpsys meminfo prints a Total row per memory class:
  #   Native Heap     8000     ...
  #   Java Heap     45000     ...
  #   TOTAL        320000     ...    324000  RSS
  RAW=$(adb -s "$SERIAL" shell dumpsys meminfo "$PKG" 2>/dev/null || true)

  if [[ -z "$RAW" ]]; then
    echo "$NOW_ISO,$SECS,,,," >>"$OUT"
  else
    JAVA=$(echo "$RAW" | awk '/^[[:space:]]*Java Heap[[:space:]]/ {print $3; exit}')
    NATIVE=$(echo "$RAW" | awk '/^[[:space:]]*Native Heap[[:space:]]/ {print $3; exit}')
    PSS=$(echo "$RAW" | awk '/^[[:space:]]*TOTAL[[:space:]]/ {print $2; exit}')
    RSS=$(echo "$RAW" | awk '/^[[:space:]]*TOTAL[[:space:]]/ {print $7; exit}')
    echo "$NOW_ISO,$SECS,${JAVA:-},${NATIVE:-},${PSS:-},${RSS:-}" >>"$OUT"
  fi

  sleep 60
done
