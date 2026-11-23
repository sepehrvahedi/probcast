"""One committee pipeline for every caller (CLI evaluate/freeze, report pack, API server).

Guarantees the same members, gate, combination, spread recalibration, attribution, ERP and
extra dates everywhere, so the forecast SHA-256 is identical whichever path computes it
(fix for B4's finding: the report pack and the freeze path produced different hashes).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from probcast.committee.core import (
    CommitteeResult,
    Member,
    attribution,
    combine,
    recalibrate_spread,
)
from probcast.committee.final import final_object
from probcast.contract.grid import HEADLINE_HORIZON, origin_steps
from probcast.contract.models import CommitteeConfig
from probcast.engine.run import QCOLS, RunResult
from probcast.lake.store import Store
from probcast.scoring.oracle import realised
from probcast.stats import scores as SS
from probcast.stats import tests as ST

SECONDARY_DATE = "2027-12-31"
GATE_ALPHA = 0.10
GATE_MIN_PAIRS = 24


@dataclass
class CommitteeOutcome:
    result: CommitteeResult
    origin: pd.Timestamp
    quantiles: dict[int, np.ndarray]
    attribution: dict
    final: dict
    members: list[Member]
    excluded: dict[str, str] = field(default_factory=dict)


def gate(store: Store, ticker: str, member: Member, anchor: RunResult) -> str | None:
    """Contract §11.4: not significantly worse than the anchor on the VAL segment (HLN-DM,
    one-sided 10%) at any declared horizon with enough pairs. Returns a reason or None."""
    for h in member.run.spec.manifest.horizons:
        m = member.run.forecasts
        a = anchor.forecasts
        m = m[(m.horizon == h) & m.abstain.isna()]
        a = a[(a.horizon == h) & a.abstain.isna()]
        if m.empty:
            continue
        out = realised(store, ticker, pd.DatetimeIndex(m["origin"]), int(h))
        out = out[out["segment"] == "val"]
        j = m.merge(a[["origin", *QCOLS]], on="origin", suffixes=("", "_a")).merge(out, on="origin")
        if len(j) < GATE_MIN_PAIRS:
            continue
        y = j["y"].to_numpy(float)
        lm = SS.crps(j[QCOLS].to_numpy(float), y)
        la = SS.crps(j[[c + "_a" for c in QCOLS]].to_numpy(float), y)
        dm = ST.dm_test_hln(lm, la, origin_steps(int(h)))
        if dm["stat"] > 0 and dm["p_two_sided"] / 2 < GATE_ALPHA:
            return f"significantly worse than the CAPM anchor on the validation segment at {h} sessions (one-sided p = {dm['p_two_sided'] / 2:.3f})"
    return None


def run_committee(
    store: Store,
    ticker: str,
    cfg: CommitteeConfig,
    members: list[Member],
    anchor: RunResult,
    *,
    apply_gate: bool = True,
) -> CommitteeOutcome:
    excluded: dict[str, str] = {}
    kept: list[Member] = []
    for m in members:
        if m.analyzer_id in cfg.vetoes:
            excluded[m.analyzer_id] = f"veto: {cfg.vetoes[m.analyzer_id]}"
            continue
        reason = gate(store, ticker, m, anchor) if apply_gate else None
        if reason:
            excluded[m.analyzer_id] = f"gate: {reason}"
            continue
        kept.append(m)
    res = combine(kept, anchor, anchor_weight=cfg.anchor_weight)
    if cfg.spread_recalibration:
        res = recalibrate_spread(store, ticker, res)
    f = res.forecasts
    t = f["origin"].max()
    cq = {int(h): f[(f.origin == t) & (f.horizon == h)][QCOLS].to_numpy()[0] for h in sorted(f.horizon.unique())}
    informs = {m.family: tuple(m.informs) for m in kept}
    att = attribution(res, t, HEADLINE_HORIZON, informs)
    final = final_object(store, ticker, t, cq, attribution=att, extra_dates=(SECONDARY_DATE,), erp=cfg.erp)
    final["committee"] = {"name": cfg.name, "members": sorted(m.analyzer_id for m in kept), "excluded": excluded,
                          "anchor_weight": cfg.anchor_weight, "erp": cfg.erp, "spread_recalibration": cfg.spread_recalibration}
    from probcast.committee.final import forecast_hash

    final["sha256"] = forecast_hash(final)
    return CommitteeOutcome(result=res, origin=t, quantiles=cq, attribution=att, final=final, members=kept, excluded=excluded)
