# Historical component-identifiability result

Status: **FAIL — individual exposure components are not identifiable from the
current eight-epoch design.**

The audit uses eight independent epoch-level predictor vectors for six fitted
parameters including the intercept, leaving only two residual degrees of
freedom. The standardized design condition number is 175.31. OMNI event and
background cumulative proxies correlate at 0.9981; the equivalent SGPS pair
correlates at 0.9512.

VIF is 4,342.0 for OMNI event and 4,881.4 for OMNI background; SGPS event and
background VIFs are 15.25 and 11.44. In leave-one-epoch-out fits, the OMNI event
coefficient is positive in only 2/8 fits and the SGPS event coefficient in 4/8,
so their signs are not stable. All four versioned diagnostic gates fail.

This quantitatively explains why the existing falsification suite can reject
the exposure-attribution claim despite a replicated positive detector trend.
It does not alter the HST measurement, estimate physical dose, or authorize the
sealed 2025 holdout. The appropriate next experiment remains a larger cohort
with independently measured nuisance state and more temporal support.

Machine-readable evidence: `results/identifiability/historical_design.json`.
Publication figure: `paper/figures/identifiability_audit.pdf`.
