"""Writes (run launch, idea registration, committee evaluation), background jobs, 503s, SPA."""

from __future__ import annotations

from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from probcast.scoring import registry as R
from probcast.server.app import create_app
from probcast.server.workspace import ComputeOptions
from tests.server.conftest import BASE, LOCAL, wait_job

CARD = {
    "title": "One-month reversal on the demo stock",
    "author": "heron",
    "report_section": "future",
    "course_concepts": ["EMH weak form"],
    "hypothesis": "When the last month's return is high, next month's return is below the CAPM expectation.",
    "rationale": "Liquidity provision; may already be priced.",
    "data_needed": ["prices: session close"],
    "rule": "Sign of the trailing 21-session return.",
    "parameters": {"window": [21]},
    "horizons": [21],
    "expected_direction": "negative",
    "success_criterion": "Beats the CAPM anchor on CRPS at 21 sessions with grade >= B.",
    "drop_if": "CRPSS CI below zero.",
    "holdout_ack": True,
}


def test_run_launch_records_one_trial_and_reuses_identical_configs(client, ws):
    body = {"analyzer": "technical.reversal_1m", "horizons": [21]}
    r = client.post("/api/v1/runs", json=body, headers=LOCAL)
    assert r.status_code == 202
    assert r.headers["location"].startswith("/api/v1/jobs/")
    j = wait_job(client, r.json()["id"])
    assert j["status"] == "succeeded", j
    rid = j["result"]["run_id"]
    assert j["result"]["cache_hit"] is False
    assert j["result"]["new_trial"] is False  # same analyzer/params/version as the warm-up run
    assert j["actor"] == "kestrel"
    run = client.get(f"/api/v1/runs/{rid}").json()
    assert run["manifest"]["author"] == "kestrel"
    assert client.get(f"/api/v1/runs/{rid}/scores").status_code == 200
    assert any(i["run_id"] == rid for i in client.get("/api/v1/runs", params={"author": "kestrel"}).json()["items"])
    # Same analyzer + params + version as the warm-up run: one trial in the registry, not two.
    man = run["manifest"]
    trials = [t for t in R.read("trials", ws.world) if (t["analyzer_id"], t["params_hash"], t["analyzer_version"]) ==
              ("technical.reversal_1m", man["params_hash"], man["analyzer_version"])]
    assert len(trials) == 1
    again = wait_job(client, client.post("/api/v1/runs", json=body, headers=LOCAL).json()["id"])
    assert again["result"] == {**again["result"], "run_id": rid, "cache_hit": True}
    audit = [a for a in R.read("audit", ws.world) if a["action"] == "run.launch"]
    assert audit
    assert audit[-1]["actor"] == "kestrel"
    assert R.verify("trials", ws.world)
    assert R.verify("audit", ws.world)


def test_run_launch_validation(client):
    bad = [({"analyzer": "nope.nothing"}, 404), ({"analyzer": "technical.reversal_1m", "params": {"bogus": 1}}, 422),
           ({"analyzer": "technical.reversal_1m", "horizons": [252]}, 422), ({"analyzer": "technical.reversal_1m", "ticker": "AAPL"}, 422),
           ({"analyzer": "technical.reversal_1m", "unexpected": True}, 422)]
    for body, code in bad:
        r = client.post("/api/v1/runs", json=body, headers=LOCAL)
        assert r.status_code == code, (body, r.text)
        assert r.headers["content-type"].startswith("application/problem+json")


def test_idea_registration_is_hash_chained_and_immutable(client, ws):
    r = client.post("/api/v1/ideas", json=CARD, headers={**LOCAL, "X-Acting-As": "kestrel"})
    assert r.status_code == 201, r.text
    rec = r.json()
    assert rec["id"] == "IC-001"
    assert rec["entered_by"] == "kestrel"
    assert rec["author"] == "heron"
    assert all(c["ok"] for c in rec["checks"])
    path = ws.ideas_dir / "IC-001.yaml"
    assert path.exists()
    assert yaml.safe_load(path.read_text())["title"] == CARD["title"]
    assert ws.ideas_dir.is_relative_to(ws.settings.home)  # the fixture world never writes to the repo
    assert R.verify("ideas", ws.world)
    assert [i["id"] for i in client.get("/api/v1/ideas").json()["items"]] == ["IC-001"]
    assert client.post("/api/v1/ideas", json={**CARD, "id": "IC-001"}, headers=LOCAL).status_code == 409
    r2 = client.post("/api/v1/ideas", json={**CARD, "horizons": [21, 63]}, headers=LOCAL)
    assert r2.status_code == 201
    assert r2.json()["id"] == "IC-002"
    bad = client.post("/api/v1/ideas", json={"title": "incomplete"}, headers=LOCAL)
    assert bad.status_code == 422
    assert bad.json()["error"] == "ContractError"
    assert any(a["action"] == "idea.register" and a["target"] == "IC-001" for a in R.read("audit", ws.world))


def test_committee_evaluate_is_a_job_and_logged(client):
    r = client.post("/api/v1/committees/main/evaluate", json={}, headers=LOCAL)
    assert r.status_code == 202
    assert wait_job(client, r.json()["id"])["status"] == "succeeded"
    log = client.get("/api/v1/committees/main").json()["gate_log"]
    assert any(e["action"] == "committee.evaluate" and e["actor"] == "kestrel" for e in log)


def test_cold_cache_answers_503_with_a_job(tmp_path, monkeypatch):
    monkeypatch.setenv("PROBCAST_HOME", str(tmp_path))
    opts = ComputeOptions(origin_stride=12, workers=1, n_boot=50, leak=False, job_workers=1, analyzers=("technical.reversal_1m",))
    app = create_app(data="fixtures", options=opts, web_dist=tmp_path / "none")
    with TestClient(app, base_url=BASE) as c:
        r = c.get("/api/v1/leaderboard", params={"horizon": 21})
        assert r.status_code == 503
        assert r.headers["retry-after"]
        p = r.json()
        assert p["error"] == "DataUnavailable"
        assert p["job_id"]
        assert c.get("/api/v1/leaderboard", params={"horizon": 21}).json()["job_id"] == p["job_id"]  # deduplicated
        assert wait_job(c, p["job_id"])["status"] == "succeeded"
        lb = c.get("/api/v1/leaderboard", params={"horizon": 21})
        assert lb.status_code == 200
        assert [row["analyzer"] for row in lb.json()["rows"]] == ["technical.reversal_1m"]
        assert c.get("/api/v1/jobs/J-missing").status_code == 404


def test_env_switches_to_fixtures(tmp_path, monkeypatch):
    monkeypatch.setenv("PROBCAST_HOME", str(tmp_path))
    monkeypatch.setenv("PROBCAST_DATA", "fixtures")
    app = create_app(web_dist=tmp_path / "none")
    ws = app.state.workspace
    assert ws.fixtures
    assert ws.ticker == "DEMO"
    assert ws.world.home == tmp_path.resolve() / "fixtures"
    ws.jobs.shutdown()


def test_spa_is_served_with_fallback(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("PROBCAST_HOME", str(tmp_path))
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>ProbCast</title>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    app = create_app(data="fixtures", options=ComputeOptions(leak=False), web_dist=dist)
    with TestClient(app, base_url=BASE) as c:
        assert "ProbCast" in c.get("/").text
        assert "ProbCast" in c.get("/runs/R-1/scores").text  # client-side route
        assert c.get("/assets/app.js").text == "console.log(1)"
        assert c.get("/../../etc/passwd").status_code in (200, 404)
        assert "root:" not in c.get("/../../etc/passwd").text
        r = c.get("/api/v1/not-a-thing")
        assert r.status_code == 404
        assert r.headers["content-type"].startswith("application/problem+json")
