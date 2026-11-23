"""Drift-neutral point-in-time calibrators (contract §8, §8.1; A2 QNT-080/082).

Every calibrator works on standardised EXCESS outcomes z_u = (y_u - a_u) / sigma_u for matured
pairs only (u + h <= origin), and returns  anchor_median + sigma_t * (tilt + shape).
Shapes are re-centred to zero median, so AAPL's unconditional (survivor-biased) excess return
cannot leak into a forecast. C3 forecasts with alpha = 0.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import norm

from probcast.contract.grid import KAPPA_C1, MEDIAN_INDEX, TAUS
from probcast.pit import platform as P
from probcast.sdk.registry import Abstain, Forecast

MIN_PAIRS = 60
MIN_NEFF_BUCKET = 5


def _aligned(ctx: Any, signal_history: pd.Series, h: int) -> pd.DataFrame:
    z = ctx.excess_z(h)
    s = signal_history.dropna()
    s.index = pd.DatetimeIndex(s.index)
    df = pd.concat([s.rename("s"), z.rename("z")], axis=1, join="inner").dropna()
    return df


def _forecast_from(ctx: Any, h: int, tilt: float, shape: np.ndarray, calib: dict[str, Any], signal: float | None) -> Forecast:
    sigma = ctx.vol(h)
    m = ctx.anchor_median(h)
    q = m + sigma * (tilt + shape)
    q = np.maximum.accumulate(q + np.arange(q.size) * 1e-12)
    return Forecast(quantiles=q, signal=signal, calibration={**calib, "tilt_z": tilt, "sigma_h": sigma, "anchor_median": m})


def calibrate_c1(
    ctx: Any,
    signal_history: pd.Series,
    h: int,
    *,
    thresholds: tuple[float, ...] | None = None,
    n_terciles: int = 3,
    kappa: float = KAPPA_C1,
) -> Forecast | Abstain:
    """C1: conditional empirical distribution with shrinkage (bucket signals).

    Buckets come from fixed ``thresholds`` or expanding-window terciles of the past signal.
    tilt = lambda_b * (median(Z_b) - median(Z_all)), lambda_b = n_eff_b / (n_eff_b + kappa).
    Shape = lambda_b * F(Z_b - med Z_b) + (1 - lambda_b) * F(Z_all - med Z_all) (re-centred).
    """
    if signal_history.dropna().empty:
        return Abstain("no signal")
    s_t = float(signal_history.dropna().iloc[-1])
    df = _aligned(ctx, signal_history, h)
    if len(df) < MIN_PAIRS:
        return Abstain(f"fewer than {MIN_PAIRS} matured signal/outcome pairs")
    if thresholds is None:
        qs = np.quantile(df["s"], np.linspace(0, 1, n_terciles + 1)[1:-1])
        edges = tuple(float(x) for x in qs)
    else:
        edges = tuple(thresholds)
    b_all = np.searchsorted(edges, df["s"].to_numpy(), side="right")
    b_t = int(np.searchsorted(edges, s_t, side="right"))
    z_all = df["z"].to_numpy()
    in_b = b_all == b_t
    z_b = z_all[in_b]
    ne_b = P.n_eff_dates(df.index[in_b], h, ctx.session_pos)
    ne_all = P.n_eff_dates(df.index, h, ctx.session_pos)
    if ne_b < MIN_NEFF_BUCKET or z_b.size < 20:
        tilt, lam = 0.0, 0.0
        shape = P.recentred_shape(z_all, ne_all, kappa)
    else:
        lam = ne_b / (ne_b + kappa)
        tilt = lam * (float(np.median(z_b)) - float(np.median(z_all)))
        sh_b = P.recentred_shape(z_b, ne_b, kappa)
        sh_all = P.recentred_shape(z_all, ne_all, kappa)
        shape = lam * sh_b + (1 - lam) * sh_all
    calib = {"method": "C1", "bucket": b_t, "edges": list(edges), "n_pairs": int(z_b.size), "n_eff": int(ne_b), "lambda": float(lam)}
    return _forecast_from(ctx, h, tilt, shape, calib, s_t)


def calibrate_c3(
    ctx: Any,
    signal_history: pd.Series,
    h: int,
    *,
    expected_sign: int | None = None,
    prior_sd: float = 0.1,
) -> Forecast | Abstain:
    """C3: predictive regression z_u = alpha + beta * s~_u + eps with ridge prior N(0, prior_sd^2)
    on beta, sign restriction from ``expected_sign`` and FORECAST WITH alpha = 0 (RT-01).

    s~ is the causal expanding z-score of the signal. Residuals are re-centred to zero median.
    """
    s = signal_history.dropna()
    if s.empty:
        return Abstain("no signal")
    mu = s.expanding(min_periods=60).mean()
    sd = s.expanding(min_periods=60).std()
    s_tilde = ((s - mu) / sd).replace([np.inf, -np.inf], np.nan).dropna()
    if s_tilde.empty:
        return Abstain("signal history too short for a causal z-score")
    s_t = float(s_tilde.iloc[-1])
    df = _aligned(ctx, s_tilde, h)
    if len(df) < MIN_PAIRS:
        return Abstain(f"fewer than {MIN_PAIRS} matured signal/outcome pairs")
    x = df["s"].to_numpy()
    zz = df["z"].to_numpy()
    xc = x - x.mean()
    zc = zz - zz.mean()
    ne = P.n_eff_dates(df.index, h, ctx.session_pos)
    resid_var = float(np.var(zc)) if zc.size > 1 else 1.0
    # Ridge with the prior scaled to effective (not raw, overlapping) sample size.
    scale = max(ne, 1) / max(len(x), 1)
    beta_hat = float((xc @ zc) * scale / ((xc @ xc) * scale + resid_var / prior_sd**2))
    alpha_diag = float(zz.mean() - beta_hat * x.mean())
    restricted = False
    if expected_sign is not None and np.sign(beta_hat) not in (0, np.sign(expected_sign)):
        beta_hat, restricted = 0.0, True
    resid = zz - (alpha_diag + beta_hat * x)
    shape = P.recentred_shape(resid, ne)
    tilt = beta_hat * s_t
    calib = {
        "method": "C3", "beta": beta_hat, "alpha_excess_drift_diagnostic": alpha_diag,
        "sign_restricted": restricted, "n_pairs": len(x), "n_eff": int(ne),
    }
    return _forecast_from(ctx, h, tilt, shape, calib, s_t)


def center_on_anchor(ctx: Any, quantiles: np.ndarray, h: int) -> np.ndarray:
    """C5 helper: re-centre a model-implied distribution so its median equals the anchor median
    (drift neutrality for simulation analyzers that do not carry their own location view)."""
    q = np.asarray(quantiles, dtype=float)
    return q - q[MEDIAN_INDEX] + ctx.anchor_median(h)


def normal_shape() -> np.ndarray:
    return norm.ppf(TAUS)
