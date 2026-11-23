"""Lab slice (server/ext/lab.py): exceedance ("Ask"), read-only settings, idea-card detail and
run-launcher presets, against the fixture world (ticker DEMO) in a temporary PROBCAST_HOME."""

from __future__ import annotations

import dataclasses
import math
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from tests.server.conftest import BASE, FAST, LOCAL, seed_leak, wait_job

from probcast.config import Settings
from probcast.scoring import registry as R
from probcast.sdk import registry as SR
from probcast.server import policy as P
from probcast.server.app import create_app
from probcast.server.ext.lab import card_checks, expected_size, hypothesis_parts
from probcast.server.workspace import Workspace

API = "/api/v1"
CARD = {
    "title": "USD index sensitivity",
    "author": "heron",
    "report_section": "macro",
    "course_concepts": ["FX exposure", "CAPM"],
    "hypothesis": "When the USD index has risen over the last 13 weeks, DEMO's 3M return is lower than its CAPM expectation.",
    "rationale": "Foreign revenue translates at a worse rate; partly priced by analysts. Counter: hedging.",
    "data_needed": ["FRED:DTWEXBGS — constructed_weekly (alfred_realtime_start): published weekly (H.10)"],
    "rule": "13-week change in the USD index, as of each origin.",
    "parameters": {"lookback_weeks": [13, 8, 26]},
    "horizons": [63],
    "expected_direction": "lower; about −2% over a quarter",
    "success_criterion": "Beats the CAPM anchor on CRPS at 63 sessions with grade ≥ B.",
    "drop_if": "CRPSS 90% CI entirely below zero at 63 sessions.",
    "references": ["Jorion, P. (1990) The exchange-rate exposure of U.S. multinationals. Journal of Business 63(3)."],
    "holdout_ack": True,
}


@pytest.fixture(scope="module")
def lab_app(tmp_path_factory: pytest.TempPathFactory):
    home = tmp_path_factory.mktemp("lab-home")
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("PROBCAST_HOME", str(home))
        mp.delenv("PROBCAST_DATA", raising=False)
        mp.delenv("PROBCAST_SNAPSHOT", raising=False)
        settings = Settings(home=Path(home).resolve(), sec_user_agent=None, fred_api_key=None, tiingo_api_key=None)
        app = create_app(data="fixtures", options=FAST, settings=settings, web_dist=home / "no-dist")
        ws = app.state.workspace
        ws.warm()
        seed_leak(ws)
        yield app


@pytest.fixture(scope="module")
def client(lab_app) -> Iterator[TestClient]:
    with TestClient(lab_app, base_url=BASE) as c:
        yield c


@pytest.fixture(scope="module")
def ws(lab_app) -> Workspace:
    return lab_app.state.workspace


# ---------------------------------------------------------------------------- exceedance
def test_final_exceedance_at_the_origin_close_equals_p_up_and_its_base_rates(client):
    f = client.get(f"{API}/forecast/final").json()
    p0 = f["origin"]["price"]
    r = client.get(f"{API}/forecast/final/exceedance", params={"price": p0})
    assert r.status_code == 200, r.text
    e = r.json()
    assert e["fixture"] is True
    assert e["h"] == 252
    assert e["target"]["date"] == f["target"]["date"]
    assert math.isclose(e["p"], f["p_up"]["p"], abs_tol=1e-12)
    assert math.isclose(e["threshold"]["return"], 0.0, abs_tol=1e-12)
    assert math.isclose(e["base_rate_aapl"], f["p_up"]["base_rate_aapl"], abs_tol=1e-12)
    assert e["base_rate_spx"] == f["p_up"]["base_rate_spx"]
    assert e["base_rate"]["survivor_biased"] is True
    assert e["disclaimer"] == "Educational research tool. Not investment advice."
    assert e["provenance"]["kind"] == "forecast"
    assert e["provenance"]["id"] == "committee:main@working"
    assert e["provenance"]["snapshot"]
    assert "is above $" in e["event_text"]
    assert e["forecast_sha256"] == f["forecast_sha256"]


def test_exceedance_is_monotone_and_matches_the_engine_table(client):
    f = client.get(f"{API}/forecast/final").json()
    p0 = f["origin"]["price"]
    ps = [client.get(f"{API}/forecast/final/exceedance", params={"price": p0 * k}).json()["p"] for k in (0.5, 0.9, 1.0, 1.2, 2.0)]
    assert all(0 <= p <= 1 for p in ps)
    assert ps == sorted(ps, reverse=True)
    for row in f["exceedance"]:  # P(12-month price return > x), computed by the engine for the Forecast tab
        e = client.get(f"{API}/committees/main/exceedance", params={"h": 252, "x": row["x"]}).json()
        assert math.isclose(e["p"], row["p"], abs_tol=1e-12)
        assert math.isclose(e["threshold"]["price"], p0 * (1 + row["x"]), rel_tol=1e-12)
        by_price = client.get(f"{API}/committees/main/exceedance", params={"h": 252, "price": e["threshold"]["price"]}).json()
        assert math.isclose(by_price["p"], e["p"], abs_tol=1e-12)


def test_exceedance_other_horizons_and_validation(client):
    e = client.get(f"{API}/committees/main/exceedance", params={"h": 21, "x": 0.1}).json()
    assert e["h"] == 21
    assert e["target"]["sessions"] == 21
    assert 0 < e["p"] < 0.5
    assert 0 <= e["base_rate_aapl"] <= 1
    assert e["base_rate"]["n_windows"] > 0
    for params, code in [({"price": 0}, 422), ({"price": -5}, 422), ({}, 422)]:
        r = client.get(f"{API}/forecast/final/exceedance", params=params)
        assert r.status_code == code, (params, r.text)
        assert r.headers["content-type"].startswith("application/problem+json")
    assert client.get(f"{API}/committees/main/exceedance", params={"h": 7, "x": 0.1}).status_code == 422
    assert client.get(f"{API}/committees/main/exceedance", params={"h": 252}).status_code == 422
    assert client.get(f"{API}/committees/main/exceedance", params={"x": -1.5}).status_code == 422
    assert client.get(f"{API}/committees/nope/exceedance", params={"x": 0.1}).status_code == 404


# ---------------------------------------------------------------------------- settings
def test_settings_are_read_only_and_name_their_source(client, ws):
    r = client.get(f"{API}/settings")
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["read_only"] is True
    ids = [p["id"] for p in s["policies"]]
    for k in ("holdout", "freeze_at", "reveal_at", "horizons", "quantile_grid", "anchor", "anchor_weight", "families",
              "trial_budget", "grid_cap", "snapshot", "data_mode"):
        assert k in ids
    pol = P.research_policy(ws.configs)
    by = {p["id"]: p for p in s["policies"]}
    assert by["freeze_at"]["value"] == pol["freeze_at"]
    assert by["reveal_at"]["value"] == pol["reveal_at"]
    assert by["trial_budget"]["value"] == pol["trial_budget"]
    assert by["holdout"]["value"] == "2021-01-01"
    assert by["horizons"]["value"] == [5, 21, 63, 126, 252]
    assert len(by["quantile_grid"]["value"]) == 23
    assert by["data_mode"]["value"] == "fixtures"
    for p in s["policies"]:
        assert p["set_in"]
        assert all(ref in s["refs"] for ref in p["refs"])
    assert s["build"]["version"] == ws.version
    assert s["build"]["data"] == "fixtures"
    assert s["holdout"]["state"] == "sealed"
    assert {c["id"] for c in s["availability"]["classes"]} >= {"exchange_price", "sec_filing"}
    mde = s["mde"]["by_horizon"]
    assert [m["h"] for m in mde] == [5, 21, 63, 126, 252]
    assert all(m["mde"] > 0 for m in mde)
    assert [m["n_eff"] for m in mde] == sorted((m["n_eff"] for m in mde), reverse=True)
    # No write path for policies.
    assert client.post(f"{API}/settings", json={}, headers=LOCAL).status_code in (404, 405)


# ---------------------------------------------------------------------------- ideas
def test_card_checks_are_deterministic():
    assert hypothesis_parts(CARD["hypothesis"]) == {"condition": True, "direction": True, "horizon": True, "comparison": True}
    assert hypothesis_parts("Apple is good.") == {"condition": False, "direction": False, "horizon": False, "comparison": False}
    assert expected_size("lower; about −2% over a quarter") == pytest.approx(-0.02)
    assert expected_size("+1.5 % in a year") == pytest.approx(0.015)
    assert expected_size("negative") is None
    checks = {c["id"]: c for c in card_checks(CARD, trial_budget=20, mde_by_h={63: 0.05}, ticker="DEMO")}
    assert checks["hypothesis"]["status"] == "ok"
    assert checks["data_rules"]["status"] == "ok"
    assert checks["no_full_sample"]["status"] == "ok"
    assert checks["planned_trials"]["status"] == "ok"
    assert checks["mde"]["status"] == "warn"  # 2% < 5% MDE at 63 sessions
    assert "63 sessions" in checks["mde"]["text"]
    bad = {**CARD, "rule": "z-score over the full sample", "data_needed": ["FRED:DTWEXBGS"], "references": [],
           "parameters": {"a": [1, 2, 3, 4, 5]}, "holdout_ack": False}
    b = {c["id"]: c["status"] for c in card_checks(bad, trial_budget=20, mde_by_h={63: 0.01}, ticker="DEMO")}
    assert b == {**b, "no_full_sample": "fail", "data_rules": "fail", "references": "fail", "parameters": "fail",
                 "holdout_ack": "fail", "mde": "ok"}
    lic = {c["id"]: c["status"] for c in card_checks({**CARD, "data_needed": ["Bloomberg BEst EPS: local import"]},
                                                      trial_budget=20, mde_by_h={}, ticker="DEMO")}
    assert lic["licence"] == "warn"


def test_idea_detail_shows_immutable_content_hash_and_checks(client, ws):
    r = client.post(f"{API}/ideas", json=CARD, headers=LOCAL)
    assert r.status_code == 201, r.text
    iid = r.json()["id"]
    d = client.get(f"{API}/ideas/{iid}").json()
    assert d["id"] == iid
    assert d["status"] == "registered"
    assert d["registered"] is True
    assert d["card"]["title"] == CARD["title"]
    assert d["card"]["author"] == "heron"
    assert d["record"]["entered_by"] == "kestrel"
    assert d["integrity"]["match"] is True
    assert d["integrity"]["chain_ok"] is True
    assert d["integrity"]["content_hash"] == r.json()["content_hash"]
    assert {c["id"] for c in d["checks"]} >= {"hypothesis", "data_rules", "no_full_sample", "parameters", "mde", "holdout_ack"}
    assert d["history"][0]["status"] == "registered"
    assert d["history"][0]["hash"] == r.json()["hash"]
    assert d["provenance"] == {"kind": "ledger", "id": "registry/ideas.jsonl", "key": iid}
    assert R.verify("ideas", ws.world)
    for bad in ("IC-999", "IC-1", "nope"):
        assert client.get(f"{API}/ideas/{bad}").status_code == 404


# ---------------------------------------------------------------------------- presets
def test_presets_default_is_a_cache_hit_with_no_new_trial(client, ws):
    r = client.get(f"{API}/presets/technical.reversal_1m")
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["free_parameters"] is False
    assert p["analyzer"]["id"] == "technical.reversal_1m"
    assert p["snapshot"]["id"] == ws.snapshot_id
    assert "holdout ≥ 2021 sealed" in p["protocol"]["text"]
    d = p["presets"][0]
    assert d["kind"] == "default"
    assert d["params"] == {}
    assert d["cache_hit"] is True
    assert d["evaluated"] is True
    assert d["trials"]["adds"] == 0
    assert d["trials"]["after"] == d["trials"]["before"]
    assert d["blocked"] is None
    for bad in ("nope.nothing", "test.something"):
        assert client.get(f"{API}/presets/{bad}").status_code == 404


def test_declared_presets_preview_matches_the_launch(client, ws, monkeypatch):
    aid = "technical.reversal_1m"
    spec = SR.get_spec(aid)
    patched = dataclasses.replace(spec, manifest=spec.manifest.model_copy(update={"param_grid_declared": {"window": [10, 21, 42]}}))
    monkeypatch.setitem(SR._REGISTRY, aid, patched)
    p = client.get(f"{API}/presets/{aid}").json()
    assert [x["params"] for x in p["presets"]] == [{}, {"window": 10}, {"window": 42}]  # 21 is the default: not repeated
    alt = p["presets"][1]
    assert alt["kind"] == "declared"
    assert alt["evaluated"] is False
    assert alt["cache_hit"] is False
    before = alt["trials"]["before"]
    assert alt["trials"]["after"] == {"analyzer": before["analyzer"] + 1, "family": {**before["family"], "n": before["family"]["n"] + 1},
                                      "team": before["team"] + 1}
    # The launch adds exactly the previewed trial ...
    r = client.post(f"{API}/runs", json={"analyzer": aid, "params": alt["params"]}, headers=LOCAL)
    assert r.status_code == 202, r.text
    j = wait_job(client, r.json()["id"])
    assert j["status"] == "succeeded", j
    assert j["result"]["new_trial"] is True
    assert ws.trials_for(aid, spec.manifest.family) == alt["trials"]["after"]
    # ... and afterwards the same preset is a cache hit that adds none.
    again = client.get(f"{API}/presets/{aid}").json()["presets"][1]
    assert again["cache_hit"] is True
    assert again["run_id"] == j["result"]["run_id"]
    assert again["trials"]["adds"] == 0
    # Grid cap reached: a configuration not yet run is blocked (the API would answer 409).
    real = P.research_policy
    monkeypatch.setattr(P, "research_policy", lambda configs=None: {**real(ws.configs), "grid_cap": 0})
    capped = client.get(f"{API}/presets/{aid}").json()["presets"]
    assert capped[2]["blocked"]
    assert "Grid cap" in capped[2]["blocked"]
    assert capped[1]["blocked"] is None  # already run: opening it adds nothing
