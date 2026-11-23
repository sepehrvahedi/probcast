"""Fixtures for the API tests: fixture data (ticker DEMO), a temporary PROBCAST_HOME and a
reduced origin set (every 6th month-end, serial workers, 100 bootstrap replicates) so the
whole warm-up runs in seconds. The leak suite is replaced by recorded results (test doubles)
because it re-runs every analyzer on synthetic stores; its own tests live in tests/leak."""

from __future__ import annotations

import os

# These suites test the R1.0 sealed-holdout machinery, which stays available behind
# PROBCAST_HOLDOUT=sealed after the PO retired the seal (D-089). tests/studio runs with it open.
os.environ.setdefault("PROBCAST_HOLDOUT", "sealed")

import json
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from probcast.server.app import create_app
from probcast.server.workspace import ComputeOptions, Workspace, iso

BASE = "http://127.0.0.1:8000"
LOCAL = {"Origin": BASE, "Content-Type": "application/json", "X-Acting-As": "kestrel"}
FAST = ComputeOptions(origin_stride=6, workers=1, n_boot=100, leak=False, job_workers=1)
WEB_FIXTURES = Path(__file__).resolve().parents[2] / "web" / "src" / "fixtures"


def seed_leak(ws: Workspace, failing: str | None = None) -> None:
    """Write leak-suite records for every analyzer (all passed, except ``failing``'s T1)."""
    from datetime import UTC, datetime

    from probcast.sdk.registry import get_spec

    for a in ws.analyzer_ids():
        passed = {k: True for k in ("T1", "T2", "T3", "T5", "T7")}
        if get_spec(a).manifest.family != "baseline":
            passed["T-DN"] = True
        if a == failing:
            passed["T1"] = False
        p = ws._leak_path(a)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"analyzer": a, "version": get_spec(a).version, "at": iso(datetime.now(UTC)), "ok": all(passed.values()),
                                 "passed": passed, "details": dict.fromkeys(passed, "test double")}))


def wait_job(client: TestClient, job_id: str, timeout: float = 120) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = client.get(f"/api/v1/jobs/{job_id}").json()
        if j["status"] in ("succeeded", "failed"):
            return j
        time.sleep(0.1)
    raise AssertionError(f"job {job_id} did not finish")


@pytest.fixture(scope="session")
def home(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Path]:
    d = tmp_path_factory.mktemp("probcast-home")
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("PROBCAST_HOME", str(d))
        mp.delenv("PROBCAST_DATA", raising=False)
        mp.delenv("PROBCAST_SNAPSHOT", raising=False)
        yield d


@pytest.fixture(scope="session")
def app(home: Path):
    application = create_app(data="fixtures", options=FAST, web_dist=home / "no-dist")
    ws = application.state.workspace
    ws.warm()
    seed_leak(ws, failing="technical.reversal_1m")
    return application


@pytest.fixture(scope="session")
def client(app) -> Iterator[TestClient]:
    with TestClient(app, base_url=BASE) as c:
        yield c


@pytest.fixture(scope="session")
def ws(app) -> Workspace:
    return app.state.workspace


@pytest.fixture(scope="session")
def tsmom_run(ws: Workspace) -> str:
    return ws.default_run_id("technical.tsmom_12_1", compute=False)
