"""Round-2 fundamentals, accounting and earnings-event ideas (D-101).

Every value comes from SEC filings AS FIRST REPORTED and enters a signal only from the day after
its filing became public (``probcast.sdk.fundamentals.*_known`` + ``step_known``). Parameters are
the cited papers' definitions; nothing is tuned on our data. Most of these effects were found
across many firms; here each is tested on one stock's own history (signal vs its past).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast.sdk import Abstain, analyzer, calibrate_c1, calibrate_c3
from probcast.sdk.fundamentals import instant_known, quarterly_known, step_known

REV_TAGS = ("us-gaap:Revenues", "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:SalesRevenueNet")
FINANCIAL_SECTOR = "XLF"  # banks/insurers: operating cash flow and capex are not comparable (from the config's sector ETF)


def _revenue(ctx) -> pd.DataFrame:
    parts = [quarterly_known(ctx, t) for t in REV_TAGS]
    parts = [p for p in parts if not p.empty]
    if not parts:
        return pd.DataFrame(columns=["value", "known"])
    df = pd.concat(parts)
    return df[~df.index.duplicated(keep="first")].sort_index()


def _yoy(df: pd.DataFrame, lag_q: int = 4, lo: int = 340, hi: int = 390) -> pd.DataFrame:
    """Pair each period with the one ~1 year earlier (by period-end date); known = later filing."""
    if len(df) <= lag_q:
        return pd.DataFrame(columns=["now", "then", "known"])
    rows = []
    idx = df.index
    for pe in idx:
        cand = idx[(idx <= pe - pd.Timedelta(days=lo)) & (idx >= pe - pd.Timedelta(days=hi))]
        if len(cand):
            prev = cand[-1]
            rows.append((pe, df.at[pe, "value"], df.at[prev, "value"], max(df.at[pe, "known"], df.at[prev, "known"])))
    return pd.DataFrame(rows, columns=["pe", "now", "then", "known"]).set_index("pe")


def _ttm(df: pd.DataFrame) -> pd.DataFrame:
    """Trailing-12-month sum over four consecutive quarters (ends ~273 days apart)."""
    if len(df) < 4:
        return pd.DataFrame(columns=["value", "known"])
    v = df["value"].rolling(4).sum()
    span = pd.Series(df.index, index=df.index).diff(3).dt.days
    kn = [max(df["known"].iloc[max(0, i - 3) : i + 1]) for i in range(len(df))]
    out = pd.DataFrame({"value": v, "known": kn}, index=df.index)
    return out[(span >= 250) & (span <= 300)].dropna()


def _daily(ctx, values: pd.Series, known: pd.Series) -> pd.Series:
    return step_known(values, known, ctx.prices().index).dropna()


# ------------------------------------------------------------------------------------------ 1
HZ_SUE = (21, 63)


@analyzer(
    id="fundamental.sue", version="1.0.0", name="Standardised unexpected earnings (seasonal random walk)", idea_card="IC-021",
    family="events", category="fundamental", report_section="fundamental",
    hypothesis="A large positive earnings surprise versus the same quarter a year earlier predicts higher returns over the next 1-3 months (post-earnings drift).",
    expected_direction="positive", course_concepts=("EMH semi-strong form", "under-reaction"),
    references=("ref:foster-olsen-shevlin-1984", "ref:bernard-thomas-1990"), horizons=HZ_SUE, calibrator="C3",
    data_dependencies=("us-gaap:EarningsPerShareDiluted",), min_history_sessions=756, params={"n_diffs": 8, "winsor": 5.0},
)
def sue(ctx, params):
    eps = quarterly_known(ctx, "us-gaap:EarningsPerShareDiluted", per_share_base=True)
    y = _yoy(eps)
    if len(y) < int(params["n_diffs"]) + 4:
        return {h: Abstain("fewer than 12 quarters of as-first-reported EPS") for h in HZ_SUE}
    d = y["now"] - y["then"]
    n = int(params["n_diffs"])
    mu = d.shift(1).rolling(n).mean()
    sd = d.shift(1).rolling(n).std()
    s = ((d - mu) / sd).replace([np.inf, -np.inf], np.nan).clip(-params["winsor"], params["winsor"]).dropna()
    signal = _daily(ctx, s, y["known"].reindex(s.index))
    if signal.size < 504:
        return {h: Abstain("SUE history too short") for h in HZ_SUE}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=1) for h in HZ_SUE}


# ------------------------------------------------------------------------------------------ 2
@analyzer(
    id="events.announcement_premium", version="1.0.0", name="Earnings-announcement month premium", idea_card="IC-022",
    family="events", category="event", report_section="future",
    hypothesis="In a month when the company is expected to report results (projected from the same quarter a year earlier), returns are higher and more variable.",
    expected_direction="positive", course_concepts=("systematic risk", "event studies"),
    references=("ref:frazzini-lamont-2007", "ref:savor-wilson-2016"), horizons=(21,), calibrator="C1", min_history_sessions=504,
    params={"lag_days": 364, "window_days": 30},
)
def announcement_premium(ctx, params):
    ev = ctx.events("earnings")
    if ev.empty:
        return {21: Abstain("no earnings release dates")}
    rel = pd.DatetimeIndex(pd.to_datetime(ev["content_available_at"], utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None).dt.normalize()).sort_values()
    if rel.size < 8:
        return {21: Abstain("fewer than 8 earnings releases")}
    proj = rel + pd.Timedelta(days=int(params["lag_days"]))  # known: built from releases a year earlier
    dates = ctx.prices().index
    dates = dates[dates >= rel[0] + pd.Timedelta(days=int(params["lag_days"]))]
    if dates.size < 504:
        return {21: Abstain("release history too short")}
    nxt = proj.searchsorted(dates, side="right")  # first projected date strictly after each day
    ok = nxt < proj.size
    gap = np.full(dates.size, np.inf)
    gap[ok] = (proj[nxt[ok]] - dates[ok]).days
    signal = pd.Series((gap <= int(params["window_days"])).astype(float), index=dates)
    return {21: calibrate_c1(ctx, signal, 21, thresholds=(0.5,))}


# ------------------------------------------------------------------------------------------ 3
HZ_LONG = (126, 252)


@analyzer(
    id="fundamental.net_share_issuance", version="1.0.0", name="Net share issuance (buybacks shrink the count)", idea_card="IC-023",
    family="fundamental.quality", category="fundamental", report_section="fundamental",
    hypothesis="A falling split-adjusted share count over the past year (net buybacks) predicts higher returns; issuance predicts lower.",
    expected_direction="negative", course_concepts=("market timing by managers", "payout policy"),
    references=("ref:pontiff-woodgate-2008", "ref:ikenberry-lakonishok-vermaelen-1995"), horizons=HZ_LONG, calibrator="C3",
    data_dependencies=("dei:EntityCommonStockSharesOutstanding",), min_history_sessions=756, params={},
)
def net_share_issuance(ctx, params):
    sh = instant_known(ctx, "dei:EntityCommonStockSharesOutstanding", per_share_divide=True)
    if len(sh) < 8:
        sh = instant_known(ctx, "us-gaap:CommonStockSharesOutstanding", per_share_divide=True)
    y = _yoy(sh, lo=330, hi=400)
    if len(y) < 8:
        return {h: Abstain("fewer than 8 year-on-year share counts") for h in HZ_LONG}
    nsi = np.log(y["now"] / y["then"]).replace([np.inf, -np.inf], np.nan).dropna()
    signal = _daily(ctx, nsi, y["known"].reindex(nsi.index))
    if signal.size < 504:
        return {h: Abstain("share-count history too short") for h in HZ_LONG}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_LONG}


# ------------------------------------------------------------------------------------------ 4
@analyzer(
    id="fundamental.accruals", version="1.0.0", name="Accruals (profit not backed by cash)", idea_card="IC-024",
    family="fundamental.quality", category="fundamental", report_section="fundamental",
    hypothesis="High accruals (TTM net income minus operating cash flow, scaled by average assets) predict lower returns.",
    expected_direction="negative", course_concepts=("earnings quality", "accounting"),
    references=("ref:sloan-1996", "ref:hribar-collins-2002"), horizons=HZ_LONG, calibrator="C3",
    data_dependencies=("us-gaap:NetIncomeLoss", "us-gaap:NetCashProvidedByUsedInOperatingActivities", "us-gaap:Assets"),
    min_history_sessions=756, params={},
)
def accruals(ctx, params):
    if ctx.benchmark("sector") == FINANCIAL_SECTOR:
        return {h: Abstain("not meaningful for financial companies") for h in HZ_LONG}
    ni = _ttm(quarterly_known(ctx, "us-gaap:NetIncomeLoss"))
    cfo = _ttm(quarterly_known(ctx, "us-gaap:NetCashProvidedByUsedInOperatingActivities"))
    a = instant_known(ctx, "us-gaap:Assets")
    if ni.empty or cfo.empty or len(a) < 5:
        return {h: Abstain("missing income, cash-flow or asset facts") for h in HZ_LONG}
    ay = _yoy(a)
    j = ni.join(cfo, lsuffix="_ni", rsuffix="_cf", how="inner").join(ay, how="inner")
    if len(j) < 8:
        return {h: Abstain("fewer than 8 quarters with all inputs") for h in HZ_LONG}
    acc = (j["value_ni"] - j["value_cf"]) / ((j["now"] + j["then"]) / 2)
    known = j[["known_ni", "known_cf", "known"]].max(axis=1)
    signal = _daily(ctx, acc, known)
    if signal.size < 504:
        return {h: Abstain("accrual history too short") for h in HZ_LONG}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_LONG}


# ------------------------------------------------------------------------------------------ 5
@analyzer(
    id="fundamental.asset_growth", version="1.0.0", name="Total asset growth", idea_card="IC-025",
    family="fundamental.quality", category="fundamental", report_section="fundamental",
    hypothesis="Fast year-on-year growth in total assets (excluding operating-lease assets) predicts lower returns.",
    expected_direction="negative", course_concepts=("investment and expected returns (q-theory)",),
    references=("ref:cooper-gulen-schill-2008",), horizons=HZ_LONG, calibrator="C3",
    data_dependencies=("us-gaap:Assets",), min_history_sessions=756, params={},
)
def asset_growth(ctx, params):
    a = instant_known(ctx, "us-gaap:Assets")
    if len(a) < 8:
        return {h: Abstain("fewer than 8 balance sheets") for h in HZ_LONG}
    rou = instant_known(ctx, "us-gaap:OperatingLeaseRightOfUseAsset")
    if not rou.empty:  # ASC 842 (2019) put leases on the balance sheet: compare like with like
        adj = rou["value"].reindex(a.index).fillna(0.0)
        a = a.assign(value=a["value"] - adj)
    y = _yoy(a)
    ag = (y["now"] / y["then"] - 1).replace([np.inf, -np.inf], np.nan).dropna()
    signal = _daily(ctx, ag, y["known"].reindex(ag.index))
    if signal.size < 504:
        return {h: Abstain("asset history too short") for h in HZ_LONG}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_LONG}


# ------------------------------------------------------------------------------------------ 6
@analyzer(
    id="fundamental.capex_investment", version="1.0.0", name="Abnormal capital investment", idea_card="IC-026",
    family="fundamental.quality", category="fundamental", report_section="fundamental",
    hypothesis="Capital spending (relative to sales) well above its average of the previous three years predicts lower returns.",
    expected_direction="negative", course_concepts=("capital budgeting", "agency costs"),
    references=("ref:titman-wei-xie-2004",), horizons=HZ_LONG, calibrator="C3",
    data_dependencies=("us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",), min_history_sessions=756, params={},
)
def capex_investment(ctx, params):
    if ctx.benchmark("sector") == FINANCIAL_SECTOR:
        return {h: Abstain("capital spending is not comparable for financial companies") for h in HZ_LONG}
    cx = _ttm(quarterly_known(ctx, "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment"))
    rv = _ttm(_revenue(ctx))
    j = cx.join(rv, lsuffix="_cx", rsuffix="_rv", how="inner")
    if len(j) < 16:
        return {h: Abstain("fewer than 16 quarters of capex and revenue") for h in HZ_LONG}
    ce = (j["value_cx"] / j["value_rv"]).replace([np.inf, -np.inf], np.nan)
    base = (ce.shift(4) + ce.shift(8) + ce.shift(12)) / 3
    ci = (ce / base - 1).replace([np.inf, -np.inf], np.nan).dropna()
    known = j[["known_cx", "known_rv"]].max(axis=1).reindex(ci.index)
    signal = _daily(ctx, ci, known)
    if signal.size < 504:
        return {h: Abstain("capex history too short") for h in HZ_LONG}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_LONG}


# ------------------------------------------------------------------------------------------ 7
HZ_INV = (63, 126)


@analyzer(
    id="fundamental.inventory_vs_sales", version="1.0.0", name="Inventory growing faster than sales", idea_card="IC-027",
    family="fundamental.quality", category="fundamental", report_section="fundamental",
    hypothesis="When inventory grows faster than sales (year on year), demand is cooling and returns over the next 3-6 months are lower.",
    expected_direction="negative", course_concepts=("working capital", "fundamental analysis"),
    references=("ref:abarbanell-bushee-1998", "ref:thomas-zhang-2002"), horizons=HZ_INV, calibrator="C3",
    data_dependencies=("us-gaap:InventoryNet",), min_history_sessions=756, params={},
)
def inventory_vs_sales(ctx, params):
    inv = instant_known(ctx, "us-gaap:InventoryNet")
    rv = _revenue(ctx)
    if len(inv) < 8 or len(rv) < 8:
        return {h: Abstain("no inventory or revenue history (not an inventory business)") for h in HZ_INV}
    yi, yr = _yoy(inv), _yoy(rv)
    gi = (yi["now"] / yi["then"] - 1)
    gr = (yr["now"] / yr["then"] - 1)
    # match by period end within a week (balance-sheet date vs quarter end)
    gr_m = gr.reindex(gi.index, method="nearest", tolerance=pd.Timedelta(days=7))
    kr = yr["known"].reindex(gi.index, method="nearest", tolerance=pd.Timedelta(days=7))
    d = (gi - gr_m).replace([np.inf, -np.inf], np.nan).dropna()
    known = pd.concat([yi["known"].reindex(d.index), kr.reindex(d.index)], axis=1).max(axis=1)
    signal = _daily(ctx, d, known)
    if signal.size < 504:
        return {h: Abstain("inventory history too short") for h in HZ_INV}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_INV}
