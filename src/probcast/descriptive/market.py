"""Market-based descriptive series: indexed total return (F3/F4; FR-DESC-06) and rolling factor
betas (F2; FR-DESC-05). Both are descriptive (contemporaneous class concepts), not forecasts.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

from probcast.descriptive._core import context
from probcast.lake.store import Store

#: Series whose weekly change is a first difference in percentage points (rates and yields);
#: every other factor uses the weekly log change.
RATE_PREFIXES = ("FRED:DGS", "FRED:DFII", "FRED:DTB", "FRED:FEDFUNDS", "FRED:T10Y")
CI_LEVEL = 0.90


def indexed_total_return(store: Store, tickers: str | Sequence[str], start: Any, asof: Any = None) -> pd.DataFrame:
    """Base-share total-return index of each ticker rebased to 100 on its first session on or
    after ``start`` (FR-DESC-06): TRI_t / TRI_base × 100, with the TRI built from base-share
    closes and base-share dividends (A2 QNT §2: G_t = s_t (P_t + D_t) / P_{t-1}).

    Returns a wide DataFrame indexed by session date (``date``), one column per ticker, as of
    ``asof``. A ticker without prices on or after ``start`` is an all-NaN column.
    """
    tks = [tickers] if isinstance(tickers, str) else [str(t) for t in tickers]
    if not tks:
        return pd.DataFrame()
    ctx = context(store, tks[0], asof)
    t0 = pd.Timestamp(start).normalize().tz_localize(None) if pd.Timestamp(start).tzinfo else pd.Timestamp(start).normalize()
    cols = {}
    for t in tks:
        tri = ctx.tri(t)
        tri = tri[tri.index >= t0]
        cols[t] = (tri / tri.iloc[0] * 100.0) if not tri.empty else pd.Series(dtype=float)
    out = pd.DataFrame(cols)
    out.index.name = "date"
    return out.sort_index()


def _weekly_last(s: pd.Series) -> pd.Series:
    return s.dropna().resample("W-FRI").last()


def factor_transform(series_id: str) -> str:
    return "diff_pp" if series_id.startswith(RATE_PREFIXES) else "log_change"


def rolling_betas(store: Store, ticker: str, asof: Any = None, factors: Sequence[str] = ("FRED:DTWEXBGS", "FRED:DFII10"),
                  window_weeks: int = 156) -> pd.DataFrame:
    """Rolling OLS of weekly excess total returns on the market and one factor change at a time:

        r_i,w − rf_w = α + β_m (r_m,w − rf_w) + β_f Δf_w + ε_w

    over a ``window_weeks`` window of Friday-to-Friday weeks (Fama & MacBeth-style time-series
    regression; Campbell, Lo & MacKinlay 1997, ch. 6). r = simple weekly total return from the
    base-share TRI; market = the ticker config's ``benchmarks.market`` (S&P 500 total return);
    rf_w = DGS1 / 100 / 52 at the previous week end; Δf = weekly log change of an index (e.g. the
    broad dollar index) or the first difference in percentage points of a yield (e.g. the 10-year
    real yield). The 90% CI uses OLS standard errors and Student-t quantiles. Descriptive and
    contemporaneous (FR-DESC-05): it says how returns co-moved, not what comes next.

    Returns a long DataFrame: ``date, factor, transform, beta, se, ci_lo, ci_hi, beta_market, n, r2``.
    """
    ctx = context(store, ticker, asof)
    mkt = ctx.benchmark("market")
    cols = ["date", "factor", "transform", "beta", "se", "ci_lo", "ci_hi", "beta_market", "n", "r2"]
    if not mkt:
        return pd.DataFrame(columns=cols)
    ri = _weekly_last(ctx.tri(ticker)).pct_change()
    rm = _weekly_last(ctx.tri(mkt)).pct_change()
    rf_raw = ctx.series("FRED:DGS1")
    rf = (_weekly_last(rf_raw) / 100.0 / 52.0).shift(1) if not rf_raw.empty else pd.Series(0.0, index=ri.index)
    rows = []
    for fid in factors:
        s = ctx.series(fid)
        if s.empty:
            continue
        w = _weekly_last(s)
        tr = factor_transform(fid)
        df = w.diff() if tr == "diff_pp" else np.log(w).diff()
        j = pd.concat({"y": ri - rf.reindex(ri.index), "m": rm - rf.reindex(rm.index), "f": df}, axis=1).dropna()
        j = j[j.index <= ctx.session]  # complete weeks only (a W-FRI label after the as-of is a partial week)
        if len(j) < window_weeks:
            continue
        y = j["y"].to_numpy()
        x = np.column_stack([np.ones(len(j)), j["m"].to_numpy(), j["f"].to_numpy()])
        k = x.shape[1]
        tq = stats.t.ppf(0.5 + CI_LEVEL / 2, window_weeks - k)
        for end in range(window_weeks, len(j) + 1):
            xs, ys = x[end - window_weeks:end], y[end - window_weeks:end]
            xtx = xs.T @ xs
            try:
                inv = np.linalg.inv(xtx)
            except np.linalg.LinAlgError:
                continue
            b = inv @ xs.T @ ys
            e = ys - xs @ b
            s2 = float(e @ e) / (window_weeks - k)
            se = float(np.sqrt(s2 * inv[2, 2]))
            tss = float(((ys - ys.mean()) ** 2).sum())
            rows.append({"date": j.index[end - 1], "factor": fid, "transform": tr, "beta": float(b[2]), "se": se,
                         "ci_lo": float(b[2] - tq * se), "ci_hi": float(b[2] + tq * se), "beta_market": float(b[1]),
                         "n": window_weeks, "r2": 1 - float(e @ e) / tss if tss > 0 else np.nan})
    return pd.DataFrame(rows, columns=cols)
