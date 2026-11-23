"""The final 12-month forecast object (A2 §8; contract §2; ADR-006/015).

Everything is derived from the committee's quantiles at the final origin:
* a monthly price fan (50/80/95%) via the contract's horizon interpolation;
* median and mean price (Jensen gap stated), P(price > P0) with two base rates;
* P(return > x) queries and economic-threshold scenarios (< -15%, -15..+15%, > +15%);
* the five-row anchor-sensitivity table;
* a 31 Dec 2027-style extrapolated line when requested;
* a canonical SHA-256 hash for the freeze record.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.contract import distribution as D
from probcast.contract.grid import (
    ERP_SENSITIVITY,
    HEADLINE_HORIZON,
    MEDIAN_INDEX,
    SCENARIO_THRESHOLDS,
    TAUS,
)
from probcast.lake.store import Store
from probcast.pit.context import AsOfContext


def _dividend_yield(ctx: AsOfContext) -> float:
    """Trailing 12-month dividends / price (base-share units), PIT."""
    divs = ctx._actions(ctx.ticker, "dividend")
    p = ctx.prices()
    if divs.empty or p.empty:
        return 0.0
    last = p.index.max()
    recent = divs[divs["ex_date"] > last - pd.Timedelta(days=365)]
    if recent.empty:
        return 0.0
    base = recent["value"].to_numpy(float) * ctx._split_factor(ctx.ticker, pd.DatetimeIndex(recent["ex_date"]))
    return float(base.sum() / p.iloc[-1])


def base_rates(ctx: AsOfContext, h: int = HEADLINE_HORIZON) -> dict[str, float | None]:
    """Share of past h-session windows with a positive PRICE return: own (survivor-biased) and market."""
    out: dict[str, float | None] = {}
    p = ctx.prices()
    out["own"] = float((np.log(p).diff(h).dropna() > 0).mean()) if p.size > h else None
    mkt = ctx._cfg.get("benchmarks", {}).get("market_price") or ctx._cfg.get("benchmarks", {}).get("market")
    out["market"] = None
    if mkt:
        pm = ctx.prices(mkt)
        if pm.size > h:
            out["market"] = float((np.log(pm).diff(h).dropna() > 0).mean())
    return out


def final_object(
    store: Store,
    ticker: str,
    origin: pd.Timestamp,
    committee_q: dict[int, np.ndarray],
    *,
    attribution: dict[str, Any] | None = None,
    extra_dates: tuple[str, ...] = (),
    erp: float = 0.05,
) -> dict[str, Any]:
    ctx = AsOfContext(store, origin, ticker, erp=erp)
    p0 = float(ctx.prices(basis="raw").iloc[-1])
    dy = _dividend_yield(ctx)
    hs = sorted(committee_q)
    Qs = np.vstack([committee_q[h] for h in hs])
    q12 = committee_q[HEADLINE_HORIZON]

    def price_q(q: np.ndarray, h: int) -> np.ndarray:
        return p0 * np.exp(q - dy * h / 252)

    fan = []
    for m in range(1, 13):
        h = 21 * m
        q = D.interpolate_horizon(hs, Qs, h) if h not in committee_q else committee_q[h]
        pq = price_q(q, h)
        fan.append({"month": m, "horizon": h, "p": {f"{t:.3f}": float(v) for t, v in zip(TAUS, pq, strict=True)}})

    target_date = cal.add_sessions(origin, HEADLINE_HORIZON)
    pq12 = price_q(q12, HEADLINE_HORIZON)
    mean_price = float(p0 * D.mean_exp(q12)[0] * np.exp(-dy))
    price_up_threshold = dy  # price up iff log TR > dividend component
    scen = {}
    lo, hi = SCENARIO_THRESHOLDS
    f = lambda r: float(D.cdf(q12, np.log1p(r) + dy)[0])  # noqa: E731 - P(price return <= r)
    scen = {"bear (< -15%)": f(lo), "base (-15% to +15%)": f(hi) - f(lo), "bull (> +15%)": 1 - f(hi)}

    # Anchor-sensitivity table (five rows): shift the whole committee by the change in the
    # anchor median (exact under drift neutrality: every member is anchor + tilt).
    a_base = ctx.anchor_median(HEADLINE_HORIZON)
    rows = []
    mu_hist_q = ctx.vol(HEADLINE_HORIZON) * ctx.shape(HEADLINE_HORIZON) + ctx.mean_log_return() * HEADLINE_HORIZON
    mu_hist = float(D.mean_exp(mu_hist_q)[0] - 1)
    alts = [(f"CAPM, ERP {e:.0%}", ctx.anchor_median(HEADLINE_HORIZON) if e == erp else float(ctx.anchor(HEADLINE_HORIZON, mu=ctx.rf + ctx.beta * e)[MEDIAN_INDEX])) for e in ERP_SENSITIVITY]
    shrink_mu = 0.5 * ctx.mu + 0.5 * mu_hist
    alts.append(("50% shrink to own history", float(ctx.anchor(HEADLINE_HORIZON, mu=shrink_mu)[MEDIAN_INDEX])))
    alts.append(("Own historical drift (survivor-biased)", float(mu_hist_q[MEDIAN_INDEX])))
    for label, a_alt in alts:
        q = q12 + (a_alt - a_base)
        pq = price_q(q, HEADLINE_HORIZON)
        rows.append({"anchor": label, "median_price": float(pq[MEDIAN_INDEX]), "p10": float(pq[3]), "p90": float(pq[19]),
                     "p_price_up": float(1 - D.cdf(q, price_up_threshold)[0])})

    extras = []
    for d in extra_dates:
        h = cal.n_sessions_between(origin, d)
        q = D.interpolate_horizon(hs, Qs, h)
        pq = price_q(q, h)
        extras.append({"date": d, "sessions": h, "label": "extrapolated" if h > max(hs) else "interpolated",
                       "median_price": float(pq[MEDIAN_INDEX]), "p10": float(pq[3]), "p90": float(pq[19])})

    obj = {
        "ticker": ticker,
        "origin": origin.date().isoformat(),
        "target_date": target_date.date().isoformat(),
        "horizon_sessions": HEADLINE_HORIZON,
        "p0": p0,
        "dividend_yield": dy,
        "quantiles_log_tr": {f"{t:.3f}": float(v) for t, v in zip(TAUS, q12, strict=True)},
        "price_quantiles": {f"{t:.3f}": float(v) for t, v in zip(TAUS, pq12, strict=True)},
        "median_price": float(pq12[MEDIAN_INDEX]),
        "mean_price": mean_price,
        "interval_80": [float(pq12[3]), float(pq12[19])],
        "interval_95": [float(pq12[1]), float(pq12[21])],
        "p_price_up": float(1 - D.cdf(q12, price_up_threshold)[0]),
        "base_rates": base_rates(ctx),
        "scenarios": scen,
        "anchor": {"mu": ctx.mu, "rf": ctx.rf, "beta": ctx.beta, "erp": erp},
        "anchor_sensitivity": rows,
        "fan_monthly": fan,
        "extra_dates": extras,
        "attribution": attribution,
        "disclaimer": "Educational research tool. Not investment advice.",
    }
    obj["sha256"] = forecast_hash(obj)
    return obj


def forecast_hash(obj: dict[str, Any]) -> str:
    body = {k: v for k, v in obj.items() if k != "sha256"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()


def p_return_greater(q: np.ndarray, x: float, dividend_yield: float = 0.0, h: int = HEADLINE_HORIZON) -> float:
    """P(price return over the horizon > x), e.g. x = 0.10 for +10%."""
    return float(1 - D.cdf(q, np.log1p(x) + dividend_yield * h / 252)[0])
