"""Background jobs (thread pool) for expensive work: backtests, scoring, committee evaluation.

Requests never run heavy computations on the event loop: they enqueue a job (deduplicated by
key, so two requests for the same artefact share one job) and the client polls
``GET /api/v1/jobs/{id}``.
"""

from __future__ import annotations

import logging
import threading
import traceback
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from probcast.server.problems import Problem

log = logging.getLogger("probcast.server.jobs")


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


@dataclass
class Job:
    id: str
    kind: str
    key: str
    label: str
    actor: str | None
    status: str = "queued"  # queued | running | succeeded | failed
    created_at: str = field(default_factory=_now)
    started_at: str | None = None
    finished_at: str | None = None
    progress: str | None = None
    detail: dict[str, Any] | None = None  # structured progress (e.g. backtest origins done, streamed points)
    result: Any = None
    problem: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        out = {k: v for k, v in self.__dict__.items() if k != "key"}
        return {k: v for k, v in out.items() if v is not None}


class JobManager:
    def __init__(self, max_workers: int = 2) -> None:
        self._max_workers = max_workers
        self._pool = self._new_pool()
        self._jobs: dict[str, Job] = {}
        self._active: dict[str, str] = {}  # key -> job id (queued or running)
        self._lock = threading.Lock()
        self._local = threading.local()

    def submit(self, kind: str, key: str, label: str, fn: Callable[[], Any], *, actor: str | None = None) -> Job:
        """Queue ``fn`` unless a job with the same key is already queued or running."""
        with self._lock:
            jid = self._active.get(key)
            if jid is not None:
                return self._jobs[jid]
            job = Job(id="J-" + uuid.uuid4().hex[:10], kind=kind, key=key, label=label, actor=actor)
            self._jobs[job.id] = job
            self._active[key] = job.id
        try:
            self._pool.submit(self._run, job, fn)
        except RuntimeError:  # pool shut down by an earlier app lifespan: start a fresh one
            self._pool = self._new_pool()
            self._pool.submit(self._run, job, fn)
        return job

    def _new_pool(self) -> ThreadPoolExecutor:
        return ThreadPoolExecutor(max_workers=self._max_workers, thread_name_prefix="probcast-job")

    def _run(self, job: Job, fn: Callable[[], Any]) -> None:
        job.status, job.started_at = "running", _now()
        self._local.job = job
        try:
            job.result = fn()
            job.status = "succeeded"
        except Problem as p:
            job.problem, job.status = p.body(), "failed"
        except Exception as e:
            log.error("job %s (%s) failed:\n%s", job.id, job.label, traceback.format_exc())
            job.problem = Problem(500, "Internal", "Job failed", f"{type(e).__name__}: {e}", id=job.id).body()
            job.status = "failed"
        finally:
            job.finished_at = _now()
            self._local.job = None
            with self._lock:
                if self._active.get(job.key) == job.id:
                    del self._active[job.key]

    def progress(self, message: str) -> None:
        """Report progress from inside a running job (no-op outside a job thread)."""
        job = getattr(self._local, "job", None)
        if job is not None:
            job.progress = message
        log.info("%s", message)

    def progress_detail(self, detail: dict[str, Any]) -> None:
        """Attach structured progress to the running job (no-op outside a job thread)."""
        job = getattr(self._local, "job", None)
        if job is not None:
            job.detail = detail

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def active(self) -> list[Job]:
        with self._lock:
            return [self._jobs[j] for j in self._active.values()]

    def shutdown(self, wait: bool = False) -> None:
        self._pool.shutdown(wait=wait, cancel_futures=True)
