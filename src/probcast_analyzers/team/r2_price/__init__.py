"""Round-2 price, volume and volatility ideas (D-101). Parameters are the cited papers' defaults;
nothing is tuned on our data (implementer rule). Each analyzer reduces to one causal signal and a
drift-neutral calibrator (C1 buckets or C3 regression with alpha = 0)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast.sdk import Abstain, analyzer, calibrate_c1, calibrate_c3


def _month_ends(s: pd.Series) -> pd.Series:
    """Last value of each calendar month (index = that month's last session)."""
    s = s.dropna()
    if s.empty:
        return pd.Series(dtype=float, index=pd.DatetimeIndex([]))
    s.index = pd.DatetimeIndex(s.index)
    return s.groupby([s.index.year, s.index.month]).tail(1)


def _rf_daily(ctx) -> pd.Series:
    r = ctx.series("FRED:DTB3")
    return (r / 100.0).rename("rf") if r is not None else pd.Series(dtype=float)


# ------------------------------------------------------------------------------------------ 1
HZ_IM = (21, 63, 126)


@analyzer(
    id="technical.idio_momentum", version="1.0.0", name="Residual (stock-specific) momentum", idea_card="IC-013",
    family="technical.trend", category="technical", report_section="future",
    hypothesis="A high sum of the stock's market- and sector-adjusted residual returns over months t-12..t-2 predicts higher excess returns.",
    expected_direction="positive", course_concepts=("EMH weak form", "under-reaction"),
    references=("ref:blitz-huij-martens-2011",), horizons=HZ_IM, calibrator="C3", min_history_sessions=1000,
    params={"window_months": 36, "form_from": 12, "form_to": 2},
)
def idio_momentum(ctx, params):
    W, a, b = int(params["window_months"]), int(params["form_from"]), int(params["form_to"])
    stock = _month_ends(ctx.tri())
    mkt_sym, sec_sym = ctx.benchmark("market"), ctx.benchmark("sector")
    if not mkt_sym or stock.size < W + 24:
        return {h: Abstain("insufficient history") for h in HZ_IM}
    mkt = _month_ends(ctx.tri(mkt_sym)).reindex(stock.index, method="ffill")
    sec = _month_ends(ctx.tri(sec_sym)).reindex(stock.index) if sec_sym else pd.Series(np.nan, index=stock.index)
    rf = _month_ends(_rf_daily(ctx)).reindex(stock.index, method="ffill").fillna(0.0) / 12.0
    rs = np.log(stock).diff() - rf
    rm = np.log(mkt).diff() - rf
    rsec = np.log(sec).diff() - rf
    vals, idx = [], []
    for i in range(W, len(rs)):
        y = rs.iloc[i - W + 1 : i + 1].to_numpy()
        xm = rm.iloc[i - W + 1 : i + 1].to_numpy()
        xs = rsec.iloc[i - W + 1 : i + 1].to_numpy()
        use_sec = np.isfinite(xs).all()
        if use_sec:  # sector return orthogonalised to the market (residual of sector on market)
            bs = np.polyfit(xm, xs, 1)
            xs = xs - np.polyval(bs, xm)
            X = np.column_stack([np.ones(W), xm, xs])
        else:
            X = np.column_stack([np.ones(W), xm])
        if not (np.isfinite(y).all() and np.isfinite(X).all()):
            continue
        coef, *_ = np.linalg.lstsq(X, y, rcond=None)
        res = y - X @ coef
        form = res[W - a : W - b + 1]  # months t-12 .. t-2 of the window ending at t
        sd = res.std(ddof=1)
        if sd > 0:
            vals.append(form.sum() / sd)
            idx.append(rs.index[i])
    signal = pd.Series(vals, index=pd.DatetimeIndex(idx))
    if signal.size < 60:
        return {h: Abstain("fewer than 60 monthly residual-momentum values") for h in HZ_IM}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=1) for h in HZ_IM}


# ------------------------------------------------------------------------------------------ 2
HZ_52 = (21, 63, 126)


@analyzer(
    id="technical.high52", version="1.0.0", name="Nearness to the 52-week high", idea_card="IC-014",
    family="technical.trend", category="technical", report_section="future",
    hypothesis="When the price is close to its 52-week high, forward returns are higher than the CAPM baseline implies (anchoring).",
    expected_direction="positive", course_concepts=("behavioural finance (anchoring)",),
    references=("ref:george-hwang-2004",), horizons=HZ_52, calibrator="C1", min_history_sessions=756, params={"window": 252},
)
def high52(ctx, params):
    w = int(params["window"])
    px = ctx.prices()
    if px.size < w + 504:
        return {h: Abstain("insufficient history") for h in HZ_52}
    signal = (px / px.rolling(w).max()).dropna()
    return {h: calibrate_c1(ctx, signal, h, n_terciles=3) for h in HZ_52}


# ------------------------------------------------------------------------------------------ 3
HZ_BAB = (63, 126, 252)


@analyzer(
    id="technical.beta_flat_sml", version="1.0.0", name="Betting against beta (ex-ante beta)", idea_card="IC-015",
    family="volatility", category="statistical", report_section="future",
    hypothesis="A high ex-ante beta predicts returns below the CAPM baseline (the security market line is too flat).",
    expected_direction="negative", course_concepts=("CAPM", "leverage constraints"),
    references=("ref:frazzini-pedersen-2014",), horizons=HZ_BAB, calibrator="C3", min_history_sessions=1260,
    params={"corr_window": 1260, "vol_window": 252, "shrink": 0.6, "min_corr": 750, "min_vol": 120},
)
def beta_flat_sml(ctx, params):
    m = ctx.benchmark("market")
    if not m:
        return {h: Abstain("no market benchmark") for h in HZ_BAB}
    ri = ctx.returns()
    rm = ctx.returns(m).reindex(ri.index)
    if ri.dropna().size < int(params["min_corr"]) + 252:
        return {h: Abstain("insufficient history") for h in HZ_BAB}
    r3i, r3m = ri.rolling(3).sum(), rm.rolling(3).sum()
    rho = r3i.rolling(int(params["corr_window"]), min_periods=int(params["min_corr"])).corr(r3m)
    si = ri.rolling(int(params["vol_window"]), min_periods=int(params["min_vol"])).std()
    sm = rm.rolling(int(params["vol_window"]), min_periods=int(params["min_vol"])).std()
    w = float(params["shrink"])
    signal = (w * rho * si / sm + (1 - w) * 1.0).dropna()
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_BAB}


# ------------------------------------------------------------------------------------------ 4
HZ_IND = (21, 63, 126)


@analyzer(
    id="technical.industry_momentum", version="1.0.0", name="Sector tailwind (6-month sector vs market)", idea_card="IC-016",
    family="technical.trend", category="sector", report_section="sector",
    hypothesis="When the stock's sector ETF has beaten the market over the past 6 months, the stock's forward returns are higher.",
    expected_direction="positive", course_concepts=("industry analysis", "momentum"),
    references=("ref:moskowitz-grinblatt-1999",), horizons=HZ_IND, calibrator="C3", min_history_sessions=504, params={"lookback": 126},
)
def industry_momentum(ctx, params):
    sec, broad = ctx.benchmark("sector"), ctx.benchmark("broad")
    if not sec or not broad:
        return {h: Abstain("no sector or broad-market ETF configured") for h in HZ_IND}
    L = int(params["lookback"])
    ls, lb = np.log(ctx.tri(sec)), np.log(ctx.tri(broad))
    signal = ((ls - ls.shift(L)) - (lb - lb.shift(L)).reindex(ls.index)).dropna()
    if signal.size < 504:
        return {h: Abstain("sector history too short") for h in HZ_IND}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=1) for h in HZ_IND}


# ------------------------------------------------------------------------------------------ 5
HZ_VOL = (5, 21, 63)


@analyzer(
    id="technical.abnormal_volume", version="1.0.0", name="High-volume return premium", idea_card="IC-017",
    family="sentiment_alt", category="technical", report_section="future",
    hypothesis="Unusually high recent trading volume (top decile of the stock's last 50 days) predicts higher returns; unusually low volume, lower.",
    expected_direction="positive", course_concepts=("investor attention", "visibility"),
    references=("ref:gervais-kaniel-mingelgrin-2001",), horizons=HZ_VOL, calibrator="C1", min_history_sessions=504,
    params={"formation": 5, "reference": 50, "low": 0.1, "high": 0.9},
)
def abnormal_volume(ctx, params):
    f, ref = int(params["formation"]), int(params["reference"])
    v = ctx.prices(field="volume").replace(0, np.nan)
    if v.dropna().size < 504:
        return {h: Abstain("insufficient volume history") for h in HZ_VOL}
    vf = v.rolling(f).mean()
    # share of the reference window's daily volumes that are below the formation-week average
    arr = v.to_numpy(float)
    fv = vf.to_numpy(float)
    out = np.full(arr.size, np.nan)
    if arr.size > ref + f:
        win = np.lib.stride_tricks.sliding_window_view(arr, ref)  # win[j] = arr[j : j + ref]
        # reference window for day i ends f sessions earlier: rows j = i - f - ref + 1
        i = np.arange(ref + f - 1, arr.size)
        w = win[i - f - ref + 1]
        valid = np.isfinite(w)
        below = np.where(valid, w < fv[i][:, None], False).sum(axis=1)
        n = valid.sum(axis=1)
        share = np.where((n >= ref // 2) & np.isfinite(fv[i]), below / np.maximum(n, 1), np.nan)
        out[i] = share
    signal = pd.Series(out, index=v.index)
    ev = ctx.events("earnings")
    if not ev.empty:  # earnings weeks: treated as ordinary (middle bucket) to stay distinct from earnings drift
        days = pd.DatetimeIndex(pd.to_datetime(ev["content_available_at"], utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None).dt.normalize())
        pos = v.index.searchsorted(days)
        for p in pos[(pos >= 0) & (pos < v.index.size)]:
            signal.iloc[p : p + f + 1] = 0.5
    signal = signal.dropna()
    return {h: calibrate_c1(ctx, signal, h, thresholds=(float(params["low"]), float(params["high"]))) for h in HZ_VOL}


# ------------------------------------------------------------------------------------------ 6
@analyzer(
    id="calendar.same_month", version="1.0.0", name="Same-calendar-month seasonality", idea_card="IC-018",
    family="calendar", category="statistical", report_section="future",
    hypothesis="A stock's average excess return in the coming calendar month over the past 1-20 years predicts its excess return this month.",
    expected_direction="positive", course_concepts=("calendar anomalies",),
    references=("ref:heston-sadka-2008",), horizons=(21,), calibrator="C3", min_history_sessions=1260,
    params={"max_years": 20, "min_years": 5},
)
def same_month(ctx, params):
    m = ctx.benchmark("market")
    if not m:
        return {21: Abstain("no market benchmark")}
    st = _month_ends(np.log(ctx.tri()))
    mk = _month_ends(np.log(ctx.tri(m))).reindex(st.index, method="ffill")
    ex = (st.diff() - mk.diff()).dropna()
    if ex.size < 72:
        return {21: Abstain("fewer than 6 years of monthly history")}
    years, months, vals = ex.index.year.to_numpy(), ex.index.month.to_numpy(), ex.to_numpy()
    K, kmin = int(params["max_years"]), int(params["min_years"])
    sig, idx = [], []
    for t in ex.index:
        nm = t.month % 12 + 1  # the calendar month being forecast
        ny = t.year + (1 if t.month == 12 else 0)
        sel = (months == nm) & (years < ny) & (years >= ny - K)
        if sel.sum() >= kmin:
            sig.append(float(vals[sel].mean()))
            idx.append(t)
    signal = pd.Series(sig, index=pd.DatetimeIndex(idx))
    if signal.size < 60:
        return {21: Abstain("seasonality history too short")}
    return {21: calibrate_c3(ctx, signal, 21, expected_sign=1)}


# ------------------------------------------------------------------------------------------ 7
HZ_ON = (63, 126)


@analyzer(
    id="technical.overnight_sentiment", version="1.0.0", name="Overnight versus intraday returns (tug of war)", idea_card="IC-019",
    family="sentiment_alt", category="sentiment", report_section="future",
    hypothesis="When the past month's overnight returns exceed intraday returns (retail-sentiment pressure at the open), later returns are lower.",
    expected_direction="negative", course_concepts=("investor sentiment", "clientele effects"),
    references=("ref:lou-polk-skouras-2019", "ref:aboody-et-al-2018"), horizons=HZ_ON, calibrator="C3", min_history_sessions=756,
    params={"window": 21},
)
def overnight_sentiment(ctx, params):
    o, c = ctx.prices(field="open"), ctx.prices(field="close")
    good = np.isfinite(o) & (o > 0) & (np.abs(o - c) > 1e-12)  # vendor opens equal to close are missing opens
    on = np.log(o / c.shift(1)).where(good, 0.0)
    intra = np.log(c / o).where(good, 0.0)
    ev = ctx.events("earnings")
    if not ev.empty:  # results gaps are news, not sentiment: zero the first session after each release
        days = pd.DatetimeIndex(pd.to_datetime(ev["content_available_at"], utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None).dt.normalize())
        pos = c.index.searchsorted(days, side="right")
        pos = pos[(pos >= 0) & (pos < c.index.size)]
        on.iloc[pos] = 0.0
    w = int(params["window"])
    signal = (on.rolling(w).sum() - intra.rolling(w).sum())[good.rolling(w).sum() >= w // 2].dropna()
    if signal.size < 504:
        return {h: Abstain("too few valid open prices") for h in HZ_ON}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_ON}


# ------------------------------------------------------------------------------------------ 8
HZ_VR = (21, 63)


@analyzer(
    id="volatility.vol_regime", version="1.0.0", name="Recent volatility versus its year average", idea_card="IC-020",
    family="volatility", category="statistical", report_section="future",
    hypothesis="When the past month's realised variance is high relative to the past year's, forward excess returns are lower (risk is not paid for).",
    expected_direction="negative", course_concepts=("risk and return", "volatility clustering"),
    references=("ref:moreira-muir-2017", "ref:cederburg-et-al-2020"), horizons=HZ_VR, calibrator="C3", min_history_sessions=756,
    params={"short": 21, "long": 252},
)
def vol_regime(ctx, params):
    r = ctx.returns()
    if r.dropna().size < 756:
        return {h: Abstain("insufficient history") for h in HZ_VR}
    s, L = int(params["short"]), int(params["long"])
    signal = np.log(r.rolling(s).var() / r.rolling(L).var()).replace([np.inf, -np.inf], np.nan).dropna()
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_VR}
