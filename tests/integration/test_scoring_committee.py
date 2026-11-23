import json

import numpy as np
import pandas as pd
import pytest

from probcast.committee.core import Member, attribution, combine, recalibrate_spread
from probcast.committee.final import final_object, forecast_hash
from probcast.contract.grid import MEDIAN_INDEX, segment_for_outcome
from probcast.engine.run import QCOLS, run_backtest
from probcast.scoring import registry as R
from probcast.scoring.oracle import realised, sealed
from probcast.scoring.score import score_run
from probcast.validation.fixtures import TICKER


@pytest.fixture(scope="module")
def runs(store):
    o = pd.DatetimeIndex(pd.date_range("1998-01-31", "2026-10-31", freq="6ME"))
    from probcast import calendar as cal

    origins = cal.month_end_sessions("1998-01-01", "2026-11-30")[::6]
    anc = run_backtest(store, "baseline.capm", ticker=TICKER, origins=origins, workers=1)
    tsm = run_backtest(store, "technical.tsmom_12_1", ticker=TICKER, origins=origins, workers=1)
    rev = run_backtest(store, "technical.reversal_1m", ticker=TICKER, origins=origins, workers=1)
    assert len(o) > 0
    return anc, tsm, rev


def test_holdout_is_sealed_by_outcome_date(store):
    assert segment_for_outcome(pd.Timestamp("2021-06-30").date()) == "holdout"
    out = realised(store, TICKER, pd.DatetimeIndex([pd.Timestamp("2020-06-30")]), 252)
    assert out["segment"].iloc[0] == "holdout"  # 2020 origin, 2021 outcome (RT-03)
    assert sealed(out, revealed=False).empty


def test_score_card_excludes_holdout_and_grades(store, runs):
    anc, tsm, _ = runs
    card = score_run(store, tsm, anc, n_boot=200)
    for s in card.horizons.values():
        assert set(s.segments) <= {"dev", "val"}
        assert s.grade in "ABCD"
        assert s.verdict.startswith(s.grade)


def test_committee_waterfall_is_exact_and_anchor_weighted(store, runs):
    anc, tsm, rev = runs
    res = combine([Member("t", "technical.trend", tsm), Member("r", "technical.reversion", rev)], anc)
    f = res.forecasts
    t = f["origin"].max()
    att = attribution(res, t, 21)
    total = att["steps"][0]["value"] + sum(s["value"] for s in att["steps"][1:-1])
    assert total == pytest.approx(att["steps"][-1]["value"], abs=1e-12)
    assert att["anchor_weight"] == 0.25
    # baseline-only state: at 252 only the trend family is active
    att252 = attribution(res, t, 252)
    assert [s["label"] for s in att252["steps"][1:-1]] == ["technical.trend"]


def test_spread_recalibration_preserves_median(store, runs):
    anc, tsm, _ = runs
    raw = combine([Member("t", "technical.trend", tsm)], anc)
    cal = recalibrate_spread(store, TICKER, raw)
    m = raw.forecasts[QCOLS[MEDIAN_INDEX]].to_numpy()
    m2 = cal.forecasts[QCOLS[MEDIAN_INDEX]].to_numpy()
    assert np.allclose(m, m2)


def test_final_object(store, runs):
    anc, tsm, _ = runs
    res = combine([Member("t", "technical.trend", tsm)], anc)
    f = res.forecasts
    t = f["origin"].max()
    cq = {int(h): f[(f.origin == t) & (f.horizon == h)][QCOLS].to_numpy()[0] for h in f.horizon.unique()}
    obj = final_object(store, TICKER, t, cq, extra_dates=("2027-12-31",))
    assert sum(obj["scenarios"].values()) == pytest.approx(1.0)
    assert len(obj["anchor_sensitivity"]) == 5
    assert len(obj["fan_monthly"]) == 12
    assert obj["base_rates"]["own"] is not None
    assert forecast_hash(obj) == obj["sha256"]
    assert forecast_hash(json.loads(json.dumps(obj))) == obj["sha256"]  # stable under round-trip
    assert obj["disclaimer"].startswith("Educational")


def test_registry_hash_chain(tmp_path, monkeypatch):
    monkeypatch.setenv("PROBCAST_HOME", str(tmp_path))
    R.append("trials", {"analyzer_id": "a", "params_hash": "p", "analyzer_version": "1"})
    R.append("trials", {"analyzer_id": "a", "params_hash": "q", "analyzer_version": "1"})
    assert R.verify("trials")
    assert R.trial_counts()["by_analyzer"]["a"] == 2
    p = tmp_path / "registry" / "trials.jsonl"
    lines = p.read_text().splitlines()
    tampered = json.loads(lines[0])
    tampered["params_hash"] = "x"
    p.write_text(json.dumps(tampered) + "\n" + lines[1] + "\n")
    with pytest.raises(R.RegistryError):
        R.verify("trials")
