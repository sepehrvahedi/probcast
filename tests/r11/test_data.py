"""R1.1 data slice API (server/ext/data.py) on the synthetic fixture world (ticker DEMO).

No warm-up is needed: every endpoint here reads the store directly (descriptive results are
cached per snapshot, not queued as jobs).
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from probcast import calendar as cal
from probcast.server.app import create_app
from probcast.server.workspace import ComputeOptions

BASE = "http://127.0.0.1:8000"
API = "/api/v1"


@pytest.fixture(scope="module")
def client(tmp_path_factory: pytest.TempPathFactory) -> Iterator[TestClient]:
    home = tmp_path_factory.mktemp("probcast-home-data")
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("PROBCAST_HOME", str(home))
        mp.delenv("PROBCAST_DATA", raising=False)
        mp.delenv("PROBCAST_SNAPSHOT", raising=False)
        app = create_app(data="fixtures", options=ComputeOptions(origin_stride=6, workers=1, n_boot=50, leak=False, job_workers=1),
                         web_dist=Path(home) / "no-dist")
        with TestClient(app, base_url=BASE) as c:
            yield c


def get(c: TestClient, path: str, **params: object) -> dict:
    r = c.get(f"{API}{path}", params=params)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("fixture") is True
    assert body["provenance"]["snapshot"]  # every response carries provenance
    return body


def test_series_catalog_has_rules_and_licences(client: TestClient) -> None:
    body = get(client, "/series")
    items = {i["id"]: i for i in body["items"]}
    assert {"FRED:DGS1", "FRED:CPIAUCSL", "FRED:DTWEXBGS", "PX:DEMO"} <= set(items)
    for i in items.values():
        assert i["licence"], i["id"]
        assert i["rule"], i["id"]
        assert i["coverage"]["rows"] > 0
    assert items["FRED:CPIAUCSL"]["vintages"] is True
    assert items["FRED:DGS1"]["vintages"] is False


def test_series_with_vintages_and_range(client: TestClient) -> None:
    body = get(client, "/series/FRED:CPIAUCSL", **{"from": "2015-01-01", "to": "2016-12-31"})
    assert body["points"]
    assert body["first_release"]
    assert body["realtime"]
    assert all("2015-01-01" <= p[0] <= "2016-12-31" for p in body["points"])
    assert body["revisions"] > 0
    first = dict((p[0], p[1]) for p in body["first_release"])
    latest = dict((p[0], p[1]) for p in body["points"])
    k = next(iter(latest))
    assert latest[k] == pytest.approx(first[k] * 1.001)  # the fixture's revised vintage
    # As published: the newest period known at each release lags the release date.
    assert all(step[2] < step[0] for step in body["realtime"])


def test_series_errors(client: TestClient) -> None:
    assert client.get(f"{API}/series/FRED:NOPE").status_code == 404
    assert client.get(f"{API}/series/FRED:DGS1", params={"vintage": "bogus"}).status_code == 422


def test_fundamentals_cells_cite_filings(client: TestClient) -> None:
    body = get(client, "/fundamentals/DEMO", period="quarterly")
    rev = next(line for line in body["lines"] if line["key"] == "revenue")
    cells = [c for c in rev["cells"].values() if c]
    assert cells
    assert all(c["accession"] and c["available_at"] and c["provenance"]["kind"] == "filing" for c in cells)
    assert client.get(f"{API}/fundamentals/NOPE").status_code == 404
    facts = get(client, "/fundamentals/DEMO", concepts="Revenues")["facts"]
    # As first reported: the 2009-09-30 quarter keeps its original value, not the restatement.
    q = [f for f in facts if f["period_end"] == "2009-09-30"]
    assert len(q) == 1
    assert q[0]["accession"] != "0000000000-10-RESTATE"


def test_ratios_payload_shape(client: TestClient) -> None:
    body = get(client, "/descriptive/ratios")
    assert body["ticker"] == "DEMO"
    assert any(c["key"] == "TTM" for c in body["columns"])
    assert {r["group"] for r in body["rows"]} <= {"liquidity", "leverage", "profitability", "efficiency", "payout", "valuation"}
    assert len(body["registry"]) == len(body["rows"])
    assert client.get(f"{API}/descriptive/ratios", params={"asof": "2099-01-01"}).status_code == 422


def test_ratios_respect_asof(client: TestClient) -> None:
    body = get(client, "/descriptive/ratios", asof="2015-06-30")
    assert body["asof"] == "2015-06-30"
    close = cal.session_close(pd.Timestamp("2015-06-30")).isoformat().replace("+00:00", "Z")
    for col in body["columns"]:
        assert col["available_at"] is None or col["available_at"] <= close


def test_peers(client: TestClient) -> None:
    body = get(client, "/descriptive/peers")
    assert body["rows"][0]["ticker"] == "DEMO"
    assert body["rows"][0]["set"] == "subject"
    assert "hindsight" in body["note"]
    sets = get(client, "/peers")
    assert sets["subject"] == "DEMO"
    assert sets["benchmarks"] == {"market": "^DEMOTR", "nasdaq": "^DEMONDX"}
    assert get(client, "/series")["implied_vol_series"] == "FRED:VXDEMOCLS"


def test_betas_have_ci_bands(client: TestClient) -> None:
    body = get(client, "/descriptive/betas")
    assert body["window_weeks"] == 156
    assert body["ci_level"] == 0.9
    assert body["market"] == "^DEMOTR"
    assert len(body["factors"]) == 2
    for f in body["factors"]:
        assert f["points"]
        assert all(p[2] <= p[1] <= p[3] for p in f["points"])


def test_indexed_total_return_starts_at_100(client: TestClient) -> None:
    body = get(client, "/descriptive/indexed-tr", years=1, tickers="DEMO,^DEMONDX")
    assert [s["ticker"] for s in body["series"]] == ["DEMO", "^DEMONDX"]
    for s in body["series"]:
        assert s["points"][0][1] == pytest.approx(100.0)
    assert client.get(f"{API}/descriptive/indexed-tr", params={"years": 3}).status_code == 422
    assert client.get(f"{API}/descriptive/indexed-tr", params={"tickers": "ZZZZ"}).status_code == 404


def test_reverse_dcf_payload(client: TestClient) -> None:
    body = get(client, "/descriptive/reverse-dcf")
    assert len(body["grid"]) == 9
    assert body["years"] == 10
    assert body["terminal_growth"] == 0.025
    assert "CAPM" in body["cost_of_equity_source"]


def test_events_list_reactions_and_unverified_rule(client: TestClient) -> None:
    body = get(client, "/events/list")
    assert body["model"]["market"] == "^DEMOTR"
    assert body["model"]["estimation_window"] == [-280, -31]
    assert all(i["verification"] != "unverified" for i in body["items"])
    assert body["hidden_unverified"] == body["counts"]["unverified"]
    ok = [i for i in body["items"] if i["reaction"]["status"] == "ok"]
    assert ok
    assert all(i["reaction"]["car_0_1"] is not None for i in ok)
    # The existing /events list and this one agree on the visible ids.
    plain = client.get(f"{API}/events").json()
    assert [i["id"] for i in plain["items"]] == [i["id"] for i in body["items"]]


def test_event_detail(client: TestClient) -> None:
    items = get(client, "/events/list")["items"]
    eid = items[-10]["id"]
    body = get(client, f"/events/{eid}")
    r = body["reaction"]
    assert r["market"] == "^DEMOTR"
    assert r["status"] == "ok"
    assert [w["window"] for w in r["windows"]] == ["[0,+1]", "[0,+5]"]
    assert r["estimation"]["n"] >= 120
    assert "self-inclusion" in r["self_inclusion"]
    # After-close release (16:30 ET): day 0 is the next session.
    assert r["day0_session"] > body["content_available_at"][:10]
    assert body["citation"]["citable"] is False
    assert body["citation"]["reason"]
    assert client.get(f"{API}/events/NOPE").status_code == 404


def test_data_slice_has_no_write_routes(client: TestClient) -> None:
    paths = {(r.path, m) for r in client.app.routes for m in getattr(r, "methods", set())}  # type: ignore[attr-defined]
    mine = [p for p in paths if p[0].startswith((f"{API}/series", f"{API}/fundamentals", f"{API}/descriptive", f"{API}/events/"))]
    assert mine
    assert all(m in ("GET", "HEAD") for _, m in mine)
