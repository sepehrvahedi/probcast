"""EDGAR: acceptanceDateTime is true UTC (ADR-017), facts x accession rows, UA and rate limit.

No test here touches the network; HTTP goes through ``httpx.MockTransport``.
"""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import httpx
import pandas as pd
import pytest

from probcast.ingest import edgar as E
from probcast.ingest.common import RateLimiter, load_ticker_config
from probcast.ingest.run import ingest_all
from probcast.lake.store import conform

FIX = Path(__file__).parent / "fixtures"
SUBS = json.loads((FIX / "edgar_submissions_CIK0000320193.json").read_text())
PAGE = json.loads((FIX / "edgar_submissions_CIK0000320193-submissions-001.json").read_text())
FACTS = json.loads((FIX / "edgar_companyfacts_CIK0000320193.json").read_text())
TEST_UA = "ProbCast test-suite test@example.invalid"


def test_acceptance_is_true_utc_for_the_two_adr017_accessions():
    acc = E.acceptance_map(SUBS).set_index("accession")["acceptance_utc"]
    et = E.to_eastern(acc)
    # ADR-017 fixtures: EDGAR index pages show these Eastern times
    assert et[list(acc.index).index("0000320193-26-000024")] == pd.Timestamp(
        "2026-11-02 16:30:23", tz="America/New_York")
    assert et[list(acc.index).index("0000320193-25-000079")] == pd.Timestamp(
        "2025-10-31 06:01:26", tz="America/New_York")
    # the 'Z' is not Eastern time mislabelled (the superseded A3 DAT-252 rule)
    assert acc["0000320193-25-000079"] == pd.Timestamp("2025-10-31T10:01:26Z")
    assert str(acc.dt.tz) == "UTC"


def test_acceptance_map_includes_older_submission_pages():
    acc = E.acceptance_map(SUBS, [PAGE])
    assert "0001193125-10-012096" in set(acc["accession"])
    assert E.older_page_names(SUBS) == ["CIK0000320193-submissions-001.json"]


def test_facts_keep_every_fact_accession_pair_with_acceptance_time():
    acc = E.acceptance_map(SUBS, [PAGE])
    rows, info = E.facts_to_rows(FACTS, acc, "AAPL")
    assert "us-gaap:NotARequestedConcept" not in set(rows["concept"])
    rev = rows[rows["concept"] == "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax"]
    # same period reported in two filings -> two rows (as first reported + later comparative)
    assert sorted(rev["accession"]) == ["0000320193-25-000079", "0000320193-26-000026"]
    first = rev.loc[rev["accession"] == "0000320193-25-000079", "available_at"].iloc[0]
    assert first == pd.Timestamp("2025-10-31T10:01:26Z")
    later = rev.loc[rev["accession"] == "0000320193-26-000026", "available_at"].iloc[0]
    assert later.tz_convert("America/New_York") == pd.Timestamp("2026-11-03 08:05:15", tz="America/New_York")
    # instant facts have no period_start
    shares = rows[rows["concept"] == "dei:EntityCommonStockSharesOutstanding"].iloc[0]
    assert pd.isna(shares["period_start"])
    # accession missing from submissions -> filed date 17:30 ET, flagged
    fb = rows[rows["accession"] == "0001193125-10-999999"].iloc[0]
    assert fb["available_at"] == pd.Timestamp("2010-01-25 17:30", tz="America/New_York")
    assert "filed_date_fallback" in fb["source"]
    assert info["acceptance_fallbacks"] == 1
    assert rows.loc[rows["concept"] == "us-gaap:EarningsPerShareDiluted", "unit"].iloc[0] == "USD/shares"
    conform("fundamentals", rows)


def test_fu01_concept_list_is_complete():
    assert len(E.FU01_CONCEPTS) >= 25
    assert len(E.all_tags()) == len(set(E.all_tags()))


def test_frames_api_is_never_used():
    src = Path(E.__file__).read_text()
    assert "api/xbrl/frames" not in src


def test_missing_user_agent_is_a_clear_error(settings):
    assert settings.sec_user_agent is None
    with pytest.raises(E.EdgarConfigError, match="SEC_USER_AGENT is not set"):
        E.require_user_agent(settings)
    with pytest.raises(E.EdgarConfigError):
        E.EdgarClient(settings)
    with pytest.raises(E.EdgarConfigError):
        ingest_all(settings, include_edgar=True, write=False)
    with pytest.raises(E.EdgarConfigError, match="contact"):
        E.require_user_agent(replace(settings, sec_user_agent="NoEmailHere"))


def test_rate_limiter_spaces_requests():
    t = [0.0]
    slept: list[float] = []

    def sleep(s):
        slept.append(s)
        t[0] += s
    rl = RateLimiter(8, clock=lambda: t[0], sleep=sleep)
    for _ in range(9):
        rl.wait()
    assert len(slept) == 8
    assert all(s == pytest.approx(0.125) for s in slept)
    assert t[0] == pytest.approx(1.0)  # 9 requests take >= 1 s at 8 req/s


def test_ingest_edgar_offline_sends_ua_and_follows_older_pages(settings):
    s = replace(settings, sec_user_agent=TEST_UA)
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        path = req.url.path
        if path.endswith("CIK0000320193.json") and "submissions" in path:
            return httpx.Response(200, json=SUBS)
        if path.endswith("CIK0000320193-submissions-001.json"):
            return httpx.Response(200, json=PAGE)
        if "companyfacts" in path:
            return httpx.Response(200, json=FACTS)
        return httpx.Response(404)

    t = [0.0]
    client = E.EdgarClient(s, transport=httpx.MockTransport(handler),
                           limiter=RateLimiter(8, clock=lambda: t[0], sleep=lambda x: t.__setitem__(0, t[0] + x)))
    cfg = load_ticker_config("AAPL")
    res = E.ingest_edgar(s, cfg, include_peers=False, client=client)
    assert res["errors"] == {}
    assert res["requests"] == 3
    assert all(r.headers["User-Agent"] == TEST_UA for r in seen)
    assert res["tickers"]["AAPL"]["cik"] == "0000320193"
    assert len(res["fundamentals"]) == 5
    assert (s.raw_dir / "sec").exists()
