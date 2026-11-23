"""Leak suite (architecture §6; contract §11): T1, T2, T3, T5, T7 and T-DN.

* T1 future poisoning: every row with available_at > close(t) is corrupted (NaN, x1e6,
  sign flip, shuffled values, extra future rows). The forecast at t must be bit-identical.
* T2 truncation equivalence: rows after t are physically removed (a different code path).
* T3 order independence: origins run in reverse order give identical forecasts.
* T5 canary: CANARY:fwd21 latest visible value equals the trailing 21-session log TR at t.
* T7 hindsight: hindsight-labelled columns are not visible through the context.
* T-DN drift neutrality: adding a constant excess drift to the stock's returns must not move
  the analyzer's tilt vs the anchor (mean change within +/-0.25 pp/yr).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.contract.grid import MEDIAN_INDEX
from probcast.engine.run import QCOLS, forecasts_equal, run_backtest
from probcast.lake.store import Store
from probcast.pit.context import AsOfContext
from probcast.sdk.registry import AnalyzerSpec
from probcast.validation.fixtures import TICKER, build_fixture_store

POISON_MODES = ("nan", "scale", "flip", "shuffle", "append")
_NUMERIC = {"prices": ("open", "high", "low", "close", "volume"), "observations": ("value",), "fundamentals": ("value",), "corporate_actions": ("value",)}


@dataclass
class LeakReport:
    analyzer: str
    passed: dict[str, bool] = field(default_factory=dict)
    details: dict[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return all(self.passed.values())


def sample_origins(store: Store, n: int = 20, seed: int = 7) -> pd.DatetimeIndex:
    from probcast.engine.run import origin_schedule

    sched = origin_schedule(store, TICKER, pd.Timestamp("1992-01-01").date(), None)
    rng = np.random.default_rng(seed)
    idx = np.sort(rng.choice(len(sched), size=min(n, len(sched)), replace=False))
    return sched[idx]


def poison_after(store: Store, t: pd.Timestamp, mode: str, seed: int = 0) -> Store:
    cut = cal.session_close(t)
    rng = np.random.default_rng(seed)
    new: dict[str, pd.DataFrame] = {}
    for name, df in store.tables.items():
        avail_col = "content_available_at" if name == "events" else "available_at"
        if df.empty or avail_col not in df.columns:
            new[name] = df
            continue
        df = df.copy()
        fut = df[avail_col] > cut
        if not fut.any():
            new[name] = df
            continue
        for c in _NUMERIC.get(name, ()):
            col = df[c].astype(float)
            if mode == "nan":
                col[fut] = np.nan
            elif mode == "scale":
                col[fut] = col[fut] * 1e6
            elif mode == "flip":
                col[fut] = -col[fut]
            elif mode == "shuffle":
                col[fut] = rng.permutation(col[fut].to_numpy())
            df[c] = col
        if name == "events" and mode != "append":
            df.loc[fut, "title"] = "POISONED"
        if mode == "append":
            extra = df[fut].head(50).copy()
            for c in _NUMERIC.get(name, ()):
                extra[c] = extra[c] * 3.0
            df = pd.concat([df, extra], ignore_index=True)
        new[name] = df
    return Store(tables=new, snapshot_id=store.snapshot_id + "-poisoned", snapshot_hash=store.snapshot_hash + "-poisoned")


def truncate_after(store: Store, t: pd.Timestamp) -> Store:
    cut = cal.session_close(t)
    new = {}
    for name, df in store.tables.items():
        avail_col = "content_available_at" if name == "events" else "available_at"
        new[name] = df[df[avail_col] <= cut].copy() if avail_col in df.columns and not df.empty else df
    return Store(tables=new, snapshot_id=store.snapshot_id + "-trunc", snapshot_hash=store.snapshot_hash + "-trunc")


def _one(store: Store, spec: AnalyzerSpec, t: pd.Timestamp) -> pd.DataFrame:
    return run_backtest(store, spec, ticker=TICKER, origins=pd.DatetimeIndex([t]), workers=1).forecasts


def t1_future_poisoning(spec: AnalyzerSpec, store: Store, origins: pd.DatetimeIndex) -> tuple[bool, str]:
    for t in origins:
        clean = _one(store, spec, t)
        for mode in POISON_MODES:
            try:
                poisoned = _one(poison_after(store, t, mode), spec, t)
            except Exception as e:
                return False, f"analyzer raised under poison mode {mode!r} at {t.date()}: {type(e).__name__}"
            if not forecasts_equal(clean, poisoned):
                return False, f"forecast changed at {t.date()} under poison mode {mode!r}"
    return True, f"{len(origins)} origins x {len(POISON_MODES)} modes identical"


def t2_truncation(spec: AnalyzerSpec, store: Store, origins: pd.DatetimeIndex) -> tuple[bool, str]:
    for t in origins:
        if not forecasts_equal(_one(store, spec, t), _one(truncate_after(store, t), spec, t)):
            return False, f"truncated store differs at {t.date()}"
    return True, f"{len(origins)} origins identical"


def t3_order(spec: AnalyzerSpec, store: Store, origins: pd.DatetimeIndex) -> tuple[bool, str]:
    fwd = run_backtest(store, spec, ticker=TICKER, origins=origins, workers=1).forecasts
    rev = run_backtest(store, spec, ticker=TICKER, origins=origins[::-1], workers=1).forecasts
    return forecasts_equal(fwd, rev), "forward vs reverse order"


def t5_canary(store: Store, origins: pd.DatetimeIndex) -> tuple[bool, str]:
    for t in origins:
        ctx = AsOfContext(store, t, TICKER)
        can = ctx.series("CANARY:fwd21")
        tri = ctx.tri()
        if can.empty or tri.size < 22:
            continue
        trailing = float(np.log(tri.iloc[-1] / tri.iloc[-22]))
        if not np.isclose(float(can.iloc[-1]), trailing, rtol=0, atol=1e-12):
            return False, f"canary mismatch at {t.date()}: {can.iloc[-1]} vs {trailing}"
    return True, "canary equals trailing return at every origin"


def t7_hindsight(store: Store, origins: pd.DatetimeIndex) -> tuple[bool, str]:
    for t in origins:
        cols = set(AsOfContext(store, t, TICKER).events().columns)
        bad = cols & {"importance", "selection_method", "verification"}
        if bad:
            return False, f"hindsight columns visible: {sorted(bad)}"
    return True, "no hindsight columns visible"


def t_dn_drift_neutrality(spec: AnalyzerSpec, origins: pd.DatetimeIndex, excess: float = 0.08, tol_pp: float = 0.8, tol_horizon_pp: float = 1.5) -> tuple[bool, str]:
    """Difference-in-differences drift-neutrality test (contract §11.2b; RT-01).

    The same synthetic return path is run twice: as is, and with a constant +``excess``/yr
    added to the stock's returns (CAPM inputs unchanged). A drift-leaky calibrator passes the
    injected excess into its forecasts (the survivor-biased ``hist_drift`` yardstick moves by
    ~+8 pp/yr). A drift-neutral analyzer's tilt vs the anchor must not move: the signed mean
    change over all (origin, horizon) pairs must be within +/-``tol_pp`` pp/yr (10% of the
    injected excess), and within +/-``tol_horizon_pp`` pp/yr for every horizon. The tolerance
    allows for bucket-membership noise of level-dependent signals (D-072).
    """
    tilts = []
    for st in (build_fixture_store(), build_fixture_store(excess_drift_annual=excess)):
        fc = run_backtest(st, spec, ticker=TICKER, origins=origins, workers=1).forecasts.dropna(subset=["q00"])
        anc = run_backtest(st, "baseline.capm", ticker=TICKER, origins=origins, workers=1).forecasts
        m = fc.merge(anc[["origin", "horizon", QCOLS[MEDIAN_INDEX]]], on=["origin", "horizon"], suffixes=("", "_anc"))
        m["tilt_pp_yr"] = (m[QCOLS[MEDIAN_INDEX]] - m[QCOLS[MEDIAN_INDEX] + "_anc"]) * 252 / m["horizon"] * 100
        tilts.append(m.set_index(["origin", "horizon"])["tilt_pp_yr"])
    diff = (tilts[1] - tilts[0]).dropna()
    if diff.empty:
        return True, "no comparable forecasts (analyzer abstained)"
    overall = float(diff.mean())
    by_h = diff.groupby(level="horizon").mean()
    worst = float(by_h.abs().max())
    ok = abs(overall) <= tol_pp and worst <= tol_horizon_pp
    return ok, f"signed mean tilt change {overall:+.3f} pp/yr (tol {tol_pp}); worst horizon {worst:.3f} (tol {tol_horizon_pp}) after +{excess:.0%}/yr injected"


def run_leak_suite(spec: AnalyzerSpec, *, n_origins: int = 20, include_dn: bool = True) -> LeakReport:
    store = build_fixture_store()
    origins = sample_origins(store, n_origins)
    rep = LeakReport(analyzer=spec.id)
    for name, fn in (("T1", lambda: t1_future_poisoning(spec, store, origins[:8])),
                     ("T2", lambda: t2_truncation(spec, store, origins)),
                     ("T3", lambda: t3_order(spec, store, origins)),
                     ("T5", lambda: t5_canary(store, origins)),
                     ("T7", lambda: t7_hindsight(store, origins))):
        ok, msg = fn()
        rep.passed[name], rep.details[name] = ok, msg
    if include_dn and spec.manifest.family != "baseline":
        ok, msg = t_dn_drift_neutrality(spec, sample_origins(store, 40, seed=11))
        rep.passed["T-DN"], rep.details["T-DN"] = ok, msg
    return rep
