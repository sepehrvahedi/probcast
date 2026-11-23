"""IC-011 "Sell in May and go away" (sample idea card).

Rule from the card text: an origin in November-April (the "winter" half) vs May-October
(Bouman & Jacobsen 2002). The signal is 1 in the winter half, 0 otherwise, bucketed (C1). Its
natural horizon is six months (126 sessions); one and three months are also evaluated.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast.sdk import Abstain, analyzer, calibrate_c1

HZ = (21, 63, 126)
WINTER = (11, 12, 1, 2, 3, 4)


@analyzer(
    id="calendar.halloween",
    version="1.0.0",
    name="Halloween indicator (November-April vs May-October)",
    idea_card="IC-011",
    family="calendar",
    category="statistical",
    report_section="future",
    hypothesis="Returns from origins in November-April are higher than the CAPM baseline implies, and lower from May-October.",
    expected_direction="positive",
    course_concepts=("EMH weak form", "calendar anomalies"),
    references=("ref:bouman-jacobsen-2002",),
    horizons=HZ,
    calibrator="C1",
    min_history_sessions=504,
    params={"winter_months": list(WINTER)},
)
def halloween(ctx, params):
    idx = ctx.prices().index
    if idx.size < 504:
        return {h: Abstain("insufficient history") for h in HZ}
    months = set(int(m) for m in params["winter_months"])
    signal = pd.Series(np.isin(idx.month, list(months)).astype(float), index=idx)
    return {h: calibrate_c1(ctx, signal, h, thresholds=(0.5,)) for h in HZ}
