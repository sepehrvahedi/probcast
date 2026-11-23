"""CONTRACT v1.1 as code (docs/kb/06-architecture/analyzer-contract.md)."""

from probcast.contract import distribution
from probcast.contract.grid import (
    ANCHOR_WEIGHT,
    CONTRACT_VERSION,
    FAMILIES,
    HEADLINE_HORIZON,
    HORIZONS,
    MEDIAN_INDEX,
    N_QUANTILES,
    QUANTILE_LEVELS,
    TAUS,
    segment_for_outcome,
)

__all__ = [
    "ANCHOR_WEIGHT", "CONTRACT_VERSION", "FAMILIES", "HEADLINE_HORIZON", "HORIZONS",
    "MEDIAN_INDEX", "N_QUANTILES", "QUANTILE_LEVELS", "TAUS", "distribution",
    "segment_for_outcome",
]
