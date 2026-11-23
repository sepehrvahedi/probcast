"""FRED/ALFRED availability rules, parsing and the offline fetch path (httpx.MockTransport)."""

from __future__ import annotations

import json
from dataclasses import replace

import httpx
import pandas as pd
import pytest

from probcast.ingest import fred as F
from probcast.ingest.common import load_pit_rules
from probcast.lake.store import conform

UTC = "UTC"


def ts(s: str) -> pd.Timestamp:
    return pd.Timestamp(s, tz=UTC)


def test_every_ruled_series_has_metadata_and_a_valid_rule():
    rules, meta = load_pit_rules(), F.load_series_meta()
    for sid, cls in rules["series"].items():
        assert sid in meta.index, sid
        assert cls in rules["classes"], sid
        m = meta.loc[sid]
        assert m["licence_class"] in {"L0", "L1", "L2"}
        if cls in F.VINTAGE_CLASSES:
            assert m["assumed_lag_rule"] in F.ASSUMED_RULES, sid
        assert m["release_time_et"], sid


def test_parse_fredgraph_both_layouts_and_missing_values():
    new = "observation_date,DGS10\n2026-11-11,\n2026-11-12,4.10\n2026-11-13,.\n2026-11-16,4.12\n"
    old = "DATE,DGS10\n2026-11-12,4.10\n"
    a = F.parse_fredgraph_csv(new)
    assert a["value"].tolist() == [4.10, 4.12]
    assert str(a["period_date"].iloc[0]) == "2026-11-12"
    assert len(F.parse_fredgraph_csv(old)) == 1
    with pytest.raises(F.FredError):
        F.parse_fredgraph_csv("<html>error</html>\n")


def test_market_observable_same_session_close_and_holiday_rolls_forward():
    obs = pd.DataFrame({"period_date": pd.to_datetime(["2026-11-13", "2026-11-26"]).date,
                        "value": [1.0, 2.0]})
    meta = F.load_series_meta().loc["FRED:DEXUSEU"]
    rows, info = F.build_latest_rows("FRED:DEXUSEU", "h10_fx", obs, meta, F.load_release_overrides())
    assert info["available_basis"] == "market_observable"
    assert rows["available_at"].tolist() == [ts("2026-11-13 21:00"), ts("2026-11-27 18:00")]  # Thanksgiving -> early close Friday
    conform("observations", rows)


@pytest.mark.parametrize(("sid", "period", "expected"), [
    # CPI Sep 2025 (released 24 Oct 2025): assumed end of m+1 -> Fri 31 Oct 2025 close
    ("FRED:CPIAUCSL", "2025-09-01", "2025-10-31 20:00"),
    # UNRATE Sep 2025 was delayed to 20 Nov 2025 by the shutdown: dated override wins
    ("FRED:UNRATE", "2025-09-01", "2025-11-20 21:00"),
    # PPI Oct 2025 published 14 Jan 2026
    ("FRED:PCU334413334413", "2025-10-01", "2026-01-14 21:00"),
    # UMCSENT: release time unknown (23:59) at end of m+1 (Sat 31 Oct 2026) -> Mon 2 Nov close
    ("FRED:UMCSENT", "2026-09-01", "2026-11-02 21:00"),
    # FEDFUNDS: after 16:15 ET on day 1 of m+1 -> second session of m+1
    ("FRED:FEDFUNDS", "2026-09-01", "2026-10-02 20:00"),
])
def test_assumed_lag_rules_and_overrides(sid, period, expected):
    obs = pd.DataFrame({"period_date": [pd.Timestamp(period).date()], "value": [1.0]})
    cls = load_pit_rules()["series"][sid]
    rows, info = F.build_latest_rows(sid, cls, obs, F.load_series_meta().loc[sid], F.load_release_overrides())
    assert info["available_basis"] == "assumed_lag"
    assert rows["available_at"].iloc[0] == ts(expected)
    assert rows["available_at"].iloc[0].date() > pd.Timestamp(period).date()


def test_overrides_never_make_availability_earlier():
    ov = pd.DataFrame({"series_id": ["X"], "period_date": ["2025-09-01"], "release_date": ["2025-10-01"],
                       "release_time_et": ["08:30"]})
    base = pd.DatetimeIndex([ts("2025-10-31 20:00")])
    out, n = F.apply_overrides("X", ["2025-09-01"], base, ov)
    assert out[0] == base[0]
    assert n == 0


def test_h10_weekly_release_rolls_past_federal_holidays():
    # Fri 9 Oct 2026 -> release Mon 12 Oct is Columbus Day (Fed closed) -> Tue 13 Oct 16:15 -> Wed close
    assert F.h10_release_available_at(["2026-10-09"])[0] == ts("2026-10-14 20:00")
    # Mon 9 Nov 2026 -> next Monday 16 Nov 16:15 -> Tue 17 Nov close
    assert F.h10_release_available_at(["2026-11-09"])[0] == ts("2026-11-17 21:00")
    obs = pd.DataFrame({"period_date": pd.to_datetime(["2026-11-13"]).date, "value": [120.0]})
    rows, _ = F.build_latest_rows("FRED:DTWEXBGS", "constructed_weekly", obs,
                                  F.load_series_meta().loc["FRED:DTWEXBGS"], F.load_release_overrides())
    assert rows["available_at"].iloc[0] == ts("2026-11-17 21:00")


def _alfred_page(obs: list[dict], count: int | None = None, offset: int = 0) -> dict:
    return {"realtime_start": "1776-07-04", "realtime_end": "9999-12-31", "count": count or len(obs),
            "offset": offset, "limit": 100000, "observations": obs}


def test_alfred_vintage_rows_one_per_vintage():
    pages = [_alfred_page([
        {"realtime_start": "2026-10-24", "realtime_end": "2026-11-12", "date": "2026-09-01", "value": "320.1"},
        {"realtime_start": "2026-11-13", "realtime_end": "9999-12-31", "date": "2026-09-01", "value": "320.3"},
        {"realtime_start": "2026-11-13", "realtime_end": "9999-12-31", "date": "2026-10-01", "value": "."},
    ])]
    v = F.parse_alfred_pages(pages)
    rows = F.build_vintage_rows("FRED:CPIAUCSL", v, "08:30")
    assert rows["vintage_id"].tolist() == ["2026-10-24", "2026-11-13"]
    assert (rows["available_basis"] == "vintage").all()
    # 08:30 ET release on a session day -> usable at that day's close
    assert rows["available_at"].tolist() == [ts("2026-10-26 20:00"), ts("2026-11-13 21:00")]
    conform("observations", rows)


def _mock_transport(calls: list[str]):
    meta = F.load_series_meta()

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        if request.url.host == "api.stlouisfed.org":
            assert request.url.params["series_id"]
            return httpx.Response(200, json=_alfred_page([
                {"realtime_start": "2026-10-15", "realtime_end": "9999-12-31", "date": "2026-09-01", "value": "1.5"}]))
        code = request.url.params["id"]
        freq = meta.loc[f"FRED:{code}", "frequency"]
        body = (f"observation_date,{code}\n2026-09-01,1.0\n2026-10-01,1.1\n" if freq == "M"
                else f"observation_date,{code}\n2026-11-12,1.0\n2026-11-13,\n2026-11-16,1.2\n")
        return httpx.Response(200, text=body)
    return httpx.MockTransport(handler)


def test_ingest_fred_offline_without_key(settings):
    calls: list[str] = []
    client = httpx.Client(transport=_mock_transport(calls))
    res = F.ingest_fred(settings, client=client)
    assert res["errors"] == {}
    assert res["mode"] == "fredgraph_latest"
    assert all("fred.stlouisfed.org" in c for c in calls)
    obs, cat = res["observations"], res["series_catalog"]
    assert set(obs["available_basis"]) == {"market_observable", "assumed_lag"}
    assert (obs["vintage_id"] == "latest").all()
    assert len(cat) == len(load_pit_rules()["series"])
    cpi = cat.set_index("series_id").loc["FRED:CPIAUCSL"]
    assert cpi["pit_grade"] == "C"
    assert cpi["strict_rule"] == "alfred_realtime_start"
    assert cat.set_index("series_id").loc["FRED:DGS10", "pit_grade"] == "B"
    assert cat.set_index("series_id").loc["FRED:VIXCLS", "licence_class"] == "L2"
    conform("observations", obs)
    conform("series_catalog", cat)
    assert (settings.raw_dir / "fred" / "DGS10" / "index.jsonl").exists()


def test_ingest_fred_with_key_uses_alfred_and_never_caches_the_key(settings):
    keyed = replace(settings, fred_api_key="TESTKEY123")
    calls: list[str] = []
    client = httpx.Client(transport=_mock_transport(calls))
    res = F.ingest_fred(keyed, client=client)
    assert res["mode"] == "alfred_vintages"
    assert res["errors"] == {}
    cat = res["series_catalog"].set_index("series_id")
    assert cat.loc["FRED:CPIAUCSL", "available_basis"] == "vintage"
    assert cat.loc["FRED:CPIAUCSL", "pit_grade"] == "A"
    assert cat.loc["FRED:DGS10", "available_basis"] == "market_observable"
    for p in (settings.raw_dir).rglob("*"):
        if p.is_file():
            assert "TESTKEY123" not in p.read_text(errors="ignore"), p
    cpi = res["observations"].query("series_id == 'FRED:CPIAUCSL'")
    assert cpi["vintage_id"].tolist() == ["2026-10-15"]
    assert json.loads(json.dumps(res["series"]))  # serialisable


def test_ingest_fred_reports_series_without_rule(settings):
    client = httpx.Client(transport=_mock_transport([]))
    res = F.ingest_fred(settings, ["FRED:NOTRULED"], client=client)
    assert "FRED:NOTRULED" in res["errors"]
