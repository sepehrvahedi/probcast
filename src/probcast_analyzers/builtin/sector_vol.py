"""Sector relative strength and implied-volatility starter analyzers (A5 ANL-030, ANL-006)."""

from __future__ import annotations

import numpy as np

from probcast.sdk import HORIZONS, Abstain, Forecast, analyzer, calibrate_c1

HZ = (21, 63, 126, 252)


@analyzer(
    id="sector.relative_strength",
    version="1.0.0",
    name="Relative strength vs the Nasdaq-100 (6 months)",
    family="technical.trend",
    category="sector",
    report_section="sector",
    hypothesis="Outperformance of the sector index over the past six months persists over the following months (industry-relative momentum).",
    expected_direction="positive",
    course_concepts=("sector analysis", "relative valuation", "momentum"),
    references=("ref:moskowitz-grinblatt-1999",),
    horizons=HZ,
    calibrator="C1",
    min_history_sessions=756,
    params={"lookback": 126},
)
def relative_strength(ctx, params):
    bm = ctx.benchmark("nasdaq")
    if not bm:
        return {h: Abstain("no nasdaq benchmark configured") for h in HZ}
    a = np.log(ctx.tri())
    b = np.log(ctx.tri(bm))
    if b.size < 504:
        return {h: Abstain("benchmark history too short") for h in HZ}
    lb = int(params["lookback"])
    rel = (a - a.shift(lb)) - (b - b.shift(lb)).reindex(a.index)
    return {h: calibrate_c1(ctx, rel.dropna(), h, thresholds=(0.0,)) for h in HZ}


@analyzer(
    id="volatility.implied_vol",
    version="1.0.0",
    name="Implied-volatility scale (option-implied)",
    family="volatility",
    category="statistical",
    report_section="future",
    informs=("scale",),
    hypothesis="The option market's implied volatility forecasts realised volatility better than history alone; the location is the CAPM anchor.",
    expected_direction="scale",
    course_concepts=("risk", "market efficiency (options)"),
    references=("ref:christensen-prabhala-1998", "ref:poon-granger-2003"),
    horizons=HORIZONS,
    calibrator="C5",
    min_history_sessions=252,
    params={},
)
def implied_vol(ctx, params):
    sid = ctx.config_value("implied_vol_series")
    iv = ctx.series(sid).dropna() if sid else None
    if iv is None or iv.empty:
        return {h: Abstain("no implied-volatility series") for h in HORIZONS}
    sigma_ann = float(iv.iloc[-1]) / 100.0
    out = {}
    for h in HORIZONS:
        shape = ctx.shape(h)
        q = ctx.anchor_median(h) + sigma_ann * np.sqrt(h / 252) * shape
        out[h] = Forecast(quantiles=q, signal=sigma_ann, calibration={"method": "C5", "implied_vol": sigma_ann})
    return out
