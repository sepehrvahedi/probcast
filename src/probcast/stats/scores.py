"""Proper scores for the contract's quantile-grid predictive distribution (A2 §5, QNT-130…140).

The predictive distribution is the CONTRACT v1.1 object of :mod:`probcast.contract.distribution`:
23 quantiles ``q_1 < … < q_K`` at levels ``τ_1 … τ_K`` (K = 23), a piecewise-linear CDF between
the knots and exponential tails that carry 1% of the mass on each side,

    F(x)     = 0.01 · exp((x − q_1) / b_L)      for x < q_1,   b_L = (q_2 − q_1) / ln 2.5
    1 − F(x) = 0.01 · exp(−(x − q_K) / b_R)     for x > q_K,   b_R = (q_K − q_{K−1}) / ln 2.5.

Every score is negatively oriented (lower is better) and vectorised: ``Q`` has shape (n, 23) or
(23,), ``y`` is a scalar or has shape (n,). A single quantile row broadcasts against many ``y``.
Scores never validate the plausibility bounds of the contract (that is the engine's job); they
only require finite, non-decreasing rows with strictly positive outer spacings.
"""

from __future__ import annotations

import numpy as np

from probcast.contract.distribution import InvalidForecast, tail_scales
from probcast.contract.grid import MEDIAN_INDEX, N_QUANTILES, TAUS

__all__ = [
    "brier",
    "covered",
    "crps",
    "interval_bounds",
    "log_score",
    "pdf",
    "pinball",
    "pit",
    "skill_score",
    "wis",
]

#: Probability mass in each exponential tail (contract §2: TAUS[0] = 1 − TAUS[-1] = 0.01).
_TAIL = 0.01
#: Number of central intervals on the grid (median + K intervals; Bracher et al. 2021).
N_INTERVALS = MEDIAN_INDEX
#: Central-interval miss levels α_k of the grid: 0.02, 0.05, 0.10, 0.20, …, 0.90.
INTERVAL_ALPHAS: np.ndarray = 2.0 * TAUS[:MEDIAN_INDEX]


def _prep(Q: np.ndarray, y: np.ndarray | float) -> tuple[np.ndarray, np.ndarray]:
    """Return (Q of shape (n, 23), y of shape (n,)) after light structural checks."""
    Q = np.asarray(Q, dtype=float)
    if Q.ndim == 1:
        Q = Q[None, :]
    if Q.ndim != 2 or Q.shape[1] != N_QUANTILES:
        raise InvalidForecast(f"expected quantile rows of length {N_QUANTILES}, got {Q.shape}")
    y = np.asarray(y, dtype=float)
    if y.ndim > 1:
        raise ValueError("y must be a scalar or a 1-D array")
    if Q.shape[0] == 1 and y.ndim == 1 and y.size > 1:
        Q = np.broadcast_to(Q, (y.size, N_QUANTILES))
    try:
        y = np.broadcast_to(y, (Q.shape[0],))
    except ValueError as exc:
        raise ValueError(f"cannot broadcast y {y.shape} against {Q.shape[0]} rows") from exc
    if not np.all(np.isfinite(Q)):
        raise InvalidForecast("non-finite quantile")
    if not np.all(np.isfinite(y)):
        raise ValueError("non-finite outcome")
    dq = np.diff(Q, axis=1)
    if np.any(dq < 0):
        raise InvalidForecast("quantiles must be non-decreasing")
    if np.any(dq[:, 0] <= 0) or np.any(dq[:, -1] <= 0):
        raise InvalidForecast("outer quantile spacings must be positive (tail scales)")
    return Q, y


def _segment(Q: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Number of knots ≤ y per row (0 = left tail, 23 = right tail; right-continuous)."""
    return (y[:, None] >= Q).sum(axis=1)


def pit(Q: np.ndarray, y: np.ndarray | float) -> np.ndarray:
    """Probability integral transform u = F(y) under the contract distribution, shape (n,).

    For a calibrated forecaster u ~ U(0, 1) (Dawid 1984; Diebold, Gunther & Tay 1998).
    Vectorised re-implementation of :func:`probcast.contract.distribution.cdf` (identical values).
    """
    Q, y = _prep(Q, y)
    b_l, b_r = tail_scales(Q)
    j = _segment(Q, y)
    out = np.empty(y.shape)
    lo = j == 0
    hi = j == N_QUANTILES
    mid = ~(lo | hi)
    out[lo] = _TAIL * np.exp((y[lo] - Q[lo, 0]) / b_l[lo])
    out[hi] = 1.0 - _TAIL * np.exp(-(y[hi] - Q[hi, -1]) / b_r[hi])
    if np.any(mid):
        r = np.nonzero(mid)[0]
        s = j[mid] - 1
        qa, qb = Q[r, s], Q[r, s + 1]
        out[mid] = TAUS[s] + (TAUS[s + 1] - TAUS[s]) * (y[mid] - qa) / (qb - qa)
    return out


def _log_pdf(Q: np.ndarray, y: np.ndarray) -> np.ndarray:
    b_l, b_r = tail_scales(Q)
    j = _segment(Q, y)
    out = np.empty(y.shape)
    lo = j == 0
    hi = j == N_QUANTILES
    mid = ~(lo | hi)
    ln_tail = np.log(_TAIL)
    out[lo] = ln_tail + (y[lo] - Q[lo, 0]) / b_l[lo] - np.log(b_l[lo])
    out[hi] = ln_tail - (y[hi] - Q[hi, -1]) / b_r[hi] - np.log(b_r[hi])
    if np.any(mid):
        r = np.nonzero(mid)[0]
        s = j[mid] - 1
        out[mid] = np.log(TAUS[s + 1] - TAUS[s]) - np.log(Q[r, s + 1] - Q[r, s])
    return out


def pdf(Q: np.ndarray, y: np.ndarray | float) -> np.ndarray:
    """Density f(y) of the contract distribution, shape (n,).

    Body: f = (τ_{j+1} − τ_j)/(q_{j+1} − q_j) on [q_j, q_{j+1}); tails: f = F(y)/b_L below q_1
    and (1 − F(y))/b_R from q_K upward. The density is taken right-continuous at the knots.
    """
    Q, y = _prep(Q, y)
    return np.exp(_log_pdf(Q, y))


def log_score(Q: np.ndarray, y: np.ndarray | float) -> np.ndarray:
    """Logarithmic score LS(F, y) = −ln f(y), shape (n,) (A2 QNT-131).

    f is the density of the piecewise CDF (see :func:`pdf`); tails are evaluated in log space,
    so far-tail outcomes give large finite scores. Reference: Good (1952); Gneiting & Raftery
    (2007). Information gain vs a reference = mean(LS_ref) − mean(LS) nats per forecast.
    """
    Q, y = _prep(Q, y)
    return -_log_pdf(Q, y)


def crps(Q: np.ndarray, y: np.ndarray | float) -> np.ndarray:
    """Exact continuous ranked probability score of the contract distribution, shape (n,).

    CRPS(F, y) = ∫ (F(x) − 1{x ≥ y})² dx  (Matheson & Winkler 1976; Gneiting & Raftery 2007),
    evaluated in closed form piece by piece (no numerical integration):

    * body segment [a, b] = [q_j, q_{j+1}] with F linear from τ_j to τ_{j+1}; let
      c = clip(y, a, b), F_c = F(c), S = 1 − F. Then
      ∫ = (c − a)(τ_j² + τ_j F_c + F_c²)/3 + (b − c)(S_c² + S_c S_b + S_b²)/3;
    * left tail, T = 0.01, c = min(y, q_1), F_c = T·exp((c − q_1)/b_L):
      ∫_{−∞}^{q_1} = b_L T²/2 + (q_1 − c) − 2 b_L (T − F_c);
    * right tail, c = max(y, q_K), S_c = T·exp(−(c − q_K)/b_R):
      ∫_{q_K}^{∞} = b_R T²/2 + (c − q_K) − 2 b_R (T − S_c).

    (The tail terms use ∫F dx = b·F and ∫F² dx = (b/2)·F² for an exponential tail.)
    Verified against high-resolution numerical integration of the same object to 1e-9
    (NFR-SCI-09 (a)).
    """
    Q, y = _prep(Q, y)
    b_l, b_r = tail_scales(Q)
    q_lo, q_hi = Q[:, 0], Q[:, -1]

    c = np.minimum(y, q_lo)
    f_c = _TAIL * np.exp((c - q_lo) / b_l)
    left = 0.5 * b_l * _TAIL**2 + (q_lo - c) - 2.0 * b_l * (_TAIL - f_c)

    c = np.maximum(y, q_hi)
    s_c = _TAIL * np.exp(-(c - q_hi) / b_r)
    right = 0.5 * b_r * _TAIL**2 + (c - q_hi) - 2.0 * b_r * (_TAIL - s_c)

    a, b = Q[:, :-1], Q[:, 1:]
    ta, tb = TAUS[:-1], TAUS[1:]
    c = np.clip(y[:, None], a, b)
    dq = b - a
    frac = np.divide(c - a, dq, out=np.zeros_like(dq), where=dq > 0)
    f_c = ta + (tb - ta) * frac
    s_c, s_b = 1.0 - f_c, 1.0 - tb
    below = (c - a) * (ta**2 + ta * f_c + f_c**2) / 3.0
    above = (b - c) * (s_c**2 + s_c * s_b + s_b**2) / 3.0
    body = (below + above).sum(axis=1)
    return left + body + right


def pinball(Q: np.ndarray, y: np.ndarray | float) -> np.ndarray:
    """Quantile (pinball) loss per level, shape (n, 23) (A2 QNT-133).

    QL_τ = ρ_τ(y − q_τ) with ρ_τ(u) = u·(τ − 1{u < 0}) (Koenker & Bassett 1978).
    2 × mean over the 23 levels equals the WIS on this grid and ``scoringrules.crps_quantile``.
    """
    Q, y = _prep(Q, y)
    u = y[:, None] - Q
    return u * (TAUS[None, :] - (u < 0))


def wis(Q: np.ndarray, y: np.ndarray | float) -> np.ndarray:
    """Weighted interval score on the 23-quantile grid, shape (n,) (A2 QNT-133).

    WIS = (½|y − m| + Σ_k (α_k/2)·IS_{α_k}) / (K + ½), K = 11, α_k ∈ {0.02, 0.05, 0.1, …, 0.9},
    IS_α = (u − l) + (2/α)(l − y)·1{y < l} + (2/α)(y − u)·1{y > u}
    (Gneiting & Raftery 2007; Bracher, Ray, Gneiting & Reich 2021). On this grid it equals
    2 × the mean pinball loss over the 23 levels.
    """
    Q, y = _prep(Q, y)
    m = Q[:, MEDIAN_INDEX]
    lower = Q[:, :N_INTERVALS]
    upper = Q[:, ::-1][:, :N_INTERVALS]
    alpha = INTERVAL_ALPHAS[None, :]
    yy = y[:, None]
    interval = (
        (upper - lower)
        + (2.0 / alpha) * (lower - yy) * (yy < lower)
        + (2.0 / alpha) * (yy - upper) * (yy > upper)
    )
    total = 0.5 * np.abs(y - m) + (0.5 * alpha * interval).sum(axis=1)
    return total / (N_INTERVALS + 0.5)


def interval_bounds(Q: np.ndarray, level: float) -> tuple[np.ndarray, np.ndarray]:
    """Lower and upper quantiles of the central ``level`` interval (levels on the grid only)."""
    Q = np.asarray(Q, dtype=float)
    if Q.ndim == 1:
        Q = Q[None, :]
    if not 0.0 < level < 1.0:
        raise ValueError("level must lie in (0, 1)")
    tau_lo = (1.0 - level) / 2.0
    hits = np.nonzero(np.isclose(TAUS, tau_lo, rtol=0.0, atol=1e-12))[0]
    if hits.size != 1 or hits[0] >= MEDIAN_INDEX:
        raise ValueError(f"central {level:.0%} interval is not on the quantile grid")
    i = int(hits[0])
    return Q[:, i], Q[:, N_QUANTILES - 1 - i]


def covered(Q: np.ndarray, y: np.ndarray | float, level: float) -> np.ndarray:
    """Coverage indicator 1{l ≤ y ≤ u} of the central ``level`` interval, bool (n,) (QNT-135).

    level ∈ {0.5, 0.8, 0.9, 0.95} (also 0.98 and the other grid-symmetric levels):
    0.5 → [q_0.25, q_0.75], 0.8 → [q_0.10, q_0.90], 0.9 → [q_0.05, q_0.95],
    0.95 → [q_0.025, q_0.975]. Endpoints count as covered.
    """
    Q, y = _prep(Q, y)
    lo, hi = interval_bounds(Q, level)
    return (lo <= y) & (y <= hi)


def brier(p: np.ndarray | float, o: np.ndarray | float) -> np.ndarray:
    """Brier score (p − o)² per forecast, shape (n,) (Brier 1950; A2 QNT-140).

    ``p`` are probabilities in [0, 1]; ``o`` are binary outcomes (bool or 0/1).
    """
    p = np.atleast_1d(np.asarray(p, dtype=float))
    o = np.atleast_1d(np.asarray(o, dtype=float))
    if np.any(~np.isfinite(p)) or np.any((p < 0) | (p > 1)):
        raise ValueError("probabilities must lie in [0, 1]")
    if np.any((o != 0) & (o != 1)):
        raise ValueError("outcomes must be binary")
    p, o = np.broadcast_arrays(p, o)
    return (p - o) ** 2


def skill_score(loss_model: np.ndarray, loss_ref: np.ndarray) -> float:
    """Skill score 1 − mean(loss_model) / mean(loss_ref) (e.g. CRPSS, BSS; A2 QNT-134).

    0 = no better than the reference, 1 = perfect, < 0 = worse (Murphy 1973; Gneiting &
    Raftery 2007). Inputs must be the same origins (common support, QNT-106).
    """
    lm = np.asarray(loss_model, dtype=float)
    lr = np.asarray(loss_ref, dtype=float)
    if lm.shape != lr.shape or lm.size == 0:
        raise ValueError("losses must be non-empty and of equal shape")
    return float(1.0 - lm.mean() / lr.mean())
