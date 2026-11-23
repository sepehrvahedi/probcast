"""IC-008 "Golden cross: above the 200-day average is bullish" (sample idea card).

Rule from the card text: price above vs below its 200-day simple moving average. Window 200 is
the literature default (Brock, Lakonishok & LeBaron 1992); no tuning (implementer rule).
"""

from __future__ import annotations

import numpy as np

from probcast.sdk import Abstain, analyzer, calibrate_c1

HZ = (21, 63, 126, 252)


@analyzer(
    id="technical.sma200",
    version="1.0.0",
    name="Price vs 200-day moving average",
    idea_card="IC-008",
    family="technical.trend",
    category="technical",
    report_section="future",
    hypothesis="When the price is above its 200-day moving average, forward returns are higher than the CAPM baseline implies.",
    expected_direction="positive",
    course_concepts=("EMH weak form", "technical analysis"),
    references=("ref:brock-lakonishok-lebaron-1992",),
    horizons=HZ,
    calibrator="C1",
    min_history_sessions=504,
    params={"window": 200},
)
def sma200(ctx, params):
    w = int(params["window"])
    px = ctx.prices()
    if px.size < w + 504:
        return {h: Abstain("insufficient history") for h in HZ}
    signal = np.log(px / px.rolling(w).mean()).dropna()
    return {h: calibrate_c1(ctx, signal, h, thresholds=(0.0,)) for h in HZ}
