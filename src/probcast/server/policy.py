"""Read-only research policy and configuration lookups for the API (no engine maths here).

Values come from `configs/` when the file exists (`research_policy.yaml`, `authors.yaml`,
`committees/*.yaml`, `tickers/*.yaml`) and otherwise fall back to the documented R1 defaults
(ADR-015 / D-058 freeze and reveal times, FR-ENG-16 trial budget and grid cap).
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from probcast.config import CONFIGS_DIR
from probcast.contract.models import CommitteeConfig

#: ADR-015 / D-058: freeze by Mon 30 Nov 23:59 UK, reveal Tue 1 Dec 12:00 UK (UK = UTC in winter).
DEFAULT_POLICY: dict[str, Any] = {
    "freeze_at": "2026-11-30T23:59:00Z",
    "reveal_at": "2026-12-01T12:00:00Z",
    "trial_budget": 20,  # soft budget per idea (FR-ENG-16)
    "grid_cap": 30,  # hard cap of configurations per family (FR-ENG-16)
}

HANDLE_RE = re.compile(r"^[a-z][a-z0-9_-]{1,31}$")

#: Synthetic handles for the fixture world only (the real list lives in configs/authors.yaml).
FIXTURE_AUTHORS: tuple[dict[str, Any], ...] = (
    {"handle": "kestrel", "role": "integrator", "slot": 1},
    {"handle": "heron", "role": "member", "slot": 2},
    {"handle": "wren", "role": "member", "slot": 3},
    {"handle": "finch", "role": "member", "slot": 4},
    {"handle": "osprey", "role": "member", "slot": 5},
)


def _yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else None


def research_policy(configs: Path = CONFIGS_DIR) -> dict[str, Any]:
    out = dict(DEFAULT_POLICY)
    doc = _yaml(configs / "research_policy.yaml") or {}
    for k in DEFAULT_POLICY:
        if k in doc:
            out[k] = doc[k]
    return out


def authors(*, fixtures: bool, configs: Path = CONFIGS_DIR) -> list[dict[str, Any]]:
    """Handles only (never real names). Fixture mode uses synthetic handles."""
    if fixtures:
        return [dict(a) for a in FIXTURE_AUTHORS]
    doc = _yaml(configs / "authors.yaml") or {}
    items = doc.get("authors", doc) if isinstance(doc, dict) else doc
    out = []
    for i, a in enumerate(items or []):
        if isinstance(a, str):
            a = {"handle": a}
        handle = str(a.get("handle", "")).strip()
        if HANDLE_RE.match(handle):
            out.append({"handle": handle, "role": a.get("role", "member"), "slot": int(a.get("slot", i % 6 + 1))})
    return out


def ticker_config(ticker: str, configs: Path = CONFIGS_DIR) -> dict[str, Any]:
    return _yaml(configs / "tickers" / f"{ticker}.yaml") or {"ticker": ticker}


def tickers(*, fixtures: bool, configs: Path = CONFIGS_DIR) -> list[str]:
    out = []
    for p in sorted((configs / "tickers").glob("*.yaml")):
        cfg = _yaml(p) or {}
        if bool(cfg.get("synthetic")) == fixtures:
            out.append(str(cfg.get("ticker", p.stem)))
    return out


@dataclass(frozen=True)
class CommitteeRef:
    """A committee config file, addressable as ``main`` (the default) or by file stem."""

    id: str
    path: Path
    config: CommitteeConfig
    config_hash: str  # SHA-256 of the YAML bytes (as recorded by `probcast committee freeze`)


DEFAULT_COMMITTEE = {"fixtures": "demo", "snapshot": "r1-default"}


def committee_refs(*, fixtures: bool, configs: Path = CONFIGS_DIR) -> dict[str, CommitteeRef]:
    """Committee configs for the active world, keyed by id; ``main`` aliases the default."""
    refs: dict[str, CommitteeRef] = {}
    for p in sorted((configs / "committees").glob("*.yaml")):
        cfg = CommitteeConfig(**yaml.safe_load(p.read_text(encoding="utf-8")))
        synthetic = bool((_yaml(configs / "tickers" / f"{cfg.ticker}.yaml") or {}).get("synthetic"))
        if synthetic != fixtures:
            continue
        refs[p.stem] = CommitteeRef(p.stem, p, cfg, hashlib.sha256(p.read_bytes()).hexdigest())
    default = DEFAULT_COMMITTEE["fixtures" if fixtures else "snapshot"]
    if default in refs:
        r = refs[default]
        refs = {"main": CommitteeRef("main", r.path, r.config, r.config_hash), **refs}
    return refs
