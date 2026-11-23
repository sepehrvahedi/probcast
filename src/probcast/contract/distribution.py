"""Quantile-grid predictive distributions (contract §2; A2 QNT-074/075/087).

A forecast is 23 quantiles of the forward log total return. Between quantiles the CDF is
piecewise linear (uniform density). Beyond the outer quantiles the tails are exponential and
matched to the outermost interval, so the density is positive everywhere:

    F(x) = 0.01 * exp((x - q_lo) / b_L)            for x < q_lo,  b_L = (q_2 - q_1) / ln 2.5
    1 - F(x) = 0.01 * exp(-(x - q_hi) / b_R)       for x > q_hi,  b_R = (q_23 - q_22) / ln 2.5

All functions are vectorised: ``Q`` has shape (n, 23) or (23,).
"""

from __future__ import annotations

import numpy as np

from probcast.contract.grid import (
    LOG_RETURN_LOWER,
    LOG_RETURN_UPPER,
    MEDIAN_INDEX,
    N_QUANTILES,
    TAUS,
)

_LN25 = float(np.log(2.5))
_TAIL = 0.01


class InvalidForecast(ValueError):
    """Raised when quantiles violate the contract's validity rules."""


def _as2d(Q: np.ndarray) -> np.ndarray:
    Q = np.asarray(Q, dtype=float)
    if Q.ndim == 1:
        Q = Q[None, :]
    if Q.shape[-1] != N_QUANTILES:
        raise InvalidForecast(f"expected {N_QUANTILES} quantiles, got {Q.shape[-1]}")
    return Q


def tail_scales(Q: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    Q = _as2d(Q)
    b_left = (Q[:, 1] - Q[:, 0]) / _LN25
    b_right = (Q[:, -1] - Q[:, -2]) / _LN25
    return b_left, b_right


def validate(Q: np.ndarray, *, fix_ties: bool = True) -> np.ndarray:
    """Validate (and minimally repair) quantile rows. Returns a float array of shape (n, 23).

    Rules (contract §2): finite; strictly increasing (crossings larger than 1% of the
    5-95% width are an error, smaller ones are sorted and tie-broken by 1e-9); log-return
    bounds; positive 5-95% width.
    """
    Q = _as2d(Q).copy()
    if not np.all(np.isfinite(Q)):
        raise InvalidForecast("non-finite quantile")
    width = Q[:, 20] - Q[:, 2]
    if np.any(width <= 0):
        raise InvalidForecast("non-positive 5-95% width")
    diffs = np.diff(Q, axis=1)
    crossing = np.clip(-diffs, 0, None).max(axis=1)
    if np.any(crossing > 0.01 * width):
        raise InvalidForecast("quantile crossing larger than 1% of the 5-95% width")
    if np.any(diffs <= 0):
        if not fix_ties:
            raise InvalidForecast("quantiles not strictly increasing")
        Q = np.sort(Q, axis=1)
        for j in range(1, N_QUANTILES):
            Q[:, j] = np.maximum(Q[:, j], Q[:, j - 1] + 1e-9)
    if np.any(Q[:, 0] <= LOG_RETURN_LOWER) or np.any(Q[:, -1] >= LOG_RETURN_UPPER):
        raise InvalidForecast("quantile outside plausibility bounds")
    return Q


def cdf(Q: np.ndarray, x: np.ndarray | float) -> np.ndarray:
    """F(x) for each row of Q. ``x`` broadcasts against rows (scalar or shape (n,))."""
    Q = _as2d(Q)
    n = Q.shape[0]
    x = np.broadcast_to(np.asarray(x, dtype=float), (n,)).copy()
    b_l, b_r = tail_scales(Q)
    out = np.empty(n)
    lo = x < Q[:, 0]
    hi = x > Q[:, -1]
    mid = ~(lo | hi)
    out[lo] = _TAIL * np.exp((x[lo] - Q[lo, 0]) / b_l[lo])
    out[hi] = 1.0 - _TAIL * np.exp(-(x[hi] - Q[hi, -1]) / b_r[hi])
    if np.any(mid):
        idx = np.nonzero(mid)[0]
        for i in idx:
            out[i] = np.interp(x[i], Q[i], TAUS)
    return out


def ppf(Q: np.ndarray, tau: np.ndarray | float) -> np.ndarray:
    """Quantile function. ``tau`` may be scalar or an array of levels (returns (n, len(tau)))."""
    Q = _as2d(Q)
    taus = np.atleast_1d(np.asarray(tau, dtype=float))
    b_l, b_r = tail_scales(Q)
    out = np.empty((Q.shape[0], taus.size))
    for k, t in enumerate(taus):
        if t < TAUS[0]:
            out[:, k] = Q[:, 0] + b_l * np.log(t / _TAIL)
        elif t > TAUS[-1]:
            out[:, k] = Q[:, -1] - b_r * np.log((1.0 - t) / _TAIL)
        else:
            out[:, k] = np.array([np.interp(t, TAUS, row) for row in Q])
    return out if np.ndim(tau) else out[:, 0]


def median(Q: np.ndarray) -> np.ndarray:
    return _as2d(Q)[:, MEDIAN_INDEX]


def mean(Q: np.ndarray) -> np.ndarray:
    """E[y] under the piecewise distribution."""
    Q = _as2d(Q)
    b_l, b_r = tail_scales(Q)
    dtau = np.diff(TAUS)
    body = ((Q[:, 1:] + Q[:, :-1]) / 2.0 * dtau).sum(axis=1)
    return body + _TAIL * (Q[:, 0] - b_l) + _TAIL * (Q[:, -1] + b_r)


def mean_exp(Q: np.ndarray) -> np.ndarray:
    """E[exp(y)]: expected gross simple return. Requires right-tail scale b_R < 1."""
    Q = _as2d(Q)
    b_l, b_r = tail_scales(Q)
    if np.any(b_r >= 1.0):
        raise InvalidForecast("right tail too heavy for a finite E[exp(y)]")
    dtau = np.diff(TAUS)
    dq = np.diff(Q, axis=1)
    seg = dtau * (np.exp(Q[:, 1:]) - np.exp(Q[:, :-1])) / dq
    body = seg.sum(axis=1)
    return body + _TAIL * np.exp(Q[:, 0]) / (1.0 + b_l) + _TAIL * np.exp(Q[:, -1]) / (1.0 - b_r)


def prob_greater(Q: np.ndarray, x: np.ndarray | float) -> np.ndarray:
    """P(y > x)."""
    return 1.0 - cdf(Q, x)


def p_up(Q: np.ndarray) -> np.ndarray:
    """P(total return > 0) = 1 - F(0). Derived, never self-reported (contract §1.2)."""
    return prob_greater(Q, 0.0)


def width80(Q: np.ndarray) -> np.ndarray:
    Q = _as2d(Q)
    return Q[:, 19] - Q[:, 3]


def shift(Q: np.ndarray, delta: np.ndarray | float) -> np.ndarray:
    Q = _as2d(Q)
    return Q + np.asarray(delta, dtype=float).reshape(-1, 1)


def scale_about_median(Q: np.ndarray, factor: np.ndarray | float) -> np.ndarray:
    Q = _as2d(Q)
    m = Q[:, MEDIAN_INDEX : MEDIAN_INDEX + 1]
    return m + np.asarray(factor, dtype=float).reshape(-1, 1) * (Q - m)


def from_samples(samples: np.ndarray) -> np.ndarray:
    """Empirical quantiles (Hyndman & Fan type 7) of shape (23,) from 1-D samples."""
    s = np.asarray(samples, dtype=float)
    s = s[np.isfinite(s)]
    if s.size < 50:
        raise InvalidForecast("need at least 50 samples")
    return np.quantile(s, TAUS)


def from_normal(loc: np.ndarray | float, scale: np.ndarray | float) -> np.ndarray:
    from scipy.stats import norm

    loc = np.atleast_1d(np.asarray(loc, dtype=float))
    scale = np.atleast_1d(np.asarray(scale, dtype=float))
    z = norm.ppf(TAUS)
    return loc[:, None] + scale[:, None] * z[None, :]


def interpolate_horizon(
    horizons: list[int] | tuple[int, ...], Qs: np.ndarray, h_target: float
) -> np.ndarray:
    """Quantiles at an intermediate (or extrapolated) horizon (A2 QNT-087).

    Median linear in h, squared 80% width linear in h, standardised shape linear in h.
    ``Qs`` has shape (len(horizons), 23) for one origin. Outside the anchor range the two
    nearest anchors are used for linear extrapolation (labelled "extrapolated" by callers).
    """
    hs = np.asarray(horizons, dtype=float)
    Qs = _as2d(Qs)
    if hs.size != Qs.shape[0]:
        raise ValueError("one quantile row per horizon required")
    order = np.argsort(hs)
    hs, Qs = hs[order], Qs[order]
    if h_target in hs:
        return Qs[int(np.nonzero(hs == h_target)[0][0])].copy()
    j = int(np.searchsorted(hs, h_target))
    j = min(max(j, 1), hs.size - 1)
    h1, h2 = hs[j - 1], hs[j]
    w = (h_target - h1) / (h2 - h1)
    m1, m2 = Qs[j - 1, MEDIAN_INDEX], Qs[j, MEDIAN_INDEX]
    s1 = Qs[j - 1, 19] - Qs[j - 1, 3]
    s2 = Qs[j, 19] - Qs[j, 3]
    z1 = (Qs[j - 1] - m1) / s1
    z2 = (Qs[j] - m2) / s2
    m = m1 + w * (m2 - m1)
    s = float(np.sqrt(max(s1**2 + w * (s2**2 - s1**2), 1e-12)))
    z = z1 + w * (z2 - z1)
    return m + s * z
