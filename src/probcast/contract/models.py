"""Pydantic models for every boundary in CONTRACT v1.1.

Hot paths use NumPy arrays; these models are used at boundaries (plugin output validation,
configs, manifests, API payloads) and to export JSON Schemas for the UI.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from probcast.contract.distribution import InvalidForecast, validate
from probcast.contract.grid import FAMILIES, HORIZONS, N_QUANTILES

Category = Literal[
    "macro", "sector", "fundamental", "technical", "event",
    "sentiment", "statistical", "judgemental", "baseline",
]
ReportSection = Literal["intro", "macro", "sector", "fundamental", "future"]
Calibrator = Literal["C1", "C3", "C5", "CJ", "none"]
Informs = Literal["location", "scale"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Driver(_Strict):
    name: str
    value: float | None = None
    contribution_to_median: float | None = None
    source: str | None = None


class Explanation(_Strict):
    drivers: tuple[Driver, ...] = ()
    notes_template: str | None = None
    citations: tuple[str, ...] = ()


class HorizonForecast(_Strict):
    """One horizon of a forecast: 23 quantiles of forward log total return."""

    quantiles: tuple[float, ...]
    signal: float | None = None
    calibration: dict[str, Any] = Field(default_factory=dict)
    explanation: Explanation = Field(default_factory=Explanation)

    @field_validator("quantiles")
    @classmethod
    def _check(cls, v: tuple[float, ...]) -> tuple[float, ...]:
        if len(v) != N_QUANTILES:
            raise ValueError(f"need {N_QUANTILES} quantiles")
        try:
            fixed = validate(np.asarray(v))[0]
        except InvalidForecast as e:
            raise ValueError(str(e)) from e
        return tuple(float(x) for x in fixed)


class Abstain(_Strict):
    abstain: str


class ForecastBundle(_Strict):
    """What an analyzer returns for one origin (contract §5)."""

    asof: datetime
    forecasts: dict[int, HorizonForecast | Abstain]

    @model_validator(mode="after")
    def _horizons(self) -> ForecastBundle:
        bad = set(self.forecasts) - set(HORIZONS)
        if bad:
            raise ValueError(f"unknown horizons {sorted(bad)}; allowed {HORIZONS}")
        return self

    @model_validator(mode="before")
    @classmethod
    def _no_self_reported(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k in ("p_up", "mean", "sd"):
                if k in data:
                    raise ValueError(f"'{k}' must not be self-reported; it is derived (contract §1.2)")
        return data


class AnalyzerManifest(_Strict):
    """Declared once per analyzer version (contract §3)."""

    id: str = Field(pattern=r"^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$")
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    name: str
    author: str = "probcast"
    idea_card: str | None = None
    family: str
    category: Category
    report_section: ReportSection
    informs: tuple[Informs, ...] = ("location",)
    hypothesis: str
    expected_direction: str | None = None
    course_concepts: tuple[str, ...] = ()
    references: tuple[str, ...] = ()
    horizons: tuple[int, ...] = HORIZONS
    data_dependencies: tuple[str, ...] = ()
    min_history_sessions: int = 252
    calibrator: Calibrator = "none"
    param_grid_declared: dict[str, list[Any]] = Field(default_factory=dict)

    @field_validator("family")
    @classmethod
    def _family(cls, v: str) -> str:
        if v not in (*FAMILIES, "baseline"):
            raise ValueError(f"family must be one of {FAMILIES} or 'baseline'")
        return v

    @field_validator("horizons")
    @classmethod
    def _hz(cls, v: tuple[int, ...]) -> tuple[int, ...]:
        if not set(v) <= set(HORIZONS):
            raise ValueError(f"horizons must be a subset of {HORIZONS}")
        return tuple(sorted(v))


class ExperimentConfig(_Strict):
    """A backtest run configuration (A2 §11, simplified for R1)."""

    name: str
    analyzer: str
    params: dict[str, Any] = Field(default_factory=dict)
    ticker: str = "AAPL"
    snapshot: str = "latest"
    start: date = date(1990, 1, 1)
    end: date | None = None
    horizons: tuple[int, ...] = HORIZONS
    origins: Literal["month_end"] = "month_end"
    strict_mode: bool = False
    seed: int = 7
    author: str = "probcast"


class CommitteeMember(_Strict):
    analyzer: str
    params: dict[str, Any] = Field(default_factory=dict)
    family: str


class CommitteeConfig(_Strict):
    name: str
    ticker: str = "AAPL"
    members: tuple[CommitteeMember, ...]
    anchor_weight: float = 0.25
    erp: float = 0.05
    spread_recalibration: bool = True
    vetoes: dict[str, str] = Field(default_factory=dict)


class IdeaCard(_Strict):
    """Pre-registration record (05-requirements/idea-card.md)."""

    id: str = Field(pattern=r"^IC-\d{3}$")
    title: str
    author: str
    report_section: ReportSection
    course_concepts: tuple[str, ...]
    hypothesis: str
    rationale: str
    data_needed: tuple[str, ...]
    rule: str
    parameters: dict[str, list[Any]] = Field(default_factory=dict)
    horizons: tuple[int, ...]
    expected_direction: str
    success_criterion: str
    drop_if: str
    references: tuple[str, ...] = ()
    holdout_ack: bool = False
    created_at: datetime | None = None


class RunManifest(_Strict):
    run_id: str
    created_at: datetime
    config: ExperimentConfig
    config_hash: str
    analyzer_version: str
    params_hash: str
    snapshot_id: str
    snapshot_hash: str
    platform_version: str
    contract_version: str
    python: str
    seed: int
    n_origins: int
    status: Literal["complete", "failed"] = "complete"
