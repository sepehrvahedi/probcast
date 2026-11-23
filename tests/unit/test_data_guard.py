import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("data_guard", Path(__file__).parents[2] / "scripts" / "data_guard.py")
dg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dg)


def test_seed_passes_raw_fails():
    assert dg.bad("data/seed/aapl_events.csv") is None
    assert dg.bad("data/fixtures/x.csv") is None
    assert dg.bad("data/raw/x.csv") is not None
    assert dg.bad("state/data/lake/prices/a.parquet") is not None
    assert dg.bad(".env") is not None
    assert dg.bad(".env.example") is None
