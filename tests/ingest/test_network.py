"""Real-network smoke tests. Skipped unless PROBCAST_NETWORK_TESTS=1 (run with ``-m network``)."""

from __future__ import annotations

import os

import httpx
import pytest

from probcast.config import SEED_DIR
from probcast.ingest import fred as F
from probcast.ingest import prices as P
from probcast.ingest.corporate_actions import load_split_seed

pytestmark = [
    pytest.mark.network,
    pytest.mark.skipif(os.environ.get("PROBCAST_NETWORK_TESTS") != "1",
                       reason="set PROBCAST_NETWORK_TESTS=1 to run network tests"),
]


def test_yfinance_aapl_ipo_day_raw_close(settings):
    y, _ = P.fetch_history("AAPL", settings)
    seed = load_split_seed(SEED_DIR / "aapl_corporate_actions.csv", "AAPL")
    raw = P.reconstruct_raw(y, seed).set_index("session_date")
    import pandas as pd

    assert raw.at[pd.Timestamp("1980-12-12").date(), "close"] == pytest.approx(28.75, abs=0.01)


def test_fredgraph_dgs10(settings):
    with httpx.Client(timeout=60, follow_redirects=True) as c:
        text, _ = F.fetch_fredgraph("FRED:DGS10", settings, c)
    assert len(F.parse_fredgraph_csv(text)) > 10_000
