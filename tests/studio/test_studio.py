"""Idea studio: cards, accuracy evaluation, the point-in-time score-weighted mix, and the API flow
(D-089..D-092). Fixture data (ticker DEMO), coarse origins, all history open."""

from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from probcast.engine.run import QCOLS, run_backtest
from probcast.studio import cards as C
from probcast.studio.evaluate import evaluate, recency_weights, weighted_skill
from probcast.studio.mix import build_mix, idea_weights, waterfall
from probcast.validation.fixtures import TICKER, build_fixture_store
from probcast.validation.leak import poison_after

BASE = "http://127.0.0.1:8000"


@pytest.fixture(scope="module")
def world():
    store = build_fixture_store()
    from probcast.contract.grid import EVAL_START
    from probcast.engine.run import origin_schedule

    sched = origin_schedule(store, TICKER, EVAL_START, None)
    origins = sched[::-1][::4][::-1]
    anchor = run_backtest(store, "baseline.capm", ticker=TICKER, origins=origins, workers=1)
    ideas = {
        "IC-001": run_backtest(
            store, "technical.tsmom_12_1", ticker=TICKER, origins=origins, workers=1
        ),
        "IC-002": run_backtest(
            store, "baseline.hist_drift", ticker=TICKER, origins=origins, workers=1
        ),
    }
    return store, origins, anchor, ideas


# ---------------------------------------------------------------- cards
def test_card_roundtrip_and_prompt(tmp_path: Path) -> None:
    a = C.create_card(
        tmp_path, "  When volume spikes, the stock reverses. More words here.  ", "operator"
    )
    b = C.create_card(tmp_path, "Second idea", "operator")
    assert (a.id, b.id) == ("IC-001", "IC-002")
    assert a.title == "When volume spikes, the stock reverses"
    got = C.get_card(tmp_path, "IC-001")
    assert got is not None
    assert got.analyzer is None
    assert got.text.startswith("When volume")
    assert [c.id for c in C.list_cards(tmp_path)] == ["IC-001", "IC-002"]
    assert a.text in C.implementation_prompt(a)
    assert "IC-001" in C.implementation_prompt(a)
    with pytest.raises(ValueError, match="Write the idea"):
        C.create_card(tmp_path, "   ", "operator")
    assert C.get_card(tmp_path, "../etc") is None


# ---------------------------------------------------------------- evaluation
def test_recency_weights_halve_every_half_life() -> None:
    ref = pd.Timestamp("2026-01-01")
    w = recency_weights(
        pd.DatetimeIndex(
            [
                ref,
                ref - pd.Timedelta(days=round(5 * 365.25)),
                ref - pd.Timedelta(days=round(10 * 365.25)),
            ]
        ),
        ref,
    )
    assert np.allclose(w, [1.0, 0.5, 0.25], atol=1e-3)
    assert weighted_skill(
        np.array([1.0, 1.0]), np.array([2.0, 2.0]), np.array([1.0, 3.0])
    ) == pytest.approx(0.5)


def test_baseline_against_itself_has_zero_skill_and_equal_hits(world) -> None:
    store, _, anchor, _ = world
    ev = evaluate(store, TICKER, anchor, anchor, n_boot=50)
    for h, head in ev["headline"].items():
        assert head["score"] == pytest.approx(0.0, abs=1e-12)
        rec = ev["grid"][h]["recent"]
        assert rec["hit"] == pytest.approx(rec["hit_base"])
    assert ev["focus"] == 252
    assert set(ev["windows"]) == {"1y", "3y", "5y", "10y", "all", "recent"}


# ---------------------------------------------------------------- mix
def test_idea_weights_shrink_towards_equal_and_drop_non_positive() -> None:
    w, lam = idea_weights(
        {"a": 0.03, "b": 0.01, "c": -0.02, "d": float("nan")},
        {"a": 20.0, "b": 20.0, "c": 20.0, "d": 0.0},
    )
    assert lam == pytest.approx(0.5)
    assert w["c"] == 0
    assert w["d"] == 0
    assert w["a"] == pytest.approx(0.5 * 0.75 + 0.5 * 0.5)
    assert sum(w.values()) == pytest.approx(1.0)
    none, lam0 = idea_weights({"a": -0.1}, {"a": 5.0})
    assert none == {"a": 0.0}
    assert lam0 == 0.0


def test_waterfall_adds_up_exactly() -> None:
    w = {
        "anchor_median": 0.08,
        "ideas": {
            "x": {"weight": 0.45, "median": 0.06},
            "y": {"weight": 0.3, "median": 0.1},
            "z": {"weight": 0.0, "median": 0.5},
        },
    }
    final = 0.08 + 0.45 * (0.06 - 0.08) + 0.3 * (0.1 - 0.08)
    steps = waterfall(w, final)
    assert [s["id"] for s in steps] == ["__anchor__", "x", "y", "__mix__"]
    assert sum(s["value"] for s in steps[:-1]) == pytest.approx(steps[-1]["value"], abs=1e-12)


def test_mix_weights_are_point_in_time(world) -> None:
    """Poisoning every price after a cut date must not change any mix forecast made at or
    before that date: weights and spreads may only use outcomes known at each origin."""
    store, origins, anchor, ideas = world
    clean = build_mix(store, TICKER, anchor, ideas).forecasts
    cut = origins[len(origins) * 2 // 3]
    dirty = build_mix(poison_after(store, cut, "scale"), TICKER, anchor, ideas).forecasts
    a = clean[clean.origin <= cut].sort_values(["origin", "horizon"])[QCOLS].to_numpy(float)
    b = dirty[dirty.origin <= cut].sort_values(["origin", "horizon"])[QCOLS].to_numpy(float)
    assert a.shape == b.shape
    assert a.size
    assert np.array_equal(a, b)
    later_a = clean[clean.origin > cut][QCOLS].to_numpy(float)
    later_b = dirty[dirty.origin > cut][QCOLS].to_numpy(float)
    assert not np.array_equal(later_a, later_b), (
        "the poison must reach later origins, or the test proves nothing"
    )


def test_pooling_with_only_this_stock_changes_nothing(world) -> None:
    """The pooled table minus this stock's own losses is empty, so the mix must be unchanged
    (catches misaligned subtraction, e.g. outcome dates that fail to match)."""
    from probcast.studio.evaluate import pooled_losses

    store, _, anchor, ideas = world
    pooled = {i: pooled_losses(store, {TICKER: (r, anchor)}) for i, r in ideas.items()}
    a = build_mix(store, TICKER, anchor, ideas, spread=False)
    b = build_mix(store, TICKER, anchor, ideas, spread=False, pooled=pooled)
    assert np.array_equal(a.forecasts[QCOLS].to_numpy(float), b.forecasts[QCOLS].to_numpy(float))
    elsewhere = [d["all_stocks_score"] for w in b.weights.values() for d in w["ideas"].values()]
    assert elsewhere
    assert all(x is None or np.isnan(x) for x in elsewhere), "own pairs were not subtracted"


def _with_other_stock(tab: dict, other: dict, scale: float = 1.0) -> dict:
    """This stock's pooled table plus a pretend second stock with ``other``'s losses (idea loss x scale)."""
    out = {}
    for h, t in tab.items():
        o = other[h]
        assert t["out"] == o["out"]
        out[h] = {
            "out": t["out"],
            "lm": [a + scale * b for a, b in zip(t["lm"], o["lm"], strict=True)],
            "la": [a + b for a, b in zip(t["la"], o["la"], strict=True)],
        }
    return out


def test_idea_that_fails_on_other_stocks_loses_score(world) -> None:
    """Partial pooling (D-103): an idea much worse than the baseline elsewhere is pulled down."""
    from probcast.studio.evaluate import pooled_losses

    store, _, anchor, ideas = world
    own = pooled_losses(store, {TICKER: (ideas["IC-001"], anchor)})
    pooled = {"IC-001": _with_other_stock(own, own, scale=3.0)}
    base = build_mix(store, TICKER, anchor, ideas, spread=False).weights[252]["ideas"]["IC-001"]
    m = build_mix(store, TICKER, anchor, ideas, spread=False, pooled=pooled)
    d = m.weights[252]["ideas"]["IC-001"]
    assert d["own_score"] == pytest.approx(base["score"])
    assert d["all_stocks_score"] < 0
    assert d["score"] < d["own_score"]


def test_pooled_mix_is_point_in_time(world) -> None:
    """Poisoning prices after a cut must not change mix forecasts at or before it, with the
    all-stocks tables built from the poisoned world too."""
    from probcast.studio.evaluate import pooled_losses

    store, origins, anchor, ideas = world
    cut = origins[len(origins) * 2 // 3]
    dirty_store = poison_after(store, cut, "scale")

    def forecasts(st):
        tabs = {i: pooled_losses(st, {TICKER: (r, anchor)}) for i, r in ideas.items()}
        other = pooled_losses(st, {TICKER: (ideas["IC-002"], anchor)})
        pooled = {i: _with_other_stock(t, other) for i, t in tabs.items()}
        f = build_mix(st, TICKER, anchor, ideas, pooled=pooled).forecasts
        return f[f.origin <= cut].sort_values(["origin", "horizon"])[QCOLS].to_numpy(float)

    a, b = forecasts(store), forecasts(dirty_store)
    assert a.size
    assert np.array_equal(a, b)


def test_luck_check_corrects_for_many_tests() -> None:
    """A result that passes alone fails once many other ideas were tried (Benjamini-Hochberg)."""
    from probcast.studio.evaluate import luck_check

    lucky = {"score": 0.01, "support": 0.97}
    assert luck_check({"a": {"21": lucky}}, n_boot=1000)["a"]["21"]["proven"]
    many = {f"n{i}": {"21": {"score": -0.001, "support": 0.5}} for i in range(20)}
    assert not luck_check({"a": {"21": lucky}, **many}, n_boot=1000)["a"]["21"]["proven"]
    strong = {"score": 0.01, "support": 1.0}
    assert luck_check({"a": {"21": strong}, **many}, n_boot=1000)["a"]["21"]["proven"]
    assert not luck_check({"a": {"21": {"score": -0.01, "support": 1.0}}}, n_boot=1000)["a"]["21"]["proven"]


def test_mix_without_positive_ideas_is_the_baseline(world) -> None:
    store, _, anchor, _ = world
    m = build_mix(store, TICKER, anchor, {"IC-009": anchor}, spread=False)
    a = anchor.forecasts[anchor.forecasts.abstain.isna()].sort_values(["origin", "horizon"])
    f = m.forecasts.sort_values(["origin", "horizon"])
    assert np.allclose(f[QCOLS].to_numpy(float), a[QCOLS].to_numpy(float))
    assert (f["n_ideas"] == 0).all()


# ---------------------------------------------------------------- API flow
@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from fastapi.testclient import TestClient

    from probcast.server.app import create_app
    from probcast.server.workspace import ComputeOptions

    monkeypatch.setenv("PROBCAST_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("PROBCAST_HOLDOUT", "open")
    app = create_app(
        data="fixtures",
        options=ComputeOptions(origin_stride=8, workers=1, n_boot=50, leak=False, job_workers=1),
    )
    with TestClient(app, base_url=BASE) as c:
        yield c


def _wait(c, jid: str, timeout: float = 240) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = c.get(f"/api/v1/jobs/{jid}").json()
        if j["status"] in ("succeeded", "failed"):
            return j
        time.sleep(0.2)
    raise AssertionError("job timed out")


def test_card_to_backtest_to_mix(client) -> None:
    h = {"Origin": BASE, "Content-Type": "application/json", "X-Acting-As": "kestrel"}
    r = client.post(
        "/api/v1/studio/cards",
        json={"text": "Momentum: winners keep winning over a year."},
        headers=h,
    )
    assert r.status_code == 201, r.text
    card = r.json()
    assert card["status"] == "waiting"
    assert card["id"] == "IC-001"
    assert "winners keep winning" in card["prompt"]
    assert client.post("/api/v1/studio/cards/IC-001/backtest", headers=h).status_code == 409
    assert client.post(
        "/api/v1/studio/cards", json={"text": "x"}, headers={**h, "Origin": "http://evil.example"}
    ).status_code in (400, 403)

    # What the implementer does when it implements the idea: link the analyzer in the card file.
    p = Path(client.app.state.workspace.ideas_dir) / "cards" / "IC-001.yaml"
    p.write_text(p.read_text().replace("analyzer: null", "analyzer: technical.tsmom_12_1"))
    assert client.get("/api/v1/studio/cards/IC-001").json()["status"] == "ready"

    r = client.post("/api/v1/studio/cards/IC-001/backtest", headers=h)
    assert r.status_code == 202, r.text
    job = _wait(client, r.json()["job_id"])
    assert job["status"] == "succeeded", job
    d = job["detail"]
    assert d["phase"] == "done"
    assert d["done"] == d["total"] > 0
    assert d["points"]
    assert any("hit" in p for p in d["points"])

    card = client.get("/api/v1/studio/cards/IC-001").json()
    assert card["status"] == "scored"
    assert card["eval"]["headline"]
    ov = client.get("/api/v1/studio/overview").json()
    assert ov["mix"] is not None
    assert ov["counts"]["scored"] == 1
    steps = ov["mix"]["waterfall"]
    assert sum(s["value"] for s in steps[:-1]) == pytest.approx(steps[-1]["value"], abs=1e-9)
    assert (
        ov["mix"]["final"]["interval_80"][0]
        < ov["mix"]["final"]["median_price"]
        < ov["mix"]["final"]["interval_80"][1]
    )
    rk = client.get("/api/v1/studio/rankings").json()
    assert rk["missing"] == []
    row = rk["items"][0]
    h12 = row["horizons"]["252"]
    assert h12["best_guess"] == pytest.approx(ov["mix"]["by_horizon"]["252"]["median_price"])
    assert h12["growth"] == pytest.approx(h12["best_guess"] / row["price"] - 1)
    assert h12["ideas_tested"] == 1
    assert h12["confidence"] in {"high", "medium", "low"}
    assert h12["weighted_growth"] == pytest.approx(h12["growth"] * h12["support"])


def test_delete_is_undoable_and_ids_are_never_reused(tmp_path: Path) -> None:
    C.create_card(tmp_path, "First idea", "operator")
    C.create_card(tmp_path, "Second idea", "operator")
    C.delete_card(tmp_path, "IC-002", "operator")
    assert [c.id for c in C.list_cards(tmp_path)] == ["IC-001"]
    assert C.create_card(tmp_path, "Third idea", "operator").id == "IC-003"
    back = C.restore_card(tmp_path, "IC-002")
    assert back.text == "Second idea"
    assert [c.id for c in C.list_cards(tmp_path)] == ["IC-001", "IC-002", "IC-003"]
    with pytest.raises(KeyError):
        C.delete_card(tmp_path, "IC-099", "operator")


def test_delete_endpoint_removes_the_card_from_the_list(client) -> None:
    h = {"Origin": BASE, "Content-Type": "application/json", "X-Acting-As": "kestrel"}
    assert client.post("/api/v1/studio/cards", json={"text": "An idea to delete"}, headers=h).status_code == 201
    assert client.post("/api/v1/studio/cards/IC-001/delete", json={}, headers={**h, "Origin": "http://evil.example"}).status_code == 403
    r = client.post("/api/v1/studio/cards/IC-001/delete", json={}, headers=h)
    assert r.status_code == 200, r.text
    assert client.get("/api/v1/studio/cards").json()["items"] == []
    assert client.get("/api/v1/studio/cards/IC-001").status_code == 404
    assert client.post("/api/v1/studio/cards/IC-001/delete", json={}, headers=h).status_code == 404
    r = client.post("/api/v1/studio/cards/IC-001/restore", json={}, headers=h)
    assert r.status_code == 200, r.text
    assert [c["id"] for c in client.get("/api/v1/studio/cards").json()["items"]] == ["IC-001"]


def test_restore_brings_the_file_back_byte_for_byte(tmp_path: Path) -> None:
    C.create_card(tmp_path, "Keep my comments", "operator")
    before = (tmp_path / "IC-001.yaml").read_text()
    C.delete_card(tmp_path, "IC-001", "operator")
    C.restore_card(tmp_path, "IC-001")
    assert (tmp_path / "IC-001.yaml").read_text() == before


def test_pooled_score_with_one_stock_equals_that_stocks_score(world) -> None:
    from probcast.studio.evaluate import evaluate_pooled

    store, _, anchor, ideas = world
    single = evaluate(store, TICKER, ideas["IC-001"], anchor, n_boot=50)
    pooled = evaluate_pooled(store, {TICKER: (ideas["IC-001"], anchor)}, n_boot=50)
    for h, head in single["headline"].items():
        assert pooled["headline"][h]["score"] == pytest.approx(head["score"], rel=1e-12)
        assert pooled["headline"][h]["n_stocks"] == 1
        assert pooled["per_stock"][h][TICKER] == pytest.approx(head["score"], rel=1e-12)
    zero = evaluate_pooled(store, {TICKER: (anchor, anchor)}, n_boot=50)
    assert all(v["score"] == pytest.approx(0.0, abs=1e-12) for v in zero["headline"].values())


def test_events_are_filtered_to_the_contexts_own_stock() -> None:
    from probcast.pit.context import AsOfContext

    store = build_fixture_store()
    ev = store.table("events")
    other = ev.head(3).copy()
    other["ticker"] = "OTHER"
    other["event_id"] = other["event_id"] + "-other"
    store2 = store.replace(events=pd.concat([ev, other], ignore_index=True))
    ctx = AsOfContext(store2, pd.Timestamp("2020-06-30"), TICKER)
    seen = ctx.events()
    assert len(seen)
    assert set(seen["ticker"]) == {TICKER}
