import pandas as pd
import pytest

from probcast.sdk import Forecast, analyzer
from probcast.sdk.registry import get_registry, get_spec
from probcast.validation import leak
from probcast.validation.fixtures import build_fixture_store

ALL_IDS = sorted(a for a in get_registry() if not a.startswith("test.") and a != "baseline.hist_drift")


@pytest.mark.parametrize("analyzer_id", ALL_IDS)
def test_registered_analyzers_pass(analyzer_id):
    rep = leak.run_leak_suite(get_spec(analyzer_id), n_origins=10)
    assert rep.ok, rep.details


def test_hist_drift_is_detected_as_drift_leaky():
    """Negative control: the survivor-biased yardstick must FAIL drift neutrality."""
    store = build_fixture_store()
    ok, msg = leak.t_dn_drift_neutrality(get_spec("baseline.hist_drift"), leak.sample_origins(store, 20, seed=11))
    assert not ok, msg


def _latest_price_analyzer(ctx, params):
    # Uses the most recent visible price; harmless only if the context truncates correctly.
    last = float(ctx.prices().iloc[-1])
    return {21: Forecast(quantiles=ctx.anchor(21) + 1e-9 * last)}


LATEST = analyzer(id="test.latest_price", version="0.0.1", name="latest price", family="technical.trend", category="technical",
                  report_section="future", hypothesis="uses the last visible price", horizons=(21,))(_latest_price_analyzer).spec


def test_t1_detects_a_broken_context(monkeypatch):
    """Framework self-test: if truncation were broken, T1 must fail (architecture L1)."""
    from probcast.pit.context import AsOfContext

    store = build_fixture_store()
    origins = pd.DatetimeIndex([pd.Timestamp("2016-03-31")])
    assert leak.t1_future_poisoning(LATEST, store, origins)[0]  # correct context: passes
    monkeypatch.setattr(AsOfContext, "_truncate", lambda self, st: {k: v.copy() for k, v in st.tables.items()})
    assert not leak.t1_future_poisoning(LATEST, store, origins)[0]  # broken context: caught


def test_import_boundary_contract_exists():
    """Analyzers bypassing the context (globals, files) are stopped by import-linter (L2/L3)."""
    import tomllib
    from pathlib import Path

    cfg = tomllib.loads((Path(__file__).parents[2] / "pyproject.toml").read_text())
    forbidden = cfg["tool"]["importlinter"]["contracts"][0]["forbidden_modules"]
    assert "probcast.lake" in forbidden
    assert "probcast.pit" in forbidden


def test_canary_and_hindsight(store):
    origins = leak.sample_origins(store, 8)
    assert leak.t5_canary(store, origins)[0]
    assert leak.t7_hindsight(store, origins)[0]
