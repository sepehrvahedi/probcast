"""Ratio table (report T1/T3; FR-DESC-01/02/09): liquidity, leverage, profitability, efficiency,
payout and valuation ratios for the last fiscal years plus TTM, as first reported and as of a
date, every cell citing the EDGAR filing that completes it.

Conventions (the ratio registry, ``REGISTRY``):

* Balance-sheet items are ending balances at the period end (no averaging).
* Fiscal-year columns use the 10-K values; the TTM column sums the latest four quarters known at
  the as-of date and uses the balance sheet at the latest quarter end.
* Debt = term debt (current + non-current) + commercial paper; a component the filing does not
  report counts as zero (Apple reported no term debt before FY2013).
* Valuation cells use the base-share close on the session the 10-K became public (FY columns)
  or the as-of close (TTM). Market capitalisation = price × cover-page shares outstanding, both
  in base-share units; when the cover page lacks a total, the diluted share count implied by
  net income / diluted EPS is used instead.
* EV/EBIT is approximate: market capitalisation + debt − cash − marketable securities, over
  operating income (no leases, minorities or pensions).

References: Penman, S. H. (2013) *Financial Statement Analysis and Security Valuation*, 5th edn;
Koller, Goedhart & Wessels (2020) *Valuation*, 7th edn (enterprise value and EV/EBIT).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.descriptive._core import (
    Cite,
    Facts,
    context,
    day0,
    filing_url,
    iso_date,
    iso_ts,
    price_on,
    split_factor_at,
)
from probcast.lake.store import Store

COLUMNS = ["metric", "group", "fiscal_year", "value", "unit", "formula", "accession", "filed", "source_url",
           "label", "period_end", "available_at", "form", "price_session"]
GROUPS = ("liquidity", "leverage", "profitability", "efficiency", "payout", "valuation")

FLOWS = ("revenue", "cogs", "gross_profit", "operating_income", "net_income", "eps_diluted", "ocf", "capex", "dividends", "buybacks")
INSTANTS = ("assets", "assets_current", "liabilities_current", "cash", "ms_current", "ms_noncurrent", "receivables", "inventory",
            "equity", "debt_current", "debt_noncurrent", "commercial_paper")


@dataclass(frozen=True)
class RatioDef:
    metric: str
    label: str
    group: str
    unit: str  # ratio | fraction | usd | multiple
    formula: str
    fn: Callable[[dict[str, float]], float]
    inputs: tuple[str, ...]


def _div(a: float, b: float) -> float:
    if not np.isfinite(a) or not np.isfinite(b) or b == 0:
        return np.nan
    return a / b


def _z(v: float) -> float:
    return v if np.isfinite(v) else 0.0


def _gross(x: dict[str, float]) -> float:
    if np.isfinite(x["gross_profit"]):
        return x["gross_profit"]
    return x["revenue"] - x["cogs"]


def _cogs(x: dict[str, float]) -> float:
    if np.isfinite(x["cogs"]):
        return x["cogs"]
    return x["revenue"] - x["gross_profit"]


def _debt(x: dict[str, float]) -> float:
    parts = [x["debt_current"], x["debt_noncurrent"], x["commercial_paper"]]
    if not any(np.isfinite(p) for p in parts) and not np.isfinite(x["assets"]):
        return np.nan
    return sum(_z(p) for p in parts)


def _liquid(x: dict[str, float]) -> float:
    if not np.isfinite(x["cash"]):
        return np.nan
    return x["cash"] + _z(x["ms_current"]) + _z(x["ms_noncurrent"])


def _payout(x: dict[str, float]) -> float:
    if not (np.isfinite(x["dividends"]) or np.isfinite(x["buybacks"])):
        return np.nan
    return _div(_z(x["dividends"]) + _z(x["buybacks"]), x["net_income"])


REGISTRY: tuple[RatioDef, ...] = (
    RatioDef("current_ratio", "Current ratio", "liquidity", "ratio", "AssetsCurrent / LiabilitiesCurrent",
             lambda x: _div(x["assets_current"], x["liabilities_current"]), ("assets_current", "liabilities_current")),
    RatioDef("quick_ratio", "Quick ratio", "liquidity", "ratio",
             "(CashAndCashEquivalents + MarketableSecuritiesCurrent + AccountsReceivableNetCurrent) / LiabilitiesCurrent",
             lambda x: _div(x["cash"] + _z(x["ms_current"]) + x["receivables"], x["liabilities_current"]),
             ("cash", "ms_current", "receivables", "liabilities_current")),
    RatioDef("debt_to_equity", "Debt / equity", "leverage", "ratio",
             "(LongTermDebtCurrent + LongTermDebtNoncurrent + CommercialPaper) / StockholdersEquity",
             lambda x: _div(_debt(x), x["equity"]), ("debt_current", "debt_noncurrent", "commercial_paper", "equity")),
    RatioDef("net_cash", "Net cash", "leverage", "usd",
             "Cash + MarketableSecurities (current + non-current) − (term debt + commercial paper)",
             lambda x: _liquid(x) - _debt(x), ("cash", "ms_current", "ms_noncurrent", "debt_current", "debt_noncurrent", "commercial_paper")),
    RatioDef("gross_margin", "Gross margin", "profitability", "fraction", "GrossProfit / Revenue (GrossProfit = Revenue − CostOfRevenue if not reported)",
             lambda x: _div(_gross(x), x["revenue"]), ("gross_profit", "revenue", "cogs")),
    RatioDef("operating_margin", "Operating margin", "profitability", "fraction", "OperatingIncomeLoss / Revenue",
             lambda x: _div(x["operating_income"], x["revenue"]), ("operating_income", "revenue")),
    RatioDef("net_margin", "Net margin", "profitability", "fraction", "NetIncomeLoss / Revenue",
             lambda x: _div(x["net_income"], x["revenue"]), ("net_income", "revenue")),
    RatioDef("roe", "Return on equity", "profitability", "fraction", "NetIncomeLoss / StockholdersEquity (ending)",
             lambda x: _div(x["net_income"], x["equity"]), ("net_income", "equity")),
    RatioDef("roa", "Return on assets", "profitability", "fraction", "NetIncomeLoss / Assets (ending)",
             lambda x: _div(x["net_income"], x["assets"]), ("net_income", "assets")),
    RatioDef("asset_turnover", "Asset turnover", "efficiency", "ratio", "Revenue / Assets (ending)",
             lambda x: _div(x["revenue"], x["assets"]), ("revenue", "assets")),
    RatioDef("inventory_turnover", "Inventory turnover", "efficiency", "ratio", "CostOfRevenue / InventoryNet (ending)",
             lambda x: _div(_cogs(x), x["inventory"]), ("cogs", "gross_profit", "revenue", "inventory")),
    RatioDef("payout", "Payout (dividends + buybacks)", "payout", "fraction",
             "(PaymentsOfDividends + PaymentsForRepurchaseOfCommonStock) / NetIncomeLoss",
             _payout, ("dividends", "buybacks", "net_income")),
    RatioDef("pe", "P/E", "valuation", "multiple", "Close (base-share) ÷ diluted EPS (base-share; FY or TTM)",
             lambda x: _div(x["price"], x["eps_diluted"]), ("eps_diluted",)),
    RatioDef("ev_ebit", "EV / EBIT (approx.)", "valuation", "multiple",
             "(Market cap + debt − cash − marketable securities) / OperatingIncomeLoss",
             lambda x: _div(x["mcap"] + _debt(x) - _liquid(x), x["operating_income"]),
             ("operating_income", "cash", "ms_current", "ms_noncurrent", "debt_current", "debt_noncurrent", "commercial_paper", "shares")),
    RatioDef("fcf_yield", "FCF yield", "valuation", "fraction",
             "(NetCashProvidedByOperatingActivities − PaymentsToAcquirePropertyPlantAndEquipment) / market cap",
             lambda x: _div(x["ocf"] - x["capex"], x["mcap"]), ("ocf", "capex", "shares")),
)
METRICS = {r.metric: r for r in REGISTRY}


def registry() -> list[dict[str, str]]:
    """The ratio registry (FR-DESC-02): one entry per metric with its formula."""
    return [{"metric": r.metric, "label": r.label, "group": r.group, "unit": r.unit, "formula": r.formula} for r in REGISTRY]


def _market_cap(ctx: Any, facts: Facts, ticker: str, session: pd.Timestamp, price_base: float,
                ni: float, eps_base: float) -> tuple[float, Cite]:
    close = cal.session_close(session)
    sh, c, count_date = facts.latest_instant_near("shares_cover", on_or_before=close)
    if np.isfinite(sh) and count_date is not None:
        return price_base * sh / split_factor_at(ctx, ticker, count_date), c
    implied = _div(ni, eps_base)
    return (price_base * implied if np.isfinite(implied) else np.nan), Cite.none()


def _column(ctx: Any, facts: Facts, ticker: str, label: str, end: pd.Timestamp, session: pd.Timestamp, ttm: bool) -> list[dict[str, Any]]:
    vals: dict[str, float] = {}
    cites: dict[str, Cite] = {}
    for k in FLOWS:
        if ttm:
            v, c, _ = facts.ttm(k, end)
        else:
            v, c = facts.fy(k, end)
        vals[k], cites[k] = v, c
    for k in INSTANTS:
        v, c, _ = facts.instant(k, end)
        vals[k], cites[k] = v, c
    price, px_day = price_on(ctx, ticker, session)
    vals["price"] = price
    mcap, mc_cite = _market_cap(ctx, facts, ticker, session, price, vals["net_income"], vals["eps_diluted"])
    vals["mcap"] = mcap
    cites["shares"] = mc_cite
    rows = []
    for r in REGISTRY:
        try:
            v = float(r.fn(vals))
        except (KeyError, TypeError, ZeroDivisionError):
            v = np.nan
        if not np.isfinite(v):
            v = np.nan
        used = [cites[k] for k in r.inputs if k in cites and np.isfinite(vals.get(k, np.nan))]
        c = Cite.latest(*used) if np.isfinite(v) else Cite.none()
        rows.append({
            "metric": r.metric, "group": r.group, "fiscal_year": label, "value": v, "unit": r.unit, "formula": r.formula,
            "accession": c.accession, "filed": iso_date(c.filed), "source_url": filing_url(ticker, c.accession),
            "label": r.label, "period_end": iso_date(end), "available_at": iso_ts(c.available_at), "form": c.form,
            "price_session": iso_date(px_day) if r.group == "valuation" and np.isfinite(v) else None,
        })
    return rows


def ratio_table(store: Store, ticker: str, asof: Any = None, *, years: int = 5) -> pd.DataFrame:
    """Ratios for the last ``years`` fiscal years plus TTM, as first reported and as of ``asof``.

    Returns a long DataFrame with columns ``metric, group, fiscal_year, value, unit, formula,
    accession, filed, source_url`` (+ ``label, period_end, available_at, form, price_session``).
    ``fiscal_year`` is ``"FY2025"``-style for fiscal years (year of the period end) and ``"TTM"``.
    Fractions (margins, ROE, yields) are decimals; ``net_cash`` is in USD. ``value`` is NaN when
    an input is not reported. Every non-missing cell carries the accession of the latest filing
    among its inputs and the EDGAR filing-folder URL.
    """
    ctx = context(store, ticker, asof)
    facts = Facts(ctx, ticker)
    rows: list[dict[str, Any]] = []
    fys = facts.fiscal_years()[-years:] if years > 0 else []
    for fy in fys:
        end = pd.Timestamp(fy["period_end"])
        rows += _column(ctx, facts, ticker, f"FY{end.year}", end, day0(pd.Timestamp(fy["available_at"])), ttm=False)
    q = facts.quarterly("revenue")
    if q.empty:
        q = facts.quarterly("net_income")
    if not q.empty:
        end = pd.Timestamp(q["period_end"].iloc[-1])
        rows += _column(ctx, facts, ticker, "TTM", end, ctx.session, ttm=True)
    return pd.DataFrame(rows, columns=COLUMNS)
