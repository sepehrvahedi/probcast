"""Calibration diagnostics: binned reliability, PIT histogram, Murphy decomposition.

A2 QNT-136 (PIT histogram), QNT-140 (Brier score and Murphy decomposition), QNT-141
(classical 10-bin reliability diagram offered next to CORP). Binning convention for
probabilities and PIT values: K equal-width bins on [0, 1]; a value v falls in bin
⌊v·K⌋, and v = 1 falls in the last bin.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

__all__ = ["murphy_decomposition", "pit_histogram", "reliability_bins"]


def _unit_interval(v: np.ndarray | list[float], name: str) -> np.ndarray:
    v = np.asarray(v, dtype=float).ravel()
    if np.any(~np.isfinite(v)) or np.any((v < 0) | (v > 1)):
        raise ValueError(f"{name} must lie in [0, 1]")
    return v


def _binary(o: np.ndarray | list[float], n: int) -> np.ndarray:
    o = np.asarray(o, dtype=float).ravel()
    if o.size != n:
        raise ValueError("forecasts and outcomes must have the same length")
    if np.any((o != 0) & (o != 1)):
        raise ValueError("outcomes must be binary")
    return o


def _bin_index(v: np.ndarray, n_bins: int) -> np.ndarray:
    if n_bins < 1:
        raise ValueError("n_bins must be >= 1")
    return np.minimum(np.floor(v * n_bins).astype(int), n_bins - 1)


def reliability_bins(
    p: np.ndarray | list[float],
    o: np.ndarray | list[float],
    n_bins: int = 10,
    *,
    band_level: float = 0.90,
) -> pd.DataFrame:
    """Binned reliability table for probability forecasts (A2 QNT-140/141).

    For each of ``n_bins`` equal-width bins [lo, hi): ``count`` n_j, ``mean_p`` = p̄_j (mean
    forecast), ``freq`` = ō_j (observed frequency), and a consistency band [band_lo, band_hi]
    for ō_j under perfect reliability: the (1 ∓ band_level)/2 quantiles of Binomial(n_j, p̄_j)/n_j
    (Bröcker & Smith 2007, binomial approximation; valid for serially independent pairs).
    Empty bins have count 0 and NaN statistics. Σ count = n.
    """
    p = _unit_interval(p, "p")
    o = _binary(o, p.size)
    idx = _bin_index(p, n_bins)
    count = np.bincount(idx, minlength=n_bins).astype(int)
    sum_p = np.bincount(idx, weights=p, minlength=n_bins)
    sum_o = np.bincount(idx, weights=o, minlength=n_bins)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean_p = np.where(count > 0, sum_p / count, np.nan)
        freq = np.where(count > 0, sum_o / count, np.nan)
    tail = (1.0 - band_level) / 2.0
    safe_n = np.maximum(count, 1)
    safe_p = np.nan_to_num(mean_p)
    band_lo = np.where(count > 0, stats.binom.ppf(tail, safe_n, safe_p) / safe_n, np.nan)
    band_hi = np.where(count > 0, stats.binom.ppf(1.0 - tail, safe_n, safe_p) / safe_n, np.nan)
    edges = np.arange(n_bins + 1) / n_bins
    return pd.DataFrame(
        {
            "lo": edges[:-1],
            "hi": edges[1:],
            "mean_p": mean_p,
            "freq": freq,
            "count": count,
            "band_lo": band_lo,
            "band_hi": band_hi,
        }
    )


def pit_histogram(
    u: np.ndarray | list[float], n_bins: int = 10, *, band_level: float = 0.90
) -> pd.DataFrame:
    """PIT histogram table (Dawid 1984; Diebold, Gunther & Tay 1998; A2 QNT-136).

    Columns: ``lo``, ``hi``, ``count``, ``freq`` = count/n, ``density`` = freq·K (1 under
    uniformity), and a uniform-null band [band_lo, band_hi] in density units from the
    (1 ∓ band_level)/2 quantiles of Binomial(n, 1/K). The band assumes independent PIT values:
    for h > 21 sessions use the non-overlapping sub-series (QNT-171), as overlapping PIT values
    are serially dependent even under perfect calibration.
    """
    u = _unit_interval(u, "PIT values")
    n = u.size
    if n == 0:
        raise ValueError("no PIT values")
    idx = _bin_index(u, n_bins)
    count = np.bincount(idx, minlength=n_bins).astype(int)
    freq = count / n
    tail = (1.0 - band_level) / 2.0
    p0 = 1.0 / n_bins
    lo_c = stats.binom.ppf(tail, n, p0)
    hi_c = stats.binom.ppf(1.0 - tail, n, p0)
    edges = np.arange(n_bins + 1) / n_bins
    return pd.DataFrame(
        {
            "lo": edges[:-1],
            "hi": edges[1:],
            "count": count,
            "freq": freq,
            "density": freq * n_bins,
            "band_lo": np.full(n_bins, lo_c / n * n_bins),
            "band_hi": np.full(n_bins, hi_c / n * n_bins),
        }
    )


def murphy_decomposition(
    p: np.ndarray | list[float], o: np.ndarray | list[float], n_bins: int = 10
) -> dict[str, float]:
    """Murphy (1973) decomposition of the Brier score with within-bin terms (A2 QNT-140).

    With bins j of size n_j, mean forecast p̄_j, hit frequency ō_j and base rate ō:

        REL = (1/n) Σ_j n_j (p̄_j − ō_j)²,   RES = (1/n) Σ_j n_j (ō_j − ō)²,   UNC = ō(1 − ō),
        WBV = (1/n) Σ_j Σ_{i∈j} (p_i − p̄_j)²,
        WBC = (2/n) Σ_j Σ_{i∈j} (p_i − p̄_j)(o_i − ō_j),

    and BS = REL − RES + UNC + WBV − WBC exactly (Stephenson, Coelho & Jolliffe 2008). The
    within-bin terms vanish when forecasts are constant within bins. Returns ``brier``,
    ``reliability``, ``resolution``, ``uncertainty``, ``within_bin_variance``,
    ``within_bin_covariance``.
    """
    p = _unit_interval(p, "p")
    o = _binary(o, p.size)
    n = p.size
    if n == 0:
        raise ValueError("no forecasts")
    idx = _bin_index(p, n_bins)
    count = np.bincount(idx, minlength=n_bins)
    nz = count > 0
    p_bar = np.zeros(n_bins)
    o_bar = np.zeros(n_bins)
    p_bar[nz] = np.bincount(idx, weights=p, minlength=n_bins)[nz] / count[nz]
    o_bar[nz] = np.bincount(idx, weights=o, minlength=n_bins)[nz] / count[nz]
    base = o.mean()
    dp = p - p_bar[idx]
    do = o - o_bar[idx]
    return {
        "brier": float(np.mean((p - o) ** 2)),
        "reliability": float(np.sum(count * (p_bar - o_bar) ** 2) / n),
        "resolution": float(np.sum(count * (o_bar - base) ** 2) / n),
        "uncertainty": float(base * (1.0 - base)),
        "within_bin_variance": float(np.sum(dp**2) / n),
        "within_bin_covariance": float(2.0 * np.sum(dp * do) / n),
    }
