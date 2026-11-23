"""Round-2 macro, credit, commodity and sector-exposure ideas (D-101).

Daily market series are used from the session after their date (one-session lag, conservative).
Monthly macro releases use first-release values and become usable only at the end of the month
after the reference month. Parameters are the cited papers' choices; nothing is tuned here. A
sign restriction depends only on the stock's configured sector (e.g. oil producers), never on
estimated performance.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast.sdk import Abstain, analyzer, calibrate_c1, calibrate_c3


def _daily(ctx, series_id: str) -> pd.Series:
    """A daily FRED series stepped onto sessions and lagged one session."""
    s = ctx.series(series_id)
    if s is None or s.empty:
        return pd.Series(dtype=float)
    s = s.dropna()
    s.index = pd.DatetimeIndex(s.index)
    idx = ctx.prices().index
    return s.reindex(idx.union(s.index)).ffill().reindex(idx).shift(1)


def _monthly_release(ctx, series_id: str) -> pd.Series:
    """First-release monthly values, dated at the END OF THE FOLLOWING MONTH (conservative real time)."""
    s = ctx.series(series_id, vintage="first_release")
    if s is None or s.empty:
        return pd.Series(dtype=float)
    s = s.dropna()
    idx = pd.DatetimeIndex(s.index)
    s.index = (idx.to_period("M") + 1).to_timestamp(how="end").normalize()
    return s[~s.index.duplicated(keep="last")]


def _to_sessions(ctx, s: pd.Series) -> pd.Series:
    idx = ctx.prices().index
    return s.reindex(idx.union(s.index)).ffill().reindex(idx).dropna()


def _sign(ctx, default: int, free_sectors: tuple[str, ...]) -> int | None:
    """Sign restriction for C3; ``None`` (unrestricted) for sectors where theory is ambiguous."""
    return None if ctx.benchmark("sector") in free_sectors else default


# ------------------------------------------------------------------------------------------ 1
HZ_TS = (126, 252)


@analyzer(
    id="macro.term_spread", version="1.0.0", name="Yield-curve slope (10-year minus 3-month)", idea_card="IC-028",
    family="macro.rates", category="macro", report_section="macro",
    hypothesis="A steep yield curve (high 10y minus 3m spread) predicts higher stock returns over the next 6-12 months.",
    expected_direction="positive", course_concepts=("term structure", "business cycle"),
    references=("ref:fama-french-1989", "ref:estrella-mishkin-1998"), horizons=HZ_TS, calibrator="C3", min_history_sessions=504,
    params={"avg_days": 21},
)
def term_spread(ctx, params):
    spread = (_daily(ctx, "FRED:DGS10") - _daily(ctx, "FRED:DTB3")).rolling(int(params["avg_days"])).mean().dropna()
    if spread.size < 504:
        return {h: Abstain("insufficient rate history") for h in HZ_TS}
    return {h: calibrate_c3(ctx, spread, h, expected_sign=1) for h in HZ_TS}


# ------------------------------------------------------------------------------------------ 2
@analyzer(
    id="macro.credit_spread", version="1.0.0", name="Corporate credit spread (Baa minus Treasury)", idea_card="IC-029",
    family="macro.credit", category="macro", report_section="macro",
    hypothesis="A wide Baa-Treasury credit spread (high fear) predicts higher stock returns over the next 6-12 months.",
    expected_direction="positive", course_concepts=("credit risk premium", "business cycle"),
    references=("ref:keim-stambaugh-1986", "ref:gilchrist-zakrajsek-2012"), horizons=HZ_TS, calibrator="C3", min_history_sessions=504,
    params={},
)
def credit_spread(ctx, params):
    s = _daily(ctx, "FRED:BAA10Y").dropna()
    if s.size < 504:
        return {h: Abstain("insufficient credit-spread history") for h in HZ_TS}
    return {h: calibrate_c3(ctx, s, h, expected_sign=1) for h in HZ_TS}


# ------------------------------------------------------------------------------------------ 3
HZ_OIL = (21, 63)


@analyzer(
    id="macro.oil_shock", version="1.0.0", name="Oil-price shocks (slow reaction)", idea_card="IC-030",
    family="macro.commodity", category="macro", report_section="macro",
    hypothesis="A rise in oil prices over the past month predicts lower returns for oil consumers over the next 1-3 months; for oil producers the direction is learned from data.",
    expected_direction="negative", course_concepts=("commodity risk", "under-reaction"),
    references=("ref:driesprong-jacobsen-maat-2008", "ref:kilian-park-2009"), horizons=HZ_OIL, calibrator="C3", min_history_sessions=504,
    params={"window": 21, "floor": 1.0},
)
def oil_shock(ctx, params):
    oil = _daily(ctx, "FRED:DCOILWTICO").clip(lower=float(params["floor"]))  # April 2020 went negative
    w = int(params["window"])
    sig = (np.log(oil) - np.log(oil.shift(w))).dropna()
    if sig.size < 504:
        return {h: Abstain("insufficient oil history") for h in HZ_OIL}
    sign = _sign(ctx, -1, free_sectors=("XLE",))
    return {h: calibrate_c3(ctx, sig, h, expected_sign=sign) for h in HZ_OIL}


# ------------------------------------------------------------------------------------------ 4
HZ_VRP = (63, 126)


@analyzer(
    id="volatility.variance_risk_premium", version="1.0.0", name="Market variance risk premium (VIX vs realised)", idea_card="IC-031",
    family="volatility", category="macro", report_section="macro",
    hypothesis="When implied market variance (VIX squared) exceeds recent realised variance, forward stock returns are higher.",
    expected_direction="positive", course_concepts=("risk premia", "options"),
    references=("ref:bollerslev-tauchen-zhou-2009",), horizons=HZ_VRP, calibrator="C3", min_history_sessions=504,
    params={"window": 21},
)
def variance_risk_premium(ctx, params):
    sp = ctx.benchmark("market_price")
    vix = _daily(ctx, "FRED:VIXCLS")
    if not sp or vix.dropna().size < 504:
        return {h: Abstain("no VIX or market-index history") for h in HZ_VRP}
    r = np.log(ctx.prices(sp)).diff().reindex(vix.index)
    rv = (r**2).rolling(int(params["window"])).sum() * 1e4  # monthly realised variance in %^2
    vrp = (vix**2 / 12.0 - rv.shift(1)).dropna()  # realised variance lagged with the VIX
    return {h: calibrate_c3(ctx, vrp, h, expected_sign=1) for h in HZ_VRP}


# ------------------------------------------------------------------------------------------ 5
HZ_RSR = (21, 63, 126)


@analyzer(
    id="macro.relative_short_rate", version="1.0.0", name="Short rate versus its 1-year average (monetary stance)", idea_card="IC-032",
    family="macro.rates", category="macro", report_section="macro",
    hypothesis="When the 3-month T-bill rate is above its past-year average (tightening), stock returns over the next 1-6 months are lower; banks are left unrestricted.",
    expected_direction="negative", course_concepts=("monetary policy", "discount rates"),
    references=("ref:campbell-1991", "ref:thorbecke-1997"), horizons=HZ_RSR, calibrator="C3", min_history_sessions=504,
    params={"window": 252},
)
def relative_short_rate(ctx, params):
    tb = _daily(ctx, "FRED:DTB3")
    sig = (tb - tb.rolling(int(params["window"])).mean()).dropna()
    if sig.size < 504:
        return {h: Abstain("insufficient T-bill history") for h in HZ_RSR}
    sign = _sign(ctx, -1, free_sectors=("XLF",))
    return {h: calibrate_c3(ctx, sig, h, expected_sign=sign) for h in HZ_RSR}


# ------------------------------------------------------------------------------------------ 6
HZ_GAP = (126, 252)


@analyzer(
    id="macro.output_gap", version="1.0.0", name="Real-time output gap (industrial production vs trend)", idea_card="IC-033",
    family="macro.cycle", category="macro", report_section="macro",
    hypothesis="When industrial production is far below its quadratic trend (estimated with data known at the time), stock returns over the next 6-12 months are higher.",
    expected_direction="negative", course_concepts=("business cycle", "time-varying risk premia"),
    references=("ref:cooper-priestley-2009",), horizons=HZ_GAP, calibrator="C3", min_history_sessions=504,
    params={"min_months": 120},
)
def output_gap(ctx, params):
    ip = _monthly_release(ctx, "FRED:INDPRO")
    if ip.size < int(params["min_months"]) + 24:
        return {h: Abstain("insufficient industrial-production history") for h in HZ_GAP}
    y = np.log(ip.to_numpy(float))
    t = np.arange(y.size, dtype=float)
    vals = np.full(y.size, np.nan)
    for i in range(int(params["min_months"]), y.size):  # trend refit at each release on data known then
        c = np.polyfit(t[: i + 1], y[: i + 1], 2)
        vals[i] = y[i] - np.polyval(c, t[i])
    gap = pd.Series(vals, index=ip.index).dropna()
    signal = _to_sessions(ctx, gap)
    if signal.size < 504:
        return {h: Abstain("output-gap history too short") for h in HZ_GAP}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_GAP}


# ------------------------------------------------------------------------------------------ 7
HZ_INF = (63, 126, 252)


@analyzer(
    id="macro.inflation_level", version="1.0.0", name="Inflation level (12-month CPI change)", idea_card="IC-034",
    family="macro.cycle", category="macro", report_section="macro",
    hypothesis="Stock returns differ by inflation regime (terciles of the 12-month CPI change); high inflation is expected to hurt long-duration stocks most.",
    expected_direction="negative", course_concepts=("inflation", "real versus nominal returns"),
    references=("ref:fama-schwert-1977", "ref:campbell-vuolteenaho-2004"), horizons=HZ_INF, calibrator="C1", min_history_sessions=504,
    params={"terciles": 3},
)
def inflation_level(ctx, params):
    cpi = _monthly_release(ctx, "FRED:CPIAUCSL")
    if cpi.size < 36:
        return {h: Abstain("insufficient CPI history") for h in HZ_INF}
    infl = np.log(cpi / cpi.shift(12)).dropna()
    signal = _to_sessions(ctx, infl)
    return {h: calibrate_c1(ctx, signal, h, n_terciles=int(params["terciles"])) for h in HZ_INF}


# ------------------------------------------------------------------------------------------ 8
HZ_CS = (126, 252)


@analyzer(
    id="sentiment.consumer_contrarian", version="1.0.0", name="Consumer sentiment, read contrarian", idea_card="IC-035",
    family="sentiment_alt", category="sentiment", report_section="macro",
    hypothesis="Unusually high consumer sentiment (vs its past 5 years) predicts lower returns for consumer-facing stocks over the next 6-12 months; other sectors are left unrestricted.",
    expected_direction="negative", course_concepts=("investor sentiment", "consumer spending"),
    references=("ref:fisher-statman-2003", "ref:lemmon-portniaguina-2006"), horizons=HZ_CS, calibrator="C3", min_history_sessions=504,
    params={"window_months": 60},
)
def consumer_contrarian(ctx, params):
    u = _monthly_release(ctx, "FRED:UMCSENT")
    w = int(params["window_months"])
    if u.size < w + 24:
        return {h: Abstain("insufficient sentiment history") for h in HZ_CS}
    z = ((u - u.rolling(w).mean()) / u.rolling(w).std()).dropna()
    signal = _to_sessions(ctx, z)
    sector = ctx.benchmark("sector")
    sign = -1 if sector in ("XLY", "XLP") else None
    return {h: calibrate_c3(ctx, signal, h, expected_sign=sign) for h in HZ_CS}
