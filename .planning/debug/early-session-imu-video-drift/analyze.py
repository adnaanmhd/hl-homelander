#!/usr/bin/env python3
"""
Offline drift analyzer — ports DriftCalculator.kt to Python so we can rerun
the metric with `skip_first_video_frames ∈ {0, 15, 30, 60, 90}` over the
real timestamps pulled from a cold-start walk.

Sanity gate: with skip=0 the analyzer's drift should match the segment's
metadata.json `imu_video_drift_*_ms` within ±5%. If it doesn't, something
is wrong with timestamp reconstruction (likely the MP4 PTS rebasing
assumption) — don't trust the skip>0 numbers until the skip=0 baseline
matches.

Usage:  ./analyze.py <walk-260523/10a>
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


SKIP_VARIANTS = [0, 15, 30, 60, 90]


def ffprobe_pts_ns(mp4_path: Path) -> np.ndarray:
    """Per-frame presentation timestamp from MP4, in nanoseconds.

    Uses `pkt_pts_time` (seconds, MP4-rebased so first frame ≈ 0). MediaMuxer
    writes the encoder's `bufferInfo.presentationTimeUs` as the track PTS,
    quantized to the MP4 video timebase (typically 90 kHz → ~11 µs grain;
    negligible vs the drift values we care about).
    """
    out = subprocess.check_output([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "frame=pts_time",
        "-of", "csv=p=0",
        str(mp4_path),
    ], text=True)
    pts_s = [float(x) for x in out.split() if x and x != "N/A"]
    if not pts_s:
        raise RuntimeError(f"ffprobe returned no PTS for {mp4_path}")
    return np.array([int(round(t * 1e9)) for t in pts_s], dtype=np.int64)


def imu_ts_ns(csv_path: Path) -> np.ndarray:
    """Per-sample event.timestamp (ns) from the IMU CSV.

    Schema (idea-brief.md §8.2): `timestamp_ns,sensor_type,x,y,z`.
    DriftCalculator's input is the merged ascending list of all gyro+accel
    timestamps — we mirror that.
    """
    ts = []
    with csv_path.open() as f:
        header = next(f)
        assert header.startswith("timestamp_ns,"), f"unexpected header: {header!r}"
        for line in f:
            comma = line.find(",")
            if comma <= 0:
                continue
            ts.append(int(line[:comma]))
    ts.sort()
    return np.array(ts, dtype=np.int64)


def residuals_from_lsq(values: np.ndarray) -> np.ndarray:
    """Subtract least-squares line `y = a*i + b` (i = sample index)."""
    n = values.size
    i = np.arange(n, dtype=np.float64)
    y = values.astype(np.float64)
    n_f = float(n)
    sum_i = i.sum()
    sum_y = y.sum()
    sum_iy = (i * y).sum()
    sum_ii = (i * i).sum()
    denom = n_f * sum_ii - sum_i * sum_i
    a = (n_f * sum_iy - sum_i * sum_y) / denom
    b = (sum_y - a * sum_i) / n_f
    return y - (a * i + b)


def interp_at(xs: np.ndarray, ys: np.ndarray, x: np.ndarray) -> np.ndarray:
    """np.interp with the same endpoint-clamp semantics as DriftCalculator
    (`x <= xs[0]` → ys[0]; `x >= xs[-1]` → ys[-1]). np.interp already
    clamps to the endpoint y-values by default."""
    return np.interp(x.astype(np.float64), xs.astype(np.float64), ys)


def compute_drift(
    video_ts_ns: np.ndarray,
    imu_ts_ns: np.ndarray,
    skip_first_video_frames: int = 0,
) -> tuple[float, float, float]:
    """Returns (max_ms, mean_ms, p99_ms). Mirrors DriftCalculator.compute."""
    v = video_ts_ns
    s = imu_ts_ns
    if skip_first_video_frames > 0 and video_ts_ns.size - skip_first_video_frames >= 2:
        trimmed_v = video_ts_ns[skip_first_video_frames:]
        trimmed_s = imu_ts_ns[imu_ts_ns >= trimmed_v[0]]
        if trimmed_s.size >= 2:
            v, s = trimmed_v, trimmed_s
        # else: IMU stream entirely precedes the trim floor — fall back to no skip.

    r_v = residuals_from_lsq(v)
    r_s = residuals_from_lsq(s)
    r_s_at_v = interp_at(s, r_s, v)
    abs_d_ms = np.abs(r_v - r_s_at_v) / 1e6
    abs_d_ms.sort()
    n = abs_d_ms.size
    return (
        float(abs_d_ms[-1]),
        float(abs_d_ms.mean()),
        float(abs_d_ms[min(n * 99 // 100, n - 1)]),
    )


def analyze_segment(seg_dir: Path, idx: int) -> None:
    mp4 = next(iter(seg_dir.glob("*.mp4")), None)
    csv = next(iter(seg_dir.glob("*.csv")), None)
    meta_path = next(iter(seg_dir.glob("*.metadata.json")), None)
    if not (mp4 and csv and meta_path):
        print(f"seg {idx} ({seg_dir.name}): INCOMPLETE (missing mp4/csv/metadata.json) — skipped")
        return

    with meta_path.open() as f:
        meta = json.load(f)
    m = meta["metadata"]
    reported = (
        m.get("imu_video_drift_max_ms"),
        m.get("imu_video_drift_mean_ms"),
        m.get("imu_video_drift_p99_ms"),
    )

    v = ffprobe_pts_ns(mp4)
    s = imu_ts_ns(csv)

    # Align video PTS into the IMU absolute domain. ffprobe pts_time is
    # MP4-rebased (first frame ≈ 0); shift so v[0] == s[0]. The least-squares
    # intercept absorbs the constant offset; the alignment only matters for
    # the interpolation lookup, where being off by < 1 ms is harmless
    # because IMU residuals are smooth at the sub-frame scale.
    offset = int(s[0]) - int(v[0])
    v_aligned = v + offset

    print(f"\nseg {idx} ({seg_dir.name}):")
    print(f"  duration ≈ {(v_aligned[-1] - v_aligned[0]) / 1e9:.1f}s   "
          f"video_frames={v.size}   imu_samples={s.size}")
    rep_max, rep_mean, rep_p99 = reported
    if rep_max is not None:
        print(f"  metadata.json reported:  "
              f"max={rep_max:7.3f}  mean={rep_mean:7.3f}  p99={rep_p99:7.3f}")
    else:
        print("  metadata.json reported:  (none — degenerate segment)")

    for skip in SKIP_VARIANTS:
        try:
            max_ms, mean_ms, p99_ms = compute_drift(v_aligned, s, skip)
            marker = ""
            if skip == 0 and rep_max is not None:
                pct = abs(max_ms - rep_max) / max(rep_max, 0.01) * 100.0
                marker = f"   ← match to reported ({pct:.1f}% off max)"
            print(f"  analyzer skip={skip:3d} :  "
                  f"max={max_ms:7.3f}  mean={mean_ms:7.3f}  p99={p99_ms:7.3f}{marker}")
        except Exception as e:
            print(f"  analyzer skip={skip:3d} :  ERROR {e}")


def main():
    if len(sys.argv) != 2:
        print("usage: analyze.py <walk-260523/<device-label>>", file=sys.stderr)
        sys.exit(2)
    walk_dir = Path(sys.argv[1])
    if not walk_dir.is_dir():
        print(f"not a directory: {walk_dir}", file=sys.stderr)
        sys.exit(1)

    seg_dirs = sorted(walk_dir.glob("seg-*"))
    if not seg_dirs:
        print(f"no seg-* directories under {walk_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"# Drift analyzer — {walk_dir}")
    print(f"# skip variants: {SKIP_VARIANTS}")
    print(f"# {len(seg_dirs)} segments")

    for i, seg_dir in enumerate(seg_dirs, start=1):
        analyze_segment(seg_dir, i)


if __name__ == "__main__":
    main()
