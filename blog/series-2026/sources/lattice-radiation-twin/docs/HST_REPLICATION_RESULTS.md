# HST replicated longitudinal result

The independent historical replication cohort contains 32 ACS/WFC RAW dark exposures: two paired observations at each of two replication dates in 2003, 2006, 2009, 2012, 2015, 2018, 2021 and 2024. All were processed with ACSCCD 10.4.1 under CRDS context `hst_1356.pmap`. The full calibration verifier checked every RAW input, 21 unique pinned reference files, derived BLV hash, log hash, observation identity, output geometry, electron units, calibrated gain and correction switch. The six August 2025 temporal-holdout RAW arrays remain unopened.

The frozen primary selection contains 102,604 peak measurements across 32 pair-by-chip summaries. The point estimates for 2003 are consistent with zero. All four independently screened time slopes are positive and their fixed-seed 95% epoch-bootstrap intervals exclude zero:

| Pair index | Chip | Slope per year | 95% interval |
|---:|---:|---:|---:|
| 2 | WFC1 | 0.01061 | 0.00630–0.01389 |
| 2 | WFC2 | 0.01328 | 0.01093–0.01641 |
| 3 | WFC1 | 0.00981 | 0.00591–0.01208 |
| 3 | WFC2 | 0.00995 | 0.00857–0.01105 |

None of the 32 primary offset-column blank controls fails the preregistered Bonferroni screen. Each simultaneous interval used 20,000 column-cluster bootstrap resamples and per-interval alpha `0.05 / 32`. The median absolute difference between replication pairs within an epoch and chip is 0.01696; the maximum is 0.05533. Relative to the corresponding chip's replicated 2003-to-2024 change, the median and maximum ratios are 0.0760 and 0.2443. These ratios are descriptive repeatability checks, not exclusion criteria.

The original development value and the mean of the two replication pairs correlate at 0.9678 across the 16 epoch-by-chip comparisons. Their mean absolute difference is 0.01944 and root-mean-square difference is 0.02302. Only four development point estimates fall between the two replication point estimates, but all 32 separate development/replication 95% interval comparisons overlap. Interval overlap is descriptive and does not constitute an equivalence test.

The physical-inference gate remains closed. The observed trail fraction is strongly rank-correlated with both calendar year (`rho = 0.9424`) and measured background (`rho = 0.8559`) across these 32 summaries. Commanded gain, post-flash use, electronics state and the literal JWDETMP1 engineering channel also change over time. The reported rank-correlation p-values are unadjusted and are not causal evidence. The apparent temperature range includes an engineering-channel sign change, so no detector temperature or active-sensor identity is inferred. A pair-aware nuisance and measurement-error model must beat declared temporal baselines before the trajectory can be related to an exposure proxy or latent damage state.

Machine-readable sources:

- `results/hst_replication/primary.json` and `measurements.json`: observed pair-separated estimates and intervals;
- `results/hst_replication/assessment.json`: frozen direction and familywise-control decisions;
- `results/hst_replication/development_comparison.json`: development-versus-replication metrics;
- `results/hst_replication/nuisance_summary.json`: literal engineering-state join and descriptive associations;
- `results/calibration/replication_products.json`: calibration provenance and output hashes.
