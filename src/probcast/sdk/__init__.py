"""ProbCast SDK: the ONLY module analyzers may import from probcast (import-linter enforced).

Writing an analyzer::

    from probcast.sdk import analyzer, Abstain, calibrate_c1

    @analyzer(
        id="technical.tsmom_12_1", version="1.0.0", name="Time-series momentum 12-1",
        family="technical.trend", category="technical", report_section="future",
        hypothesis="Positive 12-1 month momentum precedes higher forward returns.",
        expected_direction="positive", calibrator="C1", horizons=(21, 63, 126, 252),
        params={"lookback": 252, "skip": 21},
    )
    def forecast(ctx, params):
        ...
        return {h: calibrate_c1(ctx, signal_history, h) for h in (21, 63, 126, 252)}

An analyzer returns ``{horizon: Forecast | Abstain}``. It never reports P(up), mean or sd.
"""

from probcast.contract.distribution import from_normal, from_samples
from probcast.contract.grid import FAMILIES, HORIZONS, MEDIAN_INDEX, QUANTILE_LEVELS, TAUS
from probcast.sdk.calibrators import calibrate_c1, calibrate_c3, center_on_anchor
from probcast.sdk.registry import Abstain, AnalyzerSpec, Forecast, analyzer, get_registry

__all__ = [
    "FAMILIES", "HORIZONS", "MEDIAN_INDEX", "QUANTILE_LEVELS", "TAUS",
    "Abstain", "AnalyzerSpec", "Forecast", "analyzer", "calibrate_c1", "calibrate_c3",
    "center_on_anchor", "from_normal", "from_samples", "get_registry",
]
