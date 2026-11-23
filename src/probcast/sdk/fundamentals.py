"""Point-in-time fundamentals helpers for analyzers (public SDK).

Flows are reported as 3-month quarters, year-to-date and fiscal-year facts. Q4 is derived as
FY - (Q1 + Q2 + Q3) (Apple files no Q4 10-Q). TTM sums the latest four quarters known at the
origin. Values are as FIRST reported (contract §4; NFR-SCI-03). Per-share values are put on the
base-share basis using the split factor known at the filing date.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def quarterly_flow(ctx: Any, tag: str, *, vintage: str = "as_first_reported", per_share_base: bool = False) -> pd.Series:
    """3-month values indexed by period_end, with Q4 derived from FY minus the three quarters.

    With ``per_share_base=True`` every fact (quarterly AND fiscal-year) is first converted to
    base-share units with the split factor in force when THAT filing became public. Q4 is then
    derived on a consistent share basis. This matters when a split falls inside the fiscal year
    (AAPL FY2020: Q1-Q3 EPS were filed pre-split, the FY figure post-split; found by B5).
    """
    df = ctx.fundamentals(tag, vintage=vintage)
    if df is None or df.empty:
        return pd.Series(dtype=float)
    df = df.dropna(subset=["period_start", "period_end"]).copy()
    if per_share_base:
        filed = pd.DatetimeIndex(pd.to_datetime(df["available_at"], utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None).dt.normalize())
        df["value"] = df["value"].to_numpy(float) * ctx._split_factor(ctx.ticker, filed)
    days = (pd.to_datetime(df["period_end"]) - pd.to_datetime(df["period_start"])).dt.days
    q = df[(days >= 80) & (days <= 100)].drop_duplicates("period_end", keep="first")
    fy = df[(days >= 350) & (days <= 380)].drop_duplicates("period_end", keep="first")
    qs = pd.Series(q["value"].to_numpy(float), index=pd.to_datetime(q["period_end"]))
    for _, r in fy.iterrows():
        end, start = pd.Timestamp(r["period_end"]), pd.Timestamp(r["period_start"])
        if end in qs.index:
            continue
        inside = qs[(qs.index > start) & (qs.index < end)]
        if len(inside) == 3:
            qs.loc[end] = float(r["value"]) - float(inside.sum())
    return qs.sort_index()


def ttm(ctx: Any, tag: str) -> pd.Series:
    """Trailing-twelve-month sum of the latest four consecutive quarters (by period end)."""
    qs = quarterly_flow(ctx, tag)
    if qs.size < 4:
        return pd.Series(dtype=float)
    return qs.rolling(4).sum().dropna()


def ttm_per_share_base(ctx: Any, tag: str) -> pd.Series:
    """TTM per-share flow (e.g. diluted EPS) in base-share units, indexed by period end.

    Each fact is converted with the split factor at its filing's public availability (as
    reported, before deriving Q4), then four quarters are summed (D-084).
    """
    qs = quarterly_flow(ctx, tag, per_share_base=True)
    if qs.size < 4:
        return pd.Series(dtype=float)
    return qs.rolling(4).sum().dropna()


def known_on(series: pd.Series, dates: pd.DatetimeIndex, lag_days: int = 0) -> pd.Series:
    """Step a period-end series onto daily dates (values were filed after period end; the
    context has already removed anything not yet filed at the origin)."""
    if series.empty:
        return pd.Series(np.nan, index=dates)
    s = series.copy()
    s.index = s.index + pd.Timedelta(days=lag_days)
    return s.reindex(dates.union(s.index)).ffill().reindex(dates)


# ---------------------------------------------------------------------------------------------
# Filing-time helpers (D-101). Values are dated by WHEN THEY BECAME PUBLIC, not by period end:
# ``known`` is the calendar day after the filing's SEC acceptance (New York time), so a value can
# only reach a signal from the first session after its filing. Every quarter is taken from the
# filing that first reported it (as first reported).
# ---------------------------------------------------------------------------------------------


def _known_day(available_at: pd.Series) -> pd.DatetimeIndex:
    ny = pd.to_datetime(available_at, utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None)
    return pd.DatetimeIndex(ny.dt.normalize() + pd.Timedelta(days=1))


def _facts(ctx: Any, tag: str, per_share_base: bool = False) -> pd.DataFrame:
    df = ctx.fundamentals(tag, vintage="as_first_reported")
    if df is None or df.empty:
        return pd.DataFrame(columns=["period_start", "period_end", "value", "known"])
    df = df.copy()
    df["known"] = _known_day(df["available_at"])
    if per_share_base:
        filed = pd.DatetimeIndex(pd.to_datetime(df["available_at"], utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None).dt.normalize())
        df["value"] = df["value"].to_numpy(float) * ctx._split_factor(ctx.ticker, filed)
    return df


def quarterly_known(ctx: Any, tag: str, *, per_share_base: bool = False) -> pd.DataFrame:
    """3-month flows indexed by period end, with columns ``value`` and ``known``.

    Uses reported 3-month values; otherwise differences year-to-date values that share a fiscal-
    year start (6m - 3m, 9m - 6m, FY - 9m: cash-flow statements are filed year-to-date); otherwise
    FY - (Q1 + Q2 + Q3). A derived quarter is known when its LATEST input was filed.
    """
    df = _facts(ctx, tag, per_share_base)
    if df.empty:
        return pd.DataFrame(columns=["value", "known"])
    df = df.dropna(subset=["period_start", "period_end"]).copy()
    df["days"] = (pd.to_datetime(df["period_end"]) - pd.to_datetime(df["period_start"])).dt.days
    df = df.sort_values("known").drop_duplicates(["period_start", "period_end"], keep="first")
    out: dict[pd.Timestamp, tuple[float, pd.Timestamp]] = {}
    q = df[(df["days"] >= 80) & (df["days"] <= 100)]
    for _, r in q.iterrows():
        out.setdefault(pd.Timestamp(r["period_end"]), (float(r["value"]), r["known"]))
    # Year-to-date chains: same period_start, increasing length.
    for _, g in df[(df["days"] >= 80) & (df["days"] <= 380)].groupby("period_start"):
        g = g.sort_values("days")
        prev = None
        for _, r in g.iterrows():
            end = pd.Timestamp(r["period_end"])
            if prev is not None and 80 <= (end - prev[0]).days <= 100 and end not in out:
                out[end] = (float(r["value"]) - prev[1], max(r["known"], prev[2]))
            prev = (end, float(r["value"]), r["known"])
    res = pd.DataFrame([(k, v, kn) for k, (v, kn) in out.items()], columns=["period_end", "value", "known"])
    return res.set_index("period_end").sort_index()


def instant_known(ctx: Any, tag: str, *, per_share_divide: bool = False) -> pd.DataFrame:
    """Balance-sheet (point-in-time) values by period end with ``value`` and ``known``.
    ``per_share_divide`` converts share COUNTS to base-share units (divide by the split factor)."""
    df = _facts(ctx, tag)
    if df.empty:
        return pd.DataFrame(columns=["value", "known"])
    df = df.sort_values("known").drop_duplicates("period_end", keep="first")
    if per_share_divide:
        filed = pd.DatetimeIndex(pd.to_datetime(df["available_at"], utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None).dt.normalize())
        df["value"] = df["value"].to_numpy(float) / ctx._split_factor(ctx.ticker, filed)
    return df.set_index(pd.DatetimeIndex(df["period_end"]))[["value", "known"]].sort_index()


def step_known(values: pd.Series, known: pd.Series, dates: pd.DatetimeIndex) -> pd.Series:
    """Daily series: at each date, the value of the LATEST period whose filing was known by then.

    ``values`` and ``known`` share a period-end index. A late filing of an older period never
    replaces a newer period's value."""
    if len(values) == 0:
        return pd.Series(np.nan, index=dates)
    d = pd.DataFrame({"v": values.to_numpy(float), "known": pd.DatetimeIndex(known), "pe": values.index}).dropna()
    d = d.sort_values(["known", "pe"])
    d = d[d["pe"] >= d["pe"].cummax()].drop_duplicates("known", keep="last")
    s = pd.Series(d["v"].to_numpy(), index=pd.DatetimeIndex(d["known"]))
    return s.reindex(dates.union(s.index)).ffill().reindex(dates)
