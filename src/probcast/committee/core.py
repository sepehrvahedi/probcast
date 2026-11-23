"""The committee (ADR-009; contract §7; A2 §7).

* Equal weight per FAMILY: members within a family are Vincentized (quantile-averaged), then
  families are averaged with equal weights; the CAPM anchor keeps a fixed 25% weight.
* Spread recalibration about the median: a factor s fitted point-in-time on matured,
  pre-holdout committee forecasts, shrunk towards 1 by n_eff / (n_eff + 20) (never-cut, RT-35).
* Composition-at-origin log: which members and families were active at each origin.
* Attribution: an exact median waterfall in log space (anchor -> each family -> final) plus
  leave-one-family-out (LOFO) changes in P(up).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from probcast.contract import distribution as D
from probcast.contract.grid import (
    ANCHOR_WEIGHT,
    HOLDOUT_START,
    MEDIAN_INDEX,
    N_QUANTILES,
    origin_steps,
)
from probcast.engine.run import QCOLS, RunResult
from probcast.lake.store import Store
from probcast.scoring.oracle import realised
from probcast.stats import scores as SS

SPREAD_GRID = np.round(np.arange(0.6, 2.01, 0.05), 2)
MIN_SPREAD_PAIRS = 24


@dataclass
class Member:
    analyzer_id: str
    family: str
    run: RunResult
    informs: tuple[str, ...] = ("location",)


@dataclass
class CommitteeResult:
    forecasts: pd.DataFrame  # origin, horizon, q00..q22, spread, n_families
    composition: pd.DataFrame  # origin, horizon, families (json), members (json)
    family_quantiles: dict[tuple[pd.Timestamp, int], dict[str, np.ndarray]] = field(default_factory=dict)
    anchor_weight: float = ANCHOR_WEIGHT


def _rows(run: RunResult, h: int) -> pd.DataFrame:
    f = run.forecasts
    return f[(f["horizon"] == h) & f["abstain"].isna()].set_index("origin")


def combine(members: list[Member], anchor: RunResult, *, anchor_weight: float = ANCHOR_WEIGHT) -> CommitteeResult:
    """Raw (pre-spread) committee at every origin where the anchor exists."""
    out, comp, famq = [], [], {}
    for h in sorted(anchor.forecasts["horizon"].unique()):
        a = _rows(anchor, int(h))
        mem = {m.analyzer_id: _rows(m.run, int(h)) for m in members}
        for t in a.index:
            fam: dict[str, list[np.ndarray]] = {}
            active = []
            for m in members:
                r = mem[m.analyzer_id]
                if t in r.index:
                    fam.setdefault(m.family, []).append(r.loc[t, QCOLS].to_numpy(float))
                    active.append(m.analyzer_id)
            qa = a.loc[t, QCOLS].to_numpy(float)
            fq = {f: np.mean(np.vstack(v), axis=0) for f, v in fam.items()}
            if fq:
                q = anchor_weight * qa + (1 - anchor_weight) * np.mean(np.vstack(list(fq.values())), axis=0)
            else:
                q = qa.copy()  # baseline-only state (fewer than 1 active family)
            famq[(t, int(h))] = {"__anchor__": qa, **fq}
            out.append({"origin": t, "horizon": int(h), **dict(zip(QCOLS, q, strict=True)), "n_families": len(fq)})
            comp.append({"origin": t, "horizon": int(h), "families": json.dumps(sorted(fq)), "members": json.dumps(sorted(active))})
    return CommitteeResult(forecasts=pd.DataFrame(out), composition=pd.DataFrame(comp), family_quantiles=famq, anchor_weight=anchor_weight)


def _fit_spread(Q: np.ndarray, y: np.ndarray, n_eff: float) -> float:
    if len(y) < MIN_SPREAD_PAIRS:
        return 1.0
    losses = [float(SS.crps(D.scale_about_median(Q, s), y).mean()) for s in SPREAD_GRID]
    s_hat = float(SPREAD_GRID[int(np.argmin(losses))])
    lam = n_eff / (n_eff + 20.0)
    return 1.0 + lam * (s_hat - 1.0)


def recalibrate_spread(store: Store, ticker: str, raw: CommitteeResult, *, pre_holdout_only: bool = True) -> CommitteeResult:
    """Point-in-time spread factor per (origin, horizon): fitted only on committee forecasts whose
    outcomes had matured by that origin (and, by default, outcome < holdout start)."""
    f = raw.forecasts.copy()
    f["spread"] = 1.0
    for h in sorted(f["horizon"].unique()):
        sub = f[f["horizon"] == h].sort_values("origin")
        out = realised(store, ticker, pd.DatetimeIndex(sub["origin"]), int(h)).set_index("origin")
        k = origin_steps(int(h))
        for i, t in enumerate(sub["origin"]):
            past = out[(out["outcome_date"] <= t)]
            if pre_holdout_only:
                past = past[past["outcome_date"] < pd.Timestamp(HOLDOUT_START)]
            if len(past) < MIN_SPREAD_PAIRS:
                continue
            Qp = sub.set_index("origin").loc[past.index, QCOLS].to_numpy(float)
            s = _fit_spread(Qp, past["y"].to_numpy(float), len(past) / k)
            idx = sub.index[i]
            f.loc[idx, "spread"] = s
            f.loc[idx, QCOLS] = D.scale_about_median(f.loc[idx, QCOLS].to_numpy(float), s)[0]
    return CommitteeResult(forecasts=f, composition=raw.composition, family_quantiles=raw.family_quantiles, anchor_weight=raw.anchor_weight)


def attribution(res: CommitteeResult, origin: pd.Timestamp, h: int, informs: dict[str, tuple[str, ...]] | None = None) -> dict[str, Any]:
    """Exact median waterfall in log space + LOFO delta P(up) + effective anchor weight."""
    fq = res.family_quantiles[(origin, h)]
    qa = fq["__anchor__"]
    fams = {k: v for k, v in fq.items() if k != "__anchor__"}
    w = res.anchor_weight
    m_a = float(qa[MEDIAN_INDEX])
    steps = [{"label": "CAPM anchor", "value": m_a}]
    F = len(fams)
    total = m_a
    for name, q in sorted(fams.items()):
        contrib = (1 - w) / F * (float(q[MEDIAN_INDEX]) - m_a)
        total += contrib
        steps.append({"label": name, "value": contrib})
    row = res.forecasts[(res.forecasts["origin"] == origin) & (res.forecasts["horizon"] == h)].iloc[0]
    q_final = row[QCOLS].to_numpy(float)
    assert abs(total - q_final[MEDIAN_INDEX]) < 1e-9, "median waterfall must add up exactly"
    steps.append({"label": "Committee median", "value": float(q_final[MEDIAN_INDEX]), "total": True})
    p_full = float(D.p_up(q_final)[0])
    lofo = {}
    s = float(row.get("spread", 1.0))
    for name in fams:
        rest = [v for k, v in fams.items() if k != name]
        q = w * qa + (1 - w) * np.mean(np.vstack(rest), axis=0) if rest else qa
        q = D.scale_about_median(q, s)[0]
        lofo[name] = p_full - float(D.p_up(q)[0])
    scale_only = sum(1 for k in fams if informs and informs.get(k) == ("scale",))
    eff_w = w + (1 - w) * (scale_only / F) if F else 1.0
    return {"steps": steps, "lofo_delta_p_up": lofo, "anchor_weight": w, "effective_anchor_location_weight": eff_w, "p_up": p_full}


def as_run(res: CommitteeResult, template: RunResult, name: str = "committee") -> RunResult:
    """Wrap committee forecasts as a RunResult so it is scored like any analyzer."""
    f = res.forecasts.copy()
    f["signal"] = None
    f["abstain"] = None
    f["calibration"] = None
    man = dict(template.manifest)
    man.update({"analyzer_id": name, "run_id": template.run_id + "-committee", "family": "committee"})
    return RunResult(run_id=man["run_id"], spec=template.spec, params={}, forecasts=f[["origin", "horizon", *QCOLS, "signal", "abstain", "calibration"]], manifest=man)


def empty_quantiles() -> np.ndarray:
    return np.full(N_QUANTILES, np.nan)
