# IOPAF Bayesian Control-Risk Model — Independent Audit

**Audit date:** 1 September 2026  
**Scope:** schema-v9 control-failure updating, ordinal effectiveness, eight IAM scenarios, target inheritance, causal aggregation, residual-risk distribution, appetite exceedance, dashboard, exports and technical PDFs.

## Final conclusion

**The previous model was directionally useful but not fully correct.** Its Beta-Binomial posterior mean was structurally sound, all eight scenario distributions normalized, all 148 controls mapped to the correct domain, and target isolation worked. However, the audit found material uncertainty and semantic defects: approximate rather than exact credible intervals, double-counted implementation judgement, heuristic group-level causal roles, risk reduction from unassessed controls, N/A inflation of coverage, an unapproved 25% appetite threshold, incorrect percentage scaling in the graph inspector, and one-point inverse sensitivity artifacts from category rounding.

**The audited v0.5 implementation corrects those defects.** Exact Beta intervals now match SciPy to machine precision; all 148 formal role/effect classifications agree; stronger evidence never increases risk; weaker evidence and additional exceptions never reduce risk; prior-only, N/A, shared-service, target-isolation and T1/T2/T3 tests pass. The model is now mathematically consistent for comparative assurance and what-if analysis. Its scenario priors, maturity-to-effectiveness bridge, BIA distributions and conditional influence coefficients remain **provisional expert templates** and require organizational calibration before the output can be interpreted as an absolute real-world event probability or used for a formal risk-acceptance decision.

## External validation basis

NIST SP 800-30 treats risk assessment as decision support and expects likelihood, impact, uncertainty, assumptions and confidence to be communicated rather than hidden behind unsupported precision.[1] A standard Beta-Binomial model updates a Beta prior for a binary event probability with observed event and non-event counts; the posterior parameters are obtained by adding exceptions and non-exceptions to the corresponding prior shape parameters.[2]

The portal’s core update `Beta(alpha0 + exceptions, beta0 + tested - exceptions)` is therefore structurally correct for exchangeable binary test opportunities. However, model calibration, dependence assumptions and conversion of posterior failure to ordinal effectiveness and scenario risk remain model-design questions rather than consequences of Bayesian conjugacy.

## Preliminary mathematical findings

| Component | Preliminary conclusion | Required action |
| --- | --- | --- |
| Beta-Binomial count update | Structurally correct | Retain; independently recalculate edge cases |
| Prior means by L0–L5 | Internally monotonic but expert-elicited, not empirically calibrated | Keep explicitly provisional and expose parameter table |
| Implementation status pseudo-counts | Mathematically valid as an additional prior/likelihood contribution, but likely double-counts the same assessment judgement already represented by maturity | Remove from the observed-data posterior or disclose and calibrate separately |
| 95% interval | Current `mean ± 1.96 × standard error` is a normal approximation, not an exact Beta credible interval; it can materially misstate intervals with small samples or shape parameters below 1 | Replace with exact equal-tail Beta quantiles |
| Evidence strength | Evidence labels do not alter posterior strength except through the no-evidence maturity cap and explicit tested counts | Clarify that only observed test opportunities update the Beta likelihood |
| Ordinal effectiveness distribution | Gaussian-shaped state weights around a blended mean are a transparent heuristic, not a Bayesian posterior derived from the Beta model | Relabel as a calibrated ordinal bridge and retain uncertainty warning |
| Scenario outputs | They are Bayesian-inspired probability propagation through provisional conditional mappings, not empirically calibrated absolute event frequencies | Prevent “production probability” interpretation until CPT/BIA calibration |

## Independent numerical test results

The posterior implementation was recalculated independently over **1,092 combinations** of maturity, sample size, exceptions, implementation status and evidence-gate state. The posterior mean passed all monotonicity checks: higher maturity did not increase failure probability; additional exceptions did not reduce it; clean additional tests did not increase it; and the no-evidence gate was conservative.

The interval audit did identify a material defect. The largest difference between the portal’s normal-approximation endpoint and the exact equal-tail Beta credible endpoint was **8.80 percentage points**. For an L4 prior with no test sample, the portal displayed approximately **0.0%–36.1%**, whereas the exact Beta interval is approximately **0.1%–44.9%**. This does not alter the posterior mean, but it understates uncertainty and must be corrected.

| Numerical property | Result |
| --- | --- |
| Higher maturity cannot increase posterior failure | Pass |
| More exceptions cannot reduce posterior failure | Pass |
| More zero-exception tests cannot increase posterior failure | Pass |
| Missing-evidence cap cannot improve posterior failure | Pass |
| Posterior mean remains within 0–1 | Pass |
| Current 95% interval equals exact Beta credible interval | **Fail — replace approximation** |

The peer-reviewed Bayesian-network review confirms that a BN requires both a directed acyclic dependency structure and quantified conditional dependencies. Expert-defined structures are acceptable, but parameter values and causal assumptions must be validated, sensitivity-tested and communicated as uncertain; output distributions should not be presented as empirically calibrated event frequencies unless their parameters have actually been calibrated.[3]

## Causal, scope and risk-aggregation audit

The live browser model was exercised across all eight domain scenarios and all 148 controls. All inherent, likelihood, consequence, common-cause and residual-risk distributions normalized to 100%. Every control mapped to the scenario for its own domain, and assessment-target isolation passed: improving all D3 controls for one database changed that database’s risk distribution but did not change a second database’s result.

| Test | Result |
| --- | --- |
| Eight scenario definitions available | Pass |
| All 148 controls map to exactly one domain scenario | Pass |
| All probability distributions normalize to 100% | Pass |
| Better control evidence reduces or preserves appetite exceedance | Pass for 148/148 controls |
| More exceptions reduce risk | Pass; no inverse cases |
| Database A evidence leaves Database B unchanged | Pass |
| T1 consequence and appetite exceed T2, which exceed T3 | Pass |
| Empty shared-IAM object leaves target risk unchanged | Pass, although its displayed common-cause distribution changed |

Four model-design defects were confirmed:

1. **Control roles are assigned at group level using a text heuristic.** If any control in a group appears detective, the entire group becomes detective. Across the 148 controls, **34 model roles disagree with the portal’s formal control taxonomy**, and **17 groups contain mixed preventive/detective roles**. The Bayesian model must classify each control first, then aggregate preventive and detective contributions separately.
2. **Unassessed controls receive a neutral 50% effectiveness prior.** This reduces scenario likelihood before any evidence exists. A prior-only result should conservatively retain inherent likelihood unless an approved scenario-specific control-effectiveness prior has been elicited.
3. **N/A responses count as “assessed.”** Although an N/A response did not change the risk distribution in the tested case, it increased the assessed-control count and therefore inflates apparent model completeness. N/A must be excluded from evidence coverage.
4. **The 25% appetite threshold is illustrative but is displayed as if it were the organization’s approved limit.** NIST expects risk tolerance assumptions and uncertainty to be explicit and organization-defined.[1] Until a threshold is configured and approved, the portal should report `P(Risk ≥ High)` without declaring an appetite breach.

The model’s residual-risk matrix and provisional conditional influence coefficients are internally monotonic, but they remain elicited templates. They support comparative and what-if assurance analysis; they do not support an absolute forecast such as “there is a calibrated 56% real-world chance of loss” until threat-frequency, BIA and conditional-probability calibration are completed.

## Corrective implementation and visual validation

The portal was corrected to use exact equal-tail Beta credible intervals, remove implementation-status pseudo-counts, apply formal control taxonomy and risk-effect classifications at control level, exclude N/A responses from coverage, withhold risk reduction for unassessed controls, and preserve prior distributions through a monotonic ordinal transition kernel. Residual-risk rounding now preserves the independently calculated `P(Risk ≥ High)` tail, removing one-point inverse sensitivity artifacts.

The expandable Bayesian graph now routes likelihood-effect and consequence-effect controls separately, shows mixed group roles transparently, and displays posterior failure percentages on the correct 0–100 scale. The summary reports `P(Risk ≥ High)` without declaring a breach when no approved organizational appetite limit exists. Visual inspection at 1440 pixels confirmed readable nodes, correct causal arrows, contained graph navigation, clear audited/provisional status and no page-level horizontal overflow.

| Final validation | Result |
| --- | --- |
| Exact browser Beta quantiles vs SciPy | Maximum error `4.996 × 10⁻¹⁶` |
| Deterministic portal regression | All tests passed, including seven new audited-Bayesian assertions |
| All eight scenarios and 148 mappings | Pass |
| Formal taxonomy role/effect agreement | 148/148 controls |
| Stronger evidence increases risk | 0/148 cases |
| Weaker evidence reduces risk | 0/148 cases |
| More exceptions reduce risk | 0/148 cases |
| Target isolation | Pass |
| N/A exclusion | Pass |
| Empty shared-service neutrality | Pass |
| T1 > T2 > T3 consequence ordering | Pass |
| Complete portal browser regression | Pass; no page or console errors |
| Process and IAM-domain PDF generation | Pass with embedded offline engine |

The regenerated IAM technical report was visually checked on its Bayesian analytics and control-register pages. The analytics page now reports **P(Risk ≥ High)** and explicitly states that the appetite limit is not configured. The control ledger labels every uncertainty range as an **exact 95% interval**; values, source references, evidence, sample counts and exception counts remain readable without row overflow.

## References

[1]: https://csrc.nist.gov/pubs/sp/800/30/r1/final "NIST SP 800-30 Rev. 1 — Guide for Conducting Risk Assessments"
[2]: https://www.bayesrulesbook.com/chapter-3 "Bayes Rules! Chapter 3 — The Beta-Binomial Bayesian Model"
[3]: https://pmc.ncbi.nlm.nih.gov/articles/PMC7821106/ "Kaikkonen et al. — Bayesian Networks in Environmental Risk Assessment: A Review"
