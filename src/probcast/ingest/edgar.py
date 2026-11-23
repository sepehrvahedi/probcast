"""SEC EDGAR XBRL facts, as first reported, -> ``fundamentals`` (data plan FU-01; ADR-017).

* ``companyfacts`` gives every (fact x accession) the company ever filed. We keep **all** of
  them (as-first-reported and later restatements are separate rows); the PIT layer selects by
  ``available_at``. ``frames`` (restated "last filed" values) are never used.
* ``available_at`` = the filing's ``acceptanceDateTime`` from ``submissions`` (including older
  ``filings.files`` pages). That string is **true UTC** (ADR-017, CRT-A-004): it is parsed as
  UTC and only converted to America/New_York for display. An analyzer at origin ``t`` sees the
  fact iff ``acceptance <= close(t)``, i.e. from the first session close at/after acceptance.
* Fallback when an accession is missing from ``submissions``: ``filed`` date at 17:30 ET (a
  filing accepted after 17:30 ET gets the next day's filing date), flagged in ``source``.

SEC fair access: a declared User-Agent from ``SEC_USER_AGENT`` (never invented here) and at
most 8 requests/second (SEC limit: 10).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import httpx
import pandas as pd

from probcast.config import Settings
from probcast.ingest.common import (
    RateLimiter,
    cache_latest,
    cache_put,
    et_timestamps,
    flatten_symbols,
    utc_now,
)

SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
SUBMISSIONS_PAGE_URL = "https://data.sec.gov/submissions/{name}"
COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
MAX_REQUESTS_PER_SECOND = 8.0

FUND_COLUMNS = ["ticker", "concept", "unit", "value", "period_start", "period_end", "fy", "fp",
                "form", "accession", "filed", "available_at", "source"]

#: FU-01 concepts: canonical name -> XBRL tags in preference order (tag drift across years).
#: Every listed tag is ingested; the canonical map is for the PIT/feature layer.
FU01_CONCEPTS: dict[str, tuple[str, ...]] = {
    "Revenues": ("us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
                 "us-gaap:SalesRevenueNet", "us-gaap:Revenues"),
    "CostOfRevenue": ("us-gaap:CostOfGoodsAndServicesSold", "us-gaap:CostOfRevenue",
                      "us-gaap:CostOfGoodsSold"),
    "GrossProfit": ("us-gaap:GrossProfit",),
    "OperatingIncomeLoss": ("us-gaap:OperatingIncomeLoss",),
    "NetIncomeLoss": ("us-gaap:NetIncomeLoss",),
    "EarningsPerShareBasic": ("us-gaap:EarningsPerShareBasic",),
    "EarningsPerShareDiluted": ("us-gaap:EarningsPerShareDiluted",),
    "WeightedAverageSharesBasic": ("us-gaap:WeightedAverageNumberOfSharesOutstandingBasic",),
    "WeightedAverageSharesDiluted": ("us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding",),
    "CommonStockSharesOutstanding": ("us-gaap:CommonStockSharesOutstanding",
                                     "dei:EntityCommonStockSharesOutstanding"),
    "CashAndCashEquivalents": ("us-gaap:CashAndCashEquivalentsAtCarryingValue",),
    "MarketableSecuritiesCurrent": ("us-gaap:MarketableSecuritiesCurrent",
                                    "us-gaap:AvailableForSaleSecuritiesCurrent"),
    "MarketableSecuritiesNoncurrent": ("us-gaap:MarketableSecuritiesNoncurrent",
                                       "us-gaap:AvailableForSaleSecuritiesNoncurrent"),
    "AccountsReceivable": ("us-gaap:AccountsReceivableNetCurrent",),
    "Inventory": ("us-gaap:InventoryNet",),
    "AssetsCurrent": ("us-gaap:AssetsCurrent",),
    "Assets": ("us-gaap:Assets",),
    "LiabilitiesCurrent": ("us-gaap:LiabilitiesCurrent",),
    "Liabilities": ("us-gaap:Liabilities",),
    "LongTermDebtCurrent": ("us-gaap:LongTermDebtCurrent",),
    "LongTermDebtNoncurrent": ("us-gaap:LongTermDebtNoncurrent",),
    "CommercialPaper": ("us-gaap:CommercialPaper",),
    "StockholdersEquity": ("us-gaap:StockholdersEquity",),
    "NetCashProvidedByOperatingActivities": (
        "us-gaap:NetCashProvidedByUsedInOperatingActivities",
        "us-gaap:NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"),
    "PaymentsToAcquirePropertyPlantAndEquipment": (
        "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",),
    "PaymentsForRepurchaseOfCommonStock": ("us-gaap:PaymentsForRepurchaseOfCommonStock",),
    "PaymentsOfDividends": ("us-gaap:PaymentsOfDividends", "us-gaap:PaymentsOfDividendsCommonStock"),
    "ResearchAndDevelopmentExpense": ("us-gaap:ResearchAndDevelopmentExpense",),
    "SellingGeneralAndAdministrativeExpense": ("us-gaap:SellingGeneralAndAdministrativeExpense",),
    "IncomeTaxExpenseBenefit": ("us-gaap:IncomeTaxExpenseBenefit",),
}

ACCESSION_RE = re.compile(r"\b(\d{10}-\d{2}-\d{6})\b")


class EdgarConfigError(RuntimeError):
    pass


def all_tags(concepts: dict[str, tuple[str, ...]] = FU01_CONCEPTS) -> list[str]:
    out: list[str] = []
    for tags in concepts.values():
        out += [t for t in tags if t not in out]
    return out


def require_user_agent(settings: Settings) -> str:
    """The declared SEC User-Agent from ``.env``. Never invented or defaulted here."""
    ua = (settings.sec_user_agent or "").strip()
    if not ua:
        raise EdgarConfigError(
            "SEC_USER_AGENT is not set. SEC fair-access policy requires a declared User-Agent "
            "with a contact address; set SEC_USER_AGENT in .env (a project mailbox, never a "
            "personal address) and re-run. No SEC request was made."
        )
    if "@" not in ua:
        raise EdgarConfigError("SEC_USER_AGENT must include a contact e-mail address (SEC policy)")
    return ua


def cik10(cik: str | int) -> str:
    return f"{int(str(cik).removeprefix('CIK')):010d}"


# --------------------------------------------------------------------------------------------
# Timestamps
# --------------------------------------------------------------------------------------------


def parse_acceptance(values) -> pd.DatetimeIndex:
    """Parse EDGAR ``acceptanceDateTime`` strings as **true UTC** (ADR-017).

    ``"2026-11-02T21:30:23.000Z"`` -> 2026-11-02 21:30:23 UTC = 16:30:23 America/New_York.
    """
    s = pd.Series(list(values) if not isinstance(values, pd.Series) else values, dtype=object)
    return pd.DatetimeIndex(pd.to_datetime(s, utc=True, format="ISO8601"))


def to_eastern(ts) -> pd.DatetimeIndex:
    return pd.DatetimeIndex(ts).tz_convert("America/New_York")


def _filings_block(js: dict) -> dict:
    return js.get("filings", {}).get("recent", js) if "filings" in js else js


def acceptance_map(submissions: dict, older_pages: list[dict] | None = None) -> pd.DataFrame:
    """``accession -> acceptance (UTC)`` plus form, filing date, report date and 8-K items."""
    frames = []
    for blk in [_filings_block(submissions), *(older_pages or [])]:
        if not blk or "accessionNumber" not in blk:
            continue
        n = len(blk["accessionNumber"])
        frames.append(pd.DataFrame({
            "accession": blk["accessionNumber"],
            "acceptance_utc": parse_acceptance(blk.get("acceptanceDateTime", [None] * n)),
            "form": blk.get("form", [None] * n),
            "filing_date": blk.get("filingDate", [None] * n),
            "report_date": blk.get("reportDate", [None] * n),
            "items": blk.get("items", [None] * n),
        }))
    if not frames:
        return pd.DataFrame(columns=["accession", "acceptance_utc", "form", "filing_date",
                                     "report_date", "items"])
    df = pd.concat(frames, ignore_index=True).drop_duplicates("accession", keep="first")
    return df.reset_index(drop=True)


def older_page_names(submissions: dict) -> list[str]:
    return [f["name"] for f in submissions.get("filings", {}).get("files", [])]


# --------------------------------------------------------------------------------------------
# Facts -> rows
# --------------------------------------------------------------------------------------------


def facts_to_rows(companyfacts: dict, acc: pd.DataFrame, ticker: str,
                  tags: list[str] | None = None) -> tuple[pd.DataFrame, dict]:
    """Every (fact x accession) for the requested tags, with acceptance-time ``available_at``."""
    tags = tags or all_tags()
    facts = companyfacts.get("facts", {})
    recs = []
    found: dict[str, int] = {}
    for tag in tags:
        tax, name = tag.split(":", 1)
        node = facts.get(tax, {}).get(name)
        if not node:
            continue
        for unit, items in node.get("units", {}).items():
            for it in items:
                recs.append({
                    "concept": tag, "unit": unit, "value": it.get("val"),
                    "period_start": it.get("start"), "period_end": it.get("end"),
                    "fy": it.get("fy"), "fp": it.get("fp"), "form": it.get("form"),
                    "accession": it.get("accn"), "filed": it.get("filed"),
                })
                found[tag] = found.get(tag, 0) + 1
    info = {"tags_requested": len(tags), "tags_found": len(found), "facts": len(recs),
            "missing_tags": [t for t in tags if t not in found]}
    if not recs:
        return pd.DataFrame(columns=FUND_COLUMNS), info
    df = pd.DataFrame(recs)
    amap = acc.set_index("accession")["acceptance_utc"]
    df["available_at"] = df["accession"].map(amap)
    fb = df["available_at"].isna()
    if fb.any():
        df.loc[fb, "available_at"] = et_timestamps(df.loc[fb, "filed"], "17:30")
    df["available_at"] = pd.to_datetime(df["available_at"], utc=True)
    df["source"] = "sec_companyfacts|acceptance"
    df.loc[fb, "source"] = "sec_companyfacts|filed_date_fallback_17:30ET"
    df["ticker"] = ticker
    df["value"] = df["value"].astype(float)
    df["fy"] = pd.array(df["fy"], dtype="Int32")
    for c in ("period_start", "period_end", "filed"):
        df[c] = pd.to_datetime(df[c]).dt.date
    df = df.drop_duplicates(["ticker", "concept", "unit", "period_start", "period_end", "accession"])
    info |= {"acceptance_fallbacks": int(fb.sum()), "rows": len(df)}
    return df[FUND_COLUMNS].reset_index(drop=True), info


# --------------------------------------------------------------------------------------------
# HTTP client
# --------------------------------------------------------------------------------------------


class EdgarClient:
    """Rate-limited JSON client with a raw cache. Constructing it requires ``SEC_USER_AGENT``."""

    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None,
                 limiter: RateLimiter | None = None):
        ua = require_user_agent(settings)
        self.settings = settings
        self.limiter = limiter or RateLimiter(MAX_REQUESTS_PER_SECOND)
        self.http = httpx.Client(timeout=60, transport=transport, follow_redirects=True,
                                 headers={"User-Agent": ua, "Accept-Encoding": "gzip, deflate"})
        self.requests = 0

    def get_json(self, url: str, cache_key: str, *, use_cache: bool = False) -> dict:
        if use_cache and (p := cache_latest(self.settings, "sec", cache_key)) is not None:
            return json.loads(p.read_text())
        self.limiter.wait()
        r = self.http.get(url)
        self.requests += 1
        r.raise_for_status()
        cache_put(self.settings, "sec", cache_key, r.content, ".json", meta={"url": url})
        return r.json()

    def close(self) -> None:
        self.http.close()


def resolve_cik(client: EdgarClient, ticker: str, configured: str | None = None, *,
                use_cache: bool = False) -> str:
    if configured:
        return cik10(configured)
    table = client.get_json(COMPANY_TICKERS_URL, "company_tickers", use_cache=use_cache)
    for row in table.values():
        if str(row.get("ticker", "")).upper() == ticker.upper():
            return cik10(row["cik_str"])
    raise EdgarConfigError(f"{ticker}: CIK not found in SEC company_tickers.json")


def fetch_company(client: EdgarClient, cik: str, *, use_cache: bool = False) -> tuple[dict, list[dict], dict]:
    """``(submissions, older submission pages, companyfacts)`` for one CIK."""
    subs = client.get_json(SUBMISSIONS_URL.format(cik=cik), f"submissions_{cik}", use_cache=use_cache)
    pages = [client.get_json(SUBMISSIONS_PAGE_URL.format(name=n), n.removesuffix(".json"),
                             use_cache=use_cache) for n in older_page_names(subs)]
    facts = client.get_json(COMPANYFACTS_URL.format(cik=cik), f"companyfacts_{cik}", use_cache=use_cache)
    return subs, pages, facts


def ingest_edgar(settings: Settings, ticker_cfg: dict, *, include_peers: bool = True,
                 client: EdgarClient | None = None, use_cache: bool = False) -> dict:
    """Fundamentals for the ticker (and, by default, its peer sets and suppliers).

    Raises ``EdgarConfigError`` before any request if ``SEC_USER_AGENT`` is missing.
    """
    require_user_agent(settings)
    own = client is None
    client = client or EdgarClient(settings)
    names = [ticker_cfg["ticker"]]
    if include_peers:
        names += [t for t in [*flatten_symbols(ticker_cfg.get("peers")),
                              *flatten_symbols(ticker_cfg.get("suppliers"))] if t not in names]
    rows, infos, errors, accs = [], {}, {}, {}
    try:
        for t in names:
            try:
                cik = resolve_cik(client, t, ticker_cfg.get("cik") if t == ticker_cfg["ticker"] else None,
                                  use_cache=use_cache)
                subs, pages, facts = fetch_company(client, cik, use_cache=use_cache)
                acc = acceptance_map(subs, pages)
                df, info = facts_to_rows(facts, acc, t)
                infos[t] = {"cik": cik, "filings": len(acc), **info}
                rows.append(df)
                # D-101: companies that re-domiciled or created a new holding company keep their
                # history under predecessor CIKs (e.g. Google Inc. before Alphabet). Their filings are
                # merged under the same ticker; as-first-reported dedup keeps the earliest filing.
                if t == ticker_cfg["ticker"]:
                    for pc in ticker_cfg.get("predecessor_ciks", []) or []:
                        pcik = cik10(pc)
                        psubs, ppages, pfacts = fetch_company(client, pcik, use_cache=use_cache)
                        pacc = acceptance_map(psubs, ppages)
                        pdf, _ = facts_to_rows(pfacts, pacc, t)
                        rows.append(pdf)
                        acc = pd.concat([pacc, acc], ignore_index=True).drop_duplicates("accession", keep="last")
                        infos[t]["predecessors"] = [*infos[t].get("predecessors", []), {"cik": pcik, "filings": len(pacc)}]
                accs[t] = acc
            except EdgarConfigError:
                raise
            except Exception as e:
                errors[t] = f"{type(e).__name__}: {e}"
    finally:
        if own:
            client.close()
    return {
        "fundamentals": pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=FUND_COLUMNS),
        "acceptance": accs,
        "tickers": infos,
        "errors": errors,
        "requests": client.requests,
        "fetched_at": utc_now().isoformat(),
    }


def load_json(path: Path) -> dict:
    return json.loads(Path(path).read_text())


def earnings_events(acceptance: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """Quarterly-results releases as events, from 8-K filings carrying item 2.02 ("Results of
    Operations and Financial Condition", in force since August 2003). ``content_available_at`` is the
    SEC acceptance time (true UTC), so the event is known exactly when the filing became public.
    Rule-complete by construction: every such 8-K is included, none is hand-picked."""
    cols = ["event_id", "ticker", "event_type", "subtype", "title", "description", "occurred_at", "announced_at",
            "content_available_at", "selection_method", "time_precision", "verification", "importance",
            "source_url", "source_name", "tags"]
    if acceptance is None or acceptance.empty:
        return pd.DataFrame(columns=cols)
    a = acceptance[(acceptance["form"] == "8-K") & acceptance["items"].fillna("").str.contains(r"\b2\.02\b")]
    a = a.dropna(subset=["acceptance_utc"])
    rows = [{
        "event_id": f"{ticker}-8K-{acc}", "ticker": ticker, "event_type": "earnings", "subtype": "quarterly_results",
        "title": f"{ticker} results release (8-K item 2.02)", "description": "Quarterly results furnished on Form 8-K.",
        "occurred_at": ts, "announced_at": ts, "content_available_at": ts, "selection_method": "rule_complete",
        "time_precision": "exact", "verification": "unverified", "importance": None,
        "source_url": f"https://www.sec.gov/Archives/edgar/data/{acc.replace('-', '')}", "source_name": "SEC EDGAR",
        "tags": "earnings;8-K;2.02",
    } for acc, ts in zip(a["accession"], a["acceptance_utc"], strict=True)]
    df = pd.DataFrame(rows, columns=cols)
    df["importance"] = df["importance"].astype("Int32")
    return df
