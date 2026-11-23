"""Platform models computed from point-in-time data only.

* ``vol.ewma_blend`` (A2 QNT-086): RiskMetrics EWMA short-run variance blended with a 10-year
  long-run variance via GARCH-style mean reversion, plus an expected-earnings variance bump
  (CRT-A-030).
* The CAPM location anchor (ADR-006): the anchor fixes the EXPECTED SIMPLE RETURN,
  E[exp(y)] = 1 + (r_f + beta * ERP) * h / 252.
* Standardised excess outcomes z_u = (y_u - a_u) / sigma_u for calibrators (contract §8.1).

Everything here is computed from arrays that were already truncated at the origin, so it is
point-in-time by construction.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.signal import lfilter

from probcast.contract import distribution as D
from probcast.contract.grid import ERP_DEFAULT, KAPPA_C1, TAUS

EWMA_LAMBDA = 0.94
PHI = 0.98
LONG_RUN_SESSIONS = 2520  # 10 years
MIN_LONG_RUN = 756  # 3 years
BETA_MONTHS = 60
MIN_BETA_MONTHS = 24
SESSIONS_PER_YEAR = 252
EXPECTED_EARNINGS_PER_SESSION = 4 / 252
MIN_EARNINGS_EVENTS = 8


def omega(h: int) -> float:
    """Weight on short-run variance for an h-session horizon: (1 - phi^h) / (h (1 - phi))."""
    return (1.0 - PHI**h) / (h * (1.0 - PHI))


def ewma_variance(r: np.ndarray, lam: float = EWMA_LAMBDA) -> np.ndarray:
    """sigma2_t = lam * sigma2_{t-1} + (1 - lam) * r_t^2, seeded with the first 60 obs (causal)."""
    r2 = np.nan_to_num(r, nan=0.0) ** 2
    seed = float(np.mean(r2[: min(60, r2.size)])) if r2.size else 0.0
    out, _ = lfilter([1 - lam], [1, -lam], r2, zi=[lam * seed])
    return out


WINSOR_K = 5.0


def winsorise_returns(r: np.ndarray, var_long: np.ndarray, k: float = WINSOR_K) -> np.ndarray:
    """Cap each daily return at k x the PREVIOUS day's long-run daily volatility (causal).

    Robust EWMA input (D-078): a single crash day (e.g. AAPL -52% on 2000-09-29) must not imply
    a >95% 12-month loss through the short-run variance. Variance is still raised strongly.
    """
    r = np.nan_to_num(np.asarray(r, dtype=float), nan=0.0)
    prev = np.concatenate([[np.nan], var_long[:-1]])
    fallback = np.nanmean(r[: min(60, r.size)] ** 2) if r.size else 0.0
    prev = np.where(np.isfinite(prev), prev, fallback)
    cap = k * np.sqrt(np.maximum(prev, 1e-12))
    return np.clip(r, -cap, cap)


def rolling_long_run_variance(r: np.ndarray) -> np.ndarray:
    """Expanding variance until 10 years exist, then a 10-year rolling variance (causal)."""
    s = pd.Series(r)
    roll = s.rolling(LONG_RUN_SESSIONS, min_periods=60).var(ddof=1)
    return roll.to_numpy()


@dataclass
class DailyState:
    """Daily, causal platform series up to (and including) the origin session."""

    dates: pd.DatetimeIndex  # session dates
    log_ret: np.ndarray  # daily log total returns (first = nan)
    log_tri: np.ndarray  # cumulative log TRI
    var_short: np.ndarray  # EWMA variance
    var_long: np.ndarray  # long-run variance
    mu_annual: np.ndarray  # CAPM expected simple return r_f + beta*ERP (annual), nan if unknown
    earn_var: float  # PIT mean excess squared earnings-day return (0 if too few events)

    @property
    def n(self) -> int:
        return self.dates.size

    def sigma_h(self, h: int, idx: np.ndarray | slice | int = slice(None)) -> np.ndarray:
        """Std of the h-session log return implied at each session (vectorised)."""
        w = omega(h)
        vs = self.var_short[idx]
        vl = self.var_long[idx]
        vl = np.where(np.isfinite(vl), vl, vs)
        v = h * (w * vs + (1 - w) * vl) + h * EXPECTED_EARNINGS_PER_SESSION * self.earn_var
        return np.sqrt(np.maximum(v, 1e-12))

    def labels(self, h: int) -> pd.Series:
        """y_{s,h} = log TRI_{s+h} - log TRI_s for every s with s + h <= origin (purged)."""
        if self.n <= h:
            return pd.Series(dtype=float)
        y = self.log_tri[h:] - self.log_tri[:-h]
        return pd.Series(y, index=self.dates[:-h])

    def anchor_median_series(self, h: int) -> np.ndarray:
        """Approximate anchor median at each past session (Normal convexity), for z-scores."""
        sig = self.sigma_h(h)
        mu = np.where(np.isfinite(self.mu_annual), self.mu_annual, np.nan)
        return np.log1p(mu * h / SESSIONS_PER_YEAR) - 0.5 * sig**2

    def excess_z(self, h: int) -> pd.Series:
        """z_u = (y_{u,h} - a_{u,h}) / sigma_{u,h} for matured pairs (contract §8.1)."""
        y = self.labels(h)
        if y.empty:
            return y
        n = y.size
        a = self.anchor_median_series(h)[:n]
        sig = self.sigma_h(h, slice(0, n))
        z = (y.to_numpy() - a) / sig
        out = pd.Series(z, index=y.index)
        return out[np.isfinite(out)]


def n_eff_dates(dates: pd.DatetimeIndex | np.ndarray, h: int, index: pd.DatetimeIndex) -> int:
    """Number of distinct non-overlapping h-session windows touched by the pair dates.

    Positions are mapped onto a fixed tiling of the session index (window = pos // h), so the
    count is the number of independent h-windows represented (A2 QNT-080 n_eff; vectorised).
    """
    if len(dates) == 0:
        return 0
    pos = index.get_indexer(pd.DatetimeIndex(dates))
    pos = pos[pos >= 0]
    return int(np.unique(pos // max(h, 1)).size)


def recentred_shape(z: np.ndarray, n_eff: float, kappa: float = KAPPA_C1) -> np.ndarray:
    """Zero-median standardised shape quantiles, shrunk towards N(0,1) by n_eff/(n_eff+kappa).

    Re-centring removes any unconditional drift (survivor bias) from the shape (RT-01).
    """
    from scipy.stats import norm

    normal = norm.ppf(TAUS)
    if z.size < 50 or n_eff <= 0:
        return normal
    emp = np.quantile(z, TAUS)
    emp = emp - np.median(z)
    lam = n_eff / (n_eff + kappa)
    shape = lam * emp + (1 - lam) * normal
    return np.maximum.accumulate(shape + np.arange(shape.size) * 1e-12)


def anchor_quantiles(mu_annual: float, sigma_h: float, shape: np.ndarray, h: int) -> np.ndarray:
    """Quantiles of the CAPM anchor: m + sigma_h * shape, with m solving
    E[exp(y)] = 1 + mu * h / 252 under the given shape (RT-04)."""
    base = sigma_h * shape
    target = 1.0 + mu_annual * h / SESSIONS_PER_YEAR
    e_base = float(D.mean_exp(base)[0])
    m = np.log(target) - np.log(e_base)
    return base + m


def default_mu(rf: float, beta: float, erp: float = ERP_DEFAULT) -> float:
    return rf + beta * erp
