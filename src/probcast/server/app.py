"""FastAPI app: the local (127.0.0.1-only) API that wires the engine to the pro UI.

``create_app`` builds the app for the active data world: the newest lake snapshot (default),
or the synthetic fixture store with ticker DEMO (``data="fixtures"`` or
``PROBCAST_DATA=fixtures``). Read endpoints serve cached artefacts; anything not yet
computed is queued as a background job and answered with a 503 ``DataUnavailable`` problem
that names the job to poll. Committee freeze and holdout reveal are CLI-only (D-047): there is
no endpoint for either.

Localhost hardening (RT-34; NFR-SEC-03/06): TrustedHostMiddleware (127.0.0.1, localhost);
writes need a local ``Origin`` (same origin, or the Vite dev/preview server), a JSON body and
an ``X-Acting-As`` handle (attribution, not security); errors are RFC 9457 problem details.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
from collections.abc import Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import yaml
from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from probcast.config import REPO_ROOT, Settings
from probcast.contract.grid import HORIZONS
from probcast.contract.models import IdeaCard
from probcast.scoring import registry as R
from probcast.sdk.registry import get_spec
from probcast.server import payloads as PL
from probcast.server import policy as P
from probcast.server.problems import (
    Problem,
    contract_error,
    data_unavailable,
    forbidden,
    install_handlers,
    not_found,
    problem_response,
)
from probcast.server.workspace import ANCHOR, ComputeOptions, Missing, Workspace, _clean, iso

log = logging.getLogger("probcast.server")

API = "/api/v1"
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
#: The Vite dev server and preview (web/vite.config.ts), allowed for CORS and writes.
DEV_ORIGINS = [f"http://{h}:{p}" for h in ("127.0.0.1", "localhost") for p in (5173, 4173)]
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
LOCAL_ORIGIN = re.compile(r"^https?://(127\.0\.0\.1|localhost)(:\d{1,5})?$")


class SafeJSONResponse(JSONResponse):
    """JSON with NumPy scalars converted and NaN/inf sent as null (strict JSON)."""

    def render(self, content: Any) -> bytes:
        return json.dumps(_clean(content), allow_nan=False, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")


class RunRequest(BaseModel):
    """POST /api/v1/runs: the standard protocol on the active snapshot and ticker."""

    model_config = ConfigDict(extra="forbid")
    analyzer: str
    params: dict[str, Any] = Field(default_factory=dict)
    horizons: list[int] | None = None
    seed: int = 7
    ticker: str | None = None
    snapshot: str | None = None


def _json(payload: Any, status: int = 200, headers: dict[str, str] | None = None) -> Response:
    """Render inside the handler (thread pool) so the event loop never encodes large payloads."""
    return SafeJSONResponse(payload, status_code=status, headers=headers)


def _job_response(job: Any, status: int = 202) -> Response:
    body = job.to_dict() | {"url": f"{API}/jobs/{job.id}", "provenance": {"kind": "run", "id": job.id}}
    return _json(body, status, {"Location": f"{API}/jobs/{job.id}"})


def create_app(
    *,
    data: Literal["snapshot", "fixtures"] | None = None,
    snapshot: str | None = None,
    options: ComputeOptions | None = None,
    autowarm: bool = False,
    settings: Settings | None = None,
    web_dist: Path | None = None,
) -> FastAPI:
    """Build the API. ``data`` defaults to ``$PROBCAST_DATA`` or ``"snapshot"`` (newest snapshot
    unless ``snapshot``/``$PROBCAST_SNAPSHOT`` names one). Bind it to 127.0.0.1 only."""
    mode = data or os.environ.get("PROBCAST_DATA") or "snapshot"
    if mode not in ("snapshot", "fixtures"):
        raise ValueError(f"PROBCAST_DATA must be 'snapshot' or 'fixtures', not {mode!r}")
    ws = Workspace(mode, snapshot, options=options, settings=settings)  # type: ignore[arg-type]
    dist = web_dist or Path(os.environ.get("PROBCAST_WEB_DIST") or REPO_ROOT / "web" / "dist")
    ideas_lock = threading.Lock()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        threading.Thread(target=ws.preload, name="probcast-preload", daemon=True).start()
        if autowarm:
            ws.jobs.submit("warm", "warm", "warm-up (committee, leaderboard, leak suite)", ws.warm)
        yield
        ws.jobs.shutdown(wait=False)

    app = FastAPI(title="ProbCast local API", version=ws.version, default_response_class=SafeJSONResponse, lifespan=lifespan,
                  docs_url=f"{API}/docs", openapi_url=f"{API}/openapi.json", redoc_url=None)
    app.state.workspace = ws
    install_handlers(app)

    # -------------------------------------------------------------- localhost hardening
    @app.middleware("http")
    async def write_guard(request: Request, call_next: Callable[[Request], Any]) -> Response:
        if request.method in WRITE_METHODS:
            origin = request.headers.get("origin")
            host = request.headers.get("host", "")
            same = origin in (f"http://{host}", f"https://{host}")
            if not origin or not LOCAL_ORIGIN.match(origin) or not (same or origin in DEV_ORIGINS):
                return problem_response(forbidden(f"Writes need the local app's Origin (got {origin or 'none'})."), request)
            ctype = request.headers.get("content-type", "").split(";")[0].strip().lower()
            if ctype != "application/json":
                return problem_response(Problem(415, "UnsupportedMediaType", "Unsupported media type", "Write endpoints accept application/json only."), request)
        return await call_next(request)

    app.add_middleware(CORSMiddleware, allow_origins=DEV_ORIGINS, allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type", "X-Acting-As", "Accept"], expose_headers=["Location", "Retry-After"])
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)

    def actor(x_acting_as: str | None = Header(default=None)) -> str:
        h = (x_acting_as or "").strip()
        if not P.HANDLE_RE.match(h):
            raise contract_error("Writes need an X-Acting-As header with a handle (lower-case, 2–32 characters).")
        known = [a["handle"] for a in P.authors(fixtures=ws.fixtures, configs=ws.configs)]
        if known and h not in known:
            raise forbidden(f"Unknown handle {h!r}; choose one from /api/v1/authors.")
        return h

    def need(key: str, label: str, fn: Callable[[bool], Any]) -> Any:
        """Return a cached artefact, or queue its computation and answer 503 with the job id."""
        try:
            return fn(False)
        except Missing:
            def run() -> dict[str, Any]:
                fn(True)
                return {"ready": label}

            job = ws.jobs.submit("compute", key, label, run)
            raise data_unavailable(f"{label} is not computed yet; job {job.id} is computing it (poll {API}/jobs/{job.id}, "
                                   "or precompute with `probcast serve-warm`).", job_id=job.id) from None

    guard = PL.guard_sealed

    # -------------------------------------------------------------- meta
    @app.get(f"{API}/health")
    def health() -> Any:
        return _json(PL.health(ws))

    @app.get(f"{API}/status")
    def status() -> Any:
        return _json(PL.status(ws))

    @app.get(f"{API}/authors")
    def authors() -> Any:
        return _json(PL.authors(ws))

    @app.get(f"{API}/snapshots")
    def snapshots() -> Any:
        return _json(PL.snapshots(ws))

    @app.get(f"{API}/analyzers")
    def analyzers() -> Any:
        return _json(PL.analyzers(ws))

    @app.get(f"{API}/analyzers/{{aid}}")
    def analyzer(aid: str) -> Any:
        return _json(PL.analyzer(ws, aid))

    @app.get(f"{API}/jobs/{{jid}}")
    def job(jid: str) -> Any:
        j = ws.jobs.get(jid)
        if j is None:
            raise not_found(f"job {jid!r} (jobs live in memory and end with the server process)")
        return _json(j.to_dict() | {"provenance": {"kind": "run", "id": jid}})

    # -------------------------------------------------------------- data
    @app.get(f"{API}/prices/{{ticker}}")
    def prices(ticker: str, basis: str = "display_adjusted") -> Any:
        return _json(PL.prices(ws, ticker, basis))

    @app.get(f"{API}/events")
    def events() -> Any:
        return _json(PL.events(ws))

    # -------------------------------------------------------------- committee and final forecast
    @app.get(f"{API}/committees")
    def committees() -> Any:
        return _json(PL.committees_list(ws))

    @app.get(f"{API}/committees/{{cid}}")
    def committee(cid: str) -> Any:
        ws.committee_ref(cid)
        need(f"committee:{cid}", f"Committee {cid}", lambda c: PL.need_committee(ws, cid, compute=c))
        return _json(guard(ws, PL.committee(ws, cid)))

    @app.post(f"{API}/committees/{{cid}}/evaluate", status_code=202)
    def committee_evaluate(cid: str, who: str = Depends(actor)) -> Any:
        ref = ws.committee_ref(cid)
        ws.audit(who, "committee.evaluate", f"committee:{ref.id}", f"config {ref.path.name} on {ws.snapshot_id}")
        j = ws.jobs.submit("committee", f"committee:{cid}", f"Committee {cid}",
                           lambda: {"committee": cid, "run_id": PL.need_committee(ws, cid, compute=True)["run_id"]}, actor=who)
        return _job_response(j)

    @app.get(f"{API}/forecast/final")
    def forecast_final() -> Any:
        if "main" not in ws.committees:
            raise not_found("default committee config for this data world")
        need("committee:main", "Committee main", lambda c: PL.need_committee(ws, "main", compute=c))
        return _json(guard(ws, PL.final_forecast(ws, "main")))

    # -------------------------------------------------------------- leaderboard
    @app.get(f"{API}/leaderboard")
    def leaderboard(horizon: int = Query(default=252)) -> Any:
        def fn(c: bool) -> None:
            PL._leaderboard_runs(ws, compute=c, strict=True)
            ws.stats(ws.default_run_id(ANCHOR, compute=c), compute=c)

        need("leaderboard", "Leaderboard", fn)
        return _json(guard(ws, PL.leaderboard(ws, horizon)))

    # -------------------------------------------------------------- runs
    @app.get(f"{API}/runs")
    def runs(status: str | None = None, analyzer: str | None = None, author: str | None = None,
             family: str | None = None, horizon: int | None = None) -> Any:
        return _json(PL.runs_index(ws, status=status, analyzer=analyzer, author=author, family=family, horizon=horizon))

    @app.get(f"{API}/runs/{{rid}}")
    def run(rid: str) -> Any:
        return _json(PL.run(ws, rid))

    def _plain_run(rid: str) -> None:
        if rid.startswith("C-"):
            raise not_found(f"run {rid!r} (committee backtests are served under {API}/committees)")
        ws.run_manifest(rid)

    @app.get(f"{API}/runs/{{rid}}/scores")
    def run_scores(rid: str) -> Any:
        _plain_run(rid)
        st = need(f"stats:{rid}", f"Scores for run {rid}", lambda c: ws.stats(rid, compute=c))
        return _json(guard(ws, PL.run_scores(ws, rid, st)))

    @app.get(f"{API}/runs/{{rid}}/forecasts")
    def run_forecasts(rid: str, horizon: int = Query(default=252)) -> Any:
        _plain_run(rid)
        anchor = need(f"run:{ANCHOR}", "CAPM anchor run", lambda c: ws.default_run_id(ANCHOR, compute=c))
        return _json(guard(ws, PL.run_forecasts(ws, rid, horizon, anchor)))

    @app.post(f"{API}/runs", status_code=202)
    def launch_run(body: RunRequest, who: str = Depends(actor)) -> Any:
        try:
            spec = get_spec(body.analyzer)
        except KeyError:
            raise not_found(f"analyzer {body.analyzer!r}") from None
        if body.analyzer.startswith("test."):
            raise not_found(f"analyzer {body.analyzer!r}")
        if body.ticker not in (None, ws.ticker):
            raise contract_error(f"This server runs {ws.ticker} only (requested {body.ticker}).")
        if body.snapshot not in (None, ws.snapshot_id):
            raise contract_error(f"The active snapshot is {ws.snapshot_id} (requested {body.snapshot}).")
        unknown = sorted(set(body.params) - set(spec.default_params))
        if unknown:
            raise contract_error(f"Unknown parameters for {spec.id}: {unknown}; declared: {sorted(spec.default_params)}.")
        hz = None
        if body.horizons is not None:
            bad = sorted(set(body.horizons) - set(spec.manifest.horizons))
            if bad or not body.horizons:
                raise contract_error(f"Horizons must be a non-empty subset of {spec.manifest.horizons} (contract §3).")
            hz = tuple(sorted(set(body.horizons)))
        params = body.params or None
        try:
            rid, _ = ws.ensure_run(spec.id, params, horizons=hz, seed=body.seed, compute=False)
            new = False
        except Missing:
            rid, new = None, True
        if new:  # FR-ENG-16: hard cap of configurations per family (the cap+1-th is refused)
            cap = P.research_policy(ws.configs)["grid_cap"]
            fam = spec.manifest.family
            n = ws.trial_counts()["by_family"].get(fam, 0)
            if fam != "baseline" and n >= cap:
                raise Problem(409, "Conflict", "Grid cap reached", f"Family {fam} already has {n} evaluated configurations (cap {cap}).")
        ws.audit(who, "run.launch", spec.id, json.dumps({"params": body.params, "horizons": hz, "seed": body.seed}, sort_keys=True))

        def work() -> dict[str, Any]:
            before = ws.trial_counts()["by_analyzer"].get(spec.id, 0)
            run_id, hit = ws.ensure_run(spec.id, params, horizons=hz, seed=body.seed, author=who, compute=True)
            ws.stats(run_id, compute=True)
            new_trial = ws.trial_counts()["by_analyzer"].get(spec.id, 0) > before
            if hit:
                msg = "This exact configuration was already evaluated: opening the existing run. No new trial."
            elif new_trial:
                msg = "New run saved and recorded as a new trial."
            else:
                msg = "New run saved; its configuration (analyzer, parameters, version) was already a trial, so no new trial."
            return {"run_id": run_id, "cache_hit": hit, "new_trial": new_trial, "message": msg, "url": f"{API}/runs/{run_id}"}

        j = ws.jobs.submit("run", f"run:{ws.run_key(spec.id, params, hz, body.seed)}", f"Backtest {spec.id}", work, actor=who)
        if rid is not None and j.status == "queued":
            j.progress = "cache hit"
        return _job_response(j)

    # -------------------------------------------------------------- ideas (pre-registration)
    @app.get(f"{API}/ideas")
    def ideas() -> Any:
        return _json(PL.ideas(ws))

    @app.post(f"{API}/ideas", status_code=201)
    def register_idea(body: dict[str, Any], who: str = Depends(actor)) -> Any:
        pol = P.research_policy(ws.configs)
        with ideas_lock:
            known = {r["id"] for r in R.read("ideas", ws.world)}
            cid = body.get("id")
            if cid is None:
                nums = [int(k[3:6]) for k in known if re.match(r"^IC-\d{3}$", k)]
                nums += [int(p.stem[3:6]) for p in ws.ideas_dir.glob("IC-*.yaml") if re.match(r"^IC-\d{3}", p.stem)]
                cid = f"IC-{max(nums, default=0) + 1:03d}"
            if cid in known or (ws.ideas_dir / f"{cid}.yaml").exists():
                raise Problem(409, "Conflict", "Already registered", f"{cid} is registered; content is immutable after registration (amend with a new card).")
            try:
                card = IdeaCard(**{**body, "id": cid, "created_at": datetime.now(UTC)})
            except ValidationError as e:
                raise contract_error("Idea card failed validation.", errors=[{"loc": list(x["loc"]), "msg": x["msg"]} for x in e.errors()]) from None
            content = card.model_dump(mode="json")
            content_hash = hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
            ws.ideas_dir.mkdir(parents=True, exist_ok=True)
            path = ws.ideas_dir / f"{cid}.yaml"
            path.write_text(yaml.safe_dump(content, sort_keys=False, allow_unicode=True), encoding="utf-8")
            try:
                shown = str(path.relative_to(REPO_ROOT))
            except ValueError:
                shown = str(path)
            rec = R.append("ideas", {"id": cid, "title": card.title, "author": card.author, "entered_by": who, "content_hash": content_hash,
                                     "path": shown, "report_section": card.report_section, "horizons": list(card.horizons),
                                     "success_criterion": card.success_criterion, "status": "registered"}, ws.world)
            ws.audit(who, "idea.register", cid, card.title)
        planned = math.prod(max(1, len(v)) for v in card.parameters.values()) if card.parameters else 1
        checks = [
            {"id": "parameters", "ok": all(len(v) <= 4 for v in card.parameters.values()),
             "detail": "At most 3 alternatives per parameter (idea-card §1)."},
            {"id": "planned_trials", "ok": planned <= pol["trial_budget"], "detail": f"Planned configurations {planned}; soft budget {pol['trial_budget']}."},
            {"id": "holdout_ack", "ok": card.holdout_ack, "detail": "Designed without looking at results for 2021 onwards."},
            {"id": "horizons", "ok": set(card.horizons) <= set(HORIZONS), "detail": f"Horizons must be in {list(HORIZONS)}."},
        ]
        out = {k: v for k, v in rec.items() if k != "prev_hash"} | {"checks": checks, "card": content,
                                                                     "provenance": {"kind": "ledger", "id": "registry/ideas.jsonl", "key": cid}}
        return SafeJSONResponse(PL._fx(ws, out), status_code=201, headers={"Location": f"{API}/ideas"})

    # -------------------------------------------------------------- R1.1 feature slices (server/ext/*)
    from probcast.server.ext import ExtContext, register_all

    register_all(app, ExtContext(ws=ws, actor=actor, need=need, guard=guard, api=API, json=_json))

    # -------------------------------------------------------------- unknown API paths, then the SPA
    @app.api_route(f"{API}/{{rest:path}}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_not_found(rest: str) -> Any:
        raise not_found(f"API endpoint /{rest} (freeze and reveal are CLI-only by design, D-047)")

    if (dist / "index.html").exists():
        root = dist.resolve()

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> Any:
            f = (root / path).resolve()
            if path and f.is_file() and f.is_relative_to(root):
                return FileResponse(f)
            return FileResponse(root / "index.html", media_type="text/html")

    app.state.started_at = iso(ws.started_at)
    return app
