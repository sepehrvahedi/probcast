"""Localhost hardening (RT-34; NFR-SEC-03/06) and D-047 (no freeze/reveal endpoints)."""

from __future__ import annotations

import inspect

from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from tests.server.conftest import BASE, LOCAL

IDEA = {"title": "x", "author": "heron"}


def test_foreign_host_is_rejected(app):
    with TestClient(app, base_url="http://evil.example") as c:
        assert c.get("/api/v1/health").status_code == 400
    with TestClient(app, base_url="http://127.0.0.1.nip.io:8000") as c:
        assert c.get("/api/v1/health").status_code == 400


def test_localhost_hosts_are_accepted(app):
    for base in (BASE, "http://localhost:8000"):
        with TestClient(app, base_url=base) as c:
            assert c.get("/api/v1/health").json()["ok"] is True


def test_writes_need_the_local_origin(client):
    for hdrs in ({k: v for k, v in LOCAL.items() if k != "Origin"},
                 {**LOCAL, "Origin": "http://evil.example"},
                 {**LOCAL, "Origin": "http://127.0.0.1.evil.example"},
                 {**LOCAL, "Origin": "null"}):
        for path in ("/api/v1/runs", "/api/v1/ideas", "/api/v1/committees/main/evaluate"):
            r = client.post(path, json=IDEA, headers=hdrs)
            assert r.status_code == 403, (path, hdrs)
            assert r.headers["content-type"].startswith("application/problem+json")
            assert r.json()["error"] == "Forbidden"


def test_writes_need_json_and_a_handle(client):
    r = client.post("/api/v1/ideas", content="title=x", headers={**LOCAL, "Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 415
    r = client.post("/api/v1/committees/main/evaluate", json={}, headers={k: v for k, v in LOCAL.items() if k != "X-Acting-As"})
    assert r.status_code == 422
    assert r.json()["error"] == "ContractError"
    r = client.post("/api/v1/committees/main/evaluate", json={}, headers={**LOCAL, "X-Acting-As": "mallory"})
    assert r.status_code == 403


def test_dev_server_origin_may_write_and_read_cross_origin(client):
    r = client.post("/api/v1/committees/main/evaluate", json={}, headers={**LOCAL, "Origin": "http://127.0.0.1:5173"})
    assert r.status_code == 202
    pre = client.options("/api/v1/status", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert pre.headers.get("access-control-allow-origin") == "http://localhost:5173"
    r = client.get("/api/v1/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_freeze_and_reveal_have_no_endpoint(client):
    for path in ("/api/v1/committees/main/freeze", "/api/v1/holdout/reveal", "/api/v1/freeze", "/api/v1/reveal"):
        assert client.post(path, json={}, headers=LOCAL).status_code == 404
    paths = {r.path for r in client.app.routes if isinstance(r, APIRoute)}
    assert not any("freeze" in p or "reveal" in p for p in paths)


def test_handlers_never_block_the_event_loop(app):
    """Every endpoint is a plain function, so FastAPI runs it in the thread pool; heavy work goes
    to background jobs."""
    for r in app.routes:
        if isinstance(r, APIRoute):
            assert not inspect.iscoroutinefunction(r.endpoint), r.path
