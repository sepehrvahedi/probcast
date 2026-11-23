"""Display derivations of the committee's final 23-quantile forecast (UXR1-16, FR-UI-36).

Everything here is a deterministic transform of the committee quantiles at the final origin,
using the contract's distribution functions (``probcast.contract.distribution``): the price
fan, reference paths, the price density/CDF, exceedance probabilities, scenario conditional
medians, VaR/ES and leave-one-family-out P(price up). No forecasting happens here.

Price quantiles follow ``probcast.committee.final``: P_tau = P0 * exp(q_tau - dy * h / 252),
with dy the trailing dividend yield (price return = total return less dividends).
"""

from __future__ import annotations

from typing import Any

import numpy as np

from probcast import calendar as cal
from probcast.contract import distribution as D
from probcast.contract.grid import HEADLINE_HORIZON, MEDIAN_INDEX, SCENARIO_THRESHOLDS, TAUS
from probcast.stats import scores as SS

Z80_WIDTH = 2.0 * 1.2815515655446004  # q90 - q10 of a standard normal


def price_q(q: np.ndarray, h: float, p0: float, dy: float) -> np.ndarray:
    return p0 * np.exp(np.asarray(q, float) - dy * h / 252)


def _iso(ts: Any) -> str:
    return ts.date().isoformat() if hasattr(ts, "date") else str(ts)


def fan_monthly(final: dict[str, Any], origin: Any) -> list[dict[str, Any]]:
    """Month 0 (the origin close) plus the engine's 12 monthly steps (h = 21 m sessions)."""
    p0 = float(final["p0"])
    keys = [f"{t:.3f}" for t in TAUS]
    out = [{"month": 0, "date": _iso(origin), "price": [p0] * len(TAUS), "ret": [0.0] * len(TAUS)}]
    for step in final["fan_monthly"]:
        price = [float(step["p"][k]) for k in keys]
        out.append({"month": int(step["month"]), "date": _iso(cal.add_sessions(origin, int(step["horizon"]))),
                    "price": price, "ret": [p / p0 - 1 for p in price]})
    return out


def ref_path(qs_by_h: dict[int, np.ndarray], origin: Any, p0: float, dy: float) -> list[dict[str, Any]]:
    """Median price path of a reference forecast (CAPM anchor or hist_drift) by month."""
    hs = sorted(qs_by_h)
    Qs = np.vstack([qs_by_h[h] for h in hs])
    out = [{"month": 0, "date": _iso(origin), "price": p0, "ret": 0.0}]
    for m in range(1, 13):
        h = 21 * m
        q = qs_by_h[h] if h in qs_by_h else D.interpolate_horizon(hs, Qs, h).ravel()
        p = float(price_q(q[MEDIAN_INDEX], h, p0, dy))
        out.append({"month": m, "date": _iso(cal.add_sessions(origin, h)), "price": p, "ret": p / p0 - 1})
    return out


def summary(q12: np.ndarray, final: dict[str, Any]) -> dict[str, Any]:
    """Headline numbers. vol_12m = (q90 - q10) / 2.563 (normal-equivalent σ of the 12-month log
    return); jensen_gap = mean / median − 1; var5 = P_0.05 / P0 − 1; es5 = E[R | R ≤ VaR5],
    the mean of the simple-return quantile function over τ ∈ (0, 0.05) (Acerbi & Tasche 2002)."""
    p0, dy, h = float(final["p0"]), float(final["dividend_yield"]), HEADLINE_HORIZON
    pq = price_q(q12, h, p0, dy)
    taus = (np.arange(500) + 0.5) / 500 * 0.05
    es = float(np.mean(price_q(D.ppf(q12, taus)[0], h, p0, dy) / p0 - 1))
    median, mean = float(pq[MEDIAN_INDEX]), float(final["mean_price"])
    return {
        "median": median,
        "median_return": median / p0 - 1,
        "mean": mean,
        "interval80": {"lo": float(pq[3]), "hi": float(pq[19]), "level": 0.8},
        "interval95": {"lo": float(pq[1]), "hi": float(pq[21]), "level": 0.95},
        "vol_12m": float((q12[19] - q12[3]) / Z80_WIDTH),
        "jensen_gap": mean / median - 1,
        "var5": float(pq[2] / p0 - 1),
        "es5": es,
    }


def distribution(q12: np.ndarray, p0: float, dy: float, n: int = 121) -> dict[str, Any]:
    """Density and CDF of the 12-month price on a grid from the 0.5% to the 99.5% quantile.
    f_P(P) = f_y(ln(P/P0) + dy) / P (change of variables)."""
    h = HEADLINE_HORIZON
    lo, hi = D.ppf(q12, [0.005, 0.995])[0]
    ys = np.linspace(lo, hi, n)
    prices = price_q(ys, h, p0, dy)
    Q = np.tile(q12, (n, 1))
    pdf = SS.pdf(Q, ys) / prices
    cdf = D.cdf(Q, ys)
    return {"pdf": [[float(p), float(d)] for p, d in zip(prices, pdf, strict=True)],
            "cdf": [[float(p), float(c)] for p, c in zip(prices, cdf, strict=True)], "close": p0}


EXCEEDANCE_X = (-0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3)


def exceedance(q12: np.ndarray, dy: float) -> list[dict[str, float]]:
    """P(12-month price return > x) from the 23-quantile CDF (UXR1-12)."""
    return [{"x": x, "p": float(1 - D.cdf(q12, np.log1p(x) + dy)[0])} for x in EXCEEDANCE_X]


def scenarios(q12: np.ndarray, p0: float, dy: float, family_rets: dict[str, float], family_grades: dict[str, str]) -> dict[str, Any]:
    """Economic-threshold scenarios on the 12-month price return (CRT-A-015) with the price
    median conditional on each band, P_cond = P(F^-1((F(a) + F(b)) / 2)), and the families
    whose own 12-month median falls in the band."""
    lo, hi = SCENARIO_THRESHOLDS
    h = HEADLINE_HORIZON

    def F(r: float) -> float:
        return float(D.cdf(q12, np.log1p(r) + dy)[0])

    bands = [("bear", f"R < −{abs(lo):.0%}", 0.0, F(lo), lambda r: r < lo),
             ("base", f"−{abs(lo):.0%} ≤ R ≤ +{hi:.0%}", F(lo), F(hi), lambda r: lo <= r <= hi),
             ("bull", f"R > +{hi:.0%}", F(hi), 1.0, lambda r: r > hi)]
    items = []
    for sid, text, fa, fb, inside in bands:
        tau = (fa + fb) / 2
        q = float(D.ppf(q12, [tau])[0][0])
        fams = [{"family": f, "grade": family_grades.get(f, "D")} for f, r in sorted(family_rets.items()) if inside(r)]
        items.append({"id": sid, "def": text, "p": fb - fa, "cond_median_price": float(price_q(q, h, p0, dy)), "families": fams})
    return {"thresholds": {"lo": lo, "hi": hi}, "items": items}


ANCHOR_VARIANTS = ("capm_erp4", "capm_erp5", "capm_erp6", "shrink50", "hist_drift")


def anchor_sensitivity(final: dict[str, Any], q12: np.ndarray, erp_headline: float) -> list[dict[str, Any]]:
    """The engine's five anchor rows (fixed order) with 95% bounds added: each row shifts the
    committee by a constant in log space, so its price quantiles are P_tau × (median_row / median)."""
    p0, dy = float(final["p0"]), float(final["dividend_yield"])
    pq = price_q(q12, HEADLINE_HORIZON, p0, dy)
    rows = []
    for variant, r in zip(ANCHOR_VARIANTS, final["anchor_sensitivity"], strict=True):
        ratio = float(r["median_price"]) / float(pq[MEDIAN_INDEX])
        rows.append({"variant": variant, "label": r["anchor"], "median": float(r["median_price"]),
                     "interval80": {"lo": float(r["p10"]), "hi": float(r["p90"]), "level": 0.8},
                     "interval95": {"lo": float(pq[1]) * ratio, "hi": float(pq[21]) * ratio, "level": 0.95},
                     "p_up": float(r["p_price_up"]),
                     "is_headline": variant == f"capm_erp{round(erp_headline * 100)}"})
    return rows


def lofo(fq: dict[str, np.ndarray], anchor_weight: float, spread: float, q_final: np.ndarray, dy: float) -> dict[str, Any]:
    """Leave-one-family-out change in P(12-month price up), recombining the remaining families
    exactly as the committee does (equal family weights, fixed anchor weight, same spread)."""
    qa = fq["__anchor__"]
    fams = {k: v for k, v in fq.items() if k != "__anchor__"}
    thr = dy * HEADLINE_HORIZON / 252
    p_full = float(1 - D.cdf(q_final, thr)[0])
    items = []
    for name in sorted(fams):
        rest = [v for k, v in fams.items() if k != name]
        q = anchor_weight * qa + (1 - anchor_weight) * np.mean(np.vstack(rest), axis=0) if rest else qa
        q = D.scale_about_median(q, spread)[0]
        pw = float(1 - D.cdf(q, thr)[0])
        items.append({"family": name, "p_without": pw, "delta": p_full - pw})
    return {"p_up": p_full, "items": items}


def waterfall(fq: dict[str, np.ndarray], anchor_weight: float, q_final: np.ndarray, members_by_family: dict[str, int]) -> dict[str, Any]:
    """Exact median waterfall in log space (A2 §7): anchor → each family → spread → final.
    Family step = (1 − w)/F × (family median − anchor median); the spread step is whatever
    remains (zero up to rounding, since scaling about the median leaves the median unchanged)."""
    qa = fq["__anchor__"]
    fams = {k: v for k, v in fq.items() if k != "__anchor__"}
    m_a = float(qa[MEDIAN_INDEX])
    F = len(fams)
    steps, total = [], m_a
    for name in sorted(fams):
        w = (1 - anchor_weight) / F
        fm = float(fams[name][MEDIAN_INDEX])
        c = w * (fm - m_a)
        total += c
        steps.append({"kind": "family", "family": name, "label": name, "members": members_by_family.get(name, 0),
                      "weight": w, "family_median": fm, "contribution": c})
    end = float(q_final[MEDIAN_INDEX])
    steps.append({"kind": "spread", "label": "Spread recalibration", "contribution": end - total})
    return {"unit": "log_return", "start": {"label": "CAPM anchor median", "value": m_a}, "steps": steps,
            "end": {"label": "Committee median", "value": end}}
