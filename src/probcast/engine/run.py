"""Walk-forward engine (A2 §4; architecture §7.2).

Month-end origins, every declared horizon, one fresh AsOfContext per origin (stateless
analyzers, L7). Output: a tidy forecasts table with 23 quantile columns. Runs are immutable
folders with a manifest (NFR-REP-01).
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import platform
import sys
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

import probcast
from probcast import calendar as cal
from probcast.config import Settings, get_settings
from probcast.contract import distribution as D
from probcast.contract.grid import CONTRACT_VERSION, EVAL_START, HORIZONS, N_QUANTILES
from probcast.contract.models import ExperimentConfig
from probcast.lake.store import Store
from probcast.pit.context import AsOfContext, PITViolation
from probcast.sdk.registry import Abstain, AnalyzerSpec, Forecast, get_spec

QCOLS = [f"q{i:02d}" for i in range(N_QUANTILES)]


@dataclass
class RunResult:
    run_id: str
    spec: AnalyzerSpec
    params: dict[str, Any]
    forecasts: pd.DataFrame  # origin, horizon, q00..q22, signal, abstain, calibration(json)
    manifest: dict[str, Any]

    def matrix(self, h: int) -> tuple[pd.DatetimeIndex, np.ndarray]:
        f = self.forecasts[(self.forecasts["horizon"] == h) & self.forecasts["abstain"].isna()]
        return pd.DatetimeIndex(f["origin"]), f[QCOLS].to_numpy(dtype=float)


def _hash(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()


def origin_schedule(store: Store, ticker: str, start: date, end: date | None) -> pd.DatetimeIndex:
    px = store.table("prices")
    d = pd.to_datetime(px.loc[px["ticker"] == ticker, "session_date"])
    if d.empty:
        return pd.DatetimeIndex([])
    first, last = d.min(), d.max()
    lo = max(pd.Timestamp(start), pd.Timestamp(EVAL_START), first + pd.Timedelta(days=365))
    hi = min(pd.Timestamp(end), last) if end else last
    ms = cal.month_end_sessions(lo, hi)
    return ms[ms <= last]


def forecast_at(store: Store, spec: AnalyzerSpec, params: dict[str, Any], origin: pd.Timestamp, ticker: str, horizons: tuple[int, ...], *, strict: bool = False, seed: int = 7) -> list[dict[str, Any]]:
    """Run one analyzer at one origin and return validated rows (one per horizon)."""
    ctx = AsOfContext(store, origin, ticker, strict=strict, seed=seed)
    try:
        out = spec.fn(ctx, params)
    except PITViolation as e:
        out = {h: Abstain(f"PIT: {e}") for h in horizons}
    rows = []
    for h in horizons:
        f = out.get(h, Abstain("horizon not produced"))
        row: dict[str, Any] = {"origin": origin, "horizon": h}
        if isinstance(f, Forecast):
            try:
                q = D.validate(np.asarray(f.quantiles, dtype=float))[0]
            except D.InvalidForecast as e:  # D-098: skip this origin with the reason, never clip or crash the run
                f = Abstain(f"forecast outside the contract's plausibility bounds ({e})")
        if isinstance(f, Forecast):
            row.update(dict(zip(QCOLS, q, strict=True)))
            row["signal"] = f.signal
            row["abstain"] = None
            row["calibration"] = json.dumps(f.calibration, default=str)
        else:
            row.update(dict.fromkeys(QCOLS, np.nan))
            row["signal"] = None
            row["abstain"] = f.reason if isinstance(f, Abstain) else "invalid output"
            row["calibration"] = None
        rows.append(row)
    return rows


_WORKER_STORE: Store | None = None


def _init_worker(store: Store) -> None:
    global _WORKER_STORE
    _WORKER_STORE = store
    with contextlib.suppress(OSError):
        os.nice(10)  # background priority: the machine stays responsive


def _run_chunk(args: tuple[str, dict[str, Any], list[pd.Timestamp], str, tuple[int, ...], bool, int]) -> list[dict[str, Any]]:
    analyzer_id, params, origins, ticker, hz, strict, seed = args
    assert _WORKER_STORE is not None
    spec = get_spec(analyzer_id)
    rows: list[dict[str, Any]] = []
    for t in origins:
        rows.extend(forecast_at(_WORKER_STORE, spec, params, t, ticker, hz, strict=strict, seed=seed))
    return rows


THREAD_ENV = ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS")


def default_workers() -> int:
    """Worker processes for parallel backtests: ``PROBCAST_WORKERS`` if set, else half the cores
    (laptop-friendly: 4 on an 8-core M3), never fewer than 1 (D-102)."""
    env = os.environ.get("PROBCAST_WORKERS")
    if env and env.isdigit():
        return max(1, int(env))
    return max(1, min(8, (os.cpu_count() or 2) // 2))


def cap_worker_threads() -> None:
    """One maths thread per worker process: inherited by spawned workers, so N workers use about
    N cores instead of N x (BLAS threads) (D-102)."""
    for k in THREAD_ENV:
        os.environ.setdefault(k, "1")


def run_backtest(
    store: Store,
    analyzer: str | AnalyzerSpec,
    params: dict[str, Any] | None = None,
    *,
    ticker: str = "AAPL",
    start: date = EVAL_START,
    end: date | None = None,
    horizons: tuple[int, ...] | None = None,
    strict: bool = False,
    seed: int = 7,
    origins: pd.DatetimeIndex | None = None,
    name: str | None = None,
    author: str = "probcast",
    workers: int | None = None,
    on_rows: Callable[[list[dict[str, Any]], int], None] | None = None,
) -> RunResult:
    """Walk-forward backtest. ``on_rows(rows, n_origins)`` is called as chunks of origins finish
    (in completion order) so callers can stream progress; it never changes the result."""
    spec = analyzer if isinstance(analyzer, AnalyzerSpec) else get_spec(analyzer)
    p = spec.params(params)
    hz = tuple(h for h in (horizons or spec.manifest.horizons) if h in HORIZONS)
    sched = origins if origins is not None else origin_schedule(store, ticker, start, end)
    n_workers = default_workers() if workers is None else max(1, workers)
    rows: list[dict[str, Any]] = []
    registered = spec.id in __import__("probcast.sdk.registry", fromlist=["_REGISTRY"])._REGISTRY
    if n_workers > 1 and len(sched) >= 24 and registered:
        n_chunks = n_workers if on_rows is None else max(n_workers, len(sched) // 12)
        chunks = [list(c) for c in np.array_split(np.asarray(sched), n_chunks) if len(c)]
        cap_worker_threads()
        with ProcessPoolExecutor(max_workers=n_workers, initializer=_init_worker, initargs=(store,)) as ex:
            futs = [ex.submit(_run_chunk, (spec.id, p, [pd.Timestamp(x) for x in c], ticker, hz, strict, seed)) for c in chunks]
            for fut in as_completed(futs):
                part = fut.result()
                rows.extend(part)
                if on_rows is not None:
                    on_rows(part, len(sched))
    else:
        for t in sched:
            part = forecast_at(store, spec, p, t, ticker, hz, strict=strict, seed=seed)
            rows.extend(part)
            if on_rows is not None:
                on_rows(part, len(sched))
    fc = pd.DataFrame(rows).sort_values(["origin", "horizon"]).reset_index(drop=True)
    cfg = ExperimentConfig(name=name or spec.id, analyzer=spec.id, params=p, ticker=ticker, snapshot=store.snapshot_id,
                           start=start, end=end, horizons=hz, strict_mode=strict, seed=seed, author=author)
    config_hash = _hash(cfg.model_dump(mode="json"))
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%S") + "-" + _hash([config_hash, spec.version, store.snapshot_hash])[:8]
    manifest = {
        "run_id": run_id,
        "created_at": datetime.now(UTC).isoformat(),
        "config": cfg.model_dump(mode="json"),
        "config_hash": config_hash,
        "analyzer_id": spec.id,
        "analyzer_version": spec.version,
        "params_hash": _hash(p),
        "family": spec.manifest.family,
        "snapshot_id": store.snapshot_id,
        "snapshot_hash": store.snapshot_hash,
        "platform_version": probcast.__version__,
        "contract_version": CONTRACT_VERSION,
        "python": sys.version.split()[0],
        "os": platform.platform(),
        "seed": seed,
        "n_origins": len(sched),
        "status": "complete",
    }
    return RunResult(run_id=run_id, spec=spec, params=p, forecasts=fc, manifest=manifest)


def save_run(result: RunResult, settings: Settings | None = None) -> Path:
    s = settings or get_settings()
    d = s.runs_dir / result.run_id
    d.mkdir(parents=True, exist_ok=False)
    result.forecasts.to_parquet(d / "forecasts.parquet", index=False)
    (d / "manifest.json").write_text(json.dumps(result.manifest, indent=2, default=str))
    return d


def forecasts_equal(a: pd.DataFrame, b: pd.DataFrame) -> bool:
    """Bit-identical comparison of two forecast tables (leak suite)."""
    cols = ["origin", "horizon", *QCOLS]
    x = a[cols].sort_values(["origin", "horizon"]).reset_index(drop=True)
    y = b[cols].sort_values(["origin", "horizon"]).reset_index(drop=True)
    if x.shape != y.shape or not (x["origin"].values == y["origin"].values).all():
        return False
    xa, ya = x[QCOLS].to_numpy(dtype=float), y[QCOLS].to_numpy(dtype=float)
    return bool(np.array_equal(xa, ya, equal_nan=True))
