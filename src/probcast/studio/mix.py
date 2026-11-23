"""The mix: one forecast from all scored ideas, weighted by how right each has been (D-091).

At every origin t and horizon h, using ONLY pairs whose outcome was known by t (so the mix's own
backtest is out of sample):

1. Each idea's own score s_i(t) is its recency-weighted CRPS skill vs the CAPM baseline over its
   matured pairs on this stock (weights 0.5 ** (age / 5 years), age measured from t). Ideas with
   fewer than ``MIN_PAIRS`` matured pairs get weight 0.
   Partial pooling (D-103): when the idea's losses on the OTHER stocks are supplied, s_i(t) is
   shrunk towards its score there, p_i(t) (same recency weights, outcomes known by t only):
   s~_i = (n_i * s_i + kappa * p_i) / (n_i + kappa), with n_i the own effective sample size and
   kappa = 20 (empirical-Bayes / James-Stein style shrinkage; Efron & Morris 1975). One stock's
   lucky run then counts for less unless the idea also works elsewhere. A score <= 0 gets weight 0.
2. Among the P ideas with s_i > 0, weights are score-proportional, shrunk towards equal weights:
   w_i = lam * s_i / sum(s) + (1 - lam) / P, with lam = n / (n + kappa), n the mean effective
   sample size of those ideas and kappa = 20 (the platform's shrinkage constant, contract §8).
   Shrinkage guards against the forecast-combination puzzle (Smith & Wallis 2009; Stock &
   Watson 2004): estimated weights are noisy, and equal weights are hard to beat.
3. The ideas are averaged quantile by quantile (Vincentization; Ratcliff 1979) and blended with
   the baseline, whose weight stays at 25% (ADR-006), so a forecast exists even if no idea helps.
4. The spread is recalibrated point-in-time about the median (the committee's method).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from probcast.committee.core import CommitteeResult, recalibrate_spread
from probcast.contract.grid import ANCHOR_WEIGHT, KAPPA_C1, MEDIAN_INDEX, origin_steps
from probcast.engine.run import QCOLS, RunResult
from probcast.lake.store import Store
from probcast.scoring.oracle import realised
from probcast.stats import scores as SS
from probcast.studio.evaluate import (
    HALF_LIFE_YEARS,
    n_eff_weighted,
    recency_weights,
    weighted_skill,
)

MIX_VERSION = "4"
MIN_PAIRS = 24


@dataclass
class MixResult:
    forecasts: pd.DataFrame  # origin, horizon, q00..q22, spread, n_ideas
    weights: dict[int, dict[str, Any]]  # at the latest origin, per horizon
    history: pd.DataFrame  # origin, horizon, idea, weight, score (every origin)


def _rows(run: RunResult, h: int) -> pd.DataFrame:
    f = run.forecasts
    return f[(f["horizon"] == h) & f["abstain"].isna()].set_index("origin").sort_index()


def idea_weights(
    scores: dict[str, float], n_effs: dict[str, float], kappa: float = KAPPA_C1
) -> tuple[dict[str, float], float]:
    """Shrunk score weights for ideas with a positive score (others get 0). Returns (weights, lam)."""
    pos = {i: s for i, s in scores.items() if np.isfinite(s) and s > 0}
    if not pos:
        return {i: 0.0 for i in scores}, 0.0
    n = float(np.mean([n_effs[i] for i in pos]))
    lam = n / (n + kappa)
    tot = sum(pos.values())
    w = {i: (lam * s / tot + (1 - lam) / len(pos)) if i in pos else 0.0 for i, s in scores.items()}
    return w, lam


def _others(tab: dict[str, Any] | None, own: pd.DataFrame | None) -> pd.DataFrame | None:
    """The pooled loss sums by outcome date minus this stock's own pairs: the other stocks."""
    if not tab:
        return None
    p = pd.DataFrame({"lm": tab["lm"], "la": tab["la"]}, index=pd.DatetimeIndex(tab["out"]))
    if own is not None and not own.empty:
        mine = own.groupby("out")[["li", "la"]].sum().rename(columns={"li": "lm"})
        mine.index = pd.DatetimeIndex(mine.index)
        p = p.sub(mine.reindex(p.index).fillna(0.0), fill_value=0.0).clip(lower=0.0)
    p = p[p["la"] > 0]
    return p if not p.empty else None


def _score_by(p: pd.DataFrame | None, t: pd.Timestamp, half_life_years: float) -> float:
    """Recency-weighted skill on outcomes known by ``t`` (NaN when there are none)."""
    if p is None:
        return float("nan")
    past = p[p.index <= t]
    if len(past) < MIN_PAIRS:
        return float("nan")
    w = recency_weights(pd.DatetimeIndex(past.index), t, half_life_years)
    return weighted_skill(past["lm"].to_numpy(), past["la"].to_numpy(), w)


def build_mix(
    store: Store,
    ticker: str,
    anchor: RunResult,
    ideas: dict[str, RunResult],
    *,
    anchor_weight: float = ANCHOR_WEIGHT,
    half_life_years: float = HALF_LIFE_YEARS,
    spread: bool = True,
    pooled: dict[str, dict[str, Any]] | None = None,
    kappa: float = KAPPA_C1,
) -> MixResult:
    """``pooled`` maps idea -> :func:`probcast.studio.evaluate.pooled_losses` over all stocks
    (this stock included; its own losses are subtracted here)."""
    out, hist = [], []
    latest: dict[int, dict[str, Any]] = {}
    for h in sorted(int(x) for x in anchor.forecasts["horizon"].unique()):
        a = _rows(anchor, h)
        k = origin_steps(h)
        outc = realised(store, ticker, pd.DatetimeIndex(a.index), h).set_index("origin")
        rows = {i: _rows(r, h) for i, r in ideas.items()}
        # Per-idea loss tables on the common support with the baseline: origin -> (outcome date, L_i, L_a).
        loss: dict[str, pd.DataFrame] = {}
        for i, r in rows.items():
            common = r.index.intersection(outc.index).intersection(a.index)
            if len(common) == 0:
                continue
            y = outc.loc[common, "y"].to_numpy(float)
            loss[i] = pd.DataFrame(
                {
                    "out": outc.loc[common, "outcome_date"].to_numpy(),
                    "li": SS.crps(r.loc[common, QCOLS].to_numpy(float), y),
                    "la": SS.crps(a.loc[common, QCOLS].to_numpy(float), y),
                },
                index=common,
            )
        others = {i: _others(pooled.get(i, {}).get(str(h)), L) for i, L in loss.items()} if pooled else {}
        for t in a.index:
            qa = a.loc[t, QCOLS].to_numpy(float)
            scores, neffs, avail, own, elsewhere = {}, {}, {}, {}, {}
            for i, r in rows.items():
                if t not in r.index:
                    continue
                avail[i] = r.loc[t, QCOLS].to_numpy(float)
                L = loss.get(i)
                past = L[L["out"] <= t] if L is not None else None
                if past is None or len(past) < MIN_PAIRS:
                    scores[i], neffs[i] = float("nan"), 0.0
                    continue
                w = recency_weights(pd.DatetimeIndex(past["out"]), t, half_life_years)
                den = float(np.sum(w * past["la"].to_numpy()))
                scores[i] = (
                    1.0 - float(np.sum(w * past["li"].to_numpy())) / den
                    if den > 0
                    else float("nan")
                )
                neffs[i] = n_eff_weighted(w, k)
                own[i], elsewhere[i] = scores[i], _score_by(others.get(i), t, half_life_years)
                if np.isfinite(elsewhere[i]) and np.isfinite(scores[i]):
                    scores[i] = (neffs[i] * scores[i] + kappa * elsewhere[i]) / (neffs[i] + kappa)
            wts, lam = idea_weights(scores, neffs)
            used = {i: wt for i, wt in wts.items() if wt > 0}
            if used:
                q_ideas = sum(wt * avail[i] for i, wt in used.items())
                q = anchor_weight * qa + (1 - anchor_weight) * q_ideas
            else:
                q = qa.copy()
            out.append(
                {
                    "origin": t,
                    "horizon": h,
                    **dict(zip(QCOLS, q, strict=True)),
                    "n_ideas": len(used),
                }
            )
            for i in avail:
                hist.append(
                    {
                        "origin": t,
                        "horizon": h,
                        "idea": i,
                        "weight": (1 - anchor_weight) * wts.get(i, 0.0) if used else 0.0,
                        "score": scores.get(i, float("nan")),
                    }
                )
            if t == a.index[-1]:
                latest[h] = {
                    "origin": t,
                    "lam": lam,
                    "anchor_weight": anchor_weight if used else 1.0,
                    "ideas": {
                        i: {
                            "weight": (1 - anchor_weight) * wts.get(i, 0.0) if used else 0.0,
                            "score": scores.get(i),
                            "own_score": own.get(i),
                            "all_stocks_score": elsewhere.get(i),
                            "n_eff": neffs.get(i, 0.0),
                            "median": float(avail[i][MEDIAN_INDEX]),
                        }
                        for i in avail
                    },
                    "anchor_median": float(qa[MEDIAN_INDEX]),
                    "raw_median": float(q[MEDIAN_INDEX]),
                }
    f = pd.DataFrame(out)
    if spread and not f.empty:
        f = recalibrate_spread(
            store,
            ticker,
            CommitteeResult(forecasts=f, composition=pd.DataFrame()),
            pre_holdout_only=False,
        ).forecasts
    elif "spread" not in f:
        f["spread"] = 1.0
    return MixResult(forecasts=f, weights=latest, history=pd.DataFrame(hist))


def as_run(mix: MixResult, template: RunResult, run_id: str) -> RunResult:
    f = mix.forecasts.copy()
    f["signal"], f["abstain"], f["calibration"] = None, None, None
    man = dict(template.manifest)
    man.update({"analyzer_id": "mix", "run_id": run_id, "family": "mix"})
    return RunResult(
        run_id=run_id,
        spec=template.spec,
        params={},
        forecasts=f[["origin", "horizon", *QCOLS, "signal", "abstain", "calibration"]],
        manifest=man,
    )


def waterfall(w: dict[str, Any], final_median: float) -> list[dict[str, Any]]:
    """Exact median steps in log space: baseline -> each idea's pull -> mix median. Spread
    recalibration scales about the median, so it never moves the median."""
    m_a = float(w["anchor_median"])
    steps = [{"label": "Baseline (CAPM)", "id": "__anchor__", "value": m_a}]
    total = m_a
    for i, d in sorted(w["ideas"].items(), key=lambda kv: -kv[1]["weight"]):
        if d["weight"] <= 0:
            continue
        c = d["weight"] * (d["median"] - m_a)
        total += c
        steps.append({"label": i, "id": i, "value": c})
    steps.append({"label": "Mix", "id": "__mix__", "value": final_median, "total": True})
    assert abs(total - final_median) < 1e-9, "the median waterfall must add up exactly"
    return steps
