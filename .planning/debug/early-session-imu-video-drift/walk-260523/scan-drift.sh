#!/usr/bin/env bash
# Pull metadata.json from S3 for every recording in /tmp/walk-recordings.tsv
# and print a per-device, in-capture-order drift table.
set -euo pipefail
BUCKET="humyn-recordings-dev"
OUTDIR="$(dirname "$0")/s3-pull/metadata"
mkdir -p "$OUTDIR"

# Map user_id → device label (Pixel 10a has the surviving on-device segment).
P10A_USER="01KS7D3ET4TM2HHEK0425TXQVR"
P8A_USER="01KS7D37E7M8BCBM9M034K4TJM"

N10A=0; N8A=0
while IFS='|' read -r REC_ID USER_ID CAPTURED S3KEY; do
  if [[ "$USER_ID" == "$P10A_USER" ]]; then
    N10A=$((N10A + 1)); DEV="10a"; N=$N10A
  else
    N8A=$((N8A + 1));   DEV="8a";  N=$N8A
  fi
  LOCAL="$OUTDIR/${DEV}-seg${N}-${REC_ID}.metadata.json"
  if [[ ! -f "$LOCAL" ]]; then
    docker exec humyn-localstack awslocal s3 cp "s3://$BUCKET/$S3KEY" - 2>/dev/null > "$LOCAL"
  fi
done < /tmp/walk-recordings.tsv

# Emit a parseable per-device, in-order table.
python3 - "$OUTDIR" <<'PY'
import json, os, sys, re
from pathlib import Path
outdir = Path(sys.argv[1])
files = sorted(outdir.glob('*.metadata.json'))
by_dev = {'10a': [], '8a': []}
for f in files:
    m = re.match(r'(\w+)-seg(\d+)-([0-9A-Z]+)\.metadata\.json', f.name)
    dev, n, rid = m.group(1), int(m.group(2)), m.group(3)
    d = json.load(open(f))['metadata']
    by_dev[dev].append((n, rid, d.get('imu_video_drift_max_ms'), d.get('imu_video_drift_mean_ms'), d.get('imu_video_drift_p99_ms'), d.get('fps'), d.get('duration_seconds') or d.get('duration_ms')))
for dev in ('10a','8a'):
    print(f"\n=== Pixel {dev} ({len(by_dev[dev])} segs) ===")
    print(f"{'#':>2}  {'recording':28} {'max ms':>9} {'mean ms':>9} {'p99 ms':>9} {'fps':>6} {'dur':>8}")
    for n, rid, mx, mn, p99, fps, dur in by_dev[dev]:
        def f(x): return f"{x:9.3f}" if isinstance(x,(int,float)) else " "*9
        durs = f"{dur:8.1f}" if isinstance(dur,(int,float)) else " "*8
        fpss = f"{fps:6.2f}" if isinstance(fps,(int,float)) else " "*6
        print(f"{n:>2}  {rid:28} {f(mx)} {f(mn)} {f(p99)} {fpss} {durs}")
PY
