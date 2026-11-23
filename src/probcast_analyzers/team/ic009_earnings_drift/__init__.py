"""IC-009 "Earnings-day reaction keeps drifting" (sample idea card).

Rule from the card text: the stock's total return over the three sessions around the latest
quarterly-results release (close of the session before it to the close of the session after it;
Chan, Jegadeesh & Lakonishok 1996 use the announcement-window return), counted only if that
release was within the last 63 sessions (about one quarter; Bernard & Thomas 1989 document drift
over roughly 60 trading days). Bucketed by sign (C1). Release times are the 8-K acceptance times
in the events table (point-in-time: content_available_at <= origin close).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast.sdk import Abstain, analyzer, calibrate_c1

HZ = (21, 63)
WINDOW = 63


@analyzer(
    id="events.earnings_drift",
    version="1.0.0",
    name="Post-earnings drift (announcement-window return)",
    idea_card="IC-009",
    family="events",
    category="event",
    report_section="future",
    hypothesis="After a positive (negative) earnings-announcement reaction, returns over the next one to three months are higher (lower) than the CAPM baseline implies.",
    expected_direction="positive",
    course_concepts=("EMH semi-strong form", "under-reaction", "event studies"),
    references=("ref:bernard-thomas-1989", "ref:chan-jegadeesh-lakonishok-1996"),
    horizons=HZ,
    calibrator="C1",
    min_history_sessions=504,
    params={"window_sessions": WINDOW},
)
def earnings_drift(ctx, params):
    ev = ctx.events("earnings")
    if ev.empty:
        return {h: Abstain("no earnings releases in the events table") for h in HZ}
    log_tri = np.log(ctx.tri())
    sess = log_tri.index
    when = pd.to_datetime(ev["content_available_at"], utc=True).dt.tz_convert("America/New_York")
    # The release session: the session of the release date if it came before the close, else the next one.
    day = pd.DatetimeIndex(when.dt.tz_localize(None).dt.normalize())
    after_close = (when.dt.hour * 60 + when.dt.minute >= 16 * 60).to_numpy()
    pos = sess.searchsorted(day) + after_close.astype(int)
    pos = np.unique(pos[(pos >= 1) & (pos + 1 < len(sess))])
    if pos.size < 8:
        return {h: Abstain("fewer than 8 earnings releases with prices around them") for h in HZ}
    reaction = log_tri.iloc[pos + 1].to_numpy() - log_tri.iloc[pos - 1].to_numpy()
    known = pd.Series(
        reaction, index=sess[pos + 1]
    )  # known at the close of the session after the release
    w = int(params["window_sessions"])
    signal = known.reindex(sess).ffill(limit=w - 1).dropna()
    if signal.size < 252:
        return {h: Abstain("earnings-reaction history too short") for h in HZ}
    if signal.index[-1] != sess[-1]:
        return {h: Abstain(f"no earnings release in the last {w} sessions") for h in HZ}
    return {h: calibrate_c1(ctx, signal, h, thresholds=(0.0,)) for h in HZ}
