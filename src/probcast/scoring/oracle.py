"""Outcome oracle (architecture L5): realised outcomes for scoring ONLY.

Never available to analyzers. Each (origin, horizon) pair is tagged by its OUTCOME date
segment (dev / val / holdout; RT-03). Holdout outcomes are sealed until the single reveal.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.contract.grid import segment_for_outcome
from probcast.lake.store import Store
from probcast.pit.context import AsOfContext


class HoldoutLocked(PermissionError):
    pass


def realised(store: Store, ticker: str, origins: pd.DatetimeIndex, h: int) -> pd.DataFrame:
    """y_{t,h} = ln TRI_{t+h} - ln TRI_t from the full store, with outcome date and segment."""
    px = store.table("prices")
    last = pd.to_datetime(px.loc[px["ticker"] == ticker, "session_date"]).max()
    full = AsOfContext(store, last, ticker)
    log_tri = np.log(full.tri())
    sess = cal.sessions()
    rows = []
    for t in origins:
        i = sess.get_loc(pd.Timestamp(t))
        if i + h >= len(sess):
            continue
        out_d = sess[i + h]
        if out_d > last or t not in log_tri.index or out_d not in log_tri.index:
            continue
        rows.append({"origin": t, "horizon": h, "outcome_date": out_d, "y": float(log_tri.loc[out_d] - log_tri.loc[t]),
                     "segment": segment_for_outcome(out_d.date())})
    return pd.DataFrame(rows, columns=["origin", "horizon", "outcome_date", "y", "segment"])


def sealed(df: pd.DataFrame, *, revealed: bool) -> pd.DataFrame:
    """Drop holdout pairs unless the reveal has happened (NFR-SCI-05)."""
    return df if revealed else df[df["segment"] != "holdout"]
