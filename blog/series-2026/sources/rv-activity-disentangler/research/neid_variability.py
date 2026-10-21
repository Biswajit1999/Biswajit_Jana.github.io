"""Uncertainty-aware diagnostics for the committed public NEID solar sample."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def load_accepted(path: str | Path) -> dict[str, np.ndarray]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = [row for row in payload["records"] if row["analysisPass"]]
    if not rows:
        raise ValueError("no accepted observations")
    return {
        key: np.array([row[key] for row in rows], dtype=float)
        for key in (
            "bjd",
            "rvRelativeMetersPerSecond",
            "uncertaintyMetersPerSecond",
            "snr",
            "sunAltitudeDegrees",
        )
    }


def nightly_variability(data: dict[str, np.ndarray]) -> list[dict[str, float | int]]:
    """Return inverse-variance means and excess scatter for each observed UTC-like BJD day."""
    nights = np.floor(data["bjd"]).astype(int)
    rows = []
    for night in np.unique(nights):
        selected = nights == night
        rv = data["rvRelativeMetersPerSecond"][selected]
        error = data["uncertaintyMetersPerSecond"][selected]
        weights = 1 / error**2
        mean = float(np.sum(weights * rv) / np.sum(weights))
        chi2 = float(np.sum(((rv - mean) / error) ** 2))
        rows.append(
            {
                "bjd_day": int(night),
                "count": int(selected.sum()),
                "weighted_mean_rv_mps": mean,
                "formal_mean_error_mps": float(1 / np.sqrt(np.sum(weights))),
                "observed_rms_mps": float(np.sqrt(np.mean((rv - mean) ** 2))),
                "reduced_chi2": chi2 / max(1, int(selected.sum()) - 1),
            }
        )
    return rows


def structure_function(data: dict[str, np.ndarray], edges_days: np.ndarray) -> list[dict[str, float | int]]:
    """Estimate the first-order RV structure function in irregular-cadence lag bins."""
    if np.any(np.diff(edges_days) <= 0) or edges_days[0] <= 0:
        raise ValueError("lag edges must be positive and increasing")
    time = data["bjd"]
    rv = data["rvRelativeMetersPerSecond"]
    upper_y, upper_x = np.triu_indices(time.size, k=1)
    lag = np.abs(time[upper_y] - time[upper_x])
    difference = np.abs(rv[upper_y] - rv[upper_x]) / np.sqrt(2)
    rows = []
    for low, high in zip(edges_days[:-1], edges_days[1:], strict=True):
        selected = (lag >= low) & (lag < high)
        values = difference[selected]
        if values.size == 0:
            continue
        rows.append(
            {
                "lag_low_days": float(low),
                "lag_high_days": float(high),
                "pair_count": int(values.size),
                "median_abs_difference_over_sqrt2_mps": float(np.median(values)),
                "p16_mps": float(np.percentile(values, 16)),
                "p84_mps": float(np.percentile(values, 84)),
            }
        )
    return rows


def selection_sensitivity(payload: dict, snr_thresholds=(10, 200, 300, 400)) -> list[dict[str, float | int]]:
    """Recompute scatter and nuisance correlations over predeclared S/N cuts."""
    archive_clean = [row for row in payload["records"] if row["archiveFlag"] == 0]
    rows = []
    for threshold in snr_thresholds:
        selected = [
            row
            for row in archive_clean
            if row["uncertaintyMetersPerSecond"] < 10 and row["snr"] >= threshold
        ]
        if len(selected) < 3:
            continue
        rv = np.array([row["rvRelativeMetersPerSecond"] for row in selected])
        snr = np.array([row["snr"] for row in selected])
        altitude = np.array([row["sunAltitudeDegrees"] for row in selected])
        rows.append(
            {
                "snr_minimum": int(threshold),
                "count": len(selected),
                "rv_rms_mps": float(np.sqrt(np.mean((rv - np.mean(rv)) ** 2))),
                "rv_snr_pearson": float(np.corrcoef(rv, snr)[0, 1]),
                "rv_altitude_pearson": float(np.corrcoef(rv, altitude)[0, 1]),
            }
        )
    return rows

