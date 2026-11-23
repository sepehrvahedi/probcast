"""Macro starter analyzers (A5 ANL-040/041; families macro.fx / macro.rates).

Literature-default parameters only (implementer rule, ADR-012).
"""

from __future__ import annotations

import numpy as np

from probcast.sdk import Abstain, analyzer, calibrate_c3

HZ = (21, 63, 126, 252)


@analyzer(
    id="macro.usd_sensitivity",
    version="1.0.0",
    name="USD strength (13-week change in the broad dollar index)",
    family="macro.fx",
    category="macro",
    report_section="macro",
    hypothesis="A stronger US dollar over the past quarter lowers a multinational's USD-reported foreign earnings and is followed by lower excess returns.",
    expected_direction="negative",
    course_concepts=("FX exposure of multinationals", "transaction and translation exposure"),
    references=("ref:jorion-1990", "ref:apple-10k-fx-risk"),
    horizons=HZ,
    calibrator="C3",
    data_dependencies=("FRED:DTWEXBGS",),
    min_history_sessions=756,
    params={"weeks": 13},
)
def usd_sensitivity(ctx, params):
    sid = ctx.config_value("usd_series") or "FRED:DTWEXBGS"
    usd = ctx.series(sid).dropna()
    if usd.size < 156:
        return {h: Abstain("USD index history too short") for h in HZ}
    sig = np.log(usd).diff(int(params["weeks"])).dropna()
    daily = sig.reindex(ctx.prices().index, method="ffill").dropna()
    return {h: calibrate_c3(ctx, daily, h, expected_sign=-1) for h in HZ}


@analyzer(
    id="macro.real_rates",
    version="1.0.0",
    name="Real-yield change (3-month change in the 10-year TIPS yield)",
    family="macro.rates",
    category="macro",
    report_section="macro",
    hypothesis="Rising real yields raise the discount rate on long-duration growth equity and are followed by lower excess returns.",
    expected_direction="negative",
    course_concepts=("discounting and the cost of capital", "equity duration"),
    references=("ref:campbell-ammer-1993", "ref:dechow-sloan-soliman-2004"),
    horizons=HZ,
    calibrator="C3",
    data_dependencies=("FRED:DFII10",),
    min_history_sessions=756,
    params={"sessions": 63},
)
def real_rates(ctx, params):
    sid = ctx.config_value("real_yield_series") or "FRED:DFII10"
    ry = ctx.series(sid).dropna()
    if ry.size < 504:
        return {h: Abstain("real-yield history too short") for h in HZ}
    sig = ry.diff(int(params["sessions"])).dropna()
    daily = sig.reindex(ctx.prices().index, method="ffill").dropna()
    return {h: calibrate_c3(ctx, daily, h, expected_sign=-1) for h in HZ}
