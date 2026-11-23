"""Reverse DCF (ANZ-062, FR-DESC-07/08): the market-implied 10-year free-cash-flow growth.

Two-stage equity DCF on trailing free cash flow F0 = TTM operating cash flow − TTM capital
expenditure (as first reported, as of the date):

    V(g) = Σ_{t=1}^{10} F0 (1+g)^t / (1+k)^t  +  F0 (1+g)^10 (1+g_T) / ((k − g_T) (1+k)^10)

with k the cost of equity (default: the CAPM anchor's μ = r_f + β × ERP at the as-of date,
ADR-006) and g_T the terminal growth. The implied growth g* solves V(g*) = market value of
equity (Brent's method on [−20%, 60%], as in A5 ANL-062). Sensitivity grid: k ± 1 pp ×
g_T ∈ {2.0%, 2.5%, 3.0%} (brief B5; A2 QNT-266 uses a 2.5% mode for g_T).

References: Rappaport, A. & Mauboussin, M. J. (2001) *Expectations Investing*; Damodaran, A.
(2012) *Investment Valuation*, 3rd edn, ch. 2; Brent, R. P. (1973) *Algorithms for Minimization
Without Derivatives*.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy.optimize import brentq

from probcast.descriptive._core import (
    Cite,
    Facts,
    context,
    filing_url,
    iso_date,
    iso_ts,
    split_factor_at,
)
from probcast.lake.store import Store
from probcast.pit import platform as PF

YEARS = 10
TERMINAL_GROWTH = 0.025
TERMINAL_GRID = (0.02, 0.025, 0.03)
COST_OF_EQUITY_STEP = 0.01
BRACKET = (-0.20, 0.60)


def dcf_value(f0: float, g: float, k: float, g_terminal: float, years: int = YEARS) -> float:
    """Two-stage DCF value of a cash flow F0 growing at g for ``years`` and at g_T after."""
    t = np.arange(1, years + 1)
    stage1 = float(np.sum(f0 * (1 + g) ** t / (1 + k) ** t))
    terminal = f0 * (1 + g) ** years * (1 + g_terminal) / ((k - g_terminal) * (1 + k) ** years)
    return stage1 + terminal


def implied_growth(f0: float, value: float, k: float, g_terminal: float, years: int = YEARS) -> float | None:
    """g* with dcf_value(F0, g*, k, g_T) = value, or None when k ≤ g_T, F0 ≤ 0 or no root in
    the bracket."""
    if not (np.isfinite(f0) and np.isfinite(value) and np.isfinite(k)) or f0 <= 0 or value <= 0 or k <= g_terminal:
        return None
    fn = lambda g: dcf_value(f0, g, k, g_terminal, years) - value  # noqa: E731
    lo, hi = BRACKET
    if fn(lo) * fn(hi) > 0:
        return None
    return float(brentq(fn, lo, hi, xtol=1e-12, rtol=1e-12, maxiter=200))


def reverse_dcf(store: Store, ticker: str, asof: Any = None, *, cost_of_equity: float | None = None) -> dict[str, Any]:
    """Market-implied 10-year FCF growth at the as-of close, with a k × g_T sensitivity grid.

    Returns a dict: ``asof, price, shares, market_cap, fcf_ttm, ocf_ttm, capex_ttm,
    cost_of_equity`` (+ ``cost_of_equity_source, rf, beta, erp``), ``terminal_growth, years,
    implied_growth, check`` (the price re-computed from g*), ``grid`` (rows of ``cost_of_equity,
    terminal_growth, implied_growth``), ``fiscal_period_end``, citation fields (``accession,
    filed, source_url, available_at``) and ``formula``.
    """
    ctx = context(store, ticker, asof)
    f = Facts(ctx, ticker)
    ocf, c_ocf, end = f.ttm("ocf")
    capex, c_capex, _ = f.ttm("capex", end) if end is not None else (np.nan, Cite.none(), None)
    fcf = ocf - capex if np.isfinite(ocf) and np.isfinite(capex) else np.nan
    raw = ctx.prices(ticker, basis="raw")
    price = float(raw.iloc[-1]) if not raw.empty else np.nan
    price_date = raw.index[-1] if not raw.empty else None
    sh, c_sh, count = f.latest_instant_near("shares_cover")
    shares_source = "cover page (dei:EntityCommonStockSharesOutstanding)"
    if np.isfinite(sh) and count is not None and price_date is not None:
        # shares in today's units: scale by splits between the count date and the as-of
        shares = sh * split_factor_at(ctx, ticker, price_date) / split_factor_at(ctx, ticker, count)
    else:
        ni, c_ni, _ = f.ttm("net_income", end) if end is not None else (np.nan, Cite.none(), None)
        eps, c_eps, _ = f.ttm("eps_diluted", end) if end is not None else (np.nan, Cite.none(), None)
        base = ni / eps if np.isfinite(ni) and np.isfinite(eps) and eps != 0 else np.nan
        shares = base * split_factor_at(ctx, ticker, price_date) if np.isfinite(base) and price_date is not None else np.nan
        c_sh = Cite.latest(c_ni, c_eps)
        shares_source = "implied by TTM net income ÷ diluted EPS"
    mcap = price * shares if np.isfinite(price) and np.isfinite(shares) else np.nan
    rf, beta = ctx.rf, ctx.beta
    k = float(cost_of_equity) if cost_of_equity is not None else float(PF.default_mu(rf, beta, ctx.erp))
    g = implied_growth(fcf, mcap, k, TERMINAL_GROWTH)
    check = dcf_value(fcf, g, k, TERMINAL_GROWTH) / shares if g is not None and np.isfinite(shares) and shares > 0 else None
    grid = []
    for dk in (-COST_OF_EQUITY_STEP, 0.0, COST_OF_EQUITY_STEP):
        for gt in TERMINAL_GRID:
            grid.append({"cost_of_equity": k + dk, "terminal_growth": gt, "implied_growth": implied_growth(fcf, mcap, k + dk, gt)})
    c = Cite.latest(c_ocf, c_capex, c_sh)
    return {
        "ticker": ticker,
        "asof": iso_date(ctx.session),
        "price": price,
        "price_date": iso_date(price_date),
        "shares": shares,
        "shares_source": shares_source,
        "market_cap": mcap,
        "ocf_ttm": ocf,
        "capex_ttm": capex,
        "fcf_ttm": fcf,
        "fiscal_period_end": iso_date(end),
        "cost_of_equity": k,
        "cost_of_equity_source": "given" if cost_of_equity is not None else "CAPM anchor μ = r_f + β × ERP (ADR-006)",
        "rf": rf,
        "beta": beta,
        "erp": ctx.erp,
        "terminal_growth": TERMINAL_GROWTH,
        "years": YEARS,
        "implied_growth": g,
        "check": {"price": check, "matches": check is not None and abs(check - price) < 0.01},
        "grid": grid,
        "accession": c.accession,
        "filed": iso_date(c.filed),
        "source_url": filing_url(ticker, c.accession),
        "available_at": iso_ts(c.available_at),
        "formula": "V(g) = Σ_{t=1..10} F0(1+g)^t/(1+k)^t + F0(1+g)^10(1+g_T)/((k−g_T)(1+k)^10); F0 = TTM OCF − TTM capex; solve V(g*) = price × shares",
        "bracket": list(BRACKET),
    }
