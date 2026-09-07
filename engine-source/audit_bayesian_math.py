import json
import math
from itertools import product
from pathlib import Path

from scipy.stats import beta

FAIL_PRIOR = [0.82, 0.62, 0.42, 0.25, 0.12, 0.05]


def portal_posterior(level, tested, exceptions, implementation="not-tested", gate=False):
    prior_level = None if level is None else max(0, level - 1) if gate else level
    prior_p = 0.5 if prior_level is None else FAIL_PRIOR[prior_level]
    strength = 2 if prior_level is None else 6
    tested = max(0, int(tested or 0))
    exceptions = min(max(0, int(exceptions or 0)), tested)
    a = prior_p * strength + exceptions
    b = (1 - prior_p) * strength + max(0, tested - exceptions)
    if implementation == "does-not-meet":
        a += 4
    elif implementation == "partially":
        a += 1
        b += 1
    elif implementation == "meets":
        b += 2
    mean = a / (a + b)
    variance = (a * b) / ((a + b) ** 2 * (a + b + 1))
    se = math.sqrt(variance)
    normal = (max(0.0, mean - 1.96 * se), min(1.0, mean + 1.96 * se))
    exact = (float(beta.ppf(0.025, a, b)), float(beta.ppf(0.975, a, b)))
    return {"a": a, "b": b, "mean": mean, "normal": normal, "exact": exact}


cases = []
max_endpoint_error = 0.0
worst_case = None
for level, tested, exceptions, implementation, gate in product(
    [None, 0, 1, 2, 3, 4, 5],
    [0, 1, 5, 10, 30, 100],
    [0, 1, 3, 10, 30, 100],
    ["not-tested", "meets", "partially", "does-not-meet"],
    [False, True],
):
    if exceptions > tested or (level is None and gate):
        continue
    r = portal_posterior(level, tested, exceptions, implementation, gate)
    err = max(abs(r["normal"][0] - r["exact"][0]), abs(r["normal"][1] - r["exact"][1]))
    row = {
        "level": level,
        "tested": tested,
        "exceptions": exceptions,
        "implementation": implementation,
        "gate": gate,
        "mean": r["mean"],
        "normal": r["normal"],
        "exact": r["exact"],
        "max_endpoint_error": err,
    }
    cases.append(row)
    if err > max_endpoint_error:
        max_endpoint_error = err
        worst_case = row


checks = {}

# Higher maturity must never produce a higher failure posterior, other things equal.
checks["maturity_monotone"] = all(
    portal_posterior(level + 1, tested, exceptions, implementation)["mean"]
    <= portal_posterior(level, tested, exceptions, implementation)["mean"] + 1e-12
    for level in range(5)
    for tested, exceptions, implementation in product([0, 5, 30], [0, 1], ["not-tested", "meets", "partially", "does-not-meet"])
    if exceptions <= tested
)

# For a fixed sample size, extra exceptions must never reduce failure probability.
checks["exceptions_monotone"] = all(
    portal_posterior(level, tested, exceptions + 1, implementation)["mean"]
    >= portal_posterior(level, tested, exceptions, implementation)["mean"] - 1e-12
    for level in range(6)
    for tested in [1, 5, 30, 100]
    for exceptions in range(tested)
    for implementation in ["not-tested", "meets", "partially", "does-not-meet"]
)

# With zero exceptions, more tests must never increase failure probability.
checks["clean_tests_monotone"] = all(
    portal_posterior(level, n2, 0, implementation)["mean"]
    <= portal_posterior(level, n1, 0, implementation)["mean"] + 1e-12
    for level in range(6)
    for n1, n2 in [(0, 1), (1, 5), (5, 30), (30, 100)]
    for implementation in ["not-tested", "meets", "partially", "does-not-meet"]
)

# A missing-evidence gate must not improve the failure posterior.
checks["evidence_gate_conservative"] = all(
    portal_posterior(level, tested, exceptions, implementation, gate=True)["mean"]
    >= portal_posterior(level, tested, exceptions, implementation, gate=False)["mean"] - 1e-12
    for level in range(1, 6)
    for tested, exceptions, implementation in product([0, 5, 30], [0, 1], ["not-tested", "meets", "partially", "does-not-meet"])
    if exceptions <= tested
)

# Status pseudo-count ordering is internally consistent but tested separately because it may double count judgement.
checks["implementation_ordering"] = all(
    portal_posterior(level, tested, exceptions, "meets")["mean"]
    <= portal_posterior(level, tested, exceptions, "partially")["mean"]
    <= portal_posterior(level, tested, exceptions, "does-not-meet")["mean"]
    for level in range(6)
    for tested, exceptions in [(0, 0), (5, 0), (5, 2), (30, 1)]
)

representative = []
for level, tested, exceptions, implementation in [
    (5, 0, 0, "meets"),
    (5, 1, 0, "meets"),
    (5, 30, 0, "meets"),
    (3, 5, 1, "partially"),
    (1, 5, 3, "does-not-meet"),
    (None, 0, 0, "not-tested"),
]:
    r = portal_posterior(level, tested, exceptions, implementation)
    representative.append(
        {
            "level": level,
            "tested": tested,
            "exceptions": exceptions,
            "implementation": implementation,
            "posterior_mean_pct": round(100 * r["mean"], 2),
            "portal_normal_interval_pct": [round(100 * v, 2) for v in r["normal"]],
            "exact_beta_interval_pct": [round(100 * v, 2) for v in r["exact"]],
        }
    )

result = {
    "case_count": len(cases),
    "checks": checks,
    "max_interval_endpoint_error_percentage_points": round(100 * max_endpoint_error, 2),
    "worst_interval_case": worst_case,
    "representative_cases": representative,
    "conclusion": (
        "The conjugate posterior mean and monotonic behavior are correct. "
        "The current 95% range is not an exact Beta credible interval and should be replaced. "
        "Implementation pseudo-counts are internally ordered but represent uncalibrated duplicate judgement."
    ),
}

out = Path("/home/ubuntu/iopaf_v4/bayesian_math_audit.json")
out.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
if not all(checks.values()):
    raise SystemExit(1)
