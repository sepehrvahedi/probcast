"""R1.1 feature routers. Each slice (data, report, lab) registers its own endpoints here so
parallel work never edits app.py. Registered before the unknown-API 404 and the SPA fallback."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI


@dataclass(frozen=True)
class ExtContext:
    ws: Any  # probcast.server.workspace.Workspace
    actor: Callable[..., str]  # FastAPI dependency: the X-Acting-As handle (writes only)
    need: Callable[[str, str, Callable[[bool], Any]], Any]  # cached artefact or 503 + job id
    guard: Callable[..., Any]  # PL.guard_sealed: strips sealed holdout values
    api: str  # "/api/v1"
    json: Callable[[Any], Any]  # app._json: SafeJSONResponse wrapper


def register_all(app: FastAPI, ctx: ExtContext) -> None:
    from probcast.server.ext import data, lab, report, studio

    for mod in (data, report, lab, studio):
        mod.register(app, ctx)
