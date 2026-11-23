"""Binding constants from CONTRACT v1.1 (docs/kb/06-architecture/analyzer-contract.md).

Changing anything here is a contract change: it needs an ADR and a version bump, and every
analyzer must be re-validated.
"""

from __future__ import annotations

from datetime import date

import numpy as np

CONTRACT_VERSION = "1.1"

#: Canonical 23-level quantile grid (U.S. COVID-19 Forecast Hub grid; Bracher et al. 2021).
QUANTILE_LEVELS: tuple[float, ...] = (
    0.01, 0.025, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50,
    0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.975, 0.99,
)
TAUS: np.ndarray = np.asarray(QUANTILE_LEVELS, dtype=float)
N_QUANTILES = len(QUANTILE_LEVELS)
MEDIAN_INDEX = QUANTILE_LEVELS.index(0.50)

#: Forecast horizons in trading sessions (~1 week, 1 month, 1 quarter, 6 months, 12 months).
HORIZONS: tuple[int, ...] = (5, 21, 63, 126, 252)
HEADLINE_HORIZON = 252

#: Sessions per "origin step" for monthly origins (used for HAC lags / n_eff in origin units).
SESSIONS_PER_MONTH = 21

#: Fixed committee families (contract §7). One family = one vote.
FAMILIES: tuple[str, ...] = (
    "technical.trend",
    "technical.reversion",
    "volatility",
    "macro.rates",
    "macro.fx",
    "valuation",
    "events",
    "sentiment_alt",
    "fundamental.growth",
    "calendar",
    "fundamental.quality",
    "macro.credit",
    "macro.commodity",
    "macro.cycle",
)
BASELINE_FAMILY = "baseline"

#: Research policy (ADR-005 / contract §2). Segments are defined on the OUTCOME date t + h.
EVAL_START = date(1990, 1, 1)
DEV_END = date(2015, 12, 31)
VAL_END = date(2020, 12, 31)
HOLDOUT_START = date(2021, 1, 1)

#: CAPM anchor (ADR-006).
ERP_DEFAULT = 0.05
ERP_SENSITIVITY = (0.04, 0.05, 0.06)
ANCHOR_WEIGHT = 0.25

#: Plausibility bounds on log total return quantiles (contract §2 validity).
LOG_RETURN_LOWER = -3.0
LOG_RETURN_UPPER = 3.0

#: Shrinkage constant for calibrator C1 (contract §8).
KAPPA_C1 = 20.0

#: Economic-threshold scenarios on the 12-month simple return (CRT-A-015).
SCENARIO_THRESHOLDS = (-0.15, 0.15)


def segment_for_outcome(outcome_date: date) -> str:
    """Segment of an (origin, horizon) pair, by the date its outcome is known (RT-03)."""
    if outcome_date <= DEV_END:
        return "dev"
    if outcome_date <= VAL_END:
        return "val"
    return "holdout"


def origin_steps(horizon: int) -> int:
    """Horizon expressed in monthly-origin units (k), e.g. 252 -> 12, 21 -> 1, 5 -> 1."""
    return max(1, int(np.ceil(horizon / SESSIONS_PER_MONTH)))
