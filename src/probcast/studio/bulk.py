"""Bulk computation for the whole universe (D-101): one long-lived process pool instead of a fresh
pool per backtest.

Workers each load the snapshot once and keep a Workspace. They compute; the parent process alone
writes run folders and appends to the hash-chained trials registry (appends from several processes
could interleave). Evaluations, all-stocks scores, per-stock mixes and leak-suite results only
write content-addressed cache files (atomic ``os.replace``), so workers may write those directly.
"""

from __future__ import annotations

import contextlib
import os
import time
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Any

import pandas as pd

_WS: Any = None


def _init(snapshot: str) -> None:
    global _WS
    with contextlib.suppress(OSError):
        os.nice(10)  # background priority (D-102)
    from probcast.server.workspace import ComputeOptions, Workspace

    _WS = Workspace("snapshot", snapshot=snapshot, options=ComputeOptions(workers=1))
    _ = _WS.store


def _studio() -> Any:
    from probcast.studio.service import Studio

    return Studio(_WS)


def _run(args: tuple[str, str]) -> tuple[str, str, Any, dict[str, Any] | None, str | None]:
    ticker, analyzer = args
    from probcast.engine.run import run_backtest
    from probcast.sdk.registry import get_spec

    try:
        spec = get_spec(analyzer)
        res = run_backtest(_WS.store_for(ticker), spec, None, ticker=ticker, workers=1)
        return ticker, analyzer, res.forecasts, res.manifest, None
    except Exception as e:
        return ticker, analyzer, None, None, f"{type(e).__name__}: {e}"


def _eval(args: tuple[str, str, str]) -> tuple[str, str | None]:
    ticker, run_id, anchor_id = args
    try:
        _studio().eval_for(run_id, anchor_id, ticker, compute=True)
        return run_id, None
    except Exception as e:
        return run_id, f"{type(e).__name__}: {e}"


def _pooled(analyzer: str) -> tuple[str, str | None]:
    try:
        st = _studio()
        st.pooled_for(analyzer, compute=True)
        st.pooled_losses_for(analyzer, compute=True)
        return analyzer, None
    except Exception as e:
        return analyzer, f"{type(e).__name__}: {e}"


def _mix(ticker: str) -> tuple[str, str | None]:
    try:
        _studio().mix_bundle(ticker, compute=True)
        return ticker, None
    except Exception as e:
        return ticker, f"{type(e).__name__}: {e}"


def _leak(analyzer: str) -> tuple[str, str | None]:
    try:
        rec = _WS.leak(analyzer, compute=True)
        return analyzer, None if rec and rec.get("ok") else "leak suite FAILED"
    except Exception as e:
        return analyzer, f"{type(e).__name__}: {e}"


LOAD_LIMIT = 1.5  # pause new work while the 1-minute load average exceeds this x cores (D-102)


def _throttled(ex: Any, fn: Any, items: list[Any], n: int, note: Callable[[str], None]):
    """Submit ``items`` with at most 2n in flight, pausing while the machine is overloaded; yields
    futures as they complete."""
    from concurrent.futures import FIRST_COMPLETED, wait

    cores = os.cpu_count() or 2
    pending: set[Any] = set()
    it = iter(items)
    warned = 0.0
    exhausted = False
    while pending or not exhausted:
        while not exhausted and len(pending) < 2 * n:
            load = os.getloadavg()[0] if hasattr(os, "getloadavg") else 0.0
            if load > LOAD_LIMIT * cores and pending:
                if time.time() - warned > 60:
                    note(f"machine busy (load {load:.0f} on {cores} cores): holding new work")
                    warned = time.time()
                break
            try:
                pending.add(ex.submit(fn, next(it)))
            except StopIteration:
                exhausted = True
        if not pending:
            if exhausted:
                break
            time.sleep(2)
            continue
        finished, pending = wait(pending, return_when=FIRST_COMPLETED, timeout=5)
        yield from finished


def warm_all(ws: Any, analyzers: list[str], tickers: list[str], *, say: Callable[[str], None] | None = None,
             workers: int | None = None, leak: bool = True) -> dict[str, Any]:
    """Backtest ``analyzers`` (plus the CAPM baseline) on ``tickers``, then score, pool, mix and
    leak-test, skipping anything already cached. Returns counts and failures."""
    from probcast.engine.run import RunResult, default_workers
    from probcast.sdk.registry import get_spec
    from probcast.studio.service import ANCHOR, Studio

    note = say or (lambda _m: None)
    st = Studio(ws)
    n = workers or default_workers()
    fails: dict[str, str] = {}
    all_an = [ANCHOR, *[a for a in analyzers if a != ANCHOR]]
    todo = [(t, a) for t in tickers for a in all_an if st._run_id(a, t) is None]
    note(f"{len(todo)} backtests to run on {n} workers ({len(tickers)} stocks x {len(all_an)} rules, cached ones skipped)")
    from probcast.engine.run import cap_worker_threads

    cap_worker_threads()
    with ProcessPoolExecutor(max_workers=n, initializer=_init, initargs=(ws.snapshot_id,)) as ex:
        done = 0
        for fut in _throttled(ex, _run, todo, n, note):
            t, a, fc, man, err = fut.result()
            done += 1
            if err:
                fails[f"run {t} {a}"] = err
                continue
            ws.adopt_run(RunResult(run_id=man["run_id"], spec=get_spec(a), params=man["config"]["params"], forecasts=fc, manifest=man), ticker=t)
            if done % 25 == 0 or done == len(todo):
                note(f"backtests {done}/{len(todo)}")
        evals = []
        for t in tickers:
            anc = st._run_id(ANCHOR, t)
            for a in analyzers:
                rid = st._run_id(a, t)
                if rid and anc and not ws.cache_has(st._eval_rel(rid, anc)):
                    evals.append((t, rid, anc))
        note(f"{len(evals)} scorings to run")
        for i, fut in enumerate(as_completed([ex.submit(_eval, x) for x in evals]), 1):
            rid, err = fut.result()
            if err:
                fails[f"eval {rid}"] = err
            if i % 50 == 0 or i == len(evals):
                note(f"scorings {i}/{len(evals)}")
        for fut in as_completed([ex.submit(_pooled, a) for a in analyzers]):
            a, err = fut.result()
            if err:
                fails[f"pooled {a}"] = err
        note("all-stock scores ready")
        for fut in as_completed([ex.submit(_mix, t) for t in tickers]):
            t, err = fut.result()
            if err:
                fails[f"mix {t}"] = err
        note(f"forecasts ready for {len(tickers)} stocks")
        if leak:
            ids = sorted(set(all_an) | set(analyzers))
            for fut in as_completed([ex.submit(_leak, a) for a in ids]):
                a, err = fut.result()
                if err:
                    fails[f"leak {a}"] = err
            note(f"leak suite run for {len(ids)} rules")
    if fails:
        for k, v in list(fails.items())[:20]:
            note(f"FAILED {k}: {v}")
    return {"backtests": len(todo), "evals": len(evals), "failures": fails, "pid": os.getpid(), "when": pd.Timestamp.now().isoformat()}
