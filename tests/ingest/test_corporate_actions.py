"""Split ledger, future split factor and dividend conversion to as-traded $/share."""

from __future__ import annotations

import pandas as pd
import pytest

from probcast.config import SEED_DIR
from probcast.ingest import corporate_actions as C
from probcast.lake.store import conform
from tests.ingest.conftest import yahoo_frame

SEED = SEED_DIR / "aapl_corporate_actions.csv"


@pytest.fixture(scope="module")
def ledger() -> pd.DataFrame:
    return C.load_split_seed(SEED, "AAPL")


def test_seed_has_the_five_splits_with_announcements(ledger):
    assert [str(d) for d in ledger["ex_date"]] == [
        "1987-06-16", "2000-06-21", "2005-02-28", "2014-06-09", "2020-08-31"]
    assert ledger["value"].tolist() == [2, 2, 2, 7, 4]
    assert ledger["value"].prod() == 224
    assert (ledger["available_at"] == ledger["announced_at"]).all()
    assert str(ledger["available_at"].dt.tz) == "UTC"
    assert (ledger["available_at"].dt.tz_convert(None) < pd.to_datetime(ledger["ex_date"])).all()
    assert ledger["source"].str.contains("http").all()
    conform("corporate_actions", ledger)


@pytest.mark.parametrize(("day", "factor"), [
    ("1980-12-12", 224), ("1987-06-15", 224), ("1987-06-16", 112), ("2005-02-25", 56),
    ("2014-06-06", 28), ("2014-06-09", 4), ("2020-08-28", 4), ("2020-08-31", 1), ("2026-11-17", 1),
])
def test_future_split_factor(ledger, day, factor):
    assert C.future_split_factor([day], ledger)[0] == factor


def test_same_day_splits_multiply_and_empty_ledger_is_one():
    s = pd.DataFrame({"ex_date": ["2000-01-03", "2000-01-03"], "value": [2.0, 3.0]})
    assert C.future_split_factor(["1999-12-31", "2000-01-03"], s).tolist() == [6.0, 1.0]
    assert C.future_split_factor(["1999-12-31"], s.iloc[:0]).tolist() == [1.0]


def test_dividends_converted_to_as_traded(ledger):
    """Yahoo dividends are split-adjusted: as traded = yahoo x F(ex_date) (DAT-105 arithmetic)."""
    yahoo = pd.Series(
        [0.000536, 0.094643, 0.05125, 0.27, 0.0],
        index=pd.to_datetime(["1987-08-10", "2012-08-09", "2020-08-07", "2026-11-12", "2026-08-11"]))
    out = C.dividends_as_traded(yahoo, ledger).set_index("ex_date")
    assert out.loc[pd.Timestamp("1987-08-10").date(), "value"] == pytest.approx(0.06)
    assert out.loc[pd.Timestamp("2012-08-09").date(), "value"] == pytest.approx(2.65)
    assert out.loc[pd.Timestamp("2020-08-07").date(), "value"] == pytest.approx(0.205)
    assert out.loc[pd.Timestamp("2026-11-12").date(), "value"] == pytest.approx(0.27)
    assert len(out) == 4  # zero rows ignored
    assert out["factor"].tolist() == [112, 28, 4, 1]


def test_precision_rounding_keeps_only_supported_digits():
    # 0.000536 x 224 = 0.120064: vendor rounding noise, removed at 3 decimals
    yahoo = pd.Series([0.000536], index=pd.to_datetime(["1987-05-11"]))
    out = C.dividends_as_traded(yahoo, C.load_split_seed(SEED, "AAPL"))
    assert out["value"].iloc[0] == 0.12


def test_dividend_rows_available_at_close_before_ex_date():
    divs = pd.DataFrame({"ex_date": [pd.Timestamp("2012-08-09").date()], "value": [2.65]})
    rows = C.dividend_rows("TEST", divs, "test")
    assert rows["available_at"].iloc[0] == pd.Timestamp("2012-08-08T20:00:00Z")
    assert rows["announced_at"].isna().all()
    conform("corporate_actions", rows)


def test_vendor_splits_for_unseeded_symbols(ledger):
    y = yahoo_frame("2020-08-20", "2020-09-04", splits={"2020-08-31": 4.0})
    rows, used, issues = C.build_corporate_actions("PEER", y, None)
    assert used["value"].tolist() == [4.0]
    assert issues == []
    split = rows[rows["action"] == "split"].iloc[0]
    assert pd.isna(split["announced_at"])
    assert split["available_at"] == pd.Timestamp("2020-08-28T20:00:00Z")  # close before ex-date


def test_seed_overrides_vendor_and_mismatches_are_reported(ledger):
    y = yahoo_frame("2020-08-20", "2020-09-04", splits={"2020-08-31": 5.0})
    _, used, issues = C.build_corporate_actions("AAPL", y, ledger)
    assert used["value"].tolist() == [2, 2, 2, 7, 4]
    assert any("seed ratio 4.0 != vendor ratio 5.0" in m for m in issues)
    assert any("in seed but not in vendor" in m for m in issues)  # synthetic frame lacks old splits


def test_seed_rejects_split_announced_after_ex_date(tmp_path):
    bad = tmp_path / "bad.csv"
    bad.write_text(SEED.read_text().replace("2020-07-30T18:55:04-04:00", "2020-09-01T18:55:04-04:00"))
    with pytest.raises(ValueError, match="announced on/after"):
        C.load_split_seed(bad, "AAPL")


def test_pre_calendar_ex_dates_use_previous_weekday_close():
    """Peers listed before 1980 (e.g. HPQ) have ex-dates before the XNYS calendar starts."""
    divs = pd.DataFrame({"ex_date": [pd.Timestamp("1975-06-02").date()], "value": [0.1]})
    rows = C.dividend_rows("OLD", divs, "test")
    assert rows["available_at"].iloc[0] == pd.Timestamp("1975-05-30 16:00", tz="America/New_York")
