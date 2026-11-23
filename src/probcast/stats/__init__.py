"""Pure statistical functions (NumPy/SciPy only): proper scores, calibration diagnostics,
forecast-comparison tests, bootstrap CIs and evidence grading (A2 §5; ADR-013; NFR-SCI-09).

Submodules: :mod:`~probcast.stats.scores`, :mod:`~probcast.stats.calibration`,
:mod:`~probcast.stats.tests`, :mod:`~probcast.stats.bootstrap`, :mod:`~probcast.stats.evidence`.
"""

from probcast.stats import bootstrap, calibration, evidence, scores, tests

__all__ = ["bootstrap", "calibration", "evidence", "scores", "tests"]
