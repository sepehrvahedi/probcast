"""Shared fixtures for ingest tests: an isolated state root and synthetic vendor frames."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from probcast import calendar as cal
from probcast.config import Settings

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(home=tmp_path / "state", sec_user_agent=None, fred_api_key=None,
                    tiingo_api_key=None)


def yahoo_frame(start: str, end: str, *, splits: dict[str, float] | None = None,
                dividends: dict[str, float] | None = None, base: float = 100.0,
                seed: int = 0) -> pd.DataFrame:
    """Synthetic yfinance-shaped history (split-adjusted OHLC, like Yahoo) on XNYS sessions."""
    days = cal.sessions_between(start, end)
    rng = np.random.default_rng(seed)
    close = base * np.exp(np.cumsum(rng.normal(0, 0.01, len(days))))
    idx = pd.DatetimeIndex(days).tz_localize("America/New_York")
    df = pd.DataFrame({
        "Open": close * 0.99, "High": close * 1.01, "Low": close * 0.98, "Close": close,
        "Adj Close": close * 0.5,  # deliberately wrong: must never be read
        "Volume": rng.integers(1_000, 10_000, len(days)).astype(float) * 224,
        "Dividends": 0.0, "Stock Splits": 0.0,
    }, index=idx)
    for d, r in (splits or {}).items():
        df.loc[pd.Timestamp(d).tz_localize("America/New_York"), "Stock Splits"] = r
    for d, v in (dividends or {}).items():
        df.loc[pd.Timestamp(d).tz_localize("America/New_York"), "Dividends"] = v
    df.index.name = "Date"
    return df
