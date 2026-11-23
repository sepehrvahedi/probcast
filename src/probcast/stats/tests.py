"""Hypothesis tests: HAC variance, HLN-corrected Diebold–Mariano, Pesaran–Timmermann, BH-FDR.

A2 QNT-148 (Pesaran–Timmermann), QNT-151 (Diebold–Mariano + HLN), QNT-165 (FDR), QNT-171 (HAC).
Lag units follow CRT-A-017 / FR-SCORE-05: the HAC lag is expressed in **origin units**,
lag = k − 1 with k = ceil(h / 21) for monthly origins (0 at h ≤ 21, 2 at 63, 5 at 126,
11 at 252).
"""

from __future__ import annotations

from typing import Literal

import numpy as np
from scipy import stats

from probcast.contract.grid import origin_steps

__all__ = [
    "benjamini_hochberg",
    "bh_qvalues",
    "dm_test_hln",
    "hac_lag",
    "hac_lag_for_horizon",
    "hac_variance",
    "pesaran_timmermann",
]


def hac_lag(k: int) -> int:
    """HAC truncation lag for an overlap of ``k`` origin steps: L = max(0, k − 1)."""
    k = int(k)
    if k < 1:
        raise ValueError("k (horizon in origin units) must be >= 1")
    return k - 1


def hac_lag_for_horizon(horizon: int) -> int:
    """HAC lag for a horizon in sessions at monthly origins: ceil(h/21) − 1 (FR-SCORE-05)."""
    return hac_lag(origin_steps(horizon))


def hac_variance(d: np.ndarray | list[float], lag: int) -> float:
    """Newey–West long-run variance of a series with Bartlett weights (Newey & West 1987).

    Ω̂ = γ̂_0 + 2 Σ_{j=1}^{L} (1 − j/(L+1)) γ̂_j,   γ̂_j = (1/n) Σ_{t=j+1}^{n} (d_t − d̄)(d_{t−j} − d̄).

    Ω̂ ≥ 0 by construction. The variance of the sample mean is Var(d̄) ≈ Ω̂ / n (A2 QNT-151).
    """
    x = np.asarray(d, dtype=float).ravel()
    n = x.size
    lag = int(lag)
    if n < 2:
        raise ValueError("need at least two observations")
    if not np.all(np.isfinite(x)):
        raise ValueError("non-finite values")
    if lag < 0 or lag >= n:
        raise ValueError("lag must satisfy 0 <= lag < n")
    e = x - x.mean()
    omega = float(e @ e) / n
    for j in range(1, lag + 1):
        omega += 2.0 * (1.0 - j / (lag + 1.0)) * float(e[j:] @ e[:-j]) / n
    return max(omega, 0.0)


def dm_test_hln(
    loss_model: np.ndarray | list[float], loss_ref: np.ndarray | list[float], k: int
) -> dict[str, float | int]:
    """Diebold–Mariano test with the Harvey–Leybourne–Newbold correction (A2 QNT-151).

    d_t = L^model_t − L^ref_t,  DM = d̄ / sqrt(Ω̂_HAC(L)/n),  L = k − 1 (origin units),

        DM* = DM · sqrt((n + 1 − 2k + k(k − 1)/n) / n)  ~  t_{n−1}

    (Diebold & Mariano 1995; Harvey, Leybourne & Newbold 1997; Newey & West 1987 Bartlett
    weights). Negative DM* means the model has lower loss. Returns ``stat`` (DM*),
    ``p_two_sided``, ``p_model_better`` (one-sided, H1: E[d] < 0), ``n``, ``lag``, ``k``,
    ``mean_diff`` (d̄), ``hln_factor``. A zero HAC variance gives stat 0 when d̄ = 0, else ±inf.
    """
    lm = np.asarray(loss_model, dtype=float).ravel()
    lr = np.asarray(loss_ref, dtype=float).ravel()
    if lm.shape != lr.shape:
        raise ValueError("loss series must have equal length (common support)")
    d = lm - lr
    n = d.size
    lag = hac_lag(k)
    k = lag + 1
    omega = hac_variance(d, lag)
    radicand = (n + 1 - 2 * k + k * (k - 1) / n) / n
    if radicand <= 0:
        raise ValueError(f"HLN correction undefined for n = {n}, k = {k}")
    factor = float(np.sqrt(radicand))
    d_bar = float(d.mean())
    # a constant differential leaves only rounding noise in Ω̂: treat it as zero variance
    if omega > (64.0 * np.finfo(float).eps * float(np.max(np.abs(d)))) ** 2:
        stat = d_bar / np.sqrt(omega / n) * factor
    else:
        stat = 0.0 if d_bar == 0 else float(np.copysign(np.inf, d_bar))
    df = n - 1
    return {
        "stat": float(stat),
        "p_two_sided": float(2.0 * stats.t.sf(abs(stat), df)),
        "p_model_better": float(stats.t.cdf(stat, df)),
        "n": int(n),
        "lag": int(lag),
        "k": int(k),
        "mean_diff": d_bar,
        "hln_factor": factor,
    }


def pesaran_timmermann(
    pred_up: np.ndarray | list[bool], actual_up: np.ndarray | list[bool]
) -> dict[str, float | int]:
    """Pesaran–Timmermann (1992) test of directional accuracy (A2 QNT-148).

    P̂ = hit rate, P̂_y = mean(actual_up), P̂_x = mean(pred_up),
    P* = P̂_y P̂_x + (1 − P̂_y)(1 − P̂_x),  V̂(P̂) = P*(1 − P*)/n,
    V̂(P*) = (2P̂_y − 1)² P̂_x(1 − P̂_x)/n + (2P̂_x − 1)² P̂_y(1 − P̂_y)/n
            + 4 P̂_y P̂_x (1 − P̂_y)(1 − P̂_x)/n²,
    PT = (P̂ − P*) / sqrt(V̂(P̂) − V̂(P*))  ~a  N(0, 1).

    Returns ``stat``, ``p_value`` (one-sided, H1: positive dependence), ``p_two_sided``,
    ``hit_rate``, ``p_star``, ``n``. When the variance difference is zero (e.g. an "always up"
    forecaster) and P̂ = P*, PT = 0 by convention (p_value 0.5); with a non-positive variance
    otherwise, the statistic is NaN. Assumes independent pairs: with overlapping horizons use
    a non-overlapping sub-series (QNT-171).
    """
    x = np.asarray(pred_up).astype(bool).ravel()
    y = np.asarray(actual_up).astype(bool).ravel()
    if x.shape != y.shape or x.size < 2:
        raise ValueError("need two equal-length series with at least two observations")
    n = x.size
    p_hat = float(np.mean(x == y))
    py = float(y.mean())
    px = float(x.mean())
    p_star = py * px + (1 - py) * (1 - px)
    v_hat = p_star * (1 - p_star) / n
    v_star = (
        (2 * py - 1) ** 2 * px * (1 - px) / n
        + (2 * px - 1) ** 2 * py * (1 - py) / n
        + 4 * py * px * (1 - py) * (1 - px) / n**2
    )
    denom = v_hat - v_star
    num = p_hat - p_star
    if denom > 1e-15:
        stat = num / np.sqrt(denom)
    elif abs(num) <= 1e-12:
        stat = 0.0
    else:
        stat = float("nan")
    return {
        "stat": float(stat),
        "p_value": float(stats.norm.sf(stat)),
        "p_two_sided": float(2.0 * stats.norm.sf(abs(stat))),
        "hit_rate": p_hat,
        "p_star": float(p_star),
        "n": int(n),
    }


def _pvalues(pvalues: np.ndarray | list[float]) -> np.ndarray:
    p = np.asarray(pvalues, dtype=float).ravel()
    if np.any(~np.isfinite(p)) or np.any((p < 0) | (p > 1)):
        raise ValueError("p-values must lie in [0, 1]")
    return p


def _by_constant(m: int, method: str) -> float:
    if method == "bh":
        return 1.0
    if method == "by":
        return float(np.sum(1.0 / np.arange(1, m + 1)))
    raise ValueError("method must be 'bh' or 'by'")


def benjamini_hochberg(
    pvalues: np.ndarray | list[float], q: float = 0.10, *, method: Literal["bh", "by"] = "bh"
) -> np.ndarray:
    """False-discovery-rate rejections, bool array in input order (A2 QNT-165).

    Sort p_(1) ≤ … ≤ p_(m); reject H_(1) … H_(i*) with i* = max{i : p_(i) ≤ i·q/(m·c(m))}
    (Benjamini & Hochberg 1995: c(m) = 1; ``method="by"``: Benjamini & Yekutieli 2001,
    c(m) = Σ_{j=1}^{m} 1/j, valid under arbitrary dependence).
    """
    p = _pvalues(pvalues)
    m = p.size
    reject = np.zeros(m, dtype=bool)
    if m == 0:
        return reject
    order = np.argsort(p, kind="stable")
    thresholds = np.arange(1, m + 1) * q / (m * _by_constant(m, method))
    ok = np.nonzero(p[order] <= thresholds)[0]
    if ok.size:
        reject[order[: ok[-1] + 1]] = True
    return reject


def bh_qvalues(
    pvalues: np.ndarray | list[float], *, method: Literal["bh", "by"] = "bh"
) -> np.ndarray:
    """BH (or BY) adjusted p-values ("q-values"), in input order (A2 QNT-165).

    q_(i) = min_{j ≥ i} min(1, m·c(m)·p_(j)/j). H_i is rejected at FDR level q iff q_i ≤ q,
    matching :func:`benjamini_hochberg` (Benjamini & Hochberg 1995; Yekutieli & Benjamini 1999).
    """
    p = _pvalues(pvalues)
    m = p.size
    if m == 0:
        return p.copy()
    order = np.argsort(p, kind="stable")
    ranked = p[order] * m * _by_constant(m, method) / np.arange(1, m + 1)
    adjusted = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(m)
    out[order] = np.minimum(adjusted, 1.0)
    return out
