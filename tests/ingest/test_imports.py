"""``probcast.observations.v1`` import validation (DAT-404..415)."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from probcast.ingest import imports as IM
from probcast.lake.store import conform

HEADER = ("series_id,entity,kind,period_start,period_end,value,unit,available_at,available_basis,"
          "lag_rule,vintage_id,source_name,source_url,provider_ref,licence_class,status,notes")
GOOD = [
    "user.team.tsmc_rev_m,TSMC,actual,2026-10-01,2026-10-31,586.9,TWD_bn,2026-11-10T13:30:00+08:00,"
    "publication_date,,2026-11-10,TSMC monthly revenue report,https://example.org/tsmc,,L0,ok,synthetic",
    "user.team.iphone_asp,AAPL,estimate,,2026-12-31,1000.5,USD,2026-11-01T17:00:00-05:00,"
    "assumed_lag,period_end + 45d @ 16:00 America/New_York,,Team estimate,https://example.org/asp,,L1,ok,synthetic",
]
NOW = pd.Timestamp("2026-11-18T12:00:00Z")


def write(tmp: Path, rows: list[str], name: str = "obs.csv") -> Path:
    p = tmp / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join([HEADER, *rows]) + "\n")
    return p


def rules(path: Path, settings) -> set[str]:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    return {e["rule"] for e in IM.validate(df, path=path, settings=settings, now=NOW).errors}


def test_valid_file_imports_with_manifest_and_badge(tmp_path, settings):
    p = write(tmp_path, GOOD)
    res = IM.import_observations(p, settings, now=NOW)
    obs, cat = res["observations"], res["series_catalog"]
    assert set(obs["series_id"]) == {"user.team.tsmc_rev_m@TSMC", "user.team.iphone_asp@AAPL"}
    assert obs.loc[obs["series_id"] == "user.team.iphone_asp@AAPL", "vintage_id"].iloc[0] == "2026-11-01"
    assert res["badges"] == {"user.team.iphone_asp": "PIT: assumed"}
    assert obs["available_at"].iloc[0] == pd.Timestamp("2026-11-10T05:30:00Z")
    man = json.loads(Path(res["manifest"]).read_text())  # DAT-415
    assert man["rows"] == 2
    assert man["schema_version"] == "probcast.observations.v1"
    assert len(man["sha256"]) == 64
    assert man["importer_version"]
    assert man["ingested_at"]
    assert cat.set_index("series_id").loc["user.team.iphone_asp@AAPL", "pit_grade"] == "C"
    conform("observations", obs)
    conform("series_catalog", cat)


@pytest.mark.parametrize(("rule", "row"), [
    ("DAT-404", GOOD[0].replace("2026-11-10T13:30:00+08:00", "2026-11-10T13:30:00")),
    ("DAT-404", GOOD[0].replace("2026-11-10T13:30:00+08:00", "")),
    ("DAT-405", GOOD[0].replace("2026-11-10T13:30:00+08:00", "2026-10-15T13:30:00+08:00")),
    ("DAT-406", GOOD[0].replace("2026-11-10T13:30:00+08:00", "2026-12-10T13:30:00+08:00")),
    ("DAT-409", GOOD[1].replace("period_end + 45d @ 16:00 America/New_York", "")),
    ("DAT-412", GOOD[0].replace("https://example.org/tsmc", "")),
    ("DAT-414", GOOD[0].replace(",586.9,", ',"1,586.9",')),
    ("DAT-414", GOOD[0].replace("2026-10-31", "31/10/2026")),
    ("DAT-414", GOOD[0].replace(",586.9,", ",,")),
])
def test_rule_violations_are_errors(tmp_path, settings, rule, row):
    p = write(tmp_path, [row])
    assert rule in rules(p, settings)
    with pytest.raises(IM.ImportValidationError):
        IM.import_observations(p, settings, now=NOW)


def test_missing_value_allowed_only_with_status_missing(tmp_path, settings):
    row = GOOD[0].replace(",586.9,", ",,").replace(",L0,ok,", ",L0,missing,")
    assert rules(write(tmp_path, [row]), settings) == set()


def test_duplicate_key_dat407(tmp_path, settings):
    assert "DAT-407" in rules(write(tmp_path, [GOOD[0], GOOD[0]]), settings)


def test_one_unit_per_series_dat408(tmp_path, settings):
    other = GOOD[0].replace("2026-10-01,2026-10-31", "2026-09-01,2026-09-30").replace("TWD_bn", "TWD_mn")
    assert "DAT-408" in rules(write(tmp_path, [GOOD[0], other]), settings)


def test_lag_sanity_is_a_warning_dat410(tmp_path, settings):
    q = GOOD[0].replace("2026-10-01,2026-10-31", "2026-07-01,2026-09-30").replace(
        "2026-11-10T13:30:00+08:00", "2026-10-02T13:30:00+08:00")
    p = write(tmp_path, [q])
    df = pd.read_csv(p, dtype=str, keep_default_na=False)
    res = IM.validate(df, path=p, settings=settings, now=NOW)
    assert res.ok
    assert [w["rule"] for w in res.warnings] == ["DAT-410"]


def test_licensed_files_must_live_under_local_dir_dat411_dat413(tmp_path, settings):
    l4 = GOOD[0].replace(",,L0,", ",BEST_EPS;BEST_FPERIOD_OVERRIDE=1BF,L4,")
    outside = write(tmp_path / "elsewhere", [l4])
    assert "DAT-411" in rules(outside, settings)
    inside = write(settings.local_dir, [l4])
    assert rules(inside, settings) == set()
    no_ref = GOOD[0].replace(",,L0,", ",,L4,")
    assert "DAT-413" in rules(write(settings.local_dir, [no_ref], "noref.csv"), settings)


def test_missing_required_column(tmp_path, settings):
    p = tmp_path / "x.csv"
    p.write_text("series_id,value\nuser.a.b,1\n")
    assert "schema" in rules(p, settings)
