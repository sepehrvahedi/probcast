import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.pit.context import AsOfContext
from probcast.validation.fixtures import TICKER


def test_calendar_facts():
    assert cal.n_sessions_between("2026-11-30", "2027-12-31") == 273  # RT-25
    assert cal.add_sessions("2026-11-30", 252).date().isoformat() == "2027-12-01"
    assert cal.session_close("2026-11-27") == pd.Timestamp("2026-11-27 18:00", tz="UTC")  # early close


def test_context_truncates_everything(store):
    t = pd.Timestamp("2016-03-31")
    ctx = AsOfContext(store, t, TICKER)
    for name, df in ctx._t.items():
        col = "content_available_at" if name == "events" else "available_at"
        if col in df.columns and not df.empty:
            assert (df[col] <= ctx.asof).all(), name
    assert ctx.prices().index.max() <= t


def test_fundamentals_as_first_reported(store):
    before = AsOfContext(store, "2009-12-31", TICKER).fundamentals("Revenues")
    after = AsOfContext(store, "2010-02-26", TICKER)
    first = after.fundamentals("Revenues", vintage="as_first_reported")
    latest = after.fundamentals("Revenues", vintage="latest_known")
    q = pd.Timestamp("2009-09-30")
    v_before = before.loc[before["period_end"] == q, "value"].item()
    assert first.loc[first["period_end"] == q, "value"].item() == v_before
    assert latest.loc[latest["period_end"] == q, "value"].item() > v_before


def test_series_vintages(store):
    ctx = AsOfContext(store, "2016-03-31", TICKER)
    first = ctx.series("FRED:CPIAUCSL", vintage="first_release")
    latest = ctx.series("FRED:CPIAUCSL")
    common = first.index.intersection(latest.index)
    assert (latest[common] >= first[common]).all()


def test_split_continuity_base_share(store):
    ctx = AsOfContext(store, "2021-06-30", TICKER)
    raw = ctx.prices(basis="raw")
    base = ctx.prices(basis="base_share")
    d0, d1 = pd.Timestamp("2020-08-28"), pd.Timestamp("2020-08-31")
    assert raw[d1] / raw[d0] < 0.35  # 4:1 split visible in raw prices
    assert 0.8 < base[d1] / base[d0] < 1.25  # continuous in base-share units
    assert np.isfinite(ctx.returns().loc[d1])


def test_anchor_fixes_expected_simple_return(store):
    from probcast.contract import distribution as D

    ctx = AsOfContext(store, "2016-03-31", TICKER)
    for h in (21, 252):
        q = ctx.anchor(h)
        assert D.mean_exp(q)[0] - 1 == np.float64(ctx.mu * h / 252).round(12) or abs(D.mean_exp(q)[0] - 1 - ctx.mu * h / 252) < 1e-9
