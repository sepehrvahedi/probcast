"""NYSE (XNYS) trading calendar helpers. All timestamps are tz-aware UTC.

Decision time for an origin is the session close (16:00 America/New_York, 13:00 on early
closes). A row is usable at origin t iff ``available_at <= close(t)`` (contract §2).
"""

from __future__ import annotations

from datetime import date, datetime
from functools import lru_cache

import exchange_calendars as xcals
import numpy as np
import pandas as pd

NY = "America/New_York"


@lru_cache(maxsize=1)
def _cal() -> xcals.ExchangeCalendar:
    return xcals.get_calendar("XNYS", start="1980-01-01", end="2028-12-31")


@lru_cache(maxsize=1)
def sessions() -> pd.DatetimeIndex:
    """All XNYS session labels (naive dates) in the calendar range."""
    return _cal().sessions


@lru_cache(maxsize=1)
def closes() -> pd.Series:
    """Session label -> close timestamp (UTC)."""
    c = _cal().closes
    return c.dt.tz_localize("UTC") if c.dt.tz is None else c.dt.tz_convert("UTC")


@lru_cache(maxsize=1)
def close_values() -> np.ndarray:
    """Session closes as naive datetime64[ns] in UTC (fast searchsorted)."""
    return closes().dt.tz_convert(None).to_numpy(dtype="datetime64[ns]")


def to_utc_naive(ts: pd.Series | pd.Timestamp | np.ndarray) -> np.ndarray:
    """tz-aware timestamps -> naive UTC datetime64[ns] array."""
    if isinstance(ts, pd.Series):
        return ts.dt.tz_convert("UTC").dt.tz_convert(None).to_numpy(dtype="datetime64[ns]")
    if isinstance(ts, pd.Timestamp):
        t = ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")
        return np.asarray([t.tz_convert(None).to_datetime64()])
    return np.asarray(ts, dtype="datetime64[ns]")


def session_close(d: date | pd.Timestamp) -> pd.Timestamp:
    return closes().loc[pd.Timestamp(d).normalize().tz_localize(None)]


def sessions_between(start: date | str, end: date | str) -> pd.DatetimeIndex:
    s = sessions()
    return s[(s >= pd.Timestamp(start)) & (s <= pd.Timestamp(end))]


def first_session_closing_after(ts: datetime | pd.Timestamp) -> pd.Timestamp:
    """First session whose close is >= ts (A2 QNT-281 day-0 rule uses '> ts' via strict=True)."""
    idx = int(np.searchsorted(close_values(), to_utc_naive(pd.Timestamp(ts))[0], side="left"))
    return closes().index[idx]


def add_sessions(d: date | pd.Timestamp, h: int) -> pd.Timestamp:
    """The session h sessions after session d (d must be a session)."""
    s = sessions()
    i = s.get_loc(pd.Timestamp(d))
    return s[i + h]


def month_end_sessions(start: date | str, end: date | str) -> pd.DatetimeIndex:
    """Last session of each month in [start, end]."""
    s = sessions_between(start, end)
    df = pd.Series(s, index=s)
    return pd.DatetimeIndex(df.groupby([s.year, s.month]).max().values)


def n_sessions_between(d0: date | pd.Timestamp, d1: date | pd.Timestamp) -> int:
    """Number of sessions after d0 up to and including d1 (computed, never hard-coded; RT-25)."""
    s = sessions()
    return int(((s > pd.Timestamp(d0)) & (s <= pd.Timestamp(d1))).sum())
