"""Contract tests: every endpoint the UI calls returns 200 with the keys of the UI's fixture JSON
(web/src/fixtures, the B3 contract), plus UXR1-16 payload rules."""

from __future__ import annotations

import json
from typing import Any

import pytest

from tests.server.conftest import WEB_FIXTURES

#: Objects whose keys are data (horizons, segments, leak tests): compare common keys only.
DYNAMIC = {"grades", "segments", "tests"}
#: Optional in the UI types (state-dependent): may be absent from a real response.
OPTIONAL = {"fixture", "flag", "grade_prereveal", "holdout_crpss", "failing", "version", "tearsheet_url", "delta_crps_63",
            "unlock", "forecast_hash", "registered_at", "hash", "failed_stage", "problem", "text", "ic_id", "reason"}


def missing_keys(fx: Any, act: Any, path: str = "$") -> list[str]:
    """Paths present in the fixture but absent from the response (first list element only)."""
    out: list[str] = []
    if isinstance(fx, dict):
        if not isinstance(act, dict):
            return [f"{path}: expected an object, got {type(act).__name__}"]
        dyn = path.rsplit(".", 1)[-1] in DYNAMIC
        for k, v in fx.items():
            if k not in act:
                if not dyn and k not in OPTIONAL:
                    out.append(f"{path}.{k}")
            elif act[k] is not None:
                out += missing_keys(v, act[k], f"{path}.{k}")
    elif isinstance(fx, list) and fx and isinstance(fx[0], dict | list):
        if not isinstance(act, list):
            return [f"{path}: expected a list"]
        if act:
            out += missing_keys(fx[0], act[0], f"{path}[0]")
    return out


def _fixture(name: str) -> Any:
    return json.loads((WEB_FIXTURES / name).read_text())


ENDPOINTS = [
    ("/health", "health.json"),
    ("/status", "status.sealed.json"),
    ("/authors", "authors.json"),
    ("/snapshots", "snapshots.json"),
    ("/analyzers", "analyzers.json"),
    ("/events", "events.json"),
    ("/prices/DEMO?basis=display_adjusted", "prices.DEMO.json"),
    ("/forecast/final", "forecast-final.working.json"),
    ("/committees/main", "committees/main.working.json"),
    ("/runs?status=completed", "runs.index.json"),
    ("/runs/{run}", "runs/R-DEMO-01.run.json"),
    ("/runs/{run}/scores", "runs/R-DEMO-01.scores.json"),
    *[(f"/leaderboard?horizon={h}", f"leaderboard/{h}.json") for h in (5, 21, 63, 126, 252)],
]


@pytest.mark.parametrize(("path", "fixture"), ENDPOINTS)
def test_endpoint_matches_ui_fixture_keys(client, tsmom_run, path, fixture):
    r = client.get("/api/v1" + path.format(run=tsmom_run))
    assert r.status_code == 200, r.text
    body = r.json()
    assert missing_keys(_fixture(fixture), body) == []
    assert "provenance" in body
    if path != "/health":
        assert body.get("fixture") is True  # the fixture world is labelled (ILLUSTRATIVE watermark)


def test_run_forecasts_rows_match_ribbon_point(client, tsmom_run):
    r = client.get(f"/api/v1/runs/{tsmom_run}/forecasts", params={"horizon": 63})
    assert r.status_code == 200
    body = r.json()
    assert {"run_id", "h", "unit", "items", "provenance"} <= set(body)
    assert body["unit"] == "log_return"
    assert body["h"] == 63
    assert body["items"]
    keys = {"origin", "q10", "q25", "q50", "q75", "q90", "capm_q10", "capm_q90", "realised", "inside80", "sample"}
    for it in body["items"]:
        assert keys <= set(it)
        assert it["q10"] < it["q25"] < it["q50"] < it["q75"] < it["q90"]
        assert it["inside80"] == (it["q10"] <= it["realised"] <= it["q90"])


def test_skill_values_carry_evidence(client, tsmom_run):
    """UXR1-16: every skill value carries ci, n_eff, grade, trials, mde and a sample tag."""
    scores = client.get(f"/api/v1/runs/{tsmom_run}/scores").json()
    lb = client.get("/api/v1/leaderboard", params={"horizon": 21}).json()
    final = client.get("/api/v1/forecast/final").json()
    found = 0

    def walk(x: Any) -> None:
        nonlocal found
        if isinstance(x, dict):
            if x.get("metric") == "crpss":
                found += 1
                assert {"ci", "n_eff", "grade", "trials", "mde", "sample", "provenance"} <= set(x)
                assert x["grade"] in "ABCD"
                assert x["sample"] in ("dev", "val")
                assert {"analyzer", "family", "team"} <= set(x["trials"])
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    for p in (scores, lb, final):
        walk(p)
    assert found > 10


def test_final_forecast_payload_rules(client):
    f = client.get("/api/v1/forecast/final").json()
    assert f["p_up"]["base_rate_aapl"] is not None
    assert f["p_up"]["base_rate_spx"] is not None
    assert [m["month"] for m in f["fan_monthly"]] == list(range(13))
    for m in f["fan_monthly"][1:]:
        assert len(m["price"]) == 23
        assert all(a < b for a, b in zip(m["price"], m["price"][1:], strict=False))
    att = f["attribution"]
    total = att["start"]["value"] + sum(s["contribution"] for s in att["steps"])
    assert abs(total - att["end"]["value"]) < 1e-12
    assert att["steps"][-1]["kind"] == "spread"
    assert [r["variant"] for r in f["anchor_sensitivity"]] == ["capm_erp4", "capm_erp5", "capm_erp6", "shrink50", "hist_drift"]
    assert sum(r["is_headline"] for r in f["anchor_sensitivity"]) == 1
    assert abs(sum(s["p"] for s in f["scenarios"]["items"]) - 1) < 1e-9
    assert f["target"]["sessions"] == 252
    assert f["status"] in ("working", "frozen", "baseline_only")
    assert f["summary"]["interval80"]["lo"] < f["summary"]["median"] < f["summary"]["interval80"]["hi"]
    assert {e["h"] for e in f["evidence"]} <= {21, 63, 252}
    assert len(f["forecast_sha256"]) == 64


def test_status_reports_snapshot_holdout_leak_and_freeze(client, ws):
    s = client.get("/api/v1/status").json()
    assert s["snapshot"]["id"] == ws.snapshot_id
    assert s["snapshot"]["hash"] == ws.snapshot_hash
    assert s["holdout"]["state"] == "sealed"
    assert s["holdout"]["boundary"] == "2021-01-01"
    assert s["freeze"] is None
    lt = s["leak_tested"]
    assert lt["total"] == len(ws.analyzer_ids())
    assert lt["passed"] == lt["total"] - 1
    assert lt["failing"][0] == {"analyzer": "technical.reversal_1m", "test": "T1", "at": lt["failing"][0]["at"]}
    assert lt["committee"] is False  # reversal_1m is a committee member and failed
    assert {f["dataset"] for f in s["freshness"]} >= {"prices", "events"}
    assert s["ticker"]["ticker"] == "DEMO"
    assert s["tickers"] == ["DEMO"]


def test_leaderboard_rows(client, ws):
    lb = client.get("/api/v1/leaderboard", params={"horizon": 21}).json()
    ids = [r["analyzer"] for r in lb["rows"]]
    assert "baseline.capm" not in ids
    assert "technical.reversal_1m" in ids
    est = [r["crpss_capm"]["est"] for r in lb["rows"]]
    assert est == sorted(est, reverse=True)
    row = next(r for r in lb["rows"] if r["analyzer"] == "technical.reversal_1m")
    assert row["leak_tested"] is False
    assert row["in_committee"] is True
    assert client.get(f"/api/v1/runs/{row['best_run_id']}").status_code == 200
    assert lb["hist_drift_vs_capm"]["sample"] == "dev"


def test_committee_rows_and_gates(client):
    c = client.get("/api/v1/committees/main").json()
    by = {m["analyzer"]: m for m in c["members"]}
    assert by["valuation.earnings_yield"]["decision"] == "descriptive_only"
    rev = by["technical.reversal_1m"]
    assert rev["decision"] == "committee"
    assert next(g for g in rev["gate"] if g["id"] == "leak")["ok"] is False
    assert {g["id"] for g in rev["gate"]} == {"schema", "leak", "tdn", "walkforward", "val"}
    active = [m for m in c["members"] if m["family_weight"] > 0]
    assert abs(sum(m["family_weight"] * m["within_family_share"] for m in active) - (1 - c["anchor"]["weight"])) < 1e-12


def test_unknown_resources_are_problem_details(client):
    for path in ("/api/v1/runs/nope", "/api/v1/runs/nope/scores", "/api/v1/committees/nope", "/api/v1/prices/ZZZZ", "/api/v1/nothing"):
        r = client.get(path)
        assert r.status_code == 404, path
        assert r.headers["content-type"].startswith("application/problem+json")
        assert {"type", "title", "status", "error"} <= set(r.json())
        assert r.json()["error"] == "NotFound"
    r = client.get("/api/v1/leaderboard", params={"horizon": 7})
    assert r.status_code == 422
    assert r.json()["error"] == "ContractError"
