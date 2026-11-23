"""Append-only, hash-chained registries under the canonical state root (ADR-008).

``trials.jsonl`` counts every evaluated configuration (NFR-SCI-06). ``ideas.jsonl``,
``freezes.jsonl``, ``unlocks.jsonl`` and ``audit.jsonl`` use the same mechanism. Each line
carries ``prev_hash`` and ``hash`` (SHA-256 of the line body + prev_hash), so any deletion or
edit breaks the chain. Writes take an exclusive file lock (parallel worktrees, RT-06).
"""

from __future__ import annotations

import fcntl
import hashlib
import json
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from probcast.config import Settings, get_settings

GENESIS = "0" * 64


class RegistryError(RuntimeError):
    pass


@contextmanager
def _locked(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            yield f
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def _body_hash(body: dict[str, Any], prev: str) -> str:
    return hashlib.sha256((json.dumps(body, sort_keys=True, default=str) + prev).encode()).hexdigest()


def read(name: str, settings: Settings | None = None) -> list[dict[str, Any]]:
    p = (settings or get_settings()).registry_dir / f"{name}.jsonl"
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]


def verify(name: str, settings: Settings | None = None) -> bool:
    prev = GENESIS
    for i, rec in enumerate(read(name, settings)):
        body = {k: v for k, v in rec.items() if k not in ("hash", "prev_hash")}
        if rec.get("prev_hash") != prev or rec.get("hash") != _body_hash(body, prev):
            raise RegistryError(f"{name}.jsonl: chain broken at record {i}")
        prev = rec["hash"]
    return True


def append(name: str, body: dict[str, Any], settings: Settings | None = None) -> dict[str, Any]:
    s = settings or get_settings()
    p = s.registry_dir / f"{name}.jsonl"
    with _locked(p) as f:
        f.seek(0)
        lines = [ln for ln in f.read().splitlines() if ln.strip()]
        prev = json.loads(lines[-1])["hash"] if lines else GENESIS
        body = {"seq": len(lines) + 1, "ts": datetime.now(UTC).isoformat(), **body}
        rec = {**body, "prev_hash": prev, "hash": _body_hash(body, prev)}
        f.seek(0, 2)
        f.write(json.dumps(rec, sort_keys=True, default=str) + "\n")
        f.flush()
    return rec


def record_trial(manifest: dict[str, Any], settings: Settings | None = None) -> dict[str, Any]:
    body = {
        "run_id": manifest["run_id"],
        "analyzer_id": manifest["analyzer_id"],
        "analyzer_version": manifest["analyzer_version"],
        "params_hash": manifest["params_hash"],
        "config_hash": manifest["config_hash"],
        "family": manifest.get("family"),
        "snapshot_id": manifest["snapshot_id"],
        "author": manifest["config"].get("author", "probcast"),
    }
    return append("trials", body, settings)


def trial_counts(settings: Settings | None = None) -> dict[str, Any]:
    """Distinct evaluated configurations: team-wide, per family and per analyzer."""
    recs = read("trials", settings)
    seen = {(r["analyzer_id"], r["params_hash"], r["analyzer_version"]) for r in recs}
    fam: dict[str, set] = {}
    by_an: dict[str, set] = {}
    for r in recs:
        key = (r["analyzer_id"], r["params_hash"], r["analyzer_version"])
        fam.setdefault(r.get("family") or "?", set()).add(key)
        by_an.setdefault(r["analyzer_id"], set()).add(key)
    return {"team": len(seen), "by_family": {k: len(v) for k, v in fam.items()}, "by_analyzer": {k: len(v) for k, v in by_an.items()}}


def holdout_revealed(settings: Settings | None = None) -> bool:
    return any(r.get("action") == "reveal" for r in read("unlocks", settings))
