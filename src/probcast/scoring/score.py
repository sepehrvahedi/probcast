"""Score a backtest run against realised outcomes and the CAPM anchor (ADR-013).

Per horizon, on PRE-HOLDOUT pairs only (outcome date <= 2020-12-31) unless revealed:
CRPS and CRPSS vs the CAPM anchor (headline) with a stationary-bootstrap CI and the HLN-DM
test; CRPSS vs the survivor-biased hist_drift yardstick (shown, never the headline);
50/80/95% coverage; PIT histogram; Brier and reliability of P(up) with base rates; n_eff;
MDE; mean location tilt vs the anchor; the A–D evidence grade; and a fixed-template verdict.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from probcast.contract import distribution as D
from probcast.contract.grid import MEDIAN_INDEX, origin_steps
from probcast.engine.run import QCOLS, RunResult
from probcast.lake.store import Store
from probcast.scoring.oracle import realised, sealed
from probcast.stats import bootstrap as SB
from probcast.stats import calibration as SC
from probcast.stats import evidence as SE
from probcast.stats import scores as SS
from probcast.stats import tests as ST

GRADE_LABEL = {"A": "Strong", "B": "Moderate", "C": "Weak", "D": "Insufficient evidence"}


@dataclass
class HorizonScore:
    horizon: int
    n_pairs: int
    n_eff: float
    segments: dict[str, int]
    crps: float
    crps_anchor: float
    crpss: float
    crpss_ci: tuple[float, float]
    dm: dict[str, Any]
    crpss_vs_yardstick: float | None
    coverage: dict[str, float]
    pit_hist: list[dict[str, Any]]
    brier: float
    brier_anchor: float
    reliability: list[dict[str, Any]]
    base_rate: float
    mde: float
    tilt_pp_yr: float
    location_scale: dict[str, float]
    grade: str
    grade_reasons: list[str]
    verdict: str
    criterion_met: bool | None = None


@dataclass
class ScoreCard:
    analyzer_id: str
    run_id: str
    revealed: bool
    horizons: dict[int, HorizonScore] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from dataclasses import asdict

        return {"analyzer_id": self.analyzer_id, "run_id": self.run_id, "revealed": self.revealed,
                "horizons": {h: asdict(s) for h, s in self.horizons.items()}}


def _verdict(grade: str, crpss: float, ci: tuple[float, float], n_eff: float, h: int, trials: int | None, criterion: bool | None) -> str:
    crit = "criterion met" if criterion else ("criterion not met" if criterion is False else "no pre-registered criterion")
    tr = f"; trials {trials}" if trials is not None else ""
    return (f"{grade} · {GRADE_LABEL[grade]}: CRPSS vs CAPM {crpss:+.1%} [{ci[0]:+.1%}, {ci[1]:+.1%}], "
            f"n_eff ≈ {n_eff:.0f} at {h}d; {crit}{tr}.")


def score_run(
    store: Store,
    run: RunResult,
    anchor: RunResult,
    yardstick: RunResult | None = None,
    *,
    revealed: bool = False,
    bh_q: dict[int, float] | None = None,
    trials: int | None = None,
    success: dict[int, bool] | None = None,
    n_boot: int = 1000,
) -> ScoreCard:
    ticker = run.manifest["config"]["ticker"]
    card = ScoreCard(analyzer_id=run.spec.id, run_id=run.run_id, revealed=revealed)
    for h in sorted(run.forecasts["horizon"].unique()):
        m = run.forecasts[(run.forecasts["horizon"] == h) & run.forecasts["abstain"].isna()]
        a = anchor.forecasts[(anchor.forecasts["horizon"] == h) & anchor.forecasts["abstain"].isna()]
        if m.empty or a.empty:
            continue
        out = sealed(realised(store, ticker, pd.DatetimeIndex(m["origin"]), int(h)), revealed=revealed)
        j = m.merge(a[["origin", *QCOLS]], on="origin", suffixes=("", "_a")).merge(out, on="origin")
        if len(j) < 12:
            continue
        Qm = j[QCOLS].to_numpy(float)
        Qa = j[[c + "_a" for c in QCOLS]].to_numpy(float)
        y = j["y"].to_numpy(float)
        k = origin_steps(int(h))
        lm, la = SS.crps(Qm, y), SS.crps(Qa, y)
        crpss = SS.skill_score(lm, la)
        ci = SB.skill_ci(lm, la, k, n_boot=n_boot)
        dm = ST.dm_test_hln(lm, la, k)
        ne = SE.n_eff(len(j), k)
        cov = {f"{int(lv * 100)}": float(np.mean(SS.covered(Qm, y, lv))) for lv in (0.5, 0.8, 0.95)}
        p_up = D.p_up(Qm)
        o = (y > 0).astype(float)
        sigma_h = float(np.median((Qm[:, 19] - Qm[:, 3]) / 2.563))
        y_vs = None
        if yardstick is not None:
            ys = yardstick.forecasts[(yardstick.forecasts["horizon"] == h) & yardstick.forecasts["abstain"].isna()]
            jj = j[["origin"]].merge(ys[["origin", *QCOLS]], on="origin")
            if len(jj) == len(j):
                y_vs = SS.skill_score(lm, SS.crps(jj[QCOLS].to_numpy(float), y))
        try:
            ls = SE.location_scale_split(Qm, Qa, y)
            ls = {k2: float(np.mean(v)) if np.ndim(v) else float(v) for k2, v in ls.items()}
        except Exception:
            ls = {}
        grade, reasons = SE.evidence_grade(n_eff=ne, crpss=crpss, crpss_ci=ci, dm_p_two_sided=dm["p_two_sided"],
                                           dm_stat=dm["stat"], bh_q=(bh_q or {}).get(int(h)), coverage80=cov["80"])
        tilt = float(np.mean(Qm[:, MEDIAN_INDEX] - Qa[:, MEDIAN_INDEX]) * 252 / h * 100)
        crit = (success or {}).get(int(h))
        card.horizons[int(h)] = HorizonScore(
            horizon=int(h), n_pairs=len(j), n_eff=ne, segments=j["segment"].value_counts().to_dict(),
            crps=float(lm.mean()), crps_anchor=float(la.mean()), crpss=crpss, crpss_ci=(float(ci[0]), float(ci[1])), dm=dm,
            crpss_vs_yardstick=y_vs, coverage=cov, pit_hist=SC.pit_histogram(SS.pit(Qm, y)).to_dict("records"),
            brier=float(SS.brier(p_up, o).mean()), brier_anchor=float(SS.brier(D.p_up(Qa), o).mean()),
            reliability=SC.reliability_bins(p_up, o).to_dict("records"), base_rate=float(o.mean()),
            mde=float(SE.mde_location(sigma_h, max(ne, 1))), tilt_pp_yr=tilt, location_scale=ls,
            grade=grade, grade_reasons=reasons, verdict=_verdict(grade, crpss, ci, ne, int(h), trials, crit), criterion_met=crit,
        )
    return card
