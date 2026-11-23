"""How right was an idea? Out-of-sample accuracy by look-back window and horizon (D-090).

Every number compares walk-forward forecasts (made with data up to each month-end origin only)
with what then happened, over ALL history (the holdout seal was retired by the PO, D-089):

* ``skill``: CRPS skill vs the CAPM baseline, 1 - mean CRPS(idea) / mean CRPS(baseline)
  (Gneiting & Raftery 2007). Positive means the whole forecast distribution was closer to the
  outcome than the baseline's. This is the score the mix uses.
* ``hit``: share of forecasts whose direction call (P(up) > 50%) matched the realised sign of the
  total return; ``hit_base`` is the same for the baseline.
* ``miss``: median absolute error of the median forecast, in simple-return points.
* ``inside80``: share of outcomes inside the forecast's 80% range (calibration; 80% is ideal).

Windows are by OUTCOME date, counted back from the latest matured outcome: 1, 3, 5 and 10 years
and all history, plus ``recent``, which uses every pair with weight 0.5 ** (age / 5 years)
(recency weighting with a five-year half-life). Overlapping outcomes are handled by n_eff and
a stationary block bootstrap with mean block k = ceil(h / 21) origins (Politis & Romano 1994).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from probcast.contract import distribution as D
from probcast.contract.grid import HEADLINE_HORIZON, MEDIAN_INDEX, origin_steps
from probcast.engine.run import QCOLS, RunResult
from probcast.lake.store import Store
from probcast.scoring.oracle import realised
from probcast.stats import bootstrap as SB
from probcast.stats import evidence as SE
from probcast.stats import scores as SS
from probcast.stats import tests as ST

EVAL_VERSION = "1"
HALF_LIFE_YEARS = 5.0
WINDOWS: tuple[tuple[str, float | None], ...] = (
    ("1y", 1.0),
    ("3y", 3.0),
    ("5y", 5.0),
    ("10y", 10.0),
    ("all", None),
)
MIN_PAIRS = 12
N_BOOT = 1000
GRADE_LABEL = {"A": "Strong", "B": "Moderate", "C": "Weak", "D": "Insufficient evidence"}
_Q10, _Q90 = 3, 19  # indices of the 10% and 90% quantiles on the contract grid


def recency_weights(
    outcome_dates: pd.DatetimeIndex, ref: pd.Timestamp, half_life_years: float = HALF_LIFE_YEARS
) -> np.ndarray:
    """w = 0.5 ** (age / half-life), age in years between each outcome date and ``ref``."""
    age = (pd.Timestamp(ref) - pd.DatetimeIndex(outcome_dates)).days.to_numpy(float) / 365.25
    return np.power(0.5, np.maximum(age, 0.0) / half_life_years)


def weighted_skill(lm: np.ndarray, la: np.ndarray, w: np.ndarray) -> float:
    """Weighted CRPSS = 1 - sum(w L_model) / sum(w L_ref)."""
    den = float(np.sum(w * la))
    return float(1.0 - np.sum(w * lm) / den) if den > 0 else float("nan")


def weighted_skill_bootstrap(
    lm: np.ndarray, la: np.ndarray, w: np.ndarray, k: int, n_boot: int = N_BOOT, seed: int = 7
) -> np.ndarray:
    """Stationary-bootstrap replicates of the weighted CRPSS (pairs and weights resampled jointly)."""
    idx = SB.stationary_bootstrap_indices(lm.size, max(k, 1), n_boot, seed)
    num = (w[idx] * lm[idx]).sum(axis=1)
    den = (w[idx] * la[idx]).sum(axis=1)
    return 1.0 - num / den


def n_eff_weighted(w: np.ndarray, k: int) -> float:
    """Kish effective sample size (sum w)^2 / sum w^2, divided by the overlap factor k."""
    return float(w.sum() ** 2 / np.sum(w**2) / max(k, 1)) if w.size else 0.0


def pairs(store: Store, ticker: str, run: RunResult, anchor: RunResult, h: int) -> pd.DataFrame:
    """Matured (origin, outcome) pairs where both the idea and the baseline forecast."""
    m = run.forecasts[(run.forecasts["horizon"] == h) & run.forecasts["abstain"].isna()]
    a = anchor.forecasts[(anchor.forecasts["horizon"] == h) & anchor.forecasts["abstain"].isna()]
    if m.empty or a.empty:
        return pd.DataFrame()
    out = realised(store, ticker, pd.DatetimeIndex(m["origin"]), h)
    return m.merge(a[["origin", *QCOLS]], on="origin", suffixes=("", "_a")).merge(
        out[["origin", "outcome_date", "y"]], on="origin"
    )


def _metrics(
    Qm: np.ndarray, Qa: np.ndarray, y: np.ndarray, w: np.ndarray, k: int
) -> dict[str, Any]:
    lm, la = SS.crps(Qm, y), SS.crps(Qa, y)
    up = y > 0
    call_m, call_a = D.p_up(Qm) > 0.5, D.p_up(Qa) > 0.5
    miss = np.abs(np.exp(Qm[:, MEDIAN_INDEX]) - np.exp(y))
    miss_a = np.abs(np.exp(Qa[:, MEDIAN_INDEX]) - np.exp(y))
    inside = (y >= Qm[:, _Q10]) & (y <= Qm[:, _Q90])
    ws = w / w.sum()
    return {
        "n": int(y.size),
        "n_eff": n_eff_weighted(w, k),
        "skill": weighted_skill(lm, la, w),
        "hit": float(np.sum(ws * (call_m == up))),
        "hit_base": float(np.sum(ws * (call_a == up))),
        "up_share": float(np.sum(ws * up)),
        "miss": float(np.median(miss)) if np.allclose(w, w[0]) else _wmedian(miss, w),
        "miss_base": float(np.median(miss_a)) if np.allclose(w, w[0]) else _wmedian(miss_a, w),
        "inside80": float(np.sum(ws * inside)),
    }


def _wmedian(x: np.ndarray, w: np.ndarray) -> float:
    o = np.argsort(x)
    c = np.cumsum(w[o])
    return float(x[o][np.searchsorted(c, 0.5 * c[-1])])


def evaluate(
    store: Store,
    ticker: str,
    run: RunResult,
    anchor: RunResult,
    *,
    n_boot: int = N_BOOT,
    half_life_years: float = HALF_LIFE_YEARS,
) -> dict[str, Any]:
    horizons = sorted(int(h) for h in run.forecasts["horizon"].unique())
    grid: dict[str, dict[str, Any]] = {}
    headline: dict[str, Any] = {}
    track: dict[str, list[dict[str, Any]]] = {}
    current: dict[str, Any] = {}
    last_outcome = None
    for h in horizons:
        k = origin_steps(h)
        live = run.forecasts[
            (run.forecasts["horizon"] == h) & run.forecasts["abstain"].isna()
        ].sort_values("origin")
        if not live.empty:
            q = live.iloc[-1][QCOLS].to_numpy(float)
            current[str(h)] = {
                "origin": pd.Timestamp(live.iloc[-1]["origin"]).date().isoformat(),
                "p_up": float(D.p_up(q)[0]),
                "median": float(np.expm1(q[MEDIAN_INDEX])),
                "lo80": float(np.expm1(q[_Q10])),
                "hi80": float(np.expm1(q[_Q90])),
            }
        j = pairs(store, ticker, run, anchor, h)
        if j.empty or len(j) < MIN_PAIRS:
            grid[str(h)] = {}
            continue
        j = j.sort_values("origin").reset_index(drop=True)
        Qm, Qa = j[QCOLS].to_numpy(float), j[[c + "_a" for c in QCOLS]].to_numpy(float)
        y = j["y"].to_numpy(float)
        od = pd.DatetimeIndex(j["outcome_date"])
        ref = od.max()
        last_outcome = ref if last_outcome is None else max(last_outcome, ref)
        row: dict[str, Any] = {}
        for name, yrs in WINDOWS:
            sel = (
                np.ones(len(j), bool)
                if yrs is None
                else (od > ref - pd.DateOffset(days=round(365.25 * yrs)))
            )
            if sel.sum() < MIN_PAIRS:
                row[name] = {"n": int(sel.sum())}
                continue
            row[name] = _metrics(Qm[sel], Qa[sel], y[sel], np.ones(int(sel.sum())), k)
        w = recency_weights(od, ref, half_life_years)
        row["recent"] = _metrics(Qm, Qa, y, w, k)
        lm, la = SS.crps(Qm, y), SS.crps(Qa, y)
        reps = weighted_skill_bootstrap(lm, la, w, k, n_boot)
        ci = (float(np.nanpercentile(reps, 5)), float(np.nanpercentile(reps, 95)))
        support = float(np.mean(reps > 0))
        dm = ST.dm_test_hln(lm, la, k)
        all_ci = SB.skill_ci(lm, la, k, n_boot=n_boot)
        grade, reasons = SE.evidence_grade(
            n_eff=SE.n_eff(len(j), k),
            crpss=SS.skill_score(lm, la),
            crpss_ci=all_ci,
            dm_p_two_sided=dm["p_two_sided"],
            dm_stat=dm["stat"],
            bh_q=None,
            coverage80=row["all"].get("inside80", float("nan")),
        )
        row["recent"].update({"ci": ci, "support": support})
        grid[str(h)] = row
        headline[str(h)] = {
            "score": row["recent"]["skill"],
            "ci": ci,
            "support": support,
            "grade": grade,
            "grade_label": GRADE_LABEL[grade],
            "grade_reasons": reasons,
            "n": len(j),
            "n_eff": row["recent"]["n_eff"],
            "dm_p": float(dm["p_two_sided"]),
            "skill_all": row["all"]["skill"],
            "skill_all_ci": (float(all_ci[0]), float(all_ci[1])),
        }
        track[str(h)] = [
            {
                "t": pd.Timestamp(t).date().isoformat(),
                "out": pd.Timestamp(o).date().isoformat(),
                "lo": float(np.expm1(qm[_Q10])),
                "med": float(np.expm1(qm[MEDIAN_INDEX])),
                "hi": float(np.expm1(qm[_Q90])),
                "base": float(np.expm1(qa[MEDIAN_INDEX])),
                "y": float(np.expm1(yy)),
                "p_up": float(D.p_up(qm)[0]),
            }
            for t, o, qm, qa, yy in zip(j["origin"], od, Qm, Qa, y, strict=True)
        ]
    focus = (
        HEADLINE_HORIZON
        if str(HEADLINE_HORIZON) in headline
        else (max((int(h) for h in headline), default=None))
    )
    return {
        "version": EVAL_VERSION,
        "horizons": horizons,
        "focus": focus,
        "half_life_years": half_life_years,
        "windows": [w for w, _ in WINDOWS] + ["recent"],
        "last_outcome": last_outcome.date().isoformat() if last_outcome is not None else None,
        "grid": grid,
        "headline": headline,
        "track": track,
        "current": current,
    }


def _pooled_frames(store: Store, runs: dict[str, tuple[RunResult, RunResult]]) -> pd.DataFrame:
    """Every matured (stock, horizon, origin) pair of an idea and its baseline, with both losses."""
    frames = []
    for tk, (run, anchor) in runs.items():
        for h in sorted(int(x) for x in run.forecasts["horizon"].unique()):
            j = pairs(store, tk, run, anchor, h)
            if j.empty:
                continue
            Qm, Qa = j[QCOLS].to_numpy(float), j[[c + "_a" for c in QCOLS]].to_numpy(float)
            y = j["y"].to_numpy(float)
            frames.append(
                pd.DataFrame(
                    {
                        "ticker": tk,
                        "h": h,
                        "origin": pd.DatetimeIndex(j["origin"]),
                        "out": pd.DatetimeIndex(j["outcome_date"]),
                        "lm": SS.crps(Qm, y),
                        "la": SS.crps(Qa, y),
                        "up": y > 0,
                        "call": D.p_up(Qm) > 0.5,
                        "call_a": D.p_up(Qa) > 0.5,
                        "miss": np.abs(np.exp(Qm[:, MEDIAN_INDEX]) - np.exp(y)),
                        "miss_a": np.abs(np.exp(Qa[:, MEDIAN_INDEX]) - np.exp(y)),
                        "inside": (y >= Qm[:, _Q10]) & (y <= Qm[:, _Q90]),
                    }
                )
            )
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def pooled_losses(store: Store, runs: dict[str, tuple[RunResult, RunResult]]) -> dict[str, Any]:
    """Per horizon and outcome date, the idea's and the baseline's CRPS summed over all stocks
    (D-103). The mix reads it point-in-time (outcome date <= origin) to shrink each stock's idea
    score towards the idea's score on the other stocks."""
    allp = _pooled_frames(store, runs)
    if allp.empty:
        return {}
    out: dict[str, Any] = {}
    for h, d in allp.groupby("h"):
        g = d.groupby("out")[["lm", "la"]].sum().sort_index()
        out[str(int(h))] = {
            "out": [t.date().isoformat() for t in g.index],
            "lm": g["lm"].tolist(),
            "la": g["la"].tolist(),
        }
    return out


def evaluate_pooled(
    store: Store,
    runs: dict[str, tuple[RunResult, RunResult]],
    *,
    n_boot: int = N_BOOT,
    half_life_years: float = HALF_LIFE_YEARS,
) -> dict[str, Any]:
    """One idea across many stocks (D-097). ``runs`` maps ticker -> (idea run, CAPM baseline run).

    Pairs from all stocks are pooled. Skill = 1 - sum(w * CRPS idea) / sum(w * CRPS baseline) over
    every (stock, month) pair, with recency weights by outcome date. Uncertainty comes from a
    stationary block bootstrap over TIME (all stocks of a month move together in a resample), so
    stocks that move together are not counted as independent evidence; n_eff is time-based and
    therefore conservative. Also reports on how many stocks the idea beat the baseline.
    """
    allp = _pooled_frames(store, runs)
    if allp.empty:
        return {
            "version": EVAL_VERSION,
            "horizons": [],
            "focus": None,
            "n_stocks": 0,
            "grid": {},
            "headline": {},
            "per_stock": {},
        }
    grid: dict[str, Any] = {}
    headline: dict[str, Any] = {}
    per_stock: dict[str, Any] = {}
    horizons = sorted(int(h) for h in allp["h"].unique())
    for h in horizons:
        d = allp[allp["h"] == h]
        k = origin_steps(h)
        ref = d["out"].max()

        def metrics(sub: pd.DataFrame, w: np.ndarray, k: int = k) -> dict[str, Any]:
            ws = w / w.sum()
            by_t = (
                pd.DataFrame({"out": sub["out"].to_numpy(), "w": w})
                .groupby("out")["w"]
                .sum()
                .to_numpy()
            )
            return {
                "n": len(sub),
                "n_stocks": int(sub["ticker"].nunique()),
                "n_eff": n_eff_weighted(by_t, k),
                "skill": weighted_skill(sub["lm"].to_numpy(), sub["la"].to_numpy(), w),
                "hit": float(np.sum(ws * (sub["call"] == sub["up"]))),
                "hit_base": float(np.sum(ws * (sub["call_a"] == sub["up"]))),
                "up_share": float(np.sum(ws * sub["up"])),
                "miss": _wmedian(sub["miss"].to_numpy(), w),
                "miss_base": _wmedian(sub["miss_a"].to_numpy(), w),
                "inside80": float(np.sum(ws * sub["inside"])),
            }

        row: dict[str, Any] = {}
        for name, yrs in WINDOWS:
            sel = d if yrs is None else d[d["out"] > ref - pd.DateOffset(days=round(365.25 * yrs))]
            row[name] = (
                metrics(sel, np.ones(len(sel)))
                if sel["out"].nunique() >= MIN_PAIRS
                else {"n": len(sel)}
            )
        w = recency_weights(pd.DatetimeIndex(d["out"]), ref, half_life_years)
        row["recent"] = metrics(d, w)
        # Bootstrap over time: per-month sums of weighted losses across stocks.
        g = (
            pd.DataFrame(
                {
                    "out": d["out"].to_numpy(),
                    "wl": w * d["lm"].to_numpy(),
                    "wa": w * d["la"].to_numpy(),
                }
            )
            .groupby("out")
            .sum()
            .sort_index()
        )
        idx = SB.stationary_bootstrap_indices(len(g), max(k, 1), n_boot, 7)
        reps = 1.0 - g["wl"].to_numpy()[idx].sum(axis=1) / g["wa"].to_numpy()[idx].sum(axis=1)
        ci = (float(np.nanpercentile(reps, 5)), float(np.nanpercentile(reps, 95)))
        support = float(np.mean(reps > 0))
        row["recent"].update({"ci": ci, "support": support})
        stocks = {}
        for tk, sd in d.groupby("ticker"):
            ww = recency_weights(pd.DatetimeIndex(sd["out"]), ref, half_life_years)
            stocks[str(tk)] = weighted_skill(sd["lm"].to_numpy(), sd["la"].to_numpy(), ww)
        per_stock[str(h)] = stocks
        grid[str(h)] = row
        headline[str(h)] = {
            "score": row["recent"]["skill"],
            "ci": ci,
            "support": support,
            "n": len(d),
            "n_eff": row["recent"]["n_eff"],
            "n_stocks": int(d["ticker"].nunique()),
            "stocks_better": int(sum(1 for v in stocks.values() if v > 0)),
        }
    focus = (
        HEADLINE_HORIZON
        if str(HEADLINE_HORIZON) in headline
        else max((int(x) for x in headline), default=None)
    )
    return {
        "version": EVAL_VERSION,
        "horizons": horizons,
        "focus": focus,
        "n_stocks": int(allp["ticker"].nunique()),
        "half_life_years": half_life_years,
        "windows": [w for w, _ in WINDOWS] + ["recent"],
        "grid": grid,
        "headline": headline,
        "per_stock": per_stock,
    }


LUCK_FDR = 0.10


def luck_check(
    tests: dict[str, dict[str, dict[str, float]]], n_boot: int, fdr: float = LUCK_FDR
) -> dict[str, dict[str, dict[str, Any]]]:
    """Which all-stocks results survive testing many ideas at once (D-103).

    ``tests`` maps idea -> horizon -> {"score", "support"} from :func:`evaluate_pooled`. Each test's
    one-sided p-value for "no better than the baseline" is the bootstrap share of replicates with
    skill <= 0, p = (1 + B (1 - support)) / (1 + B) (Davison & Hinkley 1997, eq. 4.11). The family
    is every idea x horizon, and Benjamini-Hochberg q-values control the false-discovery rate
    (Benjamini & Hochberg 1995). ``proven`` = q <= ``fdr`` and a positive score.
    """
    keys = [(i, h) for i, hs in tests.items() for h in hs]
    p = np.array(
        [(1.0 + n_boot * (1.0 - float(tests[i][h]["support"]))) / (1.0 + n_boot) for i, h in keys]
    )
    q = ST.bh_qvalues(p) if keys else np.array([])
    out: dict[str, dict[str, dict[str, Any]]] = {}
    for (i, h), pp, qq in zip(keys, p, q, strict=True):
        out.setdefault(i, {})[h] = {
            "p": float(pp),
            "q": float(qq),
            "proven": bool(qq <= fdr and float(tests[i][h]["score"]) > 0),
        }
    return out
