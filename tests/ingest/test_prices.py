"""Raw-price reconstruction (ADR-007): split maths, availability, and 'Adj Close is never read'."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from probcast.config import SEED_DIR
from probcast.ingest import prices as P
from probcast.ingest.corporate_actions import load_split_seed
from tests.ingest.conftest import yahoo_frame

INGEST_SRC = Path(P.__file__).parent


def _splits(*pairs: tuple[str, float]) -> pd.DataFrame:
    return pd.DataFrame({"ex_date": [pd.Timestamp(d).date() for d, _ in pairs],
                         "value": [r for _, r in pairs]})


def test_raw_is_continuous_across_a_4_for_1_split():
    y = yahoo_frame("2020-08-20", "2020-09-04", splits={"2020-08-31": 4.0})
    raw = P.reconstruct_raw(y, _splits(("2020-08-31", 4.0))).set_index("session_date")
    d_prev, d_ex = pd.Timestamp("2020-08-28").date(), pd.Timestamp("2020-08-31").date()
    yc = y["Close"]
    # pre-split sessions are multiplied by 4, the ex-date and later are untouched
    assert raw.at[d_prev, "close"] == pytest.approx(4 * yc.iloc[yc.index.get_loc(pd.Timestamp("2020-08-28", tz="America/New_York"))], abs=1e-5)
    assert raw.at[d_ex, "close"] == pytest.approx(yc.loc[pd.Timestamp("2020-08-31", tz="America/New_York")], abs=1e-5)
    assert raw.at[d_prev, "volume"] == pytest.approx(
        y["Volume"].loc[pd.Timestamp("2020-08-28", tz="America/New_York")] / 4, abs=0.5)
    # continuity: the split-neutral raw return equals the vendor's adjusted return
    r_raw = raw.at[d_ex, "close"] * 4 / raw.at[d_prev, "close"] - 1
    r_vendor = (yc.loc[pd.Timestamp("2020-08-31", tz="America/New_York")]
                / yc.loc[pd.Timestamp("2020-08-28", tz="America/New_York")] - 1)
    assert r_raw == pytest.approx(r_vendor, abs=1e-6)
    # every high/low/open on pre-split days scaled by the same factor
    assert (raw.loc[:d_prev, "split_factor"] == 4).all()
    assert (raw.loc[d_ex:, "split_factor"] == 1).all()


def test_cumulative_factor_rebuilds_ipo_day_close():
    """Yahoo's split-adjusted first close x 224 (2x2x2x7x4) = the as-traded close."""
    seed = load_split_seed(SEED_DIR / "aapl_corporate_actions.csv", "AAPL")
    idx = pd.DatetimeIndex([pd.Timestamp("1980-12-12")]).tz_localize("America/New_York")
    y = pd.DataFrame({"Open": [0.128348], "High": [0.128906], "Low": [0.128348],
                      "Close": [0.1283479928970337], "Volume": [469033600.0]}, index=idx)
    raw = P.reconstruct_raw(y, seed)
    assert raw["split_factor"].iloc[0] == 224
    assert raw["close"].iloc[0] == pytest.approx(28.75, abs=0.01)
    assert raw["volume"].iloc[0] == 469033600 / 224


def test_adj_close_is_never_read():
    y = yahoo_frame("2020-08-20", "2020-09-04", splits={"2020-08-31": 4.0})
    poisoned = y.copy()
    poisoned["Adj Close"] = np.nan
    clean = y.drop(columns=["Adj Close"])
    now = pd.Timestamp("2021-01-01", tz="UTC")
    a = P.process_symbol("TEST", poisoned, None, now=now)
    b = P.process_symbol("TEST", clean, None, now=now)
    pd.testing.assert_frame_equal(a[0], b[0])
    pd.testing.assert_frame_equal(a[1], b[1])


def test_adj_close_literal_appears_only_in_the_drop_constant():
    """The only code reference to the vendor column is the constant used to drop it."""
    hits = [(f.name, line.strip()) for f in sorted(INGEST_SRC.glob("*.py"))
            for line in f.read_text().splitlines() if '"Adj Close"' in line or "'Adj Close'" in line]
    assert hits == [("prices.py", 'FORBIDDEN_COLUMN = "Adj Close"')]


def test_fetch_caches_raw_response_and_strips_adj_close(settings):
    y = yahoo_frame("2020-08-20", "2020-09-04")
    df, origin = P.fetch_history("^TEST", settings, fetcher=lambda s: y)
    assert origin.startswith("network:")
    assert "Adj Close" not in df.columns
    cached = list((settings.raw_dir / "yfinance" / "%5ETEST").glob("*.csv"))
    assert len(cached) == 1
    assert (settings.raw_dir / "yfinance" / "%5ETEST" / "index.jsonl").exists()
    again, origin2 = P.fetch_history("^TEST", settings, use_cache=True)
    assert origin2.startswith("cache:")
    assert "Adj Close" not in again.columns
    pd.testing.assert_series_equal(again["Close"], df["Close"], check_freq=False, check_index_type=False,
                                   check_exact=False, rtol=1e-12)


def test_available_at_is_session_close_and_partial_bars_are_dropped():
    # 2026-11-27 is the day after Thanksgiving (13:00 ET early close)
    y = yahoo_frame("2026-11-24", "2026-12-01")
    raw = P.reconstruct_raw(y, _splits())
    now = pd.Timestamp("2026-11-30T19:00:00Z")  # before Monday 30 Nov close
    rows, notes = P.price_rows("TEST", raw, now=now)
    assert rows["session_date"].max() == pd.Timestamp("2026-11-27").date()
    early = rows.loc[rows["session_date"] == pd.Timestamp("2026-11-27").date(), "available_at"].iloc[0]
    assert early == pd.Timestamp("2026-11-27T18:00:00Z")
    assert notes["dropped_incomplete"] == 2  # 30 Nov (not closed yet) and 1 Dec
    assert rows["available_at"].dt.tz is not None


def test_non_session_bars_are_dropped():
    y = yahoo_frame("2026-11-23", "2026-11-25")
    extra = y.iloc[[0]].copy()
    extra.index = pd.DatetimeIndex([pd.Timestamp("2026-11-26", tz="America/New_York")])  # Thanksgiving
    raw = P.reconstruct_raw(pd.concat([y, extra]), _splits())
    rows, notes = P.price_rows("TEST", raw, now=pd.Timestamp("2027-01-01", tz="UTC"))
    assert notes["dropped_non_session"] == 1
    assert pd.Timestamp("2026-11-26").date() not in set(rows["session_date"])


def test_index_symbols_get_no_split_adjustment():
    y = yahoo_frame("2020-08-20", "2020-09-04", splits={"2020-08-31": 4.0})  # bogus split on an index
    rows, ca, info = P.process_symbol("^IDX", y, None, now=pd.Timestamp("2021-01-01", tz="UTC"))
    assert info["split_ledger"] == "none (index)"
    assert ca.empty
    assert rows["close"].to_numpy() == pytest.approx(np.round(y["Close"].to_numpy(), 6))


def test_ingest_prices_collects_errors_without_failing(settings):
    def fetcher(sym):
        if sym == "BAD":
            raise RuntimeError("boom")
        return yahoo_frame("2020-08-20", "2020-09-04", splits={"2020-08-31": 4.0},
                           dividends={"2020-08-07": 0.205 / 4})
    res = P.ingest_prices(settings, ["GOOD", "BAD"], fetcher=fetcher,
                          now=pd.Timestamp("2021-01-01", tz="UTC"))
    assert "BAD" in res["errors"]
    assert "GOOD" in res["symbols"]
    ca = res["corporate_actions"]
    assert set(ca["action"]) == {"split", "dividend"}
    div = ca[ca["action"] == "dividend"].iloc[0]
    assert div["value"] == pytest.approx(0.205)  # vendor split-adjusted x future factor 4
