"""Shared point-in-time helpers for the descriptive evidence pack.

Everything here reads data through an :class:`~probcast.pit.context.AsOfContext` built at the
requested as-of session, so only rows with ``available_at <= close(asof)`` are visible
(contract §4). Fundamentals are taken AS FIRST REPORTED: for each concept and period the
earliest accepted fact wins (NFR-SCI-03); across alias concepts (e.g. ``SalesRevenueNet`` before
2018 and ``RevenueFromContractWithCustomerExcludingAssessedTax`` after) the earliest-accepted fact
for a period wins too.

Quarterly flows are rebuilt from what filings report: 3-month facts where filed, otherwise the
difference of consecutive year-to-date facts with the same fiscal-year start (cash-flow
statements in 10-Qs are year-to-date), and Q4 = FY - 9M (or FY - (Q1 + Q2 + Q3)). Per-share
facts are put on the base-share basis with the split factor in force when the filing was
accepted (filings restate per-share data for splits effective before issuance), so derived
quarters never mix share units.
"""

from __future__ import annotations

import json
import threading
from collections import OrderedDict
from collections.abc import Iterable
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
import yaml

from probcast import calendar as cal
from probcast.config import CONFIGS_DIR, get_settings
from probcast.lake.store import Store
from probcast.pit.context import AsOfContext

EDGAR_ARCHIVE = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/"
EDGAR_SOURCE = "SEC EDGAR companyfacts × submissions acceptance time (as first reported)"

#: Alias concepts per line item, in priority order (used only to break same-time ties).
CONCEPTS: dict[str, tuple[str, ...]] = {
    "revenue": ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet",
                "RevenueFromContractWithCustomerIncludingAssessedTax"),
    "cogs": ("CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold"),
    "gross_profit": ("GrossProfit",),
    "operating_income": ("OperatingIncomeLoss",),
    "net_income": ("NetIncomeLoss",),
    "eps_diluted": ("EarningsPerShareDiluted",),
    "ocf": ("NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"),
    "capex": ("PaymentsToAcquirePropertyPlantAndEquipment",),
    "dividends": ("PaymentsOfDividends", "PaymentsOfDividendsCommonStock"),
    "buybacks": ("PaymentsForRepurchaseOfCommonStock",),
    "assets": ("Assets",),
    "assets_current": ("AssetsCurrent",),
    "liabilities_current": ("LiabilitiesCurrent",),
    "cash": ("CashAndCashEquivalentsAtCarryingValue",),
    "ms_current": ("MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesCurrent"),
    "ms_noncurrent": ("MarketableSecuritiesNoncurrent", "AvailableForSaleSecuritiesNoncurrent"),
    "receivables": ("AccountsReceivableNetCurrent",),
    "inventory": ("InventoryNet",),
    "equity": ("StockholdersEquity",),
    "debt_current": ("LongTermDebtCurrent",),
    "debt_noncurrent": ("LongTermDebtNoncurrent",),
    "commercial_paper": ("CommercialPaper",),
    "shares_cover": ("dei:EntityCommonStockSharesOutstanding",),
    "diluted_shares": ("WeightedAverageNumberOfDilutedSharesOutstanding",),
}
PER_SHARE = frozenset({"eps_diluted"})
LABELS: dict[str, str] = {
    "revenue": "Revenue", "cogs": "Cost of revenue", "gross_profit": "Gross profit", "operating_income": "Operating income",
    "net_income": "Net income", "eps_diluted": "Diluted EPS", "ocf": "Operating cash flow", "capex": "Capital expenditure",
    "dividends": "Dividends paid", "buybacks": "Share repurchases", "assets": "Total assets", "assets_current": "Current assets",
    "liabilities_current": "Current liabilities", "cash": "Cash and equivalents", "ms_current": "Marketable securities (current)",
    "ms_noncurrent": "Marketable securities (non-current)", "receivables": "Receivables", "inventory": "Inventory",
    "equity": "Shareholders' equity", "debt_current": "Term debt (current)", "debt_noncurrent": "Term debt (non-current)",
    "commercial_paper": "Commercial paper", "shares_cover": "Shares outstanding (cover page)", "diluted_shares": "Diluted shares (weighted)",
}

QUARTER_DAYS = (80, 100)
HALF_DAYS = (170, 195)
NINE_DAYS = (260, 285)
YEAR_DAYS = (350, 380)


# ---------------------------------------------------------------------------- as-of context
_CTX: OrderedDict[tuple[Any, ...], AsOfContext] = OrderedDict()
_CTX_LOCK = threading.Lock()


def asof_session(store: Store, ticker: str, asof: Any = None) -> pd.Timestamp:
    """The as-of session: the last XNYS session on or before ``asof`` (default: the ticker's
    last priced session in the store)."""
    if asof is None:
        px = store.table("prices")
        last = px.loc[px["ticker"] == ticker, "session_date"].max()
        if pd.isna(last):
            raise LookupError(f"no prices for {ticker} in snapshot {store.snapshot_id}")
        asof = last
    t = pd.Timestamp(asof)
    if t.tzinfo is not None:
        t = t.tz_convert(cal.NY).tz_localize(None)
    t = t.normalize()
    s = cal.sessions()
    s = s[s <= t]
    if s.empty:
        raise LookupError(f"no XNYS session on or before {asof}")
    return pd.Timestamp(s[-1])


def context(store: Store, ticker: str, asof: Any = None) -> AsOfContext:
    """A (memoised) AsOfContext at the as-of session. Small LRU: contexts copy the tables."""
    sess = asof_session(store, ticker, asof)
    key = (id(store), store.snapshot_hash, sess, ticker)
    with _CTX_LOCK:
        if key in _CTX:
            _CTX.move_to_end(key)
            return _CTX[key]
    ctx = AsOfContext(store, sess, ticker)
    with _CTX_LOCK:
        _CTX[key] = ctx
        while len(_CTX) > 2:
            _CTX.popitem(last=False)
    return ctx


def ticker_config(ticker: str) -> dict[str, Any]:
    p = CONFIGS_DIR / "tickers" / f"{ticker}.yaml"
    return (yaml.safe_load(p.read_text()) or {}) if p.exists() else {"ticker": ticker}


# ---------------------------------------------------------------------------- filings and citations
@lru_cache(maxsize=1)
def _sec_tickers() -> dict[str, str]:
    """Ticker -> 10-digit CIK from the locally cached SEC company_tickers.json (if ingested)."""
    d = get_settings().raw_dir / "sec" / "company_tickers"
    out: dict[str, str] = {}
    for p in sorted(d.glob("*.json")) if d.exists() else []:
        try:
            table = json.loads(p.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        for row in table.values() if isinstance(table, dict) else []:
            if isinstance(row, dict) and row.get("ticker") and row.get("cik_str") is not None:
                out[str(row["ticker"]).upper()] = f"{int(row['cik_str']):010d}"
    return out


def cik_for(ticker: str) -> str | None:
    """CIK from the ticker config, else the cached SEC ticker map, else None."""
    cfg = ticker_config(ticker)
    if cfg.get("cik"):
        return f"{int(str(cfg['cik']).removeprefix('CIK')):010d}"
    return _sec_tickers().get(ticker.upper())


def filing_url(ticker: str, accession: str | None) -> str | None:
    """EDGAR filing folder: https://www.sec.gov/Archives/edgar/data/<cik>/<accession-no-dashes>/."""
    if not accession or not isinstance(accession, str) or accession.startswith("0000000000"):
        return None
    cik = cik_for(ticker) or accession.split("-")[0]
    try:
        return EDGAR_ARCHIVE.format(cik=int(cik), acc=accession.replace("-", ""))
    except ValueError:
        return None


@dataclass(frozen=True)
class Cite:
    """The filing that completes a number (the latest-accepted input)."""

    accession: str | None
    filed: pd.Timestamp | None
    available_at: pd.Timestamp | None
    form: str | None

    @staticmethod
    def none() -> Cite:
        return Cite(None, None, None, None)

    @staticmethod
    def latest(*cites: Cite | None) -> Cite:
        cs = [c for c in cites if c is not None and c.available_at is not None]
        return max(cs, key=lambda c: c.available_at) if cs else Cite.none()


def _cite(row: Any) -> Cite:
    return Cite(str(row["accession"]) if pd.notna(row["accession"]) else None,
                pd.Timestamp(row["filed"]) if pd.notna(row.get("filed")) else None,
                pd.Timestamp(row["available_at"]), str(row.get("form")) if pd.notna(row.get("form")) else None)


# ---------------------------------------------------------------------------- facts
def _matches(concepts: pd.Series, name: str) -> pd.Series:
    if ":" in name:
        return concepts == name
    return (concepts == name) | concepts.str.endswith(f":{name}")


class Facts:
    """As-first-reported facts of one ticker inside an AsOfContext."""

    def __init__(self, ctx: AsOfContext, ticker: str) -> None:
        self.ctx = ctx
        self.ticker = ticker
        f = ctx._t.get("fundamentals")
        if f is None or f.empty:
            self.df = pd.DataFrame(columns=["concept", "unit", "value", "period_start", "period_end", "form", "accession", "filed", "available_at"])
        else:
            self.df = f[f["ticker"] == ticker]
        self._memo: dict[tuple[str, str], pd.DataFrame] = {}

    def item(self, key: str) -> pd.DataFrame:
        """Rows for a line item across its alias concepts: one per period (earliest accepted)."""
        return self._select(key, CONCEPTS.get(key, (key,)))

    def _select(self, key: str, names: Iterable[str]) -> pd.DataFrame:
        mk = (key, "raw")
        if mk in self._memo:
            return self._memo[mk]
        parts = []
        if not self.df.empty:
            for i, n in enumerate(names):
                d = self.df[_matches(self.df["concept"], n)]
                if not d.empty:
                    parts.append(d.assign(_prio=i))
        if not parts:
            out = self.df.iloc[0:0].assign(_prio=0, days=np.nan)
        else:
            d = pd.concat(parts, ignore_index=True).sort_values(["available_at", "_prio"])
            d = d.drop_duplicates(["period_start", "period_end"], keep="first")
            start = pd.to_datetime(d["period_start"])
            end = pd.to_datetime(d["period_end"])
            d = d.assign(period_start=start, period_end=end, days=(end - start).dt.days)
            if key in PER_SHARE:  # base-share units at the filing's acceptance date
                when = pd.DatetimeIndex(d["available_at"].dt.tz_convert(cal.NY).dt.tz_localize(None).dt.normalize())
                d = d.assign(value=d["value"].to_numpy(float) * self.ctx._split_factor(self.ticker, when))
            out = d.sort_values("period_end").reset_index(drop=True)
        self._memo[mk] = out
        return out

    # ---------------------------------------------------------------- durations
    def annual(self, key: str) -> pd.DataFrame:
        d = self.item(key)
        return d[d["days"].between(*YEAR_DAYS)].reset_index(drop=True)

    def quarterly(self, key: str) -> pd.DataFrame:
        """3-month values by period_end (columns: period_end, value, available_at, accession,
        filed, form, derived)."""
        mk = (key, "q")
        if mk in self._memo:
            return self._memo[mk]
        d = self.item(key)
        dur = d[d["period_start"].notna()]
        cols = ["period_start", "period_end", "value", "available_at", "accession", "filed", "form"]
        q: dict[pd.Timestamp, dict[str, Any]] = {}
        for r in dur[dur["days"].between(*QUARTER_DAYS)][cols].itertuples(index=False):
            q[r.period_end] = {**r._asdict(), "derived": False}
        # Year-to-date chains with the same fiscal-year start: consecutive differences.
        for _, g in dur.groupby("period_start"):
            g = g.sort_values("period_end")
            prev = None
            for r in g[cols].itertuples(index=False):
                if prev is not None and r.period_end not in q:
                    gap = (r.period_end - prev.period_end).days
                    if QUARTER_DAYS[0] <= gap <= QUARTER_DAYS[1]:
                        last = prev if prev.available_at >= r.available_at else r
                        q[r.period_end] = {"period_start": prev.period_end + pd.Timedelta(days=1), "period_end": r.period_end,
                                           "value": float(r.value) - float(prev.value), "available_at": last.available_at,
                                           "accession": last.accession, "filed": last.filed, "form": last.form, "derived": True}
                prev = r
        # Q4 = FY - (Q1 + Q2 + Q3) when no 9-month fact exists.
        for r in dur[dur["days"].between(*YEAR_DAYS)][cols].itertuples(index=False):
            if r.period_end in q:
                continue
            inside = [v for e, v in q.items() if r.period_start < e < r.period_end]
            if len(inside) == 3:
                comps = [*inside, {"available_at": r.available_at, "accession": r.accession, "filed": r.filed, "form": r.form}]
                last = max(comps, key=lambda c: c["available_at"])
                q[r.period_end] = {"period_start": max(v["period_end"] for v in inside) + pd.Timedelta(days=1), "period_end": r.period_end,
                                   "value": float(r.value) - sum(float(v["value"]) for v in inside), "available_at": last["available_at"],
                                   "accession": last["accession"], "filed": last["filed"], "form": last["form"], "derived": True}
        out = pd.DataFrame(sorted(q.values(), key=lambda v: v["period_end"]), columns=[*cols, "derived"])
        self._memo[mk] = out
        return out

    def ttm(self, key: str, end: pd.Timestamp | None = None) -> tuple[float, Cite, pd.Timestamp | None]:
        """Sum of the four consecutive quarters ending at ``end`` (default: the latest period
        end). When the quarters are incomplete but a fiscal-year fact ends at ``end``, TTM is that
        fiscal year."""
        q = self.quarterly(key)
        a = self.annual(key)
        if end is None:
            ends = [x["period_end"].max() for x in (q, a) if not x.empty]
            if not ends:
                return np.nan, Cite.none(), None
            end = pd.Timestamp(max(ends))
        qq = q[q["period_end"] <= end] if not q.empty else q
        if len(qq) >= 4:
            last4 = qq.iloc[-4:]
            gaps = last4["period_end"].diff().dt.days.dropna()
            if last4["period_end"].iloc[-1] == end and gaps.between(*QUARTER_DAYS).all():
                cite = Cite.latest(*(_cite(r) for _, r in last4.iterrows()))
                return float(last4["value"].sum()), cite, pd.Timestamp(end)
        fy = a[a["period_end"] == end] if not a.empty else a
        if not fy.empty:
            r = fy.iloc[0]
            return float(r["value"]), _cite(r), pd.Timestamp(end)
        return np.nan, Cite.none(), None

    def fy(self, key: str, end: pd.Timestamp) -> tuple[float, Cite]:
        d = self.annual(key)
        d = d[d["period_end"] == end]
        if d.empty:
            return np.nan, Cite.none()
        r = d.iloc[0]
        return float(r["value"]), _cite(r)

    def instant(self, key: str, end: pd.Timestamp | None = None) -> tuple[float, Cite, pd.Timestamp | None]:
        """Balance-sheet value at ``end`` (default: the latest instant)."""
        d = self.item(key)
        d = d[d["period_start"].isna()]
        if end is not None:
            d = d[d["period_end"] == end]
        if d.empty:
            return np.nan, Cite.none(), None
        r = d.iloc[-1]
        return float(r["value"]), _cite(r), pd.Timestamp(r["period_end"])

    def latest_instant_near(self, key: str, on_or_before: pd.Timestamp | None = None) -> tuple[float, Cite, pd.Timestamp | None]:
        d = self.item(key)
        d = d[d["period_start"].isna()]
        if on_or_before is not None:
            d = d[d["available_at"] <= on_or_before]
        if d.empty:
            return np.nan, Cite.none(), None
        r = d.sort_values(["available_at", "period_end"]).iloc[-1]
        return float(r["value"]), _cite(r), pd.Timestamp(r["period_end"])

    def fiscal_years(self) -> list[pd.Series]:
        """Annual periods (period_start, period_end, first acceptance) from revenue or net income."""
        parts = [self.annual(k)[["period_start", "period_end", "available_at", "accession"]] for k in ("revenue", "net_income")]
        d = pd.concat([p for p in parts if not p.empty], ignore_index=True) if any(not p.empty for p in parts) else pd.DataFrame()
        if d.empty:
            return []
        d = d.sort_values("available_at").drop_duplicates("period_end", keep="first").sort_values("period_end")
        return [r for _, r in d.iterrows()]


# ---------------------------------------------------------------------------- prices
def day0(ts: pd.Timestamp) -> pd.Timestamp:
    """First session whose close is at or after ``ts`` (FR-DATA-31)."""
    return pd.Timestamp(cal.first_session_closing_after(pd.Timestamp(ts)))


def price_on(ctx: AsOfContext, ticker: str, session: pd.Timestamp, *, basis: str = "base_share") -> tuple[float, pd.Timestamp | None]:
    """Close on the last priced session on or before ``session``."""
    s = ctx.prices(ticker, basis=basis)  # type: ignore[arg-type]
    s = s[s.index <= pd.Timestamp(session)]
    if s.empty:
        return np.nan, None
    return float(s.iloc[-1]), pd.Timestamp(s.index[-1])


def split_factor_at(ctx: AsOfContext, ticker: str, when: pd.Timestamp) -> float:
    return float(ctx._split_factor(ticker, pd.DatetimeIndex([pd.Timestamp(when).normalize()]))[0])


def iso_date(x: Any) -> str | None:
    if x is None or (isinstance(x, float) and np.isnan(x)) or pd.isna(x):
        return None
    return pd.Timestamp(x).date().isoformat()


def iso_ts(x: Any) -> str | None:
    if x is None or pd.isna(x):
        return None
    t = pd.Timestamp(x)
    t = t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
    return t.isoformat().replace("+00:00", "Z")
