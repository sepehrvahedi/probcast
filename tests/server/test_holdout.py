"""Holdout integrity (FR-UI-35; NFR-SCI-05): no holdout metric leaves the server while sealed;
after the single (CLI-only) reveal, holdout segments appear tagged ``sample = holdout``."""

from __future__ import annotations

from typing import Any

import pandas as pd
import pytest

from probcast.contract.grid import HOLDOUT_START
from probcast.scoring import registry as R
from probcast.server import payloads as PL
from probcast.server.problems import Problem
from probcast.server.workspace import ComputeOptions, Workspace


def holdout_paths(x: Any, path: str = "$") -> list[str]:
    out: list[str] = []
    if isinstance(x, dict):
        if x.get("sample") == "holdout":
            out.append(path)
        for k, v in x.items():
            out += holdout_paths(v, f"{path}.{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            out += holdout_paths(v, f"{path}[{i}]")
    return out


def test_no_holdout_metric_in_any_response_while_sealed(client, tsmom_run):
    paths = ["/status", "/forecast/final", "/committees/main", "/runs", f"/runs/{tsmom_run}", f"/runs/{tsmom_run}/scores",
             *[f"/leaderboard?horizon={h}" for h in (5, 21, 63, 126, 252)],
             *[f"/runs/{tsmom_run}/forecasts?horizon={h}" for h in (21, 63, 126, 252)]]
    for p in paths:
        r = client.get("/api/v1" + p)
        assert r.status_code == 200, p
        assert holdout_paths(r.json()) == [], p
        assert '"holdout_crpss"' not in r.text


def test_forecast_ribbon_has_no_post_2020_outcomes(client, tsmom_run):
    from probcast import calendar as cal

    for h in (21, 252):
        items = client.get(f"/api/v1/runs/{tsmom_run}/forecasts", params={"horizon": h}).json()["items"]
        assert items
        for it in items:
            assert cal.add_sessions(pd.Timestamp(it["origin"]), h).date() < HOLDOUT_START


def test_decade_rows_stop_before_the_holdout(client, tsmom_run):
    for hs in client.get(f"/api/v1/runs/{tsmom_run}/scores").json()["horizons"]:
        assert [d["label"] for d in hs["decades"]] == ["1990–2000", "2001–2010", "2011–2015", "2016–2020"]
        assert set(hs["segments"]) <= {"dev", "val"}


def test_guard_refuses_a_leaked_holdout_object(ws):
    with pytest.raises(Problem) as e:
        PL.guard_sealed(ws, {"rows": [{"crpss_capm": {"sample": "holdout"}}]})
    assert e.value.error == "HoldoutLocked"


def test_revealed_world_shows_holdout_segments(tmp_path, monkeypatch):
    monkeypatch.setenv("PROBCAST_HOME", str(tmp_path))
    ws = Workspace("fixtures", options=ComputeOptions(origin_stride=6, workers=1, n_boot=50, leak=False, job_workers=1,
                                                      analyzers=("technical.tsmom_12_1",)))
    rid = ws.default_run_id("technical.tsmom_12_1", compute=True)
    sealed = PL.run_scores(ws, rid, ws.stats(rid, compute=True))
    assert holdout_paths(sealed) == []
    R.append("unlocks", {"action": "reveal", "reason": "test", "witnesses": ["heron", "wren"]}, ws.world)
    assert ws.revealed()
    revealed = PL.run_scores(ws, rid, ws.stats(rid, compute=True))
    assert holdout_paths(revealed)
    h = next(x for x in revealed["horizons"] if "holdout" in x["segments"])
    assert h["segments"]["dev"]["crpss_capm"]["grade_prereveal"] == h["segments"]["dev"]["crpss_capm"]["grade"]
    assert h["decades"][-1]["label"] == "2021–"
    assert PL.guard_sealed(ws, revealed) is revealed
    assert PL.holdout_state(ws)["state"] == "revealed"
    ws.jobs.shutdown()
