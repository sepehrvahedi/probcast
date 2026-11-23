"""probcast.descriptive: hand-checked values, point-in-time behaviour and the shared contract.

The store is the synthetic DEMO fixture world (market ^DEMOTR, splits incl. 4:1 on 2020-08-31)
with hand-made EDGAR-style facts: two 10-Ks, 10-Qs with year-to-date cash flows, a restatement,
and a 10-K accepted after the as-of date used in the PIT test.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from probcast import calendar as cal
from probcast.descriptive import (
    event_reaction,
    indexed_total_return,
    peer_medians,
    peer_sets,
    peer_table,
    ratio_table,
    reverse_dcf,
    rolling_betas,
)
from probcast.descriptive._core import Facts, context, filing_url
from probcast.descriptive.dcf import dcf_value, implied_growth
from probcast.lake.store import Store
from probcast.validation.fixtures import build_fixture_store

T = "DEMO"


def _acc(n: int) -> str:
    return f"0000123456-20-{n:06d}"


def _fact(concept: str, value: float, start: str | None, end: str, acc: int, accepted: str, form: str, unit: str = "USD") -> dict:
    av = pd.Timestamp(accepted, tz="UTC")
    return {"ticker": T, "concept": f"us-gaap:{concept}", "unit": unit, "value": value,
            "period_start": pd.Timestamp(start) if start else pd.NaT, "period_end": pd.Timestamp(end), "fy": 2020, "fp": "FY",
            "form": form, "accession": _acc(acc), "filed": av.normalize().tz_localize(None), "available_at": av, "source": "test"}


FY19 = ("2018-09-30", "2019-09-28")
FY20 = ("2019-09-29", "2020-09-26")
K19, K20 = "2019-10-30 21:00", "2020-10-29 21:00"


def _facts() -> pd.DataFrame:
    rows = []
    # FY2019 10-K (accession 1) and FY2020 10-K (accession 9).
    for (start, end), acc, when, scale in ((FY19, 1, K19, 1.0), (FY20, 9, K20, 1.1)):
        rows += [
            _fact("Revenues", 1000 * scale, start, end, acc, when, "10-K"),
            _fact("CostOfRevenue", 600 * scale, start, end, acc, when, "10-K"),
            _fact("OperatingIncomeLoss", 250 * scale, start, end, acc, when, "10-K"),
            _fact("NetIncomeLoss", 200 * scale, start, end, acc, when, "10-K"),
            _fact("NetCashProvidedByUsedInOperatingActivities", 300 * scale, start, end, acc, when, "10-K"),
            _fact("PaymentsToAcquirePropertyPlantAndEquipment", 50 * scale, start, end, acc, when, "10-K"),
            _fact("PaymentsOfDividends", 40 * scale, start, end, acc, when, "10-K"),
            _fact("PaymentsForRepurchaseOfCommonStock", 120 * scale, start, end, acc, when, "10-K"),
            _fact("AssetsCurrent", 500 * scale, None, end, acc, when, "10-K"),
            _fact("LiabilitiesCurrent", 400 * scale, None, end, acc, when, "10-K"),
            _fact("CashAndCashEquivalentsAtCarryingValue", 150 * scale, None, end, acc, when, "10-K"),
            _fact("AccountsReceivableNetCurrent", 90 * scale, None, end, acc, when, "10-K"),
            _fact("InventoryNet", 30 * scale, None, end, acc, when, "10-K"),
            _fact("Assets", 2000 * scale, None, end, acc, when, "10-K"),
            _fact("StockholdersEquity", 800 * scale, None, end, acc, when, "10-K"),
            _fact("LongTermDebtNoncurrent", 300 * scale, None, end, acc, when, "10-K"),
        ]
    # FY2020 quarters: 3-month revenue; cash flow only year-to-date (as in real 10-Qs); EPS per quarter.
    qs = [("2019-12-28", 2, "2020-01-28 21:00", 270, 80, 1.00), ("2020-03-28", 3, "2020-04-30 21:00", 260, 160, 0.90),
          ("2020-06-27", 4, "2020-07-30 21:00", 280, 230, 0.95)]
    for end, acc, when, rev, ocf_ytd, eps in qs:
        start = (pd.Timestamp(end) - pd.Timedelta(days=90)).date().isoformat()
        rows.append(_fact("Revenues", rev, start, end, acc, when, "10-Q"))
        rows.append(_fact("NetCashProvidedByUsedInOperatingActivities", ocf_ytd, FY20[0], end, acc, when, "10-Q"))
        rows.append(_fact("EarningsPerShareDiluted", eps, start, end, acc, when, "10-Q", unit="USD/shares"))
    # FY2020 diluted EPS in the 10-K, reported AFTER the 4:1 split of 2020-08-31 (post-split units).
    rows.append(_fact("EarningsPerShareDiluted", 1.0, *FY20, 9, K20, "10-K", unit="USD/shares"))
    # A restatement of FY2019 revenue in a later filing: must be ignored (as first reported).
    rows.append(_fact("Revenues", 5555, *FY19, 7, "2020-05-01 21:00", "10-K/A"))
    return pd.DataFrame(rows)


@pytest.fixture(scope="module")
def store() -> Store:
    base = build_fixture_store()
    return base.replace(fundamentals=_facts())


def _cell(df: pd.DataFrame, metric: str, col: str) -> pd.Series:
    r = df[(df["metric"] == metric) & (df["fiscal_year"] == col)]
    assert len(r) == 1, (metric, col)
    return r.iloc[0]


# ---------------------------------------------------------------------------- ratios
def test_ratio_table_contract_columns(store: Store) -> None:
    df = ratio_table(store, T, "2020-11-30")
    for c in ("metric", "group", "fiscal_year", "value", "unit", "formula", "accession", "filed", "source_url"):
        assert c in df.columns
    assert set(df["group"]) <= {"liquidity", "leverage", "profitability", "efficiency", "payout", "valuation"}
    assert {"FY2019", "FY2020", "TTM"} <= set(df["fiscal_year"])
    assert {"current_ratio", "quick_ratio", "debt_to_equity", "net_cash", "gross_margin", "operating_margin", "net_margin", "roe",
            "roa", "asset_turnover", "inventory_turnover", "payout", "pe", "ev_ebit", "fcf_yield"} <= set(df["metric"])


def test_ratio_values_hand_checked(store: Store) -> None:
    df = ratio_table(store, T, "2020-11-30")
    assert _cell(df, "current_ratio", "FY2020")["value"] == pytest.approx(550 / 440)
    assert _cell(df, "quick_ratio", "FY2020")["value"] == pytest.approx((165 + 99) / 440)
    assert _cell(df, "debt_to_equity", "FY2020")["value"] == pytest.approx(330 / 880)
    assert _cell(df, "net_cash", "FY2020")["value"] == pytest.approx(165 - 330)
    assert _cell(df, "gross_margin", "FY2020")["value"] == pytest.approx(1 - 660 / 1100)
    assert _cell(df, "roe", "FY2020")["value"] == pytest.approx(220 / 880)
    assert _cell(df, "inventory_turnover", "FY2020")["value"] == pytest.approx(660 / 33)
    assert _cell(df, "payout", "FY2020")["value"] == pytest.approx((44 + 132) / 220)
    c = _cell(df, "current_ratio", "FY2020")
    assert c["accession"] == _acc(9)
    assert c["source_url"].endswith(f"/{_acc(9).replace('-', '')}/")
    assert c["source_url"].startswith("https://www.sec.gov/Archives/edgar/data/")


def test_first_reported_wins_over_restatement(store: Store) -> None:
    df = ratio_table(store, T, "2020-11-30")
    # FY2019 gross margin uses the 10-K revenue (1000), not the later 10-K/A restatement (5555).
    assert _cell(df, "gross_margin", "FY2019")["value"] == pytest.approx(0.4)
    assert _cell(df, "gross_margin", "FY2019")["accession"] == _acc(1)


def test_pit_excludes_filings_after_asof(store: Store) -> None:
    before = ratio_table(store, T, "2020-10-28")  # FY2020 10-K accepted 2020-10-29
    assert "FY2020" not in set(before["fiscal_year"])
    assert before["available_at"].dropna().max() <= "2020-10-28T21:00:00Z"
    after = ratio_table(store, T, "2020-10-30")
    assert "FY2020" in set(after["fiscal_year"])


def test_valuation_uses_filing_session_close(store: Store) -> None:
    df = ratio_table(store, T, "2020-11-30")
    pe = _cell(df, "pe", "FY2020")
    # The 10-K was accepted after the 2020-10-29 close, so day 0 is the next session.
    assert pe["price_session"] == "2020-10-30"
    ctx = context(store, T, "2020-11-30")
    price_base = float(ctx.prices(T).loc["2020-10-30"])
    eps_base = 1.0 * float(ctx._split_factor(T, pd.DatetimeIndex(["2020-10-29"]))[0])
    assert pe["value"] == pytest.approx(price_base / eps_base)


def test_quarters_from_year_to_date_and_split_safe_eps(store: Store) -> None:
    ctx = context(store, T, "2020-11-30")
    f = Facts(ctx, T)
    ocf = f.quarterly("ocf").set_index("period_end")["value"]
    assert ocf.loc["2020-03-28"] == pytest.approx(80)  # 160 YTD − 80
    assert ocf.loc["2020-06-27"] == pytest.approx(70)
    assert ocf.loc["2020-09-26"] == pytest.approx(330 - 230)  # Q4 = FY − 9M
    assert f.ttm("ocf")[0] == pytest.approx(330)
    # EPS: Q1–Q3 were reported before the 4:1 split, the FY after it. On the base-share basis the
    # derived Q4 is FY − (Q1 + Q2 + Q3) with every term in the same units.
    eps = f.quarterly("eps_diluted").set_index("period_end")
    pre = float(ctx._split_factor(T, pd.DatetimeIndex(["2020-07-30"]))[0])
    post = float(ctx._split_factor(T, pd.DatetimeIndex(["2020-10-29"]))[0])
    assert post == pytest.approx(4 * pre)
    q4 = eps.loc["2020-09-26"]
    assert bool(q4["derived"])
    assert q4["value"] == pytest.approx(1.0 * post - (1.00 + 0.90 + 0.95) * pre)


# ---------------------------------------------------------------------------- reverse DCF
def test_dcf_value_matches_hand_formula() -> None:
    f0, g, k, gt = 100.0, 0.05, 0.09, 0.025
    hand = sum(f0 * 1.05**t / 1.09**t for t in range(1, 11)) + f0 * 1.05**10 * 1.025 / ((0.09 - 0.025) * 1.09**10)
    assert dcf_value(f0, g, k, gt) == pytest.approx(hand, rel=1e-12)
    gs = implied_growth(f0, hand, k, gt)
    assert gs == pytest.approx(g, abs=1e-9)
    assert implied_growth(f0, hand, 0.02, 0.025) is None  # k ≤ g_T
    assert implied_growth(-5.0, hand, k, gt) is None


def test_reverse_dcf_reproduces_price(store: Store) -> None:
    d = reverse_dcf(store, T, "2020-11-30", cost_of_equity=0.09)
    assert d["fcf_ttm"] == pytest.approx(330 - 55)
    assert len(d["grid"]) == 9
    assert {round(x["terminal_growth"], 4) for x in d["grid"]} == {0.02, 0.025, 0.03}
    assert {round(x["cost_of_equity"], 4) for x in d["grid"]} == {0.08, 0.09, 0.10}
    if d["implied_growth"] is not None:
        assert d["check"]["matches"]
    default = reverse_dcf(store, T, "2020-11-30")
    ctx = context(store, T, "2020-11-30")
    assert default["cost_of_equity"] == pytest.approx(ctx.mu)


# ---------------------------------------------------------------------------- market series
def test_indexed_total_return_rebased(store: Store) -> None:
    df = indexed_total_return(store, [T, "^DEMOTR"], "2019-01-01", "2020-06-30")
    assert df.index[0] == pd.Timestamp("2019-01-02")
    assert df.iloc[0].tolist() == pytest.approx([100.0, 100.0])
    assert df.index[-1] == pd.Timestamp("2020-06-30")
    ctx = context(store, T, "2020-06-30")
    tri = ctx.tri(T)
    assert df[T].iloc[-1] == pytest.approx(100 * tri.loc["2020-06-30"] / tri.loc["2019-01-02"])


def test_rolling_betas_match_hand_ols(store: Store) -> None:
    df = rolling_betas(store, T, "2020-06-30", window_weeks=104)
    assert set(df["factor"]) == {"FRED:DTWEXBGS", "FRED:DFII10"}
    assert df["date"].max() <= pd.Timestamp("2020-06-30")
    assert (df["ci_lo"] <= df["beta"]).all()
    assert (df["beta"] <= df["ci_hi"]).all()
    # Independent re-computation of the last DFII10 window.
    ctx = context(store, T, "2020-06-30")
    wk = lambda s: s.dropna().resample("W-FRI").last()  # noqa: E731
    ri = wk(ctx.tri(T)).pct_change()
    rm = wk(ctx.tri("^DEMOTR")).pct_change()
    rf = (wk(ctx.series("FRED:DGS1")) / 100 / 52).shift(1)
    dfac = wk(ctx.series("FRED:DFII10")).diff()
    j = pd.concat({"y": ri - rf, "m": rm - rf, "f": dfac}, axis=1).dropna()
    j = j[j.index <= pd.Timestamp("2020-06-30")].iloc[-104:]
    x = np.column_stack([np.ones(104), j["m"], j["f"]])
    b = np.linalg.lstsq(x, j["y"].to_numpy(), rcond=None)[0]
    last = df[df["factor"] == "FRED:DFII10"].iloc[-1]
    assert last["beta"] == pytest.approx(b[2], rel=1e-9)
    assert last["beta_market"] == pytest.approx(b[1], rel=1e-9)
    assert last["transform"] == "diff_pp"


# ---------------------------------------------------------------------------- peers
def test_peer_sets_from_config_keep_hindsight_separate() -> None:
    sets = peer_sets("AAPL")
    ids = [s["id"] for s in sets]
    assert ids[:2] == ["A", "B"]
    assert ids[-1] == "hindsight"
    assert "NVDA" in sets[-1]["tickers"]
    assert all("NVDA" not in s["tickers"] for s in sets[:-1])


def test_peer_table_and_medians_exclude_hindsight(store: Store) -> None:
    df = peer_table(store, [T, "^DEMONDX"], "2020-11-30")
    assert df["ticker"].tolist() == [T, "^DEMONDX"]
    assert df.loc[0, "set"] == "subject"
    assert df.loc[1, "set"] == "other"
    assert df.loc[0, "fiscal_period_end"] == "2020-09-26"
    assert df.loc[0, "accession"] == _acc(9)
    fake = pd.DataFrame([
        {"ticker": "S", "set": "subject", "set_label": "Subject", "pe": 50.0},
        {"ticker": "A1", "set": "A", "set_label": "Platform", "pe": 10.0},
        {"ticker": "A2", "set": "A", "set_label": "Platform", "pe": 20.0},
        {"ticker": "H", "set": "hindsight", "set_label": "Hindsight peer", "pe": 1000.0},
    ]).reindex(columns=["ticker", "set", "set_label", "revenue_growth", "gross_margin", "operating_margin", "roe", "pe", "ev_ebit", "total_return_1y"])
    med = peer_medians(fake).set_index("set")
    assert med.loc["A", "pe"] == pytest.approx(15.0)
    assert med.loc["all", "pe"] == pytest.approx(15.0)
    assert "hindsight" not in med.index


# ---------------------------------------------------------------------------- event reaction
def test_event_reaction_market_model_and_day0(store: Store) -> None:
    ev = store.table("events").iloc[-12]
    r = event_reaction(store, T, ev["event_id"])
    assert r["market"] == "^DEMOTR"  # the configured S&P 500-style market, never the Nasdaq proxy
    assert r["estimation_window"] == [-280, -31]
    # Released 16:30 ET (after the close): day 0 is the next session.
    release = pd.Timestamp(ev["content_available_at"])
    first_close = cal.first_session_closing_after(release)
    assert r["day0_session"] == pd.Timestamp(first_close).date().isoformat()
    assert pd.Timestamp(r["day0_session"]) > release.tz_convert(cal.NY).tz_localize(None).normalize()
    assert r["status"] == "ok"
    assert r["estimation"]["n"] >= 120
    w = {x["window"]: x for x in r["windows"]}
    # Hand check of CAR[0,+1] from the fitted α, β.
    ctx = context(store, T)
    ri = np.expm1(ctx.returns(T))
    rm = np.expm1(ctx.returns("^DEMOTR"))
    d0 = ri.index.get_loc(pd.Timestamp(r["day0_session"]))
    ar = ri.iloc[d0:d0 + 2].to_numpy() - r["alpha"] - r["beta"] * rm.iloc[d0:d0 + 2].to_numpy()
    assert w["[0,+1]"]["car"] == pytest.approx(float(ar.sum()), rel=1e-9)
    assert "self-inclusion" in r["self_inclusion"]


def test_filing_url_format() -> None:
    assert filing_url("AAPL", "0000320193-26-000026") == "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/"
    assert filing_url("AAPL", None) is None
