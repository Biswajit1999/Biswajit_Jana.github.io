"""Generate real-data NEID temporal-variability diagnostics."""
from __future__ import annotations

import csv
import json
from pathlib import Path
import sys

import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from research.neid_variability import (  # noqa: E402
    load_accepted,
    nightly_variability,
    selection_sensitivity,
    structure_function,
)

INPUT = ROOT / "public" / "data" / "neid-solar-2459700-2459713.json"
OUTPUT = ROOT / "research" / "neid-variability-summary.json"


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    payload = json.loads(INPUT.read_text(encoding="utf-8"))
    data = load_accepted(INPUT)
    nightly = nightly_variability(data)
    lag_edges = np.geomspace(1 / 1440, 12, 18)
    structure = structure_function(data, lag_edges)
    sensitivity = selection_sensitivity(payload)
    write_csv(ROOT / "research" / "neid-nightly-variability.csv", nightly)
    write_csv(ROOT / "research" / "neid-structure-function.csv", structure)
    write_csv(ROOT / "research" / "neid-selection-sensitivity.csv", sensitivity)
    summary = {
        "data_kind": "real public NEID Level-2 solar RV metadata",
        "accepted_exposures": int(data["bjd"].size),
        "observed_nights": len(nightly),
        "nightly_reduced_chi2_range": [
            min(row["reduced_chi2"] for row in nightly),
            max(row["reduced_chi2"] for row in nightly),
        ],
        "analyses": {
            "nightly_weighted_variability": nightly,
            "irregular_cadence_structure_function": structure,
            "quality_selection_sensitivity": sensitivity,
        },
        "limitations": (
            "The 13-day archive window is too short for a solar-rotation inference. "
            "Formal Level-2 uncertainties omit stellar variability and shared systematics; "
            "correlations with S/N or altitude are diagnostic, not causal."
        ),
    }
    OUTPUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    figure, axes = plt.subplots(1, 2, figsize=(11, 4.5), constrained_layout=True)
    axes[0].errorbar(
        [row["bjd_day"] - 2_459_700 for row in nightly],
        [row["weighted_mean_rv_mps"] for row in nightly],
        yerr=[row["formal_mean_error_mps"] for row in nightly],
        fmt="o",
        color="#174a8b",
    )
    axes[0].set(xlabel="BJD − 2,459,700 (day)", ylabel="Nightly weighted RV (m/s)", title="Night-to-night solar RV structure")
    lag_midpoint = [np.sqrt(row["lag_low_days"] * row["lag_high_days"]) for row in structure]
    axes[1].plot(lag_midpoint, [row["median_abs_difference_over_sqrt2_mps"] for row in structure], marker="o", color="#b85d00")
    axes[1].set_xscale("log")
    axes[1].set(xlabel="Pair lag (days)", ylabel="Median |ΔRV| / √2 (m/s)", title="Irregular-cadence structure function")
    figure.suptitle("NEID solar RV temporal validation", fontweight="bold")
    figure.savefig(ROOT / "research" / "neid-variability.png", dpi=180)
    plt.close(figure)
    print(f"Analyzed {data['bjd'].size} accepted exposures across {len(nightly)} nights")


if __name__ == "__main__":
    main()

