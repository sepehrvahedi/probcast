"""Report slice (B6): evidence pack, references with verification, Report studio API and the
Analyzer library. Fixture world (ticker DEMO), temporary PROBCAST_HOME, coarse origins."""

from __future__ import annotations

import io
import json
import sys
import time
import types
import zipfile
from collections.abc import Iterator
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from probcast.report import descriptive_pack as DP
from probcast.report import references as REF
from probcast.scoring import registry as R
from probcast.server.app import create_app
from probcast.server.workspace import ComputeOptions

BASE = "http://127.0.0.1:8000"
LOCAL = {"Origin": BASE, "Content-Type": "application/json", "X-Acting-As": "kestrel"}
FAST = ComputeOptions(origin_stride=6, workers=1, n_boot=100, leak=False, job_workers=1)
API = "/api/v1"
DESCRIPTIVE = ("F2_rolling_betas", "F3_indexed_tr", "F4_margins_roe", "T1_ratios", "T2_peers", "T4_reverse_dcf")


def wait_job(client: TestClient, job_id: str, timeout: float = 600) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = client.get(f"{API}/jobs/{job_id}").json()
        if j["status"] in ("succeeded", "failed"):
            return j
        time.sleep(0.2)
    raise AssertionError(f"job {job_id} did not finish")


# ---------------------------------------------------------------------------- references (unit)
def test_harvard_formats_and_in_text_rules() -> None:
    r = REF.catalogue_ref("method:gneiting-raftery-2007")
    assert r.verification == "ai_recalled"
    assert r.harvard() == ("Gneiting, T. and Raftery, A.E. (2007) ‘Strictly proper scoring rules, prediction, and estimation’, "
                           "Journal of the American Statistical Association, 102(477), pp. 359–378.")
    assert r.in_text() == "(Gneiting and Raftery, 2007)"
    assert REF.catalogue_ref("method:harvey-leybourne-newbold-1997").in_text() == "(Harvey, Leybourne and Newbold, 1997)"
    assert REF.catalogue_ref("method:bracher-2021").in_text() == "(Bracher et al., 2021)"
    f = REF.filing_ref("0000320193-23-000106", company="Example Corp.", cik="0000320193", form="10-K", filed="2023-11-03", period="2023-09-30")
    assert f.url == "https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/"
    assert "Form 10-K for the period ended 30 September 2023" in f.harvard()
    assert f.verification == "unverified"
    unknown = REF.catalogue_ref("ref:not-in-catalogue")
    assert unknown.verification == "unverified"
    assert "not yet in the citation catalogue" in unknown.title
    assert "@article{Bracher2021" in REF.catalogue_ref("method:bracher-2021").bibtex()


def test_bibliography_exports_only_human_opened_and_checks_content(tmp_path: Path) -> None:
    from probcast.config import Settings

    s = Settings(home=tmp_path, sec_user_agent=None, fred_api_key=None, tiingo_api_key=None)
    refs = REF.RefSet()
    refs.add_keys(["ref:sharpe-1964", "method:genest-1992"], "F7")
    items = refs.to_list()
    assert REF.bibliography(items) == ""
    REF.record_opened(s, items[0], "kestrel", "snap")
    merged = REF.apply_verifications(items, REF.verifications(s))
    opened = [r for r in merged if r["verification"] == "human_opened"]
    assert [r["id"] for r in opened] == [items[0]["id"]]
    assert opened[0]["opened_by"] == "kestrel"
    assert opened[0]["accessed"]
    assert "(Accessed:" not in opened[0]["text"]
    text = REF.bibliography(merged)
    assert opened[0]["text"] in text
    assert items[1]["text"] not in text
    assert R.verify("verifications", s)
    # A changed reference (different content hash) is not covered by the old record.
    changed = [dict(items[0], content_hash="0" * 16)]
    assert REF.apply_verifications(changed, REF.verifications(s))[0]["verification"] == "ai_recalled"


# ---------------------------------------------------------------------------- descriptive figures (contract shapes)
def _fake_contract(store, ticker: str) -> types.ModuleType:
    """A stand-in probcast.descriptive returning the B5 contract shapes."""
    mod = types.ModuleType("probcast.descriptive")
    fy = ["FY2021", "FY2022", "FY2023", "FY2024", "FY2025", "TTM"]

    def ratio_table(store, ticker, asof):
        rows = []
        for i, f in enumerate(fy):
            acc = f"0000000000-2{i}-00000{i}"
            for metric, label, unit, v in (("gross_margin", "Gross margin", "fraction", 0.40 + i / 100), ("operating_margin", "Operating margin", "fraction", 0.28),
                                           ("net_margin", "Net margin", "fraction", 0.24), ("roe", "Return on equity", "fraction", 1.5), ("pe", "P/E", "multiple", 28.0)):
                rows.append({"metric": metric, "group": "profitability" if unit == "fraction" else "valuation", "fiscal_year": f, "value": v, "unit": unit,
                             "formula": "x / y", "accession": acc, "filed": f"202{i}-11-01", "source_url": f"https://www.sec.gov/Archives/edgar/data/1/{acc.replace('-', '')}/",
                             "label": label, "period_end": f"202{i}-09-30", "form": "10-K"})
        return pd.DataFrame(rows)

    def peer_table(store, tickers, asof):
        return pd.DataFrame([{"ticker": t, "set": "a", "set_label": "Peer set A", "revenue_growth": 0.05, "gross_margin": 0.4, "operating_margin": 0.3,
                              "roe": 0.2, "pe": 25.0, "ev_ebit": 20.0, "total_return_1y": 0.1, "fiscal_period_end": "2025-09-30",
                              "accession": "0000000000-25-000009", "filed": "2025-11-01", "source_url": None, "available_at": "2025-11-01T21:00:00Z",
                              "price_date": "2026-01-02"} for t in tickers])

    def indexed_total_return(store, tickers, start, asof):
        idx = pd.bdate_range(pd.Timestamp(start), pd.Timestamp(asof))
        df = pd.DataFrame({t: 100 * np.exp(np.cumsum(np.full(len(idx), 1e-4 * (k + 1)))) for k, t in enumerate(tickers)}, index=idx)
        df.index.name = "date"
        return df

    def rolling_betas(store, ticker, asof, factors=("FRED:DTWEXBGS", "FRED:DFII10"), window_weeks=156):
        dates = pd.date_range(end=pd.Timestamp(asof), periods=60, freq="W-FRI")
        return pd.DataFrame([{"date": d, "factor": f, "transform": "x", "beta": b, "se": 0.1, "ci_lo": b - 0.2, "ci_hi": b + 0.2, "beta_market": 1.1, "n": 156, "r2": 0.3}
                             for f, b in zip(factors, (-0.8, -0.05), strict=True) for d in dates])

    def reverse_dcf(store, ticker, asof, *, cost_of_equity=None):
        return {"implied_growth": 0.081, "cost_of_equity": 0.092, "price": 101.5,
                "grid": [{"cost_of_equity": c, "terminal_growth": g, "implied_growth": 0.08 + (c - 0.092) - (g - 0.025)}
                         for c in (0.082, 0.092, 0.102) for g in (0.02, 0.025, 0.03)]}

    for fn in (ratio_table, peer_table, indexed_total_return, rolling_betas, reverse_dcf):
        setattr(mod, fn.__name__, fn)
    return mod


@pytest.fixture
def fixture_store():
    from probcast.validation.fixtures import build_fixture_store

    return build_fixture_store()


def test_descriptive_items_build_from_contract(monkeypatch: pytest.MonkeyPatch, fixture_store, tmp_path: Path) -> None:
    monkeypatch.setitem(sys.modules, "probcast.descriptive", _fake_contract(fixture_store, "DEMO"))
    refs = REF.RefSet()
    cfg = {"ticker": "DEMO", "name": "Synthetic Demo Inc.", "cik": "1", "benchmarks": {"nasdaq": "^DEMONDX"}, "peers": {"a": ["P1", "P2"], "hindsight": ["H1"]}}
    out = DP.build(fixture_store, "DEMO", pd.Timestamp("2020-06-30"), cfg, refs)
    assert out.skipped == []
    assert sorted(f.key for f in out.figures) == ["F2_rolling_betas", "F3_indexed_tr", "F4_margins_roe"]
    assert sorted(t.key for t in out.tables) == ["T1_ratios", "T2_peers", "T4_reverse_dcf"]
    for f in out.figures:
        rec = f.save(tmp_path)
        assert all(x["ok"] for x in rec["lint"]), rec["lint"]
        assert rec["caption"].startswith("Figure:")
        assert rec["width_px"] > 1500
    t1 = next(t for t in out.tables if t.key == "T1_ratios")
    assert list(t1.df.columns)[-1] == "TTM"
    assert t1.df.iloc[-1]["Metric"] == "Filing (accession)"
    t2 = next(t for t in out.tables if t.key == "T2_peers")
    assert "H1" in set(t2.df["ticker"])
    assert "source_url" not in t2.df.columns
    assert out.ledger["descriptive.reverse_dcf.implied_growth"] == pytest.approx(0.081)
    ids = set(refs.items)
    assert {"fred:DTWEXBGS", "alfred:DFII10", "method:rappaport-mauboussin-2001"} <= ids
    assert sum(1 for i in ids if i.startswith("sec:")) == 7  # six FY/TTM filings + one peer filing
    assert all("advice" not in f.caption.lower() for f in out.figures)


def test_descriptive_items_skip_cleanly_without_contract(monkeypatch: pytest.MonkeyPatch, fixture_store) -> None:
    monkeypatch.setitem(sys.modules, "probcast.descriptive", types.ModuleType("probcast.descriptive"))
    out = DP.build(fixture_store, "DEMO", pd.Timestamp("2020-06-30"), {"ticker": "DEMO"}, REF.RefSet())
    assert out.figures == []
    assert out.tables == []
    assert sorted(s["key"] for s in out.skipped) == sorted(DESCRIPTIVE)
    assert all("not available yet" in s["reason"] for s in out.skipped)


# ---------------------------------------------------------------------------- API
@pytest.fixture(scope="module")
def client(tmp_path_factory: pytest.TempPathFactory) -> Iterator[TestClient]:
    home = tmp_path_factory.mktemp("probcast-home-report")
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("PROBCAST_HOME", str(home))
        mp.delenv("PROBCAST_DATA", raising=False)
        mp.delenv("PROBCAST_SNAPSHOT", raising=False)
        app = create_app(data="fixtures", options=FAST, web_dist=home / "no-dist")
        with TestClient(app, base_url=BASE) as c:
            yield c


@pytest.fixture(scope="module")
def built(client: TestClient) -> dict:
    r = client.post(f"{API}/report/build", headers=LOCAL, json={})
    assert r.status_code == 202, r.text
    j = wait_job(client, r.json()["id"])
    assert j["status"] == "succeeded", j
    return j["result"]


def test_before_build_and_write_rules(client: TestClient) -> None:
    st = client.get(f"{API}/report/status").json()
    assert st["state"] in ("missing", "building", "ready")
    assert st["cli"] == "probcast report build"
    if st["state"] == "missing":
        r = client.get(f"{API}/report/figures")
        assert r.status_code == 404
        assert r.json()["error"] == "NotFound"
    r = client.post(f"{API}/report/build", headers={k: v for k, v in LOCAL.items() if k != "X-Acting-As"}, json={})
    assert r.status_code == 422
    r = client.post(f"{API}/report/build", headers={"Content-Type": "application/json", "X-Acting-As": "kestrel"}, json={})
    assert r.status_code == 403  # writes need the local Origin
    for path in ("report/freeze", "report/reveal", "holdout/reveal"):
        assert client.post(f"{API}/{path}", headers=LOCAL, json={}).status_code == 404


def test_figures_files_and_lint(client: TestClient, built: dict) -> None:
    d = client.get(f"{API}/report/figures").json()
    keys = [f["key"] for f in d["items"]]
    for k in ("F1_price_events", "F5_scorecard", "F6_waterfall", "F7_fan", "F8_reliability"):
        assert k in keys
    accounted = set(keys) | {s["key"] for s in d["skipped"]}
    assert {k for k in DESCRIPTIVE if k.startswith("F")} <= accounted
    assert [s["id"] for s in d["sections"]] == ["intro", "macro", "sector", "fundamental", "future", "conclusion"]
    assert d["fixture"] is True
    assert d["built_by"] == "kestrel"
    for f in d["items"]:
        assert f["file_state"] == "ok", f["key"]
        assert all(x["ok"] for x in f["lint"]), (f["key"], f["lint"])
        assert f["caption"] == " ".join(v for k, v in f["slots"].items() if v)
        assert f["provenance"]["kind"] == "figure"
        png = client.get(f["png_url"])
        assert png.status_code == 200
        assert png.headers["content-type"] == "image/png"
        import hashlib

        assert hashlib.sha256(png.content).hexdigest() == f["png_sha256"]
        svg = client.get(f["svg_url"])
        assert svg.headers["content-type"].startswith("image/svg+xml")
        assert b"<svg" in svg.content[:2000]
    for k in ("F5_scorecard", "F7_fan", "F8_reliability"):
        ctx = next(f for f in d["items"] if f["key"] == k)["context"]
        assert ctx["reference"] == "CAPM anchor"
        assert ctx["holdout"] == "sealed"
        assert ctx["n_eff"] > 0
    f7 = next(f for f in d["items"] if f["key"] == "F7_fan")
    assert "Bracher et al., 2021" in f7["in_text"]
    assert f7["caption"].startswith("Figure 7:")
    assert f7["stamp"].startswith("Notes: eval ")
    assert "holdout sealed" in f7["stamp"]
    assert next(f for f in d["items"] if f["key"] == "F6_waterfall")["stamp"] is None
    assert client.get(f"{API}/report/figures/../../etc.png").status_code == 404
    assert client.get(f"{API}/report/figures/F7_fan.gif").status_code == 404


def test_tables_and_files(client: TestClient, built: dict) -> None:
    d = client.get(f"{API}/report/tables").json()
    keys = [t["key"] for t in d["items"]]
    for k in ("T3_scorecard", "T5_scenarios", "T6_anchor_sensitivity"):
        assert k in keys
    t3 = next(t for t in d["items"] if t["key"] == "T3_scorecard")
    assert set(t3["columns"]) >= {"analyzer", "horizon", "sample", "grade", "crpss", "ci_lo", "ci_hi", "n_eff"}
    assert all(row[t3["columns"].index("sample")] != "holdout" for row in t3["rows"])
    for ext, ctype in (("csv", "text/csv"), ("md", "text/markdown"), ("html", "text/html")):
        r = client.get(t3["files"][ext]["url"])
        assert r.status_code == 200
        assert r.headers["content-type"].startswith(ctype)
    assert "<caption>Table 3:" in client.get(t3["files"]["html"]["url"]).text
    assert t3["caption"].startswith("Table 3:")
    assert client.get(f"{API}/report/tables/T3_scorecard.xlsx").status_code == 404


def test_references_opened_flow(client: TestClient, built: dict) -> None:
    d = client.get(f"{API}/report/references").json()
    ids = {r["id"] for r in d["items"]}
    assert {"method:gneiting-raftery-2007", "software:probcast", "data:yahoo-finance"} <= ids
    assert d["counts"]["human_opened"] == 0
    assert d["bibliography"]["text"] == ""
    assert all(r["verification"] in REF.VERIFICATION for r in d["items"])
    rid = "method:gneiting-raftery-2007"
    r = client.post(f"{API}/report/references/{rid}/opened", headers={k: v for k, v in LOCAL.items() if k != "X-Acting-As"}, json={})
    assert r.status_code == 422
    r = client.post(f"{API}/report/references/{rid}/opened", headers=LOCAL, json={"content_hash": "stale"})
    assert r.status_code == 409
    r = client.post(f"{API}/report/references/{rid}/opened", headers=LOCAL, json={})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["verification"] == "human_opened"
    assert body["opened_by"] == "kestrel"
    assert body["record"]["hash"]
    again = client.post(f"{API}/report/references/{rid}/opened", headers=LOCAL, json={}).json()
    assert again["already"] is True
    assert client.post(f"{API}/report/references/nope:x/opened", headers=LOCAL, json={}).status_code == 404
    d = client.get(f"{API}/report/references").json()
    assert d["counts"]["human_opened"] == 1
    assert "Gneiting, T. and Raftery, A.E. (2007)" in d["bibliography"]["text"]
    assert d["bibliography"]["text"].count("\n") == 1
    bib = client.get(f"{API}/report/references.bib")
    assert bib.status_code == 200
    assert "@article{GneitingRaftery2007" in bib.text
    assert "Sharpe" not in bib.text
    ws = client.app.state.workspace
    assert R.verify("verifications", ws.world)
    recs = R.read("verifications", ws.world)
    assert recs[-1]["by"] == "kestrel"
    assert recs[-1]["ref_id"] == rid
    assert any(a["action"] == "reference.opened" for a in R.read("audit", ws.world))


def test_ledger_consistency_and_zip(client: TestClient, built: dict) -> None:
    d = client.get(f"{API}/report/ledger").json()
    keys = {r["key"]: r for r in d["rows"]}
    assert {"final.sha256", "final.median_price", "anchor.mu"} <= set(keys)
    assert keys["final.median_price"]["provenance"]["kind"] == "ledger"
    assert d["consistency"]["ok"], d["consistency"]
    z1 = client.get(f"{API}/report/pack.zip")
    assert z1.status_code == 200
    assert z1.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(z1.content)).namelist()
    assert "figures/F7_fan.png" in names
    assert "numbers.csv" in names
    assert "bibliography.txt" in names
    assert "build.json" not in names
    assert z1.content == client.get(f"{API}/report/pack.zip").content  # deterministic bytes
    st = client.get(f"{API}/report/status").json()
    assert st["state"] == "ready"
    assert st["pack"]["figures"] >= 5
    assert st["stale"] == []


def test_tampered_file_is_flagged(client: TestClient, built: dict) -> None:
    ws = client.app.state.workspace
    p = ws.settings.artifacts_dir / "report" / ws.snapshot_id / "figures" / "F6_waterfall.png"
    orig = p.read_bytes()
    try:
        p.write_bytes(orig + b"x")
        f6 = next(f for f in client.get(f"{API}/report/figures").json()["items"] if f["key"] == "F6_waterfall")
        assert f6["file_state"] == "hash_mismatch"
        st = client.get(f"{API}/report/status").json()
        assert any(s["key"] == "F6_waterfall" for s in st["stale"])
        assert client.get(f"{API}/report/ledger").json()["consistency"]["ok"] is False
    finally:
        p.write_bytes(orig)


def test_rebuild_is_deterministic(client: TestClient, built: dict) -> None:
    before = {f["key"]: f["png_sha256"] for f in client.get(f"{API}/report/figures").json()["items"]}
    r = client.post(f"{API}/report/build", headers=LOCAL, json={})
    assert wait_job(client, r.json()["id"])["status"] == "succeeded"
    after = {f["key"]: f["png_sha256"] for f in client.get(f"{API}/report/figures").json()["items"]}
    assert before == after


def test_analyzer_library_and_detail(client: TestClient, built: dict) -> None:
    lib = client.get(f"{API}/library/analyzers").json()
    assert lib["horizons"] == [5, 21, 63, 126, 252]
    row = next(x for x in lib["items"] if x["id"] == "macro.usd_sensitivity")
    assert row["status"] == "committee"
    assert row["grades"]
    assert row["calibrator"] == "C3"
    assert row["literature_prior"] is None
    d = client.get(f"{API}/analyzers/macro.usd_sensitivity/detail").json()
    assert d["hypothesis"]
    assert d["manifest"]["code_hash"]
    assert d["manifest"]["params"] == {"weeks": 13}
    dep = next(x for x in d["dependencies"] if x["id"] == "FRED:DTWEXBGS")
    assert dep["rule"] == "alfred_realtime_start"
    assert dep["class"] == "constructed_weekly"
    assert [n["h"] for n in d["nutrition"]] == [5, 21, 63, 126, 252]
    graded = [n for n in d["nutrition"] if n["n_eff"] is not None]
    assert graded
    assert all(n["n_eff_max"] is None or n["n_eff_max"] >= n["n_eff"] - 1e-6 for n in graded)
    g = next(iter(d["grades"].values()))
    assert {"est", "ci", "n_eff", "grade", "trials", "mde", "sample"} <= set(g)
    assert g["sample"] != "holdout"
    assert d["latest"]["interval_80"]["lo"] < d["latest"]["median"] < d["latest"]["interval_80"]["hi"]
    assert 0 <= d["latest"]["p_up"] <= 1
    assert d["latest"]["base_rate"]["p"] is not None
    assert {r["id"] for r in d["references_detail"]} == {"ref:jorion-1990", "ref:apple-10k-fx-risk"}
    assert any(v["current"] for v in d["versions"])
    assert d["runs"]
    assert client.get(f"{API}/analyzers/nope.nope/detail").status_code == 404
    json.dumps(d)  # strict JSON
