"""``ingest_all`` end to end, offline: synthetic vendor frames, mocked FRED, real seeds."""

from __future__ import annotations

import json

import httpx
import pandas as pd
import pytest

from probcast.ingest import fred as F
from probcast.ingest.common import load_pit_rules, load_ticker_config, price_universe
from probcast.ingest.run import format_report, ingest_all
from probcast.lake.schemas import SCHEMAS
from probcast.lake.store import Lake
from tests.ingest.conftest import yahoo_frame

NOW = pd.Timestamp("2021-01-06T00:00:00Z")


def fake_fetcher(symbol: str) -> pd.DataFrame:
    if symbol == "AAPL":
        # Yahoo split-adjusted history covering all five splits; IPO-day close as Yahoo shows it
        y = yahoo_frame("1980-12-12", "2021-01-05", base=0.128348,
                        splits={"1987-06-16": 2, "2000-06-21": 2, "2005-02-28": 2, "2014-06-09": 7,
                                "2020-08-31": 4},
                        dividends={"2012-08-09": 2.65 / 28, "2020-08-07": 0.205 / 4})
        y.iloc[0, y.columns.get_loc("Close")] = 0.128348
        return y
    return yahoo_frame("2020-11-02", "2021-01-05", base=50.0, seed=hash(symbol) % 1000)


def fred_transport() -> httpx.MockTransport:
    meta = F.load_series_meta()

    def handler(req: httpx.Request) -> httpx.Response:
        code = req.url.params["id"]
        if meta.loc[f"FRED:{code}", "frequency"] == "M":
            return httpx.Response(200, text=f"observation_date,{code}\n2020-10-01,1.0\n2020-11-01,1.1\n")
        return httpx.Response(200, text=f"observation_date,{code}\n2020-12-30,1.0\n2020-12-31,1.1\n")
    return httpx.MockTransport(handler)


@pytest.fixture(scope="module")
def report(tmp_path_factory):
    from probcast.config import Settings

    s = Settings(home=tmp_path_factory.mktemp("state"), sec_user_agent=None, fred_api_key=None,
                 tiingo_api_key=None)
    rep = ingest_all(s, tickers=["AAPL"], price_fetcher=fake_fetcher,
                     fred_client=httpx.Client(transport=fred_transport()), now=NOW)
    return s, rep


def test_report_counts_and_files(report):
    s, rep = report
    assert rep["errors"] == {}
    rc = rep["row_counts"]
    n_fred = sum(1 for k in load_pit_rules()["series"] if k.startswith("FRED:"))
    assert rc["events"] == 264
    assert rc["observations"] == 2 * n_fred
    assert rc["prices"] > 10_000
    n_px = len(price_universe(load_ticker_config("AAPL")))
    assert rc["series_catalog"] == n_fred + n_px + 1  # FRED + PX:<symbol> + EVENTS:<ticker>
    assert rep["edgar"].startswith("skipped")
    assert {w["table"] for w in rep["written"]} == {"prices", "corporate_actions", "observations",
                                                   "events", "series_catalog"}
    assert json.loads((s.data_dir / "ingest_reports").glob("*.json").__next__().read_text())
    assert not s.snapshots_dir.exists()  # snapshots are the lead's job
    assert "events" in format_report(rep)


def test_ipo_day_check_and_split_continuity(report):
    _, rep = report
    chk = rep["checks"]["AAPL"]
    assert chk["listing_date"] == "1980-12-12"
    assert chk["listing_day_raw_close"] == pytest.approx(28.749952)
    assert chk["ipo_offer_price_event_fact"] == 22.0
    assert set(chk["split_continuity"]) == {"1987-06-16", "2000-06-21", "2005-02-28", "2014-06-09",
                                             "2020-08-31"}
    for v in chk["split_continuity"].values():
        assert abs(v["split_neutral_return"]) < 0.06  # synthetic 1% daily vol; no split jump


def test_lake_batches_conform_to_schemas(report):
    s, _ = report
    lake = Lake(s)
    files = lake.files()
    assert files
    import pyarrow.parquet as pq

    for f in files:
        table = f.relative_to(s.lake_dir).parts[0]
        assert pq.read_schema(f).names == SCHEMAS[table].names


def test_dividends_written_as_traded(report):
    s, _ = report
    import pyarrow.parquet as pq

    f = next((s.lake_dir / "corporate_actions").rglob("*.parquet"))
    ca = pq.read_table(f).to_pandas()
    div = ca[(ca["ticker"] == "AAPL") & (ca["action"] == "dividend")].set_index("ex_date")["value"]
    assert div.loc[pd.Timestamp("2012-08-09").date()] == pytest.approx(2.65)
    splits = ca[(ca["ticker"] == "AAPL") & (ca["action"] == "split")]
    assert len(splits) == 5
    assert splits["announced_at"].notna().all()


def test_missing_rules_and_stale_lists_present(report):
    _, rep = report
    assert rep["missing_rules"] == []
    assert isinstance(rep["stale_series"], list)


def test_synthetic_tickers_are_never_fetched(settings, monkeypatch):
    import probcast.ingest.run as R
    from probcast.ingest.common import is_synthetic_config, real_ticker_configs

    assert "AAPL" in real_ticker_configs()
    assert is_synthetic_config({"ticker": "X", "name": "Synthetic Demo Inc."})
    assert is_synthetic_config({"ticker": "X", "synthetic": True})
    assert not is_synthetic_config({"ticker": "X", "name": "Real Co."})

    def boom(symbol):
        raise AssertionError("must not fetch")
    monkeypatch.setattr(R, "load_ticker_config", lambda t: {"ticker": t, "name": "Synthetic X"})
    with pytest.raises(ValueError, match="synthetic"):
        R.ingest_all(settings, tickers=["FAKE"], price_fetcher=boom, write=False)


def test_fred_universe_includes_series_named_in_ticker_config():
    from probcast.ingest.common import load_pit_rules

    extra = F.series_universe(load_pit_rules(), [{"ticker": "X", "some_series": "FRED:NEWONE",
                                                   "name": "FRED:not-a-series-key-but-string"}])
    assert "FRED:NEWONE" in extra
