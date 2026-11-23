"""The server's workspace: active data world, file cache, runs, committee and warm-up.

Expensive artefacts are cached as JSON (and Parquet for forecast tables) under
``$PROBCAST_HOME/artifacts/cache/<snapshot>/``, keyed by the snapshot hash, a configuration
hash and the analyzer versions (semver + code hash), so a code or data change invalidates
them. Backtests are saved as ordinary immutable run folders (``save_run``) and each newly
evaluated configuration is recorded once in the trials registry (NFR-SCI-06).

The fixture world (``data="fixtures"``, ticker DEMO) keeps its registries, runs and idea
cards under ``$PROBCAST_HOME/fixtures/`` so synthetic trials never mix with real ones.
"""

from __future__ import annotations

import contextlib
import hashlib
import inspect
import json
import logging
import os
import subprocess
import threading
from collections import OrderedDict
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
import yaml

import probcast
from probcast.committee.core import Member, as_run
from probcast.config import CONFIGS_DIR, REPO_ROOT, Settings, get_settings
from probcast.contract.grid import EVAL_START, HEADLINE_HORIZON, MEDIAN_INDEX
from probcast.engine.run import QCOLS, RunResult, origin_schedule, run_backtest, save_run
from probcast.lake.store import Lake, LakeError, Store
from probcast.scoring import registry as R
from probcast.sdk.registry import get_registry, get_spec
from probcast.server import forecast_view as FV
from probcast.server import policy as P
from probcast.server import scoring as SV
from probcast.server.jobs import JobManager
from probcast.server.problems import Problem, data_unavailable, not_found

log = logging.getLogger("probcast.server")

DataMode = Literal["snapshot", "fixtures"]
ANCHOR = "baseline.capm"
YARDSTICK = "baseline.hist_drift"
SECONDARY_DATE = "2027-12-31"  # D-049: 31 Dec 2027 line, extrapolated (as in `probcast committee freeze`)
HOLDOUT_ENV = "PROBCAST_HOLDOUT"  # D-089: "open" (default; all history scored) or "sealed" (the R1.0 seal)
STATS_VERSION = "1"  # bump when server/scoring.py changes what it computes


def holdout_open() -> bool:
    """D-089: the PO retired the sealed holdout, so all history is scored unless the R1.0 seal
    is switched back on with PROBCAST_HOLDOUT=sealed (the seal machinery and its tests remain)."""
    return os.environ.get(HOLDOUT_ENV, "open").strip().lower() != "sealed"


class Missing(Exception):
    """A cached artefact has not been computed yet (the caller schedules a job)."""


@dataclass(frozen=True)
class ComputeOptions:
    """Knobs for the expensive paths. Production uses the defaults (full origin schedule);
    tests use a coarser origin stride, serial workers and fewer bootstrap replicates."""

    origin_stride: int = 1
    workers: int | None = None
    n_boot: int = 1000
    leak: bool = True
    leak_origins: int = 12
    analyzers: tuple[str, ...] | None = None
    job_workers: int = 2


def iso(ts: Any) -> str | None:
    """UTC ISO-8601 with a Z suffix (date-only values pass through as YYYY-MM-DD)."""
    if ts is None or (isinstance(ts, float) and np.isnan(ts)):
        return None
    t = pd.Timestamp(ts)
    if t.tzinfo is None:
        t = t.tz_localize("UTC")
    return t.tz_convert("UTC").isoformat().replace("+00:00", "Z")


def _key(*parts: Any) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:16]


def _clean(x: Any) -> Any:
    """JSON-safe: NumPy scalars to Python, NaN/inf to None."""
    if isinstance(x, dict):
        return {str(k): _clean(v) for k, v in x.items()}
    if isinstance(x, list | tuple):
        return [_clean(v) for v in x]
    if isinstance(x, np.ndarray):
        return [_clean(v) for v in x.tolist()]
    if isinstance(x, np.integer):
        return int(x)
    if isinstance(x, float | np.floating):
        v = float(x)
        return v if np.isfinite(v) else None
    if isinstance(x, pd.Timestamp):
        return iso(x)
    return x


def _module_hash(*mods: Any) -> str:
    h = hashlib.sha256()
    for m in mods:
        try:
            h.update(inspect.getsource(m).encode())
        except (OSError, TypeError):
            h.update(getattr(m, "__name__", "?").encode())
    return h.hexdigest()[:10]


def _git_sha() -> str:
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True, timeout=2, check=False)
        return out.stdout.strip() if out.returncode == 0 and out.stdout.strip() else "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


class Workspace:
    def __init__(self, data: DataMode = "snapshot", snapshot: str | None = None, *, options: ComputeOptions | None = None,
                 settings: Settings | None = None, configs: Path = CONFIGS_DIR) -> None:
        if data not in ("snapshot", "fixtures"):
            raise ValueError(f"data must be 'snapshot' or 'fixtures', not {data!r}")
        self.data: DataMode = data
        self.fixtures = data == "fixtures"
        self.configs = configs
        self.settings = settings or get_settings()
        self.world = Settings(home=self.settings.home / "fixtures", sec_user_agent=None, fred_api_key=None, tiingo_api_key=None) if self.fixtures else self.settings
        self.ideas_dir = self.world.home / "ideas" if self.fixtures else Path(os.environ.get("PROBCAST_IDEAS_DIR") or REPO_ROOT / "ideas")
        self.options = options or ComputeOptions()
        self.jobs = JobManager(self.options.job_workers)
        self.committees = P.committee_refs(fixtures=self.fixtures, configs=configs)
        main = self.committees.get("main")
        if self.fixtures:
            from probcast.validation.fixtures import TICKER

            self.ticker = TICKER
        else:
            tks = P.tickers(fixtures=False, configs=configs)
            self.ticker = os.environ.get("PROBCAST_TICKER") or (main.config.ticker if main else (tks[0] if tks else "UNKNOWN"))
        self.requested_snapshot = snapshot or os.environ.get("PROBCAST_SNAPSHOT") or None
        self.started_at = datetime.now(UTC)
        self.version = probcast.__version__
        self.git_sha = _git_sha()
        self._lock = threading.RLock()
        self._keylocks: dict[str, threading.Lock] = {}
        self._store: Store | None = None
        self._manifest: dict[str, Any] | None = None
        self._runs: OrderedDict[str, RunResult] = OrderedDict()
        self._snapshot_info: dict[str, Any] | None = None
        self._memo: OrderedDict[str, Any] = OrderedDict()
        self._ctx: Any = None
        self._origins: dict[str, pd.DatetimeIndex] | None = None
        self.leak_key = _module_hash(__import__("probcast.validation.leak", fromlist=["x"]), __import__("probcast.validation.fixtures", fromlist=["x"]))

    # ------------------------------------------------------------------ data world
    def _snapshot_name(self) -> str:
        lake = Lake(self.settings)
        names = lake.list_snapshots()
        if self.requested_snapshot:
            if self.requested_snapshot not in names:
                raise data_unavailable(f"Snapshot {self.requested_snapshot!r} does not exist (known: {names}).", retry_after=60)
            return self.requested_snapshot
        if not names:
            raise data_unavailable("No snapshots yet: run `probcast ingest` and `probcast snapshot create NAME`, or start with PROBCAST_DATA=fixtures.", retry_after=60)
        return sorted(names, key=lambda n: lake.snapshot_manifest(n)["created_at"])[-1]

    @property
    def store(self) -> Store:
        with self._lock:
            if self._store is None:
                if self.fixtures:
                    from probcast.validation.fixtures import build_fixture_store

                    self._store = build_fixture_store()
                else:
                    name = self._snapshot_name()
                    lake = Lake(self.settings)
                    try:
                        self._manifest = lake.snapshot_manifest(name)
                        self._store = lake.load(name)
                    except LakeError as e:
                        raise data_unavailable(f"Snapshot {name!r} could not be loaded: {e}", retry_after=60) from e
            return self._store

    def preload(self) -> None:
        try:
            _ = self.store
            _ = self.snapshot_info()
        except Problem as p:
            log.warning("store not loaded: %s", p.detail)

    @property
    def snapshot_id(self) -> str:
        return self.store.snapshot_id

    @property
    def snapshot_hash(self) -> str:
        return self.store.snapshot_hash

    @property
    def cache_dir(self) -> Path:
        return self.settings.artifacts_dir / "cache" / self.snapshot_id

    def provenance(self, kind: str, id_: str, **extra: Any) -> dict[str, Any]:
        out = {"kind": kind, "id": id_, "snapshot": self.snapshot_id, "snapshot_hash": self.snapshot_hash}
        out.update({k: v for k, v in extra.items() if v is not None})
        return out

    def source_label(self) -> str:
        return "Synthetic (fixture)" if self.fixtures else "Local lake snapshot"

    def snapshot_info(self) -> dict[str, Any]:
        """Active snapshot: id, content hash, created_at, as-of close and per-dataset rows."""
        with self._lock:
            if self._snapshot_info is not None:
                return self._snapshot_info
            st = self.store
            px = st.table("prices")
            mine = px[px["ticker"] == self.ticker]
            asof = mine["available_at"].max() if not mine.empty else None
            datasets = []
            if self.fixtures:
                for name, df in sorted(st.tables.items()):
                    h = hashlib.sha256(pd.util.hash_pandas_object(df.astype(str), index=False).to_numpy().tobytes()).hexdigest()[:12]
                    datasets.append({"id": name, "ingested_at": iso(asof), "rows": len(df), "hash": h})
                created = iso(asof)
            else:
                m = self._manifest or {}
                groups: dict[str, list[dict[str, Any]]] = {}
                for f in m.get("files", []):
                    groups.setdefault(f["path"].split("/")[0], []).append(f)
                for name, files in sorted(groups.items()):
                    stamps = [Path(f["path"]).stem for f in files]
                    ing = max((pd.Timestamp(datetime.strptime(s, "%Y%m%dT%H%M%S%fZ").replace(tzinfo=UTC)) for s in stamps if s[:8].isdigit()), default=None)
                    h = hashlib.sha256("".join(sorted(f["sha256"] for f in files)).encode()).hexdigest()[:12]
                    datasets.append({"id": name, "ingested_at": iso(ing), "rows": sum(int(f["rows"]) for f in files), "hash": h})
                created = m.get("created_at")
                created = iso(created) if created else None
            rules = (yaml.safe_load((self.configs / "pit_rules.yaml").read_text()) or {}) if (self.configs / "pit_rules.yaml").exists() else {}
            self._snapshot_info = {"id": st.snapshot_id, "hash": st.snapshot_hash, "created_at": created, "asof_close": iso(asof),
                                   "datasets": datasets, "rule_count": len(rules.get("series", {}))}
            return self._snapshot_info

    def full_ctx(self) -> Any:
        """AsOfContext at the last session of the active ticker (display paths only)."""
        from probcast.pit.context import AsOfContext

        with self._lock:
            if self._ctx is None:
                px = self.store.table("prices")
                last = px.loc[px["ticker"] == self.ticker, "session_date"].max()
                if pd.isna(last):
                    raise data_unavailable(f"No prices for {self.ticker} in snapshot {self.snapshot_id}.", retry_after=60)
                self._ctx = AsOfContext(self.store, last, self.ticker)
            return self._ctx

    # ------------------------------------------------------------------ cache
    def _path(self, rel: str) -> Path:
        return self.cache_dir / f"{rel}.json"

    def cache_get(self, rel: str) -> Any:
        """Read a cached artefact. Stats and committee bundles are immutable once written
        (their key encodes every input), so they are memoised in memory."""
        memo = rel.startswith(("stats/", "committee/"))
        if memo:
            with self._lock:
                if rel in self._memo:
                    return self._memo[rel]
        p = self._path(rel)
        if not p.exists():
            return None
        try:
            obj = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        if memo:
            with self._lock:
                self._memo[rel] = obj
                while len(self._memo) > 256:
                    self._memo.popitem(last=False)
        return obj

    def cache_has(self, rel: str) -> bool:
        """Whether a cached artefact exists (no parsing; for cheap readiness checks)."""
        return self._path(rel).exists()

    def cache_put(self, rel: str, obj: Any) -> Any:
        p = self._path(rel)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(f".tmp{threading.get_ident()}")
        tmp.write_text(json.dumps(_clean(obj), default=str), encoding="utf-8")
        os.replace(tmp, p)
        return obj

    @contextlib.contextmanager
    def keylock(self, key: str) -> Iterator[None]:
        with self._lock:
            lk = self._keylocks.setdefault(key, threading.Lock())
        with lk:
            yield

    # ------------------------------------------------------------------ registries
    def trial_counts(self) -> dict[str, Any]:
        return R.trial_counts(self.world)

    def trials_for(self, analyzer_id: str, family: str) -> dict[str, Any]:
        tc = self.trial_counts()
        return {"analyzer": int(tc["by_analyzer"].get(analyzer_id, 0)), "family": {"id": family, "n": int(tc["by_family"].get(family, 0))}, "team": int(tc["team"])}

    def _trial_known(self, manifest: dict[str, Any]) -> bool:
        k = (manifest["analyzer_id"], manifest["params_hash"], manifest["analyzer_version"])
        return any((r["analyzer_id"], r["params_hash"], r["analyzer_version"]) == k for r in R.read("trials", self.world))

    def revealed(self) -> bool:
        """The holdout seal is retired (D-089): every matured outcome is scored. The reveal
        ledger is still read so older registries stay valid."""
        return holdout_open() or R.holdout_revealed(self.world)

    def audit(self, actor: str, action: str, target: str, reason: str = "") -> dict[str, Any]:
        return R.append("audit", {"actor": actor, "action": action, "target": target, "reason": reason,
                                  "snapshot_id": self.snapshot_id, "data": self.data}, self.world)

    # ------------------------------------------------------------------ analyzers and runs
    def universe(self) -> list[str]:
        """Stocks the studio offers (configs/universes/top32.yaml, D-097) that have prices in the
        active snapshot; the default ticker first. Falls back to the default ticker alone."""
        with self._lock:
            if getattr(self, "_universe", None) is not None:
                return self._universe  # type: ignore[has-type]
        names: list[str] = []
        if not self.fixtures:
            p = self.configs / "universes" / "top32.yaml"
            if p.exists():
                names = list((yaml.safe_load(p.read_text()) or {}).get("tickers", []))
        px = self.store.table("prices")
        have = set(px["ticker"].unique())
        out = [self.ticker] + [t for t in names if t != self.ticker and t in have]
        with self._lock:
            self._universe = out
        return out

    def analyzer_ids(self) -> list[str]:
        ids = sorted(a for a in get_registry() if not a.startswith("test."))
        if self.options.analyzers is not None:
            keep = set(self.options.analyzers) | {ANCHOR, YARDSTICK}
            ids = [a for a in ids if a in keep]
        return ids

    def origins(self, ticker: str | None = None) -> pd.DatetimeIndex | None:
        if self.options.origin_stride <= 1:
            return None
        tk = ticker or self.ticker
        with self._lock:
            if self._origins is None:
                self._origins = {}
            if tk not in self._origins:
                sched = origin_schedule(self.store, tk, EVAL_START, None)
                self._origins[tk] = sched[::-1][:: self.options.origin_stride][::-1]  # always keeps the latest origin
            return self._origins[tk]

    def store_for(self, ticker: str) -> Store:
        """The snapshot reduced to one stock and the symbols its config names (benchmarks, peers,
        suppliers): same snapshot id and hash, identical forecasts (analyzers only read the stock
        and its configured symbols), far less data to ship to worker processes (D-101)."""
        with self._lock:
            cache = getattr(self, "_stores", None)
            if cache is None:
                cache = self._stores = {}
            if ticker in cache:
                return cache[ticker]
        from probcast.ingest.common import flatten_symbols

        cp = self.configs / "tickers" / f"{ticker}.yaml"
        cfg = (yaml.safe_load(cp.read_text()) or {}) if cp.exists() else {}
        keep = {ticker, *flatten_symbols(cfg.get("benchmarks")), *flatten_symbols(cfg.get("peers")), *flatten_symbols(cfg.get("suppliers"))}
        st = self.store
        tables = {k: (v[v["ticker"].isin(keep)].reset_index(drop=True) if "ticker" in v.columns else v) for k, v in st.tables.items()}
        sub = Store(tables=tables, snapshot_id=st.snapshot_id, snapshot_hash=st.snapshot_hash)
        with self._lock:
            self._stores[ticker] = sub
        return sub

    def run_key(self, analyzer_id: str, params: dict[str, Any] | None, horizons: tuple[int, ...] | None, seed: int,
                ticker: str | None = None) -> str:
        spec = get_spec(analyzer_id)
        return _key("run", self.snapshot_hash, analyzer_id, spec.version, spec.params(params), ticker or self.ticker,
                    self.options.origin_stride, horizons, seed)

    def ensure_run(self, analyzer_id: str, params: dict[str, Any] | None = None, *, horizons: tuple[int, ...] | None = None, seed: int = 7,
                   author: str = "probcast", compute: bool, on_rows: Callable[..., None] | None = None,
                   ticker: str | None = None) -> tuple[str, bool]:
        """Return (run_id, cache_hit). An identical configuration on the same snapshot is never
        re-run (no new trial); a new one is backtested, saved and recorded as a trial."""
        try:
            spec = get_spec(analyzer_id)
        except KeyError as e:
            raise not_found(f"analyzer {analyzer_id!r}") from e
        tk = ticker or self.ticker
        rel = f"runs/{self.run_key(analyzer_id, params, horizons, seed, tk)}"
        hit = self.cache_get(rel)
        if hit and (self.world.runs_dir / hit["run_id"]).exists():
            return hit["run_id"], True
        if not compute:
            raise Missing(rel)
        with self.keylock(rel):
            hit = self.cache_get(rel)
            if hit and (self.world.runs_dir / hit["run_id"]).exists():
                return hit["run_id"], True
            self.jobs.progress(f"backtest {analyzer_id}")
            res = run_backtest(self.store_for(tk), spec, params, ticker=tk, horizons=horizons, seed=seed, origins=self.origins(tk),
                               author=author, workers=self.options.workers, on_rows=on_rows)
            res.manifest["origin_stride"] = self.options.origin_stride
            save_run(res, self.world)
            if not self._trial_known(res.manifest):
                R.record_trial(res.manifest, self.world)
            self.cache_put(rel, {"run_id": res.run_id, "analyzer": analyzer_id, "version": spec.version, "params_hash": res.manifest["params_hash"]})
            with self._lock:
                self._runs[res.run_id] = res
            return res.run_id, False

    def adopt_run(self, res: RunResult, *, ticker: str) -> str:
        """Save a backtest computed elsewhere (bulk workers) exactly as ``ensure_run`` would: run
        folder, one trial in the registry (parent process only), and the run-cache entry."""
        analyzer_id = res.manifest["analyzer_id"]
        rel = f"runs/{self.run_key(analyzer_id, None, None, 7, ticker)}"
        hit = self.cache_get(rel)
        if hit and (self.world.runs_dir / hit["run_id"]).exists():
            return hit["run_id"]
        res.manifest["origin_stride"] = self.options.origin_stride
        save_run(res, self.world)
        if not self._trial_known(res.manifest):
            R.record_trial(res.manifest, self.world)
        self.cache_put(rel, {"run_id": res.run_id, "analyzer": analyzer_id, "version": res.manifest["analyzer_version"],
                             "params_hash": res.manifest["params_hash"]})
        with self._lock:
            self._runs[res.run_id] = res
        return res.run_id

    def default_run_id(self, analyzer_id: str, params: dict[str, Any] | None = None, *, compute: bool, ticker: str | None = None) -> str:
        return self.ensure_run(analyzer_id, params, compute=compute, ticker=ticker)[0]

    def run_manifest(self, run_id: str) -> dict[str, Any]:
        if run_id.startswith("C-"):
            p = self.cache_dir / "committee" / f"{run_id}.manifest.json"
        else:
            p = self.world.runs_dir / run_id / "manifest.json"
        if "/" in run_id or ".." in run_id or not p.exists():
            raise not_found(f"run {run_id!r}")
        man = json.loads(p.read_text(encoding="utf-8"))
        if man.get("snapshot_id") != self.snapshot_id:
            raise not_found(f"run {run_id!r} on the active snapshot {self.snapshot_id!r}")
        return man

    def load_run(self, run_id: str) -> RunResult:
        with self._lock:
            if run_id in self._runs:
                self._runs.move_to_end(run_id)
                return self._runs[run_id]
        man = self.run_manifest(run_id)
        if run_id.startswith("C-"):
            fc = pd.read_parquet(self.cache_dir / "committee" / f"{run_id}.parquet")
            spec = get_spec(ANCHOR)
        else:
            fc = pd.read_parquet(self.world.runs_dir / run_id / "forecasts.parquet")
            try:
                spec = get_spec(man["analyzer_id"])
            except KeyError as e:
                raise not_found(f"analyzer {man['analyzer_id']!r} for run {run_id!r} (no longer registered)") from e
        res = RunResult(run_id=run_id, spec=spec, params=man.get("config", {}).get("params", {}), forecasts=fc, manifest=man)
        with self._lock:
            self._runs[run_id] = res
            while len(self._runs) > 64:
                self._runs.popitem(last=False)
        return res

    def list_manifests(self) -> list[dict[str, Any]]:
        d = self.world.runs_dir
        out = []
        for p in sorted(d.glob("*/manifest.json")) if d.exists() else []:
            try:
                m = json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if m.get("snapshot_id") == self.snapshot_id and m.get("snapshot_hash") == self.snapshot_hash:
                out.append(m)
        return sorted(out, key=lambda m: m.get("created_at", ""), reverse=True)

    # ------------------------------------------------------------------ scores
    def stats(self, run_id: str, *, compute: bool) -> dict[str, Any]:
        anchor = self.default_run_id(ANCHOR, compute=compute)
        yard = self.default_run_id(YARDSTICK, compute=compute)
        revealed = self.revealed()
        rel = f"stats/{run_id}.{_key(STATS_VERSION, anchor, yard, revealed, self.options.n_boot)}"
        hit = self.cache_get(rel)
        if hit is not None:
            return hit
        if not compute:
            raise Missing(rel)
        with self.keylock(rel):
            hit = self.cache_get(rel)
            if hit is not None:
                return hit
            self.jobs.progress(f"scores {run_id}")
            out = SV.run_stats(self.store, self.ticker, self.load_run(run_id), self.load_run(anchor), self.load_run(yard),
                               revealed=revealed, n_boot=self.options.n_boot)
            return self.cache_put(rel, _clean(out))

    # ------------------------------------------------------------------ leak suite (synthetic fixtures; snapshot-independent)
    def _leak_path(self, analyzer_id: str) -> Path:
        v = get_spec(analyzer_id).version
        return self.settings.artifacts_dir / "cache" / "leak" / f"{analyzer_id}@{v}-{self.leak_key}-{self.options.leak_origins}.json"

    def leak(self, analyzer_id: str, *, compute: bool = False) -> dict[str, Any] | None:
        p = self._leak_path(analyzer_id)
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
        if not compute:
            return None
        from probcast.validation.leak import run_leak_suite

        with self.keylock(str(p)):
            if p.exists():
                return json.loads(p.read_text(encoding="utf-8"))
            self.jobs.progress(f"leak suite {analyzer_id}")
            rep = run_leak_suite(get_spec(analyzer_id), n_origins=self.options.leak_origins)
            rec = {"analyzer": analyzer_id, "version": get_spec(analyzer_id).version, "at": iso(datetime.now(UTC)), "ok": rep.ok,
                   "passed": rep.passed, "details": rep.details}
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(rec, indent=2), encoding="utf-8")
            return rec

    # ------------------------------------------------------------------ committee
    def committee_ref(self, cid: str) -> P.CommitteeRef:
        if cid not in self.committees:
            raise not_found(f"committee {cid!r} (known: {sorted(self.committees)})")
        return self.committees[cid]

    def member_runs(self, ref: P.CommitteeRef, *, compute: bool) -> list[dict[str, Any]]:
        cfg = ref.config
        out = []
        for m in cfg.members:
            if m.analyzer in cfg.vetoes:
                continue
            out.append({"analyzer": m.analyzer, "family": m.family, "params": dict(m.params),
                        "run_id": self.default_run_id(m.analyzer, dict(m.params) or None, compute=compute)})
        return out

    def committee_bundle(self, ref: P.CommitteeRef, *, compute: bool) -> dict[str, Any]:
        """Committee backtest + final object, mirroring `probcast committee freeze` (same members,
        combination, spread recalibration, attribution and extra date), so a working forecast on
        the frozen snapshot reproduces the frozen SHA-256."""
        anchor_id = self.default_run_id(ANCHOR, compute=compute)
        yard_id = self.default_run_id(YARDSTICK, compute=compute)
        members = self.member_runs(ref, compute=compute)
        key = _key("committee", STATS_VERSION, ref.config_hash, anchor_id, yard_id, [m["run_id"] for m in members])
        rel = f"committee/{key}"
        hit = self.cache_get(rel)
        if hit is not None:
            return hit
        if not compute:
            raise Missing(rel)
        with self.keylock(rel):
            hit = self.cache_get(rel)
            if hit is not None:
                return hit
            return self.cache_put(rel, self._compute_committee(ref, key, anchor_id, yard_id, members))

    def _compute_committee(self, ref: P.CommitteeRef, key: str, anchor_id: str, yard_id: str, members: list[dict[str, Any]]) -> dict[str, Any]:
        cfg = ref.config
        st, tk = self.store, self.ticker
        anc, yd = self.load_run(anchor_id), self.load_run(yard_id)
        mem = []
        for m in members:
            r = self.load_run(m["run_id"])
            mem.append(Member(m["analyzer"], m["family"], r, r.spec.manifest.informs))
        self.jobs.progress(f"committee {ref.id}: gate, combine, spread recalibration")
        from probcast.committee.pipeline import run_committee

        outc = run_committee(st, tk, cfg, mem, anc)
        res = outc.result
        # The committee's backtest as a pseudo-run, scored like any analyzer.
        cid = f"C-{key[:12]}"
        crun = as_run(res, anc, name=f"committee:{cfg.name}")
        crun.run_id = cid
        crun.manifest.update({"run_id": cid, "analyzer_id": f"committee:{cfg.name}", "family": "committee", "committee_config_hash": ref.config_hash})
        d = self.cache_dir / "committee"
        d.mkdir(parents=True, exist_ok=True)
        crun.forecasts.to_parquet(d / f"{cid}.parquet", index=False)
        (d / f"{cid}.manifest.json").write_text(json.dumps(crun.manifest, indent=2, default=str), encoding="utf-8")
        f = res.forecasts
        t = f["origin"].max()
        cq = {int(h): f[(f.origin == t) & (f.horizon == h)][QCOLS].to_numpy()[0] for h in f.horizon.unique()}
        self.jobs.progress(f"committee {ref.id}: final object")
        final, att = outc.final, outc.attribution
        fq = res.family_quantiles[(t, HEADLINE_HORIZON)]
        comp = res.composition
        crow = comp[(comp.origin == t) & (comp.horizon == HEADLINE_HORIZON)].iloc[0]
        active = json.loads(crow["members"])
        fam_of = {m["analyzer"]: m["family"] for m in members}
        members_by_family: dict[str, int] = {}
        for a in active:
            members_by_family[fam_of[a]] = members_by_family.get(fam_of[a], 0) + 1
        frow = f[(f.origin == t) & (f.horizon == HEADLINE_HORIZON)].iloc[0]
        spread = float(frow.get("spread", 1.0)) if "spread" in f.columns else 1.0

        def at_t(run: RunResult) -> dict[int, np.ndarray]:
            g = run.forecasts
            g = g[(g.origin == t) & g.abstain.isna()]
            return {int(r.horizon): r[QCOLS].to_numpy(float) for _, r in g.iterrows()}

        p0, dy = float(final["p0"]), float(final["dividend_yield"])
        q12 = cq[HEADLINE_HORIZON]
        px = st.table("prices")
        first_px = px.loc[px["ticker"] == tk, "session_date"].min()
        return {
            "key": key,
            "committee": ref.id,
            "name": cfg.name,
            "config_hash": ref.config_hash,
            "anchor_weight": cfg.anchor_weight,
            "erp": cfg.erp,
            "spread_recalibration": cfg.spread_recalibration,
            "run_id": cid,
            "anchor_run": anchor_id,
            "yardstick_run": yard_id,
            "members": members,
            "vetoes": dict(cfg.vetoes),
            "origin": t.date().isoformat(),
            "first_price_date": pd.Timestamp(first_px).date().isoformat(),
            "final": final,
            "cq": {str(h): q for h, q in cq.items()},
            "family_q": {k: v for k, v in fq.items()},
            "active_members": active,
            "members_by_family": members_by_family,
            "spread": spread,
            "effective_location_weight": att["effective_anchor_location_weight"],
            "derived": {
                "fan_monthly": FV.fan_monthly(final, t),
                "refs": {"capm": FV.ref_path(at_t(anc), t, p0, dy), "hist_drift": FV.ref_path(at_t(yd), t, p0, dy)},
                "summary": FV.summary(q12, final),
                "distribution": FV.distribution(q12, p0, dy),
                "exceedance": FV.exceedance(q12, dy),
                "anchor_sensitivity": FV.anchor_sensitivity(final, q12, cfg.erp),
                "lofo": FV.lofo(fq, cfg.anchor_weight, spread, q12, dy),
                "waterfall": FV.waterfall(fq, cfg.anchor_weight, q12, members_by_family),
                "family_rets": {k: float(FV.price_q(v[MEDIAN_INDEX], HEADLINE_HORIZON, p0, dy) / p0 - 1) for k, v in fq.items() if k != "__anchor__"},
            },
        }

    # ------------------------------------------------------------------ warm-up
    def warm(self, say: Callable[[str], None] | None = None) -> dict[str, Any]:
        """Precompute the default committee, every analyzer's default run and scores (the
        leaderboard), the final object, and the leak suite. Idempotent: cached items are skipped."""
        def note(msg: str) -> None:
            self.jobs.progress(msg)
            if say:
                say(msg)

        ids = self.analyzer_ids()
        note(f"snapshot {self.snapshot_id} · ticker {self.ticker} · {len(ids)} analyzers")
        for a in (ANCHOR, YARDSTICK):
            self.default_run_id(a, compute=True)
            note(f"reference run ready: {a}")
        main = self.committees.get("main")
        if main is not None:
            b = self.committee_bundle(main, compute=True)
            self.stats(b["run_id"], compute=True)
            for m in b["members"]:
                self.stats(m["run_id"], compute=True)
            note(f"committee {main.config.name} ready (final sha256 {b['final']['sha256'][:12]}…)")
        for a in ids:
            if get_spec(a).manifest.family == "baseline" and a not in (ANCHOR, YARDSTICK):
                continue
            rid = self.default_run_id(a, compute=True)
            self.stats(rid, compute=True)
            note(f"scores ready: {a}")
        from probcast.studio.service import Studio

        Studio(self).warm(note)
        n_leak = 0
        if self.options.leak:
            for a in ids:
                rec = self.leak(a, compute=True)
                n_leak += 1
                note(f"leak suite {a}: {'passed' if rec and rec['ok'] else 'FAILED'}")
        return {"snapshot": self.snapshot_id, "analyzers": len(ids), "leak_tested": n_leak,
                "committee": main.config.name if main else None}
