# NEID Solar RV Variability and Quality-Cut Audit

![NEID solar RV audit cover](public/social-preview.svg)

A reproducible observational audit of **2,000 public NEID Level-2 solar exposures**. The public interface now leads with the real archive result—not the repository's older synthetic planet/activity sliders.

**[Open the live study](https://biswajit1999.github.io/rv-activity-disentangler/)**

## Research question

How stable is the measured solar radial-velocity scatter when the same four-night archive sample is viewed night by night, across time lag, and under four declared signal-to-noise thresholds?

## Result

The fixed NExScI TAP query spans BJD 2459700–2459713 and returns 2,000 rows. The existing acceptance contract retains 635 exposures on four observed nights.

| Diagnostic | Result |
|---|---:|
| Accepted-window RV RMS, S/N ≥ 10 | 6.96 m/s |
| Strict-cut RV RMS, S/N ≥ 400 | 1.16 m/s |
| Retained exposures across that change | 635 → 314 |
| Nightly RMS range | 0.75–12.91 m/s |
| Nightly reduced χ² range | 13.36–180.35 |

The aggregate RMS changes by a factor of six across the precomputed thresholds. The fourth observed night dominates the loose-cut result. Pairwise velocity differences also increase from sub-hour to multi-day separation, but the sample is too short and discontinuous to identify the solar rotation period.

This supports a quality-selection sensitivity result. It does **not** establish an activity correction, a planet recovery, or a causal explanation for the fourth night.

## Evidence path

1. `scripts/build_neid_solar.py` submits a fixed ADQL query to the official NExScI service.
2. `public/data/neid-solar-2459700-2459713.json` preserves all 2,000 rows, including archive flags, filenames, MD5 values and pipeline versions.
3. `scripts/analyze_neid_variability.py` calculates nightly weighted statistics, an irregular-cadence structure function, and four fixed S/N sensitivity points.
4. `research/neid-variability-summary.json` is the machine-readable result rendered by the website.
5. The test suite binds the interface to the 635-exposure count, four-night coverage and RMS sensitivity anchors.

## Reproduce

```bash
python -m pip install -r requirements-analysis.txt
python scripts/analyze_neid_variability.py
npm ci
npm run check
python -m pytest -q tests/test_neid_variability.py
```

Run the site locally with `npm run dev`, or build the GitHub Pages artifact with `npm run build`.

## Data contract

The browser bundle retains UTC, BJD, relative RV, formal RV uncertainty, extracted S/N, solar altitude, archive quality flag, FITS filename, archive MD5 and pipeline version. The local pass rule remains visible in both the interface and source data; excluded exposures are inspectable.

NEID's official archive documentation states that Level-2 products contain derived radial velocities and that flagged files did not pass archive quality control. The archive also recommends inspection of the full Level-2 products for precision work. This repository analyses compact metadata, not the complete spectral or activity-indicator HDUs.

## Scientific boundary

- The 13-day query contains accepted measurements on only four nights.
- Formal Level-2 uncertainties do not represent all shared systematics or stellar variability.
- The structure function contains many dependent pairs and is descriptive, not a periodogram or likelihood.
- S/N and solar-altitude correlations are diagnostics, not causal effects.
- No Ca II, Hα, CCF-shape, pyrheliometer, magnetogram or photometric activity series is modelled here.

The earlier deterministic injection functions remain tested in `src/science.ts` as a regression fixture, but they are no longer presented as the primary scientific result.

## Sources

- [NExScI NEID Solar RV Archive](https://neid.ipac.caltech.edu/help_solar.php)
- [NEID Level-2 data format](https://neid.ipac.caltech.edu/docs/NEID-DRP/dataformat.html)
- [NEID pipeline overview](https://neid.ipac.caltech.edu/docs/NEID-DRP/overview.html)
- [Temporal validation note](docs/NEID_TEMPORAL_VALIDATION.md)
- [Methods](docs/METHODS.md)

## Author and license

Biswajit Jana, 2026. Original code and documentation are released under the MIT License. Archive products retain their source terms and required acknowledgement.
