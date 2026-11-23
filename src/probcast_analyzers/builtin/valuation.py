"""Valuation starter analyzer (A5 ANL-060; family valuation).

Earnings yield (TTM diluted EPS / price) relative to the stock's own expanding history, using
fundamentals AS FIRST REPORTED. Evaluated mainly at 63 sessions; no 12-month skill claims for
XBRL-era analyzers (ADR-005).
"""

from __future__ import annotations

import numpy as np

from probcast.sdk import Abstain, analyzer, calibrate_c1
from probcast.sdk.fundamentals import quarterly_known, step_known, ttm_per_share_base

HZ = (63, 126, 252)
EPS_TAG = "us-gaap:EarningsPerShareDiluted"


@analyzer(
    id="valuation.earnings_yield",
    version="1.1.0",
    name="Earnings yield vs own history (TTM diluted EPS / price)",
    family="valuation",
    category="fundamental",
    report_section="fundamental",
    hypothesis="When the earnings yield is in the top third of its own history the stock is cheap relative to its past, and forward excess returns are higher.",
    expected_direction="positive",
    course_concepts=("valuation multiples (P/E)", "mean reversion in valuation", "EMH semi-strong form"),
    references=("ref:basu-1977", "ref:campbell-shiller-1988"),
    horizons=HZ,
    calibrator="C1",
    data_dependencies=(EPS_TAG,),
    min_history_sessions=756,
    params={"terciles": 3},
)
def earnings_yield(ctx, params):
    eps = ttm_per_share_base(ctx, EPS_TAG)
    if eps.size < 8:
        return {h: Abstain("fewer than 8 quarters of as-first-reported EPS") for h in HZ}
    px = ctx.prices()
    # D-101: each TTM value counts from the day after the filing that completed it (not period end)
    kn = quarterly_known(ctx, EPS_TAG, per_share_base=True)["known"].reindex(eps.index)
    ey = (step_known(eps, kn, px.index) / px).replace([np.inf, -np.inf], np.nan).dropna()
    if ey.size < 504:
        return {h: Abstain("earnings-yield history too short") for h in HZ}
    return {h: calibrate_c1(ctx, ey, h, n_terciles=int(params["terciles"])) for h in HZ}
