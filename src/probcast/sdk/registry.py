"""Analyzer registration, discovery and versioning (A7 ARC-ADR-08)."""

from __future__ import annotations

import hashlib
import importlib
import inspect
import json
import pkgutil
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from probcast.contract.models import AnalyzerManifest


@dataclass(frozen=True)
class Abstain:
    reason: str


@dataclass(frozen=True)
class Forecast:
    """One horizon's output: 23 quantiles of forward log total return (+ optional extras)."""

    quantiles: np.ndarray
    signal: float | None = None
    calibration: dict[str, Any] = field(default_factory=dict)
    drivers: tuple[dict[str, Any], ...] = ()


ForecastFn = Callable[[Any, dict[str, Any]], dict[int, Forecast | Abstain]]


@dataclass(frozen=True)
class AnalyzerSpec:
    manifest: AnalyzerManifest
    fn: ForecastFn
    default_params: dict[str, Any]
    code_hash: str

    @property
    def id(self) -> str:
        return self.manifest.id

    @property
    def version(self) -> str:
        """semver + code hash (contract §10)."""
        return f"{self.manifest.version}+{self.code_hash[:7]}"

    def params(self, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
        p = dict(self.default_params)
        p.update(overrides or {})
        return p


_REGISTRY: dict[str, AnalyzerSpec] = {}
_DISCOVERED = False


_PLATFORM_HASH: str | None = None


def platform_code_hash() -> str:
    """SHA-256 over the platform code an analyzer's output depends on (contract §10):
    contract/, pit/, sdk/ and calendar.py. Any change re-versions every analyzer, so cached
    forecasts can never outlive a fix in shared code (found: an SDK EPS fix kept old caches)."""
    global _PLATFORM_HASH
    if _PLATFORM_HASH is None:
        from pathlib import Path

        root = Path(__file__).resolve().parents[1]
        h = hashlib.sha256()
        files = sorted([*root.joinpath("contract").glob("*.py"), *root.joinpath("pit").glob("*.py"),
                        *root.joinpath("sdk").glob("*.py"), root / "calendar.py"])
        for f in files:
            h.update(f.name.encode())
            h.update(f.read_bytes())
        _PLATFORM_HASH = h.hexdigest()
    return _PLATFORM_HASH


def _code_hash(fn: Callable, manifest: AnalyzerManifest, params: dict[str, Any]) -> str:
    try:
        src = inspect.getsource(inspect.getmodule(fn))  # whole module: helpers count too
    except (OSError, TypeError):
        src = fn.__qualname__
    h = hashlib.sha256()
    h.update(platform_code_hash().encode())
    h.update(src.encode())
    h.update(manifest.model_dump_json().encode())
    h.update(json.dumps(params, sort_keys=True, default=str).encode())
    return h.hexdigest()


def analyzer(*, params: dict[str, Any] | None = None, **manifest_fields: Any) -> Callable[[ForecastFn], ForecastFn]:
    """Register a forecast function as an analyzer. Keyword args are AnalyzerManifest fields."""

    def deco(fn: ForecastFn) -> ForecastFn:
        manifest = AnalyzerManifest(**manifest_fields)
        p = dict(params or {})
        spec = AnalyzerSpec(manifest=manifest, fn=fn, default_params=p, code_hash=_code_hash(fn, manifest, p))
        if manifest.id in _REGISTRY and _REGISTRY[manifest.id].code_hash != spec.code_hash:
            raise ValueError(f"duplicate analyzer id {manifest.id!r}")
        _REGISTRY[manifest.id] = spec
        fn.spec = spec  # type: ignore[attr-defined]
        return fn

    return deco


def discover() -> None:
    """Import every module under probcast_analyzers (builtin + team plugins)."""
    import probcast_analyzers

    for mod in pkgutil.walk_packages(probcast_analyzers.__path__, prefix="probcast_analyzers."):
        importlib.import_module(mod.name)


def get_registry(*, refresh: bool = False) -> dict[str, AnalyzerSpec]:
    global _DISCOVERED
    if refresh or not _DISCOVERED:
        discover()
        _DISCOVERED = True
    return dict(_REGISTRY)


def get_spec(analyzer_id: str) -> AnalyzerSpec:
    reg = get_registry()
    if analyzer_id not in reg:
        raise KeyError(f"unknown analyzer {analyzer_id!r}; known: {sorted(reg)}")
    return reg[analyzer_id]
