"""Evidence machinery: n_eff, minimum detectable effects, evidence grade, location/scale split.

A2 QNT-122/172 (effective sample size), A5 §2.6 (minimum detectable effect), A2 QNT-175 and
FR-SCORE-09 (evidence grade A–D), A2 QNT-145 and FR-SCORE-14 (location / scale decomposition).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import stats

from probcast.contract.grid import MEDIAN_INDEX
from probcast.stats.scores import crps
from probcast.stats.tests import hac_lag, hac_variance

__all__ = [
    "QNT175",
    "GradeThresholds",
    "evidence_grade",
    "location_scale_split",
    "mde_crpss",
    "mde_location",
    "n_eff",
    "n_eff_autocorr",
]


# --------------------------------------------------------------------------- effective size


def n_eff_autocorr(x: np.ndarray | list[float], lag: int) -> float:
    """Data-driven effective sample size of a score series (A2 QNT-172).

    n_eff = n / (1 + 2 Σ_{j=1}^{L} (1 − j/(L+1)) ρ̂_j), ρ̂_j the sample autocorrelations
    (Bartlett-weighted, as in Newey & West 1987). Capped to [1, n]; a non-positive
    denominator (strong negative autocorrelation) returns n.
    """
    v = np.asarray(x, dtype=float).ravel()
    n = v.size
    if n < 2:
        raise ValueError("need at least two observations")
    lag = int(lag)
    if lag < 0 or lag >= n:
        raise ValueError("lag must satisfy 0 <= lag < n")
    e = v - v.mean()
    g0 = float(e @ e) / n
    if g0 == 0:
        return float(n)
    denom = 1.0
    for j in range(1, lag + 1):
        denom += 2.0 * (1.0 - j / (lag + 1.0)) * (float(e[j:] @ e[:-j]) / n) / g0
    if denom <= 0:
        return float(n)
    return float(min(max(n / denom, 1.0), n))


def n_eff(
    n_pairs: int,
    k: int,
    series: np.ndarray | list[float] | None = None,
    lag: int | None = None,
) -> float:
    """Effective number of independent (origin, outcome) pairs (A2 QNT-172; FR-SCORE-08).

    Non-overlapping windows: overlapping h-period outcomes of k i.i.d. steps have lag-j
    autocorrelation 1 − j/k, so n_eff = n / (1 + 2 Σ_{j<k} (1 − j/k)) = n / k, with k the
    horizon in origin units (k = ceil(h/21) at monthly origins). If ``series`` (a per-origin
    score or score-differential series) is given, the reported value is
    min(n/k, n_eff_autocorr(series, lag)), with lag defaulting to the HAC lag k − 1.
    """
    if n_pairs < 0:
        raise ValueError("n_pairs must be >= 0")
    k = hac_lag(k) + 1
    base = float(n_pairs) / k
    if series is None:
        return base
    lag = k - 1 if lag is None else int(lag)
    return float(min(base, n_eff_autocorr(series, lag)))


# ------------------------------------------------------------------ minimum detectable effect


def _z_sum(alpha: float, power: float) -> float:
    if not (0 < alpha < 1 and 0 < power < 1):
        raise ValueError("alpha and power must lie in (0, 1)")
    return float(stats.norm.ppf(1.0 - alpha / 2.0) + stats.norm.ppf(power))


def mde_location(
    sigma_h: float | np.ndarray,
    n_eff: float | np.ndarray,
    alpha: float = 0.05,
    power: float = 0.8,
) -> float | np.ndarray:
    """Minimum detectable location shift in the mean h-period log return (A5 §2.6).

    MDE = (z_{1−α/2} + z_{power}) · σ_h · sqrt(4 / n_eff)

    for a signal that splits time into two equally frequent states (difference in means of two
    groups of n_eff/2 independent observations; two-sided level α, given power; Cohen 1988).
    With α = 0.05 and power 0.8 the multiplier is 2.80, so σ_h = 0.30 and n_eff = 42 give
    MDE ≈ 0.26 (A5 §2.6 table). σ_h = σ·sqrt(h/252) is the h-period return volatility.
    """
    s = np.asarray(sigma_h, dtype=float)
    m = np.asarray(n_eff, dtype=float)
    if np.any(s < 0) or np.any(m <= 0):
        raise ValueError("sigma_h must be >= 0 and n_eff > 0")
    out = _z_sum(alpha, power) * s * np.sqrt(4.0 / m)
    return float(out) if out.ndim == 0 else out


def mde_crpss(
    loss_model: np.ndarray | list[float],
    loss_ref: np.ndarray | list[float],
    k: int,
    alpha: float = 0.05,
    power: float = 0.8,
) -> float:
    """Minimum detectable skill (CRPSS units) for the observed loss series.

    With d_t = L^model_t − L^ref_t and the HAC standard error of d̄ (Bartlett, lag k − 1 in
    origin units; Newey & West 1987), CRPSS ≈ −d̄ / mean(L_ref), so

        MDE_CRPSS = (z_{1−α/2} + z_{power}) · sqrt(Ω̂_HAC / n) / mean(L_ref)

    is the smallest |CRPSS| a two-sided level-α normal test detects with the given power
    (normal approximation; Cohen 1988; Diebold & Mariano 1995).
    """
    lm = np.asarray(loss_model, dtype=float).ravel()
    lr = np.asarray(loss_ref, dtype=float).ravel()
    if lm.shape != lr.shape:
        raise ValueError("loss series must have equal length (common support)")
    omega = hac_variance(lm - lr, hac_lag(k))
    return _z_sum(alpha, power) * float(np.sqrt(omega / lm.size)) / float(lr.mean())


# -------------------------------------------------------------------------- evidence grade


@dataclass(frozen=True)
class GradeThresholds:
    """Thresholds of the A2 QNT-175 rubric ([ASSUMPTION] values; research-policy defaults)."""

    n_eff_a: float = 100.0
    n_eff_b: float = 40.0
    n_eff_c: float = 20.0
    dm_p_a: float = 0.05
    dm_p_b: float = 0.10
    bh_q_a: float = 0.10
    coverage_nominal: float = 0.80
    coverage_tol_ab: float = 0.10
    coverage_tol_c: float = 0.15


QNT175 = GradeThresholds()

_EPS = 1e-12


def evidence_grade(
    *,
    n_eff: float,
    crpss: float,
    crpss_ci: tuple[float, float],
    dm_p_two_sided: float,
    dm_stat: float,
    bh_q: float | None,
    coverage80: float,
    holdout_crpss: float | None = None,
    holdout_crpss_ci: tuple[float, float] | None = None,
    thresholds: GradeThresholds = QNT175,
) -> tuple[str, list[str]]:
    """Evidence grade A–D for one analyzer × horizon (A2 QNT-175; FR-SCORE-09).

    Rubric (validation + development, common support; thresholds from ``thresholds``):

    * **A**: n_eff ≥ 100; CRPSS 90% CI excludes 0 (lower bound > 0); HLN-DM p < 0.05;
      BH q < 0.10; holdout CRPSS > 0 (if revealed); 80% coverage within ±10 pp.
    * **B**: n_eff ≥ 40; HLN-DM p < 0.10; holdout not significantly negative (if revealed: the
      holdout CRPSS CI upper bound is ≥ 0); 80% coverage within ±10 pp.
    * **C**: n_eff ≥ 20; CRPSS point estimate > 0; 80% coverage within ±15 pp.
    * **D**: anything else.

    Conservative readings (documented choices): grades are cumulative (A also needs every
    B and C criterion, B every C criterion); "HLN-DM p" is the two-sided p-value **and** the
    statistic must favour the model (dm_stat < 0), i.e. one-sided p < threshold/2; a CI below
    zero does not "exclude 0" in the model's favour; a missing BH q-value fails the A
    criterion; NaN inputs fail their criterion; coverage bounds are inclusive. Holdout terms
    apply only when ``holdout_crpss`` (with its CI) is given. Returns (grade, reasons) where
    reasons lists the unmet criteria of the next grade up (or states that all A criteria hold).
    """
    t = thresholds
    if (holdout_crpss is None) != (holdout_crpss_ci is None):
        raise ValueError("give both holdout_crpss and holdout_crpss_ci, or neither")
    revealed = holdout_crpss is not None
    cov_err = abs(coverage80 - t.coverage_nominal)
    favours_model = dm_stat < 0

    c_rules = [
        (n_eff >= t.n_eff_c, f"n_eff {n_eff:.1f} < {t.n_eff_c:g}"),
        (crpss > 0, f"CRPSS point estimate {crpss:+.4f} is not > 0"),
        (
            cov_err <= t.coverage_tol_c + _EPS,
            f"80% coverage {coverage80:.1%} outside ±{t.coverage_tol_c * 100:.0f} pp",
        ),
    ]
    b_rules = [
        (n_eff >= t.n_eff_b, f"n_eff {n_eff:.1f} < {t.n_eff_b:g}"),
        (
            favours_model and dm_p_two_sided < t.dm_p_b,
            f"HLN-DM p {dm_p_two_sided:.3g} (stat {dm_stat:+.2f}) does not meet p < "
            f"{t.dm_p_b:g} in the model's favour",
        ),
        (
            not revealed or holdout_crpss_ci[1] >= 0,  # type: ignore[index]
            "holdout CRPSS significantly negative (CI upper bound < 0)",
        ),
        (
            cov_err <= t.coverage_tol_ab + _EPS,
            f"80% coverage {coverage80:.1%} outside ±{t.coverage_tol_ab * 100:.0f} pp",
        ),
    ]
    a_rules = [
        (n_eff >= t.n_eff_a, f"n_eff {n_eff:.1f} < {t.n_eff_a:g}"),
        (
            crpss_ci[0] > 0,
            f"CRPSS CI [{crpss_ci[0]:+.4f}, {crpss_ci[1]:+.4f}] does not exclude 0 from above",
        ),
        (
            favours_model and dm_p_two_sided < t.dm_p_a,
            f"HLN-DM p {dm_p_two_sided:.3g} (stat {dm_stat:+.2f}) does not meet p < "
            f"{t.dm_p_a:g} in the model's favour",
        ),
        (
            bh_q is not None and bh_q < t.bh_q_a,
            "BH q-value not available" if bh_q is None else f"BH q {bh_q:.3g} >= {t.bh_q_a:g}",
        ),
        (
            not revealed or holdout_crpss > 0,  # type: ignore[operator]
            f"holdout CRPSS {holdout_crpss} is not > 0",
        ),
        (
            cov_err <= t.coverage_tol_ab + _EPS,
            f"80% coverage {coverage80:.1%} outside ±{t.coverage_tol_ab * 100:.0f} pp",
        ),
    ]
    grade = "D"
    for name, rules in (("C", c_rules), ("B", b_rules), ("A", a_rules)):
        failed = [msg for ok, msg in rules if not bool(ok)]
        if failed:
            return grade, [f"not {name}: {msg}" for msg in failed]
        grade = name
    return grade, ["all A criteria met"]


# --------------------------------------------------------------- location / scale split


def location_scale_split(
    Q_model: np.ndarray, Q_ref: np.ndarray, y: np.ndarray | float
) -> dict[str, np.ndarray | float]:
    """Location / scale decomposition of CRPS skill (A2 QNT-145; FR-SCORE-14).

    F = model, B = reference, medians m and m^B. Hybrids: H(x) = F(x + m − m^B) (model shape
    re-centred on the reference median) and G(x) = B(x + m^B − m) (reference shape re-centred
    on the model median). The two orderings give

        scale-first:    S_B − S_F = (S_B − S_H) + (S_H − S_F)
        location-first: S_B − S_F = (S_B − S_G) + (S_G − S_F)

    with S = CRPS. Following FR-SCORE-14 the parts are averaged over both orderings
    (a Shapley split; Shapley 1953):

        location = ½[(S_H − S_F) + (S_B − S_G)],   scale = ½[(S_B − S_H) + (S_G − S_F)],

    so location + scale = total = S_B − S_F exactly (positive = model better). Returns per-origin
    arrays ``total``, ``location``, ``scale`` and the skill-score shares ``crpss``,
    ``crpss_location``, ``crpss_scale`` (each part's mean divided by mean S_B; they add up).
    """
    Qf = np.atleast_2d(np.asarray(Q_model, dtype=float))
    Qb = np.atleast_2d(np.asarray(Q_ref, dtype=float))
    Qf, Qb = np.broadcast_arrays(Qf, Qb)
    shift = Qf[:, MEDIAN_INDEX : MEDIAN_INDEX + 1] - Qb[:, MEDIAN_INDEX : MEDIAN_INDEX + 1]
    s_f = crps(Qf, y)
    s_b = crps(Qb, y)
    s_h = crps(Qf - shift, y)
    s_g = crps(Qb + shift, y)
    total = s_b - s_f
    location = 0.5 * ((s_h - s_f) + (s_b - s_g))
    scale = 0.5 * ((s_b - s_h) + (s_g - s_f))
    ref_mean = float(s_b.mean())
    return {
        "total": total,
        "location": location,
        "scale": scale,
        "crpss": float(total.mean()) / ref_mean,
        "crpss_location": float(location.mean()) / ref_mean,
        "crpss_scale": float(scale.mean()) / ref_mean,
    }
