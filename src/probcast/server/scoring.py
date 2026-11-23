"""Per-segment score statistics for the API (ADR-013; FR-ENG-10; UXR1-16).

The engine's :func:`probcast.scoring.score.score_run` pools every pre-holdout pair. The UI
needs scores **per outcome-date segment** (dev / val, and holdout only after the reveal) so
that no aggregate silently mixes segments (FR-ENG-10). This module composes the same pure
functions (``probcast.stats``) and the same outcome oracle (``probcast.scoring.oracle``,
holdout sealed unless revealed) on identical origin sets for model, CAPM anchor and the
``hist_drift`` yardstick (FR-SCORE-03). No new statistics are defined here.

Raw statistics are cached; grades and BH q-values are attached when a payload is assembled,
because they depend on the set of analyzers (Benjamini & Hochberg 1995) and on trial counts.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as sps

from probcast.contract import distribution as D
from probcast.contract.grid import (
    DEV_END,
    EVAL_START,
    HOLDOUT_START,
    MEDIAN_INDEX,
    VAL_END,
    origin_steps,
)
from probcast.engine.run import QCOLS, RunResult
from probcast.lake.store import Store
from probcast.scoring.oracle import realised, sealed
from probcast.stats import bootstrap as SB
from probcast.stats import calibration as SC
from probcast.stats import evidence as SE
from probcast.stats import scores as SS
from probcast.stats import tests as ST

MIN_PAIRS = 12  # same floor as probcast.scoring.score.score_run
CI_LEVEL = 0.9
Z90 = float(sps.norm.ppf(0.95))
SEGMENTS = ("dev", "val", "holdout")

#: Decade rows by OUTCOME date, split at the dev/val boundary so no row mixes segments
#: (neutral boundaries, QNT-121).
DECADES: tuple[tuple[str, str, str], ...] = (
    ("1990–2000", "1990-01-01", "2000-12-31"),
    ("2001–2010", "2001-01-01", "2010-12-31"),
    ("2011–2015", "2011-01-01", DEV_END.isoformat()),
    ("2016–2020", (DEV_END + timedelta(days=1)).isoformat(), VAL_END.isoformat()),
)
HOLDOUT_DECADE = ("2021–", HOLDOUT_START.isoformat(), "2100-12-31")


def _f(x: Any) -> float | None:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if np.isfinite(v) else None


def _rows(run: RunResult, h: int) -> pd.DataFrame:
    f = run.forecasts
    return f[(f["horizon"] == h) & f["abstain"].isna()][["origin", *QCOLS]]


def pair_table(store: Store, ticker: str, run: RunResult, anchor: RunResult, yardstick: RunResult, h: int, *, revealed: bool) -> pd.DataFrame:
    """Common-support pairs: model, anchor and yardstick quantiles joined to realised outcomes.

    Holdout pairs (outcome on or after 2021-01-01) are dropped unless revealed (NFR-SCI-05)."""
    m = _rows(run, h)
    if m.empty:
        return pd.DataFrame()
    a = _rows(anchor, h).rename(columns={c: c + "_a" for c in QCOLS})
    y = _rows(yardstick, h).rename(columns={c: c + "_y" for c in QCOLS})
    out = sealed(realised(store, ticker, pd.DatetimeIndex(m["origin"]), h), revealed=revealed)
    j = m.merge(a, on="origin").merge(y, on="origin").merge(out[["origin", "outcome_date", "y", "segment"]], on="origin")
    return j.sort_values("origin").reset_index(drop=True)


def _ci_prop(p: float, n_eff: float) -> tuple[float, float]:
    """Normal-approximation 90% CI for a proportion with an overlap-aware n_eff (Wald)."""
    se = np.sqrt(max(p * (1 - p), 0.0) / max(n_eff, 1.0))
    return max(0.0, p - Z90 * se), min(1.0, p + Z90 * se)


def _skill(lm: np.ndarray, lr: np.ndarray, k: int, n_boot: int) -> dict[str, Any]:
    """CRPSS (Gneiting & Raftery 2007) with stationary-bootstrap CI (Politis & Romano 1994),
    HLN-DM test (Harvey, Leybourne & Newbold 1997) and the CRPSS MDE, on common support."""
    n = lm.size
    est = SS.skill_score(lm, lr)
    try:
        lo, hi = SB.skill_ci(lm, lr, k, n_boot=n_boot)
    except ValueError:
        lo = hi = float("nan")
    try:
        dm = ST.dm_test_hln(lm, lr, k)
    except ValueError:
        dm = {"stat": float("nan"), "p_two_sided": float("nan"), "p_model_better": float("nan")}
    try:
        mde = SE.mde_crpss(lm, lr, k)
    except (ValueError, ZeroDivisionError, FloatingPointError):
        mde = float("nan")
    return {"est": _f(est), "ci_lo": _f(lo), "ci_hi": _f(hi), "n": int(n), "n_eff": _f(SE.n_eff(n, k)),
            "dm_stat": _f(dm["stat"]), "dm_p": _f(dm["p_two_sided"]), "dm_p_model_better": _f(dm["p_model_better"]),
            "mde": _f(mde)}


def _split(j: pd.DataFrame, suffix: str = "") -> np.ndarray:
    return j[[c + suffix for c in QCOLS]].to_numpy(float)


def segment_stats(j: pd.DataFrame, h: int, sample: str, n_boot: int) -> dict[str, Any]:
    k = origin_steps(h)
    Qm, Qa, Qy = _split(j), _split(j, "_a"), _split(j, "_y")
    y = j["y"].to_numpy(float)
    lm, la, ly = SS.crps(Qm, y), SS.crps(Qa, y), SS.crps(Qy, y)
    n = len(j)
    ne = float(SE.n_eff(n, k))
    o = (y > 0).astype(float)
    p_up = D.p_up(Qm)
    hit = float(np.mean((Qm[:, MEDIAN_INDEX] > 0) == (y > 0)))
    cov = {}
    for lv in (0.5, 0.8, 0.95):
        e = float(np.mean(SS.covered(Qm, y, lv)))
        lo, hi = _ci_prop(e, ne)
        cov[f"{int(lv * 100)}"] = {"est": e, "ci_lo": lo, "ci_hi": hi, "n": n}
    hlo, hhi = _ci_prop(hit, ne)
    return {
        "sample": sample,
        "window": {"from": j["origin"].min().date().isoformat(), "to": j["origin"].max().date().isoformat()},
        "n": n,
        "n_eff": ne,
        "crps": float(lm.mean()),
        "crps_capm": float(la.mean()),
        "crps_hist": float(ly.mean()),
        "skill": {"capm": _skill(lm, la, k, n_boot), "hist": _skill(lm, ly, k, n_boot)},
        "yardstick_vs_capm": _skill(ly, la, k, n_boot),
        "pinball": float(SS.pinball(Qm, y).mean()),
        "brier": float(SS.brier(p_up, o).mean()),
        "hit_rate": {"est": hit, "ci_lo": hlo, "ci_hi": hhi, "n": n, "n_eff": ne, "base_rate": float(o.mean())},
        "cov": cov,
        "tilt": float(np.mean(Qm[:, MEDIAN_INDEX] - Qa[:, MEDIAN_INDEX]) * 252 / h),
        "width80": float(np.mean(D.width80(Qm))),
        "width80_capm": float(np.mean(D.width80(Qa))),
    }


def calibration(j: pd.DataFrame, h: int) -> dict[str, Any]:
    """Reliability of P(total return > 0), PIT histogram, coverage and sharpness on one segment.

    For h > 21 sessions the PIT histogram uses the non-overlapping sub-series (every k-th
    pair), since overlapping PIT values are serially dependent (QNT-171)."""
    k = origin_steps(h)
    Qm, Qa = _split(j), _split(j, "_a")
    y = j["y"].to_numpy(float)
    o = (y > 0).astype(float)
    p_up = D.p_up(Qm)
    rel = SC.reliability_bins(p_up, o)
    reliability = [
        {"lo": float(r.lo), "hi": float(r.hi), "p_mean": float(r.mean_p), "freq": float(r.freq), "n": int(r["count"]),
         "ci": {"lo": float(r.band_lo), "hi": float(r.band_hi), "level": CI_LEVEL}}
        for _, r in rel.iterrows() if r["count"] > 0
    ]
    sub = slice(None, None, k) if k > 1 else slice(None)
    u = SS.pit(Qm[sub], y[sub])
    ph = SC.pit_histogram(u)
    n_u = int(u.size)
    bins = [{"lo": float(r.lo), "hi": float(r.hi), "count": int(r["count"]), "expected": n_u / len(ph)} for _, r in ph.iterrows()]
    band = {"lo": float(ph["band_lo"].iloc[0]) * n_u / len(ph), "hi": float(ph["band_hi"].iloc[0]) * n_u / len(ph)}
    ne = float(SE.n_eff(len(j), k))
    coverage = []
    for lv in (0.5, 0.8, 0.95):
        e = float(np.mean(SS.covered(Qm, y, lv)))
        lo, hi = _ci_prop(e, ne)
        coverage.append({"nominal": lv, "empirical": e, "ci": {"lo": lo, "hi": hi, "level": CI_LEVEL}, "n": len(j)})
    return {
        "event": "P(total return > 0 over the horizon)",
        "reliability": reliability,
        "brier": float(SS.brier(p_up, o).mean()),
        "pit": {"bins": bins, "band": band, "non_overlapping": k > 1},
        "coverage": coverage,
        "sharpness": {"width80": float(np.mean(D.width80(Qm))), "width80_capm": float(np.mean(D.width80(Qa)))},
    }


def headline_segment(segments: dict[str, Any]) -> str | None:
    """dev is the headline sample (D-057); val is reported separately as the gate sample."""
    for s in ("dev", "val"):
        if s in segments:
            return s
    return None


def run_stats(store: Store, ticker: str, run: RunResult, anchor: RunResult, yardstick: RunResult, *, revealed: bool, n_boot: int) -> dict[str, Any]:
    """Raw per-horizon, per-segment statistics for one run (cached by the workspace)."""
    out: dict[str, Any] = {"run_id": run.run_id, "anchor_run": anchor.run_id, "yardstick_run": yardstick.run_id,
                           "revealed": revealed, "n_boot": n_boot, "horizons": {}}
    decades = (*DECADES, HOLDOUT_DECADE) if revealed else DECADES
    for h in sorted(int(x) for x in run.forecasts["horizon"].unique()):
        j = pair_table(store, ticker, run, anchor, yardstick, h, revealed=revealed)
        if j.empty:
            continue
        segs = {s: segment_stats(j[j["segment"] == s], h, s, n_boot) for s in SEGMENTS if (j["segment"] == s).sum() >= MIN_PAIRS}
        head = headline_segment(segs)
        if head is None:
            continue
        drows = []
        k = origin_steps(h)
        for label, lo, hi in decades:
            d = j[(j["outcome_date"] >= pd.Timestamp(lo)) & (j["outcome_date"] <= pd.Timestamp(hi))]
            sample = d["segment"].iloc[0] if len(d) else None
            sk = None
            if len(d) >= MIN_PAIRS:
                y = d["y"].to_numpy(float)
                lm = SS.crps(_split(d), y)
                sk = _skill(lm, SS.crps(_split(d, "_a"), y), k, n_boot)
                sk["cov80"] = float(np.mean(SS.covered(_split(d), y, 0.8)))
                sk["crps"] = float(lm.mean())
            drows.append({"label": label, "from": lo, "to": hi if hi != HOLDOUT_DECADE[2] else None, "n": len(d),
                          "n_eff": float(SE.n_eff(len(d), k)), "sample": sample, "skill": sk})
        out["horizons"][str(h)] = {
            "h": h,
            "headline": head,
            "segments": segs,
            "decades": drows,
            "calibration": calibration(j[j["segment"] == head], h),
        }
    return out


def first_origin_window() -> dict[str, Any]:
    return {"dev": [EVAL_START.isoformat(), DEV_END.isoformat()], "val": [(DEV_END + timedelta(days=1)).isoformat(), VAL_END.isoformat()],
            "holdout_from": HOLDOUT_START.isoformat()}


def grade(sk: dict[str, Any], *, bh_q: float | None, cov80: float) -> tuple[str, list[str]]:
    """Evidence grade A–D (A2 QNT-175) from cached statistics; NaN-safe."""
    if sk.get("est") is None:
        return "D", ["no skill estimate"]
    nan = float("nan")
    return SE.evidence_grade(
        n_eff=sk.get("n_eff") or 0.0,
        crpss=sk["est"],
        crpss_ci=(sk.get("ci_lo") if sk.get("ci_lo") is not None else nan, sk.get("ci_hi") if sk.get("ci_hi") is not None else nan),
        dm_p_two_sided=sk.get("dm_p") if sk.get("dm_p") is not None else nan,
        dm_stat=sk.get("dm_stat") if sk.get("dm_stat") is not None else nan,
        bh_q=bh_q,
        coverage80=cov80,
    )


def bh_map(pvalues: dict[str, float | None]) -> dict[str, float]:
    """Benjamini–Hochberg q-values (Benjamini & Hochberg 1995) over the non-missing p-values."""
    keys = [k for k, p in pvalues.items() if p is not None and np.isfinite(p)]
    if not keys:
        return {}
    q = ST.bh_qvalues([float(pvalues[k]) for k in keys])  # type: ignore[arg-type]
    return {k: float(v) for k, v in zip(keys, q, strict=True)}
