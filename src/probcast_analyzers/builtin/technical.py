"""Price-based starter analyzers (A5 §9; families technical.trend / technical.reversion).

Parameters are literature defaults (implementer rule, ADR-012): no tuning on AAPL data.
"""

from __future__ import annotations

import numpy as np

from probcast.sdk import Abstain, analyzer, calibrate_c1, calibrate_c3

TREND_HORIZONS = (21, 63, 126, 252)


@analyzer(
    id="technical.tsmom_12_1",
    version="1.0.0",
    name="Time-series momentum 12-1",
    family="technical.trend",
    category="technical",
    report_section="future",
    hypothesis="When the past 12-month return excluding the most recent month is positive, forward returns are higher than the CAPM anchor implies.",
    expected_direction="positive",
    course_concepts=("EMH weak form", "behavioural finance (under-reaction)"),
    references=("ref:moskowitz-ooi-pedersen-2012", "ref:jegadeesh-titman-1993"),
    horizons=TREND_HORIZONS,
    calibrator="C1",
    min_history_sessions=504,
    params={"lookback": 252, "skip": 21},
)
def tsmom(ctx, params):
    lb, skip = int(params["lookback"]), int(params["skip"])
    log_tri = np.log(ctx.tri())
    if log_tri.size < lb + skip + 252:
        return {h: Abstain("insufficient history") for h in TREND_HORIZONS}
    signal = (log_tri.shift(skip) - log_tri.shift(lb)).dropna()
    return {h: calibrate_c1(ctx, signal, h, thresholds=(0.0,)) for h in TREND_HORIZONS}


@analyzer(
    id="technical.reversal_1m",
    version="1.0.0",
    name="Short-term reversal (1 month)",
    family="technical.reversion",
    category="technical",
    report_section="future",
    hypothesis="A large past-month return is followed by a partial reversal over the next month.",
    expected_direction="negative",
    course_concepts=("EMH weak form", "liquidity provision"),
    references=("ref:jegadeesh-1990", "ref:lehmann-1990"),
    horizons=(5, 21),
    calibrator="C3",
    min_history_sessions=504,
    params={"window": 21},
)
def reversal(ctx, params):
    w = int(params["window"])
    log_tri = np.log(ctx.tri())
    if log_tri.size < 504:
        return {h: Abstain("insufficient history") for h in (5, 21)}
    signal = (log_tri - log_tri.shift(w)).dropna()
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in (5, 21)}
