"""Events v1 -> v1.1 migration (ADR-016): verification mapping, corrections, loader."""

from __future__ import annotations

import copy

import pandas as pd
import pytest

from probcast.config import SEED_DIR
from probcast.ingest import events as EV
from probcast.lake.schemas import HINDSIGHT_COLUMNS
from probcast.lake.store import conform

V1 = SEED_DIR / "aapl_events_seed_v1.csv"
PATCH = SEED_DIR / "aapl_events_v1_1_patch.yaml"
V11 = SEED_DIR / "aapl_events.csv"


@pytest.fixture(scope="module")
def v1() -> pd.DataFrame:
    return pd.read_csv(V1, dtype=str, keep_default_na=False)


@pytest.fixture(scope="module")
def patch() -> dict:
    return EV.load_patch(PATCH)


@pytest.fixture(scope="module")
def migrated(v1, patch) -> pd.DataFrame:
    return EV.migrate_v1(v1, patch)


def test_fresh_migration_has_zero_human_opened(migrated):
    assert (migrated["verification"] == "human_opened").sum() == 0
    assert set(migrated["verification"]) <= {"unverified", "ai_recalled", "web_checked"}


def test_verification_mapping(v1, migrated):
    m = migrated.set_index("event_id")["verification"]
    for r in v1.to_dict("records"):
        got = m[r["event_id"]]
        if r["verification_status"] == "unverified":
            assert got == "unverified", r["event_id"]
        else:
            assert got in {"ai_recalled", "web_checked"}, r["event_id"]
    assert (migrated["verification"] == "unverified").sum() == 18


def test_patch_cannot_set_human_opened(v1, patch):
    bad = copy.deepcopy(patch)
    bad["overrides"]["AAPL-EV-20151216-02"]["verification"] = "human_opened"
    with pytest.raises(EV.EventsError, match="human_opened"):
        EV.migrate_v1(v1, bad)
    bad2 = copy.deepcopy(patch)
    bad2["additions"][0]["verification"] = "human_opened"
    with pytest.raises(EV.EventsError, match="human_opened"):
        EV.migrate_v1(v1, bad2)


def test_patch_with_unknown_event_id_is_rejected(v1, patch):
    bad = copy.deepcopy(patch)
    bad["web_checked"]["x"] = ["AAPL-EV-99999999-01"]
    with pytest.raises(EV.EventsError, match="unknown event_ids"):
        EV.migrate_v1(v1, bad)


def test_committed_seed_is_the_migration_output(migrated):
    committed = pd.read_csv(V11, dtype=str, keep_default_na=False)
    pd.testing.assert_frame_equal(committed, migrated.astype(str))


def test_selection_method(migrated):
    rc = migrated[migrated["selection_method"] == "rule_complete"]
    assert len(rc) == 88
    assert set(rc["event_type"]) == {"earnings"}
    assert set(migrated.loc[migrated["event_type"] != "earnings", "selection_method"]) == {"curated"}


def test_williams_coo_row_fixed(migrated):
    r = migrated.set_index("event_id").loc["AAPL-EV-20151216-02"]
    assert pd.Timestamp(r["content_available_at"]) == pd.Timestamp("2015-12-17T16:30:59-05:00")
    assert pd.Timestamp(r["occurred_at"]).date() == pd.Timestamp("2015-12-16").date()
    assert r["time_precision"] == "exact"


def test_no_yoy_growth_text_and_tariff_note(migrated):
    fy2010 = migrated[migrated["tags"].str.contains("fy2010") & (migrated["event_type"] == "earnings")]
    assert len(fy2010) == 4
    for d in fy2010["description"]:
        assert "%" not in d
        assert "prior-year" not in d
    assert not migrated["description"].str.contains("vs as-reported prior-year quarter").any()
    q3 = migrated.set_index("event_id").loc["AAPL-EV-20260730-01", "description"]
    assert "$0.11" in q3
    assert "tariff refunds" in q3


def test_additions_present(migrated):
    ids = set(migrated["event_id"])
    assert {"AAPL-EV-20260304-01", "AAPL-EV-20260717-01", "AAPL-EV-20260728-01"} <= ids


def test_three_times_are_consistent(migrated):
    o = pd.to_datetime(migrated["occurred_at"], utc=True, format="ISO8601")
    c = pd.to_datetime(migrated["content_available_at"], utc=True, format="ISO8601")
    a = pd.to_datetime(migrated["announced_at"].replace("", None), utc=True, format="ISO8601")
    sched = a.notna()
    assert sched.sum() == 13
    assert (a[sched] <= o[sched]).all()                   # schedule known before it happens
    assert (c[sched] == a[sched]).all()                   # PIT content = the announcement
    ny = "America/New_York"
    assert (c[~sched].dt.tz_convert(ny).dt.date >= o[~sched].dt.tz_convert(ny).dt.date).all()


def test_loader_produces_lake_rows():
    res = EV.ingest_events(V11, "AAPL")
    rows = res["events"]
    assert len(rows) == 264
    assert str(rows["content_available_at"].dt.tz) == "UTC"
    assert rows["importance"].dtype == "Int32"
    assert res["info"]["human_opened"] == 0
    assert res["info"]["unverified_hidden_by_default"] == 18
    assert set(HINDSIGHT_COLUMNS["events"]) <= set(rows.columns)  # stored; stripped by the PIT layer
    conform("events", rows)


def test_audit_flags_rows_earlier_than_acceptance():
    df = pd.DataFrame([{
        "event_id": "E1", "content_available_at": "2015-12-16T23:59:59-05:00", "time_precision": "day",
        "source_url": "https://www.sec.gov/Archives/edgar/data/320193/000119312515406279/0001193125-15-406279-index.htm",
    }, {
        "event_id": "E2", "content_available_at": "2015-12-17T16:30:59-05:00", "time_precision": "exact",
        "source_url": "https://www.sec.gov/Archives/edgar/data/320193/000119312515406279/0001193125-15-406279-index.htm",
    }])
    acc = pd.DataFrame({"accession": ["0001193125-15-406279"],
                        "acceptance_utc": [pd.Timestamp("2015-12-17T21:30:59Z")]})
    out = EV.audit_against_acceptance(df, acc).set_index("event_id")["status"]
    assert out["E1"] == "earlier_than_acceptance"
    assert out["E2"] == "ok"


def test_validation_rejects_naive_timestamps(migrated):
    bad = migrated.copy()
    bad.loc[0, "content_available_at"] = "2020-01-01T10:00:00"
    assert any("UTC offset" in e for e in EV.validate_v11(bad))
