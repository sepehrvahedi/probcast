"""RFC 9457 problem details with ProbCast's typed errors (architecture §8; FR-UI-03)."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_BASE = "https://probcast.local/problems/"
PROBLEM_MEDIA_TYPE = "application/problem+json"

log = logging.getLogger("probcast.server")

_SLUGS = {
    "PITViolation": "pit-violation",
    "DataUnavailable": "data-unavailable",
    "HoldoutLocked": "holdout-locked",
    "ContractError": "contract-error",
    "NotFound": "not-found",
    "Forbidden": "forbidden",
    "Conflict": "conflict",
    "UnsupportedMediaType": "unsupported-media-type",
    "Internal": "internal",
}


class Problem(Exception):
    """An HTTP error rendered as ``application/problem+json``."""

    def __init__(
        self,
        status: int,
        error: str,
        title: str,
        detail: str | None = None,
        *,
        headers: dict[str, str] | None = None,
        **extra: Any,
    ) -> None:
        super().__init__(detail or title)
        self.status = status
        self.error = error
        self.title = title
        self.detail = detail
        self.headers = headers or {}
        self.extra = extra

    def body(self, instance: str | None = None) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": PROBLEM_BASE + _SLUGS.get(self.error, "about-blank"),
            "title": self.title,
            "status": self.status,
            "error": self.error,
        }
        if self.detail:
            out["detail"] = self.detail
        if instance:
            out["instance"] = instance
        out.update({k: v for k, v in self.extra.items() if v is not None})
        return out


def not_found(what: str) -> Problem:
    return Problem(404, "NotFound", "Not found", f"No {what}.")


def data_unavailable(detail: str, *, job_id: str | None = None, retry_after: int = 5) -> Problem:
    return Problem(503, "DataUnavailable", "Data unavailable", detail, headers={"Retry-After": str(retry_after)}, job_id=job_id)


def holdout_locked(detail: str) -> Problem:
    return Problem(423, "HoldoutLocked", "Holdout locked", detail)


def contract_error(detail: str, **extra: Any) -> Problem:
    return Problem(422, "ContractError", "ContractError", detail, **extra)


def forbidden(detail: str) -> Problem:
    return Problem(403, "Forbidden", "Forbidden", detail)


def problem_response(p: Problem, request: Request | None = None) -> JSONResponse:
    return JSONResponse(p.body(str(request.url.path) if request else None), status_code=p.status,
                        headers=p.headers, media_type=PROBLEM_MEDIA_TYPE)


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(Problem)
    async def _problem(request: Request, exc: Problem) -> JSONResponse:
        return problem_response(exc, request)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        error = {404: "NotFound", 403: "Forbidden", 409: "Conflict", 415: "UnsupportedMediaType"}.get(exc.status_code, "ContractError")
        title = "Not found" if exc.status_code == 404 else str(exc.detail)
        return problem_response(Problem(exc.status_code, error, title, str(exc.detail), headers=getattr(exc, "headers", None)), request)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errs = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", "")} for e in exc.errors()]
        return problem_response(contract_error("Request failed validation.", errors=errs), request)

    @app.exception_handler(Exception)
    async def _internal(request: Request, exc: Exception) -> JSONResponse:
        ref = "E-" + uuid.uuid4().hex[:6].upper()
        log.exception("unhandled error %s on %s", ref, request.url.path)
        return problem_response(Problem(500, "Internal", "Internal error", f"Unexpected error (reference {ref}).", id=ref), request)
