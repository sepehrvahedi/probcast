"""IC-010 "Accelerating sales growth lifts the stock" (sample idea card).

Rule from the card text: acceleration of revenue growth, i.e. this quarter's year-on-year growth
of trailing-12-month revenue minus the same growth measured one quarter earlier, from SEC
filings AS FIRST REPORTED. Bucketed by sign (accelerating vs decelerating, C1). Revenue uses
SalesRevenueNet before ASC 606 and RevenueFromContractWithCustomerExcludingAssessedTax after.
Related literature: Lakonishok, Shleifer & Vishny (1994) on extrapolation of past growth.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast.sdk import Abstain, analyzer, calibrate_c1
from probcast.sdk.fundamentals import quarterly_flow, quarterly_known, step_known

HZ = (63, 126, 252)
TAGS = (
    "us-gaap:SalesRevenueNet",
    "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
    "us-gaap:Revenues",
)


@analyzer(
    id="fundamental.sales_acceleration",
    version="1.1.0",
    name="Revenue growth acceleration (TTM, as first reported)",
    idea_card="IC-010",
    family="fundamental.growth",
    category="fundamental",
    report_section="fundamental",
    hypothesis="When year-on-year revenue growth is accelerating, forward returns are higher than the CAPM baseline implies.",
    expected_direction="positive",
    course_concepts=("EMH semi-strong form", "growth and valuation"),
    references=("ref:lakonishok-shleifer-vishny-1994",),
    horizons=HZ,
    calibrator="C1",
    data_dependencies=TAGS,
    min_history_sessions=756,
    params={},
)
def sales_acceleration(ctx, params):
    parts = [quarterly_flow(ctx, t) for t in TAGS]
    parts = [p for p in parts if not p.empty]
    if not parts:
        return {h: Abstain("no revenue facts") for h in HZ}
    q = (
        pd.concat(parts).groupby(level=0).first().sort_index()
    )  # first tag that reports a quarter wins
    ends = pd.Series(q.index, index=q.index)
    span = (ends - ends.shift(3)).dt.days  # four consecutive quarters end ~273 days apart
    ttm = q.rolling(4).sum()[(span >= 250) & (span <= 300)]
    lag = (
        pd.Series(ttm.index, index=ttm.index) - pd.Series(ttm.index, index=ttm.index).shift(4)
    ).dt.days
    growth = np.log(ttm / ttm.shift(4))[
        (lag >= 350) & (lag <= 380)
    ].dropna()  # same quarter a year earlier
    gap = (pd.Series(growth.index, index=growth.index).diff()).dt.days
    accel = (growth - growth.shift(1))[
        (gap >= 80) & (gap <= 100)
    ].dropna()  # vs the previous quarter
    if accel.size < 8:
        return {h: Abstain("fewer than 8 quarters of revenue acceleration") for h in HZ}
    px = ctx.prices()
    # D-101: a quarter's acceleration counts from the day after the filing that reported it
    kparts = [quarterly_known(ctx, t) for t in TAGS]
    kparts = [k for k in kparts if not k.empty]
    kn = pd.concat(kparts)["known"] if kparts else pd.Series(dtype="datetime64[ns]")
    kn = kn[~kn.index.duplicated(keep="first")].reindex(accel.index)
    signal = step_known(accel, kn, px.index).dropna()
    if signal.size < 504:
        return {h: Abstain("revenue-acceleration history too short") for h in HZ}
    return {h: calibrate_c1(ctx, signal, h, thresholds=(0.0,)) for h in HZ}
